import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { decodeFull, applyDelta, type Codec } from "@tikron/schema";
import { ShooterSchema, SHOOTER, WEAPONS } from "../src/rooms/shooter-schema.js";

type Frame = Record<string, any>;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Minimal state client (see shooter.test.ts for the annotated original). */
async function stateClient(room: string) {
  const res = await SELF.fetch(`https://example.com/parties/shooter-room/${room}`, {
    headers: { Upgrade: "websocket" },
  });
  const ws = res.webSocket!;
  let state: any;
  const msgs: Frame[] = [];
  let notify: (() => void)[] = [];
  ws.addEventListener("message", (e) => {
    if (typeof e.data === "string") msgs.push(JSON.parse(e.data) as Frame);
    else {
      const bytes = new Uint8Array(e.data as ArrayBuffer);
      state =
        bytes[0] === 1
          ? decodeFull(ShooterSchema as Codec<any>, bytes.subarray(13))
          : applyDelta(ShooterSchema as Codec<any>, state, bytes.subarray(13));
    }
    const n = notify;
    notify = [];
    n.forEach((f) => f());
  });
  ws.accept();
  const wait = async <T>(pred: () => T | undefined, ms: number): Promise<T> => {
    const deadline = Date.now() + ms;
    for (;;) {
      const v = pred();
      if (v !== undefined) return v;
      if (Date.now() > deadline) throw new Error("timeout");
      await new Promise<void>((r) => {
        const t = setTimeout(r, 50);
        notify.push(() => {
          clearTimeout(t);
          r();
        });
      });
    }
  };
  return {
    ws,
    send: (type: string, payload?: unknown, seq = 1, ts?: number) =>
      ws.send(JSON.stringify({ t: "c:msg", type, seq, ...(ts !== undefined ? { ts } : {}), payload })),
    waitState: (pred: (s: any) => boolean, ms = 4000) =>
      wait(() => (state !== undefined && pred(state) ? state : undefined), ms),
    waitMsg: (pred: (m: Frame) => boolean, ms = 4000) =>
      wait(() => {
        const i = msgs.findIndex(pred);
        return i >= 0 ? msgs.splice(i, 1)[0] : undefined;
      }, ms),
    myId: () => wait(() => msgs.find((m) => m.t === "s:welcome")?.connectionId as string, 4000),
  };
}

describe("ShooterRoom fun pass (weapons / protection / zone / round)", () => {
  it("initializes the round state: zone covers the map, pickups armed, round clock set", async () => {
    const a = await stateClient("fun-init");
    const s = await a.waitState((st) => typeof st.roundEndMs === "number" && st.roundEndMs > 0);
    expect(s.zr).toBeGreaterThan(3000); // opening radius covers the arena
    expect(s.zx).toBeGreaterThan(0);
    expect(s.roundEndMs).toBeGreaterThan(Date.now() - 5000); // a live, future-ish clock
    // All pickup spots armed at round start.
    for (let i = 0; i < SHOOTER.pickupCount; i++) expect(s.pickups[String(i)]?.on).toBe(true);
    expect(s.broken).toEqual({});
    a.ws.close();
  });

  it("spawns protected, expires after ~2 s, and firing ends it early", async () => {
    const a = await stateClient("fun-prot");
    const id = await a.myId();
    const fresh = await a.waitState((s) => s.players?.[id] !== undefined);
    expect(fresh.players[id].sp).toBe(true);
    // Firing drops the shield immediately (no shooting from behind it).
    a.send("shoot", { dir: 0 }, 2, Date.now());
    const after = await a.waitState((s) => s.players?.[id]?.sp === false, 3000);
    expect(after.players[id].sp).toBe(false);
    a.ws.close();

    const b = await stateClient("fun-prot2");
    const idB = await b.myId();
    await b.waitState((s) => s.players?.[idB]?.sp === true);
    // Untouched, it expires on its own after spawnProtectMs (~2 s).
    const expired = await b.waitState((s) => s.players?.[idB]?.sp === false, 4000);
    expect(expired.players[idB].sp).toBe(false);
    b.ws.close();
  });

  it("swaps weapons through the shared WEAPONS table and ignores invalid indices", async () => {
    const a = await stateClient("fun-weap");
    const id = await a.myId();
    await a.waitState((s) => s.players?.[id] !== undefined);
    a.send("weapon", { w: 1 }, 2);
    const sg = await a.waitState((s) => s.players?.[id]?.w === 1);
    expect(WEAPONS[sg.players[id].w]!.name).toBe("SHOTGUN");
    a.send("weapon", { w: 99 }, 3); // out of range — ignored
    a.send("weapon", { w: 2 }, 4);
    const smg = await a.waitState((s) => s.players?.[id]?.w === 2);
    expect(WEAPONS[smg.players[id].w]!.name).toBe("SMG");
    a.ws.close();
  });

  it("locks the weapon tuning: rifle 20-mag, shotgun 4× dmg & unlimited, smg 40-mag & faster", () => {
    expect(WEAPONS[0]!.mag).toBe(20);
    expect(WEAPONS[1]!.damage).toBe(64); // 16 → ×4
    expect(WEAPONS[1]!.mag).toBe(0); // unlimited (no reload)
    expect(WEAPONS[2]!.mag).toBe(40);
    expect(WEAPONS[2]!.cooldownMs).toBe(40); // 55 → faster
  });

  it("drains the rifle's 20-round mag, then forces a reload", async () => {
    const a = await stateClient("fun-ammo");
    const id = await a.myId();
    await a.waitState((s) => s.players?.[id] !== undefined);
    // Drain the mag. Space shots past the 100 ms cooldown so none are cooldown-
    // rejected before the ammo logic; each accepted shot echoes an owner-only `ammo`.
    let last: any;
    for (let i = 0; i < 20; i++) {
      a.send("shoot", { dir: 0 }, 10 + i, Date.now());
      last = await a.waitMsg((m) => m.t === "s:msg" && m.type === "ammo");
      await sleep(110);
    }
    expect(last.payload.n).toBe(0); // the 20th shot emptied it
    expect(last.payload.rl).toBeGreaterThan(0); // and kicked off a reload
    // Clear the self-delivered `shot` events buffered during the drain (the shooter
    // is in its own AOI), so the next assertion only sees a fresh shot (or none).
    for (;;) {
      try {
        await a.waitMsg((m) => m.t === "s:msg" && m.type === "shot", 50);
      } catch {
        break;
      }
    }
    // Firing while reloading is rejected: no new `shot` event lands.
    a.send("shoot", { dir: 0 }, 200, Date.now());
    await expect(a.waitMsg((m) => m.t === "s:msg" && m.type === "shot", 300)).rejects.toThrow();
    a.ws.close();
  });

  it("never gates the unlimited shotgun with a reload (no ammo echo)", async () => {
    const a = await stateClient("fun-sg-ammo");
    const id = await a.myId();
    await a.waitState((s) => s.players?.[id] !== undefined);
    a.send("weapon", { w: 1 }, 2);
    await a.waitState((s) => s.players?.[id]?.w === 1);
    // A shotgun shot lands (a `shot` event) but never an `ammo` echo — mag 0 = unlimited.
    a.send("shoot", { dir: 0 }, 3, Date.now());
    await a.waitMsg((m) => m.t === "s:msg" && m.type === "shot");
    await expect(a.waitMsg((m) => m.t === "s:msg" && m.type === "ammo", 300)).rejects.toThrow();
    a.ws.close();
  });
});
