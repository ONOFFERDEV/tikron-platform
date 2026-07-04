// scripts/dev.mjs — rebuild the client bundle on every save + run the local edge
// server, in one cross-platform command (no shell `&`, works on cmd/pwsh/bash).
// esbuild's watch API re-bundles client/** and wrangler dev is spawned as a child.
// Uses Node built-ins + esbuild (already a devDependency) only — nothing new to install.
import { spawn } from "node:child_process";
import * as esbuild from "esbuild";

const BUILD = {
  entryPoints: ["client/main.ts"],
  bundle: true,
  format: "esm",
  outfile: "public/client.js",
  sourcemap: true,
};

let ctx;
try {
  ctx = await esbuild.context(BUILD);
  await ctx.rebuild(); // the first bundle wrangler will serve
} catch (err) {
  // A broken client/main.ts must fail LOUD and stop — an agent can't fix what it
  // can't see, and a silent stale bundle looks like "my edit did nothing".
  console.error(
    "\n[tikron] client bundle FAILED to build — fix client/main.ts, then re-run `npm run dev`.\n" +
      `${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
}

await ctx.watch(); // rebuild errors after this print to stderr via esbuild's logger
console.log(
  "[tikron] client bundle watching — every save rebuilds public/client.js automatically.\n" +
    "[tikron] NOTE: there is no browser auto-reload; refresh the tab to see a client change.",
);

// DEV_MODE=1 turns on dev-only room affordances (e.g. the maxClients override).
// `shell: true` lets Windows resolve the wrangler.cmd shim.
const wrangler = spawn("wrangler", ["dev", "--var", "DEV_MODE:1"], {
  stdio: "inherit",
  shell: true,
});

wrangler.on("error", (err) => {
  // spawn itself failed (wrangler not on PATH).
  console.error(
    "\n[tikron] could not start wrangler — is it installed? try: npm install\n" +
      `${err.message}\n`,
  );
  void stop(1);
});

wrangler.on("exit", (code) => {
  if (code) {
    // Non-zero exit = wrangler ran but bailed. Name the usual culprits so an agent
    // (or a non-dev) can self-correct instead of staring at a bare exit code.
    console.error(
      `\n[tikron] wrangler dev exited (code ${code}). Common causes:\n` +
        "  - wrangler not installed     -> npm install\n" +
        "  - port 8787 already in use   -> stop the other dev server, then retry\n" +
        "  - stale / missing login      -> npx wrangler whoami\n",
    );
  }
  void stop(code ?? 0);
});

let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  await ctx.dispose();
  wrangler.kill();
  process.exit(code);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
