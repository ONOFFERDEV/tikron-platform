import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateScenarioResult } from "./aside-common.mjs";

export const ART_SCENARIOS = Object.freeze([
  Object.freeze({ id: "art-weapon", cases: Object.freeze(["five slots baseline", "sockets and bounds", "actual ADS", "missing mesh"]) }),
  Object.freeze({ id: "art-character", cases: Object.freeze(["two factions", "LOD", "shared-material mutation", "bad rig"]) }),
  Object.freeze({ id: "art-weapon-actions", cases: Object.freeze(["five reload and cycle timelines", "cancel/switch/death/reconnect", "readyAt mismatch"]) }),
  Object.freeze({ id: "art-character-poses", cases: Object.freeze(["five weapons times pose and aim grid", "head/torso samples", "death/reload/AOI entry"]) }),
  Object.freeze({ id: "art-scene", cases: Object.freeze(["all maps factions and distances", "all weapon actions", "colourblind mode", "asset404", "false ready", "stale part"]) }),
]);

export const ART_PROBE_RESULT_SCHEMA = Object.freeze({
  validationScope: "runtime-evidence",
  canonicalValidator: "aside-common.validateScenarioResult",
  handlerExport: "scenarioHandlers",
  handlerShape: "async(context) => ({ cases, inputProvenance, observations? })",
  verdicts: Object.freeze(["PASS", "FAIL", "UNQUALIFIED"]),
  inputProvenance: Object.freeze({ sourceSha: "40 lowercase hex", dirtyDiffSha256: "64 lowercase hex", assetManifestSha256: "64 lowercase hex", sessionId: "non-empty string", url: "non-empty string", viewport: "non-empty string" }),
  caseShape: Object.freeze({ id: "canonical case string", verdict: "PASS|FAIL|UNQUALIFIED", reasons: "PASS=[]; FAIL/UNQUALIFIED=non-empty {code}[]", observations: "non-empty object", artifacts: "non-empty {path,sha256,bytes}[]" }),
  context: Object.freeze(["definition", "url", "viewport", "outputDir", "repl.run", "sessionDir", "artifact helpers", "validateStages"]),
  policy: "Every canonical case appears exactly once with runtime provenance and non-empty evidence; missing, duplicate, extra, unknown, or evidence-free cases are invalid and nonzero.",
  authorContractPolicy: "--describe and --manifest-module validate the authoring contract only; they never assert runtime acceptance.",
});

export class ArtProbeContractError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "ArtProbeContractError";
    this.code = code;
    this.detail = detail;
  }
}

export function artScenarioDefinition(id) {
  const definition = ART_SCENARIOS.find((candidate) => candidate.id === id);
  if (definition === undefined) throw new ArtProbeContractError("unknown_scenario", id);
  return definition;
}

function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validArtifacts(value) {
  return Array.isArray(value) && value.length > 0 && value.every((artifact) => record(artifact)
    && typeof artifact.path === "string" && artifact.path.trim().length > 0
    && typeof artifact.sha256 === "string" && /^[0-9a-f]{64}$/.test(artifact.sha256)
    && Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
}

function validInputProvenance(value) {
  return record(value) && typeof value.sourceSha === "string" && /^[0-9a-f]{40}$/.test(value.sourceSha)
    && typeof value.dirtyDiffSha256 === "string" && /^[0-9a-f]{64}$/.test(value.dirtyDiffSha256)
    && typeof value.assetManifestSha256 === "string" && /^[0-9a-f]{64}$/.test(value.assetManifestSha256)
    && [value.sessionId, value.url, value.viewport].every((entry) => typeof entry === "string" && entry.trim().length > 0);
}

export function validateArtScenarioResult(id, result) {
  const definition = artScenarioDefinition(id);
  const issues = [];
  try {
    validateScenarioResult(definition, result);
  } catch (error) {
    if (error instanceof Error) return Object.freeze({ valid: false, scope: "runtime-evidence", canonicalCompatible: false, issues: Object.freeze([`canonical_result:${error.message}`]) });
    throw error;
  }
  if (!validInputProvenance(result.inputProvenance)) issues.push("invalid_input_provenance");
  if (result.observations !== undefined && (!record(result.observations) || Object.keys(result.observations).length === 0)) issues.push("invalid_result_observations");
  for (const item of result.cases) {
    if (!record(item.observations) || Object.keys(item.observations).length === 0) issues.push(`invalid_observations:${item.id}`);
    if (!validArtifacts(item.artifacts)) issues.push(`invalid_artifacts:${item.id}`);
  }
  return Object.freeze({ valid: issues.length === 0, scope: "runtime-evidence", canonicalCompatible: true, issues: Object.freeze(issues) });
}

async function writeJson(path, value) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  if (path === undefined) {
    process.stdout.write(content);
    return;
  }
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function run(argv) {
  const option = (name) => {
    const index = argv.indexOf(name);
    return index < 0 ? undefined : argv[index + 1];
  };
  if (argv.includes("--describe")) {
    await writeJson(option("--out"), { schemaVersion: 1, scenarios: ART_SCENARIOS, result: ART_PROBE_RESULT_SCHEMA });
    return;
  }
  const input = option("--validate");
  const scenario = option("--scenario");
  if (input !== undefined && scenario !== undefined) {
    const result = JSON.parse(await readFile(resolve(input), "utf8"));
    const validation = validateArtScenarioResult(scenario, result);
    await writeJson(option("--out"), validation);
    if (!validation.valid) process.exitCode = 1;
    return;
  }
  const modulePath = option("--manifest-module");
  if (modulePath !== undefined) {
    const contract = await import(pathToFileURL(resolve(modulePath)).href);
    if (typeof contract.auditWw1AssetManifest !== "function" || contract.WW1_ASSET_MANIFEST === undefined) throw new ArtProbeContractError("invalid_manifest_module", modulePath);
    const issues = contract.auditWw1AssetManifest(contract.WW1_ASSET_MANIFEST);
    await writeJson(option("--out"), { schemaVersion: 1, contractValidation: { scope: "author-contract", runtimeAccepted: false }, manifest: contract.WW1_ASSET_MANIFEST, issues, artProbe: { scenarios: ART_SCENARIOS, result: ART_PROBE_RESULT_SCHEMA } });
    if (issues.length !== 0) process.exitCode = 1;
    return;
  }
  throw new ArtProbeContractError("usage", "use --describe, --validate <json> --scenario <id>, or --manifest-module <compiled-module>");
}

const invokedPath = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) await run(process.argv.slice(2));
