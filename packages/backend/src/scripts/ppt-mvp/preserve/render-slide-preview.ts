/**
 * render-slide-preview.ts
 *
 * Rough visual preview of a preserve-mode .pptx output WITHOUT needing
 * LibreOffice or PowerPoint. Extracts shape geometry + text + images
 * from the target slide's XML, renders an HTML approximation, and uses
 * Chrome headless to screenshot it.
 *
 * Fidelity is LOW — fonts, gradients, rotations, grouped-shape details
 * are not reproduced. The goal is to see text-vs-slot overflow, not to
 * produce a pixel-faithful render.
 *
 * CLI:
 *   bun render-slide-preview.ts <pptx> [--slide <index>] [--out <png>]
 *     <pptx>         path to the .pptx
 *     --slide <N>    1-based zip slide number (default 26, the appended slide)
 *     --out <png>    output PNG path (default /tmp/preserve-preview.png)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SLIDE_W_EMU = 12192000;
const SLIDE_H_EMU = 6858000;
const VIEWPORT_W = 1600;
const VIEWPORT_H = 900;

type Shape = {
  kind: "text" | "image";
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  /** Font size in hundredths of a pt (e.g. 1400 = 14pt), if found in any rPr. */
  fontSizeHundredths?: number;
  imageDataUri?: string;
};

type GroupXform = {
  off: { a: number; b: number };
  ext: { a: number; b: number };
  chOff: { a: number; b: number };
  chExt: { a: number; b: number };
};

/**
 * Apply a chain of ancestor group transforms to a local (x, y, w, h).
 * Each group contributes: abs = group.off + (local - group.chOff) * (group.ext / group.chExt).
 * Walk from innermost group outward; inner shape coords are local to the
 * innermost group, which is itself local to its parent group, etc.
 */
function applyGroupTransforms(
  local: { x: number; y: number; w: number; h: number },
  groups: GroupXform[],
): { x: number; y: number; w: number; h: number } {
  let { x, y, w, h } = local;
  for (const g of groups) {
    const sx = g.chExt.a !== 0 ? g.ext.a / g.chExt.a : 1;
    const sy = g.chExt.b !== 0 ? g.ext.b / g.chExt.b : 1;
    x = g.off.a + (x - g.chOff.a) * sx;
    y = g.off.b + (y - g.chOff.b) * sy;
    w *= sx;
    h *= sy;
  }
  return { x, y, w, h };
}

function parseGroupXform(block: string): GroupXform | null {
  // Look for the grpSpPr > xfrm block specifically (first one in the group).
  const xfrmMatch = block.match(/<p:grpSpPr\b[^>]*>[\s\S]*?<a:xfrm\b[^>]*>([\s\S]*?)<\/a:xfrm>/);
  if (!xfrmMatch) return null;
  const inner = xfrmMatch[1];
  const off = inner.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"\s*\/>/);
  const ext = inner.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"\s*\/>/);
  const chOff = inner.match(/<a:chOff\s+x="(\d+)"\s+y="(\d+)"\s*\/>/);
  const chExt = inner.match(/<a:chExt\s+cx="(\d+)"\s+cy="(\d+)"\s*\/>/);
  if (!off || !ext) return null;
  return {
    off: { a: Number(off[1]), b: Number(off[2]) },
    ext: { a: Number(ext[1]), b: Number(ext[2]) },
    chOff: chOff ? { a: Number(chOff[1]), b: Number(chOff[2]) } : { a: 0, b: 0 },
    chExt: chExt ? { a: Number(chExt[1]), b: Number(chExt[2]) } : { a: Number(ext[1]), b: Number(ext[2]) },
  };
}

type ParsedLeaf = {
  kind: "text" | "image";
  name: string;
  local: { x: number; y: number; w: number; h: number };
  text?: string;
  fontSizeHundredths?: number;
  rEmbed?: string;
  groups: GroupXform[];
};

/**
 * Recursive walker: finds leaf shape blocks (<p:sp>, <p:pic>) and tracks
 * the chain of ancestor <p:grpSp> transforms.
 */
function walk(xml: string, groups: GroupXform[], out: ParsedLeaf[]): void {
  let idx = 0;
  while (idx < xml.length) {
    // Find next top-level element start: <p:sp> / <p:pic> / <p:grpSp>
    const next = findNextElement(xml, idx);
    if (!next) break;
    const { tag, start, bodyStart, bodyEnd, end } = next;
    const block = xml.slice(start, end);
    const body = xml.slice(bodyStart, bodyEnd);

    if (tag === "p:grpSp") {
      const xform = parseGroupXform(block);
      const nextGroups = xform ? [...groups, xform] : groups;
      walk(body, nextGroups, out);
    } else if (tag === "p:sp" || tag === "p:pic") {
      const nameMatch = block.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/);
      const name = nameMatch ? nameMatch[1] : "";
      // Shape's own xfrm lives in p:spPr (or pic's p:spPr).
      const xfrmMatch = block.match(/<p:spPr\b[^>]*>[\s\S]*?<a:xfrm\b[^>]*>([\s\S]*?)<\/a:xfrm>/);
      if (xfrmMatch) {
        const inner = xfrmMatch[1];
        const off = inner.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"\s*\/>/);
        const ext = inner.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"\s*\/>/);
        if (off && ext) {
          const local = {
            x: Number(off[1]),
            y: Number(off[2]),
            w: Number(ext[1]),
            h: Number(ext[2]),
          };
          if (tag === "p:pic") {
            const rEmbed = block.match(/r:embed="([^"]+)"/);
            out.push({ kind: "image", name, local, rEmbed: rEmbed?.[1], groups });
          } else {
            const runs = [...block.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]);
            const paras = [...block.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)].map((m) =>
              [...m[0].matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g)].map((x) => x[1]).join(""),
            );
            const text = paras.length > 0 ? paras.join("\n") : runs.join("");
            // Take the first <a:rPr sz="..."/> encountered. Consistent run
            // sizes are the common case in preserve mode (shrink applies to
            // all runs via setShapeFontSize).
            const szMatch = block.match(/<a:rPr\b[^>]*\bsz="(\d+)"/);
            const fontSizeHundredths = szMatch ? Number(szMatch[1]) : undefined;
            out.push({ kind: "text", name, local, text, fontSizeHundredths, groups });
          }
        }
      }
    }
    idx = end;
  }
}

function findNextElement(xml: string, from: number): { tag: "p:sp" | "p:pic" | "p:grpSp"; start: number; bodyStart: number; bodyEnd: number; end: number } | null {
  // Scan for the earliest opening tag of interest. Handle open-close pair with depth counting.
  const tags: Array<"p:sp" | "p:pic" | "p:grpSp"> = ["p:sp", "p:pic", "p:grpSp"];
  let best: { tag: "p:sp" | "p:pic" | "p:grpSp"; pos: number } | null = null;
  for (const tag of tags) {
    const re = new RegExp(`<${tag.replace(":", ":")}\\b`);
    const m = re.exec(xml.slice(from));
    if (m) {
      const pos = from + m.index;
      if (best === null || pos < best.pos) best = { tag, pos };
    }
  }
  if (!best) return null;

  const openRe = new RegExp(`<${best.tag}\\b[^>]*>`, "g");
  const closeRe = new RegExp(`<\\/${best.tag}>`, "g");
  openRe.lastIndex = best.pos;
  const openMatch = openRe.exec(xml);
  if (!openMatch) return null;
  const bodyStart = openMatch.index + openMatch[0].length;
  // Balance open/close starting from this position.
  let depth = 1;
  openRe.lastIndex = bodyStart;
  closeRe.lastIndex = bodyStart;
  while (depth > 0) {
    const o = openRe.exec(xml);
    const c = closeRe.exec(xml);
    if (!c) return null;
    if (o && o.index < c.index) {
      depth += 1;
      closeRe.lastIndex = o.index + 1;
    } else {
      depth -= 1;
      if (depth === 0) {
        return {
          tag: best.tag,
          start: best.pos,
          bodyStart,
          bodyEnd: c.index,
          end: c.index + c[0].length,
        };
      }
      openRe.lastIndex = c.index + 1;
    }
  }
  return null;
}

function extractShapes(slideXml: string, relsXml: string, mediaByTarget: Map<string, Buffer>): Shape[] {
  const relsMap = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\s+[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/>/g)) {
    relsMap.set(m[1], m[2]);
  }

  // Restrict walk to <p:spTree>...</p:spTree> to avoid slide-layout noise.
  const spTreeMatch = slideXml.match(/<p:spTree\b[\s\S]*?<\/p:spTree>/);
  const xml = spTreeMatch ? spTreeMatch[0] : slideXml;
  const leaves: ParsedLeaf[] = [];
  walk(xml, [], leaves);

  const shapes: Shape[] = [];
  for (const leaf of leaves) {
    const abs = applyGroupTransforms(leaf.local, leaf.groups);
    if (leaf.kind === "image") {
      let imageDataUri: string | undefined;
      if (leaf.rEmbed) {
        const target = relsMap.get(leaf.rEmbed);
        if (target) {
          const norm = target.replace(/^\.\.\//, "ppt/");
          const buf = mediaByTarget.get(norm);
          if (buf) {
            const mime = /\.jpe?g$/i.test(norm) ? "image/jpeg" : /\.png$/i.test(norm) ? "image/png" : "image/*";
            imageDataUri = `data:${mime};base64,${buf.toString("base64")}`;
          }
        }
      }
      shapes.push({ kind: "image", name: leaf.name, x: abs.x, y: abs.y, w: abs.w, h: abs.h, imageDataUri });
    } else {
      shapes.push({
        kind: "text",
        name: leaf.name,
        x: abs.x,
        y: abs.y,
        w: abs.w,
        h: abs.h,
        text: leaf.text,
        fontSizeHundredths: leaf.fontSizeHundredths,
      });
    }
  }
  return shapes;
}

function emuToPx(emu: number, axis: "x" | "y"): number {
  const ratio = axis === "x" ? VIEWPORT_W / SLIDE_W_EMU : VIEWPORT_H / SLIDE_H_EMU;
  return emu * ratio;
}

function buildHtml(shapes: Shape[], bgDataUri?: string): string {
  const shapeDivs = shapes
    .map((s) => {
      const x = emuToPx(s.x, "x");
      const y = emuToPx(s.y, "y");
      const w = emuToPx(s.w, "x");
      const h = emuToPx(s.h, "y");
      const style = `position:absolute; left:${x}px; top:${y}px; width:${w}px; height:${h}px; box-sizing:border-box; outline:1px dashed rgba(255,0,0,0.4);`;

      if (s.kind === "image" && s.imageDataUri) {
        return `<div style="${style} overflow:hidden;"><img src="${s.imageDataUri}" style="width:100%;height:100%;object-fit:cover;"/></div>`;
      }
      if (s.kind === "text") {
        const safe = (s.text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br/>");
        // Prefer actual font size from <a:rPr sz="..."/> (hundredths of pt).
        // Fall back to bbox-height heuristic when none present.
        // At the 900-px slide height (SLIDE_H_EMU = 6858000 ≈ 7.5 inches),
        // 1pt ≈ 1.67 px; use 1.6 for a slight undershoot so text is less
        // likely to appear clipped in the rough preview.
        const ptToPx = 1.6;
        const fontSize = s.fontSizeHundredths
          ? (s.fontSizeHundredths / 100) * ptToPx
          : Math.min(Math.max(h * 0.32, 10), Math.max(h * 0.55, 14));
        return `<div style="${style} font-family:'PingFang SC','Microsoft YaHei',sans-serif; font-size:${fontSize}px; line-height:1.2; color:#333; white-space:pre-wrap; overflow:visible; display:flex; flex-direction:column; justify-content:center;" title="${s.name}">${safe}</div>`;
      }
      return "";
    })
    .join("\n");

  const bgStyle = bgDataUri
    ? `background:url("${bgDataUri}") center/cover no-repeat;`
    : "background:#fafafa;";

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
  html,body{margin:0;padding:0;}
  .slide{position:relative; width:${VIEWPORT_W}px; height:${VIEWPORT_H}px; ${bgStyle} overflow:hidden;}
  </style></head><body><div class="slide">${shapeDivs}</div></body></html>`;
}

async function captureChrome(htmlPath: string, outPath: string): Promise<void> {
  const proc = Bun.spawn(
    [
      CHROME,
      "--headless=new",
      "--disable-gpu",
      `--screenshot=${outPath}`,
      `--window-size=${VIEWPORT_W},${VIEWPORT_H}`,
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `file://${htmlPath}`,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`chrome headless exited with code ${exitCode}`);
  }
}

async function renderSlidePreview(args: {
  pptxPath: string;
  slideNumber?: number;
  outPath?: string;
}): Promise<{ outPath: string; htmlPath: string; shapeCount: number }> {
  const { default: JSZip } = await import("jszip");
  const slideNumber = args.slideNumber ?? 26;
  const outPath = args.outPath ?? "/tmp/preserve-preview.png";
  const htmlPath = outPath.replace(/\.png$/, ".html");

  const buf = readFileSync(args.pptxPath);
  const zip = await JSZip.loadAsync(buf);

  const slideXmlFile = zip.file(`ppt/slides/slide${slideNumber}.xml`);
  if (!slideXmlFile) throw new Error(`slide${slideNumber}.xml not found in ${args.pptxPath}`);
  const slideXml = await slideXmlFile.async("string");

  const relsFile = zip.file(`ppt/slides/_rels/slide${slideNumber}.xml.rels`);
  const relsXml = relsFile ? await relsFile.async("string") : "";

  // Load all media blobs into memory keyed by zip entry path.
  const mediaByTarget = new Map<string, Buffer>();
  for (const [name, entry] of Object.entries(zip.files)) {
    if (!name.startsWith("ppt/media/")) continue;
    const b = await entry.async("nodebuffer");
    mediaByTarget.set(name, b);
  }

  const shapes = extractShapes(slideXml, relsXml, mediaByTarget);

  // Heuristic: the largest image-kind shape with (0,0) origin is the
  // background. Render it as the slide background rather than a layered
  // div so subsequent shapes overlay correctly.
  const bg = shapes
    .filter((s) => s.kind === "image" && s.x === 0 && s.y === 0 && s.imageDataUri)
    .sort((a, b) => b.w * b.h - a.w * a.h)[0];
  const foregroundShapes = shapes.filter((s) => s !== bg);

  const html = buildHtml(foregroundShapes, bg?.imageDataUri);
  mkdirSync(dirname(htmlPath), { recursive: true });
  writeFileSync(htmlPath, html);

  if (!existsSync(CHROME)) {
    throw new Error(`Chrome not found at ${CHROME}; install it or adjust CHROME path in render-slide-preview.ts`);
  }
  await captureChrome(htmlPath, outPath);

  return { outPath, htmlPath, shapeCount: shapes.length };
}

function parseCli(argv: string[]): { pptxPath: string; slideNumber?: number; outPath?: string } {
  const positional: string[] = [];
  const opts: { slideNumber?: number; outPath?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--slide") {
      opts.slideNumber = Number(argv[++i]);
    } else if (a === "--out") {
      opts.outPath = argv[++i];
    } else {
      positional.push(a);
    }
  }
  if (!positional[0]) {
    throw new Error("usage: render-slide-preview <pptx> [--slide <n>] [--out <png>]");
  }
  return { pptxPath: resolve(positional[0]), ...opts };
}

if (import.meta.main) {
  const args = parseCli(process.argv.slice(2));
  renderSlidePreview(args)
    .then((result) => {
      console.log(`[preview] wrote ${result.outPath} (${result.shapeCount} shapes)`);
      console.log(`  html: ${result.htmlPath}`);
    })
    .catch((err) => {
      console.error("[preview] FAILED:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
