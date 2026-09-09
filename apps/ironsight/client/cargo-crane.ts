import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SIGNAL, type SignalFrame } from '../src/signal-event.js';

/** Cargo Shift 1/2: the east gantry lifts a twelve-metre cargo module, carries
 * it to the other service berth, and sets it down. Entirely outside play;
 * the next arc stage must add authoritative cover before claiming a route payoff.
 * Four draw objects, no textures, lights, shadows, or per-frame geometry work. */
export class CargoCrane {
  readonly root = new T.Group();
  private readonly cargo: T.Mesh;
  private readonly trolley: T.Mesh;
  private readonly cables: T.InstancedMesh;
  private readonly pilot: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>;
  private readonly transform = new T.Object3D();
  private phase: SignalFrame['phase'] = 'idle';
  private berth = -14;
  private lift = 0;

  constructor(scene: T.Scene, width: number, depth: number) {
    this.root.name = 'switchyard-cargo-shift';
    this.root.position.set(width + 6, 0, depth / 2);
    const material = new T.MeshStandardMaterial({vertexColors:true, roughness:.78, metalness:.22});
    const parts: T.BufferGeometry[] = [];
    const box = (color:number, x:number,y:number,z:number,w:number,h:number,d:number,ry=0) => {
      const indexed=new T.BoxGeometry(w,h,d), g=indexed.toNonIndexed(); indexed.dispose();
      g.rotateY(ry);g.translate(x,y,z);
      const c=new T.Color(color), colors=new Float32Array(g.getAttribute('position').count*3);
      for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}
      g.setAttribute('color',new T.BufferAttribute(colors,3));parts.push(g);
    };
    const batch = () => {const g=mergeGeometries(parts);for(const p of parts)p.dispose();parts.length=0;return g;};
    // Sealed orange corrugated cargo, dark frame and four pale corner castings.
    // The same 4x3x12m body is the planned cover envelope for stage 2.
    box(0xb97835,0,1.5,0,4,3,12);
    for(const y of [.12,2.88])box(0x273e46,0,y,0,4.12,.24,12.12);
    for(const x of [-1.88,1.88])for(const z of [-5.88,5.88]) {
      box(0xcdd0b6,x,1.5,z,.24,2.76,.24);
      box(0x273e46,x,3.08,z,.38,.16,.38);
    }
    for(const side of [-1,1]) {
      for(let z=-5.3;z<=5.3;z+=.55)box(0xd79c4c,side*2.025,1.5,z,.07,2.45,.13);
      // Large serial panel breaks the ribs; bold stripes remain readable at range.
      box(0x273e46,side*2.08,1.7,-1.5,.04,1.1,3.1);
      for(const z of [-2.3,-1.5,-.7])box(0xd7dfcc,side*2.105,1.7,z,.02,.63,.22);
      box(0xd7dfcc,side*2.105,1.35,-1.5,.02,.1,2.1);
      for(const z of [-5.25,5.25])for(let y=.6;y<2.5;y+=.55)
        box(0x263a42,side*2.085,y,z,.04,.22,.55);
    }
    // Paired end doors, hinges and locking bars. Geometry adds relief without
    // a new texture atlas or gaps that falsely suggest a playable interior.
    for(const end of [-1,1])for(const x of [-.95,.95]) {
      box(0x986638,x,1.5,end*6.025,1.78,2.44,.05);
      box(0xd7dfcc,x,1.5,end*6.08,.09,2.22,.06);
      box(0x273e46,x,1.25,end*6.13,.42,.12,.08);
      for(const y of [.6,2.4])box(0x273e46,x+Math.sign(x)*.63,y,end*6.08,.28,.18,.08);
    }
    // Lifting spreader stays attached to the load; no unsupported floating crate.
    for(const x of [-1.65,1.65])box(0x334b52,x,3.32,0,.3,.35,11.5);
    for(const z of [-5.5,5.5])box(0xc6a45e,0,3.32,z,3.6,.35,.3);
    this.cargo=new T.Mesh(batch(),material);this.cargo.name='cargo-module';this.root.add(this.cargo);

    box(0x273e46,0,18.5,0,4.3,.6,4);
    for(const x of [-1.5,1.5]) {
      box(0xb8c4bb,x,19.0,0,.85,.6,3.5);
      for(const z of [-1.25,1.25])box(0x344d55,x,19.35,z,.8,.7,.6);
    }
    box(0xc89c50,0,18.95,0,1.8,.65,2.7);
    this.trolley=new T.Mesh(batch(),material);this.trolley.name='cargo-trolley';this.root.add(this.trolley);

    this.cables=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:0x253d46,roughness:.72,metalness:.3}),4);
    this.cables.frustumCulled=false;this.cables.name='cargo-hoist-cables';this.root.add(this.cables);
    box(0xffffff,0,18.28,2.03,2.4,.15,.04);
    this.pilot=new T.Mesh(batch(),new T.MeshBasicMaterial({color:0x80d5dc}));this.root.add(this.pilot);
    scene.add(this.root);
    this.update({phase:'idle',cycle:-1,elapsedMs:0,remainingMs:0,alignment:0});
  }

  update(frame: SignalFrame): void {
    this.phase=frame.phase;
    // Seek from absolute server phase time. Late joins and skipped frames get
    // the same pose; no local accumulation, physics sway or blinking beacon.
    const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
    const reverse=frame.cycle>=0 && frame.cycle%2===1;
    const elapsed=frame.phase==='blackout'?frame.elapsedMs:frame.phase==='warning'||frame.cycle<0?0:SIGNAL.blackoutMs;
    this.lift=8*(smooth(elapsed/3000)-smooth((elapsed-12000)/3000));
    const travel=smooth((elapsed-3000)/9000);
    this.berth=(reverse?14:-14)+(reverse?-28:28)*travel;
    this.cargo.position.set(0,4+this.lift,this.berth);
    this.trolley.position.z=this.pilot.position.z=this.berth;
    this.pilot.material.color.setHex(frame.phase==='warning'?0xffbb66:frame.phase==='blackout'?0xb6fff0:0x80d5dc);
    const bottom=7.5+this.lift, top=18.2, pose=this.transform;
    for(let i=0;i<4;i++) {
      // Cables fan from the compact trolley to the long spreader.
      const x=i%2?-1.65:1.65, z=i<2?-5.5:5.5, topZ=i<2?-1.4:1.4;
      const length=Math.hypot(top-bottom,z-topZ);
      pose.position.set(x,(top+bottom)/2,this.berth+(z+topZ)/2);
      pose.rotation.set(Math.atan2(z-topZ,top-bottom)*-1,0,0);
      pose.scale.set(.075,length,.075);pose.updateMatrix();this.cables.setMatrixAt(i,pose.matrix);
    }
    this.cables.instanceMatrix.needsUpdate=true;
  }

  inspect() {
    return {kind:'cargo-shift',phase:this.phase,berth:this.berth,lift:this.lift,
      bottom:4+this.lift,textures:0,playableRoute:false};
  }
}
