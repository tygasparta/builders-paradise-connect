// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    optimizeDeps: {
      // These are only reached from lazily-loaded route components, so the dev
      // optimizer discovers them mid-session, re-bundles, and ends up serving
      // one React chunk to the app and a second, stale one to these packages —
      // which surfaces as "Invalid hook call". Declaring them up front makes
      // the optimizer resolve everything in a single pass. Build is unaffected.
      include: [
        "react-hook-form",
        "@hookform/resolvers/zod",
        "@tanstack/react-table",
        "@supabase/supabase-js",
        "zod",
        "date-fns",
        "cmdk",
        "sonner",
      ],
    },
  },
});
