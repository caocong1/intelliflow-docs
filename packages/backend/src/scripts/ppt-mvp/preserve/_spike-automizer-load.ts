/**
 * Gate 1 de-risking spike — do NOT ship.
 *
 * Goal: confirm pptx-automizer@0.8.1 can (a) load 622eee2ab7e6e.pptx,
 * (b) call setCreationIds() and return stable creationIds for shapes on
 * target slides (1, 2, 15, 21, 22, 24), (c) round-trip save without
 * corruption (unzip -t clean).
 *
 * If any assertion fails, we pivot to shapeName-based selectors before
 * authoring the slot-map.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ensureFixture } from "./fetch-template-fixture";

const TARGET_SLIDES = [1, 2, 15, 21, 22, 24];

async function main() {
  const templatePath = ensureFixture("622eee2ab7e6e.pptx");
  const templateBuffer = readFileSync(templatePath);
  console.log(`[spike] loaded fixture: ${templatePath} (${templateBuffer.byteLength} bytes)`);

  const { default: AutomizerCls } = await import("pptx-automizer");
  // useCreationIds=false so addSlide() accepts plain slide numbers.
  // Shape creationIds are still computed and reported by setCreationIds().
  const automizer = new AutomizerCls({
    templateDir: "",
    outputDir: "",
    removeExistingSlides: true,
    useCreationIds: false,
  });

  automizer.loadRoot(templateBuffer).load(templateBuffer, "__preserve_template__");
  const templateInfos = await automizer.setCreationIds();
  console.log(`[spike] setCreationIds() returned ${templateInfos.length} templates`);

  type SpikeShape = { name?: string; creationId?: string; type?: string; id?: string | number };
  type SpikeSlide = { slideNumber: number; slideId?: unknown; shapeCount: number; shapes: SpikeShape[] };
  const report: Record<string, SpikeSlide[]> = {};
  for (const tpl of templateInfos) {
    const slidesWithIds: SpikeSlide[] = [];
    for (const slide of tpl.slides ?? []) {
      if (!TARGET_SLIDES.includes(slide.number)) continue;
      const shapes: SpikeShape[] = (slide.elements ?? []).map((el: Record<string, unknown>) => ({
        name: el.name as string | undefined,
        creationId: el.creationId as string | undefined,
        type: el.type as string | undefined,
        id: el.id as string | number | undefined,
      }));
      slidesWithIds.push({
        slideNumber: slide.number,
        slideId: slide.id,
        shapeCount: shapes.length,
        shapes,
      });
    }
    report[tpl.name] = slidesWithIds;
  }
  const reportPath = "/tmp/preserve-spike-report.json";
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[spike] wrote per-slide shape dump to ${reportPath}`);
  console.log("[spike] target-slide shape summary:");
  for (const [tplName, slides] of Object.entries(report)) {
    for (const s of slides) {
      console.log(
        `  template="${tplName}" slide=${s.slideNumber} shapeCount=${s.shapeCount} slideId=${JSON.stringify(s.slideId)}`,
      );
    }
  }

  // Round-trip save, no modifications.
  for (const slideNum of TARGET_SLIDES) {
    automizer.addSlide("__preserve_template__", slideNum);
  }
  const zip = await automizer.getJSZip();
  const output = await zip.generateAsync({ type: "nodebuffer" });
  const outPath = "/tmp/preserve-spike-roundtrip.pptx";
  writeFileSync(outPath, Buffer.from(output));
  console.log(`[spike] round-trip wrote ${outPath} (${output.byteLength} bytes)`);
}

main().catch((err) => {
  console.error("[spike] FAILED:", err);
  process.exit(1);
});
