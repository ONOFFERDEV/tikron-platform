import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SIGNAL, type SignalFrame } from '../src/signal-event.js';

/** Original timber wireless aerial, wholly outside the north boundary (z < -3m at
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
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .91, metalness: .05 });
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
    box(0x75624d,0,.45,0,8,.9,7);
    for (const x of [-1.8,1.8]) for (const z of [-1.4,1.4]) {
      box(0x766046,x,13.5,z,.42,27,.42);
      for (const y of [2,14,26]) box(0x393b32,x,y,z,.46,.18,.46);
    }
    for (let y=3;y<25;y+=4) {
      for (const z of [-1.4,1.4]) {
        box(0x8e7958,0,y,z,4,.24,.24);
        box(0x65533f,0,y+1.8,z,.18,5.0,.18,y%8===3 ? -.73 : .73);
      }
    }
    for (let y=1.2;y<26;y+=.6) box(0x544938,1.8,y,1.65,.9,.08,.12);
    box(0x8c7757,0,26.4,0,6.8,.32,3.5);
    box(0x62553f,0,28,0,.38,5,.38);
    batch(this.root);
    this.rotor.position.y=30;
    box(0x7d694e,0,1,0,.3,13,.3);
    for (const y of [-4.5,6.5]) {
      box(0x97805a,0,y,0,15,.25,.28);
      for (const x of [-6.8,-4.5,-2.2,0,2.2,4.5,6.8]) {
        box(0xb3ac8f,x,y,.12,.28,.45,.26);
      }
    }
    for (const x of [-6.8,-4.5,-2.2,0,2.2,4.5,6.8]) box(0x464638,x,1,.22,.035,11,.035);
    for (const side of [-1,1]) box(0x514a39,side*3.4,1,-.06,.045,13,.045,side*.55);
    box(0x3c4037,0,-4.8,0,.7,.6,.65);
    batch(this.rotor); this.root.add(this.rotor);
    this.pilot = new THREE.Mesh(new THREE.BoxGeometry(.5,.35,.12),this.pilotMaterial);
    this.pilot.position.set(0,-4.8,.39); this.rotor.add(this.pilot);
    for(let i=0;i<2;i++) {
      const m=new THREE.MeshBasicMaterial({ color:0x95ffef,transparent:true,opacity:0,
        side:THREE.DoubleSide,depthWrite:false });
      const wave=new THREE.Mesh(new THREE.RingGeometry(.97,1,32),m);
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
