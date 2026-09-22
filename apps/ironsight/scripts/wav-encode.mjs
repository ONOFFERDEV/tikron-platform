export class CaptureValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CaptureValidationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new CaptureValidationError(code, message);
}

export function validateCaptureAttachment(input) {
  if (input.contextId !== input.sourceContextId) fail('wrong_context', 'capture source belongs to another AudioContext');
  if (!input.outputIsZero) fail('double_output', 'capture branch output must be zero');
  return input;
}

export class PcmAccumulator {
  constructor(options) {
    this.sampleRate = options.sampleRate;
    this.channelCount = options.channels;
    this.maxFrames = Math.floor(options.sampleRate * options.maxSeconds);
    this.frames = 0;
    this.sequence = 0;
    this.chunks = Array.from({ length: options.channels }, () => []);
  }

  push(packet) {
    if (packet.channels.length !== this.channelCount) fail('missing_channels', 'capture packet channel count changed');
    const length = packet.channels[0]?.length ?? 0;
    if (length === 0 || packet.channels.some(channel => channel.length !== length)) {
      fail('missing_channels', 'capture packet channels are empty or uneven');
    }
    if (packet.sequence !== this.sequence || packet.startFrame !== this.frames) fail('sample_gap', 'capture sequence or frame offset is discontinuous');
    if (this.frames + length > this.maxFrames) fail('buffer_overflow', 'capture exceeded its bounded duration');
    for (let index = 0; index < this.channelCount; index += 1) this.chunks[index].push(packet.channels[index].slice());
    this.frames += length;
    this.sequence += 1;
  }

  finish() {
    if (this.frames === 0) fail('empty_capture', 'capture stopped before receiving PCM');
    return this.chunks.map(chunks => {
      const channel = new Float32Array(this.frames);
      let offset = 0;
      for (const chunk of chunks) {
        channel.set(chunk, offset);
        offset += chunk.length;
      }
      return channel;
    });
  }
}

function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

function readAscii(view, offset, length) {
  let value = '';
  for (let index = 0; index < length; index += 1) value += String.fromCharCode(view.getUint8(offset + index));
  return value;
}

export function encodeFloat32Wav(input) {
  const channelCount = input.channels.length;
  const frameCount = input.channels[0]?.length ?? 0;
  if (channelCount < 1 || frameCount < 1 || input.channels.some(channel => channel.length !== frameCount)) {
    fail('invalid_pcm', 'PCM channels must be nonempty and equal length');
  }
  const dataBytes = frameCount * channelCount * 4;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  writeAscii(view, 0, 'RIFF'); view.setUint32(4, 36 + dataBytes, true); writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 3, true);
  view.setUint16(22, channelCount, true); view.setUint32(24, input.sampleRate, true);
  view.setUint32(28, input.sampleRate * channelCount * 4, true); view.setUint16(32, channelCount * 4, true);
  view.setUint16(34, 32, true); writeAscii(view, 36, 'data'); view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      view.setFloat32(offset, input.channels[channel][frame], true);
      offset += 4;
    }
  }
  return bytes;
}

export function inspectFloat32Wav(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 44) fail('invalid_wav_format', 'WAV is shorter than its header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const channels = view.getUint16(22, true), sampleRate = view.getUint32(24, true), bits = view.getUint16(34, true);
  const dataBytes = view.getUint32(40, true), format = view.getUint16(20, true), blockAlign = view.getUint16(32, true);
  if (readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE' || readAscii(view, 12, 4) !== 'fmt '
    || readAscii(view, 36, 4) !== 'data' || format !== 3 || bits !== 32 || channels < 1
    || blockAlign !== channels * 4 || dataBytes !== bytes.byteLength - 44 || dataBytes % blockAlign !== 0) {
    fail('invalid_wav_format', 'WAV must be IEEE float32 with a complete data chunk');
  }
  let peak = 0, nonFinite = 0, clipped = 0;
  for (let offset = 44; offset < bytes.byteLength; offset += 4) {
    const sample = view.getFloat32(offset, true);
    if (!Number.isFinite(sample)) nonFinite += 1;
    else {
      peak = Math.max(peak, Math.abs(sample));
      if (Math.abs(sample) > 0.98) clipped += 1;
    }
  }
  return { format: 'IEEE_FLOAT', sampleRate, channels, frameCount: dataBytes / blockAlign, peak, nonFinite, clipped };
}
