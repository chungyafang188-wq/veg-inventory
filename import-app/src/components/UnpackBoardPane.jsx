import { useMemo, useState } from "react";
import { CountBadge } from "./CountBadge";
import { ListQueryBar } from "./ListQueryBar";
import { TablePane } from "./TablePane";
import { queryRows, SEARCH_FIELDS, SORT_GETTERS, SORT_OPTS } from "../lib/listQuery";

/** 拆卸貨櫃總資料（現場拆櫃）：搜尋／排序＋預設今天 */
export function UnpackBoardPane({ title, lists, boardDay, setBoardDay, openDrawer }) {
  const meta = lists.upBoardMeta || { total: 0, missingTrailer: 0 };
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("unpackAt");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const viewed = useMemo(() => {
    let list = lists.upBoard || [];
    if (onlyMissing) list = list.filter((r) => r.warn);
    return queryRows(list, {
      query,
      sortBy,
      fields: SEARCH_FIELDS.upBoard,
      getters: SORT_GETTERS.upBoard,
    });
  }, [lists.upBoard, query, sortBy, onlyMissing]);

  return (
    <div className="grid gap-2.5">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-xl font-bold text-slate-800">{title}</h2>
          <label className="flex items-center gap-1.5 text-[0.78rem] font-bold text-slate-500">
            拆卸日
            <input
              type="date"
              className="imp-field w-auto"
              value={boardDay}
              onChange={(e) => setBoardDay(e.target.value)}
            />
          </label>
        </div>
        <p className="mt-1 m-0 text-xs text-slate-400">
          當日 {meta.total} 櫃。列表：拆卸日／編號／拆工／拖車。
          <span className="ml-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-300 align-middle" aria-hidden />
          <span className="ml-1">底色＝缺編號／拖車／電話，點入補齊。</span>
          {meta.missingTrailer > 0 ? <span className="ml-2 font-bold text-amber-700">{meta.missingTrailer} 筆缺資料</span> : null}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={onlyMissing ? "imp-btn-primary" : "imp-btn-ghost"}
            onClick={() => setOnlyMissing((v) => !v)}
          >
            {onlyMissing ? "顯示全部" : "只看缺資料"}
          </button>
        </div>
        <div className="mt-3">
          <ListQueryBar
            query={query}
            onQuery={setQuery}
            sortBy={sortBy}
            onSort={setSortBy}
            sortOpts={SORT_OPTS.upBoard}
            placeholder="搜尋編號、拆工、拖車…"
            resultCount={viewed.length}
            totalCount={(lists.upBoard || []).length}
          />
        </div>
      </div>
      <TablePane
        columns={["拆卸日", "編號", "拆工", "拖車"]}
        rows={viewed}
        onOpen={(key) => openDrawer("upBoard", key)}
      />
      {(lists.upBoard || []).length && !viewed.length ? (
        <p className="m-0 text-center text-sm text-slate-400">沒有符合搜尋／篩選的貨櫃</p>
      ) : null}
    </div>
  );
}

const chipIdle = "imp-chip flex-shrink-0";
const chipOn = "imp-chip imp-chip-on flex-shrink-0";

export function UnpackReportPane({ title, lists, unpackTab, setUnpackTab, openDrawer }) {
  const counts = lists.unpackCounts || { pending: 0, reported: 0 };
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("uha");

  const viewed = useMemo(
    () =>
      queryRows(lists.unpack || [], {
        query,
        sortBy,
        fields: SEARCH_FIELDS.upBoard,
        getters: SORT_GETTERS.upBoard,
      }),
    [lists.unpack, query, sortBy],
  );

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
      <ListQueryBar
        query={query}
        onQuery={setQuery}
        sortBy={sortBy}
        onSort={setSortBy}
        sortOpts={[
          { id: "uha", lab: "編號" },
          { id: "product", lab: "品名" },
          { id: "trailer", lab: "拖車" },
        ]}
        placeholder="搜尋編號、品名、櫃號…"
        resultCount={viewed.length}
        totalCount={(lists.unpack || []).length}
      />
      <TablePane
        title={title}
        hint="配合拆工只回報自己被指派的櫃與數量。交客戶自有拆工者不在此回報。"
        columns={["拆櫃日", "編號", "品名", "櫃號", "負責人", "指派數量", "拆櫃數量", "狀態"]}
        rows={viewed}
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
