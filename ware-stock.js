/** Warehouse stock-count UI (選倉庫 → 新增品項／盤點 → 差異). Loads after app.js. */
(function () {
  const WAREHOUSES = [
    { id: "A", label: "A倉" },
    { id: "B", label: "B倉" },
    { id: "Y", label: "油" },
    { id: "K", label: "烘庫" },
  ];

  if (typeof STOCK_WAREHOUSES !== "undefined") {
    STOCK_WAREHOUSES.length = 0;
    WAREHOUSES.forEach((w) => STOCK_WAREHOUSES.push({ id: w.id, label: w.label }));
  }

  function whLabel(id) {
    const hit = WAREHOUSES.find((w) => w.id === id);
    if (hit) return hit.label;
    if (typeof stockWarehouseLabel === "function") return stockWarehouseLabel(id);
    return id || "";
  }

  function ensureRoot() {
    if (!state.stockCount || typeof state.stockCount !== "object") state.stockCount = {};
    return state.stockCount;
  }

  function ensureCatalog() {
    if (!state.wareItems || typeof state.wareItems !== "object") state.wareItems = {};
    return state.wareItems;
  }

  function catalogOf(wh) {
    const root = ensureCatalog();
    if (!Array.isArray(root[wh])) root[wh] = [];
    return root[wh];
  }

  function dayBucket(date) {
    const root = ensureRoot();
    if (!root[date] || typeof root[date] !== "object") root[date] = {};
    return root[date];
  }

  function whBucket(date, wh) {
    const day = dayBucket(date);
    if (!day[wh] || typeof day[wh] !== "object") {
      day[wh] = { qty: {}, notes: {}, confirmed: false, by: "", at: 0 };
    }
    if (!day[wh].qty || typeof day[wh].qty !== "object") day[wh].qty = {};
    if (!day[wh].notes || typeof day[wh].notes !== "object") day[wh].notes = {};
    return day[wh];
  }

  function newItemId() {
    return `wi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function prevConfirmedQty(wh, itemId, beforeDate) {
    const root = ensureRoot();
    const days = Object.keys(root)
      .filter((d) => d < beforeDate)
      .sort()
      .reverse();
    for (const d of days) {
      const b = root[d]?.[wh];
      if (!b?.confirmed) continue;
      const v = b.qty?.[itemId];
      if (v !== "" && v != null && Number.isFinite(Number(v))) return round(Number(v));
    }
    return 0;
  }

  function isConfirmed(date, wh) {
    return !!(wh && whBucket(date, wh).confirmed);
  }

  function filledCount(date, wh) {
    const items = catalogOf(wh);
    const qty = whBucket(date, wh).qty || {};
    let n = 0;
    for (const it of items) {
      const v = qty[it.id];
      if (v !== "" && v != null && Number.isFinite(Number(v))) n += 1;
    }
    return { filled: n, total: items.length };
  }

  function ensurePageShell() {
    const page = document.getElementById("page-stock");
    if (!page) return null;
    if (page.dataset.wareShell === "3") return page;
    page.dataset.wareShell = "3";
    page.innerHTML = `
      <div id="wh-pick" class="wh-pick" hidden>
        <header class="wh-pick-head">
          <h2>選倉庫</h2>
          <label class="date-inline">日期 <input id="stock-date" type="date" /></label>
        </header>
        <div class="wh-all" id="wh-all"></div>
      </div>
      <div id="wh-count" class="wh-count" hidden>
        <header class="wh-count-bar" id="wh-count-bar"></header>
        <section class="wh-add" id="wh-add"></section>
        <div class="wh-count-list" id="wh-count-list"></div>
        <footer class="wh-count-foot">
          <button type="button" class="ghost" id="wh-draft-btn">暫存</button>
          <button type="button" class="primary" id="wh-confirm-btn">確認盤點</button>
        </footer>
      </div>
      <div id="wh-diff" class="wh-diff" hidden>
        <header class="wh-diff-head">
          <h2 id="wh-diff-title">盤點結果</h2>
          <button type="button" class="ghost" id="wh-diff-back">回倉庫列表</button>
        </header>
        <div id="wh-diff-body"></div>
      </div>
      <div id="wh-legacy" hidden>
        <div id="stock-overview" class="stock-overview"></div>
        <nav class="tabs stock-kind-tabs" id="stock-kind-tabs" hidden></nav>
        <section id="count-card" hidden>
          <div id="stock-count"></div>
          <button type="button" id="fill-count" hidden></button>
          <button type="button" id="fix-morning" hidden></button>
        </section>
        <form id="process" hidden>
          <select id="pr-sku"></select>
          <input id="pr-qty" type="number" />
        </form>
        <p id="guide-stock" hidden></p>
        <p id="guide-count" hidden></p>
        <h2 id="stock-title" hidden>庫存盤點</h2>
      </div>`;
    return page;
  }

  function bindShellOnce() {
    const page = ensurePageShell();
    if (!page || page.dataset.wareBound === "2") return;
    page.dataset.wareBound = "2";
    page.addEventListener("click", (e) => {
      const pick = e.target.closest("[data-wh-pick]");
      if (pick) {
        stockWh = pick.getAttribute("data-wh-pick") || "";
        const date = typeof stockViewDay === "function" ? stockViewDay() : today();
        stockPhase = isConfirmed(date, stockWh) ? "diff" : "count";
        renderWareStock();
        return;
      }
      if (e.target.closest("#wh-draft-btn")) {
        saveDraft(false);
        return;
      }
      if (e.target.closest("#wh-confirm-btn")) {
        confirmCount();
        return;
      }
      if (e.target.closest("#wh-add-btn")) {
        addWareItem();
        return;
      }
      if (e.target.closest("[data-wh-del]")) {
        const id = e.target.closest("[data-wh-del]").getAttribute("data-wh-del");
        removeWareItem(id);
        return;
      }
      if (e.target.closest("#wh-diff-back") || e.target.closest("[data-wh-repick]")) {
        stockWh = "";
        stockPhase = "pick";
        renderWareStock();
        return;
      }
      if (e.target.closest("[data-wh-recount]")) {
        const date = stockViewDay();
        const b = whBucket(date, stockWh);
        b.confirmed = false;
        save();
        stockPhase = "count";
        renderWareStock();
      }
    });
    page.addEventListener("input", (e) => {
      if (!stockWh) return;
      const date = stockViewDay();
      const b = whBucket(date, stockWh);
      const qtyInp = e.target.closest("[data-wh-qty]");
      if (qtyInp) {
        const id = qtyInp.getAttribute("data-wh-qty");
        const raw = qtyInp.value;
        if (raw === "") delete b.qty[id];
        else {
          const n = Number(raw);
          if (Number.isFinite(n) && n >= 0) b.qty[id] = round(n);
          else delete b.qty[id];
        }
        const row = qtyInp.closest(".wh-row");
        if (row) paintRowState(row, id, b.qty[id], date);
        updateCountBar();
        return;
      }
      const noteInp = e.target.closest("[data-wh-note]");
      if (noteInp) {
        const id = noteInp.getAttribute("data-wh-note");
        const raw = String(noteInp.value || "").trim();
        if (!raw) delete b.notes[id];
        else b.notes[id] = raw;
      }
    });
  }

  function paintRowState(row, itemId, val, date) {
    const sys = prevConfirmedQty(stockWh, itemId, date || stockViewDay());
    const filled = val !== "" && val != null && Number.isFinite(Number(val));
    row.classList.toggle("is-filled", filled);
    row.classList.toggle("is-var", filled && round(Number(val) - sys) !== 0);
  }

  function updateCountBar() {
    const bar = document.getElementById("wh-count-bar");
    if (!bar || !stockWh) return;
    const date = stockViewDay();
    const { filled, total } = filledCount(date, stockWh);
    const done = isConfirmed(date, stockWh);
    bar.innerHTML = `<button type="button" class="ghost wh-back" data-wh-repick>倉庫</button>
      <div class="wh-count-meta">
        <strong>${esc(whLabel(stockWh))}</strong>
        <span>今日盤點</span>
        <span>已填 ${filled}／${total}${done ? " · 已盤" : ""}</span>
      </div>`;
  }

  function renderAddForm(locked) {
    const box = document.getElementById("wh-add");
    if (!box) return;
    if (locked) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    box.innerHTML = `
      <h3>新增品項進本倉</h3>
      <div class="wh-add-grid">
        <label>編號
          <input id="wh-new-code" type="text" autocomplete="off" placeholder="例：A-01" />
        </label>
        <label>品項
          <input id="wh-new-name" type="text" autocomplete="off" placeholder="品名" />
        </label>
        <label>件數
          <input id="wh-new-qty" type="number" min="0" step="1" inputmode="decimal" placeholder="0" />
        </label>
        <label class="wh-add-note">備註
          <input id="wh-new-note" type="text" autocomplete="off" placeholder="選填" />
        </label>
      </div>
      <button type="button" class="primary wh-add-submit" id="wh-add-btn">加入本倉</button>`;
  }

  function addWareItem() {
    if (!stockWh) return;
    if (isConfirmed(stockViewDay(), stockWh)) {
      if (typeof setStatus === "function") setStatus("本倉今日已確認盤點，請先「再盤一次」再新增。", true);
      return;
    }
    const codeEl = document.getElementById("wh-new-code");
    const nameEl = document.getElementById("wh-new-name");
    const qtyEl = document.getElementById("wh-new-qty");
    const noteEl = document.getElementById("wh-new-note");
    const code = String(codeEl?.value || "").trim();
    const name = String(nameEl?.value || "").trim();
    const note = String(noteEl?.value || "").trim();
    const qtyRaw = qtyEl?.value;
    if (!code) {
      if (typeof setStatus === "function") setStatus("請填編號。", true);
      codeEl?.focus();
      return;
    }
    if (!name) {
      if (typeof setStatus === "function") setStatus("請填品項。", true);
      nameEl?.focus();
      return;
    }
    const cat = catalogOf(stockWh);
    if (cat.some((it) => String(it.code || "").toLowerCase() === code.toLowerCase())) {
      if (typeof setStatus === "function") setStatus(`編號「${code}」已在本倉。`, true);
      return;
    }
    let qty = null;
    if (qtyRaw !== "" && qtyRaw != null) {
      const n = Number(qtyRaw);
      if (!Number.isFinite(n) || n < 0) {
        if (typeof setStatus === "function") setStatus("件數請填 0 以上數字。", true);
        return;
      }
      qty = round(n);
    }
    const id = newItemId();
    cat.push({ id, code, name });
    const date = stockViewDay();
    const b = whBucket(date, stockWh);
    if (qty != null) b.qty[id] = qty;
    if (note) b.notes[id] = note;
    b.at = Date.now();
    b.by = typeof currentStaff === "function" ? currentStaff() || "" : "";
    save();
    if (typeof setStatus === "function") setStatus(`已加入「${code} ${name}」。`, false);
    renderCount();
    document.getElementById("wh-new-code")?.focus();
  }

  function removeWareItem(id) {
    if (!stockWh || !id) return;
    if (isConfirmed(stockViewDay(), stockWh)) return;
    const cat = catalogOf(stockWh);
    const hit = cat.find((it) => it.id === id);
    if (!hit) return;
    if (!confirm(`從本倉移除「${hit.code} ${hit.name}」？`)) return;
    const ix = cat.findIndex((it) => it.id === id);
    if (ix >= 0) cat.splice(ix, 1);
    const date = stockViewDay();
    const b = whBucket(date, stockWh);
    delete b.qty[id];
    delete b.notes[id];
    save();
    renderCount();
  }

  function renderPick() {
    const pick = document.getElementById("wh-pick");
    const count = document.getElementById("wh-count");
    const diff = document.getElementById("wh-diff");
    if (pick) pick.hidden = false;
    if (count) count.hidden = true;
    if (diff) diff.hidden = true;
    const date = stockViewDay();
    const dateEl = document.getElementById("stock-date");
    if (dateEl && dateEl.value !== date) dateEl.value = date;
    if (dateEl && !dateEl.dataset.wareBound) {
      dateEl.dataset.wareBound = "1";
      dateEl.addEventListener("change", () => {
        stockDay = dateEl.value || today();
        renderWareStock();
      });
    }
    const all = document.getElementById("wh-all");
    const btn = (w) => {
      const done = isConfirmed(date, w.id);
      const n = catalogOf(w.id).length;
      return `<button type="button" class="wh-btn is-own${done ? " is-done" : ""}" data-wh-pick="${esc(w.id)}">
        <strong>${esc(w.label)}</strong>
        <em>${done ? "已盤" : "未盤"}${n ? ` · ${n} 品` : ""}</em>
      </button>`;
    };
    if (all) all.innerHTML = WAREHOUSES.map((w) => btn(w)).join("");
    document.getElementById("co-name") &&
      (document.getElementById("co-name").textContent = "庫存盤點 · 選倉庫");
  }

  function renderCount() {
    const pick = document.getElementById("wh-pick");
    const count = document.getElementById("wh-count");
    const diff = document.getElementById("wh-diff");
    if (pick) pick.hidden = true;
    if (count) count.hidden = false;
    if (diff) diff.hidden = true;
    updateCountBar();
    const date = stockViewDay();
    const locked = isConfirmed(date, stockWh);
    renderAddForm(locked);
    const list = document.getElementById("wh-count-list");
    if (!list) return;
    const b = whBucket(date, stockWh);
    const items = catalogOf(stockWh);
    if (!items.length) {
      list.innerHTML = `<p class="wh-empty">本倉尚無品項。上方填「編號／品項／件數／備註」後按加入本倉。</p>`;
    } else {
      list.innerHTML = items
        .map((it) => {
          const sys = prevConfirmedQty(stockWh, it.id, date);
          const raw = b.qty[it.id];
          const has = raw !== "" && raw != null && Number.isFinite(Number(raw));
          const val = has ? String(raw) : "";
          const note = b.notes[it.id] || "";
          const varCls = has && round(Number(raw) - sys) !== 0 ? " is-var" : "";
          const fillCls = has ? " is-filled" : "";
          return `<div class="wh-row${fillCls}${varCls}" data-wh-row="${esc(it.id)}">
            <div class="wh-row-name">
              <strong><span class="wh-code">${esc(it.code)}</span> ${esc(it.name)}</strong>
              <span class="wh-sys">上次 ${fmt(sys)}</span>
            </div>
            <label class="wh-real">
              <span>件數</span>
              <input data-wh-qty="${esc(it.id)}" type="number" min="0" step="1" inputmode="decimal"
                value="${esc(val)}" ${locked ? "readonly" : ""} aria-label="${esc(it.code)} 件數" />
            </label>
            <label class="wh-note-field">
              <span>備註</span>
              <input data-wh-note="${esc(it.id)}" type="text" value="${esc(note)}"
                placeholder="選填" ${locked ? "readonly" : ""} aria-label="${esc(it.code)} 備註" />
            </label>
            ${
              locked
                ? ""
                : `<button type="button" class="ghost wh-del" data-wh-del="${esc(it.id)}" title="移除">刪</button>`
            }
          </div>`;
        })
        .join("");
    }
    const foot = document.querySelector(".wh-count-foot");
    if (foot) foot.hidden = locked;
    document.getElementById("co-name") &&
      (document.getElementById("co-name").textContent = `庫存盤點 · ${whLabel(stockWh)}`);
  }

  function diffRows(date, wh) {
    const b = whBucket(date, wh);
    const rows = [];
    for (const it of catalogOf(wh)) {
      const raw = b.qty[it.id];
      if (raw === "" || raw == null || !Number.isFinite(Number(raw))) continue;
      const actual = round(Number(raw));
      const sys = prevConfirmedQty(wh, it.id, date);
      const d = round(actual - sys);
      if (d === 0) continue;
      const note = b.notes[it.id] || "";
      rows.push({
        name: `${it.code} ${it.name}`,
        sys,
        actual,
        d,
        note,
      });
    }
    return rows;
  }

  function renderDiff() {
    const pick = document.getElementById("wh-pick");
    const count = document.getElementById("wh-count");
    const diff = document.getElementById("wh-diff");
    if (pick) pick.hidden = true;
    if (count) count.hidden = true;
    if (diff) diff.hidden = false;
    const date = stockViewDay();
    const title = document.getElementById("wh-diff-title");
    if (title) title.textContent = `${whLabel(stockWh)}　盤點結果`;
    const body = document.getElementById("wh-diff-body");
    const rows = diffRows(date, stockWh);
    if (!body) return;
    if (!rows.length) {
      body.innerHTML = `<p class="wh-flat">本倉盤平</p>
        <div class="btn-row"><button type="button" class="ghost" data-wh-repick>回倉庫列表</button>
        <button type="button" class="ghost" data-wh-recount>再盤一次</button></div>`;
    } else {
      body.innerHTML = `<ul class="wh-diff-list">${rows
        .map((r) => {
          const sign = r.d > 0 ? "+" : "";
          const note = r.note ? `<em>${esc(r.note)}</em>` : "";
          return `<li><strong>${esc(r.name)}</strong>
            <span>上次 ${fmt(r.sys)} → 實 ${fmt(r.actual)}　差 ${sign}${fmt(r.d)}</span>${note}</li>`;
        })
        .join("")}</ul>
        <div class="btn-row"><button type="button" class="ghost" data-wh-repick>回倉庫列表</button>
        <button type="button" class="ghost" data-wh-recount>修正盤點</button></div>`;
    }
    document.getElementById("co-name") &&
      (document.getElementById("co-name").textContent = `庫存盤點 · ${whLabel(stockWh)}`);
  }

  function saveDraft(quiet) {
    if (!stockWh) return;
    const date = stockViewDay();
    const b = whBucket(date, stockWh);
    b.at = Date.now();
    b.by = typeof currentStaff === "function" ? currentStaff() || "" : "";
    save();
    if (!quiet && typeof setStatus === "function") setStatus(`已暫存「${whLabel(stockWh)}」盤點。`, false);
    updateCountBar();
  }

  function confirmCount() {
    if (!stockWh) return;
    const date = stockViewDay();
    const items = catalogOf(stockWh);
    if (!items.length) {
      if (typeof setStatus === "function") setStatus("請先新增品項再確認盤點。", true);
      return;
    }
    const { filled, total } = filledCount(date, stockWh);
    if (filled < total) {
      if (!confirm(`尚有 ${total - filled} 項未填件數。確定確認本倉盤點？`)) return;
    }
    const b = whBucket(date, stockWh);
    b.confirmed = true;
    b.at = Date.now();
    b.by = typeof currentStaff === "function" ? currentStaff() || "" : "";
    save();
    stockPhase = "diff";
    if (typeof setStatus === "function") setStatus(`「${whLabel(stockWh)}」已確認盤點。`, false);
    renderWareStock();
  }

  function renderWareStock() {
    bindShellOnce();
    ensurePageShell();
    ensureCatalog();
    ensureRoot();
    if (!stockWh) stockPhase = "pick";
    if (stockPhase === "diff" && stockWh && isConfirmed(stockViewDay(), stockWh)) renderDiff();
    else if (stockWh && stockPhase !== "pick") {
      if (isConfirmed(stockViewDay(), stockWh) && stockPhase === "diff") renderDiff();
      else {
        stockPhase = "count";
        renderCount();
      }
    } else {
      stockPhase = "pick";
      stockWh = "";
      renderPick();
    }
  }
  window.renderWareStock = renderWareStock;

  if (typeof state !== "undefined") {
    ensureRoot();
    ensureCatalog();
  }

  const _go = typeof goFromHub === "function" ? goFromHub : null;
  if (_go) {
    window.goFromHub = function (btn) {
      const go = btn?.dataset?.go;
      if (go === "books" && (btn.dataset.books || "stock") === "stock") {
        // TEMP: 庫存未完成，暫僅雅芳（與 app.js can("books-stock") 一致）
        if (typeof can === "function" && !can("books-stock")) {
          return setStatus("庫存盤點建置中，暫僅主管可進入。", true);
        }
        page = "books";
        booksPart = "stock";
        stockWh = String(btn.dataset.stockWh || "").trim();
        stockPhase = btn.dataset.stockPhase || (stockWh ? "count" : "pick");
        if (!stockWh) stockPhase = "pick";
        render();
        return;
      }
      return _go(btn);
    };
  }

  window.renderStock = function () {
    renderWareStock();
  };

  const _hub = typeof renderHomeHub === "function" ? renderHomeHub : null;
  if (_hub) {
    window.renderHomeHub = function () {
      _hub();
      const open = document.querySelector("#home-hub .home-open");
      if (!open) return;
      const bare = [...open.querySelectorAll(":scope > .hub-link")];
      if (bare.length && !open.querySelector(".hub-links")) {
        const wrap = document.createElement("div");
        wrap.className = "hub-links";
        bare[0].before(wrap);
        bare.forEach((b) => wrap.appendChild(b));
      }
    };
  }

  if (typeof page !== "undefined" && page === "books" && typeof booksPart !== "undefined" && booksPart === "stock") {
    try {
      renderWareStock();
    } catch (_) {}
  }
})();
