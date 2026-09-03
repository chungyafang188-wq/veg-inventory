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
    hint: "地瓜葉分誌／芳填當天叫貨。無叫貨請填「休」，會列入當日清單，表示已確認該客戶叫貨狀態。裝箱預設籃裝。出貨對象預設小琳、欣儒，其他可自行新增。件數直接打數字，↑↓←→ 換格。",
    formHint: "填地瓜葉／誌與地瓜葉／芳數量。裝箱預設籃裝。",
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
    hint: "無叫貨請填「休」，會列入當日清單，表示已確認該客戶叫貨狀態。",
    formHint: "紅骨／綠骨／廠商／備註。無叫貨填「休」。",
    skuIds: ["rb-fang", "rb-lin", "rb-oth", "gb-fang", "gb-lin", "gb-oth"],
    cols: [
      { key: "rb", label: "紅骨", kind: "qty" },
      { key: "gb", label: "綠骨", kind: "qty" },
      { key: "vendor", label: "廠商", kind: "vendor" },
      { key: "note", label: "備註", kind: "note" },
    ],
  },
  herb: {
    label: "散賣品項",
    title: "穠全 散賣出貨",
    formTitle: "填寫散賣數量",
    hint: "散賣填薄荷、紫蘇、九層塔（kg）。出貨對象預設小琳、欣儒，其他可自行新增；與地瓜葉／九層塔名單分開。確認輸入訂單後佔量並列排程。",
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
  { id: "on-nz-20", co: "ha", name: "洋蔥／紐西蘭／20K", unit: "袋", onion: true, site: true },
  { id: "on-nz-12", co: "ha", name: "洋蔥／紐西蘭／12K", unit: "袋", onion: true, site: true },
  { id: "on-au-20", co: "ha", name: "洋蔥／澳洲／20K", unit: "袋", onion: true, site: true },
  { id: "on-au-12", co: "ha", name: "洋蔥／澳洲／12K", unit: "袋", onion: true, site: true },
  { id: "on-kr-20", co: "ha", name: "洋蔥／韓國／20K", unit: "袋", onion: true, site: true },
  { id: "on-kr-12", co: "ha", name: "洋蔥／韓國／12K", unit: "袋", onion: true, site: true },
  { id: "on-vn-20", co: "ha", name: "洋蔥／越南／20K", unit: "袋", onion: true, site: true },
  { id: "on-vn-12", co: "ha", name: "洋蔥／越南／12K", unit: "袋", onion: true, site: true },
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
  if (el) el.textContent = text || "";
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
function fillMorningFromPrevSettle(row, skuId, date) {
  const carried = prevSettleQty(skuId, date);
  if (carried == null) return false;
  let changed = false;
  if (row.opening == null) {
    row.opening = carried;
    changed = true;
  }
  const sku = skuById(skuId);
  if (sku && isSiteSku(sku)) return changed;
  if ((row.morning == null || row.morning === "") && !row.morningConfirmed) {
    row.morning = carried;
    changed = true;
  }
  return changed;
}
function seedOpening(skuId, date) {
  const yest = addDays(date, -1);
  const yRow = state.daily?.[yest]?.[skuId];
  if (yRow) {
    if (yRow.count != null && yRow.count !== "") return round(Number(yRow.count));
    return round((yRow.opening || 0) + (yRow.inbound || 0) - shippedQty(skuId, yest));
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
  }
  return changed;
}
function ensureTodayBooks() {
  return ensureBooks(today());
}
function bookRow(skuId, date = today()) {
  ensureBooks(date);
  const book = bookOf(date);
  if (!book[skuId]) book[skuId] = { opening: seedOpening(skuId, date), inbound: 0, count: null };
  return book[skuId];
}
function onHand(sku, date = today()) {
  if (!sku) return 0;
  if (isSiteSku(sku)) return ensureStockRow(sku.id).processed;
  const b = bookRow(sku.id, date);
  return round((b.opening || 0) + (b.inbound || 0) - shippedQty(sku.id, date));
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
syncAllNqQty();
if (migrated || seeded) save();

let co = "ha";
let page = "orders";
let formKind = "leaf";
let editing = "";
let planDay = today();
let stockDay = today();
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
      renderStock();
    });
  }
}

function skuById(id) {
  return SKUS.find((s) => s.id === id);
}
function isSiteSku(sku) {
  return !!(sku && (sku.site || sku.onion));
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
    .filter((o) => o.co === co && o.status === "open")
    .slice()
    .sort((a, b) => orderRank(a) - orderRank(b) || a.no - b.no);
}
function nextPrio() {
  const list = state.orders.filter((o) => o.co === co);
  let m = 0;
  for (const o of list) m = Math.max(m, orderRank(o));
  return m + 1;
}
function orderFormKind(o) {
  const id = o.lines?.[0]?.skuId;
  return id ? formKindOfSku(id) : "leaf";
}
function visibleOpenQueue() {
  let list = openQueue();
  if (co === "nq") list = list.filter((o) => orderFormKind(o) === formKind);
  const day = ordersViewDay();
  list = list.filter((o) => (o.shipDate || today()) === day);
  return list;
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
function reservedAhead(skuId, current) {
  let n = 0;
  const curRank = current ? orderRank(current) : Infinity;
  for (const o of state.orders) {
    if (o.co !== co || o.status !== "open") continue;
    if (current) {
      if (o.id === current.id) continue;
      if (orderRank(o) >= curRank) continue;
    }
    for (const line of o.lines) if (line.skuId === skuId) n += line.qty;
  }
  return n;
}
function reservedAll(skuId) {
  return reservedAhead(skuId);
}
function available(sku, current) {
  return round(ready(sku) - reservedAhead(sku.id, current));
}
function lineLabel(l, withUnit) {
  const s = skuById(l.skuId);
  const name = s ? s.name : l.skuId;
  const unit = s && withUnit ? ` ${s.unit}` : "";
  const pack = l.pack ? `（${l.pack}）` : "";
  const note = l.note ? `（${l.note}）` : "";
  const pallet = l.pallet ? "（疊棧板）" : "";
  return `${name} ${fmt(l.qty)}${unit}${pack}${note}${pallet}`;
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
  for (const sku of companySkus()) {
    const need = qtyMap[sku.id] || 0;
    if (!(need > 0)) continue;
    const av = available(sku, current);
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
const HA_PK_VARS = ["密本", "阿成"];
const HA_PK_SPECS = ["18K", "20K"];
const HA_ORIGIN_CODE = { 紐西蘭: "nz", 澳洲: "au", 韓國: "kr", 越南: "vn" };
const HA_PK_CODE = { 密本: "mi", 阿成: "ch" };
function optsHtml(list, selected) {
  return list.map((v) => `<option value="${esc(v)}"${v === selected ? " selected" : ""}>${esc(v)}</option>`).join("");
}
function haOnionSku(origin, spec) {
  const o = HA_ORIGIN_CODE[origin] || "nz";
  const s = spec === "12K" ? "12" : "20";
  return `on-${o}-${s}`;
}
function haPkSku(kind, spec) {
  const k = HA_PK_CODE[kind] || "mi";
  const s = spec === "20K" ? "20" : "18";
  return `pk-${k}-${s}`;
}
function haParseSku(id) {
  if (id === "on-b-kg") return { kind: "on-b" };
  if (id === "pk-b-kg") return { kind: "pk-b" };
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
  if (kind === "on") return "袋";
  return "kg";
}
function haExtrasHtml(kind, rec = {}) {
  if (kind === "on") {
    return `<select data-ha-origin aria-label="產地">${optsHtml(HA_ONION_ORIGINS, rec.origin || "紐西蘭")}</select>
      <select data-ha-spec aria-label="規格">${optsHtml(HA_ONION_SPECS, rec.spec || "20K")}</select>`;
  }
  if (kind === "pk") {
    return `<select data-ha-var aria-label="品種">${optsHtml(HA_PK_VARS, rec.variety || "密本")}</select>
      <select data-ha-spec aria-label="規格">${optsHtml(HA_PK_SPECS, rec.spec || "18K")}</select>`;
  }
  return "";
}
function haLineHtml(rec = {}) {
  const parsed = rec.skuId ? haParseSku(rec.skuId) : { kind: rec.kind || "on", origin: "紐西蘭", spec: "20K", variety: "密本" };
  const kind = parsed.kind || "on";
  const qty = rec.qty > 0 ? rec.qty : "";
  const kinds = [
    ["on", "洋蔥"],
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
  document.querySelectorAll("#ha-lines .ha-line").forEach((row) => {
    const kind = row.querySelector("[data-ha-kind]")?.value || "on";
    const qty = Number(row.querySelector("[data-ha-qty]")?.value);
    if (!(qty > 0)) return;
    let skuId = "on-nz-20";
    if (kind === "on-b") skuId = "on-b-kg";
    else if (kind === "pk-b") skuId = "pk-b-kg";
    else if (kind === "on") {
      skuId = haOnionSku(row.querySelector("[data-ha-origin]")?.value, row.querySelector("[data-ha-spec]")?.value);
    } else {
      skuId = haPkSku(row.querySelector("[data-ha-var]")?.value, row.querySelector("[data-ha-spec]")?.value);
    }
    const line = { skuId, qty: round(qty) };
    if (row.querySelector("[data-ha-pallet]")?.checked) line.pallet = true;
    out.push(line);
  });
  return out;
}

function renderSheet() {
  const current = currentRecord();
  const leaf = co === "nq" && formKind === "leaf";
  if (co === "ha") {
    renderHaSheet(current?.lines);
    return;
  }
  const html = formSkus()
    .map((sku) => {
      const av = available(sku, current);
      return `<tr><td class="name-cell">${esc(sku.name)}</td><td>${fmt(av)} ${sku.unit}</td>
        <td><input class="qty" data-sku="${sku.id}" type="number" min="0" step="${skuStep(sku)}" /></td></tr>`;
    })
    .join("");
  const pack = leaf
    ? `<label class="field">裝箱樣式（籃裝／箱裝，僅備註，同一庫存）
        <select id="leaf-pack">
          ${PACK_OPTS.map((p) => `<option value="${p}"${p === "籃裝" ? " selected" : ""}>${p}</option>`).join("")}
        </select>
      </label>`
    : "";
  document.getElementById("sheet").innerHTML =
    `<table><thead><tr><th>品項（不混貨）</th><th>可出</th><th>數量</th></tr></thead><tbody>${html}</tbody></table>${pack}`;
}

function qtyMapFromForm() {
  const map = {};
  if (co === "ha") {
    for (const l of haLinesFromForm()) map[l.skuId] = round((map[l.skuId] || 0) + l.qty);
    return map;
  }
  document.querySelectorAll("#sheet [data-sku]").forEach((input) => {
    const n = Number(input.value);
    if (n > 0) map[input.dataset.sku] = n;
  });
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
  if (co === "ha") return haLinesFromForm();
  const qty = qtyMapFromForm();
  const packs = packMapFromForm();
  return Object.entries(qty).map(([skuId, n]) => {
    const line = { skuId, qty: n };
    const sku = skuById(skuId);
    if (sku?.packRemark) line.pack = packs[skuId] || "籃裝";
    return line;
  });
}
function missingPack(lines) {
  return lines.some((l) => skuById(l.skuId)?.packRemark && !l.pack);
}
function qtyN(v) {
  const n = Number(v);
  return n > 0 ? n : 0;
}
function formAllowsRest() {
  return co === "nq" && (formKind === "leaf" || formKind === "basil");
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
function restKeyMatch(r, name, date, kind = formKind) {
  return r.co === "nq" && r.formKind === kind && r.customer === name && r.date === date;
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
  return document.getElementById("daily-sheet-date")?.value || today();
}
function ordersViewDay() {
  if (co === "nq") return sheetDate();
  return document.getElementById("ship-date")?.value || today();
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
  if (row?.vendors && typeof row.vendors === "object") {
    return VENDOR_OPTS.find((k) => row.vendors[k]) || "芳";
  }
  if (row?.rbVendor && VENDOR_OPTS.includes(row.rbVendor)) return row.rbVendor;
  if (row?.gbVendor && VENDOR_OPTS.includes(row.gbVendor)) return row.gbVendor;
  return "芳";
}
function migrateBasilDailyRow(row) {
  if (!row || row._basil3) return row;
  const rb =
    qtyN(row.rb) + qtyN(row.rbFang) + qtyN(row.rbOth) + qtyN(row.rbLin);
  const gb =
    qtyN(row.gb) + qtyN(row.gbFang) + qtyN(row.gbOth) + qtyN(row.gbLin);
  if (!row.note) {
    const bits = [row.rbOthNote, row.gbOthNote].filter(Boolean);
    if (bits.length) row.note = bits.join("、");
  }
  if (rb) row.rb = rb;
  if (gb) row.gb = gb;
  if (!row.vendor) row.vendor = rowVendor(row);
  row._basil3 = true;
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
    const vendor = rowVendor(row);
    const note = String(row.note || "").trim();
    if (r) {
      const line = { skuId: BASIL_SKU.rb[vendor], qty: r };
      if (note) line.note = note;
      lines.push(line);
    }
    if (g) {
      const line = { skuId: BASIL_SKU.gb[vendor], qty: g };
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
      row.vendor = b.val;
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
  addOpenOrderFor(co, customer, shipDate, lines);
}
function addOpenOrderFor(company, customer, shipDate, lines) {
  const nos = state.orders.filter((o) => o.co === company).map((o) => o.no);
  const list = state.orders.filter((o) => o.co === company);
  let m = 0;
  for (const o of list) m = Math.max(m, orderRank(o));
  state.orders.unshift({
    id: uid(),
    co: company,
    no: (nos.length ? Math.max(...nos) : 0) + 1,
    customer,
    shipDate,
    lines,
    status: "open",
    prio: m + 1,
    edited: false,
  });
}
function commitStatus(worst) {
  if (worst === "bad") setStatus("有品項不夠，仍已佔量列入排程，請看紅字。", true);
  else if (worst === "warn") setStatus("已確認列入排程，但有品項將低於安全庫存。", false);
  else setStatus("已確認並列入排程（已佔量，尚未扣庫）。", false);
}
function confirmNqSchedule() {
  const { date, entries, errors, rests } = collectNqEntries();
  if (errors.length) return setStatus(errors[0], true);
  if (editing) {
    if (!entries.length) return setStatus("請填數量後再確認。", true);
    const o = state.orders.find((x) => x.id === editing);
    o.customer = entries[0].customer;
    o.shipDate = date;
    o.lines = entries[0].lines;
    o.edited = true;
    o.status = "open";
    editing = "";
    document.getElementById("edit-id").value = "";
    removeRest(entries[0].customer, date);
    clearDailyRows(entries.map((e) => e.customer), date);
    save();
    commitStatus("ok");
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
  for (const e of entries) addOpenOrder(e.customer, date, e.lines);
  clearDailyRows(entries.map((e) => e.customer), date);
  save();
  commitStatus(worst);
  render();
}

function renderCheck() {
  if (co === "nq") {
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

function renderOrders() {
  const box = document.getElementById("orders");
  let list = state.orders.filter((o) => o.co === co);
  if (co === "nq") list = list.filter((o) => orderFormKind(o) === formKind);
  const day = ordersViewDay();
  list = list.filter((o) => (o.shipDate || today()) === day);
  if (!list.length) {
    const kind = co === "nq" ? FORM_KINDS[formKind]?.label || "本表" : "";
    box.innerHTML = `<p class="empty">${
      kind ? `${day}「${kind}」尚無已填紀錄。` : `${day} 尚無已填紀錄。`
    }</p>`;
    return;
  }
  const rank = {};
  visibleOpenQueue().forEach((o, i) => {
    rank[o.id] = i + 1;
  });
  const openN = Object.keys(rank).length;
  const stRank = { open: 0, shipped: 1, cancelled: 2 };
  list = list.slice().sort((a, b) => {
    const sa = stRank[a.status] ?? 9;
    const sb = stRank[b.status] ?? 9;
    if (sa !== sb) return sa - sb;
    if (a.status === "open") return (rank[a.id] || 0) - (rank[b.id] || 0) || a.no - b.no;
    return b.no - a.no;
  });
  box.innerHTML = `<div class="order-cards">${list
    .map((o) => {
      const cls = ["order-card", o.status === "cancelled" ? "cancelled" : "", o.status === "shipped" ? "shipped" : "", o.status === "open" ? "pending" : ""]
        .filter(Boolean)
        .join(" ");
      const tag = o.edited ? '<span class="tag">改</span>' : "";
      const st = o.status === "shipped" ? "已出貨" : o.status === "cancelled" ? "已取消" : "待出貨";
      const lines = o.lines
        .filter((l) => l.qty)
        .map((l) => `<span class="order-chip">${esc(lineLabel(l, true))}</span>`)
        .join("");
      const bits = [];
      if (o.status === "open") {
        bits.push(`<button type="button" class="primary" data-act="ship" data-id="${o.id}">出貨扣庫</button>`);
        bits.push(`<button type="button" data-act="edit" data-id="${o.id}">修改</button>`);
        if (co === "nq") bits.push(`<button type="button" data-act="cancel" data-id="${o.id}">取消</button>`);
      }
      if (co === "ha") bits.push(`<button type="button" data-act="delete" data-id="${o.id}">刪除紀錄</button>`);
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
            <strong class="order-who">${tag}${esc(o.customer)}</strong>
            <span class="order-st st-${esc(o.status)}">${esc(st)}</span>
          </div>
          <p class="order-meta">出貨日 ${esc(o.shipDate)}　單號 #${esc(o.no)}</p>
          <div class="order-chips">${lines}</div>
          ${acts}
        </div>
      </article>`;
    })
    .join("")}</div>`;
}

function renderRestList() {
  const box = document.getElementById("rest-list");
  if (!box) return;
  if (!formAllowsRest()) {
    box.innerHTML = "";
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const date = sheetDate();
  const kindLabel = FORM_KINDS[formKind]?.label || "";
  const rows = (state.rests || [])
    .filter((r) => restKeyMatch(r, r.customer, date, formKind))
    .slice()
    .sort((a, b) => a.customer.localeCompare(b.customer, "zh-Hant"));
  if (!rows.length) {
    box.innerHTML = `<div class="rest-box"><h3>無叫貨（休）· ${esc(kindLabel)}</h3><p class="empty">數量欄填「休」即列入，表示已確認當日不叫貨。</p></div>`;
    return;
  }
  box.innerHTML = `<div class="rest-box"><h3>無叫貨（休）· ${esc(kindLabel)} ${esc(date)}</h3>
    <p class="hint">已確認當日叫貨狀態（無叫貨）。</p>
    <ul class="rest-list">${rows
      .map(
        (r) =>
          `<li><span class="tag">休</span><strong>${esc(r.customer)}</strong><button type="button" class="tiny-btn" data-unrest="${esc(r.customer)}" aria-label="取消 ${esc(r.customer)} 的休">取消</button></li>`,
      )
      .join("")}</ul></div>`;
}

function skuShortName(sku) {
  return (sku?.name || "").replace("本產蔬菜－", "");
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
function planGroups() {
  if (co === "ha") {
    return companySkus().map((sku, i) => ({
      key: sku.id,
      label: skuShortName(sku),
      unit: sku.unit,
      skuIds: [sku.id],
      tone: `t${i % 6}`,
    }));
  }
  return [
    { key: "sl-zhi", label: "地瓜葉／誌", unit: "籃", skuIds: ["sl-zhi"], tone: "leaf-zhi" },
    { key: "sl-fang", label: "地瓜葉／芳", unit: "籃", skuIds: ["sl-fang"], tone: "leaf-fang" },
    { key: "rb", label: "九層塔／紅骨", unit: "箱", skuIds: ["rb-fang", "rb-lin", "rb-oth"], tone: "rb" },
    { key: "gb", label: "九層塔／綠骨", unit: "箱", skuIds: ["gb-fang", "gb-lin", "gb-oth"], tone: "gb" },
    { key: "mint-kg", label: "薄荷散賣", unit: "kg", skuIds: ["mint-kg"], tone: "mint" },
    { key: "shiso-kg", label: "紫蘇散賣", unit: "kg", skuIds: ["shiso-kg", "shiso-jin"], tone: "shiso" },
    { key: "basil-kg", label: "九層塔散賣", unit: "kg", skuIds: ["basil-kg"], tone: "herb" },
  ];
}
function planLineNote(o, skuIds) {
  const bits = [];
  for (const l of o.lines || []) {
    if (!skuIds.includes(l.skuId)) continue;
    const b = BASIL_REV[l.skuId];
    if (b) bits.push(b.val);
    if (l.pack) bits.push(l.pack);
    if (l.note) bits.push(l.note);
  }
  return [...new Set(bits.filter(Boolean))].join("　");
}
function groupLeftover(g) {
  let n = 0;
  for (const id of g.skuIds) {
    const sku = skuById(id);
    if (!sku) continue;
    n = round(n + available(sku));
  }
  return n;
}
function renderPlan() {
  const shortBox = document.getElementById("plan-short");
  const box = document.getElementById("plan");
  if (!box) return;
  const day = planViewDay();
  const planDateEl = document.getElementById("plan-date");
  if (planDateEl && planDateEl.value !== day) planDateEl.value = day;
  const orders = state.orders.filter((o) => o.co === co && o.status !== "cancelled");
  const groups = planGroups();
  const isDayShipped = (o) => o.status === "shipped" && (o.shippedOn || o.shipDate) === day;
  const isDayPending = (o) => o.status === "open" && (o.shipDate || today()) === day;
  const used = groups.filter((g) =>
    orders.some((o) => lineQtyForSkus(o, g.skuIds) > 0 && (isDayPending(o) || isDayShipped(o))),
  );
  const wrap = document.getElementById("plan-card") || shortBox?.parentElement;
  if (wrap) wrap.style.setProperty("--plan-n", String(Math.max(used.length, 1)));
  if (shortBox) {
    if (!used.length) {
      shortBox.innerHTML = '<p class="empty">還沒有出貨排程。</p>';
    } else {
      shortBox.innerHTML = `<div class="plan-board short-board">${used
        .map((g) => {
          const left = groupLeftover(g);
          const over = left < 0;
          return `<article class="short-card tone-${esc(g.tone)} ${over ? "no" : "ok"}">
            <h3>${esc(g.label)}</h3>
            <p class="short-est"><span>預估庫存</span><strong>${fmt(left)} ${esc(g.unit)}</strong></p>
            <p class="short-can">${over ? "已超接，不宜再接單" : "尚可接單"}</p>
          </article>`;
        })
        .join("")}</div>`;
    }
  }
  if (!used.length) {
    box.innerHTML = '<p class="empty">還沒有出貨排程。</p>';
    return;
  }
  const personList = (rows, unit, kind) => {
    if (!rows.length) return `<div class="plan-block ${kind}"><h4>${kind === "pending" ? "待出貨" : "當天已出貨"}</h4><p class="empty">無</p></div>`;
    return `<div class="plan-block ${kind}"><h4>${kind === "pending" ? "待出貨" : "當天已出貨"}</h4><ul class="list plan-people">${rows
      .map((r) => {
        const note = r.note ? `<span class="plan-note">${esc(r.note)}</span>` : "";
        return `<li><strong>${esc(r.customer)}</strong><span class="plan-qty">${fmt(r.qty)} ${esc(unit)}</span>${note}</li>`;
      })
      .join("")}</ul></div>`;
  };
  const addPlanRecs = (list, o, g, kind) => {
    const basil = g.skuIds.some((id) => BASIL_REV[id]);
    if (basil) {
      for (const id of g.skuIds) {
        const qty = lineQtyForSku(o, id);
        if (!qty) continue;
        const extra = [];
        for (const l of o.lines || []) {
          if (l.skuId !== id) continue;
          if (l.note) extra.push(l.note);
        }
        const note = [BASIL_REV[id]?.val, ...extra].filter(Boolean).join("　");
        list.push({ id: `${o.id}:${id}`, customer: o.customer, qty, note, prio: orderRank(o) });
      }
      return;
    }
    const qty = lineQtyForSkus(o, g.skuIds);
    if (!qty) return;
    list.push({
      id: o.id,
      customer: o.customer,
      qty,
      note: planLineNote(o, g.skuIds),
      prio: orderRank(o),
    });
  };
  const board = used
    .map((g) => {
      const pending = [];
      const shipped = [];
      for (const o of orders) {
        if (isDayPending(o)) addPlanRecs(pending, o, g);
        else if (isDayShipped(o)) addPlanRecs(shipped, o, g);
      }
      pending.sort((a, b) => (a.prio || 0) - (b.prio || 0) || a.customer.localeCompare(b.customer, "zh-Hant") || (a.note || "").localeCompare(b.note || "", "zh-Hant"));
      shipped.sort((a, b) => a.customer.localeCompare(b.customer, "zh-Hant") || (a.note || "").localeCompare(b.note || "", "zh-Hant"));
      const waitQty = round(pending.reduce((n, r) => n + r.qty, 0));
      const outQty = round(shipped.reduce((n, r) => n + r.qty, 0));
      const allQty = round(waitQty + outQty);
      const vendIds = g.skuIds.filter((id) => BASIL_REV[id]);
      const vendRows = vendIds.map((id) => {
        let wait = 0;
        let out = 0;
        for (const o of orders) {
          const n = lineQtyForSku(o, id);
          if (!n) continue;
          if (isDayPending(o)) wait += n;
          else if (isDayShipped(o)) out += n;
        }
        wait = round(wait);
        out = round(out);
        return { vendor: BASIL_REV[id].val, wait, out, all: round(wait + out) };
      });
      const vendText = (key) => {
        const bits = vendRows.filter((r) => r[key]).map((r) => `${r.vendor}${fmt(r[key])}`);
        return bits.length ? `<span class="plan-vend-inline">${esc(bits.join("\u00a0\u00a0"))}</span>` : "";
      };
      return `<section class="plan-sku tone-${esc(g.tone)}">
        <h3>${esc(g.label)}</h3>
        ${personList(pending, g.unit, "pending")}
        ${personList(shipped, g.unit, "shipped")}
        <div class="plan-stats">
          <p class="plan-stat-row"><span class="plan-stat-label"><i>已</i><i>接</i><i>單</i></span><strong>${fmt(allQty)} ${esc(g.unit)}</strong>${vendText("all")}</p>
          <p class="plan-stat-row"><span class="plan-stat-label"><i>已</i><i></i><i>出</i></span><strong>${fmt(outQty)} ${esc(g.unit)}</strong>${vendText("out")}</p>
          <p class="plan-stat-row"><span class="plan-stat-label"><i>待</i><i></i><i>出</i></span><strong>${fmt(waitQty)} ${esc(g.unit)}</strong>${vendText("wait")}</p>
        </div>
      </section>`;
    })
    .join("");
  box.innerHTML = `<div class="plan-board">${board}</div>`;
}

function nqMorningDone() {
  const date = stockViewDay();
  return NQ_INBOUND.every((row) => !!bookRow(row.id, date).morningConfirmed);
}
function lotLabel(b) {
  const lots = Array.isArray(b.lots) ? b.lots : [];
  if (!lots.length) return "";
  return lots.map((x, i) => `第${i + 1}批 ${fmt(x.qty)}`).join("、");
}
function ensureLots(b) {
  if (Array.isArray(b.lots)) return b.lots;
  b.lots = b.inbound ? [{ qty: round(b.inbound), at: 0 }] : [];
  return b.lots;
}
function correctInbound(skuId, raw, date = stockViewDay()) {
  const sku = skuById(skuId);
  if (!sku) return;
  if (raw === "" || raw == null) return setStatus("請在本批欄填正確的今日進貨總數，再按修正。", true);
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
function unlockMorning(skuId) {
  const b = bookRow(skuId, stockViewDay());
  b.morningConfirmed = false;
  save();
}
function unlockAllMorning() {
  for (const row of NQ_INBOUND) unlockMorning(row.id);
  setStatus("已解開早上盤點，改完請再按確認。", false);
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
  const b = bookRow(skuId, date);
  ensureLots(b);
  b.lots.push({ qty: round(n), at: Date.now() });
  b.inbound = round(b.lots.reduce((s, x) => s + Number(x.qty || 0), 0));
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
  b.inbound = round(Math.max(0, b.lots.reduce((s, x) => s + Number(x.qty || 0), 0)));
  if (isSiteSku(sku)) state.stock[sku.id].qty = round(Math.max(0, (state.stock[sku.id].qty || 0) - qty));
  else syncNqQty(sku);
}
function shipInboundSku(sku) {
  if (!sku) return "";
  if (isSiteSku(sku)) return "auto";
  if (sku.id === "mint-kg" || sku.id === "shiso-kg" || sku.id === "shiso-jin") return "ask";
  return "";
}
function renderStock() {
  if (co === "ha") {
    const inDay = document.getElementById("in-day-card");
    if (inDay) inDay.hidden = true;
    const fillBtn = document.getElementById("fill-count");
    if (fillBtn) fillBtn.hidden = true;
    const fixM = document.getElementById("fix-morning");
    if (fixM) fixM.hidden = true;
    document.getElementById("process").hidden = true;
    document.getElementById("receive").hidden = true;
    const stockBox = document.getElementById("stock");
    if (stockBox) stockBox.innerHTML = "";
    return;
  }
  const date = stockViewDay();
  ensureBooks(date);
  const stockDateEl = document.getElementById("stock-date");
  if (stockDateEl && stockDateEl.value !== date) stockDateEl.value = date;
  const bookDateEl = document.getElementById("book-date");
  if (bookDateEl) bookDateEl.textContent = date;
  const lookingBack = date !== today();
  document.getElementById("stock-title").textContent = "庫存/進貨";
  const inDay = document.getElementById("in-day-card");
  if (inDay) inDay.hidden = false;
  const tot = document.getElementById("in-day-totals");
  if (tot) {
    const rows = NQ_INBOUND;
    tot.innerHTML = rows
      .map((row) => {
        const sku = skuById(row.id);
        const b = bookRow(row.id, date);
        const edited = b.inboundEdited ? '<span class="tag">修正</span>' : "";
        return `<div class="live-totals-item"><span>${edited}${esc(row.label)}</span><strong>${fmt(b.inbound || 0)} ${esc(sku.unit)}</strong></div>`;
      })
      .join("");
  }
  const gs = document.getElementById("guide-stock");
  const gi = document.getElementById("guide-in");
  const gc = document.getElementById("guide-count");
  if (inDay) {
    const h2 = inDay.querySelector("h2");
    const hint = inDay.querySelector(".hint");
    if (h2) h2.textContent = "當日進貨總數";
    if (hint) hint.textContent = lookingBack
      ? `查 ${date} 已記入的進貨合計。可在這天直接改、記入或修正。`
      : "各品項今天已記入的進貨合計（分批會加總）。";
  }
  if (gs) gs.innerHTML = "<strong>庫存</strong>當日可出＝早上盤點＋今日進貨合計－當日已出貨。";
  if (gi) gi.innerHTML = "<strong>進貨</strong>本批填數量按「記入」會累加；打錯就在本批欄填正確總數，按「修正」。";
  if (gc) gc.innerHTML = "<strong>盤點／結算</strong>早上填完按「確認今日早上盤點」。出貨後最右欄「庫存結算」會帶入系統剩餘，按確認鎖定；不對就改數字再確認，或按修正。";
  document.getElementById("process").hidden = true;
  document.getElementById("receive").hidden = true;
  const morningDone = nqMorningDone();
  const anyMorning = NQ_INBOUND.some((row) => bookRow(row.id, date).morningConfirmed);
  const fillBtn = document.getElementById("fill-count");
  fillBtn.hidden = morningDone;
  fillBtn.textContent = "確認今日早上盤點";
  fillBtn.disabled = false;
  const fixM = document.getElementById("fix-morning");
  if (fixM) fixM.hidden = !anyMorning;
  const opts = companySkus()
    .map((s) => `<option value="${s.id}">${esc(s.name)}</option>`)
    .join("");
  document.getElementById("in-sku").innerHTML = opts;
  document.getElementById("pr-sku").innerHTML = opts;
  const body = NQ_INBOUND.map((row) => {
    const sku = skuById(row.id);
    const b = bookRow(row.id, date);
    const step = skuStep(sku);
    const morningVal = b.morning != null && b.morning !== "" ? b.morning : "";
    const locked = !!b.morningConfirmed;
    const done = locked ? "已確認" : "";
    return `<tr>
      <td class="name-cell">${esc(row.label)}</td>
      <td>
        <div class="in-sum">
          ${b.inboundEdited ? '<span class="tag">修正</span>' : ""}
          <strong data-in-total="${row.id}">${fmt(b.inbound || 0)}</strong>
          <span class="unit">${esc(sku.unit)}</span>
          <p class="in-lots" data-in-lots="${row.id}">${esc(lotLabel(b))}</p>
        </div>
      </td>
      <td>
        <div class="ha-process inbound-qty">
          <input class="qty book-input" data-inbound="${row.id}" type="number" min="0" step="${step}" value="" placeholder="本批" inputmode="decimal" aria-label="${esc(row.label)} 本批進貨" />
          <span class="unit">${esc(sku.unit)}</span>
          <button type="button" class="tiny-btn" data-add-inbound="${row.id}">記入</button>
          <button type="button" class="tiny-btn ghost" data-fix-inbound="${row.id}">修正</button>
        </div>
      </td>
      <td>
        <div class="ha-process morning-count">
          <input class="qty book-input" data-morning="${row.id}" type="number" min="0" step="${step}" value="${esc(morningVal)}" placeholder="0" inputmode="decimal" ${locked ? "readonly" : ""} aria-label="${esc(row.label)} 早上庫存盤點" />
          <span class="unit">${esc(sku.unit)}</span>
          <span class="morning-ok" data-morning-ok="${row.id}">${esc(done)}</span>
          ${locked ? `<button type="button" class="tiny-btn ghost" data-fix-morning="${row.id}">修正</button>` : ""}
        </div>
      </td>
      <td>${settleCellHtml(sku)}</td>
    </tr>`;
  }).join("");
  document.getElementById("stock").innerHTML =
    `<table class="inbound-main"><thead><tr><th>品項</th><th>今日已進貨</th><th>本批進貨</th><th>早上庫存盤點</th><th>庫存結算</th></tr></thead><tbody>${body}</tbody></table>`;
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
  const b = bookRow(skuId, date);
  return round((b.opening || 0) + (b.inbound || 0) - shippedQty(skuId, date));
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
    ? `<span class="morning-ok">已確認</span><button type="button" class="tiny-btn ghost" data-fix-settle="${sku.id}">修正</button>`
    : `<span class="settle-calc">系統 ${fmt(calc)}</span><button type="button" class="tiny-btn" data-confirm-settle="${sku.id}">確認</button>`;
  return `<div class="ha-process settle-count">
    ${tag}
    <input class="qty book-input" data-settle="${sku.id}" type="number" min="0" step="${step}" value="${esc(val)}" inputmode="decimal" ${locked ? "readonly" : ""} aria-label="${esc(sku.name)} 庫存結算" />
    <span class="unit">${esc(sku.unit)}</span>
    ${actions}
  </div>`;
}
function applySettleToNextMorning(skuId, date, qty) {
  const next = addDays(date, 1);
  const nb = bookRow(skuId, next);
  nb.opening = qty;
  const sku = skuById(skuId);
  if (sku && isSiteSku(sku)) return;
  if (!nb.morningConfirmed) nb.morning = qty;
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
  card.hidden = co !== "nq";
  if (co !== "nq") return;
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
      if (col.kind === "vendor") {
        const vendor = rowVendor(row);
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
function renderCustChips() {
  const who = document.getElementById("customer").value.trim();
  const box = document.getElementById("cust-chips");
  if (co === "nq") {
    box.innerHTML = "";
    return;
  }
  if (co === "ha") {
    const names = loadHaCustomers();
    if (!names.length) {
      box.innerHTML = '<p class="hint chip-empty">尚無常用出貨對象。請在下方手打，記入後會出現在這裡供下次點選。</p>';
      return;
    }
    box.innerHTML = names
      .map(
        (name) =>
          `<span class="chip${who === name ? " on" : ""}"><button type="button" class="chip-name" data-cust="${esc(name)}">${esc(name)}</button><button type="button" class="chip-x" data-forget="${esc(name)}" aria-label="從常用名單移除 ${esc(name)}">×</button></span>`,
      )
      .join("");
    return;
  }
  box.innerHTML = "";
}

let lineDraftsCache = [];
let linePastePreview = null;
function lineSkuLabel(id) {
  const s = skuById(id);
  return s ? `${s.name} ${s.unit}` : id;
}
function confirmParsedOrder(parsed, date) {
  const who = (parsed.customer || document.getElementById("customer")?.value || "").trim();
  if (!who) return setStatus("請先寫客人名字（第一行或出貨對象欄）。", true);
  const lines = parsed.lines || [];
  if (!lines.length) return setStatus("沒有對到品項，請改文字再解析。", true);
  const ha = lines.filter((l) => (skuById(l.skuId) || {}).co === "ha");
  const nq = lines.filter((l) => (skuById(l.skuId) || {}).co === "nq");
  const day = date || document.getElementById("ship-date")?.value || today();
  if (ha.length) {
    addOpenOrderFor("ha", who, day, ha);
    rememberHaCustomer(who);
    if (!nq.length) co = "ha";
  }
  if (nq.length) {
    addOpenOrderFor("nq", who, day, nq);
    addNqCustomer(who, formKindOfSku(nq[0].skuId));
    if (!ha.length) {
      co = "nq";
      formKind = formKindOfSku(nq[0].skuId);
    }
  }
  save();
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
function renderLineDrafts() {
  const box = document.getElementById("line-drafts");
  if (!box) return;
  const list = [];
  if (linePastePreview) list.push({ ...linePastePreview, id: "paste", local: true });
  for (const d of lineDraftsCache) list.push(d);
  if (!list.length) {
    box.innerHTML = '<p class="empty">把文字貼上按「解析文字」，核對後會出現在這裡。</p>';
    return;
  }
  box.innerHTML = list
    .map((d) => {
      const bits = (d.lines || [])
        .map((l) => {
          const extra = [l.pack, l.pallet ? "疊棧板" : ""].filter(Boolean).join(" ");
          return `<li>${esc(lineSkuLabel(l.skuId))} ${esc(fmt(l.qty))}${extra ? ` ${esc(extra)}` : ""}</li>`;
        })
        .join("");
      const unk = (d.unknown || []).length ? `<p class="hint">沒對到：${esc(d.unknown.join("、"))}</p>` : "";
      const who = d.customer ? esc(d.customer) : "（未寫客人）";
      return `<article class="line-draft">
        <strong>${who}</strong>　<span class="muted">${esc(d.date || "")}</span>
        <pre>${esc(d.text || d.raw || "")}</pre>
        <ul>${bits || "<li>沒有對到品項</li>"}</ul>
        ${unk}
        <div class="btn-row">
          <button type="button" class="primary" data-line-ok="${esc(d.id)}">確認入單</button>
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
      else if (!s.lastWebhookAt) st.textContent = "LINE 頻道已接上。群組請先 @鴻安農業科技 再傳下單內容。";
      else st.textContent = "LINE 頻道已接上。群組請先 @鴻安農業科技 再傳下單內容。";
    }
  } catch (_) {
    if (st) st.textContent = "本機或尚未部署 webhook。可先貼上文字解析。";
  }
  try {
    const data = await fetch("/api/line/drafts", { cache: "no-store" }).then((r) => r.json());
    lineDraftsCache = Array.isArray(data.drafts) ? data.drafts : [];
  } catch (_) {
    lineDraftsCache = [];
  }
  renderLineDrafts();
}

function applyCopy() {
  const intro = document.getElementById("intro-note");
  const formTitle = document.getElementById("form-title");
  const formHint = document.getElementById("form-hint");
  const ordersHint = document.getElementById("orders-hint");
  const cust = document.getElementById("customer");
  const tabs = document.getElementById("form-kind-tabs");
  if (tabs) tabs.hidden = co !== "nq";
  document.querySelectorAll("[data-form]").forEach((b) => b.classList.toggle("on", b.dataset.form === formKind));
  if (co === "ha") {
    intro.textContent =
      "鴻安：手打或點出貨對象，加品項填數量後確認。接單不看可出；出貨才扣庫。";
    formTitle.textContent = editing ? "修改數量" : "訂單輸入";
    formHint.textContent = "洋蔥：紐西蘭／澳洲／韓國／越南，規格 20K／12K。南瓜：密本／阿成，規格 18K（預設）／20K。B級按 kg。疊棧板可勾、可不勾。用＋加一筆、刪拿掉。已填紀錄跟出貨日同一天。";
    ordersHint.textContent = "只顯示所選出貨日當天的已填紀錄。未出貨可用 ↑↓ 調整出貨順序。";
    cust.placeholder = "請輸入出貨對象";
    cust.readOnly = false;
    return;
  }
  const def = FORM_KINDS[formKind] || FORM_KINDS.leaf;
  intro.textContent =
    "穠全：在上方表格填當天叫貨數量。地瓜葉／九層塔無叫貨請填「休」，會列清單表示已確認當日狀態。出貨對象預設小琳、欣儒，可自行新增。底部按「確認輸入訂單」即佔量。出貨順序在已填紀錄用 ↑↓ 調整。";
  formTitle.textContent = editing ? "修改數量" : def.formTitle;
  formHint.textContent = def.formHint;
  ordersHint.textContent = formAllowsRest()
    ? "只顯示所選日期當天的已填紀錄。無叫貨填「休」會列在上方。待出貨可用 ↑↓ 調整出貨順序。"
    : "只顯示所選日期當天的已填紀錄。待出貨可用 ↑↓ 調整出貨順序。";
  cust.readOnly = false;
  cust.placeholder = "請輸入出貨對象";
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
  document.getElementById("co-name").textContent = co === "nq" ? "穠全公司" : "鴻安公司";
  document.querySelectorAll("[data-co]").forEach((b) => b.classList.toggle("on", b.dataset.co === co));
  const stockTab = document.querySelector('[data-page="stock"]');
  if (stockTab) {
    stockTab.hidden = co === "ha";
    stockTab.textContent = "庫存/進貨";
  }
  if (co === "ha" && page === "stock") page = "orders";
  document.querySelectorAll("[data-page]").forEach((b) => b.classList.toggle("on", b.dataset.page === page));
  document.getElementById("page-orders").hidden = page !== "orders";
  document.getElementById("page-plan").hidden = page !== "plan";
  document.getElementById("page-stock").hidden = page !== "stock" || co === "ha";
  applyCopy();
  document.getElementById("order-form").hidden = co !== "ha";
  const nqCancel = document.getElementById("nq-cancel-edit");
  if (nqCancel) nqCancel.hidden = !(co === "nq" && editing);
  const run = (fn) => {
    try {
      fn();
    } catch (err) {
      console.error(err);
    }
  };
  run(renderLineDrafts);
  run(renderCustChips);
  run(renderDailyGrid);
  run(renderSheet);
  run(renderCheck);
  run(renderOrders);
  run(renderRestList);
  run(renderPlan);
  run(renderStock);
  run(renderAlerts);
}

document.querySelectorAll("[data-co]").forEach((btn) => {
  btn.onclick = () => {
    co = btn.dataset.co;
    editing = "";
    document.getElementById("edit-id").value = "";
    document.getElementById("cancel-edit").hidden = true;
    const nqCancel = document.getElementById("nq-cancel-edit");
    if (nqCancel) nqCancel.hidden = true;
    render();
  };
});
document.querySelectorAll("[data-page]").forEach((btn) => {
  btn.onclick = () => {
    if (btn.dataset.page === "stock" && co === "ha") return;
    page = btn.dataset.page;
    render();
  };
});
document.getElementById("plan").addEventListener("click", (e) => {
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
document.querySelectorAll("[data-form]").forEach((btn) => {
  btn.onclick = () => {
    formKind = btn.dataset.form;
    render();
  };
});
document.getElementById("line-parse-btn")?.addEventListener("click", () => {
  const parse = globalThis.LineOrderParse?.parseLineOrderText;
  if (!parse) return setStatus("解析程式還沒載入。", true);
  const raw = document.getElementById("line-paste")?.value || "";
  const parsed = parse(raw);
  linePastePreview = { ...parsed, text: raw, date: today() };
  renderLineDrafts();
  if (!parsed.lines.length) setStatus("沒對到品項。第一行寫客人，下面寫紐20兩袋、密本一箱。", true);
  else setStatus("已解析，請看預覽再按確認入單。", false);
});
document.getElementById("line-drafts")?.addEventListener("click", async (e) => {
  const ok = e.target.closest("[data-line-ok]");
  const no = e.target.closest("[data-line-no]");
  if (ok) {
    const id = ok.dataset.lineOk;
    if (id === "paste") {
      if (confirmParsedOrder(linePastePreview)) {
        linePastePreview = null;
        const ta = document.getElementById("line-paste");
        if (ta) ta.value = "";
      }
      return;
    }
    const d = lineDraftsCache.find((x) => x.id === id);
    if (!d) return;
    if (confirmParsedOrder(d, d.date)) {
      await dropLineDraft(id);
      await refreshLineDrafts();
    }
    return;
  }
  if (no) {
    const id = no.dataset.lineNo;
    if (id === "paste") {
      linePastePreview = null;
      renderLineDrafts();
      return;
    }
    await dropLineDraft(id);
    await refreshLineDrafts();
  }
});
document.getElementById("sheet").addEventListener("input", renderCheck);
document.getElementById("sheet").addEventListener("change", (e) => {
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
  renderCheck();
});
document.getElementById("sheet").addEventListener("click", (e) => {
  if (e.target.closest("[data-ha-add]")) {
    document.getElementById("ha-lines")?.insertAdjacentHTML("beforeend", haLineHtml({}));
    return;
  }
  const del = e.target.closest("[data-ha-del]");
  if (!del) return;
  del.closest(".ha-line")?.remove();
  if (!document.querySelector("#ha-lines .ha-line")) {
    document.getElementById("ha-lines")?.insertAdjacentHTML("beforeend", haLineHtml({}));
  }
});
document.getElementById("ship-date").value = today();
document.getElementById("ship-date").addEventListener("change", () => {
  if (co === "ha") renderOrders();
});
document.getElementById("daily-sheet-date").value = today();
document.getElementById("daily-sheet-date").addEventListener("change", () => {
  renderDailyGrid();
  renderLeafInbound();
  renderCheck();
  renderRestList();
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
document.getElementById("cust-chips").addEventListener("click", (e) => {
  const forget = e.target.closest("[data-forget]");
  if (forget) {
    e.preventDefault();
    const name = forget.dataset.forget;
    if (!confirm(`從常用名單移除「${name}」？已填的訂單不會刪除。`)) return;
    removeHaCustomer(name);
    renderCustChips();
    setStatus(`已從常用名單移除「${name}」。`, false);
    return;
  }
  const btn = e.target.closest("[data-cust]");
  if (!btn) return;
  document.getElementById("customer").value = btn.dataset.cust;
  renderCustChips();
  const first = document.querySelector("#sheet .qty");
  if (first) first.focus();
});
document.getElementById("customer").addEventListener("input", renderCustChips);

document.getElementById("order-form").onsubmit = (e) => {
  e.preventDefault();
  const lines = linesFromForm();
  if (!lines.length) return setStatus("請填至少一項數量", true);
  if (missingPack(lines)) return setStatus("地瓜葉有數量時請選擇裝箱樣式（籃裝或箱裝）", true);
  const map = qtyMapFromForm();
  const { worst } = lineChecks(map, currentRecord());
  const who = document.getElementById("customer").value.trim();
  if (!who) return setStatus("請填出貨對象", true);
  if (editing) {
    const o = state.orders.find((x) => x.id === editing);
    o.customer = who;
    o.shipDate = document.getElementById("ship-date").value;
    o.lines = lines;
    o.edited = true;
    o.status = "open";
    editing = "";
    document.getElementById("cancel-edit").hidden = true;
  } else {
    const nos = state.orders.filter((o) => o.co === co).map((o) => o.no);
    state.orders.unshift({
      id: uid(),
      co,
      no: (nos.length ? Math.max(...nos) : 0) + 1,
      customer: who,
      shipDate: document.getElementById("ship-date").value,
      lines,
      status: "open",
      prio: nextPrio(),
      edited: false,
    });
  }
  if (co === "ha") rememberHaCustomer(who);
  save();
  document.getElementById("customer").value = "";
  commitStatus(worst);
  render();
};

document.getElementById("cancel-edit").onclick = () => {
  editing = "";
  document.getElementById("cancel-edit").hidden = true;
  render();
};

document.getElementById("rest-list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-unrest]");
  if (!btn) return;
  const name = btn.dataset.unrest;
  const date = sheetDate();
  removeRest(name, date);
  const { data, book } = dailyBook(date);
  clearRowRest(book[name]);
  saveDailyStore(data);
  render();
});
document.getElementById("orders").onclick = (e) => {
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
    o.status = "cancelled";
    save();
    setStatus("已取消（紅線保留）。", false);
    render();
    return;
  }
  if (btn.dataset.act === "delete") {
    if (!confirm(`確定刪除「${o.customer}」這筆訂單紀錄？刪除後無法還原。`)) return;
    if (o.status === "shipped") {
      for (const line of o.lines) {
        const sku = skuById(line.skuId);
        if (isSiteSku(sku)) state.stock[sku.id].processed = round(state.stock[sku.id].processed + line.qty);
      }
      for (const lot of o.shipInbounds || []) reverseInboundLot(lot.skuId, lot.qty, o.shippedOn || today());
    }
    state.orders = state.orders.filter((x) => x.id !== o.id);
    if (editing === o.id) {
      editing = "";
      document.getElementById("edit-id").value = "";
      document.getElementById("cancel-edit").hidden = true;
    }
    save();
    setStatus("已刪除訂單紀錄。", false);
    render();
    return;
  }
  if (btn.dataset.act === "edit") {
    editing = o.id;
    document.getElementById("edit-id").value = o.id;
    page = "orders";
    if (co === "nq") {
      if (o.lines[0]) formKind = formKindOfSku(o.lines[0].skuId);
      addNqCustomer(o.customer, formKind);
      document.getElementById("daily-sheet-date").value = o.shipDate;
      const { data, book } = dailyBook(o.shipDate);
      book[o.customer] = { ...(book[o.customer] || {}), ...linesToDailyRow(o.lines) };
      saveDailyStore(data);
      render();
      return;
    }
    document.getElementById("customer").value = o.customer;
    document.getElementById("ship-date").value = o.shipDate;
    document.getElementById("cancel-edit").hidden = false;
    render();
    renderCheck();
    return;
  }
  if (btn.dataset.act === "ship") {
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
        if (isSiteSku(sku)) continue;
        if (available(sku, o) < qty) {
          setStatus(`${sku.name} 可出不足，不能出貨。請先在庫存頁記入進貨或早上盤點。`, true);
          return;
        }
      }
      const autoIn = [];
      const askIn = [];
      for (const [skuId, qty] of Object.entries(need)) {
        const sku = skuById(skuId);
        if (!sku) continue;
        const how = shipInboundSku(sku);
        if (how === "auto") autoIn.push({ skuId, qty, sku });
        if (how === "ask") askIn.push({ skuId, qty, sku });
      }
      if (autoIn.length) {
        const bits = autoIn.map((x) => `${x.sku.name.replace("洋蔥／", "")} ${fmt(x.qty)} ${x.sku.unit}`).join("、");
        if (!confirm(`確定出貨「${o.customer}」？\n將扣可出（不夠則扣到 0），並把出貨數量累計入今日進貨：${bits}`)) return;
      }
      let doAskIn = false;
      if (askIn.length) {
        const names = [...new Set(askIn.map((x) => x.sku.name.replace("散賣kg", "").replace("散賣斤", "")))].join("、");
        doAskIn = confirm(
          `${names}出貨：要同時記入相同數量進貨嗎？\n確定＝進貨＋出貨（當日可出庫存不變）\n取消＝只出貨扣庫`,
        );
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
      const inLots = [...autoIn, ...(doAskIn ? askIn : [])];
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
  const rsv = reservedAll(skuId);
  const av = available(sku);
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
  b.morning = round(n);
  b.morningConfirmed = true;
  b.opening = round(n);
  syncNqQty(sku);
  save();
  const mark = document.querySelector(`[data-morning-ok="${skuId}"]`);
  if (mark) mark.textContent = "已確認";
  const input = document.querySelector(`[data-morning="${skuId}"]`);
  if (input) input.readOnly = true;
  if (quiet) return;
  const label = NQ_INBOUND.find((r) => r.id === skuId)?.label || sku.name;
  setStatus(`已確認「${label}」早上盤點 ${fmt(n)} ${sku.unit}。`, false);
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

const stockEl = document.getElementById("stock");
stockEl.addEventListener("change", (e) => {
  const input = e.target.closest("[data-safety]");
  if (!input) return;
  const n = Number(input.value);
  state.stock[input.dataset.safety].safety = n >= 0 ? n : 0;
  save();
  renderCheck();
  renderAlerts();
  setStatus("已更新安全庫存。", false);
});
stockEl.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.morning != null) {
    const b = bookRow(t.dataset.morning, stockViewDay());
    if (b.morningConfirmed) return;
    b.morning = t.value === "" ? "" : Math.max(0, Number(t.value) || 0);
    save();
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
stockEl.addEventListener("click", (e) => {
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
    const input = document.querySelector(`[data-inbound="${id}"]`);
    const label = NQ_INBOUND.find((r) => r.id === id)?.label || id;
    if (!confirm(`將「${label}」今日進貨改為輸入框的數字？`)) return;
    correctInbound(id, input?.value);
    return;
  }
  const fixOne = e.target.closest("[data-fix-morning]");
  if (fixOne) {
    unlockMorning(fixOne.dataset.fixMorning);
    setStatus("已解開此品項早上盤點，改完請再按確認。", false);
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
stockEl.addEventListener("keydown", (e) => {
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
document.getElementById("fill-count").onclick = () => {
  const missing = [];
  for (const row of NQ_INBOUND) {
    const input = document.querySelector(`[data-morning="${row.id}"]`);
    const raw = input ? input.value : bookRow(row.id, stockViewDay()).morning;
    if (raw === "" || raw == null) missing.push(row.label);
  }
  if (missing.length) return setStatus(`請先填完早上盤點：${missing.join("、")}`, true);
  for (const row of NQ_INBOUND) {
    const input = document.querySelector(`[data-morning="${row.id}"]`);
    confirmMorningCount(row.id, input?.value, true);
  }
  setStatus("已確認今日早上盤點。隔天再填新的一趟。", false);
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
  return stockHasData(state.stock);
}
function collectBundle() {
  return {
    updatedAt: Date.now(),
    orders: { stock: state.stock, orders: state.orders, daily: state.daily || {}, rests: state.rests || [] },
    nqCustomers: loadNqLists(),
    haCustomers: loadHaCustomers(),
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
