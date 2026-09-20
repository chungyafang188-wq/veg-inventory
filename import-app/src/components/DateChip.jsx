import { useEffect, useRef, useState } from "react";
import { formatMd, formatMdHm, toDateInput, toDateTimeInput } from "../lib/dateChip";

/**
 * 點擊編輯的日期／時間：預設純文字 MM/DD，點擊才開 picker。
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
  const label = show ? (prefix ? `${prefix} ${show}` : show) : emptyLab;

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
      <span className={`inline-flex min-h-[1.5rem] items-center px-1.5 py-0.5 text-[0.82rem] font-semibold text-slate-500 ${className}`}>
        {label || "—"}
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
        onChange={(e) => onChange?.(e.target.value)}
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
      className={`inline-flex max-w-full min-h-[1.5rem] items-center rounded px-1.5 py-0.5 text-left text-[0.82rem] font-semibold transition-colors hover:bg-gray-100 cursor-pointer ${
        show ? "text-slate-800" : "text-slate-400 font-medium"
      } ${className}`}
      onClick={() => setEditing(true)}
      aria-label={ariaLabel || prefix || emptyLab}
      title={label}
    >
      {prefix && show ? <span className="mr-1 font-medium text-slate-400">{prefix}</span> : null}
      <span>{show || emptyLab}</span>
    </button>
  );
}
