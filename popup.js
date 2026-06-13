// popup.js — Tab RAM Guard v2 (idle-based)

const DEFAULTS = {
  idleMinutes: 30,
  action: "discard",
  notifyEnabled: true,
  autoEnabled: true,
  excludePinned: true,
  excludeAudible: true,
};

let settings = { ...DEFAULTS };
let lastSnapshot = null;

document.addEventListener("DOMContentLoaded", async () => {
  settings = await chrome.storage.sync.get(DEFAULTS);
  applySettingsToUI();
  bindEvents();
  await refresh();
  setInterval(refresh, 5000);

  // Fill in your own donation links here:
  document.getElementById("githubBtn").href = "https://github.com/sponsors/9shift";
  // document.getElementById("paypalBtn").href = "https://paypal.me/YOUR_PAYPAL_ID";
});

function bindEvents() {
  document.querySelectorAll(".tab-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchPanel(btn.dataset.panel));
  });
  document.getElementById("btnRefresh").addEventListener("click", refresh);
  document.getElementById("btnSettings").addEventListener("click", () => switchPanel("settings"));
  document.getElementById("btnDonate").addEventListener("click", () => switchPanel("donate"));

  const slider = document.getElementById("idleSlider");
  slider.value = settings.idleMinutes;
  slider.addEventListener("input", (e) => {
    settings.idleMinutes = parseInt(e.target.value);
    document.getElementById("idleDisplay").textContent = formatMin(settings.idleMinutes);
    saveSettings();
    if (lastSnapshot) refresh();
  });

  const actionSelect = document.getElementById("actionSelect");
  actionSelect.value = settings.action;
  actionSelect.addEventListener("change", (e) => {
    settings.action = e.target.value;
    saveSettings();
    updateAutoBanner();
  });

  document.getElementById("btnDiscardAll").addEventListener("click", async () => {
    const btn = document.getElementById("btnDiscardAll");
    btn.textContent = "凍結中…";
    const res = await chrome.runtime.sendMessage({ type: "DISCARD_ALL_BG" });
    btn.textContent = `⚡ 已凍結 ${res.count} 個`;
    setTimeout(() => { btn.textContent = "⚡ 凍結全部背景"; refresh(); }, 1500);
  });

  document.getElementById("btnDiscardIdle").addEventListener("click", async () => {
    const btn = document.getElementById("btnDiscardIdle");
    btn.textContent = "凍結中…";
    const res = await chrome.runtime.sendMessage({ type: "DISCARD_IDLE_NOW" });
    btn.textContent = `❄ 已凍結 ${res.count} 個`;
    setTimeout(() => { btn.textContent = "❄ 凍結閒置"; refresh(); }, 1500);
  });

  bindToggle("settAutoEnabled", "autoEnabled");
  bindToggle("settExcludePinned", "excludePinned");
  bindToggle("settExcludeAudible", "excludeAudible");
  bindToggle("settNotify", "notifyEnabled");
}

function bindToggle(elemId, key) {
  const el = document.getElementById(elemId);
  el.checked = settings[key];
  el.addEventListener("change", () => {
    settings[key] = el.checked;
    saveSettings();
    if (key === "autoEnabled") updateAutoBanner();
  });
}

function switchPanel(name) {
  document.querySelectorAll(".tab-nav-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.panel === name));
  document.getElementById("panel-monitor").style.display = name === "monitor" ? "block" : "none";
  document.getElementById("panel-settings").classList.toggle("active", name === "settings");
  document.getElementById("panel-donate").classList.toggle("active", name === "donate");
}

async function refresh() {
  try {
    const snap = await chrome.runtime.sendMessage({ type: "GET_TABS" });
    lastSnapshot = snap;
    renderStats(snap);
    renderTabList(snap.tabData);
    updateAutoBanner();
  } catch (e) {
    document.getElementById("tabList").innerHTML =
      `<div class="empty">無法讀取分頁資料</div>`;
  }
}

function renderStats({ activeTabCount, idleCount, frozenCount }) {
  document.getElementById("statTotal").textContent = activeTabCount;
  document.getElementById("statTotal").className = "stat-value ok";
  document.getElementById("statOver").textContent = idleCount;
  document.getElementById("statOver").className = "stat-value " + (idleCount > 0 ? "warn" : "ok");
  document.getElementById("statFrozen").textContent = frozenCount;
}

function renderTabList(tabData) {
  const list = document.getElementById("tabList");
  if (!tabData || tabData.length === 0) {
    list.innerHTML = `<div class="empty">沒有開啟的分頁</div>`;
    return;
  }

  list.innerHTML = tabData.map((tab) => {
    const state = tab.discarded ? "frozen"
      : tab.active ? "active"
      : tab.willFreeze ? "danger"
      : tab.idleMin >= settings.idleMinutes * 0.6 ? "warn"
      : "ok";
    const rowCls = state === "danger" ? "is-danger" : state === "warn" ? "is-warn" : tab.discarded ? "is-frozen" : "";

    const statusText = tab.discarded ? "凍結中"
      : tab.active ? "使用中"
      : tab.willFreeze ? "即將凍結"
      : `閒置 ${formatMin(tab.idleMin)}`;
    const statusCls = tab.discarded ? "frozen"
      : tab.active ? "ok"
      : tab.willFreeze ? "danger"
      : state === "warn" ? "warn" : "ok";

    const pills = [
      tab.pinned ? `<span class="pill pill-pinned">📌</span>` : "",
      tab.audible ? `<span class="pill pill-audible">🔊</span>` : "",
    ].join("");

    const faviconHtml = tab.favIconUrl
      ? `<img class="favicon" src="${escHtml(tab.favIconUrl)}" onerror="this.style.display='none';this.nextSibling.style.display='flex'"><div class="favicon-fallback" style="display:none">${getDomainInitial(tab.url)}</div>`
      : `<div class="favicon-fallback">${getDomainInitial(tab.url)}</div>`;

    return `
      <div class="tab-row ${rowCls}">
        ${faviconHtml}
        <div class="tab-info">
          <div class="tab-title" title="${escHtml(tab.title)}">${escHtml(tab.title)}</div>
          <div class="tab-meta">
            <span class="tab-url">${getDomain(tab.url)}</span>
            ${pills}
          </div>
        </div>
        <span class="mem-text ${statusCls}">${statusText}</span>
        <div class="row-actions">
          ${!tab.discarded
            ? `<button class="row-btn red" data-action="discard" data-id="${tab.id}" title="立即凍結">❄</button>`
            : `<button class="row-btn" data-action="reload" data-id="${tab.id}" title="解除凍結">↻</button>`}
        </div>
      </div>`;
  }).join("");

  list.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = parseInt(btn.dataset.id);
      const type = btn.dataset.action === "discard" ? "DISCARD_TAB" : "RELOAD_TAB";
      await chrome.runtime.sendMessage({ type, tabId: id });
      setTimeout(refresh, 600);
    });
  });
}

function updateAutoBanner() {
  const banner = document.getElementById("autoBanner");
  const label = document.getElementById("autoActionLabel");
  const map = { discard: "凍結", reload: "重新載入", warn: "通知" };
  if (settings.autoEnabled) {
    banner.className = "auto-banner";
    label.textContent = map[settings.action] || "處理";
  } else {
    banner.className = "auto-banner off";
    banner.textContent = "🔴 自動監控已關閉";
  }
}

function applySettingsToUI() {
  const slider = document.getElementById("idleSlider");
  if (slider) {
    slider.value = settings.idleMinutes;
    document.getElementById("idleDisplay").textContent = formatMin(settings.idleMinutes);
  }
  const sel = document.getElementById("actionSelect");
  if (sel) sel.value = settings.action;
}

function saveSettings() { chrome.storage.sync.set(settings); }

function formatMin(min) {
  if (min >= 60) {
    const h = Math.floor(min / 60), m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h} 小時`;
  }
  return `${min} 分鐘`;
}
function getDomain(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } }
function getDomainInitial(url) { try { return new URL(url).hostname.replace(/^www\./, "")[0]?.toUpperCase() || "?"; } catch { return "?"; } }
function escHtml(s) { return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
