# Screenshot provenance

The new popup and comparison captures use the shipping CSS/JS in the isolated in-app browser, with synthetic content and simulated Chrome APIs. They are not captures of logged-in accounts.

To reproduce, run `npm run test:browser` and open:

- `/test/browser/popups.html?screenshot=light`
- `/test/browser/popups.html?screenshot=native`
- `/test/browser/popups.html?screenshot=paused`
- `/test/browser/popups.html?screenshot=custom`
- `/test/browser/popups.html?screenshot=never`
- `/test/browser/showcase.html?page=news`
- `/test/browser/showcase.html?page=document`

Capture at a 1280px-wide viewport and crop to the popup iframe or comparison section. Only cropping and image encoding are applied; the UI is not retouched. The news page illustrates a community-news layout; the document illustrates Google's transparent text-canvas rendering pattern, not a live Google document. Popup states are simulated, while page comparisons execute the renderer.

The original `nightshade-before.jpg` and `nightshade-after.jpg` pair is retained from the existing README.
