import { useMemo, useState } from "react";
import { clearLab } from "../constants";
import { ListQueryBar } from "./ListQueryBar";
import { queryRows, uhaSortKey } from "../lib/listQuery";

const COLS = [
  { id: "stage", lab: "階段" },
  { id: "uha", lab: "編號" },
  { id: "containerNo", lab: "櫃號" },
  { id: "arriveDay", lab: "到港日" },
  { id: "product", lab: "品名" },
  { id: "seller", lab: "賣方" },
  { id: "shipCo", lab: "船公司" },
  { id: "broker", lab: "報關行" },
  { id: "customsNo", lab: "報關單號" },
  { id: "inspectLab", lab: "藥檢" },
  { id: "inspectAt", lab: "藥檢時間" },
  { id: "fumigateLab", lab: "薰蒸" },
  { id: "fumigateAt", lab: "薰蒸時間" },
  { id: "dock", lab: "碼頭" },
  { id: "missingTelexLab", lab: "缺電放" },
  { id: "missingDataLab", lab: "缺資料" },
  { id: "note", lab: "備註" },
  { id: "trailer", lab: "拖車" },
  { id: "pickupDay", lab: "領櫃日" },
  { id: "status", lab: "狀態" },
];

const PRINT_COLS = COLS.filter((c) => !["seller", "shipCo", "broker", "customsNo"].includes(c.id));

const STAGE_OPTS = [
  { id: "all", lab: "全部" },
  { id: "port", lab: "待驗" },
  { id: "release", lab: "已放行" },
];

const SORT_OPTS = [
  { id: "uha", lab: "編號" },
  { id: "arriveDay", lab: "到港日" },
  { id: "stage", lab: "階段" },
  { id: "product", lab: "品名" },
];

function fmtAt(v) {
  const s = String(v || "");
  if (!s) return "";
  return s.replace("T", " ").slice(0, 16);
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename, headers, rows) {
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function rowKey(r) {
  return String(r.uha || r.key || "");
}

function toExportRows(list, cols) {
  return list.map((r) => {
    const o = {};
    cols.forEach((c) => {
      o[c.lab] = r[c.id] ?? "";
    });
    return o;
  });
}

function printPaper(list, title) {
  const day = new Date().toISOString().slice(0, 10);
  const cols = PRINT_COLS;
  const head = cols.map((c) => `<th>${c.lab}</th>`).join("");
  const body = list
    .map((r) => {
      const cells = cols
        .map((c) => {
          const v = r[c.id] ?? "";
          return `<td>${String(v || "—").replace(/</g, "&lt;")}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"/><title>${title}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: "Microsoft JhengHei", "Noto Sans TC", sans-serif; color: #111; font-size: 11px; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .meta { color: #555; margin-bottom: 10px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #333; padding: 3px 5px; text-align: left; vertical-align: top; }
  th { background: #eee; font-size: 10px; }
  td { font-size: 10px; }
</style></head><body>
  <h1>${title}</h1>
  <div class="meta">匯出日 ${day} · 共 ${list.length} 筆</div>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  <script>window.onload=function(){window.print();}</script>
</body></html>`;
  const w = window.open("", "_blank", "noopener,noreferrer,width=1100,height=700");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

/**
 * 查驗清單：匯入海關查驗／已放行全部狀態；可勾選編號或整批匯出紙本／Excel。
 */
export function ClearanceListPane({ title, rows, refresh, openDrawer }) {
  const [stage, setStage] = useState("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("uha");
  const [selected, setSelected] = useState(() => new Set());

  const prepared = useMemo(() => {
    return (rows || []).map((r) => ({
      ...r,
      inspectLab: clearLab(r.inspect, "inspect"),
      fumigateLab: clearLab(r.fumigate, "fumigate"),
      inspectAt: fmtAt(r.inspectAt),
      fumigateAt: fmtAt(r.fumigateAt),
      missingTelexLab: r.missingTelex ? "是" : "",
      missingDataLab: r.missingData ? "是" : "",
      stage: r.stage || (r.released ? "已放行" : "待驗"),
    }));
  }, [rows]);

  const staged = useMemo(() => {
    if (stage === "port") return prepared.filter((r) => r.stage === "待驗");
    if (stage === "release") return prepared.filter((r) => r.stage === "已放行");
    return prepared;
  }, [prepared, stage]);

  const viewed = useMemo(
    () =>
      queryRows(staged, {
        query,
        sortBy,
        fields: [
          "uha",
          "containerNo",
          "product",
          "seller",
          "shipCo",
          "broker",
          "customsNo",
          "dock",
          "note",
          "trailer",
          "stage",
          "inspectLab",
          "fumigateLab",
          "arriveDay",
          "pickupDay",
          "status",
        ],
        getters: {
          uha: (r) => uhaSortKey(r.uha),
          arriveDay: (r) => r.arriveDay || "",
          stage: (r) => r.stage || "",
          product: (r) => r.product || "",
        },
      }),
    [staged, query, sortBy],
  );

  const counts = useMemo(() => {
    const all = prepared.length;
    const port = prepared.filter((r) => r.stage === "待驗").length;
    const release = prepared.filter((r) => r.stage === "已放行").length;
    return { all, port, release };
  }, [prepared]);

  const viewedKeys = useMemo(() => viewed.map(rowKey).filter(Boolean), [viewed]);
  const selectedInView = viewedKeys.filter((k) => selected.has(k));
  const allViewSelected = viewedKeys.length > 0 && selectedInView.length === viewedKeys.length;

  const exportTarget = () => {
    if (selectedInView.length) return viewed.filter((r) => selected.has(rowKey(r)));
    return viewed;
  };

  const exportExcel = () => {
    const list = exportTarget();
    if (!list.length) return;
    const headers = COLS.map((c) => c.lab);
    const data = toExportRows(list, COLS);
    const day = new Date().toISOString().slice(0, 10);
    const tag = selectedInView.length ? `選取${list.length}筆` : `全部${list.length}筆`;
    downloadCsv(`查驗清單_${tag}_${day}.csv`, headers, data);
  };

  const exportPrint = () => {
    const list = exportTarget();
    if (!list.length) return;
    const tag = selectedInView.length ? `選取 ${list.length} 筆` : `目前列表 ${list.length} 筆`;
    const ok = printPaper(list, `${title || "查驗清單"}（${tag}）`);
    if (!ok && typeof alert === "function") alert("無法開啟列印視窗，請允許彈出視窗後再試。");
  };

  const toggleOne = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllView = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allViewSelected) {
        viewedKeys.forEach((k) => next.delete(k));
      } else {
        viewedKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  const clearSelected = () => setSelected(new Set());

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 pb-3 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="m-0 text-xl font-bold text-slate-800">{title || "查驗清單"}</h2>
            <p className="mt-1 m-0 text-xs text-slate-400">
              海關查驗／已放行狀態一覽。可勾選編號，或整批匯出 Excel／紙本。
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="imp-btn-ghost" onClick={exportPrint} disabled={!viewed.length}>
              {selectedInView.length ? `列印選取（${selectedInView.length}）` : "列印紙本"}
            </button>
            <button type="button" className="imp-btn-primary" onClick={exportExcel} disabled={!viewed.length}>
              {selectedInView.length ? `匯出選取（${selectedInView.length}）` : "匯出 Excel"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="階段篩選">
          {STAGE_OPTS.map((o) => (
            <button
              key={o.id}
              type="button"
              className={stage === o.id ? "imp-chip imp-chip-on" : "imp-chip"}
              onClick={() => setStage(o.id)}
            >
              {o.lab}
              <span className="ml-1 tabular-nums opacity-80">{counts[o.id] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="imp-btn-ghost text-xs" onClick={toggleAllView} disabled={!viewedKeys.length}>
            {allViewSelected ? "取消全選" : "全選目前列表"}
          </button>
          {selected.size ? (
            <button type="button" className="imp-btn-ghost text-xs" onClick={clearSelected}>
              清除選取（{selected.size}）
            </button>
          ) : null}
          {typeof refresh === "function" ? (
            <button type="button" className="imp-btn-ghost text-xs" onClick={refresh}>
              重新整理
            </button>
          ) : null}
        </div>

        <div className="mt-3">
          <ListQueryBar
            query={query}
            onQuery={setQuery}
            sortBy={sortBy}
            onSort={setSortBy}
            sortOpts={SORT_OPTS}
            placeholder="搜尋編號、櫃號、品名、賣方、碼頭、備註…"
            resultCount={viewed.length}
            totalCount={staged.length}
          />
        </div>
      </div>

      <div className="overflow-auto p-2 sm:p-3">
        {!viewed.length ? (
          <p className="m-0 py-12 text-center text-sm text-slate-400">
            {prepared.length ? "沒有符合條件的資料" : "尚無查驗紀錄（請先在海關查驗／已放行登錄）"}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full min-w-[80rem] border-collapse text-left text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100">
                  <th className="w-10 px-2 py-2">
                    <input
                      type="checkbox"
                      checked={allViewSelected}
                      onChange={toggleAllView}
                      aria-label="全選目前列表"
                    />
                  </th>
                  {COLS.map((c) => (
                    <th key={c.id} className="whitespace-nowrap px-2.5 py-2 text-[0.7rem] font-bold text-slate-600">
                      {c.lab}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewed.map((r) => {
                  const k = rowKey(r);
                  const on = selected.has(k);
                  return (
                    <tr
                      key={k}
                      className={`border-b border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-emerald-50/40 ${
                        on ? "bg-emerald-50/70" : ""
                      }`}
                    >
                      <td className="px-2 py-2 align-top">
                        <input type="checkbox" checked={on} onChange={() => toggleOne(k)} aria-label={`選取 ${k}`} />
                      </td>
                      {COLS.map((c) => (
                        <td
                          key={c.id}
                          className={`whitespace-nowrap px-2.5 py-2 align-top text-slate-700 ${
                            c.id === "uha" ? "font-bold text-slate-900" : ""
                          } ${c.id === "containerNo" ? "font-mono text-xs" : ""}`}
                          onClick={
                            c.id === "uha" && typeof openDrawer === "function"
                              ? () => openDrawer(r.stageId === "release" || r.released ? "release" : "port", k)
                              : undefined
                          }
                          style={c.id === "uha" && openDrawer ? { cursor: "pointer", textDecoration: "underline" } : undefined}
                        >
                          {c.id === "stage" ? (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[0.65rem] font-bold ${
                                r.stage === "已放行" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {r.stage}
                            </span>
                          ) : (
                            r[c.id] || "—"
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
