/** 與既有 import-flow / app.js 橋接（讀寫 window.state） */

export function getState() {
  return typeof window !== "undefined" ? window.state : null;
}

export function ensureImportState() {
  const state = getState();
  if (!state) return null;
  if (!Array.isArray(state.importCabinets)) state.importCabinets = [];
  if (!Array.isArray(state.importArrivals)) state.importArrivals = [];
  if (!Array.isArray(state.importReleased)) state.importReleased = [];
  if (!Array.isArray(state.importParseDrafts)) state.importParseDrafts = [];
  return state;
}

export function saveState() {
  if (typeof window.save === "function") window.save();
}

export function setStatus(msg, bad) {
  if (typeof window.setStatus === "function") window.setStatus(msg, bad);
}

export function goAppHome() {
  if (typeof window.goHome === "function") {
    window.goHome();
    return;
  }
  // fallback（理論上不會走到）
  if (typeof window.render === "function") window.render();
}

export function goUnpack() {
  if (typeof window.goUnpack === "function") {
    window.goUnpack();
    return;
  }
  if (typeof window.can === "function" && !window.can("page-unpack")) {
    setStatus("拆櫃回報建置中，暫僅主管可進入。", true);
    return;
  }
}

/** 同步主站 importPane，避免 renderImportPage 又打回 parse */
export function syncHostPane(pane) {
  if (typeof window.__importApi?.setHostPane === "function") {
    window.__importApi.setHostPane(pane);
  }
}

export function api() {
  return (typeof window !== "undefined" && window.__importApi) || {};
}
