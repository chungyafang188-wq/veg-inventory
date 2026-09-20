import { useMemo, useState } from "react";
import { TablePane } from "./TablePane";

const chipIdle = "imp-chip flex-shrink-0";
const chipOn = "imp-chip imp-chip-on flex-shrink-0";

function ftSortKey(cell) {
  const s = String(cell || "");
  if (!s || s === "—") return "9999-99-99";
  if (s === "已確認") return "0000-00-00";
  const m = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  return s;
}

function uhaSortKey(cell) {
  const s = String(cell || "").toUpperCase();
  const m = s.match(/^(UHA|NC)(\d+)/);
  if (m) return `${m[1]}${String(m[2]).padStart(6, "0")}`;
  return s;
}

/** 已放行：編號／貨櫃號碼／FT；可依編號或 FT 排序（不顯示到港日） */
export function ReleasePane({ title, releaseTab, setReleaseTab, counts, rows, openDrawer }) {
  const [sortBy, setSortBy] = useState("uha"); // uha | ft

  const sorted = useMemo(() => {
    const list = [...(rows || [])];
    list.sort((a, b) => {
      if (sortBy === "ft") {
        const fa = ftSortKey(a.cells?.[2]);
        const fb = ftSortKey(b.cells?.[2]);
        if (fa !== fb) return fa < fb ? -1 : 1;
      }
      return uhaSortKey(a.cells?.[0]).localeCompare(uhaSortKey(b.cells?.[0]), "en");
    });
    return list;
  }, [rows, sortBy]);

  return (
    <div className="grid gap-2.5">
      <div className="flex w-full flex-row gap-2 overflow-x-auto whitespace-nowrap p-0.5 touch-pan-x" role="tablist" aria-label="已放行狀態">
        {[
          ["open", "全部", counts?.open],
          ["arrange", "待排拆櫃", counts?.arrange],
          ["pickup", "可排拆櫃", counts?.pickup],
        ].map(([id, lab, count]) => (
          <button key={id} type="button" className={releaseTab === id ? chipOn : chipIdle} onClick={() => setReleaseTab(id)}>
            {lab}
            <span className="ml-1 tabular-nums opacity-80">{count ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 px-0.5">
        <span className="text-[0.75rem] font-semibold text-slate-500">排序</span>
        <button
          type="button"
          className={`rounded-lg px-2.5 py-1 text-[0.78rem] font-semibold ${sortBy === "uha" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}
          onClick={() => setSortBy("uha")}
        >
          編號
        </button>
        <button
          type="button"
          className={`rounded-lg px-2.5 py-1 text-[0.78rem] font-semibold ${sortBy === "ft" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}
          onClick={() => setSortBy("ft")}
        >
          FT
        </button>
      </div>
      <TablePane
        title={title}
        hint="已放行未拆櫃：編號、貨櫃號碼、FT（不顯示到港日）。點列可排拆櫃。"
        columns={["編號", "貨櫃號碼", "FT"]}
        rows={sorted}
        onOpen={(key) => openDrawer("release", key)}
      />
    </div>
  );
}
