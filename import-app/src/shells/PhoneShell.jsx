import { useRef, useState } from "react";
import { PANE_TITLE, TABS, blockOfPane } from "../constants";
import { CountBadge, TAB_COUNT_IDS } from "../components/CountBadge";
import { ImportTabContent } from "../components/ImportTabContent";

const chipIdle = "imp-chip flex-shrink-0";
const chipOn = "imp-chip imp-chip-on flex-shrink-0";

/** 港口辦理每天會點的兩頁。貨櫃拆卸的常用頁就是排程本身，不再多放一顆同名按鈕。 */
const PORT_COMMON = ["desk", "track"];

const MORE_GROUPS = [
  { id: "port", lab: "港口辦理", ids: ["parse", "port", "release", "files"] },
  { id: "unpack", lab: "貨櫃拆卸資料", ids: ["unpack", "sum"] },
  { id: "acct", lab: "帳務與庫存", ids: ["stock", "buy", "broker", "vendor", "trailer", "labor"] },
];

function ignoreSwipeTarget(target) {
  if (!(target instanceof Element)) return true;
  if (target.closest(".imp-drawer-host, [role='dialog']")) return true;
  if (target.closest("[data-no-tab-swipe], .imp-phone-body, .overflow-x-auto")) return true;
  return false;
}

function tabById(id) {
  return TABS.find((t) => t.id === id) || null;
}

/**
 * 手機殼：上方只留每天會點的頁，其餘收進「更多」。
 * 港口辦理／貨櫃拆卸資料放在左側可收合工作列，不佔內容高度。
 * 系統底列（首頁／出貨／進口／庫存）不在這裡。
 */
export function PhoneShell({ activeTab, setActiveTab, tabCounts, contentProps }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const gesture = useRef({
    on: false,
    axis: null,
    x0: 0,
    y0: 0,
  });
  const block = blockOfPane(activeTab);
  const onMorePage = MORE_GROUPS.some((group) => group.ids.includes(activeTab));

  const openPane = (id) => {
    setMoreOpen(false);
    setRailOpen(false);
    setActiveTab(id);
  };

  const switchByDx = (dx) => {
    if (Math.abs(dx) < 36) return;
    const swipe = PORT_COMMON;
    const idx = swipe.indexOf(activeTab);
    if (idx < 0) return;
    if (dx < 0 && idx < swipe.length - 1) setActiveTab(swipe[idx + 1]);
    else if (dx > 0 && idx > 0) setActiveTab(swipe[idx - 1]);
  };

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    if (ignoreSwipeTarget(e.target)) return;
    gesture.current = { on: true, axis: null, x0: t.clientX, y0: t.clientY };
  };
  const onTouchMove = (e) => {
    const g = gesture.current;
    if (!g.on || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x0;
    const dy = t.clientY - g.y0;
    if (!g.axis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
  };
  const onTouchEnd = (e) => {
    const g = gesture.current;
    if (!g.on) return;
    const t = e.changedTouches[0];
    const dx = t ? t.clientX - g.x0 : 0;
    gesture.current = { on: false, axis: null, x0: 0, y0: 0 };
    if (g.axis !== "x") return;
    switchByDx(dx);
  };
  const onTouchCancel = () => {
    gesture.current = { on: false, axis: null, x0: 0, y0: 0 };
  };

  const onPointerDown = (e) => {
    if (e.pointerType === "touch") return;
    if (e.button !== 0) return;
    if (ignoreSwipeTarget(e.target)) return;
    gesture.current = { on: true, axis: null, x0: e.clientX, y0: e.clientY };
  };
  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g.on || e.pointerType === "touch") return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.axis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
  };
  const onPointerUp = (e) => {
    if (e.pointerType === "touch") return;
    const g = gesture.current;
    if (!g.on) return;
    const dx = e.clientX - g.x0;
    gesture.current = { on: false, axis: null, x0: 0, y0: 0 };
    if (g.axis !== "x") return;
    switchByDx(dx);
  };

  return (
    <div
      className="imp-tw imp-phone-shell relative flex min-h-[min(78vh,40rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2 py-2" data-no-tab-swipe>
        <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto" aria-label="進口常用">
          {block === "port"
            ? PORT_COMMON.map((id) => {
                const tab = tabById(id);
                if (!tab) return null;
                const on = activeTab === id;
                const n = tabCounts?.[id];
                const showCount = TAB_COUNT_IDS.has(id);
                const warn = id === "track" && (tabCounts?.trackArrange || 0) > 0;
                return (
                  <button key={id} type="button" className={on ? chipOn : chipIdle} onClick={() => openPane(id)}>
                    {tab.lab}
                    {showCount ? (
                      <CountBadge
                        count={n}
                        warn={warn}
                        title={warn ? `待排櫃 ${tabCounts.trackArrange}` : undefined}
                      />
                    ) : null}
                  </button>
                );
              })
            : (
              <span className="truncate px-1 text-sm font-bold text-slate-800">{PANE_TITLE[activeTab] || ""}</span>
            )}
        </nav>
        <button
          type="button"
          className={moreOpen || onMorePage ? chipOn : chipIdle}
          aria-expanded={moreOpen}
          aria-label="更多"
          onClick={() => setMoreOpen((v) => !v)}
        >
          更多
        </button>
      </div>

      {moreOpen ? (
        <div className="absolute inset-0 z-30" data-no-tab-swipe>
          <button type="button" className="imp-more-mask" aria-label="關閉更多" onClick={() => setMoreOpen(false)} />
          <div className="imp-more-panel" role="menu" aria-label="更多頁面">
            {MORE_GROUPS.map((group) => (
              <section key={group.id} className="mb-3 last:mb-0">
                <p className="mb-1.5 text-xs font-bold text-slate-500">{group.lab}</p>
                <div className="flex flex-wrap gap-2">
                  {group.ids.map((id) => {
                    const tab = tabById(id);
                    if (!tab) return null;
                    const on = activeTab === id;
                    const n = tabCounts?.[id];
                    const showCount = TAB_COUNT_IDS.has(id);
                    return (
                      <button key={id} type="button" role="menuitem" className={on ? chipOn : chipIdle} onClick={() => openPane(id)}>
                        {tab.lab}
                        {showCount ? <CountBadge count={n} /> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}

      <div className="imp-phone-body" data-no-tab-swipe>
        <ImportTabContent activeTab={activeTab} {...contentProps} />
      </div>

      <button
        type="button"
        className="imp-phone-rail-tab"
        aria-expanded={railOpen}
        aria-label={railOpen ? "收合工作列" : "展開工作列"}
        data-no-tab-swipe
        onClick={() => {
          setMoreOpen(false);
          setRailOpen((v) => !v);
        }}
      >
        {railOpen ? "收合" : "區塊"}
      </button>
      {railOpen ? (
        <div className="absolute inset-0 z-30" data-no-tab-swipe>
          <button type="button" className="imp-more-mask" aria-label="關閉工作列" onClick={() => setRailOpen(false)} />
          <nav className="imp-phone-rail" aria-label="進口區塊">
            <button
              type="button"
              className={`imp-phone-rail-btn${block === "port" ? " is-on" : ""}`}
              aria-current={block === "port" ? "page" : undefined}
              onClick={() => openPane("desk")}
            >
              港口辦理
            </button>
            <button
              type="button"
              className={`imp-phone-rail-btn${block === "unpack" ? " is-on" : ""}`}
              aria-current={block === "unpack" ? "page" : undefined}
              onClick={() => openPane("upBoard")}
            >
              貨櫃拆卸資料
            </button>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
