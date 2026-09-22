(function attachStarfield(root) {
  "use strict";

  const STAR_COUNT = 100000;
  const NAK = [
    "अश्विनी","भरणी","कृत्तिका","रोहिणी","मृगशिरा","आर्द्रा","पुनर्वसु",
    "पुष्य","आश्लेषा","मघा","पूर्वफाल्गुनी","उत्तरफाल्गुनी","हस्त","चित्रा",
    "स्वाती","विशाखा","अनुराधा","ज्येष्ठा","मूल","पूर्वाषाढा","उत्तराषाढा",
    "श्रवण","धनिष्ठा","शतभिषा","पूर्वभाद्रपद","उत्तरभाद्रपद","रेवती"
  ];
  const SAPTARISHI = [
    { name: "मरीचि", ra: 165.46, dec: 56.38 },
    { name: "वसिष्ठ", ra: 186.73, dec: 54.92 },
    { name: "अङ्गिरस", ra: 183.86, dec: 57.03 },
    { name: "अत्रि", ra: 178.46, dec: 53.69 },
    { name: "पुलस्त्य", ra: 193.51, dec: 55.96 },
    { name: "पुलह", ra: 200.98, dec: 54.93 },
    { name: "क्रतु", ra: 206.89, dec: 49.31 }
  ];

  const VS = `#version 300 es
precision highp float;
in vec3 a_pos;
in float a_mag;
in float a_kind;
uniform float u_time;
uniform vec2 u_res;
uniform vec3 u_cam;
uniform float u_dpr;
out float v_mag;
out float v_kind;
void main() {
  float yaw = u_cam.x;
  float tilt = u_cam.y;
  float zoom = u_cam.z;
  float cy = cos(yaw), sy = sin(yaw);
  float cx = cos(tilt), sx = sin(tilt);
  vec3 p = a_pos;
  float x1 = p.x * cy - p.z * sy;
  float z1 = p.x * sy + p.z * cy;
  float y2 = p.y * cx - z1 * sx;
  float z2 = p.y * sx + z1 * cx;
  float foc = 15.5;
  float s = foc / max(0.15, foc - z2);
  vec2 clip = vec2(x1 * s * zoom * 0.14, y2 * s * zoom * 0.14);
  clip.x *= u_res.y / max(1.0, u_res.x);
  gl_Position = vec4(clip, 0.0, 1.0);
  float twinkle = 0.82 + 0.18 * sin(u_time * (0.4 + a_mag) + a_pos.x * 12.0);
  float dpr = max(1.0, u_dpr);
  gl_PointSize = mix(0.8, 5.4, a_mag) * twinkle * (0.7 + 0.3 * s) * dpr;
  v_mag = a_mag;
  v_kind = a_kind;
}`;

  const FS = `#version 300 es
precision highp float;
in float v_mag;
in float v_kind;
out vec4 o;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float r = length(d);
  float glow = max(0.0, 1.0 - r * 2.0);
  glow = pow(glow, 1.6);
  vec3 gold = vec3(0.92, 0.79, 0.48);
  vec3 cyan = vec3(0.37, 0.83, 0.91);
  vec3 bone = vec3(0.86, 0.90, 0.92);
  vec3 col = mix(bone, gold, step(0.5, v_kind));
  col = mix(col, cyan, step(1.5, v_kind));
  o = vec4(col, glow * mix(0.18, 0.95, v_mag));
}`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(log);
    }
    return sh;
  }

  function seeded(i) {
    let x = (i * 1664525 + 1013904223) >>> 0;
    return function () {
      x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
      return x / 4294967296;
    };
  }

  function raDecToDir(raDeg, decDeg) {
    const ra = raDeg * Math.PI / 180;
    const dec = decDeg * Math.PI / 180;
    return [
      Math.cos(dec) * Math.cos(ra) * 8.4,
      Math.sin(dec) * 8.4,
      Math.cos(dec) * Math.sin(ra) * 8.4
    ];
  }

  function buildCatalog() {
    const pos = new Float32Array(STAR_COUNT * 3);
    const mag = new Float32Array(STAR_COUNT);
    const kind = new Float32Array(STAR_COUNT);
    for (let i = 0; i < STAR_COUNT; i++) {
      const rnd = seeded(i + 17);
      const u = rnd() * 2 - 1;
      const theta = rnd() * Math.PI * 2;
      const r = Math.cbrt(rnd()) * 9.2;
      const s = Math.sqrt(Math.max(0, 1 - u * u));
      pos[i * 3] = r * s * Math.cos(theta);
      pos[i * 3 + 1] = r * u;
      pos[i * 3 + 2] = r * s * Math.sin(theta);
      mag[i] = Math.pow(rnd(), 3.4);
      kind[i] = rnd() > 0.92 ? 1 : 0;
    }
    SAPTARISHI.forEach((star, i) => {
      const p = raDecToDir(star.ra, star.dec);
      const idx = i;
      pos[idx * 3] = p[0];
      pos[idx * 3 + 1] = p[1];
      pos[idx * 3 + 2] = p[2];
      mag[idx] = 1;
      kind[idx] = 2;
    });
    NAK.forEach((_, i) => {
      const lon = ((i + 0.5) * 360 / 27) * Math.PI / 180;
      const idx = 8 + i;
      pos[idx * 3] = Math.cos(lon) * 7.2;
      pos[idx * 3 + 1] = Math.sin(i * 0.37) * 0.45;
      pos[idx * 3 + 2] = Math.sin(lon) * 7.2;
      mag[idx] = 0.92;
      kind[idx] = 1;
    });
    return { pos, mag, kind, named: SAPTARISHI, nakshatras: NAK };
  }

  function mount(canvas) {
    if (!canvas) return null;
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "high-performance" });
    if (!gl) return { ok: false, reason: "webgl2-missing" };

    const catalog = buildCatalog();
    let prog = null, vao = null;
    let uTime = null, uRes = null, uCam = null, uDpr = null;

    function initGL() {
      if (gl.isContextLost()) return false;
      try {
        const vs = compile(gl, gl.VERTEX_SHADER, VS);
        const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
        prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          return false;
        }

        vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        function attr(name, data, size) {
          const loc = gl.getAttribLocation(prog, name);
          const buf = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
        }
        attr("a_pos", catalog.pos, 3);
        attr("a_mag", catalog.mag, 1);
        attr("a_kind", catalog.kind, 1);

        uTime = gl.getUniformLocation(prog, "u_time");
        uRes = gl.getUniformLocation(prog, "u_res");
        uCam = gl.getUniformLocation(prog, "u_cam");
        uDpr = gl.getUniformLocation(prog, "u_dpr");
        return true;
      } catch (err) {
        return false;
      }
    }

    if (!initGL()) return { ok: false, reason: "gl-init-failed" };

    function resize() {
      const dpr = Math.min(root.devicePixelRatio || 1, 2.5);
      const rect = canvas.getBoundingClientRect();
      const cssW = rect.width || root.innerWidth || 1280;
      const cssH = rect.height || root.innerHeight || 720;
      const w = Math.max(1, Math.floor(cssW * dpr));
      const h = Math.max(1, Math.floor(cssH * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = cssW + "px";
        canvas.style.height = cssH + "px";
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      return dpr;
    }

    let raf = 0;
    let running = true;
    function frame(t) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (document.hidden || gl.isContextLost()) return;
      const dpr = resize();
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      const yaw = typeof root.yaw === "number" ? root.yaw : t * 0.00004;
      const tilt = typeof root.tiltV === "number" ? root.tiltV : -0.42;
      const zoom = typeof root.zoom === "number" ? root.zoom : 1;
      gl.uniform1f(uTime, t * 0.001);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform3f(uCam, yaw, tilt, zoom);
      gl.uniform1f(uDpr, dpr);
      gl.drawArrays(gl.POINTS, 0, STAR_COUNT);
    }

    function onContextLost(e) {
      e.preventDefault();
      if (raf) cancelAnimationFrame(raf);
    }

    function onContextRestored() {
      if (initGL() && running) {
        resize();
        raf = requestAnimationFrame(frame);
      }
    }

    canvas.addEventListener("webglcontextlost", onContextLost, false);
    canvas.addEventListener("webglcontextrestored", onContextRestored, false);

    const onVisChange = function () {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
      } else if (running) {
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisChange, { passive: true });

    resize();
    raf = requestAnimationFrame(frame);
    return {
      ok: true,
      count: STAR_COUNT,
      catalog,
      stop: function () {
        running = false;
        cancelAnimationFrame(raf);
        canvas.removeEventListener("webglcontextlost", onContextLost);
        canvas.removeEventListener("webglcontextrestored", onContextRestored);
        document.removeEventListener("visibilitychange", onVisChange);
      }
    };
  }

  function boot() {
    let canvas = document.getElementById("starfield");
    if (!canvas) {
      const host = document.getElementById("c");
      if (!host || !host.parentNode) return;
      canvas = document.createElement("canvas");
      canvas.id = "starfield";
      canvas.setAttribute("aria-hidden", "true");
      host.parentNode.insertBefore(canvas, host);
    }
    try {
      const engine = mount(canvas);
      root.__starfield = engine;
      return engine;
    } catch (err) {
      root.__starfield = { ok: false, reason: String(err && err.message || err) };
      return root.__starfield;
    }
  }

  root.Starfield = { STAR_COUNT, NAK, SAPTARISHI, buildCatalog, mount, boot };
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

