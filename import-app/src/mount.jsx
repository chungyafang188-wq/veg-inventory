import { createRoot } from "react-dom/client";
import ImportApp from "./ImportApp.jsx";
import "./index.css";

let root = null;
let hostEl = null;

/**
 * 掛載進口 React 殼。
 * 已掛載時不要重 render／改 key，否則會把使用者切到的分頁打回 parse。
 * 外部若要指定分頁，請丟 import-set-pane 事件（setImportPane / openImport）。
 */
export function mountImportApp(el, opts = {}) {
  if (!el) return;
  if (root && hostEl === el) {
    if (opts.pane != null && opts.forcePane) {
      window.dispatchEvent(new CustomEvent("import-set-pane", { detail: opts.pane }));
    }
    return root;
  }
  if (root) {
    try {
      root.unmount();
    } catch (_) {}
  }
  el.innerHTML = "";
  hostEl = el;
  root = createRoot(el);
  root.render(<ImportApp initialPane={opts.pane || "parse"} />);
  return root;
}

export function unmountImportApp() {
  if (root) {
    try {
      root.unmount();
    } catch (_) {}
  }
  root = null;
  hostEl = null;
}

if (typeof window !== "undefined") {
  window.mountImportApp = mountImportApp;
  window.unmountImportApp = unmountImportApp;
  if (window.page === "import" && typeof window.renderImportPage === "function") {
    try {
      window.renderImportPage();
    } catch (_) {}
  }
}
