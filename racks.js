(function (w) {
  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }
  function inRange(date, from, to) {
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }
  function emptyCell() {
    return { out: 0, inn: 0, opening: 0, closing: 0 };
  }
  function summarize(txns, { from, to, company }) {
    const filtered = txns.filter((t) => !company || t.company === company);
    const customers = uniqueSorted(filtered.map((t) => t.customer));
    const frames = uniqueSorted(filtered.map((t) => t.frame));
    const companies = uniqueSorted(filtered.map((t) => t.company));
    const cells = {};
    const bump = (customer, frame, field, qty) => {
      if (!cells[customer]) cells[customer] = {};
      if (!cells[customer][frame]) cells[customer][frame] = emptyCell();
      cells[customer][frame][field] += qty;
    };
    for (const t of filtered) {
      const qty = t.qty;
      const sign = t.direction === "out" ? 1 : -1;
      if (from && t.date < from) bump(t.customer, t.frame, "opening", sign * qty);
      if (inRange(t.date, from, to)) bump(t.customer, t.frame, t.direction === "out" ? "out" : "inn", qty);
      if (!to || t.date <= to) bump(t.customer, t.frame, "closing", sign * qty);
    }
    const nameCount = {};
    for (const t of filtered) {
      const name = t.frameName || t.frame;
      if (!nameCount[t.frame]) nameCount[t.frame] = {};
      nameCount[t.frame][name] = (nameCount[t.frame][name] || 0) + 1;
    }
    const frameLabels = {};
    for (const code of frames) {
      const names = Object.keys(nameCount[code] || {});
      let title = Object.entries(nameCount[code] || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || code;
      if (names.length > 1) {
        const bases = names.map((n) => n.split(/[-（(]/)[0].trim()).filter(Boolean);
        const baseCount = {};
        for (const b of bases) baseCount[b] = (baseCount[b] || 0) + 1;
        title = Object.entries(baseCount).sort((a, b) => b[1] - a[1])[0][0];
      }
      frameLabels[code] = title && title !== code ? `${code} ${title}` : code;
    }
    return { customers, frames, companies, cells, frameLabels };
  }
  function customerOwed(summary, customer) {
    const row = summary.cells[customer] || {};
    return summary.frames
      .map((frame) => {
        const cell = row[frame] || emptyCell();
        return { frame, ...cell };
      })
      .filter((x) => x.closing !== 0 || x.out || x.inn);
  }
  function frameAtCustomers(summary, frame) {
    return summary.customers
      .map((customer) => {
        const cell = summary.cells[customer]?.[frame] || emptyCell();
        return { customer, ...cell };
      })
      .filter((x) => x.closing !== 0 || x.out || x.inn);
  }
  function mergeOwed(summary, customers) {
    const byFrame = {};
    for (const customer of customers) {
      for (const row of customerOwed(summary, customer)) {
        if (!byFrame[row.frame]) byFrame[row.frame] = emptyCell();
        const cell = byFrame[row.frame];
        cell.out += row.out;
        cell.inn += row.inn;
        cell.opening += row.opening;
        cell.closing += row.closing;
      }
    }
    return Object.entries(byFrame).map(([frame, cell]) => ({ frame, ...cell }));
  }
  const NORTH_AUCTION = "北部拍賣（金芳／新豐）";
  const SOUTH_AUCTION = "南部拍賣（金芳／新豐）";
  const XIAOYANG = "小洋貨運";
  const MEINU = "美女貨運";
  const DEFAULT_MAP = {
    "新豐(北部)": NORTH_AUCTION,
    "永芳-北部": NORTH_AUCTION,
    金芳拍賣: NORTH_AUCTION,
    新豐北部拍賣: NORTH_AUCTION,
    "新豐(南部)": SOUTH_AUCTION,
    "新豐(南部": SOUTH_AUCTION,
    金芳南部: SOUTH_AUCTION,
    新豐南部拍賣: SOUTH_AUCTION,
    "新豐(台中)": "台中（新豐）",
    淳品: XIAOYANG,
    李玉菁: XIAOYANG,
    小羊: XIAOYANG,
    小洋: XIAOYANG,
    小洋貨運: XIAOYANG,
    胡仁傑: MEINU,
    鳳山娥: MEINU,
    鳳山盧: MEINU,
    美女貨運: MEINU,
  };
  function compact(name) {
    return String(name || "")
      .replace(/\s/g, "")
      .replace(/）/g, ")")
      .replace(/（/g, "(");
  }
  function carrierOf(customer, extraMap) {
    extraMap = extraMap || {};
    const n = String(customer || "").trim();
    if (!n) return "";
    if (extraMap[n]) return extraMap[n];
    if (DEFAULT_MAP[n]) return DEFAULT_MAP[n];
    const c = compact(n);
    if (DEFAULT_MAP[c]) return DEFAULT_MAP[c];
    if (/金芳.*拍賣/.test(c) && !/南部/.test(c)) return NORTH_AUCTION;
    if ((/新豐.*北部/.test(c) || /北部.*拍賣/.test(c)) && /新豐|金芳/.test(c)) return NORTH_AUCTION;
    if (/永芳.*北部/.test(c)) return NORTH_AUCTION;
    if (/金芳.*南部/.test(c) || /新豐.*南部/.test(c)) return SOUTH_AUCTION;
    if (/新豐.*台中/.test(c)) return "台中（新豐）";
    if (c.includes("淳品") || c.includes("李玉菁") || c === "小羊" || c.includes("小洋")) return XIAOYANG;
    if (c.includes("胡仁傑") || c.includes("鳳山娥") || c.includes("鳳山盧") || c.includes("美女貨運")) return MEINU;
    return n;
  }
  function uniqueCarriers(customers, extraMap) {
    return uniqueSorted(customers.map((c) => carrierOf(c, extraMap)));
  }
  function customersOfCarrier(customers, carrier, extraMap) {
    return customers.filter((c) => carrierOf(c, extraMap) === carrier);
  }
  w.RackLib = {
    uniqueSorted,
    summarize,
    customerOwed,
    frameAtCustomers,
    mergeOwed,
    carrierOf,
    uniqueCarriers,
    customersOfCarrier,
  };
})(window);
