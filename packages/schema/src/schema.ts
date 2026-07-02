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
  };
}

/**
 * A string-keyed map codec. Deltas carry removed keys plus added/changed entries
 * (children are sent in full on change — compact for small entries like {x,y}).
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
        child.writeFull(w, next[k] as T);
      }
    },
    readDelta(r, prev) {
      const out: Record<string, T> = { ...(prev ?? {}) };
      const removedN = r.varint();
      for (let i = 0; i < removedN; i++) delete out[r.str()];
      const changedN = r.varint();
      for (let i = 0; i < changedN; i++) {
        const k = r.str();
        out[k] = child.readFull(r);
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
