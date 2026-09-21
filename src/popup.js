const DEFAULTS = { globalEnabled: true, disabledUntil: 0, dim: 10, preserveMedia: true, sites: {} };
const $ = (id) => document.getElementById(id);
const text = (id, value) => { if ($(id).textContent !== value) $(id).textContent = value; };
const modes = [...document.querySelectorAll('input[name="mode"]')];
const state = { settings: structuredClone(DEFAULTS), tab: null, hostname: null, supported: false, connection: "checking", page: null, busy: false, undo: null };
const clampDim = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(55, Number(value))) : 10;
const rule = () => state.settings.sites?.[state.hostname] || {};
const paused = () => Number(state.settings.disabledUntil) > Date.now();
const mode = () => rule().enabled === true ? "always" : rule().enabled === false ? "never" : "auto";
const time = () => new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(state.settings.disabledUntil);

function feedback(message, error = false) {
  $("feedback").hidden = !message;
  $("feedback-text").textContent = message;
  $("feedback").classList.toggle("error", error);
  $("undo").hidden = !state.undo || error;
}

function render() {
  const site = rule();
  const isPaused = paused();
  const currentMode = mode();
  const active = state.connection === "connected" && state.page?.active && !isPaused;
  let title, detail = "", tone = "";
  if (!state.supported) { title = "Unavailable on this page"; detail = "Chrome doesn’t allow Nightshade here."; }
  else if (isPaused) { title = "Nightshade is paused"; tone = "paused"; }
  else if (state.connection === "checking") { title = "Checking this page…"; }
  else if (state.connection === "disconnected") { title = "Refresh to connect Nightshade"; detail = "If it still can’t connect, check site access in Chrome."; }
  else if (state.page?.autoSkipped) { title = "Already dark, left as is"; detail = "This site has its own dark theme."; tone = "native"; }
  else if (active) { title = "Darkening this page"; detail = currentMode === "always" ? "Always on for this site." : "Auto · this page looks light."; tone = "active"; }
  else { title = "Nightshade is off"; detail = currentMode === "never" ? "Never on this site." : state.settings.globalEnabled ? "Waiting for this page." : "Auto · your global default is off."; }
  text("state-title", title);
  text("state-detail", detail);
  $("state-detail").hidden = !detail;
  $("state-dot").className = `dot ${tone}`;
  $("site-controls").hidden = !state.supported;
  $("refresh-tab").hidden = !state.supported || isPaused || state.connection !== "disconnected";
  $("refresh-tab").disabled = state.busy;
  $("pause-banner").hidden = !isPaused;
  text("pause-until", isPaused ? `Paused everywhere until ${time()}` : "");
  $("paused-caption").hidden = !isPaused;
  $("site-mode").disabled = isPaused || state.busy;
  modes.forEach((input) => { input.checked = input.value === currentMode; });
  $("rule-note").hidden = currentMode === "auto" || isPaused;
  $("back-auto").disabled = state.busy;
  const dim = clampDim(site.dim ?? state.settings.dim);
  const preserve = site.preserveMedia ?? state.settings.preserveMedia;
  $("appearance-toggle").disabled = !active || state.busy;
  $("appearance-toggle").hidden = isPaused;
  text("appearance-summary", active ? `Dim ${dim}% · ${preserve ? "Colors kept" : "Media inverted"}` : "Only while darkening");
  if (!active) {
    $("appearance").hidden = true;
    $("appearance-toggle").setAttribute("aria-expanded", "false");
  }
  // Polling must not move the slider while the user is dragging it.
  if (document.activeElement !== $("dim")) {
    $("dim").value = dim;
    text("dim-value", `${dim}%`);
  }
  text("dim-default-label", `Default: ${clampDim(state.settings.dim)}%`);
  if ($("dim-default").firstChild?.value !== String(clampDim(state.settings.dim))) {
    $("dim-default").replaceChildren(Object.assign(document.createElement("option"), { value: clampDim(state.settings.dim), label: "Default" }));
  }
  $("preserve-media").checked = preserve;
  for (const [field, prefix] of [["dim", "dim"], ["preserveMedia", "media"]]) {
    const custom = Object.hasOwn(site, field);
    text(`${prefix}-source`, custom ? "Custom" : "Default");
    $(`${prefix}-source`).classList.toggle("custom", custom);
    $(`reset-${prefix}`).hidden = !custom;
    $(`reset-${prefix}`).disabled = state.busy || !active;
  }
  $("dim").disabled = $("preserve-media").disabled = state.busy || !active;
  $("pause-toggle").hidden = isPaused;
  if (isPaused) { $("pause-menu").hidden = true; $("pause-toggle").setAttribute("aria-expanded", "false"); }
  for (const id of ["resume-global", "extend-pause", "pause-global", "undo"]) $(id).disabled = state.busy;
}

let checking = false;
async function checkPage() {
  if (!state.supported || checking || state.busy) return;
  checking = true;
  try {
    const response = await chrome.tabs.sendMessage(state.tab.id, { type: "nightshade:ping" });
    if (typeof response?.active !== "boolean") throw new Error("No page status");
    state.page = response;
    state.connection = "connected";
  } catch { state.page = null; state.connection = "disconnected"; }
  finally { checking = false; render(); }
}

async function mutate(operation, message) {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    const latest = await chrome.storage.sync.get(DEFAULTS);
    const update = operation(latest);
    await chrome.storage.sync.set(update);
    state.settings = { ...latest, ...update };
    feedback(message);
  } catch { state.undo = null; feedback("Couldn’t save. Try again.", true); }
  finally { state.busy = false; render(); await checkPage(); }
}

function editSite(field, value, message, remember = true) {
  return mutate((latest) => {
    const sites = { ...latest.sites };
    const site = { ...sites[state.hostname] };
    if (remember) state.undo = { field, value: Object.hasOwn(site, field) ? site[field] : undefined };
    else state.undo = null;
    if (value === undefined) delete site[field]; else site[field] = value;
    if (Object.keys(site).length) sites[state.hostname] = site; else delete sites[state.hostname];
    return { sites };
  }, message);
}

function chooseMode(value) {
  return editSite("enabled", value === "auto" ? undefined : value === "always", value === "auto" ? "Back to Auto." : value === "always" ? "Always on for this site." : "Never on this site.");
}
modes.forEach((input) => input.addEventListener("change", () => chooseMode(input.value)));
$("back-auto").addEventListener("click", () => chooseMode("auto"));
$("undo").addEventListener("click", () => {
  if (state.undo) { const previous = state.undo; editSite(previous.field, previous.value, "Change undone.", false); }
});
$("appearance-toggle").addEventListener("click", () => {
  $("appearance").hidden = !$("appearance").hidden;
  $("appearance-toggle").setAttribute("aria-expanded", String(!$("appearance").hidden));
});
$("dim").addEventListener("input", () => { $("dim-value").textContent = `${$("dim").value}%`; });
$("dim").addEventListener("change", () => editSite("dim", clampDim($("dim").value), "Dimming saved."));
$("preserve-media").addEventListener("change", () => editSite("preserveMedia", $("preserve-media").checked, "Media setting saved."));
$("reset-dim").addEventListener("click", () => editSite("dim", undefined, "Using default dimming."));
$("reset-media").addEventListener("click", () => editSite("preserveMedia", undefined, "Using default media setting."));
$("pause-toggle").addEventListener("click", () => {
  $("pause-menu").hidden = !$("pause-menu").hidden;
  $("pause-toggle").setAttribute("aria-expanded", String(!$("pause-menu").hidden));
});
function pauseFor(minutes) {
  state.undo = null;
  return mutate((latest) => ({ disabledUntil: Math.max(Date.now(), Number(latest.disabledUntil) || 0) + minutes * 60000 }), "Paused everywhere.");
}
$("pause-global").addEventListener("click", () => pauseFor(Number($("pause-duration").value)));
$("extend-pause").addEventListener("click", () => pauseFor(60));
$("resume-global").addEventListener("click", () => {
  state.undo = null;
  mutate(() => ({ disabledUntil: 0 }), "Resumed.");
});
for (const id of ["open-settings", "all-sites"]) $(id).addEventListener("click", () => chrome.runtime.openOptionsPage());
$("refresh-tab").addEventListener("click", async () => {
  try { await chrome.tabs.reload(state.tab.id); state.connection = "checking"; state.page = null; render(); }
  catch { feedback("Couldn’t refresh this tab.", true); }
});
chrome.storage.onChanged.addListener(async (_changes, area) => {
  if (area !== "sync" || state.busy) return;
  try { state.settings = await chrome.storage.sync.get(DEFAULTS); render(); await checkPage(); }
  catch { feedback("Couldn’t read settings.", true); }
});

async function initialize() {
  const [settings, tabs] = await Promise.all([chrome.storage.sync.get(DEFAULTS), chrome.tabs.query({ active: true, currentWindow: true })]);
  state.settings = settings;
  state.tab = tabs[0];
  let url;
  try { url = new URL(state.tab?.url); } catch { /* Unsupported page */ }
  state.supported = !!url && ["http:", "https:", "file:"].includes(url.protocol) &&
    url.hostname !== "chromewebstore.google.com" && !(url.hostname === "chrome.google.com" && url.pathname.startsWith("/webstore"));
  state.hostname = state.supported ? url.protocol === "file:" ? "__nightshade_local_files__" : url.hostname : null;
  $("site-name").textContent = state.hostname === "__nightshade_local_files__" ? "Local files" : state.hostname || "Protected page";
  $("site-name").title = $("site-name").textContent;
  render();
  await checkPage();
}
initialize().catch(() => feedback("Couldn’t read this tab.", true));
setInterval(() => { if (!state.busy) { render(); checkPage(); } }, 1000);
