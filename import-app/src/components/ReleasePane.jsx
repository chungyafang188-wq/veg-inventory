import { useMemo, useState } from "react";
import { api } from "../bridge";
import { ListQueryBar } from "./ListQueryBar";
import { queryRows, SEARCH_FIELDS, SORT_GETTERS, SORT_OPTS } from "../lib/listQuery";

const chipIdle = "imp-chip flex-shrink-0";
const chipOn = "imp-chip imp-chip-on flex-shrink-0";

function formatNotifyAt(iso) {
  const s = String(iso || "");
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 16).replace("T", " ");
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isTrailerNotified(row) {
  return !!(row?.notifyTrailer || row?.notified_trucker || row?.notifiedTrailer);
}

function isCustomerNotified(row) {
  return !!(row?.notifyCustomer || row?.notified_customer || row?.notifiedCustomer);
}

function NotifyBadges({ row }) {
  const trailerOn = isTrailerNotified(row);
  const customerOn = isCustomerNotified(row);
  if (!trailerOn && !customerOn) return null;

  const trailerTip = trailerOn
    ? `拖車已通知${row.notifyTrailerAt ? ` · ${formatNotifyAt(row.notifyTrailerAt)}` : ""}${
        row.notifyTrailerBy ? ` · ${row.notifyTrailerBy}` : ""
      }`
    : "";
  const customerTip = customerOn
    ? `客戶已通知${row.notifyCustomerAt ? ` · ${formatNotifyAt(row.notifyCustomerAt)}` : ""}${
        row.notifyCustomerBy ? ` · ${row.notifyCustomerBy}` : ""
      }`
    : "";

  return (
    <span className="mt-0.5 flex flex-wrap gap-1">
      {trailerOn ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[0.62rem] font-bold text-emerald-800"
          title={trailerTip}
          onClick={() => alert(trailerTip || "拖車已通知")}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          拖車已通知
        </button>
      ) : null}
      {customerOn ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[0.62rem] font-bold text-sky-800"
          title={customerTip}
          onClick={() => alert(customerTip || "客戶已通知")}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
          客戶已通知
        </button>
      ) : null}
    </span>
  );
}

function stageLab(r) {
  if (r.dispatched) return { lab: "已派工", cls: "bg-slate-200 text-slate-700" };
  if (r.pickup) return { lab: "已可領", cls: "bg-emerald-100 text-emerald-800" };
  return { lab: "已放行", cls: "bg-amber-100 text-amber-800" };
}

/**
 * 已放行：桌面 6 欄雙層緊湊表 + 手機直式卡片 + 批量通知工具列。
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
  const pickedCount = picked.size;
  const allPicked = !!sorted.length && picked.size === sorted.length;

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
      if (prev.size === sorted.length && sorted.length) return new Set();
      return new Set(sorted.map((r) => r.uha || r.key));
    });
  };

  const patch = (uha, field, value) => {
    const result = api().patchReleaseField?.(uha, field, value);
    refresh?.();
    if (result === "dispatched") onDispatched?.(uha);
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
    if (!list.length) {
      alert("請先選取尚未派工的貨櫃。");
      return;
    }
    if (!confirm(`確定將選取的 ${list.length} 櫃退回海關查驗？`)) return;
    api().unmarkPortReleasedMany?.(list);
    setPicked(new Set());
    refresh?.();
    onAfterUnmark?.(list);
  };

  const notifySelected = (kind) => {
    const list = [...picked];
    if (!list.length) {
      alert("請先勾選要通知的貨櫃。");
      return;
    }
    const lab = kind === "customer" ? "客戶" : "拖車";
    if (!confirm(`確定通知${lab}（已選 ${list.length} 筆）？`)) return;
    const n = api().notifyReleaseMany?.(list, kind) ?? 0;
    if (!n) {
      alert("通知失敗，請再試一次。");
      return;
    }
    refresh?.();
  };

  const trailerOpts = trailers?.length ? trailers : [];
  const unpackerOpts = unpackers?.length ? unpackers : [];

  const toolbar = (fixed) => (
    <div
      className={
        fixed
          ? "fixed bottom-0 left-0 right-0 z-50 flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-[0_-6px_20px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
          : "mt-3 hidden flex-wrap items-center gap-2 md:flex"
      }
      role="toolbar"
      aria-label="批量操作"
    >
      <button type="button" className="imp-btn-ghost" onClick={toggleAll} disabled={!sorted.length}>
        {allPicked ? "取消全選" : "全選"}
      </button>
      <button type="button" className="imp-btn-primary" disabled={!pickedCount} onClick={() => notifySelected("trailer")}>
        通知拖車{pickedCount ? `（已選 ${pickedCount} 筆）` : ""}
      </button>
      <button type="button" className="imp-btn-primary" disabled={!pickedCount} onClick={() => notifySelected("customer")}>
        通知客戶{pickedCount ? `（已選 ${pickedCount} 筆）` : ""}
      </button>
      <button
        type="button"
        className="imp-btn-ghost"
        disabled={!pickedCount || !revertible.some((r) => picked.has(r.uha || r.key))}
        onClick={unmarkSelected}
      >
        退回查驗
      </button>
    </div>
  );

  const trailerControl = (r, uha) =>
    trailerOpts.length ? (
      <select
        className="imp-field"
        value={r.trailer || ""}
        disabled={!!r.dispatched}
        onChange={(e) => patch(uha, "trailer", e.target.value)}
        aria-label="拖車"
      >
        <option value="">選拖車</option>
        {trailerOpts.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
        {r.trailer && !trailerOpts.includes(r.trailer) ? <option value={r.trailer}>{r.trailer}</option> : null}
      </select>
    ) : (
      <input
        className="imp-field"
        list="imp-trailer-list"
        value={r.trailer || ""}
        placeholder="選或輸入拖車"
        disabled={!!r.dispatched}
        onChange={(e) => patch(uha, "trailer", e.target.value)}
      />
    );

  const siteControl = (r, uha) => (
    <input
      className="imp-field"
      value={r.unpackSite || ""}
      placeholder="冰庫／客戶點"
      disabled={!!r.dispatched}
      onChange={(e) => patch(uha, "unpackSite", e.target.value)}
    />
  );

  const assigneeControl = (r, uha) => (
    <input
      className="imp-field"
      list="imp-unpacker-list"
      value={r.assignee || ""}
      placeholder="拆工"
      disabled={!!r.dispatched}
      onChange={(e) => patch(uha, "assignee", e.target.value)}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v && !r.dispatched) patch(uha, "assignee", v);
      }}
    />
  );

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 pb-3 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-xl font-bold text-slate-800">{title || "已放行"}</h2>
        </div>
        <p className="mt-1 m-0 text-xs text-slate-400">桌面為雙層緊湊表、手機為卡片；勾選後可批量通知拖車／客戶。</p>
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
        {toolbar(false)}
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

      <div className="px-2 py-2 pb-24 sm:px-3 md:pb-3">
        {!sorted.length ? (
          <p className="m-0 py-12 text-center text-sm text-slate-400">
            {(rows || []).length ? "沒有符合搜尋的貨櫃" : "目前沒有已放行（未拆櫃）資料"}
          </p>
        ) : (
          <>
            {/* Desktop: 6-column dual-layer table */}
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200/80 md:block">
              <table className="w-full min-w-[48rem] table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-[4%]" />
                  <col className="w-[22%]" />
                  <col className="w-[14%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                  <col className="w-[24%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100">
                    <th className="px-2 py-2 text-center">
                      <input type="checkbox" checked={allPicked} onChange={toggleAll} aria-label="全選" />
                    </th>
                    <th className="px-2 py-2 text-left text-[0.7rem] font-bold text-slate-600">階段／單號與櫃號</th>
                    <th className="px-2 py-2 text-left text-[0.7rem] font-bold text-slate-600">品名</th>
                    <th className="px-2 py-2 text-left text-[0.7rem] font-bold text-slate-600">碼頭／拖車</th>
                    <th className="px-2 py-2 text-left text-[0.7rem] font-bold text-slate-600">領櫃日／交貨點</th>
                    <th className="px-2 py-2 text-left text-[0.7rem] font-bold text-slate-600">拆工與操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => {
                    const uha = r.uha || r.key;
                    const checked = picked.has(uha);
                    const st = stageLab(r);
                    return (
                      <tr
                        key={uha}
                        className={`border-b border-slate-100 align-top odd:bg-white even:bg-slate-50/40 ${
                          checked ? "bg-amber-50/50" : ""
                        }`}
                      >
                        <td className="px-2 py-2 text-center align-middle">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-amber-600"
                            checked={checked}
                            onChange={() => toggle(uha)}
                            aria-label={`選取 ${uha}`}
                          />
                        </td>
                        <td className="px-2 py-2 text-left">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className={`inline-flex rounded px-1.5 py-0.5 text-[0.65rem] font-bold ${st.cls}`}>{st.lab}</span>
                            <strong className="tabular-nums text-slate-800">{uha}</strong>
                          </div>
                          <div className="mt-0.5 font-mono text-[0.72rem] text-slate-400">{r.containerNo || "無櫃號"}</div>
                          <NotifyBadges row={r} />
                        </td>
                        <td className="px-2 py-2 text-left font-semibold text-slate-800">{r.product || "—"}</td>
                        <td className="px-2 py-2 text-left">
                          <div className="mb-1 text-sm font-semibold text-slate-700">{r.dock ? `${r.dock}` : "—"}</div>
                          <input
                            className="imp-field mb-1"
                            value={r.dock || ""}
                            placeholder="碼頭"
                            disabled={!!r.dispatched}
                            onChange={(e) => patch(uha, "dock", e.target.value)}
                            aria-label="碼頭"
                          />
                          {trailerControl(r, uha)}
                        </td>
                        <td className="px-2 py-2 text-left">
                          <input
                            type="date"
                            className="imp-field mb-1"
                            value={r.pickupDay || ""}
                            disabled={!!r.dispatched}
                            onChange={(e) => patch(uha, "pickupDay", e.target.value)}
                            aria-label="領櫃日"
                          />
                          {siteControl(r, uha)}
                        </td>
                        <td className="px-2 py-2 text-left">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <div className="min-w-0 flex-1">{assigneeControl(r, uha)}</div>
                            <button
                              type="button"
                              className="imp-btn-ghost shrink-0 px-2 py-1 text-xs"
                              disabled={!!r.dispatched}
                              onClick={() => unmarkOne(uha)}
                            >
                              退回查驗
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: vertical cards */}
            <ul className="m-0 grid list-none gap-2 p-0 md:hidden">
              {sorted.map((r) => {
                const uha = r.uha || r.key;
                const checked = picked.has(uha);
                const st = stageLab(r);
                return (
                  <li
                    key={uha}
                    className={`rounded-xl border ${checked ? "border-amber-300 bg-amber-50/40" : "border-slate-200/90 bg-white"}`}
                  >
                    <div className="flex items-start gap-2 px-3 py-2.5">
                      <label className="mt-1 flex shrink-0 cursor-pointer items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-amber-600"
                          checked={checked}
                          onChange={() => toggle(uha)}
                          aria-label={`選取 ${uha}`}
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex rounded px-1.5 py-0.5 text-[0.65rem] font-bold ${st.cls}`}>{st.lab}</span>
                          <strong className="text-base font-bold tabular-nums text-slate-800">{uha}</strong>
                        </div>
                        <div className="mt-0.5 font-mono text-xs text-slate-400">{r.containerNo || "無櫃號"}</div>
                        <p className="m-0 mt-1 text-sm font-semibold text-slate-800">{r.product || "—"}</p>
                        <NotifyBadges row={r} />
                      </div>
                      <button
                        type="button"
                        className="imp-btn-ghost shrink-0 px-2 py-1 text-xs"
                        disabled={!!r.dispatched}
                        onClick={() => unmarkOne(uha)}
                      >
                        退回查驗
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 border-t border-slate-100 bg-slate-50/50 px-3 py-2.5">
                      <label className="min-w-0">
                        <span className="imp-field-lab">碼頭</span>
                        <input
                          className="imp-field"
                          value={r.dock || ""}
                          placeholder="碼頭"
                          disabled={!!r.dispatched}
                          onChange={(e) => patch(uha, "dock", e.target.value)}
                        />
                      </label>
                      <label className="min-w-0">
                        <span className="imp-field-lab">拖車</span>
                        {trailerControl(r, uha)}
                      </label>
                      <label className="min-w-0">
                        <span className="imp-field-lab">領櫃日</span>
                        <input
                          type="date"
                          className="imp-field"
                          value={r.pickupDay || ""}
                          disabled={!!r.dispatched}
                          onChange={(e) => patch(uha, "pickupDay", e.target.value)}
                        />
                      </label>
                      <label className="min-w-0">
                        <span className="imp-field-lab">交貨點</span>
                        {siteControl(r, uha)}
                      </label>
                      <label className="min-w-0">
                        <span className="imp-field-lab">拆工（填了順便派工）</span>
                        {assigneeControl(r, uha)}
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {toolbar(true)}

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
