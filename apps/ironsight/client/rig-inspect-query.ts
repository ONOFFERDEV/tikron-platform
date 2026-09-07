/** Pure entry-point parser: absent/unknown inspect modes leave gameplay alone. */
export function parseRigInspect(search: string) {
  const q = new URLSearchParams(search);
  if (q.get("inspect") !== "rig") return null;
  const num = (key: string, fallback: number, min: number, max: number) => {
    const n = q.has(key) ? Number(q.get(key)) : fallback;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const pose = q.get("pose");
  const locomotion: "idle" | "walk" | "run" | "crouch" =
    pose === "walk" || pose === "run" || pose === "crouch" ? pose : "idle";
  return {
    weapon: Math.floor(num("weapon", 0, 0, 4)),
    pose: locomotion,
    yaw: num("yaw", 30, -360, 360), pitch: num("pitch", 10, -89, 89),
    dist: num("dist", 2.2, 0.2, 20),
    blend: q.has("blend") ? num("blend", 0, 0, 1) : undefined,
    arms: q.get("arms") !== "0",
  };
}
export type RigInspectOptions = NonNullable<ReturnType<typeof parseRigInspect>>;
