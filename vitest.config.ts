import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@livingcourse/core": `${root}packages/core/src/index.ts`,
      "@livingcourse/intake": `${root}packages/intake/src/index.ts`,
      "@livingcourse/compiler": `${root}packages/compiler/src/index.ts`,
      "@livingcourse/generation": `${root}packages/generation/src/index.ts`,
      "@livingcourse/providers": `${root}packages/providers/src/index.ts`,
      "@livingcourse/renderers": `${root}packages/renderers/src/index.ts`,
      "@livingcourse/workflow": `${root}packages/workflow/src/index.ts`
    }
  },
  test: {
    environment: "node",
    coverage: { reporter: ["text", "json-summary"] }
  }
});
