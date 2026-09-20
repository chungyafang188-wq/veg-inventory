const NQ_DEFAULT_CUSTOMERS = ["小琳", "欣儒"];
const NQ_CUST_KEY = "nongquan-customer-lists-v2";
const NQ_CUST_KEY_OLD = "nongquan-customer-list-v1";
const KEY = "nongquan-hongan-orders-v1";
const PACK_OPTS = ["籃裝", "箱裝"];
const BAN_QUICK = [1, 2, 3];
const BAN_SELECT_MAX = 10;
const BAN_CN = { 1: "一版", 2: "兩版", 3: "三版" };
const VENDOR_OPTS = ["芳", "琳", "其他"];
const LEAF_VENDOR_OPTS = ["誌", "芳"];
const VENDOR_PENDING = "待定";
/** 版數（較貨先叫幾版）；legacy `ban: "一版"|"兩版"` 一併讀取 */
function lineBanQty(l) {
  if (!l) return 0;
  const n = Number(l.banQty);
  if (Number.isFinite(n) && n > 0) return round(n);
  const legacy = String(l.ban || "").trim();
  if (legacy === "一版") return 1;
  if (legacy === "兩版") return 2;
  const m = legacy.match(/^(\d+(?:\.\d+)?)\s*版?$/);
  if (m) {
    const v = Number(m[1]);
    if (Number.isFinite(v) && v > 0) return round(v);
  }
  return 0;
}
function lineBanText(l) {
  const n = lineBanQty(l);
  return n > 0 ? `${fmt(n)}版` : "";
}
/** 有品項：已填件數，或先下版數（件數後填） */
function lineHasItem(l) {
  return !!(l && l.skuId && (Number(l.qty) > 0 || lineBanQty(l) > 0));
}
/** 件數顯示：有填就顯示數字；僅在件數空且有版數時才「後填」 */
function lineQtyText(l) {
  const q = Number(l?.qty);
  if (Number.isFinite(q) && q > 0) return fmt(q);
  return lineBanQty(l) > 0 ? "後填" : fmt(0);
}
function applyBanQty(line, banQty) {
  const n = Number(banQty);
  if (Number.isFinite(n) && n > 0) line.banQty = round(n);
  else delete line.banQty;
  delete line.ban;
  return line;
}
function readFormBanQty(row) {
  const n = Number(row?.querySelector("[data-line-ban]")?.value);
  return Number.isFinite(n) && n > 0 ? round(n) : 0;
}
function focusLineBanOrQty(row) {
  if (!row) return;
  const ban = row.querySelector("[data-line-ban]");
  if (ban) {
    ban.focus();
    if (ban.tagName !== "SELECT" && typeof ban.select === "function") ban.select();
    return;
  }
  const qty = row.querySelector("[data-line-qty]");
  if (qty) {
    qty.focus();
    if (typeof qty.select === "function") qty.select();
  }
}
function banQuickLabel(n) {
  return BAN_CN[n] || `${n}版`;
}
function qtyFieldValue(qty) {
  const q = Number(qty);
  return Number.isFinite(q) && q > 0 ? q : "";
}
function qtyFieldPlaceholder(_banQty) {
  return "後填";
}
function banSelectHtml(optsOrValue, maybeId) {
  const opts =
    optsOrValue && typeof optsOrValue === "object"
      ? optsOrValue
      : { key: "line-ban", id: maybeId || "form", value: optsOrValue };
  const key = opts.key || "line-ban";
  const id = opts.id != null ? opts.id : "form";
  const cur = Number(opts.value);
  const selected = Number.isFinite(cur) && cur > 0 ? round(cur) : 0;
  const max = Math.max(BAN_SELECT_MAX, selected);
  const options = [`<option value="">（空白）</option>`];
  for (let n = 1; n <= max; n++) {
    options.push(`<option value="${n}"${selected === n ? " selected" : ""}>${n}版</option>`);
  }
  return `<select class="book-input line-ban-select" data-${key}="${esc(String(id))}" aria-label="${esc(opts.aria || "版數")}">${options.join("")}</select>`;
}
function banQuickHtml(banQty, attrHtml = 'data-k="ban-quick"') {
  return BAN_QUICK.map((n) => {
    const on = Number(banQty) === n ? " on" : "";
    return `<button type="button" class="pick ban-quick${on}" ${attrHtml} data-v="${n}" tabindex="0">${banQuickLabel(n)}</button>`;
  }).join("");
}
function syncFormQtyPlaceholder(row = document.querySelector("#ha-lines .item-line")) {
  if (!row) return;
  const qty = row.querySelector("[data-line-qty]");
  if (!qty) return;
  const ban = Number(row.querySelector("[data-line-ban]")?.value) || 0;
  const filled = Number(qty.value) > 0;
  // 有件數時不蓋掉顯示；僅空值時用 placeholder 提示
  qty.placeholder = filled ? "" : qtyFieldPlaceholder(ban);
}
const FORM_KINDS = {
  leaf: {
    label: "地瓜葉",
    title: "穠全 地瓜葉出貨",
    formTitle: "填寫地瓜葉出貨數量",
    hint: "手打或點出貨對象，選裝箱（籃裝／箱裝）。廠商在理貨時再選誌／芳並回寫訂單。無叫貨按「今日無叫貨」。",
    formHint: "地瓜葉：數量＋裝箱；廠商於理貨指定。",
    skuIds: ["sl-pend", "sl-zhi", "sl-fang"],
    cols: [
      { key: "slPend", label: "地瓜葉", kind: "qty" },
      { key: "pack", label: "裝箱樣式", kind: "pack" },
    ],
  },
  basil: {
    label: "九層塔",
    title: "穠全 九層塔出貨",
    formTitle: "填寫九層塔出貨數量",
    hint: "手打或點出貨對象，選紅骨／綠骨。廠商在理貨時再選芳／琳／其他並回寫訂單。無叫貨按「今日無叫貨」。",
    formHint: "九層塔：紅骨／綠骨＋數量；廠商於理貨指定。",
    skuIds: ["rb-pend", "rb-fang", "rb-lin", "rb-oth", "gb-pend", "gb-fang", "gb-lin", "gb-oth"],
    cols: [
      { key: "rb", label: "紅骨", kind: "qty" },
      { key: "gb", label: "綠骨", kind: "qty" },
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
const LAYOUT_MODE_KEY = "veg-layout-mode-v1";
const STAFF_LIST_KEY = "nongquan-staff-list-v1";
const ADDR_KEY = "nongquan-ship-addr-v1";
const FREIGHT_RUN_KEY = "nongquan-freight-run-v1";
const SHIP_PRESETS = ["冰庫", "市場", "倉庫"];
const SHIP_DEST_OPTS = ["冰庫", "市場", "倉庫", "寄貨運", "其他"];
const FREIGHT_RUN_DEFAULT = [
  { key: "美女貨運", recv: "03:30", ship: "04:30", note: "" },
  { key: "小洋貨運", recv: "04:00", ship: "05:00", note: "" },
  { key: "北部拍賣（金芳／新豐）", recv: "05:00", ship: "06:00", note: "" },
  { key: "南部拍賣（金芳／新豐）", recv: "05:30", ship: "06:30", note: "" },
  { key: "台中（新豐）", recv: "06:00", ship: "07:00", note: "" },
];
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
  "rb-pend": { qty: "rb", val: VENDOR_PENDING },
  "gb-pend": { qty: "gb", val: VENDOR_PENDING },
};
function isVendorPendingSku(skuId) {
  return skuId === "sl-pend" || skuId === "rb-pend" || skuId === "gb-pend" || !!skuById(skuId)?.vendorPending;
}
function leafVendorSku(vendor) {
  if (vendor === "誌") return "sl-zhi";
  if (vendor === "芳") return "sl-fang";
  return "sl-pend";
}
function basilVendorSku(kind, vendor) {
  const k = kind === "gb" ? "gb" : "rb";
  if (VENDOR_OPTS.includes(vendor)) return BASIL_SKU[k][vendor];
  return `${k}-pend`;
}
function resolveVendorSku(fromSkuId, vendor) {
  if (fromSkuId === "sl-pend" || fromSkuId === "sl-zhi" || fromSkuId === "sl-fang") return leafVendorSku(vendor);
  const b = BASIL_REV[fromSkuId];
  if (b) return basilVendorSku(b.qty, vendor);
  if (fromSkuId === "rb-pend") return basilVendorSku("rb", vendor);
  if (fromSkuId === "gb-pend") return basilVendorSku("gb", vendor);
  return fromSkuId;
}
function vendorOptsForSku(skuId) {
  if (skuId === "sl-pend" || skuId === "sl-zhi" || skuId === "sl-fang") return LEAF_VENDOR_OPTS;
  if (skuId === "rb-pend" || skuId === "gb-pend" || BASIL_REV[skuId]) return VENDOR_OPTS;
  return [];
}
const OLD_LEAF = {
  "sl-b-zhi": { id: "sl-zhi", pack: "籃裝" },
  "sl-x-zhi": { id: "sl-zhi", pack: "箱裝" },
  "sl-b-fang": { id: "sl-fang", pack: "籃裝" },
  "sl-x-fang": { id: "sl-fang", pack: "箱裝" },
};
const CAB_SPECS = ["硬種", "奧奇那", "228", "633", "半軟", "全軟"];
const CAB_LEAF_TYPES = ["綠葉", "撥白"];
const NAP_SPECS = ["箱裝", "袋裝"];
/** 出貨倉（訂單明細） */
const SHIP_WH_OPTS = ["穠全(A倉)", "二崙(B倉)", "大庄", "油一", "油二", "油三", "周"];
/** 舊存檔出貨倉 → 新顯示值 */
const SHIP_WH_ALIASES = {
  穠全: "穠全(A倉)",
  二崙: "二崙(B倉)",
};
const HA_VEG = {
  cab: { label: "高麗菜", opts: [["kr", "韓國"], ["vn", "越南"], ["id", "印尼"]], optLab: "國別" },
  nap: { label: "大白菜", opts: [["kr", "韓國"], ["vn", "越南"], ["id", "印尼"]], optLab: "國別" },
  bur: { label: "牛蒡", opts: [["l", "L"], ["2l", "2L"]] },
  wk: { label: "白K", opts: [["m", "M"], ["l", "L"], ["2l", "2L"], ["cut", "切頭"]] },
  ice: { label: "美生菜", opts: [["vn", "越南"], ["kr", "韓國"]] },
  cel: { label: "西芹", opts: [["vn", "越南"], ["us", "美國"]] },
  bro: { label: "青花", opts: [["vn", "越南"]] },
  chili: { label: "辣椒", opts: [["lg", "大辣"], ["sm", "小辣"]] },
};
function cabSpecOf(v) {
  const s = String(v || "").trim();
  return CAB_SPECS.includes(s) ? s : CAB_SPECS[0];
}
function cabLeafTypeOf(v) {
  const s = String(v || "").trim();
  return CAB_LEAF_TYPES.includes(s) ? s : CAB_LEAF_TYPES[0];
}
function napSpecOf(v) {
  const s = String(v || "").trim();
  return NAP_SPECS.includes(s) ? s : NAP_SPECS[0];
}
function cabVarietySelectHtml(cur) {
  return `<select class="cab-spec-sel" data-cab-spec aria-label="高麗菜品種">${optsHtml(CAB_SPECS, cabSpecOf(cur))}</select>`;
}
function isCabSku(skuId) {
  return skuById(skuId)?.vegFam === "cab";
}
function isNapSku(skuId) {
  return skuById(skuId)?.vegFam === "nap";
}
function haVegSkuId(fam, opt) {
  return `veg-${fam}-${opt}`;
}
function haVegSkuName(fam, optLab) {
  const def = HA_VEG[fam];
  if (!def) return optLab;
  if (def.nameStyle === "paren") return `${def.label}(${optLab})`;
  return `${def.label}／${optLab}`;
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
        name: haVegSkuName(fam, lab),
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
  const aria = def.optLab || "規格";
  const bits = [`<select data-veg-opt aria-label="${esc(def.label)}${esc(aria)}">${opts}</select>`];
  if (fam === "cab") {
    bits.push(
      `<select data-cab-leaf aria-label="高麗菜規格">${optsHtml(CAB_LEAF_TYPES, cabLeafTypeOf(rec.leafType))}</select>`,
    );
    bits.push(cabVarietySelectHtml(rec.spec));
  }
  if (fam === "nap") {
    bits.push(`<select data-nap-spec aria-label="大白菜規格">${optsHtml(NAP_SPECS, napSpecOf(rec.spec))}</select>`);
  }
  return bits.join("");
}
const SKUS = [
  { id: "sl-pend", co: "nq", name: "本產蔬菜－地瓜葉／待定", unit: "籃", packRemark: true, vendorPending: true, trade: true },
  { id: "sl-zhi", co: "nq", name: "本產蔬菜－地瓜葉／誌", unit: "籃", packRemark: true },
  { id: "sl-fang", co: "nq", name: "本產蔬菜－地瓜葉／芳", unit: "籃", packRemark: true },
  { id: "rb-pend", co: "nq", name: "紅骨九層塔／待定", unit: "箱", vendorPending: true, trade: true },
  { id: "rb-fang", co: "nq", name: "紅骨九層塔／芳", unit: "箱" },
  { id: "rb-lin", co: "nq", name: "紅骨九層塔／琳", unit: "箱" },
  { id: "rb-oth", co: "nq", name: "紅骨九層塔／其他", unit: "箱" },
  { id: "gb-pend", co: "nq", name: "綠骨九層塔／待定", unit: "箱", vendorPending: true, trade: true },
  { id: "gb-fang", co: "nq", name: "綠骨九層塔／芳", unit: "箱" },
  { id: "gb-lin", co: "nq", name: "綠骨九層塔／琳", unit: "箱" },
  { id: "gb-oth", co: "nq", name: "綠骨九層塔／其他", unit: "箱" },
  { id: "mint-kg", co: "nq", name: "薄荷散賣kg", unit: "kg" },
  { id: "shiso-kg", co: "nq", name: "紫蘇散賣kg", unit: "kg" },
  { id: "basil-kg", co: "nq", name: "九層塔散賣kg", unit: "kg" },
  { id: "shiso-jin", co: "nq", name: "紫蘇散賣斤", unit: "斤" },
  { id: "custom-nq", co: "nq", name: "自行輸入", unit: "件", trade: true, custom: true },
  ...haVegSkuList(),
  { id: "custom-ha", co: "ha", name: "自行輸入", unit: "件", trade: true, custom: true },
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
  { id: "pk-mi-25", co: "ha", name: "南瓜／密本／25K", unit: "箱", site: true },
  { id: "pk-mi-x", co: "ha", name: "南瓜／密本／其他", unit: "箱", site: true },
  { id: "pk-ch-18", co: "ha", name: "南瓜／阿成／18K", unit: "箱", site: true },
  { id: "pk-ch-20", co: "ha", name: "南瓜／阿成／20K", unit: "箱", site: true },
  { id: "pk-ch-25", co: "ha", name: "南瓜／阿成／25K", unit: "箱", site: true },
  { id: "pk-ch-x", co: "ha", name: "南瓜／阿成／其他", unit: "箱", site: true },
  { id: "pk-oth-18", co: "ha", name: "南瓜／其他／18K", unit: "箱", site: true },
  { id: "pk-oth-20", co: "ha", name: "南瓜／其他／20K", unit: "箱", site: true },
  { id: "pk-oth-25", co: "ha", name: "南瓜／其他／25K", unit: "箱", site: true },
  { id: "pk-oth-x", co: "ha", name: "南瓜／其他／其他", unit: "箱", site: true },
  { id: "pk-b-18", co: "ha", name: "南瓜／Ｂ級／18K", unit: "箱", site: true },
  { id: "pk-b-20", co: "ha", name: "南瓜／Ｂ級／20K", unit: "箱", site: true },
  { id: "pk-b-25", co: "ha", name: "南瓜／Ｂ級／25K", unit: "箱", site: true },
  { id: "pk-b-kg", co: "ha", name: "南瓜／Ｂ級／其他", unit: "kg", site: true },
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
  "np-id": "veg-nap-id",
  "veg-nap-box": "veg-nap-kr",
  "veg-nap-bag": "veg-nap-kr",
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
      const prevId = line.skuId;
      const next = remapSkuId(line.skuId);
      if (next !== line.skuId) {
        line.skuId = next;
        changed = true;
      }
      if (prevId === "veg-nap-bag" && !NAP_SPECS.includes(String(line.spec || ""))) {
        line.spec = "袋裝";
        changed = true;
      } else if (prevId === "veg-nap-box" && !NAP_SPECS.includes(String(line.spec || ""))) {
        line.spec = "箱裝";
        changed = true;
      }
      if (isNapSku(line.skuId) && !NAP_SPECS.includes(String(line.spec || ""))) {
        line.spec = napSpecOf(line.spec);
        changed = true;
      }
      if (line.labelName && skuById(line.skuId) && !/[\u4e00-\u9fff]/.test(String(line.labelName))) {
        delete line.labelName;
        changed = true;
      }
      if (isCabSku(line.skuId)) {
        if (!CAB_LEAF_TYPES.includes(String(line.leafType || ""))) {
          line.leafType = cabLeafTypeOf(line.leafType);
          changed = true;
        }
        const sp = String(line.spec || "").trim();
        if (sp && !CAB_SPECS.includes(sp)) {
          line.spec = cabSpecOf(sp);
          changed = true;
        } else if (!sp) {
          line.spec = CAB_SPECS[0];
          changed = true;
        }
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
      if (!data.prep || typeof data.prep !== "object") data.prep = {};
      if (!data.stockCount || typeof data.stockCount !== "object") data.stockCount = {};
      if (!data.wareItems || typeof data.wareItems !== "object") data.wareItems = {};
      if (!Array.isArray(data.unpackJobs)) data.unpackJobs = [];
      if (!Array.isArray(data.inboundLedger)) data.inboundLedger = [];
      if (!Array.isArray(data.unpackApprovals)) data.unpackApprovals = [];
      if (!Array.isArray(data.importCabinets)) data.importCabinets = [];
      if (!Array.isArray(data.importArrivals)) data.importArrivals = [];
      if (!Array.isArray(data.importReleased)) data.importReleased = [];
      if (!Array.isArray(data.siteMoves)) data.siteMoves = [];
      if (!Array.isArray(data.siteWorks)) data.siteWorks = [];
      if (!Array.isArray(data.auditLog)) data.auditLog = [];
      return data;
    }
  } catch (_) {}
  return {
    stock: emptyStock(),
    orders: [],
    daily: {},
    rests: [],
    prep: {},
    stockCount: {},
    wareItems: {},
    unpackJobs: [],
    inboundLedger: [],
    unpackApprovals: [],
    importCabinets: [],
    importArrivals: [],
    importReleased: [],
    siteMoves: [],
    siteWorks: [],
    auditLog: [],
  };
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
if (!state.stockCount || typeof state.stockCount !== "object") state.stockCount = {};
if (!state.wareItems || typeof state.wareItems !== "object") state.wareItems = {};
if (!Array.isArray(state.unpackJobs)) state.unpackJobs = [];
if (!Array.isArray(state.inboundLedger)) state.inboundLedger = [];
if (!Array.isArray(state.unpackApprovals)) state.unpackApprovals = [];
if (!Array.isArray(state.importCabinets)) state.importCabinets = [];
if (!Array.isArray(state.importArrivals)) state.importArrivals = [];
if (!Array.isArray(state.importReleased)) state.importReleased = [];
if (!Array.isArray(state.siteMoves)) state.siteMoves = [];
if (!Array.isArray(state.siteWorks)) state.siteWorks = [];
if (!Array.isArray(state.auditLog)) state.auditLog = [];
const seeded = ensureTodayBooks();
const recounted = recountAllBooks();
syncAllNqQty();
if (migrated || seeded || recounted) save();

let co = "nq";
let page = "home";
let hubDept = "";
let hubOpen = "";
/** 銷貨工作區：orders｜ware｜acct（對齊進口三欄） */
let hubSalesBlock = "orders";
/** 銷貨殼內目前子頁（空＝只顯示工作區目錄） */
let hubSalesPane = "";
/** DOM 暫掛：把功能頁搬進銷貨工作區時還原用 */
let salesMount = null;
let helpFilter = "issues";
let helpResult = null;
const LABEL_RUN_KEY = "veg-label-run-v1";
const LABEL_PRINTS_KEY = "veg-label-prints-v1";
let labelPrintFilterKind = "all";
let labelSel = new Set();
let labelDayLock = "";
let labelKind = "text";
let labelText = "南瓜";
let labelTextRemark = "";
let labelSolarOn = false;
let labelSeqOn = false;
let labelShipCust = "";
let labelShipSku = "南瓜";
let labelPendingOrder = null;
let shipLabelPick = null;
let labelContName = "高麗菜";
let labelContCountry = "韓國";
let labelContVendor = "";
let labelContNo = "";
let booksPart = "stock";
let stockWh = "";
let stockPhase = "pick";
let formKind = "leaf";
let stockKind = "leaf";
let editing = "";
let inlineEdit = null;
let orderMulti = null;
let ordersTodayQ = "";
let ordersTodaySearchTimer = 0;
const ORDERS_TODAY_SEARCH_MS = 300;
let ordersPane = "form";
let ordersPaneLock = false;
let inPane = "form";
let inPaneLock = false;
let rackPane = "frame";
let rackPick = "";
let rackLine = "";
let rackSrc = "";
let rackHide = new Set();
let rackQ = "";
let rackCo = "";
let rackMode = "asof";
let rackFrom = "";
let rackTo = today();
let rackPrior = true;
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
let planFocusKey = "";
const PLAN_ZONE_FOLD_KEY = "veg-plan-zone-fold-v1";
function planZoneFoldState() {
  try {
    const raw = JSON.parse(localStorage.getItem(PLAN_ZONE_FOLD_KEY) || "{}");
    return { prep: !!raw.prep, orders: !!raw.orders, all: !!raw.all };
  } catch {
    return { prep: false, orders: false, all: false };
  }
}
function planZoneCollapsed(id) {
  return !!planZoneFoldState()[id];
}
function setPlanZoneFold(id, collapsed) {
  if (id !== "prep" && id !== "orders" && id !== "all") return;
  const st = planZoneFoldState();
  st[id] = !!collapsed;
  try {
    localStorage.setItem(PLAN_ZONE_FOLD_KEY, JSON.stringify(st));
  } catch {
    /* ignore quota */
  }
}
function planZoneWrapClass(id) {
  return planZoneCollapsed(id) ? " is-collapsed" : "";
}
function planZoneBodyAttrs(id) {
  return planZoneCollapsed(id) ? " hidden" : "";
}
function planZoneHeadHtml({ id, labId, lab, toneClass, statHtml, subHtml }) {
  const open = !planZoneCollapsed(id);
  return `<header class="plan-zone-head ${toneClass || ""}">
    <button type="button" class="plan-zone-toggle" data-plan-fold="${esc(id)}" aria-expanded="${open ? "true" : "false"}" aria-controls="plan-zone-body-${esc(id)}">
      <span class="plan-zone-chev" aria-hidden="true"></span>
      <span class="plan-zone-copy">
        <span class="plan-zone-title">
          <h3 ${labId ? `id="${esc(labId)}"` : ""} class="plan-zone-lab">${lab}</h3>
          ${statHtml || ""}
        </span>
        ${subHtml ? `<span class="plan-zone-sub">${subHtml}</span>` : ""}
      </span>
    </button>
  </header>`;
}
/** Keys of vendor rows currently expanded for「修改」(day|cust|sku|pack). */
const planVendorEditKeys = new Set();
function planVendorEditKey(day, customer, skuId, pack) {
  return `${day}|${customer}|${skuId}|${pack || ""}`;
}
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
  const mapped = remapSkuId(id);
  return SKUS.find((s) => s.id === mapped) || (mapped !== id ? SKUS.find((s) => s.id === id) : undefined);
}
/** Prefer Chinese catalog name; ignore English / sku-code labelName on known SKUs (e.g. 大白菜). */
function lineSkuName(l) {
  const s = skuById(l?.skuId);
  const label = String(l?.labelName || "").trim();
  if (s) {
    if (!label) return s.name;
    if (!/[\u4e00-\u9fff]/.test(label)) return s.name;
    return label;
  }
  if (label) return label;
  const raw = String(l?.skuId || "").trim();
  const mapped = remapSkuId(raw);
  if (mapped !== raw) {
    const again = SKUS.find((x) => x.id === mapped);
    if (again) return again.name;
  }
  return raw;
}
function isSiteSku(sku) {
  return !!(sku && (sku.site || sku.onion));
}
function isTradeSku(sku) {
  return !!(sku && sku.trade);
}

/** 貨櫃倉碼 → 顯示（盤點／入單只分 A倉／B倉／油） */
const HA_WAREHOUSES = {
  A: "A倉",
  B: "B倉",
  C: "油",
  D: "油",
  E: "油",
  F: "油",
  G: "油",
  Y: "油",
  K: "烘庫",
};
/** 庫存盤點倉庫別 */
const STOCK_WAREHOUSES = [
  { id: "A", label: "A倉" },
  { id: "B", label: "B倉" },
  { id: "Y", label: "油" },
  { id: "K", label: "烘庫" },
];
let formLot = null;
let lotPickCtx = null;

function warehouseLabel(code) {
  if (!code) return "未對倉";
  if (HA_WAREHOUSES[code]) return HA_WAREHOUSES[code];
  return `${code}倉`;
}
function stockWarehouseLabel(code) {
  const hit = STOCK_WAREHOUSES.find((w) => w.id === code);
  return hit ? hit.label : warehouseLabel(code);
}
function lineContainerNo(l) {
  return String(l?.containerNo || l?.contNo || "").trim();
}
function lineShipWh(l) {
  return shipWhOf(l?.shipWh || l?.outWh);
}
function shipWhOf(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (SHIP_WH_OPTS.includes(s)) return s;
  if (SHIP_WH_ALIASES[s]) return SHIP_WH_ALIASES[s];
  return "";
}
function applyShipMeta(line, containerNo, shipWh) {
  if (!line) return line;
  const cont = String(containerNo ?? lineContainerNo(line)).trim();
  if (cont) line.containerNo = cont;
  else delete line.containerNo;
  delete line.contNo;
  const wh = shipWhOf(shipWh ?? lineShipWh(line));
  if (wh) line.shipWh = wh;
  else delete line.shipWh;
  delete line.outWh;
  return line;
}
function knownContainerNos() {
  const names = new Set();
  const add = (v) => {
    const s = String(v || "").trim();
    if (s) names.add(s);
  };
  for (const x of labelContNoPresets()) add(x);
  for (const o of state.orders || []) {
    for (const l of o.lines || []) {
      add(lineContainerNo(l));
      add(l.lotContainer);
      add(l.lotUha);
    }
  }
  for (const l of ticketLines || []) {
    add(lineContainerNo(l));
    add(l.lotContainer);
  }
  for (const j of state.unpackJobs || []) {
    add(j.box);
    add(j.reportBox);
    for (const c of j.codes || []) add(c);
  }
  try {
    for (const p of loadLabelPrints()) {
      if (p?.kind !== "container") continue;
      add(p.box);
      for (const c of p.codes || []) add(c);
    }
  } catch (_) {}
  return [...names].sort((a, b) => a.localeCompare(b, "zh-Hant"));
}
function containerNoDatalistHtml(listId) {
  const opts = knownContainerNos()
    .slice(0, 100)
    .map((v) => `<option value="${esc(v)}"></option>`)
    .join("");
  return `<datalist id="${esc(listId)}">${opts}</datalist>`;
}
/** 貨櫃編號（可打可選）＋出貨倉下拉；每個品項都有 */
function lineShipMetaFieldsHtml(rec = {}, opts = {}) {
  const listId = opts.listId || "line-cont-nos";
  const contAttr = opts.contAttr || "data-line-container-no";
  const whAttr = opts.whAttr || "data-line-ship-wh";
  const cont = lineContainerNo(rec);
  const wh = lineShipWh(rec);
  const withList = opts.includeList !== false;
  return `<div class="line-ship-meta${opts.compact ? " is-compact" : ""}" data-ship-meta-box>
    <label class="line-ship-field line-ship-cont"><span class="line-ship-lab">貨櫃編號／編號</span>
      <input type="text" list="${esc(listId)}" ${contAttr} value="${esc(cont)}" placeholder="填寫或下拉選取" autocomplete="off" aria-label="貨櫃編號／編號" />
    </label>
    ${withList ? containerNoDatalistHtml(listId) : ""}
    <label class="line-ship-field line-ship-wh"><span class="line-ship-lab">出貨倉</span>
      <select ${whAttr} aria-label="出貨倉">
        <option value="">（未選）</option>
        ${optsHtml(SHIP_WH_OPTS, wh)}
      </select>
    </label>
  </div>`;
}
function lineShipMetaText(l) {
  const bits = [];
  const cont = lineContainerNo(l);
  const wh = lineShipWh(l);
  if (cont) bits.push(cont);
  if (wh) bits.push(wh);
  return bits.join("・");
}
function withShipMeta(row, line) {
  if (!row || !line) return line;
  const cont = row.querySelector("[data-line-container-no]")?.value;
  const wh = row.querySelector("[data-line-ship-wh]")?.value;
  return applyShipMeta(line, cont, wh);
}
function withLineNote(row, line) {
  if (!row || !line) return line;
  const note = String(row.querySelector("[data-line-note]")?.value || "").trim();
  if (note) line.note = note;
  else delete line.note;
  return line;
}
function skuLotGroup(sku) {
  if (!sku) return "";
  if (sku.vegFam === "nap") return "nap";
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
  if (g === "nap") return allContainerLots().filter((l) => String(l.group || "").startsWith("nap"));
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
  { name: "凱琪", role: "acct" },
  { name: "宜淨", role: "acct" },
  { name: "子羽", role: "acct" },
  { name: "湯", role: "acct" },
  { name: "小胖", role: "driver" },
  { name: "善存", role: "driver" },
  { name: "阿宏", role: "unpacker" },
  { name: "靜宜", role: "unpacker" },
  { name: "雅芳", role: "boss" },
];
const ROLE_LABEL = {
  site: "現場",
  acct: "會計",
  driver: "司機",
  unpacker: "拆櫃人員",
  boss: "主管",
};
const UNPACK_STAFF = STAFF_ROSTER.filter((p) => p.role === "unpacker").map((p) => p.name);
function isUnpackerRole(role) {
  return (role || currentRole()) === "unpacker";
}
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
  // 進口／出口：目前僅雅芳（主管）
  if (action === "page-import" || action === "page-export") return false;
  // TEMP: 拆櫃/庫存/現場 未完成，暫僅雅芳 — 恢復時刪除此段，並還原下方 page-unpack / page-sitework / books-stock 規則
  if (action === "page-unpack" || action === "page-sitework" || action === "books-stock") {
    return false;
  }
  if (r === "unpacker") {
    return action === "page-unpack";
  }
  if (action === "page-stats") return false;
  if (action === "page-help") return true;
  if (action === "page-plan" || action === "view-ship") return r === "site" || r === "driver" || r === "acct";
  if (action === "page-orders" || action === "order" || action === "count" || action === "inbound" || action === "ship-books" || action === "edit" || action === "delete" || action === "cancel") {
    return r === "acct";
  }
  if (action === "page-books" || action === "books-in" || action === "books-sales") return r === "acct";
  // TEMP off: if (action === "page-unpack") return r === "site" || r === "acct" || r === "driver";
  if (action === "unpack-assign") return r === "site" || r === "acct";
  // TEMP off: if (action === "page-sitework") return r === "site" || r === "acct" || r === "driver";
  // TEMP off: if (action === "books-stock") return r === "acct";
  if (action === "sitework-create") return r === "site" || r === "acct";
  if (action === "sitework-take") return r === "driver" || r === "site" || r === "acct";
  if (action === "unpack-confirm") return r === "acct";
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
/** 全形數字→半形，並只留數字（避免手機輸入法造成密碼對了卻進不去） */
function normalizePin(v) {
  return String(v || "")
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/\D/g, "");
}
function rememberStaff(name) {
  const n = String(name || "").trim();
  if (!staffByName(n)) return false;
  try {
    localStorage.setItem(STAFF_NOW_KEY, n);
    return true;
  } catch (_) {
    return false;
  }
}
function hideLoginPin() {
  loginPinName = "";
  const pin = document.getElementById("login-pin");
  const people = document.getElementById("login-people");
  const err = document.getElementById("login-pin-err");
  const input = document.getElementById("login-pin-input");
  if (pin) {
    pin.hidden = true;
    delete pin.dataset.pinFor;
  }
  if (people) people.hidden = false;
  if (err) err.hidden = true;
  if (input) input.value = "";
}
function showLoginPin(name) {
  loginPinName = String(name || "").trim();
  const pin = document.getElementById("login-pin");
  const people = document.getElementById("login-people");
  const who = document.getElementById("login-pin-who");
  const err = document.getElementById("login-pin-err");
  const input = document.getElementById("login-pin-input");
  if (who) who.textContent = `請輸入${loginPinName}的主管密碼`;
  if (people) people.hidden = true;
  if (pin) {
    pin.hidden = false;
    pin.dataset.pinFor = loginPinName;
  }
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
  const n = String(name || "").trim();
  if (!rememberStaff(n)) {
    setStatus("登入失敗：找不到這位使用者，請重新整理後再試。", true);
    showLoginPin(n || "雅芳");
    return false;
  }
  loginPickerOpen = false;
  hideLoginPin();
  closeLoginGate();
  restoreSalesMount();
  page = homePage();
  hubDept = "";
  hubOpen = "";
  hubSalesBlock = "orders";
  hubSalesPane = "";
  render();
  return true;
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
  const form = document.getElementById("login-pin");
  const input = document.getElementById("login-pin-input");
  const err = document.getElementById("login-pin-err");
  const who = String(loginPinName || form?.dataset?.pinFor || "").trim();
  const pin = normalizePin(input?.value);
  if (!who || !staffNeedsPin(who)) {
    if (err) {
      err.hidden = false;
      err.textContent = "請先選「雅芳」，再輸入密碼。";
    }
    return;
  }
  loginPinName = who;
  if (pin === BOSS_PIN) {
    finishLogin(who);
    return;
  }
  if (err) {
    err.hidden = false;
    err.textContent = "密碼不對，請再試一次（請用半形數字 1227）。";
  }
  if (input) {
    input.value = "";
    input.focus();
  }
}
function homePage() {
  return "home";
}
function goHome() {
  restoreSalesMount();
  page = "home";
  hubDept = "";
  hubOpen = "";
  hubSalesBlock = "orders";
  hubSalesPane = "";
  render();
}
window.goHome = goHome;

function goUnpackPage() {
  if (!can("page-unpack")) {
    setStatus("拆櫃回報建置中，暫僅主管可進入。", true);
    return;
  }
  page = "unpack";
  hubDept = "import";
  hubOpen = "";
  render();
}
window.goUnpack = goUnpackPage;
function soonCopy(kind) {
  if (kind === "cust") return { title: "客戶", hint: "之後會放客戶資料、常用出貨對象與對帳。現在開單時直接填出貨對象即可。" };
  if (kind === "vendor") return { title: "廠商", hint: "之後會放進貨廠商與對帳。現在請到倉管的進貨記入。" };
  if (kind === "freight") return { title: "貨運核帳", hint: "之後會放貨運費用、對帳與核銷。目前先用司機送貨與出貨帳單核對。" };
  if (kind === "imp-status") return { title: "貨櫃狀況", hint: "到港待拆與放行追蹤（到港日）；已入庫請看拆櫃總明細（拆櫃日）。" };
  if (kind === "imp-buy") return { title: "進口採購", hint: "進口採購單與到貨追蹤建置中。" };
  if (kind === "imp-port") return { title: "貨櫃到港", hint: "日期＝到港日。櫃表有、尚未拆櫃入庫。" };
  if (kind === "imp-release") return { title: "進口資料放行", hint: "查驗完成＝放行＝待安排拆櫃（依 FT＋藥檢／煙燻結束時間）。日期＝到港日。" };
  if (kind === "imp-unpack-sum")
    return { title: "拆櫃總明細", hint: "日期＝拆櫃日。已拆櫃入公司倉庫。" };
  if (kind === "imp-stock") return { title: "進口庫存", hint: "日期＝拆櫃日。已入庫查詢。" };
  if (kind === "imp-broker") return { title: "報關行", hint: "報關行往來與費用對帳建置中。" };
  if (kind === "imp-vendor") return { title: "廠商", hint: "進口廠商資料與對帳建置中。" };
  if (kind === "imp-trailer") return { title: "拖車", hint: "拖車費用與調度對帳建置中。" };
  if (kind === "imp-labor") return { title: "拆工", hint: "拆櫃工資與工班對帳建置中。" };
  if (kind === "exp-order") return { title: "出口訂單", hint: "出口訂單建置中。" };
  if (kind === "exp-ship") return { title: "備貨出貨", hint: "出口備貨與出貨建置中。" };
  if (kind === "exp-label") return { title: "出口標籤", hint: "出口標籤印製建置中。" };
  if (kind === "exp-acct") return { title: "出口帳務", hint: "出口帳務建置中。" };
  return { title: "建置中", hint: "這項還在整理。" };
}
function hubSvg(name) {
  const d = {
    clip: '<rect x="6.5" y="3.5" width="11" height="17" rx="2.5"/><path d="M9.5 3.5h5v2.4h-5z"/><path d="M9.2 10h5.6M9.2 13.5h5.6M9.2 17h3.8"/>',
    house: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6.5 10.5V20h11V10.5"/>',
    form: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 13h6M9 17h4"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M5 6.2 6.2 7.5 8 5.2M5 12.2 6.2 13.5 8 11.2M5 18.2 6.2 19.5 8 17.2"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3.2v3.4M16 3.2v3.4M3.5 10.2h17"/><path d="M8 14h2.2M12 14h2.2M16 14h1.5M8 17.2h2.2M12 17.2h2.2"/>',
    truck: '<path d="M3 16h1.2a2.4 2.4 0 0 0 4.6 0h5.2a2.4 2.4 0 0 0 4.6 0H21v-4.2L18 8h-5v8"/><path d="M3 16V9h10"/><circle cx="7.5" cy="16.2" r="1.5"/><circle cx="17.3" cy="16.2" r="1.5"/>',
    box: '<path d="M3.5 8.2 12 4.2l8.5 4-8.5 4z"/><path d="M3.5 8.2v7.6L12 20l8.5-4.2V8.2M12 12.2V20"/>',
    inbox: '<path d="M12 4v10"/><path d="M8 10.5 12 15l4-4.5"/><path d="M4.5 20h15"/><path d="M5 16.5 4.5 20h15L19 16.5"/>',
    person: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.6-3.4 3.2-5.2 6.5-5.2s5.9 1.8 6.5 5.2"/>',
    shop: '<path d="M4 10V21h16V10"/><path d="M3 7.5 5.2 4h13.6L21 7.5a3.2 3.2 0 0 1-6.4 0 3.2 3.2 0 0 1-6.4 0A3.2 3.2 0 0 1 3 7.5z"/><path d="M10 21v-6h4v6"/>',
    bill: '<path d="M7 3.5h10l.8 2.4V20l-2.6-1.2L12 20l-3.2-1.2L6.2 20V5.9z"/><path d="M9.5 10h5M9.5 13.5h5"/>',
    crate: '<path d="M4 8h16v11H4z"/><path d="M4 8 7 4h10l3 4M12 8v11M4 13h16"/>',
    rack: '<path d="M4 5h16M4 12h16M4 19h16M6 5v14M18 5v14"/>',
    coin: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.4v9.2M9.4 9.2c.7-1 2.4-1.4 3.5-.4s.7 2.4-.6 3c-1.4.6-2.6.4-3.4 1.6-.6.9.1 2.4 2.1 2.6 1.5.2 2.8-.4 3.4-1.2"/>',
    chat: '<path d="M5 6.5h14v9.2H9.2L5 19.2z"/>',
    spark: '<path d="M12 3.2v2.8M12 18V20.8M3.2 12h2.8M18 12h2.8M6.2 6.2l2 2M15.8 15.8l2 2M17.8 6.2l-2 2M8.2 15.8l-2 2"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="1.15"/>',
    tag: '<path d="M4.8 11.2 11.2 4.8a2.2 2.2 0 0 1 1.6-.6H19a1.5 1.5 0 0 1 1.5 1.5v6.2a2.2 2.2 0 0 1-.6 1.6l-6.4 6.4a2 2 0 0 1-2.8 0L4.8 14a2 2 0 0 1 0-2.8z"/><circle cx="16.2" cy="7.8" r="1.35"/>',
  };
  const key = d[name] ? name : "clip";
  return `<span class="hub-ico hub-ico-${key}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${d[key]}</svg></span>`;
}
/** Soft colorful sticker cartoons for 首頁（訂貨／標籤／倉庫…） */
function hubPic(name) {
  const pics = {
    /* 訂貨區：娃娃蔬菜買菜（菜菜＋菜籃） */
    clip: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="#e6f6ea"/>
      <ellipse cx="24" cy="40.2" rx="11" ry="2.2" fill="#1a6843" opacity=".1"/>
      <path d="M19.2 12.2c1.1-3.8 4.6-5.8 7.8-4.6-1.2 2.8-.4 5.4 1.6 7.2-3.4.2-6.6-.6-9.4-2.6z" fill="#2f8a58"/>
      <path d="M26.8 8.2c2.2-1.4 5.2-.6 6.4 1.8-2 .6-3.6 2-4.4 4-1.8-1.6-2.4-3.6-2-5.8z" fill="#6bc48a"/>
      <circle cx="22.5" cy="24.5" r="9.2" fill="#f06a4a"/>
      <ellipse cx="19.2" cy="20.8" rx="2.4" ry="1.5" fill="#fff" opacity=".55"/>
      <circle cx="19.4" cy="23.2" r="1.55" fill="#163528"/>
      <circle cx="25.8" cy="23.2" r="1.55" fill="#163528"/>
      <circle cx="19.9" cy="22.7" r=".45" fill="#fff"/>
      <circle cx="26.3" cy="22.7" r=".45" fill="#fff"/>
      <path d="M20.2 27.2c1.4 1.5 3.4 1.5 4.8 0" stroke="#163528" stroke-width="1.25" stroke-linecap="round"/>
      <ellipse cx="16.6" cy="26.4" rx="1.7" ry="1.1" fill="#e84f35" opacity=".55"/>
      <ellipse cx="28.4" cy="26.4" rx="1.7" ry="1.1" fill="#e84f35" opacity=".55"/>
      <path d="M30.5 28.5c.4-2.2 2.4-3.4 4.6-2.8l.6 8.4c-2.4.8-4.6-.2-5.2-2.6z" fill="#c48a3a"/>
      <path d="M31.2 27.2h8.6l1.4 2.2h-1.2l-1.1 6.2c-.2 1.1-1.1 1.9-2.2 1.9H33c-1.1 0-2-.8-2.2-1.9l-1.1-6.2h-1z" fill="#f2c14b"/>
      <path d="M32.4 31.2h6.2M32.2 33.6h5.6" stroke="#d4a03a" stroke-width="1" stroke-linecap="round"/>
      <circle cx="34.2" cy="29.6" r="1.15" fill="#6bc48a"/>
      <circle cx="37.2" cy="30.2" r="1" fill="#f06a4a"/>
    </svg>`,
    /* 標籤印製：Q 版貼紙標籤 */
    tag: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="#e4f3f2"/>
      <path d="M11.5 23.5 22 13a3.2 3.2 0 0 1 2.3-1H34a2.4 2.4 0 0 1 2.4 2.4v9.7a3.2 3.2 0 0 1-1 2.3L25.1 36.8a2.8 2.8 0 0 1-4 0L11.5 27.2a2.8 2.8 0 0 1 0-3.7z" fill="#fff"/>
      <path d="M11.5 23.5 22 13a3.2 3.2 0 0 1 2.3-1H34a2.4 2.4 0 0 1 2.4 2.4v9.7a3.2 3.2 0 0 1-1 2.3L25.1 36.8a2.8 2.8 0 0 1-4 0L11.5 27.2a2.8 2.8 0 0 1 0-3.7z" stroke="#2a6f78" stroke-width="1.45"/>
      <circle cx="31.2" cy="18.2" r="2.5" fill="#5eb3b8"/>
      <circle cx="31.2" cy="18.2" r="1" fill="#fff" opacity=".7"/>
      <circle cx="20.2" cy="24" r="1.35" fill="#163528"/>
      <circle cx="25.6" cy="24" r="1.35" fill="#163528"/>
      <circle cx="20.6" cy="23.55" r=".4" fill="#fff"/>
      <circle cx="26" cy="23.55" r=".4" fill="#fff"/>
      <path d="M20.8 27.4c1.5 1.4 3.5 1.4 5 0" stroke="#163528" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M18.2 21.2c.7-.7 1.6-.7 2.2 0M25.2 21.2c.7-.7 1.6-.7 2.2 0" stroke="#2a6f78" stroke-width="1.1" stroke-linecap="round"/>
      <ellipse cx="17.6" cy="26.2" rx="1.5" ry=".9" fill="#f2a27a" opacity=".7"/>
      <ellipse cx="28.4" cy="26.2" rx="1.5" ry=".9" fill="#f2a27a" opacity=".7"/>
      <path d="M14.5 29.5c2.2 2.8 5.8 3.4 8.6 1.2" stroke="#6bc48a" stroke-width="1.55" stroke-linecap="round"/>
    </svg>`,
    /* 拆櫃回報：貨櫃車（不是紙箱） */
    box: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="#e7f2f0"/>
      <ellipse cx="24" cy="39.5" rx="14" ry="2" fill="#1a6843" opacity=".1"/>
      <rect x="7.5" y="16.5" width="22" height="14.5" rx="1.6" fill="#3d9a64"/>
      <rect x="7.5" y="16.5" width="22" height="3.2" fill="#2f8a58"/>
      <path d="M10.2 19.7v9.5M14.2 19.7v9.5M18.2 19.7v9.5M22.2 19.7v9.5M26.2 19.7v9.5" stroke="#8fd4a4" stroke-width="1.15" opacity=".85"/>
      <path d="M7.5 23.8h22M7.5 27.5h22" stroke="#2f8a58" stroke-width="1" opacity=".65"/>
      <path d="M29.5 22.5h6.8l3.7 5.2V31H29.5V22.5z" fill="#f2c14b"/>
      <path d="M29.5 22.5h5.2v5.4H29.5z" fill="#ffe9a8"/>
      <rect x="31.2" y="23.6" width="3.4" height="3.2" rx=".7" fill="#7ec8e0"/>
      <rect x="7.5" y="30.2" width="32.5" height="2.4" rx=".6" fill="#5a6170"/>
      <circle cx="14" cy="34.2" r="3.15" fill="#2a3430"/>
      <circle cx="14" cy="34.2" r="1.25" fill="#c5d0cb"/>
      <circle cx="33.2" cy="34.2" r="3.15" fill="#2a3430"/>
      <circle cx="33.2" cy="34.2" r="1.25" fill="#c5d0cb"/>
      <circle cx="36.5" cy="14.5" r="3.6" fill="#f2a27a"/>
      <path d="M35.2 14.3h2.6M36.5 13v2.6" stroke="#fff" stroke-width="1.35" stroke-linecap="round"/>
      <path d="M11 14.2c1.2-1.6 3.4-1.8 4.6-.2.9 1.2.4 2.6-1 3.1" stroke="#6bc48a" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`,
    /* 倉庫管理：倉庫＋菜箱 */
    crate: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="#e8f4f5"/>
      <path d="M9.5 22 24 11.5 38.5 22v14.5a2.5 2.5 0 0 1-2.5 2.5h-24a2.5 2.5 0 0 1-2.5-2.5V22z" fill="#fff"/>
      <path d="M9.5 22 24 11.5 38.5 22" stroke="#2a6f78" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M11 22.5h26v13.5a1.8 1.8 0 0 1-1.8 1.8H12.8a1.8 1.8 0 0 1-1.8-1.8V22.5z" fill="#d7ebea" stroke="#2a6f78" stroke-width="1.35"/>
      <rect x="20.2" y="27.5" width="7.6" height="10.3" rx="1.2" fill="#fff8e8" stroke="#c48a3a" stroke-width="1.2"/>
      <path d="M20.2 31.2h7.6" stroke="#c48a3a" stroke-width="1.1"/>
      <rect x="13.2" y="29.5" width="6.2" height="5.2" rx="1" fill="#f2a27a"/>
      <rect x="28.6" y="29.5" width="6.2" height="5.2" rx="1" fill="#6bc48a"/>
      <circle cx="16.3" cy="31.6" r=".7" fill="#fff" opacity=".7"/>
      <circle cx="31.7" cy="31.6" r=".7" fill="#fff" opacity=".7"/>
      <circle cx="24" cy="18.5" r="3.4" fill="#8fd4a4"/>
      <circle cx="22.7" cy="17.8" r=".7" fill="#163528"/>
      <circle cx="25.3" cy="17.8" r=".7" fill="#163528"/>
      <path d="M22.8 19.8c.7.7 1.7.7 2.4 0" stroke="#163528" stroke-width="1" stroke-linecap="round"/>
      <path d="M24 14.2v-1.6M22.2 14.8l-1.2-1.2M25.8 14.8l1.2-1.2" stroke="#2f8a58" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`,
    /* 現場工作：工作單＋安全帽 */
    cal: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="#f6f0e4"/>
      <rect x="12" y="14.5" width="20" height="24" rx="3.2" fill="#fff" stroke="#c48a3a" stroke-width="1.45"/>
      <rect x="16.5" y="12" width="11" height="5" rx="2" fill="#e8b86d"/>
      <path d="M17.5 22.5h9M17.5 27h9M17.5 31.5h6" stroke="#c48a3a" stroke-width="1.45" stroke-linecap="round"/>
      <circle cx="33.5" cy="18.5" r="7" fill="#f2c14b"/>
      <path d="M28.2 19.2c.4-4.2 2.8-6.8 5.3-7.2 2.6.3 5 2.8 5.4 7.2-3.4.6-7 .6-10.7 0z" fill="#e8b86d"/>
      <circle cx="31.4" cy="20.2" r="1.15" fill="#163528"/>
      <circle cx="35.6" cy="20.2" r="1.15" fill="#163528"/>
      <circle cx="31.75" cy="19.75" r=".35" fill="#fff"/>
      <circle cx="35.95" cy="19.75" r=".35" fill="#fff"/>
      <path d="M32 22.8c.9.9 2.1.9 3 0" stroke="#163528" stroke-width="1.05" stroke-linecap="round"/>
      <path d="M15.8 22.2l1.5 1.5 2.6-2.8" stroke="#6bc48a" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="14.5" cy="35.5" r="2.4" fill="#6bc48a"/>
      <path d="M14.5 34.2v2.6M13.2 35.5h2.6" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`,
    /* 帳款業務：笑臉金幣 */
    coin: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="#f7efe4"/>
      <ellipse cx="18" cy="31.5" rx="8.5" ry="8" fill="#e8b86d"/>
      <ellipse cx="18" cy="30.2" rx="8.5" ry="8" fill="#f2c14b"/>
      <circle cx="15.6" cy="28.6" r="1.1" fill="#8d5a3a"/>
      <circle cx="20.4" cy="28.6" r="1.1" fill="#8d5a3a"/>
      <path d="M15.8 32.2c1.2 1.3 3.2 1.3 4.4 0" stroke="#8d5a3a" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="29.5" cy="20.5" r="11" fill="#e8b86d"/>
      <circle cx="29.5" cy="19.2" r="11" fill="#f7d48a"/>
      <circle cx="29.5" cy="19.2" r="7.8" fill="#fff7e4" stroke="#c48a3a" stroke-width="1.2"/>
      <path d="M29.5 14.2v10" stroke="#8d5a3a" stroke-width="1.55" stroke-linecap="round"/>
      <path d="M26.4 16.4c.7-1 2.4-1.4 3.5-.3 1.1 1.1.7 2.5-.6 3.1-1.4.6-2.6.4-3.3 1.6-.5.9.2 2.3 2.1 2.6 1.5.2 2.8-.4 3.4-1.2" stroke="#8d5a3a" stroke-width="1.35" stroke-linecap="round"/>
      <ellipse cx="25.2" cy="15.5" rx="2.2" ry="1.3" fill="#fff" opacity=".55"/>
      <path d="M12.5 16.5c1.4-2 4-2.4 5.6-.4" stroke="#6bc48a" stroke-width="1.45" stroke-linecap="round"/>
    </svg>`,
    /* 營運統計：微笑長條圖 */
    chart: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="#f3efe6"/>
      <rect x="11" y="28" width="6.2" height="9.5" rx="1.6" fill="#8fd4a4"/>
      <rect x="20.4" y="21" width="6.2" height="16.5" rx="1.6" fill="#6bc48a"/>
      <rect x="29.8" y="15" width="6.2" height="22.5" rx="1.6" fill="#f2a27a"/>
      <circle cx="14.1" cy="25.2" r="2.3" fill="#fff"/>
      <circle cx="13.5" cy="24.7" r=".55" fill="#163528"/>
      <circle cx="14.9" cy="24.7" r=".55" fill="#163528"/>
      <path d="M13.3 26.3c.5.5 1.2.5 1.7 0" stroke="#163528" stroke-width=".9" stroke-linecap="round"/>
      <circle cx="23.5" cy="18.2" r="2.3" fill="#fff"/>
      <circle cx="22.9" cy="17.7" r=".55" fill="#163528"/>
      <circle cx="24.3" cy="17.7" r=".55" fill="#163528"/>
      <path d="M22.7 19.3c.5.5 1.2.5 1.7 0" stroke="#163528" stroke-width=".9" stroke-linecap="round"/>
      <circle cx="32.9" cy="12.2" r="2.4" fill="#fff"/>
      <circle cx="32.3" cy="11.7" r=".55" fill="#163528"/>
      <circle cx="33.7" cy="11.7" r=".55" fill="#163528"/>
      <path d="M32.1 13.4c.55.55 1.3.55 1.85 0" stroke="#163528" stroke-width=".9" stroke-linecap="round"/>
      <path d="M10.5 37.5h27" stroke="#c4b8a4" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M36.8 18.5c1.6-1.2 3.6-.4 4 1.4" stroke="#c48a3a" stroke-width="1.35" stroke-linecap="round"/>
    </svg>`,
    /* 小幫手：芽芽助手 */
    spark: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="#eef3ee"/>
      <ellipse cx="24" cy="39.8" rx="10" ry="2" fill="#1a6843" opacity=".1"/>
      <path d="M24 12.5c-1.8 3.4-5.2 5.2-8.4 4.6 1.4-3.6 4.2-5.8 8.4-4.6z" fill="#2f8a58"/>
      <path d="M24 12.5c1.8 3.4 5.2 5.2 8.4 4.6-1.4-3.6-4.2-5.8-8.4-4.6z" fill="#6bc48a"/>
      <circle cx="24" cy="26" r="10.2" fill="#fff"/>
      <circle cx="24" cy="26" r="10.2" stroke="#5a7264" stroke-width="1.35"/>
      <circle cx="20.2" cy="24.2" r="1.55" fill="#163528"/>
      <circle cx="27.8" cy="24.2" r="1.55" fill="#163528"/>
      <circle cx="20.7" cy="23.7" r=".45" fill="#fff"/>
      <circle cx="28.3" cy="23.7" r=".45" fill="#fff"/>
      <path d="M20.6 28.6c1.9 2 5 2 6.8 0" stroke="#163528" stroke-width="1.25" stroke-linecap="round"/>
      <ellipse cx="17.4" cy="27.2" rx="1.8" ry="1.1" fill="#f2a27a" opacity=".75"/>
      <ellipse cx="30.6" cy="27.2" rx="1.8" ry="1.1" fill="#f2a27a" opacity=".75"/>
      <path d="M18.5 20.8c.8-.9 1.8-.9 2.5 0M27 20.8c.8-.9 1.8-.9 2.5 0" stroke="#5a7264" stroke-width="1.15" stroke-linecap="round"/>
      <circle cx="37.2" cy="14.5" r="3.3" fill="#f2a27a"/>
      <path d="M37.2 12.8v3.4M35.5 14.5h3.4" stroke="#fff" stroke-width="1.35" stroke-linecap="round"/>
      <path d="M11.5 16.5l1.3 2.2 2.4.2-1.8 1.6.6 2.4-2.1-1.2-2.1 1.2.6-2.4-1.8-1.6 2.4-.2z" fill="#f2c14b"/>
    </svg>`,
    /* 進口部門：貨櫃船 */
    ship: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="#e4f0f4"/>
      <ellipse cx="24" cy="40" rx="13" ry="2" fill="#1a6843" opacity=".1"/>
      <path d="M8 28.5h32l-2.5 5.5H10.5L8 28.5z" fill="#2a6f78"/>
      <path d="M10 28.5V22h6v6.5M18 28.5V18h7v10.5M27 28.5V20h7v8.5" fill="#3d9a64"/>
      <path d="M10 22h6M18 18h7M27 20h7" stroke="#8fd4a4" stroke-width="1.1"/>
      <path d="M6 31.5c4 3.5 10 5 18 5s14-1.5 18-5" stroke="#5eb3b8" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="36" cy="14" r="3.4" fill="#f2a27a"/>
      <path d="M36 12.4v3.2M34.4 14h3.2" stroke="#fff" stroke-width="1.25" stroke-linecap="round"/>
    </svg>`,
    /* 出口部門：出貨卡車＋飛機感 */
    plane: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="#eef5e8"/>
      <ellipse cx="24" cy="40" rx="12" ry="2" fill="#1a6843" opacity=".1"/>
      <path d="M10 28V19c0-1.3 1-2.4 2.3-2.4H23v11.4H10z" fill="#1a6843"/>
      <path d="M23 21h6.5L34 26.5V30H23V21z" fill="#3d9a64"/>
      <circle cx="15" cy="32.2" r="3" fill="#2a3430"/>
      <circle cx="15" cy="32.2" r="1.2" fill="#c5d0cb"/>
      <circle cx="30" cy="32.2" r="3" fill="#2a3430"/>
      <circle cx="30" cy="32.2" r="1.2" fill="#c5d0cb"/>
      <path d="M28 12l10 3.2-2.2 2.4-4.2-.6-1.2 3.8-2.2-.8 1-3.6-3.4-1.2L28 12z" fill="#f2c14b"/>
      <circle cx="14" cy="14.5" r="2.8" fill="#6bc48a"/>
      <path d="M14 13.2v2.6M12.7 14.5h2.6" stroke="#fff" stroke-width="1.15" stroke-linecap="round"/>
    </svg>`,
    /* 銷售帳務：帳單＋菜 */
    sales: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="#f6f0e4"/>
      <rect x="11" y="12" width="18" height="24" rx="3" fill="#fff" stroke="#c48a3a" stroke-width="1.4"/>
      <path d="M15 19h10M15 23.5h10M15 28h7" stroke="#c48a3a" stroke-width="1.35" stroke-linecap="round"/>
      <circle cx="33" cy="20" r="8.5" fill="#f2c14b"/>
      <circle cx="33" cy="20" r="6" fill="#fff7e4" stroke="#c48a3a" stroke-width="1.1"/>
      <path d="M33 16.2v7.6M30.6 18c.5-.8 1.8-1.1 2.6-.3.8.8.5 1.9-.4 2.3-.9.4-1.9.3-2.5 1.2-.4.7.1 1.8 1.6 2" stroke="#8d5a3a" stroke-width="1.15" stroke-linecap="round"/>
      <path d="M22 10c1.5-2.8 4.8-3.6 6.8-1.8-1.8 1.6-3.2 3.6-3.6 5.8-2-.8-3.4-2.2-3.2-4z" fill="#6bc48a"/>
    </svg>`,
  };
  const key = pics[name] ? name : "clip";
  const svg = String(pics[key]).replace(
    "<svg ",
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" ',
  );
  return `<span class="hub-pic hub-pic-${key}" aria-hidden="true">${svg}</span>`;
}
/** Colorful mini illustrations for 下單／填單／排程／送貨 */
function flowPic(name) {
  const pics = {
    form: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="#e7f5ec"/>
      <rect x="14" y="10" width="20" height="28" rx="4" fill="#fff" stroke="#1a6843" stroke-width="1.55"/>
      <rect x="18" y="7.5" width="12" height="6" rx="2" fill="#6bc48a"/>
      <path d="M18.5 20h11M18.5 25h11M18.5 30h7" stroke="#1a6843" stroke-width="1.65" stroke-linecap="round"/>
      <circle cx="34" cy="33.5" r="7.2" fill="#f2a27a"/>
      <path d="M31.4 33.7h5.2M34 31.1v5.2" stroke="#fff" stroke-width="1.85" stroke-linecap="round"/>
    </svg>`,
    list: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="#eef4fb"/>
      <rect x="12" y="11" width="24" height="26" rx="4.5" fill="#fff" stroke="#3d6ea5" stroke-width="1.55"/>
      <circle cx="17.5" cy="19" r="2.35" fill="#6bc48a"/>
      <path d="M16.2 19.15l1 .95 2.1-2.1" stroke="#fff" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M22 19h9" stroke="#3d6ea5" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="17.5" cy="26" r="2.35" fill="#6bc48a"/>
      <path d="M16.2 26.15l1 .95 2.1-2.1" stroke="#fff" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M22 26h9" stroke="#3d6ea5" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="17.5" cy="33" r="2.35" fill="#d9e4f0"/>
      <path d="M22 33h7" stroke="#9bb0c8" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`,
    cal: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="#f5f0e6"/>
      <rect x="11" y="13" width="26" height="23" rx="4.5" fill="#fff" stroke="#c48a3a" stroke-width="1.55"/>
      <rect x="11" y="13" width="26" height="7.5" rx="4.5" fill="#e8b86d"/>
      <path d="M18 10.5v5.5M30 10.5v5.5" stroke="#c48a3a" stroke-width="2" stroke-linecap="round"/>
      <rect x="15.5" y="24.5" width="5.5" height="5" rx="1.3" fill="#6bc48a"/>
      <rect x="22.5" y="24.5" width="5.5" height="5" rx="1.3" fill="#8fd4a4"/>
      <rect x="29.5" y="24.5" width="4" height="5" rx="1.3" fill="#f2a27a"/>
      <rect x="15.5" y="31.5" width="5.5" height="5" rx="1.3" fill="#d4e9da"/>
      <rect x="22.5" y="31.5" width="5.5" height="5" rx="1.3" fill="#6bc48a"/>
    </svg>`,
    truck: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="#e7f3ef"/>
      <path d="M10 28V18.5c0-1.4 1.1-2.5 2.5-2.5H24v12H10z" fill="#1a6843"/>
      <path d="M24 20h7.2L36 26.5V30H24V20z" fill="#3d9a64"/>
      <rect x="12" y="18" width="9" height="6" rx="1.4" fill="#8fd4a4" opacity=".95"/>
      <circle cx="15.5" cy="32.5" r="3.3" fill="#2a3430"/>
      <circle cx="15.5" cy="32.5" r="1.35" fill="#c5d0cb"/>
      <circle cx="31.5" cy="32.5" r="3.3" fill="#2a3430"/>
      <circle cx="31.5" cy="32.5" r="1.35" fill="#c5d0cb"/>
      <circle cx="27" cy="15.8" r="3.4" fill="#f2a27a"/>
      <path d="M27 13.5c1.45 0 2.5 1.55 2.5 2.9-1.25.2-2.3-.1-2.5-1.15-.3 1-.95 1.35-2.3 1.15.1-1.45 1.05-2.9 2.3-2.9z" fill="#6bc48a"/>
    </svg>`,
    chat: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="#e9f8ef"/>
      <path d="M13.5 15h21a4.2 4.2 0 0 1 4.2 4.2v9a4.2 4.2 0 0 1-4.2 4.2H22l-6.8 5.2V32.4H13.5a4.2 4.2 0 0 1-4.2-4.2v-9A4.2 4.2 0 0 1 13.5 15z" fill="#06c755"/>
      <circle cx="20" cy="24.2" r="1.85" fill="#fff"/>
      <circle cx="24" cy="24.2" r="1.85" fill="#fff"/>
      <circle cx="28" cy="24.2" r="1.85" fill="#fff"/>
    </svg>`,
  };
  const raw = pics[name] || pics.form;
  const svg = String(raw).replace(
    "<svg ",
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" ',
  );
  return `<span class="flow-pic" aria-hidden="true">${svg}</span>`;
}
function hubLink(attrs, icon, label, extraClass, badge, note) {
  const mark = badge ? `<span class="tab-badge">${esc(String(badge))}</span>` : "";
  const pending = badge ? " has-pending" : "";
  const noteHtml = note ? `<span class="hub-note">${esc(note)}</span>` : "";
  return `<button type="button" class="hub-link${extraClass ? ` ${extraClass}` : ""}${pending}" ${attrs}>${hubSvg(icon)}<span class="hub-lab">${esc(label)}${mark}</span>${noteHtml}</button>`;
}
function homeHelloWord() {
  const h = new Date().getHours();
  if (h < 11) return "早安";
  if (h < 17) return "午安";
  return "晚安";
}
function homeDayLabel() {
  try {
    return new Intl.DateTimeFormat("zh-Hant", {
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(new Date());
  } catch (_) {
    return today();
  }
}
function homeMascotSvg() {
  return `<span class="home-mascot" aria-hidden="true">
    <svg viewBox="0 0 120 120" fill="none">
      <ellipse cx="60" cy="102" rx="34" ry="8" fill="#1a6843" opacity=".12"/>
      <path d="M38 78c8 14 36 14 44 0 4-8 2-22-6-30-10 10-22 14-32 12-8 6-10 14-6 18z" fill="#3d9a64"/>
      <path d="M48 52c-2-18 10-34 28-36-4 16-2 30 8 40-18 2-32-2-36-4z" fill="#6bc48a"/>
      <path d="M34 58c-10-14-8-32 4-42 2 18 10 28 22 34-10 4-20 6-26 8z" fill="#2f8a58"/>
      <circle cx="52" cy="70" r="3.2" fill="#163528"/>
      <circle cx="68" cy="70" r="3.2" fill="#163528"/>
      <circle cx="53.2" cy="69" r="1" fill="#fff"/>
      <circle cx="69.2" cy="69" r="1" fill="#fff"/>
      <path d="M54 78c4 4 10 4 14 0" stroke="#163528" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="44" cy="74" r="3.5" fill="#f2a27a" opacity=".85"/>
      <circle cx="76" cy="74" r="3.5" fill="#f2a27a" opacity=".85"/>
      <path d="M72 44c10-2 20 4 22 14-8 2-16 0-22-4z" fill="#8fd4a4"/>
    </svg>
  </span>`;
}
function hubFlowStep(n, attrs, icon, label, note, badge) {
  const mark = badge ? `<span class="tab-badge">${esc(String(badge))}</span>` : "";
  const pending = badge ? " has-pending" : "";
  return `<button type="button" class="home-step${pending}" ${attrs}>
    <span class="home-step-n" aria-hidden="true">${esc(String(n))}</span>
    <span class="home-step-ico" aria-hidden="true">${flowPic(icon)}</span>
    <span class="home-step-lab">${esc(label)}${mark}</span>
    ${note ? `<span class="home-step-note">${esc(note)}</span>` : ""}
  </button>`;
}
function opsFlowTabHtml(pic, label, badgeHtml) {
  return `${flowPic(pic)}<span class="tab-lab">${esc(label)}${badgeHtml || ""}</span>`;
}
function paintOpsFlowTabIcons() {
  const map = {
    form: ["form", "下單"],
    today: ["list", "已填"],
    line: ["chat", "LINE"],
    short: ["cal", "排程"],
    ship: ["truck", "送貨"],
  };
  document.querySelectorAll("#flow-tabs [data-ops]").forEach((b) => {
    const m = map[b.dataset.ops];
    if (!m) return;
    const badge = b.querySelector(".tab-badge");
    const badgeHtml = badge ? badge.outerHTML : "";
    b.innerHTML = opsFlowTabHtml(m[0], m[1], badgeHtml);
  });
}
function renderHomeHub() {
  const box = document.getElementById("home-hub");
  const lead = document.querySelector("#page-home .hub-lead");
  if (!box) return;
  if (!currentStaff()) {
    box.innerHTML = "";
    box.classList.remove("hub-pick", "home-app", "hub-shelf");
    if (lead) lead.textContent = "登入後開始今天的出貨。";
    return;
  }
  const role = currentRole();
  const who = currentStaff();
  if (lead) lead.hidden = true;
  const flow = [];
  if (can("page-orders")) {
    flow.push(hubFlowStep(1, 'data-go="orders" data-orders-pane="form"', "form", "下單", "建立訂單"));
    flow.push(hubFlowStep(2, 'data-go="orders" data-orders-pane="today"', "list", "已填單", "可改／結單"));
    const lineN = linePendingCount();
    flow.push(
      hubFlowStep(
        "‧",
        'data-go="orders" data-orders-pane="line"',
        "chat",
        "LINE",
        "轉成已填單",
        lineN ? `${lineN}` : "",
      ),
    );
  }
  if (can("page-plan")) {
    if (role !== "driver") {
      flow.push(hubFlowStep(3, 'data-go="plan" data-plan-main="short"', "cal", "現場排程", "備貨清單"));
    }
    flow.push(
      hubFlowStep(
        role === "driver" ? 1 : 4,
        'data-go="plan" data-plan-main="ship"',
        "truck",
        role === "driver" ? "擇單送貨" : "司機送貨",
        "確認出貨",
      ),
    );
  }
  const prep = [];
  if (can("books-stock")) {
    prep.push(hubLink('data-go="books" data-books="stock" data-stock-phase="pick"', "crate", "庫存盤點"));
  }
  if (can("page-books")) {
    prep.push(hubLink('data-go="books" data-books="in"', "inbox", "進貨", "is-soft"));
    prep.push(hubLink('data-go="books" data-books="rack"', "rack", "資財管理", "", "", "鐵架／八格籃"));
  }
  const labelBtns = [];
  if (can("page-orders") || can("page-plan") || can("page-books")) {
    labelBtns.push(hubLink('data-go="labels"', "tag", "標籤印製"));
  }
  if (can("page-books")) {
    labelBtns.push(hubLink('data-go="label-prints"', "tag", "列印明細"));
  }
  const acct = [];
  if (can("page-books")) {
    acct.push(hubLink('data-go="soon" data-soon="cust"', "person", "客戶", "soon"));
    acct.push(hubLink('data-go="soon" data-soon="vendor"', "shop", "廠商", "soon"));
    acct.push(hubLink('data-go="books" data-books="sales"', "bill", "出貨帳單"));
    acct.push(hubLink('data-go="books" data-books="ledger"', "clip", "進銷存清單"));
  }
  const help = [hubLink('data-go="help"', "truck", "貨運帳務比對")];
  const openCard = (id, tone, icon, title, bodyHtml) =>
    `<section class="hub-card hub-${tone} is-open home-open">
      <div class="hub-head">
        <span class="hub-mark has-pic" aria-hidden="true">${hubPic(icon)}</span>
        <h2>${esc(title)}</h2>
        <button type="button" class="ghost hub-back" data-hub-back>返回</button>
      </div>
      ${bodyHtml}
    </section>`;
  /** 銷貨：手機＝進口式雙列頂部＋全寬工作頁；網頁＝上欄＋側欄 */
  const renderSalesShell = () => {
    const blocks = buildSalesBlocks();
    if (!blocks.length) {
      restoreSalesMount();
      box.classList.remove("hub-pick");
      box.classList.add("home-app", "hub-shelf");
      box.innerHTML = `${topLevelSwitch("sales")}<p class="home-open-hint">此帳號目前沒有銷貨項目可用。</p>`;
      return;
    }
    if (!blocks.some((b) => b.id === hubSalesBlock)) hubSalesBlock = blocks[0].id;
    const cur = blocks.find((b) => b.id === hubSalesBlock) || blocks[0];
    if (hubSalesPane && !cur.tabs.some((t) => t.id === hubSalesPane)) hubSalesPane = "";
    const phone = isSalesPhoneLayout();
    // 手機工作頁：沒選子頁就進該區第一個（跟進口一樣直接做事）
    if (phone && !hubSalesPane && cur.tabs[0]) {
      hubSalesPane = cur.tabs[0].id;
      applySalesPaneState(hubSalesPane);
    }
    box.classList.remove("hub-pick");
    box.classList.add("home-app", "hub-shelf");

    if (box.querySelector(".sales-shell") && syncSalesShellChrome()) {
      if (!hubSalesPane) fillSalesLanding();
      return;
    }

    if (phone) {
      const blockChips = blocks
        .map((b) => {
          const on = b.id === cur.id;
          return `<button type="button" class="sales-phone-chip sales-phone-block${on ? " is-on" : ""}" data-sales-block="${esc(b.id)}">${esc(b.lab)}</button>`;
        })
        .join("");
      const subChips = cur.tabs.map(salesPhoneChipHtml).join("");
      box.innerHTML = `
      <section class="sales-shell sales-shell--phone">
        <header class="sales-phone-chrome">
          <nav class="sales-phone-row" aria-label="銷貨主模組">
            <button type="button" class="sales-phone-chip" data-hub-back data-sales-home>← 總覽</button>
            ${blockChips}
          </nav>
          <nav class="sales-phone-row sales-phone-subs" aria-label="銷貨子頁">${subChips}</nav>
        </header>
        <section class="sales-shell-main">
          <div id="sales-shell-mount" class="sales-shell-mount"></div>
        </section>
      </section>`;
      return;
    }

    const blockChips = blocks
      .map((b) => {
        const on = b.id === cur.id;
        return `<button type="button" class="sales-block-chip${on ? " is-on" : ""}" data-sales-block="${esc(b.id)}">${esc(b.lab)}</button>`;
      })
      .join("");
    const sideHtml = cur.tabs.map(salesSideBtnHtml).join("");
    box.innerHTML = `
      <section class="sales-shell sales-shell--web">
        <header class="sales-shell-head">
          <button type="button" class="sales-block-chip sales-home-chip" data-hub-back data-sales-home>← 總覽</button>
          <nav class="sales-block-nav" aria-label="銷貨主模組">${blockChips}</nav>
        </header>
        <div class="sales-shell-body">
          <aside class="sales-shell-side" aria-label="銷貨子選單">
            <div class="sales-side-title">${esc(cur.lab)}</div>
            <nav class="sales-side-nav">${sideHtml}</nav>
          </aside>
          <section class="sales-shell-main${hubSalesPane ? "" : " is-landing"}">
            <div id="sales-shell-mount" class="sales-shell-mount"></div>
          </section>
        </div>
      </section>`;
    if (!hubSalesPane) fillSalesLanding();
  };

  const stubShelfItem = (x) =>
    `<button type="button" class="shelf-item is-soon" data-go="soon" data-soon="${esc(x.soon)}">
      <span class="shelf-ico hub-mark has-pic" aria-hidden="true">${hubPic(x.icon)}</span>
      <strong class="shelf-lab">${esc(x.title)}</strong>
      <em class="shelf-note">建置中</em>
    </button>`;
  const stubShelf = (items) => items.map(stubShelfItem).join("");

  const DEPT_DEFS = [
    { id: "import", icon: "ship", title: "進口", blurb: "採購・拆櫃・帳務", tone: "ware" },
    { id: "export", icon: "plane", title: "出口", blurb: "訂單・出貨・帳務", tone: "orders" },
    { id: "sales", icon: "sales", title: "銷貨", blurb: "訂貨・倉庫・帳款", tone: "acct" },
  ];

  const shelfSwitchStrip = (items, { active, attr, compact, bare } = {}) => {
    const row = items
      .map((x) => {
        const on = x.id === active ? " is-on" : "";
        const data = attr === "dept" ? `data-hub-dept="${esc(x.id)}"` : `data-hub="${esc(x.id)}"`;
        if (compact) {
          return `<button type="button" class="shelf-switch hub-${x.tone || "ware"}${on}" ${data}>
            <span class="shelf-switch-ico" aria-hidden="true">${hubPic(x.icon)}</span>
            <span class="shelf-switch-lab">${esc(x.title)}</span>
          </button>`;
        }
        return `<button type="button" class="shelf-item shelf-dept hub-${x.tone || "ware"}${on}" ${data}>
          <span class="shelf-ico hub-mark has-pic" aria-hidden="true">${hubPic(x.icon)}</span>
          <strong class="shelf-lab">${esc(x.title)}</strong>
          <em class="shelf-note">${esc(x.blurb || "")}</em>
        </button>`;
      })
      .join("");
    if (bare) return row;
    return `<div class="shelf-switch-bar${compact ? " is-compact" : ""}" role="tablist">${row}</div>`;
  };

  const topLevelSwitch = (activeId) => {
    const visibleDepts = DEPT_DEFS.filter((d) => {
      if (d.id === "import") return can("page-import");
      if (d.id === "export") return can("page-export");
      if (d.id === "sales") {
        return (
          can("page-orders") ||
          can("page-plan") ||
          can("page-books") ||
          can("page-stats") ||
          can("page-sitework") ||
          can("page-help")
        );
      }
      return true;
    });
    const deptRow = shelfSwitchStrip(visibleDepts, { active: activeId, attr: "dept", compact: true });
    const toolRow = labelBtns.length
      ? shelfSwitchStrip([{ id: "labels", icon: "tag", title: "標籤列印", tone: "ware" }], {
          active: activeId,
          attr: "hub",
          compact: true,
        })
      : "";
    return `<section class="shelf-rack shelf-switch-rack">
      <div class="shelf-switch-head">
        <p class="shelf-rack-label">層架切換</p>
        <button type="button" class="ghost hub-back shelf-home-back" data-hub-back>回總覽</button>
      </div>
      <div class="shelf-board">
        <div class="shelf-switch-wrap">${deptRow}${toolRow}</div>
        <div class="shelf-ledge" aria-hidden="true"></div>
      </div>
    </section>`;
  };

  const canImport = can("page-import");
  /** 進口子層架：橫排名稱切換，不佔直立空間 */
  const importSwitchItems = [
    { pane: "parse", icon: "clip", title: "判讀" },
    { pane: "port", icon: "ship", title: "海關查驗" },
    { pane: "release", icon: "list", title: "已放行" },
    { pane: "sum", icon: "chart", title: "總明細" },
    { pane: "stock", icon: "crate", title: "庫存" },
    { pane: "buy", icon: "clip", title: "採購" },
    { pane: "files", icon: "box", title: "舊資料" },
  ];
  const importSwitchHtml = canImport
    ? importSwitchItems
        .map(
          (x) => `<button type="button" class="shelf-switch hub-ware" data-go="import" data-import="${esc(x.pane)}">
            <span class="shelf-switch-ico" aria-hidden="true">${hubPic(x.icon)}</span>
            <span class="shelf-switch-lab">${esc(x.title)}</span>
          </button>`,
        )
        .join("") +
      (can("page-unpack")
        ? `<button type="button" class="shelf-switch hub-ware" data-hub="unpack">
            <span class="shelf-switch-ico" aria-hidden="true">${hubPic("box")}</span>
            <span class="shelf-switch-lab">拆櫃</span>
          </button>`
        : "")
    : stubShelfItem({ soon: "imp-port", icon: "ship", title: "海關查驗" });

  const importLive = (pane, icon, title, note) =>
    canImport
      ? `<button type="button" class="shelf-item hub-ware" data-go="import" data-import="${esc(pane)}">
          <span class="shelf-ico hub-mark has-pic" aria-hidden="true">${hubPic(icon)}</span>
          <strong class="shelf-lab">${esc(title)}</strong>
          <em class="shelf-note">${esc(note)}</em>
        </button>`
      : "";
  const importOpsHtml = importSwitchHtml;
  const exportItems = [
    { soon: "exp-order", icon: "clip", title: "出口訂單" },
    { soon: "exp-ship", icon: "plane", title: "備貨出貨" },
    { soon: "exp-label", icon: "tag", title: "出口標籤" },
    { soon: "exp-acct", icon: "coin", title: "出口帳務" },
  ];

  const shelfWrap = (title, tone, icon, itemsHtml) =>
    `<section class="shelf-rack hub-${tone}">
      <div class="shelf-rack-head">
        <span class="hub-mark has-pic" aria-hidden="true">${hubPic(icon)}</span>
        <h2>${esc(title)}</h2>
      </div>
      <div class="shelf-board">
        <div class="shelf-row">${itemsHtml}</div>
        <div class="shelf-ledge" aria-hidden="true"></div>
      </div>
    </section>`;

  if (isUnpackerRole()) {
    box.classList.add("home-app");
    box.classList.remove("hub-pick", "hub-shelf");
    if (!can("page-unpack")) {
      box.innerHTML = `<header class="home-top">
      <p class="home-meta">${esc(homeDayLabel())}</p>
      <h1 class="home-title">${esc(who)}<span>拆櫃作業</span></h1>
    </header>
    <p class="home-open-hint">拆櫃回報建置中，暫僅主管可進入。</p>`;
      return;
    }
    const n = typeof window.unpackPendingCountForMe === "function" ? window.unpackPendingCountForMe() : 0;
    box.innerHTML = `<header class="home-top">
      <p class="home-meta">${esc(homeDayLabel())}</p>
      <h1 class="home-title">${esc(who)}<span>拆櫃作業</span></h1>
    </header>
    <div class="home-menu">
      <button type="button" class="home-mod is-primary hub-ware" data-hub="unpack">
        <span class="home-mod-ico hub-mark has-pic" aria-hidden="true">${hubPic("box")}</span>
        <span class="home-mod-copy">
          <strong>我的拆櫃回報</strong>
          <em>${n ? `待回報 ${n} 櫃` : "點進去回報指派給你的貨櫃"}</em>
        </span>
        <span class="home-mod-go" aria-hidden="true">›</span>
      </button>
    </div>`;
    return;
  }

  if (hubOpen === "labels" && !hubDept) {
    box.classList.remove("hub-pick");
    box.classList.add("home-app", "hub-shelf");
    const body = labelBtns.length
      ? openCard(
          "labels",
          "ware",
          "tag",
          "標籤列印",
          `<p class="home-open-hint">進口／出口／銷貨共用。</p><div class="hub-links">${labelBtns.join("")}</div>`,
        )
      : `<section class="hub-card hub-ware is-open home-open">
          <div class="hub-head"><span class="hub-mark has-pic" aria-hidden="true">${hubPic("tag")}</span><h2>標籤列印</h2></div>
          <p class="home-open-hint">此帳號目前沒有標籤權限。</p>
        </section>`;
    box.innerHTML = `${topLevelSwitch("labels")}${body.replace(
      /<button type="button" class="ghost hub-back" data-hub-back>返回<\/button>/,
      "",
    )}`;
    return;
  }

  if (hubDept === "sales") {
    document.body.classList.add("sales-workspace");
    renderSalesShell();
    if (hubSalesPane) embedSalesPaneContent();
    return;
  }

  if (hubDept === "import" || hubDept === "export") {
    box.classList.remove("hub-pick");
    box.classList.add("home-app", "hub-shelf");
    const switcher = topLevelSwitch(hubDept);
    if (hubDept === "import") {
      // 不再顯示直立層架；直接進進口頁（上方橫排）
      if (typeof window.openImport === "function") {
        window.openImport("parse");
        return;
      }
    }
    if (hubDept === "export") {
      box.innerHTML = `${switcher}${shelfWrap("出口", "orders", "plane", stubShelf(exportItems))}`;
      return;
    }
  }

  box.classList.add("hub-pick", "home-app", "hub-shelf");
  const roleHint =
    role === "driver" ? "司機作業" : role === "site" ? "現場作業" : role === "unpacker" ? "拆櫃作業" : "會計作業";
  const deptTiles = shelfSwitchStrip(
    DEPT_DEFS.filter((d) => {
      if (d.id === "import") return can("page-import");
      if (d.id === "export") return can("page-export");
      if (d.id === "sales") {
        return (
          can("page-orders") ||
          can("page-plan") ||
          can("page-books") ||
          can("page-stats") ||
          can("page-sitework") ||
          can("page-help")
        );
      }
      return true;
    }),
    { active: "", attr: "dept", compact: false, bare: true },
  );
  const toolsTile = labelBtns.length
    ? `<button type="button" class="shelf-item shelf-tool hub-ware" data-hub="labels">
        <span class="shelf-ico hub-mark has-pic" aria-hidden="true">${hubPic("tag")}</span>
        <strong class="shelf-lab">標籤列印</strong>
        <em class="shelf-note">三部門共用</em>
      </button>`
    : "";
  const toolsRack = toolsTile
    ? `<section class="shelf-rack shelf-tools">
      <p class="shelf-rack-label">共用工具</p>
      <div class="shelf-board">
        <div class="shelf-row">${toolsTile}</div>
        <div class="shelf-ledge" aria-hidden="true"></div>
      </div>
    </section>`
    : "";
  box.innerHTML = `<header class="home-top">
      <p class="home-meta">${esc(homeDayLabel())}</p>
      <h1 class="home-title">${esc(who)}<span>${esc(roleHint)}</span></h1>
    </header>
    <section class="shelf-rack shelf-home">
      <p class="shelf-rack-label">選擇部門</p>
      <div class="shelf-board">
        <div class="shelf-row shelf-row-depts">${deptTiles}</div>
        <div class="shelf-ledge" aria-hidden="true"></div>
      </div>
    </section>
    ${toolsRack}`;
}
function normalizeOrdersPane(v) {
  if (v === "today" || v === "line") return v;
  return "form";
}
function currentOpsStep() {
  if (page === "plan") return planMain === "ship" ? "ship" : "short";
  if (page === "orders") return normalizeOrdersPane(ordersPane);
  return "";
}
function syncOpsFlowTabs() {
  const flow = document.getElementById("flow-tabs");
  if (!flow) return;
  if (!flow.dataset.flowPics) {
    paintOpsFlowTabIcons();
    flow.dataset.flowPics = "1";
  }
  const onOps = page === "orders" || page === "plan";
  const logged = !!currentStaff();
  // 銷貨殼用左側子選單切換，不要露出全域流程橫排（否則一點就整頁跳走、側欄消失）
  const inSalesShell = hubDept === "sales";
  flow.hidden = !logged || !onOps || inSalesShell;
  const step = currentOpsStep();
  const role = currentRole();
  flow.querySelectorAll("[data-ops]").forEach((b) => {
    const ops = b.dataset.ops;
    let show = false;
    if (ops === "form" || ops === "today" || ops === "line") show = can("page-orders");
    else if (ops === "short") show = can("page-plan") && role !== "driver";
    else if (ops === "ship") show = can("page-plan");
    b.hidden = !show;
    b.classList.toggle("on", show && ops === step);
  });
  const ordersTabs = document.getElementById("orders-pane-tabs");
  if (ordersTabs) ordersTabs.hidden = true;
  const planTabs = document.getElementById("plan-main-tabs");
  if (planTabs) planTabs.hidden = true;
}
function goOpsStep(step, { skipEnteringGuard } = {}) {
  const next = String(step || "");
  if (next === "form" || next === "today" || next === "line") {
    if (!can("page-orders")) return setStatus("沒有下單權限。", true);
    if (!skipEnteringGuard && document.body.classList.contains("order-entering") && next !== "form") {
      setStatus("正在輸入訂單，請先確認送出或清掉本單。", true);
      return false;
    }
    const samePage = page === "orders";
    page = "orders";
    ordersPane = next;
    hubOpen = "";
    if (samePage) {
      syncOpsFlowTabs();
      applyOrdersPane(false);
      applyCopy();
      return true;
    }
    render();
    return true;
  }
  if (next === "short" || next === "ship") {
    if (!can("page-plan")) return setStatus("沒有現場排程權限。", true);
    if (!skipEnteringGuard && document.body.classList.contains("order-entering")) {
      setStatus("正在輸入訂單，請先確認送出或清掉本單。", true);
      return false;
    }
    const want = currentRole() === "driver" ? "ship" : next === "ship" ? "ship" : "short";
    const samePage = page === "plan";
    page = "plan";
    planMain = want;
    hubOpen = "";
    if (samePage) {
      syncOpsFlowTabs();
      applyPlanMain(false);
      applyPlanPane();
      return true;
    }
    render();
    return true;
  }
  return false;
}
function buildSalesBlocks() {
  const role = currentRole();
  const blocks = [];
  const orderTabs = [];
  if (can("page-orders")) {
    orderTabs.push({
      id: "form",
      lab: "下單",
      hint: "建立訂單",
      attrs: 'data-sales-pane="form"',
    });
    orderTabs.push({
      id: "today",
      lab: "已填單",
      hint: "可改／結單",
      attrs: 'data-sales-pane="today"',
    });
    const lineN = linePendingCount();
    orderTabs.push({
      id: "line",
      lab: "LINE",
      hint: lineN ? `待轉 ${lineN}` : "轉成已填單",
      attrs: 'data-sales-pane="line"',
      badge: lineN || 0,
    });
  }
  if (can("page-plan")) {
    if (role !== "driver") {
      orderTabs.push({
        id: "short",
        lab: "現場排程",
        hint: "備貨清單",
        attrs: 'data-sales-pane="short"',
      });
    }
    orderTabs.push({
      id: "ship",
      lab: role === "driver" ? "擇單送貨" : "司機送貨",
      hint: "確認出貨",
      attrs: 'data-sales-pane="ship"',
    });
  }
  if (can("page-orders") || can("page-plan") || can("page-books")) {
    orderTabs.push({
      id: "labels",
      lab: "標籤印製",
      hint: "貼紙列印",
      attrs: 'data-sales-pane="labels"',
    });
  }
  if (can("page-books")) {
    orderTabs.push({
      id: "label-prints",
      lab: "列印明細",
      hint: "列印紀錄",
      attrs: 'data-sales-pane="label-prints"',
    });
  }
  if (can("page-sitework")) {
    orderTabs.push({
      id: "sitework",
      lab: "現場工作",
      hint: "調倉・接單・工作單",
      attrs: 'data-sales-pane="sitework"',
    });
  }
  if (orderTabs.length) blocks.push({ id: "orders", lab: "訂貨出貨", tabs: orderTabs });

  const wareTabs = [];
  if (can("books-stock")) {
    wareTabs.push({
      id: "stock",
      lab: "庫存盤點",
      hint: "點貨・盤點",
      attrs: 'data-sales-pane="stock"',
    });
  }
  if (can("page-books")) {
    wareTabs.push({
      id: "in",
      lab: "進貨",
      hint: "進貨登錄",
      attrs: 'data-sales-pane="in"',
    });
    wareTabs.push({
      id: "rack",
      lab: "資財管理",
      hint: "鐵架／八格籃",
      attrs: 'data-sales-pane="rack"',
    });
  }
  if (wareTabs.length) blocks.push({ id: "ware", lab: "倉庫", tabs: wareTabs });

  const acctTabs = [];
  if (can("page-books")) {
    acctTabs.push({
      id: "sales-bill",
      lab: "出貨帳單",
      hint: "對帳開立",
      attrs: 'data-sales-pane="sales-bill"',
    });
    acctTabs.push({
      id: "ledger",
      lab: "進銷存清單",
      hint: "進出彙總",
      attrs: 'data-sales-pane="ledger"',
    });
    acctTabs.push({
      id: "cust",
      lab: "客戶",
      hint: "建置中",
      attrs: 'data-sales-pane="cust"',
    });
    acctTabs.push({
      id: "vendor",
      lab: "廠商",
      hint: "建置中",
      attrs: 'data-sales-pane="vendor"',
    });
  }
  acctTabs.push({
    id: "help",
    lab: "貨運比對",
    hint: "帳務核對",
    attrs: 'data-sales-pane="help"',
  });
  if (can("page-stats")) {
    acctTabs.push({
      id: "stats",
      lab: "營運統計",
      hint: "圖表・紀錄",
      attrs: 'data-sales-pane="stats"',
    });
  }
  if (acctTabs.length) blocks.push({ id: "acct", lab: "帳款", tabs: acctTabs });
  return blocks;
}
function salesSideBtnHtml(t) {
  const on = t.id === hubSalesPane;
  const badge = t.badge ? `<span class="sales-side-badge">${esc(String(t.badge))}</span>` : "";
  return `<button type="button" class="sales-side${on ? " is-on" : ""}" ${t.attrs}>
    <span class="sales-side-lab">${esc(t.lab)}${badge}</span>
    <em class="sales-side-hint">${esc(t.hint || "")}</em>
  </button>`;
}
/** 跟進口一樣：沒勾「網頁」＝手機工作頁 */
function isSalesPhoneLayout() {
  return !document.body.classList.contains("layout-web");
}
function salesPhoneChipHtml(t) {
  const on = t.id === hubSalesPane;
  const badge = t.badge ? `<span class="sales-chip-badge">${esc(String(t.badge))}</span>` : "";
  return `<button type="button" class="sales-phone-chip${on ? " is-on" : ""}" ${t.attrs}>${esc(t.lab)}${badge}</button>`;
}
function salesLandingHtml(cur) {
  const cards = cur.tabs
    .map(
      (t) => `<button type="button" class="sales-main-card" ${t.attrs}>
        <strong>${esc(t.lab)}</strong>
        <em>${esc(t.hint || "")}</em>
      </button>`,
    )
    .join("");
  return `<div class="sales-landing">
    <h2 class="sales-main-title">${esc(cur.lab)}</h2>
    <p class="sales-main-hint">點左側進入功能；上方與側欄固定，只換中間工作區。</p>
    <div class="sales-main-grid">${cards}</div>
  </div>`;
}
function fillSalesLanding() {
  if (isSalesPhoneLayout()) return;
  const mount = document.getElementById("sales-shell-mount");
  const main = document.querySelector(".sales-shell-main");
  if (!mount) return;
  restoreSalesMount();
  const blocks = buildSalesBlocks();
  if (!blocks.length) return;
  if (!blocks.some((b) => b.id === hubSalesBlock)) hubSalesBlock = blocks[0].id;
  const cur = blocks.find((b) => b.id === hubSalesBlock) || blocks[0];
  if (main) main.classList.add("is-landing");
  mount.innerHTML = salesLandingHtml(cur);
}
function syncSalesPhoneSubs(shell, cur) {
  const subNav = shell.querySelector(".sales-phone-subs");
  if (!subNav) return;
  const existing = [...subNav.querySelectorAll("[data-sales-pane]")].map((el) => el.dataset.salesPane).join("\0");
  const wanted = cur.tabs.map((t) => t.id).join("\0");
  if (existing !== wanted) {
    subNav.innerHTML = cur.tabs.map(salesPhoneChipHtml).join("");
  } else {
    subNav.querySelectorAll("[data-sales-pane]").forEach((b) => {
      b.classList.toggle("is-on", b.dataset.salesPane === hubSalesPane);
      const tab = cur.tabs.find((t) => t.id === b.dataset.salesPane);
      if (!tab) return;
      const badge = tab.badge ? `<span class="sales-chip-badge">${esc(String(tab.badge))}</span>` : "";
      b.innerHTML = `${esc(tab.lab)}${badge}`;
    });
  }
}
function syncSalesShellChrome() {
  const shell = document.querySelector("#home-hub .sales-shell");
  if (!shell) return false;
  const wantPhone = isSalesPhoneLayout();
  const isPhone = shell.classList.contains("sales-shell--phone");
  if (wantPhone !== isPhone) return false;
  const blocks = buildSalesBlocks();
  if (!blocks.length) return false;
  if (!blocks.some((b) => b.id === hubSalesBlock)) hubSalesBlock = blocks[0].id;
  const cur = blocks.find((b) => b.id === hubSalesBlock) || blocks[0];
  if (hubSalesPane && !cur.tabs.some((t) => t.id === hubSalesPane)) hubSalesPane = "";

  shell.querySelectorAll("[data-sales-block]").forEach((b) => {
    b.classList.toggle("is-on", b.dataset.salesBlock === cur.id);
  });

  if (isPhone) {
    syncSalesPhoneSubs(shell, cur);
  } else {
    const sideTitle = shell.querySelector(".sales-side-title");
    if (sideTitle) sideTitle.textContent = cur.lab;
    const sideNav = shell.querySelector(".sales-side-nav");
    if (sideNav) {
      const existing = [...sideNav.querySelectorAll("[data-sales-pane]")].map((el) => el.dataset.salesPane).join("\0");
      const wanted = cur.tabs.map((t) => t.id).join("\0");
      if (existing !== wanted) {
        sideNav.innerHTML = cur.tabs.map(salesSideBtnHtml).join("");
      } else {
        sideNav.querySelectorAll("[data-sales-pane]").forEach((b) => {
          b.classList.toggle("is-on", b.dataset.salesPane === hubSalesPane);
          const tab = cur.tabs.find((t) => t.id === b.dataset.salesPane);
          if (tab?.badge) {
            const lab = b.querySelector(".sales-side-lab");
            if (lab) {
              const badge = `<span class="sales-side-badge">${esc(String(tab.badge))}</span>`;
              lab.innerHTML = `${esc(tab.lab)}${badge}`;
            }
          }
        });
      }
    }
  }
  const main = shell.querySelector(".sales-shell-main");
  if (main) {
    main.classList.toggle("is-landing", !hubSalesPane && !isPhone);
    if (!document.getElementById("sales-shell-mount")) {
      main.innerHTML = `<div id="sales-shell-mount" class="sales-shell-mount"></div>`;
    }
  }
  return true;
}
function restoreSalesMount() {
  if (!salesMount) return;
  const { el, parent, next } = salesMount;
  try {
    if (parent) {
      if (next && next.parentNode === parent) parent.insertBefore(el, next);
      else parent.appendChild(el);
    }
    el.hidden = true;
  } catch (_) {
    /* ignore */
  }
  salesMount = null;
}
function salesPaneBlockId(paneId) {
  if (["form", "today", "line", "short", "ship", "labels", "label-prints", "sitework"].includes(paneId)) return "orders";
  if (["stock", "in", "rack"].includes(paneId)) return "ware";
  return "acct";
}
function salesVirtualPage(paneId) {
  if (["form", "today", "line"].includes(paneId)) return "orders";
  if (["short", "ship"].includes(paneId)) return "plan";
  if (["stock", "in", "rack", "sales-bill", "ledger"].includes(paneId)) return "books";
  if (paneId === "cust" || paneId === "vendor") return "soon";
  return paneId;
}
function pageElForSalesPane(paneId) {
  switch (paneId) {
    case "form":
    case "today":
    case "line":
      return document.getElementById("page-orders");
    case "short":
    case "ship":
      return document.getElementById("page-plan");
    case "labels":
      return document.getElementById("page-labels");
    case "label-prints":
      return document.getElementById("page-label-prints");
    case "sitework":
      return document.getElementById("page-sitework");
    case "stock":
      return document.getElementById("page-stock");
    case "in":
      return document.getElementById("page-in");
    case "rack":
      return document.getElementById("page-rack");
    case "sales-bill":
      return document.getElementById("page-sales");
    case "ledger":
      return document.getElementById("page-ledger");
    case "cust":
    case "vendor":
      return document.getElementById("page-soon");
    case "help":
      return document.getElementById("page-help");
    case "stats":
      return document.getElementById("page-stats");
    default:
      return null;
  }
}
function salesPaneDenied(paneId) {
  const role = currentRole();
  if (paneId === "form" || paneId === "today" || paneId === "line") {
    if (!can("page-orders")) return "沒有下單權限。";
  } else if (paneId === "short") {
    if (!can("page-plan") || role === "driver") return "沒有現場排程權限。";
  } else if (paneId === "ship") {
    if (!can("page-plan")) return "沒有現場排程權限。";
  } else if (paneId === "labels") {
    if (!can("page-orders") && !can("page-plan") && !can("page-books")) return "沒有列印權限。";
  } else if (paneId === "label-prints") {
    if (!can("page-books")) return "沒有倉管／帳款權限。";
  } else if (paneId === "sitework") {
    if (!can("page-sitework")) return "現場工作建置中，暫僅主管可進入。";
  } else if (paneId === "stock") {
    if (!can("books-stock")) return "庫存盤點建置中，暫僅主管可進入。";
  } else if (paneId === "in" || paneId === "rack" || paneId === "sales-bill" || paneId === "ledger" || paneId === "cust" || paneId === "vendor") {
    if (!can("page-books")) return "沒有倉管／帳款權限。";
  } else if (paneId === "stats") {
    if (!can("page-stats")) return "僅主管可看統計。";
  }
  return "";
}
function applySalesPaneState(paneId) {
  if (paneId === "form" || paneId === "today" || paneId === "line") {
    ordersPane = paneId;
  } else if (paneId === "short" || paneId === "ship") {
    planMain = currentRole() === "driver" ? "ship" : paneId;
  } else if (paneId === "stock") {
    booksPart = "stock";
    stockWh = "";
    stockPhase = "pick";
  } else if (paneId === "in") {
    booksPart = "in";
  } else if (paneId === "rack") {
    booksPart = "rack";
    rackPick = "";
    rackLine = "";
    rackSrc = "";
  } else if (paneId === "sales-bill") {
    booksPart = "sales";
  } else if (paneId === "ledger") {
    booksPart = "ledger";
  } else if (paneId === "cust" || paneId === "vendor") {
    const copy = soonCopy(paneId);
    const title = document.getElementById("soon-title");
    const hint = document.getElementById("soon-hint");
    if (title) title.textContent = copy.title;
    if (hint) hint.textContent = copy.hint;
  } else if (paneId === "labels") {
    const el = document.getElementById("label-date");
    if (el && !el.value) el.value = today();
  } else if (paneId === "label-prints") {
    const el = document.getElementById("label-prints-date");
    if (el && !el.value) el.value = today();
  }
}
function runSalesPaneRenderers(paneId) {
  const saved = page;
  const vpage = salesVirtualPage(paneId);
  page = vpage;
  const run = (fn) => {
    try {
      fn();
    } catch (err) {
      console.error(err);
    }
  };
  try {
    if (vpage === "orders") {
      const orderForm = document.getElementById("order-form");
      if (orderForm) orderForm.hidden = false;
      const restBtn = document.getElementById("nq-rest-btn");
      if (restBtn) restBtn.hidden = false;
      const nqCancel = document.getElementById("nq-cancel-edit");
      if (nqCancel) nqCancel.hidden = true;
      run(syncShipMore);
      run(syncShipAddrUi);
      run(renderLineDrafts);
      run(renderCustSuggest);
      run(renderDailyGrid);
      run(renderSheet);
      run(renderCheck);
      run(renderOrders);
      run(renderRestList);
      run(() => applyOrdersPane(false));
      run(syncOrderEntering);
    } else if (vpage === "plan") {
      run(renderPlan);
      run(() => applyPlanPane());
      run(() => applyPlanMain(false));
    } else if (vpage === "books") {
      if (booksPart === "stock") run(renderStock);
      if (booksPart === "in") {
        run(renderStock);
        run(() => applyInPane(false));
      }
      if (booksPart === "sales") run(renderSalesBooks);
      if (booksPart === "ledger" && typeof window.renderBooksLedger === "function") run(window.renderBooksLedger);
      if (booksPart === "rack") run(renderRack);
    } else if (vpage === "labels") {
      run(renderLabels);
    } else if (vpage === "label-prints") {
      run(renderLabelPrints);
    } else if (vpage === "sitework" && typeof renderSiteWork === "function") {
      run(renderSiteWork);
    } else if (vpage === "help") {
      run(renderHelpFreight);
    } else if (vpage === "stats" && typeof renderBossStats === "function") {
      run(renderBossStats);
    } else if (vpage === "soon") {
      applySalesPaneState(paneId);
    }
  } finally {
    page = saved;
  }
}
function embedSalesPaneContent() {
  const mount = document.getElementById("sales-shell-mount");
  if (!mount || !hubSalesPane) return;
  const el = pageElForSalesPane(hubSalesPane);
  if (!el) return;
  // 已掛著同一個頁面就只刷新內容，不拆 DOM
  if (salesMount && salesMount.el === el && el.parentNode === mount) {
    el.hidden = false;
    runSalesPaneRenderers(hubSalesPane);
    syncOpsFlowTabs();
    return;
  }
  restoreSalesMount();
  salesMount = { el, parent: el.parentNode, next: el.nextSibling };
  mount.innerHTML = "";
  mount.appendChild(el);
  el.hidden = false;
  const main = document.querySelector(".sales-shell-main");
  if (main) main.classList.remove("is-landing");
  runSalesPaneRenderers(hubSalesPane);
  syncOpsFlowTabs();
}
function activateSalesPane(paneId) {
  const id = String(paneId || "").trim();
  if (!id) return;
  const deny = salesPaneDenied(id);
  if (deny) return setStatus(deny, true);
  if (document.body.classList.contains("order-entering") && id !== "form") {
    setStatus("正在輸入訂單，請先確認送出或清掉本單。", true);
    return;
  }
  hubSalesPane = id;
  hubDept = "sales";
  hubOpen = "";
  hubSalesBlock = salesPaneBlockId(id);
  applySalesPaneState(id);
  page = "home";
  document.body.classList.add("on-home", "sales-workspace");
  const pageHome = document.getElementById("page-home");
  if (pageHome) pageHome.hidden = false;
  // 殼已在：只鎖上／側欄、換中間工作區（不整頁 render）
  if (document.querySelector("#home-hub .sales-shell") && syncSalesShellChrome()) {
    embedSalesPaneContent();
    return;
  }
  render();
}
function goFromHub(btn) {
  const go = btn.dataset.go;
  if (go === "orders") {
    return goOpsStep(normalizeOrdersPane(btn.dataset.ordersPane));
  } else if (go === "plan") {
    return goOpsStep(btn.dataset.planMain === "ship" ? "ship" : "short");
  } else if (go === "books") {
    const part = btn.dataset.books || "stock";
    if (part === "stock") {
      // TEMP: 庫存未完成，暫僅雅芳
      if (!can("books-stock")) return setStatus("庫存盤點建置中，暫僅主管可進入。", true);
    } else if (!can("page-books")) {
      return setStatus("沒有倉管／帳款權限。", true);
    }
    page = "books";
    booksPart = part;
    if (booksPart === "stock") {
      stockWh = String(btn.dataset.stockWh || "").trim();
      stockPhase = btn.dataset.stockPhase || (stockWh ? "count" : "pick");
      if (!stockWh) stockPhase = "pick";
    } else {
      stockWh = "";
      stockPhase = "pick";
    }
    if (booksPart === "rack") {
      rackPick = "";
      rackLine = "";
      rackSrc = "";
    }
  } else if (go === "import") {
    if (!can("page-import")) return setStatus("進口目前僅開放給雅芳。", true);
    if (typeof window.openImport === "function") {
      window.openImport(btn.dataset.import || "status");
    } else {
      page = "import";
      hubOpen = "";
    }
  } else if (go === "unpack") {
    // TEMP: 拆櫃未完成，暫僅雅芳（勿再用 page-books 放行）
    if (!can("page-unpack")) return setStatus("拆櫃回報建置中，暫僅主管可進入。", true);
    page = "unpack";
    hubOpen = "";
  } else if (go === "sitework") {
    // TEMP: 現場未完成，暫僅雅芳（勿再用 page-books 放行）
    if (!can("page-sitework")) return setStatus("現場工作建置中，暫僅主管可進入。", true);
    page = "sitework";
    hubOpen = "";
  } else if (go === "stats") {
    if (!can("page-stats")) return setStatus("僅主管可看統計。", true);
    page = "stats";
    hubOpen = "";
  } else if (go === "help") {
    page = "help";
  } else if (go === "labels") {
    if (!can("page-orders") && !can("page-plan") && !can("page-books")) return setStatus("沒有列印權限。", true);
    page = "labels";
    const el = document.getElementById("label-date");
    if (el && !el.value) el.value = today();
  } else if (go === "label-prints") {
    if (!can("page-books")) return setStatus("沒有倉管／帳款權限。", true);
    page = "label-prints";
    const el = document.getElementById("label-prints-date");
    if (el && !el.value) el.value = today();
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
function solarDayOfYear(ymd) {
  const [y, m, d] = String(ymd || today()).split("-").map(Number);
  if (!y || !m || !d) return 0;
  const start = Date.UTC(y, 0, 1);
  const cur = Date.UTC(y, m - 1, d);
  return Math.floor((cur - start) / 86400000) + 1;
}
function solarDateText(ymd) {
  const n = solarDayOfYear(ymd);
  return n ? String(n) : String(ymd || "");
}
function padLabelSeq(n) {
  return String(Math.max(1, Number(n) || 1)).padStart(3, "0");
}
function labelDateValue() {
  return document.getElementById("label-date")?.value || today();
}
function labelCopiesValue() {
  return Math.max(1, Math.min(99, Number(document.getElementById("label-copies")?.value) || 1));
}
function labelTextNameParts(name) {
  return String(name || "").trim() === "紅骨九層塔" ? ["紅骨", "九層塔"] : null;
}
function skuIdFromLabelName(name) {
  const n = String(name || "").trim();
  if (!n) return "";
  const hit = SKUS.find((s) => labelFamilyName(s) === n);
  return hit ? hit.id : "";
}
function shipProductHtml(name) {
  const n = String(name || "").trim();
  const parts = labelTextNameParts(n);
  if (parts) return parts.map((p) => `<span>${esc(p)}</span>`).join("");
  return esc(n);
}
function labelMdText(forceFromDate) {
  const m = Number(document.getElementById("label-md-m")?.value);
  const d = Number(document.getElementById("label-md-d")?.value);
  if (m && d) return `${m}/${d}`;
  if (!forceFromDate) return "";
  const [y, mm, dd] = String(labelDateValue()).split("-").map(Number);
  if (!mm || !dd) return "";
  return `${mm}/${dd}`;
}
function loadLabelRun(day) {
  try {
    const raw = JSON.parse(localStorage.getItem(LABEL_RUN_KEY) || "{}");
    if (raw && raw.day === day) return { day, n: Number(raw.n) || 0 };
  } catch (_) {}
  return { day, n: 0 };
}
function saveLabelRun(run) {
  localStorage.setItem(LABEL_RUN_KEY, JSON.stringify({ day: run.day, n: Number(run.n) || 0 }));
}
function loadLabelPrints() {
  try {
    const raw = JSON.parse(localStorage.getItem(LABEL_PRINTS_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((x) => x && x.id) : [];
  } catch (_) {
    return [];
  }
}
function saveLabelPrints(list) {
  try {
    localStorage.setItem(LABEL_PRINTS_KEY, JSON.stringify(Array.isArray(list) ? list.slice(0, 500) : []));
  } catch (_) {}
}
function mergeLabelPrints(a, b) {
  const map = new Map();
  for (const x of [...(a || []), ...(b || [])]) {
    if (!x?.id) continue;
    const cur = map.get(x.id);
    if (!cur || Number(x.at || 0) >= Number(cur.at || 0)) map.set(x.id, x);
  }
  return [...map.values()].sort((p, q) => Number(q.at || 0) - Number(p.at || 0)).slice(0, 500);
}
function recordLabelPrint(entry) {
  const list = loadLabelPrints();
  list.unshift({
    id: `lp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    staff: currentStaff() || "",
    ...entry,
  });
  saveLabelPrints(list);
  scheduleCloudPush();
}
function labelPrintKindName(kind) {
  if (kind === "text") return "文字";
  if (kind === "container") return "貨櫃";
  if (kind === "ship") return "出貨";
  return kind || "—";
}
function labelPrintSummary(row) {
  if (!row) return "—";
  if (row.kind === "text") {
    const bits = [row.text || ""];
    if (row.remark) bits.push(`備註 ${row.remark}`);
    if (row.seqFrom) bits.push(row.seqFrom === row.seqTo ? `#${row.seqFrom}` : `#${row.seqFrom}–${row.seqTo}`);
    return bits.filter(Boolean).join("　");
  }
  if (row.kind === "container") {
    const head = [row.name, row.country, row.vendor].filter(Boolean).join("／");
    const codes = Array.isArray(row.codes) ? row.codes.filter(Boolean) : [];
    const codeTxt = codes.length > 1 ? `${codes[0]}–${codes[codes.length - 1]}` : codes[0] || row.box || "";
    return [head, codeTxt].filter(Boolean).join("　");
  }
  if (row.kind === "ship") {
    const bits = [`${row.customer || ""}／${row.sku || ""}`];
    if (row.seqFrom) bits.push(row.seqFrom === row.seqTo ? `#${row.seqFrom}` : `#${row.seqFrom}–${row.seqTo}`);
    return bits.filter(Boolean).join("　");
  }
  return "—";
}
function labelPrintTimeText(at) {
  const d = new Date(Number(at) || 0);
  if (!Number.isFinite(d.getTime()) || !d.getTime()) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function renderLabelPrints() {
  const pageEl = document.getElementById("page-label-prints");
  if (!pageEl || page !== "label-prints") return;
  const dateEl = document.getElementById("label-prints-date");
  if (dateEl && !dateEl.value) dateEl.value = today();
  const day = String(dateEl?.value || today());
  const kind = labelPrintFilterKind || "all";
  document.querySelectorAll("#label-prints-kind-tabs [data-label-prints-kind]").forEach((b) => {
    b.classList.toggle("on", b.dataset.labelPrintsKind === kind);
  });
  const rows = loadLabelPrints().filter((r) => {
    if (String(r.day || "") !== day) return false;
    if (kind !== "all" && r.kind !== kind) return false;
    return true;
  });
  const box = document.getElementById("label-prints-list");
  const hint = document.getElementById("label-prints-hint");
  if (hint) {
    hint.textContent = rows.length
      ? `${day} 共 ${rows.length} 筆列印紀錄。`
      : `${day} 尚無列印紀錄。`;
  }
  if (!box) return;
  if (!rows.length) {
    box.innerHTML = `<p class="muted">這天還沒有印製明細。</p>`;
    return;
  }
  box.innerHTML = `<div class="order-cards">${rows
    .map((r) => {
      const copies = Number(r.copies) || 0;
      return `<article class="order-card">
        <div class="order-card-head">
          <strong>${esc(labelPrintKindName(r.kind))}</strong>
          <span class="muted">${esc(labelPrintTimeText(r.at))}${r.staff ? ` · ${esc(r.staff)}` : ""}</span>
        </div>
        <p class="label-print-sum">${esc(labelPrintSummary(r))}</p>
        <p class="muted">張數 ${copies}</p>
      </article>`;
    })
    .join("")}</div>`;
}
function labelProductText(l) {
  const s = skuById(l.skuId);
  const name = lineSkuName(l);
  const ban = lineBanText(l) ? ` ${lineBanText(l)}` : "";
  const pack = l.pack ? ` ${l.pack}` : "";
  const size = l.size ? ` ${l.size}` : "";
  const spec = lineSpecText(l) ? ` ${lineSpecText(l)}` : "";
  const ship = lineShipMetaText(l) ? ` ${lineShipMetaText(l)}` : "";
  const unit = Number(l.qty) > 0 ? s?.unit || "件" : "";
  return `${name}${ban}${pack}${size}${spec}${ship} ${lineQtyText(l)}${unit}`;
}
function labelRemarkText(o, l) {
  const bits = [];
  const remark = String(o.remark || "").trim();
  const note = String(l.note || "").trim();
  if (remark) bits.push(remark);
  if (note && note !== remark) bits.push(note);
  return bits.join("　");
}
function labelFamilyName(sku) {
  return skuShortName(sku)
    .split("／")[0]
    .replace(/散賣kg|散賣斤/g, "")
    .trim();
}
function labelTextPresets() {
  const names = new Set();
  for (const s of SKUS) {
    if (s.custom) continue;
    const fam = labelFamilyName(s);
    if (fam && fam !== "自行輸入") names.add(fam);
  }
  return [...names];
}
const LABEL_CONT_NAMES = ["高麗菜", "白菜", "白蘿蔔", "洋蔥", "美生菜", "牛蒡", "南瓜", "青花菜", "辣椒"];
const LABEL_CONT_COUNTRIES = ["中國", "韓國", "越南", "印尼", "美國", "紐西蘭", "澳洲"];
function labelContTitle() {
  return [labelContName, labelContCountry, labelContVendor].map((s) => String(s || "").trim()).filter(Boolean).join(" ");
}
function padContSeq(n) {
  return String(Math.max(1, Number(n) || 1)).padStart(2, "0");
}
function labelContCodeParts(box, ymd, seqN) {
  const [y, m, d] = String(ymd || today()).split("-").map(Number);
  const mm = String(m || 0).padStart(2, "0");
  const dd = String(d || 0).padStart(2, "0");
  const no = String(box || "").replace(/\s+/g, "");
  const seq = padContSeq(seqN);
  return { no, md: `${mm}${dd}`, seq, full: `${no}${mm}${dd}${seq}` };
}
function labelContCode(box, ymd, seqN) {
  return labelContCodeParts(box, ymd, seqN).full;
}
function labelContNoPresets() {
  const names = new Set();
  for (const l of allContainerLots()) {
    const box = String(l.container || "").trim();
    const uha = String(l.uha || "").trim();
    if (box) names.add(box);
    if (uha) names.add(uha);
  }
  return [...names];
}
function labelChipHtml(list, cur, attr) {
  return list
    .map((name) => {
      const on = name === cur ? " on" : "";
      return `<button type="button" class="pick${on}" ${attr}="${esc(name)}">${esc(name)}</button>`;
    })
    .join("");
}
function labelRowsForDay(day) {
  const rows = [];
  const list = (state.orders || []).filter((o) => {
    if ((o.shipDate || today()) !== day) return false;
    if (o.status === "cancelled" || o.status === "deleted") return false;
    return true;
  });
  list.sort(
    (a, b) =>
      String(a.customer || "").localeCompare(b.customer || "", "zh-Hant") ||
      orderNoSortKey(a.no) - orderNoSortKey(b.no),
  );
  for (const o of list) {
    (o.lines || []).forEach((l, i) => {
      if (!lineHasItem(l)) return;
      rows.push({
        key: `${o.id}:${i}`,
        customer: o.customer || "",
        sku: labelProductText(l),
        remark: labelRemarkText(o, l),
        solar: solarDateText(o.shipDate || day),
        orderNo: o.no,
      });
    });
  }
  return rows;
}
function ensureLabelSel(day, rows) {
  if (labelDayLock !== day) {
    labelDayLock = day;
    labelSel = new Set(rows.map((r) => r.key));
    return;
  }
  const keys = new Set(rows.map((r) => r.key));
  for (const k of [...labelSel]) if (!keys.has(k)) labelSel.delete(k);
}
/**
 * Artwork is landscape 寬版 70×50 (user / physical sticker look).
 * Thermal drivers usually expect portrait 50×70 feed, so print wraps each sticker in
 * .label-page and rotates -90° onto @page 50×70. On-screen preview stays 70×50 WYSIWYG.
 */
const LABEL_PRINT_W_MM = 70;
const LABEL_PRINT_H_MM = 50;
function labelPrintNeedsRotate() {
  return LABEL_PRINT_W_MM > LABEL_PRINT_H_MM;
}
/**
 * Print path injects this CSS into a blank window — styles.css is NOT used for printing.
 *
 * Layout (CSS grid, all in-flow — no absolute footers):
 *   article.label-sticker  fixed 70×50, overflow hidden, grid rows: 1fr | auto
 *     main (客戶／品名／貨櫃編號; minmax(0,1fr) so foot cannot spill to page 2)
 *     foot/meta (太陽日／流水; container = 國別／廠商); bottom 5mm pad reserved
 */
function labelPrintCss() {
  const w = LABEL_PRINT_W_MM;
  const h = LABEL_PRINT_H_MM;
  const rotate = labelPrintNeedsRotate();
  const pageW = rotate ? h : w;
  const pageH = rotate ? w : h;
  const pageRule = `@page { size: ${pageW}mm ${pageH}mm; margin: 0; }`;
  // Do not put transform:none on .label-sticker — rotate print needs it.
  const sharpen = `* {
  box-sizing: border-box;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
  text-shadow: none !important; box-shadow: none !important;
  filter: none !important; opacity: 1 !important;
  -webkit-font-smoothing: none;
}
.label-sticker * {
  transform: none !important;
}`;
  const stickerBase = `width: ${w}mm; height: ${h}mm; max-height: ${h}mm;
  margin: 0; padding: 1.2mm 2.2mm 5mm; box-sizing: border-box;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  align-content: stretch; justify-items: stretch;
  overflow: hidden;
  font-family: "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif;
  color: #000; background: #fff;`;
  const frame = rotate
    ? `.label-page {
  width: ${pageW}mm; height: ${pageH}mm; margin: 0; padding: 0; overflow: hidden;
  position: relative; box-sizing: border-box;
  page-break-inside: avoid; break-inside: avoid;
  page-break-after: always; break-after: page;
}
.label-page:last-child { page-break-after: auto; break-after: auto; }
.label-sticker {
  ${stickerBase}
  position: absolute; top: 0; left: 0;
  transform: translate(0, ${w}mm) rotate(-90deg);
  transform-origin: top left;
}`
    : `.label-sticker {
  ${stickerBase}
  page-break-inside: avoid; break-inside: avoid;
  page-break-after: always; break-after: page;
}
.label-sticker:last-child { page-break-after: auto; break-after: auto; }`;
  return `${pageRule}
html, body {
  margin: 0; padding: 0; background: #fff;
  width: ${pageW}mm; max-width: ${pageW}mm;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
${sharpen}
${frame}
.sticker-foot {
  grid-row: 2; align-self: end;
  display: flex; align-items: baseline; justify-content: space-between;
  width: 100%; gap: 1.5mm; margin: 0.4mm 0 1.6mm; padding: 0;
  min-height: 3.2mm; max-height: 4.2mm;
  font-size: 3.2mm; font-weight: 800; letter-spacing: 0.04em; line-height: 1;
  color: #000; overflow: hidden;
}
.sticker-foot-left, .sticker-foot-right {
  margin: 0; max-width: 48%; white-space: nowrap; overflow: hidden;
}
.sticker-foot:empty { display: none; }
.label-sticker.is-text { text-align: center; }
.sticker-text-main {
  grid-row: 1; min-height: 0; max-height: 100%; width: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  overflow: hidden; font-size: 15mm; color: #000;
}
.sticker-text-main.is-long { font-size: 10mm; }
.sticker-text-main.is-split { font-size: 12.5mm; }
.sticker-text-only {
  display: flex; align-items: center; justify-content: center;
  width: 100%; margin: 0;
  font-size: 1em; font-weight: 900; line-height: 0.95; letter-spacing: 0.05em;
  word-break: break-word; overflow: hidden; color: #000;
}
.sticker-text-only.is-long { letter-spacing: 0.02em; }
.sticker-text-only.is-split {
  flex-direction: column; gap: 0.3mm; letter-spacing: 0.03em; line-height: 0.92;
}
.sticker-text-only.is-split span { display: block; }
.sticker-text-remark {
  margin: 1mm 0 0; font-size: 0.62em; font-weight: 800;
  line-height: 1.05; letter-spacing: 0.03em; word-break: break-word; overflow: hidden;
  color: #000;
}
.label-sticker.is-ship { text-align: center; }
.sticker-ship-main {
  grid-row: 1; min-height: 0; max-height: 100%; width: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  overflow: hidden; font-size: 15mm; color: #000;
}
.sticker-ship-main.is-long { font-size: 12mm; }
.sticker-ship-cust {
  margin: 0; max-width: 100%;
  font-size: 1em; font-weight: 900; line-height: 0.95; letter-spacing: 0.05em;
  word-break: break-word; overflow: hidden; color: #000;
}
.sticker-ship-sku {
  margin: 1.6mm 0 0; max-width: 100%;
  font-size: 0.88em; font-weight: 800; line-height: 1.02; letter-spacing: 0.03em;
  word-break: break-word; overflow: hidden; color: #000;
  display: flex; flex-direction: column; align-items: center; gap: 0.3mm;
}
.sticker-ship-sku span { display: block; }
.label-sticker.is-container { text-align: center; padding: 1mm 2mm 5mm; }
.sticker-cont-main {
  grid-row: 1; min-height: 0; max-height: 100%; width: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 1.4mm; overflow: hidden; padding: 0 0.2mm; color: #000;
}
.sticker-cont-name {
  flex: 0 1 auto; margin: 0; padding: 0 0.2mm; width: 100%;
  font-size: 14mm; font-weight: 900; line-height: 0.9; letter-spacing: 0.02em;
  white-space: nowrap; overflow: hidden; word-break: keep-all; color: #000;
}
.sticker-cont-name.is-long { font-size: 10.5mm; letter-spacing: 0.012em; }
.label-sticker.is-container .sticker-box {
  flex: 0 0 auto; margin: 0; padding: 0; width: 100%; max-width: 100%;
  display: flex; align-items: center; justify-content: center; flex-wrap: nowrap;
  gap: 0.35mm 0.5mm;
  font-size: 9mm; font-weight: 900; letter-spacing: 0; line-height: 1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-variant-numeric: tabular-nums; color: #000;
}
.label-sticker.is-container .sticker-box.is-wide { font-size: 7.8mm; gap: 0.28mm; }
.label-sticker.is-container .sticker-box.is-xwide { font-size: 6.6mm; gap: 0.22mm; }
.sticker-box-no, .sticker-box-md, .sticker-box-seq { display: inline-block; }
.sticker-box-md, .sticker-box-seq { letter-spacing: 0.02em; }
.sticker-cont-meta {
  grid-row: 2; align-self: end;
  margin: 0 0 0.8mm; padding-top: 0.3mm; max-height: 5.5mm;
  display: flex; flex-wrap: nowrap; align-items: baseline; justify-content: center;
  gap: 1mm 1.4mm;
  font-size: 4.5mm; font-weight: 700; line-height: 1.05; letter-spacing: 0.04em;
  overflow: hidden; white-space: nowrap; color: #000;
}
.sticker-cont-main:has(.sticker-cont-name.is-long) ~ .sticker-cont-meta { font-size: 4.1mm; }
.sticker-cont-country, .sticker-cont-vendor { font-size: 1em; font-weight: 700; }`;
}
function stickerFootHtml(left, right) {
  const L = String(left || "").trim();
  const R = String(right || "").trim();
  if (!L && !R) return "";
  return `<footer class="sticker-foot"><span class="sticker-foot-left">${esc(L)}</span><span class="sticker-foot-right">${esc(R)}</span></footer>`;
}
function labelStickerHtml(item, forPrint) {
  const kind = item.kind || "ship";
  const cls = `label-sticker${kind === "text" ? " is-text" : kind === "container" ? " is-container" : kind === "ship" ? " is-ship" : ""}${forPrint ? " is-print" : ""}`;
  if (kind === "text") {
    const name = String(item.text || "").trim();
    const parts = labelTextNameParts(name);
    const split = parts ? " is-split" : "";
    const long = !parts && name.length > 4 ? " is-long" : "";
    const nameHtml = parts
      ? `<p class="sticker-text-only is-split">${parts.map((p) => `<span>${esc(p)}</span>`).join("")}</p>`
      : `<p class="sticker-text-only${long}">${esc(name)}</p>`;
    const remark = String(item.remark || "").trim();
    const remarkHtml = remark ? `<p class="sticker-text-remark">${esc(remark)}</p>` : "";
    const solar = String(item.solar || "").trim();
    const seq = String(item.seq || "").trim();
    return `<article class="${cls}">
      <div class="sticker-text-main${long}${split}">${nameHtml}${remarkHtml}</div>
      ${stickerFootHtml(seq, solar)}
    </article>`;
  }
  if (kind === "container") {
    const name = String(item.name || item.sku || "").trim();
    const long = name.length > 4 ? " is-long" : "";
    const country = String(item.country || "").trim();
    const vendor = String(item.vendor || "").trim();
    const metaBits = [];
    if (country) metaBits.push(`<span class="sticker-cont-country">${esc(country)}</span>`);
    if (vendor) metaBits.push(`<span class="sticker-cont-vendor">${esc(vendor)}</span>`);
    const meta = metaBits.length ? `<p class="sticker-cont-meta">${metaBits.join("")}</p>` : "";
    const parts = item.boxParts || null;
    const box = String(item.box || parts?.full || "").trim();
    const no = String(parts?.no || box).trim();
    const md = String(parts?.md || "").trim();
    const seq = String(parts?.seq || "").trim();
    const codeHtml = parts && (md || seq)
      ? `<span class="sticker-box-no">${esc(no)}</span>${md ? `<span class="sticker-box-md">${esc(md)}</span>` : ""}${seq ? `<span class="sticker-box-seq">${esc(seq)}</span>` : ""}`
      : esc(box);
    const fullLen = (parts?.full || box).length;
    // 寬版 70mm: typical UHA223+MMDD+seq ≈ 12 fits large; scale only for longer codes
    const boxWide = fullLen > 15 ? " is-xwide" : fullLen > 14 ? " is-wide" : "";
    return `<article class="${cls}">
      <div class="sticker-cont-main">
        <p class="sticker-cont-name${long}">${esc(name)}</p>
        <p class="sticker-box${boxWide}">${codeHtml}</p>
    </div>
      ${meta}
    </article>`;
  }
  const cust = String(item.customer || "").trim() || "（未填客戶）";
  const sku = String(item.sku || item.text || "").trim();
  const skuSplit = labelTextNameParts(sku) ? " is-split" : "";
  const custLong = cust.length > 4 ? " is-long" : "";
  const solar = String(item.solar || "").trim();
  const seq = String(item.seq || "").trim();
  return `<article class="${cls}">
    <div class="sticker-ship-main${custLong}">
      <p class="sticker-ship-cust">${esc(cust)}</p>
      ${sku ? `<p class="sticker-ship-sku${skuSplit}">${shipProductHtml(sku)}</p>` : ""}
    </div>
    ${stickerFootHtml(solar, seq)}
  </article>`;
}
function openLabelPrint(cards) {
  const body = labelPrintNeedsRotate()
    ? cards.map((c) => `<div class="label-page">${c}</div>`).join("")
    : cards.join("");
  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="UTF-8" /><title>標籤貼紙</title>
<style>${labelPrintCss()}</style></head><body>${body}</body></html>`;
  let w = null;
  try {
    // Do not pass noopener here — it makes window.open return null and print never runs.
    w = window.open("", "_blank", "width=560,height=420");
  } catch (_) {
    w = null;
  }
  if (w) {
    try {
      try {
        w.opener = null;
      } catch (_) {}
      w.document.open();
      w.document.write(html);
      w.document.close();
      setTimeout(() => {
        try {
          w.focus();
          w.print();
        } catch (_) {}
      }, 200);
      return w;
    } catch (_) {
      try {
        w.close();
      } catch (_) {}
    }
  }
  // Fallback when popup is blocked (common on phones / in-app browsers).
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) throw new Error("no-frame");
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (_) {
        setStatus("無法開啟列印，請允許彈出視窗後再試。", true);
      }
      setTimeout(() => {
        try {
          iframe.remove();
        } catch (_) {}
      }, 1500);
    }, 250);
    return iframe.contentWindow;
  } catch (_) {
    try {
      iframe.remove();
    } catch (_) {}
    setStatus("瀏覽器擋住列印視窗，請允許彈出後再按一次列印。", true);
    return null;
  }
}
function labelFieldBusy(el) {
  return el && (document.activeElement === el || el.dataset.composing === "1");
}
function bindLabelImeInput(el, apply) {
  if (!el || el.dataset.imeBound === "1") return;
  el.dataset.imeBound = "1";
  el.addEventListener("compositionstart", () => {
    el.dataset.composing = "1";
  });
  el.addEventListener("compositionupdate", () => {
    el.dataset.composing = "1";
  });
  el.addEventListener("compositionend", () => {
    el.dataset.composing = "";
    apply(String(el.value || ""));
    renderLabels();
  });
  el.addEventListener("input", (e) => {
    if (e.isComposing || el.dataset.composing === "1") return;
    apply(String(el.value || ""));
    renderLabels();
  });
}
function syncLabelInputs() {
  const textEl = document.getElementById("label-text-custom");
  if (textEl && !labelFieldBusy(textEl) && textEl.value !== labelText) textEl.value = labelText;
  const remarkEl = document.getElementById("label-text-remark");
  if (remarkEl && !labelFieldBusy(remarkEl) && remarkEl.value !== labelTextRemark) remarkEl.value = labelTextRemark;
  const nameEl = document.getElementById("label-cont-name");
  if (nameEl && !labelFieldBusy(nameEl) && nameEl.value !== labelContName) nameEl.value = labelContName;
  const countryEl = document.getElementById("label-cont-country");
  if (countryEl && !labelFieldBusy(countryEl) && countryEl.value !== labelContCountry) countryEl.value = labelContCountry;
  const vendorEl = document.getElementById("label-cont-vendor");
  if (vendorEl && !labelFieldBusy(vendorEl) && vendorEl.value !== labelContVendor) vendorEl.value = labelContVendor;
  const noEl = document.getElementById("label-cont-no");
  if (noEl && !labelFieldBusy(noEl) && noEl.value !== labelContNo) noEl.value = labelContNo;
  const custEl = document.getElementById("label-ship-cust");
  if (custEl && !labelFieldBusy(custEl) && custEl.value !== labelShipCust) custEl.value = labelShipCust;
  const shipSkuEl = document.getElementById("label-ship-sku");
  if (shipSkuEl && !labelFieldBusy(shipSkuEl) && shipSkuEl.value !== labelShipSku) shipSkuEl.value = labelShipSku;
}
function renderLabels() {
  const pageEl = document.getElementById("page-labels");
  if (!pageEl || page !== "labels") return;
  const dateEl = document.getElementById("label-date");
  if (dateEl && !dateEl.value) dateEl.value = today();
  const day = labelDateValue();
  const rows = labelRowsForDay(day);
  ensureLabelSel(day, rows);
  const run = loadLabelRun(day);
  const nextEl = document.getElementById("label-next-seq");
  const seqCaption = document.getElementById("label-seq-caption");
  if (seqCaption) seqCaption.textContent = labelKind === "container" ? "下一組編號" : "本趟下一號";
  if (nextEl) {
    nextEl.textContent =
      labelKind === "container"
        ? labelContCode(labelContNo || "UHA158", day, run.n + 1)
        : padLabelSeq(run.n + 1);
  }
  const isText = labelKind === "text";
  const isCont = labelKind === "container";
  const isShip = labelKind === "ship";
  document.querySelectorAll("#label-kind-tabs [data-label-kind]").forEach((b) => {
    b.classList.toggle("on", b.dataset.labelKind === labelKind);
  });
  const hint = document.getElementById("label-kind-hint");
  if (hint) hint.textContent = "熱感紙 70mm × 50mm（寬版）。預覽＝印出樣子。";
  const paneText = document.getElementById("label-pane-text");
  const paneCont = document.getElementById("label-pane-container");
  const paneShip = document.getElementById("label-pane-ship");
  if (paneText) paneText.hidden = !isText;
  if (paneCont) paneCont.hidden = !isCont;
  if (paneShip) paneShip.hidden = !isShip;
  const dateWrap = document.getElementById("label-date-wrap");
  const contDateSlot = document.getElementById("label-cont-date-slot");
  const sharedBar = document.getElementById("label-shared-bar");
  if (dateWrap && contDateSlot && sharedBar) {
    if (isCont) {
      if (dateWrap.parentElement !== contDateSlot) contDateSlot.appendChild(dateWrap);
      dateWrap.hidden = false;
    } else {
      if (dateWrap.parentElement !== sharedBar) sharedBar.insertBefore(dateWrap, sharedBar.firstChild);
      dateWrap.hidden = isText ? !labelSolarOn : false;
    }
  }
  const mdM = document.getElementById("label-md-m-wrap");
  const mdD = document.getElementById("label-md-d-wrap");
  const copiesWrap = document.getElementById("label-copies-wrap");
  const seqLine = document.getElementById("label-seq-line");
  const solarEl = document.getElementById("label-solar-on");
  const seqOnEl = document.getElementById("label-seq-on");
  if (solarEl) solarEl.checked = labelSolarOn;
  if (seqOnEl) seqOnEl.checked = labelSeqOn;
  if (mdM) mdM.hidden = true;
  if (mdD) mdD.hidden = true;
  if (copiesWrap) copiesWrap.hidden = false;
  const copiesCap = document.getElementById("label-copies-caption");
  if (copiesCap) copiesCap.textContent = isShip ? "出貨數量" : "張數";
  if (seqLine) seqLine.hidden = isText ? !labelSeqOn : false;
  const allBtn = document.getElementById("label-all");
  const noneBtn = document.getElementById("label-none");
  const resetBtn = document.getElementById("label-reset-seq");
  if (allBtn) allBtn.hidden = true;
  if (noneBtn) noneBtn.hidden = true;
  if (resetBtn) resetBtn.hidden = isText ? !labelSeqOn : false;
  const textChips = document.getElementById("label-text-chips");
  if (textChips) textChips.innerHTML = labelChipHtml(labelTextPresets(), labelText, "data-label-text");
  const shipChips = document.getElementById("label-ship-chips");
  if (shipChips) shipChips.innerHTML = labelChipHtml(labelTextPresets(), labelShipSku, "data-label-ship-sku");
  const nameChips = document.getElementById("label-cont-name-chips");
  if (nameChips) nameChips.innerHTML = labelChipHtml(LABEL_CONT_NAMES, labelContName, "data-label-cont-name");
  const countryChips = document.getElementById("label-cont-country-chips");
  if (countryChips) countryChips.innerHTML = labelChipHtml(LABEL_CONT_COUNTRIES, labelContCountry, "data-label-cont-country");
  const noChips = document.getElementById("label-cont-no-chips");
  if (noChips) {
    const nos = labelContNoPresets();
    noChips.innerHTML = nos.length
      ? labelChipHtml(nos.slice(0, 24), labelContNo, "data-label-cont-no")
      : `<p class="muted">沒有匯入的貨櫃清單時，請直接打編號。</p>`;
  }
  syncLabelInputs();
  const msg = document.getElementById("label-msg");
  if (msg) {
    if (isText) msg.textContent = labelText
      ? `將印「${labelText}」${labelSolarOn ? `太陽日 ${solarDateText(day)}　` : ""}${labelSeqOn ? `流水 ${padLabelSeq(run.n + 1)}　` : ""}${labelCopiesValue()} 張`
      : "請點選或輸入品項文字。";
    else if (isCont) {
      const title = labelContTitle();
      const code = labelContCode(labelContNo || "UHA158", day, run.n + 1);
      msg.textContent = title && labelContNo
        ? `將印「${title}」／${code}　${labelCopiesValue()} 張`
        : "請填品名、國別、廠商與貨櫃編號。";
    }
    else msg.textContent = labelShipCust && labelShipSku
      ? `將印「${labelShipCust}／${labelShipSku}」太陽日 ${solarDateText(day)}　流水 ${padLabelSeq(run.n + 1)}　${labelCopiesValue()} 張`
      : "請填客戶與品項。";
  }
  const preview = document.getElementById("label-preview");
  if (preview) {
    if (isText) {
    preview.innerHTML = labelStickerHtml({
        kind: "text",
        text: labelText || "南瓜",
        remark: labelTextRemark,
        solar: labelSolarOn ? solarDateText(day) : "",
        seq: labelSeqOn ? padLabelSeq(run.n + 1) : "",
      });
    } else if (isCont) {
      preview.innerHTML = labelStickerHtml({
        kind: "container",
        name: labelContName || "高麗菜",
        country: labelContCountry,
        vendor: labelContVendor,
        boxParts: labelContCodeParts(labelContNo || "UHA158", day, run.n + 1),
      });
    } else {
      preview.innerHTML = labelStickerHtml({
        kind: "ship",
        customer: labelShipCust || "客戶",
        sku: labelShipSku || "南瓜",
        solar: solarDateText(day),
      seq: padLabelSeq(run.n + 1),
    });
    }
  }
}
function printSelectedLabels() {
  const day = labelDateValue();
  const copies = labelCopiesValue();
  if (labelKind === "text") {
    const text = String(labelText || document.getElementById("label-text-custom")?.value || "").trim();
    if (!text) return setStatus("請先填要印的文字。", true);
    labelText = text;
    labelTextRemark = String(labelTextRemark || document.getElementById("label-text-remark")?.value || "").trim();
    const solar = labelSolarOn ? solarDateText(day) : "";
  const run = loadLabelRun(day);
    const cards = Array.from({ length: copies }, (_, i) =>
    labelStickerHtml(
      {
          kind: "text",
          text,
          remark: labelTextRemark,
          solar,
          seq: labelSeqOn ? padLabelSeq(run.n + i + 1) : "",
      },
      true,
    ),
  );
    if (!openLabelPrint(cards)) return;
    const seqFrom = labelSeqOn ? padLabelSeq(run.n + 1) : "";
    const seqTo = labelSeqOn ? padLabelSeq(run.n + copies) : "";
    if (labelSeqOn) {
      run.n += copies;
      saveLabelRun(run);
    }
    recordLabelPrint({
      day,
      kind: "text",
      copies,
      text,
      remark: labelTextRemark,
      solar: solar || "",
      seqFrom,
      seqTo,
    });
    renderLabels();
    return setStatus(
      labelSeqOn
        ? `已送出文字標籤 ${copies} 張，下一號 ${padLabelSeq(run.n + 1)}。`
        : `已送出文字標籤 ${copies} 張。`,
    );
  }
  if (labelKind === "container") {
    const sku = String(labelContName || document.getElementById("label-cont-name")?.value || "").trim();
    const country = String(labelContCountry || document.getElementById("label-cont-country")?.value || "").trim();
    const vendor = String(labelContVendor || document.getElementById("label-cont-vendor")?.value || "").trim();
    const box = String(labelContNo || document.getElementById("label-cont-no")?.value || "").trim();
    if (!sku) return setStatus("請先填品名。", true);
    if (!country) return setStatus("請先填國別。", true);
    if (!vendor) return setStatus("請先填廠商。", true);
    if (!box) return setStatus("請先填貨櫃編號。", true);
    labelContName = sku;
    labelContCountry = country;
    labelContVendor = vendor;
    labelContNo = box;
    const run = loadLabelRun(day);
    const cards = Array.from({ length: copies }, (_, i) =>
      labelStickerHtml(
        {
          kind: "container",
          name: sku,
          country,
          vendor,
          boxParts: labelContCodeParts(box, day, run.n + i + 1),
        },
        true,
      ),
    );
    if (!openLabelPrint(cards)) return;
    const codes = Array.from({ length: copies }, (_, i) => labelContCode(box, day, run.n + i + 1));
    run.n += copies;
  saveLabelRun(run);
    recordLabelPrint({
      day,
      kind: "container",
      copies,
      name: sku,
      country,
      vendor,
      box,
      codes,
      seqFrom: codes[0] || "",
      seqTo: codes[codes.length - 1] || "",
    });
  renderLabels();
    return setStatus(`已送出貨櫃標籤 ${copies} 張，下一組 ${labelContCode(box, day, run.n + 1)}。`);
  }
  labelShipCust = String(labelShipCust || document.getElementById("label-ship-cust")?.value || "").trim();
  labelShipSku = String(labelShipSku || document.getElementById("label-ship-sku")?.value || "").trim();
  if (!labelShipCust) return setStatus("請先填客戶。", true);
  if (!labelShipSku) return setStatus("請先選或填品項。", true);
  const run = loadLabelRun(day);
  const solar = solarDateText(day);
  const cards = Array.from({ length: copies }, (_, i) =>
    labelStickerHtml(
      {
        kind: "ship",
        customer: labelShipCust,
        sku: labelShipSku,
        solar,
        seq: padLabelSeq(run.n + i + 1),
      },
      true,
    ),
  );
  if (!openLabelPrint(cards)) return;
  const seqFrom = padLabelSeq(run.n + 1);
  const seqTo = padLabelSeq(run.n + copies);
  run.n += copies;
  saveLabelRun(run);
  recordLabelPrint({
    day,
    kind: "ship",
    copies,
    customer: labelShipCust,
    sku: labelShipSku,
    solar,
    seqFrom,
    seqTo,
  });
  labelPendingOrder = { customer: labelShipCust, sku: labelShipSku, qty: copies, day };
  const gate = document.getElementById("label-order-gate");
  const hint = document.getElementById("label-order-hint");
  if (hint) hint.textContent = `已印 ${copies} 張：「${labelShipCust}／${labelShipSku}」。要記入 ${day} 訂單嗎？`;
  if (gate) gate.hidden = false;
  renderLabels();
  setStatus(`已送出出貨標籤 ${copies} 張，下一號 ${padLabelSeq(run.n + 1)}。`);
}
function shipLabelSkuText(l) {
  if (l?.labelName) return String(l.labelName).trim();
  const s = skuById(l?.skuId);
  if (!s) return String(l?.skuId || "").trim();
  const bits = [skuShortName(s)];
  if (lineBanText(l)) bits.push(lineBanText(l));
  if (l.pack) bits.push(l.pack);
  if (l.size) bits.push(l.size);
  if (lineSpecText(l)) bits.push(lineSpecText(l));
  if (lineShipMetaText(l)) bits.push(lineShipMetaText(l));
  return bits.filter(Boolean).join(" ");
}
function shipLabelDefaultCopies(l) {
  const s = skuById(l?.skuId);
  const unit = s?.unit || "";
  if (unit === "kg" || unit === "斤") return 0;
  const q = Number(l?.qty);
  if (!Number.isFinite(q) || q <= 0) return 0;
  return Math.max(0, Math.round(q));
}
function collectShipLabelRows(customer, day) {
  const who = customerKey({ customer });
  const map = new Map();
  for (const o of state.orders || []) {
    if (o.status === "cancelled" || o.status === "deleted") continue;
    if (customerKey(o) !== who) continue;
    if ((o.shipDate || today()) !== day) continue;
    for (const l of o.lines || []) {
      if (!(l.qty > 0)) continue;
      const skuText = shipLabelSkuText(l);
      const key = `${l.skuId || ""}\t${l.pack || ""}\t${l.size || ""}\t${l.leafType || ""}\t${l.spec || ""}\t${lineContainerNo(l)}\t${lineShipWh(l)}\t${lineBanQty(l)}\t${skuText}`;
      const cur = map.get(key);
      if (cur) cur.qty = round(cur.qty + l.qty);
      else {
        map.set(key, {
          key,
          skuId: l.skuId,
          skuText,
          qty: l.qty,
          unit: skuById(l.skuId)?.unit || "",
        });
      }
    }
  }
  return [...map.values()].map((r) => {
    const copies = shipLabelDefaultCopies({ skuId: r.skuId, qty: r.qty });
    return {
      key: r.key,
      label: `${r.skuText}　${fmt(r.qty)}${r.unit ? ` ${r.unit}` : ""}`,
      skuText: r.skuText,
      copies,
      on: copies > 0,
    };
  });
}
function closeShipLabelsPicker() {
  shipLabelPick = null;
  const gate = document.getElementById("ship-labels-gate");
  if (gate) gate.hidden = true;
}
function openShipLabelsPicker(customer, day = ordersViewDay()) {
  const who = String(customer || "").trim();
  if (!who) return;
  const rows = collectShipLabelRows(who, day);
  if (!rows.length) return setStatus(`「${who}」${day} 沒有可印品項。`, true);
  shipLabelPick = { customer: who, day, rows };
  renderShipLabelsPicker();
}
function renderShipLabelsPicker() {
  const gate = document.getElementById("ship-labels-gate");
  if (!gate) return;
  if (!shipLabelPick) {
    gate.hidden = true;
    return;
  }
  const { customer, day, rows } = shipLabelPick;
  const total = rows.reduce((a, r) => a + (r.on ? Math.max(0, Math.round(Number(r.copies) || 0)) : 0), 0);
  gate.hidden = false;
  gate.innerHTML = `<div class="login-card ship-labels-card" role="dialog" aria-labelledby="ship-labels-title">
    <h2 id="ship-labels-title">列印出貨標籤</h2>
    <p class="hint">${esc(customer)}　出貨日 ${esc(day)}</p>
    <p class="hint">勾選要印的品項，籃／箱預設＝件數；kg／斤預設不印。</p>
    <div class="btn-row ship-labels-tools">
      <button type="button" class="ghost" data-ship-labels-all="1">全選</button>
      <button type="button" class="ghost" data-ship-labels-all="0">全不選</button>
    </div>
    <ul class="ship-labels-list">${rows
      .map(
        (r, i) => `<li class="ship-labels-row">
        <label class="ship-labels-check">
          <input type="checkbox" data-ship-labels-on="${i}" ${r.on ? "checked" : ""} />
          <span>${esc(r.label)}</span>
        </label>
        <label class="ship-labels-copies">張數
          <input type="number" min="0" step="1" inputmode="numeric" data-ship-labels-copies="${i}" value="${esc(String(r.copies))}" ${r.on ? "" : "disabled"} />
        </label>
      </li>`,
      )
      .join("")}</ul>
    <p class="ship-labels-sum">將印 <b>${total}</b> 張</p>
    <div class="btn-row">
      <button type="button" class="primary" data-ship-labels-print ${total > 0 ? "" : "disabled"}>預覽並列印</button>
      <button type="button" class="ghost" data-ship-labels-close>取消</button>
    </div>
  </div>`;
}
function syncShipLabelPickFromDom() {
  if (!shipLabelPick) return;
  const gate = document.getElementById("ship-labels-gate");
  if (!gate) return;
  for (const r of shipLabelPick.rows) {
    const i = shipLabelPick.rows.indexOf(r);
    const onEl = gate.querySelector(`[data-ship-labels-on="${i}"]`);
    const copiesEl = gate.querySelector(`[data-ship-labels-copies="${i}"]`);
    if (onEl) r.on = !!onEl.checked;
    if (copiesEl) r.copies = Math.max(0, Math.round(Number(copiesEl.value) || 0));
  }
}
function printShipLabelsPicker() {
  syncShipLabelPickFromDom();
  if (!shipLabelPick) return;
  const picks = shipLabelPick.rows.filter((r) => r.on && Math.round(Number(r.copies) || 0) > 0);
  if (!picks.length) return setStatus("請先勾選要印的品項並填張數。", true);
  const { customer, day } = shipLabelPick;
  const run = loadLabelRun(day);
  const solar = solarDateText(day);
  const cards = [];
  let n = run.n;
  const bits = [];
  for (const r of picks) {
    const copies = Math.max(0, Math.round(Number(r.copies) || 0));
    for (let i = 0; i < copies; i++) {
      n += 1;
      cards.push(
        labelStickerHtml(
          {
            kind: "ship",
            customer,
            sku: r.skuText,
            solar,
            seq: padLabelSeq(n),
          },
          true,
        ),
      );
    }
    bits.push(`${r.skuText}×${copies}`);
  }
  if (!cards.length) return setStatus("沒有可印張數。", true);
  if (!openLabelPrint(cards)) return setStatus("無法開啟列印預覽，請允許彈出視窗後再試。", true);
  const seqFrom = padLabelSeq(run.n + 1);
  const seqTo = padLabelSeq(n);
  run.n = n;
  saveLabelRun(run);
  recordLabelPrint({
    day,
    kind: "ship",
    copies: cards.length,
    customer,
    sku: bits.join("、"),
    solar,
    seqFrom,
    seqTo,
  });
  closeShipLabelsPicker();
  setStatus(`已送出出貨標籤 ${cards.length} 張給「${customer}」，下一號 ${padLabelSeq(run.n + 1)}。`);
}
function closeLabelOrderGate() {
  const gate = document.getElementById("label-order-gate");
  if (gate) gate.hidden = true;
  labelPendingOrder = null;
}
function confirmLabelOrder() {
  const pending = labelPendingOrder;
  if (!pending) return closeLabelOrderGate();
  if (!requireStaff()) return;
  const skuId = skuIdFromLabelName(pending.sku);
  const line = {
    skuId: skuId || (co === "ha" ? "custom-ha" : "custom-nq"),
    qty: pending.qty,
  };
  if (!skuId) line.labelName = pending.sku;
  addOpenOrderFor(co, pending.customer, pending.day, [line], "");
  save();
  closeLabelOrderGate();
  render();
  setStatus(`已記入「${pending.customer}／${pending.sku}」${pending.qty}。`);
}
function helpStatusLabel(s) {
  return (
    {
      match: "對得上",
      qty: "數量不同",
      "ours-only": "只有進銷存",
      "theirs-only": "只有請款",
    }[s] || s || ""
  );
}
function helpMarkOf(row) {
  if (!helpResult) return { kind: "ok", text: "" };
  if (helpResult.mode === "generic") {
    if (row.status === "match") return { kind: "ok", text: "已對上" };
    return { kind: "bad", text: `有問題 · ${helpStatusLabel(row.status)}` };
  }
  if (!helpResult.hasFixed || row.statusFix == null) {
    if (row.statusOrig === "match") return { kind: "ok", text: "已對上" };
    return { kind: "bad", text: `有問題 · ${helpStatusLabel(row.statusOrig)}` };
  }
  if (row.statusFix === "match") {
    if (row.statusOrig === "match") return { kind: "ok", text: "已對上" };
    return { kind: "cleared", text: "原表有差，修正已對" };
  }
  return { kind: "bad", text: `有問題 · ${helpStatusLabel(row.statusFix)}` };
}
function helpShownRows() {
  return (helpResult?.rows || []).filter((row) => {
    const mark = helpMarkOf(row);
    if (helpFilter === "all") return true;
    return mark.kind !== "ok";
  });
}
function helpRound(n) {
  return Math.round(Number(n || 0) * 1000) / 1000;
}
const HELP_HEAT_PAL = {
  match: { bg: "#22C55E", fg: "#052E16" },
  diff: { bg: "#EA580C", fg: "#FFFFFF" },
  freight: { bg: "#DC2626", fg: "#FFFFFF" },
  sales: { bg: "#EAB308", fg: "#1C1917" },
  empty: { bg: "#FFFFFF", fg: "#111111" },
};
function helpHeatKind(F, E) {
  F = helpRound(F);
  E = helpRound(E);
  if (!F && !E) return { k: "empty", t: "", F, E };
  if (F === E) return { k: "match", t: String(F), F, E };
  if (F && !E) return { k: "freight", t: String(F), F, E };
  if (E && !F) return { k: "sales", t: String(E), F, E };
  return { k: "diff", t: `${F}／${E}`, F, E };
}
function helpBuildHeat() {
  if (!helpResult || helpResult.mode !== "freight") return null;
  const crops = [];
  const seen = new Set();
  const map = new Map();
  for (const r of helpResult.rows || []) {
    if (!seen.has(r.crop)) {
      seen.add(r.crop);
      crops.push(r.crop);
    }
    map.set(`${r.day}|${r.crop}`, {
      F: helpResult.hasFixed ? Number(r.fixed || 0) : Number(r.orig || 0),
      E: Number(r.sales || 0),
    });
  }
  const days = [...new Set((helpResult.rows || []).map((r) => r.day))].sort((a, b) => a - b);
  const get = (d, c) => map.get(`${d}|${c}`) || { F: 0, E: 0 };
  const dayRows = days.map((d) => {
    const cells = crops.map((c) => helpHeatKind(get(d, c).F, get(d, c).E));
    return {
      label: `${d}日`,
      cells,
      fSum: helpRound(cells.reduce((s, x) => s + x.F, 0)),
      eSum: helpRound(cells.reduce((s, x) => s + x.E, 0)),
    };
  });
  const totCells = crops.map((c) =>
    helpHeatKind(
      days.reduce((s, d) => s + get(d, c).F, 0),
      days.reduce((s, d) => s + get(d, c).E, 0),
    ),
  );
  return {
    crops,
    dayRows,
    totCells,
    totF: helpRound(totCells.reduce((s, x) => s + x.F, 0)),
    totE: helpRound(totCells.reduce((s, x) => s + x.E, 0)),
    file: "高鳴貨運進銷存比對",
  };
}
function helpHeatTableHtml(heat) {
  const head = `<tr><th class="heat-day">日期</th>${heat.crops.map((c) => `<th>${esc(c)}</th>`).join("")}<th>貨運合計</th><th>進銷存合計</th></tr>`;
  const body = heat.dayRows
    .map(
      (row) =>
        `<tr><td class="heat-day">${esc(row.label)}</td>${row.cells
          .map((c) => `<td class="heat-${c.k}">${esc(c.t)}</td>`)
          .join("")}<td class="heat-sum">${row.fSum}</td><td class="heat-sum">${row.eSum}</td></tr>`,
    )
    .join("");
  const tot = `<tr class="heat-total"><td class="heat-day">總量</td>${heat.totCells
    .map((c) => `<td class="heat-${c.k}">${esc(c.t)}</td>`)
    .join("")}<td class="heat-sum">${heat.totF}</td><td class="heat-sum">${heat.totE}</td></tr>`;
  return `<div class="help-heat-wrap"><table class="help-heat"><thead>${head}</thead><tbody>${body}${tot}</tbody></table></div>`;
}
function helpTd(val, bad) {
  return `<td class="${bad ? "cell-bad" : ""}">${val === "" || val == null ? "" : esc(String(val))}</td>`;
}
function helpMarkHtml(mark) {
  return `<td><span class="help-mark ${mark.kind}">${esc(mark.text)}</span></td>`;
}
function helpResultHtml(status) {
  if (!status) return "<td></td>";
  const ok = status === "match";
  return `<td><span class="help-result ${ok ? "ok" : "bad"}">${esc(helpStatusLabel(status))}</span></td>`;
}
function renderHelpFreight() {
  const tools = document.getElementById("help-freight-tools");
  const stats = document.getElementById("help-freight-stats");
  const table = document.getElementById("help-freight-table");
  if (!tools || !stats || !table) return;
  if (!helpResult || !helpResult.ok) {
    tools.hidden = true;
    if (!helpResult) {
      stats.innerHTML = "";
      table.innerHTML = "";
    }
    return;
  }
  tools.hidden = false;
  tools.querySelectorAll("[data-help-filter]").forEach((b) => {
    b.hidden = helpResult.mode === "freight";
    b.classList.toggle("on", b.dataset.helpFilter === helpFilter);
  });
  const rows = helpShownRows();
  if (helpResult.mode === "freight") {
    const heat = helpBuildHeat();
    const extra = [];
    if (helpResult.lineCount) extra.push(`進銷存 ${helpResult.lineCount} 筆`);
    if (helpResult.skippedKg?.length) extra.push(`略過公斤 ${helpResult.skippedKg.length}`);
    if (helpResult.unmapped?.length) extra.push(`未分類 ${helpResult.unmapped.length}`);
    stats.innerHTML = `<p>高鳴貨運 × 進銷存 件數比對<br>來源：${esc(helpResult.origName || "")} 對 ${esc(helpResult.salesName || "")}。件／包計入，公斤略過。${extra.length ? esc(extra.join(" · ")) : ""}</p>
      <div class="help-legend">
        <span class="heat-match">綠＝件數相同</span>
        <span class="heat-diff">橘＝兩邊數字不同（格內為 貨運／進銷存）</span>
        <span class="heat-freight">紅＝只有貨運有</span>
        <span class="heat-sales">黃＝只有進銷存有</span>
      </div>`;
    table.innerHTML = heat ? helpHeatTableHtml(heat) : "<p class=\"muted\">沒有可比對的格子。</p>";
    return;
  }
  const s = helpResult.stats || {};
  stats.innerHTML = `<p>不是高鳴進銷存／貨運矩陣，改用單號＋件數比。<br>${esc(helpResult.salesName || "")}（${esc(helpResult.oursKey || "")}／${esc(helpResult.oursQty || "")}）<br>${esc(helpResult.origName || "")}（${esc(helpResult.theirsKey || "")}／${esc(helpResult.theirsQty || "")}）</p>
    <p>對得上 ${s.match || 0} · 數量不同 ${s.qty || 0} · 只有進銷存 ${s.oursOnly || 0} · 只有請款 ${s.theirsOnly || 0}</p>`;
  const body = rows
    .map((r) => {
      const mark = helpMarkOf(r);
      const bad = r.status !== "match";
      return `<tr class="st-${mark.kind}">${helpMarkHtml(mark)}<td>${esc(r.key)}</td>${helpTd(r.ours, bad)}${helpTd(r.theirs, bad)}${helpTd(r.diff, bad)}${helpResultHtml(r.status)}</tr>`;
    })
    .join("");
  table.innerHTML = `<table class="help-table"><thead><tr><th>標示</th><th>單號</th><th>進銷存</th><th>請款</th><th>差</th><th>結果</th></tr></thead><tbody>${body || `<tr><td colspan="6">${helpFilter === "issues" ? "沒有標成有問題的列。" : "沒有資料列。"}</td></tr>`}</tbody></table>`;
}
async function runHelpFreight() {
  const sales = document.getElementById("help-sales-file")?.files?.[0];
  const freight = document.getElementById("help-freight-file")?.files?.[0];
  const msg = document.getElementById("help-freight-msg");
  if (!sales || !freight) {
    if (msg) msg.textContent = "請兩邊都選檔案。";
    return setStatus("請兩邊都選檔案。", true);
  }
  if (msg) msg.textContent = "正在比對…";
  helpResult = null;
  renderHelpFreight();
  try {
    const r = await fetch("./api/freight/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ours: { name: sales.name, data: bufToB64(await sales.arrayBuffer()) },
        theirs: { name: freight.name, data: bufToB64(await freight.arrayBuffer()) },
      }),
    });
    const type = r.headers.get("content-type") || "";
    const j = type.includes("json") ? await r.json().catch(() => ({})) : {};
    if (!r.ok || !type.includes("json") || j.ok !== true || !Array.isArray(j.rows)) {
      const err = !type.includes("json")
        ? "比對服務還沒生效，請關掉再開一次網站程式後再試。"
        : j.error || "比對失敗";
      if (msg) msg.textContent = err;
      return setStatus(err, true);
    }
    helpResult = j;
    const issueCount = (j.rows || []).filter((row) => {
      const st = j.mode === "generic" ? row.status : j.hasFixed ? row.statusFix : row.statusOrig;
      return st && st !== "match";
    }).length;
    helpFilter = issueCount ? "issues" : "all";
    if (msg) {
      msg.textContent =
        j.mode === "freight"
          ? issueCount
            ? `已比對，有 ${issueCount} 筆差異。`
            : "已比對，件數都對得上。"
          : issueCount
            ? `已依單號比對，有 ${issueCount} 筆差異。`
            : "已依單號比對，數量都對得上。";
    }
    renderHelpFreight();
  } catch (_) {
    if (msg) msg.textContent = "比對失敗";
    setStatus("比對失敗", true);
  }
}
function helpExportGrid() {
  if (!helpResult?.ok) return null;
  const heat = helpBuildHeat();
  if (heat) {
    const headers = ["日期", ...heat.crops, "貨運合計", "進銷存合計"];
    const toLine = (label, cells, fSum, eSum) => ({
      cells: [{ v: label, k: "head" }, ...cells.map((c) => ({ v: c.t, k: c.k })), { v: fSum, k: "sum" }, { v: eSum, k: "sum" }],
    });
    const lines = [
      ...heat.dayRows.map((row) => toLine(row.label, row.cells, row.fSum, row.eSum)),
      toLine("總量", heat.totCells, heat.totF, heat.totE),
    ];
    return { headers, lines, file: heat.file, heat: true };
  }
  const rows = helpShownRows();
  const lines = rows.map((r) => {
    const mark = helpMarkOf(r);
    const bad = r.status !== "match";
    return {
      kind: mark.kind,
      cells: [
        { v: mark.text, bad: mark.kind === "bad", kind: mark.kind },
        { v: r.key },
        { v: r.ours, bad },
        { v: r.theirs, bad },
        { v: r.diff, bad },
        { v: helpStatusLabel(r.status), bad },
      ],
    };
  });
  return { headers: ["標示", "單號", "進銷存", "請款", "差", "結果"], lines, file: "數量核對差異" };
}
function helpClickDownload(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function helpHeatFill(k) {
  return HELP_HEAT_PAL[k] || { bg: "#FFFFFF", fg: "#111111" };
}
function downloadHelpXls() {
  const pack = helpExportGrid();
  if (!pack) return setStatus("還沒有比對結果。", true);
  const xlsTd = (cell) => {
    const v = cell.v === "" || cell.v == null ? "" : String(cell.v);
    if (pack.heat) {
      if (cell.k === "head") return `<td bgcolor="#F4F1EA" style="font-weight:700">${esc(v)}</td>`;
      if (cell.k === "sum") return `<td bgcolor="#F3F3F3">${esc(v)}</td>`;
      const pal = helpHeatFill(cell.k);
      return `<td bgcolor="${pal.bg}" style="color:${pal.fg};font-weight:700">${esc(v)}</td>`;
    }
    if (cell.kind === "bad" || cell.bad) return `<td bgcolor="#B42318" style="color:#FFFFFF;font-weight:700">${esc(v)}</td>`;
    if (cell.kind === "cleared") return `<td bgcolor="#8A4B12" style="color:#FFFFFF;font-weight:700">${esc(v)}</td>`;
    if (cell.kind === "ok") return `<td bgcolor="#D7EFE3" style="color:#145A38">${esc(v)}</td>`;
    return `<td>${esc(v)}</td>`;
  };
  const body = pack.lines
    .map((line) => {
      if (pack.heat) return `<tr>${line.cells.map(xlsTd).join("")}</tr>`;
      const bg = line.kind === "bad" ? "#FDECEA" : line.kind === "cleared" ? "#FFF6EA" : "#FFFFFF";
      return `<tr bgcolor="${bg}">${line.cells.map(xlsTd).join("")}</tr>`;
    })
    .join("");
  const html = `\uFEFF<html><head><meta charset="utf-8"></head><body><p>綠＝件數相同　橘＝兩邊數字不同（貨運／進銷存）　紅＝只有貨運有　黃＝只有進銷存有</p><table border="1"><tr>${pack.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${body}</table></body></html>`;
  helpClickDownload(new Blob([html], { type: "application/vnd.ms-excel" }), `${pack.file}.xls`);
}
function downloadHelpPng() {
  const pack = helpExportGrid();
  if (!pack || !pack.lines.length) return setStatus("還沒有可比對的列。", true);
  const pad = 20;
  const rowH = pack.heat ? 26 : 32;
  const headH = 34;
  const legendH = pack.heat ? 28 : 0;
  const widths = pack.headers.map((h, i) => {
    const samples = [h, ...pack.lines.map((line) => String(line.cells[i]?.v ?? ""))];
    const max = Math.max(...samples.map((s) => [...String(s)].length));
    return pack.heat ? Math.min(88, Math.max(46, max * 11 + 16)) : Math.min(220, Math.max(72, max * 14 + 24));
  });
  const w = pad * 2 + widths.reduce((a, b) => a + b, 0);
  const h = pad * 2 + legendH + headH + pack.lines.length * rowH;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.font = '700 12px "Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif';
  ctx.textBaseline = "middle";
  if (pack.heat) {
    ctx.fillStyle = "#1b2a22";
    ctx.fillText("綠＝相同　橘＝貨運／進銷存不同　紅＝只有貨運　黃＝只有進銷存", pad, pad + 12);
  }
  const top = pad + legendH;
  let x = pad;
  ctx.fillStyle = "#6a6258";
  pack.headers.forEach((hdr, i) => {
    ctx.fillStyle = "#f4f1ea";
    ctx.fillRect(x, top, widths[i], headH);
    ctx.fillStyle = "#333";
    ctx.fillText(hdr, x + 6, top + headH / 2);
    x += widths[i];
  });
  pack.lines.forEach((line, ri) => {
    const y = top + headH + ri * rowH;
    let cx = pad;
    line.cells.forEach((cell, i) => {
      const text = String(cell.v ?? "");
      if (pack.heat) {
        const pal = cell.k === "head" || cell.k === "sum" ? { bg: cell.k === "sum" ? "#F3F3F3" : "#F4F1EA", fg: "#111" } : helpHeatFill(cell.k);
        ctx.fillStyle = pal.bg;
        ctx.fillRect(cx, y, widths[i], rowH);
        ctx.strokeStyle = "#d4d4d4";
        ctx.strokeRect(cx, y, widths[i], rowH);
        ctx.fillStyle = pal.fg;
        ctx.fillText(text, cx + 5, y + rowH / 2);
      } else {
        ctx.fillStyle = line.kind === "bad" ? "#fdecea" : "#ffffff";
        ctx.fillRect(cx, y, widths[i], rowH);
        if (cell.kind === "bad" || cell.bad) {
          ctx.fillStyle = "#b42318";
          ctx.fillRect(cx + 4, y + 5, widths[i] - 8, rowH - 10);
          ctx.fillStyle = "#fff";
        } else ctx.fillStyle = "#1b2a22";
        ctx.fillText(text, cx + 8, y + rowH / 2);
      }
      cx += widths[i];
    });
  });
  c.toBlob((blob) => {
    if (!blob) return setStatus("圖片存不下來。", true);
    helpClickDownload(blob, `${pack.file}.png`);
  }, "image/png");
}
function openLoginGate() {
  const gate = document.getElementById("login-gate");
  if (gate) gate.hidden = false;
}
function closeLoginGate() {
  loginPickerOpen = false;
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
    { role: "unpacker", names: STAFF_ROSTER.filter((p) => p.role === "unpacker") },
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
function preferredLayoutMode() {
  try {
    const v = String(localStorage.getItem(LAYOUT_MODE_KEY) || "").trim();
    if (v === "web" || v === "phone") return v;
  } catch (_) {}
  try {
    if (window.matchMedia("(min-width: 900px)").matches) return "web";
  } catch (_) {}
  return "phone";
}
function applyLayoutMode(mode) {
  const next = mode === "web" ? "web" : "phone";
  document.body.classList.toggle("layout-web", next === "web");
  document.body.classList.toggle("layout-phone", next === "phone");
  try {
    localStorage.setItem(LAYOUT_MODE_KEY, next);
  } catch (_) {}
  document.querySelectorAll(".layout-btn[data-layout]").forEach((b) => {
    b.classList.toggle("on", b.dataset.layout === next);
    b.setAttribute("aria-pressed", b.dataset.layout === next ? "true" : "false");
  });
  // 銷貨殼手機／網頁結構不同，切換時整殼重建
  if (page === "home" && hubDept === "sales") {
    const keepPane = hubSalesPane;
    restoreSalesMount();
    const hub = document.getElementById("home-hub");
    const shell = hub?.querySelector(".sales-shell");
    if (shell) shell.remove();
    if (keepPane) activateSalesPane(keepPane);
    else renderHomeHub();
  }
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
  if (can("page-import")) pages.push("import");
  if (can("page-unpack")) pages.push("unpack");
  if (can("page-sitework")) pages.push("sitework");
  if (can("page-stats")) pages.push("stats");
  if (can("page-help")) pages.push("help");
  if (!isUnpackerRole()) pages.push("soon");
  if (can("page-orders") || can("page-plan") || can("page-books")) pages.push("labels");
  if (can("page-books")) pages.push("label-prints");
  document.querySelectorAll("#flow-tabs [data-ops]").forEach((b) => {
    b.hidden = true;
  });
  const flow = document.getElementById("flow-tabs");
  if (flow) flow.hidden = true;
  const homeBtn = document.getElementById("home-btn");
  if (homeBtn) homeBtn.hidden = !logged || page === "home";
  if (logged && page && !pages.includes(page)) {
    page = isUnpackerRole() && can("page-unpack") ? "unpack" : homePage();
  }
  if (!can("page-books") && page === "books") page = homePage();
  // TEMP: 庫存暫僅雅芳 — 非主管若停在庫存盤點則改到進貨或首頁
  if (page === "books" && booksPart === "stock" && !can("books-stock")) {
    if (can("page-books")) booksPart = "in";
    else page = homePage();
  }
  if (isUnpackerRole() && can("page-unpack") && page !== "home" && page !== "unpack") page = "unpack";
  if (isUnpackerRole() && !can("page-unpack") && page === "unpack") page = homePage();
  syncOpsFlowTabs();
}
function markOrderEdited(o, summary) {
  o.edited = true;
  o.editedBy = currentStaff() || "未填";
  o.editedAt = Date.now();
  if (!Array.isArray(o.editLog)) o.editLog = [];
  const entry = { by: o.editedBy, at: o.editedAt };
  const sum = String(summary || "").trim();
  if (sum) entry.summary = sum;
  o.editLog.push(entry);
}
function orderEditLog(o) {
  if (!o) return [];
  if (Array.isArray(o.editLog) && o.editLog.length) return o.editLog;
  if (o.edited || o.editedAt || o.editedBy) {
    return [{ by: o.editedBy || "未填", at: o.editedAt || 0 }];
  }
  return [];
}
function orderEditStampText(entry) {
  const by = String(entry?.by || "未填").trim() || "未填";
  const t = labelPrintTimeText(entry?.at);
  return t && t !== "—" ? `${by} ${t}` : by;
}
function orderEditedTagHtml(o) {
  if (!o?.edited && !orderEditLog(o).length) return "";
  return `<span class="tag tag-edit">修改單</span>`;
}
function orderEditHistoryHtml(o) {
  const log = orderEditLog(o);
  if (!log.length) return "";
  const stamps = log.map(orderEditStampText).filter(Boolean);
  const shown = stamps.slice(-5);
  const head = shown.join("／");
  const more = stamps.length > 5 ? `　+${stamps.length - 5}` : "";
  const details = log
    .map((e) => {
      const sum = e.summary ? `　${esc(e.summary)}` : "";
      return `<li><strong>${esc(orderEditStampText(e))}</strong>${sum}</li>`;
    })
    .join("");
  return `<div class="order-edit-hist">
      ${orderEditedTagHtml(o)}
      <span class="order-edit-stamps">${esc(head)}${esc(more)}</span>
      <details class="order-edit-details"><summary>修改紀錄（${log.length}）</summary><ul>${details}</ul></details>
    </div>`;
}
function startInlineEdit(orderId) {
  if (!requireStaff()) return;
  const o = state.orders.find((x) => x.id === orderId);
  if (!o) return;
  if (o.status === "shipped" && !can("edit-shipped")) return setStatus("已送出後請由會計或主管改件數。", true);
  if (
    o.status === "shipped" &&
    !confirm(`「${o.customer}」已送出並扣庫。送出修改會標「修改單」，並依新件數重算庫存。`)
  )
    return;
  inlineEdit = {
    id: o.id,
    remark: String(o.remark || ""),
    lines: (o.lines || [])
      .filter((l) => lineHasItem(l))
      .map((l) => ({ ...l })),
    addSkuId: "",
    addQty: 1,
    addPack: "籃裝",
    addSpec: CAB_SPECS[0],
    addLeafType: CAB_LEAF_TYPES[0],
    addBanQty: "",
    addNote: "",
    addContainerNo: "",
    addShipWh: "",
  };
  editing = "";
  const editId = document.getElementById("edit-id");
  if (editId) editId.value = "";
  const cancelEdit = document.getElementById("cancel-edit");
  if (cancelEdit) cancelEdit.hidden = true;
  ticketLines = [];
  page = "orders";
  ordersPane = "today";
  render();
  requestAnimationFrame(() => {
    document.querySelector(`[data-inline-box="${CSS.escape(o.id)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}
function cancelInlineEdit() {
  inlineEdit = null;
  renderOrders();
}
function inlineEditSkuNeedsPack(skuId) {
  return !!skuById(skuId)?.packRemark;
}
function inlineEditAddLine() {
  if (!inlineEdit) return;
  const skuId = String(inlineEdit.addSkuId || "").trim();
  if (!skuId) return setStatus("請先選要加的品項。", true);
  const sku = skuById(skuId);
  if (!sku) return setStatus("找不到這個品項。", true);
  const qty = round(Number(inlineEdit.addQty) || 0);
  const banQty = Number(inlineEdit.addBanQty) > 0 ? round(Number(inlineEdit.addBanQty)) : 0;
  if (!(qty > 0) && !(banQty > 0)) return setStatus("加品項請填版數或件數（件數可對點後填）。", true);
  const line = { skuId, qty };
  applyBanQty(line, banQty);
  if (inlineEditSkuNeedsPack(skuId)) line.pack = inlineEdit.addPack || "籃裝";
  if (isCabSku(skuId)) {
    line.leafType = cabLeafTypeOf(inlineEdit.addLeafType);
    line.spec = cabSpecOf(inlineEdit.addSpec);
  } else if (isNapSku(skuId)) {
    line.spec = napSpecOf(inlineEdit.addSpec);
  }
  applyShipMeta(line, inlineEdit.addContainerNo, inlineEdit.addShipWh);
  const note = String(inlineEdit.addNote || "").trim();
  if (note) line.note = note;
  const dest = (inlineEdit.lines.find((l) => String(l.dest || "").trim()) || {}).dest;
  if (dest) {
    line.dest = dest;
    if (inlineEdit.lines.some((l) => l.destFreight)) line.destFreight = true;
  }
  inlineEdit.lines.push(line);
  inlineEdit.addSkuId = "";
  inlineEdit.addQty = 1;
  inlineEdit.addPack = "籃裝";
  inlineEdit.addSpec = isNapSku(skuId) ? NAP_SPECS[0] : CAB_SPECS[0];
  inlineEdit.addLeafType = CAB_LEAF_TYPES[0];
  inlineEdit.addBanQty = "";
  inlineEdit.addNote = "";
  inlineEdit.addContainerNo = "";
  inlineEdit.addShipWh = "";
  renderOrders();
}
function commitInlineEdit() {
  if (!inlineEdit) return;
  if (!requireStaff()) return;
  const o = state.orders.find((x) => x.id === inlineEdit.id);
  if (!o) {
    inlineEdit = null;
    return renderOrders();
  }
  const lines = inlineEdit.lines
    .map((l) => {
      const copy = { ...l, qty: round(Number(l.qty) || 0) };
      if (inlineEditSkuNeedsPack(copy.skuId) && !copy.pack) copy.pack = "籃裝";
      return cleanLine(copy);
    })
    .filter((l) => lineHasItem(l));
  if (!lines.length) return setStatus("至少留一個品項。", true);
  for (const l of lines) {
    if (inlineEditSkuNeedsPack(l.skuId) && !l.pack) return setStatus("地瓜葉請選裝箱樣式。", true);
  }
  const mine = lines.filter((l) => skuById(l.skuId)?.co === o.co);
  const other = lines.filter((l) => {
    const c = skuById(l.skuId)?.co;
    return c && c !== o.co;
  });
  if (!mine.length) return setStatus(`這張是${coLabel(o.co)}單，請至少留一項${coLabel(o.co)}品項。`, true);
  const wasShipped = o.status === "shipped" || o.status === "delivered";
  const shipMeta = snapshotShipMeta(o);
  if (o.status === "shipped") unwindShipment(o);
  const prevRemark = String(o.remark || "").trim();
  const nextRemark = String(inlineEdit.remark || "").trim();
  o.lines = mine;
  o.remark = nextRemark;
  const summaryBits = ["改品項"];
  if (prevRemark !== nextRemark) summaryBits.push("改備註");
  markOrderEdited(o, summaryBits.join("／"));
  if (wasShipped) {
    applyOpenShipment(o);
    restoreShipMeta(o, shipMeta);
  } else if (o.status !== "delivered") o.status = "open";
  const who = o.customer;
  const day = o.shipDate || today();
  const siblingId = addOrMergeOtherBookLines(o, other, who, day, o.shipAddr || "");
  inlineEdit = null;
  save();
  const otherNote = siblingId
    ? ` 另帳本品項已寫入${coLabel(o.co === "ha" ? "nq" : "ha")}單。`
    : "";
  setStatus(
    wasShipped
      ? `已改件數並重算扣庫。修改人員：${currentStaff()}。${otherNote}`
      : `已修改單，修改人員：${currentStaff()}。${otherNote}`,
    false,
  );
  render();
}
function inlineEditPanelHtml(o) {
  if (!inlineEdit || inlineEdit.id !== o.id) return "";
  const nqSkus = SKUS.filter((s) => s.co === "nq" && !s.custom);
  const haSkus = SKUS.filter((s) => s.co === "ha" && !s.custom);
  const addOpts = [
    ["穠全", nqSkus],
    ["鴻安", haSkus],
  ]
    .map(([lab, list]) => {
      const opts = list
        .map((s) => `<option value="${esc(s.id)}"${inlineEdit.addSkuId === s.id ? " selected" : ""}>${esc(skuShortName(s))}</option>`)
        .join("");
      return `<optgroup label="${esc(lab)}">${opts}</optgroup>`;
    })
    .join("");
  const addSku = skuById(inlineEdit.addSkuId);
  const addOtherHint =
    addSku && addSku.co && addSku.co !== o.co
      ? `<p class="inline-edit-hint muted">確認改單後，${esc(coLabel(addSku.co))}品項會寫入同客同日的${esc(coLabel(addSku.co))}單（共用單號）。</p>`
      : "";
  const rows = inlineEdit.lines
    .map((l, i) => {
      const sku = skuById(l.skuId);
      const step = sku ? skuStep(sku) : 1;
      const unit = sku?.unit || "";
      const coTag =
        sku?.co && sku.co !== o.co
          ? `<span class="tag tag-co">${esc(coLabel(sku.co))}</span>`
          : "";
      const pack =
        inlineEditSkuNeedsPack(l.skuId)
          ? `<select class="inline-pack" data-inline-pack="${i}" aria-label="裝箱">
              ${PACK_OPTS.map((p) => `<option value="${esc(p)}"${(l.pack || "籃裝") === p ? " selected" : ""}>${esc(p)}</option>`).join("")}
            </select>`
          : l.pack
            ? `<span class="muted">${esc(l.pack)}</span>`
            : "";
      const cabSpec = isCabSku(l.skuId)
        ? `${`<select class="inline-pack" data-inline-leaf="${i}" aria-label="規格">${optsHtml(CAB_LEAF_TYPES, cabLeafTypeOf(l.leafType))}</select>`}<select class="inline-pack" data-inline-spec="${i}" aria-label="品種">${optsHtml(CAB_SPECS, cabSpecOf(l.spec))}</select>`
        : isNapSku(l.skuId)
          ? `<select class="inline-pack" data-inline-spec="${i}" aria-label="規格">${optsHtml(NAP_SPECS, napSpecOf(l.spec))}</select>`
          : "";
      const banVal = lineBanQty(l) > 0 ? lineBanQty(l) : "";
      const qtyVal = qtyFieldValue(l.qty);
      return `<div class="inline-edit-row">
        <span class="inline-edit-name">${coTag}${esc(ticketLineName(l))}</span>
        ${pack}${cabSpec}
        <div class="metric-pair">
          <label class="inline-metric"><span class="metric-lab">版數</span>${banSelectHtml({ key: "inline-ban", id: String(i), value: banVal, aria: "版數" })}</label>
          <label class="inline-metric"><span class="metric-lab">件數</span>${qtyStepperHtml({ key: "inline-qty", id: String(i), value: qtyVal, step, placeholder: qtyFieldPlaceholder(banVal), aria: "件數" })}</label>
        </div>
        ${lineShipMetaFieldsHtml(l, {
          listId: `inline-cont-nos-${i}`,
          contAttr: `data-inline-container-no="${i}"`,
          whAttr: `data-inline-ship-wh="${i}"`,
          compact: true,
        })}
        <label class="inline-note-field"><span class="metric-lab">品項備註</span><input data-inline-note="${i}" type="text" value="${esc(l.note || "")}" placeholder="可不填" autocomplete="off" spellcheck="false" /></label>
        <span class="unit">${esc(unit)}</span>
        <button type="button" class="tiny-btn ghost" data-inline-del="${i}">刪</button>
      </div>`;
    })
    .join("");
  const needPack = inlineEditSkuNeedsPack(inlineEdit.addSkuId);
  const needCabSpec = isCabSku(inlineEdit.addSkuId);
  const needNapSpec = isNapSku(inlineEdit.addSkuId);
  const addBanVal = Number(inlineEdit.addBanQty) > 0 ? inlineEdit.addBanQty : "";
  return `<div class="inline-edit" data-inline-box="${esc(o.id)}">
    <p class="inline-edit-lab">改單 #${esc(o.no)}（${esc(coLabel(o.co))}）</p>
    <label class="inline-remark-field"><span class="metric-lab">整單備註</span><input data-inline-remark type="text" value="${esc(inlineEdit.remark || "")}" placeholder="整單備註，可不填" autocomplete="off" spellcheck="false" /></label>
    <div class="inline-edit-rows">${rows || `<p class="empty">尚無品項，請下方加入。</p>`}</div>
    <div class="inline-edit-add">
      <select data-inline-add-sku aria-label="加品項">
        <option value="">＋加品項…</option>
        ${addOpts}
      </select>
      ${addOtherHint}
      ${
        needPack
          ? `<select data-inline-add-pack aria-label="裝箱">
              ${PACK_OPTS.map((p) => `<option value="${esc(p)}"${inlineEdit.addPack === p ? " selected" : ""}>${esc(p)}</option>`).join("")}
            </select>`
          : ""
      }
      ${
        needCabSpec
          ? `<select data-inline-add-leaf aria-label="規格">${optsHtml(CAB_LEAF_TYPES, cabLeafTypeOf(inlineEdit.addLeafType))}</select><select data-inline-add-spec aria-label="品種">${optsHtml(CAB_SPECS, cabSpecOf(inlineEdit.addSpec))}</select>`
          : needNapSpec
            ? `<select data-inline-add-spec aria-label="規格">${optsHtml(NAP_SPECS, napSpecOf(inlineEdit.addSpec))}</select>`
            : ""
      }
      <div class="metric-pair">
        <label class="inline-metric"><span class="metric-lab">版數</span>${banSelectHtml({ key: "inline-add-ban", id: "new", value: addBanVal, aria: "加品項版數" })}</label>
        <label class="inline-metric"><span class="metric-lab">件數</span>${qtyStepperHtml({ key: "inline-add-qty", id: "new", value: qtyFieldValue(inlineEdit.addQty), step: skuById(inlineEdit.addSkuId) ? skuStep(skuById(inlineEdit.addSkuId)) : 1, placeholder: qtyFieldPlaceholder(addBanVal), aria: "加品項件數" })}</label>
      </div>
      ${lineShipMetaFieldsHtml(
        { containerNo: inlineEdit.addContainerNo, shipWh: inlineEdit.addShipWh },
        {
          listId: "inline-add-cont-nos",
          contAttr: "data-inline-add-container-no",
          whAttr: "data-inline-add-ship-wh",
          compact: true,
        },
      )}
      <label class="inline-note-field"><span class="metric-lab">品項備註</span><input data-inline-add-note type="text" value="${esc(inlineEdit.addNote || "")}" placeholder="可不填" autocomplete="off" spellcheck="false" /></label>
      <button type="button" class="tiny-btn primary" data-inline-add>加入</button>
    </div>
    <div class="inline-edit-acts">
      <button type="button" class="primary" data-inline-save>確認改單</button>
      <button type="button" class="ghost" data-inline-cancel>取消</button>
    </div>
  </div>`;
}
function staffNote(o) {
  const bits = [];
  if (o.enteredBy) bits.push(`入單 ${o.enteredBy}`);
  else bits.push("入單未填會計");
  if (o.settled) bits.push(`結單 ${o.settledBy || "未填會計"}`);
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
  if (o.edited || orderEditLog(o).length) {
    const log = orderEditLog(o);
    const n = log.length > 1 ? `×${log.length}` : "";
    const last = log[log.length - 1];
    bits.push(`<span class="order-edit-who">修改單${n} ${esc(orderEditStampText(last))}</span>`);
  }
  if (o.settled) bits.push(`<span class="n-ship">結單 ${esc(o.settledBy || "未填會計")}</span>`);
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
function loadFreightRuns() {
  try {
    const raw = JSON.parse(localStorage.getItem(FREIGHT_RUN_KEY) || "null");
    if (Array.isArray(raw) && raw.length) {
      return raw
        .map((r) => ({
          key: String(r.key || "").trim(),
          recv: String(r.recv || "").trim(),
          ship: String(r.ship || "").trim(),
          note: String(r.note || "").trim(),
        }))
        .filter((r) => r.key);
    }
  } catch (_) {}
  return FREIGHT_RUN_DEFAULT.map((r) => ({ ...r }));
}
function freightCarrierDefault(customer) {
  const who = String(customer || document.getElementById("customer")?.value || "").trim();
  if (!who) return "";
  const last = destFromRemembered(lastShipAddr(who));
  if (last && !SHIP_PRESETS.includes(last) && last !== "寄貨運") return last;
  const mapped = String(window.RackLib?.carrierOf?.(who) || "").trim();
  if (mapped && mapped !== who) return mapped;
  return "";
}
function freightRunMeta(name) {
  const n = String(name || "").trim();
  const runs = loadFreightRuns();
  if (!n) return { key: "", recv: "99:99", ship: "99:99", note: "", ord: 950 };
  let i = runs.findIndex((r) => r.key === n);
  if (i < 0) i = runs.findIndex((r) => n.includes(r.key) || r.key.includes(n));
  if (i >= 0) return { ...runs[i], ord: i };
  return { key: n, recv: "89:99", ship: "89:99", note: "", ord: 800 };
}
function orderShipFreightName(o) {
  for (const l of o.lines || []) {
    if (l.destFreight) {
      const d = String(l.dest || "").trim();
      if (d && d !== "寄貨運") return d;
      return freightCarrierDefault(o.customer);
    }
    const d = String(l.dest || "").trim();
    if (d === "寄貨運") return freightCarrierDefault(o.customer);
  }
  const parts = String(o.shipAddr || "")
    .split(/[／/]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const addr of parts) {
    if (SHIP_PRESETS.includes(addr) || addr === "寄貨運") continue;
    const meta = freightRunMeta(addr);
    if (meta.ord < 800) return meta.key;
  }
  for (const l of o.lines || []) {
    const d = String(l.dest || "").trim();
    if (!d || SHIP_PRESETS.includes(d) || d === "寄貨運") continue;
    const meta = freightRunMeta(d);
    if (meta.ord < 800) return meta.key;
  }
  return "";
}
function customerFreightSortMeta(orders) {
  const open = (orders || []).filter(isOrderUnshipped);
  const names = [...new Set(open.map(orderShipFreightName).filter(Boolean))];
  if (!names.length) return { key: "", recv: "99:99", ship: "99:99", note: "", ord: 900 };
  return names
    .map(freightRunMeta)
    .sort((a, b) => a.ord - b.ord || a.recv.localeCompare(b.recv) || a.ship.localeCompare(b.ship))[0];
}
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
function lastTicketDestFreight() {
  for (let i = ticketLines.length - 1; i >= 0; i--) {
    if (ticketLines[i]?.destFreight) return true;
  }
  return false;
}
function rememberedDest() {
  const last = lastTicketDest();
  if (last) return last;
  return destFromRemembered(lastShipAddr(document.getElementById("customer")?.value));
}
function lineDestMode(l) {
  const d = String(l?.dest || "").trim();
  if (SHIP_PRESETS.includes(d)) return d;
  if (l?.destFreight || d === "寄貨運") return "寄貨運";
  if (d || l?.destOther) return "其他";
  return "";
}
function destPicksHtml(mode, attrs) {
  return SHIP_DEST_OPTS.map((v) => {
    const on = mode === v;
    return `<button type="button" class="pick dest-chip${on ? " on" : ""}" aria-pressed="${on ? "true" : "false"}" ${attrs(v)}>${v}</button>`;
  }).join("");
}
function applyFreightToLine(line, carrier) {
  if (!line) return line;
  line.destFreight = true;
  delete line.destOther;
  const name = String(carrier || "").trim();
  line.dest = name || freightCarrierDefault() || "";
  return line;
}
function applyDestToLine(line) {
  if (!line || String(line.dest || "").trim()) return line;
  if (lastTicketDestFreight()) {
    applyFreightToLine(line, lastTicketDest());
    return line;
  }
  const mode = formDestMode();
  if (mode === "寄貨運") {
    applyFreightToLine(line, formDestExtraValue() || freightCarrierDefault());
    return line;
  }
  if (mode && SHIP_PRESETS.includes(mode)) {
    line.dest = mode;
    delete line.destOther;
    delete line.destFreight;
    return line;
  }
  const dest = rememberedDest();
  if (dest) {
    if (dest === "寄貨運") {
      applyFreightToLine(line, freightCarrierDefault());
      return line;
    }
    if (!SHIP_PRESETS.includes(dest)) {
      const who = document.getElementById("customer")?.value;
      const freight = freightCarrierDefault(who);
      if (freight && (dest === freight || dest.includes(freight) || freight.includes(dest))) {
        applyFreightToLine(line, dest);
        return line;
      }
    }
    line.dest = dest;
  }
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
function orderUrgentValue() {
  return !!document.getElementById("order-urgent")?.checked;
}
function syncUrgentToggleUi(on) {
  const btn = document.getElementById("order-urgent-btn");
  if (!btn) return;
  const pressed = !!on;
  btn.classList.toggle("on", pressed);
  btn.setAttribute("aria-pressed", pressed ? "true" : "false");
}
function setOrderUrgent(on) {
  const el = document.getElementById("order-urgent");
  if (el) el.checked = !!on;
  syncUrgentToggleUi(!!on);
}
function toggleOrderUrgent() {
  setOrderUrgent(!orderUrgentValue());
}
function isOrderUrgent(o) {
  return !!(o && o.urgent);
}
function isOrderUnshipped(o) {
  return !!(o && o.status === "open");
}
function customerGroupFillRank(orders) {
  const open = (orders || []).filter(isOrderUnshipped);
  if (!open.length) return 2;
  if (open.some(isOrderUrgent)) return 0;
  return 1;
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
  syncFormRouteUi();
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
  return Number.isFinite(o.prio) ? o.prio : orderNoSortKey(o.no);
}
function openQueue() {
  return state.orders
    .filter((o) => o.status === "open")
    .slice()
    .sort(
      (a, b) =>
        (isOrderUrgent(a) ? 0 : 1) - (isOrderUrgent(b) ? 0 : 1) ||
        orderRank(a) - orderRank(b) ||
        orderNoSortKey(a.no) - orderNoSortKey(b.no),
    );
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
function lineSpecText(l) {
  if (!l) return "";
  if (isCabSku(l.skuId)) return `${cabLeafTypeOf(l.leafType)}・${cabSpecOf(l.spec)}`;
  if (isNapSku(l.skuId)) return napSpecOf(l.spec);
  if (isPkSku(l.skuId)) return `${pkVarOf(l)}・${pkWeightOf(l)}`;
  return String(l.spec || "").trim();
}
function lineLabel(l, withUnit) {
  const s = skuById(l.skuId);
  const shown = lineSkuName(l);
  const unit = s && withUnit && Number(l.qty) > 0 ? ` ${s.unit}` : "";
  const ban = lineBanText(l) ? `（${lineBanText(l)}）` : "";
  const pack = l.pack ? `（${l.pack}）` : "";
  const size = l.size ? `（${l.size}）` : "";
  const spec = lineSpecText(l) ? `（${lineSpecText(l)}）` : "";
  const ship = lineShipMetaText(l) ? `（${lineShipMetaText(l)}）` : "";
  const dest = l.dest ? `（${l.dest}）` : "";
  const note = l.note ? `（${l.note}）` : "";
  const pallet = l.pallet ? "（疊棧板）" : "";
  return `${shown}${ban} ${lineQtyText(l)}${unit}${pack}${size}${spec}${ship}${dest}${note}${pallet}`;
}
function ticketLineName(l) {
  const name = lineSkuName(l);
  const ban = lineBanText(l) ? ` ${lineBanText(l)}` : "";
  const pack = l.pack ? ` ${l.pack}` : "";
  const size = l.size ? ` ${l.size}` : "";
  const spec = lineSpecText(l) ? ` ${lineSpecText(l)}` : "";
  const ship = lineShipMetaText(l) ? ` ${lineShipMetaText(l)}` : "";
  const pallet = l.pallet ? " 疊棧板" : "";
  const lot = l.lotContainer || l.lotUha ? ` ${l.lotContainer || l.lotUha}` : skuNeedsShipLot(l.skuId) ? " 未選編號" : "";
  return `${name}${ban}${pack}${size}${spec}${ship}${lot}${pallet}`;
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
    const n = ticketLines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    const nTxt = n > 0 ? `（${fmt(n)}件）` : "";
    if (editing) submit.textContent = `確認改單${nTxt}`;
    else submit.textContent = pre ? `確認預訂單${nTxt}` : `送出訂單${nTxt}`;
  }
}
function formDestMode() {
  if (ticketLines.length) {
    const modes = ticketLines.map((l) => lineDestMode(l)).filter(Boolean);
    if (modes.length && modes.every((m) => m === modes[0])) return modes[0];
    if (modes.length) return "";
  }
  const addr = String(document.getElementById("ship-addr")?.value || "").trim();
  const first = destFromRemembered(addr) || addr;
  if (SHIP_PRESETS.includes(first)) return first;
  if (first === "寄貨運") return "寄貨運";
  if (first) {
    const who = document.getElementById("customer")?.value;
    const freight = freightCarrierDefault(who);
    if (first.includes("貨運") || (freight && (first === freight || first.includes(freight) || freight.includes(first)))) {
      return "寄貨運";
    }
    if (freightRunMeta(first).ord < 800) return "寄貨運";
    return "其他";
  }
  return "";
}
function formDestExtraValue() {
  const mode = formDestMode();
  if (mode !== "寄貨運" && mode !== "其他") return "";
  if (ticketLines.length) return String(ticketLines[0]?.dest || "").trim();
  return destFromRemembered(document.getElementById("ship-addr")?.value) || "";
}
function syncFormRouteUi() {
  const picks = document.getElementById("form-dest-picks");
  if (!picks) return;
  const mode = formDestMode();
  picks.innerHTML = destPicksHtml(mode, (v) => `data-form-dest="${v}"`);
  const other = document.getElementById("form-dest-other");
  if (other) {
    const show = mode === "寄貨運" || mode === "其他";
    other.hidden = !show;
    other.placeholder = mode === "寄貨運" ? "貨運名稱，可改（帶入客戶常用）" : "其他下貨位置";
    if (show) other.value = formDestExtraValue();
  }
  const hint = document.getElementById("form-dest-hint");
  const who = String(document.getElementById("customer")?.value || "").trim();
  if (hint) {
    if (mode === "寄貨運" && who) {
      const carrier = freightCarrierDefault(who);
      hint.hidden = !carrier;
      hint.textContent = carrier ? `已帶入「${who}」常用：${carrier}` : "";
    } else {
      hint.hidden = true;
      hint.textContent = "";
    }
  }
}
function applyFormDestToTicket(mode) {
  const v = String(mode || "").trim();
  if (!ticketLines.length) {
    if (v === "寄貨運") {
      const carrier = freightCarrierDefault() || "";
      setShipAddr(carrier || "寄貨運");
    } else if (v === "其他") {
      setShipAddr("");
    } else {
      setShipAddr(v);
    }
    syncFormRouteUi();
    return;
  }
  for (const line of ticketLines) {
    if (v === "其他") {
      if (SHIP_PRESETS.includes(String(line.dest || "").trim()) || line.destFreight || String(line.dest || "").trim() === "寄貨運")
        line.dest = "";
      line.destOther = true;
      delete line.destFreight;
    } else if (v === "寄貨運") {
      applyFreightToLine(line, freightCarrierDefault());
    } else {
      line.dest = v;
      delete line.destOther;
      delete line.destFreight;
    }
  }
  syncHiddenShipAddr();
  renderTicket();
  syncFormRouteUi();
}
function formShipWhValue() {
  return shipWhOf(document.getElementById("form-ship-wh")?.value || "");
}
function applyFormShipWhToLine(line) {
  if (!line) return line;
  const wh = formShipWhValue();
  if (wh && !lineShipWh(line)) applyShipMeta(line, lineContainerNo(line), wh);
  return line;
}
function fillSkuQuickList() {
  const list = document.getElementById("sku-quick-list");
  if (!list || list.dataset.ready === "1") return;
  const pairs = [
    ["leaf", "地瓜葉"],
    ["basil", "九層塔"],
    ["basil-kg", "九層塔散賣"],
    ["on", "洋蔥"],
    ["on-p", "紫洋蔥"],
    ["on-b", "洋蔥B"],
    ["pk", "南瓜"],
    ...Object.entries(HA_VEG).map(([id, def]) => [id, def.label]),
  ];
  list.innerHTML = pairs.map(([, lab]) => `<option value="${esc(lab)}"></option>`).join("");
  list.dataset.ready = "1";
}
function pickBigFromSearchLabel(lab) {
  const name = String(lab || "").trim();
  if (!name) return "";
  const map = {
    地瓜葉: "leaf",
    九層塔: "basil",
    九層塔散賣: "basil-kg",
    洋蔥: "on",
    紫洋蔥: "on-p",
    洋蔥B: "on-b",
    南瓜: "pk",
  };
  if (map[name]) return map[name];
  for (const [id, def] of Object.entries(HA_VEG)) {
    if (def.label === name) return id;
  }
  return "";
}
function ticketDestHtml(l, i) {
  const mode = lineDestMode(l);
  const dest = String(l.dest || "").trim();
  const extraVal = mode === "其他" || mode === "寄貨運" ? dest : "";
  const ph = mode === "寄貨運" ? "貨運名稱，可改" : "其他位置";
  return `<div class="ticket-dest">
      <div class="ticket-dest-picks">${destPicksHtml(mode, (v) => `data-ticket-dest="${i}" data-dest="${v}"`)}</div>
      <input class="dest-other ticket-dest-other" data-ticket-dest-other="${i}" type="text" placeholder="${esc(ph)}" value="${esc(extraVal)}" ${mode === "其他" || mode === "寄貨運" ? "" : "hidden"} autocomplete="off" />
    </div>`;
}
function renderTicket() {
  const box = document.getElementById("ticket");
  if (!box) return;
  const kind = shipKindLabel();
  const who = ticketWhoText();
  syncFormRouteUi();
  if (!ticketLines.length) {
    box.classList.add("is-empty");
    box.innerHTML = `<p class="ticket-empty">本單還沒有品項<span class="ticket-kind">${esc(kind)}</span></p>`;
    syncShipMore();
    syncOrderEntering();
    return;
  }
  box.classList.remove("is-empty");
  const drops = uniqueTicketDrops();
  const wh = formShipWhValue();
  const routeTxt = [wh || "出貨倉未選", drops.join("／") || "下貨點未選"].join(" → ");
  const totalQty = ticketLines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  box.innerHTML = `<p class="ticket-head"><span class="ticket-who-name">${esc(who || "未填客戶")}</span><span class="ticket-kind">${esc(kind)}</span></p>
    <p class="ticket-route muted">${esc(routeTxt)}</p>
    <ul class="ticket-list">${ticketLines
      .map((l, i) => {
        const sku = skuById(l.skuId);
        const step = sku ? skuStep(sku) : 1;
        const banVal = lineBanQty(l) > 0 ? lineBanQty(l) : "";
        const qtyVal = qtyFieldValue(l.qty);
        const qtyPh = qtyFieldPlaceholder(banVal);
        const quick = banQuickHtml(banVal, `data-ticket-ban-quick="${i}"`);
        const dest = String(l.dest || "").trim();
        const lineWh = lineShipWh(l);
        const metaBits = [lineWh, dest].filter(Boolean).join(" → ");
        return `<li class="ticket-item">
          <div class="ticket-item-top">
            <strong class="ticket-name">${esc(ticketLineName(l))}</strong>
            <button type="button" class="tiny-btn ghost" data-ticket-del="${i}" aria-label="刪除">刪除</button>
          </div>
          ${metaBits ? `<p class="ticket-item-meta muted">${esc(metaBits)}</p>` : ""}
          <div class="metric-pair ticket-metric-pair">
            <div class="ticket-metric ticket-metric-ban">
              <span class="metric-lab">版數</span>
              ${banSelectHtml({ key: "ticket-ban", id: String(i), value: banVal, aria: "版數" })}
              <div class="sku-subs line-ban-quick ticket-ban-quick" aria-label="版數快捷">${quick}</div>
            </div>
            <label class="ticket-metric ticket-metric-qty"><span class="metric-lab">件數</span>${qtyStepperHtml({ key: "ticket-qty", id: String(i), value: qtyVal, step, placeholder: qtyPh, aria: "件數" })}</label>
          </div>
          <span class="unit">${esc(sku?.unit || "")}</span>
          ${lineShipMetaFieldsHtml(l, {
            listId: `ticket-cont-nos-${i}`,
            contAttr: `data-ticket-container-no="${i}"`,
            whAttr: `data-ticket-ship-wh="${i}"`,
            compact: true,
          })}
          <button type="button" class="pick ticket-pallet${l.pallet ? " on" : ""}" data-ticket-pallet="${i}" aria-pressed="${l.pallet ? "true" : "false"}">疊棧板</button>
          ${
            skuNeedsShipLot(l.skuId)
              ? `<button type="button" class="ghost lot-pick-btn" data-ticket-lot="${i}">${esc(l.lotContainer || l.lotUha || "選出貨編號")}</button>`
              : ""
          }
          <label class="ticket-line-note-field"><span class="metric-lab">備註</span><input data-ticket-note="${i}" type="text" value="${esc(l.note || "")}" placeholder="品項備註" autocomplete="off" spellcheck="false" /></label>
        </li>`;
      })
      .join("")}</ul>
    <p class="ticket-total">總件數 <strong>${esc(fmt(totalQty))}</strong> 件</p>`;
  syncShipMore();
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
  const row = document.querySelector("#ha-lines .item-line");
  const big = row ? pickVal(row, "big") : "";
  if (isCustomFam(big)) {
    const name = String(row.querySelector("[data-custom-name]")?.value || "").trim();
    const qty = Number(row.querySelector("[data-line-qty]")?.value);
    const banQty = Number(row.querySelector("[data-line-ban]")?.value);
    if (!name) {
      setStatus("請先填自行輸入的品名", true);
      row.querySelector("[data-custom-name]")?.focus();
      return false;
    }
    if (!(qty > 0) && !(banQty > 0) && !nextBig) {
      setStatus("請填版數或件數（件數可對點後填）", true);
      return false;
    }
  }
  const extra = unifiedLinesFromForm();
  if (!extra.length && !nextBig) {
    setStatus("請先選品項，並填版數或件數", true);
    return false;
  }
  const needLot = extra.find((l) => skuNeedsShipLot(l.skuId) && Number(l.qty) > 0 && !l.lotUha);
  if (needLot) {
    openLotModal({ skuId: needLot.skuId, qty: needLot.qty, selectedUha: formLot?.uha, addAfter: true });
    return false;
  }
  for (const l of extra) ticketLines.push(applyFormShipWhToLine(applyDestToLine({ ...l })));
  formLot = null;
  renderItemSheet();
  if (nextBig) selectPickerBig(nextBig);
  renderTicket();
  renderCheck();
  if (nextBig) document.querySelector("#sheet [data-line-qty]")?.focus();
  else focusItemLineStart();
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
  const banOn = [...document.querySelectorAll("#sheet [data-line-ban]")].some((el) => Number(el.value) > 0);
  const note = document.getElementById("order-note")?.value?.trim();
  const lineNote = document.querySelector("#sheet [data-line-note]")?.value?.trim();
  const edit = document.getElementById("edit-id")?.value;
  return !!(who || qtyOn || banOn || ticketLines.length || note || lineNote || edit);
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
    document.getElementById("order-form")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}
function cleanLine(l) {
  const out = { ...l };
  delete out.destOther;
  if (!out.destFreight) delete out.destFreight;
  else out.destFreight = true;
  if (!String(out.dest || "").trim()) delete out.dest;
  if (!String(out.note || "").trim()) delete out.note;
  out.skuId = remapSkuId(out.skuId);
  if (!String(out.labelName || "").trim()) delete out.labelName;
  else {
    out.labelName = String(out.labelName).trim();
    // Drop English / code-like labelName when catalog has Chinese name (大白菜 etc.)
    if (skuById(out.skuId) && !/[\u4e00-\u9fff]/.test(out.labelName)) delete out.labelName;
  }
  if (isCabSku(out.skuId)) {
    out.leafType = cabLeafTypeOf(out.leafType);
    out.spec = cabSpecOf(out.spec);
    delete out.weight;
    delete out.wt;
  } else if (isNapSku(out.skuId)) {
    out.spec = napSpecOf(out.spec);
    delete out.leafType;
    delete out.weight;
    delete out.wt;
  } else if (isPkSku(out.skuId)) {
    out.spec = pkVarOf(out);
    out.weight = pkWeightOf(out);
    out.skuId = haPkSku(out.spec, out.weight);
    delete out.leafType;
    delete out.wt;
    delete out.pkVar;
  } else if (!String(out.spec || "").trim()) {
    delete out.spec;
    delete out.leafType;
    delete out.weight;
    delete out.wt;
  } else {
    out.spec = String(out.spec).trim();
    if (!String(out.leafType || "").trim()) delete out.leafType;
    else out.leafType = String(out.leafType).trim();
    if (!String(out.weight || out.wt || "").trim()) {
      delete out.weight;
      delete out.wt;
    } else {
      out.weight = String(out.weight || out.wt).trim();
      delete out.wt;
    }
  }
  if (lineBanQty(out) > 0) out.banQty = lineBanQty(out);
  else delete out.banQty;
  delete out.ban;
  applyShipMeta(out, lineContainerNo(out), lineShipWh(out));
  out.qty = Number(out.qty) > 0 ? round(Number(out.qty)) : 0;
  return out;
}
function isCustomFam(fam) {
  return fam === "custom-nq" || fam === "custom-ha";
}
function workingLines() {
  const extra = unifiedLinesFromForm().map((l) => applyFormShipWhToLine(applyDestToLine({ ...l })));
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
const HA_ONION_SPECS = ["12K", "20K"];
const HA_ONION_SIZES = ["大球", "特大", "中球"];
/** 南瓜規格（廠商／等級） */
const HA_PK_VARS = ["密本", "阿成", "其他", "Ｂ級"];
/** 南瓜重量 */
const HA_PK_WEIGHTS = ["18K", "20K", "25K", "其他"];
const HA_ORIGIN_CODE = { 紐西蘭: "nz", 澳洲: "au", 韓國: "kr", 越南: "vn" };
const HA_PK_CODE = { 密本: "mi", 阿成: "ch", 其他: "oth", Ｂ級: "b" };
const HA_PK_CODE_REV = { mi: "密本", ch: "阿成", oth: "其他", b: "Ｂ級" };
function optsHtml(list, selected) {
  return list.map((v) => `<option value="${esc(v)}"${v === selected ? " selected" : ""}>${esc(v)}</option>`).join("");
}
function haOnionSku(origin, spec, purple) {
  const o = HA_ORIGIN_CODE[origin] || "nz";
  const s = spec === "12K" ? "12" : "20";
  return `${purple ? "onp" : "on"}-${o}-${s}`;
}
function isPkSku(skuId) {
  const id = String(skuId || "");
  return /^pk-/.test(id);
}
function pkDefaultWeight(variety) {
  return String(variety || "") === "Ｂ級" ? "20K" : "18K";
}
function pkVarOf(rec = {}) {
  const raw = String(rec.spec || rec.pkVar || "").trim();
  if (raw === "B級" || raw === "B" || raw === "ｂ級") return "Ｂ級";
  if (HA_PK_VARS.includes(raw)) return raw;
  if (rec.skuId) {
    const p = haParseSku(rec.skuId);
    if (p.variety && HA_PK_VARS.includes(p.variety)) return p.variety;
    if (p.kind === "pk-b") return "Ｂ級";
  }
  return "密本";
}
function pkWeightOf(rec = {}) {
  const w = String(rec.weight || rec.wt || "").trim();
  if (HA_PK_WEIGHTS.includes(w)) return w;
  if (rec.skuId) {
    const p = haParseSku(rec.skuId);
    if (p.weight && HA_PK_WEIGHTS.includes(p.weight)) return p.weight;
  }
  return pkDefaultWeight(pkVarOf(rec));
}
function haPkSku(variety, weight) {
  const v = pkVarOf({ spec: variety });
  let w = String(weight || "").trim();
  if (!HA_PK_WEIGHTS.includes(w)) w = pkDefaultWeight(v);
  if (v === "Ｂ級" && w === "其他") return "pk-b-kg";
  const vc = HA_PK_CODE[v] || "mi";
  const wc = w === "其他" ? "x" : w === "25K" ? "25" : w === "20K" ? "20" : "18";
  return `pk-${vc}-${wc}`;
}
function haParseSku(id) {
  if (id === "on-b-kg") return { kind: "on-b" };
  if (id === "pk-b-kg") return { kind: "pk", variety: "Ｂ級", weight: "其他", spec: "Ｂ級" };
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
  const pk = String(id || "").match(/^pk-(mi|ch|oth|b)-(18|20|25|x)$/);
  if (pk) {
    const variety = HA_PK_CODE_REV[pk[1]] || "密本";
    const weight = pk[2] === "x" ? "其他" : `${pk[2]}K`;
    return { kind: "pk", variety, weight, spec: variety };
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
  if (kind === "pk" || kind === "pk-b") {
    const variety = pkVarOf({ ...rec, spec: rec.variety || rec.spec, skuId: rec.skuId });
    const weight = pkWeightOf({ ...rec, weight: rec.weight, skuId: rec.skuId, spec: variety });
    return `<select data-ha-var aria-label="規格">${optsHtml(HA_PK_VARS, variety)}</select>
      <select data-ha-pk-weight aria-label="重量">${optsHtml(HA_PK_WEIGHTS, weight)}</select>`;
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
      const variety = row.querySelector("[data-ha-var]")?.value;
      const weight = row.querySelector("[data-ha-pk-weight]")?.value || row.querySelector("[data-ha-spec]")?.value;
      skuId = haPkSku(variety, weight);
    }
    const line = { skuId, qty: round(qty) };
    if (kind === "on" || kind === "on-p") line.size = haOnionSizeOf({ size: row.querySelector("[data-ha-size]")?.value });
    if (kind === "pk" || kind === "pk-b") {
      line.spec = pkVarOf({ spec: row.querySelector("[data-ha-var]")?.value, skuId });
      line.weight = pkWeightOf({
        weight: row.querySelector("[data-ha-pk-weight]")?.value || row.querySelector("[data-ha-spec]")?.value,
        spec: line.spec,
        skuId,
      });
    }
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
  if (cat === "sl-zhi" || cat === "sl-fang" || cat === "sl-pend" || cat === "leaf") {
    const pack = rec.pack && PACK_OPTS.includes(rec.pack) ? rec.pack : "籃裝";
    return `<select data-nq-pack aria-label="裝箱">${optsHtml(PACK_OPTS, pack)}</select>`;
  }
  return "";
}
function nqUnitOfCat(cat, pack) {
  if (cat === "sl-zhi" || cat === "sl-fang" || cat === "sl-pend" || cat === "leaf") return pack === "箱裝" ? "箱" : "籃";
  if (cat === "rb" || cat === "gb" || cat === "basil") return "箱";
  if (cat === "shiso-jin") return "斤";
  if (isCustomFam(cat)) return "件";
  if (isHaFam(cat)) return haUnitOf(cat);
  if (isHaVegFam(cat)) return "件";
  return "kg";
}
function lineBigOf(rec = {}) {
  if (rec.skuId === "custom-nq" || rec.skuId === "custom-ha") return rec.skuId;
  const fam = lineFamOf(rec);
  if (fam === "sl-zhi" || fam === "sl-fang" || fam === "sl-pend") return "leaf";
  if (fam === "rb" || fam === "gb") return "basil";
  if (fam === "pk-b") return "pk";
  return fam || "";
}
function pickHtml(key, items, selected) {
  return items
    .map(
      ([v, lab]) =>
        `<button type="button" class="pick${selected === v ? " on" : ""}" data-k="${esc(key)}" data-v="${esc(v)}" tabindex="0">${esc(lab)}</button>`,
    )
    .join("");
}
function pickVal(row, key) {
  return row?.querySelector(`.pick[data-k="${CSS.escape(key)}"].on`)?.dataset.v || "";
}
function itemLineSubKeys(big) {
  if (big === "leaf") return ["pack"];
  if (big === "basil") return ["basil"];
  if (big === "cab") return ["veg", "cableaf"];
  if (big === "nap") return ["veg", "napspec"];
  if (isHaVegFam(big)) return ["veg"];
  if (big === "on" || big === "on-p") return ["origin", "spec", "size"];
  if (big === "pk" || big === "pk-b") return ["pkvar"];
  if (isCustomFam(big)) return ["custom"];
  return [];
}
function focusPickGroup(row, key, preferOn = true) {
  if (!row || !key) return false;
  const picks = [...row.querySelectorAll(`.pick[data-k="${CSS.escape(key)}"]`)];
  if (!picks.length) return false;
  const on = picks.find((b) => b.classList.contains("on"));
  const hit = preferOn && on ? on : picks[0];
  hit.focus();
  return true;
}
function focusItemLineStart(row = document.querySelector("#ha-lines .item-line")) {
  if (!row) return;
  if (focusPickGroup(row, "big", false)) return;
  focusLineBanOrQty(row);
}
function applyItemLinePick(row, pick) {
  if (!row || !pick) return;
  const key = pick.dataset.k;
  row.querySelectorAll(`.pick[data-k="${CSS.escape(key)}"]`).forEach((b) => b.classList.toggle("on", b === pick));
  if (key === "big") {
    const sub = row.querySelector("[data-sub]");
    if (sub) sub.innerHTML = lineSubHtml(pick.dataset.v, {});
  }
  if (key === "pkvar") {
    const wSel = row.querySelector("[data-pk-weight]");
    if (wSel) wSel.value = pkDefaultWeight(pick.dataset.v);
  }
  formLot = null;
  syncLineMeta(row);
  renderCheck();
}
function advanceItemLineAfterPick(row, key) {
  if (!row) return;
  const big = pickVal(row, "big");
  if (isCustomFam(big) && (key === "big" || key === "custom")) {
    const name = row.querySelector("[data-custom-name]");
    if (name && key === "big") {
      name.focus();
      return;
    }
  }
  const keys = ["big", ...itemLineSubKeys(big).filter((k) => k !== "custom")];
  const idx = keys.indexOf(key);
  for (let i = Math.max(0, idx + 1); i < keys.length; i++) {
    if (focusPickGroup(row, keys[i], true)) return;
  }
  const ban = row.querySelector("[data-line-ban]");
  if (ban) {
    ban.focus();
    if (ban.tagName !== "SELECT" && typeof ban.select === "function") ban.select();
    return;
  }
  const qty = row.querySelector("[data-line-qty]");
  if (qty) {
    qty.focus();
    if (typeof qty.select === "function") qty.select();
    return;
  }
  row.querySelector("[data-ticket-add]")?.focus();
}
function handleItemLineEnter(e) {
  const form = document.getElementById("order-form");
  if (!form || form.hidden || page !== "orders") return false;
  const row = document.querySelector("#ha-lines .item-line");
  if (!row) return false;
  const t = e.target;
  if (t.closest("#customer") || t.id === "customer") {
    e.preventDefault();
    focusItemLineStart(row);
    return true;
  }
  const pick = t.closest?.(".item-line .pick");
  if (pick) {
    e.preventDefault();
    if (pick.dataset.k === "ban-quick") {
      setFormBanQty(row, Number(pick.dataset.v) || 0);
      const qty = row.querySelector("[data-line-qty]");
      if (qty) {
        qty.focus();
        if (typeof qty.select === "function") qty.select();
      }
      return true;
    }
    applyItemLinePick(row, pick);
    advanceItemLineAfterPick(row, pick.dataset.k);
    return true;
  }
  if (t.closest?.("[data-line-ban]")) {
    e.preventDefault();
    const qty = row.querySelector("[data-line-qty]");
    if (qty) {
      qty.focus();
      if (typeof qty.select === "function") qty.select();
      return true;
    }
    row.querySelector("[data-ticket-add]")?.focus();
    return true;
  }
  if (t.closest?.("[data-line-qty]")) {
    e.preventDefault();
    const ok = pushPickerToTicket();
    if (ok) requestAnimationFrame(() => focusItemLineStart());
    return true;
  }
  if (t.closest?.("[data-custom-name]")) {
    e.preventDefault();
    const ban = row.querySelector("[data-line-ban]");
    if (ban) {
      ban.focus();
      if (ban.tagName !== "SELECT" && typeof ban.select === "function") ban.select();
      return true;
    }
    const qty = row.querySelector("[data-line-qty]");
    if (qty) {
      qty.focus();
      if (typeof qty.select === "function") qty.select();
    }
    return true;
  }
  if (t.closest?.("[data-ticket-add]")) {
    e.preventDefault();
    const ok = pushPickerToTicket();
    if (ok) requestAnimationFrame(() => focusItemLineStart());
    return true;
  }
  if (t.closest?.("[data-ticket-qty]") || t.closest?.("[data-ticket-ban]") || t.closest?.("#order-note") || t.closest?.("[data-line-note]") || t.closest?.("#order-urgent-btn")) {
    return false;
  }
  return false;
}
function lineBigButtons(selected) {
  const nq = [
    ["leaf", "地瓜葉"],
    ["basil", "九層塔"],
    ["basil-kg", "九層塔散賣"],
    ["custom-nq", "自行輸入"],
  ];
  const ha = [
    ["on", "洋蔥"],
    ["on-p", "紫洋蔥"],
    ["on-b", "洋蔥B"],
    ["pk", "南瓜"],
    ...Object.entries(HA_VEG).map(([id, def]) => [id, def.label]),
    ["custom-ha", "自行輸入"],
  ];
  return `<p class="pick-lab">穠全</p>
    <div class="sku-picks">${pickHtml("big", nq, selected)}</div>
    <p class="pick-lab">鴻安</p>
    <div class="sku-picks sku-picks-ha">${pickHtml("big", ha, selected)}</div>`;
}
function lineOptCell(lab, inner) {
  return `<div class="line-opt-cell"><span class="line-opt-lab">${esc(lab)}</span><div class="line-opt-body">${inner}</div></div>`;
}
function lineSubHtml(big, rec = {}) {
  if (!big) return "";
  const bits = [];
  if (big === "leaf") {
    const pack = rec.pack && PACK_OPTS.includes(rec.pack) ? rec.pack : "籃裝";
    bits.push(lineOptCell("裝箱", pickHtml("pack", PACK_OPTS.map((p) => [p, p]), pack)));
  } else if (big === "basil") {
    const parsed = BASIL_REV[rec.skuId] || { qty: "rb", val: VENDOR_PENDING };
    const kind = parsed.qty === "gb" ? "gb" : "rb";
    bits.push(lineOptCell("種類", pickHtml("basil", [["rb", "紅骨"], ["gb", "綠骨"]], kind)));
  } else if (isHaVegFam(big)) {
    const def = HA_VEG[big];
    const cur = rec.skuId ? skuById(rec.skuId)?.vegOpt : rec.vegOpt;
    const opt = def.opts.some((x) => x[0] === cur) ? cur : def.opts[0][0];
    const lab = def.optLab || "國別／規格";
    bits.push(lineOptCell(lab, pickHtml("veg", def.opts, opt)));
    if (big === "cab") {
      bits.push(
        lineOptCell(
          "規格",
          pickHtml("cableaf", CAB_LEAF_TYPES.map((p) => [p, p]), cabLeafTypeOf(rec.leafType)),
        ),
      );
      bits.push(lineOptCell("品種", cabVarietySelectHtml(rec.spec)));
    } else if (big === "nap") {
      bits.push(
        lineOptCell(
          "規格",
          pickHtml("napspec", NAP_SPECS.map((p) => [p, p]), napSpecOf(rec.spec)),
        ),
      );
    }
  } else if (big === "on" || big === "on-p") {
    const parsed = rec.skuId ? haParseSku(rec.skuId) : { origin: "紐西蘭", spec: "20K" };
    bits.push(lineOptCell("國別", pickHtml("origin", HA_ONION_ORIGINS.map((p) => [p, p]), parsed.origin || "紐西蘭")));
    bits.push(lineOptCell("規格", pickHtml("spec", HA_ONION_SPECS.map((p) => [p, p]), parsed.spec || "20K")));
    bits.push(lineOptCell("尺寸", pickHtml("size", HA_ONION_SIZES.map((p) => [p, p]), haOnionSizeOf({ size: rec.size }))));
  } else if (big === "pk" || big === "pk-b") {
    const variety = pkVarOf(rec);
    const weight = pkWeightOf(rec);
    bits.push(lineOptCell("規格", pickHtml("pkvar", HA_PK_VARS.map((p) => [p, p]), variety)));
    bits.push(
      lineOptCell(
        "重量",
        `<select class="cab-spec-sel" data-pk-weight aria-label="重量">${optsHtml(HA_PK_WEIGHTS, weight)}</select>`,
      ),
    );
  } else if (isCustomFam(big)) {
    const name = String(rec.labelName || "").trim();
    bits.push(
      lineOptCell(
        "品名",
        `<input class="custom-sku-name" data-custom-name type="text" placeholder="沒有類別時自行輸入" value="${esc(name)}" autocomplete="off" />`,
      ),
    );
  }
  return bits.length ? `<div class="line-opt-grid">${bits.join("")}</div>` : "";
}
function syncLineMeta(row) {
  if (!row) return;
  const big = pickVal(row, "big");
  const pack = pickVal(row, "pack") || "籃裝";
  const unitFam = big === "leaf" ? "sl-pend" : big;
  const unit = row.querySelector("[data-line-unit]");
  if (unit) {
    if (big === "pk" || big === "pk-b") {
      const variety = pickVal(row, "pkvar") || "密本";
      const weight = row.querySelector("[data-pk-weight]")?.value || pkDefaultWeight(variety);
      unit.textContent = variety === "Ｂ級" && weight === "其他" ? "kg" : "箱";
    } else unit.textContent = nqUnitOfCat(unitFam, pack);
  }
  const qty = row.querySelector("[data-line-qty]");
  if (qty) {
    if (big === "pk" || big === "pk-b") {
      const variety = pickVal(row, "pkvar") || "密本";
      const weight = row.querySelector("[data-pk-weight]")?.value || pkDefaultWeight(variety);
      qty.step = variety === "Ｂ級" && weight === "其他" ? "0.1" : "1";
    } else {
      qty.step = big === "on-b" || big === "basil-kg" ? "0.1" : "1";
    }
  }
  syncFormLotRow();
}
function lineFamOf(rec = {}) {
  const id = rec.skuId;
  if (id === "custom-nq" || id === "custom-ha") return id;
  if (id) {
    const sku = skuById(id);
    if (sku?.vegFam) return sku.vegFam;
    if (sku?.co === "ha") return haParseSku(id).kind;
    if (id === "sl-fang" || id === "sl-zhi" || id === "sl-pend") return id;
    if (id === "rb-pend") return "rb";
    if (id === "gb-pend") return "gb";
    if (BASIL_REV[id]) return BASIL_REV[id].qty;
    if (id === "mint-kg" || id === "shiso-kg" || id === "shiso-jin" || id === "basil-kg") return id;
  }
  return rec.fam || "sl-pend";
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
function setFormBanQty(row, n) {
  if (!row) return;
  const inp = row.querySelector("[data-line-ban]");
  if (!inp) return;
  const v = Number(n);
  const next = Number.isFinite(v) && v > 0 ? String(round(v)) : "";
  if (inp.tagName === "SELECT" && next && ![...inp.options].some((o) => o.value === next)) {
    const opt = document.createElement("option");
    opt.value = next;
    opt.textContent = `${next}版`;
    inp.appendChild(opt);
  }
  inp.value = next;
  syncBanQuick(row);
  syncFormQtyPlaceholder(row);
  syncOrderEntering();
}
function syncBanQuick(row = document.querySelector("#ha-lines .item-line")) {
  if (!row) return;
  const cur = Number(row.querySelector("[data-line-ban]")?.value) || 0;
  row.querySelectorAll(".pick[data-k='ban-quick']").forEach((b) => {
    b.classList.toggle("on", Number(b.dataset.v) === cur);
  });
  syncFormQtyPlaceholder(row);
}
function unifiedLineHtml(rec = {}) {
  const hasItem = !!(rec.skuId || rec.fam);
  const big = hasItem ? lineBigOf(rec) : "";
  const qty = qtyFieldValue(rec.qty);
  const banQty = lineBanQty(rec) > 0 ? lineBanQty(rec) : "";
  const step = big === "on-b" || big === "pk-b" || big === "basil-kg" ? "0.1" : "1";
  const pack = rec.pack || "籃裝";
  const unitFam = big === "leaf" ? "sl-pend" : big;
  const quick = banQuickHtml(banQty);
  return `<div class="ha-line item-line">
    <div class="pick-block">
      ${lineBigButtons(big)}
      <div data-sub>${lineSubHtml(big, rec)}</div>
    </div>
    ${lineShipMetaFieldsHtml(rec, { listId: "form-cont-nos" })}
    <div class="line-qty-row line-metrics">
      <p class="line-metrics-hint">可先選版數，件數對點後再補</p>
      <div class="line-metric-cards">
        <div class="line-metric-card line-metric-ban">
          <span class="line-metric-lab">版數</span>
          <div class="line-metric-body line-ban-body">
            ${banSelectHtml({ key: "line-ban", id: "form", value: banQty, aria: "版數" })}
            <div class="sku-subs line-ban-quick" aria-label="版數快捷">${quick}</div>
          </div>
        </div>
        <div class="line-metric-card line-metric-qty">
          <span class="line-metric-lab">件數</span>
          <div class="line-metric-body">
            ${qtyStepperHtml({ key: "line-qty", id: "form", value: qty, step, placeholder: qtyFieldPlaceholder(banQty), aria: "件數" })}
      <span class="unit" data-line-unit>${big ? esc(nqUnitOfCat(unitFam, pack)) : ""}</span>
          </div>
        </div>
      </div>
      <button type="button" class="tiny-btn ghost line-metrics-clear" data-ha-del>清掉</button>
    </div>
    <div class="lot-row" data-lot-row hidden>
      <button type="button" class="ghost lot-pick-btn" data-lot-pick-form>${esc(lotBtnLabel(formLot))}</button>
      <p class="hint lot-hint">8–9 月進櫃櫃號。改品項或數量會清掉已選編號。</p>
    </div>
    <label class="field line-note-field" for="line-note">備註
      <input id="line-note" data-line-note type="text" value="${esc(rec.note || "")}" placeholder="可不填" autocomplete="off" spellcheck="false" />
    </label>
    <div class="item-add-bar">
      <button type="button" class="primary" data-ticket-add>＋ 加入本單（按 Enter 即可）</button>
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
  fillSkuQuickList();
  syncFormRouteUi();
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
  if (row?.querySelector("[data-ha-pallet]")?.checked) line.pallet = true;
  return line;
}
function withBan(row, line) {
  const banQty = Number(row.querySelector("[data-line-ban]")?.value);
  return applyBanQty(line, banQty);
}
function formLineReady(qty, banQty) {
  return Number(qty) > 0 || Number(banQty) > 0;
}
function unifiedLinesFromForm() {
  const out = [];
  document.querySelectorAll("#ha-lines .item-line").forEach((row) => {
    const qtyRaw = Number(row.querySelector("[data-line-qty]")?.value);
    const banQty = Number(row.querySelector("[data-line-ban]")?.value);
    if (!formLineReady(qtyRaw, banQty)) return;
    const qty = Number(qtyRaw) > 0 ? round(qtyRaw) : 0;
    const big = pickVal(row, "big");
    if (!big) return;
    const finish = (line) => withBan(row, withPallet(row, withLineNote(row, withShipMeta(row, line))));
    if (isHaFam(big)) {
      let skuId = "on-nz-20";
      if (big === "on-b") skuId = "on-b-kg";
      else if (big === "pk" || big === "pk-b") {
        const variety = pickVal(row, "pkvar") || "密本";
        let weight = String(row.querySelector("[data-pk-weight]")?.value || "").trim();
        if (!HA_PK_WEIGHTS.includes(weight)) weight = pkDefaultWeight(variety);
        const line = { skuId: haPkSku(variety, weight), qty, spec: variety, weight };
        out.push(finish(line));
        return;
      } else if (big === "on" || big === "on-p") {
        skuId = haOnionSku(pickVal(row, "origin"), pickVal(row, "spec"), big === "on-p");
      } else skuId = haPkSku(pickVal(row, "pkvar") || "密本", pkDefaultWeight("密本"));
      const line = { skuId, qty };
      if (big === "on" || big === "on-p") line.size = haOnionSizeOf({ size: pickVal(row, "size") });
      out.push(finish(line));
      return;
    }
    if (isHaVegFam(big)) {
      const def = HA_VEG[big];
      const allowed = def.opts.map((x) => x[0]);
      let opt = pickVal(row, "veg");
      if (!allowed.includes(opt)) opt = allowed[0];
      const line = { skuId: haVegSkuId(big, opt), qty };
      if (big === "cab") {
        line.leafType = cabLeafTypeOf(pickVal(row, "cableaf") || row.querySelector("[data-cab-leaf]")?.value);
        line.spec = cabSpecOf(row.querySelector("[data-cab-spec]")?.value);
      } else if (big === "nap") {
        line.spec = napSpecOf(pickVal(row, "napspec") || row.querySelector("[data-nap-spec]")?.value);
      }
      out.push(finish(line));
      return;
    }
    if (isCustomFam(big)) {
      const name = String(row.querySelector("[data-custom-name]")?.value || "").trim();
      if (!name) return;
      out.push(finish({ skuId: big, qty, labelName: name }));
      return;
    }
    if (big === "leaf") {
      out.push(finish({ skuId: "sl-pend", qty, pack: pickVal(row, "pack") || "籃裝" }));
      return;
    }
    if (big === "basil") {
      const kind = pickVal(row, "basil") === "gb" ? "gb" : "rb";
      out.push(finish({ skuId: `${kind}-pend`, qty }));
      return;
    }
    out.push(finish({ skuId: big, qty }));
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
    document.querySelectorAll(".order-card.just-in, .settle-card.just-in, .settle-order.just-in").forEach((el) => el.classList.remove("just-in"));
  }, 8000);
}
function applyOrdersPane(smooth) {
  document.querySelectorAll("#orders-pane-tabs [data-orders-pane]").forEach((b) => {
    b.classList.toggle("on", b.dataset.ordersPane === ordersPane);
  });
  syncOpsFlowTabs();
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
    }, smooth ? 280 : 40);
    const hit = document.querySelector("#orders-today .settle-card.just-in, #orders-today .order-card.just-in");
    if (hit && ordersPane === "today") hit.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  if (swipe.clientWidth) go();
  else requestAnimationFrame(go);
}
function applyInPane(smooth) {
  const formBtn = document.querySelector('#in-pane-tabs [data-in-pane="form"]');
  if (formBtn) formBtn.textContent = "進貨輸入";
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
    }, smooth ? 280 : 40);
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
function rackRocYear() {
  if (rackMode === "y114") return 114;
  if (rackMode === "y115") return 115;
  return 0;
}
function rackRocYearDates(roc) {
  const y = 1911 + Number(roc);
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}
function rackIntervalOn() {
  return !!rackRocYear() || (rackMode === "custom" && !!rackFrom);
}
function rackKeepPrior() {
  return !rackIntervalOn() || rackPrior;
}
function rackViewCell(cell) {
  const out = cell.out || 0;
  const inn = cell.inn || 0;
  if (rackKeepPrior()) {
    return { ...cell, opening: cell.opening || 0, out, inn, closing: cell.closing || 0 };
  }
  return { ...cell, opening: 0, out, inn, closing: out - inn };
}
function applyRackYearDates() {
  const y = rackRocYear();
  if (!y) return;
  const d = rackRocYearDates(y);
  rackFrom = d.from;
  rackTo = d.to;
}
function rackSummary() {
  const lib = window.RackLib;
  if (!lib) return { customers: [], frames: [], cells: {}, frameLabels: {} };
  return lib.summarize(rackTxns, {
    from: rackIntervalOn() ? rackFrom || "" : "",
    to: rackTo,
    company: rackCo,
  });
}
function rackLabel(s, code) {
  return s.frameLabels?.[code] || code;
}
function rackCoLabel() {
  return rackCo || "穠全／鴻安";
}
function rackCoMark(company) {
  if (company === "鴻安") return "H";
  if (company === "穠全") return "N";
  return "";
}
function rackCoFromMark(mark) {
  if (mark === "H") return "鴻安";
  if (mark === "N") return "穠全";
  return "";
}
function rackMergeMarks(marks) {
  const set = [...new Set((marks || []).filter(Boolean))];
  const hasN = set.includes("N");
  const hasH = set.includes("H");
  if (hasN && hasH) return "N+H";
  if (hasN) return "N";
  if (hasH) return "H";
  return set.sort().join("+");
}
function rackCustomerSheetRows(customer) {
  const lib = window.RackLib;
  const sAll = rackSummary();
  if (!lib || !customer) return { s: sAll, custom: false, rows: [], qty: 0 };
  const custom = rackIntervalOn();
  const sources = rackCo
    ? [{ company: rackCo, mark: rackCoMark(rackCo) }]
    : [
        { company: "穠全", mark: "N" },
        { company: "鴻安", mark: "H" },
      ];
  const parts = [];
  for (const src of sources) {
    const s = lib.summarize(rackTxns, {
      from: custom ? rackFrom || "" : "",
      to: rackTo,
      company: src.company,
    });
    for (const r of lib.customerOwed(s, customer)) {
      if (!(r.closing || r.out || r.inn || r.opening)) continue;
      parts.push({ ...r, company: src.company, mark: src.mark });
    }
  }
  let rows = parts;
  if (!rackCo) {
    const byFrame = new Map();
    for (const r of parts) {
      const cur = byFrame.get(r.frame) || {
        frame: r.frame,
        opening: 0,
        out: 0,
        inn: 0,
        closing: 0,
        marks: [],
      };
      cur.opening += r.opening || 0;
      cur.out += r.out || 0;
      cur.inn += r.inn || 0;
      cur.closing += r.closing || 0;
      if (r.mark) cur.marks.push(r.mark);
      byFrame.set(r.frame, cur);
    }
    rows = [...byFrame.values()].map((r) => ({
      frame: r.frame,
      opening: r.opening,
      out: r.out,
      inn: r.inn,
      closing: r.closing,
      mark: rackMergeMarks(r.marks),
    }));
  }
  rows = rows.map(rackViewCell).filter((r) => {
    if (r.closing > 0) return true;
    if (!custom) return false;
    if (r.out || r.inn) return true;
    return rackKeepPrior() && r.opening;
  });
  rows.sort((a, b) => b.closing - a.closing || String(a.frame).localeCompare(String(b.frame)));
  return { s: sAll, custom, showOpen: custom && rackKeepPrior(), rows, qty: rows.reduce((a, r) => a + r.closing, 0) };
}
function rackSheetPeriodText() {
  const span = rackDateSpan();
  const y = rackRocYear();
  let text = y
    ? `民國${y}年度 ${rackFrom}～${rackTo}`
    : rackMode === "custom" && rackFrom
      ? `區間 ${rackFrom}～${rackTo}`
      : `資料至 ${span.to || "—"}`;
  if (rackIntervalOn() && !rackKeepPrior()) text += "　不含前期尚欠";
  return text;
}
function rackRowKey(r) {
  return `${r.frame || ""}|${r.mark || ""}`;
}
function rackSheetRows() {
  const all = rackCustomerSheetRows(rackPick);
  const rows = [];
  const hidden = [];
  for (const r of all.rows) {
    if (rackHide.has(rackRowKey(r))) hidden.push(r);
    else rows.push(r);
  }
  return {
    ...all,
    rows,
    hidden,
    qty: rows.reduce((a, r) => a + r.closing, 0),
    allQty: all.qty,
  };
}
function rackSheetText() {
  const { s, showOpen, rows, qty } = rackSheetRows();
  const lines = [
    "鴻安農業科技　鐵架對帳單",
    `公司：${rackCoLabel()}（N＝穠全　H＝鴻安　N+H＝兩家加總）`,
    `客人：${rackPick}`,
    rackSheetPeriodText(),
    "",
  ];
  if (showOpen) {
    lines.push("品項\t期初\t借出\t歸還\t欠架\t來源");
    for (const r of rows) {
      lines.push(`${rackLabel(s, r.frame)}\t${rackFmt(r.opening)}\t${rackFmt(r.out)}\t${rackFmt(r.inn)}\t${rackFmt(r.closing)}\t${r.mark || ""}`);
    }
    lines.push(`合計\t${rackFmt(rows.reduce((a, r) => a + (r.opening || 0), 0))}\t${rackFmt(rows.reduce((a, r) => a + (r.out || 0), 0))}\t${rackFmt(rows.reduce((a, r) => a + (r.inn || 0), 0))}\t${rackFmt(qty)}\t`);
  } else {
    lines.push("品項\t借出\t歸還\t欠架\t來源");
    for (const r of rows) lines.push(`${rackLabel(s, r.frame)}\t${rackFmt(r.out)}\t${rackFmt(r.inn)}\t${rackFmt(r.closing)}\t${r.mark || ""}`);
    lines.push(`合計\t${rackFmt(rows.reduce((a, r) => a + (r.out || 0), 0))}\t${rackFmt(rows.reduce((a, r) => a + (r.inn || 0), 0))}\t${rackFmt(qty)}\t`);
  }
  lines.push("", "請核對尚欠數量，歸還時請告知。");
  return lines.join("\n");
}
function rackSheetFileTitle() {
  const y = rackRocYear();
  const day = y ? `${y}年度` : rackIntervalOn() ? `${rackFrom}至${rackTo}` : rackTo || today();
  return `鐵架對帳單_${rackPick || "客人"}_${day}`;
}
function rackSafeFileName(name) {
  return String(name || "export").replace(/[\\/:*?"<>|]+/g, "_");
}
function csvCell(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function downloadCsv(name, headers, rows) {
  const body = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${rackSafeFileName(name)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function exportRackExcel() {
  if (rackPick && rackLine) {
    const docs = rackCustomerFrameDocs(rackPick, rackLine);
    const s = rackSummary();
    const headers = ["日期", "單號", "類別", "數量", "來源"];
    const lines = docs.lines.map((d) => [d.date || "", d.doc || "", d.dir || "", d.qty, d.mark || ""]);
    lines.push(["", "", "借出合計", docs.out, ""]);
    lines.push(["", "", "歸還合計", docs.inn, ""]);
    downloadCsv(`${rackSheetFileTitle()}_${rackLabel(s, rackLine)}_明細`, headers, lines);
    setStatus("已匯出 Excel，用 Excel 開啟即可。");
    return;
  }
  const { s, showOpen, rows, qty } = rackSheetRows();
  if (!rows.length) {
    setStatus("沒有可匯出的總單。", true);
    return;
  }
  if (showOpen) {
    downloadCsv(
      `${rackSheetFileTitle()}_總單`,
      ["品項", "期初", "借出", "歸還", "欠架", "來源"],
      rows
        .map((r) => [rackLabel(s, r.frame), r.opening, r.out, r.inn, r.closing, r.mark || ""])
        .concat([
          [
            "合計",
            rows.reduce((a, r) => a + (r.opening || 0), 0),
            rows.reduce((a, r) => a + (r.out || 0), 0),
            rows.reduce((a, r) => a + (r.inn || 0), 0),
            qty,
            "",
          ],
        ]),
    );
  } else {
    downloadCsv(
      `${rackSheetFileTitle()}_總單`,
      ["品項", "借出", "歸還", "欠架", "來源"],
      rows
        .map((r) => [rackLabel(s, r.frame), r.out, r.inn, r.closing, r.mark || ""])
        .concat([["合計", rows.reduce((a, r) => a + (r.out || 0), 0), rows.reduce((a, r) => a + (r.inn || 0), 0), qty, ""]]),
    );
  }
  setStatus("已匯出 Excel，用 Excel 開啟即可。");
}
function rackFillRight(ctx, text, x, y) {
  ctx.fillText(String(text ?? ""), x - ctx.measureText(String(text ?? "")).width, y);
}
function rackEllipsis(ctx, text, maxW) {
  const t = String(text || "");
  if (ctx.measureText(t).width <= maxW) return t;
  let s = t;
  while (s.length && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}
function rackShareSpec() {
  const lib = window.RackLib;
  const s = rackSummary();
  const period = rackSheetPeriodText();
  const co = rackCo ? `來源 ${rackCoMark(rackCo)}＝${rackCo}` : "N＝穠全　H＝鴻安　N+H＝兩家加總";
  const fileBase = rackSheetFileTitle();
  if (rackPane === "customer" && rackPick && rackLine) {
    const docs = rackCustomerFrameDocs(rackPick, rackLine);
    return {
      title: "鴻安農業科技　鐵架明細",
      heading: `${rackPick}　${rackLabel(s, rackLine)}`,
      sub: `${period}　${co}　借出 ${rackFmt(docs.out)}　歸還 ${rackFmt(docs.inn)}`,
      note: "請核對尚欠數量，歸還時請告知。",
      file: `${fileBase}_明細`,
      cols: [
        { key: "date", title: "日期", w: 130 },
        { key: "doc", title: "單號", w: 0 },
        { key: "dir", title: "類別", w: 88, center: true },
        { key: "qty", title: "數量", w: 90, owed: true },
        { key: "mark", title: "來源", w: 72, center: true },
      ],
      rows: docs.lines.map((d) => ({ date: d.date || "", doc: d.doc || "", dir: d.dir || "", qty: rackFmt(d.qty), mark: d.mark || "" })),
    };
  }
  if (rackPane === "customer" && rackPick) {
    const { showOpen, rows, qty } = rackSheetRows();
    const mapped = rows.map((r) => ({
      name: rackLabel(s, r.frame),
      opening: rackFmt(r.opening),
      out: rackFmt(r.out),
      inn: rackFmt(r.inn),
      closing: rackFmt(r.closing),
      mark: r.mark || "",
    }));
    const total = {
      total: true,
      name: "合計",
      opening: rackFmt(rows.reduce((a, r) => a + (r.opening || 0), 0)),
      out: rackFmt(rows.reduce((a, r) => a + (r.out || 0), 0)),
      inn: rackFmt(rows.reduce((a, r) => a + (r.inn || 0), 0)),
      closing: rackFmt(qty),
      mark: "",
    };
    return {
      title: "鴻安農業科技　鐵架對帳單",
      heading: `總單　${rackPick}`,
      sub: `${period}　${co}`,
      note: "請核對尚欠數量，歸還時請告知。",
      file: fileBase,
      totalRow: total,
      cols: showOpen
        ? [
            { key: "name", title: "品項", w: 0 },
            { key: "opening", title: "期初", w: 92, right: true },
            { key: "out", title: "借出", w: 92, right: true },
            { key: "inn", title: "歸還", w: 92, right: true, tint: "#3a6d78" },
            { key: "closing", title: "欠架", w: 118, owed: true },
            { key: "mark", title: "來源", w: 72, center: true },
          ]
        : [
            { key: "name", title: "品項", w: 0 },
            { key: "out", title: "借出", w: 100, right: true },
            { key: "inn", title: "歸還", w: 100, right: true, tint: "#3a6d78" },
            { key: "closing", title: "欠架", w: 128, owed: true },
            { key: "mark", title: "來源", w: 72, center: true },
          ],
      rows: mapped,
    };
  }
  if (rackPane === "customer") {
    const q = rackQ;
    const names = s.customers
      .map((c) => {
        const rows = lib.customerOwed(s, c).map(rackViewCell).filter((r) => r.closing > 0);
        return { name: c, kinds: rackFmt(rows.length), closing: rackFmt(rows.reduce((a, r) => a + r.closing, 0)), qty: rows.reduce((a, r) => a + r.closing, 0) };
      })
      .filter((x) => x.qty > 0 && rackMatch(x.name, q))
      .sort((a, b) => b.qty - a.qty);
    return {
      title: "鴻安農業科技　鐵架統計",
      heading: "客人尚欠",
      sub: `${period}　${co}`,
      note: "",
      file: `鐵架_客人尚欠_${rackTo || today()}`,
      cols: [
        { key: "name", title: "客人", w: 0 },
        { key: "kinds", title: "種類", w: 90, right: true },
        { key: "closing", title: "還欠", w: 110, owed: true },
      ],
      rows: names,
    };
  }
  if (rackPane === "frame" && rackPick) {
    const rows = lib.frameAtCustomers(s, rackPick).map(rackViewCell).filter((r) => r.closing > 0).sort((a, b) => b.closing - a.closing);
    return {
      title: "鴻安農業科技　鐵架統計",
      heading: rackLabel(s, rackPick),
      sub: `${period}　${co}　${rows.length} 戶`,
      note: "",
      file: `鐵架_${rackLabel(s, rackPick)}_${rackTo || today()}`,
      cols: [
        { key: "name", title: "客人", w: 0 },
        { key: "closing", title: "還欠", w: 120, owed: true },
      ],
      rows: rows.map((r) => ({ name: r.customer, closing: rackFmt(r.closing) })),
    };
  }
  if (rackPane === "frame") {
    const q = rackQ;
    const frames = s.frames
      .map((f) => {
        const list = lib.frameAtCustomers(s, f).map(rackViewCell).filter((r) => r.closing > 0);
        const qty = list.reduce((a, r) => a + r.closing, 0);
        return { name: rackLabel(s, f), households: rackFmt(list.length), closing: rackFmt(qty), qty };
      })
      .filter((x) => x.qty > 0 && rackMatch(x.name, q))
      .sort((a, b) => b.qty - a.qty);
    return {
      title: "鴻安農業科技　鐵架統計",
      heading: "架種彙整",
      sub: `${period}　${co}`,
      note: "",
      file: `鐵架_架種彙整_${rackTo || today()}`,
      cols: [
        { key: "name", title: "架種", w: 0 },
        { key: "households", title: "戶數", w: 90, right: true },
        { key: "closing", title: "在外", w: 110, owed: true },
      ],
      rows: frames,
    };
  }
  if (rackPane === "carrier" && rackPick) {
    const members = lib.customersOfCarrier(s.customers, rackPick);
    const rows = lib.mergeOwed(s, members).map(rackViewCell).filter((r) => r.closing > 0).sort((a, b) => b.closing - a.closing);
    return {
      title: "鴻安農業科技　鐵架統計",
      heading: rackPick,
      sub: `${period}　${members.length} 戶`,
      note: "",
      file: `鐵架_${rackPick}_${rackTo || today()}`,
      cols: [
        { key: "name", title: "架種", w: 0 },
        { key: "closing", title: "還欠", w: 120, owed: true },
      ],
      rows: rows.map((r) => ({ name: rackLabel(s, r.frame), closing: rackFmt(r.closing) })),
    };
  }
  if (rackPane === "carrier") {
    const q = rackQ;
    const list = lib
      .uniqueCarriers(s.customers)
      .map((c) => {
        const members = lib.customersOfCarrier(s.customers, c);
        const rows = lib.mergeOwed(s, members).map(rackViewCell).filter((r) => r.closing > 0);
        const qty = rows.reduce((a, r) => a + r.closing, 0);
        return { name: c, households: rackFmt(members.length), closing: rackFmt(qty), qty };
      })
      .filter((x) => x.qty > 0 && rackMatch(x.name, q))
      .sort((a, b) => b.qty - a.qty);
    return {
      title: "鴻安農業科技　鐵架統計",
      heading: "貨運行",
      sub: `${period}　${co}`,
      note: "",
      file: `鐵架_貨運行_${rackTo || today()}`,
      cols: [
        { key: "name", title: "貨運行", w: 0 },
        { key: "households", title: "戶數", w: 90, right: true },
        { key: "closing", title: "還欠", w: 110, owed: true },
      ],
      rows: list,
    };
  }
  return null;
}
async function shareRackSheet() {
  const spec = rackShareSpec();
  if (!spec || !(spec.rows && spec.rows.length)) {
    setStatus("沒有可傳的統計資料。", true);
    return;
  }
  setStatus("正在做成圖片…");
  const png = window.RackPng;
  let files = [];
  try {
    const blobs = png ? await png.pages(spec) : [await rackSheetPngBlob()];
    files = blobs.map((blob, i) => {
      const n = blobs.length > 1 ? `_${i + 1}of${blobs.length}` : "";
      return new File([blob], `${rackSafeFileName(spec.file || rackSheetFileTitle())}${n}.png`, { type: "image/png" });
    });
  } catch (_) {
    setStatus("做成圖片失敗。", true);
    return;
  }
  const title = spec.heading || spec.title;
  const text = `${title}　${spec.sub || ""}`;
  if (files.length > 1) {
    files.slice(1).forEach(downloadRackSheetPng);
  }
  const first = files[0];
  const payload = { title, text, files: files.length === 1 ? files : [first] };
  if (navigator.canShare?.({ files: [first] }) || navigator.canShare?.(payload)) {
    try {
      await navigator.share(payload);
      setStatus(files.length > 1 ? `已打開分享（第 1 頁）。其餘 ${files.length - 1} 頁已下載，請一併傳到 LINE。` : "已打開分享，請選 LINE 傳送圖片。");
      return;
    } catch (err) {
      if (err?.name === "AbortError") {
        setStatus("");
        return;
      }
    }
  }
  files.forEach(downloadRackSheetPng);
  setStatus(files.length > 1 ? `共 ${files.length} 頁圖片已存，請傳到 LINE。` : "已存成圖片檔，請傳到 LINE。");
}
function rackSheetPngBlob() {
  return new Promise((resolve, reject) => {
    const { s, custom, rows, qty } = rackSheetRows();
    const dpr = 2;
    const W = 980;
    const pad = 36;
    const rowH = 38;
    const headH = 42;
    const top = 148;
    const H = top + headH + (Math.max(rows.length, 1) + 1) * rowH + pad + 36;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("no canvas"));
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1a6843";
    ctx.font = '800 26px "Microsoft JhengHei","Noto Sans TC",sans-serif';
    ctx.fillText("鴻安農業科技　鐵架對帳單", pad, 48);
    ctx.fillStyle = "#16241c";
    ctx.font = '800 22px "Microsoft JhengHei","Noto Sans TC",sans-serif';
    ctx.fillText(`客人　${rackPick || ""}`, pad, 84);
    ctx.fillStyle = "#5a6a61";
    ctx.font = '700 16px "Microsoft JhengHei","Noto Sans TC",sans-serif';
    ctx.fillText(`${rackSheetPeriodText()}　N＝穠全　H＝鴻安　N+H＝兩家加總`, pad, 112);

    const cols = custom
      ? [
          { key: "name", title: "品項", w: 0 },
          { key: "opening", title: "期初", w: 92 },
          { key: "out", title: "借出", w: 92 },
          { key: "inn", title: "歸還", w: 92 },
          { key: "closing", title: "欠架", w: 118 },
          { key: "mark", title: "來源", w: 72 },
        ]
      : [
          { key: "name", title: "品項", w: 0 },
          { key: "out", title: "借出", w: 100 },
          { key: "inn", title: "歸還", w: 100 },
          { key: "closing", title: "欠架", w: 128 },
          { key: "mark", title: "來源", w: 72 },
        ];
    const numW = cols.reduce((a, c) => a + c.w, 0);
    cols[0].w = W - pad * 2 - numW;
    const x0 = pad;
    const y0 = top;
    ctx.fillStyle = "#eef4ef";
    ctx.fillRect(x0, y0, W - pad * 2, headH);
    ctx.strokeStyle = "#d3ddd6";
    ctx.beginPath();
    ctx.moveTo(x0, y0 + headH);
    ctx.lineTo(W - pad, y0 + headH);
    ctx.stroke();
    ctx.fillStyle = "#5a6a61";
    ctx.font = '800 15px "Microsoft JhengHei","Noto Sans TC",sans-serif';
    let x = x0;
    for (const c of cols) {
      const ty = y0 + 27;
      if (c.key === "closing") {
        ctx.fillStyle = "#8d5a3a";
        ctx.font = '800 15px "Microsoft JhengHei","Noto Sans TC",sans-serif';
        rackFillRight(ctx, c.title, x + c.w - 6, ty);
        ctx.fillStyle = "#5a6a61";
      } else if (c.key === "name") ctx.fillText(c.title, x + 8, ty);
      else if (c.key === "mark") ctx.fillText(c.title, x + (c.w - ctx.measureText(c.title).width) / 2, ty);
      else rackFillRight(ctx, c.title, x + c.w - 6, ty);
      x += c.w;
    }
    const data = rows.concat([
      {
        frame: "",
        opening: rows.reduce((a, r) => a + (r.opening || 0), 0),
        out: rows.reduce((a, r) => a + (r.out || 0), 0),
        inn: rows.reduce((a, r) => a + (r.inn || 0), 0),
        closing: qty,
        mark: "",
        total: true,
      },
    ]);
    data.forEach((r, i) => {
      const y = y0 + headH + i * rowH;
      if (i % 2) {
        ctx.fillStyle = "#f7faf7";
        ctx.fillRect(x0, y, W - pad * 2, rowH);
      }
      ctx.strokeStyle = "#e6ece7";
      ctx.beginPath();
      ctx.moveTo(x0, y + rowH);
      ctx.lineTo(W - pad, y + rowH);
      ctx.stroke();
      ctx.font = r.total
        ? '800 16px "Microsoft JhengHei","Noto Sans TC",sans-serif'
        : '700 16px "Microsoft JhengHei","Noto Sans TC",sans-serif';
      let cx = x0;
      for (const c of cols) {
        const ty = y + 26;
        if (c.key === "name") {
          ctx.fillStyle = "#16241c";
          ctx.fillText(rackEllipsis(ctx, r.total ? "合計" : rackLabel(s, r.frame), c.w - 16), cx + 8, ty);
        } else if (c.key === "mark") {
          ctx.fillStyle = "#1a6843";
          const t = r.mark || "";
          ctx.fillText(t, cx + (c.w - ctx.measureText(t).width) / 2, ty);
        } else if (c.key === "closing") {
          ctx.fillStyle = "#8d5a3a";
          ctx.font = r.total
            ? '800 18px "Microsoft JhengHei","Noto Sans TC",sans-serif'
            : '800 17px "Microsoft JhengHei","Noto Sans TC",sans-serif';
          rackFillRight(ctx, rackFmt(r[c.key]), cx + c.w - 6, ty);
          ctx.font = r.total
            ? '800 16px "Microsoft JhengHei","Noto Sans TC",sans-serif'
            : '700 16px "Microsoft JhengHei","Noto Sans TC",sans-serif';
        } else {
          ctx.fillStyle = c.key === "inn" ? "#3a6d78" : "#16241c";
          rackFillRight(ctx, rackFmt(r[c.key]), cx + c.w - 6, ty);
        }
        cx += c.w;
      }
    });
    ctx.fillStyle = "#5a6a61";
    ctx.font = '600 14px "Microsoft JhengHei","Noto Sans TC",sans-serif';
    ctx.fillText("請核對尚欠數量，歸還時請告知。", pad, H - 22);
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png"))), "image/png");
  });
}
async function rackSheetPngFile() {
  const blob = await rackSheetPngBlob();
  const name = `${rackSheetFileTitle()}.png`;
  return new File([blob], name, { type: "image/png" });
}
function downloadRackSheetPng(file) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function rackOpenPrint(asPdf) {
  const prev = document.title;
  document.title = rackSheetFileTitle();
  document.body.classList.add("rack-printing");
  if (asPdf) setStatus("請在列印視窗選「儲存為 PDF」或「另存 PDF」。");
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    document.body.classList.remove("rack-printing");
    document.title = prev || "產品出貨紀錄表";
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
  setTimeout(done, 60000);
}
async function copyRackSheet() {
  const text = rackSheetText();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setStatus("總單已複製，可直接貼到 LINE。");
    return true;
  } catch (_) {
    setStatus("複製失敗，請長按選取後再複製。", true);
    return false;
  }
}
async function shareRackSheet() {
  setStatus("正在做成圖片…");
  let file = null;
  try {
    file = await rackSheetPngFile();
  } catch (_) {
    setStatus("做成圖片失敗，改傳文字。", true);
  }
  const title = rackSheetFileTitle();
  const text = `${rackPick || ""} 鐵架對帳單（N＝穠全　H＝鴻安）`;
  if (file) {
    const payload = { title, text, files: [file] };
    if (navigator.canShare?.({ files: [file] }) || navigator.canShare?.(payload)) {
      try {
        await navigator.share(payload);
        setStatus("已打開分享，請選 LINE 傳送圖片。");
        return;
      } catch (err) {
        if (err?.name === "AbortError") {
          setStatus("");
          return;
        }
      }
    }
    downloadRackSheetPng(file);
    setStatus("已存成圖片檔，請傳到 LINE。電腦可再按一次「傳 LINE」選 LINE。");
    return;
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text: rackSheetText() });
      setStatus("已打開分享，請選 LINE。");
      return;
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
  }
  await copyRackSheet();
}
function rackTxnPool() {
  return rackTxns.filter((t) => {
    if (rackCo && t.company !== rackCo) return false;
    if (rackTo && t.date > rackTo) return false;
    if (rackIntervalOn() && rackFrom && t.date < rackFrom) return false;
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
  const y = rackRocYear();
  if (y) text += ` 查詢民國${y}年度 ${rackFrom} ～ ${rackTo}。`;
  else if (rackMode === "custom" && rackFrom) text += ` 比對區間 ${rackFrom} ～ ${rackTo}。`;
  else text += ` 查詢截至 ${rackTo}。`;
  if (rackIntervalOn() && !rackKeepPrior()) text += " 不含前期尚欠。";
  if (rackTo > span.to) text += ` 匯入最新只到 ${span.to}，之後尚未上傳。`;
  else if (rackTo < span.to) text += ` 目前只看到截至 ${rackTo}。`;
  el.textContent = text;
}
function rackCustomerFrameDocs(customer, frame) {
  const co = rackCo;
  const rows = rackTxnPool().filter((t) => {
    if (t.customer !== customer || t.frame !== frame) return false;
    if (co && t.company !== co) return false;
    return true;
  });
  const outMap = new Map();
  const inMap = new Map();
  for (const t of rows) {
    const doc = t.doc || "（無單號）";
    const key = `${t.company}|${doc}`;
    const map = t.direction === "in" ? inMap : outMap;
    const cur = map.get(key) || {
      doc,
      date: t.date,
      qty: 0,
      dir: t.direction === "in" ? "歸還" : "借出",
      mark: rackCoMark(t.company),
    };
    cur.qty += t.qty;
    if (t.date && (!cur.date || t.date < cur.date)) cur.date = t.date;
    map.set(key, cur);
  }
  const outs = [...outMap.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const inns = [...inMap.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return {
    outs,
    inns,
    lines: [...inns, ...outs].sort((a, b) => String(b.date).localeCompare(String(a.date))),
    inn: inns.reduce((a, r) => a + r.qty, 0),
    out: outs.reduce((a, r) => a + r.qty, 0),
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
  applyRackYearDates();
  const yearOn = !!rackRocYear();
  const fromWrap = document.getElementById("rack-from-wrap");
  if (fromWrap) fromWrap.hidden = rackMode !== "custom";
  const toLab = document.getElementById("rack-to-lab");
  if (toLab) toLab.hidden = yearOn;
  const yearLab = document.getElementById("rack-year-lab");
  if (yearLab) {
    yearLab.hidden = !yearOn;
    yearLab.textContent = yearOn ? `民國${rackRocYear()}年　${rackFrom} ～ ${rackTo}` : "";
  }
  const priorWrap = document.getElementById("rack-prior-wrap");
  if (priorWrap) priorWrap.hidden = !rackIntervalOn();
  const priorEl = document.getElementById("rack-prior");
  if (priorEl) priorEl.checked = rackPrior;
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
      const rows = lib.frameAtCustomers(s, rackPick).map(rackViewCell).filter((r) => r.closing > 0).sort((a, b) => b.closing - a.closing);
      const qty = rows.reduce((a, r) => a + r.closing, 0);
      box.innerHTML = `<button type="button" class="ghost rack-back" data-rack-back>返回架種</button>
        <div class="rack-sheet-actions"><button type="button" class="primary" data-rack-share>傳 LINE</button></div>
        <p class="rack-stat"><b>${esc(rackLabel(s, rackPick))}</b>　${rows.length} 戶　在外 ${rackFmt(qty)}</p>
        <table class="rack-table"><thead><tr><th>客人</th><th>還欠</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${esc(r.customer)}</td><td class="owed">${rackFmt(r.closing)}</td></tr>`).join("")}
        </tbody></table>`;
      return;
    }
    const frames = s.frames
      .map((f) => {
        const list = lib.frameAtCustomers(s, f).map(rackViewCell).filter((r) => r.closing > 0);
        const qty = list.reduce((a, r) => a + r.closing, 0);
        return { f, label: rackLabel(s, f), households: list.length, qty };
      })
      .filter((x) => x.qty > 0 && (rackMatch(x.label, q) || rackMatch(x.f, q)))
      .sort((a, b) => b.qty - a.qty);
    box.innerHTML = frames.length
      ? `<div class="rack-sheet-actions"><button type="button" class="primary" data-rack-share>傳 LINE</button></div>
        <table class="rack-table"><thead><tr><th>架種</th><th>戶數</th><th>在外</th></tr></thead><tbody>
        ${frames.map((x) => `<tr data-rack-pick="${esc(x.f)}"><td>${esc(x.label)}</td><td>${rackFmt(x.households)}</td><td class="owed">${rackFmt(x.qty)}</td></tr>`).join("")}
        </tbody></table>`
      : `<p class="empty">沒有符合的架種尚欠。</p>`;
    return;
  }
  if (rackPane === "customer") {
    if (rackPick && rackLine) {
      const sheet = rackCustomerSheetRows(rackPick);
      const rows = sheet.rows.filter((r) => r.frame === rackLine && (!rackSrc || r.mark === rackSrc));
      const owed = rows.reduce((a, r) => a + (r.closing || 0), 0);
      const docs = rackCustomerFrameDocs(rackPick, rackLine);
      const srcLab =
        !rackSrc || rackSrc === "N+H"
          ? "來源 N＝穠全　H＝鴻安（明細仍分公司）"
          : `來源 ${esc(rackSrc)}＝${esc(rackCoFromMark(rackSrc) || rackCoLabel())}`;
      const lines = docs.lines.length
        ? docs.lines
            .map(
              (d) =>
                `<tr><td class="rack-col-date">${esc(d.date || "")}</td><td class="rack-col-doc">${esc(d.doc)}</td><td class="rack-col-kind">${esc(d.dir)}</td><td class="${d.dir === "歸還" ? "rack-in" : "owed"}">${rackFmt(d.qty)}</td><td class="rack-src">${esc(d.mark || "")}</td></tr>`,
            )
            .join("")
        : `<tr><td colspan="5">沒有單號明細</td></tr>`;
      box.innerHTML = `<button type="button" class="ghost rack-back" data-rack-back="sheet">返回總單</button>
        <div class="rack-sheet-actions">
          <button type="button" class="ghost" data-rack-xlsx>匯出 Excel</button>
          <button type="button" class="ghost" data-rack-pdf>匯出 PDF</button>
          <button type="button" class="primary" data-rack-share>傳 LINE</button>
        </div>
        <article class="rack-sheet">
          <p class="rack-print-brand">鴻安農業科技　鐵架明細</p>
          <h3 class="rack-sheet-title">${esc(rackPick)}　${esc(rackLabel(s, rackLine))}</h3>
          <p class="rack-owed-big">欠架總數 <span>${rackFmt(owed)}</span></p>
          <p class="rack-stat">${srcLab}　借出 ${rackFmt(docs.out)}　歸還 ${rackFmt(docs.inn)}　${esc(rackSheetPeriodText())}</p>
          <table class="rack-table rack-sheet-table"><thead><tr><th>日期</th><th>單號</th><th>類別</th><th>數量</th><th>來源</th></tr></thead><tbody>${lines}</tbody></table>
        </article>`;
      return;
    }
    if (rackPick) {
      const custom = rackIntervalOn();
      const sheet = rackSheetRows();
      const rows = sheet.rows;
      const hidden = sheet.hidden || [];
      const qty = sheet.qty;
      const s = sheet.s;
      const showOpen = sheet.showOpen;
      const head = showOpen
        ? `<thead><tr><th>品項</th><th>期初</th><th>借出</th><th>歸還</th><th class="owed-col">欠架</th><th>來源</th><th class="no-print"></th></tr></thead>`
        : `<thead><tr><th>品項</th><th>借出</th><th>歸還</th><th class="owed-col">欠架</th><th>來源</th><th class="no-print"></th></tr></thead>`;
      const hideBtn = (r) =>
        `<td class="no-print"><button type="button" class="ghost rack-mini" data-rack-hide="${esc(rackRowKey(r))}">隱藏</button></td>`;
      const body = rows
        .map((r) =>
          showOpen
            ? `<tr data-rack-line="${esc(r.frame)}" data-rack-src="${esc(r.mark)}"><td>${esc(rackLabel(s, r.frame))}</td><td>${rackFmt(r.opening)}</td><td>${rackFmt(r.out)}</td><td class="rack-in">${rackFmt(r.inn)}</td><td class="owed">${rackFmt(r.closing)}</td><td class="rack-src">${esc(r.mark)}</td>${hideBtn(r)}</tr>`
            : `<tr data-rack-line="${esc(r.frame)}" data-rack-src="${esc(r.mark)}"><td>${esc(rackLabel(s, r.frame))}</td><td>${rackFmt(r.out)}</td><td class="rack-in">${rackFmt(r.inn)}</td><td class="owed">${rackFmt(r.closing)}</td><td class="rack-src">${esc(r.mark)}</td>${hideBtn(r)}</tr>`,
        )
        .join("");
      const foot = showOpen
        ? `<tr><td>合計</td><td>${rackFmt(rows.reduce((a, r) => a + (r.opening || 0), 0))}</td><td>${rackFmt(rows.reduce((a, r) => a + (r.out || 0), 0))}</td><td class="rack-in">${rackFmt(rows.reduce((a, r) => a + (r.inn || 0), 0))}</td><td class="owed">${rackFmt(qty)}</td><td></td><td class="no-print"></td></tr>`
        : `<tr><td>合計</td><td>${rackFmt(rows.reduce((a, r) => a + (r.out || 0), 0))}</td><td class="rack-in">${rackFmt(rows.reduce((a, r) => a + (r.inn || 0), 0))}</td><td class="owed">${rackFmt(qty)}</td><td></td><td class="no-print"></td></tr>`;
      const hiddenBox = hidden.length
        ? `<div class="rack-hidden-box no-print"><p>已隱藏 ${hidden.length} 筆，不會列入傳 LINE／列印／匯出。</p>${hidden
            .map(
              (r) =>
                `<button type="button" class="ghost rack-mini" data-rack-show="${esc(rackRowKey(r))}">顯示 ${esc(rackLabel(s, r.frame))} ${esc(r.mark || "")}</button>`,
            )
            .join("")}</div>`
        : "";
      box.innerHTML = `<button type="button" class="ghost rack-back" data-rack-back="list">返回客人</button>
        <div class="rack-sheet-actions">
          <button type="button" class="ghost" data-rack-print>列印</button>
          <button type="button" class="ghost" data-rack-xlsx>匯出 Excel</button>
          <button type="button" class="ghost" data-rack-pdf>匯出 PDF</button>
          <button type="button" class="primary" data-rack-share>傳 LINE</button>
        </div>
        <article class="rack-sheet">
          <p class="rack-print-brand">鴻安農業科技　鐵架對帳單</p>
          <h3 class="rack-sheet-title">總單　${esc(rackPick)}</h3>
          <p class="rack-stat">${rackCo ? `來源 ${esc(rackCoMark(rackCo))}＝${esc(rackCo)}` : "兩家合計：同名同品項已加總。N＝穠全　H＝鴻安　N+H＝兩家都有"}　顯示 ${rows.length} 種${hidden.length ? `（已隱藏 ${hidden.length}）` : ""}　${esc(rackSheetPeriodText())}</p>
          ${
            rows.length
              ? `<table class="rack-table rack-sheet-table">${head}<tbody>${body}${foot}</tbody></table>`
              : `<p class="empty">${hidden.length ? "目前列都已隱藏，傳給客人會是空白。請先顯示要給的品項。" : "這個客人目前沒有欠架。"}</p>`
          }
        </article>
        ${hiddenBox}`;
      return;
    }
    const names = s.customers
      .map((c) => {
        const rows = lib.customerOwed(s, c).map(rackViewCell).filter((r) => r.closing > 0);
        return { c, kinds: rows.length, qty: rows.reduce((a, r) => a + r.closing, 0) };
      })
      .filter((x) => x.qty > 0 && rackMatch(x.c, q))
      .sort((a, b) => b.qty - a.qty);
    box.innerHTML = names.length
      ? `<div class="rack-sheet-actions"><button type="button" class="primary" data-rack-share>傳 LINE</button></div>
        <table class="rack-table"><thead><tr><th>客人</th><th>種類</th><th>還欠</th></tr></thead><tbody>
        ${names.map((x) => `<tr data-rack-pick="${esc(x.c)}"><td>${esc(x.c)}</td><td>${rackFmt(x.kinds)}</td><td class="owed">${rackFmt(x.qty)}</td></tr>`).join("")}
        </tbody></table>`
      : `<p class="empty">沒有符合的客人尚欠。</p>`;
    return;
  }
  const carriers = lib.uniqueCarriers(s.customers);
  if (rackPick) {
    const members = lib.customersOfCarrier(s.customers, rackPick);
    const rows = lib.mergeOwed(s, members).map(rackViewCell).filter((r) => r.closing > 0).sort((a, b) => b.closing - a.closing);
    const qty = rows.reduce((a, r) => a + r.closing, 0);
    box.innerHTML = `<button type="button" class="ghost rack-back" data-rack-back>返回貨運</button>
      <div class="rack-sheet-actions"><button type="button" class="primary" data-rack-share>傳 LINE</button></div>
      <p class="rack-stat"><b>${esc(rackPick)}</b>　${members.length} 戶　還欠 ${rackFmt(qty)}</p>
      <table class="rack-table"><thead><tr><th>架種</th><th>還欠</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(rackLabel(s, r.frame))}</td><td class="owed">${rackFmt(r.closing)}</td></tr>`).join("")}
      </tbody></table>`;
    return;
  }
  const list = carriers
    .map((c) => {
      const members = lib.customersOfCarrier(s.customers, c);
      const rows = lib.mergeOwed(s, members).map(rackViewCell).filter((r) => r.closing > 0);
      return { c, households: members.length, qty: rows.reduce((a, r) => a + r.closing, 0) };
    })
    .filter((x) => x.qty > 0 && rackMatch(x.c, q))
    .sort((a, b) => b.qty - a.qty);
  box.innerHTML = list.length
    ? `<div class="rack-sheet-actions"><button type="button" class="primary" data-rack-share>傳 LINE</button></div>
      <table class="rack-table"><thead><tr><th>貨運行</th><th>戶數</th><th>還欠</th></tr></thead><tbody>
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
function syncPlanMainPaneHeights() {
  document.querySelectorAll("#plan-main-swipe [data-plan-main-page]").forEach((p) => {
    p.classList.toggle("is-off", p.dataset.planMainPage !== planMain);
  });
}
function applyPlanMain(smooth) {
  if (currentRole() === "driver") planMain = "ship";
  document.querySelectorAll("#plan-main-tabs [data-plan-main]").forEach((b) => {
    b.classList.toggle("on", b.dataset.planMain === planMain);
  });
  syncOpsFlowTabs();
  const breakBox = document.getElementById("plan-break");
  if (breakBox) breakBox.hidden = currentRole() === "driver" || planMain === "ship";
  const swipe = document.getElementById("plan-main-swipe");
  const pane = document.querySelector(`[data-plan-main-page="${planMain}"]`);
  if (!swipe || !pane || page !== "plan") return;
  const go = () => {
    planMainLock = true;
    swipe.querySelectorAll("[data-plan-main-page]").forEach((p) => p.classList.remove("is-off"));
    const left = pane.offsetLeft;
    if (smooth) swipe.scrollTo({ left, behavior: "smooth" });
    else swipe.scrollLeft = left;
    window.setTimeout(() => {
      planMainLock = false;
      syncPlanMainPaneHeights();
    }, smooth ? 280 : 40);
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
  if (v === VENDOR_PENDING || v === "") return VENDOR_PENDING;
  if (VENDOR_OPTS.includes(v)) return v;
  const fallback = rowVendor(row);
  return fallback === "芳" && !row?.[key] ? VENDOR_PENDING : fallback;
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
  const fallback = String(row.vendor || "").trim();
  if (!row.rbVendor) row.rbVendor = VENDOR_OPTS.includes(fallback) ? fallback : VENDOR_PENDING;
  if (!row.gbVendor) row.gbVendor = VENDOR_OPTS.includes(fallback) ? fallback : VENDOR_PENDING;
  if (!VENDOR_OPTS.includes(String(row.rbVendor || "").trim()) && row.rbVendor !== VENDOR_PENDING) row.rbVendor = VENDOR_PENDING;
  if (!VENDOR_OPTS.includes(String(row.gbVendor || "").trim()) && row.gbVendor !== VENDOR_PENDING) row.gbVendor = VENDOR_PENDING;
  return row;
}
function linesFromDailyRow(row, meta) {
  const err = [];
  const lines = [];
  if (formKind === "leaf") {
    const z = qtyN(row.slZhi);
    const f = qtyN(row.slFang);
    const p = qtyN(row.slPend);
    const pack = row.pack || "籃裝";
    if (z) lines.push({ skuId: "sl-zhi", qty: z, pack });
    if (f) lines.push({ skuId: "sl-fang", qty: f, pack });
    if (p) lines.push({ skuId: "sl-pend", qty: p, pack });
  } else if (formKind === "basil") {
    migrateBasilDailyRow(row);
    const r = qtyN(row.rb);
    const g = qtyN(row.gb);
    const note = String(row.note || "").trim();
    if (r) {
      const v = basilVendorOf(row, "rb");
      const line = { skuId: v === VENDOR_PENDING ? "rb-pend" : BASIL_SKU.rb[v] || "rb-pend", qty: r };
      if (note) line.note = note;
      lines.push(line);
    }
    if (g) {
      const v = basilVendorOf(row, "gb");
      const line = { skuId: v === VENDOR_PENDING ? "gb-pend" : BASIL_SKU.gb[v] || "gb-pend", qty: g };
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
    } else if (l.skuId === "sl-pend") {
      row.slPend = l.qty;
      if (l.pack) row.pack = l.pack;
    } else if (l.skuId === "mint-kg") row.mint = l.qty;
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
/** 單號：純數字，或同客同日出貨拆帳本時的 base-01 / base-02 */
function parseOrderNo(no) {
  const s = String(no ?? "").trim();
  const m = /^(\d+)(?:-(\d+))?$/.exec(s);
  if (!m) {
    const n = Number(no);
    return { base: Number.isFinite(n) ? n : 0, suffix: null };
  }
  return {
    base: Number(m[1]),
    suffix: m[2] != null ? Number(m[2]) : null,
  };
}
function formatOrderNo(base, suffix) {
  const b = Math.max(0, Math.floor(Number(base) || 0));
  if (suffix == null || suffix === 0) return b;
  return `${b}-${String(Math.floor(Number(suffix) || 0)).padStart(2, "0")}`;
}
function orderNoSortKey(no) {
  const { base, suffix } = parseOrderNo(no);
  return base * 1000 + (suffix == null ? 0 : suffix);
}
function orderNoActive(o) {
  return o && o.status !== "cancelled" && o.status !== "deleted";
}
/**
 * 同客人＋同出貨日若已有另一帳本（穠全／鴻安）訂單，共用其基號，本張給 base-01（再拆則 -02…）。
 * 先建的那張保留純數字；不同客人仍各自往下編基號。
 */
function nextOrderNoFor(company, customer, shipDate) {
  const day = shipDate || today();
  const siblings = state.orders.filter(
    (o) =>
      orderNoActive(o) &&
      o.co !== company &&
      (o.shipDate || today()) === day &&
      namesMatch(o.customer, customer),
  );
  if (siblings.length) {
    const base = Math.min(...siblings.map((o) => parseOrderNo(o.no).base));
    const sameBase = state.orders.filter(
      (o) =>
        orderNoActive(o) &&
        (o.shipDate || today()) === day &&
        namesMatch(o.customer, customer) &&
        parseOrderNo(o.no).base === base,
    );
    const used = new Set(
      sameBase.map((o) => {
        const s = parseOrderNo(o.no).suffix;
        return s == null ? 0 : s;
      }),
    );
    let suf = 1;
    while (used.has(suf)) suf += 1;
    return formatOrderNo(base, suf);
  }
  const bases = state.orders
    .filter((o) => o.co === company)
    .map((o) => parseOrderNo(o.no).base)
    .filter((n) => Number.isFinite(n) && n > 0);
  return (bases.length ? Math.max(...bases) : 0) + 1;
}
function addOpenOrderFor(company, customer, shipDate, lines, shipAddr) {
  const day = shipDate || today();
  const addr = String(shipAddr || "").trim();
  const remark = orderNoteValue();
  const id = uid();
  state.orders.unshift({
    id,
    co: company,
    no: nextOrderNoFor(company, customer, day),
    customer,
    shipAddr: addr,
    remark,
    shipDate: day,
    preorder: isPreorderDay(day),
    lines,
    status: "open",
    prio: nextPrio(),
    urgent: orderUrgentValue(),
    edited: false,
    enteredBy: currentStaff() || "",
  });
  return id;
}
/** 同客同日出貨、另一帳本的待出單（改單加對岸品項時優先併入）。 */
function findOpenSiblingOrder(company, customer, shipDate, skipId) {
  const day = shipDate || today();
  return state.orders.find(
    (o) =>
      orderNoActive(o) &&
      o.status === "open" &&
      o.co === company &&
      (o.shipDate || today()) === day &&
      namesMatch(o.customer, customer) &&
      o.id !== skipId,
  );
}
/**
 * 改單時把另一帳本品項併入既有對岸待出單，或新建 sibling（共用基號 → N-01）。
 * @returns {string|null} sibling order id
 */
function addOrMergeOtherBookLines(sourceOrder, otherLines, who, day, shipAddr) {
  if (!sourceOrder || !otherLines?.length) return null;
  const otherCo = sourceOrder.co === "ha" ? "nq" : "ha";
  const sibling = findOpenSiblingOrder(otherCo, who, day, sourceOrder.id);
  if (sibling) {
    sibling.lines = [...(sibling.lines || []), ...otherLines.map((l) => ({ ...l }))];
    if (shipAddr) sibling.shipAddr = shipAddr;
    markOrderEdited(sibling);
    return sibling.id;
  }
  const id = addOpenOrderFor(otherCo, who, day, otherLines.map((l) => ({ ...l })), shipAddr);
  const created = state.orders.find((x) => x.id === id);
  if (created) {
    if (sourceOrder.remark && !String(created.remark || "").trim()) created.remark = sourceOrder.remark;
    if (sourceOrder.urgent) created.urgent = true;
  }
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
    o.urgent = orderUrgentValue();
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
        : `已修改單，修改人員：${currentStaff()}。`,
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
    if (a.status === "open") {
      return (rank[a.id] || 0) - (rank[b.id] || 0) || orderNoSortKey(a.no) - orderNoSortKey(b.no);
    }
    return orderNoSortKey(b.no) - orderNoSortKey(a.no);
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
      const tag = orderEditedTagHtml(o);
      const urgentTag = isOrderUrgent(o) ? '<span class="tag tag-urgent">急單</span>' : "";
      const preTag = isPreorderDay(o.shipDate) || o.preorder ? '<span class="tag tag-pre">預開</span>' : "";
      const bookTag = `<span class="tag">${esc(coLabel(o.co))}</span>`;
      const st = orderStatusLabel(o);
      const lines = o.lines
        .filter((l) => lineHasItem(l))
        .map((l) => `<span class="order-chip">${esc(lineLabel(l, true))}</span>`)
        .join("");
      const bits = [];
      if (o.status === "open") {
        if (!compact && can("ship-books") && !o.settled)
          bits.push(`<button type="button" class="ghost" data-act="ship" data-id="${o.id}">結單</button>`);
        if (can("edit")) bits.push(`<button type="button" data-act="edit" data-id="${o.id}">改單</button>`);
        if (can("cancel")) bits.push(`<button type="button" data-act="cancel" data-id="${o.id}">取消</button>`);
      }
      if ((o.status === "shipped" || o.status === "delivered") && can("edit-shipped")) {
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
      return `<article class="${cls}${isOrderUrgent(o) ? " is-urgent" : ""}">
        ${prio}
        <div class="order-body">
          <div class="order-card-head">
            <strong class="order-who">${urgentTag}${tag}${preTag}${bookTag}${esc(o.customer)}</strong>
            <span class="order-st st-${esc(o.status)}">${esc(st)}</span>
          </div>
          <p class="order-meta">出貨日 ${esc(o.shipDate)}　單號 #${esc(o.no)}${o.shipAddr ? `　送貨 ${esc(o.shipAddr)}` : ""}</p>
          ${o.remark ? `<p class="order-remark">${esc(o.remark)}</p>` : ""}
          ${orderEditHistoryHtml(o)}
          <p class="order-staff">${staffNoteHtml(o)}</p>
          <div class="order-chips">${lines}</div>
          ${acts}
        </div>
      </article>`;
    })
    .join("")}</div>`;
}
function pushAudit(kind, action, summary, payload) {
  if (!state.auditLog || !Array.isArray(state.auditLog)) state.auditLog = [];
  state.auditLog.unshift({
    id: `au-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind: String(kind || ""),
    action: String(action || "delete"),
    summary: String(summary || ""),
    payload: payload && typeof payload === "object" ? payload : null,
    by: currentStaff() || "",
    at: Date.now(),
  });
  if (state.auditLog.length > 800) state.auditLog.length = 800;
}
window.pushAudit = pushAudit;
function canOrderMulti() {
  return currentRole() === "boss";
}
function orderMultiOn() {
  return !!(orderMulti && canOrderMulti());
}
function clearOrderMulti() {
  orderMulti = null;
}
function startOrderMulti(id) {
  if (!canOrderMulti()) return;
  orderMulti = { ids: new Set() };
  if (id) orderMulti.ids.add(id);
  renderOrders();
}
function toggleOrderMultiId(id) {
  if (!orderMultiOn() || !id) return;
  if (orderMulti.ids.has(id)) orderMulti.ids.delete(id);
  else orderMulti.ids.add(id);
  if (!orderMulti.ids.size) {
    clearOrderMulti();
  }
  renderOrders();
}
function selectedMultiOrders() {
  if (!orderMultiOn()) return [];
  return state.orders.filter((o) => orderMulti.ids.has(o.id));
}
function orderMultiBarHtml() {
  if (!orderMultiOn()) return "";
  const n = orderMulti.ids.size;
  const list = selectedMultiOrders();
  const shipN = list.filter((o) => o.status === "open" || o.status === "delivered").length;
  const delN = list.filter((o) => o.status !== "cancelled" && o.status !== "deleted").length;
  return `<div class="order-multi-bar" role="toolbar" aria-label="多選操作">
    <span class="order-multi-count">已選 <b>${n}</b></span>
    <button type="button" class="primary" data-order-multi-ship ${shipN ? "" : "disabled"}>確認出貨${shipN ? `（${shipN}）` : ""}</button>
    <button type="button" class="ghost danger" data-order-multi-del ${delN ? "" : "disabled"}>刪除${delN ? `（${delN}）` : ""}</button>
    <button type="button" class="ghost" data-order-multi-clear>取消選取</button>
  </div>`;
}
function batchShipSelectedOrders() {
  if (!requireCan("ship-books", "沒有出貨權限。")) return;
  const list = selectedMultiOrders().filter((o) => o.status === "open" || o.status === "delivered");
  if (!list.length) return setStatus("請先選未送出的訂單。", true);
  const ok = shipOpenOrders(list, {
    confirmMsg: `確定將這 ${list.length} 張確認出貨並扣庫？\n會標成已送出。`,
  });
  if (ok) clearOrderMulti();
}
function batchDeleteSelectedOrders() {
  if (!requireCan("delete", "沒有刪除權限。")) return;
  const list = selectedMultiOrders().filter((o) => o.status !== "cancelled" && o.status !== "deleted");
  if (!list.length) return setStatus("請先選要刪的訂單。", true);
  if (!confirm(`確定刪除這 ${list.length} 張？\n刪除後仍會留在已填紀錄，標「已刪除」。`)) return;
  for (const o of list) {
    unwindShipment(o);
    o.status = "deleted";
    o.deletedBy = currentStaff();
    pushAudit("order", "delete", `訂單 #${o.no || ""} ${o.customer || ""}`, {
      id: o.id,
      no: o.no,
      customer: o.customer,
      shipDate: o.shipDate,
      lines: o.lines,
    });
    if (inlineEdit?.id === o.id) inlineEdit = null;
    if (editing === o.id) {
      editing = "";
      const editEl = document.getElementById("edit-id");
      if (editEl) editEl.value = "";
      const cancelEdit = document.getElementById("cancel-edit");
      if (cancelEdit) cancelEdit.hidden = true;
    }
  }
  clearOrderMulti();
  save();
  setStatus(`已刪除 ${list.length} 張並留存紀錄。刪除人員：${currentStaff()}`, false);
  render();
}
function ordersTodayQuery() {
  return String(ordersTodayQ || "").trim();
}
function normalizeOrdersSearch(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/^#+/, "");
}
function settleCardMatchesTodaySearch(card, qRaw) {
  const q = normalizeOrdersSearch(qRaw);
  if (!q) return true;
  const cust = String(card.getAttribute("data-orders-cust") || "").toLowerCase();
  if (cust.includes(q)) return true;
  const nos = String(card.getAttribute("data-orders-nos") || "")
    .split(/\s+/)
    .filter(Boolean);
  for (const raw of nos) {
    const no = normalizeOrdersSearch(raw);
    if (no && no.includes(q)) return true;
    if (String(raw).toLowerCase().includes(q)) return true;
  }
  return false;
}
function syncOrdersTodaySearchUi() {
  const qEl = document.getElementById("orders-today-q");
  const clearBtn = document.getElementById("orders-today-q-clear");
  const q = ordersTodayQuery();
  // Never rewrite the focused input (avoids cursor / IME thrash while typing).
  if (qEl && document.activeElement !== qEl && qEl.value !== ordersTodayQ) qEl.value = ordersTodayQ;
  // Keep clear button in layout (visibility only) — toggling `hidden` reflows the
  // focused input and steals focus / kills IME on mobile.
  if (clearBtn) {
    const show = !!q;
    clearBtn.hidden = false;
    clearBtn.classList.toggle("is-idle", !show);
    clearBtn.tabIndex = show ? 0 : -1;
    clearBtn.setAttribute("aria-hidden", show ? "false" : "true");
  }
}
function restoreOrdersTodaySearchFocus(qEl, start, end) {
  if (!qEl) return;
  const apply = () => {
    if (document.activeElement === qEl) {
      try {
        if (typeof start === "number" && typeof end === "number") qEl.setSelectionRange(start, end);
      } catch (_) {}
      return;
    }
    try {
      qEl.focus({ preventScroll: true });
    } catch (_) {
      qEl.focus();
    }
    try {
      if (typeof start === "number" && typeof end === "number") qEl.setSelectionRange(start, end);
    } catch (_) {}
  };
  apply();
  requestAnimationFrame(apply);
}
function applyOrdersTodaySearchFilter() {
  const box = document.getElementById("orders-today");
  const miss = document.getElementById("orders-today-q-miss");
  const qEl = document.getElementById("orders-today-q");
  const q = ordersTodayQuery();
  const swipe = document.getElementById("orders-swipe");
  const keepFocus = !!(qEl && document.activeElement === qEl);
  const selStart = keepFocus ? qEl.selectionStart : null;
  const selEnd = keepFocus ? qEl.selectionEnd : null;
  const swipeLeft = swipe ? swipe.scrollLeft : 0;
  syncOrdersTodaySearchUi();
  if (!box) {
    if (keepFocus) restoreOrdersTodaySearchFocus(qEl, selStart, selEnd);
    return;
  }
  const cards = box.querySelectorAll(".settle-card");
  if (!q || !cards.length) {
    cards.forEach((c) => {
      c.hidden = false;
    });
    if (miss) {
      miss.hidden = true;
      miss.textContent = "";
    }
  } else {
    let shown = 0;
    cards.forEach((card) => {
      const ok = settleCardMatchesTodaySearch(card, q);
      card.hidden = !ok;
      if (ok) shown += 1;
    });
    if (miss) {
      if (shown) {
        miss.hidden = true;
        miss.textContent = "";
      } else {
        miss.hidden = false;
        miss.textContent = `找不到符合「${q}」的客戶或單號。`;
      }
    }
  }
  // List height changes can nudge horizontal snap panes — pin swipe + focus.
  if (swipe && Math.abs(swipe.scrollLeft - swipeLeft) > 1) swipe.scrollLeft = swipeLeft;
  if (keepFocus) restoreOrdersTodaySearchFocus(qEl, selStart, selEnd);
}
function scheduleOrdersTodaySearchFilter(immediate = false) {
  clearTimeout(ordersTodaySearchTimer);
  ordersTodaySearchTimer = 0;
  if (immediate) {
    applyOrdersTodaySearchFilter();
    return;
  }
  ordersTodaySearchTimer = setTimeout(() => {
    ordersTodaySearchTimer = 0;
    applyOrdersTodaySearchFilter();
  }, ORDERS_TODAY_SEARCH_MS);
}
function ordersTodayCustomerHtml() {
  const day = ordersViewDay();
  // Always render the full day list; search uses show/hide (debounced) so typing
  // does not rebuild / reorder cards on every keystroke.
  const list = state.orders.filter(
    (o) => (o.shipDate || today()) === day && o.status !== "cancelled" && o.status !== "deleted",
  );
  if (!list.length) {
    return `<p class="empty">${day} 尚無已填紀錄。</p>`;
  }
  const multi = orderMultiOn();
  const canMulti = canOrderMulti();
  const groups = groupOrdersByCustomer(list);
  const cards = groups
    .map(([customer, orders]) => {
      const unsettle = orders.filter((o) => o.status === "open" && !o.settled);
      const settledOpen = orders.filter((o) => o.status === "open" && o.settled);
      const done = orders.filter((o) => o.status === "shipped" || o.status === "delivered");
      const allSent = unsettle.length + settledOpen.length === 0 && done.length > 0;
      const allSettled = unsettle.length === 0 && (settledOpen.length > 0 || done.length > 0);
      const someSettled = unsettle.length > 0 && (settledOpen.length > 0 || done.length > 0);
      const st = allSent
        ? "已送出"
        : allSettled
          ? "已結單"
          : someSettled
            ? "部分結單"
            : orderStatusLabel(unsettle[0] || orders[0]);
      const stClass = allSent ? "shipped" : allSettled || someSettled ? "part" : "pending";
      const addr = groupShipAddr(orders);
      const edited = orders.some((o) => o.edited);
      const urgent = orders.some((o) => isOrderUrgent(o) && isOrderUnshipped(o));
      const blocks = orders
        .slice()
        .sort((a, b) => {
          const ra = { open: 0, delivered: 1, shipped: 2 }[a.status] ?? 9;
          const rb = { open: 0, delivered: 1, shipped: 2 }[b.status] ?? 9;
          if (ra !== rb) return ra - rb;
          const ua = isOrderUrgent(a) && a.status === "open" ? 0 : 1;
          const ub = isOrderUrgent(b) && b.status === "open" ? 0 : 1;
          if (ua !== ub) return ua - ub;
          const sa = a.settled ? 1 : 0;
          const sb = b.settled ? 1 : 0;
          return sa - sb || orderNoSortKey(a.no) - orderNoSortKey(b.no);
        })
        .map((o) => {
          const editingHere = inlineEdit && inlineEdit.id === o.id;
          const selected = multi && orderMulti.ids.has(o.id);
          const lines = (o.lines || [])
            .filter((l) => lineHasItem(l))
            .map((l) => `<span class="order-chip">${esc(lineLabel(l, true))}</span>`)
            .join("");
          const acts = [];
          if (!editingHere && !multi) {
            if (o.status === "open" || o.status === "delivered") {
              if (can("edit")) acts.push(`<button type="button" data-act="edit" data-id="${o.id}">改單</button>`);
              if (can("cancel")) acts.push(`<button type="button" class="ghost" data-act="cancel" data-id="${o.id}">取消</button>`);
            } else if ((o.status === "shipped" || o.status === "delivered") && can("edit-shipped")) {
              acts.push(`<button type="button" data-act="edit" data-id="${o.id}">改單</button>`);
            }
            if (can("delete")) acts.push(`<button type="button" class="ghost" data-act="delete" data-id="${o.id}">刪除</button>`);
          }
          return `<div class="settle-order${o.edited ? " was-edited" : ""}${isOrderUrgent(o) ? " is-urgent" : ""}${o.settled && o.status === "open" ? " is-settled" : ""}${editingHere ? " is-editing" : ""}${highlightOrderIds.includes(o.id) ? " just-in" : ""}${canMulti ? " is-pickable" : ""}${selected ? " is-picked" : ""}" data-order-pick="${esc(o.id)}" aria-pressed="${selected ? "true" : "false"}">
            <div class="settle-order-head">
              ${canMulti ? `<span class="order-pick-mark" aria-hidden="true">${selected ? "✓" : ""}</span>` : ""}
              <span class="tag">${esc(coLabel(o.co))}</span>
              ${isOrderUrgent(o) ? '<span class="tag tag-urgent">急單</span>' : ""}
              <span class="settle-no">#${esc(o.no)}</span>
              <span class="order-st st-${esc(o.settled && o.status === "open" ? "delivered" : o.status)}">${esc(orderStatusLabel(o))}</span>
              ${orderEditedTagHtml(o)}
            </div>
            ${editingHere ? "" : o.remark ? `<p class="order-remark">${esc(o.remark)}</p>` : ""}
            ${editingHere ? "" : orderEditHistoryHtml(o)}
            ${editingHere ? "" : `<p class="order-staff">${staffNoteHtml(o)}</p>`}
            ${editingHere ? inlineEditPanelHtml(o) : `<div class="order-chips">${lines || '<span class="muted">無品項</span>'}</div>`}
            ${!editingHere && acts.length ? `<div class="order-actions">${acts.join("")}</div>` : ""}
          </div>`;
        })
        .join("");
      const settleBtn =
        !multi && unsettle.length && can("ship-books")
          ? `<button type="button" class="primary" data-settle-who="${esc(customer)}">結單${unsettle.length > 1 ? `（${unsettle.length}張）` : ""}</button>`
          : "";
      const labelBtn = !multi
        ? `<button type="button" class="ghost" data-ship-labels-who="${esc(customer)}" data-ship-labels-day="${esc(day)}">列印出貨標籤</button>`
        : "";
      if (allSent && !multi) {
        const lineBits = [...new Set(
          orders.flatMap((o) =>
            (o.lines || [])
              .filter((l) => lineHasItem(l))
              .map((l) => lineLabel(l, true)),
          ),
        )];
        const shown = lineBits.slice(0, 3).join("　");
        const more = lineBits.length > 3 ? `　+${lineBits.length - 3}` : "";
        const nos = orders.map((o) => `#${o.no}`).join(" ");
        const firstId = orders[0]?.id || "";
        const nosAttr = orders.map((o) => String(o.no || "")).join(" ");
        return `<article class="settle-card is-shipped is-compact${edited ? " was-edited" : ""}${orders.some((o) => highlightOrderIds.includes(o.id)) ? " just-in" : ""}${canMulti ? " is-pickable" : ""}" data-orders-cust="${esc(customer)}" data-orders-nos="${esc(nosAttr)}" ${canMulti && firstId ? `data-order-pick="${esc(firstId)}" data-order-pick-all="${esc(orders.map((o) => o.id).join(","))}"` : ""}>
          <div class="settle-compact">
            <div class="settle-compact-top">
              <strong class="settle-who">${edited ? '<span class="tag tag-edit">修改單</span>' : ""}${esc(customer)}</strong>
              <span class="order-st st-shipped">已送出</span>
            </div>
            <p class="settle-compact-meta">${esc(nos)}${addr ? `　${esc(addr)}` : ""}　${orders.length} 張</p>
            <p class="settle-compact-lines">${esc(shown)}${esc(more)}</p>
          </div>
        </article>`;
      }
      return `<article class="settle-card is-${stClass}${urgent ? " is-urgent" : ""}${edited ? " was-edited" : ""}${orders.some((o) => highlightOrderIds.includes(o.id)) ? " just-in" : ""}${multi ? " is-multi" : ""}" data-orders-cust="${esc(customer)}" data-orders-nos="${esc(orders.map((o) => String(o.no || "")).join(" "))}">
        <div class="settle-head">
          <div>
            <strong class="settle-who">${urgent ? '<span class="tag tag-urgent">急單</span>' : ""}${edited ? '<span class="tag tag-edit">修改單</span>' : ""}${esc(customer)}</strong>
            <p class="order-meta">出貨日 ${esc(day)}${addr ? `　送貨 ${esc(addr)}` : ""}　${orders.length} 張</p>
          </div>
          <span class="order-st st-${esc(allSettled || someSettled ? "delivered" : "open")}">${esc(st)}</span>
        </div>
        <div class="settle-orders">${blocks}</div>
        ${labelBtn || settleBtn ? `<div class="settle-actions">${labelBtn}${settleBtn}</div>` : ""}
      </article>`;
    })
    .join("");
  const hint = canMulti && !multi ? `<p class="hint order-multi-hint">主管可長按訂單進入多選，一次確認出貨或刪除。</p>` : "";
  return `${orderMultiBarHtml()}${hint}<div class="settle-cards${multi ? " is-multi" : ""}">${cards}</div>`;
}
function renderOrders() {
  const qEl = document.getElementById("orders-today-q");
  const keepFocus = !!(qEl && document.activeElement === qEl);
  const selStart = keepFocus ? qEl.selectionStart : null;
  const selEnd = keepFocus ? qEl.selectionEnd : null;
  const swipe = document.getElementById("orders-swipe");
  const swipeLeft = swipe ? swipe.scrollLeft : 0;
  const htmlBooks = ordersListHtml({ compact: false });
  const htmlToday = ordersTodayCustomerHtml();
  const books = document.getElementById("orders");
  const todayBox = document.getElementById("orders-today");
  // Only wipe list containers — never #orders-today-search / #orders-today-q.
  if (books) books.innerHTML = htmlBooks;
  if (todayBox) todayBox.innerHTML = htmlToday;
  const title = document.getElementById("orders-today-title");
  if (title) title.textContent = `已填單　${ordersViewDay()}`;
  applyOrdersTodaySearchFilter();
  if (swipe && Math.abs(swipe.scrollLeft - swipeLeft) > 1) swipe.scrollLeft = swipeLeft;
  if (keepFocus) restoreOrdersTodaySearchFocus(qEl, selStart, selEnd);
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
function planLeafBasilVendor(skuId) {
  if (skuId === "sl-pend" || skuId === "rb-pend" || skuId === "gb-pend") return VENDOR_PENDING;
  if (skuId === "sl-zhi") return "誌";
  if (skuId === "sl-fang") return "芳";
  const b = BASIL_REV[skuId];
  return b ? b.val : "";
}
function planDayLineRows(day) {
  const rows = [];
  for (const o of state.orders) {
    if (o.status === "cancelled" || o.status === "deleted") continue;
    if ((o.shipDate || today()) !== day) continue;
    if (o.status !== "open" && o.status !== "shipped" && o.status !== "delivered") continue;
    for (const l of o.lines || []) {
      if (!(l.qty > 0) || !l.skuId) continue;
      const sku = skuById(l.skuId);
      if (!sku) continue;
      rows.push({
        customer: o.customer || "未填",
        skuId: l.skuId,
        name: lineSkuName(l),
        qty: round(l.qty),
        unit: sku.unit,
        pack: l.pack || "",
        spec: l.spec || "",
        leafType: l.leafType || "",
        vendor: planLeafBasilVendor(l.skuId),
        done: o.status !== "open",
        pendingVendor: isVendorPendingSku(l.skuId),
      });
    }
  }
  return rows;
}
function ensurePrepStore() {
  if (!state.prep || typeof state.prep !== "object") state.prep = {};
}
function prepLineKey(r) {
  return `${String(r.customer || "").trim()}\t${r.skuId}\t${r.pack || ""}\t${r.spec || ""}\t${r.leafType || ""}`;
}
function isLinePrepped(day, r) {
  if (r.done) return true;
  ensurePrepStore();
  return !!(state.prep[day] && state.prep[day][prepLineKey(r)]);
}
function setLinePrepped(day, r, on) {
  ensurePrepStore();
  if (!state.prep[day]) state.prep[day] = {};
  const key = prepLineKey(r);
  if (on) {
    state.prep[day][key] = { by: currentStaff() || "", at: Date.now() };
  } else {
    delete state.prep[day][key];
    if (!Object.keys(state.prep[day]).length) delete state.prep[day];
  }
}
function prepStatsForRows(day, rows) {
  const open = rows.filter((r) => !r.done);
  const done = open.filter((r) => isLinePrepped(day, r)).length;
  return { total: open.length, done, left: Math.max(0, open.length - done) };
}
function canConfirmPrep() {
  const r = currentRole();
  return r === "site" || r === "acct" || r === "boss";
}
function togglePrepLine(day, key, want) {
  if (!canConfirmPrep()) return setStatus("現場或會計才能做理貨確認。", true);
  if (!requireStaff()) return;
  const rows = planMergeDayLines(planDayLineRows(day));
  const hit = rows.find((r) => prepLineKey(r) === key && !r.done);
  if (!hit) return setStatus("找不到這筆待理貨項目。", true);
  if (want && isVendorPendingSku(hit.skuId)) {
    return setStatus(`「${hit.customer}」${hit.name} 尚未選廠商，請先選廠商（會自動回寫訂單）。`, true);
  }
  setLinePrepped(day, hit, want);
  save();
  setStatus(want ? `已理貨確認「${hit.customer}」${hit.name}。` : `已取消理貨「${hit.customer}」${hit.name}。`, false);
  renderPlan();
}
function migratePrepKey(day, fromRow, toRow) {
  ensurePrepStore();
  if (!state.prep[day]) return;
  const from = prepLineKey(fromRow);
  const to = prepLineKey(toRow);
  if (from === to) return;
  if (state.prep[day][from]) {
    state.prep[day][to] = state.prep[day][from];
    delete state.prep[day][from];
  }
}
function packMatchLine(line, pack) {
  const want = pack || "";
  const got = line.pack || "";
  if (!want && !got) return true;
  if ((want || "籃裝") === (got || "籃裝")) return true;
  return want === got;
}
function writeBackOrderVendor(day, customer, fromSkuId, pack, vendor) {
  if (!canConfirmPrep()) return setStatus("現場或會計才能指定廠商。", true);
  if (!requireStaff()) return false;
  const nextSku = resolveVendorSku(fromSkuId, vendor);
  if (!nextSku || isVendorPendingSku(nextSku)) return setStatus("請選擇廠商。", true);
  if (nextSku === fromSkuId) return false;
  const who = String(customer || "").trim() || "未填";
  let n = 0;
  const fromRow = { customer: who, skuId: fromSkuId, pack: pack || "" };
  const toRow = { customer: who, skuId: nextSku, pack: pack || "" };
  const wasPrepped = isLinePrepped(day, fromRow);
  for (const o of state.orders) {
    if (o.status !== "open") continue;
    if (orderShipDay(o) !== day) continue;
    if (customerKey(o) !== who) continue;
    let touched = false;
    for (const l of o.lines || []) {
      if (l.skuId !== fromSkuId) continue;
      if (fromSkuId === "sl-pend" || fromSkuId === "sl-zhi" || fromSkuId === "sl-fang") {
        if (!packMatchLine(l, pack)) continue;
      }
      l.skuId = nextSku;
      if (l.labelName && /待定/.test(String(l.labelName))) delete l.labelName;
      touched = true;
      n += 1;
    }
    if (touched && o.settled) markOrderEdited(o);
  }
  if (!n) return setStatus(`找不到「${who}」可回寫的訂單明細。`, true);
  if (wasPrepped) migratePrepKey(day, fromRow, toRow);
  else {
    ensurePrepStore();
    if (state.prep[day]?.[prepLineKey(fromRow)]) migratePrepKey(day, fromRow, toRow);
  }
  save();
  const lab = skuShortName(skuById(nextSku)) || nextSku;
  const verb = isVendorPendingSku(fromSkuId) ? "已指定廠商" : "已改廠商";
  setStatus(`${verb}並回寫訂單：「${who}」→ ${lab}`, false);
  renderPlan();
  renderOrders();
  return true;
}
function planVendorPickHtml(day, r) {
  if (!r || r.done) return "";
  const opts = vendorOptsForSku(r.skuId);
  if (!opts.length) return "";
  const pending = isVendorPendingSku(r.skuId);
  const cur = planLeafBasilVendor(r.skuId);
  if (!canConfirmPrep()) {
    return pending
      ? `<span class="plan-vend-need">${esc(VENDOR_PENDING)}</span>`
      : cur && cur !== VENDOR_PENDING
        ? `<span class="plan-vend-inline">${esc(cur)}</span>`
        : "";
  }
  const editKey = planVendorEditKey(day, r.customer, r.skuId, r.pack);
  const editing = planVendorEditKeys.has(editKey);
  /* 已選廠商：預設只顯示名稱＋修改；按修改才展開下拉 */
  if (!pending && !editing && cur && cur !== VENDOR_PENDING) {
    return `<span class="plan-vend-wrap is-set"><span class="plan-vend-inline">${esc(cur)}</span><button type="button" class="tiny-btn plan-vend-edit" data-vend-edit="1" data-vend-key="${esc(editKey)}" aria-label="修改廠商">修改</button></span>`;
  }
  const label = pending ? "選廠商" : "廠商";
  const choices = [
    pending ? `<option value="">${label}</option>` : "",
    ...opts.map((v) => `<option value="${esc(v)}"${!pending && v === cur ? " selected" : ""}>${esc(v)}</option>`),
  ]
    .filter(Boolean)
    .join("");
  const cancel =
    !pending && editing
      ? `<button type="button" class="tiny-btn plan-vend-cancel" data-vend-cancel="1" data-vend-key="${esc(editKey)}" aria-label="取消修改">取消</button>`
      : "";
  return `<span class="plan-vend-wrap${pending ? " is-pending" : " is-editing"}"><label class="plan-vend-field"><span class="plan-vend-lab-mini">${esc(label)}</span><select class="plan-vend-pick" data-vend-write="1" data-vend-day="${esc(day)}" data-vend-cust="${esc(r.customer)}" data-vend-sku="${esc(r.skuId)}" data-vend-pack="${esc(r.pack || "")}" data-vend-key="${esc(editKey)}" aria-label="${esc(label)}">${choices}</select></label>${cancel}</span>`;
}
function planGroupHead(g) {
  const processed = g.label.startsWith("加工·");
  const raw = g.label.replace(/^現採·/, "").replace(/^加工·/, "");
  const i = raw.indexOf("／");
  if (i < 0) return { kind: processed ? "加工" : "現採", mark: raw };
  return { kind: raw.slice(0, i), mark: raw.slice(i + 1) };
}
function planMarkShort(mark) {
  return String(mark || "")
    .replace(/紅骨/g, "紅骨R")
    .replace(/綠骨/g, "綠骨G")
    .replace(/紐西蘭/g, "紐西蘭 NZ")
    .replace(/澳洲/g, "澳洲 AUX")
    .replace(/韓國/g, "韓國 KR")
    .replace(/越南/g, "越南 VN")
    .replace(/印尼/g, "印尼 ID")
    .replace(/美國/g, "美國 US");
}
function planCropName(name) {
  return String(name || "")
    .replace(/紫洋蔥/g, "紫洋")
    .replace(/散賣kg$|散賣斤$|散賣$/g, "");
}
const PLAN_CARD_I18N = {
  "sl-pend": { th: "ผักบุ้ง", vi: "Rau muống" },
  leaf: { th: "ผักบุ้ง", vi: "Rau muống" },
  "sl-zhi": { th: "ผักบุ้ง จื่อ", vi: "Rau muống Chí" },
  "sl-fang": { th: "ผักบุ้ง ฟาง", vi: "Rau muống Phương" },
  rb: { th: "โหระพาแดง R", vi: "Húng quế đỏ R" },
  gb: { th: "โหระพาเขียว G", vi: "Húng quế xanh G" },
  "mint-kg": { th: "สะระแหน่", vi: "Bạc hà" },
  "shiso-kg": { th: "ใบชิโซะ", vi: "Tía tô" },
  "basil-kg": { th: "โหระพา", vi: "Húng quế" },
  onion: { th: "หอมหัวใหญ่", vi: "Hành tây" },
  "onion-p": { th: "หอมม่วง", vi: "Hành tây tím" },
  "onion-b": { th: "หอม B", vi: "Hành B" },
  "pk-mi": { th: "ฟักทอง Mit", vi: "Bí đỏ Mit" },
  "pk-ch": { th: "ฟักทอง Acheng", vi: "Bí đỏ Acheng" },
  "pk-b": { th: "ฟักทอง B", vi: "Bí đỏ B" },
  cab: { th: "กะหล่ำปลี", vi: "Bắp cải" },
  nap: { th: "ผักกาดขาว", vi: "Cải thảo" },
  bur: { th: "โกโบ", vi: "Ngưu bàng" },
  wk: { th: "กะหล่ำปลีขาว", vi: "Bắp cải trắng" },
  ice: { th: "ผักกาดหอม", vi: "Xà lách" },
  cel: { th: "ขึ้นฉ่ายฝรั่ง", vi: "Cần tây" },
  bro: { th: "บร็อกโคลี", vi: "Súp lơ xanh" },
};
function planHaTone(sku) {
  const id = String(sku?.id || "");
  if (id.startsWith("onp-")) return "onion-p";
  if (id === "on-b-kg") return "onion-b";
  if (id.startsWith("on-")) return "onion";
  if (id.startsWith("pk-mi")) return "pk-mi";
  if (id.startsWith("pk-ch")) return "pk-ch";
  if (id === "pk-b-kg") return "pk-b";
  if (sku?.vegFam) return `veg-${sku.vegFam}`;
  return "ha-misc";
}
function planCardI18n(g) {
  if (PLAN_CARD_I18N[g.key]) return PLAN_CARD_I18N[g.key];
  const tone = g.tone || "";
  if (PLAN_CARD_I18N[tone]) return PLAN_CARD_I18N[tone];
  if (tone.startsWith("veg-")) {
    const fam = tone.slice(4);
    return PLAN_CARD_I18N[fam] || { th: "", vi: "" };
  }
  if (tone === "onion" || tone === "onion-p" || tone === "onion-b") return PLAN_CARD_I18N[tone] || { th: "", vi: "" };
  if (tone.startsWith("pk-")) return PLAN_CARD_I18N[tone] || { th: "", vi: "" };
  return { th: "", vi: "" };
}
function planCardView(g) {
  const head = planGroupHead(g);
  const i18n = planCardI18n(g);
  const processed = String(g.label || "").startsWith("加工·");
  let crop;
  let mark;
  if (head.kind === "現採" || head.kind === "加工") {
    crop = planCropName(head.mark);
    mark = processed ? "加工" : "現採";
  } else {
    crop = planCropName(head.kind);
    mark = planMarkShort(head.mark);
  }
  return {
    crop,
    mark,
    th: i18n.th || "",
    vi: i18n.vi || "",
    tone: g.tone,
  };
}
function planMergeDayLines(rows) {
  const merged = new Map();
  for (const r of rows) {
    const key = `${r.customer}\t${r.skuId}\t${r.pack || ""}\t${r.leafType || ""}\t${r.spec || ""}\t${r.done ? 1 : 0}`;
    const cur = merged.get(key);
    if (cur) cur.qty = round(cur.qty + r.qty);
    else merged.set(key, { ...r });
  }
  return [...merged.values()];
}
function planLineSpec(r) {
  if (r.skuId === "sl-pend" || r.skuId === "sl-zhi" || r.skuId === "sl-fang") {
    const pack = r.pack && r.pack !== "籃裝" ? r.pack : "籃裝";
    const vend = r.vendor || planLeafBasilVendor(r.skuId);
    return vend === VENDOR_PENDING ? `${VENDOR_PENDING}・${pack}` : vend === "誌" || vend === "芳" ? `${vend}・${pack}` : pack;
  }
  if (typeof isCabSku === "function" && isCabSku(r.skuId)) {
    return `${cabLeafTypeOf(r.leafType)}・${cabSpecOf(r.spec)}`;
  }
  if (typeof isPkSku === "function" && isPkSku(r.skuId)) {
    return `${pkVarOf(r)}・${pkWeightOf(r)}`;
  }
  if (r.spec) return r.spec;
  return r.vendor || "";
}
function planTotChipsHtml(rows, mode) {
  const buckets = new Map();
  for (const r of rows) {
    const label = mode === "pack" ? planLineSpec(r) : r.vendor || "其他";
    const key = `${label}\t${r.unit}`;
    const cur = buckets.get(key) || { label, unit: r.unit, qty: 0, shipped: 0, open: 0 };
    cur.qty = round(cur.qty + r.qty);
    if (r.done) cur.shipped = round(cur.shipped + r.qty);
    else cur.open = round(cur.open + r.qty);
    buckets.set(key, cur);
  }
  const rank = { 待定: -1, 誌: 0, 芳: 1, 琳: 2, 其他: 3, 籃裝: 0, 箱裝: 1 };
  const list = [...buckets.values()].sort((a, b) => (rank[a.label] ?? 9) - (rank[b.label] ?? 9) || a.label.localeCompare(b.label, "zh-Hant"));
  if (!list.length) return "";
  return `<ul class="plan-item-tots">${list
    .map(
      (t) =>
        `<li><span>${esc(t.label)}</span><strong>${fmt(t.qty)} ${esc(t.unit)}</strong><em><b class="is-shipped">已出貨 ${fmt(t.shipped)}</b><b class="is-open">未出貨 ${fmt(t.open)}</b></em></li>`,
    )
    .join("")}</ul>`;
}
function planCustRowsHtml(day, rows, hideSpec) {
  const byCust = new Map();
  for (const r of rows) {
    if (!byCust.has(r.customer)) byCust.set(r.customer, []);
    byCust.get(r.customer).push(r);
  }
  const names = [...byCust.keys()].sort((a, b) => a.localeCompare(b, "zh-Hant"));
  const canPrep = canConfirmPrep();
  return names
    .map((name) => {
      const list = byCust.get(name).sort((a, b) => planLineSpec(a).localeCompare(planLineSpec(b), "zh-Hant") || a.skuId.localeCompare(b.skuId));
      const allDone = list.every((r) => r.done);
      const someDone = list.some((r) => r.done);
      const openLines = list.filter((r) => !r.done);
      const allPrep = openLines.length > 0 && openLines.every((r) => isLinePrepped(day, r));
      const somePrep = openLines.some((r) => isLinePrepped(day, r));
      const qty = list
        .map((r) => {
          const spec = hideSpec ? "" : planLineSpec(r);
          const prepped = isLinePrepped(day, r);
          const mark = r.done
              ? `<span class="plan-shipped">已出貨</span>`
            : prepped
              ? `<span class="plan-prepped">已理貨</span>`
              : someDone || somePrep
                ? `<span class="plan-open">待理貨</span>`
                : "";
          const vendPick = planVendorPickHtml(day, r);
          const box =
            !r.done && canPrep && !isVendorPendingSku(r.skuId)
              ? `<label class="prep-check"><input type="checkbox" data-prep-key="${esc(prepLineKey(r))}" data-prep-day="${esc(day)}" ${prepped ? "checked" : ""} /><span class="prep-box" aria-hidden="true"></span></label>`
              : !r.done && isVendorPendingSku(r.skuId)
                ? `<span class="prep-check is-locked" title="先選廠商" aria-hidden="true"><span class="prep-box"></span></span>`
                : !r.done
                  ? `<span class="prep-check is-locked" title="已理貨狀態" aria-hidden="true"><span class="prep-box${prepped ? " on" : ""}"></span></span>`
                  : `<span class="prep-check is-done" aria-hidden="true"><span class="prep-box on"></span></span>`;
          return `<span class="plan-cust-qty">${box}${vendPick}${spec && !vendPick ? `${esc(spec)} ` : ""}${!vendPick && hideSpec && r.vendor && r.vendor !== VENDOR_PENDING ? `<span class="plan-vend-inline">${esc(r.vendor)}</span> ` : ""}<b>${fmt(r.qty)}</b> ${esc(r.unit)}${mark}</span>`;
        })
        .join("");
      const whoMark = allDone
        ? `<span class="plan-shipped">已出貨</span>`
        : allPrep
          ? `<span class="plan-prepped">已理貨</span>`
          : somePrep
            ? `<span class="plan-prepped is-part">理貨中</span>`
        : someDone
          ? `<span class="plan-shipped is-part">部分已出貨</span>`
              : `<span class="plan-open">待理貨</span>`;
      const cls = allDone
        ? "is-shipped"
        : allPrep
          ? "is-prepped"
          : somePrep || someDone
            ? "is-part"
            : "is-open";
      return `<div class="plan-cust ${cls}"><span class="plan-cust-who">${esc(name)}</span><span class="plan-cust-bits">${qty}</span>${whoMark}</div>`;
    })
    .join("");
}
function planItemBlockHtml(day, sec, allRows) {
  const rows = planMergeDayLines(allRows.filter((r) => sec.skuIds.includes(r.skuId)));
  if (!rows.length) return "";
  const totHtml = planTotChipsHtml(rows, sec.totMode);
  const prep = prepStatsForRows(day, rows);
  const prepHtml =
    prep.total > 0
      ? `<p class="prep-stat">理貨確認 <strong>${prep.done}/${prep.total}</strong>${prep.left ? `　尚餘 ${prep.left}` : "　已齊"}</p>`
      : "";
  let body;
  if (sec.totMode === "vendor") {
    const vendorRank = { 待定: -1, 芳: 0, 琳: 1, 其他: 2 };
    const byVend = new Map();
    for (const r of rows) {
      const v = r.vendor || VENDOR_PENDING;
      if (!byVend.has(v)) byVend.set(v, []);
      byVend.get(v).push(r);
    }
    body = [...byVend.keys()]
      .sort((a, b) => (vendorRank[a] ?? 9) - (vendorRank[b] ?? 9))
      .map((v) => `<div class="plan-vend-block"><h4 class="plan-vend-lab">${esc(v)}</h4>${planCustRowsHtml(day, byVend.get(v), true)}</div>`)
      .join("");
  } else {
    body = planCustRowsHtml(day, rows);
  }
  return `<section class="plan-break-card tone-${esc(sec.tone)}${prep.total && prep.done >= prep.total ? " is-prep-done" : ""}">
    <header class="plan-item-head">
      <span class="plan-item-kind">${esc(sec.kind)}</span>
      <h3>${esc(sec.mark)}</h3>
      ${totHtml}
      ${prepHtml}
    </header>
    ${body}
  </section>`;
}
function planBreakHtml(day) {
  const rows = planDayLineRows(day);
  const sections = [
    { kind: "地瓜葉", mark: "出貨", tone: "leaf", skuIds: ["sl-pend", "sl-zhi", "sl-fang"], totMode: "pack" },
    { kind: "九層塔", mark: "紅骨", tone: "rb", skuIds: ["rb-pend", "rb-fang", "rb-lin", "rb-oth"], totMode: "vendor" },
    { kind: "九層塔", mark: "綠骨", tone: "gb", skuIds: ["gb-pend", "gb-fang", "gb-lin", "gb-oth"], totMode: "vendor" },
  ];
  const html = sections.map((s) => planItemBlockHtml(day, s, rows)).join("");
  if (!html) {
    return `<section class="plan-zone plan-zone-prep${planZoneWrapClass("prep")}" aria-labelledby="plan-zone-prep-lab">
      ${planZoneHeadHtml({
        id: "prep",
        labId: "plan-zone-prep-lab",
        lab: "理貨確認",
        toneClass: "is-prep",
        subHtml: "當日沒有地瓜葉、九層塔叫貨",
      })}
      <div class="plan-zone-body" id="plan-zone-body-prep"${planZoneBodyAttrs("prep")}></div>
    </section>`;
  }
  const all = planMergeDayLines(rows.filter((r) => sections.some((s) => s.skuIds.includes(r.skuId))));
  const prep = prepStatsForRows(day, all);
  const pendN = all.filter((r) => !r.done && isVendorPendingSku(r.skuId)).length;
  const statHtml =
    prep.total > 0 ? `<span class="plan-zone-stat">已備 ${prep.done}／${prep.total}</span>` : "";
  const subHtml =
    prep.total > 0
      ? canConfirmPrep()
        ? pendN
          ? `待定廠商 ${pendN}：選廠商後自動回寫訂單`
          : "勾選已備妥的客戶品項"
        : "僅供查看"
      : "今日待出已結清或尚無待理貨";
  return `<section class="plan-zone plan-zone-prep${planZoneWrapClass("prep")}" aria-labelledby="plan-zone-prep-lab">
    ${planZoneHeadHtml({
      id: "prep",
      labId: "plan-zone-prep-lab",
      lab: "理貨確認",
      toneClass: "is-prep",
      statHtml,
      subHtml,
    })}
    <div class="plan-zone-body" id="plan-zone-body-prep"${planZoneBodyAttrs("prep")}><div class="plan-break">${html}</div></div>
  </section>`;
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
function planDayShippedQty(g, day) {
  let n = 0;
  for (const o of state.orders) {
    if (o.status !== "shipped" && o.status !== "delivered") continue;
    if ((o.shipDate || today()) !== day) continue;
    n += lineQtyForSkus(o, g.skuIds);
  }
  return round(n);
}
function planDayDemandQty(g, day) {
  return round(planDayPendingQty(g, day) + planDayShippedQty(g, day));
}
function openLinesForCustomerDay(customer, day) {
  const rows = [];
  for (const o of state.orders) {
    if (o.status !== "open") continue;
    if (orderShipDay(o) !== day) continue;
    if (customerKey(o) !== customer) continue;
    for (const l of o.lines || []) {
      if (!(l.qty > 0) || !l.skuId) continue;
      const sku = skuById(l.skuId);
      if (!sku) continue;
      rows.push({
        customer,
        skuId: l.skuId,
        name: lineSkuName(l),
        qty: round(l.qty),
        unit: sku.unit,
        pack: l.pack || "",
        spec: l.spec || "",
        leafType: l.leafType || "",
        done: false,
      });
    }
  }
  return planMergeDayLines(rows);
}
function customerPlanFlowStatus(day, orders) {
  const list = orders || [];
  if (!list.length) return { code: "none", label: "無單", drivers: [] };
  const drivers = groupDrivers(list);
  if (list.every((o) => o.status === "shipped" || o.status === "delivered")) {
    return { code: "sent", label: "已送貨", drivers };
  }
  const openLines = openLinesForCustomerDay(customerKey(list[0]), day);
  if (openLines.length && openLines.every((r) => isLinePrepped(day, r))) {
    return { code: "ready", label: "備貨完成", drivers };
  }
  return { code: "prep", label: "備貨中", drivers };
}
function planCropCustomerEntries(day, g) {
  const map = new Map();
  for (const o of state.orders) {
    if (o.status === "cancelled" || o.status === "deleted") continue;
    if (orderShipDay(o) !== day) continue;
    const qty = lineQtyForSkus(o, g.skuIds);
    if (!(qty > 0)) continue;
    const who = customerKey(o);
    if (!map.has(who)) map.set(who, { who, orders: [], qty: 0 });
    const row = map.get(who);
    row.orders.push(o);
    row.qty = round(row.qty + qty);
  }
  const out = [...map.values()].map((row) => {
    const open = row.orders.filter((o) => o.status === "open");
    const sent = row.orders.filter((o) => o.status === "shipped" || o.status === "delivered");
    let code = "prep";
    let label = "備貨中";
    if (!open.length && sent.length) {
      code = "sent";
      label = "已送貨";
    } else {
      const lines = [];
      for (const o of open) {
        for (const l of o.lines || []) {
          if (!(l.qty > 0) || !g.skuIds.includes(l.skuId)) continue;
          const sku = skuById(l.skuId);
          if (!sku) continue;
          lines.push({
            customer: row.who,
            skuId: l.skuId,
            name: lineSkuName(l),
            qty: round(l.qty),
            unit: sku.unit,
            pack: l.pack || "",
            spec: l.spec || "",
            leafType: l.leafType || "",
            done: false,
          });
        }
      }
      const merged = planMergeDayLines(lines);
      if (merged.length && merged.every((r) => isLinePrepped(day, r))) {
        code = "ready";
        label = "備貨完成";
      }
    }
    const note = planLineNote(row.orders[0], g.skuIds);
    const urgent = open.some((o) => isOrderUrgent(o));
    const rank = code === "sent" ? 2 : code === "ready" ? 1 : 0;
    return { ...row, code, label, note, urgent, rank };
  });
  return out.sort(
    (a, b) =>
      a.rank - b.rank ||
      (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) ||
      a.who.localeCompare(b.who, "zh-Hant"),
  );
}
function planCropPendingLines(day, g, customer) {
  return planCropVendorLines(day, g, customer).filter((l) => isVendorPendingSku(l.skuId));
}
/** Open 地瓜葉／九層塔 lines that can assign or switch vendor on 排程. */
function planCropVendorLines(day, g, customer) {
  const lines = [];
  for (const o of state.orders) {
    if (o.status !== "open") continue;
    if (orderShipDay(o) !== day) continue;
    if (customerKey(o) !== customer) continue;
    for (const l of o.lines || []) {
      if (!(l.qty > 0) || !l.skuId || !g.skuIds.includes(l.skuId)) continue;
      if (!vendorOptsForSku(l.skuId).length) continue;
      const sku = skuById(l.skuId);
      if (!sku) continue;
      lines.push({
        customer,
        skuId: l.skuId,
        name: lineSkuName(l),
        qty: round(l.qty),
        unit: sku.unit,
        pack: l.pack || "",
        spec: l.spec || "",
        leafType: l.leafType || "",
        vendor: planLeafBasilVendor(l.skuId),
        done: false,
        pendingVendor: isVendorPendingSku(l.skuId),
      });
    }
  }
  return planMergeDayLines(lines);
}
function planCropListHtml(day, g) {
  if (!g) return `<p class="empty">請點上方品項卡查看客戶訂單。</p>`;
  const rows = planCropCustomerEntries(day, g);
  const view = planCardView(g);
  if (!rows.length) return `<p class="empty">「${esc(view.crop)}」今日沒有出貨客戶。</p>`;
  const canPrep = canConfirmPrep();
  const counts = { prep: 0, ready: 0, sent: 0 };
  for (const r of rows) if (counts[r.code] != null) counts[r.code] += 1;
  const need = planDayPendingQty(g, day);
  const shipped = planDayShippedQty(g, day);
  const demand = planDayDemandQty(g, day);
  const list = rows
    .map((r) => {
      const vendLines = r.code === "sent" ? [] : planCropVendorLines(day, g, r.who);
      const pendLines = vendLines.filter((l) => isVendorPendingSku(l.skuId));
      const vendHtml = vendLines.length
        ? `<div class="plan-crop-vend">${vendLines
            .map((l) => {
              const pick = planVendorPickHtml(day, l);
              const pack = l.pack ? ` ${esc(l.pack)}` : "";
              const cur = l.vendor && l.vendor !== VENDOR_PENDING && !pick ? ` ${esc(l.vendor)}` : "";
              return `<span class="plan-crop-vend-row">${esc(l.name)}${pack}${cur} <b>${fmt(l.qty)}</b> ${esc(l.unit)} ${pick || (l.pendingVendor ? `<span class="plan-vend-need">${esc(VENDOR_PENDING)}</span>` : "")}</span>`;
            })
            .join("")}</div>`
        : "";
      const action =
        r.code === "prep" && canPrep
          ? `<button type="button" class="tiny-btn primary" data-prep-customer="${esc(r.who)}" data-prep-day="${esc(day)}" data-prep-on="1" data-prep-skus="${esc(g.skuIds.join(","))}">備貨完成</button>`
          : r.code === "ready" && canPrep
            ? `<button type="button" class="tiny-btn" data-prep-customer="${esc(r.who)}" data-prep-day="${esc(day)}" data-prep-on="0" data-prep-skus="${esc(g.skuIds.join(","))}">改回備貨中</button>`
            : "";
      return `<li class="plan-crop-row is-${esc(r.code)}${r.urgent ? " is-urgent" : ""}${pendLines.length ? " needs-vendor" : ""}">
        <div class="plan-crop-main">
          <strong>${r.urgent ? '<span class="tag tag-urgent">急</span>' : ""}${esc(r.who)}</strong>
          <span class="plan-crop-qty">${fmt(r.qty)} ${esc(g.unit)}${r.note ? `　${esc(r.note)}` : ""}</span>
          ${vendHtml}
        </div>
        <span class="plan-crop-badge">${pendLines.length ? "待定廠商" : esc(r.label)}</span>
        ${action}
      </li>`;
    })
    .join("");
  return `<section class="plan-crop-sec tone-${esc(g.tone)}">
    <div class="plan-crop-head">
      <div class="plan-crop-title">
        <h3><span class="plan-crop-name">${esc(view.crop)}</span>${view.mark && view.mark !== "現採" && view.mark !== "加工" ? ` ${esc(view.mark)}` : ""}</h3>
        ${(view.th || view.vi) ? `<p class="plan-crop-i18n">${view.th ? `<span lang="th">${esc(view.th)}</span>` : ""}${view.vi ? `<span lang="vi">${esc(view.vi)}</span>` : ""}</p>` : ""}
        <p class="plan-crop-totals"><span>今日總數 <b>${fmt(demand)}</b> ${esc(g.unit)}</span><span>待出 <b>${fmt(need)}</b></span><span>已出 <b>${fmt(shipped)}</b></span></p>
      </div>
      <p><span>備貨中 ${counts.prep}</span><span>備貨完成 ${counts.ready}</span><span>已送貨 ${counts.sent}</span></p>
    </div>
    <ul class="plan-crop-list">${list}</ul>
  </section>`;
}
function setCustomerPrepped(day, customer, on, skuIds) {
  if (!canConfirmPrep()) return setStatus("現場或會計才能做理貨確認。", true);
  if (!requireStaff()) return;
  let lines = openLinesForCustomerDay(customer, day);
  if (Array.isArray(skuIds) && skuIds.length) {
    const set = new Set(skuIds);
    lines = lines.filter((r) => set.has(r.skuId));
  }
  if (!lines.length) return setStatus(`「${customer}」沒有待備貨品項。`, true);
  if (on) {
    const pend = lines.filter((r) => isVendorPendingSku(r.skuId));
    if (pend.length) {
      return setStatus(`「${customer}」尚有待定廠商，請先選廠商（會自動回寫訂單）再備貨完成。`, true);
    }
  }
  for (const r of lines) setLinePrepped(day, r, on);
  save();
  setStatus(on ? `「${customer}」備貨完成。` : `「${customer}」改回備貨中。`, false);
  renderPlan();
}
function planOrderStatusHtml(day) {
  const list = state.orders.filter(
    (o) => o.status !== "cancelled" && o.status !== "deleted" && orderShipDay(o) === day,
  );
  const groups = groupOrdersByCustomer(list);
  const counts = { prep: 0, ready: 0, sent: 0 };
  const rows = groups
    .map(([who, orders]) => {
      const st = customerPlanFlowStatus(day, orders);
      if (counts[st.code] != null) counts[st.code] += 1;
      const urgent = (orders || []).some((o) => isOrderUrgent(o) && isOrderUnshipped(o));
      return { who, st, urgent, orders };
    })
    .sort((a, b) => {
      const ra = a.st.code === "sent" ? 2 : a.st.code === "ready" ? 1 : 0;
      const rb = b.st.code === "sent" ? 2 : b.st.code === "ready" ? 1 : 0;
      return ra - rb || (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || a.who.localeCompare(b.who, "zh-Hant");
    })
    .map(({ who, st, urgent }) => {
      return `<li class="plan-st-mini is-${esc(st.code)}${urgent ? " is-urgent" : ""}">
        <strong>${urgent ? '<span class="tag tag-urgent">急</span>' : ""}${esc(who)}</strong>
        <span class="plan-st-badge">${esc(st.label)}</span>
      </li>`;
    })
    .join("");
  const statHtml = groups.length
    ? `<span class="plan-zone-stat">備貨中 ${counts.prep}　完成 ${counts.ready}　已送 ${counts.sent}</span>`
    : "";
  const body = groups.length
    ? `<ul class="plan-status-mini">${rows}</ul>`
    : `<p class="empty">今日尚無訂單。</p>`;
  return `<section class="plan-zone plan-zone-all${planZoneWrapClass("all")}" aria-labelledby="plan-zone-all-lab">
    ${planZoneHeadHtml({
      id: "all",
      labId: "plan-zone-all-lab",
      lab: "全部訂單",
      toneClass: "is-all",
      statHtml,
      subHtml: "依客戶看備貨／完成／已送狀態",
    })}
    <div class="plan-zone-body" id="plan-zone-body-all"${planZoneBodyAttrs("all")}>${body}</div>
  </section>`;
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
    if (isVendorPendingSku(id)) continue;
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
    { key: "leaf", label: "現採·地瓜葉", unit: "籃", skuIds: ["sl-pend", "sl-zhi", "sl-fang"], tone: "leaf" },
    { key: "rb", label: "現採·九層塔／紅骨", unit: "箱", skuIds: ["rb-pend", "rb-fang", "rb-lin", "rb-oth"], tone: "rb" },
    { key: "gb", label: "現採·九層塔／綠骨", unit: "箱", skuIds: ["gb-pend", "gb-fang", "gb-lin", "gb-oth"], tone: "gb" },
    { key: "mint-kg", label: "現採·薄荷", unit: "kg", skuIds: ["mint-kg"], tone: "mint" },
    { key: "shiso-kg", label: "現採·紫蘇", unit: "kg", skuIds: ["shiso-kg", "shiso-jin"], tone: "shiso" },
    { key: "basil-kg", label: "現採·九層塔散賣", unit: "kg", skuIds: ["basil-kg"], tone: "herb" },
  ];
  const ha = SKUS.filter((s) => s.co === "ha" && isSiteSku(s)).map((sku) => ({
    key: sku.id,
    label: `加工·${skuShortName(sku)}`,
    unit: sku.unit,
    skuIds: [sku.id],
    tone: planHaTone(sku),
  }));
  return [...nq, ...ha];
}
function planLineNote(o, skuIds) {
  const bits = [];
  for (const l of o.lines || []) {
    if (!skuIds.includes(l.skuId)) continue;
    if (isVendorPendingSku(l.skuId)) bits.push(VENDOR_PENDING);
    const b = BASIL_REV[l.skuId];
    if (b && b.val !== VENDOR_PENDING) bits.push(b.val);
    if (l.skuId === "sl-zhi") bits.push("誌");
    if (l.skuId === "sl-fang") bits.push("芳");
    if (l.pack) bits.push(l.pack);
    if (l.size) bits.push(l.size);
    if (l.leafType) bits.push(l.leafType);
    if (l.spec) bits.push(l.spec);
    if (l.note) bits.push(l.note);
  }
  return [...new Set(bits.filter(Boolean))].join("　");
}
function orderShipDay(o) {
  return o.shipDate || today();
}
function orderStatusLabel(o) {
  if (o.status === "shipped") return "已送出";
  if (o.status === "delivered") return "已送達";
  if (o.status === "cancelled") return "已取消";
  if (o.status === "deleted") return "已刪除";
  if (o.settled) {
    if (o.assignedDriver) return o.runOut ? "已結單・送貨中" : "已結單・已派單";
    return "已結單";
  }
  if (o.assignedDriver) return o.runOut ? "接單處理中" : "已派單";
  return "未結單";
}
function isOrderSettled(o) {
  return !!(o && o.settled);
}
function settleBlockers(o) {
  for (const line of o.lines || []) {
    if (!(line.qty > 0) || !line.skuId) continue;
    if (skuNeedsShipLot(line.skuId) && !line.lotUha) {
      return `請先選出貨編號：${ticketLineName(line)}（單號 #${o.no}）`;
    }
  }
  if (!(o.lines || []).some((l) => lineHasItem(l))) return `單號 #${o.no} 沒有品項，不能結單。`;
  return "";
}
function markOrderSettled(o) {
  o.settled = true;
  o.settledBy = currentStaff();
  o.settledAt = Date.now();
}
function settleOrders(list, { confirmMsg } = {}) {
  if (!list.length) return false;
  if (!requireCan("ship-books", "沒有結單權限。")) return false;
  const ready = list.filter((o) => o.status === "open" && !o.settled);
  if (!ready.length) {
    setStatus("這些單已結單或已送出。", true);
    return false;
  }
  for (const o of ready) {
    const block = settleBlockers(o);
    if (block) {
      setStatus(block, true);
      return false;
    }
  }
  const pendVend = ready.some((o) => (o.lines || []).some((l) => lineHasItem(l) && isVendorPendingSku(l.skuId)));
  if (pendVend) {
    if (
      !confirm(
        "尚有地瓜葉／九層塔「待定廠商」。可先結單進入備貨，理貨選廠商時會自動回寫訂單。\n確定仍要結單？",
      )
    )
      return false;
  }
  const msg =
    confirmMsg ||
    (ready.length > 1
      ? `確定收單確認這 ${ready.length} 張？\n結單後進入備貨，不會立刻扣庫，也不會標成已送出。`
      : `確定收單確認「${ready[0].customer}」？\n結單後進入備貨，不會立刻扣庫，也不會標成已送出。`);
  if (!confirm(msg)) return false;
  for (const o of ready) markOrderSettled(o);
  save();
  setStatus(
    ready.length > 1 ? `已結單（收單確認）${ready.length} 張，可開始備貨。` : `已結單「${ready[0].customer}」，可開始備貨。`,
    false,
  );
  render();
  return true;
}
function settleCustomerDay(customer, day = ordersViewDay()) {
  const who = String(customer || "").trim() || "未填對象";
  const orders = state.orders.filter(
    (o) => o.status === "open" && !o.settled && orderShipDay(o) === day && customerKey(o) === who,
  );
  if (!orders.length) return setStatus(`「${who}」已結單或找不到未結單。`, true);
  const cos = [...new Set(orders.map((o) => coLabel(o.co)))].join("／");
  const lineN = orders.reduce((n, o) => n + (o.lines || []).filter((l) => lineHasItem(l)).length, 0);
  const msg =
    orders.length > 1
      ? `確定結單「${who}」？\n共 ${orders.length} 張（${cos}）、${lineN} 品項。\n＝會計收單確認，進入備貨；不會扣庫、不會標已送出。`
      : `確定結單「${who}」？\n＝會計收單確認，進入備貨；不會扣庫、不會標已送出。`;
  settleOrders(orders, { confirmMsg: msg });
}
function isPlanPendingOn(o, day) {
  return o.status === "open" && orderShipDay(o) === day;
}
function isPlanShippedOn(o, day) {
  return (o.status === "shipped" || o.status === "delivered") && orderShipDay(o) === day;
}
function isPlanActiveOn(o, day) {
  return isPlanPendingOn(o, day) || isPlanShippedOn(o, day);
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
  for (const line of o.lines || []) {
    if (!(line.qty > 0) || !line.skuId) continue;
    if (isVendorPendingSku(line.skuId)) {
      return `請先在理貨指定廠商：${ticketLineName(line)}（單號 #${o.no}）`;
    }
    if (skuNeedsShipLot(line.skuId) && !line.lotUha) {
      return `請先選出貨編號：${ticketLineName(line)}（單號 #${o.no}）`;
    }
  }
  const need = shipNeedMap(o);
  for (const [skuId, qty] of Object.entries(need)) {
    const sku = skuById(skuId);
    if (!sku) continue;
    ensureStockRow(sku.id);
    if (shipInboundSku(sku) === "auto") continue;
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
let planShipLock = false;
function refreshPlanDispatch() {
  const swipe = document.getElementById("plan-main-swipe");
  const left = swipe ? swipe.scrollLeft : 0;
  renderDispatchLists(planViewDay());
  applyPlanPane();
  if (swipe) swipe.scrollLeft = left;
}
function shipOpenOrders(list, { action, confirmMsg, skipConfirm, light } = {}) {
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
  const autoNote = [];
  for (const o of ready) {
    for (const lot of autoInboundLots(o)) {
      autoNote.push(`${skuShortName(lot.sku)} ${fmt(lot.qty)} ${lot.sku.unit}`);
    }
  }
  const msg = autoNote.length
    ? `${confirmMsg || "確定出貨？"}\n將同步記入今日進貨：${autoNote.join("、")}`
    : confirmMsg;
  if (!skipConfirm && msg && !confirm(msg)) return false;
  try {
    for (const o of ready) applyOpenShipment(o);
    save();
    setStatus(
      ready.length > 1
        ? `已送出並扣庫 ${ready.length} 張。${autoNote.length ? "已同步進貨。" : ""}`
        : `已送出「${ready[0].customer}」。${autoNote.length ? "已同步進貨。" : ""}`,
      false,
    );
    if (light && page === "plan") refreshPlanDispatch();
    else render();
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
    const ra = customerGroupFillRank(a[1]);
    const rb = customerGroupFillRank(b[1]);
    if (ra !== rb) return ra - rb;
    const fa = customerFreightSortMeta(a[1]);
    const fb = customerFreightSortMeta(b[1]);
    if (fa.ord !== fb.ord) return fa.ord - fb.ord;
    if (fa.recv !== fb.recv) return fa.recv.localeCompare(fb.recv);
    if (fa.ship !== fb.ship) return fa.ship.localeCompare(fb.ship);
    const openA = a[1].filter(isOrderUnshipped);
    const openB = b[1].filter(isOrderUnshipped);
    const pa = openA.length ? Math.min(...openA.map((o) => orderRank(o) || 0)) : Math.min(...a[1].map((o) => orderRank(o) || 0));
    const pb = openB.length ? Math.min(...openB.map((o) => orderRank(o) || 0)) : Math.min(...b[1].map((o) => orderRank(o) || 0));
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
function confirmCustomerShip(customer) {
  if (planShipLock) return;
  const orders = dayOpenOrdersForCustomer(customer);
  if (!orders.length) return setStatus("這張單已出貨或找不到。", true);
  planShipLock = true;
  try {
    shipOpenOrders(orders, { action: "ship-books", skipConfirm: true, light: true });
  } finally {
    planShipLock = false;
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
  planOpenId = `pending:${customer}`;
  planPane = "pending";
  setStatus(`「${customer}」已接單。送到後按「確認出貨」。`, false);
  render();
  requestAnimationFrame(() => {
    document.querySelector(`[data-drive-open="pending:${CSS.escape(customer)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}
function nextDriveCustomer(afterWho) {
  const day = planViewDay();
  const me = currentStaff();
  const pending = groupOrdersByCustomer(
    state.orders.filter((o) => o.status === "open" && orderShipDay(o) === day),
  ).filter(([who]) => who !== afterWho);
  const mineReady = pending.find(([, orders]) =>
    orders.every((o) => o.assignedDriver === me && o.runOut),
  );
  if (mineReady) return mineReady[0];
  const mineTake = pending.find(([, orders]) =>
    orders.every((o) => !o.assignedDriver || o.assignedDriver === me),
  );
  if (mineTake) return mineTake[0];
  return "";
}
function advanceDriveAfterDone(doneWho) {
  const next = nextDriveCustomer(doneWho);
  planPane = "pending";
  if (!next) {
    planOpenId = "";
    setStatus(`「${doneWho}」已送出。待處理已清完。`, false);
    return;
  }
  planOpenId = `pending:${next}`;
  const orders = dayOpenOrdersForCustomer(next);
  const me = currentStaff();
  const taken = orders.length && orders.every((o) => o.assignedDriver === me && o.runOut);
  setStatus(
    taken
      ? `「${doneWho}」已送出。下一筆「${next}」可直接簽收。`
      : `「${doneWho}」已送出。下一筆「${next}」請接單。`,
    false,
  );
  requestAnimationFrame(() => {
    document.querySelector(`[data-drive-open="pending:${CSS.escape(next)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const btn = taken
      ? document.querySelector(`[data-drive-proof="${CSS.escape(next)}"]`)
      : document.querySelector(`[data-drive-take="${CSS.escape(next)}"]`);
    btn?.focus?.();
  });
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
  if (o.edited) bits.push("修改單");
  if (o.preorder) bits.push("預開");
  if (o.assignedDriver && o.status === "open") bits.push(o.runOut ? "送貨中" : "已派單");
  else if (o.assignedDriver) bits.push(`司機 ${o.assignedDriver}`);
  const addr = String(o.shipAddr || "").trim();
  return `<div class="drive-order"><p class="drive-co">${esc(bits.join(" · "))}</p>${addr ? `<p class="drive-addr">${esc(addr)}</p>` : ""}${driverLineList(o)}${proofHtml(o)}</div>`;
}
function driverLineList(o) {
  const lines = (o.lines || []).filter((l) => lineHasItem(l));
  if (!lines.length) return '<p class="empty">沒有品項</p>';
  return `<ul class="drive-lines">${lines
    .map((l) => {
      const sku = skuById(l.skuId);
      const unit = Number(l.qty) > 0 ? sku?.unit || "" : "";
      const note = l.note ? `<em>${esc(l.note)}</em>` : "";
      return `<li><span>${esc(ticketLineName(l))}${note}</span><strong>${esc(lineQtyText(l))}${unit ? ` ${esc(unit)}` : ""}</strong></li>`;
    })
    .join("")}</ul>`;
}
function assignRowHtml(customer, orders, kind) {
  if (kind !== "pending") return "";
  const canAssign = can("assign-driver");
  const canShip = can("ship-books");
  if (!canAssign && !canShip) return "";
  const now = [...new Set(orders.map((o) => o.assignedDriver).filter(Boolean))];
  const shipBtn = canShip
    ? `<button type="button" class="tiny-btn primary" data-confirm-ship="${esc(customer)}">確認出貨</button>`
    : "";
  const drivers = canAssign
    ? `<span>派工</span>${driverNames()
        .map(
          (name) =>
            `<button type="button" class="tiny-btn${now.includes(name) ? " on" : ""}" data-assign-driver="${esc(name)}" data-assign-who="${esc(customer)}">${esc(name)}</button>`,
        )
        .join("")}`
    : "";
  return `<div class="assign-row">${shipBtn}${drivers}</div>`;
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
function groupDrivers(orders) {
  return [...new Set(orders.map((o) => o.assignedDriver || o.deliveredBy || "").filter(Boolean))];
}
function planJobHtml(customer, orders, kind) {
  const key = `${kind}:${customer}`;
  const open = planOpenId === key;
  const nos = orders.map((o) => `#${o.no}`).join("　");
  const addr = groupShipAddr(orders);
  const drivers = groupDrivers(orders);
  const driverLabel = drivers.length ? drivers.join("、") : "";
  const flow = kind === "pending" ? customerPlanFlowStatus(planViewDay(), orders) : null;
  const tag = flow && flow.code !== "sent" ? flow.label : "";
  const urgent = kind === "pending" && orders.some((o) => isOrderUrgent(o) && isOrderUnshipped(o));
  const freight = kind === "pending" ? customerFreightSortMeta(orders) : null;
  const freightTag =
    freight?.key
      ? `<span class="drive-tag is-freight">${esc(freight.key)}${freight.recv && freight.recv !== "89:99" && freight.recv !== "99:99" ? ` · 收${esc(freight.recv)}` : ""}${freight.ship && freight.ship !== "89:99" && freight.ship !== "99:99" ? ` · 出${esc(freight.ship)}` : ""}</span>`
      : "";
  const head =
    kind === "pending"
      ? `${urgent ? '<span class="tag tag-urgent">急單</span>' : ""}${esc(customer)}${freightTag}${tag ? `<span class="drive-tag is-${esc(flow.code)}">${esc(tag)}</span>` : ""}${driverLabel ? `<span class="drive-tag is-driver">司機 ${esc(driverLabel)}</span>` : ""}${addr ? `<span class="drive-addr">${esc(addr)}</span>` : ""}`
      : `${esc(customer)}${driverLabel ? `<span class="drive-tag is-driver">司機 ${esc(driverLabel)}</span>` : `<span class="drive-tag is-muted">未指定司機</span>`}<span class="drive-nos">${esc(nos)}</span>${addr ? `<span class="drive-addr">${esc(addr)}</span>` : ""}`;
  const body = `${orders.map(orderBlockHtml).join("")}${
    kind === "pending" && can("ship-books")
      ? `<div class="drive-ship"><button type="button" class="primary" data-confirm-ship="${esc(customer)}">確認出貨</button></div>`
      : ""
  }`;
  const side =
    kind === "done"
      ? driverLabel
        ? `<div class="assign-row drive-side"><span class="drive-driver">${esc(driverLabel)}</span></div>`
        : ""
      : assignRowHtml(customer, orders, kind) || driverSideHtml(customer, orders, kind);
  return `<li class="drive-job ${kind === "done" ? "is-done" : ""}${urgent ? " is-urgent" : ""} ${open ? "is-open" : ""}">
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
  const shortHint = document.querySelector(".plan-short-hint");
  const breakBox = document.getElementById("plan-break");
  const mainTabs = document.getElementById("plan-main-tabs");
  if (card) card.classList.toggle("is-driver", driver);
  if (shortTitle) shortTitle.hidden = driver;
  if (shortHint) shortHint.hidden = driver;
  if (shortBox) shortBox.hidden = driver;
  if (breakBox) breakBox.hidden = driver;
  if (mainTabs) mainTabs.hidden = true;
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
  pendingBox.innerHTML = `<div class="drive-plan">${sec("待送貨", pending, "目前沒有待送貨訂單。", "pending")}</div>`;
  doneBox.innerHTML = `<div class="drive-plan">${sec("已送貨完成", done, "目前沒有已送貨完成訂單。", "done")}</div>`;
  const pendTab = document.querySelector('#plan-pane-tabs [data-plan-pane="pending"]');
  const doneTab = document.querySelector('#plan-pane-tabs [data-plan-pane="done"]');
  if (pendTab) pendTab.textContent = `待送貨 ${pending.length}`;
  if (doneTab) doneTab.textContent = `已送貨完成 ${done.length}`;
}
function renderDriverPlan() {
  const pendingBox = document.getElementById("plan-pending");
  if (!pendingBox) return;
  const breakBox = document.getElementById("plan-break");
  if (breakBox) breakBox.innerHTML = "";
  const allBox = document.getElementById("plan-all");
  if (allBox) allBox.innerHTML = "";
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
    orders.some((o) => lineQtyForSkus(o, g.skuIds) > 0 && isPlanActiveOn(o, day)),
  );
  const wrap = document.getElementById("plan-card") || shortBox?.parentElement;
  if (wrap) wrap.style.setProperty("--plan-n", String(Math.max(used.length, 1)));
  const breakBox = document.getElementById("plan-break");
  if (shortBox) {
    if (used.length && (!planFocusKey || !used.some((g) => g.key === planFocusKey))) {
      planFocusKey = used[0].key;
    }
    if (!used.length) planFocusKey = "";
    const focusG = used.find((g) => g.key === planFocusKey) || null;
    const cropHtml = planCropListHtml(day, focusG);
    const statusHtml = planOrderStatusHtml(day);
    const ordersHead = planZoneHeadHtml({
      id: "orders",
      labId: "plan-zone-orders-lab",
      lab: "當日訂單",
      toneClass: "is-orders",
      subHtml: used.length
        ? "點品項卡看該菜客戶（備貨中在上、已送貨在下）。地瓜葉／九層塔先選廠商；已選可按「修改」，會自動回寫訂單。"
        : "依品項看客戶清單；地瓜葉／九層塔可選廠商或按「修改」。",
    });
    let ordersBody;
    if (!used.length) {
      const dayOrders = orders.filter((o) => isPlanActiveOn(o, day));
      ordersBody = dayOrders.length
        ? `<p class="hint">今日訂單不在現採／加工備貨看板品項內，下方仍可看全部訂單。</p>`
        : `<p class="empty">還沒有現場排程。請先到「已填單」確認訂單。</p>`;
    } else {
      ordersBody = `<div class="plan-board short-board">${used
        .map((g) => {
          const need = planDayPendingQty(g, day);
          const shipped = planDayShippedQty(g, day);
          const demand = planDayDemandQty(g, day);
          const stock = groupOnHand(g, day);
          const left = round(stock - need);
          const over = left < 0;
          const view = planCardView(g);
          const doneAll = demand > 0 && need <= 0;
          const on = g.key === planFocusKey;
          return `<button type="button" class="short-card tone-${esc(view.tone)} ${doneAll ? "is-done" : over ? "no" : "ok"}${on ? " is-on" : ""}" data-plan-focus="${esc(g.key)}" aria-pressed="${on ? "true" : "false"}">
            <header class="short-head">
              <h3>${esc(view.crop)}</h3>
              ${view.mark && view.mark !== "現採" && view.mark !== "加工" ? `<p class="short-mark">${esc(view.mark)}</p>` : ""}
            </header>
            <p class="short-line"><b>${fmt(demand)}</b><span>待出 ${fmt(need)}</span><span>已出 ${fmt(shipped)}</span></p>
            <p class="short-line is-sub"><span>庫存 ${fmt(stock)}</span><span class="is-left">剩 ${fmt(left)}</span></p>
          </button>`;
        })
        .join("")}</div>${cropHtml}`;
    }
    shortBox.innerHTML = `<section class="plan-zone plan-zone-orders${planZoneWrapClass("orders")}" aria-labelledby="plan-zone-orders-lab">
      ${ordersHead}
      <div class="plan-zone-body" id="plan-zone-body-orders"${planZoneBodyAttrs("orders")}>${ordersBody}</div>
    </section>`;
    if (breakBox) breakBox.innerHTML = planMain === "ship" ? "" : planBreakHtml(day);
    const allBox = document.getElementById("plan-all");
    if (allBox) allBox.innerHTML = planMain === "ship" ? "" : statusHtml;
  }
  renderDispatchLists(day);
  applyPlanPane();
  applyPlanMain(false);
}

function nqMorningQty(b) {
  return countQtyOf(b);
}
function stockOverviewHtml(date = stockViewDay()) {
  const wh = stockWh ? stockWarehouseLabel(stockWh) : "";
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
    const title = wh ? `${g.label} · ${wh}` : g.label;
    return `<section class="stock-ov-group"><h3>${esc(title)}</h3><div class="stock-ov-grid">${items}</div></section>`;
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
  if (!quiet) save();
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
  if (sku.id === "rb-fang" || sku.id === "gb-fang") return "auto";
  return "";
}
function haStockOverviewHtml() {
  const wh = stockWh ? stockWarehouseLabel(stockWh) : "";
  const head = wh ? `鴻安加工庫 · ${wh}` : "鴻安加工庫";
  return `<section class="stock-ov-group"><h3>${esc(head)}</h3><div class="stock-ov-grid">${SKUS.filter((s) => s.co === "ha" && isSiteSku(s))
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
  // 庫存盤點走倉庫 UI；進貨／舊帳仍用下方邏輯（不再靠上方公司分頁切換）
  if (booksPart === "stock" && typeof window.renderWareStock === "function") {
    return window.renderWareStock();
  }
  const date = stockViewDay();
  ensureBooks(date);
  const stockDateEl = document.getElementById("stock-date");
  if (stockDateEl && stockDateEl.value !== date) stockDateEl.value = date;
  const inDateEl = document.getElementById("in-date");
  if (inDateEl && inDateEl.value !== date) inDateEl.value = date;
  const salesDateEl = document.getElementById("sales-date");
  if (salesDateEl && salesDateEl.value !== date) salesDateEl.value = date;
  const lookingBack = date !== today();
  // 進貨頁不再切公司；一律用穠全進貨表單（鴻安 Excel 匯入仍保留區塊、預設隱藏）
  if (co === "ha" && booksPart !== "in") {
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
    document.getElementById("stock-title").textContent = lookingBack
      ? `${stockWh ? stockWarehouseLabel(stockWh) + "・" : ""}鴻安庫存盤點（${date}）`
      : `${stockWh ? stockWarehouseLabel(stockWh) + "・" : ""}鴻安庫存盤點／加工`;
    const inTitle = document.getElementById("in-title");
    if (inTitle) inTitle.textContent = lookingBack ? `鴻安進貨（${date}）` : "鴻安進貨（待修正）";
    const gs = document.getElementById("guide-stock");
    const gi = document.getElementById("guide-in");
    if (gs) {
      gs.textContent = stockWh
        ? `倉庫：${stockWarehouseLabel(stockWh)}。大數字＝已加工可出。各倉盤點之後再細分。`
        : "庫存盤點：大數字＝已加工可出。請從首頁選倉庫別進入。";
    }
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
  document.getElementById("stock-title").textContent = lookingBack
    ? `${stockWh ? stockWarehouseLabel(stockWh) + "・" : ""}庫存盤點（${date}）`
    : `${stockWh ? stockWarehouseLabel(stockWh) + "・" : ""}庫存盤點`;
  const inTitle = document.getElementById("in-title");
  if (inTitle) inTitle.textContent = lookingBack ? `進貨（${date}）` : "進貨（待修正）";
  refreshStockOverview();
  const countCard = document.getElementById("count-card");
  if (countCard) countCard.hidden = false;
  const gs = document.getElementById("guide-stock");
  const gi = document.getElementById("guide-in");
  const gc = document.getElementById("guide-count");
  if (gs) {
    gs.textContent = stockWh
      ? `倉庫：${stockWarehouseLabel(stockWh)}。上方數字＝盤點＋進貨－已出（各倉分開記帳之後再細分）。`
      : "庫存盤點：上方數字＝盤點＋進貨－已出。請從首頁選倉庫別進入。";
  }
  if (gi) {
    gi.hidden = false;
    gi.textContent = lookingBack
      ? `查 ${date}。進貨流程待修正，暫用現有記入。`
      : "進貨流程待修正。暫用：＋／－調本批後記入；打錯到總覽改總數。";
  }
  if (gc) gc.textContent = lookingBack
    ? `查 ${date} 的盤點數量與結算${stockWh ? `（${stockWarehouseLabel(stockWh)}）` : ""}。`
    : `填早上可備數量後按確認${stockWh ? `（${stockWarehouseLabel(stockWh)}）` : ""}。還沒填以 0 計。確認後不會自動加進貨。`;
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
        const opts = [VENDOR_PENDING, ...VENDOR_OPTS].map(
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
function draftIsCabSku(id) {
  return isCabSku(id);
}
function draftIsNapSku(id) {
  return isNapSku(id);
}
function draftLineExtrasHtml(l) {
  const sku = skuById(l.skuId);
  const bits = [];
  if (draftIsOnionSku(l.skuId)) {
    bits.push(`<select data-draft-size aria-label="尺寸">${optsHtml(HA_ONION_SIZES, haOnionSizeOf(l))}</select>`);
  }
  if (draftIsCabSku(l.skuId)) {
    bits.push(`<select data-draft-leaf aria-label="規格">${optsHtml(CAB_LEAF_TYPES, cabLeafTypeOf(l.leafType))}</select>`);
    bits.push(`<select data-draft-spec aria-label="品種">${optsHtml(CAB_SPECS, cabSpecOf(l.spec))}</select>`);
  } else if (draftIsNapSku(l.skuId)) {
    bits.push(`<select data-draft-spec aria-label="規格">${optsHtml(NAP_SPECS, napSpecOf(l.spec))}</select>`);
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
function linePendingCount() {
  const seen = new Set();
  let n = 0;
  for (const d of [...(typeof linePasteQueue !== "undefined" ? linePasteQueue : []), ...(typeof lineDraftsCache !== "undefined" ? lineDraftsCache : [])]) {
    const id = d?.id || "";
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    n += 1;
  }
  return n;
}
function syncLinePendingHint() {
  const n = linePendingCount();
  const badge = n ? `<span class="tab-badge">待核可 ${n}</span>` : "";
  const tab = document.querySelector('#orders-pane-tabs [data-orders-pane="line"]');
  if (tab) {
    tab.innerHTML = `LINE判讀${badge}`;
    tab.classList.toggle("has-pending", n > 0);
  }
  const opsLine = document.querySelector('#flow-tabs [data-ops="line"]');
  if (opsLine) {
    opsLine.innerHTML = opsFlowTabHtml("chat", "LINE", badge);
    opsLine.classList.toggle("has-pending", n > 0);
  }
  document.querySelectorAll('#home-hub [data-go="orders"][data-orders-pane="line"]').forEach((el) => {
    const lab = el.querySelector(".home-step-lab, .hub-lab");
    if (lab) {
      const base = lab.classList.contains("home-step-lab") ? "LINE" : "LINE判讀";
      lab.innerHTML = `${base}${badge}`;
    }
    el.classList.toggle("has-pending", n > 0);
  });
}
function renderLineDrafts(force) {
  const box = document.getElementById("line-drafts");
  if (!box) {
    syncLinePendingHint();
    return;
  }
  const focused = document.activeElement;
  if (
    !force &&
    focused &&
    box.contains(focused) &&
    focused.matches("input, select, textarea")
  ) {
    syncLinePendingHint();
    return;
  }
  const list = [...linePasteQueue, ...lineDraftsCache];
  if (!list.length) {
    box.innerHTML = '<p class="empty">可連續貼上多位客人再解析，待確認會一起列在這裡，不必立刻確認。</p>';
    syncLinePendingHint();
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
  syncLinePendingHint();
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
  if (formTitle) formTitle.textContent = editing ? "修改已填單" : "下單";
  if (formHint) {
    formHint.hidden = true;
    formHint.textContent = "";
  }
  const submit = document.getElementById("order-submit");
  if (submit) {
    submit.textContent = editing ? "確認改單" : isPreorderDay() ? "確認預訂單" : "確認送出";
  }
  if (cust) {
    cust.placeholder = "輸入姓名";
    cust.readOnly = false;
  }
  // 雙欄桌面：#sheet／#ticket 不再是 form 直屬兄弟，不可 insertBefore 重排
}

function render() {
  const staySales =
    page === "home" &&
    hubDept === "sales" &&
    !!hubSalesPane &&
    !!salesMount &&
    salesMount.el === pageElForSalesPane(hubSalesPane);
  if (!staySales) restoreSalesMount();
  try {
    if (ensureTodayBooks()) {
      syncAllNqQty();
      save();
    }
  } catch (err) {
    console.error(err);
  }
  applyRoleUi();
  document.body.classList.toggle("on-home", page === "home");
  document.body.classList.toggle("sales-workspace", page === "home" && hubDept === "sales");
  document.getElementById("co-name").textContent =
    page === "home"
      ? "鴻安"
      : page === "unpack"
        ? "拆櫃回報"
      : page === "import"
        ? "進口業務"
      : page === "sitework"
        ? "現場工作"
      : page === "stats"
        ? "營運統計"
      : currentRole() === "driver"
        ? "司機送貨"
        : page === "plan"
          ? "現場排程"
          : page === "orders"
            ? "下單／已填"
        : page === "books" && booksPart === "rack"
          ? "資財管理"
        : page === "books" && booksPart === "stock"
          ? (stockWh ? `庫存盤點 · ${stockWarehouseLabel(stockWh)}` : "庫存盤點")
        : page === "books" && booksPart === "in"
          ? "進貨"
        : page === "books" && booksPart === "sales"
          ? "出貨帳單"
        : page === "books" && booksPart === "ledger"
          ? "進銷存清單"
        : page === "books"
          ? "倉管／帳款"
          : page === "help"
            ? "小幫手"
          : page === "labels"
            ? "標籤貼紙"
          : page === "label-prints"
            ? "標籤列印明細"
          : page === "soon"
            ? "帳款業務"
            : "產品出貨";
  const onBooks = page === "books";
  const onRack = onBooks && booksPart === "rack";
  document.body.classList.toggle("on-rack", onRack);
  const coTabs = document.getElementById("co-tabs");
  const booksTabs = document.getElementById("books-part-tabs");
  if (coTabs) coTabs.hidden = true;
  if (booksTabs) booksTabs.hidden = true;
  document.querySelectorAll("#books-part-tabs [data-books]").forEach((b) => b.classList.toggle("on", b.dataset.books === booksPart));
  syncOpsFlowTabs();
  const pageHome = document.getElementById("page-home");
  if (pageHome) pageHome.hidden = page !== "home";
  const pageHelp = document.getElementById("page-help");
  if (pageHelp) pageHelp.hidden = page !== "help";
  const pageSoon = document.getElementById("page-soon");
  if (pageSoon) pageSoon.hidden = page !== "soon";
  const pageLabels = document.getElementById("page-labels");
  if (pageLabels) pageLabels.hidden = page !== "labels";
  const pageLabelPrints = document.getElementById("page-label-prints");
  if (pageLabelPrints) pageLabelPrints.hidden = page !== "label-prints";
  const pageUnpack = document.getElementById("page-unpack");
  if (pageUnpack) pageUnpack.hidden = page !== "unpack";
  const pageImport = document.getElementById("page-import");
  if (pageImport) pageImport.hidden = page !== "import";
  const pageSitework = document.getElementById("page-sitework");
  if (pageSitework) pageSitework.hidden = page !== "sitework";
  const pageStats = document.getElementById("page-stats");
  if (pageStats) pageStats.hidden = page !== "stats";
  document.getElementById("page-orders").hidden = page !== "orders";
  document.getElementById("page-plan").hidden = page !== "plan";
  document.getElementById("page-stock").hidden = !(onBooks && booksPart === "stock");
  const pageIn = document.getElementById("page-in");
  if (pageIn) pageIn.hidden = !(onBooks && booksPart === "in");
  const pageSales = document.getElementById("page-sales");
  if (pageSales) pageSales.hidden = !(onBooks && booksPart === "sales");
  const pageLedger = document.getElementById("page-ledger");
  if (pageLedger) pageLedger.hidden = !(onBooks && booksPart === "ledger");
  const pageRack = document.getElementById("page-rack");
  if (pageRack) pageRack.hidden = !onRack;
  const kindTabs = document.getElementById("stock-kind-tabs");
  if (kindTabs) kindTabs.hidden = true;
  applyCopy();
  const run = (fn) => {
    try {
      fn();
    } catch (err) {
      console.error(err);
    }
  };
  run(renderStaffChips);
  run(renderAlerts);
  run(syncLinePendingHint);
  if (page === "home") run(renderHomeHub);
  if (page === "help") run(renderHelpFreight);
  if (page === "labels") run(renderLabels);
  if (page === "label-prints") run(renderLabelPrints);
  if (page === "unpack" && typeof renderUnpackPage === "function") run(renderUnpackPage);
  if (page === "import" && typeof renderImportPage === "function") run(renderImportPage);
  if (page === "sitework" && typeof renderSiteWork === "function") run(renderSiteWork);
  if (page === "stats" && typeof renderBossStats === "function") run(renderBossStats);
  if (page === "orders") {
    run(syncShipMore);
    run(syncShipAddrUi);
    document.getElementById("order-form").hidden = false;
    const restBtn = document.getElementById("nq-rest-btn");
    if (restBtn) restBtn.hidden = false;
    const nqCancel = document.getElementById("nq-cancel-edit");
    if (nqCancel) nqCancel.hidden = true;
  run(renderLineDrafts);
  run(renderCustSuggest);
  run(renderDailyGrid);
  run(renderSheet);
  run(renderCheck);
  run(renderOrders);
  run(renderRestList);
  run(() => applyOrdersPane(false));
    run(syncOrderEntering);
  } else {
    const orderForm = document.getElementById("order-form");
    if (orderForm) orderForm.hidden = true;
    const restBtn = document.getElementById("nq-rest-btn");
    if (restBtn) restBtn.hidden = true;
  }
  if (page === "plan") {
    run(renderPlan);
  run(() => applyPlanPane());
  run(() => applyPlanMain(false));
  }
  if (onBooks && booksPart === "stock") run(renderStock);
  if (onBooks && booksPart === "in") {
    run(renderStock);
    run(() => applyInPane(false));
  }
  if (onBooks && booksPart === "sales") run(renderSalesBooks);
  if (onBooks && booksPart === "ledger" && typeof window.renderBooksLedger === "function") {
    run(window.renderBooksLedger);
  }
  if (onRack) run(renderRack);
  if (page === "home" && hubDept === "sales" && hubSalesPane) {
    const mounted = pageElForSalesPane(hubSalesPane);
    if (mounted) mounted.hidden = false;
    if (staySales) {
      run(() => runSalesPaneRenderers(hubSalesPane));
      syncOpsFlowTabs();
    } else {
      run(embedSalesPaneContent);
    }
  }
}

document.getElementById("home-btn")?.addEventListener("click", goHome);
document.getElementById("sync-reload")?.addEventListener("click", () => {
  reloadFromCloud();
});
document.getElementById("sync-upload")?.addEventListener("click", () => {
  uploadThisDevice();
});
document.querySelector(".layout-mode")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-layout]");
  if (!btn) return;
  applyLayoutMode(btn.dataset.layout);
});
document.getElementById("home-hub")?.addEventListener("click", (e) => {
  if (e.target.closest("[data-hub-back]")) {
    if (e.target.closest(".shelf-home-back") || e.target.closest("[data-sales-home]") || (!hubOpen && hubDept)) {
      restoreSalesMount();
      hubOpen = "";
      hubDept = "";
      hubSalesBlock = "orders";
      hubSalesPane = "";
      document.body.classList.remove("sales-workspace");
    } else if (hubOpen) {
      hubOpen = "";
    } else {
      restoreSalesMount();
      hubDept = "";
      hubSalesBlock = "orders";
      hubSalesPane = "";
      document.body.classList.remove("sales-workspace");
    }
    renderHomeHub();
    return;
  }
  const salesBlockBtn = e.target.closest("[data-sales-block]");
  if (salesBlockBtn) {
    const nextBlock = salesBlockBtn.dataset.salesBlock || "orders";
    hubSalesBlock = nextBlock;
    hubDept = "sales";
    hubOpen = "";
    page = "home";
    const blocks = buildSalesBlocks();
    const cur = blocks.find((b) => b.id === nextBlock) || blocks[0];
    const first = cur?.tabs?.[0]?.id || "";
    if (first) {
      activateSalesPane(first);
    } else {
      hubSalesPane = "";
      restoreSalesMount();
      syncSalesShellChrome();
      fillSalesLanding();
    }
    return;
  }
  const salesPaneBtn = e.target.closest("[data-sales-pane]");
  if (salesPaneBtn) {
    activateSalesPane(salesPaneBtn.dataset.salesPane || "");
    return;
  }
  const deptBtn = e.target.closest("[data-hub-dept]");
  if (deptBtn) {
    const next = deptBtn.dataset.hubDept || "";
    hubOpen = "";
    // 進口：直接進頁面，上方橫排切換，不要再攤一層層架
    if (next === "import") {
      if (!can("page-import")) return setStatus("進口目前僅開放給雅芳。", true);
      if (typeof window.openImport === "function") {
        window.openImport("parse");
        return;
      }
    }
    if (next === "export" && !can("page-export")) {
      return setStatus("出口目前僅開放給雅芳。", true);
    }
    restoreSalesMount();
    hubDept = next;
    hubSalesPane = "";
    if (next === "sales") hubSalesBlock = "orders";
    renderHomeHub();
    return;
  }
  const tile = e.target.closest("[data-hub]");
  if (tile) {
    const hubId = tile.dataset.hub || "";
    if (hubId === "unpack") {
      // TEMP: 拆櫃未完成，暫僅雅芳
      if (!can("page-unpack")) return setStatus("拆櫃回報建置中，暫僅主管可進入。", true);
      page = "unpack";
      hubOpen = "";
      render();
      return;
    }
    if (hubId === "sitework") {
      // TEMP: 現場未完成，暫僅雅芳
      if (!can("page-sitework")) return setStatus("現場工作建置中，暫僅主管可進入。", true);
      page = "sitework";
      hubOpen = "";
      render();
      return;
    }
    if (hubId === "stats") {
      if (!can("page-stats")) return setStatus("僅主管可看統計。", true);
      page = "stats";
      hubOpen = "";
      render();
      return;
    }
    if (hubId === "labels") {
      hubDept = "";
      hubOpen = "labels";
      renderHomeHub();
      return;
    }
    hubDept = hubDept || "sales";
    hubOpen = hubId;
    renderHomeHub();
    return;
  }
  const btn = e.target.closest("[data-go]");
  if (!btn) return;
  goFromHub(btn);
});
document.getElementById("label-date")?.addEventListener("change", () => {
  labelDayLock = "";
  renderLabels();
});
document.getElementById("label-md-m")?.addEventListener("input", renderLabels);
document.getElementById("label-md-d")?.addEventListener("input", renderLabels);
document.getElementById("label-copies")?.addEventListener("input", renderLabels);
document.getElementById("label-solar-on")?.addEventListener("change", (e) => {
  labelSolarOn = Boolean(e.target.checked);
  renderLabels();
});
document.getElementById("label-seq-on")?.addEventListener("change", (e) => {
  labelSeqOn = Boolean(e.target.checked);
  renderLabels();
});
bindLabelImeInput(document.getElementById("label-text-custom"), (v) => {
  labelText = v;
});
bindLabelImeInput(document.getElementById("label-text-remark"), (v) => {
  labelTextRemark = v;
});
bindLabelImeInput(document.getElementById("label-ship-cust"), (v) => {
  labelShipCust = v;
});
bindLabelImeInput(document.getElementById("label-ship-sku"), (v) => {
  labelShipSku = v;
});
document.getElementById("label-pane-ship")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-label-ship-sku]");
  if (!btn) return;
  labelShipSku = btn.dataset.labelShipSku || "";
  renderLabels();
});
document.getElementById("label-order-yes")?.addEventListener("click", confirmLabelOrder);
document.getElementById("label-order-no")?.addEventListener("click", () => {
  closeLabelOrderGate();
  setStatus("已印標籤，未記入訂單。");
});
bindLabelImeInput(document.getElementById("label-cont-name"), (v) => {
  labelContName = v;
});
bindLabelImeInput(document.getElementById("label-cont-country"), (v) => {
  labelContCountry = v;
});
bindLabelImeInput(document.getElementById("label-cont-vendor"), (v) => {
  labelContVendor = v;
});
bindLabelImeInput(document.getElementById("label-cont-no"), (v) => {
  labelContNo = v;
});
document.getElementById("label-kind-tabs")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-label-kind]");
  if (!btn) return;
  labelKind = btn.dataset.labelKind === "container" ? "container" : btn.dataset.labelKind === "ship" ? "ship" : "text";
  renderLabels();
});
document.getElementById("label-pane-text")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-label-text]");
  if (!btn) return;
  labelText = btn.dataset.labelText || "";
  renderLabels();
});
document.getElementById("label-pane-container")?.addEventListener("click", (e) => {
  const nameBtn = e.target.closest("[data-label-cont-name]");
  if (nameBtn) {
    labelContName = nameBtn.dataset.labelContName || "";
    renderLabels();
    return;
  }
  const countryBtn = e.target.closest("[data-label-cont-country]");
  if (countryBtn) {
    labelContCountry = countryBtn.dataset.labelContCountry || "";
    renderLabels();
    return;
  }
  const noBtn = e.target.closest("[data-label-cont-no]");
  if (noBtn) {
    labelContNo = noBtn.dataset.labelContNo || "";
    renderLabels();
  }
});
document.getElementById("label-all")?.addEventListener("click", () => {
  labelSel = new Set(labelRowsForDay(labelDateValue()).map((r) => r.key));
  renderLabels();
});
document.getElementById("label-none")?.addEventListener("click", () => {
  labelSel = new Set();
  renderLabels();
});
document.getElementById("label-reset-seq")?.addEventListener("click", () => {
  saveLabelRun({ day: labelDateValue(), n: 0 });
  renderLabels();
  setStatus("本趟流水已歸零。");
});
document.getElementById("label-print")?.addEventListener("click", printSelectedLabels);
document.getElementById("label-prints-date")?.addEventListener("change", renderLabelPrints);
document.getElementById("label-prints-kind-tabs")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-label-prints-kind]");
  if (!btn) return;
  labelPrintFilterKind = btn.dataset.labelPrintsKind || "all";
  renderLabelPrints();
});
document.getElementById("label-list")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-label-key]");
  if (!btn) return;
  const key = btn.dataset.labelKey;
  if (labelSel.has(key)) labelSel.delete(key);
  else labelSel.add(key);
  renderLabels();
});
document.getElementById("help-sales-file")?.addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  const el = document.getElementById("help-sales-name");
  if (el) el.textContent = f ? f.name : "尚未選擇";
  if (f && document.getElementById("help-freight-file")?.files?.[0]) runHelpFreight();
});
document.getElementById("help-freight-file")?.addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  const el = document.getElementById("help-freight-name");
  if (el) el.textContent = f ? f.name : "尚未選擇";
  if (f && document.getElementById("help-sales-file")?.files?.[0]) runHelpFreight();
});
document.getElementById("help-freight-run")?.addEventListener("click", () => runHelpFreight());
document.getElementById("help-freight-xls")?.addEventListener("click", () => downloadHelpXls());
document.getElementById("help-freight-png")?.addEventListener("click", () => downloadHelpPng());
document.getElementById("help-freight-tools")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-help-filter]");
  if (!btn) return;
  helpFilter = btn.dataset.helpFilter === "all" ? "all" : "issues";
  renderHelpFreight();
});
document.querySelectorAll("#flow-tabs [data-ops]").forEach((btn) => {
  btn.onclick = () => {
    const ops = btn.dataset.ops || "";
    if (hubDept === "sales") {
      activateSalesPane(ops === "short" || ops === "ship" ? ops : normalizeOrdersPane(ops));
      return;
    }
    goOpsStep(ops);
  };
});
document.querySelectorAll("[data-orders-pane]").forEach((btn) => {
  btn.onclick = () => {
    goOpsStep(normalizeOrdersPane(btn.dataset.ordersPane));
  };
});
/** Keep vertical page scroll from fighting horizontal pane swipe containers. */
function bindSwipeScrollAxis(el) {
  if (!el || el.dataset.axisBound) return;
  el.dataset.axisBound = "1";
  let sx = 0;
  let sy = 0;
  let axis = "";
  let lockLeft = 0;
  const clear = () => {
    axis = "";
    el.classList.remove("is-pan-x", "is-pan-y");
  };
  el.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      axis = "";
      lockLeft = el.scrollLeft;
      el.classList.remove("is-pan-x", "is-pan-y");
    },
    { passive: true },
  );
  el.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length !== 1) return;
      const dx = Math.abs(e.touches[0].clientX - sx);
      const dy = Math.abs(e.touches[0].clientY - sy);
      if (!axis) {
        if (dx < 10 && dy < 10) return;
        axis = dy > dx ? "y" : "x";
        el.classList.add(axis === "y" ? "is-pan-y" : "is-pan-x");
      }
      if (axis === "y" && el.scrollLeft !== lockLeft) el.scrollLeft = lockLeft;
    },
    { passive: true },
  );
  el.addEventListener("touchend", clear, { passive: true });
  el.addEventListener("touchcancel", clear, { passive: true });
}
const ordersSwipe = document.getElementById("orders-swipe");
if (ordersSwipe) {
  bindSwipeScrollAxis(ordersSwipe);
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
        const next = normalizeOrdersPane(cur.dataset.ordersPanePage);
        if (next === ordersPane) return;
        if (document.body.classList.contains("order-entering") && next === "today") {
          applyOrdersPane(false);
          return;
        }
        ordersPane = next;
        document.querySelectorAll("#orders-pane-tabs [data-orders-pane]").forEach((b) => {
          b.classList.toggle("on", b.dataset.ordersPane === ordersPane);
        });
        syncOpsFlowTabs();
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
    rackSrc = "";
    renderRack();
  };
});
document.querySelectorAll("[data-rack-mode]").forEach((btn) => {
  btn.onclick = () => {
    const mode = btn.dataset.rackMode || "asof";
    rackMode = mode === "custom" || mode === "y114" || mode === "y115" ? mode : "asof";
    if (rackRocYear()) applyRackYearDates();
    else if (rackMode === "asof") rackTo = today();
    else if (rackMode === "custom" && !rackFrom) {
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
    rackSrc = "";
    renderRack();
  };
});
document.getElementById("rack-from")?.addEventListener("change", () => {
  rackFrom = document.getElementById("rack-from").value || "";
  if (rackFrom && rackTo && rackFrom > rackTo) rackTo = rackFrom;
  rackPick = "";
  rackLine = "";
  rackSrc = "";
  renderRack();
});
document.getElementById("rack-prior")?.addEventListener("change", () => {
  rackPrior = !!document.getElementById("rack-prior").checked;
  renderRack();
});
document.getElementById("rack-to")?.addEventListener("change", () => {
  rackTo = document.getElementById("rack-to").value || today();
  rackPick = "";
  rackLine = "";
  rackSrc = "";
  renderRack();
});
document.getElementById("rack-co")?.addEventListener("change", () => {
  rackCo = document.getElementById("rack-co").value || "";
  rackPick = "";
  rackLine = "";
  rackSrc = "";
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
  rackSrc = "";
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
  if (e.target.closest("[data-rack-print]")) {
    e.stopPropagation();
    rackOpenPrint(false);
    return;
  }
  if (e.target.closest("[data-rack-xlsx]")) {
    e.stopPropagation();
    exportRackExcel();
    return;
  }
  if (e.target.closest("[data-rack-pdf]")) {
    e.stopPropagation();
    rackOpenPrint(true);
    return;
  }
  if (e.target.closest("[data-rack-share]")) {
    e.stopPropagation();
    shareRackSheet();
    return;
  }
  const hideBtn = e.target.closest("[data-rack-hide]");
  if (hideBtn) {
    e.stopPropagation();
    rackHide.add(hideBtn.dataset.rackHide || "");
    renderRack();
    return;
  }
  const showBtn = e.target.closest("[data-rack-show]");
  if (showBtn) {
    e.stopPropagation();
    rackHide.delete(showBtn.dataset.rackShow || "");
    renderRack();
    return;
  }
  const back = e.target.closest("[data-rack-back]");
  if (back) {
    if (back.dataset.rackBack === "sheet" || rackLine) {
      rackLine = "";
      rackSrc = "";
    } else {
      rackPick = "";
      rackSrc = "";
      rackHide = new Set();
    }
    renderRack();
    return;
  }
  const line = e.target.closest("[data-rack-line]");
  if (line) {
    rackLine = line.dataset.rackLine || "";
    rackSrc = line.dataset.rackSrc || "";
    renderRack();
    return;
  }
  const row = e.target.closest("[data-rack-pick]");
  if (!row) return;
  rackPick = row.dataset.rackPick || "";
  rackLine = "";
  rackSrc = "";
  rackHide = new Set();
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
  bindSwipeScrollAxis(inSwipe);
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
    goOpsStep(btn.dataset.planMain === "ship" ? "ship" : "short");
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
  bindSwipeScrollAxis(planMainSwipe);
  const wakePlanMainPanes = () => {
    planMainSwipe.querySelectorAll("[data-plan-main-page]").forEach((p) => p.classList.remove("is-off"));
  };
  planMainSwipe.addEventListener("pointerdown", wakePlanMainPanes);
  planMainSwipe.addEventListener("touchstart", wakePlanMainPanes, { passive: true });
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
        const breakBox = document.getElementById("plan-break");
        if (breakBox) breakBox.hidden = currentRole() === "driver" || planMain === "ship";
        syncPlanMainPaneHeights();
        syncOpsFlowTabs();
      }, 60);
    },
    { passive: true },
  );
}
document.getElementById("plan-card").addEventListener("change", (e) => {
  const vend = e.target.closest("[data-vend-write]");
  if (vend) {
    const vendor = vend.value;
    if (!vendor) return;
    const editKey = vend.getAttribute("data-vend-key") || "";
    if (editKey) planVendorEditKeys.delete(editKey);
    const ok = writeBackOrderVendor(
      vend.getAttribute("data-vend-day") || planViewDay(),
      vend.getAttribute("data-vend-cust") || "",
      vend.getAttribute("data-vend-sku") || "",
      vend.getAttribute("data-vend-pack") || "",
      vendor,
    );
    /* 選回同一廠商時 writeBack 不重繪，仍要收合回顯示＋修改 */
    if (!ok) renderPlan();
    return;
  }
  const prep = e.target.closest("[data-prep-key]");
  if (!prep) return;
  togglePrepLine(prep.getAttribute("data-prep-day") || planViewDay(), prep.getAttribute("data-prep-key") || "", prep.checked);
});
document.getElementById("plan-card").addEventListener("click", (e) => {
  const foldBtn = e.target.closest("[data-plan-fold]");
  if (foldBtn) {
    e.preventDefault();
    e.stopPropagation();
    const id = foldBtn.getAttribute("data-plan-fold") || "";
    if (!id) return;
    const zone = foldBtn.closest(".plan-zone");
    /* Prefer live DOM so expand still works if localStorage lagged the class. */
    const currently = zone ? zone.classList.contains("is-collapsed") : planZoneCollapsed(id);
    const next = !currently;
    setPlanZoneFold(id, next);
    if (zone) {
      zone.classList.toggle("is-collapsed", next);
      const body = zone.querySelector(".plan-zone-body");
      if (body) body.hidden = next;
    }
    foldBtn.setAttribute("aria-expanded", next ? "false" : "true");
    return;
  }
  const focus = e.target.closest("[data-plan-focus]");
  if (focus) {
    e.preventDefault();
    planFocusKey = focus.getAttribute("data-plan-focus") || "";
    renderPlan();
    return;
  }
  const vendEdit = e.target.closest("[data-vend-edit]");
  if (vendEdit) {
    e.preventDefault();
    e.stopPropagation();
    const key = vendEdit.getAttribute("data-vend-key") || "";
    if (key) planVendorEditKeys.add(key);
    renderPlan();
    return;
  }
  const vendCancel = e.target.closest("[data-vend-cancel]");
  if (vendCancel) {
    e.preventDefault();
    e.stopPropagation();
    const key = vendCancel.getAttribute("data-vend-key") || "";
    if (key) planVendorEditKeys.delete(key);
    renderPlan();
    return;
  }
  const prepCust = e.target.closest("[data-prep-customer]");
  if (prepCust) {
    e.preventDefault();
    e.stopPropagation();
    setCustomerPrepped(
      prepCust.getAttribute("data-prep-day") || planViewDay(),
      prepCust.getAttribute("data-prep-customer") || "",
      prepCust.getAttribute("data-prep-on") === "1",
      (prepCust.getAttribute("data-prep-skus") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    return;
  }
  const confirmShip = e.target.closest("[data-confirm-ship]");
  if (confirmShip) {
    e.preventDefault();
    e.stopPropagation();
    confirmCustomerShip(confirmShip.getAttribute("data-confirm-ship") || "");
    return;
  }
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
function parseLinePaste() {
  const parseBlocks = globalThis.LineOrderParse?.parseLineOrderBlocks;
  const parseOne = globalThis.LineOrderParse?.parseLineOrderText;
  if (!parseBlocks && !parseOne) return setStatus("解析程式還沒載入。", true);
  const raw = document.getElementById("line-paste")?.value || "";
  if (!String(raw).trim()) return;
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
}
document.getElementById("line-parse-btn")?.addEventListener("click", parseLinePaste);
document.getElementById("line-paste")?.addEventListener("paste", () => {
  window.setTimeout(parseLinePaste, 0);
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
  const leafSel = e.target.closest("[data-draft-leaf]");
  const specSel = e.target.closest("[data-draft-spec]");
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
    if (draftIsCabSku(line.skuId)) {
      line.leafType = cabLeafTypeOf(line.leafType);
      line.spec = cabSpecOf(line.spec);
    } else if (draftIsNapSku(line.skuId)) {
      delete line.leafType;
      line.spec = napSpecOf(line.spec);
    } else {
      delete line.spec;
      delete line.leafType;
    }
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
  if (leafSel) {
    line.leafType = cabLeafTypeOf(leafSel.value);
    persistDraft(d);
    return;
  }
  if (specSel) {
    line.spec = draftIsNapSku(line.skuId) ? napSpecOf(specSel.value) : cabSpecOf(specSel.value);
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
  const pkWeight = e.target.closest("[data-pk-weight]");
  if (pkWeight) {
    syncLineMeta(pkWeight.closest(".item-line"));
  }
  const haVar = e.target.closest("[data-ha-var]");
  if (haVar) {
    const row = haVar.closest(".ha-line");
    const wSel = row?.querySelector("[data-ha-pk-weight]");
    if (wSel) wSel.value = pkDefaultWeight(haVar.value);
  }
  renderCheck();
  syncOrderEntering();
});
document.getElementById("sheet").addEventListener("click", (e) => {
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
  if (e.target.closest("[data-ticket-add]")) {
    pushPickerToTicket();
    return;
  }
  if (e.target.closest("[data-lot-pick-form]")) {
    const draft = unifiedLinesFromForm()[0] || draftSkuFromFormRow();
    if (!draft?.skuId) return setStatus("請先選品項並填件數，再選出貨編號。", true);
    const qty = Number(draft.qty) || Number(document.querySelector("[data-line-qty]")?.value);
    if (!(qty > 0)) return setStatus("件數後填時先不用選出貨編號；填件數後再選。", true);
    openLotModal({ skuId: draft.skuId, qty, selectedUha: formLot?.uha });
    return;
  }
  const pick = e.target.closest(".item-line .pick");
  const pickRow = pick?.closest(".item-line");
  if (pick && pickRow) {
    const key = pick.dataset.k;
    if (key === "ban-quick") {
      const cur = Number(pickRow.querySelector("[data-line-ban]")?.value) || 0;
      const n = Number(pick.dataset.v) || 0;
      setFormBanQty(pickRow, cur === n ? 0 : n);
      renderCheck();
      if (Number(pickRow.querySelector("[data-line-ban]")?.value) > 0 && pickVal(pickRow, "big")) {
        const ready = unifiedLinesFromForm();
        if (ready.length) pushPickerToTicket();
      }
      return;
    }
    if (key === "big") {
      const hasLine =
        Number(pickRow.querySelector("[data-line-qty]")?.value) > 0 ||
        Number(pickRow.querySelector("[data-line-ban]")?.value) > 0;
      const cur = pickVal(pickRow, "big");
      if (hasLine && cur) {
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
    syncOrderEntering();
    return;
  }
  const del = e.target.closest("[data-ha-del]");
  if (!del) return;
  formLot = null;
  renderItemSheet();
  renderCheck();
});
document.getElementById("ticket")?.addEventListener("click", (e) => {
  const banQuick = e.target.closest("[data-ticket-ban-quick]");
  if (banQuick) {
    e.preventDefault();
    const i = Number(banQuick.dataset.ticketBanQuick);
    const n = Number(banQuick.dataset.v) || 0;
    if (!ticketLines[i]) return;
    const cur = lineBanQty(ticketLines[i]);
    applyBanQty(ticketLines[i], cur === n ? 0 : n);
    if (!lineHasItem(ticketLines[i])) {
      ticketLines.splice(i, 1);
      syncHiddenShipAddr();
    }
    renderTicket();
    renderCheck();
    return;
  }
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
  const destAll = e.target.closest("[data-ticket-dest-all]");
  if (destAll) {
    const v = destAll.dataset.ticketDestAll;
    for (const line of ticketLines) {
      if (v === "其他") {
        if (SHIP_PRESETS.includes(String(line.dest || "").trim()) || line.destFreight || String(line.dest || "").trim() === "寄貨運")
          line.dest = "";
        line.destOther = true;
        delete line.destFreight;
      } else if (v === "寄貨運") {
        applyFreightToLine(line, freightCarrierDefault());
      } else {
        line.dest = v;
        delete line.destOther;
        delete line.destFreight;
      }
    }
    syncHiddenShipAddr();
    renderTicket();
    return;
  }
  const destBtn = e.target.closest("[data-ticket-dest]");
  if (destBtn) {
    const i = Number(destBtn.dataset.ticketDest);
    const v = destBtn.dataset.dest;
    if (!ticketLines[i]) return;
    if (v === "其他") {
      const cur = String(ticketLines[i].dest || "").trim();
      if (SHIP_PRESETS.includes(cur) || ticketLines[i].destFreight || cur === "寄貨運") ticketLines[i].dest = "";
      ticketLines[i].destOther = true;
      delete ticketLines[i].destFreight;
    } else if (v === "寄貨運") {
      applyFreightToLine(ticketLines[i], freightCarrierDefault());
    } else {
      ticketLines[i].dest = v;
      delete ticketLines[i].destOther;
      delete ticketLines[i].destFreight;
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
  const ticketNote = e.target.closest("[data-ticket-note]");
  if (ticketNote) {
    const i = Number(ticketNote.dataset.ticketNote);
    if (ticketLines[i]) {
      const v = ticketNote.value.trim();
      if (v) ticketLines[i].note = v;
      else delete ticketLines[i].note;
    }
    return;
  }
  const ticketCont = e.target.closest("[data-ticket-container-no]");
  if (ticketCont) {
    const i = Number(ticketCont.dataset.ticketContainerNo);
    if (ticketLines[i]) {
      applyShipMeta(ticketLines[i], ticketCont.value, lineShipWh(ticketLines[i]));
      const name = ticketCont.closest("li")?.querySelector(".ticket-name");
      if (name) name.textContent = ticketLineName(ticketLines[i]);
    }
    return;
  }
  const destAllOther = e.target.closest("[data-ticket-dest-all-other]");
  if (destAllOther) {
    const v = destAllOther.value.trim();
    const freight = ticketLines.some((l) => l.destFreight) || lineDestMode(ticketLines[0]) === "寄貨運";
    for (const line of ticketLines) {
      line.dest = v;
      if (freight) {
        line.destFreight = true;
        delete line.destOther;
      } else {
        line.destOther = true;
        delete line.destFreight;
      }
    }
    syncHiddenShipAddr();
    const addr = document.querySelector("#ticket .ticket-addr");
    const drops = uniqueTicketDrops();
    if (addr) addr.textContent = drops.join("／");
    else if (drops.length) renderTicket();
    return;
  }
  const destOther = e.target.closest("[data-ticket-dest-other]");
  if (destOther) {
    const i = Number(destOther.dataset.ticketDestOther);
    if (!ticketLines[i]) return;
    ticketLines[i].dest = destOther.value.trim();
    if (ticketLines[i].destFreight || lineDestMode(ticketLines[i]) === "寄貨運") {
      ticketLines[i].destFreight = true;
      delete ticketLines[i].destOther;
    } else {
    ticketLines[i].destOther = true;
      delete ticketLines[i].destFreight;
    }
    syncHiddenShipAddr();
    const addr = document.querySelector("#ticket .ticket-addr");
    const drops = uniqueTicketDrops();
    if (addr) addr.textContent = drops.join("／");
    return;
  }
  const banInp = e.target.closest("[data-ticket-ban]");
  if (banInp) {
    const i = Number(banInp.dataset.i ?? banInp.dataset.ticketBan);
    if (!ticketLines[i]) return;
    // 只改版數，不碰件數
    applyBanQty(ticketLines[i], banInp.value);
    if (!lineHasItem(ticketLines[i])) {
      ticketLines.splice(i, 1);
      syncHiddenShipAddr();
      renderTicket();
    } else {
      const li = banInp.closest("li");
      const name = li?.querySelector(".ticket-name");
      if (name) name.textContent = ticketLineName(ticketLines[i]);
      const banN = lineBanQty(ticketLines[i]);
      li?.querySelectorAll("[data-ticket-ban-quick]").forEach((b) => {
        b.classList.toggle("on", Number(b.dataset.v) === banN);
      });
      const qtyInp = li?.querySelector("[data-ticket-qty]");
      if (qtyInp && !(Number(qtyInp.value) > 0)) {
        qtyInp.placeholder = qtyFieldPlaceholder(banN);
      }
    }
    renderCheck();
    return;
  }
  const inp = e.target.closest("[data-ticket-qty]");
  if (!inp) return;
  const i = Number(inp.dataset.i ?? inp.dataset.ticketQty);
  if (!ticketLines[i]) return;
  const n = Number(inp.value);
  if (!(n > 0)) {
    ticketLines[i].qty = 0;
    if (skuNeedsShipLot(ticketLines[i].skuId)) clearLineLot(ticketLines[i]);
    if (!lineHasItem(ticketLines[i])) {
    ticketLines.splice(i, 1);
    syncHiddenShipAddr();
    }
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
document.getElementById("ticket")?.addEventListener("change", (e) => {
  const ticketWh = e.target.closest("[data-ticket-ship-wh]");
  if (ticketWh) {
    const i = Number(ticketWh.dataset.ticketShipWh);
    if (ticketLines[i]) {
      applyShipMeta(ticketLines[i], lineContainerNo(ticketLines[i]), ticketWh.value);
      const name = ticketWh.closest("li")?.querySelector(".ticket-name");
      if (name) name.textContent = ticketLineName(ticketLines[i]);
    }
    return;
  }
  if (!e.target.closest("[data-ticket-ban]")) return;
  e.target.dispatchEvent(new Event("input", { bubbles: true }));
});
function onFormBanFieldChange(e) {
  if (!e.target.closest("[data-line-ban]")) return;
  const row = e.target.closest(".item-line");
  syncBanQuick(row);
  syncFormQtyPlaceholder(row);
  syncOrderEntering();
}
document.getElementById("sheet").addEventListener("input", onFormBanFieldChange);
document.getElementById("sheet").addEventListener("change", onFormBanFieldChange);
document.getElementById("sheet").addEventListener("focusout", (e) => {
  if (!e.target.closest("[data-line-qty]") && !e.target.closest("[data-line-ban]")) return;
  const leftover = unifiedLinesFromForm();
  if (leftover.length) pushPickerToTicket();
});
document.getElementById("order-form")?.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    const pick = e.target.closest?.(".item-line .pick");
    if (!pick) return;
    e.preventDefault();
    const key = pick.dataset.k;
    const row = pick.closest(".item-line");
    const picks = [...row.querySelectorAll(`.pick[data-k="${CSS.escape(key)}"]`)];
    const i = picks.indexOf(pick);
    if (i < 0) return;
    const next =
      e.key === "ArrowRight" ? picks[(i + 1) % picks.length] : picks[(i - 1 + picks.length) % picks.length];
    next?.focus();
    return;
  }
  if (e.key !== "Enter") return;
  if (e.target.closest("[data-ticket-qty]")) {
    e.preventDefault();
    return;
  }
  handleItemLineEnter(e);
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
(() => {
  const qEl = document.getElementById("orders-today-q");
  const clearBtn = document.getElementById("orders-today-q-clear");
  if (!qEl) return;
  // Input stays outside any list rebuild. Keystrokes only debounce card show/hide.
  const onTyped = (immediate = false) => {
    ordersTodayQ = qEl.value || "";
    // Clear affordance only (no layout reflow); list filter is debounced separately.
    syncOrdersTodaySearchUi();
    scheduleOrdersTodaySearchFilter(immediate);
  };
  qEl.addEventListener("compositionstart", () => {
    qEl.dataset.composing = "1";
  });
  qEl.addEventListener("compositionupdate", () => {
    ordersTodayQ = qEl.value || "";
  });
  qEl.addEventListener("input", (e) => {
    if (e.isComposing || qEl.dataset.composing === "1") {
      // Mid-IME: remember value only — no DOM / filter (avoids breaking composition).
      ordersTodayQ = qEl.value || "";
      return;
    }
    onTyped(false);
  });
  qEl.addEventListener("compositionend", () => {
    qEl.dataset.composing = "";
    onTyped(false);
  });
  qEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onTyped(true);
    }
  });
  qEl.addEventListener("blur", () => {
    if (qEl.dataset.composing === "1") return;
    onTyped(true);
  });
  clearBtn?.addEventListener("click", () => {
    ordersTodayQ = "";
    qEl.value = "";
    syncOrdersTodaySearchUi();
    scheduleOrdersTodaySearchFilter(true);
    restoreOrdersTodaySearchFocus(qEl, 0, 0);
  });
  syncOrdersTodaySearchUi();
})();
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
  // 有常用下貨點時，優先切到「寄貨運」並帶入名稱
  {
    const remembered = destFromRemembered(lastShipAddr(btn.dataset.cust));
    if (remembered && !SHIP_PRESETS.includes(remembered)) {
      applyFormDestToTicket("寄貨運");
      const other = document.getElementById("form-dest-other");
      if (other) other.value = remembered;
      setShipAddr(remembered);
      syncFormRouteUi();
    }
  }
  const whoEl = document.querySelector("#ticket .ticket-who-name, #ticket .ticket-who span, #ticket .ticket-head span");
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
document.getElementById("order-urgent-btn")?.addEventListener("click", () => {
  toggleOrderUrgent();
  syncOrderEntering();
});
document.getElementById("order-form")?.addEventListener("click", (e) => {
  const dest = e.target.closest("[data-form-dest]");
  if (dest) {
    applyFormDestToTicket(dest.dataset.formDest);
    return;
  }
  const hot = e.target.closest("[data-hot-big]");
  if (hot) {
    selectPickerBig(hot.dataset.hotBig);
    document.querySelectorAll("#sku-hot-chips .sku-hot-chip").forEach((b) => {
      b.classList.toggle("is-on", b === hot);
    });
    syncOrderEntering();
    return;
  }
});
document.getElementById("form-dest-other")?.addEventListener("input", () => {
  const mode = formDestMode();
  const v = String(document.getElementById("form-dest-other")?.value || "").trim();
  if (!ticketLines.length) {
    if (mode === "寄貨運" || mode === "其他") setShipAddr(v || (mode === "寄貨運" ? "寄貨運" : ""));
    return;
  }
  for (const line of ticketLines) {
    if (mode === "寄貨運") applyFreightToLine(line, v || freightCarrierDefault());
    else if (mode === "其他") {
      line.dest = v;
      line.destOther = true;
      delete line.destFreight;
    }
  }
  syncHiddenShipAddr();
  renderTicket();
});
document.getElementById("form-ship-wh")?.addEventListener("change", () => {
  renderTicket();
});
document.getElementById("sku-quick-search")?.addEventListener("change", () => {
  const el = document.getElementById("sku-quick-search");
  const big = pickBigFromSearchLabel(el?.value);
  if (!big) return;
  selectPickerBig(big);
  document.querySelectorAll("#sku-hot-chips .sku-hot-chip").forEach((b) => {
    b.classList.toggle("is-on", b.dataset.hotBig === big);
  });
  if (el) el.value = "";
  syncOrderEntering();
});
document.getElementById("sku-quick-search")?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const el = document.getElementById("sku-quick-search");
  const big = pickBigFromSearchLabel(el?.value);
  if (!big) return;
  selectPickerBig(big);
  if (el) el.value = "";
  focusItemLineStart();
});
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
  if (leftover.length) {
    if (!pushPickerToTicket()) return;
  }
  const lines = ticketLines.map(cleanLine).filter((l) => lineHasItem(l));
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
    const prevRemark = String(o.remark || "").trim();
    o.remark = orderNoteValue();
    o.shipDate = day;
    o.preorder = isPreorderDay(day);
    o.urgent = orderUrgentValue();
    o.lines = mine;
    const remarkChanged = prevRemark !== String(o.remark || "").trim();
    markOrderEdited(o, remarkChanged ? "改品項／備註" : "改品項");
    savedIds.push(o.id);
    let siblingId = "";
    if (other.length) {
      siblingId = addOrMergeOtherBookLines(o, other, who, day, shipAddrValue()) || "";
      if (siblingId) savedIds.push(siblingId);
    }
    if (wasShipped) {
      applyOpenShipment(o);
      restoreShipMeta(o, shipMeta);
    } else o.status = "open";
    editing = "";
    document.getElementById("cancel-edit").hidden = true;
    const otherNote = siblingId
      ? ` 另帳本品項已寫入${coLabel(o.co === "ha" ? "nq" : "ha")}單。`
      : "";
    editNote = wasShipped
      ? `已改件數並重算扣庫。修改人員：${currentStaff()}。${otherNote}`
      : `已修改單，修改人員：${currentStaff()}。${otherNote}`;
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
  setOrderUrgent(false);
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
  setOrderUrgent(false);
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
(() => {
  const box = document.getElementById("orders-today");
  if (!box) return;
  let timer = 0;
  let startX = 0;
  let startY = 0;
  let armed = null;
  const clear = () => {
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
    armed = null;
  };
  const onDown = (e) => {
    if (!canOrderMulti()) return;
    if (e.target.closest("button, a, input, select, textarea, label, .inline-edit")) return;
    const pick = e.target.closest("[data-order-pick]");
    if (!pick) return;
    const pt = e.touches?.[0] || e;
    startX = pt.clientX;
    startY = pt.clientY;
    armed = pick;
    timer = window.setTimeout(() => {
      timer = 0;
      if (!armed) return;
      const id = armed.getAttribute("data-order-pick") || "";
      const all = String(armed.getAttribute("data-order-pick-all") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (orderMultiOn()) {
        if (all.length > 1) {
          for (const x of all) orderMulti.ids.add(x);
          renderOrders();
        } else toggleOrderMultiId(id);
      } else if (all.length > 1) {
        orderMulti = { ids: new Set(all) };
        renderOrders();
      } else {
        startOrderMulti(id);
      }
      armed = null;
      try {
        if (navigator.vibrate) navigator.vibrate(12);
      } catch (_) {}
    }, 480);
  };
  const onMove = (e) => {
    if (!armed || !timer) return;
    const pt = e.touches?.[0] || e;
    if (Math.abs(pt.clientX - startX) > 12 || Math.abs(pt.clientY - startY) > 12) clear();
  };
  box.addEventListener("pointerdown", onDown);
  box.addEventListener("pointermove", onMove);
  box.addEventListener("pointerup", clear);
  box.addEventListener("pointercancel", clear);
  box.addEventListener("touchstart", onDown, { passive: true });
  box.addEventListener("touchmove", onMove, { passive: true });
  box.addEventListener("touchend", clear);
  box.addEventListener("touchcancel", clear);
})();
document.getElementById("ship-labels-gate")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget || e.target.closest("[data-ship-labels-close]")) {
    closeShipLabelsPicker();
    return;
  }
  const all = e.target.closest("[data-ship-labels-all]");
  if (all && shipLabelPick) {
    const on = all.getAttribute("data-ship-labels-all") === "1";
    for (const r of shipLabelPick.rows) {
      r.on = on;
      if (on && !(Number(r.copies) > 0)) r.copies = 1;
    }
    renderShipLabelsPicker();
    return;
  }
  if (e.target.closest("[data-ship-labels-print]")) {
    printShipLabelsPicker();
  }
});
document.getElementById("ship-labels-gate")?.addEventListener("change", (e) => {
  if (!shipLabelPick) return;
  const onEl = e.target.closest("[data-ship-labels-on]");
  if (onEl) {
    const i = Number(onEl.dataset.shipLabelsOn);
    const row = shipLabelPick.rows[i];
    if (!row) return;
    row.on = !!onEl.checked;
    if (row.on && !(Number(row.copies) > 0)) row.copies = 1;
    renderShipLabelsPicker();
    return;
  }
  const copiesEl = e.target.closest("[data-ship-labels-copies]");
  if (copiesEl) {
    const i = Number(copiesEl.dataset.shipLabelsCopies);
    const row = shipLabelPick.rows[i];
    if (!row) return;
    row.copies = Math.max(0, Math.round(Number(copiesEl.value) || 0));
    if (row.copies > 0) row.on = true;
    renderShipLabelsPicker();
  }
});
document.getElementById("orders-today")?.addEventListener("input", (e) => {
  if (!inlineEdit) return;
  const remark = e.target.closest("[data-inline-remark]");
  if (remark) {
    inlineEdit.remark = remark.value;
    return;
  }
  const note = e.target.closest("[data-inline-note]");
  if (note) {
    const i = Number(note.dataset.inlineNote);
    if (inlineEdit.lines[i]) {
      const v = note.value.trim();
      if (v) inlineEdit.lines[i].note = v;
      else delete inlineEdit.lines[i].note;
    }
    return;
  }
  const addNote = e.target.closest("[data-inline-add-note]");
  if (addNote) {
    inlineEdit.addNote = addNote.value;
    return;
  }
  const ban = e.target.closest("[data-inline-ban]");
  if (ban) {
    const i = Number(ban.dataset.inlineBan);
    if (inlineEdit.lines[i]) applyBanQty(inlineEdit.lines[i], ban.value);
    return;
  }
  const qty = e.target.closest("[data-inline-qty]");
  if (qty) {
    const i = Number(qty.dataset.inlineQty);
    if (inlineEdit.lines[i]) inlineEdit.lines[i].qty = Math.max(0, Number(qty.value) || 0);
    return;
  }
  const cont = e.target.closest("[data-inline-container-no]");
  if (cont) {
    const i = Number(cont.dataset.inlineContainerNo);
    if (inlineEdit.lines[i]) applyShipMeta(inlineEdit.lines[i], cont.value, lineShipWh(inlineEdit.lines[i]));
    return;
  }
  const addCont = e.target.closest("[data-inline-add-container-no]");
  if (addCont) {
    inlineEdit.addContainerNo = addCont.value;
    return;
  }
  const addBan = e.target.closest("[data-inline-add-ban]");
  if (addBan) {
    inlineEdit.addBanQty = Math.max(0, Number(addBan.value) || 0) || "";
    return;
  }
  const addQty = e.target.closest("[data-inline-add-qty]");
  if (addQty) {
    inlineEdit.addQty = Math.max(0, Number(addQty.value) || 0);
  }
});
document.getElementById("orders-today")?.addEventListener("change", (e) => {
  if (!inlineEdit) return;
  const ban = e.target.closest("[data-inline-ban]");
  if (ban) {
    const i = Number(ban.dataset.inlineBan);
    if (inlineEdit.lines[i]) applyBanQty(inlineEdit.lines[i], ban.value);
    return;
  }
  const addBan = e.target.closest("[data-inline-add-ban]");
  if (addBan) {
    inlineEdit.addBanQty = Math.max(0, Number(addBan.value) || 0) || "";
    return;
  }
  const shipWh = e.target.closest("[data-inline-ship-wh]");
  if (shipWh) {
    const i = Number(shipWh.dataset.inlineShipWh);
    if (inlineEdit.lines[i]) {
      applyShipMeta(inlineEdit.lines[i], lineContainerNo(inlineEdit.lines[i]), shipWh.value);
      const name = shipWh.closest(".inline-edit-row")?.querySelector(".inline-edit-name");
      if (name) name.textContent = ticketLineName(inlineEdit.lines[i]);
    }
    return;
  }
  const addShipWh = e.target.closest("[data-inline-add-ship-wh]");
  if (addShipWh) {
    inlineEdit.addShipWh = addShipWh.value;
    return;
  }
  const pack = e.target.closest("[data-inline-pack]");
  if (pack) {
    const i = Number(pack.dataset.inlinePack);
    if (inlineEdit.lines[i]) inlineEdit.lines[i].pack = pack.value;
    renderOrders();
    return;
  }
  const spec = e.target.closest("[data-inline-spec]");
  if (spec) {
    const i = Number(spec.dataset.inlineSpec);
    const line = inlineEdit.lines[i];
    if (line) {
      line.spec = isNapSku(line.skuId) ? napSpecOf(spec.value) : cabSpecOf(spec.value);
    }
    renderOrders();
    return;
  }
  const leaf = e.target.closest("[data-inline-leaf]");
  if (leaf) {
    const i = Number(leaf.dataset.inlineLeaf);
    if (inlineEdit.lines[i]) inlineEdit.lines[i].leafType = cabLeafTypeOf(leaf.value);
    renderOrders();
    return;
  }
  const addSku = e.target.closest("[data-inline-add-sku]");
  if (addSku) {
    inlineEdit.addSkuId = addSku.value;
    inlineEdit.addPack = "籃裝";
    inlineEdit.addLeafType = CAB_LEAF_TYPES[0];
    inlineEdit.addSpec = isNapSku(inlineEdit.addSkuId) ? NAP_SPECS[0] : CAB_SPECS[0];
    const sku = skuById(inlineEdit.addSkuId);
    if (sku && !(Number(inlineEdit.addQty) > 0) && !(Number(inlineEdit.addBanQty) > 0)) {
      inlineEdit.addQty = skuStep(sku) >= 1 ? 1 : 0.1;
    }
    renderOrders();
    return;
  }
  const addPack = e.target.closest("[data-inline-add-pack]");
  if (addPack) {
    inlineEdit.addPack = addPack.value;
  }
  const addLeaf = e.target.closest("[data-inline-add-leaf]");
  if (addLeaf) {
    inlineEdit.addLeafType = cabLeafTypeOf(addLeaf.value);
  }
  const addSpec = e.target.closest("[data-inline-add-spec]");
  if (addSpec) {
    inlineEdit.addSpec = isNapSku(inlineEdit.addSkuId) ? napSpecOf(addSpec.value) : cabSpecOf(addSpec.value);
  }
});
function onOrdersListClick(e) {
  if (e.target.closest("[data-order-multi-clear]")) {
    clearOrderMulti();
    renderOrders();
    return;
  }
  if (e.target.closest("[data-order-multi-ship]")) {
    batchShipSelectedOrders();
    return;
  }
  if (e.target.closest("[data-order-multi-del]")) {
    batchDeleteSelectedOrders();
    return;
  }
  if (orderMultiOn() && !e.target.closest("button, a, input, select, textarea, label, .inline-edit")) {
    const pick = e.target.closest("[data-order-pick]");
    if (pick) {
      e.preventDefault();
      const all = String(pick.getAttribute("data-order-pick-all") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (all.length > 1) {
        const allOn = all.every((id) => orderMulti.ids.has(id));
        for (const id of all) {
          if (allOn) orderMulti.ids.delete(id);
          else orderMulti.ids.add(id);
        }
        if (!orderMulti.ids.size) clearOrderMulti();
        renderOrders();
      } else {
        toggleOrderMultiId(pick.getAttribute("data-order-pick") || "");
      }
      return;
    }
  }
  const bump = e.target.closest("[data-qty-step]");
  if (bump && e.target.closest(".inline-edit")) {
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
  if (e.target.closest("[data-inline-save]")) {
    commitInlineEdit();
    return;
  }
  if (e.target.closest("[data-inline-cancel]")) {
    cancelInlineEdit();
    return;
  }
  if (e.target.closest("[data-inline-add]")) {
    inlineEditAddLine();
    return;
  }
  const delLine = e.target.closest("[data-inline-del]");
  if (delLine && inlineEdit) {
    const i = Number(delLine.dataset.inlineDel);
    if (Number.isInteger(i)) {
      inlineEdit.lines.splice(i, 1);
      renderOrders();
    }
    return;
  }
  const settle = e.target.closest("[data-settle-who]");
  if (settle) {
    settleCustomerDay(settle.getAttribute("data-settle-who") || "");
    return;
  }
  const shipLabels = e.target.closest("[data-ship-labels-who]");
  if (shipLabels) {
    openShipLabelsPicker(
      shipLabels.getAttribute("data-ship-labels-who") || "",
      shipLabels.getAttribute("data-ship-labels-day") || ordersViewDay(),
    );
    return;
  }
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
    if (inlineEdit?.id === o.id) inlineEdit = null;
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
    pushAudit("order", "delete", `訂單 #${o.no || ""} ${o.customer || ""}`, {
      id: o.id,
      no: o.no,
      customer: o.customer,
      shipDate: o.shipDate,
      lines: o.lines,
    });
    if (inlineEdit?.id === o.id) inlineEdit = null;
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
    if (e.target.closest("#orders-today")) {
      startInlineEdit(o.id);
      return;
    }
    if (!requireStaff()) return;
    if (o.status === "shipped" && !can("edit-shipped")) return setStatus("已送出後請由會計或主管改件數。", true);
    if (
      o.status === "shipped" &&
      !confirm(`「${o.customer}」已送出並扣庫。送出修改會標「修改單」，並依新件數重算庫存。`)
    )
      return;
    inlineEdit = null;
    editing = o.id;
    document.getElementById("edit-id").value = o.id;
    page = "orders";
    ordersPane = "form";
    document.getElementById("customer").value = o.customer;
    setShipAddr(o.shipAddr || lastShipAddr(o.customer));
    setOrderNote(o.remark || "");
    setOrderUrgent(!!o.urgent);
    syncOrderDates(o.shipDate || today());
    const more = document.getElementById("ship-more");
    if (more && (o.shipDate || today()) !== today()) more.open = true;
    const fallbackDest = destFromRemembered(o.shipAddr || lastShipAddr(o.customer));
    ticketLines = (o.lines || [])
      .filter((l) => lineHasItem(l))
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
    settleOrders([o]);
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
  if (Array.isArray(b.importCabinets) && b.importCabinets.length) return true;
  if (Array.isArray(b.importArrivals) && b.importArrivals.length) return true;
  if (Array.isArray(b.importReleased) && b.importReleased.length) return true;
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
  if ((state.importCabinets || []).length) return true;
  if ((state.importArrivals || []).length) return true;
  if ((state.importReleased || []).length) return true;
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
    labelPrints: loadLabelPrints(),
    importCabinets: state.importCabinets || [],
    importArrivals: state.importArrivals || [],
    importReleased: state.importReleased || [],
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
    if (Array.isArray(b.labelPrints)) {
      saveLabelPrints(mergeLabelPrints(loadLabelPrints(), b.labelPrints));
    }
    if (Array.isArray(b.importCabinets)) state.importCabinets = b.importCabinets;
    if (Array.isArray(b.importArrivals)) state.importArrivals = b.importArrivals;
    if (Array.isArray(b.importReleased)) state.importReleased = b.importReleased;
    if (Array.isArray(b.importCabinets) || Array.isArray(b.importArrivals) || Array.isArray(b.importReleased)) {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch (_) {}
    }
    writeSyncAt(Number(b.updatedAt) || Date.now());
    syncAllNqQty();
  } finally {
    skipCloud = false;
  }
  try {
    if (typeof onImportRemoteApplied === "function") onImportRemoteApplied();
  } catch (_) {}
}
async function pullCloud() {
  const r = await fetch(CLOUD_URL, { cache: "no-store", headers: { Accept: "application/json" } });
  const type = r.headers.get("content-type") || "";
  if (!r.ok || !type.includes("json")) throw new Error("no-cloud");
  const data = await r.json();
  if (!data || typeof data !== "object") throw new Error("bad");
  return data;
}
function orderStamp(o) {
  const st = { deleted: 0, cancelled: 1, open: 2, delivered: 3, shipped: 4 }[o?.status] || 0;
  let qty = 0;
  for (const l of o?.lines || []) qty += Number(l.qty) || 0;
  return st * 1e15 + Number(o?.assignedAt || 0) * 1e6 + Math.round(qty * 100) + (o?.edited ? 1 : 0);
}
function mergeOrderLists(a, b) {
  const map = new Map();
  for (const o of [...(a || []), ...(b || [])]) {
    if (!o?.id) continue;
    const cur = map.get(o.id);
    if (!cur || orderStamp(o) >= orderStamp(cur)) map.set(o.id, o);
  }
  return [...map.values()];
}
function mergeRestLists(a, b) {
  const map = new Map();
  for (const r of [...(a || []), ...(b || [])]) {
    const k = `${String(r?.customer || "").trim()}\t${r?.date || ""}`;
    if (!map.has(k)) map.set(k, r);
  }
  return [...map.values()];
}
function orderSig(list) {
  return (list || [])
    .map((o) => `${o.id}:${o.status}:${o.customer}:${(o.lines || []).map((l) => `${l.skuId}:${l.qty}`).join(",")}`)
    .sort()
    .join("|");
}

/** 進口列：以 UHA 為鍵合併（較新 updatedAt 勝；同時間則欄位取較完整／較進展） */
function normImportUhaKey(v) {
  return String(v || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/\(.*$/, "")
    .trim();
}
function importClearRank(v) {
  return { done: 3, wait: 2, skip: 1, none: 0 }[v] || 0;
}
function mergeImportRowPair(a, b) {
  const ta = Number(a?.updatedAt) || 0;
  const tb = Number(b?.updatedAt) || 0;
  if (tb > ta) return { ...b };
  if (ta > tb) return { ...a };
  const out = { ...a };
  for (const key of Object.keys(b || {})) {
    const bv = b[key];
    const av = out[key];
    if (bv == null || bv === "") continue;
    if (av == null || av === "") {
      out[key] = bv;
      continue;
    }
    if (typeof bv === "boolean" && bv && !av) out[key] = true;
    if ((key === "inspect" || key === "fumigate") && importClearRank(bv) > importClearRank(av)) out[key] = bv;
    if (
      (key === "note" ||
        key === "dock" ||
        key === "trailer" ||
        key === "product" ||
        key === "containerNo" ||
        key === "customsNo" ||
        key === "broker" ||
        key === "arriveDay" ||
        key === "day") &&
      String(bv).length > String(av || "").length
    ) {
      out[key] = bv;
    }
  }
  if (a.released || b.released) out.released = true;
  if (a.ftConfirmed || b.ftConfirmed || a.ft || b.ft) {
    out.ftConfirmed = true;
    out.ft = true;
  }
  if (a.pickupReady || b.pickupReady) out.pickupReady = true;
  out.uha = normImportUhaKey(a.uha || b.uha);
  out.updatedAt = Math.max(ta, tb);
  if (!out.id) out.id = a.id || b.id;
  return out;
}
function mergeImportByUha(a, b) {
  const map = new Map();
  const put = (row) => {
    if (!row || typeof row !== "object") return;
    const k = normImportUhaKey(row.uha);
    if (!k) return;
    const next = { ...row, uha: k };
    const cur = map.get(k);
    map.set(k, cur ? mergeImportRowPair(cur, next) : next);
  };
  for (const row of a || []) put(row);
  for (const row of b || []) put(row);
  return [...map.values()];
}
function importListSig(list) {
  return (list || [])
    .map((r) => {
      const u = normImportUhaKey(r?.uha);
      if (!u) return "";
      return [
        u,
        Number(r?.updatedAt) || 0,
        r?.released ? 1 : 0,
        r?.pickupReady ? 1 : 0,
        r?.ftConfirmed || r?.ft ? 1 : 0,
        r?.inspect || "",
        r?.fumigate || "",
        r?.dock || "",
        r?.trailer || "",
        r?.note || "",
        r?.containerNo || "",
        r?.product || "",
        r?.arriveDay || r?.day || "",
      ].join(":");
    })
    .filter(Boolean)
    .sort()
    .join("|");
}
function importBundleSig(cabinets, arrivals, released) {
  return [importListSig(cabinets), importListSig(arrivals), importListSig(released)].join("\n");
}
function mergeImportBundle(localCab, localArr, localRel, remoteCab, remoteArr, remoteRel) {
  return {
    importCabinets: mergeImportByUha(localCab, remoteCab),
    importArrivals: mergeImportByUha(localArr, remoteArr),
    importReleased: mergeImportByUha(localRel, remoteRel),
  };
}

function takeRemoteOrders(remote) {
  if (!remote || typeof remote !== "object") return;
  const bundle = { ...remote };
  if (remote.orders && Array.isArray(remote.orders.orders)) {
  const mergedOrders = mergeOrderLists(state.orders, remote.orders.orders);
    bundle.orders = {
      ...remote.orders,
      orders: mergedOrders,
      rests: mergeRestLists(state.rests, remote.orders.rests),
    };
  }
  const mergedImp = mergeImportBundle(
    state.importCabinets,
    state.importArrivals,
    state.importReleased,
    remote.importCabinets,
    remote.importArrivals,
    remote.importReleased,
  );
  bundle.importCabinets = mergedImp.importCabinets;
  bundle.importArrivals = mergedImp.importArrivals;
  bundle.importReleased = mergedImp.importReleased;
  applyBundle(bundle);
}
async function pushCloud(force, retry) {
  if (skipCloud && !force) return false;
  if (!localHasData()) return false;
  let basedOn = readSyncAt();
  try {
    const remote = await pullCloud();
    const remoteAt = Number(remote.updatedAt) || 0;
    if (bundleHasData(remote) && remoteAt > basedOn) {
      const before = orderSig(state.orders);
      const beforeImp = importBundleSig(state.importCabinets, state.importArrivals, state.importReleased);
      takeRemoteOrders(remote);
      const afterImp = importBundleSig(state.importCabinets, state.importArrivals, state.importReleased);
      if (orderSig(state.orders) !== before || afterImp !== beforeImp) render();
      basedOn = remoteAt;
    }
  } catch (_) {}
  const bundle = collectBundle();
  bundle.basedOn = basedOn;
  const body = JSON.stringify(bundle);
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  let r = await fetch(CLOUD_URL, { method: "POST", cache: "no-store", headers, body });
  if (r.status === 409) {
    const remote = await r.json();
    takeRemoteOrders(remote);
    render();
    if ((retry || 0) < 2) return pushCloud(true, (retry || 0) + 1);
    return false;
  }
  if (!r.ok) r = await fetch(CLOUD_URL, { method: "PUT", cache: "no-store", headers, body });
  const type = r.headers.get("content-type") || "";
  if (!r.ok || !type.includes("json")) throw new Error("no-cloud");
  writeSyncAt(bundle.updatedAt);
  return true;
}
async function healCloudSync() {
  if (planShipLock) return true;
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
    } else if (remoteOk && !localOk) {
      applyBundle(remote);
      render();
      setSyncNote("已從共用載入資料。");
    } else if (localOk && remoteOk) {
      const remoteOrders = remote.orders?.orders || [];
      const mergedOrders = mergeOrderLists(state.orders, remoteOrders);
      const mergedRests = mergeRestLists(state.rests, remote.orders?.rests);
      const localGap = orderSig(mergedOrders) !== orderSig(state.orders);
      const remoteGap = orderSig(mergedOrders) !== orderSig(remoteOrders);
      const mergedImp = mergeImportBundle(
        state.importCabinets,
        state.importArrivals,
        state.importReleased,
        remote.importCabinets,
        remote.importArrivals,
        remote.importReleased,
      );
      const localImpSig = importBundleSig(state.importCabinets, state.importArrivals, state.importReleased);
      const remoteImpSig = importBundleSig(remote.importCabinets, remote.importArrivals, remote.importReleased);
      const mergedImpSig = importBundleSig(
        mergedImp.importCabinets,
        mergedImp.importArrivals,
        mergedImp.importReleased,
      );
      const importLocalGap = mergedImpSig !== localImpSig;
      const importRemoteGap = mergedImpSig !== remoteImpSig;
      if (remoteAt > localAt && !localGap && !remoteGap && !importLocalGap && !importRemoteGap) {
        applyBundle(remote);
        render();
        setSyncNote("已從手機／共用載入最新資料。");
      } else if (localGap || remoteGap || importLocalGap || importRemoteGap) {
        const bundle = remoteAt >= localAt ? { ...remote } : collectBundle();
        bundle.orders = bundle.orders || {};
        bundle.orders.orders = mergedOrders;
        bundle.orders.rests = mergedRests;
        if (remote.orders?.stock && !bundle.orders.stock) bundle.orders.stock = remote.orders.stock;
        if (remote.orders?.daily && !bundle.orders.daily) bundle.orders.daily = remote.orders.daily;
        bundle.importCabinets = mergedImp.importCabinets;
        bundle.importArrivals = mergedImp.importArrivals;
        bundle.importReleased = mergedImp.importReleased;
        bundle.updatedAt = Date.now();
        applyBundle(bundle);
        render();
        await pushCloud(true);
        setSyncNote("已把各電腦訂單／進口資料對齊成同一份。");
      } else if (remoteAt > localAt) {
        applyBundle(remote);
        render();
        setSyncNote("已從共用載入資料。");
      } else if (localAt > remoteAt) {
        await pushCloud(true);
        setSyncNote("已把較新的本機資料補傳到共用。");
      } else {
        setSyncNote("電腦與手機共用同一份資料。");
      }
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
async function reloadFromCloud() {
  try {
    const remote = await pullCloud();
    if (!bundleHasData(remote)) return setStatus("線上目前沒有可載入的共用資料。", true);
    applyBundle(remote);
    render();
    setSyncNote("已改為線上共用資料。");
    setStatus("已載入線上共用。若要看 9/8 的單，請把日期改成 9/8。", false);
  } catch (err) {
    console.error(err);
    setStatus("載入共用失敗，請確認開的是線上網址。", true);
  }
}
async function uploadThisDevice() {
  if (!confirm("用這台目前看到的訂單，覆蓋線上共用？覆蓋後手機與其他電腦都會跟這台一樣。")) return;
  try {
    skipCloud = false;
    const bundle = collectBundle();
    bundle.basedOn = 0;
    const body = JSON.stringify(bundle);
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    const r = await fetch(CLOUD_URL, { method: "POST", cache: "no-store", headers, body });
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !type.includes("json")) throw new Error("no-cloud");
    writeSyncAt(bundle.updatedAt);
    setSyncNote("已用這台上傳共用。其他裝置請重整。");
    setStatus("已上傳這台的資料到線上。", false);
  } catch (err) {
    console.error(err);
    setStatus("上傳失敗，請開線上網址再試。", true);
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
applyLayoutMode(preferredLayoutMode());
render();
bootCloudSync();
refreshLineDrafts();
setInterval(healCloudSync, 8000);
setInterval(refreshLineDrafts, 8000);
