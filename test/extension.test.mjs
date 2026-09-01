import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const contentScript = fs.readFileSync(new URL("../src/content.js", import.meta.url), "utf8");
const manifest = JSON.parse(fs.readFileSync(new URL("../src/manifest.json", import.meta.url), "utf8"));

async function renderWithPageColors({ bodyColor, rootColor, rootColorScheme = "normal" }) {
  const root = {
    dataset: {},
    style: { setProperty() {} },
    appendChild() {}
  };
  const body = {};
  const context = {
    chrome: {
      storage: {
        sync: {
          get: async () => ({ globalEnabled: true, dim: 10, preserveMedia: true, sites: {} })
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
      addEventListener() {}
    },
    location: { protocol: "https:", hostname: "example.test" },
    getComputedStyle: (element) => ({
      backgroundColor: element === body ? bodyColor : rootColor,
      colorScheme: element === root ? rootColorScheme : "normal"
    }),
    requestAnimationFrame: (callback) => callback(),
    setTimeout: () => 1,
    clearTimeout() {}
  };

  vm.runInNewContext(contentScript, context);
  await new Promise((resolve) => setImmediate(resolve));
  return root.dataset;
}

test("project and manifest versions are 0.1.0", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "0.1.0");
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
