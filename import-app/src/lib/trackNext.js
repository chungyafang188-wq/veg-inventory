import { formatMd, isDayReached } from "./dateChip";
import { fumeWhenLab } from "./fumeShift";

/**
 * 依現有欄位推導「下一步」。追蹤頁在這一列直接填。
 */
export function trackNextStep(row) {
  if (!row) return { lab: "—", hint: "", kind: "none" };

  if (!row.released) {
    const insp = row.inspect || "none";
    const fume = row.fumigate || "none";

    if (insp === "wait" || insp === "done") {
      if (!String(row.inspectAt || "").trim()) {
        return { step: "inspectAt", lab: "填出報告日", hint: "需要藥檢：先填出報告日", kind: "action" };
      }
      if (!isDayReached(row.inspectAt)) {
        return {
          step: "inspectWait",
          lab: `等藥檢結果（${formatMd(row.inspectAt) || "—"}）`,
          hint: "到出報告當天起才顯示已出報告、才可放行",
          kind: "wait",
        };
      }
    }

    if (fume === "wait" && !String(row.fumigateAt || "").trim() && !String(row.fumigateShift || "").trim()) {
      return { step: "fumigateAt", lab: "填煙燻班次", hint: "需要煙燻：先填日期和班次", kind: "action" };
    }

    if (row.missingTelex || row.missingData) {
      return { step: "missing", lab: "補齊缺件", hint: row.missingTelex ? "缺電放" : "缺資料", kind: "warn" };
    }

    return { step: "release", lab: "標示放行", hint: "查驗完成後在這列標示已放行", kind: "action" };
  }

  if (!String(row.ftAt || "").trim() && !row.ftConfirmed) {
    return { step: "ft", lab: "填 FT", hint: "已放行：先確認免堆期", kind: "action" };
  }

  if (!String(row.pickupDay || "").trim()) {
    return { step: "pickup", lab: "填領櫃日", hint: "建議預設 FT 前一天", kind: "action" };
  }

  if (!String(row.trailer || "").trim()) {
    return { step: "trailer", lab: "選拖車", hint: "在這列選拖車", kind: "action" };
  }

  if (!String(row.unpackAt || "").trim()) {
    return { step: "unpackAt", lab: "填拆櫃時間", hint: "幾點到，或上班領", kind: "action" };
  }

  const site = String(row.unpackSite || "").trim();
  const dock = String(row.dock || "").trim();
  if (!site || (dock && site === dock)) {
    return { step: "unpackSite", lab: "填拆卸位置", hint: "自己的倉，或客戶冰庫", kind: "action" };
  }

  if (!String(row.assignee || "").trim()) {
    return { step: "assignee", lab: "填拆工", hint: "填妥後即可派工", kind: "action" };
  }

  if (!row.dispatched) {
    return { step: "dispatch", lab: "派工", hint: "時間、位置、拖車都有了就派上排程", kind: "action" };
  }

  return { step: "done", lab: "已完成", hint: "", kind: "done" };
}

export function trackStageBadge(row) {
  if (!row) return { lab: "—", cls: "bg-slate-100 text-slate-600" };
  if (row.dispatched || row.trackFilter === "done") {
    return { lab: "已派工", cls: "bg-slate-200 text-slate-700" };
  }
  if (row.trackFilter === "arranged" || row.pickup) {
    return { lab: "已排櫃", cls: "bg-emerald-100 text-emerald-800" };
  }
  if (row.trackFilter === "arrange" || (row.released && !row.pickup)) {
    return { lab: "待排櫃", cls: "bg-amber-500 text-white" };
  }
  const s = String(row.stageLab || row.status || "報關／檢疫");
  if (s.includes("薰蒸")) return { lab: s, cls: "bg-violet-100 text-violet-800" };
  if (s.includes("藥檢") || s.includes("待驗")) return { lab: s, cls: "bg-amber-100 text-amber-800" };
  return { lab: s || "報關／檢疫", cls: "bg-sky-100 text-sky-800" };
}

export function inspectFumeSummary(row) {
  const insp = row?.inspect || "none";
  const fume = row?.fumigate || "none";
  const inspAt = String(row.inspectAt || "").trim();
  let inspLab = "待確認";
  if (insp === "skip") inspLab = "無須檢驗";
  else if (inspAt && !isDayReached(inspAt)) inspLab = `待藥檢結果 ${formatMd(inspAt)}`;
  else if (insp === "wait" || insp === "done") inspLab = inspAt ? `已出報告 ${formatMd(inspAt)}` : "需要藥檢";
  else if (inspAt) inspLab = `已出報告 ${formatMd(inspAt)}`;

  let fumeLab = "待確認";
  if (fume === "skip") fumeLab = "無須薰蒸";
  else if (fume === "wait") {
    const when = fumeWhenLab(row.fumigateAt, row.fumigateShift);
    fumeLab = when ? `待煙燻 ${when}` : "需要煙燻";
  } else if (fume === "done") fumeLab = "薰蒸完成";
  else {
    const when = fumeWhenLab(row.fumigateAt, row.fumigateShift);
    if (when) fumeLab = `待煙燻 ${when}`;
  }

  return { inspLab, fumeLab };
}
