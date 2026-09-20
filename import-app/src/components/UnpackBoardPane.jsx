import { CountBadge } from "./CountBadge";
import { TablePane } from "./TablePane";

/** 拆卸貨櫃總資料：預設今天、可選日；缺拖車提醒 */
export function UnpackBoardPane({ title, lists, boardDay, setBoardDay, openDrawer }) {
  const meta = lists.upBoardMeta || { total: 0, missingTrailer: 0 };

  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[0.78rem] font-bold text-imp-muted">
          拆卸日
          <input
            type="date"
            className="rounded-md border border-imp-line bg-white px-2 py-1.5 text-[0.88rem] font-normal text-imp-ink"
            value={boardDay}
            onChange={(e) => setBoardDay(e.target.value)}
          />
        </label>
        <span className="text-[0.78rem] text-imp-muted">
          當日 {meta.total} 櫃
          {meta.missingTrailer > 0 ? (
            <span className="ml-2 font-bold text-amber-700">缺拖車資料 {meta.missingTrailer}</span>
          ) : null}
        </span>
      </div>
      <TablePane
        title={title}
        hint="補拖車電話、改拆工、拆卸位置。確認電話後可核取並勾選通知拖車／拆工／客戶。"
        columns={["拆卸時間", "編號", "櫃號", "品名", "拖車", "電話", "拆工", "位置", "類型", "狀態"]}
        rows={lists.upBoard}
        onOpen={(key) => openDrawer("upBoard", key)}
      />
    </div>
  );
}

const chipIdle = "imp-chip flex-shrink-0";
const chipOn = "imp-chip imp-chip-on flex-shrink-0";

export function UnpackReportPane({ title, lists, unpackTab, setUnpackTab, openDrawer }) {
  const counts = lists.unpackCounts || { pending: 0, reported: 0 };
  return (
    <div className="grid gap-2.5">
      <div className="flex w-full flex-row gap-2 overflow-x-auto whitespace-nowrap p-0.5 touch-pan-x" role="tablist" aria-label="拆櫃回報">
        {[
          ["pending", "待回報", counts.pending],
          ["reported", "回報明細", counts.reported],
        ].map(([id, lab, count]) => (
          <button key={id} type="button" className={unpackTab === id ? chipOn : chipIdle} onClick={() => setUnpackTab(id)}>
            {lab}
            <CountBadge count={count} />
          </button>
        ))}
      </div>
      <TablePane
        title={title}
        hint="配合拆工只回報自己被指派的櫃與數量。交客戶自有拆工者不在此回報。"
        columns={["拆櫃日", "編號", "品名", "櫃號", "負責人", "指派數量", "拆櫃數量", "狀態"]}
        rows={lists.unpack}
        onOpen={(key) => openDrawer("unpack", key)}
      />
    </div>
  );
}

export function UnpackSumPane({ title, lists, sumTab, setSumTab, openDrawer, onExport }) {
  const counts = lists.sumCounts || { open: 0, needQty: 0, customer: 0, coldstore: 0 };
  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex w-full flex-row gap-2 overflow-x-auto whitespace-nowrap p-0.5 touch-pan-x sm:w-auto" role="tablist" aria-label="拆卸總清單">
          {[
            ["open", "全部", counts.open],
            ["needQty", "待補數量", counts.needQty],
            ["customer", "交客戶", counts.customer],
            ["coldstore", "自有冰庫", counts.coldstore],
          ].map(([id, lab, count]) => (
            <button key={id} type="button" className={sumTab === id ? chipOn : chipIdle} onClick={() => setSumTab(id)}>
              {lab}
              <CountBadge count={count} />
            </button>
          ))}
        </div>
        {onExport ? (
          <button type="button" className={chipOn} onClick={onExport}>
            匯出
          </button>
        ) : null}
      </div>
      <TablePane
        title={title}
        hint="會計核對拆櫃數量、位置、拆卸點。交客戶／客戶自有拆工可在此補數量。"
        columns={["拆卸日", "編號", "櫃號", "品名", "拆櫃數量", "位置", "去向", "拆工", "狀態"]}
        rows={lists.sum}
        onOpen={(key) => openDrawer("sum", key)}
      />
    </div>
  );
}
