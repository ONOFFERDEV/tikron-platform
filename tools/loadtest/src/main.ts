import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CliError, parseArgs, type Config } from "./cli.js";
import { formatSummary } from "./report.js";
import { buildSpecs, runLoad } from "./run.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  let config: Config | null;
  try {
    config = parseArgs(process.argv.slice(2));
  } catch (err) {
    if (err instanceof CliError) {
      process.stderr.write(`error: ${err.message}\n\nRun with --help for usage.\n`);
      process.exit(2);
    }
    throw err;
  }
  if (!config) return; // --help printed

  if (config.hz > 30) {
    process.stderr.write(
      `warning: --hz ${config.hz} exceeds the room input cap (30/s); excess inputs will be dropped and never acked.\n`,
    );
  }

  const specs = buildSpecs(config);
  process.stdout.write(
    `Starting: ${config.scenario} · ${specs.length} connections · ${config.workers} worker(s) · ` +
      `${(config.durationMs / 1000).toFixed(0)}s @ ${config.hz}Hz → ${config.url}\n`,
  );

  const report = await runLoad(config, specs);
  process.stdout.write(formatSummary(report));

  const outPath = await writeReport(config, report);
  process.stdout.write(`Report written: ${outPath}\n`);

  // Sockets and timers are closed; exit explicitly so a lingering handle can't hang.
  process.exit(0);
}

async function writeReport(config: Config, report: unknown): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const defaultPath = resolve(__dirname, "..", "results", `${ts}-${config.scenario}.json`);
  const outPath = config.out ? resolve(config.out) : defaultPath;
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return outPath;
}

void main();
