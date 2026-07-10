import { describe, it, expect } from "vitest";
import { WEAPONS, GRENADE, PLAYER, type WeaponSpec } from "../src/config.js";
import { blastDamage } from "../src/grenade.js";
import { GAME } from "../src/game-config.js";
import { balanceReport, ttkMs, type TtkPlayer } from "./ttk-lib.js";

/**
 * M1 gate (PLAN-IRONSIGHT §5): the time-to-kill table by weapon × range × body part,
 * plus the balance heuristics that keep any one weapon from ruling every range.
 *
 * Split for M4 W3 (theme-swap gate): the [blueprint] describe below reads
 * `GAME.weapons`/`GAME.grenade` — whichever theme is currently loaded — and checks
 * the heuristic generically (no weapon name assumed), so it's the describe that
 * should stay green across a config swap (see test/ttk-lib.ts for the shared math).
 * The [config: ironsight] describe reads `WEAPONS`/`GRENADE` straight from
 * src/config.ts (always ironsight's own roster, regardless of what's loaded into
 * GAME) and hardcodes its weapon names — expected to be excluded when a different
 * roster is swapped in.
 */

const RANGES = [5, 15, 30] as const;

function playerOf(p: { radius: number; headRadius: number; standHeight: number; standEye: number; maxHp: number }): TtkPlayer {
  return { radius: p.radius, headRadius: p.headRadius, standHeight: p.standHeight, standEye: p.standEye, maxHp: p.maxHp };
}

describe("TTK balance heuristic [blueprint] — holds for any 5-weapon roster", () => {
  const weapons = GAME.weapons;
  const P = playerOf(GAME.player);

  it("prints the TTK table (body / head ms, by range)", () => {
    const cell = (v: number): string => (v === Infinity ? "∞" : String(Math.round(v)));
    const header = "weapon".padEnd(9) + RANGES.map((r) => `${r}m (body/head)`.padStart(16)).join("");
    const lines = [header];
    for (const w of weapons) {
      const row = RANGES.map((r) => `${cell(ttkMs(w, r, "body", P))}/${cell(ttkMs(w, r, "head", P))}`.padStart(16)).join("");
      lines.push(w.name.padEnd(9) + row);
    }
    // eslint-disable-next-line no-console
    console.log("\nTTK (ms) — first shot → kill shot\n" + lines.join("\n") + "\n");
    expect(lines.length).toBe(weapons.length + 1);
  });

  it("no weapon dominates every range — the best differs across ≥3 bands", () => {
    const report = balanceReport(weapons, RANGES, P);
    expect(report.distinctBests).toBeGreaterThanOrEqual(3);
  });

  it("every range band has ≥3 weapons that can kill (no forced pick)", () => {
    const report = balanceReport(weapons, RANGES, P);
    for (const r of RANGES) expect(report.killersByRange[r]).toBeGreaterThanOrEqual(3);
  });

  it("a grenade is not a one-shot, even a direct blast on yourself", () => {
    expect(blastDamage(GAME.grenade.maxDamage, GAME.grenade.radius, 0)).toBeLessThan(GAME.player.maxHp);
  });
});

describe("TTK balance — ironsight roster specifics [config: ironsight]", () => {
  const P = playerOf(PLAYER);
  const spec = (name: string): WeaponSpec => WEAPONS.find((w) => w.name === name)!;

  it("close range (5 m) belongs to the shotgun", () => {
    expect(balanceReport(WEAPONS, [5], P).bestByRange[5]).toBe("Shotgun");
    expect(ttkMs(spec("Shotgun"), 5, "body", P)).toBe(0); // point-blank one-shot
  });

  it("mid range (15 m) goes to an automatic, not the shotgun or the sniper", () => {
    const b = balanceReport(WEAPONS, [15], P).bestByRange[15];
    expect(b).not.toBe("Shotgun");
    expect(b).not.toBe("Sniper");
  });

  it("long range (30 m) drops the close-range weapons (not shotgun, not SMG)", () => {
    const b = balanceReport(WEAPONS, [30], P).bestByRange[30];
    expect(b).not.toBe("Shotgun");
    expect(b).not.toBe("SMG");
  });

  it("the shotgun falls off a cliff: 30 m body TTK ≥ 2× the AR's", () => {
    expect(ttkMs(spec("Shotgun"), 30, "body", P)).toBeGreaterThanOrEqual(
      2 * ttkMs(spec("AR"), 30, "body", P),
    );
  });

  it("the sniper one-shots on a headshot at every range", () => {
    for (const r of RANGES) expect(ttkMs(spec("Sniper"), r, "head", P)).toBe(0);
  });

  it("a grenade is not a one-shot, even a direct blast on yourself", () => {
    expect(blastDamage(GRENADE.maxDamage, GRENADE.radius, 0)).toBeLessThan(PLAYER.maxHp);
  });
});
