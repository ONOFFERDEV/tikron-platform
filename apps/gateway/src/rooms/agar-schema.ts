import { schema, mapOf, type Codec } from "@playedge/schema";

/**
 * Shared schema + constants for the flagship .io demo. Kept free of any server
 * imports so the browser client can import it without pulling in Durable Object
 * code.
 */
export interface AgarPlayer {
  x: number;
  y: number;
  score: number;
}
export interface AgarOrb {
  x: number;
  y: number;
}
export interface AgarState {
  players: Record<string, AgarPlayer>;
  orbs: Record<string, AgarOrb>;
}

export const AgarSchema: Codec<AgarState> = schema({
  players: mapOf(schema({ x: "f32", y: "f32", score: "u32" })),
  orbs: mapOf(schema({ x: "f32", y: "f32" })),
});

export const AGAR = {
  world: 2000,
  viewRadius: 500,
  orbCount: 40,
  collectRadius: 50,
  maxSpeed: 600,
  stepMs: 50,
} as const;
