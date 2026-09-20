/** 頂層三模組：港口辦理／貨櫃拆卸資料／帳務與庫存 */
export const BLOCKS = [
  { id: "port", lab: "港口辦理" },
  { id: "unpack", lab: "貨櫃拆卸資料" },
  { id: "acct", lab: "帳務與庫存" },
];

/** 子頁（屬哪個模組；左側只顯示目前模組的子頁） */
export const TABS = [
  { id: "parse", lab: "判讀", block: "port" },
  { id: "port", lab: "海關查驗", block: "port" },
  { id: "release", lab: "已放行", block: "port" },
  { id: "checklist", lab: "查驗清單", block: "port" },
  { id: "files", lab: "舊資料", block: "port" },
  { id: "upBoard", lab: "拆卸貨櫃總資料", block: "unpack" },
  { id: "unpack", lab: "拆櫃回報", block: "unpack" },
  { id: "sum", lab: "拆卸總清單", block: "unpack" },
  { id: "stock", lab: "庫存", block: "acct" },
  { id: "buy", lab: "採購", block: "acct" },
  { id: "broker", lab: "報關行", block: "acct" },
  { id: "vendor", lab: "廠商", block: "acct" },
  { id: "trailer", lab: "拖車", block: "acct" },
  { id: "labor", lab: "拆工", block: "acct" },
];

export const PANE_TITLE = {
  parse: "判讀",
  port: "海關查驗",
  release: "已放行",
  checklist: "查驗清單",
  stock: "進口庫存",
  sum: "拆卸總清單",
  upBoard: "拆卸貨櫃總資料",
  unpack: "拆櫃回報",
  files: "舊資料",
  buy: "進口採購",
  broker: "報關行",
  vendor: "廠商",
  trailer: "拖車",
  labor: "拆工對帳",
};

export const CLEAR_OPTS = [
  { id: "none", lab: "待確認" },
  { id: "wait", lab: "需要" },
  { id: "done", lab: "完成" },
  { id: "skip", lab: "無須檢驗" },
];

/** 藥檢／薰蒸下拉：依欄位顯示「需要藥檢」「需要薰蒸」 */
export function clearOptsFor(kind) {
  return CLEAR_OPTS.map((o) => {
    if (o.id !== "wait") return o;
    if (kind === "inspect") return { ...o, lab: "需要藥檢" };
    if (kind === "fumigate") return { ...o, lab: "需要薰蒸" };
    return o;
  });
}

export function clearLab(id, kind) {
  const opts = clearOptsFor(kind);
  return (opts.find((o) => o.id === id) || {}).lab || "待確認";
}

export const DEST_OPTS = [
  { id: "coldstore", lab: "自有冰庫販售" },
  { id: "customer", lab: "交客戶" },
];

const TAB_BY_ID = Object.fromEntries(TABS.map((t) => [t.id, t]));

export function normalizePane(pane) {
  let p = pane || "parse";
  if (p === "board" || p === "hub") p = "parse";
  if (p === "status") p = "port";
  if (p === "現場作業") p = "upBoard";
  if (!TAB_BY_ID[p]) p = "parse";
  return p;
}

export function blockOfPane(pane) {
  const t = TAB_BY_ID[normalizePane(pane)];
  return t ? t.block : "port";
}

export function tabsForBlock(blockId) {
  return TABS.filter((t) => t.block === blockId);
}

export function defaultPaneForBlock(blockId) {
  const first = tabsForBlock(blockId).find((t) => !t.go) || tabsForBlock(blockId)[0];
  return first ? first.id : "parse";
}

/** 手機橫滑：同模組內、不含跳出頁 */
export function swipeTabsForPane(pane) {
  return tabsForBlock(blockOfPane(pane))
    .filter((t) => !t.go)
    .map((t) => t.id);
}

export function todayYmd() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
