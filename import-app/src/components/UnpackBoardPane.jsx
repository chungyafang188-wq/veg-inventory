import { useMemo, useState } from "react";
import { CountBadge } from "./CountBadge";
import { ListQueryBar } from "./ListQueryBar";
import { TablePane } from "./TablePane";
import { setStatus } from "../bridge";
import { fumeHoldLine, handoverLines, handoverWithFume, sheetImageBlob, sheetProduct, sheetWorker } from "../lib/sheetList";
import { workerNoticeText } from "../lib/notifyCopy";
import { queryRows, SEARCH_FIELDS, SORT_GETTERS, SORT_OPTS } from "../lib/listQuery";

/** 貨櫃拆卸排程：已預排拆卸的櫃子。可依客戶、拆工、時間排序。 */
export function UnpackBoardPane({ title, lists, boardDay, setBoardDay, openDrawer }) {
  const meta = lists.upBoardMeta || { total: 0, missingTrailer: 0, marks: {} };
  const picked = Array.isArray(boardDay) ? boardDay : boardDay ? [boardDay] : [];
  const toggleDay = (ymd) => {
    setBoardDay((prev) => {
      const list = Array.isArray(prev) ? prev : prev ? [prev] : [];
      return list.includes(ymd) ? list.filter((d) => d !== ymd) : [...list, ymd].sort();
    });
  };
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("unpackAt");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [pressed, setPressed] = useState({ label: new Set(), notify: new Set() });
  const markPressed = (kind, key) => {
    if (!key) return;
    setPressed((prev) => {
      if (prev[kind].has(key)) return prev;
      const next = new Set(prev[kind]);
      next.add(key);
      return { ...prev, [kind]: next };
    });
  };

  const viewed = useMemo(() => {
    let list = (lists.upBoard || []).map((row) => ({
      ...row,
      handover: handoverWithFume(row).join(" "),
      sheetWorker: sheetWorker(row.assignee),
      sheetProduct: sheetProduct(row),
    }));
    if (onlyMissing) list = list.filter((r) => r.warn);
    return queryRows(list, {
      query,
      sortBy,
      fields: SEARCH_FIELDS.upBoard,
      getters: SORT_GETTERS.upBoard,
    });
  }, [lists.upBoard, query, sortBy, onlyMissing]);

  const copySheet = async () => {
    const caption = picked.length ? `貨櫃拆卸排程　${picked.map(formatMd).join("、")}` : "貨櫃拆卸排程　即將拆卸";
    try {
      const blob = await sheetImageBlob(viewed, caption);
      if (!blob || typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
        setStatus("這台不能把清單複製成圖片。", true);
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus(`已複製 ${viewed.length} 櫃的清單圖片，可直接貼到 LINE。`);
    } catch {
      setStatus("這台沒有複製到剪貼簿。", true);
    }
  };

  return (
    <div className="grid gap-2.5">
      <div className="imp-board-card">
        <div className="imp-board-head">
          <div className="imp-board-tools">
            <div className="imp-board-titleline">
              <h2 className="m-0 text-lg font-bold text-slate-800">{title}</h2>
              <p className="imp-board-hint">
                {picked.length
                  ? `已選 ${picked.map(formatMd).join("、")}，${meta.total} 櫃`
                  : `即將拆卸 ${meta.total} 櫃`}
                。圈起來的日期有資料，可點多天。紅字是交貨，領櫃日是拆工。
              </p>
            </div>
            <div className="imp-board-actions">
              <button type="button" className="imp-btn-primary" onClick={copySheet} disabled={!viewed.length}>
                複製清單
              </button>
              <button
                type="button"
                className={onlyMissing ? "imp-btn-primary" : "imp-btn-ghost"}
                onClick={() => setOnlyMissing((v) => !v)}
              >
                {onlyMissing ? "顯示全部" : "只看缺拖車"}
              </button>
            </div>
            <ListQueryBar
              stack
              query={query}
              onQuery={setQuery}
              sortBy={sortBy}
              onSort={setSortBy}
              sortOpts={SORT_OPTS.upBoard}
              placeholder="編號、櫃號、品名、客戶、拆工、拖車"
              resultCount={viewed.length}
              totalCount={(lists.upBoard || []).length}
            />
          </div>
          <ScheduleCalendar marks={meta.marks || {}} picked={picked} onToggle={toggleDay} onClear={() => setBoardDay([])} />
        </div>
      </div>
      <SheetTable
        emptyNote={picked.length ? "這幾天沒有拆卸資料" : "今天以後還沒有準備拆的貨櫃"}
        rows={viewed}
        onOpen={(key) => {
          const row = (lists.upBoard || []).find((r) => r.key === key);
          openDrawer("schedule", row?.uha || String(key).replace(/^rel:/, ""));
        }}
        pressed={pressed}
        onLabel={(row) => {
          if (typeof window.openContainerLabel !== "function") {
            setStatus("無法開啟貨櫃標籤。", true);
            return;
          }
          const ok = window.openContainerLabel({
            name: row.product || row.name || "",
            box: row.uha || "",
            vendor: row.seller || "",
            day: row.day || "",
          });
          if (ok === false) return;
          markPressed("label", row.key);
        }}
        onNotify={async (row) => {
          const text = workerNoticeText(row);
          try {
            await navigator.clipboard.writeText(text);
            markPressed("notify", row.key);
            setStatus("已複製拆工通知。");
          } catch {
            setStatus("這台沒有複製到剪貼簿。", true);
          }
        }}
      />
      {(lists.upBoard || []).length && !viewed.length ? (
        <p className="m-0 text-center text-sm text-slate-400">沒有符合搜尋／篩選的貨櫃</p>
      ) : null}
    </div>
  );
}

function formatMd(ymd) {
  const m = String(ymd || "").match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${Number(m[1])}/${Number(m[2])}`;
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthCells(ym) {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const pad = first.getDay();
  const count = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < pad; i += 1) cells.push("");
  for (let d = 1; d <= count; d += 1) cells.push(`${ym}-${String(d).padStart(2, "0")}`);
  return cells;
}

function ScheduleCalendar({ marks, picked, onToggle, onClear }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const cells = monthCells(month);
  const [y, m] = month.split("-");
  const chosen = new Set(picked);
  return (
    <div className="imp-cal">
      <div className="imp-cal-head">
        <button type="button" className="imp-cal-nav" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="上個月">
          ‹
        </button>
        <strong>
          {Number(y)}/{Number(m)}
        </strong>
        <button type="button" className="imp-cal-nav" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="下個月">
          ›
        </button>
      </div>
      <div className="imp-cal-grid" aria-hidden="true">
        {"日一二三四五六".split("").map((lab) => (
          <span key={lab} className="imp-cal-dow">
            {lab}
          </span>
        ))}
      </div>
      <div className="imp-cal-grid">
        {cells.map((ymd, i) =>
          ymd ? (
            <button
              key={ymd}
              type="button"
              className={`imp-cal-day${marks[ymd] ? " is-data" : ""}${chosen.has(ymd) ? " is-on" : ""}${ymd === today ? " is-today" : ""}`}
              aria-pressed={chosen.has(ymd)}
              aria-label={`${formatMd(ymd)}${marks[ymd] ? ` ${marks[ymd]}櫃` : ""}`}
              onClick={() => onToggle(ymd)}
            >
              {Number(ymd.slice(8))}
            </button>
          ) : (
            <span key={`e${i}`} />
          ),
        )}
      </div>
      {picked.length ? (
        <button type="button" className="imp-cal-clear" onClick={onClear}>
          回到即將拆卸
        </button>
      ) : (
        <p className="imp-cal-note">圈起來的日期有拆卸資料</p>
      )}
    </div>
  );
}

function SheetTable({ rows, onOpen, onLabel, onNotify, emptyNote, pressed }) {
  if (!rows?.length) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-12 text-center shadow-sm">
        <p className="m-0 text-sm font-medium text-slate-500">目前沒有資料</p>
        <p className="m-0 mt-1 text-xs text-slate-400">{emptyNote || "還沒有預排拆卸的貨櫃"}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <table className="imp-sheet">
        <thead>
          <tr>
            <th>編號</th>
            <th>貨櫃號碼</th>
            <th>交貨資料</th>
            <th>品項/件數</th>
            <th>拖車</th>
            <th>領櫃日</th>
            <th>功能</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const lines = handoverLines(row);
            const fume = fumeHoldLine(row);
            const labelDone = pressed?.label?.has(row.key);
            const notifyDone = pressed?.notify?.has(row.key);
            return (
              <tr key={row.key} onClick={() => onOpen?.(row.key)}>
                <td className="is-uha">{row.uha || ""}</td>
                <td>{row.containerNo || ""}</td>
                <td className="is-handover">
                  {lines.join("\n")}
                  {fume ? <span className="is-fume">{fume}</span> : null}
                </td>
                <td>{row.sheetProduct || sheetProduct(row)}</td>
                <td className={row.missTrailer ? "is-miss" : ""}>{row.trailer || ""}</td>
                <td className="is-worker">{row.sheetWorker || sheetWorker(row.assignee)}</td>
                <td className="is-act">
                  <button
                    type="button"
                    className={`imp-sheet-act${labelDone ? " is-done" : ""}`}
                    aria-pressed={labelDone ? "true" : "false"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onLabel?.(row);
                    }}
                  >
                    標籤
                  </button>
                  <button
                    type="button"
                    className={`imp-sheet-act${notifyDone ? " is-done" : ""}`}
                    aria-pressed={notifyDone ? "true" : "false"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNotify?.(row);
                    }}
                  >
                    通知拆工
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
        hint="拆工直接看這張工作單。客戶、交櫃時間、拖車、拆卸位置、拆工都從工作台那一列抄來，不用再另開一塊重填。換人、改時間也在工作台改。自行拆櫃不會出現在這裡。"
        columns={["編號", "櫃號", "品名", "工作單", "狀態"]}
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
