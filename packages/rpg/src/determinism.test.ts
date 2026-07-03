import { describe, expect, it } from "vitest";
import { RpgEngine } from "./engine.js";
import type { CombatEvent } from "./events.js";
import { sampleContent } from "./sample-content.js";

/** Run a fixed scripted scenario and return the full concatenated event stream. */
function run(seed: number): CombatEvent[] {
  const e = new RpgEngine(sampleContent, { seed, pvpEnabled: false });
  const boss = e.spawnNpc("boss", { x: 0, y: 0 });
  e.spawnPlayer({ id: "warrior", pos: { x: 3, y: 0 }, faction: "players", weapon: "sword", stats: { str: 40 } });
  e.spawnPlayer({ id: "mage", pos: { x: 10, y: 0 }, faction: "players", weapon: "staff", stats: { int: 40, maxMp: 1000 } });

  const events: CombatEvent[] = [];
  e.startAutoAttack("warrior", boss, 0);
  for (let now = 0; now <= 8000; now += 200) {
    if (now === 400) e.useSkill("warrior", "warrior-slash", { unitId: boss }, now);
    if (now === 1000) e.useSkill("mage", "mage-fireball", { unitId: boss }, now);
    if (now === 2000) e.useSkill("warrior", "warrior-bash", { unitId: boss }, now);
    if (now === 3000) e.useSkill("mage", "mage-frost-nova", undefined, now);
    if (now === 4000) e.useSkill("warrior", "warrior-cleave", { unitId: boss }, now);
    for (const ev of e.tick(now)) events.push(ev);
  }
  return events;
}

describe("determinism", () => {
  it("two engines with the same seed and calls emit identical streams", () => {
    const a = run(9001);
    const b = run(9001);
    expect(b).toEqual(a);
    expect(a.length).toBeGreaterThan(50);
  });

  it("a different seed diverges", () => {
    const a = run(1);
    const b = run(2);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});
