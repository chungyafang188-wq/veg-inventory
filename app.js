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
    hint: "地瓜葉分誌／芳填當天叫貨。裝箱預設籃裝，可改箱裝。出貨對象預設小琳、欣儒，其他可自行新增；與九層塔／散賣名單分開，刪除不會互刪。件數直接打數字，↑↓←→ 換格。總數邊打邊加。",
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
    hint: "",
    formHint: "紅骨／綠骨／廠商／備註。",
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
  { id: "on-nz-l", co: "ha", name: "洋蔥／紐西蘭大球", unit: "袋", onion: true },
  { id: "on-nz-xl", co: "ha", name: "洋蔥／紐西蘭特大", unit: "袋", onion: true },
  { id: "on-kr-l", co: "ha", name: "洋蔥／韓洋大球", unit: "袋", onion: true },
  { id: "on-kr-xl", co: "ha", name: "洋蔥／韓洋特大", unit: "袋", onion: true },
  { id: "on-kr-m", co: "ha", name: "洋蔥／韓洋中", unit: "袋", onion: true },
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
  return changed;
}
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "null");
    if (data && data.stock && data.orders) {
      if (!data.daily) data.daily = {};
      return data;
    }
  } catch (_) {}
  return { stock: emptyStock(), orders: [], daily: {} };
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
  if (!cloudReady || skipCloud) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => {
    pushCloud();
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
function ensureTodayBooks() {
  const date = today();
  const book = bookOf(date);
  let changed = false;
  for (const sku of nqSkus()) {
    if (book[sku.id]) continue;
    book[sku.id] = { opening: seedOpening(sku.id, date), inbound: 0, count: null };
    changed = true;
  }
  return changed;
}
function bookRow(skuId, date = today()) {
  ensureTodayBooks();
  const book = bookOf(date);
  if (!book[skuId]) book[skuId] = { opening: seedOpening(skuId, date), inbound: 0, count: null };
  return book[skuId];
}
function onHand(sku, date = today()) {
  if (sku.onion) return state.stock[sku.id].processed;
  const b = bookRow(sku.id, date);
  return round((b.opening || 0) + (b.inbound || 0) - shippedQty(sku.id, date));
}
function syncNqQty(sku) {
  if (sku.onion) return;
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
const seeded = ensureTodayBooks();
syncAllNqQty();
if (migrated || seeded) save();

let co = "ha";
let page = "orders";
let formKind = "leaf";
let editing = "";

function skuById(id) {
  return SKUS.find((s) => s.id === id);
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
function ready(sku) {
  return sku.onion ? state.stock[sku.id].processed : onHand(sku);
}
function currentRecord() {
  return editing ? state.orders.find((x) => x.id === editing) : undefined;
}
/** 先填先佔：只算比 current 更早（單號較小）的未出貨紀錄。新紀錄則算全部已佔。 */
function reservedAhead(skuId, current) {
  let n = 0;
  for (const o of state.orders) {
    if (o.co !== co || o.status !== "open") continue;
    if (current) {
      if (o.id === current.id) continue;
      if (o.no >= current.no) continue;
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
  return `${name} ${fmt(l.qty)}${unit}${pack}${note}`;
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

function renderSheet() {
  const current = currentRecord();
  const leaf = co === "nq" && formKind === "leaf";
  const html = formSkus()
    .map((sku) => {
      const av = available(sku, current);
      return `<tr><td class="name-cell">${esc(sku.name)}</td><td>${fmt(av)} ${sku.unit}</td>
        <td><input class="qty" data-sku="${sku.id}" type="number" min="0" step="0.1" /></td></tr>`;
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
  const errors = [];
  for (const name of names) {
    const { lines, err } = linesFromDailyRow(book[name] || {}, basilMeta(book));
    if (err.includes("pack")) errors.push(`${name}：地瓜葉有數量時請選裝箱樣式`);
    if (lines.length) entries.push({ customer: name, lines });
  }
  return { date, entries, errors };
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
  const nos = state.orders.filter((o) => o.co === co).map((o) => o.no);
  state.orders.unshift({
    id: uid(),
    co,
    no: (nos.length ? Math.max(...nos) : 0) + 1,
    customer,
    shipDate,
    lines,
    status: "open",
    edited: false,
  });
}
function commitStatus(worst) {
  if (worst === "bad") setStatus("有品項不夠，仍已佔量列入排程，請看紅字。", true);
  else if (worst === "warn") setStatus("已確認列入排程，但有品項將低於安全庫存。", false);
  else setStatus("已確認並列入排程（已佔量，尚未扣庫）。", false);
}
function confirmNqSchedule() {
  const { date, entries, errors } = collectNqEntries();
  if (errors.length) return setStatus(errors[0], true);
  if (!entries.length) return setStatus("請在上方表格填至少一項件數", true);
  const map = qtyMapFromLines(entries);
  const { worst } = lineChecks(map, currentRecord());
  if (editing) {
    const o = state.orders.find((x) => x.id === editing);
    o.customer = entries[0].customer;
    o.shipDate = date;
    o.lines = entries[0].lines;
    o.edited = true;
    o.status = "open";
    editing = "";
    document.getElementById("edit-id").value = "";
  } else {
    for (const e of entries) addOpenOrder(e.customer, date, e.lines);
  }
  clearDailyRows(entries.map((e) => e.customer), date);
  save();
  commitStatus(worst);
  render();
}

function renderCheck() {
  if (co === "nq") {
    const box = document.getElementById("nq-check");
    if (!box) return;
    const { entries, errors } = collectNqEntries();
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
    box.innerHTML = errHtml + stockHtml;
    box.dataset.worst = errors.length ? "bad" : worst;
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
  const list = state.orders.filter((o) => o.co === co);
  const box = document.getElementById("orders");
  if (!list.length) {
    box.innerHTML = '<p class="empty">尚無紀錄。</p>';
    return;
  }
  box.innerHTML = `<ul class="list">${list
    .map((o) => {
      const cls = o.status === "cancelled" ? "cancelled" : "";
      const tag = o.edited ? '<span class="tag">改</span>' : "";
      const st = o.status === "shipped" ? "已出貨" : o.status === "cancelled" ? "已取消" : "未出貨";
      const lines = o.lines.map((l) => lineLabel(l, true)).join("、");
      const bits = [];
      if (o.status === "open") {
        bits.push(`<button type="button" data-act="ship" data-id="${o.id}">出貨扣庫</button>`);
        bits.push(`<button type="button" data-act="edit" data-id="${o.id}">修改</button>`);
        if (co === "nq") bits.push(`<button type="button" data-act="cancel" data-id="${o.id}">取消</button>`);
      }
      if (co === "ha") bits.push(`<button type="button" data-act="delete" data-id="${o.id}">刪除紀錄</button>`);
      const acts = bits.length ? `<div class="order-actions">${bits.join("")}</div>` : "";
      return `<li class="${cls}"><div class="row"><span class="order-title">${tag}#${esc(o.no)} ${esc(o.customer)}</span><span class="muted">${esc(o.shipDate)} ${st}</span></div>
        <p class="lines">${esc(lines)}</p>${acts}</li>`;
    })
    .join("")}</ul>`;
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
function renderPlan() {
  const shortBox = document.getElementById("plan-short");
  const box = document.getElementById("plan");
  if (!box) return;
  const day = today();
  const orders = state.orders.filter((o) => o.co === co && o.status !== "cancelled");
  const groups = planGroups();
  const shorts = [];
  for (const g of groups) {
    const parts = [];
    let needAll = 0;
    let gapAll = 0;
    for (const id of g.skuIds) {
      const sku = skuById(id);
      if (!sku) continue;
      let need = 0;
      for (const o of orders) {
        if (o.status === "open") need += lineQtyForSku(o, id);
      }
      need = round(need);
      const have = ready(sku);
      const gap = round(Math.max(0, need - have));
      needAll = round(needAll + need);
      gapAll = round(gapAll + gap);
      const vendor = BASIL_REV[id]?.val;
      if (vendor && need) parts.push({ vendor, need, gap, unit: sku.unit });
    }
    if (!needAll) continue;
    if (gapAll <= 0 && !parts.length) continue;
    if (gapAll <= 0 && parts.every((p) => p.gap <= 0)) continue;
    shorts.push({ label: g.label, gap: gapAll, unit: g.unit, parts });
  }
  if (shortBox) {
    shortBox.innerHTML = shorts.length
      ? `<div class="short-board">${shorts
          .map((s) => {
            const vend = s.parts.length
              ? `<div class="short-vends">${s.parts
                  .map((p) => {
                    const gap = p.gap
                      ? `<em class="no">缺 ${fmt(p.gap)}</em>`
                      : `<em class="ok">夠</em>`;
                    return `<div class="short-v ${p.gap ? "no" : "ok"}"><span>${esc(p.vendor)}</span><b>需 ${fmt(p.need)}</b>${gap}</div>`;
                  })
                  .join("")}</div>`
              : "";
            return `<article class="short-card">
              <h3>${esc(s.label)}</h3>
              <p class="short-total">${s.gap > 0 ? `共缺 <strong>${fmt(s.gap)}</strong> ${esc(s.unit)}` : "合計夠出"}</p>
              ${vend}
            </article>`;
          })
          .join("")}</div>`
      : '<p class="empty">目前沒有缺貨品項。</p>';
  }
  const isTodayShipped = (o) => o.status === "shipped" && (o.shippedOn || o.shipDate) === day;
  const used = groups.filter((g) =>
    orders.some((o) => lineQtyForSkus(o, g.skuIds) > 0 && (o.status === "open" || isTodayShipped(o))),
  );
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
  box.innerHTML = used
    .map((g) => {
      const pending = [];
      const shipped = [];
      for (const o of orders) {
        const qty = lineQtyForSkus(o, g.skuIds);
        if (!qty) continue;
        const rec = {
          customer: o.customer,
          qty,
          note: planLineNote(o, g.skuIds),
        };
        if (o.status === "open") pending.push(rec);
        else if (isTodayShipped(o)) shipped.push(rec);
      }
      pending.sort((a, b) => a.customer.localeCompare(b.customer, "zh-Hant"));
      shipped.sort((a, b) => a.customer.localeCompare(b.customer, "zh-Hant"));
      return `<section class="plan-sku tone-${esc(g.tone)}">
        <h3>${esc(g.label)}</h3>
        ${personList(pending, g.unit, "pending")}
        ${personList(shipped, g.unit, "shipped")}
      </section>`;
    })
    .join("");
  box.innerHTML = `<div class="plan-board">${box.innerHTML}</div>`;
}

function nqMorningDone() {
  return NQ_INBOUND.every((row) => !!bookRow(row.id).morningConfirmed);
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
function addInboundLot(skuId, raw, date = today()) {
  const sku = skuById(skuId);
  if (!sku) return;
  const n = Number(raw);
  if (!(n > 0)) return setStatus("本批進貨必須大於 0，記入後可再打下一批。", true);
  const b = bookRow(skuId, date);
  ensureLots(b);
  b.lots.push({ qty: round(n), at: Date.now() });
  b.inbound = round(b.lots.reduce((s, x) => s + Number(x.qty || 0), 0));
  if (date === today()) syncNqQty(sku);
  save();
  setStatus(`已留存本批 ${fmt(n)} ${sku.unit}。今日合計 ${fmt(b.inbound)} ${sku.unit}，可再輸入下一筆。`, false);
  renderStock();
  renderLeafInbound();
  renderCheck();
  renderAlerts();
}
function renderStock() {
  const onion = co === "ha";
  const date = today();
  ensureTodayBooks();
  document.getElementById("book-date").textContent = date;
  const stockTab = document.querySelector('[data-page="stock"]');
  if (stockTab) stockTab.textContent = onion ? "庫存" : "庫存/進貨";
  const inDay = document.getElementById("in-day-card");
  if (inDay) inDay.hidden = onion;
  if (!onion) {
    const tot = document.getElementById("in-day-totals");
    if (tot) {
      tot.innerHTML = NQ_INBOUND.map((row) => {
        const sku = skuById(row.id);
        const b = bookRow(row.id);
        return `<div class="live-totals-item"><span>${esc(row.label)}</span><strong>${fmt(b.inbound || 0)} ${esc(sku.unit)}</strong></div>`;
      }).join("");
    }
  }
  document.getElementById("stock-hint").textContent = onion
    ? "現有庫存＝已加工整理，可出。各規格在「加工填入」寫本次加工數量，記入後加入現有庫存。沒有原料欄、沒有進貨。訂單出貨只扣現有庫存。"
    : "進貨可分批：填本批數量按記入，合計會累加，欄位清空後再打下一批。早上庫存盤點每天填一次，全部填完按「確認今日早上盤點」，確認後當日不能再改。當日庫存＝早上盤點＋當日進貨合計－當日已出貨。";
  document.getElementById("process").hidden = true;
  document.getElementById("receive").hidden = true;
  const morningDone = !onion && nqMorningDone();
  const fillBtn = document.getElementById("fill-count");
  fillBtn.hidden = onion || morningDone;
  fillBtn.textContent = "確認今日早上盤點";
  fillBtn.disabled = false;
  const opts = companySkus()
    .map((s) => `<option value="${s.id}">${esc(s.name)}</option>`)
    .join("");
  document.getElementById("in-sku").innerHTML = opts;
  document.getElementById("pr-sku").innerHTML = opts;
  if (onion) {
    const body = companySkus()
      .map((sku) => {
        const rsv = reservedAll(sku.id);
        const leftover = round(ready(sku) - rsv);
        const st = state.stock[sku.id];
        return `<tr>
          <td class="name-cell">${esc(sku.name)}</td>
          <td data-oh="${sku.id}">${fmt(st.processed)} ${esc(sku.unit)}</td>
          <td>
            <div class="ha-process">
              <input class="qty process-in" data-process="${sku.id}" type="number" min="0" step="0.1" inputmode="decimal" placeholder="0" aria-label="${esc(sku.name)} 加工填入" />
              <button type="button" class="tiny-btn" data-add-process="${sku.id}">記入</button>
            </div>
          </td>
          <td>${fmt(rsv)}</td>
          <td>${fmt(leftover)} ${sku.unit}</td>
        </tr>`;
      })
      .join("");
    document.getElementById("stock").innerHTML =
      `<table><thead><tr><th>規格</th><th>現有庫存</th><th>加工填入</th><th>已佔</th><th>可出</th></tr></thead><tbody>${body}</tbody></table>`;
    return;
  }
  const body = NQ_INBOUND.map((row) => {
    const sku = skuById(row.id);
    const b = bookRow(row.id);
    const step = skuStep(sku);
    const morningVal = b.morning != null && b.morning !== "" ? b.morning : "";
    const locked = !!b.morningConfirmed;
    const done = locked ? "已確認" : "";
    return `<tr>
      <td class="name-cell">${esc(row.label)}</td>
      <td>
        <div class="in-sum">
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
        </div>
      </td>
      <td>
        <div class="ha-process morning-count">
          <input class="qty book-input" data-morning="${row.id}" type="number" min="0" step="${step}" value="${esc(morningVal)}" placeholder="0" inputmode="decimal" ${locked ? "readonly" : ""} aria-label="${esc(row.label)} 早上庫存盤點" />
          <span class="unit">${esc(sku.unit)}</span>
          <span class="morning-ok" data-morning-ok="${row.id}">${esc(done)}</span>
        </div>
      </td>
    </tr>`;
  }).join("");
  document.getElementById("stock").innerHTML =
    `<table class="inbound-main"><thead><tr><th>品項</th><th>今日已進貨</th><th>本批進貨</th><th>早上庫存盤點</th></tr></thead><tbody>${body}</tbody></table>`;
}

function renderCustomers() {
  document.getElementById("today-label").textContent = today();
  const shipped = state.orders.filter((o) => o.co === co && o.status === "shipped" && o.shippedOn === today());
  const box = document.getElementById("customers");
  if (!shipped.length) {
    box.innerHTML = '<p class="empty">今天還沒出貨。</p>';
    return;
  }
  box.innerHTML = `<ul class="list">${shipped
    .map((o) => `<li><strong>${esc(o.customer)}</strong><p class="lines">${o.lines.map((l) => lineLabel(l, false)).join("、")}</p></li>`)
    .join("")}</ul>`;
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
function sheetDate() {
  return document.getElementById("daily-sheet-date")?.value || today();
}
function gridQtySums() {
  const { book } = dailyBook(sheetDate());
  const names = gridCustomers();
  const sums = {};
  let grand = 0;
  for (const col of currentCols()) {
    if (col.kind !== "qty") continue;
    let n = 0;
    for (const name of names) {
      migrateBasilDailyRow(book[name] || {});
      n += Number((book[name] || {})[col.key]) || 0;
    }
    sums[col.key] = n;
    grand += n;
  }
  return { sums, grand };
}
function basilCalledTotals(date) {
  const tot = {};
  for (const v of VENDOR_OPTS) tot[v] = { rb: 0, gb: 0 };
  const add = (vendor, bone, n) => {
    if (!n || !tot[vendor]) return;
    tot[vendor][bone] = round(tot[vendor][bone] + n);
  };
  for (const o of state.orders) {
    if (o.co !== "nq" || o.shipDate !== date) continue;
    if (o.status === "cancelled") continue;
    if (editing && o.id === editing) continue;
    for (const l of o.lines || []) {
      const b = BASIL_REV[l.skuId];
      if (b) add(b.val, b.qty, l.qty);
    }
  }
  const { book } = dailyBook(date);
  for (const name of gridCustomers()) {
    const row = book[name] || {};
    migrateBasilDailyRow(row);
    const v = rowVendor(row);
    add(v, "rb", qtyN(row.rb));
    add(v, "gb", qtyN(row.gb));
  }
  return tot;
}
function renderLiveTotals() {
  const el = document.getElementById("live-totals");
  if (!el) return;
  if (co !== "nq") {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const { sums, grand } = gridQtySums();
  const item = (label, n, extra) =>
    `<div class="live-totals-item${extra ? ` ${extra}` : ""}"><span>${esc(label)}</span><strong>${fmt(n || 0)}</strong></div>`;
  let row = "";
  let sub = "";
  if (formKind === "leaf") {
    row =
      item("誌總數", sums.slZhi) +
      item("芳總數", sums.slFang) +
      item("合計", grand, "grand");
  } else if (formKind === "basil") {
    const date = sheetDate();
    const called = basilCalledTotals(date);
    const rbAll = VENDOR_OPTS.reduce((s, v) => round(s + (called[v].rb || 0)), 0);
    const gbAll = VENDOR_OPTS.reduce((s, v) => round(s + (called[v].gb || 0)), 0);
    row = item("紅骨", rbAll) + item("綠骨", gbAll) + item("合計", round(rbAll + gbAll), "grand");
    sub = `<div class="vendor-totals"><p class="vendor-totals-kicker">今天九層塔廠商叫貨總數</p><div class="vendor-totals-grid">
      ${VENDOR_OPTS.map((v) => {
        const rb = called[v].rb || 0;
        const gb = called[v].gb || 0;
        const n = round(rb + gb);
        return `<div class="vendor-tot"><span>${esc(v)}</span><strong>${fmt(n)}</strong><small>紅骨 ${fmt(rb)}　綠骨 ${fmt(gb)}</small></div>`;
      }).join("")}
    </div></div>`;
  } else {
    row =
      item("薄荷", sums.mint) +
      item("紫蘇", sums.shisoKg) +
      item("九層塔", sums.basilKg) +
      item("合計", grand, "grand");
  }
  el.innerHTML = `<p class="live-totals-kicker">今日叫貨總數（打了就加總，不必先確認）</p><div class="live-totals-row">${row}</div>${sub}`;
}
function confirmStock(skuId, date) {
  const b = bookRow(skuId, date);
  return round((b.opening || 0) + (b.inbound || 0) - shippedQty(skuId, date));
}
function renderLeafInbound() {
  const box = document.getElementById("leaf-inbound");
  if (!box) return;
  const show = co === "nq" && formKind === "leaf";
  box.hidden = !show;
  if (!show) return;
  const date = sheetDate();
  const { sums } = gridQtySums();
  const rows = [
    { id: "sl-zhi", key: "slZhi", label: "地瓜葉／誌" },
    { id: "sl-fang", key: "slFang", label: "地瓜葉／芳" },
  ];
  const body = rows
    .map((r) => {
      const sku = skuById(r.id);
      const b = bookRow(r.id, date);
      const stock = confirmStock(r.id, date);
      const order = sums[r.key] || 0;
      const enough = stock >= order;
      const gap = round(stock - order);
      return `<tr>
        <td class="who">${esc(r.label)}</td>
        <td>${fmt(b.opening || 0)}</td>
        <td>
          <div class="in-sum">
            <strong>${fmt(b.inbound || 0)}</strong> ${esc(sku.unit)}
            <p class="in-lots">${esc(lotLabel(b))}</p>
          </div>
        </td>
        <td>
          <div class="ha-process inbound-qty">
            <input class="cell-in inbound-in" data-in-sku="${r.id}" type="text" inputmode="decimal" autocomplete="off" value="" placeholder="本批" aria-label="${esc(r.label)} 本批進貨" />
            <button type="button" class="tiny-btn" data-add-in-sku="${r.id}">記入</button>
          </div>
        </td>
        <td><strong>${fmt(stock)}</strong> ${esc(sku.unit)}</td>
        <td>${fmt(order)}</td>
        <td class="${enough ? "ok" : "bad"}">${order ? (enough ? `夠（多 ${fmt(gap)}）` : `不夠（差 ${fmt(-gap)}）`) : "—"}</td>
      </tr>`;
    })
    .join("");
  box.innerHTML = `<h3>當天進貨（對庫存）</h3>
    <p class="hint">進貨可分批記入，合計會累加。10:00 是作業時間，系統不會鎖死不能填。</p>
    <div class="sheet-scroll">
      <table class="daily-grid inbound-table">
        <thead><tr><th>品項</th><th>前一日盤點</th><th>今日已進貨</th><th>本批進貨</th><th>可確認庫存</th><th>本表叫貨</th><th>庫存 vs 訂單</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}
function refreshInboundCompare() {
  const box = document.getElementById("leaf-inbound");
  if (!box || box.hidden) return;
  if (!box.querySelector("[data-in-sku]")) {
    renderLeafInbound();
    return;
  }
  const date = sheetDate();
  const { sums } = gridQtySums();
  const keys = { "sl-zhi": "slZhi", "sl-fang": "slFang" };
  box.querySelectorAll("[data-in-sku]").forEach((input) => {
    const id = input.dataset.inSku;
    const sku = skuById(id);
    const b = bookRow(id, date);
    const stock = confirmStock(id, date);
    const order = sums[keys[id]] || 0;
    const enough = stock >= order;
    const gap = round(stock - order);
    const tds = input.closest("tr")?.children;
    if (!tds) return;
    if (tds[1]) tds[1].textContent = fmt(b.opening || 0);
    if (tds[2]) {
      tds[2].innerHTML = `<div class="in-sum"><strong>${fmt(b.inbound || 0)}</strong> ${sku ? esc(sku.unit) : ""}<p class="in-lots">${esc(lotLabel(b))}</p></div>`;
    }
    if (tds[4] && sku) tds[4].innerHTML = `<strong>${fmt(stock)}</strong> ${esc(sku.unit)}`;
    if (tds[5]) tds[5].textContent = fmt(order);
    if (tds[6]) {
      tds[6].className = enough ? "ok" : "bad";
      tds[6].textContent = order ? (enough ? `夠（多 ${fmt(gap)}）` : `不夠（差 ${fmt(-gap)}）`) : "—";
    }
  });
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
  const { book } = dailyBook(date);
  const names = gridCustomers();
  const cols = currentCols();
  const head = `<th>出貨對象</th>${cols.map((c) => `<th>${esc(c.label)}</th>`).join("")}`;
  const body = names.map((name, ri) => {
    const row = book[name] || {};
    if (formKind === "basil") migrateBasilDailyRow(row);
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
    return `<tr><td class="who">${esc(name)}${drop}</td>${cells}</tr>`;
  }).join("");
  const totals = cols.map((col) => {
    if (col.kind !== "qty") return "<td></td>";
    let n = 0;
    for (const name of names) n += Number((book[name] || {})[col.key]) || 0;
    return `<td>${n ? fmt(n) : ""}</td>`;
  }).join("");
  const gridClass = formKind === "basil" ? "daily-grid basil-grid" : "daily-grid";
  document.getElementById("daily-sheet").innerHTML =
    `<table class="${gridClass}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody><tfoot><tr><td class="who">合計</td>${totals}</tr></tfoot></table>`;
  renderLiveTotals();
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
      "鴻安：出貨對象請手打（打過的會出現在上方，可一鍵再選；名單旁 × 可移除）。上方填洋蔥數量，底部按確認輸入訂單（佔量）。出貨才扣現有庫存（已加工整理）。";
    formTitle.textContent = editing ? "修改數量" : "訂單輸入";
    formHint.textContent = "先手打或點常用出貨對象，再填紐西蘭／韓洋各規格數量。填完按確認，即佔量並列入排程。出貨才扣現有庫存（已加工整理）。";
    ordersHint.textContent = "可刪除訂單紀錄（刪除前會確認）。確認後已佔量，未出貨不扣庫。先填先佔。";
    cust.placeholder = "請輸入出貨對象";
    cust.readOnly = false;
    return;
  }
  const def = FORM_KINDS[formKind] || FORM_KINDS.leaf;
  intro.textContent =
    "穠全：在上方表格填當天叫貨數量，頂端總數即時加總。出貨對象預設小琳、欣儒，可自行新增；地瓜葉、九層塔、散賣名單分開，互不刪除。底部按「確認輸入訂單」即佔量並列排程。出貨才扣庫。";
  formTitle.textContent = editing ? "修改數量" : def.formTitle;
  formHint.textContent = def.formHint;
  ordersHint.textContent = "取消會紅線劃掉但留下；改過的前面有「改」。確認後已佔量，未出貨不扣庫。先填先佔。";
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
  document.querySelectorAll("[data-page]").forEach((b) => b.classList.toggle("on", b.dataset.page === page));
  document.getElementById("page-orders").hidden = page !== "orders";
  document.getElementById("page-plan").hidden = page !== "plan";
  document.getElementById("page-stock").hidden = page !== "stock";
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
  run(renderCustChips);
  run(renderDailyGrid);
  run(renderSheet);
  run(renderCheck);
  run(renderOrders);
  run(renderPlan);
  run(renderStock);
  run(renderCustomers);
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
    page = btn.dataset.page;
    render();
  };
});
document.querySelectorAll("[data-form]").forEach((btn) => {
  btn.onclick = () => {
    formKind = btn.dataset.form;
    render();
  };
});
document.getElementById("sheet").addEventListener("input", renderCheck);
document.getElementById("sheet").addEventListener("change", renderCheck);
document.getElementById("ship-date").value = today();
document.getElementById("daily-sheet-date").value = today();
document.getElementById("daily-sheet-date").addEventListener("change", () => {
  renderDailyGrid();
  renderLiveTotals();
  renderLeafInbound();
  renderCheck();
});
document.getElementById("daily-sheet").addEventListener("input", (e) => {
  const el = e.target.closest("[data-who][data-col]");
  if (!el) return;
  if (el.classList.contains("cell-in")) {
    const cleaned = el.value.replace(/[^\d.]/g, "");
    if (cleaned !== el.value) el.value = cleaned;
  }
  const date = document.getElementById("daily-sheet-date").value || today();
  const { data, book } = dailyBook(date);
  const row = dailyRow(book, el.dataset.who);
  if (formKind === "basil") migrateBasilDailyRow(row);
  row[el.dataset.col] = el.value;
  saveDailyStore(data);
  if (el.classList.contains("cell-in")) {
    const col = el.dataset.col;
    let n = 0;
    document.querySelectorAll(`#daily-sheet [data-col="${col}"]`).forEach((input) => {
      n += Number(input.value) || 0;
    });
    const cols = currentCols();
    const idx = cols.findIndex((c) => c.key === col);
    const cell = document.querySelector(`#daily-sheet tfoot td:nth-child(${idx + 2})`);
    if (cell) cell.textContent = n ? fmt(n) : "";
  }
  renderLiveTotals();
  refreshInboundCompare();
  renderCheck();
});
document.getElementById("daily-sheet").addEventListener("change", (e) => {
  const el = e.target.closest("[data-who][data-col]");
  if (!el) return;
  const date = document.getElementById("daily-sheet-date").value || today();
  const { data, book } = dailyBook(date);
  const row = dailyRow(book, el.dataset.who);
  if (formKind === "basil") migrateBasilDailyRow(row);
  row[el.dataset.col] = el.value;
  saveDailyStore(data);
  renderLiveTotals();
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

document.getElementById("orders").onclick = (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const o = state.orders.find((x) => x.id === btn.dataset.id);
  if (!o) return;
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
        if (sku?.onion) state.stock[sku.id].processed = round(state.stock[sku.id].processed + line.qty);
      }
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
    o.lines.forEach((l) => {
      const input = document.querySelector(`#sheet [data-sku="${l.skuId}"]`);
      if (input) input.value = Number(input.value || 0) + l.qty;
    });
    renderCheck();
    return;
  }
  if (btn.dataset.act === "ship") {
    const need = {};
    for (const line of o.lines) need[line.skuId] = (need[line.skuId] || 0) + line.qty;
    for (const [skuId, qty] of Object.entries(need)) {
      const sku = skuById(skuId);
      if (available(sku, o) < qty) {
        setStatus(`${sku.name} 可出不足，不能出貨。請先在庫存頁記入加工。`, true);
        return;
      }
    }
    for (const [skuId, qty] of Object.entries(need)) {
      const sku = skuById(skuId);
      if (sku.onion) state.stock[sku.id].processed = round(state.stock[sku.id].processed - qty);
    }
    o.status = "shipped";
    o.shippedOn = today();
    for (const skuId of Object.keys(need)) {
      const sku = skuById(skuId);
      if (!sku.onion) syncNqQty(sku);
    }
    save();
    setStatus("已出貨並扣可出庫存。", false);
    render();
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
  const date = today();
  const b = bookRow(skuId);
  const oh = onHand(sku);
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
  const b = bookRow(skuId);
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
  const b = bookRow(skuId);
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
  const b = bookRow(skuId);
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
function addProcessed(skuId, raw) {
  const n = Number(raw);
  if (!(n > 0)) return setStatus("加工數量必須大於 0", true);
  state.stock[skuId].processed = round((state.stock[skuId].processed || 0) + n);
  save();
  setStatus("已記入加工，現有庫存已增加。", false);
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
    const b = bookRow(t.dataset.morning);
    if (b.morningConfirmed) return;
    b.morning = t.value === "" ? "" : Math.max(0, Number(t.value) || 0);
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
  const morningBtn = e.target.closest("[data-confirm-morning]");
  if (morningBtn) {
    const id = morningBtn.dataset.confirmMorning;
    const input = document.querySelector(`[data-morning="${id}"]`);
    confirmMorningCount(id, input?.value);
    return;
  }
  const add = e.target.closest("[data-add-process]");
  if (add) {
    const input = document.querySelector(`[data-process="${add.dataset.addProcess}"]`);
    addProcessed(add.dataset.addProcess, input?.value);
    return;
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
  const input = e.target.closest("[data-process]");
  if (!input) return;
  e.preventDefault();
  addProcessed(input.dataset.process, input.value);
});
document.getElementById("fill-count").onclick = () => {
  const missing = [];
  for (const row of NQ_INBOUND) {
    const input = document.querySelector(`[data-morning="${row.id}"]`);
    const raw = input ? input.value : bookRow(row.id).morning;
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
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  pollCloud();
  if (ensureTodayBooks()) {
    syncAllNqQty();
    save();
    render();
  }
});

function bundleHasData(b) {
  if (!b || typeof b !== "object") return false;
  if (Array.isArray(b.orders?.orders) && b.orders.orders.length) return true;
  if (b.orders?.daily && Object.keys(b.orders.daily).length) return true;
  if (b.dailySheet && Object.keys(b.dailySheet).length) return true;
  const nq = b.nqCustomers;
  if (nq && (nq.leaf?.length || nq.basil?.length || nq.herb?.length)) return true;
  if (Array.isArray(b.haCustomers) && b.haCustomers.length) return true;
  const stock = b.orders?.stock;
  if (stock) {
    for (const row of Object.values(stock)) {
      if ((row?.qty || 0) || (row?.processed || 0) || (row?.safety || 0)) return true;
    }
  }
  return false;
}
function localHasData() {
  if (state.orders.length) return true;
  if (state.daily && Object.keys(state.daily).length) return true;
  try {
    if (Object.keys(JSON.parse(localStorage.getItem(DAILY_KEY) || "{}")).length) return true;
  } catch (_) {}
  const nq = loadNqLists();
  if (nq.leaf.length || nq.basil.length || nq.herb.length) return true;
  if (loadHaCustomers().length) return true;
  for (const row of Object.values(state.stock || {})) {
    if ((row?.qty || 0) || (row?.processed || 0) || (row?.safety || 0)) return true;
  }
  return false;
}
function collectBundle() {
  return {
    updatedAt: Date.now(),
    orders: { stock: state.stock, orders: state.orders, daily: state.daily || {} },
    nqCustomers: loadNqLists(),
    haCustomers: loadHaCustomers(),
    dailySheet: dailyStore(),
  };
}
function applyBundle(b) {
  skipCloud = true;
  try {
    if (b.orders && b.orders.stock && Array.isArray(b.orders.orders)) {
      state.stock = b.orders.stock;
      state.orders = b.orders.orders;
      state.daily = b.orders.daily || {};
      for (const sku of SKUS) {
        if (!state.stock[sku.id]) state.stock[sku.id] = { qty: 0, processed: 0, safety: 0 };
      }
      if (!state.daily) state.daily = {};
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
async function pushCloud() {
  if (skipCloud) return false;
  const bundle = collectBundle();
  writeSyncAt(bundle.updatedAt);
  const r = await fetch(CLOUD_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(bundle),
  });
  const type = r.headers.get("content-type") || "";
  if (!r.ok || !type.includes("json")) throw new Error("no-cloud");
  return true;
}
async function bootCloudSync() {
  try {
    const remote = await pullCloud();
    const remoteAt = Number(remote.updatedAt) || 0;
    const localAt = readSyncAt();
    if (bundleHasData(remote) && remoteAt >= localAt) applyBundle(remote);
    else if (localHasData() && (!bundleHasData(remote) || localAt > remoteAt)) await pushCloud();
    cloudReady = true;
    skipCloud = false;
    setSyncNote("手機與電腦共用同一份資料。改完後另一台重新打開或等幾秒就會對上。");
    render();
  } catch (_) {
    cloudReady = false;
    skipCloud = true;
    setSyncNote("現在還不能跨裝置同步：網站仍是靜態頁。請把 Render 改成 Web Service（啟動指令 node server.js）後再打開這個網址。");
  }
}
async function pollCloud() {
  if (!cloudReady) return;
  try {
    const remote = await pullCloud();
    const remoteAt = Number(remote.updatedAt) || 0;
    if (remoteAt > readSyncAt() && bundleHasData(remote)) {
      applyBundle(remote);
      render();
    }
  } catch (_) {}
}

ensureHaHistory();
render();
bootCloudSync();
setInterval(pollCloud, 8000);
