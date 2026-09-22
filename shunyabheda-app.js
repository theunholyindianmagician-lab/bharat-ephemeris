(function runShunyabhedaLab(M) {
  "use strict";

  if (!M) throw new Error("math-core.js did not load");

  window.toggleSectionCollapse = function(btn) {
    const panel = btn.closest(".panel");
    if (!panel) return;
    const isCollapsed = panel.classList.toggle("is-collapsed");
    btn.textContent = isCollapsed ? "+ Expand Section" : "— Minimize";
    btn.style.background = isCollapsed ? "var(--gold)" : "rgba(234, 201, 123, 0.12)";
    btn.style.color = isCollapsed ? "#03060e" : "var(--gold)";
  };

  window.toggleAllSections = function(expand) {
    document.querySelectorAll(".panel").forEach(panel => {
      const btn = panel.querySelector(".btn-panel-minimize");
      if (expand) {
        panel.classList.remove("is-collapsed");
        if (btn) {
          btn.textContent = "— Minimize";
          btn.style.background = "rgba(234, 201, 123, 0.12)";
          btn.style.color = "var(--gold)";
        }
      } else {
        panel.classList.add("is-collapsed");
        if (btn) {
          btn.textContent = "+ Expand Section";
          btn.style.background = "var(--gold)";
          btn.style.color = "#03060e";
        }
      }
    });
  };

  const $ = (id) => document.getElementById(id);

  // ── Shared देवनागरी graha-lookup (§C8) — one map for every lowercase-Latin key ──
  const GRAHA_DEV = Object.freeze({
    sun: "सूर्यः", moon: "चन्द्रः", mars: "मङ्गलः", mercury: "बुधः", jupiter: "गुरुः",
    venus: "शुक्रः", saturn: "शनिः", rahu: "राहुः", ketu: "केतुः",
    surya: "सूर्यः", candra: "चन्द्रः", mangala: "मङ्गलः", budha: "बुधः",
    guru: "गुरुः", shukra: "शुक्रः", shani: "शनिः",
  });
  const grahaDev = (k) => GRAHA_DEV[k] || k;

  // देवनागरी अंक-रूपान्तर (display only — value अपरिवर्तित)
  const DEV_DIGITS = { "0": "०", "1": "१", "2": "२", "3": "३", "4": "४", "5": "५", "6": "६", "7": "७", "8": "८", "9": "९" };
  const devNum = (s) => String(s).replace(/[0-9]/g, (d) => DEV_DIGITS[d]);

  // तिथि पञ्चक-वर्ग (classical five-fold tithi classes) — index (tithi-1) % 5
  const TITHI_PANCHAKA = Object.freeze(["नन्दा", "भद्रा", "जया", "रिक्ता", "पूर्णा"]);
  // त्याज्य (inauspicious) yogas per muhūrta-śāstra — display caution only (v1 score untouched)
  const TYAJYA_YOGAS = Object.freeze(["व्यतीपात", "वैधृति", "शूल", "परिघ", "गण्ड", "अतिगण्ड", "व्याघात"]);

  const controls = {
    date: $("date"),
    time: $("time"),
    timezone: $("timezone"),
    latitude: $("latitude"),
    longitude: $("longitude"),
    ayanamsha: $("ayanamsha"),

  };
  const FEATURED_VARGAS = new Set(["D1", "D9", "D10", "D60"]);
  const UJJAIN_TOLERANCE_DEG = 0.02;
  const AYANAMSHA_LABELS = {
    effective_49: "effective shared-debt",
    linear_54: "linear 54″/year",
    linear_50: "linear 50″/year",
    sinusoidal_27: "sinusoidal ±27° / 7200 years",
  };

  // Legacy modes share the 499 CE Āryabhaṭa anchor; the multi-school extension
  // (spica_lahiri/kp/raman_spica/yukteshwar) carries its own registry label.
  function ayanamshaDescriptor(mode) {
    if (AYANAMSHA_LABELS[mode]) return `${AYANAMSHA_LABELS[mode]} · implemented zero at 499 CE`;
    const ext = M.AYANAMSHA_MODES_EXTENDED && M.AYANAMSHA_MODES_EXTENDED[mode];
    if (ext) return ext.label;
    return mode;
  }

  // Extend the existing <select> with the multi-school registry variants —
  // labels come straight from M.AYANAMSHA_MODES_EXTENDED, never duplicated here.
  function populateExtendedAyanamshaOptions() {
    const select = controls.ayanamsha;
    if (!select || !M.AYANAMSHA_MODES_EXTENDED) return;
    const existing = new Set(Array.from(select.options).map((o) => o.value));
    for (const [value, meta] of Object.entries(M.AYANAMSHA_MODES_EXTENDED)) {
      if (existing.has(value)) continue;
      const option = document.createElement("option");
      option.value = value;
      option.textContent = meta.label;
      select.appendChild(option);
    }
  }

  const VARGA_GRAHA_LABELS = {
    surya: "सू", candra: "च", mangala: "म", budha: "बु", guru: "गु",
    shukra: "शु", shani: "श", rahu: "रा", ketu: "के",
  };

  const VARGA_REGIONS = [
    { poly: "50,0 38,38 62,38", box: [41, 6, 18, 27] },
    { poly: "0,50 38,38 38,46", box: [5, 39.5, 28, 6] },
    { poly: "0,50 38,46 38,54", box: [5, 46, 28, 8] },
    { poly: "0,50 38,54 38,62", box: [5, 54.5, 28, 6] },
    { poly: "50,100 38,62 62,62", box: [41, 67, 18, 27] },
    { poly: "100,50 62,54 62,62", box: [67, 54.5, 28, 6] },
    { poly: "100,50 62,46 62,54", box: [67, 46, 28, 8] },
    { poly: "100,50 62,38 62,46", box: [67, 39.5, 28, 6] },
    { rect: [38, 38, 12, 12], box: [39, 38, 10, 12] },
    { rect: [50, 38, 12, 12], box: [51, 38, 10, 12] },
    { rect: [50, 50, 12, 12], box: [51, 50, 10, 12] },
    { rect: [38, 50, 12, 12], box: [39, 50, 10, 12] },
  ];

  /* ══════════════════════════════════════════════════════════════════════
     LOCAL COMPUTE STUDIO & SNIPPET STATE
     ══════════════════════════════════════════════════════════════════════ */
  let activeSnippetLang = "curl";

  function setSnippetLang(lang) {
    activeSnippetLang = lang;
    const langs = ["curl", "python", "nodejs", "go"];
    langs.forEach((l) => {
      const btn = $(`btn-${l}`);
      if (!btn) return;
      if (l === lang) {
        btn.style.background = "var(--gold)";
        btn.style.color = "#03060e";
        btn.style.border = "none";
        btn.style.fontWeight = "700";
      } else {
        btn.style.background = "transparent";
        btn.style.color = "var(--soft)";
        btn.style.border = "1px solid var(--line)";
        btn.style.fontWeight = "normal";
      }
    });
    updateCodeSnippet();
  }

  function getActiveApiParams() {
    return {
      date: controls.date.value || "2026-08-09",
      time: controls.time.value || "12:00:00",
      tz: controls.timezone.value || "5.5",
      lat: controls.latitude.value || "23.1765",
      lon: controls.longitude.value || "75.7885",
      ayanamsa: controls.ayanamsha.value || "effective_49",

    };
  }

  function buildEndpointUrl() {
    const methodSelect = $("apiMethod");
    const method = methodSelect ? methodSelect.value : "sphuta";
    if (method === "panchang") return "ShunyaMath.panchangAtJd(jd)";
    if (method === "quant") return "ShunyaMath.computeAspects(planets)";
    if (method === "vargas") return "ShunyaMath.canonicalGrahaModel(jd)";
    return "ShunyaMath.canonicalGrahaModel(jd)";
  }

  function updateCodeSnippet() {
    const p = getActiveApiParams();
    const snippetEl = $("apiCodeSnippet");
    if (!snippetEl) return;
    const localJs = `const jd = ShunyaMath.gregorianToJulianDay("${p.date}", "${p.time}", ${p.tz});\nconst rows = ShunyaMath.canonicalGrahaModel(jd);\nconsole.log(rows);`;
    let code = localJs;
    if (activeSnippetLang === "python") {
      code = `# Local engine is JavaScript in this page.\n# ShunyaMath.canonicalGrahaModel(jd)\n\n${localJs}`;
    } else if (activeSnippetLang === "nodejs") {
      code = `// Local ShunyaMath — no HTTP\n${localJs}`;
    } else if (activeSnippetLang === "go") {
      code = `// Local engine is JavaScript in this page.\n// ShunyaMath.canonicalGrahaModel(jd)\n\n${localJs}`;
    }
    const codeEl = snippetEl.querySelector("code") || snippetEl;
    codeEl.textContent = code;
  }

  function setEngineStatus(ok, message) {
    const el = $("apiEngineStatus");
    if (el) {
      el.textContent = ok ? "OK" : "ERROR";
      el.style.color = ok ? "var(--green)" : "var(--red)";
    }
    if (!ok) {
      const latEl = $("apiLatency");
      if (latEl) latEl.textContent = "—";
      const viewer = $("apiResponseViewer");
      if (viewer) {
        const codeEl = viewer.querySelector("code") || viewer;
        codeEl.textContent = JSON.stringify({
          status: "error",
          engine: "ShunyaMath local engine (Surya-Siddhanta canonical)",
          error: message,
        }, null, 2);
      }
    }
  }

  // Real determinism check: compute the canonical model twice and compare the
  // serialized bytes. No hardcoded PASS — both branches are reachable.
  function computeBitwiseDeterminism(jd) {
    if (typeof M.canonicalGrahaModel !== "function") return false;
    const runA = JSON.stringify(M.canonicalGrahaModel(jd));
    const runB = JSON.stringify(M.canonicalGrahaModel(jd));
    return runA === runB;
  }

  function runLiveApiQuery() {
    const urlInput = $("apiEndpointUrl");
    if (urlInput) urlInput.value = buildEndpointUrl();
    updateCodeSnippet();
    try {
      runLiveApiQueryCore();
      setEngineStatus(true, "");
    } catch (error) {
      setEngineStatus(false, error instanceof Error ? error.message : String(error));
    }
  }

  function runLiveApiQueryCore() {
    const tStart = performance.now();
    const methodSelect = $("apiMethod");
    const method = methodSelect ? methodSelect.value : "sphuta";

    const { timezone, latitude, longitude } = validateInputs();
    const mode = controls.ayanamsha.value;
    const jd = M.gregorianToJulianDay(controls.date.value, controls.time.value, timezone);
    const ayanamsha = M.ayanamshaDeg(jd, mode);
    const tropicalAscendant = M.tropicalAscendantDeg(jd, latitude, longitude);
    const siderealAscendant = M.siderealAscendantDeg(jd, latitude, longitude, mode);
    const planets = canonicalGrahaRows(jd);
    const velocities = M.computePlanetaryVelocities ? M.computePlanetaryVelocities(jd) : [];

    let payload = {};

    if (method === "sphuta") {
      const sphutaDict = {};
      planets.forEach((g) => {
        const vel = velocities.find((v) => v.key === g.key);
        if (!vel || !Number.isFinite(vel.speedDegDay)) {
          throw new Error(`Velocity data unavailable for ${g.en} — computePlanetaryVelocities export missing; refusing to substitute fake speeds.`);
        }
        const signIdx = M.signIndex(g.longitude);
        const within = M.mod360(g.longitude) - signIdx * 30;
        const nakshatraIdx = Math.floor(g.longitude / (360 / 27)) % 27;
        const pada = Math.floor((g.longitude % (360 / 27)) / (360 / 108)) + 1;

        sphutaDict[g.en] = {
          canonical_deg: Number(g.longitude.toFixed(6)),
          rashi: M.RASHIS[signIdx],
          rashi_deg: Number(within.toFixed(4)),
          nakshatra: M.NAKSHATRA_NAMES ? M.NAKSHATRA_NAMES[nakshatraIdx] : `Nakshatra-${nakshatraIdx + 1}`,
          pada,
          speed_deg_day: Number(vel.speedDegDay.toFixed(6)),
          accel_deg_day2: Number((vel.accelDegDay2 ?? 0).toFixed(8)),
          vakri: Boolean(vel.isRetrograde),
          motion_state: vel.motionState || "direct",
        };
      });

      payload = {
        status: "success",
        endpoint: "/v1/sphuta",
        engine: "ShunyaMath local engine (Surya-Siddhanta canonical)",
        epoch: {
          civil_date: controls.date.value,
          civil_time: controls.time.value,
          timezone_offset_hours: timezone,
          julian_day: Number(jd.toFixed(8)),
        },
        location: {
          latitude: latitude,
          longitude: longitude,
          local_meridian_time: M.ujjainMeanTime(controls.time.value, timezone, longitude),
          local_sidereal_time_deg: Number(M.localSiderealTimeDeg(jd, longitude).toFixed(6)),
        },
        ayanamsa: {
          mode,
          value_deg: Number(ayanamsha.toFixed(8)),
          rate_arcsec_yr: Number(modeRateArcsecPerYear(jd, mode).toFixed(6)),
          frame: AYANAMSHA_LABELS[mode] ? "Aryabhata 499 CE zero anchor" : ayanamshaDescriptor(mode),
        },
        ascendant: {
          tropical_deg: Number(tropicalAscendant.toFixed(6)),
          sidereal_deg: Number(siderealAscendant.toFixed(6)),
          rashi: M.RASHIS[M.signIndex(siderealAscendant)],
          rashi_deg: Number((M.mod360(siderealAscendant) % 30).toFixed(4)),
        },
        sphuta: sphutaDict,
        mathematical_audit: {
          bitwise_determinism: computeBitwiseDeterminism(jd) ? "PASS (two independent recomputes byte-identical)" : "FAIL (recomputes diverged)",
          panini_hash_of_inputs: M.paniniHash ? M.paniniHash(`SPHUTA:${jd.toFixed(6)}:${mode}`, 16) : null,
        },
      };
    } else if (method === "panchang") {
      const panchang = M.panchangAtJd(jd, timezone);
      const moon = planets.find((g) => g.key === "candra") || { longitude: 0 };
      const sun = planets.find((g) => g.key === "surya") || { longitude: 0 };
      const lunar = M.mod360(moon.longitude - sun.longitude);
      const tithiProgress = ((lunar % 12) / 12) * 100;

      payload = {
        status: "success",
        endpoint: "/v1/panchang",
        engine: "ShunyaMath local engine (Surya-Siddhanta canonical)",
        julian_day: Number(jd.toFixed(8)),
        civil_calendar: {
          date: controls.date.value,
          time: controls.time.value,
          weekday_sa: panchang.varaName,
          weekday_index: panchang.varaIndex,
        },
        pancha_anga: {
          tithi: {
            index: panchang.tithiIndex + 1,
            name: panchang.tithiName,
            paksha: panchang.paksha,
            progress_pct: Number(tithiProgress.toFixed(2)),
            remaining_pct: Number((100 - tithiProgress).toFixed(2)),
          },
          vara: {
            index: panchang.varaIndex,
            name: panchang.varaName,
            ruler: ["Surya", "Chandra", "Mangala", "Budha", "Guru", "Shukra", "Shani"][panchang.varaIndex],
          },
          nakshatra: {
            index: panchang.nakshatraIndex + 1,
            name: panchang.nakshatraName,
            pada: Math.floor((moon.longitude % (360 / 27)) / (360 / 108)) + 1,
            degree_in_nakshatra: Number((moon.longitude % (360 / 27)).toFixed(4)),
          },
          yoga: {
            index: (panchang.yogaIndex ?? 0) + 1,
            name: panchang.yogaName || "विष्कम्भ",
            lunar_solar_sum_deg: Number(M.mod360(moon.longitude + sun.longitude).toFixed(4)),
          },
          karana: {
            index: (panchang.karanaIndex ?? 0) + 1,
            name: panchang.karanaName || "बव",
            type: panchang.karanaType || "Chara",
            is_vishti_bhadra: (panchang.karanaName || "").includes("विष्टि"),
          },
        },
        vedic_metrology: {
          saura_masa: panchang.sauraMasaName,
          ahargana_kali: Number(panchang.ahargana.toFixed(4)),
          ghati: panchang.ghati,
          vighati: panchang.vighati,
          prana: panchang.prana,
          vipala: panchang.vipala,
          vipala_ticks_day: panchang.vipalaTicks,
        },
      };
    } else if (method === "quant") {
      if (typeof M.computeAspects !== "function") {
        throw new Error("computeAspects export missing — refusing to fabricate volatility metrics.");
      }
      const aspects = M.computeAspects(planets);
      const rahu = planets.find((g) => g.key === "rahu") || { longitude: 300 };
      const nodalPeriodDays = 6798.383;
      const daysSinceJ2000 = jd - 2451545.0;
      const nodalProgress = ((nodalPeriodDays - (M.mod(daysSinceJ2000, nodalPeriodDays))) / nodalPeriodDays) * 100;
      const sarosCycleDays = 6585.32;
      const sarosProgress = (M.mod(daysSinceJ2000, sarosCycleDays) / sarosCycleDays) * 100;

      const stationingGrahas = velocities.filter((v) => v.isStationary).map((v) => ({
        graha: v.en,
        speed_deg_day: Number(v.speedDegDay.toFixed(6)),
        accel_deg_day2: Number(v.accelDegDay2.toFixed(8)),
        signal: "STATIONARY_REGIME_INFLECTION",
      }));

      payload = {
        status: "success",
        endpoint: "/v1/quant/aspects",
        engine: "ShunyaMath local engine (Surya-Siddhanta canonical)",
        julian_day: Number(jd.toFixed(8)),
        market_volatility_metrics: {
          composite_volatility_index: aspects.volatilityIndex,
          market_regime: aspects.marketRegime,
          active_aspects_count: aspects.activeAspects.length,
          planetary_stationing_inflections: stationingGrahas,
        },
        lunar_nodal_macro_cycles: {
          rahu_longitude_deg: Number(rahu.longitude.toFixed(6)),
          nodal_18_61_year_cycle_progress_pct: Number(nodalProgress.toFixed(3)),
          nodal_square_harmonic_phase: Number((nodalProgress * 2 % 100).toFixed(2)),
          saros_eclipse_cycle_progress_pct: Number(sarosProgress.toFixed(3)),
          liquidity_expansion_regime: nodalProgress > 50 ? "EXPANSION_PHASE" : "CONTRACTION_CONSOLIDATION",
        },
        active_harmonic_aspects: aspects.activeAspects.map((a) => ({
          pair: `${a.graha1} - ${a.graha2}`,
          aspect: a.aspect,
          symbol: a.symbol,
          target_deg: a.targetAngleDeg,
          actual_separation_deg: Number(a.actualSeparationDeg.toFixed(4)),
          orb_deg: Number(a.orbDeg.toFixed(4)),
          orb_arcmin: Number(a.orbArcMin.toFixed(2)),
          intensity_pct: a.intensityPct,
          nature: a.nature,
          market_impact: a.marketImpact,
        })),
        planetary_velocity_derivatives: velocities.map((v) => ({
          graha: v.en,
          longitude_deg: Number(v.longitude.toFixed(6)),
          velocity_dtheta_dt_deg_day: Number(v.speedDegDay.toFixed(6)),
          acceleration_d2theta_dt2_deg_day2: Number(v.accelDegDay2.toFixed(8)),
          motion_state: v.motionState,
          is_retrograde: v.isRetrograde,
          is_stationary: v.isStationary,
        })),
      };
    } else if (method === "vargas") {
      const vargasList = ["D1", "D2", "D3", "D4", "D7", "D9", "D10", "D12", "D16", "D20", "D24", "D27", "D30", "D40", "D45", "D60", "D150"];
      const vargasMap = {};

      const targets = [
        { en: "Lagna", longitude: siderealAscendant },
        ...planets.map((g) => ({ en: g.en, longitude: g.longitude })),
      ];

      targets.forEach((t) => {
        if (typeof M.computeNadiAmsha !== "function") {
          throw new Error("computeNadiAmsha export missing — refusing to substitute placeholder nadi data.");
        }
        const nadi = M.computeNadiAmsha(t.longitude);
        const harmonicDivisions = {};
        M.VARGAS.forEach((v) => {
          harmonicDivisions[v.code] = M.RASHIS[M.computeVarga(t.longitude, v.code)];
        });

        vargasMap[t.en] = {
          canonical_longitude: Number(t.longitude.toFixed(6)),
          d150_nadi_amsha: {
            division: 150,
            amsha_index: nadi.nadiIndex,
            nadi_name: nadi.name,
            rashi: nadi.rashi,
            span_in_sign: nadi.spanLabel,
            division_width_arcmin: 12.0,
          },
          harmonic_matrix: harmonicDivisions,
        };
      });

      payload = {
        status: "success",
        endpoint: "/v1/vargas/d150",
        engine: "ShunyaMath local engine (Surya-Siddhanta canonical)",
        julian_day: Number(jd.toFixed(8)),
        nadi_division_system: {
          total_zodiac_amshas: 1800,
          amshas_per_rashi: 150,
          arc_per_amsha_deg: 0.2,
          arc_per_amsha_arcmin: 12.0,
          chara_sthira_dvisvabhava_reckoning: "Deva Keralam / Dhruva Nadi Standard",
        },
        entities: vargasMap,
      };
    }

    const tEnd = performance.now();
    const diffMicros = Math.round((tEnd - tStart) * 1000);
    const diffMs = ((tEnd - tStart)).toFixed(2);

    const latEl = $("apiLatency");
    if (latEl) latEl.textContent = `${diffMicros} µs (${diffMs} ms) measured`;

    const viewer = $("apiResponseViewer");
    if (viewer) {
      const codeEl = viewer.querySelector("code") || viewer;
      codeEl.textContent = JSON.stringify(payload, null, 2);
    }
  }

  function appendCell(row, text, className = "") {
    const cell = document.createElement("td");
    cell.textContent = text;
    if (className) cell.className = className;
    row.appendChild(cell);
  }

  function appendHeader(row, text, scope = "col") {
    const cell = document.createElement("th");
    cell.scope = scope;
    cell.textContent = text;
    row.appendChild(cell);
  }

  function formatDegrees(value, digits = 6) {
    return `${M.mod360(value).toFixed(digits)}°`;
  }

  function signLabel(longitude) {
    const index = M.signIndex(longitude);
    const within = M.mod360(longitude) - index * 30;
    return `${M.RASHIS[index]} ${within.toFixed(4)}°`;
  }

  function canonicalGrahaRows(jd) {
    let rows;
    if (typeof M.canonicalGrahaModel === "function") {
      rows = M.canonicalGrahaModel(jd);
    } else if (typeof M.sphutaGrahaModel === "function") {
      rows = M.sphutaGrahaModel(jd);
    } else {
      throw new Error("This adapter requires canonicalGrahaModel() or sphutaGrahaModel(); mean rows cannot feed corrected findings.");
    }
    if (!Array.isArray(rows) || rows.length !== 9) throw new Error("Canonical graha adapter must return exactly nine rows.");
    return rows.map((row) => {
      const longitude = Number(row.longitude);
      if (!row.key || !Number.isFinite(row.mean) || !Number.isFinite(row.longitude)) {
        throw new Error("Canonical graha adapter returned an incomplete corrected row.");
      }
      return { ...row, longitude };
    });
  }

  function renderPlanets(planets) {
    const body = $("planet-body");
    if (!body) return;
    body.replaceChildren();
    for (const graha of planets) {
      const nak = M.computeNakshatraDetails(graha.longitude);
      const row = document.createElement("tr");
      appendHeader(row, `${graha.sa} · ${graha.en}`, "row");
      appendCell(row, formatDegrees(graha.mean));
      appendCell(row, formatDegrees(graha.longitude), "accent");
      appendCell(row, signLabel(graha.longitude));
      appendCell(row, `${nak.number}. ${nak.name} (चरण ${nak.pada})`);
      appendCell(row, `${nak.lord}`);
      body.appendChild(row);
    }
  }

  function renderQuantSection(jd, planets) {
    const velBody = $("quant-vel-body");
    const aspectsList = $("quant-aspects-list");
    const regBadge = $("quantRegimeBadge");
    const volIndexEl = $("quantVolIndex");

    if (!velBody) return;

    const velocities = M.computePlanetaryVelocities ? M.computePlanetaryVelocities(jd) : [];
    const aspects = typeof M.computeAspects === "function" ? M.computeAspects(planets) : null;

    velBody.replaceChildren();
    for (const graha of planets) {
      const vel = velocities.find((v) => v.key === graha.key);
      const row = document.createElement("tr");
      appendHeader(row, `${graha.sa} · ${graha.en}`, "row");
      appendCell(row, formatDegrees(graha.longitude));

      if (!vel || !Number.isFinite(vel.speedDegDay)) {
        // Honest failure state — never substitute fabricated speeds.
        appendCell(row, "unavailable");
        appendCell(row, "unavailable");
        appendCell(row, "unavailable");
        appendCell(row, "velocity export missing from math-core");
        velBody.appendChild(row);
        continue;
      }

      appendCell(row, `${vel.speedDegDay >= 0 ? "+" : ""}${vel.speedDegDay.toFixed(6)}°/d`, vel.isRetrograde ? "error" : "accent");
      appendCell(row, `${vel.accelDegDay2 >= 0 ? "+" : ""}${vel.accelDegDay2.toFixed(8)}°/d²`);

      let motionBadge = `<span class="badge badge-cyan">${vel.motionState.toUpperCase()}</span>`;
      if (vel.isRetrograde) motionBadge = `<span class="badge" style="background: rgba(255, 155, 155, 0.15); color: var(--red); border: 1px solid var(--red);">VAKRI (RETROGRADE)</span>`;
      else if (vel.isStationary) motionBadge = `<span class="badge badge-gold">STATIONARY INFLECTION</span>`;

      const motionCell = document.createElement("td");
      motionCell.innerHTML = motionBadge;
      row.appendChild(motionCell);

      // Neutral computed descriptor: report the actual |dθ/dt| magnitude only.
      const signalCell = document.createElement("td");
      const absSpeed = Math.abs(vel.speedDegDay).toFixed(4);
      signalCell.innerHTML = vel.isStationary
        ? `<b style="color: var(--gold);">Stationary: |dθ/dt| = ${absSpeed}°/day</b>`
        : `<span style="color: var(--soft);">|dθ/dt| = ${absSpeed}°/day (${vel.motionState})</span>`;
      row.appendChild(signalCell);

      velBody.appendChild(row);
    }

    if (!aspects) {
      // Honest failure state — no fabricated index or regime label.
      if (volIndexEl) volIndexEl.textContent = "unavailable";
      if (regBadge) {
        regBadge.textContent = "computeAspects export missing";
        regBadge.className = "badge";
        regBadge.style.cssText = "color: var(--red); border: 1px solid var(--red);";
      }
      if (aspectsList) {
        aspectsList.replaceChildren();
        aspectsList.innerHTML = `<div style="color: var(--red); font-size: 0.78rem;">Aspect data unavailable — computeAspects export missing from math-core.</div>`;
      }
      return;
    }

    if (volIndexEl) volIndexEl.textContent = `${aspects.volatilityIndex} / 100 (प्रयोगात्मक)`;
    if (regBadge) {
      regBadge.textContent = aspects.marketRegime;
      if (aspects.volatilityIndex >= 75) {
        regBadge.className = "badge";
        regBadge.style.cssText = "background: rgba(255, 155, 155, 0.2); color: var(--red); border: 1px solid var(--red);";
      } else if (aspects.volatilityIndex >= 45) {
        regBadge.className = "badge badge-gold";
      } else {
        regBadge.className = "badge badge-green";
      }
    }

    if (aspectsList) {
      aspectsList.replaceChildren();
      if (!aspects.activeAspects || aspects.activeAspects.length === 0) {
        aspectsList.innerHTML = `<div style="color: var(--soft); font-size: 0.78rem;">No intense major aspects within active orb bounds. Harmonic tranquility prevailing.</div>`;
      } else {
        aspects.activeAspects.forEach((a) => {
          const card = document.createElement("div");
          card.style.cssText = "background: var(--hero); border: 1px solid var(--line); border-radius: 4px; padding: 8px 10px; font-size: 0.76rem;";
          const isTense = a.nature.includes("Tense") || a.nature.includes("Dissonance") || a.aspect === "Square" || a.aspect === "Opposition";
          const color = isTense ? "var(--red)" : "var(--green)";
          card.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <strong style="color: var(--gold);">${a.graha1} ${a.symbol} ${a.graha2} (${a.aspect})</strong>
              <span style="color: ${color}; font-weight: 700;">${a.intensityPct}% intensity</span>
            </div>
            <div style="color: var(--soft); font-size: 0.72rem;">Orb: <b>${a.orbArcMin.toFixed(1)}'</b> (${a.actualSeparationDeg.toFixed(2)}° vs ${a.targetAngleDeg}°)</div>
            <div style="color: ${color}; font-size: 0.72rem; margin-top: 2px;">⚡ ${a.marketImpact} <span style="color: var(--soft);">(अ-प्रमाणित)</span></div>
          `;
          aspectsList.appendChild(card);
        });
      }
    }
  }

  function grahaName(key) {
    const g = M.GRAHAS.find((item) => item.key === key);
    return g ? g.sa : key;
  }

  function reconcileBhavaRows(model, planets) {
    const lagnaRashi = model.lagnaRashi;
    const grahas = planets.map((g) => {
      const bhava = M.bhavaIndexForLongitude(g.longitude, model.sandhis);
      const rawOffset = M.mod360(g.longitude - model.madhyas[bhava]);
      return {
        ...g,
        bhava,
        bhavaOffset: rawOffset > 180 ? rawOffset - 360 : rawOffset,
        wholeSignBhava: (M.signIndex(g.longitude) - lagnaRashi + 12) % 12 + 1,
      };
    });
    const bhavas = model.bhavas.map((bhava) => ({
      ...bhava,
      occupants: grahas.filter((g) => g.bhava === bhava.no).map((g) => g.key),
    }));
    return { ...model, bhavas, grahas };
  }

  function renderBhavas(model) {
    $("b-lagna").textContent = `${signLabel(model.lagna)} · ${M.RASHIS[model.lagnaRashi]}`;
    $("b-madhya10").textContent = `${formatDegrees(model.madhyas[10])} · madhya-lagna`;
    $("b-method").textContent = model.method;

    const body = $("bhavas-body");
    body.replaceChildren();
    for (const b of model.bhavas) {
      const nak = M.computeNakshatraDetails(b.madhya);
      const row = document.createElement("tr");
      appendHeader(row, `${b.no} · ${b.sa}`, "row");
      appendCell(row, `${b.karaka.sa} · ${b.karaka.en}`);
      appendCell(row, formatDegrees(b.madhya), "accent");
      appendCell(row, `${nak.name} (चरण ${nak.pada})`);
      appendCell(row, formatDegrees(b.sandhi));
      appendCell(row, `${b.spanDeg.toFixed(3)}°`);
      appendCell(row, b.rashi);
      appendCell(row, grahaName(b.lord));
      appendCell(row, b.occupants.length ? b.occupants.map(grahaName).join(" · ") : "—");
      body.appendChild(row);
    }

    const gbody = $("bhavas-graha-body");
    gbody.replaceChildren();
    for (const g of model.grahas) {
      const row = document.createElement("tr");
      appendHeader(row, `${g.sa} · ${g.en}`, "row");
      appendCell(row, formatDegrees(g.longitude));
      appendCell(row, `bhāva-${g.bhava}`, "accent");
      appendCell(row, `${g.bhavaOffset >= 0 ? "+" : ""}${g.bhavaOffset.toFixed(3)}°`);
      appendCell(row, `bhāva-${g.wholeSignBhava}`);
      gbody.appendChild(row);
    }
  }

  function computeVargaMatrix(ascendant, planets) {
    const sources = [
      { en: "Lagna", text: "ल", isLagna: true, longitude: ascendant },
      ...planets.map((graha) => ({
        en: graha.en,
        text: VARGA_GRAHA_LABELS[graha.key] || graha.sa,
        isLagna: false,
        longitude: graha.longitude,
      })),
    ];
    return M.VARGAS.map((varga) => ({
      varga,
      row: sources.map((source) => ({ ...source, sign: M.computeVarga(source.longitude, varga.code) })),
    }));
  }

  function renderVargas(matrix) {
    const head = $("varga-head");
    const body = $("varga-body");
    head.replaceChildren();
    body.replaceChildren();
    const headerRow = document.createElement("tr");
    appendHeader(headerRow, "Varga");
    for (const source of matrix[0].row) appendHeader(headerRow, source.en);
    head.appendChild(headerRow);
    for (const entry of matrix) {
      const row = document.createElement("tr");
      appendHeader(row, `${entry.varga.code} · ${entry.varga.name}`, "row");
      for (const source of entry.row) appendCell(row, M.RASHIS[source.sign]);
      body.appendChild(row);
    }
    // D144 row from VARGAS_EXTENDED — computed via the same computeVarga engine,
    // kept outside the canonical 16 (extension beyond Ṣoḍaśavarga).
    if (Array.isArray(M.VARGAS_EXTENDED)) {
      for (const varga of M.VARGAS_EXTENDED) {
        const row = document.createElement("tr");
        appendHeader(row, `${varga.code} · ${varga.name} — extension beyond Ṣoḍaśavarga`, "row");
        for (const source of matrix[0].row) appendCell(row, M.RASHIS[M.computeVarga(source.longitude, varga.code)], "accent");
        body.appendChild(row);
      }
    }
  }

  function occupantsMarkup(box, occupants) {
    const [x, y, w, h] = box;
    const fontSize = 4.25;
    const cellW = fontSize * 1.35;
    const gap = 0.35;
    const cols = Math.max(1, Math.floor((w + gap) / cellW));
    const rowH = fontSize + 1;
    const rows = Math.ceil(occupants.length / cols);
    const startY = y + (h - rows * rowH) / 2 + fontSize;
    return occupants.map((source, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const inRow = Math.min(cols, occupants.length - row * cols);
      const blockW = inRow * cellW - gap;
      const cx = x + (w - blockW) / 2 + col * cellW + cellW / 2;
      const cy = startY + row * rowH;
      const color = source.color || (source.isLagna ? "#f0d47d" : "#a2e6b2");
      return `<text x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" font-size="${fontSize}" fill="${color}" text-anchor="middle" font-weight="700">${source.text}</text>`;
    }).join("");
  }

  function vargaChartSvg(varga, row) {
    const cells = Array.from({ length: 12 }, () => []);
    for (const source of row) cells[source.sign].push(source);
    const occupied = cells.map((sources, index) => sources.length ? `${M.RASHIS[index]}: ${sources.map((source) => source.en).join(", ")}` : "").filter(Boolean).join("; ");
    let svg = `<svg viewBox="0 0 100 100" role="img" aria-labelledby="chart-${varga.code}-title chart-${varga.code}-desc"><title id="chart-${varga.code}-title">${varga.code} ${varga.name} varga chart</title><desc id="chart-${varga.code}-desc">North-Indian fixed-sign figure computed from canonical corrected sphuṭa rows. ${occupied}</desc>`;
    for (let i = 0; i < 12; i++) {
      const region = VARGA_REGIONS[i];
      const fill = cells[i].length ? "#12323b" : "#081318";
      if (region.poly) svg += `<polygon points="${region.poly}" fill="${fill}" stroke="#3e606b" stroke-width="0.7"/>`;
      else svg += `<rect x="${region.rect[0]}" y="${region.rect[1]}" width="${region.rect[2]}" height="${region.rect[3]}" fill="${fill}" stroke="#3e606b" stroke-width="0.7"/>`;
      svg += `<text x="${region.box[0]}" y="${region.box[1] + 4.8}" font-size="4.4" fill="#b8ccd2" font-weight="700">${i + 1}</text>`;
    }
    svg += `<line x1="50" y1="38" x2="50" y2="62" stroke="#3e606b" stroke-width="0.7"/><line x1="38" y1="50" x2="62" y2="50" stroke="#3e606b" stroke-width="0.7"/>`;
    for (let i = 0; i < 12; i++) if (cells[i].length) svg += occupantsMarkup(VARGA_REGIONS[i].box, cells[i]);
    return `${svg}</svg>`;
  }

  function createVargaChart(entry) {
    const figure = document.createElement("figure");
    figure.className = "varga-chart";
    const title = document.createElement("h3");
    title.textContent = `${entry.varga.code} · ${entry.varga.name}`;
    const graphic = document.createElement("div");
    graphic.innerHTML = vargaChartSvg(entry.varga, entry.row);
    const caption = document.createElement("figcaption");
    caption.className = "chart-foot";
    const occupied = Array.from({ length: 12 }, (_, sign) => {
      const names = entry.row.filter((source) => source.sign === sign).map((source) => source.en);
      return names.length ? `${M.RASHIS[sign]}: ${names.join(", ")}` : "";
    }).filter(Boolean);
    caption.textContent = `${occupied.join(" · ")} · canonical sphuṭa input`;
    figure.append(title, graphic, caption);
    return figure;
  }

  function renderVargaCharts(matrix) {
    const complete = $("varga-charts");
    if (!complete) return;
    complete.replaceChildren();
    for (const entry of matrix) {
      complete.appendChild(createVargaChart(entry));
    }
  }

  function renderDasha(moonLongitude, jd) {
    const result = M.vimshottariAtJd(moonLongitude, jd, jd);
    const state = result.birthState;
    $("dasha-state").textContent = `Canonical Moon ${formatDegrees(moonLongitude)} · nakṣatra ${state.nakshatraIndex + 1}/27 · ${state.lord} mahādaśā · ${state.balanceYears.toFixed(6)} years remaining at the selected instant`;
    $("dasha-maha").textContent = `${result.maha.lord}: ${M.julianDayToIsoDate(result.maha.startJd)} → ${M.julianDayToIsoDate(result.maha.endJd)}`;
    $("dasha-antara").textContent = result.antara
      ? `${result.antara.lord}: ${M.julianDayToIsoDate(result.antara.startJd)} → ${M.julianDayToIsoDate(result.antara.endJd)}`
      : "No antardaśā resolved";

    // Mahādaśā breath ladder — 972×-lattice column via dashaBreathCount (SIDDHA).
    const breathBody = $("dasha-breath-body");
    if (breathBody) {
      breathBody.replaceChildren();
      if (typeof M.vimshottariBreathTable !== "function") {
        const tr = document.createElement("tr");
        appendCell(tr, "श्वास ladder unavailable — vimshottariBreathTable export missing.", "error");
        breathBody.appendChild(tr);
      } else {
        for (const row of M.vimshottariBreathTable()) {
          const tr = document.createElement("tr");
          const isActive = row.lord === result.maha.lord;
          if (isActive) tr.style.background = "rgba(234, 201, 123, 0.06)";
          appendHeader(tr, isActive ? `${row.lord} · active` : row.lord, "row");
          appendCell(tr, devNum(row.years));
          // देवनागरी प्रदर्श of the same computed formula (digits/words transliterated, values untouched)
          const devFormula = devNum(String(row.formula).replace(/varsh/g, "वर्ष").replace(/shvas/g, "श्वास").replace(/ x /g, " × "));
          appendCell(tr, devFormula, isActive ? "accent" : "");
          breathBody.appendChild(tr);
        }
      }
    }
  }

  // D=9 जन्म-जालक · Natal-ID — 27³ lattice address from the CURRENT computed
  // Sun/Moon/Lagna nakṣatra indices (KOSH). No fabricated fallback values.
  function renderNatalId(planets, siderealAscendant) {
    const cellEl = $("natal-cell");
    if (!cellEl) return;
    const zoneEl = $("natal-zone");
    const coordsEl = $("natal-coords");
    const indicesEl = $("natal-indices");
    const drEl = $("natal-digitroot");
    const sealEl = $("natal-seal");

    if (typeof M.computeNatalId !== "function") {
      cellEl.textContent = "unavailable — computeNatalId export missing";
      if (zoneEl) zoneEl.textContent = "—";
      if (coordsEl) coordsEl.textContent = "—";
      if (indicesEl) indicesEl.textContent = "—";
      if (drEl) drEl.textContent = "—";
      if (sealEl) sealEl.textContent = "—";
      return;
    }

    const sun = planets.find((g) => g.key === "surya");
    const moon = planets.find((g) => g.key === "candra");
    if (!sun || !moon) throw new Error("Natal-ID requires canonical Sun and Moon rows.");
    const sunNak = M.computeNakshatraDetails(sun.longitude).index;
    const moonNak = M.computeNakshatraDetails(moon.longitude).index;
    const lagnaNak = M.computeNakshatraDetails(siderealAscendant).index;
    const id = M.computeNatalId(sunNak, moonNak, lagnaNak);

    cellEl.textContent = `${id.cell.toLocaleString("en-IN")} / ${id.latticeCells.toLocaleString("en-IN")}`;
    if (zoneEl) zoneEl.innerHTML = `<span class="badge badge-gold">${id.zone}</span> · ${id.activeAxes}/9 axes active`;
    if (coordsEl) coordsEl.textContent = `(${id.coords.sun.join(",")}) · (${id.coords.moon.join(",")}) · (${id.coords.lagna.join(",")})`;
    if (indicesEl) indicesEl.textContent = `Sūrya ${sunNak} · Candra ${moonNak} · Lagna ${lagnaNak}`;
    if (drEl) drEl.textContent = `${id.digitRoot} · ${id.resonance ? "3-6-9 resonance ✓" : "no 3-6-9 resonance"}`;
    if (sealEl) sealEl.textContent = `(${id.seal}) 729·${sunNak} + 27·${moonNak} + ${lagnaNak} = ${id.cell}`;

    // Payload for the share-card — every field is the live computed value above.
    lastNatalShare = {
      cell: id.cell,
      latticeCells: id.latticeCells,
      zone: id.zone,
      activeAxes: id.activeAxes,
      digitRoot: id.digitRoot,
      seal: id.seal,
      sunNak, moonNak, lagnaNak,
    };
  }

  // ── Natal-ID share-card (canvas, black/gold) — all values computed live ──
  function natalShareText() {
    if (!lastNatalShare) return null;
    const n = lastNatalShare;
    return `मेरा वैदिक Natal-ID: cell ${n.cell}/${n.latticeCells} · अक्ष ${n.activeAxes}/9 · D=9 जालक — तुम्हारा क्या है? bharatephemeris.org`;
  }

  function drawNatalShareCard() {
    if (!lastNatalShare) return null;
    const n = lastNatalShare;
    const W = 1200, H = 630;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    // dark-oracle background
    ctx.fillStyle = "#03060e";
    ctx.fillRect(0, 0, W, H);
    const grad = ctx.createRadialGradient(W / 2, 0, 60, W / 2, 0, H);
    grad.addColorStop(0, "rgba(234,201,123,0.14)");
    grad.addColorStop(1, "rgba(234,201,123,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(234,201,123,0.55)";
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.textAlign = "center";
    ctx.fillStyle = "#eac97b";
    ctx.font = "700 44px Georgia, 'Noto Serif Devanagari', serif";
    ctx.fillText("मेरा वैदिक Natal-ID · D=9 जन्म-जालक", W / 2, 120);
    ctx.font = "700 86px Georgia, serif";
    ctx.fillStyle = "#f0d47d";
    ctx.fillText(`cell ${n.cell} / ${n.latticeCells}`, W / 2, 250);
    ctx.font = "40px Georgia, serif";
    ctx.fillStyle = "#c8b06a";
    ctx.fillText(`${n.zone} क्षेत्र · अक्ष ${n.activeAxes}/9 · digit-root ${n.digitRoot}`, W / 2, 330);
    ctx.font = "32px monospace";
    ctx.fillStyle = "#8fa3ad";
    ctx.fillText(`729·${n.sunNak} + 27·${n.moonNak} + ${n.lagnaNak} = ${n.cell} (${n.seal})`, W / 2, 400);
    ctx.font = "700 36px Georgia, serif";
    ctx.fillStyle = "#eac97b";
    ctx.fillText("तुम्हारा क्या है? → bharatephemeris.org", W / 2, 490);
    ctx.font = "26px Georgia, serif";
    ctx.fillStyle = "#7f8a91";
    ctx.fillText("गणना घोषित है — भाग्य नहीं। · computed offline in the browser", W / 2, 560);
    return c;
  }

  function initNatalShareControls() {
    const shareBtn = $("natal-share-btn");
    const copyBtn = $("natal-copy-btn");
    const statusEl = $("natal-share-status");
    const say = (t) => { if (statusEl) { statusEl.textContent = t; setTimeout(() => { statusEl.textContent = ""; }, 4000); } };
    if (shareBtn && !shareBtn._hasListener) {
      shareBtn._hasListener = true;
      shareBtn.addEventListener("click", () => {
        const canvas = drawNatalShareCard();
        if (!canvas) { say("पहले compute चलाओ — share-card जीवित गणना से बनता है"); return; }
        canvas.toBlob((blob) => {
          if (!blob) { say("PNG बन नहीं सका"); return; }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `natal-id-${lastNatalShare.cell}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          say("PNG download हुआ ✓");
        }, "image/png");
      });
    }
    if (copyBtn && !copyBtn._hasListener) {
      copyBtn._hasListener = true;
      copyBtn.addEventListener("click", () => {
        const text = natalShareText();
        if (!text) { say("पहले compute चलाओ"); return; }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => say("text कॉपी हुआ ✓"), () => say("clipboard अनुपलब्ध"));
        } else say("clipboard अनुपलब्ध");
      });
    }
  }

  // Kerala dṛk-saṃskāra overlay (Mādhava–Nīlakaṇṭha) — off by default per
  // SANKALP BE-S03: classical = product identity. Rendered only when toggled on.
  function renderKeralaDrik(jd) {
    const toggle = $("kerala-drik-toggle");
    const wrap = $("kerala-drik-wrap");
    const tbody = $("kerala-drik-tbody");
    if (!toggle || !wrap || !tbody) return;
    wrap.style.display = toggle.checked ? "" : "none";
    if (!toggle.checked) return;

    const lineageEl = $("kerala-drik-lineage");
    tbody.replaceChildren();
    if (typeof M.keralaDrikSphuta !== "function" || jd == null) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5" style="color: var(--red);">overlay unavailable — keralaDrikSphuta missing; refusing substitutes.</td>`;
      tbody.appendChild(tr);
      if (lineageEl) lineageEl.textContent = "";
      return;
    }
    const k = M.keralaDrikSphuta(jd);
    const drik = (window.DrikTier && window.DrikTier.available()) ? window.DrikTier.grahas(jd, controls.ayanamsha.value) : null;
    const wrapA = (d) => { let x = ((d % 360) + 360) % 360; if (x > 180) x -= 360; return x; };
    const NAMES = { surya: "सूर्य", candra: "चन्द्र", mangala: "मङ्गल", budha: "बुध", shukra: "शुक्र", guru: "गुरु", shani: "शनि", rahu: "राहु", ketu: "केतु" };
    for (const key of ["surya", "candra", "mangala", "budha", "shukra", "guru", "shani", "rahu", "ketu"]) {
      const row = k[key];
      const tr = document.createElement("tr");
      appendHeader(tr, NAMES[key], "row");
      appendCell(tr, `${row.classical.toFixed(4)}°`);
      appendCell(tr, `${row.samskrita.toFixed(4)}° ±${row.rmsArcmin}′`, "accent");
      if (drik) {
        const dv = drik[key];
        const dArc = wrapA(row.samskrita - dv) * 60;
        appendCell(tr, `${dv.toFixed(4)}°`);
        appendCell(tr, `${dArc >= 0 ? "+" : ""}${dArc.toFixed(1)}′`);
      } else {
        appendCell(tr, "दृक्-tier absent");
        appendCell(tr, "—");
      }
      tbody.appendChild(tr);
    }
    // राहु/केतु PathBhang note — the node discrepancy is computed live from the
    // very rows above (SS-node vs दृक्-node), दोनों पथ दर्ज।
    if (drik && k.rahu && Number.isFinite(k.rahu.classical)) {
      const nodeDiffDeg = Math.abs(wrapA(k.rahu.classical - drik.rahu));
      const pathTr = document.createElement("tr");
      pathTr.innerHTML = `<th scope="row">पथ-भेद</th><td colspan="4" style="color: var(--gold);">राहु/केतु: SS-node vs दृक्-node पथ-भेद ${nodeDiffDeg.toFixed(2)}° (इसी सारणी से computed) — दोनों पथ दर्ज (PathBhang)</td>`;
      tbody.appendChild(pathTr);
    }
    const noteTr = document.createElement("tr");
    noteTr.innerHTML = `<th scope="row">अगला पर्वत</th><td colspan="4" style="color: var(--soft);">${k.pending.note}</td>`;
    tbody.appendChild(noteTr);
    if (lineageEl) lineageEl.textContent = `${k.lineage} · ${k.seal}` + (drik ? ` · दृक्-tier: ${drik.tier}` : "");
  }

  function renderCoordinateCodec(latitudeText, longitudeText) {
    const payload = M.encodeCoordinatePair(latitudeText, longitudeText);
    const decoded = M.decodeCoordinatePair(payload);
    $("codec-payload").value = payload;
    $("codec-decoded").textContent = `${decoded.latitude}, ${decoded.longitude}`;
  }

  function modeRateArcsecPerYear(jd, mode) {
    if (typeof M.ayanamshaRateArcsecPerYear === "function") {
      const rate = M.ayanamshaRateArcsecPerYear(jd, mode);
      if (Number.isFinite(rate)) return rate;
    }
    if (mode === "effective_49") return M.precessionRates().effectiveArcsecPerYear;
    if (mode === "linear_54") return 54;
    if (mode === "linear_50") return 50;
    if (mode === "sinusoidal_27") {
      const years = (jd - M.ARYABHATA_ZERO_JD) / 365.25;
      return 27 * (2 * Math.PI / 7200) * Math.cos(2 * Math.PI * years / 7200) * 3600;
    }
    throw new Error(`Unknown ayanāṃśa mode '${mode}'`);
  }

  function validateRequiredControl(control, message) {
    const valid = control.value.trim() !== "" && control.validity.valid;
    control.setAttribute("aria-invalid", String(!valid));
    $(`${control.id}-error`).textContent = valid ? "" : message;
    return valid;
  }

  function parseBoundedControl(control, name, minimum, maximum, errors) {
    const value = Number(control.value);
    const valid = control.value.trim() !== "" && Number.isFinite(value) && value >= minimum && value <= maximum;
    control.setAttribute("aria-invalid", String(!valid));
    const error = $(`${control.id}-error`);
    error.textContent = valid ? "" : `${name} must be between ${minimum} and ${maximum}.`;
    if (!valid) errors.push({ control, message: error.textContent });
    return value;
  }

  function validateInputs() {
    const errors = [];
    if (!validateRequiredControl(controls.date, "Enter a valid date.")) errors.push({ control: controls.date, message: "Enter a valid date." });
    if (!validateRequiredControl(controls.time, "Enter a valid local civil time.")) errors.push({ control: controls.time, message: "Enter a valid local civil time." });
    const values = {
      timezone: parseBoundedControl(controls.timezone, "UTC offset", -14, 14, errors),
      latitude: parseBoundedControl(controls.latitude, "Latitude", -89.999999, 89.999999, errors),
      longitude: parseBoundedControl(controls.longitude, "Longitude", -180, 180, errors),
    };
    if (errors.length) {
      const error = new Error(`${errors.length} field${errors.length === 1 ? "" : "s"} require attention. ${errors[0].message}`);
      error.control = errors[0].control;
      throw error;
    }
    return values;
  }

  function renderShunyabhedaForensics(jd, timezone, planets, siderealAscendant, bhava) {
    const moon = planets.find((g) => g.key === "candra") || { longitude: 0 };
    const sun = planets.find((g) => g.key === "surya") || { longitude: 0 };
    const rahu = planets.find((g) => g.key === "rahu") || { longitude: 0 };

    // 1. Tithi-Dagdha — no fabricated fallback lists: unavailable is stated plainly.
    const lunar = M.mod360(moon.longitude - sun.longitude);
    const tithiNum = Math.floor(lunar / 12) + 1;
    const panchang = M.panchangAtJd ? M.panchangAtJd(jd, timezone) : { tithiName: `Tithi ${tithiNum}` };
    const dagdha = typeof M.computeTithiDagdha === "function" ? M.computeTithiDagdha(tithiNum) : null;

    const dagdhaEl = $("dagdhaTithiName");
    const dagdhaListEl = $("dagdhaRashisList");
    const dagdhaStatusEl = $("dagdhaPlanetsStatus");

    if (dagdhaEl) dagdhaEl.textContent = `Tithi ${tithiNum}: ${panchang.tithiName || `Tithi ${tithiNum}`}`;

    if (!dagdha) {
      if (dagdhaListEl) dagdhaListEl.textContent = "Dagdha data unavailable — computeTithiDagdha export missing.";
      if (dagdhaStatusEl) {
        dagdhaStatusEl.style.color = "var(--red)";
        dagdhaStatusEl.textContent = "Unavailable: refusing to display substitute void-sign lists.";
      }
    } else {
      if (dagdhaListEl) dagdhaListEl.textContent = dagdha.dagdhaRashis.length ? `Dagdha Void Signs: ${dagdha.dagdhaRashis.join(", ")}` : "No Dagdha (Sampurna Tithi)";

      const trappedPlanets = planets.filter((p) => {
        const s = M.RASHIS[M.signIndex(p.longitude)];
        return dagdha.dagdhaRashis.includes(s);
      });

      if (dagdhaStatusEl) {
        if (trappedPlanets.length > 0) {
          dagdhaStatusEl.style.color = "var(--red)";
          dagdhaStatusEl.textContent = `⚠️ Void Trapped Grahas: ${trappedPlanets.map((p) => `${p.sa} (${M.RASHIS[M.signIndex(p.longitude)]})`).join(", ")}`;
        } else {
          dagdhaStatusEl.style.color = "var(--green)";
          dagdhaStatusEl.textContent = `✓ No Grahas afflicted by Tithi-Dagdha void in radix.`;
        }
      }
    }

    // 2. Bhrigu Bindu — no hardcoded 68.75° fallback: unavailable is stated plainly.
    const bbLocEl = $("bbLocation");
    const bbNakEl = $("bbNakshatra");
    const bbHouseEl = $("bbHouseStatus");

    if (typeof M.computeBhriguBindu !== "function") {
      if (bbLocEl) bbLocEl.textContent = "Bhrigu Bindu unavailable — computeBhriguBindu export missing.";
      if (bbNakEl) bbNakEl.textContent = "Nakshatra: —";
      if (bbHouseEl) bbHouseEl.textContent = "No axis computed: refusing to display substitute coordinates.";
    } else {
      const bb = M.computeBhriguBindu(rahu.longitude, moon.longitude);
      if (bbLocEl) bbLocEl.textContent = `BB Axis: ${bb.rashi} ${formatDegrees(bb.rashiDeg)}`;
      if (bbNakEl) bbNakEl.textContent = `Nakshatra: ${bb.nakshatra} (Pada ${bb.pada}) · Abs: ${bb.longitude.toFixed(4)}°`;

      const ascSignIdx = M.signIndex(siderealAscendant);
      const bbHouse = ((bb.rashiIndex - ascSignIdx + 12) % 12) + 1;
      if (bbHouseEl) bbHouseEl.textContent = `Destiny Pivot falls in House ${bbHouse} from Lagna (${bb.rashi}).`;
    }

    // 3. Indu Lagna — no fabricated ray-count fallback: unavailable is stated plainly.
    const induSignEl = $("induLagnaSign");
    const induRaysEl = $("induRaysMath");
    const induOccEl = $("induOccupantsStatus");

    if (typeof M.computeInduLagna !== "function") {
      if (induSignEl) induSignEl.textContent = "Indu Lagna unavailable — computeInduLagna export missing.";
      if (induRaysEl) induRaysEl.textContent = "9th Lords Ray Sum: —";
      if (induOccEl) induOccEl.textContent = "Unavailable: refusing to display substitute ray counts.";
    } else {
      const indu = M.computeInduLagna(siderealAscendant, moon.longitude);
      if (induSignEl) induSignEl.textContent = `Indu Lagna: ${indu.induLagnaRashi}`;
      if (induRaysEl) induRaysEl.textContent = `9th Lords Rays: Lagna (${indu.lagnaRays}) + Chandra (${indu.moonRays}) = ${indu.totalRays} rays`;

      const induPlanets = planets.filter((p) => M.RASHIS[M.signIndex(p.longitude)] === indu.induLagnaRashi);
      if (induOccEl) {
        if (induPlanets.length > 0) {
          induOccEl.textContent = `🌟 Wealth Occupants: ${induPlanets.map((p) => p.sa).join(", ")} residing in Indu Lagna.`;
        } else {
          induOccEl.textContent = `Indu Lagna unaspected in radix · Evaluated via 9th Lord resonance.`;
        }
      }
    }

    // 4. Chalit Outflow Shifts
    const chalitListEl = $("chalitShiftsList");
    const chalitBadgeEl = $("chalitShiftCountBadge");
    if (chalitListEl && bhava && bhava.grahas) {
      chalitListEl.innerHTML = "";
      const shifted = bhava.grahas.filter((g) => g.wholeSignBhava !== g.bhava);
      if (chalitBadgeEl) chalitBadgeEl.textContent = `${shifted.length} House Shifts Detected`;

      if (shifted.length === 0) {
        chalitListEl.innerHTML = `<div style="color:var(--green); grid-column: 1/-1;">✓ Zero Chalit shifts: All whole-sign house placements match the unequal quadrant cusps.</div>`;
      } else {
        shifted.forEach((g) => {
          const is12thOutflow = g.bhava === 12 && g.wholeSignBhava === 11;
          const card = document.createElement("div");
          card.style.background = is12thOutflow ? "rgba(255, 155, 155, 0.08)" : "rgba(255, 255, 255, 0.02)";
          card.style.border = `1px solid ${is12thOutflow ? "var(--red)" : "var(--line)"}`;
          card.style.borderRadius = "4px";
          card.style.padding = "8px 10px";
          const longVal = Number(g.longitude || 0).toFixed(2);
          const offsetVal = Number(g.bhavaOffset || 0).toFixed(2);
          card.innerHTML = `
            <div style="font-weight:700; color:${is12thOutflow ? "var(--red)" : "var(--gold)"};">${g.sa || g.key} (${g.en || ""}): H${g.wholeSignBhava} → H${g.bhava} Chalit</div>
            <div style="font-size:0.72rem; color:var(--soft); margin-top:2px;">
              λ = ${longVal}° · Madhya offset: ${offsetVal}°
              ${is12thOutflow ? '<br><strong style="color:var(--red);">⚠️ 12th-cusp shift — शास्त्र-वचन में व्यय-संकेत (SHASTRA-SMRIT)।</strong>' : ""}
            </div>
          `;
          chalitListEl.appendChild(card);
        });
      }
    }
  }

  // Global Export Handlers
  window.exportComputationalJson = function() {
    const { timezone, latitude, longitude } = validateInputs();
    const mode = controls.ayanamsha.value;
    const jd = M.gregorianToJulianDay(controls.date.value, controls.time.value, timezone);
    const planets = canonicalGrahaRows(jd);
    const siderealAsc = M.siderealAscendantDeg(jd, latitude, longitude, mode);
    const bhava = M.bhavaModel(jd, latitude, longitude, mode);

    const exportData = {
      generator: "ShunyaMath local engine (Surya-Siddhanta canonical)",
      timestamp_utc: new Date().toISOString(),
      inputs: {
        date: controls.date.value,
        time: controls.time.value,
        timezone,
        latitude,
        longitude,
        ayanamsha_mode: mode,
        julian_day: jd,
      },
      ascendant: {
        sidereal_deg: siderealAsc,
        rashi: M.RASHIS[M.signIndex(siderealAsc)],
      },
      graha_longitudes: planets.map((p) => ({
        key: p.key,
        sa: p.sa,
        en: p.en,
        longitude_deg: p.longitude,
        rashi: M.RASHIS[M.signIndex(p.longitude)],
        rashi_deg: M.mod360(p.longitude) % 30,
      })),
      bhavas_spans: bhava.bhavas,
      forensics: {
        tithi_dagdha: M.computeTithiDagdha ? M.computeTithiDagdha(Math.floor(M.mod360((planets.find(p=>p.key==='candra')?.longitude || 0) - (planets.find(p=>p.key==='surya')?.longitude || 0)) / 12) + 1) : null,
        bhrigu_bindu: M.computeBhriguBindu ? M.computeBhriguBindu(planets.find(p=>p.key==='rahu')?.longitude || 0, planets.find(p=>p.key==='candra')?.longitude || 0) : null,
        indu_lagna: M.computeInduLagna ? M.computeInduLagna(siderealAsc, planets.find(p=>p.key==='candra')?.longitude || 0) : null,
      },
      verification_proof: {
        panini_hash_of_inputs: M.paniniHash ? M.paniniHash(`EXPORT:${jd}:${mode}`, 16) : null,
        bitwise_determinism: computeBitwiseDeterminism(jd)
          ? "PASS (two independent recomputes byte-identical)"
          : "FAIL (recomputes diverged)",
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Bharat_Ephemeris_Sphuta_${controls.date.value}_${controls.time.value.replace(/:/g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  window.exportEphemerisCsv = function() {
    const { timezone, latitude, longitude } = validateInputs();
    const mode = controls.ayanamsha.value;
    const jd = M.gregorianToJulianDay(controls.date.value, controls.time.value, timezone);
    const planets = canonicalGrahaRows(jd);
    const siderealAsc = M.siderealAscendantDeg(jd, latitude, longitude, mode);

    const velocities = M.computePlanetaryVelocities ? M.computePlanetaryVelocities(jd) : [];
    let csv = "Graha,Sanskrit,Longitude_Deg,Rashi,Rashi_Deg,Speed_Deg_Day\n";
    csv += `Lagna,लग्न,${siderealAsc.toFixed(6)},${M.RASHIS[M.signIndex(siderealAsc)]},${(siderealAsc % 30).toFixed(4)},\n`;

    planets.forEach((p) => {
      const sIdx = M.signIndex(p.longitude);
      const within = (M.mod360(p.longitude) % 30).toFixed(4);
      const vel = velocities.find((v) => v.key === p.key);
      const speed = vel && Number.isFinite(vel.speedDegDay) ? vel.speedDegDay.toFixed(4) : "";
      csv += `${p.en},${p.sa},${p.longitude.toFixed(6)},${M.RASHIS[sIdx]},${within},${speed}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Bharat_Ephemeris_${controls.date.value}_Positions.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ══════════════════════════════════════════════════════════════════════
  // LIVE REAL-TIME GOCHARA (TRANSIT) & DUAL-MATRIX SYNTHESIS ENGINE
  // ══════════════════════════════════════════════════════════════════════
  const AUSPICIOUS_GOCHARA_HOUSES = Object.freeze({
    surya: [3, 6, 10, 11],
    candra: [1, 3, 6, 7, 10, 11],
    mangala: [3, 6, 11],
    budha: [2, 4, 6, 8, 10, 11],
    guru: [2, 5, 7, 9, 11],
    shukra: [1, 2, 3, 4, 5, 8, 9, 11, 12],
    shani: [3, 6, 11],
    rahu: [3, 6, 11],
    ketu: [3, 6, 11],
  });

  function getGocharaReading(grahaKey, hMoon, hLagna, aspectName, diffDeg) {
    switch (grahaKey) {
      case "surya":
        if ([3, 6, 10, 11].includes(hMoon)) {
          return `🌟 <strong>Auspicious Transit (H${hMoon} from Moon):</strong> Enhanced executive authority, administrative victory, professional recognition, and vitality boost.`;
        }
        return `⚠️ <strong>Challenging Transit (H${hMoon} from Moon):</strong> Potential ego friction with superiors; maintain diplomatic communication and monitor vitality.`;

      case "candra":
        if ([1, 3, 6, 7, 10, 11].includes(hMoon)) {
          return `✨ <strong>Favorable Lunar Flow (H${hMoon} from Moon):</strong> Emotional clarity, active social synergy, high public receptivity, and mental peace.`;
        }
        return `🌧️ <strong>Transient Lunar Pressure (H${hMoon} from Moon):</strong> Brief emotional fluctuation; prioritize grounded reflection and avoid impulsive mood-based calls.`;

      case "mangala":
        if ([3, 6, 11].includes(hMoon)) {
          return `⚔️ <strong>Upachaya Dominance (H${hMoon} from Moon):</strong> Competitive supremacy, decisive tactical execution, technical and property breakthrough.`;
        }
        if (hMoon === 8) {
          return `🛡️ <strong>Ashtama Mangala Warning (H8 from Moon):</strong> Exercise strict physical vigilance, avoid reckless speed, and temper sudden aggressive impulses.`;
        }
        return `⚡ <strong>Active Energy (H${hMoon} from Moon):</strong> Channel surplus drive into physical exercise or focused technical problem-solving.`;

      case "budha":
        if ([2, 4, 6, 8, 10, 11].includes(hMoon)) {
          return `📈 <strong>Commercial Acumen (H${hMoon} from Moon):</strong> Sharp analytical focus, profitable trades, lucid contract negotiations, and agile learning.`;
        }
        return `📝 <strong>Analytical Caution (H${hMoon} from Moon):</strong> Double-verify document clauses, verify fiscal spreadsheets, and minimize ambiguous messaging.`;

      case "guru":
        if ([2, 5, 7, 9, 11].includes(hMoon)) {
          return `👑 <strong>Divine Grace & Expansion (H${hMoon} from Moon):</strong> शास्त्र-वचन में धन-भाव-पोषण, philosophical clarity, and auspicious mentorship.`;
        }
        return `⚖️ <strong>Internal Wisdom Gestation (H${hMoon} from Moon):</strong> Strategic restructuring of assets; exercise prudent capital patience rather than over-expansion.`;

      case "shukra":
        if ([1, 2, 3, 4, 5, 8, 9, 11, 12].includes(hMoon)) {
          return `💎 <strong>Harmonious Radiance (H${hMoon} from Moon):</strong> Creative abundance, social grace, aesthetic appreciation, and relational fulfillment.`;
        }
        return `🎭 <strong>Diplomatic Prudence (H${hMoon} from Moon):</strong> Moderate sensory and luxury outlays; maintain balanced interpersonal boundaries.`;

      case "shani":
        if ([12, 1, 2].includes(hMoon)) {
          const phase = hMoon === 12 ? "Rising" : hMoon === 1 ? "Peak" : "Setting";
          return `🪐 <strong>SADE SATI (${phase} Phase):</strong> Profound karmic restructuring, foundational maturity test, requires perseverance and unswerving integrity.`;
        }
        if ([3, 6, 11].includes(hMoon)) {
          return `🏆 <strong>Shani Upachaya Victory (H${hMoon} from Moon):</strong> Massive enduring material gains, institutional authority, overcoming longstanding obstacles.`;
        }
        if (hMoon === 4) return `🏰 <strong>Kantaka Shani (H4 from Moon):</strong> Domestic patience required; prioritize mental stillness and home/property maintenance.`;
        if (hMoon === 8) return `🌊 <strong>Ashtama Shani (H8 from Moon):</strong> Deep transformative crucible; eliminate fiscal liabilities and practice health vigilance.`;
        return `⏳ <strong>Methodical Discipline (H${hMoon} from Moon):</strong> Steady, patient perseverance yields durable long-term stability.`;

      case "rahu":
        if ([3, 6, 11].includes(hMoon)) {
          return `🚀 <strong>Unconventional Breakthrough (H${hMoon} from Moon):</strong> Lateral thinking gains, rapid technological scaling, high strategic expansion.`;
        }
        return `🌀 <strong>Karmic Disruption Zone (H${hMoon} from Moon):</strong> Guard against speculative illusions; anchor all major decisions in empirical data.`;

      case "ketu":
        if ([3, 6, 11].includes(hMoon)) {
          return `🧘 <strong>Intuitive Mastery (H${hMoon} from Moon):</strong> Sharp spiritual discernment, effortless cutting of obsolete ties, decisive clarity.`;
        }
        return `🌌 <strong>Inward Transcendence (H${hMoon} from Moon):</strong> Period of detachment and non-attachment; ideal for deep technical research and spiritual sadhana.`;

      default:
        return `Neutral transit vector.`;
    }
  }

  function getAspectDescription(diffDeg) {
    if (diffDeg <= 6) return { name: "Yuti (Conjunction 0°)", icon: "☌", color: "var(--gold)" };
    if (diffDeg >= 174) return { name: "Pratiyuti (Opposition 180°)", icon: "☍", color: "var(--red)" };
    if (diffDeg >= 114 && diffDeg <= 126) return { name: "Trikona (Trine 120°)", icon: "△", color: "var(--green)" };
    if (diffDeg >= 84 && diffDeg <= 96) return { name: "Kendra (Square 90°)", icon: "□", color: "var(--cyan)" };
    if (diffDeg >= 56 && diffDeg <= 64) return { name: "Sextile (60°)", icon: "⚹", color: "var(--green)" };
    return { name: `Offset ${diffDeg.toFixed(1)}°`, icon: "∠", color: "var(--soft)" };
  }

  let gocharaInitialized = false;
  function initGocharaInputs() {
    const dEl = $("gochara-date");
    const tEl = $("gochara-time");
    const syncBtn = $("gochara-sync-now");
    if (!dEl || !tEl) return;

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    const ss = pad(now.getSeconds());

    if (!dEl.value) dEl.value = `${yyyy}-${mm}-${dd}`;
    if (!tEl.value) tEl.value = `${hh}:${min}:${ss}`;

    if (!gocharaInitialized) {
      if (syncBtn) {
        syncBtn.addEventListener("click", () => {
          const liveNow = new Date();
          dEl.value = `${liveNow.getFullYear()}-${pad(liveNow.getMonth() + 1)}-${pad(liveNow.getDate())}`;
          tEl.value = `${pad(liveNow.getHours())}:${pad(liveNow.getMinutes())}:${pad(liveNow.getSeconds())}`;
          render();
        });
      }
      dEl.addEventListener("input", render);
      tEl.addEventListener("input", render);
      gocharaInitialized = true;
    }
  }

  function renderLiveGochara(natalPlanets, natalAscendant, natalJd, timezone, latitude, longitude, mode) {
    const dEl = $("gochara-date");
    const tEl = $("gochara-time");
    if (!dEl || !dEl.value || !tEl || !tEl.value) initGocharaInputs();

    const tDate = dEl ? dEl.value : "2026-08-14";
    const tTime = tEl ? tEl.value : "12:00:00";
    const tJd = M.gregorianToJulianDay(tDate, tTime, timezone);
    const tPlanets = canonicalGrahaRows(tJd);
    const tAsc = M.siderealAscendantDeg(tJd, latitude, longitude, mode);

    const jdEl = $("gochara-jd-value");
    const lagnaEl = $("gochara-lagna-value");
    if (jdEl) jdEl.textContent = tJd.toFixed(6);
    if (lagnaEl) lagnaEl.textContent = `${M.RASHIS[M.signIndex(tAsc)]} ${formatDegrees(tAsc % 30, 2)}`;

    // 1. Radix D1 Kundali
    const radixContainer = $("chart-radix-container");
    if (radixContainer) {
      const radixRow = [{ key: "lagna", sa: "ल", en: "Lagna", isLagna: true, text: "ल", color: "#f0d47d", sign: M.signIndex(natalAscendant) }];
      natalPlanets.forEach((g) => {
        radixRow.push({ key: g.key, sa: g.sa, en: g.en, isLagna: false, text: g.sa.replace("ः", ""), color: "#f0d47d", sign: M.signIndex(g.longitude) });
      });
      radixContainer.innerHTML = vargaChartSvg({ code: "Janma", name: "Radix D1" }, radixRow);
    }

    // 2. Live Gochara D1 Kundali
    const gocharaContainer = $("chart-gochara-container");
    if (gocharaContainer) {
      const gocharaRow = [{ key: "lagna", sa: "ल", en: "Lagna", isLagna: true, text: "लᵗ", color: "#00e5ff", sign: M.signIndex(tAsc) }];
      tPlanets.forEach((g) => {
        gocharaRow.push({ key: g.key, sa: g.sa, en: g.en, isLagna: false, text: g.sa.replace("ः", "") + "ᵗ", color: "#00e5ff", sign: M.signIndex(tAsc) });
      });
      gocharaContainer.innerHTML = vargaChartSvg({ code: "Gochara", name: "Live Transit D1" }, gocharaRow);
    }

    // 3. Composite Superimposed Kundali
    const compositeContainer = $("chart-composite-container");
    if (compositeContainer) {
      const compRow = [
        { key: "lagna", sa: "ल", en: "Lagna", isLagna: true, text: "ल", color: "#f0d47d", sign: M.signIndex(natalAscendant) },
        { key: "lagna_t", sa: "लᵗ", en: "Transit Lagna", isLagna: true, text: "लᵗ", color: "#00e5ff", sign: M.signIndex(tAsc) }
      ];
      natalPlanets.forEach((g) => {
        compRow.push({ key: g.key, sa: g.sa, en: g.en, isLagna: false, text: g.sa.replace("ः", ""), color: "#f0d47d", sign: M.signIndex(g.longitude) });
      });
      tPlanets.forEach((g) => {
        compRow.push({ key: g.key + "_t", sa: g.sa + "ᵗ", en: "Transit " + g.en, isLagna: false, text: g.sa.replace("ः", "") + "ᵗ", color: "#00e5ff", sign: M.signIndex(g.longitude) });
      });
      compositeContainer.innerHTML = vargaChartSvg({ code: "Composite", name: "Janma + Gochara Overlay" }, compRow);
    }

    // 4. Combined Diagnostic Matrix Table
    const tableBody = $("gochara-matrix-body");
    if (!tableBody) return;
    tableBody.replaceChildren();

    const natalMoon = natalPlanets.find((p) => p.key === "candra") || { longitude: 0 };
    const natalMoonSign = M.signIndex(natalMoon.longitude);
    const natalAscSign = M.signIndex(natalAscendant);

    tPlanets.forEach((tp) => {
      const np = natalPlanets.find((p) => p.key === tp.key) || { longitude: 0, sa: tp.sa, en: tp.en };
      const nSign = M.signIndex(np.longitude);
      const tSign = M.signIndex(tp.longitude);

      const hLagna = ((tSign - natalAscSign + 12) % 12) + 1;
      const hMoon = ((tSign - natalMoonSign + 12) % 12) + 1;

      let angleDiff = Math.abs(M.mod360(tp.longitude - np.longitude));
      if (angleDiff > 180) angleDiff = 360 - angleDiff;

      const aspect = getAspectDescription(angleDiff);
      const isGood = (AUSPICIOUS_GOCHARA_HOUSES[tp.key] || []).includes(hMoon);
      // janma-gate: until the user actually enters a janma epoch in the
      // Instrument, natal == "now" and every self-separation is a meaningless
      // 0.00° conjunction — so the शास्त्र-संकेत column stays gated.
      const reading = janmaEntered
        ? getGocharaReading(tp.key, hMoon, hLagna, aspect.name, angleDiff) + ` <span style="color:var(--soft); font-size:0.68rem;">(SHASTRA-SMRIT — व्याख्या, विधि-वाक्य नहीं)</span>`
        : `<span style="color:var(--soft);">janma दर्ज करो — ऊपर Instrument में जन्म-दिनांक/समय भरो, तभी शास्त्र-संकेत दिखेंगे। (अभी natal = वर्तमान क्षण ही है, इसलिए तुलना निरर्थक है)</span>`;

      const row = document.createElement("tr");

      // Graha
      const cellGraha = document.createElement("th");
      cellGraha.scope = "row";
      cellGraha.style.whiteSpace = "nowrap";
      cellGraha.innerHTML = `<strong>${tp.sa}</strong> <span style="font-size:0.75rem; color:var(--soft);">${tp.en}</span>`;
      row.appendChild(cellGraha);

      // Janma Radix
      const cellRadix = document.createElement("td");
      cellRadix.style.fontFamily = "var(--mono)";
      cellRadix.innerHTML = `<span style="color:var(--gold); font-weight:700;">${M.RASHIS[nSign]}</span> ${(np.longitude % 30).toFixed(2)}°<br><span style="font-size:0.7rem; color:var(--soft);">H${((nSign - natalAscSign + 12) % 12) + 1} from Lagna</span>`;
      row.appendChild(cellRadix);

      // Live Gochara
      const cellTransit = document.createElement("td");
      cellTransit.style.fontFamily = "var(--mono)";
      cellTransit.innerHTML = `<span style="color:var(--cyan); font-weight:700;">${M.RASHIS[tSign]}</span> ${(tp.longitude % 30).toFixed(2)}°<br><span style="font-size:0.7rem; color:var(--soft);">Abs: ${tp.longitude.toFixed(2)}°</span>`;
      row.appendChild(cellTransit);

      // House reckoning
      const cellHouse = document.createElement("td");
      cellHouse.innerHTML = `<div><strong style="color:var(--gold);">H${hLagna}</strong> from Lagna</div><div style="font-size:0.76rem;"><strong style="color:var(--cyan);">H${hMoon}</strong> from Moon</div>`;
      row.appendChild(cellHouse);

      // Separation & Aspect
      const cellAspect = document.createElement("td");
      cellAspect.innerHTML = `<div style="font-family:var(--mono); color:${aspect.color}; font-weight:700;">${aspect.icon} ${aspect.name}</div><div style="font-size:0.72rem; color:var(--soft);">Δθ = ${angleDiff.toFixed(2)}°</div>`;
      row.appendChild(cellAspect);

      // Status
      const cellStatus = document.createElement("td");
      cellStatus.innerHTML = isGood
        ? `<span class="badge badge-green" style="font-size:0.7rem; padding:3px 6px;">✓ Shubha Gochara</span>`
        : `<span class="badge" style="font-size:0.7rem; padding:3px 6px; background:rgba(255,155,155,0.1); color:var(--red); border:1px solid var(--red);">⚠️ Vedha / Friction</span>`;
      row.appendChild(cellStatus);

      // शास्त्र-संकेत cell (janma-gated)
      const cellReading = document.createElement("td");
      cellReading.style.fontSize = "0.78rem";
      cellReading.style.lineHeight = "1.4";
      cellReading.innerHTML = reading;
      row.appendChild(cellReading);

      tableBody.appendChild(row);
    });

    // 5. Live Daśā Dual-Engine: Vimśottarī & Yoginī
    try {
      const liveVims = M.vimshottariAtJd(natalMoon.longitude, natalJd, tJd);
      const vMahaEl = $("live-vims-maha");
      const vAntaraEl = $("live-vims-antara");
      const vSpanEl = $("live-vims-span");
      if (vMahaEl && liveVims.maha) {
        vMahaEl.textContent = `${liveVims.maha.lord.toUpperCase()} Mahādaśā`;
      }
      if (vAntaraEl && liveVims.antara) {
        vAntaraEl.textContent = `${liveVims.antara.lord.toUpperCase()} Antardaśā`;
      }
      if (vSpanEl && liveVims.antara) {
        vSpanEl.textContent = `Antardaśā Span: ${M.julianDayToIsoDate(liveVims.antara.startJd)} → ${M.julianDayToIsoDate(liveVims.antara.endJd)}`;
      }
    } catch (e) {
      /* fallback */
    }

    try {
      const liveYogini = M.yoginiAtJd(natalMoon.longitude, natalJd, tJd);
      const yMahaEl = $("live-yogini-maha");
      const yAntaraEl = $("live-yogini-antara");
      const ySpanEl = $("live-yogini-span");
      if (yMahaEl && liveYogini.maha) {
        yMahaEl.textContent = `${liveYogini.maha.meta.name} (${liveYogini.maha.meta.sa}) · Lord ${liveYogini.maha.meta.lordSa} [${liveYogini.maha.meta.deity}]`;
      }
      if (yAntaraEl && liveYogini.antara) {
        yAntaraEl.textContent = `${liveYogini.antara.meta.name} (${liveYogini.antara.meta.sa}) Sub-Period`;
      }
      if (ySpanEl && liveYogini.maha) {
        ySpanEl.textContent = `Cycle Span: ${M.julianDayToIsoDate(liveYogini.maha.startJd)} → ${M.julianDayToIsoDate(liveYogini.maha.endJd)}`;
      }
    } catch (e) {
      /* fallback */
    }

    // 6. Jaimini 8-Chara Kāraka Hierarchy & Kārakāṃśa Matrix
    try {
      const jaimini = M.computeJaiminiCharaKarakas(natalPlanets);
      const kSignEl = $("jaimini-karakamsha-sign");
      if (kSignEl) kSignEl.textContent = `${jaimini.karakamshaLagna} (D9 of ${jaimini.atmaKaraka.sa})`;

      const jaiminiBody = $("jaimini-karakas-body");
      if (jaiminiBody) {
        jaiminiBody.replaceChildren();
        jaimini.karakas.forEach((k) => {
          const jRow = document.createElement("tr");

          // Karaka Badge
          const cKaraka = document.createElement("th");
          cKaraka.scope = "row";
          cKaraka.style.whiteSpace = "nowrap";
          const isAK = k.karaka.code === "AK";
          const isAmK = k.karaka.code === "AmK";
          const badgeColor = isAK ? "var(--gold)" : isAmK ? "var(--cyan)" : "var(--text)";
          cKaraka.innerHTML = `<span style="color:${badgeColor}; font-weight:700;">${k.karaka.code}</span> <span style="font-size:0.75rem; color:var(--soft);">(${k.karaka.sa})</span>`;
          jRow.appendChild(cKaraka);

          // Graha
          const cGraha = document.createElement("td");
          cGraha.innerHTML = `<strong>${k.sa}</strong> <span style="font-size:0.75rem; color:var(--soft);">${k.en}</span>`;
          jRow.appendChild(cGraha);

          // Degree in Sign
          const cDeg = document.createElement("td");
          cDeg.style.fontFamily = "var(--mono)";
          cDeg.innerHTML = `${k.withinDeg.toFixed(4)}° <span style="font-size:0.7rem; color:var(--soft);">(Eff: ${k.effectiveDeg.toFixed(2)}°)</span>`;
          jRow.appendChild(cDeg);

          // Rashi
          const cRashi = document.createElement("td");
          cRashi.style.fontFamily = "var(--mono)";
          cRashi.textContent = k.rashi;
          jRow.appendChild(cRashi);

          // Navamsha
          const cD9 = document.createElement("td");
          cD9.style.fontFamily = "var(--mono)";
          cD9.style.color = isAK ? "var(--gold-strong)" : "var(--text)";
          cD9.innerHTML = `<strong>${k.d9Sign}</strong>${isAK ? " 🌟 (KL)" : ""}`;
          jRow.appendChild(cD9);

          // Role & Signification
          const cRole = document.createElement("td");
          cRole.style.fontSize = "0.78rem";
          cRole.textContent = k.karaka.role;
          jRow.appendChild(cRole);

          // Live Transit Trigger
          const cTransit = document.createElement("td");
          cTransit.style.fontSize = "0.75rem";
          const directTransits = tPlanets.filter((tp) => M.signIndex(tp.longitude) === k.rashiIndex);
          if (directTransits.length > 0) {
            cTransit.innerHTML = `<span class="badge badge-gold" style="font-size:0.68rem; padding:2px 6px;">⚡ Direct Transit</span> ${directTransits.map(tp => tp.sa).join(", ")} in ${k.rashi}`;
          } else {
            cTransit.innerHTML = `<span style="color:var(--soft);">No conjunctions in ${k.rashi}</span>`;
          }
          jRow.appendChild(cTransit);

          jaiminiBody.appendChild(jRow);
        });
      }
    } catch (e) {
      /* fallback */
    }

    // 7. Macro-Transit Executive Cards
    const tShani = tPlanets.find((p) => p.key === "shani") || { longitude: 0 };
    const tGuru = tPlanets.find((p) => p.key === "guru") || { longitude: 0 };
    const tRahu = tPlanets.find((p) => p.key === "rahu") || { longitude: 0 };

    const shaniHouseFromMoon = ((M.signIndex(tShani.longitude) - natalMoonSign + 12) % 12) + 1;
    const guruHouseFromMoon = ((M.signIndex(tGuru.longitude) - natalMoonSign + 12) % 12) + 1;
    const guruHouseFromLagna = ((M.signIndex(tGuru.longitude) - natalAscSign + 12) % 12) + 1;
    const rahuHouseFromLagna = ((M.signIndex(tRahu.longitude) - natalAscSign + 12) % 12) + 1;

    // Shani card
    const shaniTitle = $("macro-shani-title");
    const shaniDesc = $("macro-shani-desc");
    if (shaniTitle && shaniDesc) {
      if ([12, 1, 2].includes(shaniHouseFromMoon)) {
        const pName = shaniHouseFromMoon === 12 ? "Rising / First" : shaniHouseFromMoon === 1 ? "Peak / Core" : "Setting / Final";
        shaniTitle.textContent = `Sade Sati Active (${pName} Phase in ${M.RASHIS[M.signIndex(tShani.longitude)]})`;
        shaniDesc.textContent = `Saturn is transiting House ${shaniHouseFromMoon} relative to Natal Moon (${M.RASHIS[natalMoonSign]}). Prioritize long-term structural focus, discipline, and avoid uncalculated risks.`;
      } else if ([3, 6, 11].includes(shaniHouseFromMoon)) {
        shaniTitle.textContent = `Upachaya Victory (House ${shaniHouseFromMoon} in ${M.RASHIS[M.signIndex(tShani.longitude)]})`;
        shaniDesc.textContent = `Saturn transits an exceptionally favorable Upachaya house from Moon. Excellent for consolidation of wealth, professional elevation, and overcoming adversarial obstacles.`;
      } else if (shaniHouseFromMoon === 4) {
        shaniTitle.textContent = `Kantaka Shani (House 4 in ${M.RASHIS[M.signIndex(tShani.longitude)]})`;
        shaniDesc.textContent = `4th house transit brings tests to domestic serenity and property ventures. Keep operations grounded and steady.`;
      } else if (shaniHouseFromMoon === 8) {
        shaniTitle.textContent = `Ashtama Shani (House 8 in ${M.RASHIS[M.signIndex(tShani.longitude)]})`;
        shaniDesc.textContent = `8th house transformative crucible. Practice risk hedging, maintain clear accounts, and attend to physical vitality.`;
      } else {
        shaniTitle.textContent = `Neutral Transit (House ${shaniHouseFromMoon} in ${M.RASHIS[M.signIndex(tShani.longitude)]})`;
        shaniDesc.textContent = `Saturn in ${M.RASHIS[M.signIndex(tShani.longitude)]} enforces steady, methodical labor and structural perseverance.`;
      }
    }

    // Guru card
    const guruTitle = $("macro-guru-title");
    const guruDesc = $("macro-guru-desc");
    if (guruTitle && guruDesc) {
      if ([2, 5, 7, 9, 11].includes(guruHouseFromMoon)) {
        guruTitle.textContent = `Fortunate Expansion (House ${guruHouseFromMoon} from Moon, H${guruHouseFromLagna} from Lagna)`;
        guruDesc.textContent = `Jupiter in ${M.RASHIS[M.signIndex(tGuru.longitude)]} casts divine benefic drishti upon key life houses. Prime cycle for capital growth, wisdom acquisition, and strategic launches.`;
      } else {
        guruTitle.textContent = `Internal Growth Phase (House ${guruHouseFromMoon} from Moon, H${guruHouseFromLagna} from Lagna)`;
        guruDesc.textContent = `Jupiter in ${M.RASHIS[M.signIndex(tGuru.longitude)]} encourages internal consolidation, learning, and patient calibration of future goals.`;
      }
    }

    // Rahu card
    const rahuTitle = $("macro-rahu-title");
    const rahuDesc = $("macro-rahu-desc");
    if (rahuTitle && rahuDesc) {
      rahuTitle.textContent = `Axis: ${M.RASHIS[M.signIndex(tRahu.longitude)]} / ${M.RASHIS[(M.signIndex(tRahu.longitude) + 6) % 12]} (H${rahuHouseFromLagna} from Lagna)`;
      rahuDesc.textContent = `Nodal axis currently activates houses ${rahuHouseFromLagna} and ${((rahuHouseFromLagna + 5) % 12) + 1} from Natal Lagna. Catalyzes intense focus on technological mastery, foreign connections, and spiritual discernment.`;
    }

    // Actionable protocol card
    const stratTitle = $("macro-strategy-title");
    const stratDesc = $("macro-strategy-desc");
    if (stratTitle && stratDesc) {
      const isGuruGood = [2, 5, 7, 9, 11].includes(guruHouseFromMoon);
      const isShaniGood = [3, 6, 11].includes(shaniHouseFromMoon);
      if (isGuruGood && isShaniGood) {
        stratTitle.textContent = `🟢 Full Aggressive Expansion Stance`;
        stratDesc.textContent = `Both Jupiter and Saturn transits are strongly aligned. Ideal time for capital commitments, ambitious partnerships, and high-yield strategic initiatives.`;
      } else if (isGuruGood) {
        stratTitle.textContent = `🟡 Selective Expansion with Hedged Risk`;
        stratDesc.textContent = `Jupiter provides strong intellectual and moral backing; maintain disciplined execution against Saturn's structural tests.`;
      } else if (isShaniGood) {
        stratTitle.textContent = `🔵 Endurance & Structural Asset Building`;
        stratDesc.textContent = `Saturn supports solid groundwork and operational victories; rely on patience and process rather than speculative windfalls.`;
      } else {
        stratTitle.textContent = `🟠 Consolidation & Defensive Optimization`;
        stratDesc.textContent = `Focus on risk minimization, debt reduction, intellectual preparation, and refining existing systems.`;
      }
    }
  }

  function renderMuhurtaScanner(forceJd, latitude, longitude, timezone) {
    const categoryEl = $("muhurta-category");
    const horizonEl = $("muhurta-horizon");
    const startDateEl = $("muhurta-start-date");
    const resultsCountEl = $("muhurta-results-count");
    const resultsBody = $("muhurta-results-body");
    if (!resultsBody) return;

    // Anchor strictly on Live Current Date (Today)
    if (startDateEl && !startDateEl.value) {
      const now = new Date();
      const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      startDateEl.value = localIso;
    }

    const startDateStr = startDateEl && startDateEl.value ? startDateEl.value : new Date().toISOString().slice(0, 10);
    const category = categoryEl ? categoryEl.value : "business";
    const horizonDays = horizonEl ? parseInt(horizonEl.value, 10) : 30;
    const tz = timezone != null ? timezone : (Number(controls.timezone.value) || 5.5);
    const lat = latitude != null ? latitude : (Number(controls.latitude.value) || 23.1765);
    const lon = longitude != null ? longitude : (Number(controls.longitude.value) || 75.7885);

    const startJd = forceJd || M.gregorianToJulianDay(startDateStr, "12:00:00", tz);

    try {
      const windows = M.scanAuspiciousMuhurtas(startJd, horizonDays, category, lat, lon, tz);
      if (resultsCountEl) resultsCountEl.textContent = `${windows.length} Windows Ranked (from ${startDateStr})`;

      resultsBody.replaceChildren();
      if (windows.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="5" style="text-align:center; color:var(--soft); padding:16px;">No sovereign windows meeting threshold in the selected horizon starting from ${startDateStr}. Expand horizon or select another archetype.</td>`;
        resultsBody.appendChild(tr);
        return;
      }

      windows.forEach((win) => {
        const tr = document.createElement("tr");

        // पञ्चक-वर्ग re-classification (app-layer, computed): tithi number from
        // the same panchang engine, class = (tithi-in-paksha − 1) % 5.
        let tithiLabel = win.tithiName;
        try {
          const winPan = M.panchangAtJd(win.jd, tz);
          const tithiInPaksha = (winPan.tithiIndex % 15) + 1;
          tithiLabel = `${TITHI_PANCHAKA[(tithiInPaksha - 1) % 5]} तिथि · ${win.tithiName}`;
        } catch (e) { /* keep plain name */ }

        // त्याज्य-योग caution (display-layer; v1 score does not include yoga-śuddhi)
        const isTyajyaYoga = TYAJYA_YOGAS.some((y) => (win.yogaName || "").includes(y));

        // Date & Day
        const tdDate = document.createElement("th");
        tdDate.scope = "row";
        tdDate.style.whiteSpace = "nowrap";
        tdDate.innerHTML = `<strong style="color:var(--gold); font-family:var(--mono);">${win.isoDate}</strong><br><span style="font-size:0.75rem; color:var(--soft);">${win.varaName}</span>`;
        tr.appendChild(tdDate);

        // Factors
        const tdFactors = document.createElement("td");
        tdFactors.innerHTML = `<div><strong>Tithi:</strong> ${tithiLabel}</div><div style="font-size:0.76rem;"><strong>Nakṣatra:</strong> ${win.nakshatraName}</div><div style="font-size:0.72rem; color:${isTyajyaYoga ? "var(--red)" : "var(--cyan)"};"><strong>Yoga:</strong> ${win.yogaName}${isTyajyaYoga ? " (त्याज्य)" : ""}</div>`;
        tr.appendChild(tdFactors);

        // Quality — badge demoted to caution styling when a त्याज्य yoga is present
        const tdScore = document.createElement("td");
        if (isTyajyaYoga) {
          tdScore.innerHTML = `<span class="badge" style="font-size:0.75rem; padding:4px 8px; font-weight:700; color:var(--red); border:1px solid var(--red); background:rgba(255,155,155,0.08);">${win.score}%* ${win.quality}</span><div style="font-size:0.66rem; color:var(--red); margin-top:2px;">* योग-शुद्धि v1 score में अगणित (PENDING)</div>`;
        } else {
          const badgeClass = win.score >= 90 ? "badge-gold" : win.score >= 75 ? "badge-green" : "badge-cyan";
          tdScore.innerHTML = `<span class="badge ${badgeClass}" style="font-size:0.75rem; padding:4px 8px; font-weight:700;">${win.score}% ${win.quality}</span>`;
        }
        tr.appendChild(tdScore);

        // Best Window — real per-day Abhijit (8th muhūrta of daylight) from
        // solarRiseSet + abhijitMuhurta; never the engine's static placeholder.
        const tdWindow = document.createElement("td");
        tdWindow.style.fontSize = "0.78rem";
        tdWindow.style.lineHeight = "1.4";
        let windowMarkup = `<span style="color:var(--soft);">— (sunrise/sunset गणना अनुपलब्ध)</span>`;
        try {
          const jdMid = Math.floor(win.jd + tz / 24 - 0.5) + 0.5 - tz / 24;
          const rs = M.solarRiseSet(jdMid, lat, lon, tz);
          if (rs && rs.jdRise && rs.jdSet && !rs.isPolarNight && !rs.isMidnightSun) {
            const ab = M.abhijitMuhurta(rs.jdRise, rs.jdSet, tz);
            windowMarkup = `<strong style="color:var(--gold-strong);">${ab.windowText}</strong><br><span style="font-size:0.7rem; color:var(--soft);">अभिजित — दिनमान का 8वाँ मुहूर्त (computed)</span>`;
          }
        } catch (e) { /* honest unavailability retained */ }
        tdWindow.innerHTML = windowMarkup;
        tr.appendChild(tdWindow);

        // Positives & Strengths — tithi positive re-labelled with its true पञ्चक-वर्ग
        const tdStrengths = document.createElement("td");
        tdStrengths.style.fontSize = "0.75rem";
        tdStrengths.style.lineHeight = "1.4";
        const fixedPositives = win.positives.map((p) =>
          /Tithi/.test(p) ? p.replace(/^Pūrṇa\/Bhadra Tithi/, `${tithiLabel.split(" · ")[0]}`) : p
        );
        const posMarkup = fixedPositives.map(p => `<span style="color:var(--green);">✓</span> ${p}`).join("<br>");
        let cautMarkup = win.cautions.length > 0 ? "<br>" + win.cautions.map(c => `<span style="color:var(--red);">⚠️</span> ${c}`).join("<br>") : "";
        if (isTyajyaYoga) cautMarkup += `<br><span style="color:var(--red);">⚠️</span> त्याज्य योग (${win.yogaName}) — मुहूर्त-शास्त्र में वर्जित`;
        tdStrengths.innerHTML = posMarkup + cautMarkup;
        tr.appendChild(tdStrengths);

        resultsBody.appendChild(tr);
      });
    } catch (e) {
      resultsBody.replaceChildren();
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5" style="color:var(--red); padding:12px;">Error scanning muhūrtas: ${e.message}</td>`;
      resultsBody.appendChild(tr);
    }
  }

  function renderAshtakavargaAndYogas(planets, siderealAscendant, jd, latitude, longitude) {
    // 1. Sarvashtakavarga Grid with Live Transit Graha Indicators
    const savGrid = $("sav-rashi-grid");
    if (savGrid) {
      try {
        const av = M.computeAshtakavarga(planets, siderealAscendant);
        
        // Calculate Live Transit grahas in the sky right now
        const nowIso = new Date().toISOString().slice(0, 10);
        const liveJd = M.gregorianToJulianDay(nowIso, "12:00:00", 5.5);
        const livePlanets = M.sphutaGrahaModel(liveJd);

        savGrid.replaceChildren();
        av.rashis.forEach((r) => {
          const card = document.createElement("div");
          card.style.background = "var(--hero)";
          card.style.border = r.savBindus >= 30 ? "1px solid var(--gold)" : r.savBindus >= 28 ? "1px solid rgba(162, 230, 178, 0.4)" : "1px solid var(--line)";
          card.style.borderRadius = "var(--radius-sm)";
          card.style.padding = "10px";
          card.style.textAlign = "center";

          const transitingHere = livePlanets.filter((lp) => M.signIndex(lp.longitude) === r.index);
          const transitBadge = transitingHere.length > 0
            ? `<div style="font-size:0.68rem; color:var(--cyan); margin-top:4px; border-top:1px solid rgba(0,229,255,0.2); padding-top:2px;">⚡ Live: ${transitingHere.map(p => p.sa).join(", ")}</div>`
            : "";

          const badgeColor = r.savBindus >= 30 ? "var(--gold-strong)" : r.savBindus >= 28 ? "var(--green)" : "var(--soft)";
          card.innerHTML = `
            <div style="font-size:0.75rem; color:var(--soft); font-family:var(--mono);">${r.index + 1}. ${r.name}</div>
            <div style="font-size:1.35rem; font-weight:800; color:${badgeColor}; margin:4px 0;">${r.savBindus}</div>
            <div style="font-size:0.68rem; color:${badgeColor};">${r.status}</div>
            ${transitBadge}
          `;
          savGrid.appendChild(card);
        });
      } catch (e) { /* fallback */ }
    }

    // 2. Classical Yogas Detected
    const yogasContainer = $("yogas-list-container");
    if (yogasContainer) {
      try {
        const yogas = M.computeClassicalYogas(planets, siderealAscendant);
        yogasContainer.replaceChildren();
        if (yogas.length === 0) {
          yogasContainer.innerHTML = `<div style="grid-column:1/-1; color:var(--soft); padding:12px;">Standard shastric configuration active; no extreme singular yoga thresholds met.</div>`;
        } else {
          yogas.forEach((y) => {
            const card = document.createElement("div");
            card.style.background = "var(--hero)";
            card.style.border = "1px solid var(--line)";
            card.style.borderRadius = "var(--radius-sm)";
            card.style.padding = "12px";

            const catBadge = y.category.includes("Pañca") ? "badge-gold" : y.category.includes("Rāja") ? "badge-cyan" : "badge-green";
            card.innerHTML = `
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <strong style="color:var(--gold-strong); font-size:0.86rem;">${y.name}</strong>
                <span class="badge ${catBadge}" style="font-size:0.68rem;">${y.category}</span>
              </div>
              <div style="font-size:0.74rem; color:var(--cyan); margin-bottom:4px; font-family:var(--mono);">Grahas: ${y.graha}</div>
              <div style="font-size:0.76rem; color:var(--soft); line-height:1.4;">${y.desc}</div>
            `;
            yogasContainer.appendChild(card);
          });
        }
      } catch (e) { /* fallback */ }
    }

    // 3. Ṣaḍbala Scorecard
    const shadbalaBody = $("shadbala-table-body");
    if (shadbalaBody) {
      try {
        const shadbala = M.computeShadbala(planets, siderealAscendant, jd, latitude, longitude);
        shadbalaBody.replaceChildren();
        shadbala.forEach((sb) => {
          const tr = document.createElement("tr");

          const thGraha = document.createElement("th");
          thGraha.scope = "row";
          thGraha.innerHTML = `<strong>${sb.sa}</strong> <span style="font-size:0.72rem; color:var(--soft);">${sb.en}</span>`;
          tr.appendChild(thGraha);

          const tdSthana = document.createElement("td");
          tdSthana.style.fontFamily = "var(--mono)";
          tdSthana.textContent = sb.sthanaBala.toFixed(1);
          tr.appendChild(tdSthana);

          const tdDig = document.createElement("td");
          tdDig.style.fontFamily = "var(--mono)";
          tdDig.textContent = sb.digBala.toFixed(1);
          tr.appendChild(tdDig);

          const tdKala = document.createElement("td");
          tdKala.style.fontFamily = "var(--mono)";
          tdKala.textContent = sb.kalaBala.toFixed(1);
          tr.appendChild(tdKala);

          const tdCheshta = document.createElement("td");
          tdCheshta.style.fontFamily = "var(--mono)";
          tdCheshta.textContent = sb.cheshtaBala.toFixed(1);
          tr.appendChild(tdCheshta);

          const tdNaisargika = document.createElement("td");
          tdNaisargika.style.fontFamily = "var(--mono)";
          tdNaisargika.textContent = sb.naisargikaBala.toFixed(1);
          tr.appendChild(tdNaisargika);

          const tdDrik = document.createElement("td");
          tdDrik.style.fontFamily = "var(--mono)";
          tdDrik.textContent = sb.drikBala.toFixed(1);
          tr.appendChild(tdDrik);

          const tdTotal = document.createElement("td");
          tdTotal.style.fontFamily = "var(--mono)";
          tdTotal.innerHTML = `<strong style="color:var(--gold);">${sb.totalRupas.toFixed(2)} Rūpas</strong> <span style="font-size:0.7rem; color:var(--soft);">(${sb.totalVirupas.toFixed(0)}v)</span>`;
          tr.appendChild(tdTotal);

          const tdReq = document.createElement("td");
          tdReq.style.fontFamily = "var(--mono)";
          tdReq.textContent = `${sb.reqRupas.toFixed(1)} R`;
          tr.appendChild(tdReq);

          const tdAdequacy = document.createElement("td");
          const isOk = sb.ratioPct >= 100;
          const badgeClass = isOk ? "badge-green" : "badge-gold";
          tdAdequacy.innerHTML = `<span class="badge ${badgeClass}" style="font-size:0.72rem; padding:2px 6px;">${Math.round(sb.ratioPct)}% ${isOk ? "✓ High Potency" : "Normal"}</span>`;
          tr.appendChild(tdAdequacy);

          shadbalaBody.appendChild(tr);
        });
      } catch (e) { /* fallback */ }
    }

    // 4. Pushkara & Mrityu Bhaga Table
    const pushkaraBody = $("pushkara-table-body");
    if (pushkaraBody) {
      try {
        const pmResults = M.computePushkaraAndMrityuBhaga(planets);
        pushkaraBody.replaceChildren();
        pmResults.forEach((pm) => {
          const tr = document.createElement("tr");

          const thGraha = document.createElement("th");
          thGraha.scope = "row";
          thGraha.innerHTML = `<strong>${pm.sa}</strong> <span style="font-size:0.72rem; color:var(--soft);">${pm.en}</span>`;
          tr.appendChild(thGraha);

          const tdLon = document.createElement("td");
          tdLon.style.fontFamily = "var(--mono)";
          tdLon.textContent = `${pm.rashi} (${pm.longitude.toFixed(2)}°)`;
          tr.appendChild(tdLon);

          const tdWithin = document.createElement("td");
          tdWithin.style.fontFamily = "var(--mono)";
          tdWithin.textContent = `${pm.withinDeg.toFixed(2)}°`;
          tr.appendChild(tdWithin);

          const tdNav = document.createElement("td");
          tdNav.innerHTML = pm.isPushkaraNav
            ? `<span class="badge badge-green" style="font-size:0.7rem; padding:2px 6px;">🌟 Active Amṛta Slot</span>`
            : `<span style="color:var(--soft); font-size:0.75rem;">Standard</span>`;
          tr.appendChild(tdNav);

          const tdBhaga = document.createElement("td");
          tdBhaga.innerHTML = pm.isPushkaraBhaga
            ? `<span class="badge badge-gold" style="font-size:0.7rem; padding:2px 6px;">👑 Exact Degree Peak</span>`
            : `<span style="color:var(--soft); font-size:0.75rem;">None</span>`;
          tr.appendChild(tdBhaga);

          const tdMb = document.createElement("td");
          tdMb.innerHTML = pm.isMrityuBhaga
            ? `<span class="badge" style="font-size:0.7rem; padding:2px 6px; background:rgba(255,100,100,0.15); color:var(--red); border:1px solid var(--red);">⚠️ Critical Vulnerability</span>`
            : `<span style="color:var(--green); font-size:0.75rem;">✓ Guard Clear</span>`;
          tr.appendChild(tdMb);

          const tdStatus = document.createElement("td");
          tdStatus.style.fontSize = "0.78rem";
          tdStatus.textContent = pm.status;
          tr.appendChild(tdStatus);

          pushkaraBody.appendChild(tr);
        });
      } catch (e) { /* fallback */ }
    }
  }

  function renderBphsAdvanced(jd, lat, lon, tz, planets, lagnaDeg) {
    if (typeof M.computeSpecialLagnas !== "function") return;

    const sun = planets.find(p => p.key === "surya") || { longitude: 0 };
    const moon = planets.find(p => p.key === "candra") || { longitude: 0 };
    const mars = planets.find(p => p.key === "mangala") || { longitude: 0 };
    const merc = planets.find(p => p.key === "budha") || { longitude: 0 };
    const jup = planets.find(p => p.key === "guru") || { longitude: 0 };
    const ven = planets.find(p => p.key === "shukra") || { longitude: 0 };
    const sat = planets.find(p => p.key === "shani") || { longitude: 0 };

    const grahaPos = {
      sun: sun.longitude,
      moon: moon.longitude,
      mars: mars.longitude,
      mercury: merc.longitude,
      jupiter: jup.longitude,
      venus: ven.longitude,
      saturn: sat.longitude
    };

    // 1. Special Lagnas & Upagrahas
    const lagnas = M.computeSpecialLagnas(jd, lat, lon, sun.longitude, moon.longitude, lagnaDeg, tz);
    const upagrahas = M.computeUpagrahas(sun.longitude, jd, lat, lon);

    const lagnasUpBody = $("bphs-lagnas-upagrahas-body");
    if (lagnasUpBody) {
      // विशेष-लग्न rows carry the frozen-15-ghaṭī defect note (sunriseJd/jdRise
      // mismatch in the sealed engine — BE-S12 draft); धूम-family rows are real.
      const FROZEN_NOTE = " · ⚠ स्थिर 15-घटी सन्दर्भ (दोषग्रस्त, BE-S12)";
      const items = [
        { name: "भाव लग्न (Bhāva Lagna)", cat: "Special Lagna (Ch. 5)", deg: lagnas.bhavaLagna.deg, principle: "1 Rāśi per 5 Ghaṭīs (2 hrs) from Sunrise" + FROZEN_NOTE },
        { name: "होरा लग्न (Horā Lagna)", cat: "Special Lagna (Ch. 5)", deg: lagnas.horaLagna.deg, principle: "1 Rāśi per 2.5 Ghaṭīs (1 hr) from Sunrise (Wealth Axis)" + FROZEN_NOTE },
        { name: "घटी लग्न (Ghaṭī Lagna)", cat: "Special Lagna (Ch. 5)", deg: lagnas.ghatiLagna.deg, principle: "1 Rāśi per 1 Ghaṭī (24 mins) from Sunrise (Power Axis)" + FROZEN_NOTE },
        { name: "प्राणपद लग्न (Prāṇapada Lagna)", cat: "Special Lagna (Ch. 5)", deg: lagnas.pranapadaLagna.deg, principle: "1 Rāśi per 1 Vighaṭī (Vital Breath Rectification)" + FROZEN_NOTE },
        { name: "श्री लग्न (Śrī Lagna)", cat: "Special Lagna (Ch. 5)", deg: lagnas.sriLagna.deg, principle: "Lagna + Moon Nakṣatra progression * 360°" },
        { name: "इन्दु लग्न (Indu Lagna)", cat: "Special Lagna (Ch. 5)", deg: lagnas.induLagna.deg, principle: "9th Lord Kalā ray summation from Lagna & Moon" },
        { name: "धूम (Dhūma)", cat: "Upagraha (Ch. 25)", deg: upagrahas.dhuma.deg, principle: "Sun + 133° 20' (Smoky Solar Node)" },
        { name: "व्यतीपात (Vyatīpāta)", cat: "Upagraha (Ch. 25)", deg: upagrahas.vyatipata.deg, principle: "360° - Dhūma" },
        { name: "परिवेष (Pariveṣa / Paridhi)", cat: "Upagraha (Ch. 25)", deg: upagrahas.parivesha.deg, principle: "Vyatīpāta + 180° (Halo Upagraha)" },
        { name: "इन्द्रचाप (Indracāpa / Koduṇḍa)", cat: "Upagraha (Ch. 25)", deg: upagrahas.indrachapa.deg, principle: "360° - Pariveṣa (Rainbow Node)" },
        { name: "उपकेतु (Upaketu / Śikhī)", cat: "Upagraha (Ch. 25)", deg: upagrahas.upaketu.deg, principle: "Indracāpa + 16° 40' (Cyclic Sun Return Invariant)" },
        { name: "गुलिक / मान्दि (Gulika / Māndi)", cat: "Kāla Upagraha (Ch. 25)", deg: upagrahas.gulika.deg, principle: "सरलीकृत सूर्य+90° placeholder — शनि-अष्टमांश गणना PENDING (VYAKHYA)" }
      ];

      lagnasUpBody.innerHTML = items.map(item => {
        const nak = M.computeNakshatraDetails(item.deg);
        const rIndex = Math.floor(item.deg / 30);
        return `
          <tr>
            <td style="font-weight: 700; color: var(--gold);">${item.name}</td>
            <td><span class="badge ${item.cat.includes('Lagna') ? 'badge-gold' : 'badge-cyan'}">${item.cat}</span></td>
            <td>${formatDegrees(item.deg)} · <span lang="sa" style="color:var(--gold);">${M.RASHI_SA[rIndex]}</span></td>
            <td>${nak.number}. ${nak.name} (चरण ${nak.pada})</td>
            <td style="font-size: 0.78rem; color: var(--soft);">${item.principle}</td>
          </tr>
        `;
      }).join("");
    }

    // 2. Arudha Padas & Argala
    const padas = M.computeArudhaPadas(lagnaDeg, grahaPos);
    const argala = M.computeArgala(grahaPos, lagnaDeg);
    const arudhaBody = $("bphs-arudha-argala-body");
    if (arudhaBody) {
      const devJoin = (arr) => arr.map(grahaDev).join(", ");
      arudhaBody.innerHTML = padas.map((p, idx) => {
        const arg = argala[idx] || {};
        const p2 = (arg.primaryArgala && arg.primaryArgala['2nd'].length) ? `2nd: ${devJoin(arg.primaryArgala['2nd'])}` : '';
        const p4 = (arg.primaryArgala && arg.primaryArgala['4th'].length) ? `4th: ${devJoin(arg.primaryArgala['4th'])}` : '';
        const p11 = (arg.primaryArgala && arg.primaryArgala['11th'].length) ? `11th: ${devJoin(arg.primaryArgala['11th'])}` : '';
        const primStr = [p2, p4, p11].filter(Boolean).join(' · ') || '—';

        const o12 = (arg.obstruction && arg.obstruction['12th'].length) ? `12th: ${devJoin(arg.obstruction['12th'])}` : '';
        const o10 = (arg.obstruction && arg.obstruction['10th'].length) ? `10th: ${devJoin(arg.obstruction['10th'])}` : '';
        const o3 = (arg.obstruction && arg.obstruction['3rd'].length) ? `3rd: ${devJoin(arg.obstruction['3rd'])}` : '';
        const obstStr = [o12, o10, o3].filter(Boolean).join(' · ') || 'None';

        return `
          <tr>
            <td style="font-weight: 700;">भाव ${p.house}</td>
            <td><strong style="color: var(--cyan);">${p.nameSa}</strong> (${p.key})</td>
            <td><span lang="sa" style="color:var(--gold); font-weight:700;">${p.rashiSa}</span> (Sign ${p.rashiIndex + 1})</td>
            <td style="font-size: 0.78rem;">${primStr}</td>
            <td style="font-size: 0.78rem; color: var(--red);">${obstStr}</td>
            <td>
              <span class="badge ${arg.isUnobstructed ? 'badge-green' : 'badge-gold'}">
                ${arg.isUnobstructed ? '✓ Unobstructed (' + arg.argalaStrength + ')' : 'Net Balanced (0)'}
              </span>
            </td>
          </tr>
        `;
      }).join("");
    }

    // 3. Ashtakavarga Shodhana & Pinda Sadhana
    const av = M.computeAshtakavarga(planets, lagnaDeg);
    const shodh = M.computeAshtakavargaShodhana(av.sav, grahaPos);
    const shodhBody = $("bphs-shodhana-body");
    if (shodhBody) {
      shodhBody.innerHTML = `
        <tr>
          <td style="font-weight: 700; color: var(--soft);">1. Raw SAV Bindus (मूल बिन्दु)</td>
          ${shodh.rawBindus.map(b => `<td style="text-align:center;">${b}</td>`).join("")}
          <td style="font-weight: 700; color: var(--cyan); text-align:center;">337</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: var(--gold);">2. Trikona Shodhita (त्रिकोण शोधित)</td>
          ${shodh.trikonaShodhita.map(b => `<td style="text-align:center; font-weight:600; color:var(--gold);">${b}</td>`).join("")}
          <td style="font-weight: 700; color: var(--gold); text-align:center;">${shodh.trikonaShodhita.reduce((a,b)=>a+b, 0)}</td>
        </tr>
        <tr style="background: rgba(0, 229, 255, 0.04);">
          <td style="font-weight: 700; color: var(--cyan);">3. Ekādhipatya Shodhita (एकाधिपत्य शोधित)</td>
          ${shodh.ekadhipatyaShodhita.map(b => `<td style="text-align:center; font-weight:700; color:var(--cyan);">${b}</td>`).join("")}
          <td style="font-weight: 700; color: var(--cyan); text-align:center;">${shodh.ekadhipatyaShodhita.reduce((a,b)=>a+b, 0)}</td>
        </tr>
        <tr style="background: rgba(145, 221, 163, 0.08);">
          <td style="font-weight: 800; color: var(--green);">4. Pinda Sādhana (पिण्ड साधना)</td>
          <td colspan="6" style="font-size:0.8rem; color:var(--soft); padding:8px 12px;">
            <b>Rāśi Piṇḍa:</b> ${shodh.rasiPinda} &nbsp;·&nbsp; <b>Graha Piṇḍa:</b> ${shodh.grahaPinda}
          </td>
          <td colspan="6" style="font-size:0.88rem; font-weight:800; color:var(--green); text-align:right; padding:8px 12px;">
            Śodhya Piṇḍa (शोध्य पिण्ड) = ${shodh.shodhyaPinda}
          </td>
          <td style="font-weight: 800; color: var(--green); text-align:center;">${shodh.shodhyaPinda}</td>
        </tr>
      `;
    }

    // 4. Vedic Birth Doshas & Shanti Scanner
    const doshas = M.computeBirthDoshasAndShanti(jd, lat, lon, sun.longitude, moon.longitude, lagnaDeg);
    const doshaBox = $("bphs-dosha-container");
    if (doshaBox) {
      if (doshas.length === 0) {
        doshaBox.innerHTML = `
          <div style="grid-column: 1 / -1; background: rgba(145, 221, 163, 0.08); border: 1px solid var(--green); border-radius: var(--radius-sm); padding: 14px; color: var(--green); font-size: 0.88rem;">
            🌟 <b>Shubha Janma Verified (शुभ जन्म)</b> — Zero major vulnerability doshas detected. None of the classical BPHS birth curses (Amāvāsyā, Kṛṣṇa Caturdaśī, Gaṇḍānta, Abhukta Mūla, Saṅkrānti, Mahāpāta) afflict this chart.
          </div>
        `;
      } else {
        doshaBox.innerHTML = doshas.map(d => `
          <div style="background: var(--hero); border: 1px solid ${d.severity === 'Critical' ? 'var(--red)' : 'var(--gold)'}; border-radius: var(--radius-sm); padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <strong style="color: ${d.severity === 'Critical' ? 'var(--red)' : 'var(--gold)'}; font-size: 0.88rem;">⚠️ ${d.nameSa}</strong>
              <span class="badge ${d.severity === 'Critical' ? 'badge-red' : 'badge-gold'}">${d.severity}</span>
            </div>
            <div style="font-size: 0.72rem; color: var(--cyan); font-family: var(--mono); margin-bottom: 6px;">${d.bphsChapter}</div>
            <div style="font-size: 0.76rem; color: var(--soft); line-height: 1.4;">${d.description}</div>
          </div>
        `).join("");
      }
    }
  }

  function renderSuryaSiddhanta14Adhikaras(jd, lat, lon, tz, planets, lagnaDeg) {
    if (typeof M.computeSuryaSiddhanta14Adhikaras !== "function") return;

    const ss14 = M.computeSuryaSiddhanta14Adhikaras(jd, lat, lon, planets, lagnaDeg, tz);

    // Extended panchang for ayana + samvatsara — the sealed engine's nineManas
    // reads fields absent from panchangAtJd, so the display recomputes them
    // from the same engine (never a raw `undefined` on screen).
    let ext = null;
    try { ext = M.panchangExtended(jd, lat, lon, tz, mode); } catch (e) { ext = null; }

    // Heliacal rows arrive in fixed engine order [candra, mangala, budha, guru,
    // shukra, shani]; canonical rows carry no `.name`, so names come from the
    // shared देवनागरी lookup by that order.
    const HELIACAL_ORDER = ["candra", "mangala", "budha", "guru", "shukra", "shani"];
    const heliacalName = (i) => grahaDev(HELIACAL_ORDER[i] || "");

    // 1. 14 Adhikaras Telemetry Table
    const ss14Body = $("ss-14adhikaras-body");
    if (ss14Body) {
      const rows = [
        { ch: "अध्याय १: मध्यमाधिकारः", domain: "Mean Motions & Mahāyuga Cycles", metric: `Ahargaṇa: ${Math.floor(ss14.adhikara1_madhyama.ahargana)} days · UMT: ${ss14.adhikara1_madhyama.ujjainTime}`, formula: "4,320,000 Solar Years = 1,577,917,828 Sāvana Days" },
        { ch: "अध्याय २: स्पष्टाधिकारः", domain: "Manda & Śīghra True Epicycles", metric: `9 Graha Sphuṭa & Velocities (${ss14.adhikara2_spashta.vels.length} tracks computed)`, formula: "Pulsating Variable Epicycles with Sine Quadrants (Jyā-Paridhi)" },
        { ch: "अध्याय ३: त्रिप्रश्नाधिकारः", domain: "Direction, Place & 12-Digit Shadow", metric: `Śaṅku Shadow: ${ss14.adhikara3_triprashna.shankuShadowAngula.toFixed(2)} Aṅgulas · Palabhā: ${ss14.adhikara3_triprashna.palabha.toFixed(2)}`, formula: "Śaṅku-Chhāyā = 12 × tan(Zenith Distance)" },
        { ch: "अध्याय ४: चन्द्रग्रहणाधिकारः", domain: "Lunar Eclipse & Earth Shadow Cone", metric: ss14.adhikara4_chandra_grahana.isLunarEclipsePossible ? `⚠️ Eclipse Feasible · Grāsa: ${ss14.adhikara4_chandra_grahana.lunarGrasa.toFixed(2)}` : "No Lunar Eclipse at current Tithi/Node configuration", formula: "Earth Shadow Cone Diameter (Bhā-bimba) = 80.0′" },
        { ch: "अध्याय ५: सूर्यग्रहणाधिकारः", domain: "Solar Eclipse & Topocentric Parallax", metric: ss14.adhikara5_surya_grahana.parallaxImplemented ? `Lambana: ${ss14.adhikara5_surya_grahana.lambanaGhati.toFixed(2)} Ghaṭīs · Nati: ${ss14.adhikara5_surya_grahana.natiArcmin.toFixed(2)}′` : "Retired generated shortcut · use canonical /v1/grahana?lat=…&lon=…", formula: "S-S V.3–12: madhyalagna → madhyajyā → dṛkkṣepa/dṛggati → cheda → lambana/nati (not 4×sin/48×sin)" },
        { ch: "अध्याय ६: छेद्यकाधिकारः", domain: "Geometric Eclipse Path Projection", metric: `Akṣa-Valana: ${ss14.adhikara6_chedyaka.akshaValana.toFixed(4)} · Ayana-Valana: ${ss14.adhikara6_chedyaka.ayanaValana.toFixed(4)}`, formula: "Total Valana = Akṣa-Valana + Ayana-Valana Deflections" },
        { ch: "अध्याय ७: ग्रहयुत्यधिकारः", domain: "Planetary Conjunctions & Grahayuddha", metric: ss14.adhikara7_graha_yuti.wars.length ? `${ss14.adhikara7_graha_yuti.wars.length} Active Planetary Wars / Conjunctions` : "Zero Active Planetary War (All Tara separations > 1°)", formula: "4 War Classes: Bhedha, Ullekha, Anśuvimarda, Apasavya" },
        { ch: "अध्याय ८: भग्रहयुत्यधिकारः", domain: "27 Yogatārās & Asterism Occultation", metric: ss14.adhikara8_bha_graha_yuti.isRohiniShakata ? "⚠️ Critical Rohiṇī-Śakaṭa Bhedha Active" : "Clear of Rohiṇī Asterism Shakata-Bhedha", formula: "Polar Longitudes (Dhruvaka) & Polar Latitudes (Vikṣepa)" },
        { ch: "अध्याय ९: उदयास्ताधिकारः", domain: "Heliacal Rising, Setting & Combustion", metric: `${ss14.adhikara9_udaya_asta.heliacalStatus.filter(h => h.isCombust).length} Grahas Combust (Asta) · ${ss14.adhikara9_udaya_asta.heliacalStatus.filter(h => !h.isCombust).length} Visible`, formula: "Planetary Visibility Arcs: Moon 12°, Mars 17°, Merc 14°, Jup 11°, Ven 10°, Sat 15°" },
        { ch: "अध्याय १०: शृङ्गोन्नत्यधिकारः", domain: "Lunar Horns Elevation & Crescent Width", metric: `Illuminated: ${(ss14.adhikara10_shringonnati.illuminatedFraction * 100).toFixed(1)}% · ${ss14.adhikara10_shringonnati.elevatedHorn}`, formula: "Crescent Width = Moon Diameter × (1 - cos(Elongation)) / 2" },
        { ch: "अध्याय ११: पाताधिकारः", domain: "Mahāpāta (Vyatīpāta & Vaidhṛti)", metric: ss14.adhikara11_pata.isVyatipataActive ? "⚠️ Active Vyatīpāta Mahāpāta" : ss14.adhikara11_pata.isVaidhritiActive ? "⚠️ Active Vaidhṛti Mahāpāta" : "No Active Mahāpāta Solar-Lunar Declination Clash", formula: "Vyatīpāta: Sun + Moon = 180° · Vaidhṛti: Sun + Moon = 360°" },
        { ch: "अध्याय १२: भूगोलाध्यायः", domain: "Cosmography & 4 Prime Meridian Cities", metric: "4 Global Quadrants Calculated (Ujjayinī, Yamakoṭi, Romaka, Siddhāpura)", formula: "Earth Diameter = 1,600 Yojanas · Circumference = 5,059 Yojanas" },
        { ch: "अध्याय १३: ज्योतिषोपनिषदध्यायः", domain: "Armillary Sphere & 4 Classical Yantras", metric: "Active Telemetry for Ghaṭī, Śaṅku, Cakra, and Dhanur Yantras", formula: "Ghaṭī-Yantra: 60-Pala sinking copper bowl with calibrated orifice" },
        { ch: "अध्याय १४: मानाध्यायः", domain: "9 Classical Time Reckonings (Nava-Māna)", metric: "Active Metrics for Brāhma, Daiva, Mānuṣa, Pitrya, Saura, Sāvana, Cāndra, Nākṣatra, Bārhaspatya", formula: "Unified Chronometry bridging Human Seconds to Cosmic Kalpas" }
      ];

      ss14Body.innerHTML = rows.map(r => `
        <tr>
          <td style="font-weight: 700; color: var(--gold);">${r.ch}</td>
          <td><span class="badge badge-cyan" style="font-size: 0.72rem;">${r.domain}</span></td>
          <td style="font-size: 0.8rem; font-weight: 600;">${r.metric}</td>
          <td style="font-size: 0.76rem; color: var(--soft);">${r.formula}</td>
        </tr>
      `).join("");
    }

    // 2. Grahana, War, Horn Status Cards
    const grStatus = $("ss-grahana-status");
    const grDesc = $("ss-grahana-desc");
    if (grStatus && grDesc) {
      if (ss14.adhikara4_chandra_grahana.isLunarEclipsePossible) {
        grStatus.textContent = "⚠️ LUNAR ECLIPSE FEASIBLE";
        grStatus.style.color = "var(--red)";
        grDesc.textContent = `Full Moon alignment within node limit (${ss14.adhikara4_chandra_grahana.shadowDiamArcmin}′ Earth Shadow Cone). Topocentric Parallax active.`;
      } else if (ss14.adhikara5_surya_grahana.isSolarEclipsePossible) {
        grStatus.textContent = "⚠️ SOLAR ECLIPSE FEASIBLE";
        grStatus.style.color = "var(--red)";
        grDesc.textContent = `New Moon solar conjunction with node proximity. Local Lambana/Nati is not computed by this mirror; use canonical /v1/grahana with lat/lon.`;
      } else {
        grStatus.textContent = "✓ NO ACTIVE ECLIPSE ALIGNMENT";
        grStatus.style.color = "var(--gold-strong)";
        grDesc.textContent = `Sun-Moon angular distance to lunar nodes is outside the broad screening threshold. Local parallax is intentionally not fabricated on this mirror.`;
      }
    }

    const yuddhaStatus = $("ss-yuddha-status");
    const yuddhaDesc = $("ss-yuddha-desc");
    if (yuddhaStatus && yuddhaDesc) {
      // Combust names by fixed heliacal order (engine rows carry no usable name
      // field for canonical inputs) — देवनागरी lookup, empty → "None".
      const combustList = ss14.adhikara9_udaya_asta.heliacalStatus
        .map((h, i) => (h.isCombust ? heliacalName(i) : null))
        .filter(Boolean).join(", ") || "None";
      if (ss14.adhikara7_graha_yuti.wars.length > 0) {
        const w = ss14.adhikara7_graha_yuti.wars[0];
        // War pair names recomputed in display from the same canonical rows
        // (nested tāra-graha order matches the engine's war loop).
        const TARA = ["mangala", "budha", "guru", "shukra", "shani"];
        const warPairs = [];
        for (let i = 0; i < TARA.length; i++) {
          for (let j = i + 1; j < TARA.length; j++) {
            const a = planets.find((p) => p.key === TARA[i]);
            const b = planets.find((p) => p.key === TARA[j]);
            if (!a || !b) continue;
            let sep = Math.abs(M.mod360(a.longitude - b.longitude));
            if (sep > 180) sep = 360 - sep;
            if (sep < 1) warPairs.push(`${grahaDev(TARA[i])} vs ${grahaDev(TARA[j])}`);
          }
        }
        const pairLabel = warPairs[0] || "तारा-ग्रह युग्म";
        yuddhaStatus.textContent = `⚠️ ACTIVE PLANETARY WAR: ${pairLabel}`;
        yuddhaStatus.style.color = "var(--red)";
        yuddhaDesc.textContent = `Separation: ${w.separationArcmin}′ (${w.warType}). Northern planet in latitude prevails. Combust: ${combustList}.`;
      } else {
        yuddhaStatus.textContent = "✓ ALL 5 STAR PLANETS CLEAR (> 1° Separation)";
        yuddhaStatus.style.color = "var(--cyan)";
        yuddhaDesc.textContent = `Zero planetary war collisions detected. Combust Grahas (Asta within visibility arc): ${combustList}.`;
      }
    }

    const shringStatus = $("ss-shringonnati-status");
    const shringDesc = $("ss-shringonnati-desc");
    if (shringStatus && shringDesc) {
      shringStatus.textContent = `🌙 ${(ss14.adhikara10_shringonnati.illuminatedFraction * 100).toFixed(1)}% ILLUMINATED (${ss14.adhikara10_shringonnati.elevatedHorn})`;
      shringStatus.style.color = "var(--green)";
      shringDesc.textContent = `Crescent Width: ${ss14.adhikara10_shringonnati.crescentWidthAngula.toFixed(2)} Aṅgulas. Mahāpāta Status: ${ss14.adhikara11_pata.isVyatipataActive ? '⚠️ Active Vyatīpāta' : ss14.adhikara11_pata.isVaidhritiActive ? '⚠️ Active Vaidhṛti' : '✓ Clear'}.`;
    }

    // 3. 4 Prime Meridian Cities & 4 Instruments Table
    const citiesYantrasBody = $("ss-cities-yantras-body");
    if (citiesYantrasBody) {
      const allItems = [
        ...ss14.adhikara12_bhugola.fourCities.map(c => ({ name: c.name, cat: "Prime Meridian Station (Ch. 12)", reading: `Longitude ${c.lonDeg.toFixed(2)}° (${c.offsetHours})`, func: c.role })),
        ...ss14.adhikara13_jyotishopanishad.instruments.map(y => ({ name: y.name, cat: "Astronomical Yantra (Ch. 13)", reading: y.reading, func: y.principle }))
      ];

      citiesYantrasBody.innerHTML = allItems.map(item => `
        <tr>
          <td style="font-weight: 700; color: var(--gold);">${item.name}</td>
          <td><span class="badge ${item.cat.includes('Station') ? 'badge-gold' : 'badge-green'}">${item.cat}</span></td>
          <td style="font-family: var(--mono); font-size: 0.8rem; color: var(--cyan);">${item.reading}</td>
          <td style="font-size: 0.78rem; color: var(--soft);">${item.func}</td>
        </tr>
      `).join("");
    }

    // 4. 9 Classical Time Reckonings Grid — display-layer correction: the
    // sealed engine's दैव/बार्हस्पत्य rows reference fields that panchangAtJd
    // does not carry; both are recomputed here from panchangExtended so no
    // raw `undefined` (and no hardcoded fallback samvatsara) ever renders.
    const manasGrid = $("ss-manas-grid");
    if (manasGrid) {
      const manas = ss14.adhikara14_manadhyaya.nineManas.map((m) => {
        let activeUnit = m.activeUnit;
        if (m.name.indexOf("दैव") === 0) {
          activeUnit = "Ayana: " + (ext && ext.ayana ? ext.ayana : "— (गणना अनुपलब्ध)");
        } else if (m.name.indexOf("बार्हस्पत्य") === 0) {
          activeUnit = "60-Samvatsara: " + (ext && ext.samvatsaraName ? `${ext.samvatsaraName} (विक्रम ${ext.vikramYear})` : "— (गणना अनुपलब्ध)");
        } else if (/undefined/.test(String(activeUnit))) {
          activeUnit = "— (गणना अनुपलब्ध)";
        }
        return { ...m, activeUnit };
      });
      manasGrid.innerHTML = manas.map(m => `
        <div style="background: var(--hero); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 10px 12px;">
          <div style="font-size: 0.72rem; color: var(--gold); font-weight: 700; font-family: var(--mono);">${m.name}</div>
          <div style="font-weight: 700; color: var(--cyan); font-size: 0.84rem; margin: 3px 0;">${m.activeUnit}</div>
          <div style="font-size: 0.72rem; color: var(--soft);">${m.span}</div>
        </div>
      `).join("");
    }
  }

  function renderVedicMathMasterworks(jd) {
    if (typeof M.aryabhataPi !== "function") return;

    // 1. Aryabhata Kuttaka Solver
    window.solveKuttakaUI = function() {
      const a = parseInt($("kuttaka-a")?.value || "5", 10);
      const b = parseInt($("kuttaka-b")?.value || "7", 10);
      const c = parseInt($("kuttaka-c")?.value || "1", 10);
      const res = M.aryabhataKuttaka(a, b, c);
      const resEl = $("kuttaka-result");
      if (resEl) {
        if (res.solvable) {
          resEl.innerHTML = `Solution: <b>x = ${res.x}</b>, <b>y = ${res.y}</b> (${a}&middot;${res.x} &minus; ${b}&middot;${res.y} = ${c})`;
          resEl.style.color = "var(--cyan)";
        } else {
          resEl.textContent = `No integer solution (gcd(${a}, ${b}) = ${res.gcd} does not divide ${c})`;
          resEl.style.color = "var(--red)";
        }
      }
    }

    const kuttakaBtn = $("kuttaka-solve-btn");
    if (kuttakaBtn && !kuttakaBtn._hasListener) {
      kuttakaBtn._hasListener = true;
      kuttakaBtn.addEventListener("click", solveKuttakaUI);
    }

    // 2. Brahmagupta
    const quadRes = $("brahmagupta-quad-result");
    if (quadRes) {
      const area = M.brahmaguptaQuadrilateralArea(52, 25, 39, 60);
      quadRes.innerHTML = `&radic;[(s-a)(s-b)(s-c)(s-d)] = <b>${area.toFixed(2)} sq units</b> (Exact Integer)`;
    }

    // 3. Bhaskara II Chakravala
    window.solveChakravalaUI = function() {
      const nSelect = $("chakravala-n-select");
      const N = parseInt(nSelect ? nSelect.value : "61", 10);
      const res = M.bhaskaraChakravala(N);
      const chakRes = $("chakravala-result");
      if (chakRes) {
        chakRes.innerHTML = `N = ${N} &rarr; <b>x = ${res.x.toLocaleString()}</b> &middot; <b>y = ${res.y.toLocaleString()}</b> (${res.iterations} cycles)`;
      }
    }

    const chakravalaBtn = $("chakravala-solve-btn");
    if (chakravalaBtn && !chakravalaBtn._hasListener) {
      chakravalaBtn._hasListener = true;
      chakravalaBtn.addEventListener("click", solveChakravalaUI);
    }
    const nSelectEl = $("chakravala-n-select");
    if (nSelectEl && !nSelectEl._hasListener) {
      nSelectEl._hasListener = true;
      nSelectEl.addEventListener("change", solveChakravalaUI);
    }

    // 4. Madhava
    const madhavaSinEl = $("madhava-sine-result");
    if (madhavaSinEl) {
      const sin30 = M.madhavaSineSeries(Math.PI / 6, 6);
      madhavaSinEl.innerHTML = `sin(30&deg;) = <b>${sin30.madhavaSin.toFixed(8)}</b> (Error: ${sin30.difference.toExponential(2)})`;
    }

    const madhavaPiEl = $("madhava-pi-result");
    if (madhavaPiEl) {
      const piRes = M.madhavaPiSeries(15);
      madhavaPiEl.innerHTML = `&pi; = <b>${piRes.rapidConvergencePi.toFixed(12)}</b> (Kaṭapayādi: <i>${piRes.katapayadiMnemonic}</i>)`;
    }

    // 5. Pingala
    const pingalaMeruEl = $("pingala-meru-preview");
    if (pingalaMeruEl) {
      const meru = M.pingalaMeruPrastara(5);
      pingalaMeruEl.innerHTML = `Meru Rows (1..5): ` + meru.map(r => `[${r.join(", ")}]`).join(" &rarr; ");
    }

    const pingalaFibEl = $("pingala-fib-preview");
    if (pingalaFibEl) {
      const fib = M.pingalaMatrameru(10);
      pingalaFibEl.innerHTML = `Mātrāmeru: <b>${fib.join(", ")}</b>`;
    }

    // 6. Baudhayana
    const baudSqrtEl = $("baudhayana-sqrt2-result");
    if (baudSqrtEl) {
      const sqrt2 = M.baudhayanaSquareRoot2();
      baudSqrtEl.innerHTML = `&radic;2 &approx; 1 + 1/3 + 1/12 &minus; 1/408 = <b>${sqrt2.fraction} = ${sqrt2.rationalValue.toFixed(9)}</b>`;
    }

    // 7. Live Kernel Comparison Table (Float vs Aryabhata Rational Jya)
    if (jd != null && typeof M.compareKernels === "function") {
      const kernelComp = M.compareKernels(jd);
      const tbody = $("kernel-comparison-tbody");
      if (tbody) {
        tbody.innerHTML = kernelComp.comparison.map(row => `
          <tr>
            <td><strong>${row.graha}</strong></td>
            <td style="font-family: var(--mono); color: var(--gold);">${row.floatLong}</td>
            <td style="font-family: var(--mono); color: var(--cyan);">${row.rationalLong}</td>
            <td style="font-family: var(--mono); color: ${parseFloat(row.deltaArcsec) < 1.0 ? 'var(--green)' : 'var(--accent)'};">${row.deltaArcsec}</td>
            <td><span class="badge badge-green">${row.status}</span></td>
          </tr>
        `).join("");
      }
      const badge = $("kernel-drift-badge");
      if (badge) {
        badge.textContent = `Max Planetary Delta: ${kernelComp.maxDeltaArcsec}″ · computed live`;
      }
    }
  }

  function renderSsAudit() {
    const summary = $("ss-audit-summary");
    const list = $("ss-audit-list");
    if (!summary && !list) return;
    const groups = [
      ["ssAudit", M.ssAudit],
      ["ssSphutaAudit", M.ssSphutaAudit],
      ["ssSpaceAudit", M.ssSpaceAudit],
    ];
    const rows = [];
    let pass = 0;
    let fail = 0;
    let missing = 0;
    for (const [name, obj] of groups) {
      if (!obj || typeof obj !== "object") {
        missing += 1;
        rows.push({ name, key: "(missing)", ok: false });
        continue;
      }
      for (const [key, value] of Object.entries(obj)) {
        const ok = value === true;
        if (ok) pass += 1;
        else fail += 1;
        rows.push({ name, key, ok });
      }
    }
    if (summary) {
      summary.textContent = missing
        ? `${pass} pass · ${fail} fail · ${missing} audit object missing`
        : `${pass} pass · ${fail} fail`;
    }
    // Header gate readout — derived from the same real audit booleans.
    const gateEl = $("audit-gate-live");
    const total = pass + fail;
    if (gateEl) {
      gateEl.textContent = missing
        ? `Audit gates ${pass}/${total} PASS · ${missing} audit object missing`
        : `Audit gates ${pass}/${total} PASS`;
      gateEl.style.color = fail === 0 && missing === 0 ? "var(--green)" : "var(--red)";
    }
    // Hero sub-line — the gate count shown up top is this same live count.
    const heroGate = $("hero-gate-count");
    if (heroGate) {
      heroGate.textContent = `${pass}/${total} प्रमाण-द्वार PASS${missing ? ` · ${missing} audit object missing` : ""}`;
      heroGate.style.color = fail === 0 && missing === 0 ? "var(--green)" : "var(--red)";
    }
    if (list) {
      list.innerHTML = rows.map((r) => {
        const color = r.ok ? "var(--green)" : "var(--red)";
        const label = r.ok ? "PASS" : "FAIL";
        return `<div style="border: 1px solid var(--line); border-radius: 4px; padding: 8px 10px; background: var(--hero);"><div style="color: var(--cyan);">${r.name}.${r.key}</div><div style="color: ${color}; font-weight: 700;">${label}</div></div>`;
      }).join("");
    }
  }

  // ── Toy Pedersen commitment (pedagogical, BigInt) ─────────────────────────
  // Commit → open → verify is genuinely executed each render; PASS/FAIL below
  // is the result of the actual comparison, never a hardcoded string.
  const PEDERSEN_P = 2305843009213693951n; // 2^61 − 1 Mersenne prime (toy modulus, NOT cryptographically secure)
  const PEDERSEN_G = 3n;
  const PEDERSEN_H = 7n;

  function modPowBig(base, exp, mod) {
    let result = 1n;
    let b = base % mod;
    let e = exp;
    while (e > 0n) {
      if (e & 1n) result = (result * b) % mod;
      b = (b * b) % mod;
      e >>= 1n;
    }
    return result;
  }

  function pedersenCommitBig(valueBig, blindingBig) {
    return (modPowBig(PEDERSEN_G, valueBig, PEDERSEN_P) * modPowBig(PEDERSEN_H, blindingBig, PEDERSEN_P)) % PEDERSEN_P;
  }

  function renderSovereignArchitectureSuite(jd, planets) {
    if (typeof M.padicNorm !== "function") return;

    // 1. P-Adic — genuine modular arithmetic; PASS/FAIL comes from the live check.
    const normRes = $("padic-norm-result");
    if (normRes) {
      const pNorm = M.padicNorm(14, 7);
      const ultra = M.verifyUltrametricInequality(14, 7, 21, 7);
      normRes.innerHTML = `|14|<sub>7</sub> = <b>${pNorm.toFixed(6)}</b> &middot; Ultrametric d(x,z) &le; max(d(x,y),d(y,z)): <b style="color:${ultra.isValid ? "var(--green)" : "var(--red)"};">${ultra.isValid ? "PASS" : "FAIL"}</b> (d(x,z)=${ultra.dXZ} vs max=${ultra.maxRHS})`;
    }
    const nilpRes = $("nilpotent-time-result");
    if (nilpRes) {
      const nilp = M.nilpotentTimeReversal(7, 7);
      nilpRes.innerHTML = nilp.isBinduReturned
        ? `Step 7 mod 7 = 0 &rarr; <b>|000&#10217; ground state reached</b> (modular arithmetic only — no hardware fidelity claimed)`
        : `Step 7 mod 7 &ne; 0 &rarr; <b style="color:var(--red);">transient state — ground NOT reached</b>`;
    }

    // 2. ONP split & toy Pedersen commit/open/verify over the real sphuta values
    window.solveONPUI = function() {
      const valInput = $("onp-inflow-input");
      const inflow = parseFloat(valInput?.value || "100000") || 100000;
      const onp = M.outflowNeutralizationProtocol(inflow);

      const onpRes = $("onp-result");
      if (onpRes) {
        onpRes.innerHTML = `उदाहरण: 40% split of &#8377;${onp.inflowAmount.toLocaleString()}: reserve <b>&#8377;${onp.reserveLockAmount.toLocaleString()}</b> &middot; operational &#8377;${onp.operationalCapital.toLocaleString()} (conceptual protocol — nothing is actually locked)`;
      }

      const zkRes = $("zk-commitment-result");
      if (zkRes) {
        if (!Array.isArray(planets) || planets.length === 0) {
          zkRes.textContent = "Commitment unavailable — no sphuṭa rows to commit to.";
          return;
        }
        // v = sum of the nine live canonical longitudes in micro-degrees (BigInt).
        const sphutaMicroDeg = planets.reduce((acc, g) => acc + BigInt(Math.round(M.mod360(g.longitude) * 1e6)), 0n);
        const blinding = BigInt(Math.round(Math.abs(inflow))) + 999983n;
        const commitment = pedersenCommitBig(sphutaMicroDeg, blinding);
        const reopened = pedersenCommitBig(sphutaMicroDeg, blinding);      // honest opening
        const tampered = pedersenCommitBig(sphutaMicroDeg + 1n, blinding); // must NOT verify
        const verified = reopened === commitment;
        const tamperRejected = tampered !== commitment;
        zkRes.innerHTML = `Toy Pedersen C(&Sigma; sphuṭa = ${sphutaMicroDeg} µ°): <b>0x${commitment.toString(16)}</b><br>open/verify: <b style="color:${verified ? "var(--green)" : "var(--red)"};">${verified ? "PASS" : "FAIL"}</b> &middot; tampered value (v+1) rejected: <b style="color:${tamperRejected ? "var(--green)" : "var(--red)"};">${tamperRejected ? "PASS" : "FAIL"}</b>`;
      }
    }

    const onpBtn = $("onp-calc-btn");
    if (onpBtn && !onpBtn._hasListener) {
      onpBtn._hasListener = true;
      onpBtn.addEventListener("click", solveONPUI);
    }
    window.solveONPUI();

    // 3. Precession ratio & spherical-triangle solid angle — both computed live.
    const quantRes = $("quantum-phase-result");
    if (quantRes) {
      const grahaLongs = Array.isArray(planets) && planets.length === 9 ? planets.map(p => p.longitude) : null;
      const qState = M.computeDensityMatrixAndEntropy(grahaLongs);
      const qAdv = M.computeQuantumAdvantageScaling(11);
      const grRel = M.computeRelativisticCorrections(1.0, "Sun");
      const theta3 = M.computeJacobiTheta3(0.1);
      const pisano = M.computePisanoPeriod(9);

      quantRes.innerHTML = `
        <div style="font-family:var(--mono);font-size:0.8rem;line-height:1.6;color:var(--ink);">
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
            <span style="border:1px solid var(--line-gold);border-radius:4px;padding:3px 8px;background:rgba(255,184,0,0.06);color:var(--gold);"><b>Brahman Lock:</b> H(S) = ${qState.vonNeumannEntropy.toFixed(4)} (Zero-Entropy Pure State)</span>
            <span style="border:1px solid var(--line-cyan);border-radius:4px;padding:3px 8px;background:rgba(0,216,246,0.06);color:var(--cyan);"><b>33-Qubit Trinity Advantage:</b> ${qAdv.advantageRatio.toLocaleString()}&times; (${qAdv.hilbertSpaceDim.toLocaleString()} Hilbert States)</span>
          </div>
          <div style="color:var(--soft);margin-bottom:6px;">
            <b>General Relativity (Einstein-Schwarzschild):</b> Redshift <i>z</i> = ${grRel.gravitationalRedshiftZ.toExponential(4)} &middot; Shapiro Delay = ${grRel.shapiroTimeDelayMicroSec.toFixed(2)} &mu;s &middot; Mercury Precession = ${grRel.mercuryPerihelionPrecessionArcsecCentury}″/century
          </div>
          <div style="color:var(--dim);font-size:0.75rem;">
            <b>Advanced Math:</b> Jacobi &theta;<sub>3</sub>(0.1) = ${theta3.toFixed(6)} &middot; Pisano Period &pi;(9) = ${pisano} &middot; Landauer Limit = ${grRel.landauerBoundJoules.toExponential(3)} J/bit
          </div>
        </div>
      `;
    }
    const berryRes = $("geospatial-berry-result");
    if (berryRes) {
      // Solid angle of the spherical triangle Kamakhya–Kedarnath–Kanyakumari on the
      // unit sphere, computed from the coordinates via L'Huilier's theorem.
      const sites = [
        { name: "Kamakhya", lat: 26.1664, lon: 91.7086 },
        { name: "Kedarnath", lat: 30.7346, lon: 79.0669 },
        { name: "Kanyakumari", lat: 8.0883, lon: 77.5385 },
      ];
      const rad = (d) => (d * Math.PI) / 180;
      const angDist = (p, q) => Math.acos(
        Math.sin(rad(p.lat)) * Math.sin(rad(q.lat)) +
        Math.cos(rad(p.lat)) * Math.cos(rad(q.lat)) * Math.cos(rad(p.lon - q.lon))
      );
      const a = angDist(sites[1], sites[2]);
      const b = angDist(sites[0], sites[2]);
      const c = angDist(sites[0], sites[1]);
      const s = (a + b + c) / 2;
      const tanProduct = Math.tan(s / 2) * Math.tan((s - a) / 2) * Math.tan((s - b) / 2) * Math.tan((s - c) / 2);
      const solidAngleSr = 4 * Math.atan(Math.sqrt(Math.max(0, tanProduct)));
      berryRes.innerHTML = `गोल-क्षेत्रफल solid angle (उत्क्रमज्या-विधि · परिचय: L'Huilier; from the 3 site coordinates): <b>&Omega; = ${solidAngleSr.toFixed(6)} sr</b> &middot; गोल-परिक्रमा-फल (Berry analogue) &Omega;/2 = ${(solidAngleSr / 2).toFixed(6)} rad`;
    }

    // 4. Q10 model & date countdown — computed formulas, honestly labeled.
    const epiRes = $("epigenetic-result");
    if (epiRes) {
      const meta = M.computeMetabolicRateSuppression(31.5);
      epiRes.innerHTML = `Q10 model (Q10 = 2.3): CBT 31.5&deg;C &rarr; rate &times;${meta.rateMultiplier} = <b>${meta.suppressionPercent}% suppression</b> (illustrative textbook formula, not a medical claim)`;
    }
    const hingeRes = $("decade-hinge-result");
    if (hingeRes && jd != null) {
      const hinge = M.computeDecadeHingeStatus(jd);
      hingeRes.innerHTML = `Countdown to <b>${hinge.hingeDateIso}</b>: <b>${hinge.daysRemaining} days</b> from the selected instant (plain Julian-day difference)`;
    }
  }

  // ── Collapsed-by-default workbench: only Compute-locally + Findings open ──
  function applyDefaultCollapse() {
    toggleAllSections(false);
    for (const id of ["api-studio", "instrument", "findings", "quant-finance"]) {
      const panel = $(id);
      if (!panel) continue;
      panel.classList.remove("is-collapsed");
      const btn = panel.querySelector(".btn-panel-minimize");
      if (btn) {
        btn.textContent = "— Minimize";
        btn.style.background = "rgba(234, 201, 123, 0.12)";
        btn.style.color = "var(--gold)";
      }
    }
  }

  // ── Headline-अंक on section headers — every value read back from the live,
  //    already-computed DOM (no new arithmetic, no static claims) ──
  function updateSectionHeadlines() {
    const txt = (id) => { const el = $(id); return el ? el.textContent.trim() : ""; };
    const kids = (id) => { const el = $(id); return el ? el.children.length : 0; };
    const rows = (id) => { const el = $(id); return el ? el.querySelectorAll("tr").length : 0; };
    const firstPart = (s, sep) => (s && s !== "…" ? s.split(sep)[0].trim() : "");
    const getters = {
      "quant-finance": () => { const v = txt("quantVolIndex"); return v && v !== "…" ? `सूचक ${v}` : ""; },
      "shunyabheda-forensics": () => txt("chalitShiftCountBadge"),
      "audit-benchmark": () => { const g = txt("audit-gate-live"); return g.startsWith("Audit gates") ? g.replace("Audit gates ", "") : ""; },
      "instrument": () => { const j = txt("jd-value"); return j && j !== "…" ? `JD ${j}` : ""; },
      "vargas": () => { const n = kids("varga-charts"); return n ? `${n} वर्ग-चक्र` : ""; },
      "bhavas": () => firstPart(txt("b-lagna"), "·"),
      "vimshottari": () => { const d = firstPart(txt("dasha-maha"), ":"); return d ? `महादशा ${d}` : ""; },
      "natal-id": () => { const c = txt("natal-cell"); return c && c !== "…" ? `cell ${c}` : ""; },
      "live-gochara": () => { const m = txt("live-vims-maha"); return m && m !== "…" ? m : ""; },
      "muhurta-scanner": () => txt("muhurta-results-count"),
      "ashtakavarga-yogas": () => { const n = rows("shadbala-table-body"); return n ? `Ṣaḍbala — ${n} grahas` : ""; },
      "bphs-advanced": () => {
        const box = $("bphs-dosha-container");
        if (!box || !box.children.length) return "";
        return /Shubha Janma/.test(box.textContent) ? "शुभ जन्म ✓" : `${box.children.length} दोष-सूचना`;
      },
      "surya-siddhanta-suite": () => { const n = rows("ss-14adhikaras-body"); return n ? `${n} अधिकार live` : ""; },
      "vedic-math-masterworks": () => { const b = txt("kernel-drift-badge"); return b && b !== "computing…" ? b.replace(" · computed live", "") : ""; },
    };
    for (const [id, getter] of Object.entries(getters)) {
      const section = $(id);
      if (!section) continue;
      let value = "";
      try { value = getter() || ""; } catch (e) { value = ""; }
      let span = section.querySelector(":scope .sec-headline");
      if (!span) {
        const host = section.querySelector(":scope > div:first-of-type") || section;
        span = document.createElement("span");
        span.className = "sec-headline";
        host.appendChild(span);
      }
      span.textContent = value;
      span.style.display = value ? "" : "none";
    }
  }

  // ── दृक्-teaser chip: user-click enables the overlay (SANKALP default-off intact) ──
  function initDrikTeaser() {
    const chip = $("drik-teaser-chip");
    if (!chip || chip._hasListener) return;
    chip._hasListener = true;
    chip.addEventListener("click", () => {
      const sec = $("vedic-math-masterworks");
      if (sec) {
        sec.classList.remove("is-collapsed");
        const btn = sec.querySelector(".btn-panel-minimize");
        if (btn) {
          btn.textContent = "— Minimize";
          btn.style.background = "rgba(234, 201, 123, 0.12)";
          btn.style.color = "var(--gold)";
        }
      }
      const toggle = $("kerala-drik-toggle");
      if (toggle && !toggle.checked) {
        toggle.checked = true;
        renderKeralaDrik(lastComputedJd);
      }
      const wrap = $("kerala-drik-wrap");
      if (wrap) wrap.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  // ── दृक् proof text-export (copies the live comparison table) ──
  function initDrikProofCopy() {
    const btn = $("drik-proof-copy");
    const st = $("drik-proof-status");
    if (!btn || btn._hasListener) return;
    btn._hasListener = true;
    const say = (t) => { if (st) { st.textContent = t; setTimeout(() => { st.textContent = ""; }, 4000); } };
    btn.addEventListener("click", () => {
      const tbody = $("kerala-drik-tbody");
      if (!tbody || !tbody.children.length) { say("पहले overlay on करो"); return; }
      const lines = ["Graha | Classical° | संस्कृत°±RMS | दृक्° | संस्कृत−दृक्′"];
      tbody.querySelectorAll("tr").forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll("th,td")).map((c) => c.textContent.trim());
        if (cells.length) lines.push(cells.join(" | "));
      });
      lines.push("Bharat Ephemeris · computed offline in this browser · bharatephemeris.org");
      const text = lines.join("\n");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => say("प्रमाण कॉपी हुआ ✓"), () => say("clipboard अनुपलब्ध"));
      } else say("clipboard अनुपलब्ध");
    });
  }

  function syncSharedState() {
    if (typeof M.yantraState !== "function") return;
    M.yantraState().set({
      date: controls.date.value,
      time: controls.time.value,
      timezone: controls.timezone.value,
      latitude: controls.latitude.value,
      longitude: controls.longitude.value,
      ayanamsha: controls.ayanamsha.value,

    });
  }

  let lastComputedJd = null;
  // janma-gate (Gochara honesty): flips true only on a real user edit of the
  // Instrument epoch — auto-initialised "now" is NOT a janma.
  let janmaEntered = false;
  let lastNatalShare = null; // last computed Natal-ID payload for the share-card

  function render() {
    const tRenderStart = performance.now();
    try {
      const { timezone, latitude, longitude } = validateInputs();
      const mode = controls.ayanamsha.value;
      const jd = M.gregorianToJulianDay(controls.date.value, controls.time.value, timezone);
      const ayanamsha = M.ayanamshaDeg(jd, mode);
      const tropicalAscendant = M.tropicalAscendantDeg(jd, latitude, longitude);
      const siderealAscendant = M.siderealAscendantDeg(jd, latitude, longitude, mode);
      const planets = canonicalGrahaRows(jd);
      const moon = planets.find((graha) => graha.key === "candra");
      if (!moon) throw new Error("Canonical row set does not contain the Moon.");
      const rawBhava = M.bhavaModel(jd, latitude, longitude, mode);
      const bhava = reconcileBhavaRows(rawBhava, planets);

      $("jd-value").textContent = jd.toFixed(8);
      $("umt-value").textContent = M.ujjainMeanTime(controls.time.value, timezone, longitude);
      const atUjjain = Math.abs(longitude - M.UJJAIN_LONGITUDE_DEG) <= UJJAIN_TOLERANCE_DEG && Math.abs(latitude - 23.1765) <= 0.05;
      $("meridian-time-label").textContent = atUjjain ? "Ujjain local-meridian mean time" : "Local-meridian mean time";
      $("lst-value").textContent = formatDegrees(M.localSiderealTimeDeg(jd, longitude));
      $("ayana-value").textContent = `${ayanamsha.toFixed(8)}° · ${ayanamshaDescriptor(mode)}`;
      $("rate-value").textContent = `${modeRateArcsecPerYear(jd, mode).toFixed(6)}″/year`;
      $("lagna-value").textContent = `Tropical ${formatDegrees(tropicalAscendant)} · Sidereal ${formatDegrees(siderealAscendant)} · ${signLabel(siderealAscendant)}`;

      const lagnaNak = M.computeNakshatraDetails(siderealAscendant);
      const moonNak = M.computeNakshatraDetails(moon.longitude);
      const lagnaNakEl = $("lagna-nakshatra-value");
      const moonNakEl = $("moon-nakshatra-value");
      if (lagnaNakEl) lagnaNakEl.textContent = `${lagnaNak.number}. ${lagnaNak.name} (चरण ${lagnaNak.pada}) · Lord ${lagnaNak.lord}`;
      if (moonNakEl) moonNakEl.textContent = `${moonNak.number}. ${moonNak.name} (चरण ${moonNak.pada}) · Lord ${moonNak.lord}`;
      // pada-108 readout (SIDDHA): 108-quarter address + navāṃśa sign from pada108().
      if (typeof M.pada108 === "function") {
        const lagnaPada = M.pada108(siderealAscendant);
        const moonPada = M.pada108(moon.longitude);
        if (lagnaNakEl) lagnaNakEl.textContent += ` · पद-108: ${lagnaPada.quarter}/108 · नवांश ${lagnaPada.navamshaSign}`;
        if (moonNakEl) moonNakEl.textContent += ` · पद-108: ${moonPada.quarter}/108 · नवांश ${moonPada.navamshaSign}`;
      }

      renderPlanets(planets);
      const vargaMatrix = computeVargaMatrix(siderealAscendant, planets);
      renderVargas(vargaMatrix);
      renderVargaCharts(vargaMatrix);
      renderBhavas(bhava);
      renderDasha(moon.longitude, jd);
      renderNatalId(planets, siderealAscendant);
      lastComputedJd = jd;
      renderKeralaDrik(jd);
      renderCoordinateCodec(controls.latitude.value, controls.longitude.value);
      renderQuantSection(jd, planets);
      renderShunyabhedaForensics(jd, timezone, planets, siderealAscendant, bhava);
      renderLiveGochara(planets, siderealAscendant, jd, timezone, latitude, longitude, mode);
      renderAshtakavargaAndYogas(planets, siderealAscendant, jd, latitude, longitude);
      renderMuhurtaScanner(jd, latitude, longitude, timezone);
      renderBphsAdvanced(jd, latitude, longitude, timezone, planets, siderealAscendant);
      renderSuryaSiddhanta14Adhikaras(jd, latitude, longitude, timezone, planets, siderealAscendant);
      renderVedicMathMasterworks(jd);
      renderSsAudit();
      renderSovereignArchitectureSuite(jd, planets);
      syncSharedState();

      // Refresh live API studio dynamically
      runLiveApiQuery();

      // Header diagnostics — every figure below is computed at this instant.
      const secCountEl = $("section-count-live");
      if (secCountEl) {
        const sectionCount = document.querySelectorAll("main section").length;
        secCountEl.textContent = `${sectionCount} खण्ड (DOM-गणित)`;
      }
      updateSectionHeadlines();
      const detBadge = $("badge-determinism");
      if (detBadge) {
        const deterministic = computeBitwiseDeterminism(jd);
        detBadge.textContent = deterministic ? "Bitwise determinism: PASS" : "Bitwise determinism: FAIL";
        detBadge.className = deterministic ? "badge badge-green" : "badge";
        if (!deterministic) {
          detBadge.style.color = "var(--red)";
          detBadge.style.borderColor = "var(--red)";
        }
      }
      const latBadge = $("badge-latency");
      if (latBadge) latBadge.textContent = `Local compute: ${(performance.now() - tRenderStart).toFixed(1)} ms measured`;

      const bijaState = "secular constants applied";
      $("status").textContent = `COMPUTATION COMPLETE · deterministic classical Sūrya-Siddhānta corrected sphuṭa model · sidereal ${mode} frame · ${bijaState}`;
      $("status").className = "status complete";
    } catch (error) {
      $("status").textContent = `INPUT OR COMPUTATION ERROR · ${error instanceof Error ? error.message : String(error)}`;
      $("status").className = "status fail";
      setEngineStatus(false, error instanceof Error ? error.message : String(error));
      const latBadge = $("badge-latency");
      if (latBadge) latBadge.textContent = "Local compute: failed";
      if (error && error.control && document.activeElement === $("compute")) error.control.focus();
    }
  }

  function applyInitialState() {
    const defaults = M.YANTRA_STATE_DEFAULTS || {};
    let state = defaults;
    if (typeof M.yantraState === "function") state = M.yantraState().get();
    const now = new Date();
    const utc = new Date(now.getTime() + 5.5 * 3600000);
    state = Object.assign({}, state, {
      date: utc.toISOString().slice(0, 10),
      time: utc.toISOString().slice(11, 19),
    });
    for (const key of ["date", "time", "timezone", "latitude", "longitude", "ayanamsha"]) {
      if (state[key] != null) controls[key].value = String(state[key]);
    }

  }

  // Event handlers
  $("compute").addEventListener("click", render);
  // janma-gate: any user edit of the instrument epoch counts as entering janma.
  for (const key of ["date", "time", "timezone", "latitude", "longitude"]) {
    controls[key].addEventListener("input", () => { janmaEntered = true; });
    controls[key].addEventListener("change", () => { janmaEntered = true; });
  }
  for (const control of Object.values(controls)) {
    control.addEventListener("change", render);
    control.addEventListener("input", () => {
      render();
      const urlInput = $("apiEndpointUrl");
      if (urlInput) urlInput.value = buildEndpointUrl();
      updateCodeSnippet();
    });
  }

  const apiMethodEl = $("apiMethod");
  if (apiMethodEl) {
    apiMethodEl.addEventListener("change", () => {
      const urlInput = $("apiEndpointUrl");
      if (urlInput) urlInput.value = buildEndpointUrl();
      updateCodeSnippet();
      runLiveApiQuery();
    });
  }

  const btnRunLive = $("btnRunLiveApi");
  if (btnRunLive) btnRunLive.addEventListener("click", runLiveApiQuery);

  // Kerala dṛk-saṃskāra overlay toggle — re-renders from the last computed JD.
  const keralaToggleEl = $("kerala-drik-toggle");
  if (keralaToggleEl) keralaToggleEl.addEventListener("change", () => renderKeralaDrik(lastComputedJd));

  // Muhūrta Scanner Events (Anchored on Live Current Date)
  const btnScanMuhurta = $("muhurta-scan-btn");
  if (btnScanMuhurta) {
    btnScanMuhurta.addEventListener("click", () => {
      const { timezone, latitude, longitude } = validateInputs();
      renderMuhurtaScanner(null, latitude, longitude, timezone);
    });
  }
  const btnMuhurtaToday = $("muhurta-sync-today");
  if (btnMuhurtaToday) {
    btnMuhurtaToday.addEventListener("click", () => {
      const now = new Date();
      const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      const startDateEl = $("muhurta-start-date");
      if (startDateEl) startDateEl.value = localIso;
      const { timezone, latitude, longitude } = validateInputs();
      renderMuhurtaScanner(null, latitude, longitude, timezone);
    });
  }
  const muhStartDateEl = $("muhurta-start-date");
  if (muhStartDateEl) {
    muhStartDateEl.addEventListener("change", () => {
      const { timezone, latitude, longitude } = validateInputs();
      renderMuhurtaScanner(null, latitude, longitude, timezone);
    });
  }
  const muhCategoryEl = $("muhurta-category");
  if (muhCategoryEl) {
    muhCategoryEl.addEventListener("change", () => {
      const { timezone, latitude, longitude } = validateInputs();
      renderMuhurtaScanner(null, latitude, longitude, timezone);
    });
  }
  const muhHorizonEl = $("muhurta-horizon");
  if (muhHorizonEl) {
    muhHorizonEl.addEventListener("change", () => {
      const { timezone, latitude, longitude } = validateInputs();
      renderMuhurtaScanner(null, latitude, longitude, timezone);
    });
  }

  $("codec-encode").addEventListener("click", () => {
    try {
      renderCoordinateCodec($("codec-latitude").value, $("codec-longitude").value);
      $("codec-error").textContent = "";
    } catch (error) {
      $("codec-error").textContent = error instanceof Error ? error.message : String(error);
    }
  });

  $("codec-decode").addEventListener("click", () => {
    try {
      const decoded = M.decodeCoordinatePair($("codec-payload").value);
      $("codec-decoded").textContent = `${decoded.latitude}, ${decoded.longitude}`;
      $("codec-error").textContent = "";
    } catch (error) {
      $("codec-error").textContent = error instanceof Error ? error.message : String(error);
    }
  });

  // Attach global functions for HTML onclick handlers
  globalThis.setSnippetLang = setSnippetLang;
  globalThis.runLiveApiQuery = runLiveApiQuery;

  applyInitialState();
  $("codec-latitude").value = controls.latitude.value;
  $("codec-longitude").value = controls.longitude.value;
  setSnippetLang("curl");
  initNatalShareControls();
  initDrikProofCopy();
  initDrikTeaser();
  // First-paint discipline: everything collapsed except the compute studio and
  // findings (existing toggleAllSections machinery — user can reopen at will).
  applyDefaultCollapse();

  // View-mode panel counts and persistence
  window.setShunyabhedaViewMode = function(mode) {
    localStorage.setItem("shunyabheda_view_mode", mode);
    const panels = document.querySelectorAll("section.panel");
    panels.forEach((panel, idx) => {
      if (idx < mode) {
        panel.style.display = "";
      } else {
        panel.style.display = "none";
      }
    });

    const btns = {
      6: document.getElementById("view-btn-6"),
      12: document.getElementById("view-btn-12"),
      24: document.getElementById("view-btn-24")
    };

    Object.entries(btns).forEach(([k, btn]) => {
      if (btn) {
        const isPressed = Number(k) === Number(mode);
        btn.setAttribute("aria-pressed", isPressed ? "true" : "false");
      }
    });

    console.log("Active: 6 सुगम खण्ड · 12 अनुसन्धान खण्ड · 24 पूर्ण सम्पादित प्रमाण-खण्ड");
  };

  const savedViewMode = localStorage.getItem("shunyabheda_view_mode") || "24";
  window.setShunyabhedaViewMode(savedViewMode);
})(globalThis.ShunyaMath);
