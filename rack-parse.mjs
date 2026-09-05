import * as XLSX from "xlsx";

const DATE_HEADERS = [
  "單據日期",
  "傳票日期",
  "交易日期",
  "出貨日期",
  "開單日期",
  "異動日期",
  "日期",
  "單據日",
  "出貨日",
  "date",
];
const COMPANY_HEADERS = ["公司別", "公司名稱", "來源公司", "帳套", "組織", "公司", "company"];
const CUSTOMER_HEADERS = [
  "客戶名稱",
  "客戶簡稱",
  "客戶代號",
  "客戶編號",
  "買方",
  "客戶",
  "往來",
  "廠商名稱",
  "客名",
  "customer",
];
const FRAME_CODE_HEADERS = ["產品編號", "品號", "貨號", "物料編號"];
const FRAME_NAME_HEADERS = [
  "品名規格",
  "貨品名稱",
  "商品名稱",
  "物料名稱",
  "品名",
  "品項",
  "鐵架",
  "貨品",
  "物料",
  "frame",
];
const QTY_HEADERS = ["異動數量", "借出數量", "實出數量", "數量", "qty"];
const TYPE_HEADERS = [
  "單據類型",
  "單據別",
  "單據名稱",
  "進出別",
  "出入庫",
  "借還",
  "異動",
  "單別",
  "方向",
  "類型",
  "type",
];
const DOC_HEADERS = ["單據號碼", "傳票號碼", "單據編號", "單號", "憑證", "doc"];

const IN_WORDS = ["歸還", "入庫", "銷退", "銷貨退", "收回", "還入", "歸倉", "退回", "還架", "回庫", "進貨"];
const OUT_WORDS = ["借出", "出庫", "銷貨", "出租", "出貨", "領用", "借架", "調出"];

function uniqHeaders(raw) {
  const seen = new Map();
  return raw.map((h) => {
    const base = String(h ?? "").trim() || "欄位";
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}_${n}`;
  });
}

function pickHeader(headers, candidates, used) {
  const unused = headers.filter((h) => h && !used.has(h));
  for (const c of candidates) {
    const exact = unused.find((h) => h.toLowerCase() === c.toLowerCase());
    if (exact) {
      used.add(exact);
      return exact;
    }
  }
  for (const c of candidates) {
    const hit = unused.find((h) => h.toLowerCase().includes(c.toLowerCase()));
    if (hit) {
      used.add(hit);
      return hit;
    }
  }
  return "";
}

export function guessMap(headers) {
  const used = new Set();
  return {
    date: pickHeader(headers, DATE_HEADERS, used),
    customer: pickHeader(headers, CUSTOMER_HEADERS, used),
    frame: pickHeader(headers, [...FRAME_CODE_HEADERS, ...FRAME_NAME_HEADERS], used),
    frameName: pickHeader(headers, FRAME_NAME_HEADERS, used),
    qty: pickHeader(headers, QTY_HEADERS, used),
    doc: pickHeader(headers, DOC_HEADERS, used),
    type: pickHeader(headers, TYPE_HEADERS, used),
    company: pickHeader(headers, COMPANY_HEADERS, used),
  };
}

export function excelDate(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    const m = String(parsed.m).padStart(2, "0");
    const d = String(parsed.d).padStart(2, "0");
    return `${parsed.y}-${m}-${d}`;
  }
  const text = String(value).trim().replace(/民國|\s/g, "");
  const m = text.match(/(\d{2,4})[年/\-.](\d{1,2})[月/\-.](\d{1,2})/);
  if (m) {
    let year = Number(m[1]);
    if (year < 200) year += 1911;
    return `${year}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return "";
}

function parseQty(value) {
  const n = Number(String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

export function classifyDirection(typeText, qty, mode = "sign") {
  const n = Number(qty);
  if (mode !== "type") {
    return n < 0 ? "in" : "out";
  }
  const t = String(typeText ?? "").trim();
  if (IN_WORDS.some((w) => t.includes(w))) return "in";
  if (OUT_WORDS.some((w) => t.includes(w))) return "out";
  return n < 0 ? "in" : "out";
}

function headerScore(cells) {
  const text = cells.map((c) => String(c ?? "").trim()).filter(Boolean);
  if (text.length < 3) return 0;
  const bag = [
    ...DATE_HEADERS,
    ...CUSTOMER_HEADERS,
    ...FRAME_CODE_HEADERS,
    ...FRAME_NAME_HEADERS,
    ...QTY_HEADERS,
    ...TYPE_HEADERS,
  ];
  let hits = 0;
  for (const h of text) {
    if (bag.some((k) => h.includes(k) || k.includes(h))) hits += 1;
  }
  return hits;
}

function rowsToObjectsFrom(rows, headerIndex) {
  if (headerIndex < 0) return { headers: [], records: [] };
  const headers = uniqHeaders(rows[headerIndex].map((h) => String(h).trim()));
  const records = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every((c) => String(c).trim() === "")) continue;
    const rec = {};
    headers.forEach((h, idx) => {
      rec[h] = row[idx];
    });
    rec._row = i + 1;
    records.push(rec);
  }
  return { headers, records };
}

export function rowsToObjects(rows) {
  let best = { score: -1, index: -1 };
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i += 1) {
    const score = headerScore(rows[i] || []);
    if (score > best.score) best = { score, index: i };
  }
  const headerIndex = best.score >= 2 ? best.index : rows.findIndex((r) => r.some((c) => String(c).trim()));
  return rowsToObjectsFrom(rows, headerIndex);
}

function sample(records, key, n = 80) {
  return records.slice(0, n).map((r) => r[key]);
}

function fillMapFromData(headers, records, map) {
  const used = new Set(Object.values(map).filter(Boolean));
  const unused = headers.filter((h) => h && !used.has(h));
  const scores = unused.map((h) => {
    const vals = sample(records, h);
    const dates = vals.filter((v) => excelDate(v)).length;
    const qtys = vals.filter((v) => Number.isFinite(parseQty(v))).length;
    const types = vals.filter((v) => {
      const t = String(v);
      return IN_WORDS.some((w) => t.includes(w)) || OUT_WORDS.some((w) => t.includes(w));
    }).length;
    const texts = vals.filter((v) => String(v).trim() && !excelDate(v) && !Number.isFinite(parseQty(v))).length;
    const uniq = new Set(vals.map((v) => String(v).trim()).filter(Boolean)).size;
    return { h, dates, qtys, types, texts, uniq };
  });

  if (!map.date) {
    const hit = [...scores].sort((a, b) => b.dates - a.dates)[0];
    if (hit && hit.dates >= 3) {
      map.date = hit.h;
      used.add(hit.h);
    }
  }
  if (!map.qty) {
    const hit = scores.filter((s) => !used.has(s.h)).sort((a, b) => b.qtys - a.qtys)[0];
    if (hit && hit.qtys >= 3) {
      map.qty = hit.h;
      used.add(hit.h);
    }
  }
  if (!map.type) {
    const hit = scores.filter((s) => !used.has(s.h)).sort((a, b) => b.types - a.types)[0];
    if (hit && hit.types >= 2) {
      map.type = hit.h;
      used.add(hit.h);
    }
  }
  const leftover = scores.filter((s) => !used.has(s.h) && s.texts >= 3);
  leftover.sort((a, b) => b.uniq - a.uniq);
  if (!map.customer && leftover[0]) {
    map.customer = leftover[0].h;
    leftover.shift();
  }
  if (!map.frame && leftover[0]) {
    map.frame = leftover[0].h;
  }
  return map;
}

function guessDirectionMode() {
  return "sign";
}

export function normalizeCompany(name) {
  const t = String(name || "").trim();
  if (/穠全/.test(t)) return "穠全";
  if (/鴻安/.test(t)) return "鴻安";
  return t.replace(/^\d+/, "").trim();
}

function companyFromFileName(fileName) {
  const base = String(fileName || "")
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]+$/, "");
  const cleaned = base.replace(/^\d+/, "");
  const m = cleaned.match(/^(.+?)鐵架/);
  if (m) return normalizeCompany(m[1]);
  return normalizeCompany(cleaned.replace(/\d+$/, "").trim());
}

function guessCompany(records, map, fileName) {
  if (map.company) {
    const names = [
      ...new Set(
        sample(records, map.company, 200)
          .map((v) => String(v).trim())
          .filter(Boolean),
      ),
    ];
    if (names.length === 1) return normalizeCompany(names[0]);
    if (names.length > 1) return "";
  }
  return companyFromFileName(fileName);
}

function isMovementReport(rows) {
  const head = rows.slice(0, 8).map((r) => (r || []).join(" ")).join(" ");
  return head.includes("異動明細") || (head.includes("結餘數量") && head.includes("單據日期"));
}

function isSalesDetailReport(rows) {
  if (isMovementReport(rows)) return false;
  const head = rows.slice(0, 8).map((r) => (r || []).join(" ")).join(" ");
  return head.includes("銷售明細") || (head.includes("客戶簡稱") && head.includes("品名規格"));
}

export function flattenSalesDetail(rows) {
  const headerIndex = rows.findIndex(
    (r) =>
      (r || []).some((c) => String(c).trim() === "客戶簡稱") &&
      (r || []).some((c) => String(c).trim() === "品名規格") &&
      (r || []).some((c) => String(c).trim() === "數量"),
  );
  if (headerIndex < 0) return { headers: [], records: [] };
  const colHeaders = uniqHeaders((rows[headerIndex] || []).map((h) => String(h).trim()));
  const headers = colHeaders.includes("單據日期") ? colHeaders : [...colHeaders, "單據日期"];
  let currentDate = "";
  let lastCust = "";
  let lastDoc = "";
  let lastCode = "";
  const records = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const raw0 = String(row[0] ?? "");
    const dateM = raw0.match(/單據日期[：:]\s*([0-9]{2,4}[\/\-.][0-9]{1,2}[\/\-.][0-9]{1,2})/);
    if (dateM) {
      currentDate = excelDate(dateM[1]);
      lastCust = "";
      lastDoc = "";
      lastCode = "";
      continue;
    }
    const compact = raw0.replace(/\s/g, "");
    const rowText = (row || []).slice(0, 8).map((c) => String(c).replace(/\s/g, "")).join("");
    if (!compact) {
      if (row.every((c) => String(c).trim() === "")) continue;
    }
    if (
      compact === "H" ||
      compact.includes("日期別") ||
      compact.includes("日期區間") ||
      compact.includes("製表日期") ||
      /合\s*計|小\s*計|總\s*計|累\s*計/.test(raw0) ||
      /合計|小計|總計/.test(rowText)
    ) {
      continue;
    }
    const rec = {};
    colHeaders.forEach((h, idx) => {
      rec[h] = row[idx];
    });
    const qty = parseQty(rec["數量"]);
    const doc = String(rec["單據憑證"] ?? "").trim();
    const cust = String(rec["客戶簡稱"] ?? "").trim();
    const codeOnRow = String(rec["產品編號"] ?? "").trim();
    const nameOnRow = String(rec["品名規格"] ?? "").trim();
    const sameVoucher = !doc;
    if (doc) lastDoc = doc;
    else rec["單據憑證"] = lastDoc;
    if (cust) lastCust = cust;
    else if (sameVoucher) rec["客戶簡稱"] = lastCust;
    if (codeOnRow) lastCode = codeOnRow;
    else if (sameVoucher) rec["產品編號"] = lastCode;
    if (!nameOnRow && !codeOnRow) continue;
    const frame = String(rec["產品編號"] ?? "").trim() || nameOnRow;
    if (!frame || !Number.isFinite(qty) || qty === 0) continue;
    rec["單據日期"] = currentDate;
    rec._row = i + 1;
    if (!String(rec["客戶簡稱"] ?? "").trim() || !currentDate) continue;
    records.push(rec);
  }
  return { headers, records };
}

const SKIP_WAREHOUSE = new Set(["總倉", "期初數量", ""]);

function isSiteWarehouse(name) {
  const wh = String(name || "").trim();
  if (!wh || SKIP_WAREHOUSE.has(wh)) return false;
  return /二崙|租/.test(wh);
}

export function flattenProductMovement(rows) {
  const headerIndex = rows.findIndex(
    (r) =>
      (r || []).some((c) => String(c).trim() === "單據日期") &&
      (r || []).some((c) => String(c).trim() === "客戶簡稱") &&
      (r || []).some((c) => String(c).trim() === "數量"),
  );
  if (headerIndex < 0) return { headers: [], records: [] };
  const colHeaders = uniqHeaders((rows[headerIndex] || []).map((h) => String(h).trim()));
  const headers = [...colHeaders];
  for (const extra of ["產品編號", "品名規格"]) {
    if (!headers.includes(extra)) headers.push(extra);
  }

  const saleCustomers = new Set();
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const rec = {};
    colHeaders.forEach((h, idx) => {
      rec[h] = (rows[i] || [])[idx];
    });
    const slip = String(rec["單據"] ?? "");
    const cust = String(rec["客戶簡稱"] ?? "").trim();
    if ((slip.includes("銷貨") || slip.includes("銷退")) && cust) saleCustomers.add(cust);
  }

  let code = "";
  let name = "";
  const records = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const raw0 = String(row[0] ?? "");
    const compact = raw0.replace(/\s/g, "");
    const productM = raw0.match(/品名規格：\s*([A-Za-z0-9-]+)\s+(.+)/);
    if (productM) {
      code = productM[1].trim();
      name = productM[2].replace(/\s*個\s*$/g, "").trim();
      continue;
    }
    if (
      compact === "H" ||
      compact.includes("日期區間") ||
      compact.includes("製表日期") ||
      compact.includes("產 品") ||
      /合\s*計|小\s*計|總\s*計/.test(raw0)
    ) {
      continue;
    }
    const rec = {};
    colHeaders.forEach((h, idx) => {
      rec[h] = row[idx];
    });
    const slip = String(rec["單據"] ?? "");
    if (slip.includes("期初") || slip.includes("進貨")) {
      continue;
    }
    const isAdj = slip.includes("調整");
    const isReturn = slip.includes("銷退") || slip.includes("退貨");
    const isSale = slip.includes("銷貨") && !isReturn;
    const isTransferIn = slip.includes("撥入");
    const isTransferOut = slip.includes("撥出");
    if (!isAdj && !isReturn && !isSale && !isTransferIn && !isTransferOut) continue;

    let cust = String(rec["客戶簡稱"] ?? "").trim();
    const warehouse = String(rec["倉庫名稱"] ?? "").trim();
    if (!cust && isAdj) {
      if (isSiteWarehouse(warehouse) || saleCustomers.has(warehouse)) cust = warehouse;
    }
    if (!cust && (isTransferIn || isTransferOut)) {
      if (!isSiteWarehouse(warehouse)) continue;
      cust = warehouse;
    }
    if (!cust) continue;

    const qty = parseQty(rec["數量"]);
    const date = excelDate(rec["單據日期"]);
    if (!code || !date || !Number.isFinite(qty) || qty === 0) continue;

    // 銷貨單：正數＝借出、負數＝歸還。退貨／銷退單：正數＝歸還。
    let signed = qty;
    if (isReturn) signed = -Math.abs(qty);
    if (isTransferOut) signed = -Math.abs(qty);

    rec["客戶簡稱"] = cust;
    rec["產品編號"] = code;
    rec["品名規格"] = name;
    rec["數量"] = signed;
    rec["單據日期"] = date;
    rec["單據"] = slip;
    rec._row = i + 1;
    records.push(rec);
  }
  return { headers, records };
}

export function readWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  let best = null;
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    const parsed = isMovementReport(rows)
      ? flattenProductMovement(rows)
      : isSalesDetailReport(rows)
        ? flattenSalesDetail(rows)
        : rowsToObjects(rows);
    const map = guessMap(parsed.headers);
    const filled = fillMapFromData(parsed.headers, parsed.records, { ...map });
    const required = [filled.date, filled.customer, filled.frame, filled.qty].filter(Boolean).length;
    const score = headerScore(parsed.headers) * 10 + required * 20 + Math.min(parsed.records.length, 200);
    if (!best || score > best.score) {
      best = { sheetName, rows, parsed, map: filled, score };
    }
  }
  if (!best) {
    return { sheetName: "", rows: [], parsed: { headers: [], records: [] }, map: guessMap([]) };
  }
  return best;
}

export function analyzeWorkbook(buffer, fileName) {
  const picked = readWorkbook(buffer);
  const { parsed, map, sheetName } = picked;
  const directionMode = guessDirectionMode();
  const defaultCompany = guessCompany(parsed.records, map, fileName);
  const ready = Boolean(map.date && map.customer && map.frame && map.qty);
  const notes = [];
  if (sheetName) notes.push(`工作表「${sheetName}」`);
  if (defaultCompany) notes.push(`公司「${defaultCompany}」`);
  return {
    sheetName,
    headers: parsed.headers,
    records: parsed.records,
    map,
    directionMode,
    defaultCompany,
    ready,
    notes,
  };
}

export function mapRecords(records, map, { directionMode, defaultCompany, fileName }) {
  const skip = [];
  const txns = [];
  for (const rec of records) {
    const customer = String(rec[map.customer] ?? "").trim();
    const frame = String(rec[map.frame] ?? "").trim();
    const frameName = String(rec[map.frameName] ?? "").trim();
    const qty = parseQty(rec[map.qty]);
    const date = excelDate(rec[map.date]);
    if (!customer || !frame || !Number.isFinite(qty) || qty === 0) {
      skip.push({ row: rec._row, reason: "缺客戶／鐵架／數量" });
      continue;
    }
    if (!date) {
      skip.push({ row: rec._row, reason: "日期無法辨識" });
      continue;
    }
    const company = normalizeCompany(String(rec[map.company] ?? "").trim() || defaultCompany || "未分公司");
    const direction = classifyDirection(rec[map.type], qty, directionMode);
    const absQty = Math.abs(qty);
    txns.push({
      date,
      company,
      customer,
      frame,
      frameName,
      direction,
      qty: absQty,
      doc: String(rec[map.doc] ?? "").trim(),
      fileName,
    });
  }
  return { txns, skip };
}
