import { useCallback, useEffect, useRef, useState } from "react";
import { cropDataUrl } from "../lib/imagePaste";

/**
 * 全螢幕框選裁切：在擷取畫面／圖片上拖曳選取範圍。
 */
export function RegionCropOverlay({ sourceDataUrl, onConfirm, onCancel, title = "拖曳框選要截的範圍" }) {
  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [sel, setSel] = useState(null); // {x,y,w,h} in natural image coords
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const clientToNatural = useCallback(
    (clientX, clientY) => {
      const img = imgRef.current;
      if (!img || !nat.w) return null;
      const rect = img.getBoundingClientRect();
      const scaleX = nat.w / rect.width;
      const scaleY = nat.h / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;
      return {
        x: Math.min(nat.w, Math.max(0, x)),
        y: Math.min(nat.h, Math.max(0, y)),
      };
    },
    [nat],
  );

  const onPointerDown = (e) => {
    const p = clientToNatural(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { x0: p.x, y0: p.y };
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const p = clientToNatural(e.clientX, e.clientY);
    if (!p) return;
    const x = Math.min(d.x0, p.x);
    const y = Math.min(d.y0, p.y);
    const w = Math.abs(p.x - d.x0);
    const h = Math.abs(p.y - d.y0);
    setSel({ x, y, w, h });
  };

  const onPointerUp = (e) => {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch (_) {}
  };

  const selStyle = () => {
    const img = imgRef.current;
    if (!img || !sel || !nat.w) return { display: "none" };
    const rect = img.getBoundingClientRect();
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) return { display: "none" };
    const scaleX = rect.width / nat.w;
    const scaleY = rect.height / nat.h;
    return {
      left: rect.left - stage.left + sel.x * scaleX,
      top: rect.top - stage.top + sel.y * scaleY,
      width: Math.max(2, sel.w * scaleX),
      height: Math.max(2, sel.h * scaleY),
    };
  };

  const confirm = async () => {
    if (!sel || sel.w < 8 || sel.h < 8) {
      return;
    }
    setBusy(true);
    try {
      const cropped = await cropDataUrl(sourceDataUrl, sel);
      onConfirm?.(cropped);
    } catch (err) {
      console.error(err);
      onCancel?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/90 text-white" role="dialog" aria-modal="true">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
        <p className="m-0 text-sm font-bold">{title}</p>
        <div className="flex gap-2">
          <button type="button" className="rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-bold" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold disabled:opacity-40"
            disabled={busy || !sel || sel.w < 8 || sel.h < 8}
            onClick={confirm}
          >
            {busy ? "裁切中…" : "確認框選"}
          </button>
        </div>
      </div>
      <p className="m-0 shrink-0 px-3 pb-2 text-[0.75rem] text-white/70">在畫面上按住拖曳框選；放開後按「確認框選」。Esc 取消。</p>
      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          ref={imgRef}
          src={sourceDataUrl}
          alt="待框選"
          className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
          draggable={false}
          onLoad={(e) => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
        />
        {/* dim outside selection via box-shadow trick on selection rect */}
        {sel && sel.w > 0 && sel.h > 0 ? (
          <div
            className="pointer-events-none absolute border-2 border-emerald-400 bg-emerald-400/10"
            style={{
              ...selStyle(),
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
