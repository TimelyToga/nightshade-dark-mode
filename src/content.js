const DEFAULTS = {
  globalEnabled: true,
  disabledUntil: 0,
  dim: 10,
  preserveMedia: true,
  sites: {}
};

const root = document.documentElement;
const hostname = location.protocol === "file:" ? "__nightshade_local_files__" : location.hostname;
const mediaController = globalThis.NightshadeMedia?.createController(document, hostname);
let currentSettings = DEFAULTS;
let autoSkippedForNativeDarkMode = false;
let nativeDarkCheckTimers = [];
let globalResumeTimer;
const themeKey = `nightshade:theme:${hostname}`;
const themeMaxAge = 30 * 24 * 60 * 60 * 1000;
let rememberedTheme;
let startupFinished = false;
let loadingFinished = document.readyState === "complete";
let themeMutationTimer;
let themeObserver;

function queueThemeCheck() {
  const effective = settingsForThisSite(currentSettings);
  if (!startupFinished || document.hidden || !effective.enabled || effective.paused ||
      typeof currentSettings.sites[hostname]?.enabled === "boolean" || themeMutationTimer !== undefined) return;
  // One check per batch, not a trailing debounce: busy apps must not starve
  // detection. Only computed colors are inspected, never message contents.
  themeMutationTimer = setTimeout(() => {
    themeMutationTimer = undefined;
    if (!document.hidden) checkForNativeDarkMode();
  }, 250);
}

function watchThemeChanges() {
  if (themeObserver || typeof MutationObserver !== "function") return;
  themeObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.target.id !== "nightshade-extension-overlay" &&
        !(mutation.type === "childList" && [...mutation.addedNodes, ...mutation.removedNodes]
          .every((node) => node.id === "nightshade-extension-overlay")))) queueThemeCheck();
  });
  themeObserver.observe(root, {
    subtree: true, childList: true, attributes: true,
    // Exclude our own detection/state attributes to avoid a feedback loop.
    attributeFilter: ["class", "style", "bgcolor", "data-theme", "data-color-mode", "hidden"]
  });
  document.addEventListener("visibilitychange", queueThemeCheck);
  document.addEventListener("load", queueThemeCheck, true);
  window.addEventListener?.("pageshow", queueThemeCheck);
  window.addEventListener?.("focus", queueThemeCheck);
}

function readThemeMemory() {
  if (!chrome.storage.local || chrome.extension?.inIncognitoContext) return Promise.resolve();
  return chrome.storage.local.get(themeKey).then((data) => {
    const entry = data[themeKey];
    if (!startupFinished && typeof entry?.dark === "boolean" &&
        Number.isFinite(entry.at) && Date.now() - entry.at >= 0 && Date.now() - entry.at < themeMaxAge) {
      rememberedTheme = entry.dark;
    }
  }).catch(() => {});
}

function rememberTheme(dark) {
  if (!chrome.storage.local || chrome.extension?.inIncognitoContext || location.protocol === "file:") return;
  if (rememberedTheme === dark) return;
  rememberedTheme = dark;
  chrome.storage.local.set({ [themeKey]: { dark, at: Date.now() } }).catch(() => {});
}

function clampDim(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(55, number)) : DEFAULTS.dim;
}

function normalize(raw) {
  return {
    globalEnabled: typeof raw.globalEnabled === "boolean" ? raw.globalEnabled : DEFAULTS.globalEnabled,
    disabledUntil: Number.isFinite(Number(raw.disabledUntil))
      ? Math.max(0, Number(raw.disabledUntil))
      : DEFAULTS.disabledUntil,
    dim: clampDim(raw.dim),
    preserveMedia: typeof raw.preserveMedia === "boolean" ? raw.preserveMedia : DEFAULTS.preserveMedia,
    sites: raw.sites && typeof raw.sites === "object" ? raw.sites : {}
  };
}

function settingsForThisSite(settings) {
  const site = settings.sites[hostname] || {};
  return {
    enabled: typeof site.enabled === "boolean" ? site.enabled : settings.globalEnabled,
    paused: settings.disabledUntil > Date.now(),
    dim: clampDim(site.dim ?? settings.dim),
    preserveMedia:
      typeof site.preserveMedia === "boolean" ? site.preserveMedia : settings.preserveMedia
  };
}

const colorLuminanceCache = new Map();
let colorProbe;

function colorLuminance(color) {
  if (typeof color !== "string") return null;
  if (colorLuminanceCache.has(color)) return colorLuminanceCache.get(color);
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(color);
  let values;
  if (rgb) {
    const parts = rgb[1].split(/[,\s/]+/).filter(Boolean);
    values = parts.map((part, index) => part.endsWith("%")
      ? parseFloat(part) * (index < 3 ? 2.55 : 0.01) : Number(part));
  } else {
    // Let the browser convert modern computed CSS colors (oklch, color(srgb),
    // display-p3...) to sRGB. This detached 1px canvas contains only a solid
    // CSS background color, never page imagery, text, or account content.
    try {
      if (!colorProbe) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        colorProbe = canvas.getContext("2d", { willReadFrequently: true });
      }
      if (!colorProbe) return null;
      colorProbe.clearRect(0, 0, 1, 1);
      colorProbe.fillStyle = "rgba(0, 0, 0, 0)";
      colorProbe.fillStyle = color;
      colorProbe.fillRect(0, 0, 1, 1);
      const pixel = colorProbe.getImageData(0, 0, 1, 1).data;
      values = [pixel[0], pixel[1], pixel[2], pixel[3] / 255];
    } catch { return null; }
  }
  if (values.length < 3 || values.some(value => !Number.isFinite(value)) ||
      (values[3] !== undefined && values[3] < 0.9)) return null;

  const [red, green, blue] = values.map((value) => value / 255);
  const linear = [red, green, blue].map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  );
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  if (colorLuminanceCache.size >= 128) colorLuminanceCache.clear();
  colorLuminanceCache.set(color, luminance);
  return luminance;
}

function viewportSurfaceLuminances() {
  if (typeof document.elementFromPoint !== "function") return [];

  const width = Math.max(root.clientWidth || 0, window.innerWidth || 0);
  const height = Math.max(root.clientHeight || 0, window.innerHeight || 0);
  if (!width || !height) return [];

  const luminances = [];
  for (const yRatio of [0.15, 0.5, 0.85]) {
    for (const xRatio of [0.1, 0.5, 0.9]) {
      let element = document.elementFromPoint(width * xRatio, height * yRatio);
      while (element && element !== root) {
        if (element.id !== "nightshade-extension-overlay") {
          const luminance = colorLuminance(getComputedStyle(element).backgroundColor);
          if (luminance !== null) {
            luminances.push(luminance);
            break;
          }
        }
        element = element.parentElement;
      }
    }
  }
  return luminances;
}

function pageAlreadyLooksDark() {
  // Temporarily remove only Nightshade's fallback background/color-scheme. The
  // filter remains in place, so this does not produce a visible theme flash.
  // This lets us inspect author-owned root backgrounds such as Google's.
  root.dataset.nightshadeDetectingNativeDark = "true";
  try {
    const bodyLuminance = document.body
      ? colorLuminance(getComputedStyle(document.body).backgroundColor)
      : null;
    const rootStyle = getComputedStyle(root);
    const rootLuminance = colorLuminance(rootStyle.backgroundColor);
    // "light dark" advertises support, not which theme is currently painted.
    const authorDeclaresDarkScheme = rootStyle.colorScheme.split(/\s+/).includes("dark") &&
      !rootStyle.colorScheme.split(/\s+/).includes("light");
    const surfaceLuminances = viewportSurfaceLuminances();
    const sampledSurfaceLooksDark = surfaceLuminances.length >= 4 &&
      surfaceLuminances.filter((luminance) => luminance < 0.22).length * 3 >=
        surfaceLuminances.length * 2;

    return authorDeclaresDarkScheme || sampledSurfaceLooksDark ||
      [bodyLuminance, rootLuminance]
        .some((luminance) => luminance !== null && luminance < 0.22);
  } finally {
    delete root.dataset.nightshadeDetectingNativeDark;
  }
}

function getOverlay() {
  let overlay = document.getElementById("nightshade-extension-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "nightshade-extension-overlay";
  overlay.setAttribute("aria-hidden", "true");

  // documentElement is available at document_start. Inserting here also makes
  // the overlay independent of pages that replace or style their body.
  root.appendChild(overlay);
  return overlay;
}

function renderEffectiveSettings() {
  const effective = settingsForThisSite(currentSettings);
  const explicitlyEnabled = typeof currentSettings.sites[hostname]?.enabled === "boolean";
  const enabled = effective.enabled && !effective.paused && !autoSkippedForNativeDarkMode;

  root.dataset.nightshadeReady = "true";
  root.dataset.nightshadeActive = String(enabled);
  root.dataset.nightshadePreserveMedia = String(effective.preserveMedia);
  root.dataset.nightshadeAutoSkipped = String(autoSkippedForNativeDarkMode);
  root.dataset.nightshadePaused = String(effective.paused);
  root.style.setProperty("--nightshade-dim", String(effective.dim / 100));

  if (enabled) getOverlay();
  mediaController?.setEnabled(enabled && effective.preserveMedia);
  return { effective, explicitlyEnabled };
}

function checkForNativeDarkMode() {
  if (!startupFinished) return;
  const effective = settingsForThisSite(currentSettings);
  const explicitlyEnabled = typeof currentSettings.sites[hostname]?.enabled === "boolean";
  let shouldSkip = false;
  if (effective.enabled && !effective.paused && !explicitlyEnabled) {
    const dark = !loadingFinished && rememberedTheme !== undefined ? rememberedTheme : pageAlreadyLooksDark();
    shouldSkip = dark;
    if (loadingFinished) rememberTheme(dark);
  }
  if (shouldSkip !== autoSkippedForNativeDarkMode) {
    autoSkippedForNativeDarkMode = shouldSkip;
    renderEffectiveSettings();
  }
}

function scheduleNativeDarkCheck() {
  for (const timer of nativeDarkCheckTimers) clearTimeout(timer);
  nativeDarkCheckTimers = [];
  const checkSoon = () => requestAnimationFrame(checkForNativeDarkMode);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkSoon, { once: true });
  } else {
    checkSoon();
  }
  // App-style pages often paint their real theme onto nested surfaces after
  // the document is ready. Recheck during that initialization window.
  nativeDarkCheckTimers = [500, 2000, 5000]
    .map((delay) => setTimeout(checkForNativeDarkMode, delay));
}

function scheduleGlobalResume() {
  clearTimeout(globalResumeTimer);
  const delay = currentSettings.disabledUntil - Date.now();
  if (delay <= 0) return;

  globalResumeTimer = setTimeout(() => {
    checkForNativeDarkMode();
    renderEffectiveSettings();
    scheduleNativeDarkCheck();
    scheduleGlobalResume();
  }, Math.min(delay + 50, 2147483647));
}

function apply(settings) {
  currentSettings = normalize(settings);
  checkForNativeDarkMode();
  renderEffectiveSettings();
  scheduleNativeDarkCheck();
  scheduleGlobalResume();
}

function finishStartup() {
  if (startupFinished) return;
  startupFinished = true;
  // Release the guard for synchronous hit-testing before making the decision;
  // the browser cannot paint between these statements and apply().
  root.dataset.nightshadeReady = "true";
  apply(currentSettings);
  watchThemeChanges();
}

// Use a neutral dark frame until settings and the parser's first theme styles
// are available. Never block a slow or broken page indefinitely.
const startupDeadline = setTimeout(finishStartup, 500);
Promise.all([
  chrome.storage.sync.get(DEFAULTS).then((raw) => {
    if (startupFinished) apply(raw); else currentSettings = normalize(raw);
  }).catch(() => {}),
  readThemeMemory()
]).then(() => {
  const effective = settingsForThisSite(currentSettings);
  const explicit = typeof currentSettings.sites[hostname]?.enabled === "boolean";
  if (document.readyState === "loading" && effective.enabled && !effective.paused && !explicit) {
    document.addEventListener("DOMContentLoaded", finishStartup, { once: true });
  } else finishStartup();
});

function finishLoading() {
  if (loadingFinished) return;
  loadingFinished = true;
  if (startupFinished) {
    checkForNativeDarkMode();
    scheduleNativeDarkCheck();
  }
}
window.addEventListener?.("load", finishLoading, { once: true });
// Some pages never finish loading; do not pin a stale cache indefinitely.
setTimeout(finishLoading, 10000);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  chrome.storage.sync.get(DEFAULTS).then((raw) => {
    startupFinished = true;
    clearTimeout(startupDeadline);
    apply(raw);
    watchThemeChanges();
  }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "nightshade:ping") return;
  sendResponse({
    active: root.dataset.nightshadeActive === "true",
    autoSkipped: autoSkippedForNativeDarkMode,
    pausedUntil: currentSettings.disabledUntil > Date.now() ? currentSettings.disabledUntil : 0,
    hostname
  });
});
