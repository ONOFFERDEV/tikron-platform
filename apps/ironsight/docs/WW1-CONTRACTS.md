# Ironsight WW1 runtime contracts

This document fixes the compatibility boundary for the WW1 revision. It is the
shared contract for room, client, combat, maps, UI, audio, and QA work.

## Stable content IDs

These values are append-only. Existing entries cannot move or change meaning.

| Content | Stable ID | Current meaning |
| --- | ---: | --- |
| map | `arena1` | Relay |
| map | `arena2` | Undertow |
| map | `arena3` | Switchyard |
| mode | `0` | `tdm` |
| mode | `1` | `ffa` |
| mode | `2` | `dom` |
| mode | `3` | `practice` |
| weapon | `0` / slot `1` | `automatic_rifle` |
| weapon | `1` / slot `2` | `trench_smg` |
| weapon | `2` / slot `3` | `pump_shotgun` |
| weapon | `3` / slot `4` | `bolt_service_rifle` |
| weapon | `4` / slot `5` | `service_pistol` |

`config/ww1-content.ts` is the runtime source for the content revision and stable
ID table. `MODE_ORDER`, the weapon array, map routing, and the binary schema must
remain equivalent to it. The five weapon tuning records and all map geometry are
owned by their later work items and are unchanged by this revision contract.

## Revision handshake

`CONTENT_REVISION` is an integer application-content epoch, currently `4`. It
identifies authored layouts and rules separately from the persisted state version
and binary codec shape. A content change can require a new revision even when the
binary shape is unchanged; it does not replace schema compatibility checks.

`ArenaRoomImpl.stateVersion` is currently `18`. `ArenaState` and `ArenaSchema`
include the following player fields after `reloadEnd`, in codec order:

| State version introduced | Appended player fields and wire types |
| --- | --- |
| `16` | `hitClipIndex: u8`, `hitClipStartedAt: f64` |
| `17` | `hitBlendSources: listOf({ clipIndex: u8, phaseStartedAt: f64, fadeOutStartedAt: f64 })`, `hitReactionKind: u8`, `hitReactionStartedAt: f64`, `hitReactionSeq: u16` |
| `18` | `hitSegmentSeq: u16`, `hitSegmentStartedAt: f64` |

The version-18 fields identify geometry-segment boundaries shared by rendering
interpolation and rewound hit volumes. The room, browser client, and bots must use
the same `ArenaSchema` field order and types. Appending fields does not make an
older binary codec compatible, and persisted-state migration does not translate
live network frames for older clients.

The worker returns `contentRevision` from `/api/matchmake`. A client whose compiled
revision differs stops before opening a room and displays reload guidance. After a
room is joined, the room sends `contentRevision { revision }`. The client registers
its reply listeners first and then sends `contentReady { revision }`. The room
answers with one of these typed events:

```ts
type ContentAccepted = { readonly revision: number };
type ContentMismatch = {
  readonly expected: number;
  readonly received: number | null;
  readonly action: "reload";
};
```

Every external gameplay message, including `syncView`, is ignored until the room
accepts the exact revision. A missing or malformed revision is reported as
`received: null`. A reconnect repeats the handshake before input becomes ready.
Internal bot decisions call authoritative room behavior directly and do not pass
through this external-client gate.

## Restore and layout transition

`src/arena-state-migration.ts` validates complete snapshots from versions `15`,
`16`, and `17` and constructs the current version-18 state without mutating the
source snapshot:

| Snapshot version | Migration to the current player shape |
| --- | --- |
| `15` | Initialize the clip to `HIT_ANIMATION_NONE` with a zero start time; initialize blend sources to `[]`, reaction fields to `0`, and segment fields to `0`. |
| `16` | Preserve the validated clip index and start time; initialize blend sources to `[]`, reaction fields to `0`, and segment fields to `0`. |
| `17` | Preserve validated clip, blend-source, and reaction fields; initialize `hitSegmentSeq` and `hitSegmentStartedAt` to `0`. |

Unsupported source versions or malformed snapshots return `null` from the
migration function. This is a snapshot-shape conversion, not a promise to resume
old combat state. A current-version restore, or a restore after a supported
migration, runs `ArenaRoomImpl.onRestore()` as a semantic content reset:

1. discard bot-only seats and all non-durable input, movement, grenade, support,
   reload, recoil, swap, cycle, hit, streak, vote, and round-result runtime data;
2. reset scores, objectives, gates, and signal state;
3. place every durable human seat at a current authored safe spawn with full
   health, a fresh loadout, and spawn protection;
4. enter `warmup` for competitive modes, or a fresh live practice round;
5. require every reconnecting client to complete the current revision handshake.

When the hit-animation policy is active, respawning retained seats restarts the
authoritative hit-animation timeline and advances the geometry segment with a
fresh server timestamp. Migration's zero defaults are not a replay of the old
pose or attack.

An old position or pending attack is never replayed into new map content. This
reset produces one new round transition; it does not resume or duplicate an ended
round. If a future change alters the persistent `ArenaState` shape or codec field
order, that change must bump `stateVersion`, implement `migrateState`, and ship a
binary codec plus persisted-snapshot migration fixture in the same change.

`test/hit-animation-integration.test.ts` covers current-codec round trips,
version-15/16/17 snapshot migration, invalid snapshot rejection, and restored hit
epochs/segments. `test/content-revision.test.ts` covers the revision gate and the
safe-spawn restore reset; `test/arena-lifecycle.test.ts` exercises current-version
persisted cold restores. These tests do not establish mixed-codec compatibility.

## Shared combat and presentation contracts

- Weapon action authority is represented by `WeaponActionState`, with numeric
  weapon index, action kind, server start/end deadlines, and action serial.
- `shotId` combines the existing fire sequence with connection/life scope. Server
  receipts decide accepted or blocked; presentation markers never grant authority.
- Map surface/material identifiers are data shared by collision, FX, audio, and UI.
- Readiness and failure signals are structured events. UI does not infer authority
  by matching display text.
- Telemetry records ordered readiness stages: navigation, decode, compile, UI ready,
  input ready. Unsupported or missing stages cannot be reported as a pass.
- `reloadEnd` remains in the current codec for compatibility. New action events and
  `syncView` extensions must preserve old consumers until their owning task lands.

The baseline remains browser-based 6v6 play across three maps, five weapons, and
all four modes (`tdm`, `ffa`, `dom`, `practice`).
