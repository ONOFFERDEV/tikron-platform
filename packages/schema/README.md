# @tikron/schema

A tiny binary state codec for [Tikron](https://tikron.dev). Describe your game state once,
then encode it to compact bytes — either a **full** snapshot or a **delta** carrying only
what changed since the last frame. This is how [`@tikron/server`](https://www.npmjs.com/package/@tikron/server)'s
`IoArenaRoom` syncs high-frequency state cheaply. Zero dependencies; runs on the server,
in the browser, and in Workers.

```bash
npm i @tikron/schema
```

## Describe, encode, delta

```ts
import { schema, mapOf, encodeFull, encodeDelta, applyDelta } from "@tikron/schema";

// Fields are primitives ("u8".."u32", "i32", "f32", "f64", "bool", "str") or nested codecs.
const Player = schema({ x: "f32", y: "f32", hp: "u16" });
const World = schema({ tick: "u32", players: mapOf(Player) });

const prev = { tick: 1, players: { a: { x: 0, y: 0, hp: 100 } } };
const next = { tick: 2, players: { a: { x: 5, y: 0, hp: 100 } } };

const snapshot = encodeFull(World, next);        // full state — send to new joiners
const patch = encodeDelta(World, prev, next);    // only what changed — a few bytes
const restored = applyDelta(World, prev, patch); // deep-equals `next` on the client
```

Deltas diff structurally: unchanged fields, map entries, and list items cost nothing on
the wire, so a 128-entity world where two things moved sends two things.

## Key API

Composers: `schema(shape)`, `prim(type)`, `mapOf(child)`, `listOf(child)`,
`optionalOf(child)`, `enumOf(...values)`, `str(maxLen)` — each returns a `Codec<T>` with a
fully inferred `T`. Wire ops: `encodeFull`, `encodeDelta`, `decodeFull`, `applyDelta`.
Low-level buffers: `ByteWriter`, `ByteReader`.

## Links & license

[tikron.dev](https://tikron.dev) ·
[AGENTS.md](https://github.com/ONOFFERDEV/tikron-platform/blob/main/AGENTS.md).
Licensed **FSL-1.1-ALv2** — converts to **Apache-2.0** two years after each release.
See LICENSE.
