import { describe, it, expect } from "vitest";
import { WEAPONS, GRENADE, PLAYER, type WeaponSpec } from "../src/config.js";
import { blastDamage } from "../src/grenade.js";
import { GAME } from "../src/game-config.js";
import { balanceReport, pullDamage, ttkMs, type TtkPlayer } from "./ttk-lib.js";
import { weaponByKey, type WeaponKey } from "../src/weapon-contract.js";

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

const RANGES = [5, 10, 25, 40, 80] as const;

function playerOf(p: { radius: number; headRadius: number; standHeight: number; standEye: number; maxHp: number }): TtkPlayer {
  return { radius: p.radius, headRadius: p.headRadius, standHeight: p.standHeight, standEye: p.standEye, maxHp: p.maxHp };
}

describe("TTK balance heuristic [blueprint] — holds for any 5-weapon roster", () => {
  const weapons = GAME.weapons;
  const P = playerOf(GAME.player);

  it("prints the TTK table (body / head ms, by range)", () => {
    const cell = (v: number): string => (v === Infinity ? "∞" : String(Math.round(v)));
    const header = "weapon".padEnd(20) + RANGES.map((r) => `${r}m (body/head)`.padStart(16)).join("");
    const lines = [header];
    for (const w of weapons) {
      const row = RANGES.map((r) => `${cell(ttkMs(w, r, "body", P))}/${cell(ttkMs(w, r, "head", P))}`.padStart(16)).join("");
      lines.push(w.key.padEnd(20) + row);
    }
    // eslint-disable-next-line no-console
    console.log("\nTTK (ms) — first shot → kill shot\n" + lines.join("\n") + "\n");
    console.log(JSON.stringify({
      tag: "ww1WeaponSurface",
      weapons: weapons.map((weapon) => ({
        key: weapon.key,
        index: weapon.slot - 1,
        slot: weapon.slot,
        fireMode: weapon.fireMode,
        reloadKind: weapon.reloadKind,
        sight: weapon.sight,
        tuning: {
          damageBody: weapon.damageBody,
          damageHead: weapon.damageHead,
          fireIntervalMs: weapon.fireIntervalMs,
          mag: weapon.mag,
          reserve: weapon.reserve,
          adsMs: weapon.adsMs,
          sprintToFireMs: weapon.sprintToFireMs,
          reloadMs: weapon.reloadMs,
          range: weapon.range,
          falloffStart: weapon.falloffStart,
          falloffEnd: weapon.falloffEnd,
          falloffMin: weapon.falloffMin,
        },
        distances: RANGES.map((distance) => ({
          distance,
          bodyDamage: pullDamage(weapon, distance, "body", P),
          headDamage: pullDamage(weapon, distance, "head", P),
          bodyTtkMs: ttkMs(weapon, distance, "body", P),
          headTtkMs: ttkMs(weapon, distance, "head", P),
        })),
      })),
    }));
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
  const spec = (key: WeaponKey): WeaponSpec => weaponByKey(WEAPONS, key);

  it("close range (5 m) belongs to the shotgun", () => {
    expect(balanceReport(WEAPONS, [5], P).bestByRange[5]).toBe("pump_shotgun");
    expect(ttkMs(spec("pump_shotgun"), 5, "body", P)).toBe(0); // point-blank one-shot
  });

  it("mid range (15 m) goes to an automatic, not the shotgun or the sniper", () => {
    const b = balanceReport(WEAPONS, [15], P).bestByRange[15];
    expect(b).not.toBe("pump_shotgun");
    expect(b).not.toBe("bolt_service_rifle");
  });

  it("long range (30 m) drops the close-range weapons (not shotgun, not SMG)", () => {
    const b = balanceReport(WEAPONS, [30], P).bestByRange[30];
    expect(b).not.toBe("pump_shotgun");
    expect(b).not.toBe("trench_smg");
  });

  it("the shotgun falls off a cliff: 30 m body TTK ≥ 2× the AR's", () => {
    expect(ttkMs(spec("pump_shotgun"), 30, "body", P)).toBeGreaterThanOrEqual(
      2 * ttkMs(spec("automatic_rifle"), 30, "body", P),
    );
  });

  it("the sniper one-shots on a headshot at every range", () => {
    for (const r of RANGES) expect(ttkMs(spec("bolt_service_rifle"), r, "head", P)).toBe(0);
  });

  it("matches the approved theoretical close-range body TTK", () => {
    expect({
      automatic_rifle: ttkMs(spec("automatic_rifle"), 5, "body", P),
      trench_smg: ttkMs(spec("trench_smg"), 5, "body", P),
      bolt_service_rifle: ttkMs(spec("bolt_service_rifle"), 5, "body", P),
      service_pistol: ttkMs(spec("service_pistol"), 5, "body", P),
    }).toEqual({ automatic_rifle: 330, trench_smg: 320, bolt_service_rifle: 1100, service_pistol: 400 });
  });

  it("a grenade is not a one-shot, even a direct blast on yourself", () => {
    expect(blastDamage(GRENADE.maxDamage, GRENADE.radius, 0)).toBeLessThan(PLAYER.maxHp);
  });
});
