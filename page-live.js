/**
 * BHARAT EPHEMERIS OBSERVATORY — PAGE-LIVE.JS
 * Live Real-Time Controller & DOM Binder for Panchang & Sacred Horizon
 * 
 * APEX Hardened Version:
 * - 100% Safe DOM Element Dereferencing
 * - 5-Limb Anga Cards (Tithi, Vara, Nakshatra, Yoga, Karana)
 * - Vighati / Prana Real-Time Clock Ticker with Digital LCD & Analog Dial Representation
 * - Geodetic Temple Anchor Selector for 10 Sacred Bharatiya Temples
 * - Sanskrit Sankalpa Recitation Modal Generator & One-Click Clipboard Copy
 * - WhatsApp Share Trigger & Status Feedback
 */

(function(global) {
  'use strict';

  // LIVE STATE
  const LIVE_STATE = {
    selectedTempleId: 'ujjain',
    lat: 23.1765,
    lon: 75.7885,
    alt: 491,
    ayanamsha: 'LAHIRI',
    currentDate: new Date(),
    isLiveMode: true,
    customTimeOverride: null,
    animationFrameId: null
  };

  let currentPanchang = null;

  // INITIALIZATION ON DOM READY
  document.addEventListener('DOMContentLoaded', () => {
    initTempleAnchorsUI();
    initAyanamshaUI();
    initKatapayadiWidget();
    initTimeControls();
    initShareButtons();
    
    // Initial Calculate & Render
    updatePanchangState();

    // Start Live Clock Ticker
    startLiveClock();
  });

  /**
   * Get Temple Anchors Array from PanchangCore or ShunyaMath
   */
  function getTempleAnchors() {
    if (typeof PanchangCore !== 'undefined' && Array.isArray(PanchangCore.TEMPLE_ANCHORS)) {
      return PanchangCore.TEMPLE_ANCHORS;
    }
    if (typeof ShunyaMath !== 'undefined' && Array.isArray(ShunyaMath.TEMPLE_PRESETS)) {
      return ShunyaMath.TEMPLE_PRESETS;
    }
    if (typeof globalThis.ShunyaMath !== 'undefined' && Array.isArray(globalThis.ShunyaMath.TEMPLE_ANCHORS)) {
      return globalThis.ShunyaMath.TEMPLE_ANCHORS;
    }
    return [];
  }

  /**
   * Populate Temple Anchor Selectors & Buttons
   */
  function initTempleAnchorsUI() {
    const templeSelect = document.getElementById('temple-anchor-select');
    const anchors = getTempleAnchors();

    if (templeSelect) {
      templeSelect.innerHTML = '';
      anchors.forEach(temple => {
        if (!temple) return;
        const opt = document.createElement('option');
        opt.value = temple.id || '';
        opt.textContent = `${temple.name || 'Temple'} (${temple.lat}°N, ${temple.lon}°E)`;
        if (temple.id === LIVE_STATE.selectedTempleId) opt.selected = true;
        templeSelect.appendChild(opt);
      });

      templeSelect.addEventListener('change', (e) => {
        if (!e || !e.target) return;
        selectTempleById(e.target.value);
      });
    }

    // Custom Coords Apply Listener
    const btnApplyCoords = document.getElementById('btn-apply-coords');
    if (btnApplyCoords) {
      btnApplyCoords.addEventListener('click', () => {
        const latEl = document.getElementById('input-lat');
        const lonEl = document.getElementById('input-lon');
        const altEl = document.getElementById('input-alt');

        const latVal = latEl ? parseFloat(latEl.value) : NaN;
        const lonVal = lonEl ? parseFloat(lonEl.value) : NaN;
        const altVal = altEl ? parseFloat(altEl.value) || 0 : 0;

        if (Number.isFinite(latVal) && Number.isFinite(lonVal)) {
          LIVE_STATE.lat = latVal;
          LIVE_STATE.lon = lonVal;
          LIVE_STATE.alt = altVal;
          LIVE_STATE.selectedTempleId = 'custom';

          const descEl = document.getElementById('temple-desc');
          const sanskritEl = document.getElementById('temple-sanskrit');

          if (descEl) descEl.textContent = `Custom Coordinate Anchor (${latVal.toFixed(4)}°N, ${lonVal.toFixed(4)}°E)`;
          if (sanskritEl) sanskritEl.textContent = "स्वेच्छित स्थान (Custom Geodetic Anchor)";
          updatePanchangState();
        }
      });
    }
  }

  /**
   * Select Temple by ID and update all listeners
   */
  function selectTempleById(selectedId) {
    const anchors = getTempleAnchors();
    const temple = anchors.find(t => t && t.id === selectedId);

    if (temple) {
      LIVE_STATE.selectedTempleId = temple.id;
      LIVE_STATE.lat = temple.lat;
      LIVE_STATE.lon = temple.lon;
      LIVE_STATE.alt = temple.alt || 0;

      const inputLat = document.getElementById('input-lat');
      const inputLon = document.getElementById('input-lon');
      const inputAlt = document.getElementById('input-alt');
      const templeDesc = document.getElementById('temple-desc');
      const templeSanskrit = document.getElementById('temple-sanskrit');

      if (inputLat) inputLat.value = temple.lat;
      if (inputLon) inputLon.value = temple.lon;
      if (inputAlt) inputAlt.value = temple.alt || 0;
      if (templeDesc) templeDesc.textContent = temple.desc || '';
      if (templeSanskrit) templeSanskrit.textContent = temple.sanskrit || temple.nameSa || '';

      if (typeof window.selectTemple === 'function') {
        try { window.selectTemple(temple.id); } catch(e) {}
      }

      updatePanchangState();
    }
  }

  /**
   * Populate Ayanamsha Selector
   */
  function initAyanamshaUI() {
    const ayanSelect = document.getElementById('ayanamsha-select');
    if (!ayanSelect) return;

    ayanSelect.innerHTML = '';
    const modes = (typeof PanchangCore !== 'undefined' && PanchangCore.AYANAMSHA_MODES) 
      ? PanchangCore.AYANAMSHA_MODES 
      : (typeof ShunyaMath !== 'undefined' && ShunyaMath.AYANAMSHA_MODES ? ShunyaMath.AYANAMSHA_MODES : null);

    if (modes) {
      Object.keys(modes).forEach(key => {
        const mode = modes[key];
        if (!mode) return;
        const opt = document.createElement('option');
        opt.value = mode.id || '';
        opt.textContent = mode.name || key;
        if (mode.id === LIVE_STATE.ayanamsha) opt.selected = true;
        ayanSelect.appendChild(opt);
      });
    }

    ayanSelect.addEventListener('change', (e) => {
      if (!e || !e.target) return;
      LIVE_STATE.ayanamsha = e.target.value;
      updatePanchangState();
    });
  }

  /**
   * Interactive Katapayadi Encoder / Decoder
   */
  function initKatapayadiWidget() {
    const inputKatapayadi = document.getElementById('katapayadi-input');
    const resultDecoded = document.getElementById('katapayadi-decoded-val');
    const resultEncoded = document.getElementById('katapayadi-encoded-val');

    if (!inputKatapayadi) return;

    inputKatapayadi.addEventListener('input', (e) => {
      if (!e || !e.target) return;
      const val = (e.target.value || '').trim();
      if (!val) {
        if (resultDecoded) resultDecoded.textContent = '—';
        if (resultEncoded) resultEncoded.textContent = '—';
        return;
      }

      const Core = typeof PanchangCore !== 'undefined' ? PanchangCore : (typeof ShunyaMath !== 'undefined' ? ShunyaMath : null);
      if (!Core) return;

      if (/^\d+$/.test(val)) {
        const num = parseInt(val, 10);
        const encoded = typeof Core.encodeKatapayadi === 'function' ? Core.encodeKatapayadi(num) : '—';
        if (resultDecoded) resultDecoded.textContent = `Input Number: ${num}`;
        if (resultEncoded) resultEncoded.textContent = `Mnemonic Katapayadi String: ${encoded || '—'}`;
      } else {
        const decoded = typeof Core.decodeKatapayadi === 'function' ? Core.decodeKatapayadi(val) : '—';
        if (resultDecoded) resultDecoded.textContent = `Decoded Value (Right-to-Left): ${decoded ?? '—'}`;
        if (resultEncoded) resultEncoded.textContent = `Original Verse/Text: "${val}"`;
      }
    });
  }

  /**
   * Time Controls (Live Mode vs Time Slider / Custom Date Picker)
   */
  function initTimeControls() {
    const btnLiveMode = document.getElementById('btn-mode-live');
    const btnCustomTime = document.getElementById('btn-mode-custom');
    const datePicker = document.getElementById('custom-date-picker');

    if (btnLiveMode) {
      btnLiveMode.addEventListener('click', () => {
        LIVE_STATE.isLiveMode = true;
        LIVE_STATE.customTimeOverride = null;
        btnLiveMode.classList.add('active');
        if (btnCustomTime) btnCustomTime.classList.remove('active');
        if (datePicker) datePicker.style.display = 'none';
        updatePanchangState();
      });
    }

    if (btnCustomTime && datePicker) {
      btnCustomTime.addEventListener('click', () => {
        LIVE_STATE.isLiveMode = false;
        btnCustomTime.classList.add('active');
        if (btnLiveMode) btnLiveMode.classList.remove('active');
        datePicker.style.display = 'inline-block';
        if (!datePicker.value) {
          const now = new Date();
          now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
          datePicker.value = now.toISOString().slice(0, 16);
        }
        const customD = new Date(datePicker.value);
        if (!isNaN(customD.getTime())) {
          LIVE_STATE.customTimeOverride = customD;
        }
        updatePanchangState();
      });

      datePicker.addEventListener('change', (e) => {
        if (!e || !e.target) return;
        const customD = new Date(e.target.value);
        if (!isNaN(customD.getTime())) {
          LIVE_STATE.customTimeOverride = customD;
          updatePanchangState();
        }
      });
    }
  }

  /**
   * Initialize WhatsApp & Copy Share Triggers
   */
  function initShareButtons() {
    const waBtn = document.getElementById('waShareBtn');
    const copyBtn = document.getElementById('copyShareBtn');

    if (waBtn) {
      waBtn.addEventListener('click', () => {
        sharePanchangWhatsApp();
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        copyPanchangShareText();
      });
    }
  }

  /**
   * Main Panchang Calculation State Update
   */
  function updatePanchangState() {
    try {
      const targetDate = LIVE_STATE.isLiveMode 
        ? new Date() 
        : (LIVE_STATE.customTimeOverride && !isNaN(LIVE_STATE.customTimeOverride.getTime()) ? LIVE_STATE.customTimeOverride : new Date());
      LIVE_STATE.currentDate = targetDate;

      const Core = typeof PanchangCore !== 'undefined' ? PanchangCore : (typeof ShunyaMath !== 'undefined' ? ShunyaMath : null);

      if (Core && typeof Core.computeFullPanchang === 'function') {
        currentPanchang = Core.computeFullPanchang({
          date: targetDate,
          lat: LIVE_STATE.lat,
          lon: LIVE_STATE.lon,
          alt: LIVE_STATE.alt,
          ayanamsha: LIVE_STATE.ayanamsha
        });

        if (currentPanchang) {
          renderPanchangCards(currentPanchang);
          renderSolarHorizonCanvas(currentPanchang);
          renderEphemerisDetails(currentPanchang);
        }
      }
    } catch (err) {
      console.warn('[PAGE-LIVE] Error updating Panchang state:', err);
    }
  }

  /**
   * Start 100ms Live Clock Ticker for Vighati & Prana
   */
  function startLiveClock() {
    function tick() {
      try {
        const Core = typeof PanchangCore !== 'undefined' ? PanchangCore : (typeof ShunyaMath !== 'undefined' ? ShunyaMath : null);
        const now = LIVE_STATE.isLiveMode ? new Date() : (LIVE_STATE.customTimeOverride || new Date());
        LIVE_STATE.currentDate = now;

        if (currentPanchang && currentPanchang.solarData && currentPanchang.solarData.sunrise instanceof Date) {
          const ista = (Core && typeof Core.calculateIstaKala === 'function')
            ? Core.calculateIstaKala(now, currentPanchang.solarData.sunrise)
            : null;
          currentPanchang.istaKala = ista;
          updateLiveClockDOM(now, ista);
        } else {
          updateLiveClockDOM(now, null);
        }

        // Daily sunrise refresh trigger
        if (currentPanchang && currentPanchang.solarData && currentPanchang.solarData.sunrise instanceof Date) {
          const diffMs = Math.abs(LIVE_STATE.currentDate.getTime() - currentPanchang.solarData.sunrise.getTime());
          if (diffMs < 2000) {
            updatePanchangState();
          }
        }
      } catch (err) {
        console.warn('[PAGE-LIVE] Tick exception:', err);
      }

      setTimeout(tick, 100);
    }
    tick();
  }

  /**
   * Update Live Clock DOM Elements (IST, UTC, Ghati, Vighati, Prana, Vipala)
   */
  function updateLiveClockDOM(nowDate, istaKala) {
    if (!(nowDate instanceof Date) || isNaN(nowDate.getTime())) return;

    const clockIst = document.getElementById('clock-ist');
    const clockUtc = document.getElementById('clock-utc');
    const clockIstaGhati = document.getElementById('clock-ista-ghati');
    const clockIstaVighati = document.getElementById('clock-ista-vighati');
    const clockIstaPrana = document.getElementById('clock-ista-prana');

    if (clockIst) {
      clockIst.textContent = nowDate.toLocaleTimeString('en-US', { hour12: false });
    }

    if (clockUtc) {
      const h = String(nowDate.getUTCHours()).padStart(2, '0');
      const m = String(nowDate.getUTCMinutes()).padStart(2, '0');
      const s = String(nowDate.getUTCSeconds()).padStart(2, '0');
      clockUtc.textContent = `${h}:${m}:${s} UTC`;
    }

    if (istaKala) {
      if (clockIstaGhati) {
        clockIstaGhati.textContent = `${String(istaKala.ghati ?? 0).padStart(2, '0')} Ghaṭī`;
      }
      if (clockIstaVighati) {
        clockIstaVighati.textContent = `${String(istaKala.vighati ?? 0).padStart(2, '0')} Vighaṭī`;
      }
      if (clockIstaPrana) {
        clockIstaPrana.textContent = `${String(istaKala.prana ?? 0).padStart(2, '0')} Prāṇa (${String(istaKala.vipala ?? 0).padStart(2, '0')} Vipala)`;
      }

      const ghatiProgress = document.getElementById('ghati-progress-bar');
      if (ghatiProgress && Number.isFinite(istaKala.ghati)) {
        const pct = Math.min(100, Math.max(0, (istaKala.ghati / 60) * 100));
        ghatiProgress.style.width = `${pct.toFixed(2)}%`;
      }
    } else {
      // Fallback Ghati/Vighati calculation from midnight if sunrise istaKala unavailable
      const msToday = (nowDate.getHours() * 3600 + nowDate.getMinutes() * 60 + nowDate.getSeconds()) * 1000 + nowDate.getMilliseconds();
      const totalSec = msToday / 1000;
      const totalGhati = (totalSec / 86400) * 60;
      const ghati = Math.floor(totalGhati);
      const remVighati = (totalGhati - ghati) * 60;
      const vighati = Math.floor(remVighati);
      const prana = Math.floor((remVighati - vighati) * 6);
      const vipala = Math.floor((remVighati - vighati) * 60);

      if (clockIstaGhati) clockIstaGhati.textContent = `${String(ghati).padStart(2, '0')} Ghaṭī`;
      if (clockIstaVighati) clockIstaVighati.textContent = `${String(vighati).padStart(2, '0')} Vighaṭī`;
      if (clockIstaPrana) clockIstaPrana.textContent = `${String(prana).padStart(2, '0')} Prāṇa (${String(vipala).padStart(2, '0')} Vipala)`;
    }
  }

  /**
   * Render 5-Limb Anga Cards in DOM (Tithi, Vara, Nakshatra, Yoga, Karana)
   */
  function renderPanchangCards(p) {
    if (!p) return;

    const safePct = (val) => Number.isFinite(val) ? val.toFixed(1) : '0.0';

    // 1. TITHI CARD
    const tithiName = (p.tithi && p.tithi.name) || p.tithiName || 'Pratipada';
    const tithiPaksha = (p.tithi && p.tithi.paksha) || p.paksha || 'Shukla';
    const tithiNum = (p.tithi && p.tithi.number) ?? ((p.tithiIndex ?? 0) + 1);
    const tithiNature = (p.tithi && p.tithi.nature) || 'Nanda';
    const tithiRuler = (p.tithi && p.tithi.ruler) || 'Agni';
    const tithiDeity = (p.tithi && p.tithi.deity) || 'Brahma';
    const tithiKata = (p.tithi && p.tithi.katapayadi) || '—';
    const tithiPct = (p.tithi && p.tithi.elapsedPct) ?? p.tithiBhuktaPct ?? 0;

    setText('tithi-name', `${tithiName} (${tithiPaksha} Paksha)`);
    setText('tithi-meta', `Tithi #${tithiNum} · Nature: ${tithiNature} · Ruler: ${tithiRuler} · Deity: ${tithiDeity}`);
    setText('tithi-katapayadi-code', `Katapayadi Code: ${tithiKata}`);
    setBarWidth('tithi-progress-bar', tithiPct);
    setText('tithi-pct-text', `${safePct(tithiPct)}% Elapsed`);

    // 2. NAKSHATRA CARD
    const nakName = (p.nakshatra && p.nakshatra.name) || p.nakshatraName || 'Ashwini';
    const nakPada = (p.nakshatra && p.nakshatra.pada) ?? p.nakshatraPada ?? 1;
    const nakRuler = (p.nakshatra && p.nakshatra.ruler) || p.nakshatraLord || 'Ketu';
    const nakDeity = (p.nakshatra && p.nakshatra.deity) || 'Ashwini Kumaras';
    const nakGana = (p.nakshatra && p.nakshatra.gana) || 'Deva';
    const nakYoni = (p.nakshatra && p.nakshatra.yoni) || 'Ashwa';
    const nakSymbol = (p.nakshatra && p.nakshatra.symbol) || 'Horse Head';
    const nakKata = (p.nakshatra && p.nakshatra.katapayadi) || '—';
    const nakPct = (p.nakshatra && p.nakshatra.elapsedPct) ?? p.nakshatraBhuktaPct ?? 0;

    setText('nakshatra-name', `${nakName} (Pada ${nakPada})`);
    setText('nakshatra-meta', `Ruler: ${nakRuler} · Deity: ${nakDeity} · Gana: ${nakGana} · Yoni: ${nakYoni}`);
    setText('nakshatra-symbol', `Symbol: ${nakSymbol} · Katapayadi: ${nakKata}`);
    setBarWidth('nakshatra-progress-bar', nakPct);
    setText('nakshatra-pct-text', `${safePct(nakPct)}% Elapsed`);

    // 3. YOGA CARD
    const yogaName = (p.yoga && p.yoga.name) || p.yogaName || 'Vishkambha';
    const yogaStatus = (p.yoga && p.yoga.status) || 'Subha';
    const yogaNum = (p.yoga && p.yoga.number) ?? ((p.yogaIndex ?? 0) + 1);
    const yogaRuler = (p.yoga && p.yoga.ruler) || 'Surya';
    const yogaPct = (p.yoga && p.yoga.elapsedPct) ?? 50.0;

    setText('yoga-name', `${yogaName} (${yogaStatus})`);
    setText('yoga-meta', `Yoga #${yogaNum} · Ruler: ${yogaRuler}`);
    setBarWidth('yoga-progress-bar', yogaPct);
    setText('yoga-pct-text', `${safePct(yogaPct)}% Elapsed`);

    // 4. KARANA CARD
    const karanaName = (p.karana && p.karana.name) || p.karanaName || 'Bava';
    const karanaType = (p.karana && p.karana.type) || p.karanaType || 'Chara';
    const karanaRuler = (p.karana && p.karana.ruler) || 'Indra';
    const karanaPct = (p.karana && p.karana.elapsedPct) ?? 50.0;

    setText('karana-name', `${karanaName} (${karanaType})`);
    setText('karana-meta', `Ruler: ${karanaRuler} · Half-Tithi Division`);
    setBarWidth('karana-progress-bar', karanaPct);
    setText('karana-pct-text', `${safePct(karanaPct)}% Elapsed`);

    // 5. VARA CARD
    const varaName = (p.vara && p.vara.name) || p.varaName || 'Ravivara';
    const varaEng = (p.vara && p.vara.english) || 'Sunday';
    const varaRuler = (p.vara && p.vara.ruler) || 'Surya';
    const varaElem = (p.vara && p.vara.element) || 'Agni';
    const varaGem = (p.vara && p.vara.gem) || 'Ruby (Manikya)';

    setText('vara-name', `${varaName} (${varaEng})`);
    setText('vara-meta', `Day Lord: ${varaRuler} · Element: ${varaElem} · Gemstone: ${varaGem}`);
    const varaBadge = document.getElementById('vara-badge');
    if (varaBadge) {
      if (p.vara && p.vara.color) varaBadge.style.backgroundColor = p.vara.color;
      varaBadge.textContent = varaName;
    }

    // SOLAR TIMES
    if (p.solarData) {
      if (p.solarData.sunrise instanceof Date && !isNaN(p.solarData.sunrise.getTime())) {
        setText('time-sunrise', p.solarData.sunrise.toLocaleTimeString('en-US', { hour12: true }));
      }
      if (p.solarData.sunset instanceof Date && !isNaN(p.solarData.sunset.getTime())) {
        setText('time-sunset', p.solarData.sunset.toLocaleTimeString('en-US', { hour12: true }));
      }
      if (p.solarData.solarNoon instanceof Date && !isNaN(p.solarData.solarNoon.getTime())) {
        setText('time-noon', p.solarData.solarNoon.toLocaleTimeString('en-US', { hour12: true }));
      }
    }

    // MUHURTAS
    if (p.muhurtas) {
      if (p.muhurtas.brahma) setText('time-brahma', `${formatTime(p.muhurtas.brahma.start)} – ${formatTime(p.muhurtas.brahma.end)}`);
      if (p.muhurtas.abhijit) setText('time-abhijit', `${formatTime(p.muhurtas.abhijit.start)} – ${formatTime(p.muhurtas.abhijit.end)}`);
      if (p.muhurtas.rahuKaal) setText('time-rahu', `${formatTime(p.muhurtas.rahuKaal.start)} – ${formatTime(p.muhurtas.rahuKaal.end)}`);
      if (p.muhurtas.yamaganda) setText('time-yamaganda', `${formatTime(p.muhurtas.yamaganda.start)} – ${formatTime(p.muhurtas.yamaganda.end)}`);
    }
  }

  /**
   * Render Solar Horizon Canvas Visualization
   */
  function renderSolarHorizonCanvas(p) {
    const canvas = document.getElementById('solar-horizon-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parentWidth = canvas.parentElement ? canvas.parentElement.clientWidth : 600;
    const width = canvas.width = parentWidth || 600;
    const height = canvas.height = 200;

    // Clear background
    ctx.fillStyle = '#040814';
    ctx.fillRect(0, 0, width, height);

    // Horizon line
    const horizonY = height - 40;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(width, horizonY);
    ctx.stroke();

    // Ground fill
    ctx.fillStyle = '#091122';
    ctx.fillRect(0, horizonY, width, height - horizonY);

    if (!p || !p.solarData || !(p.solarData.sunrise instanceof Date) || !(p.solarData.sunset instanceof Date)) return;

    const srTime = p.solarData.sunrise.getTime();
    const ssTime = p.solarData.sunset.getTime();
    const curTime = (p.timestamp instanceof Date ? p.timestamp : new Date()).getTime();

    if (isNaN(srTime) || isNaN(ssTime) || isNaN(curTime)) return;

    // Solar Arc Path
    const centerX = width / 2;
    const radiusX = Math.max(10, (width - 80) / 2);
    const radiusY = height - 70;

    ctx.strokeStyle = 'rgba(255, 184, 0, 0.25)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(centerX, horizonY, radiusX, radiusY, 0, Math.PI, 2 * Math.PI, false);
    ctx.stroke();
    ctx.setLineDash([]);

    // Calculate Sun Angle & Position along Arc
    let isDay = curTime >= srTime && curTime <= ssTime;
    let sunRatio = 0;

    const dayDuration = ssTime - srTime;
    if (isDay) {
      sunRatio = dayDuration > 0 ? (curTime - srTime) / dayDuration : 0.5;
    } else {
      const nextSrTime = srTime + 86400000;
      const nightDuration = nextSrTime - ssTime;
      sunRatio = nightDuration > 0 ? (curTime - ssTime) / nightDuration : 0.5;
    }

    if (!Number.isFinite(sunRatio)) sunRatio = 0.5;

    const angle = isDay 
      ? Math.PI + (sunRatio * Math.PI)
      : (sunRatio * Math.PI);

    const sunX = centerX + radiusX * Math.cos(angle);
    const sunY = horizonY + radiusY * Math.sin(angle);

    if (Number.isFinite(sunX) && Number.isFinite(sunY)) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = isDay ? '#ffb800' : '#00d8f6';

      ctx.fillStyle = isDay ? '#ffb800' : '#00d8f6';
      ctx.beginPath();
      ctx.arc(sunX, sunY, isDay ? 10 : 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Labels
    ctx.font = '11px "Fira Code", monospace';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`EAST (Sunrise: ${formatTime(p.solarData.sunrise)})`, 20, horizonY + 24);

    ctx.fillStyle = '#ef4444';
    ctx.fillText(`WEST (Sunset: ${formatTime(p.solarData.sunset)})`, Math.max(20, width - 180), horizonY + 24);

    ctx.fillStyle = '#00d8f6';
    ctx.fillText(`ZENITH (Noon: ${formatTime(p.solarData.solarNoon)})`, Math.max(10, centerX - 70), 30);
  }

  /**
   * Render High Precision Ephemeris Table
   */
  function renderEphemerisDetails(p) {
    if (!p) return;
    const safeFloat = (val, dec = 6) => Number.isFinite(val) ? val.toFixed(dec) : '0.000000';

    setText('eph-jd', safeFloat(p.julianDate));
    if (p.ayanamsha) {
      setText('eph-ayanamsha', `${p.ayanamsha.name || 'LAHIRI'}: ${safeFloat(p.ayanamsha.value)}°`);
    }
    if (p.positions) {
      setText('eph-sun-sayana', `${safeFloat(p.positions.sunSayana)}°`);
      setText('eph-moon-sayana', `${safeFloat(p.positions.moonSayana)}°`);
      setText('eph-sun-nirayana', `${safeFloat(p.positions.sunNirayana)}°`);
      setText('eph-moon-nirayana', `${safeFloat(p.positions.moonNirayana)}°`);
    }
  }

  /**
   * Format WhatsApp Share Text & Open WhatsApp
   */
  function sharePanchangWhatsApp() {
    const text = buildPanchangShareSummary();
    const opened = window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    if (!opened && navigator.share) {
      navigator.share({ title: 'आज का पञ्चाङ्ग', text }).catch(() => {});
    }
  }

  /**
   * Copy Panchang Share Text to Clipboard
   */
  function copyPanchangShareText() {
    const text = buildPanchangShareSummary();
    navigator.clipboard.writeText(text).then(
      () => flashShareStatus('✓ WhatsApp text copied to clipboard!'),
      () => flashShareStatus('Copy failed — please select manually.')
    );
  }

  /**
   * Build Formatted Panchang Summary for Sharing
   */
  function buildPanchangShareSummary() {
    const p = currentPanchang;
    const templeName = LIVE_STATE.selectedTempleId || 'Ujjain Mahakaleshwar';
    const nowStr = LIVE_STATE.currentDate.toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    if (!p) {
      return `🕉 आज का पञ्चाङ्ग (${nowStr}) · ${templeName}\n\nविस्तृत पञ्चाङ्ग देखें: https://bharatephemeris.org/panchang.html`;
    }

    const tithiStr = (p.tithi && p.tithi.name) ? `${p.tithi.name} (${p.tithi.paksha} Paksha)` : (p.tithiName || '—');
    const nakStr = (p.nakshatra && p.nakshatra.name) ? `${p.nakshatra.name} (Pada ${p.nakshatra.pada})` : (p.nakshatraName || '—');
    const yogaStr = (p.yoga && p.yoga.name) || p.yogaName || '—';
    const karanaStr = (p.karana && p.karana.name) || p.karanaName || '—';
    const varaStr = (p.vara && p.vara.name) || p.varaName || '—';

    return `🕉 आज का शास्त्रीय पञ्चाङ्ग · ${nowStr}\n` +
      `🚩 मन्दिर स्थान: ${templeName}\n` +
      `-----------------------------------\n` +
      `• तिथि: ${tithiStr}\n` +
      `• नक्षत्र: ${nakStr}\n` +
      `• वार: ${varaStr}\n` +
      `• योग: ${yogaStr}\n` +
      `• करण: ${karanaStr}\n` +
      `-----------------------------------\n` +
      `हर अंक आपके यन्त्र में computed — भारत Ephemeris Sovereign Substrate\n` +
      `https://bharatephemeris.org/panchang.html`;
  }

  function flashShareStatus(msg) {
    const el = document.getElementById('shareStatus');
    if (el) {
      el.textContent = msg;
      setTimeout(() => { el.textContent = ''; }, 3000);
    }
  }

  // HELPER FUNCTIONS
  function setText(id, text) {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.textContent = text == null ? '' : String(text);
  }

  function setBarWidth(id, pct) {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) {
      const validPct = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
      el.style.width = `${validPct.toFixed(2)}%`;
    }
  }

  function formatTime(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  // EXPOSE TO GLOBAL
  global.PageLive = {
    LIVE_STATE,
    updatePanchangState,
    selectTempleById,
    sharePanchangWhatsApp,
    copyPanchangShareText
  };

})(typeof window !== 'undefined' ? window : this);
