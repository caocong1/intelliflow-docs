import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    workspace: [
      {
        extends: "./packages/backend/vitest.config.ts",
        name: "backend",
      },
      {
        extends: "./packages/frontend/vitest.config.ts",
        name: "frontend",
      },
    ],
    globals: true,
  },
});
