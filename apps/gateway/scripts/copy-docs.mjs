// copy-docs.mjs — stage the repo-root AI briefs into apps/gateway/public/ so the
// gateway (tikron.dev) serves them as static assets: /llms.txt, /llms-full.txt,
// /AGENTS.md. Run at build + predeploy so the deployed copy always tracks the
// canonical root docs (owned by the doc-integration wave), no manual sync.
//
// Node built-ins only — no new dependency, and it never fails the build: a
// missing source is warned and skipped (the doc wave may not have landed a file
// yet), so `wrangler deploy` still ships.
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)); // apps/gateway/scripts
const repoRoot = join(here, "..", "..", ".."); // → repo root
const publicDir = join(here, "..", "public"); // apps/gateway/public
const FILES = ["llms.txt", "llms-full.txt", "AGENTS.md"];

await mkdir(publicDir, { recursive: true });

let copied = 0;
for (const f of FILES) {
  try {
    await copyFile(join(repoRoot, f), join(publicDir, f));
    copied++;
    console.log(`[copy-docs] ${f} → public/`);
  } catch (err) {
    console.warn(`[copy-docs] skip ${f}: ${err instanceof Error ? err.message : err}`);
  }
}
console.log(`[copy-docs] staged ${copied}/${FILES.length} doc(s) into public/`);
