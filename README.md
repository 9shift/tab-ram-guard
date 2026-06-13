# 🛡️ Tab RAM Guard

> Monitor and control per-tab memory in Chrome. Auto-freeze or reload tabs that exceed your RAM limit — no more 3 GB browser creep from background ads.

[![GitHub Sponsors](https://img.shields.io/github/sponsors/9shift?style=flat&logo=github&color=8b5cf6)](https://github.com/sponsors/9shift)

---

## Features

- **Real-time monitoring** — per-tab RAM usage, updated every 5 seconds
- **Auto-action** — freeze (discard) or reload tabs that exceed your limit
- **Memory trend** — see which tabs are growing (↑) or shrinking (↓)
- **Bulk actions** — freeze all over-limit tabs or all idle tabs at once
- **Smart exclusions** — skip pinned tabs and tabs playing audio
- **Desktop notifications** — get alerted when a tab spikes

### How "freeze" works

`chrome.tabs.discard()` releases tab memory while keeping the tab visible. Clicking the tab reloads it automatically — like wake from sleep.

---

## Install (Load Unpacked)

1. Download and unzip `tab-ram-guard.zip`
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `tab-ram-guard` folder
5. 🛡️ icon appears in your toolbar

---

## Set up your donation links

In `popup.js`, uncomment and fill in your IDs:

```js
document.getElementById("githubBtn").href = "https://github.com/sponsors/9shift";
document.getElementById("kofiBtn").href   = "https://ko-fi.com/YOUR_KOFI_ID";
document.getElementById("venmoBtn").href  = "https://venmo.com/YOUR_VENMO_ID";  // US only
document.getElementById("paypalBtn").href = "https://paypal.me/YOUR_PAYPAL_ID";
```

In `.github/FUNDING.yml`, replace `9shift` — this makes the ❤️ Sponsor button appear on your repo page.

---

## Publish to GitHub (step by step)

```bash
# 1. Create a new repo on github.com (name: tab-ram-guard), then:
git init
git add .
git commit -m "initial release: Tab RAM Guard v1.0"
git remote add origin https://github.com/YOUR_USERNAME/tab-ram-guard.git
git push -u origin main
```

Then on GitHub:
- Go to your repo → **Settings** → **Sponsors** → apply for GitHub Sponsors
- Once approved, `.github/FUNDING.yml` activates the ❤️ Sponsor button automatically

---

## File structure

```
tab-ram-guard/
├── .github/
│   └── FUNDING.yml       # Activates GitHub Sponsors button on repo
├── manifest.json         # MV3 extension config
├── background.js         # Service worker: monitor, alarm, message handler
├── popup.html            # Popup UI
├── popup.js              # Popup logic
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## Platform support

| OS | Supported |
|---|---|
| Windows | ✅ Chrome on Windows 10/11 |
| macOS | ✅ Chrome on macOS 12+ |
| Linux | ✅ Chrome on Ubuntu / Debian etc. |

Chrome Extension APIs are cross-platform — works wherever Chrome runs.

---

## Notes

**`chrome.processes` API** — used to read per-tab memory. Available in Chrome stable with the `processes` permission. If your Chrome build doesn't support it, tabs show `—` but can still be manually frozen.

**Why can't we hard-cap memory?** Chrome's sandbox prevents extensions from setting memory limits on other tabs. The best available approach is detect-and-discard, which this extension does automatically.

---

## Support this project

If Tab RAM Guard saved your computer from a 3 GB Chrome meltdown, consider sponsoring:

- ⭐ [GitHub Sponsors](https://github.com/sponsors/9shift) — 0% fee, monthly or one-time
- ☕ [Ko-fi](https://ko-fi.com/YOUR_KOFI_ID) — 0% fee, global
- 💳 [PayPal](https://paypal.me/YOUR_PAYPAL_ID) — worldwide
- 📱 [Venmo](https://venmo.com/YOUR_VENMO_ID) — US only

---

MIT License © 9shift
