import type { Config } from "./cli.js";
import {
  filterByDiscard,
  percentiles,
  spikeHistogram,
  type MetricsBundle,
  type Percentiles,
  type ServerStatBlock,
} from "./metrics.js";

/** ack>1s is treated as a latency spike (GC / warm-up suspect). */
const SPIKE_THRESHOLD_MS = 1000;

/** One room's server-side tick/flush stats as surfaced in the report. */
export interface RoomServerProcessing {
  roomId: string;
  tick: ServerStatBlock | null;
  flush: ServerStatBlock | null;
  windowMs: number | null;
}

export interface Report {
  scenario: string;
  url: string;
  timestamp: string;
  config: {
    rooms: number;
    players: number;
    totalConnections: number;
    durationMs: number;
    hz: number;
    rampMs: number;
    workers: number;
    roomPrefix: string;
    maxClients: number | null;
    discardMs: number;
  };
  /** Warm-up window dropped from steady-state aggregation, and which metrics it hit. */
  discard: { discardMs: number; appliedTo: string[] };
  latencyMs: { inputToAckRtt: Percentiles };
  jitterMs: { stateInterArrival: Percentiles; rawGaps: Percentiles };
  /** Latency-spike (ack>1s) count and per-second distribution from steady start. */
  spikes: { thresholdMs: number; count: number; bySecond: Record<number, number> };
  /** Server tick/flush processing time from `tk:stats` replies (n/a on old servers). */
  serverProcessing: {
    rooms: RoomServerProcessing[];
    summary: { rooms: number; tick: ServerStatBlock | null; flush: ServerStatBlock | null } | null;
  };
  bandwidth: {
    windowMs: number;
    totalDownlinkBytes: number;
    totalUplinkBytes: number;
    downlinkBytesPerSec: number;
    uplinkBytesPerSec: number;
    downlinkBytesPerSecPerClient: number;
    uplinkBytesPerSecPerClient: number;
  };
  stability: {
    clients: number;
    connectSuccess: number;
    connectFailure: number;
    unexpectedCloses: number;
    protocolErrors: number;
    decodeErrors: number;
    stateFrames: number;
    /** Server-broadcast `shot` events received across all clients (fps scenario). */
    shotEvents: number;
  };
  sanity: { ownPresentFrames: number; ownAbsentFrames: number };
  eventLoopLagMs: number | null;
  wallMs: number;
}

export function buildReport(
  config: Config,
  merged: MetricsBundle,
  windowMs: number,
  lagMs: number | null,
  wallMs: number,
): Report {
  const seconds = windowMs / 1000;
  const connected = merged.connectSuccess || merged.clients || 1;
  const down = merged.downlinkBytes / seconds;
  const up = merged.uplinkBytes / seconds;

  // Steady-state latency/jitter drop the warm-up window; bandwidth does not.
  const discardMs = config.discardMs;
  const rtt = filterByDiscard(merged.rtt, merged.rttAt, discardMs);
  const jitter = filterByDiscard(merged.jitter, merged.jitterAt, discardMs);
  const gaps = filterByDiscard(merged.gaps, merged.gapsAt, discardMs);

  return {
    scenario: config.scenario,
    url: config.url,
    timestamp: new Date().toISOString(),
    config: {
      rooms: config.rooms,
      players: config.players,
      totalConnections: config.rooms * config.players,
      durationMs: config.durationMs,
      hz: config.hz,
      rampMs: config.rampMs,
      workers: config.workers,
      roomPrefix: config.roomPrefix,
      maxClients: config.maxClients ?? null,
      discardMs,
    },
    discard: {
      discardMs,
      appliedTo: ["inputToAckRtt", "stateInterArrival", "rawGaps"],
    },
    latencyMs: { inputToAckRtt: percentiles(rtt) },
    jitterMs: { stateInterArrival: percentiles(jitter), rawGaps: percentiles(gaps) },
    // Spikes are measured on the full (undiscarded) rtt stream so warm-up spikes
    // stay visible — that is exactly the signal that tells warm-up from periodic.
    spikes: {
      thresholdMs: SPIKE_THRESHOLD_MS,
      ...spikeHistogram(merged.rtt, merged.rttAt, SPIKE_THRESHOLD_MS),
    },
    serverProcessing: buildServerProcessing(config, merged),
    bandwidth: {
      windowMs,
      totalDownlinkBytes: merged.downlinkBytes,
      totalUplinkBytes: merged.uplinkBytes,
      downlinkBytesPerSec: down,
      uplinkBytesPerSec: up,
      downlinkBytesPerSecPerClient: down / connected,
      uplinkBytesPerSecPerClient: up / connected,
    },
    stability: {
      clients: merged.clients,
      connectSuccess: merged.connectSuccess,
      connectFailure: merged.connectFailure,
      unexpectedCloses: merged.unexpectedCloses,
      protocolErrors: merged.protocolErrors,
      decodeErrors: merged.decodeErrors,
      stateFrames: merged.stateFrames,
      shotEvents: merged.shotEvents,
    },
    sanity: { ownPresentFrames: merged.ownPresentFrames, ownAbsentFrames: merged.ownAbsentFrames },
    eventLoopLagMs: lagMs,
    wallMs,
  };
}

/** Assemble per-room + all-room server tick/flush stats from the merged bundle. */
function buildServerProcessing(config: Config, merged: MetricsBundle): Report["serverProcessing"] {
  const rooms: RoomServerProcessing[] = [];
  for (let r = 0; r < config.rooms; r++) {
    const roomId = `${config.roomPrefix}-r${r}`;
    const s = merged.roomStats[roomId];
    rooms.push({
      roomId,
      tick: s?.tick ?? null,
      flush: s?.flush ?? null,
      windowMs: s?.windowMs ?? null,
    });
  }
  const reporting = rooms.filter((r) => r.tick || r.flush);
  const summary = reporting.length
    ? {
        rooms: reporting.length,
        tick: summarizeBlocks(reporting.map((r) => r.tick)),
        flush: summarizeBlocks(reporting.map((r) => r.flush)),
      }
    : null;
  return { rooms, summary };
}

/**
 * Roll per-room blocks into one. We only have each room's percentiles (not raw
 * samples), so this is an approximation: p50 = median of room p50s, p95/max =
 * worst across rooms, n = total. Null when no room reported the block.
 */
function summarizeBlocks(blocks: (ServerStatBlock | null)[]): ServerStatBlock | null {
  const present = blocks.filter((b): b is ServerStatBlock => b !== null);
  if (present.length === 0) return null;
  const median = (xs: number[]): number => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor((s.length - 1) / 2)] as number;
  };
  return {
    p50: median(present.map((b) => b.p50)),
    p95: Math.max(...present.map((b) => b.p95)),
    max: Math.max(...present.map((b) => b.max)),
    n: present.reduce((a, b) => a + b.n, 0),
  };
}

function ms(v: number): string {
  return `${v.toFixed(2)} ms`;
}

function bytes(v: number): string {
  if (v >= 1024 * 1024) return `${(v / 1024 / 1024).toFixed(2)} MiB`;
  if (v >= 1024) return `${(v / 1024).toFixed(2)} KiB`;
  return `${v.toFixed(0)} B`;
}

function row(label: string, value: string): string {
  return `  ${label.padEnd(30)}${value}`;
}

function pctRow(p: Percentiles): string {
  return `p50 ${p.p50.toFixed(2)}  p95 ${p.p95.toFixed(2)}  p99 ${p.p99.toFixed(2)}  max ${p.max.toFixed(2)}  (n=${p.count})`;
}

function blockRow(b: ServerStatBlock | null): string {
  if (!b) return "n/a";
  return `p50 ${b.p50.toFixed(2)}  p95 ${b.p95.toFixed(2)}  max ${b.max.toFixed(2)}  (n=${b.n})`;
}

function spikeDistribution(bySecond: Record<number, number>): string {
  const secs = Object.keys(bySecond)
    .map(Number)
    .sort((a, b) => a - b);
  if (secs.length === 0) return "none";
  return secs.map((s) => `${s < 0 ? "ramp" : `${s}s`}:${bySecond[s]}`).join("  ");
}

export function formatSummary(r: Report): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(
    `=== Tikron load test · ${r.scenario} · ${r.config.totalConnections} conns ` +
      `(${r.config.rooms} rooms × ${r.config.players}) · ${r.config.workers} worker(s) ===`,
  );
  lines.push(`  ${r.url}   ${(r.config.durationMs / 1000).toFixed(0)}s @ ${r.config.hz}Hz`);
  lines.push("");
  const discardNote =
    r.discard.discardMs > 0
      ? ` · discard first ${(r.discard.discardMs / 1000).toFixed(0)}s (${r.discard.appliedTo.join(", ")})`
      : "";
  lines.push(`Latency — input→ack RTT (ms)${discardNote}`);
  lines.push(row("", pctRow(r.latencyMs.inputToAckRtt)));
  lines.push("");
  lines.push("Jitter — |state gap − expected| (ms)");
  lines.push(row("", pctRow(r.jitterMs.stateInterArrival)));
  lines.push(row("raw inter-arrival gaps", pctRow(r.jitterMs.rawGaps)));
  lines.push("");
  lines.push(`Latency spikes — ack>${(r.spikes.thresholdMs / 1000).toFixed(0)}s`);
  lines.push(row("count", String(r.spikes.count)));
  lines.push(row("by second (from steady start)", spikeDistribution(r.spikes.bySecond)));
  lines.push("");
  lines.push("Server processing — tick / flush (ms, from tk:stats)");
  for (const room of r.serverProcessing.rooms) {
    const win = room.windowMs !== null ? ` [${(room.windowMs / 1000).toFixed(0)}s win]` : "";
    lines.push(row(`${room.roomId} · tick`, blockRow(room.tick)));
    lines.push(row(`${room.roomId} · flush`, `${blockRow(room.flush)}${win}`));
  }
  if (r.serverProcessing.summary) {
    const s = r.serverProcessing.summary;
    lines.push(row(`all rooms (n=${s.rooms}) · tick`, blockRow(s.tick)));
    lines.push(row(`all rooms (n=${s.rooms}) · flush`, blockRow(s.flush)));
  }
  lines.push("");
  lines.push("Bandwidth (steady state)");
  lines.push(row("downlink / sec", `${bytes(r.bandwidth.downlinkBytesPerSec)}/s total`));
  lines.push(row("downlink / sec / client", `${bytes(r.bandwidth.downlinkBytesPerSecPerClient)}/s`));
  lines.push(row("uplink / sec", `${bytes(r.bandwidth.uplinkBytesPerSec)}/s total`));
  lines.push(row("uplink / sec / client", `${bytes(r.bandwidth.uplinkBytesPerSecPerClient)}/s`));
  lines.push(row("total down / up", `${bytes(r.bandwidth.totalDownlinkBytes)} / ${bytes(r.bandwidth.totalUplinkBytes)}`));
  lines.push("");
  lines.push("Stability");
  lines.push(row("clients", String(r.stability.clients)));
  lines.push(row("connect success / fail", `${r.stability.connectSuccess} / ${r.stability.connectFailure}`));
  lines.push(row("unexpected closes", String(r.stability.unexpectedCloses)));
  lines.push(row("protocol errors", String(r.stability.protocolErrors)));
  lines.push(row("decode errors", String(r.stability.decodeErrors)));
  lines.push(row("state frames received", String(r.stability.stateFrames)));
  if (r.stability.shotEvents > 0) lines.push(row("shot events received", String(r.stability.shotEvents)));
  lines.push(row("own-player present frames", String(r.sanity.ownPresentFrames)));
  lines.push(row("own-player absent frames", String(r.sanity.ownAbsentFrames)));
  if (r.eventLoopLagMs !== null) lines.push(row("max event-loop lag", ms(r.eventLoopLagMs)));
  lines.push("");
  return lines.join("\n");
}
