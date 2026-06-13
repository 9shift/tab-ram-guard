// Tab RAM Guard — background.js (v2: idle-based, no chrome.processes)
// Tracks how long each tab has been inactive in the background.
// Auto-discards tabs idle longer than the user's threshold to free memory.

const CHECK_INTERVAL_MIN = 1; // check every 1 minute
const DEFAULTS = {
  idleMinutes: 30,        // default freeze time for background tabs
  action: "discard",      // "discard" | "reload" | "warn"
  notifyEnabled: true,
  autoEnabled: true,
  excludePinned: true,
  excludeAudible: true,
  siteRules: [],          // [{ domain: "youtube.com", minutes: 10 }, ...]
};

let settings = { ...DEFAULTS };
let lastActive = {};      // tabId -> timestamp of last time it was active
let lastNotified = {};    // tabId -> timestamp, throttle notifications

// Return the idle-minutes threshold that applies to a given URL.
// Site rules override the default; longest matching domain wins.
function thresholdFor(url) {
  if (!settings.siteRules || !settings.siteRules.length) return settings.idleMinutes;
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { return settings.idleMinutes; }
  let best = null;
  for (const rule of settings.siteRules) {
    const d = rule.domain.replace(/^www\./, "").toLowerCase();
    if (host === d || host.endsWith("." + d)) {
      if (!best || d.length > best.domain.length) best = rule;
    }
  }
  return best ? best.minutes : settings.idleMinutes;
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function loadSettings() {
  settings = await chrome.storage.sync.get(DEFAULTS);
}

chrome.runtime.onInstalled.addListener(async () => {
  await loadSettings();
  await seedActiveTimes();
  scheduleAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  await loadSettings();
  await seedActiveTimes();
  scheduleAlarm();
});

chrome.storage.onChanged.addListener((changes) => {
  for (const [key, { newValue }] of Object.entries(changes)) {
    settings[key] = newValue;
  }
});

// Mark all existing tabs as "just active" on boot so we don't freeze instantly
async function seedActiveTimes() {
  const tabs = await chrome.tabs.query({});
  const now = Date.now();
  for (const t of tabs) lastActive[t.id] = now;
}

// ── Track activity ──────────────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(({ tabId }) => {
  lastActive[tabId] = Date.now();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // Any user-driven update (navigation, audio start) counts as activity
  if (changeInfo.status === "loading" || changeInfo.audible) {
    lastActive[tabId] = Date.now();
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  lastActive[tab.id] = Date.now();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete lastActive[tabId];
  delete lastNotified[tabId];
});

// When the window regains focus, treat the active tab as just-used
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const [active] = await chrome.tabs.query({ active: true, windowId });
  if (active) lastActive[active.id] = Date.now();
});

// ── Alarm polling ──────────────────────────────────────────────────────────────

function scheduleAlarm() {
  chrome.alarms.clearAll(() => {
    chrome.alarms.create("idleCheck", { periodInMinutes: CHECK_INTERVAL_MIN });
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "idleCheck") checkIdle();
});

// ── Messages from popup ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_TABS") {
    getTabsSnapshot().then(sendResponse);
    return true;
  }
  if (msg.type === "DISCARD_TAB") {
    chrome.tabs.discard(msg.tabId).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "RELOAD_TAB") {
    chrome.tabs.reload(msg.tabId).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "DISCARD_IDLE_NOW") {
    discardIdleNow().then(sendResponse);
    return true;
  }
  if (msg.type === "DISCARD_ALL_BG") {
    discardAllBackground().then(sendResponse);
    return true;
  }
});

// ── Snapshot for the popup ───────────────────────────────────────────────────────

async function getTabsSnapshot() {
  const tabs = await chrome.tabs.query({});
  const now = Date.now();

  const tabData = tabs.map((tab) => {
    const seenAt = lastActive[tab.id] || now;
    const idleMs = tab.active ? 0 : now - seenAt;
    const idleMin = Math.round(idleMs / 60000);
    return {
      id: tab.id,
      title: tab.title || "Untitled",
      url: tab.url || "",
      favIconUrl: tab.favIconUrl || "",
      pinned: tab.pinned,
      audible: tab.audible,
      discarded: tab.discarded,
      active: tab.active,
      idleMin,
      threshold: thresholdFor(tab.url || ""),
      willFreeze: !tab.active && !tab.discarded && idleMin >= thresholdFor(tab.url || "")
        && !(settings.excludePinned && tab.pinned)
        && !(settings.excludeAudible && tab.audible),
    };
  });

  // Sort: about-to-freeze first, then most idle
  tabData.sort((a, b) => {
    if (a.discarded !== b.discarded) return a.discarded ? 1 : -1;
    return b.idleMin - a.idleMin;
  });

  const frozenCount = tabData.filter((t) => t.discarded).length;
  const activeTabCount = tabData.filter((t) => !t.discarded).length;
  const idleCount = tabData.filter((t) => !t.discarded && !t.active && t.idleMin >= t.threshold).length;

  return { tabData, frozenCount, activeTabCount, idleCount, settings };
}

// ── Auto-freeze idle tabs ─────────────────────────────────────────────────────────

async function checkIdle() {
  if (!settings.autoEnabled) return;
  const tabs = await chrome.tabs.query({});
  const now = Date.now();

  for (const tab of tabs) {
    if (tab.active || tab.discarded) continue;
    if (settings.excludePinned && tab.pinned) continue;
    if (settings.excludeAudible && tab.audible) continue;

    const seenAt = lastActive[tab.id] || now;
    const idleMin = (now - seenAt) / 60000;
    if (idleMin < thresholdFor(tab.url || "")) continue;

    if (settings.action === "discard") {
      chrome.tabs.discard(tab.id);
      maybeNotify(tab, "已凍結", idleMin);
    } else if (settings.action === "reload") {
      chrome.tabs.reload(tab.id);
      lastActive[tab.id] = now;
      maybeNotify(tab, "已重新載入", idleMin);
    } else if (settings.action === "warn") {
      maybeNotify(tab, "閒置過久", idleMin);
    }
  }
}

function maybeNotify(tab, action, idleMin) {
  if (!settings.notifyEnabled) return;
  const now = Date.now();
  if (lastNotified[tab.id] && now - lastNotified[tab.id] < 120000) return;
  lastNotified[tab.id] = now;

  chrome.notifications.create(`idle-${tab.id}-${now}`, {
    type: "basic",
    iconUrl: "icons/icon48.png",
    title: `Tab RAM Guard — ${action}`,
    message: `${tab.title}\n背景閒置 ${Math.round(idleMin)} 分鐘`,
    priority: 0,
  });
}

// ── Bulk actions ────────────────────────────────────────────────────────────────

async function discardIdleNow() {
  const tabs = await chrome.tabs.query({});
  const now = Date.now();
  let count = 0;
  for (const tab of tabs) {
    if (tab.active || tab.discarded) continue;
    if (settings.excludePinned && tab.pinned) continue;
    if (settings.excludeAudible && tab.audible) continue;
    const idleMin = (now - (lastActive[tab.id] || now)) / 60000;
    if (idleMin >= thresholdFor(tab.url || "")) {
      chrome.tabs.discard(tab.id);
      count++;
    }
  }
  return { count };
}

async function discardAllBackground() {
  const tabs = await chrome.tabs.query({});
  let count = 0;
  for (const tab of tabs) {
    if (tab.active || tab.discarded) continue;
    if (settings.excludePinned && tab.pinned) continue;
    if (settings.excludeAudible && tab.audible) continue;
    chrome.tabs.discard(tab.id);
    count++;
  }
  return { count };
}
