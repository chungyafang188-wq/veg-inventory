import { useState } from "react";
import { api } from "../bridge";
import { clearLab, clearOptsFor } from "../constants";

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

function Field({ lab, children, className = "" }) {
  return (
    <label className={`min-w-0 ${className}`}>
      <span className="imp-field-lab">{lab}</span>
      {children}
    </label>
  );
}

function statusBadge(r) {
  if (r.inspect === "wait") return { lab: "需要藥檢", cls: "bg-sky-100 text-sky-800" };
  if (r.fumigate === "wait") return { lab: "需要薰蒸", cls: "bg-violet-100 text-violet-800" };
  if (r.inspect === "skip" && r.fumigate === "skip") return { lab: "無須檢驗", cls: "bg-slate-100 text-slate-600" };
  if (r.inspect === "done" || r.fumigate === "done") return { lab: "查驗完成", cls: "bg-emerald-100 text-emerald-800" };
  return { lab: "待確認", cls: "bg-amber-100 text-amber-700" };
}

/** 選定後鎖定；按修正才可再改 */
function LockedSelect({ lab, kind, value, unlocked, onUnlock, onChange }) {
  const opts = clearOptsFor(kind);
  const locked = value !== "none" && !unlocked;
  if (locked) {
    return (
      <div className="min-w-0 flex-1 basis-[7.5rem]">
        <span className="imp-field-lab">{lab}</span>
        <div className="flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{clearLab(value, kind)}</span>
          <button type="button" className="shrink-0 text-[0.65rem] font-bold text-emerald-700 underline" onClick={onUnlock}>
            修正
          </button>
        </div>
      </div>
    );
  }
  return (
    <label className="min-w-0 flex-1 basis-[7.5rem]">
      <span className="imp-field-lab">{lab}</span>
      <select className="imp-field" value={value || "none"} onChange={(e) => onChange(e.target.value)}>
        {opts.map((o) => (
          <option key={o.id} value={o.id}>
            {o.lab}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * 海關查驗：到港日／櫃號／品名／狀態為主。
 * 藥檢／薰蒸選定後鎖定可修正；僅「需要」時顯示排定時間。
 */
export function PortPane({ title, portTab, setPortTab, portCounts, rows, refresh, onAfterRelease }) {
  const [picked, setPicked] = useState(() => new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  /** key = `${uha}:inspect` | `${uha}:fumigate` */
  const [editKeys, setEditKeys] = useState(() => new Set());

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
    if (field === "inspect" || field === "fumigate") {
      setEditKeys((prev) => {
        const next = new Set(prev);
        next.delete(`${uha}:${field}`);
        return next;
      });
      if (value !== "wait") {
        const atField = field === "inspect" ? "inspectAt" : "fumigateAt";
        api().patchPortField?.(uha, atField, "");
      }
    }
    refresh?.();
  };

  const unlock = (uha, field) => {
    setEditKeys((prev) => new Set(prev).add(`${uha}:${field}`));
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
    ["inspect", "需要藥檢", portCounts?.inspect ?? 0],
    ["fume", "需要薰蒸", portCounts?.fume ?? 0],
  ];

  const allSelected = !!rows?.length && picked.size === rows.length;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
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
          重點：到港日、櫃號、品名、查驗狀態。藥檢／薰蒸選定後鎖定（可按修正）；需要時才填排定時間。
        </p>

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
              const missTelex = !!r.missingTelex;
              const missData = !!r.missingData;
              const needVendor = missTelex || missData;
              const badge = statusBadge(r);
              const needInspect = r.inspect === "wait";
              const needFume = r.fumigate === "wait";
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
                  {/* 主視覺：到港日、櫃號、品名、查驗狀態 */}
                  <div className="flex flex-wrap items-start gap-2 px-3 py-2.5">
                    <label className="mt-1 flex shrink-0 cursor-pointer items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-emerald-600"
                        checked={checked}
                        onChange={() => toggle(uha)}
                        aria-label={`選取 ${uha}`}
                      />
                    </label>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-sm font-bold tabular-nums text-slate-800">
                          到港 {shortDay(r.arriveDay)}
                        </span>
                        <span className={`rounded-md px-2 py-0.5 text-sm font-bold ${badge.cls}`}>{badge.lab}</span>
                        {missTelex ? (
                          <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[0.65rem] font-bold text-rose-700">缺電放</span>
                        ) : null}
                        {missData ? (
                          <span className="rounded-md bg-orange-100 px-1.5 py-0.5 text-[0.65rem] font-bold text-orange-800">缺資料</span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <strong className="text-lg font-bold tracking-tight text-slate-900">{uha}</strong>
                        <span className="font-mono text-sm font-semibold text-slate-700">{r.containerNo || "無櫃號"}</span>
                      </div>
                      <p className="m-0 mt-0.5 text-base font-semibold text-slate-800">{r.product || "—"}</p>
                    </div>

                    <button type="button" className="imp-btn-primary" onClick={() => markOne(uha)}>
                      本櫃放行
                    </button>
                  </div>

                  {/* 第一排：確認資料壓縮橫排 */}
                  <div className="flex flex-wrap items-end gap-2 border-t border-slate-100/80 bg-slate-50/50 px-3 py-2">
                    <LockedSelect
                      lab="藥檢"
                      kind="inspect"
                      value={r.inspect || "none"}
                      unlocked={editKeys.has(`${uha}:inspect`)}
                      onUnlock={() => unlock(uha, "inspect")}
                      onChange={(v) => patch(uha, "inspect", v)}
                    />
                    <LockedSelect
                      lab="薰蒸"
                      kind="fumigate"
                      value={r.fumigate || "none"}
                      unlocked={editKeys.has(`${uha}:fumigate`)}
                      onUnlock={() => unlock(uha, "fumigate")}
                      onChange={(v) => patch(uha, "fumigate", v)}
                    />
                    <label className="min-w-0 flex-1 basis-[6rem]">
                      <span className="imp-field-lab">碼頭</span>
                      <input
                        className="imp-field"
                        value={r.dock || ""}
                        placeholder="碼頭"
                        onChange={(e) => patch(uha, "dock", e.target.value)}
                      />
                    </label>
                    <label className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-rose-600"
                        checked={missTelex}
                        onChange={(e) => patch(uha, "missingTelex", e.target.checked)}
                      />
                      <span className="whitespace-nowrap text-xs font-semibold text-slate-800">缺電放</span>
                    </label>
                    <label className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-orange-600"
                        checked={missData}
                        onChange={(e) => patch(uha, "missingData", e.target.checked)}
                      />
                      <span className="whitespace-nowrap text-xs font-semibold text-slate-800">缺資料</span>
                    </label>
                  </div>

                  {/* 第二排：僅在需要藥檢／薰蒸時顯示排定時間 */}
                  {needInspect || needFume ? (
                    <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 bg-white px-3 py-2">
                      {needInspect ? (
                        <label className="min-w-0 flex-1 basis-[12rem]">
                          <span className="imp-field-lab">藥檢排定／報告時間</span>
                          <input
                            type="datetime-local"
                            className="imp-field"
                            value={dtValue(r.inspectAt)}
                            onChange={(e) => patch(uha, "inspectAt", e.target.value)}
                          />
                        </label>
                      ) : null}
                      {needFume ? (
                        <label className="min-w-0 flex-1 basis-[12rem]">
                          <span className="imp-field-lab">薰蒸排定時間</span>
                          <input
                            type="datetime-local"
                            className="imp-field"
                            value={dtValue(r.fumigateAt)}
                            onChange={(e) => patch(uha, "fumigateAt", e.target.value)}
                          />
                        </label>
                      ) : null}
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
