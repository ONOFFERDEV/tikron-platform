import { formatBinding, type SettingsStore } from './settings.js';
import { TrainingProgress } from './training-progress.js';

/** One peripheral lesson at a time; no input interception or render resources. */
export class TrainingCoach {
  readonly progress: TrainingProgress;
  private readonly card = document.createElement('aside');
  private readonly heading = document.createElement('strong');
  private readonly detail = document.createElement('p');
  private readonly track = document.createElement('div');
  private completedAt = Infinity;
  private lastStep = -1;
  private lastSettings: ReturnType<SettingsStore['get']> | null = null;

  constructor(hasTargets: boolean, private readonly settings: SettingsStore) {
    this.progress = new TrainingProgress(hasTargets);
    this.card.id = 'trainingCoach';
    this.card.hidden = true;
    this.card.setAttribute('role', 'status');
    this.card.setAttribute('aria-live', 'polite');
    this.card.setAttribute('aria-atomic', 'true');
    const style = document.createElement('style');
    style.textContent = `#trainingCoach{position:fixed;left:28px;top:238px;width:250px;box-sizing:border-box;padding:16px 18px;background:#10242bf2;border-left:3px solid #edaa52;color:#e8efea;font:12px/1.5 system-ui;pointer-events:none;z-index:8}#trainingCoach[hidden]{display:none}#trainingCoach strong{display:block;font-size:14px;letter-spacing:.7px}#trainingCoach p{margin:8px 0 12px;color:#bdd0ce}#trainingCoach .steps{font-size:10px;letter-spacing:1px;color:#edaa52}#trainingCoach[data-step="3"]{border-color:#64c7cc}#trainingCoach[data-step="3"] .steps{color:#64c7cc}@media(max-height:650px),(max-width:800px){#trainingCoach{top:190px;left:16px;width:205px;padding:10px 12px;font-size:11px}}`;
    this.track.className = 'steps';
    this.card.append(this.heading, this.detail, this.track);
    document.head.append(style);
    document.body.append(this.card);
  }

  update(now: number, active: boolean, x: number, z: number, aiming: boolean, dt: number): void {
    this.progress.sample(active, x, z, aiming, dt);
    const step = this.progress.step;
    if (step === 3 && this.completedAt === Infinity) this.completedAt = now;
    this.card.hidden = !active || now - this.completedAt > 12000;
    const settings = this.settings.get();
    if (step === this.lastStep && settings === this.lastSettings) return;
    this.lastStep = step; this.lastSettings = settings;
    this.card.dataset.step = String(step);
    const binds = settings.binds;
    const move = [binds.forward, binds.left, binds.back, binds.right].map(formatBinding).join(' / ');
    const titles = ['01 / FIND YOUR FEET', '02 / STEADY YOUR AIM', '03 / LAND A HIT', 'BASICS COMPLETE'];
    const details = [
      `${move} · Move four metres between cover. Use the minimap to keep your bearings.`,
      'Hold right mouse to aim down sights. Keep it steady for half a second.',
      'Left mouse · Hit a passive operator in West Service. The hit marker confirms your shot landed.',
      this.progress.hasTargets ? `Try weapons 1–5 and ${formatBinding(binds.reload)} to reload. Esc → Deployment when you are ready for a match.`
        : 'This site is for exploration, with no targets. Esc → Deployment → Relay training for shooting practice.',
    ];
    const total = this.progress.hasTargets ? 3 : 2;
    const text = [titles[step]!, details[step]!, step === 3 ? `${total} / ${total} COMPLETE · FREE PRACTICE` : `${step} / ${total} COMPLETE · TRAINING`];
    [this.heading, this.detail, this.track].forEach((node, i) => { if (node.textContent !== text[i]) node.textContent = text[i]!; });
  }
}
