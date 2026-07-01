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

export function decodeFull<T>(codec: Codec<T>, bytes: Uint8Array): T {
  return codec.readFull(new ByteReader(bytes));
}

export function applyDelta<T>(codec: Codec<T>, prev: T | undefined, bytes: Uint8Array): T {
  return codec.readDelta(new ByteReader(bytes), prev);
}
