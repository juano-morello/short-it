import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**/*.ts"],
      exclude: [
        "src/main.ts",
        "src/app.module.ts",
        "src/config.ts",
        "src/database.ts",
        "src/auth/**",
        "src/**/*.spec.ts",
        "src/**/*.integration.spec.ts",
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
