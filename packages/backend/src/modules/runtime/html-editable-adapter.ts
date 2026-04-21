/**
 * Runtime adapter — expose the HTML-fidelity editable-pptx pipeline as a
 * buffer-producing function that `runtime/export.service.ts` can dispatch
 * to when content declares itself as `html_fidelity_deck/v1`.
 *
 * Content shape (what a node/document output must produce to opt into
 * this path):
 *
 * ```json
 * {
 *   "version": "html_fidelity_deck/v1",
 *   "templateId": "622eee2ab7e6e",
 *   "pages": [
 *     { "pageId": "p1", "template": "cover",      "content": {...} },
 *     { "pageId": "p2", "template": "toc",        "content": {...} },
 *     { "pageId": "p3", "template": "comparison", "content": {...} }
 *   ]
 * }
 * ```
 *
 * Each page's `template` field resolves to a file at
 * `docs/design/ppt-mvp/html-styles/<templateId>/<template>.html`. The LLM
 * fill-plan round-trip runs once per page, then geometry + editable text
 * boxes are staged into a shared multi-slide pptx.
 *
 * Trade-off vs preserve mode: this path doesn't need a pre-authored slot
 * map; template HTML is the single source of truth. It ALSO doesn't
 * reuse any imported .pptx binary — decorative visuals are CSS-rendered.
 */
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import PptxGenJS from "pptxgenjs";
import type {
  DeckCompositionSummary,
  DeckSource,
} from "./ppt-deck-composition";
import {
  addHtmlSlideToPres,
  prepareHtmlSlideAssets,
} from "../../scripts/ppt-mvp/preserve/html-to-editable-pptx";

export const HTML_FIDELITY_DECK_VERSION = "html_fidelity_deck/v1";

export type HtmlFidelityPageRef = {
  pageId: string;
  /** Template section name, resolved to `<htmlStylesDir>/<templateId>/<template>.html`. */
  template: string;
  /** Free-form page content passed to the LLM. Same shape your content-authoring layer produces. */
  content: unknown;
};

export type HtmlFidelityDeck = {
  version: typeof HTML_FIDELITY_DECK_VERSION;
  templateId: string;
  htmlStylesDir?: string;
  pages: HtmlFidelityPageRef[];
};

export type HtmlFidelityRenderResult = {
  buffer: Buffer;
  renderMode: string;
  warnings: string[];
  compositionSummary: DeckCompositionSummary;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Parse a string or unknown content blob; return null if it's not our shape. */
export function parseHtmlFidelityDeckContent(content: unknown): HtmlFidelityDeck | null {
  let parsed: unknown = content;
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed.startsWith("{")) return null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!isRecord(parsed)) return null;
  if (parsed.version !== HTML_FIDELITY_DECK_VERSION) return null;
  if (typeof parsed.templateId !== "string" || parsed.templateId.length === 0) return null;
  if (!Array.isArray(parsed.pages) || parsed.pages.length === 0) return null;
  for (const page of parsed.pages) {
    if (!isRecord(page)) return null;
    if (typeof page.pageId !== "string" || page.pageId.length === 0) return null;
    if (typeof page.template !== "string" || page.template.length === 0) return null;
    if (!("content" in page)) return null;
  }
  const styles = parsed.htmlStylesDir;
  if (styles !== undefined && typeof styles !== "string") return null;
  return parsed as unknown as HtmlFidelityDeck;
}

/** Resolve a template name (e.g. "cover") to an absolute HTML path. */
export function resolveTemplateHtmlPath(deck: HtmlFidelityDeck, template: string): string {
  // Default styles dir is repo-relative. In production (backend installed on
  // a server), callers should pass an absolute path via htmlStylesDir.
  const stylesDir = deck.htmlStylesDir ?? resolve(__dirname, "../../../../../docs/design/ppt-mvp/html-styles");
  const htmlPath = join(stylesDir, deck.templateId, `${template}.html`);
  if (!existsSync(htmlPath)) {
    throw new Error(
      `HTML template not found: ${htmlPath} (templateId=${deck.templateId}, template=${template})`,
    );
  }
  return htmlPath;
}

export async function renderHtmlFidelityDeckToBuffer(
  deck: HtmlFidelityDeck,
  opts: {
    scratchDir?: string;
    /**
     * Optional per-page fill-plan overrides keyed by pageId. Useful for
     * tests + deterministic replays — skips the LLM roundtrip.
     */
    fillPlanOverrides?: Record<string, import("../../scripts/ppt-mvp/preserve/html-fill-plan-schema").HtmlFillPlan>;
    /**
     * Max concurrent per-page asset preparations (LLM + chrome).
     * Defaults to 4 — trades off rate-limit safety vs wall-clock.
     */
    concurrency?: number;
  } = {},
): Promise<HtmlFidelityRenderResult> {
  const scratchDir = opts.scratchDir ?? mkdtempSync(join(tmpdir(), "html-fidelity-"));
  const pres = new PptxGenJS();
  const warnings: string[] = [];
  const concurrency = Math.max(1, opts.concurrency ?? 4);

  const { mkdirSync } = await import("node:fs");

  // Phase 1 — parallelize per-page asset preparation (bg render + geometry
  // + LLM fill-plan). Each page is independent up to this point; adding a
  // shared pres slide must still happen in order, so we collect assets
  // first, then stage them sequentially.
  type PreparedAsset = {
    page: HtmlFidelityPageRef;
    bgPng: string;
    regions: import("../../scripts/ppt-mvp/preserve/html-to-editable-pptx").RegionGeometry[];
  };

  async function prepareOnePage(page: HtmlFidelityPageRef): Promise<PreparedAsset> {
    const htmlPath = resolveTemplateHtmlPath(deck, page.template);
    const pageScratch = join(scratchDir, page.pageId);
    try {
      mkdirSync(pageScratch, { recursive: true });
    } catch {}
    const { bgPng, regions } = await prepareHtmlSlideAssets({
      templateId: deck.templateId,
      htmlPath,
      pageId: page.pageId,
      pageContent: page.content,
      scratchDir: pageScratch,
      fillPlanOverride: opts.fillPlanOverrides?.[page.pageId],
    });
    return { page, bgPng, regions };
  }

  // Bounded-concurrency worker pool over deck.pages preserving order.
  const prepared: PreparedAsset[] = new Array(deck.pages.length);
  let cursor = 0;
  const workers: Promise<void>[] = [];
  for (let w = 0; w < Math.min(concurrency, deck.pages.length); w += 1) {
    workers.push(
      (async () => {
        while (true) {
          const idx = cursor++;
          if (idx >= deck.pages.length) return;
          prepared[idx] = await prepareOnePage(deck.pages[idx]);
        }
      })(),
    );
  }
  await Promise.all(workers);

  // Phase 2 — stage slides into the shared pres in deck order.
  for (const asset of prepared) {
    addHtmlSlideToPres(pres, { bgPng: asset.bgPng, regions: asset.regions });
    if (asset.regions.length === 0) {
      warnings.push(`${asset.page.pageId}: no data-region elements found in ${asset.page.template}.html`);
    }
  }

  const buffer = (await pres.write({ outputType: "nodebuffer" })) as unknown as Buffer;

  const summary: DeckCompositionSummary = {
    source: "structured" satisfies DeckSource,
    totalSlides: deck.pages.length,
    semanticRoleCounts: inferRoleCounts(deck),
  };

  return {
    buffer,
    renderMode: `html_fidelity_${deck.templateId}`,
    warnings,
    compositionSummary: summary,
  };
}

function inferRoleCounts(deck: HtmlFidelityDeck): DeckCompositionSummary["semanticRoleCounts"] {
  const counts: Partial<Record<string, number>> = {};
  for (const p of deck.pages) {
    const role = templateToRole(p.template);
    counts[role] = (counts[role] ?? 0) + 1;
  }
  return counts as DeckCompositionSummary["semanticRoleCounts"];
}

/** Map template name → semantic role for summary. Unknown templates → "bullet_list". */
function templateToRole(template: string): string {
  if (template === "cover") return "cover";
  if (template === "toc") return "toc";
  if (template === "comparison") return "comparison";
  if (template === "timeline") return "timeline";
  if (template === "process") return "process";
  if (template === "device") return "device_overview";
  if (template === "feature_grid") return "feature_grid";
  if (template === "summary") return "summary";
  if (template === "closing") return "closing";
  if (template === "qna") return "qna";
  if (template === "section_break") return "section_break";
  if (template === "image_focus") return "image_focus";
  if (template === "table") return "table";
  return "bullet_list";
}
