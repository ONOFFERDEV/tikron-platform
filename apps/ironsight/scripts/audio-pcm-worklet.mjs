class IronsightPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sequence = 0;
    this.startFrame = 0;
    this.recording = true;
    this.port.onmessage = event => {
      if (event.data?.type !== 'stop') return;
      this.recording = false;
      this.port.postMessage({ type: 'flush', sequence: this.sequence, frames: this.startFrame });
    };
  }

  process(inputs, outputs) {
    for (const output of outputs) for (const channel of output) channel.fill(0);
    const input = inputs[0] ?? [];
    const frames = input[0]?.length ?? 0;
    if (this.recording && frames > 0) {
      const left = input[0];
      const right = input[1] ?? left;
      const channels = [left.slice(), right.slice()];
      this.port.postMessage({
        type: 'pcm', sequence: this.sequence, startFrame: this.startFrame, frames, channels,
        sourceChannels: input.length,
        normalization: input.length === 1 ? 'mono-duplicated-to-stereo' : 'native-stereo',
      });
      this.sequence += 1;
      this.startFrame += frames;
    }
    return this.recording;
  }
}

registerProcessor('__PROCESSOR_NAME__', IronsightPcmCaptureProcessor);
