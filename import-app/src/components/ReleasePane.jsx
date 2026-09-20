import { useMemo, useState } from "react";
import { api } from "../bridge";
import { ListQueryBar } from "./ListQueryBar";
import { queryRows, SEARCH_FIELDS, SORT_GETTERS, SORT_OPTS } from "../lib/listQuery";

const chipIdle = "imp-chip flex-shrink-0";
const chipOn = "imp-chip imp-chip-on flex-shrink-0";

function Field({ lab, children }) {
  return (
    <label className="min-w-0">
      <span className="imp-field-lab">{lab}</span>
      {children}
    </label>
  );
}

/**
 * 已放行：拖車／交貨點／拆工（填拆工且有拖車＝順便派工）。
 */
export function ReleasePane({
  title,
  releaseTab,
  setReleaseTab,
  counts,
  rows,
  trailers,
  unpackers,
  refresh,
  onDispatched,
  onAfterUnmark,
}) {
  const [sortBy, setSortBy] = useState("uha");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(() => new Set());

  const sorted = useMemo(
    () =>
      queryRows(rows, {
        query,
        sortBy,
        fields: SEARCH_FIELDS.release,
        getters: SORT_GETTERS.release,
      }),
    [rows, query, sortBy],
  );

  const revertible = useMemo(() => sorted.filter((r) => !r.dispatched), [sorted]);

  const toggle = (uha) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(uha)) next.delete(uha);
      else next.add(uha);
      return next;
    });
  };

  const toggleAllRevertible = () => {
    setPicked((prev) => {
      if (prev.size === revertible.length && revertible.length) return new Set();
      return new Set(revertible.map((r) => r.uha || r.key));
    });
  };

  const patch = (uha, field, value) => {
    const result = api().patchReleaseField?.(uha, field, value);
    refresh?.();
    if (result === "dispatched") onDispatched?.(uha);
  };

  const confirmPickup = (uha) => {
    const row = (rows || []).find((r) => (r.uha || r.key) === uha);
    if (!String(row?.trailer || "").trim()) {
      alert("請先填寫拖車，再確認領櫃／派工。");
      return;
    }
    const ok = api().confirmReleasePickup?.(uha);
    if (ok === false) return;
    refresh?.();
    onDispatched?.(uha);
  };

  const unmarkOne = (uha) => {
    if (!confirm(`確定將 ${uha} 退回海關查驗？`)) return;
    const ok = api().unmarkPortReleased?.(uha);
    if (ok === false) return;
    setPicked((prev) => {
      const next = new Set(prev);
      next.delete(uha);
      return next;
    });
    refresh?.();
    onAfterUnmark?.([uha]);
  };

  const unmarkSelected = () => {
    const list = [...picked].filter((u) => {
      const row = sorted.find((r) => (r.uha || r.key) === u);
      return row && !row.dispatched;
    });
    if (!list.length) return;
    if (!confirm(`確定將選取的 ${list.length} 櫃退回海關查驗？`)) return;
    api().unmarkPortReleasedMany?.(list);
    setPicked(new Set());
    refresh?.();
    onAfterUnmark?.(list);
  };

  const trailerOpts = trailers?.length ? trailers : [];
  const unpackerOpts = unpackers?.length ? unpackers : [];
  const allRevertPicked = !!revertible.length && picked.size === revertible.length;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 pb-3 pt-4">
        <h2 className="m-0 text-xl font-bold text-slate-800">{title || "已放行"}</h2>
        <p className="mt-1 m-0 text-xs text-slate-400">
          填拖車、交貨點、拆工。有拖車且填拆工會順便派工到現場拆櫃。
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist">
          {[
            ["open", "待派送", counts?.open],
            ["arrange", "待排", counts?.arrange],
            ["pickup", "已可領", counts?.pickup],
          ].map(([id, lab, count]) => (
            <button key={id} type="button" className={releaseTab === id ? chipOn : chipIdle} onClick={() => setReleaseTab(id)}>
              {lab}
              <span className="ml-1 tabular-nums opacity-80">{count ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="imp-btn-ghost" disabled={!picked.size} onClick={unmarkSelected}>
            退回查驗{picked.size ? ` ${picked.size}` : ""}
          </button>
          <button type="button" className="imp-btn-ghost" onClick={toggleAllRevertible} disabled={!revertible.length}>
            {allRevertPicked ? "取消全選" : "全選可退回"}
          </button>
        </div>
        <div className="mt-3">
          <ListQueryBar
            query={query}
            onQuery={setQuery}
            sortBy={sortBy}
            onSort={setSortBy}
            sortOpts={SORT_OPTS.release}
            placeholder="搜尋編號、櫃號、品名、拖車、交貨點、拆工…"
            resultCount={sorted.length}
            totalCount={(rows || []).length}
          />
        </div>
      </div>

      <div className="px-2 py-2 sm:px-3">
        {!sorted.length ? (
          <p className="m-0 py-12 text-center text-sm text-slate-400">
            {(rows || []).length ? "沒有符合搜尋的貨櫃" : "目前沒有已放行（未拆櫃）資料"}
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {sorted.map((r) => {
              const uha = r.uha || r.key;
              const hasTrailer = !!String(r.trailer || "").trim();
              const checked = picked.has(uha);
              const canRevert = !r.dispatched;
              return (
                <li
                  key={uha}
                  className={`overflow-hidden rounded-xl border ${
                    checked ? "border-amber-300 bg-amber-50/40" : "border-slate-200/90 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-start gap-2 px-2.5 py-2 sm:px-3">
                    <label className="mt-1 flex shrink-0 cursor-pointer items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-amber-600"
                        checked={checked}
                        disabled={!canRevert}
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
                      <p className="m-0 mt-0.5 text-xs text-slate-500">
                        {r.trailer ? `拖車 ${r.trailer}` : "未填拖車"}
                        {r.unpackSite ? ` · 交貨 ${r.unpackSite}` : ""}
                        {r.assignee ? ` · 拆工 ${r.assignee}` : ""}
                        {r.dispatched ? " · 已派工" : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" className="imp-btn-ghost" disabled={!canRevert} onClick={() => unmarkOne(uha)}>
                        退回查驗
                      </button>
                      <button
                        type="button"
                        className="imp-btn-primary"
                        disabled={!hasTrailer || !!r.dispatched}
                        onClick={() => confirmPickup(uha)}
                        title={!hasTrailer ? "請先填拖車" : r.dispatched ? "已派送" : "確認領櫃並派工"}
                      >
                        {r.dispatched ? "已派工" : "確認派工"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 border-t border-slate-100/80 bg-slate-50/50 p-3 sm:grid-cols-3">
                    <Field lab="拖車（必填）">
                      <input
                        className="imp-field"
                        list="imp-trailer-list"
                        value={r.trailer || ""}
                        placeholder="選或輸入拖車"
                        disabled={!!r.dispatched}
                        onChange={(e) => patch(uha, "trailer", e.target.value)}
                      />
                    </Field>
                    <Field lab="交貨點">
                      <input
                        className="imp-field"
                        value={r.unpackSite || ""}
                        placeholder="冰庫／客戶點／碼頭"
                        disabled={!!r.dispatched}
                        onChange={(e) => patch(uha, "unpackSite", e.target.value)}
                      />
                    </Field>
                    <Field lab="拆工（填了順便派工）">
                      <input
                        className="imp-field"
                        list="imp-unpacker-list"
                        value={r.assignee || ""}
                        placeholder="選或輸入拆工"
                        disabled={!!r.dispatched}
                        onChange={(e) => patch(uha, "assignee", e.target.value)}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && !r.dispatched) patch(uha, "assignee", v);
                        }}
                      />
                    </Field>
                    <Field lab="碼頭">
                      <input className="imp-field" value={r.dock || ""} placeholder="碼頭" onChange={(e) => patch(uha, "dock", e.target.value)} disabled={!!r.dispatched} />
                    </Field>
                    <Field lab="領櫃日">
                      <input
                        type="date"
                        className="imp-field"
                        value={r.pickupDay || ""}
                        disabled={!!r.dispatched}
                        onChange={(e) => patch(uha, "pickupDay", e.target.value)}
                      />
                    </Field>
                    <div className="flex flex-wrap items-center gap-3 self-end rounded-lg border border-slate-200/80 bg-white px-2.5 py-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-sky-600"
                          checked={!!r.notifyTrailer}
                          disabled={!!r.dispatched}
                          onChange={(e) => patch(uha, "notifyTrailer", e.target.checked)}
                        />
                        <span className="text-xs font-semibold text-slate-800">通知拖車</span>
                      </label>
                      <label className="inline-flex cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-violet-600"
                          checked={!!r.notifyCustomer}
                          disabled={!!r.dispatched}
                          onChange={(e) => patch(uha, "notifyCustomer", e.target.checked)}
                        />
                        <span className="text-xs font-semibold text-slate-800">通知客戶</span>
                      </label>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <datalist id="imp-trailer-list">
        {trailerOpts.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <datalist id="imp-unpacker-list">
        {unpackerOpts.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
}
