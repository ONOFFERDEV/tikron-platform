import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AnimationMixer, Group, Quaternion, Vector3 } from "three";
import { AuthoredViewmodelHands } from "../client/viewmodel-hands.js";
import { WeaponPresentation } from "../client/weapon-presentation.js";

const assetPath = resolve("public/assets/ww1/characters/fp-arms.glb");
const metadataPath = resolve("public/assets/ww1/characters/fp-arms.meta.json");
const bytes = readFileSync(assetPath), jsonLength = bytes.readUInt32LE(12);
const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8").trim());
const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
const CONTACTS = {
  automatic_rifle: { grip_l: [0, .02, .37], parts: ["magazine", "bolt", "magwell", "chamber"] },
  trench_smg: { grip_l: [0, .035, .32], parts: ["magazine", "bolt", "magwell", "chamber"] },
  pump_shotgun: { grip_l: [0, .015, .35], parts: ["pump", "shell", "chamber"] },
  bolt_service_rifle: { grip_l: [0, .015, .44], parts: ["bolt", "clip", "chamber", "clip_mount"] },
  service_pistol: { grip_l: [0, .045, .028], parts: ["slide", "magazine", "magwell", "chamber"] },
};

const contactModel = (key, contract) => {
  const root = new Group(); root.name = key;
  const names = ["grip_r", "grip_l", "muzzle", "eject", "sight_rear", "sight_front", ...contract.parts];
  for (const name of names) { const node = new Group(); node.name = name; root.add(node); }
  root.getObjectByName("grip_l").position.fromArray(contract.grip_l);
  root.getObjectByName("muzzle").position.z = 1;
  root.getObjectByName("sight_rear").position.z = .2;
  root.getObjectByName("sight_front").position.z = .8;
  return root;
};

describe("authored first-person arms asset", () => {
  it("binds exact bytes to original-authored metadata", () => {
    expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
    expect(bytes.readUInt32LE(4)).toBe(2);
    expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    expect(metadata.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(metadata.source).toEqual({ kind: "original-authored", generator: "tools/build-ww1-fp-arms.mjs", recipeVersion: 5 });
    expect(metadata).toMatchObject({ contactFit: "v3-surfaces", triggerDiscipline: true,
      reviewStatus: "runtime_contact_validation_pending" });
    expect(document.extras).toMatchObject({ contactFit: "v3-surfaces", triggerDiscipline: true });
  });

  it("contains weighted sleeves, palms, and finger chains within the 48-bone budget", () => {
    const skin = document.skins[0];
    expect(skin.name).toBe("ironsight-fp-arms");
    expect(skin.joints).toHaveLength(41);
    expect(skin.joints.length).toBeLessThanOrEqual(document.extras.boneBudget);
    expect(document.accessors[skin.inverseBindMatrices]).toMatchObject({ componentType: 5126, count: 41, type: "MAT4" });
    const names = new Set(document.nodes.map(node => node.name));
    for (const side of ["l", "r"]) for (const finger of ["thumb", "index", "middle", "ring", "little"]) {
      for (let segment = 1; segment <= 3; segment += 1) expect(names.has(`${finger}_${segment}_${side}`)).toBe(true);
    }
    for (const target of ["ik_hand_root", "ik_hand_gun", "ik_hand_l", "ik_hand_r"]) expect(names.has(target)).toBe(true);
  });

  it("uses indexed triangles with semantic skin, normal, and UV attributes on both surfaces", () => {
    const primitives = document.meshes[0].primitives;
    expect(primitives).toHaveLength(2);
    for (const primitive of primitives) {
      expect(primitive.attributes).toEqual(expect.objectContaining({ POSITION: expect.any(Number), NORMAL: expect.any(Number), TEXCOORD_0: expect.any(Number), JOINTS_0: expect.any(Number), WEIGHTS_0: expect.any(Number) }));
      expect(document.accessors[primitive.attributes.POSITION]).toMatchObject({ componentType: 5126, type: "VEC3" });
      expect(document.accessors[primitive.attributes.NORMAL]).toMatchObject({ componentType: 5126, type: "VEC3" });
      expect(document.accessors[primitive.attributes.TEXCOORD_0]).toMatchObject({ componentType: 5126, type: "VEC2" });
      expect(document.accessors[primitive.attributes.JOINTS_0]).toMatchObject({ componentType: 5123, type: "VEC4" });
      expect(document.accessors[primitive.attributes.WEIGHTS_0]).toMatchObject({ componentType: 5126, type: "VEC4" });
      expect(document.accessors[primitive.indices].count % 3).toBe(0);
      expect(document.accessors[primitive.indices].count).toBeGreaterThan(0);
    }
  });

  it("ships independent faction sleeve materials and all eight action clips", () => {
    expect(document.materials.map(material => material.name)).toEqual(["Glove_Leather", "Sleeve_Khaki", "Sleeve_Fieldgrey"]);
    expect(document.extensions.KHR_materials_variants.variants.map(variant => variant.name)).toEqual(["khaki", "fieldgrey"]);
    expect(document.animations.map(animation => animation.name)).toEqual(["equip", "ready", "ads_in", "ads_out", "fire", "sprint_in", "sprint_out", "reload"]);
    expect(document.animations.every(animation => animation.channels.length === 2)).toBe(true);
    expect(document.extras.coordinateSystem).toEqual({ units: "metres", up: "+Y", forward: "+Z" });
  });

  it("loads as a real skinned Three model and isolates faction material instances", async () => {
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const gltf = await new GLTFLoader().parseAsync(arrayBuffer, "");
    const khaki = AuthoredViewmodelHands.fromGltf(gltf), fieldgrey = AuthoredViewmodelHands.fromGltf(gltf);
    expect(khaki?.clips.map(clip => clip.name)).toEqual(["equip", "ready", "ads_in", "ads_out", "fire", "sprint_in", "sprint_out", "reload"]);
    expect(fieldgrey).not.toBeNull();
    const sleeveColors = hands => {
      const colors = [];
      hands.group.traverse(node => {
        if (!node.isMesh) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) if (material.name.startsWith("Sleeve_")) colors.push(material.color.getHex());
      });
      return colors;
    };
    const before = sleeveColors(khaki);
    fieldgrey.setFaction("fieldgrey");
    expect(sleeveColors(khaki)).toEqual(before);
    expect(sleeveColors(fieldgrey)).not.toEqual(before);
    expect(AuthoredViewmodelHands.fromGltf({ ...gltf, animations: gltf.animations.slice(1) })).toBeNull();
  });

  it("samples every exported clip into finite non-identity hand transforms", async () => {
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    for (const expectedName of ["equip", "ready", "ads_in", "ads_out", "fire", "sprint_in", "sprint_out", "reload"]) {
      const gltf = await new GLTFLoader().parseAsync(arrayBuffer, ""), hand = gltf.scene.getObjectByName("Hand_L");
      const clip = gltf.animations.find(candidate => candidate.name === expectedName), mixer = new AnimationMixer(gltf.scene);
      expect(hand).toBeDefined(); expect(clip).toBeDefined();
      mixer.clipAction(clip).play(); mixer.setTime(.16);
      expect(hand.quaternion.toArray().every(Number.isFinite)).toBe(true);
      expect(hand.quaternion.angleTo(new Quaternion())).toBeGreaterThan(.01);
    }
  });

  it("places both weighted hand chains on all five frozen grip socket pairs", async () => {
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    for (const [key, contract] of Object.entries(CONTACTS)) {
      const gltf = await new GLTFLoader().parseAsync(arrayBuffer, ""), hands = AuthoredViewmodelHands.fromGltf(gltf);
      const weaponRoot = contactModel(key, contract), presentation = new WeaponPresentation(key, weaponRoot);
      const frame = presentation.update(null, 0);
      expect(hands.apply(frame, presentation)).toBe(true);
      hands.group.updateWorldMatrix(true, true); weaponRoot.updateWorldMatrix(true, true);
      const expectedLeft = presentation.target("grip_l").getWorldPosition(new Vector3());
      const expectedRight = presentation.target("grip_r").getWorldPosition(new Vector3());
      expect(hands.group.getObjectByName("Hand_L").getWorldPosition(new Vector3()).distanceTo(expectedLeft)).toBeLessThan(.00001);
      expect(hands.group.getObjectByName("Hand_R").getWorldPosition(new Vector3()).distanceTo(expectedRight)).toBeLessThan(.00001);
      expect(hands.group.getObjectByName("Hand_L").getWorldQuaternion(new Quaternion()).angleTo(
        presentation.target("grip_l").getWorldQuaternion(new Quaternion()))).toBeLessThan(.0001);
      expect(hands.group.getObjectByName("Hand_R").getWorldQuaternion(new Quaternion()).angleTo(
        presentation.target("grip_r").getWorldQuaternion(new Quaternion()))).toBeLessThan(.0001);
    }
  });

  it("drives the authored reload clip from the authoritative action timeline", async () => {
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const gltf = await new GLTFLoader().parseAsync(arrayBuffer, ""), hands = AuthoredViewmodelHands.fromGltf(gltf);
    const weaponRoot = contactModel("bolt_service_rifle", CONTACTS.bolt_service_rifle);
    const presentation = new WeaponPresentation("bolt_service_rifle", weaponRoot);
    const state = { weaponIndex: 3, kind: "cycle", phase: "cycle", startedAt: 100,
      phaseStartedAt: 100, endsAt: 1100, serial: 1, committed: 0, fireBuffered: false };
    const before = hands.group.getObjectByName("Hand_R").quaternion.clone();
    expect(hands.apply(presentation.update(state, 350), presentation)).toBe(true);
    expect(hands.activeClip).toBe("reload");
    expect(hands.group.getObjectByName("Hand_R").quaternion.angleTo(before)).toBeGreaterThan(.01);
    hands.reset();
    expect(hands.activeClip).toBe("ready");
  });

  it("drives equip, ADS, fire, sprint, ready, and reload clips through the runtime mixer", async () => {
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const gltf = await new GLTFLoader().parseAsync(arrayBuffer, ""), hands = AuthoredViewmodelHands.fromGltf(gltf);
    const base = { actionActive: false, equipProgress: null, adsProgress: 0,
      adsHeld: false, recoil: 0, sprintBlend: 0 };
    for (const [clip, input] of [
      ["equip", { ...base, equipProgress: .5 }],
      ["fire", { ...base, recoil: .5 }],
      ["ads_in", { ...base, adsHeld: true, adsProgress: .5 }],
      ["ads_out", { ...base, adsProgress: .5 }],
      ["sprint_in", { ...base, sprintBlend: .7 }],
      ["sprint_out", { ...base, sprintBlend: .2 }],
      ["ready", base],
    ]) {
      hands.animateMotion(input);
      expect(hands.activeClip).toBe(clip);
    }
  });
});
