/** 雅芳（主管）營運統計：進銷存式明細表＋刪除紀錄. Loads last. */
(function () {
  let statsTab = "orders"; // orders | labels | flow | unpack | ledger | audit
  let statsRange = "30"; // 7 | 30 | all
  let sheetFocus = null; // { id, start, end }

  const filters = {
    orders: { from: "", to: "", customer: "", status: "", q: "" },
    labels: { from: "", to: "", kind: "", q: "" },
    flow: { from: "", to: "", type: "", status: "", q: "" },
    unpack: { from: "", to: "", status: "", customer: "", q: "" },
    ledger: { from: "", to: "", customer: "", item: "", status: "" },
  };

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

  function orderNoSortKey(no) {
    const s = String(no ?? "").trim();
    const m = /^(\d+)(?:-(\d+))?$/.exec(s);
    if (!m) {
      const n = Number(no);
      return Number.isFinite(n) ? n * 1000 : 0;
    }
    return Number(m[1]) * 1000 + (m[2] != null ? Number(m[2]) : 0);
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

  function passDay(ymd, from, to) {
    const day = String(ymd || "");
    const f = String(from || "").trim();
    const t = String(to || "").trim();
    if (f || t) {
      if (f && day < f) return false;
      if (t && day > t) return false;
      return true;
    }
    return inRange(day);
  }

  function qtyText(n) {
    return typeof fmt === "function" ? fmt(n) : String(Number(n) || 0);
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

  function clockText(at) {
    const d = new Date(Number(at) || 0);
    if (!Number.isFinite(d.getTime()) || !d.getTime()) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mi}`;
  }

  function whText(code) {
    if (!code) return "";
    if (typeof warehouseLabel === "function") return warehouseLabel(code);
    if (typeof stockWarehouseLabel === "function") return stockWarehouseLabel(code);
    return String(code);
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
      }[k] ||
      k ||
      "—"
    );
  }

  /* ── shared Excel sheet UI ── */

  function filterField(opts) {
    const id = opts.id;
    const label = opts.label;
    const grow = opts.grow ? " st-filter-grow" : "";
    if (opts.type === "select") {
      const options = (opts.options || [])
        .map(
          (o) =>
            `<option value="${esc(o.value)}"${String(opts.value) === String(o.value) ? " selected" : ""}>${esc(o.label)}</option>`,
        )
        .join("");
      return `<label class="st-filter${grow}">
        <span>${esc(label)}</span>
        <select id="${esc(id)}">${options}</select>
      </label>`;
    }
    const inputType = opts.type || "search";
    const ph = opts.placeholder ? ` placeholder="${esc(opts.placeholder)}"` : "";
    return `<label class="st-filter${grow}">
      <span>${esc(label)}</span>
      <input type="${esc(inputType)}" id="${esc(id)}" value="${esc(opts.value || "")}"${ph} autocomplete="off" />
    </label>`;
  }

  function sheetFiltersHtml(fields, clearAttr, hint) {
    return `<div class="st-ledger-filters">
      ${fields.join("")}
      <button type="button" class="ghost st-ledger-clear" ${clearAttr}>清除篩選</button>
    </div>
    <p class="st-ledger-hint muted">${hint || "未填起迄日時，沿用上方「近7日／近30日／全部」。"}</p>`;
  }

  function sheetTable(headers, rowCells) {
    if (!rowCells.length) return `<p class="st-empty">沒有符合條件的明細</p>`;
    const head = headers.map((h) => `<th>${esc(h)}</th>`).join("");
    const body = rowCells
      .map((cells) => {
        const tds = cells
          .map((c) => {
            const cls = c.cls ? ` class="${esc(c.cls)}"` : "";
            return `<td${cls}>${esc(String(c.text ?? ""))}</td>`;
          })
          .join("");
        return `<tr>${tds}</tr>`;
      })
      .join("");
    return `<div class="st-sheet-wrap">
      <table class="st-sheet">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
  }

  function sheetKpis(items) {
    return `<div class="st-kpis st-ledger-kpis">${items
      .map(
        (it) =>
          `<div class="st-kpi${it.warn ? " warn" : ""}"><strong>${esc(String(it.value))}</strong><span>${esc(it.label)}</span></div>`,
      )
      .join("")}</div>`;
  }

  function restoreSheetFocus() {
    if (!sheetFocus?.id) return;
    const el = document.getElementById(sheetFocus.id);
    if (!el || typeof el.focus !== "function") return;
    el.focus();
    if (typeof el.setSelectionRange === "function" && typeof sheetFocus.start === "number") {
      try {
        el.setSelectionRange(sheetFocus.start, sheetFocus.end ?? sheetFocus.start);
      } catch (_) {
        /* ignore non-text inputs */
      }
    }
    sheetFocus = null;
  }

  function captureFocus(el) {
    sheetFocus = {
      id: el.id,
      start: typeof el.selectionStart === "number" ? el.selectionStart : null,
      end: typeof el.selectionEnd === "number" ? el.selectionEnd : null,
    };
  }

  /* ── 訂單（一列＝一張訂單） ── */

  function orderStatusKey(o) {
    if (o.status === "shipped") return "shipped";
    if (o.status === "delivered") return "delivered";
    if (o.status === "cancelled") return "cancelled";
    if (o.status === "deleted") return "deleted";
    if (o.settled) return "settled";
    if (o.assignedDriver) return o.runOut ? "runout" : "assigned";
    return "open";
  }

  function statusOptions() {
    return [
      { value: "", label: "全部狀態" },
      { value: "open", label: "未結單" },
      { value: "settled", label: "已結單" },
      { value: "assigned", label: "已派單" },
      { value: "runout", label: "送貨中" },
      { value: "shipped", label: "已送出" },
      { value: "delivered", label: "已送達" },
      { value: "cancelled", label: "已取消" },
      { value: "deleted", label: "已刪除" },
    ];
  }

  function itemDisplayName(line) {
    if (line.labelName) return String(line.labelName);
    const s = typeof skuById === "function" ? skuById(line.skuId) : null;
    return s ? s.name : line.skuId || "";
  }

  function itemUnit(line) {
    const s = typeof skuById === "function" ? skuById(line.skuId) : null;
    return s?.unit || "";
  }

  function packSpecText(line) {
    const bits = [];
    const banN =
      typeof lineBanQty === "function"
        ? lineBanQty(line)
        : Number(line.banQty) > 0
          ? Number(line.banQty)
          : line.ban === "一版"
            ? 1
            : line.ban === "兩版"
              ? 2
              : 0;
    if (banN > 0) bits.push(`${banN}版`);
    if (line.pack) bits.push(line.pack);
    if (line.size) bits.push(line.size);
    if (line.leafType) bits.push(line.leafType);
    if (line.spec) bits.push(line.spec);
    if (line.weight || line.wt) bits.push(line.weight || line.wt);
    if (line.pallet) bits.push("疊棧板");
    return bits.join("／");
  }

  function lotText(line) {
    const cont =
      typeof lineContainerNo === "function"
        ? lineContainerNo(line)
        : String(line.containerNo || line.contNo || "").trim();
    return cont || line.lotContainer || line.lotUha || "";
  }

  function lineWhText(line) {
    const ship =
      typeof lineShipWh === "function"
        ? lineShipWh(line)
        : String(line.shipWh || line.outWh || "").trim();
    if (ship) return ship;
    if (!line.lotWh) return "";
    return typeof warehouseLabel === "function" ? warehouseLabel(line.lotWh) : String(line.lotWh);
  }

  function buildOrderRows() {
    const f = filters.orders;
    const custQ = String(f.customer || "").trim().toLowerCase();
    const q = String(f.q || "").trim().toLowerCase();
    const stQ = String(f.status || "").trim();
    const rows = [];

    for (const o of state.orders || []) {
      const shipDay = o.shipDate || dayKey(o.createdAt || 0);
      if (!passDay(shipDay, f.from, f.to)) continue;
      if (stQ && orderStatusKey(o) !== stQ) continue;
      if (custQ && !String(o.customer || "").toLowerCase().includes(custQ)) continue;

      const lines = (o.lines || []).filter((l) =>
        typeof lineHasItem === "function" ? lineHasItem(l) : Number(l.qty) > 0 || Number(l.banQty) > 0,
      );
      const lineCount = lines.length;
      const qtySum = lines.reduce((n, l) => n + (Number(l.qty) || 0), 0);
      const itemPreview = lines
        .slice(0, 3)
        .map((l) => {
          const nm = itemDisplayName(l);
          const ban =
            typeof lineBanText === "function"
              ? lineBanText(l)
              : Number(l.banQty) > 0
                ? `${l.banQty}版`
                : "";
          return ban ? `${nm}（${ban}）` : nm;
        })
        .filter(Boolean)
        .join("、");
      const statusLabel = typeof orderStatusLabel === "function" ? orderStatusLabel(o) : o.status || "";
      const coName = typeof coLabel === "function" ? coLabel(o.co) : o.co || "";

      if (q) {
        const hay = `${o.no} ${o.customer || ""} ${itemPreview} ${o.shipAddr || ""} ${o.remark || ""} ${o.assignedDriver || ""} ${statusLabel}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }

      rows.push({
        shipDate: shipDay,
        co: coName,
        no: o.no,
        customer: o.customer || "",
        lineCount,
        qtySum,
        items: itemPreview + (lines.length > 3 ? "…" : ""),
        status: statusLabel,
        shippedOn: o.shippedOn || "",
        driver: o.assignedDriver || "",
        addr: o.shipAddr || "",
        remark: o.remark || "",
        by: o.enteredBy || "",
        settled: o.settled ? "是" : "",
      });
    }

    rows.sort(
      (a, b) =>
        String(b.shipDate).localeCompare(String(a.shipDate)) ||
        String(a.customer).localeCompare(String(b.customer), "zh-Hant") ||
        orderNoSortKey(a.no) - orderNoSortKey(b.no),
    );
    return rows;
  }

  function ordersBody() {
    const f = filters.orders;
    const rows = buildOrderRows();
    const qtySum = rows.reduce((n, r) => n + (Number(r.qtySum) || 0), 0);
    const fields = [
      filterField({ id: "st-orders-from", label: "出貨日起", type: "date", value: f.from }),
      filterField({ id: "st-orders-to", label: "出貨日迄", type: "date", value: f.to }),
      filterField({
        id: "st-orders-customer",
        label: "客戶",
        type: "search",
        value: f.customer,
        placeholder: "關鍵字",
        grow: true,
      }),
      filterField({
        id: "st-orders-status",
        label: "狀態",
        type: "select",
        value: f.status,
        options: statusOptions(),
      }),
      filterField({
        id: "st-orders-q",
        label: "搜尋",
        type: "search",
        value: f.q,
        placeholder: "單號／地址／備註",
        grow: true,
      }),
    ];
    const cells = rows.map((r) => [
      { text: r.shipDate, cls: "st-cell-date" },
      { text: r.co },
      { text: `#${r.no}`, cls: "st-num" },
      { text: r.customer },
      { text: String(r.lineCount), cls: "st-num" },
      { text: qtyText(r.qtySum), cls: "st-num" },
      { text: r.items },
      { text: r.status },
      { text: r.shippedOn, cls: "st-cell-date" },
      { text: r.driver },
      { text: r.addr },
      { text: r.remark },
      { text: r.settled },
      { text: r.by },
    ]);
    return `
      ${sheetFiltersHtml(fields, "data-st-clear=\"orders\"", "一列＝一張訂單。品項明細請看「進銷存清單」。")}
      ${sheetKpis([
        { value: rows.length, label: "訂單筆數" },
        { value: qtyText(qtySum), label: "數量合計" },
      ])}
      ${sheetTable(
        [
          "出貨日",
          "帳本",
          "單號",
          "客戶",
          "品項數",
          "數量合計",
          "品項預覽",
          "狀態",
          "實際出貨",
          "司機",
          "送貨地址",
          "備註",
          "結單",
          "入單",
        ],
        cells,
      )}`;
  }

  /* ── 標籤 ── */

  function buildLabelRows() {
    const f = filters.labels;
    const kindQ = String(f.kind || "").trim();
    const q = String(f.q || "").trim().toLowerCase();
    const prints = typeof loadLabelPrints === "function" ? loadLabelPrints() : [];
    const rows = [];

    for (const p of prints) {
      const day = p.day || dayKey(p.at);
      if (!passDay(day, f.from, f.to)) continue;
      if (kindQ && p.kind !== kindQ) continue;
      const kind =
        typeof labelPrintKindName === "function" ? labelPrintKindName(p.kind) : p.kind || "";
      const summary =
        typeof labelPrintSummary === "function" ? labelPrintSummary(p) : p.text || p.name || "";
      const seq =
        p.seqFrom && p.seqTo
          ? p.seqFrom === p.seqTo
            ? `#${p.seqFrom}`
            : `#${p.seqFrom}–${p.seqTo}`
          : p.seqFrom
            ? `#${p.seqFrom}`
            : "";
      const codes = Array.isArray(p.codes) ? p.codes.filter(Boolean).join("、") : "";
      if (q) {
        const hay =
          `${kind} ${summary} ${p.box || ""} ${codes} ${p.customer || ""} ${p.sku || ""} ${p.text || ""} ${p.staff || ""} ${seq}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      rows.push({
        day,
        time: clockText(p.at),
        kind,
        copies: Number(p.copies) || 0,
        summary,
        seq,
        box: p.box || "",
        codes,
        customer: p.customer || "",
        sku: p.sku || p.name || "",
        staff: p.staff || "",
      });
    }

    rows.sort(
      (a, b) =>
        String(b.day).localeCompare(String(a.day)) ||
        String(b.time).localeCompare(String(a.time)),
    );
    return rows;
  }

  function labelsBody() {
    const f = filters.labels;
    const rows = buildLabelRows();
    const copies = rows.reduce((n, r) => n + (Number(r.copies) || 0), 0);
    const fields = [
      filterField({ id: "st-labels-from", label: "日期起", type: "date", value: f.from }),
      filterField({ id: "st-labels-to", label: "日期迄", type: "date", value: f.to }),
      filterField({
        id: "st-labels-kind",
        label: "種類",
        type: "select",
        value: f.kind,
        options: [
          { value: "", label: "全部種類" },
          { value: "text", label: "文字" },
          { value: "container", label: "貨櫃" },
          { value: "ship", label: "出貨" },
        ],
      }),
      filterField({
        id: "st-labels-q",
        label: "搜尋",
        type: "search",
        value: f.q,
        placeholder: "內容／客戶／編號",
        grow: true,
      }),
    ];
    const cells = rows.map((r) => [
      { text: r.day, cls: "st-cell-date" },
      { text: r.time },
      { text: r.kind },
      { text: String(r.copies), cls: "st-num" },
      { text: r.summary },
      { text: r.seq },
      { text: r.box },
      { text: r.codes },
      { text: r.customer },
      { text: r.sku },
      { text: r.staff },
    ]);
    return `
      ${sheetFiltersHtml(fields, "data-st-clear=\"labels\"", "一列＝一批標籤列印紀錄。")}
      ${sheetKpis([
        { value: rows.length, label: "列印批數" },
        { value: copies, label: "張數合計" },
      ])}
      ${sheetTable(
        ["日期", "時間", "種類", "張數", "內容", "流水號", "貨櫃編號", "貨櫃號碼", "客戶", "品項", "操作人"],
        cells,
      )}`;
  }

  /* ── 進出調撥（調倉／進貨／工作單） ── */

  function buildFlowRows() {
    const f = filters.flow;
    const typeQ = String(f.type || "").trim();
    const stQ = String(f.status || "").trim();
    const q = String(f.q || "").trim().toLowerCase();
    const rows = [];

    for (const m of state.siteMoves || []) {
      const day = m.day || dayKey(m.at);
      if (!passDay(day, f.from, f.to)) continue;
      if (typeQ && typeQ !== "move") continue;
      const status = m.done ? "完成" : "進行";
      if (stQ === "done" && !m.done) continue;
      if (stQ === "open" && m.done) continue;
      if (stQ === "pending" || stQ === "confirmed") continue;
      const from = whText(m.fromWh);
      const to = whText(m.toWh);
      if (q) {
        const hay = `調倉 ${m.code || ""} ${m.name || ""} ${from} ${to} ${m.driver || ""} ${m.note || ""} ${m.by || ""} ${status}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      rows.push({
        day,
        type: "調倉",
        sortAt: Number(m.at) || 0,
        code: m.code || "",
        name: m.name || "",
        qty: m.qty != null ? qtyText(m.qty) : "",
        from,
        to,
        status,
        who: m.driver || "",
        note: m.note || "",
        by: m.by || "",
        extra: m.backDay ? `回程 ${m.backDay}` : "",
      });
    }

    for (const r of state.inboundLedger || []) {
      const day = r.day || dayKey(r.createdAt || r.at);
      if (!passDay(day, f.from, f.to)) continue;
      if (typeQ && typeQ !== "inbound") continue;
      const status = r.status === "confirmed" ? "已入庫" : "待確認";
      if (stQ === "pending" && r.status !== "pending") continue;
      if (stQ === "confirmed" && r.status !== "confirmed") continue;
      if (stQ === "done" || stQ === "open") continue;
      const wh =
        r.warehouse === "customer"
          ? r.customerName
            ? `客戶 · ${r.customerName}`
            : "客戶"
          : whText(r.warehouse);
      const src = r.source === "unpack" ? "拆櫃轉入" : r.source === "manual" ? "手動" : r.source || "";
      if (q) {
        const hay = `進貨 ${r.code || ""} ${r.name || ""} ${wh} ${r.note || ""} ${r.createdBy || ""} ${status} ${src}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      rows.push({
        day,
        type: "進貨",
        sortAt: Number(r.createdAt || r.at) || 0,
        code: r.code || "",
        name: r.name || "",
        qty: r.qty != null ? qtyText(r.qty) : "",
        from: src,
        to: wh,
        status,
        who: r.by || r.createdBy || "",
        note: r.note || "",
        by: r.createdBy || "",
        extra: r.unpackQty != null ? `拆櫃數 ${r.unpackQty}` : "",
      });
    }

    for (const w of state.siteWorks || []) {
      const day = w.day || dayKey(w.at);
      if (!passDay(day, f.from, f.to)) continue;
      if (typeQ && typeQ !== "work") continue;
      const status = w.done ? "完成" : "進行";
      if (stQ === "done" && !w.done) continue;
      if (stQ === "open" && w.done) continue;
      if (stQ === "pending" || stQ === "confirmed") continue;
      const wh = whText(w.wh);
      if (q) {
        const hay = `工作單 ${w.title || ""} ${wh} ${w.who || ""} ${w.note || ""} ${w.by || ""} ${status}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      rows.push({
        day,
        type: "工作單",
        sortAt: Number(w.at) || 0,
        code: "",
        name: w.title || "",
        qty: "",
        from: "",
        to: wh,
        status,
        who: w.who || "",
        note: w.note || "",
        by: w.by || "",
        extra: "",
      });
    }

    rows.sort(
      (a, b) =>
        String(b.day).localeCompare(String(a.day)) ||
        Number(b.sortAt) - Number(a.sortAt) ||
        String(a.type).localeCompare(String(b.type), "zh-Hant"),
    );
    return rows;
  }

  function flowBody() {
    const f = filters.flow;
    const rows = buildFlowRows();
    const fields = [
      filterField({ id: "st-flow-from", label: "日期起", type: "date", value: f.from }),
      filterField({ id: "st-flow-to", label: "日期迄", type: "date", value: f.to }),
      filterField({
        id: "st-flow-type",
        label: "類型",
        type: "select",
        value: f.type,
        options: [
          { value: "", label: "全部類型" },
          { value: "move", label: "調倉" },
          { value: "inbound", label: "進貨" },
          { value: "work", label: "工作單" },
        ],
      }),
      filterField({
        id: "st-flow-status",
        label: "狀態",
        type: "select",
        value: f.status,
        options: [
          { value: "", label: "全部狀態" },
          { value: "open", label: "進行（調倉／工作）" },
          { value: "done", label: "完成（調倉／工作）" },
          { value: "pending", label: "待確認（進貨）" },
          { value: "confirmed", label: "已入庫（進貨）" },
        ],
      }),
      filterField({
        id: "st-flow-q",
        label: "搜尋",
        type: "search",
        value: f.q,
        placeholder: "編號／品項／備註",
        grow: true,
      }),
    ];
    const cells = rows.map((r) => [
      { text: r.day, cls: "st-cell-date" },
      { text: r.type },
      { text: r.code },
      { text: r.name },
      { text: r.qty, cls: "st-num" },
      { text: r.from },
      { text: r.to },
      { text: r.status },
      { text: r.who },
      { text: r.note },
      { text: r.extra },
      { text: r.by },
    ]);
    return `
      ${sheetFiltersHtml(fields, "data-st-clear=\"flow\"", "含調倉、進貨登錄與現場工作單。拆櫃數量請看「拆櫃數量」分頁。")}
      ${sheetKpis([
        { value: rows.filter((r) => r.type === "調倉").length, label: "調倉" },
        { value: rows.filter((r) => r.type === "進貨").length, label: "進貨" },
        { value: rows.filter((r) => r.type === "工作單").length, label: "工作單" },
        { value: rows.length, label: "合計列" },
      ])}
      ${sheetTable(
        ["日期", "類型", "編號", "品項／內容", "數量", "來源", "目的／倉庫", "狀態", "負責人", "備註", "其他", "建立人"],
        cells,
      )}`;
  }

  /* ── 拆櫃數量 ── */

  function unpackStatusLabel(j) {
    if (!j) return "";
    if (j.status === "confirmed") return "已確認進貨";
    if (j.status === "reported") return j.stockIn === false ? "已回報" : "待會計確認";
    return "待回報";
  }

  function unpackLocDisplay(j) {
    if (!j) return "";
    if (j.location === "customer") {
      return j.customerName ? `客戶 · ${j.customerName}` : "客戶";
    }
    return j.location ? whText(j.location) : "";
  }

  function buildUnpackRows() {
    const f = filters.unpack;
    const stQ = String(f.status || "").trim();
    const custQ = String(f.customer || "").trim().toLowerCase();
    const q = String(f.q || "").trim().toLowerCase();
    const rows = [];

    for (const j of state.unpackJobs || []) {
      const day = j.day || dayKey(j.reportedAt || j.confirmedAt || 0);
      if (!passDay(day, f.from, f.to)) continue;
      if (stQ && j.status !== stQ) continue;
      const customer = j.customer || j.customerName || "";
      if (custQ && !String(customer).toLowerCase().includes(custQ)) continue;
      const codes = Array.isArray(j.codes) ? j.codes.filter(Boolean).join("、") : "";
      const status = unpackStatusLabel(j);
      const loc = unpackLocDisplay(j);
      if (q) {
        const hay =
          `${j.box || ""} ${j.reportBox || ""} ${codes} ${j.name || ""} ${customer} ${j.unloadPoint || ""} ${j.assignee || ""} ${status} ${j.note || ""}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      rows.push({
        day,
        box: j.box || "",
        reportBox: j.reportBox || "",
        codes,
        name: j.name || "",
        country: j.country || "",
        unpackQty: j.unpackQty != null ? qtyText(j.unpackQty) : "",
        qty: j.qty != null ? qtyText(j.qty) : "",
        stockIn: j.stockIn === false ? "否" : "是",
        location: loc,
        customer,
        unload: j.unloadPoint || "",
        assignee: j.assignee || "",
        status,
        reportedBy: j.reportedBy || "",
        reportedAt: j.reportedAt ? timeText(j.reportedAt) : "",
        note: j.note || "",
        sortAt: Number(j.reportedAt || j.confirmedAt || 0),
      });
    }

    rows.sort(
      (a, b) =>
        String(b.day).localeCompare(String(a.day)) ||
        Number(b.sortAt) - Number(a.sortAt) ||
        String(a.box).localeCompare(String(b.box)),
    );
    return rows;
  }

  function unpackBody() {
    const f = filters.unpack;
    const rows = buildUnpackRows();
    const unpackSum = rows.reduce((n, r) => n + (parseFloat(String(r.unpackQty).replace(/,/g, "")) || 0), 0);
    const boxSum = rows.reduce((n, r) => n + (parseFloat(String(r.qty).replace(/,/g, "")) || 0), 0);
    const fields = [
      filterField({ id: "st-unpack-from", label: "日期起", type: "date", value: f.from }),
      filterField({ id: "st-unpack-to", label: "日期迄", type: "date", value: f.to }),
      filterField({
        id: "st-unpack-status",
        label: "狀態",
        type: "select",
        value: f.status,
        options: [
          { value: "", label: "全部狀態" },
          { value: "pending", label: "待回報" },
          { value: "reported", label: "已回報／待確認" },
          { value: "confirmed", label: "已確認進貨" },
        ],
      }),
      filterField({
        id: "st-unpack-customer",
        label: "客戶",
        type: "search",
        value: f.customer,
        placeholder: "交櫃／客戶名",
        grow: true,
      }),
      filterField({
        id: "st-unpack-q",
        label: "搜尋",
        type: "search",
        value: f.q,
        placeholder: "貨櫃編號／號碼／品名",
        grow: true,
      }),
    ];
    const cells = rows.map((r) => [
      { text: r.day, cls: "st-cell-date" },
      { text: r.box },
      { text: r.reportBox },
      { text: r.codes },
      { text: r.name },
      { text: r.country },
      { text: r.unpackQty, cls: "st-num" },
      { text: r.qty, cls: "st-num" },
      { text: r.stockIn },
      { text: r.location },
      { text: r.customer },
      { text: r.unload },
      { text: r.assignee },
      { text: r.status },
      { text: r.reportedBy },
      { text: r.reportedAt },
      { text: r.note },
    ]);
    return `
      ${sheetFiltersHtml(fields, "data-st-clear=\"unpack\"", "一列＝一筆拆櫃單（含待回報）。")}
      ${sheetKpis([
        { value: rows.length, label: "拆櫃單" },
        { value: qtyText(unpackSum), label: "拆櫃數量合計" },
        { value: qtyText(boxSum), label: "外箱合計" },
      ])}
      ${sheetTable(
        [
          "日期",
          "貨櫃編號",
          "拆櫃編號",
          "貨櫃號碼",
          "品名",
          "國別",
          "拆櫃數量",
          "外箱",
          "入庫",
          "位置",
          "客戶",
          "卸貨點",
          "負責",
          "狀態",
          "回報人",
          "回報時間",
          "備註",
        ],
        cells,
      )}`;
  }

  /* ── 進銷存清單（訂單明細列） ── */

  function ledgerStatusKey(o) {
    return orderStatusKey(o);
  }

  function buildLedgerRows() {
    const f = filters.ledger;
    const custQ = String(f.customer || "").trim().toLowerCase();
    const itemQ = String(f.item || "").trim().toLowerCase();
    const stQ = String(f.status || "").trim();
    const rows = [];

    for (const o of state.orders || []) {
      const shipDay = o.shipDate || dayKey(o.createdAt || 0);
      if (!passDay(shipDay, f.from, f.to)) continue;
      if (stQ && ledgerStatusKey(o) !== stQ) continue;
      if (custQ && !String(o.customer || "").toLowerCase().includes(custQ)) continue;

      const statusLabel = typeof orderStatusLabel === "function" ? orderStatusLabel(o) : o.status || "";
      const coName = typeof coLabel === "function" ? coLabel(o.co) : o.co || "";
      const lines = (o.lines || []).filter((l) =>
        typeof lineHasItem === "function" ? lineHasItem(l) : Number(l.qty) > 0 || Number(l.banQty) > 0,
      );
      if (!lines.length) continue;

      for (const line of lines) {
        const name = itemDisplayName(line);
        if (itemQ) {
          const hay = `${name} ${line.skuId || ""} ${line.note || ""} ${packSpecText(line)}`.toLowerCase();
          if (!hay.includes(itemQ)) continue;
        }
        const qtyShown =
          typeof lineQtyText === "function" ? lineQtyText(line) : Number(line.qty) > 0 ? qtyText(line.qty) : "後填";
        rows.push({
          shipDate: shipDay,
          co: coName,
          no: o.no,
          customer: o.customer || "",
          item: name,
          qty: qtyShown,
          unit: Number(line.qty) > 0 ? itemUnit(line) : "",
          pack: packSpecText(line),
          status: statusLabel,
          shippedOn: o.shippedOn || "",
          wh: lineWhText(line),
          lot: lotText(line),
          dest: line.dest || "",
          addr: o.shipAddr || "",
          lineNote: line.note || "",
          remark: o.remark || "",
          by: o.enteredBy || "",
        });
      }
    }

    rows.sort(
      (a, b) =>
        String(b.shipDate).localeCompare(String(a.shipDate)) ||
        String(a.customer).localeCompare(String(b.customer), "zh-Hant") ||
        orderNoSortKey(a.no) - orderNoSortKey(b.no) ||
        String(a.item).localeCompare(String(b.item), "zh-Hant"),
    );
    return rows;
  }

  function ledgerBody() {
    const f = filters.ledger;
    const rows = buildLedgerRows();
    const qtySum = rows.reduce((n, r) => n + (parseFloat(String(r.qty).replace(/,/g, "")) || 0), 0);
    const fields = [
      filterField({ id: "st-ledger-from", label: "出貨日起", type: "date", value: f.from }),
      filterField({ id: "st-ledger-to", label: "出貨日迄", type: "date", value: f.to }),
      filterField({
        id: "st-ledger-customer",
        label: "客戶",
        type: "search",
        value: f.customer,
        placeholder: "關鍵字",
        grow: true,
      }),
      filterField({
        id: "st-ledger-item",
        label: "品項",
        type: "search",
        value: f.item,
        placeholder: "品名／編號",
        grow: true,
      }),
      filterField({
        id: "st-ledger-status",
        label: "狀態",
        type: "select",
        value: f.status,
        options: statusOptions(),
      }),
    ];
    const cells = rows.map((r) => [
      { text: r.shipDate, cls: "st-cell-date" },
      { text: r.co },
      { text: `#${r.no}`, cls: "st-num" },
      { text: r.customer },
      { text: r.item },
      { text: String(r.qty), cls: "st-num" },
      { text: r.unit },
      { text: r.pack },
      { text: r.status },
      { text: r.shippedOn, cls: "st-cell-date" },
      { text: r.wh },
      { text: r.lot },
      { text: r.dest },
      { text: r.addr },
      { text: r.lineNote },
      { text: r.remark },
      { text: r.by },
    ]);
    return `
      ${sheetFiltersHtml(fields, "data-st-clear=\"ledger\"", "一列＝一筆訂單明細（進銷存銷售列）。")}
      ${sheetKpis([
        { value: rows.length, label: "明細列" },
        { value: qtyText(qtySum), label: "數量合計" },
      ])}
      ${sheetTable(
        [
          "出貨日",
          "帳本",
          "單號",
          "客戶",
          "品項",
          "數量",
          "單位",
          "包裝／規格",
          "狀態",
          "實際出貨",
          "出貨倉",
          "貨櫃編號",
          "送往",
          "送貨地址",
          "明細備註",
          "訂單備註",
          "入單",
        ],
        cells,
      )}`;
  }

  /* ── 刪除紀錄 ── */

  function auditRows() {
    const log = Array.isArray(state.auditLog) ? state.auditLog : [];
    return log.filter((a) => inRange(dayKey(a.at))).slice(0, 80);
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

  /* ── filter I/O ── */

  const FILTER_IDS = {
    orders: ["st-orders-from", "st-orders-to", "st-orders-customer", "st-orders-status", "st-orders-q"],
    labels: ["st-labels-from", "st-labels-to", "st-labels-kind", "st-labels-q"],
    flow: ["st-flow-from", "st-flow-to", "st-flow-type", "st-flow-status", "st-flow-q"],
    unpack: ["st-unpack-from", "st-unpack-to", "st-unpack-status", "st-unpack-customer", "st-unpack-q"],
    ledger: ["st-ledger-from", "st-ledger-to", "st-ledger-customer", "st-ledger-item", "st-ledger-status"],
  };

  const FILTER_KEYS = {
    "st-orders-from": ["orders", "from"],
    "st-orders-to": ["orders", "to"],
    "st-orders-customer": ["orders", "customer"],
    "st-orders-status": ["orders", "status"],
    "st-orders-q": ["orders", "q"],
    "st-labels-from": ["labels", "from"],
    "st-labels-to": ["labels", "to"],
    "st-labels-kind": ["labels", "kind"],
    "st-labels-q": ["labels", "q"],
    "st-flow-from": ["flow", "from"],
    "st-flow-to": ["flow", "to"],
    "st-flow-type": ["flow", "type"],
    "st-flow-status": ["flow", "status"],
    "st-flow-q": ["flow", "q"],
    "st-unpack-from": ["unpack", "from"],
    "st-unpack-to": ["unpack", "to"],
    "st-unpack-status": ["unpack", "status"],
    "st-unpack-customer": ["unpack", "customer"],
    "st-unpack-q": ["unpack", "q"],
    "st-ledger-from": ["ledger", "from"],
    "st-ledger-to": ["ledger", "to"],
    "st-ledger-customer": ["ledger", "customer"],
    "st-ledger-item": ["ledger", "item"],
    "st-ledger-status": ["ledger", "status"],
  };

  const LIVE_INPUT_IDS = new Set([
    "st-orders-customer",
    "st-orders-q",
    "st-labels-q",
    "st-flow-q",
    "st-unpack-customer",
    "st-unpack-q",
    "st-ledger-customer",
    "st-ledger-item",
  ]);

  function readFiltersFromDom() {
    for (const [id, [tab, key]] of Object.entries(FILTER_KEYS)) {
      const el = document.getElementById(id);
      if (el) filters[tab][key] = el.value || "";
    }
  }

  function clearFilters(tab) {
    const f = filters[tab];
    if (!f) return;
    for (const k of Object.keys(f)) f[k] = "";
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

    let body = "";
    if (statsTab === "orders") body = ordersBody();
    else if (statsTab === "labels") body = labelsBody();
    else if (statsTab === "flow") body = flowBody();
    else if (statsTab === "unpack") body = unpackBody();
    else if (statsTab === "ledger") body = ledgerBody();
    else {
      const audits = auditRows();
      body = `
        <h3>刪除／異動紀錄 ${audits.length}</h3>
        <p class="muted">含訂單刪除、調倉／工作單刪除等。僅主管可見。</p>
        ${auditTable(audits)}`;
    }

    root.innerHTML = `
      <header class="st-head">
        <h2>營運統計</h2>
        <p class="muted">雅芳專用：訂單／標籤／進出調撥／拆櫃數量／進銷存清單與刪除紀錄（Excel 式明細）。</p>
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
        <button type="button" class="tab${statsTab === "unpack" ? " on" : ""}" data-st-tab="unpack">拆櫃數量</button>
        <button type="button" class="tab${statsTab === "ledger" ? " on" : ""}" data-st-tab="ledger">進銷存清單</button>
        <button type="button" class="tab${statsTab === "audit" ? " on" : ""}" data-st-tab="audit">刪除紀錄</button>
      </nav>
      <div class="st-body">${body}</div>`;

    document.getElementById("co-name") &&
      (document.getElementById("co-name").textContent = "營運統計");

    if (FILTER_IDS[statsTab]) restoreSheetFocus();
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
        return;
      }
      const clearBtn = e.target.closest("[data-st-clear]");
      if (clearBtn) {
        clearFilters(clearBtn.getAttribute("data-st-clear") || "");
        renderStats();
      }
    });
    document.body.addEventListener("input", (e) => {
      const t = e.target;
      if (!t?.id || !LIVE_INPUT_IDS.has(t.id)) return;
      captureFocus(t);
      readFiltersFromDom();
      renderStats();
    });
    document.body.addEventListener("change", (e) => {
      const t = e.target;
      if (!t?.id || !FILTER_KEYS[t.id]) return;
      if (LIVE_INPUT_IDS.has(t.id)) return;
      readFiltersFromDom();
      renderStats();
    });
  }

  window.renderBossStats = function () {
    bindOnce();
    renderStats();
  };
})();
