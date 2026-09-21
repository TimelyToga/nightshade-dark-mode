const specs = [
  { id: "light", title: "Auto · light page", host: "github.com" },
  { id: "native", title: "Auto · already dark", host: "claude.ai", native: true },
  { id: "custom", title: "Always · custom appearance", host: "example.com", site: { enabled: true, dim: 20, preserveMedia: false }, expanded: true },
  { id: "paused", title: "Paused · saved Always rule", host: "mail.google.com", site: { enabled: true }, paused: true },
  { id: "refresh", title: "Refresh needed", host: "news.ycombinator.com", disconnected: true },
  { id: "protected", title: "Protected page", host: "", url: "chrome://settings" },
  { id: "default-off", title: "Auto · global default off", host: "example.org", global: false },
  { id: "never", title: "Never · excluded site", host: "example.net", site: { enabled: false } }
];
const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
let pass = 0, fail = 0;
async function run(spec, markup) {
  const article = document.createElement("article");
  const title = document.createElement("h2"); title.textContent = spec.title;
  const frame = document.createElement("iframe"); frame.title = spec.title;
  const status = document.createElement("p");
  article.append(title, frame, status); document.getElementById("cases").append(article);
  const bootstrap = `<script>
    window.fixture = ${JSON.stringify(spec)};
    window.saved = { globalEnabled: fixture.global !== false, dim:10, preserveMedia:true, disabledUntil:fixture.paused ? Date.now()+3600000 : 0, sites:fixture.site ? {[fixture.host]:fixture.site} : {} };
    window.listeners=[];window.opened=0;window.reloaded=0;window.failWrite=false;
    window.chrome={storage:{sync:{get:async()=>structuredClone(saved),set:async(update)=>{if(failWrite)throw Error('write failure');Object.assign(saved,structuredClone(update));listeners.forEach(fn=>fn({},'sync'));}},onChanged:{addListener(fn){listeners.push(fn)}}},tabs:{query:async()=>[{id:1,url:fixture.url||'https://'+fixture.host+'/'}],sendMessage:async()=>{if(fixture.disconnected)throw Error('disconnected');const rule=saved.sites[fixture.host]||{};const paused=saved.disabledUntil>Date.now();const enabled=rule.enabled??saved.globalEnabled;const skip=!!(enabled&&!paused&&rule.enabled===undefined&&fixture.native);return {active:enabled&&!paused&&!skip,autoSkipped:skip,pausedUntil:paused?saved.disabledUntil:0}},reload:async()=>{reloaded++;fixture.disconnected=false}},runtime:{openOptionsPage(){opened++}}};
  <\/script>`;
  const loaded = new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
  frame.srcdoc = markup.replace("<head>", `<head><base href="${new URL("/src/", location.href).href}">` + bootstrap);
  await loaded; await wait();
  const w = frame.contentWindow, d = frame.contentDocument;
  const $ = (id) => d.getElementById(id);
  const choose = async (mode) => { d.querySelector(`input[value="${mode}"]`).click(); await wait(); };
  try {
    if (spec.id === "light") {
      assert($("state-title").textContent === "Darkening this page", "Active page misreported");
      await choose("never"); assert(w.saved.sites[spec.host].enabled === false, "Never not saved");
      $("undo").click(); await wait(); assert(!w.saved.sites[spec.host], "Undo did not restore inheritance");
      $("pause-toggle").click(); $("pause-global").click(); await wait();
      assert($("site-mode").disabled && !$("pause-banner").hidden, "Pause did not disable site mode");
      const deadline = w.saved.disabledUntil; $("extend-pause").click(); await wait();
      assert(w.saved.disabledUntil === deadline + 3600000, "Pause extension wrong");
      $("resume-global").click(); await wait(); assert(!$("site-mode").disabled, "Resume did not restore controls");
      w.failWrite = true; await choose("never");
      assert(!w.saved.sites[spec.host] && $("feedback").classList.contains("error"), "Write error did not preserve state");
      w.failWrite = false; $("feedback").hidden = true;
    } else if (spec.id === "native") {
      assert($("state-title").textContent === "Already dark, left as is", "Native status missing");
      assert($("appearance-toggle").disabled, "Inactive appearance should be disabled");
      await choose("always"); assert($("state-title").textContent === "Darkening this page", "Force-on not working");
      $("back-auto").click(); await wait(); assert(!w.saved.sites[spec.host], "Back to Auto failed");
      assert($("state-title").textContent === "Already dark, left as is", "Auto not restored");
      $("feedback").hidden = true;
    } else if (spec.id === "custom") {
      $("back-auto").click(); await wait();
      assert(w.saved.sites[spec.host].dim === 20 && w.saved.sites[spec.host].preserveMedia === false && !Object.hasOwn(w.saved.sites[spec.host],"enabled"), "Auto erased appearance overrides");
      await choose("always"); $("appearance-toggle").click();
      $("reset-dim").click(); await wait();
      assert(!Object.hasOwn(w.saved.sites[spec.host],"dim") && w.saved.sites[spec.host].enabled === true, "Dimming reset affected mode");
      $("undo").click(); await wait(); assert(w.saved.sites[spec.host].dim === 20, "Dimming undo failed");
      $("reset-media").click(); await wait();
      assert(!Object.hasOwn(w.saved.sites[spec.host],"preserveMedia") && w.saved.sites[spec.host].dim === 20, "Media reset affected dimming");
      $("undo").click(); await wait();
    } else if (spec.id === "paused") {
      assert(!$("pause-banner").hidden && $("site-mode").disabled, "Pause state missing");
      assert(d.querySelector('input[value="always"]').checked, "Saved rule hidden by pause");
    } else if (spec.id === "refresh") {
      assert(!$("refresh-tab").hidden && $("state-title").textContent.includes("Refresh"), "Disconnected page claims active");
      $("refresh-tab").click(); await wait(); assert(w.reloaded === 1, "Refresh did not call Chrome");
      w.fixture.disconnected = true;
    } else if (spec.id === "protected") {
      assert($("site-controls").hidden && $("refresh-tab").hidden, "Protected page exposes site controls");
      $("all-sites").click(); assert(w.opened === 1, "Settings inaccessible");
    } else if (spec.id === "default-off") {
      assert($("state-detail").textContent.includes("global default is off"), "Missing inherited-off reason");
      await choose("always"); assert($("state-title").textContent === "Darkening this page", "Explicit enable failed with global off");
      await choose("auto"); $("feedback").hidden = true;
    } else if (spec.id === "never") {
      assert($("state-detail").textContent === "Never on this site.", "Never reason missing");
    }
    assert(d.documentElement.scrollWidth <= 342, "Horizontal overflow");
    pass++; status.className = "pass"; status.textContent = "PASS";
  } catch (error) { fail++; status.className = "fail"; status.textContent = `FAIL: ${error.message}`; }
  setInterval(() => { frame.style.height = `${d.body.scrollHeight + 2}px`; }, 200);
}
(async () => {
  const markup = await (await fetch("/src/popup.html")).text();
  for (const spec of specs) await run(spec, markup);
  document.getElementById("summary").textContent = `${pass} passed · ${fail} failed · popup interaction scenarios`;
})();
