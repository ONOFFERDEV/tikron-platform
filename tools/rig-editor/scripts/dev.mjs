// scripts/dev.mjs — bundle client/main.ts, serve public/ on a fixed dev port, and
// mount the M3 Generate API (POST/GET /api/generate/...) in front of it.
//
// Uses esbuild's JS API (context + serve) rather than the CLI's `--serve` flag:
// the CLI flag ties the server's lifetime to stdin staying open, which breaks
// under any launcher that doesn't keep a live stdin (backgrounded/headless runs)
// — the JS API has no such coupling.
//
// esbuild's own serve() binds its own internal HTTP server and doesn't expose a
// way to plug custom routes into it, so it's given an INTERNAL-only port and a
// plain node:http server sits in front on the PUBLIC port: API requests are
// handled directly, everything else is reverse-proxied through untouched (esbuild
// docs' own recipe for combining a custom API with its live-rebuild serve).
import * as http from "node:http";
import * as esbuild from "esbuild";
import { isGenerateApiRoute, handleGenerateApi } from "./generate-api.mjs";

// RIG_EDITOR_PORT overrides the default 8642 (e.g. to run a second instance
// alongside one already occupying 8642 without touching it) — the internal
// esbuild port always follows one above it, so overriding the public port
// alone can't collide with another instance's internal port either.
const PUBLIC_PORT = Number(process.env.RIG_EDITOR_PORT) || 8642;
const ESBUILD_PORT = PUBLIC_PORT + 1; // internal only — reached solely via the proxy below

const ctx = await esbuild.context({
  entryPoints: ["client/main.ts"],
  bundle: true,
  format: "esm",
  outfile: "public/client.js",
  sourcemap: true,
});

await ctx.watch(); // rebuilds public/client.js on every save
await ctx.serve({ servedir: "public", port: ESBUILD_PORT, host: "127.0.0.1" });

function proxyToEsbuild(req, res) {
  const proxyReq = http.request(
    { host: "127.0.0.1", port: ESBUILD_PORT, path: req.url, method: req.method, headers: req.headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`esbuild serve proxy error: ${err.message}`);
  });
  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (isGenerateApiRoute(url.pathname, req.method ?? "GET")) {
    handleGenerateApi(req, res, url);
    return;
  }
  proxyToEsbuild(req, res);
});

server.listen(PUBLIC_PORT, "127.0.0.1", () => {
  console.log(`[rig-editor] serving http://127.0.0.1:${PUBLIC_PORT}`);
});

process.on("SIGINT", () => void ctx.dispose().then(() => process.exit(0)));
process.on("SIGTERM", () => void ctx.dispose().then(() => process.exit(0)));
