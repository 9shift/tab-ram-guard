# 🛡️ Tab RAM Guard

> Auto-freeze idle background tabs in Chrome to save memory. Stop your browser from creeping up to 3 GB from background ads.

[![GitHub Sponsors](https://img.shields.io/github/sponsors/9shift?style=flat&logo=github&color=8b5cf6)](https://github.com/sponsors/9shift)

---

## How it works

Chrome stable doesn't let extensions read per-tab memory (that needs the Dev channel). So instead of measuring megabytes, Tab RAM Guard tracks **how long each background tab has been idle** and automatically freezes ones you haven't touched in a while.

Freezing a tab (`chrome.tabs.discard()`) releases its memory while keeping it in your tab bar. Click it and it reloads instantly — like wake from sleep. This is the most effective memory-saving method available to extensions on Chrome stable.

## Features

- **Auto-freeze idle tabs** — set how long (5 min – 3 hr) before background tabs get frozen
- **Live tab list** — see which tabs are active, idle, or about to be frozen
- **Bulk actions** — freeze all idle tabs or all background tabs at once
- **Smart exclusions** — skip pinned tabs and tabs playing audio
- **Desktop notifications** — get notified when a tab is frozen

---

## Install (Load Unpacked)

1. Unzip `tab-ram-guard.zip`
2. Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `tab-ram-guard` folder
5. 🛡️ icon appears in your toolbar

---

## Platform support

Works on Chrome for Windows, macOS, and Linux — all platforms supported.

---

## Support this project

If Tab RAM Guard saved your computer from a Chrome meltdown:

- ⭐ [GitHub Sponsors](https://github.com/sponsors/9shift) — 0% fee, monthly or one-time

---

MIT License
