import { describe, expect, it } from "vitest";
import { sampleRemoteSnapshot, type RemotePose, type RemoteSnapshot } from "../client/remote-snapshot.js";
import { encodeHitAnimationClip, HIT_ANIMATION_NONE } from "../src/hit-state-bucket.js";

function pose(overrides: Partial<RemotePose> = {}): RemotePose {
  return {
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, crouch: false, team: 0,
    alive: true, weapon: 0, reloadEnd: 0, hitClipIndex: HIT_ANIMATION_NONE,
    hitClipStartedAt: 0, hitBlendSources: [], hitReactionKind: 0,
    hitReactionStartedAt: 0, hitReactionSeq: 0,
    hitSegmentSeq: 0, hitSegmentStartedAt: 0, ...overrides,
  };
}

function snap(receiptTime: number, serverTime: number | null, player: RemotePose): RemoteSnapshot {
  return { receiptTime, serverTime, players: new Map([["remote", player]]) };
}

describe("remote snapshot animation clock", () => {
  it("samples server time with the same receipt fraction as position", () => {
    const result = sampleRemoteSnapshot([
      snap(10, 1_000, pose({ x: 10 })),
      snap(30, 1_200, pose({ x: 30 })),
    ], 15, new Map());
    expect(result.sampledServerTime).toBe(1_050);
    expect(result.poses.get("remote")?.x).toBe(15);
  });

  it("holds crouch, weapon and clip on the earlier state until the shared epoch", () => {
    const before = pose({ x: 10, weapon: 0, hitClipIndex: encodeHitAnimationClip("rifle_walk"), hitClipStartedAt: 900 });
    const source = { clipIndex: before.hitClipIndex, phaseStartedAt: 900, fadeOutStartedAt: 1_120 };
    const after = pose({ x: 30, crouch: true, weapon: 2, hitBlendSources: [source],
      hitClipIndex: encodeHitAnimationClip("shotgun_crouch_idle"), hitClipStartedAt: 1_120 });
    const snapshots = [snap(10, 1_000, before), snap(30, 1_200, after)];
    const early = sampleRemoteSnapshot(snapshots, 20, new Map());
    expect(early.sampledServerTime).toBe(1_100);
    expect(early.poses.get("remote")).toMatchObject({ x: 20, crouch: false, weapon: 0,
      hitClipIndex: before.hitClipIndex, hitClipStartedAt: before.hitClipStartedAt });
    expect(early.poses.get("remote")?.hitBlendSources).toEqual([]);
    const boundary = sampleRemoteSnapshot(snapshots, 22, new Map());
    expect(boundary.sampledServerTime).toBe(1_120);
    expect(boundary.poses.get("remote")).toMatchObject({ x: 22, crouch: true, weapon: 2,
      hitClipIndex: after.hitClipIndex, hitClipStartedAt: after.hitClipStartedAt });
    expect(boundary.poses.get("remote")?.hitBlendSources).toEqual([source]);
  });

  it("selects reaction sequence at its own authoritative epoch", () => {
    const before = pose({ hitReactionKind: 1, hitReactionStartedAt: 1_000, hitReactionSeq: 4 });
    const after = pose({ hitReactionKind: 2, hitReactionStartedAt: 1_150, hitReactionSeq: 5 });
    const snapshots = [snap(10, 1_000, before), snap(30, 1_200, after)];
    expect(sampleRemoteSnapshot(snapshots, 20, new Map()).poses.get("remote")).toMatchObject({
      hitReactionKind: 1, hitReactionStartedAt: 1_000, hitReactionSeq: 4,
    });
    expect(sampleRemoteSnapshot(snapshots, 25, new Map()).poses.get("remote")).toMatchObject({
      hitReactionKind: 2, hitReactionStartedAt: 1_150, hitReactionSeq: 5,
    });
  });

  it("holds the living timeline until the authoritative death clear boundary", () => {
    const before = pose({ alive: true, hitClipIndex: encodeHitAnimationClip("rifle_walk"),
      hitClipStartedAt: 900, hitReactionSeq: 4 });
    const after = pose({ alive: false, hitClipIndex: HIT_ANIMATION_NONE, hitClipStartedAt: 0,
      hitReactionKind: 0, hitReactionStartedAt: 1_150, hitReactionSeq: 5 });
    const snapshots = [snap(10, 1_000, before), snap(30, 1_200, after)];
    expect(sampleRemoteSnapshot(snapshots, 20, new Map()).poses.get("remote")).toMatchObject({
      alive: true, hitClipIndex: before.hitClipIndex,
    });
    expect(sampleRemoteSnapshot(snapshots, 25, new Map()).poses.get("remote")).toMatchObject({
      alive: false, hitClipIndex: HIT_ANIMATION_NONE,
    });
  });

  it("preserves latest-snapshot discrete behaviour for inactive legacy sentinels", () => {
    const result = sampleRemoteSnapshot([
      snap(10, 1_000, pose({ weapon: 0 })),
      snap(30, 1_200, pose({ weapon: 4, crouch: true })),
    ], 15, new Map());
    expect(result.poses.get("remote")).toMatchObject({ weapon: 4, crouch: true,
      hitClipIndex: HIT_ANIMATION_NONE });
  });

  it("does not invent an authority clock when either snapshot lacks a server stamp", () => {
    const result = sampleRemoteSnapshot([
      snap(10, null, pose({ weapon: 0 })),
      snap(30, 1_200, pose({ weapon: 3, hitClipIndex: encodeHitAnimationClip("sniper_walk"), hitClipStartedAt: 1_100 })),
    ], 20, new Map());
    expect(result.sampledServerTime).toBeNull();
    expect(result.poses.get("remote")?.weapon).toBe(3);
  });

  it("adds and removes AOI players without carrying a stale pose across samples", () => {
    const scratch = new Map<string, RemotePose>([["departed", pose({ x: 99 })]]);
    const entered = pose({ x: 12, hitClipIndex: encodeHitAnimationClip("rifle_idle"), hitClipStartedAt: 1_000 });
    const result = sampleRemoteSnapshot([
      { receiptTime: 10, serverTime: 1_000, players: new Map([["existing", pose({ x: 10 })]]) },
      { receiptTime: 30, serverTime: 1_200, players: new Map([["existing", pose({ x: 30 })], ["entered", entered]]) },
    ], 20, scratch);
    expect(result.poses.has("departed")).toBe(false);
    expect(result.poses.get("entered")).toEqual(entered);
  });

  it("snaps the root at an explicit authority segment boundary", () => {
    const before = pose({ x: 10, y: 1, z: 20, yaw: 0, hitSegmentSeq: 4,
      hitSegmentStartedAt: 900 });
    const after = pose({ x: 80, y: 5, z: 90, yaw: Math.PI, hitSegmentSeq: 5,
      hitSegmentStartedAt: 1_150 });
    const snapshots = [snap(10, 1_000, before), snap(30, 1_200, after)];
    expect(sampleRemoteSnapshot(snapshots, 20, new Map()).poses.get("remote")).toMatchObject({
      x: 10, y: 1, z: 20, yaw: 0, hitSegmentSeq: 4,
    });
    expect(sampleRemoteSnapshot(snapshots, 25, new Map()).poses.get("remote")).toMatchObject({
      x: 80, y: 5, z: 90, yaw: Math.PI, hitSegmentSeq: 5,
    });
  });

  it("does not interpolate a malformed reused segment sequence across a new boundary", () => {
    const snapshots = [
      snap(10, 1_000, pose({ x: 10, hitSegmentSeq: 4, hitSegmentStartedAt: 900 })),
      snap(30, 1_200, pose({ x: 80, hitSegmentSeq: 4, hitSegmentStartedAt: 1_150 })),
    ];
    expect(sampleRemoteSnapshot(snapshots, 20, new Map()).poses.get("remote")?.x).toBe(10);
    expect(sampleRemoteSnapshot(snapshots, 25, new Map()).poses.get("remote")?.x).toBe(80);
  });
});
