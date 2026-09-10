import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MapDef } from '../src/map/types.js';
import type { SignalFrame } from '../src/signal-event.js';

/** Original inset shutter kit. Solid panels seek the REPLICATED pose instantly;
 * the only animated pieces are light bars flush against permanent wall volumes.
 * No dynamic shadows, lights, texture writes, or material variants during play. */
export class SignalCore {
  readonly root = new T.Group();
  private readonly shutters = new T.Group();
  private readonly status = new T.MeshBasicMaterial({ color: 0xedaa52 });
  private readonly runners: T.Mesh[] = [];
  private open = false;
  constructor(scene: T.Scene, private readonly core: NonNullable<MapDef['signalCore']>) {
    const lo=core.chamber.min.x, hi=core.chamber.max.x, mid=(lo+hi)/2, length=hi-lo;
    this.root.name = 'event-maintenance-transit'; this.root.add(this.shutters); scene.add(this.root);
    const solid = new T.MeshStandardMaterial({ vertexColors: true, roughness: .7, metalness: .25 });
    let parts: T.BufferGeometry[] = [];
    const box = (color: number, x: number, y: number, z: number, w: number, h: number, d: number, rx=0) => {
      const indexed = new T.BoxGeometry(w,h,d), g = indexed.toNonIndexed(); indexed.dispose(); g.deleteAttribute('uv');
      const c = new T.Color(color), a = new Float32Array(g.getAttribute('position').count * 3);
      for (let i=0;i<a.length;i+=3) { a[i]=c.r; a[i+1]=c.g; a[i+2]=c.b; }
      g.setAttribute('color',new T.BufferAttribute(a,3));g.rotateX(rx);g.translate(x,y,z);parts.push(g);
    };
    const batch = (parent: T.Object3D) => {
      const m = new T.Mesh(mergeGeometries(parts),solid); parent.add(m);
      for (const g of parts) g.dispose(); parts=[];
    };
    for (const b of core.doors) {
      const x=(b.min.x+b.max.x)/2;
      box(0x343c33,x,1.5,50,.5,3,4);
      for(const side of [-1,1]) {
        const face=x+side*.251;
        for(let y=.22;y<3;y+=.32) box(0x606858,face,y,50,.008,.20,3.85);
        for(const z of [48.15,51.85]) box(0xc29851,face,1.5,z,.01,2.9,.18);
        // Two halves of a chevron identify a movable shutter at combat distance.
        for(const sign of [-1,1]) box(0xe0c482,face+side*.008,1.4,50+sign*.5,.008,.14,1.3,sign*.65);
      }
    }
    batch(this.shutters);
    // Permanent guide housings stay in the side walls/lintel, never in the route.
    for(const x of [lo+.01,hi-.01]) {
      for(const z of [47.84,52.16]) box(0x383e32,x,1.5,z,.05,3,.3);
      box(0x30392e,x,3.42,50,.04,.78,4);
      for(const z of [48.3,49.15,50,50.85,51.7]) box(0x9caa9d,x,3.85,z,.06,.13,.22);
    }
    // Floor strips are paint; ceiling ribs remain inside the 3m lintel.
    for(const z of [48.15,51.85]) {
      box(0xac9663,mid,.01,z,length+3,.012,.1);
      box(0x3f4a3a,mid,3.018,z,length-.1,.03,.22);
    }
    for(let x=lo+1;x<hi;x+=2) box(0x4a5542,x,3.01,50,.15,.02,3.8);
    batch(this.root);
    const glowParts:T.BufferGeometry[]=[];
    const glow=(x:number,y:number,z:number,w:number,h:number,d:number)=>{
      const g=new T.BoxGeometry(w,h,d);g.translate(x,y,z);glowParts.push(g);
    };
    for(const x of [lo-.025,hi+.025]) {
      for(const z of [47.94,52.06]) {
        glow(x,1.4,z,.015,2.72,.065);
      }
      glow(x,3.07,50,.015,.045,3.4);
    }
    for(const z of [48.004,51.996]) {
      glow(mid,.22,z,length-.4,.045,.008);
      const runner = new T.Mesh(new T.BoxGeometry(.7,.055,.008),new T.MeshBasicMaterial({color:0xc9fff0}));
      runner.position.set(mid,.22,z);this.root.add(runner);this.runners.push(runner);
    }
    this.root.add(new T.Mesh(mergeGeometries(glowParts),this.status));
    for(const g of glowParts)g.dispose();
  }
  setOpen(open: boolean): void {
    this.open=open;this.shutters.position.y=open ? 3 : 0;
    // Retracted cladding is wholly inside the solid lintel. Omit the concealed
    // panels so their millimetre surface trim cannot fight the roof's facade.
    this.shutters.visible=!open;
  }
  update(frame: SignalFrame, reducedMotion: boolean): void {
    const lo=this.core.chamber.min.x,hi=this.core.chamber.max.x;
    this.status.color.setHex(this.open ? 0x73dace : 0xedaa52);
    for(const [i,runner] of this.runners.entries()) {
      // Remain flush to the actual wall, including Reduced motion. No flashes.
      runner.position.x = reducedMotion || !this.open ? (lo+hi)/2 : lo+.6 + ((frame.elapsedMs / 1400 + i*.5) % 1)*(hi-lo-1.2);
    }
  }
  inspect() { return { open:this.open, shutterY:this.shutters.position.y, route:{x:[this.core.chamber.min.x,this.core.chamber.max.x],z:[48,52],height:3} }; }
}

/** A single tiny immutable sign atlas: 256x64, shared by the two portal headers. */
export function addCoreSigns(root: T.Object3D, core: NonNullable<MapDef['signalCore']>, flood=false): void {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#203740';ctx.fillRect(0,0,256,64);
  ctx.fillStyle='#ecddad';ctx.textAlign='center';ctx.font=flood?'bold 19px Arial':'bold 25px Arial';ctx.fillText(flood?'MAINTENANCE / TRANSIT':'CORE / TRANSIT',128,29);
  ctx.fillStyle='#a9ded5';ctx.font='bold 11px Arial';ctx.fillText(flood?'OPENS ON PRESSURE DROP':'OPENS ON SIGNAL BREAK',128,51);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const mat=new T.MeshBasicMaterial({map:texture});
  for(const x of [core.chamber.min.x-.04,core.chamber.max.x+.04]) {
    const sign=new T.Mesh(new T.PlaneGeometry(3.7,.75),mat);sign.position.set(x,3.43,50);
    sign.rotation.y=x<core.chamber.min.x ? -Math.PI/2 : Math.PI/2;root.add(sign);
  }
}
