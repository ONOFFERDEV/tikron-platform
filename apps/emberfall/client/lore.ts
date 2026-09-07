/**
 * Consolidated scenario/lore text (SCENARIO-EMBERFALL.md — single source of truth).
 * Every on-screen scenario string in the client comes from here; nothing is ad-libbed
 * at the call site. Text is added here first when the scenario doc grows (see doc §11).
 */
import type { EmberClass } from "../src/content/hotbar.js";
import type { SavedZone } from "../src/types.js";

// --- §2 zone-entry banner (E1): zone name + one flavor line ------------------------------

export interface ZoneBanner {
  name: string;
  flavor: string;
}

export const ZONE_BANNERS: Readonly<Record<SavedZone, ZoneBanner>> = {
  emberhold: { name: "엠버홀드", flavor: "재 위에 세운 마지막 마을" },
  "ashen-fields": { name: "잿빛들판", flavor: "재가 눈처럼 쌓인 벌판" },
  "ember-depths": { name: "잉걸불 심연", flavor: "별의 심장이 잠든 곳" },
};

// --- §5 start-screen intro (3 lines, sequential fade-in above the nickname input) --------

export const START_INTRO_LINES: readonly string[] = [
  "30년 전, 하늘이 무너졌다. 불타는 별의 심장이 세계를 태우고 땅에 박혔다.",
  "사람들은 재 위에 마지막 마을을 세웠다 — 엠버홀드.",
  "그리고 당신처럼, 죽어도 다시 일어나는 자들이 잿길을 따라 걸어오기 시작했다.",
];

/** Replaces the create-flow button's old "생성 후 접속" text (§5). */
export const START_BUTTON_TEXT = "잿길을 걷는다";

// --- §4 class display names (start-screen class buttons; server ids like `warrior` unchanged) --

/** EmberClass id -> Korean display label. The `id` (warrior/mage/cleric) is what the client
 *  sends to the server; this is display-only, so nameplate/wire values stay in English. */
export const CLASS_NAMES: Readonly<Record<EmberClass, string>> = {
  warrior: "전사",
  mage: "메이지",
  cleric: "클레릭",
};

// --- §4 class flavor line (start screen, shown per selected class) -----------------------

export const CLASS_FLAVOR: Readonly<Record<EmberClass, string>> = {
  warrior: "방패가 버티는 동안, 마을은 무너지지 않는다.",
  mage: "불은 불로 다스린다.",
  cleric: "꺼진 불씨도 다시 지필 수 있다.",
};

// --- §H2 character-select weapon tag chip (start-screen carousel) -------------------------

/** EmberClass id -> short weapon label shown as a pill chip under the 3D preview
 *  (POLISH-EMBERFALL §H, H2). Display-only, like CLASS_NAMES/CLASS_FLAVOR. */
export const CLASS_WEAPON_CHIP: Readonly<Record<EmberClass, string>> = {
  warrior: "검 + 방패",
  mage: "지팡이",
  cleric: "메이스",
};

// --- §8 system text table ------------------------------------------------------------------

/** "{닉네임} 님이 잿길을 따라 도착했다." — other-player join toast (item 10, optional). */
export function joinToast(nickname: string): string {
  return `${nickname} 님이 잿길을 따라 도착했다.`;
}

export const LEVEL_UP_FLAVOR: readonly string[] = [
  "몸속 불씨가 조금 더 뜨거워졌다.",
  "재는 무겁지만, 걸음은 가벼워졌다.",
  "화로의 온기가 등을 밀어준다.",
];

export const DEATH_TEXT = "재가 되어 스러졌다… 화로가 당신을 부른다.";

/** "불씨가 다시 붙기까지 {n}초" — respawn countdown while waiting in place. */
export function respawnCountdownText(secondsLeft: number): string {
  return `불씨가 다시 붙기까지 ${secondsLeft}초`;
}

/** Death-panel button labels (§ village-respawn choice). */
export const RESPAWN_HERE_TEXT = "그 자리에서 부활 (R)";
export const RESPAWN_VILLAGE_TEXT = "마을에서 부활";

export const VILLAGE_RESPAWN_TEXT = "꺼지지 않는 화로 곁에서 눈을 떴다.";

/** No rare-drop UI hook exists yet — kept for when one is wired. */
export function rareDropText(itemName: string): string {
  return `재 속에서 아직 온기가 남은 것을 발견했다: ${itemName}`;
}

/** No zone-loading text slot exists in the fade transition yet — kept for when one is wired. */
export const ZONE_LOADING_TEXT: Readonly<{ toField: string; toDungeon: string; toVillage: string }> = {
  toField: "방책 문이 열린다…",
  toDungeon: "조각이 강하게 맥동한다…",
  toVillage: "화로의 온기가 느껴진다…",
};

/** No "copy dungeon link" UI feature exists yet — kept for when one is wired. */
export const DUNGEON_INVITE_COPY_TEXT = "함께 내려갈 불씨지기를 부른다 — 링크가 복사되었다.";

// --- mob kind -> Korean display name (display layer only; ids/`name:` fields unchanged) --

export const MOB_KOREAN_NAMES: Readonly<Record<string, string>> = {
  wolf: "잿빛늑대",
  goblin_scout: "고블린 정찰꾼",
  goblin_thrower: "고블린 투척꾼",
  boar: "잿빛멧돼지",
  goblin_shaman: "고블린 주술사",
  boss_chief: "족장 타르가크",
  // M3 content ids (not in the current content pack) — kept ready for when they land.
  skeleton_warrior: "해골 전사",
  skeleton_archer: "해골 궁수",
  wraith: "망령",
  golem: "파수석상",
  wraith_commander: "망령 사령관 발렌 경", // §3.3 던전 중간보스 (mid-boss)
  ember_lord: "잉걸불 군주",
};

// --- §7 보스 연출 대본 (boss dramatization script) — verbatim from SCENARIO §7 -------------

/** A boss can be one of three kinds. `boss_chief` (§7.1, field) still runs off the existing
 *  Enrage VFX hook, so the server sends no `bossEvent` for it in v1 — its lines are kept here
 *  only so the whole §7 script lives in one place and it can be wired via `kind` later. */
export type BossKind = "boss_chief" | "wraith_commander" | "ember_lord";

/** The dramatization beats. `wraith_commander` uses only engage/half/defeated; `ember_lord`
 *  adds the three phase beats. Names mirror the room `"bossEvent"` `ev` contract. */
export type BossEvent = "engage" | "half" | "phase_summon" | "phase_aoe" | "enrage" | "defeated";

export interface BossEventLines {
  /** Boss dialogue ("이름: 대사"), shown in the mid-lower boss-line banner. */
  line?: string;
  /** Narrative banner (zone-banner style) — boss entrance/defeat framing, or an `ember_lord`
   *  phase call-out. */
  banner?: string;
  /** Sequential closing banners (§7.3, `ember_lord` defeat only). */
  ending?: readonly string[];
}

/** boss kind -> event -> text, straight from SCENARIO §7 (no ad-lib; see doc header). */
export const BOSS_LINES: Readonly<Record<BossKind, Partial<Record<BossEvent, BossEventLines>>>> = {
  // §7.1 족장 타르가크 (필드 — 이벤트 송신은 서버 몫, 지금은 상수만)
  boss_chief: {
    engage: { line: "타르가크: 내 조각을… 탐내러 왔나!" },
    half: { line: "타르가크: 조각이여, 타올라라!" },
    defeated: { banner: "타는 심장 조각을 손에 넣었다 — 조각이 동쪽을 향해 맥동한다." },
  },
  // §7.2 망령 사령관 발렌 경 (던전 중간보스): engage/half/defeated
  wraith_commander: {
    engage: { line: "발렌 경: 정지. 소속과 용건을 밝혀라." },
    half: { line: "발렌 경: …명령은, 아직, 유효하다." },
    defeated: { line: "발렌 경: 교대… 인가. 늦었군.", banner: "발렌 경이 30년 만에 초소를 떠났다." },
  },
  // §7.3 잉걸불 군주 (던전 최종보스): engage/phase_summon(hp70%)/phase_aoe(hp40%)/enrage(hp15%)/defeated
  ember_lord: {
    engage: { banner: "공기가 탄다. 심장이 당신을 보고 있다.", line: "잉걸불 군주: 재가 되어라." },
    phase_summon: { banner: "군주가 죽은 자들을 끌어올린다!" },
    phase_aoe: { banner: "심장이 불꽃을 토해낸다 — 바닥을 보라!" },
    enrage: { banner: "심장이 마지막으로 타오른다!" },
    defeated: {
      ending: [
        "심장의 불길이 잦아든다. 심연이 처음으로… 조용하다.",
        "엠버홀드의 화로가 어느 때보다 밝게 타오른다. 당신 덕분이다, 불씨지기여.",
        "그러나 잉걸불은 꺼지지 않는다. 심연 깊은 곳에서 — 심장은 다시 뛰기 시작한다.",
      ],
    },
  },
};

// --- §3.1 잿가루 로자 (Roza, shop-1): shop-open dialogue pool ------------------------------

export const MERCHANT_NAME = "잿가루 로자";

export const ROZA_DIALOGUE: readonly string[] = [
  "어서 와. 죽기 전에 살 거야, 죽고 나서 살 거야?",
  "포션은 세 개씩 사. 두 개 산 사람들은 말이 없더라.",
  "그 갑옷, 어디서 났어? …아 내가 판 거구나.",
  "심연에 간다고? 외상은 안 돼.",
];

// --- §3.2 훈련 허수아비 (dummy-1): hit-reaction pool ----------------------------------------

export const DUMMY_REACTIONS: readonly string[] = ["퍽.", "무명도 이건 아팠을 거다.", "허수아비는 말이 없다."];

// --- §10 first-login guide (4-step, one-time, gated by localStorage) -----------------------

export const FIRST_LOGIN_GUIDE_STEPS: readonly string[] = ["우클릭 드래그=시점", "클릭=이동", "적 클릭=공격", "스페이스=대시"];

// --- pure: random pick, shared by level-up/Roza/dummy line selection ----------------------

export function randomLine(pool: readonly string[]): string {
  return pool[Math.floor(Math.random() * pool.length)]!;
}
