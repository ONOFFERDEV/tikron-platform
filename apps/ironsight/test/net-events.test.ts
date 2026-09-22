import { describe, expect, it } from "vitest";
import { readAmmoEvent, readMatchEndEvent, readRespawnId, readVoteEvent } from "../client/net.js";

describe("client network event boundaries", () => {
  it("accepts bounded authoritative ammo and rejects malformed values", () => {
    expect(readAmmoEvent({ mag: 4, reserve: 20, weapon: 2, reloadMs: 450 })).toEqual({
      mag: 4,
      reserve: 20,
      weapon: 2,
      reloadMs: 450,
    });
    expect(readAmmoEvent({ mag: -1, reserve: 20, weapon: 2 })).toBeNull();
    expect(readAmmoEvent({ mag: 4, reserve: 20, weapon: 99 })).toBeNull();
    expect(readAmmoEvent({ mag: 4, reserve: 20, weapon: 2, reloadMs: Number.NaN })).toBeNull();
  });

  it("accepts complete match results and rejects partial or non-finite results", () => {
    const result = {
      winner: "red",
      red: 50,
      blue: 42,
      intermissionEndMs: 12_000,
      mvp: { id: "player-1", team: 0, kills: 12, assists: 3, captureSeconds: 8, score: 35 },
    };
    expect(readMatchEndEvent(result)).toEqual(result);
    expect(readMatchEndEvent({ winner: "red", red: 50 })).toBeNull();
    expect(readMatchEndEvent({ winner: "red", red: 50, blue: Number.POSITIVE_INFINITY })).toBeNull();
    expect(readMatchEndEvent({ ...result, mvp: { ...result.mvp, score: -1 } })).toBeNull();
  });

  it("bounds respawn and vote payloads before callbacks observe them", () => {
    expect(readRespawnId({ id: "player-1" })).toBe("player-1");
    expect(readRespawnId({ id: "" })).toBeNull();
    expect(readVoteEvent({ count: 2, need: 3 })).toEqual({ count: 2, need: 3 });
    expect(readVoteEvent({ count: 4, need: 3 })).toBeNull();
    expect(readVoteEvent({ count: 0, need: 0 })).toBeNull();
  });
});
