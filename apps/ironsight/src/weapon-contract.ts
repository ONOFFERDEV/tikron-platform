export const WEAPON_KEYS = [
  "automatic_rifle",
  "trench_smg",
  "pump_shotgun",
  "bolt_service_rifle",
  "service_pistol",
] as const;

export type WeaponKey = (typeof WEAPON_KEYS)[number];

export const FIRE_MODES = ["automatic", "semi"] as const;
export type FireMode = (typeof FIRE_MODES)[number];

export const RELOAD_KINDS = ["magazine", "pump", "stripper_clip"] as const;
export type ReloadKind = (typeof RELOAD_KINDS)[number];

export const SIGHT_KINDS = ["iron", "scope"] as const;
export type SightKind = (typeof SIGHT_KINDS)[number];

export type MagazineReload = {
  readonly reloadKind: "magazine";
  readonly reloadMs: number;
};

export type PumpReload = {
  readonly reloadKind: "pump";
  readonly reloadMs: number;
  readonly cycleMs: number;
  readonly reloadStartMs: number;
  readonly reloadInsertMs: number;
  readonly reloadEndMs: number;
};

export type StripperClipReload = {
  readonly reloadKind: "stripper_clip";
  readonly reloadMs: number;
  readonly cycleMs: number;
};

export type WeaponReload = MagazineReload | PumpReload | StripperClipReload;

export type WeaponIdentity = {
  readonly key: WeaponKey;
};

type WeaponContractValue = WeaponIdentity & WeaponReload & {
  readonly slot: number;
  readonly fireMode: FireMode;
  readonly sight: SightKind;
  readonly mag: number;
  readonly fireIntervalMs: number;
};

const FIRE_MODE_SET: ReadonlySet<string> = new Set(FIRE_MODES);
const RELOAD_KIND_SET: ReadonlySet<string> = new Set(RELOAD_KINDS);
const SIGHT_KIND_SET: ReadonlySet<string> = new Set(SIGHT_KINDS);

export function assertWeaponContract(config: { readonly weapons: readonly WeaponContractValue[] }): string[] {
  const errors: string[] = [];
  const seenKeys = new Set<string>();
  if (config.weapons.length !== WEAPON_KEYS.length) {
    errors.push(`weapons.length (${config.weapons.length}) must equal ${WEAPON_KEYS.length}`);
  }
  config.weapons.forEach((weapon, index) => {
    const label = `weapons[${index}]`;
    const expectedKey = WEAPON_KEYS[index];
    if (weapon.key !== expectedKey) {
      errors.push(`${label}.key must be "${expectedKey ?? "missing"}", got "${String(weapon.key)}"`);
    }
    if (seenKeys.has(weapon.key)) errors.push(`${label}.key "${weapon.key}" is duplicated`);
    seenKeys.add(weapon.key);
    if (weapon.slot !== index + 1 || !Number.isInteger(weapon.slot)) {
      errors.push(`${label}.slot must equal ${index + 1}, got ${weapon.slot}`);
    }
    if (!FIRE_MODE_SET.has(weapon.fireMode)) errors.push(`${label}.fireMode "${String(weapon.fireMode)}" is unsupported`);
    if (!RELOAD_KIND_SET.has(weapon.reloadKind)) errors.push(`${label}.reloadKind "${String(weapon.reloadKind)}" is unsupported`);
    if (!SIGHT_KIND_SET.has(weapon.sight)) errors.push(`${label}.sight "${String(weapon.sight)}" is unsupported`);
    if (!Number.isFinite(weapon.fireIntervalMs) || weapon.fireIntervalMs <= 0) {
      errors.push(`${label}.fireIntervalMs must be finite and positive`);
    }
    if (!Number.isFinite(weapon.reloadMs) || weapon.reloadMs <= 0) {
      errors.push(`${label}.reloadMs must be finite and positive`);
    }
    if (weapon.reloadKind === "pump") {
      const durations = [weapon.cycleMs, weapon.reloadStartMs, weapon.reloadInsertMs, weapon.reloadEndMs];
      if (durations.some((duration) => !Number.isFinite(duration) || duration <= 0)) {
        errors.push(`${label} pump cycle and reload stage durations must be finite and positive`);
      }
      const fullReloadMs = weapon.reloadStartMs + weapon.reloadInsertMs * weapon.mag + weapon.reloadEndMs;
      if (weapon.reloadMs !== fullReloadMs) {
        errors.push(`${label}.reloadMs (${weapon.reloadMs}) must equal full pump reload duration (${fullReloadMs})`);
      }
      if (weapon.cycleMs !== weapon.fireIntervalMs) errors.push(`${label}.cycleMs must equal fireIntervalMs`);
    }
    if (weapon.reloadKind === "stripper_clip") {
      if (!Number.isFinite(weapon.cycleMs) || weapon.cycleMs <= 0) {
        errors.push(`${label}.cycleMs must be finite and positive`);
      }
      if (weapon.cycleMs !== weapon.fireIntervalMs) errors.push(`${label}.cycleMs must equal fireIntervalMs`);
    }
  });
  return errors;
}

export class UnknownWeaponKeyError extends Error {
  constructor(public readonly key: WeaponKey) {
    super(`unknown weapon key: ${key}`);
    this.name = "UnknownWeaponKeyError";
  }
}

export function weaponByKey<T extends WeaponIdentity>(weapons: readonly T[], key: WeaponKey): T {
  const weapon = weapons.find((candidate) => candidate.key === key);
  if (weapon === undefined) throw new UnknownWeaponKeyError(key);
  return weapon;
}
