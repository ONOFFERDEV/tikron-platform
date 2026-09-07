import { describe, it, expect } from "vitest";
import { RtcLink, type ConnectionState, type RtcSignal, type RtcLinkOptions } from "./index.js";

interface Desc {
  type: "offer" | "answer";
  sdp: string;
}

/** Scripted data channel — no real SCTP, just the states and the two calls we use. */
class FakeChannel {
  readyState = "connecting";
  binaryType = "blob";
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  readonly sent: (string | ArrayBuffer)[] = [];

  constructor(
    readonly label: string,
    readonly init?: { ordered?: boolean; maxRetransmits?: number },
  ) {}

  send(data: string | ArrayBuffer): void {
    if (this.readyState !== "open") throw new Error("InvalidStateError");
    this.sent.push(data);
  }
  open(): void {
    this.readyState = "open";
  }
  deliver(data: unknown): void {
    this.onmessage?.({ data });
  }
}

/**
 * Scripted RTCPeerConnection. Models only what perfect negotiation reads:
 * the signaling state machine (including implicit rollback), the rule that
 * addIceCandidate rejects before a remote description exists, and an ordered
 * log of every call so tests can assert sequencing rather than just counts.
 */
class FakePc {
  signalingState = "stable";
  connectionState = "new";
  localDescription: (Desc & { toJSON(): Desc }) | null = null;
  remoteDescription: Desc | null = null;

  onnegotiationneeded: (() => void) | null = null;
  onicecandidate: ((ev: { candidate: { toJSON(): { candidate: string } } | null }) => void) | null =
    null;
  ondatachannel: ((ev: { channel: FakeChannel }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ontrack: ((ev: { streams: unknown[] }) => void) | null = null;

  readonly calls: string[] = [];
  readonly remoteDescs: Desc[] = [];
  readonly addedCandidates: string[] = [];
  readonly channels: FakeChannel[] = [];
  readonly senders: { track: FakeTrack }[] = [];
  /** Scripted `getStats()` payload; a real report is a Map, so this is one. */
  statsReport: Map<string, unknown> | null = null;
  restartIceCount = 0;
  closeCount = 0;
  config: RTCConfiguration;

  constructor(config: RTCConfiguration) {
    this.config = config;
  }

  createDataChannel(label: string, init?: { ordered?: boolean; maxRetransmits?: number }) {
    const channel = new FakeChannel(label, init);
    this.channels.push(channel);
    // Browsers fire negotiationneeded asynchronously after this.
    queueMicrotask(() => this.onnegotiationneeded?.());
    return channel;
  }

  setLocalDescription(): Promise<void> {
    // Implicit description, decided by signaling state exactly as a real peer
    // connection does — NOT by which description happens to be stored.
    const type = this.signalingState === "have-remote-offer" ? "answer" : "offer";
    const desc: Desc = { type, sdp: `local-${type}` };
    this.localDescription = { ...desc, toJSON: () => desc };
    this.signalingState = type === "offer" ? "have-local-offer" : "stable";
    this.calls.push(`setLocal:${type}`);
    return Promise.resolve();
  }

  setRemoteDescription(desc: Desc): Promise<void> {
    // A remote offer applied over our own local offer IS the implicit rollback.
    this.remoteDescription = desc;
    this.remoteDescs.push(desc);
    this.signalingState = desc.type === "offer" ? "have-remote-offer" : "stable";
    this.calls.push(`setRemote:${desc.type}`);
    return Promise.resolve();
  }

  addIceCandidate(candidate: { candidate?: string }): Promise<void> {
    if (!this.remoteDescription) return Promise.reject(new Error("InvalidStateError"));
    this.addedCandidates.push(candidate.candidate ?? "");
    this.calls.push(`candidate:${candidate.candidate ?? ""}`);
    return Promise.resolve();
  }

  addTrack(track: FakeTrack, _stream: unknown): { track: FakeTrack } {
    const sender = { track };
    this.senders.push(sender);
    this.calls.push(`addTrack:${track.kind}`);
    return sender;
  }
  getSenders(): { track: FakeTrack }[] {
    return this.senders;
  }

  restartIce(): void {
    this.restartIceCount++;
  }
  setConfiguration(config: RTCConfiguration): void {
    this.config = config;
  }
  close(): void {
    this.closeCount++;
    this.connectionState = "closed";
  }

  getStats(): Promise<Map<string, unknown>> {
    if (!this.statsReport) return Promise.reject(new Error("stats unavailable"));
    return Promise.resolve(this.statsReport);
  }

  // --- drivers the tests use to play the browser's part ---
  emitNegotiationNeeded(): void {
    this.onnegotiationneeded?.();
  }
  emitConnectionState(state: string): void {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
  emitCandidate(candidate: string): void {
    this.onicecandidate?.({ candidate: { toJSON: () => ({ candidate }) } });
  }
  emitDataChannel(channel: FakeChannel): void {
    this.ondatachannel?.({ channel });
  }
  emitTrack(stream: unknown): void {
    this.ontrack?.({ streams: [stream] });
  }
}

interface FakeTrack {
  kind: string;
  enabled: boolean;
}

/** A MediaStream that hands back the SAME track objects every call, as a real one does. */
function fakeStream(kinds: string[]): MediaStream & { tracks: FakeTrack[] } {
  const tracks: FakeTrack[] = kinds.map((kind) => ({ kind, enabled: true }));
  return { tracks, getTracks: () => tracks } as unknown as MediaStream & { tracks: FakeTrack[] };
}

/** Drain the link's internal promise chain (and any microtasks it queued). */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function makeLink(overrides: Partial<RtcLinkOptions> = {}) {
  const sent: RtcSignal[] = [];
  let pc: FakePc | null = null;
  const link = new RtcLink({
    peerId: "peer",
    polite: false,
    send: (signal) => sent.push(signal),
    rtcFactory: (config) => {
      pc = new FakePc(config);
      return pc as unknown as RTCPeerConnection;
    },
    ...overrides,
  });
  return {
    link,
    sent,
    descriptions: () => sent.filter((s) => s.description).map((s) => s.description!.type),
    pc: () => {
      if (!pc) throw new Error("peer connection not created yet");
      return pc;
    },
  };
}

const offer = (sdp = "remote-offer"): RtcSignal => ({
  description: { type: "offer", sdp },
  from: "peer",
});

describe("RtcLink negotiation", () => {
  it("offers on connect and applies exactly one answer", async () => {
    const h = makeLink();
    await h.link.connect();
    await flush();

    expect(h.pc().channels).toHaveLength(1);
    expect(h.descriptions()).toEqual(["offer"]);

    h.link.handleSignal({ description: { type: "answer", sdp: "remote-answer" }, from: "peer" });
    await flush();

    expect(h.pc().remoteDescs).toEqual([{ type: "answer", sdp: "remote-answer" }]);
    expect(h.pc().calls.filter((c) => c === "setRemote:answer")).toHaveLength(1);
    expect(h.pc().signalingState).toBe("stable");
  });

  it("survives glare: the polite side rolls back, the impolite side wins, one connection results", async () => {
    // polite = myId < peerId, so "a" is polite towards "b" and "b" is not.
    const politeSide = makeLink({ peerId: "b", polite: true });
    const impoliteSide = makeLink({ peerId: "a", polite: false });
    await politeSide.link.connect();
    await impoliteSide.link.connect();
    await flush();

    // The impolite side offered on its own (it owns the channel); make the
    // polite side offer at the same instant, before either has heard the other.
    politeSide.pc().emitNegotiationNeeded();
    await flush();
    const politeOffer = politeSide.sent.find((s) => s.description)!;
    const impoliteOffer = impoliteSide.sent.find((s) => s.description)!;
    expect(politeOffer.description!.type).toBe("offer");
    expect(impoliteOffer.description!.type).toBe("offer");

    politeSide.link.handleSignal({ ...impoliteOffer, from: "b" });
    impoliteSide.link.handleSignal({ ...politeOffer, from: "a" });
    await flush();

    // Polite: rolled its own offer back by accepting theirs, then answered.
    expect(politeSide.pc().remoteDescs.map((d) => d.type)).toEqual(["offer"]);
    expect(politeSide.descriptions()).toEqual(["offer", "answer"]);
    // Impolite: ignored the colliding offer outright — it never touched its state.
    expect(impoliteSide.pc().remoteDescs).toEqual([]);
    expect(impoliteSide.descriptions()).toEqual(["offer"]);

    const answer = politeSide.sent.filter((s) => s.description).at(-1)!;
    impoliteSide.link.handleSignal({ ...answer, from: "a" });
    await flush();

    expect(impoliteSide.pc().calls.filter((c) => c === "setRemote:answer")).toHaveLength(1);
    expect(impoliteSide.pc().signalingState).toBe("stable");
    expect(politeSide.pc().signalingState).toBe("stable");
  });

  it("queues candidates that arrive before the remote description, then applies them in order", async () => {
    const h = makeLink({ polite: true });
    await h.link.connect();
    await flush();

    h.link.handleSignal({ candidate: { candidate: "c1" }, from: "peer" });
    h.link.handleSignal({ candidate: { candidate: "c2" }, from: "peer" });
    await flush();
    expect(h.pc().addedCandidates).toEqual([]);

    h.link.handleSignal(offer());
    await flush();

    expect(h.pc().addedCandidates).toEqual(["c1", "c2"]);
    expect(h.pc().calls.indexOf("setRemote:offer")).toBeLessThan(
      h.pc().calls.indexOf("candidate:c1"),
    );
  });

  it("ignores signals stamped with another peer id", async () => {
    const h = makeLink({ polite: true });
    await h.link.connect();
    await flush();

    h.link.handleSignal({ description: { type: "offer", sdp: "x" }, from: "stranger" });
    await flush();
    expect(h.pc().remoteDescs).toEqual([]);

    h.link.handleSignal(offer());
    await flush();
    expect(h.pc().remoteDescs).toHaveLength(1);
  });

  it("drops a negotiation that an incoming offer already superseded", async () => {
    // connect() defers negotiationneeded behind creating the channel, so the
    // offer below is applied first and the queued negotiation is stale.
    const h = makeLink();
    void h.link.connect();
    h.link.handleSignal(offer());
    await flush();

    // The answer covers it: a second description here would be the redundant one.
    expect(h.descriptions()).toEqual(["answer"]);
    expect(h.pc().calls.filter((c) => c.startsWith("setLocal:"))).toEqual(["setLocal:answer"]);
  });
});

describe("RtcLink connection state", () => {
  it("restarts ICE within budget, then reports failed, and refills on success", async () => {
    const h = makeLink({ polite: true, iceRestartBudget: 1 });
    const states: ConnectionState[] = [];
    h.link.onStateChange((s) => states.push(s));
    await h.link.connect();
    await flush();

    h.pc().emitConnectionState("failed");
    await flush();
    expect(h.pc().restartIceCount).toBe(1);
    expect(h.link.state).toBe("connecting");

    h.pc().emitConnectionState("failed");
    await flush();
    expect(h.pc().restartIceCount).toBe(1); // budget spent, no second restart
    expect(h.link.state).toBe("failed");
    expect(states).toEqual(["failed"]);

    // A successful connection refills the budget.
    h.pc().emitConnectionState("connected");
    await flush();
    h.pc().emitConnectionState("failed");
    await flush();
    expect(h.pc().restartIceCount).toBe(2);
  });

  it("reports failed when connectTimeoutMs passes without a connection", async () => {
    const h = makeLink({ polite: true, connectTimeoutMs: 5 });
    await h.link.connect();
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(h.link.state).toBe("failed");

    // Non-terminal: a late ICE success still wins.
    h.pc().emitConnectionState("connected");
    expect(h.link.state).toBe("connected");
  });

  it("close() is idempotent", async () => {
    const h = makeLink({ polite: true });
    await h.link.connect();
    await flush();
    const states: ConnectionState[] = [];
    h.link.onStateChange((s) => states.push(s));

    h.link.close();
    h.link.close();

    expect(h.pc().closeCount).toBe(1);
    expect(states).toEqual(["closed"]);
    expect(h.link.state).toBe("closed");

    // A signal after close is a no-op, not a throw.
    h.link.handleSignal(offer());
    await flush();
    expect(h.pc().remoteDescs).toEqual([]);
  });

  it("forwards trickled candidates to the signaling transport", async () => {
    const h = makeLink();
    await h.link.connect();
    await flush();

    h.pc().emitCandidate("host-1");
    expect(h.sent.filter((s) => s.candidate).map((s) => s.candidate!.candidate)).toEqual([
      "host-1",
    ]);
  });
});

describe("RtcLink data channel", () => {
  it("defaults to unreliable/unordered and only sends once open", async () => {
    const h = makeLink();
    expect(h.link.send("early")).toBe(false); // no peer connection yet

    await h.link.connect();
    await flush();
    const channel = h.pc().channels[0]!;
    expect(channel.init).toEqual({ ordered: false, maxRetransmits: 0 });
    expect(h.link.send("closed-channel")).toBe(false);

    channel.open();
    expect(h.link.send("hello")).toBe(true);
    expect(channel.sent).toEqual(["hello"]);

    const received: unknown[] = [];
    h.link.onMessage((data) => received.push(data));
    channel.deliver("pong");
    expect(received).toEqual(["pong"]);
  });

  it("honours an explicit ordered channel config", async () => {
    const h = makeLink({ channel: { label: "chat", ordered: true } });
    await h.link.connect();
    await flush();
    const channel = h.pc().channels[0]!;
    expect(channel.label).toBe("chat");
    expect(channel.init).toEqual({ ordered: true });
  });

  it("the polite side adopts the channel the peer created", async () => {
    const h = makeLink({ polite: true });
    await h.link.connect();
    await flush();
    expect(h.pc().channels).toHaveLength(0); // polite side creates nothing

    const remote = new FakeChannel("tikron", { ordered: false });
    h.pc().emitDataChannel(remote);
    remote.open();

    const received: unknown[] = [];
    h.link.onMessage((data) => received.push(data));
    remote.deliver("from-peer");
    expect(received).toEqual(["from-peer"]);
    expect(h.link.send("reply")).toBe(true);
    expect(remote.sent).toEqual(["reply"]);
  });
});

describe("RtcLink media", () => {
  it("attaches a stream added before connect exactly once and surfaces the peer's", async () => {
    const h = makeLink(); // impolite: this side owns the channel and offers
    const stream = fakeStream(["video", "audio"]);
    h.link.addLocalStream(stream); // before the peer connection exists

    await h.link.connect();
    await flush();
    expect(h.pc().calls.filter((c) => c.startsWith("addTrack:"))).toEqual([
      "addTrack:video",
      "addTrack:audio",
    ]);
    expect(h.descriptions()).toEqual(["offer"]); // tracks did not derail negotiation

    h.link.addLocalStream(stream); // same tracks again — never re-added
    expect(h.pc().senders).toHaveLength(2);

    h.link.setMicEnabled(false); // audio only
    expect(stream.tracks.map((t) => t.enabled)).toEqual([true, false]);

    const remote: unknown[] = [];
    h.link.onRemoteStream((s) => remote.push(s));
    const peerStream = fakeStream(["video"]);
    h.pc().emitTrack(peerStream);
    expect(remote).toEqual([peerStream]);
  });
});

describe("RtcLink diagnostics", () => {
  it("reads the selected pair and local candidate counts off getStats()", async () => {
    const h = makeLink({ polite: true });
    await h.link.connect();
    await flush();
    h.pc().statsReport = new Map<string, unknown>([
      [
        "pair",
        {
          type: "candidate-pair",
          state: "succeeded",
          nominated: true,
          localCandidateId: "L1",
          remoteCandidateId: "R1",
        },
      ],
      ["L1", { type: "local-candidate", candidateType: "relay" }],
      ["R1", { type: "remote-candidate", candidateType: "srflx" }],
      ["L2", { type: "local-candidate", candidateType: "host" }],
      ["L3", { type: "local-candidate", candidateType: "relay" }],
    ]);

    expect(await h.link.getSelectedCandidatePair()).toEqual({ local: "relay", remote: "srflx" });
    expect(await h.link.getLocalCandidateTypeCounts()).toEqual({ relay: 2, host: 1 });
  });

  it("returns null and an empty count when getStats() is unavailable", async () => {
    const h = makeLink({ polite: true });
    await h.link.connect();
    await flush(); // statsReport left null — getStats() rejects
    expect(await h.link.getSelectedCandidatePair()).toBeNull();
    expect(await h.link.getLocalCandidateTypeCounts()).toEqual({});
  });
});

describe("RtcLink ICE servers", () => {
  it("uses a static iceServers array exactly as given", async () => {
    const iceServers = [{ urls: "turn:fixed.example:3478", username: "u", credential: "c" }];
    const h = makeLink({ polite: true, iceServers });
    await h.link.connect();
    await flush();
    expect(h.pc().config.iceServers).toBe(iceServers);
  });

  it("falls back to STUN when the fetcher rejects", async () => {
    const h = makeLink({
      polite: true,
      iceServers: () => Promise.reject(new Error("ice route down")),
    });
    await h.link.connect();
    await flush();
    expect(h.pc().config.iceServers).toEqual([{ urls: "stun:stun.cloudflare.com:3478" }]);
  });

  it("re-fetches ICE servers before an ICE restart", async () => {
    let minted = 0;
    const h = makeLink({
      polite: true,
      iceServers: () => {
        minted++;
        return Promise.resolve([{ urls: `turn:mint-${minted}` }]);
      },
    });
    await h.link.connect();
    await flush();
    expect(h.pc().config.iceServers).toEqual([{ urls: "turn:mint-1" }]);

    h.pc().emitConnectionState("failed");
    await flush();
    expect(h.pc().config.iceServers).toEqual([{ urls: "turn:mint-2" }]);
    expect(h.pc().restartIceCount).toBe(1);
  });
});
