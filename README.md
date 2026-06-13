# 🛡️ Tab RAM Guard

> Auto-freeze idle background tabs in Chrome to save memory. Stop your browser from creeping up to several GB from background ads.

[![GitHub Sponsors](https://img.shields.io/github/sponsors/9shift?style=flat&logo=github&color=8b5cf6)](https://github.com/sponsors/9shift)

---

## How it works

Chrome stable doesn't let extensions read per-tab memory (that needs the Dev channel). So instead of measuring megabytes, Tab RAM Guard tracks how long each background tab has been idle and automatically freezes ones you haven't touched in a while.

Freezing a tab (`chrome.tabs.discard()`) releases its memory while keeping it in your tab bar. Click it and it reloads instantly — like waking from sleep. This is the most effective memory-saving method available to extensions on Chrome stable.

## Features

- Auto-freeze idle tabs — set how long (5 min – 3 hr) before background tabs get frozen
- Per-site rules — set shorter freeze times for memory-heavy sites
- Live tab list — see which tabs are active, idle, or about to be frozen
- Bulk actions — freeze all idle tabs or all background tabs at once
- Smart exclusions — skip pinned tabs and tabs playing audio
- Desktop notifications — get notified when a tab is frozen
- Available in 10 languages, auto-detected from your browser

---

## Install (Load Unpacked)

1. Unzip the extension folder
2. Chrome → `chrome://extensions`
3. Enable Developer mode (top right)
4. Click Load unpacked → select the folder
5. The shield icon appears in your toolbar

---

## Platform support

Works on Chrome for Windows, macOS, and Linux — all platforms supported.

---

## Privacy

No tracking. No ads. No data collection. No external servers. Everything runs locally in your browser. See PRIVACY.md for details.

---

## Support this project

If Tab RAM Guard saved your computer from a Chrome meltdown:

⭐ [GitHub Sponsors](https://github.com/sponsors/9shift) — 0% fee, monthly or one-time

---

MIT License
