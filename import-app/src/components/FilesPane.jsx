import { useRef, useState } from "react";
import { api, setStatus } from "../bridge";

const btn =
  "inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-[0.8rem] font-semibold text-slate-700 hover:bg-slate-50";
const btnOn = "inline-flex cursor-pointer items-center justify-center rounded-md border border-emerald-600 bg-emerald-600 px-3 py-2 text-[0.8rem] font-bold text-white hover:bg-emerald-700";

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
      const n = await api().importTemplateFile?.(file, kind);
      refresh?.();
      setStatus?.(`已匯入 ${n} 筆。`);
      alert(`已匯入 ${n} 筆。`);
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
        比對舊表不準時，請下載空白 CSV（Excel 可開），照表頭填好再匯入。海關查驗也可直接手動新增。
      </p>

      <div className="mt-4 grid gap-3">
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
