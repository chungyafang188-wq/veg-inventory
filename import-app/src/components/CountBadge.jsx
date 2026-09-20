/** 頂部分頁要顯示積壓數的 id */
export const TAB_COUNT_IDS = new Set(["parse", "port", "release", "checklist", "upBoard", "unpack", "sum", "stock"]);

export function CountBadge({ count, warn = false }) {
  const n = Number(count) || 0;
  const cls = warn && n > 0 ? "imp-count-badge imp-count-badge-warn" : "imp-count-badge";
  return (
    <span className={cls} aria-label={`數量 ${n}`}>
      {n}
    </span>
  );
}
