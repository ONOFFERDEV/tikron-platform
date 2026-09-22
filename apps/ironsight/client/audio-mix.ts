export const AUDIO_MIX_BUS_KEYS = ["combat", "ambience", "music", "ui"] as const;
export type AudioMixBusKey = (typeof AUDIO_MIX_BUS_KEYS)[number];
export type VoicePriority = "ordinary" | "critical";
export type AudioDynamicRange = "headphones" | "speakers" | "reduced";

export interface AudioMixDriver<Node> {
  readonly destination: Node;
  createGain(name: string, value: number): Node;
  createCompressor(): Node;
  createCeiling(): Node;
  connect(source: Node, destination: Node): void;
  disconnect(node: Node): void;
  setGain(node: Node, value: number): void;
  setDynamicRange(node: Node, value: AudioDynamicRange): void;
}

export interface AudioMixInitialState {
  readonly master: number;
  readonly muted: boolean;
  readonly levels?: Readonly<Record<AudioMixBusKey, number>>;
  readonly dynamicRange?: AudioDynamicRange;
}

function clampUnit(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
}

export function effectiveMasterGain(master: number, muted: boolean, hidden: boolean, muteWhenHidden: boolean): number {
  return muted || (hidden && muteWhenHidden) ? 0 : clampUnit(master);
}

export class AudioVoiceBudget {
  private count = 0;
  private generation = 0;

  constructor(
    private readonly capacity: number,
    private readonly criticalReserve: number,
  ) {}

  get active(): number { return this.count; }

  acquire(priority: VoicePriority): (() => void) | null {
    const limit = priority === "critical" ? this.capacity : this.capacity - this.criticalReserve;
    if (this.count >= limit) return null;
    this.count += 1;
    const generation = this.generation;
    let released = false;
    return () => {
      if (released || generation !== this.generation) return;
      released = true;
      this.count -= 1;
    };
  }

  reset(): void { this.count = 0; this.generation += 1; }
}

export class AudioMixGraph<Node> {
  readonly master: Node;
  readonly compressor: Node;
  readonly finalBus: Node;
  private readonly buses: Readonly<Record<AudioMixBusKey, Node>>;
  private readonly owned: readonly Node[];
  private disposed = false;

  constructor(
    private readonly driver: AudioMixDriver<Node>,
    initial: AudioMixInitialState,
  ) {
    this.buses = {
      combat: driver.createGain("combat", initial.levels?.combat ?? 1),
      ambience: driver.createGain("ambience", initial.levels?.ambience ?? 1),
      music: driver.createGain("music", initial.levels?.music ?? 1),
      ui: driver.createGain("ui", initial.levels?.ui ?? 1),
    };
    this.master = driver.createGain("master", initial.muted ? 0 : clampUnit(initial.master));
    this.compressor = driver.createCompressor();
    driver.setDynamicRange(this.compressor, initial.dynamicRange ?? "headphones");
    this.finalBus = driver.createCeiling();
    this.owned = [...AUDIO_MIX_BUS_KEYS.map(key => this.buses[key]), this.master, this.compressor, this.finalBus];
    for (const key of AUDIO_MIX_BUS_KEYS) driver.connect(this.buses[key], this.master);
    driver.connect(this.master, this.compressor);
    driver.connect(this.compressor, this.finalBus);
    driver.connect(this.finalBus, driver.destination);
  }

  bus(key: AudioMixBusKey): Node {
    return this.buses[key];
  }

  setBusLevel(key: AudioMixBusKey, value: number): void {
    this.driver.setGain(this.buses[key], clampUnit(value));
  }

  setMaster(value: number, muted: boolean): void {
    this.driver.setGain(this.master, muted ? 0 : clampUnit(value));
  }

  setDynamicRange(value: AudioDynamicRange): void {
    this.driver.setDynamicRange(this.compressor, value);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const node of this.owned) this.driver.disconnect(node);
  }
}

export function createAudioMixGraph<Node>(
  driver: AudioMixDriver<Node>,
  initial: AudioMixInitialState,
): AudioMixGraph<Node> {
  return new AudioMixGraph(driver, initial);
}

export class LiveCaptureError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "LiveCaptureError";
  }
}

export interface LiveCaptureOptions {
  readonly source: string;
  readonly sourceSha256: string;
  readonly maxSeconds: number;
  readonly signal?: AbortSignal;
}

export interface LiveCaptureReceipt {
  readonly sourceSha256: string;
  readonly processorName: string;
  readonly sampleRate: number;
  readonly channels: number;
  readonly frameCount: number;
  readonly peak: number;
  readonly nonFinite: number;
  readonly clipped: number;
  readonly sourceChannelCounts: readonly number[];
  readonly channelNormalization: readonly string[];
  readonly wav: Blob;
}

const registeredWorklets = new WeakMap<AudioContext, Map<string, Promise<void>>>();
const MAX_WORKLETS_PER_CONTEXT = 4;

async function sourceHash(source: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function encodeWav(channels: readonly Float32Array[], sampleRate: number): Blob {
  const channelCount = channels.length, frames = channels[0]?.length ?? 0;
  const buffer = new ArrayBuffer(44 + frames * channelCount * 4), view = new DataView(buffer);
  const ascii = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  ascii(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); ascii(8, "WAVE"); ascii(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 3, true); view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channelCount * 4, true);
  view.setUint16(32, channelCount * 4, true); view.setUint16(34, 32, true); ascii(36, "data");
  view.setUint32(40, buffer.byteLength - 44, true);
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) for (const channel of channels) {
    view.setFloat32(offset, channel[frame] ?? 0, true);
    offset += 4;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export async function startLiveMixCapture(
  context: AudioContext,
  finalBus: AudioNode,
  options: LiveCaptureOptions,
): Promise<{ readonly processorName: string; readonly stop: () => Promise<LiveCaptureReceipt> }> {
  if (finalBus.context !== context) throw new LiveCaptureError("wrong_context", "final bus belongs to another AudioContext");
  if (context.state !== "running") throw new LiveCaptureError("context_suspended", `AudioContext is ${context.state}`);
  if (options.maxSeconds <= 0 || options.maxSeconds > 10) throw new LiveCaptureError("invalid_duration", "capture duration must be within ten seconds");
  if (!/^[a-f0-9]{64}$/.test(options.sourceSha256) || await sourceHash(options.source) !== options.sourceSha256) {
    throw new LiveCaptureError("source_hash_mismatch", "worklet source hash does not match");
  }
  const processorName = `ironsight-pcm-${options.sourceSha256.slice(0, 16)}`;
  let registrations = registeredWorklets.get(context);
  if (!registrations) {
    registrations = new Map();
    registeredWorklets.set(context, registrations);
  }
  let registration = registrations.get(options.sourceSha256);
  if (!registration) {
    if (registrations.size >= MAX_WORKLETS_PER_CONTEXT) {
      throw new LiveCaptureError("worklet_registration_limit", "AudioContext capture worklet limit reached");
    }
    const moduleSource = options.source.replace("__PROCESSOR_NAME__", processorName);
    const moduleUrl = URL.createObjectURL(new Blob([moduleSource], { type: "text/javascript" }));
    registration = context.audioWorklet.addModule(moduleUrl)
      .catch(error => {
        if (registrations?.get(options.sourceSha256) === registration) registrations.delete(options.sourceSha256);
        throw new LiveCaptureError("module_registration_failed", error instanceof Error ? error.message : String(error));
      })
      .finally(() => URL.revokeObjectURL(moduleUrl));
    registrations.set(options.sourceSha256, registration);
  }
  await registration;
  if (options.signal?.aborted) throw new LiveCaptureError("capture_aborted", "capture was canceled during worklet registration");
  const node = new AudioWorkletNode(context, processorName, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    channelCount: 2,
  });
  const silentOutput = context.createGain(); silentOutput.gain.value = 0;
  const chunks: [Float32Array[], Float32Array[]] = [[], []];
  const sourceChannelCounts = new Set<number>();
  const channelNormalization = new Set<string>();
  let frames = 0, sequence = 0, captureError: LiveCaptureError | null = null, stopped = false;
  let flush: ((frames: number) => void) | null = null;
  node.onprocessorerror = () => { captureError = new LiveCaptureError("processor_error", "AudioWorklet processor failed"); };
  node.port.onmessage = event => {
    const packet = event.data;
    if (packet?.type === "flush") { flush?.(packet.frames); return; }
    if (packet?.type !== "pcm") return;
    if (!Array.isArray(packet.channels) || packet.channels.length !== 2 || packet.channels.some((channel: unknown) => !(channel instanceof Float32Array))) {
      captureError = new LiveCaptureError("missing_channels", "AudioWorklet packet did not contain stereo Float32 PCM"); return;
    }
    const length = packet.channels[0].length;
    if (packet.sequence !== sequence || packet.startFrame !== frames || packet.frames !== length) {
      captureError ??= new LiveCaptureError("sample_gap", `expected sequence ${sequence}/frame ${frames}; received ${packet.sequence}/${packet.startFrame}/${packet.frames}`); return;
    }
    if (frames + length > context.sampleRate * options.maxSeconds) {
      captureError = new LiveCaptureError("buffer_overflow", "capture exceeded its bounded duration"); return;
    }
    sourceChannelCounts.add(packet.sourceChannels);
    channelNormalization.add(packet.normalization);
    chunks[0].push(packet.channels[0]); chunks[1].push(packet.channels[1]); frames += length; sequence += 1;
  };
  finalBus.connect(node); node.connect(silentOutput).connect(context.destination);
  return { processorName, stop: async () => {
    if (stopped) throw new LiveCaptureError("early_stop", "capture already stopped");
    stopped = true;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (context.state !== "running") throw new LiveCaptureError("context_suspended", `AudioContext is ${context.state}`);
      const flushed = new Promise<number>((resolve, reject) => {
        flush = resolve;
        flushTimer = setTimeout(() => reject(new LiveCaptureError("flush_timeout", "AudioWorklet did not acknowledge stop")), 3_000);
      });
      node.port.postMessage({ type: "stop" });
      const acknowledgedFrames = await flushed;
      if (captureError) throw captureError;
      if (frames === 0 || acknowledgedFrames !== frames) throw new LiveCaptureError("empty_capture", "capture has no continuous PCM");
      const channels = chunks.map(channelChunks => {
        const channel = new Float32Array(frames); let offset = 0;
        for (const chunk of channelChunks) { channel.set(chunk, offset); offset += chunk.length; }
        return channel;
      });
      let peak = 0, nonFinite = 0, clipped = 0;
      for (const channel of channels) for (const sample of channel) {
        if (!Number.isFinite(sample)) nonFinite += 1;
        else { peak = Math.max(peak, Math.abs(sample)); if (Math.abs(sample) > 0.98) clipped += 1; }
      }
      return { sourceSha256: options.sourceSha256, processorName, sampleRate: context.sampleRate,
        channels: 2, frameCount: frames, peak, nonFinite, clipped,
        sourceChannelCounts: [...sourceChannelCounts].sort(), channelNormalization: [...channelNormalization].sort(),
        wav: encodeWav(channels, context.sampleRate) };
    } finally {
      if (flushTimer !== undefined) clearTimeout(flushTimer);
      node.port.onmessage = null;
      finalBus.disconnect(node); node.disconnect(); silentOutput.disconnect();
    }
  } };
}
