import { SELF, env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import type { Env } from "../src/index.js";
import { playerOnAuth } from "../src/index.js";
import { createProject } from "../src/platform/db.js";
import { signJwt } from "../src/platform/jwt.js";

const db = () => (env as unknown as Env).DB!;
const testEnv = () => env as unknown as Env;

async function connect(room: string, params: Record<string, string>) {
  const q = new URLSearchParams(params);
  const res = await SELF.fetch(`https://example.com/parties/agar-room/${room}?${q.toString()}`, {
    headers: { Upgrade: "websocket" },
  });
  const ws = res.webSocket;
  if (!ws) throw new Error(`no ws upgrade, HTTP ${res.status}`);
  const frames: any[] = [];
  const waiters: (() => void)[] = [];
  ws.addEventListener("message", (e) => {
    if (typeof e.data === "string") frames.push(JSON.parse(e.data));
    waiters.splice(0).forEach((f) => f());
  });
  ws.accept();
  return {
    ws,
    async waitFrame(pred: (f: any) => boolean, ms = 3000): Promise<any> {
      const deadline = Date.now() + ms;
      for (;;) {
        const hit = frames.find(pred);
        if (hit) return hit;
        if (Date.now() > deadline) throw new Error("timeout");
        await new Promise<void>((r) => {
          const t = setTimeout(r, Math.max(1, deadline - Date.now()));
          waiters.push(() => {
            clearTimeout(t);
            r();
          });
        });
      }
    },
  };
}

// A project with require_player_auth=1 makes the room's onAuth enforce a JWT. In
// the dev-bypass test env, a client-supplied `_project`/`_auth` passes through to
// the room, which is enough to exercise the auth hook end-to-end.
describe("player-token room auth (require_player_auth)", () => {
  it("accepts a valid token and rejects a missing/invalid one", async () => {
    const project = await createProject(db(), {
      id: crypto.randomUUID(),
      ownerGithubId: "dev-owner",
      name: "auth-proj",
      playerJwtSecret: "player-secret",
    });
    await db().prepare(`UPDATE projects SET require_player_auth = 1 WHERE id = ?`).bind(project.id).run();

    const now = Math.floor(Date.now() / 1000);
    const good = await signJwt("player-secret", { sub: "p1", iat: now, exp: now + 3600 });

    const ok = await connect("auth-ok", { _project: project.id, _auth: good });
    const welcome = await ok.waitFrame((f) => f.t === "s:welcome");
    expect(welcome.room).toBe("auth-ok");
    ok.ws.close();

    const noToken = await connect("auth-missing", { _project: project.id });
    const err = await noToken.waitFrame((f) => f.t === "s:error");
    expect(err.code).toBe("unauthorized");
    noToken.ws.close();

    const badToken = await connect("auth-bad", { _project: project.id, _auth: "not-a-jwt" });
    const err2 = await badToken.waitFrame((f) => f.t === "s:error");
    expect(err2.code).toBe("unauthorized");
    badToken.ws.close();
  });
});

// The wire can't reveal whether onAuth returned `true` or `{id, claims}` (both
// accept the connect), so the F094 identity contract is verified against the
// exported onAuth function directly.
describe("playerOnAuth identity contract (F094)", () => {
  it("returns {id, claims} for a valid JWT, false for missing/invalid, true when enforcement is off", async () => {
    const secret = "player-secret-f094";
    const project = await createProject(db(), {
      id: crypto.randomUUID(),
      ownerGithubId: "auth-id-owner",
      name: "auth-id",
      playerJwtSecret: secret,
    });
    await db().prepare(`UPDATE projects SET require_player_auth = 1 WHERE id = ?`).bind(project.id).run();

    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt(secret, { sub: "player-42", iat: now, exp: now + 3600 });

    // Valid token → the verified sub becomes client.auth.id, with claims attached.
    const ok = await playerOnAuth(testEnv(), {
      roomId: "r",
      projectId: project.id,
      token,
      session: null,
    });
    expect(ok).toMatchObject({ id: "player-42" });
    expect((ok as { claims: { sub: string } }).claims.sub).toBe("player-42");

    // Missing / invalid token under enforcement → false (rejected).
    expect(
      await playerOnAuth(testEnv(), { roomId: "r", projectId: project.id, token: null, session: null }),
    ).toBe(false);
    expect(
      await playerOnAuth(testEnv(), { roomId: "r", projectId: project.id, token: "nope", session: null }),
    ).toBe(false);

    // A project with enforcement OFF (default) → true, no verified identity.
    const open = await createProject(db(), {
      id: crypto.randomUUID(),
      ownerGithubId: "auth-id-owner",
      name: "open",
      playerJwtSecret: secret,
    });
    expect(
      await playerOnAuth(testEnv(), { roomId: "r", projectId: open.id, token: null, session: null }),
    ).toBe(true);

    // No project id (dev / unmetered) → true.
    expect(
      await playerOnAuth(testEnv(), { roomId: "r", projectId: null, token: null, session: null }),
    ).toBe(true);
  });
});
