# Privacy

Nightshade operates locally in the browser and has no developer-operated server, analytics, advertising, or telemetry.

## Data Nightshade uses

- The current page hostname, to apply a user-created site rule.
- Rendered colors and page elements, to detect an existing dark theme and preserve media colors.
- User preferences: global enablement, pause time, dimming, media preservation, and explicit hostname rules.

Page inspection happens in memory inside the current tab. Nightshade does not retain page contents or automatically detected hostnames.

## Storage and transmission

Preferences are stored with `chrome.storage.sync`. Chrome may synchronize them through the signed-in browser account according to Chrome's own settings and privacy policy. Nightshade does not send them to the developer or any other service.

Nightshade does not collect or sell personal information, browsing history, page contents, credentials, or usage analytics.

## Permissions

- **Access to websites:** required to apply the visual filter and inspect rendered colors.
- **Storage:** required to save global and per-site preferences.
- **Active tab:** required to identify and control the website whose popup was opened.

Chrome does not allow extensions to modify browser-internal pages or the Chrome Web Store. Access to local files is disabled unless the user enables it from the extension's settings in Chrome.
