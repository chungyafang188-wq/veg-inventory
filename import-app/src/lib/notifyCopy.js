import { formatMd, parseDateTimePart } from "./dateChip";

function clock(v) {
  const p = parseDateTimePart(v);
  if (!p || p.hh == null) return "";
  return `${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
}

function unpackWhen(row) {
  const unpack = String(row?.unpackAt || "").trim();
  const pickup = String(row?.pickupDay || "").trim();
  const md = formatMd(unpack || pickup);
  const time = row?.unpackShift ? "上班領" : unpack ? clock(unpack) : "";
  if (md && time) return `${md} ${time}`;
  if (md) return `${md} 尚缺時間`;
  return "尚缺";
}

function unpackPlace(row) {
  const site = String(row?.unpackSite || "").trim();
  const site2 = String(row?.unpackSite2 || "").trim();
  if (row?.halfSplit || site2) return [site || "尚缺", site2 || "尚缺"].join("、");
  return site || "尚缺";
}

function trailerVehicle(row) {
  const name = String(row?.trailer || "").trim();
  const extra = String(row?.trailerNote || "").trim();
  if (name && extra) return `${name} ${extra}`;
  return name || extra || "尚缺";
}

function unpackWorkers(row) {
  const names = [row?.assignee, row?.assignee2].map((v) => String(v || "").trim()).filter(Boolean);
  return names.length ? names.join("、") : "尚缺";
}

/** 貼給客戶：拆卸時間、拆卸位置、拖車車輛 */
export function customerNoticeText(row) {
  const product = String(row?.product || "").trim();
  const no = String(row?.containerNo || row?.uha || "").trim();
  const note = String(row?.note || "").trim();
  const lines = [];
  if (product) lines.push(product);
  if (no) lines.push(no);
  const who = String(row?.deliverTo || "").trim();
  if (who) lines.push(`交貨對象：${who}`);
  lines.push(`拆卸時間：${unpackWhen(row)}`);
  lines.push(`拆卸位置：${unpackPlace(row)}`);
  lines.push(`拖車：${trailerVehicle(row)}`);
  if (note) lines.push(note.startsWith("(") || note.startsWith("（") ? note : `(${note})`);
  return lines.join("\n");
}

/** 貼給拖車：拆卸時間、拆卸位置、拆工人員 */
export function trailerNoticeText(row) {
  const product = String(row?.product || "").trim();
  const no = String(row?.containerNo || row?.uha || "").trim();
  const lines = [];
  if (no) lines.push(no);
  if (product) lines.push(product);
  lines.push(`拆卸時間：${unpackWhen(row)}`);
  lines.push(`拆卸位置：${unpackPlace(row)}`);
  lines.push(`拆工：${unpackWorkers(row)}`);
  return lines.join("\n");
}

/** 貼給拆工：編號、櫃號、品項、拆卸日、拆卸位置、拖車、拖車電話。 */
export function workerNoticeText(row) {
  const at = String(row?.unpackAt || row?.day || "").trim();
  const md = formatMd(at);
  let day = "";
  if (md && row?.unpackShift) day = `${md} 上班領`;
  else if (md && clock(at)) day = `${md} ${clock(at)}`;
  else day = md;
  return [
    `編號：${String(row?.uha || "").trim()}`,
    `櫃號：${String(row?.containerNo || "").trim()}`,
    `品項：${String(row?.product || row?.name || "").trim()}`,
    `拆卸日：${day}`,
    `拆卸位置：${String(row?.location || row?.unpackSite || "").trim()}`,
    `拖車：${String(row?.trailer || "").trim()}`,
    `拖車電話：${String(row?.trailerPhone || "").trim()}`,
  ].join("\n");
}

/** 拆櫃日或位置還沒有時，先不要複製。 */
export function pasteGaps(row) {
  const gaps = [];
  if (!String(row?.unpackAt || "").trim() && !String(row?.pickupDay || "").trim()) gaps.push("拆櫃日");
  if (!String(row?.unpackSite || "").trim()) gaps.push("位置");
  return gaps;
}

export function noticeBundle(rows, kind) {
  const write = kind === "customer" ? customerNoticeText : trailerNoticeText;
  return (rows || [])
    .map(write)
    .filter(Boolean)
    .join("\n\n");
}
