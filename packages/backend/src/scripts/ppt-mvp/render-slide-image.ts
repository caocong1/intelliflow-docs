import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function run(command: string, args: string[]) {
  return await new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(new Error(`${command} exited with code ${code}`));
    });
    child.on("error", rejectRun);
  });
}

async function main() {
  const [, , pageIdArg, outputArg] = process.argv;
  if (!pageIdArg) {
    throw new Error("Usage: bun packages/backend/src/scripts/ppt-mvp/render-slide-image.ts <pageId> [output-png]");
  }

  const outputPath = resolve(
    process.cwd(),
    outputArg && outputArg.trim().length > 0
      ? outputArg
      : `/tmp/ppt-mvp-${pageIdArg}.png`,
  );
  const htmlPath = resolve(process.cwd(), `/tmp/ppt-mvp-${pageIdArg}.html`);

  await mkdir(dirname(outputPath), { recursive: true });

  await run("bun", [
    "packages/backend/src/scripts/ppt-mvp/build-wireless-preview.ts",
    htmlPath,
    pageIdArg,
    "file",
  ]);

  await run(CHROME_PATH, [
    "--headless=new",
    "--disable-gpu",
    `--screenshot=${outputPath}`,
    "--window-size=1280,720",
    `file://${htmlPath}`,
  ]);

  console.log(JSON.stringify({
    pageId: pageIdArg,
    htmlPath,
    outputPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
