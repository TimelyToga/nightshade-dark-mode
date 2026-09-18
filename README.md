# Nightshade — Dark Mode Anywhere

<p align="center">
  <img src="design/logo-concepts/eclipse-leaf-corona-beam.png" alt="Nightshade eclipse-and-leaf logo" width="160">
</p>

Nightshade is a small Manifest V3 Chrome extension that gives light-only websites a reversible dark mode. It skips sites that already expose a dark root or body background, supports per-site overrides, preserves media colors by default, offers optional extra dimming, and can pause itself everywhere for 15 minutes to 24 hours.

## Effect

| Light-only page | Nightshade enabled |
| --- | --- |
| ![Representative productivity page before Nightshade](docs/screenshots/nightshade-before.png) | ![The same page with Nightshade enabled](docs/screenshots/nightshade-after.png) |

These screenshots use the same inversion and 10% dimming applied by the extension on a representative light-only page. Native dark pages are detected and left unchanged.

## Build and load

```sh
npm test
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select:

```text
dist/nightshade-dark-mode
```

After rebuilding, click Nightshade's reload button in `chrome://extensions` and refresh the website tab. A distributable archive is also written to `dist/nightshade-dark-mode.zip`.

Chrome does not allow extensions to restyle its internal pages, the Chrome Web Store, or some protected PDF/sign-in surfaces. For local files, enable **Allow access to file URLs** on Nightshade's extension card.

## How it works

Nightshade applies a reversible `invert(1) hue-rotate(180deg)` filter at `document_start`, then applies the same filter to photos, videos, canvases, and SVGs so their intended colors are restored. A pointer-transparent overlay provides extra dimming.

Before keeping the filter, it inspects author-owned body and root backgrounds plus representative opaque surfaces across the viewport. A clearly dark page or an author-declared dark `color-scheme` is left untouched unless the user explicitly enables Nightshade for that hostname. Delayed checks cover app shells such as Gmail that paint their theme after initial load.

The filter runs only on the top document. Embedded mail and document frames inherit that single filter instead of receiving a second inversion.

Settings use Chrome Sync storage. No browsing history, page content, or account data is collected or transmitted.

The popup's pause slider is a hard global override, including for sites that were explicitly enabled. Open pages resume automatically when the timer expires, or immediately when **Resume now** is clicked.

## Common failure modes

| Symptom | Smallest correction |
| --- | --- |
| A native dark site is inverted into a pale page | Nightshade should now auto-skip it. If a site uses an unusual transparent shell, turn it off for that hostname. |
| An embedded email or document keeps the wrong theme | Nightshade filters the top document once so nested frames do not double-invert. |
| A narrow page leaves bright outer gutters | Nightshade pre-inverts its fallback background so transparent layouts, including Hacker News, finish dark. |
| A bright photo, video, chart, or map remains distracting | Disable **Preserve photo and video colors** or increase **Extra dimming**. |
| A CSS background logo looks strange | Exclude the site; generic CSS cannot safely isolate every background image from its surrounding element. |
| The extension seems unchanged after rebuilding | Reload the extension and then refresh the website tab. |
| A canvas-heavy app feels slower | Exclude that hostname; full-page filters can be GPU-intensive. |
| Colors are safety-critical | Disable Nightshade for that site. The filtered result is not color-accurate. |
