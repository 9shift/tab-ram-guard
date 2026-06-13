# Privacy Policy — Tab RAM Guard

_Last updated: 2026-06-13_

## Summary

Tab RAM Guard does **not** collect, store, transmit, or sell any of your personal data. Everything the extension does happens locally inside your own browser.

## What data the extension accesses

To do its job (freezing idle background tabs to save memory), the extension reads the following **locally, in your browser only**:

- **Tab information** — tab titles, URLs, and idle/active state. This is used to decide which tabs to freeze. It is never sent anywhere.
- **Your settings** — your chosen idle time, per-site rules, and language preference. These are stored using Chrome's `storage.sync` so they follow you across your signed-in Chrome browsers. They are stored by Google as part of your own Chrome sync data and are not accessible to the developer.

## What data is sent to the developer or third parties

**None.** The extension makes no network requests. There are no analytics, no tracking, no ads, and no external servers. The developer has no way to see your tabs, settings, or browsing activity.

## Permissions and why they're needed

- `tabs` — to read tab idle/active state and freeze (discard) idle tabs
- `storage` — to save your settings locally
- `notifications` — to optionally notify you when a tab is frozen
- `alarms` — to periodically check for idle tabs in the background

## Contact

Questions about this policy? Open an issue at:
https://github.com/9shift/tab-ram-guard

## Changes

If this policy ever changes, the updated version will be posted in this repository.
