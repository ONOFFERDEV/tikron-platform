import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import * as capture from '../scripts/wav-encode.mjs';
import { scenarioHandlers as audioScenarioHandlers } from '../scripts/aside-scenarios/audio.mjs';
import { closeOwnedTab } from '../scripts/aside-scenarios/performance.mjs';

test('audio scenario module implements every manifest-owned route', () => {
  assert.equal(typeof audioScenarioHandlers['perf-audio-lifecycle'], 'function');
  assert.equal(typeof audioScenarioHandlers['perf-audio-combat'], 'function');
});

test('capture attachment rejects a final bus from another AudioContext', () => {
  assert.throws(
    () => capture.validateCaptureAttachment({ contextId: 'game', sourceContextId: 'other', outputIsZero: true }),
    error => error.code === 'wrong_context',
  );
});

test('PCM accumulator rejects a missing channel', () => {
  const accumulator = new capture.PcmAccumulator({ sampleRate: 48_000, channels: 2, maxSeconds: 1 });
  assert.throws(
    () => accumulator.push({ sequence: 0, startFrame: 0, channels: [new Float32Array(128)] }),
    error => error.code === 'missing_channels',
  );
});

test('PCM accumulator rejects stop before any real input', () => {
  const accumulator = new capture.PcmAccumulator({ sampleRate: 48_000, channels: 2, maxSeconds: 1 });
  assert.throws(() => accumulator.finish(), error => error.code === 'empty_capture');
});

test('PCM accumulator rejects a sequence or sample-time gap', () => {
  const accumulator = new capture.PcmAccumulator({ sampleRate: 48_000, channels: 1, maxSeconds: 1 });
  accumulator.push({ sequence: 0, startFrame: 0, channels: [new Float32Array(128)] });
  assert.throws(
    () => accumulator.push({ sequence: 2, startFrame: 256, channels: [new Float32Array(128)] }),
    error => error.code === 'sample_gap',
  );
});

test('PCM accumulator rejects data beyond its bounded duration', () => {
  const accumulator = new capture.PcmAccumulator({ sampleRate: 10, channels: 1, maxSeconds: 1 });
  assert.throws(
    () => accumulator.push({ sequence: 0, startFrame: 0, channels: [new Float32Array(11)] }),
    error => error.code === 'buffer_overflow',
  );
});

test('WAV inspection rejects a renamed PCM integer payload', () => {
  const bytes = capture.encodeFloat32Wav({ sampleRate: 48_000, channels: [new Float32Array([0, 0.25, -0.25])] });
  bytes[20] = 1;
  bytes[21] = 0;
  assert.throws(() => capture.inspectFloat32Wav(bytes), error => error.code === 'invalid_wav_format');
});

test('AudioWorklet upmixes a live mono final bus while forcing its output to zero', async () => {
  const source = await readFile(new URL('../scripts/audio-pcm-worklet.mjs', import.meta.url), 'utf8');
  let Processor = null;
  const messages = [];
  class BaseProcessor {
    constructor() {
      this.port = { postMessage: message => messages.push(message), onmessage: null };
    }
  }
  vm.runInNewContext(source, {
    AudioWorkletProcessor: BaseProcessor,
    registerProcessor: (_name, value) => { Processor = value; },
    Float32Array,
  });
  assert.equal(typeof Processor, 'function');
  const processor = new Processor();
  const output = [new Float32Array([1, 1, 1]), new Float32Array([1, 1, 1])];

  const keepAlive = processor.process([[new Float32Array([0.1, 0.2, 0.3])]], [output]);

  assert.equal(keepAlive, true);
  assert.deepEqual(Array.from(output[0]), [0, 0, 0]);
  assert.deepEqual(Array.from(output[1]), [0, 0, 0]);
  assert.equal(messages[0].frames, 3);
  assert.equal(messages[0].channels.length, 2);
  assert.equal(messages[0].sourceChannels, 1);
  assert.equal(messages[0].normalization, 'mono-duplicated-to-stereo');
  assert.equal(messages[0].channels[0].length, 3);
  assert.deepEqual(Array.from(messages[0].channels[1]), Array.from(messages[0].channels[0]));
});

test('capture finalization rejects cleanup failure', async () => {
  await assert.rejects(
    closeOwnedTab({ run: async () => { throw new Error('Aside REPL session is not alive'); } }),
    /Aside REPL session is not alive/,
  );
});
