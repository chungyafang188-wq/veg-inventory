function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M7 7h10M7 12h6M6 3h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="m-0 text-sm font-medium text-slate-500">目前沒有資料</p>
      <p className="m-0 text-xs text-slate-400">點上方功能開始建檔，或稍後再回來查看</p>
    </div>
  );
}

export function TablePane({ title, hint, columns, rows, onOpen }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      {title ? <h2 className="m-0 text-xl font-bold text-slate-800">{title}</h2> : null}
      {hint ? <p className={`m-0 text-xs text-slate-400 ${title ? "mt-1" : ""}`}>{hint}</p> : null}
      <div className={title || hint ? "mt-4" : ""}>
        {!rows?.length ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80">
                  {columns.map((c) => (
                    <th key={c} className="px-3 py-2.5 text-xs font-semibold text-slate-500">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-emerald-50/50"
                    onClick={() => onOpen?.(r.key)}
                  >
                    {r.cells.map((cell, i) => (
                      <td key={i} className="px-3 py-2.5 align-top text-slate-700">
                        {cell || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
