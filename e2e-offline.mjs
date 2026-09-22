/*
 * e2e-offline.mjs — proves the whole observatory survives airplane mode.
 *
 *   Run:       node e2e-offline.mjs
 *   Requires:  python3 serve.py            (site on http://127.0.0.1:8877;
 *                                           if the port is down this script
 *                                           says so and exits 2)
 *   Companion: node kernel-regression.test.js
 *
 * Sequence: visit all 6 pages online → wait for serviceWorker.ready on each →
 * 3 s warm-up (runtime cache fills) → context goes offline → reload all 6
 * pages, asserting each one loads from the service-worker cache AND that
 * ShunyaMath.canonicalGrahaModel still computes 9 finite longitudes.
 * Any pageerror event (online or offline) fails the run. Exits 1 on failure.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("./node_modules/playwright/index.js");

const BASE = "http://127.0.0.1:8877";
const PAGES = [
  "index.html",
  "museum.html",
  "library.html",
  "panchang.html",
  "shunyabheda.html",
  "shoonya_sovereign_dashboard.html",
];

/* ── 0 · Is serve.py up? ─────────────────────────────────────────────── */
try {
  const probe = await fetch(`${BASE}/index.html`, { signal: AbortSignal.timeout(3000) });
  if (!probe.ok) throw new Error(`HTTP ${probe.status}`);
} catch {
  console.error(`Server not reachable at ${BASE}.`);
  console.error("Start it first, from the project root:");
  console.error("  python3 serve.py");
  console.error("then re-run:  node e2e-offline.mjs");
  process.exit(2);
}

const results = [];      // { page, phase, ok, note }
const pageErrors = [];   // { page, phase, message }
let phase = "online";

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

let currentPage = "(none)";
page.on("pageerror", (error) => {
  pageErrors.push({ page: currentPage, phase, message: String(error).split("\n")[0] });
});

/* ── 1 · Online pass: load every page, wait for the service worker ───── */
for (const name of PAGES) {
  currentPage = name;
  let ok = true;
  let note = "sw ready";
  try {
    const response = await page.goto(`${BASE}/${name}`, { waitUntil: "load", timeout: 30000 });
    if (!response || !response.ok()) throw new Error(`HTTP ${response ? response.status() : "null"}`);
    await page.evaluate(() => navigator.serviceWorker.ready);
  } catch (error) {
    ok = false;
    note = String(error && error.message ? error.message : error).split("\n")[0];
  }
  results.push({ page: name, phase: "online", ok, note });
}

/* 3 s warm-up: lets the SW runtime cache finish storing fetched assets. */
await page.waitForTimeout(3000);

/* ── 2 · Offline pass: reload every page from the SW cache ───────────── */
phase = "offline";
await context.setOffline(true);

for (const name of PAGES) {
  currentPage = name;
  let ok = true;
  let note = "";
  try {
    await page.goto(`${BASE}/${name}`, { waitUntil: "load", timeout: 30000 });
    const check = await page.evaluate(() => {
      if (typeof ShunyaMath !== "object" || !ShunyaMath) return { ok: false, why: "ShunyaMath missing" };
      const model = ShunyaMath.canonicalGrahaModel(2461269.4375);
      if (!Array.isArray(model) || model.length !== 9) return { ok: false, why: "model is not 9 rows" };
      if (!model.every((g) => Number.isFinite(g.longitude))) return { ok: false, why: "non-finite longitude" };
      return { ok: true, why: `9 grahas · surya ${model[0].longitude.toFixed(4)}°` };
    });
    ok = check.ok;
    note = check.why;
  } catch (error) {
    ok = false;
    note = String(error && error.message ? error.message : error).split("\n")[0];
  }
  results.push({ page: name, phase: "offline", ok, note });
}

await browser.close();

/* ── 3 · Report ──────────────────────────────────────────────────────── */
const errorFree = pageErrors.length === 0;
const allLoaded = results.every((r) => r.ok);

const width = Math.max(...PAGES.map((p) => p.length));
console.log("\nPAGE".padEnd(width + 3) + "PHASE".padEnd(9) + "RESULT  NOTE");
console.log("─".repeat(width + 3 + 9 + 8 + 30));
for (const r of results) {
  console.log(
    r.page.padEnd(width + 2) + " " + r.phase.padEnd(8) + " " +
    (r.ok ? "PASS " : "FAIL ") + "  " + r.note
  );
}
console.log("─".repeat(width + 3 + 9 + 8 + 30));
console.log(`pageerror events: ${pageErrors.length}` + (errorFree ? "  (zero — clean)" : ""));
for (const e of pageErrors) console.log(`  [${e.phase}] ${e.page}: ${e.message}`);

if (allLoaded && errorFree) {
  console.log("\nOVERALL: PASS — all 6 pages load offline and the kernel computes.");
  process.exit(0);
} else {
  console.log("\nOVERALL: FAIL");
  process.exit(1);
}
