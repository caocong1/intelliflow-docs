/**
 * HTML → PNG renderer using headless Chrome.
 *
 * Reuses the path proven in /tmp/ppt-research/landppt-experiment/ where
 * 1920×1080 screenshots came out clean.  No new dependency is added.
 */

import { existsSync } from "node:fs";

const DEFAULT_CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

function locateChrome(): string {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  for (const p of DEFAULT_CHROME_PATHS) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    "Could not locate Chrome.  Set CHROME_PATH env var to the Chrome binary.",
  );
}

export type RenderHtmlOptions = {
  htmlPath: string;
  outputPng: string;
  width?: number;
  height?: number;
  /** Wait this long after load before screenshot, useful for web fonts.
   *  Defaults to 250ms which is enough for the design-system.css fonts
   *  used in this project. */
  delayMs?: number;
};

export async function renderHtmlToPng(opts: RenderHtmlOptions): Promise<void> {
  const chrome = locateChrome();
  const width = opts.width ?? 1920;
  const height = opts.height ?? 1080;
  const fileUrl = `file://${opts.htmlPath}`;

  const args = [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--disable-software-rasterizer",
    `--virtual-time-budget=${(opts.delayMs ?? 250) + 1000}`,
    `--screenshot=${opts.outputPng}`,
    `--window-size=${width},${height}`,
    fileUrl,
  ];

  const proc = Bun.spawnSync([chrome, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  // Chrome can emit GPU warnings to stderr but still write the PNG.  We
  // accept the screenshot if the file exists and is non-empty.
  if (!existsSync(opts.outputPng)) {
    const stderrText = proc.stderr.toString().slice(-300);
    throw new Error(`Chrome did not produce ${opts.outputPng}: ${stderrText}`);
  }
  const stat = Bun.file(opts.outputPng).size;
  if (stat < 1024) {
    throw new Error(`Chrome produced an empty PNG (${stat} bytes): ${opts.outputPng}`);
  }
}
