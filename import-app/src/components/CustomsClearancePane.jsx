import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../bridge";
import { clearLab, clearOptsFor } from "../constants";
import { DateChip } from "./DateChip";
import { ListQueryBar } from "./ListQueryBar";
import { formatMd, isDayReached } from "../lib/dateChip";
import { fumeWhenLab, needsFumeHold } from "../lib/fumeShift";
import { FumeWhenFields } from "./FumeWhenFields";
import { queryRows, SEARCH_FIELDS, SORT_GETTERS, SORT_OPTS, uhaSortKey } from "../lib/listQuery";

const VIEW_KEY = "imp-customs-view-v1";
const EDIT_COLS = ["seller", "shipCo", "broker", "dock", "note"];

function shortDay(d) {
  return formatMd(d) || "";
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

function isRowPendingUha(r) {
  if (r?.pendingUha != null) return !!r.pendingUha;
  const s = String(r?.uha || "").trim();
  if (!s) return true;
  if (/^待編-/i.test(s) || /^TMP-/i.test(s)) return true;
  if (/^(UHA|NC)\s*$/i.test(s)) return true;
  return !/^(UHA|NC)\d+/i.test(s);
}

/** 編號欄：待補顯示 UHA＋修正；已完成可按修正改號 */
function ContainerNoField({ value, onSave }) {
  const [draft, setDraft] = useState(String(value || ""));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(String(value || ""));
  }, [value, focused]);
  return (
    <input
      className="imp-inline-input imp-uha-input font-mono"
      value={draft}
      placeholder="櫃號，打錯可改"
      aria-label="櫃號"
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(e.target.value.toUpperCase())}
      onBlur={() => {
        setFocused(false);
        if (draft.trim() !== String(value || "").trim()) onSave?.(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function UhaCodeCell({ row, onAssigned, onContainer, openDrawer }) {
  const uha = rowKey(row);
  const pending = isRowPendingUha(row);
  const [editing, setEditing] = useState(pending);
  const [draft, setDraft] = useState(pending ? "UHA" : uha);
  const ref = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(pending ? "UHA" : uha);
  }, [uha, pending, editing]);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      const el = ref.current;
      if (el && pending) {
        // 游標放在 UHA 後面，方便直接打數字
        const n = String(el.value || "").length;
        try {
          el.setSelectionRange(n, n);
        } catch {
          /* ignore */
        }
      } else {
        el?.select?.();
      }
    }
  }, [editing, pending]);

  const commit = () => {
    const raw = String(draft || "").trim();
    if (!raw || /^(UHA|NC)\s*$/i.test(raw)) {
      setEditing(pending);
      setDraft(pending ? "UHA" : uha);
      return;
    }
    if (!/^(UHA|NC)\d+/i.test(raw.toUpperCase().replace(/\s+/g, ""))) {
      alert("請填完整編號，例如 UHA715 或 NC002（UHA 後面要有數字）");
      ref.current?.focus();
      return;
    }
    const res = api().assignPortUha?.(uha, raw);
    if (!res?.ok) {
      alert(res?.error || "編號更新失敗");
      return;
    }
    setEditing(false);
    onAssigned?.(uha, res.uha);
  };

  if (editing) {
    return (
      <div className="imp-uha-edit">
        <input
          ref={ref}
          className="imp-inline-input imp-uha-input"
          value={draft}
          placeholder="UHA715"
          aria-label="補編號"
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
              setDraft(pending ? "UHA" : uha);
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
        <span className="imp-uha-hint">{pending ? "補上數字後 Enter" : "Enter 確認"}</span>
      </div>
    );
  }

  return (
    <div className={`imp-id-stack${pending ? " is-pending" : ""}`}>
      <button
        type="button"
        className="imp-id-main"
        onClick={() => (pending ? setEditing(true) : openDrawer?.(row.released || row.stageId === "release" ? "release" : "port", uha))}
      >
        <strong>{pending ? (/^NC/i.test(uha) ? "NC" : "UHA") : uha || "—"}</strong>
        {pending ? <em className="imp-uha-pending-tag">待補編碼</em> : null}
      </button>
      <ContainerNoField value={row.containerNo || ""} onSave={(v) => onContainer?.(v)} />
      <button type="button" className="imp-uha-fix" onClick={() => setEditing(true)}>
        {pending ? "補編號" : "修正編號"}
      </button>
    </div>
  );
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

function InlineText({ value, placeholder = "", onSave, rowIndex, colId, onNav, registerFocus }) {
  const [draft, setDraft] = useState(String(value || ""));
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!focused) setDraft(String(value || ""));
  }, [value, focused]);

  useEffect(() => {
    registerFocus?.(rowIndex, colId, ref.current);
    return () => registerFocus?.(rowIndex, colId, null);
  }, [rowIndex, colId, registerFocus]);

  const commit = (thenNav) => {
    const next = String(draft || "").trim();
    const prev = String(value || "").trim();
    if (next !== prev) onSave?.(next);
    if (thenNav) onNav?.(rowIndex, colId, thenNav);
  };

  return (
    <input
      ref={ref}
      className={`imp-excel-cell${focused ? " is-focus" : ""}`}
      value={draft}
      placeholder={placeholder || "—"}
      aria-label={colId || "欄位"}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => {
        setFocused(true);
        e.target.select();
      }}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setDraft(String(value || ""));
          e.currentTarget.blur();
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

function StatusMini({ value, kind, onChange, displayLab, toneClass }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const boxRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const id = value || "none";
  const opts = clearOptsFor(kind);

  const placeMenu = () => {
    const el = btnRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const menuW = Math.max(r.width, 128);
    const approxH = Math.max(40, opts.length * 32 + 12);
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < approxH + 8 && r.top > spaceBelow;
    let left = r.left;
    if (left + menuW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - menuW - 8);
    if (left < 8) left = 8;
    const pos = {
      top: openUp ? undefined : r.bottom + 4,
      bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
      left,
      minWidth: menuW,
    };
    setMenuPos(pos);
    return pos;
  };

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const onReposition = () => placeMenu();
    const onDoc = (e) => {
      const t = e.target;
      if (boxRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
      setMenuPos(null);
    };
    // 延遲綁定，避免開啟當下的 pointer 立刻關掉；不用 capture，以免表格內點選被搶先關掉
    const t = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDoc);
    }, 10);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  const menu =
    open && menuPos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className="imp-st-menu imp-st-menu-fixed"
            role="listbox"
            style={{
              top: menuPos.top != null ? `${menuPos.top}px` : "auto",
              bottom: menuPos.bottom != null ? `${menuPos.bottom}px` : "auto",
              left: `${menuPos.left}px`,
              minWidth: `${menuPos.minWidth}px`,
            }}
          >
            {opts.map((o) => (
              <button
                key={o.id}
                type="button"
                role="option"
                className={`imp-st-opt ${statusTone(o.id)}${o.id === id ? " is-on" : ""}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  setMenuPos(null);
                  if (o.id !== id) onChange?.(o.id);
                }}
              >
                {o.lab}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="imp-st-wrap" ref={boxRef}>
      <button
        ref={btnRef}
        type="button"
        className={`imp-st-badge ${toneClass || statusTone(id)}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => {
            const next = !v;
            if (next) placeMenu();
            else setMenuPos(null);
            return next;
          });
        }}
      >
        {displayLab || clearLab(id, kind)}
      </button>
      {menu}
    </div>
  );
}

function ClearanceStatusCell({ value, at, shift, kind, onStatus, onAt, onShift }) {
  const hasAt = !!String(at || "").trim();
  const hasShift = !!String(shift || "").trim();
  const showChip = value === "wait" || value === "done" || hasAt || (kind === "fumigate" && hasShift);
  const id = value || "none";
  const reportReady = kind === "inspect" && hasAt && isDayReached(at);

  let displayLab = clearLab(id, kind);
  let toneOverride = null;
  if (kind === "inspect") {
    if (reportReady) {
      displayLab = "已出報告";
      toneOverride = "bg-sky-100 text-sky-800";
    } else if (hasAt) {
      // 已填出報告日，但尚未到當天
      displayLab = "待藥檢結果";
      toneOverride = "bg-amber-100 text-amber-800";
    } else if (id === "wait" || id === "done") {
      displayLab = "需要藥檢";
      toneOverride = "bg-red-100 text-red-700";
    }
  } else if (hasAt || hasShift) {
    displayLab = "已排薰蒸";
    toneOverride = "bg-emerald-100 text-emerald-800";
  }

  return (
    <div className="imp-clear-stack">
      <StatusMini value={id} kind={kind} onChange={onStatus} displayLab={displayLab} toneClass={toneOverride} />
      {showChip && id !== "skip" ? (
        kind === "fumigate" ? (
          <FumeWhenFields compact at={at} shift={shift} onAt={onAt} onShift={onShift} />
        ) : (
          <DateChip
            value={at}
            mode="date"
            emptyLab="出報告日"
            onChange={(v) => {
              onAt?.(v);
              if (v && id !== "done") onStatus?.("done");
            }}
            ariaLabel="出報告日期"
          />
        )
      ) : null}
    </div>
  );
}

/** 需要藥檢／薰蒸時須填時間；藥檢須等到出報告當日（含）才可標示已放行 */
function canMarkReleased(r) {
  if (r.released || r.stageId === "release") return false;
  const insp = r.inspect || "none";
  const fume = r.fumigate || "none";
  if (insp === "wait" || insp === "done") {
    if (!String(r.inspectAt || "").trim()) return false;
    if (!isDayReached(r.inspectAt)) return false;
  }
  if (fume === "wait" && !String(r.fumigateAt || "").trim()) return false;
  return true;
}
function hasFt(r) {
  return !!(r?.ftAt || r?.ftConfirmed || r?.ft || (r?.ftLabel && r.ftLabel !== "—"));
}

/** 有藥檢日、或狀態是需要／完成，都要在階段上看得到。 */
function inspectTag(r) {
  const at = String(r?.inspectAt || "").trim();
  const st = r?.inspect || "none";
  if (st === "skip") return null;
  if (at && !isDayReached(at)) return { lab: "待藥檢結果", cls: "bg-amber-100 text-amber-800" };
  if (at && isDayReached(at)) return { lab: "已出報告", cls: "bg-sky-100 text-sky-800" };
  if (st === "wait" || st === "done") return { lab: "需要藥檢", cls: "bg-red-100 text-red-700" };
  return null;
}

function showsInspect(r) {
  const tag = inspectTag(r);
  return !!tag && tag.lab !== "已出報告";
}

function stageTags(r) {
  const released = r.released || r.stageId === "release" || r.stage === "已放行";
  const insp = inspectTag(r);
  if (released) {
    const tags = [{ lab: "已放行", cls: "bg-emerald-100 text-emerald-800" }];
    if (insp && insp.lab !== "已出報告") tags.push(insp);
    if (needsFumeHold(r)) {
      const when = fumeWhenLab(r.fumigateAt, r.fumigateShift);
      tags.push({
        lab: when ? `待煙燻 ${when}` : "待煙燻",
        cls: "bg-violet-100 text-violet-800",
      });
    }
    return tags;
  }
  const tags = [];
  if (hasFt(r)) tags.push({ lab: "已FT", cls: "bg-indigo-100 text-indigo-800" });
  if (insp) tags.push(insp);
  if (needsFumeHold(r)) {
    const when = fumeWhenLab(r.fumigateAt, r.fumigateShift);
    tags.push({
      lab: when ? `待煙燻 ${when}` : "待煙燻",
      cls: "bg-violet-100 text-violet-800",
    });
  }
  if (tags.length) return tags;
  if (r.inspect === "skip" && r.fumigate === "skip") return [{ lab: "待驗", cls: "bg-slate-100 text-slate-600" }];
  if (r.inspect === "done" || r.fumigate === "done") return [{ lab: "待驗", cls: "bg-emerald-100 text-emerald-800" }];
  return [{ lab: r.stage || "待驗", cls: "bg-amber-100 text-amber-800" }];
}

function ArriveFtCell({ arriveDay, ftAt, onArrive, onFt }) {
  const day = String(arriveDay || "").slice(0, 10);
  const ft = String(ftAt || "").slice(0, 10);
  return (
    <div className="imp-clear-stack items-stretch">
      <DateChip value={day} onChange={(v) => onArrive?.(String(v || "").slice(0, 10))} prefix="到港" emptyLab="填到港日" ariaLabel="到港日" />
      {day ? (
        <DateChip value={ft} onChange={(v) => onFt?.(String(v || "").slice(0, 10))} prefix="FT" emptyLab="填 FT" ariaLabel="FT日期" />
      ) : (
        <span className="text-center text-[0.62rem] text-slate-400">填到港後可填 FT</span>
      )}
    </div>
  );
}

function stageBadgeLabel(r) {
  return stageTags(r)
    .map((t) => t.lab)
    .join("＋");
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
  const [view, setView] = useState("table");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("uha");
  const [picked, setPicked] = useState(() => new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [justAdded, setJustAdded] = useState("");
  const [addNotice, setAddNotice] = useState(null);
  const focusMap = useRef(new Map());
  /** 整表高速：欄位寫入後先本地合併，避免整頁 refresh 丟焦點 */
  const [overrides, setOverrides] = useState(() => ({}));

  useEffect(() => {
    setOverrides({});
  }, [rows]);

  const setViewMode = (mode) => {
    setView(mode);
    try {
      localStorage.setItem(VIEW_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  const sheet = useMemo(
    () =>
      (rows || []).map((r) => {
        const k = rowKey(r);
        const o = overrides[k];
        return o ? { ...r, ...o } : r;
      }),
    [rows, overrides],
  );

  const filtered = useMemo(() => {
    let list = sheet;
    if (filter === "port") list = list.filter((r) => r.stageId === "port" || (!r.released && r.stage !== "已放行"));
    else if (filter === "release") list = list.filter((r) => r.stageId === "release" || r.released || r.stage === "已放行");
    else if (filter === "inspect") list = list.filter((r) => showsInspect(r));
    else if (filter === "fume") list = list.filter((r) => r.fumigate === "wait");
    return list;
  }, [sheet, filter]);

  const viewed = useMemo(() => {
    const list = queryRows(filtered, {
      query,
      sortBy,
      fields: ["uha", "containerNo", "product", "seller", "shipCo", "broker", "dock", "note", "arriveDay", "stage"],
      getters: {
        uha: (r) => uhaSortKey(r.uha),
        arriveDay: (r) => r.arriveDay || "",
        product: (r) => r.product || "",
        stage: (r) => r.stage || "",
      },
    });
    if (!justAdded) return list;
    const i = list.findIndex((r) => rowKey(r) === justAdded);
    if (i <= 0) return list;
    const next = list.slice();
    next.unshift(next.splice(i, 1)[0]);
    return next;
  }, [filtered, query, sortBy, justAdded]);

  const counts = useMemo(() => {
    const all = sheet.length;
    const port = sheet.filter((r) => r.stageId === "port" || (!r.released && r.stage !== "已放行")).length;
    const release = sheet.filter((r) => r.stageId === "release" || r.released || r.stage === "已放行").length;
    const inspect = sheet.filter((r) => showsInspect(r)).length;
    const fume = sheet.filter((r) => r.fumigate === "wait").length;
    return { all, port, release, inspect, fume };
  }, [sheet]);

  const cardRows = useMemo(() => {
    const base = portRows || sheet.filter((r) => r.stageId === "port" || (!r.released && r.stage !== "已放行"));
    let list = base;
    if (portTab === "inspect") list = base.filter((r) => showsInspect(r));
    else if (portTab === "fume") list = base.filter((r) => r.fumigate === "wait");
    const rows = queryRows(list, {
      query,
      sortBy,
      fields: SEARCH_FIELDS.port,
      getters: SORT_GETTERS.port,
    });
    if (!justAdded) return rows;
    const i = rows.findIndex((r) => rowKey(r) === justAdded);
    if (i <= 0) return rows;
    const next = rows.slice();
    next.unshift(next.splice(i, 1)[0]);
    return next;
  }, [portRows, sheet, portTab, query, sortBy, justAdded]);

  const patch = (uha, field, value, opts = {}) => {
    if (!uha) return;
    api().patchPortField?.(uha, field, value);
    setOverrides((prev) => ({
      ...prev,
      [uha]: { ...(prev[uha] || {}), [field]: value },
    }));
    // 結構性變更才整頁重抓；一般欄位只本地更新以保高速
    if (opts.hard) refresh?.();
  };

  const hardRefresh = () => {
    setOverrides({});
    refresh?.();
  };

  const onUhaAssigned = (oldKey, newKey) => {
    if (oldKey && newKey && oldKey !== newKey) {
      setPicked((prev) => {
        if (!prev.has(oldKey)) return prev;
        const next = new Set(prev);
        next.delete(oldKey);
        next.add(newKey);
        return next;
      });
    }
    hardRefresh();
  };

  const markSelected = () => {
    const list = [...picked].filter((u) => {
      const row = sheet.find((r) => rowKey(r) === u);
      return row && canMarkReleased(row);
    });
    if (!list.length) {
      alert("選取的貨櫃尚有藥檢／薰蒸時間未填，無法標示已放行。");
      return;
    }
    if (!confirm(`確定將選取的 ${list.length} 櫃標示為已放行？`)) return;
    api().markPortReleasedMany?.(list);
    setPicked(new Set());
    hardRefresh();
    onAfterRelease?.(list);
  };

  const markOne = (uha) => {
    const row = sheet.find((r) => rowKey(r) === uha);
    if (!row || !canMarkReleased(row)) {
      alert("請先完成藥檢出報告日／薰蒸安排時間後再標示已放行。");
      return;
    }
    const lab = isRowPendingUha(row) ? `UHA（待補）${row.containerNo ? " · " + row.containerNo : ""}` : uha;
    if (!confirm(`確定將 ${lab} 標示為已放行？`)) return;
    api().markPortReleased?.(uha, { quiet: true });
    setPicked((prev) => {
      const next = new Set(prev);
      next.delete(uha);
      return next;
    });
    hardRefresh();
    onAfterRelease?.([uha]);
  };

  const submitAdd = () => {
    const created = api().addManualPortRow?.(form);
    if (!created) {
      alert("新增失敗，請再試一次。");
      return;
    }
    const info =
      typeof created === "string"
        ? { existing: false, uha: created, where: form.released === "是" ? "已放行" : "海關查驗", via: "" }
        : created;
    const wasReleased = !info.existing && form.released === "是";
    setForm(emptyForm());
    setShowAdd(false);
    setFilter("all");
    setQuery("");
    setAddNotice(info);
    setJustAdded(info.existing && info.where === "已刪除" ? "" : info.uha || "");
    hardRefresh();
    if (wasReleased) onAfterRelease?.([info.uha]);
  };

  useEffect(() => {
    if (!justAdded) return;
    const timer = window.setTimeout(() => {
      const esc = window.CSS?.escape ? CSS.escape(justAdded) : justAdded;
      document.querySelector(`[data-flash-uha="${esc}"]`)?.scrollIntoView({ block: "center" });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [justAdded, rows, view]);

  const addedRow = justAdded ? sheet.find((r) => rowKey(r) === justAdded) : null;
  const existingDetail = addNotice?.existing
    ? [
        addNotice.via === "編號" && addNotice.containerNo ? `櫃號 ${addNotice.containerNo}` : "",
        addNotice.arriveDay ? `到港 ${shortDay(addNotice.arriveDay)}` : "",
        addNotice.product || "",
        addNotice.seller ? `賣方 ${addNotice.seller}` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const exportExcel = () => {
    const list = viewed;
    if (!list.length) return;
    const headers = ["階段", "編號", "櫃號", "到港日", "品名", "賣方", "船公司", "報關行", "藥檢", "薰蒸", "碼頭", "備註"];
    const data = list.map((r) => ({
      階段: stageBadgeLabel(r),
      編號: isRowPendingUha(r) ? "UHA（待補）" : r.uha || "",
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
      const el = focusMap.current.get(`${nextRow}:${EDIT_COLS[nextCol]}`);
      if (!el) return;
      el.focus?.();
      el.select?.();
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
    return row && canMarkReleased(row);
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
    <div className="imp-customs grid grid-cols-1 gap-6 lg:grid-cols-12">
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:col-span-12">
        <div className="border-b border-slate-100 px-4 pb-3 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div>
              <h2 className="m-0 text-xl font-bold tracking-tight text-slate-800">{title || "海關查驗"}</h2>
              <p className="mt-1 m-0 rounded-md bg-teal-50 px-2 py-1 text-[0.75rem] font-bold text-teal-900">
                高速表格：格子直接輸入 · Tab 下一格 · Enter 下一列
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
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
              <button type="button" className="imp-btn-ghost text-xs" onClick={hardRefresh}>
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
                      { id: "uha", lab: "編號後三碼" },
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
            表格為 6 欄雙層緊湊：到港可改、有到港後可填 FT（填了階段以已FT為主）；藥檢／薰蒸需填時顯示時間。
          </p>
          {addNotice?.existing || addedRow ? (
            <div className={`imp-just-added mt-2${addNotice?.existing ? " is-existing" : ""}`}>
              {addNotice?.existing ? (
                <p className="m-0">
                  {addNotice.via === "櫃號" ? (
                    <>
                      櫃號 <strong>{addNotice.containerNo || "這一個"}</strong> 已經在清單裡
                      {addNotice.uha ? (
                        <>
                          ，編號是 <strong>{isRowPendingUha(addNotice) ? "編號待補" : addNotice.uha}</strong>
                        </>
                      ) : null}
                      ，位置在「{addNotice.where}」。
                    </>
                  ) : (
                    <>
                      編號 <strong>{isRowPendingUha(addNotice) ? "編號待補" : addNotice.uha}</strong> 已經在「{addNotice.where}」清單裡。
                    </>
                  )}
                  這次沒有再新增一筆。
                  {addNotice.where === "已刪除" ? " 資料還在已刪除清單，要找回請到舊資料按放回。" : " 這一列已移到最上面，方便核對。"}
                  {existingDetail ? ` 清單上是：${existingDetail}。` : ""}
                </p>
              ) : (
                <p className="m-0">
                  剛加入 <strong>{isRowPendingUha(addedRow) ? "編號待補" : addedRow.uha}</strong>
                  {addedRow.containerNo ? ` · ${addedRow.containerNo}` : ""}
                  {addedRow.arriveDay ? ` · 到港 ${shortDay(addedRow.arriveDay)}` : ""}
                  {addedRow.product ? ` · ${addedRow.product}` : ""}
                  {addedRow.seller ? ` · 賣方 ${addedRow.seller}` : ""}
                  。已在「{addNotice?.where || "海關查驗"}」清單。
                </p>
              )}
              <button
                type="button"
                className="imp-btn-ghost text-xs"
                onClick={() => {
                  setAddNotice(null);
                  setJustAdded("");
                }}
              >
                知道了
              </button>
            </div>
          ) : null}
        </div>

        {showAdd ? (
          <div className="border-b border-emerald-100 bg-emerald-50/50 px-4 py-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div>
                <input className="imp-field" value={form.uha} placeholder="可空白或先填 UHA（後補數字）" onChange={(e) => setForm({ ...form, uha: e.target.value.toUpperCase() })} />
                {form.uha && !/^(UHA|NC)\d+/i.test(String(form.uha).trim()) ? (
                  <p className="m-0 mt-1 text-[0.65rem] font-semibold text-amber-700">無數字＝待補編碼</p>
                ) : null}
              </div>
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
                <table className="imp-inline-table w-full min-w-[52rem] table-fixed border-collapse text-sm">
                  <colgroup>
                    <col className="w-[3.5%]" />
                    <col className="w-[18%]" />
                    <col className="w-[14%]" />
                    <col className="w-[20%]" />
                    <col className="w-[24%]" />
                    <col className="w-[20.5%]" />
                  </colgroup>
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100">
                      <th className="px-1.5 py-2 text-center">
                        <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="全選" />
                      </th>
                      <th className="px-1.5 py-2 text-left text-[0.7rem] font-bold text-slate-600">階段／編號與櫃號</th>
                      <th className="px-1.5 py-2 text-center text-[0.7rem] font-bold text-slate-600">到港／FT</th>
                      <th className="px-1.5 py-2 text-left text-[0.7rem] font-bold text-slate-600">品名／往來</th>
                      <th className="px-1.5 py-2 text-center text-[0.7rem] font-bold text-slate-600">藥檢／薰蒸</th>
                      <th className="px-1.5 py-2 text-left text-[0.7rem] font-bold text-slate-600">碼頭／備註／操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewed.map((r, rowIndex) => {
                      const uha = rowKey(r);
                      const released = r.released || r.stageId === "release" || r.stage === "已放行";
                      const on = picked.has(uha);
                      const stages = stageTags(r);
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
                          data-flash-uha={uha}
                          className={`border-b border-slate-100 odd:bg-white even:bg-slate-50/50 hover:bg-emerald-50/30 ${
                            on ? "bg-emerald-50/60" : ""
                          }${uha === justAdded ? (addNotice?.existing ? " imp-row-existing" : " imp-row-fresh") : ""}`}
                        >
                          <td className="px-1.5 py-1.5 text-center align-middle">
                            <input type="checkbox" checked={on} onChange={() => toggle(uha)} aria-label={`選取 ${uha}`} />
                          </td>
                          <td className="px-1.5 py-1.5 text-left align-middle">
                            <div className="mb-1 flex flex-wrap gap-0.5">
                              {stages.map((s) => (
                                <span key={s.lab} className={`inline-flex rounded px-1.5 py-0.5 text-[0.65rem] font-bold ${s.cls}`}>
                                  {s.lab}
                                </span>
                              ))}
                            </div>
                            <UhaCodeCell
                              row={r}
                              onAssigned={onUhaAssigned}
                              onContainer={(v) => patch(uha, "containerNo", v)}
                              openDrawer={openDrawer}
                            />
                          </td>
                          <td className="px-1.5 py-1.5 text-center align-middle">
                            <ArriveFtCell
                              arriveDay={r.arriveDay}
                              ftAt={r.ftAt}
                              onArrive={(v) => patch(uha, "arriveDay", v)}
                              onFt={(v) => patch(uha, "ftAt", v)}
                            />
                          </td>
                          <td className="px-1.5 py-1.5 text-left align-middle">
                            <div className="mb-1">
                              <InlineText
                                value={r.product || ""}
                                placeholder="品名"
                                onSave={(v) => patch(uha, "product", v)}
                                rowIndex={rowIndex}
                                colId="product"
                                onNav={navCell}
                                registerFocus={registerFocus}
                              />
                            </div>
                            <div className="grid gap-0.5">
                              <div className="grid grid-cols-[2.2rem_1fr] items-center gap-1">
                                <span className="text-[0.58rem] font-bold text-slate-400">賣方</span>
                                {cell("seller")}
                              </div>
                              <div className="grid grid-cols-[2.2rem_1fr] items-center gap-1">
                                <span className="text-[0.58rem] font-bold text-slate-400">船司</span>
                                {cell("shipCo")}
                              </div>
                              <div className="grid grid-cols-[2.2rem_1fr] items-center gap-1">
                                <span className="text-[0.58rem] font-bold text-slate-400">報關</span>
                                {cell("broker")}
                              </div>
                            </div>
                          </td>
                          <td className="px-1.5 py-1.5 text-center align-middle">
                            <div className="grid grid-cols-2 gap-1">
                              <ClearanceStatusCell
                                value={r.inspect || "none"}
                                at={r.inspectAt}
                                kind="inspect"
                                onStatus={(v) => patch(uha, "inspect", v)}
                                onAt={(v) => patch(uha, "inspectAt", v)}
                              />
                              <ClearanceStatusCell
                                value={r.fumigate || "none"}
                                at={r.fumigateAt}
                                shift={r.fumigateShift}
                                kind="fumigate"
                                onStatus={(v) => patch(uha, "fumigate", v)}
                                onAt={(v) => patch(uha, "fumigateAt", v)}
                                onShift={(v) => patch(uha, "fumigateShift", v)}
                              />
                            </div>
                          </td>
                          <td className="px-1.5 py-1.5 text-left align-middle">
                            <div className="mb-1 grid grid-cols-[2.2rem_1fr] items-center gap-1">
                              <span className="text-[0.58rem] font-bold text-slate-400">碼頭</span>
                              {cell("dock")}
                            </div>
                            <div className="mb-1.5 grid grid-cols-[2.2rem_1fr] items-center gap-1">
                              <span className="text-[0.58rem] font-bold text-slate-400">備註</span>
                              {cell("note")}
                            </div>
                            {!released ? (
                              <button
                                type="button"
                                className="imp-btn-primary px-2 py-1 text-xs"
                                disabled={!canMarkReleased(r)}
                                title={canMarkReleased(r) ? "" : "請先填寫藥檢／薰蒸時間"}
                                onClick={() => markOne(uha)}
                              >
                                放行
                              </button>
                            ) : (
                              <span className="text-[0.7rem] text-slate-400">已放行</span>
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
          <div className="p-2 sm:p-3">
            {!cardRows.length ? (
              <p className="m-0 py-12 text-center text-sm text-slate-400">
                {(portRows || []).length ? "沒有符合搜尋的貨櫃" : "目前沒有待驗貨櫃"}
              </p>
            ) : (
              <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
                {cardRows.map((r) => {
                  const uha = r.uha || r.key;
                  const checked = picked.has(uha);
                  const stages = stageTags(r);
                  return (
                    <li
                      key={uha}
                      data-flash-uha={uha}
                      className={`rounded-xl border ${
                        checked ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200/90 bg-white"
                      }${uha === justAdded ? (addNotice?.existing ? " imp-row-existing" : " imp-row-fresh") : ""}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <label className="flex shrink-0 cursor-pointer items-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-emerald-600"
                              checked={checked}
                              onChange={() => toggle(uha)}
                            />
                          </label>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-sm font-bold tabular-nums text-slate-800">
                            {hasFt(r) ? `FT ${String(r.ftAt || "").slice(5, 10) || "已確認"}` : `到港 ${shortDay(r.arriveDay) || "—"}`}
                          </span>
                          {stages.map((s) => (
                            <span key={s.lab} className={`rounded-md px-2 py-0.5 text-sm font-bold ${s.cls}`}>
                              {s.lab}
                            </span>
                          ))}
                          {isRowPendingUha(r) ? (
                            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-bold text-amber-800">編號待補</span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="imp-btn-primary shrink-0"
                          disabled={!canMarkReleased(r)}
                          title={canMarkReleased(r) ? "" : "請先填寫藥檢／薰蒸時間"}
                          onClick={() => markOne(uha)}
                        >
                          本櫃放行
                        </button>
                      </div>
                      <div className="px-3 py-2">
                        <UhaCodeCell
                          row={r}
                          onAssigned={onUhaAssigned}
                          onContainer={(v) => patch(uha, "containerNo", v)}
                          openDrawer={openDrawer}
                        />
                        <input
                          className="imp-field mt-1"
                          defaultValue={r.product || ""}
                          placeholder="品名"
                          aria-label="品名"
                          onBlur={(e) => {
                            if (e.target.value !== (r.product || "")) patch(uha, "product", e.target.value);
                          }}
                        />
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <ArriveFtCell
                            arriveDay={r.arriveDay}
                            ftAt={r.ftAt}
                            onArrive={(v) => patch(uha, "arriveDay", v)}
                            onFt={(v) => patch(uha, "ftAt", v)}
                          />
                        </div>
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
                        <div className="min-w-0 flex-1 basis-[8.5rem]">
                          <span className="imp-field-lab">藥檢</span>
                          <ClearanceStatusCell
                            value={r.inspect || "none"}
                            at={r.inspectAt}
                            kind="inspect"
                            onStatus={(v) => patch(uha, "inspect", v)}
                            onAt={(v) => patch(uha, "inspectAt", v)}
                          />
                        </div>
                        <div className="min-w-0 flex-1 basis-[8.5rem]">
                          <span className="imp-field-lab">薰蒸</span>
                          <ClearanceStatusCell
                            value={r.fumigate || "none"}
                            at={r.fumigateAt}
                            shift={r.fumigateShift}
                            kind="fumigate"
                            onStatus={(v) => patch(uha, "fumigate", v)}
                            onAt={(v) => patch(uha, "fumigateAt", v)}
                            onShift={(v) => patch(uha, "fumigateShift", v)}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
