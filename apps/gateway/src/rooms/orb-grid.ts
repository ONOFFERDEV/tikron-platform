/**
 * Incremental uniform grid over orb positions for the agar demo's collision check.
 *
 * `collectOrbs` used to scan every orb on every move — O(orbs) per input, the
 * dominant per-move cost at 100 players. This buckets orbs into square cells of
 * side `cellSize`; with the cell side equal to the collect radius, any orb within
 * that radius of a player is guaranteed to lie in the 3×3 block of cells around the
 * player's own cell. So {@link forEachNear} visits only those 9 cells — the caller
 * still distance-tests each candidate, giving a result IDENTICAL to the full scan,
 * just without touching orbs that could not possibly be in range.
 *
 * Unlike the server's per-flush `aoi-grid` (rebuilt wholesale each flush), this grid
 * is long-lived and mutated in place ({@link add} / {@link remove}) as orbs are
 * collected and respawned, so it never re-buckets the whole set.
 */

const KEY_OFFSET = 1 << 15;
const KEY_STRIDE = 1 << 16;

export class OrbGrid {
  private readonly cells = new Map<number, Set<string>>();

  constructor(private readonly cellSize: number) {}

  /** Pack a signed cell index into one integer key (see aoi-grid for the scheme). */
  private key(x: number, y: number): number {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return (cx + KEY_OFFSET) * KEY_STRIDE + (cy + KEY_OFFSET);
  }

  /** Drop every bucket (used to reseed the grid from a restored orb set). */
  clear(): void {
    this.cells.clear();
  }

  /** Bucket orb `id` at world position `(x, y)`. */
  add(id: string, x: number, y: number): void {
    const k = this.key(x, y);
    const cell = this.cells.get(k);
    if (cell) cell.add(id);
    else this.cells.set(k, new Set([id]));
  }

  /** Remove orb `id` (its position must match what it was added with). */
  remove(id: string, x: number, y: number): void {
    const k = this.key(x, y);
    const cell = this.cells.get(k);
    if (!cell) return;
    cell.delete(id);
    if (cell.size === 0) this.cells.delete(k);
  }

  /**
   * Visit every orb id whose cell falls in the 3×3 block around `(x, y)` — a
   * superset of the orbs within one cell-side of the point, which the caller then
   * distance-tests. `visit` may {@link remove} the id it is handed (safe: deleting
   * the current element mid-iteration is well-defined); it must NOT {@link add}
   * during the walk (defer new inserts until after), or a fresh orb could be
   * visited in the same pass.
   */
  forEachNear(x: number, y: number, visit: (id: string) => void): void {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const cell = this.cells.get((gx + KEY_OFFSET) * KEY_STRIDE + (gy + KEY_OFFSET));
        if (!cell) continue;
        for (const id of cell) visit(id);
      }
    }
  }
}
