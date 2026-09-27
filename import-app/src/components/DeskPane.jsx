import { useMemo, useState } from "react";
import { api } from "../bridge";
import { formatMd } from "../lib/dateChip";
import { HandoverTime, todayStamp } from "./HandoverTime";
import { TrailerPick } from "./TrailerPick";
import { fumeWhenLab, needsFumeHold } from "../lib/fumeShift";
import { filterRows, uhaTailNum } from "../lib/listQuery";
import { customerNoticeText, pasteGaps, trailerNoticeText } from "../lib/notifyCopy";
import { inspectFumeSummary } from "../lib/trackNext";
import { DupCompare } from "./DupCompare";

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

function hasRealUha(row) {
  if (row?.pendingUha) return false;
  const s = String(row?.uha || "").trim();
  if (!s || /^待編-/i.test(s) || /^TMP-/i.test(s) || /^(UHA|NC)\s*$/i.test(s)) return false;
  return /^(UHA|NC)\d+/i.test(s);
}

function uhaLab(row) {
  const s = String(row?.uha || "").trim();
  if (!s || row?.pendingUha || /^待編-/i.test(s) || /^TMP-/i.test(s) || /^(UHA|NC)\s*$/i.test(s)) return "編號待補";
  return s;
}

function missingBits(row) {
  const bits = [];
  if (!String(row?.containerNo || "").trim()) bits.push("櫃號");
  if (!String(row?.product || "").trim()) bits.push("品名");
  if (!String(row?.trailer || "").trim()) bits.push("拖車");
  if (!String(row?.unpackAt || "").trim() && !String(row?.pickupDay || "").trim()) bits.push("拆櫃日");
  if (!String(row?.unpackSite || "").trim()) bits.push("位置");
  return bits;
}

function deskLab(row) {
  const unpacked = !!(row?.dispatched || row?.trackFilter === "done");
  if (unpacked) {
    const miss = missingBits(row);
    return miss.length ? `已拆櫃，尚缺：${miss.join("、")}` : "已拆櫃";
  }
  if (!row?.released) {
    const { inspLab, fumeLab } = inspectFumeSummary(row);
    if (String(inspLab).startsWith("待藥檢") || inspLab === "需要藥檢") return inspLab;
    if (needsFumeHold(row) || String(fumeLab).startsWith("待煙燻") || fumeLab === "需要煙燻") return fumeLab;
    return "海關查驗中";
  }
  if (needsFumeHold(row)) {
    const when = fumeWhenLab(row.fumigateAt, row.fumigateShift);
    return when ? `已放行，待煙燻 ${when}` : "已放行，待煙燻";
  }
  const miss = missingBits(row);
  if (miss.length) return `已放行，尚缺：${miss.join("、")}`;
  if (row.notifyCustomer && row.notifyTrailer) return "已確認，客人與拖車都轉貼過";
  if (row.notifyCustomer) return "已確認，可再轉貼拖車";
  if (row.notifyTrailer) return "已確認，可再轉貼客人";
  return "已確認，可轉貼";
}

function whenLab(row) {
  return formatMd(row?.unpackAt || row?.pickupDay || row?.ftAt || "") || "";
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function canMark(row) {
  const pending = !!(row?.pendingUha || /^待編-/i.test(row?.uha || "") || /^(UHA|NC)\s*$/i.test(String(row?.uha || "").trim()));
  const uhaOk = !!String(row?.uha || "").trim() && !pending;
  const boxOk = !!String(row?.containerNo || "").trim();
  const productOk = !!String(row?.product || "").trim();
  return (uhaOk || boxOk) && productOk;
}

function DeskRow({ row, unpackers, onSaved }) {
  const [open, setOpen] = useState("");
  const [note, setNote] = useState("");
  const [fillOpen, setFillOpen] = useState(false);
  const [dup, setDup] = useState(null);
  const lab = deskLab(row);
  const unpacked = !!(row.dispatched || row.trackFilter === "done");
  const customer = customerNoticeText(row);
  const trailerText = trailerNoticeText(row);
  const showPaste = !!row.released || unpacked;
  const gaps = pasteGaps(row);
  const miss = missingBits(row);
  const text = open === "customer" ? customer : open === "trailer" ? trailerText : "";
  const workers = unpackers?.length ? unpackers : ["阿宏", "靜宜", "自行拆櫃"];

  const patch = (field, value) => {
    if (row.released) api().patchReleaseField?.(row.uha, field, value);
    else if (api().patchPortField?.(row.uha, field, value) === false) api().patchReleaseField?.(row.uha, field, value);
    onSaved?.();
  };
  const fill = (field, value) => {
    const next = String(value || "").trim();
    if (!next || next === "0") {
      setNote("空白不會寫進去。");
      return;
    }
    const ok = api().fillReleaseBlank?.(row.uha, field, next);
    if (ok && ok.duplicate) {
      setDup({ via: ok.duplicate.via || "櫃號", existing: ok.duplicate, typed: ok.typed });
      setNote("這櫃號已經在另一筆，沒有寫進去。");
      return;
    }
    setNote(ok ? "已補上這一格，原來有的內容沒有被蓋掉。" : "這一格已經有內容，沒有蓋掉。");
    if (ok) onSaved?.();
  };
  const useShift = () => {
    if (!String(row.unpackAt || "").trim()) {
      api().patchReleaseField?.(row.uha, "unpackAt", todayStamp());
    }
    api().patchReleaseField?.(row.uha, "unpackShift", true);
    setNote("交櫃時間記成上班領。");
    onSaved?.();
  };
  const mark = () => {
    const ok = api().markDeskUnpacked?.(row.uha);
    setNote(ok ? "已標成已拆櫃，改到總表。缺的欄位之後再補。" : "要有編號或櫃號，再加上品名。");
    if (ok) onSaved?.();
  };
  const copy = async (kind) => {
    setOpen(kind);
    if (gaps.length) {
      setNote(`尚缺${gaps.join("、")}，先不要貼出空白通知。`);
      return;
    }
    const body = kind === "customer" ? customer : trailerText;
    const ok = await copyText(body);
    setNote(ok ? "已複製，可貼到對話。這次不會改成已通知。" : "瀏覽器沒有複製成功，請直接選下面的文字。");
  };

  return (
    <article className={`imp-desk-row${unpacked ? " is-done" : ""}`}>
      <DupCompare notice={dup} onClose={() => setDup(null)} />
      <div className="imp-desk-row-top">
        <div className="imp-desk-idline">
          <strong>{uhaLab(row)}</strong>
          <span className={`imp-desk-box${row.containerNo ? "" : " is-empty"}`}>{row.containerNo || "尚無櫃號"}</span>
          {unpacked && miss.length ? (
            <button type="button" className="imp-desk-lab is-done" onClick={() => setFillOpen((v) => !v)}>
              {lab}
            </button>
          ) : (
            <span className={`imp-desk-lab${lab.startsWith("已確認") ? " is-ready" : ""}${unpacked ? " is-done" : ""}`}>{lab}</span>
          )}
        </div>
      </div>
      <p className="imp-desk-meta">
        {[
          row.product || "尚無品名",
          row.deliverTo ? `交貨 ${row.deliverTo}` : "",
          row.arriveDay ? `到港 ${formatMd(row.arriveDay)}` : "",
          row.seller ? `賣方 ${row.seller}` : "",
          row.trailer ? `拖車 ${row.trailer}` : "",
          row.unpackSite || "",
          row.assignee ? `拆工 ${row.assignee}` : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {!unpacked ? (
        <div className="imp-desk-fields">
          <div className={`imp-desk-line${row.released ? " is-two" : ""}`}>
            {!row.released ? (
              <label>
                拖車
                <TrailerPick value={row.trailer || ""} onChange={(v) => patch("trailer", v)} />
              </label>
            ) : null}
            <label>
              {row.released ? "交貨對象" : "客戶"}
              <input
                defaultValue={row.deliverTo || ""}
                placeholder={row.released ? "客戶名稱，有填就改成交客戶" : "客戶名稱，可空白"}
                onBlur={(e) => patch("deliverTo", e.target.value)}
              />
              <span className="imp-desk-dest">{String(row.deliverTo || "").trim() || row.destType === "customer" ? "去向：交客戶" : "去向：自有冰庫"}</span>
            </label>
            <label>
              拆卸位置
              <input list="imp-desk-sites" defaultValue={row.unpackSite || ""} placeholder="自填，或選以前用過的" onBlur={(e) => patch("unpackSite", e.target.value)} />
            </label>
          </div>
          <div className="imp-desk-line is-shift">
            <label>
              拆工
              <select defaultValue={row.assignee || ""} onChange={(e) => patch("assignee", e.target.value)}>
                <option value="">尚未指派</option>
                {workers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className="imp-desk-time">
              <label>
                交櫃時間
                <HandoverTime value={row.unpackAt || row.pickupDay || ""} onCommit={(v) => patch("unpackAt", v)} />
              </label>
              <button type="button" className="imp-desk-btn" onClick={useShift}>
                {row.unpackShift ? "已記上班領" : "上班領"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {unpacked && fillOpen ? (
        <div className="imp-desk-fields">
          {miss.includes("櫃號") ? (
            <label>
              櫃號
              <input placeholder="只補空白" onBlur={(e) => fill("containerNo", e.target.value)} />
            </label>
          ) : null}
          {miss.includes("品名") ? (
            <label>
              品名
              <input placeholder="只補空白" onBlur={(e) => fill("product", e.target.value)} />
            </label>
          ) : null}
          {miss.includes("拖車") ? (
            <label>
              拖車
              <TrailerPick value="" onChange={(v) => fill("trailer", v)} />
            </label>
          ) : null}
          {miss.includes("拆櫃日") ? (
            <label>
              拆櫃日
              <HandoverTime fillOnly value="" onCommit={(v) => fill("unpackAt", v)} />
            </label>
          ) : null}
          {miss.includes("位置") ? (
            <label>
              拆卸位置
              <input list="imp-desk-sites" placeholder="只補空白" onBlur={(e) => fill("unpackSite", e.target.value)} />
            </label>
          ) : null}
          {!String(row.assignee || "").trim() ? (
            <label>
              拆工
              <select defaultValue="" onChange={(e) => fill("assignee", e.target.value)}>
                <option value="">尚未指派</option>
                {workers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
      {unpacked ? (
        <label className="imp-desk-who">
          交貨對象
          <input defaultValue={row.deliverTo || ""} placeholder="客戶名稱，有填就改成交客戶" onBlur={(e) => patch("deliverTo", e.target.value)} />
          <span className="imp-desk-dest">{String(row.deliverTo || "").trim() || row.destType === "customer" ? "去向：交客戶" : "去向：自有冰庫"}</span>
        </label>
      ) : null}
      {!unpacked && canMark(row) ? (
        <div className="imp-desk-actions">
          <button type="button" className="imp-desk-btn is-solid" onClick={mark}>
            標成已拆櫃
          </button>
        </div>
      ) : null}
      {showPaste ? (
        <div className="imp-desk-actions">
          <button type="button" className="imp-desk-btn" disabled={!!gaps.length} onClick={() => copy("customer")}>
            轉貼客人
          </button>
          <button type="button" className="imp-desk-btn" disabled={!!gaps.length} onClick={() => copy("trailer")}>
            轉貼拖車
          </button>
          {gaps.length ? <span className="imp-desk-gapnote">尚缺{gaps.join("、")}，補齊後再複製。</span> : null}
        </div>
      ) : (
        <p className="imp-desk-wait">藥檢、薰蒸仍在左邊的海關查驗。這裡可先填，還沒放行也能標成已拆櫃。</p>
      )}
      {open && text ? <pre className="imp-desk-paste">{text}</pre> : null}
      {note ? <p className="imp-desk-note">{note}</p> : null}
    </article>
  );
}

const DESK_SEARCH = ["uha", "containerNo", "product", "seller", "trailer", "deliverTo", "unpackSite", "assignee", "dock", "note", (r) => deskLab(r)];

export function DeskPane({ title, trackRows, allRows, trailers = [], unpackers = [], refresh }) {
  const [sheet, setSheet] = useState("track");
  const [query, setQuery] = useState("");
  const [onlyGap, setOnlyGap] = useState(false);
  const [copiedSheet, setCopiedSheet] = useState("");
  const sites = api().deliverySiteHints?.() || [];
  const track = useMemo(() => (trackRows || []).filter(hasRealUha), [trackRows]);
  const all = useMemo(() => {
    const list = (allRows || []).filter(hasRealUha);
    list.sort((a, b) => {
      const ta = uhaTailNum(a.uha);
      const tb = uhaTailNum(b.uha);
      if (ta == null && tb == null) return String(a.uha || "").localeCompare(String(b.uha || ""));
      if (ta == null) return 1;
      if (tb == null) return -1;
      return ta - tb;
    });
    return list;
  }, [allRows]);
  const searching = !!String(query || "").trim();
  const base = sheet === "all" ? all : track;
  const pool = searching ? all : base;
  const matched = searching ? filterRows(pool, query, DESK_SEARCH) : pool;
  const rows = !searching && sheet === "all" && onlyGap ? matched.filter((r) => missingBits(r).length) : matched;
  const heading = searching ? "搜尋結果" : sheet === "all" ? "總表" : "還沒結束";

  const exportSheet = () => {
    const headers = ["狀態", "編號", "櫃號", "到港", "品名", "賣方", "交貨對象", "拖車", "位置", "拆櫃日", "拆工"];
    const data = rows.map((r) => ({
      狀態: deskLab(r),
      編號: uhaLab(r),
      櫃號: r.containerNo || "",
      到港: r.arriveDay || "",
      品名: r.product || "",
      賣方: r.seller || "",
      交貨對象: r.deliverTo || "",
      拖車: r.trailer || "",
      位置: r.unpackSite || "",
      拆櫃日: whenLab(r),
      拆工: r.assignee || "",
    }));
    const day = new Date().toISOString().slice(0, 10);
    downloadCsv(`${heading}_${rows.length}筆_${day}.csv`, headers, data);
    setCopiedSheet(`已匯出${heading} ${rows.length} 筆。`);
  };

  return (
    <div className="imp-desk">
      <datalist id="imp-desk-sites">
        {sites.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <header className="imp-desk-head">
        <h2>{title || "追櫃工作台"}</h2>
        <p>編號還沒補的留在海關查驗，補完才進這裡。還沒放行可先填拖車、預排客戶、交櫃時間、拆卸位置、拆工。放行後交貨對象仍可改。已拆櫃留在總表，缺的再補。</p>
        <label className="imp-desk-find">
          <span>全站搜尋</span>
          <input
            type="search"
            value={query}
            placeholder="編號、櫃號、品名、賣方、拖車、客戶、拆工"
            aria-label="全站搜尋貨櫃"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {searching ? <p className="imp-desk-find-note">全站找到 {rows.length} 筆，含已拆櫃。清空即回到目前清單。</p> : null}
      </header>
      <div className="imp-desk-sheets" role="tablist" aria-label="匯出清單">
        <button type="button" className={sheet === "track" ? "is-on" : ""} onClick={() => setSheet("track")}>
          <b>{track.length}</b>
          <span>追櫃清單</span>
          <small>還沒結束</small>
        </button>
        <button type="button" className={sheet === "all" ? "is-on" : ""} onClick={() => setSheet("all")}>
          <b>{all.length}</b>
          <span>總表</span>
          <small>含已拆櫃</small>
        </button>
      </div>
      <div className="imp-desk-export">
        <button type="button" className="imp-desk-btn is-solid" onClick={exportSheet} disabled={!rows.length}>
          匯出{heading}
        </button>
        {sheet === "all" ? (
          <button type="button" className={`imp-desk-btn${onlyGap ? " is-solid" : ""}`} onClick={() => setOnlyGap((v) => !v)}>
            待補資料
          </button>
        ) : null}
        {copiedSheet ? <span>{copiedSheet}</span> : null}
      </div>
      <h3>
        {heading}
        <span> {rows.length} 櫃</span>
      </h3>
      {!rows.length ? <p className="imp-desk-wait">這張清單目前沒有櫃子。</p> : null}
      <div className="imp-desk-list">
        {rows.map((r) => (
          <DeskRow key={r.uha || r.key} row={r} unpackers={unpackers} onSaved={refresh} />
        ))}
      </div>
    </div>
  );
}
