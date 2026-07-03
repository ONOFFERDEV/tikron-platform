import { describe, expect, it } from "vitest";
import { indexContent, validateContent, type ContentPack } from "./content.js";
import { sampleContent } from "./sample-content.js";

describe("validateContent", () => {
  it("accepts the sample pack", () => {
    expect(() => validateContent(sampleContent)).not.toThrow();
  });

  it("throws on a dangling buff reference", () => {
    const pack: ContentPack = {
      skills: [{ id: "s", school: "spell", targetType: "hostile", effects: [{ effect: { kind: "buff", buffId: "ghost" } }] }],
      buffs: [],
      npcs: [],
    };
    expect(() => validateContent(pack)).toThrow(/ghost/);
  });

  it("throws on a dangling subSkill reference", () => {
    const pack: ContentPack = {
      skills: [{ id: "s", school: "none", targetType: "self", effects: [{ effect: { kind: "subSkill", skillId: "nope" } }] }],
      buffs: [],
      npcs: [],
    };
    expect(() => validateContent(pack)).toThrow(/nope/);
  });

  it("throws on a dangling npc weapon reference", () => {
    const pack: ContentPack = {
      skills: [],
      buffs: [],
      npcs: [{ id: "n", level: 1, faction: "m", weapon: "missing" }],
    };
    expect(() => validateContent(pack)).toThrow(/missing/);
  });

  it("throws on a dangling npc skill reference", () => {
    const pack: ContentPack = {
      skills: [],
      buffs: [],
      npcs: [{ id: "n", level: 1, faction: "m", skills: [{ skillId: "gone" }] }],
    };
    expect(() => validateContent(pack)).toThrow(/gone/);
  });

  it("throws on a dangling tolerance immunity buff", () => {
    const pack: ContentPack = {
      skills: [],
      buffs: [{ id: "b", kind: "bad", tolerance: { tag: "t", windowMs: 1, steps: [], immunityBuffId: "poof" } }],
      npcs: [],
    };
    expect(() => validateContent(pack)).toThrow(/poof/);
  });
});

describe("indexContent", () => {
  it("builds resolvable lookup maps", () => {
    const idx = indexContent(sampleContent);
    expect(idx.skills.get("warrior-slash")?.id).toBe("warrior-slash");
    expect(idx.buffs.get("stun")?.cc?.stun).toBe(true);
    expect(idx.npcs.get("boss")?.level).toBe(10);
    expect(idx.weapons.get("sword")?.dps).toBe(20);
  });

  it("records explicit hostile faction pairs order-insensitively", () => {
    const idx = indexContent({ skills: [], buffs: [], npcs: [], factions: { hostile: [["a", "b"]] } });
    expect(idx.hostilePairs.has("a b")).toBe(true);
  });
});
