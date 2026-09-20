/** 壓縮截圖為可存草稿的 JPEG dataURL（控制容量，避免塞爆 localStorage） */
export function compressImageFile(file, { maxSide = 1280, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || "").startsWith("image/")) {
      reject(new Error("不是圖片檔"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let { width: w, height: h } = img;
        const scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("無法處理圖片"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        URL.revokeObjectURL(url);
        resolve({
          dataUrl,
          name: file.name || `screenshot-${Date.now()}.jpg`,
          width: w,
          height: h,
          bytes: Math.round((dataUrl.length * 3) / 4),
        });
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("圖片讀取失敗"));
    };
    img.src = url;
  });
}

export function imageFileFromClipboard(e) {
  const items = e?.clipboardData?.items;
  if (!items) return null;
  for (const item of items) {
    if (item.type && item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  const files = e?.clipboardData?.files;
  if (files?.length) {
    for (const f of files) {
      if (String(f.type || "").startsWith("image/")) return f;
    }
  }
  return null;
}

export function textFromClipboard(e) {
  return String(e?.clipboardData?.getData("text/plain") || "").trim();
}
