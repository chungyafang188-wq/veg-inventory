const NQ_DEFAULT_CUSTOMERS = ["小琳", "欣儒"];
const NQ_CUST_KEY = "nongquan-customer-lists-v2";
const NQ_CUST_KEY_OLD = "nongquan-customer-list-v1";
const KEY = "nongquan-hongan-orders-v1";
const PACK_OPTS = ["籃裝", "箱裝"];
const VENDOR_OPTS = ["芳", "琳", "其他"];
const FORM_KINDS = {
  leaf: {
    label: "地瓜葉",
    title: "穠全 地瓜葉出貨",
    formTitle: "填寫地瓜葉出貨數量",
    hint: "手打或點出貨對象，下拉選誌／芳，裝箱選籃裝或箱裝，可＋加下一項。無叫貨按「今日無叫貨」。",
    formHint: "地瓜葉：下拉選誌或芳，裝箱樣式每筆可不同。用＋加一筆、刪拿掉。",
    skuIds: ["sl-zhi", "sl-fang"],
    cols: [
      { key: "slZhi", label: "地瓜葉／誌", kind: "qty" },
      { key: "slFang", label: "地瓜葉／芳", kind: "qty" },
      { key: "pack", label: "裝箱樣式", kind: "pack" },
    ],
  },
  basil: {
    label: "九層塔",
    title: "穠全 九層塔出貨",
    formTitle: "填寫九層塔出貨數量",
    hint: "手打或點出貨對象，下拉選紅骨／綠骨與廠商，可＋加下一項。同一客人紅骨、綠骨可不同廠商。無叫貨按「今日無叫貨」。",
    formHint: "九層塔：下拉選紅骨或綠骨，再選廠商（芳／琳／其他）。用＋加一筆、刪拿掉。",
    skuIds: ["rb-fang", "rb-lin", "rb-oth", "gb-fang", "gb-lin", "gb-oth"],
    cols: [
      { key: "rb", label: "紅骨", kind: "qty" },
      { key: "rbVendor", label: "紅骨廠商", kind: "rbVendor" },
      { key: "gb", label: "綠骨", kind: "qty" },
      { key: "gbVendor", label: "綠骨廠商", kind: "gbVendor" },
      { key: "note", label: "備註", kind: "note" },
    ],
  },
  herb: {
    label: "散賣品項",
    title: "穠全 散賣出貨",
    formTitle: "填寫散賣數量",
    hint: "散賣填薄荷、紫蘇、九層塔（kg）。出貨對象預設小琳、欣儒。點出貨扣庫會自動記入相同數量進貨，不必再到進貨頁補登。",
    formHint: "散賣：薄荷、紫蘇、九層塔。",
    skuIds: ["mint-kg", "shiso-kg", "basil-kg", "shiso-jin"],
    cols: [
      { key: "mint", label: "薄荷", kind: "qty" },
      { key: "shisoKg", label: "紫蘇", kind: "qty" },
      { key: "basilKg", label: "九層塔", kind: "qty" },
    ],
  },
};
const DAILY_KEY = "nongquan-daily-sheet-preview-v1";
const HA_CUST_KEY = "hongan-customer-history-v1";
const STAFF_NOW_KEY = "nongquan-staff-now-v1";
const STAFF_LIST_KEY = "nongquan-staff-list-v1";
const ADDR_KEY = "nongquan-ship-addr-v1";
let ticketLines = [];
const BASIL_SKU = {
  rb: { 芳: "rb-fang", 琳: "rb-lin", 其他: "rb-oth" },
  gb: { 芳: "gb-fang", 琳: "gb-lin", 其他: "gb-oth" },
};
const BASIL_REV = {
  "gb-fang": { qty: "gb", val: "芳" },
  "gb-lin": { qty: "gb", val: "琳" },
  "gb-oth": { qty: "gb", val: "其他" },
  "rb-fang": { qty: "rb", val: "芳" },
  "rb-lin": { qty: "rb", val: "琳" },
  "rb-oth": { qty: "rb", val: "其他" },
};
const OLD_LEAF = {
  "sl-b-zhi": { id: "sl-zhi", pack: "籃裝" },
  "sl-x-zhi": { id: "sl-zhi", pack: "箱裝" },
  "sl-b-fang": { id: "sl-fang", pack: "籃裝" },
  "sl-x-fang": { id: "sl-fang", pack: "箱裝" },
};
const HA_VEG = {
  cab: { label: "高麗菜", opts: [["kr", "韓國"], ["vn", "越南"], ["id", "印尼"]] },
  nap: { label: "大白菜", opts: [["kr", "韓國"], ["vn", "越南"]] },
  bur: { label: "蘿蔔", opts: [["l", "L"], ["2l", "2L"]] },
  wk: { label: "白K", opts: [["m", "M"], ["l", "L"], ["2l", "2L"], ["cut", "切頭"]] },
  ice: { label: "美生菜", opts: [["vn", "越南"], ["kr", "韓國"]] },
  cel: { label: "西芹", opts: [["vn", "越南"], ["us", "美國"]] },
  bro: { label: "青花", opts: [["vn", "越南"]] },
  chili: { label: "辣椒", opts: [["lg", "大辣"], ["sm", "小辣"]] },
};
function haVegSkuId(fam, opt) {
  return `veg-${fam}-${opt}`;
}
function isHaVegFam(fam) {
  return !!HA_VEG[fam];
}
function haVegSkuList() {
  const out = [];
  for (const [fam, def] of Object.entries(HA_VEG)) {
    for (const [opt, lab] of def.opts) {
      out.push({
        id: haVegSkuId(fam, opt),
        co: "ha",
        name: `${def.label}／${lab}`,
        unit: "件",
        trade: true,
        vegFam: fam,
        vegOpt: opt,
      });
    }
  }
  return out;
}
function haVegExtrasHtml(fam, rec = {}) {
  const def = HA_VEG[fam];
  if (!def) return "";
  const cur = rec.skuId ? skuById(rec.skuId)?.vegOpt : rec.vegOpt;
  const opt = def.opts.some((x) => x[0] === cur) ? cur : def.opts[0][0];
  const opts = def.opts
    .map(([v, lab]) => `<option value="${esc(v)}"${v === opt ? " selected" : ""}>${esc(lab)}</option>`)
    .join("");
  return `<select data-veg-opt aria-label="${esc(def.label)}規格">${opts}</select>`;
}
const SKUS = [
  { id: "sl-zhi", co: "nq", name: "本產蔬菜－地瓜葉／誌", unit: "籃", packRemark: true },
  { id: "sl-fang", co: "nq", name: "本產蔬菜－地瓜葉／芳", unit: "籃", packRemark: true },
  { id: "rb-fang", co: "nq", name: "紅骨九層塔／芳", unit: "箱" },
  { id: "rb-lin", co: "nq", name: "紅骨九層塔／琳", unit: "箱" },
  { id: "rb-oth", co: "nq", name: "紅骨九層塔／其他", unit: "箱" },
  { id: "gb-fang", co: "nq", name: "綠骨九層塔／芳", unit: "箱" },
  { id: "gb-lin", co: "nq", name: "綠骨九層塔／琳", unit: "箱" },
  { id: "gb-oth", co: "nq", name: "綠骨九層塔／其他", unit: "箱" },
  { id: "mint-kg", co: "nq", name: "薄荷散賣kg", unit: "kg" },
  { id: "shiso-kg", co: "nq", name: "紫蘇散賣kg", unit: "kg" },
  { id: "basil-kg", co: "nq", name: "九層塔散賣kg", unit: "kg" },
  { id: "shiso-jin", co: "nq", name: "紫蘇散賣斤", unit: "斤" },
  ...haVegSkuList(),
  { id: "on-nz-20", co: "ha", name: "洋蔥／紐西蘭／20K", unit: "件", onion: true, site: true },
  { id: "on-nz-12", co: "ha", name: "洋蔥／紐西蘭／12K", unit: "件", onion: true, site: true },
  { id: "on-au-20", co: "ha", name: "洋蔥／澳洲／20K", unit: "件", onion: true, site: true },
  { id: "on-au-12", co: "ha", name: "洋蔥／澳洲／12K", unit: "件", onion: true, site: true },
  { id: "on-kr-20", co: "ha", name: "洋蔥／韓國／20K", unit: "件", onion: true, site: true },
  { id: "on-kr-12", co: "ha", name: "洋蔥／韓國／12K", unit: "件", onion: true, site: true },
  { id: "on-vn-20", co: "ha", name: "洋蔥／越南／20K", unit: "件", onion: true, site: true },
  { id: "on-vn-12", co: "ha", name: "洋蔥／越南／12K", unit: "件", onion: true, site: true },
  { id: "onp-nz-20", co: "ha", name: "紫洋蔥／紐西蘭／20K", unit: "件", onion: true, site: true },
  { id: "onp-nz-12", co: "ha", name: "紫洋蔥／紐西蘭／12K", unit: "件", onion: true, site: true },
  { id: "onp-au-20", co: "ha", name: "紫洋蔥／澳洲／20K", unit: "件", onion: true, site: true },
  { id: "onp-au-12", co: "ha", name: "紫洋蔥／澳洲／12K", unit: "件", onion: true, site: true },
  { id: "onp-kr-20", co: "ha", name: "紫洋蔥／韓國／20K", unit: "件", onion: true, site: true },
  { id: "onp-kr-12", co: "ha", name: "紫洋蔥／韓國／12K", unit: "件", onion: true, site: true },
  { id: "onp-vn-20", co: "ha", name: "紫洋蔥／越南／20K", unit: "件", onion: true, site: true },
  { id: "onp-vn-12", co: "ha", name: "紫洋蔥／越南／12K", unit: "件", onion: true, site: true },
  { id: "on-b-kg", co: "ha", name: "洋蔥／B級", unit: "kg", onion: true, site: true },
  { id: "pk-mi-18", co: "ha", name: "南瓜／密本／18K", unit: "箱", site: true },
  { id: "pk-mi-20", co: "ha", name: "南瓜／密本／20K", unit: "箱", site: true },
  { id: "pk-ch-18", co: "ha", name: "南瓜／阿成／18K", unit: "箱", site: true },
  { id: "pk-ch-20", co: "ha", name: "南瓜／阿成／20K", unit: "箱", site: true },
  { id: "pk-b-kg", co: "ha", name: "南瓜／B級", unit: "kg", site: true },
];
const NQ_INBOUND = [
  { id: "sl-zhi", label: "地瓜葉-誌" },
  { id: "sl-fang", label: "地瓜葉-芳" },
  { id: "rb-fang", label: "紅骨-芳" },
  { id: "rb-lin", label: "紅骨-琳" },
  { id: "rb-oth", label: "紅骨-其他" },
  { id: "gb-fang", label: "綠骨-芳" },
  { id: "gb-lin", label: "綠骨-琳" },
  { id: "gb-oth", label: "綠骨-其他" },
];
const NQ_STOCK_GROUPS = [
  { id: "leaf", label: "地瓜葉", ids: ["sl-zhi", "sl-fang"] },
  { id: "basil", label: "九層塔", ids: ["rb-fang", "rb-lin", "rb-oth", "gb-fang", "gb-lin", "gb-oth"] },
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function round(n) {
  return Math.round(n * 1000) / 1000;
}
function fmt(n) {
  return Number.isInteger(n) ? String(n) : String(round(n));
}
function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
}
function addDays(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}
function skuStep(sku) {
  return sku.unit === "kg" || sku.unit === "斤" ? 0.1 : 1;
}
function nqSkus() {
  return SKUS.filter((s) => s.co === "nq");
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function emptyStock() {
  const stock = {};
  for (const sku of SKUS) stock[sku.id] = { qty: 0, processed: 0, safety: 0 };
  return stock;
}
function addStockRow(a, b) {
  return {
    qty: round((a?.qty || 0) + (b?.qty || 0)),
    processed: round((a?.processed || 0) + (b?.processed || 0)),
    safety: Math.max(a?.safety || 0, b?.safety || 0),
  };
}
const SKU_REMAP = {
  pk: "pk-mi-18",
  "pk-mi": "pk-mi-18",
  "pk-cheng": "pk-ch-18",
  "pk-mid": "pk-mi-18",
  "pk-mid-kg": "pk-b-kg",
  "on-nz-l": "on-nz-20",
  "on-nz-xl": "on-nz-12",
  "on-kr-l": "on-kr-20",
  "on-kr-xl": "on-kr-12",
  "on-kr-m": "on-b-kg",
  "on-kr-b": "on-b-kg",
  "on-kr-b-kg": "on-b-kg",
  "cb-kr": "veg-cab-kr",
  "cb-vn": "veg-cab-vn",
  "cb-id": "veg-cab-id",
  "np-kr": "veg-nap-kr",
  "np-vn": "veg-nap-vn",
  "np-id": "veg-nap-vn",
  "pk-gen": "pk-mi-18",
  "pk-ds": "pk-mi-18",
  "veg-pks-mi": "pk-mi-18",
  "veg-pks-ds": "pk-mi-18",
  "ch-lg": "veg-chili-lg",
  "ch-tt": "veg-chili-sm",
  "pp-rd": "veg-chili-lg",
  "pp-yl": "veg-chili-sm",
  "pp-gn": "veg-chili-sm",
  "lt-ice": "veg-ice-vn",
  "cl-tw": "veg-cel-us",
  "cl-vn": "veg-cel-vn",
  "br-fl": "veg-bro-vn",
  "bg-2l": "veg-bur-2l",
  "wk-l": "veg-wk-l",
};
function remapSkuId(id) {
  return SKU_REMAP[id] || id;
}
function mergeDailySku(to, from) {
  if (!from) return to || { opening: 0, inbound: 0, count: null };
  return {
    opening: round((to?.opening || 0) + (from.opening || 0)),
    inbound: round((to?.inbound || 0) + (from.inbound || 0)),
    count: from.count != null ? round((Number(to?.count) || 0) + Number(from.count)) : to?.count ?? null,
    morning: from.morning != null && from.morning !== "" ? from.morning : to?.morning,
    morningConfirmed: !!(from.morningConfirmed || to?.morningConfirmed),
    lots: [...(to?.lots || []), ...(from.lots || [])],
  };
}
function migrate(data) {
  let changed = false;
  const pairs = [
    { oldIds: ["sl-b-zhi", "sl-x-zhi"], to: "sl-zhi" },
    { oldIds: ["sl-b-fang", "sl-x-fang"], to: "sl-fang" },
  ];
  for (const { oldIds, to } of pairs) {
    const present = oldIds.filter((id) => data.stock[id]);
    if (!present.length) continue;
    let merged = data.stock[to] || { qty: 0, processed: 0, safety: 0 };
    for (const id of present) merged = addStockRow(merged, data.stock[id]);
    data.stock[to] = merged;
    for (const id of oldIds) delete data.stock[id];
    changed = true;
  }
    for (const o of data.orders) {
    for (const line of o.lines) {
      const mapped = OLD_LEAF[line.skuId];
      if (!mapped) continue;
      line.skuId = mapped.id;
      if (!line.pack) line.pack = mapped.pack;
      changed = true;
    }
  }
  if (data.daily) {
    for (const date of Object.keys(data.daily)) {
      const book = data.daily[date];
      for (const { oldIds, to } of pairs) {
        const present = oldIds.filter((id) => book[id]);
        if (!present.length) continue;
        let opening = book[to]?.opening || 0;
        let inbound = book[to]?.inbound || 0;
        let count = book[to]?.count ?? null;
        for (const id of present) {
          opening = round(opening + (book[id].opening || 0));
          inbound = round(inbound + (book[id].inbound || 0));
          if (book[id].count != null) count = round((count || 0) + Number(book[id].count));
          delete book[id];
        }
        book[to] = { opening, inbound, count };
        changed = true;
      }
    }
  }
  for (const o of data.orders || []) {
    for (const line of o.lines || []) {
      const next = remapSkuId(line.skuId);
      if (next !== line.skuId) {
        line.skuId = next;
        changed = true;
      }
    }
    for (const lot of o.shipInbounds || []) {
      const next = remapSkuId(lot.skuId);
      if (next !== lot.skuId) {
        lot.skuId = next;
        changed = true;
      }
    }
  }
  for (const [from, to] of Object.entries(SKU_REMAP)) {
    if (data.stock?.[from]) {
      data.stock[to] = addStockRow(data.stock[to] || { qty: 0, processed: 0, safety: 0 }, data.stock[from]);
      delete data.stock[from];
      changed = true;
    }
  }
  if (data.daily) {
    for (const date of Object.keys(data.daily)) {
      const book = data.daily[date];
      for (const [from, to] of Object.entries(SKU_REMAP)) {
        if (!book?.[from]) continue;
        book[to] = mergeDailySku(book[to], book[from]);
        delete book[from];
        changed = true;
      }
    }
  }
  return changed;
}
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "null");
    if (data && data.stock && data.orders) {
      if (!data.daily) data.daily = {};
      if (!Array.isArray(data.rests)) data.rests = [];
      return data;
    }
  } catch (_) {}
  return { stock: emptyStock(), orders: [], daily: {}, rests: [] };
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (_) {}
  scheduleCloudPush();
}

const CLOUD_URL = "/api/data";
const SYNC_META_KEY = "nongquan-sync-meta-v1";
let cloudReady = false;
let skipCloud = true;
let cloudTimer = 0;
function readSyncAt() {
  return Number(localStorage.getItem(SYNC_META_KEY) || 0) || 0;
}
function writeSyncAt(n) {
  try {
    localStorage.setItem(SYNC_META_KEY, String(n || 0));
  } catch (_) {}
}
function setSyncNote(text) {
  const el = document.getElementById("sync-note");
  if (!el) return;
  const t = text === "電腦與手機共用同一份資料。" ? "" : text || "";
  el.textContent = t;
  el.hidden = !t;
}
function scheduleCloudPush() {
  if (skipCloud) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => {
    pushCloud(true).catch(() => {
      cloudReady = false;
    });
  }, 450);
}

function bookOf(date) {
  if (!state.daily) state.daily = {};
  if (!state.daily[date]) state.daily[date] = {};
  return state.daily[date];
}
function shippedQty(skuId, date) {
  let n = 0;
  for (const o of state.orders) {
    if (o.status !== "shipped" || o.shippedOn !== date) continue;
    for (const line of o.lines) if (line.skuId === skuId) n += line.qty;
  }
  return n;
}
function prevSettleQty(skuId, date) {
  const yRow = state.daily?.[addDays(date, -1)]?.[skuId];
  if (!yRow || !yRow.countConfirmed) return null;
  if (yRow.count == null || yRow.count === "") return null;
  const n = Number(yRow.count);
  return Number.isFinite(n) ? round(n) : null;
}
function morningIsFilled(b) {
  return !!(b && b.morningConfirmed && b.morning != null && b.morning !== "");
}
function fillMorningFromPrevSettle(row, skuId, date) {
  const carried = prevSettleQty(skuId, date);
  let changed = false;
  const sku = skuById(skuId);
  if (sku && isSiteSku(sku)) {
    if (carried != null && row.opening == null) {
      row.opening = carried;
      changed = true;
    }
    return changed;
  }
  if (carried != null && row.morningCarried == null) {
    row.morningCarried = carried;
    changed = true;
  }
  if (
    !row.morningConfirmed &&
    !row.morningEdited &&
    row.morning != null &&
    row.morning !== "" &&
    row.morningCarried != null &&
    row.morningCarried !== "" &&
    round(Number(row.morning) || 0) === round(Number(row.morningCarried) || 0)
  ) {
    row.morning = "";
    changed = true;
  }
  return changed;
}
function seedOpening(skuId, date) {
  const yest = addDays(date, -1);
  const yRow = state.daily?.[yest]?.[skuId];
  if (yRow) {
    if (yRow.count != null && yRow.count !== "") return round(Number(yRow.count));
    return round(countQtyOf(yRow) + (yRow.inbound || 0) - shippedQty(skuId, yest));
  }
  const dates = Object.keys(state.daily || {}).filter((d) => d < date).sort();
  for (let i = dates.length - 1; i >= 0; i--) {
    const row = state.daily[dates[i]]?.[skuId];
    if (row && row.count != null && row.count !== "") return round(Number(row.count));
  }
  const qty = state.stock[skuId]?.qty || 0;
  return round(qty + shippedQty(skuId, date));
}
function ensureBooks(date = today()) {
  const book = bookOf(date);
  let changed = false;
  for (const sku of SKUS) {
    if (!book[sku.id]) {
      book[sku.id] = { opening: seedOpening(sku.id, date), inbound: 0, count: null };
      changed = true;
    }
    if (fillMorningFromPrevSettle(book[sku.id], sku.id, date)) changed = true;
    recountBookRow(book[sku.id]);
  }
  return changed;
}
function ensureTodayBooks() {
  return ensureBooks(today());
}
function sumLots(b) {
  const lots = Array.isArray(b?.lots) ? b.lots : [];
  return round(lots.reduce((s, x) => s + Number(x.qty || 0), 0));
}
function syncBookInbound(b) {
  if (!b) return 0;
  if (Array.isArray(b.lots)) b.inbound = round(Math.max(0, sumLots(b)));
  else b.inbound = round(Math.max(0, Number(b.inbound) || 0));
  return round(b.inbound || 0);
}
function countQtyOf(b) {
  if (!morningIsFilled(b)) return 0;
  return round(Number(b.morning) || 0);
}
function recountBookRow(b) {
  if (!b || typeof b !== "object") return b;
  if (Array.isArray(b.lots)) syncBookInbound(b);
  else if (Number(b.inbound) > 0) {
    b.lots = [{ qty: round(b.inbound), at: 0 }];
    syncBookInbound(b);
  }
  if (b.morningConfirmed && b.morning != null && b.morning !== "") {
    b.opening = round(Number(b.morning) || 0);
  } else if (!b.morningConfirmed) {
    b.opening = 0;
  }
  return b;
}
function recountAllBooks() {
  let changed = false;
  for (const date of Object.keys(state.daily || {})) {
    const book = state.daily[date];
    if (!book || typeof book !== "object") continue;
    for (const id of Object.keys(book)) {
      const row = book[id];
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const beforeIn = row.inbound;
      const beforeOpen = row.opening;
      recountBookRow(row);
      if (row.inbound !== beforeIn || row.opening !== beforeOpen) changed = true;
    }
  }
  return changed;
}
function bookRow(skuId, date = today()) {
  ensureBooks(date);
  const book = bookOf(date);
  if (!book[skuId]) book[skuId] = { opening: seedOpening(skuId, date), inbound: 0, count: null };
  recountBookRow(book[skuId]);
  return book[skuId];
}
function onHand(sku, date = today()) {
  if (!sku) return 0;
  if (isSiteSku(sku)) return ensureStockRow(sku.id).processed;
  const b = bookRow(sku.id, date);
  return round(countQtyOf(b) + (b.inbound || 0) - shippedQty(sku.id, date));
}
function syncNqQty(sku) {
  if (isSiteSku(sku)) return;
  state.stock[sku.id].qty = onHand(sku);
}
function syncAllNqQty() {
  for (const sku of nqSkus()) syncNqQty(sku);
}

const state = load();
const migrated = migrate(state);
for (const sku of SKUS) {
  if (!state.stock[sku.id]) state.stock[sku.id] = { qty: 0, processed: 0, safety: 0 };
}
if (!state.daily) state.daily = {};
if (!Array.isArray(state.rests)) state.rests = [];
const seeded = ensureTodayBooks();
const recounted = recountAllBooks();
syncAllNqQty();
if (migrated || seeded || recounted) save();

let co = "nq";
let hubOpen = "";
let booksPart = "stock";
let formKind = "leaf";
let stockKind = "leaf";
let editing = "";
let ordersPane = "form";
let ordersPaneLock = false;
let inPane = "form";
let inPaneLock = false;
let rackPane = "frame";
let rackPick = "";
let rackLine = "";
let rackQ = "";
let rackCo = "";
let rackMode = "asof";
let rackFrom = "";
let rackTo = today();
let rackTxns = [];
let rackLoad = "";
let highlightOrderIds = [];
let highlightTimer = 0;
let planDay = today();
let stockDay = today();
let planOpenId = "";
let planPane = "pending";
let planMain = "short";
let planMainLock = false;
function planViewDay() {
  return planDay || today();
}
function stockViewDay() {
  return stockDay || today();
}
function bindWorkDates() {
  const p = document.getElementById("plan-date");
  const s = document.getElementById("stock-date");
  if (p && !p.dataset.bound) {
    p.dataset.bound = "1";
    if (!p.value) p.value = planViewDay();
    p.addEventListener("change", () => {
      planDay = p.value || today();
      renderPlan();
    });
  }
  if (s && !s.dataset.bound) {
    s.dataset.bound = "1";
    if (!s.value) s.value = stockViewDay();
    s.addEventListener("change", () => {
      stockDay = s.value || today();
      const other = document.getElementById("in-date");
      if (other) other.value = stockDay;
      const sales = document.getElementById("sales-date");
      if (sales) sales.value = stockDay;
      renderStock();
      renderSalesBooks();
    });
  }
  const i = document.getElementById("in-date");
  if (i && !i.dataset.bound) {
    i.dataset.bound = "1";
    if (!i.value) i.value = stockViewDay();
    i.addEventListener("change", () => {
      stockDay = i.value || today();
      if (s) s.value = stockDay;
      const sales = document.getElementById("sales-date");
      if (sales) sales.value = stockDay;
      renderStock();
      renderSalesBooks();
    });
  }
  const salesEl = document.getElementById("sales-date");
  if (salesEl && !salesEl.dataset.bound) {
    salesEl.dataset.bound = "1";
    if (!salesEl.value) salesEl.value = stockViewDay();
    salesEl.addEventListener("change", () => {
      stockDay = salesEl.value || today();
      if (s) s.value = stockDay;
      if (i) i.value = stockDay;
      renderStock();
      renderSalesBooks();
    });
  }
}

function skuById(id) {
  return SKUS.find((s) => s.id === id);
}
function isSiteSku(sku) {
  return !!(sku && (sku.site || sku.onion));
}
function isTradeSku(sku) {
  return !!(sku && sku.trade);
}

const HA_WAREHOUSES = {
  A: "穠全",
  B: "二崙",
  C: "大庄",
  D: "油1",
  E: "油2",
  F: "油3",
  G: "周",
};
let formLot = null;
let lotPickCtx = null;

function warehouseLabel(code) {
  if (!code) return "未對倉";
  return `${code}倉 ${HA_WAREHOUSES[code] || ""}`.trim();
}
function skuLotGroup(sku) {
  if (!sku) return "";
  if (sku.vegFam === "nap") return sku.vegOpt === "kr" ? "nap-kr" : sku.vegOpt === "vn" ? "nap-vn" : "";
  if (sku.vegFam === "cab") return sku.vegOpt === "id" ? "cab-id" : sku.vegOpt === "vn" ? "cab-vn" : "";
  if (sku.vegFam === "ice") return sku.vegOpt === "vn" ? "ice-vn" : "";
  if (sku.vegFam === "bro") return "bro";
  if (sku.vegFam === "wk") return "wk";
  if (sku.vegFam === "bur") return "bur";
  if (sku.vegFam === "cel") return "cel";
  if (sku.vegFam === "chili") return "chili";
  const id = sku.id || "";
  if (id.startsWith("onp-")) return "onp";
  if (id.startsWith("on-") || id === "on-b-kg") return "on";
  if (id.startsWith("pk-")) return "pk";
  return "";
}
function allContainerLots() {
  return Array.isArray(window.CONTAINER_LOTS?.lots) ? window.CONTAINER_LOTS.lots : [];
}
function lotsForSku(skuId) {
  const g = skuLotGroup(skuById(skuId));
  if (!g) return [];
  return allContainerLots().filter((l) => l.group === g);
}
function skuNeedsShipLot(skuId) {
  return lotsForSku(skuId).length > 0;
}
function lotUsedQty(uha, skip) {
  let n = 0;
  for (const o of state.orders || []) {
    if (o.status === "cancelled") continue;
    for (const line of o.lines || []) {
      if (skip?.orderId && o.id === skip.orderId && skip.lineUha === undefined) continue;
      if (line.lotUha === uha) n += Number(line.qty) || 0;
    }
  }
  ticketLines.forEach((line, i) => {
    if (skip?.ticketIndex === i) return;
    if (line.lotUha === uha) n += Number(line.qty) || 0;
  });
  if (formLot?.uha === uha && skip?.source !== "form") n += Number(skip?.formQty) || 0;
  return round(n);
}
function lotRemain(lot, skip) {
  return round(Math.max(0, Number(lot.qty) || 0) - lotUsedQty(lot.uha, skip));
}
function clearLineLot(line) {
  if (!line) return;
  delete line.lotUha;
  delete line.lotContainer;
  delete line.lotWh;
}
function applyLotToLine(line, lot) {
  if (!line || !lot) return;
  line.lotUha = lot.uha;
  line.lotContainer = lot.container;
  if (lot.wh) line.lotWh = lot.wh;
  else delete line.lotWh;
}
function lotBtnLabel(lot) {
  if (!lot?.uha && !lot?.container) return "選出貨編號";
  const no = lot.container || lot.uha;
  return `${warehouseLabel(lot.wh)} · ${no}`;
}
function nqTradeSkus() {
  return SKUS.filter((s) => s.trade);
}
function haProcessSkus() {
  return SKUS.filter((s) => s.co === "ha" && isSiteSku(s));
}
function companySkus() {
  return SKUS.filter((s) => s.co === co);
}
function formSkus() {
  if (co === "ha") return companySkus();
  const ids = (FORM_KINDS[formKind] || FORM_KINDS.leaf).skuIds;
  return SKUS.filter((s) => ids.includes(s.id));
}
function currentCols() {
  return (FORM_KINDS[formKind] || FORM_KINDS.leaf).cols;
}
function gridCustomers() {
  return loadNqCustomers();
}
function formKindOfSku(skuId) {
  for (const [k, def] of Object.entries(FORM_KINDS)) {
    if (def.skuIds.includes(skuId)) return k;
  }
  return "leaf";
}
function formCustKey() {
  return FORM_KINDS[formKind] ? formKind : "leaf";
}
function asNameList(v) {
  if (!Array.isArray(v)) return [];
  return v.map((s) => String(s).trim()).filter(Boolean);
}
function loadNqLists() {
  try {
    const raw = JSON.parse(localStorage.getItem(NQ_CUST_KEY) || "null");
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return {
        leaf: asNameList(raw.leaf),
        basil: asNameList(raw.basil),
        herb: asNameList(raw.herb),
      };
    }
  } catch (_) {}
  let old = [];
  try {
    old = asNameList(JSON.parse(localStorage.getItem(NQ_CUST_KEY_OLD) || "[]"));
  } catch (_) {}
  const lists = { leaf: [...old], basil: [...old], herb: [...old] };
  localStorage.setItem(NQ_CUST_KEY, JSON.stringify(lists));
  return lists;
}
function saveNqLists(lists) {
  localStorage.setItem(NQ_CUST_KEY, JSON.stringify(lists));
  scheduleCloudPush();
}
function loadNqCustomers(kind = formCustKey()) {
  const extras = asNameList(loadNqLists()[kind]).filter((n) => !NQ_DEFAULT_CUSTOMERS.includes(n));
  return [...NQ_DEFAULT_CUSTOMERS, ...extras];
}
function addNqCustomer(name, kind = formCustKey()) {
  const n = name.trim();
  if (!n) return false;
  if (NQ_DEFAULT_CUSTOMERS.includes(n)) return true;
  const lists = loadNqLists();
  const extras = asNameList(lists[kind]).filter((x) => x !== n && !NQ_DEFAULT_CUSTOMERS.includes(x));
  extras.push(n);
  lists[kind] = extras;
  saveNqLists(lists);
  return true;
}
function removeNqCustomer(name, kind = formCustKey()) {
  if (NQ_DEFAULT_CUSTOMERS.includes(name)) return;
  const lists = loadNqLists();
  lists[kind] = asNameList(lists[kind]).filter((x) => x !== name);
  saveNqLists(lists);
}
function formRowKeys(kind = formCustKey()) {
  const keys = (FORM_KINDS[kind] || FORM_KINDS.leaf).cols.map((c) => c.key);
  if (kind === "basil") {
    keys.push(
      "vendor",
      "vendors",
      "rbFang",
      "gbFang",
      "rbOth",
      "gbOth",
      "rbLin",
      "gbLin",
      "rbOthNote",
      "gbOthNote",
      "rbVendor",
      "gbVendor",
      "_basil3",
    );
  }
  keys.push("rest");
  return keys;
}
function clearFormFields(row, kind = formCustKey()) {
  if (!row) return;
  for (const k of formRowKeys(kind)) delete row[k];
}
function loadStaffList() {
  try {
    return asNameList(JSON.parse(localStorage.getItem(STAFF_LIST_KEY) || "[]"));
  } catch (_) {
    return [];
  }
}
function saveStaffList(list) {
  localStorage.setItem(STAFF_LIST_KEY, JSON.stringify(asNameList(list).slice(0, 20)));
  scheduleCloudPush();
}
const STAFF_ROSTER = [
  { name: "現場", role: "site" },
  { name: "凱婷", role: "acct" },
  { name: "曉琪", role: "acct" },
  { name: "子羽", role: "acct" },
  { name: "小胖", role: "driver" },
  { name: "善存", role: "driver" },
  { name: "雅芳", role: "boss" },
];
const ROLE_LABEL = { site: "現場", acct: "會計", driver: "司機", boss: "主管" };
function staffByName(name) {
  return STAFF_ROSTER.find((p) => p.name === String(name || "").trim());
}
function currentStaff() {
  try {
    const n = String(localStorage.getItem(STAFF_NOW_KEY) || "").trim();
    return staffByName(n) ? n : "";
  } catch (_) {
    return "";
  }
}
function currentRole() {
  return staffByName(currentStaff())?.role || "";
}
function can(action) {
  const r = currentRole();
  if (!r) return false;
  if (r === "boss") return true;
  if (action === "page-plan" || action === "view-ship") return r === "site" || r === "driver" || r === "acct";
  if (action === "page-orders" || action === "order" || action === "count" || action === "inbound" || action === "ship-books" || action === "edit" || action === "delete" || action === "cancel") {
    return r === "acct";
  }
  if (action === "page-books" || action === "books-stock" || action === "books-in" || action === "books-sales") return r === "acct";
  if (action === "ship-plan" || action === "take-run" || action === "deliver") return r === "driver";
  if (action === "assign-driver") return r === "acct";
  if (action === "split-run") return r === "acct" || r === "driver";
  if (action === "edit-shipped") return r === "acct";
  if (action === "fix-morning") return false;
  return false;
}
function requireStaff() {
  const n = currentStaff();
  if (n) return n;
  setStatus("請先點右上角登入。", true);
  openLoginGate();
  return "";
}
function requireCan(action, msg) {
  if (!requireStaff()) return "";
  if (can(action)) return currentStaff();
  setStatus(msg || "沒有這個權限。", true);
  return "";
}
const BOSS_PIN = "1227";
let loginPinName = "";
let loginPickerOpen = false;
function staffNeedsPin(name) {
  return staffByName(name)?.role === "boss";
}
function rememberStaff(name) {
  const n = String(name || "").trim();
  if (!staffByName(n)) return;
  try {
    localStorage.setItem(STAFF_NOW_KEY, n);
  } catch (_) {}
}
function hideLoginPin() {
  loginPinName = "";
  const pin = document.getElementById("login-pin");
  const people = document.getElementById("login-people");
  const err = document.getElementById("login-pin-err");
  const input = document.getElementById("login-pin-input");
  if (pin) pin.hidden = true;
  if (people) people.hidden = false;
  if (err) err.hidden = true;
  if (input) input.value = "";
}
function showLoginPin(name) {
  loginPinName = name;
  const pin = document.getElementById("login-pin");
  const people = document.getElementById("login-people");
  const who = document.getElementById("login-pin-who");
  const err = document.getElementById("login-pin-err");
  const input = document.getElementById("login-pin-input");
  if (who) who.textContent = `請輸入${name}的主管密碼`;
  if (people) people.hidden = true;
  if (pin) pin.hidden = false;
  if (err) err.hidden = true;
  if (input) {
    input.value = "";
    setTimeout(() => input.focus(), 30);
  }
}
function returnToLogin() {
  try {
    localStorage.removeItem(STAFF_NOW_KEY);
  } catch (_) {}
  loginPickerOpen = false;
  hideLoginPin();
  openLoginGate();
  renderLoginPeople();
  render();
}
function finishLogin(name) {
  rememberStaff(name);
  loginPickerOpen = false;
  hideLoginPin();
  closeLoginGate();
  page = homePage();
  hubOpen = "";
  render();
}
function pickLoginPerson(name) {
  const n = String(name || "").trim();
  if (!staffByName(n)) return;
  if (staffNeedsPin(n) && currentStaff() !== n) {
    showLoginPin(n);
    return;
  }
  finishLogin(n);
}
function submitLoginPin() {
  const input = document.getElementById("login-pin-input");
  const err = document.getElementById("login-pin-err");
  const pin = String(input?.value || "").trim();
  if (!loginPinName || !staffNeedsPin(loginPinName)) return;
  if (pin === BOSS_PIN) {
    finishLogin(loginPinName);
    return;
  }
  if (err) err.hidden = false;
  if (input) {
    input.value = "";
    input.focus();
  }
}
function homePage() {
  return "home";
}
function goHome() {
  page = "home";
  hubOpen = "";
  render();
}
function soonCopy(kind) {
  if (kind === "cust") return { title: "客戶", hint: "之後會放客戶資料、常用出貨對象與對帳。現在開單時直接填出貨對象即可。" };
  if (kind === "vendor") return { title: "廠商", hint: "之後會放進貨廠商與對帳。現在請到倉管的進貨記入。" };
  if (kind === "freight") return { title: "貨運核帳", hint: "之後會放貨運費用、對帳與核銷。目前先用派貨與出貨帳單核對。" };
  return { title: "即將開放", hint: "這項還在整理。" };
}
function hubSvg(name) {
  const d = {
    clip: '<rect x="7" y="4" width="10" height="16" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/><path d="M10 4h4v2h-4z"/>',
    house: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6.5 10.5V20h11V10.5"/>',
    form: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 13h6M9 17h4"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M5 6.2 6.2 7.5 8 5.2M5 12.2 6.2 13.5 8 11.2M5 18.2 6.2 19.5 8 17.2"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3.5v3M16 3.5v3M3.5 10h17"/>',
    truck: '<path d="M3 16h1.2a2.4 2.4 0 0 0 4.6 0h5.2a2.4 2.4 0 0 0 4.6 0H21v-4.2L18 8h-5v8"/><path d="M3 16V9h10"/><circle cx="7.5" cy="16.2" r="1.5"/><circle cx="17.3" cy="16.2" r="1.5"/>',
    box: '<path d="M3.5 8.2 12 4.2l8.5 4-8.5 4z"/><path d="M3.5 8.2v7.6L12 20l8.5-4.2V8.2M12 12.2V20"/>',
    inbox: '<path d="M12 4v10"/><path d="M8 10.5 12 15l4-4.5"/><path d="M4.5 20h15"/><path d="M5 16.5 4.5 20h15L19 16.5"/>',
    person: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.6-3.4 3.2-5.2 6.5-5.2s5.9 1.8 6.5 5.2"/>',
    shop: '<path d="M4 10V21h16V10"/><path d="M3 7.5 5.2 4h13.6L21 7.5a3.2 3.2 0 0 1-6.4 0 3.2 3.2 0 0 1-6.4 0A3.2 3.2 0 0 1 3 7.5z"/><path d="M10 21v-6h4v6"/>',
    bill: '<path d="M7 3.5h10l.8 2.4V20l-2.6-1.2L12 20l-3.2-1.2L6.2 20V5.9z"/><path d="M9.5 10h5M9.5 13.5h5"/>',
    crate: '<path d="M4 8h16v11H4z"/><path d="M4 8 7 4h10l3 4M12 8v11M4 13h16"/>',
    rack: '<path d="M4 5h16M4 12h16M4 19h16M6 5v14M18 5v14"/>',
    coin: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.4v9.2M9.4 9.2c.7-1 2.4-1.4 3.5-.4s.7 2.4-.6 3c-1.4.6-2.6.4-3.4 1.6-.6.9.1 2.4 2.1 2.6 1.5.2 2.8-.4 3.4-1.2"/>',
  };
  return `<span class="hub-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d[name] || d.clip}</svg></span>`;
}
function hubLink(attrs, icon, label, extraClass) {
  return `<button type="button" class="hub-link${extraClass ? ` ${extraClass}` : ""}" ${attrs}>${hubSvg(icon)}<span class="hub-lab">${esc(label)}</span></button>`;
}
function renderHomeHub() {
  const box = document.getElementById("home-hub");
  if (!box) return;
  if (!currentStaff()) {
    box.innerHTML = "";
    box.classList.remove("hub-pick");
    return;
  }
  const orderBtns = [];
  if (can("page-orders")) {
    orderBtns.push(hubLink('data-go="orders" data-orders-pane="form"', "form", "開單"));
    orderBtns.push(hubLink('data-go="orders" data-orders-pane="today"', "list", "今日已填"));
  }
  if (can("page-plan")) {
    if (currentRole() !== "driver") orderBtns.push(hubLink('data-go="plan" data-plan-main="short"', "cal", "排程"));
    orderBtns.push(hubLink('data-go="plan" data-plan-main="ship"', "truck", "派貨"));
  }
  const wareBtns = [];
  if (can("page-books")) {
    wareBtns.push(hubLink('data-go="books" data-books="stock"', "crate", "資材／庫存"));
    wareBtns.push(hubLink('data-go="books" data-books="in"', "inbox", "進貨"));
    wareBtns.push(hubLink('data-go="books" data-books="rack"', "rack", "鐵架／八格籃"));
  }
  const acctBtns = [];
  if (can("page-books")) {
    acctBtns.push(hubLink('data-go="soon" data-soon="cust"', "person", "客戶", "soon"));
    acctBtns.push(hubLink('data-go="soon" data-soon="vendor"', "shop", "廠商", "soon"));
    acctBtns.push(hubLink('data-go="soon" data-soon="freight"', "truck", "貨運核帳", "soon"));
    acctBtns.push(hubLink('data-go="books" data-books="sales"', "bill", "出貨帳單"));
  }
  const card = (id, tone, icon, title, btns) => {
    if (!btns.length) return "";
    return `<button type="button" class="hub-tile hub-${tone}" data-hub="${id}">
      <span class="hub-mark" aria-hidden="true">${hubSvg(icon)}</span>
      <h2>${esc(title)}</h2>
    </button>`;
  };
  const openCard = (id, tone, icon, title, btns) => {
    return `<section class="hub-card hub-${tone} is-open">
      <div class="hub-head">
        <span class="hub-mark" aria-hidden="true">${hubSvg(icon)}</span>
        <h2>${esc(title)}</h2>
        <button type="button" class="ghost hub-back" data-hub-back>返回</button>
      </div>
      <div class="hub-links">${btns.join("")}</div>
    </section>`;
  };
  const tiles = [
    { id: "orders", tone: "orders", icon: "clip", title: "訂單區", btns: orderBtns },
    { id: "ware", tone: "ware", icon: "box", title: "倉管", btns: wareBtns },
    { id: "acct", tone: "acct", icon: "coin", title: "帳款業務", btns: acctBtns },
  ].filter((x) => x.btns.length);
  if (hubOpen) {
    const cur = tiles.find((x) => x.id === hubOpen);
    box.classList.remove("hub-pick");
    box.innerHTML = cur
      ? openCard(cur.id, cur.tone, cur.icon, cur.title, cur.btns)
      : tiles.map((x) => card(x.id, x.tone, x.icon, x.title, x.btns)).join("");
    if (!cur) box.classList.add("hub-pick");
    return;
  }
  box.classList.add("hub-pick");
  box.innerHTML = tiles.map((x) => card(x.id, x.tone, x.icon, x.title, x.btns)).join("");
}
function goFromHub(btn) {
  const go = btn.dataset.go;
  if (go === "orders") {
    if (!can("page-orders")) return setStatus("沒有訂單權限。", true);
    page = "orders";
    ordersPane = btn.dataset.ordersPane === "today" ? "today" : "form";
  } else if (go === "plan") {
    if (!can("page-plan")) return setStatus("沒有排程權限。", true);
    page = "plan";
    planMain = btn.dataset.planMain === "ship" ? "ship" : "short";
  } else if (go === "books") {
    if (!can("page-books")) return setStatus("沒有倉管／帳款權限。", true);
    page = "books";
    booksPart = btn.dataset.books || "stock";
    if (booksPart === "rack") {
      rackPick = "";
      rackLine = "";
    }
  } else if (go === "soon") {
    page = "soon";
    const copy = soonCopy(btn.dataset.soon);
    const title = document.getElementById("soon-title");
    const hint = document.getElementById("soon-hint");
    if (title) title.textContent = copy.title;
    if (hint) hint.textContent = copy.hint;
  }
  render();
}
function openLoginGate() {
  const gate = document.getElementById("login-gate");
  if (gate) gate.hidden = false;
}
function closeLoginGate() {
  loginPickerOpen = false;
  hideLoginPin();
  const gate = document.getElementById("login-gate");
  if (gate) gate.hidden = true;
}
function renderLoginPeople() {
  const box = document.getElementById("login-people");
  if (!box) return;
  const groups = [
    { role: "site", names: STAFF_ROSTER.filter((p) => p.role === "site") },
    { role: "acct", names: STAFF_ROSTER.filter((p) => p.role === "acct") },
    { role: "driver", names: STAFF_ROSTER.filter((p) => p.role === "driver") },
    { role: "boss", names: STAFF_ROSTER.filter((p) => p.role === "boss") },
  ];
  box.innerHTML = groups
    .map(
      (g) =>
        `<p class="login-role">${esc(ROLE_LABEL[g.role])}</p><div class="login-people">${g.names
          .map((p) => `<button type="button" class="pick" data-login="${esc(p.name)}">${esc(p.name)}</button>`)
          .join("")}</div>`,
    )
    .join("");
}
function applyRoleUi() {
  const logged = !!currentStaff();
  const who = document.getElementById("who-btn");
  const now = document.getElementById("who-now");
  if (who) who.textContent = logged ? "切換使用者" : "登入";
  if (now) {
    now.hidden = !logged;
    now.textContent = logged ? currentStaff() : "";
  }
  if (!logged) {
    openLoginGate();
    if (!loginPinName) renderLoginPeople();
  } else if (!loginPickerOpen) closeLoginGate();
  const pages = ["home"];
  if (can("page-orders")) pages.push("orders");
  if (can("page-plan")) pages.push("plan");
  if (can("page-books")) pages.push("books");
  pages.push("soon");
  document.querySelectorAll("#flow-tabs [data-page]").forEach((b) => {
    b.hidden = true;
  });
  const flow = document.getElementById("flow-tabs");
  if (flow) flow.hidden = true;
  const homeBtn = document.getElementById("home-btn");
  if (homeBtn) homeBtn.hidden = !logged || page === "home";
  if (logged && page && !pages.includes(page)) page = homePage();
  if (!can("page-books") && page === "books") page = homePage();
}
function markOrderEdited(o) {
  o.edited = true;
  o.editedBy = currentStaff();
  o.editedAt = Date.now();
}
function staffNote(o) {
  const bits = [];
  if (o.enteredBy) bits.push(`入單 ${o.enteredBy}`);
  else bits.push("入單未填會計");
  if (o.edited) bits.push(`已改單 ${o.editedBy || "未填會計"}`);
  if (o.assignedDriver) bits.push(`${o.status === "open" && o.runOut ? "接單處理中" : o.status === "open" ? "派單" : "司機"} ${o.assignedDriver}`);
  if (o.deliveredBy) bits.push(`送達 ${o.deliveredBy}`);
  if (o.shippedBy) bits.push(`出貨 ${o.shippedBy}`);
  if (o.cancelledBy) bits.push(`取消 ${o.cancelledBy}`);
  if (o.deletedBy) bits.push(`已刪除 ${o.deletedBy}`);
  return bits.join("　");
}
function staffNoteHtml(o) {
  const bits = [];
  if (o.enteredBy) bits.push(`<span class="n-enter">入單 ${esc(o.enteredBy)}</span>`);
  else bits.push(`<span class="n-enter">入單未填會計</span>`);
  if (o.edited) bits.push(`<span class="order-edit-who">已改單 ${esc(o.editedBy || "未填會計")}</span>`);
  if (o.assignedDriver) bits.push(`<span class="n-ship">${esc(o.status === "open" && o.runOut ? "接單處理中" : o.status === "open" ? "派單" : "司機")} ${esc(o.assignedDriver)}</span>`);
  if (o.deliveredBy) bits.push(`<span class="n-ship">送達 ${esc(o.deliveredBy)}</span>`);
  if (o.shippedBy) bits.push(`<span class="n-ship">出貨 ${esc(o.shippedBy)}</span>`);
  if (o.cancelledBy) bits.push(`<span class="n-cancel">取消 ${esc(o.cancelledBy)}</span>`);
  if (o.deletedBy) bits.push(`<span class="order-edit-who">已刪除 ${esc(o.deletedBy)}</span>`);
  return bits.join("　");
}
function renderStaffChips() {
  applyRoleUi();
}
function loadHaCustomers() {
  try {
    const list = JSON.parse(localStorage.getItem(HA_CUST_KEY) || "[]");
    if (!Array.isArray(list)) return [];
    return list.map((s) => String(s).trim()).filter(Boolean);
  } catch (_) {
    return [];
  }
}
function saveHaCustomers(list) {
  localStorage.setItem(HA_CUST_KEY, JSON.stringify(list));
  scheduleCloudPush();
}
function rememberHaCustomer(name) {
  const n = name.trim();
  if (!n) return;
  const list = loadHaCustomers().filter((x) => x !== n);
  list.unshift(n);
  saveHaCustomers(list.slice(0, 40));
}
function loadAllCustomers() {
  const seen = new Set();
  const out = [];
  const add = (name) => {
    const n = String(name || "").trim();
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };
  for (const n of NQ_DEFAULT_CUSTOMERS) add(n);
  const nq = loadNqLists();
  for (const k of ["leaf", "basil", "herb"]) {
    for (const n of asNameList(nq[k])) add(n);
  }
  for (const n of loadHaCustomers()) add(n);
  for (const o of state.orders || []) add(o.customer);
  return out;
}
function rememberCustomer(name, lines) {
  const who = (name || "").trim();
  if (!who) return;
  const hasHa = (lines || []).some((l) => skuById(l.skuId)?.co === "ha");
  const hasNq = (lines || []).some((l) => skuById(l.skuId)?.co === "nq");
  if (hasHa) rememberHaCustomer(who);
  if (hasNq || !lines?.length) {
    addNqCustomer(who, "leaf");
    addNqCustomer(who, "basil");
    addNqCustomer(who, "herb");
  }
  rememberShipAddr(who, shipAddrValue());
}
function loadAddrMap() {
  try {
    const m = JSON.parse(localStorage.getItem(ADDR_KEY) || "{}");
    return m && typeof m === "object" ? m : {};
  } catch (_) {
    return {};
  }
}
function rememberShipAddr(customer, addr) {
  const who = String(customer || "").trim();
  const a = String(addr || "").trim();
  if (!who || !a) return;
  const m = loadAddrMap();
  m[who] = a;
  try {
    localStorage.setItem(ADDR_KEY, JSON.stringify(m));
  } catch (_) {}
}
function lastShipAddr(customer) {
  const who = String(customer || "").trim();
  if (!who) return "";
  const mapped = String(loadAddrMap()[who] || "").trim();
  if (mapped) return mapped;
  for (const o of state.orders || []) {
    if (namesMatch(o.customer, who) && String(o.shipAddr || "").trim()) return String(o.shipAddr).trim();
  }
  return "";
}
const SHIP_PRESETS = ["冰庫", "市場"];
function shipAddrModeOf(v) {
  const a = String(v || "").trim();
  if (SHIP_PRESETS.includes(a)) return a;
  if (a) return "其他";
  return "";
}
function destFromRemembered(addr) {
  const a = String(addr || "").trim();
  if (!a) return "";
  return a.split(/[／/]/)[0].trim();
}
function uniqueTicketDrops() {
  const seen = [];
  for (const l of ticketLines) {
    const d = String(l.dest || "").trim();
    if (d && !seen.includes(d)) seen.push(d);
  }
  return seen;
}
function lastTicketDest() {
  for (let i = ticketLines.length - 1; i >= 0; i--) {
    const d = String(ticketLines[i].dest || "").trim();
    if (d) return d;
  }
  return "";
}
function rememberedDest() {
  const last = lastTicketDest();
  if (last) return last;
  return destFromRemembered(lastShipAddr(document.getElementById("customer")?.value));
}
function lineDestMode(l) {
  const d = String(l?.dest || "").trim();
  if (SHIP_PRESETS.includes(d)) return d;
  if (d || l?.destOther) return "其他";
  return "";
}
function destPicksHtml(mode, attrs) {
  return ["冰庫", "市場", "其他"]
    .map(
      (v) =>
        `<button type="button" class="pick dest-chip${mode === v ? " on" : ""}" ${attrs(v)}>${v}</button>`,
    )
    .join("");
}
function applyDestToLine(line) {
  if (!line || String(line.dest || "").trim()) return line;
  const dest = rememberedDest();
  if (dest) line.dest = dest;
  return line;
}
function syncHiddenShipAddr() {
  const el = document.getElementById("ship-addr");
  if (el) el.value = uniqueTicketDrops().join("／");
}
function shipAddrValue() {
  const joined = uniqueTicketDrops().join("／");
  const el = document.getElementById("ship-addr");
  if (joined) {
    if (el) el.value = joined;
    return joined;
  }
  return String(el?.value || "").trim();
}
function syncShipAddrUi(v) {
  if (v != null) {
    const el = document.getElementById("ship-addr");
    if (el && !uniqueTicketDrops().length) el.value = String(v || "").trim();
    return;
  }
  syncHiddenShipAddr();
}
function setShipAddr(v) {
  const el = document.getElementById("ship-addr");
  if (el) el.value = String(v || "").trim();
}
function pickShipAddr(mode) {
  const next = String(mode || "").trim();
  if (SHIP_PRESETS.includes(next)) setShipAddr(next);
  else setShipAddr("");
  renderTicket();
}
function orderNoteValue() {
  return String(document.getElementById("order-note")?.value || "").trim();
}
function setOrderNote(v) {
  const el = document.getElementById("order-note");
  if (el) el.value = String(v || "");
}
function fillAddrForCustomer(name) {
  const dest = destFromRemembered(lastShipAddr(name));
  if (dest) {
    for (const l of ticketLines) {
      if (!String(l.dest || "").trim()) l.dest = dest;
    }
  }
  if (!ticketLines.length) setShipAddr(lastShipAddr(name));
  else syncHiddenShipAddr();
  renderTicket();
}
function removeAllCustomer(name) {
  removeHaCustomer(name);
  removeNqCustomer(name, "leaf");
  removeNqCustomer(name, "basil");
  removeNqCustomer(name, "herb");
}
function knownCustomersForParse() {
  const set = new Set(NQ_DEFAULT_CUSTOMERS);
  const nq = loadNqLists();
  for (const k of ["leaf", "basil", "herb"]) {
    for (const n of asNameList(nq[k])) set.add(n);
  }
  for (const n of loadHaCustomers()) set.add(n);
  for (const o of state.orders || []) {
    const n = (o.customer || "").trim();
    if (n) set.add(n);
  }
  return [...set];
}
function removeHaCustomer(name) {
  saveHaCustomers(loadHaCustomers().filter((x) => x !== name));
}
function ensureHaHistory() {
  if (loadHaCustomers().length) return;
  const names = [];
  for (const o of state.orders) {
    if (o.co !== "ha") continue;
    const n = (o.customer || "").trim();
    if (n && !names.includes(n)) names.push(n);
  }
  if (names.length) saveHaCustomers(names);
}
function ensureStockRow(id) {
  if (!state.stock[id]) state.stock[id] = { qty: 0, processed: 0, safety: 0 };
  return state.stock[id];
}
function ready(sku) {
  if (!sku) return 0;
  return isSiteSku(sku) ? ensureStockRow(sku.id).processed : onHand(sku);
}
function currentRecord() {
  return editing ? state.orders.find((x) => x.id === editing) : undefined;
}
/** 先填先佔：只算比 current 更早（單號較小）的未出貨紀錄。新紀錄則算全部已佔。 */
function orderRank(o) {
  return Number.isFinite(o.prio) ? o.prio : o.no;
}
function openQueue() {
  return state.orders
    .filter((o) => o.status === "open")
    .slice()
    .sort((a, b) => orderRank(a) - orderRank(b) || a.no - b.no);
}
function nextPrio() {
  let m = 0;
  for (const o of state.orders) m = Math.max(m, orderRank(o));
  return m + 1;
}
function orderFormKind(o) {
  const id = o.lines?.[0]?.skuId;
  return id ? formKindOfSku(id) : "leaf";
}
function visibleOpenQueue() {
  const day = ordersViewDay();
  return openQueue().filter((o) => (o.shipDate || today()) === day);
}
function bumpOrder(id, dir) {
  const list = visibleOpenQueue();
  const i = list.findIndex((o) => o.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const a = orderRank(list[i]);
  const b = orderRank(list[j]);
  list[i].prio = b;
  list[j].prio = a;
  save();
  render();
}
function reservedAhead(skuId, current, date) {
  const day = date || current?.shipDate || today();
  const sku = skuById(skuId);
  let n = 0;
  const curRank = current ? orderRank(current) : Infinity;
  for (const o of state.orders) {
    if (sku?.co && o.co !== sku.co) continue;
    if (o.status !== "open" && o.status !== "delivered") continue;
    if ((o.shipDate || today()) !== day) continue;
    if (current) {
      if (o.id === current.id) continue;
      if (orderRank(o) >= curRank) continue;
    }
    for (const line of o.lines) if (line.skuId === skuId) n += line.qty;
  }
  return n;
}
function reservedAll(skuId, date = today()) {
  return reservedAhead(skuId, undefined, date);
}
function available(sku, current, date) {
  if (isTradeSku(sku)) return 99999;
  const day = date || current?.shipDate || today();
  const on = isSiteSku(sku) ? ready(sku) : onHand(sku, day);
  return round(on - reservedAhead(sku.id, current, day));
}
function lineLabel(l, withUnit) {
  const s = skuById(l.skuId);
  const name = s ? s.name : l.skuId;
  const unit = s && withUnit ? ` ${s.unit}` : "";
  const pack = l.pack ? `（${l.pack}）` : "";
  const size = l.size ? `（${l.size}）` : "";
  const dest = l.dest ? `（${l.dest}）` : "";
  const note = l.note ? `（${l.note}）` : "";
  const pallet = l.pallet ? "（疊棧板）" : "";
  return `${name} ${fmt(l.qty)}${unit}${pack}${size}${dest}${note}${pallet}`;
}
function ticketLineName(l) {
  const s = skuById(l.skuId);
  const name = s ? s.name : l.skuId;
  const pack = l.pack ? ` ${l.pack}` : "";
  const size = l.size ? ` ${l.size}` : "";
  const pallet = l.pallet ? " 疊棧板" : "";
  const lot = l.lotContainer || l.lotUha ? ` ${l.lotContainer || l.lotUha}` : skuNeedsShipLot(l.skuId) ? " 未選編號" : "";
  return `${name}${pack}${size}${lot}${pallet}`;
}
function ticketWhoText() {
  return document.getElementById("customer")?.value.trim() || "尚未填出貨對象";
}
function shipDateValue() {
  return document.getElementById("ship-date")?.value || today();
}
function isPreorderDay(day = shipDateValue()) {
  return String(day || "") > today();
}
function shortDay(ymd) {
  const p = String(ymd || "").split("-");
  if (p.length !== 3) return ymd || "";
  return `${Number(p[1])}/${Number(p[2])}`;
}
function shipKindLabel(day = shipDateValue()) {
  const d = day || today();
  return isPreorderDay(d) ? `預開 ${shortDay(d)}` : `當日 ${shortDay(d)}`;
}
function syncShipMore() {
  const el = document.getElementById("ship-date");
  const sum = document.getElementById("ship-more-sum");
  const box = document.getElementById("ship-more");
  const submit = document.getElementById("order-submit");
  if (!el) return;
  if (!el.value) el.value = today();
  const day = el.value;
  const pre = isPreorderDay(day);
  if (sum) sum.textContent = shipKindLabel(day);
  if (box) {
    box.classList.toggle("is-pre", pre);
    if (!pre) box.open = false;
  }
  if (submit) {
    if (editing) submit.textContent = "確認改單";
    else submit.textContent = pre ? "確認預訂單" : "確認送出";
  }
}
function ticketDestHtml(l, i) {
  const mode = lineDestMode(l);
  const dest = String(l.dest || "").trim();
  const otherVal = mode === "其他" ? dest : "";
  return `<div class="ticket-dest">
      <div class="picks dest-picks">${destPicksHtml(mode, (v) => `data-ticket-dest="${i}" data-dest="${v}"`)}</div>
      <input class="dest-other" data-ticket-dest-other="${i}" type="text" placeholder="其他位置" value="${esc(otherVal)}" ${mode === "其他" ? "" : "hidden"} autocomplete="off" />
    </div>`;
}
function renderTicket() {
  const box = document.getElementById("ticket");
  if (!box) return;
  const kind = shipKindLabel();
  const who = ticketWhoText();
  if (!ticketLines.length) {
    box.classList.add("is-empty");
    box.innerHTML = `<p class="ticket-empty">本單還沒有品項<span class="ticket-kind">${esc(kind)}</span></p>`;
    syncOrderEntering();
    return;
  }
  box.classList.remove("is-empty");
  const drops = uniqueTicketDrops();
  box.innerHTML = `<p class="ticket-head">待確認 <span>${esc(who)}</span><span class="ticket-kind">${esc(kind)}</span></p>
    ${drops.length ? `<p class="ticket-addr">${esc(drops.join("／"))}</p>` : ""}
    <ul class="ticket-list">${ticketLines
      .map((l, i) => {
        const sku = skuById(l.skuId);
        const step = sku ? skuStep(sku) : 1;
        return `<li>
          <span class="ticket-name">${esc(ticketLineName(l))}</span>
          <input class="qty" data-ticket-qty data-i="${i}" type="number" min="0" step="${step}" inputmode="decimal" value="${esc(l.qty)}" aria-label="數量" />
          <span class="unit">${esc(sku?.unit || "")}</span>
          <button type="button" class="pick ticket-pallet${l.pallet ? " on" : ""}" data-ticket-pallet="${i}" aria-pressed="${l.pallet ? "true" : "false"}">疊棧板</button>
          ${
            skuNeedsShipLot(l.skuId)
              ? `<button type="button" class="ghost lot-pick-btn" data-ticket-lot="${i}">${esc(l.lotContainer || l.lotUha || "選出貨編號")}</button>`
              : ""
          }
          <button type="button" class="tiny-btn ghost" data-ticket-del="${i}">刪</button>
          ${ticketDestHtml(l, i)}
        </li>`;
      })
      .join("")}</ul>`;
  syncOrderEntering();
}
function selectPickerBig(big) {
  const row = document.querySelector("#ha-lines .item-line");
  if (!row || !big) return;
  const btn = [...row.querySelectorAll(".pick[data-k='big']")].find((b) => b.dataset.v === big);
  if (!btn) return;
  row.querySelectorAll(".pick[data-k='big']").forEach((b) => b.classList.toggle("on", b === btn));
  const sub = row.querySelector("[data-sub]");
  if (sub) sub.innerHTML = lineSubHtml(big, {});
  syncLineMeta(row);
}
function pushPickerToTicket(nextBig) {
  const extra = unifiedLinesFromForm();
  if (!extra.length && !nextBig) {
    setStatus("請先選品項並填數量", true);
    return false;
  }
  const needLot = extra.find((l) => skuNeedsShipLot(l.skuId) && !l.lotUha);
  if (needLot) {
    openLotModal({ skuId: needLot.skuId, qty: needLot.qty, selectedUha: formLot?.uha, addAfter: true });
    return false;
  }
  for (const l of extra) ticketLines.push(applyDestToLine({ ...l }));
  formLot = null;
  renderItemSheet();
  if (nextBig) selectPickerBig(nextBig);
  renderTicket();
  renderCheck();
  document.querySelector("#sheet [data-line-qty]")?.focus();
  return extra.length > 0;
}
function clearTicket() {
  ticketLines = [];
  renderTicket();
}
function isOrderEntering() {
  if (page !== "orders") return false;
  const form = document.getElementById("order-form");
  if (!form || form.hidden) return false;
  const who = document.getElementById("customer")?.value?.trim();
  const qtyOn = [...document.querySelectorAll("#sheet [data-line-qty]")].some((el) => Number(el.value) > 0);
  const note = document.getElementById("order-note")?.value?.trim();
  const edit = document.getElementById("edit-id")?.value;
  return !!(who || qtyOn || ticketLines.length || note || edit);
}
function syncOrderEntering() {
  const on = isOrderEntering();
  const was = document.body.classList.contains("order-entering");
  document.body.classList.toggle("order-entering", on);
  if (on && ordersPane !== "form") {
    ordersPane = "form";
    applyOrdersPane(false);
  }
  if (on && !was) {
    const drafts = document.getElementById("line-draft-card");
    if (drafts) drafts.open = false;
    document.getElementById("order-form")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}
function cleanLine(l) {
  const out = { ...l };
  delete out.destOther;
  if (!String(out.dest || "").trim()) delete out.dest;
  if (!String(out.note || "").trim()) delete out.note;
  return out;
}
function workingLines() {
  const extra = unifiedLinesFromForm().map((l) => applyDestToLine({ ...l }));
  return [...ticketLines, ...extra].map(cleanLine);
}

function setStatus(text, err) {
  const el = document.getElementById("status");
  el.hidden = !text;
  el.textContent = text;
  el.classList.toggle("err", !!err);
}

function lineChecks(qtyMap, current) {
  const rows = [];
  let worst = "ok";
  const day = current?.shipDate || ordersViewDay();
  for (const sku of SKUS) {
    const need = qtyMap[sku.id] || 0;
    if (!(need > 0)) continue;
    if (isTradeSku(sku)) continue;
    const av = available(sku, current, day);
    const after = round(av - need);
    const safety = state.stock[sku.id].safety;
    let level = "ok";
    if (need > av) level = "bad";
    else if (after < safety) level = "warn";
    if (level === "bad") worst = "bad";
    else if (level === "warn" && worst === "ok") worst = "warn";
    rows.push({ sku, need, av, after, safety, level });
  }
  return { rows, worst };
}

const HA_ONION_ORIGINS = ["紐西蘭", "澳洲", "韓國", "越南"];
const HA_ONION_SPECS = ["20K", "12K"];
const HA_ONION_SIZES = ["大球", "特大", "中球"];
const HA_PK_VARS = ["密本", "阿成"];
const HA_PK_SPECS = ["18K", "20K"];
const HA_ORIGIN_CODE = { 紐西蘭: "nz", 澳洲: "au", 韓國: "kr", 越南: "vn" };
const HA_PK_CODE = { 密本: "mi", 阿成: "ch" };
function optsHtml(list, selected) {
  return list.map((v) => `<option value="${esc(v)}"${v === selected ? " selected" : ""}>${esc(v)}</option>`).join("");
}
function haOnionSku(origin, spec, purple) {
  const o = HA_ORIGIN_CODE[origin] || "nz";
  const s = spec === "12K" ? "12" : "20";
  return `${purple ? "onp" : "on"}-${o}-${s}`;
}
function haPkSku(kind, spec) {
  const k = HA_PK_CODE[kind] || "mi";
  const s = spec === "20K" ? "20" : "18";
  return `pk-${k}-${s}`;
}
function haParseSku(id) {
  if (id === "on-b-kg") return { kind: "on-b" };
  if (id === "pk-b-kg") return { kind: "pk-b" };
  const onp = String(id || "").match(/^onp-(nz|au|kr|vn)-(20|12)$/);
  if (onp) {
    const origin = { nz: "紐西蘭", au: "澳洲", kr: "韓國", vn: "越南" }[onp[1]];
    return { kind: "on-p", origin, spec: onp[2] === "12" ? "12K" : "20K" };
  }
  const on = String(id || "").match(/^on-(nz|au|kr|vn)-(20|12)$/);
  if (on) {
    const origin = { nz: "紐西蘭", au: "澳洲", kr: "韓國", vn: "越南" }[on[1]];
    return { kind: "on", origin, spec: on[2] === "12" ? "12K" : "20K" };
  }
  const pk = String(id || "").match(/^pk-(mi|ch)-(18|20)$/);
  if (pk) {
    return { kind: "pk", variety: pk[1] === "mi" ? "密本" : "阿成", spec: pk[2] === "20" ? "20K" : "18K" };
  }
  return { kind: "on", origin: "紐西蘭", spec: "20K" };
}
function haUnitOf(kind) {
  if (kind === "pk") return "箱";
  if (kind === "on" || kind === "on-p") return "件";
  return "kg";
}
function haOnionSizeOf(rec = {}) {
  return HA_ONION_SIZES.includes(rec.size) ? rec.size : "大球";
}
function haExtrasHtml(kind, rec = {}) {
  if (kind === "on" || kind === "on-p") {
    return `<select data-ha-origin aria-label="產地">${optsHtml(HA_ONION_ORIGINS, rec.origin || "紐西蘭")}</select>
      <select data-ha-spec aria-label="規格">${optsHtml(HA_ONION_SPECS, rec.spec || "20K")}</select>
      <select data-ha-size aria-label="尺寸">${optsHtml(HA_ONION_SIZES, haOnionSizeOf(rec))}</select>`;
  }
  if (kind === "pk") {
    return `<select data-ha-var aria-label="品種">${optsHtml(HA_PK_VARS, rec.variety || "密本")}</select>
      <select data-ha-spec aria-label="規格">${optsHtml(HA_PK_SPECS, rec.spec || "18K")}</select>`;
  }
  return "";
}
function haLineHtml(rec = {}) {
  const parsed = rec.skuId ? haParseSku(rec.skuId) : { kind: rec.kind || "on", origin: "紐西蘭", spec: "20K", variety: "密本" };
  parsed.size = rec.size;
  const kind = parsed.kind || "on";
  const qty = rec.qty > 0 ? rec.qty : "";
  const kinds = [
    ["on", "洋蔥"],
    ["on-p", "紫洋蔥"],
    ["pk", "南瓜"],
    ["on-b", "洋蔥B級"],
    ["pk-b", "南瓜B級"],
  ];
  const kindOpts = kinds.map(([v, lab]) => `<option value="${v}"${v === kind ? " selected" : ""}>${lab}</option>`).join("");
  return `<div class="ha-line">
    <select data-ha-kind aria-label="品項">${kindOpts}</select>
    <span data-ha-extras>${haExtrasHtml(kind, parsed)}</span>
    <input class="qty" data-ha-qty type="number" min="0" step="${kind.endsWith("-b") ? "0.1" : "1"}" inputmode="decimal" value="${esc(qty)}" placeholder="數量" aria-label="數量" />
    <span class="unit" data-ha-unit>${haUnitOf(kind)}</span>
    <label class="ha-pallet"><input type="checkbox" data-ha-pallet ${rec.pallet ? "checked" : ""} />疊棧板</label>
    <button type="button" class="tiny-btn ghost" data-ha-del>刪</button>
  </div>`;
}
function renderHaSheet(lines) {
  const rows = Array.isArray(lines) && lines.length ? lines : [{}];
  document.getElementById("sheet").innerHTML = `<div id="ha-lines">${rows.map((l) => haLineHtml(l)).join("")}</div>
    <button type="button" class="ghost" id="ha-add-line" data-ha-add>+ 加一筆</button>`;
}
function haLinesFromForm() {
  const out = [];
  document.querySelectorAll("#ha-lines .ha-line:not(.nq-line)").forEach((row) => {
    const kind = row.querySelector("[data-ha-kind]")?.value || "on";
    const qty = Number(row.querySelector("[data-ha-qty]")?.value);
    if (!(qty > 0)) return;
    let skuId = "on-nz-20";
    if (kind === "on-b") skuId = "on-b-kg";
    else if (kind === "pk-b") skuId = "pk-b-kg";
    else if (kind === "on" || kind === "on-p") {
      skuId = haOnionSku(
        row.querySelector("[data-ha-origin]")?.value,
        row.querySelector("[data-ha-spec]")?.value,
        kind === "on-p",
      );
    } else {
      skuId = haPkSku(row.querySelector("[data-ha-var]")?.value, row.querySelector("[data-ha-spec]")?.value);
    }
    const line = { skuId, qty: round(qty) };
    if (kind === "on" || kind === "on-p") line.size = haOnionSizeOf({ size: row.querySelector("[data-ha-size]")?.value });
    if (row.querySelector("[data-ha-pallet]")?.checked) line.pallet = true;
    out.push(line);
  });
  return out;
}

function useNqLineForm() {
  return true;
}
function useItemLines() {
  return true;
}
function isHaFam(fam) {
  return fam === "on" || fam === "on-p" || fam === "pk" || fam === "on-b" || fam === "pk-b";
}
function nqExtrasHtml(cat, rec = {}) {
  if (cat === "sl-zhi" || cat === "sl-fang") {
    const pack = rec.pack && PACK_OPTS.includes(rec.pack) ? rec.pack : "籃裝";
    return `<select data-nq-pack aria-label="裝箱">${optsHtml(PACK_OPTS, pack)}</select>`;
  }
  if (cat === "rb" || cat === "gb") {
    const vendor = rec.skuId && BASIL_REV[rec.skuId] && VENDOR_OPTS.includes(BASIL_REV[rec.skuId].val) ? BASIL_REV[rec.skuId].val : "芳";
    return `<select data-nq-vendor aria-label="廠商">${optsHtml(VENDOR_OPTS, vendor)}</select>`;
  }
  return "";
}
function nqUnitOfCat(cat, pack) {
  if (cat === "sl-zhi" || cat === "sl-fang" || cat === "leaf") return pack === "箱裝" ? "箱" : "籃";
  if (cat === "rb" || cat === "gb" || cat === "basil") return "箱";
  if (cat === "shiso-jin") return "斤";
  if (isHaFam(cat)) return haUnitOf(cat);
  if (isHaVegFam(cat)) return "件";
  return "kg";
}
function lineBigOf(rec = {}) {
  const fam = lineFamOf(rec);
  if (fam === "sl-zhi" || fam === "sl-fang") return "leaf";
  if (fam === "rb" || fam === "gb") return "basil";
  return fam || "";
}
function pickHtml(key, items, selected) {
  return items
    .map(
      ([v, lab]) =>
        `<button type="button" class="pick${selected === v ? " on" : ""}" data-k="${esc(key)}" data-v="${esc(v)}">${esc(lab)}</button>`,
    )
    .join("");
}
function pickVal(row, key) {
  return row?.querySelector(`.pick[data-k="${CSS.escape(key)}"].on`)?.dataset.v || "";
}
function lineBigButtons(selected) {
  const nq = [
    ["leaf", "地瓜葉"],
    ["basil", "九層塔"],
    ["basil-kg", "九層塔散賣"],
  ];
  const ha = [
    ["on", "洋蔥"],
    ["on-p", "紫洋蔥"],
    ["on-b", "洋蔥B"],
    ["pk", "南瓜"],
    ["pk-b", "南瓜B"],
    ...Object.entries(HA_VEG).map(([id, def]) => [id, def.label]),
  ];
  return `<p class="pick-lab">穠全</p>
    <div class="picks">${pickHtml("big", nq, selected)}</div>
    <p class="pick-lab">鴻安</p>
    <div class="picks">${pickHtml("big", ha, selected)}</div>`;
}
function lineSubHtml(big, rec = {}) {
  if (!big) return "";
  const bits = [];
  if (big === "leaf") {
    const leaf = rec.skuId === "sl-fang" ? "sl-fang" : "sl-zhi";
    const pack = rec.pack && PACK_OPTS.includes(rec.pack) ? rec.pack : "籃裝";
    bits.push(`<p class="pick-lab">廠商</p><div class="picks">${pickHtml("leaf", [["sl-zhi", "誌"], ["sl-fang", "芳"]], leaf)}</div>`);
    bits.push(`<p class="pick-lab">裝箱</p><div class="picks">${pickHtml("pack", PACK_OPTS.map((p) => [p, p]), pack)}</div>`);
  } else if (big === "basil") {
    const parsed = BASIL_REV[rec.skuId] || { qty: "rb", val: "芳" };
    const kind = parsed.qty === "gb" ? "gb" : "rb";
    const vendor = VENDOR_OPTS.includes(parsed.val) ? parsed.val : "芳";
    bits.push(`<p class="pick-lab">種類</p><div class="picks">${pickHtml("basil", [["rb", "紅骨"], ["gb", "綠骨"]], kind)}</div>`);
    bits.push(`<p class="pick-lab">廠商</p><div class="picks">${pickHtml("vendor", VENDOR_OPTS.map((p) => [p, p]), vendor)}</div>`);
  } else if (isHaVegFam(big)) {
    const def = HA_VEG[big];
    const cur = rec.skuId ? skuById(rec.skuId)?.vegOpt : rec.vegOpt;
    const opt = def.opts.some((x) => x[0] === cur) ? cur : def.opts[0][0];
    bits.push(`<p class="pick-lab">國別／規格</p><div class="picks">${pickHtml("veg", def.opts, opt)}</div>`);
  } else if (big === "on" || big === "on-p") {
    const parsed = rec.skuId ? haParseSku(rec.skuId) : { origin: "紐西蘭", spec: "20K" };
    bits.push(`<p class="pick-lab">國別</p><div class="picks">${pickHtml("origin", HA_ONION_ORIGINS.map((p) => [p, p]), parsed.origin || "紐西蘭")}</div>`);
    bits.push(`<p class="pick-lab">規格</p><div class="picks">${pickHtml("spec", HA_ONION_SPECS.map((p) => [p, p]), parsed.spec || "20K")}</div>`);
    bits.push(`<p class="pick-lab">尺寸</p><div class="picks">${pickHtml("size", HA_ONION_SIZES.map((p) => [p, p]), haOnionSizeOf({ size: rec.size }))}</div>`);
  } else if (big === "pk") {
    const parsed = rec.skuId ? haParseSku(rec.skuId) : { variety: "密本", spec: "18K" };
    bits.push(`<p class="pick-lab">廠商</p><div class="picks">${pickHtml("var", HA_PK_VARS.map((p) => [p, p]), parsed.variety || "密本")}</div>`);
    bits.push(`<p class="pick-lab">規格</p><div class="picks">${pickHtml("pkspec", HA_PK_SPECS.map((p) => [p, p]), parsed.spec || "18K")}</div>`);
  }
  return bits.join("");
}
function syncLineMeta(row) {
  if (!row) return;
  const big = pickVal(row, "big");
  const pack = pickVal(row, "pack") || "籃裝";
  const unitFam = big === "leaf" ? pickVal(row, "leaf") || "sl-zhi" : big;
  const unit = row.querySelector("[data-line-unit]");
  if (unit) unit.textContent = nqUnitOfCat(unitFam, pack);
  const qty = row.querySelector("[data-line-qty]");
  if (qty) qty.step = big === "on-b" || big === "pk-b" || big === "basil-kg" ? "0.1" : "1";
  syncFormLotRow();
}
function lineFamOf(rec = {}) {
  const id = rec.skuId;
  if (id) {
    const sku = skuById(id);
    if (sku?.vegFam) return sku.vegFam;
    if (sku?.co === "ha") return haParseSku(id).kind;
    if (id === "sl-fang" || id === "sl-zhi") return id;
    if (BASIL_REV[id]) return BASIL_REV[id].qty;
    if (id === "mint-kg" || id === "shiso-kg" || id === "shiso-jin" || id === "basil-kg") return id;
  }
  return rec.fam || "sl-zhi";
}
function famExtrasHtml(fam, rec = {}) {
  if (isHaVegFam(fam)) {
    return `<span data-veg-extras>${haVegExtrasHtml(fam, rec)}</span>`;
  }
  if (isHaFam(fam)) {
    const parsed = rec.skuId ? haParseSku(rec.skuId) : { origin: "紐西蘭", spec: fam === "pk" ? "18K" : "20K", variety: "密本", size: rec.size };
    parsed.size = rec.size;
    return `<span data-ha-extras>${haExtrasHtml(fam, parsed)}</span>`;
  }
  return `<span data-nq-extras>${nqExtrasHtml(fam, rec)}</span>`;
}
function unifiedLineHtml(rec = {}) {
  const hasItem = !!(rec.skuId || rec.fam);
  const big = hasItem ? lineBigOf(rec) : "";
  const qty = rec.qty > 0 ? rec.qty : "";
  const step = big === "on-b" || big === "pk-b" || big === "basil-kg" ? "0.1" : "1";
  const pack = rec.pack || "籃裝";
  const unitFam = big === "leaf" ? (rec.skuId === "sl-fang" ? "sl-fang" : "sl-zhi") : big;
  return `<div class="ha-line item-line">
    <div class="pick-block">
      ${lineBigButtons(big)}
      <div data-sub>${lineSubHtml(big, rec)}</div>
    </div>
    <div class="line-qty-row">
      <input class="qty" data-line-qty type="number" min="0" step="${step}" inputmode="decimal" value="${esc(qty)}" placeholder="數量" aria-label="數量" />
      <span class="unit" data-line-unit>${big ? esc(nqUnitOfCat(unitFam, pack)) : ""}</span>
      <button type="button" class="tiny-btn ghost" data-ha-del>清掉</button>
    </div>
    <div class="lot-row" data-lot-row hidden>
      <button type="button" class="ghost lot-pick-btn" data-lot-pick-form>${esc(lotBtnLabel(formLot))}</button>
      <p class="hint lot-hint">8–9 月進櫃櫃號。改品項或數量會清掉已選編號。</p>
    </div>
    <div class="pallet-row">
      <button type="button" class="pallet-toggle${rec.pallet ? " on" : ""}" data-pallet-toggle aria-pressed="${rec.pallet ? "true" : "false"}">疊棧板</button>
    </div>
    <div class="item-add-bar">
      <button type="button" class="primary" data-ticket-add>加入本單</button>
    </div>
  </div>`;
}
function nqLineHtml(rec = {}) {
  return unifiedLineHtml(rec);
}
function itemLineHtml(rec = {}) {
  return unifiedLineHtml(rec);
}
function renderItemSheet() {
  document.getElementById("sheet").innerHTML = `<div id="ha-lines">${itemLineHtml({})}</div>`;
  syncFormLotRow();
}
function draftSkuFromFormRow() {
  const extra = unifiedLinesFromForm();
  if (extra[0]?.skuId) return extra[0];
  const row = document.querySelector("#ha-lines .item-line");
  if (!row) return null;
  const qty = Number(row.querySelector("[data-line-qty]")?.value) || 0;
  const big = pickVal(row, "big");
  if (!big) return null;
  const fakeQty = qty > 0 ? qty : 1;
  const qtyInput = row.querySelector("[data-line-qty]");
  const prev = qtyInput?.value;
  if (qtyInput && !(qty > 0)) qtyInput.value = "1";
  const lines = unifiedLinesFromForm();
  if (qtyInput) qtyInput.value = prev || "";
  const line = lines[0];
  if (!line) return null;
  line.qty = round(qty);
  return line;
}
function syncFormLotRow() {
  const row = document.querySelector("[data-lot-row]");
  const btn = document.querySelector("[data-lot-pick-form]");
  if (!row || !btn) return;
  const draft = draftSkuFromFormRow();
  const need = !!(draft?.skuId && skuNeedsShipLot(draft.skuId));
  row.hidden = !need;
  btn.textContent = lotBtnLabel(formLot);
}
function closeLotModal() {
  const gate = document.getElementById("lot-gate");
  if (gate) gate.hidden = true;
  lotPickCtx = null;
}
function openLotModal(ctx) {
  const sku = skuById(ctx.skuId);
  const qty = Number(ctx.qty) || 0;
  if (!sku || !(qty > 0)) {
    setStatus("請先選品項並填數量，再選出貨編號。", true);
    return;
  }
  const lots = lotsForSku(ctx.skuId);
  if (!lots.length) {
    setStatus("這個品項在 8–9 月進櫃沒有可選櫃號。", true);
    return;
  }
  lotPickCtx = ctx;
  const skip = { ticketIndex: ctx.ticketIndex };
  const list = lots
    .map((lot) => {
      const remain = lotRemain(lot, skip);
      const ok = remain >= qty && remain > 0;
      return { lot, remain, ok };
    })
    .sort((a, b) => Number(b.ok) - Number(a.ok) || String(a.lot.date).localeCompare(String(b.lot.date)));
  const body = list
    .map(({ lot, remain, ok }) => {
      const on = ctx.selectedUha === lot.uha ? " on" : "";
      const dis = ok ? "" : " disabled";
      return `<button type="button" class="lot-choice${on}${ok ? "" : " dim"}"${dis} data-pick-uha="${esc(lot.uha)}">
        <strong>${esc(lot.container || lot.uha)}</strong>
        <span>${esc(lot.uha)}　${esc(warehouseLabel(lot.wh))}</span>
        <span>進櫃 ${esc(lot.date)}　${esc(lot.product)}　剩餘 ${fmt(remain)}</span>
      </button>`;
    })
    .join("");
  const gate = document.getElementById("lot-gate");
  const box = document.getElementById("lot-list");
  const title = document.getElementById("lot-title");
  if (title) title.textContent = `選出貨編號 · ${sku.name} ${fmt(qty)}${sku.unit || ""}`;
  if (box) box.innerHTML = body || `<p class="empty">沒有可選櫃號</p>`;
  if (gate) gate.hidden = false;
}
function chooseLot(uha) {
  const ctx = lotPickCtx;
  const lot = allContainerLots().find((l) => l.uha === uha);
  if (!ctx || !lot) return;
  const remain = lotRemain(lot, { ticketIndex: ctx.ticketIndex });
  if (remain < Number(ctx.qty)) return;
  if (ctx.ticketIndex != null) {
    const line = ticketLines[ctx.ticketIndex];
    if (line) applyLotToLine(line, lot);
    closeLotModal();
    renderTicket();
    renderCheck();
    return;
  }
  formLot = { uha: lot.uha, container: lot.container, wh: lot.wh };
  closeLotModal();
  syncFormLotRow();
  if (ctx.addAfter) pushPickerToTicket();
}
function withPallet(row, line) {
  if (row.querySelector("[data-pallet-toggle]")?.classList.contains("on") || row.querySelector("[data-ha-pallet]")?.checked) {
    line.pallet = true;
  }
  return line;
}
function unifiedLinesFromForm() {
  const out = [];
  document.querySelectorAll("#ha-lines .item-line").forEach((row) => {
    const qty = Number(row.querySelector("[data-line-qty]")?.value);
    if (!(qty > 0)) return;
    const big = pickVal(row, "big");
    if (!big) return;
    if (isHaFam(big)) {
      let skuId = "on-nz-20";
      if (big === "on-b") skuId = "on-b-kg";
      else if (big === "pk-b") skuId = "pk-b-kg";
      else if (big === "on" || big === "on-p") {
        skuId = haOnionSku(pickVal(row, "origin"), pickVal(row, "spec"), big === "on-p");
      } else skuId = haPkSku(pickVal(row, "var"), pickVal(row, "pkspec"));
      const line = { skuId, qty: round(qty) };
      if (big === "on" || big === "on-p") line.size = haOnionSizeOf({ size: pickVal(row, "size") });
      out.push(withPallet(row, line));
      return;
    }
    if (isHaVegFam(big)) {
      const def = HA_VEG[big];
      const allowed = def.opts.map((x) => x[0]);
      let opt = pickVal(row, "veg");
      if (!allowed.includes(opt)) opt = allowed[0];
      out.push(withPallet(row, { skuId: haVegSkuId(big, opt), qty: round(qty) }));
      return;
    }
    if (big === "leaf") {
      out.push(withPallet(row, { skuId: pickVal(row, "leaf") || "sl-zhi", qty: round(qty), pack: pickVal(row, "pack") || "籃裝" }));
      return;
    }
    if (big === "basil") {
      const kind = pickVal(row, "basil") || "rb";
      const vendor = pickVal(row, "vendor") || "芳";
      out.push(withPallet(row, { skuId: BASIL_SKU[kind][vendor] || BASIL_SKU[kind]["芳"], qty: round(qty) }));
      return;
    }
    out.push(withPallet(row, { skuId: big, qty: round(qty) }));
  });
  return out;
}
function nqLinesFromForm() {
  return unifiedLinesFromForm().filter((l) => skuById(l.skuId)?.co === "nq");
}
function renderSheet() {
  if (useItemLines()) {
    renderItemSheet();
    renderTicket();
    return;
  }
  const current = currentRecord();
  const day = current?.shipDate || ordersViewDay();
  const html = formSkus()
    .map((sku) => {
      const av = available(sku, current, day);
      return `<tr><td class="name-cell">${esc(sku.name)}</td><td>${fmt(av)} ${sku.unit}</td>
        <td><input class="qty" data-sku="${sku.id}" type="number" min="0" step="${skuStep(sku)}" /></td></tr>`;
    })
    .join("");
  document.getElementById("sheet").innerHTML =
    `<table><thead><tr><th>品項（不混貨）</th><th>可出</th><th>數量</th></tr></thead><tbody>${html}</tbody></table>`;
}

function qtyMapFromForm() {
  const map = {};
  for (const l of workingLines()) map[l.skuId] = round((map[l.skuId] || 0) + l.qty);
  return map;
}
function packMapFromForm() {
  const map = {};
  const shared = document.getElementById("leaf-pack");
  if (shared) {
    for (const sku of SKUS) {
      if (sku.packRemark) map[sku.id] = shared.value || "籃裝";
    }
  }
  document.querySelectorAll("#sheet [data-pack-sku]").forEach((sel) => {
    map[sel.dataset.packSku] = sel.value;
  });
  return map;
}
function linesFromForm() {
  return workingLines();
}
function missingPack(lines) {
  return lines.some((l) => skuById(l.skuId)?.packRemark && !l.pack);
}
function qtyN(v) {
  const n = Number(v);
  return n > 0 ? n : 0;
}
function formAllowsRest() {
  return true;
}
function isRestText(v) {
  return String(v || "").trim() === "休";
}
function qtyColKeys(kind = formKind) {
  return (FORM_KINDS[kind] || FORM_KINDS.leaf).cols.filter((c) => c.kind === "qty").map((c) => c.key);
}
function rowRestState(row, kind = formKind) {
  if (!row) return "";
  if (row.rest) return "rest";
  const texts = qtyColKeys(kind).map((k) => String(row[k] ?? "").trim());
  const hasRest = texts.some(isRestText);
  const hasQty = texts.some((t) => qtyN(t) > 0);
  if (hasRest && hasQty) return "mix";
  if (hasRest) return "rest";
  return "";
}
function markRowRest(row, kind = formKind) {
  row.rest = true;
  for (const k of qtyColKeys(kind)) row[k] = "休";
}
function clearRowRest(row, kind = formKind) {
  if (!row) return;
  delete row.rest;
  for (const k of qtyColKeys(kind)) {
    if (isRestText(row[k])) delete row[k];
  }
}
function restKeyMatch(r, name, date) {
  return r.customer === name && r.date === date;
}
function upsertRest(name, date, kind = formKind) {
  if (!Array.isArray(state.rests)) state.rests = [];
  if (state.rests.some((r) => restKeyMatch(r, name, date, kind))) return;
  state.rests.push({
    id: uid(),
    co: "nq",
    formKind: kind,
    customer: name,
    date,
  });
  save();
}
function removeRest(name, date, kind = formKind) {
  if (!Array.isArray(state.rests)) return;
  state.rests = state.rests.filter((r) => !restKeyMatch(r, name, date, kind));
  save();
}
function sheetDate() {
  if (useNqLineForm()) return document.getElementById("ship-date")?.value || today();
  return document.getElementById("daily-sheet-date")?.value || today();
}
function ordersViewDay() {
  if (page === "books") return stockViewDay();
  return document.getElementById("orders-today-date")?.value || document.getElementById("ship-date")?.value || today();
}
function syncOrderDates(day) {
  const d = day || today();
  const ship = document.getElementById("ship-date");
  const daily = document.getElementById("daily-sheet-date");
  const todayEl = document.getElementById("orders-today-date");
  if (ship) ship.value = d;
  if (daily && daily.value !== d) daily.value = d;
  if (todayEl) todayEl.value = d;
  syncShipMore();
}
function goTodayAfterSave(ids, day) {
  highlightOrderIds = (ids || []).filter(Boolean);
  if (day) syncOrderDates(day);
  ordersPane = "today";
  page = "orders";
  window.clearTimeout(highlightTimer);
  highlightTimer = window.setTimeout(() => {
    highlightOrderIds = [];
    document.querySelectorAll(".order-card.just-in").forEach((el) => el.classList.remove("just-in"));
  }, 8000);
}
function applyOrdersPane(smooth) {
  document.querySelectorAll("#orders-pane-tabs [data-orders-pane]").forEach((b) => {
    b.classList.toggle("on", b.dataset.ordersPane === ordersPane);
  });
  const swipe = document.getElementById("orders-swipe");
  const pane = document.querySelector(`[data-orders-pane-page="${ordersPane}"]`);
  if (!swipe || !pane || page !== "orders") return;
  const go = () => {
    ordersPaneLock = true;
    const left = pane.offsetLeft;
    if (smooth) swipe.scrollTo({ left, behavior: "smooth" });
    else swipe.scrollLeft = left;
    window.setTimeout(() => {
      ordersPaneLock = false;
    }, smooth ? 420 : 80);
    const hit = document.querySelector("#orders-today .order-card.just-in");
    if (hit && ordersPane === "today") hit.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  if (swipe.clientWidth) go();
  else requestAnimationFrame(go);
}
function applyInPane(smooth) {
  const formBtn = document.querySelector('#in-pane-tabs [data-in-pane="form"]');
  if (formBtn) formBtn.textContent = co === "ha" ? "Excel 匯入" : "進貨輸入";
  document.querySelectorAll("#in-pane-tabs [data-in-pane]").forEach((b) => {
    b.classList.toggle("on", b.dataset.inPane === inPane);
  });
  const swipe = document.getElementById("in-swipe");
  const pane = document.querySelector(`#in-swipe [data-in-pane-page="${inPane}"]`);
  if (!swipe || !pane || page !== "books" || booksPart !== "in") return;
  const go = () => {
    inPaneLock = true;
    const left = pane.offsetLeft;
    if (smooth) swipe.scrollTo({ left, behavior: "smooth" });
    else swipe.scrollLeft = left;
    window.setTimeout(() => {
      inPaneLock = false;
    }, smooth ? 420 : 80);
  };
  if (swipe.clientWidth) go();
  else requestAnimationFrame(go);
}
function rackFmt(n) {
  return Number(n || 0).toLocaleString("zh-Hant-TW");
}
function rackMatch(name, q) {
  const n = String(name || "").toLowerCase();
  const qn = String(q || "").trim().toLowerCase();
  return !qn || n.includes(qn);
}
function rackSummary() {
  const lib = window.RackLib;
  if (!lib) return { customers: [], frames: [], cells: {}, frameLabels: {} };
  return lib.summarize(rackTxns, {
    from: rackMode === "custom" ? rackFrom || "" : "",
    to: rackTo,
    company: rackCo,
  });
}
function rackLabel(s, code) {
  return s.frameLabels?.[code] || code;
}
function rackTxnPool() {
  return rackTxns.filter((t) => {
    if (rackCo && t.company !== rackCo) return false;
    if (rackTo && t.date > rackTo) return false;
    if (rackMode === "custom" && rackFrom && t.date < rackFrom) return false;
    return true;
  });
}
function rackDateSpan() {
  const dates = rackTxns
    .filter((t) => !rackCo || t.company === rackCo)
    .map((t) => t.date)
    .filter(Boolean)
    .sort();
  if (!dates.length) return { from: "", to: "" };
  return { from: dates[0], to: dates[dates.length - 1] };
}
function paintRackRange() {
  const el = document.getElementById("rack-range");
  if (!el) return;
  if (rackLoad !== "done") {
    el.textContent = "統計區間載入中。匯入資料不一定到今天。";
    return;
  }
  const span = rackDateSpan();
  if (!span.to) {
    el.textContent = "尚無匯入進出，沒有統計區間。";
    return;
  }
  let text = `資料檔區間 ${span.from} ～ ${span.to}（以已匯入為準，不是系統今天）。`;
  if (rackMode === "custom" && rackFrom) {
    text += ` 比對區間 ${rackFrom} ～ ${rackTo}。`;
  } else {
    text += ` 查詢截至 ${rackTo}。`;
  }
  if (rackTo > span.to) text += ` 匯入最新只到 ${span.to}，之後尚未上傳。`;
  else if (rackTo < span.to) text += ` 目前只看到截至 ${rackTo}。`;
  el.textContent = text;
}
function rackCustomerFrameDocs(customer, frame) {
  const rows = rackTxnPool().filter((t) => t.customer === customer && t.frame === frame);
  const outMap = new Map();
  let inn = 0;
  for (const t of rows) {
    if (t.direction === "in") {
      inn += t.qty;
      continue;
    }
    const doc = t.doc || "（無單號）";
    const cur = outMap.get(doc) || { doc, date: t.date, qty: 0 };
    cur.qty += t.qty;
    if (t.date && (!cur.date || t.date < cur.date)) cur.date = t.date;
    outMap.set(doc, cur);
  }
  return {
    outs: [...outMap.values()].sort((a, b) => String(b.date).localeCompare(String(a.date))),
    inn,
  };
}
function ensureRackTxns() {
  if (rackLoad === "done" || rackLoad === "busy") return;
  rackLoad = "busy";
  fetch("./api/racks-txns", { cache: "no-store" })
    .then((r) => r.json())
    .then((j) => {
      rackTxns = Array.isArray(j?.txns) ? j.txns : Array.isArray(j) ? j : [];
      rackLoad = "done";
      renderRack();
    })
    .catch(() => {
      rackTxns = [];
      rackLoad = "done";
      renderRack();
    });
}
function reloadRackTxns() {
  rackLoad = "";
  ensureRackTxns();
}
function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}
function setRackImportMsg(text, kind) {
  const el = document.getElementById("rack-import-msg");
  if (!el) return;
  if (!text) {
    el.hidden = true;
    el.textContent = "";
    el.classList.remove("is-dup", "is-err");
    return;
  }
  el.hidden = false;
  el.textContent = text;
  el.classList.toggle("is-dup", kind === "dup");
  el.classList.toggle("is-err", kind === "err");
}
function fillRackFrameSelect(s) {
  const sel = document.getElementById("rack-frame");
  const wrapF = document.getElementById("rack-frame-wrap");
  const wrapQ = document.getElementById("rack-q-wrap");
  if (wrapF) wrapF.hidden = rackPane !== "frame";
  if (wrapQ) wrapQ.hidden = rackPane === "frame";
  if (!sel) return;
  const frames = (s?.frames || [])
    .map((f) => ({ f, label: rackLabel(s, f) }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));
  const cur = rackPane === "frame" ? rackPick : "";
  sel.innerHTML = `<option value="">全部</option>${frames
    .map((x) => `<option value="${esc(x.f)}"${x.f === cur ? " selected" : ""}>${esc(x.label)}</option>`)
    .join("")}`;
}
function renderRack() {
  const box = document.getElementById("rack-box");
  if (!box || page !== "books" || booksPart !== "rack") return;
  document.querySelectorAll("#rack-pane-tabs [data-rack-pane]").forEach((b) => {
    b.classList.toggle("on", b.dataset.rackPane === rackPane);
  });
  const toEl = document.getElementById("rack-to");
  if (toEl && toEl.value !== rackTo) toEl.value = rackTo;
  const fromEl = document.getElementById("rack-from");
  if (fromEl && fromEl.value !== rackFrom) fromEl.value = rackFrom;
  const fromWrap = document.getElementById("rack-from-wrap");
  if (fromWrap) fromWrap.hidden = rackMode !== "custom";
  const toWord = document.getElementById("rack-to-word");
  if (toWord) toWord.textContent = rackMode === "custom" ? "迄" : "截至";
  document.querySelectorAll("[data-rack-mode]").forEach((b) => {
    b.classList.toggle("on", b.dataset.rackMode === rackMode);
  });
  const coEl = document.getElementById("rack-co");
  if (coEl && coEl.value !== rackCo) coEl.value = rackCo;
  const qEl = document.getElementById("rack-q");
  if (qEl && qEl.value !== rackQ) qEl.value = rackQ;
  ensureRackTxns();
  paintRackRange();
  if (rackLoad !== "done") {
    box.innerHTML = `<p class="empty">正在載入鐵架彙整…</p>`;
    return;
  }
  const lib = window.RackLib;
  if (!lib) {
    box.innerHTML = `<p class="empty">彙整程式未載入。</p>`;
    return;
  }
  if (!rackTxns.length) {
    box.innerHTML = `<p class="empty">尚無進出資料。請用右上角「匯入 Excel」上傳異動報表。</p>`;
    return;
  }
  const s = rackSummary();
  fillRackFrameSelect(s);
  paintRackRange();
  const q = rackQ;
  if (rackPane === "frame") {
    if (rackPick) {
      const rows = lib.frameAtCustomers(s, rackPick).filter((r) => r.closing > 0).sort((a, b) => b.closing - a.closing);
      const qty = rows.reduce((a, r) => a + r.closing, 0);
      box.innerHTML = `<button type="button" class="ghost rack-back" data-rack-back>返回架種</button>
        <p class="rack-stat"><b>${esc(rackLabel(s, rackPick))}</b>　${rows.length} 戶　在外 ${rackFmt(qty)}</p>
        <table class="rack-table"><thead><tr><th>客人</th><th>還欠</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${esc(r.customer)}</td><td class="owed">${rackFmt(r.closing)}</td></tr>`).join("")}
        </tbody></table>`;
      return;
    }
    const frames = s.frames
      .map((f) => {
        const list = lib.frameAtCustomers(s, f).filter((r) => r.closing > 0);
        const qty = list.reduce((a, r) => a + r.closing, 0);
        return { f, label: rackLabel(s, f), households: list.length, qty };
      })
      .filter((x) => x.qty > 0 && (rackMatch(x.label, q) || rackMatch(x.f, q)))
      .sort((a, b) => b.qty - a.qty);
    box.innerHTML = frames.length
      ? `<table class="rack-table"><thead><tr><th>架種</th><th>戶數</th><th>在外</th></tr></thead><tbody>
        ${frames.map((x) => `<tr data-rack-pick="${esc(x.f)}"><td>${esc(x.label)}</td><td>${rackFmt(x.households)}</td><td class="owed">${rackFmt(x.qty)}</td></tr>`).join("")}
        </tbody></table>`
      : `<p class="empty">沒有符合的架種尚欠。</p>`;
    return;
  }
  if (rackPane === "customer") {
    if (rackPick && rackLine) {
      const rows = lib.customerOwed(s, rackPick).filter((r) => r.frame === rackLine);
      const owed = rows.reduce((a, r) => a + (r.closing || 0), 0);
      const docs = rackCustomerFrameDocs(rackPick, rackLine);
      const lines = docs.outs.length
        ? docs.outs
            .map(
              (d) =>
                `<tr><td>${esc(d.doc)}</td><td>${esc(d.date || "")}</td><td class="owed">${rackFmt(d.qty)}</td></tr>`,
            )
            .join("")
        : `<tr><td colspan="3">沒有出貨單號明細</td></tr>`;
      box.innerHTML = `<button type="button" class="ghost rack-back" data-rack-back="sheet">返回總單</button>
        <h3 class="rack-sheet-title">${esc(rackPick)}　${esc(rackLabel(s, rackLine))}</h3>
        <p class="rack-owed-big">欠架總數 ${rackFmt(owed)}</p>
        ${rackMode === "custom" && rackFrom ? `<p class="rack-stat">區間 ${esc(rackFrom)}～${esc(rackTo)} 的出貨單</p>` : ""}
        ${docs.inn ? `<p class="rack-stat">期間歸還 ${rackFmt(docs.inn)}</p>` : ""}
        <table class="rack-table"><thead><tr><th>出貨單號</th><th>日期</th><th>數量</th></tr></thead><tbody>${lines}</tbody></table>`;
      return;
    }
    if (rackPick) {
      const custom = rackMode === "custom" && rackFrom;
      const rows = lib
        .customerOwed(s, rackPick)
        .filter((r) => r.closing > 0 || (custom && (r.out || r.inn || r.opening)))
        .sort((a, b) => b.closing - a.closing);
      const qty = rows.reduce((a, r) => a + r.closing, 0);
      const span = rackDateSpan();
      const head = custom
        ? `<thead><tr><th>品項</th><th>期初</th><th>借出</th><th>歸還</th><th>欠架</th></tr></thead>`
        : `<thead><tr><th>品項</th><th>欠架</th></tr></thead>`;
      const body = rows
        .map((r) =>
          custom
            ? `<tr data-rack-line="${esc(r.frame)}"><td>${esc(rackLabel(s, r.frame))}</td><td>${rackFmt(r.opening)}</td><td>${rackFmt(r.out)}</td><td>${rackFmt(r.inn)}</td><td class="owed">${rackFmt(r.closing)}</td></tr>`
            : `<tr data-rack-line="${esc(r.frame)}"><td>${esc(rackLabel(s, r.frame))}</td><td class="owed">${rackFmt(r.closing)}</td></tr>`,
        )
        .join("");
      const foot = custom
        ? `<tr><td>合計</td><td>${rackFmt(rows.reduce((a, r) => a + (r.opening || 0), 0))}</td><td>${rackFmt(rows.reduce((a, r) => a + (r.out || 0), 0))}</td><td>${rackFmt(rows.reduce((a, r) => a + (r.inn || 0), 0))}</td><td class="owed">${rackFmt(qty)}</td></tr>`
        : `<tr><td>合計</td><td class="owed">${rackFmt(qty)}</td></tr>`;
      box.innerHTML = `<button type="button" class="ghost rack-back" data-rack-back="list">返回客人</button>
        <h3 class="rack-sheet-title">總單　${esc(rackPick)}</h3>
        <p class="rack-stat">各種品項缺漏　${rows.length} 種　欠架合計 ${rackFmt(qty)}　${custom ? `區間 ${esc(rackFrom)}～${esc(rackTo)}` : `資料至 ${esc(span.to || "—")}`}</p>
        ${
          rows.length
            ? `<table class="rack-table">${head}<tbody>${body}${foot}</tbody></table>`
            : `<p class="empty">這個客人目前沒有欠架。</p>`
        }`;
      return;
    }
    const names = s.customers
      .map((c) => {
        const rows = lib.customerOwed(s, c).filter((r) => r.closing > 0);
        return { c, kinds: rows.length, qty: rows.reduce((a, r) => a + r.closing, 0) };
      })
      .filter((x) => x.qty > 0 && rackMatch(x.c, q))
      .sort((a, b) => b.qty - a.qty);
    box.innerHTML = names.length
      ? `<table class="rack-table"><thead><tr><th>客人</th><th>種類</th><th>還欠</th></tr></thead><tbody>
        ${names.map((x) => `<tr data-rack-pick="${esc(x.c)}"><td>${esc(x.c)}</td><td>${rackFmt(x.kinds)}</td><td class="owed">${rackFmt(x.qty)}</td></tr>`).join("")}
        </tbody></table>`
      : `<p class="empty">沒有符合的客人尚欠。</p>`;
    return;
  }
  const carriers = lib.uniqueCarriers(s.customers);
  if (rackPick) {
    const members = lib.customersOfCarrier(s.customers, rackPick);
    const rows = lib.mergeOwed(s, members).filter((r) => r.closing > 0).sort((a, b) => b.closing - a.closing);
    const qty = rows.reduce((a, r) => a + r.closing, 0);
    box.innerHTML = `<button type="button" class="ghost rack-back" data-rack-back>返回貨運</button>
      <p class="rack-stat"><b>${esc(rackPick)}</b>　${members.length} 戶　還欠 ${rackFmt(qty)}</p>
      <table class="rack-table"><thead><tr><th>架種</th><th>還欠</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(rackLabel(s, r.frame))}</td><td class="owed">${rackFmt(r.closing)}</td></tr>`).join("")}
      </tbody></table>`;
    return;
  }
  const list = carriers
    .map((c) => {
      const members = lib.customersOfCarrier(s.customers, c);
      const rows = lib.mergeOwed(s, members).filter((r) => r.closing > 0);
      return { c, households: members.length, qty: rows.reduce((a, r) => a + r.closing, 0) };
    })
    .filter((x) => x.qty > 0 && rackMatch(x.c, q))
    .sort((a, b) => b.qty - a.qty);
  box.innerHTML = list.length
    ? `<table class="rack-table"><thead><tr><th>貨運行</th><th>戶數</th><th>還欠</th></tr></thead><tbody>
      ${list.map((x) => `<tr data-rack-pick="${esc(x.c)}"><td>${esc(x.c)}</td><td>${rackFmt(x.households)}</td><td class="owed">${rackFmt(x.qty)}</td></tr>`).join("")}
      </tbody></table>`
    : `<p class="empty">沒有符合的貨運行尚欠。</p>`;
}
function applyPlanPane() {
  document.querySelectorAll("#plan-pane-tabs [data-plan-pane]").forEach((b) => {
    b.classList.toggle("on", b.dataset.planPane === planPane);
  });
  const pending = document.getElementById("plan-pending");
  const done = document.getElementById("plan-done");
  if (pending) pending.hidden = planPane !== "pending";
  if (done) done.hidden = planPane !== "done";
}
function applyPlanMain(smooth) {
  if (currentRole() === "driver") planMain = "ship";
  document.querySelectorAll("#plan-main-tabs [data-plan-main]").forEach((b) => {
    b.classList.toggle("on", b.dataset.planMain === planMain);
  });
  const swipe = document.getElementById("plan-main-swipe");
  const pane = document.querySelector(`[data-plan-main-page="${planMain}"]`);
  if (!swipe || !pane || page !== "plan") return;
  const go = () => {
    planMainLock = true;
    const left = pane.offsetLeft;
    if (smooth) swipe.scrollTo({ left, behavior: "smooth" });
    else swipe.scrollLeft = left;
    window.setTimeout(() => {
      planMainLock = false;
    }, smooth ? 420 : 80);
  };
  if (swipe.clientWidth) go();
  else requestAnimationFrame(go);
}
function applyQtyCellValue(row, who, col, raw, date) {
  const val = String(raw || "").trim();
  if (formAllowsRest() && isRestText(val)) {
    markRowRest(row);
    upsertRest(who, date);
    return "rest";
  }
  if (formAllowsRest()) {
    clearRowRest(row);
    removeRest(who, date);
  }
  row[col] = val;
  return "";
}
function rowVendor(row) {
  const v = String(row?.vendor || "").trim();
  if (VENDOR_OPTS.includes(v)) return v;
  if (VENDOR_OPTS.includes(row?.rbVendor)) return row.rbVendor;
  if (VENDOR_OPTS.includes(row?.gbVendor)) return row.gbVendor;
  if (row?.vendors && typeof row.vendors === "object") {
    return VENDOR_OPTS.find((k) => row.vendors[k]) || "芳";
  }
  return "芳";
}
function basilVendorOf(row, which) {
  const key = which === "gb" ? "gbVendor" : "rbVendor";
  const v = String(row?.[key] || "").trim();
  if (VENDOR_OPTS.includes(v)) return v;
  return rowVendor(row);
}
function migrateBasilDailyRow(row) {
  if (!row) return row;
  if (!row._basil3) {
    const rb = qtyN(row.rb) + qtyN(row.rbFang) + qtyN(row.rbOth) + qtyN(row.rbLin);
    const gb = qtyN(row.gb) + qtyN(row.gbFang) + qtyN(row.gbOth) + qtyN(row.gbLin);
    if (!row.note) {
      const bits = [row.rbOthNote, row.gbOthNote].filter(Boolean);
      if (bits.length) row.note = bits.join("、");
    }
    if (rb) row.rb = rb;
    if (gb) row.gb = gb;
    if (!row.vendor) row.vendor = rowVendor(row);
    row._basil3 = true;
  }
  const fallback = rowVendor(row);
  if (!VENDOR_OPTS.includes(String(row.rbVendor || "").trim())) row.rbVendor = fallback;
  if (!VENDOR_OPTS.includes(String(row.gbVendor || "").trim())) row.gbVendor = fallback;
  return row;
}
function linesFromDailyRow(row, meta) {
  const err = [];
  const lines = [];
  if (formKind === "leaf") {
    const z = qtyN(row.slZhi);
    const f = qtyN(row.slFang);
    const pack = row.pack || "籃裝";
    if (z) lines.push({ skuId: "sl-zhi", qty: z, pack });
    if (f) lines.push({ skuId: "sl-fang", qty: f, pack });
  } else if (formKind === "basil") {
    migrateBasilDailyRow(row);
    const r = qtyN(row.rb);
    const g = qtyN(row.gb);
    const note = String(row.note || "").trim();
    if (r) {
      const line = { skuId: BASIL_SKU.rb[basilVendorOf(row, "rb")], qty: r };
      if (note) line.note = note;
      lines.push(line);
    }
    if (g) {
      const line = { skuId: BASIL_SKU.gb[basilVendorOf(row, "gb")], qty: g };
      if (note) line.note = note;
      lines.push(line);
    }
  } else {
    const m = qtyN(row.mint);
    const sk = qtyN(row.shisoKg);
    const sj = qtyN(row.shisoJin);
    const bk = qtyN(row.basilKg);
    if (m) lines.push({ skuId: "mint-kg", qty: m });
    if (sk) lines.push({ skuId: "shiso-kg", qty: sk });
    if (sj) lines.push({ skuId: "shiso-jin", qty: sj });
    if (bk) lines.push({ skuId: "basil-kg", qty: bk });
  }
  return { lines, err };
}
function linesToDailyRow(lines) {
  const row = {};
  for (const l of lines) {
    if (l.skuId === "sl-zhi") {
      row.slZhi = l.qty;
      if (l.pack) row.pack = l.pack;
    } else if (l.skuId === "sl-fang") {
      row.slFang = l.qty;
      if (l.pack) row.pack = l.pack;
    }     else if (l.skuId === "mint-kg") row.mint = l.qty;
    else if (l.skuId === "shiso-kg") row.shisoKg = l.qty;
    else if (l.skuId === "shiso-jin") row.shisoJin = l.qty;
    else if (l.skuId === "basil-kg") row.basilKg = l.qty;
    else if (BASIL_REV[l.skuId]) {
      const b = BASIL_REV[l.skuId];
      row[b.qty] = round((qtyN(row[b.qty]) || 0) + l.qty);
      if (b.qty === "rb") row.rbVendor = b.val;
      if (b.qty === "gb") row.gbVendor = b.val;
      row.vendor = row.rbVendor || row.gbVendor || b.val;
      if (l.note) row.note = l.note;
      row._basil3 = true;
    }
  }
  return row;
}
function collectNqEntries() {
  const date = document.getElementById("daily-sheet-date").value || today();
  const { book } = dailyBook(date);
  let names = gridCustomers();
  if (editing) {
    const o = state.orders.find((x) => x.id === editing);
    if (o) names = [o.customer];
  }
  const entries = [];
  const rests = [];
  const errors = [];
  for (const name of names) {
    const row = book[name] || {};
    const rs = formAllowsRest() ? rowRestState(row) : "";
    if (rs === "mix") {
      errors.push(`${name}：休與數量不能同時填`);
      continue;
    }
    if (rs === "rest") {
      rests.push(name);
      continue;
    }
    const { lines, err } = linesFromDailyRow(row, basilMeta(book));
    if (err.includes("pack")) errors.push(`${name}：地瓜葉有數量時請選裝箱樣式`);
    if (lines.length) entries.push({ customer: name, lines });
  }
  return { date, entries, errors, rests };
}
function qtyMapFromLines(entries) {
  const map = {};
  for (const e of entries) {
    for (const l of e.lines) map[l.skuId] = (map[l.skuId] || 0) + l.qty;
  }
  return map;
}
function clearDailyRows(names, date) {
  const { data, book } = dailyBook(date);
  for (const name of names) {
    const row = book[name];
    if (!row) continue;
    clearFormFields(row, formCustKey());
    if (!Object.keys(row).length) delete book[name];
  }
  saveDailyStore(data);
}
function addOpenOrder(customer, shipDate, lines) {
  return addOpenOrderFor(co, customer, shipDate, lines, shipAddrValue());
}
function addOpenOrderFor(company, customer, shipDate, lines, shipAddr) {
  const nos = state.orders.filter((o) => o.co === company).map((o) => o.no);
  const day = shipDate || today();
  const addr = String(shipAddr || "").trim();
  const remark = orderNoteValue();
  const id = uid();
  state.orders.unshift({
    id,
    co: company,
    no: (nos.length ? Math.max(...nos) : 0) + 1,
    customer,
    shipAddr: addr,
    remark,
    shipDate: day,
    preorder: isPreorderDay(day),
    lines,
    status: "open",
    prio: nextPrio(),
    edited: false,
    enteredBy: currentStaff() || "",
  });
  return id;
}
function namesMatch(a, b) {
  return String(a || "").replace(/\s+/g, "") === String(b || "").replace(/\s+/g, "");
}
function suspectDupes(company, customer, shipDate, skipId) {
  const day = shipDate || today();
  return state.orders.filter((o) => {
    if (skipId && o.id === skipId) return false;
    if (o.co !== company || o.status === "cancelled" || o.status === "deleted") return false;
    if ((o.shipDate || today()) !== day) return false;
    return namesMatch(o.customer, customer);
  });
}
function dupHint(dupes) {
  return dupes
    .map((o) => {
      const bits = (o.lines || []).slice(0, 4).map((l) => lineLabel(l, false)).join("、");
      const st = o.status === "shipped" ? "已出" : "待出";
      return `#${o.no}${st}${bits ? ` ${bits}` : ""}`;
    })
    .join("；");
}
let lineDupAck = new Set();
let formDupAck = "";
let nqDupAck = "";
let inboundLotAck = "";

function warnIfDup(company, customer, shipDate, skipId) {
  const dupes = suspectDupes(company, customer, shipDate, skipId);
  if (!dupes.length) return true;
  const key = `${company}|${customer}|${shipDate || today()}`;
  if (formDupAck === key) return true;
  formDupAck = key;
  setStatus(
    `疑似重複入單：「${customer}」${shipDate || today()} 已有（${dupHint(dupes)}）。畫面不會跳窗，請先看「今日已填」，確定後再按一次確認。`,
    true,
  );
  return false;
}
function warnIfInboundDup(skuId, qty, date) {
  const hit = suspectInboundDupes(skuId, qty, date);
  if (!hit) return true;
  const key = `${skuId}|${round(Number(qty))}|${date}`;
  if (inboundLotAck === key) return true;
  inboundLotAck = key;
  setStatus(`疑似重複進貨：${inboundDupNote(hit)}。請先核對今日已進貨，確定後再按一次「記入」。`, true);
  return false;
}
function inboundSkuLabel(skuId) {
  return NQ_INBOUND.find((r) => r.id === skuId)?.label || skuById(skuId)?.name || skuId;
}
function suspectInboundDupes(skuId, qty, date) {
  const n = round(Number(qty));
  if (!(n > 0)) return null;
  const b = bookRow(skuId, date);
  ensureLots(b);
  const lotHits = (b.lots || []).filter((x) => Number(x.qty) > 0 && round(x.qty) === n).length;
  const total = round(b.inbound || 0);
  if (!lotHits && total !== n) return null;
  return { skuId, qty: n, inbound: total, lotHits, totalMatch: total === n };
}
function inboundDupNote(hit) {
  const sku = skuById(hit.skuId);
  const unit = sku?.unit || "";
  return `「${inboundSkuLabel(hit.skuId)}」再記入 ${fmt(hit.qty)} ${unit}（今日已 ${fmt(hit.inbound)} ${unit}）`;
}
function inboundDupNotes(lines, date) {
  const notes = [];
  for (const l of lines || []) {
    const hit = suspectInboundDupes(l.skuId, l.qty, date);
    if (hit) notes.push(inboundDupNote(hit));
  }
  return notes;
}
function parsedDupInfo(parsed, date) {
  if (!parsed) return null;
  const day = date || parsed.date || today();
  if (parsed.inbound) {
    const notes = inboundDupNotes(parsed.lines, day);
    return notes.length ? { inbound: true, notes } : null;
  }
  const who = (parsed.customer || "").trim();
  if (!who) return null;
  const lines = parsed.lines || [];
  const ha = lines.filter((l) => (skuById(l.skuId) || {}).co === "ha");
  const nq = lines.filter((l) => (skuById(l.skuId) || {}).co === "nq");
  const dupHa = ha.length ? suspectDupes("ha", who, day) : [];
  const dupNq = nq.length ? suspectDupes("nq", who, day) : [];
  if (!dupHa.length && !dupNq.length) return null;
  return { inbound: false, who, day, hint: dupHint([...dupHa, ...dupNq]) };
}
function commitStatus(worst) {
  if (worst === "bad") setStatus("有品項不夠，仍已佔量列入排程，請看紅字。", true);
  else if (worst === "warn") setStatus("已確認列入排程，但有品項將低於安全庫存。", false);
  else setStatus("已確認並列入排程（已佔量，尚未扣庫）。", false);
}
function confirmNqSchedule() {
  const { date, entries, errors, rests } = collectNqEntries();
  if (errors.length) return setStatus(errors[0], true);
  if (!requireStaff()) return;
  if (editing) {
    if (!entries.length) return setStatus("請填數量後再確認。", true);
    const o = state.orders.find((x) => x.id === editing);
    const wasShipped = o.status === "shipped" || o.status === "delivered";
    const shipMeta = snapshotShipMeta(o);
    if (o.status === "shipped") unwindShipment(o);
    o.customer = entries[0].customer;
    o.shipAddr = shipAddrValue();
    o.shipDate = date;
    o.lines = entries[0].lines;
    markOrderEdited(o);
    if (wasShipped) {
      applyOpenShipment(o);
      restoreShipMeta(o, shipMeta);
    } else o.status = "open";
    const editedId = o.id;
    editing = "";
    document.getElementById("edit-id").value = "";
    removeRest(entries[0].customer, date);
    clearDailyRows(entries.map((e) => e.customer), date);
    save();
    goTodayAfterSave([editedId], date);
    setStatus(
      wasShipped
        ? `已改件數並重算扣庫。修改人員：${currentStaff()}。`
        : `已改單，修改人員：${currentStaff()}。`,
      false,
    );
    render();
    return;
  }
  if (!entries.length) {
    if (rests.length) return setStatus(`已記錄無叫貨（休）${rests.length} 位，無需入單。`, false);
    return setStatus("請填數量，無叫貨請填「休」。", true);
  }
  for (const e of entries) removeRest(e.customer, date);
  for (const name of rests) upsertRest(name, date);
  const map = qtyMapFromLines(entries);
  const { worst } = lineChecks(map, currentRecord());
  const dups = entries
    .map((e) => ({ e, dupes: suspectDupes("nq", e.customer, date) }))
    .filter((x) => x.dupes.length);
  if (dups.length) {
    const key = dups.map((x) => x.e.customer).sort().join(",") + "|" + date;
    if (nqDupAck !== key) {
      nqDupAck = key;
      const msg = dups.map((x) => `「${x.e.customer}」${dupHint(x.dupes)}`).join("；");
      setStatus(`疑似重複入單：${msg}。畫面不會跳窗，請先看「今日已填」，確定後再按一次「確認輸入訂單」。`, true);
      return;
    }
  }
  nqDupAck = "";
  const addr = shipAddrValue();
  const ids = [];
  for (const e of entries) {
    ids.push(addOpenOrder(e.customer, date, e.lines));
    rememberShipAddr(e.customer, addr);
  }
  clearDailyRows(entries.map((e) => e.customer), date);
  save();
  goTodayAfterSave(ids, date);
  commitStatus(worst);
  render();
}

function renderCheck() {
  if (co === "nq" && !useNqLineForm()) {
    const box = document.getElementById("nq-check");
    if (!box) return;
    const { entries, errors, rests } = collectNqEntries();
    const map = qtyMapFromLines(entries);
    const { rows, worst } = lineChecks(map, currentRecord());
    const stockHtml = rows
      .map((r) => {
        const cls = r.level === "bad" ? "bad" : r.level === "warn" ? "warn" : "ok";
        const msg =
          r.level === "bad"
            ? `不夠：${r.sku.name} 填 ${fmt(r.need)}，可出 ${fmt(r.av)} ${r.sku.unit}`
            : r.level === "warn"
              ? `低於安全庫存：${r.sku.name} 出完剩 ${fmt(r.after)}（安全 ${fmt(r.safety)}）`
              : `足夠：${r.sku.name}`;
        return `<p class="${cls}">${esc(msg)}</p>`;
      })
      .join("");
    const errHtml = errors.map((m) => `<p class="bad">${esc(m)}</p>`).join("");
    const restHtml =
      formAllowsRest() && rests.length
        ? `<p class="ok">無叫貨（休）已確認：${rests.map(esc).join("、")}</p>`
        : "";
    box.innerHTML = errHtml + restHtml + stockHtml;
    box.dataset.worst = errors.length ? "bad" : worst;
    return;
  }
  if (co === "ha") {
    const box = document.getElementById("check");
    if (box) {
      box.innerHTML = "";
      box.dataset.worst = "ok";
    }
    return;
  }
  const map = qtyMapFromForm();
  const { rows, worst } = lineChecks(map, currentRecord());
  const box = document.getElementById("check");
  const packMsgs = [];
  if (!useNqLineForm()) {
    const packs = packMapFromForm();
    const sharedPack = document.getElementById("leaf-pack");
    if (sharedPack) {
      const hasQty = formSkus().some((s) => (map[s.id] || 0) > 0);
      if (hasQty && !sharedPack.value) {
        packMsgs.push("地瓜葉有數量時請選擇裝箱樣式（籃裝或箱裝，僅出貨備註）");
      }
    } else {
      for (const sku of formSkus()) {
        if (!sku.packRemark) continue;
        if ((map[sku.id] || 0) > 0 && !packs[sku.id]) {
          packMsgs.push(`請選裝箱樣式：${sku.name}（籃裝或箱裝，僅出貨備註）`);
        }
      }
    }
  }
  if (!rows.length && !packMsgs.length) {
    box.innerHTML = "";
    return;
  }
  const stockHtml = rows
    .map((r) => {
      const cls = r.level === "bad" ? "bad" : r.level === "warn" ? "warn" : "ok";
      const msg =
        r.level === "bad"
          ? `不夠：${r.sku.name} 填 ${fmt(r.need)}，可出 ${fmt(r.av)} ${r.sku.unit}`
          : r.level === "warn"
            ? `低於安全庫存：${r.sku.name} 出完剩 ${fmt(r.after)}（安全 ${fmt(r.safety)}）`
            : `足夠：${r.sku.name}`;
      return `<p class="${cls}">${esc(msg)}</p>`;
    })
    .join("");
  const packHtml = packMsgs.map((m) => `<p class="bad">${esc(m)}</p>`).join("");
  box.innerHTML = stockHtml + packHtml;
  box.dataset.worst = packMsgs.length ? "bad" : worst;
}

function openOrders() {
  return state.orders.filter((o) => o.co === co && o.status === "open");
}

function renderAlerts() {
  const el = document.getElementById("alerts");
  if (!el) return;
  el.hidden = true;
  el.innerHTML = "";
}

function coLabel(company) {
  return company === "ha" ? "鴻安" : "穠全";
}
function splitLinesByCo(lines) {
  const ha = [];
  const nq = [];
  for (const l of lines || []) {
    const c = skuById(l.skuId)?.co;
    if (c === "ha") ha.push(l);
    else if (c === "nq") nq.push(l);
  }
  return { ha, nq };
}
function ordersListHtml(opts = {}) {
  const compact = !!opts.compact;
  const day = ordersViewDay();
  let list = state.orders.filter((o) => (o.shipDate || today()) === day);
  if (!list.length) return `<p class="empty">${day} 尚無已填紀錄。</p>`;
  const rank = {};
  visibleOpenQueue().forEach((o, i) => {
    rank[o.id] = i + 1;
  });
  const openN = Object.keys(rank).length;
  const stRank = { open: 0, delivered: 1, shipped: 2, cancelled: 3, deleted: 4 };
  list = list.slice().sort((a, b) => {
    const sa = stRank[a.status] ?? 9;
    const sb = stRank[b.status] ?? 9;
    if (sa !== sb) return sa - sb;
    if (a.status === "open") return (rank[a.id] || 0) - (rank[b.id] || 0) || a.no - b.no;
    return b.no - a.no;
  });
  return `<div class="order-cards">${list
    .map((o) => {
      const cls = [
        "order-card",
        o.status === "cancelled" || o.status === "deleted" ? "cancelled" : "",
        o.status === "shipped" ? "shipped" : "",
        o.status === "delivered" ? "shipped" : "",
        o.status === "open" ? "pending" : "",
        o.edited ? "was-edited" : "",
        highlightOrderIds.includes(o.id) ? "just-in" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const tag = o.edited ? '<span class="tag tag-edit">已改單</span>' : "";
      const preTag = isPreorderDay(o.shipDate) || o.preorder ? '<span class="tag tag-pre">預開</span>' : "";
      const bookTag = `<span class="tag">${esc(coLabel(o.co))}</span>`;
      const st = orderStatusLabel(o);
      const lines = o.lines
        .filter((l) => l.qty)
        .map((l) => `<span class="order-chip">${esc(lineLabel(l, true))}</span>`)
        .join("");
      const bits = [];
      if (o.status === "open") {
        if (!compact && can("ship-books")) bits.push(`<button type="button" class="ghost" data-act="ship" data-id="${o.id}">出貨扣庫</button>`);
        if (can("edit")) bits.push(`<button type="button" data-act="edit" data-id="${o.id}">改單</button>`);
        if (can("cancel")) bits.push(`<button type="button" data-act="cancel" data-id="${o.id}">取消</button>`);
      }
      if (o.status === "shipped" && can("edit-shipped")) {
        bits.push(`<button type="button" data-act="edit" data-id="${o.id}">改單</button>`);
      }
      if (o.status !== "cancelled" && o.status !== "deleted" && can("delete")) {
        bits.push(`<button type="button" data-act="delete" data-id="${o.id}">刪除紀錄</button>`);
      }
      const acts = bits.length ? `<div class="order-actions">${bits.join("")}</div>` : "";
      const n = rank[o.id];
      const prio =
        o.status === "open"
          ? `<div class="order-prio">
              <span class="prio-n">${n}</span>
              <button type="button" class="tiny-btn" data-act="up" data-id="${o.id}" ${n <= 1 ? "disabled" : ""} aria-label="往前">↑</button>
              <button type="button" class="tiny-btn" data-act="down" data-id="${o.id}" ${n >= openN ? "disabled" : ""} aria-label="往後">↓</button>
            </div>`
          : `<div class="order-prio muted">${st}</div>`;
      return `<article class="${cls}">
        ${prio}
        <div class="order-body">
          <div class="order-card-head">
            <strong class="order-who">${tag}${preTag}${bookTag}${esc(o.customer)}</strong>
            <span class="order-st st-${esc(o.status)}">${esc(st)}</span>
          </div>
          <p class="order-meta">出貨日 ${esc(o.shipDate)}　單號 #${esc(o.no)}${o.shipAddr ? `　送貨 ${esc(o.shipAddr)}` : ""}</p>
          ${o.remark ? `<p class="order-remark">${esc(o.remark)}</p>` : ""}
          <p class="order-staff">${staffNoteHtml(o)}</p>
          <div class="order-chips">${lines}</div>
          ${acts}
        </div>
      </article>`;
    })
    .join("")}</div>`;
}
function renderOrders() {
  const htmlBooks = ordersListHtml({ compact: false });
  const htmlToday = ordersListHtml({ compact: true });
  const books = document.getElementById("orders");
  const todayBox = document.getElementById("orders-today");
  if (books) books.innerHTML = htmlBooks;
  if (todayBox) todayBox.innerHTML = htmlToday;
  const title = document.getElementById("orders-today-title");
  if (title) title.textContent = `今日已填　${ordersViewDay()}`;
}

function renderRestList() {
  const htmlFor = (showEmpty) => {
    if (!formAllowsRest()) return "";
    const date = sheetDate();
    const kindLabel = `當日 ${shortDay(date)}`;
    const rows = (state.rests || [])
      .filter((r) => restKeyMatch(r, r.customer, date))
      .slice()
      .sort((a, b) => a.customer.localeCompare(b.customer, "zh-Hant"));
    if (!rows.length) {
      if (!showEmpty) return "";
      return `<div class="rest-box"><h3>無叫貨（休）· ${esc(kindLabel)}</h3><p class="empty">按「今日無叫貨」列入，表示已確認當日不叫貨。</p></div>`;
    }
    return `<div class="rest-box"><h3>無叫貨（休）· ${esc(kindLabel)} ${esc(date)}</h3>
    <p class="hint">已確認當日叫貨狀態（無叫貨）。</p>
    <ul class="rest-list">${rows
      .map(
        (r) =>
          `<li><span class="tag">休</span><strong>${esc(r.customer)}</strong><button type="button" class="tiny-btn" data-unrest="${esc(r.customer)}" aria-label="取消 ${esc(r.customer)} 的休">取消</button></li>`,
      )
      .join("")}</ul></div>`;
  };
  const box = document.getElementById("rest-list");
  if (box) {
    const html = htmlFor(true);
    box.innerHTML = html;
    box.hidden = !formAllowsRest();
  }
  const todayRest = document.getElementById("orders-today-rest");
  if (todayRest) todayRest.innerHTML = htmlFor(false);
}

function skuShortName(sku) {
  return (sku?.name || "").replace("本產蔬菜－", "");
}
function lineQtyForSkuPack(o, skuId, pack) {
  let n = 0;
  const want = pack || "籃裝";
  for (const l of o.lines || []) {
    if (l.skuId !== skuId) continue;
    const p = l.pack || "籃裝";
    if (p === want) n += l.qty;
  }
  return round(n);
}
function lineQtyForSku(o, skuId) {
  let n = 0;
  for (const l of o.lines || []) if (l.skuId === skuId) n += l.qty;
  return round(n);
}
function lineQtyForSkus(o, ids) {
  let n = 0;
  for (const id of ids) n += lineQtyForSku(o, id);
  return round(n);
}
function planDayPendingQty(g, day) {
  let n = 0;
  for (const o of state.orders) {
    if (o.status !== "open") continue;
    if ((o.shipDate || today()) !== day) continue;
    n += lineQtyForSkus(o, g.skuIds);
  }
  return round(n);
}
function planOtherOpenQty(g, day) {
  let n = 0;
  for (const o of state.orders) {
    if (o.status !== "open") continue;
    if ((o.shipDate || today()) === day) continue;
    n += lineQtyForSkus(o, g.skuIds);
  }
  return round(n);
}
function groupOnHand(g, date) {
  let n = 0;
  for (const id of g.skuIds) {
    const sku = skuById(id);
    if (!sku) continue;
    n = round(n + onHand(sku, date));
  }
  return n;
}
function groupLeftover(g, date = planViewDay()) {
  return round(groupOnHand(g, date) - planDayPendingQty(g, date));
}
function planGroups() {
  const nq = [
    { key: "sl-zhi", label: "現採·地瓜葉／誌", unit: "籃", skuIds: ["sl-zhi"], tone: "leaf-zhi" },
    { key: "sl-fang", label: "現採·地瓜葉／芳", unit: "籃", skuIds: ["sl-fang"], tone: "leaf-fang" },
    { key: "rb", label: "現採·九層塔／紅骨", unit: "箱", skuIds: ["rb-fang", "rb-lin", "rb-oth"], tone: "rb" },
    { key: "gb", label: "現採·九層塔／綠骨", unit: "箱", skuIds: ["gb-fang", "gb-lin", "gb-oth"], tone: "gb" },
    { key: "mint-kg", label: "現採·薄荷", unit: "kg", skuIds: ["mint-kg"], tone: "mint" },
    { key: "shiso-kg", label: "現採·紫蘇", unit: "kg", skuIds: ["shiso-kg", "shiso-jin"], tone: "shiso" },
    { key: "basil-kg", label: "現採·九層塔散賣", unit: "kg", skuIds: ["basil-kg"], tone: "herb" },
  ];
  const ha = SKUS.filter((s) => s.co === "ha" && isSiteSku(s)).map((sku, i) => ({
    key: sku.id,
    label: `加工·${skuShortName(sku)}`,
    unit: sku.unit,
    skuIds: [sku.id],
    tone: `t${i % 6}`,
  }));
  return [...nq, ...ha];
}
function planLineNote(o, skuIds) {
  const bits = [];
  for (const l of o.lines || []) {
    if (!skuIds.includes(l.skuId)) continue;
    const b = BASIL_REV[l.skuId];
    if (b) bits.push(b.val);
    if (l.pack) bits.push(l.pack);
    if (l.size) bits.push(l.size);
    if (l.note) bits.push(l.note);
  }
  return [...new Set(bits.filter(Boolean))].join("　");
}
function orderShipDay(o) {
  return o.shipDate || today();
}
function orderStatusLabel(o) {
  if (o.status === "shipped") return "已出貨";
  if (o.status === "delivered") return "已送達";
  if (o.status === "cancelled") return "已取消";
  if (o.status === "deleted") return "已刪除";
  if (o.assignedDriver) return o.runOut ? "接單處理中" : "已派單";
  return "待出貨";
}
function isPlanPendingOn(o, day) {
  return o.status === "open" && orderShipDay(o) === day;
}
function isPlanShippedOn(o, day) {
  return o.status === "shipped" && orderShipDay(o) === day;
}
function shipNeedMap(o) {
  const need = {};
  for (const line of o.lines || []) {
    if (!(line.qty > 0) || !line.skuId) continue;
    need[line.skuId] = (need[line.skuId] || 0) + line.qty;
  }
  return need;
}
function shipmentBlockers(o) {
  const need = shipNeedMap(o);
  for (const [skuId, qty] of Object.entries(need)) {
    const sku = skuById(skuId);
    if (!sku) continue;
    ensureStockRow(sku.id);
    if (isSiteSku(sku) || isTradeSku(sku)) continue;
    if (available(sku, o, today()) < qty) return `${sku.name} 可出不足，不能出貨。請先在庫存頁記入進貨或早上盤點。`;
  }
  return "";
}
function autoInboundLots(o) {
  const autoIn = [];
  const need = shipNeedMap(o);
  for (const [skuId, qty] of Object.entries(need)) {
    const sku = skuById(skuId);
    if (!sku) continue;
    if (shipInboundSku(sku) === "auto") autoIn.push({ skuId, qty, sku });
  }
  return autoIn;
}
function applyOpenShipment(o) {
  const need = shipNeedMap(o);
  const autoIn = autoInboundLots(o);
  const shipInbounds = [];
  for (const [skuId, qty] of Object.entries(need)) {
    const sku = skuById(skuId);
    if (!sku) continue;
    if (isSiteSku(sku)) {
      const st = ensureStockRow(sku.id);
      st.processed = round(Math.max(0, (st.processed || 0) - qty));
    }
  }
  o.status = "shipped";
  o.shippedOn = today();
  o.shippedBy = currentStaff();
  for (const lot of autoIn) {
    addInboundLot(lot.skuId, lot.qty, o.shippedOn, true);
    shipInbounds.push({ skuId: lot.skuId, qty: lot.qty });
  }
  o.shipInbounds = shipInbounds;
  for (const skuId of Object.keys(need)) {
    const sku = skuById(skuId);
    if (sku && !isSiteSku(sku)) syncNqQty(sku);
  }
}
function shipOpenOrders(list, { action, confirmMsg } = {}) {
  if (!list.length) return false;
  if (!requireCan(action || "ship-books", "沒有出貨權限。")) return false;
  const ready = list.filter((o) => o.status === "open" || o.status === "delivered");
  if (!ready.length) return false;
  for (const o of ready) {
    const block = shipmentBlockers(o);
    if (block) {
      setStatus(block, true);
      return false;
    }
  }
  if (confirmMsg && !confirm(confirmMsg)) return false;
  try {
    for (const o of ready) applyOpenShipment(o);
    save();
    setStatus(ready.length > 1 ? `已出貨扣庫 ${ready.length} 張。` : `已出貨扣庫「${ready[0].customer}」。`, false);
    render();
    return true;
  } catch (err) {
    console.error(err);
    setStatus("出貨扣庫失敗，請再按一次。", true);
    return false;
  }
}
function groupOrdersByCustomer(list) {
  const map = new Map();
  for (const o of list) {
    const k = String(o.customer || "").trim() || "未填對象";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(o);
  }
  return [...map.entries()].sort((a, b) => {
    const pa = Math.min(...a[1].map((o) => orderRank(o) || 0));
    const pb = Math.min(...b[1].map((o) => orderRank(o) || 0));
    return pa - pb || a[0].localeCompare(b[0], "zh-Hant");
  });
}
function driverNames() {
  return STAFF_ROSTER.filter((p) => p.role === "driver").map((p) => p.name);
}
function customerKey(o) {
  return String(o.customer || "").trim() || "未填對象";
}
function dayOpenOrdersForCustomer(customer, day = planViewDay()) {
  return state.orders.filter(
    (o) => o.status === "open" && orderShipDay(o) === day && customerKey(o) === customer,
  );
}
function runLabel(orders) {
  const names = [...new Set(orders.map((o) => o.assignedDriver).filter(Boolean))];
  if (!names.length) return "";
  const out = orders.some((o) => o.runOut);
  return `${out ? "出門" : "已派"} ${names.join("、")}`;
}
function assignOrdersToDriver(orders, driver, goingOut) {
  const who = currentStaff();
  for (const o of orders) {
    if (o.status !== "open") continue;
    o.assignedDriver = driver;
    o.assignedBy = who;
    o.assignedAt = Date.now();
    o.runOut = !!goingOut;
  }
}
function assignOrderDriver(orderId, driver) {
  if (!requireCan("assign-driver", "沒有派單權限。")) return;
  if (!driverNames().includes(driver)) return;
  const o = state.orders.find((x) => x.id === orderId);
  if (!o || o.status !== "open") return setStatus("這張單已出貨或找不到。", true);
  if (o.assignedDriver && o.assignedDriver !== driver && !confirm(`#${o.no} 目前派給${o.assignedDriver}。改派給${driver}？`)) return;
  assignOrdersToDriver([o], driver, false);
  save();
  setStatus(`已派「${o.customer}」#${o.no} 給${driver}。`, false);
  render();
}
function assignCustomerDriver(customer, driver) {
  if (!requireCan("assign-driver", "沒有派單權限。")) return;
  if (!driverNames().includes(driver)) return;
  const orders = dayOpenOrdersForCustomer(customer);
  if (!orders.length) return setStatus("這張單已出貨或找不到。", true);
  const other = [...new Set(orders.map((o) => o.assignedDriver).filter((d) => d && d !== driver))];
  if (other.length && !confirm(`「${customer}」目前派給${other.join("、")}。改派給${driver}？`)) return;
  assignOrdersToDriver(orders, driver, false);
  save();
  setStatus(`已派「${customer}」給${driver}。`, false);
  render();
}
function takeCustomerRun(customer) {
  if (!requireCan("take-run", "沒有接單權限。")) return;
  const me = currentStaff();
  const orders = dayOpenOrdersForCustomer(customer);
  if (!orders.length) return setStatus("這張單已出貨或找不到。", true);
  const other = orders.find((o) => o.assignedDriver && o.assignedDriver !== me);
  if (other) return setStatus(`這張已派給${other.assignedDriver}。`, true);
  assignOrdersToDriver(orders, me, true);
  save();
  setStatus(`「${customer}」已接單，狀態：接單處理中。送到後請簽名或拍照。`, false);
  render();
}
function takeOrderRun(orderId) {
  if (!requireCan("take-run", "沒有接單權限。")) return;
  const me = currentStaff();
  const o = state.orders.find((x) => x.id === orderId);
  if (!o || o.status !== "open") return setStatus("這張單已出貨或找不到。", true);
  if (o.assignedDriver && o.assignedDriver !== me) return setStatus(`這張已派給${o.assignedDriver}。`, true);
  assignOrdersToDriver([o], me, true);
  save();
  setStatus(`「${o.customer}」#${o.no} 已接單，狀態：接單處理中。送到後請簽名或拍照。`, false);
  render();
}
let proofCustomer = "";
let proofMode = "sign";
let proofPhoto = "";
let proofDirty = false;
function closeProofGate() {
  proofCustomer = "";
  proofPhoto = "";
  proofDirty = false;
  const gate = document.getElementById("proof-gate");
  if (gate) gate.hidden = true;
}
function setProofMode(mode) {
  proofMode = mode === "photo" ? "photo" : "sign";
  const signBox = document.getElementById("proof-sign-box");
  const photoBox = document.getElementById("proof-photo-box");
  if (signBox) signBox.hidden = proofMode !== "sign";
  if (photoBox) photoBox.hidden = proofMode !== "photo";
  document.querySelectorAll("[data-proof-mode]").forEach((b) => b.classList.toggle("on", b.dataset.proofMode === proofMode));
}
function clearProofCanvas() {
  const c = document.getElementById("proof-canvas");
  if (!c) return;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  proofDirty = false;
}
function bindProofCanvas() {
  const c = document.getElementById("proof-canvas");
  if (!c || c.dataset.bound) return;
  c.dataset.bound = "1";
  const ctx = c.getContext("2d");
  ctx.strokeStyle = "#1b2a22";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  let drawing = false;
  const pt = (e) => {
    const r = c.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return [(t.clientX - r.left) * (c.width / r.width), (t.clientY - r.top) * (c.height / r.height)];
  };
  const start = (e) => {
    e.preventDefault();
    drawing = true;
    const [x, y] = pt(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const [x, y] = pt(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    proofDirty = true;
  };
  const end = () => {
    drawing = false;
  };
  c.addEventListener("pointerdown", start);
  c.addEventListener("pointermove", move);
  c.addEventListener("pointerup", end);
  c.addEventListener("pointerleave", end);
  c.addEventListener("touchstart", start, { passive: false });
  c.addEventListener("touchmove", move, { passive: false });
  c.addEventListener("touchend", end);
}
function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("讀不到照片"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1280;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = () => reject(new Error("照片打不開"));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function openProofGate(customer) {
  if (!requireCan("deliver", "沒有確認送貨權限。")) return;
  const me = currentStaff();
  const orders = dayOpenOrdersForCustomer(customer);
  if (!orders.length) return setStatus("這張單已送達或找不到。", true);
  const other = orders.find((o) => o.assignedDriver && o.assignedDriver !== me);
  if (other) return setStatus(`這張已派給${other.assignedDriver}。`, true);
  if (orders.some((o) => !o.assignedDriver || o.assignedDriver !== me)) {
    return setStatus("請先接單，狀態變成接單處理中後再簽名或拍照。", true);
  }
  proofCustomer = customer;
  proofPhoto = "";
  const title = document.getElementById("proof-title");
  if (title) title.textContent = `確認送貨 · ${customer}`;
  const preview = document.getElementById("proof-preview");
  const file = document.getElementById("proof-file");
  if (preview) {
    preview.hidden = true;
    preview.removeAttribute("src");
  }
  if (file) file.value = "";
  setProofMode("sign");
  bindProofCanvas();
  clearProofCanvas();
  const gate = document.getElementById("proof-gate");
  if (gate) gate.hidden = false;
}
function markOrdersDelivered(orders, proof) {
  const who = currentStaff();
  for (const o of orders) {
    if (o.status !== "open" && o.status !== "delivered") continue;
    o.deliveredAt = Date.now();
    o.deliveredBy = who;
    o.proof = proof;
    o.runOut = true;
    if (!o.assignedDriver) o.assignedDriver = who;
    applyOpenShipment(o);
  }
}
function snapshotShipMeta(o) {
  return {
    proof: o.proof,
    deliveredBy: o.deliveredBy,
    deliveredAt: o.deliveredAt,
    assignedDriver: o.assignedDriver,
    assignedBy: o.assignedBy,
    assignedAt: o.assignedAt,
    runOut: o.runOut,
    shippedBy: o.shippedBy,
  };
}
function restoreShipMeta(o, keep) {
  if (!keep) return;
  if (keep.proof) o.proof = keep.proof;
  if (keep.deliveredBy) o.deliveredBy = keep.deliveredBy;
  if (keep.deliveredAt) o.deliveredAt = keep.deliveredAt;
  if (keep.assignedDriver) o.assignedDriver = keep.assignedDriver;
  if (keep.assignedBy) o.assignedBy = keep.assignedBy;
  if (keep.assignedAt) o.assignedAt = keep.assignedAt;
  o.runOut = keep.runOut || o.runOut;
  if (keep.shippedBy) o.shippedBy = keep.shippedBy;
}
async function submitProof() {
  if (!proofCustomer) return;
  const orders = dayOpenOrdersForCustomer(proofCustomer);
  if (!orders.length) return setStatus("這張單已出貨或找不到。", true);
  let data = "";
  let type = proofMode;
  if (proofMode === "photo") {
    if (!proofPhoto) return setStatus("請先拍照或選一張照片。", true);
    data = proofPhoto;
  } else {
    if (!proofDirty) return setStatus("請先在框裡簽名。", true);
    data = document.getElementById("proof-canvas")?.toDataURL("image/png") || "";
  }
  if (!data) return setStatus("還沒有簽單或照片。", true);
  for (const o of orders) {
    const block = shipmentBlockers(o);
    if (block) return setStatus(block, true);
  }
  const who = proofCustomer;
  try {
    markOrdersDelivered(orders, { type, data, at: Date.now() });
    save();
    closeProofGate();
    setStatus(`「${who}」已確認送貨並扣庫。件數若要改，請會計到當日訂單修改。`, false);
    render();
  } catch (err) {
    console.error(err);
    setStatus("確認送貨失敗，請再試一次。", true);
  }
}
function proofHtml(o) {
  if (!o.proof?.data) return "";
  const kind = o.proof.type === "photo" ? "現場照片" : "電子簽單";
  const who = o.deliveredBy ? ` · ${o.deliveredBy}` : "";
  return `<div class="proof-view"><p class="drive-co">${esc(kind)}${esc(who)}</p><img src="${o.proof.data}" alt="${esc(kind)}" /></div>`;
}
function groupShipAddr(orders) {
  return [...new Set(orders.map((o) => String(o.shipAddr || "").trim()).filter(Boolean))].join("／");
}
function orderBlockHtml(o) {
  const bits = [`#${o.no}`, coLabel(o.co)];
  if (o.edited) bits.push("已改單");
  if (o.preorder) bits.push("預開");
  if (o.assignedDriver) bits.push(o.status === "open" ? orderStatusLabel(o) : `司機 ${o.assignedDriver}`);
  const addr = String(o.shipAddr || "").trim();
  return `<div class="drive-order"><p class="drive-co">${esc(bits.join(" · "))}</p>${addr ? `<p class="drive-addr">${esc(addr)}</p>` : ""}${driverLineList(o)}${proofHtml(o)}</div>`;
}
function driverLineList(o) {
  const lines = (o.lines || []).filter((l) => l.qty > 0);
  if (!lines.length) return '<p class="empty">沒有品項</p>';
  return `<ul class="drive-lines">${lines
    .map((l) => {
      const sku = skuById(l.skuId);
      const unit = sku?.unit || "";
      const note = l.note ? `<em>${esc(l.note)}</em>` : "";
      return `<li><span>${esc(ticketLineName(l))}${note}</span><strong>${fmt(l.qty)}${unit ? ` ${esc(unit)}` : ""}</strong></li>`;
    })
    .join("")}</ul>`;
}
function assignRowHtml(customer, orders, kind) {
  if (kind !== "pending" || !can("assign-driver")) return "";
  const now = [...new Set(orders.map((o) => o.assignedDriver).filter(Boolean))];
  return `<div class="assign-row"><span>派工</span>${driverNames()
    .map(
      (name) =>
        `<button type="button" class="tiny-btn${now.includes(name) ? " on" : ""}" data-assign-driver="${esc(name)}" data-assign-who="${esc(customer)}">${esc(name)}</button>`,
    )
    .join("")}</div>`;
}
function driverSideHtml(customer, orders, kind) {
  if (kind !== "pending" || currentRole() !== "driver") return "";
  const me = currentStaff();
  const drivers = [...new Set(orders.map((o) => o.assignedDriver).filter(Boolean))];
  const mine = orders.every((o) => !o.assignedDriver || o.assignedDriver === me);
  const taken = orders.every((o) => o.assignedDriver === me && o.runOut);
  const who = drivers.length ? `<span class="drive-driver">${esc(drivers.join("、"))}</span>` : "";
  if (!mine) return `<div class="assign-row drive-side">${who}</div>`;
  const take = !taken
    ? `<button type="button" class="tiny-btn primary" data-drive-take="${esc(customer)}">接單</button>`
    : "";
  const deliver = taken
    ? `<button type="button" class="tiny-btn primary" data-drive-proof="${esc(customer)}">電子簽單／拍照</button>`
    : "";
  return `<div class="assign-row drive-side">${who}${take}${deliver}</div>`;
}
function planJobHtml(customer, orders, kind) {
  const key = `${kind}:${customer}`;
  const open = planOpenId === key;
  const nos = orders.map((o) => `#${o.no}`).join("　");
  const addr = groupShipAddr(orders);
  const tag = kind === "pending" ? orderStatusLabel(orders[0]) : "";
  const head =
    kind === "pending"
      ? `${esc(customer)}${tag ? `<span class="drive-tag">${esc(tag)}</span>` : ""}${addr ? `<span class="drive-addr">${esc(addr)}</span>` : ""}`
      : `${esc(customer)}<span class="drive-nos">${esc(nos)}</span>${addr ? `<span class="drive-addr">${esc(addr)}</span>` : ""}`;
  const body = orders.map(orderBlockHtml).join("");
  const side = assignRowHtml(customer, orders, kind) || driverSideHtml(customer, orders, kind);
  return `<li class="drive-job ${kind === "done" ? "is-done" : ""} ${open ? "is-open" : ""}">
    <div class="drive-head">
      <button type="button" class="drive-who" data-drive-open="${esc(key)}" aria-expanded="${open ? "true" : "false"}">${head}</button>
      ${side}
    </div>
    <div class="drive-detail" ${open ? "" : "hidden"}>${body}</div>
  </li>`;
}
function syncPlanChrome(driver) {
  const card = document.getElementById("plan-card");
  const shortTitle = document.getElementById("plan-short-title");
  const shortBox = document.getElementById("plan-short");
  const mainTabs = document.getElementById("plan-main-tabs");
  if (card) card.classList.toggle("is-driver", driver);
  if (shortTitle) shortTitle.hidden = driver;
  if (shortBox) shortBox.hidden = driver;
  if (mainTabs) mainTabs.hidden = driver;
  if (driver) planMain = "ship";
}
function renderDispatchLists(day) {
  const pendingBox = document.getElementById("plan-pending");
  const doneBox = document.getElementById("plan-done");
  if (!pendingBox || !doneBox) return;
  const list = state.orders.filter((o) => o.status !== "cancelled" && o.status !== "deleted" && orderShipDay(o) === day);
  const pending = groupOrdersByCustomer(list.filter((o) => o.status === "open"));
  const done = groupOrdersByCustomer(list.filter((o) => o.status === "delivered" || o.status === "shipped"));
  const sec = (title, groups, empty, kind) =>
    `<section class="drive-sec">
      <h3>${esc(title)} <span>${groups.length}</span></h3>
      ${
        groups.length
          ? `<ul class="drive-jobs">${groups.map(([who, orders]) => planJobHtml(who, orders, kind)).join("")}</ul>`
          : `<p class="drive-empty">${esc(empty)}</p>`
      }
    </section>`;
  pendingBox.innerHTML = `<div class="drive-plan">${sec("待處理訂單", pending, "目前沒有待出貨訂單。", "pending")}</div>`;
  doneBox.innerHTML = `<div class="drive-plan">${sec("已出貨", done, "目前沒有已出貨訂單。", "done")}</div>`;
  const pendTab = document.querySelector('#plan-pane-tabs [data-plan-pane="pending"]');
  const doneTab = document.querySelector('#plan-pane-tabs [data-plan-pane="done"]');
  if (pendTab) pendTab.textContent = `待處理 ${pending.length}`;
  if (doneTab) doneTab.textContent = `已出貨 ${done.length}`;
}
function renderDriverPlan() {
  const pendingBox = document.getElementById("plan-pending");
  if (!pendingBox) return;
  const day = planViewDay();
  const planDateEl = document.getElementById("plan-date");
  if (planDateEl && planDateEl.value !== day) planDateEl.value = day;
  syncPlanChrome(true);
  renderDispatchLists(day);
  applyPlanPane();
  applyPlanMain(false);
}
function renderPlan() {
  const shortBox = document.getElementById("plan-short");
  const pendingBox = document.getElementById("plan-pending");
  if (!pendingBox) return;
  if (currentRole() === "driver") {
    renderDriverPlan();
    return;
  }
  syncPlanChrome(false);
  const day = planViewDay();
  const planDateEl = document.getElementById("plan-date");
  if (planDateEl && planDateEl.value !== day) planDateEl.value = day;
  const orders = state.orders.filter((o) => o.status !== "cancelled" && o.status !== "deleted");
  const groups = planGroups();
  const used = groups.filter((g) =>
    orders.some((o) => lineQtyForSkus(o, g.skuIds) > 0 && (isPlanPendingOn(o, day) || isPlanShippedOn(o, day))),
  );
  const wrap = document.getElementById("plan-card") || shortBox?.parentElement;
  if (wrap) wrap.style.setProperty("--plan-n", String(Math.max(used.length, 1)));
  if (shortBox) {
    if (!used.length) {
      shortBox.innerHTML = '<p class="empty">還沒有出貨排程。</p>';
    } else {
      shortBox.innerHTML = `<div class="plan-board short-board">${used
        .map((g) => {
          const left = groupLeftover(g, day);
          const need = planDayPendingQty(g, day);
          const stock = groupOnHand(g, day);
          const other = planOtherOpenQty(g, day);
          const over = left < 0;
          return `<article class="short-card tone-${esc(g.tone)} ${over ? "no" : "ok"}">
            <h3>${esc(g.label)}</h3>
            <p class="short-est is-need"><span>當日需要（待出）</span><strong>${fmt(need)} ${esc(g.unit)}</strong></p>
            <p class="short-est is-sub is-stock"><span>當日庫存（盤點＋進貨－已出）</span><strong>${fmt(stock)} ${esc(g.unit)}</strong></p>
            <p class="short-est is-left"><span>預估剩餘</span><strong>${fmt(left)} ${esc(g.unit)}</strong></p>
            ${other ? `<p class="short-other">另有他日未出 ${fmt(other)} ${esc(g.unit)}，未計入今日需要</p>` : ""}
            <p class="short-can">${over ? "已超接，不宜再接單" : "尚可接單"}</p>
          </article>`;
        })
        .join("")}</div>`;
    }
  }
  renderDispatchLists(day);
  applyPlanPane();
  applyPlanMain(false);
}

function nqMorningQty(b) {
  return countQtyOf(b);
}
function stockOverviewHtml(date = stockViewDay()) {
  const groups = NQ_STOCK_GROUPS.map((g) => {
    const items = NQ_INBOUND.filter((row) => g.ids.includes(row.id))
      .map((row) => {
        const sku = skuById(row.id);
        const b = bookRow(row.id, date);
        const countQty = round(countQtyOf(b));
        const inQty = round(b.inbound || 0);
        const outQty = round(shippedQty(row.id, date));
        const total = round(countQty + inQty - outQty);
        return `<div class="stock-ov-item">
          <p class="stock-ov-name">${esc(row.label)}</p>
          <p class="stock-ov-total"><strong>${fmt(total)}</strong><span class="unit">${esc(sku.unit)}</span></p>
          <p class="stock-ov-bits"><span class="n-count">盤點 ${fmt(countQty)}</span><span class="n-in">進貨 ${fmt(inQty)}</span><span class="n-out">已出 ${fmt(outQty)}</span></p>
        </div>`;
      })
      .join("");
    return `<section class="stock-ov-group"><h3>${esc(g.label)}</h3><div class="stock-ov-grid">${items}</div></section>`;
  }).join("");
  return groups;
}
function refreshStockOverview() {
  const box = document.getElementById("stock-overview");
  if (box) box.innerHTML = stockOverviewHtml();
}
function nqStockGroup() {
  return NQ_STOCK_GROUPS.find((g) => g.id === stockKind) || NQ_STOCK_GROUPS[0];
}
function nqStockFillRows() {
  const g = nqStockGroup();
  return NQ_INBOUND.filter((row) => g.ids.includes(row.id));
}
function qtyStepperHtml({ key, id, value, step, locked, placeholder, aria }) {
  return `<div class="stepper">
    <button type="button" class="step-btn" data-qty-step="-1" ${locked ? "disabled" : ""} aria-label="減">−</button>
    <input class="qty book-input" data-${key}="${esc(id)}" type="number" min="0" step="${step}" value="${esc(value)}" placeholder="${esc(placeholder || "")}" inputmode="decimal" ${locked ? "readonly" : ""} aria-label="${esc(aria)}" />
    <button type="button" class="step-btn" data-qty-step="1" ${locked ? "disabled" : ""} aria-label="加">＋</button>
  </div>`;
}
function nqMorningDone(rows = NQ_INBOUND) {
  const date = stockViewDay();
  return rows.every((row) => !!bookRow(row.id, date).morningConfirmed);
}
function lotLabelShort(b) {
  const lots = Array.isArray(b.lots) ? b.lots : [];
  if (!lots.length) return "尚無批次";
  return lots
    .map((x) => `${fmt(x.qty)}${x.auto ? "自動" : ""}`)
    .join(" · ");
}
function inboundOverviewHtml(date) {
  if (co === "ha") {
    const rows = SKUS.filter((s) => s.co === "ha")
      .map((sku) => {
        const st = ensureStockRow(sku.id);
        return `<div class="in-ov-row is-ha">
          <span class="in-ov-name">${esc(skuShortName(sku))}</span>
          <span class="in-ov-total"><strong>${fmt(st.qty || 0)}</strong><span class="unit">${esc(sku.unit)}</span></span>
        </div>`;
      })
      .join("");
    return `<p class="in-ov-note">Excel 匯入後會列出當日進貨。現況先看原料庫。</p><div class="in-ov">${rows}</div>`;
  }
  return NQ_STOCK_GROUPS.map((g) => {
    const rows = NQ_INBOUND.filter((row) => g.ids.includes(row.id))
      .map((row) => {
        const sku = skuById(row.id);
        const b = bookRow(row.id, date);
        return `<div class="in-ov-row">
            <span class="in-ov-name">${esc(row.label)}</span>
            <span class="in-ov-total"><strong>${fmt(b.inbound || 0)}</strong><span class="unit">${esc(sku.unit)}</span></span>
            <input class="in-ov-fix qty" data-inbound-fix="${row.id}" type="number" min="0" step="${skuStep(sku)}" placeholder="改總數" inputmode="decimal" aria-label="${esc(row.label)} 修正進貨總數" />
            <button type="button" class="ghost" data-fix-inbound="${row.id}">修正</button>
          </div>
          <p class="in-ov-lots">${esc(lotLabelShort(b))}${b.inboundEdited ? " · 已修正" : ""}</p>`;
      })
      .join("");
    return `<section class="in-ov-group"><h3>${esc(g.label)}</h3>${rows}</section>`;
  }).join("");
}
function lotLabel(b) {
  const lots = Array.isArray(b.lots) ? b.lots : [];
  if (!lots.length) return "";
  return lots
    .map((x, i) => {
      const tag = x.auto ? "自動判定" : "";
      return `第${i + 1}批 ${fmt(x.qty)}${tag ? `（${tag}）` : ""}`;
    })
    .join("、");
}
function ensureLots(b) {
  if (Array.isArray(b.lots)) return b.lots;
  b.lots = b.inbound ? [{ qty: round(b.inbound), at: 0 }] : [];
  return b.lots;
}
function correctInbound(skuId, raw, date = stockViewDay()) {
  const sku = skuById(skuId);
  if (!sku) return;
  if (raw === "" || raw == null) return setStatus("請在總覽的修正欄填正確總數，再按修正。", true);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return setStatus("修正請填 0 或正數。", true);
  const b = bookRow(skuId, date);
  const qty = round(n);
  b.lots = qty ? [{ qty, at: Date.now() }] : [];
  b.inbound = qty;
  b.inboundEdited = true;
  if (date === today()) syncNqQty(sku);
  save();
  const label = NQ_INBOUND.find((r) => r.id === skuId)?.label || sku.name;
  setStatus(`已修正「${label}」今日進貨為 ${fmt(qty)} ${sku.unit}。`, false);
  renderStock();
  renderLeafInbound();
  renderCheck();
  renderAlerts();
}
function stripAutoMorningInbound(b) {
  if (!b || !Array.isArray(b.lots)) return;
  b.lots = b.lots.filter((x) => !x.auto);
  syncBookInbound(b);
}
function addAutoMorningInbound(b, extra) {
  const n = round(extra);
  if (!(n > 0)) return;
  ensureLots(b);
  b.lots = b.lots.filter((x) => !x.auto);
  b.lots.push({ qty: n, at: Date.now(), auto: true });
  syncBookInbound(b);
}
function unlockMorning(skuId) {
  const b = bookRow(skuId, stockViewDay());
  b.morningConfirmed = false;
  stripAutoMorningInbound(b);
  const sku = skuById(skuId);
  if (sku) syncNqQty(sku);
  save();
}
function unlockAllMorning() {
  for (const row of nqStockFillRows()) unlockMorning(row.id);
  setStatus(`已解開${nqStockGroup().label}早上盤點。改完請再按確認盤點。`, false);
  renderStock();
  renderCheck();
  renderAlerts();
}
function addInboundLot(skuId, raw, date = stockViewDay(), quiet) {
  const sku = skuById(skuId);
  if (!sku) return;
  const n = Number(raw);
  if (!(n > 0)) {
    if (!quiet) setStatus("本批進貨必須大於 0，記入後可再打下一批。", true);
    return;
  }
  if (!quiet && !warnIfInboundDup(skuId, n, date)) return;
  const b = bookRow(skuId, date);
  ensureLots(b);
  b.lots.push({ qty: round(n), at: Date.now() });
  syncBookInbound(b);
  if (isSiteSku(sku)) state.stock[sku.id].qty = round((state.stock[sku.id].qty || 0) + n);
  else if (date === today()) syncNqQty(sku);
  save();
  if (quiet) return;
  setStatus(`已留存本批 ${fmt(n)} ${sku.unit}。今日合計 ${fmt(b.inbound)} ${sku.unit}，可再輸入下一筆。`, false);
  renderStock();
  renderLeafInbound();
  renderCheck();
  renderAlerts();
}
function reverseInboundLot(skuId, qty, date) {
  const sku = skuById(skuId);
  if (!sku || !(qty > 0)) return;
  const b = bookRow(skuId, date);
  ensureLots(b);
  b.lots.push({ qty: round(-qty), at: Date.now() });
  syncBookInbound(b);
  if (isSiteSku(sku)) state.stock[sku.id].qty = round(Math.max(0, (state.stock[sku.id].qty || 0) - qty));
  else syncNqQty(sku);
}
function unwindShipment(o) {
  if (o.status !== "shipped") return;
  for (const lot of o.shipInbounds || []) reverseInboundLot(lot.skuId, lot.qty, o.shippedOn || today());
  o.shipInbounds = [];
  const nqIds = new Set();
  for (const line of o.lines || []) {
    const sku = skuById(line.skuId);
    if (!sku) continue;
    if (isSiteSku(sku)) {
      ensureStockRow(sku.id);
      state.stock[sku.id].processed = round((state.stock[sku.id].processed || 0) + line.qty);
    } else nqIds.add(sku.id);
  }
  o.status = "open";
  delete o.shippedOn;
  delete o.shippedBy;
  for (const id of nqIds) {
    const sku = skuById(id);
    if (sku) syncNqQty(sku);
  }
}
function shipInboundSku(sku) {
  if (!sku) return "";
  if (isSiteSku(sku)) return "auto";
  if (isTradeSku(sku)) return "auto";
  if (FORM_KINDS.herb.skuIds.includes(sku.id)) return "auto";
  return "";
}
function haStockOverviewHtml() {
  return `<section class="stock-ov-group"><h3>鴻安加工庫</h3><div class="stock-ov-grid">${SKUS.filter((s) => s.co === "ha" && isSiteSku(s))
    .map((sku) => {
      const st = ensureStockRow(sku.id);
      const can = ready(sku);
      return `<div class="stock-ov-item">
        <p class="stock-ov-name">${esc(skuShortName(sku))}</p>
        <p class="stock-ov-total"><strong>${fmt(can)}</strong><span class="unit">${esc(sku.unit)}</span></p>
        <p class="stock-ov-bits"><span>原料 ${fmt(st.qty || 0)}</span><span>已加工 ${fmt(st.processed || 0)}</span></p>
      </div>`;
    })
    .join("")}</div></section>`;
}
function renderStock() {
  const date = stockViewDay();
  ensureBooks(date);
  const stockDateEl = document.getElementById("stock-date");
  if (stockDateEl && stockDateEl.value !== date) stockDateEl.value = date;
  const inDateEl = document.getElementById("in-date");
  if (inDateEl && inDateEl.value !== date) inDateEl.value = date;
  const salesDateEl = document.getElementById("sales-date");
  if (salesDateEl && salesDateEl.value !== date) salesDateEl.value = date;
  const lookingBack = date !== today();
  if (co === "ha") {
    const countCard = document.getElementById("count-card");
    if (countCard) countCard.hidden = true;
    const fillBtn = document.getElementById("fill-count");
    if (fillBtn) fillBtn.hidden = true;
    const fixM = document.getElementById("fix-morning");
    if (fixM) fixM.hidden = true;
    const countBox = document.getElementById("stock-count");
    if (countBox) countBox.innerHTML = "";
    const inBox = document.getElementById("stock-in");
    if (inBox) inBox.innerHTML = "";
    const ov = document.getElementById("stock-overview");
    if (ov) ov.innerHTML = haStockOverviewHtml();
    const inOv = document.getElementById("in-overview");
    if (inOv) inOv.innerHTML = inboundOverviewHtml(date);
    const opts = haProcessSkus()
      .map((s) => `<option value="${s.id}">${esc(s.name)}</option>`)
      .join("");
    const inOpts = SKUS.filter((s) => s.co === "ha")
      .map((s) => `<option value="${s.id}">${esc(s.name)}</option>`)
      .join("");
    const inSku = document.getElementById("in-sku");
    const prSku = document.getElementById("pr-sku");
    if (inSku) inSku.innerHTML = inOpts;
    if (prSku) prSku.innerHTML = opts;
    document.getElementById("process").hidden = booksPart !== "stock";
    document.getElementById("receive").hidden = true;
    const haExcel = document.getElementById("ha-excel");
    if (haExcel) haExcel.hidden = booksPart !== "in";
    document.getElementById("stock-title").textContent = lookingBack ? `鴻安庫存（${date}）` : "鴻安庫存／加工";
    const inTitle = document.getElementById("in-title");
    if (inTitle) inTitle.textContent = lookingBack ? `鴻安進貨（${date}）` : "鴻安進貨";
    const gs = document.getElementById("guide-stock");
    const gi = document.getElementById("guide-in");
    if (gs) gs.textContent = "大數字＝已加工可出。原料從進貨入庫增加，加工後轉成可出。出貨才扣可出。";
    if (gi) {
      gi.hidden = true;
      gi.textContent = "";
    }
    applyInPane(false);
    return;
  }
  const haExcelOff = document.getElementById("ha-excel");
  if (haExcelOff) haExcelOff.hidden = true;
  document.getElementById("process").hidden = true;
  document.getElementById("receive").hidden = true;
  document.getElementById("stock-title").textContent = lookingBack ? `庫存（${date}）` : "庫存";
  const inTitle = document.getElementById("in-title");
  if (inTitle) inTitle.textContent = lookingBack ? `進貨（${date}）` : "進貨";
  refreshStockOverview();
  const countCard = document.getElementById("count-card");
  if (countCard) countCard.hidden = false;
  const gs = document.getElementById("guide-stock");
  const gi = document.getElementById("guide-in");
  const gc = document.getElementById("guide-count");
  if (gs) gs.textContent = "上方大數字＝當日庫存（盤點＋進貨－已出）。早上盤點還沒填就以 0 計，不帶入前一天。小字分開顯示盤點、進貨、已出。";
  if (gi) {
    gi.hidden = false;
    gi.textContent = lookingBack
      ? `查 ${date}。＋／－調本批後記入；打錯到總覽改總數。`
      : "＋／－調本批後按記入。打錯請滑到總覽改總數。";
  }
  if (gc) gc.textContent = lookingBack
    ? `查 ${date} 的早上盤點與結算。`
    : "請填現場早上數量後按確認。還沒填的品項盤點以 0 計算，不會帶入前一天。確認後不會自動加進貨。";
  document.getElementById("process").hidden = true;
  document.getElementById("receive").hidden = true;
  const fillRows = nqStockFillRows();
  const morningDone = nqMorningDone(fillRows);
  const anyMorning = fillRows.some((row) => bookRow(row.id, date).morningConfirmed);
  const fillBtn = document.getElementById("fill-count");
  fillBtn.hidden = morningDone;
  fillBtn.textContent = `確認${nqStockGroup().label}早上盤點`;
  fillBtn.disabled = false;
  const fixM = document.getElementById("fix-morning");
  if (fixM) fixM.hidden = !anyMorning;
  const opts = companySkus()
    .map((s) => `<option value="${s.id}">${esc(s.name)}</option>`)
    .join("");
  document.getElementById("in-sku").innerHTML = opts;
  document.getElementById("pr-sku").innerHTML = opts;
  const countCards = fillRows
    .map((row) => {
      const sku = skuById(row.id);
      const b = bookRow(row.id, date);
      const step = skuStep(sku);
      const morningVal = b.morning != null && b.morning !== "" ? b.morning : "";
      const locked = !!b.morningConfirmed;
      const carried = b.morningCarried != null && b.morningCarried !== "" ? Number(b.morningCarried) : prevSettleQty(row.id, date);
      const differs = carried != null && Number.isFinite(carried) && morningVal !== "" && round(Number(morningVal)) !== round(carried);
      const edited = !!b.morningEdited || differs;
      const done = locked ? "已確認" : "";
      const carryHint =
        !locked && carried != null && Number.isFinite(carried)
          ? `<span class="settle-calc">昨日結算 ${fmt(carried)}（未填以 0 計）</span>`
          : !locked
            ? `<span class="settle-calc">未填以 0 計</span>`
            : "";
      const morningBtns = locked
        ? `<button type="button" class="ghost" data-fix-morning="${row.id}">修正盤點</button>`
        : `<button type="button" class="primary" data-confirm-morning="${row.id}">確認盤點</button>`;
      return `<article class="stock-fill-card">
        <h3>${esc(row.label)} <span class="unit">${esc(sku.unit)}</span></h3>
        <p class="stock-fill-kicker">早上現場盤點 ${edited ? '<span class="tag">已改帶入</span>' : ""} ${carryHint} <span class="morning-ok" data-morning-ok="${row.id}">${esc(done)}</span></p>
        ${qtyStepperHtml({ key: "morning", id: row.id, value: morningVal, step, locked, placeholder: "0", aria: `${row.label} 早上庫存盤點` })}
        <div class="stock-fill-actions">${morningBtns}</div>
        <p class="stock-fill-kicker">庫存結算</p>
        ${settleCellHtml(sku)}
      </article>`;
    })
    .join("");
  const inCards = NQ_STOCK_GROUPS.map((g) => {
    const items = NQ_INBOUND.filter((row) => g.ids.includes(row.id))
      .map((row) => {
        const sku = skuById(row.id);
        const step = skuStep(sku);
        return `<article class="in-enter">
          <h3>${esc(row.label)} <span class="unit">${esc(sku.unit)}</span></h3>
          ${qtyStepperHtml({ key: "inbound", id: row.id, value: "", step, locked: false, placeholder: "本批", aria: `${row.label} 本批進貨` })}
          <button type="button" class="primary" data-add-inbound="${row.id}">記入</button>
        </article>`;
      })
      .join("");
    return `<section class="in-group"><h3>${esc(g.label)}</h3><div class="stock-fill-list is-in">${items}</div></section>`;
  }).join("");
  const countBox = document.getElementById("stock-count");
  if (countBox) countBox.innerHTML = `<div class="stock-fill-list">${countCards}</div>`;
  const inBox = document.getElementById("stock-in");
  if (inBox) inBox.innerHTML = inCards;
  const inOv = document.getElementById("in-overview");
  if (inOv) inOv.innerHTML = inboundOverviewHtml(date);
  applyInPane(false);
}
function renderSalesBooks() {
  const title = document.getElementById("sales-title");
  if (title) title.textContent = `當日訂單　${stockViewDay()}`;
}

function dailyStore() {
  try {
    return JSON.parse(localStorage.getItem(DAILY_KEY) || "{}");
  } catch (_) {
    return {};
  }
}
function saveDailyStore(data) {
  localStorage.setItem(DAILY_KEY, JSON.stringify(data));
  scheduleCloudPush();
}
function dailyBook(date) {
  const data = dailyStore();
  if (!data[date]) data[date] = {};
  return { data, book: data[date] };
}
function basilMeta(book) {
  if (!book._meta) book._meta = {};
  return book._meta;
}
function vendorNote(meta) {
  const v = meta?.vendors || {};
  return ["芳", "琳", "其他"].filter((k) => v[k]).join("、");
}
function dailyRow(book, name) {
  if (!book[name]) book[name] = {};
  return book[name];
}
function confirmStock(skuId, date) {
  const sku = skuById(skuId);
  return onHand(sku, date);
}
function calcCloseQty(sku, date = stockViewDay()) {
  if (!sku) return 0;
  if (isSiteSku(sku)) return round(ready(sku));
  return onHand(sku, date);
}
function settleCellHtml(sku) {
  const date = stockViewDay();
  const b = bookRow(sku.id, date);
  const calc = calcCloseQty(sku, date);
  const locked = !!b.countConfirmed;
  const val = b.count != null && b.count !== "" ? b.count : calc;
  const step = skuStep(sku);
  const tag = locked && b.countEdited ? '<span class="tag">修正</span>' : "";
  const actions = locked
    ? `<button type="button" class="ghost" data-fix-settle="${sku.id}">修正結算</button>`
    : `<button type="button" class="primary" data-confirm-settle="${sku.id}">確認結算</button>`;
  const status = locked
    ? `<span class="morning-ok">已確認</span>${tag}`
    : `<span class="settle-calc">系統 ${fmt(calc)}</span>${tag}`;
  return `${status}
    ${qtyStepperHtml({ key: "settle", id: sku.id, value: val, step, locked, placeholder: "", aria: `${sku.name} 庫存結算` })}
    <div class="stock-fill-actions">${actions}</div>`;
}
function applySettleToNextMorning(skuId, date, qty) {
  const next = addDays(date, 1);
  const nb = bookRow(skuId, next);
  const sku = skuById(skuId);
  if (sku && isSiteSku(sku)) {
    nb.opening = qty;
    return;
  }
  if (nb.morningCarried == null) nb.morningCarried = qty;
}
function confirmSettle(skuId, raw) {
  const sku = skuById(skuId);
  if (!sku) return;
  const date = stockViewDay();
  const calc = calcCloseQty(sku, date);
  let n = raw === "" || raw == null ? calc : Number(raw);
  if (!Number.isFinite(n) || n < 0) return setStatus("庫存結算請填 0 或正數。", true);
  n = round(n);
  const b = bookRow(skuId, date);
  b.count = n;
  b.countConfirmed = true;
  b.countEdited = n !== calc;
  if (isSiteSku(sku) && date === today()) ensureStockRow(sku.id).processed = n;
  applySettleToNextMorning(skuId, date, n);
  save();
  setStatus(
    b.countEdited
      ? `已修正並確認「${skuShortName(sku)}」庫存結算為 ${fmt(n)} ${sku.unit}。`
      : `已確認「${skuShortName(sku)}」庫存結算 ${fmt(n)} ${sku.unit}。`,
    false,
  );
  renderStock();
  renderCheck();
  renderPlan();
  renderAlerts();
}
function unlockSettle(skuId) {
  const b = bookRow(skuId, stockViewDay());
  b.countConfirmed = false;
  save();
}
function renderLeafInbound() {
  const box = document.getElementById("leaf-inbound");
  if (box) {
    box.hidden = true;
    box.innerHTML = "";
  }
}
function refreshInboundCompare() {
  return;
}
function moveDailyCell(el, dr, dc) {
  const r = Number(el.dataset.r);
  const c = Number(el.dataset.c);
  if (!Number.isFinite(r) || !Number.isFinite(c)) return;
  const next = document.querySelector(`#daily-sheet [data-r="${r + dr}"][data-c="${c + dc}"]`);
  if (!next) return;
  next.focus();
  if (next.tagName === "INPUT" && typeof next.select === "function") next.select();
}
function renderDailyGrid() {
  const card = document.getElementById("daily-sheet-card");
  if (!card) return;
  card.hidden = co !== "nq" || useNqLineForm();
  if (card.hidden) return;
  const def = FORM_KINDS[formKind] || FORM_KINDS.leaf;
  document.getElementById("daily-sheet-title").textContent = editing
    ? "修改數量（確認後更新排程）"
    : def.title;
  const hintEl = document.getElementById("daily-sheet-hint");
  hintEl.textContent = def.hint || "";
  hintEl.hidden = !def.hint;
  const dateEl = document.getElementById("daily-sheet-date");
  if (!dateEl.value) dateEl.value = today();
  const date = dateEl.value;
  const { data, book } = dailyBook(date);
  let restDirty = false;
  const names = gridCustomers();
  const cols = currentCols();
  const head = `<th>出貨對象</th>${cols.map((c) => `<th>${esc(c.label)}</th>`).join("")}`;
  const body = names.map((name, ri) => {
    const row = book[name] || {};
    if (formKind === "basil") migrateBasilDailyRow(row);
    if (
      formAllowsRest() &&
      (state.rests || []).some((r) => restKeyMatch(r, name, date)) &&
      rowRestState(row) !== "rest" &&
      rowRestState(row) !== "mix" &&
      qtyColKeys().every((k) => !qtyN(row[k]))
    ) {
      markRowRest(row);
      restDirty = true;
    }
    const restCls = rowRestState(row) === "rest" ? " rest-row" : "";
    const cells = cols.map((col, ci) => {
      const val = row[col.key] || "";
      const pos = `data-who="${esc(name)}" data-col="${col.key}" data-r="${ri}" data-c="${ci}"`;
      if (col.kind === "pack") {
        const packVal = val || "籃裝";
        const opts = PACK_OPTS.map(
          (p) => `<option value="${esc(p)}"${packVal === p ? " selected" : ""}>${p}</option>`,
        );
        return `<td><select class="cell-pack" ${pos}>${opts.join("")}</select></td>`;
      }
      if (col.kind === "vendor" || col.kind === "rbVendor" || col.kind === "gbVendor") {
        const which = col.kind === "gbVendor" ? "gb" : col.kind === "rbVendor" ? "rb" : "";
        const vendor = which ? basilVendorOf(row, which) : rowVendor(row);
        const opts = VENDOR_OPTS.map(
          (p) => `<option value="${esc(p)}"${vendor === p ? " selected" : ""}>${p}</option>`,
        );
        return `<td><select class="cell-pack" ${pos}>${opts.join("")}</select></td>`;
      }
      if (col.kind === "note") {
        return `<td><input class="cell-note" ${pos} value="${esc(val)}" /></td>`;
      }
      return `<td><input class="cell-in" ${pos} type="text" inputmode="decimal" autocomplete="off" value="${esc(val)}" /></td>`;
    }).join("");
    const drop = NQ_DEFAULT_CUSTOMERS.includes(name)
      ? ""
      : `<button type="button" class="who-x" data-drop-who="${esc(name)}" aria-label="移除 ${esc(name)}">×</button>`;
    return `<tr class="${restCls.trim()}"><td class="who">${esc(name)}${drop}</td>${cells}</tr>`;
  }).join("");
  const totals = cols.map((col) => {
    if (col.kind !== "qty") return "<td></td>";
    let n = 0;
    for (const name of names) {
      const raw = (book[name] || {})[col.key];
      if (isRestText(raw)) continue;
      n += Number(raw) || 0;
    }
    return `<td>${n ? fmt(n) : ""}</td>`;
  }).join("");
  const gridClass = formKind === "basil" ? "daily-grid basil-grid" : "daily-grid";
  document.getElementById("daily-sheet").innerHTML =
    `<table class="${gridClass}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody><tfoot><tr><td class="who">合計</td>${totals}</tr></tfoot></table>`;
  if (restDirty) saveDailyStore(data);
  renderLeafInbound();
}
const CUST_ZY = {};
const CUST_PY = {};
(function () {
  const rows = [["\u6771","\u3109\u3128\u3125","dong"],["\u5927","\u3109\u311a","da"],["\u6234","\u3109\u311e","dai"],["\u9127","\u3109\u3125","deng"],["\u675c","\u3109\u3128","du"],["\u8463","\u3109\u3128\u3125","dong"],["\u4e01","\u3109\u3127\u3125","ding"],["\u5b9a","\u3109\u3127\u3125","ding"],["\u9054","\u3109\u311a","da"],["\u4ee3","\u3109\u311e","dai"],["\u9f0e","\u3109\u3127\u3125","ding"],["\u6bb5","\u3109\u3128\u3122","duan"],["\u5fb7","\u3109\u311b","de"],["\u9673","\u3114\u3123","chen"],["\u6797","\u310c\u3127\u3123","lin"],["\u9ec3","\u310f\u3128\u3124","huang"],["\u5f35","\u3113\u3124","zhang"],["\u674e","\u310c\u3127","li"],["\u738b","\u3128\u3124","wang"],["\u5433","\u3128","wu"],["\u5289","\u310c\u3127\u3122","liu"],["\u8521","\u311b\u311e","cai"],["\u694a","\u3127\u3124","yang"],["\u5c0f","\u3112\u3127\u3120","xiao"],["\u6b23","\u3112\u3127\u3123","xin"],["\u91d1","\u3110\u3127\u3123","jin"],["\u4f73","\u3110\u3127\u311a","jia"],["\u7433","\u310c\u3127\u3123","lin"],["\u82b3","\u3108\u3124","fang"],["\u9d3b","\u310f\u3128\u3125","hong"],["\u7a22","\u310b\u3128\u3125","nong"],["\u69ae","\u3116\u3128\u3125","rong"],["\u9707","\u3113\u3123","zhen"],["\u5112","\u3116\u3128","ru"],["\u963f","\u311a","a"],["\u912d","\u3113\u3125","zheng"],["\u8b1d","\u3112\u3127\u311d","xie"],["\u8607","\u3119\u3128","su"],["\u838a","\u3113\u3128\u3124","zhuang"],["\u5442","\u310c\u3129","lu"],["\u856d","\u3112\u3127\u3120","xiao"],["\u7f85","\u310c\u3128\u311b","luo"],["\u7c21","\u3110\u3127\u3122","jian"],["\u937e","\u3113\u3128\u3125","zhong"],["\u8d99","\u3113\u3120","zhao"],["\u6eab","\u3128\u3123","wen"],["\u859b","\u3112\u3129\u311d","xue"],["\u97d3","\u310f\u3122","han"],["\u56b4","\u3127\u3122","yan"],["\u9f94","\u310d\u3128\u3125","gong"],["\u95bb","\u3127\u3122","yan"],["\u9023","\u310c\u3127\u3122","lian"],["\u99ac","\u3107\u311a","ma"],["\u8fb2","\u310b\u3128\u3125","nong"],["\u6eff","\u3107\u3122","man"]];
  for (const r of rows) { CUST_ZY[r[0]] = r[1]; CUST_PY[r[0]] = r[2]; }
})();
const SIMP_TO_TRAD = {
  "\u4e1c": "\u6771",
  "\u9648": "\u9673",
  "\u9ec4": "\u9ec3",
  "\u5f20": "\u5f35",
  "\u5218": "\u5289",
  "\u6768": "\u694a",
  "\u90d1": "\u912d",
  "\u8c22": "\u8b1d",
  "\u82cf": "\u8607",
  "\u5e84": "\u838a",
  "\u5415": "\u5442",
  "\u8427": "\u856d",
  "\u7f57": "\u7f85",
  "\u7b80": "\u7c21",
  "\u949f": "\u937e",
  "\u8d75": "\u8d99",
  "\u9093": "\u9127",
  "\u6e29": "\u6eab",
  "\u97e9": "\u97d3",
  "\u4e25": "\u56b4",
  "\u9f9a": "\u9f94",
  "\u960e": "\u95bb",
  "\u8fde": "\u9023",
  "\u9a6c": "\u99ac",
  "\u519c": "\u8fb2",
  "\u8363": "\u69ae",
  "\u6ee1": "\u6eff",
};
const ZY_TONE_RE = /[\u02CA\u02C7\u02CB\u02D9]/g;
let custCompose = "";
function stripZhuyin(s) {
  return String(s || "").replace(ZY_TONE_RE, "").replace(/\s+/g, "");
}
function isZhuyinQuery(s) {
  return /^[ㄅ-ㄩ]+$/.test(s);
}
function isPinyinQuery(s) {
  return /^[a-zA-Z]+$/.test(String(s || "").replace(/['’\s]/g, ""));
}
function pinyinInitial(py) {
  const t = String(py || "");
  if (t.startsWith("zh")) return "zh";
  if (t.startsWith("ch")) return "ch";
  if (t.startsWith("sh")) return "sh";
  return t.charAt(0);
}
function firstCharSound(name) {
  const ch = String(name || "").trim().charAt(0);
  const key = SIMP_TO_TRAD[ch] || ch;
  return { ch, zy: CUST_ZY[key] || CUST_ZY[ch] || "", py: CUST_PY[key] || CUST_PY[ch] || "" };
}
function pyQueryMatch(py, q) {
  const s = String(q || "").toLowerCase();
  const t = String(py || "").toLowerCase();
  if (!s || !t) return false;
  if (t.startsWith(s)) return true;
  if (s === "zh" || s === "ch" || s === "sh" || s.length === 1) return pinyinInitial(t) === s;
  return false;
}
function suggestCustomerNames() {
  const seen = new Set();
  const out = [];
  const add = (name) => {
    const n = String(name || "").trim();
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };
  for (const n of loadAllCustomers()) add(n);
  for (const n of knownCustomersForParse()) add(n);
  return out;
}
function custSuggestHits(q, names) {
  const raw = String(q || "").trim();
  if (!raw) return [];
  const zy = stripZhuyin(raw);
  const py = raw.replace(/['’\s]/g, "");
  const wantZy = isZhuyinQuery(zy);
  const wantPy = isPinyinQuery(py);
  const scored = [];
  for (const name of names) {
    if (name === raw) continue;
    let score = 0;
    if (name.startsWith(raw)) score = 1;
    else if (name.includes(raw)) score = 3;
    const sound = firstCharSound(name);
    if (wantZy && sound.zy && sound.zy.startsWith(zy)) score = score || 2;
    if (wantPy && pyQueryMatch(sound.py, py)) score = score || 2;
    if (score) scored.push({ name, score });
  }
  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, "zh-Hant"));
  return scored.slice(0, 12).map((x) => x.name);
}
function customerQueryText() {
  const input = document.getElementById("customer");
  const typed = String(input?.value || "").trim();
  const composing = String(custCompose || "").trim();
  if (input?.dataset.composing === "1") {
    if (isPinyinQuery(composing) || isZhuyinQuery(stripZhuyin(composing))) return composing;
    if (isPinyinQuery(typed) || isZhuyinQuery(stripZhuyin(typed))) return typed;
    return composing || typed;
  }
  return typed || stripZhuyin(composing);
}
function renderCustSuggest() {
  const input = document.getElementById("customer");
  const box = document.getElementById("cust-suggest");
  if (!input || !box) return;
  const q = customerQueryText();
  const keepOpen = document.activeElement === input || input.dataset.composing === "1";
  if (!q || !keepOpen) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  const hits = custSuggestHits(q, suggestCustomerNames());
  if (!hits.length) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  box.innerHTML = hits
    .map((name) => `<button type="button" class="cust-opt" data-cust="${esc(name)}">${esc(name)}</button>`)
    .join("");
}

const PASTE_DRAFT_KEY = "nongquan-line-paste-drafts-v1";
let lineDraftsCache = [];
let linePasteQueue = [];
try {
  const saved = JSON.parse(localStorage.getItem(PASTE_DRAFT_KEY) || "[]");
  if (Array.isArray(saved)) linePasteQueue = saved.filter((d) => d && d.id);
} catch (_) {}
function savePasteQueue() {
  try {
    localStorage.setItem(PASTE_DRAFT_KEY, JSON.stringify(linePasteQueue.slice(0, 80)));
  } catch (_) {}
}
function findPendingDraft(id) {
  return linePasteQueue.find((d) => d.id === id) || lineDraftsCache.find((d) => d.id === id);
}
function removePasteDraft(id) {
  linePasteQueue = linePasteQueue.filter((d) => d.id !== id);
  savePasteQueue();
}
function lineSkuLabel(id) {
  const s = skuById(id);
  return s ? `${s.name} ${s.unit}` : id;
}
function shortSkuName(id) {
  const s = skuById(id);
  if (!s) return id;
  return s.name.replace(/^本產蔬菜－/, "");
}
function draftKindLabel(inbound) {
  return inbound ? "進貨" : "出貨訂單";
}
function draftKindHint(inbound) {
  return inbound
    ? "這筆會記入庫存，不會產生出貨訂單。品項與件數可直接改。"
    : "這筆會列入出貨訂單，不會記入進貨。出貨對象、品項、件數可直接改再確認。";
}
function draftSkuSelectHtml(skuId) {
  const groups = [
    ["鴻安", SKUS.filter((s) => s.co === "ha")],
    ["穠全", SKUS.filter((s) => s.co === "nq")],
  ];
  return `<select class="draft-sku" data-draft-sku aria-label="品項">${groups
    .map(
      ([lab, list]) =>
        `<optgroup label="${esc(lab)}">${list
          .map(
            (s) =>
              `<option value="${esc(s.id)}"${s.id === skuId ? " selected" : ""}>${esc(s.name.replace(/^本產蔬菜－/, ""))}</option>`,
          )
          .join("")}</optgroup>`,
    )
    .join("")}</select>`;
}
function draftIsOnionSku(id) {
  return /^(on|onp)-(nz|au|kr|vn)-(12|20)$/.test(String(id || ""));
}
function draftLineExtrasHtml(l) {
  const sku = skuById(l.skuId);
  const bits = [];
  if (draftIsOnionSku(l.skuId)) {
    bits.push(`<select data-draft-size aria-label="尺寸">${optsHtml(HA_ONION_SIZES, haOnionSizeOf(l))}</select>`);
  }
  if (sku?.packRemark) {
    bits.push(`<select data-draft-pack aria-label="裝箱">${optsHtml(PACK_OPTS, l.pack === "箱裝" ? "箱裝" : "籃裝")}</select>`);
  }
  bits.push(
    `<label class="ha-pallet"><input type="checkbox" data-draft-pallet ${l.pallet ? "checked" : ""} />疊棧板</label>`,
  );
  return bits.join("");
}
function draftLineRowHtml(l, i) {
  const sku = skuById(l.skuId);
  const qty = l.qty > 0 ? l.qty : "";
  const step = sku ? skuStep(sku) : 1;
  return `<tr data-draft-i="${i}">
        <td>${draftSkuSelectHtml(l.skuId || "on-nz-20")}</td>
        <td class="draft-qty"><input data-draft-qty type="number" min="0" step="${step}" inputmode="decimal" value="${esc(qty)}" aria-label="件數" /></td>
        <td class="draft-unit">${esc(sku?.unit || "")}</td>
        <td class="draft-extras">${draftLineExtrasHtml(l)}</td>
        <td><button type="button" class="tiny-btn ghost" data-draft-del>刪</button></td>
      </tr>`;
}
function draftCheckRowsHtml(d) {
  const lines = Array.isArray(d.lines) ? d.lines : [];
  const rows = lines.length
    ? lines.map((l, i) => draftLineRowHtml(l, i)).join("")
    : `<tr><td colspan="5" class="draft-miss">沒有對到品項，請用「加一筆」補上，或改文字再解析。</td></tr>`;
  return `<table class="draft-check">
    <thead><tr><th>品項</th><th>件數</th><th>單位</th><th>備註</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <button type="button" class="ghost draft-add" data-draft-add>＋加一筆</button>`;
}
const dirtyDraftIds = new Set();
let draftSaveTimer = 0;
function persistDraft(d) {
  if (!d?.id) return;
  dirtyDraftIds.add(d.id);
  if (String(d.id).startsWith("paste-") || d.local) {
    savePasteQueue();
    return;
  }
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => {
    fetch("/api/line/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        id: d.id,
        customer: d.customer || "",
        lines: d.lines || [],
      }),
    }).catch(() => {});
  }, 400);
}
function draftFromEl(el) {
  const art = el?.closest?.(".line-draft");
  if (!art) return null;
  return findPendingDraft(art.dataset.draftId);
}
function ensureDraftLines(d) {
  if (!Array.isArray(d.lines)) d.lines = [];
  return d.lines;
}
function confirmParsedInbound(parsed, date) {
  if (!requireStaff()) return false;
  const lines = (parsed.lines || []).filter((l) => skuById(l.skuId) && Number(l.qty) > 0);
  if (!lines.length) return setStatus("沒有對到進貨品項，請改文字再解析。", true);
  const day = date || today();
  for (const l of lines) addInboundLot(l.skuId, l.qty, day, true);
  inboundLotAck = "";
  setStatus(`已記入進貨 ${lines.length} 項。`, false);
  render();
  return true;
}
function confirmParsedOrder(parsed, date) {
  if (parsed?.inbound) return confirmParsedInbound(parsed, date);
  if (!requireStaff()) return false;
  const who = (parsed.customer || document.getElementById("customer")?.value || "").trim();
  if (!who) return setStatus("請先寫客人名字（第一行或出貨對象欄）。", true);
  const lines = (parsed.lines || []).filter((l) => skuById(l.skuId) && Number(l.qty) > 0);
  if (!lines.length) return setStatus("沒有可入單的品項（件數要大於 0）。可在上方直接改。", true);
  const ha = lines.filter((l) => (skuById(l.skuId) || {}).co === "ha");
  const nq = lines.filter((l) => (skuById(l.skuId) || {}).co === "nq");
  const day = date || document.getElementById("ship-date")?.value || today();
  const ids = [];
  if (ha.length) {
    ids.push(addOpenOrderFor("ha", who, day, ha, shipAddrValue()));
    rememberHaCustomer(who);
    if (!nq.length) co = "ha";
  }
  if (nq.length) {
    ids.push(addOpenOrderFor("nq", who, day, nq, shipAddrValue()));
    addNqCustomer(who, formKindOfSku(nq[0].skuId));
    if (!ha.length) {
      co = "nq";
      formKind = formKindOfSku(nq[0].skuId);
    }
  }
  rememberShipAddr(who, shipAddrValue());
  save();
  goTodayAfterSave(ids, day);
  setStatus(`已把「${who}」拆成訂單（需再確認內容）。鴻安 ${ha.length} 項、穠全 ${nq.length} 項。`, false);
  render();
  return true;
}
async function dropLineDraft(id) {
  await fetch("/api/line/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "drop", id }),
  });
}
function renderLineDrafts(force) {
  const box = document.getElementById("line-drafts");
  if (!box) return;
  const focused = document.activeElement;
  if (
    !force &&
    focused &&
    box.contains(focused) &&
    focused.matches("input, select, textarea")
  ) {
    return;
  }
  const list = [...linePasteQueue, ...lineDraftsCache];
  if (!list.length) {
    box.innerHTML = '<p class="empty">可連續貼上多位客人再解析，待確認會一起列在這裡，不必立刻確認。</p>';
    return;
  }
  box.innerHTML = list
    .map((d) => {
      const inbound = !!d.inbound;
      const day = d.date || today();
      const unk = (d.unknown || []).length
        ? `<p class="draft-miss">原文沒對到：${esc(d.unknown.join("、"))}（可在表格加一筆補上）</p>`
        : "";
      const dupInfo = parsedDupInfo(d, day);
      const waiting = dupInfo && lineDupAck.has(d.id);
      const dupNote = dupInfo
        ? d.inbound
          ? `<p class="bad">疑似重複進貨：${esc(dupInfo.notes.join("；"))}。請先核對「進貨」頁今日已進貨，確定後再按「仍要記入進貨」。</p>`
          : `<p class="bad">疑似重複出貨訂單：${esc(dupInfo.who)} ${esc(dupInfo.day)} 已有（${esc(dupInfo.hint)}）。請先切到「排程」核對，確定不是重複後再按「仍要列入出貨訂單」。</p>`
        : "";
      const src = d.text || d.raw || "";
      const okLabel = d.inbound
        ? waiting
          ? "仍要記入進貨"
          : "確認記入進貨"
        : waiting
          ? "仍要列入出貨訂單"
          : "確認列入出貨訂單";
      const whoField = inbound
        ? `<span class="draft-who">無出貨對象（進貨）</span>`
        : `<label class="draft-who-field">出貨對象 <input data-draft-who type="text" value="${esc(d.customer || "")}" placeholder="尚未寫出貨對象" autocomplete="off" /></label>`;
      return `<article class="line-draft ${inbound ? "is-in" : "is-out"}" data-draft-id="${esc(d.id)}">
        <div class="draft-head">
          <span class="draft-kind">${esc(draftKindLabel(inbound))}</span>
          ${whoField}
          <span class="muted">${esc(day)}</span>
        </div>
        <p class="draft-hint">${esc(draftKindHint(inbound))}</p>
        <p class="draft-label">系統判定（請核對，可直接改）</p>
        ${draftCheckRowsHtml(d)}
        ${unk}
        ${dupNote}
        <details class="draft-src">
          <summary>原文</summary>
          <pre>${esc(src)}</pre>
        </details>
        <div class="btn-row">
          <button type="button" class="primary" data-line-ok="${esc(d.id)}">${okLabel}</button>
          <button type="button" class="ghost" data-line-no="${esc(d.id)}">丟掉</button>
        </div>
      </article>`;
    })
    .join("");
}
async function refreshLineDrafts() {
  const st = document.getElementById("line-api-status");
  try {
    const s = await fetch("/api/line/status", { cache: "no-store" }).then((r) => r.json());
    if (st) {
      if (!s.configured) st.textContent = "伺服器還沒填 LINE 金鑰。可先用下方貼上解析。";
      else st.textContent = "LINE 頻道已接上。群組一定要先 @鴻安農業科技，沒 @ 不會入單。一對一聊天不必 @。";
    }
  } catch (_) {
    if (st) st.textContent = "本機或尚未部署 webhook。可先貼上文字解析。";
  }
  try {
    const data = await fetch("/api/line/drafts", { cache: "no-store" }).then((r) => r.json());
    const incoming = Array.isArray(data.drafts) ? data.drafts : [];
    lineDraftsCache = incoming.map((d) => {
      if (!dirtyDraftIds.has(d.id)) return d;
      return lineDraftsCache.find((x) => x.id === d.id) || d;
    });
  } catch (_) {
    lineDraftsCache = [];
  }
  renderLineDrafts();
}

function applyCopy() {
  const formTitle = document.getElementById("form-title");
  const formHint = document.getElementById("form-hint");
  const cust = document.getElementById("customer");
  const tabs = document.getElementById("form-kind-tabs");
  if (tabs) tabs.hidden = true;
  document.querySelectorAll("[data-form]").forEach((b) => b.classList.toggle("on", b.dataset.form === formKind));
  document.querySelectorAll("[data-stock-kind]").forEach((b) => b.classList.toggle("on", b.dataset.stockKind === stockKind));
  if (formTitle) formTitle.textContent = editing ? "修改數量" : "總訂單";
  if (formHint) formHint.hidden = true;
  const submit = document.getElementById("order-submit");
  if (submit) {
    submit.textContent = editing ? "確認改單" : isPreorderDay() ? "確認預訂單" : "確認送出";
  }
  if (cust) {
    cust.placeholder = "輸入姓名";
    cust.readOnly = false;
  }
}

function render() {
  try {
    if (ensureTodayBooks()) {
      syncAllNqQty();
      save();
    }
  } catch (err) {
    console.error(err);
  }
  applyRoleUi();
  document.getElementById("co-name").textContent =
    page === "home"
      ? "鴻安農業科技"
      : currentRole() === "driver"
        ? "派貨"
        : page === "books" && booksPart === "rack"
          ? "鐵架／八格籃"
        : page === "books"
          ? (co === "nq" ? "穠全公司 · 倉管／帳款" : "鴻安公司 · 倉管／帳款")
          : page === "soon"
            ? "帳款業務"
            : "產品出貨";
  document.querySelectorAll("[data-co]").forEach((b) => b.classList.toggle("on", b.dataset.co === co));
  const onBooks = page === "books";
  const onRack = onBooks && booksPart === "rack";
  const coTabs = document.getElementById("co-tabs");
  const booksTabs = document.getElementById("books-part-tabs");
  if (coTabs) coTabs.hidden = !onBooks || onRack;
  if (booksTabs) booksTabs.hidden = true;
  document.querySelectorAll("#books-part-tabs [data-books]").forEach((b) => b.classList.toggle("on", b.dataset.books === booksPart));
  document.querySelectorAll("#flow-tabs [data-page]").forEach((b) => b.classList.toggle("on", b.dataset.page === page));
  const pageHome = document.getElementById("page-home");
  if (pageHome) pageHome.hidden = page !== "home";
  const pageSoon = document.getElementById("page-soon");
  if (pageSoon) pageSoon.hidden = page !== "soon";
  document.getElementById("page-orders").hidden = page !== "orders";
  document.getElementById("page-plan").hidden = page !== "plan";
  document.getElementById("page-stock").hidden = !(onBooks && booksPart === "stock");
  const pageIn = document.getElementById("page-in");
  if (pageIn) pageIn.hidden = !(onBooks && booksPart === "in");
  const pageSales = document.getElementById("page-sales");
  if (pageSales) pageSales.hidden = !(onBooks && booksPart === "sales");
  const pageRack = document.getElementById("page-rack");
  if (pageRack) pageRack.hidden = !onRack;
  const kindTabs = document.getElementById("stock-kind-tabs");
  if (kindTabs) kindTabs.hidden = co === "ha";
  applyCopy();
  syncShipMore();
  syncShipAddrUi();
  document.getElementById("order-form").hidden = page !== "orders";
  const restBtn = document.getElementById("nq-rest-btn");
  if (restBtn) restBtn.hidden = page !== "orders";
  const nqCancel = document.getElementById("nq-cancel-edit");
  if (nqCancel) nqCancel.hidden = true;
  const run = (fn) => {
    try {
      fn();
    } catch (err) {
      console.error(err);
    }
  };
  run(renderHomeHub);
  run(renderStaffChips);
  run(renderLineDrafts);
  run(renderCustSuggest);
  run(renderDailyGrid);
  run(renderSheet);
  run(renderCheck);
  run(renderOrders);
  run(renderRestList);
  run(renderPlan);
  run(renderStock);
  run(renderRack);
  run(renderSalesBooks);
  run(renderAlerts);
  run(() => applyOrdersPane(false));
  run(() => applyInPane(false));
  run(() => applyPlanPane());
  run(() => applyPlanMain(false));
  run(syncOrderEntering);
}

document.querySelectorAll("[data-co]").forEach((btn) => {
  btn.onclick = () => {
    co = btn.dataset.co;
    editing = "";
    ticketLines = [];
    document.getElementById("edit-id").value = "";
    document.getElementById("cancel-edit").hidden = true;
    const nqCancel = document.getElementById("nq-cancel-edit");
    if (nqCancel) nqCancel.hidden = true;
    render();
  };
});
document.getElementById("home-btn")?.addEventListener("click", goHome);
document.getElementById("home-hub")?.addEventListener("click", (e) => {
  if (e.target.closest("[data-hub-back]")) {
    hubOpen = "";
    renderHomeHub();
    return;
  }
  const tile = e.target.closest("[data-hub]");
  if (tile) {
    hubOpen = tile.dataset.hub || "";
    renderHomeHub();
    return;
  }
  const btn = e.target.closest("[data-go]");
  if (!btn) return;
  goFromHub(btn);
});
document.querySelectorAll("#flow-tabs [data-page]").forEach((btn) => {
  btn.onclick = () => {
    const next = btn.dataset.page;
    if (next === "plan" && !can("page-plan")) return setStatus("沒有排程權限。", true);
    if (next === "orders" && !can("page-orders")) return setStatus("沒有總訂單權限。", true);
    if (next === "books" && !can("page-books")) return setStatus("沒有後帳權限。", true);
    page = next;
    render();
  };
});
document.querySelectorAll("[data-orders-pane]").forEach((btn) => {
  btn.onclick = () => {
    if (document.body.classList.contains("order-entering") && btn.dataset.ordersPane === "today") {
      setStatus("正在輸入訂單，請先確認送出或清掉本單。", true);
      return;
    }
    ordersPane = btn.dataset.ordersPane === "today" ? "today" : "form";
    applyOrdersPane(true);
  };
});
const ordersSwipe = document.getElementById("orders-swipe");
if (ordersSwipe) {
  ordersSwipe.addEventListener(
    "scroll",
    () => {
      if (ordersPaneLock || page !== "orders") return;
      window.clearTimeout(ordersSwipe._paneT);
      ordersSwipe._paneT = window.setTimeout(() => {
        const panes = [...ordersSwipe.querySelectorAll("[data-orders-pane-page]")];
        const mid = ordersSwipe.scrollLeft + ordersSwipe.clientWidth / 2;
        const cur = panes.find((p) => p.offsetLeft <= mid && p.offsetLeft + p.offsetWidth > mid);
        if (!cur) return;
        const next = cur.dataset.ordersPanePage === "today" ? "today" : "form";
        if (next === ordersPane) return;
        if (document.body.classList.contains("order-entering") && next === "today") {
          applyOrdersPane(false);
          return;
        }
        ordersPane = next;
        document.querySelectorAll("#orders-pane-tabs [data-orders-pane]").forEach((b) => {
          b.classList.toggle("on", b.dataset.ordersPane === ordersPane);
        });
      }, 60);
    },
    { passive: true },
  );
}
document.querySelectorAll("#rack-pane-tabs [data-rack-pane]").forEach((btn) => {
  btn.onclick = () => {
    rackPane = btn.dataset.rackPane || "frame";
    rackPick = "";
    rackLine = "";
    renderRack();
  };
});
document.querySelectorAll("[data-rack-mode]").forEach((btn) => {
  btn.onclick = () => {
    rackMode = btn.dataset.rackMode === "custom" ? "custom" : "asof";
    if (rackMode === "custom" && !rackFrom) {
      const span = rackDateSpan();
      rackFrom = span.from || rackTo;
    }
    if (rackFrom && rackTo && rackFrom > rackTo) {
      const t = rackFrom;
      rackFrom = rackTo;
      rackTo = t;
    }
    rackPick = "";
    rackLine = "";
    renderRack();
  };
});
document.getElementById("rack-from")?.addEventListener("change", () => {
  rackFrom = document.getElementById("rack-from").value || "";
  if (rackFrom && rackTo && rackFrom > rackTo) rackTo = rackFrom;
  rackPick = "";
  rackLine = "";
  renderRack();
});
document.getElementById("rack-to")?.addEventListener("change", () => {
  rackTo = document.getElementById("rack-to").value || today();
  rackPick = "";
  rackLine = "";
  renderRack();
});
document.getElementById("rack-co")?.addEventListener("change", () => {
  rackCo = document.getElementById("rack-co").value || "";
  rackPick = "";
  rackLine = "";
  renderRack();
});
document.getElementById("rack-frame")?.addEventListener("change", () => {
  rackPick = document.getElementById("rack-frame").value || "";
  renderRack();
});
document.getElementById("rack-q")?.addEventListener("input", () => {
  rackQ = document.getElementById("rack-q").value || "";
  rackPick = "";
  rackLine = "";
  renderRack();
});
document.getElementById("rack-xls")?.addEventListener("change", async (e) => {
  const input = e.target;
  const files = [...(input.files || [])];
  input.value = "";
  if (!files.length) return;
  setRackImportMsg("正在匯入…");
  try {
    const payload = [];
    for (const f of files) {
      payload.push({ name: f.name, data: bufToB64(await f.arrayBuffer()) });
    }
    const r = await fetch("./api/racks-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: payload }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) {
      setRackImportMsg(j.error || "匯入失敗", "err");
      return;
    }
    const kind = j.added === 0 && j.dup > 0 ? "dup" : "";
    setRackImportMsg(j.message || "上傳成功", kind);
    reloadRackTxns();
  } catch (_) {
    setRackImportMsg("匯入失敗", "err");
  }
});
document.getElementById("rack-box")?.addEventListener("click", (e) => {
  const back = e.target.closest("[data-rack-back]");
  if (back) {
    if (back.dataset.rackBack === "sheet" || rackLine) rackLine = "";
    else rackPick = "";
    renderRack();
    return;
  }
  const line = e.target.closest("[data-rack-line]");
  if (line) {
    rackLine = line.dataset.rackLine || "";
    renderRack();
    return;
  }
  const row = e.target.closest("[data-rack-pick]");
  if (!row) return;
  rackPick = row.dataset.rackPick || "";
  rackLine = "";
  renderRack();
});
document.querySelectorAll("#in-pane-tabs [data-in-pane]").forEach((btn) => {
  btn.onclick = () => {
    inPane = btn.dataset.inPane === "view" ? "view" : "form";
    applyInPane(true);
  };
});
const inSwipe = document.getElementById("in-swipe");
if (inSwipe) {
  inSwipe.addEventListener(
    "scroll",
    () => {
      if (inPaneLock || page !== "books" || booksPart !== "in") return;
      window.clearTimeout(inSwipe._paneT);
      inSwipe._paneT = window.setTimeout(() => {
        const panes = [...inSwipe.querySelectorAll("[data-in-pane-page]")];
        const mid = inSwipe.scrollLeft + inSwipe.clientWidth / 2;
        const cur = panes.find((p) => p.offsetLeft <= mid && p.offsetLeft + p.offsetWidth > mid);
        if (!cur) return;
        const next = cur.dataset.inPanePage === "view" ? "view" : "form";
        if (next === inPane) return;
        inPane = next;
        document.querySelectorAll("#in-pane-tabs [data-in-pane]").forEach((b) => {
          b.classList.toggle("on", b.dataset.inPane === inPane);
        });
      }, 60);
    },
    { passive: true },
  );
}
document.querySelectorAll("#books-part-tabs [data-books]").forEach((btn) => {
  btn.onclick = () => {
    booksPart = btn.dataset.books;
    page = "books";
    render();
  };
});
document.querySelectorAll("[data-plan-main]").forEach((btn) => {
  btn.onclick = () => {
    if (currentRole() === "driver") return;
    planMain = btn.dataset.planMain === "ship" ? "ship" : "short";
    applyPlanMain(true);
  };
});
document.querySelectorAll("[data-plan-pane]").forEach((btn) => {
  btn.onclick = () => {
    planPane = btn.dataset.planPane === "done" ? "done" : "pending";
    applyPlanPane();
  };
});
const planMainSwipe = document.getElementById("plan-main-swipe");
if (planMainSwipe) {
  planMainSwipe.addEventListener(
    "scroll",
    () => {
      if (planMainLock || page !== "plan" || currentRole() === "driver") return;
      window.clearTimeout(planMainSwipe._paneT);
      planMainSwipe._paneT = window.setTimeout(() => {
        const panes = [...planMainSwipe.querySelectorAll("[data-plan-main-page]")];
        const mid = planMainSwipe.scrollLeft + planMainSwipe.clientWidth / 2;
        const cur = panes.find((p) => p.offsetLeft <= mid && p.offsetLeft + p.offsetWidth > mid);
        if (!cur) return;
        const next = cur.dataset.planMainPage === "ship" ? "ship" : "short";
        if (next === planMain) return;
        planMain = next;
        document.querySelectorAll("#plan-main-tabs [data-plan-main]").forEach((b) => {
          b.classList.toggle("on", b.dataset.planMain === planMain);
        });
      }, 60);
    },
    { passive: true },
  );
}
document.getElementById("plan-card").addEventListener("click", (e) => {
  const take = e.target.closest("[data-drive-take]");
  if (take) {
    e.preventDefault();
    takeCustomerRun(take.dataset.driveTake);
    return;
  }
  const proof = e.target.closest("[data-drive-proof]");
  if (proof) {
    e.preventDefault();
    openProofGate(proof.dataset.driveProof);
    return;
  }
  const assign = e.target.closest("[data-assign-driver]");
  if (assign) {
    e.preventDefault();
    e.stopPropagation();
    assignCustomerDriver(assign.dataset.assignWho, assign.dataset.assignDriver);
    return;
  }
  const tog = e.target.closest("[data-drive-open]");
  if (tog) {
    e.preventDefault();
    const id = tog.dataset.driveOpen;
    planOpenId = planOpenId === id ? "" : id;
    renderPlan();
    return;
  }
  const up = e.target.closest("[data-prio-up]");
  if (up && !up.disabled) {
    e.preventDefault();
    bumpOrder(up.dataset.prioUp, -1);
    return;
  }
  const down = e.target.closest("[data-prio-down]");
  if (down && !down.disabled) {
    e.preventDefault();
    bumpOrder(down.dataset.prioDown, 1);
  }
});
document.getElementById("proof-cancel")?.addEventListener("click", closeProofGate);
document.getElementById("proof-clear")?.addEventListener("click", clearProofCanvas);
document.getElementById("proof-ok")?.addEventListener("click", () => {
  submitProof().catch((err) => {
    console.error(err);
    setStatus("送貨證明上傳失敗，請再試一次。", true);
  });
});
document.getElementById("proof-gate")?.addEventListener("click", (e) => {
  if (e.target.id === "proof-gate") closeProofGate();
  const mode = e.target.closest("[data-proof-mode]");
  if (mode) setProofMode(mode.dataset.proofMode);
});
document.getElementById("proof-file")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    proofPhoto = await compressImageFile(file);
    const preview = document.getElementById("proof-preview");
    if (preview) {
      preview.src = proofPhoto;
      preview.hidden = false;
    }
  } catch (err) {
    console.error(err);
    setStatus("照片讀取失敗，請再拍一次。", true);
  }
});
document.querySelectorAll("[data-form]").forEach((btn) => {
  btn.onclick = () => {
    formKind = btn.dataset.form;
    render();
  };
});
document.querySelectorAll("[data-stock-kind]").forEach((btn) => {
  btn.onclick = () => {
    stockKind = btn.dataset.stockKind;
    renderStock();
    applyCopy();
  };
});
document.getElementById("line-parse-btn")?.addEventListener("click", () => {
  const parseBlocks = globalThis.LineOrderParse?.parseLineOrderBlocks;
  const parseOne = globalThis.LineOrderParse?.parseLineOrderText;
  if (!parseBlocks && !parseOne) return setStatus("解析程式還沒載入。", true);
  const raw = document.getElementById("line-paste")?.value || "";
  const names = knownCustomersForParse();
  const blocks = parseBlocks ? parseBlocks(raw, names) : [parseOne(raw, names)];
  let added = 0;
  for (const parsed of blocks) {
    if (!parsed || (!(parsed.lines || []).length && !(parsed.unknown || []).length && !parsed.customer)) continue;
    linePasteQueue.unshift({
      ...parsed,
      id: "paste-" + uid(),
      text: parsed.raw || raw,
      date: parsed.date || today(),
      local: true,
    });
    added += 1;
  }
  if (linePasteQueue.length > 80) linePasteQueue = linePasteQueue.slice(0, 80);
  savePasteQueue();
  renderLineDrafts(true);
  if (!added) setStatus("沒對到品項。出貨訂單請第一行寫客人；進貨請寫例如：地瓜葉誌進貨57。", true);
  else {
    const ta = document.getElementById("line-paste");
    if (ta) ta.value = "";
    setStatus(`已加入 ${added} 筆待確認，目前共 ${linePasteQueue.length + lineDraftsCache.length} 筆。可繼續貼下一位，不必立刻確認。`, false);
  }
});
document.getElementById("line-drafts")?.addEventListener("click", async (e) => {
  const ok = e.target.closest("[data-line-ok]");
  const no = e.target.closest("[data-line-no]");
  if (ok) {
    const id = ok.dataset.lineOk;
    const parsed = findPendingDraft(id);
    if (!parsed) return;
    const dup = parsedDupInfo(parsed, parsed.date);
    if (dup && !lineDupAck.has(id)) {
      lineDupAck.add(id);
      renderLineDrafts(true);
      setStatus(
        dup.inbound
          ? "疑似重複進貨。畫面不會跳窗，請先核對庫存，確定後再按「仍要記入進貨」。"
          : "疑似重複出貨訂單。畫面不會跳窗，請先看「排程」或已填紀錄，確定後再按「仍要列入出貨訂單」。",
        true,
      );
      return;
    }
    if (confirmParsedOrder(parsed, parsed.date)) {
      lineDupAck.delete(id);
      dirtyDraftIds.delete(id);
      if (String(id).startsWith("paste-")) {
        removePasteDraft(id);
        renderLineDrafts(true);
      } else {
        await dropLineDraft(id);
        await refreshLineDrafts();
      }
    }
    return;
  }
  if (no) {
    const id = no.dataset.lineNo;
    lineDupAck.delete(id);
    dirtyDraftIds.delete(id);
    if (String(id).startsWith("paste-")) {
      removePasteDraft(id);
      renderLineDrafts(true);
      return;
    }
    await dropLineDraft(id);
    await refreshLineDrafts();
    return;
  }
  const add = e.target.closest("[data-draft-add]");
  if (add) {
    const d = draftFromEl(add);
    if (!d) return;
    ensureDraftLines(d).push({ skuId: d.inbound ? "sl-zhi" : "on-nz-20", qty: 1 });
    persistDraft(d);
    renderLineDrafts(true);
    return;
  }
  const del = e.target.closest("[data-draft-del]");
  if (del) {
    const d = draftFromEl(del);
    const i = Number(del.closest("tr")?.dataset.draftI);
    if (!d || !Number.isInteger(i)) return;
    ensureDraftLines(d).splice(i, 1);
    persistDraft(d);
    renderLineDrafts(true);
  }
});
document.getElementById("line-drafts")?.addEventListener("input", (e) => {
  const who = e.target.closest("[data-draft-who]");
  const qty = e.target.closest("[data-draft-qty]");
  if (who) {
    const d = draftFromEl(who);
    if (!d) return;
    d.customer = who.value;
    persistDraft(d);
    return;
  }
  if (qty) {
    const d = draftFromEl(qty);
    const i = Number(qty.closest("tr")?.dataset.draftI);
    if (!d || !Number.isInteger(i) || !d.lines[i]) return;
    d.lines[i].qty = Number(qty.value) || 0;
    persistDraft(d);
  }
});
document.getElementById("line-drafts")?.addEventListener("change", (e) => {
  const skuSel = e.target.closest("[data-draft-sku]");
  const sizeSel = e.target.closest("[data-draft-size]");
  const packSel = e.target.closest("[data-draft-pack]");
  const pal = e.target.closest("[data-draft-pallet]");
  const d = draftFromEl(e.target);
  const row = e.target.closest("tr");
  const i = Number(row?.dataset.draftI);
  if (!d || !Number.isInteger(i) || !d.lines?.[i]) return;
  const line = d.lines[i];
  if (skuSel) {
    line.skuId = skuSel.value;
    const sku = skuById(line.skuId);
    if (!draftIsOnionSku(line.skuId)) delete line.size;
    else if (!line.size) line.size = "大球";
    if (!sku?.packRemark) delete line.pack;
    else if (!line.pack) line.pack = "籃裝";
    const unit = row.querySelector(".draft-unit");
    if (unit) unit.textContent = sku?.unit || "";
    const extras = row.querySelector(".draft-extras");
    if (extras) extras.innerHTML = draftLineExtrasHtml(line);
    const qtyInp = row.querySelector("[data-draft-qty]");
    if (qtyInp && sku) qtyInp.step = String(skuStep(sku));
    persistDraft(d);
    return;
  }
  if (sizeSel) {
    line.size = sizeSel.value;
    persistDraft(d);
    return;
  }
  if (packSel) {
    line.pack = packSel.value;
    persistDraft(d);
    return;
  }
  if (pal) {
    if (pal.checked) line.pallet = true;
    else delete line.pallet;
    persistDraft(d);
  }
});
document.getElementById("sheet").addEventListener("input", (e) => {
  if (e.target.closest("[data-line-qty]")) {
    formLot = null;
    syncFormLotRow();
  }
  renderCheck();
  syncOrderEntering();
});
document.getElementById("sheet").addEventListener("change", (e) => {
  const famSel = e.target.closest("[data-fam]");
  if (famSel) {
    const row = famSel.closest(".item-line");
    const fam = famSel.value;
    const host = row?.querySelector("[data-ha-extras], [data-nq-extras], [data-veg-extras]");
    if (host) host.outerHTML = famExtrasHtml(fam, { fam });
    const unit = row?.querySelector("[data-line-unit]");
    const pack = row?.querySelector("[data-nq-pack]")?.value || "籃裝";
    if (unit) unit.textContent = nqUnitOfCat(fam, pack);
    const qty = row?.querySelector("[data-line-qty]");
    if (qty) {
      qty.step =
        fam === "on-b" || fam === "pk-b" || fam === "mint-kg" || fam === "shiso-kg" || fam === "basil-kg" || fam === "shiso-jin"
          ? "0.1"
          : "1";
    }
  }
  const kind = e.target.closest("[data-ha-kind]");
  if (kind) {
    const row = kind.closest(".ha-line");
    const extras = row?.querySelector("[data-ha-extras]");
    const unit = row?.querySelector("[data-ha-unit]");
    const qty = row?.querySelector("[data-ha-qty]");
    if (extras) extras.innerHTML = haExtrasHtml(kind.value);
    if (unit) unit.textContent = haUnitOf(kind.value);
    if (qty) qty.step = kind.value.endsWith("-b") ? "0.1" : "1";
  }
  const packSel = e.target.closest("[data-nq-pack]");
  if (packSel) {
    const unit = packSel.closest(".ha-line")?.querySelector("[data-line-unit], .unit");
    if (unit) unit.textContent = packSel.value === "箱裝" ? "箱" : "籃";
  }
  renderCheck();
});
document.getElementById("sheet").addEventListener("click", (e) => {
  if (e.target.closest("[data-ticket-add]")) {
    pushPickerToTicket();
    return;
  }
  if (e.target.closest("[data-lot-pick-form]")) {
    const draft = unifiedLinesFromForm()[0] || draftSkuFromFormRow();
    if (!draft?.skuId) return setStatus("請先選品項並填數量，再選出貨編號。", true);
    const qty = Number(draft.qty) || Number(document.querySelector("[data-line-qty]")?.value);
    openLotModal({ skuId: draft.skuId, qty, selectedUha: formLot?.uha });
    return;
  }
  const palletBtn = e.target.closest("[data-pallet-toggle]");
  if (palletBtn) {
    palletBtn.classList.toggle("on");
    palletBtn.setAttribute("aria-pressed", palletBtn.classList.contains("on") ? "true" : "false");
    return;
  }
  const pick = e.target.closest(".item-line .pick");
  const pickRow = pick?.closest(".item-line");
  if (pick && pickRow) {
    const key = pick.dataset.k;
    if (key === "big") {
      const hasQty = Number(pickRow.querySelector("[data-line-qty]")?.value) > 0;
      const cur = pickVal(pickRow, "big");
      if (hasQty && cur) {
        pushPickerToTicket(pick.dataset.v);
        return;
      }
    }
    pickRow.querySelectorAll(`.pick[data-k="${key}"]`).forEach((b) => b.classList.toggle("on", b === pick));
    if (key === "big") {
      const sub = pickRow.querySelector("[data-sub]");
      if (sub) sub.innerHTML = lineSubHtml(pick.dataset.v, {});
    }
    formLot = null;
    syncLineMeta(pickRow);
    renderCheck();
    return;
  }
  const del = e.target.closest("[data-ha-del]");
  if (!del) return;
  formLot = null;
  renderItemSheet();
  renderCheck();
});
document.getElementById("ticket")?.addEventListener("click", (e) => {
  const destBtn = e.target.closest("[data-ticket-dest]");
  if (destBtn) {
    const i = Number(destBtn.dataset.ticketDest);
    const v = destBtn.dataset.dest;
    if (!ticketLines[i]) return;
    if (v === "其他") {
      const cur = String(ticketLines[i].dest || "").trim();
      if (SHIP_PRESETS.includes(cur)) ticketLines[i].dest = "";
      ticketLines[i].destOther = true;
    } else {
      ticketLines[i].dest = v;
      delete ticketLines[i].destOther;
    }
    syncHiddenShipAddr();
    renderTicket();
    return;
  }
  const pal = e.target.closest("[data-ticket-pallet]");
  if (pal) {
    const i = Number(pal.dataset.ticketPallet);
    if (!ticketLines[i]) return;
    if (ticketLines[i].pallet) delete ticketLines[i].pallet;
    else ticketLines[i].pallet = true;
    renderTicket();
    renderCheck();
    return;
  }
  const lotBtn = e.target.closest("[data-ticket-lot]");
  if (lotBtn) {
    const i = Number(lotBtn.dataset.ticketLot);
    const line = ticketLines[i];
    if (!line) return;
    openLotModal({ skuId: line.skuId, qty: line.qty, selectedUha: line.lotUha, ticketIndex: i });
    return;
  }
  const del = e.target.closest("[data-ticket-del]");
  if (!del) return;
  const i = Number(del.dataset.ticketDel);
  if (!Number.isInteger(i)) return;
  ticketLines.splice(i, 1);
  syncHiddenShipAddr();
  renderTicket();
  renderCheck();
});
document.getElementById("ticket")?.addEventListener("input", (e) => {
  const destOther = e.target.closest("[data-ticket-dest-other]");
  if (destOther) {
    const i = Number(destOther.dataset.ticketDestOther);
    if (!ticketLines[i]) return;
    ticketLines[i].dest = destOther.value.trim();
    ticketLines[i].destOther = true;
    syncHiddenShipAddr();
    const addr = document.querySelector("#ticket .ticket-addr");
    const drops = uniqueTicketDrops();
    if (addr) addr.textContent = drops.join("／");
    return;
  }
  const inp = e.target.closest("[data-ticket-qty]");
  if (!inp) return;
  const i = Number(inp.dataset.i);
  if (!ticketLines[i]) return;
  const n = Number(inp.value);
  if (!(n > 0)) {
    ticketLines.splice(i, 1);
    syncHiddenShipAddr();
    renderTicket();
  } else {
    ticketLines[i].qty = round(n);
    if (skuNeedsShipLot(ticketLines[i].skuId)) {
      clearLineLot(ticketLines[i]);
      setStatus("數量已改，請重選出貨編號。", true);
      renderTicket();
    }
  }
  renderCheck();
});
document.getElementById("order-form")?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  if (e.target.closest("[data-line-qty]")) {
    e.preventDefault();
    pushPickerToTicket();
  }
  if (e.target.closest("[data-ticket-qty]")) e.preventDefault();
});
document.getElementById("ship-addr-picks")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-ship-pick]");
  if (!btn) return;
  pickShipAddr(btn.dataset.shipPick);
});
document.getElementById("ship-addr")?.addEventListener("input", () => {
  const onOther = document.querySelector('#ship-addr-picks [data-ship-pick="其他"]')?.classList.contains("on");
  if (!onOther) {
    document.querySelectorAll("#ship-addr-picks [data-ship-pick]").forEach((b) => {
      b.classList.toggle("on", b.dataset.shipPick === "其他");
    });
    const other = document.getElementById("ship-addr-other-wrap");
    if (other) other.hidden = false;
  }
  renderTicket();
});
document.getElementById("ship-date").value = today();
syncShipMore();
syncShipAddrUi();
const ordersTodayDate = document.getElementById("orders-today-date");
if (ordersTodayDate) ordersTodayDate.value = today();
document.getElementById("ship-date").addEventListener("change", () => {
  syncOrderDates(document.getElementById("ship-date").value || today());
  if (useItemLines()) {
    renderOrders();
    renderRestList();
    renderTicket();
    renderCheck();
  }
});
if (ordersTodayDate) {
  ordersTodayDate.addEventListener("change", () => {
    syncOrderDates(ordersTodayDate.value || today());
    renderOrders();
    renderRestList();
    if (useItemLines()) {
      renderTicket();
      renderCheck();
    }
    renderDailyGrid();
  });
}
document.getElementById("daily-sheet-date").value = today();
document.getElementById("daily-sheet-date").addEventListener("change", () => {
  syncOrderDates(document.getElementById("daily-sheet-date").value || today());
  renderDailyGrid();
  renderLeafInbound();
  renderCheck();
  renderRestList();
  renderOrders();
});
document.getElementById("daily-sheet").addEventListener("input", (e) => {
  const el = e.target.closest("[data-who][data-col]");
  if (!el) return;
  if (el.classList.contains("cell-in") && !e.isComposing) {
    const t = el.value.trim();
    const cleaned = formAllowsRest() && t === "休" ? "休" : t.replace(/[^\d.]/g, "");
    if (cleaned !== el.value) el.value = cleaned;
  }
  const date = document.getElementById("daily-sheet-date").value || today();
  const { data, book } = dailyBook(date);
  const row = dailyRow(book, el.dataset.who);
  if (formKind === "basil") migrateBasilDailyRow(row);
  if (el.classList.contains("cell-in")) {
    const mode = applyQtyCellValue(row, el.dataset.who, el.dataset.col, el.value, date);
    if (mode === "rest") {
      document.querySelectorAll("#daily-sheet .cell-in").forEach((input) => {
        if (input.dataset.who === el.dataset.who && qtyColKeys().includes(input.dataset.col)) {
          input.value = "休";
        }
      });
      el.closest("tr")?.classList.add("rest-row");
    } else {
      el.closest("tr")?.classList.remove("rest-row");
      document.querySelectorAll("#daily-sheet .cell-in").forEach((input) => {
        if (input.dataset.who === el.dataset.who && input !== el && isRestText(input.value)) input.value = "";
      });
    }
  } else {
    row[el.dataset.col] = el.value;
  }
  saveDailyStore(data);
  if (el.classList.contains("cell-in")) {
    const col = el.dataset.col;
    let n = 0;
    document.querySelectorAll(`#daily-sheet [data-col="${col}"]`).forEach((input) => {
      if (isRestText(input.value)) return;
      n += Number(input.value) || 0;
    });
    const cols = currentCols();
    const idx = cols.findIndex((c) => c.key === col);
    const cell = document.querySelector(`#daily-sheet tfoot td:nth-child(${idx + 2})`);
    if (cell) cell.textContent = n ? fmt(n) : "";
  }
  refreshInboundCompare();
  renderCheck();
  renderRestList();
});
document.getElementById("daily-sheet").addEventListener("change", (e) => {
  const el = e.target.closest("[data-who][data-col]");
  if (!el) return;
  if (el.classList.contains("cell-in")) return;
  const date = document.getElementById("daily-sheet-date").value || today();
  const { data, book } = dailyBook(date);
  const row = dailyRow(book, el.dataset.who);
  if (formKind === "basil") migrateBasilDailyRow(row);
  row[el.dataset.col] = el.value;
  saveDailyStore(data);
  refreshInboundCompare();
  renderCheck();
});
document.getElementById("daily-sheet").addEventListener("keydown", (e) => {
  const el = e.target.closest("[data-r][data-c]");
  if (!el) return;
  if (e.isComposing) return;
  const dir = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
    Enter: [e.shiftKey ? -1 : 1, 0],
  }[e.key];
  if (!dir) return;
  e.preventDefault();
  moveDailyCell(el, dir[0], dir[1]);
});
document.getElementById("daily-sheet").addEventListener("focusin", (e) => {
  const el = e.target;
  if (el.classList.contains("cell-in") || el.classList.contains("cell-note")) el.select();
});
document.getElementById("daily-sheet").addEventListener("click", (e) => {
  const drop = e.target.closest("[data-drop-who]");
  if (!drop) return;
  const name = drop.dataset.dropWho;
  if (!confirm(`從「${FORM_KINDS[formCustKey()]?.label || "本表"}」出貨對象移除「${name}」？只拿掉本表數量，其他表單（地瓜葉／九層塔／散賣）不會刪。`)) return;
  removeNqCustomer(name);
  const { data, book } = dailyBook(sheetDate());
  if (book[name]) {
    clearFormFields(book[name], formCustKey());
    if (!Object.keys(book[name]).length) delete book[name];
  }
  saveDailyStore(data);
  render();
});
function commitNqWho() {
  const input = document.getElementById("nq-add-who");
  const name = (input?.value || "").trim();
  if (!name) return setStatus("請輸入出貨對象名稱。", true);
  addNqCustomer(name);
  input.value = "";
  setStatus(`已新增出貨對象「${name}」。`, false);
  render();
}
document.getElementById("nq-add-who-btn").onclick = commitNqWho;
document.getElementById("nq-add-who").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    commitNqWho();
  }
});
const inboundBox = document.getElementById("leaf-inbound");
if (inboundBox) {
  inboundBox.addEventListener("input", (e) => {
    const input = e.target.closest("[data-in-sku]");
    if (!input) return;
    const cleaned = input.value.replace(/[^\d.]/g, "");
    if (cleaned !== input.value) input.value = cleaned;
  });
  inboundBox.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add-in-sku]");
    if (!btn) return;
    const id = btn.dataset.addInSku;
    const input = document.querySelector(`[data-in-sku="${id}"]`);
    addInboundLot(id, input?.value, sheetDate());
    if (input) input.value = "";
  });
  inboundBox.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const input = e.target.closest("[data-in-sku]");
    if (!input) return;
    e.preventDefault();
    addInboundLot(input.dataset.inSku, input.value, sheetDate());
    input.value = "";
  });
}
document.getElementById("nq-confirm").onclick = confirmNqSchedule;
document.getElementById("nq-cancel-edit").onclick = () => {
  editing = "";
  document.getElementById("edit-id").value = "";
  document.getElementById("nq-cancel-edit").hidden = true;
  render();
};
document.getElementById("nq-rest-btn")?.addEventListener("click", () => {
  if (!useNqLineForm()) return;
  if (!requireStaff()) return;
  const who = document.getElementById("customer").value.trim();
  if (!who) return setStatus("請填出貨對象", true);
  const day = document.getElementById("ship-date").value || today();
  upsertRest(who, day);
  addNqCustomer(who);
  setStatus(`已記錄「${who}」${isPreorderDay(day) ? shortDay(day) + " " : "今日"}無叫貨。`, false);
  document.getElementById("customer").value = "";
  ticketLines = [];
  setOrderNote("");
  render();
});
document.getElementById("who-btn")?.addEventListener("click", () => {
  if (currentStaff()) {
    returnToLogin();
    return;
  }
  hideLoginPin();
  renderLoginPeople();
  openLoginGate();
});
document.getElementById("login-gate")?.addEventListener("click", (e) => {
  if (e.target.id === "login-gate" && currentStaff()) {
    closeLoginGate();
    return;
  }
  const btn = e.target.closest("[data-login]");
  if (!btn) return;
  pickLoginPerson(btn.dataset.login);
});
document.getElementById("login-pin")?.addEventListener("submit", (e) => {
  e.preventDefault();
  submitLoginPin();
});
document.getElementById("login-pin-back")?.addEventListener("click", () => {
  hideLoginPin();
});
document.getElementById("operator-chips")?.addEventListener("click", (e) => {
  const forget = e.target.closest("[data-forget-staff]");
  if (forget) {
    e.preventDefault();
    const name = forget.dataset.forgetStaff;
    saveStaffList(loadStaffList().filter((x) => x !== name));
    if (currentStaff() === name) {
      try {
        localStorage.removeItem(STAFF_NOW_KEY);
      } catch (_) {}
      const el = document.getElementById("operator");
      if (el) el.value = "";
    }
    renderStaffChips();
    return;
  }
  const btn = e.target.closest("[data-staff]");
  if (!btn) return;
  rememberStaff(btn.dataset.staff);
  renderStaffChips();
});
document.getElementById("operator")?.addEventListener("change", () => {
  const n = document.getElementById("operator").value.trim();
  if (n) rememberStaff(n);
  renderStaffChips();
});
document.getElementById("cust-suggest")?.addEventListener("mousedown", (e) => {
  const btn = e.target.closest("[data-cust]");
  if (!btn) return;
  e.preventDefault();
  document.getElementById("customer").value = btn.dataset.cust;
  fillAddrForCustomer(btn.dataset.cust);
  const whoEl = document.querySelector("#ticket .ticket-who span");
  if (whoEl) whoEl.textContent = ticketWhoText();
  const box = document.getElementById("cust-suggest");
  if (box) {
    box.hidden = true;
    box.innerHTML = "";
  }
  const first = document.querySelector("#sheet .qty");
  if (first) first.focus();
  syncOrderEntering();
});
function bindCustomerSuggest() {
  const customerEl = document.getElementById("customer");
  if (!customerEl) return;
  const syncWho = () => {
    const whoEl = document.querySelector("#ticket .ticket-who span");
    if (whoEl) whoEl.textContent = ticketWhoText();
  };
  customerEl.addEventListener("compositionstart", (e) => {
    customerEl.dataset.composing = "1";
    custCompose = e.data || customerEl.value || "";
  });
  customerEl.addEventListener("compositionupdate", (e) => {
    customerEl.dataset.composing = "1";
    custCompose = e.data || customerEl.value || "";
    renderCustSuggest();
  });
  customerEl.addEventListener("compositionend", () => {
    customerEl.dataset.composing = "";
    custCompose = "";
    renderCustSuggest();
    syncWho();
    syncOrderEntering();
  });
  customerEl.addEventListener("input", (e) => {
    if (e.isComposing || customerEl.dataset.composing === "1") {
      if (!custCompose) custCompose = customerEl.value || "";
      renderCustSuggest();
      syncOrderEntering();
      return;
    }
    custCompose = "";
    renderCustSuggest();
    syncWho();
    syncOrderEntering();
  });
  customerEl.addEventListener("focus", renderCustSuggest);
  customerEl.addEventListener("blur", () => {
    const who = customerEl.value.trim();
    if (who && !shipAddrValue()) fillAddrForCustomer(who);
    setTimeout(() => {
      const box = document.getElementById("cust-suggest");
      if (box) {
        box.hidden = true;
        box.innerHTML = "";
      }
    }, 150);
  });
}
bindCustomerSuggest();
document.getElementById("order-note")?.addEventListener("input", syncOrderEntering);
document.getElementById("lot-cancel")?.addEventListener("click", closeLotModal);
document.getElementById("lot-gate")?.addEventListener("click", (e) => {
  if (e.target.id === "lot-gate") closeLotModal();
});
document.getElementById("lot-list")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-pick-uha]");
  if (!btn || btn.disabled) return;
  chooseLot(btn.dataset.pickUha);
});

document.getElementById("order-form").onsubmit = (e) => {
  e.preventDefault();
  const leftover = unifiedLinesFromForm();
  if (leftover.length) return setStatus("請先按「加入本單」。品項都加入後，再到最下方確認送出。", true);
  const lines = ticketLines.map(cleanLine).filter((l) => Number(l.qty) > 0);
  if (!lines.length) return setStatus("請先加入至少一項到本單，齊了再確認送出。", true);
  if (missingPack(lines)) return setStatus("地瓜葉有數量時請選擇裝箱樣式（籃裝或箱裝）", true);
  const missingLot = lines.find((l) => skuNeedsShipLot(l.skuId) && !l.lotUha);
  if (missingLot) return setStatus(`請選出貨編號：${ticketLineName(missingLot)}`, true);
  const map = qtyMapFromForm();
  const { worst } = lineChecks(map, currentRecord());
  const who = document.getElementById("customer").value.trim();
  if (!who) return setStatus("請填出貨對象", true);
  if (!requireStaff()) return;
  const day = shipDateValue();
  const { ha, nq } = splitLinesByCo(lines);
  if (!editing) {
    if (ha.length && !warnIfDup("ha", who, day)) return;
    if (nq.length && !warnIfDup("nq", who, day)) return;
  }
  let editNote = "";
  const savedIds = [];
  if (editing) {
    const o = state.orders.find((x) => x.id === editing);
    if (!o) return;
    const wasShipped = o.status === "shipped" || o.status === "delivered";
    const shipMeta = snapshotShipMeta(o);
    if (o.status === "shipped") unwindShipment(o);
    const mine = lines.filter((l) => skuById(l.skuId)?.co === o.co);
    const other = lines.filter((l) => skuById(l.skuId)?.co && skuById(l.skuId).co !== o.co);
    if (!mine.length) return setStatus(`這張是${coLabel(o.co)}單，請至少留一項${coLabel(o.co)}品項。`, true);
    o.customer = who;
    o.shipAddr = shipAddrValue();
    o.remark = orderNoteValue();
    o.shipDate = day;
    o.preorder = isPreorderDay(day);
    o.lines = mine;
    markOrderEdited(o);
    savedIds.push(o.id);
    if (other.length) {
      const otherCo = o.co === "ha" ? "nq" : "ha";
      savedIds.push(addOpenOrderFor(otherCo, who, day, other, shipAddrValue()));
    }
    if (wasShipped) {
      applyOpenShipment(o);
      restoreShipMeta(o, shipMeta);
    } else o.status = "open";
    editing = "";
    document.getElementById("cancel-edit").hidden = true;
    editNote = wasShipped
      ? `已改件數並重算扣庫。修改人員：${currentStaff()}。`
      : `已改單，修改人員：${currentStaff()}。`;
  } else {
    if (ha.length) savedIds.push(addOpenOrderFor("ha", who, day, ha, shipAddrValue()));
    if (nq.length) savedIds.push(addOpenOrderFor("nq", who, day, nq, shipAddrValue()));
  }
  rememberCustomer(who, lines);
  removeRest(who, day);
  formDupAck = "";
  ticketLines = [];
  save();
  document.getElementById("customer").value = "";
  setShipAddr("");
  setOrderNote("");
  goTodayAfterSave(savedIds, day);
  if (editNote) setStatus(editNote, false);
  else {
    const bits = [];
    if (nq.length) bits.push(`穠全 ${nq.length} 項`);
    if (ha.length) bits.push(`鴻安 ${ha.length} 項`);
    setStatus(`已記入「${who}」${isPreorderDay(day) ? "預訂單" : ""}（${bits.join("、")}）。`, worst === "bad");
  }
  render();
};

document.getElementById("cancel-edit").onclick = () => {
  editing = "";
  document.getElementById("cancel-edit").hidden = true;
  ticketLines = [];
  document.getElementById("ship-date").value = today();
  setShipAddr("");
  setOrderNote("");
  syncShipMore();
  render();
};

function onUnrestClick(e) {
  const btn = e.target.closest("[data-unrest]");
  if (!btn) return;
  const name = btn.dataset.unrest;
  const date = sheetDate();
  removeRest(name, date);
  const { data, book } = dailyBook(date);
  clearRowRest(book[name]);
  saveDailyStore(data);
  render();
}
document.getElementById("rest-list").addEventListener("click", onUnrestClick);
document.getElementById("orders-today-rest")?.addEventListener("click", onUnrestClick);
document.getElementById("orders").onclick = onOrdersListClick;
document.getElementById("orders-today")?.addEventListener("click", onOrdersListClick);
function onOrdersListClick(e) {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const o = state.orders.find((x) => x.id === btn.dataset.id);
  if (!o) return;
  if (btn.dataset.act === "up") {
    bumpOrder(o.id, -1);
    return;
  }
  if (btn.dataset.act === "down") {
    bumpOrder(o.id, 1);
    return;
  }
  if (btn.dataset.act === "cancel") {
    if (!requireStaff()) return;
    o.status = "cancelled";
    o.cancelledBy = currentStaff();
    save();
    setStatus(`已取消（紅線保留）。取消人員：${currentStaff()}`, false);
    render();
    return;
  }
  if (btn.dataset.act === "delete") {
    if (!requireStaff()) return;
    if (!confirm(`確定刪除「${o.customer}」這筆訂單？刪除後仍會留在已填紀錄，標「已刪除」並註記刪除人員。`)) return;
    unwindShipment(o);
    o.status = "deleted";
    o.deletedBy = currentStaff();
    if (editing === o.id) {
      editing = "";
      document.getElementById("edit-id").value = "";
      document.getElementById("cancel-edit").hidden = true;
    }
    save();
    setStatus(`已刪除並留存紀錄。刪除人員：${currentStaff()}`, false);
    render();
    return;
  }
  if (btn.dataset.act === "edit") {
    if (!requireStaff()) return;
    if (o.status === "shipped" && !can("edit-shipped")) return setStatus("已出貨後請由會計或主管改件數。", true);
    if (
      o.status === "shipped" &&
      !confirm(`「${o.customer}」已出貨扣庫。送出修改會標「已改單」，並依新件數重算庫存，不必再按出貨扣庫。`)
    )
      return;
    editing = o.id;
    document.getElementById("edit-id").value = o.id;
    page = "orders";
    ordersPane = "form";
    document.getElementById("customer").value = o.customer;
    setShipAddr(o.shipAddr || lastShipAddr(o.customer));
    setOrderNote(o.remark || "");
    syncOrderDates(o.shipDate || today());
    const more = document.getElementById("ship-more");
    if (more && (o.shipDate || today()) !== today()) more.open = true;
    const fallbackDest = destFromRemembered(o.shipAddr || lastShipAddr(o.customer));
    ticketLines = (o.lines || [])
      .filter((l) => l.qty > 0)
      .map((l) => {
        const copy = { ...l };
        if (!String(copy.dest || "").trim() && fallbackDest) copy.dest = fallbackDest;
        return copy;
      });
    document.getElementById("cancel-edit").hidden = false;
    render();
    renderCheck();
    return;
  }
  if (btn.dataset.act === "ship") {
    if (!requireStaff()) return;
    try {
      const need = {};
      for (const line of o.lines) {
        if (!(line.qty > 0) || !line.skuId) continue;
        need[line.skuId] = (need[line.skuId] || 0) + line.qty;
      }
      for (const [skuId, qty] of Object.entries(need)) {
        const sku = skuById(skuId);
        if (!sku) continue;
        ensureStockRow(sku.id);
        if (isSiteSku(sku) || isTradeSku(sku)) continue;
        if (available(sku, o, today()) < qty) {
          setStatus(`${sku.name} 可出不足，不能出貨。請先在庫存頁記入進貨或早上盤點。`, true);
          return;
        }
      }
      const autoIn = [];
      for (const [skuId, qty] of Object.entries(need)) {
        const sku = skuById(skuId);
        if (!sku) continue;
        if (shipInboundSku(sku) === "auto") autoIn.push({ skuId, qty, sku });
      }
      if (autoIn.length) {
        const bits = autoIn.map((x) => `${x.sku.name.replace("洋蔥／", "").replace("散賣kg", "").replace("散賣斤", "")} ${fmt(x.qty)} ${x.sku.unit}`).join("、");
        if (!confirm(`確定出貨「${o.customer}」？\n將扣可出，並把出貨數量累計入今日進貨：${bits}`)) return;
      }
      const shipInbounds = [];
      for (const [skuId, qty] of Object.entries(need)) {
        const sku = skuById(skuId);
        if (!sku) continue;
        if (isSiteSku(sku)) {
          const st = ensureStockRow(sku.id);
          st.processed = round(Math.max(0, (st.processed || 0) - qty));
        }
      }
      o.status = "shipped";
      o.shippedOn = today();
      o.shippedBy = currentStaff();
      const inLots = autoIn;
      for (const lot of inLots) {
        addInboundLot(lot.skuId, lot.qty, o.shippedOn, true);
        shipInbounds.push({ skuId: lot.skuId, qty: lot.qty });
      }
      o.shipInbounds = shipInbounds;
      for (const skuId of Object.keys(need)) {
        const sku = skuById(skuId);
        if (sku && !isSiteSku(sku)) syncNqQty(sku);
      }
      save();
      const inNote = shipInbounds.length
        ? `並已累計入今日進貨 ${shipInbounds.map((x) => `${fmt(x.qty)}`).join("、")}。`
        : "";
      setStatus(`已出貨並扣可出庫存。${inNote}`, false);
      render();
    } catch (err) {
      console.error(err);
      setStatus("出貨扣庫失敗，請再按一次。", true);
    }
  }
};

document.getElementById("receive").onsubmit = (e) => {
  e.preventDefault();
  const id = document.getElementById("in-sku").value;
  const n = Number(document.getElementById("in-qty").value);
  if (!(n > 0)) return setStatus("進貨數量必須大於 0", true);
  state.stock[id].qty = round(state.stock[id].qty + n);
  save();
  document.getElementById("in-qty").value = "";
  setStatus("已進貨，現場庫存已增加。", false);
  render();
};

document.getElementById("process").onsubmit = (e) => {
  e.preventDefault();
  const id = document.getElementById("pr-sku").value;
  const n = Number(document.getElementById("pr-qty").value);
  const row = state.stock[id];
  if (!(n > 0)) return setStatus("加工數量必須大於 0", true);
  if (n > row.qty) return setStatus("原料不足。", true);
  row.qty = round(row.qty - n);
  row.processed = round(row.processed + n);
  save();
  document.getElementById("pr-qty").value = "";
  setStatus("已記入加工，可出量增加。", false);
  render();
};

function patchStockRow(skuId) {
  const sku = skuById(skuId);
  if (!sku) return;
  const date = stockViewDay();
  const b = bookRow(skuId, date);
  const oh = onHand(sku, date);
  const rsv = reservedAll(skuId, date);
  const av = available(sku, undefined, date);
  const shipped = shippedQty(skuId, date);
  const ohEl = document.querySelector(`[data-oh="${skuId}"]`);
  if (ohEl) ohEl.textContent = `${fmt(oh)} ${sku.unit}`;
  const meta = document.querySelector(`[data-meta="${skuId}"]`);
  if (meta) {
    meta.textContent = `已出 ${fmt(shipped)} ／ 已佔 ${fmt(rsv)} ／ 可出 ${fmt(av)} ${sku.unit}${b.count != null ? " ／ 已盤點" : ""}`;
    meta.classList.toggle("counted", b.count != null);
  }
  const countEl = document.querySelector(`[data-count="${skuId}"]`);
  if (countEl) countEl.placeholder = fmt(oh);
}
function applyBookField(skuId, field, raw) {
  const sku = skuById(skuId);
  const b = bookRow(skuId, stockViewDay());
  if (field === "count") {
    b.count = raw === "" || raw == null ? null : Math.max(0, Number(raw) || 0);
  } else {
    b[field] = raw === "" || raw == null ? 0 : Math.max(0, Number(raw) || 0);
    syncNqQty(sku);
  }
  save();
  patchStockRow(skuId);
}
function bumpInbound(skuId, delta) {
  const b = bookRow(skuId, stockViewDay());
  b.inbound = round(Math.max(0, (b.inbound || 0) + Number(delta)));
  const input = document.querySelector(`[data-inbound="${skuId}"]`);
  if (input) input.value = b.inbound;
  syncNqQty(skuById(skuId));
  save();
  patchStockRow(skuId);
}
function confirmMorningCount(skuId, raw, quiet) {
  const sku = skuById(skuId);
  if (!sku) return;
  if (raw === "" || raw == null) return setStatus("請填早上庫存盤點數量後再確認。", true);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return setStatus("早上盤點請填 0 或正數。", true);
  const b = bookRow(skuId, stockViewDay());
  if (b.morningConfirmed) return;
  const counted = round(n);
  const carried = b.morningCarried != null && b.morningCarried !== "" ? round(Number(b.morningCarried)) : null;
  stripAutoMorningInbound(b);
  b.morning = counted;
  b.opening = counted;
  b.morningEdited = carried != null && counted !== carried;
  b.morningConfirmed = true;
  syncNqQty(sku);
  save();
  const mark = document.querySelector(`[data-morning-ok="${skuId}"]`);
  if (mark) mark.textContent = "已確認";
  const input = document.querySelector(`[data-morning="${skuId}"]`);
  if (input) {
    input.value = b.morning;
    input.readOnly = true;
  }
  if (quiet) return;
  const label = NQ_INBOUND.find((r) => r.id === skuId)?.label || sku.name;
  setStatus(`已確認「${label}」早上盤點 ${fmt(b.morning)} ${sku.unit}。進貨請切到上方「進貨」頁記入。`, false);
  renderStock();
  renderCheck();
  renderAlerts();
}
function addMorningAvail(skuId, raw) {
  const sku = skuById(skuId);
  if (!isSiteSku(sku)) return;
  const n = Number(raw);
  if (!(n > 0)) return setStatus("加入數量必須大於 0", true);
  const b = bookRow(skuId, stockViewDay());
  b.morning = round((Number(b.morning) || 0) + n);
  state.stock[skuId].processed = round((state.stock[skuId].processed || 0) + n);
  const input = document.querySelector(`[data-morning-add="${skuId}"]`);
  if (input) input.value = "";
  save();
  setStatus(`已把早上盤點 ${fmt(n)} ${sku.unit} 加入可出貨。`, false);
  renderStock();
  renderCheck();
  renderAlerts();
}

function bindStockFillPage(el) {
  if (!el || el.dataset.boundFill) return;
  el.dataset.boundFill = "1";
  el.addEventListener("change", (e) => {
    const input = e.target.closest("[data-safety]");
    if (!input) return;
    const n = Number(input.value);
    state.stock[input.dataset.safety].safety = n >= 0 ? n : 0;
    save();
    renderCheck();
    renderAlerts();
    setStatus("已更新安全庫存。", false);
  });
  el.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.morning != null) {
      const b = bookRow(t.dataset.morning, stockViewDay());
      if (b.morningConfirmed) return;
      b.morning = t.value === "" ? "" : Math.max(0, Number(t.value) || 0);
      save();
      refreshStockOverview();
      return;
    }
    if (t.dataset.settle != null) {
      const b = bookRow(t.dataset.settle, stockViewDay());
      if (b.countConfirmed) return;
      b.count = t.value === "" ? null : Math.max(0, Number(t.value) || 0);
      save();
      return;
    }
    if (t.dataset.opening != null) applyBookField(t.dataset.opening, "opening", t.value);
    else if (t.dataset.count != null) applyBookField(t.dataset.count, "count", t.value);
  });
  el.addEventListener("click", (e) => {
    const bump = e.target.closest("[data-qty-step]");
    if (bump) {
      e.preventDefault();
      const input = bump.closest(".stepper")?.querySelector("input");
      if (!input || input.readOnly || input.disabled) return;
      const step = Number(input.step) || 1;
      const delta = Number(bump.dataset.qtyStep) * step;
      const cur = input.value === "" ? 0 : Number(input.value);
      input.value = String(round(Math.max(0, (Number.isFinite(cur) ? cur : 0) + delta)));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    const addIn = e.target.closest("[data-add-inbound]");
    if (addIn) {
      const id = addIn.dataset.addInbound;
      const input = document.querySelector(`[data-inbound="${id}"]`);
      addInboundLot(id, input?.value);
      return;
    }
    const fixIn = e.target.closest("[data-fix-inbound]");
    if (fixIn) {
      const id = fixIn.dataset.fixInbound;
      const input = document.querySelector(`[data-inbound-fix="${id}"]`) || document.querySelector(`[data-inbound="${id}"]`);
      const label = NQ_INBOUND.find((r) => r.id === id)?.label || id;
      if (!confirm(`將「${label}」今日進貨改為輸入框的數字？`)) return;
      correctInbound(id, input?.value);
      return;
    }
    const fixOne = e.target.closest("[data-fix-morning]");
    if (fixOne) {
      unlockMorning(fixOne.dataset.fixMorning);
      setStatus("已解開此品項早上盤點，先前因盤點自動記入的進貨已拿掉。改完請再按確認盤點。", false);
      renderStock();
      return;
    }
    const morningBtn = e.target.closest("[data-confirm-morning]");
    if (morningBtn) {
      const id = morningBtn.dataset.confirmMorning;
      const input = document.querySelector(`[data-morning="${id}"]`);
      confirmMorningCount(id, input?.value);
      return;
    }
    const addM = e.target.closest("[data-add-morning]");
    if (addM) {
      const input = document.querySelector(`[data-morning-add="${addM.dataset.addMorning}"]`);
      addMorningAvail(addM.dataset.addMorning, input?.value);
      return;
    }
    const settleBtn = e.target.closest("[data-confirm-settle]");
    if (settleBtn) {
      const id = settleBtn.dataset.confirmSettle;
      const input = document.querySelector(`[data-settle="${id}"]`);
      confirmSettle(id, input?.value);
      return;
    }
    const fixSettle = e.target.closest("[data-fix-settle]");
    if (fixSettle) {
      unlockSettle(fixSettle.dataset.fixSettle);
      setStatus("已解開庫存結算，改完請再按確認。", false);
      renderStock();
    }
  });
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const inbound = e.target.closest("[data-inbound]");
    if (inbound) {
      e.preventDefault();
      addInboundLot(inbound.dataset.inbound, inbound.value);
      return;
    }
    const morning = e.target.closest("[data-morning]");
    if (morning) {
      e.preventDefault();
      return;
    }
    const settle = e.target.closest("[data-settle]");
    if (settle) {
      e.preventDefault();
      confirmSettle(settle.dataset.settle, settle.value);
      return;
    }
    const addIn = e.target.closest("[data-morning-add]");
    if (!addIn) return;
    e.preventDefault();
    addMorningAvail(addIn.dataset.morningAdd, addIn.value);
  });
}
bindStockFillPage(document.getElementById("page-stock"));
bindStockFillPage(document.getElementById("page-in"));
document.getElementById("fill-count").onclick = () => {
  const rows = nqStockFillRows();
  const missing = [];
  for (const row of rows) {
    const input = document.querySelector(`[data-morning="${row.id}"]`);
    const raw = input ? input.value : bookRow(row.id, stockViewDay()).morning;
    if (raw === "" || raw == null) missing.push(row.label);
  }
  if (missing.length) return setStatus(`請先填完早上盤點：${missing.join("、")}`, true);
  for (const row of rows) {
    const input = document.querySelector(`[data-morning="${row.id}"]`);
    confirmMorningCount(row.id, input?.value, true);
  }
  setStatus(`已確認${nqStockGroup().label}早上盤點。另一類請再切換填。`, false);
  renderStock();
  renderCheck();
  renderAlerts();
};
document.getElementById("fix-morning").onclick = unlockAllMorning;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  pollCloud();
  if (ensureTodayBooks()) {
    syncAllNqQty();
    save();
    render();
  }
});

function bookRowHasData(row) {
  if (!row || typeof row !== "object") return false;
  if (Number(row.inbound) > 0 || Number(row.morning) > 0) return true;
  if (row.count != null && row.count !== "") return true;
  if (row.morningConfirmed || row.countConfirmed) return true;
  if (Array.isArray(row.lots) && row.lots.length) return true;
  if (Number(row.opening) > 0) return true;
  return false;
}
function dailyHasRealData(daily) {
  if (!daily || typeof daily !== "object") return false;
  for (const book of Object.values(daily)) {
    if (!book || typeof book !== "object") continue;
    for (const row of Object.values(book)) {
      if (bookRowHasData(row)) return true;
    }
  }
  return false;
}
function sheetHasData(sheet) {
  if (!sheet || typeof sheet !== "object") return false;
  for (const book of Object.values(sheet)) {
    if (!book || typeof book !== "object") continue;
    for (const [name, row] of Object.entries(book)) {
      if (name.startsWith("_") || !row || typeof row !== "object") continue;
      for (const [k, v] of Object.entries(row)) {
        if (k.startsWith("_")) continue;
        if (v === "" || v == null || v === false) continue;
        if (typeof v === "number" && v !== 0) return true;
        if (typeof v === "string" && v.trim()) return true;
        if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length) return true;
      }
    }
  }
  return false;
}
function stockHasData(stock) {
  if (!stock || typeof stock !== "object") return false;
  for (const row of Object.values(stock)) {
    if ((row?.qty || 0) || (row?.processed || 0) || (row?.safety || 0)) return true;
  }
  return false;
}
function bundleHasData(b) {
  if (!b || typeof b !== "object") return false;
  if (Array.isArray(b.orders?.orders) && b.orders.orders.length) return true;
  if (Array.isArray(b.orders?.rests) && b.orders.rests.length) return true;
  if (dailyHasRealData(b.orders?.daily)) return true;
  if (sheetHasData(b.dailySheet)) return true;
  const nq = b.nqCustomers;
  if (nq && (nq.leaf?.length || nq.basil?.length || nq.herb?.length)) return true;
  if (Array.isArray(b.haCustomers) && b.haCustomers.length) return true;
  return stockHasData(b.orders?.stock);
}
function localHasData() {
  if (state.orders.length) return true;
  if ((state.rests || []).length) return true;
  if (dailyHasRealData(state.daily)) return true;
  try {
    if (sheetHasData(JSON.parse(localStorage.getItem(DAILY_KEY) || "{}"))) return true;
  } catch (_) {}
  const nq = loadNqLists();
  if (nq.leaf.length || nq.basil.length || nq.herb.length) return true;
  if (loadHaCustomers().length) return true;
  if (loadStaffList().length) return true;
  return stockHasData(state.stock);
}
function collectBundle() {
  return {
    updatedAt: Date.now(),
    orders: { stock: state.stock, orders: state.orders, daily: state.daily || {}, rests: state.rests || [] },
    nqCustomers: loadNqLists(),
    haCustomers: loadHaCustomers(),
    accountants: loadStaffList(),
    dailySheet: dailyStore(),
  };
}
function applyBundle(b) {
  skipCloud = true;
  let carried = false;
  try {
    if (b.orders && b.orders.stock && Array.isArray(b.orders.orders)) {
      state.stock = b.orders.stock;
      state.orders = b.orders.orders;
      state.daily = b.orders.daily || {};
      state.rests = Array.isArray(b.orders.rests) ? b.orders.rests : state.rests || [];
      for (const sku of SKUS) {
        if (!state.stock[sku.id]) state.stock[sku.id] = { qty: 0, processed: 0, safety: 0 };
      }
      if (!state.daily) state.daily = {};
      carried = ensureBooks(today());
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch (_) {}
    }
    if (b.nqCustomers && typeof b.nqCustomers === "object") {
      localStorage.setItem(
        NQ_CUST_KEY,
        JSON.stringify({
          leaf: asNameList(b.nqCustomers.leaf),
          basil: asNameList(b.nqCustomers.basil),
          herb: asNameList(b.nqCustomers.herb),
        }),
      );
    }
    if (Array.isArray(b.haCustomers)) {
      localStorage.setItem(HA_CUST_KEY, JSON.stringify(asNameList(b.haCustomers)));
    }
    if (Array.isArray(b.accountants)) {
      localStorage.setItem(STAFF_LIST_KEY, JSON.stringify(asNameList(b.accountants)));
    }
    if (b.dailySheet && typeof b.dailySheet === "object") {
      localStorage.setItem(DAILY_KEY, JSON.stringify(b.dailySheet));
    }
    writeSyncAt(Number(b.updatedAt) || Date.now());
    syncAllNqQty();
  } finally {
    skipCloud = false;
  }
}
async function pullCloud() {
  const r = await fetch(CLOUD_URL, { cache: "no-store", headers: { Accept: "application/json" } });
  const type = r.headers.get("content-type") || "";
  if (!r.ok || !type.includes("json")) throw new Error("no-cloud");
  const data = await r.json();
  if (!data || typeof data !== "object") throw new Error("bad");
  return data;
}
async function pushCloud(force) {
  if (skipCloud && !force) return false;
  if (!localHasData()) return false;
  const bundle = collectBundle();
  const body = JSON.stringify(bundle);
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  let r = await fetch(CLOUD_URL, { method: "POST", cache: "no-store", headers, body });
  if (!r.ok) r = await fetch(CLOUD_URL, { method: "PUT", cache: "no-store", headers, body });
  const type = r.headers.get("content-type") || "";
  if (!r.ok || !type.includes("json")) throw new Error("no-cloud");
  writeSyncAt(bundle.updatedAt);
  return true;
}
async function healCloudSync() {
  try {
    const remote = await pullCloud();
    skipCloud = false;
    const remoteAt = Number(remote.updatedAt) || 0;
    const localAt = readSyncAt();
    const remoteOk = bundleHasData(remote);
    const localOk = localHasData();
    if (localOk && !remoteOk) {
      await pushCloud(true);
      setSyncNote("已把本機填寫傳到共用。手機重新整理即可看到同一份。");
    } else if (remoteOk && (!localOk || remoteAt > localAt)) {
      applyBundle(remote);
      render();
      setSyncNote("已從共用載入資料。");
    } else if (localOk && remoteOk && localAt > remoteAt) {
      await pushCloud(true);
      setSyncNote("已把較新的本機資料補傳到共用。");
    } else {
      setSyncNote("電腦與手機共用同一份資料。");
    }
    cloudReady = true;
    return true;
  } catch (err) {
    cloudReady = false;
    skipCloud = false;
    setSyncNote("同步暫時失敗，會自動再試。");
    console.error(err);
    return false;
  }
}
async function bootCloudSync() {
  await healCloudSync();
}
async function pollCloud() {
  await healCloudSync();
}

ensureHaHistory();
bindWorkDates();
render();
bootCloudSync();
refreshLineDrafts();
setInterval(healCloudSync, 8000);
setInterval(refreshLineDrafts, 8000);
