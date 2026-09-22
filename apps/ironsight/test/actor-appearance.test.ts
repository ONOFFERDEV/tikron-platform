import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ActorAppearance, actorColor } from '../client/actor-appearance.js';
import { SettingsStore } from '../client/settings.js';

describe('operator contrast', () => {
  it('renders one bounded remote soldier LOD', () => {
    const root = new THREE.Group();
    for (const name of ['LOD0', 'LOD1', 'LOD2']) {
      const lod = new THREE.Group(); lod.name = name; root.add(lod);
    }
    new ActorAppearance(root, 0xffffff);
    expect(root.getObjectByName('LOD0')!.visible).toBe(true);
    expect(root.getObjectByName('LOD1')!.visible).toBe(false);
    expect(root.getObjectByName('LOD2')!.visible).toBe(false);
  });

  it('classifies both teams, unknown viewers and teamless opponents without changing allies', () => {
    for (const team of [0, 1]) {
      expect(actorColor(0x123456, team, team, false, 'yellow')).toBe(0x123456);
      expect(actorColor(0x123456, team, 1 - team, false, 'yellow')).toBe(0xffdf55);
      expect(actorColor(0x123456, team, undefined, false, 'violet')).toBe(0x123456);
      expect(actorColor(0x123456, team, team, true, 'violet')).toBe(0xd995ff);
      expect(actorColor(0x123456, team, 1 - team, false, 'team')).toBe(0x123456);
    }
  });

  it('isolates operators while retaining the texture, skinning geometry and shared materials', () => {
    const source = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    const geometry = new THREE.BoxGeometry();
    const first = new THREE.Group();
    first.add(new THREE.Mesh(geometry, source), new THREE.Mesh(geometry, source));
    const second = first.clone();
    const a = new ActorAppearance(first, 0xff4444), b = new ActorAppearance(second, 0x4444ff);
    expect(a.materials).toHaveLength(1);
    expect(a.materials[0]!.map).toBe(source.map);
    expect((first.children[0] as THREE.Mesh).geometry).toBe(geometry);
    const m = a.materials[0]!, version = m.version, key = m.customProgramCacheKey();
    const shader = { uniforms: {}, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    m.onBeforeCompile(shader as unknown as Parameters<typeof m.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance += actorRimColor');
    expect(shader.fragmentShader).toContain('actorEdge * actorEdge');
    a.setColor(0xffdf55);
    expect((shader.uniforms as Record<string, { value: THREE.Color }>).actorRimColor!.value.getHex()).toBe(0xffdf55);
    expect(b.materials[0]!.color.getHex()).toBe(0x4444ff);
    expect(source.color.getHex()).toBe(0xffffff);
    expect(m.version).toBe(version);
    expect(m.customProgramCacheKey()).toBe(key);
    expect(m.depthTest && m.depthWrite && !m.transparent).toBe(true);
  });

  it('separates shader variants when one shared source material spans body and field-kit geometry', () => {
    const source = new THREE.MeshStandardMaterial({ color: 0x736b54, roughness: .91 });
    const bodyGeometry = new THREE.BoxGeometry();
    const kitGeometry = new THREE.BoxGeometry();
    kitGeometry.setAttribute('fieldKit', new THREE.Float32BufferAttribute(
      new Float32Array(kitGeometry.getAttribute('position').count * 4), 4,
    ));
    const root = new THREE.Group();
    root.add(new THREE.Mesh(bodyGeometry, source), new THREE.Mesh(kitGeometry, source));
    const appearance = new ActorAppearance(root, 0x8c805d);
    expect(appearance.materials).toHaveLength(2);
    expect(appearance.materials[0]).not.toBe(appearance.materials[1]);
    expect(new Set(appearance.materials.map(material => material.customProgramCacheKey())))
      .toEqual(new Set(['ironsight-actor-rim-v1', 'ironsight-field-kit-rim-v2']));
    expect(source.color.getHex()).toBe(0x736b54);
    expect(source.roughness).toBe(.91);
  });

  it('migrates old saves, rejects invalid colours, persists and resets the choice', () => {
    let saved = JSON.stringify({ sensitivity: 1.5 });
    const storage = { getItem: () => saved, setItem: (_: string, value: string) => { saved = value; } };
    const settings = new SettingsStore(storage);
    expect(settings.get().enemyHighlight).toBe('team');
    settings.setEnemyHighlight('yellow');
    expect(new SettingsStore(storage).get().enemyHighlight).toBe('yellow');
    settings.setEnemyHighlight('violet');
    expect(new SettingsStore(storage).get().enemyHighlight).toBe('violet');
    settings.setEnemyHighlight('invalid');
    expect(settings.get().enemyHighlight).toBe('team');
    expect(settings.get().sensitivity).toBe(1.5);
    settings.setEnemyHighlight('yellow'); settings.resetAll();
    expect(settings.get().enemyHighlight).toBe('team');
  });
});
