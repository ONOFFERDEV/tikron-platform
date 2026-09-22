import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WW1_ENVIRONMENT_MANIFEST } from '../config/ww1-environment.js';
import type { DroneFlight } from '../src/drone.js';

const AIRFRAME = WW1_ENVIRONMENT_MANIFEST.assets.find(asset => asset.key === 'biplane')!;
let authoredAirframe: Promise<THREE.Object3D | null> | undefined;

function fallbackAirframe(team: number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  const fabric = team === 0 ? 0x887a51 : 0x667069;
  const part = (geometry: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0) => {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose(); flat.translate(x, y, z);
    const shade = new THREE.Color(color), colors = new Float32Array(flat.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = shade.r; colors[i + 1] = shade.g; colors[i + 2] = shade.b; }
    flat.setAttribute('color', new THREE.BufferAttribute(colors, 3)); parts.push(flat);
  };
  part(new THREE.BoxGeometry(.72, .62, 4.8), 0x6b6042);
  part(new THREE.BoxGeometry(9.2, .12, 1.15), fabric, 0, .44, .25);
  part(new THREE.BoxGeometry(8.1, .12, 1.05), fabric, 0, -.42, .1);
  part(new THREE.BoxGeometry(3.1, .1, .8), fabric, 0, .2, -2.65);
  part(new THREE.BoxGeometry(.12, 1.65, .8), 0x665c40, 0, .68, -2.65);
  const propeller = new THREE.BoxGeometry(2.2, .08, .12); propeller.rotateZ(Math.PI / 4);
  part(propeller, 0x3f3829, 0, -.225, 3.2);
  const geometry = mergeGeometries(parts)!; parts.forEach(geometryPart => geometryPart.dispose());
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }));
  mesh.name = 'biplane-fallback'; return mesh;
}

function factionAirframe(source: THREE.Object3D, team: number): THREE.Object3D {
  const clone = source.clone(true), tint = new THREE.Color(team === 0 ? 0xb2a16b : 0x87938a);
  clone.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = (Array.isArray(object.material) ? object.material : [object.material]).map(material => {
      const copy = material.clone();
      if (copy instanceof THREE.MeshStandardMaterial || copy instanceof THREE.MeshBasicMaterial) copy.color.multiply(tint);
      return copy;
    });
    object.material = Array.isArray(object.material) ? materials : materials[0]!;
  });
  return clone;
}

function loadAirframe(): Promise<THREE.Object3D | null> {
  authoredAirframe ??= new GLTFLoader().loadAsync(AIRFRAME.publicUrl).then(gltf => {
    const lod = gltf.scene.getObjectByName('LOD1') ?? gltf.scene;
    return lod.clone(true);
  }).catch(() => null);
  return authoredAirframe;
}

export class SentryDrone {
  readonly root = new THREE.Group();
  private readonly aircraft: THREE.Group[];
  private readonly corridors: THREE.InstancedMesh;
  private readonly pose = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    this.aircraft = Array.from({ length: 2 }, (_, team) => {
      const group = new THREE.Group(); group.visible = false; group.userData.factionVariant = team === 0 ? 'khaki' : 'fieldgrey';
      group.add(fallbackAirframe(team)); this.root.add(group); return group;
    });
    this.corridors = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .035, 1),
      new THREE.MeshBasicMaterial({ color: 0xc86942, transparent: true, opacity: .36, depthWrite: false }), 4);
    this.corridors.count = 0; this.corridors.visible = false; this.corridors.name = 'strafe-corridor';
    this.root.add(this.corridors); this.root.name = 'attack-biplane'; scene.add(this.root);
    void loadAirframe().then(template => {
      if (!template) return;
      for (const [team, group] of this.aircraft.entries()) { group.clear(); group.add(factionAirframe(template, team)); }
    });
  }

  update(flights: readonly DroneFlight[], now: number, _reduced = false): void {
    let corridorCount = 0;
    for (let index = 0; index < this.aircraft.length; index++) {
      const group = this.aircraft[index]!, flight = flights[index], corridor = flight?.corridor;
      group.visible = !!flight && !!corridor && now >= flight.warningEndsAt! && now < flight.endsAt;
      if (!flight || !corridor || now < flight.startedAt || now >= flight.endsAt) continue;
      const dx = corridor.end.x - corridor.start.x, dz = corridor.end.z - corridor.start.z;
      const length = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
      const warningEndsAt = flight.warningEndsAt!;
      if (group.visible) {
        const t = Math.min(1, Math.max(0, (now - warningEndsAt) / (flight.endsAt - warningEndsAt)));
        group.position.set(corridor.start.x + dx * t, flight.y, corridor.start.z + dz * t);
        group.rotation.set(0, yaw, 0);
      }
      const nx = -dz / length, nz = dx / length;
      for (const side of [-1, 1]) {
        const offset = side * corridor.width / 2;
        this.pose.position.set((corridor.start.x + corridor.end.x) / 2 + nx * offset, .025,
          (corridor.start.z + corridor.end.z) / 2 + nz * offset);
        this.pose.scale.set(.07, .035, length);
        this.pose.rotation.set(0, yaw, 0); this.pose.updateMatrix();
        this.corridors.setMatrixAt(corridorCount++, this.pose.matrix);
      }
    }
    this.corridors.count = corridorCount; this.corridors.visible = corridorCount > 0;
    this.corridors.instanceMatrix.needsUpdate = true;
    for (let index = flights.length; index < this.aircraft.length; index++) this.aircraft[index]!.visible = false;
  }

  inspect() {
    return { bodies: this.aircraft.filter(group => group.visible).length, corridors: this.corridors.count,
      draws: this.aircraft.filter(group => group.visible).length + Number(this.corridors.visible),
      positions: this.aircraft.map(group => group.position.toArray()), assetUrl: AIRFRAME.publicUrl,
      variants: this.aircraft.map(group => group.userData.factionVariant),
      pilotable: AIRFRAME.pilotable, presentation: AIRFRAME.presentation };
  }
}
