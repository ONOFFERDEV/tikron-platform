/**
 * viewport.ts — the Three.js side of the tool: renderer/camera/grid,
 * OrbitControls, joint-sphere picking, the rotate/local TransformControls
 * gizmo, the SkeletonHelper overlay toggle, and the original-vs-game-flat
 * material toggle (game verification condition — see README's cited wiki
 * forensics-ladder entry: "검증 렌더는 게임과 동일한 머티리얼로").
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { LoadedRig } from "./rig.js";

const GRID_SIZE = 4;
const GRID_DIVS = 20;

export class Viewport {
  readonly canvas: HTMLCanvasElement;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly orbit: OrbitControls;
  readonly transform: TransformControls;

  private readonly jointMeshes = new Map<string, THREE.Mesh>();
  private modelRoot: THREE.Object3D | undefined;
  private selectedJoint: THREE.Mesh | undefined;
  private skeletonHelper: THREE.SkeletonHelper | undefined;
  private readonly originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private flatMaterialsOn = false;
  private readonly raycaster = new THREE.Raycaster();

  constructor(container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    container.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = new THREE.Color(0x1b1e27);
    this.scene.add(new THREE.GridHelper(GRID_SIZE, GRID_DIVS, 0x3a4050, 0x262a35));
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x33343a, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 3, 2);
    this.scene.add(key);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
    this.camera.position.set(1.4, 1.5, 2.2);

    this.orbit = new OrbitControls(this.camera, this.canvas);
    this.orbit.target.set(0, 0.9, 0);
    this.orbit.enableDamping = true;
    this.orbit.update();

    this.transform = new TransformControls(this.camera, this.canvas);
    this.transform.setMode("rotate");
    this.transform.setSpace("local");
    this.scene.add(this.transform.getHelper());
    // Dragging the gizmo must not also orbit the camera underneath it.
    this.transform.addEventListener("dragging-changed", (e) => {
      this.orbit.enabled = !(e.value as boolean);
    });

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  /** Swaps in a freshly-loaded rig: clears any previous model + joint markers,
   *  adds the new scene graph, and (re)builds joint-picking spheres sized off
   *  the model's own bounding box (so they read sensibly regardless of the
   *  GLB's authored scale). */
  loadRig(rig: LoadedRig): void {
    this.clearJoints();
    if (this.modelRoot) this.scene.remove(this.modelRoot);
    this.scene.add(rig.root);
    this.modelRoot = rig.root;

    this.skeletonHelper?.dispose();
    this.skeletonHelper = new THREE.SkeletonHelper(rig.root);
    this.skeletonHelper.visible = false;
    this.scene.add(this.skeletonHelper);

    rig.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rig.root);
    const size = box.getSize(new THREE.Vector3()).length() || 1;
    const jointRadius = size * 0.012;
    const jointGeo = new THREE.SphereGeometry(jointRadius, 10, 8);
    const jointMat = new THREE.MeshBasicMaterial({ color: 0x59c1ff, depthTest: false, transparent: true, opacity: 0.85 });
    const selectedMat = new THREE.MeshBasicMaterial({ color: 0xffd24a, depthTest: false, transparent: true, opacity: 0.95 });

    for (const [name, bone] of rig.bones) {
      const mesh = new THREE.Mesh(jointGeo, jointMat.clone());
      mesh.renderOrder = 999;
      mesh.userData.boneName = name;
      mesh.userData.selectedMat = selectedMat;
      mesh.userData.normalMat = jointMat;
      bone.add(mesh); // follows the bone's position for free; rotation doesn't matter for a sphere
      this.jointMeshes.set(name, mesh); // flat lookup for raycasting (pickBoneAt) + reset-highlight
    }

    this.recordOriginalMaterials(rig.root);
    this.flatMaterialsOn = false;

    // A SkinnedMesh's default frustum-culling test uses its BIND-POSE local
    // geometry bounds transformed by the mesh node's own (often-identity)
    // matrixWorld — that has nothing to do with where skinning actually
    // deforms the vertices to, so a correctly-posed character can silently
    // vanish (culled) while every joint marker, which follows the bones
    // directly, still renders fine exactly where expected. Disabling culling
    // is the standard fix for animated/skinned rigs.
    rig.root.traverse((node) => {
      if (node instanceof THREE.SkinnedMesh) node.frustumCulled = false;
    });
  }

  private clearJoints(): void {
    for (const mesh of this.jointMeshes.values()) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    this.jointMeshes.clear();
    this.selectedJoint = undefined;
  }

  /** Raycasts the joint spheres from a canvas-space click; returns the hit
   *  bone name, or undefined if the click didn't land on any joint. */
  pickBoneAt(clientX: number, clientY: number): string | undefined {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects([...this.jointMeshes.values()], false);
    return hits[0]?.object.userData.boneName as string | undefined;
  }

  highlightBone(name: string | undefined): void {
    if (this.selectedJoint) {
      const m = this.selectedJoint.userData.normalMat as THREE.Material;
      this.selectedJoint.material = m;
      this.selectedJoint = undefined;
    }
    if (!name) return;
    const mesh = this.jointMeshes.get(name);
    if (!mesh) return;
    mesh.material = mesh.userData.selectedMat as THREE.Material;
    this.selectedJoint = mesh;
  }

  toggleSkeletonHelper(visible: boolean): void {
    if (this.skeletonHelper) this.skeletonHelper.visible = visible;
  }

  /** Swaps every mesh's material for a flat MeshStandardMaterial/FrontSide tint
   *  (the game-verification condition) or restores the GLB's authored
   *  materials, toggled by the same call. */
  setFlatMaterials(on: boolean): void {
    if (on === this.flatMaterialsOn) return;
    this.flatMaterialsOn = on;
    for (const [mesh, original] of this.originalMaterials) {
      if (on) {
        mesh.material = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, roughness: 0.85, metalness: 0, side: THREE.FrontSide });
      } else {
        mesh.material = original;
      }
    }
  }

  private recordOriginalMaterials(root: THREE.Object3D): void {
    this.originalMaterials.clear();
    root.traverse((node) => {
      if (node instanceof THREE.Mesh) this.originalMaterials.set(node, node.material);
    });
  }

  render(): void {
    this.orbit.update();
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const parent = this.canvas.parentElement;
    const w = parent ? parent.clientWidth : window.innerWidth;
    const h = parent ? parent.clientHeight : window.innerHeight;
    this.camera.aspect = w / h || 1;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }
}
