import { useEffect, useRef } from "react";
import { goAppHome } from "../bridge";
import { BLOCKS, blockOfPane, defaultPaneForBlock, swipeTabsForPane, tabsForBlock } from "../constants";
import { CountBadge, TAB_COUNT_IDS } from "../components/CountBadge";
import { ImportTabContent } from "../components/ImportTabContent";

const chipIdle = "imp-chip flex-shrink-0";
const chipOn = "imp-chip imp-chip-on flex-shrink-0";
const blockIdle = "imp-chip flex-shrink-0 font-semibold";
const blockOn = "imp-chip imp-chip-on flex-shrink-0 font-semibold";

function ignoreSwipeTarget(target) {
  if (!(target instanceof Element)) return true;
  if (target.closest(".imp-drawer-host, [role='dialog']")) return true;
  if (target.closest("[data-no-tab-swipe]")) return true;
  return false;
}

function blockCount(blockId, tabCounts) {
  return tabsForBlock(blockId).reduce((n, t) => n + (Number(tabCounts?.[t.id]) || 0), 0);
}

/**
 * 手機殼：頂層三區塊 + 子頁；內容區左右滑只切同區塊子頁。
 */
export function PhoneShell({ activeTab, setActiveTab, tabCounts, contentProps }) {
  const gesture = useRef({
    on: false,
    axis: null,
    x0: 0,
    y0: 0,
  });
  const block = blockOfPane(activeTab);
  const subTabs = tabsForBlock(block);

  useEffect(() => {
    const nav = document.querySelector('#import-root nav[aria-label="進口子頁"]');
    const on = nav?.querySelector(".imp-chip-on");
    on?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeTab]);

  const switchByDx = (dx) => {
    if (Math.abs(dx) < 36) return;
    const swipe = swipeTabsForPane(activeTab);
    const idx = swipe.indexOf(activeTab);
    if (idx < 0) return;
    if (dx < 0 && idx < swipe.length - 1) setActiveTab(swipe[idx + 1]);
    else if (dx > 0 && idx > 0) setActiveTab(swipe[idx - 1]);
  };

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    if (ignoreSwipeTarget(e.target)) return;
    const t = e.touches[0];
    gesture.current = { on: true, axis: null, x0: t.clientX, y0: t.clientY };
  };

  const onTouchMove = (e) => {
    const g = gesture.current;
    if (!g.on || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x0;
    const dy = t.clientY - g.y0;
    if (!g.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.axis = Math.abs(dx) >= Math.abs(dy) * 0.85 ? "h" : "v";
    }
    if (g.axis === "h" && e.cancelable) e.preventDefault();
  };

  const onTouchEnd = (e) => {
    const g = gesture.current;
    if (!g.on) return;
    g.on = false;
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - g.x0;
    const dy = t.clientY - g.y0;
    const horizontal = g.axis === "h" || (g.axis == null && Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy) * 1.1);
    g.axis = null;
    if (horizontal) switchByDx(dx);
  };

  const onTouchCancel = () => {
    gesture.current.on = false;
    gesture.current.axis = null;
  };

  const onPointerDown = (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    if (ignoreSwipeTarget(e.target)) return;
    gesture.current = { on: true, axis: null, x0: e.clientX, y0: e.clientY };
  };
  const onPointerMove = (e) => {
    if (e.pointerType !== "mouse") return;
    const g = gesture.current;
    if (!g.on) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.axis = Math.abs(dx) >= Math.abs(dy) * 0.85 ? "h" : "v";
    }
  };
  const onPointerUp = (e) => {
    if (e.pointerType !== "mouse") return;
    const g = gesture.current;
    if (!g.on) return;
    g.on = false;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    const horizontal = g.axis === "h" || (g.axis == null && Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy) * 1.1);
    g.axis = null;
    if (horizontal) switchByDx(dx);
  };

  return (
    <div className="imp-tw relative flex min-h-[min(78vh,40rem)] max-w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/80 font-imp text-slate-800">
      <div className="border-b border-slate-200/80 bg-white/90" data-no-tab-swipe>
        <nav className="flex w-full flex-row gap-2 overflow-x-auto whitespace-nowrap p-2 touch-pan-x" aria-label="進口區塊">
          <button type="button" className={chipIdle} onClick={goAppHome}>
            ← 總覽
          </button>
          {BLOCKS.map((b) => {
            const on = b.id === block;
            const n = blockCount(b.id, tabCounts);
            return (
              <button
                key={b.id}
                type="button"
                className={on ? blockOn : blockIdle}
                onClick={() => {
                  if (b.id === block) return;
                  setActiveTab(defaultPaneForBlock(b.id));
                }}
              >
                {b.lab}
                {n > 0 ? <CountBadge count={n} /> : null}
              </button>
            );
          })}
        </nav>
        <nav
          className="flex w-full flex-row gap-2 overflow-x-auto whitespace-nowrap border-t border-slate-100 px-2 pb-2 touch-pan-x"
          aria-label="進口子頁"
        >
          {subTabs.map((t) => {
            const on = t.id === activeTab;
            return (
              <button key={t.id} type="button" className={on ? chipOn : chipIdle} onClick={() => setActiveTab(t.id)}>
                {t.lab}
                {t.id === "track" && Number(tabCounts.trackArrange) > 0 ? (
                  <CountBadge count={tabCounts.trackArrange} warn title="待排櫃" />
                ) : TAB_COUNT_IDS.has(t.id) ? (
                  <CountBadge count={tabCounts[t.id]} />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      <div
        className="imp-phone-swipe flex min-h-0 min-w-0 flex-1 flex-col"
        style={{ touchAction: "pan-y" }}
        data-imp-swipe="1"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <ImportTabContent activeTab={activeTab} padClass="p-2.5" {...contentProps} />
      </div>
    </div>
  );
}
