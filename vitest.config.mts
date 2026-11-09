import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/preparar-banco.ts"],
    fileParallelism: false,
  },
});
