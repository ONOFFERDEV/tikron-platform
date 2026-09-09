import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ActorAppearance, actorColor } from '../client/actor-appearance.js';
import { SettingsStore } from '../client/settings.js';

describe('operator contrast', () => {
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
