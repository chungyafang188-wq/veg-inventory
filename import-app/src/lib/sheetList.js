/** 安排好之後的交貨清單：交貨資料、品項/件數、領櫃日（拆工）。 */
import { fumeWhenLab, needsFumeHold } from "./fumeShift";

const WEEK = "日一二三四五六";

function mdWeek(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { md: "", wk: "" };
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return { md: `${Number(m[2])}/${Number(m[3])}`, wk: WEEK[dt.getDay()] || "" };
}

function clockOf(unpackAt) {
  const m = String(unpackAt || "").match(/T(\d{2}):(\d{2})/);
  if (!m || (m[1] === "00" && m[2] === "00")) return "";
  return `${m[1]}:${m[2]}`;
}

function dayClock(clock) {
  if (!clock) return "";
  const h = Number(clock.slice(0, 2));
  if (h >= 12 && h < 18) return `下午${clock}`;
  return clock;
}

function shortNote(note) {
  const s = String(note || "").trim().replace(/^[（(]+|[）)]+$/g, "");
  if (!s || s.length > 24) return "";
  return s;
}

/** 拆卸位置若已含客戶名，交貨第二行不再重複。 */
function placeOf(site, who) {
  const s = String(site || "").trim();
  if (!s) return "";
  if (who && s.includes(who)) return "";
  return s;
}

/** 交貨資料，一或兩行。交櫃第一行是交-客戶。 */
export function handoverLines(row) {
  const who = String(row?.deliverTo || "").trim();
  const handoff = row?.customerKind === "customer" || !!who;
  const site = String(row?.location || "").trim();
  const { md, wk } = mdWeek(row?.unpackAt || row?.day);
  const dayBit = md ? `${md}(${wk})` : "";
  const shift = !!row?.unpackShift;
  const clock = clockOf(row?.unpackAt);
  const when = dayClock(clock);

  if (!handoff) {
    if (dayBit && shift && site && clock) return [`${dayBit} 上班領-到${site}(${clock}到)`];
    if (dayBit && shift && site) return [`${dayBit} 上班領-到${site}`];
    if (dayBit && when && site) return [`${dayBit} ${when}到${site}`];
    if (dayBit && shift) return [`${dayBit} 上班領`];
    if (dayBit && site) return [`${dayBit} 到${site}`];
    if (site) return [`到${site}`];
    if (dayBit) return [dayBit];
    return [];
  }

  const note = shortNote(row?.note);
  const place = placeOf(site, who);
  const line1 = who ? `交-${who}` : place ? `交-${place}` : note ? `交-(${note})` : "交-";
  let line2 = "";
  if (dayBit && shift) line2 = `${dayBit} 上班領`;
  else if (dayBit && when && place) line2 = `${dayBit} ${when}到${place}`;
  else if (dayBit && when) line2 = `${dayBit} ${when}到`;
  else if (dayBit && place && who) line2 = `${dayBit} 到${place}`;
  else if (dayBit) line2 = `${dayBit}領(未確認時間地點)`;
  return line2 ? [line1, line2] : [line1];
}

/** 還在等煙燻時加一行。燻完或不用燻就不顯示，交櫃安排留著。 */
export function fumeHoldLine(row) {
  if (!needsFumeHold(row)) return "";
  const when = fumeWhenLab(row?.fumigateAt, row?.fumigateShift);
  return when ? `待煙燻 ${when}` : "待煙燻";
}

export function handoverWithFume(row) {
  const lines = handoverLines(row);
  const fume = fumeHoldLine(row);
  return fume ? [...lines, fume] : lines;
}

/** 領櫃日欄：自行拆櫃寫成客戶自拆。 */
export function sheetWorker(assignee) {
  const name = String(assignee || "").trim();
  if (!name) return "";
  if (name === "自行拆櫃") return "客戶自拆";
  return name;
}

export function sheetProduct(row) {
  const name = String(row?.product || row?.name || "").trim();
  const qty = row?.assignQty == null || row.assignQty === "" || Number(row.assignQty) === 0 ? "" : String(row.assignQty);
  if (!qty) return name;
  if (name.endsWith(qty) || name.endsWith(`-${qty}`)) return name;
  return name ? `${name}-${qty}` : qty;
}

export function sheetTsv(rows) {
  const head = ["編號", "貨櫃號碼", "交貨資料", "品項/件數", "拖車", "領櫃日"];
  const body = (rows || []).map((row) => {
    const cols = [
      row.uha || "",
      row.containerNo || "",
      handoverWithFume(row).join("\n"),
      sheetProduct(row),
      row.trailer || "",
      sheetWorker(row.assignee),
    ];
    return cols.map(tsvCell).join("\t");
  });
  return [head.join("\t"), ...body].join("\n");
}

function tsvCell(value) {
  const s = String(value || "");
  if (/[\t\n"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const SHEET_FONT = '"Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif';

function sheetCells(row) {
  const handover = handoverLines(row).map((t) => ({ t, c: "#dc2626", b: true }));
  const fume = fumeHoldLine(row);
  return [
    [{ t: row?.uha || "", c: "#0f172a", b: true }],
    [{ t: row?.containerNo || "", c: "#334155", b: false }],
    fume ? [...handover, { t: fume, c: "#b45309", b: true }] : handover.length ? handover : [{ t: "", c: "#dc2626", b: true }],
    [{ t: sheetProduct(row), c: "#0f172a", b: false }],
    [{ t: row?.trailer || "", c: "#0f172a", b: false }],
    [{ t: sheetWorker(row?.assignee), c: "#6d28d9", b: true }],
  ];
}

function paintFont(ctx, bold, size) {
  ctx.font = `${bold ? 800 : 600} ${size}px ${SHEET_FONT}`;
}

function wrapText(ctx, text, max, bold, size) {
  const s = String(text || "");
  paintFont(ctx, bold, size);
  if (!s || ctx.measureText(s).width <= max) return [s];
  const out = [];
  let cur = "";
  for (const ch of s) {
    const next = cur + ch;
    if (cur && ctx.measureText(next).width > max) {
      out.push(cur);
      cur = ch;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out.length ? out : [s];
}

/** 目前這張交貨清單畫成圖，給 LINE 直接貼上。 */
export function sheetImageBlob(rows, title) {
  const head = ["編號", "貨櫃號碼", "交貨資料", "品項/件數", "拖車", "領櫃日"];
  const minW = [88, 148, 168, 96, 72, 72];
  const maxW = [130, 210, 340, 180, 110, 100];
  const size = 15;
  const lineH = 22;
  const padX = 12;
  const padY = 8;
  const measure = document.createElement("canvas").getContext("2d");
  const colW = head.map((lab, i) => {
    paintFont(measure, true, size);
    const w = Math.ceil(measure.measureText(lab).width) + padX * 2;
    return Math.min(maxW[i], Math.max(minW[i], w));
  });
  const body = (rows || []).map((row) => sheetCells(row));
  for (const cells of body) {
    cells.forEach((lines, i) => {
      for (const line of lines) {
        paintFont(measure, line.b, size);
        const w = Math.ceil(measure.measureText(line.t || "").width) + padX * 2;
        if (w > colW[i]) colW[i] = Math.min(maxW[i], w);
      }
    });
  }
  const inner = colW.map((w) => w - padX * 2);
  const painted = body.map((cells) =>
    cells.map((lines, i) => lines.flatMap((line) => wrapText(measure, line.t, inner[i], line.b, size).map((t) => ({ t, c: line.c, b: line.b })))),
  );
  const headH = 36;
  const titleH = title ? 44 : 16;
  const rowH = painted.map((cells) => {
    const n = Math.max(1, ...cells.map((lines) => lines.length));
    return padY * 2 + n * lineH;
  });
  const width = colW.reduce((s, w) => s + w, 0) + 2;
  const height = titleH + headH + rowH.reduce((s, h) => s + h, 0) + 2;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  if (title) {
    paintFont(ctx, true, 18);
    ctx.fillStyle = "#0f172a";
    ctx.textBaseline = "middle";
    ctx.fillText(title, 14, titleH / 2 + 2);
  }
  let x = 1;
  let y = titleH;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(1, y, width - 2, headH);
  paintFont(ctx, true, size);
  ctx.fillStyle = "#334155";
  ctx.textBaseline = "middle";
  head.forEach((lab, i) => {
    ctx.fillText(lab, x + padX, y + headH / 2);
    x += colW[i];
  });
  y += headH;
  painted.forEach((cells, ri) => {
    const h = rowH[ri];
    if (ri % 2 === 1) {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(1, y, width - 2, h);
    }
    x = 1;
    cells.forEach((lines, i) => {
      lines.forEach((line, li) => {
        paintFont(ctx, line.b, size);
        ctx.fillStyle = line.c;
        ctx.textBaseline = "middle";
        ctx.fillText(line.t, x + padX, y + padY + lineH * li + lineH / 2);
      });
      x += colW[i];
    });
    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(1, y + h);
    ctx.lineTo(width - 1, y + h);
    ctx.stroke();
    y += h;
  });
  ctx.strokeStyle = "#e2e8f0";
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
