import { resolve } from "node:path";

import { buildNativeFromPagePlan } from "./build-native-from-page-plan";

function parseArgs(argv: string[]): { outputPath: string; pageIds: string[]; nativeTemplatePath?: string } {
  const positional: string[] = [];
  const pageIds: string[] = [];
  let nativeTemplatePath: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--pages") {
      const next = argv[i + 1] ?? "";
      pageIds.push(...next.split(",").map((item) => item.trim()).filter(Boolean));
      i += 1;
    } else if (arg.startsWith("--pages=")) {
      pageIds.push(...arg.slice("--pages=".length).split(",").map((item) => item.trim()).filter(Boolean));
    } else if (arg === "--template") {
      nativeTemplatePath = argv[i + 1] ? resolve(process.cwd(), argv[i + 1]) : undefined;
      i += 1;
    } else if (arg.startsWith("--template=")) {
      nativeTemplatePath = resolve(process.cwd(), arg.slice("--template=".length));
    } else {
      positional.push(arg);
    }
  }

  return {
    outputPath: positional[0] && positional[0].trim().length > 0
      ? positional[0]
      : "/tmp/intelliflow-ppt-mvp-wireless-v2.pptx",
    pageIds,
    nativeTemplatePath,
  };
}

async function main() {
  const baseDir = resolve(process.cwd(), "docs/design/ppt-mvp");
  const cli = parseArgs(process.argv.slice(2));
  const outputPath = resolve(process.cwd(), cli.outputPath);
  const result = await buildNativeFromPagePlan({
    outlinePath: `${baseDir}/wireless-outline.json`,
    briefPath: `${baseDir}/wireless-visual-brief.json`,
    planPath: `${baseDir}/wireless-page-plan-expanded.json`,
    assetPlanPath: `${baseDir}/wireless-asset-plan-expanded.json`,
    outputPptx: outputPath,
    pageIds: cli.pageIds,
    nativeTemplatePath: cli.nativeTemplatePath,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
