import { useState } from "react";
import { api } from "../bridge";
import { CLEAR_OPTS } from "../constants";
import { CountBadge } from "./CountBadge";

const chipIdle = "imp-chip flex-shrink-0";
const chipOn = "imp-chip imp-chip-on flex-shrink-0";

const fieldCls =
  "w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[0.8rem] text-slate-800 outline-none focus:border-emerald-400";

function dtValue(v) {
  const s = String(v || "");
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? s.slice(0, 16) : s.slice(0, 16);
}

const emptyForm = () => ({
  uha: "",
  containerNo: "",
  arriveDay: new Date().toISOString().slice(0, 10),
  product: "",
  inspect: "none",
  fumigate: "none",
  dock: "",
  trailer: "",
  trailerPhone: "",
  note: "",
  released: "否",
});

/**
 * 海關查驗：同畫面勾選已放行、改藥檢／薰蒸、填拖車派貨；可手動新增。
 */
export function PortPane({ title, hint, portTab, setPortTab, portCounts, rows, refresh, onAfterRelease }) {
  const [picked, setPicked] = useState(() => new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);

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
      if (prev.size === (rows?.length || 0) && rows?.length) return new Set();
      return new Set((rows || []).map((r) => r.uha || r.key));
    });
  };

  const patch = (uha, field, value) => {
    api().patchPortField?.(uha, field, value);
    refresh?.();
  };

  const markSelected = () => {
    const list = [...picked];
    if (!list.length) return;
    api().markPortReleasedMany?.(list);
    setPicked(new Set());
    refresh?.();
    onAfterRelease?.(list);
  };

  const markOne = (uha) => {
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
      alert("請至少填編號（如 UHA715）。");
      return;
    }
    const wasReleased = form.released === "是";
    const uha = form.uha;
    setForm(emptyForm());
    setShowAdd(false);
    refresh?.();
    if (wasReleased) onAfterRelease?.([uha]);
  };

  return (
    <div className="grid gap-2.5">
      <div className="flex w-full flex-row gap-2 overflow-x-auto whitespace-nowrap p-0.5 touch-pan-x" role="tablist" aria-label="海關查驗篩選">
        {[
          ["open", "全部", portCounts.open],
          ["inspect", "藥檢中", portCounts.inspect],
          ["fume", "薰蒸排程中", portCounts.fume],
        ].map(([id, lab, count]) => (
          <button key={id} type="button" className={portTab === id ? chipOn : chipIdle} onClick={() => setPortTab(id)}>
            {lab}
            <CountBadge count={count} />
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        {title ? <h2 className="m-0 text-xl font-bold text-slate-800">{title}</h2> : null}
        {hint ? <p className={`m-0 text-xs text-slate-400 ${title ? "mt-1" : ""}`}>{hint}</p> : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="rounded-md bg-slate-800 px-3 py-1.5 text-[0.78rem] font-bold text-white" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "收起新增" : "手動新增貨櫃"}
          </button>
          <button type="button" className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[0.78rem] font-semibold text-slate-600" onClick={toggleAll}>
            {picked.size && picked.size === (rows?.length || 0) ? "取消全選" : "全選本頁"}
          </button>
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-[0.78rem] font-bold text-white disabled:opacity-40"
            disabled={!picked.size}
            onClick={markSelected}
          >
            標示已放行{picked.size ? `（${picked.size}）` : ""}
          </button>
          <span className="text-[0.72rem] text-slate-400">勾選→標示已放行；或到「舊資料」下載格式匯入</span>
        </div>

        {showAdd ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="m-0 text-[0.78rem] font-semibold text-emerald-900">手動新增一筆（編號必填）</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-0.5">
                <span className="text-[0.7rem] font-semibold text-slate-500">編號 *</span>
                <input className={fieldCls} value={form.uha} placeholder="UHA715" onChange={(e) => setForm({ ...form, uha: e.target.value })} />
              </label>
              <label className="grid gap-0.5">
                <span className="text-[0.7rem] font-semibold text-slate-500">櫃號</span>
                <input className={fieldCls} value={form.containerNo} onChange={(e) => setForm({ ...form, containerNo: e.target.value })} />
              </label>
              <label className="grid gap-0.5">
                <span className="text-[0.7rem] font-semibold text-slate-500">到港日</span>
                <input type="date" className={fieldCls} value={form.arriveDay} onChange={(e) => setForm({ ...form, arriveDay: e.target.value })} />
              </label>
              <label className="grid gap-0.5">
                <span className="text-[0.7rem] font-semibold text-slate-500">品名</span>
                <input className={fieldCls} value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
              </label>
              <label className="grid gap-0.5">
                <span className="text-[0.7rem] font-semibold text-slate-500">藥檢</span>
                <select className={fieldCls} value={form.inspect} onChange={(e) => setForm({ ...form, inspect: e.target.value })}>
                  {CLEAR_OPTS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.lab}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-0.5">
                <span className="text-[0.7rem] font-semibold text-slate-500">薰蒸</span>
                <select className={fieldCls} value={form.fumigate} onChange={(e) => setForm({ ...form, fumigate: e.target.value })}>
                  {CLEAR_OPTS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.lab}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-0.5">
                <span className="text-[0.7rem] font-semibold text-slate-500">拖車</span>
                <input className={fieldCls} value={form.trailer} onChange={(e) => setForm({ ...form, trailer: e.target.value })} />
              </label>
              <label className="grid gap-0.5">
                <span className="text-[0.7rem] font-semibold text-slate-500">已放行</span>
                <select className={fieldCls} value={form.released} onChange={(e) => setForm({ ...form, released: e.target.value })}>
                  <option value="否">否（進查驗）</option>
                  <option value="是">是（進已放行）</option>
                </select>
              </label>
            </div>
            <div className="mt-2">
              <button type="button" className="rounded-md bg-emerald-600 px-3 py-1.5 text-[0.8rem] font-bold text-white" onClick={submitAdd}>
                儲存新增
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          {!rows?.length ? (
            <p className="m-0 py-10 text-center text-sm text-slate-400">目前沒有到港待驗資料 — 可按「手動新增」或到舊資料匯入格式</p>
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0">
              {rows.map((r) => {
                const uha = r.uha || r.key;
                const checked = picked.has(uha);
                return (
                  <li key={uha} className={`rounded-xl border p-3 ${checked ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200/90 bg-slate-50/40"}`}>
                    <div className="flex flex-wrap items-start gap-3">
                      <label className="flex cursor-pointer items-center gap-2 pt-0.5">
                        <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={checked} onChange={() => toggle(uha)} />
                        <span className="text-[0.72rem] font-semibold text-slate-500">已放行</span>
                      </label>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <strong className="text-[0.95rem] text-slate-800">{uha}</strong>
                          <span className="text-[0.78rem] text-slate-500">{r.containerNo || "尚無櫃號"}</span>
                          <span className="text-[0.78rem] text-slate-600">{r.product || "—"}</span>
                          <span className="text-[0.72rem] text-slate-400">到港 {r.arriveDay || "—"}</span>
                          <span className="text-[0.72rem] font-semibold text-amber-700">{r.status || "查驗待確認"}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-md border border-emerald-600/40 px-2.5 py-1 text-[0.75rem] font-bold text-emerald-700"
                        onClick={() => markOne(uha)}
                      >
                        本櫃放行
                      </button>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="grid gap-0.5">
                        <span className="text-[0.7rem] font-semibold text-slate-500">藥檢</span>
                        <select className={fieldCls} value={r.inspect || "none"} onChange={(e) => patch(uha, "inspect", e.target.value)}>
                          {CLEAR_OPTS.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.lab}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-0.5">
                        <span className="text-[0.7rem] font-semibold text-slate-500">藥檢時間</span>
                        <input type="datetime-local" className={fieldCls} value={dtValue(r.inspectAt)} onChange={(e) => patch(uha, "inspectAt", e.target.value)} />
                      </label>
                      <label className="grid gap-0.5">
                        <span className="text-[0.7rem] font-semibold text-slate-500">薰蒸</span>
                        <select className={fieldCls} value={r.fumigate || "none"} onChange={(e) => patch(uha, "fumigate", e.target.value)}>
                          {CLEAR_OPTS.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.lab}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-0.5">
                        <span className="text-[0.7rem] font-semibold text-slate-500">薰蒸時間</span>
                        <input type="datetime-local" className={fieldCls} value={dtValue(r.fumigateAt)} onChange={(e) => patch(uha, "fumigateAt", e.target.value)} />
                      </label>
                      <label className="grid gap-0.5">
                        <span className="text-[0.7rem] font-semibold text-slate-500">碼頭</span>
                        <input className={fieldCls} value={r.dock || ""} placeholder="碼頭" onChange={(e) => patch(uha, "dock", e.target.value)} />
                      </label>
                      <label className="grid gap-0.5">
                        <span className="text-[0.7rem] font-semibold text-slate-500">拖車／派貨</span>
                        <input className={fieldCls} value={r.trailer || ""} placeholder="拖車窗口" onChange={(e) => patch(uha, "trailer", e.target.value)} />
                      </label>
                      <label className="grid gap-0.5">
                        <span className="text-[0.7rem] font-semibold text-slate-500">拖車電話</span>
                        <input type="tel" className={fieldCls} value={r.trailerPhone || ""} placeholder="電話" onChange={(e) => patch(uha, "trailerPhone", e.target.value)} />
                      </label>
                      <label className="grid gap-0.5 sm:col-span-2 lg:col-span-1">
                        <span className="text-[0.7rem] font-semibold text-slate-500">備註</span>
                        <input className={fieldCls} value={r.note || ""} placeholder="備註" onChange={(e) => patch(uha, "note", e.target.value)} />
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
