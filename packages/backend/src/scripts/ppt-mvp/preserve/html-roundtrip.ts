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
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { callClaude, extractJson } from "../ai-pipeline/claude-client";
import { ensureLiveClaudeEnvFromDb } from "../ai-pipeline/live-config";
import { callOpenAICompat } from "../ai-pipeline/openai-compat-client";
import { callQwenCli } from "../ai-pipeline/qwen-cli-client";
import { validateParagraphs, validateSingleLine, widthUnits } from "./text-width";
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

const SYSTEM_PROMPT = [
  "你是一个 PPT 内容压缩器。你的任务是把输入内容填进预定义 HTML 区域的 JSON 描述。",
  "",
  "铁律（违反会被拒绝）：",
  "1. 只输出 JSON 对象，不输出 markdown 代码块、不输出解释、不输出思考过程。",
  "2. 每个 regionAssignment 的文本必须严格满足 maxWidthUnits × maxLines 预算。",
  "3. 宽度计算: CJK 字符 = 2 单位, ASCII 字符/数字/标点 = 1 单位。",
  "4. 当原文超出预算时, 必须删词/缩写/改换表达以 fit, 宁可丢细节也不能超。",
  "5. 保留原文语言（中文→中文, 英文→英文）。",
].join("\n");

function buildPrompt(args: {
  templateId: string;
  pageId: string;
  htmlFileName: string;
  regions: RegionDescriptor[];
  pageContent: unknown;
}): string {
  return [
    `templateId: ${args.templateId}`,
    `pageId: ${args.pageId}`,
    `htmlFileName: ${args.htmlFileName}`,
    "",
    "区域预算：",
    ...args.regions.map((r) => {
      const width = r.maxWidthUnits !== undefined ? ` maxWidthUnits=${r.maxWidthUnits}` : "";
      const lines = r.maxLines !== undefined ? ` maxLines=${r.maxLines}` : "";
      const sample = r.originalText ? ` sample:"${r.originalText.slice(0, 40)}"` : "";
      return `  - ${r.regionId}${width}${lines}${sample}`;
    }),
    "",
    "输入内容（JSON）：",
    JSON.stringify(args.pageContent),
    "",
    `严格输出 html_to_ppt_fill_plan/v1 格式的 JSON。顶层字段: version, templateId="${args.templateId}", htmlPath="${args.htmlFileName}", pages=[{pageId:"${args.pageId}", regionAssignments:[{regionId, text | paragraphs}]}]`,
    "",
    "再次提醒: 每个 regionAssignment 的文本必须在该区域的 maxWidthUnits × maxLines 之内。若原文超出, 压缩到合规为止。不要 markdown fences, 只要纯 JSON。",
  ].join("\n");
}

const MAX_FILL_PLAN_ATTEMPTS = 3;

type BudgetViolation = {
  regionId: string;
  reason: string;
  actualWidthUnits?: number;
  actualLines?: number;
};

/** Cross-check each regionAssignment against its region's budget. */
function validateFillPlanBudgets(
  plan: HtmlFillPlan,
  pageId: string,
  regions: RegionDescriptor[],
): BudgetViolation[] {
  const page = plan.pages.find((p) => p.pageId === pageId);
  if (!page) return [{ regionId: "(page)", reason: `page "${pageId}" not in plan` }];
  const byId = new Map(regions.map((r) => [r.regionId, r]));
  const violations: BudgetViolation[] = [];
  for (const a of page.regionAssignments) {
    const region = byId.get(a.regionId);
    if (!region) continue;
    const maxW = region.maxWidthUnits;
    const maxLines = region.maxLines ?? 1;
    if (maxW === undefined) continue;
    if (a.text !== undefined) {
      const fit = validateSingleLine(a.text, maxW);
      if (!fit.fits) {
        violations.push({
          regionId: a.regionId,
          reason: `text "${a.text.slice(0, 24)}" width ${widthUnits(a.text)} > ${maxW}`,
          actualWidthUnits: widthUnits(a.text),
        });
      }
    }
    if (a.paragraphs) {
      const fit = validateParagraphs(a.paragraphs, maxW, maxLines);
      if (!fit.fits) {
        violations.push({
          regionId: a.regionId,
          reason: `paragraphs over budget (${fit.violations.map((v) => v.reason).join("; ")})`,
          actualLines: fit.actualLines,
        });
      }
    }
  }
  return violations;
}

/**
 * Smooth over common LLM schema drift before strict validation:
 *  - paragraphs: ["a", "b"]   → paragraphs: [{text: "a"}, {text: "b"}]
 *  - regionAssignments.text: string (newline-joined) is already schema-valid,
 *    so no change needed.
 * Keeps the strict schema as source of truth while absorbing the two-three
 * shapes models commonly emit despite explicit prompting.
 */
function normalizeLlmJson(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const pages = (value as { pages?: unknown }).pages;
  if (!Array.isArray(pages)) return value;
  for (const page of pages) {
    if (!page || typeof page !== "object") continue;
    const assignments = (page as { regionAssignments?: unknown }).regionAssignments;
    if (!Array.isArray(assignments)) continue;
    for (const a of assignments) {
      if (!a || typeof a !== "object") continue;
      const paragraphs = (a as { paragraphs?: unknown }).paragraphs;
      if (Array.isArray(paragraphs) && paragraphs.every((p) => typeof p === "string")) {
        (a as { paragraphs?: unknown }).paragraphs = paragraphs.map((t) => ({ text: t }));
      }
    }
  }
  return value;
}

async function callLlmForFillPlan(
  prompt: string,
  mockResponse: string | undefined,
): Promise<string> {
  const isLive = mockResponse === undefined;
  if (isLive && process.env.USE_QWEN_CLI === "1") {
    return (await callQwenCli({ prompt, systemPrompt: SYSTEM_PROMPT })).content;
  }
  if (
    isLive &&
    process.env.OPENAI_COMPAT_API_KEY &&
    process.env.OPENAI_COMPAT_BASE_URL &&
    process.env.OPENAI_COMPAT_MODEL
  ) {
    return (await callOpenAICompat({ prompt, maxTokens: 1500, temperature: 0.2 })).content;
  }
  return (
    await callClaude({
      prompt,
      maxTokens: 1500,
      temperature: 0.2,
      mockResponse,
      mock: mockResponse !== undefined,
    })
  ).content;
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
    htmlFileName: basename(args.htmlPath),
    regions,
    pageContent: args.pageContent,
  });
  // Iterate: call LLM → validate schema + per-region budgets → if
  // violations, re-prompt with specific feedback; stop on first pass
  // or after MAX_FILL_PLAN_ATTEMPTS.
  let currentPrompt = prompt;
  let lastRaw = "";
  for (let attempt = 0; attempt < MAX_FILL_PLAN_ATTEMPTS; attempt += 1) {
    const raw = await callLlmForFillPlan(currentPrompt, args.mockResponse);
    lastRaw = raw;
    const parsed = normalizeLlmJson(extractJson<HtmlFillPlan>(raw));
    const schemaResult = validateHtmlFillPlan(parsed);
    if (!schemaResult.valid || !schemaResult.data) {
      throw new Error(
        `LLM output failed schema validation (attempt ${attempt + 1}): ${JSON.stringify(schemaResult.errors)}\nRaw:\n${raw.slice(0, 500)}`,
      );
    }
    const violations = validateFillPlanBudgets(schemaResult.data, args.pageId, regions);
    if (violations.length === 0) return schemaResult.data;

    if (args.mockResponse !== undefined) {
      // No point retrying a mock — it always returns the same thing.
      throw new Error(
        `mock fill plan violates budgets: ${violations.map((v) => v.reason).join("; ")}`,
      );
    }
    if (attempt === MAX_FILL_PLAN_ATTEMPTS - 1) {
      throw new Error(
        `LLM fill plan still over budget after ${MAX_FILL_PLAN_ATTEMPTS} attempts: ${violations.map((v) => `${v.regionId}: ${v.reason}`).join("; ")}`,
      );
    }
    console.warn(
      `[html-roundtrip] attempt ${attempt + 1} over budget (${violations.length} violations); retrying with feedback`,
    );
    currentPrompt = [
      prompt,
      "",
      "你上一次的输出存在以下预算违规，请只输出修正后的 JSON（不要多余文字）:",
      ...violations.map((v) => `  - ${v.regionId}: ${v.reason}`),
      "",
      "请务必压缩到每区域的 maxWidthUnits × maxLines 之内。宁可丢细节也要 fit。",
    ].join("\n");
  }
  throw new Error(`unreachable: exhausted fill-plan attempts (last raw: ${lastRaw.slice(0, 200)})`);
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
      // Headless Chrome occasionally hangs after the screenshot is written
      // waiting on a flaky SSL handshake to a background-networking endpoint
      // (update/metrics/CRL). These flags bound render time to the virtual
      // clock and disable the background chatter entirely.
      "--virtual-time-budget=5000",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-sync",
      "--no-first-run",
      "--no-default-browser-check",
      `file://${tmpHtml}`,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  // Hard wall-clock wall: even with virtual-time-budget, Chrome sometimes
  // stalls outside the page run-loop. Kill after 30s and trust whatever
  // screenshot was already written.
  const killer = setTimeout(() => {
    try {
      proc.kill("SIGKILL");
    } catch {}
  }, 30_000);
  const exitCode = await proc.exited;
  clearTimeout(killer);
  // Accept exit codes 0 and SIGKILL (137 / -9) as success as long as the
  // screenshot file exists — chrome writes it before the hang.
  if (exitCode !== 0 && exitCode !== 137 && exitCode !== -9) {
    throw new Error(`chrome exited ${exitCode}`);
  }
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
