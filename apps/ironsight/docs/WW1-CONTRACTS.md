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

`CONTENT_REVISION` is an integer application-content epoch. It changes when a
client and server can share the same binary state shape but cannot safely interpret
the same authored layouts or rules. `ArenaRoomImpl.stateVersion` remains `15`
because this work does not change `ArenaState` or `ArenaSchema`.

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

A version-15 room restore is a semantic content reset:

1. discard bot-only seats and all non-durable input, movement, grenade, support,
   reload, recoil, swap, cycle, hit, streak, vote, and round-result runtime data;
2. reset scores, objectives, gates, and signal state;
3. place every durable human seat at a current authored safe spawn with full
   health, a fresh loadout, and spawn protection;
4. enter `warmup` for competitive modes, or a fresh live practice round;
5. require every reconnecting client to complete the current revision handshake.

An old position or pending attack is never replayed into new map content. This
reset produces one new round transition; it does not resume or duplicate an ended
round. If a future change alters the persistent `ArenaState` shape or codec field
order, that change must bump `stateVersion`, implement `migrateState`, and ship a
binary codec plus persisted-snapshot migration fixture in the same change.

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
