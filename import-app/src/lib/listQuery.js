/**
 * 海關查驗／已放行／現場拆櫃共用：搜尋與排序。
 */

export function uhaSortKey(u) {
  const s = String(u || "").toUpperCase();
  const m = s.match(/^(UHA|NC)(\d+)/);
  if (m) return `${m[1]}${String(m[2]).padStart(6, "0")}`;
  return s;
}

/** UHA／NC 數字後三碼；尚無數字（待補）回傳 null */
export function uhaTailNum(u) {
  const s = String(u || "").trim().toUpperCase();
  if (!s || /^待編-/i.test(s) || /^TMP-/i.test(s)) return null;
  if (/^(UHA|NC)\s*$/i.test(s)) return null;
  const m = s.match(/^(UHA|NC)(\d+)/);
  if (!m) return null;
  return Number(m[2].slice(-3));
}

/**
 * 預設編號排序：有數字的依後三碼；待補排最後，再按到港日。
 */
export function cmpUhaTailThenArrive(a, b) {
  const ta = uhaTailNum(a?.uha || a?.key || a?.box || "");
  const tb = uhaTailNum(b?.uha || b?.key || b?.box || "");
  const pa = ta == null;
  const pb = tb == null;
  if (pa !== pb) return pa ? 1 : -1;
  if (!pa && !pb && ta !== tb) return ta - tb;
  const da = String(a?.arriveDay || "");
  const db = String(b?.arriveDay || "");
  if (da !== db) return da.localeCompare(db);
  return uhaSortKey(a?.uha || a?.key || "").localeCompare(uhaSortKey(b?.uha || b?.key || ""), "en");
}

export function normalizeQuery(q) {
  return String(q || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** 從列取值：支援函式或欄位名陣列 */
export function getRowText(row, fields) {
  const parts = [];
  for (const f of fields || []) {
    if (typeof f === "function") {
      const v = f(row);
      if (v != null && v !== "") parts.push(String(v));
      continue;
    }
    const v = row?.[f];
    if (v != null && v !== "") parts.push(String(v));
  }
  if (Array.isArray(row?.cells)) {
    for (const c of row.cells) {
      if (c != null && c !== "" && c !== "—") parts.push(String(c));
    }
  }
  return parts.join(" ").toLowerCase();
}

export function rowMatchesQuery(row, query, fields) {
  const q = normalizeQuery(query);
  if (!q) return true;
  const hay = getRowText(row, fields);
  const tokens = q.split(" ").filter(Boolean);
  return tokens.every((t) => hay.includes(t));
}

export function filterRows(rows, query, fields) {
  const list = Array.isArray(rows) ? rows : [];
  if (!normalizeQuery(query)) return list.slice();
  return list.filter((r) => rowMatchesQuery(r, query, fields));
}

function cmpStr(a, b, locale = "zh-Hant") {
  return String(a || "").localeCompare(String(b || ""), locale);
}

/**
 * sortBy: 字串 key，或 { key, get, locale, desc }
 * getters: { [key]: (row) => value }；內建 uha
 */
export function sortRows(rows, sortBy, getters = {}) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  const spec = typeof sortBy === "string" ? { key: sortBy } : sortBy || { key: "uha" };
  const key = spec.key || "uha";
  const desc = !!spec.desc;
  const get =
    typeof spec.get === "function"
      ? spec.get
      : typeof getters[key] === "function"
        ? getters[key]
        : key === "uha"
          ? (r) => uhaSortKey(r.uha || r.key || r.box || "")
          : (r) => r?.[key] ?? "";

  list.sort((a, b) => {
    if (key === "uha") {
      const c = cmpUhaTailThenArrive(a, b);
      return desc ? -c : c;
    }
    let av = get(a);
    let bv = get(b);
    const an = typeof av === "number" ? av : null;
    const bn = typeof bv === "number" ? bv : null;
    let c;
    if (an != null && bn != null && !Number.isNaN(an) && !Number.isNaN(bn)) c = an - bn;
    else c = cmpStr(av, bv, spec.locale || "zh-Hant");
    if (c !== 0) return desc ? -c : c;
    return cmpUhaTailThenArrive(a, b);
  });
  return list;
}

export function queryRows(rows, { query, sortBy, fields, getters } = {}) {
  return sortRows(filterRows(rows, query, fields), sortBy, getters);
}

/** 各模組預設搜尋欄位 */
export const SEARCH_FIELDS = {
  port: ["uha", "containerNo", "product", "seller", "shipCo", "dock", "note", "status", "arriveDay", (r) => (r.missingTelex ? "缺電放" : ""), (r) => (r.missingData ? "缺資料" : "")],
  release: ["uha", "containerNo", "product", "dock", "trailer", "trailerPhone", "pickupDay", "unpackSite", "assignee"],
  upBoard: ["uha", "box", "sourceUha", "containerNo", "product", "name", "trailer", "trailerPhone", "assignee", "location", "dock", "day", "unpackAt"],
};

export const SORT_OPTS = {
  port: [
    { id: "uha", lab: "編號後三碼" },
    { id: "arriveDay", lab: "到港日" },
    { id: "product", lab: "品名" },
    { id: "status", lab: "狀態" },
  ],
  release: [
    { id: "uha", lab: "編號後三碼" },
    { id: "trailer", lab: "拖車" },
    { id: "pickupDay", lab: "領櫃日" },
    { id: "product", lab: "品名" },
  ],
  upBoard: [
    { id: "unpackAt", lab: "拆卸時間" },
    { id: "uha", lab: "編號後三碼" },
    { id: "trailer", lab: "拖車" },
    { id: "product", lab: "品名" },
  ],
};

export const SORT_GETTERS = {
  port: {
    uha: (r) => uhaSortKey(r.uha || r.key),
    arriveDay: (r) => r.arriveDay || "",
    product: (r) => r.product || "",
    status: (r) => r.status || "",
  },
  release: {
    uha: (r) => uhaSortKey(r.uha || r.key),
    trailer: (r) => r.trailer || "",
    pickupDay: (r) => r.pickupDay || "",
    product: (r) => r.product || "",
  },
  upBoard: {
    uha: (r) => uhaSortKey(r.uha || r.sourceUha || r.box || r.key),
    unpackAt: (r) => r.unpackAt || r.day || "",
    trailer: (r) => r.trailer || "",
    product: (r) => r.product || r.name || "",
  },
};
