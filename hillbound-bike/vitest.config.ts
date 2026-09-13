import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/simulation/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
  },
});
