import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ActorAppearance } from "../client/actor-appearance.js";

function uniform(teamColor: number) {
  const geometry = new THREE.BoxGeometry();
  const count = geometry.getAttribute("position").count;
  geometry.setAttribute("fieldKit", new THREE.Float32BufferAttribute(new Float32Array(count * 4), 4));
  geometry.setAttribute("fieldPosition", new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  const source = new THREE.MeshStandardMaterial();
  const root = new THREE.Group();
  root.add(new THREE.Mesh(geometry, source));
  const appearance = new ActorAppearance(root, teamColor);
  const material = appearance.materials[0];
  if (material === undefined) throw new Error("uniform material missing");
  const uniforms: Record<string, { value: unknown }> = {};
  const shader = {
    uniforms,
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  };
  Reflect.apply(material.onBeforeCompile, material, [shader, undefined]);
  return { appearance, material, source, geometry, shader };
}

describe("active field uniform appearance", () => {
  it("separates warm khaki and cool field-grey cloth from identification color", () => {
    // Given
    const khaki = uniform(0xe8563a), fieldgrey = uniform(0x3a7ce8);
    // When
    const warm = khaki.shader.uniforms["fieldWoolColor"]?.value;
    const cool = fieldgrey.shader.uniforms["fieldWoolColor"]?.value;
    // Then
    expect(warm).toBeInstanceOf(THREE.Color);
    expect(cool).toBeInstanceOf(THREE.Color);
    if (!(warm instanceof THREE.Color) || !(cool instanceof THREE.Color)) throw new Error("wool uniform missing");
    expect(warm.r).toBeGreaterThan(warm.b);
    expect(cool.g).toBeGreaterThan(cool.r);
    expect(warm.equals(cool)).toBe(false);
    expect(khaki.material.color.getHex()).toBe(0xe8563a);
    expect(fieldgrey.material.color.getHex()).toBe(0x3a7ce8);
  });

  it("retains faction cloth and source resources when enemy highlights change", () => {
    // Given
    const actor = uniform(0xe8563a);
    const wool = actor.shader.uniforms["fieldWoolColor"]?.value;
    if (!(wool instanceof THREE.Color)) throw new Error("wool uniform missing");
    const original = wool.clone(), version = actor.material.version;
    const key = actor.material.customProgramCacheKey();
    // When
    for (const color of [0xffdf55, 0xd995ff, 0xe8563a]) actor.appearance.setColor(color);
    // Then
    expect(wool.equals(original)).toBe(true);
    expect(actor.material.version).toBe(version);
    expect(actor.material.customProgramCacheKey()).toBe(key);
    expect(actor.material.map).toBe(actor.source.map);
    expect(actor.material.depthTest && actor.material.depthWrite && !actor.material.transparent).toBe(true);
    expect(actor.source.color.getHex()).toBe(0xffffff);
  });
});
