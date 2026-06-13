// popup.js — Tab RAM Guard UI controller

const DEFAULTS = {
  thresholdMB: 500,
  action: "discard",
  notifyEnabled: true,
  autoEnabled: true,
  excludePinned: true,
  excludeAudible: true,
};

// ── State ────────────────────────────────────────────────────────────────────

let settings = { ...DEFAULTS };
let lastSnapshot = null;

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  settings = stored;
  applySettingsToUI();
  bindEvents();
  await refresh();
  setRefreshNote();
});

// ── Navigation ────────────────────────────────────────────────────────────────

function bindEvents() {
  // Panel nav
  document.querySelectorAll(".tab-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-nav-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.panel;
      document.getElementById("panel-monitor").style.display = target === "monitor" ? "block" : "none";
      document.getElementById("panel-settings").classList.toggle("active", target === "settings");
      document.getElementById("panel-donate").classList.toggle("active", target === "donate");
    });
  });

  // Header shortcuts
  document.getElementById("btnRefresh").addEventListener("click", refresh);
  document.getElementById("btnSettings").addEventListener("click", () => switchPanel("settings"));
  document.getElementById("btnDonate").addEventListener("click", () => switchPanel("donate"));

  // Threshold slider
  const slider = document.getElementById("threshSlider");
  slider.value = settings.thresholdMB;
  slider.addEventListener("input", (e) => {
    settings.thresholdMB = parseInt(e.target.value);
    document.getElementById("threshDisplay").textContent = formatMB(settings.thresholdMB);
    saveSettings();
    if (lastSnapshot) renderTabList(lastSnapshot.tabData);
  });

  // Action select
  const actionSelect = document.getElementById("actionSelect");
  actionSelect.value = settings.action;
  actionSelect.addEventListener("change", (e) => {
    settings.action = e.target.value;
    saveSettings();
    updateAutoBanner();
  });

  // Footer buttons
  document.getElementById("btnDiscardAll").addEventListener("click", async () => {
    const btn = document.getElementById("btnDiscardAll");
    btn.textContent = "처理中…";
    const res = await chrome.runtime.sendMessage({ type: "DISCARD_OVER_LIMIT" });
    btn.textContent = `⚡ 已處理 ${res.count} 個`;
    setTimeout(() => { btn.textContent = "⚡ 處理超限"; refresh(); }, 1500);
  });

  document.getElementById("btnDiscardIdle").addEventListener("click", async () => {
    const btn = document.getElementById("btnDiscardIdle");
    btn.textContent = "凍結中…";
    const res = await chrome.runtime.sendMessage({ type: "DISCARD_IDLE" });
    btn.textContent = `❄ 已凍結 ${res.count} 個`;
    setTimeout(() => { btn.textContent = "❄ 凍結閒置"; refresh(); }, 1500);
  });

  // Settings toggles
  bindToggle("settAutoEnabled", "autoEnabled");
  bindToggle("settExcludePinned", "excludePinned");
  bindToggle("settExcludeAudible", "excludeAudible");
  bindToggle("settNotify", "notifyEnabled");

  // 填入你自己的連結（取消註解）：
  document.getElementById("githubBtn").href = "https://github.com/sponsors/9shift";


  // document.getElementById("paypalBtn").href = "https://paypal.me/YOUR_PAYPAL_ID";
}

function bindToggle(elemId, settingKey) {
  const el = document.getElementById(elemId);
  el.checked = settings[settingKey];
  el.addEventListener("change", () => {
    settings[settingKey] = el.checked;
    saveSettings();
    if (settingKey === "autoEnabled") updateAutoBanner();
  });
}

function switchPanel(name) {
  document.querySelectorAll(".tab-nav-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.panel === name);
  });
  document.getElementById("panel-monitor").style.display = name === "monitor" ? "block" : "none";
  document.getElementById("panel-settings").classList.toggle("active", name === "settings");
  document.getElementById("panel-donate").classList.toggle("active", name === "donate");
}

// ── Data ─────────────────────────────────────────────────────────────────────

async function refresh() {
  try {
    const snapshot = await chrome.runtime.sendMessage({ type: "GET_TAB_MEMORY" });
    lastSnapshot = snapshot;
    renderStats(snapshot);
    renderTabList(snapshot.tabData);
    updateAutoBanner();
  } catch (e) {
    document.getElementById("tabList").innerHTML =
      `<div class="empty">無法讀取分頁資料。<br>請確認 Extension 已正確載入。</div>`;
  }
}

function setRefreshNote() {
  const el = document.getElementById("refreshNote");
  el.textContent = "每 5 秒自動更新";
  setInterval(refresh, 5000);
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderStats({ totalMB, overCount, frozenCount }) {
  const totalEl = document.getElementById("statTotal");
  const gb = totalMB / 1024;
  totalEl.textContent = gb >= 1 ? gb.toFixed(1) + " GB" : totalMB + " MB";
  totalEl.className = "stat-value " + (totalMB > 2048 ? "danger" : totalMB > 1024 ? "warn" : "ok");

  document.getElementById("statOver").textContent = overCount;
  document.getElementById("statOver").className = "stat-value " + (overCount > 0 ? "danger" : "ok");
  document.getElementById("statFrozen").textContent = frozenCount;
}

function renderTabList(tabData) {
  const list = document.getElementById("tabList");
  if (!tabData || tabData.length === 0) {
    list.innerHTML = `<div class="empty">沒有開啟的分頁</div>`;
    return;
  }

  list.innerHTML = tabData.map((tab) => {
    const mem = tab.memMB;
    const cls = tab.discarded ? "frozen"
      : mem === null ? "ok"
      : mem >= settings.thresholdMB ? "danger"
      : mem >= settings.thresholdMB * 0.75 ? "warn"
      : "ok";
    const rowCls = cls === "danger" ? "is-danger" : cls === "warn" ? "is-warn" : tab.discarded ? "is-frozen" : "";
    const barPct = mem !== null ? Math.min(100, Math.round((mem / settings.thresholdMB) * 100)) : 0;

    const memDisplay = tab.discarded
      ? `<span class="mem-text frozen">凍結中</span>`
      : mem !== null
        ? `<span class="mem-text ${cls}">${mem} MB</span>`
        : `<span class="mem-text ok">—</span>`;

    const trend = tab.trend === "rising" ? `<span class="trend" style="color:#f5a623" title="記憶體上升">↑</span>`
      : tab.trend === "falling" ? `<span class="trend" style="color:#4caf7d" title="記憶體下降">↓</span>`
      : `<span class="trend"></span>`;

    const pills = [
      tab.pinned ? `<span class="pill pill-pinned">📌</span>` : "",
      tab.audible ? `<span class="pill pill-audible">🔊</span>` : "",
      tab.discarded ? `<span class="pill pill-frozen">凍結</span>` : "",
    ].join("");

    const faviconHtml = tab.favIconUrl
      ? `<img class="favicon" src="${escHtml(tab.favIconUrl)}" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`
        + `<div class="favicon-fallback" style="display:none">${getDomainInitial(tab.url)}</div>`
      : `<div class="favicon-fallback">${getDomainInitial(tab.url)}</div>`;

    return `
      <div class="tab-row ${rowCls}" data-id="${tab.id}">
        ${faviconHtml}
        <div class="tab-info">
          <div class="tab-title" title="${escHtml(tab.title)}">${escHtml(tab.title)}</div>
          <div class="tab-meta">
            <span class="tab-url">${getDomain(tab.url)}</span>
            ${pills}
          </div>
        </div>
        ${trend}
        <div class="mem-section">
          <div class="mem-bar-wrap">
            <div class="mem-bar ${cls}" style="width:${barPct}%"></div>
          </div>
          ${memDisplay}
        </div>
        <div class="row-actions">
          ${!tab.discarded
            ? `<button class="row-btn red" data-action="discard" data-id="${tab.id}" title="凍結此分頁">❄</button>`
            : `<button class="row-btn" data-action="reload" data-id="${tab.id}" title="重新載入（解除凍結）">↻</button>`
          }
        </div>
      </div>`;
  }).join("");

  // Bind row-level actions
  list.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = parseInt(btn.dataset.id);
      const action = btn.dataset.action;
      if (action === "discard") {
        await chrome.runtime.sendMessage({ type: "DISCARD_TAB", tabId: id });
      } else if (action === "reload") {
        await chrome.runtime.sendMessage({ type: "RELOAD_TAB", tabId: id });
      }
      setTimeout(refresh, 600);
    });
  });
}

function updateAutoBanner() {
  const banner = document.getElementById("autoBanner");
  const label = document.getElementById("autoActionLabel");
  const actionMap = { discard: "凍結", reload: "重新載入", warn: "通知" };
  if (settings.autoEnabled) {
    banner.className = "auto-banner";
    label.textContent = actionMap[settings.action] || "處理";
  } else {
    banner.className = "auto-banner off";
    banner.textContent = "🔴 自動監控已關閉";
  }
}

// ── Persist ───────────────────────────────────────────────────────────────────

function applySettingsToUI() {
  const slider = document.getElementById("threshSlider");
  if (slider) {
    slider.value = settings.thresholdMB;
    document.getElementById("threshDisplay").textContent = formatMB(settings.thresholdMB);
  }
  const actionSel = document.getElementById("actionSelect");
  if (actionSel) actionSel.value = settings.action;
}

function saveSettings() {
  chrome.storage.sync.set(settings);
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function formatMB(mb) {
  if (mb >= 1024) return (mb / 1024).toFixed(1) + " GB";
  return mb + " MB";
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function getDomainInitial(url) {
  try { return new URL(url).hostname.replace(/^www\./, "")[0]?.toUpperCase() || "?"; } catch { return "?"; }
}

function escHtml(str) {
  return (str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
