import { useState } from "react";
import { parseDateTimePart } from "../lib/dateChip";

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 拆櫃時間：日期用日曆，時間用時、分。 */
export function HandoverTime({ value, onCommit, fillOnly, dateLabel = "交櫃日期" }) {
  const parsed = parseDateTimePart(value);
  const day = parsed?.day || "";
  const hh = parsed?.hh == null ? "" : pad2(parsed.hh);
  const mm = parsed?.mm == null ? "" : pad2(parsed.mm);
  const [draft, setDraft] = useState(null);
  const shown = draft || { day, hh, mm };
  const hours = Array.from({ length: 24 }, (_, i) => pad2(i));
  const minuteBase = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
  const minutes = shown.mm && !minuteBase.includes(shown.mm) ? [shown.mm, ...minuteBase] : minuteBase;

  const commit = (next) => {
    if (fillOnly) setDraft(next);
    if (!next.day) return;
    if (!next.hh) {
      if (!fillOnly) onCommit?.(next.day);
      return;
    }
    const minute = next.mm || "00";
    onCommit?.(`${next.day}T${next.hh}:${minute}`);
    if (fillOnly) setDraft(null);
  };

  return (
    <div className="imp-desk-when">
      <input type="date" aria-label={dateLabel} value={shown.day} onChange={(e) => commit({ ...shown, day: e.target.value })} />
      <select aria-label="時" value={shown.hh} onChange={(e) => commit({ ...shown, day: shown.day || todayStamp(), hh: e.target.value, mm: shown.mm || "00" })}>
        <option value="">時</option>
        {hours.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <select aria-label="分" value={shown.mm} onChange={(e) => commit({ ...shown, day: shown.day || todayStamp(), hh: shown.hh || "08", mm: e.target.value })}>
        <option value="">分</option>
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
