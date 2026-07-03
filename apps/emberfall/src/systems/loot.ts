import { rollChance, rollRange, pickWeighted, type Rng } from "@tikron/rpg";

/**
 * Per-mob loot tables + the roll (PLAN-EMBERFALL-M2 §3) — gold range plus weighted item
 * drops, keyed by `NpcDef.id` from `content/emberfall-content.ts`. Pure: takes an
 * injected `Rng` (never `Math.random`), so callers control determinism (a room's own
 * seeded stream, or a fixed seed in a test).
 */
export interface LootDrop {
  defId: string;
  /** Percent chance [0, 100] this drop rolls at all. */
  chance: number;
  qtyMin: number;
  qtyMax: number;
}

export interface LootTable {
  gold: readonly [number, number];
  drops: readonly LootDrop[];
  /** Boss-only: always grants one item (weighted-equal) from this pool. */
  guaranteedRare?: readonly string[];
  /** Boss-only: percent chance to additionally grant one item from `epicPool`. */
  epicChance?: number;
  epicPool?: readonly string[];
}

export interface LootResult {
  gold: number;
  items: { defId: string; qty: number }[];
}

/** Field species: modest gold + a material/potion chance. Boss: bigger gold, a common
 *  potion chance, a guaranteed rare, and a chance at an epic (PLAN §3: "보스=확정
 *  희귀+확률 영웅"). */
export const LOOT_TABLES: Readonly<Record<string, LootTable>> = {
  wolf: {
    gold: [2, 5],
    drops: [
      { defId: "material-wolf-pelt", chance: 40, qtyMin: 1, qtyMax: 2 },
      { defId: "potion-hp", chance: 10, qtyMin: 1, qtyMax: 1 },
    ],
  },
  goblin_scout: {
    gold: [3, 6],
    drops: [
      { defId: "material-goblin-ear", chance: 35, qtyMin: 1, qtyMax: 1 },
      { defId: "potion-hp", chance: 8, qtyMin: 1, qtyMax: 1 },
    ],
  },
  goblin_thrower: {
    gold: [3, 7],
    drops: [
      { defId: "material-goblin-ear", chance: 30, qtyMin: 1, qtyMax: 1 },
      { defId: "potion-mp", chance: 10, qtyMin: 1, qtyMax: 1 },
    ],
  },
  boar: {
    gold: [4, 8],
    drops: [
      { defId: "material-wolf-pelt", chance: 20, qtyMin: 1, qtyMax: 1 },
      { defId: "armor-leather", chance: 6, qtyMin: 1, qtyMax: 1 },
    ],
  },
  goblin_shaman: {
    gold: [5, 10],
    drops: [
      { defId: "trinket-charm", chance: 8, qtyMin: 1, qtyMax: 1 },
      { defId: "potion-mp", chance: 15, qtyMin: 1, qtyMax: 2 },
    ],
  },
  boss_chief: {
    gold: [30, 60],
    drops: [{ defId: "potion-hp", chance: 60, qtyMin: 2, qtyMax: 3 }],
    guaranteedRare: ["armor-chain", "trinket-ring"],
    epicChance: 25,
    epicPool: ["armor-plate", "trinket-amulet"],
  },
};

/** Roll one kill's loot for `npcDefId`. Unknown ids (e.g. a player kill, or a species
 *  with no table) yield an empty result rather than throwing — a missing loot table is
 *  a content gap, not a reason to break combat. */
export function rollLoot(npcDefId: string, rng: Rng): LootResult {
  const table = LOOT_TABLES[npcDefId];
  if (!table) return { gold: 0, items: [] };

  const gold = Math.round(rollRange(rng, table.gold[0], table.gold[1]));
  const items: { defId: string; qty: number }[] = [];

  for (const drop of table.drops) {
    if (!rollChance(rng, drop.chance)) continue;
    const qty = drop.qtyMin === drop.qtyMax ? drop.qtyMin : Math.round(rollRange(rng, drop.qtyMin, drop.qtyMax));
    items.push({ defId: drop.defId, qty });
  }
  if (table.guaranteedRare && table.guaranteedRare.length > 0) {
    const pick = pickWeighted(rng, table.guaranteedRare, () => 1);
    if (pick) items.push({ defId: pick, qty: 1 });
  }
  if (table.epicPool && table.epicPool.length > 0 && rollChance(rng, table.epicChance ?? 0)) {
    const pick = pickWeighted(rng, table.epicPool, () => 1);
    if (pick) items.push({ defId: pick, qty: 1 });
  }
  return { gold, items };
}
