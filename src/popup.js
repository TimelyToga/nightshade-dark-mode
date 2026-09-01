const DEFAULTS = {
  globalEnabled: true,
  dim: 10,
  preserveMedia: true,
  sites: {}
};

const elements = {
  sitePanel: document.getElementById("site-panel"),
  siteName: document.getElementById("site-name"),
  siteEnabled: document.getElementById("site-enabled"),
  globalEnabled: document.getElementById("global-enabled"),
  dim: document.getElementById("dim"),
  dimValue: document.getElementById("dim-value"),
  preserveMedia: document.getElementById("preserve-media"),
  resetSite: document.getElementById("reset-site"),
  status: document.getElementById("status")
};

const state = { settings: structuredClone(DEFAULTS), hostname: null, tab: null };

function clampDim(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(55, number)) : DEFAULTS.dim;
}

function normalize(raw) {
  return {
    globalEnabled: typeof raw.globalEnabled === "boolean" ? raw.globalEnabled : DEFAULTS.globalEnabled,
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

function render() {
  const effective = effectiveSettings();
  elements.globalEnabled.checked = state.settings.globalEnabled;
  if (!state.hostname) return;

  elements.siteEnabled.checked = effective.enabled;
  elements.dim.value = effective.dim;
  elements.dimValue.value = `${effective.dim}%`;
  elements.dimValue.textContent = `${effective.dim}%`;
  elements.preserveMedia.checked = effective.preserveMedia;
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
    if (response?.autoSkipped) {
      elements.siteEnabled.checked = false;
      setStatus("This site already has a dark theme, so Nightshade left it alone. Turn the switch on to force it.");
      return;
    }
    setStatus("Changes apply immediately in this tab.");
  } catch {
    setStatus("Refresh this tab once after installing to apply Nightshade.", true);
  }
}

function setSiteRule(update) {
  const existing = siteRule();
  state.settings.sites[state.hostname] = { ...existing, ...update };
}

elements.globalEnabled.addEventListener("change", async () => {
  state.settings.globalEnabled = elements.globalEnabled.checked;
  await save();
  setStatus(elements.globalEnabled.checked ? "Default dark mode is on." : "Default dark mode is off.");
});

elements.siteEnabled.addEventListener("change", async () => {
  setSiteRule({ enabled: elements.siteEnabled.checked });
  await save();
  setStatus(elements.siteEnabled.checked ? "Dark mode is on for this site." : "This site is excluded.");
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
  delete state.settings.sites[state.hostname];
  await save();
  setStatus("This site now follows the default settings.");
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
