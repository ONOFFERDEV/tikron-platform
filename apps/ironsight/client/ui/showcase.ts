import {
  createUiButton,
  createUiField,
  createUiKeycap,
  createUiMapLegend,
  createUiScrollModal,
  openUiScrollModal,
  createUiStatusRow,
  createUiTabs,
} from "./primitives.js";
import { installUiTokens } from "./tokens.js";

const SHOWCASE_STYLE_ID = "ironsight-ui-showcase-style";
const SHOWCASE_CSS = `
#uiShowcase{position:fixed;inset:0;z-index:var(--ui-z-blocking);display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:var(--ui-surface-0);color:var(--ui-text-primary);font:400 var(--ui-type-body)/1.5 var(--ui-font-body);overflow:hidden}
#uiShowcase .showcase-header,#uiShowcase .showcase-footer{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-4);padding:var(--ui-space-4) var(--ui-safe-edge);background:var(--ui-surface-2);border-block-end:var(--ui-border-width) solid var(--ui-border-subtle)}
#uiShowcase .showcase-header h1{margin:0;font:700 var(--ui-type-screen)/1.1 var(--ui-font-display);text-wrap:balance}
#uiShowcase .showcase-kicker{display:block;color:var(--ui-accent);font-size:var(--ui-type-meta);font-weight:700;letter-spacing:.16em}
#uiShowcase .showcase-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:var(--ui-space-2)}
#uiShowcase .showcase-body{min-block-size:0;overflow:auto;padding:var(--ui-space-6) var(--ui-safe-edge);overscroll-behavior:contain}
#uiShowcase .showcase-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(var(--ui-grid-card-min),100%),1fr));gap:var(--ui-space-4);max-inline-size:var(--ui-layout-max);margin-inline:auto}
#uiShowcase .showcase-section{min-inline-size:0;padding:var(--ui-space-4);border:var(--ui-border-width) solid var(--ui-border-subtle);border-inline-start:var(--ui-border-emphasis) solid var(--ui-accent);border-radius:var(--ui-radius-panel);background:var(--ui-surface-1)}
#uiShowcase .showcase-section h2{margin:0 0 var(--ui-space-3);font:700 var(--ui-type-panel)/1.25 var(--ui-font-body);text-wrap:balance}
#uiShowcase .showcase-section p{margin:var(--ui-space-2) 0;color:var(--ui-text-secondary);text-wrap:pretty}
#uiShowcase [data-showcase-stress='korean-long-text']{word-break:keep-all;overflow-wrap:anywhere}
#uiShowcase .showcase-cluster{display:flex;flex-wrap:wrap;gap:var(--ui-space-2)}
#uiShowcase .showcase-stack{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--ui-space-2)}
#uiShowcase .showcase-keys{display:flex;flex-wrap:wrap;gap:var(--ui-space-3);align-items:center}
#uiShowcase .showcase-modal{grid-column:1/-1;display:grid;place-items:center;min-block-size:360px;padding:var(--ui-space-4);background:var(--ui-scrim)}
#uiShowcase .showcase-modal .ui-scroll-modal{max-block-size:280px}
#uiShowcase[data-modal-capture="true"] .showcase-modal{position:fixed;inset:0;z-index:var(--ui-z-blocking)}
#uiShowcase[data-modal-capture="true"] [data-showcase-action="open-modal"]{visibility:hidden}
#uiShowcase[data-long-capture="true"]::before{content:"";position:fixed;inset:0;z-index:calc(var(--ui-z-blocking) - 1);background:var(--ui-scrim)}
#uiShowcase[data-long-capture="true"] [data-showcase-section="korean-long-text"]{position:fixed;inset:auto;top:50%;left:50%;z-index:var(--ui-z-blocking);inline-size:min(680px,calc(100% - 32px));transform:translate(-50%,-50%)}
#uiShowcase .showcase-modal-copy{display:grid;gap:var(--ui-space-3)}
#uiShowcase .showcase-footer{border-block-start:var(--ui-border-width) solid var(--ui-border-subtle);border-block-end:0;font-size:var(--ui-type-hud)}
#uiShowcase .showcase-footer p{margin:0;color:var(--ui-text-secondary)}
@media(max-width:767px){#uiShowcase .showcase-header,#uiShowcase .showcase-footer{align-items:flex-start;flex-direction:column}#uiShowcase .showcase-actions{justify-content:flex-start}#uiShowcase .showcase-body{padding:var(--ui-space-4)}#uiShowcase .showcase-modal{padding:0;min-block-size:480px}}
`;

function section(title: string): HTMLElement {
  const node = document.createElement("section");
  const heading = document.createElement("h2");
  node.className = "showcase-section";
  heading.textContent = title;
  node.append(heading);
  return node;
}

function createSelect(): HTMLSelectElement {
  const select = document.createElement("select");
  for (const label of ["팀 색상", "노란색", "보라색"]) {
    const option = document.createElement("option");
    option.textContent = label;
    select.append(option);
  }
  return select;
}

export function mountUiShowcase(target: HTMLElement): () => void {
  const previousLang = document.documentElement.lang;
  document.documentElement.lang = "ko";
  installUiTokens();
  const previousStyle = document.querySelector(`#${SHOWCASE_STYLE_ID}`);
  const style = document.createElement("style");
  style.id = SHOWCASE_STYLE_ID;
  style.textContent = SHOWCASE_CSS;
  previousStyle?.remove();
  document.head.append(style);

  const root = document.createElement("main");
  root.id = "uiShowcase";
  root.className = "ui-surface";
  root.dataset.showcase = "ui-primitives";
  root.dataset.reducedMotion = "false";

  const header = document.createElement("header");
  header.className = "showcase-header";
  const titleWrap = document.createElement("div");
  const kicker = document.createElement("span");
  const title = document.createElement("h1");
  kicker.className = "showcase-kicker";
  kicker.textContent = "UI-01 / 야전 인터페이스";
  title.textContent = "상태와 조작 표본";
  titleWrap.append(kicker, title);
  const toggles = document.createElement("div");
  toggles.className = "showcase-actions";
  const fontToggle = createUiButton({ label: "글꼴 실패 보기" });
  fontToggle.dataset.showcaseAction = "font-fallback";
  fontToggle.addEventListener("click", () => {
    const enabled = root.dataset.fontFallback !== "true";
    root.dataset.fontFallback = String(enabled);
    fontToggle.setAttribute("aria-pressed", String(enabled));
  });
  const motionToggle = createUiButton({ label: "움직임 줄이기" });
  motionToggle.dataset.showcaseAction = "reduced-motion";
  motionToggle.addEventListener("click", () => {
    const enabled = root.dataset.reducedMotion !== "true";
    root.dataset.reducedMotion = String(enabled);
    motionToggle.setAttribute("aria-pressed", String(enabled));
  });
  toggles.append(fontToggle, motionToggle);
  header.append(titleWrap, toggles);

  const body = document.createElement("div");
  const grid = document.createElement("div");
  body.className = "showcase-body";
  body.dataset.showcaseRegion = "scroll-body";
  grid.className = "showcase-grid";

  const buttons = section("버튼 상태");
  const buttonCluster = document.createElement("div");
  buttonCluster.className = "showcase-cluster";
  buttonCluster.append(
    createUiButton({ label: "기본" }),
    createUiButton({ label: "출격", tone: "accent" }),
    createUiButton({ label: "눌림", state: "pressed" }),
    createUiButton({ label: "선택됨", state: "selected" }),
    createUiButton({ label: "사용 불가", state: "disabled" }),
    createUiButton({ label: "준비 중", state: "loading" }),
    createUiButton({ label: "저장 실패", tone: "error" }),
  );
  buttons.append(buttonCluster);

  const statuses = section("상태 행");
  const statusStack = document.createElement("div");
  statusStack.className = "showcase-stack";
  statusStack.append(
    createUiStatusRow("전장 연결", "연결하는 중", "warning"),
    createUiStatusRow("자산 준비", "완료", "success"),
    createUiStatusRow("설정 저장", "저장하지 못했습니다", "error"),
    createUiStatusRow("왕복 지연", "측정 전"),
  );
  statuses.append(statusStack);

  const keys = section("키캡");
  const keyCluster = document.createElement("div");
  keyCluster.className = "showcase-keys";
  keyCluster.append(
    createUiKeycap("W", "앞으로 이동"),
    createUiKeycap("입력 대기", "재장전", "capturing"),
    createUiKeycap("", "핑", "unbound"),
    createUiKeycap("R", "충돌한 키", "conflict"),
    createUiKeycap("M", "음소거", "disabled"),
  );
  keys.append(keyCluster);

  const fields = section("필드와 오류");
  const fieldStack = document.createElement("div");
  const sensitivity = document.createElement("input");
  sensitivity.type = "range";
  sensitivity.min = "0.1";
  sensitivity.max = "3";
  sensitivity.value = "1";
  fieldStack.className = "showcase-stack";
  const errorInput = document.createElement("input");
  errorInput.value = "R";
  const savingInput = document.createElement("input");
  savingInput.value = "적용하는 중";
  const disabledInput = document.createElement("input");
  disabledInput.value = "연결 후 변경 가능";
  fieldStack.append(
    createUiField("마우스 감도", sensitivity, "조준 배율은 바뀌지 않습니다."),
    createUiField("적 식별 색상", createSelect(), "색상과 표식을 함께 바꿉니다.", "valid"),
    createUiField("키 충돌", errorInput, "R 키는 이미 재장전에 사용 중입니다.", "error"),
    createUiField("실시간 적용", savingInput, "현재 실행에 값을 적용하고 있습니다.", "saving"),
    createUiField("설정 저장", document.createElement("input"), "이번 실행에는 적용됐지만 저장하지 못했습니다.", "save-failed"),
    createUiField("비활성 필드", disabledInput, "연결 상태가 안정되면 바꿀 수 있습니다.", "disabled"),
  );
  fields.append(fieldStack);

  const tabs = section("탭과 범례");
  const tabList = createUiTabs(["조작", "화면과 가독성", "소리"], 0);
  const disabledTab = tabList.querySelector<HTMLButtonElement>('[data-index="2"]');
  if (disabledTab) disabledTab.disabled = true;
  tabs.append(tabList);
  const tabPanels = [
    "현재 지정한 키와 마우스 감도를 확인합니다.",
    "적 식별 색상과 화면 움직임을 조정합니다.",
    "전투, 환경, 음악, 인터페이스 음량을 조정합니다.",
  ].map((copy, index) => {
    const panel = document.createElement("div");
    const tab = tabList.querySelector<HTMLButtonElement>(`[data-index="${index}"]`);
    panel.id = tab?.getAttribute("aria-controls") ?? `ui-tabs-panel-${index}`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab?.id ?? "");
    panel.hidden = index !== 0;
    panel.textContent = copy;
    tabs.append(panel);
    return panel;
  });
  tabList.addEventListener("click", event => {
    if (!(event.target instanceof HTMLButtonElement)) return;
    const index = Number(event.target.dataset.index);
    tabPanels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== index; });
  });
  tabs.append(createUiMapLegend([
    { label: "아군 A", tone: "ally", marker: "A" },
    { label: "적군 B", tone: "enemy", marker: "B" },
    { label: "미점령 C", tone: "neutral", marker: "C" },
  ]));

  const longText = section("긴 한국어와 빈 상태");
  const stress = document.createElement("p");
  longText.dataset.showcaseSection = "korean-long-text";
  stress.dataset.showcaseStress = "korean-long-text";
  stress.textContent = "통신 참호선 북측 폐허에서 가장 긴 이름을 가진 정찰병이 전장 연결 복구를 기다리고 있습니다. 연결이 끝나기 전에는 준비 완료나 명중 확인을 표시하지 않습니다.";
  const empty = createUiStatusRow("분대원 명단", "표시할 항목 없음");
  empty.dataset.state = "empty";
  longText.append(stress, empty);

  const modalStage = document.createElement("section");
  const modalBody = document.createElement("div");
  const modalFooter = document.createElement("footer");
  modalStage.className = "showcase-modal";
  modalStage.dataset.showcaseStress = "fixed-footer";
  modalBody.className = "showcase-modal-copy";
  for (const copy of [
    "경기 메뉴를 열어도 전투는 계속됩니다.",
    "본문이 길어지면 이 영역만 스크롤됩니다.",
    "연결이 끊기거나 저장에 실패해도 닫기와 다시 시도는 화면에 남습니다.",
    "훈련 단계는 한 번에 하나만 안내하고 현재 지정한 키를 사용합니다.",
  ]) {
    const paragraph = document.createElement("p");
    paragraph.textContent = copy;
    modalBody.append(paragraph);
  }
  const closeModal = createUiButton({ label: "닫기", tone: "accent" });
  closeModal.dataset.uiModalClose = "true";
  modalFooter.append(createUiButton({ label: "초기화" }), closeModal);
  const modal = createUiScrollModal("설정과 경기 메뉴", modalBody, modalFooter);
  const openModal = createUiButton({ label: "설정 메뉴 열기", tone: "accent" });
  openModal.dataset.showcaseAction = "open-modal";
  openModal.addEventListener("click", () => openUiScrollModal(modal, openModal));
  modalStage.append(openModal, modal);

  grid.append(buttons, statuses, keys, fields, tabs, longText, modalStage);
  body.append(grid);

  const footer = document.createElement("footer");
  const footerCopy = document.createElement("p");
  footer.className = "showcase-footer";
  footer.dataset.showcaseRegion = "fixed-footer";
  footerCopy.textContent = "본문만 스크롤 · 닫기와 주요 행동은 항상 접근 가능";
  footer.append(footerCopy, createUiButton({ label: "출격 화면으로", tone: "accent" }));
  root.append(header, body, footer);
  target.replaceChildren(root);

  return () => {
    root.remove();
    style.remove();
    document.documentElement.lang = previousLang;
  };
}
