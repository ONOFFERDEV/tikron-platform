import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DRONE, type DroneFlight } from '../src/drone.js';

/** Original ducted-fan sentry with baked vertex shading. Three fixed instanced
 * draws for both teams: chassis and warning beams/crosses. No new lights,
 * textures, shadow updates or per-frame geometry; prepares before controls. */
export class SentryDrone {
  private readonly bodies: THREE.InstancedMesh;
  private readonly rotors: THREE.InstancedMesh;
  private readonly rotorPose = new THREE.Object3D();
  private readonly beams: THREE.InstancedMesh;
  private readonly pose = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly up = new THREE.Vector3(0,1,0);
  private readonly direction = new THREE.Vector3();
  constructor(scene: THREE.Scene) {
    const parts: THREE.BufferGeometry[] = [];
    const part = (g: THREE.BufferGeometry, color: number, x=0,y=0,z=0) => {
      const flat = g.index ? g.toNonIndexed() : g.clone(); g.dispose(); flat.translate(x,y,z);
      const c = new THREE.Color(color), normals=flat.getAttribute('normal'), shades = new Float32Array(normals.count*3);
      for(let i=0;i<normals.count;i++) {
        const shade=.45+.55*Math.max(0,normals.getY(i)*.8+normals.getX(i)*.4+normals.getZ(i)*.3);
        shades[i*3]=c.r*shade;shades[i*3+1]=c.g*shade;shades[i*3+2]=c.b*shade;
      }
      flat.setAttribute('color',new THREE.BufferAttribute(shades,3));parts.push(flat);
    };
    part(new THREE.BoxGeometry(.85,.38,1.4),0xc8d3cf);
    part(new THREE.BoxGeometry(.6,.2,.7),0x223c47,0,.28,-.1);
    part(new THREE.BoxGeometry(.64,.12,.14),0xffc879,0,-.02,.77);
    part(new THREE.BoxGeometry(2.5,.12,.18),0x38515b,0,0,-.48);
    part(new THREE.BoxGeometry(2.5,.12,.18),0x38515b,0,0,.48);
    for(const x of [-1.05,1.05]) for(const z of [-.68,.68]) {
      const ring=new THREE.TorusGeometry(.42,.075,5,18);ring.rotateX(Math.PI/2);part(ring,0xa7bebb,x,.02,z);
      part(new THREE.CylinderGeometry(.12,.12,.16,8),0xedaa52,x,0,z);
    }
    for(const x of [-.24,.24]) {
      const barrel=new THREE.CylinderGeometry(.055,.085,.85,8);barrel.rotateX(Math.PI/2);part(barrel,0x24363d,x,-.27,.54);
      part(new THREE.BoxGeometry(.12,.12,.06),0xffd198,x,-.27,1);
      part(new THREE.BoxGeometry(.1,.2,.55),0x4a646a,x,-.29,-.4);
    }
    const geometry=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());
    this.bodies=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true}),2);
    this.rotors=new THREE.InstancedMesh(new THREE.BoxGeometry(.64,.025,.07),new THREE.MeshBasicMaterial({color:0x263e47}),8);
    const beamGeometry=new THREE.CylinderGeometry(1,1,1,6);
    this.beams=new THREE.InstancedMesh(beamGeometry,new THREE.MeshBasicMaterial({color:0xffffff}),6);
    for(const m of [this.bodies,this.beams,this.rotors]) {
      m.count=0;m.visible=false;m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(m);
    }
    for(let i=0;i<6;i++)this.beams.setColorAt(i,this.color.set(0xffbe75));
    this.bodies.name='sentry-chassis';this.beams.name='sentry-lock';
  }
  private line(index:number,a:{x:number;y:number;z:number},b:{x:number;y:number;z:number},radius:number,color:number):void {
    this.direction.set(b.x-a.x,b.y-a.y,b.z-a.z);
    this.pose.position.set((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
    this.pose.scale.set(radius,this.direction.length(),radius);
    this.pose.quaternion.setFromUnitVectors(this.up,this.direction.normalize());this.pose.updateMatrix();
    this.beams.setMatrixAt(index,this.pose.matrix);this.beams.setColorAt(index,this.color.set(color));
  }
  update(flights:readonly DroneFlight[],now:number,reduced=false):void {
    let bodies=0,beams=0,rotors=0;
    for(const f of flights.slice(0,2)) {
      if(now<f.startedAt || now>=f.endsAt)continue;
      // Cosmetic bob never changes server origin or the warning endpoint.
      this.pose.position.set(f.x,f.y+(reduced?0:Math.sin((now-f.startedAt)*.004)*.055),f.z);
      this.pose.scale.setScalar(.75);
      this.pose.rotation.set(0,f.lock?Math.atan2(f.lock.point.x-f.x,f.lock.point.z-f.z):f.team===0?Math.PI/2:-Math.PI/2,0);
      this.pose.updateMatrix();this.bodies.setMatrixAt(bodies++,this.pose.matrix);
      for(const x of [-1.05,1.05])for(const z of [-.68,.68]) {
        this.rotorPose.position.set(x,.04,z);this.rotorPose.scale.setScalar(1);
        this.rotorPose.rotation.set(0,reduced?Math.PI/4:(now-f.startedAt)*.045*(x*z>0?1:-1),0);
        this.rotorPose.updateMatrix();this.rotorPose.matrix.premultiply(this.pose.matrix);this.rotors.setMatrixAt(rotors++,this.rotorPose.matrix);
      }
      const lock=f.lock;
      if(lock && now<lock.fireAt && lock.fireAt-now<=DRONE.warningMs+1000) {
        const p=lock.point, color=0xffa85e;
        this.line(beams++,f,p,.012,color);
        this.line(beams++,{x:p.x-.32,y:p.y,z:p.z},{x:p.x+.32,y:p.y,z:p.z},.022,color);
        this.line(beams++,{x:p.x,y:p.y-.32,z:p.z},{x:p.x,y:p.y+.32,z:p.z},.022,color);
      }
    }
    this.bodies.count=bodies;this.beams.count=beams;this.rotors.count=rotors;
    for(const m of [this.bodies,this.beams,this.rotors]) {m.visible=m.count>0;m.instanceMatrix.needsUpdate=true;}
    this.beams.instanceColor!.needsUpdate=true;
  }
  inspect() { return { bodies:this.bodies.count,beams:this.beams.count,draws:Number(this.bodies.visible)+Number(this.beams.visible)+Number(this.rotors.visible),trianglesPerDrone:this.bodies.geometry.getAttribute('position').count/3 }; }
}
