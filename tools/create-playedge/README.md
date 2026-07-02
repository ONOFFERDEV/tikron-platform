# create-playedge

Scaffolder for [PlayEdge](../../AGENTS.md) games — a realtime multiplayer BaaS for web
games on Cloudflare Workers + Durable Objects.

## Usage

```bash
npx create-playedge <project-name> [options]
```

Inside this monorepo, run it via the workspace (v1 executes with `tsx`, exactly like
`tools/loadtest`):

```bash
pnpm --filter create-playedge start -- my-game --template starter
```

### Modes

- **Clone (default)** — shallow-clones the PlayEdge platform repo into `./<project-name>`
  and prints the next steps (`pnpm install`, edit the room, `dev`, `deploy`).
- **`--template starter`** — copies `examples/starter` into a new workspace directory
  (`examples/<name>` inside this monorepo) with the package name rewritten. Use this to
  add another example alongside the starter.

### Options

| Flag | Meaning |
|---|---|
| `--repo <git-url>` | Repo URL for clone mode (overrides `repository.url` in this package's `package.json`). |
| `--into <dir>` | Base directory for the new project. Default: cwd (clone) or `<repo-root>/examples` (template). |
| `-h`, `--help` | Show help. |

## Why v1 clones the repo (and the future)

The `@playedge/*` packages (`@playedge/server`, `@playedge/client`, `@playedge/schema`,
`@playedge/protocol`) are **not yet published to npm**. A scaffolded project depends on
them via `workspace:*`, so it must live inside this monorepo to resolve. Therefore:

- **Clone mode** gives a user the whole platform (SDK + starter + demos) in one command,
  which is the honest way to try PlayEdge today.
- **Template mode** adds a new example *inside* the workspace, where `workspace:*` links
  resolve.

**Deliberately:** once `@playedge/*` is published to npm, this becomes a true standalone
scaffold — `create-playedge` would write a fresh project directory anywhere on disk with
`@playedge/server` etc. as normal `^`-versioned dependencies (no clone, no monorepo
requirement). The copy/rewrite/next-steps machinery here is the same; only the dependency
source changes. Until then, clone or template mode is the correct behavior.

### Setting the clone URL

Clone mode needs a git URL. Either pass `--repo <git-url>`, or set `repository.url` in
this package's `package.json` (it ships empty because this repo has no fixed public
remote yet). If neither is set, clone mode exits with guidance and suggests
`--template starter`.
