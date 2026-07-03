import { describe, it, expect } from "vitest";
import {
  createCharacter,
  loadCharacter,
  saveCharacter,
  normalizeNickname,
  claimSession,
  loadCharacterBySession,
  releaseSession,
  saveCharacterForSession,
} from "../src/persist.js";
import { createFakeD1 } from "./fake-d1.js";

describe("persist — normalizeNickname", () => {
  it("accepts 3-16 char names with letters/digits/Korean/underscore/space, casefolded", () => {
    expect(normalizeNickname("Hero")).toBe("hero");
    expect(normalizeNickname("불꽃기사")).toBe("불꽃기사");
    expect(normalizeNickname("  Iron Man  ")).toBe("iron man"); // trimmed + collapsed
    expect(normalizeNickname("a_b")).toBe("a_b");
  });

  it("rejects too short, too long, and disallowed characters", () => {
    expect(normalizeNickname("ab")).toBeNull(); // < 3
    expect(normalizeNickname("a".repeat(17))).toBeNull(); // > 16
    expect(normalizeNickname("hero!")).toBeNull(); // disallowed punctuation
    expect(normalizeNickname("<script>")).toBeNull();
  });
});

describe("persist — create/load/save round trip", () => {
  it("creates a level-1 character with the class's starting defaults", async () => {
    const { db } = createFakeD1();
    const result = await createCharacter(db, { nickname: "Ember Knight", class: "warrior" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.token).toBeTruthy();
    expect(result.character.nickname).toBe("Ember Knight");
    expect(result.character.class).toBe("warrior");
    expect(result.character.level).toBe(1);
    expect(result.character.xp).toBe(0);
    expect(result.character.zone).toBe("emberhold");
    expect(result.character.inventory).toEqual([]);
    expect(result.character.equipment).toEqual({});
  });

  it("rejects an invalid nickname (400) and an invalid class (400) without touching D1", async () => {
    const { db } = createFakeD1();
    expect((await createCharacter(db, { nickname: "ab", class: "warrior" })).ok).toBe(false);
    const badNick = await createCharacter(db, { nickname: "ab", class: "warrior" });
    if (!badNick.ok) expect(badNick.error).toBe("invalid_nickname");

    const badClass = await createCharacter(db, { nickname: "Valid Name", class: "necromancer" });
    expect(badClass.ok).toBe(false);
    if (!badClass.ok) expect(badClass.error).toBe("invalid_class");
  });

  it("rejects a nickname that normalizes to an existing one (409-shaped result)", async () => {
    const { db } = createFakeD1();
    const first = await createCharacter(db, { nickname: "Hero", class: "warrior" });
    expect(first.ok).toBe(true);

    const dup = await createCharacter(db, { nickname: "  hero  ", class: "mage" });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toBe("nickname_taken");
  });

  it("loads a created character by its token, and returns null for an unknown token", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Loadable", class: "cleric" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const loaded = await loadCharacter(db, created.token);
    expect(loaded).toEqual(created.character);

    expect(await loadCharacter(db, "not-a-real-token")).toBeNull();
  });

  it("saveCharacter overwrites mutable fields and loadCharacter reflects them", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Saveable", class: "mage" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = {
      ...created.character,
      level: 5,
      xp: 1200,
      gold: 300,
      zone: "ashen-fields" as const,
      x: 77,
      y: 22,
      hp: 150,
      mp: 60,
      playMs: 45_000,
      updatedAt: created.character.updatedAt + 1000,
    };
    const ok = await saveCharacter(db, created.token, updated);
    expect(ok).toBe(true);

    const reloaded = await loadCharacter(db, created.token);
    expect(reloaded).toEqual(updated);
    // Identity fields are untouched by a save.
    expect(reloaded!.id).toBe(created.character.id);
    expect(reloaded!.nickname).toBe(created.character.nickname);
    expect(reloaded!.class).toBe(created.character.class);
  });

  it("saveCharacter against an unknown token is a no-op returning false", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Someone", class: "warrior" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const ok = await saveCharacter(db, "bogus-token", created.character);
    expect(ok).toBe(false);
  });
});

describe("persist — claimSession / loadCharacterBySession / releaseSession (PLAN-EMBERFALL-M2-SECFIX FIX-1/FIX-2 session binding)", () => {
  it("claims an unclaimed character for a session, and loadCharacterBySession then resolves it", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Claimant", class: "warrior" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const claim = await claimSession(db, created.token, "session-a", Date.now());
    expect(claim.ok).toBe(true);
    expect(await loadCharacterBySession(db, "session-a")).toEqual(created.character);
  });

  it("rejects a second concurrent session claiming the same still-live token (FIX-2 clone guard)", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Contested", class: "mage" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const now = Date.now();
    expect((await claimSession(db, created.token, "session-a", now)).ok).toBe(true);
    const second = await claimSession(db, created.token, "session-b", now + 1000);
    expect(second.ok).toBe(false); // session-a still owns it and its heartbeat is fresh
    expect(await loadCharacterBySession(db, "session-b")).toBeNull();
    expect(await loadCharacterBySession(db, "session-a")).not.toBeNull(); // unaffected
  });

  it("allows the SAME session to reclaim its own row (idempotent reconnect/zone-transfer)", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Reclaimer", class: "cleric" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const now = Date.now();
    await claimSession(db, created.token, "session-a", now);
    expect((await claimSession(db, created.token, "session-a", now + 5000)).ok).toBe(true);
  });

  it("lets a fresh connect steal a claim once the owning session's heartbeat goes stale (crash recovery)", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Crashed", class: "warrior" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const now = Date.now();
    await claimSession(db, created.token, "session-a", now);
    const staleClaim = await claimSession(db, created.token, "session-b", now + 91_000); // past the 90s TTL
    expect(staleClaim.ok).toBe(true);
    expect(await loadCharacterBySession(db, "session-b")).not.toBeNull();
  });

  it("releaseSession clears the claim so a fresh connect no longer needs the TTL", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Released", class: "mage" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const now = Date.now();
    await claimSession(db, created.token, "session-a", now);
    await releaseSession(db, "session-a");
    expect(await loadCharacterBySession(db, "session-a")).toBeNull();

    const reclaim = await claimSession(db, created.token, "session-b", now + 1000); // immediately, no TTL wait
    expect(reclaim.ok).toBe(true);
  });
});

describe("persist — saveCharacterForSession (FIX-2 optimistic concurrency)", () => {
  it("writes while the session still owns the claim, and refreshes the heartbeat", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Saver", class: "warrior" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await claimSession(db, created.token, "session-a", Date.now());
    const updated = { ...created.character, gold: 999, updatedAt: created.character.updatedAt + 1000 };
    const ok = await saveCharacterForSession(db, "session-a", updated);
    expect(ok).toBe(true);
    expect((await loadCharacterBySession(db, "session-a"))!.gold).toBe(999);
  });

  it("skips the write for a session that lost the ownership race (stale writer never clobbers the new owner)", async () => {
    const { db } = createFakeD1();
    const created = await createCharacter(db, { nickname: "Superseded", class: "mage" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const now = Date.now();
    await claimSession(db, created.token, "session-a", now);
    // session-a's room dies without releasing; a fresh connect steals the claim once stale.
    await claimSession(db, created.token, "session-b", now + 91_000);

    // session-a's zombie save arrives late — must not clobber session-b's row.
    const staleWrite = { ...created.character, gold: 1, updatedAt: now + 92_000 };
    const ok = await saveCharacterForSession(db, "session-a", staleWrite);
    expect(ok).toBe(false);
    expect((await loadCharacterBySession(db, "session-b"))!.gold).toBe(created.character.gold);
  });
});
