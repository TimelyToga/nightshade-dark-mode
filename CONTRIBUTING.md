# Contributing

Bug reports and focused pull requests are welcome.

## Reporting rendering problems

Include:

- The public URL, if the problem is visible without signing in.
- What Nightshade did and what you expected.
- The effective state shown in the popup.
- Browser and operating-system versions.
- A redacted screenshot when useful.

Do not attach saved authenticated webpages, credentials, cookies, account exports, private URLs, or unredacted personal information. If the problem requires private content, create the smallest synthetic HTML/SVG example that reproduces the rendering mechanism.

## Development

Nightshade uses plain JavaScript and has no package dependencies.

```sh
npm test
npm run build
```

To inspect the browser fixtures:

```sh
npm run test:browser
```

Open `http://127.0.0.1:8769` in an isolated browser. The page runs assertions against the shipping scripts and CSS and displays each synthetic case.

## Regression fixtures

Every rendering fix should add the smallest synthetic fixture that fails before the change and passes after it. Prefer a mechanism name with the motivating site as context. Keep fixtures independent of third-party accounts and copyrighted page exports.

The current library covers native-dark detection, delayed app shells, transparent layouts, site overrides, pauses, media preservation, dynamic SVG icons, transparent logos, and mixed-color wordmarks.

## Pull requests

- Keep changes narrowly scoped.
- Run `npm test` and `npm run build`.
- Do not commit `dist/`, dependencies, browser profiles, saved webpages, or account data.
- Update README or privacy documentation when behavior or permissions change.
