/**
 * HTML fidelity line — editable .pptx output.
 *
 * Pipeline (extends html-roundtrip.ts):
 *   1. Generate fill plan (LLM roundtrip)
 *   2. Apply plan to template HTML
 *   3. Background pass: render HTML with data-region text hidden → PNG.
 *      This PNG bakes the decorative geometry (background gradients,
 *      clip-path polygons, hero image) that pptxgenjs can't reproduce
 *      from DOM alone.
 *   4. Geometry pass: render HTML with an injected probe script that
 *      collects each data-region's bounding box + computed text style
 *      into <pre id="__geom__"> as JSON, then chrome --dump-dom to
 *      extract that JSON.
 *   5. Compile pptx: addImage(bgPng) + addText(region) for each region.
 *      Result: .pptx where decorative visuals are a pinned image but
 *      all text is editable like any other PowerPoint text box.
 *
 * Trade-off: the user can't move/resize the text boxes in a way that
 * reflows the HTML grid. That's acceptable for MVP — editing text is
 * the 95% use case.
 *
 * CLI:
 *   bun html-to-editable-pptx.ts --html <path> --content <json>
 *     --page <id> --out <pptx> [--template-id <id>] [--mock <json>]
 *     [--keep-intermediates]
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import PptxGenJS from "pptxgenjs";
import { ensureLiveClaudeEnvFromDb } from "../ai-pipeline/live-config";
import {
  applyFillPlanToHtml,
  generateHtmlFillPlan,
} from "./html-roundtrip";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(MODULE_DIR, "../../../../../..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIEWPORT_W = 1280;
const VIEWPORT_H = 720;
// pptxgenjs LAYOUT_WIDE: 13.33 × 7.5 inches (1280×720 @ 96 DPI)
const SLIDE_W_IN = 13.33;
const SLIDE_H_IN = 7.5;
const PX_PER_INCH = 96;

export type RegionGeometry = {
  regionId: string;
  x: number; // css px
  y: number;
  w: number;
  h: number;
  text: string;
  fontSizePt: number;
  color: string; // 6-char hex w/o #
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  lineHeightPt: number;
  // If the region is decorative (hero_bg style, no text), skip rendering.
  isEmpty: boolean;
};

/** Shared chrome flags used by both geometry + screenshot passes. */
const CHROME_COMMON = [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--virtual-time-budget=5000",
  "--disable-background-networking",
  "--disable-default-apps",
  "--disable-sync",
  "--no-first-run",
  "--no-default-browser-check",
];

function writeTmp(name: string, body: string, dir: string): string {
  const p = resolve(dir, name);
  writeFileSync(p, body);
  return p;
}

async function runChrome(args: string[]): Promise<number> {
  const proc = Bun.spawn([CHROME, ...args], { stdout: "inherit", stderr: "inherit" });
  const killer = setTimeout(() => {
    try {
      proc.kill("SIGKILL");
    } catch {}
  }, 30_000);
  const exitCode = await proc.exited;
  clearTimeout(killer);
  return exitCode ?? 0;
}

async function runChromeCapture(args: string[]): Promise<string> {
  const proc = Bun.spawn([CHROME, ...args], {
    stdout: "pipe",
    stderr: "inherit",
  });
  const killer = setTimeout(() => {
    try {
      proc.kill("SIGKILL");
    } catch {}
  }, 30_000);
  const stdout = await new Response(proc.stdout).text();
  await proc.exited;
  clearTimeout(killer);
  return stdout;
}

/** Render filled HTML with data-region text hidden → baked decorative PNG. */
async function renderBackgroundPng(
  html: string,
  baseUrl: string,
  outPath: string,
  scratchDir: string,
): Promise<void> {
  // CSS injection to hide just the text inside data-region elements while
  // keeping the surrounding decorative layout (backgrounds, geometry,
  // hero image) intact.
  const hideCss = `
    [data-region] {
      color: transparent !important;
      -webkit-text-fill-color: transparent !important;
    }
    /* If a region carries only a background image (e.g. hero_bg) keep it. */
  `;
  const baseTag = `<base href="${baseUrl}">`;
  const injected = `<head>${baseTag}<style>${hideCss}</style>`;
  const patched = html.includes("<head>")
    ? html.replace("<head>", injected)
    : `${baseTag}<style>${hideCss}</style>${html}`;
  const tmpHtml = writeTmp("bg.tmp.html", patched, scratchDir);
  const exit = await runChrome([
    ...CHROME_COMMON,
    `--screenshot=${outPath}`,
    `--window-size=${VIEWPORT_W},${VIEWPORT_H}`,
    `file://${tmpHtml}`,
  ]);
  if (exit !== 0 && exit !== 137 && exit !== -9) {
    throw new Error(`chrome bg render exited ${exit}`);
  }
}

/**
 * Inject a probe script into the HTML. When loaded, it measures every
 * `data-region` element and serializes geometry + computed text style
 * into <pre id="__geom__">{...JSON...}</pre>. We then read that back
 * via chrome --dump-dom.
 */
function injectGeometryProbe(html: string, baseUrl: string): string {
  const probe = `
    <script>
      (function() {
        function toHex(rgb) {
          var m = rgb.match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/);
          if (!m) return "000000";
          var r = parseInt(m[1], 10), g = parseInt(m[2], 10), b = parseInt(m[3], 10);
          return ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase();
        }
        function pxToPt(px) { return px * 72 / 96; }
        window.addEventListener("load", function() {
          var out = [];
          var els = document.querySelectorAll("[data-region]");
          for (var i = 0; i < els.length; i++) {
            var el = els[i];
            var id = el.getAttribute("data-region");
            var rect = el.getBoundingClientRect();
            var cs = window.getComputedStyle(el);
            var text = (el.innerText || "").trim();
            var weight = parseInt(cs.fontWeight, 10) || 400;
            var align = (cs.textAlign === "center" || cs.textAlign === "right") ? cs.textAlign : "left";
            out.push({
              regionId: id,
              x: rect.x, y: rect.y, w: rect.width, h: rect.height,
              text: text,
              fontSizePt: pxToPt(parseFloat(cs.fontSize)),
              color: toHex(cs.color),
              fontFamily: cs.fontFamily,
              bold: weight >= 600,
              italic: cs.fontStyle === "italic",
              align: align,
              lineHeightPt: cs.lineHeight === "normal" ? pxToPt(parseFloat(cs.fontSize)) * 1.2 : pxToPt(parseFloat(cs.lineHeight)),
              isEmpty: text.length === 0,
            });
          }
          var pre = document.createElement("pre");
          pre.id = "__geom__";
          pre.style.display = "none";
          pre.textContent = JSON.stringify(out);
          document.body.appendChild(pre);
        });
      })();
    </script>
  `;
  const baseTag = `<base href="${baseUrl}">`;
  const injected = `<head>${baseTag}${probe}`;
  return html.includes("<head>")
    ? html.replace("<head>", injected)
    : `${baseTag}${probe}${html}`;
}

async function extractGeometry(
  html: string,
  baseUrl: string,
  scratchDir: string,
): Promise<RegionGeometry[]> {
  const patched = injectGeometryProbe(html, baseUrl);
  const tmpHtml = writeTmp("geom.tmp.html", patched, scratchDir);
  // --virtual-time-budget ensures the load event + our probe script run.
  const dom = await runChromeCapture([
    ...CHROME_COMMON,
    "--dump-dom",
    `--window-size=${VIEWPORT_W},${VIEWPORT_H}`,
    `file://${tmpHtml}`,
  ]);
  const match = dom.match(/<pre id="__geom__"[^>]*>([\s\S]*?)<\/pre>/);
  if (!match) {
    throw new Error(`geometry probe did not run; --dump-dom did not contain <pre id="__geom__">`);
  }
  const jsonText = match[1]
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return JSON.parse(jsonText) as RegionGeometry[];
}

/** CSS px → pptxgenjs inches. */
function pxToIn(px: number): number {
  return px / PX_PER_INCH;
}

/** Ensure the pres has the HTML layout registered (idempotent). */
export function ensureHtmlLayout(pres: PptxGenJS): void {
  // `defineLayout` is idempotent re: name but let's be safe.
  // PptxGenJS throws on redefinition with a different size, so callers
  // creating a fresh pres + switching layout are safe.
  try {
    pres.defineLayout({ name: "LAYOUT_HTML", width: SLIDE_W_IN, height: SLIDE_H_IN });
  } catch {
    // already defined on this pres — fine.
  }
  pres.layout = "LAYOUT_HTML";
}

/**
 * Stage one editable slide (bg image + text regions) into an existing pres.
 * The slide is appended. Returns the pptxgenjs slide handle so callers can
 * further customize if needed.
 */
export function addHtmlSlideToPres(
  pres: PptxGenJS,
  args: { bgPng: string; regions: RegionGeometry[] },
): PptxGenJS.Slide {
  ensureHtmlLayout(pres);
  const slide = pres.addSlide();

  // Layer 1: decorative background
  slide.addImage({
    path: args.bgPng,
    x: 0,
    y: 0,
    w: SLIDE_W_IN,
    h: SLIDE_H_IN,
  });

  // Layer 2: editable text regions
  for (const r of args.regions) {
    if (r.isEmpty) continue;
    const primaryFont = (r.fontFamily.split(",")[0] || "").replace(/["']/g, "").trim();
    slide.addText(r.text, {
      x: pxToIn(r.x),
      y: pxToIn(r.y),
      w: pxToIn(r.w),
      h: pxToIn(r.h),
      fontFace: primaryFont || "PingFang SC",
      fontSize: Math.round(r.fontSizePt),
      color: r.color,
      bold: r.bold,
      italic: r.italic,
      align: r.align,
      valign: "top",
      margin: 0,
      fit: "shrink",
    });
  }
  return slide;
}

/** Emit a single-slide pptx file (legacy wrapper around addHtmlSlideToPres). */
async function compileEditablePptx(args: {
  bgPng: string;
  regions: RegionGeometry[];
  outPath: string;
}): Promise<void> {
  const pres = new PptxGenJS();
  addHtmlSlideToPres(pres, { bgPng: args.bgPng, regions: args.regions });
  await pres.writeFile({ fileName: args.outPath });
}

/**
 * Build bg PNG + geometry for a single page WITHOUT emitting a pptx — the
 * caller will use addHtmlSlideToPres to stage it into a shared multi-slide
 * pres. Useful for runtime/export.service paths that compose decks.
 */
/**
 * Content-addressable cache for expensive per-page assets.
 *
 * Cache key derivation:
 *   - bg PNG:        sha256(filled-html + baseUrl + "bg/v1")
 *   - geometry JSON: sha256(filled-html + baseUrl + "geom/v1")
 *
 * Location: `CACHE_DIR` (default `/tmp/intelliflow-html-cache`). Override
 * via `HTML_EDITABLE_CACHE_DIR` env var. Disable with
 * `HTML_EDITABLE_CACHE=0` (useful for A/B testing + tests that need
 * deterministic uncached runs).
 */
const CACHE_DIR = process.env.HTML_EDITABLE_CACHE_DIR ?? "/tmp/intelliflow-html-cache";
const CACHE_ENABLED = process.env.HTML_EDITABLE_CACHE !== "0";

function cacheKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("::")).digest("hex");
}

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

export async function prepareHtmlSlideAssets(args: {
  templateId: string;
  htmlPath: string;
  pageId: string;
  pageContent: unknown;
  scratchDir: string;
  mockResponse?: string;
  fillPlanOverride?: import("./html-fill-plan-schema").HtmlFillPlan;
  /** Force-bypass the content-addressable cache even when enabled globally. */
  skipCache?: boolean;
}): Promise<{ bgPng: string; regions: RegionGeometry[] }> {
  const htmlRaw = readFileSync(args.htmlPath, "utf8");
  const plan =
    args.fillPlanOverride ??
    (await generateHtmlFillPlan({
      templateId: args.templateId,
      htmlPath: args.htmlPath,
      pageId: args.pageId,
      pageContent: args.pageContent,
      mockResponse: args.mockResponse,
    }));
  const filled = applyFillPlanToHtml(htmlRaw, plan, args.pageId);
  const baseUrl = `file://${dirname(resolve(args.htmlPath))}/`;
  const bgPng = resolve(args.scratchDir, `${args.pageId}.bg.png`);

  const useCache = CACHE_ENABLED && !args.skipCache;
  const bgCacheKey = useCache ? cacheKey([filled, baseUrl, "bg/v1"]) : "";
  const geomCacheKey = useCache ? cacheKey([filled, baseUrl, "geom/v1"]) : "";
  const bgCachePath = useCache ? resolve(CACHE_DIR, `${bgCacheKey}.png`) : "";
  const geomCachePath = useCache ? resolve(CACHE_DIR, `${geomCacheKey}.geom.json`) : "";

  if (useCache) ensureCacheDir();

  // Background PNG: cache hit → copy; miss → render + populate.
  if (useCache && existsSync(bgCachePath)) {
    copyFileSync(bgCachePath, bgPng);
  } else {
    await renderBackgroundPng(filled, baseUrl, bgPng, args.scratchDir);
    if (useCache) {
      try {
        copyFileSync(bgPng, bgCachePath);
      } catch {}
    }
  }

  // Geometry: cache hit → parse; miss → extract + populate.
  let regions: RegionGeometry[];
  if (useCache && existsSync(geomCachePath)) {
    regions = JSON.parse(readFileSync(geomCachePath, "utf8")) as RegionGeometry[];
  } else {
    regions = await extractGeometry(filled, baseUrl, args.scratchDir);
    if (useCache) {
      try {
        writeFileSync(geomCachePath, JSON.stringify(regions));
      } catch {}
    }
  }

  return { bgPng, regions };
}

export async function renderHtmlToEditablePptx(args: {
  templateId: string;
  htmlPath: string;
  pageId: string;
  pageContent: unknown;
  outPath: string;
  scratchDir: string;
  mockResponse?: string;
  /** Pre-computed fill plan; if supplied, skips LLM roundtrip. */
  fillPlanOverride?: import("./html-fill-plan-schema").HtmlFillPlan;
}): Promise<{ bgPng: string; regions: RegionGeometry[] }> {
  const { bgPng, regions } = await prepareHtmlSlideAssets(args);
  await compileEditablePptx({ bgPng, regions, outPath: args.outPath });
  return { bgPng, regions };
}

function parseCli(argv: string[]): {
  htmlPath: string;
  contentPath: string;
  pageId: string;
  outPath: string;
  templateId: string;
  scratchDir: string;
  mockPath?: string;
  fillPlanPath?: string;
} {
  const out: Partial<{
    htmlPath: string;
    contentPath: string;
    pageId: string;
    outPath: string;
    templateId: string;
    scratchDir: string;
    mockPath?: string;
    fillPlanPath?: string;
  }> = { templateId: "622eee2ab7e6e", scratchDir: "/tmp/intelliflow-html-editable" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--html") out.htmlPath = argv[++i];
    else if (a === "--content") out.contentPath = argv[++i];
    else if (a === "--page") out.pageId = argv[++i];
    else if (a === "--out") out.outPath = argv[++i];
    else if (a === "--template-id") out.templateId = argv[++i];
    else if (a === "--scratch-dir") out.scratchDir = argv[++i];
    else if (a === "--mock") out.mockPath = argv[++i];
    else if (a === "--fill-plan") out.fillPlanPath = argv[++i];
  }
  if (!out.htmlPath || !out.contentPath || !out.pageId || !out.outPath) {
    throw new Error(
      "usage: html-to-editable-pptx --html <path> --content <json> --page <id> --out <pptx> [--template-id <id>] [--scratch-dir <dir>] [--mock <json>] [--fill-plan <existing-json>]",
    );
  }
  return out as {
    htmlPath: string;
    contentPath: string;
    pageId: string;
    outPath: string;
    templateId: string;
    scratchDir: string;
    mockPath?: string;
    fillPlanPath?: string;
  };
}

if (import.meta.main) {
  const cli = parseCli(process.argv.slice(2));
  const htmlPath = resolve(cli.htmlPath);
  const contentPath = resolve(cli.contentPath);
  const content = JSON.parse(readFileSync(contentPath, "utf8")) as {
    pages?: Array<{ pageId: string }>;
  };
  const pageContent = (content.pages ?? []).find((p) => p.pageId === cli.pageId) ?? content;

  (async () => {
    // Ensure the scratch dir exists.
    const { mkdirSync } = await import("node:fs");
    mkdirSync(cli.scratchDir, { recursive: true });

    const mockResponse = cli.mockPath ? readFileSync(resolve(cli.mockPath), "utf8") : undefined;
    const fillPlanOverride = cli.fillPlanPath
      ? (JSON.parse(readFileSync(resolve(cli.fillPlanPath), "utf8")) as import("./html-fill-plan-schema").HtmlFillPlan)
      : undefined;
    console.error(
      `[html-to-editable-pptx] template=${cli.templateId} page=${cli.pageId} html=${htmlPath} mode=${mockResponse ? "mock" : fillPlanOverride ? "preset-fill-plan" : "live"}`,
    );
    if (!mockResponse && !fillPlanOverride && process.env.CLAUDE_MOCK !== "1") {
      try {
        const live = await ensureLiveClaudeEnvFromDb();
        console.error(
          `[html-to-editable-pptx] LLM live source=${live.source} model=${live.modelId ?? "?"}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[html-to-editable-pptx] could not auto-load LLM config (${msg})`);
      }
    }

    const { regions } = await renderHtmlToEditablePptx({
      templateId: cli.templateId,
      htmlPath,
      pageId: cli.pageId,
      pageContent,
      outPath: resolve(cli.outPath),
      scratchDir: cli.scratchDir,
      mockResponse,
      fillPlanOverride,
    });
    console.log(`wrote ${cli.outPath} (${regions.length} regions, ${regions.filter((r) => !r.isEmpty).length} with text)`);
  })().catch((err) => {
    console.error("[html-to-editable-pptx] FAILED:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

void REPO_ROOT;
