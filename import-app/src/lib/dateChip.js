/** 日期／時間顯示與 FT 緊迫度（預設隱藏 2026 年） */

export function parseDayPart(v) {
  const s = String(v || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]), raw: `${m[1]}-${m[2]}-${m[3]}` };
  return null;
}

export function parseDateTimePart(v) {
  const s = String(v || "").trim().replace(" ", "T");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return null;
  return {
    y: Number(m[1]),
    mo: Number(m[2]),
    d: Number(m[3]),
    hh: m[4] != null ? Number(m[4]) : null,
    mm: m[5] != null ? Number(m[5]) : null,
    day: `${m[1]}-${m[2]}-${m[3]}`,
    at: m[4] != null ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : `${m[1]}-${m[2]}-${m[3]}`,
  };
}

/** MM/DD（隱藏年份） */
export function formatMd(v) {
  const p = parseDayPart(v) || parseDateTimePart(v);
  if (!p) return "";
  return `${p.mo}/${p.d}`;
}

/** MM/DD HH:mm */
export function formatMdHm(v) {
  const p = parseDateTimePart(v);
  if (!p) return "";
  if (p.hh == null) return `${p.mo}/${p.d}`;
  return `${p.mo}/${p.d} ${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
}

export function toDateInput(v) {
  const p = parseDayPart(v) || parseDateTimePart(v);
  return p?.day || p?.raw || "";
}

export function toDateTimeInput(v) {
  const p = parseDateTimePart(v);
  if (!p) return "";
  if (p.hh == null) return `${p.day}T09:00`;
  return `${p.day}T${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
}

export function addDaysYmd(ymd, delta) {
  const p = parseDayPart(ymd);
  if (!p) return "";
  const dt = new Date(p.y, p.mo - 1, p.d);
  dt.setDate(dt.getDate() + delta);
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** 是否已到指定日（含當天；以本地 0 點比對） */
export function isDayReached(ymd) {
  const p = parseDayPart(ymd) || parseDateTimePart(ymd);
  if (!p) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(p.y, p.mo - 1, p.d);
  return day.getTime() <= today.getTime();
}
  const p = parseDayPart(ftAt) || parseDateTimePart(ftAt);
  if (!p) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ft = new Date(p.y, p.mo - 1, p.d);
  return Math.round((ft - today) / 86400000);
}

/**
 * FT 緊迫度：過期或剩<=2 → urgent；剩 3~4 → warn；其餘 ok
 */
export function ftUrgency(ftAt) {
  const left = ftDaysLeft(ftAt);
  if (left == null) return { kind: "none", left: null, lab: "", cls: "" };
  if (left <= 2) return { kind: "urgent", left, lab: left < 0 ? "過期" : "急件", cls: "bg-red-100 text-red-700" };
  if (left <= 4) return { kind: "warn", left, lab: "預警", cls: "bg-amber-100 text-amber-800" };
  return { kind: "ok", left, lab: `剩${left}天`, cls: "bg-slate-100 text-slate-600" };
}

/** 領櫃日預設：FT 前一天 */
export function defaultPickupFromFt(ftAt) {
  const day = toDateInput(ftAt);
  return day ? addDaysYmd(day, -1) : "";
}
