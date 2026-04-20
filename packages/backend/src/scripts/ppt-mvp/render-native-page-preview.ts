import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function parseArgs(argv: string[]): { pageId: string; outputPng: string; nativeTemplatePath?: string } {
  const positional: string[] = [];
  let nativeTemplatePath: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--template") {
      nativeTemplatePath = argv[i + 1] ? resolve(process.cwd(), argv[i + 1]) : undefined;
      i += 1;
    } else if (arg.startsWith("--template=")) {
      nativeTemplatePath = resolve(process.cwd(), arg.slice("--template=".length));
    } else {
      positional.push(arg);
    }
  }

  const [pageId, outputArg] = positional;
  if (!pageId) {
    throw new Error(
      "Usage: bun packages/backend/src/scripts/ppt-mvp/render-native-page-preview.ts <pageId> [output-png] [--template <native-template.json>]",
    );
  }

  return {
    pageId,
    outputPng: resolve(
      process.cwd(),
      outputArg && outputArg.trim().length > 0
        ? outputArg
        : `/tmp/intelliflow-ppt-mvp-native-${pageId}.png`,
    ),
    nativeTemplatePath,
  };
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const tempPptx = `/tmp/intelliflow-ppt-mvp-native-${cli.pageId}.pptx`;
  const tempDir = `/tmp/intelliflow-ppt-mvp-native-preview-${cli.pageId}`;

  const buildArgs = [
    "bun",
    "packages/backend/src/scripts/ppt-mvp/build-wireless-mvp-expanded.ts",
    tempPptx,
    "--pages",
    cli.pageId,
  ];
  if (cli.nativeTemplatePath) {
    buildArgs.push("--template", cli.nativeTemplatePath);
  }

  const build = Bun.spawnSync(buildArgs, {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (build.exitCode !== 0) {
    throw new Error(`Failed to build native page ${cli.pageId}: ${build.stderr.toString().slice(-300)}`);
  }

  await mkdir(tempDir, { recursive: true });
  const preview = Bun.spawnSync([
    "qlmanage",
    "-t",
    "-s",
    "2000",
    "-o",
    tempDir,
    tempPptx,
  ], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (preview.exitCode !== 0) {
    throw new Error(`Failed to preview native page ${cli.pageId}: ${preview.stderr.toString().slice(-300)}`);
  }

  const sourcePng = `${tempDir}/${tempPptx.split("/").pop()}.png`;
  await mkdir(dirname(cli.outputPng), { recursive: true });
  await copyFile(sourcePng, cli.outputPng);

  console.log(JSON.stringify({
    pageId: cli.pageId,
    pptxPath: tempPptx,
    pngPath: cli.outputPng,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
