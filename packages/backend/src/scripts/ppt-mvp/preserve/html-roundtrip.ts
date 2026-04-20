/**
 * HTML fidelity line — LLM roundtrip.
 *
 * Pipeline:
 *   1. Read a template-style HTML (hand-authored per template section)
 *   2. Extract regions (data-region + data-max-width-units + data-max-lines)
 *   3. Read a page content JSON (e.g. wireless-page-plan)
 *   4. Ask the LLM to produce an `html_to_ppt_fill_plan/v1` mapping
 *      content → region budgets
 *   5. Apply the fill plan to the HTML (string substitution by regionId)
 *   6. Render via Chrome headless to PNG
 *
 * The LLM is the compressor/creative — it sees each region's budget
 * and is instructed to fit content accordingly (respecting CJK=2 /
 * ASCII=1 width rules).
 *
 * CLI:
 *   bun html-roundtrip.ts --html <path> --content <json> --page <id> \
 *     --out <png> [--fill-plan <out-json>] [--mock <json>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { callClaude, extractJson } from "../ai-pipeline/claude-client";
import { ensureLiveClaudeEnvFromDb } from "../ai-pipeline/live-config";
import { callOpenAICompat } from "../ai-pipeline/openai-compat-client";
import { callQwenCli } from "../ai-pipeline/qwen-cli-client";
import {
  extractRegionsFromHtml,
  validateHtmlFillPlan,
  type HtmlFillPlan,
  type RegionDescriptor,
} from "./html-fill-plan-schema";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(MODULE_DIR, "../../../../../..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIEWPORT_W = 1280;
const VIEWPORT_H = 720;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function buildPrompt(args: {
  templateId: string;
  pageId: string;
  regions: RegionDescriptor[];
  pageContent: unknown;
}): string {
  return [
    "你在帮一个 PPT 幻灯片把内容填进预定义的 HTML 页面结构。",
    `模板 ID: ${args.templateId}`,
    `页面 ID: ${args.pageId}`,
    "",
    "HTML 提供了若干 data-region 区域，每个区域有可选的宽度/行数预算：",
    ...args.regions.map((r) => {
      const width = r.maxWidthUnits !== undefined ? ` maxWidthUnits=${r.maxWidthUnits}` : "";
      const lines = r.maxLines !== undefined ? ` maxLines=${r.maxLines}` : "";
      const sample = r.originalText ? ` 原文示例: "${r.originalText.slice(0, 60)}"` : "";
      return `  - regionId="${r.regionId}"${width}${lines}${sample}`;
    }),
    "",
    "宽度单位规则: CJK 字符算 2 单位, ASCII 字符算 1 单位。",
    "",
    "以下是要填入的页面内容 JSON:",
    JSON.stringify(args.pageContent, null, 2),
    "",
    "请输出 html_to_ppt_fill_plan/v1 格式的 JSON，只输出 JSON，不要多余文字。",
    "要求：",
    "1. pages[0].pageId 等于页面 ID",
    "2. regionAssignments 覆盖所有有内容可填的 regionId",
    "3. 文本长度必须满足每个区域的 maxWidthUnits × maxLines 预算",
    "4. 多段内容用 paragraphs 数组；单行用 text 字符串",
    "5. 保留原内容语言（中文→中文, 英文→英文）",
    "",
    "输出示例格式:",
    '```json',
    JSON.stringify(
      {
        version: "html_to_ppt_fill_plan/v1",
        templateId: args.templateId,
        htmlPath: "...",
        pages: [
          {
            pageId: args.pageId,
            regionAssignments: [
              { regionId: "title", text: "..." },
              { regionId: "body", paragraphs: [{ text: "..." }, { text: "..." }] },
            ],
          },
        ],
      },
      null,
      2,
    ),
    '```',
  ].join("\n");
}

export async function generateHtmlFillPlan(args: {
  templateId: string;
  htmlPath: string;
  pageId: string;
  pageContent: unknown;
  mockResponse?: string;
}): Promise<HtmlFillPlan> {
  const html = readFileSync(args.htmlPath, "utf8");
  const regions = extractRegionsFromHtml(html);
  const prompt = buildPrompt({
    templateId: args.templateId,
    pageId: args.pageId,
    regions,
    pageContent: args.pageContent,
  });
  // Provider dispatch (live mode):
  //   1. USE_QWEN_CLI=1       → shell out to standalone `qwen` CLI (for
  //                             Bailian Coding-Plan keys that can't be
  //                             called directly via HTTPS)
  //   2. OPENAI_COMPAT_*       → raw /v1/chat/completions fetch
  //   3. default              → Anthropic /v1/messages (existing Claude path)
  // Mock mode always uses the claude-client's canned-response path.
  const isLive = args.mockResponse === undefined;
  let content: string;
  if (isLive && process.env.USE_QWEN_CLI === "1") {
    ({ content } = await callQwenCli({ prompt }));
  } else if (
    isLive &&
    process.env.OPENAI_COMPAT_API_KEY &&
    process.env.OPENAI_COMPAT_BASE_URL &&
    process.env.OPENAI_COMPAT_MODEL
  ) {
    ({ content } = await callOpenAICompat({
      prompt,
      maxTokens: 1500,
      temperature: 0.2,
    }));
  } else {
    ({ content } = await callClaude({
      prompt,
      maxTokens: 1500,
      temperature: 0.2,
      mockResponse: args.mockResponse,
      mock: args.mockResponse !== undefined,
    }));
  }
  const parsed = extractJson<HtmlFillPlan>(content);
  const result = validateHtmlFillPlan(parsed);
  if (!result.valid || !result.data) {
    throw new Error(
      `LLM output failed schema validation: ${JSON.stringify(result.errors)}\nRaw:\n${content.slice(0, 500)}`,
    );
  }
  return result.data;
}

/** Apply a fill plan to HTML by substituting each region's inner text. */
export function applyFillPlanToHtml(html: string, plan: HtmlFillPlan, pageId: string): string {
  const page = plan.pages.find((p) => p.pageId === pageId);
  if (!page) throw new Error(`page "${pageId}" not in fill plan`);
  let out = html;
  for (const a of page.regionAssignments) {
    const replacement = a.paragraphs
      ? a.paragraphs.map((p) => `<p>${escapeHtml(p.text)}</p>`).join("")
      : escapeHtml(a.text ?? "");
    // Replace the inner text of the first element with data-region=<id>.
    const re = new RegExp(
      `(<(\\w+)\\b[^>]*\\bdata-region="${escapeRegex(a.regionId)}"[^>]*>)([\\s\\S]*?)(</\\2>)`,
    );
    out = out.replace(re, `$1${replacement}$4`);
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function renderHtmlStringToPng(
  html: string,
  outPath: string,
  baseUrl?: string,
): Promise<void> {
  const tmpHtml = `${outPath}.tmp.html`;
  // Inject <base href="…"> so relative URLs (hero images, etc.) in the
  // original template-style HTML still resolve when the filled copy is
  // written to a different directory.
  let patched = html;
  if (baseUrl) {
    const baseTag = `<base href="${baseUrl}">`;
    if (patched.includes("<head>")) {
      patched = patched.replace("<head>", `<head>${baseTag}`);
    } else {
      patched = `${baseTag}${patched}`;
    }
  }
  writeFileSync(tmpHtml, patched);
  const proc = Bun.spawn(
    [
      CHROME,
      "--headless=new",
      "--disable-gpu",
      `--screenshot=${outPath}`,
      `--window-size=${VIEWPORT_W},${VIEWPORT_H}`,
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `file://${tmpHtml}`,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0) throw new Error(`chrome exited ${exitCode}`);
}

function parseCli(argv: string[]): {
  htmlPath: string;
  contentPath: string;
  pageId: string;
  outPath: string;
  fillPlanOut?: string;
  templateId: string;
  mockPath?: string;
} {
  const out: Partial<{
    htmlPath: string;
    contentPath: string;
    pageId: string;
    outPath: string;
    fillPlanOut?: string;
    templateId: string;
    mockPath?: string;
  }> = { templateId: "622eee2ab7e6e" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--html") out.htmlPath = argv[++i];
    else if (a === "--content") out.contentPath = argv[++i];
    else if (a === "--page") out.pageId = argv[++i];
    else if (a === "--out") out.outPath = argv[++i];
    else if (a === "--fill-plan") out.fillPlanOut = argv[++i];
    else if (a === "--template-id") out.templateId = argv[++i];
    else if (a === "--mock") out.mockPath = argv[++i];
  }
  if (!out.htmlPath || !out.contentPath || !out.pageId || !out.outPath) {
    throw new Error(
      "usage: html-roundtrip --html <path> --content <json> --page <id> --out <png> [--fill-plan <out-json>] [--template-id <id>] [--mock <json-file>]",
    );
  }
  return out as {
    htmlPath: string;
    contentPath: string;
    pageId: string;
    outPath: string;
    templateId: string;
    fillPlanOut?: string;
    mockPath?: string;
  };
}

if (import.meta.main) {
  const cli = parseCli(process.argv.slice(2));
  const htmlPath = resolve(cli.htmlPath);
  const contentPath = resolve(cli.contentPath);
  const content = readJson(contentPath) as { pages?: Array<{ pageId: string }> };
  const pageContent = (content.pages ?? []).find((p) => p.pageId === cli.pageId) ?? content;

  (async () => {
    const mockResponse = cli.mockPath ? readFileSync(resolve(cli.mockPath), "utf8") : undefined;
    console.error(
      `[html-roundtrip] template=${cli.templateId} page=${cli.pageId} html=${htmlPath} mode=${mockResponse ? "mock" : "live"}`,
    );
    if (!mockResponse && process.env.CLAUDE_MOCK !== "1") {
      if (process.env.USE_QWEN_CLI === "1") {
        console.error(
          `[html-roundtrip] LLM live (qwen cli) model=${process.env.QWEN_MODEL ?? "(default)"}`,
        );
      } else if (process.env.OPENAI_COMPAT_API_KEY && process.env.OPENAI_COMPAT_BASE_URL) {
        console.error(
          `[html-roundtrip] LLM live (openai-compat) model=${process.env.OPENAI_COMPAT_MODEL ?? "?"}`,
        );
      } else {
        try {
          const live = await ensureLiveClaudeEnvFromDb();
          console.error(
            `[html-roundtrip] LLM live (anthropic) source=${live.source} model=${live.modelId ?? "?"}`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[html-roundtrip] could not auto-load LLM config (${msg}); LLM call will fail.`);
        }
      }
    }
    const plan = await generateHtmlFillPlan({
      templateId: cli.templateId,
      htmlPath,
      pageId: cli.pageId,
      pageContent,
      mockResponse,
    });
    if (cli.fillPlanOut) {
      writeFileSync(resolve(cli.fillPlanOut), JSON.stringify(plan, null, 2));
      console.error(`[html-roundtrip] wrote fill plan → ${cli.fillPlanOut}`);
    }
    const originalHtml = readFileSync(htmlPath, "utf8");
    const filled = applyFillPlanToHtml(originalHtml, plan, cli.pageId);
    const baseUrl = `file://${dirname(htmlPath)}/`;
    await renderHtmlStringToPng(filled, resolve(cli.outPath), baseUrl);
    console.log(`wrote ${cli.outPath}`);
  })().catch((err) => {
    console.error("[html-roundtrip] FAILED:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

// Replace the minimal REPO_ROOT reference check lint wants.
void REPO_ROOT;
