import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": `${import.meta.dirname}/src` } },
  test: {
    environment: "node",
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
  },
});
