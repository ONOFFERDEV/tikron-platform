#!/usr/bin/env -S npx tsx
/**
 * create-tikron — scaffold a Tikron game.
 *
 * v1 (honest): the @tikron/* packages are NOT yet on npm, so the default mode
 * shallow-clones the Tikron platform repo and prints the next steps. `--template
 * starter` instead copies `examples/starter` into a new workspace directory inside
 * this monorepo (for adding another example locally). When @tikron/* is published,
 * this becomes a true standalone scaffold — see the README.
 *
 * Zero runtime dependencies (Node >= 22 built-ins only); run via tsx like tools/loadtest.
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Directory/file basenames never copied from a template (build output, deps). */
const TEMPLATE_EXCLUDE = new Set(["node_modules", "dist", ".turbo", ".wrangler"]);

interface Options {
  name: string;
  template: string | null;
  repo: string | null;
  into: string | null;
  help: boolean;
}

const HELP = `create-tikron — scaffold a Tikron game

Usage:
  npx create-tikron <project-name> [options]

Modes:
  (default)              Shallow-clone the Tikron platform repo into ./<project-name>.
                         Needs a repo URL: pass --repo, or set "repository.url" in this
                         package's package.json (@tikron/* is not on npm yet).
  --template starter     Copy examples/starter into a new workspace dir (examples/<name>
                         inside this monorepo) with the package name rewritten.

Options:
  --repo <git-url>       Repo URL for clone mode (overrides package.json repository.url).
  --into <dir>           Base directory for the new project (default: cwd in clone mode,
                         <repo-root>/examples in --template mode).
  -h, --help             Show this help.

Examples:
  npx create-tikron my-game
  npx create-tikron my-game --repo https://github.com/you/webgame-baas.git
  npx create-tikron my-arena --template starter
`;

function parseArgs(argv: string[]): Options {
  const opts: Options = { name: "", template: null, repo: null, into: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "-h" || arg === "--help") {
      opts.help = true;
    } else if (arg === "--template") {
      opts.template = argv[++i] ?? null;
    } else if (arg === "--repo") {
      opts.repo = argv[++i] ?? null;
    } else if (arg === "--into") {
      opts.into = argv[++i] ?? null;
    } else if (arg.startsWith("--template=")) {
      opts.template = arg.slice("--template=".length);
    } else if (arg.startsWith("--repo=")) {
      opts.repo = arg.slice("--repo=".length);
    } else if (arg.startsWith("--into=")) {
      opts.into = arg.slice("--into=".length);
    } else if (arg.startsWith("-")) {
      throw new Error(`unknown option: ${arg}`);
    } else if (!opts.name) {
      opts.name = arg;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
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

/** Walk up from a directory to the monorepo root (the dir holding pnpm-workspace.yaml). */
function findRepoRoot(start: string): string {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error("could not locate the monorepo root (pnpm-workspace.yaml)");
    dir = parent;
  }
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

/** Skip generated build artifacts (gitignored): sourcemaps + bundled JS under public/. */
function isGeneratedArtifact(parentIsPublic: boolean, name: string): boolean {
  return name.endsWith(".map") || (parentIsPublic && name.endsWith(".js"));
}

/** Recursively copy a directory, skipping build/dep dirs and generated artifacts. */
function copyTemplate(src: string, dest: string, parentIsPublic = false): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    if (TEMPLATE_EXCLUDE.has(entry)) continue;
    const from = join(src, entry);
    const to = join(dest, entry);
    if (statSync(from).isDirectory()) copyTemplate(from, to, entry === "public");
    else if (!isGeneratedArtifact(parentIsPublic, entry)) cpSync(from, to);
  }
}

/** Rewrite the "name" field of a JSON package.json in place. */
function rewritePackageName(pkgPath: string, name: string): void {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
  pkg.name = name;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

/** Rewrite the wrangler `name` (jsonc, comment-preserving regex). */
function rewriteWranglerName(dir: string, name: string): void {
  const path = join(dir, "wrangler.jsonc");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  writeFileSync(path, text.replace(/("name"\s*:\s*")[^"]*(")/, `$1${name}$2`));
}

function runClone(name: string, repo: string, into: string): void {
  const dest = resolve(into, name);
  if (existsSync(dest)) throw new Error(`destination already exists: ${dest}`);
  process.stdout.write(`Cloning ${repo} -> ${dest}\n`);
  execFileSync("git", ["clone", "--depth", "1", repo, dest], { stdio: "inherit" });
  process.stdout.write(
    `\nDone. Next steps:\n` +
      `  cd ${name}\n` +
      `  pnpm install\n` +
      `  # edit the room: examples/starter/src/arena-room.ts (state shape + onMessage handlers)\n` +
      `  pnpm --filter tikron-starter dev       # http://127.0.0.1:8787 (open 2 tabs)\n` +
      `  pnpm exec wrangler login                 # once\n` +
      `  pnpm --filter tikron-starter deploy    # ship to Cloudflare's edge\n\n` +
      `Read AGENTS.md and .claude/skills/tikron/SKILL.md in the clone before you build.\n`,
  );
}

function runTemplate(name: string, template: string, into: string | null): void {
  if (template !== "starter") {
    throw new Error(`unknown template: "${template}" (only "starter" is available)`);
  }
  const repoRoot = findRepoRoot(__dirname);
  const src = join(repoRoot, "examples", "starter");
  if (!existsSync(src)) throw new Error(`starter template not found at ${src}`);
  const baseDir = into ? resolve(into) : join(repoRoot, "examples");
  const dest = join(baseDir, name);
  if (existsSync(dest)) throw new Error(`destination already exists: ${dest}`);

  copyTemplate(src, dest);
  rewritePackageName(join(dest, "package.json"), name);
  rewriteWranglerName(dest, name);

  process.stdout.write(
    `Created workspace from the starter template:\n  ${dest}\n\n` +
      `This is a NEW workspace member (package "${name}"). Next steps:\n` +
      `  pnpm install                       # link it into the workspace\n` +
      `  pnpm --filter ${name} typecheck\n` +
      `  pnpm --filter ${name} dev          # http://127.0.0.1:8787\n` +
      `  pnpm --filter ${name} deploy       # after: pnpm exec wrangler login\n\n` +
      `Edit src/arena-room.ts to make it your game.\n`,
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

  try {
    if (opts.template) {
      runTemplate(name, opts.template, opts.into);
    } else {
      const repo = opts.repo?.trim() || ownRepoUrl();
      if (!repo) {
        throw new Error(
          "no repository URL. Pass --repo <git-url>, or set repository.url in " +
            "create-tikron's package.json (the @tikron/* packages are not on npm yet — see README). " +
            'Or use "--template starter" to copy the starter inside this monorepo.',
        );
      }
      runClone(name, repo, resolve(opts.into ?? process.cwd()));
    }
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    process.exit(1);
  }
}

main();
