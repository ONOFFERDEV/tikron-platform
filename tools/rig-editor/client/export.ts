/**
 * export.ts — the two M1 export paths: the sparse correction JSON, and the
 * baked GLB (every clip's per-bone quaternion keys re-written with the global
 * correction composed in, on top of whatever M2 key edits already changed).
 *
 * Known limitation (see README "알려진 함정"): GLTFExporter's round trip loses
 * KHR_mesh_quantization, so the baked GLB is larger than a quantized source —
 * the UI surfaces a "re-quantize before shipping" notice next to the button
 * rather than silently producing a bigger file.
 */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { LoadedRig, CorrectionMap } from "./rig.js";
import { findQuaternionTrack } from "./keyframes.js";

/** `{ "boneName": [x,y,z,w], ... }` — only bones with a non-identity
 *  correction are included, matching "sparse override" consumption by
 *  retarget_clips.py (identity elsewhere is the implicit default). */
export function buildCorrectionJson(corrections: CorrectionMap): string {
  const out: Record<string, [number, number, number, number]> = {};
  for (const [name, q] of corrections) {
    if (q.x === 0 && q.y === 0 && q.z === 0 && q.w === 1) continue;
    out[name] = [q.x, q.y, q.z, q.w];
  }
  return JSON.stringify(out, null, 2);
}

export function downloadText(fileName: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  triggerDownload(fileName, blob);
}

function triggerDownload(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Bakes `corrections` into a deep clone of every clip's per-bone quaternion
 * track (post-multiplying each stored key, same order as the live runtime
 * composition in rig.ts's composeCorrections), resets the live skeleton to
 * its original bind pose for the duration of the export (so a paused mid-clip
 * pose is never baked in as the rest transform — see LoadedRig.bindQuats),
 * and hands the result to GLTFExporter. The live editor pose is restored
 * immediately after, so clicking export doesn't visibly disturb the viewport.
 */
export async function exportBakedGlb(rig: LoadedRig, corrections: CorrectionMap): Promise<void> {
  const bakedClips = rig.clips.map((clip) => {
    const baked = clip.clone();
    for (const [boneName, corr] of corrections) {
      if (corr.x === 0 && corr.y === 0 && corr.z === 0 && corr.w === 1) continue;
      const track = findQuaternionTrack(baked, boneName);
      if (!track) continue;
      const q = new THREE.Quaternion();
      for (let i = 0; i < track.times.length; i++) {
        const o = i * 4;
        q.set(track.values[o]!, track.values[o + 1]!, track.values[o + 2]!, track.values[o + 3]!);
        q.multiply(corr); // POST-multiply — matches composeCorrections' base * correction
        track.values[o] = q.x;
        track.values[o + 1] = q.y;
        track.values[o + 2] = q.z;
        track.values[o + 3] = q.w;
      }
    }
    return baked;
  });

  const liveSnapshot = new Map<string, THREE.Quaternion>();
  for (const [name, bone] of rig.bones) {
    liveSnapshot.set(name, bone.quaternion.clone());
    const bind = rig.bindQuats.get(name);
    if (bind) bone.quaternion.copy(bind);
  }
  rig.root.updateMatrixWorld(true);

  try {
    const result = await new GLTFExporter().parseAsync(rig.root, {
      binary: true,
      animations: bakedClips,
    });
    if (!(result instanceof ArrayBuffer)) throw new Error("GLTFExporter did not return a binary GLB buffer");
    const base = rig.fileName.replace(/\.glb$/i, "");
    triggerDownload(`${base}-edited.glb`, new Blob([result], { type: "model/gltf-binary" }));
  } finally {
    for (const [name, bone] of rig.bones) {
      const snap = liveSnapshot.get(name);
      if (snap) bone.quaternion.copy(snap);
    }
    rig.root.updateMatrixWorld(true);
  }
}
