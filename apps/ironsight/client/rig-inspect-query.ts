/** Pure entry-point parser: absent/unknown inspect modes leave gameplay alone. */
export function parseRigInspect(search: string) {
  const q = new URLSearchParams(search);
  if (q.get("inspect") !== "rig") return null;
  const num = (key: string, fallback: number, min: number, max: number) => {
    const n = q.has(key) ? Number(q.get(key)) : fallback;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const pose = q.get("pose");
  const poses = ['idle', 'walk', 'run', 'sprint', 'crouch', 'crouch_walk', 'strafe_left', 'strafe_right', 'backpedal', 'crouch_left', 'crouch_right'] as const;
  const locomotion = poses.find(p => p === pose) ?? 'idle';
  return {
    weapon: Math.floor(num("weapon", 0, 0, 4)),
    pose: locomotion,
    yaw: num("yaw", 30, -360, 360), pitch: num("pitch", 10, -89, 89),
    dist: num("dist", 2.2, 0.2, 20),
    aim: num('aim', 0, -89, 89), sample: num('sample', 0.75, 0.2, 3),
    blend: q.has("blend") ? num("blend", 0, 0, 1) : undefined,
    arms: q.get("arms") !== "0",
  };
}
export type RigInspectOptions = NonNullable<ReturnType<typeof parseRigInspect>>;
