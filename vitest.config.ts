import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["game/tests/unit/**/*.test.ts", "game/tests/integration/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: ["game/src/**/*.ts"]
    }
  }
});
