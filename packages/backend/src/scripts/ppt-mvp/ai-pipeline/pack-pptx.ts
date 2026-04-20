/**
 * Pack rendered PNG slides + speaker notes into a .pptx file.
 *
 * Uses pptxgenjs (already in deps) in image-backed mode: each slide is one
 * full-bleed PNG plus the speaker note in the notesSlide.  Native editable
 * elements (text shapes, charts) are NOT generated here — that is the
 * separate "native_editable" export path planned for a later iteration.
 */

import { mkdir } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
// pptxgenjs ships CJS; default import works in Bun + ESM
import PptxGenJS from "pptxgenjs";

export type SlidePack = {
  /** Path to the PNG to embed full-bleed. */
  pngPath: string;
  /** Speaker note text (may be empty). */
  speakerNote: string;
};

export type PackPptxOptions = {
  slides: SlidePack[];
  outputPath: string;
  /** Deck title written into PPT core properties. */
  title?: string;
  /** Optional subject / company / author for core properties. */
  subject?: string;
  author?: string;
  company?: string;
};

const SLIDE_WIDTH_IN = 13.333;
const SLIDE_HEIGHT_IN = 7.5;

export async function packPptx(opts: PackPptxOptions): Promise<void> {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";  // 13.333 × 7.5 (16:9 widescreen)
  if (opts.title) pres.title = opts.title;
  if (opts.subject) pres.subject = opts.subject;
  if (opts.author) pres.author = opts.author;
  if (opts.company) pres.company = opts.company;

  for (const s of opts.slides) {
    const slide = pres.addSlide();
    slide.addImage({
      path: s.pngPath,
      x: 0,
      y: 0,
      w: SLIDE_WIDTH_IN,
      h: SLIDE_HEIGHT_IN,
    });
    if (s.speakerNote && s.speakerNote.trim()) {
      slide.addNotes(s.speakerNote.trim());
    }
  }

  const outputAbs = isAbsolute(opts.outputPath)
    ? opts.outputPath
    : resolve(process.cwd(), opts.outputPath);
  await mkdir(dirname(outputAbs), { recursive: true });
  await pres.writeFile({ fileName: outputAbs });
}
