const cases = [
  { id: "startup-native", title: "Startup: native dark never inverted to white", root: "#202124", body: "transparent", skip: true, startup: true },
  { id: "startup-light", title: "Startup: light content guarded until settings arrive", body: "white", startup: true },
  { id: "docs-canvas", title: "Docs: transparent document text canvas", body: "white", documentCanvas: true },
  { id: "sheets-canvas", title: "Sheets: cell grid, headers and selection", body: "white", documentCanvas: true, sheets: true },
  { id: "mixed-logo", title: "Meta pattern: blue gradient + dark wordmark", body: "white", logo: true },
  { id: "mixed-art", title: "Same palette in unlabelled artwork: preserve", body: "white", logo: true, unlabelled: true },
  { id: "light-logo", title: "Light wordmark: no extra inversion", body: "white", logo: true, lightWordmark: true },
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
function mixedLogo(spec) {
  return `<svg id="mixed-logo" ${spec.unlabelled ? '' : 'aria-label="Example logo"'} role="img" width="180" height="48" viewBox="0 0 180 48">
    <defs><linearGradient id="brand"><stop stop-color="#0064e0"/><stop offset="1" stop-color="#0180fa"/></linearGradient></defs>
    <path id="brand-symbol" fill="none" stroke="url(#brand)" stroke-width="5" d="M6 24C6 0 23 0 32 24S58 48 58 24S41 0 32 24S6 48 6 24"/>
    <g fill="${spec.lightWordmark ? '#eeeeee' : '#1c2b33'}"><path id="wordmark" d="M72 38V10H78L86 25L94 10H100V38H94V21L86 35L78 21V38Z M108 10H132V16H114V21H128V27H114V32H132V38H108Z"/></g>
    </svg>`;
}
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
    ${spec.logo ? mixedLogo(spec) : ""}
    ${spec.documentCanvas ? `<div ${spec.sheets ? 'id="docs-editor"' : ''}><canvas id="document-tile" class="${spec.sheets ? '' : 'kix-canvas-tile-content'}" width="360" height="110"></canvas></div><canvas id="ordinary-canvas" width="80" height="40"></canvas>` : ""}
    <p>Readable text and controls</p><button>Example action</button></main>
    <script>window.chrome={storage:{sync:{get:async()=>{${spec.startup ? 'await new Promise(resolve=>setTimeout(resolve,250));' : ''}return (${JSON.stringify(settings)})}},onChanged:{addListener(fn){window.changeSettings=fn}}},runtime:{onMessage:{addListener(){}}}};
    ${spec.startup ? `window.startupFrames=[];const start=performance.now();function sample(){startupFrames.push({filter:getComputedStyle(document.documentElement).filter,visibility:getComputedStyle(document.body).visibility,ready:document.documentElement.dataset.nightshadeReady});if(performance.now()-start<600)requestAnimationFrame(sample)}requestAnimationFrame(sample);` : ''}<\/script>
    <script src="/src/media.js"><\/script>
    ${spec.documentCanvas ? `<script>const create = NightshadeMedia.createController; NightshadeMedia.createController = (doc) => create(doc, "docs.google.com", "/${spec.sheets ? 'spreadsheets' : 'document'}/d/synthetic/preview");<\/script>` : ''}
    <script src="/src/content.js"><\/script></body></html>`;
  await new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
  await wait(spec.startup ? 650 : 120);
  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  const filter = (selector) => win.getComputedStyle(doc.querySelector(selector)).filter;
  try {
    const active = spec.active ?? !spec.skip;
    check(doc.documentElement.dataset.nightshadeActive === String(active), "Effective active state is wrong");
    check(doc.documentElement.dataset.nightshadeAutoSkipped === String(!!spec.skip), "Native-dark skip state is wrong");
    check((filter("html") !== "none") === active, "Actual root filter does not match state");
    if (spec.startup) {
      check(win.startupFrames.some(f => !f.ready && f.visibility === "hidden"), "Startup guard not observed");
      check(win.startupFrames.some(f => f.ready && f.visibility === "visible"), "Startup guard not released");
      if (spec.skip) check(win.startupFrames.every(f => f.filter === "none"), "Native dark page briefly inverted");
      else check(win.startupFrames.every(f => f.visibility === "hidden" || f.filter !== "none"), "Light page exposed without darkening");
    }
    if (spec.documentCanvas) {
      const tile = doc.querySelector("#document-tile");
      const paint = (canvas) => {
        const context = canvas.getContext("2d");
        context.fillStyle = "black";
        context.fillRect(4, 4, 12, 12);
        context.font = "20px sans-serif";
        context.fillText("Readable document text", 4, 45);
        context.fillStyle = "#eeeeee";
        context.fillRect(0, 60, 350, 50);
        context.fillStyle = "green";
        context.fillText("example code", 4, 90);
      };
      paint(tile);
      if (spec.sheets) {
        const ctx = tile.getContext("2d");
        ctx.fillStyle = "white"; ctx.fillRect(0, 0, 360, 110);
        ctx.fillStyle = "#e8eaed"; ctx.fillRect(0, 0, 360, 25);
        ctx.fillStyle = "black"; ctx.font = "14px sans-serif";
        ctx.fillText("A                     B                      C", 15, 18);
        ctx.fillText("Task 1              Example task        Ready", 8, 49);
        ctx.fillText("Task 2              Another task        Open", 8, 79);
        ctx.strokeStyle = "#bbb"; ctx.lineWidth = 1;
        for (const x of [0, 100, 240, 359]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 110); ctx.stroke(); }
        for (const y of [25, 55, 85]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); }
        ctx.strokeStyle = "#4285f4"; ctx.lineWidth = 2; ctx.strokeRect(1, 26, 98, 28);
      }
      doc.querySelector("#ordinary-canvas").getContext("2d").fillRect(0, 0, 80, 40);
      check(filter("#document-tile") === "none", "Document text counter-inverted to black");
      check(filter("#ordinary-canvas") !== "none", "Ordinary canvas no longer preserved");
      const originalPixels = [...tile.getContext("2d").getImageData(4, 4, 1, 1).data].join();
      check(originalPixels === (spec.sheets ? "232,234,237,255" : "0,0,0,255"), "Document pixels were modified");
      if (spec.sheets) tile.parentElement.removeAttribute("id");
      else tile.classList.remove("kix-canvas-tile-content");
      await wait(80);
      check(filter("#document-tile") !== "none", "Stale document classification remains");
      if (spec.sheets) tile.parentElement.id = "docs-editor";
      else tile.classList.add("kix-canvas-tile-content");
      await wait(80);
      check(filter("#document-tile") === "none", "Document classification not restored");
      const late = tile.cloneNode();
      late.id = "late-document-tile";
      tile.parentElement.append(late);
      await wait(80);
      check(filter("#late-document-tile") === "none", "Lazy document page not classified");
      if (spec.sheets) {
        doc.querySelector("main").append(late);
        await wait(80);
        check(filter("#late-document-tile") !== "none", "Canvas moved out of editor still themed");
      }
      late.remove();
      win.chrome.storage.sync.get = async () => ({ ...settings, globalEnabled: false });
      win.changeSettings({}, "sync");
      await wait(80);
      check(filter("html") === "none" && filter("#document-tile") === "none", "Disabling left document inverted");
      win.chrome.storage.sync.get = async () => settings;
      win.changeSettings({}, "sync");
      await wait(80);
      check(filter("#document-tile") === "none", "Re-enable lost document classification");
    }
    if (spec.logo) {
      const shouldRepair = !spec.unlabelled && !spec.lightWordmark;
      check(filter("#mixed-logo") !== "none", "Brand artwork not preserved");
      check(filter("#brand-symbol") === "none", "Brand gradient changed");
      check((filter("#wordmark") !== "none") === shouldRepair, "Wordmark contrast repair incorrect");
      check(win.getComputedStyle(doc.querySelector("#wordmark")).fill === (spec.lightWordmark ? "rgb(238, 238, 238)" : "rgb(28, 43, 51)"), "Author paint was overwritten");
      if (shouldRepair) {
        const logo = doc.querySelector("#mixed-logo");
        logo.removeAttribute("aria-label");
        await wait(80);
        check(filter("#wordmark") === "none", "Relabelling left stale repair");
        logo.setAttribute("aria-label", "Example logo");
        await wait(80);
        win.chrome.storage.sync.get = async () => ({ ...settings, globalEnabled: false });
        win.changeSettings({}, "sync");
        await wait(80);
        check(filter("#wordmark") === "none" && filter("#mixed-logo") === "none", "Repair survives disabling");
        win.chrome.storage.sync.get = async () => settings;
        win.changeSettings({}, "sync");
        await wait(80);
        check(filter("#wordmark") !== "none", "Repair not restored on re-enable");
      }
    }
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
