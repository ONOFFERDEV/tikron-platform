import { defineConfig, type Plugin } from "vitest/config";

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

export default defineConfig({
  plugins: [cloudflareWorkersStub()],
  test: {
    // Bound concurrent CPU-heavy audio/nav suites on shared workstations.
    // Keep every assertion and the default 5s per-test timeout unchanged.
    maxWorkers: 4,
    // Force these through Vite's transform pipeline so the stub above can intercept
    // their `cloudflare:workers` import, instead of Vitest externalizing them to
    // Node's native resolver (which would bypass the stub).
    server: { deps: { inline: [/partyserver/, /@tikron\/server/] } },
  },
});
