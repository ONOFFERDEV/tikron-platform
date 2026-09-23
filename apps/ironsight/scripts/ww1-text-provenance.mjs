import { createHash } from 'node:crypto';

export const WW1_TEXT_HASH_POLICY = 'sha256-crlf-to-lf-v1';

export function canonicalTextSha256(bytes) {
  const canonical = bytes.filter((byte, index) => byte !== 13 || bytes[index + 1] !== 10);
  return createHash('sha256').update(canonical).digest('hex');
}
