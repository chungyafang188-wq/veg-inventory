import { useMemo, useRef, useState } from "react";
import { api, setStatus } from "../bridge";

const btn =
  "inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-[0.8rem] font-semibold text-slate-700 hover:bg-slate-50";
const btnOn = "inline-flex cursor-pointer items-center justify-center rounded-md border border-emerald-600 bg-emerald-600 px-3 py-2 text-[0.8rem] font-bold text-white hover:bg-emerald-700";

const FILTERS = [
  ["all", "全部"],
  ["done", "已派工"],
  ["customer", "交客戶"],
  ["open", "還在作業"],
];

function canRemoveImport() {
  return typeof window.can !== "function" || window.can("delete");
}

/**
 * 已匯入的櫃子：勾選測試、已派工、交到客戶的，從追蹤清單拿掉。
 */
function formatRemovedAt(v) {
  const s = String(v || "");
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return s || "—";
  return m[4] ? `${Number(m[2])}/${Number(m[3])} ${m[4]}:${m[5]}` : `${Number(m[2])}/${Number(m[3])}`;
}

function CleanupList({ refresh }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  const [rev, setRev] = useState(0);
  const rows = useMemo(() => api().listImportCleanup?.() || [], [rev]);
  const removed = useMemo(() => api().listImportRemoved?.() || [], [rev]);
  const q = query.trim().toLowerCase().replace(/\s+/g, "");
  const shown = rows.filter((r) => {
    if (filter === "done" && r.bucket !== "done") return false;
    if (filter === "customer" && !r.customer) return false;
    if (filter === "open" && r.bucket !== "open") return false;
    if (!q) return true;
    const hay = `${r.uha} ${r.containerNo} ${r.product} ${r.site} ${r.note} ${r.trailer}`.toLowerCase().replace(/\s+/g, "");
    return hay.includes(q);
  });
  const counts = {
    all: rows.length,
    done: rows.filter((r) => r.bucket === "done").length,
    customer: rows.filter((r) => r.customer).length,
    open: rows.filter((r) => r.bucket === "open").length,
  };
  const shownKeys = shown.map((r) => r.uha);
  const allShown = shownKeys.length > 0 && shownKeys.every((k) => picked.has(k));

  const toggle = (uha) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(uha)) next.delete(uha);
      else next.add(uha);
      return next;
    });
  };

  const selectBucket = (bucket) => {
    setPicked((prev) => {
      const next = new Set(prev);
      for (const r of rows) {
        if (bucket === "customer" ? r.customer : r.bucket === bucket) next.add(r.uha);
      }
      return next;
    });
  };

  const removePicked = () => {
    const list = rows.filter((r) => picked.has(r.uha));
    if (!list.length) return;
    if (!canRemoveImport()) {
      setStatus?.("沒有刪除權限。", true);
      return;
    }
    const names = list
      .slice(0, 12)
      .map((r) => `${r.uha} ${r.containerNo || ""}`.trim())
      .join("\n");
    const more = list.length > 12 ? `\n…另 ${list.length - 12} 櫃` : "";
    const ok = window.confirm(
      `把這 ${list.length} 櫃記入刪除清單？\n海關查驗、已放行、貨櫃追蹤不會再出現。\n刪除清單仍算在合計裡，可以再放回。\n拆櫃回報和進庫紀錄若已經有，會留下。\n\n${names}${more}`,
    );
    if (!ok) return;
    const n = api().removeImportTracking?.(list.map((r) => r.uha)) || 0;
    setPicked(new Set());
    setRev((v) => v + 1);
    refresh?.();
    if (n) setStatus?.(`已記入刪除清單 ${n} 櫃。合計仍算在內。`);
  };

  const restoreOne = (uha) => {
    if (!window.confirm(`把 ${uha} 放回進口清單？`)) return;
    api().restoreImportTracking?.(uha);
    setRev((v) => v + 1);
    refresh?.();
  };

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50/40 p-3">
      <h3 className="m-0 text-sm font-bold text-slate-800">整理已匯入的櫃子</h3>
      <p className="mt-1 mb-0 text-[0.72rem] leading-relaxed text-slate-600">
        清單上 {rows.length}　已刪除 {removed.length}　合計 {rows.length + removed.length}。刪掉的會留在下面，不會憑空消失。
      </p>
      <p className="mt-1 mb-0 text-[0.72rem] leading-relaxed text-slate-600">
        櫃號、品名打錯，直接在海關查驗或已放行那一列改。測試、已派工、交客戶要拿掉時，勾這裡。
      </p>
      <input
        type="search"
        className="imp-field mt-2 w-full"
        placeholder="櫃號、編號、品名"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="整理清單搜尋"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FILTERS.map(([id, lab]) => (
          <button key={id} type="button" className={filter === id ? "imp-chip imp-chip-on" : "imp-chip"} onClick={() => setFilter(id)}>
            {lab} {counts[id] ?? 0}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" className={btn} onClick={() => selectBucket("done")} disabled={!counts.done}>
          勾選已派工
        </button>
        <button type="button" className={btn} onClick={() => selectBucket("customer")} disabled={!counts.customer}>
          勾選交客戶
        </button>
        <button type="button" className={btn} onClick={() => setPicked(new Set())} disabled={!picked.size}>
          清除勾選
        </button>
      </div>
      {!shown.length ? (
        <p className="m-0 mt-3 text-center text-sm text-slate-400">{rows.length ? "這個條件沒有櫃子" : "目前沒有已匯入的櫃子"}</p>
      ) : (
        <ul className="m-0 mt-3 grid list-none gap-1.5 p-0">
          <li className="flex items-center gap-2 px-1 text-[0.72rem] font-semibold text-slate-500">
            <input
              type="checkbox"
              checked={allShown}
              onChange={() => {
                setPicked((prev) => {
                  const next = new Set(prev);
                  if (allShown) shownKeys.forEach((k) => next.delete(k));
                  else shownKeys.forEach((k) => next.add(k));
                  return next;
                });
              }}
              aria-label="全選這頁"
            />
            全選這頁
          </li>
          {shown.map((r) => (
            <li key={r.uha} className="flex items-start gap-2 rounded-lg border border-slate-200/80 bg-white px-2 py-2">
              <input className="mt-1" type="checkbox" checked={picked.has(r.uha)} onChange={() => toggle(r.uha)} aria-label={`選取 ${r.uha}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <strong className="tabular-nums text-slate-800">{r.uha}</strong>
                  <span className={`inline-flex rounded px-1.5 py-0.5 text-[0.65rem] font-bold ${r.bucket === "done" ? "bg-slate-200 text-slate-700" : r.bucket === "customer" ? "bg-amber-200 text-amber-950" : "bg-sky-100 text-sky-800"}`}>
                    {r.lab}
                  </span>
                  {r.customer && r.bucket !== "customer" ? (
                    <span className="inline-flex rounded bg-amber-200 px-1.5 py-0.5 text-[0.65rem] font-bold text-amber-950">交客戶</span>
                  ) : null}
                </div>
                <div className="font-mono text-xs text-slate-400">{r.containerNo || "無櫃號"}</div>
                <p className="m-0 mt-0.5 text-sm font-semibold text-slate-800">{r.product || "—"}</p>
                <p className="m-0 mt-0.5 text-[0.72rem] text-slate-500">
                  {[r.site ? `位置 ${r.site}` : "", r.trailer ? `拖車 ${r.trailer}` : "", r.note].filter(Boolean).join(" · ") || "尚未填位置"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="imp-btn-primary mt-3" disabled={!picked.size || !canRemoveImport()} onClick={removePicked}>
        記入刪除清單{picked.size ? `（${picked.size}）` : ""}
      </button>
      {!canRemoveImport() ? <p className="m-0 mt-1 text-[0.72rem] text-slate-500">這支帳號不能刪。請用主管帳號操作。</p> : null}
      <h4 className="mb-0 mt-4 text-sm font-bold text-slate-800">已刪除 {removed.length}</h4>
      {!removed.length ? (
        <p className="m-0 mt-1 text-[0.72rem] text-slate-500">還沒有刪掉的櫃子。</p>
      ) : (
        <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
          {removed.map((r) => (
            <li key={r.uha} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
              <div className="min-w-0 flex-1">
                <strong className="tabular-nums text-slate-800">{r.uha}</strong>
                <span className="ml-2 font-mono text-xs text-slate-400">{r.containerNo || "無櫃號"}</span>
                <p className="m-0 mt-0.5 text-sm text-slate-700">{r.product || "—"}{r.seller ? ` · ${r.seller}` : ""}</p>
                <p className="m-0 text-[0.68rem] text-slate-400">刪於 {formatRemovedAt(r.removedAt)}</p>
              </div>
              <button type="button" className={btn} onClick={() => restoreOne(r.uha)}>
                放回
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * 舊資料：下載空白格式自行填寫匯入（避開亂比對），另保留舊 Excel／種子。
 */
export function FilesPane({ title, refresh }) {
  const [busy, setBusy] = useState("");
  const portRef = useRef(null);
  const relRef = useRef(null);
  const arrRef = useRef(null);

  const download = (kind) => {
    api().downloadImportTemplate?.(kind);
  };

  const onFile = async (kind, file) => {
    if (!file) return;
    setBusy(kind);
    try {
      const result = await api().importTemplateFile?.(file, kind);
      refresh?.();
      const added = result?.added ?? 0;
      const updated = result?.updated ?? 0;
      const skipped = result?.skipped ?? 0;
      const total = result?.total ?? result?.n ?? (typeof result === "number" ? result : 0);
      const msg =
        skipped > 0
          ? `已匯入 ${total} 筆（新增 ${added}、更新 ${updated}、略過 ${skipped}）。`
          : `已匯入 ${total} 筆（新增 ${added}、更新 ${updated}）。`;
      setStatus?.(msg);
      alert(msg);
    } catch (err) {
      alert(String(err.message || err));
    } finally {
      setBusy("");
    }
  };

  const loadSeed = async () => {
    setBusy("seed");
    try {
      const counts = await api().loadImportSeedJson?.();
      refresh?.();
      alert(
        `已載入：進櫃表 ${counts?.cabinets || 0}、庫存 ${counts?.arrivals || 0}、港口待確認 ${counts?.portPending || 0}`,
      );
    } catch (err) {
      alert(String(err.message || err));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <h2 className="m-0 text-xl font-bold text-slate-800">{title}</h2>
      <p className="mt-1 text-xs text-slate-400">
        下載空白 CSV（Excel 可開）照表頭填好再匯入。編號可空白（後補）；也可在海關查驗手動新增。
      </p>

      <div className="mt-4 grid gap-3">
        <CleanupList refresh={refresh} />
        <section className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
          <h3 className="m-0 text-sm font-bold text-slate-700">① 下載格式（建議）</h3>
          <p className="mt-1 text-[0.72rem] text-slate-500">
        編號＝UHA／NC（不是櫃號）。櫃號＝EMCU／FBIU／FSCU／OTPU 等。藥檢／薰蒸填：待確認、需要藥檢／需要薰蒸、完成、無須檢驗。已放行：是／否。時間例：2026-09-22 09:00
      </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={() => download("port")}>
              港口查驗格式
            </button>
            <button type="button" className={btn} onClick={() => download("released")}>
              已放行格式
            </button>
            <button type="button" className={btn} onClick={() => download("arrival")}>
              進庫格式
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
          <h3 className="m-0 text-sm font-bold text-slate-700">② 匯入填好的檔</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={btnOn} disabled={!!busy} onClick={() => portRef.current?.click()}>
              {busy === "tpl-port" ? "匯入中…" : "匯入港口查驗"}
            </button>
            <button type="button" className={btnOn} disabled={!!busy} onClick={() => relRef.current?.click()}>
              {busy === "tpl-released" ? "匯入中…" : "匯入已放行"}
            </button>
            <button type="button" className={btnOn} disabled={!!busy} onClick={() => arrRef.current?.click()}>
              {busy === "tpl-arrival" ? "匯入中…" : "匯入進庫"}
            </button>
            <input
              ref={portRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                onFile("tpl-port", f);
              }}
            />
            <input
              ref={relRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                onFile("tpl-released", f);
              }}
            />
            <input
              ref={arrRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                onFile("tpl-arrival", f);
              }}
            />
          </div>
        </section>

        <section className="rounded-xl border border-dashed border-slate-200 p-3">
          <h3 className="m-0 text-sm font-bold text-slate-500">進階／舊檔</h3>
          <p className="mt-1 text-[0.72rem] text-slate-400">亂格式舊 Excel 或種子比對（可能不準）。</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={btn} disabled={!!busy} onClick={loadSeed}>
              {busy === "seed" ? "載入中…" : "載入115比對種子"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
