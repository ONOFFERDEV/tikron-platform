import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MapDef } from '../src/map/types.js';
import type { SignalFrame } from '../src/signal-event.js';

type Core = NonNullable<MapDef['signalCore']>;
type GatePart = {
  readonly color: number;
  readonly centre: readonly [number, number, number];
  readonly size: readonly [number, number, number];
  readonly tilt?: number;
};

function gateGeometry(parts: readonly GatePart[]): T.BufferGeometry {
  const pieces = parts.map(part => {
    const box = new T.BoxGeometry(...part.size);
    const geometry = box.toNonIndexed();
    box.dispose();
    geometry.deleteAttribute('uv');
    geometry.rotateX(part.tilt ?? 0);
    geometry.translate(...part.centre);
    const color = new T.Color(part.color);
    const colors = new Float32Array(geometry.getAttribute('position').count * 3);
    for (let index = 0; index < colors.length; index += 3) colors.set(color.toArray(), index);
    geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
    return geometry;
  });
  const geometry = mergeGeometries(pieces) ?? new T.BufferGeometry();
  pieces.forEach(piece => piece.dispose());
  return geometry;
}

export class SignalCore {
  readonly root = new T.Group();
  private readonly shutters = new T.Group();
  private readonly status = new T.MeshBasicMaterial({ color: 0xd9b66d });
  private open = false;

  constructor(scene: T.Scene, private readonly core: Core) {
    this.root.name = 'event-maintenance-transit';
    this.root.add(this.shutters);
    scene.add(this.root);
    const parts: GatePart[] = [];
    for (const door of core.doors) {
      const x = (door.min.x + door.max.x) / 2;
      const y = (door.min.y + door.max.y) / 2;
      const z = (door.min.z + door.max.z) / 2;
      const w = door.max.x - door.min.x;
      const h = door.max.y - door.min.y;
      const d = door.max.z - door.min.z;
      parts.push({ color: 0x4b4b3c, centre: [x, y, z], size: [w, h, d] });
      for (const side of [-1, 1]) {
        const face = x + side * (w / 2 + .004);
        for (let panelZ = door.min.z + .18; panelZ < door.max.z - .1; panelZ += .31) {
          parts.push({ color: 0x655b45, centre: [face, y, panelZ], size: [.008, h - .12, .27] });
        }
        for (const bandY of [door.min.y + .26, door.max.y - .28]) {
          parts.push({ color: 0x343a32, centre: [face + side * .006, bandY, z], size: [.006, .11, d - .12] });
          for (let pinZ = door.min.z + .2; pinZ < door.max.z - .1; pinZ += .62)
            parts.push({ color: 0x8a8061, centre: [face + side * .011, bandY, pinZ], size: [.004, .036, .036] });
        }
        for (const sign of [-1, 1])
          parts.push({ color: 0xc5af76, centre: [face + side * .010, y, z + sign * .42], size: [.004, .08, 1.05], tilt: sign * .65 });
      }
    }
    const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .9, metalness: .12 });
    const panels = new T.Mesh(gateGeometry(parts), material);
    panels.name = 'authority-backed-shutters';
    this.shutters.add(panels);
    const { min, max } = core.chamber;
    for (const x of [min.x - .008, max.x + .008]) {
      const marker = new T.Mesh(new T.BoxGeometry(.008, .08, .36), this.status);
      marker.name = 'gate-state-marker';
      marker.position.set(x, max.y + .1, (min.z + max.z) / 2 + (max.z - min.z) * .36);
      this.root.add(marker);
    }
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.shutters.position.y = open ? 3 : 0;
    this.shutters.visible = !open;
  }

  update(_frame: SignalFrame, _reducedMotion: boolean): void {
    this.status.color.setHex(this.open ? 0xa8cc91 : 0xd9b66d);
  }

  inspect() {
    const { min, max } = this.core.chamber;
    return { open: this.open, shutterY: this.shutters.position.y,
      route: { x: [min.x, max.x], z: [min.z, max.z], height: max.y - min.y } };
  }
}

export function addCoreSigns(root: T.Object3D, core: Core, flood = false): void {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Core sign requires a 2D canvas');
  ctx.fillStyle = '#3c4132'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#d4ccb3'; ctx.textAlign = 'center'; ctx.font = 'bold 22px Arial';
  ctx.fillText(flood ? 'SLUICE POST' : 'SIGNAL POST', 128, 24);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const material = new T.MeshBasicMaterial({ map: texture });
  const { min, max } = core.chamber;
  for (const x of [min.x - .014, max.x + .014]) {
    const sign = new T.Mesh(new T.PlaneGeometry(2.4, .23), material);
    sign.position.set(x, max.y + .14, (min.z + max.z) / 2 - .5);
    sign.rotation.y = x < min.x ? -Math.PI / 2 : Math.PI / 2;
    root.add(sign);
  }
}
