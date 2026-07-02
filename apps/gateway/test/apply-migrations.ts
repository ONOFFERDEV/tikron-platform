import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll } from "vitest";
import type { Env } from "../src/index.js";

// Apply the D1 schema to the local test database once per test file, before any
// test runs. `TEST_MIGRATIONS` is injected by vitest.config.ts (readD1Migrations).
beforeAll(async () => {
  const e = env as unknown as Env & { TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1] };
  await applyD1Migrations(e.DB!, e.TEST_MIGRATIONS);
});
