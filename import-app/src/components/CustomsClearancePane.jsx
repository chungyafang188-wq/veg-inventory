import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../bridge";
import { clearLab, clearOptsFor } from "../constants";
import { ListQueryBar } from "./ListQueryBar";
import { queryRows, SEARCH_FIELDS, SORT_GETTERS, SORT_OPTS, uhaSortKey } from "../lib/listQuery";

const VIEW_KEY = "imp-customs-view-v1";
const EDIT_COLS = ["seller", "shipCo", "broker", "dock", "note"];

function shortDay(d) {
  const s = String(d || "");
  const m = s.match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? `${Number(m[1])}/${Number(m[2])}` : s || "";
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename, headers, rows) {
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function statusTone(id) {
  if (id === "skip") return "imp-st-skip";
  if (id === "wait") return "imp-st-wait";
  if (id === "done") return "imp-st-done";
  return "imp-st-none";
}

function rowKey(r) {
  return String(r.uha || r.key || "");
}

const emptyForm = () => ({
  uha: "",
  containerNo: "",
  arriveDay: new Date().toISOString().slice(0, 10),
  product: "",
  inspect: "none",
  fumigate: "none",
  released: "否",
});

const FILTERS = [
  { id: "all", lab: "全部" },
  { id: "port", lab: "待驗" },
  { id: "release", lab: "已放行" },
  { id: "inspect", lab: "需要藥檢" },
  { id: "fume", lab: "需要薰蒸" },
];

function InlineText({ value, placeholder = "+ 點擊填寫", onSave, rowIndex, colId, onNav, registerFocus }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value || ""));
  const ref = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(String(value || ""));
  }, [value, editing]);

  useEffect(() => {
    registerFocus?.(rowIndex, colId, btnRef.current);
    return () => registerFocus?.(rowIndex, colId, null);
  }, [rowIndex, colId, registerFocus]);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select?.();
    }
  }, [editing]);

  const commit = (thenNav) => {
    const next = String(draft || "").trim();
    const prev = String(value || "").trim();
    setEditing(false);
    if (next !== prev) onSave?.(next);
    if (thenNav) onNav?.(rowIndex, colId, thenNav);
  };

  if (!editing) {
    return (
      <button
        ref={btnRef}
        type="button"
        className={`imp-inline-btn${value ? "" : " is-empty"}`}
        onClick={() => setEditing(true)}
        title="點擊編輯"
      >
        {value ? String(value) : placeholder}
      </button>
    );
  }

  return (
    <input
      ref={ref}
      className="imp-inline-input"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setDraft(String(value || ""));
          setEditing(false);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          commit("enter");
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          commit(e.shiftKey ? "shift-tab" : "tab");
        }
      }}
    />
  );
}

function StatusMini({ value, kind, onChange }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const id = value || "none";
  const opts = clearOptsFor(kind);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="imp-st-wrap" ref={boxRef}>
      <button type="button" className={`imp-st-badge ${statusTone(id)}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {clearLab(id, kind)}
      </button>
      {open ? (
        <div className="imp-st-menu" role="listbox">
          {opts.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              className={`imp-st-opt ${statusTone(o.id)}${o.id === id ? " is-on" : ""}`}
              onClick={() => {
                setOpen(false);
                if (o.id !== id) onChange?.(o.id);
              }}
            >
              {o.lab}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function cardBadge(r) {
  if (r.inspect === "wait") return { lab: "需要藥檢", cls: "bg-sky-100 text-sky-800" };
  if (r.fumigate === "wait") return { lab: "需要薰蒸", cls: "bg-violet-100 text-violet-800" };
  if (r.inspect === "skip" && r.fumigate === "skip") return { lab: "無須檢驗", cls: "bg-slate-100 text-slate-600" };
  if (r.inspect === "done" || r.fumigate === "done") return { lab: "查驗完成", cls: "bg-emerald-100 text-emerald-800" };
  if (r.released || r.stageId === "release") return { lab: "已放行", cls: "bg-emerald-100 text-emerald-800" };
  return { lab: "待確認", cls: "bg-amber-100 text-amber-700" };
}

/**
 * 海關查驗管理：表格直輯（預設）＋卡片檢視二合一。
 */
export function CustomsClearancePane({
  title,
  rows,
  portRows,
  portTab,
  setPortTab,
  portCounts,
  refresh,
  onAfterRelease,
  openDrawer,
}) {
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "cards" ? "cards" : "table";
    } catch {
      return "table";
    }
  });
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("uha");
  const [picked, setPicked] = useState(() => new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const focusMap = useRef(new Map());

  const setViewMode = (mode) => {
    setView(mode);
    try {
      localStorage.setItem(VIEW_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  const sheet = useMemo(() => rows || [], [rows]);

  const filtered = useMemo(() => {
    let list = sheet;
    if (filter === "port") list = list.filter((r) => r.stageId === "port" || (!r.released && r.stage !== "已放行"));
    else if (filter === "release") list = list.filter((r) => r.stageId === "release" || r.released || r.stage === "已放行");
    else if (filter === "inspect") list = list.filter((r) => r.inspect === "wait");
    else if (filter === "fume") list = list.filter((r) => r.fumigate === "wait");
    return list;
  }, [sheet, filter]);

  const viewed = useMemo(
    () =>
      queryRows(filtered, {
        query,
        sortBy,
        fields: ["uha", "containerNo", "product", "seller", "shipCo", "broker", "dock", "note", "arriveDay", "stage"],
        getters: {
          uha: (r) => uhaSortKey(r.uha),
          arriveDay: (r) => r.arriveDay || "",
          product: (r) => r.product || "",
          stage: (r) => r.stage || "",
        },
      }),
    [filtered, query, sortBy],
  );

  const counts = useMemo(() => {
    const all = sheet.length;
    const port = sheet.filter((r) => r.stageId === "port" || (!r.released && r.stage !== "已放行")).length;
    const release = sheet.filter((r) => r.stageId === "release" || r.released || r.stage === "已放行").length;
    const inspect = sheet.filter((r) => r.inspect === "wait").length;
    const fume = sheet.filter((r) => r.fumigate === "wait").length;
    return { all, port, release, inspect, fume };
  }, [sheet]);

  const cardRows = useMemo(() => {
    const base = portRows || sheet.filter((r) => r.stageId === "port" || (!r.released && r.stage !== "已放行"));
    let list = base;
    if (portTab === "inspect") list = base.filter((r) => r.inspect === "wait");
    else if (portTab === "fume") list = base.filter((r) => r.fumigate === "wait");
    return queryRows(list, {
      query,
      sortBy,
      fields: SEARCH_FIELDS.port,
      getters: SORT_GETTERS.port,
    });
  }, [portRows, sheet, portTab, query, sortBy]);

  const patch = (uha, field, value) => {
    if (!uha) return;
    api().patchPortField?.(uha, field, value);
    refresh?.();
  };

  const markSelected = () => {
    const list = [...picked].filter((u) => {
      const row = sheet.find((r) => rowKey(r) === u);
      return row && !(row.released || row.stageId === "release");
    });
    if (!list.length) return;
    if (!confirm(`確定將選取的 ${list.length} 櫃標示為已放行？`)) return;
    api().markPortReleasedMany?.(list);
    setPicked(new Set());
    refresh?.();
    onAfterRelease?.(list);
  };

  const markOne = (uha) => {
    if (!confirm(`確定將 ${uha} 標示為已放行？`)) return;
    api().markPortReleased?.(uha, { quiet: true });
    setPicked((prev) => {
      const next = new Set(prev);
      next.delete(uha);
      return next;
    });
    refresh?.();
    onAfterRelease?.([uha]);
  };

  const submitAdd = () => {
    const ok = api().addManualPortRow?.(form);
    if (!ok) {
      alert("新增失敗，請再試一次。");
      return;
    }
    const wasReleased = form.released === "是";
    const uha = form.uha;
    setForm(emptyForm());
    setShowAdd(false);
    refresh?.();
    if (wasReleased) onAfterRelease?.([uha]);
  };

  const exportExcel = () => {
    const list = viewed;
    if (!list.length) return;
    const headers = ["階段", "編號", "櫃號", "到港日", "品名", "賣方", "船公司", "報關行", "藥檢", "薰蒸", "碼頭", "備註"];
    const data = list.map((r) => ({
      階段: r.stage || (r.released ? "已放行" : "待驗"),
      編號: r.uha || "",
      櫃號: r.containerNo || "",
      到港日: r.arriveDay || "",
      品名: r.product || "",
      賣方: r.seller || "",
      船公司: r.shipCo || "",
      報關行: r.broker || "",
      藥檢: clearLab(r.inspect, "inspect"),
      薰蒸: clearLab(r.fumigate, "fumigate"),
      碼頭: r.dock || "",
      備註: r.note || "",
    }));
    const day = new Date().toISOString().slice(0, 10);
    downloadCsv(`海關查驗_${list.length}筆_${day}.csv`, headers, data);
  };

  const registerFocus = (rowIndex, colId, el) => {
    const key = `${rowIndex}:${colId}`;
    if (el) focusMap.current.set(key, el);
    else focusMap.current.delete(key);
  };

  const navCell = (rowIndex, colId, dir) => {
    const colIdx = EDIT_COLS.indexOf(colId);
    if (colIdx < 0) return;
    let nextRow = rowIndex;
    let nextCol = colIdx;
    if (dir === "tab") nextCol += 1;
    else if (dir === "shift-tab") nextCol -= 1;
    else if (dir === "enter") nextRow += 1;

    if (nextCol >= EDIT_COLS.length) {
      nextCol = 0;
      nextRow += 1;
    }
    if (nextCol < 0) {
      nextCol = EDIT_COLS.length - 1;
      nextRow -= 1;
    }
    if (nextRow < 0 || nextRow >= viewed.length) return;
    requestAnimationFrame(() => {
      focusMap.current.get(`${nextRow}:${EDIT_COLS[nextCol]}`)?.click?.();
    });
  };

  const toggle = (uha) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(uha)) next.delete(uha);
      else next.add(uha);
      return next;
    });
  };

  const listForSelect = view === "cards" ? cardRows : viewed;
  const allSelected = !!listForSelect?.length && listForSelect.every((r) => picked.has(rowKey(r)));
  const toggleAll = () => {
    setPicked(() => {
      if (allSelected) return new Set();
      return new Set((listForSelect || []).map(rowKey).filter(Boolean));
    });
  };

  const pendingPicked = [...picked].filter((u) => {
    const row = sheet.find((r) => rowKey(r) === u);
    return row && !(row.released || row.stageId === "release");
  }).length;

  const filterChips =
    view === "cards"
      ? [
          ["open", "全部", portCounts?.open ?? counts.port],
          ["inspect", "需要藥檢", portCounts?.inspect ?? counts.inspect],
          ["fume", "需要薰蒸", portCounts?.fume ?? counts.fume],
        ]
      : FILTERS.map((f) => [f.id, f.lab, counts[f.id] ?? 0]);

  return (
    <div className="imp-customs rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 pb-3 pt-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="m-0 text-xl font-bold tracking-tight text-slate-800">{title || "海關查驗"}</h2>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <div className="imp-view-toggle" role="group" aria-label="檢視模式">
              <button type="button" className={view === "table" ? "imp-view-btn is-on" : "imp-view-btn"} onClick={() => setViewMode("table")}>
                ☰ 表格
              </button>
              <button type="button" className={view === "cards" ? "imp-view-btn is-on" : "imp-view-btn"} onClick={() => setViewMode("cards")}>
                ▦ 卡片
              </button>
            </div>
            <button type="button" className="imp-btn-ghost text-xs" onClick={exportExcel} disabled={!viewed.length}>
              匯出 Excel
            </button>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5" role="tablist" aria-label="狀態篩選">
          {filterChips.map(([id, lab, count]) => {
            const on =
              view === "cards" ? portTab === id || (id === "open" && (!portTab || portTab === "open")) : filter === id;
            return (
              <button
                key={id}
                type="button"
                className={on ? "imp-chip imp-chip-on" : "imp-chip"}
                onClick={() => {
                  if (view === "cards") setPortTab?.(id === "open" ? "open" : id);
                  else setFilter(id);
                }}
              >
                {lab}
                <span className="ml-1 tabular-nums opacity-80">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="imp-btn-primary" disabled={!pendingPicked} onClick={markSelected}>
            標示已放行{pendingPicked ? ` ${pendingPicked}` : ""}
          </button>
          <button type="button" className="imp-btn-ghost" onClick={toggleAll}>
            {allSelected ? "取消全選" : "全選本頁"}
          </button>
          <button type="button" className="imp-btn-ghost" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "收起新增" : "手動新增貨櫃"}
          </button>
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
            sortOpts={
              view === "cards"
                ? SORT_OPTS.port
                : [
                    { id: "uha", lab: "編號" },
                    { id: "arriveDay", lab: "到港日" },
                    { id: "stage", lab: "階段" },
                    { id: "product", lab: "品名" },
                  ]
            }
            placeholder="搜尋編號、櫃號、品名、賣方、碼頭、備註…"
            resultCount={view === "cards" ? cardRows.length : viewed.length}
            totalCount={view === "cards" ? (portRows || []).length || counts.port : filtered.length}
          />
        </div>
        <p className="mt-2 m-0 text-[0.7rem] text-slate-400">
          表格點欄位直輯：Enter 存並往下、Tab 往右；藥檢／薰蒸點徽章切換。空欄顯示「+ 點擊填寫」。
        </p>
      </div>

      {showAdd ? (
        <div className="border-b border-emerald-100 bg-emerald-50/50 px-4 py-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <input className="imp-field" value={form.uha} placeholder="編號可空白後補" onChange={(e) => setForm({ ...form, uha: e.target.value })} />
            <input className="imp-field" value={form.containerNo} placeholder="櫃號" onChange={(e) => setForm({ ...form, containerNo: e.target.value })} />
            <input type="date" className="imp-field" value={form.arriveDay} onChange={(e) => setForm({ ...form, arriveDay: e.target.value })} />
            <input className="imp-field" value={form.product} placeholder="品名" onChange={(e) => setForm({ ...form, product: e.target.value })} />
          </div>
          <button type="button" className="imp-btn-primary mt-2" onClick={submitAdd}>
            儲存新增
          </button>
        </div>
      ) : null}

      {view === "table" ? (
        <div className="overflow-auto p-2 sm:p-3">
          {!viewed.length ? (
            <p className="m-0 py-12 text-center text-sm text-slate-400">{sheet.length ? "沒有符合條件的資料" : "尚無查驗紀錄"}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="imp-inline-table w-full min-w-[68rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100">
                    <th className="w-9 px-2 py-2">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="全選" />
                    </th>
                    {["階段", "編號／櫃號", "到港", "品名", "賣方", "船公司", "報關行", "藥檢", "薰蒸", "碼頭", "備註", "操作"].map(
                      (lab) => (
                        <th key={lab} className="whitespace-nowrap px-2 py-2 text-[0.7rem] font-bold text-slate-600">
                          {lab}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {viewed.map((r, rowIndex) => {
                    const uha = rowKey(r);
                    const released = r.released || r.stageId === "release" || r.stage === "已放行";
                    const on = picked.has(uha);
                    const cell = (col) => (
                      <InlineText
                        value={r[col] || ""}
                        onSave={(v) => patch(uha, col, v)}
                        rowIndex={rowIndex}
                        colId={col}
                        onNav={navCell}
                        registerFocus={registerFocus}
                      />
                    );
                    return (
                      <tr
                        key={uha}
                        className={`border-b border-slate-100 odd:bg-white even:bg-slate-50/50 hover:bg-emerald-50/30 ${
                          on ? "bg-emerald-50/60" : ""
                        }`}
                      >
                        <td className="px-2 py-1.5 align-middle">
                          <input type="checkbox" checked={on} onChange={() => toggle(uha)} aria-label={`選取 ${uha}`} />
                        </td>
                        <td className="px-2 py-1.5 align-middle">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[0.65rem] font-bold ${
                              released ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {released ? "已放行" : "待驗"}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 align-middle">
                          <button
                            type="button"
                            className="imp-id-stack"
                            onClick={() => openDrawer?.(released ? "release" : "port", uha)}
                          >
                            <strong>{uha || "—"}</strong>
                            <span>{r.containerNo || "無櫃號"}</span>
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 align-middle tabular-nums text-slate-700">
                          {shortDay(r.arriveDay) || "—"}
                        </td>
                        <td className="max-w-[8rem] truncate px-2 py-1.5 align-middle font-semibold text-slate-800">
                          {r.product || "—"}
                        </td>
                        <td className="min-w-[5.5rem] px-1.5 py-1 align-middle">{cell("seller")}</td>
                        <td className="min-w-[5.5rem] px-1.5 py-1 align-middle">{cell("shipCo")}</td>
                        <td className="min-w-[5.5rem] px-1.5 py-1 align-middle">{cell("broker")}</td>
                        <td className="px-1.5 py-1 align-middle">
                          <StatusMini value={r.inspect || "none"} kind="inspect" onChange={(v) => patch(uha, "inspect", v)} />
                        </td>
                        <td className="px-1.5 py-1 align-middle">
                          <StatusMini value={r.fumigate || "none"} kind="fumigate" onChange={(v) => patch(uha, "fumigate", v)} />
                        </td>
                        <td className="min-w-[4.5rem] px-1.5 py-1 align-middle">{cell("dock")}</td>
                        <td className="min-w-[6rem] px-1.5 py-1 align-middle">{cell("note")}</td>
                        <td className="px-2 py-1.5 align-middle">
                          {!released ? (
                            <button type="button" className="imp-btn-primary px-2 py-1 text-xs" onClick={() => markOne(uha)}>
                              放行
                            </button>
                          ) : (
                            <span className="text-[0.7rem] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="px-2 py-2 sm:px-3">
          {!cardRows.length ? (
            <p className="m-0 py-12 text-center text-sm text-slate-400">
              {(portRows || []).length ? "沒有符合搜尋的貨櫃" : "目前沒有待驗貨櫃"}
            </p>
          ) : (
            <ul className="m-0 grid list-none gap-2 p-0">
              {cardRows.map((r) => {
                const uha = r.uha || r.key;
                const checked = picked.has(uha);
                const badge = cardBadge(r);
                return (
                  <li
                    key={uha}
                    className={`overflow-hidden rounded-xl border ${
                      checked ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200/90 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-start gap-2 px-3 py-2.5">
                      <label className="mt-1 flex shrink-0 cursor-pointer items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-emerald-600"
                          checked={checked}
                          onChange={() => toggle(uha)}
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-sm font-bold tabular-nums text-slate-800">
                            到港 {shortDay(r.arriveDay)}
                          </span>
                          <span className={`rounded-md px-2 py-0.5 text-sm font-bold ${badge.cls}`}>{badge.lab}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                          <strong className="text-lg font-bold text-slate-900">{uha}</strong>
                          <span className="font-mono text-sm font-semibold text-slate-700">{r.containerNo || "無櫃號"}</span>
                        </div>
                        <p className="m-0 mt-0.5 text-base font-semibold text-slate-800">{r.product || "—"}</p>
                      </div>
                      <button type="button" className="imp-btn-primary" onClick={() => markOne(uha)}>
                        本櫃放行
                      </button>
                    </div>
                    <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 bg-slate-50/50 px-3 py-2">
                      <label className="min-w-0 flex-1 basis-[7rem]">
                        <span className="imp-field-lab">賣方</span>
                        <input
                          className="imp-field"
                          defaultValue={r.seller || ""}
                          placeholder="+ 點擊填寫"
                          onBlur={(e) => patch(uha, "seller", e.target.value)}
                        />
                      </label>
                      <label className="min-w-0 flex-1 basis-[7rem]">
                        <span className="imp-field-lab">船公司</span>
                        <input
                          className="imp-field"
                          defaultValue={r.shipCo || ""}
                          placeholder="+ 點擊填寫"
                          onBlur={(e) => patch(uha, "shipCo", e.target.value)}
                        />
                      </label>
                      <label className="min-w-0 flex-1 basis-[6rem]">
                        <span className="imp-field-lab">碼頭</span>
                        <input
                          className="imp-field"
                          defaultValue={r.dock || ""}
                          placeholder="+ 點擊填寫"
                          onBlur={(e) => patch(uha, "dock", e.target.value)}
                        />
                      </label>
                      <div className="min-w-0 flex-1 basis-[7rem]">
                        <span className="imp-field-lab">藥檢</span>
                        <StatusMini value={r.inspect || "none"} kind="inspect" onChange={(v) => patch(uha, "inspect", v)} />
                      </div>
                      <div className="min-w-0 flex-1 basis-[7rem]">
                        <span className="imp-field-lab">薰蒸</span>
                        <StatusMini value={r.fumigate || "none"} kind="fumigate" onChange={(v) => patch(uha, "fumigate", v)} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
