import { useState } from "react";
import { api } from "../bridge";
import { CLEAR_OPTS } from "../constants";

const fieldCls =
  "h-8 w-full min-w-0 rounded border border-slate-200 bg-white px-1.5 text-[0.78rem] text-slate-800 outline-none focus:border-emerald-500";

function dtValue(v) {
  const s = String(v || "");
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? s.slice(0, 16) : s.slice(0, 16);
}

function shortDay(d) {
  const s = String(d || "");
  const m = s.match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? `${Number(m[1])}/${Number(m[2])}` : s || "—";
}

function clearLab(id) {
  return (CLEAR_OPTS.find((o) => o.id === id) || {}).lab || "—";
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
 * 海關查驗：緊湊列＋展開編輯，減少滾動與重複標題。
 */
export function PortPane({ title, portTab, setPortTab, portCounts, rows, refresh, onAfterRelease }) {
  const [picked, setPicked] = useState(() => new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [openMore, setOpenMore] = useState(() => new Set());

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

  const toggleMore = (uha) => {
    setOpenMore((prev) => {
      const next = new Set(prev);
      if (next.has(uha)) next.delete(uha);
      else next.add(uha);
      return next;
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
      alert("請至少填編號（UHA 或 NC，如 UHA715）。");
      return;
    }
    const wasReleased = form.released === "是";
    const uha = form.uha;
    setForm(emptyForm());
    setShowAdd(false);
    refresh?.();
    if (wasReleased) onAfterRelease?.([uha]);
  };

  const filters = [
    ["open", "全部", portCounts.open],
    ["inspect", "藥檢中", portCounts.inspect],
    ["fume", "薰蒸中", portCounts.fume],
  ];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {/* 標題＋篩選同區，避免頂部分頁懸空 */}
      <div className="border-b border-slate-100 px-4 pb-3 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="m-0 text-xl font-bold tracking-tight text-slate-800">{title || "海關查驗"}</h2>
            <p className="mt-1 m-0 text-[0.75rem] text-slate-400">同畫面改狀態；勾選後批次放行。詳細派貨可展開。</p>
          </div>
          <div className="flex gap-1.5" role="tablist" aria-label="篩選">
            {filters.map(([id, lab, count]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={portTab === id}
                className={`rounded-lg px-3 py-1.5 text-[0.8rem] font-semibold transition-colors ${
                  portTab === id ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                onClick={() => setPortTab(id)}
              >
                {lab}
                <span className={`ml-1.5 tabular-nums ${portTab === id ? "text-emerald-100" : "text-slate-400"}`}>{count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 操作列：主／次分明 */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-3 py-2 text-[0.8rem] font-bold text-white disabled:opacity-40"
            disabled={!picked.size}
            onClick={markSelected}
          >
            標示已放行{picked.size ? ` ${picked.size}` : ""}
          </button>
          <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[0.8rem] font-semibold text-slate-700" onClick={toggleAll}>
            {picked.size && picked.size === (rows?.length || 0) ? "取消全選" : "全選"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[0.8rem] font-semibold text-slate-700"
            onClick={() => setShowAdd((v) => !v)}
          >
            {showAdd ? "收起新增" : "新增"}
          </button>
        </div>
      </div>

      {showAdd ? (
        <div className="border-b border-emerald-100 bg-emerald-50/50 px-4 py-3">
          <p className="m-0 text-[0.78rem] font-semibold text-emerald-900">手動新增（編號必填）</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input className={fieldCls} value={form.uha} placeholder="編號 UHA／NC" onChange={(e) => setForm({ ...form, uha: e.target.value })} />
            <input className={fieldCls} value={form.containerNo} placeholder="櫃號 EMCU…" onChange={(e) => setForm({ ...form, containerNo: e.target.value })} />
            <input type="date" className={fieldCls} value={form.arriveDay} onChange={(e) => setForm({ ...form, arriveDay: e.target.value })} />
            <input className={fieldCls} value={form.product} placeholder="品名" onChange={(e) => setForm({ ...form, product: e.target.value })} />
          </div>
          <button type="button" className="mt-2 rounded-lg bg-emerald-700 px-3 py-1.5 text-[0.8rem] font-bold text-white" onClick={submitAdd}>
            儲存新增
          </button>
        </div>
      ) : null}

      <div className="px-2 py-2 sm:px-3">
        {!rows?.length ? (
          <p className="m-0 py-12 text-center text-sm text-slate-400">目前沒有待驗貨櫃</p>
        ) : (
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {rows.map((r) => {
              const uha = r.uha || r.key;
              const checked = picked.has(uha);
              const busy = r.inspect === "wait" || r.fumigate === "wait";
              const showShip = openMore.has(uha) || !!(r.dock || r.trailer || r.trailerPhone || r.note);
              return (
                <li
                  key={uha}
                  className={`rounded-xl border px-2.5 py-2 sm:px-3 ${
                    checked ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200/90 bg-white"
                  }`}
                >
                  {/* 身份列：編號主視覺＋放行主按鈕 */}
                  <div className="flex items-start gap-2">
                    <label className="mt-1 flex shrink-0 cursor-pointer items-center">
                      <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={checked} onChange={() => toggle(uha)} aria-label={`選取 ${uha}`} />
                    </label>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <strong className="text-[1.05rem] font-bold tracking-tight text-slate-900">{uha}</strong>
                        <span className="font-mono text-[0.8rem] text-slate-500">{r.containerNo || "無櫃號"}</span>
                        {busy ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-bold text-amber-800">
                            {r.inspect === "wait" ? "藥檢中" : "薰蒸中"}
                          </span>
                        ) : (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.65rem] font-semibold text-slate-500">{r.status || "待確認"}</span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-[0.78rem] text-slate-600">
                        <span className="font-medium text-slate-700">{r.product || "—"}</span>
                        <span className="text-slate-300"> · </span>
                        <span className="text-slate-400">到港 {shortDay(r.arriveDay)}</span>
                        <span className="text-slate-300"> · </span>
                        <span className="text-slate-400">
                          藥檢 {clearLab(r.inspect)}／薰蒸 {clearLab(r.fumigate)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-[0.8rem] font-bold text-white shadow-sm hover:bg-emerald-700"
                      onClick={() => markOne(uha)}
                    >
                      放行
                    </button>
                  </div>

                  {/* 緊湊狀態列：無重複大標題 */}
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    <select
                      className={fieldCls}
                      value={r.inspect || "none"}
                      title="藥檢"
                      aria-label="藥檢"
                      onChange={(e) => patch(uha, "inspect", e.target.value)}
                    >
                      {CLEAR_OPTS.map((o) => (
                        <option key={o.id} value={o.id}>
                          藥檢·{o.lab}
                        </option>
                      ))}
                    </select>
                    <input
                      type="datetime-local"
                      className={fieldCls}
                      value={dtValue(r.inspectAt)}
                      title="藥檢時間"
                      aria-label="藥檢時間"
                      onChange={(e) => patch(uha, "inspectAt", e.target.value)}
                    />
                    <select
                      className={fieldCls}
                      value={r.fumigate || "none"}
                      title="薰蒸"
                      aria-label="薰蒸"
                      onChange={(e) => patch(uha, "fumigate", e.target.value)}
                    >
                      {CLEAR_OPTS.map((o) => (
                        <option key={o.id} value={o.id}>
                          薰蒸·{o.lab}
                        </option>
                      ))}
                    </select>
                    <input
                      type="datetime-local"
                      className={fieldCls}
                      value={dtValue(r.fumigateAt)}
                      title="薰蒸時間"
                      aria-label="薰蒸時間"
                      onChange={(e) => patch(uha, "fumigateAt", e.target.value)}
                    />
                  </div>

                  <div className="mt-1.5">
                    <button type="button" className="text-[0.72rem] font-semibold text-slate-500 hover:text-emerald-700" onClick={() => toggleMore(uha)}>
                      {showShip ? "收起派貨" : "碼頭／拖車／備註"}
                    </button>
                  </div>

                  {showShip ? (
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      <input className={fieldCls} value={r.dock || ""} placeholder="碼頭" onChange={(e) => patch(uha, "dock", e.target.value)} />
                      <input className={fieldCls} value={r.trailer || ""} placeholder="拖車" onChange={(e) => patch(uha, "trailer", e.target.value)} />
                      <input
                        type="tel"
                        className={fieldCls}
                        value={r.trailerPhone || ""}
                        placeholder="拖車電話"
                        onChange={(e) => patch(uha, "trailerPhone", e.target.value)}
                      />
                      <input className={fieldCls} value={r.note || ""} placeholder="備註" onChange={(e) => patch(uha, "note", e.target.value)} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
