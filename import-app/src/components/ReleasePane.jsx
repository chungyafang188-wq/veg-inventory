import { useMemo, useState } from "react";
import { api } from "../bridge";
import { DateChip } from "./DateChip";
import { InlineEdit } from "./InlineEdit";
import { ListQueryBar } from "./ListQueryBar";
import { defaultPickupFromFt, formatMd, ftUrgency } from "../lib/dateChip";
import { queryRows, SEARCH_FIELDS, SORT_GETTERS, SORT_OPTS } from "../lib/listQuery";

const chipIdle = "imp-chip flex-shrink-0";
const chipOn = "imp-chip imp-chip-on flex-shrink-0";

function formatNotifyAt(iso) {
  const s = String(iso || "");
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 16).replace("T", " ");
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

function FtPickupCell({ row, uha, patch, disabled }) {
  const ft = String(row.ftAt || "").slice(0, 10);
  const urg = ftUrgency(ft);
  const pickup = String(row.pickupDay || "").slice(0, 10);

  const onFt = (v) => {
    const day = String(v || "").slice(0, 10);
    patch(uha, "ftAt", day);
    if (day && !String(row.pickupDay || "").trim()) {
      const def = defaultPickupFromFt(day);
      if (def) patch(uha, "pickupDay", def);
    }
  };

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-1">
        <DateChip value={ft} onChange={onFt} prefix="FT" emptyLab="填 FT" disabled={disabled} ariaLabel="免堆期 FT" />
        {urg.kind !== "none" ? (
          <span className={`inline-flex rounded px-1.5 py-0.5 text-[0.62rem] font-bold ${urg.cls}`}>
            {urg.kind === "urgent" ? "急件" : urg.kind === "warn" ? "預警" : urg.lab}
            {urg.left != null && urg.left < 0 ? ` ${Math.abs(urg.left)}天` : urg.left != null && urg.left <= 4 ? ` 剩${urg.left}天` : ""}
          </span>
        ) : null}
      </div>
      <DateChip
        value={pickup}
        onChange={(v) => patch(uha, "pickupDay", String(v || "").slice(0, 10))}
        prefix="領櫃"
        emptyLab={ft ? `預設 ${formatMd(defaultPickupFromFt(ft)) || "FT前1日"}` : "填領櫃日"}
        disabled={disabled}
        ariaLabel="領櫃日"
      />
    </div>
  );
}

/**
 * 已放行：桌面 6 欄雙層緊湊表 + 手機卡片 + 批量通知。
 * 欄位預設純文字，點擊才編輯。
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
    api().patchReleaseField?.(uha, field, value);
    refresh?.();
  };

  const dispatchOne = (uha) => {
    const row = sorted.find((r) => (r.uha || r.key) === uha);
    if (!row || row.dispatched) return;
    if (!String(row.trailer || "").trim()) {
      alert("請先填拖車再派工。");
      return;
    }
    if (!String(row.assignee || "").trim()) {
      if (!confirm(`${uha} 尚未填拆工，仍要派工？`)) return;
    } else if (!confirm(`確定將 ${uha} 派工至拆卸資料？`)) {
      return;
    }
    const ok = api().dispatchRelease?.(uha);
    if (!ok) {
      alert("派工失敗，請確認已填拖車。");
      return;
    }
    setPicked((prev) => {
      const next = new Set(prev);
      next.delete(uha);
      return next;
    });
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
          ? "fixed bottom-0 left-0 right-0 z-50 flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white p-3 shadow-[0_-6px_20px_rgba(15,23,42,0.08)] md:hidden"
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

  const dockEdit = (r, uha) => (
    <InlineEdit
      value={r.dock || ""}
      emptyLab="碼頭"
      disabled={!!r.dispatched}
      ariaLabel="碼頭"
      onChange={(v) => patch(uha, "dock", v)}
    />
  );

  const trailerEdit = (r, uha) =>
    trailerOpts.length ? (
      <InlineEdit
        mode="select"
        value={r.trailer || ""}
        options={trailerOpts}
        emptyLab="選拖車"
        disabled={!!r.dispatched}
        ariaLabel="拖車"
        commitOnChange
        onChange={(v) => patch(uha, "trailer", v)}
      />
    ) : (
      <InlineEdit
        value={r.trailer || ""}
        emptyLab="拖車"
        listId="imp-trailer-list"
        disabled={!!r.dispatched}
        ariaLabel="拖車"
        onChange={(v) => patch(uha, "trailer", v)}
      />
    );

  const siteEdit = (r, uha) => (
    <InlineEdit
      value={r.unpackSite || ""}
      emptyLab="交貨點"
      listId="imp-site-hints"
      disabled={!!r.dispatched}
      ariaLabel="交貨點"
      onChange={(v) => patch(uha, "unpackSite", v)}
    />
  );

  const assigneeEdit = (r, uha) => (
    <InlineEdit
      value={r.assignee || ""}
      emptyLab="拆工"
      listId="imp-unpacker-list"
      disabled={!!r.dispatched}
      ariaLabel="拆工"
      onChange={(v) => patch(uha, "assignee", v)}
    />
  );

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 pb-3 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-xl font-bold text-slate-800">{title || "已放行"}</h2>
        </div>
        <p className="mt-1 m-0 text-xs text-slate-400">點擊欄位即可編輯；日期顯示 MM/DD。勾選後可批量通知。</p>
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
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200/80 md:block">
              <table className="w-full min-w-[48rem] table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-[4%]" />
                  <col className="w-[20%]" />
                  <col className="w-[12%]" />
                  <col className="w-[20%]" />
                  <col className="w-[16%]" />
                  <col className="w-[28%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100">
                    <th className="px-2 py-2 text-center">
                      <input type="checkbox" checked={allPicked} onChange={toggleAll} aria-label="全選" />
                    </th>
                    <th className="px-2 py-2 text-left text-[0.7rem] font-bold text-slate-600">階段／單號與櫃號</th>
                    <th className="px-2 py-2 text-left text-[0.7rem] font-bold text-slate-600">品名</th>
                    <th className="px-2 py-2 text-left text-[0.7rem] font-bold text-slate-600">免堆期 FT／領櫃日</th>
                    <th className="px-2 py-2 text-left text-[0.7rem] font-bold text-slate-600">碼頭／拖車</th>
                    <th className="px-2 py-2 text-left text-[0.7rem] font-bold text-slate-600">交貨點／拆工派工</th>
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
                          <FtPickupCell row={r} uha={uha} patch={patch} disabled={!!r.dispatched} />
                        </td>
                        <td className="px-2 py-2 text-left">
                          <div className="mb-0.5">{dockEdit(r, uha)}</div>
                          {trailerEdit(r, uha)}
                        </td>
                        <td className="px-2 py-2 text-left">
                          <div className="mb-0.5">{siteEdit(r, uha)}</div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <div className="min-w-0 flex-1">{assigneeEdit(r, uha)}</div>
                            {!r.dispatched ? (
                              <button
                                type="button"
                                className="imp-btn-primary shrink-0 px-2 py-1 text-xs"
                                onClick={() => dispatchOne(uha)}
                              >
                                派工
                              </button>
                            ) : null}
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
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 border-t border-slate-100 bg-slate-50/50 px-3 py-2.5">
                      <div className="col-span-2">
                        <span className="imp-field-lab">免堆期 FT／領櫃日</span>
                        <FtPickupCell row={r} uha={uha} patch={patch} disabled={!!r.dispatched} />
                      </div>
                      <div>
                        <span className="imp-field-lab">碼頭</span>
                        {dockEdit(r, uha)}
                      </div>
                      <div>
                        <span className="imp-field-lab">拖車</span>
                        {trailerEdit(r, uha)}
                      </div>
                      <div>
                        <span className="imp-field-lab">交貨點</span>
                        {siteEdit(r, uha)}
                      </div>
                      <div>
                        <span className="imp-field-lab">拆工</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="min-w-0 flex-1">{assigneeEdit(r, uha)}</div>
                          {!r.dispatched ? (
                            <button type="button" className="imp-btn-primary shrink-0 px-2 py-1 text-xs" onClick={() => dispatchOne(uha)}>
                              派工
                            </button>
                          ) : null}
                        </div>
                      </div>
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
      <datalist id="imp-site-hints">
        <option value="冰庫" />
        <option value="客戶" />
        <option value="碼頭" />
      </datalist>
    </div>
  );
}
