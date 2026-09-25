import { goAppHome } from "../bridge";
import { BLOCKS, blockOfPane, defaultPaneForBlock, tabsForBlock } from "../constants";
import { CountBadge, TAB_COUNT_IDS } from "../components/CountBadge";
import { ImportTabContent } from "../components/ImportTabContent";

const chipIdle = "imp-chip flex-shrink-0";
const chipOn = "imp-chip imp-chip-on flex-shrink-0";
const sideIdle = "imp-side flex-shrink-0";
const sideOn = "imp-side imp-side-on flex-shrink-0";

/**
 * 桌面殼：頂部三模組 + 左側只掛當模組子頁 + 右側內容。
 * （對齊手繪：頂部點選切模組，左側精簡選單隨之更換）
 */
export function WebShell({ activeTab, setActiveTab, tabCounts, contentProps }) {
  const block = blockOfPane(activeTab);
  const subTabs = tabsForBlock(block);

  return (
    <div className="imp-tw relative flex min-h-[min(78vh,40rem)] max-w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/80 font-imp text-slate-800">
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-200/80 bg-white/95 px-2 py-2">
        <button type="button" className={`${chipIdle} shrink-0`} onClick={goAppHome}>
          ← 總覽
        </button>
        <nav className="flex min-w-0 flex-1 flex-row gap-2 overflow-x-auto whitespace-nowrap" aria-label="進口主模組">
          {BLOCKS.map((b) => {
            const on = b.id === block;
            return (
              <button
                key={b.id}
                type="button"
                className={on ? chipOn : chipIdle}
                onClick={() => {
                  if (b.id === block) return;
                  setActiveTab(defaultPaneForBlock(b.id));
                }}
              >
                {b.lab}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <aside
          className="flex w-[7.75rem] shrink-0 flex-col gap-1 border-r border-slate-200/80 bg-[#e8efea] p-2"
          aria-label="進口子選單"
        >
          <div className="px-1 pb-1 text-[0.68rem] font-bold tracking-wide text-imp-green">{BLOCKS.find((b) => b.id === block)?.lab}</div>
          <nav className="flex flex-col gap-0.5">
            {subTabs.map((t) => {
              const on = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={on ? sideOn : sideIdle}
                  onClick={() => setActiveTab(t.id)}
                >
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
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ImportTabContent activeTab={activeTab} padClass="p-4" {...contentProps} />
        </section>
      </div>
    </div>
  );
}
