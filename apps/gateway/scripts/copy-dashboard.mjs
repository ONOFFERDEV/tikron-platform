// Copy the built dashboard app into the gateway's static assets so the worker
// serves it under /dashboard/. Run after `pnpm --filter @playedge/dashboard build`.
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("../../dashboard/dist", import.meta.url));
const dest = fileURLToPath(new URL("../public/dashboard", import.meta.url));

if (!existsSync(src)) {
  console.error("dashboard dist not found — run: pnpm --filter @playedge/dashboard build");
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`dashboard assets -> ${dest}`);
