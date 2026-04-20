/**
 * Gate 2 validator — confirms slot-map + fill-plan parse against schemas,
 * and every slot referenced in the fill-plan exists in the slot-map.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateTemplateSlotMap } from "./template-slot-map-schema";
import { validateTemplateFillPlan } from "./template-fill-plan-schema";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(MODULE_DIR, "../../../../../..");
const SLOT_MAP_SLIDE1 = resolve(
  REPO_ROOT,
  "docs/design/ppt-mvp/slot-maps/622eee2ab7e6e/slide1.slot-map.json",
);
const FILL_PLAN = resolve(
  REPO_ROOT,
  "docs/design/ppt-mvp/templates/wireless-template-fill-plan.json",
);

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function main() {
  const slotMap = validateTemplateSlotMap(readJson(SLOT_MAP_SLIDE1));
  if (!slotMap.valid || !slotMap.data) {
    console.error("[gate-2] slide1.slot-map.json INVALID:");
    for (const e of slotMap.errors ?? []) console.error("  ", e);
    process.exit(1);
  }
  console.log(
    `[gate-2] slide1.slot-map.json OK — ${slotMap.data.slots.length} slots, slide ${slotMap.data.slideIndex}`,
  );

  const fillPlan = validateTemplateFillPlan(readJson(FILL_PLAN));
  if (!fillPlan.valid || !fillPlan.data) {
    console.error("[gate-2] wireless-template-fill-plan.json INVALID:");
    for (const e of fillPlan.errors ?? []) console.error("  ", e);
    process.exit(1);
  }
  console.log(
    `[gate-2] wireless-template-fill-plan.json OK — ${fillPlan.data.pages.length} pages`,
  );

  const slotIds = new Set(slotMap.data.slots.map((s) => s.slotId));
  for (const page of fillPlan.data.pages) {
    if (page.sourceSlideIndex !== 1) continue;
    for (const a of page.slotAssignments) {
      if (!slotIds.has(a.slotId)) {
        console.error(
          `[gate-2] fill-plan references unknown slotId "${a.slotId}" on page ${page.pageId}`,
        );
        process.exit(1);
      }
    }
    for (const a of page.assetAssignments ?? []) {
      if (!slotIds.has(a.slotId)) {
        console.error(
          `[gate-2] fill-plan references unknown asset slotId "${a.slotId}" on page ${page.pageId}`,
        );
        process.exit(1);
      }
    }
  }
  console.log("[gate-2] cross-reference check OK — every slotId in fill-plan exists in slot-map");

  const creationIds = new Set(slotMap.data.slots.map((s) => s.selector.creationId));
  const spikeReport = readJson("/tmp/preserve-spike-report.json") as Record<
    string,
    Array<{ slideNumber: number; shapes: Array<{ creationId?: string }> }>
  >;
  const slide1Shapes = spikeReport.__preserve_template__.find((s) => s.slideNumber === 1);
  if (!slide1Shapes) {
    console.error("[gate-2] spike report missing slide 1 — rerun spike first");
    process.exit(1);
  }
  const actualCreationIds = new Set(
    slide1Shapes.shapes.map((sh) => sh.creationId).filter(Boolean) as string[],
  );
  for (const cid of creationIds) {
    if (!actualCreationIds.has(cid)) {
      console.error(`[gate-2] slot-map creationId "${cid}" not found in actual template shapes`);
      process.exit(1);
    }
  }
  console.log("[gate-2] creationId audit OK — every slot-map creationId exists in the actual template");
  console.log("[gate-2] ALL CHECKS PASSED");
}

main();
