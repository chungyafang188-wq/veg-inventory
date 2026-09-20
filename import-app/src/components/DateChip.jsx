import { useEffect, useRef, useState } from "react";
import { formatMd, formatMdHm, toDateInput, toDateTimeInput } from "../lib/dateChip";

/**
 * 點擊編輯的日期／時間晶片（顯示 MM/DD 或 MM/DD HH:mm，隱藏年份）
 */
export function DateChip({
  value,
  onChange,
  mode = "date",
  prefix = "",
  emptyLab = "點擊填寫",
  disabled = false,
  className = "",
  ariaLabel,
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef(null);
  const show = mode === "datetime" ? formatMdHm(value) : formatMd(value);
  const inputVal = mode === "datetime" ? toDateTimeInput(value) : toDateInput(value);

  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    try {
      el.showPicker?.();
    } catch {
      /* ignore */
    }
  }, [editing]);

  if (disabled) {
    return (
      <span className={`inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[0.72rem] font-semibold text-slate-500 ${className}`}>
        {prefix}
        {show || "—"}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type={mode === "datetime" ? "datetime-local" : "date"}
        className={`imp-field imp-field-at max-w-[11rem] ${className}`}
        value={inputVal}
        aria-label={ariaLabel || prefix || emptyLab}
        onChange={(e) => {
          const v = e.target.value;
          onChange?.(v);
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") {
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
      className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[0.72rem] font-bold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 ${
        show ? "" : "text-slate-400"
      } ${className}`}
      onClick={() => setEditing(true)}
      aria-label={ariaLabel || prefix || emptyLab}
    >
      {prefix ? <span className="font-semibold text-slate-400">{prefix}</span> : null}
      <span>{show || emptyLab}</span>
    </button>
  );
}
