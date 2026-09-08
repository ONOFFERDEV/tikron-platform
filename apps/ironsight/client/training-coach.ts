import { formatBinding, type SettingsStore } from './settings.js';
import { TrainingProgress, type TrainingObjective } from './training-progress.js';

/** One peripheral lesson at a time; no input interception or render resources. */
export class TrainingCoach {
  readonly progress: TrainingProgress;
  private readonly card = document.createElement('aside');
  private readonly heading = document.createElement('strong');
  private readonly detail = document.createElement('p');
  private readonly track = document.createElement('div');
  private readonly guidance = document.createElement('div');
  private readonly hold = document.createElement('progress');
  private nextGuidanceAt = 0;
  private completedAt = Infinity;
  private lastStep = -1;
  private lastSettings: ReturnType<SettingsStore['get']> | null = null;

  constructor(hasTargets: boolean, private readonly settings: SettingsStore, objective?: TrainingObjective) {
    this.progress = new TrainingProgress(hasTargets, objective);
    this.card.id = 'trainingCoach';
    this.card.hidden = true;
    this.card.setAttribute('role', 'status');
    this.card.setAttribute('aria-live', 'polite');
    this.card.setAttribute('aria-atomic', 'true');
    const style = document.createElement('style');
    style.textContent = `#trainingCoach{position:fixed;left:28px;top:238px;width:250px;box-sizing:border-box;padding:16px 18px;background:#10242bf2;border-left:3px solid #edaa52;color:#e8efea;font:12px/1.5 system-ui;pointer-events:none;z-index:8}#trainingCoach[hidden]{display:none}#trainingCoach strong{display:block;font-size:14px;letter-spacing:.7px}#trainingCoach p{margin:8px 0 12px;color:#bdd0ce}#trainingCoach .steps{font-size:10px;letter-spacing:1px;color:#edaa52}#trainingCoach[data-step="3"]{border-color:#64c7cc}#trainingCoach[data-step="3"] .steps{color:#64c7cc}@media(max-height:650px),(max-width:800px){#trainingCoach{top:190px;left:16px;width:205px;padding:10px 12px;font-size:11px}}`;
    // Leave breathing room under the two-line connection panel on short/narrow screens.
    style.textContent += '@media(max-height:650px),(max-width:800px){#trainingCoach{top:202px}}';
    style.textContent += '#trainingCoach .guidance{margin:0 0 10px;color:#fff3cf;font-size:11px;letter-spacing:.5px}#trainingCoach progress{display:block;width:100%;height:5px;margin:8px 0 0;accent-color:#edaa52}#trainingCoach .guidance[hidden]{display:none}';
    style.textContent += '@media(max-width:800px){#matchBrief{top:110px;left:242px;right:16px;width:auto;transform:none;text-align:right}}';
    // Only step changes are live announcements, not the changing distance/timer.
    this.guidance.className = 'guidance';
    this.guidance.setAttribute('aria-live', 'off');
    this.guidance.hidden = true;
    this.guidance.append(document.createElement('span'), this.hold);
    this.hold.max = this.progress.objectiveHoldMs;
    this.hold.setAttribute('aria-label', 'Capture rehearsal hold progress');
    this.track.className = 'steps';
    this.card.append(this.heading, this.detail, this.guidance, this.track);
    document.head.append(style);
    document.body.append(this.card);
  }

  update(now: number, active: boolean, x: number, z: number, aiming: boolean, dt: number): void {
    this.progress.sample(active, x, z, aiming, dt);
    const step = this.progress.step;
    if (step === 3 && this.completedAt === Infinity) this.completedAt = now;
    this.card.hidden = !active || now - this.completedAt > 12000;
    this.guidance.hidden = step !== 4;
    if (step === 4 && now >= this.nextGuidanceAt) {
      this.nextGuidanceAt = now + 250;
      const p = this.progress, goal = p.objective!;
      const bearing = (Math.round(Math.atan2(goal.x - x, z - goal.z) / (Math.PI / 4)) + 8) % 8;
      const compass = ['NORTH', 'NORTH-EAST', 'EAST', 'SOUTH-EAST', 'SOUTH', 'SOUTH-WEST', 'WEST', 'NORTH-WEST'][bearing]!;
      this.guidance.firstElementChild!.textContent = p.objectiveDistance <= p.objectiveRadius
        ? `INSIDE A · HOLD ${(p.heldMs / 1000).toFixed(1)} / ${p.objectiveHoldMs / 1000} s`
        : `A · ${compass} · ${Math.ceil(p.objectiveDistance)} m`;
      this.hold.value = p.heldMs;
    }
    const settings = this.settings.get();
    if (step === this.lastStep && settings === this.lastSettings) return;
    this.lastStep = step; this.lastSettings = settings;
    this.card.dataset.step = String(step);
    const binds = settings.binds;
    const move = [binds.forward, binds.left, binds.back, binds.right].map(formatBinding).join(' / ');
    const total = 3 + Number(this.progress.hasTargets) + Number(!!this.progress.objective);
    const titles = ['01 / FIND YOUR FEET', '02 / STEADY YOUR AIM', '03 / LAND A HIT', 'TRAINING COMPLETE', '03 / HOLD OBJECTIVE A', `0${total} / MARK A ROUTE`];
    const details = [
      `${move} · Move four metres between cover. Use the minimap to keep your bearings.`,
      'Hold right mouse to aim down sights. Keep it steady for half a second.',
      'Left mouse · Hit a passive operator in West Service. The hit marker confirms your shot landed.',
      this.progress.objective ? 'In Domination, hold sites to score. Enemies in the zone stop capture; owned sites keep scoring after you leave. Esc → Deployment → Domination to play.'
        : this.progress.hasTargets ? `Try weapons 1–5 and ${formatBinding(binds.reload)} to reload. Esc → Deployment when you are ready for a match.`
        : 'This site is for exploration, with no targets. Esc → Deployment → Relay training for shooting practice.',
      `Find A on the minimap. Take the north aisle between the concrete screens. Stay within ${this.progress.objectiveRadius} m for ${this.progress.objectiveHoldMs / 1000} s. Rehearsal only; no score.`,
      binds.ping.length
        ? `Aim at a route, then press ${formatBinding(binds.ping)}. Look for + on the minimap and YOU / GO HERE. In team matches, allies see your mark for five seconds. Here, only you see it.`
        : 'Team ping has no key assigned. Esc → Settings → Team ping: choose a key, then resume and mark a route. Training waits for your mark.',
    ];
    const done = step === 5 ? total - 1 : step === 4 ? 2 + Number(this.progress.hasTargets) : step;
    const text = [titles[step]!, details[step]!, step === 3 ? `${total} / ${total} COMPLETE · FREE PRACTICE` : `${done} / ${total} COMPLETE · TRAINING`];
    [this.heading, this.detail, this.track].forEach((node, i) => { if (node.textContent !== text[i]) node.textContent = text[i]!; });
  }
}
