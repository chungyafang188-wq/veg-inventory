import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ensureImportState, saveState, setStatus, syncHostPane } from "./bridge";
import { CLEAR_OPTS, normalizePane, todayYmd } from "./constants";
import { Drawer } from "./components/Drawer";
import { useLayoutMode } from "./hooks/useLayoutMode";
import { PhoneShell } from "./shells/PhoneShell";
import { WebShell } from "./shells/WebShell";

/**
 * 方案 3：依 layout 只掛一殼；切換只靠 activeTab。
 * 不使用 JS 直接改 DOM display。
 */
export default function ImportApp({ initialPane = "parse" }) {
  const layout = useLayoutMode();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const [activeTab, setActiveTabState] = useState(() => normalizePane(initialPane));
  const [drawer, setDrawer] = useState(null);
  const [drawerFull, setDrawerFull] = useState(false);
  const [draft, setDraft] = useState(null);
  const [releaseTab, setReleaseTab] = useState("open");
  const [portTab, setPortTab] = useState("open");
  const [unpackTab, setUnpackTab] = useState("pending");
  const [sumTab, setSumTab] = useState("open");
  const [boardDay, setBoardDay] = useState(() => todayYmd());

  useEffect(() => {
    if (releaseTab === "check") setReleaseTab("arrange");
  }, [releaseTab]);

  const setActiveTab = useCallback(
    (next) => {
      if (draft?.dirty) {
        if (!confirm("尚有未儲存的修改，確定切換？")) return;
      }
      setDrawer(null);
      setDrawerFull(false);
      setDraft(null);
      setActiveTabState(normalizePane(next));
    },
    [draft],
  );

  useEffect(() => {
    const onSet = (e) => {
      const next = normalizePane(e?.detail);
      if (next) setActiveTabState(next);
    };
    window.addEventListener("import-set-pane", onSet);
    return () => window.removeEventListener("import-set-pane", onSet);
  }, []);

  useEffect(() => {
    ensureImportState();
    const onRemote = () => refresh();
    window.addEventListener("import-remote-applied", onRemote);
    return () => window.removeEventListener("import-remote-applied", onRemote);
  }, []);

  useEffect(() => {
    syncHostPane(activeTab);
  }, [activeTab]);

  const openDrawer = (kind, key) => {
    const a = api();
    const fields = a.loadDrawerFields?.(kind, String(key)) || null;
    if (!fields && kind !== "stock") {
      setStatus("找不到資料。", true);
      return;
    }
    setDrawer({ kind, key: String(key) });
    setDrawerFull(false);
    setDraft({
      kind,
      key: String(key),
      fields: fields ? { ...fields } : null,
      baseUpdatedAt: fields ? Number(fields.updatedAt) || 0 : 0,
      dirty: false,
      remoteNewer: false,
    });
  };

  const closeDrawer = (force) => {
    if (draft?.dirty && !force) {
      if (!confirm("尚有未儲存的修改，確定關閉？")) return false;
    }
    setDrawer(null);
    setDrawerFull(false);
    setDraft(null);
    return true;
  };

  const setField = (field, value) => {
    setDraft((d) => {
      if (!d?.fields) return d;
      return { ...d, dirty: true, fields: { ...d.fields, [field]: value } };
    });
  };

  const commitDraft = (extra = {}) => {
    if (!draft?.fields) return;
    const payload = { ...draft, fields: { ...draft.fields, ...extra } };
    const ok = api().commitDrawerSession?.(payload);
    if (ok === false) return;
    setDraft((d) =>
      d
        ? {
            ...d,
            dirty: false,
            remoteNewer: false,
            baseUpdatedAt: Date.now(),
            fields: api().loadDrawerFields?.(d.kind, d.key) || { ...d.fields, ...extra },
          }
        : d,
    );
    refresh();
  };

  const lists = useMemo(() => {
    const a = api();
    ensureImportState();
    const drafts = a.listDrafts?.() || [];
    const portCounts = a.portTabCounts?.() || { open: 0, inspect: 0, fume: 0 };
    const port = a.listPort?.(portTab) || [];
    const stock = a.listStock?.() || [];
    const releaseCounts = a.releaseTabCounts?.() || { open: 0, arrange: 0, check: 0, pickup: 0 };
    const upBoardMeta = a.upBoardMeta?.(boardDay) || { total: 0, missingTrailer: 0, day: boardDay };
    const upBoard = a.listUpBoard?.(boardDay) || [];
    const unpackApi = typeof window !== "undefined" ? window.__unpackApi : null;
    const unpackCounts = unpackApi?.tabCounts?.() || { pending: 0, reported: 0 };
    const unpack = unpackApi?.listJobs?.(unpackTab) || [];
    const sumCounts = a.sumTabCounts?.() || { open: 0, needQty: 0, customer: 0, coldstore: 0 };
    const sum = a.listSum?.(sumTab) || [];
    return {
      drafts,
      port,
      portCounts,
      release: a.listRelease?.(releaseTab) || [],
      releaseCounts,
      stock,
      upBoard,
      upBoardMeta,
      unpack,
      unpackCounts,
      sum,
      sumCounts,
      unpackers: a.unpackerNames?.() || [],
      trailers: a.trailerNames?.() || [],
      tabCounts: {
        parse: drafts.length,
        port: portCounts.open,
        release: releaseCounts.open,
        upBoard: upBoardMeta.total,
        unpack: unpackCounts.pending,
        sum: sumCounts.open,
        stock: stock.length,
      },
    };
  }, [activeTab, releaseTab, portTab, unpackTab, sumTab, boardDay, tick]);

  const contentProps = {
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
  };

  const shell =
    layout === "web" ? (
      <WebShell activeTab={activeTab} setActiveTab={setActiveTab} tabCounts={lists.tabCounts} contentProps={contentProps} />
    ) : (
      <PhoneShell activeTab={activeTab} setActiveTab={setActiveTab} tabCounts={lists.tabCounts} contentProps={contentProps} />
    );

  return (
    <div className="relative">
      {shell}
      {drawer && draft ? (
        <Drawer
          drawer={drawer}
          draft={draft}
          full={drawerFull}
          clearOpts={CLEAR_OPTS}
          unpackers={lists.unpackers}
          onClose={() => closeDrawer()}
          onForceClose={() => closeDrawer(true)}
          onToggleFull={() => setDrawerFull((v) => !v)}
          onField={setField}
          onSave={() => commitDraft()}
          onDispatch={() => {
            setField("pickupReady", true);
            commitDraft({ pickupReady: true, dispatchNow: true });
            setActiveTabState("upBoard");
            closeDrawer(true);
            refresh();
          }}
          onSubmitReport={() => {
            commitDraft({ submitReport: true });
            closeDrawer(true);
            setUnpackTab("reported");
            refresh();
          }}
          onReloadRemote={() => {
            const fields = api().loadDrawerFields?.(draft.kind, draft.key);
            if (!fields) return;
            if (draft.dirty && !confirm("將捨棄你正在輸入的內容，改載入最新資料？")) return;
            setDraft({
              ...draft,
              fields: { ...fields },
              baseUpdatedAt: Number(fields.updatedAt) || 0,
              dirty: false,
              remoteNewer: false,
            });
          }}
          onKeepRemote={() => setDraft((d) => (d ? { ...d, remoteNewer: false } : d))}
          onMarkRelease={() => {
            if (draft.dirty) commitDraft();
            api().markPortReleased?.(draft.key);
            setActiveTabState("release");
            openDrawer("release", draft.key);
            refresh();
          }}
          onConfirmDraft={() => {
            if (draft.dirty) commitDraft();
            api().confirmParseDraft?.(Number(draft.key));
            setActiveTabState("port");
            closeDrawer(true);
            refresh();
          }}
          onDropDraft={() => {
            const state = ensureImportState();
            if (!state) return;
            state.importParseDrafts.splice(Number(draft.key), 1);
            saveState();
            closeDrawer(true);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}
