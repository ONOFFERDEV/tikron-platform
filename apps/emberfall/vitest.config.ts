import { defineConfig, type Plugin } from "vitest/config";

/**
 * `@tikron/server`'s package root re-exports `defineRoom`, which statically
 * imports `partyserver`, which imports the real `cloudflare:workers` module —
 * only resolvable inside workerd. Importing `IoArenaRoom` (or any named export)
 * from `@tikron/server` therefore forces that whole module graph to evaluate.
 * This suite only asserts Room *class shape* (no DO runtime), so stub the
 * module instead of pulling in `@cloudflare/vitest-pool-workers` for that.
 * If a future test here needs real Durable Object behavior, add that pool
 * (see apps/gateway/vitest.config.ts) and drop this stub.
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
    // Force these through Vite's transform pipeline (so the stub plugin above
    // can intercept their `cloudflare:workers` import) instead of letting
    // Vitest externalize them to Node's native resolver, which would bypass it.
    server: { deps: { inline: [/partyserver/, /@tikron\/server/] } },
  },
});
