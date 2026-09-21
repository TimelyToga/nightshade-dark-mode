import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const context = { URL, getComputedStyle: (element) => element.style };
vm.runInNewContext(fs.readFileSync(new URL("../src/media.js", import.meta.url), "utf8"), context);
const { imageRule, classifySvg } = context.NightshadeMedia;

test("transparent logo exception is restricted to 1Password domains and exact asset family", () => {
  for (const host of ["my.1password.com", "team.1password.eu", "my.1password.ca"]) {
    assert.equal(imageRule(host, "/assets/1password-logo-a123.svg", `https://${host}`), "1password-transparent-logo");
  }
  for (const host of ["1password.com.attacker.test", "not1password.com", "example.test"]) {
    assert.equal(imageRule(host, "/assets/1password-logo-a123.svg", `https://${host}`), null);
  }
  assert.equal(imageRule("my.1password.com", "/avatars/photo.png", "https://my.1password.com"), null);
});

function svg(paints, ambiguous = false) {
  return {
    querySelector: () => ambiguous ? {} : null,
    querySelectorAll: () => paints.map((fill) => ({
      localName: "path",
      style: { fill, stroke: "none", fillOpacity: "1", strokeOpacity: "1", opacity: "1", display: "inline", visibility: "visible" }
    }))
  };
}

test("single-color UI icons follow the page while multicolor art is preserved", () => {
  assert.equal(classifySvg(svg(["rgb(20, 20, 20)"])), "theme");
  assert.equal(classifySvg(svg(["rgb(20, 20, 20)", "rgb(20, 20, 20)"])), "theme");
  assert.equal(classifySvg(svg(["rgb(20, 20, 20)", "rgb(200, 10, 20)"])), "preserve");
  assert.equal(classifySvg(svg([], true)), "preserve");
});
