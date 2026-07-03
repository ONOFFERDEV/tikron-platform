/**
 * Timer heap — a deterministic binary min-heap on `dueAt` ms, the single scheduling
 * primitive for buff ticks/expiry, cast commits, effect-delay/projectile applies,
 * channel ticks, and auto-attack swings.
 *
 * Ordering is a total order so replay is bit-identical: `(dueAt, pri, seq)`. `pri`
 * breaks same-instant ties by KIND (ticks before expiries, so a DoT's final tick lands
 * before its removal); `seq` is a monotonic insertion counter breaking the rest FIFO.
 * The whole heap is JSON-snapshotable so serialize/restore reproduces exact fire order.
 */

/** A scheduled entry: fires at `dueAt`, ordered within a tie by `(pri, seq)`. */
export interface TimerNode<T> {
  dueAt: number;
  pri: number;
  seq: number;
  value: T;
}

/** Serializable heap contents for {@link RpgEngine.serialize}. */
export interface TimerHeapSnapshot<T> {
  seq: number;
  nodes: TimerNode<T>[];
}

export class TimerHeap<T> {
  private a: TimerNode<T>[] = [];
  private seqCounter = 0;

  get size(): number {
    return this.a.length;
  }

  /** Order predicate: earlier `dueAt`, then lower `pri`, then lower `seq`. */
  private less(x: TimerNode<T>, y: TimerNode<T>): boolean {
    if (x.dueAt !== y.dueAt) return x.dueAt < y.dueAt;
    if (x.pri !== y.pri) return x.pri < y.pri;
    return x.seq < y.seq;
  }

  /** Schedule `value` at `dueAt`; `pri` sub-orders same-instant fires (default 0). */
  push(dueAt: number, value: T, pri = 0): void {
    this.pushNode({ dueAt, pri, seq: this.seqCounter++, value });
  }

  private pushNode(node: TimerNode<T>): void {
    const a = this.a;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.less(a[i]!, a[parent]!)) {
        [a[i], a[parent]] = [a[parent]!, a[i]!];
        i = parent;
      } else break;
    }
  }

  /** The next fire time, or `undefined` when empty. */
  nextDueAt(): number | undefined {
    return this.a[0]?.dueAt;
  }

  /** Remove and return the earliest value, or `undefined` when empty. */
  popMin(): T | undefined {
    const a = this.a;
    const top = a[0];
    if (top === undefined) return undefined;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      this.siftDown(0);
    }
    return top.value;
  }

  private siftDown(start: number): void {
    const a = this.a;
    const n = a.length;
    let i = start;
    for (;;) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let smallest = i;
      if (l < n && this.less(a[l]!, a[smallest]!)) smallest = l;
      if (r < n && this.less(a[r]!, a[smallest]!)) smallest = r;
      if (smallest === i) break;
      [a[i], a[smallest]] = [a[smallest]!, a[i]!];
      i = smallest;
    }
  }

  /** Pop every value due at or before `now`, in fire order. */
  popDue(now: number): T[] {
    const out: T[] = [];
    for (;;) {
      const d = this.nextDueAt();
      if (d === undefined || d > now) break;
      out.push(this.popMin()!);
    }
    return out;
  }

  /** Remove all entries whose value matches `pred`; returns the count removed. */
  cancel(pred: (value: T) => boolean): number {
    const kept = this.a.filter((n) => !pred(n.value));
    const removed = this.a.length - kept.length;
    if (removed > 0) {
      this.a = [];
      for (const n of kept) this.pushNode(n);
    }
    return removed;
  }

  clear(): void {
    this.a = [];
  }

  /** Snapshot for serialization (values must themselves be JSON-safe). */
  snapshot(): TimerHeapSnapshot<T> {
    return { seq: this.seqCounter, nodes: this.a.map((n) => ({ ...n })) };
  }

  /** Rebuild a heap from a snapshot, preserving `seq` so fire order is identical. */
  static restore<T>(snap: TimerHeapSnapshot<T>): TimerHeap<T> {
    const h = new TimerHeap<T>();
    h.seqCounter = snap.seq;
    for (const n of snap.nodes) h.pushNode({ ...n });
    return h;
  }
}
