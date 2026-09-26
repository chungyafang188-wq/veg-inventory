import { DateChip } from "./DateChip";
import { FUME_SHIFTS } from "../lib/fumeShift";

/** 煙燻：選日期，班次固定第一班到第四班。 */
export function FumeWhenFields({ at, shift, onAt, onShift, compact = false }) {
  const day = String(at || "").slice(0, 10);
  const cur = String(shift || "");
  return (
    <div className={compact ? "imp-fume-when" : "grid gap-1"}>
      <DateChip
        mode="date"
        value={day}
        emptyLab="煙燻日"
        ariaLabel="煙燻日期"
        onChange={(v) => onAt?.(String(v || "").slice(0, 10))}
      />
      <div className="imp-fume-shifts" role="group" aria-label="煙燻班次">
        {FUME_SHIFTS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`imp-fume-shift${cur === s.id ? " is-on" : ""}`}
            aria-pressed={cur === s.id}
            onClick={() => onShift?.(cur === s.id ? "" : s.id)}
          >
            {s.lab}
          </button>
        ))}
      </div>
    </div>
  );
}
