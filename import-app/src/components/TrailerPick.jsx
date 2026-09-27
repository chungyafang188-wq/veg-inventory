import { useState } from "react";

export const TRAILER_OPTS = ["旭興", "瑋崧", "阿彬", "智行", "尚鴻"];

const TRAILER_ALIAS = {
  旭: "旭興",
  旭興: "旭興",
  瑋: "瑋崧",
  瑋菘: "瑋崧",
  瑋崧: "瑋崧",
  偉菘: "瑋崧",
  彬: "阿彬",
  斌: "阿彬",
  阿彬: "阿彬",
  智行: "智行",
  尚鴻: "尚鴻",
};

/** 固定拖車。舊簡寫對到正式名稱；不在名單裡的當其他，自填。 */
export function TrailerPick({ value, onChange, disabled = false }) {
  const raw = String(value || "").trim();
  const canon = TRAILER_ALIAS[raw] || "";
  const custom = !!raw && !canon;
  const [otherOn, setOtherOn] = useState(false);
  const showOther = otherOn || custom;

  return (
    <span className="imp-trailer-pick">
      <select
        aria-label="拖車"
        disabled={disabled}
        value={canon || (showOther ? "__other" : "")}
        onChange={(e) => {
          const next = e.target.value;
          if (next === "__other") {
            setOtherOn(true);
            return;
          }
          setOtherOn(false);
          onChange?.(next);
        }}
      >
        <option value="">選拖車</option>
        {TRAILER_OPTS.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value="__other">其他</option>
      </select>
      {showOther ? (
        <input
          key={custom ? raw : "other"}
          aria-label="其他拖車"
          disabled={disabled}
          defaultValue={custom ? raw : ""}
          placeholder="自填"
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next !== raw) onChange?.(next);
          }}
        />
      ) : null}
    </span>
  );
}
