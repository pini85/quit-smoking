import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    exclude: ["**/node_modules/**", "**/.next/**", "**/out/**"],
    projects: [
      {
        extends: true,
        test: {
          name: "domain",
          environment: "node",
          include: ["tests/domain/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "persistence",
          environment: "node",
          include: ["tests/persistence/**/*.test.ts"],
          setupFiles: ["fake-indexeddb/auto"],
        },
      },
    ],
  },
});
