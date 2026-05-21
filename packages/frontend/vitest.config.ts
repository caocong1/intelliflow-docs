import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

const frontendRoot = dirname(fileURLToPath(import.meta.url));
const frontendNodeModules = resolve(frontendRoot, "node_modules");

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: [
      { find: /^solid-js\/(.*)$/, replacement: `${frontendNodeModules}/solid-js/$1` },
      { find: "solid-js", replacement: `${frontendNodeModules}/solid-js` },
      { find: /^@solidjs\/router$/, replacement: `${frontendNodeModules}/@solidjs/router` },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "packages/frontend/src/**/*.test.ts",
      "packages/frontend/src/**/*.test.tsx",
    ],
  },
});
