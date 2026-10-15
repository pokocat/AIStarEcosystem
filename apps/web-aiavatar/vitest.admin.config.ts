import { defineConfig } from "vitest/config";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);

// Reuse the installed UI test tools without adding a second dependency tree to admin.
// Run from the repository root:
// pnpm --dir apps/web-aiavatar exec vitest run --config vitest.admin.config.ts
export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: resolve(__dirname, "../admin/src") },
      { find: /^@testing-library\/react$/, replacement: require.resolve("@testing-library/react") },
      { find: /^vitest$/, replacement: resolve(require.resolve("vitest/package.json"), "../dist/index.js") },
    ],
    dedupe: ["react", "react-dom"],
  },
  esbuild: { jsx: "automatic" },
  test: {
    include: ["../../scripts/vitest/admin/*.test.tsx"],
    environment: "jsdom",
    setupFiles: [resolve(__dirname, "../../scripts/vitest/setup-storage.ts")],
    maxWorkers: 1,
    testTimeout: 15_000,
  },
});
