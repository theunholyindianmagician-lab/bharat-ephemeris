// Triveni Sangam extension tests — run: node triveni.test.js
// Locks the 2026-08-17 Body-Mind-MACHINE × Bharat-Ephemeris unification layer.
"use strict";
const assert = require("node:assert");
require("./math-core.js");
const M = globalThis.ShunyaMath;

let passed = 0, total = 0;
function test(name, fn) {
  total += 1;
  try { fn(); passed += 1; console.log("✓ " + name); }
  catch (e) { console.error("✗ " + name + "\n  " + e.message); process.exitCode = 1; }
}

test("D=9 Natal-ID reproduces the live-API-verified anchor (20,11,17) → 14894 DEEP", () => {
  const nid = M.computeNatalId(20, 11, 17);
  assert.equal(nid.cell, 14894);
  assert.equal(nid.zone, "DEEP");
  assert.equal(nid.latticeCells, 19683);
  // lattice corners
  assert.equal(M.computeNatalId(13, 13, 13).zone, "BINDU");  // Hasta triple = centre
  assert.equal(M.computeNatalId(0, 0, 0).cell, 0);
  assert.equal(M.computeNatalId(26, 26, 26).cell, 19682);
});

test("dasha-breath 972-lattice: Śukra 20y = 972×160000; every daśā divides by 972", () => {
  const v = M.dashaBreathCount(20);
  assert.equal(v.breaths, 155520000);
  assert.equal(v.factor972, 160000);
  assert.equal(v.ajapaMalasPerDay, 200);
  assert.equal(v.breathsPerNakshatra, 800);
  for (const row of M.vimshottariBreathTable()) {
    assert.ok(Number.isInteger(row.factor972), row.lord + " must divide by 972");
  }
  const totalYears = M.vimshottariBreathTable().reduce((s, r) => s + r.years, 0);
  assert.equal(totalYears, 120);
});

test("972-laya theorem: 972 | N·21600 ⟺ 9 | N (27✓ 28✗ 30✗ 35✗)", () => {
  assert.equal(M.isLaya972(27), true);
  assert.equal(M.isLaya972(28), false);
  assert.equal(M.isLaya972(30), false);
  assert.equal(M.isLaya972(35), false);
  for (let n = 1; n <= 120; n++) assert.equal(M.isLaya972(n), n % 9 === 0);
});

test("pada108 agrees with the D9 varga engine across the whole zodiac", () => {
  for (let d = 0.5; d < 360; d += 3.17) {
    const p = M.pada108(d);
    assert.ok(p.d9Check, "pada108 vs D9 mismatch at " + d);
    assert.ok(p.quarter >= 1 && p.quarter <= 108);
  }
});

test("dual-path day seal: nākṣatra breath 3.9890783 s ≡ exactly 1 kalā of rotation", () => {
  const dp = M.dualDayPaths();
  assert.ok(Math.abs(dp.nakshatra.breathS - 3.9890783) < 1e-6);
  assert.ok(Math.abs(dp.nakshatra.kalaPerBreath - 1.0) < 1e-7);
  assert.equal(dp.savana.breathS, 4);
  assert.ok(Math.abs(dp.suryaSiddhantaOwn.dayS - 86164.10120) < 1e-4);
  assert.ok(Math.abs(dp.divergencePctPerDay - 0.2738) < 1e-3);
});

test("multi-school ayanāṃśa: Spica-Lahiri reproduces the recorded 23.7638° (1993-01-13)", () => {
  const jd93 = M.gregorianToJulianDay("1993-01-13", "04:25:00", 5.5);
  assert.ok(Math.abs(M.ayanamshaDeg(jd93, "spica_lahiri") - 23.7638) < 0.002);
  assert.ok(Math.abs(M.ayanamshaDeg(jd93, "kp") - (M.ayanamshaDeg(jd93, "spica_lahiri") - 0.10)) < 1e-12);
  assert.ok(Math.abs(M.ayanamshaDeg(jd93, "raman_spica") - (M.ayanamshaDeg(jd93, "spica_lahiri") - 0.373611)) < 1e-12);
  // legacy modes untouched (regression):
  assert.ok(Math.abs(M.ayanamshaDeg(jd93, "effective_49") - ((jd93 - 1903304.75) / 365.25) * M.ayanamshaRateArcsecPerYear(jd93, "effective_49") / 3600) < 1e-9);
});

test("Drik-anchor honesty gate (BE-S09): native frame near-Drik — lagna exact, Sun<1°, Moon<3.5°", () => {
  // Live bharatephemeris.com API (Lahiri, Drik-grade) verified in Body-Mind
  // MACHINE 2026-08-10: Sun U.Āṣāḍhā(20) · Moon U.Phālgunī(11) · Lagna Jyeṣṭhā(17).
  // After the manda-sign + Citrā-pakṣa frame unification the graha frame is
  // native-Lahiri-like: measured offsets Sun −0.59°, Moon −2.78° (were 4.8°/6.5°).
  const jd = M.gregorianToJulianDay("1993-01-13", "04:25:00", 5.5);
  const g = M.canonicalGrahaModel(jd);
  const sun = g.find((p) => p.key === "surya").longitude;
  const moon = g.find((p) => p.key === "candra").longitude;
  const asc = M.siderealAscendantDeg(jd, 28.7041, 77.1025); // Citrā-pakṣa default
  assert.equal(M.computeNakshatraDetails(asc).index, 17, "Lagna nakshatra must be exact");
  const wrap = (d) => Math.abs(((d + 540) % 360) - 180);
  assert.ok(wrap(sun - 269.2) < 1.0, `Sun offset ${wrap(sun - 269.2).toFixed(2)}° must stay < 1°`);
  assert.ok(wrap(moon - 146.7) < 3.5, `Moon offset ${wrap(moon - 146.7).toFixed(2)}° must stay < 3.5°`);
});

test("geodesy: berryPhase computed from coords; Ujjain–Kashi haversine sane", () => {
  const bp = M.sacredGeospatialBerryPhase();
  assert.ok(Math.abs(bp.sphericalExcessRad - 0.040479) < 1e-4); // legacy constant was the real excess
  assert.ok(bp.areaKm2 > 1.5e6 && bp.areaKm2 < 1.8e6);
  const d = M.haversineKm(23.1765, 75.7885, 25.3109, 83.0107); // Ujjain → Kashi
  assert.ok(d > 700 && d < 800, "Ujjain-Kashi ≈ 740 km, got " + d.toFixed(1));
});

test("moonrise: Ujjain 2026-08-17 sets ≈2h after sunset (śukla caturthī) and is finite", () => {
  const mid = M.gregorianToJulianDay("2026-08-17", "00:00:00", 5.5);
  const mr = M.lunarRiseSet(mid, 23.1765, 75.7885, 5.5);
  assert.ok(!mr.circumpolar && !mr.neverRises);
  assert.ok(mr.riseLocal && mr.setLocal);
  const setH = Number(mr.setLocal.slice(0, 2)) + Number(mr.setLocal.slice(3, 5)) / 60;
  assert.ok(setH > 19.5 && setH < 22.5, "moonset " + mr.setLocal + " should be ~2h after 18:54 sunset");
});

test("दृग्गणित-संस्कार kernel v2: samskrita within declared RMS of the offline दृक्-referee", () => {
  require("./drik-tier.js");
  const D = globalThis.DrikTier;
  const jd = M.gregorianToJulianDay("2026-08-17", "04:00:00", 5.5);
  const k = M.keralaDrikSphuta(jd);
  const dk = D.grahas(jd);
  const wrap = (d) => Math.abs(((d + 540) % 360) - 180);
  for (const g of ["surya", "candra", "mangala", "budha", "shukra", "guru", "shani"]) {
    const errArcmin = wrap(k[g].samskrita - dk[g]) * 60;
    assert.ok(errArcmin < 3 * k[g].rmsArcmin,
      `${g}: ${errArcmin.toFixed(1)}' must be < 3×RMS (${3 * k[g].rmsArcmin}')`);
  }
  assert.ok(/Nīlakaṇṭha|next mountain/.test(k.pending.note), "next mountain declared");
  // The historical BE-S09 anchor was captured from the now-explicit empirical fit.
  const gg = M.canonicalGrahaModel(jd, { applyBija: true, bijaModel: "empirical-2026-08-29" });
  assert.ok(Math.abs(gg[0].longitude - 119.862926420812) < 1e-9);
});

test("D144 extended varga + deep-time mean row honesty label", () => {
  assert.equal(M.VARGAS.length, 16); // canonical Ṣoḍaśavarga stays 16
  assert.equal(M.VARGAS_EXTENDED[0].code, "D144");
  for (const d of [0, 15, 100, 359.9]) {
    const v = M.computeVarga(d, "D144");
    assert.ok(v >= 0 && v < 12);
  }
  const row = M.deepTimeRow(1872803);
  assert.ok(row.model.includes("mean-only"));
  assert.ok(row.tithiIndex >= 0 && row.tithiIndex < 30);
});

console.log(`\n${passed}/${total} triveni checks passed`);
if (passed !== total) process.exit(1);
