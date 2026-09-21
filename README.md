# Nightshade

<p align="center"><img src="assets/nightshade-logo.png" alt="Nightshade eclipse logo" width="96"></p>

[![CI](https://github.com/TimelyToga/nightshade-dark-mode/actions/workflows/ci.yml/badge.svg)](https://github.com/TimelyToga/nightshade-dark-mode/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Dark mode where it's missing. Leave existing dark themes alone.**

A lightweight Chrome extension with automatic dark-theme detection, per-site controls, and no analytics or server.

## See the difference

![Community-news layout: original on the left, Nightshade on the right](docs/screenshots/news-comparison.png)

## Automatic, with an escape hatch

| Darkens light pages | Detects existing dark themes | Pause everywhere |
| --- | --- | --- |
| ![Auto: Darkening this page](docs/screenshots/popup-light.png) | ![Auto: Already dark, left as is](docs/screenshots/popup-native.png) | ![Paused with Resume now and plus one hour controls](docs/screenshots/popup-paused.png) |
| **Auto** follows your global default. | Native-dark detection avoids double inversion. | Pause for 15 minutes–24 hours; resume early or extend. |

- **Auto / Always / Never:** follow defaults, force dark mode, or exclude a site. Select Auto to undo a mode override.
- **Appearance:** adjust dimming and preserve photo/video colors. Each setting can return to its default independently.
- **All sites:** review saved rules and global defaults. Settings sync through Chrome Sync.
- **Readable details:** special handling for interface icons, mixed-color logos, and Google Docs text canvases.

<details>
<summary>More screenshots: overrides, appearance, and document rendering</summary>

| Custom appearance | Site excluded |
| --- | --- |
| ![Always enabled with custom dimming and media settings expanded](docs/screenshots/popup-custom.png) | ![Never enabled with Back to Auto control](docs/screenshots/popup-never.png) |

![Canvas-rendered document: original on the left, readable dark text surface on the right](docs/screenshots/document-comparison.png)

| Original page | Nightshade enabled |
| --- | --- |
| ![Representative light page](docs/screenshots/nightshade-before.jpg) | ![Same page darkened](docs/screenshots/nightshade-after.jpg) |

</details>

New captures use synthetic pages and the shipping UI with simulated site states—not private accounts.

## Install

1. Download and extract `nightshade-dark-mode.zip` from [Releases](https://github.com/TimelyToga/nightshade-dark-mode/releases/latest).
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the extracted folder containing `manifest.json`.

Not yet on the Chrome Web Store. To update, replace the files, reload the extension, and refresh open tabs.

## Good to know

Detection is heuristic; use Always or Never when it guesses wrong. Protected Chrome pages cannot be changed. Filters can alter artwork colors—especially images sharing a Docs canvas—and complex sites may need an override.

[Controls & limitations](docs/usage.md) · [Privacy](PRIVACY.md) · [Contributing / build from source](CONTRIBUTING.md) · [Security](SECURITY.md) · [MIT license](LICENSE)
