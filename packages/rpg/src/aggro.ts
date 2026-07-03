/**
 * Aggro table — per-NPC threat ledger. Threat total = `damage + 0.6·heal`, so healing a
 * tank's allies still pulls mobs (at 60% weight). Damage/heal contributions are stored
 * already scaled by the attacker's aggroMul and the NPC's incomingAggroMul (the caller
 * folds those in at insert). Target selection is highest-total among living attackers,
 * switching immediately with no threshold — matching AAEmu's no-decay model.
 */

/** Accumulated threat one attacker has built on an NPC. */
export interface AggroEntry {
  damage: number;
  heal: number;
}

/** Heal-to-threat weight (AAEmu constant). */
export const HEAL_THREAT_WEIGHT = 0.6;

export class AggroTable {
  private table = new Map<string, AggroEntry>();

  /** Add `value` threat of a kind for `unitId` (value pre-scaled by the caller). */
  add(unitId: string, kind: "damage" | "heal", value: number): void {
    if (value <= 0 && !this.table.has(unitId)) {
      // Still register a zero entry so a pure-taunt / help-link attacker becomes a target.
      this.table.set(unitId, { damage: 0, heal: 0 });
    }
    const e = this.table.get(unitId) ?? { damage: 0, heal: 0 };
    if (kind === "damage") e.damage += value;
    else e.heal += value;
    this.table.set(unitId, e);
  }

  /** Combined threat for one attacker (0 if absent). */
  total(unitId: string): number {
    const e = this.table.get(unitId);
    if (!e) return 0;
    return e.damage + HEAL_THREAT_WEIGHT * e.heal;
  }

  has(unitId: string): boolean {
    return this.table.has(unitId);
  }

  get size(): number {
    return this.table.size;
  }

  /**
   * The highest-threat attacker `isAlive` reports as still valid, or `undefined` when
   * the table is empty or all entries are dead. Ties resolve to insertion order.
   */
  top(isAlive: (unitId: string) => boolean): string | undefined {
    let best: string | undefined;
    let bestTotal = -Infinity;
    for (const [id, e] of this.table) {
      if (!isAlive(id)) continue;
      const total = e.damage + HEAL_THREAT_WEIGHT * e.heal;
      if (total > bestTotal) {
        bestTotal = total;
        best = id;
      }
    }
    return best;
  }

  remove(unitId: string): void {
    this.table.delete(unitId);
  }

  clear(): void {
    this.table.clear();
  }

  entries(): [string, AggroEntry][] {
    return [...this.table.entries()];
  }

  /** Restore from serialized entries (insertion order preserved for tie determinism). */
  static from(entries: readonly [string, AggroEntry][]): AggroTable {
    const t = new AggroTable();
    for (const [id, e] of entries) t.table.set(id, { damage: e.damage, heal: e.heal });
    return t;
  }
}
