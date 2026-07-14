/**
 * main.ts — rig-editor entry point. Owns all mutable editor state and the
 * render loop; rig.ts/keyframes.ts/export.ts/viewport.ts/ui.ts are pure
 * building blocks wired together here.
 *
 * Drag lifecycle (the tricky part — see rig.ts's header for the composition
 * math): TransformControls is attached directly to the selected THREE.Bone.
 * `mixer.update()`/`setTime()` are only ever called from this file, and never
 * while `viewport.transform.dragging` is true, so a live gizmo drag always
 * owns the bone's quaternion uncontested. On drag end, the resulting
 * quaternion is read back and routed to either the global correction map or
 * the selected keyframe, depending on `keySelection`.
 */
import * as THREE from "three";
import { Viewport } from "./viewport.js";
import { RigUi, type Callbacks } from "./ui.js";
import { loadRigFromFile, composeCorrections, type LoadedRig, type CorrectionMap, type BaseQuatCache } from "./rig.js";
import { listKeyTicks, findKeyIndexAtTime, findQuaternionTrack, readKeyQuaternion, writeKeyQuaternion, keyEditId } from "./keyframes.js";
import { buildCorrectionJson, downloadText, exportBakedGlb } from "./export.js";
import { UndoStack } from "./undo.js";
import { runGenerate } from "./generate.js";

const app = document.getElementById("app");
if (!app) throw new Error("#app mount point missing");

// --- state ------------------------------------------------------------------

let rig: LoadedRig | undefined;
let selectedBone: string | undefined;
let activeClipIndex = 0;
let activeAction: THREE.AnimationAction | undefined;
let playing = false;
let loop = true;
let speed = 1;
let pendingBaseRefresh = false;
/** Client-side guard against double-submitting Generate — the server's own
 *  409 lock is authoritative; this just avoids firing a request we already
 *  know will bounce. */
let generating = false;

/** Set right when a drag starts, from mouseDown — kept only for symmetry/
 *  documentation; the actual delta is derived from the bone's live quaternion
 *  at mouseUp time, which already reflects the whole drag. */
let dragStartQuat: THREE.Quaternion | undefined;

interface KeySelection {
  clipIndex: number;
  boneName: string;
  keyIndex: number;
  time: number;
}
let keySelection: KeySelection | undefined;

const corrections: CorrectionMap = new Map();
const baseCache: BaseQuatCache = new Map();
/** `${clipName}::${boneName}` -> set of edited key indices, for tick coloring. */
const editedKeys = new Map<string, Set<number>>();
const undoStack = new UndoStack();
const clock = new THREE.Clock();

// --- helpers ------------------------------------------------------------------

function seekTo(time: number): void {
  if (!rig) return;
  rig.mixer.setTime(time);
  pendingBaseRefresh = true;
}

function refreshBoneInfo(): void {
  if (!rig || !selectedBone) {
    ui.setBoneInfo("(none)");
    return;
  }
  const node = rig.boneGraph.get(selectedBone);
  const bone = rig.bones.get(selectedBone);
  if (!node || !bone) return;
  const e = new THREE.Euler().setFromQuaternion(bone.quaternion, "XYZ");
  const deg = (r: number): string => ((r * 180) / Math.PI).toFixed(1);
  const corr = corrections.get(selectedBone);
  const corrText = corr
    ? `correction: [${corr.x.toFixed(3)}, ${corr.y.toFixed(3)}, ${corr.z.toFixed(3)}, ${corr.w.toFixed(3)}]`
    : "correction: (none)";
  const keyText = keySelection && keySelection.boneName === selectedBone
    ? `\nediting key #${keySelection.keyIndex} @ t=${keySelection.time.toFixed(3)}s`
    : "";
  ui.setBoneInfo(`${selectedBone}\nparent: ${node.parent ?? "(root)"}\nlocal euler: x=${deg(e.x)} y=${deg(e.y)} z=${deg(e.z)}\n${corrText}${keyText}`);
}

function refreshKeyTicks(): void {
  if (!rig || !selectedBone) {
    ui.setKeyTicks([], 0, new Set(), undefined);
    return;
  }
  const clip = rig.clips[activeClipIndex];
  if (!clip) {
    ui.setKeyTicks([], 0, new Set(), undefined);
    return;
  }
  const ticks = listKeyTicks(clip, selectedBone);
  const edited = editedKeys.get(`${clip.name}::${selectedBone}`) ?? new Set<number>();
  const active = keySelection && keySelection.boneName === selectedBone && keySelection.clipIndex === activeClipIndex
    ? keySelection.keyIndex
    : undefined;
  ui.setKeyTicks(ticks, clip.duration, edited, active);
}

function markEdited(clipName: string, boneName: string, index: number): void {
  const k = `${clipName}::${boneName}`;
  let set = editedKeys.get(k);
  if (!set) {
    set = new Set();
    editedKeys.set(k, set);
  }
  set.add(index);
}

function selectBone(name: string): void {
  if (!rig) return;
  selectedBone = name;
  keySelection = undefined;
  const bone = rig.bones.get(name);
  if (bone) viewport.transform.attach(bone);
  viewport.highlightBone(name);
  ui.renderBoneTree(rig.rootBoneNames, rig.boneGraph, name);
  ui.setKeySelectionActive(false);
  refreshBoneInfo();
  refreshKeyTicks();
}

function applyCorrectionDelta(boneName: string, delta: THREE.Quaternion): void {
  const oldForUndo = corrections.get(boneName)?.clone();
  const updated = (oldForUndo ?? new THREE.Quaternion()).clone().multiply(delta);
  corrections.set(boneName, updated);
  undoStack.push({
    undo: () => {
      if (oldForUndo) corrections.set(boneName, oldForUndo);
      else corrections.delete(boneName);
    },
    redo: () => corrections.set(boneName, updated),
  });
  ui.setUndoRedoEnabled(undoStack.canUndo, undoStack.canRedo);
}

/** Writes the dragged pose into the selected key. Since the bone was posed
 *  directly by TransformControls while paused at that key's exact time (see
 *  file header), `endQuat` already equals `base * existingCorrection` (if a
 *  global correction is also active for this bone) — so the value stored in
 *  the track must have the correction backed OUT (`endQuat * correction^-1`),
 *  otherwise it would be double-applied the next time the correction layer
 *  composes on top of this key at runtime/export. */
function applyKeyEdit(sel: KeySelection, endQuat: THREE.Quaternion): void {
  if (!rig) return;
  const clip = rig.clips[sel.clipIndex];
  if (!clip) return;
  const track = findQuaternionTrack(clip, sel.boneName);
  if (!track) return;
  const corr = corrections.get(sel.boneName);
  const newBase = corr ? endQuat.clone().multiply(corr.clone().invert()) : endQuat.clone();
  const oldValue = readKeyQuaternion(track, sel.keyIndex);

  writeKeyQuaternion(track, sel.keyIndex, newBase);
  markEdited(clip.name, sel.boneName, sel.keyIndex);
  undoStack.push({
    undo: () => {
      writeKeyQuaternion(track, sel.keyIndex, oldValue);
      seekTo(sel.time);
    },
    redo: () => {
      writeKeyQuaternion(track, sel.keyIndex, newBase);
      seekTo(sel.time);
    },
  });
  ui.setUndoRedoEnabled(undoStack.canUndo, undoStack.canRedo);
  seekTo(sel.time); // force the mixer to re-sample the just-mutated track values
  refreshKeyTicks();
}

function selectClip(index: number): void {
  if (!rig) return;
  activeAction?.stop();
  activeClipIndex = index;
  const clip = rig.clips[index];
  if (!clip) {
    activeAction = undefined;
    return;
  }
  activeAction = rig.mixer.clipAction(clip);
  activeAction.reset();
  activeAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  activeAction.clampWhenFinished = true;
  activeAction.play();
  playing = false;
  ui.setPlaying(false);
  seekTo(0);
  keySelection = undefined;
  ui.setKeySelectionActive(false);
  refreshKeyTicks();
}

// --- UI callbacks ------------------------------------------------------------

async function loadFile(file: File): Promise<void> {
  try {
    const loaded = await loadRigFromFile(file);
    rig = loaded;
    corrections.clear();
    baseCache.clear();
    editedKeys.clear();
    keySelection = undefined;
    undoStack.clear();
    selectedBone = undefined;
    activeAction = undefined;

    viewport.loadRig(loaded);
    viewport.transform.detach();
    ui.renderBoneTree(loaded.rootBoneNames, loaded.boneGraph, undefined);
    ui.setClipList(loaded.clips.map((c) => c.name), 0);
    ui.setUndoRedoEnabled(false, false);
    ui.setKeySelectionActive(false);
    refreshBoneInfo();

    if (loaded.clips.length) selectClip(0);
    else refreshKeyTicks();
  } catch (err) {
    console.error("[rig-editor] failed to load GLB", err);
    alert(`Failed to load GLB: ${err instanceof Error ? err.message : String(err)}`);
  }
}

const callbacks: Callbacks = {
  onFiles(files) {
    const arr = Array.from(files);
    const glb = arr.find((f) => f.name.toLowerCase().endsWith(".glb")) ?? arr[0];
    if (glb) void loadFile(glb);
  },
  onBoneSelect(name) {
    selectBone(name);
  },
  onClipSelect(index) {
    selectClip(index);
  },
  onPlayPause() {
    if (!rig || !activeAction) return;
    playing = !playing;
    ui.setPlaying(playing);
  },
  onLoopToggle(on) {
    loop = on;
    activeAction?.setLoop(on ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  },
  onSpeedChange(s) {
    speed = s;
  },
  onScrubInput(t01) {
    if (!rig || !activeAction) return;
    playing = false;
    ui.setPlaying(false);
    const duration = activeAction.getClip().duration;
    seekTo(t01 * duration);
    keySelection = undefined;
    ui.setKeySelectionActive(false);
    refreshKeyTicks();
  },
  onSkeletonToggle(on) {
    viewport.toggleSkeletonHelper(on);
  },
  onMaterialToggle(on) {
    viewport.setFlatMaterials(on);
  },
  onResetBone() {
    if (!selectedBone || !corrections.has(selectedBone)) return;
    const name = selectedBone;
    const old = corrections.get(name)!;
    corrections.delete(name);
    undoStack.push({ undo: () => corrections.set(name, old), redo: () => corrections.delete(name) });
    ui.setUndoRedoEnabled(undoStack.canUndo, undoStack.canRedo);
  },
  onResetAll() {
    if (corrections.size === 0) return;
    const snapshot = new Map(corrections);
    corrections.clear();
    undoStack.push({
      undo: () => {
        corrections.clear();
        for (const [k, v] of snapshot) corrections.set(k, v);
      },
      redo: () => corrections.clear(),
    });
    ui.setUndoRedoEnabled(undoStack.canUndo, undoStack.canRedo);
  },
  onUndo() {
    undoStack.undo();
    ui.setUndoRedoEnabled(undoStack.canUndo, undoStack.canRedo);
    refreshKeyTicks();
  },
  onRedo() {
    undoStack.redo();
    ui.setUndoRedoEnabled(undoStack.canUndo, undoStack.canRedo);
    refreshKeyTicks();
  },
  onExportJson() {
    if (!rig) return;
    downloadText(`${rig.fileName.replace(/\.glb$/i, "")}-corrections.json`, buildCorrectionJson(corrections), "application/json");
  },
  onExportGlb() {
    if (!rig) return;
    void exportBakedGlb(rig, corrections);
  },
  onKeyTickClick(time) {
    if (!rig || !selectedBone) return;
    playing = false;
    ui.setPlaying(false);
    seekTo(time);
    const clip = rig.clips[activeClipIndex];
    if (!clip) return;
    const idx = findKeyIndexAtTime(clip, selectedBone, time);
    if (idx === undefined) return;
    keySelection = { clipIndex: activeClipIndex, boneName: selectedBone, keyIndex: idx, time };
    ui.setKeySelectionActive(true);
    refreshBoneInfo();
    refreshKeyTicks();
  },
  onClearKeySelection() {
    keySelection = undefined;
    ui.setKeySelectionActive(false);
    refreshBoneInfo();
    refreshKeyTicks();
  },
  onGenerate(params) {
    if (generating) return;
    generating = true;
    ui.setGenerating(true);
    ui.clearGenerateLog();
    void runGenerate(params, {
      onLog: (line) => ui.appendGenerateLog(line),
      onError: (message) => ui.setGenerateError(message),
    }).then((file) => {
      generating = false;
      ui.setGenerating(false);
      if (file) void loadFile(file);
    });
  },
};

// --- viewport + ui construction -------------------------------------------------

const ui = new RigUi(app, callbacks);
const viewport = new Viewport(ui.viewportEl);

viewport.transform.addEventListener("mouseDown", () => {
  if (!rig || !selectedBone) return;
  const bone = rig.bones.get(selectedBone);
  if (bone) dragStartQuat = bone.quaternion.clone();
});

viewport.transform.addEventListener("mouseUp", () => {
  if (!rig || !selectedBone || !dragStartQuat) return;
  const bone = rig.bones.get(selectedBone);
  if (!bone) return;
  const startQuat = dragStartQuat;
  dragStartQuat = undefined;
  const endQuat = bone.quaternion.clone();
  const delta = startQuat.clone().invert().multiply(endQuat);

  if (keySelection && keySelection.boneName === selectedBone) {
    applyKeyEdit(keySelection, endQuat);
  } else {
    applyCorrectionDelta(selectedBone, delta);
  }
  refreshBoneInfo();
});

// Joint-sphere picking: a plain click (not an orbit-drag, not a gizmo drag)
// selects the bone under the pointer.
let pointerDownAt: { x: number; y: number } | undefined;
viewport.canvas.addEventListener("pointerdown", (e) => {
  pointerDownAt = { x: e.clientX, y: e.clientY };
});
viewport.canvas.addEventListener("pointerup", (e) => {
  const down = pointerDownAt;
  pointerDownAt = undefined;
  if (!down || !rig || viewport.transform.dragging) return;
  if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return; // was an orbit drag
  const name = viewport.pickBoneAt(e.clientX, e.clientY);
  if (name) selectBone(name);
});

// --- headless-test hook -------------------------------------------------------
// Test-only bridge for the puppeteer smoke test: drives the exact same
// applyCorrectionDelta/applyKeyEdit code paths a real TransformControls drag's
// mouseUp handler uses, without needing to simulate mouse-pixel deltas against
// a 3D gizmo (that would exercise three.js's own widget math, not this tool's
// logic). No production UI reads or depends on this; harmless if unused.
interface RigEditorTestHook {
  applyCorrectionDegrees(boneName: string, xDeg: number, yDeg: number, zDeg: number): void;
  applyKeyEditDegrees(xDeg: number, yDeg: number, zDeg: number): boolean;
  getState(): {
    selectedBone: string | undefined;
    hasCorrection: boolean;
    keySelection: KeySelection | undefined;
    editedKeyCount: number;
    clipCount: number;
    boneCount: number;
  };
}
(window as unknown as { __rigEditorTest: RigEditorTestHook }).__rigEditorTest = {
  applyCorrectionDegrees(boneName, xDeg, yDeg, zDeg) {
    const e = new THREE.Euler((xDeg * Math.PI) / 180, (yDeg * Math.PI) / 180, (zDeg * Math.PI) / 180, "XYZ");
    applyCorrectionDelta(boneName, new THREE.Quaternion().setFromEuler(e));
    refreshBoneInfo();
  },
  applyKeyEditDegrees(xDeg, yDeg, zDeg) {
    if (!rig || !keySelection) return false;
    const bone = rig.bones.get(keySelection.boneName);
    if (!bone) return false;
    const e = new THREE.Euler((xDeg * Math.PI) / 180, (yDeg * Math.PI) / 180, (zDeg * Math.PI) / 180, "XYZ");
    const endQuat = bone.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(e));
    applyKeyEdit(keySelection, endQuat);
    return true;
  },
  getState() {
    let editedKeyCount = 0;
    for (const set of editedKeys.values()) editedKeyCount += set.size;
    return {
      selectedBone,
      hasCorrection: selectedBone ? corrections.has(selectedBone) : false,
      keySelection: keySelection ? { ...keySelection } : undefined,
      editedKeyCount,
      clipCount: rig ? rig.clips.length : 0,
      boneCount: rig ? rig.bones.size : 0,
    };
  },
};

// --- render loop ------------------------------------------------------------

function frame(): void {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (rig) {
    const dragging = viewport.transform.dragging;
    let refreshBase = false;
    if (playing && !dragging) {
      rig.mixer.update(dt * speed);
      refreshBase = true;
    }
    if (pendingBaseRefresh) {
      refreshBase = true;
      pendingBaseRefresh = false;
    }
    composeCorrections(rig.bones, corrections, baseCache, refreshBase, dragging ? selectedBone : undefined);

    if (activeAction) {
      const duration = activeAction.getClip().duration;
      if (duration > 0) ui.setScrubPosition(activeAction.time / duration);
    }
    if (selectedBone) refreshBoneInfo();
  }

  viewport.render();
}

frame();
