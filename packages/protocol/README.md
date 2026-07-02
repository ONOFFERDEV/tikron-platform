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

## Key API

`PROTOCOL_VERSION` · `ClientMessageType` / `ServerMessageType` (tag enums) · the
`ClientMessage` / `ServerMessage` interfaces · `encode` · `decodeClientMessage` /
`decodeServerMessage` · `ProtocolError`.

## Links & license

[tikron.dev](https://tikron.dev) ·
[AGENTS.md](https://github.com/ONOFFERDEV/tikron-platform/blob/main/AGENTS.md).
Licensed **FSL-1.1-ALv2** — converts to **Apache-2.0** two years after each release.
See LICENSE.
