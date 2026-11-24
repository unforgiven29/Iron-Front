import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Many tests fly the full aircraft for minutes of simulated time (≈0.1–0.2 ms per 120 Hz tick);
    // the 5 s default is too tight on shared CI runners.
    testTimeout: 20_000,
    include: ["game/tests/unit/**/*.test.ts", "game/tests/integration/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: ["game/src/**/*.ts"]
    }
  }
});
