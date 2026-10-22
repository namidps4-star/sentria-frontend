import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

/* Unit tests for the pure helpers in lib/. The browser suites live in
   tests/e2e and run separately. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
})
