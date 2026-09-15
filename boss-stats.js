/** 雅芳（主管）文字統計表＋刪除紀錄. Loads last. */
(function () {
  let statsTab = "orders"; // orders | labels | flow | audit
  let statsRange = "30"; // 7 | 30 | all

  function isBoss() {
    return typeof currentRole === "function" && currentRole() === "boss";
  }

  function ensurePage() {
    let el = document.getElementById("page-stats");
    if (el) return el;
    const app = document.querySelector(".app");
    if (!app) return null;
    el = document.createElement("section");
    el.id = "page-stats";
    el.hidden = true;
    el.innerHTML = `<div id="st-root" class="st-root"></div>`;
    const status = document.getElementById("status");
    if (status) status.before(el);
    else app.appendChild(el);
    return el;
  }

  function dayKey(tsOrYmd) {
    if (!tsOrYmd) return "";
    if (typeof tsOrYmd === "number") {
      const d = new Date(tsOrYmd);
      if (!Number.isFinite(d.getTime())) return "";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    }
    return String(tsOrYmd).slice(0, 10);
  }

  function rangeStart() {
    if (statsRange === "all") return "";
    const n = statsRange === "7" ? 7 : 30;
    const d = new Date();
    d.setDate(d.getDate() - (n - 1));
    return dayKey(d.getTime());
  }

  function inRange(ymd) {
    const start = rangeStart();
    if (!start) return true;
    return String(ymd || "") >= start;
  }

  /** 文字統計表：pairs = [{ label, value }, ...] */
  function statsTable(pairs, colLabel, colValue) {
    const data = (pairs || []).filter((p) => p && p.label != null);
    if (!data.length) return `<p class="st-empty">尚無資料</p>`;
    const rows = data
      .map(
        (p) =>
          `<tr><td>${esc(String(p.label))}</td><td class="st-num">${Number(p.value) || 0}</td></tr>`,
      )
      .join("");
    return `<div class="st-table-wrap"><table class="st-table">
      <thead><tr><th>${esc(colLabel || "項目")}</th><th>${esc(colValue || "數量")}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  function countBy(list, keyFn) {
    const map = new Map();
    for (const item of list) {
      const k = keyFn(item);
      if (!k) continue;
      map.set(k, (map.get(k) || 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([label, value]) => ({ label, value }));
  }

  function orderStats() {
    const orders = (state.orders || []).filter((o) => inRange(o.shipDate || dayKey(o.createdAt || 0)));
    const byStatus = [
      { label: "進行", value: orders.filter((o) => o.status === "open" || o.status === "delivered").length },
      { label: "已送", value: orders.filter((o) => o.status === "shipped").length },
      { label: "取消", value: orders.filter((o) => o.status === "cancelled").length },
      { label: "刪除", value: orders.filter((o) => o.status === "deleted").length },
    ];
    const byDay = countBy(orders, (o) => o.shipDate || dayKey(o.createdAt || 0));
    return { total: orders.length, byStatus, byDay };
  }

  function labelStats() {
    const prints = typeof loadLabelPrints === "function" ? loadLabelPrints() : [];
    const list = prints.filter((p) => inRange(p.day || dayKey(p.at)));
    const byKind = [
      { label: "文字", value: list.filter((p) => p.kind === "text").length },
      { label: "貨櫃", value: list.filter((p) => p.kind === "container").length },
      { label: "出貨", value: list.filter((p) => p.kind === "ship").length },
    ];
    const copies = list.reduce((n, p) => n + (Number(p.copies) || 0), 0);
    const byDay = countBy(list, (p) => p.day || dayKey(p.at));
    return { total: list.length, copies, byKind, byDay };
  }

  function flowStats() {
    const moves = (state.siteMoves || []).filter((m) => inRange(m.day || dayKey(m.at)));
    const works = (state.siteWorks || []).filter((w) => inRange(w.day || dayKey(w.at)));
    const inbound = (state.inboundLedger || []).filter((r) => inRange(r.day || dayKey(r.createdAt || r.at)));
    const unpack = (state.unpackJobs || []).filter((j) => inRange(j.day));
    const moveBy = [
      { label: "進行", value: moves.filter((m) => !m.done).length },
      { label: "完成", value: moves.filter((m) => m.done).length },
    ];
    const inBy = [
      { label: "待確認", value: inbound.filter((r) => r.status === "pending").length },
      { label: "已入庫", value: inbound.filter((r) => r.status === "confirmed").length },
    ];
    const routes = countBy(moves, (m) => `${m.fromWh || "?"}→${m.toWh || "?"}`);
    return {
      moves: moves.length,
      works: works.length,
      inbound: inbound.length,
      unpack: unpack.length,
      moveBy,
      inBy,
      routes,
    };
  }

  function auditRows() {
    const log = Array.isArray(state.auditLog) ? state.auditLog : [];
    return log.filter((a) => inRange(dayKey(a.at))).slice(0, 80);
  }

  function kindName(k) {
    return (
      {
        order: "訂單",
        move: "調倉",
        work: "工作單",
        label: "標籤",
        inbound: "進貨",
        unpack: "拆櫃",
      }[k] || k || "—"
    );
  }

  function timeText(at) {
    const d = new Date(Number(at) || 0);
    if (!Number.isFinite(d.getTime()) || !d.getTime()) return "—";
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${mm}/${dd} ${hh}:${mi}`;
  }

  function auditTable(audits) {
    if (!audits.length) return `<p class="st-empty">尚無刪除紀錄</p>`;
    const rows = audits
      .map(
        (a) => `<tr>
          <td>${esc(kindName(a.kind))}</td>
          <td>${esc(timeText(a.at))}</td>
          <td>${esc(a.by || "—")}</td>
          <td>${esc(a.summary || a.action || "—")}</td>
        </tr>`,
      )
      .join("");
    return `<div class="st-table-wrap"><table class="st-table st-table-audit">
      <thead><tr><th>類型</th><th>時間</th><th>操作人</th><th>說明</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  function renderStats() {
    if (!isBoss()) {
      const root = document.getElementById("st-root");
      if (root) root.innerHTML = `<p class="st-empty">僅主管（雅芳）可看統計。</p>`;
      return;
    }
    ensurePage();
    const root = document.getElementById("st-root");
    if (!root) return;

    const o = orderStats();
    const l = labelStats();
    const f = flowStats();
    const audits = auditRows();

    let body = "";
    if (statsTab === "orders") {
      body = `
        <div class="st-kpis">
          <div class="st-kpi"><strong>${o.total}</strong><span>訂單筆數</span></div>
          <div class="st-kpi"><strong>${o.byStatus.find((x) => x.label === "已送")?.value || 0}</strong><span>已送出</span></div>
          <div class="st-kpi warn"><strong>${o.byStatus.find((x) => x.label === "刪除")?.value || 0}</strong><span>已刪除</span></div>
        </div>
        <h3>狀態</h3>${statsTable(o.byStatus, "狀態", "筆數")}
        <h3>依出貨日</h3>${statsTable(o.byDay, "日期", "筆數")}`;
    } else if (statsTab === "labels") {
      body = `
        <div class="st-kpis">
          <div class="st-kpi"><strong>${l.total}</strong><span>列印批數</span></div>
          <div class="st-kpi"><strong>${l.copies}</strong><span>張數合計</span></div>
        </div>
        <h3>種類</h3>${statsTable(l.byKind, "種類", "批數")}
        <h3>依日期</h3>${statsTable(l.byDay, "日期", "批數")}`;
    } else if (statsTab === "flow") {
      body = `
        <div class="st-kpis">
          <div class="st-kpi"><strong>${f.moves}</strong><span>調倉單</span></div>
          <div class="st-kpi"><strong>${f.works}</strong><span>工作單</span></div>
          <div class="st-kpi"><strong>${f.inbound}</strong><span>進貨登錄</span></div>
          <div class="st-kpi"><strong>${f.unpack}</strong><span>拆櫃單</span></div>
        </div>
        <h3>調倉狀態</h3>${statsTable(f.moveBy, "狀態", "筆數")}
        <h3>進貨狀態</h3>${statsTable(f.inBy, "狀態", "筆數")}
        <h3>調倉路線</h3>${statsTable(f.routes, "路線", "筆數")}`;
    } else {
      body = `
        <h3>刪除／異動紀錄 ${audits.length}</h3>
        <p class="muted">含訂單刪除、調倉／工作單刪除等。僅主管可見。</p>
        ${auditTable(audits)}`;
    }

    root.innerHTML = `
      <header class="st-head">
        <h2>營運統計</h2>
        <p class="muted">雅芳專用：訂單／標籤／進出調撥與刪除紀錄。</p>
      </header>
      <div class="st-range" role="group" aria-label="區間">
        <button type="button" class="pick${statsRange === "7" ? " on" : ""}" data-st-range="7">近7日</button>
        <button type="button" class="pick${statsRange === "30" ? " on" : ""}" data-st-range="30">近30日</button>
        <button type="button" class="pick${statsRange === "all" ? " on" : ""}" data-st-range="all">全部</button>
      </div>
      <nav class="tabs st-tabs">
        <button type="button" class="tab${statsTab === "orders" ? " on" : ""}" data-st-tab="orders">訂單</button>
        <button type="button" class="tab${statsTab === "labels" ? " on" : ""}" data-st-tab="labels">標籤</button>
        <button type="button" class="tab${statsTab === "flow" ? " on" : ""}" data-st-tab="flow">進出調撥</button>
        <button type="button" class="tab${statsTab === "audit" ? " on" : ""}" data-st-tab="audit">刪除紀錄</button>
      </nav>
      <div class="st-body">${body}</div>`;

    document.getElementById("co-name") &&
      (document.getElementById("co-name").textContent = "營運統計");
  }

  function bindOnce() {
    if (document.body.dataset.stBound === "1") return;
    document.body.dataset.stBound = "1";
    document.body.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-st-tab]");
      if (tab) {
        statsTab = tab.getAttribute("data-st-tab") || "orders";
        renderStats();
        return;
      }
      const range = e.target.closest("[data-st-range]");
      if (range) {
        statsRange = range.getAttribute("data-st-range") || "30";
        renderStats();
      }
    });
  }

  window.renderBossStats = function () {
    bindOnce();
    renderStats();
  };
})();
