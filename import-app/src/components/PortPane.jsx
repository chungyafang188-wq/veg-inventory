import { useState } from "react";
import { api } from "../bridge";
import { CLEAR_OPTS } from "../constants";

function dtValue(v) {
  const s = String(v || "");
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? s.slice(0, 16) : "";
}

function shortDay(d) {
  const s = String(d || "");
  const m = s.match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? `${Number(m[1])}/${Number(m[2])}` : s || "—";
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

function Field({ lab, children }) {
  return (
    <label className="min-w-0">
      <span className="imp-field-lab">{lab}</span>
      {children}
    </label>
  );
}

function statusBadge(r) {
  if (r.inspect === "wait") {
    return { lab: "藥檢中", cls: "bg-sky-100 text-sky-800" };
  }
  if (r.fumigate === "wait") {
    return { lab: "薰蒸排程中", cls: "bg-violet-100 text-violet-800" };
  }
  return { lab: r.status || "查驗待確認", cls: "bg-amber-100 text-amber-700" };
}

/**
 * 海關查驗：狀態膠囊貼標題、ToolBar、矮卡片。
 * 欄位：藥檢／薰蒸、碼頭、缺電放／缺資料；拖車到「已放行」。
 */
export function PortPane({ title, portTab, setPortTab, portCounts, rows, refresh, onAfterRelease }) {
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
      alert("請至少填編號（UHA 或 NC）。");
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
    ["open", "全部", portCounts?.open ?? 0],
    ["inspect", "藥檢中", portCounts?.inspect ?? 0],
    ["fume", "薰蒸排程中", portCounts?.fume ?? 0],
  ];

  const allSelected = !!rows?.length && picked.size === rows.length;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {/* 標題＋狀態膠囊 */}
      <div className="border-b border-slate-100 px-4 pb-3 pt-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="m-0 text-xl font-bold tracking-tight text-slate-800">{title || "海關查驗"}</h2>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="狀態篩選">
            {filters.map(([id, lab, count]) => (
              <button
                key={id}
                type="button"
                className={portTab === id ? "imp-chip imp-chip-on" : "imp-chip"}
                onClick={() => setPortTab(id)}
              >
                {lab}
                <span className="ml-1 tabular-nums opacity-80">{count}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1.5 m-0 text-xs text-slate-400">
          藥檢／薰蒸與碼頭在此登錄；缺電放／缺資料有缺再勾（＝需通知廠商）。拖車到「已放行」再填。
        </p>

        {/* ToolBar */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="imp-btn-primary" disabled={!picked.size} onClick={markSelected}>
            標示已放行{picked.size ? ` ${picked.size}` : ""}
          </button>
          <button type="button" className="imp-btn-ghost" onClick={toggleAll}>
            {allSelected ? "取消全選" : "全選本頁"}
          </button>
          <button type="button" className="imp-btn-ghost" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "收起新增" : "手動新增貨櫃"}
          </button>
          <span className="ml-auto hidden text-xs text-slate-400 sm:inline">勾選後可批次標示已放行</span>
        </div>
      </div>

      {showAdd ? (
        <div className="border-b border-emerald-100 bg-emerald-50/50 px-4 py-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <input className="imp-field" value={form.uha} placeholder="編號 UHA／NC" onChange={(e) => setForm({ ...form, uha: e.target.value })} />
            <input className="imp-field" value={form.containerNo} placeholder="櫃號" onChange={(e) => setForm({ ...form, containerNo: e.target.value })} />
            <input type="date" className="imp-field" value={form.arriveDay} onChange={(e) => setForm({ ...form, arriveDay: e.target.value })} />
            <input className="imp-field" value={form.product} placeholder="品名" onChange={(e) => setForm({ ...form, product: e.target.value })} />
          </div>
          <button type="button" className="imp-btn-primary mt-2" onClick={submitAdd}>
            儲存新增
          </button>
        </div>
      ) : null}

      <div className="px-2 py-2 sm:px-3">
        {!rows?.length ? (
          <p className="m-0 py-12 text-center text-sm text-slate-400">目前沒有待驗貨櫃</p>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {rows.map((r) => {
              const uha = r.uha || r.key;
              const checked = picked.has(uha);
              const needVendor = !!r.missingDocs;
              const badge = statusBadge(r);
              return (
                <li
                  key={uha}
                  className={`overflow-hidden rounded-xl border ${
                    checked
                      ? "border-emerald-300 bg-emerald-50/50"
                      : needVendor
                        ? "border-rose-200 bg-rose-50/30"
                        : "border-slate-200/90 bg-white"
                  }`}
                >
                  {/* Card header：勾選＋編號／品名｜日期＋Badge｜本櫃放行 */}
                  <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 sm:px-3">
                    <label className="flex shrink-0 cursor-pointer items-center self-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-emerald-600"
                        checked={checked}
                        onChange={() => toggle(uha)}
                        aria-label={`選取 ${uha}`}
                      />
                    </label>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <strong className="text-base font-bold text-slate-800">{uha}</strong>
                        <span className="font-mono text-xs text-slate-500">{r.containerNo || "無櫃號"}</span>
                        <span className="truncate text-sm text-slate-600">{r.product || "—"}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs tabular-nums text-slate-500">到港 {shortDay(r.arriveDay)}</span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold ${badge.cls}`}>{badge.lab}</span>
                      {needVendor ? (
                        <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[0.65rem] font-bold text-rose-700">需通知廠商</span>
                      ) : null}
                    </div>

                    <button type="button" className="imp-btn-primary ml-auto sm:ml-0" onClick={() => markOne(uha)}>
                      本櫃放行
                    </button>
                  </div>

                  {/* Form grid：矮 input、手機 2 欄、桌面 4 欄 */}
                  <div className="grid grid-cols-2 gap-3 rounded-none border-t border-slate-100/80 bg-slate-50/50 p-3 md:grid-cols-4">
                    <Field lab="藥檢">
                      <select className="imp-field" value={r.inspect || "none"} onChange={(e) => patch(uha, "inspect", e.target.value)}>
                        {CLEAR_OPTS.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.lab}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field lab="藥檢時間">
                      <input type="datetime-local" className="imp-field" value={dtValue(r.inspectAt)} onChange={(e) => patch(uha, "inspectAt", e.target.value)} />
                    </Field>
                    <Field lab="薰蒸">
                      <select className="imp-field" value={r.fumigate || "none"} onChange={(e) => patch(uha, "fumigate", e.target.value)}>
                        {CLEAR_OPTS.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.lab}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field lab="薰蒸時間">
                      <input type="datetime-local" className="imp-field" value={dtValue(r.fumigateAt)} onChange={(e) => patch(uha, "fumigateAt", e.target.value)} />
                    </Field>
                    <Field lab="碼頭">
                      <input
                        className="imp-field"
                        value={r.dock || ""}
                        placeholder="檢驗／卸貨碼頭"
                        onChange={(e) => patch(uha, "dock", e.target.value)}
                      />
                    </Field>
                    <label className="col-span-2 flex cursor-pointer items-center gap-2 self-end rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 md:col-span-1 md:min-h-[2.15rem]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-rose-600"
                        checked={needVendor}
                        onChange={(e) => patch(uha, "missingDocs", e.target.checked)}
                      />
                      <span className="min-w-0 leading-tight">
                        <span className="block text-xs font-semibold text-slate-800">缺電放／缺資料</span>
                        <span className="block text-[0.65rem] text-slate-400">有缺再勾＝通知廠商</span>
                      </span>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
