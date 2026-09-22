export type MapInspectionPhase = 'preparing' | 'waiting-assets' | 'assets-ready'
  | 'waiting-render' | 'static-rendered' | 'sampling' | 'complete' | 'failed';

export type MapInspectionProgress = {
  phase: MapInspectionPhase;
  frameCount: number;
  readyForInspection: boolean;
  environmentLoading: boolean | null;
  performanceComplete: boolean;
  lastRafAt?: number;
  preparation?: unknown;
  error?: string;
};

type StaticInspection = {
  readonly progress: MapInspectionProgress;
  readonly prepare: () => Promise<void>;
  readonly readyForInspection: () => boolean;
  readonly render: () => void;
  readonly nextFrame: () => Promise<number>;
  readonly publish: (progress: Readonly<MapInspectionProgress>) => void;
};

export async function renderStaticInspection(inspection: StaticInspection): Promise<boolean> {
  const { progress, publish } = inspection;
  progress.phase = 'preparing';
  publish(progress);
  await inspection.prepare();
  progress.readyForInspection = inspection.readyForInspection();
  progress.environmentLoading = !progress.readyForInspection;
  if (!progress.readyForInspection) {
    progress.phase = 'waiting-assets';
    publish(progress);
    return false;
  }
  progress.phase = 'assets-ready';
  publish(progress);
  inspection.render();
  progress.phase = 'waiting-render';
  publish(progress);
  progress.lastRafAt = await inspection.nextFrame();
  inspection.render();
  progress.phase = 'static-rendered';
  publish(progress);
  return true;
}
