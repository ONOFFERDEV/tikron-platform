import { describe, expect, it } from 'vitest';
import * as T from 'three';
import dusk from '../client/undertow-dusk.json';
import overcast from '../client/switchyard-overcast.json';
import { applySiteLightRig, gradeSiteEnvironment, gradeSiteSky, siteLightProfile } from '../client/scene-lighting.js';

describe('front lighting', () => {
  it('preserves the daylight exposure contract', () => {
    expect(siteLightProfile('relay')?.exposure).toBe(1.05);
  });

  it.each([{ site: 'undertow', sky: dusk }, { site: 'switchyard', sky: overcast }])(
    'keeps the authored sky rig contract on $site', ({ site, sky }) => {
      const scene = new T.Scene();
      const key = new T.DirectionalLight(), fill = new T.HemisphereLight(), ambient = new T.AmbientLight();
      scene.add(key, fill, ambient);
      scene.fog = new T.Fog(sky.fogColor, sky.fogNear, sky.fogFar);
      applySiteLightRig(scene, site, new T.Vector3());
      const profile = siteLightProfile(site);
      expect(profile?.exposure).toBe(sky.exposure);
      expect(profile?.environment).toBe(sky.environmentIntensity);
      expect(key.color.getHexString()).toBe(sky.keyColor.slice(1));
      expect(key.intensity).toBe(sky.keyIntensity);
      expect(key.position.clone().normalize().distanceTo(new T.Vector3().fromArray(sky.sunDirection).normalize())).toBeLessThan(1e-10);
      expect(fill.color.getHexString()).toBe(sky.hemisphereSky.slice(1));
      expect(fill.groundColor.getHexString()).toBe(sky.hemisphereGround.slice(1));
      expect(fill.intensity).toBe(sky.hemisphereIntensity);
      expect(ambient.intensity).toBe(sky.ambientIntensity);
      expect(scene.fog.color.getHexString()).toBe(sky.fogColor.slice(1));
    });

  it.each(['relay', 'undertow', 'switchyard'])('retains the existing light budget and dormant flashes on %s', site => {
    const scene = new T.Scene();
    const key = new T.DirectionalLight(), hemi = new T.HemisphereLight(), ambient = new T.AmbientLight();
    const flash = new T.PointLight(0xffb066, 0);
    scene.add(key, hemi, ambient, flash);
    const children = [...scene.children];
    applySiteLightRig(scene, site, new T.Vector3(75, 0, 50));
    expect(scene.children).toEqual(children);
    expect(flash.intensity).toBe(0);
    expect(flash.visible).toBe(true);
    expect(hemi.intensity).toBeGreaterThan(0.5);
    expect(ambient.intensity).toBeGreaterThan(0);
  });

  it('keeps the daytime key aligned with the existing reflection bake', () => {
    const scene = new T.Scene(), key = new T.DirectionalLight();
    scene.add(key);
    const center = new T.Vector3(75, 0, 50);
    applySiteLightRig(scene, 'relay', center);
    const direction = key.position.clone().sub(center).normalize();
    expect(direction.distanceTo(new T.Vector3(-0.46, 0.84, -0.29).normalize())).toBeLessThan(1e-10);
  });

  it('leaves unauthored maps untouched', () => {
    const scene = new T.Scene(), key = new T.DirectionalLight(0x123456, 0.42);
    scene.add(key);
    applySiteLightRig(scene, undefined, new T.Vector3());
    expect(key.intensity).toBe(0.42);
    expect(key.color.getHex()).toBe(0x123456);
    expect(siteLightProfile(undefined)).toBeUndefined();
  });

  it('preserves sightline distances when the horizon color changes', () => {
    const scene = new T.Scene(), fog = new T.Fog(0x96a6af, 100, 340);
    scene.fog = fog;
    applySiteLightRig(scene, 'switchyard', new T.Vector3());
    expect(scene.fog).toBe(fog);
    expect(fog.near).toBe(100);
    expect(fog.far).toBe(340);
  });

  it.each([T.FloatType, T.HalfFloatType])('grades HDR radiance in place without clipping highlights or alpha (%s)', type => {
    const channels = [3, 2, 1, 0.7];
    const data = type === T.FloatType ? new Float32Array(channels) : new Uint16Array(channels.map(T.DataUtils.toHalfFloat));
    const texture = new T.DataTexture(data, 1, 1, T.RGBAFormat, type);
    const alpha = data[3];
    gradeSiteEnvironment(texture, 'switchyard');
    const red = data[0] ?? 0, blue = data[2] ?? 0;
    const decode = (value: number) => type === T.FloatType ? value : T.DataUtils.fromHalfFloat(value);
    expect(texture.image.data).toBe(data);
    expect(data[3]).toBe(alpha);
    expect(decode(red)).toBeGreaterThan(1);
    expect(decode(red) - decode(blue)).toBeLessThan(1);
    expect(decode(blue)).toBeGreaterThan(1);
  });

  it('adds sky grading to the existing opaque draw without textures', () => {
    const sky = new T.ShaderMaterial({ fragmentShader: 'void main(){ gl_FragColor=vec4(1.);\n#include <tonemapping_fragment>\n}' });
    gradeSiteSky(sky, 'switchyard');
    expect(sky.transparent).toBe(false);
    expect(Object.values(sky.uniforms).some(uniform => uniform.value instanceof T.Texture)).toBe(false);
    expect(sky.uniforms.frontSkySaturation?.value).toBeLessThan(0.5);
  });
});
