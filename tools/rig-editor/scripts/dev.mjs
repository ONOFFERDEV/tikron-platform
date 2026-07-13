// scripts/dev.mjs — bundle client/main.ts and serve public/ on a fixed dev
// port. Uses esbuild's JS API (context + serve) rather than the CLI's
// `--serve` flag: the CLI flag ties the server's lifetime to stdin staying
// open, which breaks under any launcher that doesn't keep a live stdin
// (backgrounded/headless runs) — the JS API has no such coupling.
import * as esbuild from "esbuild";

const PORT = 8642;

const ctx = await esbuild.context({
  entryPoints: ["client/main.ts"],
  bundle: true,
  format: "esm",
  outfile: "public/client.js",
  sourcemap: true,
});

await ctx.watch(); // rebuilds public/client.js on every save
const { port } = await ctx.serve({ servedir: "public", port: PORT });
console.log(`[rig-editor] serving http://127.0.0.1:${port}`);

process.on("SIGINT", () => void ctx.dispose().then(() => process.exit(0)));
process.on("SIGTERM", () => void ctx.dispose().then(() => process.exit(0)));
