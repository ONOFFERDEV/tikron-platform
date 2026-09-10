import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SIGNAL, type SignalFrame } from '../src/signal-event.js';

/** Original mechanical dish, wholly outside the north boundary (z < -3m at
 * every rotation). No collision, shadow refresh, texture, light or render pass.
 * A fixed chassis and one rotor each batch their authored coloured parts. */
export class SignalArray {
  readonly root = new THREE.Group();
  private readonly rotor = new THREE.Group();
  private readonly pilotMaterial = new THREE.MeshBasicMaterial({ color: 0x8af2eb });
  private readonly waves: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly pilot: THREE.Mesh;
  private phase: SignalFrame['phase'] = 'idle';

  constructor(scene: THREE.Scene, centerX: number) {
    this.root.name = 'relay-signal-array'; this.root.position.set(centerX, 0, -15);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .72, metalness: .2 });
    const parts: THREE.BufferGeometry[] = [];
    const part = (geometry: THREE.BufferGeometry, color: number, x=0, y=0, z=0, rz=0) => {
      const g = geometry.index ? geometry.toNonIndexed() : geometry;
      if (g !== geometry) geometry.dispose();
      g.deleteAttribute('uv');
      const c = new THREE.Color(color), values = new Float32Array(g.getAttribute('position').count * 3);
      for (let i=0; i<values.length; i+=3) { values[i]=c.r; values[i+1]=c.g; values[i+2]=c.b; }
      g.setAttribute('color',new THREE.BufferAttribute(values,3));
      g.rotateZ(rz); g.translate(x,y,z); parts.push(g);
    };
    const box = (color:number,x:number,y:number,z:number,w:number,h:number,d:number,rz=0) =>
      part(new THREE.BoxGeometry(w,h,d),color,x,y,z,rz);
    const batch = (parent:THREE.Object3D) => {
      const mesh = new THREE.Mesh(mergeGeometries(parts),material);
      parent.add(mesh); for (const p of parts) p.dispose(); parts.length=0;
    };
    box(0x343a33,0,1,0,10,2,9);
    box(0x939386,0,12.5,0,3.4,23,3.4);
    for (const x of [-2.8,2.8]) {
      box(0x555d50,x,14,0,.6,23,1);
      box(0x9d8c62,x,25,0,1.1,4,2);
    }
    for (let y=3;y<24;y+=3) box(0x464e40,0,y,1.75,3.6,.22,.28);
    box(0x30382f,0,25.5,0,6.8,1.4,3);
    box(0x555d50,0,28,0,2,5,2);
    batch(this.root);
    this.rotor.position.y=30;
    // Concave receiver with deliberately visible radial seams and back bracing.
    const vertices:number[]=[];
    const point=(r:number,a:number) => [r*Math.cos(a),r*Math.sin(a),.028*r*r];
    for(let ring=0;ring<8;ring++) for(let sector=0;sector<48;sector++) {
      const a=sector*Math.PI/24+.006,b=(sector+1)*Math.PI/24-.006;
      const r=ring*7.5/8, s=(ring+1)*7.5/8;
      vertices.push(...point(r,a),...point(s,a),...point(s,b));
      if(r>0)vertices.push(...point(r,a),...point(s,b),...point(r,b));
    }
    const dish=new THREE.BufferGeometry();
    dish.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)); dish.computeVertexNormals();
    // Thin surfaces are two-sided at material creation, so phase changes never
    // select a new shader variant. The outside-boundary dish is never playable cover.
    material.side=THREE.DoubleSide;
    part(dish,0xb1b2a3);
    part(new THREE.TorusGeometry(7.55,.22,6,64),0x414a3f,0,0,1.6);
    part(new THREE.TorusGeometry(5.1,.09,4,48),0x717869,0,0,.76);
    for(let i=0;i<8;i++) {
      const angle=i*Math.PI/4;
      box(i%2 ? 0x69725f : 0x9a895f,0,0,-.24,.22,14.8,.35,angle);
    }
    for(const x of [-1,1])box(0x434e40,x*2.8,0,2.4,.16,10,.16,x*.6);
    part(new THREE.CylinderGeometry(.7,1,2.8,12).rotateX(Math.PI/2),0x333d31,0,0,3.3);
    batch(this.rotor); this.root.add(this.rotor);
    this.pilot = new THREE.Mesh(new THREE.TorusGeometry(7.3,.085,4,64),this.pilotMaterial);
    this.pilot.position.z=1.64; this.rotor.add(this.pilot);
    for(let i=0;i<2;i++) {
      const m=new THREE.MeshBasicMaterial({ color:0x95ffef,transparent:true,opacity:0,
        side:THREE.DoubleSide,depthWrite:false });
      const wave=new THREE.Mesh(new THREE.RingGeometry(.97,1,64),m);
      wave.visible=false; this.root.add(wave);this.waves.push(wave);
    }
    scene.add(this.root);
    this.update({phase:'idle',cycle:-1,elapsedMs:0,remainingMs:0,alignment:0},false);
  }

  update(frame:SignalFrame,reducedMotion:boolean):void {
    this.phase=frame.phase;
    this.rotor.rotation.set(-.18 + Math.sin(frame.alignment*Math.PI)*.2,-.65+frame.alignment*1.3,0);
    // No blinking: steady warning amber, active teal, white reconnect confirmation.
    this.pilotMaterial.color.setHex(frame.phase==='warning' ? 0xffba60 : frame.phase==='recovery' ? 0xf1ffed : 0x8af2eb);
    for(let i=0;i<this.waves.length;i++) {
      const wave=this.waves[i]!;
      const age=frame.elapsedMs-i*420;
      wave.visible=!reducedMotion && frame.phase==='blackout' && age>=0 && age<2600;
      if(!wave.visible)continue;
      const t=age/2600;
      wave.position.set(0,30,3+t*45); wave.scale.setScalar(7.5+t*20);
      wave.material.opacity=.36*(1-t);
    }
  }
  inspect() {
    return { phase:this.phase, yaw:this.rotor.rotation.y, pitch:this.rotor.rotation.x,
      waves:this.waves.filter(w=>w.visible).length, turnMs:SIGNAL.turnMs,
      // Exclude cosmetic radiated waves when checking solid geometry bounds.
      solidBounds:new THREE.Box3().setFromObject(this.rotor).getSize(new THREE.Vector3()).toArray(),
      exteriorZ:-15, envelopeRadius:10, textures:0 };
  }
}
