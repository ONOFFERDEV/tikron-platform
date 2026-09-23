import type { ModeId } from "../../src/modes.js";
import { intermissionStatusLabel, type IntermissionStatus } from "../intermission.js";
import { createRoundHonors, type PresentedMvp } from "../round-honors.js";
import { COPY, presentPlayerName, type PresentedPlayerName } from "./copy.js";
import { createUiButton } from "./primitives.js";

export interface ResultRow {
  readonly id: string;
  readonly name: string;
  readonly team: number;
  readonly kills: number;
  readonly deaths: number;
  readonly isMe: boolean;
}

export interface ResultViewModel {
  readonly mode: Exclude<ModeId, "practice">;
  readonly winner: string;
  readonly red: number;
  readonly blue: number;
  readonly won: boolean;
  readonly localKills: number;
  readonly localDeaths: number;
  readonly rows: readonly ResultRow[];
  readonly mvp?: PresentedMvp;
  readonly intermission: IntermissionStatus;
  readonly vote: { readonly count: number; readonly need: number; readonly sent: boolean } | null;
}

export interface PresentedResultRow extends Omit<ResultRow, "name"> {
  readonly name: PresentedPlayerName;
}

export interface ResultPresentation {
  readonly outcome: "victory" | "defeat" | "draw";
  readonly winner: PresentedPlayerName | null;
  readonly sections: readonly { readonly team: number | null; readonly rows: readonly PresentedResultRow[] }[];
  readonly local: { readonly kills: number; readonly deaths: number; readonly kd: number | null };
  readonly intermission: IntermissionStatus;
  readonly vote: ResultViewModel["vote"];
}

export interface ResultViewActions {
  readonly restart: () => void;
  readonly leave: () => void;
}

export function createResultPresentation(model: ResultViewModel): ResultPresentation {
  const rows = model.rows.map(row => ({ ...row, name: presentPlayerName(row.name) }));
  const sorted = (team: number | null): readonly PresentedResultRow[] => rows
    .filter(row => team === null || row.team === team)
    .slice()
    .sort((left, right) => right.kills - left.kills || left.deaths - right.deaths || left.name.text.localeCompare(right.name.text));
  const sections = model.mode === "ffa"
    ? [{ team: null, rows: sorted(null) }]
    : [{ team: 0, rows: sorted(0) }, { team: 1, rows: sorted(1) }];
  return {
    outcome: model.winner === "draw" ? "draw" : model.won ? "victory" : "defeat",
    winner: model.mode === "ffa" && model.winner !== "draw" ? presentPlayerName(model.winner) : null,
    sections,
    local: {
      kills: model.localKills,
      deaths: model.localDeaths,
      kd: model.localDeaths === 0 ? null : model.localKills / model.localDeaths,
    },
    intermission: model.intermission,
    vote: model.vote,
  };
}

export class ResultView {
  readonly root: HTMLElement;
  private readonly heading: HTMLHeadingElement;
  private readonly outcome: HTMLElement;
  private readonly score: HTMLElement;
  private readonly honors: HTMLElement;
  private readonly local: HTMLElement;
  private readonly rosters: HTMLElement;
  private readonly nextRound: HTMLElement;
  private readonly voteStatus: HTMLElement;
  private readonly restart: HTMLButtonElement;
  private readonly leave: HTMLButtonElement;
  private readonly body: HTMLElement;
  private visible = false;
  private honorsKey = "";

  constructor(actions: ResultViewActions, target: Document = document) {
    this.root = target.createElement("section");
    this.root.className = "ui-scroll-modal ui-surface result-view";
    this.root.hidden = true;
    this.root.dataset.open = "false";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-label", "라운드 결과");

    const header = target.createElement("header");
    header.className = "ui-scroll-modal__header result-view__header";
    this.heading = target.createElement("h2");
    this.outcome = target.createElement("strong");
    this.outcome.className = "result-view__outcome";
    this.score = target.createElement("div");
    this.score.className = "result-view__score";
    header.append(this.heading, this.outcome, this.score);

    this.body = target.createElement("div");
    this.body.className = "ui-scroll-modal__body result-view__body";
    this.honors = target.createElement("div");
    this.local = target.createElement("dl");
    this.local.className = "result-view__local";
    this.rosters = target.createElement("div");
    this.rosters.className = "result-view__rosters";
    this.body.append(this.honors, this.local, this.rosters);

    const footer = target.createElement("footer");
    footer.className = "ui-scroll-modal__footer result-view__footer";
    const status = target.createElement("div");
    status.className = "result-view__status";
    this.nextRound = target.createElement("strong");
    this.nextRound.dataset.nextRound = "";
    this.nextRound.setAttribute("role", "status");
    this.nextRound.setAttribute("aria-live", "polite");
    this.voteStatus = target.createElement("span");
    status.append(this.nextRound, this.voteStatus);
    this.restart = createUiButton({ label: "다시 플레이", tone: "accent", onClick: actions.restart });
    this.restart.dataset.action = "restart";
    this.leave = createUiButton({ label: "출격 화면으로", onClick: actions.leave });
    this.leave.dataset.action = "leave";
    footer.append(status, this.restart, this.leave);
    this.root.append(header, this.body, footer);
  }

  mount(container: HTMLElement): void {
    if (this.root.parentElement !== container) container.append(this.root);
  }

  update(model: ResultViewModel): void {
    const presentation = createResultPresentation(model);
    this.root.dataset.outcome = presentation.outcome;
    this.heading.textContent = model.mode === "ffa" ? "개인전 결과" : model.mode === "dom" ? "거점 점령 결과" : "팀 데스매치 결과";
    this.outcome.textContent = presentation.outcome === "draw" ? COPY.results.draw
      : presentation.outcome === "victory" ? COPY.results.victory : COPY.results.defeat;
    this.score.textContent = model.mode === "ffa" ? presentation.winner?.compact ?? "" : `${model.red} / ${model.blue}`;
    // Keep the honors card node while its content is unchanged (no re-raster on countdown/vote updates).
    const honorsKey = model.mvp === undefined ? "" : JSON.stringify([model.mvp, model.mode === "dom"]);
    if (honorsKey !== this.honorsKey) {
      this.honorsKey = honorsKey;
      this.honors.replaceChildren(...(model.mvp === undefined ? [] : [createRoundHonors(model.mvp, model.mode === "dom", this.root.ownerDocument)]));
    }
    this.local.replaceChildren(
      statNode(COPY.results.kills, String(presentation.local.kills), this.root.ownerDocument),
      statNode(COPY.results.deaths, String(presentation.local.deaths), this.root.ownerDocument),
      statNode("K / D", presentation.local.kd === null ? "—" : presentation.local.kd.toFixed(2), this.root.ownerDocument),
    );
    this.rosters.replaceChildren(...presentation.sections.map(section => rosterNode(section, this.root.ownerDocument)));
    this.nextRound.textContent = intermissionStatusLabel(presentation.intermission);
    this.nextRound.dataset.state = presentation.intermission.kind;
    this.voteStatus.textContent = presentation.vote === null ? "과반수 투표로 대기 시간을 줄일 수 있습니다."
      : `${presentation.vote.count} / ${presentation.vote.need}`;
    const restartHadFocus = this.root.ownerDocument.activeElement === this.restart;
    this.restart.disabled = presentation.vote?.sent === true;
    this.restart.dataset.state = this.restart.disabled ? "disabled" : "default";
    this.restart.textContent = this.restart.disabled ? "투표 완료 · 서버 대기" : "다시 플레이";
    // A disabled button drops keyboard focus; hand it to the remaining action.
    if (restartHadFocus && this.restart.disabled) this.leave.focus({ preventScroll: true });
  }

  show(): void {
    this.root.hidden = false;
    this.root.dataset.open = "true";
    if (!this.visible) this.restart.focus({ preventScroll: true });
    this.visible = true;
  }

  hide(): void {
    this.root.hidden = true;
    this.root.dataset.open = "false";
    this.visible = false;
  }
}

function statNode(label: string, value: string, target: Document): HTMLElement {
  const group = target.createElement("div");
  const term = target.createElement("dt");
  const detail = target.createElement("dd");
  term.textContent = label;
  detail.textContent = value;
  group.append(term, detail);
  return group;
}

function rosterNode(section: ResultPresentation["sections"][number], target: Document): HTMLElement {
  const region = target.createElement("section");
  const heading = target.createElement("h3");
  heading.textContent = section.team === null ? "전투원" : section.team === 0 ? "적색 진영" : "청색 진영";
  const table = target.createElement("table");
  const head = target.createElement("thead");
  const headerRow = target.createElement("tr");
  for (const label of [COPY.results.player, COPY.results.kills, COPY.results.deaths]) {
    const cell = target.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headerRow.append(cell);
  }
  head.append(headerRow);
  const body = target.createElement("tbody");
  for (const row of section.rows) {
    const tableRow = target.createElement("tr");
    tableRow.dataset.playerId = row.id;
    if (row.isMe) tableRow.dataset.self = "true";
    for (const value of [row.name.compact, String(row.kills), String(row.deaths)]) {
      const cell = target.createElement("td");
      cell.textContent = value;
      tableRow.append(cell);
    }
    body.append(tableRow);
  }
  table.append(head, body);
  region.append(heading, table);
  return region;
}

export { RESULT_FIELD_CSS as resultViewCss } from "./match-field-style.js";
