import { useEffect, useRef, useState } from "react";

const viewCls =
  "inline-flex max-w-full min-h-[1.5rem] items-center rounded px-1.5 py-0.5 text-left text-[0.82rem] font-semibold text-slate-800 transition-colors hover:bg-gray-100 cursor-pointer";
const emptyCls = "font-medium text-slate-400";

/**
 * Click-to-edit：預設純文字，點擊才出現 input／select。
 */
export function InlineEdit({
  value,
  onChange,
  mode = "text",
  options = [],
  emptyLab = "點擊填寫",
  disabled = false,
  listId,
  className = "",
  ariaLabel,
  commitOnChange = false,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value || ""));
  const ref = useRef(null);
  const show = String(value || "").trim();

  useEffect(() => {
    if (!editing) setDraft(String(value || ""));
  }, [value, editing]);

  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    if (mode === "text" && typeof el.select === "function") {
      try {
        el.select();
      } catch {
        /* ignore */
      }
    }
  }, [editing, mode]);

  const commit = (raw) => {
    const next = String(raw ?? draft).trim();
    const prev = String(value || "").trim();
    if (next !== prev) onChange?.(next);
    setEditing(false);
  };

  if (disabled) {
    return (
      <span className={`inline-flex min-h-[1.5rem] items-center px-1.5 py-0.5 text-[0.82rem] font-semibold text-slate-500 ${className}`}>
        {show || "—"}
      </span>
    );
  }

  if (editing) {
    if (mode === "select") {
      return (
        <select
          ref={ref}
          className={`imp-field max-w-full ${className}`}
          value={draft}
          aria-label={ariaLabel || emptyLab}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            if (commitOnChange) {
              onChange?.(v);
              setEditing(false);
            }
          }}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
          }}
        >
          <option value="">{emptyLab}</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          {show && !options.includes(show) ? <option value={show}>{show}</option> : null}
        </select>
      );
    }

    return (
      <input
        ref={ref}
        type="text"
        className={`imp-field max-w-full ${className}`}
        value={draft}
        list={listId}
        aria-label={ariaLabel || emptyLab}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className={`${viewCls} ${show ? "" : emptyCls} ${className}`}
      onClick={() => setEditing(true)}
      aria-label={ariaLabel || emptyLab}
      title={show || emptyLab}
    >
      <span className="truncate">{show || emptyLab}</span>
    </button>
  );
}
