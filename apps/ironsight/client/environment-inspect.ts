import * as T from "three";

import { WW1_ENVIRONMENT_MANIFEST, type EnvironmentAsset } from "../config/ww1-environment.js";
import { acquireEnvironmentModel, cloneEnvironmentModel } from "./dressing-loader.js";
import {
  ENVIRONMENT_INSPECTION_CASES,
  inspectEnvironmentFailure,
  inspectEnvironmentModel,
  isEnvironmentReadable,
  requiresEnvironmentCombatReadability,
  EnvironmentInspectionError,
  type EnvironmentDistanceSample,
  type EnvironmentInspectionCase,
  type EnvironmentModelInspection,
} from "./environment-inspect-contract.js";

type NormalInspection = {
  readonly inputKind: "aside-runtime-inspector";
  readonly ready: true;
  readonly assets: readonly (EnvironmentModelInspection & { readonly views: number })[];
  readonly combatDistance: {
    readonly nearM: number;
    readonly farM: number;
    readonly readable: boolean;
    readonly samples: Readonly<Record<string, readonly EnvironmentDistanceSample[]>>;
  };
};
type FailureInspection = {
  readonly inputKind: "aside-runtime-inspector";
  readonly ready: true;
  readonly failure: ReturnType<typeof inspectEnvironmentFailure>;
};
type UnsupportedInspection = {
  readonly unsupported: true;
  readonly reason: "missing_mount" | "unknown_case";
};

declare global {
  interface Window {
    __environmentInspect?: NormalInspection | FailureInspection | UnsupportedInspection;
  }
}

type RenderContext = {
  readonly renderer: T.WebGLRenderer;
  readonly scene: T.Scene;
  readonly camera: T.PerspectiveCamera;
  readonly target: T.WebGLRenderTarget;
  readonly pixels: Uint8Array;
};

type FrameRequest = {
  readonly context: RenderContext;
  readonly root: T.Object3D;
  readonly distance: number;
  readonly angle: number;
};

type ViewRequest = {
  readonly context: RenderContext;
  readonly gallery: HTMLElement;
  readonly asset: EnvironmentAsset;
  readonly root: T.Object3D;
};

function inspectionCase(): EnvironmentInspectionCase | undefined {
  const value = new URLSearchParams(location.search).get("environment-case") ?? "normal";
  return ENVIRONMENT_INSPECTION_CASES.find((candidate) => candidate === value);
}

function createGallery(mount: HTMLElement): HTMLElement {
  mount.replaceChildren();
  const gallery = document.createElement("main");
  gallery.style.cssText = "display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;background:#171b20;padding:6px;min-height:100vh";
  mount.append(gallery);
  return gallery;
}

function createRenderContext(): RenderContext {
  const renderer = new T.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(240, 150, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight(0xdbe8ff, 0x332719, 2.4));
  const key = new T.DirectionalLight(0xffd6a0, 3.5);
  key.position.set(4, 7, 5);
  scene.add(key);
  const camera = new T.PerspectiveCamera(48, 240 / 150, 0.01, 100);
  const target = new T.WebGLRenderTarget(128, 128, { depthBuffer: true });
  return { renderer, scene, camera, target, pixels: new Uint8Array(128 * 128 * 4) };
}

function frameModel({ context, root, distance, angle }: FrameRequest): void {
  const bounds = new T.Box3().setFromObject(root, true);
  const center = bounds.getCenter(new T.Vector3());
  const radians = T.MathUtils.degToRad(angle);
  context.camera.position.set(
    center.x + Math.sin(radians) * distance,
    center.y + distance * 0.32,
    center.z + Math.cos(radians) * distance,
  );
  context.camera.lookAt(center);
  context.camera.updateMatrixWorld(true);
}

function visiblePixels(context: RenderContext, root: T.Object3D, distance: number): number {
  frameModel({ context, root, distance, angle: 25 });
  context.renderer.setRenderTarget(context.target);
  context.renderer.clear();
  context.renderer.render(context.scene, context.camera);
  context.renderer.readRenderTargetPixels(context.target, 0, 0, 128, 128, context.pixels);
  context.renderer.setRenderTarget(null);
  let visible = 0;
  for (let index = 3; index < context.pixels.length; index += 4) if ((context.pixels[index] ?? 0) > 0) visible += 1;
  return visible;
}

function renderViews({ context, gallery, asset, root }: ViewRequest): number {
  const radius = Math.max(...asset.dimensionsM) * 1.65;
  let views = 0;
  for (const angle of [25, 115, 205, 295]) {
    frameModel({ context, root, distance: radius, angle });
    context.renderer.clear();
    context.renderer.render(context.scene, context.camera);
    const figure = document.createElement("figure");
    figure.style.cssText = "margin:0;color:#f2e6ca;font:12px system-ui";
    const image = document.createElement("img");
    image.src = context.renderer.domElement.toDataURL("image/png");
    image.alt = `${asset.key} ${angle} degrees`;
    image.style.cssText = "display:block;width:100%;background:#c8cdd2";
    const label = document.createElement("figcaption");
    label.textContent = `${asset.key} / ${angle}°`;
    figure.append(image, label);
    gallery.append(figure);
    views += 1;
  }
  return views;
}

async function inspectNormal(mount: HTMLElement): Promise<NormalInspection> {
  const gallery = createGallery(mount);
  const context = createRenderContext();
  const assets: Array<EnvironmentModelInspection & { readonly views: number }> = [];
  const samples: Record<string, readonly EnvironmentDistanceSample[]> = {};
  try {
    for (const asset of WW1_ENVIRONMENT_MANIFEST.assets) {
      const lease = acquireEnvironmentModel(asset.publicUrl);
      try {
        const gltf = await lease.value;
        if (gltf === undefined) {
          assets.push({ key: asset.key, loaded: false, boundsValid: false, socketsValid: false, views: 0 });
          samples[asset.key] = [];
          continue;
        }
        const instance = cloneEnvironmentModel(gltf);
        try {
          context.scene.add(instance.object);
          const model = inspectEnvironmentModel(asset, instance.object);
          const distanceSamples = [5, 40].map((distanceM) => ({
            distanceM,
            visiblePixels: visiblePixels(context, instance.object, distanceM),
          }));
          samples[asset.key] = distanceSamples;
          assets.push({ ...model, views: renderViews({ context, gallery, asset, root: instance.object }) });
        } finally {
          context.scene.remove(instance.object);
          instance.dispose();
        }
      } finally {
        lease.release();
      }
    }
  } finally {
    context.target.dispose();
    context.renderer.dispose();
  }
  const readable = WW1_ENVIRONMENT_MANIFEST.assets
    .filter(requiresEnvironmentCombatReadability)
    .every((asset) => isEnvironmentReadable(samples[asset.key] ?? []));
  return {
    inputKind: "aside-runtime-inspector",
    ready: true,
    assets,
    combatDistance: { nearM: 5, farM: 40, readable, samples },
  };
}

export async function startEnvironmentInspector(): Promise<void> {
  const mount = document.querySelector<HTMLElement>("#app");
  if (mount === null) {
    window.__environmentInspect = { unsupported: true, reason: "missing_mount" };
    return;
  }
  const caseName = inspectionCase();
  if (caseName === undefined) {
    window.__environmentInspect = { unsupported: true, reason: "unknown_case" };
    return;
  }
  switch (caseName) {
    case "normal":
      window.__environmentInspect = await inspectNormal(mount);
      return;
    case "bad-scale":
    case "invalid-surface":
    case "blocked-doorway":
      mount.textContent = `${caseName}: manifest rejection probe complete`;
      window.__environmentInspect = {
        inputKind: "aside-runtime-inspector",
        ready: true,
        failure: inspectEnvironmentFailure(caseName),
      };
      return;
    default:
      throw new EnvironmentInspectionError("unsupported_case", String(caseName satisfies never));
  }
}
