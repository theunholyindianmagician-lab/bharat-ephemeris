"use strict";

const assert = require("node:assert/strict");
const S = require("./sprint-upgrades.js");

let passed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(function () {
      passed += 1;
      console.log("✓ " + name);
    });
}

async function run() {
  await test("detectPage maps the five surfaces", function () {
    assert.equal(S.detectPage("/index.html"), "home");
    assert.equal(S.detectPage("/museum.html"), "museum");
    assert.equal(S.detectPage("/library.html"), "library");
    assert.equal(S.detectPage("/panchang.html"), "panchang");
    assert.equal(S.detectPage("/shunyabheda.html"), "engine");
    assert.equal(S.detectPage("/shoonya_sovereign_dashboard.html"), "dashboard");
  });

  await test("saptaSpline returns Catmull-Rom samples", function () {
    const path = S.saptaSpline(null, 8);
    assert.ok(path.length >= 8);
    path.forEach(function (p) {
      assert.equal(p.length, 3);
      p.forEach(function (n) { assert.equal(Number.isFinite(n), true); });
    });
  });

  await test("3-adic heatmap covers 27 nakshatras", function () {
    const cells = S.padicHeatmapValues(3);
    assert.equal(cells.length, 27);
    assert.ok(cells.some(function (c) { return c.valuation > 0; }));
  });

  await test("Panini seal is stable and Pedersen-verifiable", function () {
    const a = S.paniniSeal("chart:test");
    const b = S.paniniSeal("chart:test");
    assert.equal(a.hash, b.hash);
    assert.equal(a.commitment, b.commitment);
    const proof = S.zkProofForCalc("chart", "test");
    assert.equal(proof.verified, true);
    assert.equal(proof.kind, "pedersen-commitment");
  });

  await test("Landauer bound is positive and linear", function () {
    const one = S.landauerJoules(1);
    const ten = S.landauerJoules(10);
    assert.ok(one > 0);
    assert.ok(Math.abs(ten / one - 10) < 1e-9);
  });

  await test("Hamming(7,4) corrects a single-bit flip", function () {
    const enc = S.hammingEncodeNibble(0xb);
    const dec = S.hammingDecode7(enc ^ 2);
    assert.equal(dec.nibble, 0xb);
    assert.equal(dec.corrected, true);
  });

  await test("FNV-1a and telemetry pack are deterministic", function () {
    assert.equal(S.fnv1a32("sovereign"), S.fnv1a32("sovereign"));
    const pack = S.packTelemetry(4, -3);
    assert.equal(typeof pack.metric_hash, "number");
    assert.equal(pack.sequence_number, 4);
  });

  await test("Sanskrit akshara splitter keeps virama clusters", function () {
    const parts = S.splitSanskritAkshara("धर्मक्षेत्रे");
    assert.ok(parts.length >= 4);
    assert.ok(parts.join("").includes("र्"));
  });

  await test("citation graph has Dakṣiṇāmūrti → Mādhava lineage", function () {
    const g = S.buildCitationGraph();
    assert.ok(g.nodes.some(function (n) { return n.id === "dakshinamurti"; }));
    assert.ok(g.edges.some(function (e) { return e[0] === "bhaskara" && e[1] === "madhava"; }));
  });

  await test("edition commitments verify against themselves", function () {
    const rows = S.editionCommitments();
    assert.equal(rows.length, 10);
    rows.forEach(function (row) { assert.equal(S.verifyEditionCommitment(row), true); });
  });

  await test("katexLite renders pi and fractions", function () {
    assert.equal(S.katexLite("\\pi \\approx \\frac{22}{7}"), "π ≈ (22)/(7)");
  });

  await test("batch panchang CPU returns requested day count", function () {
    const batch = S.batchPanchangCPU(2461042, 12, 23.1765, 75.7885, 5.5);
    assert.equal(batch.rows.length, 12);
    assert.ok(batch.ms >= 0);
    assert.ok(batch.joules > 0);
  });

  await test("stream export CSV has header + rows", function () {
    const csv = S.streamExport([{ jd: 1, tithi: 2, nakshatra: 3, yoga: 4, karana: 5, surya: 6, chandra: 7 }], "csv");
    assert.ok(csv.startsWith("jd,tithi"));
    assert.ok(csv.split("\n").length >= 2);
  });

  await test("SPSC ring drops when full and pops in order", function () {
    const ring = S.createSpscRing(4);
    assert.equal(ring.push(1), true);
    assert.equal(ring.push(2), true);
    assert.equal(ring.push(3), true);
    assert.equal(ring.push(4), false);
    assert.equal(ring.pop(), 1);
    assert.equal(ring.pop(), 2);
  });

  await test("SR-EKF step reduces innovation on a clean measurement", function () {
    const a = S.srEkfStep(0, 1, 1, 0.1);
    assert.ok(a.state > 0);
    assert.ok(a.trace < 1);
  });

  await test("Hensel lift of x^2-2 mod 7 grows modulus", function () {
    const trail = S.henselLiftSteps(function (x) { return x * x - 2; }, function (x) { return 2 * x; }, 3, 7, 3);
    assert.ok(trail.length >= 2);
    assert.ok(trail[trail.length - 1].p > 7);
  });

  await test("√7 quaternion stays near unit norm", function () {
    const q = S.quaternionSqrt7(Math.PI / 3);
    assert.ok(Math.abs(q.norm - 1) < 1e-9);
  });

  await test("Mādhava series error shrinks with terms", function () {
    const a = S.madhavaPiPartial(8);
    const b = S.madhavaPiPartial(64);
    assert.ok(b.error < a.error);
  });

  await test("dasha timeline covers 120 years", function () {
    const rows = S.dashaTimeline(18);
    assert.equal(rows[rows.length - 1].end, 120);
  });

  await test("WASM hash32 instantiates and is stable", async function () {
    const a = await S.wasmHash32(42);
    const b = await S.wasmHash32(42);
    assert.equal(a, b);
    assert.equal(typeof a, "number");
  });

  await test("FTS index intersects tokens", function () {
    const pack = S.buildSearchIndex([
      { id: 1, text: "Madhava pi series Kerala", title: "Madhava" },
      { id: 2, text: "Parashara dasha vimshottari", title: "Parashara" }
    ]);
    const hits = S.querySearchIndex(pack, "madhava kerala");
    assert.equal(hits.length, 1);
    assert.equal(hits[0].title, "Madhava");
  });

  await test("visitorChart either computes or reports missing core", function () {
    const chart = S.visitorChart({ date: "1990-08-16", time: "06:30:00" });
    assert.equal(typeof chart.ok, "boolean");
    if (chart.ok) {
      assert.ok(chart.jd > 2400000);
      assert.ok(chart.seal.hash);
    }
  });

  console.log("\n" + passed + " sprint tests passed");
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
