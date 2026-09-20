import { DEST_OPTS } from "../constants";

function Field({ label, children }) {
  return (
    <label className="grid gap-1 text-[0.78rem] font-bold text-imp-muted">
      {label}
      {children}
    </label>
  );
}

function inputCls() {
  return "w-full rounded-md border border-imp-line bg-white px-2 py-1.5 text-[0.88rem] font-normal text-imp-ink outline-none focus:border-imp-green";
}

function Check({ label, checked, onChange }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[0.82rem] font-normal text-imp-ink">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Drawer({
  drawer,
  draft,
  full,
  clearOpts,
  unpackers = [],
  onClose,
  onForceClose,
  onToggleFull,
  onField,
  onSave,
  onDispatch,
  onSubmitReport,
  onReloadRemote,
  onKeepRemote,
  onMarkRelease,
  onConfirmDraft,
  onDropDraft,
}) {
  const f = draft.fields || {};
  const kind = drawer.kind;

  const title =
    kind === "draft"
      ? "草稿核對"
      : kind === "port"
        ? `海關查驗 ${drawer.key}`
        : kind === "release"
          ? `已放行 ${drawer.key}`
          : kind === "upBoard"
            ? `拆卸總資料 ${f.uha || drawer.key}`
            : kind === "unpack"
              ? `拆櫃回報 ${f.uha || drawer.key}`
              : kind === "sum"
                ? `拆卸總清單 ${f.uha || drawer.key}`
                : `入庫明細 ${drawer.key}`;

  const selectClear = (field, value) => (
    <select className={inputCls()} value={value || "none"} onChange={(e) => onField(field, e.target.value)}>
      {clearOpts.map((o) => (
        <option key={o.id} value={o.id}>
          {o.lab}
        </option>
      ))}
    </select>
  );

  const showFooter = kind !== "stock";

  return (
    <div className="imp-drawer-host pointer-events-none absolute inset-0 z-40">
      <button type="button" aria-label="關閉" className="pointer-events-auto absolute inset-0 border-0 bg-black/35" onClick={onClose} />
      <aside
        className={`pointer-events-auto absolute flex flex-col bg-white shadow-xl ${
          full
            ? "inset-0 sm:inset-3 sm:rounded-lg"
            : "inset-x-0 bottom-0 max-h-[78%] rounded-t-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-none sm:w-[min(24rem,92vw)] sm:rounded-none sm:border-l sm:border-imp-line"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="border-b border-imp-line px-3 pb-2 pt-2">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-imp-line sm:hidden" />
          <div className="flex items-center justify-between gap-2">
            <strong className="text-[0.95rem] font-bold">{title}</strong>
            <div className="flex gap-1">
              <button type="button" className="rounded px-2 py-1 text-[0.75rem] text-imp-muted hover:bg-imp-panel" onClick={onToggleFull}>
                {full ? "結束完整編輯" : "完整編輯"}
              </button>
              <button type="button" className="rounded px-2 py-1 text-[0.85rem] text-imp-muted hover:bg-imp-panel" onClick={onClose} aria-label="關閉">
                ✕
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          {draft.remoteNewer ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-imp-warn-line bg-imp-warn-bg px-2.5 py-2 text-[0.82rem] text-imp-warn">
              <span>遠端有較新資料；你正在輸入的內容尚未被覆蓋。</span>
              <button type="button" className="rounded border border-imp-warn-line bg-white px-2 py-0.5 text-[0.75rem]" onClick={onKeepRemote}>
                繼續編輯
              </button>
              <button type="button" className="rounded border border-imp-warn-line bg-white px-2 py-0.5 text-[0.75rem]" onClick={onReloadRemote}>
                改載入最新
              </button>
            </div>
          ) : null}

          {kind === "draft" ? (
            <div className="grid gap-2.5">
              <Field label="編號（UHA／NC）">
                <input className={inputCls()} value={f.uha || ""} onChange={(e) => onField("uha", e.target.value)} placeholder="UHA715 或 NC002" />
              </Field>
              <Field label="櫃號（EMCU／FBIU…）">
                <input className={inputCls()} value={f.containerNo || ""} onChange={(e) => onField("containerNo", e.target.value)} placeholder="EMCU5743731" />
              </Field>
              <Field label="報關單號">
                <input className={inputCls()} value={f.customsNo || ""} onChange={(e) => onField("customsNo", e.target.value)} />
              </Field>
              <Field label="到港日">
                <input type="date" className={inputCls()} value={f.arriveDay || ""} onChange={(e) => onField("arriveDay", e.target.value)} />
              </Field>
              <Field label="品名">
                <input className={inputCls()} value={f.product || ""} onChange={(e) => onField("product", e.target.value)} />
              </Field>
              <Field label="報關行">
                <input className={inputCls()} value={f.broker || ""} onChange={(e) => onField("broker", e.target.value)} />
              </Field>
            </div>
          ) : null}

          {kind === "port" ? (
            <div className="grid gap-2.5">
              <p className="m-0 text-[0.8rem] text-imp-muted">
                {`${f.product || "—"} · ${f.containerNo || "尚無櫃號"} · 到港日 ${f.arriveDay || "—"}。時間出來後接近 FT 排領櫃。`}
              </p>
              <Field label="藥檢">
                {selectClear("inspect", f.inspect)}
                <span className="mt-1 block text-[0.72rem] font-semibold text-imp-muted">藥檢報告時間</span>
                <input type="datetime-local" className={`${inputCls()} mt-0.5`} value={(f.inspectAt || "").slice(0, 16)} onChange={(e) => onField("inspectAt", e.target.value)} />
              </Field>
              <Field label="薰蒸">
                {selectClear("fumigate", f.fumigate)}
                <span className="mt-1 block text-[0.72rem] font-semibold text-imp-muted">薰蒸排定時間</span>
                <input type="datetime-local" className={`${inputCls()} mt-0.5`} value={(f.fumigateAt || "").slice(0, 16)} onChange={(e) => onField("fumigateAt", e.target.value)} />
              </Field>
              <Field label="碼頭">
                <input className={inputCls()} value={f.dock || ""} onChange={(e) => onField("dock", e.target.value)} placeholder="檢驗／卸貨碼頭" />
              </Field>
              <Field label="拖車">
                <input className={inputCls()} value={f.trailer || ""} onChange={(e) => onField("trailer", e.target.value)} placeholder="拖車窗口" />
              </Field>
              <Field label="備註">
                <input className={inputCls()} value={f.note || ""} onChange={(e) => onField("note", e.target.value)} />
              </Field>
            </div>
          ) : null}

          {kind === "release" ? (
            <div className="grid gap-2.5">
              <p className="m-0 text-[0.8rem] text-imp-muted">與拖車確認拆卸位置、日期時間後派送貨櫃拆卸資料；拆工可後填。</p>
              <div className="flex flex-wrap gap-3">
                <Check label="確認 FT" checked={f.ftConfirmed} onChange={(v) => onField("ftConfirmed", v)} />
                <Check label="已排拆櫃" checked={f.pickupReady} onChange={(v) => onField("pickupReady", v)} />
              </div>
              <Field label="拆卸日期時間">
                <input type="datetime-local" className={inputCls()} value={(f.unpackAt || "").slice(0, 16)} onChange={(e) => onField("unpackAt", e.target.value)} />
              </Field>
              <Field label="拆卸位置">
                <input className={inputCls()} value={f.unpackSite || ""} onChange={(e) => onField("unpackSite", e.target.value)} placeholder="碼頭／冰庫／客戶點" />
              </Field>
              <Field label="拖車">
                <input className={inputCls()} value={f.trailer || ""} onChange={(e) => onField("trailer", e.target.value)} />
              </Field>
              <Field label="拖車電話">
                <input type="tel" className={inputCls()} value={f.trailerPhone || ""} onChange={(e) => onField("trailerPhone", e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-3">
                <Check label="已確認拖車電話" checked={f.trailerConfirmed} onChange={(v) => onField("trailerConfirmed", v)} />
                <Check label="通知拖車" checked={f.notifyTrailer} onChange={(v) => onField("notifyTrailer", v)} />
              </div>
              <Field label="拖車備註">
                <input className={inputCls()} value={f.trailerNote || ""} onChange={(e) => onField("trailerNote", e.target.value)} />
              </Field>
              <Field label="拆工（可後填）">
                <input className={inputCls()} list="imp-unpackers" value={f.assignee || ""} onChange={(e) => onField("assignee", e.target.value)} />
              </Field>
              <Field label="指派數量（可後填）">
                <input type="number" className={inputCls()} value={f.assignQty ?? ""} onChange={(e) => onField("assignQty", e.target.value)} />
              </Field>
              <Field label="去向">
                <select className={inputCls()} value={f.destType || "coldstore"} onChange={(e) => onField("destType", e.target.value)}>
                  {DEST_OPTS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.lab}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex flex-wrap gap-3">
                <Check label="半櫃另指派" checked={f.halfSplit} onChange={(v) => onField("halfSplit", v)} />
                <Check label="通知拆工" checked={f.notifyUnpacker} onChange={(v) => onField("notifyUnpacker", v)} />
                <Check label="通知客戶" checked={f.notifyCustomer} onChange={(v) => onField("notifyCustomer", v)} />
              </div>
              {f.halfSplit ? (
                <>
                  <Field label="半櫃②拆工">
                    <input className={inputCls()} list="imp-unpackers" value={f.assignee2 || ""} onChange={(e) => onField("assignee2", e.target.value)} />
                  </Field>
                  <Field label="半櫃②數量">
                    <input type="number" className={inputCls()} value={f.assignQty2 ?? ""} onChange={(e) => onField("assignQty2", e.target.value)} />
                  </Field>
                  <Field label="半櫃②位置">
                    <input className={inputCls()} value={f.unpackSite2 || ""} onChange={(e) => onField("unpackSite2", e.target.value)} />
                  </Field>
                </>
              ) : null}
              <Field label="藥檢結束">
                {selectClear("inspect", f.inspect)}
                <input type="datetime-local" className={`${inputCls()} mt-1`} value={(f.inspectAt || "").slice(0, 16)} onChange={(e) => onField("inspectAt", e.target.value)} />
              </Field>
              <Field label="薰蒸結束">
                {selectClear("fumigate", f.fumigate)}
                <input type="datetime-local" className={`${inputCls()} mt-1`} value={(f.fumigateAt || "").slice(0, 16)} onChange={(e) => onField("fumigateAt", e.target.value)} />
              </Field>
              <Field label="備註">
                <input className={inputCls()} value={f.note || ""} onChange={(e) => onField("note", e.target.value)} />
              </Field>
            </div>
          ) : null}

          {kind === "upBoard" ? (
            <div className="grid gap-2.5">
              <p className="m-0 text-[0.8rem] text-imp-muted">
                {f.name || "—"} · {f.containerNo || "—"} · {f.halfPart === "2" ? "半櫃②" : "半櫃／整櫃"}
              </p>
              {!f.trailerPhone || !f.trailer ? (
                <p className="m-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[0.78rem] font-semibold text-amber-800">缺拖車資料，請補齊拖車與電話。</p>
              ) : null}
              <Field label="拆卸時間">
                <input type="datetime-local" className={inputCls()} value={(f.unpackAt || "").slice(0, 16)} onChange={(e) => onField("unpackAt", e.target.value)} />
              </Field>
              <Field label="拖車">
                <input className={inputCls()} value={f.trailer || ""} onChange={(e) => onField("trailer", e.target.value)} />
              </Field>
              <Field label="拖車電話">
                <input type="tel" className={inputCls()} value={f.trailerPhone || ""} onChange={(e) => onField("trailerPhone", e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-3">
                <Check label="已確認拖車電話" checked={f.trailerConfirmed} onChange={(v) => onField("trailerConfirmed", v)} />
                <Check label="通知拖車" checked={f.notifyTrailer} onChange={(v) => onField("notifyTrailer", v)} />
                <Check label="通知拆工" checked={f.notifyUnpacker} onChange={(v) => onField("notifyUnpacker", v)} />
                <Check label="通知客戶" checked={f.notifyCustomer} onChange={(v) => onField("notifyCustomer", v)} />
              </div>
              <Field label="拖車備註">
                <input className={inputCls()} value={f.trailerNote || ""} onChange={(e) => onField("trailerNote", e.target.value)} />
              </Field>
              <Field label="拆工">
                <input className={inputCls()} list="imp-unpackers" value={f.assignee || ""} onChange={(e) => onField("assignee", e.target.value)} />
              </Field>
              <Field label="指派數量">
                <input type="number" className={inputCls()} value={f.assignQty ?? ""} onChange={(e) => onField("assignQty", e.target.value)} />
              </Field>
              <Field label="拆卸位置">
                <input className={inputCls()} value={f.location || ""} onChange={(e) => onField("location", e.target.value)} />
              </Field>
              <Field label="去向">
                <select className={inputCls()} value={f.destType || "coldstore"} onChange={(e) => onField("destType", e.target.value)}>
                  {DEST_OPTS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.lab}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="備註">
                <input className={inputCls()} value={f.note || ""} onChange={(e) => onField("note", e.target.value)} />
              </Field>
            </div>
          ) : null}

          {kind === "unpack" ? (
            <div className="grid gap-2.5">
              <p className="m-0 text-[0.8rem] text-imp-muted">
                {f.name || "—"} · 指派 {f.assignQty != null && f.assignQty !== "" ? f.assignQty : "—"} · {f.assignee || "未指派"}
              </p>
              <Field label="拆櫃編號">
                <input className={inputCls()} value={f.reportBox || ""} onChange={(e) => onField("reportBox", e.target.value)} disabled={!!f.readOnlyReport} />
              </Field>
              <Field label="拆櫃數量">
                <input type="number" className={inputCls()} value={f.unpackQty ?? ""} onChange={(e) => onField("unpackQty", e.target.value)} disabled={!!f.readOnlyReport} />
              </Field>
              <Field label="外箱">
                <input type="number" className={inputCls()} value={f.qty ?? ""} onChange={(e) => onField("qty", e.target.value)} disabled={!!f.readOnlyReport} />
              </Field>
              <Field label="拆卸位置">
                <input className={inputCls()} value={f.location || ""} onChange={(e) => onField("location", e.target.value)} disabled={!!f.readOnlyReport} />
              </Field>
              <Check label="入庫" checked={f.stockIn !== false} onChange={(v) => onField("stockIn", v)} />
              <Field label="備註">
                <input className={inputCls()} value={f.note || ""} onChange={(e) => onField("note", e.target.value)} disabled={!!f.readOnlyReport} />
              </Field>
            </div>
          ) : null}

          {kind === "sum" ? (
            <div className="grid gap-2.5">
              <Field label="拆卸日">
                <input type="date" className={inputCls()} value={f.day || ""} onChange={(e) => onField("day", e.target.value)} />
              </Field>
              <Field label="品名">
                <input className={inputCls()} value={f.product || ""} onChange={(e) => onField("product", e.target.value)} />
              </Field>
              <Field label="拆櫃數量">
                <input type="number" className={inputCls()} value={f.unpackQty ?? ""} onChange={(e) => onField("unpackQty", e.target.value)} />
              </Field>
              <Field label="拆卸位置／點">
                <input className={inputCls()} value={f.unload || f.location || ""} onChange={(e) => onField("unload", e.target.value)} />
              </Field>
              <Field label="去向">
                <select className={inputCls()} value={f.destType || "coldstore"} onChange={(e) => onField("destType", e.target.value)}>
                  {DEST_OPTS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.lab}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="備註">
                <input className={inputCls()} value={f.note || ""} onChange={(e) => onField("note", e.target.value)} />
              </Field>
              <p className="m-0 text-[0.75rem] text-imp-muted">交客戶且客戶自有拆工：在此補數量，不經配合拆工回報。</p>
            </div>
          ) : null}

          {kind === "stock" ? (
            <dl className="m-0 grid gap-2 text-[0.85rem]">
              {Object.entries(f)
                .filter(([k]) => !["updatedAt", "uha", "id"].includes(k))
                .map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[6rem_1fr] gap-2 border-b border-imp-line/60 py-1">
                    <dt className="text-imp-muted">{k}</dt>
                    <dd className="m-0">{v == null || v === "" ? "—" : String(v)}</dd>
                  </div>
                ))}
            </dl>
          ) : null}

          <datalist id="imp-unpackers">
            {unpackers.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>

        {showFooter ? (
          <div className="flex flex-wrap gap-2 border-t border-imp-line p-3">
            {kind === "draft" ? (
              <>
                <button type="button" className="rounded-md bg-imp-green px-3 py-2 text-[0.82rem] font-bold text-white" onClick={onConfirmDraft}>
                  確認列入海關查驗
                </button>
                <button type="button" className="rounded-md border border-imp-line px-3 py-2 text-[0.82rem]" onClick={onDropDraft}>
                  丟棄
                </button>
              </>
            ) : null}
            {kind === "port" ? (
              <button type="button" className="rounded-md bg-imp-green px-3 py-2 text-[0.82rem] font-bold text-white" onClick={onMarkRelease}>
                標示放行
              </button>
            ) : null}
            {kind === "release" ? (
              <button type="button" className="rounded-md bg-imp-green px-3 py-2 text-[0.82rem] font-bold text-white" onClick={onDispatch}>
                儲存並派送拆卸
              </button>
            ) : null}
            {kind === "unpack" && f.canReport ? (
              <button type="button" className="rounded-md bg-imp-green px-3 py-2 text-[0.82rem] font-bold text-white" onClick={onSubmitReport}>
                送出回報
              </button>
            ) : null}
            {kind !== "unpack" || !f.canReport ? (
              <button
                type="button"
                className="rounded-md bg-imp-green px-3 py-2 text-[0.82rem] font-bold text-white disabled:opacity-40"
                disabled={!draft.dirty && kind !== "release"}
                onClick={onSave}
              >
                儲存
              </button>
            ) : (
              <button
                type="button"
                className="rounded-md border border-imp-line px-3 py-2 text-[0.82rem] disabled:opacity-40"
                disabled={!draft.dirty}
                onClick={onSave}
              >
                暫存
              </button>
            )}
            <button type="button" className="rounded-md border border-imp-line px-3 py-2 text-[0.82rem]" onClick={onForceClose}>
              取消
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
