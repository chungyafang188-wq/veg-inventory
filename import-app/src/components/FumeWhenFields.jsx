import { DateChip } from "./DateChip";
import { HandoverTime, todayStamp } from "./HandoverTime";
import { FUME_SHIFTS } from "../lib/fumeShift";

/** 煙燻：選日期和班次。需要時可同時預排拆櫃時間。 */
export function FumeWhenFields({
  at,
  shift,
  onAt,
  onShift,
  unpackAt,
  unpackShift,
  onUnpackAt,
  onUnpackShift,
  compact = false,
}) {
  const day = String(at || "").slice(0, 10);
  const cur = String(shift || "");
  const canUnpack = typeof onUnpackAt === "function";
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
      {canUnpack ? (
        <div className="imp-fume-unpack">
          <span>預排拆櫃</span>
          <HandoverTime dateLabel="拆櫃日期" value={unpackAt || ""} onCommit={(v) => onUnpackAt(v)} />
          <button
            type="button"
            className={`imp-fume-shift${unpackShift ? " is-on" : ""}`}
            onClick={() => {
              const next = !unpackShift;
              onUnpackShift?.(next);
              if (next && !String(unpackAt || "").trim()) onUnpackAt(todayStamp());
            }}
          >
            上班領
          </button>
        </div>
      ) : null}
    </div>
  );
}
