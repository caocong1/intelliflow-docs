import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import type { DeckPlan, QaReport } from "./types";

type SpawnResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export async function qaPptx(
  buffer: Buffer,
  pptxPath: string,
  deckPlan: DeckPlan,
): Promise<QaReport> {
  const warnings: string[] = [];
  const zip = await JSZip.loadAsync(buffer);

  if (!zip.file("[Content_Types].xml")) {
    throw new Error("PPTX 缺少 [Content_Types].xml");
  }
  if (!zip.file("ppt/presentation.xml")) {
    throw new Error("PPTX 缺少 ppt/presentation.xml");
  }

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort(sortXmlNumber);
  const notesFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name))
    .sort(sortXmlNumber);

  if (slideFiles.length !== deckPlan.slides.length) {
    throw new Error(
      `PPTX slide 数不匹配：期望 ${deckPlan.slides.length}，实际 ${slideFiles.length}`,
    );
  }
  if (notesFiles.length < deckPlan.slides.length) {
    warnings.push(
      `speaker notes 数量少于 slide 数：${notesFiles.length}/${deckPlan.slides.length}`,
    );
  }

  const xmlNames = ["[Content_Types].xml", "ppt/presentation.xml", ...slideFiles, ...notesFiles];
  for (const name of xmlNames) {
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async("string");
    assertXmlLooksParseable(xml, name);
    const placeholder = findPlaceholder(xml);
    if (placeholder) {
      warnings.push(`${name} 中疑似残留 placeholder：${placeholder}`);
    }
  }

  const officeWarnings = await runOfficeCliQualityCheck(pptxPath);
  warnings.push(...officeWarnings);

  return {
    warnings,
    slideCount: slideFiles.length,
    notesCount: notesFiles.length,
  };
}

function sortXmlNumber(a: string, b: string): number {
  return extractXmlNumber(a) - extractXmlNumber(b);
}

function extractXmlNumber(name: string): number {
  return Number.parseInt(name.match(/(\d+)\.xml$/)?.[1] ?? "0", 10);
}

function assertXmlLooksParseable(xml: string, name: string) {
  const trimmed = xml.trim();
  if (!trimmed.startsWith("<") || !trimmed.endsWith(">")) {
    throw new Error(`${name} 不是有效 XML 文本`);
  }
  if (trimmed.includes("<parsererror") || hasIllegalXmlControlChar(trimmed)) {
    throw new Error(`${name} XML 包含非法控制字符`);
  }

  const tagStack: string[] = [];
  const tagPattern = /<\/?([A-Za-z_][\w:.-]*)(?:\s[^<>]*)?>/g;
  let match = tagPattern.exec(trimmed);
  while (match) {
    const raw = match[0];
    const tag = match[1];
    if (!raw.startsWith("<?") && !raw.startsWith("<!") && !raw.endsWith("/>")) {
      if (!raw.startsWith("</")) {
        tagStack.push(tag);
      } else {
        const open = tagStack.pop();
        if (open !== tag) {
          throw new Error(`${name} XML 标签不闭合：${open ?? "(empty)"} / ${tag}`);
        }
      }
    }
    match = tagPattern.exec(trimmed);
  }
  if (tagStack.length > 0) {
    throw new Error(`${name} XML 标签未闭合：${tagStack.at(-1)}`);
  }
}

function hasIllegalXmlControlChar(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f)
    ) {
      return true;
    }
  }
  return false;
}

function findPlaceholder(xml: string): string | null {
  const textNodes = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g))
    .map((match) => decodeXmlText(match[1] ?? ""))
    .join("\n");
  return textNodes.match(/(\{\{[^}]+}}|\$\{[^}]+}|TODO|PLACEHOLDER|Lorem ipsum)/i)?.[1] ?? null;
}

function decodeXmlText(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function isOfficeCliAvailable(): Promise<boolean> {
  if (process.env.OFFICECLI_PATH) {
    try {
      await access(process.env.OFFICECLI_PATH, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

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

async function runOfficeCliQualityCheck(pptxPath: string): Promise<string[]> {
  if (!(await isOfficeCliAvailable())) {
    return ["OfficeCLI 未安装，已跳过 validate/view issues 质检。"];
  }

  const officecli = process.env.OFFICECLI_PATH || "officecli";
  const checks: Array<{ label: string; args: string[] }> = [
    { label: "validate", args: ["validate", pptxPath] },
    { label: "view issues", args: ["view", pptxPath, "issues"] },
  ];
  const warnings: string[] = [];

  for (const check of checks) {
    try {
      const result = await spawnOfficeCli(officecli, check.args);
      const output = summarizeCommandOutput(result.stdout, result.stderr);
      if (result.exitCode !== 0) {
        warnings.push(
          output
            ? `OfficeCLI ${check.label} 返回异常：${output}`
            : `OfficeCLI ${check.label} 返回异常，退出码 ${result.exitCode ?? "unknown"}`,
        );
      } else if (
        output &&
        check.label === "view issues" &&
        !/Found\s+0\s+issue\(s\)|"count"\s*:\s*0/i.test(output)
      ) {
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

async function spawnOfficeCli(command: string, args: string[]): Promise<SpawnResult> {
  const bun = (
    globalThis as unknown as {
      Bun?: {
        spawnSync: (
          cmd: string[],
          opts: Record<string, unknown>,
        ) => {
          exitCode: number | null;
          stdout: Uint8Array;
          stderr: Uint8Array;
        };
      };
    }
  ).Bun;

  if (bun?.spawnSync) {
    const result = bun.spawnSync([command, ...args], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, OFFICECLI_NO_AUTO_RESIDENT: "1" },
    });
    return {
      exitCode: result.exitCode,
      stdout: new TextDecoder().decode(result.stdout),
      stderr: new TextDecoder().decode(result.stderr),
    };
  }

  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(command, args, {
    encoding: "utf-8",
    env: { ...process.env, OFFICECLI_NO_AUTO_RESIDENT: "1" },
  });
  return {
    exitCode: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function summarizeCommandOutput(stdout: string, stderr: string): string {
  const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
  if (!combined) return "";
  return combined.length > 800 ? `${combined.slice(0, 800)}...` : combined;
}
