import { ByteWriter, ByteReader } from "./bytes.js";

/**
 * A binary codec for one value type. Delta operations are driven by the parent:
 * primitives are atomic (delta == full), while objects and maps compute a delta
 * against a previous snapshot. This is a snapshot-diff design (no proxies / no
 * per-field dirty tracking), which keeps developer state as plain objects.
 */
export interface Codec<T> {
  writeFull(w: ByteWriter, value: T): void;
  readFull(r: ByteReader): T;
  writeDelta(w: ByteWriter, prev: T | undefined, next: T): void;
  readDelta(r: ByteReader, prev: T | undefined): T;
  equals(a: T, b: T): boolean;
  /**
   * A structural deep copy of `value` that shares no mutable sub-objects with it,
   * so the copy is not perturbed by later in-place mutation of `value`. Only the
   * fields the codec knows about are copied (primitives are returned as-is). Used
   * to snapshot an AOI baseline cheaply, where the live entities are shared
   * references that the next tick mutates — much faster than `structuredClone`
   * because it walks only the codec's own shape.
   */
  clone(value: T): T;
  /**
   * A canonical string describing this codec's decode-relevant shape, used to
   * fingerprint the schema for the Welcome handshake ({@link schemaFingerprint}).
   * It reflects only what changes how bytes map to values — field names and order,
   * primitive types, `quant` min/max/step, `enum` members and order, container kind —
   * and deliberately omits write-only constraints (`str` maxLen, which does not affect
   * decoding). Optional and additive: a custom codec that does not implement it makes
   * the whole tree undescribable, so {@link schemaFingerprint} returns `null` and the
   * handshake safely skips the schema check rather than false-rejecting.
   */
  describe?(): string | undefined;
}

/**
 * Length-prefix a user-controlled string (a field name or enum member) inside the
 * canonical description so it cannot collide across a separator boundary. Without it
 * `enumOf("a|b", "c")` and `enumOf("a", "b|c")` would both render their members as
 * `a|b|c` and fingerprint identically; `len#value` is uniquely decodable, so distinct
 * token sequences always produce distinct strings.
 */
function descToken(s: string): string {
  return `${s.length}#${s}`;
}

export type Prim = "u8" | "u16" | "u32" | "i32" | "f32" | "f64" | "bool" | "str";

type PrimValue<P extends Prim> = P extends "bool" ? boolean : P extends "str" ? string : number;

const PRIM_IO = {
  u8: { write: (w: ByteWriter, v: number) => w.u8(v), read: (r: ByteReader) => r.u8() },
  u16: { write: (w: ByteWriter, v: number) => w.u16(v), read: (r: ByteReader) => r.u16() },
  u32: { write: (w: ByteWriter, v: number) => w.u32(v), read: (r: ByteReader) => r.u32() },
  i32: { write: (w: ByteWriter, v: number) => w.i32(v), read: (r: ByteReader) => r.i32() },
  f32: { write: (w: ByteWriter, v: number) => w.f32(v), read: (r: ByteReader) => r.f32() },
  f64: { write: (w: ByteWriter, v: number) => w.f64(v), read: (r: ByteReader) => r.f64() },
  bool: { write: (w: ByteWriter, v: boolean) => w.bool(v), read: (r: ByteReader) => r.bool() },
  str: { write: (w: ByteWriter, v: string) => w.str(v), read: (r: ByteReader) => r.str() },
};

export function prim<P extends Prim>(type: P): Codec<PrimValue<P>> {
  const io = PRIM_IO[type];
  const write = io.write as (w: ByteWriter, v: PrimValue<P>) => void;
  const read = io.read as (r: ByteReader) => PrimValue<P>;
  return {
    writeFull: write,
    readFull: read,
    writeDelta: (w, _prev, next) => write(w, next),
    readDelta: (r) => read(r),
    equals: (a, b) => a === b,
    clone: (v) => v, // primitives are immutable — no copy needed
    describe: () => type,
  };
}

/**
 * A number snapped to a fixed grid and stored in the smallest integer that spans
 * the range — the core bandwidth lever for continuous fields (position, velocity,
 * health, angle). Trades a bounded amount of precision for size: a value that a
 * `prim("f32")` spends 4 bytes on rides in 1–4 bytes here, and — because `equals`
 * compares the quantized bucket rather than the raw float — sub-`step` jitter no
 * longer counts as a change, so it drops out of deltas entirely.
 *
 * `encode(v) = round((clamp(v, min, max) − min) / step)`, `decode(q) = min + q·step`,
 * so the round-trip error is at most `step / 2`. The wire width is fixed once from
 * the level count `N = round((max − min) / step)`: `u8` when `N ≤ 255`, `u16` when
 * `N ≤ 65535`, otherwise `u32`. Deltas are atomic like a `prim` (a changed field
 * re-sends its whole quantized value; there is nothing smaller to diff).
 *
 * @example
 * // Position on a 4096 m map at 1 cm precision: 100 steps per metre.
 * // N = 409600 → u32 (4 bytes) — same width as f32 but with a hard error bound.
 * const posX = quant(0, 4096, 0.01);
 * @example
 * // A 0..1 health fraction at 0.4% precision: N = 250 → u8 (1 byte, vs 4 for f32).
 * const health = quant(0, 1, 0.004);
 * @example
 * // A heading in radians at ~0.1° precision: N = 62832 → u16 (2 bytes).
 * const angle = quant(0, Math.PI * 2, 0.0001);
 *
 * @param min  inclusive low end of the range (smaller inputs clamp up to it)
 * @param max  inclusive high end of the range (larger inputs clamp down to it)
 * @param step quantization grid size; must be > 0 and no larger than `max − min`
 */
export function quant(min: number, max: number, step: number): Codec<number> {
  if (!(step > 0)) {
    throw new Error(`quant: step must be > 0, got ${step}.`);
  }
  if (!(max > min)) {
    throw new Error(`quant: max (${max}) must be greater than min (${min}).`);
  }
  if (step > max - min) {
    throw new Error(
      `quant: step (${step}) is larger than the range max − min (${max - min}), ` +
        `which collapses every value to ${min}. Pick a step no larger than the range.`,
    );
  }
  const levels = Math.round((max - min) / step);
  const io = levels <= 0xff ? PRIM_IO.u8 : levels <= 0xffff ? PRIM_IO.u16 : PRIM_IO.u32;
  const quantize = (v: number): number => {
    const clamped = v < min ? min : v > max ? max : v;
    return Math.round((clamped - min) / step);
  };
  const write = (w: ByteWriter, v: number): void => io.write(w, quantize(v));
  const read = (r: ByteReader): number => min + io.read(r) * step;
  return {
    writeFull: write,
    readFull: read,
    writeDelta: (w, _prev, next) => write(w, next),
    readDelta: (r) => read(r),
    equals: (a, b) => quantize(a) === quantize(b),
    clone: (v) => v, // numbers are immutable
    // min/max/step fully determine the wire width and the byte->value mapping.
    describe: () => `q(${min},${max},${step})`,
  };
}

type Shape = Record<string, Prim | Codec<unknown>>;
type Infer<S extends Shape> = {
  [K in keyof S]: S[K] extends Prim ? PrimValue<S[K]> : S[K] extends Codec<infer U> ? U : never;
};

interface Field {
  name: string;
  codec: Codec<unknown>;
}

/** An object codec with per-field delta (a changed-field bitmask + changed values). */
export function schema<S extends Shape>(shape: S): Codec<Infer<S>> {
  const fields: Field[] = Object.entries(shape).map(([name, t]) => ({
    name,
    codec: typeof t === "string" ? (prim(t) as Codec<unknown>) : t,
  }));
  const maskBytes = Math.ceil(fields.length / 8) || 1;

  const get = (o: unknown, name: string): unknown => (o as Record<string, unknown>)[name];

  return {
    writeFull(w, value) {
      for (const f of fields) f.codec.writeFull(w, get(value, f.name));
    },
    readFull(r) {
      const out: Record<string, unknown> = {};
      for (const f of fields) out[f.name] = f.codec.readFull(r);
      return out as Infer<S>;
    },
    writeDelta(w, prev, next) {
      const changed: number[] = [];
      fields.forEach((f, i) => {
        const isChanged = prev === undefined || !f.codec.equals(get(prev, f.name), get(next, f.name));
        if (isChanged) changed.push(i);
      });
      for (let b = 0; b < maskBytes; b++) {
        let byte = 0;
        for (const idx of changed) if (idx >> 3 === b) byte |= 1 << (idx & 7);
        w.u8(byte);
      }
      for (const idx of changed) {
        const f = fields[idx]!;
        const prevField = prev === undefined ? undefined : get(prev, f.name);
        f.codec.writeDelta(w, prevField, get(next, f.name));
      }
    },
    readDelta(r, prev) {
      const mask: number[] = [];
      for (let b = 0; b < maskBytes; b++) mask.push(r.u8());
      const out: Record<string, unknown> = { ...((prev ?? {}) as Record<string, unknown>) };
      fields.forEach((f, i) => {
        if (((mask[i >> 3] ?? 0) & (1 << (i & 7))) !== 0) {
          const prevField = prev === undefined ? undefined : get(prev, f.name);
          out[f.name] = f.codec.readDelta(r, prevField);
        }
      });
      return out as Infer<S>;
    },
    equals(a, b) {
      for (const f of fields) if (!f.codec.equals(get(a, f.name), get(b, f.name))) return false;
      return true;
    },
    clone(value) {
      const out: Record<string, unknown> = {};
      for (const f of fields) out[f.name] = f.codec.clone(get(value, f.name));
      return out as Infer<S>;
    },
    describe() {
      // Field names + order are decode-relevant (they drive the read sequence and the
      // dirty-bit mask). If any child cannot describe, the whole object cannot either.
      const parts: string[] = [];
      for (const f of fields) {
        const childDesc = f.codec.describe?.();
        if (childDesc === undefined) return undefined;
        parts.push(`${descToken(f.name)}:${childDesc}`);
      }
      return `obj(${parts.join(",")})`;
    },
  };
}

/**
 * A string-keyed map codec — the dominant shape of room state (e.g. a player map).
 *
 * Delta design: the wire carries the removed keys, then the added/changed entries.
 * Each changed entry is a `[key, payload]` pair, and the payload is the child's own
 * *delta* when the key already existed in the baseline (so a `schema` child ships
 * only its changed fields via its dirty-bit mask) and the child's *full* encoding
 * when the key is new (there is no prior value to diff against). No per-entry
 * new-vs-existing tag is written: the reader is handed the same `prev` baseline the
 * writer diffed against — the standing contract of every delta codec here — so it
 * re-derives `key in prev` identically and picks `readDelta`/`readFull` to match.
 * That keeps an atomic child (where `writeDelta === writeFull`, e.g. `prim`/`quant`/
 * `str`/`enumOf`) byte-for-byte the size of the old whole-entry format, while a
 * `schema` (or nested `mapOf`/`listOf`) child collapses a one-field edit from a full
 * re-encode to a mask plus that one field.
 */
export function mapOf<T>(child: Codec<T>): Codec<Record<string, T>> {
  const keysOf = (o: Record<string, T>): string[] => Object.keys(o);

  return {
    writeFull(w, value) {
      const keys = keysOf(value);
      w.varint(keys.length);
      for (const k of keys) {
        w.str(k);
        child.writeFull(w, value[k] as T);
      }
    },
    readFull(r) {
      const n = r.varint();
      const out: Record<string, T> = {};
      for (let i = 0; i < n; i++) {
        const k = r.str();
        out[k] = child.readFull(r);
      }
      return out;
    },
    writeDelta(w, prev, next) {
      const prevObj = prev ?? {};
      const removed = keysOf(prevObj).filter((k) => !(k in next));
      const changed = keysOf(next).filter(
        (k) => !(k in prevObj) || !child.equals(prevObj[k] as T, next[k] as T),
      );
      w.varint(removed.length);
      for (const k of removed) w.str(k);
      w.varint(changed.length);
      for (const k of changed) {
        w.str(k);
        // Existing key -> field-level delta against its baseline; new key -> full.
        if (k in prevObj) child.writeDelta(w, prevObj[k] as T, next[k] as T);
        else child.writeFull(w, next[k] as T);
      }
    },
    readDelta(r, prev) {
      const prevObj = prev ?? {};
      const out: Record<string, T> = { ...prevObj };
      const removedN = r.varint();
      for (let i = 0; i < removedN; i++) delete out[r.str()];
      const changedN = r.varint();
      for (let i = 0; i < changedN; i++) {
        const k = r.str();
        // Mirror the writer: a key present in the baseline was delta-encoded.
        out[k] = k in prevObj ? child.readDelta(r, prevObj[k] as T) : child.readFull(r);
      }
      return out;
    },
    equals(a, b) {
      const ak = keysOf(a);
      if (ak.length !== keysOf(b).length) return false;
      for (const k of ak) if (!(k in b) || !child.equals(a[k] as T, b[k] as T)) return false;
      return true;
    },
    clone(value) {
      const out: Record<string, T> = {};
      for (const k of keysOf(value)) out[k] = child.clone(value[k] as T);
      return out;
    },
    describe() {
      const c = child.describe?.();
      return c === undefined ? undefined : `map(${c})`;
    },
  };
}

/**
 * Use for ordered arrays whose elements share a codec (e.g. a scoreboard, a
 * projectile pool, an inventory). Length-prefixed on the wire.
 *
 * @example const board = listOf(schema({ name: str(16), score: "u32" }));
 *
 * Delta design: index-based per-entry diff, mirroring {@link mapOf} with numeric
 * keys. The wire carries the new length (which also encodes truncation/removals),
 * then the count of changed indices, then `[index, full-element]` pairs for every
 * index that is new or whose element changed. Trade-off: changed/appended elements
 * are sent in FULL rather than recursively delta-encoded — compact for small
 * elements (the common case) and consistent with `mapOf`, at the cost of not
 * shrinking large per-element edits. An unchanged list costs ~2 bytes (length +
 * zero changed-count), never a re-encode of every element.
 */
export function listOf<T>(child: Codec<T>): Codec<T[]> {
  return {
    writeFull(w, value) {
      w.varint(value.length);
      for (const el of value) child.writeFull(w, el);
    },
    readFull(r) {
      const n = r.varint();
      const out: T[] = new Array(n);
      for (let i = 0; i < n; i++) out[i] = child.readFull(r);
      return out;
    },
    writeDelta(w, prev, next) {
      const prevArr = prev ?? [];
      w.varint(next.length);
      const changed: number[] = [];
      for (let i = 0; i < next.length; i++) {
        if (i >= prevArr.length || !child.equals(prevArr[i] as T, next[i] as T)) changed.push(i);
      }
      w.varint(changed.length);
      for (const i of changed) {
        w.varint(i);
        child.writeFull(w, next[i] as T);
      }
    },
    readDelta(r, prev) {
      const prevArr = prev ?? [];
      const nextLen = r.varint();
      const out = prevArr.slice(0, nextLen);
      const changedN = r.varint();
      for (let j = 0; j < changedN; j++) {
        const i = r.varint();
        out[i] = child.readFull(r);
      }
      return out;
    },
    equals(a, b) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!child.equals(a[i] as T, b[i] as T)) return false;
      return true;
    },
    clone(value) {
      const out: T[] = new Array(value.length);
      for (let i = 0; i < value.length; i++) out[i] = child.clone(value[i] as T);
      return out;
    },
    describe() {
      const c = child.describe?.();
      return c === undefined ? undefined : `list(${c})`;
    },
  };
}

/**
 * Use for a value that may be absent (e.g. an optional target, a nullable rank).
 * A presence byte precedes the value; `null` writes only that byte.
 *
 * @example const target = optionalOf(schema({ x: "f32", y: "f32" }));
 *
 * Deltas correctly cover every transition: null→value writes presence + full
 * value, value→null writes just the presence byte, and value→value delegates to
 * the child's own delta (so nested structs still diff field-by-field).
 */
export function optionalOf<T>(child: Codec<T>): Codec<T | null> {
  const inner = (v: T | null | undefined): T | undefined => (v == null ? undefined : v);
  return {
    writeFull(w, value) {
      w.bool(value !== null);
      if (value !== null) child.writeFull(w, value);
    },
    readFull(r) {
      return r.bool() ? child.readFull(r) : null;
    },
    writeDelta(w, prev, next) {
      w.bool(next !== null);
      if (next !== null) child.writeDelta(w, inner(prev), next);
    },
    readDelta(r, prev) {
      return r.bool() ? child.readDelta(r, inner(prev)) : null;
    },
    equals(a, b) {
      if (a === null || b === null) return a === b;
      return child.equals(a, b);
    },
    clone(value) {
      return value === null ? null : child.clone(value);
    },
    describe() {
      const c = child.describe?.();
      return c === undefined ? undefined : `opt(${c})`;
    },
  };
}

/**
 * Use for a fixed string union (e.g. a game mode, a team color). Encoded as a
 * single u8 index into the given values, so it is atomic in deltas like a prim.
 *
 * @example const mode = enumOf("ffa", "duo", "squad"); // Codec<"ffa"|"duo"|"squad">
 *
 * Throws at construction if given more than 256 members (a u8 index holds
 * 0–255), and at encode time if handed a string outside the set (the error
 * lists the allowed values so an agent can correct the call immediately).
 */
export function enumOf<const V extends readonly string[]>(...values: V): Codec<V[number]> {
  if (values.length > 256) {
    throw new Error(
      `enumOf: ${values.length} values given but a u8 index holds at most 256. ` +
        `Split the union or encode it as a bounded str() instead.`,
    );
  }
  const index = new Map<string, number>();
  values.forEach((v, i) => index.set(v, i));
  const write = (w: ByteWriter, value: V[number]): void => {
    const i = index.get(value);
    if (i === undefined) {
      throw new Error(
        `enumOf: cannot encode ${JSON.stringify(value)} — not a member. ` +
          `Allowed values: ${values.join(", ")}.`,
      );
    }
    w.u8(i);
  };
  return {
    writeFull: write,
    readFull: (r) => values[r.u8()] as V[number],
    writeDelta: (w, _prev, next) => write(w, next),
    readDelta: (r) => values[r.u8()] as V[number],
    equals: (a, b) => a === b,
    clone: (v) => v, // enum members are immutable strings
    // Members + order fix the u8 index of each value. Length-prefix each member so a
    // "|"-bearing value can't be confused with a member boundary (see descToken).
    describe: () => `enum(${values.map(descToken).join(",")})`,
  };
}

/**
 * Use instead of `prim("str")` when a string is client-influenced and must not
 * blow up snapshots (e.g. a player name, a chat line). Same wire format as
 * `prim("str")`; the only difference is a length check on write.
 *
 * @example const name = str(24); // rejects names longer than 24 characters
 *
 * Validates the character count (`value.length`) on every write and throws an
 * error naming the offending length, the limit, and the one-line fix so an
 * agent can slice the value before assigning it.
 */
export function str(maxLen: number): Codec<string> {
  const check = (value: string): void => {
    if (value.length > maxLen) {
      throw new Error(
        `str(${maxLen}): value is ${value.length} characters, over the ${maxLen}-character limit. ` +
          `Truncate before assigning, e.g. value.slice(0, ${maxLen}).`,
      );
    }
  };
  return {
    writeFull: (w, value) => {
      check(value);
      w.str(value);
    },
    readFull: (r) => r.str(),
    writeDelta: (w, _prev, next) => {
      check(next);
      w.str(next);
    },
    readDelta: (r) => r.str(),
    equals: (a, b) => a === b,
    clone: (v) => v, // strings are immutable
    // maxLen is a write-only length check — it does not change the wire format (same
    // varint-prefixed bytes as prim("str")), so it is excluded and str(n) fingerprints
    // identically to prim("str"), which is decode-compatible.
    describe: () => "str",
  };
}

export function encodeFull<T>(codec: Codec<T>, value: T): Uint8Array {
  const w = new ByteWriter();
  codec.writeFull(w, value);
  return w.bytes();
}

export function encodeDelta<T>(codec: Codec<T>, prev: T | undefined, next: T): Uint8Array {
  const w = new ByteWriter();
  codec.writeDelta(w, prev, next);
  return w.bytes();
}

/**
 * Encode a delta, or return `null` when `next` equals `prev` under the codec's own
 * `equals` — folding the "changed?" test and the encode into one call, so callers
 * replace an explicit `equals`-then-`encodeDelta` pair. Precisely: returns `null`
 * iff `prev !== undefined && codec.equals(prev, next)`; otherwise returns exactly
 * what `encodeDelta(codec, prev, next)` would (a `prev === undefined` baseline
 * always encodes). Used on the AOI hot path, where an unchanged viewer skips the
 * send entirely (no encode) and a changed one pays only the encode.
 */
export function encodeDeltaOrNull<T>(
  codec: Codec<T>,
  prev: T | undefined,
  next: T,
): Uint8Array | null {
  if (prev !== undefined && codec.equals(prev, next)) return null;
  return encodeDelta(codec, prev, next);
}

export function decodeFull<T>(codec: Codec<T>, bytes: Uint8Array): T {
  return codec.readFull(new ByteReader(bytes));
}

export function applyDelta<T>(codec: Codec<T>, prev: T | undefined, bytes: Uint8Array): T {
  return codec.readDelta(new ByteReader(bytes), prev);
}

/**
 * A stable FNV-1a (32-bit) fingerprint of a codec's decode-relevant shape, for the
 * Welcome handshake: the server ships `schemaFingerprint(stateCodec)` and the client
 * compares it against its own, rejecting a join with `schema_mismatch` when the two
 * differ (so a codec drift surfaces at connect time instead of as silently corrupt
 * state). Built over {@link Codec.describe}; returns `null` if any node in the tree
 * lacks `describe` (e.g. a hand-written custom codec), in which case callers skip the
 * check rather than false-reject. Deterministic across engines — `describe` uses only
 * spec-fixed string/number formatting — so a server and client that import the same
 * schema definition always agree.
 */
export function schemaFingerprint(codec: Codec<unknown>): number | null {
  const desc = codec.describe?.();
  if (desc === undefined) return null;
  let h = 0x811c9dc5;
  for (let i = 0; i < desc.length; i++) {
    h ^= desc.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
