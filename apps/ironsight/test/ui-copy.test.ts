import { describe, expect, it } from "vitest";
import { ARENA1 } from "../src/map/arena1.js";
import { ARENA2 } from "../src/map/arena2.js";
import { ARENA3 } from "../src/map/arena3.js";
import { COPY, formatControlsHint, mapCopy, modeCopy, presentPlayerName, weaponLabel, type CopyBindings } from "../client/ui/copy.js";
import { WEAPON_KEYS } from "../src/weapon-contract.js";
import { mapCallout, SITES } from "../client/map-presentation.js";

const bindings: CopyBindings = {
  forward: ["ArrowUp"], back: ["ArrowDown"], left: ["ArrowLeft"], right: ["ArrowRight"],
  jump: ["Space"], crouch: ["ControlLeft"], sprint: ["ShiftLeft"], reload: ["KeyR"], grenade: ["KeyG"],
  ping: ["KeyQ"], backup: ["KeyX"], support: ["KeyV"],
};

describe("Korean UI copy contract", () => {
  it("owns stable mode, map, training, result, and support terminology", () => {
    expect([modeCopy("tdm").label, modeCopy("ffa").label, modeCopy("dom").label, modeCopy("practice").label]).toEqual(["팀 데스매치", "개인전", "거점 점령", "연습 모드"]);
    expect(mapCopy("arena1").name).toBe("통신 참호선");
    expect(mapCopy("arena2").name).toBe("운하 교두보");
    expect(mapCopy("arena3").name).toBe("전선 보급역");
    expect(COPY.training.arena1).toContain("재장전");
    expect(COPY.results).toMatchObject({ player: "전투원", kills: "처치", deaths: "사망", score: "점수" });
    expect(COPY.support).toMatchObject({ ping: "위치 표시", backup: "지원 요청", mortar: "박격포 지원" });
  });

  it("names the five stable weapon slots as WW1 service weapons in Korean", () => {
    expect(WEAPON_KEYS.map(weaponLabel)).toEqual(["자동소총", "참호 기관단총", "펌프 산탄총", "볼트 소총", "제식 권총"]);
    expect(weaponLabel(undefined)).toBe("무기");
  });

  it("formats the player's actual binding codes instead of fixed WASD copy", () => {
    const hint = formatControlsHint(bindings);
    expect(hint).toContain("↑←↓→ 이동");
    expect(hint).toContain("Shift 달리기");
    expect(hint).toContain("Ctrl 앉기");
    expect(hint).toContain("R 재장전");
    expect(hint).not.toContain("WASD");
  });

  it("keeps special, empty, and long player names safe at presentation boundaries", () => {
    expect(presentPlayerName("  <의무병 & 'A'>  ")).toEqual({ text: "<의무병 & 'A'>", html: "&lt;의무병 &amp; &#39;A&#39;&gt;", compact: "<의무병 & 'A'>" });
    expect(presentPlayerName("\u0000\u202e").text).toBe(COPY.results.unknownPlayer);
    const long = presentPlayerName("가".repeat(80));
    expect([...long.text]).toHaveLength(80);
    expect([...long.compact]).toHaveLength(25);
    expect(long.compact.endsWith("…")).toBe(true);
  });

  it("keeps stable arena ids while every arena resolves to accepted Korean callouts", () => {
    expect(Object.keys(SITES)).toEqual(["arena1", "arena2", "arena3"]);
    expect([SITES.arena1.name, SITES.arena2.name, SITES.arena3.name]).toEqual(["통신 참호선", "운하 교두보", "전선 보급역"]);
    expect(mapCallout(ARENA1, 75, 50)).toBe("통신소");
    expect(mapCallout(ARENA2, 75, 20)).toBe("제방길");
    expect(mapCallout(ARENA3, 75, 80)).toBe("선로 절개지");
  });
});
