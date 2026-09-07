import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { sanitizeNodeName, findBoneByName } from "../client/units.js";

/**
 * Regression for the M2 weapon-not-showing bug (units.ts gear socketing).
 *
 * three.js `GLTFLoader` runs every node/bone name through
 * `PropertyBinding.sanitizeNodeName`, which strips the reserved chars `[ ] . : /`.
 * The KayKit Adventurers rig authors its hand sockets as `handslot.r` / `handslot.l`,
 * so the *loaded* scene graph exposes them as `handslotr` / `handslotl` — a raw
 * `getObjectByName("handslot.r")` misses, and the weapon silently falls back to an
 * unsocketed root-space prop. `findBoneByName` mirrors the sanitize so the lookup by
 * authored name still resolves. These tests pin all three links of that chain.
 */

/** Reads the `nodes[]` array straight out of a GLB's JSON chunk (no GLTFLoader / DOM). */
function glbNodeNames(path: string): string[] {
  const buf = readFileSync(path);
  const jsonLen = buf.readUInt32LE(12); // header is 12 bytes; chunk0 = JSON
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  return (json.nodes ?? []).map((n: { name?: string }) => n.name).filter(Boolean);
}

const modelsDir = fileURLToPath(new URL("../public/assets/models/", import.meta.url));

describe("sanitizeNodeName (mirrors three.js PropertyBinding.sanitizeNodeName)", () => {
  it("strips the dot from the authored KayKit hand sockets", () => {
    expect(sanitizeNodeName("handslot.r")).toBe("handslotr");
    expect(sanitizeNodeName("handslot.l")).toBe("handslotl");
  });

  it("strips every reserved char and turns whitespace into underscores", () => {
    expect(sanitizeNodeName("a[b].c:d/e")).toBe("abcde");
    expect(sanitizeNodeName("hand slot")).toBe("hand_slot");
  });

  it("leaves an already-clean name untouched", () => {
    expect(sanitizeNodeName("Knight_ArmRight")).toBe("Knight_ArmRight");
  });
});

describe("findBoneByName (sanitize-tolerant bone lookup)", () => {
  it("finds a GLTFLoader-sanitized bone by its authored (dotted) name", () => {
    // Simulates the post-load scene graph: the bone's `.name` is the sanitized form.
    const root = new THREE.Group();
    const handR = new THREE.Object3D();
    handR.name = "handslotr";
    root.add(handR);

    expect(findBoneByName(root, "handslot.r")).toBe(handR); // authored name still resolves
    expect(root.getObjectByName("handslot.r")).toBeUndefined(); // raw lookup would have missed
  });

  it("finds a verbatim-named bone (procedural / non-glTF source)", () => {
    const root = new THREE.Group();
    const bone = new THREE.Object3D();
    bone.name = "handslot.r";
    root.add(bone);
    expect(findBoneByName(root, "handslot.r")).toBe(bone);
  });

  it("returns undefined when neither the raw nor the sanitized name exists", () => {
    expect(findBoneByName(new THREE.Group(), "handslot.r")).toBeUndefined();
  });
});

describe("rig asset invariant (the socket the lookup depends on)", () => {
  it("Knight.glb still authors both hand sockets as `handslot.r` / `handslot.l`", () => {
    const names = glbNodeNames(`${modelsDir}Knight.glb`);
    expect(names).toContain("handslot.r");
    expect(names).toContain("handslot.l");
  });

  it("the shared KayKit rig authors the same sockets (drives clip binding)", () => {
    const names = glbNodeNames(`${modelsDir}kaykit_adv_rig_general.glb`);
    expect(names).toContain("handslot.r");
    expect(names).toContain("handslot.l");
  });
});
