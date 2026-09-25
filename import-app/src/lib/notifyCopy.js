import { formatMd, parseDateTimePart } from "./dateChip";

function clock(v) {
  const p = parseDateTimePart(v);
  if (!p || p.hh == null) return "";
  return `${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
}

function scheduleOf(row) {
  const unpack = String(row?.unpackAt || "").trim();
  const pickup = String(row?.pickupDay || "").trim();
  const ft = String(row?.ftAt || "").trim();
  const src = unpack || pickup || ft;
  const shift = !!row?.unpackShift;
  return { md: formatMd(src), time: shift ? "上班領" : unpack ? clock(unpack) : "" };
}

/** 貼給客戶，對齊群組裡的寫法 */
export function customerNoticeText(row) {
  const { md, time } = scheduleOf(row);
  const product = String(row?.product || "").trim();
  const no = String(row?.containerNo || row?.uha || "").trim();
  const site = String(row?.unpackSite || "").trim();
  const note = String(row?.note || "").trim();
  const lines = [];
  if (md) lines.push(md);
  if (product) lines.push(product);
  if (no) lines.push(no);
  if (md && time && site) lines.push(`${md} ${time}/ ${site}`);
  else if (md && site) lines.push(`${md}/ ${site}`);
  else if (md && time) lines.push(`${md} ${time}`);
  else if (site) lines.push(site);
  if (note) lines.push(note.startsWith("(") || note.startsWith("（") ? note : `(${note})`);
  return lines.join("\n");
}

/** 貼給拖車 */
export function trailerNoticeText(row) {
  const { md, time } = scheduleOf(row);
  const product = String(row?.product || "").trim();
  const no = String(row?.containerNo || row?.uha || "").trim();
  const site = String(row?.unpackSite || "").trim();
  const lines = [];
  if (no) lines.push(no);
  if (product) lines.push(product);
  if (md) lines.push(time ? `請安排${md}，${time}到` : `請安排${md}`);
  if (site) lines.push(site);
  return lines.join("\n");
}

export function noticeBundle(rows, kind) {
  const write = kind === "customer" ? customerNoticeText : trailerNoticeText;
  return (rows || [])
    .map(write)
    .filter(Boolean)
    .join("\n\n");
}
