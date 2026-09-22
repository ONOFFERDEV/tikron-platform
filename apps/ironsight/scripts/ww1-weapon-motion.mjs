const CONTRACTS = Object.freeze({
  automatic_rifle: Object.freeze({
    magazine: Object.freeze({ pivotSocket: "magwell", translation: [0, -0.16, 0], rotationRadians: 0, visibility: "persistent" }),
    bolt: Object.freeze({ pivotSocket: "chamber", translation: [0, 0, -0.085], rotationRadians: 0, visibility: "persistent" }),
  }),
  trench_smg: Object.freeze({
    magazine: Object.freeze({ pivotSocket: "magwell", translation: [0, -0.16, 0], rotationRadians: 0, visibility: "persistent" }),
    bolt: Object.freeze({ pivotSocket: "chamber", translation: [0, 0, -0.085], rotationRadians: 0, visibility: "persistent" }),
  }),
  pump_shotgun: Object.freeze({
    pump: Object.freeze({ pivotSocket: "grip_l", translation: [0, 0, -0.12], rotationRadians: 0, visibility: "persistent" }),
    shell: Object.freeze({ pivotSocket: "chamber", translation: [0, -0.08, 0], rotationRadians: 0, visibility: "transient" }),
  }),
  bolt_service_rifle: Object.freeze({
    bolt: Object.freeze({ pivotSocket: "chamber", translation: [0, 0, -0.085], rotationRadians: 1, visibility: "persistent" }),
    clip: Object.freeze({ pivotSocket: "clip_mount", translation: [0, 0.08, 0], rotationRadians: 0, visibility: "transient" }),
  }),
  service_pistol: Object.freeze({
    slide: Object.freeze({ pivotSocket: "chamber", translation: [0, 0, -0.055], rotationRadians: 0, visibility: "persistent" }),
    magazine: Object.freeze({ pivotSocket: "magwell", translation: [0, -0.16, 0], rotationRadians: 0, visibility: "persistent" }),
  }),
});

const finiteVec3 = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const closeVec3 = (actual, expected, tolerance = 1e-4) => finiteVec3(actual)
  && actual.every((value, index) => Math.abs(value - expected[index]) <= tolerance);

export function auditWeaponMotion(byName, assetKey, socketPosition) {
  const issues = [];
  const contract = CONTRACTS[assetKey];
  if (contract === undefined) return issues;
  for (const [partName, expected] of Object.entries(contract)) {
    const entry = byName.get(partName);
    if (entry === undefined) continue;
    const extras = entry.node.extras;
    if (extras === undefined || typeof extras !== "object" || extras === null || extras.ww1MotionPivotSocket === undefined) {
      issues.push({ code: "missing_mechanism_motion", path: `nodes.${partName}.extras` });
      continue;
    }
    if (extras.ww1MotionPivotSocket !== expected.pivotSocket) {
      issues.push({ code: "mechanism_pivot", path: `nodes.${partName}.extras.ww1MotionPivotSocket` });
    } else {
      const partOrigin = socketPosition(partName);
      const pivot = socketPosition(expected.pivotSocket);
      if (!closeVec3(partOrigin, pivot, 1e-3)) issues.push({ code: "mechanism_pivot", path: `nodes.${partName}`, detail: { partOrigin, pivot } });
    }
    if (!closeVec3(extras.ww1MotionTranslation, expected.translation)) {
      issues.push({ code: "mechanism_translation", path: `nodes.${partName}.extras.ww1MotionTranslation` });
    }
    if (!closeVec3(extras.ww1MotionRotationAxis, [0, 0, 1]) || !Number.isFinite(extras.ww1MotionRotationRadians)
      || Math.abs(extras.ww1MotionRotationRadians - expected.rotationRadians) > 1e-4) {
      issues.push({ code: "mechanism_rotation", path: `nodes.${partName}.extras.ww1MotionRotation` });
    }
    if (extras.ww1MotionVisibility !== expected.visibility) {
      issues.push({ code: "mechanism_visibility", path: `nodes.${partName}.extras.ww1MotionVisibility` });
    }
  }
  return issues;
}

export const WW1_WEAPON_MOTION = CONTRACTS;
