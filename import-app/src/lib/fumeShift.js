import { formatMd, formatMdHm } from "./dateChip";

/** 煙燻班次固定四班，不再填鐘點。 */
export const FUME_SHIFTS = [
  { id: "1", lab: "第一班" },
  { id: "2", lab: "第二班" },
  { id: "3", lab: "第三班" },
  { id: "4", lab: "第四班" },
];

export function fumeShiftLab(id) {
  const hit = FUME_SHIFTS.find((s) => s.id === String(id || "").trim());
  return hit ? hit.lab : "";
}

/** 日期＋班次。舊資料只有鐘點、還沒改班次時，仍顯示原來的時間。 */
export function fumeWhenLab(at, shift) {
  const day = formatMd(at);
  const sh = fumeShiftLab(shift);
  if (day && sh) return `${day} ${sh}`;
  if (sh) return sh;
  if (!day) return "";
  const hm = formatMdHm(at);
  return hm && hm !== day ? hm : day;
}

/** 已放行後還不能提領：需要煙燻，或已排了煙燻日／班次，且尚未完成。 */
export function needsFumeHold(row) {
  const st = row?.fumigate || "none";
  if (st === "skip" || st === "done") return false;
  const at = String(row?.fumigateAt || "").trim();
  const sh = fumeShiftLab(row?.fumigateShift);
  return st === "wait" || !!at || !!sh;
}
