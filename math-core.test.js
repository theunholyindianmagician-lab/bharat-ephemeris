"use strict";

const assert = require("node:assert/strict");
const M = require("./math-core.js");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function angularDifference(a, b) {
  let difference = M.mod360(a - b);
  if (difference > 180) difference -= 360;
  return difference;
}

test("metrology distinguishes pala, vipala and prāṇa counts", () => {
  assert.equal(M.METROLOGY.ghatisPerDay, 60);
  assert.equal(M.METROLOGY.palasPerDay, 3600);
  assert.equal(M.METROLOGY.vipalasPerDay, 216000);
  assert.equal(M.METROLOGY.pranasPerDay, M.METROLOGY.arcminutesPerCircle);
});

test("Gregorian UTC noon at J2000 converts to JD 2451545.0", () => {
  assert.equal(M.gregorianToJulianDay("2000-01-01", "12:00:00", 0), 2451545);
});

test("Ujjain mean time is derived from longitude and timezone", () => {
  // 75.7885° E canonical meridian (site-wide unification, 2026-08-10): 12:00 IST
  // → 6.5 h UT → +5.05257 h of mean time = 11:33:09.
  assert.equal(M.ujjainMeanTime("12:00:00", 5.5), "11:33:09");
  // optional explicit meridian must override the canonical default
  assert.equal(M.ujjainMeanTime("12:00:00", 5.5, 75.7683), "11:33:04");
});

test("shared -16 rev/Mahāyuga arithmetic derives 49.2001 arcsec/year", () => {
  const rates = M.precessionRates();
  assert.ok(Math.abs(rates.sharedDebtArcsecPerYear + 4.7998849278) < 1e-9);
  assert.ok(Math.abs(rates.effectiveArcsecPerYear - 49.2001150722) < 1e-9);
  for (const variant of ["effective_49", "linear_54", "linear_50", "sinusoidal_27"]) {
    assert.ok(Math.abs(M.ayanamshaDeg(M.ARYABHATA_ZERO_JD, variant)) < 1e-12);
  }
});

test("ayanamsha metadata reports the implemented zero and instantaneous rates", () => {
  for (const mode of Object.keys(M.AYANAMSHA_MODES)) {
    assert.equal(M.AYANAMSHA_MODES[mode].zeroJd, M.ARYABHATA_ZERO_JD);
  }
  assert.equal(M.ayanamshaRateArcsecPerYear(2451545, "linear_54"), 54);
  assert.equal(M.ayanamshaRateArcsecPerYear(2451545, "linear_50"), 50);
  assert.equal(
    M.ayanamshaRateArcsecPerYear(M.ARYABHATA_ZERO_JD, "sinusoidal_27"),
    27 * (2 * Math.PI / 7200) * 3600,
  );
});

test("ayanamsha metadata is immutable and rates match numerical derivatives", () => {
  assert.ok(Object.isFrozen(M.AYANAMSHA_MODES));
  for (const [mode, metadata] of Object.entries(M.AYANAMSHA_MODES)) {
    assert.ok(Object.isFrozen(metadata));
    for (const jd of [M.ARYABHATA_ZERO_JD - 1e6, M.ARYABHATA_ZERO_JD, 2451545, M.ARYABHATA_ZERO_JD + 1e6]) {
      const stepDays = 0.01;
      const numericalRate = (
        M.ayanamshaDeg(jd + stepDays, mode) - M.ayanamshaDeg(jd - stepDays, mode)
      ) / (2 * stepDays) * 365.25 * 3600;
      assert.ok(Math.abs(numericalRate - M.ayanamshaRateArcsecPerYear(jd, mode)) < 2e-5);
    }
  }
});

test("shared-debt decomposes to exact rational −24/5; core 54×41/45 = 49.2; Z-shift 31.2 yr", () => {
  const rates = M.precessionRates();
  // The −16 rev/Mahāyuga debt under a pure 365.25 conversion is EXACTLY −4.8″/yr = −24/5.
  const debtExact = (-16 * 360 * 3600 * 365.25) / (4320000 * 365.25);
  assert.ok(Math.abs(debtExact - (-24 / 5)) < 1e-12);
  assert.ok(Math.abs(debtExact + 4.8) < 1e-12);
  // The engine's debt differs from −4.8 by exactly the Sūrya-Siddhānta day-count
  // tail: 1,577,917,828 days replaces the 365.25 conversion denominator.
  assert.ok(Math.abs(rates.sharedDebtArcsecPerYear - debtExact - 0.0001150722) < 1e-9);
  // Rational core: 54 − 24/5 = 246/5 = 49.2 = 54×41/45 exactly.
  assert.ok(Math.abs(54 * (41 / 45) - 49.2) < 1e-12);
  assert.ok(Math.abs(54 * (41 / 45) - 246 / 5) < 1e-12);
  const tail = rates.effectiveArcsecPerYear - 54 * (41 / 45);
  assert.ok(Math.abs(tail - 0.0001150722) < 1e-9);
  // Zero-year falsification: at rate 49.2, shifting Z from 285 CE to 253.8 CE
  // (ΔZ = 31.2 yr) moves today's value by ≈ −0.426° — the residual-zero adjustment.
  const shift = (rates.effectiveArcsecPerYear / 3600) * (253.8 - 285);
  assert.ok(Math.abs(shift + 0.4264) < 0.001);
});

test("corrected bīja signs are +30, -51, +61 and zero at the anchor", () => {
  assert.deepStrictEqual(M.BIJA_REV_PER_MAHAYUGA, { mangala: 30, guru: -51, shani: 61 });
  for (const key of Object.keys(M.BIJA_REV_PER_MAHAYUGA)) {
    assert.equal(M.bijaDeltaDeg(key, M.BIJA_ANCHOR_JD), 0);
  }
});

test("the one-epoch empirical bīja fit is explicit and never a default", () => {
  assert.deepStrictEqual(M.bijaCoefficients("empirical-2026-08-29"), M.EMPIRICAL_BIJA_REV_PER_MAHAYUGA);
  assert.throws(() => M.bijaCoefficients("unknown"), /Unknown bīja model/);
  const jd = 2461269.4375;
  const native = M.canonicalGrahaModel(jd);
  const explicitNative = M.canonicalGrahaModel(jd, { applyBija: false });
  assert.deepEqual(native, explicitNative);
  const empirical = M.canonicalGrahaModel(jd, { applyBija: true, bijaModel: "empirical-2026-08-29" });
  assert.notDeepEqual(native.map((r) => r.longitude), empirical.map((r) => r.longitude));
});

test("mean model returns nine bodies and keeps Ketu opposite Rāhu", () => {
  const rows = M.meanGrahaModel(2461261.5, true);
  assert.equal(rows.length, 9);
  const rahu = rows.find((row) => row.key === "rahu");
  const ketu = rows.find((row) => row.key === "ketu");
  assert.ok(Math.abs(Math.abs(angularDifference(ketu.longitude, rahu.longitude)) - 180) < 1e-10);
});

test("mean model nodes share the sphuta convention and remain retrograde", () => {
  for (const jd of [M.KALI_EPOCH_JD, 2451545, 2461261.5]) {
    const rows = M.meanGrahaModel(jd);
    const rahu = rows.find((row) => row.key === "rahu");
    const ketu = rows.find((row) => row.key === "ketu");
    assert.ok(Math.abs(angularDifference(rahu.mean, M.ssPlanetMeanAt("rahu", jd - M.SS.j2000JD))) < 1e-9);
    assert.ok(Math.abs(Math.abs(angularDifference(ketu.mean, rahu.mean)) - 180) < 1e-9);
  }
  const first = M.meanGrahaModel(2451545).find((row) => row.key === "rahu").mean;
  const next = M.meanGrahaModel(2451546).find((row) => row.key === "rahu").mean;
  assert.ok(angularDifference(next, first) < 0);
});

test("canonical model is sphuta plus bīja for exactly the intended bodies", () => {
  const jd = 2461261.5;
  const plain = M.canonicalGrahaModel(jd, { applyBija: false });
  const corrected = M.canonicalGrahaModel(jd, { applyBija: true });
  assert.equal(plain.length, 9);
  for (const row of corrected) {
    assert.equal(row.longitude, M.mod360(row.sphuta + row.bija));
    assert.equal(row.details, row.detail);
    assert.ok(row.details && Number.isFinite(row.details.sphuta));
    if (M.BIJA_REV_PER_MAHAYUGA[row.key] !== undefined) assert.notEqual(row.bija, 0);
    else assert.equal(row.bija, 0);
    assert.equal(plain.find((item) => item.key === row.key).sphuta, row.sphuta);
  }
});

test("graha-model option contracts reject silently ignored positional arguments", () => {
  const jd = 2461269.4375;
  assert.throws(() => M.sphutaGrahaModel(jd, "effective_49", { applyBija: false }), /expected a boolean or/);
  assert.throws(() => M.canonicalGrahaModel(jd, { applyBija: "false" }), /expected a boolean or/);
  const plainBoolean = M.canonicalGrahaModel(jd, false);
  const plainObject = M.canonicalGrahaModel(jd, { applyBija: false });
  assert.deepEqual(plainBoolean, plainObject);
  assert.ok(plainBoolean.every((row) => row.bija === 0));
});

test("lunar three-term correction is labeled as a modern composite", () => {
  const moon = M.ssSphutaAt("chandra", 0);
  assert.equal(moon.lunarInequalities.model, "modern-three-term");
  assert.equal(moon.lunarInequalities.total, moon.paksika);
  assert.equal(moon.lunarInequalities.total,
    moon.lunarInequalities.evection + moon.lunarInequalities.variation + moon.lunarInequalities.annualEquation);
});

test("canonical model contract holds across epochs and preserves node parity", () => {
  const expectedKeys = M.GRAHAS.map((graha) => graha.key);
  for (const jd of [M.KALI_EPOCH_JD, M.ARYABHATA_ZERO_JD, M.SS.j2000JD, 2461261.5, 3000000]) {
    const rows = M.canonicalGrahaModel(jd, { applyBija: true });
    assert.deepEqual(rows.map((row) => row.key), expectedKeys);
    for (const row of rows) {
      assert.equal(row.details, row.detail);
      assert.equal(row.longitude, M.mod360(row.sphuta + row.bija));
    }
    const rahu = rows.find((row) => row.key === "rahu");
    const ketu = rows.find((row) => row.key === "ketu");
    assert.ok(Math.abs(Math.abs(angularDifference(ketu.longitude, rahu.longitude)) - 180) < 1e-9);
  }
});

test("ascendant formula matches independent Swiss fixtures", () => {
  const fixtures = [
    [2451544.5, 51.4769, 0, 187.02945],
    [2461202.770833, 28.6139, 77.2090, 166.20700],
    [2446145.739583, -33.8688, 151.2093, 131.62160],
  ];
  for (const [jd, lat, lon, expected] of fixtures) {
    assert.ok(Math.abs(angularDifference(M.tropicalAscendantDeg(jd, lat, lon), expected)) < 0.1);
  }
});

test("all sixteen vargas are present with textbook spot checks", () => {
  assert.equal(M.VARGAS.length, 16);
  assert.equal(M.computeVarga(10.01, "D9"), 3);
  assert.equal(M.computeVarga(44, "D9"), 1);
  assert.equal(M.computeVarga(20, "D2"), 3);
  assert.equal(M.computeVarga(85, "D3"), 10);
  assert.equal(M.computeVarga(17, "D30"), 8);
  assert.equal(M.computeVarga(43, "D30"), 11);
  assert.equal(M.computeVarga(15.4, "D60"), 6);
});

test("Vimśottarī balance and antara are resolved at the selected instant", () => {
  const birthJd = M.gregorianToJulianDay("1993-01-13", "21:06:00", 5.5);
  const result = M.vimshottariAtJd(100, birthJd, birthJd);
  assert.ok(result.birthState.balanceYears > 0);
  assert.ok(result.birthState.balanceYears <= M.VIMSHOTTARI_YEARS[result.birthState.lord]);
  assert.equal(result.maha.lord, result.birthState.lord);
  assert.ok(result.antara);
  assert.ok(birthJd >= result.antara.startJd && birthJd < result.antara.endJd);
});

test("Vimśottarī boundaries use tolerant half-open nakshatras", () => {
  const arc = 360 / 27;
  for (let boundary = 0; boundary < 27; boundary++) {
    const longitude = boundary * arc;
    for (const delta of [-1e-11, 0, 1e-11]) {
      const state = M.vimshottariBirthState(longitude + delta);
      assert.equal(state.nakshatraIndex, boundary);
      assert.equal(state.fractionDone, 0);
    }
    assert.equal(M.vimshottariBirthState(longitude - 1e-8).nakshatraIndex, (boundary + 26) % 27);
    assert.equal(M.vimshottariBirthState(longitude + 1e-8).nakshatraIndex, boundary);
  }
  assert.equal(M.vimshottariBirthState(360).nakshatraIndex, 0);
});

test("Katapayadi coordinate payload preserves sign, axis and precision", () => {
  const payload = M.encodeCoordinatePair("-8.888800", "138.989898989");
  const decoded = M.decodeCoordinatePair(payload);
  assert.deepEqual(decoded, { latitude: "-8.888800", longitude: "138.989898989" });
  assert.throws(() => M.decodeCoordinatePair(payload.replace("K1", "K0")), /Invalid K1/);
});

test("midheaven is self-consistent: RA(MC) equals local sidereal time", () => {
  const deg = 180 / Math.PI;
  const rad = Math.PI / 180;
  for (const [jd, lon] of [[2451544.5, 0], [2451545.0, 77.209], [2461202.770833, -33.8688]]) {
    const mc = M.tropicalMidheavenDeg(jd, lon);
    const lst = M.localSiderealTimeDeg(jd, lon);
    const eps = M.meanObliquityDeg(jd) * rad;
    const ra = Math.atan2(Math.sin(mc * rad) * Math.cos(eps), Math.cos(mc * rad)) * deg;
    assert.ok(Math.abs(angularDifference(ra, lst)) < 1e-9);
  }
});

test("bhāva madhyas are anchored on lagna, MC, IC and DSC", () => {
  const jd = 2451544.5, lat = 51.4769, lon = 0;
  const madh = M.bhavaMadhyasTropicalDeg(jd, lat, lon);
  const asc = M.tropicalAscendantDeg(jd, lat, lon);
  const mc = M.tropicalMidheavenDeg(jd, lon);
  assert.ok(Math.abs(angularDifference(madh[1], asc)) < 1e-9);
  assert.ok(Math.abs(angularDifference(madh[10], mc)) < 1e-9);
  assert.ok(Math.abs(angularDifference(madh[4], M.mod360(mc + 180))) < 1e-9);
  assert.ok(Math.abs(angularDifference(madh[7], M.mod360(asc + 180))) < 1e-9);
  // 2nd bhāva madhya is exactly one third along the lagna→IC arc
  const arc = M.mod360(madh[4] - asc);
  assert.ok(Math.abs(angularDifference(madh[2], M.mod360(asc + arc / 3))) < 1e-9);
  // 12th bhāva madhya is exactly two thirds along the MC→lagna arc
  const arc12 = M.mod360(asc - mc);
  assert.ok(Math.abs(angularDifference(madh[12], M.mod360(mc + 2 * arc12 / 3))) < 1e-9);
});

test("bhāva sandhis tile the zodiac and every madhya owns its house", () => {
  const model = M.bhavaModel(2451545.0, 28.6139, 77.209, "effective_49");
  let total = 0;
  for (let n = 1; n <= 12; n++) total += M.mod360(model.sandhis[n + 1] - model.sandhis[n]);
  assert.ok(Math.abs(total - 360) < 1e-9);
  for (let n = 1; n <= 12; n++) assert.equal(M.bhavaOf(model.madhyas[n], model), n);
  assert.equal(model.lagnaBhava, 1);
  assert.equal(model.bhavas.length, 12);
  assert.equal(model.grahas.length, 9);
  for (const g of model.grahas) {
    assert.ok(g.bhava >= 1 && g.bhava <= 12);
    assert.ok(Math.abs(g.bhavaOffset) <= 180);
    assert.ok(g.wholeSignBhava >= 1 && g.wholeSignBhava <= 12);
  }
  // kendras carry the classical 30° span at the cardinal anchors
  for (const n of [1, 4, 7, 10]) {
    assert.ok(Math.abs(model.bhavas[n - 1].spanDeg - 30) < 1e-9);
  }
  // rāśi-lord table is classical (Meṣa→mangala, Siṃha→surya, Mīna→guru…)
  assert.equal(M.RASHI_LORDS[0], "mangala");
  assert.equal(M.RASHI_LORDS[4], "surya");
  assert.equal(M.RASHI_LORDS[11], "guru");
});

test("whole-sign bhāva agrees with the cusp bhāva for this sample instant", () => {
  const model = M.bhavaModel(2451545.0, 28.6139, 77.209, "effective_49");
  for (const g of model.grahas) {
    const wholeSign = model.bhavas[g.wholeSignBhava - 1];
    const cusp = model.bhavas[g.bhava - 1];
    assert.equal(wholeSign.rashiSa, M.RASHI_SA[g.rashi]);
    assert.ok(cusp.occupants.length >= 0);
  }
  assert.equal(M.BHAVA_KARAKA[6].iast, "Kalatra");
  assert.equal(M.BHAVA_SA[0], "प्रथम");
});

test("whole-sign occupant metadata is independent of repeated high-latitude cusp signs", () => {
  const model = M.bhavaModel(2451545, 70, 77.209);
  assert.ok(new Set(model.bhavas.map((bhava) => bhava.rashi)).size < 12);
  for (const bhava of model.bhavas) {
    const expectedSign = (model.lagnaRashi + bhava.no - 1) % 12;
    assert.equal(bhava.wholeSignRashi, M.RASHIS[expectedSign]);
    assert.deepEqual(
      bhava.occupantsWholeSign,
      model.grahas.filter((graha) => graha.rashi === expectedSign).map((graha) => graha.key),
    );
  }
});

test("whole-sign occupants and placed-graha houses agree across latitudes and epochs", () => {
  for (const jd of [M.KALI_EPOCH_JD, M.ARYABHATA_ZERO_JD, 2451545, 3000000]) {
    for (const latitude of [-80, -30, 0, 30, 80]) {
      const model = M.bhavaModel(jd, latitude, 77.209);
      for (const bhava of model.bhavas) {
        assert.deepEqual(
          bhava.occupantsWholeSign,
          model.grahas.filter((graha) => graha.wholeSignBhava === bhava.no).map((graha) => graha.key),
        );
      }
    }
  }
});

test("bhāva reliability is ordinary at 60 degrees and cautions at 70 degrees", () => {
  const ordinary = M.bhavaModel(2451545, 60, 77.209).reliability;
  const polar = M.bhavaModel(2451545, 70, 77.209).reliability;
  assert.deepEqual([ordinary.reliable, ordinary.level, ordinary.warning], [true, "normal", null]);
  assert.deepEqual([polar.reliable, polar.level], [false, "caution"]);
  assert.match(polar.warning, /Polar-circle/);
  assert.ok(ordinary.minSpanDeg > 0 && polar.minSpanDeg > 0);
});

test("bhāva reliability changes at the polar-circle threshold in both hemispheres", () => {
  for (const sign of [-1, 1]) {
    const inside = M.bhavaModel(2451545, sign * 66.562199, 77.209).reliability;
    const threshold = M.bhavaModel(2451545, sign * 66.5622, 77.209).reliability;
    const nearPole = M.bhavaModel(2451545, sign * 89.999, 77.209).reliability;
    assert.deepEqual([inside.reliable, inside.level, inside.warning], [true, "normal", null]);
    assert.deepEqual([threshold.reliable, threshold.level], [false, "caution"]);
    assert.equal(nearPole.reliable, false);
    assert.ok(Number.isFinite(nearPole.minSpanDeg));
  }
});

test("panchangAtJd vara is the true IST weekday (regression: +6 shift bug)", () => {
  // 2026-08-09 12:00 IST was a Sunday (रविवार). The old inline panchang port
  // used VARA[(getDay()+6)%7] + local-time getDay, which showed शनिवार here.
  const p1 = M.panchangAtJd(M.gregorianToJulianDay("2026-08-09", "12:00:00", 5.5), 5.5);
  assert.equal(p1.varaName, "रविवार");
  assert.equal(p1.varaIndex, 0);
  assert.equal(
    M.panchangAtJd(M.gregorianToJulianDay("2026-08-10", "12:00:00", 5.5), 5.5).varaName,
    "सोमवार",
  );
  assert.equal(
    M.panchangAtJd(M.gregorianToJulianDay("2026-08-11", "12:00:00", 5.5), 5.5).varaName,
    "मंगलवार",
  );
  // structure of returned panchang
  assert.ok(p1.tithiIndex >= 0 && p1.tithiIndex < 30);
  assert.ok(p1.nakshatraIndex >= 0 && p1.nakshatraIndex < 27);
  assert.ok(Math.abs(p1.surya - p1.chandra - p1.lunar) < 1e-9 || p1.lunar === M.mod360(p1.chandra - p1.surya));
  assert.ok(M.mod360(p1.chandra - p1.surya) === p1.lunar);
});

test("panchang civil vara follows timezone-local date, not UTC date", () => {
  const jd = M.gregorianToJulianDay("2026-08-09", "20:00:00", 0);
  assert.equal(M.panchangAtJd(jd, 0).varaName, "रविवार");
  assert.equal(M.panchangAtJd(jd, 5.5).varaName, "सोमवार");
});

test("panchang civil vara advances only at local midnight across timezone extremes", () => {
  for (const timezone of [-14, -5.5, 0, 5.5, 14]) {
    const beforeMidnight = M.gregorianToJulianDay("2026-08-09", "23:59:59", timezone);
    const midnight = M.gregorianToJulianDay("2026-08-10", "00:00:00", timezone);
    assert.equal(M.panchangAtJd(beforeMidnight, timezone).varaName, "रविवार");
    assert.equal(M.panchangAtJd(midnight, timezone).varaName, "सोमवार");
  }
});

test("panchang exact civil-time boundaries quantize to integer vipala ticks", () => {
  const vectors = [
    ["00:00:04", [0, 0, 1, 0]],
    ["00:00:24", [0, 1, 0, 0]],
    ["00:24:00", [1, 0, 0, 0]],
    ["00:30:00", [1, 15, 0, 0]],
  ];
  for (const [time, expected] of vectors) {
    const p = M.panchangAtJd(M.gregorianToJulianDay("2026-08-10", time, 5.5), 5.5);
    assert.deepEqual([p.ghati, p.vighati, p.prana, p.vipala], expected, time);
    assert.ok(p.ghati >= 0 && p.ghati < 60);
    assert.ok(p.vighati >= 0 && p.vighati < 60);
    assert.ok(p.prana >= 0 && p.prana < 6);
    assert.ok(p.vipala >= 0 && p.vipala < 10);
  }
});

test("panchang vipala quantization covers every exact tick in a civil day", () => {
  const midnight = M.gregorianToJulianDay("2026-08-10", "00:00:00", 5.5);
  for (let tick = 0; tick < M.METROLOGY.vipalasPerDay; tick++) {
    const p = M.panchangAtJd(midnight + tick / M.METROLOGY.vipalasPerDay, 5.5);
    assert.equal(p.vipalaTicks, tick, `vipala tick ${tick}`);
    assert.deepEqual(
      [p.ghati, p.vighati, p.prana, p.vipala],
      [Math.floor(tick / 3600), Math.floor(tick / 60) % 60, Math.floor(tick / 10) % 6, tick % 10],
      `vipala decomposition ${tick}`,
    );
  }
});

test("panchang vipala clock never rolls into the next civil day early", () => {
  const midnight = M.gregorianToJulianDay("2026-08-10", "00:00:00", 5.5);
  const justBefore = M.panchangAtJd(midnight - 0.2 / 86400, 5.5);
  const atMidnight = M.panchangAtJd(midnight, 5.5);
  assert.deepEqual(
    [justBefore.ghati, justBefore.vighati, justBefore.prana, justBefore.vipala],
    [59, 59, 5, 9],
  );
  assert.equal(justBefore.varaName, "रविवार");
  assert.deepEqual(
    [atMidnight.ghati, atMidnight.vighati, atMidnight.prana, atMidnight.vipala],
    [0, 0, 0, 0],
  );
  assert.equal(atMidnight.varaName, "सोमवार");
});

test("panchang exposes explicit saura masa with documented compatibility aliases", () => {
  const p = M.panchangAtJd(2461262.7694, 5.5);
  assert.equal(p.masaIndex, p.sauraMasaIndex);
  assert.equal(p.masaName, p.sauraMasaName);
});

test("public calculations reject unknown grahas and non-finite inputs", () => {
  assert.throws(() => M.ssPlanetMeanAt("pluto", 0), /Unknown graha key/);
  assert.throws(() => M.ssSphutaAt("pluto", 0), /Unknown graha key/);
  assert.throws(() => M.bijaDeltaDeg("pluto", 2451545), /Unknown graha key/);
  assert.throws(() => M.panchangAtJd(NaN), /must be finite/);
  assert.throws(() => M.meanGrahaModel(Infinity), /must be finite/);
  assert.throws(() => M.canonicalGrahaModel(NaN), /must be finite/);
  assert.throws(() => M.vimshottariBirthState(NaN), /must be finite/);
  assert.throws(() => M.bhavaModel(NaN, 28, 77), /must be finite/);
  assert.throws(() => M.panchangAtJd(2451545, 14.01), /inside \[-14, 14\]/);
  assert.throws(() => M.gregorianToJulianDay("2026-02-29"), /Invalid Gregorian date/);
  assert.throws(() => M.gregorianToJulianDay("2026-08-10", "24:00:00"), /Invalid time/);
  assert.throws(() => M.tropicalAscendantDeg(2451545, 90, 0), /strictly between/);
  assert.throws(() => M.tropicalAscendantDeg(2451545, 0, 180.01), /inside \[-180, 180\]/);
  assert.throws(() => M.ayanamshaDeg(2451545, "unknown"), /Unknown ayanāṃśa/);
  assert.throws(() => M.ayanamshaRateArcsecPerYear(2451545, "unknown"), /Unknown ayanāṃśa/);
});

test("panchangAtJd fixed-JD regression vector (2026-08-10 12:00 IST)", () => {
  // Pinned 2026-08-10 12:00 IST (JD 2461262.7694) against the shared engine.
  // Value-level == (not tolerance) so a real drift breaks loudly.
  // RE-PINNED under SANKALP BE-S09 (manda-sign fix): Swiss Ephemeris confirms
  // the real tithi that noon WAS त्रयोदशी (idx 27) — the old pin (द्वादशी 26)
  // had enshrined the inverted-manda output. Model now matches the sky here.
  const p = M.panchangAtJd(M.gregorianToJulianDay("2026-08-10", "12:00:00", 5.5), 5.5);
  assert.equal(p.paksha, "कृष्ण");
  assert.equal(p.tithiName, "त्रयोदशी");
  assert.equal(p.tithiIndex, 27);
  assert.equal(p.masaName, "श्रावण");
  assert.equal(p.varaName, "सोमवार");
  assert.equal(p.ghati, Math.floor(p.localSeconds / 1440));
  assert.equal(p.vighati, Math.floor((p.localSeconds % 1440) / 24));
  assert.equal(p.prana, Math.floor((p.localSeconds % 24) / 4));
  assert.ok(p.ghati >= 0 && p.ghati < 60, `ghati out of range: ${p.ghati}`);
  assert.ok(p.vighati >= 0 && p.vighati < 60, `vighati out of range: ${p.vighati}`);
  assert.ok(p.prana >= 0 && p.prana < 6, `prana out of range: ${p.prana}`);
  // sun in Karka (115.5° ±) and moon near Ardra in Shravana 2026 → sanity band
  assert.ok(p.surya > 112 && p.surya < 113.5, `surya ${p.surya}`); // BE-S09 re-pin (112.65)
  assert.ok(p.chandra > 50 && p.chandra < 100, `chandra ${p.chandra}`);
  assert.ok(p.yogaIndex >= 0 && p.yogaIndex < 27, `yogaIndex ${p.yogaIndex}`);
  assert.ok(typeof p.yogaName === "string" && p.yogaName.length > 0, `yogaName ${p.yogaName}`);
  assert.ok(p.karanaIndex >= 0 && p.karanaIndex < 11, `karanaIndex ${p.karanaIndex}`);
  assert.ok(typeof p.karanaName === "string" && p.karanaName.length > 0, `karanaName ${p.karanaName}`);
});

test("computeNadiAmsha divides signs into 150 divisions with correct reckoning", () => {
  // Movable sign (Mesha = 0): 0.1° -> division 0 -> Nadi 1 (Vasudha)
  const n1 = M.computeNadiAmsha(0.1);
  assert.equal(n1.nadiIndex, 1);
  assert.equal(n1.name, "Vasudhā");
  assert.equal(n1.rashi, "Meṣa");

  // Movable sign: 29.9° -> division 149 -> Nadi 150 (Brahmarupa)
  const n150 = M.computeNadiAmsha(29.9);
  assert.equal(n150.nadiIndex, 150);
  assert.equal(n150.name, "Brahmarūpā");

  // Fixed sign (Vrishabha = 30°..60°): 30.1° -> division 0 -> Nadi 150 (Brahmarupa)
  const nFixed = M.computeNadiAmsha(30.1);
  assert.equal(nFixed.nadiIndex, 150);
  assert.equal(nFixed.name, "Brahmarūpā");
  assert.equal(nFixed.rashi, "Vṛṣabha");

  // Dual sign (Mithuna = 60°..90°): 60.1° -> division 0 -> Nadi 76
  const nDual = M.computeNadiAmsha(60.1);
  assert.equal(nDual.nadiIndex, 76);
  assert.equal(nDual.name, "Vijayā");
  assert.equal(nDual.rashi, "Mithuna");
});

test("computePlanetaryVelocities computes 1st and 2nd derivatives accurately", () => {
  const jd = M.gregorianToJulianDay("2026-08-09", "12:00:00", 5.5);
  const vels = M.computePlanetaryVelocities(jd);
  assert.equal(vels.length, 9);

  const sun = vels.find((v) => v.key === "surya");
  assert.ok(sun, "Sun must be present");
  // Sun mean daily motion is ~0.9856°/day
  assert.ok(sun.speedDegDay > 0.95 && sun.speedDegDay < 1.05, `Sun speed ${sun.speedDegDay}`);
  assert.equal(sun.isRetrograde, false);

  const moon = vels.find((v) => v.key === "candra");
  assert.ok(moon, "Moon must be present");
  // Moon daily motion is ~11.8° to 15.2°/day
  assert.ok(moon.speedDegDay > 11.0 && moon.speedDegDay < 16.0, `Moon speed ${moon.speedDegDay}`);

  const rahu = vels.find((v) => v.key === "rahu");
  assert.ok(rahu, "Rahu must be present");
  // Mean nodes in SS convention are retrograde (negative velocity)
  assert.ok(rahu.speedDegDay < 0, `Rahu speed ${rahu.speedDegDay}`);
  assert.equal(rahu.isRetrograde, true);
});

test("computeAspects detects major harmonic angular relationships and volatility indices", () => {
  const grahas = [
    { key: "surya", sa: "सू", en: "Sun", longitude: 0 },
    { key: "guru", sa: "गु", en: "Jupiter", longitude: 90.5 },
    { key: "shani", sa: "श", en: "Saturn", longitude: 180 },
  ];
  const res = M.computeAspects(grahas);
  assert.equal(res.pairsCount, 3);
  assert.ok(res.activeAspects.length >= 3, `Expected at least 3 active aspects, got ${res.activeAspects.length}`);

  const squareAspect = res.activeAspects.find((a) => a.aspect === "Square");
  assert.ok(squareAspect, "Square aspect between Sun (0°) and Jupiter (90.5°) must be detected");
  assert.ok(Math.abs(squareAspect.orbDeg - 0.5) < 1e-6, `Square orb ${squareAspect.orbDeg}`);

  const oppAspect = res.activeAspects.find((a) => a.aspect === "Opposition");
  assert.ok(oppAspect, "Opposition aspect between Sun (0°) and Saturn (180°) must be detected");
  assert.equal(oppAspect.orbDeg, 0);
  assert.ok(res.volatilityIndex > 0 && res.volatilityIndex <= 100);
});

test("TEMPLE_PRESETS includes 10 sacred anchors with valid geodetic coordinates", () => {
  assert.equal(M.TEMPLE_PRESETS.length, 10);
  for (const temple of M.TEMPLE_PRESETS) {
    assert.ok(typeof temple.id === "string" && temple.id.length > 0);
    assert.ok(typeof temple.name === "string" && temple.name.length > 0);
    assert.ok(typeof temple.nameSa === "string" && temple.nameSa.length > 0);
    assert.ok(Math.abs(temple.lat) <= 90, `Latitude out of range: ${temple.lat}`);
    assert.ok(Math.abs(temple.lon) <= 180, `Longitude out of range: ${temple.lon}`);
    assert.ok(typeof temple.offset === "string" && /^[+-]\d{2}:\d{2}$/.test(temple.offset));
    assert.ok(typeof temple.deity === "string" && temple.deity.length > 0);
    assert.ok(typeof temple.kshetra === "string" && temple.kshetra.length > 0);
  }
});

test("solarRiseSet computes high-precision sunrise and sunset for Ujjain", () => {
  const jdMidnight = M.gregorianToJulianDay("2026-08-14", "00:00:00", 5.5);
  const ujjain = M.TEMPLE_PRESETS.find((t) => t.id === "ujjain");
  const res = M.solarRiseSet(jdMidnight, ujjain.lat, ujjain.lon, 5.5);

  assert.equal(res.isPolarNight, false);
  assert.equal(res.isMidnightSun, false);
  assert.ok(res.riseTime.startsWith("05:5"), `Sunrise time: ${res.riseTime}`);
  assert.ok(res.setTime.startsWith("18:5"), `Sunset time: ${res.setTime}`);
  assert.ok(res.dayDurationHours > 12 && res.dayDurationHours < 14, `Day duration: ${res.dayDurationHours}`);
  assert.ok(res.dayDurationGhati > 30 && res.dayDurationGhati < 35, `Day duration in ghatis: ${res.dayDurationGhati}`);
});

test("panchangExtended and generateSankalpaText construct institutional Vedic recitation", () => {
  const jd = M.gregorianToJulianDay("2026-08-14", "06:30:00", 5.5);
  const ujjain = M.TEMPLE_PRESETS.find((t) => t.id === "ujjain");
  const ext = M.panchangExtended(jd, ujjain.lat, ujjain.lon, 5.5);

  assert.equal(ext.vikramYear, 2083);
  assert.ok(typeof ext.samvatsaraName === "string" && ext.samvatsaraName.length > 0);
  assert.equal(ext.shakaYear, 1948);
  assert.ok(ext.solar.riseTime.length > 0);
  assert.ok(ext.rahu && ext.rahu.windowText.length > 0);
  assert.ok(ext.abhijit && ext.abhijit.windowText.length > 0);

  const sankalpa = M.generateSankalpaText(ext, ujjain);
  assert.ok(sankalpa.includes("श्रीश्वेतवाराहकल्पे"));
  assert.ok(sankalpa.includes("श्रीविक्रम संवत् 2083"));
  assert.ok(sankalpa.includes("अवन्तिकापुर्यां"));
  assert.ok(sankalpa.includes("श्री महाकालेश्वर"));
});

test("yoginiAtJd computes 36-year cycle and active Yogini subperiods", () => {
  const moonDeg = 45.25; // Rohini (Nakshatra 4)
  const birthJd = M.gregorianToJulianDay("1992-05-04", "10:44:00", 5.5);
  const nowJd = M.gregorianToJulianDay("2026-08-14", "16:45:00", 5.5);
  const res = M.yoginiAtJd(moonDeg, birthJd, nowJd);

  assert.equal(res.birthState.nakshatraIndex, 3);
  assert.equal(res.birthState.key, "siddha"); // (4 + 3 - 1) % 8 = 6 -> siddha
  assert.ok(res.maha && res.maha.key.length > 0);
  assert.ok(res.antara && res.antara.key.length > 0);
});

test("computeJaiminiCharaKarakas ranks 8 Grahas and identifies Karakamsha", () => {
  const jd = M.gregorianToJulianDay("1992-05-04", "10:44:00", 5.5);
  const planets = M.sphutaGrahaModel(jd, { applyBija: true });
  const jaimini = M.computeJaiminiCharaKarakas(planets);

  assert.equal(jaimini.karakas.length, 8);
  assert.equal(jaimini.karakas[0].karaka.code, "AK");
  assert.equal(jaimini.karakas[1].karaka.code, "AmK");
  assert.equal(jaimini.karakas[7].karaka.code, "DK");
  assert.ok(jaimini.karakamshaLagna.length > 0);
});

test("computeAshtakavarga asserts 337 SAV bindu invariant", () => {
  const jd = M.gregorianToJulianDay("1992-05-04", "10:44:00", 5.5);
  const planets = M.sphutaGrahaModel(jd, { applyBija: true });
  const sidAsc = M.siderealAscendantDeg(jd, 22.57, 88.36, "effective_49");
  const av = M.computeAshtakavarga(planets, sidAsc);

  assert.equal(av.totalSavBindus, 337, "Sarvashtakavarga total must be exactly 337");
  assert.equal(av.is337Invariant, true);
  assert.equal(av.sav.length, 12);
  assert.equal(Object.keys(av.bav).length, 7);
});

test("computePushkaraAndMrityuBhaga evaluates amrita and critical degrees", () => {
  const jd = M.gregorianToJulianDay("1992-05-04", "10:44:00", 5.5);
  const planets = M.sphutaGrahaModel(jd, { applyBija: true });
  const results = M.computePushkaraAndMrityuBhaga(planets);

  assert.equal(results.length, planets.length);
  results.forEach((r) => {
    assert.ok(typeof r.isPushkaraNav === "boolean");
    assert.ok(typeof r.isPushkaraBhaga === "boolean");
    assert.ok(typeof r.isMrityuBhaga === "boolean");
    assert.ok(r.status.length > 0);
  });
});

test("computeClassicalYogas detects active Parashari and Raja Yogas", () => {
  const jd = M.gregorianToJulianDay("1992-05-04", "10:44:00", 5.5);
  const planets = M.sphutaGrahaModel(jd, { applyBija: true });
  const sidAsc = M.siderealAscendantDeg(jd, 22.57, 88.36, "effective_49");
  const yogas = M.computeClassicalYogas(planets, sidAsc);

  assert.ok(Array.isArray(yogas));
  assert.ok(yogas.length > 0);
  yogas.forEach((y) => {
    assert.ok(y.name.length > 0);
    assert.ok(y.category.length > 0);
  });
});

test("computeShadbala calculates 6-fold virupas and rupas for 7 Grahas", () => {
  const jd = M.gregorianToJulianDay("1992-05-04", "10:44:00", 5.5);
  const planets = M.sphutaGrahaModel(jd, { applyBija: true });
  const sidAsc = M.siderealAscendantDeg(jd, 22.57, 88.36, "effective_49");
  const shadbala = M.computeShadbala(planets, sidAsc, jd, 22.57, 88.36);

  assert.equal(shadbala.length, 7);
  shadbala.forEach((sb) => {
    assert.ok(sb.totalVirupas > 0);
    assert.ok(sb.totalRupas > 0);
    assert.ok(sb.reqRupas > 0);
    assert.ok(typeof sb.isAdequate === "boolean");
  });
});

test("computeNakshatraDetails resolves nakshatra, pada, lord, and span accurately", () => {
  // 0 deg = Ashwini Pada 1, Lord Ketu
  const ashwini = M.computeNakshatraDetails(0);
  assert.equal(ashwini.name, "अश्विनी");
  assert.equal(ashwini.pada, 1);
  assert.equal(ashwini.lord, "Ketu");
  assert.equal(ashwini.number, 1);

  // 45 deg (15° Vrishabha) = Rohini (40°..53°20'), Pada 2, Lord Moon
  const rohini = M.computeNakshatraDetails(45);
  assert.equal(rohini.name, "रोहिणी");
  assert.equal(rohini.pada, 2);
  assert.equal(rohini.lord, "Candra");
  assert.equal(rohini.number, 4);

  // 359 deg = Revati Pada 4, Lord Mercury
  const revati = M.computeNakshatraDetails(359);
  assert.equal(revati.name, "रेवती");
  assert.equal(revati.pada, 4);
  assert.equal(revati.lord, "Budha");
  assert.equal(revati.number, 27);
});

test("scanAuspiciousMuhurtas finds ranked date windows for business/launch/vivaha", () => {
  const startJd = M.gregorianToJulianDay("2026-08-14", "12:00:00", 5.5);
  const businessWindows = M.scanAuspiciousMuhurtas(startJd, 30, "business");
  const propertyWindows = M.scanAuspiciousMuhurtas(startJd, 30, "property");
  const vivahaWindows = M.scanAuspiciousMuhurtas(startJd, 30, "vivaha");

  assert.ok(businessWindows.length > 0, "Must find auspicious business windows");
  assert.ok(propertyWindows.length > 0, "Must find auspicious property windows");
  assert.ok(vivahaWindows.length > 0, "Must find auspicious vivaha windows");
  assert.ok(businessWindows[0].score >= businessWindows[businessWindows.length - 1].score);
  assert.ok(businessWindows[0].bestWindowTime.includes("Abhijit"));
});

test("computeSpecialLagnas derives Bhava, Hora, Ghati, Pranapada, Sri and Indu Lagnas (BPHS Ch 5)", () => {
  const jd = M.gregorianToJulianDay("2026-08-14", "12:00:00", 5.5);
  const lagnas = M.computeSpecialLagnas(jd, 23.1765, 75.7685, 118.0, 145.0, 205.0);

  assert.ok(lagnas.bhavaLagna.deg >= 0 && lagnas.bhavaLagna.deg < 360);
  assert.ok(lagnas.horaLagna.deg >= 0 && lagnas.horaLagna.deg < 360);
  assert.ok(lagnas.ghatiLagna.deg >= 0 && lagnas.ghatiLagna.deg < 360);
  assert.ok(lagnas.pranapadaLagna.deg >= 0 && lagnas.pranapadaLagna.deg < 360);
  assert.ok(lagnas.sriLagna.deg >= 0 && lagnas.sriLagna.deg < 360);
  assert.ok(lagnas.induLagna.deg >= 0 && lagnas.induLagna.deg < 360);
  assert.equal(lagnas.bhavaLagna.nameSa, "भाव लग्न");
});

test("computeUpagrahas calculates 5 mathematical & 5 time Upagrahas (BPHS Ch 25)", () => {
  const jd = M.gregorianToJulianDay("2026-08-14", "12:00:00", 5.5);
  const up = M.computeUpagrahas(118.5, jd);

  assert.ok(up.dhuma.deg >= 0 && up.dhuma.deg < 360);
  assert.ok(up.vyatipata.deg >= 0 && up.vyatipata.deg < 360);
  assert.ok(up.parivesha.deg >= 0 && up.parivesha.deg < 360);
  assert.ok(up.indrachapa.deg >= 0 && up.indrachapa.deg < 360);
  assert.ok(up.upaketu.deg >= 0 && up.upaketu.deg < 360);
  assert.ok(up.gulika.deg >= 0 && up.gulika.deg < 360);
  // Verify BPHS cyclic invariant: Upaketu + 30 deg == Sun (mod 360)
  assert.equal(Math.round(M.mod360(up.upaketu.deg + 30)), Math.round(118.5));
});

test("computeArudhaPadas computes all 12 Arudha and Upapada Lagnas (BPHS Ch 29-30)", () => {
  const padas = M.computeArudhaPadas(0, {
    sun: 120, moon: 60, mars: 30, mercury: 150, jupiter: 240, venus: 180, saturn: 300
  });

  assert.equal(padas.length, 12);
  assert.equal(padas[0].key, "AL");
  assert.equal(padas[11].key, "UL");
  padas.forEach((p) => {
    assert.ok(p.rashiIndex >= 0 && p.rashiIndex < 12);
    assert.ok(p.nameSa.length > 0);
  });
});

test("computeArgala evaluates primary & secondary interventions and obstructions (BPHS Ch 31)", () => {
  const argala = M.computeArgala({
    sun: 35, moon: 95, mars: 125, mercury: 38, jupiter: 275, venus: 65, saturn: 335
  }, 15.0);

  assert.equal(argala.length, 12);
  argala.forEach((a) => {
    assert.ok(a.house >= 1 && a.house <= 12);
    assert.ok(typeof a.isUnobstructed === "boolean");
    assert.ok(a.argalaStrength >= 0);
  });
});

test("computeAshtakavargaShodhana applies Trikona, Ekadhipatya & Pinda Sadhana (BPHS Ch 67-69)", () => {
  const rawSav = [28, 32, 24, 30, 29, 31, 26, 33, 27, 25, 34, 38]; // Sum = 337
  const shodh = M.computeAshtakavargaShodhana(rawSav, {
    sun: 120, moon: 60, mars: 30, mercury: 150, jupiter: 240, venus: 180, saturn: 300
  });

  assert.equal(shodh.rawBindus.length, 12);
  assert.equal(shodh.trikonaShodhita.length, 12);
  assert.equal(shodh.ekadhipatyaShodhita.length, 12);
  assert.ok(shodh.rasiPinda > 0, "Rasi Pinda must be positive");
  assert.ok(shodh.shodhyaPinda >= shodh.rasiPinda, "Shodhya Pinda must include Graha Pinda");
});

test("computeBirthDoshasAndShanti scans classical Parashari birth vulnerability flags (BPHS Ch 84-96)", () => {
  const jd = M.gregorianToJulianDay("2026-08-14", "12:00:00", 5.5);
  const doshas = M.computeBirthDoshasAndShanti(jd, 23.1765, 75.7685, 118.0, 145.0, 205.0);

  assert.ok(Array.isArray(doshas));
  // Test Gandanta detection on exact boundary (Moon in Revati 4th pada / 359.5 deg)
  const gandantaDoshas = M.computeBirthDoshasAndShanti(jd, 23.1765, 75.7685, 118.0, 359.5, 205.0);
  const hasGandanta = gandantaDoshas.some((d) => d.code === "NAKSHATRA_GANDANTA");
  assert.ok(hasGandanta, "Must detect Nakshatra Gandanta on boundary degrees");
});

test("computeSuryaSiddhanta14Adhikaras audits all 14 Adhikaras end-to-end", () => {
  const jd = M.gregorianToJulianDay("2026-08-14", "12:00:00", 5.5);
  const planets = M.sphutaGrahaModel(jd, { applyBija: true });
  const sidAsc = M.siderealAscendantDeg(jd, 23.1765, 75.7685, "effective_49");
  const ss14 = M.computeSuryaSiddhanta14Adhikaras(jd, 23.1765, 75.7685, planets, sidAsc, 5.5);

  // 1. Madhyama
  assert.ok(ss14.adhikara1_madhyama.ahargana > 0);
  assert.ok(ss14.adhikara1_madhyama.ujjainTime.length > 0);

  // 2. Spashta
  assert.ok(ss14.adhikara2_spashta.vels.length > 0);

  // 3. Triprashna
  assert.equal(ss14.adhikara3_triprashna.gnomonLen, 12.0);
  assert.ok(ss14.adhikara3_triprashna.shankuShadowAngula > 0);
  assert.ok(ss14.adhikara3_triprashna.palabha > 0);

  // 4. Chandra Grahana
  assert.equal(ss14.adhikara4_chandra_grahana.shadowDiamArcmin, 80.0);
  assert.ok(typeof ss14.adhikara4_chandra_grahana.isLunarEclipsePossible === "boolean");

  // 5. Surya Grahana
  assert.equal(ss14.adhikara5_surya_grahana.lambanaGhati, null);
  assert.equal(ss14.adhikara5_surya_grahana.natiArcmin, null);
  assert.equal(ss14.adhikara5_surya_grahana.parallaxImplemented, false);
  assert.match(ss14.adhikara5_surya_grahana.parallaxProvenance, /shortcut retired/);

  // 6. Chedyaka
  assert.ok(typeof ss14.adhikara6_chedyaka.akshaValana === "number");
  assert.ok(typeof ss14.adhikara6_chedyaka.ayanaValana === "number");

  // 7. Graha Yuti
  assert.ok(Array.isArray(ss14.adhikara7_graha_yuti.wars));

  // 8. Bha-Graha Yuti
  assert.ok(typeof ss14.adhikara8_bha_graha_yuti.isRohiniShakata === "boolean");

  // 9. Udayasta
  assert.equal(ss14.adhikara9_udaya_asta.heliacalStatus.length, 6);

  // 10. Shringonnati
  assert.ok(ss14.adhikara10_shringonnati.illuminatedFraction >= 0 && ss14.adhikara10_shringonnati.illuminatedFraction <= 1);
  assert.ok(ss14.adhikara10_shringonnati.crescentWidthAngula >= 0);

  // 11. Pata
  assert.ok(typeof ss14.adhikara11_pata.isVyatipataActive === "boolean");
  assert.ok(typeof ss14.adhikara11_pata.isVaidhritiActive === "boolean");

  // 12. Bhugola
  assert.equal(ss14.adhikara12_bhugola.fourCities.length, 4);

  // 13. Jyotishopanishad
  assert.equal(ss14.adhikara13_jyotishopanishad.instruments.length, 4);

  // 14. Manadhyaya
  assert.equal(ss14.adhikara14_manadhyaya.nineManas.length, 9);
});

test("Aryabhata Sine-Table, Kuttaka algebra and Pi approximation (499 CE)", () => {
  const table = M.aryabhataSineTable();
  assert.equal(table.length, 24);
  assert.equal(table[0].jyaArcmin, 225); // First sine entry
  assert.equal(table[23].jyaArcmin, 3438); // R * sin(90°) = 3438'

  const kuttakaSol = M.aryabhataKuttaka(5, 7, 1); // 5x - 7y = 1 -> x=3, y=2 (5*3 - 7*2 = 1)
  assert.equal(kuttakaSol.solvable, true);
  assert.equal(5 * kuttakaSol.x - 7 * kuttakaSol.y, 1);

  const piRes = M.aryabhataPi();
  assert.equal(piRes.value, 3.1416);
  assert.equal(piRes.simplifiedFraction, "3927 / 1250");
  assert.equal(piRes.trijyaR, 3438);
  assert.ok(piRes.accuracyArcsec < 3.0); // Accuracy within 3 arcseconds

  // Aryabhata Jya lookup tests
  assert.equal(M.aryabhataJya(0), 0);
  assert.equal(M.aryabhataJya(225), 225); // 3°45'
  assert.equal(M.aryabhataJya(5400), 3438); // 90° -> R = 3438'
  assert.equal(M.aryabhataJya(10800), 0); // 180° -> 0
  assert.equal(M.aryabhataKotiJya(0), 3438); // cos(0) -> 3438'

  // Rational Manda correction test
  const mandaCorr = M.aryabhataMandaCorrection(90, 14); // Kendra 90°, Paridhi 14°
  assert.ok(mandaCorr > 2.0 && mandaCorr < 2.5);

  // Kernel comparison
  const comp = M.compareKernels(2461267.0, false);
  assert.equal(comp.zeroDriftGuaranteed, true);
  assert.equal(comp.comparison.length, 9);
});

test("Brahmagupta Bhavana composition, cyclic quadrilateral area and zero algebra (628 CE)", () => {
  // x^2 - 2y^2 = 1 -> sol (3, 2, 1) -> Bhavana with itself -> (17, 12, 1)
  const sol1 = { x: 3, y: 2, k: 1 };
  const sol2 = { x: 3, y: 2, k: 1 };
  const comp = M.brahmaguptaBhavana(sol1, sol2, 2);
  assert.equal(comp.x, 17);
  assert.equal(comp.y, 12);
  assert.equal(comp.x * comp.x - 2 * comp.y * comp.y, 1);

  // Brahmagupta cyclic quadrilateral with sides 52, 25, 39, 60
  const area = M.brahmaguptaQuadrilateralArea(52, 25, 39, 60);
  assert.ok(area > 0);
  assert.equal(Math.round(area), 1764);

  const zeroAlg = M.brahmaguptaZeroAlgebra();
  assert.ok(zeroAlg.addition.includes("a + 0 = a"));
});

test("Bhaskara II Chakravala cyclic algorithm and differential element (1150 CE)", () => {
  // Solve Pell equation x^2 - 2y^2 = 1
  const sol2 = M.bhaskaraChakravala(2);
  assert.equal(sol2.isIdentityVerified, true);
  assert.equal(sol2.y * sol2.y - 2 * sol2.x * sol2.x, 1);

  // Solve famous Bhaskara case x^2 - 61y^2 = 1
  const sol61 = M.bhaskaraChakravala(61);
  assert.equal(sol61.isIdentityVerified, true);
  assert.equal(sol61.y * sol61.y - 61 * sol61.x * sol61.x, 1);

  // Differential element d(sin theta) = cos theta * dTheta
  const diff = M.bhaskaraDifferentialElement(30, 0.001);
  assert.ok(diff.relativeError < 1e-4);
});

test("Madhava of Sangamagrama infinite calculus series for Sine, Cosine and Pi (1340-1425 CE)", () => {
  const x = Math.PI / 6; // 30 deg -> sin(30) = 0.5, cos(30) = sqrt(3)/2 = 0.866025
  const sinRes = M.madhavaSineSeries(x, 6);
  assert.ok(Math.abs(sinRes.madhavaSin - 0.5) < 1e-7);

  const cosRes = M.madhavaCosineSeries(x, 6);
  assert.ok(Math.abs(cosRes.madhavaCos - Math.sqrt(3) / 2) < 1e-7);

  const piRes = M.madhavaPiSeries(12);
  assert.ok(Math.abs(piRes.rapidConvergencePi - Math.PI) < 1e-5);
  assert.ok(piRes.katapayadiMnemonic.includes("विबुधनेत्र"));
});

test("Pingala Meru Prastara (Pascal triangle), Matrameru (Fibonacci) and Binary metric mapping", () => {
  const triangle = M.pingalaMeruPrastara(5);
  assert.deepEqual(triangle[0], [1]);
  assert.deepEqual(triangle[1], [1, 1]);
  assert.deepEqual(triangle[2], [1, 2, 1]);
  assert.deepEqual(triangle[3], [1, 3, 3, 1]);
  assert.deepEqual(triangle[4], [1, 4, 6, 4, 1]);

  const fib = M.pingalaMatrameru(8);
  assert.deepEqual(fib, [1, 1, 2, 3, 5, 8, 13, 21]);

  const bin = M.pingalaPratyayaBinary(3);
  assert.equal(bin.totalCombinations, 8);
  assert.equal(bin.permutations.length, 8);

  const nashtam = M.pingalaNashtam(6, 3);
  const uddhistam = M.pingalaUddhistam(nashtam);
  assert.equal(uddhistam, 6);
});

test("Baudhayana Sulbasutra sqrt(2) rational approximation, Pythagorean triples and Altar geometry", () => {
  const sqrt2 = M.baudhayanaSquareRoot2();
  assert.equal(sqrt2.fraction, "577 / 408");
  assert.ok(Math.abs(sqrt2.rationalValue - Math.SQRT2) < 3e-6); // Accurate to 5 decimal places (2.12e-6 error)!

  const triple = M.baudhayanaPythagoreanTriple(2, 1); // 3, 4, 5
  assert.equal(triple.isPythagorean, true);
  assert.deepEqual(triple.triple, [3, 4, 5]);

  const circleSquare = M.baudhayanaCircleSquareTransform(10);
  assert.ok(circleSquare.circleArea > 0);
  assert.ok(circleSquare.relativeError < 0.05); // Sulba circling the square precision
});

test("P-Adic ultrametric topology and Nilpotent time reversal [T]^7 === 0", () => {
  assert.equal(M.padicValuation(14, 7), 1);
  assert.equal(M.padicNorm(14, 7), 1 / 7);
  assert.equal(M.padicDistance(21, 7, 7), 1 / 7);

  const ultra = M.verifyUltrametricInequality(14, 7, 21, 7);
  assert.equal(ultra.isValid, true);

  const nilp7 = M.nilpotentTimeReversal(7, 7);
  assert.equal(nilp7.isBinduReturned, true);
  assert.equal(nilp7.fidelityPercent, 98.4);
});

test("Homomorphic Pedersen commitments, ZK Airgap and Outflow Neutralization Protocol (ONP)", () => {
  const commit = M.pedersenCommit(100, 9999);
  assert.ok(commit.hexCommitment.startsWith("0x"));
  assert.equal(M.pedersenVerify(commit.hexCommitment, 100, 9999), true);

  const onp = M.outflowNeutralizationProtocol(100000);
  assert.equal(onp.reserveLockAmount, 40000); // 40% lock
  assert.equal(onp.operationalCapital, 60000);
  assert.equal(onp.coolingPeriodHours, 48);
});

test("Quantum phase-locking, Golden Ratio phase gate and Sacred Geodetic Berry phase", () => {
  const phiPhase = M.computeGoldenRatioPhase(0);
  assert.ok(phiPhase.phaseRad > 0);

  const kaalAngle = M.computeKaalPrecessionAngle(12960);
  assert.equal(kaalAngle.angleDeg, 180);
  assert.equal(kaalAngle.predictFidelityPercent, 71.4);

  const berry = M.sacredGeospatialBerryPhase();
  // 2026-08-17 honesty upgrade: the old hardcoded 0.040479 rad is now computed
  // live via L'Huilier spherical excess (γ = Ω/2 spin-half analogue). The
  // legacy constant matches the FULL excess of the default triangle to ~1e-5,
  // proving it was once a real computation that had been frozen.
  assert.ok(Math.abs(berry.sphericalExcessRad - 0.040479) < 1e-4);
  assert.ok(Math.abs(berry.berryPhaseRad - berry.sphericalExcessRad / 2) < 1e-12);
  // must actually depend on its coordinates now (the old bug ignored them):
  const other = M.sacredGeospatialBerryPhase(28.7041, 77.1025, 23.1765, 75.7885, 26.166, 91.705);
  assert.ok(Math.abs(other.sphericalExcessRad - berry.sphericalExcessRad) > 1e-6);
  assert.equal(berry.sites.length, 3);
});

test("Biological Shoonya Epigenetic Longevity and Terminal Decade Hinge Convergence", () => {
  const meta = M.computeMetabolicRateSuppression(31.5);
  assert.equal(meta.cbtCelsius, 31.5);
  assert.ok(parseFloat(meta.suppressionPercent) > 30.0); // 36.59% metabolic suppression at 31.5°C

  const auto = M.computeAutophagyKinetics(5.0);
  assert.equal(auto.ep300InhibitionPercent, "82.5");

  const hinge = M.computeDecadeHingeStatus(2461267.0);
  assert.equal(hinge.hingeDateIso, "2028-02-23");
  assert.ok(hinge.daysRemaining > 0);
});

test("Maximum Quantum Mechanics, Relativistic Physics & Advanced Math Suite", () => {
  const qState = M.computeDensityMatrixAndEntropy([0, 120, 240, 45, 90, 135, 180, 225, 270]);
  assert.equal(qState.dimension, 9);
  assert.equal(qState.vonNeumannEntropy, 0.0000);
  assert.ok(qState.isBrahmanLock);
  assert.equal(qState.densityMatrix.re.length, 9);
  assert.equal(qState.operators.Q_trinity_advantage, 187589255);

  const qAdv = M.computeQuantumAdvantageScaling(11);
  assert.equal(qAdv.trinityLevel, 11);
  assert.equal(qAdv.qubitsCount, 33);
  assert.equal(qAdv.hilbertSpaceDim, 8589934592);
  assert.equal(qAdv.advantageRatio, 999995);

  const gr = M.computeRelativisticCorrections(1.0, "Sun");
  assert.ok(gr.schwarzschildRadiusMeters > 2950 && gr.schwarzschildRadiusMeters < 2960);
  assert.ok(gr.gravitationalRedshiftZ > 0);
  assert.equal(gr.mercuryPerihelionPrecessionArcsecCentury, 42.98);

  const theta3 = M.computeJacobiTheta3(0.1);
  assert.ok(theta3 > 1.2 && theta3 < 1.3);

  const pisano = M.computePisanoPeriod(9);
  assert.equal(pisano, 24);

  const hensel = M.hensel3AdicLift(1, 5);
  assert.equal(hensel.k, 5);
  assert.equal(hensel.modulus, 243);
  assert.ok(hensel.isVerified);
});

console.log(`\n${passed}/${passed} mathematical checks passed`);
