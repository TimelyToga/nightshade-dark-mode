const cases = [
  { id: "icons", title: "1Password: transparent logo and UI icons", body: "white", icons: true, settings: { preserveMedia: false } },
  { id: "art", title: "Multicolor artwork and photos", body: "white", art: true },
  { id: "dynamic", title: "SPA: inserted and recolored icons", body: "white", dynamic: true },
  { id: "google", title: "Google: native dark root", root: "#202124", body: "transparent", skip: true },
  { id: "gmail", title: "Gmail: nested native dark surfaces", body: "transparent", surface: "#202124", skip: true },
  { id: "late", title: "Gmail: delayed dark app shell", body: "transparent", surface: "white", delayed: true },
  { id: "hn", title: "Hacker News: transparent gutters", body: "transparent", surface: "#f6f6ef" },
  { id: "off", title: "Global default off", body: "white", settings: { globalEnabled: false }, active: false },
  // about:srcdoc has an empty hostname; match that explicit fixture origin.
  { id: "force", title: "Explicit force on native dark", body: "#202124", settings: { sites: { "": { enabled: true } } } },
  { id: "exclude", title: "Explicit site exclusion", body: "white", settings: { sites: { "": { enabled: false } } }, active: false },
  { id: "pause", title: "Pause overrides force-on", body: "white", settings: { disabledUntil: Date.now() + 60000, sites: { "": { enabled: true } } }, active: false },
  { id: "media-off", title: "Media preservation disabled", body: "white", art: true, settings: { preserveMedia: false } }
];
const icon = '<svg id="icon" width="40" height="40" fill="currentColor" viewBox="0 0 40 40"><path d="M5 5h30v30H5zM12 12v16h16V12z" fill-rule="evenodd"/></svg>';
const illustration = '<svg id="art" width="90" height="40"><rect width="45" height="40" fill="#ee7755"/><rect x="45" width="45" height="40" fill="#3388cc"/></svg>';
const defaults = { globalEnabled: true, disabledUntil: 0, dim: 0, preserveMedia: true, sites: {} };
let passed = 0;
let failed = 0;
const check = (condition, message) => { if (!condition) throw new Error(message); };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(spec) {
  const article = document.createElement("article");
  const title = document.createElement("h2");
  title.textContent = spec.title;
  const frame = document.createElement("iframe");
  frame.title = spec.title;
  const result = document.createElement("p");
  result.className = "result";
  article.append(title, frame, result);
  document.getElementById("cases").append(article);
  const settings = { ...defaults, ...spec.settings };
  frame.srcdoc = `<!doctype html><html><head><style>
    html { background: ${spec.root || "transparent"}; } body { margin:0; background:${spec.body}; color:${spec.skip || spec.id === "force" ? "#eee" : "#181818"}; font:16px system-ui; }
    main { box-sizing:border-box; min-height:100vh; padding:24px; background:${spec.surface || "transparent"}; }
    svg,img { vertical-align:middle; margin-right:16px; } button { margin-top:16px; }
    </style><link rel="stylesheet" href="/src/content.css"></head><body><main>
    <h3>Example application</h3>
    ${spec.icons ? '<img id="logo" width="48" height="48" src="/test/browser/1password-logo-a123.svg">' + icon : ""}
    ${spec.art ? illustration + '<img id="photo" width="60" height="40" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'40\'%3E%3Cpath fill=\'%233388cc\' d=\'M0 0h60v40H0z\'/%3E%3C/svg%3E">' : ""}
    <p>Readable text and controls</p><button>Example action</button></main>
    <script>window.chrome={storage:{sync:{get:async()=>(${JSON.stringify(settings)})},onChanged:{addListener(fn){window.changeSettings=fn}}},runtime:{onMessage:{addListener(){}}}};<\/script>
    <script src="/src/media.js"><\/script><script src="/src/content.js"><\/script></body></html>`;
  await new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
  await wait(120);
  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  const filter = (selector) => win.getComputedStyle(doc.querySelector(selector)).filter;
  try {
    const active = spec.active ?? !spec.skip;
    check(doc.documentElement.dataset.nightshadeActive === String(active), "Effective active state is wrong");
    check(doc.documentElement.dataset.nightshadeAutoSkipped === String(!!spec.skip), "Native-dark skip state is wrong");
    check((filter("html") !== "none") === active, "Actual root filter does not match state");
    if (spec.icons) {
      // Fixture file is original artwork; use the real asset family's filename
      // for matching without loading a vendor asset or requiring a live account.
      const rule = win.NightshadeMedia.imageRule("my.1password.com", "/assets/1password-logo-a123.svg", doc.baseURI);
      check(rule === "1password-transparent-logo", "Logo rule missing");
      // Exercise the full controller with a matching synthetic URL.
      doc.documentElement.dataset.nightshadePreserveMedia = "true";
      const controller = win.NightshadeMedia.createController(doc, "my.1password.com");
      controller.setEnabled(true);
      check(filter("#logo") === "none", "Transparent logo incorrectly counter-inverted");
      check(filter("#icon") === "none", "currentColor UI icon incorrectly counter-inverted");
      controller.setEnabled(false);
    }
    if (spec.art) {
      const preserve = settings.preserveMedia;
      check((filter("#art") !== "none") === preserve, "Multicolor artwork preservation wrong");
      check((filter("#photo") !== "none") === preserve, "Image preservation wrong");
    }
    if (spec.dynamic) {
      doc.querySelector("main").insertAdjacentHTML("beforeend", icon);
      await wait(80);
      check(doc.querySelector("#icon").dataset.nightshadeMedia === "theme", "Inserted icon not classified");
      doc.querySelector("#icon").insertAdjacentHTML("beforeend", '<circle cx="20" cy="20" r="6" fill="red"/>');
      await wait(80);
      check(filter("#icon") !== "none", "Changed multicolor SVG not reclassified");
      doc.querySelector("#icon circle").remove();
      await wait(80);
      check(filter("#icon") === "none", "Removed artwork did not reclassify to icon");
      doc.querySelector("main").insertAdjacentHTML("beforeend", illustration);
      await wait(80);
      win.chrome.storage.sync.get = async () => ({ ...settings, globalEnabled: false });
      win.changeSettings({}, "sync");
      await wait(80);
      check(filter("html") === "none" && filter("#art") === "none", "Disabling left media filters behind");
      win.chrome.storage.sync.get = async () => settings;
      win.changeSettings({}, "sync");
      await wait(80);
      check(filter("#art") !== "none", "Re-enabling did not restore media handling");
    }
    if (spec.delayed) {
      doc.querySelector("main").style.background = "#202124";
      doc.querySelector("main").style.color = "#eee";
      await wait(2100);
      check(doc.documentElement.dataset.nightshadeAutoSkipped === "true", "Delayed native dark shell not skipped");
      check(filter("html") === "none", "Delayed shell still inverted");
    }
    passed++;
    result.textContent = "PASS — rendering and state assertions";
  } catch (error) {
    failed++;
    result.classList.add("fail");
    result.textContent = `FAIL — ${error.message}`;
  }
}
(async () => {
  for (const spec of cases) await run(spec);
  document.getElementById("summary").textContent = `${passed} passed · ${failed} failed · ${cases.length} browser scenarios`;
})();
