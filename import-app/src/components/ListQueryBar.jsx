/**
 * 共用搜尋＋排序列（海關查驗／已放行／現場拆櫃）
 */
export function ListQueryBar({
  query,
  onQuery,
  sortBy,
  onSort,
  sortOpts = [],
  placeholder = "搜尋編號、櫃號、品名…",
  resultCount,
  totalCount,
}) {
  const showCount = typeof resultCount === "number" && typeof totalCount === "number" && normalize(query);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-[12rem] flex-1">
        <span className="sr-only">搜尋</span>
        <input
          type="search"
          className="imp-field w-full pl-2 pr-8"
          value={query}
          placeholder={placeholder}
          onChange={(e) => onQuery?.(e.target.value)}
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1.5 text-[0.7rem] font-bold text-slate-400 hover:text-slate-700"
            onClick={() => onQuery?.("")}
            aria-label="清除搜尋"
          >
            清除
          </button>
        ) : null}
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[0.7rem] font-bold text-slate-400">排序</span>
        {sortOpts.map((o) => (
          <button
            key={o.id}
            type="button"
            className={sortBy === o.id ? "imp-btn-primary" : "imp-btn-ghost"}
            onClick={() => onSort?.(o.id)}
          >
            {o.lab}
          </button>
        ))}
      </div>
      {showCount ? (
        <span className="ml-auto text-xs text-slate-400">
          顯示 {resultCount}／{totalCount}
        </span>
      ) : null}
    </div>
  );
}

function normalize(q) {
  return String(q || "").trim();
}
