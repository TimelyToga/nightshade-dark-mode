const DEFAULTS = {
  globalEnabled: true,
  disabledUntil: 0,
  dim: 10,
  preserveMedia: true,
  sites: {}
};

const PAUSE_OPTIONS = [15, 30, 60, 120, 240, 480, 1440];

const elements = {
  sitePanel: document.getElementById("site-panel"),
  siteName: document.getElementById("site-name"),
  siteEnabled: document.getElementById("site-enabled"),
  siteEnabledLabel: document.getElementById("site-enabled-label"),
  nativeDarkNotice: document.getElementById("native-dark-notice"),
  globalEnabled: document.getElementById("global-enabled"),
  pauseDuration: document.getElementById("pause-duration"),
  pauseDurationValue: document.getElementById("pause-duration-value"),
  pauseGlobal: document.getElementById("pause-global"),
  resumeGlobal: document.getElementById("resume-global"),
  pauseUntil: document.getElementById("pause-until"),
  dim: document.getElementById("dim"),
  dimValue: document.getElementById("dim-value"),
  preserveMedia: document.getElementById("preserve-media"),
  resetSite: document.getElementById("reset-site"),
  openSettings: document.getElementById("open-settings"),
  status: document.getElementById("status")
};

const state = {
  settings: structuredClone(DEFAULTS),
  hostname: null,
  tab: null,
  autoSkipped: false
};

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

function siteRule() {
  return state.hostname ? state.settings.sites[state.hostname] || {} : {};
}

function effectiveSettings() {
  const site = siteRule();
  return {
    enabled: typeof site.enabled === "boolean" ? site.enabled : state.settings.globalEnabled,
    dim: clampDim(site.dim ?? state.settings.dim),
    preserveMedia:
      typeof site.preserveMedia === "boolean" ? site.preserveMedia : state.settings.preserveMedia
  };
}

function pauseMinutes() {
  return PAUSE_OPTIONS[Number(elements.pauseDuration.value)] || 60;
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes === 60) return "1 hour";
  if (minutes < 1440) return `${minutes / 60} hours`;
  return "24 hours";
}

function isPaused() {
  return state.settings.disabledUntil > Date.now();
}

function renderPause() {
  const duration = formatDuration(pauseMinutes());
  const paused = isPaused();
  elements.pauseDurationValue.value = duration;
  elements.pauseDurationValue.textContent = duration;
  elements.pauseGlobal.textContent = `${paused ? "Extend pause by" : "Pause for"} ${duration}`;
  elements.resumeGlobal.hidden = !paused;
  elements.pauseUntil.hidden = !paused;

  if (paused) {
    const until = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" })
      .format(state.settings.disabledUntil);
    elements.pauseUntil.textContent = `Paused on every site until ${until}.`;
  }

  for (const control of [elements.siteEnabled, elements.dim, elements.preserveMedia, elements.resetSite]) {
    control.disabled = paused;
  }
  elements.sitePanel.classList.toggle("paused", paused);
}

function renderNativeDarkNotice() {
  const detected = state.autoSkipped && !isPaused();
  elements.nativeDarkNotice.hidden = !detected;
  elements.siteEnabledLabel.textContent = detected
    ? "Force Nightshade anyway"
    : "Use dark mode here";
  elements.sitePanel.classList.toggle("native-dark-detected", detected);
}

function render() {
  const effective = effectiveSettings();
  elements.globalEnabled.checked = state.settings.globalEnabled;
  renderPause();
  if (!state.hostname) return;

  elements.siteEnabled.checked = effective.enabled && !state.autoSkipped;
  elements.dim.value = effective.dim;
  elements.dimValue.value = `${effective.dim}%`;
  elements.dimValue.textContent = `${effective.dim}%`;
  elements.preserveMedia.checked = effective.preserveMedia;
  renderNativeDarkNotice();
}

async function save() {
  await chrome.storage.sync.set(state.settings);
  render();
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

async function checkPageConnection() {
  try {
    const response = await chrome.tabs.sendMessage(state.tab.id, { type: "nightshade:ping" });
    state.autoSkipped = Boolean(response?.autoSkipped);
    render();
    if (response?.autoSkipped) {
      setStatus("Automatic detection is active. Use the switch only if you want to override it.");
      return;
    }
    if (response?.pausedUntil) {
      setStatus("Nightshade is temporarily paused everywhere.");
      return;
    }
    setStatus("Changes apply immediately in this tab.");
  } catch {
    state.autoSkipped = false;
    render();
    setStatus("Refresh this tab once after installing to apply Nightshade.", true);
  }
}

function setSiteRule(update) {
  const existing = siteRule();
  state.settings.sites[state.hostname] = { ...existing, ...update };
}

elements.globalEnabled.addEventListener("change", async () => {
  state.autoSkipped = false;
  state.settings.globalEnabled = elements.globalEnabled.checked;
  await save();
  setStatus(elements.globalEnabled.checked ? "Default dark mode is on." : "Default dark mode is off.");
});

elements.pauseDuration.addEventListener("input", renderPause);

elements.pauseGlobal.addEventListener("click", async () => {
  const minutes = pauseMinutes();
  const start = Math.max(Date.now(), state.settings.disabledUntil);
  state.settings.disabledUntil = start + minutes * 60 * 1000;
  await save();
  setStatus(`Nightshade is paused everywhere for ${formatDuration(minutes)}.`);
});

elements.resumeGlobal.addEventListener("click", async () => {
  state.settings.disabledUntil = 0;
  await save();
  setStatus("Nightshade resumed everywhere.");
});

elements.siteEnabled.addEventListener("change", async () => {
  const overridingDetection = state.autoSkipped && elements.siteEnabled.checked;
  state.autoSkipped = false;
  setSiteRule({ enabled: elements.siteEnabled.checked });
  await save();
  setStatus(elements.siteEnabled.checked
    ? overridingDetection
      ? "Native dark mode detection is overridden for this site."
      : "Dark mode is on for this site."
    : "This site is excluded.");
});

elements.dim.addEventListener("input", () => {
  elements.dimValue.value = `${elements.dim.value}%`;
  elements.dimValue.textContent = `${elements.dim.value}%`;
});

elements.dim.addEventListener("change", async () => {
  setSiteRule({ dim: clampDim(elements.dim.value) });
  await save();
  setStatus("Saved dimming for this site.");
});

elements.preserveMedia.addEventListener("change", async () => {
  setSiteRule({ preserveMedia: elements.preserveMedia.checked });
  await save();
  setStatus(elements.preserveMedia.checked ? "Photos and video keep their colors." : "Photos and video are inverted too.");
});

elements.resetSite.addEventListener("click", async () => {
  state.autoSkipped = false;
  delete state.settings.sites[state.hostname];
  await save();
  setStatus("This site now follows the default settings.");
  await new Promise((resolve) => setTimeout(resolve, 100));
  await checkPageConnection();
});

elements.openSettings.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

async function initialize() {
  const [settings, tabs] = await Promise.all([
    chrome.storage.sync.get(DEFAULTS),
    chrome.tabs.query({ active: true, currentWindow: true })
  ]);
  state.settings = normalize(settings);
  state.tab = tabs[0];

  let url;
  try {
    url = new URL(state.tab?.url || "");
  } catch {
    // Non-web pages have an opaque URL.
  }

  const supported = url && ["http:", "https:", "file:"].includes(url.protocol);
  if (!supported) {
    elements.globalEnabled.checked = state.settings.globalEnabled;
    renderPause();
    setStatus("Chrome and extension pages cannot be recolored. Open a regular website to change its site setting.", true);
    return;
  }

  state.hostname = url.protocol === "file:" ? "__nightshade_local_files__" : url.hostname;
  elements.siteName.textContent = url.protocol === "file:" ? "Local files" : state.hostname;
  elements.sitePanel.hidden = false;
  render();
  await checkPageConnection();
}

initialize().catch(() => setStatus("Nightshade could not read this tab.", true));

setInterval(() => {
  if (state.settings.disabledUntil && !isPaused()) {
    state.settings.disabledUntil = 0;
    render();
  } else if (isPaused()) {
    renderPause();
  }
}, 30000);
