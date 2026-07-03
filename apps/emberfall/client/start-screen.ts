/**
 * Boot-time character flow (PLAN-EMBERFALL-M2 §4/§8's "create→sanghu→refresh continue"
 * gate): a start screen shown BEFORE any room connection, offering "New Character"
 * (nickname + class -> `POST /api/char/create`) or "Continue" (a saved/pasted token ->
 * `POST /api/char/load`). Replaces M1's post-connect "Choose your path" overlay — class
 * is now picked at creation time, so the room never reports an unclassed player.
 *
 * The reducer (`bootReducer`) and the localStorage token helpers are pure/DOM-light and
 * covered by `test/client-m2.test.ts`; `StartScreen` is the DOM-owning overlay on top,
 * exercised by the E2E smoke instead (same split as `net.ts`/`NetSession`).
 */
import type { EmberClass } from "../src/content/hotbar.js";
import type { SavedCharacter } from "../src/types.js";
import { el } from "./dom.js";

const TOKEN_KEY = "emberfall:token";

/** Reads the saved continue-code token, if any (privacy mode / storage-disabled -> null). */
export function loadSavedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // best-effort only
  }
}

export function clearSavedToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // best-effort only
  }
}

// --- pure: boot state machine -------------------------------------------------------------

export type BootState =
  | { phase: "menu"; error: string | null }
  | { phase: "pending" }
  | { phase: "ready"; token: string; character: SavedCharacter };

export type BootEvent =
  | { type: "createSubmit" }
  | { type: "continueSubmit" }
  | { type: "success"; token: string; character: SavedCharacter }
  | { type: "failure"; error: string }
  | { type: "reset" };

export const INITIAL_BOOT_STATE: BootState = { phase: "menu", error: null };

/** Pure transition function for the create/continue flow. `createSubmit`/`continueSubmit`
 *  are no-ops while a request is already in flight (prevents a double-submit race). */
export function bootReducer(state: BootState, event: BootEvent): BootState {
  switch (event.type) {
    case "createSubmit":
    case "continueSubmit":
      return state.phase === "pending" ? state : { phase: "pending" };
    case "success":
      return { phase: "ready", token: event.token, character: event.character };
    case "failure":
      return { phase: "menu", error: event.error };
    case "reset":
      return { phase: "menu", error: null };
    default:
      return state;
  }
}

// --- api calls (not unit-tested — thin fetch wrappers, same split as NetSession) ----------

export type CharApiResult =
  | { ok: true; token: string; character: SavedCharacter }
  | { ok: false; error: string };

async function postJson(path: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, json };
}

/** `POST /api/char/create {nickname, class}` (PLAN-EMBERFALL-M2 §4). */
export async function apiCreateCharacter(nickname: string, cls: EmberClass): Promise<CharApiResult> {
  const { json } = await postJson("/api/char/create", { nickname, class: cls });
  const token = json?.token;
  const character = json?.character;
  if (typeof token === "string" && character) return { ok: true, token, character: character as SavedCharacter };
  const error = typeof json?.error === "string" ? json.error : "unknown_error";
  return { ok: false, error };
}

/** `POST /api/char/load {token}` (PLAN-EMBERFALL-M2 §4). */
export async function apiLoadCharacter(token: string): Promise<CharApiResult> {
  const { json } = await postJson("/api/char/load", { token });
  const character = json?.character;
  if (character) return { ok: true, token, character: character as SavedCharacter };
  const error = typeof json?.error === "string" ? json.error : "unknown_error";
  return { ok: false, error };
}

// --- DOM-owning overlay --------------------------------------------------------------------

const CLASSES: readonly EmberClass[] = ["warrior", "mage", "cleric"];
const NICKNAME_HINT_RE = /^[a-zA-Z0-9가-힣_ ]{3,16}$/;

export interface StartScreenCallbacks {
  /** A character is ready to play — token is already persisted to localStorage. */
  onReady(token: string, character: SavedCharacter): void;
}

export class StartScreen {
  private state: BootState = INITIAL_BOOT_STATE;
  private selectedClass: EmberClass = "warrior";

  private readonly overlay: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly errorEl: HTMLElement;
  private readonly menuEl: HTMLElement;
  private readonly nicknameInput: HTMLInputElement;
  private readonly classButtons: HTMLButtonElement[];
  private readonly createBtn: HTMLButtonElement;
  private readonly continueInput: HTMLInputElement;
  private readonly continueBtn: HTMLButtonElement;

  constructor(
    root: HTMLElement,
    private readonly callbacks: StartScreenCallbacks,
  ) {
    this.overlay = el("div", "start-overlay");
    const title = el("div", "start-title");
    title.textContent = "EMBERFALL";
    this.statusEl = el("div", "start-status hud-hidden");
    this.errorEl = el("div", "start-error hud-hidden");

    this.menuEl = el("div", "start-menu");

    const createSection = el("div", "start-section");
    const createLabel = el("div", "start-section-label");
    createLabel.textContent = "새 캐릭터";
    this.nicknameInput = document.createElement("input");
    this.nicknameInput.className = "start-nickname-input";
    this.nicknameInput.placeholder = "닉네임 (3-16자)";
    this.nicknameInput.maxLength = 16;
    this.nicknameInput.addEventListener("input", () => this.refreshCreateEnabled());

    const classRow = el("div", "start-class-row");
    this.classButtons = CLASSES.map((cls) => {
      const btn = document.createElement("button");
      btn.className = "start-class-btn";
      btn.textContent = cls[0]!.toUpperCase() + cls.slice(1);
      btn.addEventListener("click", () => this.selectClass(cls));
      classRow.appendChild(btn);
      return btn;
    });

    this.createBtn = document.createElement("button");
    this.createBtn.className = "start-create-btn";
    this.createBtn.textContent = "생성 후 접속";
    this.createBtn.addEventListener("click", () => void this.submitCreate());

    createSection.append(createLabel, this.nicknameInput, classRow, this.createBtn);

    const continueSection = el("div", "start-section");
    const continueLabel = el("div", "start-section-label");
    continueLabel.textContent = "이어하기";
    this.continueInput = document.createElement("input");
    this.continueInput.className = "start-continue-input";
    this.continueInput.placeholder = "이어하기 코드 붙여넣기";
    this.continueBtn = document.createElement("button");
    this.continueBtn.className = "start-continue-btn";
    this.continueBtn.textContent = "이어하기";
    this.continueBtn.addEventListener("click", () => void this.submitContinue(this.continueInput.value.trim()));
    continueSection.append(continueLabel, this.continueInput, this.continueBtn);

    this.menuEl.append(createSection, continueSection);
    this.overlay.append(title, this.statusEl, this.errorEl, this.menuEl);
    root.appendChild(this.overlay);

    this.selectClass(this.selectedClass);
    this.refreshCreateEnabled();
    void this.tryAutoContinue();
  }

  private selectClass(cls: EmberClass): void {
    this.selectedClass = cls;
    for (const [i, btn] of this.classButtons.entries()) {
      btn.classList.toggle("start-class-btn-selected", CLASSES[i] === cls);
    }
  }

  private refreshCreateEnabled(): void {
    this.createBtn.disabled = !NICKNAME_HINT_RE.test(this.nicknameInput.value.trim());
  }

  private async tryAutoContinue(): Promise<void> {
    const token = loadSavedToken();
    if (!token) return; // show the menu immediately — no saved code to try
    this.applyState(bootReducer(this.state, { type: "continueSubmit" }));
    this.setStatus("이어하는 중…");
    const result = await apiLoadCharacter(token);
    if (result.ok) {
      this.finish(result.token, result.character);
    } else {
      clearSavedToken(); // stale/invalid — fall through to the create/continue menu
      this.applyState(bootReducer(this.state, { type: "failure", error: "" }));
      this.setStatus("");
    }
  }

  private async submitCreate(): Promise<void> {
    if (this.state.phase === "pending") return;
    const nickname = this.nicknameInput.value.trim();
    if (!NICKNAME_HINT_RE.test(nickname)) return;
    this.applyState(bootReducer(this.state, { type: "createSubmit" }));
    this.setStatus("생성 중…");
    const result = await apiCreateCharacter(nickname, this.selectedClass);
    this.handleResult(result);
  }

  private async submitContinue(token: string): Promise<void> {
    if (this.state.phase === "pending" || token.length === 0) return;
    this.applyState(bootReducer(this.state, { type: "continueSubmit" }));
    this.setStatus("이어하는 중…");
    const result = await apiLoadCharacter(token);
    this.handleResult(result);
  }

  private handleResult(result: CharApiResult): void {
    if (result.ok) {
      this.finish(result.token, result.character);
      return;
    }
    this.applyState(bootReducer(this.state, { type: "failure", error: describeError(result.error) }));
    this.setStatus("");
  }

  private finish(token: string, character: SavedCharacter): void {
    saveToken(token);
    this.applyState(bootReducer(this.state, { type: "success", token, character }));
    this.overlay.remove();
    this.callbacks.onReady(token, character);
  }

  private applyState(next: BootState): void {
    this.state = next;
    const pending = next.phase === "pending";
    this.nicknameInput.disabled = pending;
    this.createBtn.disabled = pending || !NICKNAME_HINT_RE.test(this.nicknameInput.value.trim());
    this.continueInput.disabled = pending;
    this.continueBtn.disabled = pending;
    for (const btn of this.classButtons) btn.disabled = pending;
    if (next.phase === "menu" && next.error) {
      this.errorEl.textContent = next.error;
      this.errorEl.classList.remove("hud-hidden");
    } else {
      this.errorEl.classList.add("hud-hidden");
    }
  }

  private setStatus(text: string): void {
    this.statusEl.textContent = text;
    this.statusEl.classList.toggle("hud-hidden", text.length === 0);
  }
}

function describeError(code: string): string {
  switch (code) {
    case "nickname_taken":
      return "이미 사용 중인 닉네임입니다.";
    case "invalid_nickname":
      return "닉네임은 3-16자, 한글/영문/숫자/공백/밑줄만 가능합니다.";
    case "invalid_class":
      return "클래스를 선택해 주세요.";
    case "not_found":
      return "이어하기 코드를 찾을 수 없습니다.";
    default:
      return "오류가 발생했습니다. 다시 시도해 주세요.";
  }
}
