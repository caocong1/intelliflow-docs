import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["packages/backend/src/**/*.test.ts"],
  },
});
