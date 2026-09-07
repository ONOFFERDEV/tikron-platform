/**
 * H2 character-select carousel + rotating 3D preview (POLISH-EMBERFALL §H, H2).
 *
 * A small, self-contained preview renderer (its own Scene/PerspectiveCamera/lights on a
 * 220×260 canvas) showing one class model at a time, slowly turntable-spinning while its
 * idle clip plays. It shares the game's {@link AssetRegistry} so the class GLBs are fetched
 * once and cached (the same clones the in-game units use). `start-screen.ts` owns the
 * surrounding card; this owns the preview canvas, the ‹ ›/dot switching, and the labels.
 */
import * as THREE from "three";
import type { AssetRegistry, UnitVisual } from "./assets.js";
import type { EmberClass } from "../src/content/hotbar.js";
import { el } from "./dom.js";
import { CLASS_FLAVOR, CLASS_NAMES, CLASS_WEAPON_CHIP } from "./lore.js";

const CLASSES: readonly EmberClass[] = ["warrior", "mage", "cleric"];
const PREVIEW_W = 220;
const PREVIEW_H = 260;
/** Turntable spin rate (rad/s), applied to a wrapper group so it composes with the idle clip. */
const SPIN_RATE = 0.8;

interface PreviewModel {
  turntable: THREE.Group;
  visual: UnitVisual;
}

export interface CharSelectCallbacks {
  /** Fired on construction (default warrior) and every switch — start-screen mirrors this
   *  into its `selectedClass` so the create request still sends the unchanged server id. */
  onSelect(cls: EmberClass): void;
}

export class CharSelectCarousel {
  readonly root: HTMLElement;
  private index = 0;

  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly models = new Map<EmberClass, PreviewModel>();

  private readonly nameEl: HTMLElement;
  private readonly chipEl: HTMLElement;
  private readonly flavorEl: HTMLElement;
  private readonly dots: HTMLButtonElement[];

  private running = true;
  private lastMs = performance.now();

  constructor(
    private readonly assets: AssetRegistry,
    private readonly callbacks: CharSelectCallbacks,
  ) {
    // --- preview renderer: transparent canvas so the card background shows through ---
    const canvas = document.createElement("canvas");
    canvas.className = "charsel-canvas";
    canvas.width = PREVIEW_W;
    canvas.height = PREVIEW_H;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.camera = new THREE.PerspectiveCamera(35, PREVIEW_W / PREVIEW_H, 0.1, 50);
    this.camera.position.set(0, 1.6, 4.5);
    this.camera.lookAt(0, 0.9, 0);

    // Warm ember key + cool sky fill — matches the game's ashen/ember tone, not pastel.
    this.scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x241a12, 1.15));
    const key = new THREE.DirectionalLight(0xffe3bd, 1.7);
    key.position.set(2.5, 4, 3);
    this.scene.add(key);

    // Soft contact shadow disc under the model's feet.
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.01;
    this.scene.add(disc);

    // --- carousel DOM ---
    this.root = el("div", "charsel");

    const stage = el("div", "charsel-stage");
    const prevBtn = arrowButton("‹", () => this.step(-1));
    const nextBtn = arrowButton("›", () => this.step(1));
    stage.append(prevBtn, canvas, nextBtn);

    this.nameEl = el("div", "charsel-name");
    this.chipEl = el("div", "charsel-chip");
    this.flavorEl = el("div", "charsel-flavor");

    const dotRow = el("div", "charsel-dots");
    this.dots = CLASSES.map((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "charsel-dot";
      dot.addEventListener("click", () => this.go(i));
      dotRow.appendChild(dot);
      return dot;
    });

    this.root.append(stage, this.nameEl, this.chipEl, this.flavorEl, dotRow);

    void this.preload();
    this.applySelection();
    requestAnimationFrame(this.frame);
  }

  /** The currently-selected class id (server-facing value is unchanged by the carousel). */
  get current(): EmberClass {
    return CLASSES[this.index]!;
  }

  /** Loads all three preview models once through the shared registry, each parented to a
   *  turntable group so the code-driven spin never fights the idle clip's own root motion. */
  private async preload(): Promise<void> {
    for (const cls of CLASSES) {
      const visual = await this.assets.getUnitVisual(`unit.${cls}`);
      const turntable = new THREE.Group();
      turntable.add(visual.object);
      turntable.visible = cls === this.current;
      this.scene.add(turntable);
      this.models.set(cls, { turntable, visual });
    }
  }

  private step(dir: number): void {
    this.go((this.index + dir + CLASSES.length) % CLASSES.length);
  }

  private go(index: number): void {
    if (index === this.index) return;
    this.index = index;
    this.applySelection();
  }

  private applySelection(): void {
    const cls = this.current;
    for (const [c, m] of this.models) m.turntable.visible = c === cls;
    this.nameEl.textContent = CLASS_NAMES[cls];
    this.chipEl.textContent = CLASS_WEAPON_CHIP[cls];
    this.flavorEl.textContent = CLASS_FLAVOR[cls];
    this.dots.forEach((dot, i) => dot.classList.toggle("charsel-dot-active", i === this.index));
    this.callbacks.onSelect(cls);
  }

  /** Greys out and disables interaction while a create/continue request is in flight. */
  setInteractive(on: boolean): void {
    this.root.classList.toggle("charsel-disabled", !on);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min((now - this.lastMs) / 1000, 0.1);
    this.lastMs = now;
    const model = this.models.get(this.current);
    if (model) {
      model.turntable.rotation.y += dt * SPIN_RATE;
      model.visual.anim.update(dt);
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.frame);
  };

  /** Stops the preview loop and frees the WebGL context (called when the start screen closes). */
  dispose(): void {
    this.running = false;
    this.renderer.dispose();
  }
}

function arrowButton(glyph: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "charsel-arrow";
  btn.textContent = glyph;
  btn.addEventListener("click", onClick);
  return btn;
}
