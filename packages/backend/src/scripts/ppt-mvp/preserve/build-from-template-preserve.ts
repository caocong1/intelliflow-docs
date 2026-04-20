/**
 * build-from-template-preserve.ts
 *
 * Preserve-mode PPT builder. Clones an original .pptx template and
 * replaces only text/image content inside identified slots. Does not
 * re-author layout or read native-template.json.
 *
 * CLI:
 *   bun build-from-template-preserve.ts \
 *     --fill-plan <path.json> \
 *     --out <output.pptx> \
 *     [--template <path.pptx>]      # override templatePath in fill-plan
 *     [--slot-map-dir <dir>]        # override slotMapDir in fill-plan
 *
 * Paths in the fill-plan JSON are relative to the fill-plan file.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  validateTemplateFillPlan,
  type TemplateFillPlan,
} from "./template-fill-plan-schema";
import {
  validateTemplateSlotMap,
  type TemplateSlotMap,
} from "./template-slot-map-schema";
import { type RewriteOutput, rewriteToFit } from "./rewrite-with-llm";
import {
  type FitResult,
  validateParagraphs,
  validateSingleLine,
} from "./text-width";
import { computeSafeStretch, extractSlideBboxes, type ShapeBbox } from "./safe-stretch";

type SlotEntry = TemplateSlotMap["slots"][number];
type Assignment = TemplateFillPlan["pages"][number]["slotAssignments"][number];

const MAX_REWRITE_ATTEMPTS = 2;

type PreserveSlideCallback = (slide: {
  modifyElement: (selector: { creationId?: string; name: string }, callback: unknown) => unknown;
}) => void;

type PreserveAutomizer = {
  loadRoot: (buf: Buffer) => PreserveAutomizer;
  load: (buf: Buffer, name: string) => PreserveAutomizer;
  setCreationIds: () => Promise<unknown>;
  addSlide: (templateName: string, slideNumber: number, callback?: PreserveSlideCallback) => PreserveAutomizer;
  getJSZip: () => Promise<{ generateAsync: (opts: { type: "nodebuffer" }) => Promise<ArrayBuffer> }>;
};

export type BuildPreserveArgs = {
  fillPlanPath: string;
  outPath: string;
  templateOverride?: string;
  slotMapDirOverride?: string;
  /** When true, overflow triggers an error instead of LLM rewrite. Useful for CI. */
  strict?: boolean;
  /**
   * Mock responses keyed by slotId. When present for a slot, the rewrite
   * call uses the canned response instead of hitting the live API. Used
   * by tests and by deterministic offline runs.
   */
  rewriteMocks?: Record<string, string>;
};

export type BuildPreserveResult = {
  outPath: string;
  templatePath: string;
  pageCount: number;
  replacedSlotCount: number;
  preservedSlotCount: number;
  rewrittenSlotCount: number;
  rewrites: Array<{ pageId: string; slotId: string; before: string; after: string }>;
};

function formatValue(assignment: Assignment): string {
  if (assignment.value !== undefined) return assignment.value;
  if (assignment.paragraphs) return assignment.paragraphs.map((p) => p.text).join(" / ");
  return "";
}

function validateAssignment(slot: SlotEntry, assignment: Assignment): FitResult {
  const maxLines = slot.maxLines ?? 1;
  const maxWidthUnits = slot.maxWidthUnits;
  if (maxWidthUnits === undefined) return { fits: true };

  if (slot.replaceStrategy === "replace_text" || maxLines === 1) {
    const value =
      assignment.value ?? assignment.paragraphs?.map((p) => p.text).join("") ?? "";
    return validateSingleLine(value, maxWidthUnits);
  }

  if (slot.replaceStrategy === "replace_runs") {
    const paragraphs = assignment.paragraphs
      ?? (assignment.value !== undefined ? [{ text: assignment.value }] : []);
    return validateParagraphs(paragraphs, maxWidthUnits, maxLines);
  }

  return { fits: true };
}

function applyRewrite(assignment: Assignment, rewrite: RewriteOutput): Assignment {
  if (rewrite.paragraphs && rewrite.paragraphs.length > 0) {
    return { slotId: assignment.slotId, paragraphs: rewrite.paragraphs };
  }
  if (rewrite.value !== undefined) {
    return { slotId: assignment.slotId, value: rewrite.value };
  }
  return assignment;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadFillPlan(fillPlanPath: string): {
  fillPlan: TemplateFillPlan;
  fillPlanDir: string;
} {
  const raw = readJson(fillPlanPath);
  const result = validateTemplateFillPlan(raw);
  if (!result.valid || !result.data) {
    throw new Error(
      `fill-plan ${fillPlanPath} is invalid:\n${(result.errors ?? []).map((e) => `  ${e}`).join("\n")}`,
    );
  }
  return { fillPlan: result.data, fillPlanDir: dirname(resolve(fillPlanPath)) };
}

function loadSlotMaps(slotMapDir: string, slideIndices: number[]): Map<number, TemplateSlotMap> {
  const out = new Map<number, TemplateSlotMap>();
  for (const idx of slideIndices) {
    const path = resolve(slotMapDir, `slide${idx}.slot-map.json`);
    const raw = readJson(path);
    const result = validateTemplateSlotMap(raw);
    if (!result.valid || !result.data) {
      throw new Error(
        `slot-map ${path} is invalid:\n${(result.errors ?? []).map((e) => `  ${e}`).join("\n")}`,
      );
    }
    if (result.data.slideIndex !== idx) {
      throw new Error(
        `slot-map ${path} declares slideIndex=${result.data.slideIndex} but filename says ${idx}`,
      );
    }
    out.set(idx, result.data);
  }
  return out;
}

export async function buildFromTemplatePreserve(
  args: BuildPreserveArgs,
): Promise<BuildPreserveResult> {
  const { fillPlan, fillPlanDir } = loadFillPlan(args.fillPlanPath);
  const templatePath = args.templateOverride
    ? resolve(args.templateOverride)
    : resolve(fillPlanDir, fillPlan.templatePath);
  const slotMapDir = args.slotMapDirOverride
    ? resolve(args.slotMapDirOverride)
    : resolve(fillPlanDir, fillPlan.slotMapDir);

  const slideIndices = Array.from(new Set(fillPlan.pages.map((p) => p.sourceSlideIndex)));
  const slotMaps = loadSlotMaps(slotMapDir, slideIndices);

  const templateBuffer = readFileSync(templatePath);

  const automizerModule = (await import("pptx-automizer")) as unknown as {
    default: new (opts: {
      templateDir: string;
      outputDir: string;
      removeExistingSlides: boolean;
      useCreationIds: boolean;
    }) => PreserveAutomizer;
    modify: {
      setText: (value: string) => unknown;
      setMultiText: (paragraphs: Array<{ text: string } & Record<string, unknown>>) => unknown;
      setRelationTarget: (filename: string) => unknown;
      updatePosition: (pos: { x?: number; y?: number; cx?: number; cy?: number }) => unknown;
    };
  };
  const { default: AutomizerCls, modify } = automizerModule;

  // Custom callback: walk every <a:rPr> in the shape and set `sz` attribute.
  // Bypasses automizer's ModifyTextHelper.setSize which only works on a single rPr.
  type XmlNode = {
    getElementsByTagName: (tag: string) => { length: number; item: (i: number) => XmlNode | null };
    setAttribute: (name: string, value: string) => void;
  };
  const setShapeFontSize = (pt: number) => (shape: XmlNode) => {
    const rPrs = shape.getElementsByTagName("a:rPr");
    for (let i = 0; i < rPrs.length; i += 1) {
      const node = rPrs.item(i);
      if (node) node.setAttribute("sz", String(pt * 100));
    }
    const endParaRPrs = shape.getElementsByTagName("a:endParaRPr");
    for (let i = 0; i < endParaRPrs.length; i += 1) {
      const node = endParaRPrs.item(i);
      if (node) node.setAttribute("sz", String(pt * 100));
    }
  };

  const automizer = new AutomizerCls({
    templateDir: "",
    outputDir: "",
    removeExistingSlides: true,
    useCreationIds: false,
  });

  const TEMPLATE_NAME = "__preserve_template__";
  automizer.loadRoot(templateBuffer).load(templateBuffer, TEMPLATE_NAME);
  await automizer.setCreationIds();

  let replaced = 0;
  let preserved = 0;
  let rewrittenCount = 0;
  const rewrites: BuildPreserveResult["rewrites"] = [];

  for (const page of fillPlan.pages) {
    if (page.mode !== "preserve") {
      throw new Error(`unsupported mode "${page.mode}" on page ${page.pageId}`);
    }
    const slotMap = slotMaps.get(page.sourceSlideIndex);
    if (!slotMap) {
      throw new Error(`slot-map missing for slide ${page.sourceSlideIndex}`);
    }
    // Pre-flight topology check: fail loudly on page_type/slide mismatch.
    // Only enforced when fill-plan declares expectedTopology AND slot-map
    // declares topology. Missing either = author opt-out, builder proceeds.
    if (page.expectedTopology && slotMap.topology) {
      if (page.expectedTopology !== slotMap.topology) {
        throw new Error(
          `page "${page.pageId}" expects topology "${page.expectedTopology}" but slide ${slotMap.slideIndex}'s slot-map declares "${slotMap.topology}". See docs/design/ppt-three.md §page_type-topology for required mappings.`,
        );
      }
    }

    // Safe-stretch pre-flight: for each slot with widthStretchEmu/heightStretchEmu,
    // scan the actual slide XML for neighbor shapes and throw if the stretch
    // would collide. Only run once per unique sourceSlideIndex per build.
    const slotsNeedingStretchCheck = slotMap.slots.filter(
      (s) => (s.widthStretchEmu && s.widthStretchEmu > 0) || (s.heightStretchEmu && s.heightStretchEmu > 0),
    );
    if (slotsNeedingStretchCheck.length > 0) {
      const slideXmlForCheck = await (async () => {
        const { default: JSZip } = await import("jszip");
        const zip = await JSZip.loadAsync(templateBuffer);
        const f = zip.file(`ppt/slides/slide${page.sourceSlideIndex}.xml`);
        return f ? await f.async("string") : "";
      })();
      const allBboxes: ShapeBbox[] = extractSlideBboxes(slideXmlForCheck);
      for (const slot of slotsNeedingStretchCheck) {
        if (!slot.bbox) continue;
        const self: ShapeBbox = {
          name: slot.selector.name,
          creationId: slot.selector.creationId,
          x: slot.bbox.x,
          y: slot.bbox.y,
          w: slot.bbox.w,
          h: slot.bbox.h,
        };
        if (slot.widthStretchEmu && slot.widthStretchEmu > 0) {
          const conflict = computeSafeStretch(self, allBboxes, "x", slot.widthStretchEmu);
          if (conflict) {
            throw new Error(
              `slot "${slot.slotId}" on page ${page.pageId} widthStretchEmu=${slot.widthStretchEmu} exceeds safe delta ${conflict.maxSafeDeltaEmu} — would collide with shape "${conflict.conflictingShape.name}" (x=${conflict.conflictingShape.x}).`,
            );
          }
        }
        if (slot.heightStretchEmu && slot.heightStretchEmu > 0) {
          const conflict = computeSafeStretch(self, allBboxes, "y", slot.heightStretchEmu);
          if (conflict) {
            throw new Error(
              `slot "${slot.slotId}" on page ${page.pageId} heightStretchEmu=${slot.heightStretchEmu} exceeds safe delta ${conflict.maxSafeDeltaEmu} — would collide with shape "${conflict.conflictingShape.name}" (y=${conflict.conflictingShape.y}).`,
            );
          }
        }
      }
    }
    const slotById = new Map(slotMap.slots.map((s) => [s.slotId, s]));
    const assignedIds = new Set<string>();
    for (const a of page.slotAssignments) assignedIds.add(a.slotId);
    for (const a of page.assetAssignments ?? []) assignedIds.add(a.slotId);

    // Tripwire: fail loudly if the plan references a missing slot.
    for (const id of assignedIds) {
      if (!slotById.has(id)) {
        throw new Error(
          `fill-plan page ${page.pageId} references missing slotId "${id}" (slot-map slide ${slotMap.slideIndex})`,
        );
      }
    }

    // Width/line-count validation + optional LLM rewrite. Must run BEFORE
    // addSlide because the automizer callback is sync and we can't await
    // an LLM call inside it.
    const resolvedAssignments: Assignment[] = [];
    for (const original of page.slotAssignments) {
      const slot = slotById.get(original.slotId);
      if (!slot) {
        resolvedAssignments.push(original);
        continue;
      }

      let current = original;
      let attempt = 0;
      while (attempt <= MAX_REWRITE_ATTEMPTS) {
        const fit = validateAssignment(slot, current);
        if (fit.fits) {
          resolvedAssignments.push(current);
          break;
        }

        const reasons = fit.violations.map((v) => v.reason).join("; ");
        const summary = `slot "${slot.slotId}" on page ${page.pageId} over budget: ${reasons}`;

        if (args.strict) {
          throw new Error(`${summary} (strict mode — not rewriting)`);
        }
        if (attempt === MAX_REWRITE_ATTEMPTS) {
          throw new Error(
            `${summary}. LLM rewrite failed to fit after ${MAX_REWRITE_ATTEMPTS + 1} attempt(s).`,
          );
        }

        const maxWidthUnits = slot.maxWidthUnits;
        if (maxWidthUnits === undefined) {
          // Shouldn't happen — validateAssignment would have returned fits: true.
          resolvedAssignments.push(current);
          break;
        }

        const before = formatValue(current);
        console.warn(`[preserve] ${summary}. Calling LLM rewrite (attempt ${attempt + 1})...`);
        const mockResponse = args.rewriteMocks?.[slot.slotId];
        const rewrite = await rewriteToFit(
          {
            slotId: slot.slotId,
            slotType: slot.slotType,
            maxWidthUnits,
            maxLines: slot.maxLines ?? 1,
            originalValue: current.value,
            originalParagraphs: current.paragraphs,
          },
          { mockResponse, mock: mockResponse !== undefined },
        );
        current = applyRewrite(current, rewrite);
        const after = formatValue(current);
        rewrites.push({ pageId: page.pageId, slotId: slot.slotId, before, after });
        rewrittenCount += 1;
        attempt += 1;
      }
    }

    automizer.addSlide(TEMPLATE_NAME, page.sourceSlideIndex, (slide) => {
      for (const assignment of resolvedAssignments) {
        const slot = slotById.get(assignment.slotId);
        if (!slot) continue;
        // pptx-automizer's findByCreationId matches against the XML attribute
        // `id="{UUID}"` literally, so the selector's creationId must include
        // braces. Slot-map files keep the bare UUID (matching setCreationIds'
        // return format); we wrap here.
        const rawId = slot.selector.creationId;
        const braced = rawId.startsWith("{") ? rawId : `{${rawId}}`;
        const selector = { creationId: braced, name: slot.selector.name };

        const extraCallbacks: unknown[] = [];
        if (slot.widthStretchEmu || slot.heightStretchEmu) {
          extraCallbacks.push(
            modify.updatePosition({
              cx: slot.widthStretchEmu ?? 0,
              cy: slot.heightStretchEmu ?? 0,
            }),
          );
        }
        if (slot.minFontPt) {
          extraCallbacks.push(setShapeFontSize(slot.minFontPt));
        }

        switch (slot.replaceStrategy) {
          case "replace_text": {
            if (assignment.value === undefined) {
              throw new Error(
                `slot "${slot.slotId}" uses replace_text but no value provided on page ${page.pageId}`,
              );
            }
            slide.modifyElement(selector, [modify.setText(assignment.value), ...extraCallbacks]);
            replaced += 1;
            break;
          }
          case "replace_runs": {
            const paragraphs = assignment.paragraphs
              ?? (assignment.value !== undefined ? [{ text: assignment.value }] : null);
            if (!paragraphs) {
              throw new Error(
                `slot "${slot.slotId}" uses replace_runs but no paragraphs/value provided on page ${page.pageId}`,
              );
            }
            slide.modifyElement(selector, [modify.setMultiText(paragraphs), ...extraCallbacks]);
            replaced += 1;
            break;
          }
          case "replace_image": {
            throw new Error(
              `slot "${slot.slotId}" on page ${page.pageId} requested replace_image — deferred to Session 2 (use 'preserve' for now)`,
            );
          }
          case "grouped_merge": {
            throw new Error(
              `slot "${slot.slotId}" on page ${page.pageId} requested grouped_merge — deferred to Session 2 (p2 TOC compression)`,
            );
          }
          case "preserve": {
            preserved += 1;
            break;
          }
          default: {
            throw new Error(
              `unknown replaceStrategy "${slot.replaceStrategy}" on slot "${slot.slotId}"`,
            );
          }
        }
      }
    });
  }

  const zip = await automizer.getJSZip();
  const output = await zip.generateAsync({ type: "nodebuffer" });
  writeFileSync(args.outPath, Buffer.from(output));

  return {
    outPath: args.outPath,
    templatePath,
    pageCount: fillPlan.pages.length,
    replacedSlotCount: replaced,
    preservedSlotCount: preserved,
    rewrittenSlotCount: rewrittenCount,
    rewrites,
  };
}

function parseCliArgs(argv: string[]): BuildPreserveArgs {
  const args: Partial<BuildPreserveArgs> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === "--fill-plan") {
      args.fillPlanPath = next;
      i += 1;
    } else if (flag === "--out") {
      args.outPath = next;
      i += 1;
    } else if (flag === "--template") {
      args.templateOverride = next;
      i += 1;
    } else if (flag === "--slot-map-dir") {
      args.slotMapDirOverride = next;
      i += 1;
    }
  }
  if (!args.fillPlanPath || !args.outPath) {
    throw new Error(
      "usage: build-from-template-preserve --fill-plan <path> --out <path.pptx> [--template <path>] [--slot-map-dir <dir>]",
    );
  }
  return args as BuildPreserveArgs;
}

if (import.meta.main) {
  const cli = parseCliArgs(process.argv.slice(2));
  buildFromTemplatePreserve(cli)
    .then((result) => {
      console.log(
        `[preserve] wrote ${result.outPath}\n` +
          `  template: ${result.templatePath}\n` +
          `  pages: ${result.pageCount}\n` +
          `  replaced slots: ${result.replacedSlotCount}\n` +
          `  preserved slots: ${result.preservedSlotCount}\n` +
          `  LLM-rewritten slots: ${result.rewrittenSlotCount}`,
      );
      for (const r of result.rewrites) {
        console.log(`    rewrite[${r.pageId}/${r.slotId}]: ${r.before} → ${r.after}`);
      }
    })
    .catch((err) => {
      console.error("[preserve] FAILED:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
