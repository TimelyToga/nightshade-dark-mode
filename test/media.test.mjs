import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const context = { URL, getComputedStyle: (element) => element.style };
vm.runInNewContext(fs.readFileSync(new URL("../src/media.js", import.meta.url), "utf8"), context);
const { imageRule, classifySvg, isThemeCanvas } = context.NightshadeMedia;

test("Slides surfaces are restricted by host, route and document container", () => {
  const { isSlidesSurface } = context.NightshadeMedia;
  const surface = { closest: () => ({}) };
  assert.equal(isSlidesSurface("docs.google.com", "/presentation/d/example/edit", surface), true);
  assert.equal(isThemeCanvas("docs.google.com", "/presentation/d/example/edit", surface), true);
  for (const [host, path, node] of [
    ["docs.google.com.attacker.test", "/presentation/d/example/edit", surface],
    ["docs.google.com", "/document/d/example/edit", surface],
    ["docs.google.com", "/presentation/d/example/edit", { closest: () => null }]
  ]) assert.equal(isSlidesSurface(host, path, node), false);
});

function canvas(className) {
  return { classList: { contains: (value) => value === className } };
}

test("Google Docs canvas exception is narrowly scoped", () => {
  assert.equal(isThemeCanvas("docs.google.com", "/document/d/example/preview", canvas("kix-canvas-tile-content")), true);
  for (const [host, pathname, className] of [
    ["docs.google.com.attacker.test", "/document/d/example/preview", "kix-canvas-tile-content"],
    ["sheets.google.com", "/document/d/example/preview", "kix-canvas-tile-content"],
    ["docs.google.com", "/presentation/d/example/edit", "kix-canvas-tile-content"],
    ["docs.google.com", "/document/d/example/preview", "ordinary-canvas"]
  ]) {
    assert.equal(isThemeCanvas(host, pathname, canvas(className)), false);
  }
});

test("Sheets editor canvases follow the theme without changing unrelated canvases", () => {
  const grid = { closest: (selector) => selector === "#docs-editor" ? {} : null };
  assert.equal(isThemeCanvas("docs.google.com", "/spreadsheets/d/example/edit", grid), true);
  assert.equal(isThemeCanvas("docs.google.com", "/spreadsheets/d/example/preview", grid), true);
  for (const [host, path] of [
    ["docs.google.com.attacker.test", "/spreadsheets/d/example/edit"],
    ["example.test", "/spreadsheets/d/example/edit"],
    ["docs.google.com", "/document/d/example/edit"],
    ["docs.google.com", "/presentation/d/example/edit"]
  ]) assert.equal(isThemeCanvas(host, path, grid), false);
  assert.equal(isThemeCanvas("docs.google.com", "/spreadsheets/d/example/edit", { closest: () => null }), false);
});

test("mixed-logo repair selects dark neutral paint without changing brand blue", () => {
  const { isDarkNeutral } = context.NightshadeMedia;
  assert.equal(isDarkNeutral("rgb(28, 43, 51)"), true);
  assert.equal(isDarkNeutral("rgb(0, 0, 0)"), true);
  for (const paint of ["rgb(1, 128, 250)", "rgb(0, 30, 80)", "rgb(255, 255, 255)", "rgba(28, 43, 51, 0.2)", "url(#brand)", "none"]) {
    assert.equal(isDarkNeutral(paint), false, paint);
  }
});

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
