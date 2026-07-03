# @tikron/rpg

Isomorphic, deterministic RPG combat core for [Tikron](https://tikron.dev) — data-driven
skills, buffs, effects, stats, and combat math as pure reducers behind one timer-driven
engine. A port of the AAEmu skill system's semantics (stat summation, two-stage hit
resolution, cast pipeline, buff stacking/tolerance, aggro/AI) with hardcoded combat
constants reproduced faithfully. Only dependency: `@tikron/sim`.

```bash
npm i @tikron/rpg
```

No timers, no `Date.now`, no `Math.random`, no DOM/Workers globals. Time is the absolute
`now` (ms) you pass into every entry point; randomness is a single seeded stream. Same
seed + same call sequence ⇒ identical event stream — on the server, in a test, or after a
Durable Object eviction restores from a snapshot.

## The engine loop contract

`tick(now)` is the ONLY driver. A room feeds player intents (`useSkill`, `moveUnit`, …)
whenever they arrive, then calls `tick` once per room tick to advance time and drain the
combat event feed. Everything else — cast/channel timers, projectile travel, buff ticks,
auto-attack swings, NPC AI, regen, combat-state timeouts, death — happens inside `tick`
and comes back as `CombatEvent[]` to broadcast.

```ts
import { CasualRealtimeRoom } from "@tikron/server";
import { RpgEngine, sampleContent, type CombatEvent } from "@tikron/rpg";

class DungeonRoom extends CasualRealtimeRoom {
  private rpg = new RpgEngine(sampleContent, { seed: 0xC0FFEE });

  onReady() {
    this.rpg.spawnNpc("boss", { x: 0, y: 0 });
    this.setSimulationInterval((tick) => this.step(tick), 100);
  }

  onJoin(client) {
    this.rpg.spawnPlayer({ id: client.id, pos: { x: 5, y: 0 }, weapon: "sword" });
    this.onMessage("cast", (from, m: { skillId: string; target?: string }) =>
      this.rpg.useSkill(from.id, m.skillId, m.target ? { unitId: m.target } : undefined, this.now()),
    );
  }

  private step(tick: number) {
    for (const ev of this.rpg.tick(this.now())) this.broadcastCombat(ev);
  }

  private broadcastCombat(ev: CombatEvent) {
    /* relay to clients; drive authoritative hp/mp state from `unitPoints`/`damaged`/… */
  }
  private now() { return this.currentTick * 100; }
}
```

Content is a plain JSON-able `ContentPack` (skills, buffs, effects, npcs, weapons);
`validateContent` throws on any dangling id before you ever spawn a unit. The `custom`
effect kind and `registerCustomEffect` are the extension points for game-specific logic.

`getUnit(id)` returns a readonly `UnitView` for HUDs and input gating. It resolves active
crowd-control for you — `stunned`, `rooted`, `silenced`, `sleeping`, and `canMove` (`alive
&& !stunned && !rooted && !sleeping`) — so a room can reject a move client-side without
knowing any buff ids: `if (!engine.getUnit(id)?.canMove) return;`. The same predicates are
exported as functions (`isRooted(engine, unit)`, `isStunned`, …) for use inside `custom`
effect handlers.

## Key API

`new RpgEngine(content, opts?)` · `spawnPlayer` · `spawnNpc` · `useSkill(caster, skillId,
target, now)` · `startAutoAttack` · `moveUnit` · `stopCast` · `resurrect` · `grantXp` ·
`tick(now) → CombatEvent[]` · `getUnit` / `units()` (readonly `UnitView`) ·
`registerCustomEffect` · `serialize()` / `RpgEngine.restore(content, snap, opts?)`.

Pure helpers are exported too — `computeDamage`, `computeHeal`, `rollHitType`,
`computeStat`, `killExp`, `TimerHeap`, `makeRng` — so combat math and scheduling
unit-test without an engine.

## Determinism & persistence

Seed the engine (`opts.seed`), pass a monotonic `now`, and two engines agree tick-for-tick.
`serialize()` returns a JSON-safe snapshot (units, buffs, cooldowns, aggro, AI, cast state,
the timer heap, and the RNG position); `RpgEngine.restore(content, snap)` resumes with
byte-identical subsequent behavior — the eviction-survival path for a Durable Object room.

The snapshot also captures the engine **options** it ran under (`pvpEnabled`,
`combatTimeoutMs`, `aiIntervalMs`, `regenIntervalMs`, `maxUnits`), so a restored fight keeps
the same rules rather than silently reverting to defaults. Pass an explicit `opts` to
`restore(content, snap, opts?)` only to *override* specific fields (the seed always comes
from the snapshot). One thing is **not** serialized: `custom` effect handlers. Re-call
`registerCustomEffect` after every `restore`, or any `custom` effect is a no-op until you do.

**Clock base after restore.** The snapshot is stamped with `RpgSnapshot.nowMs` (a public
field: the last absolute ms the engine advanced to). A room's `currentTick` restarts at 0
on a DO cold start, so `currentTick * tickMs` would jump *behind* `nowMs` and freeze every
timer. Rebase your clock onto the snapshot so `now` stays monotonic across the restore:

```ts
const snap = load();                       // your persisted RpgSnapshot
const engine = RpgEngine.restore(content, snap);
const clockBase = snap.nowMs;              // engine time at eviction
// each tick: feed absolute ms that only ever increase
engine.tick(clockBase + this.currentTick * this.tickMs);
```

As a backstop, `tick(now)` clamps `now = max(now, internalNow)` and never rewinds — a
too-small `now` stalls rather than corrupts — but the clamp only prevents damage; you still
need the rebase above for time to actually keep flowing.

## Gotchas

- **`setEquipmentModifiers` does not top up pools.** A gear/buff source that raises `maxHp`
  or `maxMp` (flat) lifts the ceiling but leaves current `hp`/`mp` where they are (it only
  clamps them *down* if the max drops). Heal/refill explicitly if you want the new headroom
  filled on equip.

## Links & license

[tikron.dev](https://tikron.dev) ·
[AGENTS.md](https://github.com/ONOFFERDEV/tikron-platform/blob/main/AGENTS.md).
Licensed under the **Tikron License 1.0** (adapted from FSL-1.1) — converts to
**Apache-2.0** one year after each release. See LICENSE.
