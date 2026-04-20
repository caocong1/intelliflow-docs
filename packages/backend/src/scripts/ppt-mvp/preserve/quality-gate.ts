/**
 * Preserve-mode quality gate.
 *
 * Runs AFTER the build completes and verifies the output .pptx matches
 * the fill-plan's intent. Catches silent failures where a modifyElement
 * call didn't actually mutate anything (e.g., the creationId brace bug
 * from Session 3 where replace_runs found no target and left original
 * text intact).
 *
 * Checks:
 *   1. sldIdLst has exactly the expected slide count
 *   2. Every replace_text / replace_runs slot actually changed the
 *      shape's text content compared to the original slide
 *   3. Every preserve slot still has its original text (no accidental
 *      mutation)
 *   4. Every internal rel target resolves (delegates to verify-pptx-rels)
 *
 * CLI:
 *   bun quality-gate.ts <output.pptx> --template <template.pptx>
 *     --fill-plan <path> --slot-map-dir <dir>
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  validateTemplateFillPlan,
  type TemplateFillPlan,
} from "./template-fill-plan-schema";
import {
  validateTemplateSlotMap,
  type TemplateSlotMap,
} from "./template-slot-map-schema";
import { verifyPptxRelationships } from "./verify-pptx-relationships";

type JSZipType = {
  loadAsync: (buf: Buffer) => Promise<JSZipInstance>;
};
type JSZipInstance = {
  file: (path: string) => { async: (encoding: "string") => Promise<string> } | null;
  files: Record<string, unknown>;
};

export type QualityGateReport = {
  ok: boolean;
  perPage: Array<{
    pageId: string;
    outputSlideIndex: number;
    topologyOk: boolean;
    replacedOk: number;
    replacedSilentFail: Array<{ slotId: string; reason: string }>;
    preserveDrift: Array<{ slotId: string; reason: string }>;
  }>;
  slideCountOk: boolean;
  relationshipsOk: boolean;
  errors: string[];
};

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function findShapeTextByCreationId(
  slideXml: string,
  creationId: string,
): string | null {
  const wanted = creationId.startsWith("{") ? creationId : `{${creationId}}`;
  const shapeRe = /<p:sp\b[\s\S]*?<\/p:sp>/g;
  for (const m of slideXml.matchAll(shapeRe)) {
    if (!m[0].includes(`id="${wanted}"`)) continue;
    const texts = [...m[0].matchAll(/<a:t\b[^>]*>([^<]*)<\/a:t>/g)].map((x) => x[1]);
    return texts.join("\n");
  }
  return null;
}

export async function runQualityGate(opts: {
  outputPath: string;
  templatePath: string;
  fillPlanPath: string;
  slotMapDirOverride?: string;
}): Promise<QualityGateReport> {
  const { default: JSZip } = (await import("jszip")) as { default: JSZipType };

  const rawPlan = readJson(opts.fillPlanPath);
  const planResult = validateTemplateFillPlan(rawPlan);
  if (!planResult.valid || !planResult.data) {
    throw new Error(`fill-plan invalid: ${JSON.stringify(planResult.errors)}`);
  }
  const fillPlan: TemplateFillPlan = planResult.data;

  const slotMapDir = opts.slotMapDirOverride
    ? resolve(opts.slotMapDirOverride)
    : resolve(dirname(resolve(opts.fillPlanPath)), fillPlan.slotMapDir);

  const report: QualityGateReport = {
    ok: true,
    perPage: [],
    slideCountOk: true,
    relationshipsOk: true,
    errors: [],
  };

  const outputZip = await JSZip.loadAsync(readFileSync(opts.outputPath));
  const templateZip = await JSZip.loadAsync(readFileSync(opts.templatePath));
  const presXml = await outputZip.file("ppt/presentation.xml")?.async("string");

  // 1. sldIdLst count matches page count.
  const sldIdCount = presXml ? (presXml.match(/<p:sldId\b[^/]*\/>/g) ?? []).length : 0;
  if (sldIdCount !== fillPlan.pages.length) {
    report.slideCountOk = false;
    report.errors.push(
      `sldIdLst has ${sldIdCount} slides but fill-plan declares ${fillPlan.pages.length} pages`,
    );
  }

  // 2/3. Per-page slot verification.
  // Output slide indices: automizer appends to templateSlides + 1, 2, etc.
  // We derive by scanning slide XML files in descending index and matching
  // by mtime / presence. Simpler: slideN.xml for N > templateSlideCount is
  // our output. Hardcode templateSlideCount = count of slide XMLs in template.
  const templateSlideCount = Object.keys(templateZip.files)
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .length;

  for (let i = 0; i < fillPlan.pages.length; i += 1) {
    const page = fillPlan.pages[i];
    const outputSlideIndex = templateSlideCount + i + 1;
    const pageReport: QualityGateReport["perPage"][number] = {
      pageId: page.pageId,
      outputSlideIndex,
      topologyOk: true,
      replacedOk: 0,
      replacedSilentFail: [],
      preserveDrift: [],
    };

    const slotMapPath = resolve(slotMapDir, `slide${page.sourceSlideIndex}.slot-map.json`);
    const slotMapResult = validateTemplateSlotMap(readJson(slotMapPath));
    if (!slotMapResult.valid || !slotMapResult.data) {
      report.errors.push(`slot-map invalid: ${slotMapPath}`);
      report.ok = false;
      continue;
    }
    const slotMap: TemplateSlotMap = slotMapResult.data;
    if (page.expectedTopology && slotMap.topology && page.expectedTopology !== slotMap.topology) {
      pageReport.topologyOk = false;
      report.errors.push(
        `topology mismatch page=${page.pageId} expected=${page.expectedTopology} got=${slotMap.topology}`,
      );
    }

    const templateSlideXml =
      (await templateZip.file(`ppt/slides/slide${page.sourceSlideIndex}.xml`)?.async("string")) ?? "";
    const outputSlideXml =
      (await outputZip.file(`ppt/slides/slide${outputSlideIndex}.xml`)?.async("string")) ?? "";

    const assignedIds = new Set(page.slotAssignments.map((a) => a.slotId));
    const slotById = new Map(slotMap.slots.map((s) => [s.slotId, s]));

    // (2) Check assignments actually changed content.
    for (const assignment of page.slotAssignments) {
      const slot = slotById.get(assignment.slotId);
      if (!slot) continue;
      if (slot.replaceStrategy !== "replace_text" && slot.replaceStrategy !== "replace_runs") {
        continue;
      }
      const original = findShapeTextByCreationId(templateSlideXml, slot.selector.creationId) ?? "";
      const rendered = findShapeTextByCreationId(outputSlideXml, slot.selector.creationId) ?? "";
      const expected =
        assignment.value ??
        (assignment.paragraphs?.map((p) => p.text).join("\n") ?? "");
      if (rendered === original && rendered !== expected) {
        pageReport.replacedSilentFail.push({
          slotId: assignment.slotId,
          reason: "output text unchanged from template (selector may not have matched)",
        });
      } else {
        pageReport.replacedOk += 1;
      }
    }

    // (3) Check preserve slots still have original text.
    for (const slot of slotMap.slots) {
      if (assignedIds.has(slot.slotId)) continue;
      if (slot.replaceStrategy !== "preserve") continue;
      if (slot.kind !== "text") continue;
      const original = findShapeTextByCreationId(templateSlideXml, slot.selector.creationId) ?? "";
      const rendered = findShapeTextByCreationId(outputSlideXml, slot.selector.creationId) ?? "";
      if (rendered !== original) {
        pageReport.preserveDrift.push({
          slotId: slot.slotId,
          reason: `text changed despite preserve strategy (was ${JSON.stringify(original.slice(0, 40))}, now ${JSON.stringify(rendered.slice(0, 40))})`,
        });
      }
    }

    if (pageReport.replacedSilentFail.length > 0 || pageReport.preserveDrift.length > 0 || !pageReport.topologyOk) {
      report.ok = false;
    }
    report.perPage.push(pageReport);
  }

  // 4. Relationship integrity.
  const broken = await verifyPptxRelationships(opts.outputPath);
  if (broken.length > 0) {
    report.relationshipsOk = false;
    report.ok = false;
    for (const b of broken) {
      report.errors.push(`broken rel ${b.relsFile}#${b.relId} → ${b.resolvedTarget}`);
    }
  }

  return report;
}

function parseCli(argv: string[]): {
  outputPath: string;
  templatePath: string;
  fillPlanPath: string;
  slotMapDirOverride?: string;
} {
  const out: Partial<{
    outputPath: string;
    templatePath: string;
    fillPlanPath: string;
    slotMapDirOverride?: string;
  }> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--template") out.templatePath = argv[++i];
    else if (a === "--fill-plan") out.fillPlanPath = argv[++i];
    else if (a === "--slot-map-dir") out.slotMapDirOverride = argv[++i];
    else positional.push(a);
  }
  if (!positional[0] || !out.templatePath || !out.fillPlanPath) {
    throw new Error(
      "usage: quality-gate <output.pptx> --template <pptx> --fill-plan <json> [--slot-map-dir <dir>]",
    );
  }
  return { outputPath: positional[0], templatePath: out.templatePath, fillPlanPath: out.fillPlanPath, slotMapDirOverride: out.slotMapDirOverride };
}

if (import.meta.main) {
  const cli = parseCli(process.argv.slice(2));
  runQualityGate(cli)
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!report.ok) process.exit(1);
    })
    .catch((err) => {
      console.error("[quality-gate] FAILED:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
