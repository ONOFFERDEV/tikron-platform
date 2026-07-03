/**
 * Local sandbox bootstrap (M0, kept for asset preview post-M1 behind `?sandbox=1`).
 * No networking — proves the 3D/asset/input stack end-to-end: scene + AssetRegistry +
 * UnitRenderer + InputController wired together, with a controllable "warrior"
 * placeholder, three static "wolf" units, and a few props. Click-to-move lerps locally
 * at MOVE_SPEED so walk/idle states exercise; clicking a wolf triggers attack (on you)
 * + hit (on the wolf).
 */
import { createScene } from "./scene.js";
import { AssetRegistry } from "./assets.js";
import { UnitRenderer, type UnitData } from "./units.js";
import { InputController } from "./input.js";

const MOVE_SPEED = 6; // sim units/sec
const ME_ID = "me";

export async function runSandbox(): Promise<void> {
  const rig = createScene();
  const assets = new AssetRegistry();
  await assets.load();
  const units = new UnitRenderer(rig.scene, assets);

  let me: UnitData = {
    id: ME_ID,
    kind: "player",
    visual: "unit.warrior",
    x: 0,
    y: 0,
    facing: 0,
    hp: 100,
    maxHp: 100,
    name: "You",
    dead: false,
  };
  await units.spawn(me);

  const wolves: UnitData[] = [
    { id: "wolf-1", kind: "wolf", visual: "unit.wolf", x: 4, y: 2, facing: Math.PI, hp: 40, maxHp: 40, name: "Ashen Wolf", dead: false },
    { id: "wolf-2", kind: "wolf", visual: "unit.wolf", x: -3, y: 4, facing: Math.PI, hp: 40, maxHp: 40, name: "Ashen Wolf", dead: false },
    { id: "wolf-3", kind: "wolf", visual: "unit.wolf", x: 2, y: -5, facing: Math.PI, hp: 40, maxHp: 40, name: "Ashen Wolf", dead: false },
  ];
  for (const w of wolves) await units.spawn(w);

  const props: Array<{ visual: string; x: number; y: number }> = [
    { visual: "prop.tree_a", x: -6, y: -2 },
    { visual: "prop.tree_a", x: -8, y: 3 },
    { visual: "prop.rock_a", x: 5, y: 6 },
    { visual: "prop.tent", x: 7, y: -3 },
  ];
  for (const p of props) {
    const object = await assets.getPropVisual(p.visual);
    object.position.set(p.x, 0, p.y);
    rig.scene.add(object);
  }

  let moveTarget: { x: number; y: number } | null = null;

  new InputController(rig.canvas, rig.camera, rig.ground, units, {
    onMoveClick(x, y) {
      moveTarget = { x, y };
    },
    onTargetClick(id) {
      if (id === ME_ID) return;
      moveTarget = null; // stop walking to engage
      units.trigger(ME_ID, "attack");
      units.trigger(id, "hit");
    },
    onHotbar() {
      units.trigger(ME_ID, "cast");
    },
    onClearTarget() {
      // No persistent target state in the sandbox yet — hotbar/target wiring lands with net.ts (M1).
    },
    onMarkerClick() {
      // No zone markers in the sandbox preview.
    },
  });

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    if (moveTarget) {
      const dx = moveTarget.x - me.x;
      const dy = moveTarget.y - me.y;
      const dist = Math.hypot(dx, dy);
      const step = MOVE_SPEED * dt;
      if (dist <= step) {
        me = { ...me, x: moveTarget.x, y: moveTarget.y };
        moveTarget = null;
      } else {
        me = { ...me, x: me.x + (dx / dist) * step, y: me.y + (dy / dist) * step, facing: Math.atan2(dx, dy) };
      }
    }
    units.update(me);

    rig.target.set(me.x, 0, me.y);
    rig.updateCamera();
    units.tick(dt);
    rig.renderer.render(rig.scene, rig.camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
