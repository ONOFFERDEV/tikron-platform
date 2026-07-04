import { defineConfig } from "vitest/config";

// Room logic is plain server-side code, so the default Node environment is all the
// bundled `src/arena-room.test.ts` needs — the `@tikron/server/testing` harness runs
// the room in-process (no Durable Object, no workerd).
//
// One wrinkle: importing your room pulls in the `@tikron/server` barrel, which
// re-exports `defineRoom` → `partyserver`, whose module header does
// `import { DurableObject } from "cloudflare:workers"`. That `cloudflare:` module
// only exists inside the Workers runtime, so under plain Node it must be stubbed.
// `defineRoom` is never CALLED in a room-logic test (the harness builds a fake
// context), so an inert stub is all that's needed. We inline the two packages so
// Vite processes them and the plugin below can resolve the virtual module.
export default defineConfig({
  plugins: [
    {
      name: "stub-cloudflare-workers",
      enforce: "pre",
      resolveId(id) {
        if (id === "cloudflare:workers") return "\0virtual:cloudflare-workers";
      },
      load(id) {
        if (id === "\0virtual:cloudflare-workers") {
          return "export class DurableObject {}\nexport class WorkerEntrypoint {}\nexport const env = {};";
        }
      },
    },
  ],
  test: {
    environment: "node",
    server: { deps: { inline: ["partyserver", "@tikron/server"] } },
  },
});
