import type { Config } from "./cli.js";
import { percentiles, type MetricsBundle, type Percentiles } from "./metrics.js";

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
  };
  latencyMs: { inputToAckRtt: Percentiles };
  jitterMs: { stateInterArrival: Percentiles; rawGaps: Percentiles };
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
    },
    latencyMs: { inputToAckRtt: percentiles(merged.rtt) },
    jitterMs: { stateInterArrival: percentiles(merged.jitter), rawGaps: percentiles(merged.gaps) },
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
    },
    sanity: { ownPresentFrames: merged.ownPresentFrames, ownAbsentFrames: merged.ownAbsentFrames },
    eventLoopLagMs: lagMs,
    wallMs,
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

export function formatSummary(r: Report): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(
    `=== PlayEdge load test · ${r.scenario} · ${r.config.totalConnections} conns ` +
      `(${r.config.rooms} rooms × ${r.config.players}) · ${r.config.workers} worker(s) ===`,
  );
  lines.push(`  ${r.url}   ${(r.config.durationMs / 1000).toFixed(0)}s @ ${r.config.hz}Hz`);
  lines.push("");
  lines.push("Latency — input→ack RTT (ms)");
  lines.push(row("", pctRow(r.latencyMs.inputToAckRtt)));
  lines.push("");
  lines.push("Jitter — |state gap − expected| (ms)");
  lines.push(row("", pctRow(r.jitterMs.stateInterArrival)));
  lines.push(row("raw inter-arrival gaps", pctRow(r.jitterMs.rawGaps)));
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
  lines.push(row("own-player present frames", String(r.sanity.ownPresentFrames)));
  lines.push(row("own-player absent frames", String(r.sanity.ownAbsentFrames)));
  if (r.eventLoopLagMs !== null) lines.push(row("max event-loop lag", ms(r.eventLoopLagMs)));
  lines.push("");
  return lines.join("\n");
}
