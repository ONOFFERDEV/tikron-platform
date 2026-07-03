import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  parseManifest,
  resolveVisualSource,
  resolveFallbackPrimitive,
  type Manifest,
} from "../client/manifest.js";

describe("manifest schema validation (parseManifest)", () => {
  it("accepts a well-formed manifest with model and primitive entries", () => {
    const { manifest, errors } = parseManifest({
      "unit.warrior": { model: "models/warrior.glb", scale: 1, anims: { idle: "Idle", walk: "Walk" } },
      "unit.wolf": { primitive: "capsule", tint: "#8899aa", scale: 0.8 },
    });
    expect(errors).toEqual([]);
    expect(manifest["unit.warrior"]).toEqual({
      model: "models/warrior.glb",
      scale: 1,
      anims: { idle: "Idle", walk: "Walk" },
    });
    expect(manifest["unit.wolf"]).toEqual({ primitive: "capsule", tint: "#8899aa", scale: 0.8 });
  });

  it("skips metadata keys prefixed with _ (e.g. _readme) silently", () => {
    const { manifest, errors } = parseManifest({ _readme: "see ASSETS.md", fallback: { primitive: "capsule" } });
    expect(manifest["_readme"]).toBeUndefined();
    expect(manifest["fallback"]).toEqual({ primitive: "capsule" });
    expect(errors).toEqual([]);
  });

  it("rejects a non-object root without throwing", () => {
    const { manifest, errors } = parseManifest(["not", "an", "object"]);
    expect(manifest).toEqual({});
    expect(errors.length).toBeGreaterThan(0);
  });

  it("drops an entry with neither model nor primitive", () => {
    const { manifest, errors } = parseManifest({ "unit.x": { tint: "#ffffff" } });
    expect(manifest["unit.x"]).toBeUndefined();
    expect(errors.some((e) => e.includes("unit.x"))).toBe(true);
  });

  it("drops an entry with an unknown primitive kind", () => {
    const { manifest, errors } = parseManifest({ "prop.x": { primitive: "sphere" } });
    expect(manifest["prop.x"]).toBeUndefined();
    expect(errors).toHaveLength(1);
  });

  it("ignores a malformed tint but keeps the rest of the entry", () => {
    const { manifest, errors } = parseManifest({ "unit.x": { primitive: "capsule", tint: "blue" } });
    expect(manifest["unit.x"]).toEqual({ primitive: "capsule" });
    expect(errors.some((e) => e.includes("tint"))).toBe(true);
  });

  it("ignores a non-positive scale but keeps the rest of the entry", () => {
    const { manifest, errors } = parseManifest({ "unit.x": { primitive: "box", scale: -1 } });
    expect(manifest["unit.x"]).toEqual({ primitive: "box" });
    expect(errors.some((e) => e.includes("scale"))).toBe(true);
  });

  it("filters anims to known AnimState keys with string clip names", () => {
    const { manifest } = parseManifest({
      "unit.x": { model: "m.glb", anims: { idle: "Idle", jump: "Jump", attack: 5 } },
    });
    expect(manifest["unit.x"]?.anims).toEqual({ idle: "Idle" });
  });

  it("accepts animSource as a single string or an array of strings", () => {
    const { manifest, errors } = parseManifest({
      "unit.x": { model: "m.glb", animSource: "rig.glb" },
      "unit.y": { model: "m.glb", animSource: ["rig_a.glb", "rig_b.glb"] },
    });
    expect(errors).toEqual([]);
    expect(manifest["unit.x"]?.animSource).toBe("rig.glb");
    expect(manifest["unit.y"]?.animSource).toEqual(["rig_a.glb", "rig_b.glb"]);
  });

  it("ignores a malformed animSource but keeps the rest of the entry", () => {
    const { manifest, errors } = parseManifest({ "unit.x": { model: "m.glb", animSource: ["rig.glb", 5] } });
    expect(manifest["unit.x"]).toEqual({ model: "m.glb" });
    expect(errors.some((e) => e.includes("animSource"))).toBe(true);
  });
});

describe("visual source resolution (resolveVisualSource)", () => {
  const manifest: Manifest = {
    "unit.warrior": { model: "models/warrior.glb", scale: 1.2, anims: { idle: "Idle" } },
    "unit.wolf": { primitive: "capsule", tint: "#8a8f98", scale: 0.7 },
    fallback: { primitive: "capsule", tint: "#8899aa" },
  };

  it("resolves a model entry with defaults filled in", () => {
    expect(resolveVisualSource(manifest, "unit.warrior")).toEqual({
      kind: "model",
      path: "models/warrior.glb",
      scale: 1.2,
      anims: { idle: "Idle" },
      animSources: [],
      faceOffset: 0,
    });
  });

  it("normalizes animSource to an array, single string or list alike", () => {
    const m: Manifest = {
      "unit.a": { model: "a.glb", animSource: "rig.glb" },
      "unit.b": { model: "b.glb", animSource: ["rig_a.glb", "rig_b.glb"] },
    };
    expect(resolveVisualSource(m, "unit.a")).toMatchObject({ animSources: ["rig.glb"] });
    expect(resolveVisualSource(m, "unit.b")).toMatchObject({ animSources: ["rig_a.glb", "rig_b.glb"] });
  });

  it("resolves a primitive entry", () => {
    expect(resolveVisualSource(manifest, "unit.wolf")).toEqual({
      kind: "primitive",
      primitive: "capsule",
      tint: "#8a8f98",
      scale: 0.7,
      faceOffset: 0,
    });
  });

  it("falls back to the manifest's fallback entry for an unknown id", () => {
    expect(resolveVisualSource(manifest, "unit.nonexistent")).toEqual({
      kind: "primitive",
      primitive: "capsule",
      tint: "#8899aa",
      scale: 1,
      faceOffset: 0,
    });
  });

  it("falls back to a hardcoded capsule when even fallback is missing", () => {
    expect(resolveVisualSource({}, "unit.nonexistent")).toEqual({
      kind: "primitive",
      primitive: "capsule",
      tint: "#8899aa",
      scale: 1,
      faceOffset: 0,
    });
  });
});

describe("fallback-primitive coercion (resolveFallbackPrimitive)", () => {
  it("returns the manifest's fallback entry when it's already a primitive", () => {
    const manifest: Manifest = { fallback: { primitive: "box", tint: "#112233" } };
    expect(resolveFallbackPrimitive(manifest)).toEqual({
      kind: "primitive",
      primitive: "box",
      tint: "#112233",
      scale: 1,
      faceOffset: 0,
    });
  });

  it("coerces to the hardcoded default if fallback is itself a model entry", () => {
    const manifest: Manifest = { fallback: { model: "models/broken.glb" } };
    expect(resolveFallbackPrimitive(manifest)).toEqual({
      kind: "primitive",
      primitive: "capsule",
      tint: "#8899aa",
      scale: 1,
      faceOffset: 0,
    });
  });
});

describe("shipped manifest.json", () => {
  const path = fileURLToPath(new URL("../public/assets/manifest.json", import.meta.url));
  const raw: unknown = JSON.parse(readFileSync(path, "utf-8"));

  it("parses with zero validation errors", () => {
    const { errors } = parseManifest(raw);
    expect(errors).toEqual([]);
  });

  it("covers every tier-1 logical id required by PLAN-EMBERFALL.md §6.1/§6.3", () => {
    const { manifest } = parseManifest(raw);
    const required = [
      "unit.warrior",
      "unit.mage",
      "unit.cleric",
      "unit.wolf",
      "unit.goblin",
      "unit.goblin_thrower",
      "unit.boar",
      "unit.goblin_shaman",
      "unit.skeleton",
      "unit.wraith",
      "unit.golem",
      "unit.boss_chief",
      "unit.boss_lord",
      "npc.vendor",
      "prop.tree_a",
      "prop.rock_a",
      "prop.tent",
      "fallback",
    ];
    for (const id of required) expect(manifest[id], `missing "${id}"`).toBeDefined();
  });

  it("resolves hero/monster/skeleton units and real-model props to models, everything else to primitives", () => {
    const { manifest } = parseManifest(raw);
    const modelIds = new Set([
      "unit.warrior",
      "unit.mage",
      "unit.cleric",
      "unit.goblin",
      "unit.goblin_thrower",
      "unit.boar",
      "unit.goblin_shaman",
      "unit.skeleton",
      "unit.wraith",
      "unit.boss_chief",
      "npc.shopkeeper",
      "prop.tree_a",
      "prop.rock_a",
      "prop.house_a",
      "prop.house_b",
      "prop.well",
      "prop.fence",
      "prop.torch",
      "prop.training_dummy",
      "prop.dungeon_pillar",
      "prop.brazier",
      "prop.tree_b",
      "prop.rock_b",
      "prop.goblin_tent",
    ]);
    for (const id of Object.keys(manifest)) {
      expect(resolveVisualSource(manifest, id).kind).toBe(modelIds.has(id) ? "model" : "primitive");
    }
  });

  it("every model entry with animSource points at existing merged clip names", () => {
    const { manifest } = parseManifest(raw);
    for (const [id, entry] of Object.entries(manifest)) {
      if (!entry.model || !entry.animSource) continue;
      const source = resolveVisualSource(manifest, id);
      expect(source.kind, id).toBe("model");
      if (source.kind !== "model") continue;
      expect(source.animSources.length, id).toBeGreaterThan(0);
    }
  });
});
