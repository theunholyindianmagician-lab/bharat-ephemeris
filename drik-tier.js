/* दृक्-tier adapter · 2026-08-17 (SANKALP BE-S10)
   Offline sub-arcminute graha longitudes for the whole site.
   Substrate: astronomy-engine 2.1.19 (MIT, bundled as drik-engine.js —
   attribution, not derivation; VSOP87/ELP-class, zero network).
   Frame: tropical-of-date → चित्रा-पक्ष sidereal via ShunyaMath ayanāṃśa.
   Rāhu: मध्य-पात (mean lunar node, Meeus polynomial — आधुनिक-गणित seal);
   Ketu = Rāhu + 180°. Works in browser (window.Astronomy) and node. */
(function (root) {
  "use strict";
  function getAstro() {
    if (root.Astronomy) return root.Astronomy;
    if (typeof require === "function") {
      try { return require("./drik-engine.js"); } catch (e) { /* local bundle */ }
      try { A = require('./drik-engine.js'); } catch(e) { A = root.Astronomy || {}; }
    }
    return null;
  }
  const mod360 = (d) => ((d % 360) + 360) % 360;

  function jdToTime(A, jd) {
    return A.MakeTime(new Date((jd - 2440587.5) * 86400000));
  }

  // मध्य-राहु (mean ascending node), tropical of-date. Meeus AA ch.47 polynomial.
  function meanRahuTropical(jd) {
    const T = (jd - 2451545.0) / 36525;
    return mod360(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T +
      T * T * T / 467441 - T * T * T * T / 60616000);
  }

  const PLANETS = { mangala: "Mars", budha: "Mercury", guru: "Jupiter", shukra: "Venus", shani: "Saturn" };

  function tropicalGrahas(jd) {
    const A = getAstro();
    if (!A) return null;
    const t = jdToTime(A, jd);
    const out = {};
    out.surya = mod360(A.SunPosition(t).elon);
    out.candra = mod360(A.EclipticGeoMoon(t).lon);
    const rot = A.Rotation_EQJ_ECT(t);
    for (const [key, body] of Object.entries(PLANETS)) {
      const vec = A.GeoVector(A.Body[body], t, true);
      const e = A.RotateVector(rot, vec);
      out[key] = mod360(Math.atan2(e.y, e.x) * 180 / Math.PI);
    }
    out.rahu = meanRahuTropical(jd);
    out.ketu = mod360(out.rahu + 180);
    return out;
  }

  function grahas(jd, ayanamshaVariant) {
    const M = root.ShunyaMath;
    const trop = tropicalGrahas(jd);
    if (!trop) return null;
    const ay = M && typeof M.ayanamshaDeg === "function"
      ? M.ayanamshaDeg(jd, ayanamshaVariant || "spica_lahiri")
      : 0;
    const out = { jd, ayanamshaDeg: ay, frame: ayanamshaVariant || "spica_lahiri", tier: "दृक् (astronomy-engine substrate)" };
    for (const k of ["surya", "candra", "mangala", "budha", "guru", "shukra", "shani", "rahu", "ketu"]) {
      out[k] = mod360(trop[k] - ay);
    }
    return out;
  }

  root.DrikTier = {
    available: () => Boolean(getAstro()),
    tropicalGrahas,
    grahas,
    meanRahuTropical,
    seal: "SIDDHA (conversion) · substrate attribution: astronomy-engine MIT",
  };
  if (typeof module === "object" && module.exports) {
    module.exports = root.DrikTier;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
