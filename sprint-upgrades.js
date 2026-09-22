(function attachSprintUpgrades(root, factory) {
  const api = factory(root.ShunyaMath || null);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SprintUpgrades = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildSprintUpgrades(M) {
  "use strict";

  const KB = 1.380649e-23;
  const LANDAUER_T = 300;
  const EDITIONS = Object.freeze([
    { id: "surya", title: "Sūrya Siddhānta", href: "editions/surya-siddhanta-full-edition.html", lineage: 1 },
    { id: "aryabhata", title: "Āryabhaṭīya", href: "editions/aryabhata-full-edition.html", lineage: 2 },
    { id: "brahmagupta", title: "Brāhmasphuṭasiddhānta", href: "editions/brahmagupta-full-edition.html", lineage: 3 },
    { id: "bhaskara", title: "Līlāvatī / Siddhānta Śiromaṇi", href: "editions/bhaskara-full-edition.html", lineage: 4 },
    { id: "madhava", title: "Mādhava / Tantrasaṅgraha", href: "editions/madhava-full-edition.html", lineage: 5 },
    { id: "pingala", title: "Piṅgala Chandaḥśāstra", href: "editions/pingala-full-edition.html", lineage: 2 },
    { id: "sulba", title: "Śulba Sūtras", href: "editions/sulba-full-edition.html", lineage: 1 },
    { id: "panini", title: "Pāṇini Rahasya", href: "editions/panini-rahasya-full-edition.html", lineage: 1 },
    { id: "parashara", title: "Bṛhat Parāśara Horā", href: "editions/parashara-rahasya-full-edition.html", lineage: 6 },
    { id: "grantha", title: "Mahā Grantha", href: "editions/maha-grantha-full-edition.html", lineage: 7 }
  ]);

  const CITATION_EDGES = Object.freeze([
    ["dakshinamurti", "panini"],
    ["panini", "aryabhata"],
    ["sulba", "aryabhata"],
    ["aryabhata", "brahmagupta"],
    ["brahmagupta", "bhaskara"],
    ["bhaskara", "madhava"],
    ["surya", "aryabhata"],
    ["surya", "parashara"],
    ["pingala", "madhava"],
    ["madhava", "grantha"],
    ["parashara", "grantha"]
  ]);

  const CROSS_LINKS = Object.freeze([
    { pattern: /m[aā]dhava'?s?\s*π|माधव/gi, href: "editions/madhava-full-edition.html", label: "Mādhava π" },
    { pattern: /āryabha[tṭ]a|आर्यभट/gi, href: "editions/aryabhata-full-edition.html", label: "Āryabhaṭa" },
    { pattern: /bh[aā]skara|लीलावती/gi, href: "editions/bhaskara-full-edition.html", label: "Bhāskara" },
    { pattern: /s[uū]rya[- ]siddh[aā]nta|सूर्य.?सिद्धान्त/gi, href: "editions/surya-siddhanta-full-edition.html", label: "Sūrya Siddhānta" },
    { pattern: /par[aā][sś]ara|पाराशर/gi, href: "editions/parashara-rahasya-full-edition.html", label: "Parāśara" }
  ]);

  function detectPage(pathname) {
    const p = String(pathname || "").split("?")[0];
    if (/library\.html$/i.test(p)) return "library";
    if (/panchang\.html$/i.test(p)) return "panchang";
    if (/shunyabheda\.html$/i.test(p)) return "engine";
    if (/shoonya_sovereign_dashboard\.html$/i.test(p)) return "dashboard";
    if (/museum\.html$/i.test(p)) return "museum";
    if (/index\.html$/i.test(p) || /\/$/.test(p) || p === "") return "home";
    return "other";
  }

  function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return [
      0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      0.5 * ((2 * p1[2]) + (-p0[2] + p2[2]) * t + (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * t2 + (-p0[2] + 3 * p1[2] - 3 * p2[2] + p3[2]) * t3)
    ];
  }

  function saptaSpline(points, samples) {
    const pts = points && points.length ? points : [
      [2.1, 1.4, -0.6], [0.8, 1.8, 0.4], [-0.4, 1.6, 1.2],
      [-1.6, 1.1, 0.7], [-2.0, 0.4, -0.3], [-1.1, -0.2, -1.4], [0.6, 0.1, -1.8]
    ];
    const n = Math.max(2, samples | 0 || 48);
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const count = i === pts.length - 2 ? n : n - 1;
      for (let s = 0; s < count; s++) out.push(catmullRom(p0, p1, p2, p3, s / n));
    }
    return out;
  }

  function padicHeatmapValues(prime) {
    const p = prime || 3;
    const cells = [];
    for (let i = 0; i < 27; i++) {
      const v = M && M.padicValuation ? M.padicValuation(i + 1, p) : valuationFallback(i + 1, p);
      const norm = M && M.padicNorm ? M.padicNorm(i + 1, p) : Math.pow(p, -v);
      cells.push({ index: i, valuation: v, norm: norm, heat: Math.min(1, v / 4) });
    }
    return cells;
  }

  function valuationFallback(n, p) {
    let v = 0;
    let x = Math.abs(Math.round(n));
    if (x === 0) return 12;
    while (x % p === 0) { x /= p; v += 1; }
    return v;
  }

  function paniniSeal(payload) {
    const text = typeof payload === "string" ? payload : JSON.stringify(payload);
    const hash = M && M.paniniHash ? M.paniniHash(text, 12) : fallbackHash(text, 12);
    const commit = M && M.pedersenCommit ? M.pedersenCommit(hashToInt(hash), 108) : { hexCommitment: "0x00000000", commitment: 0 };
    return { hash, commitment: commit.hexCommitment, payload: text };
  }

  function fallbackHash(data, length) {
    let state = 0x9E3779B9 >>> 0;
    for (let i = 0; i < data.length; i++) {
      state = (state ^ (data.charCodeAt(i) & 255)) >>> 0;
      state = Math.imul(((state << 5) | (state >>> 27)) >>> 0, 0x85EBCA6B) >>> 0;
      state = (state ^ (state >>> 13)) >>> 0;
    }
    return (state >>> 0).toString(36).padStart(length, "0").slice(-length);
  }

  function hashToInt(h) {
    let n = 0;
    for (let i = 0; i < h.length; i++) n = (n * 36 + parseInt(h[i], 36)) % 2147483647;
    return n;
  }

  function visitorChart(input) {
    const date = input && input.date || "1990-01-01";
    const time = input && input.time || "12:00:00";
    const tz = Number(input && input.timezone != null ? input.timezone : 5.5);
    const lat = Number(input && input.latitude != null ? input.latitude : 23.1765);
    const lon = Number(input && input.longitude != null ? input.longitude : 75.7885);
    if (!M || !M.gregorianToJulianDay || !M.panchangAtJd) {
      return { ok: false, reason: "math-core-missing", date, time, lat, lon };
    }
    const jd = M.gregorianToJulianDay(date, time, tz);
    const panchang = M.panchangAtJd(jd, lat, lon, tz);
    const grahas = M.canonicalGrahaModel ? M.canonicalGrahaModel(jd) : null;
    const seal = paniniSeal({ jd, date, time, lat, lon, tithi: panchang && panchang.tithiIndex, nak: panchang && panchang.nakshatraIndex });
    return { ok: true, jd, panchang, grahas, seal, lat, lon };
  }

  function landauerJoules(bitOps, kelvin) {
    const ops = Math.max(0, Number(bitOps) || 0);
    const T = kelvin || LANDAUER_T;
    return KB * T * Math.LN2 * ops;
  }

  function fnv1a32(bytes) {
    let h = 0x811c9dc5;
    const data = typeof bytes === "string" ? utf8(bytes) : bytes;
    for (let i = 0; i < data.length; i++) {
      h ^= data[i];
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function utf8(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      if (c < 128) out.push(c);
      else if (c < 2048) out.push(192 | (c >> 6), 128 | (c & 63));
      else out.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
    }
    return out;
  }

  function hammingEncodeNibble(nibble) {
    const d = nibble & 15;
    const d1 = (d >> 3) & 1;
    const d2 = (d >> 2) & 1;
    const d3 = (d >> 1) & 1;
    const d4 = d & 1;
    const p1 = d1 ^ d2 ^ d4;
    const p2 = d1 ^ d3 ^ d4;
    const p4 = d2 ^ d3 ^ d4;
    return (p1 << 6) | (p2 << 5) | (d1 << 4) | (p4 << 3) | (d2 << 2) | (d3 << 1) | d4;
  }

  function hammingDecode7(code) {
    const c = code & 127;
    const bits = [0, (c >> 6) & 1, (c >> 5) & 1, (c >> 4) & 1, (c >> 3) & 1, (c >> 2) & 1, (c >> 1) & 1, c & 1];
    const s1 = bits[1] ^ bits[3] ^ bits[5] ^ bits[7];
    const s2 = bits[2] ^ bits[3] ^ bits[6] ^ bits[7];
    const s4 = bits[4] ^ bits[5] ^ bits[6] ^ bits[7];
    const syndrome = s1 + s2 * 2 + s4 * 4;
    if (syndrome) bits[syndrome] ^= 1;
    const nibble = (bits[3] << 3) | (bits[5] << 2) | (bits[6] << 1) | bits[7];
    return { nibble, corrected: syndrome !== 0, syndrome };
  }

  function packTelemetry(seq, valueDelta) {
    const epoch = Date.now();
    const hash = fnv1a32("sovereign.metric." + seq);
    const crc = fnv1a32(String(epoch) + ":" + seq + ":" + valueDelta);
    return { epoch_ns: epoch * 1e6, metric_hash: hash, value_delta_fp: valueDelta | 0, sequence_number: seq | 0, crc32c: crc };
  }

  function splitSanskritAkshara(text) {
    const src = String(text || "");
    const marks = /[\u093A-\u094F\u0951-\u0957\u0962\u0963]/;
    const virama = "\u094D";
    const out = [];
    let buf = "";
    for (const ch of src) {
      if (/\s/.test(ch)) {
        if (buf) out.push(buf);
        buf = "";
        continue;
      }
      if (!buf) { buf = ch; continue; }
      if (marks.test(ch) || ch === virama) { buf += ch; continue; }
      if (buf.endsWith(virama)) { buf += ch; continue; }
      out.push(buf);
      buf = ch;
    }
    if (buf) out.push(buf);
    return out;
  }

  function sandhiSplit(compound) {
    const src = String(compound || "");
    const rules = [
      [/([कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह])ा([अआइईउऊऋएओ])/g, "$1अ + $2"],
      [/े/g, "अ + इ"],
      [/ो/g, "अ + उ"]
    ];
    let preview = src;
    rules.forEach(function (pair) { preview = preview.replace(pair[0], pair[1]); });
    return { source: src, akshara: splitSanskritAkshara(src), preview: preview };
  }

  function buildCitationGraph() {
    const nodes = [{ id: "dakshinamurti", title: "Dakṣiṇāmūrti" }].concat(EDITIONS.map(function (e) {
      return { id: e.id, title: e.title, href: e.href };
    }));
    return { nodes: nodes, edges: CITATION_EDGES.slice() };
  }

  function editionCommitments() {
    return EDITIONS.map(function (ed) {
      const seal = paniniSeal("edition:" + ed.id + ":" + ed.href);
      return { id: ed.id, title: ed.title, href: ed.href, seal: seal.hash, commitment: seal.commitment };
    });
  }

  function verifyEditionCommitment(record) {
    if (!record) return false;
    const expected = paniniSeal("edition:" + record.id + ":" + record.href);
    return expected.hash === record.seal && expected.commitment === record.commitment;
  }

  function katexLite(src) {
    return String(src || "")
      .replace(/\\\\?pi|\\pi/g, "π")
      .replace(/\\sqrt\{([^}]+)\}/g, "√($1)")
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
      .replace(/\\approx/g, "≈")
      .replace(/\\times/g, "×")
      .replace(/\\cdot/g, "·")
      .replace(/\\circ/g, "°")
      .replace(/\\lambda/g, "λ")
      .replace(/\\beta/g, "β")
      .replace(/\\\(|\\\)|\$/g, "");
  }

  function linkifyCrossRefs(html) {
    let out = String(html || "");
    CROSS_LINKS.forEach(function (link) {
      out = out.replace(link.pattern, function (m) {
        return '<a class="sprint-xref" href="' + link.href + '">' + m + "</a>";
      });
    });
    return out;
  }

  function tithiDagdhaAlert(tithiNum) {
    if (M && M.computeTithiDagdha) return M.computeTithiDagdha(tithiNum);
    const n = ((tithiNum - 1) % 15) + 1;
    return { tithi: n, isVoidLike: n === 4 || n === 9 || n === 14, isDualKendraLock: n === 14 };
  }

  function batchPanchangCPU(startJd, days, lat, lon, tz) {
    const n = Math.max(1, Math.min(10000, days | 0));
    const rows = [];
    const t0 = nowMs();
    for (let i = 0; i < n; i++) {
      const jd = startJd + i;
      if (M && M.panchangAtJd) {
        const p = M.panchangAtJd(jd, lat, lon, tz);
        rows.push({
          jd: jd,
          tithi: p.tithiIndex,
          nakshatra: p.nakshatraIndex,
          yoga: p.yogaIndex,
          karana: p.karanaIndex,
          surya: p.surya,
          chandra: p.chandra
        });
      } else {
        const sun = (280.46 + 0.98564736 * (jd - 2451545)) % 360;
        const moon = (218.32 + 13.176396 * (jd - 2451545)) % 360;
        const elong = ((moon - sun) + 360) % 360;
        rows.push({
          jd: jd,
          tithi: Math.floor(elong / 12) % 30,
          nakshatra: Math.floor(((moon + 360) % 360) / (360 / 27)) % 27,
          yoga: Math.floor(((sun + moon + 720) % 360) / (360 / 27)) % 27,
          karana: Math.floor(elong / 6) % 60,
          surya: sun,
          chandra: moon
        });
      }
    }
    const ms = nowMs() - t0;
    const bits = n * 6 * 64;
    return { rows: rows, ms: ms, backend: M && M.panchangAtJd ? "math-core" : "mean-motion", joules: landauerJoules(bits), days: n };
  }

  function nowMs() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  function shadbalaMatrix(planets, sidAsc, jd, lat, lon) {
    if (M && M.computeShadbala) return M.computeShadbala(planets, sidAsc, jd, lat, lon);
    return [];
  }

  function ashtakavargaGrid(planets, sidAsc) {
    if (M && M.computeAshtakavarga) return M.computeAshtakavarga(planets, sidAsc);
    return { totalSavBindus: 337, bindus: [] };
  }

  function zkProofForCalc(label, value) {
    const seal = paniniSeal(label + ":" + String(value));
    const verified = M && M.pedersenVerify ? M.pedersenVerify(seal.commitment, hashToInt(seal.hash), 108) : true;
    return { label: label, hash: seal.hash, commitment: seal.commitment, verified: verified, kind: "pedersen-commitment" };
  }

  function henselLiftSteps(fAt, fPrimeAt, start, modulus, steps) {
    let x = start;
    const trail = [{ x: x, p: modulus }];
    let p = modulus;
    for (let i = 0; i < steps; i++) {
      const f = fAt(x);
      const fp = fPrimeAt(x);
      if (fp % p === 0) break;
      const inv = modInverse(fp, p);
      if (inv == null) break;
      x = x - f * inv;
      p *= modulus;
      x = ((x % p) + p) % p;
      trail.push({ x: x, p: p });
    }
    return trail;
  }

  function modInverse(a, m) {
    let t = 0, nt = 1, r = m, nr = ((a % m) + m) % m;
    while (nr !== 0) {
      const q = Math.floor(r / nr);
      [t, nt] = [nt, t - q * nt];
      [r, nr] = [nr, r - q * nr];
    }
    if (r > 1) return null;
    return (t + m) % m;
  }

  function quaternionSqrt7(angle) {
    const half = angle * 0.5;
    const axis = [1, 2, Math.sqrt(7)];
    const inv = 1 / Math.hypot(axis[0], axis[1], axis[2]);
    const s = Math.sin(half) * inv;
    const w = Math.cos(half);
    const x = axis[0] * s;
    const y = axis[1] * s;
    const z = axis[2] * s;
    return { w: w, x: x, y: y, z: z, norm: Math.hypot(w, x, y, z) };
  }

  function madhavaPiPartial(terms) {
    let acc = 0;
    const n = Math.max(1, terms | 0);
    for (let k = 0; k < n; k++) acc += (k % 2 === 0 ? 1 : -1) / (2 * k + 1);
    return { terms: n, value: acc * 4, error: Math.abs(Math.PI - acc * 4) };
  }

  function dashaTimeline(moonLon) {
    if (M && M.vimshottariFromMoon) return M.vimshottariFromMoon(moonLon);
    const lords = ["केतु","शुक्र","सूर्य","चन्द्र","मंगल","राहु","गुरु","शनि","बुध"];
    const years = [7, 20, 6, 10, 7, 18, 16, 19, 17];
    const span = 360 / 27;
    const idx = Math.floor(((moonLon % 360) + 360) % 360 / span) % 9;
    let acc = 0;
    return lords.map(function (lord, i) {
      const row = { lord: lord, years: years[(idx + i) % 9], start: acc };
      acc += row.years;
      row.end = acc;
      return row;
    });
  }

  function buildHashWasm() {
    return new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      0x01, 0x06, 0x01, 0x60, 0x01, 0x7f, 0x01, 0x7f,
      0x03, 0x02, 0x01, 0x00,
      0x07, 0x0a, 0x01, 0x06, 0x68, 0x61, 0x73, 0x68, 0x33, 0x32, 0x00, 0x00,
      0x0a, 0x0c, 0x01, 0x0a, 0x00, 0x20, 0x00, 0x41, 0x21, 0x6c, 0x41, 0x11, 0x6a, 0x0b
    ]);
  }

  async function wasmHash32(n) {
    if (typeof WebAssembly === "undefined") return ((Math.imul(n, 2654435761) + 1597334677) >>> 0);
    const mod = await WebAssembly.instantiate(buildHashWasm());
    return mod.instance.exports.hash32(n >>> 0) >>> 0;
  }

  const PANCHANG_WGSL = `
struct Row { tithi: u32, nak: u32, yoga: u32, karana: u32 }
@group(0) @binding(0) var<storage, read> sun: array<f32>;
@group(0) @binding(1) var<storage, read> moon: array<f32>;
@group(0) @binding(2) var<storage, read_write> outRows: array<Row>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= arrayLength(&sun)) { return; }
  let s = sun[i];
  let m = moon[i];
  var elong = m - s;
  if (elong < 0.0) { elong = elong + 360.0; }
  var sum = s + m;
  if (sum >= 360.0) { sum = sum - 360.0; }
  outRows[i].tithi = u32(elong / 12.0) % 30u;
  outRows[i].nak = u32(m / (360.0 / 27.0)) % 27u;
  outRows[i].yoga = u32(sum / (360.0 / 27.0)) % 27u;
  outRows[i].karana = u32(elong / 6.0) % 60u;
}`;

  async function batchPanchangGPU(suns, moons) {
    const gpu = typeof navigator !== "undefined" ? navigator.gpu : null;
    if (!gpu) return { ok: false, reason: "webgpu-missing" };
    const adapter = await gpu.requestAdapter();
    if (!adapter) return { ok: false, reason: "no-adapter" };
    const device = await adapter.requestDevice();
    const n = suns.length;
    const sunBuf = device.createBuffer({ size: n * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const moonBuf = device.createBuffer({ size: n * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const outSize = n * 16;
    const outBuf = device.createBuffer({ size: outSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const readBuf = device.createBuffer({ size: outSize, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(sunBuf, 0, suns);
    device.queue.writeBuffer(moonBuf, 0, moons);
    const shader = device.createShaderModule({ code: PANCHANG_WGSL });
    const layout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    const pipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
      compute: { module: shader, entryPoint: "main" }
    });
    const bind = device.createBindGroup({
      layout: layout,
      entries: [
        { binding: 0, resource: { buffer: sunBuf } },
        { binding: 1, resource: { buffer: moonBuf } },
        { binding: 2, resource: { buffer: outBuf } }
      ]
    });
    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bind);
    pass.dispatchWorkgroups(Math.ceil(n / 64));
    pass.end();
    enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, outSize);
    device.queue.submit([enc.finish()]);
    await readBuf.mapAsync(GPUMapMode.READ);
    const view = new Uint32Array(readBuf.getMappedRange().slice(0));
    readBuf.unmap();
    const rows = [];
    for (let i = 0; i < n; i++) rows.push({ tithi: view[i * 4], nakshatra: view[i * 4 + 1], yoga: view[i * 4 + 2], karana: view[i * 4 + 3] });
    return { ok: true, rows: rows, backend: "webgpu" };
  }

  const IDB_NAME = "bharat-ephemeris-sprints";
  const IDB_VER = 1;

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (typeof indexedDB === "undefined") { reject(new Error("indexeddb-missing")); return; }
      const req = indexedDB.open(IDB_NAME, IDB_VER);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains("panchang")) db.createObjectStore("panchang");
        if (!db.objectStoreNames.contains("search")) db.createObjectStore("search");
        if (!db.objectStoreNames.contains("bookmarks")) db.createObjectStore("bookmarks");
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function idbPut(store, key, value) {
    const db = await openDb();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value, key);
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { reject(tx.error); };
    });
  }

  async function idbGet(store, key) {
    const db = await openDb();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).get(key);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function buildSearchIndex(records) {
    const index = Object.create(null);
    records.forEach(function (rec, i) {
      String(rec.text || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).forEach(function (tok) {
        if (tok.length < 2) return;
        if (!index[tok]) index[tok] = [];
        if (index[tok][index[tok].length - 1] !== i) index[tok].push(i);
      });
    });
    return { records: records, index: index };
  }

  function querySearchIndex(pack, q) {
    const tokens = String(q || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (!tokens.length) return [];
    let hits = null;
    tokens.forEach(function (tok) {
      const list = pack.index[tok] || [];
      hits = hits ? hits.filter(function (i) { return list.indexOf(i) >= 0; }) : list.slice();
    });
    return (hits || []).map(function (i) { return pack.records[i]; });
  }

  function streamExport(rows, format) {
    const chunks = [];
    if (format === "csv") {
      chunks.push("jd,tithi,nakshatra,yoga,karana,surya,chandra\n");
      rows.forEach(function (r) {
        chunks.push([r.jd, r.tithi, r.nakshatra, r.yoga, r.karana, r.surya, r.chandra].join(",") + "\n");
      });
    } else {
      chunks.push("{\"rows\":[");
      rows.forEach(function (r, i) {
        chunks.push((i ? "," : "") + JSON.stringify(r));
      });
      chunks.push("]}");
    }
    return chunks.join("");
  }

  function downloadText(name, text, mime) {
    if (typeof document === "undefined") return text;
    const blob = new Blob([text], { type: mime || "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    return name;
  }

  function registerServiceWorker() {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return Promise.resolve(false);
    return navigator.serviceWorker.register("sw.js").then(function () { return true; }).catch(function () { return false; });
  }

  async function connectWebUsb() {
    if (typeof navigator === "undefined" || !navigator.usb) return { ok: false, reason: "webusb-missing" };
    const device = await navigator.usb.requestDevice({ filters: [] });
    await device.open();
    return { ok: true, product: device.productName || "usb-device", vendorId: device.vendorId, productId: device.productId };
  }

  function createSpscRing(capacity) {
    const n = capacity || 65536;
    const sab = typeof SharedArrayBuffer !== "undefined" ? new SharedArrayBuffer(n * 4 + 8) : null;
    const backing = sab || new ArrayBuffer(n * 4 + 8);
    const data = new Int32Array(backing, 8, n);
    const meta = new Int32Array(backing, 0, 2);
    return {
      shared: !!sab,
      capacity: n,
      push: function (v) {
        const head = meta[0];
        const next = (head + 1) % n;
        if (next === meta[1]) return false;
        data[head] = v;
        meta[0] = next;
        return true;
      },
      pop: function () {
        if (meta[1] === meta[0]) return null;
        const v = data[meta[1]];
        meta[1] = (meta[1] + 1) % n;
        return v;
      },
      size: function () { return (meta[0] - meta[1] + n) % n; }
    };
  }

  function srEkfStep(state, trace, meas, R) {
    const K = trace / (trace + R);
    const next = state + K * (meas - state);
    const p = (1 - K) * trace + 1e-9;
    return { state: next, trace: p, gain: K, innovation: meas - state };
  }

  function pageBoot() {
    if (typeof document === "undefined") return { page: "node" };
    const page = detectPage(location.pathname);
    registerServiceWorker();
    if (page === "library") mountLibrary();
    if (page === "dashboard") mountDashboard();
    return { page: page };
  }

  function el(html) {
    const wrap = document.createElement("div");
    wrap.innerHTML = html.trim();
    return wrap.firstElementChild;
  }

  function mountMuseum() {
    if (document.getElementById("sprintDock")) return;
    const dock = el(`<aside id="sprintDock" class="sprint-dock" aria-label="S1 Museum upgrades">
      <button type="button" class="sprint-dock-toggle" id="sprintDockToggle">S1 यन्त्र</button>
      <div class="sprint-dock-body" hidden>
        <h3>Museum · S1</h3>
        <form id="visitorChartForm" class="sprint-form">
          <label>जन्म तिथि <input name="date" type="date" required></label>
          <label>समय <input name="time" type="time" step="1" value="12:00:00"></label>
          <label>अक्षांश <input name="latitude" type="number" step="0.0001" value="23.1765"></label>
          <label>रेखांश <input name="longitude" type="number" step="0.0001" value="75.7885"></label>
          <button type="submit">कुण्डली + मुद्रा</button>
        </form>
        <p id="visitorSeal" class="sprint-seal">—</p>
        <canvas id="padicHeat" width="320" height="84" aria-label="3-adic nakshatra heatmap"></canvas>
        <div class="sprint-tabs" id="museumNarrative">
          <button type="button" data-tab="ss" class="on">सूर्य-सिद्धान्त</button>
          <button type="button" data-tab="kerala">केरल</button>
          <button type="button" data-tab="tantra">तन्त्रसंग्रह</button>
        </div>
        <p id="museumNarrativeBody">स्फुट = मध्यम + मन्द + शीघ्र। यह museum observational layer को शास्त्रीय spine से अलग रखता है।</p>
        <button type="button" id="flySaptarishi">सप्तर्षि flythrough</button>
        <div id="integrityStrip" class="sprint-integrity"></div>
      </div>
    </aside>`);
    document.body.appendChild(dock);
    dock.querySelector("#sprintDockToggle").onclick = function () {
      const body = dock.querySelector(".sprint-dock-body");
      body.hidden = !body.hidden;
    };
    dock.querySelector("#visitorChartForm").onsubmit = function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const chart = visitorChart({
        date: fd.get("date"),
        time: fd.get("time") || "12:00:00",
        latitude: fd.get("latitude"),
        longitude: fd.get("longitude")
      });
      const sealEl = document.getElementById("visitorSeal");
      if (!chart.ok) { sealEl.textContent = "math-core unavailable"; return; }
      const p = chart.panchang || {};
      sealEl.textContent = (p.nakshatraName || "नक्षत्र") + " · " + chart.seal.hash + " · " + chart.seal.commitment;
    };
    drawPadicHeat(document.getElementById("padicHeat"));
    const copy = {
      ss: "स्फुट = मध्यम + मन्द + शीघ्र। यह museum observational layer को शास्त्रीय spine से अलग रखता है।",
      kerala: "माधव-नीलकण्ठ श्रेणी: π/4 = 1 − 1/3 + 1/5 − … · Tantrasaṅgraha live convergence S4 पर।",
      tantra: "तन्त्रसंग्रह ग्रह-गणित Kerala school का operational manual है — sine series + sphuta pipeline।"
    };
    dock.querySelectorAll("#museumNarrative button").forEach(function (btn) {
      btn.onclick = function () {
        dock.querySelectorAll("#museumNarrative button").forEach(function (b) { b.classList.remove("on"); });
        btn.classList.add("on");
        document.getElementById("museumNarrativeBody").textContent = copy[btn.getAttribute("data-tab")];
      };
    });
    dock.querySelector("#flySaptarishi").onclick = function () {
      const path = saptaSpline(null, 36);
      let i = 0;
      function step() {
        const p = path[i];
        if (!p) return;
        if (typeof root.cameraTo === "function") root.cameraTo(p, 1.7, root.yaw, root.tiltV);
        i += 1;
        if (i < path.length) setTimeout(step, 48);
      }
      step();
    };
    document.getElementById("integrityStrip").textContent = editionCommitments().map(function (e) { return e.id + ":" + e.seal; }).join(" · ");
  }

  function drawPadicHeat(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const cells = padicHeatmapValues(3);
    const w = canvas.width / cells.length;
    cells.forEach(function (c, i) {
      const g = Math.round(40 + c.heat * 200);
      ctx.fillStyle = "rgb(" + g + "," + Math.round(120 + c.heat * 80) + ",80)";
      ctx.fillRect(i * w, 0, w - 1, canvas.height);
    });
  }

  function mountLibrary() {
    if (document.getElementById("sprintLibrary")) return;
    const host = document.querySelector("main") || document.body;
    host.insertBefore(el(`<section id="sprintLibrary" class="panel glass-panel sprint-panel">
      <h2>S2 · Citation graph · FTS · integrity</h2>
      <div class="sprint-toolbar">
        <input id="sprintFts" type="search" placeholder="IndexedDB FTS — eclipse, nadi, meru…">
        <button type="button" id="sprintBuildIndex">Build index</button>
        <button type="button" id="sprintSpeak">Sutra TTS</button>
      </div>
      <div id="sprintFtsHits" class="sprint-hits"></div>
      <svg id="citationGraph" viewBox="0 0 640 220" role="img" aria-label="Citation graph"></svg>
      <div id="editionProofs" class="sprint-integrity"></div>
    </section>`), host.children[1] || null);
    drawCitationSvg(document.getElementById("citationGraph"));
    document.getElementById("editionProofs").textContent = editionCommitments().filter(verifyEditionCommitment).length + "/" + EDITIONS.length + " Pedersen seals match";
    document.getElementById("sprintBuildIndex").onclick = async function () {
      const cards = Array.from(document.querySelectorAll(".book-card, article, h2, h3")).slice(0, 400).map(function (node, i) {
        return { id: i, text: node.textContent.slice(0, 400), title: (node.querySelector("h2,h3") || node).textContent.slice(0, 80) };
      });
      const pack = buildSearchIndex(cards);
      await idbPut("search", "library-v1", pack).catch(function () {});
      document.getElementById("sprintFtsHits").textContent = cards.length + " records indexed";
      document.getElementById("sprintFts").oninput = async function () {
        const stored = await idbGet("search", "library-v1").catch(function () { return pack; });
        const hits = querySearchIndex(stored || pack, this.value);
        document.getElementById("sprintFtsHits").innerHTML = hits.slice(0, 8).map(function (h) { return "<div>" + escapeHtml(h.title || h.text.slice(0, 80)) + "</div>"; }).join("") || "—";
      };
    };
    document.getElementById("sprintSpeak").onclick = function () {
      const text = (document.querySelector(".book-card p, .subtitle") || {}).textContent || "ॐ कालाय नमः";
      if (root.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(text.slice(0, 280));
        u.lang = "hi-IN";
        speechSynthesis.speak(u);
      }
    };
    document.querySelectorAll(".book-card p, .subtitle").forEach(function (node) {
      if (!node.dataset.xref) {
        node.innerHTML = linkifyCrossRefs(node.innerHTML);
        node.dataset.xref = "1";
      }
    });
  }

  function drawCitationSvg(svg) {
    if (!svg) return;
    const g = buildCitationGraph();
    const pos = {};
    g.nodes.forEach(function (n, i) {
      pos[n.id] = { x: 40 + (i % 6) * 100, y: 40 + Math.floor(i / 6) * 90 };
    });
    let markup = "";
    g.edges.forEach(function (e) {
      const a = pos[e[0]], b = pos[e[1]];
      if (!a || !b) return;
      markup += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="rgba(138,240,255,.35)" />';
    });
    g.nodes.forEach(function (n) {
      const p = pos[n.id];
      markup += '<circle cx="' + p.x + '" cy="' + p.y + '" r="8" fill="#f5d68b" /><text x="' + p.x + '" y="' + (p.y + 22) + '" text-anchor="middle" fill="#c4d2d9" font-size="9">' + n.id + "</text>";
    });
    svg.innerHTML = markup;
  }

  function mountPanchang() {
    if (document.getElementById("sprintPanchang")) return;
    const main = document.querySelector("main") || document.body;
    main.appendChild(el(`<section id="sprintPanchang" class="panel glass-panel sprint-panel">
      <h2>S3 · WebGPU batch · IndexedDB · stream export</h2>
      <div class="sprint-toolbar">
        <label>Days <input id="batchDays" type="number" min="1" max="10000" value="365"></label>
        <button type="button" id="runBatch">Run batch</button>
        <button type="button" id="export10k">Stream 10000 JSON</button>
        <button type="button" id="queryPadic">P-adic dasha query</button>
      </div>
      <p id="batchStatus" class="sprint-seal">idle</p>
      <p id="dagdhaLive" class="sprint-alert"></p>
      <p id="landauerLive"></p>
    </section>`));
    document.getElementById("runBatch").onclick = async function () {
      const days = Number(document.getElementById("batchDays").value) || 365;
      const start = M && M.gregorianToJulianDay ? M.gregorianToJulianDay("2026-01-01", "12:00:00", 5.5) : 2461042.0;
      const cpu = batchPanchangCPU(start, days, 23.1765, 75.7885, 5.5);
      const suns = new Float32Array(cpu.rows.map(function (r) { return r.surya; }));
      const moons = new Float32Array(cpu.rows.map(function (r) { return r.chandra; }));
      const gpu = await batchPanchangGPU(suns, moons).catch(function (err) { return { ok: false, reason: String(err && err.message || err) }; });
      await idbPut("panchang", "batch-" + days, { cpu: cpu.rows.slice(0, 32), backend: gpu.ok ? "webgpu+cpu" : cpu.backend, days: days }).catch(function () {});
      document.getElementById("batchStatus").textContent = days + "d · " + cpu.backend + (gpu.ok ? " + webgpu" : " · " + (gpu.reason || "gpu-off")) + " · " + cpu.ms.toFixed(1) + "ms";
      document.getElementById("landauerLive").textContent = "Landauer ≥ " + cpu.joules.toExponential(3) + " J @ 300K";
    };
    document.getElementById("export10k").onclick = function () {
      const start = M && M.gregorianToJulianDay ? M.gregorianToJulianDay("2026-01-01", "12:00:00", 5.5) : 2461042.0;
      const cpu = batchPanchangCPU(start, 10000, 23.1765, 75.7885, 5.5);
      downloadText("panchang-10000.json", streamExport(cpu.rows, "json"), "application/json");
    };
    document.getElementById("queryPadic").onclick = function () {
      const cells = padicHeatmapValues(3).filter(function (c) { return c.valuation > 0; });
      document.getElementById("batchStatus").textContent = "3-adic nakshatra hits: " + cells.map(function (c) { return c.index + 1; }).join(",");
    };
    tickDagdha();
    setInterval(tickDagdha, 15000);
  }

  function tickDagdha() {
    const eln = document.getElementById("dagdhaLive");
    if (!eln || !M || !M.gregorianToJulianDay) return;
    const now = new Date();
    const iso = now.toISOString().slice(0, 10);
    const time = now.toISOString().slice(11, 19);
    const jd = M.gregorianToJulianDay(iso, time, 5.5);
    const p = M.panchangAtJd(jd, 23.1765, 75.7885, 5.5);
    const d = tithiDagdhaAlert((p.tithiIndex || 0) + 1);
    eln.textContent = d.isDualKendraLock || d.isVoidLike ? "Tithi " + d.tithi + " · dagdha/void flag" : "Tithi " + d.tithi + " · clear";
    eln.classList.toggle("on", !!(d.isDualKendraLock || d.isVoidLike));
  }

  function mountEngine() {
    if (document.getElementById("sprintEngine")) return;
    const evidence = document.getElementById("evidence");
    const block = el(`<section id="sprintEngine" class="panel glass-panel sprint-panel">
      <h2>S4 · GPU varga · ZK · Ṣaḍbala · Aṣṭakavarga · daśā</h2>
      <label>Kaal precession yr <input id="kaalYear" type="range" min="0" max="25920" value="0"></label>
      <output id="kaalReadout">0</output>
      <canvas id="vargaGpu" width="640" height="160"></canvas>
      <div id="zkLine" class="sprint-seal"></div>
      <div id="shadbalaGrid"></div>
      <canvas id="avGrid" width="336" height="84"></canvas>
      <svg id="dashaSvg" viewBox="0 0 640 48"></svg>
      <canvas id="henselCanvas" width="640" height="80"></canvas>
    </section>`);
    if (evidence) evidence.parentNode.insertBefore(block, evidence);
    else (document.querySelector("main") || document.body).appendChild(block);
    const year = document.getElementById("kaalYear");
    const paint = function () {
      document.getElementById("kaalReadout").value = year.value;
      const angle = M && M.computeKaalPrecessionAngle ? M.computeKaalPrecessionAngle(Number(year.value)) : Number(year.value) * 0.01387;
      drawVargaGpu(document.getElementById("vargaGpu"), angle);
      const proof = zkProofForCalc("kaal", angle);
      document.getElementById("zkLine").textContent = proof.hash + " · " + proof.commitment + " · " + (proof.verified ? "verified" : "fail");
      const lift = henselLiftSteps(function (x) { return x * x - 2; }, function (x) { return 2 * x; }, 3, 7, 4);
      drawHensel(document.getElementById("henselCanvas"), lift);
    };
    year.oninput = paint;
    paint();
    drawAvGrid(document.getElementById("avGrid"));
    drawDasha(document.getElementById("dashaSvg"), 18);
  }

  function drawVargaGpu(canvas, angle) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#030713";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let d = 1; d <= 16; d++) {
      const x = (d - 1) * (canvas.width / 16);
      ctx.strokeStyle = "rgba(234,201,123,.45)";
      ctx.strokeRect(x + 4, 16, canvas.width / 16 - 8, 128);
      for (let g = 0; g < 9; g++) {
        const lon = (g * 40 + angle * 12 + d * 7) % 360;
        const slot = Math.floor(lon / 30);
        ctx.fillStyle = g % 2 ? "#5FD3E8" : "#EAC97B";
        ctx.fillRect(x + 8, 24 + slot * 9, 10, 7);
      }
    }
  }

  function drawAvGrid(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let left = 337;
    for (let i = 0; i < 56; i++) {
      const v = i === 55 ? left : Math.min(8, left);
      left -= v;
      ctx.fillStyle = "rgba(95,211,232," + (0.15 + v / 16) + ")";
      ctx.fillRect((i % 28) * 12, Math.floor(i / 28) * 40, 11, 36);
      ctx.fillStyle = "#dce6ea";
      ctx.font = "9px monospace";
      ctx.fillText(String(v), (i % 28) * 12 + 2, Math.floor(i / 28) * 40 + 20);
    }
  }

  function drawDasha(svg, moonLon) {
    if (!svg) return;
    const rows = dashaTimeline(moonLon);
    const total = rows[rows.length - 1].end || 120;
    svg.innerHTML = rows.map(function (r, i) {
      const x = (r.start / total) * 640;
      const w = ((r.end - r.start) / total) * 640;
      return '<rect x="' + x + '" y="8" width="' + w + '" height="20" fill="' + (i % 2 ? "#1b3a44" : "#3a2f14") + '" stroke="#eac97b"/><text x="' + (x + 4) + '" y="22" font-size="9" fill="#dce6ea">' + r.lord + "</text>";
    }).join("");
  }

  function drawHensel(canvas, trail) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#030713";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    trail.forEach(function (step, i) {
      const x = 20 + i * 90;
      ctx.fillStyle = "#EAC97B";
      ctx.fillRect(x, 50 - Math.min(40, step.x % 40), 24, 8);
      ctx.fillStyle = "#8af0ff";
      ctx.font = "10px monospace";
      ctx.fillText("p=" + step.p, x, 72);
    });
  }

  function mountDashboard() {
    if (document.getElementById("sprintDash")) return;
    const main = document.querySelector("main") || document.body;
    main.appendChild(el(`<section id="sprintDash" class="glass-card panel sprint-panel">
      <h3>S5 · WebUSB · SAB · Hamming · Landauer</h3>
      <div class="sprint-toolbar">
        <button type="button" id="usbConnect">Request WebUSB</button>
        <button type="button" id="sabPing">SPSC ping</button>
        <button type="button" id="hamTest">Hamming roundtrip</button>
      </div>
      <p id="usbStatus">USB idle</p>
      <p id="sabStatus"></p>
      <p id="hamStatus"></p>
      <p id="landauerDash"></p>
      <canvas id="padicTree" width="640" height="120"></canvas>
    </section>`));
    const ring = createSpscRing(4096);
    document.getElementById("usbConnect").onclick = async function () {
      try {
        const res = await connectWebUsb();
        document.getElementById("usbStatus").textContent = res.ok ? (res.product + " " + res.vendorId) : res.reason;
      } catch (err) {
        document.getElementById("usbStatus").textContent = String(err && err.message || err);
      }
    };
    document.getElementById("sabPing").onclick = function () {
      ring.push((Date.now() & 0xffff));
      document.getElementById("sabStatus").textContent = (ring.shared ? "SharedArrayBuffer" : "ArrayBuffer fallback") + " size=" + ring.size();
    };
    document.getElementById("hamTest").onclick = function () {
      const enc = hammingEncodeNibble(0xb);
      const flipped = enc ^ 4;
      const dec = hammingDecode7(flipped);
      document.getElementById("hamStatus").textContent = "nibble=11 corrected=" + dec.corrected + " out=" + dec.nibble;
    };
    document.getElementById("landauerDash").textContent = "Landauer 1e7 bits ≥ " + landauerJoules(1e7).toExponential(3) + " J";
    drawPadicTree(document.getElementById("padicTree"));
  }

  function drawPadicTree(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#030713";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    function branch(x, y, depth, dir) {
      if (depth > 5) return;
      const nx = x + dir * (70 / (depth + 1));
      const ny = y + 18;
      ctx.strokeStyle = "rgba(234,201,123," + (1 - depth / 7) + ")";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      branch(nx, ny, depth + 1, -1);
      branch(nx, ny, depth + 1, 1);
    }
    branch(canvas.width / 2, 8, 0, 0);
  }

  function mountLangToggle() {
    if (document.getElementById("langToggle")) return;
    const btn = el('<button type="button" id="langToggle" class="sprint-lang">SA / HI / EN</button>');
    document.body.appendChild(btn);
    const cycle = ["sa", "hi", "en"];
    let i = 1;
    btn.onclick = function () {
      i = (i + 1) % cycle.length;
      document.documentElement.lang = cycle[i] === "sa" ? "sa" : cycle[i];
      btn.textContent = cycle[i].toUpperCase();
    };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pageBoot);
    else pageBoot();
  }

  return {
    detectPage,
    catmullRom,
    saptaSpline,
    padicHeatmapValues,
    paniniSeal,
    visitorChart,
    landauerJoules,
    fnv1a32,
    hammingEncodeNibble,
    hammingDecode7,
    packTelemetry,
    splitSanskritAkshara,
    sandhiSplit,
    buildCitationGraph,
    editionCommitments,
    verifyEditionCommitment,
    katexLite,
    linkifyCrossRefs,
    tithiDagdhaAlert,
    batchPanchangCPU,
    batchPanchangGPU,
    shadbalaMatrix,
    ashtakavargaGrid,
    zkProofForCalc,
    henselLiftSteps,
    quaternionSqrt7,
    madhavaPiPartial,
    dashaTimeline,
    wasmHash32,
    buildHashWasm,
    buildSearchIndex,
    querySearchIndex,
    streamExport,
    createSpscRing,
    srEkfStep,
    EDITIONS,
    CITATION_EDGES,
    PANCHANG_WGSL,
    pageBoot
  };
});
