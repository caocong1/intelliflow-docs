import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, count, desc, eq } from "drizzle-orm";
import Automizer from "pptx-automizer";
import { db } from "../../db";
import { pptTemplates } from "../../db/schema";

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || "./data/workspaces";
const TEMPLATE_DIR = join(WORKSPACE_ROOT, "uploads", "ppt-templates");
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const PLACEHOLDER_RE = /\{\{([A-Z_]+)\}\}/g;

const VALID_LAYOUT_TYPES = [
  "title",
  "content",
  "two_column",
  "table",
  "image",
  "blank",
] as const;

type LayoutType = (typeof VALID_LAYOUT_TYPES)[number];

interface ParsedTemplateInfo {
  layouts: Map<string, Set<string>>; // layoutName → set of placeholder names
  allPlaceholders: Set<string>;
  warnings: string[];
}

/**
 * Parse a .pptx buffer using pptx-automizer to extract layout names and {{XXX}} placeholders.
 */
async function parsePptxTemplate(buffer: Buffer): Promise<ParsedTemplateInfo> {
  const layouts = new Map<string, Set<string>>();
  const allPlaceholders = new Set<string>();
  const warnings: string[] = [];

  try {
    const automizer = new Automizer({
      templateDir: "",
      outputDir: "",
    });

    automizer.loadRoot(buffer);
    const templateInfos = await automizer.setCreationIds();

    if (!templateInfos || templateInfos.length === 0) {
      warnings.push("无法解析模板幻灯片信息");
      return { layouts, allPlaceholders, warnings };
    }

    const tplInfo = templateInfos[0];

    for (const slide of tplInfo.slides) {
      const layoutName = slide.info?.layoutName ?? `Slide ${slide.number}`;

      if (!layouts.has(layoutName)) {
        layouts.set(layoutName, new Set());
      }
      const placeholderSet = layouts.get(layoutName)!;

      // Scan element text for {{XXX}} placeholders
      for (const element of slide.elements) {
        if (!element.hasTextBody) continue;
        try {
          const texts = element.getText();
          for (const text of texts) {
            let match: RegExpExecArray | null;
            PLACEHOLDER_RE.lastIndex = 0;
            while ((match = PLACEHOLDER_RE.exec(text)) !== null) {
              placeholderSet.add(match[1]);
              allPlaceholders.add(match[1]);
            }
          }
        } catch {
          // Some elements may not support getText
        }
      }
    }
  } catch (err) {
    warnings.push(
      `pptx-automizer 解析失败: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { layouts, allPlaceholders, warnings };
}

/**
 * Upload and validate a native .pptx template file.
 */
export async function uploadTemplate(input: {
  file: File;
  name: string;
  description?: string;
  createdBy?: string;
}) {
  const { file, name, description, createdBy } = input;

  // Validate file type
  if (
    !file.name.endsWith(".pptx") &&
    file.type !==
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    throw new Error("INVALID_FILE_TYPE");
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("FILE_TOO_LARGE");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Parse template with pptx-automizer
  const parsed = await parsePptxTemplate(buffer);

  // Reject if no placeholders found at all
  if (parsed.allPlaceholders.size === 0 && parsed.warnings.length === 0) {
    throw new Error("NO_PLACEHOLDERS");
  }

  // Validate: need at least one layout with {{TITLE}} and one with {{BODY}}
  let hasTitleLayout = false;
  let hasBodyLayout = false;

  for (const [, placeholders] of parsed.layouts) {
    if (placeholders.has("TITLE")) hasTitleLayout = true;
    if (placeholders.has("BODY")) hasBodyLayout = true;
  }

  if (parsed.allPlaceholders.size > 0 && !hasTitleLayout) {
    throw new Error("MISSING_TITLE_PLACEHOLDER");
  }
  if (parsed.allPlaceholders.size > 0 && !hasBodyLayout) {
    throw new Error("MISSING_BODY_PLACEHOLDER");
  }

  // Save file to disk
  await mkdir(TEMPLATE_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.pptx`;
  const filePath = join(TEMPLATE_DIR, filename);
  await writeFile(filePath, buffer);

  // Build availableLayouts summary
  const availableLayouts: string[] = [];
  for (const [layoutName, placeholders] of parsed.layouts) {
    if (placeholders.size > 0) {
      availableLayouts.push(
        `${layoutName}:${[...placeholders].sort().join(",")}`,
      );
    }
  }

  // Create DB record
  const template = await createTemplate({
    name,
    description,
    type: "native_pptx",
    templateFilePath: filePath,
    availableLayouts,
    createdBy,
  });

  return {
    template,
    validation: {
      layouts: Object.fromEntries(
        [...parsed.layouts].map(([k, v]) => [k, [...v]]),
      ),
      allPlaceholders: [...parsed.allPlaceholders],
      warnings: parsed.warnings,
    },
  };
}

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

/**
 * Validate a code theme configuration object.
 */
export function validateThemeConfig(config: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof config !== "object" || config === null) {
    return { valid: false, errors: ["themeConfig 必须是对象"] };
  }

  const cfg = config as Record<string, unknown>;

  // Validate colors
  if (cfg.colors && typeof cfg.colors === "object") {
    for (const [key, value] of Object.entries(
      cfg.colors as Record<string, unknown>,
    )) {
      if (typeof value === "string" && !HEX_COLOR_RE.test(value)) {
        errors.push(`colors.${key} 不是合法的 hex 颜色: ${value}`);
      }
    }
  }

  // Validate aspectRatio
  if (cfg.aspectRatio !== undefined) {
    if (cfg.aspectRatio !== "16:9" && cfg.aspectRatio !== "4:3") {
      errors.push(
        `aspectRatio 必须是 "16:9" 或 "4:3"，收到: ${String(cfg.aspectRatio)}`,
      );
    }
  }

  // Validate layouts keys
  if (cfg.layouts && typeof cfg.layouts === "object") {
    for (const key of Object.keys(cfg.layouts as Record<string, unknown>)) {
      if (!VALID_LAYOUT_TYPES.includes(key as LayoutType)) {
        errors.push(
          `layouts.${key} 不是合法的 layout 类型，可选: ${VALID_LAYOUT_TYPES.join(", ")}`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function listTemplates(
  page: number,
  limit: number,
  type?: "code_theme" | "native_pptx",
) {
  const offset = (page - 1) * limit;

  const conditions = [eq(pptTemplates.isActive, true)];
  if (type) conditions.push(eq(pptTemplates.type, type));

  const where = and(...conditions);

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(pptTemplates)
      .where(where)
      .orderBy(desc(pptTemplates.createdAt))
      .offset(offset)
      .limit(limit),
    db
      .select({ count: count() })
      .from(pptTemplates)
      .where(where),
  ]);

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: total[0].count,
      totalPages: Math.ceil(total[0].count / limit),
    },
  };
}

export async function getTemplate(id: string) {
  const rows = await db
    .select()
    .from(pptTemplates)
    .where(eq(pptTemplates.id, id))
    .limit(1);

  if (rows.length === 0) throw new Error("TEMPLATE_NOT_FOUND");
  return rows[0];
}

export async function createTemplate(input: {
  name: string;
  description?: string;
  type: "code_theme" | "native_pptx";
  aspectRatio?: string;
  themeConfig?: unknown;
  templateFilePath?: string;
  availableLayouts?: string[];
  createdBy?: string;
}) {
  const result = await db
    .insert(pptTemplates)
    .values({
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      aspectRatio: input.aspectRatio ?? "16:9",
      themeConfig: input.themeConfig ?? null,
      templateFilePath: input.templateFilePath ?? null,
      availableLayouts: input.availableLayouts ?? null,
      createdBy: input.createdBy ?? null,
    })
    .returning();

  return result[0];
}

export async function updateTemplate(
  id: string,
  input: {
    name?: string;
    description?: string;
    aspectRatio?: string;
    themeConfig?: unknown;
    templateFilePath?: string;
    availableLayouts?: string[];
    isActive?: boolean;
  },
) {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.aspectRatio !== undefined) updateData.aspectRatio = input.aspectRatio;
  if (input.themeConfig !== undefined) updateData.themeConfig = input.themeConfig;
  if (input.templateFilePath !== undefined) updateData.templateFilePath = input.templateFilePath;
  if (input.availableLayouts !== undefined) updateData.availableLayouts = input.availableLayouts;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const result = await db
    .update(pptTemplates)
    .set(updateData)
    .where(eq(pptTemplates.id, id))
    .returning();

  if (result.length === 0) throw new Error("TEMPLATE_NOT_FOUND");
  return result[0];
}

export async function deleteTemplate(id: string) {
  const result = await db
    .delete(pptTemplates)
    .where(eq(pptTemplates.id, id))
    .returning({ id: pptTemplates.id });

  if (result.length === 0) throw new Error("TEMPLATE_NOT_FOUND");
  return { success: true as const };
}

export async function getDefaultTemplate() {
  const rows = await db
    .select()
    .from(pptTemplates)
    .where(and(eq(pptTemplates.isDefault, true), eq(pptTemplates.isActive, true)))
    .limit(1);

  return rows[0] ?? null;
}

export async function setDefault(id: string) {
  return await db.transaction(async (tx) => {
    // Verify target exists
    const target = await tx
      .select({ id: pptTemplates.id })
      .from(pptTemplates)
      .where(eq(pptTemplates.id, id))
      .limit(1);

    if (target.length === 0) throw new Error("TEMPLATE_NOT_FOUND");

    // Clear all existing defaults
    await tx
      .update(pptTemplates)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(pptTemplates.isDefault, true));

    // Set new default
    const result = await tx
      .update(pptTemplates)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(pptTemplates.id, id))
      .returning();

    return result[0];
  });
}
