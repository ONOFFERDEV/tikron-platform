import type { ModeId } from "../../src/modes.js";
import { GAME } from "../../src/game-config.js";
import type { WeaponKey } from "../../src/weapon-contract.js";

export type StableMapId = "arena1" | "arena2" | "arena3";

export interface UiCopyContract {
  readonly modes: Readonly<Record<ModeId, { readonly description: string; readonly detailFmt: string }>>;
  readonly maps: Readonly<Record<StableMapId, { readonly name: string; readonly subtitle: string; readonly routes: readonly [string, string, string]; readonly description: string }>>;
  readonly training: Readonly<Record<StableMapId, string>> & { readonly freeTraining: string };
  readonly match: {
    readonly objectives: { readonly tdmFmt: string; readonly ffaFmt: string; readonly domFmt: string; readonly practice: string };
    readonly clocks: { readonly roundComplete: string; readonly warmupWaiting: string; readonly warmupStandBy: string; readonly deployInFmt: string; readonly noTimeLimit: string };
    readonly affiliations: { readonly red: string; readonly blue: string; readonly solo: string };
  };
  readonly intermission: { readonly automatic: string; readonly inFmt: string; readonly awaitingServer: string };
  readonly results: { readonly player: string; readonly kills: string; readonly deaths: string; readonly score: string; readonly unknownPlayer: string; readonly draw: string; readonly victory: string; readonly defeat: string };
  readonly support: { readonly ping: string; readonly backup: string; readonly mortar: string; readonly unavailable: string };
  readonly controls: Readonly<Record<"moveFmt" | "sprintFmt" | "crouchFmt" | "jumpFmt" | "reloadFmt" | "grenadeFmt", string>>;
  readonly missingRegion: string;
}

type TextWithUi = typeof GAME.text & { readonly ui: UiCopyContract };

export const COPY = (GAME.text as TextWithUi).ui;

export const FIELD_UI_COPY = {
  deploy: {
    build: "통신선 / 개발 미리보기",
    eyebrow: "멀티플레이 야전 작전",
    subtitle: "통신선을 장악하라",
    action: "출격",
    trainingSite: "훈련 장소",
    operationSite: "작전 구역",
    selectOperation: "작전 선택",
    controls: "WASD 이동 · 마우스 조준",
    settings: "설정",
    privateTargets: "개인 훈련 · 수동 표적 5개 · 시간 제한 없음",
    objectivePractice: "거점 훈련 · 표적과 점수 없음 · 시간 제한 없음",
    mapExploration: "개인 전장 탐색 · 표적 없음 · 시간 제한 없음",
    fieldOperations: "야전 작전",
    legacy: "기존 전장",
    skipIntro: "클릭하거나 아무 키를 눌러 출격 · Esc: 메뉴",
  },
  hud: {
    health: "체력",
    serverEvents: "최근 서버 확인 기록",
    telemetryBefore: "입력 지연 · 측정 전",
    audioMuted: "음소거 · M / 설정",
    connected: "연결됨",
    waiting: "응답 대기",
    reconnecting: "연결 복구 중",
    connectionLost: "연결 종료",
    frames: "fps",
    player: "전투원",
  },
  ambush: "기습",
  lock: {
    title: "출격 대기",
    briefing: "엄폐물 사이로 이동하십시오. 우클릭 조준 · 좌클릭 사격.<br>재출격은 자동입니다. Esc: 설정과 출격 메뉴.",
    extraControls: "달리며 앉기: 슬라이드 · 허리 높이 엄폐물: 점프로 넘기 · 1‑5 무기 · M 음소거",
    messages: {
      "CLICK TO PLAY": "클릭하여 출격",
      "CONNECTING…": "전장에 연결 중",
      "LINK LOST — RECONNECTING…": "연결 끊김 · 다시 연결 중",
      "Preparing arena / Loading weapons and effects...": "전장 준비 · 무기와 전투 효과 불러오는 중",
      "ROUND COMPLETE · Receiving results…": "라운드 종료 · 결과 수신 중",
      "GAME CONTENT UPDATED - RELOAD REQUIRED": "게임 내용이 갱신되었습니다 · 새로고침 필요",
    } as Readonly<Record<string, string>>,
  },
  death: { title: "전사", killedByFmt: "처치자 · {killer}", respawnInFmt: "재출격까지 {s}초", respawningNow: "재출격 중" },
  capture: { red: "적색", blue: "청색", open: "미점령", taking: "점령 중" },
  streakFmt: "{who} · {count}연속 처치",
  damage: { front: "전방", right: "우측", back: "후방", left: "좌측" },
  feed: {
    biplane: "복엽기 소사",
    mortar: "박격포",
    grenade: "수류탄",
    you: "나",
    assist: "지원",
  },
  tactical: {
    label: "전술 지도와 현재 위치",
    canvas: "내 위치, 분대원과 임시 분대 신호. 적 자동 추적 없음",
    me: "나",
    ally: "아군",
    enemySeen: "적 발견",
    backup: "지원 요청",
    go: "이동",
    callerPosition: "전송 당시 요청 위치",
    markedPosition: "마지막 표시 위치",
    teamPing: "분대 신호",
    rehearsePing: "신호 훈련",
    tapHold: "짧게 표시 · 길게 선택",
    atLocation: "내 위치",
    signalLost: "통신 두절",
    relinkIn: "복구까지",
    mapOffline: "통신선 재연결 중 전술 지도 사용 불가",
    lastSeen: "관측기 정찰 · 마지막 확인",
  },
  support: {
    ready: "지원 준비",
    biplaneAvailable: "고정 경로 복엽기 소사 사용 가능",
    inbound: "복엽기 소사 접근",
    friendlyInbound: "아군 복엽기 소사 접근",
    hostileInbound: "적 복엽기 소사 접근",
    corridorWarning: "표시된 회랑에서 벗어나십시오. 3초 뒤 한 차례 직선 소사가 시작됩니다.",
    mortarReady: "박격포 준비",
    recon: "관측기 정찰",
  },
  signal: {
    restored: "통신 복구",
    mapOnline: "전술 지도 복구. 중앙 통로가 닫혔습니다.",
    relayWarning: "연락선 전환 대기",
    relayBlackout: "연락선 두절",
    relayOpen: "중앙 통로 개방",
    undertowWarning: "수압 저하 · 대기",
    undertowOpen: "정비 통로 개방",
    switchyardWarning: "화물 이동 · 엄폐 해제",
    switchyardOpen: "화물 횡단로 개방",
    held: "유지",
  },
} as const;
type BindAction = keyof typeof GAME.text.settings.actionLabels;

export function modeCopy(mode: ModeId): Readonly<{ label: string; description: string; detailFmt: string }> {
  return { label: GAME.text.modeLabels[mode].ko, ...COPY.modes[mode] };
}

export function mapCopy(map: StableMapId): UiCopyContract["maps"][StableMapId] {
  return COPY.maps[map];
}

export function formatCopy(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{([^}]+)\}/g, (token, key: string) => key in values ? String(values[key]) : token);
}

const PREPARATION_STAGE_LABELS: Readonly<Record<string, string>> = {
  "authoritative-state": "전장 상태 동기화",
  "weapons-and-effects": "무기와 전투 효과 준비",
};

// WW1 service-weapon names by stable weapon key (src/weapon-contract.ts); display only.
const WEAPON_LABELS: Readonly<Record<WeaponKey, string>> = {
  automatic_rifle: "자동소총",
  trench_smg: "참호 기관단총",
  pump_shotgun: "펌프 산탄총",
  bolt_service_rifle: "볼트 소총",
  service_pistol: "제식 권총",
};

export function weaponLabel(key: WeaponKey | undefined): string {
  return key === undefined ? "무기" : WEAPON_LABELS[key];
}

export function preparationStageLabel(stage: string): string {
  return PREPARATION_STAGE_LABELS[stage] ?? "전장 요소 확인 중";
}

export type CopyBindings = Readonly<Record<BindAction, readonly string[]>>;

function keyLabel(code: string): string {
  if (code === "Space") return "Space";
  if (code.startsWith("Key") && code.length === 4) return code.slice(3);
  if (code.startsWith("Digit") && code.length === 6) return code.slice(5);
  if (code === "ArrowUp") return "↑";
  if (code === "ArrowLeft") return "←";
  if (code === "ArrowDown") return "↓";
  if (code === "ArrowRight") return "→";
  if (code.startsWith("Control")) return "Ctrl";
  if (code.startsWith("Shift")) return "Shift";
  if (code.startsWith("Alt")) return "Alt";
  if (code.startsWith("Meta")) return "Meta";
  return code;
}

function bindingLabel(codes: readonly string[]): string {
  // Left/right twins (ShiftLeft + ShiftRight) collapse to one label; others read "Ctrl/C".
  return codes.length === 0 ? "—" : [...new Set(codes.map(keyLabel))].join("/");
}

export function formatControlsHint(bindings: CopyBindings): string {
  const move = [bindings.forward[0], bindings.left[0], bindings.back[0], bindings.right[0]].filter((code): code is string => Boolean(code)).map(keyLabel).join("");
  return [
    formatCopy(COPY.controls.moveFmt, { keys: move || "—" }),
    formatCopy(COPY.controls.sprintFmt, { keys: bindingLabel(bindings.sprint) }),
    formatCopy(COPY.controls.crouchFmt, { keys: bindingLabel(bindings.crouch) }),
    formatCopy(COPY.controls.jumpFmt, { keys: bindingLabel(bindings.jump) }),
    formatCopy(COPY.controls.reloadFmt, { keys: bindingLabel(bindings.reload) }),
    formatCopy(COPY.controls.grenadeFmt, { keys: bindingLabel(bindings.grenade) }),
  ].join(" · ");
}

export interface PresentedPlayerName { readonly text: string; readonly html: string; readonly compact: string }

const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function presentPlayerName(value: string): PresentedPlayerName {
  const clean = value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim() || COPY.results.unknownPlayer;
  const characters = [...clean];
  const compact = characters.length > 24 ? `${characters.slice(0, 24).join("")}…` : clean;
  return { text: clean, html: clean.replace(/[&<>"']/g, character => ESCAPES[character] ?? character), compact };
}
