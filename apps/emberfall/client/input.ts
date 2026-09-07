/**
 * Pointer + keyboard input: raycasts clicks against the ground plane
 * (move-to-point), unit meshes (target/attack), and static zone markers
 * (shop/dummy NPC props — click-to-interact, PLAN-EMBERFALL-M2's zones/types.ts
 * `NpcMarker` doc: "상점 NPC 클릭→상점 열기"), and maps number keys 1-6 to hotbar
 * slots / ESC to clear the current target. Pure DOM-event wiring — all game logic
 * lives in the callbacks passed by the caller.
 */
import * as THREE from "three";
import type { UnitRenderer } from "./units.js";

export interface InputCallbacks {
  onMoveClick(x: number, y: number): void;
  onTargetClick(id: string): void;
  onHotbar(n: number): void;
  onClearTarget(): void;
  /** A registered static marker (see `setMarkers`) was clicked. */
  onMarkerClick(id: string): void;
  /** Space pressed — dash toward `target`, the ground point under the cursor (sim-plane
   *  `x/y`), or `null` when the cursor isn't over the ground (off-canvas / no raycast hit),
   *  in which case the caller falls back to the unit's own heading. */
  onDash(target: { x: number; y: number } | null): void;
}

/** One clickable, non-unit prop (a zone's NpcMarker — shop/dummy). */
export interface ClickableMarker {
  id: string;
  object: THREE.Object3D;
}

export class InputController {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  /** Latest cursor position over the canvas, in NDC — kept fresh by `pointermove` so a Space
   *  dash can raycast the ground under the cursor without waiting for a click. */
  private readonly hover = new THREE.Vector2();
  private hasHover = false;
  private readonly onPointerDown: (e: PointerEvent) => void;
  private readonly onPointerMove: (e: PointerEvent) => void;
  private readonly onPointerLeave: () => void;
  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private markers: readonly ClickableMarker[] = [];

  constructor(
    private readonly domElement: HTMLElement,
    private readonly camera: THREE.Camera,
    private readonly ground: THREE.Object3D,
    private readonly units: UnitRenderer,
    private readonly callbacks: InputCallbacks,
  ) {
    this.onPointerDown = (e) => this.handlePointerDown(e);
    this.onPointerMove = (e) => this.handlePointerMove(e);
    this.onPointerLeave = () => {
      this.hasHover = false;
    };
    this.onKeyDown = (e) => this.handleKeyDown(e);
    domElement.addEventListener("pointerdown", this.onPointerDown);
    domElement.addEventListener("pointermove", this.onPointerMove);
    domElement.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("keydown", this.onKeyDown);
  }

  dispose(): void {
    this.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.domElement.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("keydown", this.onKeyDown);
  }

  /** Registers the current zone's clickable static markers (shop/dummy NPC props) for
   *  raycasting — replace the whole set on every zone load/transfer. Tags each root
   *  object with `userData.markerId` so `findTaggedId` can resolve a click on any of
   *  its descendants back to the marker id. */
  setMarkers(markers: readonly ClickableMarker[]): void {
    this.markers = markers;
    for (const m of markers) m.object.userData.markerId = m.id;
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const targets = this.units.targetables().map((t) => t.object);
    const unitHits = this.raycaster.intersectObjects(targets, true);
    const firstUnitHit = unitHits[0];
    if (firstUnitHit) {
      const id = findTaggedId(firstUnitHit.object, "unitId");
      if (id) {
        this.callbacks.onTargetClick(id);
        return;
      }
    }

    if (this.markers.length > 0) {
      const markerHits = this.raycaster.intersectObjects(this.markers.map((m) => m.object), true);
      const firstMarkerHit = markerHits[0];
      if (firstMarkerHit) {
        const id = findTaggedId(firstMarkerHit.object, "markerId");
        if (id) {
          this.callbacks.onMarkerClick(id);
          return;
        }
      }
    }

    const groundHit = this.raycaster.intersectObject(this.ground, false)[0];
    if (groundHit) this.callbacks.onMoveClick(groundHit.point.x, groundHit.point.z);
  }

  private handlePointerMove(e: PointerEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.hover.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.hover.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.hasHover = true;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      this.callbacks.onClearTarget();
      return;
    }
    // Space = dash. Ignore while typing (chat/inventory search etc.) and stop the browser's
    // default page-scroll so a dash never also scrolls the page.
    if (e.code === "Space") {
      if (isTextInputFocused()) return;
      e.preventDefault();
      this.callbacks.onDash(this.groundUnderCursor());
      return;
    }
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= 6) this.callbacks.onHotbar(n);
  }

  /** The sim-plane ground point under the current cursor, or `null` when the cursor isn't
   *  over the canvas or the ray misses the ground. */
  private groundUnderCursor(): { x: number; y: number } | null {
    if (!this.hasHover) return null;
    this.raycaster.setFromCamera(this.hover, this.camera);
    const hit = this.raycaster.intersectObject(this.ground, false)[0];
    return hit ? { x: hit.point.x, y: hit.point.z } : null;
  }
}

/** True when a text-entry element (input/textarea/contenteditable) has focus — used to let
 *  Space fall through to typing instead of triggering a dash. */
function isTextInputFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** Walks up from a raycast hit to the nearest ancestor (inclusive) tagged with
 *  `userData[key]` (see units.ts `root.userData.unitId` / `setMarkers`'s `markerId`). */
function findTaggedId(object: THREE.Object3D, key: string): string | undefined {
  let node: THREE.Object3D | null = object;
  while (node) {
    const id: unknown = node.userData[key];
    if (typeof id === "string") return id;
    node = node.parent;
  }
  return undefined;
}
