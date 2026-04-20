/**
 * Walks every `.rels` file inside a .pptx and confirms each referenced
 * internal Target resolves to an actual entry in the zip. Returns a list
 * of broken relationships; empty = healthy.
 *
 * CLI:
 *   bun verify-pptx-relationships.ts <pptx-path>
 *   exit 0 on clean, exit 1 on any broken relationship.
 */
import { readFileSync } from "node:fs";
import { resolve, posix } from "node:path";

export type BrokenRelationship = {
  relsFile: string;
  relId: string;
  target: string;
  resolvedTarget: string;
};

const REL_ATTR_RE =
  /<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/>/g;

export async function verifyPptxRelationships(
  pptxPath: string,
): Promise<BrokenRelationship[]> {
  const { default: JSZip } = await import("jszip");
  const buf = readFileSync(pptxPath);
  const zip = await JSZip.loadAsync(buf);

  const entries = new Set(Object.keys(zip.files));
  const broken: BrokenRelationship[] = [];

  for (const name of entries) {
    if (!name.endsWith(".rels")) continue;
    const file = zip.file(name);
    if (!file) continue;
    const content = await file.async("string");
    // .rels paths are relative to the owning part's directory.
    //   _rels/.rels                     → "" (package root)
    //   ppt/_rels/presentation.xml.rels → "ppt"
    //   ppt/slides/_rels/slide1.xml.rels → "ppt/slides"
    const relsDir = posix.dirname(name);
    const dir = relsDir === "_rels" ? "" : relsDir.replace(/\/_rels$/, "");

    for (const match of content.matchAll(REL_ATTR_RE)) {
      const [, relId, target] = match;
      // Skip external / URL targets.
      if (/^(?:https?:|mailto:|urn:|file:|\/)/i.test(target)) continue;
      if (target.startsWith("#")) continue;

      const resolved = posix.normalize(posix.join(dir, target));
      if (!entries.has(resolved)) {
        broken.push({
          relsFile: name,
          relId,
          target,
          resolvedTarget: resolved,
        });
      }
    }
  }

  return broken;
}

if (import.meta.main) {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: verify-pptx-relationships <pptx-path>");
    process.exit(1);
  }
  verifyPptxRelationships(resolve(path))
    .then((broken) => {
      if (broken.length === 0) {
        console.log(`[verify-rels] OK — all relationships resolve in ${path}`);
        return;
      }
      console.error(`[verify-rels] FAILED — ${broken.length} broken relationship(s):`);
      for (const b of broken) {
        console.error(
          `  ${b.relsFile} rId=${b.relId} target="${b.target}" → ${b.resolvedTarget} (missing)`,
        );
      }
      process.exit(1);
    })
    .catch((err) => {
      console.error("[verify-rels] error:", err);
      process.exit(1);
    });
}
