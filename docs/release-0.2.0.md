## Google Docs, Sheets and Slides

- **Docs:** readable dark-mode text in canvas-rendered documents and previews.
- **Sheets:** dark cell grids and row/column headers, not just the toolbar.
- **Slides:** dark slide surfaces and thumbnails, with separately embedded SVG images retaining their colors when media preservation is enabled.

## Other improvements

- Reduced loading flashes with a short dark startup guard and local per-domain theme memory. Remembered decisions are rechecked after loading.
- Clear Auto / Always / Never controls, native-dark status, independent appearance resets, Undo, and timed global pause.
- Improved transparent logos and mixed-color wordmarks.
- Shorter README with page comparisons and popup-state screenshots.

## Install or update

Download and extract **nightshade-dark-mode.zip**. In `chrome://extensions`, enable Developer mode and use **Load unpacked**, or replace the files in your existing extension folder and click Reload. Refresh open website tabs afterward. Unpacked installations do not update automatically.

## Known limitations

Filtering changes displayed colors, not saved documents or exports. Vector colors and images sharing a canvas can shift; already-dark slides can become light. Use Never for color-critical work. Chrome's blank navigation frame before extension injection is outside Nightshade's control.

Docs, Sheets and Slides fixes have synthetic regression coverage; compatibility with every document layout is not guaranteed. Theme memory is local, not synced, and disabled in incognito.
