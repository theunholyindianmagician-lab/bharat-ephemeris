(function (root) {
  "use strict";
  const M = root.ShunyaMath;
  if (!M || typeof M.panchangExtended !== "function") return;

  const TZ = 5.5, LAT = 23.1765, LON = 75.7885;
  const DEVN = "०१२३४५६७८९";
  const hi = function (n) { return String(n).replace(/[0-9]/g, function (d) { return DEVN[d]; }); };
  const C = { cyan: "#5FD3E8", gold: "#EAC97B", green: "#84D69A", soft: "rgba(220,230,234,.55)", line: "rgba(234,201,123,.24)" };
  const COL = { surya: "#EAC97B", candra: "#DCE6EA", chandra: "#DCE6EA", mangala: "#E86A4B", budha: "#9AA6B2", guru: "#D9A05B", shukra: "#E8D7A8", shani: "#7E8CA0", rahu: "#8A79C8", ketu: "#C878A0" };
  // §C8 shared देवनागरी graha-lookup (labels only) — prefer global-ui's map when present
  const GRAHA_DEV = root.GrahaDev || { surya: "सूर्यः", candra: "चन्द्रः", chandra: "चन्द्रः", mangala: "मङ्गलः", budha: "बुधः", guru: "गुरुः", shukra: "शुक्रः", shani: "शनिः", rahu: "राहुः", ketu: "केतुः", lagna: "लग्नः" };
  const devGraha = function (key) { return GRAHA_DEV[key] || key; };
  const BOOKS = [
    ["surya", "Sūrya Siddhānta", "editions/surya-siddhanta-full-edition.html"],
    ["aryabhata", "Āryabhaṭīya", "editions/aryabhata-full-edition.html"],
    ["brahmagupta", "Brāhmasphuṭa", "editions/brahmagupta-full-edition.html"],
    ["bhaskara", "Līlāvatī", "editions/bhaskara-full-edition.html"],
    ["madhava", "Mādhava", "editions/madhava-full-edition.html"],
    ["pingala", "Piṅgala", "editions/pingala-full-edition.html"],
    ["sulba", "Śulba", "editions/sulba-full-edition.html"],
    ["panini", "Pāṇini", "editions/panini-rahasya-full-edition.html"],
    ["parashara", "Parāśara", "editions/parashara-rahasya-full-edition.html"],
    ["grantha", "Mahā Grantha", "editions/maha-grantha-full-edition.html"]
  ];

  let lastGrahaSig = "";
  let lastBhavaSig = "";
  let warnedRmaxOnce = false;

  // Dual day-paths (sāvana / nākṣatra) — computed ONCE at boot from math-core
  // dualDayPaths(): breathS = dayS/21600 s per prāṇa, kalaPerBreath = 1.0000000
  // exactly on the nākṣatra path (1 प्राण ≡ 1 कला of Earth rotation). (SIDDHA)
  const DUAL = typeof M.dualDayPaths === "function" ? M.dualDayPaths() : null;


  function nowState() {
    const utc = new Date(Date.now() + TZ * 3600000);
    const date = utc.toISOString().slice(0, 10);
    const time = utc.toISOString().slice(11, 19);
    const jd = M.gregorianToJulianDay(date, time, TZ);
    const p = M.panchangExtended(jd, LAT, LON, TZ);
    // panchangExtended already runs bhavaModel internally and bundles the result;
    // reuse that bundle instead of computing bhavaModel a second time per tick.
    let bhava = null;
    if (p.bhavas && p.lagna != null) {
      const madhyas = Array(13);
      p.bhavas.forEach(function (item) { madhyas[item.no] = item.madhya; });
      bhava = { lagna: p.lagna, madhyas: madhyas, bhavas: p.bhavas };
    } else if (M.bhavaModel) {
      bhava = M.bhavaModel(jd, LAT, LON);
    }
    const grahas = M.canonicalGrahaModel ? M.canonicalGrahaModel(jd) : [];
    return { date: date, time: time, jd: jd, p: p, bhava: bhava, grahas: grahas };
  }

  function polar(r, deg) {
    const a = (-90 + deg) * Math.PI / 180;
    return [r * Math.cos(a), r * Math.sin(a)];
  }

  // Continuous ghaṭī-clock hand fractions from ONE live epoch-ms timestamp.
  // Mirrors the IST-midnight day convention of the 1 Hz panchang tick
  // (math-core panchangAtJd: mod(jd + tz/24 − 0.5, 1) of the local civil day;
  // ghaṭī = 1 440 000 ms, vighaṭī = 24 000 ms) and of civilClock() below.
  function ghatiHandFracs(epochMs) {
    const dayMs = (((epochMs + TZ * 3600000) % 86400000) + 86400000) % 86400000;
    return {
      dayMs: dayMs,
      ghatiHand: dayMs / 86400000,               // full-dial fraction: ghaṭī-of-day
      vighatiHand: (dayMs % 1440000) / 1440000   // fraction of the current ghaṭī
    };
  }

  function drawPanchangDial(canvas, p) {
    if (!canvas || !p) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const css = rect.width || canvas.clientWidth || 640;
    const dpr = Math.min(root.devicePixelRatio || 1, 2.5);
    const targetPixels = Math.max(2, Math.round(css * dpr));
    if (canvas.width !== targetPixels || canvas.height !== targetPixels) {
      canvas.width = targetPixels;
      canvas.height = targetPixels;
    }
    const R = css / 2;
    const NAK = M.NAKSHATRA_NAMES || [];
    const RASHI = M.RASHI_SA || [];
    const glEl = typeof document !== "undefined" && document.getElementById("ghatiField");
    const glUnder = glEl && glEl.getAttribute("data-field-ok") === "1";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, css, css);
    if (!glUnder) {
      ctx.fillStyle = "#030713";
      ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.translate(R, R);
    function ring(inner, outer, count, active, col, hot) {
      for (let i = 0; i < count; i++) {
        const d = i / count * 360;
        const a = polar(inner, d), b = polar(outer, d);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
        ctx.strokeStyle = i === active ? hot : col;
        ctx.lineWidth = i === active ? 2.6 : 1;
        ctx.stroke();
      }
    }
    function arc(inner, outer, frac, col) {
      const s = -Math.PI / 2, e = s + frac * Math.PI * 2;
      ctx.beginPath(); ctx.arc(0, 0, inner, s, e); ctx.arc(0, 0, outer, e, s, true); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
    }
    function labels(count, radius, arr, font, col, step) {
      ctx.fillStyle = col; ctx.font = font; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      step = step || 1;
      for (let i = 0; i < count; i += step) {
        const d = i / count * 360;
        const pt = polar(radius, d);
        ctx.save(); ctx.translate(pt[0], pt[1]); ctx.rotate((-90 + d) * Math.PI / 180);
        ctx.fillText(arr[i] || "", 0, 0); ctx.restore();
      }
    }
    const masa = p.sauraMasaIndex || 0;
    if (!glUnder) {
      arc(R * 0.98, R * 0.86, masa / 12, "rgba(234,201,123,.10)");
      ring(R * 0.86, R * 0.98, 12, masa, C.gold, "#ffe9a8");
      arc(R * 0.76, R * 0.68, (p.tithiIndex || 0) / 30, "rgba(95,211,232,.08)");
      ring(R * 0.68, R * 0.76, 30, p.tithiIndex || 0, C.cyan, C.cyan);
      arc(R * 0.60, R * 0.52, (p.nakshatraIndex || 0) / 27, "rgba(132,214,154,.15)");
      ring(R * 0.52, R * 0.60, 27, p.nakshatraIndex || 0, C.green, "#a2e6b2");
      arc(R * 0.44, R * 0.38, (p.ghati || 0) / 60, "rgba(220,230,234,.10)");
      ring(R * 0.38, R * 0.44, 60, p.ghati || 0, C.soft, "#bcd3da");
      ring(R * 0.30, R * 0.34, 60, p.vighati || 0, C.gold, "#ffe9a8");
      arc(R * 0.34, R * 0.30, (p.vighati || 0) / 60, "rgba(234,201,123,.10)");
    }
    labels(12, R * 0.81, RASHI, "600 11px ui-monospace,monospace", C.gold);
    labels(30, R * 0.635, Array.from({ length: 30 }, function (_, i) { return i % 5 === 0 ? String((i % 15) + 1) : ""; }), "500 9px ui-monospace,monospace", C.soft);
    labels(27, R * 0.475, NAK, "600 7px ui-monospace,monospace", C.green);
    labels(60, R * 0.35, Array.from({ length: 60 }, function (_, i) { return i % 15 === 0 ? hi(i) : ""; }), "500 9px ui-monospace,monospace", C.soft);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.28, 0, Math.PI * 2); ctx.fillStyle = glUnder ? "rgba(10,14,28,.5)" : "#0a0e1c"; ctx.fill(); ctx.strokeStyle = C.line; ctx.stroke();
    function hand(frac, len, col, w) {
      const pt = polar(len, frac * 360);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(pt[0], pt[1]);
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.stroke();
    }
    const hf = ghatiHandFracs(Date.now());
    hand(hf.ghatiHand, R * 0.40, C.cyan, 2.4);
    hand(hf.vighatiHand, R * 0.30, C.gold, 1.6);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = C.gold; ctx.font = "700 16px ui-monospace,monospace"; ctx.fillText(hi(p.ghati) + " घटी", 0, -16);
    ctx.fillStyle = C.cyan; ctx.font = "600 11px ui-monospace,monospace"; ctx.fillText(hi(p.vighati) + " पल", 0, 0);
    ctx.fillStyle = "#84D69A"; ctx.font = "700 11px ui-monospace,monospace"; ctx.fillText("नक्षत्र " + (p.nakshatraName || ""), 0, 16);
    ctx.fillStyle = "rgba(220,230,234,.8)"; ctx.font = "500 9px ui-monospace,monospace";
    ctx.fillText("चरण " + (p.nakshatraPada || "—") + " · " + (p.nakshatraLord || ""), 0, 28);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function mod360(d) { return ((Number(d) || 0) % 360 + 360) % 360; }

  function kakshaAU(key) {
    const Bsun = (M.BHAGANAS && M.BHAGANAS.surya) || 4320000;
    if (key === "surya") return 0;
    const map = { chandra: "candra", candra: "candra", mangala: "mangala", budha: "budha", guru: "guru", shukra: "shukra", shani: "shani", rahu: "rahu", ketu: "rahu" };
    const bk = map[key] || key;
    const B = Math.abs((M.BHAGANAS && M.BHAGANAS[bk]) || 0);
    if (!B) return 1;
    return M.ssKaksha ? M.ssKaksha(B) : Math.pow(Bsun / B, 2 / 3);
  }

  function dispR(au, rMax, aMax) {
    if (au < 1e-9 || !(aMax > 0)) return 0;
    return rMax * Math.sqrt(au / aMax);
  }

  function paintDisc(ctx, x, y, r, inner, outer) {
    const safeR = Math.max(0.1, r);
    const g = ctx.createRadialGradient(x - safeR * 0.35, y - safeR * 0.35, safeR * 0.1, x, y, safeR);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, safeR, 0, Math.PI * 2);
    ctx.fill();
  }

  function bezelTicks(ctx, CX, CY, rOuter, minorStep, majorStep, minorLen, majorLen, col, hotCol) {
    for (let d = 0; d < 360; d += minorStep) {
      const major = d % majorStep === 0;
      const a = d * Math.PI / 180;
      const ri = rOuter - (major ? majorLen : minorLen);
      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(a) * rOuter, CY + Math.sin(a) * rOuter);
      ctx.lineTo(CX + Math.cos(a) * ri, CY + Math.sin(a) * ri);
      ctx.strokeStyle = major ? hotCol : col;
      ctx.lineWidth = major ? 1.4 : 0.7;
      ctx.stroke();
    }
  }

  function drawOrrery(canvas, grahas, ascendant) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || canvas.clientWidth || 640;
    const cssH = rect.height || canvas.clientHeight || cssW;
    const dpr = Math.min(root.devicePixelRatio || 1, 2.5);
    const targetW = Math.max(2, Math.round(cssW * dpr));
    const targetH = Math.max(2, Math.round(cssH * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const w = cssW;
    const h = cssH;
    const CX = w / 2;
    const CY = h / 2;
    const half = Math.min(w, h) / 2;
    const A_MAX = kakshaAU("shani");
    const RMAX = 0.78 * half;
    const R_LIMIT = 0.94 * half;
    if (RMAX > R_LIMIT && !warnedRmaxOnce) {
      warnedRmaxOnce = true;
      console.warn("drawOrrery invariant violated: RMAX " + RMAX.toFixed(1) + " > R_LIMIT " + R_LIMIT.toFixed(1) + " — grahas may leave canvas");
    }
    const glEl = typeof document !== "undefined" && document.getElementById("orreryField");
    const glUnder = glEl && glEl.getAttribute("data-field-ok") === "1";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!glUnder) {
      ctx.fillStyle = "#03060e";
      ctx.beginPath(); ctx.arc(CX, CY, half - 2, 0, Math.PI * 2); ctx.fill();
      const neb = ctx.createRadialGradient(CX, CY, 0.1, CX, CY, Math.max(1, w * 0.55));
      neb.addColorStop(0, "rgba(27,65,112,.22)");
      neb.addColorStop(1, "rgba(3,6,14,0)");
      ctx.fillStyle = neb;
      ctx.beginPath(); ctx.arc(CX, CY, half - 2, 0, Math.PI * 2); ctx.fill();
    }

    const RASHI = M.RASHI_SA || [];
    const NAK = M.NAKSHATRA_NAMES || [];
    const byKey = {};
    (grahas || []).forEach(function (g) { byKey[g.key] = g; });
    const lagna = Number(ascendant != null ? ascendant : (byKey.surya && byKey.surya.longitude) || 0);
    const moonG = byKey.candra || byKey.chandra;
    const moonLon = moonG ? Number(moonG.longitude || 0) : null;

    const rBezel = half * 0.955;
    const rRashiIn = half * 0.83;
    ctx.strokeStyle = "rgba(234,201,123,.30)"; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(CX, CY, rBezel, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(CX, CY, rRashiIn, 0, Math.PI * 2); ctx.stroke();
    const lagnaSector = Math.floor(mod360(lagna) / 30);
    const s0 = (lagnaSector * 30) * Math.PI / 180, s1 = (lagnaSector * 30 + 30) * Math.PI / 180;
    ctx.beginPath();
    ctx.arc(CX, CY, rBezel, s0, s1); ctx.arc(CX, CY, rRashiIn, s1, s0, true); ctx.closePath();
    ctx.fillStyle = "rgba(234,201,123,.10)"; ctx.fill();
    for (let i = 0; i < 12; i++) {
      const a = (i * 30) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(a) * rRashiIn, CY + Math.sin(a) * rRashiIn);
      ctx.lineTo(CX + Math.cos(a) * rBezel, CY + Math.sin(a) * rBezel);
      ctx.strokeStyle = "rgba(234,201,123,.28)"; ctx.lineWidth = 1; ctx.stroke();
    }
    bezelTicks(ctx, CX, CY, rBezel, 1, 10, half * 0.012, half * 0.03,
      "rgba(234,201,123,.16)", "rgba(234,201,123,.42)");
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "600 " + Math.max(9, Math.round(w / 58)) + "px ui-monospace,monospace";
    for (let i = 0; i < 12; i++) {
      const d = i * 30 + 15;
      const a = d * Math.PI / 180;
      const rr = (rBezel + rRashiIn) / 2;
      ctx.save();
      ctx.translate(CX + Math.cos(a) * rr, CY + Math.sin(a) * rr);
      ctx.rotate((d + 90) * Math.PI / 180);
      ctx.fillStyle = i === lagnaSector ? "#ffe9a8" : "rgba(234,201,123,.5)";
      ctx.fillText(RASHI[i] || String(i + 1), 0, 0);
      ctx.restore();
    }

    const rNak = rRashiIn - half * 0.02;
    const moonNak = moonLon != null ? Math.floor(mod360(moonLon) / (360 / 27)) : -1;
    for (let i = 0; i < 27; i++) {
      const a = (i * 360 / 27) * Math.PI / 180;
      const hot = i === moonNak;
      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(a) * rNak, CY + Math.sin(a) * rNak);
      ctx.lineTo(CX + Math.cos(a) * (rNak - half * (hot ? 0.05 : 0.028)), CY + Math.sin(a) * (rNak - half * (hot ? 0.05 : 0.028)));
      ctx.strokeStyle = hot ? "#a2e6b2" : "rgba(132,214,154,.28)";
      ctx.lineWidth = hot ? 2.2 : 0.8; ctx.stroke();
    }

    function pointer(lon, col, alpha) {
      const a = mod360(lon) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(a) * (half * 0.30), CY + Math.sin(a) * (half * 0.30));
      ctx.lineTo(CX + Math.cos(a) * rRashiIn, CY + Math.sin(a) * rRashiIn);
      ctx.strokeStyle = col; ctx.globalAlpha = alpha; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(a) * rRashiIn, CY + Math.sin(a) * rRashiIn);
      ctx.lineTo(CX + Math.cos(a) * rBezel, CY + Math.sin(a) * rBezel);
      ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
    }
    ["surya", "candra", "mangala", "budha", "guru", "shukra", "shani"].forEach(function (k) {
      const g = byKey[k]; if (!g) return;
      pointer(Number(g.longitude != null ? g.longitude : g.sphuta) || 0, COL[k] || "#DCE6EA", 0.22);
    });
    pointer(lagna, "#EAC97B", 0.6);

    const corR = Math.max(1, half * 0.16);
    const cor = ctx.createRadialGradient(CX, CY, 2, CX, CY, corR);
    cor.addColorStop(0, "rgba(255,241,199,.55)");
    cor.addColorStop(0.5, "rgba(234,201,123,.18)");
    cor.addColorStop(1, "rgba(234,201,123,0)");
    ctx.fillStyle = cor;
    ctx.beginPath(); ctx.arc(CX, CY, corR, 0, Math.PI * 2); ctx.fill();
    paintDisc(ctx, CX, CY, 12, "#FFF6DA", "#C9A14A");
    ctx.fillStyle = "rgba(234,201,123,.8)";
    ctx.font = "600 10px ui-monospace,monospace"; ctx.textAlign = "center";
    ctx.fillText("सूर्य", CX, CY + 24);

    const order = ["budha", "shukra", "mangala", "guru", "shani"];
    order.forEach(function (key) {
      const g = byKey[key];
      if (!g) return;
      const au = kakshaAU(key);
      const rad = dispR(au, RMAX, A_MAX);
      ctx.beginPath();
      ctx.arc(CX, CY, rad, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(138,240,255,.16)";
      ctx.setLineDash([2, 5]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      const lon = Number(g.longitude != null ? g.longitude : g.sphuta) || 0;
      const a = lon * Math.PI / 180;
      const x = CX + Math.cos(a) * rad;
      const y = CY + Math.sin(a) * rad;
      const r = key === "guru" ? 9 : key === "shani" ? 8 : 6;
      const hgR = Math.max(1, r * 2.4);
      const hg = ctx.createRadialGradient(x, y, 1, x, y, hgR);
      hg.addColorStop(0, (COL[key] || "#DCE6EA")); hg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.35; ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(x, y, hgR, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      paintDisc(ctx, x, y, r, COL[key] || "#DCE6EA", "#1a1410");
      if (key === "shani") {
        ctx.strokeStyle = "rgba(205,187,146,.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.85, r * 0.55, 0.2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(220,230,234,.82)";
      ctx.font = "600 10px ui-monospace,monospace";
      ctx.fillText((g.sa || key) + "  a=" + au.toFixed(3) + "⊕", x, y - r - 8);
    });

    const earthAU = 1;
    const eR = dispR(earthAU, RMAX, A_MAX);
    ctx.beginPath();
    ctx.arc(CX, CY, eR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(143,194,236,.30)";
    ctx.setLineDash([2, 5]); ctx.stroke(); ctx.setLineDash([]);
    const sunLon = Number((byKey.surya && byKey.surya.longitude) || 0);
    const earthA = (sunLon + 180) * Math.PI / 180;
    const ex = CX + Math.cos(earthA) * eR;
    const ey = CY + Math.sin(earthA) * eR;
    paintDisc(ctx, ex, ey, 7, "#8FC2EC", "#28527E");
    ctx.fillStyle = "rgba(191,240,250,.85)";
    ctx.fillText("पृथ्वी", ex, ey - 14);

    const moonRing = Math.max(14, RMAX * 0.075);
    ctx.beginPath();
    ctx.arc(ex, ey, moonRing, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(226,223,215,.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ["rahu", "ketu"].forEach(function (key) {
      const node = byKey[key];
      if (!node) return;
      const nA = Number(node.longitude || 0) * Math.PI / 180;
      const nx = ex + Math.cos(nA) * moonRing;
      const ny = ey + Math.sin(nA) * moonRing;
      paintDisc(ctx, nx, ny, 3, COL[key] || "#8A79C8", "#1a1420");
      ctx.fillStyle = "rgba(220,230,234,.7)";
      ctx.font = "600 9px ui-monospace,monospace";
      ctx.fillText(node.sa || key, nx, ny - 8);
    });
    const moon = byKey.candra || byKey.chandra;
    if (moon) {
      const mLon = Number(moon.longitude || 0);
      const mA = mLon * Math.PI / 180;
      const mx = ex + Math.cos(mA) * moonRing;
      const my = ey + Math.sin(mA) * moonRing;
      paintDisc(ctx, mx, my, 4, "#E2DFD7", "#8A877E");
      const er = ((mLon - sunLon) * Math.PI / 180);
      ctx.save();
      ctx.translate(mx, my);
      ctx.beginPath();
      ctx.arc(0, 0, 4, Math.PI / 2, Math.PI * 1.5, false);
      ctx.ellipse(0, 0, 4 * Math.abs(Math.cos(er)), 4, 0, Math.PI * 1.5, Math.PI / 2, Math.cos(er) < 0);
      ctx.closePath();
      ctx.fillStyle = "rgba(5,8,16,.8)";
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = "rgba(191,240,250,.45)";
    ctx.font = "500 " + Math.max(8, Math.round(w / 64)) + "px ui-monospace,monospace";
    ctx.textAlign = "center";
    const utc = new Date(Date.now() + TZ * 3600000);
    ctx.fillText(utc.toISOString().slice(11, 19) + " IST · a/a⊕=(B☉/B)²⁄³ · √-scale disc · λ=स्फुट · उज्जयिनी 23.18°N 75.79°E", CX, h - 16);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function set(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = v == null || v === "" ? "—" : String(v);
  }

  function paintLibrary() {
    const box = document.getElementById("liveLibrary");
    if (!box || box.dataset.ready === "1") return;
    box.innerHTML = BOOKS.map(function (b) {
      return "<a class='book' href='" + b[2] + "'><b>" + b[1] + "</b><span>" + b[0] + "</span></a>";
    }).join("");
    box.dataset.ready = "1";
  }

  function paintTemples() {
    const box = document.getElementById("liveTemples");
    if (!box || box.dataset.ready === "1") return;
    const temples = M.TEMPLE_PRESETS || [];
    box.innerHTML = temples.map(function (t) {
      return "<div class='metric'><span>" + (t.tag || t.name) + "</span><strong>" + t.lat.toFixed(2) + "°N · " + t.lon.toFixed(2) + "°E</strong></div>";
    }).join("");
    box.dataset.ready = "1";
  }

  function paint() {
    const s = nowState();
    const p = s.p, b = s.bhava;
    drawPanchangDial(document.getElementById("homeDial"), p);
    drawOrrery(document.getElementById("homeOrrery"), s.grahas, s.bhava && s.bhava.lagna);
    paintTemples();
    paintLibrary();
    if (root.FieldGL && root.FieldGL.push) {
      root.FieldGL.push({
        ghati: p.ghati,
        vighati: p.vighati,
        tithi: p.tithiIndex,
        nak: p.nakshatraIndex,
        masa: p.sauraMasaIndex,
        lambda: s.grahas.map(function (g) { return g.longitude; })
      });
    }

    set("homeCivil", s.date + " · " + s.time + " IST");
    set("homeVara", p.varaName);
    set("homeYogaTop", p.yogaName);
    set("homeAhargana", Math.floor(p.ahargana).toLocaleString("en-IN"));
    set("homeGhati", String(p.ghati) + " / ६०");
    set("homeVighati", String(p.vighati) + " / ६०");
    set("homeNak", (p.nakshatraName || "—") + " · चरण " + (p.nakshatraPada || "—"));
    set("homeSeal", M.paniniHash(s.date + "|" + p.tithiIndex + "|" + p.nakshatraIndex, 8));
    set("liveTithi", (p.paksha || "") + " " + (p.tithiName || "—"));
    set("liveYogaKarana", (p.yogaName || "—") + " · " + (p.karanaName || "—"));
    set("liveMasa", p.sauraMasaName || "—");

    if (b) {
      set("liveLagna", Number(b.lagna).toFixed(4) + "° · " + (p.lagnaRashiSa || ""));
      set("liveMc", Number(b.madhyas[10]).toFixed(4) + "°");
      set("liveKendra", b.bhavas.filter(function (x) { return x.kendra; }).map(function (x) {
        return "भाव-" + x.no + "@" + Number(x.madhya).toFixed(2) + "°";
      }).join(" · "));
    }

    const grahasBox = document.getElementById("liveGrahas");
    const grahaSig = s.grahas.map(function (g) { return Number(g.longitude).toFixed(2); }).join("|");
    if (grahasBox && s.grahas.length && grahaSig !== lastGrahaSig) {
      lastGrahaSig = grahaSig;
      grahasBox.innerHTML = s.grahas.map(function (g) {
        return "<div class='metric'><span>" + (g.sa || g.key) + "</span><strong>" + Number(g.longitude).toFixed(2) + "°</strong></div>";
      }).join("");
    }
    const bhavaBody = document.getElementById("liveBhavasBody");
    const bhavaSig = b && b.bhavas ? b.bhavas.map(function (item) { return Number(item.madhya).toFixed(3); }).join("|") : "";
    if (bhavaBody && b && b.bhavas && bhavaSig !== lastBhavaSig) {
      lastBhavaSig = bhavaSig;
      bhavaBody.innerHTML = b.bhavas.map(function (item) {
        return "<tr><td>" + item.no + " · " + item.sa + "</td><td>" + item.karaka.sa + "</td><td>" + Number(item.madhya).toFixed(4) + "°</td><td>" + item.rashiSa + "</td><td>" + devGraha(item.lord) + "</td></tr>";
      }).join("");
    }

    const sun = s.grahas.find(function (g) { return g.key === "surya"; });
    const moon = s.grahas.find(function (g) { return g.key === "candra" || g.key === "chandra"; });
    if (sun) set("engSurya", Number(sun.longitude).toFixed(4) + "°");
    if (moon) set("engChandra", Number(moon.longitude).toFixed(4) + "°");
    if (M.computeNakshatraDetails && p.lagna != null) {
      const ln = M.computeNakshatraDetails(p.lagna);
      set("engLagnaNak", ln.number + ". " + ln.name + " · चरण " + ln.pada);
    }
    if (sun && M.computeVarga && (M.RASHI_SA || M.RASHIS)) set("engD9", (M.RASHI_SA || M.RASHIS)[M.computeVarga(sun.longitude, "D9")]);

    if (sun && moon && p.lagna != null && M.computeNatalId && M.computeNakshatraDetails) {
      try {
        const sunNak0 = M.computeNakshatraDetails(Number(sun.longitude)).index;
        const lagnaNak0 = M.computeNakshatraDetails(Number(p.lagna)).index;
        const moonNak0 = p.nakshatraIndex != null ? p.nakshatraIndex : M.computeNakshatraDetails(Number(moon.longitude)).index;
        const nid = M.computeNatalId(sunNak0, moonNak0, lagnaNak0);
        set("liveNatalId", "cell " + nid.cell + " / 19683 · " + nid.zone + " · अक्ष " + nid.activeAxes + "/9");
      } catch (e) {}
    }

    if (sun) set("hudSurya", Number(sun.longitude).toFixed(4) + "°");
    if (moon) set("hudChandra", Number(moon.longitude).toFixed(4) + "°");
    if (b) set("hudLagna", Number(b.lagna).toFixed(4) + "°");
    set("hudGhati", String(p.ghati) + " · " + String(p.vighati));
    return s;
  }

  function civilClock() {
    const ms = (Date.now() + TZ * 3600000) % 86400000;
    const utc = new Date(Date.now() + TZ * 3600000);
    return {
      date: utc.toISOString().slice(0, 10),
      time: utc.toISOString().slice(11, 19),
      ghati: Math.floor(ms / 1440000),
      vighati: Math.floor((ms % 1440000) / 24000),
      prana: Math.floor((ms % 24000) / 4000)
    };
  }

  function paintClock(p) {
    const c = civilClock();
    set("homeCivil", c.date + " · " + c.time + " IST");
    set("homeGhati", String(c.ghati) + " / ६०");
    set("homeVighati", String(c.vighati) + " / ६० · प्राण " + c.prana);
    const pranaOfDay = c.ghati * 360 + c.vighati * 6 + c.prana;
    const kalaArcmin = DUAL ? pranaOfDay * DUAL.nakshatra.kalaPerBreath : pranaOfDay;
    set("homePranaKala", String(pranaOfDay) + " / २१६०० ≡ " + Math.round(kalaArcmin) + "′ घूर्णन");
    const bar = document.getElementById("homeLiveBar");
    if (bar) {
      bar.textContent = c.time + " IST · घटी " + c.ghati + " · पल " + c.vighati + " · प्राण " + c.prana +
        (p && p.nakshatraName ? " · " + p.nakshatraName + " (शा)" : "") +
        (p && p.lagna != null ? " · लग्न " + Number(p.lagna).toFixed(2) + "°" : "") +
        " · उज्जयिनी " + LAT.toFixed(2) + "°N " + LON.toFixed(2) + "°E" +
        (DUAL ? " · श्वास " + DUAL.savana.breathS.toFixed(4) + "s(सा)/" + DUAL.nakshatra.breathS.toFixed(4) + "s(ना)" : "");
    }
  }

  function boot() {
    let lastP = null;
    let lastState = null;
    function pulse() {
      try {
        lastState = paint();
        lastP = lastState ? lastState.p : null;
        paintClock(lastP);
      } catch (e) { console.error(e); }
    }
    pulse();
    setInterval(pulse, 1000);
    setInterval(function () { paintClock(lastP); }, 250);

    function tickHands() {
      if (!document.hidden) {
        if (lastP) {
          try { drawPanchangDial(document.getElementById("homeDial"), lastP); } catch (e) {}
        }
        if (lastState) {
          try { drawOrrery(document.getElementById("homeOrrery"), lastState.grahas, lastState.bhava && lastState.bhava.lagna); } catch (e) {}
        }
      }
      requestAnimationFrame(tickHands);
    }
    requestAnimationFrame(tickHands);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { passive: true });
  else boot();
  root.LiveBoard = { paint: paint, nowState: nowState, ghatiHandFracs: ghatiHandFracs };
})(typeof globalThis !== "undefined" ? globalThis : this);

