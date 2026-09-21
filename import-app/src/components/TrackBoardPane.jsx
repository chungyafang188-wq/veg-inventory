import { useMemo, useState } from "react";
import { inspectFumeSummary, trackNextStep, trackStageBadge } from "../lib/trackNext";
import { queryRows } from "../lib/listQuery";

const chipIdle = "imp-chip flex-shrink-0";
const chipOn = "imp-chip imp-chip-on flex-shrink-0";

const SEARCH_FIELDS = ["uha", "containerNo", "product", "dock", "trailer", "assignee", "stageLab", "status"];

/**
 * 第 1 階段貨櫃追蹤：只讀列表＋下一步＋搜尋；處理進海關／已放行。
 */
export function TrackBoardPane({ title, rows, counts, setActiveTab, openDrawer }) {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(() => new Set());

  const filtered = useMemo(() => {
    let list = rows || [];
    if (tab === "customs") list = list.filter((r) => r.trackFilter === "customs");
    else if (tab === "arrange") list = list.filter((r) => r.trackFilter === "arrange");
    else if (tab === "arranged") list = list.filter((r) => r.trackFilter === "arranged");
    return queryRows(list, {
      query,
      sortBy: "uha",
      fields: SEARCH_FIELDS,
      getters: {
        uha: (r) => r.uha || r.key,
      },
    });
  }, [rows, tab, query]);

  const stats = counts || {
    all: (rows || []).length,
    customs: (rows || []).filter((r) => r.trackFilter === "customs").length,
    arrange: (rows || []).filter((r) => r.trackFilter === "arrange").length,
    arranged: (rows || []).filter((r) => r.trackFilter === "arranged").length,
  };

  const allPicked = !!filtered.length && filtered.every((r) => picked.has(r.uha || r.key));

  const toggle = (uha) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(uha)) next.delete(uha);
      else next.add(uha);
      return next;
    });
  };

  const toggleAll = () => {
    setPicked((prev) => {
      if (filtered.every((r) => prev.has(r.uha || r.key)) && filtered.length) return new Set();
      return new Set(filtered.map((r) => r.uha || r.key));
    });
  };

  const goHandle = (r) => {
    const uha = r.uha || r.key;
    const dest = r.dest === "release" || r.released ? "release" : "port";
    // 留在追蹤頁，用抽屜編這櫃（避免跳進舊清單整表）
    openDrawer?.(dest, uha);
  };

  const tabs = [
    ["all", "全部", stats.all],
    ["customs", "報關／檢疫", stats.customs],
    ["arrange", "待排", stats.arrange],
    ["arranged", "已排櫃", stats.arranged],
  ];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 pb-3 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="m-0 text-xl font-bold text-slate-800">{title || "貨櫃追蹤"}</h2>
            <p className="mt-1 m-0 text-xs text-slate-400">
              先看階段與下一步；點「處理」開單櫃表單（不離開本頁）。左側「海關查驗／已放行」才是舊整表。
            </p>
          </div>
          <button type="button" className="imp-btn-primary" onClick={() => setActiveTab?.("port")}>
            ＋ 新增／查驗
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["全部在追", stats.all, ""],
            ["報關／檢疫", stats.customs, ""],
            ["待排", stats.arrange, "text-amber-700"],
            ["已排櫃", stats.arranged, "text-emerald-700"],
          ].map(([lab, n, cls]) => (
            <div key={lab} className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5">
              <div className={`text-xl font-extrabold tabular-nums ${cls}`}>{n ?? 0}</div>
              <div className="text-[0.7rem] font-semibold text-slate-500">{lab}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {tabs.map(([id, lab, count]) => (
              <button key={id} type="button" className={tab === id ? chipOn : chipIdle} onClick={() => setTab(id)}>
                {lab}
                <span className="ml-1 tabular-nums opacity-80">{count ?? 0}</span>
              </button>
            ))}
          </div>
          <input
            type="search"
            className="imp-field min-w-[12rem] flex-1 md:max-w-xs"
            placeholder="搜尋編號、櫃號、品名、拖車、拆工…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="搜尋貨櫃"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2 text-xs text-slate-500">
        <label className="flex cursor-pointer items-center gap-1.5 font-semibold text-slate-600">
          <input type="checkbox" checked={allPicked} onChange={toggleAll} disabled={!filtered.length} />
          全選本頁
        </label>
        <span className="text-slate-400">列表只讀 · 已選 {picked.size} 筆（批量通知之後接）</span>
      </div>

      <div className="px-2 py-2 sm:px-3">
        {!filtered.length ? (
          <p className="m-0 py-12 text-center text-sm text-slate-400">
            {(rows || []).length ? "沒有符合搜尋／篩選的貨櫃" : "目前沒有追蹤中的貨櫃"}
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200/80 md:block">
              <table className="w-full min-w-[52rem] table-fixed border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100">
                    <th className="w-[3rem] px-2 py-2 text-center" />
                    <th className="px-2 py-2 text-left text-[0.7rem] font-bold text-slate-600">單號／櫃號</th>
                    <th className="px-2 py-2 text-left text-[0.7rem] font-bold text-slate-600">品名</th>
                    <th className="px-2 py-2 text-left text-[0.7rem] font-bold text-slate-600">階段</th>
                    <th className="px-2 py-2 text-left text-[0.7rem] font-bold text-slate-600">藥檢／薰蒸</th>
                    <th className="px-2 py-2 text-left text-[0.7rem] font-bold text-slate-600">下一步</th>
                    <th className="w-[5.5rem] px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const uha = r.uha || r.key;
                    const st = trackStageBadge(r);
                    const next = trackNextStep(r);
                    const clear = inspectFumeSummary(r);
                    return (
                      <tr
                        key={uha}
                        className="cursor-pointer border-b border-slate-100 odd:bg-white even:bg-slate-50/40 hover:bg-teal-50/40"
                        onClick={() => goHandle(r)}
                      >
                        <td className="px-2 py-2 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={picked.has(uha)} onChange={() => toggle(uha)} aria-label={`選取 ${uha}`} />
                        </td>
                        <td className="px-2 py-2">
                          <div className="font-bold tabular-nums text-slate-800">{uha}</div>
                          <div className="font-mono text-[0.7rem] text-slate-400">{r.containerNo || "無櫃號"}</div>
                        </td>
                        <td className="px-2 py-2 font-semibold text-slate-800">{r.product || "—"}</td>
                        <td className="px-2 py-2">
                          <span className={`inline-flex rounded px-1.5 py-0.5 text-[0.65rem] font-bold ${st.cls}`}>{st.lab}</span>
                        </td>
                        <td className="px-2 py-2 text-[0.78rem] text-slate-600">
                          <div>{clear.inspLab}</div>
                          <div className="text-slate-400">{clear.fumeLab}</div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="text-[0.8rem] font-bold text-teal-800">{next.lab}</div>
                          {next.hint ? <div className="text-[0.68rem] text-slate-400">{next.hint}</div> : null}
                        </td>
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="imp-btn-primary px-2 py-1 text-xs" onClick={() => goHandle(r)}>
                            處理
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="m-0 grid list-none gap-2 p-0 md:hidden">
              {filtered.map((r) => {
                const uha = r.uha || r.key;
                const st = trackStageBadge(r);
                const next = trackNextStep(r);
                const clear = inspectFumeSummary(r);
                return (
                  <li key={uha} className="rounded-xl border border-slate-200/90 bg-white">
                    <div className="flex items-start gap-2 px-3 py-2.5">
                      <label className="mt-1" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={picked.has(uha)} onChange={() => toggle(uha)} />
                      </label>
                      <button type="button" className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left" onClick={() => goHandle(r)}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <strong className="tabular-nums text-slate-800">{uha}</strong>
                          <span className={`inline-flex rounded px-1.5 py-0.5 text-[0.65rem] font-bold ${st.cls}`}>{st.lab}</span>
                        </div>
                        <div className="mt-0.5 font-mono text-xs text-slate-400">{r.containerNo || "無櫃號"}</div>
                        <p className="m-0 mt-1 text-sm font-semibold text-slate-800">{r.product || "—"}</p>
                        <p className="m-0 mt-1 text-xs text-slate-500">
                          {clear.inspLab} · {clear.fumeLab}
                        </p>
                        <p className="m-0 mt-1.5 text-sm font-bold text-teal-800">{next.lab}</p>
                        {next.hint ? <p className="m-0 text-[0.7rem] text-slate-400">{next.hint}</p> : null}
                      </button>
                      <button type="button" className="imp-btn-primary shrink-0 px-2 py-1 text-xs" onClick={() => goHandle(r)}>
                        處理
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
