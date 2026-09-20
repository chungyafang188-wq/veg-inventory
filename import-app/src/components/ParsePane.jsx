import { useState } from "react";
import { api, ensureImportState, saveState, setStatus } from "../bridge";

export function ParsePane({ title = "判讀", drafts, onParsed, onOpenDraft }) {
  const [text, setText] = useState("");

  const runParse = () => {
    if (!String(text).trim()) {
      setStatus("請先貼上文件文字。", true);
      return;
    }
    const draft = api().parseImportDocText?.(text);
    const state = ensureImportState();
    if (!draft || !state) {
      setStatus("解析失敗。", true);
      return;
    }
    state.importParseDrafts.unshift(draft);
    if (state.importParseDrafts.length > 40) state.importParseDrafts.length = 40;
    setText("");
    saveState();
    setStatus("已解析，請核對後確認。");
    onParsed?.();
    onOpenDraft?.(0);
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <h2 className="m-0 text-xl font-bold text-slate-800">{title}</h2>
      <p className="mt-1 text-xs text-slate-400">貼上文件文字或截圖，解析後點草稿開啟編輯。</p>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5 text-xs font-semibold text-slate-500">
          文件文字
          <textarea
            className="min-h-36 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-normal text-slate-800 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
            placeholder={"例：UHA720\n櫃號 YMLU1234567\n報關單 AB123456789\n品名 韓白\n到港日 2026-01-15"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-700/20 transition-all hover:bg-emerald-800"
          onClick={runParse}
        >
          解析文字
        </button>
        <label className="inline-flex w-fit cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50">
          截圖／拍照
          <input
            type="file"
            accept="image/*,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const state = ensureImportState();
              if (!state) return;
              state.importParseDrafts.unshift({
                id: `draft_${Date.now()}`,
                uha: "",
                containerNo: "",
                customsNo: "",
                arriveDay: "",
                product: "",
                broker: "",
                raw: `（截圖／拍照：${file.name}，請手動核對欄位）`,
                photoName: file.name,
              });
              saveState();
              setStatus("已附上圖片，請填寫欄位後確認。（圖片 OCR 下一步接）");
              onParsed?.();
              onOpenDraft?.(0);
            }}
          />
        </label>

        <div className="mt-1">
          <p className="mb-2 mt-0 text-xs font-semibold text-slate-500">待確認草稿（點列開啟編輯）</p>
          {!drafts?.length ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-50/80 px-4 py-10 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M7 7h10M7 12h6M6 3h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="m-0 text-sm font-medium text-slate-500">目前沒有資料</p>
              <p className="m-0 text-xs text-slate-400">解析文字後草稿會出現在這裡</p>
            </div>
          ) : (
            <ul className="m-0 grid list-none gap-1.5 p-0">
              {drafts.map((d, i) => (
                <li key={d.id || i}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-left text-sm transition-all hover:bg-emerald-50/50"
                    onClick={() => onOpenDraft?.(i)}
                  >
                    <span className="font-semibold text-slate-800">{d.uha || "（未填編號）"}</span>
                    <span className="truncate text-xs text-slate-400">
                      {[d.containerNo, d.product, d.arriveDay].filter(Boolean).join(" · ") || "點此編輯"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
