import { describe, it, expect } from "vitest";
import { encodeFull, decodeFull } from "@tikron/schema";
// The load-test harness re-declares the room state schemas locally (so it depends
// only on @tikron/schema, not on Durable Object source). That mirror MUST stay in
// lock-step with the server codec — the binary layout is positional, so any field
// order / type drift silently corrupts decoded state. This guard has caught that
// class of drift twice before; it encodes with one codec and decodes with the
// other, both directions, and asserts an exact round-trip.
import { ShooterSchema as ServerShooterSchema } from "../src/rooms/shooter-schema.js";
import { ShooterSchema as MirrorShooterSchema } from "../../../tools/loadtest/src/schemas.js";

describe("load-test mirror codec stays in lock-step with the server codec", () => {
  it("server-encoded ShooterState decodes identically through the load-test mirror", () => {
    const state = {
      players: {
        a1b2: { x: 1234.5, y: 678.9, aim: 1.234, hp: 73, score: 9001, alive: true },
        c3d4: { x: 0, y: 2999, aim: 6.28, hp: 0, score: 0, alive: false },
      },
      seed: 0xdeadbeef,
    };

    const serverBytes = encodeFull(ServerShooterSchema, state);
    const mirrorBytes = encodeFull(MirrorShooterSchema, state);

    // Byte-for-byte identical encoding: field order and wire types match exactly.
    expect(Array.from(mirrorBytes)).toEqual(Array.from(serverBytes));

    // Cross-decode agrees (compare the two codecs' round-trips, since `quant`
    // decode applies the same tiny float rounding on both sides).
    const serverRoundTrip = decodeFull(ServerShooterSchema, serverBytes);
    expect(decodeFull(MirrorShooterSchema, serverBytes)).toEqual(serverRoundTrip);
    expect(decodeFull(ServerShooterSchema, mirrorBytes)).toEqual(serverRoundTrip);
  });
});
