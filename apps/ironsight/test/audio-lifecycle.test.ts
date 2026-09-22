import { describe, expect, it, vi } from "vitest";
import * as audioMix from "../client/audio-mix.js";
import * as audioRuntime from "../client/audio.js";

class FakeNode {
  readonly connections: FakeNode[] = [];
  disconnectCount = 0;

  constructor(readonly name: string) {}

  connect(destination: FakeNode): void {
    this.connections.push(destination);
  }

  disconnect(): void {
    this.disconnectCount += 1;
    this.connections.length = 0;
  }
}

class FakeDriver {
  readonly destination = new FakeNode("destination");
  readonly nodes: FakeNode[] = [];
  readonly gains = new Map<FakeNode, number>();
  readonly ranges = new Map<FakeNode, audioMix.AudioDynamicRange>();

  createGain(name: string, value: number): FakeNode {
    const node = new FakeNode(name);
    this.nodes.push(node);
    this.gains.set(node, value);
    return node;
  }

  createCompressor(): FakeNode {
    const node = new FakeNode("compressor");
    this.nodes.push(node);
    return node;
  }

  createCeiling(): FakeNode {
    const node = new FakeNode("ceiling");
    this.nodes.push(node);
    return node;
  }

  connect(source: FakeNode, destination: FakeNode): void {
    source.connect(destination);
  }

  disconnect(node: FakeNode): void {
    node.disconnect();
  }

  setGain(node: FakeNode, value: number): void {
    this.gains.set(node, value);
  }

  setDynamicRange(node: FakeNode, value: audioMix.AudioDynamicRange): void {
    this.ranges.set(node, value);
  }
}

describe("audio mix graph", () => {
  it("routes every independent bus through one final processor and one destination", () => {
    const driver = new FakeDriver();

    const graph = audioMix.createAudioMixGraph(driver, { master: 0.8, muted: false });

    for (const key of audioMix.AUDIO_MIX_BUS_KEYS) {
      expect(graph.bus(key).connections).toEqual([graph.master]);
    }
    expect(graph.master.connections).toEqual([graph.compressor]);
    expect(graph.compressor.connections).toEqual([graph.finalBus]);
    expect(graph.finalBus.connections).toEqual([driver.destination]);
  });

  it("updates bus and mute gains without creating another graph", () => {
    const driver = new FakeDriver();
    const graph = audioMix.createAudioMixGraph(driver, { master: 1, muted: false });

    graph.setBusLevel("combat", 0.25);
    graph.setMaster(0.6, true);

    expect(driver.gains.get(graph.bus("combat"))).toBe(0.25);
    expect(driver.gains.get(graph.master)).toBe(0);
    expect(driver.nodes.filter(node => node.name === "master")).toHaveLength(1);
  });

  it("disconnects every owned node once even when dispose repeats", () => {
    const driver = new FakeDriver();
    const graph = audioMix.createAudioMixGraph(driver, { master: 1, muted: false });

    graph.dispose();
    graph.dispose();

    for (const node of driver.nodes) expect(node.disconnectCount).toBe(1);
  });
});

describe("audio voice budget", () => {
  it("reserves four of twenty voices for critical audio", () => {
    const budget = new audioMix.AudioVoiceBudget(20, 4);

    const ordinary = Array.from({ length: 20 }, () => budget.acquire("ordinary"));
    const critical = Array.from({ length: 5 }, () => budget.acquire("critical"));

    expect(ordinary.filter(Boolean)).toHaveLength(16);
    expect(critical.filter(Boolean)).toHaveLength(4);
    expect(budget.active).toBe(20);
  });

  it("release is idempotent and returns capacity", () => {
    const budget = new audioMix.AudioVoiceBudget(2, 1);
    const release = budget.acquire("ordinary");
    expect(release).toBeTypeOf("function");

    release?.();
    release?.();

    expect(budget.active).toBe(0);
    expect(budget.acquire("ordinary")).toBeTypeOf("function");
  });

  it("clears every reservation on context disposal without late releases corrupting the new budget", () => {
    const budget = new audioMix.AudioVoiceBudget(2, 0);
    const releaseBeforeDispose = budget.acquire("ordinary");
    expect(budget.active).toBe(1);

    budget.reset();
    const releaseAfterDispose = budget.acquire("ordinary");
    releaseBeforeDispose?.();

    expect(budget.active).toBe(1);
    releaseAfterDispose?.();
    expect(budget.active).toBe(0);
  });
});

it("hidden mute policy zeros master without changing the stored level", () => {
  expect(audioMix.effectiveMasterGain(0.7, false, true, true)).toBe(0);
  expect(audioMix.effectiveMasterGain(0.7, false, true, false)).toBe(0.7);
  expect(audioMix.effectiveMasterGain(0.7, true, false, false)).toBe(0);
});

it("installs the PCM message handler before connecting the live final bus", async () => {
  let handlerInstalledAtConnect = false;
  class FakeWorkletNode {
    readonly port = { onmessage: null as ((event: MessageEvent) => void) | null, postMessage: () => {} };
    onprocessorerror: (() => void) | null = null;
    connect(): FakeWorkletNode { return this; }
    disconnect(): void {}
  }
  vi.stubGlobal("AudioWorkletNode", FakeWorkletNode);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:audio-capture");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const destination = {} as AudioDestinationNode;
  const context = {
    state: "running",
    sampleRate: 48_000,
    destination,
    audioWorklet: { addModule: async () => {} },
    createGain: () => ({ gain: { value: 1 }, connect() { return destination; }, disconnect() {} }),
  } as unknown as AudioContext;
  const finalBus = {
    context,
    connect(node: AudioWorkletNode) { handlerInstalledAtConnect = typeof node.port.onmessage === "function"; return node; },
    disconnect() {},
  } as unknown as AudioNode;
  const source = "capture-worklet";
  const sourceSha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)))]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");

  await audioMix.startLiveMixCapture(context, finalBus, {
    source,
    sourceSha256,
    maxSeconds: 1,
  });

  expect(handlerInstalledAtConnect).toBe(true);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("retries AudioWorklet registration after a transient module rejection", async () => {
  let attempts = 0;
  class FakeWorkletNode {
    readonly port = { onmessage: null as ((event: MessageEvent) => void) | null, postMessage: () => {} };
    onprocessorerror: (() => void) | null = null;
    connect(): FakeWorkletNode { return this; }
    disconnect(): void {}
  }
  vi.stubGlobal("AudioWorkletNode", FakeWorkletNode);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:audio-capture-retry");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const destination = {} as AudioDestinationNode;
  const context = {
    state: "running",
    sampleRate: 48_000,
    destination,
    audioWorklet: { addModule: async () => { attempts += 1; if (attempts === 1) throw new Error("CSP rejected blob"); } },
    createGain: () => ({ gain: { value: 1 }, connect() { return destination; }, disconnect() {} }),
  } as unknown as AudioContext;
  const finalBus = { context, connect() {}, disconnect() {} } as unknown as AudioNode;
  const source = "capture-worklet-retry";
  const sourceSha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)))]
    .map(byte => byte.toString(16).padStart(2, "0")).join("");

  await expect(audioMix.startLiveMixCapture(context, finalBus, { source, sourceSha256, maxSeconds: 1 }))
    .rejects.toMatchObject({ code: "module_registration_failed", message: "CSP rejected blob" });
  await expect(audioMix.startLiveMixCapture(context, finalBus, { source, sourceSha256, maxSeconds: 1 }))
    .resolves.toMatchObject({ processorName: `ironsight-pcm-${sourceSha256.slice(0, 16)}` });
  expect(attempts).toBe(2);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("bounds unique worklet registrations for one long-lived context", async () => {
  class FakeWorkletNode {
    readonly port = { onmessage: null, postMessage: () => {} };
    onprocessorerror = null;
    connect(): FakeWorkletNode { return this; }
    disconnect(): void {}
  }
  vi.stubGlobal("AudioWorkletNode", FakeWorkletNode);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:audio-capture-bounded");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const destination = {} as AudioDestinationNode;
  const context = {
    state: "running", sampleRate: 48_000, destination,
    audioWorklet: { addModule: async () => {} },
    createGain: () => ({ gain: { value: 1 }, connect() { return destination; }, disconnect() {} }),
  } as unknown as AudioContext;
  const finalBus = { context, connect() {}, disconnect() {} } as unknown as AudioNode;
  for (let index = 0; index < 4; index += 1) {
    const source = `capture-worklet-bounded-${index}`;
    const sourceSha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)))]
      .map(byte => byte.toString(16).padStart(2, "0")).join("");
    const controller = new AbortController();
    controller.abort();
    await expect(audioMix.startLiveMixCapture(context, finalBus, { source, sourceSha256, maxSeconds: 1, signal: controller.signal }))
      .rejects.toMatchObject({ code: "capture_aborted" });
  }
  const source = "capture-worklet-bounded-overflow";
  const sourceSha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)))]
    .map(byte => byte.toString(16).padStart(2, "0")).join("");

  await expect(audioMix.startLiveMixCapture(context, finalBus, { source, sourceSha256, maxSeconds: 1 }))
    .rejects.toMatchObject({ code: "worklet_registration_limit" });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("aborts capture cleanly while AudioWorklet registration is completing", async () => {
  let finishRegistration: (() => void) | undefined;
  let registrationStarted: (() => void) | undefined;
  const started = new Promise<void>(resolve => { registrationStarted = resolve; });
  let nodesCreated = 0;
  class FakeWorkletNode {
    constructor() { nodesCreated += 1; }
  }
  vi.stubGlobal("AudioWorkletNode", FakeWorkletNode);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:audio-capture-abort");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const context = {
    state: "running",
    sampleRate: 48_000,
    destination: {},
    audioWorklet: { addModule: () => new Promise<void>(resolve => { finishRegistration = resolve; registrationStarted?.(); }) },
  } as unknown as AudioContext;
  const finalBus = { context } as unknown as AudioNode;
  const source = "capture-worklet-abort";
  const sourceSha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)))]
    .map(byte => byte.toString(16).padStart(2, "0")).join("");
  const controller = new AbortController();
  const capture = audioMix.startLiveMixCapture(context, finalBus, { source, sourceSha256, maxSeconds: 1, signal: controller.signal });

  await started;
  controller.abort();
  finishRegistration?.();

  await expect(capture).rejects.toMatchObject({ code: "capture_aborted" });
  expect(nodesCreated).toBe(0);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("rejects capture finalization if the game context suspends after recording starts", async () => {
  const worklets: Array<{ readonly port: { onmessage: ((event: MessageEvent) => void) | null } }> = [];
  class FakeWorkletNode {
    readonly port = {
      onmessage: null as ((event: MessageEvent) => void) | null,
      postMessage: () => this.port.onmessage?.({ data: { type: "flush", frames: 2 } } as MessageEvent),
    };
    onprocessorerror: (() => void) | null = null;
    constructor() { worklets.push(this); }
    connect(): FakeWorkletNode { return this; }
    disconnect(): void {}
  }
  vi.stubGlobal("AudioWorkletNode", FakeWorkletNode);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:audio-capture-suspend");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const destination = {} as AudioDestinationNode;
  const context = {
    state: "running" as AudioContextState,
    sampleRate: 48_000,
    destination,
    audioWorklet: { addModule: async () => {} },
    createGain: () => ({ gain: { value: 1 }, connect() { return destination; }, disconnect() {} }),
  };
  const finalBus = { context, connect() {}, disconnect() {} } as unknown as AudioNode;
  const source = "capture-worklet-suspend";
  const sourceSha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)))]
    .map(byte => byte.toString(16).padStart(2, "0")).join("");
  const recording = await audioMix.startLiveMixCapture(context as unknown as AudioContext, finalBus, { source, sourceSha256, maxSeconds: 1 });
  worklets[0]?.port.onmessage?.({ data: { type: "pcm", sequence: 0, startFrame: 0, frames: 2,
    sourceChannels: 2, normalization: "native-stereo", channels: [new Float32Array([.1, .2]), new Float32Array([.1, .2])] } } as MessageEvent);
  context.state = "suspended";

  await expect(recording.stop()).rejects.toMatchObject({ code: "context_suspended" });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("AudioContext resume rejection stays observable and can retry", async () => {
  class RetryContext {
    state: AudioContextState = "suspended";
    private attempts = 0;

    async resume(): Promise<void> {
      this.attempts += 1;
      if (this.attempts === 1) throw new Error("gesture rejected");
      this.state = "running";
    }
  }
  const context = new RetryContext();

  const failed = await audioRuntime.resumeContext(context);
  const recovered = await audioRuntime.resumeContext(context);

  expect(failed).toEqual({ running: false, error: "gesture rejected" });
  expect(recovered).toEqual({ running: true, error: null });
});

it("every runtime mute change reaches the canonical settings observer", () => {
  const observed: boolean[] = [];
  vi.stubGlobal("window", { addEventListener: () => {}, AudioContext: undefined });
  vi.stubGlobal("document", { addEventListener: () => {}, hidden: false });
  vi.stubGlobal("location", { hostname: "example.com" });
  vi.stubGlobal("localStorage", { getItem: () => "0", setItem: () => {} });
  audioRuntime.initAudio(value => observed.push(value));

  audioRuntime.setMuted(true);

  expect(observed).toEqual([true]);
  vi.unstubAllGlobals();
});
