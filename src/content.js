const DEFAULTS = {
  globalEnabled: true,
  disabledUntil: 0,
  dim: 10,
  preserveMedia: true,
  sites: {}
};

const root = document.documentElement;
const hostname = location.protocol === "file:" ? "__nightshade_local_files__" : location.hostname;
let currentSettings = DEFAULTS;
let autoSkippedForNativeDarkMode = false;
let nativeDarkCheckTimer;
let globalResumeTimer;

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

function colorLuminance(color) {
  const values = color.match(/rgba?\(([^)]+)\)/i)?.[1].split(",").map(Number);
  if (!values || values.length < 3 || (values[3] !== undefined && values[3] < 0.9)) return null;

  const [red, green, blue] = values.map((value) => value / 255);
  const linear = [red, green, blue].map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
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
    const authorDeclaresDarkScheme = rootStyle.colorScheme
      .split(/\s+/)
      .includes("dark");

    return authorDeclaresDarkScheme || [bodyLuminance, rootLuminance]
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
  return { effective, explicitlyEnabled };
}

function checkForNativeDarkMode() {
  const { effective, explicitlyEnabled } = renderEffectiveSettings();
  const shouldSkip = effective.enabled && !effective.paused && !explicitlyEnabled && pageAlreadyLooksDark();
  if (shouldSkip !== autoSkippedForNativeDarkMode) {
    autoSkippedForNativeDarkMode = shouldSkip;
    renderEffectiveSettings();
  }
}

function scheduleNativeDarkCheck() {
  clearTimeout(nativeDarkCheckTimer);
  const checkSoon = () => requestAnimationFrame(checkForNativeDarkMode);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkSoon, { once: true });
  } else {
    checkSoon();
  }
  // Several homepages set their final theme immediately after they construct
  // the body, so check once more after that small initialization window.
  nativeDarkCheckTimer = setTimeout(checkForNativeDarkMode, 500);
}

function scheduleGlobalResume() {
  clearTimeout(globalResumeTimer);
  const delay = currentSettings.disabledUntil - Date.now();
  if (delay <= 0) return;

  globalResumeTimer = setTimeout(() => {
    autoSkippedForNativeDarkMode = false;
    renderEffectiveSettings();
    scheduleNativeDarkCheck();
    scheduleGlobalResume();
  }, Math.min(delay + 50, 2147483647));
}

function apply(settings) {
  currentSettings = normalize(settings);
  autoSkippedForNativeDarkMode = false;
  renderEffectiveSettings();
  scheduleNativeDarkCheck();
  scheduleGlobalResume();
}

chrome.storage.sync.get(DEFAULTS).then(apply).catch(() => apply(DEFAULTS));

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  chrome.storage.sync.get(DEFAULTS).then(apply).catch(() => apply(currentSettings));
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
