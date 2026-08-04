import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

// Kept separate from vite.config.ts: the Lovable TanStack preset installs the
// Start/nitro plugins, which do not apply to a plain unit-test run.
export default defineConfig({
  plugins: [tsConfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/features/**"],
    },
  },
});
