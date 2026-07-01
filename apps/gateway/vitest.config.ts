import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

// vitest-pool-workers 0.17+ (vitest 4) exposes the Workers runtime as a Vite
// plugin rather than the older `defineWorkersProject` / poolOptions form.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
  },
});
