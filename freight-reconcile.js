const SKIP_UNITS = /^(公斤|kg|ｋｇ)$/i;
const STOP_DAY_LABEL = /單價|小計|總額|合計|總計/;
const KEY_HINTS = ["託運單", "貨運單", "運單號", "運單", "tracking", "shipment", "單號", "請款單", "訂單", "編號", "invoice", "doc"];
const QTY_HINTS = ["數量", "件數", "箱數", "qty", "quantity", "pcs", "件"];

function parseQty(raw) {
  const t = String(raw ?? "").replace(/,/g, "").replace(/[^\d.+-]/g, "").trim();
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function roundQty(n) {
  return Math.round(n * 1000) / 1000;
}

function uniqueHeaders(raw) {
  const seen = new Map();
  return raw.map((item, index) => {
    const base = String(item || "").trim() || `欄${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

function splitDelimitedLine(line, delimiter) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      out.push(current);
      current = "";
    } else current += ch;
  }
  out.push(current);
  return out;
}

function detectDelimiter(text) {
  const sample = text.split(/\r?\n/).slice(0, 8).join("\n");
  const commas = (sample.match(/,/g) || []).length;
  const tabs = (sample.match(/\t/g) || []).length;
  const semis = (sample.match(/;/g) || []).length;
  if (tabs > commas && tabs >= semis) return "\t";
  if (semis > commas) return ";";
  return ",";
}

function parseDelimited(text, fileName) {
  const cleaned = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const delimiter = detectDelimiter(cleaned);
  const lines = cleaned.split("\n").filter((line) => line.trim().length > 0);
  if (!lines.length) throw new Error(`${fileName} 是空的`);
  const headers = uniqueHeaders(splitDelimitedLine(lines[0], delimiter).map((h) => h.trim()));
  const rows = lines.slice(1).map((line) => {
    const cells = splitDelimitedLine(line, delimiter);
    const row = {};
    headers.forEach((header, i) => {
      row[header] = (cells[i] || "").trim();
    });
    return row;
  });
  return { fileName, headers, rows };
}

function toAoa(raw) {
  return (raw || []).map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "").trim()) : []));
}

function rowsFromAoA(aoa, fileName) {
  const lines = aoa
    .map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "").trim()) : []))
    .filter((row) => row.some((cell) => cell.length > 0));
  if (!lines.length) throw new Error(`${fileName} 沒有資料`);
  const headers = uniqueHeaders(lines[0]);
  const rows = lines.slice(1).map((cells) => {
    const row = {};
    headers.forEach((header, i) => {
      row[header] = cells[i] || "";
    });
    return row;
  });
  return { fileName, headers, rows };
}

function workbookToTable(book) {
  const first = book.sheets[0];
  if (!first) throw new Error(`${book.fileName} 沒有工作表`);
  return rowsFromAoA(first.aoa, book.fileName);
}

function parseWorkbookBuffer(fileName, buf) {
  const name = fileName || "未命名";
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt") || lower.endsWith(".tsv")) {
    const table = parseDelimited(Buffer.from(buf).toString("utf8"), name);
    const aoa = [table.headers, ...table.rows.map((row) => table.headers.map((h) => row[h] || ""))];
    return { fileName: name, sheets: [{ name, aoa }] };
  }
  const XLSX = require("xlsx");
  const wb = XLSX.read(buf, { type: "buffer" });
  if (!wb.SheetNames.length) throw new Error(`${name} 沒有工作表`);
  const sheets = wb.SheetNames.map((sheetName) => {
    const sheet = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
    return { name: sheetName, aoa: toAoa(aoa) };
  });
  return { fileName: name, sheets };
}

function scoreHeader(header, hints) {
  const h = header.toLowerCase();
  let score = 0;
  for (const hint of hints) {
    if (h.includes(hint.toLowerCase())) score += hint.length;
  }
  return score;
}

function guessColumn(headers, kind) {
  if (!headers.length) return "";
  const hints = kind === "key" ? KEY_HINTS : QTY_HINTS;
  let best = headers[kind === "qty" && headers.length > 1 ? 1 : 0];
  let bestScore = -1;
  for (const header of headers) {
    const score = scoreHeader(header, hints);
    if (score > bestScore) {
      best = header;
      bestScore = score;
    }
  }
  if (bestScore <= 0 && kind === "key") return headers[0];
  if (bestScore <= 0 && kind === "qty") return headers.find((h) => h !== headers[0]) || headers[0];
  return best;
}

function parseDayLabel(raw) {
  const m = String(raw).match(/^(\d{1,2})\s*日/);
  return m ? Number(m[1]) : null;
}

function normCrop(name) {
  return name.replace(/\s+/g, "").replace(/菜$/, "").toLowerCase();
}

function classifySheet(aoa) {
  const joined = aoa.slice(0, 8).map((r) => r.join(" ")).join(" ");
  if (joined.includes("單據憑證") && joined.includes("品名") && joined.includes("數量")) return "sales";
  if (aoa.some((row) => parseDayLabel(row[0] || "") !== null) && joined.includes("應收帳款")) return "freight";
  const dayRows = aoa.filter((row) => parseDayLabel(row[0] || "") !== null).length;
  if (dayRows >= 5) return "freight";
  return "other";
}

function parseFreightMatrix(sheet) {
  const { aoa, name } = sheet;
  let dataStart = -1;
  for (let i = 0; i < aoa.length; i += 1) {
    if (parseDayLabel(aoa[i]?.[0] || "") !== null) {
      dataStart = i;
      break;
    }
  }
  if (dataStart < 1) return null;
  const header = aoa[dataStart - 1] || [];
  const crops = header.slice(1).map((c) => c.trim()).filter(Boolean);
  if (crops.length < 3) return null;
  const days = new Map();
  for (const row of aoa.slice(dataStart)) {
    const label = row[0] || "";
    if (STOP_DAY_LABEL.test(label)) break;
    const day = parseDayLabel(label);
    if (day === null) continue;
    const cells = new Map();
    crops.forEach((crop, i) => {
      cells.set(crop, parseQty(row[i + 1] || ""));
    });
    days.set(day, cells);
  }
  return days.size === 0 ? null : { sheetName: name, crops, days };
}

function headerIndex(header, ...hints) {
  const lower = header.map((h) => h.toLowerCase());
  for (const hint of hints) {
    const i = lower.findIndex((h) => h.includes(hint.toLowerCase()));
    if (i >= 0) return i;
  }
  return -1;
}

function cropGroup(name) {
  const n = name;
  if (/紫高/.test(n)) return "紫高";
  if (/高麗/.test(n)) return "高麗";
  if (/白蘿|白萝/.test(n)) return "白k";
  if (/大白/.test(n)) return "大白";
  if (/牛蒡/.test(n)) return "牛蒡";
  if (/美生/.test(n)) return "美生";
  if (/娃娃/.test(n)) return "娃娃";
  if (/南瓜/.test(n)) return "南瓜";
  if (/青花|花椰|進青/.test(n)) return "進青";
  if (/馬鈴|馬k|馬K/.test(n)) return "馬k";
  if (/洋蔥/.test(n)) {
    if (/20k|20K|版/.test(n)) return "洋蔥-版";
    return "洋蔥";
  }
  if (/西芹/.test(n)) {
    if (/美國|美-/.test(n)) return "美-西芹";
    return "西芹";
  }
  return "未分類";
}

function resolveCrop(label, columns) {
  if (label === "未分類") return null;
  const n = normCrop(label);
  const exact = columns.find((c) => normCrop(c) === n);
  if (exact) return exact;
  const hits = columns.filter((c) => {
    const cn = normCrop(c);
    if (cn === "洋蔥" && n === "洋蔥-版") return false;
    if (n === "洋蔥" && cn.includes("版")) return false;
    return cn === n || cn.includes(n) || n.includes(cn);
  });
  hits.sort((a, b) => normCrop(b).length - normCrop(a).length);
  return hits[0] || null;
}

function parseSalesDetail(sheet) {
  const { aoa } = sheet;
  const headerRow = aoa.findIndex((row) => row.includes("單據憑證") && row.some((c) => c.includes("品名")));
  if (headerRow < 0) return null;
  const header = aoa[headerRow];
  const nameCol = headerIndex(header, "品名規格", "品名");
  const qtyCol = headerIndex(header, "數量");
  const unitCol = headerIndex(header, "單位");
  if (nameCol < 0 || qtyCol < 0) return null;

  let day = null;
  const qty = new Map();
  const skippedKg = [];
  const unmapped = [];
  let lineCount = 0;

  for (const row of aoa.slice(headerRow + 1)) {
    const first = row[0] || "";
    if (first.startsWith("單據日期")) {
      const m = first.match(/(\d{1,3})\/(\d{1,2})\/(\d{1,2})/);
      day = m ? Number(m[3]) : day;
      continue;
    }
    if (/計：|計:/.test(first) || first.startsWith("主管") || first === "H") continue;
    const name = (row[nameCol] || "").trim();
    const unit = unitCol >= 0 ? (row[unitCol] || "").trim() : "";
    const amount = parseQty(row[qtyCol] || "");
    if (!name || !amount || day === null) continue;
    lineCount += 1;
    if (SKIP_UNITS.test(unit)) {
      skippedKg.push({ day, name, qty: amount, unit });
      continue;
    }
    const group = cropGroup(name);
    if (group === "未分類") {
      unmapped.push({ day, name, qty: amount });
      continue;
    }
    const key = `${day}|${group}`;
    qty.set(key, (qty.get(key) || 0) + amount);
  }
  return { qty, skippedKg, unmapped, lineCount };
}

function statusOf(sales, freight) {
  if (!sales && freight) return "theirs-only";
  if (sales && !freight) return "ours-only";
  if (sales === freight) return "match";
  return "qty";
}

function compareSalesToFreight(sales, orig, fixed) {
  const crops = orig.crops;
  const days = new Set([...orig.days.keys(), ...(fixed?.days.keys() || [])]);
  for (const key of sales.qty.keys()) days.add(Number(key.split("|")[0]));

  const rows = [];
  for (const day of [...days].sort((a, b) => a - b)) {
    for (const crop of crops) {
      const mappedKeys = [...sales.qty.keys()].filter((k) => {
        const [d, g] = k.split("|");
        return Number(d) === day && resolveCrop(g, crops) === crop;
      });
      const salesQty = roundQty(mappedKeys.reduce((s, k) => s + (sales.qty.get(k) || 0), 0));
      const origQty = roundQty(orig.days.get(day)?.get(crop) || 0);
      const fixedQty = fixed ? roundQty(fixed.days.get(day)?.get(crop) || 0) : null;
      if (!salesQty && !origQty && !(fixedQty || 0)) continue;
      rows.push({
        day,
        crop,
        sales: salesQty,
        orig: origQty,
        fixed: fixedQty,
        statusOrig: statusOf(salesQty, origQty),
        statusFix: fixedQty === null ? null : statusOf(salesQty, fixedQty),
      });
    }
  }
  return rows;
}

function pickRoles(a, b) {
  const pair = [
    { book: a, other: b },
    { book: b, other: a },
  ];
  for (const { book, other } of pair) {
    const salesSheet = book.sheets.find((s) => classifySheet(s.aoa) === "sales");
    const freightSheets = other.sheets.map((s) => parseFreightMatrix(s)).filter(Boolean);
    if (!salesSheet || !freightSheets.length) continue;
    const sales = parseSalesDetail(salesSheet);
    if (!sales) continue;
    return {
      sales,
      salesName: book.fileName,
      orig: freightSheets[0],
      origName: `${other.fileName} · ${freightSheets[0].sheetName}`,
      fixed: freightSheets[1] || null,
      freightFile: other.fileName,
    };
  }
  return null;
}

function summarizeTriple(rows, side) {
  const statuses = rows.map((r) => (side === "orig" ? r.statusOrig : r.statusFix)).filter(Boolean);
  const freight = (r) => (side === "orig" ? r.orig : r.fixed || 0);
  return {
    match: statuses.filter((s) => s === "match").length,
    qty: statuses.filter((s) => s === "qty").length,
    oursOnly: statuses.filter((s) => s === "ours-only").length,
    theirsOnly: statuses.filter((s) => s === "theirs-only").length,
    salesSum: roundQty(rows.reduce((s, r) => s + r.sales, 0)),
    freightSum: roundQty(rows.reduce((s, r) => s + freight(r), 0)),
  };
}

function toFreightCsv(rows, hasFixed) {
  const label = { match: "對得上", qty: "數量不同", "ours-only": "只有進銷存", "theirs-only": "只有請款" };
  const header = hasFixed
    ? ["日期", "品項", "進銷存", "貨運原表", "差(原)", "結果(原)", "修正表", "差(修)", "結果(修)"]
    : ["日期", "品項", "進銷存", "貨運請款", "差", "結果"];
  const lines = rows.map((r) => {
    const cells = hasFixed
      ? [
          `${r.day}日`,
          r.crop,
          r.sales,
          r.orig,
          roundQty(r.orig - r.sales),
          label[r.statusOrig],
          r.fixed ?? "",
          r.fixed === null ? "" : roundQty(r.fixed - r.sales),
          r.statusFix ? label[r.statusFix] : "",
        ]
      : [`${r.day}日`, r.crop, r.sales, r.orig, roundQty(r.orig - r.sales), label[r.statusOrig]];
    return cells.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
  });
  return `\uFEFF${header.join(",")}\n${lines.join("\n")}`;
}

function aggregate(table, keyCol, qtyCol) {
  const map = new Map();
  for (const row of table.rows) {
    const key = String(row[keyCol] || "").replace(/\s+/g, "").trim();
    if (!key) continue;
    const qty = parseQty(row[qtyCol] || "");
    const prev = map.get(key);
    if (prev) {
      prev.qty += qty;
      prev.lines += 1;
    } else map.set(key, { qty, lines: 1 });
  }
  return map;
}

function compareTables(ours, theirs, oursKey, oursQty, theirsKey, theirsQty) {
  const left = aggregate(ours, oursKey, oursQty);
  const right = aggregate(theirs, theirsKey, theirsQty);
  const keys = new Set([...left.keys(), ...right.keys()]);
  const rows = [];
  for (const key of keys) {
    const a = left.get(key);
    const b = right.get(key);
    const oursQtyVal = roundQty(a?.qty || 0);
    const theirsQtyVal = roundQty(b?.qty || 0);
    let status;
    if (!a) status = "theirs-only";
    else if (!b) status = "ours-only";
    else if (oursQtyVal === theirsQtyVal) status = "match";
    else status = "qty";
    rows.push({
      key,
      ours: oursQtyVal,
      theirs: theirsQtyVal,
      oursLines: a?.lines || 0,
      theirsLines: b?.lines || 0,
      diff: roundQty(theirsQtyVal - oursQtyVal),
      status,
    });
  }
  const order = { qty: 0, "theirs-only": 1, "ours-only": 2, match: 3 };
  rows.sort((a, b) => order[a.status] - order[b.status] || a.key.localeCompare(b.key, "zh-Hant"));
  return rows;
}

function summarizeGeneric(rows) {
  return {
    total: rows.length,
    match: rows.filter((r) => r.status === "match").length,
    qty: rows.filter((r) => r.status === "qty").length,
    oursOnly: rows.filter((r) => r.status === "ours-only").length,
    theirsOnly: rows.filter((r) => r.status === "theirs-only").length,
    oursSum: roundQty(rows.reduce((s, r) => s + r.ours, 0)),
    theirsSum: roundQty(rows.reduce((s, r) => s + r.theirs, 0)),
  };
}

function toDiffCsv(rows) {
  const header = ["單號", "我們數量", "請款數量", "差（請款-我們）", "結果", "我們筆數", "請款筆數"];
  const label = { match: "對得上", qty: "數量不同", "ours-only": "只有我們有", "theirs-only": "只有請款有" };
  const lines = rows.map((r) =>
    [r.key, r.ours, r.theirs, r.diff, label[r.status], r.oursLines, r.theirsLines]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return `\uFEFF${header.join(",")}\n${lines.join("\n")}`;
}

function runCompare(oursBook, theirsBook) {
  const job = pickRoles(oursBook, theirsBook);
  if (job) {
    const rows = compareSalesToFreight(job.sales, job.orig, job.fixed);
    return {
      ok: true,
      mode: "freight",
      salesName: job.salesName,
      origName: job.origName,
      freightFile: job.freightFile,
      hasFixed: Boolean(job.fixed),
      fixedSheet: job.fixed?.sheetName || null,
      lineCount: job.sales.lineCount,
      skippedKg: job.sales.skippedKg,
      unmapped: job.sales.unmapped,
      rows,
      statsOrig: summarizeTriple(rows, "orig"),
      statsFix: job.fixed ? summarizeTriple(rows, "fixed") : null,
      csv: toFreightCsv(rows, Boolean(job.fixed)),
    };
  }
  const left = workbookToTable(oursBook);
  const right = workbookToTable(theirsBook);
  const oursKey = guessColumn(left.headers, "key");
  const oursQty = guessColumn(left.headers, "qty");
  const theirsKey = guessColumn(right.headers, "key");
  const theirsQty = guessColumn(right.headers, "qty");
  const rows = compareTables(left, right, oursKey, oursQty, theirsKey, theirsQty);
  return {
    ok: true,
    mode: "generic",
    salesName: oursBook.fileName,
    origName: theirsBook.fileName,
    oursKey,
    oursQty,
    theirsKey,
    theirsQty,
    rows,
    stats: summarizeGeneric(rows),
    csv: toDiffCsv(rows),
  };
}

function compareFromUploads(ours, theirs) {
  const a = parseWorkbookBuffer(ours.name, ours.buf);
  const b = parseWorkbookBuffer(theirs.name, theirs.buf);
  return runCompare(a, b);
}

module.exports = {
  parseWorkbookBuffer,
  runCompare,
  compareFromUploads,
};
