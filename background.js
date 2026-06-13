// Tab RAM Guard — background.js
// Runs every CHECK_INTERVAL ms, checks memory via chrome.processes,
// and takes action (discard / reload / notify) based on user settings.

const CHECK_INTERVAL_MS = 5000;
const DEFAULTS = {
  thresholdMB: 500,
  action: "discard",       // "discard" | "reload" | "warn"
  notifyEnabled: true,
  autoEnabled: true,
  excludePinned: true,
  excludeAudible: true,
};

let settings = { ...DEFAULTS };
let lastNotified = {};     // tabId -> timestamp, throttle notifications
let tabMemHistory = {};    // tabId -> [MB readings] for trend

// ── Boot ────────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  settings = stored;
  scheduleAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  settings = stored;
  scheduleAlarm();
});

// Listen for settings changes from popup
chrome.storage.onChanged.addListener((changes) => {
  for (const [key, { newValue }] of Object.entries(changes)) {
    settings[key] = newValue;
  }
});

// ── Alarm-based polling ──────────────────────────────────────────────────────

function scheduleAlarm() {
  chrome.alarms.clearAll(() => {
    chrome.alarms.create("memCheck", { periodInMinutes: CHECK_INTERVAL_MS / 60000 });
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "memCheck") checkMemory();
});

// Also check immediately when popup opens
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_TAB_MEMORY") {
    getTabMemorySnapshot().then(sendResponse);
    return true; // keep channel open for async
  }
  if (msg.type === "DISCARD_TAB") {
    chrome.tabs.discard(msg.tabId);
    sendResponse({ ok: true });
  }
  if (msg.type === "RELOAD_TAB") {
    chrome.tabs.reload(msg.tabId);
    sendResponse({ ok: true });
  }
  if (msg.type === "DISCARD_OVER_LIMIT") {
    discardOverLimit().then(sendResponse);
    return true;
  }
  if (msg.type === "DISCARD_IDLE") {
    discardIdle().then(sendResponse);
    return true;
  }
});

// ── Core: read memory via chrome.processes ───────────────────────────────────

async function getTabMemorySnapshot() {
  const allTabs = await chrome.tabs.query({});

  // chrome.processes may not be available on all channels (needs flag on some builds)
  let processMap = {};
  if (chrome.processes && chrome.processes.getProcessInfo) {
    try {
      processMap = await new Promise((res) =>
        chrome.processes.getProcessInfo([], true, res)
      );
    } catch (_) {
      processMap = {};
    }
  }

  // Build tabId -> memoryMB map from process data
  const tabMemMB = {};
  for (const proc of Object.values(processMap)) {
    if (proc.type !== "renderer" || !proc.tabs) continue;
    const memMB = Math.round((proc.privateMemory || 0) / (1024 * 1024));
    for (const tabId of proc.tabs) {
      tabMemMB[tabId] = (tabMemMB[tabId] || 0) + memMB;
    }
  }

  // Record history (last 6 readings) for trend arrows
  for (const [tabIdStr, mb] of Object.entries(tabMemMB)) {
    const id = parseInt(tabIdStr);
    if (!tabMemHistory[id]) tabMemHistory[id] = [];
    tabMemHistory[id].push(mb);
    if (tabMemHistory[id].length > 6) tabMemHistory[id].shift();
  }

  const tabData = allTabs.map((tab) => {
    const mem = tabMemMB[tab.id] ?? null;
    const history = tabMemHistory[tab.id] || [];
    let trend = "stable";
    if (history.length >= 3) {
      const recent = history.slice(-3);
      const delta = recent[2] - recent[0];
      if (delta > 40) trend = "rising";
      else if (delta < -40) trend = "falling";
    }
    return {
      id: tab.id,
      title: tab.title || "Untitled",
      url: tab.url || "",
      favIconUrl: tab.favIconUrl || "",
      pinned: tab.pinned,
      audible: tab.audible,
      discarded: tab.discarded,
      active: tab.active,
      memMB: mem,
      trend,
    };
  });

  // Sort: over-limit first, then by memory desc
  tabData.sort((a, b) => {
    const aOver = a.memMB >= settings.thresholdMB ? 1 : 0;
    const bOver = b.memMB >= settings.thresholdMB ? 1 : 0;
    if (aOver !== bOver) return bOver - aOver;
    return (b.memMB || 0) - (a.memMB || 0);
  });

  const totalMB = tabData.reduce((s, t) => s + (t.memMB || 0), 0);
  const overCount = tabData.filter(
    (t) => !t.discarded && t.memMB >= settings.thresholdMB
  ).length;
  const frozenCount = tabData.filter((t) => t.discarded).length;

  return { tabData, totalMB, overCount, frozenCount, settings };
}

// ── Auto-action ──────────────────────────────────────────────────────────────

async function checkMemory() {
  if (!settings.autoEnabled) return;
  const { tabData } = await getTabMemorySnapshot();

  for (const tab of tabData) {
    if (tab.discarded || tab.active) continue;
    if (tab.memMB === null) continue;
    if (settings.excludePinned && tab.pinned) continue;
    if (settings.excludeAudible && tab.audible) continue;
    if (tab.memMB < settings.thresholdMB) continue;

    const action = settings.action;

    if (action === "discard") {
      chrome.tabs.discard(tab.id);
      maybeNotify(tab, "凍結");
    } else if (action === "reload") {
      chrome.tabs.reload(tab.id);
      maybeNotify(tab, "重新載入");
    } else if (action === "warn") {
      maybeNotify(tab, "超出記憶體上限");
    }
  }
}

function maybeNotify(tab, action) {
  if (!settings.notifyEnabled) return;
  const now = Date.now();
  if (lastNotified[tab.id] && now - lastNotified[tab.id] < 60000) return;
  lastNotified[tab.id] = now;

  chrome.notifications.create(`ram-${tab.id}-${now}`, {
    type: "basic",
    iconUrl: "icons/icon48.png",
    title: `Tab RAM Guard — ${action}`,
    message: `${tab.title}\n記憶體用量: ${tab.memMB} MB（上限 ${settings.thresholdMB} MB）`,
    priority: 1,
  });
}

// ── Bulk actions ─────────────────────────────────────────────────────────────

async function discardOverLimit() {
  const { tabData } = await getTabMemorySnapshot();
  let count = 0;
  for (const tab of tabData) {
    if (!tab.discarded && !tab.active && tab.memMB >= settings.thresholdMB) {
      if (settings.excludePinned && tab.pinned) continue;
      if (settings.excludeAudible && tab.audible) continue;
      chrome.tabs.discard(tab.id);
      count++;
    }
  }
  return { count };
}

async function discardIdle() {
  const { tabData } = await getTabMemorySnapshot();
  let count = 0;
  for (const tab of tabData) {
    if (!tab.discarded && !tab.active && !tab.pinned && !tab.audible) {
      chrome.tabs.discard(tab.id);
      count++;
    }
  }
  return { count };
}
