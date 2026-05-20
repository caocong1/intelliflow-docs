import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  PptConfig,
  PptStyleSelectionMode,
  VariableRef,
  WorkflowNodeDef,
} from "@intelliflow/shared";
import { eq } from "drizzle-orm";
import { assertWithinRoot, sanitizeFilename } from "../../common/sanitize";
import { db } from "../../db";
import { documents, nodeExecutions, workflows } from "../../db/schema";
import { getExportPath, insertDocumentFile } from "../files/files.service";
import { type PptBufferResult, generatePptBuffer, resolvePptStylePackId } from "./export.service";
import type { DeckCompositionSummary } from "./ppt-deck-composition";
import {
  parseSlidePresentationContent,
  renderVisualPremiumPresentation,
} from "./ppt-visual-premium";
import { resolveRef } from "./variable-resolution";

type PptPreviewResult = {
  content: string;
  defaultFilename: string;
  styleSelectionMode: PptStyleSelectionMode;
  recommendedStyleId: string;
  defaultStyleId?: string;
};

type PptGenerateResult = {
  filename: string;
  storagePath: string;
  fileSize: number;
  format: "pptx";
  renderMode: "visual_premium_v1";
  styleId: string;
  warnings: string[];
  compositionSummary: DeckCompositionSummary;
};

const PPTX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

async function loadPptNodeConfig(
  documentId: string,
  nodeExecutionId: string,
): Promise<PptConfig | null> {
  const [exec] = await db
    .select({ nodeId: nodeExecutions.nodeId })
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  if (!exec) return null;

  const [doc] = await db
    .select({ nodes: workflows.nodes })
    .from(documents)
    .innerJoin(workflows, eq(documents.workflowId, workflows.id))
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) return null;

  const nodes = doc.nodes as WorkflowNodeDef[];
  const nodeDef = nodes.find((node) => node.id === exec.nodeId);
  if (!nodeDef || nodeDef.config.type !== "ppt") return null;
  return nodeDef.config;
}

async function resolvePptContent(
  documentId: string,
  nodeExecutionId: string,
  contentMapping?: VariableRef[],
): Promise<string> {
  const executions = await db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.documentId, documentId));

  const currentExec = executions.find((exec) => exec.id === nodeExecutionId);
  if (!currentExec) throw new Error("Node execution not found");

  if (contentMapping && contentMapping.length > 0) {
    const nodeExecMap = executions.map((exec) => ({
      nodeId: exec.nodeId,
      outputData: exec.outputData as Record<string, unknown> | null,
    }));

    const parts: string[] = [];
    for (const ref of contentMapping) {
      const value = resolveRef(ref, nodeExecMap);
      if (value !== undefined) {
        parts.push(value);
      } else {
        console.warn(
          `[ppt] contentMapping: failed to resolve ref ${ref.nodeId}.${ref.outputId}, skipping`,
        );
      }
    }

    if (parts.length > 0) {
      return parts.join("\n\n");
    }
  }

  const inputData = currentExec.inputData as Record<string, unknown> | null;
  if (inputData?.content && typeof inputData.content === "string") {
    return inputData.content;
  }

  const completed = executions
    .filter((exec) => exec.status === "completed" && exec.stepOrder < currentExec.stepOrder)
    .sort((a, b) => b.stepOrder - a.stepOrder);

  for (const exec of completed) {
    const output = exec.outputData as Record<string, unknown> | null;
    if (!output) continue;

    if (output.selectedContent && typeof output.selectedContent === "string") {
      return output.selectedContent;
    }
    if (output.restoredContent && typeof output.restoredContent === "string") {
      return output.restoredContent;
    }
    if (output.restoredText && typeof output.restoredText === "string") {
      return output.restoredText;
    }
    if (output.content && typeof output.content === "string") {
      return output.content;
    }

    const namedOutputs = output.namedOutputs as Record<string, { content?: string }> | undefined;
    if (namedOutputs) {
      const first = Object.values(namedOutputs).find((item) => item.content);
      if (first?.content) return first.content;
    }

    const outputItems = output.outputItems as Record<string, { content?: string }> | undefined;
    if (outputItems) {
      const first = Object.values(outputItems).find((item) => item.content);
      if (first?.content) return first.content;
    }

    const models = output.models as Record<string, { content?: string }> | undefined;
    const selectedKey = exec.selectedOutputKey;
    const selectedContent = selectedKey ? models?.[selectedKey]?.content : undefined;
    if (selectedContent) {
      return selectedContent;
    }
    if (models) {
      const first = Object.values(models).find((model) => model.content);
      if (first?.content) return first.content;
    }
  }

  return "";
}

function recommendStyleId(content: string, configuredStyleId?: string): string {
  if (configuredStyleId) return resolvePptStylePackId(configuredStyleId);

  const text = content.toLowerCase();
  if (/科技|系统|平台|ai|api|数据|算法|智能/.test(text)) return "tech_dark";
  if (/复盘|总结|经验|问题|改进|回顾/.test(text)) return "warm_review";
  if (/风险|合规|审计|治理|控制|安全/.test(text)) return "high_contrast";
  if (/咨询|方案|战略|规划|路线图|roadmap/.test(text)) return "consulting_gray";
  return resolvePptStylePackId(configuredStyleId);
}

async function isOfficeCliAvailable(): Promise<boolean> {
  const pathValue = process.env.PATH ?? "";
  for (const dir of pathValue.split(":")) {
    if (!dir) continue;
    try {
      await access(join(dir, "officecli"), constants.X_OK);
      return true;
    } catch {
      // keep scanning PATH
    }
  }
  return false;
}

function summarizeCommandOutput(stdout: string, stderr: string): string {
  const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
  if (!combined) return "";
  return combined.length > 800 ? `${combined.slice(0, 800)}...` : combined;
}

async function runOfficeCliQualityCheck(pptxPath: string): Promise<string[]> {
  if (!(await isOfficeCliAvailable())) {
    return ["OfficeCLI 未安装，已跳过 PPT 结构质检。"];
  }

  const warnings: string[] = [];
  const checks: Array<{ label: string; args: string[] }> = [
    { label: "validate", args: ["validate", pptxPath] },
    { label: "view issues", args: ["view", "issues", pptxPath] },
  ];

  for (const check of checks) {
    try {
      const result = Bun.spawnSync(["officecli", ...check.args], {
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, OFFICECLI_NO_AUTO_RESIDENT: "1" },
      });
      const output = summarizeCommandOutput(result.stdout.toString(), result.stderr.toString());
      if (result.exitCode !== 0) {
        warnings.push(
          output
            ? `OfficeCLI ${check.label} 返回异常：${output}`
            : `OfficeCLI ${check.label} 返回异常，退出码 ${result.exitCode}`,
        );
      } else if (output && check.label === "view issues") {
        warnings.push(`OfficeCLI 质检信息：${output}`);
      }
    } catch (err) {
      warnings.push(
        `OfficeCLI ${check.label} 执行失败：${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return warnings;
}

async function generateVisualPremiumBuffer(params: {
  content: string;
  styleId: string;
  documentId: string;
  nodeExecutionId: string;
  userId: string;
}): Promise<PptBufferResult> {
  const structuredPresentation = parseSlidePresentationContent(params.content);
  if (structuredPresentation) {
    const result = await renderVisualPremiumPresentation(structuredPresentation, params.styleId);
    return {
      buffer: result.buffer,
      renderMode: `visual_premium_${result.renderMode}`,
      warnings: [
        ...result.warnings,
        "visual_premium_v1 使用本地 scene_canvas 渲染器完成编排，未降级到旧导出样式。",
      ],
      compositionSummary: result.compositionSummary,
      templateId: null,
      stylePackId: params.styleId,
    };
  }

  try {
    const result = await generatePptBuffer({
      content: params.content,
      stylePackId: params.styleId,
      documentId: params.documentId,
      nodeExecutionId: params.nodeExecutionId,
      userId: params.userId,
      pptRenderEngine: "html_fidelity",
    });
    return {
      ...result,
      warnings: [...result.warnings, `visual_premium_v1 使用 ${result.renderMode} 完成编排。`],
    };
  } catch (err) {
    const fallback = await generatePptBuffer({
      content: params.content,
      stylePackId: params.styleId,
      documentId: params.documentId,
      nodeExecutionId: params.nodeExecutionId,
      userId: params.userId,
      pptRenderEngine: "archetype",
    });
    return {
      ...fallback,
      warnings: [
        `高质量视觉引擎不可用，已降级为 archetype/style-pack：${
          err instanceof Error ? err.message : String(err)
        }`,
        ...fallback.warnings,
      ],
    };
  }
}

export async function getPptPreview(
  documentId: string,
  nodeExecutionId: string,
): Promise<PptPreviewResult> {
  const config = await loadPptNodeConfig(documentId, nodeExecutionId);
  const content = await resolvePptContent(documentId, nodeExecutionId, config?.contentMapping);
  const dateStr = new Date().toISOString().slice(0, 10);
  const defaultFilename = `presentation_${dateStr}.pptx`;
  const styleSelectionMode = config?.styleSelectionMode ?? "runtime_select";
  const recommendedStyleId =
    styleSelectionMode === "fixed"
      ? resolvePptStylePackId(config?.defaultStyleId)
      : recommendStyleId(content, config?.defaultStyleId);

  return {
    content,
    defaultFilename,
    styleSelectionMode,
    recommendedStyleId,
    defaultStyleId: config?.defaultStyleId,
  };
}

export async function generatePpt(
  documentId: string,
  nodeExecutionId: string,
  filename: string,
  userId: string,
  styleId?: string | null,
): Promise<PptGenerateResult> {
  const config = await loadPptNodeConfig(documentId, nodeExecutionId);
  if (!config) throw new Error("PPT 节点配置不存在");

  const content = await resolvePptContent(documentId, nodeExecutionId, config.contentMapping);
  const effectiveStyleId =
    config.styleSelectionMode === "fixed"
      ? resolvePptStylePackId(config.defaultStyleId)
      : resolvePptStylePackId(styleId ?? recommendStyleId(content, config.defaultStyleId));

  const pptResult = await generateVisualPremiumBuffer({
    content,
    styleId: effectiveStyleId,
    documentId,
    nodeExecutionId,
    userId,
  });

  const exportDir = getExportPath(documentId);
  await mkdir(exportDir, { recursive: true });
  const safeFilename = sanitizeFilename(filename.endsWith(".pptx") ? filename : `${filename}.pptx`);
  const storagePath = join(exportDir, safeFilename);
  await writeFile(storagePath, pptResult.buffer);

  const qaWarnings = await runOfficeCliQualityCheck(storagePath);
  const warnings = [...new Set([...pptResult.warnings, ...qaWarnings])];
  const fileSize = pptResult.buffer.length;

  await insertDocumentFile({
    documentId,
    category: "export",
    originalName: safeFilename,
    storagePath,
    mimeType: PPTX_MIME_TYPE,
    fileSize,
    createdBy: userId,
  });

  const outputData: PptGenerateResult = {
    format: "pptx",
    filename: safeFilename,
    storagePath,
    fileSize,
    renderMode: "visual_premium_v1",
    styleId: effectiveStyleId,
    warnings,
    compositionSummary: pptResult.compositionSummary,
  };

  await db
    .update(nodeExecutions)
    .set({ outputData, updatedAt: new Date() })
    .where(eq(nodeExecutions.id, nodeExecutionId));

  return outputData;
}

export async function downloadPpt(
  documentId: string,
  nodeExecutionId: string,
): Promise<{ buffer: Buffer; filename: string; mimeType: string } | null> {
  const [exec] = await db
    .select()
    .from(nodeExecutions)
    .where(eq(nodeExecutions.id, nodeExecutionId))
    .limit(1);

  if (!exec || exec.documentId !== documentId || exec.nodeType !== "ppt") return null;

  const output = exec.outputData as Record<string, unknown> | null;
  if (
    output?.format !== "pptx" ||
    typeof output.filename !== "string" ||
    typeof output.storagePath !== "string"
  ) {
    return null;
  }

  const validatedPath = assertWithinRoot(getExportPath(documentId), output.storagePath);

  try {
    return {
      buffer: await readFile(validatedPath),
      filename: output.filename,
      mimeType: PPTX_MIME_TYPE,
    };
  } catch {
    return null;
  }
}
