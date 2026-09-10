import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SignalFrame } from '../src/signal-event.js';

/** Pressure Drop 1/2: exterior sluices and a discharge into the north basin.
 * All geometry stays outside z=0. These are not playable doors; the future
 * maintenance route must use room collision, never this visual water level.
 * Five fixed draw objects, no textures/lights/shadows or geometry regeneration. */
export class FloodWorks {
  readonly root = new T.Group();
  private readonly gates: T.InstancedMesh;
  private readonly water: T.InstancedMesh;
  private readonly foam: T.InstancedMesh;
  private readonly pilots: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>;
  private readonly transform = new T.Object3D();
  private phase: SignalFrame['phase'] = 'idle';
  private lift = 0;
  private reduced = false;

  constructor(scene: T.Scene, centerX: number) {
    this.root.name = 'undertow-pressure-drop'; this.root.position.x = centerX;
    const parts: T.BufferGeometry[] = [];
    const box = (x:number,y:number,z:number,w:number,h:number,d:number,color:number) => {
      const source=new T.BoxGeometry(w,h,d),g=source.toNonIndexed();source.dispose();g.translate(x,y,z);
      const c = new T.Color(color), values = new Float32Array(g.getAttribute('position').count*3);
      for(let i=0;i<values.length;i+=3){values[i]=c.r;values[i+1]=c.g;values[i+2]=c.b;}
      g.setAttribute('color',new T.BufferAttribute(values,3));parts.push(g);
    };
    const batch = () => {const g=mergeGeometries(parts);for(const p of parts)p.dispose();parts.length=0;return g;};
    const metal = new T.MeshStandardMaterial({vertexColors:true,roughness:.89,metalness:.15});
    for(const x of [-14,14]) {
      box(x,1,-7,13,2,6,0x3c4441);
      for(const side of [-1,1]) {
        box(x+side*5.7,11.5,-7,1.4,23,3,0x939688);
        box(x+side*5.7,11.5,-5.45,.36,21,.15,0x657166);
      }
      box(x,23,-7,13,1.5,4,0x4e5953);
      box(x,23.85,-6.9,8,.2,3.4,0x99815c);
      box(x,13,-8,10,.65,2,0x3c4441);
      for(const side of [-1,1])box(x+side*3.3,24.5,-7,1.2,1.8,1.5,0x656c59);
    }
    this.root.add(new T.Mesh(batch(),metal));
    box(0,7,-7,9.8,10,1,0x657166);
    for(const y of [2.5,4.5,6.5,8.5,10.5])box(0,y,-6.35,9.9,.38,.4,0x92998a);
    box(0,11.5,-6.25,9.9,.7,.5,0x99815c);
    for(const x of [-3.9,3.9])box(x,7,-6.1,.25,8.5,.2,0x3c4441);
    this.gates=new T.InstancedMesh(batch(),metal,2);this.gates.frustumCulled=false;this.root.add(this.gates);
    for(const x of [-14,14])box(x,23,-4.96,7,.23,.03,0xffffff);
    this.pilots=new T.Mesh(batch(),new T.MeshBasicMaterial({color:0x80d5dc}));this.root.add(this.pilots);
    // Opaque, separated ribbons: no alpha overdraw/refraction, no hidden-player
    // silhouette or water inside the combat rectangle. Per-instance colour is
    // created now, before the shared preparation pass compiles the material.
    const sheet=new T.BoxGeometry(1,1,1),tint=new Float32Array(sheet.getAttribute('position').count*3);
    const top=new T.Color(0x788f8b),bottom=new T.Color(0xb1c1b4),color=new T.Color();
    for(let i=0;i<sheet.getAttribute('position').count;i++) {
      color.copy(bottom).lerp(top,sheet.getAttribute('position').getY(i)+.5);
      tint.set([color.r,color.g,color.b],i*3);
    }
    sheet.setAttribute('color',new T.BufferAttribute(tint,3));
    this.water=new T.InstancedMesh(sheet,new T.MeshBasicMaterial({vertexColors:true}),24);
    this.foam=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshBasicMaterial(),24);
    for(let i=0;i<24;i++) {
      this.water.setColorAt(i,new T.Color(i%3===0?0xffffff:i%3===1?0xdfedee:0xeaf3f2));
      this.foam.setColorAt(i,new T.Color(i%2?0xe2f2e8:0xafd6d1));
    }
    for(const mesh of [this.water,this.foam]){mesh.frustumCulled=false;this.root.add(mesh);}
    scene.add(this.root);
    this.update({phase:'idle',cycle:-1,elapsedMs:0,remainingMs:0,alignment:0},false);
  }

  update(frame: SignalFrame, reducedMotion: boolean): void {
    this.phase=frame.phase; this.reduced=reducedMotion;
    const active=frame.phase==='blackout', draining=frame.phase==='recovery';
    const t=active?Math.min(1,frame.elapsedMs/3000):draining?Math.max(0,1-frame.elapsedMs/3000):0;
    this.lift=10*t*t*(3-2*t);
    const pose=this.transform;
    for(let i=0;i<2;i++) {
      pose.position.set(i===0?-14:14,this.lift,0);pose.scale.setScalar(1);pose.updateMatrix();this.gates.setMatrixAt(i,pose.matrix);
    }
    this.gates.instanceMatrix.needsUpdate=true;
    this.pilots.material.color.setHex(frame.phase==='warning'?0xffbb66:active?0xb6fff0:0x80d5dc);
    // Core gate travel stays readable in Reduced motion; omit only the moving
    // foam and oscillating stream edge. Phase, water and PA text are identical.
    const strength=active?Math.min(1,frame.elapsedMs/1600):draining?Math.max(0,1-frame.elapsedMs/1600):0;
    this.water.count=strength>0?24:0;this.foam.count=strength>0&&!reducedMotion?24:0;
    for(let i=0;i<this.water.count;i++) {
      const column=i%12,side=i<12?-14:14;
      const wave=reducedMotion?0:Math.sin(frame.elapsedMs*.009+column*1.7)*.14;
      pose.position.set(side+(column-5.5)*.73,6.9,-5.65+wave);
      pose.scale.set(.77,(9.8+wave)*strength,.24);pose.updateMatrix();this.water.setMatrixAt(i,pose.matrix);
      const age=((frame.elapsedMs/900+i*.173)%1);
      pose.position.set(side+(column-5.5)*.73,2.1+Math.sin(age*Math.PI)*1.5*strength,-5.2+age*1.6);
      pose.scale.set(.45,.20+age*.35,.5);pose.updateMatrix();this.foam.setMatrixAt(i,pose.matrix);
    }
    if(this.water.count)this.water.instanceMatrix.needsUpdate=true;
    if(this.foam.count)this.foam.instanceMatrix.needsUpdate=true;
  }
  inspect() {
    return {kind:'pressure-drop',phase:this.phase,lift:this.lift,streams:this.water.count,foam:this.foam.count,
      reducedMotion:this.reduced,textures:0,playableRoute:false};
  }
}
