// Original nine-slice damage border. Bake the soft falloff offline so first
// damage does not ask the browser to compile a full-screen blurred inset shadow.
// node tools/bake-damage-vignette.mjs
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
const size = 384, slice = 128;
// Smooth approximation to the integrated Gaussian at a rectangular edge.
const falloff = distance => {
  const t = Math.max(0, Math.min(1, (distance + 24) / (slice + 24)));
  return (1 - t) ** 3 * (1 + 3 * t);
};
const raw = Buffer.alloc(size * (1 + size * 4));
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const i = y * (size * 4 + 1) + 1 + x * 4;
  const ax = falloff(Math.min(x, size - 1 - x)), ay = falloff(Math.min(y, size - 1 - y));
  raw[i] = 235; raw[i + 1] = 48; raw[i + 2] = 65;
  raw[i + 3] = Math.round(255 * .65 * (1 - (1 - ax) * (1 - ay)));
}
const crc = data => {
  let value = 0xffffffff;
  for (const byte of data) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const head = Buffer.alloc(4), tail = Buffer.alloc(4);
  head.writeUInt32BE(data.length); tail.writeUInt32BE(crc(body));
  return Buffer.concat([head, body, tail]);
};
const header = Buffer.alloc(13);
header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
const output = new URL('../public/assets/ui/damage-vignette.png', import.meta.url);
await mkdir(new URL('.', output), { recursive: true });
await writeFile(output, png);
console.log(JSON.stringify({ file: output.pathname, size, slice, bytes: png.length, decodedBytes: size * size * 4 }));
