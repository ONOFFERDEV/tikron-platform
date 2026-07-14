/**
 * ui.ts — plain-DOM chrome around the viewport: the file drop zone, bone tree
 * panel, selected-bone/correction panel, playback bar (clip/play/loop/speed/
 * scrub + M2 keyframe ticks), and the export/undo/reset buttons. Pure
 * presentation, driven by main.ts via the `Callbacks` bag — mirrors
 * apps/ironsight/client/hud.ts's css-in-JS + `el()` convention.
 */
import type { BoneNode } from "./rig.js";
import type { KeyTick } from "./keyframes.js";
import { slugify, type GenerateParams } from "./generate.js";

const css = `
#rig-ui { position: fixed; inset: 0; display: grid; grid-template-columns: 240px 1fr 300px; grid-template-rows: 1fr 96px; font: 12px/1.4 ui-monospace, "SF Mono", Menlo, monospace; color: #dfe4ee; }
#rig-viewport { grid-column: 2; grid-row: 1; position: relative; min-width: 0; min-height: 0; }
#rig-bones { grid-column: 1; grid-row: 1 / span 2; background: #171a22; overflow-y: auto; padding: 8px; border-right: 1px solid #2a2f3a; }
#rig-side { grid-column: 3; grid-row: 1 / span 2; background: #171a22; overflow-y: auto; padding: 10px; border-left: 1px solid #2a2f3a; }
#rig-bottom { grid-column: 2; grid-row: 2; background: #171a22; border-top: 1px solid #2a2f3a; padding: 6px 10px; display: flex; flex-direction: column; gap: 4px; justify-content: center; }
#rig-ui h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.6; margin: 10px 0 4px; }
#rig-ui h2:first-child { margin-top: 0; }
#rig-ui button { font: inherit; background: #262c3a; color: #dfe4ee; border: 1px solid #3a4152; border-radius: 4px; padding: 4px 8px; cursor: pointer; }
#rig-ui button:hover { background: #303849; }
#rig-ui button:disabled { opacity: 0.4; cursor: default; }
#rig-ui button.primary { background: #3a6ea8; border-color: #4c85c4; }
#rig-ui select, #rig-ui input[type=range] { font: inherit; }
#rig-ui .row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
#rig-drop { border: 2px dashed #3a4152; border-radius: 8px; padding: 14px; text-align: center; opacity: 0.85; }
#rig-drop.over { border-color: #59c1ff; background: rgba(89,193,255,0.08); }
#bone-tree { list-style: none; margin: 0; padding: 0; }
#bone-tree li { margin: 0; }
#bone-tree .row-item { padding: 2px 4px; border-radius: 3px; cursor: pointer; white-space: nowrap; }
#bone-tree .row-item:hover { background: #232938; }
#bone-tree .row-item.selected { background: #3a6ea8; color: #fff; }
#bone-info { font-size: 11px; opacity: 0.9; white-space: pre-line; }
#scrub-wrap { position: relative; }
#scrub { width: 100%; }
#ticks { position: absolute; left: 0; right: 0; top: 0; height: 100%; pointer-events: none; }
#ticks i { position: absolute; top: 2px; width: 2px; height: 12px; background: #6a7690; pointer-events: auto; cursor: pointer; }
#ticks i.edited { background: #ffd24a; }
#ticks i.active { background: #59c1ff; width: 3px; }
#quantize-note { font-size: 10px; opacity: 0.65; margin-top: 4px; }
#rig-ui textarea, #rig-ui input[type=text], #rig-ui input[type=number] { font: inherit; background: #12151c; color: #dfe4ee; border: 1px solid #3a4152; border-radius: 4px; padding: 4px 6px; width: 100%; box-sizing: border-box; }
#gen-prompt { resize: vertical; min-height: 40px; }
#gen-fields label.inline { display: flex; flex-direction: column; gap: 2px; font-size: 11px; opacity: 0.8; flex: 1; }
#gen-log { background: #0d0f14; border: 1px solid #2a2f3a; border-radius: 4px; padding: 6px; font-size: 10.5px; height: 130px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
#gen-error { color: #e08a6a; font-size: 11px; white-space: pre-wrap; }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, id?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (id) e.id = id;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export interface Callbacks {
  onFiles(files: FileList | File[]): void;
  onBoneSelect(name: string): void;
  onClipSelect(index: number): void;
  onPlayPause(): void;
  onLoopToggle(on: boolean): void;
  onSpeedChange(speed: number): void;
  onScrubInput(t01: number): void;
  onSkeletonToggle(on: boolean): void;
  onMaterialToggle(on: boolean): void;
  onResetBone(): void;
  onResetAll(): void;
  onUndo(): void;
  onRedo(): void;
  onExportJson(): void;
  onExportGlb(): void;
  onKeyTickClick(time: number): void;
  onClearKeySelection(): void;
  onGenerate(params: GenerateParams): void;
}

export class RigUi {
  readonly viewportEl: HTMLElement;
  private readonly bonesEl: HTMLElement;
  private readonly sideEl: HTMLElement;
  private readonly dropEl: HTMLElement;
  private readonly fileInput: HTMLInputElement;
  private readonly boneInfoEl: HTMLElement;
  private readonly clipSelect: HTMLSelectElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly loopCheck: HTMLInputElement;
  private readonly speedBtns: HTMLButtonElement[];
  private readonly scrub: HTMLInputElement;
  private readonly ticksEl: HTMLElement;
  private readonly undoBtn: HTMLButtonElement;
  private readonly redoBtn: HTMLButtonElement;
  private readonly clearKeyBtn: HTMLButtonElement;
  private readonly genPromptEl: HTMLTextAreaElement;
  private readonly genNameEl: HTMLInputElement;
  private readonly genSeedEl: HTMLInputElement;
  private readonly genBackendEl: HTMLSelectElement;
  private readonly genSlimEl: HTMLInputElement;
  private readonly genBtn: HTMLButtonElement;
  private readonly genLogEl: HTMLElement;
  private readonly genErrorEl: HTMLElement;
  private readonly cb: Callbacks;
  private scrubbing = false;
  /** Once the user hand-edits the name field, prompt changes stop overwriting it. */
  private genNameTouched = false;

  constructor(container: HTMLElement, cb: Callbacks) {
    this.cb = cb;
    const style = el("style");
    style.textContent = css;
    document.head.appendChild(style);

    const root = el("div", "rig-ui");

    // --- left: bone tree ---
    this.bonesEl = el("div", "rig-bones");
    this.bonesEl.appendChild(el("h2", undefined, "Bones"));
    root.appendChild(this.bonesEl);

    // --- center: viewport mount ---
    this.viewportEl = el("div", "rig-viewport");
    root.appendChild(this.viewportEl);

    // --- right: side panel ---
    this.sideEl = el("div", "rig-side");

    this.sideEl.appendChild(el("h2", undefined, "Generate"));
    this.genPromptEl = el("textarea", "gen-prompt");
    this.genPromptEl.placeholder = "armored space marine, battle-worn, ...";
    this.genPromptEl.addEventListener("input", () => {
      if (!this.genNameTouched) this.genNameEl.value = slugify(this.genPromptEl.value);
    });
    this.sideEl.appendChild(this.genPromptEl);

    const genFields = el("div", "gen-fields"); genFields.className = "row";
    const nameLabel = el("label"); nameLabel.className = "inline";
    nameLabel.append("name");
    this.genNameEl = el("input"); this.genNameEl.type = "text"; this.genNameEl.placeholder = "auto from prompt";
    this.genNameEl.addEventListener("input", () => { this.genNameTouched = this.genNameEl.value.length > 0; });
    nameLabel.appendChild(this.genNameEl);

    const seedLabel = el("label"); seedLabel.className = "inline";
    seedLabel.append("seed");
    this.genSeedEl = el("input"); this.genSeedEl.type = "number"; this.genSeedEl.placeholder = "random";
    seedLabel.appendChild(this.genSeedEl);
    genFields.append(nameLabel, seedLabel);
    this.sideEl.appendChild(genFields);

    const genFields2 = el("div", undefined); genFields2.className = "row";
    const backendLabel = el("label"); backendLabel.className = "inline";
    backendLabel.append("backend");
    this.genBackendEl = el("select", "gen-backend");
    this.genBackendEl.append(el("option", undefined, "hunyuan"), el("option", undefined, "trellis"));
    backendLabel.appendChild(this.genBackendEl);
    const slimLabel = el("label");
    this.genSlimEl = el("input"); this.genSlimEl.type = "checkbox";
    slimLabel.append(this.genSlimEl, document.createTextNode(" game-slim"));
    genFields2.append(backendLabel, slimLabel);
    this.sideEl.appendChild(genFields2);

    this.genBtn = el("button", "generate-btn", "Generate");
    this.genBtn.className = "primary";
    this.genBtn.addEventListener("click", () => {
      const prompt = this.genPromptEl.value.trim();
      const name = this.genNameEl.value.trim() || slugify(prompt);
      const seedRaw = this.genSeedEl.value.trim();
      cb.onGenerate({
        prompt,
        name,
        seed: seedRaw ? Number(seedRaw) : undefined,
        backend: this.genBackendEl.value === "trellis" ? "trellis" : "hunyuan",
        gameSlim: this.genSlimEl.checked,
      });
    });
    this.sideEl.appendChild(this.genBtn);

    this.genErrorEl = el("div", "gen-error");
    this.sideEl.appendChild(this.genErrorEl);
    this.genLogEl = el("div", "gen-log");
    this.sideEl.appendChild(this.genLogEl);

    this.sideEl.appendChild(el("h2", undefined, "Load"));
    this.dropEl = el("div", "rig-drop", "Drag &amp; drop a GLB here");
    this.fileInput = el("input", "file-input");
    this.fileInput.type = "file";
    this.fileInput.accept = ".glb";
    this.fileInput.style.display = "none";
    const pickBtn = el("button", undefined, "Choose file…");
    pickBtn.addEventListener("click", () => this.fileInput.click());
    this.fileInput.addEventListener("change", () => {
      if (this.fileInput.files?.length) this.cb.onFiles(this.fileInput.files);
    });
    this.dropEl.appendChild(document.createElement("br"));
    this.dropEl.appendChild(pickBtn);
    this.sideEl.appendChild(this.dropEl);
    this.sideEl.appendChild(this.fileInput);
    this.wireDropZone();

    this.sideEl.appendChild(el("h2", undefined, "View"));
    const viewRow = el("div"); viewRow.className = "row";
    const skelLabel = el("label"); const skelCheck = el("input"); skelCheck.type = "checkbox";
    skelCheck.addEventListener("change", () => cb.onSkeletonToggle(skelCheck.checked));
    skelLabel.append(skelCheck, document.createTextNode(" skeleton"));
    const matLabel = el("label"); const matCheck = el("input"); matCheck.type = "checkbox";
    matCheck.addEventListener("change", () => cb.onMaterialToggle(matCheck.checked));
    matLabel.append(matCheck, document.createTextNode(" game material"));
    viewRow.append(skelLabel, matLabel);
    this.sideEl.appendChild(viewRow);

    this.sideEl.appendChild(el("h2", undefined, "Selected bone"));
    this.boneInfoEl = el("div", "bone-info", "(none)");
    this.sideEl.appendChild(this.boneInfoEl);
    const boneBtnRow = el("div"); boneBtnRow.className = "row";
    const resetBoneBtn = el("button", undefined, "Reset bone");
    resetBoneBtn.addEventListener("click", () => cb.onResetBone());
    const resetAllBtn = el("button", undefined, "Reset all");
    resetAllBtn.addEventListener("click", () => cb.onResetAll());
    boneBtnRow.append(resetBoneBtn, resetAllBtn);
    this.sideEl.appendChild(boneBtnRow);

    this.sideEl.appendChild(el("h2", undefined, "History"));
    const histRow = el("div"); histRow.className = "row";
    this.undoBtn = el("button", undefined, "Undo");
    this.undoBtn.addEventListener("click", () => cb.onUndo());
    this.redoBtn = el("button", undefined, "Redo");
    this.redoBtn.addEventListener("click", () => cb.onRedo());
    this.clearKeyBtn = el("button", undefined, "Deselect key");
    this.clearKeyBtn.addEventListener("click", () => cb.onClearKeySelection());
    histRow.append(this.undoBtn, this.redoBtn, this.clearKeyBtn);
    this.sideEl.appendChild(histRow);

    this.sideEl.appendChild(el("h2", undefined, "Export"));
    const exportJsonBtn = el("button", undefined, "Correction JSON");
    exportJsonBtn.addEventListener("click", () => cb.onExportJson());
    const exportGlbBtn = el("button", "export-glb-btn", "Baked GLB");
    exportGlbBtn.className = "primary";
    exportGlbBtn.addEventListener("click", () => cb.onExportGlb());
    const exportRow = el("div"); exportRow.className = "row";
    exportRow.append(exportJsonBtn, exportGlbBtn);
    this.sideEl.appendChild(exportRow);
    this.sideEl.appendChild(
      el(
        "div",
        "quantize-note",
        "Baked GLB is NOT re-quantized (larger than a quantized source) — run <code>gltf-transform quantize</code> before shipping.",
      ),
    );

    root.appendChild(this.sideEl);

    // --- bottom: playback bar ---
    const bottom = el("div", "rig-bottom");
    const clipRow = el("div"); clipRow.className = "row";
    this.clipSelect = el("select", "clip-select");
    this.clipSelect.addEventListener("change", () => cb.onClipSelect(this.clipSelect.selectedIndex));
    this.playBtn = el("button", "play-btn", "Play");
    this.playBtn.addEventListener("click", () => cb.onPlayPause());
    const loopLabel = el("label");
    this.loopCheck = el("input"); this.loopCheck.type = "checkbox"; this.loopCheck.checked = true;
    this.loopCheck.addEventListener("change", () => cb.onLoopToggle(this.loopCheck.checked));
    loopLabel.append(this.loopCheck, document.createTextNode(" loop"));
    this.speedBtns = [0.25, 0.5, 1].map((s) => {
      const b = el("button", undefined, `${s}x`);
      b.addEventListener("click", () => {
        for (const other of this.speedBtns) other.classList.remove("primary");
        b.classList.add("primary");
        cb.onSpeedChange(s);
      });
      if (s === 1) b.classList.add("primary");
      return b;
    });
    clipRow.append(this.clipSelect, this.playBtn, loopLabel, ...this.speedBtns);
    bottom.appendChild(clipRow);

    const scrubWrap = el("div", "scrub-wrap");
    this.scrub = el("input", "scrub");
    this.scrub.type = "range";
    this.scrub.min = "0";
    this.scrub.max = "1000";
    this.scrub.value = "0";
    this.scrub.addEventListener("input", () => {
      this.scrubbing = true;
      cb.onScrubInput(Number(this.scrub.value) / 1000);
    });
    this.scrub.addEventListener("change", () => {
      this.scrubbing = false;
    });
    this.ticksEl = el("div", "ticks");
    scrubWrap.append(this.scrub, this.ticksEl);
    bottom.appendChild(scrubWrap);

    root.appendChild(bottom);
    container.appendChild(root);
  }

  private wireDropZone(): void {
    const stop = (e: DragEvent): void => {
      e.preventDefault();
      e.stopPropagation();
    };
    this.dropEl.addEventListener("dragover", (e) => {
      stop(e);
      this.dropEl.classList.add("over");
    });
    this.dropEl.addEventListener("dragleave", (e) => {
      stop(e);
      this.dropEl.classList.remove("over");
    });
    this.dropEl.addEventListener("drop", (e) => {
      stop(e);
      this.dropEl.classList.remove("over");
      const files = e.dataTransfer?.files;
      if (files?.length) this.cb.onFiles(files);
    });
  }

  // --- bone tree -----------------------------------------------------------

  renderBoneTree(rootNames: string[], graph: Map<string, BoneNode>, selected: string | undefined): void {
    this.bonesEl.querySelector("#bone-tree")?.remove();
    const list = this.buildBoneList(rootNames, graph, selected);
    list.id = "bone-tree";
    this.bonesEl.appendChild(list);
  }

  private buildBoneList(names: string[], graph: Map<string, BoneNode>, selected: string | undefined): HTMLUListElement {
    const ul = el("ul");
    for (const name of names) {
      const node = graph.get(name);
      if (!node) continue;
      const li = el("li");
      const row = el("div", undefined, escapeHtml(name));
      row.className = `row-item${name === selected ? " selected" : ""}`;
      row.addEventListener("click", () => this.cb.onBoneSelect(name));
      li.appendChild(row);
      if (node.children.length) {
        const sub = this.buildBoneList(node.children, graph, selected);
        sub.style.paddingLeft = "12px";
        li.appendChild(sub);
      }
      ul.appendChild(li);
    }
    return ul;
  }

  // --- side panel updates ----------------------------------------------------

  setBoneInfo(text: string): void {
    this.boneInfoEl.textContent = text;
  }

  setUndoRedoEnabled(canUndo: boolean, canRedo: boolean): void {
    this.undoBtn.disabled = !canUndo;
    this.redoBtn.disabled = !canRedo;
  }

  setKeySelectionActive(active: boolean): void {
    this.clearKeyBtn.disabled = !active;
  }

  // --- generate panel ----------------------------------------------------

  setGenerating(active: boolean): void {
    this.genBtn.disabled = active;
    this.genBtn.textContent = active ? "Generating…" : "Generate";
  }

  clearGenerateLog(): void {
    this.genLogEl.textContent = "";
    this.genErrorEl.textContent = "";
  }

  appendGenerateLog(line: string): void {
    this.genLogEl.textContent += (this.genLogEl.textContent ? "\n" : "") + line;
    this.genLogEl.scrollTop = this.genLogEl.scrollHeight;
  }

  setGenerateError(message: string | undefined): void {
    this.genErrorEl.textContent = message ?? "";
  }

  // --- playback bar updates ----------------------------------------------------

  setClipList(names: string[], selectedIndex: number): void {
    this.clipSelect.innerHTML = "";
    for (const name of names) this.clipSelect.appendChild(el("option", undefined, escapeHtml(name)));
    this.clipSelect.selectedIndex = selectedIndex;
  }

  setPlaying(playing: boolean): void {
    this.playBtn.textContent = playing ? "Pause" : "Play";
  }

  /** `t01` is time/duration in [0,1]; skipped while the user has the slider grabbed. */
  setScrubPosition(t01: number): void {
    if (this.scrubbing) return;
    this.scrub.value = String(Math.round(t01 * 1000));
  }

  /** Renders tick marks along the scrub track for the selected bone's keyframes
   *  in the active clip; `editedKeys`/`activeKey` control tick coloring. */
  setKeyTicks(ticks: KeyTick[], duration: number, editedKeys: Set<number>, activeKey: number | undefined): void {
    this.ticksEl.innerHTML = "";
    if (duration <= 0) return;
    for (const tick of ticks) {
      const i = el("i");
      i.style.left = `${(tick.time / duration) * 100}%`;
      if (editedKeys.has(tick.index)) i.classList.add("edited");
      if (tick.index === activeKey) i.classList.add("active");
      i.title = `t=${tick.time.toFixed(3)}s`;
      i.addEventListener("click", (e) => {
        e.stopPropagation();
        this.cb.onKeyTickClick(tick.time);
      });
      this.ticksEl.appendChild(i);
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}
