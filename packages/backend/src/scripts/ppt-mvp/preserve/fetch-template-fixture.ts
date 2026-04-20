import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(MODULE_DIR, "../../../../../..");
const FIXTURE_DIR = resolve(
  REPO_ROOT,
  "packages/backend/test-fixtures/ppt-mvp",
);

type FixtureEntry = {
  name: string;
  dest: string;
  sources: string[];
};

const FIXTURES: Record<string, FixtureEntry> = {
  "622eee2ab7e6e.pptx": {
    name: "622eee2ab7e6e.pptx",
    dest: resolve(FIXTURE_DIR, "622eee2ab7e6e.pptx"),
    sources: [
      "/tmp/ppt-research/batch-input/622eee2ab7e6e.pptx",
      "/tmp/ppt-research/ingest-out/622eee2ab7e6e_110eb2/622eee2ab7e6e.pptx",
    ],
  },
};

export function ensureFixture(name: keyof typeof FIXTURES): string {
  const entry = FIXTURES[name];
  if (!entry) throw new Error(`unknown fixture: ${name}`);
  if (existsSync(entry.dest)) return entry.dest;
  mkdirSync(dirname(entry.dest), { recursive: true });
  for (const source of entry.sources) {
    if (existsSync(source)) {
      copyFileSync(source, entry.dest);
      console.error(`[fetch-template-fixture] staged ${entry.name} from ${source}`);
      return entry.dest;
    }
  }
  throw new Error(
    `fixture ${entry.name} not found. Tried:\n  ${entry.sources.join("\n  ")}\n` +
      `Stage it manually at ${entry.dest} or run the ingest pipeline first.`,
  );
}

if (import.meta.main) {
  const requested = process.argv[2] ?? "622eee2ab7e6e.pptx";
  const path = ensureFixture(requested);
  console.log(path);
}
