# Controls and limitations

## Site controls

The popup separates your saved site mode from what Nightshade is doing now.

- **Auto** follows the global default and skips detected native dark themes.
- **Always** forces Nightshade on, even when the global default is off or the page already looks dark.
- **Never** excludes this hostname.
- **Back to Auto** clears only the mode override; custom dimming and media preferences stay saved.
- **Appearance** expands while Nightshade is active. Each field shows Default or Custom and has an independent reset.
- **Undo** restores the last site-field change while the popup remains open.
- **Pause everywhere** overrides every site rule. Choose 15 minutes–24 hours, Resume now, or +1 hour.
- **Refresh tab** appears when the page script cannot be reached. Protected pages hide site controls.

Use the gear or **All sites** to review site rules and edit global defaults. The global default is not a master switch for Always sites; use Pause to suspend everything.

## Rendering

Nightshade applies `invert(1) hue-rotate(180deg)` to the top document and selectively counter-inverts media. Background sampling detects many existing dark themes. The media classifier handles monochrome interface icons, multicolor artwork, transparent logos, and dynamic updates.

Embedded frames are not independently inverted a second time. Google Docs document-text canvases follow the page inversion so black text remains readable; images drawn into the same canvas also invert.

## Limitations

- Chrome internal pages, the Web Store, and some protected sign-in/PDF surfaces cannot be modified.
- Local files require **Allow access to file URLs** on the extension card.
- CSS background images, shadow DOM, canvas-heavy apps, and mixed light/dark layouts may need a site override.
- Filtered colors are not color-accurate. Disable Nightshade for color-critical work.
- Whole-page filters can increase GPU use on complex pages.

Report problems with a public URL or minimal synthetic example. Remove personal information from screenshots; never attach a saved authenticated webpage.
