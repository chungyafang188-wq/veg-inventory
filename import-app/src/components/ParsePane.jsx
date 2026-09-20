import { useCallback, useRef, useState } from "react";
import { api, ensureImportState, saveState, setStatus } from "../bridge";
import { compressImageFile, imageFileFromClipboard, textFromClipboard } from "../lib/imagePaste";

/**
 * 判讀：文字解析＋LINE 式截圖貼上（預覽後建草稿）。
 */
export function ParsePane({ title = "判讀", drafts, onParsed, onOpenDraft }) {
  const [text, setText] = useState("");
  const [shot, setShot] = useState(null); // { dataUrl, name }
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const runParse = () => {
    if (!String(text).trim()) {
      setStatus("請先貼上文件文字。", true);
      return;
    }
    const a = api();
    const list =
      typeof a.parseImportDocTexts === "function"
        ? a.parseImportDocTexts(text)
        : (() => {
            const d = a.parseImportDocText?.(text);
            return d ? [d] : [];
          })();
    const state = ensureImportState();
    if (!list?.length || !state) {
      setStatus("解析不到欄位，請檢查文字或改手動填。", true);
      return;
    }
    for (let i = list.length - 1; i >= 0; i--) {
      state.importParseDrafts.unshift(list[i]);
    }
    if (state.importParseDrafts.length > 40) state.importParseDrafts.length = 40;
    setText("");
    saveState();
    const first = list[0];
    const miss = (first.missing || []).join("、");
    setStatus(
      list.length > 1
        ? `已解析 ${list.length} 櫃，請逐筆核對後確認。`
        : miss
          ? `已解析（尚缺：${miss}），請核對後確認。`
          : "已解析，請核對後確認。",
    );
    onParsed?.();
    onOpenDraft?.(first.id || 0);
  };

  const ingestImage = useCallback(async (file, extraText = "") => {
    if (!file) return;
    setBusy(true);
    try {
      const compressed = await compressImageFile(file);
      setShot({ dataUrl: compressed.dataUrl, name: compressed.name });
      if (extraText) setText((t) => (t ? `${t}\n${extraText}` : extraText));
      setStatus("已貼上截圖，可再補文字後按「建立草稿」。");
    } catch (err) {
      setStatus(String(err.message || err || "圖片處理失敗"), true);
    } finally {
      setBusy(false);
    }
  }, []);

  const createShotDraft = () => {
    if (!shot?.dataUrl) {
      setStatus("請先貼上或選取截圖。", true);
      return;
    }
    const state = ensureImportState();
    if (!state) return;
    const id = `draft_${Date.now()}`;
    const note = String(text || "").trim();
    let draft = {
      id,
      uha: "",
      containerNo: "",
      customsNo: "",
      arriveDay: "",
      product: "",
      broker: "",
      seller: "",
      shipCo: "",
      raw: note || `（截圖：${shot.name}）`,
      photoName: shot.name,
      photoData: shot.dataUrl,
      missing: ["編號", "櫃號", "到港日", "品名"],
    };
    // 若同時有文字，先跑解析再併入圖片
    if (note) {
      const parsed = api().parseImportDocText?.(note);
      if (parsed) {
        draft = {
          ...parsed,
          id,
          photoName: shot.name,
          photoData: shot.dataUrl,
          raw: parsed.raw || note,
          missing: parsed.missing?.length ? parsed.missing : draft.missing,
        };
      }
    }
    state.importParseDrafts.unshift(draft);
    if (state.importParseDrafts.length > 40) state.importParseDrafts.length = 40;
    setShot(null);
    setText("");
    saveState();
    setStatus("已建立截圖草稿，請核對欄位後確認列入海關查驗。");
    onParsed?.();
    onOpenDraft?.(id);
  };

  const onPasteAnywhere = (e) => {
    const img = imageFileFromClipboard(e);
    if (!img) return;
    e.preventDefault();
    const pastedText = textFromClipboard(e);
    ingestImage(img, pastedText);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && String(file.type || "").startsWith("image/")) ingestImage(file);
    else setStatus("請拖放圖片檔（截圖／拍照）。", true);
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm" onPaste={onPasteAnywhere}>
      <h2 className="m-0 text-xl font-bold text-slate-800">{title}</h2>
      <p className="mt-1 text-xs text-slate-400">
        文字可直接貼上解析；截圖可像 LINE 一樣 Ctrl+V／長按貼上，或拖放進下方框。
      </p>

      <div className="mt-4 grid gap-3">
        {/* LINE 式截圖區 */}
        <div
          className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${
            dragOver ? "border-emerald-500 bg-emerald-50/80" : "border-slate-200 bg-slate-50/60"
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {shot?.dataUrl ? (
            <div className="grid gap-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-600">截圖預覽（類似 LINE 傳送前）</span>
                <button
                  type="button"
                  className="text-xs font-bold text-rose-600 underline"
                  onClick={() => setShot(null)}
                >
                  移除
                </button>
              </div>
              <div className="overflow-hidden rounded-xl bg-slate-900/5">
                <img src={shot.dataUrl} alt="截圖預覽" className="mx-auto max-h-64 w-auto max-w-full object-contain" />
              </div>
              <p className="m-0 truncate text-[0.7rem] text-slate-400">{shot.name}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={busy}
                  onClick={createShotDraft}
                >
                  建立草稿並核對
                </button>
                <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => fileRef.current?.click()}>
                  換一張
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="flex w-full flex-col items-center gap-2 px-4 py-8 text-center"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M4 7h3l2-2h6l2 2h3v12H4V7z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
              </span>
              <strong className="text-sm text-slate-800">{busy ? "處理圖片中…" : "貼上截圖／拖放／點選相簿"}</strong>
              <span className="text-xs text-slate-400">支援 LINE 截圖：複製後在此 Ctrl+V（手機可長按貼上）</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.png,.jpg,.jpeg,.webp"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) ingestImage(file);
            }}
          />
        </div>

        <label className="grid gap-1.5 text-xs font-semibold text-slate-500">
          文件文字（可與截圖一起用）
          <textarea
            className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-normal text-slate-800 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
            placeholder={"例：\nUHA720\n櫃號 YMLU1234567\n品名 韓白\n到港日 2026-01-15"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const img = imageFileFromClipboard(e);
              if (img) {
                e.preventDefault();
                ingestImage(img, textFromClipboard(e));
              }
            }}
          />
        </label>

        <button
          type="button"
          className="rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-700/20 transition-all hover:bg-emerald-800 disabled:opacity-50"
          onClick={shot?.dataUrl ? createShotDraft : runParse}
          disabled={busy}
        >
          {shot?.dataUrl ? "建立草稿並核對" : "解析文字"}
        </button>

        <div className="mt-1">
          <p className="mb-2 mt-0 text-xs font-semibold text-slate-500">待確認草稿（點列開啟編輯）</p>
          {!drafts?.length ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-50/80 px-4 py-10 text-center">
              <p className="m-0 text-sm font-medium text-slate-500">目前沒有資料</p>
              <p className="m-0 text-xs text-slate-400">貼文字或截圖後草稿會出現在這裡</p>
            </div>
          ) : (
            <ul className="m-0 grid list-none gap-1.5 p-0">
              {drafts.map((d, i) => {
                const key = d.id || String(i);
                const missUha = !String(d.uha || "").trim();
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-all hover:bg-emerald-50/50 ${
                        missUha ? "border-amber-200 bg-amber-50/40" : "border-slate-200/80 bg-white"
                      }`}
                      onClick={() => onOpenDraft?.(key)}
                    >
                      {d.photoData ? (
                        <img src={d.photoData} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[0.65rem] font-bold text-slate-400">文</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-800">{d.uha || "缺編號（可後補）"}</span>
                        <span className="block truncate text-xs text-slate-400">
                          {[d.containerNo, d.product, d.arriveDay, d.photoName].filter(Boolean).join(" · ") || "點此編輯"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
