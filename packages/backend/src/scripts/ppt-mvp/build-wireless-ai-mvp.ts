#!/usr/bin/env bun
/**
 * Wireless-network MVP build — thin wrapper over buildFromPagePlan that
 * supplies the wireless-specific input paths and a mock provider seeded by
 * the V1/V2 experiment artifacts.
 *
 * See docs/design/ppt-mvp/ai-pipeline.md for usage.
 */

import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Layer0Source } from "./ai-pipeline/types";
import type { PagePlan } from "./types";
import { buildFromPagePlan } from "./ai-pipeline/build-from-page-plan";
import type { MockProvider } from "./ai-pipeline/pipeline";
import { ensureLiveClaudeEnvFromDb } from "./ai-pipeline/live-config";

const REPO_DOCS = new URL("../../../../..//docs", import.meta.url).pathname;
const MVP_DOCS = join(REPO_DOCS, "design", "ppt-mvp");
const V1_EXPERIMENT_DIR = "/tmp/ppt-research/landppt-experiment";
const V2_EXPERIMENT_DIR = "/tmp/ppt-research/landppt-experiment-v2-business";

const DEFAULT_OUTPUT = "/tmp/intelliflow-ppt-mvp-wireless-ai-v1.pptx";
const INGESTED_DEFAULT_OUTPUT = "/tmp/intelliflow-ppt-mvp-wireless-ai-blue-business.pptx";

const DEFAULT_PRESETS_INDEX = "/tmp/ppt-research/ingest-out/presets-index.json";

type CliArgs = {
  outputPptx: string;
  ingestedTemplatePath: string | null;
  liveModelId: string | null;
};

function parseArgs(argv: string[]): CliArgs {
  let ingested: string | null = null;
  let preset: string | null = null;
  let presetIndexPath: string | null = null;
  let liveModelId: string | null = null;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--ingested") {
      ingested = argv[i + 1];
      i += 1;
    } else if (a.startsWith("--ingested=")) {
      ingested = a.slice("--ingested=".length);
    } else if (a === "--preset") {
      preset = argv[i + 1];
      i += 1;
    } else if (a.startsWith("--preset=")) {
      preset = a.slice("--preset=".length);
    } else if (a === "--presets-index") {
      presetIndexPath = argv[i + 1];
      i += 1;
    } else if (a.startsWith("--presets-index=")) {
      presetIndexPath = a.slice("--presets-index=".length);
    } else if (a === "--model-id") {
      liveModelId = argv[i + 1] ?? null;
      i += 1;
    } else if (a.startsWith("--model-id=")) {
      liveModelId = a.slice("--model-id=".length);
    } else {
      positional.push(a);
    }
  }
  if (preset && !ingested) {
    ingested = resolvePresetToIngestedPath(preset, presetIndexPath ?? DEFAULT_PRESETS_INDEX);
  }
  const outputPptx = positional[0] ?? (ingested ? INGESTED_DEFAULT_OUTPUT : DEFAULT_OUTPUT);
  return { outputPptx, ingestedTemplatePath: ingested, liveModelId };
}

function resolvePresetToIngestedPath(presetId: string, indexPath: string): string {
  if (!existsSync(indexPath)) {
    throw new Error(
      `--preset requires presets-index.json. Not found at ${indexPath}. ` +
        `Run batch-ingest-templates.ts first, or pass --presets-index <path>.`,
    );
  }
  const text = readFileSync(indexPath, "utf8");
  const index = JSON.parse(text) as {
    presets: Array<{ presetId: string; templateJson: string; ingestedOk: boolean }>;
  };
  const hit = index.presets.find((p) => p.presetId === presetId && p.ingestedOk);
  if (!hit) {
    const available = index.presets.filter((p) => p.ingestedOk).map((p) => p.presetId);
    throw new Error(
      `Preset "${presetId}" not found in index. Available: ${available.join(", ") || "(none)"}`,
    );
  }
  return hit.templateJson;
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));

  // Default to mock mode unless caller explicitly opts out.
  if (process.env.CLAUDE_MOCK == null) {
    process.env.CLAUDE_MOCK = "1";
    console.log("[build-wireless-ai-mvp] CLAUDE_MOCK defaulted to 1 (no API calls)");
  }
  const forceMock = process.env.CLAUDE_MOCK === "1" || process.env.CLAUDE_MOCK === "true";

  if (!forceMock) {
    const liveConfig = await ensureLiveClaudeEnvFromDb({
      preferredModelId: cli.liveModelId,
    });
    if (liveConfig.source === "db") {
      console.log(
        `[build-wireless-ai-mvp] live config: ${liveConfig.modelId} via ${liveConfig.providerName} (from DB)`,
      );
    } else {
      console.log(
        `[build-wireless-ai-mvp] live config: ${liveConfig.modelId ?? "(default model)"} via explicit env`,
      );
    }
  }

  const planPath = join(
    MVP_DOCS,
    forceMock ? "wireless-page-plan.json" : "wireless-page-plan-expanded.json",
  );
  const plan = JSON.parse(await readFile(planPath, "utf8")) as PagePlan;

  const layer0Source: Layer0Source | undefined = cli.ingestedTemplatePath
    ? { kind: "ingested_template", templateJsonPath: cli.ingestedTemplatePath }
    : undefined;

  const mockProvider = forceMock
    ? await buildWirelessMockProvider(plan, cli.ingestedTemplatePath != null)
    : undefined;
  const sessionTag = cli.ingestedTemplatePath ? "wireless-blue-business" : "wireless-v1";

  await buildFromPagePlan({
    outlinePath: join(MVP_DOCS, "wireless-outline.json"),
    briefPath: layer0Source ? undefined : join(MVP_DOCS, "wireless-visual-brief.json"),
    planPath,
    assetPlanPath: forceMock
      ? undefined
      : join(MVP_DOCS, "wireless-asset-plan-expanded.json"),
    outputPptx: cli.outputPptx,
    layer0Source,
    mockProvider,
    forceMock,
    sessionTag,
  });
}

/**
 * Wireless-specific MockProvider: serves canned responses derived from the
 * §8.5 (V1 editorial) and §8.6 (V2 blue business) experiment artifacts.
 * Layer 4 reuses the actual experiment HTML with design-system CSS inlined
 * so each page is fully self-contained.
 */
async function buildWirelessMockProvider(
  plan: PagePlan,
  useIngested: boolean,
): Promise<MockProvider> {
  const dir = useIngested ? V2_EXPERIMENT_DIR : V1_EXPERIMENT_DIR;
  const cssPath = join(dir, "00-design-system.css");
  const css = existsSync(cssPath) ? await readFile(cssPath, "utf8") : "";

  const pageHtmlMap = new Map<string, string>();
  for (const page of plan.pages) {
    const htmlPath = pickExperimentHtmlPath(page.pageType, dir);
    if (existsSync(htmlPath)) {
      const raw = await readFile(htmlPath, "utf8");
      const inlined = inlineDesignSystemCss(raw, css);
      pageHtmlMap.set(page.pageId, `\`\`\`html\n${inlined}\n\`\`\``);
    }
  }

  const genes = useIngested ? MOCK_TEMPLATE_GENES_BLUE : MOCK_TEMPLATE_GENES;
  const styleGenes = useIngested ? MOCK_STYLE_GENES_BLUE : MOCK_STYLE_GENES;
  const constitution = useIngested ? MOCK_GLOBAL_CONSTITUTION_BLUE : MOCK_GLOBAL_CONSTITUTION;

  const layer0Mock = JSON.stringify(genes, null, 2);
  const layer1Mock = JSON.stringify(styleGenes, null, 2);
  const layer2Mock = JSON.stringify(constitution, null, 2);

  return (key: string) => {
    if (key === "layer0") return `\`\`\`json\n${layer0Mock}\n\`\`\``;
    if (key === "layer1") return `\`\`\`json\n${layer1Mock}\n\`\`\``;
    if (key === "layer2") return `\`\`\`json\n${layer2Mock}\n\`\`\``;
    if (key.startsWith("layer3:")) {
      const pageId = key.slice("layer3:".length);
      const page = plan.pages.find((p) => p.pageId === pageId);
      if (!page) return undefined;
      return `\`\`\`json\n${JSON.stringify(buildMockPageBrief(page), null, 2)}\n\`\`\``;
    }
    if (key.startsWith("layer4:")) {
      const rest = key.slice("layer4:".length);
      const pageId = rest.replace(/:retry$/, "");
      return pageHtmlMap.get(pageId);
    }
    return undefined;
  };
}

function pickExperimentHtmlPath(pageType: string, dir: string): string {
  switch (pageType) {
    case "cover":
      return join(dir, "p1-cover.html");
    case "toc":
      return join(dir, "p2-toc.html");
    case "comparison":
      return join(dir, "p3-comparison.html");
    case "timeline":
      return join(dir, "p4-timeline.html");
    default:
      return join(dir, `${pageType}.html`);
  }
}

function inlineDesignSystemCss(html: string, designSystemCss: string): string {
  const linkRe = /<link[^>]+href=["']00-design-system\.css["'][^>]*>/i;
  const styleBlock = `<style>\n${designSystemCss}\n</style>`;
  if (linkRe.test(html)) return html.replace(linkRe, styleBlock);
  return html.replace(/<\/head>/i, `${styleBlock}\n</head>`);
}

function buildMockPageBrief(page: PagePlan["pages"][number]): unknown {
  return {
    version: "page_brief/v1",
    pageId: page.pageId,
    pageType: page.pageType,
    intent: `Render the ${page.pageType} page for the wireless-network deck.`,
    primaryFocal: pageType2Focal(page.pageType),
    composition: pageType2Composition(page.pageType),
    whatToAvoid:
      "Generic AI-PPT aesthetics; centered title with green underline; hero photo background.",
    tone: "editorial / publication",
  };
}

function pageType2Focal(t: string): string {
  switch (t) {
    case "cover":
      return "Display title left, throughput data viz right.";
    case "toc":
      return "8-card grid with numbered badges.";
    case "comparison":
      return "Two-column comparison with green/warm tinted panels.";
    case "timeline":
      return "Horizontal flow with five evolution nodes and growth bars.";
    default:
      return "Single visual focal element.";
  }
}

function pageType2Composition(t: string): string {
  switch (t) {
    case "cover":
      return "Asymmetric — title block left, supporting data right.";
    case "toc":
      return "2x4 grid of cards.";
    case "comparison":
      return "Two equal columns; bottom synthesis bar.";
    case "timeline":
      return "Top: bar chart of throughput. Bottom: 5 evenly spaced labeled nodes.";
    default:
      return "Asymmetric editorial.";
  }
}

// ────────────────────────────────────────────────────────────────────────
// Mock JSON payloads (V1 editorial intent)
// ────────────────────────────────────────────────────────────────────────

const MOCK_TEMPLATE_GENES = {
  version: "template_genes/v1",
  source: { kind: "brief", brief: { version: "visual_brief/v1" } },
  summary:
    "Editorial light-with-green-accent design for a wireless-network technical deck. Off-white paper, jade-green single accent, serif display titles, generous space.",
  designTokens: {
    colors: {
      primary: "#0E8B5A",
      secondary: "#0A6B45",
      accents: ["#DCEFE5", "#C56B2C"],
      neutral: ["#FAFAF7", "#F1F5F2", "#0F1B17", "#6B7570"],
      bg: "#FAFAF7",
      surface: "#FFFFFF",
      text: "#0F1B17",
      textMuted: "#6B7570",
    },
    fonts: {
      titleLatin: "Source Han Serif SC",
      titleEa: "Source Han Serif SC",
      bodyLatin: "PingFang SC",
      bodyEa: "PingFang SC",
      mono: "JetBrains Mono",
    },
    rhythm: {
      density: "medium" as const,
      pagePadding: { x: 88, y: 64 },
      preferredLayoutGrammar: "asymmetric_editorial" as const,
    },
  },
};

const MOCK_STYLE_GENES = {
  version: "style_genes/v1",
  colorDna:
    "Use a single jade-green accent (#0E8B5A) sparingly; everything else is warm off-white surfaces and dark ink.",
  typographyDna:
    "Display serif (Source Han Serif SC) for titles; geometric sans (PingFang SC) for body and labels; monospace for English eyebrows and numbers.",
  shapeDna:
    "1px hairline borders, 14px soft radius, very subtle shadow only — no heavy drop shadows or gradient fills.",
  rhythmDna:
    "Generous breathing room with asymmetric layouts; one focal element per page; pages should feel ~40% empty.",
};

const MOCK_GLOBAL_CONSTITUTION = {
  version: "global_constitution/v1",
  rules: [
    "Use the jade green accent only on eyebrow tags, page-marker bars, badge fills, numerical highlights, and one callout per page max — never as solid background.",
    "Display serif for title only; sans for everything else; mono exclusively for English eyebrows and numbers.",
    "No icons unless they convey actual information; no emoji; no gradients; no decorative photo overlays.",
    "Information hierarchy uses both size AND color contrast at every level.",
    "When in doubt, remove. Pages should feel ~40% empty.",
    "Bottom-right page marker is faint, monospace, with an accent bar — acts as continuity signal across all pages.",
    "Do not center-justify Chinese paragraphs; use proper Chinese punctuation throughout.",
  ],
};

// ── BLUE BUSINESS variants — derived from ingested template (sample 2) ───

const MOCK_TEMPLATE_GENES_BLUE = {
  version: "template_genes/v1",
  source: {
    kind: "ingested_template",
    templateJsonPath:
      "/tmp/ppt-research/ingest-out/622eee2ab7e6e_110eb2/template.json",
  },
  summary:
    "蓝色商务复盘汇报风。深蓝 #2A5BAA + 绿 #91CF50 双主色 (来自 direct-usage 而非 override scheme)，多色辅助点缀 (#16A1C8/#09947F/#EDA81D)。无衬线粗体标题 (PingFang Bold)，信息密度中等偏高，年度汇报 vibe，顶部品牌色带作为锚点。",
  designTokens: {
    colors: {
      primary: "#2A5BAA",
      secondary: "#91CF50",
      accents: ["#16A1C8", "#09947F", "#EDA81D", "#E53661"],
      neutral: ["#FFFFFF", "#F4F6FA", "#0F1B33", "#5C6373"],
      bg: "#FFFFFF",
      surface: "#F4F6FA",
      text: "#0F1B33",
      textMuted: "#5C6373",
    },
    fonts: {
      titleLatin: "Calibri Light",
      titleEa: "PingFang SC",
      bodyLatin: "Calibri",
      bodyEa: "PingFang SC",
      mono: "Calibri",
    },
    rhythm: {
      density: "high" as const,
      pagePadding: { x: 80, y: 56 },
      preferredLayoutGrammar: "grid_corporate" as const,
    },
  },
};

const MOCK_STYLE_GENES_BLUE = {
  version: "style_genes/v1",
  colorDna:
    "Use #2A5BAA blue and #91CF50 green liberally as PRIMARY visual hierarchy — they are the actual designer-used colors per direct sRGB analysis. Cyan / teal / orange / pink appear in data viz contexts only, not as decoration.",
  typographyDna:
    "All sans-serif. PingFang Bold for titles, regular for body. No serif anywhere. Numbers and English labels use Calibri / mono for tabular feel.",
  shapeDna:
    "Sharper corners (4-8px radius), subtle 1px borders + small shadows. Use solid color blocks (filled headers, bottom strips) — not editorial-style hairline accents.",
  rhythmDna:
    "Grid-based, symmetric layouts. Information-dense (median 66KB per slide in source). 2-column / 4-quadrant grammars are the default; avoid editorial-level emptiness.",
};

const MOCK_GLOBAL_CONSTITUTION_BLUE = {
  version: "global_constitution/v1",
  rules: [
    "Top 6px gradient bar (deep-blue → cyan → green) is the brand anchor across all pages — never remove or vary it.",
    "Use #2A5BAA blue and #91CF50 green as primary visual hierarchy; cyan / teal / orange / pink only in data-viz contexts.",
    "All sans-serif typography. PingFang Bold for titles, PingFang regular for body. Mono / Calibri for English labels and numbers.",
    "Grid-based, symmetric layouts. Two-column / four-quadrant / horizontal flow are standard; avoid editorial asymmetry.",
    "Information density is medium-high — pages can carry 4-6 sub-elements; do not leave 40%+ empty.",
    "Page marker at bottom is a corporate footer with brand name + page number, not an editorial accent bar.",
    "Use proper Chinese punctuation. Mix Chinese title + English eyebrow tag for category framing.",
    "Charts / data viz can use the full multi-color accent set; non-data shapes stay within the primary blue/green pair.",
  ],
};

void main();
