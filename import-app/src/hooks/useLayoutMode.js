import { useEffect, useState } from "react";

/** 跟主站「手機／網頁」按鈕：layout-web = 桌面，其餘當手機 */
export function readLayoutMode() {
  if (typeof document === "undefined") return "phone";
  return document.body.classList.contains("layout-web") ? "web" : "phone";
}

export function useLayoutMode() {
  const [mode, setMode] = useState(readLayoutMode);

  useEffect(() => {
    const sync = () => setMode(readLayoutMode());
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return mode;
}
