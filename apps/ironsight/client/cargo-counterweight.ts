import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MapDef } from '../src/map/types.js';

/** Discrete mechanical locks, like the transit shutters: NEVER interpolate
 * visible cover across a collision transition. Down locks flush with the floor;
 * centimetre surface trim adds no cover. GPU resources stay resident. */
export class CargoCounterweight {
  readonly root = new T.Group();
  private readonly weight = new T.Group();
  private readonly status = new T.MeshBasicMaterial({color:0xedaa52});
  private open = false;
  constructor(scene:T.Scene, private readonly core:NonNullable<MapDef['signalCore']>) {
    const b=core.chamber,w=b.max.x-b.min.x,h=b.max.y-b.min.y,d=b.max.z-b.min.z;
    this.root.name='freight-counterweight';
    this.root.position.set((b.min.x+b.max.x)/2,b.min.y,(b.min.z+b.max.z)/2);
    this.root.add(this.weight);scene.add(this.root);
    let parts:T.BufferGeometry[]=[];
    const box=(color:number,x:number,y:number,z:number,bw:number,bh:number,bd:number)=>{
      const indexed=new T.BoxGeometry(bw,bh,bd),g=indexed.toNonIndexed();indexed.dispose();
      g.deleteAttribute('uv');g.translate(x,y,z);
      const c=new T.Color(color),a=new Float32Array(g.getAttribute('position').count*3);
      for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}
      g.setAttribute('color',new T.BufferAttribute(a,3));parts.push(g);
    };
    const batch=(parent:T.Object3D)=>{
      parent.add(new T.Mesh(mergeGeometries(parts),new T.MeshStandardMaterial({vertexColors:true,roughness:.8,metalness:.25})));
      for(const g of parts)g.dispose();parts=[];
    };
    // The full dark envelope has no misleading gaps. Inset orange panels and
    // pale castings echo the overhead cargo without inventing another asset.
    box(0x283e46,0,h/2,0,w-.16,h-.04,d-.16);
    for(const y of [.075,h-.075])box(0x283e46,0,y,0,w,.15,d);
    for(const side of [-1,1]) {
      box(0xbc7d3c,side*(w/2-.07),h/2,0,.04,h-.3,d-.3);
      for(let z=-d/2+.32;z<d/2-.2;z+=.4)
        box(0xe0a954,side*(w/2-.025),h/2,z,.05,h-.65,.09);
      for(const z of [-d/2+.12,d/2-.12])box(0xc6ceba,side*(w/2-.09),h/2,z,.18,h-.34,.18);
      box(0x203740,side*(w/2+.006),1.7,0,.012,1.2,3.5);
      box(0xb87a39,0,h/2,side*(d/2-.07),w-.3,h-.3,.04);
      for(let x=-w/2+.3;x<w/2-.2;x+=.4)box(0xe0a954,x,h/2,side*(d/2-.025),.09,h-.65,.05);
    }
    // A flat metal top becomes the crossing floor in the down lock.
    for(let z=-d/2+.18;z<d/2;z+=.38)box(0x788d88,0,h+.004,z,w-.16,.004,.035);
    batch(this.weight);
    // Paint only: four corners and transverse teeth mark the protected footprint.
    for(const side of [-1,1]) {
      box(0xdeae61,side*(w/2+.22),.012,0,.12,.012,d+.6);
      box(0xdeae61,0,.012,side*(d/2+.22),w+.6,.012,.12);
      for(let z=-d/2;z<=d/2;z+=.5)box(0xdeae61,side*(w/2+.48),.013,z,.32,.012,.14);
    }
    batch(this.root);
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#203740';ctx.fillRect(0,0,512,128);
    ctx.textAlign='center';ctx.fillStyle='#ffe0a2';ctx.font='bold 39px Arial';ctx.fillText('FREIGHT / 04',256,47);
    ctx.fillStyle='#c4e0d8';ctx.font='bold 19px Arial';ctx.fillText('COVER RETRACTS ON CARGO SHIFT',256,82);
    ctx.font='16px Arial';ctx.fillText('KEEP THE MARKED CROSSING CLEAR',256,111);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const mat=new T.MeshBasicMaterial({map:texture});
    for(const side of [-1,1]) {
      const sign=new T.Mesh(new T.PlaneGeometry(3.35,.84),mat);
      sign.rotation.y=side*Math.PI/2;sign.position.set(side*(w/2+.018),1.7,0);this.weight.add(sign);
      const bar=new T.Mesh(new T.BoxGeometry(.01,.075,d-.5),this.status);
      bar.position.set(side*(w/2+.23),.045,0);this.root.add(bar);
    }
  }
  setOpen(open:boolean):void {
    this.open=open;this.weight.position.y=open ? -(this.core.chamber.max.y-this.core.chamber.min.y) : 0;
    this.status.color.setHex(open?0x73dace:0xedaa52);
  }
  inspect(){return {open:this.open,weightY:this.weight.position.y,coverHeight:this.open?0:3,footprint:this.core.chamber};}
}
