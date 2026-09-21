import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const contentScript = fs.readFileSync(new URL("../src/content.js", import.meta.url), "utf8");
const contentStyles = fs.readFileSync(new URL("../src/content.css", import.meta.url), "utf8");
const popupMarkup = fs.readFileSync(new URL("../src/popup.html", import.meta.url), "utf8");
const popupScript = fs.readFileSync(new URL("../src/popup.js", import.meta.url), "utf8");
const optionsMarkup = fs.readFileSync(new URL("../src/options.html", import.meta.url), "utf8");
const manifest = JSON.parse(fs.readFileSync(new URL("../src/manifest.json", import.meta.url), "utf8"));

async function renderWithPageColors({
  bodyColor,
  rootColor,
  rootColorScheme = "normal",
  sampleColors = [],
  delayedSampleColors = null,
  settings = { globalEnabled: true, disabledUntil: 0, dim: 10, preserveMedia: true, sites: {} }
}) {
  const root = {
    dataset: {},
    style: { setProperty() {} },
    appendChild() {},
    clientWidth: 1000,
    clientHeight: 800,
    parentElement: null
  };
  const body = { parentElement: root };
  let currentSampleColors = sampleColors;
  let sampleIndex = 0;
  const timers = [];
  const context = {
    chrome: {
      storage: {
        sync: {
          get: async () => settings
        },
        onChanged: { addListener() {} }
      },
      runtime: { onMessage: { addListener() {} } }
    },
    document: {
      documentElement: root,
      body,
      readyState: "complete",
      getElementById: () => null,
      createElement: () => ({ setAttribute() {} }),
      elementFromPoint: () => {
        const backgroundColor = currentSampleColors[sampleIndex++];
        return backgroundColor ? { backgroundColor, parentElement: body } : null;
      },
      addEventListener() {}
    },
    location: { protocol: "https:", hostname: "example.test" },
    getComputedStyle: (element) => ({
      backgroundColor: element.backgroundColor ?? (element === body ? bodyColor : rootColor),
      colorScheme: element === root ? rootColorScheme : "normal"
    }),
    window: { innerWidth: 1000, innerHeight: 800 },
    requestAnimationFrame: (callback) => callback(),
    setTimeout: (callback, delay) => {
      timers.push({ callback, delay });
      return timers.length;
    },
    clearTimeout() {}
  };

  vm.runInNewContext(contentScript, context);
  await new Promise((resolve) => setImmediate(resolve));
  if (delayedSampleColors) {
    currentSampleColors = delayedSampleColors;
    sampleIndex = 0;
    timers.find(({ delay }) => delay === 2000)?.callback();
  }
  return root.dataset;
}

test("project and manifest versions are 0.1.0", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "0.1.0");
  assert.equal(manifest.content_scripts[0].all_frames, false);
  assert.deepEqual(manifest.options_ui, { page: "options.html", open_in_tab: true });
});

test("manifest exposes correctly sized Chrome icons", () => {
  const expected = { 16: "icons/icon16.png", 32: "icons/icon32.png", 48: "icons/icon48.png", 128: "icons/icon128.png" };
  assert.deepEqual(manifest.icons, expected);
  assert.deepEqual(manifest.action.default_icon, { 16: expected[16], 32: expected[32] });

  for (const [size, relativePath] of Object.entries(expected)) {
    const png = fs.readFileSync(new URL(`../src/${relativePath}`, import.meta.url));
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), Number(size));
    assert.equal(png.readUInt32BE(20), Number(size));
  }
});

test("popup offers timed global pause presets", () => {
  assert.match(popupMarkup, /select id="pause-duration"/);
  assert.match(popupMarkup, /id="pause-global"/);
  assert.match(popupMarkup, /id="resume-global"/);
});

test("popup separates site policy from observed page status", () => {
  assert.match(popupMarkup, /id="state-title"/);
  for (const mode of ["auto", "always", "never"]) assert.ok(popupMarkup.includes(`value="${mode}"`));
  assert.match(popupScript, /Already dark, left as is/);
  assert.match(popupMarkup, /id="undo"/);
});

test("settings page exposes global defaults and per-site rules", () => {
  assert.match(popupMarkup, /id="open-settings"/);
  assert.match(optionsMarkup, /id="global-enabled"/);
  assert.match(optionsMarkup, /id="site-list"/);
  assert.match(optionsMarkup, /Native-dark detection is live, not logged/);
});

test("transparent page gutters become dark after root inversion", () => {
  assert.match(contentStyles, /background: #eee !important;/);
});

test("light pages receive Nightshade", async () => {
  const result = await renderWithPageColors({
    bodyColor: "rgb(255, 255, 255)",
    rootColor: "rgba(0, 0, 0, 0)"
  });
  assert.equal(result.nightshadeActive, "true");
  assert.equal(result.nightshadeAutoSkipped, "false");
});

test("native dark body backgrounds are skipped", async () => {
  const result = await renderWithPageColors({
    bodyColor: "rgb(32, 33, 36)",
    rootColor: "rgba(0, 0, 0, 0)"
  });
  assert.equal(result.nightshadeActive, "false");
  assert.equal(result.nightshadeAutoSkipped, "true");
});

test("Google-style native dark root backgrounds are skipped", async () => {
  const result = await renderWithPageColors({
    bodyColor: "rgba(0, 0, 0, 0)",
    rootColor: "rgb(32, 33, 36)"
  });
  assert.equal(result.nightshadeActive, "false");
  assert.equal(result.nightshadeAutoSkipped, "true");
});

test("author-declared dark color schemes are skipped", async () => {
  const result = await renderWithPageColors({
    bodyColor: "rgba(0, 0, 0, 0)",
    rootColor: "rgba(0, 0, 0, 0)",
    rootColorScheme: "dark"
  });
  assert.equal(result.nightshadeActive, "false");
});

test("Gmail-style dark descendant surfaces are skipped", async () => {
  const result = await renderWithPageColors({
    bodyColor: "rgba(0, 0, 0, 0)",
    rootColor: "rgba(0, 0, 0, 0)",
    sampleColors: Array(9).fill("rgb(31, 31, 31)")
  });
  assert.equal(result.nightshadeActive, "false");
  assert.equal(result.nightshadeAutoSkipped, "true");
});

test("a delayed Gmail-style dark shell is rechecked", async () => {
  const result = await renderWithPageColors({
    bodyColor: "rgba(0, 0, 0, 0)",
    rootColor: "rgba(0, 0, 0, 0)",
    sampleColors: Array(9).fill("rgb(246, 248, 252)"),
    delayedSampleColors: Array(9).fill("rgb(31, 31, 31)")
  });
  assert.equal(result.nightshadeActive, "false");
  assert.equal(result.nightshadeAutoSkipped, "true");
});

test("an explicit site enable still forces dark descendant surfaces", async () => {
  const result = await renderWithPageColors({
    bodyColor: "rgba(0, 0, 0, 0)",
    rootColor: "rgba(0, 0, 0, 0)",
    sampleColors: Array(9).fill("rgb(31, 31, 31)"),
    settings: {
      globalEnabled: true,
      disabledUntil: 0,
      dim: 10,
      preserveMedia: true,
      sites: { "example.test": { enabled: true } }
    }
  });
  assert.equal(result.nightshadeActive, "true");
  assert.equal(result.nightshadeAutoSkipped, "false");
});

test("a minority dark panel does not make a light app look native-dark", async () => {
  const result = await renderWithPageColors({
    bodyColor: "rgba(0, 0, 0, 0)",
    rootColor: "rgba(0, 0, 0, 0)",
    sampleColors: [
      ...Array(6).fill("rgb(246, 248, 252)"),
      ...Array(3).fill("rgb(31, 31, 31)")
    ]
  });
  assert.equal(result.nightshadeActive, "true");
  assert.equal(result.nightshadeAutoSkipped, "false");
});

test("a timed global pause overrides an explicit site enable", async () => {
  const result = await renderWithPageColors({
    bodyColor: "rgb(255, 255, 255)",
    rootColor: "rgba(0, 0, 0, 0)",
    settings: {
      globalEnabled: true,
      disabledUntil: Date.now() + 60_000,
      dim: 10,
      preserveMedia: true,
      sites: { "example.test": { enabled: true } }
    }
  });
  assert.equal(result.nightshadeActive, "false");
  assert.equal(result.nightshadePaused, "true");
});

test("an expired global pause resumes automatically", async () => {
  const result = await renderWithPageColors({
    bodyColor: "rgb(255, 255, 255)",
    rootColor: "rgba(0, 0, 0, 0)",
    settings: {
      globalEnabled: true,
      disabledUntil: Date.now() - 1,
      dim: 10,
      preserveMedia: true,
      sites: {}
    }
  });
  assert.equal(result.nightshadeActive, "true");
  assert.equal(result.nightshadePaused, "false");
});
