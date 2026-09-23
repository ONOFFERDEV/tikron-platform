import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { createSkyWeather } from '../client/scene-sky-weather.js';

const sky = () => new T.ShaderMaterial({
  vertexShader: 'void main() { gl_Position = vec4(position, 1.); }',
  fragmentShader: 'varying vec3 vDirection; void main() { gl_FragColor = vec4(1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  side: T.BackSide, depthWrite: false,
});

describe('battlefield sky weather', () => {
  it.each(['relay', 'undertow', 'switchyard'])('uses the existing sky material without textures or scene nodes on %s', site => {
    const material = sky();
    const weather = createSkyWeather(material, site);
    expect(weather).toBeDefined();
    expect(Object.values(material.uniforms).some(uniform => uniform.value instanceof T.Texture)).toBe(false);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(T.BackSide);
  });

  it('leaves an unauthored site unchanged', () => {
    const material = sky(), fragment = material.fragmentShader;
    expect(createSkyWeather(material, undefined)).toBeUndefined();
    expect(material.fragmentShader).toBe(fragment);
    expect(material.uniforms).toEqual({});
  });

  it('freezes wind in reduced motion and resumes without a time jump', () => {
    const material = sky(), weather = createSkyWeather(material, 'relay');
    weather?.update(1000, false);
    weather?.update(1030, false);
    const moving = material.uniforms.frontTime?.value;
    expect(moving).toBeCloseTo(0.03);
    weather?.update(2030, true);
    expect(material.uniforms.frontTime?.value).toBe(moving);
    weather?.update(2060, false);
    expect(material.uniforms.frontTime?.value).toBeCloseTo(0.06);
  });

  it('keeps material identity and program version stable while wind advances', () => {
    const material = sky(), weather = createSkyWeather(material, 'switchyard');
    const version = material.version, shader = material.fragmentShader;
    for (let i = 0; i < 1000; i++) weather?.update(i * 16.67, false);
    expect(material.version).toBe(version);
    expect(material.fragmentShader).toBe(shader);
    expect(material.uniforms.frontTime?.value).toBeGreaterThan(16);
  });

  it.each(['relay', 'undertow', 'switchyard'])('keeps the far front to one low horizon sector and switches it off in reduced motion on %s', site => {
    const material = sky(), weather = createSkyWeather(material, site)!;
    const u = material.uniforms;
    expect(u.frontLineSpread!.value).toBeLessThan(1);
    expect(u.frontFlashHeight!.value).toBeLessThan(.25);
    // Peak flash stays dim next to the combat flash sprite (opacity 0.9, unlit white).
    expect(Math.max(...(u.frontFlash!.value as T.Vector3).toArray())).toBeLessThan(1);
    expect(material.fragmentShader).toContain('d.y > .6) return radiance');
    weather.update(1000, false); expect(u.frontMotion!.value).toBe(1);
    weather.update(1016, true); expect(u.frontMotion!.value).toBe(0);
    expect(Object.values(u).some(uniform => uniform.value instanceof T.Texture)).toBe(false);
  });
});
