import * as T from "three";
import { describe, expect, it } from "vitest";
import type { WeaponKey } from "../src/weapon-contract.js";
import type { WeaponActionState } from "../src/weapon-action.js";
import { resolveWeaponContractRoot, WeaponPresentation } from "../client/weapon-presentation.js";

const INDEX: Readonly<Record<WeaponKey, number>> = {
  automatic_rifle: 0, trench_smg: 1, pump_shotgun: 2,
  bolt_service_rifle: 3, service_pistol: 4,
};

const PARTS: Readonly<Record<WeaponKey, readonly string[]>> = {
  automatic_rifle: ["magazine", "bolt", "magwell", "chamber"],
  trench_smg: ["magazine", "bolt", "magwell", "chamber"],
  pump_shotgun: ["pump", "shell", "chamber"],
  bolt_service_rifle: ["bolt", "clip", "chamber", "clip_mount"],
  service_pistol: ["slide", "magazine", "magwell", "chamber"],
};

const model = (key: WeaponKey): T.Group => {
  const root = new T.Group(); root.name = key;
  for (const name of ["grip_r", "grip_l", "muzzle", "eject", "sight_rear", "sight_front", ...PARTS[key]]) {
    const node = new T.Group(); node.name = name; node.position.set(0.01, 0.02, 0.03); root.add(node);
  }
  return root;
};

const action = (key: WeaponKey, kind: WeaponActionState["kind"], phase: WeaponActionState["phase"]): WeaponActionState => ({
  weaponIndex: INDEX[key], kind, phase, startedAt: 100, phaseStartedAt: 100,
  endsAt: 1100, serial: 7, committed: 0, fireBuffered: false,
});

describe("authoritative WW1 weapon presentation", () => {
  it.each([
    ["automatic_rifle", "magazine_reload", "reload", "magazine", "grip_r"],
    ["trench_smg", "magazine_reload", "reload", "magazine", "grip_r"],
    ["pump_shotgun", "pump_reload", "reload_insert", "shell", "grip_r"],
    ["bolt_service_rifle", "bolt_reload", "reload", "clip", "grip_r"],
    ["service_pistol", "magazine_reload", "reload", "magazine", "grip_r"],
  ] as const)("routes %s contacts from the authoritative phase", (key, kind, phase, left, right) => {
    const presentation = new WeaponPresentation(key, model(key));
    const frame = presentation.update(action(key, kind, phase), 600);
    expect(frame).toMatchObject({ mode: "contract", active: true, leftHandTarget: left, rightHandTarget: right });
    expect(frame.authoritativeEndsAt).toBe(1100);
  });

  it("drives pump, shell, clip and magazine visibility without changing action input", () => {
    const pumpState = action("pump_shotgun", "pump_reload", "reload_insert");
    const frozen = structuredClone(pumpState);
    const shotgun = new WeaponPresentation("pump_shotgun", model("pump_shotgun"));
    expect(shotgun.update(pumpState, 600).partVisibility.shell).toBe(true);
    expect(pumpState).toEqual(frozen);

    const rifle = new WeaponPresentation("bolt_service_rifle", model("bolt_service_rifle"));
    expect(rifle.update(action("bolt_service_rifle", "bolt_reload", "reload"), 600).partVisibility.clip).toBe(true);
    const automatic = new WeaponPresentation("automatic_rifle", model("automatic_rifle"));
    expect(automatic.update(action("automatic_rifle", "magazine_reload", "reload"), 430).partVisibility.magazine).toBe(true);
  });

  it("moves every secondary feed part through its authoritative contact path", () => {
    for (const [key, kind, phase, part] of [
      ["automatic_rifle", "magazine_reload", "reload", "magazine"],
      ["trench_smg", "magazine_reload", "reload", "magazine"],
      ["pump_shotgun", "pump_reload", "reload_insert", "shell"],
      ["bolt_service_rifle", "bolt_reload", "reload", "clip"],
      ["service_pistol", "magazine_reload", "reload", "magazine"],
    ] as const) {
      const root = model(key), moving = root.getObjectByName(part)!;
      const baseline = moving.position.clone();
      const presentation = new WeaponPresentation(key, root);
      presentation.update(action(key, kind, phase), 500);
      expect(moving.position.distanceTo(baseline), `${key}:${part}`).toBeGreaterThan(0.005);
      presentation.update(null, 500);
      expect(moving.position.distanceTo(baseline), `${key}:${part}:reset`).toBeLessThan(1e-10);
    }
  });

  it("rotates the bolt in place before translating it and locks it after return", () => {
    const root = model("bolt_service_rifle"), bolt = root.getObjectByName("bolt")!;
    const presentation = new WeaponPresentation("bolt_service_rifle", root);
    presentation.update(action("bolt_service_rifle", "cycle", "cycle"), 200);
    expect(bolt.quaternion.angleTo(new T.Quaternion())).toBeGreaterThan(0.15);
    expect(bolt.position.z).toBeCloseTo(0.03, 5);
    presentation.update(action("bolt_service_rifle", "cycle", "cycle"), 400);
    expect(bolt.position.z).toBeLessThan(0);
    presentation.update(action("bolt_service_rifle", "cycle", "cycle"), 1000);
    expect(bolt.position.distanceTo(new T.Vector3(0.01, 0.02, 0.03))).toBeLessThan(0.01);
    expect(bolt.quaternion.angleTo(new T.Quaternion())).toBeGreaterThan(0.1);
    presentation.update(action("bolt_service_rifle", "cycle", "cycle"), 1040);
    expect(bolt.quaternion.angleTo(new T.Quaternion())).toBeLessThan(0.01);
  });

  it("keeps the support hand on the fore-end throughout a right-hand bolt cycle", () => {
    const presentation = new WeaponPresentation("bolt_service_rifle", model("bolt_service_rifle"));
    for (const now of [200, 400, 750, 1000]) {
      expect(presentation.update(action("bolt_service_rifle", "cycle", "cycle"), now).leftHandTarget).toBe("grip_l");
    }
  });

  it("does not derive presentation authority from committed ammo or buffered fire fields", () => {
    const presentation = new WeaponPresentation("pump_shotgun", model("pump_shotgun"));
    const state = action("pump_shotgun", "pump_reload", "reload_insert");
    const altered = { ...state, committed: 5, fireBuffered: true };
    expect(presentation.update(altered, 600)).toEqual(presentation.update(state, 600));
    expect(presentation.update(state, 1099).active).toBe(true);
    expect(presentation.update(state, 1100)).toMatchObject({ active: false, phase: "idle" });
  });

  it("rejects an older late echo after a newer action or cancellation", () => {
    const presentation = new WeaponPresentation("bolt_service_rifle", model("bolt_service_rifle"));
    const newer = { ...action("bolt_service_rifle", "cycle", "cycle"), serial: 9 };
    const older = { ...newer, serial: 8 };
    expect(presentation.update(newer, 300).active).toBe(true);
    expect(presentation.update(older, 300)).toMatchObject({ active: false, phase: "idle" });
    expect(presentation.update(newer, 300).active).toBe(true);
    expect(presentation.update(null, 300).active).toBe(false);
    expect(presentation.update(newer, 300)).toMatchObject({ active: false, phase: "idle" });
  });

  it("resets every cosmetic transform on expiry, switch, death, cancellation, and reconnect clear", () => {
    const root = model("pump_shotgun");
    const pump = root.getObjectByName("pump")!;
    const baseline = pump.position.clone();
    const presentation = new WeaponPresentation("pump_shotgun", root);
    expect(presentation.update(action("pump_shotgun", "cycle", "cycle"), 600).active).toBe(true);
    expect(pump.position.equals(baseline)).toBe(false);
    for (const clear of [null, action("automatic_rifle", "magazine_reload", "reload")]) {
      expect(presentation.update(clear, 600).active).toBe(false);
      expect(pump.position.equals(baseline)).toBe(true);
    }
    presentation.update(action("pump_shotgun", "cycle", "cycle"), 600);
    expect(presentation.update(action("pump_shotgun", "cycle", "cycle"), 1100).active).toBe(false);
    presentation.reset();
    expect(pump.position.equals(baseline)).toBe(true);
  });

  it("fails closed to fallback for wrong roots, missing or duplicate nodes, and non-finite time", () => {
    const wrongRoot = model("service_pistol"); wrongRoot.name = "wrong";
    expect(new WeaponPresentation("service_pistol", wrongRoot).update(null, 0).mode).toBe("fallback");
    const missing = model("service_pistol"); missing.remove(missing.getObjectByName("eject")!);
    expect(new WeaponPresentation("service_pistol", missing).update(null, 0).mode).toBe("fallback");
    const duplicate = model("service_pistol"); const extra = new T.Group(); extra.name = "grip_r"; duplicate.add(extra);
    expect(new WeaponPresentation("service_pistol", duplicate).update(null, 0).mode).toBe("fallback");
    const valid = new WeaponPresentation("service_pistol", model("service_pistol"));
    expect(valid.update(action("service_pistol", "magazine_reload", "reload"), Number.NaN)).toMatchObject({ mode: "contract", active: false });
  });

  it("rejects loaded wrappers with zero or duplicate canonical weapon roots", () => {
    const empty = new T.Group();
    expect(resolveWeaponContractRoot(empty, "trench_smg")).toBeNull();
    const unique = new T.Group(); const first = model("trench_smg"); unique.add(first);
    expect(resolveWeaponContractRoot(unique, "trench_smg")).toBe(first);
    const second = model("trench_smg"); unique.add(second);
    expect(resolveWeaponContractRoot(unique, "trench_smg")).toBeNull();
  });

  it("exposes contracted socket nodes and never infers muzzle or sights from geometry", () => {
    const root = model("automatic_rifle");
    const presentation = new WeaponPresentation("automatic_rifle", root);
    expect(presentation.sockets?.muzzle).toBe(root.getObjectByName("muzzle"));
    expect(presentation.sockets?.eject).toBe(root.getObjectByName("eject"));
    expect(presentation.sockets?.sightRear).toBe(root.getObjectByName("sight_rear"));
    expect(presentation.sockets?.sightFront).toBe(root.getObjectByName("sight_front"));
  });
});
