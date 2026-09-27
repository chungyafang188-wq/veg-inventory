import { useEffect, useMemo, useState } from "react";
import { api } from "../bridge";
import { DateChip } from "./DateChip";
import { InlineEdit } from "./InlineEdit";
import { ListQueryBar } from "./ListQueryBar";
import { formatMd, ftUrgency, parseDateTimePart } from "../lib/dateChip";
import { todayStamp } from "./HandoverTime";
import { TrailerPick } from "./TrailerPick";
import { queryRows, SEARCH_FIELDS, SORT_GETTERS, SORT_OPTS } from "../lib/listQuery";
import { noticeBundle } from "../lib/notifyCopy";

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

function clockOf(v) {
  const p = parseDateTimePart(v);
  if (!p || p.hh == null) return "";
  return `${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
}

function isTrailerNotified(row) {
  return !!(row?.notifyTrailer || row?.notified_trucker || row?.notifiedTrailer);
}

function isCustomerNotified(row) {
  return !!(row?.notifyCustomer || row?.notified_customer || row?.notifiedCustomer);
}

function NotifyBadges({ row, onClear }) {
  const trailerOn = isTrailerNotified(row);
  const customerOn = isCustomerNotified(row);
  if (!trailerOn && !customerOn) return null;

  const trailerTip = trailerOn
    ? `拖車已通知${row.notifyTrailerAt ? ` · ${formatNotifyAt(row.notifyTrailerAt)}` : ""}${
        row.notifyTrailerBy ? ` · ${row.notifyTrailerBy}` : ""
      }。點一下可取消`
    : "";
  const customerTip = customerOn
    ? `客戶已通知${row.notifyCustomerAt ? ` · ${formatNotifyAt(row.notifyCustomerAt)}` : ""}${
        row.notifyCustomerBy ? ` · ${row.notifyCustomerBy}` : ""
      }。點一下可取消`
    : "";

  return (
    <span className="mt-0.5 flex flex-wrap gap-1">
      {trailerOn ? (
        <button
          type="button"
          className="inline-flex w-auto items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[0.62rem] font-bold text-emerald-800"
          title={trailerTip}
          onClick={() => onClear?.("trailer")}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          拖車已通知
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
      {customerOn ? (
        <button
          type="button"
          className="inline-flex w-auto items-center gap-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[0.62rem] font-bold text-sky-800"
          title={customerTip}
          onClick={() => onClear?.("customer")}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
          客戶已通知
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </span>
  );
}

function stageLab(r) {
  if (r.dispatched) return { lab: "已派工", cls: "bg-slate-200 text-slate-700" };
  if (r.pickup) return { lab: "已排櫃", cls: "bg-emerald-100 text-emerald-800" };
  return { lab: "待排櫃", cls: "bg-amber-500 text-white" };
}

function FtPickupCell({ row, uha, patch, disabled }) {
  const ft = String(row.ftAt || "").slice(0, 10);
  const urg = ftUrgency(ft);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <DateChip
        value={ft}
        onChange={(v) => patch(uha, "ftAt", String(v || "").slice(0, 10))}
        prefix="FT"
        emptyLab="填 FT"
        disabled={disabled}
        ariaLabel="免堆期 FT"
      />
      {urg.kind !== "none" ? (
        <span className={`inline-flex rounded px-1.5 py-0.5 text-[0.62rem] font-bold ${urg.cls}`}>
          {urg.kind === "urgent" ? "急件" : urg.kind === "warn" ? "預警" : urg.lab}
          {urg.left != null && urg.left < 0 ? ` ${Math.abs(urg.left)}天` : urg.left != null && urg.left <= 4 ? ` 剩${urg.left}天` : ""}
        </span>
      ) : null}
    </div>
  );
}

/**
 * 已放行：一櫃一張卡。上排是編號，下面兩列是要填的欄位。
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
  const [overrides, setOverrides] = useState(() => ({}));

  useEffect(() => {
    setOverrides({});
  }, [rows]);

  const mergedRows = useMemo(
    () =>
      (rows || []).map((r) => {
        const k = r.uha || r.key;
        const o = overrides[k];
        return o ? { ...r, ...o } : r;
      }),
    [rows, overrides],
  );

  const sorted = useMemo(
    () =>
      queryRows(mergedRows, {
        query,
        sortBy,
        fields: SEARCH_FIELDS.release,
        getters: SORT_GETTERS.release,
      }),
    [mergedRows, query, sortBy],
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
    setOverrides((prev) => ({
      ...prev,
      [uha]: { ...(prev[uha] || {}), [field]: value },
    }));
  };

  const hardRefresh = () => {
    setOverrides({});
    refresh?.();
  };

  const confirmOne = (uha) => {
    const row = sorted.find((r) => (r.uha || r.key) === uha);
    if (!row || row.dispatched || row.pickup) return;
    const ok = api().confirmArrangeRelease?.(uha);
    if (!ok) return;
    setPicked((prev) => {
      const next = new Set(prev);
      next.delete(uha);
      return next;
    });
    hardRefresh();
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
    hardRefresh();
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
    hardRefresh();
    onAfterUnmark?.(list);
  };

  const pickedRows = () =>
    [...picked]
      .map((u) => sorted.find((r) => (r.uha || r.key) === u))
      .filter(Boolean);

  const allNotified = (kind, rows) =>
    rows.length > 0 &&
    rows.every((r) => (kind === "customer" ? isCustomerNotified(r) : isTrailerNotified(r)));

  const copyNotice = async (rows, kind) => {
    const text = noticeBundle(rows, kind);
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch {
        window.prompt("請長按全選後複製", text);
        return true;
      }
    }
  };

  const clearNotify = (list, kind) => {
    const n = api().clearNotifyReleaseMany?.(list, kind) ?? 0;
    if (!n) {
      alert("取消失敗，請再試一次。");
      return;
    }
    hardRefresh();
  };

  const notifySelected = async (kind) => {
    const rows = pickedRows();
    if (!rows.length) {
      alert("請先勾選要通知的貨櫃。");
      return;
    }
    const lab = kind === "customer" ? "客戶" : "拖車";
    const list = rows.map((r) => r.uha || r.key);
    if (allNotified(kind, rows)) {
      if (!confirm(`這 ${list.length} 櫃已經通知過${lab}。要取消通知嗎？`)) return;
      clearNotify(list, kind);
      return;
    }
    if (!confirm(`複製這 ${list.length} 櫃的文字，並標成已通知${lab}？`)) return;
    const copied = await copyNotice(rows, kind);
    const n = api().notifyReleaseMany?.(list, kind) ?? 0;
    if (!n) {
      alert("通知失敗，請再試一次。");
      return;
    }
    if (typeof window.setStatus === "function") {
      window.setStatus(copied ? `已複製 ${n} 櫃，可貼給${lab}。` : `已標成通知${lab} ${n} 櫃。`);
    }
    hardRefresh();
  };

  const clearOne = (uha, kind) => {
    const lab = kind === "customer" ? "客戶" : "拖車";
    if (!confirm(`取消這筆${lab}通知？之後可以再通知一次。`)) return;
    clearNotify([uha], kind);
  };

  const siteHints = useMemo(() => api().deliverySiteHints?.() || [], [rows]);
  void trailers;
  const unpackerOpts = (() => {
    const names = unpackers?.length ? unpackers.slice() : [];
    if (!names.includes("自行拆櫃")) names.push("自行拆櫃");
    return names;
  })();

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
        {allNotified("trailer", pickedRows()) ? "取消拖車通知" : "通知拖車"}
        {pickedCount ? `（已選 ${pickedCount} 筆）` : ""}
      </button>
      <button type="button" className="imp-btn-primary" disabled={!pickedCount} onClick={() => notifySelected("customer")}>
        {allNotified("customer", pickedRows()) ? "取消客戶通知" : "通知客戶"}
        {pickedCount ? `（已選 ${pickedCount} 筆）` : ""}
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

  const containerEdit = (r, uha) => (
    <InlineEdit value={r.containerNo || ""} emptyLab="櫃號" ariaLabel="櫃號" onChange={(v) => patch(uha, "containerNo", v)} />
  );
  const productEdit = (r, uha) => (
    <InlineEdit value={r.product || ""} emptyLab="品名" ariaLabel="品名" onChange={(v) => patch(uha, "product", v)} />
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

  const trailerEdit = (r, uha) => (
    <TrailerPick value={r.trailer || ""} disabled={!!r.dispatched} onChange={(v) => patch(uha, "trailer", v)} />
  );

  const unpackWhenEdit = (r, uha) => {
    const shift = !!r.unpackShift;
    const md = formatMd(r.unpackAt || "");
    const time = shift ? "上班領" : clockOf(r.unpackAt);
    const site = String(r.unpackSite || "").trim();
    const phrase =
      md && time && site
        ? shift
          ? `${md} ${time}-到${site}`
          : `${md} ${time}到${site}`
        : "";
    return (
      <div>
        <div className="flex flex-wrap items-center gap-1">
          <DateChip
            mode={shift ? "date" : "datetime"}
            value={r.unpackAt || ""}
            onChange={(v) => patch(uha, "unpackAt", shift ? String(v || "").slice(0, 10) : v)}
            emptyLab={shift ? "拆櫃日" : "拆櫃時間"}
            disabled={!!r.dispatched}
            ariaLabel="拆櫃時間"
          />
          <button
            type="button"
            className={`inline-flex w-auto shrink-0 rounded-full px-1.5 py-0.5 text-[0.62rem] font-bold ${
              shift ? "bg-amber-200 text-amber-950" : "bg-slate-100 text-slate-500"
            }`}
            disabled={!!r.dispatched}
            onClick={() => {
              const next = !shift;
              patch(uha, "unpackShift", next);
              if (next) {
                const day = String(r.unpackAt || "").slice(0, 10);
                patch(uha, "unpackAt", /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : todayStamp());
              }
            }}
          >
            上班領
          </button>
        </div>
        {phrase ? <div className="mt-0.5 text-[0.68rem] font-semibold text-slate-500">{phrase}</div> : null}
      </div>
    );
  };

  const siteEdit = (r, uha) => (
    <InlineEdit
      value={r.unpackSite || ""}
      emptyLab="拆卸位置"
      listId="imp-site-hints"
      disabled={!!r.dispatched}
      ariaLabel="拆卸位置"
      onChange={(v) => patch(uha, "unpackSite", v)}
    />
  );

  const assigneeEdit = (r, uha) =>
    unpackerOpts.length ? (
      <InlineEdit
        mode="select"
        value={r.assignee || ""}
        options={unpackerOpts}
        emptyLab="拆工"
        disabled={!!r.dispatched}
        ariaLabel="拆工"
        commitOnChange
        onChange={(v) => patch(uha, "assignee", v)}
      />
    ) : (
      <InlineEdit
        value={r.assignee || ""}
        emptyLab="拆工"
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
        <p className="mt-1 m-0 text-xs text-slate-400">點擊欄位即可編輯；日期 MM/DD。改完不整頁重刷。勾選後可批量通知。</p>
        {Number(counts?.arrange) > 0 ? (
          <button type="button" className="imp-remind" onClick={() => setReleaseTab("arrange")}>
            <span>
              <span className="imp-remind-n">待排櫃 {counts.arrange}</span>
              <span className="imp-remind-sub">已放行，還沒排上拆卸</span>
            </span>
            <span className="imp-remind-go">看這幾櫃</span>
          </button>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist">
          {[
            ["arrange", "待排櫃", counts?.arrange],
            ["pickup", "已排櫃", counts?.pickup],
            ["open", "總放行清單", counts?.open],
          ].map(([id, lab, count]) => (
            <button
              key={id}
              type="button"
              className={id === "arrange" && Number(count) > 0 ? "imp-chip imp-chip-warn flex-shrink-0" : releaseTab === id ? chipOn : chipIdle}
              onClick={() => setReleaseTab(id)}
            >
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
            placeholder="搜尋編號、櫃號、品名、拖車、拆卸位置、拆工…"
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
            <ul className="imp-release-list">
              {sorted.map((r) => {
                const uha = r.uha || r.key;
                const checked = picked.has(uha);
                const st = stageLab(r);
                const waiting = !r.pickup && !r.dispatched;
                return (
                  <li key={uha} className={`imp-release-card${waiting ? " is-wait" : ""}${checked ? " is-on" : ""}`}>
                    <div className="imp-release-top">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(uha)}
                        aria-label={`選取 ${uha}`}
                      />
                      <div className="imp-release-id">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[0.65rem] font-bold ${st.cls}`}>{st.lab}</span>
                        <strong>{uha}</strong>
                        {containerEdit(r, uha)}
                        <span className="imp-release-product">{productEdit(r, uha)}</span>
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
                    <NotifyBadges row={r} onClear={(kind) => clearOne(uha, kind)} />
                    <div className="imp-release-grid">
                      <label>
                        FT
                        <FtPickupCell row={r} uha={uha} patch={patch} disabled={!!r.dispatched} />
                      </label>
                      <label>
                        碼頭
                        {dockEdit(r, uha)}
                      </label>
                      <label>
                        拖車
                        {trailerEdit(r, uha)}
                      </label>
                      <label>
                        拆櫃時間
                        {unpackWhenEdit(r, uha)}
                      </label>
                      <label>
                        拆卸位置
                        {siteEdit(r, uha)}
                      </label>
                      <label>
                        拆工
                        <span className="imp-release-acts">
                          {assigneeEdit(r, uha)}
                          {!r.pickup && !r.dispatched ? (
                            <button type="button" className="imp-btn-primary shrink-0 px-2 py-1 text-xs" onClick={() => confirmOne(uha)}>
                              確認
                            </button>
                          ) : null}
                        </span>
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

      <datalist id="imp-site-hints">
        {siteHints.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
