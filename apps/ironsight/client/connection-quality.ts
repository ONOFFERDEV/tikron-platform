export type DelayBand = 'measuring' | 'low' | 'delayed' | 'high' | 'offline';

/** RTT presentation only. These UX bands do not measure loss, jitter or server health. */
export class ConnectionQuality {
  band: DelayBand = 'measuring';
  private candidate: DelayBand = 'measuring';
  private since = 0;

  update(ms: number, online: boolean, now: number): DelayBand {
    if (!online || !Number.isFinite(ms) || ms <= 0) {
      this.band = online ? 'measuring' : 'offline';
      this.candidate = this.band;
      return this.band;
    }
    // Recovery has a 15/20 ms margin; two seconds of sustained change avoids flicker.
    const next = ms >= 160 || (this.band === 'high' && ms >= 140) ? 'high'
      : ms >= 80 || (this.band === 'delayed' && ms >= 65) ? 'delayed' : 'low';
    if (this.band === 'measuring' || this.band === 'offline') this.band = next;
    if (next !== this.candidate) { this.candidate = next; this.since = now; }
    if (now - this.since >= 2000) this.band = next;
    return this.band;
  }
}

export const DELAY_LABELS: Record<DelayBand, string> = {
  measuring: 'MEASURING DELAY', low: 'LOW DELAY', delayed: 'NETWORK DELAY',
  high: 'HIGH NETWORK DELAY', offline: 'RECONNECTING',
};
