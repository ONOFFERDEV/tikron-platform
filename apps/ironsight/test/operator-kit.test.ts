import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { fitOperatorKit, operatorKit } from '../client/operator-kit.js';
import { ActorAppearance } from '../client/actor-appearance.js';
import { prepareRadioGeometry } from '../client/field-equipment.js';

// A quantized-style skin: the decode scale/offset live in inverse bind matrices,
// as in the private glTF. Tests need no purchased asset or browser image decoder.
function fixture() {
  const root = new T.Group();
  const names = ['spine_03','spine_02','UpperArm_L','UpperArm_R','Thigh_L','Thigh_R'];
  const bones = names.map(name => {const b=new T.Bone();b.name=name;b.position.y=1.35;root.add(b);return b;});
  root.updateMatrixWorld(true);
  const decode = new T.Matrix4().makeScale(.72,.72,.72).setPosition(.05,.82,-.02);
  const geometry = new T.BoxGeometry(.4,1.8,.3).translate(0,.9,0).applyMatrix4(decode.clone().invert());
  const count=geometry.getAttribute('position').count;
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(count*4),4));
  const weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;
  geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  const mesh=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial({map:new T.Texture()}));
  root.add(mesh);
  const skeleton=new T.Skeleton(bones,bones.map(b=>b.matrixWorld.clone().invert().multiply(decode)));
  mesh.bind(skeleton,new T.Matrix4());root.updateMatrixWorld(true);skeleton.update();
  return {root,mesh,bones,geometry,count};
}

describe('original operator field kits',()=>{
  it('skins the radio in the existing draw while excluding luggage from hit claims',()=>{
    const asset=new T.Group(),pack=new T.BoxGeometry(.26,.46,.18);
    pack.setAttribute('color',new T.Float32BufferAttribute(Array(pack.getAttribute('position').count*3).fill(.2),3));
    asset.add(new T.Mesh(pack));const radio=prepareRadioGeometry(asset),f=fixture();
    fitOperatorKit(f.root,'anchor',radio);f.mesh.skeleton.update();
    const start=f.mesh.geometry.userData.radioStartTriangle as number;
    expect(f.root.children.filter(n=>n instanceof T.Mesh)).toHaveLength(1);
    expect(f.mesh.geometry.userData.radioTriangles).toBe(12);
    const vertex=f.mesh.geometry.index!.getX(start*3);
    expect(f.mesh.geometry.getAttribute('skinIndex').getX(vertex)).toBe(0);
    expect(f.mesh.geometry.getAttribute('skinWeight').getX(vertex)).toBe(1);
    const before=f.mesh.getVertexPosition(vertex,new T.Vector3()).clone();
    f.bones[0]!.position.x+=.25;f.root.updateMatrixWorld(true);f.mesh.skeleton.update();
    expect(f.mesh.getVertexPosition(vertex,new T.Vector3()).x-before.x).toBeCloseTo(.25,6);
    f.bones[0]!.position.x-=.25;f.root.updateMatrixWorld(true);f.mesh.skeleton.update();
    const ray=new T.Raycaster(new T.Vector3(0,1.28,-2),new T.Vector3(0,0,1));
    const raw:T.Intersection[]=[],filtered:T.Intersection[]=[];
    T.SkinnedMesh.prototype.raycast.call(f.mesh,ray,raw);f.mesh.raycast(ray,filtered);
    expect(raw.some(hit=>(hit.faceIndex??-1)>=start)).toBe(true);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(hit=>(hit.faceIndex??-1)<start)).toBe(true);
  });
  it('uses the authoritative stable role identity and leaves human weapon choice independent',()=>{
    expect(['bot-1','bot-2','bot-3','bot-4','bot-5','bot-6'].map(operatorKit))
      .toEqual(['rusher','rusher','anchor','anchor','sniper','sniper']);
    for(const id of ['human','bot-idle','bot-0','bot-NaN'])expect(operatorKit(id)).toBe('anchor');
  });
  it('preserves source vertices, skin weights and foot/crown bounds through a decode transform',()=>{
    for(const role of ['rusher','anchor','sniper'] as const){
      const f=fixture(), before=Array.from({length:f.count},(_,i)=>f.mesh.getVertexPosition(i,new T.Vector3()).clone());
      const source=Array.from(f.geometry.getAttribute('position').array);
      fitOperatorKit(f.root,role);
      expect(f.root.children.filter(n=>n instanceof T.Mesh)).toHaveLength(1);
      expect(f.geometry.getAttribute('fieldKit')).toBeUndefined();
      expect(Array.from(f.geometry.getAttribute('position').array)).toEqual(source);
      for(let i=0;i<f.count;i++)expect(f.mesh.getVertexPosition(i,new T.Vector3()).distanceTo(before[i]!)).toBeLessThan(1e-6);
      f.mesh.computeBoundingBox();
      expect(f.mesh.boundingBox!.min.y).toBeCloseTo(0,5);
      expect(f.mesh.boundingBox!.max.y).toBeCloseTo(1.8,5);
      expect(f.mesh.boundingBox!.max.x).toBeLessThan(.4);
      expect(f.mesh.boundingBox!.min.x).toBeGreaterThan(-.4);
      expect(f.mesh.geometry.userData.addedTriangles).toBeLessThan(1800);
      for(const attribute of Object.values(f.mesh.geometry.attributes)){
        expect(attribute.count).toBe(f.mesh.geometry.getAttribute('position').count);
        expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
      }
    }
  });
  it('rigid equipment follows its assigned bone and cached role buffers survive another actor',()=>{
    const f=fixture();fitOperatorKit(f.root,'anchor');const equipped=f.mesh.geometry;
    const vertex=f.count, before=f.mesh.getVertexPosition(vertex,new T.Vector3()).clone();
    f.bones[0]!.position.x+=.25;f.root.updateMatrixWorld(true);f.mesh.skeleton.update();
    const after=f.mesh.getVertexPosition(vertex,new T.Vector3());
    expect(after.x-before.x).toBeCloseTo(.25,5);expect(after.y).toBeCloseTo(before.y,5);
    f.bones[0]!.position.x-=.25;f.root.updateMatrixWorld(true);f.mesh.geometry=f.geometry;
    fitOperatorKit(f.root,'anchor');expect(f.mesh.geometry).toBe(equipped);
    f.mesh.geometry=f.geometry;fitOperatorKit(f.root,'sniper');expect(f.mesh.geometry).not.toBe(equipped);
  });
  it('keeps all kit colours on one opaque shader without new maps or recompiles',()=>{
    const f=fixture();fitOperatorKit(f.root,'anchor');
    const appearance=new ActorAppearance(f.root,0x3a7ce8), material=appearance.materials[0]!;
    const key=material.customProgramCacheKey(),version=material.version,map=material.map;
    const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
    material.onBeforeCompile(shader as Parameters<typeof material.onBeforeCompile>[0],{} as T.WebGLRenderer);
    expect(shader.vertexShader).toContain('vFieldKit = fieldKit');
    expect(shader.fragmentShader).toContain('actorRimColor');
    for(const color of [0xffdf55,0xd995ff,0xe8563a]){
      appearance.setColor(color);expect(material.customProgramCacheKey()).toBe(key);expect(material.version).toBe(version);
      expect(material.map).toBe(map);expect(material.depthTest&&material.depthWrite&&!material.transparent).toBe(true);
    }
  });
});
