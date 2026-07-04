# @tikron/protocol

The wire protocol that [`@tikron/client`](https://www.npmjs.com/package/@tikron/client)
and [`@tikron/server`](https://www.npmjs.com/package/@tikron/server) speak — a versioned
message envelope (JSON control messages plus binary state frames). It's an **internal
building block**: if you use the client and server SDKs you never import it directly.

```bash
npm i @tikron/protocol
```

Reach for it only when you hand-roll a client, bridge Tikron over another transport, or
write protocol-level tooling:

```ts
import { encode, decodeServerMessage, ClientMessageType } from "@tikron/protocol";

const wire = encode({ t: ClientMessageType.Hello, name: "alice" }); // a control message
const msg = decodeServerMessage(rawFromSocket);                     // typed ServerMessage
// (encode/decode throw ProtocolError on a malformed or wrong-version message)
```

The envelope is versioned (`PROTOCOL_VERSION`), so client and server must run the same SDK
minor. Developer inputs are `c:msg`; a burst can be coalesced into one `c:mbatch` frame
(the client's `inputBatchMs` option), and a `c:msg` may carry a subtick `ts` (server-clock
input time) for lag-compensated hit registration. Older servers ignore `ts` and reject
`c:mbatch`, so a single input always ships as a plain `c:msg`.

## Key API

`PROTOCOL_VERSION` · `ClientMessageType` / `ServerMessageType` (tag enums, incl. `c:mbatch`) ·
the `ClientMessage` / `ServerMessage` interfaces · `encode` · `decodeClientMessage` /
`decodeServerMessage` · `ProtocolError`.

## Links & license

[tikron.dev](https://tikron.dev) ·
[AGENTS.md](https://github.com/ONOFFERDEV/tikron-platform/blob/main/AGENTS.md).
Licensed under the **Tikron License 1.0** (adapted from FSL-1.1) — converts to **Apache-2.0** one year after each release.
See LICENSE.
