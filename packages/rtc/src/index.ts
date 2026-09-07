/**
 * WebRTC link between two browsers — a data channel, camera/mic tracks, or
 * both — using MDN "perfect negotiation", per
 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation.
 *
 * This class knows nothing about Tikron: it emits signaling objects through a
 * `send` callback you wire to your transport (a room's opaque `rtc` relay is
 * the intended one) and consumes them through {@link RtcLink.handleSignal}.
 *
 * One link handles exactly ONE remote peer. For N peers, make N links — one
 * per remote client id — and route each inbound signal to the link whose
 * `peerId` matches its `from`.
 *
 * P2P is an ENHANCEMENT layer: nothing here may block your game. A hard
 * connection failure spends the ICE-restart budget, then settles on "failed"
 * and stops; the game keeps running over the room socket regardless.
 */

export type ConnectionState = "connecting" | "connected" | "disconnected" | "failed" | "closed";
export type Unsubscribe = () => void;

/**
 * One signaling message. The wire shape is opaque to the relay — it only
 * stamps `from` — so this travels as-is through `room.send("rtc", signal)`.
 */
export interface RtcSignal {
  /** SDP offer or answer. */
  description?: RTCSessionDescriptionInit;
  /** A trickled ICE candidate. */
  candidate?: RTCIceCandidateInit;
  /** Intended recipient's client id. Set by the app; relayed untouched. */
  to?: string;
  /** Sender's client id, stamped server-side. Never trust a client-set value. */
  from?: string;
}

export interface RtcLinkOptions {
  /** Remote client id. Signals stamped with a different `from` are ignored. */
  peerId: string;
  /**
   * Perfect-negotiation role. Exactly one side of a pair must be polite; the
   * recipe that guarantees that without coordination is
   * `polite = myClientId < peerId`.
   */
  polite: boolean;
  /** Outbound signaling. Wire it to `room.send("rtc", { ...signal, to: peerId })`. */
  send: (signal: RtcSignal) => void;
  /**
   * ICE servers, or a fetcher for them (e.g. one that GETs `/api/ice`). The
   * fetcher is awaited ONCE before the peer connection exists, so initial
   * gathering starts with real servers (a later `setConfiguration` does not
   * retroactively regather), and again before each ICE restart, which does.
   * A rejection or a stall over 2s falls back to STUN-only. Omit for STUN-only.
   */
  iceServers?: RTCIceServer[] | (() => Promise<RTCIceServer[]>);
  /**
   * Data channel config. Default is unreliable and unordered (game traffic);
   * pass `{ ordered: true }` for a reliable ordered channel.
   */
  channel?: { label?: string; ordered?: boolean; maxRetransmits?: number };
  /** ICE restarts allowed per successful connection. Default 1, as in nyam-duel. */
  iceRestartBudget?: number;
  /**
   * If set, the link reports "failed" when it is not connected within this long.
   * The report is not terminal: a later ICE success still flips the state back to
   * "connected". The timer runs once, from setup — it does not re-arm around an
   * ICE restart.
   */
  connectTimeoutMs?: number;
  /** Peer connection factory. Injectable for tests; defaults to `new RTCPeerConnection`. */
  rtcFactory?: (config: RTCConfiguration) => RTCPeerConnection;
}

/** How long to wait on an `iceServers` fetcher before falling back to STUN. */
const ICE_FETCH_TIMEOUT_MS = 2000;
/** Graceful degrade: P2P still connects on most networks with STUN alone. */
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.cloudflare.com:3478" }];
const DEFAULT_ICE_RESTART_BUDGET = 1;
const DEFAULT_CHANNEL_LABEL = "tikron";

/** The few fields we read off `RTCStatsReport` entries; the DOM lib types them loosely. */
interface RtcStatEntry {
  type: string;
  state?: string;
  nominated?: boolean;
  localCandidateId?: string;
  remoteCandidateId?: string;
  candidateType?: string;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("ice-fetch-timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

export class RtcLink {
  private readonly opts: RtcLinkOptions;
  private readonly restartBudget: number;
  private pc: RTCPeerConnection | null = null;
  private pcReady: Promise<RTCPeerConnection> | null = null;
  private channel: RTCDataChannel | null = null;
  /**
   * Every async step (peer-connection creation, negotiation, applying a
   * signal) runs on this one chain, so signals that arrive while the
   * connection is still being created are applied afterwards, in order.
   * ponytail: one serial queue for the whole link; fine at signaling volume.
   */
  private chain: Promise<void> = Promise.resolve();
  /** Candidates that arrived before a remote description existed to attach them to. */
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private makingOffer = false;
  private ignoreOffer = false;
  /**
   * Bumped by every applied remote description. A `negotiationneeded` that was
   * queued before one lands is stale by the time it runs — the answer we just
   * sent already covers it — so it is dropped instead of sending a second,
   * redundant description.
   */
  private generation = 0;
  private restartsUsed = 0;
  private closed = false;
  private currentState: ConnectionState = "connecting";
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Local capture, kept so it can be attached whenever the peer connection appears. */
  private localStream: MediaStream | null = null;
  private micEnabled = true;
  private readonly stateHandlers = new Set<(state: ConnectionState) => void>();
  private readonly messageHandlers = new Set<(data: string | ArrayBuffer) => void>();
  private readonly remoteStreamHandlers = new Set<(stream: MediaStream) => void>();

  constructor(opts: RtcLinkOptions) {
    this.opts = opts;
    this.restartBudget = opts.iceRestartBudget ?? DEFAULT_ICE_RESTART_BUDGET;
  }

  get state(): ConnectionState {
    return this.currentState;
  }

  /** Subscribe to connection state changes. */
  onStateChange(handler: (state: ConnectionState) => void): Unsubscribe {
    this.stateHandlers.add(handler);
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  /** Subscribe to data-channel messages. */
  onMessage(handler: (data: string | ArrayBuffer) => void): Unsubscribe {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /** Subscribe to the peer's media. Fires again as further tracks arrive. */
  onRemoteStream(handler: (stream: MediaStream) => void): Unsubscribe {
    this.remoteStreamHandlers.add(handler);
    return () => {
      this.remoteStreamHandlers.delete(handler);
    };
  }

  /**
   * Bring the link up. Both sides call it; the impolite side creates the data
   * channel and therefore sends the first offer, the polite side just gets
   * ready to answer. Resolves once setup is done — NOT once the peer is
   * connected; watch {@link RtcLink.onStateChange} for that.
   * ponytail: resolve-on-setup keeps the polite side from awaiting a peer that
   * may never arrive; add a `connected()` promise if an app needs one.
   */
  connect(): Promise<void> {
    return this.enqueue(async () => {
      await this.ensurePc();
    });
  }

  /** Feed one relayed signal in. Safe to call before {@link RtcLink.connect}. */
  handleSignal(signal: RtcSignal): void {
    if (this.closed) return;
    // The relay stamps `from`; a signal from anyone else belongs to another link.
    if (signal.from !== undefined && signal.from !== this.opts.peerId) return;
    void this.enqueue(async () => {
      const pc = await this.ensurePc();
      await this.apply(pc, signal);
    });
  }

  /** Send over the data channel. False when it is not open (yet). */
  send(data: string | ArrayBuffer): boolean {
    const channel = this.channel;
    if (!channel || channel.readyState !== "open") return false;
    try {
      // The DOM types split send() into one overload per payload type, so a
      // `string | ArrayBuffer` union needs the cast; both are valid at runtime.
      channel.send(data as string);
      return true;
    } catch (err) {
      console.warn("[rtc] data channel send failed:", err);
      return false;
    }
  }

  /**
   * Attach a capture stream. Safe before {@link RtcLink.connect} (it is held
   * and attached when the peer connection appears) and safe to call again with
   * the same stream — a track already on a sender is never added twice.
   *
   * The tracks belong to the caller: {@link RtcLink.close} does not stop them,
   * because they are usually the same tracks a local preview and any capture
   * pipeline are reading.
   */
  addLocalStream(stream: MediaStream): void {
    if (this.closed) return;
    this.localStream = stream;
    if (this.pc) this.applyLocalStream(this.pc);
  }

  /** Mute or unmute the outgoing audio track, now and for tracks added later. */
  setMicEnabled(enabled: boolean): void {
    this.micEnabled = enabled;
    for (const sender of this.pc?.getSenders() ?? []) {
      if (sender.track?.kind === "audio") sender.track.enabled = enabled;
    }
  }

  /** Tear the link down. Idempotent. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.clearConnectTimeout();
    this.pendingCandidates = [];
    this.pc?.close();
    this.setState("closed"); // last state the subscribers will see
    this.stateHandlers.clear();
    this.messageHandlers.clear();
    this.remoteStreamHandlers.clear();
  }

  /**
   * Types of the selected candidate pair ("host", "srflx", "relay"), or null
   * when no pair has succeeded yet. `relay` on either side means the media is
   * going through TURN and billing your key — the number to watch on a BYO-TURN
   * deployment.
   */
  async getSelectedCandidatePair(): Promise<{ local: string; remote: string } | null> {
    const stats = await this.getStats();
    if (!stats) return null;
    let pair: RtcStatEntry | undefined;
    stats.forEach((value: unknown) => {
      const report = value as RtcStatEntry;
      if (
        report.type === "candidate-pair" &&
        report.state === "succeeded" &&
        report.nominated !== false
      ) {
        pair = report;
      }
    });
    if (!pair) return null;
    const local = stats.get(pair.localCandidateId ?? "") as RtcStatEntry | undefined;
    const remote = stats.get(pair.remoteCandidateId ?? "") as RtcStatEntry | undefined;
    if (!local || !remote) return null;
    return { local: local.candidateType ?? "unknown", remote: remote.candidateType ?? "unknown" };
  }

  /** Local candidates gathered, by type (e.g. `{ host: 2, srflx: 1 }`) — why a link failed. */
  async getLocalCandidateTypeCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    const stats = await this.getStats();
    stats?.forEach((value: unknown) => {
      const report = value as RtcStatEntry;
      if (report.type === "local-candidate" && report.candidateType) {
        counts[report.candidateType] = (counts[report.candidateType] ?? 0) + 1;
      }
    });
    return counts;
  }

  // ---------------------------------------------------------------- internals

  private async getStats(): Promise<RTCStatsReport | null> {
    if (!this.pc) return null;
    try {
      return await this.pc.getStats();
    } catch (err) {
      console.warn("[rtc] getStats failed:", err);
      return null;
    }
  }

  private applyLocalStream(pc: RTCPeerConnection): void {
    const stream = this.localStream;
    if (!stream) return;
    const attached = new Set(pc.getSenders().map((sender) => sender.track));
    for (const track of stream.getTracks()) {
      if (attached.has(track)) continue;
      pc.addTrack(track, stream);
      if (track.kind === "audio") track.enabled = this.micEnabled;
      // ponytail: no encoding caps here — bitrate/framerate limits are per-game.
      // Reach for `pc.getSenders()` and `setParameters()` in the app if you need them.
    }
  }

  private enqueue(work: () => Promise<void>): Promise<void> {
    this.chain = this.chain.then(work).catch((err: unknown) => {
      console.warn("[rtc] link step failed:", err);
    });
    return this.chain;
  }

  private ensurePc(): Promise<RTCPeerConnection> {
    this.pcReady ??= this.createPc();
    return this.pcReady;
  }

  private async createPc(): Promise<RTCPeerConnection> {
    const iceServers = await this.resolveIceServers();
    if (this.closed) throw new Error("link closed before the peer connection was created");
    const factory =
      this.opts.rtcFactory ?? ((config: RTCConfiguration) => new RTCPeerConnection(config));
    const pc = factory({ iceServers });
    this.pc = pc;
    this.wire(pc);
    // A stream handed over before connect() waits here for its peer connection.
    this.applyLocalStream(pc);
    // The impolite side owns the channel: creating it fires negotiationneeded,
    // which is what actually starts the offer.
    if (!this.opts.polite) {
      const [label, init] = this.channelInit();
      this.attachChannel(pc.createDataChannel(label, init));
    }
    this.armConnectTimeout();
    return pc;
  }

  private channelInit(): [string, RTCDataChannelInit] {
    const cfg = this.opts.channel;
    const ordered = cfg?.ordered ?? false;
    const init: RTCDataChannelInit = { ordered };
    if (cfg?.maxRetransmits !== undefined) init.maxRetransmits = cfg.maxRetransmits;
    else if (!ordered) init.maxRetransmits = 0;
    return [cfg?.label ?? DEFAULT_CHANNEL_LABEL, init];
  }

  private wire(pc: RTCPeerConnection): void {
    pc.onnegotiationneeded = () => {
      const generation = this.generation;
      void this.enqueue(() => this.negotiate(pc, generation));
    };
    pc.onicecandidate = ({ candidate }) => {
      // One candidate per signal, never batched: a single candidate stays far
      // inside the relay's 16 KB `maxBytes` cap.
      if (candidate) this.opts.send({ candidate: candidate.toJSON() });
    };
    pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      if (stream) for (const handler of this.remoteStreamHandlers) handler(stream);
    };
    pc.ondatachannel = (ev) => this.attachChannel(ev.channel);
    pc.onconnectionstatechange = () => this.onPeerState(pc);
  }

  private attachChannel(channel: RTCDataChannel): void {
    channel.binaryType = "arraybuffer";
    channel.onmessage = (ev) => {
      const data = ev.data as string | ArrayBuffer;
      for (const handler of this.messageHandlers) handler(data);
    };
    this.channel = channel;
  }

  private async negotiate(pc: RTCPeerConnection, generation: number): Promise<void> {
    // A remote description landed while this was queued: it already renegotiated.
    if (this.closed || generation !== this.generation) return;
    try {
      this.makingOffer = true;
      await pc.setLocalDescription();
      const description = pc.localDescription?.toJSON() as RTCSessionDescriptionInit | undefined;
      if (description) this.opts.send({ description });
    } catch (err) {
      console.warn("[rtc] negotiation failed:", err);
    } finally {
      this.makingOffer = false;
    }
  }

  private async apply(pc: RTCPeerConnection, signal: RtcSignal): Promise<void> {
    if (this.closed) return;
    if (signal.description) {
      const description = signal.description;
      const collision =
        description.type === "offer" && (this.makingOffer || pc.signalingState !== "stable");
      // Impolite side wins a glare: drop their offer and keep our own in flight.
      this.ignoreOffer = !this.opts.polite && collision;
      if (this.ignoreOffer) return;
      // On the polite side this rolls our own offer back implicitly.
      await pc.setRemoteDescription(description);
      this.generation++;
      await this.flushCandidates(pc);
      if (description.type === "offer") {
        await pc.setLocalDescription();
        const answer = pc.localDescription?.toJSON() as RTCSessionDescriptionInit | undefined;
        if (answer) this.opts.send({ description: answer });
      }
    } else if (signal.candidate) {
      // Candidates can outrun the description they belong to; hold them.
      if (!pc.remoteDescription) {
        this.pendingCandidates.push(signal.candidate);
        return;
      }
      try {
        await pc.addIceCandidate(signal.candidate);
      } catch (err) {
        if (!this.ignoreOffer) throw err;
      }
    }
  }

  private async flushCandidates(pc: RTCPeerConnection): Promise<void> {
    const queued = this.pendingCandidates;
    if (queued.length === 0) return;
    this.pendingCandidates = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.warn("[rtc] queued candidate rejected:", err);
      }
    }
  }

  private onPeerState(pc: RTCPeerConnection): void {
    if (this.closed) return;
    const state = pc.connectionState;
    if (state === "connected") {
      this.restartsUsed = 0; // a fresh success refills the restart budget
      this.clearConnectTimeout();
      this.setState("connected");
    } else if (state === "disconnected") {
      this.setState("disconnected");
    } else if (state === "closed") {
      this.setState("closed");
    } else if (state === "failed") {
      if (this.restartsUsed >= this.restartBudget) {
        // Budget spent — stop burning ICE and let the game continue without P2P.
        this.setState("failed");
        return;
      }
      this.restartsUsed++;
      this.setState("connecting");
      void this.enqueue(async () => {
        // TURN credentials are about an hour long, and a restart regathers, so
        // refreshing them here (unlike at construction) actually takes effect.
        await this.applyFreshIceServers(pc);
        if (!this.closed) pc.restartIce();
      });
    } else {
      this.setState("connecting");
    }
  }

  private async resolveIceServers(): Promise<RTCIceServer[]> {
    const source = this.opts.iceServers;
    if (!source) return FALLBACK_ICE_SERVERS;
    if (Array.isArray(source)) return source;
    try {
      return await withTimeout(source(), ICE_FETCH_TIMEOUT_MS);
    } catch (err) {
      console.warn("[rtc] fetching ICE servers failed, using STUN-only fallback:", err);
      return FALLBACK_ICE_SERVERS;
    }
  }

  private async applyFreshIceServers(pc: RTCPeerConnection): Promise<void> {
    const source = this.opts.iceServers;
    if (typeof source !== "function") return;
    try {
      const iceServers = await source();
      if (!this.closed) pc.setConfiguration({ iceServers });
    } catch (err) {
      console.warn("[rtc] refreshing ICE servers failed, keeping current config:", err);
    }
  }

  private armConnectTimeout(): void {
    const ms = this.opts.connectTimeoutMs;
    if (ms === undefined || this.connectTimer !== null) return;
    this.connectTimer = setTimeout(() => {
      this.connectTimer = null;
      if (!this.closed && this.currentState !== "connected") this.setState("failed");
    }, ms);
  }

  private clearConnectTimeout(): void {
    if (this.connectTimer === null) return;
    clearTimeout(this.connectTimer);
    this.connectTimer = null;
  }

  private setState(next: ConnectionState): void {
    if (this.currentState === next) return;
    this.currentState = next;
    for (const handler of this.stateHandlers) handler(next);
  }
}
