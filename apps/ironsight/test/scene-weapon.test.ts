import * as T from "three";
import { describe, expect, it } from "vitest";
import { viewmodelWeaponPresentation } from "../client/scene-weapon.js";

const node = (name: string, ...children: T.Object3D[]) => {
  const group = new T.Group(); group.name = name; group.add(...children); return group;
};
const contract = () => node("automatic_rifle",
  ...["grip_r", "grip_l", "muzzle", "eject", "sight_rear", "sight_front", "magazine", "bolt", "magwell", "chamber"].map(n => node(n)));

describe("first-person weapon acceptance", () => {
  it("loads legacy nodes without a presentation, but refuses a WW1 candidate without the contract", () => {
    const legacy = node("wep_ar", node("rifle-magazine"));
    expect(viewmodelWeaponPresentation(legacy, "automatic_rifle", false)).toBeNull();
    expect(viewmodelWeaponPresentation(legacy, "automatic_rifle", true)).toBeUndefined();
    const partial = node("wrapper", node("automatic_rifle", node("muzzle")));
    expect(viewmodelWeaponPresentation(partial, "automatic_rifle", true)).toBeUndefined();
  });

  it("keeps the contract presentation when the sockets resolve", () => {
    for (const candidate of [false, true])
      expect(viewmodelWeaponPresentation(node("wrapper", contract()), "automatic_rifle", candidate)?.sockets).not.toBeNull();
  });
});
