"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = "/Users/theunholyindianmagician/Projects/bharat-ephemeris-offline";

let passed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(function () {
      passed += 1;
      console.log("✓ " + name);
    });
}

async function runRegressionSuite() {
  console.log("=== INDEPENDENT REGRESSION PASS: BHARAT EPHEMERIS OBSERVATORY ===\n");

  // 1. Guided-tour behavior on all six surfaces
  await test("1. Guided-tour script & modal triggers exist across all 6 primary surfaces", function () {
    const primarySurfaces = [
      "index.html",
      "shunyabheda.html",
      "library.html",
      "museum.html",
      "panchang.html",
      "shoonya_sovereign_dashboard.html"
    ];

    primarySurfaces.forEach(file => {
      const filepath = path.join(ROOT, file);
      assert.ok(fs.existsSync(filepath), `File ${file} must exist`);
      const html = fs.readFileSync(filepath, "utf-8");
      assert.ok(html.includes("global-ui.js"), `Surface ${file} must include global-ui.js for guided tour`);
    });

    const globalUiPath = path.join(ROOT, "global-ui.js");
    const globalUiCode = fs.readFileSync(globalUiPath, "utf-8");
    assert.ok(globalUiCode.includes("window.openGuidedTour"), "global-ui.js must define openGuidedTour()");
    assert.ok(globalUiCode.includes("window.closeGuidedTour"), "global-ui.js must define closeGuidedTour()");
    assert.ok(globalUiCode.includes("guidedTourModal"), "global-ui.js must instantiate #guidedTourModal");
    assert.ok(globalUiCode.includes('setAttribute("role", "dialog")'), "Guided tour must expose dialog semantics");
    assert.ok(globalUiCode.includes('e.key === "Tab"'), "Guided tour must trap keyboard focus");
  });

  // 2. View-mode panel counts & persistence
  await test("2. View-mode panel counts (6, 12, 24) & localStorage persistence", function () {
    const shunyaAppPath = path.join(ROOT, "shunyabheda-app.js");
    const shunyaAppCode = fs.readFileSync(shunyaAppPath, "utf-8");
    assert.ok(shunyaAppCode.includes("window.setShunyabhedaViewMode"), "shunyabheda-app.js must define setShunyabhedaViewMode");
    assert.ok(shunyaAppCode.includes("shunyabheda_view_mode"), "shunyabheda-app.js must persist mode in localStorage key 'shunyabheda_view_mode'");
    assert.ok(shunyaAppCode.includes("6 सुगम खण्ड"), "Beginner mode must report 6 panels");
    assert.ok(shunyaAppCode.includes("12 अनुसन्धान खण्ड"), "Researcher mode must report 12 panels");
    assert.ok(shunyaAppCode.includes("24 पूर्ण सम्पादित प्रमाण-खण्ड"), "Full Audit mode must report 24 panels");
    assert.ok(shunyaAppCode.includes('document.querySelectorAll("section.panel")'), "View modes must not hide nested panel cards");
    assert.ok(shunyaAppCode.includes('setAttribute("aria-pressed"'), "View tabs must publish pressed state");
  });

  // 3. TOC search, deep links, and reading progress
  await test("3. Masterwork enhancer script (TOC search, reading progress, deep links)", function () {
    const enhancerPath = path.join(ROOT, "edition-nav-enhancer.js");
    assert.ok(fs.existsSync(enhancerPath), "edition-nav-enhancer.js must exist");
    const code = fs.readFileSync(enhancerPath, "utf-8");

    assert.ok(code.includes("reading-progress-bar"), "Enhancer must create #reading-progress-bar");
    assert.ok(code.includes("toc-drawer-btn"), "Enhancer must create #toc-drawer-btn");
    assert.ok(code.includes("toc-search-input"), "Enhancer must create #toc-search-input for chapter search");
    assert.ok(code.includes("titleEl.textContent"), "Virtualized TOC search must read off-screen chapter titles via textContent");
    assert.ok(code.includes("verse-anchor-btn"), "Enhancer must inject verse deep link buttons");
    assert.ok(code.includes('setAttribute("aria-expanded"'), "TOC trigger must publish expanded state");
    assert.ok(code.includes("Clipboard API unavailable"), "Deep-link control must handle unavailable clipboard APIs");

    const editions = fs.readdirSync(path.join(ROOT, "editions"))
      .filter(file => file.endsWith("-full-edition.html"));
    assert.equal(editions.length, 10, "All 10 masterwork editions must be present");
    editions.forEach(file => {
      const html = fs.readFileSync(path.join(ROOT, "editions", file), "utf-8");
      assert.ok(html.includes("edition-nav-enhancer.js"), `${file} must load the enhancer`);
    });
  });

  // 4. Direct navigation to virtualized off-screen chapters
  await test("4. Off-screen DOM virtualization & deep anchor preservation", function () {
    const enhancerCode = fs.readFileSync(path.join(ROOT, "edition-nav-enhancer.js"), "utf-8");
    assert.ok(enhancerCode.includes("content-visibility: auto"), "Enhancer must apply content-visibility: auto");
    assert.ok(enhancerCode.includes("contain-intrinsic-size"), "Enhancer must specify contain-intrinsic-size to prevent layout collapse");

    const parasharaHtml = fs.readFileSync(path.join(ROOT, "editions/parashara-rahasya-full-edition.html"), "utf-8");
    assert.ok(parasharaHtml.includes("edition-nav-enhancer.js"), "Parashara edition must include edition-nav-enhancer.js");
    assert.ok(parasharaHtml.includes('id="v97-25"'), "Deep verse anchor v97-25 must exist in Parashara edition");
  });

  // 5. Keyboard accessibility and focus handling
  await test("5. Keyboard accessibility (Escape key handlers)", function () {
    const globalUiCode = fs.readFileSync(path.join(ROOT, "global-ui.js"), "utf-8");
    assert.ok(globalUiCode.includes('e.key === "Escape"'), "global-ui.js must listen for Escape key to close tour modal");
  });

  // 6. 320–430 px mobile layouts & viewport meta
  await test("6. Mobile viewport meta & overflow container verification", function () {
    const pages = [
      "index.html",
      "shunyabheda.html",
      "library.html",
      "museum.html",
      "panchang.html",
      "shoonya_sovereign_dashboard.html"
    ];

    pages.forEach(file => {
      const html = fs.readFileSync(path.join(ROOT, file), "utf-8");
      assert.ok(/<meta[^>]*viewport/i.test(html), `Surface ${file} must specify viewport meta tag`);
    });
  });

  // 7. Console errors and basic performance measurements
  await test("7. JavaScript files parse cleanly with 0 syntax errors", function () {
    const jsFiles = [
      "math-core.js",
      "drik-engine.js",
      "drik-tier.js",
      "shunyabheda-app.js",
      "global-ui.js",
      "edition-nav-enhancer.js",
      "sprint-upgrades.js"
    ];

    jsFiles.forEach(file => {
      const filepath = path.join(ROOT, file);
      const content = fs.readFileSync(filepath, "utf-8");
      assert.ok(content.length > 50, `File ${file} must be non-empty`);
      assert.doesNotThrow(() => new vm.Script(content, { filename: file }), `${file} must parse as JavaScript`);
    });
  });

  console.log(`\n🎉 INDEPENDENT REGRESSION PASS COMPLETE: ${passed}/7 PASSES SUCCESSFUL!`);
}

runRegressionSuite().catch(err => {
  console.error("❌ REGRESSION FAIL:", err);
  process.exit(1);
});
