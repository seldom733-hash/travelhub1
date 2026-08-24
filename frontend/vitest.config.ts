import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Frontend unit/component tests (Step 1.6/1.7):
 * - lib/*.spec.ts — чистая логика (routes, public-api, i18n, marketplace-utils);
 * - lib/*.spec.tsx и components/.../spec.tsx — компонентные тесты через
 *   @testing-library/react (jsdom-директива в файле).
 * Алиас @/ — как в tsconfig (paths); setup.ts делает cleanup DOM после тестов.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.spec.ts", "lib/**/*.spec.tsx", "components/**/*.spec.ts", "components/**/*.spec.tsx", "app/**/*.spec.tsx"],
    setupFiles: ["./test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
