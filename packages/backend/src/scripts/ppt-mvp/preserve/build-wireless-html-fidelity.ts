/**
 * HTML fidelity line POC — renders a template-style HTML page to PNG
 * using Chrome headless. Complement to preserve mode for cases where
 * the template's actual slot geometry is a bad fit for content.
 *
 * POC scope: single page (cover). No LLM, no editable .pptx output yet.
 * See docs/design/ppt-mvp/template-style-html-contract.md for the full
 * pipeline vision.
 *
 * CLI:
 *   bun build-wireless-html-fidelity.ts [output.png]
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(MODULE_DIR, "../../../../../..");
const COVER_HTML = resolve(
  REPO_ROOT,
  "docs/design/ppt-mvp/html-styles/622eee2ab7e6e/cover.html",
);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIEWPORT_W = 1280;
const VIEWPORT_H = 720;

async function renderHtmlToPng(htmlPath: string, outPath: string): Promise<void> {
  if (!existsSync(CHROME)) {
    throw new Error(`Chrome not found at ${CHROME}`);
  }
  if (!existsSync(htmlPath)) {
    throw new Error(`template HTML not found: ${htmlPath}`);
  }
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
  if (exitCode !== 0) throw new Error(`chrome exited with code ${exitCode}`);
}

async function main() {
  const outPath = process.argv[2] ?? "/tmp/wireless-html-cover.png";
  console.error(`[html-fidelity] rendering ${COVER_HTML} → ${outPath}`);
  await renderHtmlToPng(COVER_HTML, outPath);
  console.log(`wrote ${outPath}`);
}

main().catch((err) => {
  console.error("[html-fidelity] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
