(function (root) {
  "use strict";

  const VS = `#version 300 es
precision highp float;
in float a_id;
uniform float u_time;
uniform vec2 u_res;
uniform float u_dpr;
uniform int u_mode;
uniform float u_l0;
uniform float u_l1;
uniform float u_ghati;
uniform float u_vighati;
uniform float u_tithi;
uniform float u_nak;
uniform float u_masa;
out vec4 v_col;

void main() {
  float id = a_id;
  float t = u_time;
  float x = 0.0;
  float y = 0.0;
  float gold = 0.35;
  float aspect = max(u_res.y, 1.0) / max(u_res.x, 1.0);
  float dpr = max(1.0, u_dpr);

  if (u_mode == 3) {
    float ring = mod(id, 5.0);
    float u = floor(id / 5.0);
    float count = 60.0;
    float hot = u_ghati;
    float rad = 0.42;
    if (ring < 0.5) { count = 12.0; hot = u_masa; rad = 0.90; }
    else if (ring < 1.5) { count = 30.0; hot = u_tithi; rad = 0.76; }
    else if (ring < 2.5) { count = 27.0; hot = u_nak; rad = 0.62; }
    else if (ring < 3.5) { count = 60.0; hot = u_ghati; rad = 0.48; }
    else { count = 60.0; hot = u_vighati; rad = 0.36; }
    float flow = t * (0.55 + ring * 0.18);
    float slot = mod(u + flow * 6.0, count);
    float ang = (slot / count) * 6.2831853 - 1.5707963;
    float near = abs(mod(slot - hot + count * 0.5, count) - count * 0.5);
    gold = exp(-near * near * 0.22);
    x = cos(ang) * rad;
    y = sin(ang) * rad;
    gl_PointSize = mix(2.4, 6.0, gold) * dpr;
    vec4 dimC = vec4(0.12, 0.55, 0.62, 0.55);
    vec4 hotC = vec4(1.0, 0.84, 0.28, 1.0);
    v_col = mix(dimC, hotC, gold);
    gl_Position = vec4(x, y * aspect, 0.0, 1.0);
    return;
  }

  if (u_mode == 2) {
    float ring = mod(id, 9.0);
    float u = floor(id / 9.0);
    float au = 0.18 + ring * 0.085;
    float lam = u_l0 * 0.0174533;
    if (ring > 0.5 && ring < 1.5) lam = u_l1 * 0.0174533;
    float a = lam + u * 0.11;
    x = au * cos(a);
    y = au * sin(a) * 0.75;
    gold = ring / 8.0;
  } else {
    float u = id / 4500.0;
    float ang = u * 6.2831853 * 9.0 + t * 0.12;
    float rad = 0.18 + 0.72 * u;
    x = rad * cos(ang);
    y = rad * sin(ang) * 0.62;
    gold = clamp(u, 0.0, 1.0);
  }

  gl_Position = vec4(x, y * aspect, 0.0, 1.0);
  gl_PointSize = mix(2.2, 4.4, gold) * dpr;
  v_col = mix(vec4(0.0, 0.95, 0.99, 0.9), vec4(1.0, 0.84, 0.18, 1.0), gold);
}`;

  const FS = `#version 300 es
precision highp float;
in vec4 v_col;
out vec4 o;
void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  float d = length(p);
  float g = max(0.0, 1.0 - d * 2.0);
  g = pow(g, 1.45);
  o = vec4(v_col.rgb, v_col.a * g);
}`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error("FieldGL shader error", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  let cache = { t: 0, mathT: 0, lambda: new Float32Array(9), ghati: 0, vighati: 0, tithi: 0, nak: 0, masa: 0 };

  function refreshMath() {
    const M = root.ShunyaMath;
    if (!M || !M.gregorianToJulianDay) return;
    try {
      const now = Date.now();
      const utc = new Date(now + 5.5 * 3600000);
      const jd = M.gregorianToJulianDay(utc.toISOString().slice(0, 10), utc.toISOString().slice(11, 19), 5.5);
      const p = M.panchangExtended ? M.panchangExtended(jd, 23.1765, 75.7885, 5.5) : {};
      const g = M.canonicalGrahaModel ? M.canonicalGrahaModel(jd) : [];
      g.slice(0, 9).forEach(function (row, i) {
        cache.lambda[i] = Number(row.longitude || row.sphuta || 0);
      });
      if (p.tithiIndex != null) cache.tithi = Number(p.tithiIndex);
      if (p.nakshatraIndex != null) cache.nak = Number(p.nakshatraIndex);
      if (p.sauraMasaIndex != null) cache.masa = Number(p.sauraMasaIndex);
    } catch (e) {}
  }

  function liveState() {
    const now = Date.now();
    if (now - cache.t < 80) return cache;
    cache.t = now;
    const ms = (now + 5.5 * 3600000) % 86400000;
    cache.ghati = Math.floor(ms / 1440000);
    cache.vighati = (ms % 1440000) / 24000;
    if (now - cache.mathT > 1000) {
      cache.mathT = now;
      refreshMath();
    }
    return cache;
  }

  function push(partial) {
    if (!partial) return cache;
    if (partial.ghati != null) cache.ghati = Number(partial.ghati);
    if (partial.vighati != null) cache.vighati = Number(partial.vighati);
    if (partial.tithi != null) cache.tithi = Number(partial.tithi);
    if (partial.nak != null) cache.nak = Number(partial.nak);
    if (partial.masa != null) cache.masa = Number(partial.masa);
    if (partial.lambda && partial.lambda.length) {
      for (let i = 0; i < 9 && i < partial.lambda.length; i++) cache.lambda[i] = Number(partial.lambda[i] || 0);
    }
    return cache;
  }

  function mount(canvas, mode) {
    if (!canvas || canvas.__fieldMounted) return canvas.__fieldMounted || null;
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "high-performance" });
    if (!gl) {
      canvas.setAttribute("data-field-fail", "no-webgl2");
      return null;
    }

    const N = mode === 3 ? 3600 : 4500;
    let prog = null, vao = null, buf = null;
    let uTime = null, uRes = null, uDpr = null, uMode = null, uL0 = null, uL1 = null;
    let uGhati = null, uVighati = null, uTithi = null, uNak = null, uMasa = null;

    function initGL() {
      if (gl.isContextLost()) return false;
      const vs = compile(gl, gl.VERTEX_SHADER, VS);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) {
        canvas.setAttribute("data-field-fail", "shader");
        return false;
      }
      prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error("FieldGL link error", gl.getProgramInfoLog(prog));
        canvas.setAttribute("data-field-fail", "link");
        return false;
      }

      const ids = new Float32Array(N);
      for (let i = 0; i < N; i++) ids[i] = i;
      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, ids, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "a_id");
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 0, 0);

      uTime = gl.getUniformLocation(prog, "u_time");
      uRes = gl.getUniformLocation(prog, "u_res");
      uDpr = gl.getUniformLocation(prog, "u_dpr");
      uMode = gl.getUniformLocation(prog, "u_mode");
      uL0 = gl.getUniformLocation(prog, "u_l0");
      uL1 = gl.getUniformLocation(prog, "u_l1");
      uGhati = gl.getUniformLocation(prog, "u_ghati");
      uVighati = gl.getUniformLocation(prog, "u_vighati");
      uTithi = gl.getUniformLocation(prog, "u_tithi");
      uNak = gl.getUniformLocation(prog, "u_nak");
      uMasa = gl.getUniformLocation(prog, "u_masa");
      canvas.setAttribute("data-field-ok", "1");
      return true;
    }

    if (!initGL()) return null;

    let raf = 0;
    let running = true;
    let visible = true;

    if (typeof IntersectionObserver !== "undefined") {
      new IntersectionObserver(function (entries) {
        visible = entries.some(function (e) { return e.isIntersecting; });
      }, { threshold: 0.05 }).observe(canvas);
    }

    let currentDpr = 1;
    function resize() {
      const dpr = Math.min(root.devicePixelRatio || 1, 2.5);
      const rect = canvas.getBoundingClientRect();
      const cw = rect.width || canvas.clientWidth || 640;
      const ch = rect.height || canvas.clientHeight || 360;
      const w = Math.max(2, Math.floor(cw * dpr));
      const h = Math.max(2, Math.floor(ch * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      currentDpr = dpr;
      return dpr;
    }
    resize();
    root.addEventListener("resize", resize, { passive: true });

    function frame(t) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden || gl.isContextLost()) return;
      const live = liveState();
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.clearColor(0.008, 0.016, 0.03, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.uniform1f(uTime, t * 0.001);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uDpr, currentDpr);
      gl.uniform1i(uMode, mode);
      gl.uniform1f(uL0, live.lambda[0] || 0);
      gl.uniform1f(uL1, live.lambda[1] || 0);
      gl.uniform1f(uGhati, live.ghati);
      gl.uniform1f(uVighati, live.vighati);
      gl.uniform1f(uTithi, live.tithi);
      gl.uniform1f(uNak, live.nak);
      gl.uniform1f(uMasa, live.masa);
      gl.drawArrays(gl.POINTS, 0, N);
    }

    function onContextLost(e) {
      e.preventDefault();
      canvas.setAttribute("data-field-ok", "0");
      canvas.setAttribute("data-field-fail", "context-lost");
      if (raf) cancelAnimationFrame(raf);
    }

    function onContextRestored() {
      canvas.removeAttribute("data-field-fail");
      if (initGL()) {
        resize();
        if (running) raf = requestAnimationFrame(frame);
      }
    }

    canvas.addEventListener("webglcontextlost", onContextLost, false);
    canvas.addEventListener("webglcontextrestored", onContextRestored, false);

    raf = requestAnimationFrame(frame);
    const api = {
      stop: function () {
        running = false;
        cancelAnimationFrame(raf);
        canvas.removeEventListener("webglcontextlost", onContextLost);
        canvas.removeEventListener("webglcontextrestored", onContextRestored);
      }
    };
    canvas.__fieldMounted = api;
    return api;
  }

  function boot() {
    document.querySelectorAll("canvas[data-field-gl]").forEach(function (c) {
      mount(c, Number(c.getAttribute("data-field-gl")) || 1);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  root.FieldGL = { mount: mount, boot: boot, push: push };
})(typeof globalThis !== "undefined" ? globalThis : this);

