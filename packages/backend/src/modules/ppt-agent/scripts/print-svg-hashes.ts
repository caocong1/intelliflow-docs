import { renderContactSlide, renderQuoteSlide, slideColors } from "../svg-templates";
import { SVG_HASH_SNAPSHOTS } from "../test-helpers/svg-hash-snapshots";
import { makeSvgSlide, svgStableHash, tinyPngDataUri } from "../test-helpers/svg-test-helpers";

function main() {
  const checkMode = process.argv.includes("--check");
  const colors = slideColors(["3E4C3A", "A65F32", "E7D7B8", "243128", "F5F0E8"], 0);

  const quoteSvg = renderQuoteSlide(makeSvgSlide("quote"), colors, 0, {
    slideId: "q",
    dataUri: tinyPngDataUri(),
    source: "fallback",
  });
  const contactSvg = renderContactSlide(makeSvgSlide("contact"), colors, 0, {
    slideId: "c",
    dataUri: tinyPngDataUri(),
    source: "fallback",
  });

  const quoteHash = svgStableHash(quoteSvg);
  const contactHash = svgStableHash(contactSvg);
  console.log(`quote   current=${quoteHash} snapshot=${SVG_HASH_SNAPSHOTS.quote}`);
  console.log(`contact current=${contactHash} snapshot=${SVG_HASH_SNAPSHOTS.contact}`);

  if (checkMode) {
    const mismatches: string[] = [];
    if (quoteHash !== SVG_HASH_SNAPSHOTS.quote) mismatches.push("quote");
    if (contactHash !== SVG_HASH_SNAPSHOTS.contact) mismatches.push("contact");
    if (mismatches.length > 0) {
      throw new Error(`SVG hash snapshot mismatch: ${mismatches.join(", ")}`);
    }
    console.log("hash check passed");
  }
}

main();
