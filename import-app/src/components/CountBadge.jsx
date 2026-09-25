/** 頂部分頁要顯示積壓數的 id */
export const TAB_COUNT_IDS = new Set(["track", "parse", "port", "release", "upBoard", "unpack", "sum", "stock"]);

export function CountBadge({ count, warn = false, title }) {
  const n = Number(count) || 0;
  const cls = warn && n > 0 ? "imp-count-badge imp-count-badge-warn" : "imp-count-badge";
  const label = title || `數量 ${n}`;
  return (
    <span className={cls} title={title || undefined} aria-label={label}>
      {n}
    </span>
  );
}
