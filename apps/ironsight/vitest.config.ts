import { configDefaults, defineConfig, type Plugin } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * `@tikron/server`'s package root re-exports `defineRoom`, which statically imports
 * `partyserver` → the real `cloudflare:workers` module (only resolvable inside
 * workerd). Importing `IoArenaRoom` (or the `createTestRoom` harness) from
 * `@tikron/server` therefore forces that whole graph to evaluate. These suites only
 * assert room *logic* (no Durable Object runtime), so stub the module instead of
 * pulling in `@cloudflare/vitest-pool-workers`. If a future test needs real DO
 * behavior, add that pool (see apps/gateway/vitest.config.ts) and drop this stub.
 */
function cloudflareWorkersStub(): Plugin {
  const id = "cloudflare:workers";
  return {
    name: "cloudflare-workers-stub",
    resolveId(source) {
      return source === id ? id : null;
    },
    load(loadedId) {
      if (loadedId !== id) return null;
      return "export class DurableObject {}\nexport const env = {};\n";
    },
  };
}

const NODE_TEST_FILES = [
  "test/aside-report.test.mjs",
  "test/aside-source.test.mjs",
  "test/audio-capture.test.mjs",
  "test/combat-telemetry-consumer.test.mjs",
  "test/combat-acceptance.tool.test.mjs",
  "test/combat-scenario.test.mjs",
  "test/map-failure-proxy.test.mjs",
  "test/render-budget-policy.test.mjs",
  "test/target-device-report.test.mjs",
  "test/ui-showcase.test.mjs",
] as const;

export default defineConfig({
  resolve: {
    alias: [{
      find: /^@tikron\/server\/testing$/,
      replacement: fileURLToPath(new URL("./test/create-test-room.ts", import.meta.url)),
    }],
  },
  plugins: [cloudflareWorkersStub()],
  test: {
    exclude: [...configDefaults.exclude, ...NODE_TEST_FILES],
    // Three development streams share this workstation. Keep CPU-heavy
    // audio/navigation suites from adding four workers per stream.
    // Keep every assertion and the default 5s per-test timeout unchanged.
    maxWorkers: 2,
    // Force these through Vite's transform pipeline so the stub above can intercept
    // their `cloudflare:workers` import, instead of Vitest externalizing them to
    // Node's native resolver (which would bypass the stub).
    server: { deps: { inline: [/partyserver/, /@tikron\/server/] } },
  },
});
