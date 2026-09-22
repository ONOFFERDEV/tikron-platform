import type { Stage33Faction, Stage33HitIdentity } from "../src/stage33-hit-calibration.js";
import {
  acquireCalibratedActor,
  type CalibratedActorTemplate,
} from "./calibrated-actor-loader.js";
import type { AssetLease } from "./shared-gltf-cache.js";

export type CalibratedActorAcquire = (
  team: number,
  identity: Stage33HitIdentity,
) => AssetLease<CalibratedActorTemplate>;

export class CalibratedActorSlots {
  private readonly leases = new Map<number, AssetLease<CalibratedActorTemplate>>();
  private readonly templates = new Map<number, CalibratedActorTemplate>();
  private pending = 0;
  private started = false;
  private disposed = false;

  constructor(
    private readonly identities: Readonly<Record<Stage33Faction, Stage33HitIdentity>>,
    private readonly ready: (team: number, template: CalibratedActorTemplate) => void,
    private readonly acquire: CalibratedActorAcquire = acquireCalibratedActor,
  ) {}

  start(): readonly Promise<void>[] {
    if (this.started || this.disposed) return [];
    this.started = true;
    this.pending = 2;
    return ([0, 1] as const).map(team => {
      const faction: Stage33Faction = team === 0 ? "khaki" : "fieldgrey";
      const lease = this.acquire(team, this.identities[faction]);
      this.leases.set(team, lease);
      return lease.value.then(template => {
        if (this.disposed || this.leases.get(team) !== lease) return;
        if (template === undefined) {
          lease.release();
          this.leases.delete(team);
          return;
        }
        this.templates.set(team, template);
        this.ready(team, template);
      }).finally(() => { this.pending -= 1; });
    });
  }

  settled(): boolean {
    return this.started && this.pending === 0;
  }

  template(team: number): CalibratedActorTemplate | undefined {
    return this.templates.get(team);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const lease of this.leases.values()) lease.release();
    this.leases.clear();
    this.templates.clear();
  }
}
