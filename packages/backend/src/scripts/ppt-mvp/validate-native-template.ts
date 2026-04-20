import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateNativeTemplate } from "./native-template-schema";

async function main() {
  const [, , inputArg] = process.argv;
  if (!inputArg) {
    throw new Error("Usage: bun packages/backend/src/scripts/ppt-mvp/validate-native-template.ts <native-template-json>");
  }

  const inputPath = resolve(process.cwd(), inputArg);
  const content = await readFile(inputPath, "utf-8");
  const parsed = JSON.parse(content);
  const result = validateNativeTemplate(parsed);
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
