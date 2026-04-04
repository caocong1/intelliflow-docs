import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        extends: "./packages/backend/vitest.config.ts",
      },
      {
        extends: "./packages/frontend/vitest.config.ts",
      },
    ],
  },
});
