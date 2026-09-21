# Regression library and engine evaluation

Evaluated 2026-09-20 after the transparent-logo and inline-SVG changes.

## What failed, and why

The original media rule counter-inverted **every SVG and image**. A dark interface icon was therefore restored to its original dark color, even though its white background had become black. 1Password's logo is an external SVG image containing a single dark shape and transparent cutouts; its navigation controls are inline SVGs using `currentColor`.

The fix separates media policy from settings and dark detection in `src/media.js`. Single-color inline SVGs follow page inversion; multicolor/complex SVGs remain preserved. A named, hostname-and-asset-scoped rule covers the external transparent logo. A mutation observer handles inserted and recolored icons, batches work per animation frame, ignores its own markers, and disconnects when preservation is inactive. No private HTML, vendor scripts, account names, vault metadata or user images are checked in.

## Coverage library

| Situation | Automated coverage | Remaining gap |
| --- | --- | --- |
| Transparent dark logo + currentColor icons | Domain-bound unit checks; actual CSS/controller browser case | Real vendor may rename the asset; no live authenticated test |
| Mixed logo: gradient symbol + dark lettering | Dark-neutral paint unit checks; labelled/unlabelled/light-wordmark browser cases; relabelling and disable/re-enable | Only inline SVGs labelled logo/wordmark; heuristic cannot identify lettering by geometry |
| Multicolor SVG and image | Browser checks for preservation on/off; visual gallery | Pixel/contrast thresholds not yet automated; image fixture is synthetic SVG |
| SPA icon insertion/recolor/removal | Browser mutations and filter assertions | CSS stylesheet replacement, hover-only colors, animations |
| Disable/re-enable | Browser checks removal/restoration of effective filters | Full Chrome extension reload and storage migration |
| Google dark root | Unit + actual renderer case | Future layout/theme changes |
| Gmail nested/delayed dark shell | Unit + browser cases including delayed paint | Theme changes after the five-second initialization window |
| Hacker News transparent layout | Fallback CSS unit check + rendered fixture | Screenshot comparison of gutter pixels |
| Global default, site force/exclusion, timed pause | Unit + browser state/filter assertions | Popup interaction, sync races and exact timer expiry in Chrome |
| Popup status and options page | Markup checks only | Real UI interactions and agreement with page status |
| Shadow DOM, embedded content, CSS background art | No dedicated fixtures yet | Highest-priority additions after state tests |

`npm test` runs the Node unit suite. `npm run test:browser` starts a loopback-only server; opening the gallery automatically executes its assertions. The gallery loads production JS/CSS, but mocks Chrome storage/messages and uses an injected hostname for the logo controller. It does **not** prove Chrome manifest injection or authenticated-site behavior. All examples are synthetic and safe to publish. The server exposes only source assets and fixture files.

## Recommended testing workflow

For every reported regression, add the smallest synthetic page that reproduces its rendering mechanism, show the failure on the old engine, then require it to pass on the new one. Keep the case even after the fix. Name cases by mechanism with the motivating site as context; avoid a library of private saved pages.

Next, automate this same gallery in a pinned headless Chromium runner (`headless: true`) and make failures block changes in CI. Add an actual unpacked-extension smoke suite for manifest injection, storage changes, popup status, pause/resume and reloads. Capture stable per-case screenshots with fixed viewport/fonts/animations and compare against reviewed baselines; supplement them with foreground/background contrast assertions for icons and controls. Baseline updates must be reviewed, not blindly accepted. Keep manual visual review in the isolated in-app browser.

The current gallery provides automatically evaluated browser assertions once opened, not unattended CI or pixel comparison. No Playwright dependency was installed in this update because approval review blocked the installation.

## Code evaluation and priorities

1. **One effective-state model.** Defaults, normalization and rule precedence are duplicated across `content.js`, `popup.js` and `options.js`. Extract a shared pure resolver returning `{ active, reason, source }`; make the content script authoritative for observed page state. Popup currently derives most state from saved preferences and only receives a detector boolean, so disconnected or stale pages can disagree with its label. Test state transitions and UI behavior, replacing string-presence tests.

2. **Improve detection confidence and lifecycle.** `color-scheme: light dark` currently counts as already dark even though it only declares support for both schemes. Root/body darkness also wins even when most visible panels are light. Base decisions on the active rendered surfaces, keep support declarations as secondary evidence, and record a reason/confidence for diagnostics. Recheck on bounded, debounced theme/media-query/navigation changes, not just 500 ms, 2 s and 5 s startup timers. Avoid sampling Nightshade's own changes or introducing flicker.

3. **Keep classification and site exceptions separate.** The new media module is a first boundary. Grow its small declarative registry with a rule ID, host/asset scope, reason, fixture and last verification date. Do not guess that every small image is an icon. Ambiguous cases should offer a targeted media override rather than require disabling preservation for every photo. Palette counting is a heuristic: a one-color illustration can be treated as an icon, while a two-tone icon or sprite may stay too dark. Add fixtures before broadening rules.

4. **Measure cost and cover encapsulation.** Mutation work is batched and large SVGs fall back, but initial scanning and ancestor class/style changes can still scan a large subtree. Benchmark an icon-dense app, coalesce ancestor/descendant work, and add a per-frame budget if needed. Shadow roots are not traversed. Cross-origin frames cannot be selectively repaired by the top document; the existing top-only filter avoids double inversion but leaves media limitations.

5. **Treat whole-page inversion as a compatibility mode.** It is compact and reversible, but cannot perfectly handle mixed light/dark regions, existing filters, transparent image logos, CSS backgrounds, video overlays and all embedded surfaces. If fixture coverage shows these dominate, evaluate a computed-color transformation engine behind a separate mode. Do not silently replace the current renderer without comparative visual/performance evidence.

The immediate recommendation is shared state plus a headless fixture gate. A full rendering-engine rewrite would be premature; the fixture library should establish where the current approach actually fails.

## Mixed-logo follow-up — 2026-09-21

Meta's supplied logo separates a dark blue-gray wordmark path (`#1c2b33`) from colored and gradient symbol paths. Preserving the entire SVG hid the wordmark. The repair recognizes logo/wordmark labels (`aria-label`, `aria-labelledby`, or SVG title), then adds a reversible extra inversion only to solid dark near-neutral shapes inside preserved artwork. Gradients and saturated paint remain preserved. Existing filters on candidate shapes, masks, clipping, embedded images, and sprite references are excluded. The original fills/strokes are not overwritten.

This generalizes by rendering pattern rather than a Meta hostname or generated class name. It is intentionally conservative: the label must contain the English word logo or wordmark, all visible paints on the candidate shape must be dark neutral, and the SVG must contain at most 128 shapes. A labelled logo's dark decorative shape may still be selected; there is no OCR or geometric text recognition. Browser regression fixtures use original synthetic geometry and the observed color pattern, not the saved account page. Verification: 19 Node tests and 15 browser scenarios passed, with isolated in-app visual inspection.
