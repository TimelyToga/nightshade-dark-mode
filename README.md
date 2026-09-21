# Nightshade — Dark Mode Anywhere

<p align="center">
  <img src="assets/nightshade-logo.png" alt="Nightshade eclipse logo" width="144">
</p>

[![CI](https://github.com/TimelyToga/nightshade-dark-mode/actions/workflows/ci.yml/badge.svg)](https://github.com/TimelyToga/nightshade-dark-mode/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Nightshade is a small Chrome extension that adds a reversible dark mode to websites that do not provide one. It automatically leaves native dark themes alone and provides per-site controls for the exceptions.

> Nightshade is currently distributed as an unpacked extension through GitHub Releases. It is not yet available in the Chrome Web Store.

## Features

- Darkens light websites automatically.
- Detects and skips many native dark themes.
- Preserves photos, videos, and multicolor artwork by default.
- Supports per-site on/off, dimming, and media overrides.
- Can pause itself everywhere for 15 minutes to 24 hours.
- Stores settings with Chrome Sync and has no analytics or external service.

## What it looks like

| Original page | Nightshade enabled |
| --- | --- |
| ![A representative light page before Nightshade](docs/screenshots/nightshade-before.jpg) | ![The same page after Nightshade is enabled](docs/screenshots/nightshade-after.jpg) |

## Install

### From a GitHub release

1. Download `nightshade-dark-mode.zip` from the [latest release](https://github.com/TimelyToga/nightshade-dark-mode/releases/latest).
2. Extract the ZIP to a permanent folder. Chrome cannot load the ZIP directly.
3. Open `chrome://extensions` in Chrome.
4. Enable **Developer mode**.
5. Select **Load unpacked** and choose the extracted folder containing `manifest.json`.

When updating, replace the extracted files, select Nightshade's reload button on `chrome://extensions`, and refresh open website tabs.

### From source

Nightshade has no runtime or development dependencies beyond Node.js 24 and the `zip` command.

```sh
git clone https://github.com/TimelyToga/nightshade-dark-mode.git
cd nightshade-dark-mode
npm test
npm run build
```

Load `dist/nightshade-dark-mode` from `chrome://extensions`. The build also creates `dist/nightshade-dark-mode.zip`.

## Controls

The popup shows why Nightshade is on or off for the current page: global default, explicit site rule, timed pause, or native-dark detection.

- **Use dark mode here** saves an explicit on/off rule for the current hostname.
- **Reset this site to the default** removes all overrides for that hostname, including dimming and media settings.
- **Extra dimming** adds a translucent overlay after recoloring.
- **Preserve photo and video colors** counter-inverts common media so it keeps its original colors.
- **Default dark mode everywhere** controls websites without a site-specific rule.
- **Pause everywhere** temporarily disables Nightshade on every website, including sites forced on.

Site rules and global defaults can also be reviewed from **Extension settings**.

## How it works

Nightshade applies `invert(1) hue-rotate(180deg)` to the page and selectively counter-inverts media. It samples rendered backgrounds to avoid double-inverting sites that already use a dark theme. A small media classifier handles single-color interface icons, multicolor artwork, transparent logos, and dynamic page updates.

The filter runs on the top document so embedded mail and document frames do not receive a second inversion.

## Limitations

- Chrome internal pages, the Chrome Web Store, and some protected sign-in or PDF surfaces cannot be modified by extensions.
- Local files require **Allow access to file URLs** on Nightshade's extension card.
- CSS background images, shadow DOM, canvas-heavy apps, and mixed light/dark layouts can still need a site override.
- Filtered colors are not color-accurate. Disable Nightshade for color-critical work.
- Whole-page filters can increase GPU use on complex pages.

Please report rendering problems with a public URL or a minimal synthetic example. Remove personal information from screenshots and never attach a saved authenticated webpage.

Report security and privacy vulnerabilities through the private process in [SECURITY.md](SECURITY.md).

## Development

```sh
npm test             # Node regression tests
npm run build         # Unpacked extension and release ZIP
npm run test:browser  # Local visual regression gallery on port 8769
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the regression-fixture workflow. CI runs the tests, validates the release ZIP, and uploads it as a workflow artifact. Pushing a version tag such as `v0.1.0` also creates a GitHub Release with the ZIP and SHA-256 checksum.

## Privacy

Nightshade has no server and does not send page contents, browsing history, or analytics to the developer. Settings are stored through Chrome Sync and may be synchronized by Chrome according to the browser account's settings. See [PRIVACY.md](PRIVACY.md).

## License

[MIT](LICENSE)
