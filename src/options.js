const DEFAULTS = {
  globalEnabled: true,
  disabledUntil: 0,
  dim: 10,
  preserveMedia: true,
  sites: {}
};

const elements = {
  globalEnabled: document.getElementById("global-enabled"),
  globalDim: document.getElementById("global-dim"),
  globalDimValue: document.getElementById("global-dim-value"),
  globalPreserveMedia: document.getElementById("global-preserve-media"),
  pauseCard: document.getElementById("pause-card"),
  pauseDescription: document.getElementById("pause-description"),
  resumeGlobal: document.getElementById("resume-global"),
  ruleCount: document.getElementById("rule-count"),
  emptyRules: document.getElementById("empty-rules"),
  siteList: document.getElementById("site-list"),
  status: document.getElementById("status")
};

let settings = structuredClone(DEFAULTS);

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

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function ruleMode(rule) {
  if (rule.enabled === true) return { label: "Forced on", className: "rule-on" };
  if (rule.enabled === false) return { label: "Excluded", className: "rule-off" };
  return { label: "Follows default", className: "rule-default" };
}

function ruleDetails(rule) {
  const details = [];
  if (Object.hasOwn(rule, "dim")) details.push(`Dimming override: ${clampDim(rule.dim)}%`);
  if (Object.hasOwn(rule, "preserveMedia")) {
    details.push(rule.preserveMedia ? "Preserves media colors" : "Inverts media with the page");
  }
  if (!details.length) details.push("No additional overrides");
  return details;
}

function renderPause() {
  const paused = settings.disabledUntil > Date.now();
  elements.pauseCard.hidden = !paused;
  if (!paused) return;

  const until = new Intl.DateTimeFormat([], { dateStyle: "medium", timeStyle: "short" })
    .format(settings.disabledUntil);
  elements.pauseDescription.textContent = `Scheduled to resume ${until}.`;
}

function renderSiteRules() {
  const entries = Object.entries(settings.sites).sort(([left], [right]) => left.localeCompare(right));
  const forcedOn = entries.filter(([, rule]) => rule.enabled === true).length;
  const excluded = entries.filter(([, rule]) => rule.enabled === false).length;

  elements.ruleCount.textContent = entries.length === 1 ? "1 rule" : `${entries.length} rules`;
  elements.ruleCount.title = `${forcedOn} forced on, ${excluded} excluded`;
  elements.emptyRules.hidden = entries.length > 0;
  elements.siteList.replaceChildren();

  for (const [hostname, rule] of entries) {
    const row = createElement("article", "site-rule");
    const identity = createElement("div", "site-identity");
    identity.append(createElement("div", "site-host", hostname));
    const mode = ruleMode(rule);
    identity.append(createElement("span", `rule-badge ${mode.className}`, mode.label));

    const details = createElement("div", "rule-details");
    for (const detail of ruleDetails(rule)) details.append(createElement("span", "", detail));

    const remove = createElement("button", "remove-rule", "Remove rule");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove rule for ${hostname}`);
    remove.addEventListener("click", async () => {
      delete settings.sites[hostname];
      await chrome.storage.sync.set({ sites: settings.sites });
      renderSiteRules();
      setStatus(`Removed the rule for ${hostname}.`);
    });

    row.append(identity, details, remove);
    elements.siteList.append(row);
  }
}

function render() {
  elements.globalEnabled.checked = settings.globalEnabled;
  elements.globalDim.value = settings.dim;
  elements.globalDimValue.value = `${settings.dim}%`;
  elements.globalDimValue.textContent = `${settings.dim}%`;
  elements.globalPreserveMedia.checked = settings.preserveMedia;
  renderPause();
  renderSiteRules();
}

async function saveGlobal(update, message) {
  settings = { ...settings, ...update };
  await chrome.storage.sync.set(update);
  render();
  setStatus(message);
}

elements.globalEnabled.addEventListener("change", () => saveGlobal(
  { globalEnabled: elements.globalEnabled.checked },
  elements.globalEnabled.checked ? "Default dark mode enabled." : "Default dark mode disabled."
));

elements.globalDim.addEventListener("input", () => {
  elements.globalDimValue.value = `${elements.globalDim.value}%`;
  elements.globalDimValue.textContent = `${elements.globalDim.value}%`;
});

elements.globalDim.addEventListener("change", () => saveGlobal(
  { dim: clampDim(elements.globalDim.value) },
  "Default dimming updated."
));

elements.globalPreserveMedia.addEventListener("change", () => saveGlobal(
  { preserveMedia: elements.globalPreserveMedia.checked },
  elements.globalPreserveMedia.checked ? "Media colors will be preserved by default." : "Media will be inverted by default."
));

elements.resumeGlobal.addEventListener("click", () => saveGlobal(
  { disabledUntil: 0 },
  "Nightshade resumed everywhere."
));

chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName !== "sync") return;
  chrome.storage.sync.get(DEFAULTS).then((raw) => {
    settings = normalize(raw);
    render();
  });
});

chrome.storage.sync.get(DEFAULTS).then((raw) => {
  settings = normalize(raw);
  render();
}).catch(() => setStatus("Nightshade could not load its settings.", true));

setInterval(renderPause, 30000);
