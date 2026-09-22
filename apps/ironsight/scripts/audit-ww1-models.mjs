import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { auditGlb } from "./ww1-glb-core.mjs";

class AuditCliError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "AuditCliError";
    this.code = code;
  }
}

function argumentsOf(argv) {
  const parsed = { inputs: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];
    if (token === "--input" && value) { parsed.inputs.push(value); index += 1; continue; }
    if (["--role", "--asset-key", "--manifest", "--report", "--expected-sha256"].includes(token) && value) {
      parsed[token.slice(2).replaceAll("-", "_")] = value;
      index += 1;
      continue;
    }
    throw new AuditCliError("invalid_argument", token);
  }
  if (!parsed.role || !parsed.report) throw new AuditCliError("usage", "--role and --report are required");
  if (!['weapon', 'weapon-support', 'soldier', 'environment'].includes(parsed.role)) throw new AuditCliError("invalid_role", parsed.role);
  return parsed;
}

async function loadManifest(path) {
  const absolute = resolve(path);
  const hash = createHash("sha256").update(await readFile(absolute)).digest("hex");
  const temporary = resolve(dirname(absolute), `.ww1-audit-${process.pid}-${Date.now()}.mjs`);
  try {
    await build({ entryPoints: [absolute], outfile: temporary, bundle: true, platform: "node", format: "esm", logLevel: "silent" });
    const module = await import(`${pathToFileURL(temporary).href}?v=${Date.now()}`);
    if (!module.WW1_ASSET_MANIFEST) throw new AuditCliError("manifest_export", path);
    return { manifest: module.WW1_ASSET_MANIFEST, sha256: hash };
  } finally {
    await rm(temporary, { force: true });
  }
}

function manifestInputs(role, manifest) {
  const entries = role === "weapon" ? manifest.weapons : role === "soldier" ? manifest.soldiers : role === "environment" ? manifest.environment : manifest.weaponSupport;
  if (!Array.isArray(entries)) throw new AuditCliError("manifest_role", role);
  return entries.map((entry) => ({ assetKey: entry.key ?? entry.faction, path: resolve("public", entry.publicUrl.replace(/^\/assets\//, "assets/")), expectedSha256: entry.provenance?.outputSha256 ?? undefined, requiredJoints: entry.requiredJoints }));
}

function explicitInputs(values, assetKey, expectedSha256, role, manifest) {
  return values.map((value) => {
    const separator = value.indexOf("=");
    const key = separator > 0 ? value.slice(0, separator) : assetKey;
    const path = separator > 0 ? value.slice(separator + 1) : value;
    if (!key) throw new AuditCliError("asset_key_required", value);
    const entries = role === "soldier" ? manifest?.soldiers : role === "weapon" ? manifest?.weapons : role === "environment" ? manifest?.environment : manifest?.weaponSupport;
    const contract = entries?.find((entry) => (entry.key ?? entry.faction) === key);
    return { assetKey: key, path: isAbsolute(path) ? path : resolve(path), expectedSha256: expectedSha256 ?? contract?.provenance?.outputSha256 ?? undefined, requiredJoints: contract?.requiredJoints };
  });
}

async function auditInput(entry, role) {
  try {
    const bytes = await readFile(entry.path);
    return { assetKey: entry.assetKey, path: entry.path, ...auditGlb(bytes, { role, assetKey: entry.assetKey, expectedSha256: entry.expectedSha256, requiredJoints: entry.requiredJoints }) };
  } catch (error) {
    return { assetKey: entry.assetKey, path: entry.path, valid: false, issues: [{ code: "input_read", path: entry.path, detail: error.message }] };
  }
}

async function main(argv) {
  const options = argumentsOf(argv);
  const loaded = options.manifest ? await loadManifest(options.manifest) : undefined;
  const inputs = options.inputs.length > 0
    ? explicitInputs(options.inputs, options.asset_key, options.expected_sha256, options.role, loaded?.manifest)
    : loaded ? manifestInputs(options.role, loaded.manifest) : [];
  if (inputs.length === 0) throw new AuditCliError("no_inputs", "use --input or --manifest");
  const files = [];
  for (const input of inputs) files.push(await auditInput(input, options.role));
  const report = {
    schemaVersion: 1, role: options.role, scope: "asset-bytes-audit", runtimeAccepted: false,
    manifestSha256: loaded?.sha256 ?? null, valid: files.every((file) => file.valid), files,
  };
  const reportPath = resolve(options.report);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ report: reportPath, valid: report.valid, files: files.length })}\n`);
  if (!report.valid) process.exitCode = 1;
}

await main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
});
