import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { fileURLToPath } from "node:url";

// vitest-pool-workers 0.17+ (vitest 4) exposes the Workers runtime as a Vite
// plugin rather than the older `defineWorkersProject` / poolOptions form.
//
// D1 migrations are read here (Node side) and injected as a binding; the setup
// file applies them to the local test D1. DEV_MODE=1 + test secrets mirror the
// local `.dev.vars` so existing /parties tests bypass API-key enforcement while
// the platform tests exercise D1, dev auth, metering, and JWT.
const migrationsDir = fileURLToPath(new URL("./migrations", import.meta.url));
const migrations = await readD1Migrations(migrationsDir);

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: migrations,
          DEV_MODE: "1",
          SESSION_SECRET: "test-session-secret",
          GITHUB_CLIENT_ID: "test-client-id",
          GITHUB_CLIENT_SECRET: "test-client-secret",
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/apply-migrations.ts"],
  },
});
