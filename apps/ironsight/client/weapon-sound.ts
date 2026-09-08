/** Original offline synthesis. Baked once per context, never in the firing path.
 * Mono tails describe a short open industrial yard, not simulated room occlusion. */
export const WEAPON_SOUND_SHAPES = [
  { mechanical: 3100, click: 0.024, body: 0.10, tail: 0.32, reflection: 0.047 },
  { mechanical: 4200, click: 0.014, body: 0.065, tail: 0.22, reflection: 0.031 },
  { mechanical: 1900, click: 0.036, body: 0.19, tail: 0.46, reflection: 0.063 },
  { mechanical: 2600, click: 0.028, body: 0.25, tail: 0.58, reflection: 0.079 },
  { mechanical: 3600, click: 0.020, body: 0.085, tail: 0.27, reflection: 0.039 },
] as const;

type FireTone = { bp: number; dur: number; gain: number; thump: number };
export const FIRE_VARIANTS = 3;

export function synthesizeWeaponSound(sampleRate: number, weapon: number, tone: FireTone, variant = 0): Float32Array<ArrayBuffer> {
  const shape = WEAPON_SOUND_SHAPES[weapon] ?? WEAPON_SOUND_SHAPES[0];
  const length = Math.ceil(sampleRate * shape.tail);
  const samples = new Float32Array(length);
  let seed = (0x72656c61 ^ ((weapon + 1) * 7919) ^ ((variant + 1) * 104729)) >>> 0;
  let low = 0, air = 0, phase = 0;
  const pitch = 1 + (variant - 1) * 0.018;
  const alpha = 1 - Math.exp(-2 * Math.PI * tone.bp / sampleRate);
  const airAlpha = 1 - Math.exp(-2 * Math.PI * 780 / sampleRate);
  const reflection = Math.round(shape.reflection * sampleRate);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const white = (seed >>> 0) / 2147483648 - 1;
    low += alpha * (white - low); air += airAlpha * (white - air);
    const attack = Math.min(1, t / 0.0007);
    const crack = (white - low * 0.65) * Math.exp(-t * 6 / tone.dur) * tone.gain * 0.40;
    const click = Math.sin(2 * Math.PI * shape.mechanical * pitch * t) * Math.exp(-t * 7 / shape.click) * 0.11;
    phase += 2 * Math.PI * (tone.thump * pitch * Math.exp(-t * 13) + 38) / sampleRate;
    const body = Math.sin(phase) * Math.exp(-t * 5 / shape.body) * 0.32;
    // Diffuse low-frequency air arrives behind the crack; two quiet, damped
    // reflections reuse the baked waveform rather than allocating delay nodes.
    const tail = air * Math.min(1, t / 0.025) * Math.exp(-t * 4 / shape.tail) * 0.35;
    const echo = i >= reflection ? samples[i - reflection]! * 0.13 : 0;
    const echo2 = i >= reflection * 2 ? samples[i - reflection * 2]! * 0.06 : 0;
    const fade = Math.min(1, (length - 1 - i) / (sampleRate * 0.015));
    samples[i] = ((crack + click + body + tail) * attack + echo + echo2) * fade;
  }
  return samples;
}
