import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createLensDirt } from '../client/scene-lens-dirt.js';

describe('lens dirt after nearby blasts', () => {
  it('shows lens dirt only while blast trauma settles, as one untextured clip-space quad', () => {
    const dirt = createLensDirt();
    const material = dirt.object.material as THREE.ShaderMaterial;
    expect(dirt.object.visible).toBe(false);
    dirt.update(.9); expect(dirt.object.visible).toBe(true);
    dirt.update(.03); expect(dirt.object.visible).toBe(false);
    expect(material.depthTest).toBe(false);
    expect(material.fragmentShader).toContain('smoothstep(.34, .78, length(c))'); // clear centre
    expect(Object.values(material.uniforms).some(u => u.value instanceof THREE.Texture)).toBe(false);
    expect(dirt.object.children).toHaveLength(0);
  });

});
