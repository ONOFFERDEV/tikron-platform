export type PingIntent = 'context' | 'go' | 'backup';

/** A tap marks immediately on release; a hold requires a deliberate direction. */
export class PingGesture {
  key: string | undefined;
  private startedAt = 0;
  x = 0;
  y = 0;
  open = false;
  selection: PingIntent | undefined;
  begin(key: string, now: number): void {
    if (this.key) return;
    this.key = key; this.startedAt = now; this.x = this.y = 0;
    this.open = false; this.selection = undefined;
  }
  update(now: number): void { if (this.key && now - this.startedAt >= 250) this.open = true; }
  move(x: number, y: number, now: number): boolean {
    this.update(now);
    if (!this.open) return false;
    this.x = Math.max(-100, Math.min(100, this.x + x));
    this.y = Math.max(-100, Math.min(100, this.y + y));
    this.selection = Math.hypot(this.x, this.y) < 24 ? undefined :
      this.y < -Math.abs(this.x) ? 'context' : this.x < 0 ? 'go' : 'backup';
    return true;
  }
  release(key: string, now: number): PingIntent | undefined {
    if (key !== this.key) return;
    this.update(now);
    const result = this.open ? this.selection : 'context';
    this.cancel(); return result;
  }
  cancel(): void { this.key = undefined; this.open = false; this.selection = undefined; }
}

