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
    ["高麗/甘藍", /高麗|甘藍/],
    ["大白菜", /大白菜|包心白/],
    ["辣椒紅小", /紅小/],
    ["朝天椒", /朝天/],
    ["南瓜", /南瓜/],
    ["牛蒡", /牛蒡/],
    ["青花", /青花/],
    ["洋蔥本產", /洋蔥.*本產|本產.*洋蔥/],
    ["洋蔥進口", /洋蔥.*(進口|紐西蘭|日本|澳洲|韓國)|進口.*洋蔥/],
  ];
  const LS_KEY = "auction-pay-confirm-v1";

  let bound = false;
  let view = "pending";
  let honganName = "";
  let payName = "";
  let rows = [];
  let confirms = {};
  let msg = "";
  let pickKeys = new Set();
  let pageMode = "work";
  let job = "qty";
  let netRows = [];
  let netView = "all";
  let sessionId = "";
  let hCount = 0;
  let pCount = 0;
  let hist = [];
  let histQ = { month: "", mk: "", crop: "", st: "all", text: "", latest: true };
  let histOpen = "";

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
    if (/高麗|甘藍/.test(t)) return "高麗/甘藍";
    if (/大白菜|包心白/.test(t)) return "大白菜";
    if (/紅小/.test(t)) return "辣椒紅小";
    if (/朝天/.test(t)) return "朝天椒";
    if (/辣椒/.test(t) && /小/.test(t) && !/大/.test(t)) return "朝天椒";
    if (/辣椒/.test(t)) return "辣椒紅小";
    if (/南瓜/.test(t)) return "南瓜";
    if (/牛蒡/.test(t)) return "牛蒡";
    if (/青花/.test(t)) return "青花";
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
  function whoNow() {
    try {
      return typeof currentStaff === "function" ? String(currentStaff() || "").trim() : "";
    } catch (_) {
      return "";
    }
  }
  function sessionPayload() {
    return {
      id: sessionId || `ap-${Date.now()}`,
      at: Date.now(),
      by: whoNow(),
      honganName,
      payName,
      hCount,
      pCount,
      rows: rows.map((r) => ({ dt: r.dt, mk: r.mk, crop: r.crop, h: r.h, p: r.p, d: r.d, ok: !!r.ok, note: r.note || "" })),
    };
  }
  async function saveSession() {
    if (!rows.length) return;
    const payload = sessionPayload();
    sessionId = payload.id;
    try {
      const r = await fetch("./api/auction-pay/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (j.id) sessionId = j.id;
    } catch (_) {}
  }
  async function loadHistory() {
    try {
      const r = await fetch("./api/auction-pay/history");
      const j = await r.json().catch(() => ({}));
      hist = Array.isArray(j.sessions) ? j.sessions : [];
    } catch (_) {
      hist = [];
    }
  }
  function whenTxt(at) {
    const n = Number(at) || 0;
    if (!n) return "";
    const d = new Date(n);
    const p = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function histFlat() {
    const list = [];
    const seen = new Set();
    for (const s of hist) {
      for (const r of s.rows || []) {
        const k = `${r.dt}|${r.mk}|${r.crop}`;
        if (histQ.latest && seen.has(k)) continue;
        seen.add(k);
        list.push({ ...r, sid: s.id, at: s.at, by: s.by, honganName: s.honganName, payName: s.payName });
      }
    }
    return list.filter((r) => {
      if (histQ.month && String(r.dt || "").slice(0, 7) !== histQ.month) return false;
      if (histQ.mk && r.mk !== histQ.mk) return false;
      if (histQ.crop && r.crop !== histQ.crop) return false;
      if (histQ.st === "ok" && !r.ok) return false;
      if (histQ.st === "pending" && r.ok) return false;
      if (histQ.text) {
        const t = histQ.text.toLowerCase();
        const blob = `${r.dt} ${r.mk} ${r.crop} ${r.note || ""} ${r.by || ""} ${r.honganName || ""} ${r.payName || ""}`.toLowerCase();
        if (!blob.includes(t)) return false;
      }
      return true;
    });
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

  function isKgUnit(s) {
    return /公斤|kg|公噸|重量/i.test(String(s || ""));
  }
  function isPieceUnit(s) {
    return /件|包|籃|箱|袋/.test(String(s || ""));
  }
  function honganQty(r, cols) {
    if (cols.iPcs >= 0) {
      const pcs = qtyOf(cell(r, cols.iPcs));
      if (pcs) return pcs;
    }
    const unit = cols.iUnit >= 0 ? String(cell(r, cols.iUnit) || "") : "";
    if (isKgUnit(unit)) return 0;
    const q = cols.iQty >= 0 ? qtyOf(cell(r, cols.iQty)) : qtyOf(cell(r, cols.iSpec + 1));
    if (!q) return 0;
    if (!unit || isPieceUnit(unit)) return q;
    return 0;
  }
  function parseHongan(sheets) {
    const out = [];
    for (const sh of sheets || []) {
      const data = sh.rows || [];
      let cols = { iSpec: 4, iQty: 5, iPcs: -1, iUnit: -1 };
      for (const r of data.slice(0, 12)) {
        const heads = (r || []).map((x) => String(x || "").replace(/\s+/g, ""));
        const s = heads.findIndex((h) => /品名規格|品名/.test(h));
        if (s < 0) continue;
        const iPcs = heads.findIndex((h) => /件數|包裝數|包數/.test(h) && !/金額|單價/.test(h));
        const iQty = heads.findIndex((h) => /數量/.test(h) && !/金額/.test(h));
        const iUnit = heads.findIndex((h) => /單位/.test(h));
        cols = { iSpec: s, iQty: iQty >= 0 ? iQty : s + 1, iPcs, iUnit };
        break;
      }
      let cur = "";
      for (const r of data) {
        const rowText = (r || []).map((c) => String(c ?? "")).join(" ");
        const dayHit = parseDate(rowText);
        if (/單據日期/.test(rowText) && dayHit) cur = dayHit;
        else if (!cur && /日期/.test(rowText) && dayHit && !/區間|製表/.test(rowText)) cur = dayHit;
        let spec = String(cell(r, cols.iSpec) || "");
        let crop = cropOf(spec);
        if (!crop) {
          spec = (r || []).map((c) => String(c ?? "")).find((x) => cropOf(x)) || "";
          crop = cropOf(spec);
        }
        if (!crop || !cur) continue;
        let mk = marketOf(spec) || marketOf(cell(r, 3)) || marketOf(rowText);
        if (!mk && /高麗/.test(crop)) mk = "一市";
        if (!mk) continue;
        const q = honganQty(r, cols);
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

  function prevDay(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return ymd(new Date(Date.UTC(y, m - 1, d - 1)));
  }
  function round2(n) {
    return Math.round(Number(n) * 100) / 100;
  }
  function moneyTxt(n) {
    const x = round2(n);
    const digits = Math.abs(x - Math.round(x)) < 0.001 ? 0 : 2;
    return x.toLocaleString("zh-TW", { minimumFractionDigits: digits, maximumFractionDigits: 2 });
  }
  function gapTxt(n) {
    const x = round2(n);
    if (Math.abs(x) < 0.005) return "0";
    const t = moneyTxt(Math.abs(x));
    return x > 0 ? `+${t}` : `−${t}`;
  }
  function dayTxt(iso) {
    if (!iso) return "";
    const [, m, d] = iso.split("-").map(Number);
    return `${m}/${d}`;
  }
  function parseYongfang(sheets) {
    const out = [];
    for (const sh of sheets || []) {
      const data = sh.rows || [];
      let iSpec = 4;
      let iQty = 5;
      let iAmt = 8;
      for (const r of data.slice(0, 12)) {
        const heads = (r || []).map((x) => String(x || "").replace(/\s+/g, ""));
        const s = heads.findIndex((h) => /品名規格/.test(h));
        if (s < 0) continue;
        const iAmtH = heads.findIndex((h) => /稅前金額/.test(h));
        const iQtyH = heads.findIndex((h) => /數量/.test(h) && !/金額/.test(h));
        iSpec = s;
        iQty = iQtyH >= 0 ? iQtyH : s + 1;
        iAmt = iAmtH >= 0 ? iAmtH : 8;
        break;
      }
      let cur = "";
      for (const r of data) {
        const rowText = (r || []).map((c) => String(c ?? "")).join(" ");
        if (/單據日期/.test(rowText)) {
          const day = parseDate(rowText);
          if (day) cur = day;
          continue;
        }
        const spec = String(cell(r, iSpec) || "");
        if (!spec || /合計|鐵架|品名規格/.test(spec) || !cur) continue;
        const qty = qtyOf(cell(r, iQty));
        const amt = qtyOf(cell(r, iAmt));
        if (!qty && !amt) continue;
        out.push({ dt: cur, mk: marketOf(spec) || "未分", amt });
      }
    }
    return out;
  }
  function parsePayNet(sheets) {
    const out = [];
    for (const sh of sheets || []) {
      const data = sh.rows || [];
      let header = -1;
      for (let i = 0; i < Math.min(40, data.length); i++) {
        const heads = (data[i] || []).map((x) => String(x || "").trim());
        if (heads.some((h) => h.includes("日期")) && heads.some((h) => h.includes("實拿"))) {
          header = i;
          break;
        }
      }
      if (header < 0) continue;
      const heads = (data[header] || []).map((x) => String(x || "").trim());
      const iDate = heads.findIndex((h) => h.includes("日期"));
      const iMk = heads.findIndex((h) => h.includes("市場"));
      const iName = heads.findIndex((h) => h.includes("品名"));
      const iAmt = heads.findIndex((h) => h.includes("金額") && !h.includes("實"));
      const iFee = heads.findIndex((h) => h.includes("手續費"));
      const iFr = heads.findIndex((h) => h.includes("運費"));
      const iNet = heads.findIndex((h) => h.includes("實拿"));
      for (let i = header + 1; i < data.length; i++) {
        const r = data[i] || [];
        const dt = parseDate(cell(r, iDate));
        if (!dt) continue;
        const name = String(cell(r, iName >= 0 ? iName : 3) || "");
        if (/合計/.test(name) || /合計/.test((r || []).join(" "))) continue;
        const amt = iAmt >= 0 ? qtyOf(cell(r, iAmt)) : 0;
        const fee = iFee >= 0 ? qtyOf(cell(r, iFee)) : 0;
        const fr = iFr >= 0 ? qtyOf(cell(r, iFr)) : 0;
        let net = iNet >= 0 ? qtyOf(cell(r, iNet)) : 0;
        if (!net && (amt || fee || fr)) net = round2(amt - fee - fr);
        if (!name && !net && !amt) continue;
        out.push({ dt, mk: marketOf(cell(r, iMk)) || marketOf(name) || "未分", net });
      }
    }
    return out;
  }
  function marketNote(ym, pm) {
    const keys = new Set([...ym.keys(), ...pm.keys()]);
    const bits = [];
    for (const mk of keys) {
      const gap = round2((pm.get(mk) || 0) - (ym.get(mk) || 0));
      if (Math.abs(gap) < 1) continue;
      bits.push(`${mk} ${gapTxt(gap)}`);
    }
    return bits.join("、");
  }
  function buildNetDays(yList, pList) {
    const Y = new Map();
    const P = new Map();
    for (const x of yList) {
      if (!Y.has(x.dt)) Y.set(x.dt, new Map());
      const m = Y.get(x.dt);
      m.set(x.mk, round2((m.get(x.mk) || 0) + x.amt));
    }
    for (const x of pList) {
      if (!P.has(x.dt)) P.set(x.dt, new Map());
      const m = P.get(x.dt);
      m.set(x.mk, round2((m.get(x.mk) || 0) + x.net));
    }
    const ships = new Set(Y.keys());
    for (const bill of P.keys()) ships.add(prevDay(bill));
    return [...ships]
      .sort()
      .map((ship) => {
        const bill = addDay(ship);
        const ym = Y.get(ship) || new Map();
        const pm = P.get(bill) || new Map();
        let mine = 0;
        let theirs = 0;
        for (const v of ym.values()) mine += v;
        for (const v of pm.values()) theirs += v;
        mine = round2(mine);
        theirs = round2(theirs);
        const d = round2(theirs - mine);
        const bad = Math.abs(d) >= 1;
        return { ship, bill, mine, theirs, d, bad, note: bad ? marketNote(ym, pm) : "" };
      })
      .filter((r) => r.mine || r.theirs);
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
      if (saved.ok) pickKeys.delete(`${dt}|${mk}|${crop}`);
    }
    diff.sort((a, b) => a.dt.localeCompare(b.dt) || a.mk.localeCompare(b.mk) || a.crop.localeCompare(b.crop));
    return diff;
  }

  function visible() {
    if (job === "net") {
      if (netView === "bad") return netRows.filter((r) => r.bad);
      return netRows;
    }
    if (view === "ok") return rows.filter((r) => r.ok);
    if (view === "pending") return rows.filter((r) => !r.ok);
    return rows;
  }

  function tableHeaders() {
    if (job === "net") return ["我的寄件日", "對方貨款日", "我的金額", "對方實拿", "差額", "結果", "說明"];
    return ["貨款日", "市場", "品項", "鴻安件", "貨款件", "差", "備註"];
  }
  function netResult(r) {
    if (!r.bad) return "相符";
    return r.d > 0 ? "少登" : "多登";
  }
  function tableCells(r) {
    if (job === "net") return [dayTxt(r.ship), dayTxt(r.bill), moneyTxt(r.mine), moneyTxt(r.theirs), gapTxt(r.d), netResult(r), r.note || ""];
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
  function hideCopyOut() {
    const wrap = document.getElementById("ap-copy-wrap");
    const box = document.getElementById("ap-copy-out");
    if (wrap) wrap.hidden = true;
    if (box) {
      box.value = "";
      box.hidden = true;
    }
  }
  function showCopyOut(text) {
    const wrap = document.getElementById("ap-copy-wrap");
    const box = document.getElementById("ap-copy-out");
    if (wrap) wrap.hidden = false;
    if (box) {
      box.hidden = false;
      box.value = text;
      box.focus();
      box.select();
    }
  }
  async function copyTable(kind) {
    const src = job === "net" ? netRows : rows;
    const list = kind === "all" ? src : src.filter((r) => (job === "net" ? r.bad : !r.ok));
    if (!list.length) {
      msg = kind === "all" ? "目前沒有表格可複製。" : job === "net" ? "沒有金額對不上的天。" : "沒有待核對列可複製。";
      hideCopyOut();
      renderAuctionPay();
      return;
    }
    const title = job === "net" ? (kind === "all" ? "拍賣貨款實拿核帳" : "拍賣貨款實拿有差") : kind === "all" ? "拍賣帳款核對" : "拍賣帳款待對方核對";
    const text = `${title}\n${tableTsv(list)}`;
    try {
      await copyText(text);
      msg = `已複製 ${list.length} 列，可直接貼到 LINE。`;
      hideCopyOut();
    } catch (_) {
      msg = `已備妥 ${list.length} 列，請在框裡全選後貼到 LINE，或按取消關掉。`;
      showCopyOut(text);
    }
    renderAuctionPay();
    if (msg.includes("備妥")) showCopyOut(text);
    else hideCopyOut();
  }

  function downloadXls(list, filename) {
    if (!list.length) {
      msg = "沒有可下載的列。";
      renderAuctionPay();
      return;
    }
    const th = tableHeaders().map((h) => `<th>${esc(h)}</th>`).join("");
    const trs = list
      .map((r) => `<tr>${tableCells(r).map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
      .join("");
    const html = `\uFEFF<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><tr>${th}</tr>${trs}</table></body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
    a.click();
    msg = `已下載 Excel（${list.length} 列），可直接用 Excel 打開。`;
    renderAuctionPay();
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
      hCount = hList.length;
      pCount = pList.length;
      sessionId = `ap-${Date.now()}`;
      view = "pending";
      pageMode = "work";
      saveConfirms();
      await saveSession();
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

  async function runNetCompare() {
    const hf = document.getElementById("ap-hongan")?.files?.[0];
    const pf = document.getElementById("ap-pay")?.files?.[0];
    if (!hf || !pf) {
      msg = "請選永芳與貨款兩份檔。";
      renderAuctionPay();
      return;
    }
    msg = "正在比對實拿…";
    renderAuctionPay();
    try {
      const parsed = await Promise.all([uploadParse(hf), uploadParse(pf)]);
      const scored = parsed.map((json, i) => {
        const sheets = sheetsOf(json);
        const file = i === 0 ? hf : pf;
        return { file, y: parseYongfang(sheets), p: parsePayNet(sheets), name: file.name };
      });
      const yPack = scored[0].y.length >= scored[1].y.length ? scored[0] : scored[1];
      const pPack = yPack === scored[0] ? scored[1] : scored[0];
      honganName = yPack.file.name;
      payName = pPack.file.name;
      netRows = buildNetDays(yPack.y, pPack.p);
      netView = "all";
      pageMode = "work";
      const bad = netRows.filter((r) => r.bad);
      const short = round2(bad.filter((r) => r.d > 0).reduce((s, r) => s + r.d, 0));
      if (!yPack.y.length || !pPack.p.length) {
        msg = `讀不到完整資料。${scored.map((s) => `${s.name}（永芳 ${s.y.length} 列、實拿 ${s.p.length} 列）`).join("；")}。請確認是永芳「日期別-銷售明細」和貨款「付款單」。`;
      } else {
        msg = `對方貨款日 = 我的寄件日 + 1 天。相符 ${netRows.length - bad.length} 天，有差 ${bad.length} 天${bad.length ? `，少登 ${moneyTxt(short)}` : ""}。`;
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
        if (job === "net") runNetCompare();
        else runCompare();
        return;
      }
      if (e.target.closest(".ap-xls-btn")) {
        const sess = pageMode === "hist" && histOpen ? hist.find((s) => s.id === histOpen) : null;
        const list = pageMode === "hist" ? (sess ? sess.rows || [] : histFlat()) : visible();
        downloadXls(
          list,
          pageMode === "hist"
            ? sess
              ? `拍賣帳款-${whenTxt(sess.at).replace(/[: ]/g, "")}`
              : "拍賣帳款-歷史反查"
            : job === "net"
              ? netView === "bad"
                ? "拍賣貨款實拿-有差"
                : "拍賣貨款實拿核帳"
              : view === "ok"
                ? "拍賣帳款-已確認"
                : "拍賣帳款-待對方核對",
        );
        return;
      }
      if (e.target.closest("#ap-print")) {
        if (job === "net") netView = "all";
        else view = "pending";
        renderAuctionPay();
        window.print();
        return;
      }
      if (e.target.closest("#ap-ok-all")) {
        for (const r of visible()) {
          if (!r.ok) pickKeys.add(keyOf(r));
        }
        renderAuctionPay();
        return;
      }
      if (e.target.closest("#ap-submit-ok")) {
        const picked = rows.filter((r) => !r.ok && pickKeys.has(keyOf(r)));
        if (!picked.length) {
          msg = "請先勾選沒問題的列，再按確認送出。";
          renderAuctionPay();
          return;
        }
        if (!window.confirm(`確認送出 ${picked.length} 列為沒問題？送出後才會從待核對拿掉。`)) return;
        for (const r of picked) {
          r.ok = true;
          pickKeys.delete(keyOf(r));
        }
        saveConfirms();
        msg = `已確認 ${picked.length} 列沒問題。剩下給對方核對。`;
        saveSession();
        renderAuctionPay();
        return;
      }
      if (e.target.closest("[data-ap-job]")) {
        job = e.target.closest("[data-ap-job]").dataset.apJob || "qty";
        if (job === "net") pageMode = "work";
        msg = "";
        renderAuctionPay();
        return;
      }
      if (e.target.closest("[data-ap-mode]")) {
        pageMode = e.target.closest("[data-ap-mode]").dataset.apMode || "work";
        if (pageMode === "hist") loadHistory().then(renderAuctionPay);
        else renderAuctionPay();
        return;
      }
      const openSess = e.target.closest("[data-ap-open]");
      if (openSess) {
        const id = openSess.dataset.apOpen || "";
        histOpen = histOpen === id ? "" : id;
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
      if (e.target.closest("#ap-copy-close")) {
        hideCopyOut();
        return;
      }
      const f = e.target.closest("[data-ap-view]");
      if (f) {
        if (job === "net") netView = f.dataset.apView || "all";
        else view = f.dataset.apView || "pending";
        renderAuctionPay();
      }
    });
    root.addEventListener("change", (e) => {
      if (e.target.id === "ap-hist-month") {
        histQ.month = e.target.value || "";
        renderAuctionPay();
        return;
      }
      if (e.target.id === "ap-hist-mk") {
        histQ.mk = e.target.value || "";
        renderAuctionPay();
        return;
      }
      if (e.target.id === "ap-hist-crop") {
        histQ.crop = e.target.value || "";
        renderAuctionPay();
        return;
      }
      if (e.target.id === "ap-hist-st") {
        histQ.st = e.target.value || "all";
        renderAuctionPay();
        return;
      }
      if (e.target.id === "ap-hist-latest") {
        histQ.latest = e.target.checked;
        renderAuctionPay();
        return;
      }
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
      if (e.target.classList.contains("ap-check")) {
        const k = keyOf(r);
        if (e.target.checked) pickKeys.add(k);
        else pickKeys.delete(k);
        tr.classList.toggle("is-pick", e.target.checked);
        tr.classList.toggle("is-bad", !e.target.checked);
        return;
      }
      if (e.target.classList.contains("ap-note")) {
        r.note = e.target.value.trim();
        saveConfirms();
        saveSession();
      }
    });
    root.addEventListener("input", (e) => {
      if (e.target.id !== "ap-hist-q") return;
      histQ.text = e.target.value.trim();
      renderAuctionPay();
    });
  }

  function fillSelect(id, values, current, allLab) {
    const el = document.getElementById(id);
    if (!el) return;
    const opts = [`<option value="">${allLab}</option>`]
      .concat(values.map((v) => `<option value="${esc(v)}"${v === current ? " selected" : ""}>${esc(v)}</option>`))
      .join("");
    if (el.innerHTML !== opts) el.innerHTML = opts;
    el.value = current || "";
  }
  function fillHistFilters() {
    const allRows = hist.flatMap((s) => s.rows || []);
    const months = [...new Set(allRows.map((r) => String(r.dt || "").slice(0, 7)).filter(Boolean))].sort().reverse();
    const mks = [...new Set(allRows.map((r) => r.mk).filter(Boolean))].sort();
    const crops = [...new Set(allRows.map((r) => r.crop).filter(Boolean))].sort();
    fillSelect("ap-hist-month", months, histQ.month, "全部月份");
    fillSelect("ap-hist-mk", mks, histQ.mk, "全部市場");
    fillSelect("ap-hist-crop", crops, histQ.crop, "全部品項");
    const st = document.getElementById("ap-hist-st");
    if (st) st.value = histQ.st || "all";
    const q = document.getElementById("ap-hist-q");
    if (q && document.activeElement !== q) q.value = histQ.text || "";
    const latest = document.getElementById("ap-hist-latest");
    if (latest) latest.checked = !!histQ.latest;
  }
  function histBodyHtml() {
    const sess = histOpen ? hist.find((s) => s.id === histOpen) : null;
    const sessCards = hist.length
      ? `<div class="ap-sess-list">${hist
          .map((s) => {
            const n = (s.rows || []).length;
            const okN = (s.rows || []).filter((r) => r.ok).length;
            const on = s.id === histOpen ? " on" : "";
            return `<button type="button" class="ap-sess${on}" data-ap-open="${esc(s.id)}">
              <strong>${esc(whenTxt(s.at))}</strong>
              <span>${esc(s.by || "未登入")} · 差異 ${n} · 已確認 ${okN}</span>
              <span class="muted">${esc(s.honganName || "")} × ${esc(s.payName || "")}</span>
            </button>`;
          })
          .join("")}</div>`
      : `<p class="muted">還沒有存過比對。先在「本次比對」按開始比對，整次會自動存到伺服器。</p>`;
    if (sess) {
      const vis = sess.rows || [];
      const table = vis.length
        ? `<div class="ap-sheet-wrap"><table class="ap-sheet">
        <thead><tr>
          <th>狀態</th><th>貨款日</th><th>市場</th><th>品項</th>
          <th>鴻安件</th><th>貨款件</th><th>差</th><th>備註</th>
        </tr></thead>
        <tbody>${vis
          .map((r) => {
            const dtxt = `${r.d > 0 ? "+" : ""}${r.d}`;
            return `<tr class="${r.ok ? "is-ok" : "is-bad"}">
              <td>${r.ok ? '<span class="ap-okmark">沒問題</span>' : '<span class="ap-mark">有問題</span>'}</td>
              <td>${esc(md(r.dt))}</td>
              <td>${esc(r.mk)}</td>
              <td>${esc(r.crop)}</td>
              <td class="num">${r.h}</td>
              <td class="num">${r.p}</td>
              <td class="num ap-diff">${dtxt}</td>
              <td>${esc(r.note || "")}</td>
            </tr>`;
          })
          .join("")}</tbody></table></div>`
        : `<p class="muted">這次比對沒有差異列。</p>`;
      return `${sessCards}<p class="muted">這是 ${esc(whenTxt(sess.at))} 整次比對（${esc(sess.by || "未登入")}）。再點同一筆可收合。</p>${table}`;
    }
    const vis = histFlat();
    const table = vis.length
      ? `<div class="ap-sheet-wrap"><table class="ap-sheet">
        <thead><tr>
          <th>狀態</th><th>貨款日</th><th>市場</th><th>品項</th>
          <th>鴻安件</th><th>貨款件</th><th>差</th><th>備註</th><th>存檔時間</th><th>人員</th>
        </tr></thead>
        <tbody>${vis
          .map((r) => {
            const dtxt = `${r.d > 0 ? "+" : ""}${r.d}`;
            return `<tr class="${r.ok ? "is-ok" : "is-bad"}">
              <td>${r.ok ? '<span class="ap-okmark">沒問題</span>' : '<span class="ap-mark">有問題</span>'}</td>
              <td>${esc(md(r.dt))}</td>
              <td>${esc(r.mk)}</td>
              <td>${esc(r.crop)}</td>
              <td class="num">${r.h}</td>
              <td class="num">${r.p}</td>
              <td class="num ap-diff">${dtxt}</td>
              <td>${esc(r.note || "")}</td>
              <td>${esc(whenTxt(r.at))}</td>
              <td>${esc(r.by || "")}</td>
            </tr>`;
          })
          .join("")}</tbody></table></div>`
      : hist.length
        ? `<p class="muted">這個篩選沒有列。點上方某一次比對可看整份。</p>`
        : "";
    return `${sessCards}${table}`;
  }
  function renderAuctionPay() {
    bindOnce();
    const root = document.getElementById("ap-root");
    if (!root) return;
    if (!root.querySelector("#ap-ui-v11")) {
      root.innerHTML = `
      <header class="ap-head">
        <span id="ap-ui-v11" hidden></span>
        <h2 id="ap-title">拍賣帳款核對</h2>
        <p id="ap-intro-qty">上傳兩份檔比對。先勾選沒問題的列（勾了不會消失），再按「確認送出無誤」。確認後可複製剩下的待核對資料貼到 LINE 給對方。歷史反查會把整次比對存在伺服器，各台平板登入後看到同一份。</p>
        <p id="ap-intro-net" hidden>上傳永芳銷售明細和貨款付款單。永芳金額是照貨款實拿登的。比對每天的實拿，金額對不上才標出來。</p>
      </header>
      <nav class="ap-filters noprint" id="ap-job-nav">
        <button type="button" class="pick" data-ap-job="qty">鴻安件數</button>
        <button type="button" class="pick" data-ap-job="net">實拿核帳</button>
      </nav>
      <p id="ap-rule" class="ap-rule" hidden>對方貨款日 = 我的寄件日 + 1 天。兩邊日期不同是正常的，只標金額不同。</p>
      <nav class="ap-filters noprint" id="ap-mode-nav">
        <button type="button" class="pick" data-ap-mode="work">本次比對</button>
        <button type="button" class="pick" data-ap-mode="hist">歷史反查</button>
      </nav>
      <div id="ap-work-pane">
        <div class="ap-files">
          <label class="ap-file"><span id="ap-file-a-lab">鴻安 XLS</span>
            <input type="file" id="ap-hongan" accept=".xls,.xlsx" />
            <span class="muted" id="ap-hongan-lab">尚未選檔</span>
          </label>
          <label class="ap-file"><span id="ap-file-b-lab">貨款 XLSX</span>
            <input type="file" id="ap-pay" accept=".xls,.xlsx" />
            <span class="muted" id="ap-pay-lab">尚未選檔</span>
          </label>
        </div>
        <div class="ap-tools">
          <button type="button" class="primary" id="ap-run">開始比對</button>
          <button type="button" class="ghost noprint ap-qty-only" id="ap-ok-all">全選目前畫面</button>
          <button type="button" class="ghost noprint ap-xls-btn">下載 Excel</button>
          <button type="button" class="ghost noprint" id="ap-print">列印</button>
          <button type="button" class="ghost noprint" id="ap-copy-pending">複製待對方核對</button>
          <button type="button" class="ghost noprint" id="ap-copy-all">複製全部</button>
        </div>
      </div>
      <div id="ap-hist-bar" class="ap-hist-bar noprint" hidden>
        <label>月份
          <select id="ap-hist-month"></select>
        </label>
        <label>市場
          <select id="ap-hist-mk"></select>
        </label>
        <label>品項
          <select id="ap-hist-crop"></select>
        </label>
        <label>狀態
          <select id="ap-hist-st">
            <option value="all">全部</option>
            <option value="pending">待核對</option>
            <option value="ok">已確認</option>
          </select>
        </label>
        <label>搜尋
          <input id="ap-hist-q" type="search" placeholder="日期／品項／檔名／人員" />
        </label>
        <label class="ap-hist-latest"><input id="ap-hist-latest" type="checkbox" checked />跨次搜尋只看最近一次</label>
        <button type="button" class="ghost ap-xls-btn">下載 Excel</button>
      </div>
      <div id="ap-copy-wrap" class="ap-copy-wrap noprint" hidden>
        <div class="ap-copy-head">
          <span>複製內容（可貼到 LINE）</span>
          <button type="button" class="ghost" id="ap-copy-close">取消</button>
        </div>
        <textarea id="ap-copy-out" readonly></textarea>
      </div>
      <p class="ap-msg" id="ap-msg"></p>
      <div id="ap-body"></div>`;
    }
    const hLab = document.getElementById("ap-hongan-lab");
    const pLab = document.getElementById("ap-pay-lab");
    if (hLab) hLab.textContent = honganName || "尚未選檔";
    if (pLab) pLab.textContent = payName || "尚未選檔";
    const title = document.getElementById("ap-title");
    if (title) title.textContent = job === "net" ? "拍賣貨款實拿核帳" : "拍賣帳款核對";
    const introQty = document.getElementById("ap-intro-qty");
    const introNet = document.getElementById("ap-intro-net");
    if (introQty) introQty.hidden = job === "net";
    if (introNet) introNet.hidden = job !== "net";
    const rule = document.getElementById("ap-rule");
    if (rule) rule.hidden = job !== "net";
    const aName = document.getElementById("ap-file-a-lab");
    const bName = document.getElementById("ap-file-b-lab");
    if (aName) aName.textContent = job === "net" ? "永芳（我的寄件）" : "鴻安 XLS";
    if (bName) bName.textContent = job === "net" ? "貨款（對方隔天）" : "貨款 XLSX";
    const copyPending = document.getElementById("ap-copy-pending");
    const copyAll = document.getElementById("ap-copy-all");
    if (copyPending) copyPending.textContent = job === "net" ? "複製有差" : "複製待對方核對";
    if (copyAll) copyAll.textContent = job === "net" ? "複製全部" : "複製全部差異";
    root.querySelectorAll(".ap-qty-only").forEach((el) => {
      el.hidden = job === "net";
    });
    const workPane = document.getElementById("ap-work-pane");
    const histBar = document.getElementById("ap-hist-bar");
    const modeNav = document.getElementById("ap-mode-nav");
    if (workPane) workPane.hidden = job !== "net" && pageMode === "hist";
    if (histBar) histBar.hidden = job === "net" || pageMode !== "hist";
    if (modeNav) modeNav.hidden = job === "net";
    root.querySelectorAll("[data-ap-job]").forEach((b) => {
      b.classList.toggle("on", b.dataset.apJob === job);
    });
    root.querySelectorAll("[data-ap-mode]").forEach((b) => {
      b.classList.toggle("on", b.dataset.apMode === pageMode);
    });
    if (pageMode === "hist" && job !== "net") fillHistFilters();
    const msgEl = document.getElementById("ap-msg");
    if (msgEl) msgEl.textContent = msg;
    const body = document.getElementById("ap-body");
    if (!body) return;
    if (pageMode === "hist" && job !== "net") {
      body.innerHTML = histBodyHtml();
      return;
    }
    if (job === "net") {
      const bad = netRows.filter((r) => r.bad);
      const okN = netRows.length - bad.length;
      const short = round2(bad.filter((r) => r.d > 0).reduce((s, r) => s + r.d, 0));
      const vis = visible();
      const kpi = netRows.length
        ? `<div class="ap-kpis">
            <div class="ap-kpi"><strong>${okN}</strong><span>金額相符（天）</span></div>
            <div class="ap-kpi is-bad"><strong>${bad.length}</strong><span>金額有差（天）</span></div>
            <div class="ap-kpi${short ? " is-bad" : ""}"><strong>${moneyTxt(short)}</strong><span>少登合計</span></div>
          </div>`
        : "";
      const table = vis.length
        ? `<div class="ap-sheet-wrap"><table class="ap-sheet">
          <thead><tr>
            <th>我的寄件日</th><th>對方貨款日</th>
            <th>我的金額</th><th>對方實拿</th><th>差額</th><th>結果</th><th>說明</th>
          </tr></thead>
          <tbody>${vis
            .map((r) => {
              return `<tr class="${r.bad ? "is-bad" : "is-match"}">
                <td>${esc(dayTxt(r.ship))}</td>
                <td>${esc(dayTxt(r.bill))}</td>
                <td class="num">${esc(moneyTxt(r.mine))}</td>
                <td class="num">${esc(moneyTxt(r.theirs))}</td>
                <td class="num ap-diff">${esc(gapTxt(r.d))}</td>
                <td>${r.bad ? `<span class="ap-mark">${esc(netResult(r))}</span>` : '<span class="ap-okmark">相符</span>'}</td>
                <td class="ap-explain">${esc(r.note || "")}</td>
              </tr>`;
            })
            .join("")}</tbody></table></div>`
        : netRows.length
          ? `<p class="muted">這個篩選沒有列。</p>`
          : "";
      body.innerHTML = `
        ${kpi}
        ${
          netRows.length
            ? `<div class="ap-filters noprint">
                <button type="button" class="pick${netView === "all" ? " on" : ""}" data-ap-view="all">全部 ${netRows.length} 天</button>
                <button type="button" class="pick${netView === "bad" ? " on" : ""}" data-ap-view="bad">只看有差</button>
              </div>`
            : ""
        }
        ${table}
      `;
      return;
    }
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
          <th class="noprint">勾選</th>
          <th>狀態</th>
          <th>貨款日</th><th>市場</th><th>品項</th>
          <th>鴻安件</th><th>貨款件</th><th>差</th>
          <th class="noprint">備註</th>
        </tr></thead>
        <tbody>${vis
          .map((r) => {
            const k = keyOf(r);
            const dtxt = `${r.d > 0 ? "+" : ""}${r.d}`;
            const picked = pickKeys.has(k);
            const cls = r.ok ? "is-ok" : picked ? "is-pick" : "is-bad";
            return `<tr class="${cls}" data-ap-k="${esc(k)}">
              <td class="noprint">${r.ok ? "" : `<input class="ap-check" type="checkbox" ${picked ? "checked" : ""} />`}</td>
              <td>${r.ok ? '<span class="ap-okmark">沒問題</span>' : picked ? '<span class="ap-okmark" style="background:#b8860b">已勾、未送出</span>' : '<span class="ap-mark">有問題</span>'}</td>
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
            </div>
            <div class="ap-submit-bar noprint">
              <button type="button" class="primary" id="ap-submit-ok">確認送出無誤</button>
              <span class="muted">勾選後列還在，按確認才會標沒問題。</span>
            </div>`
          : ""
      }
      ${table}
    `;
  }

  loadConfirms();
  window.renderAuctionPay = renderAuctionPay;
})();
