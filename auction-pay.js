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
    ["辣椒紅小", /辣椒紅小|紅小/],
    ["朝天椒", /朝天|辣椒小/],
    ["南瓜", /南瓜/],
    ["牛蒡", /牛蒡/],
    ["青花", /青花/],
    ["洋蔥本產", /洋蔥.*本產|本產.*洋蔥/],
    ["洋蔥進口", /洋蔥.*(進口|紐西蘭|日本)|進口.*洋蔥/],
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
    let m = s.match(/(\d{2,4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
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
    if (/洋蔥/.test(t)) return /本產/.test(t) ? "洋蔥本產" : "洋蔥進口";
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

  function toB64(buf) {
    if (typeof bufToB64 === "function") return bufToB64(buf);
    const u8 = new Uint8Array(buf);
    const chunk = 0x8000;
    let s = "";
    for (let i = 0; i < u8.length; i += chunk) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    }
    return btoa(s);
  }
  async function uploadParse(file) {
    const data = toB64(await file.arrayBuffer());
    const r = await fetch("./api/xlsx-parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, data }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.error || "解析失敗");
    return j;
  }
  function sheetsOf(json) {
    return (json?.sheets || []).map((sh) => ({
      name: sh.name || "",
      rows: sh.rows || sh.data || [],
    }));
  }

  function sheetText(sheets) {
    return (sheets || [])
      .map((sh) =>
        (sh.rows || [])
          .slice(0, 20)
          .map((r) => (r || []).join(" "))
          .join(" "),
      )
      .join(" ");
  }
  function looksPay(name, sheets) {
    const n = String(name || "");
    const t = sheetText(sheets);
    if (/貨款|付款單|拍賣結算/.test(n + t)) return true;
    if (/銷售明細|單據日期|品名規格/.test(t)) return false;
    return /市場/.test(t) && /品名/.test(t) && /件數/.test(t);
  }
  function looksHongan(name, sheets) {
    const n = String(name || "");
    const t = sheetText(sheets);
    return /鴻安|銷售明細|單據日期|品名規格/.test(n + t);
  }

  function parseHongan(sheets) {
    const out = [];
    for (const sh of sheets || []) {
      const data = sh.rows || [];
      let iSpec = 4;
      let iQty = 5;
      for (const r of data.slice(0, 12)) {
        const heads = (r || []).map((x) => String(x || "").replace(/\s+/g, ""));
        const s = heads.findIndex((h) => /品名規格|品名/.test(h));
        const q = heads.findIndex((h) => /數量|件數/.test(h) && !/金額/.test(h));
        if (s >= 0) {
          iSpec = s;
          if (q >= 0) iQty = q;
          break;
        }
      }
      let cur = "";
      for (const r of data) {
        const rowText = (r || []).map((c) => String(c ?? "")).join(" ");
        const dayHit = parseDate(rowText);
        if (/單據日期/.test(rowText) && dayHit) cur = dayHit;
        else if (!cur && /日期/.test(rowText) && dayHit && !/區間|製表/.test(rowText)) cur = dayHit;
        let spec = String(cell(r, iSpec) || "");
        let crop = cropOf(spec);
        if (!crop) {
          spec = (r || []).map((c) => String(c ?? "")).find((x) => cropOf(x)) || "";
          crop = cropOf(spec);
        }
        if (!crop || !cur) continue;
        let mk = marketOf(spec) || marketOf(cell(r, 3)) || marketOf(rowText);
        if (!mk && crop === "高麗") mk = "一市";
        if (!mk) continue;
        const q = qtyOf(cell(r, iQty)) || qtyOf(cell(r, iSpec + 1));
        if (!q) continue;
        out.push({ dt: addDay(cur), mk, crop, qty: q });
      }
    }
    return out;
  }

  function parsePay(sheets) {
    const out = [];
    for (const sh of sheets || []) {
      const data = sh.rows || [];
      let header = -1;
      for (let i = 0; i < Math.min(40, data.length); i++) {
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
      const iQty = heads.findIndex((h) => /件數|數量/.test(h));
      for (let i = header + 1; i < data.length; i++) {
        const r = data[i] || [];
        const dt = parseDate(cell(r, iDate));
        if (!dt) continue;
        const mk = marketOf(cell(r, iMk));
        const crop = cropOf(cell(r, iName));
        if (!mk || !crop) continue;
        const q = qtyOf(cell(r, iQty >= 0 ? iQty : 4));
        if (!q) continue;
        out.push({ dt, mk, crop, qty: q });
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

  function tableHeaders() {
    return ["貨款日", "市場", "品項", "鴻安件", "貨款件", "差", "備註"];
  }
  function tableCells(r) {
    return [md(r.dt), r.mk, r.crop, String(r.h), String(r.p), String(r.d), r.note || ""];
  }
  function tableTsv(list) {
    return [tableHeaders().join("\t"), ...list.map((r) => tableCells(r).join("\t"))].join("\n");
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return Promise.resolve();
  }
  async function copyTable(kind) {
    const list = kind === "all" ? rows : rows.filter((r) => !r.ok);
    if (!list.length) {
      msg = kind === "all" ? "目前沒有表格可複製。" : "沒有待核對列可複製。";
      renderAuctionPay();
      return;
    }
    const title = kind === "all" ? "拍賣帳款核對" : "拍賣帳款待對方核對";
    const text = `${title}\n${tableTsv(list)}`;
    try {
      await copyText(text);
      msg = `已複製 ${list.length} 列，可直接貼到 LINE。`;
    } catch (_) {
      msg = "這台無法自動複製，請用下面框手動全選。";
      const box = document.getElementById("ap-paste");
      if (box) {
        box.value = text;
        box.focus();
        box.select();
      }
    }
    renderAuctionPay();
  }
  function splitCells(line) {
    const s = String(line || "").replace(/\r/g, "").trim();
    if (!s) return [];
    if (s.includes("\t")) return s.split("\t").map((x) => x.trim());
    if (s.includes("|")) return s.split("|").map((x) => x.replace(/^\s*[-:]+\s*$/g, "").trim()).filter((x) => x !== "");
    if (s.includes(",")) return s.split(",").map((x) => x.trim());
    return s.split(/\s{2,}/).map((x) => x.trim()).filter(Boolean);
  }
  function headerIndex(cells) {
    const n = cells.map((c) => String(c || "").replace(/\s+/g, ""));
    const find = (...keys) => n.findIndex((h) => keys.some((k) => h.includes(k)));
    return {
      dt: find("貨款日", "日期"),
      mk: find("市場"),
      crop: find("品項", "品名"),
      h: find("鴻安"),
      p: find("貨款"),
      d: find("差"),
      note: find("備註"),
    };
  }
  function yearOf(iso) {
    const y = Number(String(iso || "").slice(0, 4));
    return y > 2000 ? y : new Date().getFullYear();
  }
  function pasteDate(v, yearHint) {
    const raw = parseDate(v);
    if (raw) return raw;
    const s = String(v || "").trim();
    const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})$/);
    if (!m) return "";
    const y = yearHint || new Date().getFullYear();
    return ymd(new Date(Date.UTC(y, Number(m[1]) - 1, Number(m[2]))));
  }
  function applyPasted(text) {
    const lines = String(text || "")
      .replace(/\r/g, "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^拍賣帳款/.test(l));
    if (!lines.length) {
      msg = "貼上區是空的。";
      renderAuctionPay();
      return;
    }
    let start = 0;
    let idx = { dt: 0, mk: 1, crop: 2, h: 3, p: 4, d: 5, note: 6 };
    const head = splitCells(lines[0]);
    const mapped = headerIndex(head);
    if (mapped.mk >= 0 && mapped.crop >= 0) {
      idx = mapped;
      start = 1;
    }
    const yearHint = rows[0]?.dt ? yearOf(rows[0].dt) : new Date().getFullYear();
    const got = [];
    for (const line of lines.slice(start)) {
      const c = splitCells(line);
      if (c.length < 3) continue;
      const dt = pasteDate(idx.dt >= 0 ? c[idx.dt] : c[0], yearHint);
      const mk = marketOf(idx.mk >= 0 ? c[idx.mk] : "") || marketOf(line);
      const crop = cropOf(idx.crop >= 0 ? c[idx.crop] : "") || cropOf(line);
      if (!dt || !mk || !crop) continue;
      const h = idx.h >= 0 ? qtyOf(c[idx.h]) : 0;
      const p = idx.p >= 0 ? qtyOf(c[idx.p]) : 0;
      const d = idx.d >= 0 && c[idx.d] != null && String(c[idx.d]).trim() !== "" ? qtyOf(c[idx.d]) : p - h;
      const note = idx.note >= 0 ? String(c[idx.note] || "").trim() : "";
      const saved = confirms[`${dt}|${mk}|${crop}`] || {};
      got.push({ dt, mk, crop, h, p, d, ok: !!saved.ok, note: note || saved.note || "" });
    }
    if (!got.length) {
      msg = "貼上的文字讀不成表格。請用「複製表格給 LINE」再貼回來試試。";
      renderAuctionPay();
      return;
    }
    const by = new Map(rows.map((r) => [keyOf(r), r]));
    for (const r of got) {
      const k = keyOf(r);
      const old = by.get(k);
      if (old) {
        old.note = r.note || old.note;
        if (r.h || r.p) {
          old.h = r.h;
          old.p = r.p;
          old.d = r.d;
        }
      } else {
        by.set(k, r);
      }
    }
    rows = [...by.values()].sort((a, b) => a.dt.localeCompare(b.dt) || a.mk.localeCompare(b.mk) || a.crop.localeCompare(b.crop));
    view = "pending";
    saveConfirms();
    msg = `已從 LINE／表格貼上 ${got.length} 列。`;
    const box = document.getElementById("ap-paste");
    if (box) box.value = "";
    renderAuctionPay();
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
      const parsed = await Promise.all([uploadParse(hf), uploadParse(pf)]);
      const scored = parsed.map((json, i) => {
        const sheets = sheetsOf(json);
        const h = parseHongan(sheets);
        const p = parsePay(sheets);
        const file = i === 0 ? hf : pf;
        return { file, sheets, h, p, name: file.name };
      });
      const hPack = scored[0].h.length >= scored[1].h.length ? scored[0] : scored[1];
      const pPack = hPack === scored[0] ? scored[1] : scored[0];
      honganName = hPack.file.name;
      payName = pPack.file.name;
      const hList = hPack.h;
      const pList = pPack.p;
      rows = buildDiffs(hList, pList);
      view = "pending";
      saveConfirms();
      const swapped = hPack.file !== hf;
      if (!hList.length || !pList.length) {
        const hint = scored
          .map((s) => `${s.name}（鴻安讀到 ${s.h.length}、貨款讀到 ${s.p.length}）`)
          .join("；");
        msg = `讀不到完整資料。${hint}。請確認是鴻安「日期別-銷售明細」和貨款「付款單」。`;
      } else {
        msg = `${swapped ? "已自動對調檔案。" : ""}鴻安 ${hList.length} 列、貨款 ${pList.length} 列。差異 ${rows.length} 筆。勾「沒問題」後，剩下給對方核對。`;
      }
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
      if (e.target.closest("#ap-copy-pending")) {
        copyTable("pending");
        return;
      }
      if (e.target.closest("#ap-copy-all")) {
        copyTable("all");
        return;
      }
      if (e.target.closest("#ap-paste-go")) {
        applyPasted(document.getElementById("ap-paste")?.value || "");
        return;
      }
      const f = e.target.closest("[data-ap-view]");
      if (f) {
        view = f.dataset.apView || "pending";
        renderAuctionPay();
      }
    });
    root.addEventListener("paste", (e) => {
      if (e.target.id !== "ap-paste") return;
      setTimeout(() => {
        const v = document.getElementById("ap-paste")?.value || "";
        if (v.trim()) applyPasted(v);
      }, 0);
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
    if (!root.querySelector("#ap-run") || !root.querySelector("#ap-paste")) {
      root.innerHTML = `
      <header class="ap-head">
        <h2>拍賣帳款核對</h2>
        <p>上傳鴻安銷售明細與貨款付款單（放反會自動對調）。鴻安當日＝貨款隔日（8/31＝9/1）。差＝貨款−鴻安。鐵架不列入。勾「沒問題」後，剩下可匯出給對方核對。有問題整列紅底＋「有問題」字樣。</p>
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
        <button type="button" class="ghost noprint" id="ap-copy-pending">複製待核對到 LINE</button>
        <button type="button" class="ghost noprint" id="ap-copy-all">複製全部表格</button>
      </div>
      <div class="ap-linebox noprint">
        <label for="ap-paste">LINE 複製表格後貼這裡（或從 Excel 貼上）</label>
        <textarea id="ap-paste" placeholder="在 LINE 長按複製表格，貼到這裡後按「貼上成表格」。"></textarea>
        <div class="ap-tools" style="margin:0">
          <button type="button" class="primary" id="ap-paste-go">貼上成表格</button>
        </div>
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
