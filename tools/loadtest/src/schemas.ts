import { schema, mapOf, quant, type Codec } from "@tikron/schema";

/**
 * Local re-declarations of the room state schemas the harness needs to decode.
 *
 * These mirror `apps/gateway/src/rooms/agar-schema.ts` and the `MovementSchema`
 * in `apps/gateway/src/rooms/movement-room.ts`. They are re-declared here (rather
 * than imported from the gateway app) so the tool depends only on the published
 * `@tikron/schema` codec package and not on Durable Object source. The field
 * order and primitive types MUST stay in lock-step with the server codecs — the
 * binary layout is positional and a mismatch silently corrupts decoded state.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface AgarPlayer {
  x: number;
  y: number;
  score: number;
}

export interface AgarState {
  players: Record<string, AgarPlayer>;
  orbs: Record<string, Vec2>;
}

export const AgarSchema: Codec<AgarState> = schema({
  players: mapOf(schema({ x: "f32", y: "f32", score: "u32" })),
  orbs: mapOf(schema({ x: "f32", y: "f32" })),
});

export const AGAR = {
  world: 2000,
  viewRadius: 500,
  maxSpeed: 600,
  stepMs: 50,
} as const;

export interface MovementState {
  players: Record<string, Vec2>;
}

export const MovementSchema: Codec<MovementState> = schema({
  players: mapOf(schema({ x: "f32", y: "f32" })),
});

export const MOVEMENT = {
  // movement-room uses a small world with an origin spawn; keep a soft bound so
  // the random walk stays in a plausible region.
  world: 1000,
  maxSpeed: 200,
  stepMs: 50,
} as const;

/**
 * Mirror of `apps/gateway/src/rooms/shooter-schema.ts` (the FPS demo). The field
 * order and quantization MUST match the server codec — the wire layout is
 * positional, so any drift silently corrupts decoded state. `ShooterPlayer`
 * carries `x`/`y` first so it is assignable to `Vec2` for the shared own-player
 * reconciliation path.
 */
export interface ShooterPlayer {
  x: number;
  y: number;
  aim: number;
  hp: number;
  score: number;
  alive: boolean;
}

export interface ShooterState {
  players: Record<string, ShooterPlayer>;
}

export const ShooterSchema: Codec<ShooterState> = schema({
  players: mapOf(
    schema({
      x: quant(0, 2000, 0.1),
      y: quant(0, 2000, 0.1),
      aim: quant(0, Math.PI * 2, 0.001),
      hp: "u8",
      score: "u32",
      alive: "bool",
    }),
  ),
});

export const SHOOTER = {
  world: 2000,
  viewRadius: 600,
  maxSpeed: 500,
  stepMs: 50,
} as const;
