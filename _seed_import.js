/** 比對匯入：115進櫃表 + 115貨櫃進櫃紀錄表 + 已放行.xlsx → seed JSON
 * 進櫃紀錄＝已拆卸 → importArrivals（庫存）
 * 進櫃表有、紀錄沒有 → 港口辦理／查驗待確認
 * 已放行.xlsx 與港口待確認重疊 → 標為已放行（未拆櫃）
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const DIR = "C:\\Users\\user\\Desktop\\網頁架設資料";
const OUT = path.join(__dirname, "data", "import-seed.json");
const OUT_PUBLIC = path.join(__dirname, "public-import-seed.json");

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
/** 編號：UHA… 或 NC…；櫃號：EMCU／FBIU…（絕不是 UHA／NC） */
function parseRefNos(v) {
  const s = String(v || "")
    .toUpperCase()
    .replace(/\r/g, "\n");
  const uhaM = s.match(/UHA\s*(\d{1,6})/);
  const ncM = s.match(/(?:^|[^A-Z])NC\s*(\d{1,6})\b/) || s.match(/\bNC\s*(\d{1,6})\b/);
  return {
    uha: uhaM ? "UHA" + uhaM[1] : "",
    nc: ncM ? "NC" + ncM[1] : "",
  };
}
function normUha(v) {
  const refs = parseRefNos(v);
  return refs.uha || refs.nc || "";
}
function isContainerNo(v) {
  const t = String(v || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/\.$/, "");
  if (!t) return false;
  if (/^(UHA|NC)\d/i.test(t)) return false;
  return /^[A-Z]{4}\d{6,7}$/.test(t);
}
function normContainer(v) {
  const t = String(v || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/\.$/, "");
  if (!t || /^(UHA|NC)\d/i.test(t)) return "";
  return isContainerNo(t) ? t : "";
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function fixCenturyDay(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso || "";
  let y = Number(m[1]);
  if (y >= 1924 && y <= 1927) y += 100;
  return `${y}-${m[2]}-${m[3]}`;
}
function parseDay(v) {
  if (v == null || v === "") return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // Excel 常存 UTC 午夜±；用 UTC 日避免變前一天／後一天
    return fixCenturyDay(`${v.getUTCFullYear()}-${pad2(v.getUTCMonth() + 1)}-${pad2(v.getUTCDate())}`);
  }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const ms = Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000;
    try {
      return fixCenturyDay(new Date(ms).toISOString().slice(0, 10));
    } catch (_) {
      return "";
    }
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return fixCenturyDay(s.slice(0, 10));
  const asDate = Date.parse(s);
  if (Number.isFinite(asDate) && /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(s)) {
    try {
      const d = new Date(asDate);
      return fixCenturyDay(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
    } catch (_) {}
  }
  const roc = s.match(/^(1\d{2})(\d{2})(\d{2})$/);
  if (roc) {
    const y = 1911 + Number(roc[1]);
    return `${y}-${roc[2]}-${roc[3]}`;
  }
  const md = s.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (md) return `2026-${pad2(md[1])}-${pad2(md[2])}`;
  return s.slice(0, 10);
}
function cell(row, i) {
  return row && row[i] != null ? row[i] : "";
}
function findHeaderRow(rows, needles) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const line = (rows[i] || []).map((c) => String(c || "")).join("|");
    if (needles.every((n) => line.includes(n))) return i;
  }
  return -1;
}
function colIndex(header, names) {
  const h = (header || []).map((c) => String(c || "").replace(/\s+/g, ""));
  for (const name of names) {
    const i = h.findIndex((x) => x.includes(name));
    if (i >= 0) return i;
  }
  return -1;
}

function parseCabinetSheet(rows) {
  const hi = findHeaderRow(rows, ["編號"]);
  if (hi < 0) return [];
  const h = rows[hi];
  const iUha = colIndex(h, ["編號"]);
  const iCont = colIndex(h, ["櫃號"]);
  const iDay = colIndex(h, ["到港日", "日期"]);
  const iProd = colIndex(h, ["品名", "產品"]);
  const iQty = colIndex(h, ["件數"]);
  const iSeller = colIndex(h, ["賣方"]);
  const iShip = colIndex(h, ["船公司"]);
  const iBroker = colIndex(h, ["報關行"]);
  const iAmt = colIndex(h, ["報關金額"]);
  const iPrice = colIndex(h, ["實價"]);
  const out = [];
  const now = Date.now();
  for (let r = hi + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const refs = parseRefNos(cell(row, iUha));
    const uha = refs.uha || refs.nc;
    if (!uha || !/^(UHA|NC)\d+/i.test(uha)) continue;
    out.push({
      id: uid("cab"),
      uha,
      nc: refs.uha && refs.nc ? refs.nc : "",
      containerNo: normContainer(cell(row, iCont)),
      arriveDay: parseDay(cell(row, iDay)),
      product: String(cell(row, iProd) || "").trim(),
      qty: Number(cell(row, iQty)) || 0,
      seller: String(cell(row, iSeller) || "").trim(),
      shipCo: String(cell(row, iShip) || "").trim(),
      broker: String(cell(row, iBroker) || "").trim(),
      docRef: String(cell(row, 8) || "").trim(),
      amount: String(cell(row, iAmt) || "").trim(),
      price: String(cell(row, iPrice) || "").trim(),
      updatedAt: now,
    });
  }
  return out;
}

function parseArrivalSheet(rows) {
  const hi = findHeaderRow(rows, ["編號", "櫃號"]);
  if (hi < 0) return [];
  const h = rows[hi];
  const iDay = colIndex(h, ["日期"]);
  const iUha = colIndex(h, ["編號"]);
  const iSeller = colIndex(h, ["賣方"]);
  const iBuyer = colIndex(h, ["買方"]);
  const iCont = colIndex(h, ["櫃號"]);
  const iProd = colIndex(h, ["產品", "品名"]);
  const iOuter = colIndex(h, ["外箱"]);
  const iCond = colIndex(h, ["貨況"]);
  const iSpec = colIndex(h, ["規格"]);
  const iUnload = colIndex(h, ["卸貨點"]);
  const iCusQty = colIndex(h, ["報關數量"]);
  const iUnpack = colIndex(h, ["拆櫃數量"]);
  const iPrice = colIndex(h, ["售價"]);
  const iInspect = colIndex(h, ["送檢"]);
  const iCusNo = colIndex(h, ["報關單"]);
  const iNotice = colIndex(h, ["通知號碼"]);
  const out = [];
  const now = Date.now();
  for (let r = hi + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const uha = normUha(cell(row, iUha));
    if (!uha) continue;
    const unpackRaw = cell(row, iUnpack);
    let unpackQty = null;
    if (unpackRaw !== "" && unpackRaw != null) {
      const n = Number(String(unpackRaw).replace(/[^\d.-]/g, ""));
      if (Number.isFinite(n)) unpackQty = n;
      else unpackQty = String(unpackRaw).trim();
    }
    out.push({
      id: uid("arr"),
      uha,
      containerNo: normContainer(cell(row, iCont)),
      day: parseDay(cell(row, iDay)),
      seller: String(cell(row, iSeller) || "").trim(),
      buyer: String(cell(row, iBuyer) || "").trim(),
      product: String(cell(row, iProd) || "").trim(),
      outerBox: String(cell(row, iOuter) || "").trim(),
      condition: String(cell(row, iCond) || "").trim(),
      spec: String(cell(row, iSpec) || "").trim(),
      unload: String(cell(row, iUnload) || "").trim(),
      customsQty: cell(row, iCusQty),
      unpackQty,
      price: String(cell(row, iPrice) || "").trim(),
      inspect: String(cell(row, iInspect) || "").trim(),
      customsNo: String(cell(row, iCusNo) || "").trim(),
      noticeNo: String(cell(row, iNotice) || "").trim(),
      updatedAt: now,
    });
  }
  return out;
}

function loadSheets(file) {
  const wb = XLSX.readFile(path.join(DIR, file), { cellDates: true });
  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true }),
  }));
}

const cabSheets = loadSheets("115年進櫃表0920.xlsx");
const cabSheet = cabSheets.find((s) => /進櫃/.test(s.name)) || cabSheets[0];
const cab = parseCabinetSheet(cabSheet.rows);

const arrSheets = loadSheets("115貨櫃進櫃紀錄表.xlsx");
const arrSheet = arrSheets.find((s) => s.name.includes("鴻安")) || arrSheets.find((s) => !/chart/i.test(s.name)) || arrSheets[0];
const arr = parseArrivalSheet(arrSheet.rows);

const arrived = new Set(arr.map((a) => a.uha));
const portPending = cab.filter((c) => c.uha && !arrived.has(c.uha));
const cabByUha = new Map(cab.map((c) => [c.uha, c]));

/** 已放行.xlsx（週六放行狀態） */
function parseReleasedSheet(rows) {
  const out = [];
  const seen = new Set();
  for (const row of rows || []) {
    const uha = normUha(cell(row, 0));
    if (!uha || seen.has(uha)) continue;
    seen.add(uha);
    const containerNo = normContainer(cell(row, 1));
    const product = String(cell(row, 3) || "")
      .replace(/\s+/g, " ")
      .trim();
    const trailer = String(cell(row, 5) || "").trim();
    const dock = String(cell(row, 7) || "").trim();
    const noteParts = [];
    for (let k = 2; k <= 7; k++) {
      const t = String(cell(row, k) || "").trim();
      if (!t) continue;
      if (k === 3 && product) continue;
      if (k === 5 && trailer) continue;
      if (k === 7 && dock) continue;
      if (t instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(t)) continue;
      noteParts.push(t);
    }
    out.push({
      uha,
      containerNo,
      product,
      trailer,
      dock,
      note: noteParts.slice(0, 4).join(" · "),
    });
  }
  return out;
}

const relSheets = loadSheets("已放行.xlsx");
const relSheet =
  relSheets.find((s) => /放行/.test(s.name)) || relSheets[0];
const releasedRows = parseReleasedSheet(relSheet ? relSheet.rows : []);
const releasedSet = new Set(releasedRows.map((r) => r.uha));
const releasedByUha = new Map(releasedRows.map((r) => [r.uha, r]));

/** 港口待確認 ∩ 已放行 → 進已放行；其餘港口待確認維持 pending */
const promoted = [];
const stillPending = [];
for (const c of portPending) {
  if (releasedSet.has(c.uha)) promoted.push(c.uha);
  else stillPending.push(c.uha);
}

const importReleased = [];
const now = Date.now();

for (const c of portPending) {
  const rel = releasedByUha.get(c.uha);
  const isReleased = !!rel;
  importReleased.push({
    id: uid("rel"),
    uha: c.uha,
    containerNo: (rel && rel.containerNo) || c.containerNo || "",
    product: (rel && rel.product) || c.product || "",
    arriveDay: c.arriveDay || "",
    released: isReleased,
    releasedAt: isReleased ? "2026-09-20" : "",
    arrangeMonday: isReleased,
    fromReleasedExcel: isReleased,
    inspect: "none",
    fumigate: "none",
    inspectAt: "",
    fumigateAt: "",
    trailer: (rel && rel.trailer) || "",
    dock: (rel && rel.dock) || "",
    askPickup: isReleased,
    note: isReleased
      ? rel.note || "匯入：已放行.xlsx"
      : "匯入：查驗待確認",
    portConfirm: isReleased ? "done" : "pending",
    updatedAt: now,
  });
}

/** 已放行有、進櫃表有、尚未進庫 → 補進已放行（即使先前未進 port track） */
for (const rel of releasedRows) {
  if (arrived.has(rel.uha)) continue;
  if (importReleased.some((r) => r.uha === rel.uha)) continue;
  const c = cabByUha.get(rel.uha);
  importReleased.push({
    id: uid("rel"),
    uha: rel.uha,
    containerNo: rel.containerNo || (c && c.containerNo) || "",
    product: rel.product || (c && c.product) || "",
    arriveDay: (c && c.arriveDay) || "",
    released: true,
    releasedAt: "2026-09-20",
    arrangeMonday: true,
    fromReleasedExcel: true,
    inspect: "none",
    fumigate: "none",
    inspectAt: "",
    fumigateAt: "",
    trailer: rel.trailer || "",
    dock: rel.dock || "",
    askPickup: true,
    note: rel.note || "匯入：已放行.xlsx",
    portConfirm: "done",
    updatedAt: now,
  });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const seed = {
  importedAt: new Date().toISOString(),
  source: {
    cabinet: "115年進櫃表0920.xlsx",
    arrival: "115貨櫃進櫃紀錄表.xlsx",
    released: "已放行.xlsx",
  },
  importCabinets: cab,
  importArrivals: arr,
  importReleased,
  counts: {
    cabinets: cab.length,
    arrivals: arr.length,
    portPending: stillPending.length,
    releasedOpen: importReleased.filter((r) => r.released && !arrived.has(r.uha)).length,
    releasedTracks: importReleased.length,
    promotedFromPort: promoted.length,
    releasedFileRows: releasedRows.length,
  },
};
const json = JSON.stringify(seed);
fs.writeFileSync(OUT, json);
fs.writeFileSync(OUT_PUBLIC, json);

// 合併進 data/sync.json（若存在）
const syncPath = path.join(__dirname, "data", "sync.json");
if (fs.existsSync(syncPath)) {
  const sync = JSON.parse(fs.readFileSync(syncPath, "utf8"));
  sync.importCabinets = cab;
  sync.importArrivals = arr;
  sync.importReleased = importReleased;
  sync.updatedAt = Date.now();
  fs.writeFileSync(syncPath, JSON.stringify(sync));
  console.log("updated data/sync.json import arrays");
}

console.log("wrote", OUT);
console.log(seed.counts);
console.log("promoted:", promoted.join(", ") || "(none)");
console.log("still port:", stillPending.slice(0, 8).join(", "), stillPending.length > 8 ? "…" : "");
console.log(
  "released file not in stock:",
  releasedRows.filter((r) => !arrived.has(r.uha)).map((r) => r.uha).join(", ") || "(none — all already in arrivals)"
);