import { env, runInDurableObject, runDurableObjectAlarm } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import type { Env } from "../src/index.js";
import type { Matchmaker } from "../src/matchmaker.js";
import { enforceConnection, resolveProject } from "../src/platform/api.js";
import { _clearKeyCache, generateApiKey } from "../src/platform/apikeys.js";
import { createApiKey, createProject } from "../src/platform/db.js";
import { signJwt, verifyJwt } from "../src/platform/jwt.js";

const db = () => (env as unknown as Env).DB!;
const matchmaker = () => {
  const ns = (env as unknown as Env).Matchmaker;
  return ns.get(ns.idFromName(`mm-${crypto.randomUUID()}`)) as DurableObjectStub<Matchmaker>;
};
/** An env with enforcement ON (DEV_MODE unset) but the real local D1 + Matchmaker. */
const enforcedEnv = (): Env =>
  ({ DB: db(), Matchmaker: (env as unknown as Env).Matchmaker }) as Env;

async function seedProjectWithKey(): Promise<{ projectId: string; apiKey: string }> {
  const project = await createProject(db(), {
    id: crypto.randomUUID(),
    ownerGithubId: "dev-tester",
    name: "p",
    playerJwtSecret: "secret",
  });
  const gen = await generateApiKey();
  await createApiKey(db(), {
    id: crypto.randomUUID(),
    projectId: project.id,
    keyHash: gen.hash,
    keyPrefix: gen.prefix,
  });
  return { projectId: project.id, apiKey: gen.key };
}

beforeEach(() => _clearKeyCache());

describe("API-key enforcement (DEV_MODE off)", () => {
  it("401s a missing key, 401s a bad key, resolves a valid key", async () => {
    const e = enforcedEnv();
    const missing = await resolveProject(e, new URL("https://x/parties/agar-room/r"));
    expect(missing).toEqual({ ok: false, status: 401, code: "missing_api_key" });

    const bad = await resolveProject(e, new URL("https://x/parties/agar-room/r?apiKey=pe_live_nope"));
    expect(bad).toEqual({ ok: false, status: 401, code: "invalid_api_key" });

    const { projectId, apiKey } = await seedProjectWithKey();
    const ok = await resolveProject(
      e,
      new URL(`https://x/parties/agar-room/r?apiKey=${encodeURIComponent(apiKey)}`),
    );
    expect(ok).toEqual({ ok: true, projectId });
  });

  it("falls back to DEMO_PROJECT_ID for a missing key, but never for a bad key", async () => {
    const e = { ...enforcedEnv(), DEMO_PROJECT_ID: "demo" } as Env;

    // Missing key → attributed to the metered demo project (public demos).
    const missing = await resolveProject(e, new URL("https://x/parties/agar-room/r"));
    expect(missing).toEqual({ ok: true, projectId: "demo" });

    // A key that fails validation is a client error, not demo traffic.
    const bad = await resolveProject(e, new URL("https://x/parties/agar-room/r?apiKey=pe_live_no"));
    expect(bad).toEqual({ ok: false, status: 401, code: "invalid_api_key" });
  });

  it("forwards the resolved project to the room via _project on connect", async () => {
    const { projectId, apiKey } = await seedProjectWithKey();
    const url = new URL(`https://x/parties/agar-room/r?apiKey=${encodeURIComponent(apiKey)}`);
    const gate = await enforceConnection(enforcedEnv(), new Request(url.toString()), url);
    expect(gate.ok).toBe(true);
    if (gate.ok) expect(new URL(gate.request.url).searchParams.get("_project")).toBe(projectId);
  });
});

describe("caps enforcement", () => {
  it("returns cap_room_hours when the monthly budget is exhausted", async () => {
    const { projectId } = await seedProjectWithKey();
    const day = new Date().toISOString().slice(0, 10);
    await db()
      .prepare(`INSERT INTO usage_daily (project_id, day, room_hours, peak_ccu, messages) VALUES (?, ?, ?, 0, 0)`)
      .bind(projectId, day, 99999)
      .run();
    const cap = await matchmaker().checkCaps(projectId, true);
    expect(cap).toBe("cap_room_hours");
  });

  it("returns cap_concurrent_rooms when live rooms hit the cap", async () => {
    const { projectId } = await seedProjectWithKey();
    // Temporarily lower the concurrent-rooms cap, then restore it.
    await db().prepare(`UPDATE config SET v = '1' WHERE k = 'free_concurrent_rooms'`).run();
    try {
      const mm = matchmaker();
      await mm.report("room-a", 1, [], 1, projectId, 0); // one live room for the project
      expect(await mm.checkCaps(projectId, true)).toBe("cap_concurrent_rooms");
    } finally {
      await db().prepare(`UPDATE config SET v = '50' WHERE k = 'free_concurrent_rooms'`).run();
    }
  });
});

describe("metering flush", () => {
  it("accrues room-hours, peak CCU, and messages to usage_daily on the alarm", async () => {
    const { projectId } = await seedProjectWithKey();
    const mm = matchmaker();
    await mm.report("room-x", 2, ["s1", "s2"], 1, projectId, 7); // 2 seated, 7 messages

    // Backdate accrual by one hour so the flush records ~1.0 room-hour.
    await runInDurableObject(mm, (inst: any) => {
      inst.metered.get("room-x").accrualAt = Date.now() - 3_600_000;
    });
    expect(await runDurableObjectAlarm(mm)).toBe(true);

    const row = await db()
      .prepare(`SELECT room_hours, peak_ccu, messages FROM usage_daily WHERE project_id = ?`)
      .bind(projectId)
      .first<{ room_hours: number; peak_ccu: number; messages: number }>();
    expect(row).not.toBeNull();
    expect(row!.room_hours).toBeGreaterThan(0.9);
    expect(row!.room_hours).toBeLessThan(1.1);
    expect(row!.peak_ccu).toBe(2);
    expect(row!.messages).toBe(7);
  });
});

describe("player JWT", () => {
  it("signs and verifies HS256 tokens, rejecting wrong secret and expiry", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt("proj-secret", { sub: "player-1", iat: now, exp: now + 3600 });
    expect(await verifyJwt("proj-secret", token)).toMatchObject({ sub: "player-1" });
    expect(await verifyJwt("wrong-secret", token)).toBeNull();

    const expired = await signJwt("proj-secret", { sub: "p", iat: now - 7200, exp: now - 3600 });
    expect(await verifyJwt("proj-secret", expired)).toBeNull();
  });
});
