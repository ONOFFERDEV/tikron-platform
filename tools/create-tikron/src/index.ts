#!/usr/bin/env node
/**
 * create-tikron — scaffold a Tikron multiplayer game.
 *
 * Default (standalone): `npx create-tikron my-game` generates a self-contained project
 * whose `@tikron/*` dependencies install from npm — no monorepo, no clone. The project
 * files are shipped inside this package's `templates/` dir (see `files` in package.json),
 * so the scaffolder works from a published tarball with zero network beyond `npm install`.
 *
 * Secondary (`--clone`): shallow-clone the whole platform repo (SDK + demos) instead —
 * useful for exploring the internals or contributing.
 *
 * Zero runtime dependencies: Node >= 22 built-ins only.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Project templates live next to the compiled entry: <package>/dist/index.js → <package>/templates. */
const TEMPLATES_DIR = join(__dirname, "..", "templates");

/** Published @tikron/* version range the generated project depends on. */
const TIKRON_VERSION = "^0.3.0";

interface Options {
  name: string;
  clone: boolean;
  repo: string | null;
  into: string | null;
  help: boolean;
}

const HELP = `create-tikron — scaffold a Tikron multiplayer game

Usage:
  npx create-tikron <project-name> [options]

By default this generates a STANDALONE project in ./<project-name> whose @tikron/*
dependencies install from npm. No monorepo, no clone.

Options:
  --clone                Instead, shallow-clone the whole Tikron platform repo (SDK +
                         demos). Needs a repo URL: --repo, or repository.url in this
                         package's package.json.
  --repo <git-url>       Repo URL for --clone mode (overrides package.json repository.url).
  --into <dir>           Parent directory for the new project (default: current dir).
  -h, --help             Show this help.

Examples:
  npx create-tikron my-game
  npx create-tikron my-game --into ./games
  npx create-tikron my-game --clone
`;

function parseArgs(argv: string[]): Options {
  const opts: Options = { name: "", clone: false, repo: null, into: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "-h" || arg === "--help") opts.help = true;
    else if (arg === "--clone") opts.clone = true;
    else if (arg === "--repo") opts.repo = argv[++i] ?? null;
    else if (arg === "--into") opts.into = argv[++i] ?? null;
    else if (arg.startsWith("--repo=")) opts.repo = arg.slice("--repo=".length);
    else if (arg.startsWith("--into=")) opts.into = arg.slice("--into=".length);
    else if (arg.startsWith("-")) throw new Error(`unknown option: ${arg}`);
    else if (!opts.name) opts.name = arg;
    else throw new Error(`unexpected argument: ${arg}`);
  }
  return opts;
}

/** Normalize a project name to a safe directory / npm package name. */
function sanitizeName(raw: string): string {
  const name = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!name) throw new Error(`invalid project name: "${raw}"`);
  return name;
}

/** The generated project's package.json (deps resolve from npm). */
function packageJson(name: string): string {
  const pkg = {
    name,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      // esbuild is inlined (not `pnpm build:client`) so the project works with any
      // package manager — npm, pnpm, yarn, or bun.
      dev: "esbuild client/main.ts --bundle --format=esm --outfile=public/client.js --sourcemap && wrangler dev",
      deploy:
        "esbuild client/main.ts --bundle --format=esm --outfile=public/client.js --sourcemap && wrangler deploy",
      build:
        "esbuild client/main.ts --bundle --format=esm --outfile=public/client.js --sourcemap && wrangler deploy --dry-run --outdir dist",
      "build:client": "esbuild client/main.ts --bundle --format=esm --outfile=public/client.js --sourcemap",
      typecheck: "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.client.json --noEmit",
    },
    dependencies: {
      "@tikron/client": TIKRON_VERSION,
      "@tikron/schema": TIKRON_VERSION,
      "@tikron/server": TIKRON_VERSION,
      "@tikron/sim": TIKRON_VERSION,
      partyserver: "^0.5.8",
    },
    devDependencies: {
      "@cloudflare/workers-types": "^4.20260701.1",
      esbuild: "^0.28.1",
      typescript: "^5.7.3",
      wrangler: "^4.106.0",
    },
  };
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

/** Copy the templates tree into `dest`, substituting the project name in wrangler.jsonc. */
function copyTemplates(srcDir: string, destDir: string, name: string): void {
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const from = join(srcDir, entry);
    const to = join(destDir, entry);
    if (statSync(from).isDirectory()) {
      copyTemplates(from, to, name);
    } else if (entry === "wrangler.jsonc") {
      writeFileSync(to, readFileSync(from, "utf8").replace(/__PROJECT_NAME__/g, name));
    } else {
      cpSync(from, to);
    }
  }
}

function scaffoldStandalone(name: string, into: string): void {
  const dest = resolve(into, name);
  if (existsSync(dest)) throw new Error(`destination already exists: ${dest}`);
  if (!existsSync(TEMPLATES_DIR)) {
    throw new Error(`templates not found at ${TEMPLATES_DIR} (is the package built and packed correctly?)`);
  }
  copyTemplates(TEMPLATES_DIR, dest, name);
  writeFileSync(join(dest, "package.json"), packageJson(name));

  process.stdout.write(
    `Created ./${name} — a standalone Tikron game.\n\n` +
      `Next steps:\n` +
      `  cd ${name}\n` +
      `  npm install                  # or pnpm / yarn / bun\n` +
      `  # edit your game: src/arena-room.ts (state shape + onMessage handlers)\n` +
      `  npm run dev                  # http://127.0.0.1:8787 (open 2 tabs)\n` +
      `  npx wrangler login           # once\n` +
      `  npm run deploy               # ship to YOUR Cloudflare account\n\n` +
      `Docs: https://tikron.dev · the room API is in AGENTS.md.\n`,
  );
}

/** Read this package's own repository.url, if set. */
function ownRepoUrl(): string | null {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
      repository?: { url?: string };
    };
    const url = pkg.repository?.url?.trim();
    return url ? url : null;
  } catch {
    return null;
  }
}

function scaffoldClone(name: string, repo: string, into: string): void {
  const dest = resolve(into, name);
  if (existsSync(dest)) throw new Error(`destination already exists: ${dest}`);
  process.stdout.write(`Cloning ${repo} -> ${dest}\n`);
  execFileSync("git", ["clone", "--depth", "1", repo, dest], { stdio: "inherit" });
  process.stdout.write(
    `\nDone. Next steps:\n` +
      `  cd ${name}\n` +
      `  pnpm install\n` +
      `  pnpm --filter tikron-starter dev       # http://127.0.0.1:8787\n` +
      `  pnpm --filter tikron-starter deploy    # after: pnpm exec wrangler login\n\n` +
      `Read AGENTS.md and .claude/skills/tikron/SKILL.md in the clone before you build.\n`,
  );
}

function main(): void {
  let opts: Options;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n\nRun with --help for usage.\n`);
    process.exit(2);
  }

  if (opts.help || !opts.name) {
    process.stdout.write(HELP);
    process.exit(opts.help ? 0 : 2);
  }

  const name = sanitizeName(opts.name);
  const into = resolve(opts.into ?? process.cwd());

  try {
    if (opts.clone) {
      const repo = opts.repo?.trim() || ownRepoUrl();
      if (!repo) {
        throw new Error(
          "--clone needs a repository URL: pass --repo <git-url>, or set repository.url in " +
            "create-tikron's package.json.",
        );
      }
      scaffoldClone(name, repo, into);
    } else {
      scaffoldStandalone(name, into);
    }
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    process.exit(1);
  }
}

main();
