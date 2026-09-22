import { decodeFull, encodeFull } from "@tikron/schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { migrateArenaState } from "../src/arena-state-migration.js";
import { HIT_ANIMATION_NONE, decodeHitAnimationClip, encodeHitAnimationClip, type HitStateBucketPolicy } from "../src/hit-state-bucket.js";
import { ArenaRoomImpl } from "../src/rooms/arena-room.js";
import { ArenaSchema, type ArenaPlayer, type ArenaState } from "../src/schema.js";
import { createTestRoom } from "./create-test-room.js";

const policy: HitStateBucketPolicy = {
  idleMax: 0.5,
  walkMax: 7,
  crouchSpeed: 3,
  hasCrouchClips: true,
  hasSprintClip: true,
  weaponFamilies: ["rifle", "smg", "shotgun", "sniper", "pistol"],
};

class InactiveRoom extends ArenaRoomImpl {
  protected override fillToPlayers = 0;
  protected override startInWarmup = false;
}

class AuthorityRoom extends InactiveRoom {
  protected override hitAnimationPolicy = policy;
  protected override spawnProtectMs = 0;

  restartAnimation(id: string, now: number): void {
    const player = this.state.players[id];
    if (player) this.updateHitAnimation(player, now, 0, 0, 0.05, true);
  }

  transitionAnimation(id: string, now: number, weapon: number): void {
    const player = this.state.players[id];
    if (!player) return;
    player.weapon = weapon;
    this.updateHitAnimation(player, now, 0.1, 0, 0.05, false);
  }

  restoreNow(): void {
    this.onRestore();
  }
}

class AuthorityHitRoom extends AuthorityRoom {
  protected override hitAuthorityPolicy = {
    evaluator: () => ({
      hitVolume: { headCenter: { x: 0, y: 1.5, z: 0 }, bodyTopY: 1.2 },
      headRadius: 0.08,
      groundOffsetY: 0,
      bodyRadiusUpperBound: 0.4,
    }),
    identity: () => ({ faction: "khaki" as const, glbSha256: "test-glb",
      hitComponentSha256: "test-hit", normalizationTransformSha256: "test-normalization" }),
  };
}

class LegacyCombatRoom extends InactiveRoom {
  protected override spawnProtectMs = 0;
}

function legacyState(player: Omit<ArenaPlayer, "hitClipIndex" | "hitClipStartedAt" | "hitBlendSources" | "hitReactionKind" | "hitReactionStartedAt" | "hitReactionSeq" | "hitSegmentSeq" | "hitSegmentStartedAt">): unknown {
  return {
    players: { alice: player }, seed: 1, redScore: 0, blueScore: 0, phase: "live",
    matchEndMs: 10_000, warmupEndMs: 0, signalAt: 0, coreOpen: false,
    mode: 0, capA: 100, capB: 100, capC: 100,
  };
}

describe("inactive hit animation authority integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T00:00:00Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("keeps ordinary room players on the legacy sentinel across join and reconnect", async () => {
    const room = await createTestRoom(InactiveRoom, { codec: ArenaSchema, sync: "throttled" });
    const first = await room.connect("alice");
    expect(room.snapshot().players.alice).toMatchObject({ hitClipIndex: HIT_ANIMATION_NONE, hitClipStartedAt: 0 });
    const closing = first.close();
    await Promise.resolve();
    await room.connect("alice");
    await closing;
    expect(room.snapshot().players.alice).toMatchObject({ hitClipIndex: HIT_ANIMATION_NONE, hitClipStartedAt: 0 });
  });

  it("replicates one epoch, holds it for the same bucket, and restarts on respawn", async () => {
    const room = await createTestRoom(AuthorityRoom, { codec: ArenaSchema, sync: "throttled" });
    await room.connect("alice");
    const joined = room.snapshot().players.alice!;
    expect(decodeHitAnimationClip(joined.hitClipIndex)).toBe("rifle_idle");
    const initialEpoch = joined.hitClipStartedAt;
    await room.advance(50);
    expect(room.snapshot().players.alice?.hitClipStartedAt).toBe(initialEpoch);
    const restartAt = initialEpoch + 500;
    (room.room as AuthorityRoom).restartAnimation("alice", restartAt);
    expect(room.snapshot().players.alice?.hitClipStartedAt).toBe(restartAt);
  });

  it("retains absolute outgoing epochs across rapid authoritative weapon buckets", async () => {
    const room = await createTestRoom(AuthorityRoom, { codec: ArenaSchema, sync: "throttled" });
    await room.connect("alice");
    const initial = room.snapshot().players.alice!;
    const firstAt = initial.hitClipStartedAt + 50;
    (room.room as AuthorityRoom).transitionAnimation("alice", firstAt, 1);
    const first = room.snapshot().players.alice!;
    expect(first.hitBlendSources).toEqual([{
      clipIndex: initial.hitClipIndex,
      phaseStartedAt: initial.hitClipStartedAt,
      fadeOutStartedAt: firstAt,
    }]);
    (room.room as AuthorityRoom).transitionAnimation("alice", firstAt + 49, 2);
    const second = room.snapshot().players.alice!;
    expect(second.hitBlendSources.map(source => source.fadeOutStartedAt)).toEqual([firstAt, firstAt + 49]);
  });

  it("round-trips the appended fields through the production codec", async () => {
    const room = await createTestRoom(AuthorityRoom, { codec: ArenaSchema, sync: "throttled" });
    await room.connect("alice");
    const state = room.snapshot();
    const player = state.players.alice!;
    player.hitBlendSources = [{
      clipIndex: encodeHitAnimationClip("smg_walk"),
      phaseStartedAt: player.hitClipStartedAt - 100,
      fadeOutStartedAt: player.hitClipStartedAt,
    }];
    player.hitReactionKind = 2;
    player.hitReactionStartedAt = player.hitClipStartedAt + 10;
    player.hitReactionSeq = 65_535;
    player.hitSegmentSeq = 65_535;
    player.hitSegmentStartedAt = player.hitClipStartedAt - 20;
    const decoded = decodeFull(ArenaSchema, encodeFull(ArenaSchema, state));
    expect(decoded.players.alice).toMatchObject({
      hitClipIndex: player.hitClipIndex,
      hitClipStartedAt: player.hitClipStartedAt,
      hitBlendSources: player.hitBlendSources,
      hitReactionKind: 2,
      hitReactionStartedAt: player.hitReactionStartedAt,
      hitReactionSeq: 65_535,
      hitSegmentSeq: 65_535,
      hitSegmentStartedAt: player.hitSegmentStartedAt,
    });
  });

  it("migrates complete v15, v16 and v17 players without mutating old snapshots", () => {
    const player = {
      x: 1, y: 0, z: 2, yaw: 0, pitch: 0, hp: 100, team: 0, alive: true,
      crouch: false, prot: false, k: 2, d: 1, weapon: 3, nades: 1, reloadEnd: 500,
    };
    const old = legacyState(player);
    const migrated = migrateArenaState(15, old);
    expect(migrated?.players.alice).toMatchObject({ ...player, hitClipIndex: HIT_ANIMATION_NONE, hitClipStartedAt: 0 });
    expect((old as { players: { alice: Record<string, unknown> } }).players.alice.hitClipIndex).toBeUndefined();
    expect(migrateArenaState(14, old)).toBeNull();
    expect(migrateArenaState(17, old)).toBeNull();
    expect(migrateArenaState(15, { players: { alice: null } })).toBeNull();
    expect(migrateArenaState(15, { ...old as object, players: { attackerControlled: {} } })).toBeNull();
    for (const key of Object.keys(player)) {
      const incomplete = { ...player } as Record<string, unknown>;
      delete incomplete[key];
      expect(migrateArenaState(15, legacyState(incomplete as typeof player))).toBeNull();
    }
    for (const [key, value] of [["x", Number.NaN], ["hp", 256], ["alive", 1], ["weapon", -1], ["reloadEnd", "now"]] as const) {
      expect(migrateArenaState(15, legacyState({ ...player, [key]: value } as typeof player))).toBeNull();
    }
    expect(migrateArenaState(15, legacyState({ ...player, reloadEnd: Infinity }))).toBeNull();
    expect(migrateArenaState(15, { ...old as object, matchEndMs: Infinity })).toBeNull();
    expect(migrateArenaState(15, { ...old as object, mode: 3, matchEndMs: Infinity })?.matchEndMs).toBe(Infinity);
    for (const [key, value] of [["matchEndMs", -Infinity], ["warmupEndMs", Infinity], ["signalAt", Infinity]] as const) {
      expect(migrateArenaState(15, { ...old as object, [key]: value })).toBeNull();
    }
    for (const key of ["seed", "redScore", "blueScore", "phase", "matchEndMs", "warmupEndMs",
      "signalAt", "coreOpen", "mode", "capA", "capB", "capC"] as const) {
      const incomplete = { ...old as Record<string, unknown> };
      delete incomplete[key];
      expect(migrateArenaState(15, incomplete)).toBeNull();
    }
    const v16Player = { ...player, hitClipIndex: encodeHitAnimationClip("sniper_walk"), hitClipStartedAt: 7_500 };
    const v16 = { ...old as Record<string, unknown>, players: { alice: v16Player } };
    expect(migrateArenaState(16, v16)?.players.alice).toMatchObject({
      ...v16Player, hitBlendSources: [], hitReactionKind: 0, hitReactionStartedAt: 0, hitReactionSeq: 0,
      hitSegmentSeq: 0, hitSegmentStartedAt: 0,
    });
    expect(migrateArenaState(16, { ...v16, players: { alice: { ...v16Player, hitClipStartedAt: Number.NaN } } })).toBeNull();
    expect(migrateArenaState(16, { ...v16, players: { alice: { ...v16Player, hitClipIndex: 30 } } })).toBeNull();
    expect(migrateArenaState(16, { ...v16, players: { alice: {
      ...v16Player, hitClipIndex: HIT_ANIMATION_NONE, hitClipStartedAt: 1,
    } } })).toBeNull();
    const v17Player = { ...v16Player, hitBlendSources: [{
      clipIndex: encodeHitAnimationClip("rifle_idle"), phaseStartedAt: 7_000, fadeOutStartedAt: 7_500,
    }], hitReactionKind: 2, hitReactionStartedAt: 7_520, hitReactionSeq: 4 };
    const v17 = { ...old as Record<string, unknown>, players: { alice: v17Player } };
    expect(migrateArenaState(17, v17)?.players.alice).toMatchObject({
      ...v17Player, hitSegmentSeq: 0, hitSegmentStartedAt: 0,
    });
    expect(migrateArenaState(17, { ...v17, players: { alice: {
      ...v17Player, hitBlendSources: [{ ...v17Player.hitBlendSources[0], clipIndex: 30 }],
    } } })).toBeNull();
  });

  it("replicates accepted firearm reaction time and sequence for reconnect and AOI state", async () => {
    const room = await createTestRoom(AuthorityRoom, { id: "hit-reaction-tdm", codec: ArenaSchema, sync: "throttled" });
    const shooter = await room.connect("shooter");
    const target = await room.connect("target");
    const state = (room.room as unknown as { state: ArenaState }).state;
    Object.assign(state.players.shooter!, {
      x: 10, y: 0, z: 11, yaw: Math.PI / 2, pitch: Math.atan2(1.3 - 1.65, 10), alive: true, prot: false,
    });
    Object.assign(state.players.target!, { x: 20, y: 0, z: 11, hp: 100, alive: true, prot: false });
    await room.advance(150);
    const beforeSeq = room.snapshot().players.target!.hitReactionSeq;
    await shooter.send("fire", { claim: { id: target.id, part: "body" } });
    await room.advance(50);
    const shot = shooter.frames().filter(frame => frame.t === "s:msg" && frame.type === "shot").at(-1);
    const acceptedAt = (shot?.payload as { acceptedAt?: number } | undefined)?.acceptedAt;
    expect(acceptedAt).toEqual(expect.any(Number));
    const expected = {
      hitReactionKind: 1,
      hitReactionStartedAt: acceptedAt,
      hitReactionSeq: (beforeSeq + 1) & 0xffff,
    };
    expect(room.snapshot().players.target).toMatchObject(expected);
    const closing = target.close();
    await Promise.resolve();
    await room.connect("target");
    await closing;
    expect(room.snapshot().players.target).toMatchObject(expected);
    await room.connect("late-observer");
    expect(room.snapshot().players.target).toMatchObject(expected);
  });

  it("uses the rewound calibrated head radius instead of the legacy global sphere", async () => {
    const run = async (Room: typeof AuthorityHitRoom | typeof LegacyCombatRoom): Promise<number> => {
      const room = await createTestRoom(Room, { id: `head-radius-${Room.name}`, codec: ArenaSchema,
        sync: "throttled" });
      const shooter = await room.connect("shooter");
      await room.connect("target");
      const state = (room.room as unknown as { state: ArenaState }).state;
      Object.assign(state.players.shooter!, { x: 10, y: 0, z: 11, yaw: Math.PI / 2,
        pitch: Math.atan2(1.6 - 1.65, 10), alive: true, prot: false });
      Object.assign(state.players.target!, { x: 20, y: 0, z: 11, hp: 100, alive: true, prot: false });
      await room.advance(150);
      await shooter.send("fire", {});
      await room.advance(50);
      return room.snapshot().players.target!.hp;
    };
    expect(await run(LegacyCombatRoom)).toBeLessThan(100);
    expect(await run(AuthorityHitRoom)).toBe(100);
  });

  it("restarts the authoritative epoch when restore respawns retained seats", async () => {
    const room = await createTestRoom(AuthorityRoom, { codec: ArenaSchema, sync: "throttled" });
    await room.connect("alice");
    const before = room.snapshot().players.alice!.hitClipStartedAt;
    const beforeSegment = room.snapshot().players.alice!.hitSegmentSeq;
    vi.setSystemTime(new Date("2026-09-13T00:00:01Z"));
    (room.room as AuthorityRoom).restoreNow();
    const restored = room.snapshot() as ArenaState;
    expect(restored.players.alice?.hitClipStartedAt).toBeGreaterThan(before);
    expect(restored.players.alice?.hitSegmentSeq).toBe((beforeSegment + 1) & 0xffff);
    expect(restored.players.alice?.hitSegmentStartedAt).toBeGreaterThan(before);
    expect(decodeHitAnimationClip(restored.players.alice?.hitClipIndex ?? HIT_ANIMATION_NONE)).toBe("rifle_idle");
  });
});


