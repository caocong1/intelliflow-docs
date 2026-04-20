import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveAssetPlanToPaths } from "./assets";
import { buildCanvasRenderModel } from "./canvas-model";
import { fitPageToSchema } from "./content-fitting";
import type { AssetPlan, PagePlan, PresentationOutline, VisualBrief } from "./types";
import { MVP_THEME, VARIANT_SCHEMAS } from "./variant-library";

async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

function cssUrl(filePath: string | undefined, mode: "http" | "file"): string {
  if (!filePath) {
    return "";
  }
  if (mode === "file") {
    return pathToFileURL(filePath).toString();
  }
  if (filePath.startsWith("/tmp/")) {
    return `/${filePath.slice("/tmp/".length)}`;
  }
  if (filePath.startsWith("/private/tmp/")) {
    return `/${filePath.slice("/private/tmp/".length)}`;
  }
  return filePath;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function renderCover(page: ReturnType<typeof fitPageToSchema>, assets: Record<string, string | undefined>, mode: "http" | "file") {
  return `
    <section class="slide cover">
      <img class="cover-bg" src="${cssUrl(assets.hero_bg, mode)}" alt="">
      <div class="cover-overlay"></div>
      <div class="cover-eyebrow">${escapeHtml(String(page.slots.eyebrow ?? ""))}</div>
      <h1 class="cover-title">${escapeHtml(String(page.slots.title ?? ""))}</h1>
      <div class="cover-subtitle">${escapeHtml(String(page.slots.subtitle ?? ""))}</div>
      <div class="cover-line"></div>
      <div class="cover-audience">${escapeHtml(String(page.slots.audienceLine ?? ""))}</div>
      <aside class="notes">${escapeHtml(page.speakerNote ?? "")}</aside>
    </section>
  `;
}

function renderToc(page: ReturnType<typeof fitPageToSchema>, assets: Record<string, string | undefined>, mode: "http" | "file") {
  const items = Array.isArray(page.slots.items) ? (page.slots.items as Array<Record<string, string>>) : [];
  const cards = items.map((item) => `
    <div class="toc-card">
      <div class="toc-index">${escapeHtml(item.index ?? "")}</div>
      <div class="toc-copy">
        <div class="toc-title">${escapeHtml(item.title ?? "")}</div>
        <div class="toc-subtitle">${escapeHtml(item.subtitle ?? "")}</div>
      </div>
    </div>
  `).join("");

  return `
    <section class="slide light-tech" style="background-image:url('${cssUrl(assets.bg_texture, mode)}')">
      <div class="title-block">
        <h1>${escapeHtml(String(page.slots.title ?? ""))}</h1>
      </div>
      <div class="toc-grid">${cards}</div>
      <aside class="notes">${escapeHtml(page.speakerNote ?? "")}</aside>
    </section>
  `;
}

function renderComparison(page: ReturnType<typeof fitPageToSchema>, assets: Record<string, string | undefined>, mode: "http" | "file") {
  const left = Array.isArray(page.slots.leftBullets) ? page.slots.leftBullets as string[] : [];
  const right = Array.isArray(page.slots.rightBullets) ? page.slots.rightBullets as string[] : [];
  const renderBulletSet = (items: string[], side: "left" | "right") => `
    ${items[0] ? `<div class="compare-hero compare-hero-${side}">${escapeHtml(items[0])}</div>` : ""}
    <div class="compare-support-grid">
      ${items[1] ? `<div class="compare-bullet compare-bullet-${side}">${escapeHtml(items[1])}</div>` : ""}
      ${items[2] ? `<div class="compare-bullet compare-bullet-${side}">${escapeHtml(items[2])}</div>` : ""}
    </div>
  `;

  return `
    <section class="slide light-tech" style="background-image:url('${cssUrl(assets.bg_texture, mode)}')">
      <div class="title-block">
        <h1>${escapeHtml(String(page.slots.title ?? ""))}</h1>
      </div>
      <div class="compare-grid">
        <div class="compare-panel">
          <img class="compare-image" src="${cssUrl(assets.left_illustration, mode)}" alt="">
          <div class="compare-head">
            ${assets.left_icon ? `<img class="compare-icon" src="${cssUrl(assets.left_icon, mode)}" alt="">` : ""}
            <span class="compare-title compare-title-left">${escapeHtml(String(page.slots.leftTitle ?? ""))}</span>
          </div>
          <div class="compare-list">${renderBulletSet(left, "left")}</div>
        </div>
        <div class="compare-panel">
          <img class="compare-image" src="${cssUrl(assets.right_illustration, mode)}" alt="">
          <div class="compare-head">
            ${assets.right_icon ? `<img class="compare-icon" src="${cssUrl(assets.right_icon, mode)}" alt="">` : ""}
            <span class="compare-title compare-title-right">${escapeHtml(String(page.slots.rightTitle ?? ""))}</span>
          </div>
          <div class="compare-list">${renderBulletSet(right, "right")}</div>
        </div>
      </div>
      <aside class="notes">${escapeHtml(page.speakerNote ?? "")}</aside>
    </section>
  `;
}

function renderTimeline(page: ReturnType<typeof fitPageToSchema>, assets: Record<string, string | undefined>, mode: "http" | "file") {
  const nodes = Array.isArray(page.slots.nodes) ? page.slots.nodes as Array<Record<string, string>> : [];
  const tones = ["tone-1", "tone-2", "tone-3", "tone-4", "tone-5"];
  const topNodes = nodes.map((_, idx) => `
    <div class="timeline-top-step">
      <div class="wifi-wrap ${tones[idx] ?? "tone-5"} scale-${Math.min(idx + 1, 5)}">
        <svg viewBox="0 0 120 90" class="wifi-svg" aria-hidden="true">
          <path d="M20 40 Q60 6 100 40"></path>
          <path d="M34 50 Q60 24 86 50"></path>
          <path d="M47 60 Q60 45 73 60"></path>
          <circle cx="60" cy="72" r="6"></circle>
        </svg>
      </div>
      <div class="timeline-top-anchor"></div>
    </div>
  `).join("");
  const cards = nodes.map((node) => `
    <div class="timeline-card">
      <div class="timeline-year">${escapeHtml(node.year ?? "")}</div>
      <div class="timeline-title">${escapeHtml(node.title ?? "")}</div>
      <div class="timeline-detail">${escapeHtml(node.detail ?? "")}</div>
    </div>
  `).join("");

  return `
    <section class="slide light-tech" style="background-image:url('${cssUrl(assets.bg_texture, mode)}')">
      <div class="title-block">
        <h1>${escapeHtml(String(page.slots.title ?? ""))}</h1>
      </div>
      <div class="timeline-hero">
        <div class="timeline-top-track">
          ${topNodes}
        </div>
      </div>
      <div class="timeline-cards">${cards}</div>
      <div class="timeline-summary">
        ${assets.summary_icon ? `<img class="summary-icon" src="${cssUrl(assets.summary_icon, mode)}" alt="">` : ""}
        <strong>核心发展趋势：</strong>
        <span>${escapeHtml(String(page.slots.summary ?? ""))}</span>
      </div>
      <aside class="notes">${escapeHtml(page.speakerNote ?? "")}</aside>
    </section>
  `;
}

function renderPage(page: ReturnType<typeof fitPageToSchema>, assets: Record<string, string | undefined>, mode: "http" | "file") {
  switch (page.variantId) {
    case "cover_hero_image":
      return renderCover(page, assets, mode);
    case "toc_card_grid_8":
      return renderToc(page, assets, mode);
    case "comparison_dual_image":
      return renderComparison(page, assets, mode);
    case "timeline_horizontal_5":
      return renderTimeline(page, assets, mode);
    default:
      throw new Error(`Unsupported preview variant: ${page.variantId}`);
  }
}

function buildHtml(slides: string[], opts?: { mode?: "http" | "file" }) {
  const fileMode = opts?.mode === "file";
  return `<!doctype html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>PPT MVP Preview</title>
    <style>
      html, body { margin: 0; padding: 0; overflow: hidden; background: ${fileMode ? "#f5f7f8" : "#dce6ef"}; font-family: "Microsoft YaHei", sans-serif; }
      body { padding: ${fileMode ? "0" : "24px"}; }
      .slide { position: relative; width: 1280px; height: 720px; margin: 0 auto ${fileMode ? "0" : "32px"}; background: #f5f7f8 center/cover no-repeat; overflow: hidden; box-shadow: ${fileMode ? "none" : "0 12px 40px rgba(15, 23, 42, .14)"}; }
      .light-tech::before { content: ""; position: absolute; inset: 0; background: rgba(255,255,255,.52); }
      .title-block { position: absolute; left: 110px; top: 68px; z-index: 2; }
      .title-block h1 { margin: 0; font-size: 58px; line-height: 1.1; color: #1f2937; }
      .notes { position: absolute; left: 24px; right: 24px; bottom: 12px; font-size: 18px; color: #334155; opacity: .85; display: ${fileMode ? "none" : "block"}; }
      .cover-bg, .cover-overlay { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .cover-overlay { background: rgba(15, 23, 42, .42); }
      .cover-eyebrow, .cover-title, .cover-subtitle, .cover-audience, .cover-line { position: absolute; left: 68px; z-index: 2; }
      .cover-eyebrow { top: 80px; color: #f59e0b; font-size: 18px; font-weight: 700; }
      .cover-title { top: 170px; width: 560px; color: white; font-size: 64px; font-weight: 700; line-height: 1.12; }
      .cover-subtitle { top: 336px; width: 560px; color: #e5e7eb; font-size: 28px; }
      .cover-line { top: 430px; width: 160px; height: 4px; background: #2fcf7a; }
      .cover-audience { bottom: 66px; color: #e5e7eb; font-size: 16px; }
      .toc-grid { position: absolute; left: 110px; top: 150px; width: 1060px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px 24px; z-index: 2; }
      .toc-card { display: flex; align-items: center; padding: 18px 24px; background: white; border-radius: 22px; box-shadow: 0 4px 18px rgba(15,23,42,.08); }
      .toc-index { width: 68px; height: 68px; border-radius: 50%; background: #2fcf7a; color: white; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; flex: 0 0 auto; }
      .toc-copy { margin-left: 18px; }
      .toc-title { font-size: 20px; font-weight: 700; color: #1f2937; }
      .toc-subtitle { margin-top: 8px; font-size: 14px; color: #667085; }
      .compare-grid { position: absolute; left: 110px; top: 154px; width: 1060px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; z-index: 2; }
      .compare-panel { background: white; border-radius: 24px; padding: 18px 18px 22px; box-shadow: 0 4px 18px rgba(15,23,42,.08); }
      .compare-image { width: 100%; height: 230px; object-fit: cover; border-radius: 18px; display: block; }
      .compare-head { display: flex; align-items: center; margin-top: 18px; }
      .compare-icon { width: 26px; height: 26px; margin-right: 10px; }
      .compare-title { font-size: 18px; font-weight: 700; }
      .compare-title-left { color: #2fcf7a; }
      .compare-title-right { color: #f97316; }
      .compare-list { margin-top: 14px; display: grid; gap: 12px; }
      .compare-hero { padding: 14px 16px; border-radius: 16px; font-size: 18px; line-height: 1.4; font-weight: 700; }
      .compare-hero-left { background: #ecfbf2; color: #1f2937; }
      .compare-hero-right { background: #fff5ea; color: #1f2937; }
      .compare-support-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .compare-bullet { padding: 12px 14px; border-radius: 14px; font-size: 15px; line-height: 1.35; }
      .compare-bullet-left { background: #f4fbf7; color: #1f2937; }
      .compare-bullet-right { background: #fff9f2; color: #1f2937; }
      .timeline-hero { position: absolute; left: 110px; top: 150px; width: 1060px; height: 210px; padding: 22px; box-sizing: border-box; background: white; border-radius: 24px; box-shadow: 0 4px 18px rgba(15,23,42,.08); z-index: 2; }
      .timeline-top-track { position: relative; width: 100%; height: 100%; display: grid; grid-template-columns: repeat(5, 1fr); align-items: end; }
      .timeline-top-track::before { content: ""; position: absolute; left: 76px; right: 76px; top: 122px; height: 6px; border-radius: 999px; background: #adb7c0; }
      .timeline-top-step { position: relative; display: flex; align-items: center; justify-content: center; height: 100%; }
      .wifi-wrap { position: absolute; top: 12px; display: flex; align-items: center; justify-content: center; transform-origin: center bottom; }
      .wifi-wrap.scale-1 { transform: scale(0.82); }
      .wifi-wrap.scale-2 { transform: scale(1); }
      .wifi-wrap.scale-3 { transform: scale(1.18); }
      .wifi-wrap.scale-4 { transform: scale(1.34); }
      .wifi-wrap.scale-5 { transform: scale(1.48); }
      .wifi-svg { width: 120px; height: 90px; }
      .wifi-svg path { fill: none; stroke-width: 8; stroke-linecap: round; }
      .wifi-svg circle { r: 6; }
      .tone-1 .wifi-svg path, .tone-1 .wifi-svg circle { stroke: #0f766e; fill: #0f766e; }
      .tone-2 .wifi-svg path, .tone-2 .wifi-svg circle { stroke: #84cc16; fill: #84cc16; }
      .tone-3 .wifi-svg path, .tone-3 .wifi-svg circle { stroke: #2dd4bf; fill: #2dd4bf; }
      .tone-4 .wifi-svg path, .tone-4 .wifi-svg circle { stroke: #22d3ee; fill: #22d3ee; }
      .tone-5 .wifi-svg path, .tone-5 .wifi-svg circle { stroke: #14b8a6; fill: #14b8a6; }
      .timeline-top-anchor { position: absolute; top: 98px; width: 48px; height: 48px; border-radius: 50%; border: 5px solid #9aa4ae; background: #fff; z-index: 2; }
      .timeline-cards { position: absolute; left: 110px; top: 386px; width: 1060px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 18px; z-index: 2; }
      .timeline-card { background: white; border-radius: 18px; box-shadow: 0 4px 18px rgba(15,23,42,.08); padding: 22px 18px; text-align: center; min-height: 128px; }
      .timeline-year { color: #2fcf7a; font-size: 26px; font-weight: 700; }
      .timeline-title { margin-top: 14px; color: #1f2937; font-size: 15px; font-weight: 700; line-height: 1.3; }
      .timeline-detail { margin-top: 12px; color: #667085; font-size: 13px; line-height: 1.35; }
      .timeline-summary { position: absolute; left: 110px; right: 110px; bottom: 64px; display: flex; align-items: center; gap: 12px; padding: 16px 20px; background: #e6faec; border-radius: 22px; z-index: 2; font-size: 18px; color: #1f2937; }
      .summary-icon { width: 28px; height: 28px; }
    </style>
  </head>
  <body>${slides.join("\n")}</body></html>`;
}

async function main() {
  const baseDir = resolve(process.cwd(), "docs/design/ppt-mvp");
  const outputArg = process.argv[2];
  const pageIdArg = process.argv[3];
  const modeArg = process.argv[4] === "file" ? "file" : "http";
  const outputPath = resolve(
    process.cwd(),
    outputArg && outputArg.trim().length > 0
      ? outputArg
      : "/tmp/intelliflow-ppt-mvp-wireless-preview.html",
  );

  const outline = await readJsonFile<PresentationOutline>(`${baseDir}/wireless-outline.json`);
  const brief = await readJsonFile<VisualBrief>(`${baseDir}/wireless-visual-brief.json`);
  const pagePlan = await readJsonFile<PagePlan>(`${baseDir}/wireless-page-plan.json`);
  const assetPlan = await readJsonFile<AssetPlan>(`${baseDir}/wireless-asset-plan.json`);

  const fittedPages = pagePlan.pages.map((page) => {
    const schema = VARIANT_SCHEMAS.find((candidate) => candidate.variantId === page.variantHint);
    if (!schema) throw new Error(`Missing schema for variant ${page.variantHint}`);
    return fitPageToSchema(page, schema);
  });

  const resolvedAssets = await resolveAssetPlanToPaths(assetPlan);
  const canvas = buildCanvasRenderModel(outline, brief, fittedPages, MVP_THEME);
  const pagesToRender = pageIdArg
    ? canvas.pages.filter((page) => page.pageId === pageIdArg)
    : canvas.pages;
  if (pagesToRender.length === 0) {
    throw new Error(`No preview page found for pageId=${pageIdArg}`);
  }
  const html = buildHtml(
    pagesToRender.map((page) => renderPage(page, resolvedAssets[page.pageId] ?? {}, modeArg)),
    { mode: modeArg },
  );

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf-8");

  console.log(JSON.stringify({
    outputPath,
    pageIds: pagesToRender.map((page) => page.pageId),
    familyId: canvas.familyId,
    pageCount: pagesToRender.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
