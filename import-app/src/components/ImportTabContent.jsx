import { api } from "../bridge";
import { PANE_TITLE } from "../constants";
import { CountBadge } from "./CountBadge";
import { FilesPane } from "./FilesPane";
import { ParsePane } from "./ParsePane";
import { PortPane } from "./PortPane";
import { TablePane } from "./TablePane";
import { UnpackBoardPane, UnpackReportPane, UnpackSumPane } from "./UnpackBoardPane";

const chipIdle = "imp-chip flex-shrink-0";
const chipOn = "imp-chip imp-chip-on flex-shrink-0";

/** 共用內容區：只依 activeTab 條件渲染，不改 DOM display */
export function ImportTabContent({
  activeTab,
  lists,
  releaseTab,
  setReleaseTab,
  portTab,
  setPortTab,
  unpackTab,
  setUnpackTab,
  sumTab,
  setSumTab,
  boardDay,
  setBoardDay,
  refresh,
  openDrawer,
  setActiveTab,
  padClass = "p-2.5",
}) {
  const title = PANE_TITLE[activeTab] || "進口";
  const portCounts = lists.portCounts || { open: 0, inspect: 0, fume: 0 };

  return (
    <div className={`min-h-0 flex-1 overflow-auto ${padClass}`}>
      {activeTab === "parse" ? (
        <ParsePane title={title} drafts={lists.drafts} onParsed={refresh} onOpenDraft={(i) => openDrawer("draft", String(i))} />
      ) : null}

      {activeTab === "port" ? (
        <PortPane
          title={title}
          hint="同畫面勾選已放行；藥檢／薰蒸／拖車派貨直接改。也可手動新增，或到「舊資料」下載格式匯入。"
          portTab={portTab}
          setPortTab={setPortTab}
          portCounts={portCounts}
          rows={lists.port}
          refresh={refresh}
          onAfterRelease={() => setActiveTab?.("release")}
        />
      ) : null}

      {activeTab === "release" ? (
        <div className="grid gap-2.5">
          <div
            className="flex w-full flex-row gap-2 overflow-x-auto whitespace-nowrap p-0.5 touch-pan-x"
            role="tablist"
            aria-label="已放行狀態"
          >
            {[
              ["open", "全部", lists.releaseCounts.open, false],
              ["arrange", "待排拆櫃", lists.releaseCounts.arrange, false],
              ["pickup", "可排拆櫃", lists.releaseCounts.pickup, false],
            ].map(([id, lab, count, warn]) => (
              <button key={id} type="button" className={releaseTab === id ? chipOn : chipIdle} onClick={() => setReleaseTab(id)}>
                {lab}
                <CountBadge count={count} warn={warn} />
              </button>
            ))}
          </div>
          <TablePane
            title={title}
            hint="可排拆櫃：與拖車確認拆卸位置與日期時間，拆工可後填；儲存後派送「貨櫃拆卸資料」。"
            columns={["到港日", "編號(UHA/NC)", "櫃號", "品名", "藥檢", "薰蒸", "結束時間", "狀態"]}
            rows={lists.release}
            onOpen={(key) => openDrawer("release", key)}
          />
        </div>
      ) : null}

      {activeTab === "upBoard" ? (
        <UnpackBoardPane title={title} lists={lists} boardDay={boardDay} setBoardDay={setBoardDay} openDrawer={openDrawer} />
      ) : null}

      {activeTab === "unpack" ? (
        <UnpackReportPane
          title={title}
          lists={lists}
          unpackTab={unpackTab}
          setUnpackTab={setUnpackTab}
          openDrawer={openDrawer}
        />
      ) : null}

      {activeTab === "sum" ? (
        <UnpackSumPane
          title={title}
          lists={lists}
          sumTab={sumTab}
          setSumTab={setSumTab}
          openDrawer={openDrawer}
          onExport={() => api().exportSumExcel?.()}
        />
      ) : null}

      {activeTab === "stock" ? (
        <TablePane
          title={title}
          hint="已入庫明細。"
          columns={["拆櫃日", "編號(UHA/NC)", "櫃號", "產品", "報關數量", "拆櫃數量"]}
          rows={lists.stock}
          onOpen={(key) => openDrawer("stock", key)}
        />
      ) : null}

      {activeTab === "files" ? <FilesPane title={title} refresh={refresh} /> : null}

      {activeTab === "buy" ||
      activeTab === "broker" ||
      activeTab === "vendor" ||
      activeTab === "trailer" ||
      activeTab === "labor" ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <h2 className="m-0 text-xl font-bold text-slate-800">{title}</h2>
          <p className="mt-1 text-xs text-slate-400">
            {activeTab === "buy"
              ? "採購單建置中。"
              : activeTab === "broker"
                ? "報關行往來與費用對帳建置中。"
                : activeTab === "vendor"
                  ? "進口廠商資料與對帳建置中。"
                  : activeTab === "trailer"
                    ? "拖車費用與調度對帳建置中。"
                    : "拆櫃工資與工班對帳建置中。"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
