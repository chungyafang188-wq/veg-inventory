import { useMemo, useState } from "react";
import { api } from "../bridge";
import { DateChip } from "./DateChip";
import { inspectFumeSummary, trackNextStep, trackStageBadge } from "../lib/trackNext";
import { defaultPickupFromFt } from "../lib/dateChip";
import { queryRows } from "../lib/listQuery";

const chipIdle = "imp-chip flex-shrink-0";
const chipOn = "imp-chip imp-chip-on flex-shrink-0";

const SEARCH_FIELDS = ["uha", "containerNo", "product", "dock", "trailer", "assignee", "stageLab", "status"];

function NextFill({ row, trailers = [], unpackers = [], onPatched }) {
  const uha = row.uha || row.key;
  const next = trackNextStep(row);
  const saveRelease = (field, value) => {
    api().patchReleaseField?.(uha, field, value);
    onPatched?.();
  };
  const savePort = (field, value) => {
    api().patchPortField?.(uha, field, value);
    onPatched?.();
  };

  let control = null;
  if (next.step === "inspectAt") {
    control = (
      <DateChip mode="datetime" value={row.inspectAt || ""} emptyLab="出報告日" ariaLabel="出報告日" onChange={(v) => savePort("inspectAt", v)} />
    );
  } else if (next.step === "fumigateAt") {
    control = (
      <DateChip mode="datetime" value={row.fumigateAt || ""} emptyLab="薰蒸時間" ariaLabel="薰蒸安排時間" onChange={(v) => savePort("fumigateAt", v)} />
    );
  } else if (next.step === "missing") {
    control = (
      <div className="flex flex-wrap gap-1">
        {row.missingTelex ? (
          <button type="button" className="imp-btn-ghost px-2 py-1 text-xs" onClick={() => savePort("missingTelex", false)}>
            電放已齊
          </button>
        ) : null}
        {row.missingData ? (
          <button type="button" className="imp-btn-ghost px-2 py-1 text-xs" onClick={() => savePort("missingData", false)}>
            資料已齊
          </button>
        ) : null}
      </div>
    );
  } else if (next.step === "release") {
    control = (
      <button
        type="button"
        className="imp-btn-primary px-2 py-1 text-xs"
        onClick={() => {
          api().markPortReleased?.(uha);
          api().setHostPane?.("track");
          onPatched?.();
        }}
      >
        標示放行
      </button>
    );
  } else if (next.step === "ft") {
    control = (
      <DateChip
        value={row.ftAt || ""}
        prefix="FT"
        emptyLab="填 FT"
        ariaLabel="免堆期 FT"
        onChange={(v) => {
          const day = String(v || "").slice(0, 10);
          api().patchReleaseField?.(uha, "ftAt", day);
          if (day && !String(row.pickupDay || "").trim()) {
            const def = defaultPickupFromFt(day);
            if (def) api().patchReleaseField?.(uha, "pickupDay", def);
          }
          onPatched?.();
        }}
      />
    );
  } else if (next.step === "pickup") {
    control = (
      <DateChip value={row.pickupDay || ""} emptyLab="填領櫃日" ariaLabel="領櫃日" onChange={(v) => saveRelease("pickupDay", String(v || "").slice(0, 10))} />
    );
  } else if (next.step === "trailer") {
    control = (
      <select className="imp-field w-auto max-w-[8rem]" aria-label="拖車" value={row.trailer || ""} onChange={(e) => saveRelease("trailer", e.target.value)}>
        <option value="">選拖車</option>
        {trailers.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    );
  } else if (next.step === "unpackAt") {
    const shift = !!row.unpackShift;
    control = (
      <div className="flex flex-wrap items-center gap-1">
        <DateChip
          mode={shift ? "date" : "datetime"}
          value={row.unpackAt || ""}
          emptyLab={shift ? "拆櫃日" : "拆櫃時間"}
          ariaLabel="拆櫃時間"
          onChange={(v) => saveRelease("unpackAt", shift ? String(v || "").slice(0, 10) : v)}
        />
        <button
          type="button"
          className={shift ? "imp-chip imp-chip-warn flex-shrink-0" : "imp-chip flex-shrink-0"}
          onClick={() => {
            const nextOn = !shift;
            api().patchReleaseField?.(uha, "unpackShift", nextOn);
            if (nextOn) {
              const day = String(row.unpackAt || row.pickupDay || "").slice(0, 10);
              if (/^\d{4}-\d{2}-\d{2}$/.test(day)) api().patchReleaseField?.(uha, "unpackAt", day);
            }
            onPatched?.();
          }}
        >
          上班領
        </button>
      </div>
    );
  } else if (next.step === "unpackSite") {
    control = (
      <input
        className="imp-field w-auto max-w-[9rem]"
        list="imp-track-sites"
        placeholder="拆卸位置"
        aria-label="拆卸位置"
        onBlur={(e) => {
          const v = String(e.target.value || "").trim();
          if (v) saveRelease("unpackSite", v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    );
  } else if (next.step === "assignee") {
    control = (
      <select className="imp-field w-auto max-w-[8rem]" aria-label="拆工" value={row.assignee || ""} onChange={(e) => saveRelease("assignee", e.target.value)}>
        <option value="">選拆工</option>
        {unpackers.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    );
  } else if (next.step === "dispatch") {
    control = (
      <button
        type="button"
        className="imp-btn-primary px-2 py-1 text-xs"
        onClick={() => {
          const ok = api().dispatchRelease?.(uha);
          onPatched?.();
          if (!ok) return;
        }}
      >
        派工
      </button>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="text-[0.72rem] font-bold text-teal-800">{next.lab}</div>
      {next.hint ? <div className="text-[0.68rem] text-slate-400">{next.hint}</div> : null}
      {control ? <div className="mt-1">{control}</div> : null}
    </div>
  );
}

/**
 * 貨櫃追蹤：每一列直接填目前這一步。
 */
export function TrackBoardPane({ title, rows, counts, setActiveTab, openDrawer, refresh, trailers = [], unpackers = [] }) {
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
    ["arrange", "待排櫃", stats.arrange],
    ["arranged", "已排櫃", stats.arranged],
  ];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 pb-3 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="m-0 text-xl font-bold text-slate-800">{title || "貨櫃追蹤"}</h2>
            <p className="mt-1 m-0 text-xs text-slate-400">在這一列填目前要填的那一項。填完會換成下一項。完整資料按「處理」。</p>
          </div>
          <button type="button" className="imp-btn-primary" onClick={() => setActiveTab?.("port")}>
            ＋ 新增／查驗
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["all", "全部在追", stats.all, "border-slate-200/80 bg-slate-50/80", "text-slate-800"],
            ["customs", "報關／檢疫", stats.customs, "border-slate-200/80 bg-slate-50/80", "text-slate-800"],
            ["arrange", "待排櫃", stats.arrange, stats.arrange > 0 ? "border-amber-500 bg-amber-400" : "border-slate-200/80 bg-slate-50/80", stats.arrange > 0 ? "text-amber-950" : "text-slate-800"],
            ["arranged", "已排櫃", stats.arranged, "border-slate-200/80 bg-slate-50/80", "text-emerald-700"],
          ].map(([id, lab, n, box, num]) => (
            <button
              key={id}
              type="button"
              className={`rounded-xl border px-3 py-2.5 text-left ${box} ${tab === id ? "ring-2 ring-amber-700" : ""}`}
              onClick={() => setTab(id)}
            >
              <div className={`text-xl font-extrabold tabular-nums ${num}`}>{n ?? 0}</div>
              <div className={`text-[0.7rem] font-semibold ${id === "arrange" && n > 0 ? "text-amber-950" : "text-slate-500"}`}>{lab}</div>
            </button>
          ))}
        </div>
        {stats.arrange > 0 ? (
          <button type="button" className="imp-remind" onClick={() => setTab("arrange")}>
            <span>
              <span className="imp-remind-n">待排櫃 {stats.arrange}</span>
              <span className="imp-remind-sub">已放行，還沒排上拆卸</span>
            </span>
            <span className="imp-remind-go">看這幾櫃</span>
          </button>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {tabs.map(([id, lab, count]) => (
              <button
                key={id}
                type="button"
                className={id === "arrange" && Number(count) > 0 ? "imp-chip imp-chip-warn flex-shrink-0" : tab === id ? chipOn : chipIdle}
                onClick={() => setTab(id)}
              >
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
        <span className="text-slate-400">下一步可直接填 · 已選 {picked.size} 筆</span>
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
                    const clear = inspectFumeSummary(r);
                    return (
                      <tr
                        key={uha}
                        className={`cursor-pointer border-b border-slate-100 hover:bg-teal-50/40 ${
                          r.trackFilter === "arrange" ? "bg-amber-100" : "odd:bg-white even:bg-slate-50/40"
                        }`}
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
                          <NextFill row={r} trailers={trailers} unpackers={unpackers} onPatched={refresh} />
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
                const clear = inspectFumeSummary(r);
                return (
                  <li key={uha} className={`rounded-xl border ${r.trackFilter === "arrange" ? "border-amber-500 bg-amber-100" : "border-slate-200/90 bg-white"}`}>
                    <div className="flex items-start gap-2 px-3 py-2.5">
                      <label className="mt-1" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={picked.has(uha)} onChange={() => toggle(uha)} />
                      </label>
                      <div className="min-w-0 flex-1">
                        <button type="button" className="w-full border-0 bg-transparent p-0 text-left" onClick={() => goHandle(r)}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <strong className="tabular-nums text-slate-800">{uha}</strong>
                            <span className={`inline-flex rounded px-1.5 py-0.5 text-[0.65rem] font-bold ${st.cls}`}>{st.lab}</span>
                          </div>
                          <div className="mt-0.5 font-mono text-xs text-slate-400">{r.containerNo || "無櫃號"}</div>
                          <p className="m-0 mt-1 text-sm font-semibold text-slate-800">{r.product || "—"}</p>
                          <p className="m-0 mt-1 text-xs text-slate-500">
                            {clear.inspLab} · {clear.fumeLab}
                          </p>
                        </button>
                        <div className="mt-1.5">
                          <NextFill row={r} trailers={trailers} unpackers={unpackers} onPatched={refresh} />
                        </div>
                      </div>
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
      <datalist id="imp-track-sites">
        {(api().deliverySiteHints?.() || []).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
