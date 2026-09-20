import { useCallback, useRef, useState } from "react";
import { api, ensureImportState, saveState, setStatus } from "../bridge";
import {
  captureDisplayFrame,
  compressDataUrl,
  compressImageFile,
  imageFileFromClipboard,
  textFromClipboard,
} from "../lib/imagePaste";
import { RegionCropOverlay } from "./RegionCropOverlay";

/**
 * 判讀：文字解析＋框選截圖／貼上預覽後建草稿。
 */
export function ParsePane({ title = "判讀", drafts, onParsed, onOpenDraft }) {
  const [text, setText] = useState("");
  const [shot, setShot] = useState(null); // { dataUrl, name }
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [cropSrc, setCropSrc] = useState(null); // full capture awaiting region select
  const fileRef = useRef(null);
  const cropFileRef = useRef(null);

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

  const applyShot = useCallback(async (dataUrl, name) => {
    const compressed = await compressDataUrl(dataUrl, { name: name || `crop-${Date.now()}.jpg` });
    setShot({ dataUrl: compressed.dataUrl, name: compressed.name });
    setStatus("已框選截圖，可再補文字後按「建立草稿」。");
  }, []);

  const ingestImage = useCallback(
    async (file, extraText = "", { goCrop = false } = {}) => {
      if (!file) return;
      setBusy(true);
      try {
        const compressed = await compressImageFile(file, { maxSide: goCrop ? 2400 : 1280, quality: goCrop ? 0.92 : 0.72 });
        if (extraText) setText((t) => (t ? `${t}\n${extraText}` : extraText));
        if (goCrop) {
          setCropSrc(compressed.dataUrl);
        } else {
          setShot({ dataUrl: compressed.dataUrl, name: compressed.name });
          setStatus("已貼上截圖，可再補文字後按「建立草稿」。");
        }
      } catch (err) {
        setStatus(String(err.message || err || "圖片處理失敗"), true);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  /** 點「框選截圖」：分享畫面 → 凍結 → 拖曳框選 */
  const startRegionCapture = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setStatus("此裝置不支援畫面擷取，改選圖片後再框選。", true);
      cropFileRef.current?.click();
      return;
    }
    setBusy(true);
    try {
      setStatus("請在彈窗選要截的視窗／螢幕（建議選 LINE 或文件視窗）…");
      const frame = await captureDisplayFrame();
      setCropSrc(frame);
      setStatus("請在畫面上拖曳框選範圍。");
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (/NotAllowedError|Permission denied|denied|NotAllowed/i.test(msg) || err?.name === "NotAllowedError") {
        setStatus("已取消畫面分享。可改貼上截圖，或選圖片後框選。", true);
      } else {
        setStatus(msg || "畫面擷取失敗", true);
        cropFileRef.current?.click();
      }
    } finally {
      setBusy(false);
    }
  };

  const createShotDraft = () => {
    if (!shot?.dataUrl) {
      setStatus("請先框選或貼上截圖。", true);
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
    ingestImage(img, pastedText, { goCrop: true });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && String(file.type || "").startsWith("image/")) ingestImage(file, "", { goCrop: true });
    else setStatus("請拖放圖片檔。", true);
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm" onPaste={onPasteAnywhere}>
      {cropSrc ? (
        <RegionCropOverlay
          sourceDataUrl={cropSrc}
          title="拖曳框選要截的範圍"
          onCancel={() => setCropSrc(null)}
          onConfirm={async (cropped) => {
            setCropSrc(null);
            setBusy(true);
            try {
              await applyShot(cropped, `crop-${Date.now()}.jpg`);
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      <h2 className="m-0 text-xl font-bold text-slate-800">{title}</h2>
      <p className="mt-1 text-xs text-slate-400">
        點「框選截圖」→ 選視窗／螢幕 → 拖曳框選範圍。也可貼上／相簿後再框選。
      </p>

      <div className="mt-4 grid gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-700/20 disabled:opacity-50"
            disabled={busy}
            onClick={startRegionCapture}
          >
            {busy ? "處理中…" : "框選截圖"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"
            disabled={busy}
            onClick={() => cropFileRef.current?.click()}
          >
            選圖後框選
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            相簿／拍照
          </button>
        </div>

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
                <span className="text-xs font-bold text-slate-600">框選結果預覽</span>
                <div className="flex gap-2">
                  <button type="button" className="text-xs font-bold text-emerald-700 underline" onClick={() => setCropSrc(shot.dataUrl)}>
                    再框選
                  </button>
                  <button type="button" className="text-xs font-bold text-rose-600 underline" onClick={() => setShot(null)}>
                    移除
                  </button>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl bg-slate-900/5">
                <img src={shot.dataUrl} alt="截圖預覽" className="mx-auto max-h-64 w-auto max-w-full object-contain" />
              </div>
              <button
                type="button"
                className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={busy}
                onClick={createShotDraft}
              >
                建立草稿並核對
              </button>
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="m-0 text-sm font-semibold text-slate-700">尚未有截圖</p>
              <p className="mt-1 m-0 text-xs text-slate-400">按上方「框選截圖」，或 Ctrl+V 貼上後框選</p>
            </div>
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
          <input
            ref={cropFileRef}
            type="file"
            accept="image/*,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) ingestImage(file, "", { goCrop: true });
            }}
          />
        </div>

        <label className="grid gap-1.5 text-xs font-semibold text-slate-500">
          文件文字（可與截圖一起用）
          <textarea
            className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-normal text-slate-800 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
            placeholder={"例：\nUHA720\n櫃號 YMLU1234567\n品名 韓白"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const img = imageFileFromClipboard(e);
              if (img) {
                e.preventDefault();
                ingestImage(img, textFromClipboard(e), { goCrop: true });
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
          <p className="mb-2 mt-0 text-xs font-semibold text-slate-500">待確認草稿</p>
          {!drafts?.length ? (
            <p className="m-0 rounded-xl bg-slate-50/80 py-8 text-center text-sm text-slate-400">目前沒有資料</p>
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
                          {[d.containerNo, d.product, d.arriveDay].filter(Boolean).join(" · ") || "點此編輯"}
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
