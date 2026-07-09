/**
 * Live click smoke — the M0 regression this guards: an empty full-screen <div>
 * stacked over the canvas swallowed every click, so pointer lock was never even
 * requested and the deployed game looked "dead" while every headless gate (which
 * bypassed the lock) stayed green. This drives the REAL click path.
 *
 *   node tools/live-smoke.mjs <url> [screenshot.png]
 *
 * Exit 0 = click engaged pointer lock on the canvas; 1 = it did not (or the page
 * failed to boot). puppeteer-core is resolved from the orchestrator scratchpad
 * (no repo dependency): set SMOKE_PUPPETEER_DIR to override.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const PUPPETEER_DIR =
  process.env.SMOKE_PUPPETEER_DIR ??
  "C:\\Users\\User\\AppData\\Local\\Temp\\claude\\D--\\f2c67c55-c897-43eb-99a5-16d16a42963b\\scratchpad";
const require = createRequire(join(PUPPETEER_DIR, "package.json"));
const puppeteer = require("puppeteer-core");

const url = process.argv[2];
const shot = process.argv[3];
if (!url) {
  console.error("usage: node tools/live-smoke.mjs <url> [screenshot.png]");
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--enable-unsafe-swiftshader", "--no-sandbox", "--mute-audio", "--disable-dev-shm-usage"],
});
let ok = false;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 2500)); // connect + first state
  await page.mouse.click(640, 360); // the user's actual gesture
  await new Promise((r) => setTimeout(r, 800));
  ok = await page.evaluate(
    () => document.pointerLockElement instanceof HTMLCanvasElement,
  );
  if (shot) {
    mkdirSync(dirname(shot), { recursive: true });
    await page.screenshot({ path: shot });
  }
  console.log(ok ? `SMOKE OK — click engaged pointer lock (${url})` : `SMOKE FAIL — no pointer lock after click (${url})`);
} catch (err) {
  ok = false;
  console.error(`SMOKE FAIL — ${err instanceof Error ? err.message : err}`);
} finally {
  await browser.close();
}
process.exit(ok ? 0 : 1);
