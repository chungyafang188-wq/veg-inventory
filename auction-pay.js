/** 鴻安拍賣 × 貨款件數核對：勾沒問題，未勾給對方核對 */
(function () {
  const MARKETS = [
    ["一市", /一市|第一/],
    ["二市", /二市|第二/],
    ["三重", /三重/],
    ["板橋", /板橋/],
    ["桃農", /桃園|桃農/],
    ["高雄", /高雄/],
    ["鳳山", /鳳山/],
    ["屏東", /屏東/],
  ];
  const CROPS = [
    ["高麗", /高麗|甘藍/],
    ["大白菜", /大白菜/],
    ["朝天椒", /朝天|辣椒.{0,4}小(?!紅)/],
    ["辣椒紅小", /辣椒紅小|紅小/],
    ["南瓜", /南瓜/],
    ["牛蒡", /牛蒡/],
    ["青花", /青花/],
    ["洋蔥本產", /洋蔥.*本產|本產.*洋蔥/],
    ["洋蔥進口", /洋蔥.*進口|進口.*洋蔥/],
  ];
  const LS_KEY = "auction-pay-confirm-v1";

  let bound = false;
  let view = "pending";
  let honganName = "";
  let payName = "";
  let rows = [];
  let confirms = {};
  let msg = "";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function ymd(d) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  function parseDate(v) {
    if (v instanceof Date && !isNaN(v)) return ymd(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())));
    if (typeof v === "number" && v > 20000 && v < 80000) {
      return ymd(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000));
    }
    const s = String(v || "").trim();
    let m = s.match(/^(\d{2,4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
    if (m) {
      let y = Number(m[1]);
      if (y < 200) y += 1911;
      return ymd(new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[3]))));
    }
    return "";
  }
  function addDay(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return ymd(new Date(Date.UTC(y, m - 1, d + 1)));
  }
  function md(iso) {
    return iso ? iso.slice(5) : "";
  }
  function marketOf(s) {
    const t = String(s || "");
    for (const [name, re] of MARKETS) if (re.test(t)) return name;
    return "";
  }
  function cropOf(s) {
    const t = String(s || "");
    if (/鐵架/.test(t)) return "";
    for (const [name, re] of CROPS) if (re.test(t)) return name;
    return "";
  }
  function qtyOf(v) {
    const n = Number(String(v ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  function cell(r, i) {
    return Array.isArray(r) && r[i] != null ? r[i] : "";
  }
  function keyOf(r) {
    return `${r.dt}|${r.mk}|${r.crop}`;
  }

  function loadConfirms() {
    try {
      confirms = JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {};
    } catch (_) {
      confirms = {};
    }
  }
  function saveConfirms() {
    confirms = {};
    for (const r of rows) {
      if (r.ok || r.note) confirms[keyOf(r)] = { ok: !!r.ok, note: r.note || "" };
    }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(confirms));
    } catch (_) {}
  }

  async function uploadParse(file) {
    const data =
      typeof bufToB64 === "function"
        ? bufToB64(await file.arrayBuffer())
        : btoa(String.fromCharCode(...new Uint8Array(await file.arrayBuffer())));
    const r = await fetch("./api/xlsx-parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, data }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.error || "解析失敗");
    return j;
  }

  function parseHongan(sheets) {
    const out = [];
    for (const sh of sheets || []) {
      for (const r of sh.rows || []) {
        const dtRaw = parseDate(cell(r, 0));
        if (!dtRaw) continue;
        const spec = String(cell(r, 4) || cell(r, 3) || "");
        const crop = cropOf(spec);
        if (!crop) continue;
        let mk = marketOf(spec) || marketOf(cell(r, 3));
        if (!mk && crop === "高麗") mk = "一市";
        if (!mk) continue;
        out.push({ dt: addDay(dtRaw), mk, crop, qty: qtyOf(cell(r, 5) || cell(r, 6)) });
      }
    }
    return out;
  }

  function parsePay(sheets) {
    const out = [];
    for (const sh of sheets || []) {
      const data = sh.rows || [];
      let header = -1;
      for (let i = 0; i < Math.min(30, data.length); i++) {
        const line = (data[i] || []).join(" ");
        if (/日期/.test(line) && /市場/.test(line) && /品名/.test(line)) {
          header = i;
          break;
        }
      }
      if (header < 0) continue;
      const heads = (data[header] || []).map((x) => String(x || ""));
      const iDate = heads.findIndex((h) => h.includes("日期"));
      const iMk = heads.findIndex((h) => h.includes("市場"));
      const iName = heads.findIndex((h) => h.includes("品名"));
      const iQty = heads.findIndex((h) => /件|數量/.test(h));
      for (let i = header + 1; i < data.length; i++) {
        const r = data[i] || [];
        const dt = parseDate(cell(r, iDate));
        if (!dt) continue;
        const mk = marketOf(cell(r, iMk));
        const crop = cropOf(cell(r, iName));
        if (!mk || !crop) continue;
        out.push({ dt, mk, crop, qty: qtyOf(cell(r, iQty >= 0 ? iQty : 5)) });
      }
    }
    return out;
  }

  function agg(list) {
    const m = new Map();
    for (const x of list) {
      const k = `${x.dt}|${x.mk}|${x.crop}`;
      m.set(k, (m.get(k) || 0) + x.qty);
    }
    return m;
  }

  function buildDiffs(hList, pList) {
    const H = agg(hList);
    const P = agg(pList);
    const keys = new Set([...H.keys(), ...P.keys()]);
    const diff = [];
    for (const k of keys) {
      const h = H.get(k) || 0;
      const p = P.get(k) || 0;
      if (h === p) continue;
      const [dt, mk, crop] = k.split("|");
      const saved = confirms[k] || {};
      diff.push({ dt, mk, crop, h, p, d: p - h, ok: !!saved.ok, note: saved.note || "" });
    }
    diff.sort((a, b) => a.dt.localeCompare(b.dt) || a.mk.localeCompare(b.mk) || a.crop.localeCompare(b.crop));
    return diff;
  }

  function visible() {
    if (view === "ok") return rows.filter((r) => r.ok);
    if (view === "pending") return rows.filter((r) => !r.ok);
    return rows;
  }

  function pendingCsv() {
    const pend = rows.filter((r) => !r.ok);
    const lines = ["貨款日,市場,品項,鴻安件,貨款件,差,備註"];
    for (const r of pend) {
      lines.push([md(r.dt), r.mk, r.crop, r.h, r.p, r.d, String(r.note || "").replace(/,/g, "，")].join(","));
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "拍賣帳款-待對方核對.csv";
    a.click();
  }

  async function runCompare() {
    const hf = document.getElementById("ap-hongan")?.files?.[0];
    const pf = document.getElementById("ap-pay")?.files?.[0];
    if (!hf || !pf) {
      msg = "請選鴻安與貨款兩份檔。";
      renderAuctionPay();
      return;
    }
    msg = "正在比對…";
    renderAuctionPay();
    try {
      loadConfirms();
      honganName = hf.name;
      payName = pf.name;
      const [hj, pj] = await Promise.all([uploadParse(hf), uploadParse(pf)]);
      const hList = parseHongan(hj.sheets);
      const pList = parsePay(pj.sheets);
      rows = buildDiffs(hList, pList);
      view = "pending";
      saveConfirms();
      msg = `鴻安 ${hList.length} 列、貨款 ${pList.length} 列。差異 ${rows.length} 筆。勾「沒問題」後，剩下給對方核對。`;
    } catch (err) {
      msg = String(err.message || err);
    }
    renderAuctionPay();
  }

  function bindOnce() {
    if (bound) return;
    bound = true;
    const root = document.getElementById("ap-root");
    if (!root) return;
    root.addEventListener("click", (e) => {
      if (e.target.closest("#ap-run")) {
        runCompare();
        return;
      }
      if (e.target.closest("#ap-csv")) {
        pendingCsv();
        return;
      }
      if (e.target.closest("#ap-print")) {
        view = "pending";
        renderAuctionPay();
        window.print();
        return;
      }
      if (e.target.closest("#ap-ok-all")) {
        for (const r of visible()) r.ok = true;
        saveConfirms();
        renderAuctionPay();
        return;
      }
      const f = e.target.closest("[data-ap-view]");
      if (f) {
        view = f.dataset.apView || "pending";
        renderAuctionPay();
      }
    });
    root.addEventListener("change", (e) => {
      if (e.target.id === "ap-hongan") {
        honganName = e.target.files?.[0]?.name || "";
        const lab = document.getElementById("ap-hongan-lab");
        if (lab) lab.textContent = honganName || "尚未選檔";
        return;
      }
      if (e.target.id === "ap-pay") {
        payName = e.target.files?.[0]?.name || "";
        const lab = document.getElementById("ap-pay-lab");
        if (lab) lab.textContent = payName || "尚未選檔";
        return;
      }
      const tr = e.target.closest("tr[data-ap-k]");
      if (!tr) return;
      const r = rows.find((x) => keyOf(x) === tr.dataset.apK);
      if (!r) return;
      if (e.target.classList.contains("ap-check")) r.ok = e.target.checked;
      if (e.target.classList.contains("ap-note")) r.note = e.target.value.trim();
      saveConfirms();
      renderAuctionPay();
    });
  }

  function renderAuctionPay() {
    bindOnce();
    const root = document.getElementById("ap-root");
    if (!root) return;
    if (!root.querySelector("#ap-run")) {
      root.innerHTML = `
      <header class="ap-head">
        <h2>拍賣帳款核對</h2>
        <p>上傳鴻安與貨款。鴻安當日＝貨款隔日（8/31＝9/1）。差＝貨款−鴻安。鐵架不列入。勾「沒問題」後，剩下可匯出給對方核對。有問題整列紅底＋「有問題」字樣。</p>
      </header>
      <div class="ap-files">
        <label class="ap-file">鴻安 XLS
          <input type="file" id="ap-hongan" accept=".xls,.xlsx" />
          <span class="muted" id="ap-hongan-lab">尚未選檔</span>
        </label>
        <label class="ap-file">貨款 XLSX
          <input type="file" id="ap-pay" accept=".xls,.xlsx" />
          <span class="muted" id="ap-pay-lab">尚未選檔</span>
        </label>
      </div>
      <div class="ap-tools">
        <button type="button" class="primary" id="ap-run">開始比對</button>
        <button type="button" class="ghost noprint" id="ap-ok-all">目前畫面全標沒問題</button>
        <button type="button" class="ghost noprint" id="ap-csv">匯出待核對 CSV</button>
        <button type="button" class="ghost noprint" id="ap-print">列印待核對（可存 PDF）</button>
      </div>
      <p class="ap-msg" id="ap-msg"></p>
      <div id="ap-body"></div>`;
    }
    const hLab = document.getElementById("ap-hongan-lab");
    const pLab = document.getElementById("ap-pay-lab");
    if (hLab) hLab.textContent = honganName || "尚未選檔";
    if (pLab) pLab.textContent = payName || "尚未選檔";
    const msgEl = document.getElementById("ap-msg");
    if (msgEl) msgEl.textContent = msg;
    const body = document.getElementById("ap-body");
    if (!body) return;
    const okN = rows.filter((r) => r.ok).length;
    const pendN = rows.length - okN;
    const vis = visible();
    const kpi = rows.length
      ? `<div class="ap-kpis">
          <div class="ap-kpi"><strong>${rows.length}</strong><span>差異列</span></div>
          <div class="ap-kpi"><strong>${okN}</strong><span>已確認沒問題</span></div>
          <div class="ap-kpi is-bad"><strong>${pendN}</strong><span>待對方核對</span></div>
        </div>`
      : "";
    const table = vis.length
      ? `<div class="ap-sheet-wrap"><table class="ap-sheet">
        <thead><tr>
          <th class="noprint">沒問題</th>
          <th>狀態</th>
          <th>貨款日</th><th>市場</th><th>品項</th>
          <th>鴻安件</th><th>貨款件</th><th>差</th>
          <th class="noprint">備註</th>
        </tr></thead>
        <tbody>${vis
          .map((r) => {
            const k = keyOf(r);
            const dtxt = `${r.d > 0 ? "+" : ""}${r.d}`;
            return `<tr class="${r.ok ? "is-ok" : "is-bad"}" data-ap-k="${esc(k)}">
              <td class="noprint"><input class="ap-check" type="checkbox" ${r.ok ? "checked" : ""} /></td>
              <td>${r.ok ? '<span class="ap-okmark">沒問題</span>' : '<span class="ap-mark">有問題</span>'}</td>
              <td>${esc(md(r.dt))}</td>
              <td>${esc(r.mk)}</td>
              <td>${esc(r.crop)}</td>
              <td class="num">${r.h}</td>
              <td class="num">${r.p}</td>
              <td class="num ap-diff">${dtxt}</td>
              <td class="noprint"><input class="ap-note" value="${esc(r.note)}" placeholder="備註" /></td>
            </tr>`;
          })
          .join("")}</tbody></table></div>`
      : rows.length
        ? `<p class="muted">${view === "pending" ? "沒問題的都勾完了，沒有待核對。" : "這個篩選沒有列。"}</p>`
        : "";
    body.innerHTML = `
      ${kpi}
      ${
        rows.length
          ? `<div class="ap-filters noprint">
              <button type="button" class="pick${view === "pending" ? " on" : ""}" data-ap-view="pending">待對方核對</button>
              <button type="button" class="pick${view === "ok" ? " on" : ""}" data-ap-view="ok">已確認沒問題</button>
              <button type="button" class="pick${view === "all" ? " on" : ""}" data-ap-view="all">全部差異</button>
            </div>`
          : ""
      }
      ${table}
    `;
  }

  loadConfirms();
  window.renderAuctionPay = renderAuctionPay;
})();
