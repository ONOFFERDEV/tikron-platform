import * as THREE from 'three';
import { MORTAR, type MortarStrike } from '../src/mortar.js';

/** Three fixed instanced draws: hazard rings, descending shells, impact debris.
 * All materials/instance colours exist before scene warm-up. No lights, textures,
 * dynamic geometry or particle allocation, and no gameplay-obscuring smoke. */
export class MortarFx {
  private readonly rings: THREE.InstancedMesh;
  private readonly shells: THREE.InstancedMesh;
  private readonly debris: THREE.InstancedMesh;
  private readonly pose = new THREE.Object3D();
  private readonly color = new THREE.Color();
  constructor(scene: THREE.Scene) {
    const mesh = (geometry: THREE.BufferGeometry, count: number) => {
      const normals = geometry.getAttribute('normal'), shades = new Float32Array(normals.count * 3);
      for (let i = 0; i < normals.count; i++) {
        const shade = .48 + .52 * Math.max(0, normals.getY(i) * .8 + normals.getX(i) * .4 + normals.getZ(i) * .3);
        shades[i*3] = shades[i*3+1] = shades[i*3+2] = geometry instanceof THREE.RingGeometry ? 1 : shade;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(shades, 3));
      const m = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide }), count);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false;
      for (let i = 0; i < count; i++) m.setColorAt(i, this.color.set(0xffbf72));
      m.visible = false; scene.add(m); return m;
    };
    this.rings = mesh(new THREE.RingGeometry(.955, 1, 64), 4);
    this.shells = mesh(new THREE.ConeGeometry(.22, 5, 6), 2);
    this.debris = mesh(new THREE.OctahedronGeometry(1), 48);
  }
  private put(mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number,
    sx: number, sy: number, sz: number, rx: number, ry: number, color: number): void {
    this.pose.position.set(x, y, z); this.pose.scale.set(sx, sy, sz); this.pose.rotation.set(rx, ry, 0);
    this.pose.updateMatrix(); mesh.setMatrixAt(i, this.pose.matrix); mesh.setColorAt(i, this.color.set(color));
  }
  update(strikes: readonly MortarStrike[], now: number, reduced = false): void {
    let rings = 0, shells = 0, debris = 0;
    for (const s of strikes.slice(0, 2)) {
      if (now < s.startedAt || now >= s.endsAt) continue;
      const age = now - s.startedAt, last = MORTAR.warningMs + (MORTAR.rounds - 1) * MORTAR.intervalMs;
      const color = 0xffa35d;
      // Persistent fixed-radius boundary is the gameplay cue, even in Reduced motion.
      if (age < last) this.put(this.rings, rings++, s.x, s.y, s.z, MORTAR.radius, MORTAR.radius, 1, -Math.PI / 2, 0, color);
      const round = Math.min(MORTAR.rounds - 1, Math.max(0, Math.floor((age - MORTAR.warningMs) / MORTAR.intervalMs)));
      const since = age - MORTAR.warningMs - round * MORTAR.intervalMs;
      const until = age < MORTAR.warningMs ? MORTAR.warningMs - age : MORTAR.intervalMs - since;
      if (age < last && until < 700) {
        this.put(this.shells, shells++, s.x, s.y + 2 + until / 700 * 38, s.z, 1, 1, 1, Math.PI, 0, 0xffdfaa);
      }
      if (since >= 0 && since < MORTAR.tailMs) {
        const t = since / 1000, expansion = reduced ? 3 : 1 + Math.min(1, t) * 8;
        this.put(this.rings, rings++, s.x, s.y + .05, s.z, expansion, expansion, 1, -Math.PI / 2, 0, 0xffd29c);
        for (let j = 0; j < 24; j++) {
          const angle = j * 2.399963, speed = 2 + j % 5;
          const core = j < 3, scale = core ? Math.max(.01, (1 - since / 450) * 1.1) : Math.max(.01, (1 - since / MORTAR.tailMs) * (.08 + j % 3 * .07));
          const travel = reduced ? .12 : t;
          this.put(this.debris, debris++, s.x + Math.cos(angle) * speed * travel,
            s.y + Math.max(.15, (4 + j % 4 * 2) * travel - 4.9 * travel * travel), s.z + Math.sin(angle) * speed * travel,
            scale, scale * 2, scale, angle, angle + t, j % 3 === 0 ? 0x4b5558 : j % 3 === 1 ? 0xff893e : 0xffd29c);
        }
      }
    }
    for (const [mesh, count] of [[this.rings, rings], [this.shells, shells], [this.debris, debris]] as const) {
      mesh.count = count; mesh.visible = count > 0; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor!.needsUpdate = true;
    }
  }
  inspect() { return { rings: this.rings.count, shells: this.shells.count, debris: this.debris.count, draws: [this.rings, this.shells, this.debris].filter(m => m.visible).length }; }
}
