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
  readyState = "complete",
  cachedTheme,
  incognito = false,
  storageFails = false,
  exercise,
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
  const events = {}, windowEvents = {}, writes = [];
  const context = {
    chrome: {
      extension: { inIncognitoContext: incognito },
      storage: {
        local: {
          get: async () => { if (storageFails) throw Error("unavailable"); return { "nightshade:theme:example.test": cachedTheme }; },
          set: async (value) => { writes.push(value); }
        },
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
      readyState,
      getElementById: () => null,
      createElement: () => ({ setAttribute() {} }),
      elementFromPoint: () => {
        const backgroundColor = currentSampleColors[sampleIndex++ % currentSampleColors.length];
        return backgroundColor ? { backgroundColor, parentElement: body } : null;
      },
      addEventListener(name, callback) { events[name] = callback; }
    },
    location: { protocol: "https:", hostname: "example.test" },
    getComputedStyle: (element) => ({
      backgroundColor: element.backgroundColor ?? (element === body ? bodyColor : rootColor),
      colorScheme: element === root ? rootColorScheme : "normal"
    }),
    window: { innerWidth: 1000, innerHeight: 800, addEventListener(name, callback) { windowEvents[name] = callback; } },
    requestAnimationFrame: (callback) => callback(),
    setTimeout: (callback, delay) => {
      timers.push({ callback, delay });
      return timers.length;
    },
    clearTimeout() {}
  };

  vm.runInNewContext(contentScript, context);
  await new Promise((resolve) => setImmediate(resolve));
  if (exercise) await exercise({ root, events, windowEvents, timers, writes, context });
  if (delayedSampleColors) {
    currentSampleColors = delayedSampleColors;
    sampleIndex = 0;
    timers.find(({ delay }) => delay === 2000)?.callback();
  }
  return root.dataset;
}

test("project and manifest versions are 0.2.0", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "0.2.0");
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
  assert.match(optionsMarkup, /Theme memory stays on this device/);
});

test("transparent page gutters become dark after root inversion", () => {
  assert.match(contentStyles, /background: #eee !important;/);
});

test("startup does not invert unknown pages and has a bounded guard", () => {
  assert.doesNotMatch(contentStyles, /:root:not\(\[data-nightshade-ready\]\),\s*:root\[data-nightshade-active/);
  assert.match(contentStyles, /nightshade-startup-release 0s 1s forwards/);
});

for (const dark of [true, false]) {
  test(`remembered ${dark ? "dark" : "light"} theme stays stable until load, then updates`, async () => {
    await renderWithPageColors({
      bodyColor: dark ? "rgb(255, 255, 255)" : "rgb(20, 20, 20)", rootColor: "transparent",
      readyState: "loading", cachedTheme: { dark, at: Date.now() },
      exercise({ root, events, windowEvents, timers, writes, context }) {
        assert.equal(root.dataset.nightshadeReady, undefined);
        context.document.readyState = "interactive";
        events.DOMContentLoaded();
        assert.equal(root.dataset.nightshadeAutoSkipped, String(dark));
        timers.find(t => t.delay === 2000).callback();
        assert.equal(root.dataset.nightshadeAutoSkipped, String(dark));
        assert.equal(writes.length, 0);
        context.document.readyState = "complete";
        windowEvents.load();
        assert.equal(root.dataset.nightshadeAutoSkipped, String(!dark));
        assert.equal(writes.at(-1)["nightshade:theme:example.test"].dark, !dark);
      }
    });
  });
}

test("startup and stale theme memory have timeouts on a stalled page", async () => {
  await renderWithPageColors({ bodyColor: "rgb(255, 255, 255)", rootColor: "transparent", readyState: "loading",
    cachedTheme: { dark: true, at: Date.now() },
    exercise({ root, timers }) {
      timers.find(t => t.delay === 500).callback();
      assert.equal(root.dataset.nightshadeReady, "true");
      assert.equal(root.dataset.nightshadeAutoSkipped, "true");
      timers.find(t => t.delay === 10000).callback();
      assert.equal(root.dataset.nightshadeActive, "true");
    }
  });
});

test("expired theme memory is ignored", async () => {
  const result = await renderWithPageColors({ bodyColor: "rgb(255, 255, 255)", rootColor: "transparent",
    cachedTheme: { dark: true, at: Date.now() - 31 * 86400000 } });
  assert.equal(result.nightshadeActive, "true");
});

test("theme memory cannot override manual rules or pause", async () => {
  for (const [sites, disabledUntil, active] of [
    [{ "example.test": { enabled: true } }, 0, "true"],
    [{ "example.test": { enabled: false } }, 0, "false"],
    [{ "example.test": { enabled: true } }, Date.now() + 60000, "false"]
  ]) {
    await renderWithPageColors({ bodyColor: "rgb(20, 20, 20)", rootColor: "transparent", readyState: "loading",
      cachedTheme: { dark: true, at: Date.now() },
      settings: { globalEnabled: true, disabledUntil, sites },
      exercise({ root, events, writes }) {
        events.DOMContentLoaded?.();
        assert.equal(root.dataset.nightshadeActive, active);
        assert.equal(root.dataset.nightshadeAutoSkipped, "false");
        assert.equal(writes.length, 0);
      }
    });
  }
});

test("incognito ignores theme memory and does not persist detection", async () => {
  await renderWithPageColors({ bodyColor: "rgb(255, 255, 255)", rootColor: "transparent", incognito: true,
    cachedTheme: { dark: true, at: Date.now() },
    exercise({ root, writes }) {
      assert.equal(root.dataset.nightshadeActive, "true");
      assert.equal(writes.length, 0);
    }
  });
});

test("local storage failure does not strand the startup guard", async () => {
  const result = await renderWithPageColors({ bodyColor: "rgb(255, 255, 255)", rootColor: "transparent", storageFails: true });
  assert.equal(result.nightshadeReady, "true");
  assert.equal(result.nightshadeActive, "true");
});

test("supporting both color schemes is not proof of native dark mode", async () => {
  const result = await renderWithPageColors({ bodyColor: "rgb(255, 255, 255)", rootColor: "transparent", rootColorScheme: "light dark" });
  assert.equal(result.nightshadeActive, "true");
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
