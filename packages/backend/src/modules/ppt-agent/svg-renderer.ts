import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type SlideColors,
  padSlideNumber,
  renderAgendaSlide,
  renderArchitectureSlide,
  renderCapabilitySlide,
  renderChartSlide,
  renderClosingSlide,
  renderComparisonSlide,
  renderContactSlide,
  renderContentSlide,
  renderCoverSlide,
  renderMetricsSlide,
  renderProblemSlide,
  renderProcessSlide,
  renderQuoteSlide,
  renderRiskGovernanceSlide,
  renderRoadmapSlide,
  renderScenarioSlide,
  renderSectionSlide,
  renderStrategySlide,
  renderSummarySlide,
  renderTableSlide,
  renderTeamSlide,
  renderTimelineSlide,
  slideColors,
} from "./svg-templates";
import type { DeckPlan, DeckSlide, RenderedPpt, VisualAsset } from "./types";

type RenderFn = (
  slidePlan: DeckSlide,
  colors: SlideColors,
  index: number,
  visual?: VisualAsset,
) => string;

const RENDER_MAP = new Map<DeckSlide["pageType"], RenderFn>([
  ["cover", (s, c, _i, v) => renderCoverSlide(s, c, v)],
  ["agenda", (s, c) => renderAgendaSlide(s, c)],
  ["section", (s, c, _i, v) => renderSectionSlide(s, c, v)],
  ["closing", (s, c, _i, v) => renderClosingSlide(s, c, v)],
  ["problem", (s, c, i) => renderProblemSlide(s, c, i)],
  ["strategy", (s, c, i, v) => renderStrategySlide(s, c, i, v)],
  ["architecture", (s, c, i) => renderArchitectureSlide(s, c, i)],
  ["capability", (s, c, i) => renderCapabilitySlide(s, c, i)],
  ["governance", (s, c, i) => renderRiskGovernanceSlide(s, c, i)],
  ["risk", (s, c, i) => renderRiskGovernanceSlide(s, c, i)],
  ["scenario", (s, c, i) => renderScenarioSlide(s, c, i)],
  ["timeline", (s, c, i) => renderTimelineSlide(s, c, i)],
  ["metrics", (s, c, i) => renderMetricsSlide(s, c, i)],
  ["table", (s, c, i) => renderTableSlide(s, c, i)],
  ["summary", (s, c, i, v) => renderSummarySlide(s, c, i, v)],
  ["comparison", (s, c, i, v) => renderComparisonSlide(s, c, i, v)],
  ["process", (s, c, i) => renderProcessSlide(s, c, i)],
  ["roadmap", (s, c, i) => renderRoadmapSlide(s, c, i)],
  ["team", (s, c, i, v) => renderTeamSlide(s, c, i, v)],
  ["quote", (s, c, i, v) => renderQuoteSlide(s, c, i, v)],
  ["chart", (s, c, i) => renderChartSlide(s, c, i)],
  ["contact", (s, c, i, v) => renderContactSlide(s, c, i, v)],
]);

export type SvgArtifact = {
  slideId: string;
  pageType: DeckSlide["pageType"];
  filename: string;
  svg: string;
};

function renderSvgSlide(
  _deckPlan: DeckPlan,
  slidePlan: DeckSlide,
  visual: VisualAsset | undefined,
  colors: SlideColors,
  index: number,
): string {
  const fn = RENDER_MAP.get(slidePlan.pageType);
  if (fn) return fn(slidePlan, colors, index, visual);
  return renderContentSlide(slidePlan, colors, index, visual);
}

export function buildSvgArtifacts(deckPlan: DeckPlan, visuals: VisualAsset[]): SvgArtifact[] {
  const visualMap = new Map(visuals.map((v) => [v.slideId, v]));
  return deckPlan.slides.map((slidePlan, index) => {
    const colors = slideColors(deckPlan.theme.palette, index);
    const visual = visualMap.get(slidePlan.id);
    const svg = renderSvgSlide(deckPlan, slidePlan, visual, colors, index);
    const filename = `${padSlideNumber(index + 1, deckPlan.slides.length)}_${slidePlan.pageType}.svg`;
    return {
      slideId: slidePlan.id,
      pageType: slidePlan.pageType,
      filename,
      svg,
    };
  });
}

// --- Python venv warm-up ---
let venvWarmed = false;

function getPythonPaths() {
  const scriptDir = join(process.cwd(), "scripts", "ppt-master");
  return {
    pythonPath: join(scriptDir, ".venv", "bin", "python3"),
    scriptPath: join(scriptDir, "svg_to_pptx.py"),
  };
}

async function warmPythonVenv(): Promise<void> {
  if (venvWarmed) return;
  const { pythonPath } = getPythonPaths();
  const proc = Bun.spawn(
    [pythonPath, "-c", "import pptx; import cairosvg; import lxml; print('warm')"],
    { stdout: "pipe", stderr: "pipe" },
  );
  const exitCode = await proc.exited;
  if (exitCode === 0) venvWarmed = true;
}

export async function renderDeckToSvgPptx(
  deckPlan: DeckPlan,
  visuals: VisualAsset[],
): Promise<RenderedPpt> {
  const tmpDir = await mkdtemp(join(tmpdir(), "ppt-svg-"));
  const svgDir = join(tmpDir, "svg_output");
  await mkdir(svgDir, { recursive: true });

  const warnings: string[] = [];

  try {
    const artifacts = buildSvgArtifacts(deckPlan, visuals);
    const writes = artifacts.map((artifact) =>
      writeFile(join(svgDir, artifact.filename), artifact.svg, "utf-8"),
    );
    const [, ...rest] = await Promise.all([warmPythonVenv(), ...writes]);
    void rest;

    const outputPath = join(tmpDir, "output.pptx");
    const { pythonPath, scriptPath } = getPythonPaths();

    const proc = Bun.spawn(
      [
        pythonPath,
        scriptPath,
        tmpDir,
        "-s",
        "svg_output",
        "-o",
        outputPath,
        "-t",
        "fade",
        "-a",
        "auto",
        "--no-compat",
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    if (exitCode !== 0) {
      throw new Error(`SVG to PPTX conversion failed (exit ${exitCode}): ${stderr}`);
    }

    const buffer = Buffer.from(await Bun.file(outputPath).arrayBuffer());
    return { buffer, warnings };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
