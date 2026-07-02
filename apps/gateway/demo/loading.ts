/**
 * Loading flow state machine for the shooter demo — a pure, DOM-free progress
 * aggregator so the PLAY → in-game transition can be unit tested without a
 * browser. The client drives it (`start`, `setProgress`, `complete`, `fail`) as
 * assets preload and the room connects; the renderer reads {@link LoadingView}
 * snapshots to paint the branded progress bar and stage labels.
 *
 * Overall progress is a weighted blend of the per-stage fractions (a `done`
 * stage counts as 1, `pending` as 0, `active` as its reported fraction), so a
 * heavier stage (asset preload) moves the bar more than a light one (matchmake).
 */
export type StageStatus = "pending" | "active" | "done" | "error";

export interface StageDef {
  id: string;
  label: string;
  /** Relative share of the overall bar (any positive number; normalized). */
  weight: number;
}

export interface StageView extends StageDef {
  status: StageStatus;
  /** 0..1 within this stage. */
  progress: number;
}

export interface LoadingView {
  status: "idle" | "loading" | "done" | "error";
  /** 0..1 across all stages, weighted. */
  progress: number;
  /** Current active stage label, the error text on failure, or "Ready" when done. */
  label: string;
  /** The id of the stage that failed, if any. */
  failedStage?: string;
  error?: string;
  stages: StageView[];
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export class LoadingFlow {
  private readonly stages: StageView[];
  private readonly totalWeight: number;
  private status: LoadingView["status"] = "idle";
  private error?: string;
  private failedStage?: string;
  private readonly listeners = new Set<(v: LoadingView) => void>();

  constructor(defs: StageDef[]) {
    if (defs.length === 0) throw new Error("LoadingFlow needs at least one stage");
    this.stages = defs.map((d) => ({ ...d, status: "pending", progress: 0 }));
    this.totalWeight = defs.reduce((sum, d) => sum + Math.max(0, d.weight), 0) || 1;
  }

  /** Subscribe to snapshots (fired on every state change). Returns an unsubscribe. */
  onChange(fn: (v: LoadingView) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Enter the loading state and activate the first stage. */
  start(): void {
    this.reset();
    this.status = "loading";
    const first = this.stages[0]!;
    first.status = "active";
    this.emit();
  }

  /** Update the fraction (0..1) of a stage; only meaningful while it is active. */
  setProgress(id: string, fraction: number): void {
    const stage = this.stages.find((s) => s.id === id);
    if (!stage || stage.status === "done" || stage.status === "error") return;
    stage.status = "active";
    stage.progress = clamp01(fraction);
    this.emit();
  }

  /** Mark a stage done and activate the next pending stage (or finish). */
  complete(id: string): void {
    const idx = this.stages.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const stage = this.stages[idx]!;
    stage.status = "done";
    stage.progress = 1;
    const next = this.stages.find((s) => s.status === "pending");
    if (next) {
      next.status = "active";
    } else {
      this.status = "done";
    }
    this.emit();
  }

  /** Fail a stage — moves the whole flow into the error state with a message. */
  fail(id: string, message: string): void {
    const stage = this.stages.find((s) => s.id === id);
    if (stage) stage.status = "error";
    this.status = "error";
    this.error = message;
    this.failedStage = id;
    this.emit();
  }

  /** Reset every stage to pending and clear any error (used before a retry). */
  reset(): void {
    for (const s of this.stages) {
      s.status = "pending";
      s.progress = 0;
    }
    this.status = "idle";
    this.error = undefined;
    this.failedStage = undefined;
    this.emit();
  }

  /** Current immutable snapshot. */
  view(): LoadingView {
    let acc = 0;
    for (const s of this.stages) {
      const frac = s.status === "done" ? 1 : s.status === "active" ? s.progress : 0;
      acc += frac * Math.max(0, s.weight);
    }
    const progress = clamp01(acc / this.totalWeight);
    let label: string;
    if (this.status === "error") label = this.error ?? "Something went wrong";
    else if (this.status === "done") label = "Ready";
    else label = this.stages.find((s) => s.status === "active")?.label ?? this.stages[0]!.label;
    return {
      status: this.status,
      progress,
      label,
      failedStage: this.failedStage,
      error: this.error,
      stages: this.stages.map((s) => ({ ...s })),
    };
  }

  private emit(): void {
    const v = this.view();
    for (const fn of this.listeners) fn(v);
  }
}
