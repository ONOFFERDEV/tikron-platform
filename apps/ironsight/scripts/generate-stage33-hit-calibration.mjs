import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const SOURCE_SHA256 = "4e32de0849cc8b7012788583e1a414fe6c7911337ba336dff76974165d420e7a";
const REVIEW_SHA256 = "b3257efa71fdbbce0d30bbcfb523077836f7830279c67af452c0177cc65a1f1b";
const CLIP_TABLE_SHA256 = "13dfcd2a23e44af6e491c7e8f11934db3f9ad25901019a7523199a3b7b56fc12";
const SCENE_SHA256 = "dade2f2e28ed8f021261b718638143477f34114a50f6ab1bc08ed3a93977739b";
const RIG_LOADER_SHA256 = "c6d43461ea77b0921a4d7eef928d5a4f4250c5cd12c13f9e3bc20fe864c5e1bd";
const SAMPLER_SHA256 = "c442b198fdf91e40745530605fac55bb765511b9099df9b6e8d3fe069bd503e3";
const NORMALIZATION_SHA256 = "c78b21e423da0d57a737ed66b782c38c84d3b7f04036cc765308ea62e6a65387";
const HIT_COMPONENTS = {
  khaki: "94493e3e0d27d4e7d2da0697f315312c6aec73540bc24e8bc6a3967881b71887",
  fieldgrey: "d51dcc3dbfc18fa34dbd641db38fb54b40d4df1f354954ea2938032fba619d47",
};

const [sourcePath, outputPath] = process.argv.slice(2);
if (sourcePath === undefined || outputPath === undefined) {
  throw new Error("usage: generate-stage33-hit-calibration.mjs <adaptive-phase-v3.json> <output.json>");
}

const sourceBytes = await readFile(sourcePath);
const sourceHash = createHash("sha256").update(sourceBytes).digest("hex");
if (sourceHash !== SOURCE_SHA256) throw new Error(`unexpected source SHA-256 ${sourceHash}`);
const source = JSON.parse(sourceBytes.toString("utf8"));
if (source.schemaVersion !== 2 || source.activation !== false || source.tables?.length !== 60
  || source.actualRows?.length !== 6220 || source.validations?.length !== 3080) {
  throw new Error("unexpected adaptive source schema or counts");
}

const rows = new Map(source.actualRows.map(row => [
  `${row.faction}:${row.clip}:${row.fraction}`,
  row,
]));
const tables = source.tables.map(table => ({
  faction: table.faction,
  clip: table.clip,
  duration: table.duration,
  knots: table.knots.map(fraction => {
    const row = rows.get(`${table.faction}:${table.clip}:${fraction}`);
    if (row === undefined) throw new Error(`missing measured knot ${table.faction}:${table.clip}:${fraction}`);
    return [fraction, row.head.center, row.head.radius, row.torso.topY];
  }),
}));
const knotCount = tables.reduce((count, table) => count + table.knots.length, 0);
if (knotCount !== 830) throw new Error(`unexpected knot count ${knotCount}`);
const metrics = ["headCenterM", "headRadiusM", "torsoTopYM"];
const validationWitnesses = metrics.map(metric => {
  const validation = source.validations.reduce((worst, candidate) =>
    candidate.errors[metric] > worst.errors[metric] ? candidate : worst);
  const row = rows.get(`${validation.faction}:${validation.clip}:${validation.fraction}`);
  if (row === undefined) throw new Error(`missing held-out witness for ${metric}`);
  return {
    metric,
    faction: validation.faction,
    clip: validation.clip,
    fraction: validation.fraction,
    errorM: validation.errors[metric],
    actual: [row.head.center, row.head.radius, row.torso.topY],
  };
});

const compact = {
  schemaVersion: 2,
  activation: false,
  sourceDatasetSha256: SOURCE_SHA256,
  independentReviewSha256: REVIEW_SHA256,
  clipTableSha256: CLIP_TABLE_SHA256,
  sceneRuntimeSha256: SCENE_SHA256,
  rigLoaderRuntimeSha256: RIG_LOADER_SHA256,
  samplerSha256: SAMPLER_SHA256,
  normalizationTransformSha256: NORMALIZATION_SHA256,
  hitComponentBindings: HIT_COMPONENTS,
  interpolationBudgetM: 0.005,
  sourceToleranceM: source.toleranceM,
  knotCount,
  bindings: source.bindings,
  tables,
  validationWitnesses,
};
await writeFile(outputPath, `${JSON.stringify(compact)}\n`, "utf8");
