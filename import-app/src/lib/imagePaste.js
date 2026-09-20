/** 壓縮 dataURL 圖片 */
export function compressDataUrl(dataUrl, { maxSide = 1280, quality = 0.72, name } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
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
        const out = canvas.toDataURL("image/jpeg", quality);
        resolve({
          dataUrl: out,
          name: name || `shot-${Date.now()}.jpg`,
          width: w,
          height: h,
          bytes: Math.round((out.length * 3) / 4),
        });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("圖片讀取失敗"));
    img.src = dataUrl;
  });
}

/** 壓縮檔案圖片為可存草稿的 JPEG dataURL */
export function compressImageFile(file, opts = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || "").startsWith("image/")) {
      reject(new Error("不是圖片檔"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        const maxSide = opts.maxSide ?? 1280;
        const quality = opts.quality ?? 0.72;
        const scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
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

/**
 * 選擇整個螢幕／視窗擷取一幀（瀏覽器會跳出分享畫面選單）。
 * 之後再於畫面上框選範圍。
 */
export async function captureDisplayFrame() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("此裝置／瀏覽器不支援畫面擷取，請改用貼上或相簿。");
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
  });
  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
  video.srcObject = stream;
  try {
    await video.play();
    await new Promise((resolve) => {
      if (video.videoWidth > 0) resolve();
      else video.onloadedmetadata = () => resolve();
    });
    await new Promise((r) => setTimeout(r, 200));
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) throw new Error("無法取得畫面尺寸");
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }
}

/** 從大圖裁切矩形（natural 座標） */
export function cropDataUrl(dataUrl, rect) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const x = Math.max(0, Math.round(rect.x));
        const y = Math.max(0, Math.round(rect.y));
        const w = Math.max(1, Math.round(rect.w));
        const h = Math.max(1, Math.round(rect.h));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, x, y, w, h, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("裁切失敗"));
    img.src = dataUrl;
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
