# Nightshade — Dark Mode Anywhere

Nightshade is a small Manifest V3 Chrome extension that gives light-only websites a reversible dark mode. It skips sites that already expose a dark root or body background, supports per-site overrides, preserves media colors by default, and offers optional extra dimming.

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

Before keeping the filter, it inspects author-owned body and root backgrounds. A clearly dark background or an author-declared dark `color-scheme` is left untouched unless the user explicitly enables Nightshade for that hostname. This prevents the pale double-inversion seen on Google's native dark homepage.

Settings use Chrome Sync storage. No browsing history, page content, or account data is collected or transmitted.

## Common failure modes

| Symptom | Smallest correction |
| --- | --- |
| A native dark site is inverted into a pale page | Nightshade should now auto-skip it. If a site uses an unusual transparent shell, turn it off for that hostname. |
| A bright photo, video, chart, or map remains distracting | Disable **Preserve photo and video colors** or increase **Extra dimming**. |
| A CSS background logo looks strange | Exclude the site; generic CSS cannot safely isolate every background image from its surrounding element. |
| The extension seems unchanged after rebuilding | Reload the extension and then refresh the website tab. |
| A canvas-heavy app feels slower | Exclude that hostname; full-page filters can be GPU-intensive. |
| Colors are safety-critical | Disable Nightshade for that site. The filtered result is not color-accurate. |
