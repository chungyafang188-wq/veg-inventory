/**
 * 進口業務：櫃表／進櫃紀錄／已放行
 * 櫃表＝海關總表
 * 進櫃紀錄＝已拆櫃入公司倉庫（海關狀態不用再查）
 * 櫃表有、進櫃紀錄沒有、未放行＝到港待驗
 * 已放行且未拆櫃＝已放行（未拆櫃）
 *
 * UI：左側模組列 + 主表 + 右側／底部抽屜（不換頁）
 */
(function () {
  let importPane = "parse"; // parse | buy | port | release | stock | sum | files | broker...
  let releaseListTab = "open"; // open | arrange | check | pickup
  let drawer = null; // { kind, key } | null
  let drawerFull = false;
  /** 本機草稿：Drawer 開啟期間不受背景 Pull 覆蓋 */
  let drawerSession = null; // { kind, key, fields, baseUpdatedAt, dirty, remoteNewer }

  const CLEAR_OPTS = [
    { id: "none", lab: "待確認" },
    { id: "wait", lab: "需要" },
    { id: "done", lab: "完成" },
    { id: "skip", lab: "無須檢驗" },
  ];

  function clearOptsFor(kind) {
    return CLEAR_OPTS.map((o) => {
      if (o.id !== "wait") return o;
      if (kind === "inspect") return { ...o, lab: "需要藥檢" };
      if (kind === "fumigate") return { ...o, lab: "需要薰蒸" };
      return o;
    });
  }

  const PANE_TITLE = {
    hub: "判讀",
    parse: "判讀",
    status: "海關查驗",
    board: "判讀",
    buy: "進口採購",
    port: "海關查驗",
    release: "已放行",
    checklist: "查驗清單",
    stock: "進口庫存",
    sum: "拆卸總清單",
    upBoard: "拆卸貨櫃總資料",
    unpack: "拆櫃回報",
    files: "舊資料",
    broker: "報關行",
    vendor: "廠商",
    trailer: "拖車",
    labor: "拆工",
  };

  const IMP_BLOCKS = [
    { id: "port", lab: "港口辦理" },
    { id: "unpack", lab: "貨櫃拆卸資料" },
    { id: "acct", lab: "帳務與庫存" },
  ];

  const IMP_TABS = [
    { id: "parse", lab: "判讀", block: "port" },
    { id: "port", lab: "海關查驗", block: "port" },
    { id: "release", lab: "已放行", block: "port" },
    { id: "checklist", lab: "查驗清單", block: "port" },
    { id: "files", lab: "舊資料", block: "port" },
    { id: "upBoard", lab: "拆卸貨櫃總資料", block: "unpack" },
    { id: "unpack", lab: "拆櫃回報", block: "unpack" },
    { id: "sum", lab: "拆卸總清單", block: "unpack" },
    { id: "stock", lab: "庫存", block: "acct" },
    { id: "buy", lab: "採購", block: "acct" },
    { id: "broker", lab: "報關行", block: "acct" },
    { id: "vendor", lab: "廠商", block: "acct" },
    { id: "trailer", lab: "拖車", block: "acct" },
    { id: "labor", lab: "拆工", block: "acct" },
  ];

  function activeTabId(pane) {
    if (pane === "board" || pane === "hub") return "parse";
    if (pane === "status") return "port";
    return pane || "parse";
  }

  function blockOfPane(pane) {
    const id = activeTabId(pane);
    const t = IMP_TABS.find((x) => x.id === id);
    return (t && t.block) || "port";
  }

  function tabsForBlock(blockId) {
    return IMP_TABS.filter((x) => x.block === blockId);
  }

  function normalizePane(pane) {
    let p = pane || "parse";
    if (p === "board" || p === "hub") p = "parse";
    if (p === "status") p = "port";
    if (!IMP_TABS.some((x) => x.id === p)) p = "parse";
    return p;
  }

  function navBlocksHtml(active) {
    const block = blockOfPane(active);
    return IMP_BLOCKS.map((b) => {
      const on = b.id === block ? " is-on" : "";
      const first = tabsForBlock(b.id).find((x) => !x.go) || tabsForBlock(b.id)[0];
      const target = first ? first.id : "parse";
      return `<button type="button" class="imp-nav-link imp-nav-block${on}" data-imp-pane="${esc(target)}">${esc(b.lab)}</button>`;
    }).join("");
  }

  function navSubsHtml(active) {
    const block = blockOfPane(active);
    return tabsForBlock(block)
      .map((x) => {
        const on = x.id === active ? " is-on" : "";
        return `<button type="button" class="imp-nav-link imp-nav-sub${on}" data-imp-pane="${esc(x.id)}">${esc(x.lab)}</button>`;
      })
      .join("");
  }

  function navButtonsHtml(active) {
    return `<div class="imp-nav-blocks">${navBlocksHtml(active)}</div><div class="imp-nav-subs">${navSubsHtml(active)}</div>`;
  }

  function ensureShell(box) {
    if (box.querySelector(".imp-shell")) return;
    box.innerHTML = `
      <div class="imp-shell">
        <header class="imp-topbar" aria-label="進口主模組">
          <button type="button" class="imp-top-home" data-go-app-home>← 總覽</button>
          <nav class="imp-top-blocks">${navBlocksHtml("parse")}</nav>
        </header>
        <div class="imp-shell-body">
          <aside class="imp-side" aria-label="進口子選單">
            <div class="imp-side-lab" data-imp-side-lab>港口辦理</div>
            <nav class="imp-side-nav">${navSubsHtml("parse")}</nav>
          </aside>
          <section class="imp-main">
            <div class="imp-mobile-nav" aria-label="進口分頁"></div>
            <header class="imp-main-head">
              <h1 class="imp-main-title"></h1>
              <div class="imp-main-actions"></div>
            </header>
            <div id="imp-main-body"></div>
          </section>
        </div>
      </div>
      <div id="imp-drawer-host"></div>`;
  }

  function syncShellChrome(pane) {
    const active = activeTabId(pane);
    const block = blockOfPane(active);
    const box = document.getElementById("import-root");
    if (!box) return;
    const topBlocks = box.querySelector(".imp-top-blocks");
    if (topBlocks) topBlocks.innerHTML = navBlocksHtml(active);
    const sideLab = box.querySelector("[data-imp-side-lab]");
    if (sideLab) {
      const b = IMP_BLOCKS.find((x) => x.id === block);
      sideLab.textContent = (b && b.lab) || "";
    }
    const sideNav = box.querySelector(".imp-side-nav");
    if (sideNav) sideNav.innerHTML = navSubsHtml(active);
    const mobileNav = box.querySelector(".imp-mobile-nav");
    if (mobileNav) {
      mobileNav.innerHTML = `
        <div class="imp-mob-row">
          <button type="button" class="imp-mob-home" data-go-app-home>總覽</button>
          <div class="imp-nav-blocks">${navBlocksHtml(active)}</div>
        </div>
        <div class="imp-mob-row">
          <div class="imp-nav-subs">${navSubsHtml(active)}</div>
        </div>`;
    }
    const titleEl = box.querySelector(".imp-main-title");
    if (titleEl) titleEl.textContent = PANE_TITLE[pane] || "進口";
    const actions = box.querySelector(".imp-main-actions");
    if (actions) {
      if (pane === "sum") {
        actions.innerHTML = `<button type="button" class="primary imp-mini-btn" data-imp-export>匯出</button>`;
      } else {
        actions.innerHTML = "";
      }
    }
  }

  function stampRow(row) {
    if (!row || typeof row !== "object") return row;
    row.updatedAt = Date.now();
    try {
      if (typeof currentStaff === "function") row.updatedBy = String(currentStaff() || "").trim();
    } catch (_) {}
    return row;
  }

  function rowUpdatedAt(row) {
    return Number(row && row.updatedAt) || 0;
  }

  function loadDrawerFields(kind, key) {
    ensureState();
    if (kind === "draft") {
      const i = findDraftIndex(key);
      const d = i >= 0 ? state.importParseDrafts[i] : null;
      if (!d) return null;
      return {
        id: d.id || "",
        uha: d.uha || "",
        containerNo: d.containerNo || "",
        customsNo: d.customsNo || "",
        arriveDay: d.arriveDay || "",
        product: d.product || "",
        broker: d.broker || "",
        seller: d.seller || "",
        shipCo: d.shipCo || "",
        trailer: d.trailer || "",
        trailerPhone: d.trailerPhone || "",
        trailerContact: d.trailerContact || "",
        unpackSite: d.unpackSite || "",
        unpackAt: d.unpackAt || "",
        assignQty: d.assignQty ?? "",
        note: d.note || "",
        dock: d.dock || "",
        checkKind: d.checkKind || "",
        inspect: d.inspect || "none",
        fumigate: d.fumigate || "none",
        raw: d.raw || "",
        photoName: d.photoName || "",
        photoData: d.photoData || "",
        missing: Array.isArray(d.missing) ? d.missing.slice() : [],
        _index: i,
        updatedAt: rowUpdatedAt(d),
      };
    }
    if (kind === "port") {
      const cab = (state.importCabinets || []).find((c) => c.uha === key);
      if (!cab) return null;
      const track = ensureTrackFromCabinet(cab);
      ensureClearanceShape(track);
      return {
        uha: key,
        product: cab.product || "",
        containerNo: cab.containerNo || "",
        arriveDay: cab.arriveDay || "",
        inspect: track.inspect || "none",
        inspectAt: track.inspectAt || "",
        fumigate: track.fumigate || "none",
        fumigateAt: track.fumigateAt || "",
        dock: track.dock || "",
        missingTelex: !!track.missingTelex,
        missingData: !!track.missingData,
        trailer: track.trailer || "",
        note: track.note || "",
        updatedAt: Math.max(rowUpdatedAt(cab), rowUpdatedAt(track)),
      };
    }
    if (kind === "release") {
      const row = findReleased(key);
      if (!row) return null;
      ensureClearanceShape(row);
      const cab = (state.importCabinets || []).find((c) => c.uha === key);
      return {
        uha: key,
        product: row.product || (cab && cab.product) || "",
        containerNo: row.containerNo || (cab && cab.containerNo) || "",
        arriveDay: (cab && cab.arriveDay) || row.arriveDay || "",
        inspect: row.inspect || "none",
        inspectAt: row.inspectAt || "",
        fumigate: row.fumigate || "none",
        fumigateAt: row.fumigateAt || "",
        dock: row.dock || "",
        trailer: row.trailer || "",
        note: row.note || "",
        ftConfirmed: !!(row.ftConfirmed || row.ft),
        ftAt: row.ftAt || "",
        pickupReady: !!row.pickupReady,
        unpackAt: row.unpackAt || "",
        unpackSite: row.unpackSite || "",
        trailerPhone: row.trailerPhone || "",
        trailerConfirmed: !!row.trailerConfirmed,
        trailerNote: row.trailerNote || "",
        assignee: row.assignee || "",
        assignQty: row.assignQty ?? "",
        destType: row.destType || "coldstore",
        dispatched: !!row.dispatched,
        notifyTrailer: !!row.notifyTrailer,
        notifyUnpacker: !!row.notifyUnpacker,
        notifyCustomer: !!row.notifyCustomer,
        halfSplit: !!row.halfSplit,
        assignee2: row.assignee2 || "",
        assignQty2: row.assignQty2 ?? "",
        unpackSite2: row.unpackSite2 || "",
        updatedAt: rowUpdatedAt(row),
      };
    }
    if (kind === "sum") {
      ensureState();
      if (!Array.isArray(state.unpackJobs)) state.unpackJobs = [];
      const j = state.unpackJobs.find((x) => x.id === key);
      if (j) {
        return {
          id: j.id,
          uha: j.sourceUha || j.box || "",
          day: j.day || "",
          containerNo: (j.codes && j.codes[0]) || "",
          product: j.name || "",
          customsQty: "",
          unpackQty: j.unpackQty != null ? j.unpackQty : "",
          unload: j.unloadPoint || j.location || "",
          seller: "",
          customsNo: "",
          note: j.note || "",
          destType: j.destType || "coldstore",
          location: j.location || "",
          assignee: j.assignee || "",
          assignQty: j.assignQty != null ? j.assignQty : "",
          status: j.status || "pending",
          updatedAt: Number(j.reportedAt) || Number(j.updatedAt) || 0,
        };
      }
      const a = (state.importArrivals || []).find((x) => x.uha === key);
      if (!a) return null;
      return {
        uha: key,
        day: a.day || "",
        containerNo: a.containerNo || "",
        product: a.product || "",
        customsQty: a.customsQty ?? "",
        unpackQty: a.unpackQty ?? "",
        unload: a.unload || "",
        seller: a.seller || "",
        customsNo: a.customsNo || "",
        note: a.note || "",
        destType: a.destType || "coldstore",
        updatedAt: rowUpdatedAt(a),
      };
    }
    if (kind === "stock") {
      const a = (state.importArrivals || []).find((x) => x.uha === key);
      if (!a) return null;
      return {
        uha: key,
        day: a.day || "",
        containerNo: a.containerNo || "",
        product: a.product || "",
        customsQty: a.customsQty ?? "",
        unpackQty: a.unpackQty ?? "",
        unload: a.unload || "",
        seller: a.seller || "",
        customsNo: a.customsNo || "",
        note: a.note || "",
        destType: a.destType || "coldstore",
        updatedAt: rowUpdatedAt(a),
      };
    }
    if (kind === "upBoard" || kind === "unpack") {
      ensureState();
      if (!Array.isArray(state.unpackJobs)) state.unpackJobs = [];
      const j = state.unpackJobs.find((x) => x.id === key);
      if (!j) return null;
      return {
        id: j.id,
        uha: j.sourceUha || j.box || "",
        day: j.day || "",
        box: j.box || "",
        name: j.name || "",
        containerNo: (j.codes && j.codes[0]) || "",
        halfPart: j.halfPart || "1",
        assignee: j.assignee || "",
        assignQty: j.assignQty != null ? j.assignQty : "",
        unpackQty: j.unpackQty != null ? j.unpackQty : "",
        qty: j.qty != null ? j.qty : "",
        reportBox: j.reportBox || j.box || "",
        location: j.location || "",
        unloadPoint: j.unloadPoint || "",
        trailer: j.trailer || "",
        trailerPhone: j.trailerPhone || "",
        trailerConfirmed: !!j.trailerConfirmed,
        trailerNote: j.trailerNote || "",
        unpackAt: j.unpackAt || "",
        destType: j.destType || "coldstore",
        customerName: j.customerName || "",
        stockIn: j.stockIn !== false,
        note: j.note || "",
        status: j.status || "pending",
        notifyTrailer: !!j.notifyTrailer,
        notifyUnpacker: !!j.notifyUnpacker,
        notifyCustomer: !!j.notifyCustomer,
        updatedAt: Number(j.reportedAt) || Number(j.updatedAt) || 0,
        canReport: j.status === "pending",
        readOnlyReport: j.status !== "pending",
      };
    }
    return { uha: key, updatedAt: 0 };
  }

  function remoteUpdatedAt(kind, key) {
    const live = loadDrawerFields(kind, key);
    return live ? Number(live.updatedAt) || 0 : 0;
  }

  function openDrawer(kind, key) {
    const k = String(key);
    const fields = loadDrawerFields(kind, k);
    if (!fields && kind !== "stock" && kind !== "sum") {
      if (typeof setStatus === "function") setStatus("找不到資料。", true);
      return;
    }
    drawer = { kind, key: k };
    drawerFull = false;
    drawerSession = {
      kind,
      key: k,
      fields: fields ? { ...fields } : null,
      baseUpdatedAt: fields ? Number(fields.updatedAt) || 0 : 0,
      dirty: false,
      remoteNewer: false,
    };
    renderDrawer();
  }

  function closeDrawer(opts) {
    const force = opts && opts.force;
    if (drawerSession && drawerSession.dirty && !force) {
      const ok = typeof confirm === "function" ? confirm("尚有未儲存的修改，確定關閉？") : true;
      if (!ok) return false;
    }
    drawer = null;
    drawerFull = false;
    drawerSession = null;
    renderDrawer();
    return true;
  }

  function setDraftField(field, value) {
    if (!drawerSession || !drawerSession.fields) return;
    drawerSession.fields[field] = value;
    drawerSession.dirty = true;
  }

  function commitDrawerSession(sessionOverride) {
    const sess = sessionOverride || drawerSession;
    if (!sess || !sess.fields) return false;
    ensureState();
    const { kind, key, fields } = sess;
    if (kind === "draft") {
      const i = findDraftIndex(key);
      const d = i >= 0 ? state.importParseDrafts[i] : null;
      if (!d) return false;
      Object.assign(d, {
        uha: fields.uha,
        containerNo: fields.containerNo,
        customsNo: fields.customsNo,
        arriveDay: fields.arriveDay,
        product: fields.product,
        broker: fields.broker,
        seller: fields.seller,
        shipCo: fields.shipCo,
        trailer: fields.trailer,
        trailerPhone: fields.trailerPhone,
        trailerContact: fields.trailerContact,
        unpackSite: fields.unpackSite,
        unpackAt: fields.unpackAt,
        assignQty: fields.assignQty,
        note: fields.note,
        dock: fields.dock,
        checkKind: fields.checkKind,
        inspect: fields.inspect || "none",
        fumigate: fields.fumigate || "none",
      });
      stampRow(d);
    } else if (kind === "port" || kind === "release") {
      const cab = (state.importCabinets || []).find((c) => c.uha === key);
      const track = cab ? ensureTrackFromCabinet(cab) : findReleased(key);
      if (!track) return false;
      ensureClearanceShape(track);
      track.inspect = fields.inspect || "none";
      track.inspectAt = fields.inspectAt || "";
      track.fumigate = fields.fumigate || "none";
      track.fumigateAt = fields.fumigateAt || "";
      track.dock = String(fields.dock || "").trim();
      track.missingTelex = !!fields.missingTelex;
      track.missingData = !!fields.missingData;
      track.trailer = String(fields.trailer || "").trim();
      track.note = String(fields.note || "").trim();
      if (kind === "release") {
        track.ftConfirmed = !!fields.ftConfirmed;
        if (track.ftConfirmed) track.ft = true;
        track.pickupReady = !!fields.pickupReady;
        track.unpackAt = String(fields.unpackAt || "").trim();
        track.unpackSite = String(fields.unpackSite || "").trim();
        track.trailerPhone = String(fields.trailerPhone || "").trim();
        track.trailerConfirmed = !!fields.trailerConfirmed;
        track.trailerNote = String(fields.trailerNote || "").trim();
        track.assignee = String(fields.assignee || "").trim();
        track.assignQty = fields.assignQty === "" || fields.assignQty == null ? "" : Number(fields.assignQty);
        if (!Number.isFinite(track.assignQty)) track.assignQty = fields.assignQty || "";
        track.destType = fields.destType === "customer" ? "customer" : "coldstore";
        track.notifyTrailer = !!fields.notifyTrailer;
        track.notifyUnpacker = !!fields.notifyUnpacker;
        track.notifyCustomer = !!fields.notifyCustomer;
        track.halfSplit = !!fields.halfSplit;
        track.assignee2 = String(fields.assignee2 || "").trim();
        track.assignQty2 = fields.assignQty2 === "" || fields.assignQty2 == null ? "" : Number(fields.assignQty2);
        if (!Number.isFinite(track.assignQty2)) track.assignQty2 = fields.assignQty2 || "";
        track.unpackSite2 = String(fields.unpackSite2 || "").trim();
        if (fields.dispatchNow || (track.pickupReady && track.unpackAt)) {
          dispatchToUnpackBoard(track);
        }
      }
      if (fields.inspect !== undefined) track.inspectManual = true;
      if (fields.fumigate !== undefined) track.fumigateManual = true;
      stampRow(track);
    } else if (kind === "sum") {
      ensureState();
      if (!Array.isArray(state.unpackJobs)) state.unpackJobs = [];
      const j = state.unpackJobs.find((x) => x.id === key);
      if (j) {
        j.day = String(fields.day || j.day || "").trim();
        const uq = Number(fields.unpackQty);
        j.unpackQty = Number.isFinite(uq) ? uq : fields.unpackQty === "" ? null : j.unpackQty;
        j.location = String(fields.location || fields.unload || "").trim();
        j.unloadPoint = String(fields.unload || fields.location || "").trim();
        j.destType = fields.destType === "customer" ? "customer" : "coldstore";
        j.note = String(fields.note || "").trim();
        j.name = String(fields.product || j.name || "").trim();
        j.updatedAt = Date.now();
      } else {
        const a = (state.importArrivals || []).find((x) => x.uha === key);
        if (!a) return false;
        a.day = String(fields.day || "").trim();
        a.containerNo = String(fields.containerNo || "").trim();
        a.product = String(fields.product || "").trim();
        const cq = Number(fields.customsQty);
        a.customsQty = Number.isFinite(cq) ? cq : fields.customsQty === "" ? "" : a.customsQty;
        const uq = Number(fields.unpackQty);
        a.unpackQty = Number.isFinite(uq) ? uq : fields.unpackQty === "" ? "" : a.unpackQty;
        a.unload = String(fields.unload || "").trim();
        a.seller = String(fields.seller || "").trim();
        a.customsNo = String(fields.customsNo || "").trim();
        a.note = String(fields.note || "").trim();
        a.destType = fields.destType === "customer" ? "customer" : "coldstore";
        stampRow(a);
      }
    } else if (kind === "stock") {
      const a = (state.importArrivals || []).find((x) => x.uha === key);
      if (!a) return false;
      a.day = String(fields.day || "").trim();
      a.containerNo = String(fields.containerNo || "").trim();
      a.product = String(fields.product || "").trim();
      const cq = Number(fields.customsQty);
      a.customsQty = Number.isFinite(cq) ? cq : fields.customsQty === "" ? "" : a.customsQty;
      const uq = Number(fields.unpackQty);
      a.unpackQty = Number.isFinite(uq) ? uq : fields.unpackQty === "" ? "" : a.unpackQty;
      a.unload = String(fields.unload || "").trim();
      a.seller = String(fields.seller || "").trim();
      a.customsNo = String(fields.customsNo || "").trim();
      a.note = String(fields.note || "").trim();
      a.destType = fields.destType === "customer" ? "customer" : "coldstore";
      stampRow(a);
    } else if (kind === "upBoard" || kind === "unpack") {
      ensureState();
      if (!Array.isArray(state.unpackJobs)) state.unpackJobs = [];
      const j = state.unpackJobs.find((x) => x.id === key);
      if (!j) return false;
      if (kind === "upBoard" || j.status === "pending") {
        const newUha = normUha(fields.uha || fields.box || "");
        if (newUha) {
          j.sourceUha = newUha;
          j.box = newUha;
        }
        if (fields.day) j.day = String(fields.day || "").slice(0, 10);
        j.assignee = String(fields.assignee || "").trim();
        const aq = Number(fields.assignQty);
        j.assignQty = Number.isFinite(aq) ? aq : fields.assignQty === "" ? null : j.assignQty;
        j.location = String(fields.location || "").trim();
        j.unloadPoint = String(fields.unloadPoint || fields.location || "").trim();
        j.trailer = String(fields.trailer || "").trim();
        j.trailerPhone = String(fields.trailerPhone || "").trim();
        j.trailerConfirmed = !!fields.trailerConfirmed;
        j.trailerNote = String(fields.trailerNote || "").trim();
        j.unpackAt = String(fields.unpackAt || "").trim();
        if (j.unpackAt) j.day = unpackDayFromAt(j.unpackAt) || j.day;
        j.destType = fields.destType === "customer" ? "customer" : "coldstore";
        j.notifyTrailer = !!fields.notifyTrailer;
        j.notifyUnpacker = !!fields.notifyUnpacker;
        j.notifyCustomer = !!fields.notifyCustomer;
        j.note = String(fields.note || "").trim();
        // sync back to released
        const rel = findReleased(j.sourceUha || j.box);
        if (rel && j.halfPart !== "2") {
          ensureClearanceShape(rel);
          rel.trailer = j.trailer;
          rel.trailerPhone = j.trailerPhone;
          rel.trailerConfirmed = j.trailerConfirmed;
          rel.trailerNote = j.trailerNote;
          rel.unpackAt = j.unpackAt;
          rel.unpackSite = j.location;
          rel.assignee = j.assignee;
          rel.assignQty = j.assignQty;
          rel.destType = j.destType;
          stampRow(rel);
        }
      }
      if (kind === "unpack" && fields.submitReport && j.status === "pending") {
        const ok =
          typeof window.__unpackApi?.submitReport === "function"
            ? window.__unpackApi.submitReport(j.id, fields)
            : false;
        if (!ok) return false;
      } else if (kind === "unpack" && j.status === "pending" && !fields.submitReport) {
        const uq = Number(fields.unpackQty);
        if (Number.isFinite(uq)) j.unpackQty = uq;
        const q = Number(fields.qty);
        if (Number.isFinite(q)) j.qty = q;
        j.reportBox = String(fields.reportBox || j.box || "").trim();
        j.stockIn = fields.stockIn !== false;
        j.customerName = String(fields.customerName || "").trim();
        j.note = String(fields.note || "").trim();
      }
      j.updatedAt = Date.now();
    } else {
      return false;
    }
    if (typeof save === "function") save();
    if (!sessionOverride) {
      drawerSession.dirty = false;
      drawerSession.baseUpdatedAt = Date.now();
      drawerSession.remoteNewer = false;
      drawerSession.fields = loadDrawerFields(kind, key);
      if (typeof setStatus === "function") setStatus("已儲存。");
      renderMainBody();
      renderDrawer();
    } else if (typeof setStatus === "function") {
      setStatus("已儲存。");
    }
    return true;
  }

  function refreshMainAndDrawer() {
    renderMainBody();
    // 有草稿時只重繪抽屜（用本機 draft），勿用遠端蓋輸入框
    renderDrawer();
  }

  /** 背景 Pull／applyBundle 後呼叫：更新列表，但保留 Drawer 輸入中草稿 */
  function onImportRemoteApplied() {
    try {
      window.dispatchEvent(new CustomEvent("import-remote-applied"));
    } catch (_) {}
    if (typeof page !== "undefined" && page !== "import") return;
    const box = document.getElementById("import-root");
    if (!box) return;
    if (typeof window.mountImportApp === "function" && box.querySelector(".imp-tw")) {
      // React 版自行 listen；此處不重掛以免蓋掉草稿
      return;
    }
    if (!box.querySelector(".imp-shell")) return;
    renderMainBody();
    if (!drawer || !drawerSession) return;
    if (!drawerSession.fields) {
      renderDrawer();
      return;
    }
    const remoteAt = remoteUpdatedAt(drawerSession.kind, drawerSession.key);
    if (remoteAt > drawerSession.baseUpdatedAt) {
      if (drawerSession.dirty) {
        drawerSession.remoteNewer = true;
      } else {
        const fields = loadDrawerFields(drawerSession.kind, drawerSession.key);
        if (fields) {
          drawerSession.fields = { ...fields };
          drawerSession.baseUpdatedAt = Number(fields.updatedAt) || remoteAt;
          drawerSession.remoteNewer = false;
        }
      }
    }
    renderDrawer();
  }

  function discardRemoteAndKeepDraft() {
    if (!drawerSession) return;
    drawerSession.remoteNewer = false;
    renderDrawer();
  }

  function reloadDrawerFromRemote() {
    if (!drawerSession) return;
    if (drawerSession.dirty) {
      const ok = typeof confirm === "function" ? confirm("將捨棄你正在輸入的內容，改載入最新資料？") : true;
      if (!ok) return;
    }
    const fields = loadDrawerFields(drawerSession.kind, drawerSession.key);
    if (!fields) return;
    drawerSession.fields = { ...fields };
    drawerSession.baseUpdatedAt = Number(fields.updatedAt) || 0;
    drawerSession.dirty = false;
    drawerSession.remoteNewer = false;
    renderDrawer();
  }

  function renderBuy(body) {
    body.innerHTML = `<p class="imp-one-hint">採購單建置中。</p>`;
  }

  function renderParse(body) {
    ensureState();
    const drafts = state.importParseDrafts || [];
    const rows = drafts.map((d, i) => ({
      cells: [d.uha || "—", d.containerNo || "—", d.customsNo || "—", d.arriveDay || "—", d.product || "—", d.broker || "—"],
      attrs: `data-imp-open="draft" data-imp-key="${i}" class="imp-row-click"`,
    }));
    body.innerHTML = `
      <section class="imp-parse">
        <label class="imp-parse-lab">文件文字
          <textarea id="imp-parse-text" rows="5" placeholder="例：UHA720&#10;櫃號 YMLU1234567&#10;報關單 AB123456789&#10;品名 韓白&#10;到港日 2026-01-15"></textarea>
        </label>
        <div class="imp-parse-actions">
          <button type="button" class="primary" data-imp-parse-run>解析文字</button>
          <label class="imp-file-btn">截圖／拍照<input type="file" accept="image/*,.png,.jpg,.jpeg,.webp" data-imp-parse-img /></label>
        </div>
        <p class="imp-one-hint">待確認草稿（點列開啟編輯）</p>
        ${tableHtml(["編號 UHA", "櫃號", "報關單號", "到港日", "品名", "報關行"], rows)}
      </section>`;
  }

  function renderHub(body) {
    renderParse(body);
  }

  function renderAcctStub(body, pane) {
    const hints = {
      broker: "報關行往來與費用對帳建置中。",
      vendor: "進口廠商資料與對帳建置中。",
      trailer: "拖車費用與調度對帳建置中。",
      labor: "拆櫃工資與工班對帳建置中。",
    };
    body.innerHTML = `<p class="imp-one-hint">${esc(hints[pane] || "建置中。")}</p>`;
  }

  /**
   * 從報關／進口／LINE 訊息抽出欄位（單筆）。
   * 常態句型 ↔ 資料庫欄位對照見 .cursor/rules/import-line-parse.mdc
   * （船期報關／分票儀檢藥檢／下貨拖車／薰蒸／到達時間；一櫃一筆、確認對櫃號合併）
   */
  function parseOneImportChunk(raw) {
    // 全形英數→半形，方便貼 LINE 訊息
    const text = String(raw || "")
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) => {
        const c = ch.charCodeAt(0);
        if (c >= 0xff21 && c <= 0xff3a) return String.fromCharCode(c - 0xfee0);
        if (c >= 0xff41 && c <= 0xff5a) return String.fromCharCode(c - 0xfee0);
        if (c >= 0xff10 && c <= 0xff19) return String.fromCharCode(c - 0xfee0);
        return ch;
      })
      .replace(/\u00a0/g, " ")
      .trim();
    if (!text) return null;
    const lines = text
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const refs = parseRefNos(text);
    let uha = refs.uha || refs.nc || "";
    if (!uha) {
      const loose = text.match(/\b((?:UHA|NC)\s*\d{1,6})\b/i);
      if (loose) uha = normUha(loose[1]);
    }

    // 櫃號＋後綴狀態：OTPU6504885-海關查驗／YMLU5461502-儀檢／MNBU4532556-藥檢
    // 一櫃一品名，或同組多櫃共用品名；「此票儀檢」套用整組
    const containerMeta = [];
    const cleanContToken = (s) =>
      String(s || "")
        .replace(/["'「」\s]/g, "")
        .replace(/[-–—].*$/, "")
        .toUpperCase();
    const taggedRe = /\b([A-Z]{4}\s*\d{6,7})\s*[-–—:：]?\s*(海關查驗|儀檢|藥檢|薰蒸|免驗|免辦)?/gi;
    let tm;
    while ((tm = taggedRe.exec(text)) !== null) {
      const c = normContainer(tm[1]);
      if (!c) continue;
      const tag = String(tm[2] || "").trim();
      const prev = containerMeta.find((x) => x.containerNo === c);
      if (prev) {
        if (tag && !prev.checkKind) prev.checkKind = tag;
      } else {
        containerMeta.push({ containerNo: c, checkKind: tag, product: "" });
      }
    }
    const contRe = /\b([A-Z]{4}\s*\d{6,7})\b/gi;
    let cm;
    while ((cm = contRe.exec(text)) !== null) {
      const c = normContainer(cm[1]);
      if (c && !containerMeta.some((x) => x.containerNo === c)) {
        containerMeta.push({ containerNo: c, checkKind: "", product: "" });
      }
    }

    // 以 --- 分隔票組；組內共用品名／此票儀檢
    const groups = [];
    let curGroup = [];
    for (const line of lines) {
      if (/^-{3,}\s*$/.test(line) || /^[─－—]{3,}\s*$/.test(line)) {
        if (curGroup.length) groups.push(curGroup);
        curGroup = [];
        continue;
      }
      curGroup.push(line);
    }
    if (curGroup.length) groups.push(curGroup);

    for (const gLines of groups) {
      const gContainers = [];
      let gProduct = "";
      let gKind = "";
      for (const line of gLines) {
        if (/此票\s*(海關查驗|儀檢|藥檢)/.test(line)) {
          gKind = line.match(/此票\s*(海關查驗|儀檢|藥檢)/)[1];
        }
        if (/本票\s*(海關查驗|儀檢|藥檢)/.test(line)) {
          gKind = line.match(/本票\s*(海關查驗|儀檢|藥檢)/)[1];
        }
        const zh = line.replace(/[^\u4e00-\u9fff]/g, "");
        if (/^下貨|^拖櫃|拖車名|已報關|船期|靠\d|碼頭|^下[\u4e00-\u9fff]|^[\u4e00-\u9fff]{1,8}拖|\d{1,2}\s*[\/.\-]\s*\d{1,2}.+到|薰蒸|燻好到|薰好到/.test(line.trim())) {
          // header / status — not product
        } else if (/[A-Z]{4}\s*\d{6,7}/i.test(line)) {
          const lead = line.match(/^([\u4e00-\u9fff（）()]{1,20})/);
          if (lead) {
            const p = lead[1].replace(/[（）()]/g, "").trim().slice(0, 40);
            if (p) gProduct = p;
          }
        } else if (zh.length >= 2 && /[\u4e00-\u9fff]/.test(line) && !/此票|本票|儀檢|海關|藥檢|沒有藥檢/.test(line)) {
          if (/^[\u4e00-\u9fffA-Za-z0-9]{1,10}\s*[-–—]\s*[\u4e00-\u9fffA-Za-z0-9]{1,12}$/.test(line)) {
            // 旭興-二崙 → 拖車／下貨，不當品名
          } else {
            gProduct = line.trim().replace(/\s{2,}/g, " ").slice(0, 80);
          }
        }
        // 同行可能多櫃或帶引號
        const lineRe = /\b([A-Z]{4}\s*\d{6,7})\b/gi;
        let lm;
        while ((lm = lineRe.exec(line)) !== null) {
          const c = normContainer(lm[1]);
          if (c) gContainers.push(c);
        }
      }
      for (const c of gContainers) {
        const hit = containerMeta.find((x) => x.containerNo === c);
        if (!hit) continue;
        if (gProduct && !hit.product) hit.product = gProduct;
        if (gKind && !hit.checkKind) hit.checkKind = gKind;
      }
    }

    // 仍無品名：櫃號後往下找中文行（略過同組其他櫃號）
    for (let li = 0; li < lines.length; li++) {
      const compact = cleanContToken(lines[li]);
      const hit = containerMeta.find((x) => x.containerNo === compact || compact.startsWith(x.containerNo));
      if (!hit || hit.product) continue;
      for (let j = li + 1; j < lines.length; j++) {
        const next = lines[j];
        if (/^-{3,}/.test(next)) break;
        const nextCompact = cleanContToken(next);
        if (containerMeta.some((x) => nextCompact === x.containerNo || nextCompact.startsWith(x.containerNo))) {
          continue; // 同組下一櫃，繼續找共用品名
        }
        if (/^(?:UHA|NC)\d/i.test(nextCompact)) break;
        if (/F\s*\/?\s*T|船期|靠\d|碼頭|已報|沒有|此票|本票|儀檢|海關|下貨|領櫃/i.test(next)) continue;
        if (/^[\u4e00-\u9fffA-Za-z0-9]{1,10}\s*[-–—]\s*[\u4e00-\u9fffA-Za-z0-9]{1,12}$/.test(next.trim())) continue;
        if (/^[A-Z0-9][A-Z0-9\s\-]{2,}$/i.test(next) && !/[\u4e00-\u9fff]/.test(next)) continue;
        const zh = next.replace(/[^\u4e00-\u9fff]/g, "");
        if (zh.length >= 2) {
          hit.product = next.trim().replace(/\s{2,}/g, " ").slice(0, 80);
          break;
        }
      }
    }

    // 同組內後櫃已有品名時，往前補空品名櫃
    for (const gLines of groups) {
      const gCs = [];
      for (const line of gLines) {
        const lineRe = /\b([A-Z]{4}\s*\d{6,7})\b/gi;
        let lm;
        while ((lm = lineRe.exec(line)) !== null) {
          const c = normContainer(lm[1]);
          if (c) gCs.push(c);
        }
      }
      const products = gCs.map((c) => (containerMeta.find((x) => x.containerNo === c) || {}).product).filter(Boolean);
      const shared = products[0] || "";
      if (!shared) continue;
      for (const c of gCs) {
        const hit = containerMeta.find((x) => x.containerNo === c);
        if (hit && !hit.product) hit.product = shared;
      }
    }

    const containers = containerMeta.map((x) => x.containerNo);
    const containerNo = containers[0] || "";
    const checkKind = (containerMeta[0] && containerMeta[0].checkKind) || "";
    let perContainerProducts = [...new Set(containerMeta.map((x) => x.product).filter(Boolean))];

    let customsNo = "";
    const custM =
      text.match(/(?:報關單(?:號碼|號)?|報單)\s*[:：]?\s*([A-Z0-9][\w\-]{5,})/i) ||
      text.match(/\b([A-Z]{2,3}\d{9,})\b/);
    if (custM) {
      const cand = String(custM[1]).trim().toUpperCase();
      if (!isContainerNo(cand)) customsNo = cand;
    }

    let arriveDay = "";
    let voyageNote = "";
    // 船期09/19PM1430、船期 9/19
    const voyage = text.match(
      /船期\s*[:：]?\s*(\d{1,2})\s*[\/.\-月]\s*(\d{1,2})\s*(?:(PM|AM|下午|上午))?\s*(\d{1,2}):?(\d{2})?/i,
    );
    if (voyage) {
      const mo = Number(voyage[1]);
      const da = Number(voyage[2]);
      if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
        const now = new Date();
        let y = now.getFullYear();
        const cand = new Date(y, mo - 1, da);
        if (cand.getTime() < now.getTime() - 45 * 86400000) y += 1;
        arriveDay = `${y}-${pad2(mo)}-${pad2(da)}`;
        if (voyage[4] != null && voyage[5] != null) {
          let hh = Number(voyage[4]);
          const mm = voyage[5];
          const ap = String(voyage[3] || "").toUpperCase();
          if ((ap === "PM" || ap === "下午") && hh < 12) hh += 12;
          if ((ap === "AM" || ap === "上午") && hh === 12) hh = 0;
          voyageNote = `船期 ${pad2(hh)}:${mm}`;
        }
      }
    }
    const dayM =
      text.match(/(?:到港日|抵達|到港|ETB|ETA)\s*[:：]?\s*([0-9./\-]+)/i) ||
      text.match(/\b(20\d{2}[./\-]\d{1,2}[./\-]\d{1,2})\b/) ||
      text.match(/\b(1[01]\d{5})\b/);
    if (!arriveDay && dayM) arriveDay = parseDay(dayM[1]);
    if (!arriveDay) {
      const ft = text.match(/F\s*\/?\s*T\s*[:：]?\s*(\d{1,2})\s*[\/.\-月]\s*(\d{1,2})/i);
      if (ft) {
        const mo = Number(ft[1]);
        const da = Number(ft[2]);
        if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
          const now = new Date();
          let y = now.getFullYear();
          const cand = new Date(y, mo - 1, da);
          if (cand.getTime() < now.getTime() - 45 * 86400000) y += 1;
          arriveDay = `${y}-${pad2(mo)}-${pad2(da)}`;
        }
      }
    }
    // 9/18(五)第一班薰蒸 → 日期（星期可有可無）
    if (!arriveDay) {
      const wd = text.match(
        /(\d{1,2})\s*[\/.\-月]\s*(\d{1,2})\s*[（(]?[一二三四五六日週周天]?[）)]?(?:\s*(?:第一班|第二班|第三班))?(?:\s*薰蒸)?/,
      );
      if (wd && /薰蒸|燻|到|下貨|碼頭|船期|F\s*\/?\s*T/i.test(text)) {
        const mo = Number(wd[1]);
        const da = Number(wd[2]);
        if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
          const now = new Date();
          let y = now.getFullYear();
          const cand = new Date(y, mo - 1, da);
          if (cand.getTime() < now.getTime() - 45 * 86400000) y += 1;
          arriveDay = `${y}-${pad2(mo)}-${pad2(da)}`;
        }
      }
    }

    let dock = "";
    const dockM = text.match(/靠\s*(\d{1,3})\s*碼頭/) || text.match(/碼頭\s*[:：]?\s*(\d{1,3}|[^\s，,]+)/);
    if (dockM) dock = String(dockM[1]).trim();

    let product = "";
    const prodM = text.match(/(?:品名|貨名|品項|貨物)\s*[:：]?\s*([^\n\r]+)/i);
    if (prodM) product = String(prodM[1]).trim().replace(/\s{2,}/g, " ").slice(0, 80);
    // 多櫃各有品名時，共用 product 取第一櫃；拆草稿時再覆寫
    if (!product && containerMeta[0] && containerMeta[0].product) {
      product = containerMeta[0].product;
    }
    if (!product) {
      for (const line of lines) {
        const compact = line.replace(/\s+/g, "");
        if (isContainerNo(compact.replace(/[-–—].*$/, "")) || /^(?:UHA|NC)\d/i.test(compact)) continue;
        if (/F\s*\/?\s*T|船期|靠\d|碼頭|已報|沒有|儀檢|海關|下貨|領櫃|拖櫃|拖車名|^下[\u4e00-\u9fff]|拖\s*[*＊]?$|\d{1,2}\s*[\/.\-]\s*\d{1,2}.+到|薰蒸|燻好到|薰好到/i.test(line)) continue;
        if (/到[\u4e00-\u9fff]/.test(line) && /\d{1,2}\s*[\/.\-]/.test(line)) continue;
        if (/^[\u4e00-\u9fffA-Za-z0-9]{1,10}\s*[-–—]\s*[\u4e00-\u9fffA-Za-z0-9]{1,12}$/.test(line.trim())) continue; // 旭興-二崙
        if (/^[\u4e00-\u9fff]{1,8}拖\s*[*＊]?$/.test(line.trim())) continue;
        if (/\d{2,4}[-\s]?\d{3,4}[-\s]?\d{3,4}/.test(line) && /0\d/.test(line)) continue; // 電話行
        if (/^[A-Z0-9][A-Z0-9\s\-]{2,}$/i.test(line) && !/[\u4e00-\u9fff]/.test(line)) continue; // 船名行
        if (/拖車|小陸/.test(line) && /名|阿|彬|電話/.test(line)) continue;
        const zh = line.replace(/[^\u4e00-\u9fff]/g, "");
        if (zh.length >= 2 && zh.length >= Math.ceil(line.length * 0.45)) {
          product = line.slice(0, 80);
          break;
        }
      }
    }

    let broker = "";
    const brokerM = text.match(/(?:報關行)\s*[:：]?\s*([^\n\r]+)/i);
    if (brokerM) broker = String(brokerM[1]).trim().replace(/\s{2,}/g, " ").slice(0, 40);

    let seller = "";
    const sellerM = text.match(/(?:賣方|出口人|Shipper|Seller)\s*[:：]?\s*([^\n\r]+)/i);
    if (sellerM) seller = String(sellerM[1]).trim().replace(/\s{2,}/g, " ").slice(0, 60);

    // 船名／航次：首行若為英文船名（非櫃號）
    let shipCo = "";
    const shipM = text.match(/(?:船公司|船名|航商|Carrier)\s*[:：]?\s*([^\n\r]+)/i);
    if (shipM) shipCo = String(shipM[1]).trim().replace(/\s{2,}/g, " ").slice(0, 40);
    if (!shipCo && lines[0]) {
      const first = lines[0];
      if (
        !isContainerNo(first.replace(/\s/g, "")) &&
        !/[\u4e00-\u9fff]/.test(first) &&
        /[A-Za-z]/.test(first) &&
        first.length >= 3 &&
        first.length <= 40
      ) {
        shipCo = first.slice(0, 40);
      }
    }

    let trailer = "";
    const trailerNameM = text.match(/拖車名\s*[=:：]\s*([^\s)）\]】,，]+)/i);
    if (trailerNameM) trailer = String(trailerNameM[1]).trim().slice(0, 40);
    if (!trailer) {
      const trailerM = text.match(/(?:報給)?拖車\s*[:：]?\s*([^\s，,。；;=）)]+)/i);
      if (trailerM && !/^名/.test(trailerM[1])) trailer = String(trailerM[1]).trim().slice(0, 40);
    }

    // 下貨／拖櫃派送：EMCU5633040(1550袋、白菜EGSU…(1260箱、拖櫃白菜到二崙
    let assignQty = "";
    const qtyM =
      text.match(/\(\s*(\d{2,6})\s*[箱袋件]/) ||
      text.match(/(?:數量|袋數|件數|箱數)\s*[:：]?\s*(\d{2,6})/) ||
      text.match(/\b(\d{3,5})\s*[箱袋件]/);
    if (qtyM) assignQty = String(Number(qtyM[1]));

    let unpackSite = "";
    const siteM =
      text.match(/下貨\s*[-–—:：]?\s*([^\n\r，,]+)/) ||
      text.match(/拖櫃[^\n\r]{0,30}到\s*([^\n\r，,]+)/) ||
      text.match(/燻好到\s*([^\n\r，,]+)/) ||
      text.match(/薰好到\s*([^\n\r，,]+)/) ||
      text.match(/(?:拆卸位置|卸貨點|卸貨|送到)\s*[:：]?\s*([^\n\r，,]+)/) ||
      text.match(/(?:^|\n)\s*下\s*([^\s\n\r，,下貨]{1,12})\s*(?:\n|$)/) ||
      text.match(/\d{1,2}\s*[\/.\-月]\s*\d{1,2}[^\n]{0,20}到\s*([^\n\r，,]+)/) ||
      text.match(/(?:^|\n)\s*到\s*([^\s\n\r，,]{1,12})\s*(?:\n|$)/);
    if (siteM) unpackSite = String(siteM[1]).trim().replace(/\s{2,}/g, " ").slice(0, 40);

    // 9/18 14:00到二崙 → 拆卸／到達時間
    let unpackAt = "";
    const etaM = text.match(
      /(\d{1,2})\s*[\/.\-月]\s*(\d{1,2})\s+(\d{1,2}):(\d{2})\s*到/,
    );
    if (etaM) {
      const mo = Number(etaM[1]);
      const da = Number(etaM[2]);
      const hh = Number(etaM[3]);
      const mm = etaM[4];
      if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
        const now = new Date();
        let y = now.getFullYear();
        const cand = new Date(y, mo - 1, da, hh, Number(mm));
        if (cand.getTime() < now.getTime() - 45 * 86400000) y += 1;
        unpackAt = `${y}-${pad2(mo)}-${pad2(da)}T${pad2(hh)}:${mm}`;
        if (!arriveDay) arriveDay = `${y}-${pad2(mo)}-${pad2(da)}`;
      }
    }

    // 旭興-二崙／阿彬-穠全：單行「拖車-下貨點」
    if (!unpackSite || !trailer) {
      const knownTrailers = new Set(
        typeof trailerNames === "function"
          ? trailerNames().map((n) => String(n || "").trim()).filter(Boolean)
          : ["旭興", "旭", "彬", "瑋", "瑋菘", "偉菘", "尚鴻", "斌"],
      );
      for (const line of lines) {
        const pair = line.match(/^([\u4e00-\u9fffA-Za-z0-9]{1,10})\s*[-–—]\s*([\u4e00-\u9fffA-Za-z0-9]{1,12})$/);
        if (!pair) continue;
        if (/[A-Z]{4}\d{6,7}/i.test(line) || /船期|碼頭|已報/.test(line)) continue;
        const left = pair[1].trim();
        const right = pair[2].trim();
        const leftIsTrailer = knownTrailers.has(left) || knownTrailers.has(left.replace(/車$/, ""));
        // 派送訊息常見：左拖車、右下貨點；或左下貨右拖車較少見
        if (leftIsTrailer || (!trailer && !unpackSite && left.length <= 4 && right.length <= 6)) {
          if (!trailer) trailer = left;
          if (!unpackSite) unpackSite = right;
          break;
        }
      }
    }

    // 偉菘拖*／旭興拖：單行拖車簡寫
    if (!trailer) {
      const knownTrailers = new Set(
        typeof trailerNames === "function"
          ? trailerNames().map((n) => String(n || "").trim()).filter(Boolean)
          : ["旭興", "旭", "彬", "瑋", "瑋菘", "偉菘", "尚鴻", "斌"],
      );
      for (const line of lines) {
        const m =
          line.match(/^([\u4e00-\u9fff]{1,8})拖\s*[*＊]?$/) ||
          line.match(/^拖車?\s*[:：]?\s*([\u4e00-\u9fff]{1,8})\s*[*＊]?$/);
        if (!m) continue;
        const name = m[1].trim();
        if (knownTrailers.has(name) || knownTrailers.has(name.replace(/車$/, "")) || name.length <= 4) {
          trailer = name;
          break;
        }
      }
    }
    // 誤把「旭興-二崙」當品名時清掉
    if (product && trailer && unpackSite) {
      const glued = `${trailer}-${unpackSite}`;
      if (product === glued || product === `${trailer}－${unpackSite}` || product === `${trailer}—${unpackSite}`) {
        product = "";
      }
    }
    if (product && /^[\u4e00-\u9fff]{1,6}\s*[-–—]\s*[\u4e00-\u9fff]{1,8}$/.test(product) && (trailer || unpackSite)) {
      product = "";
    }

    let trailerPhone = "";
    let trailerContact = "";
    const phoneM = text.match(/(?:^|[^A-Z0-9])(0\d{1,3}[-\s]?\d{3,4}[-\s]?\d{3,4})([\u4e00-\u9fff]{1,4})?/);
    if (phoneM) {
      trailerPhone = String(phoneM[1]).replace(/[-\s]/g, "");
      if (phoneM[2]) trailerContact = phoneM[2];
    }

    // 品名貼在櫃號前：白菜EGSU5051394(1260箱 + 下一行電話 → 寫入各櫃 meta
    const gluedRe =
      /([\u4e00-\u9fff]{1,12})?\s*([A-Z]{4}\s*\d{6,7})\s*(?:[-–—:：]\s*(海關查驗|儀檢|藥檢))?\s*(?:\(\s*(\d{2,6})\s*[箱袋件])?/gi;
    let gm;
    while ((gm = gluedRe.exec(text)) !== null) {
      const c = normContainer(gm[2]);
      if (!c) continue;
      let hit = containerMeta.find((x) => x.containerNo === c);
      if (!hit) {
        hit = { containerNo: c, checkKind: gm[3] || "", product: "" };
        containerMeta.push(hit);
      }
      if (gm[1]) hit.product = String(gm[1]).trim().slice(0, 40);
      if (gm[3] && !hit.checkKind) hit.checkKind = gm[3];
      if (gm[4]) hit.assignQty = String(Number(gm[4]));
      // 櫃號區塊後的電話（同段下一行）
      const after = text.slice(gm.index + gm[0].length, gm.index + gm[0].length + 80);
      const ph = after.match(/^\s*[)\n\r]*\s*(0\d{1,3}[-\s]?\d{3,4}[-\s]?\d{3,4})([\u4e00-\u9fff]{1,4})?/);
      if (ph) {
        hit.trailerPhone = String(ph[1]).replace(/[-\s]/g, "");
        if (ph[2]) hit.trailerContact = ph[2];
      }
    }
    // 同步 containers（glued 可能補進新櫃）
    for (const item of containerMeta) {
      if (!containers.includes(item.containerNo)) containers.push(item.containerNo);
    }
    perContainerProducts = [...new Set(containerMeta.map((x) => x.product).filter(Boolean))];
    // 清掉誤當品名的「拖車-下貨點」
    for (const item of containerMeta) {
      if (item.product && /^[\u4e00-\u9fff]{1,8}\s*[-–—]\s*[\u4e00-\u9fff]{1,10}$/.test(item.product)) {
        item.product = "";
      }
    }
    perContainerProducts = [...new Set(containerMeta.map((x) => x.product).filter(Boolean))];
    const withProd = containerMeta.find((x) => x.product);
    if (withProd) product = withProd.product;
    else if (product && /^[\u4e00-\u9fff]{1,8}\s*[-–—]\s*[\u4e00-\u9fff]{1,10}$/.test(product)) product = "";
    if (!product) {
      const haulProd = text.match(/拖櫃\s*([^\n\r到]{1,20}?)\s*到/);
      if (haulProd) product = String(haulProd[1]).trim().slice(0, 40);
    }
    if (!assignQty) {
      const withQty = containerMeta.find((x) => x.assignQty);
      if (withQty) assignQty = withQty.assignQty;
    }
    if (!trailerPhone) {
      const withPh = containerMeta.find((x) => x.trailerPhone);
      if (withPh) {
        trailerPhone = withPh.trailerPhone;
        if (withPh.trailerContact) trailerContact = withPh.trailerContact;
      }
    }

    // 藥檢：沒有藥檢／無藥檢／免藥檢 → skip；需要藥檢 → wait
    let inspect = "none";
    if (/沒有藥檢|無藥檢|免藥檢|不需藥檢|無須藥檢/.test(text)) inspect = "skip";
    else if (/需要藥檢|要藥檢|抽藥檢/.test(text)) inspect = "wait";
    else if (/藥檢完成|已藥檢/.test(text)) inspect = "done";

    let fumigate = "none";
    if (/沒有薰蒸|無薰蒸|免薰蒸|不需薰蒸|無須薰蒸/.test(text)) fumigate = "skip";
    else if (/需要薰蒸|要薰蒸|薰蒸中|第一班薰蒸|第二班薰蒸|第三班薰蒸|安排薰蒸|去薰蒸|燻好到|薰好到/.test(text))
      fumigate = "wait";
    else if (/薰蒸完成|已薰蒸/.test(text)) fumigate = "done";

    let fumigateNote = "";
    const fumeShift = text.match(/((?:第一|第二|第三)班薰蒸)/);
    if (fumeShift) fumigateNote = fumeShift[1];
    else if (/薰蒸/.test(text) && fumigate === "wait") fumigateNote = "薰蒸";

    const noteBits = [];
    if (/已報關/.test(text)) noteBits.push("已報關");
    if (checkKind) noteBits.push(checkKind);
    if (voyageNote) noteBits.push(voyageNote);
    if (dock) noteBits.push(`靠${dock}碼頭`);
    if (fumigateNote) noteBits.push(fumigateNote);
    if (trailerContact) noteBits.push(`拖車聯絡人 ${trailerContact}`);
    if (assignQty) noteBits.push(`${assignQty}${/[箱]/.test(text) ? "箱" : "袋"}`);
    if (unpackSite) noteBits.push(`下貨 ${unpackSite}`);
    if (unpackAt) noteBits.push(`到達 ${unpackAt.replace("T", " ")}`);
    if (trailer) noteBits.push(`拖車 ${trailer}`);
    for (const line of lines) {
      const compact = line.replace(/\s+/g, "").toUpperCase();
      if (containers.some((c) => compact.includes(c))) continue;
      if (product && line === product) continue;
      if (perContainerProducts.includes(line.trim()) || perContainerProducts.includes(line)) continue;
      if (shipCo && line === shipCo) continue;
      if (/^(?:UHA|NC)\d/i.test(compact)) continue;
      if (/船期|靠\d|碼頭/.test(line) && arriveDay) continue;
      if (/^-{3,}/.test(line)) continue;
      if (/^下貨|拖櫃|拖車名|^下[\u4e00-\u9fff]|^[\u4e00-\u9fff]{1,8}拖/.test(line.trim())) continue;
      if (/\d{1,2}\s*[\/.\-]\s*\d{1,2}.+到/.test(line)) continue;
      if (/薰蒸|燻好到|薰好到/.test(line)) continue;
      if (/^[\u4e00-\u9fffA-Za-z0-9]{1,10}\s*[-–—]\s*[\u4e00-\u9fffA-Za-z0-9]{1,12}$/.test(line.trim())) continue;
      if (/^[\u4e00-\u9fff]{1,8}拖\s*[*＊]?$/.test(line.trim())) continue;
      if (/拖車名\s*[=:：]/.test(line)) continue;
      if (trailerPhone && compact.replace(/-/g, "").includes(trailerPhone)) continue;
      if (/0\d{1,3}[-\s]?\d{3,4}[-\s]?\d{3,4}/.test(line)) continue;
      // 狀態摘要列（已報關／沒有藥檢／有1櫃儀檢…）已轉成欄位，勿整句塞備註
      if (/已報關|沒有藥檢|無藥檢|免藥檢|需要藥檢|有\d*櫃|另\d*櫃|儀檢|海關查驗|此票|本票/.test(line)) continue;
      noteBits.push(line);
    }
    const note = [...new Set(noteBits)].join(" · ").slice(0, 240);

    const missing = [];
    if (!uha) missing.push("編號");
    if (!containerNo) missing.push("櫃號");
    if (!arriveDay && !unpackSite && !unpackAt) missing.push("到港日／船期");
    if (!product && !unpackSite) missing.push("品名");

    return {
      id: uid("draft"),
      uha,
      containerNo,
      containers,
      containerMeta,
      checkKind,
      customsNo,
      arriveDay,
      product,
      broker,
      seller,
      shipCo,
      trailer,
      trailerPhone,
      trailerContact,
      unpackSite,
      unpackAt,
      assignQty,
      dock,
      inspect,
      fumigate,
      note,
      raw: text.slice(0, 4000),
      missing,
      parseOk: !!(containerNo || product || uha || note || unpackSite || unpackAt),
    };
  }

  /**
   * 解析 → 多筆草稿。多櫃號（同船期）拆成一櫃一筆，並帶各自查驗類型。
   */
  function parseImportDocTexts(raw) {
    const text = String(raw || "").replace(/\r\n/g, "\n").trim();
    if (!text) return [];

    const parts = [];
    const markers = [];
    let m;
    const finder = /(?:^|\n)((?:編號\s*[:：]?\s*)?(?:UHA|NC)\s*\d{1,6})/gi;
    while ((m = finder.exec(text)) !== null) {
      markers.push(m.index + (m[0].startsWith("\n") ? 1 : 0));
    }
    if (markers.length > 1) {
      for (let i = 0; i < markers.length; i++) {
        const start = markers[i];
        const end = i + 1 < markers.length ? markers[i + 1] : text.length;
        const chunk = text.slice(start, end).trim();
        if (chunk) parts.push(chunk);
      }
    } else {
      const blanks = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
      const isHaulDispatch =
        /拖車名|拖櫃[^\n]{0,40}到|下貨\s*[-–—]|[\u4e00-\u9fff]{1,6}\s*[-–—]\s*[\u4e00-\u9fff]{1,8}|(?:^|\n)\s*下[\u4e00-\u9fff]|[\u4e00-\u9fff]{1,8}拖\s*[*＊]?/.test(
          text,
        );
      if (
        blanks.length > 1 &&
        !isHaulDispatch &&
        blanks.every((b) => /\b(?:UHA|NC)\s*\d/i.test(b) || /櫃號/i.test(b) || /\b[A-Z]{4}\s*\d{6,7}\b/i.test(b))
      ) {
        parts.push(...blanks);
      } else {
        parts.push(text);
      }
    }

    const drafts = [];
    for (const chunk of parts) {
      const d = parseOneImportChunk(chunk);
      if (!d) continue;
      const meta =
        Array.isArray(d.containerMeta) && d.containerMeta.length
          ? d.containerMeta
          : (d.containers || []).map((c) => ({ containerNo: c, checkKind: d.checkKind || "" }));
      if (meta.length > 1) {
        for (const item of meta) {
          const kind = item.checkKind || "";
          const itemProduct = item.product || d.product || "";
          const itemQty = item.assignQty || d.assignQty || "";
          const itemPhone = item.trailerPhone || d.trailerPhone || "";
          const itemContact = item.trailerContact || d.trailerContact || "";
          const noteParts = [];
          if (kind) noteParts.push(kind);
          if (d.trailer) noteParts.push(`拖車 ${d.trailer}`);
          if (d.unpackSite) noteParts.push(`下貨 ${d.unpackSite}`);
          if (itemQty) noteParts.push(`${itemQty}${/[箱]/.test(d.raw || "") ? "箱" : "袋"}`);
          if (itemPhone) noteParts.push(itemPhone);
          if (itemContact) noteParts.push(`聯絡人 ${itemContact}`);
          if (d.note) {
            const otherProducts = meta
              .filter((m) => m.containerNo !== item.containerNo && m.product)
              .map((m) => m.product);
            const cleaned = String(d.note)
              .split(" · ")
              .filter(
                (p) =>
                  p !== "儀檢" &&
                  p !== "海關查驗" &&
                  !/^拖車 /.test(p) &&
                  !/^下貨 /.test(p) &&
                  !/^\d+箱$/.test(p) &&
                  !/^\d+袋$/.test(p) &&
                  !/^0\d+$/.test(p.replace(/-/g, "")) &&
                  !/^聯絡人/.test(p) &&
                  !/^拖車聯絡人/.test(p) &&
                  !/^[A-Z]{4}\d{6,7}/i.test(p) &&
                  !otherProducts.includes(p),
              )
              .join(" · ");
            if (cleaned) noteParts.push(cleaned);
          }
          drafts.push({
            ...d,
            id: uid("draft"),
            containerNo: item.containerNo,
            containers: [item.containerNo],
            containerMeta: [item],
            checkKind: kind,
            product: itemProduct,
            assignQty: itemQty,
            trailerPhone: itemPhone,
            trailerContact: itemContact,
            trailer: d.trailer || "",
            unpackSite: d.unpackSite || "",
            note: [...new Set(noteParts)].join(" · ").slice(0, 240),
            missing: (d.missing || []).filter((x) => {
              if (x === "櫃號") return false;
              if (x === "品名" && itemProduct) return false;
              if (x === "到港日／船期" && d.unpackSite) return false;
              return true;
            }),
            parseOk: true,
          });
        }
      } else if (d.uha || d.containerNo || d.product || d.customsNo || d.arriveDay || d.note) {
        drafts.push(d);
      }
    }
    if (!drafts.length) {
      const fallback = parseOneImportChunk(text);
      if (fallback) drafts.push(fallback);
    }
    return drafts;
  }

  function parseImportDocText(raw) {
    const list = parseImportDocTexts(raw);
    return list[0] || null;
  }

  function findDraftIndex(key) {
    ensureState();
    const drafts = state.importParseDrafts || [];
    const k = String(key ?? "");
    let i = drafts.findIndex((d) => d && String(d.id) === k);
    if (i >= 0) return i;
    const n = Number(k);
    if (Number.isInteger(n) && n >= 0 && n < drafts.length) return n;
    return -1;
  }

  function findTrackByContainer(cno) {
    const c = normContainer(cno);
    if (!c) return null;
    ensureState();
    const cab = (state.importCabinets || []).find((x) => normContainer(x.containerNo) === c);
    if (cab) {
      const t = findReleased(cab.uha) || ensureTrackFromCabinet(cab);
      return { uha: cab.uha, cab, track: t, matched: true };
    }
    const rel = (state.importReleased || []).find((r) => normContainer(r.containerNo) === c);
    if (rel) return { uha: rel.uha, cab: null, track: rel, matched: true };
    return null;
  }

  /** 草稿流向：報關／船期 → 海關查驗；下貨／拖車／薰蒸後下貨 → 已放行追蹤 */
  function draftTrackFlow(d) {
    if (!d) return "port";
    const haul =
      !!(d.unpackSite || d.trailerPhone || d.trailer || d.assignQty || d.unpackAt) &&
      !!(d.containerNo || d.uha);
    const customs = !!(d.arriveDay || d.dock || d.shipCo || d.checkKind || (d.inspect && d.inspect !== "none") || /已報關/.test(String(d.note || "")));
    if (haul && !customs) return "release";
    if (haul && customs) return "port"; // 同則兼有船期＋下貨：先入查驗，欄位仍寫入追蹤
    if (haul) return "release";
    return "port";
  }

  function confirmParseDraft(key, opts) {
    ensureState();
    const quiet = !!(opts && opts.quiet);
    const i = findDraftIndex(key);
    const d = i >= 0 ? state.importParseDrafts[i] : null;
    if (!d) return false;
    let uha = normUha(d.uha);
    const cno = normContainer(d.containerNo);
    const hit = !uha && cno ? findTrackByContainer(cno) : null;
    if (hit) uha = hit.uha;
    if (!uha) uha = makePendingUha();
    const flow = draftTrackFlow(d);
    const cab = {
      id: uid("cab"),
      uha,
      containerNo: cno,
      arriveDay: parseDay(d.arriveDay) || "",
      product: String(d.product || "").trim(),
      qty: d.assignQty !== undefined && d.assignQty !== "" ? d.assignQty : "",
      seller: String(d.seller || "").trim(),
      shipCo: String(d.shipCo || "").trim(),
      broker: String(d.broker || "").trim(),
      docRef: "",
      amount: "",
      price: "",
    };
    const by = new Map(state.importCabinets.map((c) => [c.uha, c]));
    if (by.has(uha)) {
      const prev = by.get(uha);
      Object.assign(prev, {
        id: prev.id,
        uha,
        arriveDay: cab.arriveDay || prev.arriveDay || "",
        product: cab.product || prev.product || "",
        containerNo: cab.containerNo || prev.containerNo || "",
        qty: cab.qty !== "" && cab.qty != null ? cab.qty : prev.qty,
        seller: cab.seller || prev.seller || "",
        shipCo: cab.shipCo || prev.shipCo || "",
        broker: cab.broker || prev.broker || "",
      });
    } else state.importCabinets.push(cab);
    const savedCab = by.get(uha) || cab;
    stampRow(savedCab);
    const track = ensureTrackFromCabinet(savedCab);
    ensureClearanceShape(track);
    // 同步櫃表可見欄到追蹤列
    if (savedCab.containerNo) track.containerNo = savedCab.containerNo;
    if (savedCab.product) track.product = savedCab.product;
    if (savedCab.arriveDay) track.arriveDay = savedCab.arriveDay;
    if (savedCab.shipCo) track.shipCo = savedCab.shipCo;
    if (savedCab.seller) track.seller = savedCab.seller;
    if (savedCab.broker) track.broker = savedCab.broker;
    if (d.customsNo) track.customsNo = String(d.customsNo).trim();
    if (d.trailer) track.trailer = String(d.trailer).trim();
    if (d.trailerPhone) track.trailerPhone = String(d.trailerPhone).trim();
    if (d.unpackSite) track.unpackSite = String(d.unpackSite).trim();
    if (d.unpackAt) {
      track.unpackAt = String(d.unpackAt).trim();
      if (!track.pickupDay && track.unpackAt.length >= 10) track.pickupDay = track.unpackAt.slice(0, 10);
    }
    if (d.assignQty !== undefined && d.assignQty !== "") {
      const n = Number(d.assignQty);
      track.assignQty = Number.isFinite(n) ? n : d.assignQty;
    }
    if (d.dock) track.dock = String(d.dock).trim();
    if (d.checkKind) track.checkKind = String(d.checkKind).trim();
    const noteParts = [];
    if (d.checkKind) noteParts.push(String(d.checkKind).trim());
    if (d.trailerContact) noteParts.push(`聯絡人 ${String(d.trailerContact).trim()}`);
    if (d.note) noteParts.push(String(d.note).trim());
    if (noteParts.length) {
      const merged = [
        ...new Set([...(String(track.note || "").split(" · ").filter(Boolean)), ...noteParts.join(" · ").split(" · ")]),
      ].join(" · ");
      track.note = merged.slice(0, 240);
    }
    if (d.inspect && d.inspect !== "none") {
      track.inspect = d.inspect;
      track.inspectManual = true;
    }
    if (d.fumigate && d.fumigate !== "none") {
      track.fumigate = d.fumigate;
      track.fumigateManual = true;
      if (d.arriveDay && !track.fumigateAt) {
        const day = parseDay(d.arriveDay) || d.arriveDay;
        if (day) track.fumigateAt = `${day}T09:00`;
      }
    }
    // 流程：下貨／拖車類 → 已放行追蹤；報關／船期 → 海關查驗
    if (flow === "release") {
      track.released = true;
      track.askPickup = true;
      track.arrangeMonday = true;
      if (!track.releasedAt) {
        try {
          track.releasedAt = new Date().toISOString().slice(0, 16);
        } catch (_) {
          track.releasedAt = "";
        }
      }
    } else if (track.released == null) {
      track.released = false;
    }
    stampRow(track);
    state.importParseDrafts.splice(i, 1);
    if (typeof save === "function") save();
    if (!quiet && typeof setStatus === "function") {
      const siteHint = d.unpackSite ? ` · 下貨 ${d.unpackSite}` : "";
      const where = track.released ? "已放行追蹤" : "海關查驗";
      setStatus(
        isPendingUha(uha)
          ? `已匯入${where}（編號待補）${cno ? " · " + cno : ""}${siteHint}`
          : `${uha} 已匯入${where}${cno ? " · " + cno : ""}${siteHint}`,
      );
    }
    if (!quiet) {
      importPane = track.released ? "release" : "port";
      closeDrawer({ force: true });
      renderImportPage();
    }
    return { ok: true, uha, flow: track.released ? "release" : "port", matched: !!hit };
  }

  /** 待確認草稿一次匯入貨櫃追蹤（海關查驗／已放行） */
  function confirmParseDraftsAll() {
    ensureState();
    const ids = (state.importParseDrafts || []).map((d) => d && d.id).filter(Boolean);
    if (!ids.length) {
      if (typeof setStatus === "function") setStatus("沒有待確認草稿。", true);
      return { n: 0, port: 0, release: 0 };
    }
    let port = 0;
    let release = 0;
    for (const id of ids.slice()) {
      const r = confirmParseDraft(id, { quiet: true });
      if (r && r.ok) {
        if (r.flow === "release") release += 1;
        else port += 1;
      }
    }
    if (typeof save === "function") save();
    const n = port + release;
    if (typeof setStatus === "function") {
      setStatus(`已匯入貨櫃追蹤 ${n} 筆（海關查驗 ${port} · 已放行 ${release}）。`);
    }
    importPane = release && !port ? "release" : release && port ? "checklist" : "port";
    closeDrawer({ force: true });
    renderImportPage();
    return { n, port, release };
  }

  function discardParseDraft(key) {
    ensureState();
    const i = findDraftIndex(key);
    if (i < 0) return false;
    state.importParseDrafts.splice(i, 1);
    if (typeof save === "function") save();
    return true;
  }

  function ensureState() {
    if (!Array.isArray(state.importCabinets)) state.importCabinets = [];
    if (!Array.isArray(state.importArrivals)) state.importArrivals = [];
    if (!Array.isArray(state.importReleased)) state.importReleased = [];
    if (!Array.isArray(state.importParseDrafts)) state.importParseDrafts = [];
    // 卸除先前批次匯入的 Excel 舊資料（一次）
    if (!state.importExcelClearedV1) {
      state.importExcelClearedV1 = true;
      state.importCabinets = [];
      state.importArrivals = [];
      state.importReleased = [];
      if (typeof save === "function") save();
    }
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function esc(s) {
    return typeof window.esc === "function"
      ? window.esc(s)
      : String(s ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
  }

  /**
   * 編號：UHA… 或 NC…（可同格，如 UHA697 + NC002）
   * 櫃號：EMCU／FBIU／FSCU／OTPU…（四碼英文＋6～7碼數字），絕不是 UHA／NC
   */
  function parseRefNos(v) {
    const s = String(v || "")
      .toUpperCase()
      .replace(/\r/g, "\n");
    const uhaM = s.match(/UHA\s*(\d{1,6})/);
    const ncM = s.match(/(?:^|[^A-Z])NC\s*(\d{1,6})\b/) || s.match(/\bNC\s*(\d{1,6})\b/);
    return {
      uha: uhaM ? "UHA" + uhaM[1] : "",
      nc: ncM ? "NC" + ncM[1] : "",
    };
  }

  /** 主編號：優先 UHA，否則 NC */
  function normUha(v) {
    const refs = parseRefNos(v);
    if (refs.uha) return refs.uha;
    if (refs.nc) return refs.nc;
    return "";
  }

  /** 尚未補正式 UHA／NC（含暫編號） */
  function isPendingUha(v) {
    const s = String(v || "").trim();
    if (!s) return true;
    if (/^待編-/i.test(s) || /^TMP-/i.test(s)) return true;
    return !/^(UHA|NC)\d+/i.test(s);
  }

  function makePendingUha() {
    return `待編-${Date.now().toString(36).slice(-6)}`;
  }

  /**
   * 港口補／改編號：同步櫃表、已放行追蹤、拆卸派工、進櫃紀錄。
   * @returns {{ ok: boolean, uha?: string, error?: string }}
   */
  function assignPortUha(oldKey, newUhaRaw) {
    ensureState();
    const newUha = normUha(newUhaRaw);
    if (!newUha) return { ok: false, error: "請填有效編號（如 UHA715 或 NC002）" };
    const key = String(oldKey || "").trim();
    if (!key) return { ok: false, error: "找不到資料" };

    const cab = (state.importCabinets || []).find((c) => c.uha === key || c.id === key);
    if (!cab) return { ok: false, error: "找不到貨櫃資料" };

    const oldUha = String(cab.uha || key);
    if (oldUha === newUha) return { ok: true, uha: newUha };

    const clash = (state.importCabinets || []).find((c) => c !== cab && c.uha === newUha);
    if (clash) return { ok: false, error: `${newUha} 已存在，請改用其他編號` };

    cab.uha = newUha;
    stampRow(cab);

    const track =
      (state.importReleased || []).find((x) => x.uha === oldUha) ||
      (state.importReleased || []).find((x) => x.uha === key);
    if (track) {
      track.uha = newUha;
      stampRow(track);
    }

    if (!Array.isArray(state.unpackJobs)) state.unpackJobs = [];
    for (const j of state.unpackJobs) {
      if (j.sourceUha === oldUha || j.box === oldUha || j.sourceUha === key || j.box === key) {
        j.sourceUha = newUha;
        j.box = newUha;
        j.updatedAt = Date.now();
      }
    }

    for (const a of state.importArrivals || []) {
      if (a.uha === oldUha || a.uha === key) {
        a.uha = newUha;
        stampRow(a);
      }
    }

    if (typeof save === "function") save();
    if (typeof setStatus === "function") setStatus(isPendingUha(oldUha) ? `已補編號 ${newUha}` : `編號已改為 ${newUha}`);
    return { ok: true, uha: newUha, oldUha };
  }

  function isContainerNo(v) {
    const t = String(v || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/\.$/, "");
    if (!t) return false;
    if (/^(UHA|NC)\d/i.test(t)) return false;
    return /^[A-Z]{4}\d{6,7}$/.test(t);
  }

  function normContainer(v) {
    const t = String(v || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/\.$/, "");
    if (!t || /^(UHA|NC)\d/i.test(t)) return "";
    if (isContainerNo(t)) return t;
    return "";
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  /** Excel serial／民國YYYMMDD／M/D → yyyy-mm-dd（民國115＝2026，勿變成1926） */
  function fixCenturyDay(iso) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso || "";
    let y = Number(m[1]);
    // 舊版把民國113–115誤算成1924–1926
    if (y >= 1924 && y <= 1927) y += 100;
    return `${y}-${m[2]}-${m[3]}`;
  }

  function parseDay(v) {
    if (v == null || v === "") return "";
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      return fixCenturyDay(`${v.getUTCFullYear()}-${pad2(v.getUTCMonth() + 1)}-${pad2(v.getUTCDate())}`);
    }
    if (typeof v === "number" && v > 20000 && v < 80000) {
      const ms = Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000;
      try {
        return fixCenturyDay(new Date(ms).toISOString().slice(0, 10));
      } catch (_) {
        return "";
      }
    }
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return fixCenturyDay(s.slice(0, 10));
    // 民國年 YYYMMDD（例：1150102 → 2026-01-02）
    const roc = s.match(/^(1\d{2})(\d{2})(\d{2})$/);
    if (roc) {
      const y = 1911 + Number(roc[1]);
      return `${y}-${roc[2]}-${roc[3]}`;
    }
    const ymd = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (ymd) return fixCenturyDay(`${ymd[1]}-${pad2(ymd[2])}-${pad2(ymd[3])}`);
    const mdy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (mdy) {
      let y = Number(mdy[3]);
      if (y < 100) y += 2000; // 26 → 2026
      return fixCenturyDay(`${y}-${pad2(mdy[1])}-${pad2(mdy[2])}`);
    }
    const md = s.match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/);
    if (md) {
      const y = new Date().getFullYear();
      return `${y}-${pad2(md[1])}-${pad2(md[2])}`;
    }
    return s;
  }

  /** 修正已匯入：到港日 1926→2026；誤當櫃號的 UHA／NC 清掉 */
  function sanitizeImportIds() {
    ensureState();
    let n = 0;
    for (const c of state.importCabinets || []) {
      if (!c) continue;
      const refs = parseRefNos(c.uha);
      const uha = refs.uha || refs.nc || normUha(c.uha);
      if (uha && uha !== c.uha) {
        c.uha = uha;
        n++;
      }
      if (refs.uha && refs.nc && c.nc !== refs.nc) {
        c.nc = refs.nc;
        n++;
      }
      const cont = normContainer(c.containerNo);
      if ((c.containerNo || "") && cont !== (c.containerNo || "")) {
        c.containerNo = cont;
        n++;
      }
    }
    for (const a of state.importArrivals || []) {
      if (!a) continue;
      const uha = normUha(a.uha);
      if (uha && uha !== a.uha) {
        a.uha = uha;
        n++;
      }
      const cont = normContainer(a.containerNo);
      if ((a.containerNo || "") && cont !== (a.containerNo || "")) {
        a.containerNo = cont;
        n++;
      }
      if (a.day) {
        const fixed = fixCenturyDay(parseDay(a.day) || a.day);
        if (fixed && fixed !== a.day) {
          a.day = fixed;
          n++;
        }
      }
    }
    for (const r of state.importReleased || []) {
      if (!r) continue;
      const uha = normUha(r.uha);
      if (uha && uha !== r.uha) {
        r.uha = uha;
        n++;
      }
      const cont = normContainer(r.containerNo);
      if ((r.containerNo || "") && cont !== (r.containerNo || "")) {
        r.containerNo = cont;
        n++;
      }
    }
    return n;
  }

  /** 修正已匯入的到港日 1926 → 2026 */
  function fixArriveDaysInState() {
    ensureState();
    let n = sanitizeImportIds();
    for (const c of state.importCabinets || []) {
      if (!c.arriveDay) continue;
      const fixed = fixCenturyDay(parseDay(c.arriveDay) || c.arriveDay);
      if (fixed && fixed !== c.arriveDay) {
        c.arriveDay = fixed;
        n++;
      }
    }
    for (const r of state.importReleased || []) {
      if (!r.arriveDay) continue;
      const fixed = fixCenturyDay(parseDay(r.arriveDay) || r.arriveDay);
      if (fixed && fixed !== r.arriveDay) {
        r.arriveDay = fixed;
        n++;
      }
    }
    if (n && typeof save === "function") save();
  }

  function cell(row, i) {
    return row && row[i] != null ? row[i] : "";
  }

  function findHeaderRow(rows, needles) {
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const line = (rows[i] || []).map((c) => String(c || "")).join("|");
      if (needles.every((n) => line.includes(n))) return i;
    }
    return -1;
  }

  function colIndex(header, names) {
    const h = (header || []).map((c) => String(c || "").replace(/\s+/g, ""));
    for (const name of names) {
      const i = h.findIndex((x) => x.includes(name));
      if (i >= 0) return i;
    }
    return -1;
  }

  /** 櫃表：所有海關貨櫃 */
  function parseCabinetSheet(rows) {
    const hi = findHeaderRow(rows, ["編號"]);
    if (hi < 0) return [];
    const h = rows[hi];
    const iUha = colIndex(h, ["編號"]);
    const iCont = colIndex(h, ["櫃號"]);
    const iDay = colIndex(h, ["到港日", "日期"]);
    const iProd = colIndex(h, ["品名", "產品"]);
    const iQty = colIndex(h, ["件數"]);
    const iSeller = colIndex(h, ["賣方"]);
    const iShip = colIndex(h, ["船公司"]);
    const iBroker = colIndex(h, ["報關行"]);
    const iRef = colIndex(h, ["報關金額"]) >= 0 ? colIndex(h, ["報關金額"]) - 1 : -1;
    const out = [];
    for (let r = hi + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const refs = parseRefNos(cell(row, iUha));
      const uha = refs.uha || refs.nc;
      if (!uha) continue;
      if (!/^(UHA|NC)\d+/i.test(uha)) continue;
      out.push({
        id: uid("cab"),
        uha,
        nc: refs.uha && refs.nc ? refs.nc : "",
        containerNo: normContainer(cell(row, iCont)),
        arriveDay: parseDay(cell(row, iDay)),
        product: String(cell(row, iProd) || "").trim(),
        qty: Number(cell(row, iQty)) || 0,
        seller: String(cell(row, iSeller) || "").trim(),
        shipCo: String(cell(row, iShip) || "").trim(),
        broker: String(cell(row, iBroker) || "").trim(),
        docRef: String(cell(row, iRef >= 0 ? iRef : 8) || "").trim(),
        amount: String(cell(row, colIndex(h, ["報關金額"])) || "").trim(),
        price: String(cell(row, colIndex(h, ["實價"])) || "").trim(),
      });
    }
    return out;
  }

  /** 進櫃紀錄：確認進櫃（含拆櫃數量） */
  function parseArrivalSheet(rows) {
    const hi = findHeaderRow(rows, ["編號", "櫃號"]);
    if (hi < 0) return [];
    const h = rows[hi];
    const iDay = colIndex(h, ["日期"]);
    const iUha = colIndex(h, ["編號"]);
    const iSeller = colIndex(h, ["賣方"]);
    const iBuyer = colIndex(h, ["買方"]);
    const iCont = colIndex(h, ["櫃號"]);
    const iProd = colIndex(h, ["產品", "品名"]);
    const iOuter = colIndex(h, ["外箱"]);
    const iCond = colIndex(h, ["貨況"]);
    const iSpec = colIndex(h, ["規格"]);
    const iUnload = colIndex(h, ["卸貨點"]);
    const iCusQty = colIndex(h, ["報關數量"]);
    const iUnpack = colIndex(h, ["拆櫃數量"]);
    const iPrice = colIndex(h, ["售價"]);
    const iInspect = colIndex(h, ["送檢"]);
    const iCusNo = colIndex(h, ["報關單"]);
    const iNotice = colIndex(h, ["通知號碼"]);
    const out = [];
    for (let r = hi + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const uha = normUha(cell(row, iUha));
      if (!uha) continue;
      const unpackRaw = cell(row, iUnpack);
      let unpackQty = null;
      if (unpackRaw !== "" && unpackRaw != null) {
        const n = Number(String(unpackRaw).replace(/[^\d.-]/g, ""));
        if (Number.isFinite(n)) unpackQty = n;
        else if (/公斤|K/i.test(String(unpackRaw))) unpackQty = String(unpackRaw).trim();
        else unpackQty = String(unpackRaw).trim();
      }
      out.push({
        id: uid("arr"),
        uha,
        containerNo: normContainer(cell(row, iCont)),
        day: parseDay(cell(row, iDay)),
        seller: String(cell(row, iSeller) || "").trim(),
        buyer: String(cell(row, iBuyer) || "").trim(),
        product: String(cell(row, iProd) || "").trim(),
        outerBox: String(cell(row, iOuter) || "").trim(),
        condition: String(cell(row, iCond) || "").trim(),
        spec: String(cell(row, iSpec) || "").trim(),
        unload: String(cell(row, iUnload) || "").trim(),
        customsQty: cell(row, iCusQty),
        unpackQty,
        price: String(cell(row, iPrice) || "").trim(),
        inspect: String(cell(row, iInspect) || "").trim(),
        customsNo: String(cell(row, iCusNo) || "").trim(),
        noticeNo: String(cell(row, iNotice) || "").trim(),
      });
    }
    return out;
  }

  /** 備註只當參考文字；藥檢／煙燻狀態一律人工點選，不自動判斷 */
  function noteHints(note) {
    const n = String(note || "");
    return {
      askPickup: /請安排領櫃/.test(n),
      ft: /\bFT\b/i.test(n),
    };
  }

  function ensureClearanceShape(row) {
    if (!row || typeof row !== "object") return row;
    if (row.released == null) row.released = false;
    if (!row.inspect) row.inspect = "none";
    if (row.inspectAt == null) row.inspectAt = "";
    if (!row.fumigate) row.fumigate = "none";
    if (row.fumigateAt == null) row.fumigateAt = "";
    if (row.customsNo == null) row.customsNo = "";
    if (row.dock == null) row.dock = "";
    if (row.checkKind == null) row.checkKind = "";
    if (row.arriveDay == null) row.arriveDay = "";
    if (row.shipCo == null) row.shipCo = "";
    if (row.seller == null) row.seller = "";
    if (row.broker == null) row.broker = "";
    if (row.note == null) row.note = "";
    /** 缺電放／缺資料：分開勾選，才知道要通知缺哪個 */
    if (row.missingTelex == null) row.missingTelex = false;
    if (row.missingData == null) row.missingData = false;
    if (row.missingDocs) {
      if (!row.missingTelex && !row.missingData) row.missingData = true;
      row.missingDocs = false;
    }
    if (row.trailer == null) row.trailer = "";
    if (row.trailerPhone == null) row.trailerPhone = "";
    if (row.trailerConfirmed == null) row.trailerConfirmed = false;
    if (row.trailerNote == null) row.trailerNote = "";
    if (row.unpackAt == null) row.unpackAt = "";
    if (row.pickupDay == null) row.pickupDay = "";
    if (row.unpackSite == null) row.unpackSite = "";
    if (row.assignee == null) row.assignee = "";
    if (row.assignQty == null) row.assignQty = "";
    if (row.destType == null) row.destType = "coldstore";
    if (row.dispatched == null) row.dispatched = false;
    if (row.notifyTrailer == null) row.notifyTrailer = false;
    if (row.notifyUnpacker == null) row.notifyUnpacker = false;
    if (row.notifyCustomer == null) row.notifyCustomer = false;
    if (row.halfSplit == null) row.halfSplit = false;
    if (row.assignee2 == null) row.assignee2 = "";
    if (row.assignQty2 == null) row.assignQty2 = "";
    if (row.unpackSite2 == null) row.unpackSite2 = "";
    if (row.ftConfirmed == null) row.ftConfirmed = false;
    if (row.ftAt == null) row.ftAt = "";
    if (row.pickupReady == null) row.pickupReady = false;
    if (row.portConfirm == null) row.portConfirm = row.released ? "done" : "pending";
    if (row.askPickup == null) row.askPickup = false;
    if (row.ft == null) row.ft = false;
    if (row.releasedAt == null) row.releasedAt = "";
    if (row.arrangeMonday == null) row.arrangeMonday = !!(row.fromReleasedExcel || row.released);
    // 清掉先前依備註誤標的「藥檢中／薰蒸中」
    if (!row.clearFixAutoWait) {
      row.clearFixAutoWait = true;
      if (!row.inspectManual && row.inspect === "wait") {
        row.inspect = "none";
        row.inspectAt = "";
      }
      if (!row.fumigateManual && row.fumigate === "wait") {
        row.fumigate = "none";
        row.fumigateAt = "";
      }
      if (row.fromReleasedExcel || row.arrangeMonday) {
        row.released = true;
        row.askPickup = true;
      }
    }
    return row;
  }

  function checkSettled(st) {
    /** 待確認／需要＝未結清；完成／無須檢驗＝已結清 */
    return st === "done" || st === "skip";
  }

  /** 藥檢／煙燻狀態已結清（進行中不算） */
  function inspectFumeSettled(c) {
    ensureClearanceShape(c);
    return checkSettled(c.inspect) && checkSettled(c.fumigate);
  }

  /** 藥檢／煙燻結束時間（取較晚者；無則空） */
  function clearEndAt(c) {
    ensureClearanceShape(c);
    const times = [];
    if (c.inspect === "done" && c.inspectAt) times.push(String(c.inspectAt));
    if (c.fumigate === "done" && c.fumigateAt) times.push(String(c.fumigateAt));
    if (!times.length) {
      if (c.inspectAt) times.push(String(c.inspectAt));
      if (c.fumigateAt) times.push(String(c.fumigateAt));
    }
    if (!times.length) return "";
    return times.sort().slice(-1)[0];
  }

  /**
   * 已放行（未拆櫃）：藥檢／煙燻結清且已確認 FT 後，可依結束時間安排拆櫃
   */
  function isReleasedClear(c) {
    ensureClearanceShape(c);
    return !!c.released;
  }

  /** 已放行且藥檢／煙燻結清、已確認 FT → 可依結束時間安排拆櫃 */
  function isArrangeReady(c) {
    ensureClearanceShape(c);
    if (!c.released) return false;
    if (!inspectFumeSettled(c)) return false;
    if (!(c.ftConfirmed || c.ft)) return false;
    return true;
  }

  /** 已放行（未拆櫃）且 FT／藥檢煙燻就緒 → 可排拆櫃 */
  function isPickupReady(c) {
    return isArrangeReady(c) || !!(c && c.pickupReady);
  }

  /** 派拖車後放行條件：有碼頭、有拖車，藥檢／煙燻已選定（含無／免辦／進行中／完成） */
  function canSendRelease(c) {
    ensureClearanceShape(c);
    return !!(String(c.dock || "").trim() && String(c.trailer || "").trim());
  }

  /** 由櫃表建立／取得追蹤列（到港作業用） */
  function ensureTrackFromCabinet(cab) {
    ensureState();
    let row = findReleased(cab.uha);
    if (row) {
      ensureClearanceShape(row);
      if (!row.containerNo && cab.containerNo) row.containerNo = cab.containerNo;
      if (!row.product && cab.product) row.product = cab.product;
      if (!row.arriveDay && cab.arriveDay) row.arriveDay = cab.arriveDay;
      if (!row.shipCo && cab.shipCo) row.shipCo = cab.shipCo;
      if (!row.seller && cab.seller) row.seller = cab.seller;
      if (!row.broker && cab.broker) row.broker = cab.broker;
      return row;
    }
    row = {
      id: uid("rel"),
      uha: cab.uha,
      containerNo: cab.containerNo || "",
      arriveDay: cab.arriveDay || "",
      note: "",
      product: cab.product || "",
      shipCo: cab.shipCo || "",
      seller: cab.seller || "",
      broker: cab.broker || "",
      released: false,
      releasedAt: "",
      inspect: "none",
      inspectAt: "",
      fumigate: "none",
      fumigateAt: "",
      dock: "",
      checkKind: "",
      missingTelex: false,
      missingData: false,
      trailer: "",
      customsNo: "",
      ftConfirmed: false,
      pickupReady: false,
      askPickup: false,
      ft: false,
      clearFixAutoWait: true,
    };
    state.importReleased.push(row);
    return row;
  }

  /** 已放行.xlsx：整表＝已放行（未拆櫃）；藥檢／煙燻不自動判斷 */
  function parseReleasedSheet(rows) {
    const out = [];
    const seen = new Set();
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const raw = String(row[c] || "").trim();
        const m = raw.match(/\b(UHA\s*\d+)\b/i);
        if (!m) continue;
        const uha = normUha(m[1]);
        if (seen.has(uha)) continue;
        seen.add(uha);
        let containerNo = "";
        for (let k = c + 1; k < Math.min(c + 4, row.length); k++) {
          const t = normContainer(row[k]);
          if (t) {
            containerNo = t;
            break;
          }
        }
        // 常見欄位：UHA、櫃號、（日）、品名、代碼、拖車窗口、日、碼頭
        const after = [];
        for (let k = c + 1; k < Math.min(c + 10, row.length); k++) {
          const t = String(row[k] || "").trim();
          if (!t || normUha(t) === uha) continue;
          if (containerNo && normContainer(t) === containerNo) continue;
          after.push(t);
        }
        const note = after.slice(0, 6).join(" · ");
        const hints = noteHints(note + " " + after.join(" "));
        let product = "";
        let trailer = "";
        let dock = "";
        for (const t of after) {
          if (/^\d+(\.\d+)?$/.test(t) && Number(t) > 20000) continue; // excel date serial
          if (/^(S\d+|\d{2,3})$/i.test(t)) continue; // 代碼
          if (!product && /[\u4e00-\u9fffA-Za-z]/.test(t) && t.length >= 2) {
            product = t;
            continue;
          }
          if (!trailer && /^[\u4e00-\u9fff]{1,4}$/.test(t) && !/油|湖|交|華|碼頭/.test(t)) {
            trailer = t;
            continue;
          }
          if (!dock && /[\u4e00-\u9fff]/.test(t)) dock = t;
        }
        out.push({
          id: uid("rel"),
          uha,
          containerNo,
          note,
          row: r + 1,
          product: product || after[0] || "",
          released: true,
          releasedAt: "",
          arrangeMonday: true,
          inspect: "none",
          inspectAt: "",
          fumigate: "none",
          fumigateAt: "",
          dock,
          trailer,
          askPickup: true,
          ft: hints.ft,
          ftConfirmed: false,
          pickupReady: false,
          customsNo: "",
          clearFixAutoWait: true,
          fromReleasedExcel: true,
        });
      }
    }
    return out;
  }

  function arrivalByUha() {
    ensureState();
    const map = new Map();
    for (const a of state.importArrivals) {
      if (a.uha) map.set(a.uha, a);
    }
    return map;
  }

  function releasedByUha() {
    ensureState();
    const map = new Map();
    for (const a of state.importReleased) {
      if (a.uha) map.set(a.uha, a);
    }
    return map;
  }

  /** 櫃表有、進櫃紀錄沒有 → 到港待驗（未放行）或已放行（未拆櫃） */
  function portPendingList() {
    ensureState();
    const arrived = arrivalByUha();
    return state.importCabinets.filter((c) => c.uha && !arrived.has(c.uha));
  }

  /** 進櫃紀錄＝已拆櫃入公司倉庫 */
  function stockList() {
    ensureState();
    return state.importArrivals.slice();
  }

  function boardStats() {
    ensureState();
    const port = portPendingList().length;
    const arrived = state.importArrivals.length;
    const arr = arrivalByUha();
    const released = (state.importReleased || []).filter((r) => r.uha && !arr.has(r.uha)).length;
    const stock = stockList().length;
    const total = state.importCabinets.length;
    return { total, port, arrived, released, stock };
  }

  async function uploadParse(file) {
    const data = typeof bufToB64 === "function" ? bufToB64(await file.arrayBuffer()) : btoa(String.fromCharCode(...new Uint8Array(await file.arrayBuffer())));
    const r = await fetch("./api/xlsx-parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, data }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.error || "解析失敗");
    return j;
  }

  function pickBestSheet(sheets, preferNames, scoreFn) {
    let best = null;
    let bestScore = -1;
    for (const sh of sheets || []) {
      const name = String(sh.name || "");
      let score = scoreFn(sh.rows || [], name);
      for (const p of preferNames) {
        if (name.includes(p)) score += 50;
      }
      if (score > bestScore) {
        bestScore = score;
        best = sh;
      }
    }
    return best;
  }

  async function importArrivalFile(file) {
    const j = await uploadParse(file);
    const sh = pickBestSheet(j.sheets, ["鴻安", "進櫃", "115", "紀錄"], (rows, name) => {
      if (/chart/i.test(name)) return -100;
      const hi = findHeaderRow(rows, ["編號", "櫃號"]);
      const hasUnpack = hi >= 0 && String((rows[hi] || []).join("|")).includes("拆櫃");
      return hi >= 0 ? (hasUnpack ? 40 : 10) + Math.min(rows.length, 200) : 0;
    });
    if (!sh) throw new Error("找不到進庫／進櫃紀錄工作表");
    const list = parseArrivalSheet(sh.rows || []);
    if (!list.length) throw new Error("進庫紀錄沒有讀到列");
    ensureState();
    const by = new Map(state.importArrivals.map((c) => [c.uha, c]));
    for (const row of list) {
      const prev = by.get(row.uha);
      if (prev) Object.assign(prev, { ...row, id: prev.id });
      else {
        by.set(row.uha, row);
        state.importArrivals.push(row);
      }
      stampRow(by.get(row.uha));
    }
    // 已入庫者從「未放行查驗」拿掉（標為已處理／不顯示港口）
    syncPortPendingAfterArrival();
    if (typeof save === "function") save();
    return list.length;
  }

  async function importCabinetFile(file) {
    const j = await uploadParse(file);
    const sh = pickBestSheet(j.sheets, ["進櫃", "櫃表", "115"], (rows) => {
      const hi = findHeaderRow(rows, ["編號"]);
      return hi >= 0 ? 10 + Math.min(rows.length, 200) : 0;
    });
    if (!sh) throw new Error("找不到進櫃表工作表");
    const list = parseCabinetSheet(sh.rows || []);
    if (!list.length) throw new Error("進櫃表沒有讀到貨櫃列");
    ensureState();
    const by = new Map(state.importCabinets.map((c) => [c.uha, c]));
    for (const row of list) {
      const prev = by.get(row.uha);
      if (prev) Object.assign(prev, { ...row, id: prev.id });
      else {
        by.set(row.uha, row);
        state.importCabinets.push(row);
      }
      stampRow(by.get(row.uha));
    }
    syncPortPendingAfterArrival();
    if (typeof save === "function") save();
    return list.length;
  }

  /** 進櫃表 − 已拆卸進庫 = 港口查驗待確認 */
  function syncPortPendingAfterArrival() {
    ensureState();
    if (!Array.isArray(state.importReleased)) state.importReleased = [];
    const arrived = arrivalByUha();
    const byRel = releasedByUha();
    for (const c of state.importCabinets || []) {
      if (!c.uha) continue;
      if (arrived.has(c.uha)) continue;
      let row = byRel.get(c.uha);
      if (!row) {
        row = ensureTrackFromCabinet(c);
        byRel.set(c.uha, row);
      }
      ensureClearanceShape(row);
      if (row.released) continue;
      row.released = false;
      row.portConfirm = "pending";
      if (!row.product && c.product) row.product = c.product;
      if (!row.containerNo && c.containerNo) row.containerNo = c.containerNo;
      stampRow(row);
    }
  }

  async function loadImportSeedJson() {
    const r = await fetch("./public-import-seed.json?v=" + Date.now());
    const j = await r.json();
    if (!j || !Array.isArray(j.importCabinets)) throw new Error("種子檔無效");
    ensureState();
    state.importCabinets = j.importCabinets;
    state.importArrivals = j.importArrivals || [];
    state.importReleased = j.importReleased || [];
    syncPortPendingAfterArrival();
    if (typeof save === "function") save();
    return j.counts || {
      cabinets: state.importCabinets.length,
      arrivals: state.importArrivals.length,
      portPending: portPendingList().length,
    };
  }

  async function importReleasedFile(file) {
    const j = await uploadParse(file);
    const sh = pickBestSheet(j.sheets, ["已放行", "放行"], (rows, name) => {
      if (/放行/.test(name)) return 30 + Math.min(rows.length, 100);
      return Math.min(rows.length, 50);
    });
    if (!sh) throw new Error("找不到已放行工作表");
    const list = parseReleasedSheet(sh.rows || []);
    if (!list.length) throw new Error("已放行沒有讀到 UHA");
    ensureState();
    const by = new Map(state.importReleased.map((c) => [c.uha, c]));
    for (const row of list) {
      const prev = by.get(row.uha);
      if (prev) {
        ensureClearanceShape(prev);
        prev.containerNo = row.containerNo || prev.containerNo;
        prev.note = row.note || prev.note;
        if (row.product) prev.product = row.product;
        if (row.trailer && !prev.trailer) prev.trailer = row.trailer;
        if (row.dock && !prev.dock) prev.dock = row.dock;
        prev.askPickup = true;
        prev.ft = row.ft || prev.ft;
        prev.released = true;
        prev.arrangeMonday = true;
        prev.fromReleasedExcel = true;
        // 藥檢／煙燻不覆寫
        stampRow(prev);
      } else {
        by.set(row.uha, row);
        state.importReleased.push(row);
        stampRow(row);
      }
    }
    if (typeof save === "function") save();
    return list.length;
  }

  function exportSumExcel() {
    ensureState();
    const rows = state.importArrivals;
    if (!rows.length) {
      if (typeof setStatus === "function") setStatus("沒有進櫃明細可匯出。", true);
      return;
    }
    const headers = [
      "拆櫃日",
      "編號",
      "賣方",
      "買方",
      "櫃號",
      "產品",
      "外箱",
      "貨況",
      "規格",
      "卸貨點",
      "報關數量",
      "拆櫃數量",
      "售價",
      "送檢",
      "報關單號碼",
      "通知號碼",
    ];
    const lines = rows.map((a) => [
      a.day,
      a.uha,
      a.seller,
      a.buyer,
      a.containerNo,
      a.product,
      a.outerBox,
      a.condition,
      a.spec,
      a.unload,
      a.customsQty,
      a.unpackQty,
      a.price,
      a.inspect,
      a.customsNo,
      a.noticeNo,
    ]);
    if (typeof downloadCsv === "function") {
      downloadCsv(`拆櫃總明細_${typeof today === "function" ? today() : ""}`, headers, lines);
      if (typeof setStatus === "function") setStatus("已匯出 Excel，用 Excel 開啟即可。");
    }
  }

  /** rows: string[][] 或 { cells, attrs }[] */
  function tableHtml(headers, rows) {
    if (!rows.length) return `<p class="empty">目前沒有資料。</p>`;
    const head = headers.map((h) => `<th>${esc(h)}</th>`).join("");
    const body = rows
      .map((r) => {
        const cells = Array.isArray(r) ? r : r.cells || [];
        const attrs = Array.isArray(r) ? "" : r.attrs || "";
        const tds = cells.map((c) => `<td>${esc(c == null ? "" : String(c))}</td>`).join("");
        return `<tr ${attrs}>${tds}</tr>`;
      })
      .join("");
    return `<div class="imp-table-wrap"><table class="imp-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function filesPanel() {
    return `<section class="imp-files">
      <p class="imp-one-hint">比對不準時，請下載空白格式自行填寫後匯入；或到「海關查驗」手動新增。</p>
      <div class="imp-file-grid">
        <button type="button" class="imp-file-btn" data-imp-dl-tpl="port">下載：港口查驗格式</button>
        <button type="button" class="imp-file-btn" data-imp-dl-tpl="released">下載：已放行格式</button>
        <button type="button" class="imp-file-btn" data-imp-dl-tpl="arrival">下載：進庫格式</button>
        <label class="imp-file-btn">匯入港口查驗<input type="file" accept=".xlsx,.xls,.csv" data-imp-file="tpl-port" /></label>
        <label class="imp-file-btn">匯入已放行<input type="file" accept=".xlsx,.xls,.csv" data-imp-file="tpl-released" /></label>
        <label class="imp-file-btn primary">匯入進庫<input type="file" accept=".xlsx,.xls,.csv" data-imp-file="tpl-arrival" /></label>
        <label class="imp-file-btn">舊進櫃表<input type="file" accept=".xlsx,.xls" data-imp-file="cabinet" /></label>
        <label class="imp-file-btn">舊進庫紀錄<input type="file" accept=".xlsx,.xls" data-imp-file="arrival" /></label>
        <label class="imp-file-btn">舊已放行<input type="file" accept=".xlsx,.xls" data-imp-file="released" /></label>
        <button type="button" class="imp-file-btn" data-imp-load-seed>載入115比對種子</button>
      </div>
      <p class="imp-file-meta" id="imp-file-meta"></p>
    </section>`;
  }

  const TPL = {
    port: {
      name: "港口查驗_匯入格式",
      headers: [
        "編號",
        "櫃號",
        "到港日",
        "品名",
        "件數",
        "賣方",
        "藥檢",
        "藥檢時間",
        "薰蒸",
        "薰蒸時間",
        "碼頭",
        "缺電放",
        "缺資料",
        "拖車",
        "拖車電話",
        "備註",
        "已放行",
      ],
      sample: [
        ["UHA715", "EMCU5743731", "2026-09-20", "泰國青花", "1206", "龍德-辛", "無", "", "進行中", "2026-09-22 09:00", "油二", "是", "否", "彬", "", "抽中薰蒸", "否"],
        ["UHA716", "EMCU5701119", "2026-09-20", "泰國青花", "1206", "龍德-辛", "無", "", "無", "", "", "否", "否", "", "", "", "是"],
      ],
      hint: "編號＝UHA 或 NC。藥檢／薰蒸：待確認、需要藥檢／需要薰蒸、完成、無須檢驗。缺電放／缺資料：是＝需通知廠商。已放行：是／否。",
    },
    released: {
      name: "已放行_匯入格式",
      headers: ["編號", "櫃號", "品名", "藥檢", "藥檢時間", "薰蒸", "薰蒸時間", "碼頭", "缺電放", "缺資料", "拖車", "拖車電話", "備註"],
      sample: [["UHA668", "EMCU5583470", "美生-1664", "待確認", "", "無須檢驗", "", "油二", "否", "否", "彬", "", "週六放行"]],
      hint: "編號＝UHA／NC；櫃號＝EMCU／FBIU…。整表視為已放行（未拆櫃）。藥檢／薰蒸：待確認、需要、完成、無須檢驗。",
    },
    arrival: {
      name: "進庫_匯入格式",
      headers: ["拆櫃日", "編號", "櫃號", "產品", "賣方", "買方", "報關數量", "拆櫃數量", "卸貨點"],
      sample: [["2026-09-18", "UHA668", "EMCU5583470", "越南美生", "龍鏻-同同", "鴻安", "1664", "1664", "冰庫"]],
      hint: "編號＝UHA／NC；櫃號＝EMCU／FBIU…。拆櫃日＝實際拆卸入庫日（不是到港日）。",
    },
  };

  function mapClearStatus(v) {
    const s = String(v || "")
      .trim()
      .toLowerCase();
    if (!s || s === "無" || s === "none" || s === "-" || s === "—" || s === "n/a" || s === "待確認") return "none";
    if (
      s === "進行中" ||
      s === "wait" ||
      s === "藥檢中" ||
      s === "薰蒸中" ||
      s === "排程中" ||
      s === "需要" ||
      s === "需要藥檢" ||
      s === "需要薰蒸"
    )
      return "wait";
    if (s === "完成" || s === "done" || s === "已完成" || s === "結束") return "done";
    if (s === "免辦" || s === "skip" || s === "免" || s === "不需" || s === "無須檢驗" || s === "无须检验") return "skip";
    return "none";
  }

  function mapYes(v) {
    const s = String(v || "")
      .trim()
      .toLowerCase();
    return s === "是" || s === "y" || s === "yes" || s === "1" || s === "true" || s === "已放行";
  }

  function normalizeAtInput(v) {
    const s = String(v || "").trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})/);
    if (m) return `${m[1]}T${String(m[2]).padStart(2, "0")}:${m[3]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00`;
    return s.slice(0, 16);
  }

  function downloadImportTemplate(kind) {
    const tpl = TPL[kind];
    if (!tpl) return false;
    const day = typeof today === "function" ? today() : new Date().toISOString().slice(0, 10);
    if (typeof downloadCsv === "function") {
      downloadCsv(`${tpl.name}_${day}`, tpl.headers, tpl.sample);
    } else {
      const body = [tpl.headers, ...tpl.sample].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
      const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${tpl.name}_${day}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    if (typeof setStatus === "function") setStatus(`已下載「${tpl.name}」。${tpl.hint}`);
    return true;
  }

  function upsertCabinetFromTpl(row) {
    ensureState();
    let uha = normUha(row.uha);
    if (!uha && (row.containerNo || row.product || row.arriveDay)) uha = makePendingUha();
    if (!uha) return null;
    let cab = (state.importCabinets || []).find((c) => c.uha === uha);
    if (!cab) {
      cab = {
        id: uid("cab"),
        uha,
        containerNo: "",
        arriveDay: "",
        product: "",
        qty: 0,
        seller: "",
        shipCo: "",
        broker: "",
      };
      state.importCabinets.push(cab);
    }
    if (row.containerNo) cab.containerNo = normContainer(row.containerNo);
    if (row.arriveDay) cab.arriveDay = parseDay(row.arriveDay);
    if (row.product) cab.product = String(row.product).trim();
    if (row.qty != null && row.qty !== "") cab.qty = Number(row.qty) || cab.qty || 0;
    if (row.seller) cab.seller = String(row.seller).trim();
    if (row.shipCo) cab.shipCo = String(row.shipCo).trim();
    if (row.broker) cab.broker = String(row.broker).trim();
    stampRow(cab);
    return cab;
  }

  function applyTrackFromTpl(uha, row, asReleased) {
    const cab = (state.importCabinets || []).find((c) => c.uha === uha) || { uha, containerNo: row.containerNo || "", product: row.product || "" };
    const track = ensureTrackFromCabinet(cab);
    ensureClearanceShape(track);
    if (row.inspect != null && row.inspect !== "") track.inspect = mapClearStatus(row.inspect);
    if (row.inspectAt != null) track.inspectAt = normalizeAtInput(row.inspectAt);
    if (row.fumigate != null && row.fumigate !== "") track.fumigate = mapClearStatus(row.fumigate);
    if (row.fumigateAt != null) track.fumigateAt = normalizeAtInput(row.fumigateAt);
    if (row.dock != null) track.dock = String(row.dock || "").trim();
    if (row.missingTelex != null && row.missingTelex !== "") track.missingTelex = mapYes(row.missingTelex);
    if (row.missingData != null && row.missingData !== "") track.missingData = mapYes(row.missingData);
    if (row.missingDocs != null && row.missingDocs !== "" && mapYes(row.missingDocs)) {
      track.missingTelex = true;
      track.missingData = true;
    }
    if (row.trailer != null) track.trailer = String(row.trailer || "").trim();
    if (row.trailerPhone != null) track.trailerPhone = String(row.trailerPhone || "").trim();
    if (row.note != null) track.note = String(row.note || "").trim();
    if (asReleased || mapYes(row.released)) {
      track.released = true;
      track.portConfirm = "done";
      track.askPickup = true;
      track.arrangeMonday = true;
      track.fromReleasedExcel = true;
      if (!track.releasedAt) track.releasedAt = new Date().toISOString().slice(0, 16);
    } else if (track.released !== true) {
      track.released = false;
      track.portConfirm = "pending";
    }
    stampRow(track);
    return track;
  }

  function parseTplPortRows(rows) {
    const hi = findHeaderRow(rows, ["編號", "櫃號"]);
    if (hi < 0) return [];
    const h = rows[hi];
    const i = (names) => colIndex(h, names);
    const out = [];
    for (let r = hi + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      let uha = normUha(cell(row, i(["編號"])));
      const containerNo = cell(row, i(["櫃號"]));
      const product = cell(row, i(["品名", "產品"]));
      const arriveDay = cell(row, i(["到港日", "日期"]));
      if (!uha && !normContainer(containerNo) && !String(product || "").trim()) continue;
      out.push({
        uha: uha || "",
        containerNo,
        arriveDay,
        product,
        qty: cell(row, i(["件數"])),
        seller: cell(row, i(["賣方"])),
        shipCo: cell(row, i(["船公司"])),
        broker: cell(row, i(["報關行"])),
        inspect: cell(row, i(["藥檢"])),
        inspectAt: cell(row, i(["藥檢時間", "藥檢報告時間", "報告時間"])),
        fumigate: cell(row, i(["薰蒸"])),
        fumigateAt: cell(row, i(["薰蒸時間"])),
        dock: cell(row, i(["碼頭"])),
        missingTelex: cell(row, i(["缺電放"])),
        missingData: cell(row, i(["缺資料"])),
        missingDocs: cell(row, i(["缺電放缺資料"])),
        trailer: cell(row, i(["拖車"])),
        trailerPhone: cell(row, i(["拖車電話"])),
        note: cell(row, i(["備註"])),
        released: cell(row, i(["已放行"])),
      });
    }
    return out;
  }

  async function importTemplateFile(file, kind) {
    const j = await uploadParse(file);
    const sh = (j.sheets && j.sheets[0]) || null;
    if (!sh) throw new Error("找不到工作表");
    const rows = sh.rows || [];
    ensureState();
    let added = 0;
    let updated = 0;
    let skipped = 0;
    if (kind === "port" || kind === "tpl-port") {
      const list = parseTplPortRows(rows);
      if (!list.length) throw new Error("港口查驗格式沒有讀到資料（請用下載的表頭：編號／櫃號）");
      for (const row of list) {
        const existed = normUha(row.uha) && (state.importCabinets || []).some((c) => c.uha === normUha(row.uha));
        const cab = upsertCabinetFromTpl(row);
        if (!cab) {
          skipped += 1;
          continue;
        }
        applyTrackFromTpl(cab.uha, row, false);
        if (existed) updated += 1;
        else added += 1;
      }
    } else if (kind === "released" || kind === "tpl-released") {
      const list = parseTplPortRows(rows);
      if (!list.length) throw new Error("已放行格式沒有讀到資料");
      for (const row of list) {
        const existed = normUha(row.uha) && (state.importCabinets || []).some((c) => c.uha === normUha(row.uha));
        const cab = upsertCabinetFromTpl(row);
        if (!cab) {
          skipped += 1;
          continue;
        }
        applyTrackFromTpl(cab.uha, row, true);
        if (existed) updated += 1;
        else added += 1;
      }
    } else if (kind === "arrival" || kind === "tpl-arrival") {
      const hi = findHeaderRow(rows, ["編號"]);
      if (hi < 0) throw new Error("進庫格式沒有讀到編號（請用下載的表頭）");
      const h = rows[hi];
      const iDay = colIndex(h, ["拆櫃日", "日期"]);
      const iUha = colIndex(h, ["編號"]);
      const iCont = colIndex(h, ["櫃號"]);
      const iProd = colIndex(h, ["產品", "品名"]);
      const iSeller = colIndex(h, ["賣方"]);
      const iBuyer = colIndex(h, ["買方"]);
      const iCus = colIndex(h, ["報關數量"]);
      const iUnp = colIndex(h, ["拆櫃數量"]);
      const iUnload = colIndex(h, ["卸貨點"]);
      const list = [];
      for (let r = hi + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const uha = normUha(cell(row, iUha));
        if (!uha) {
          skipped += 1;
          continue;
        }
        list.push({
          id: uid("arr"),
          uha,
          containerNo: normContainer(cell(row, iCont)),
          day: parseDay(cell(row, iDay)),
          seller: String(cell(row, iSeller) || "").trim(),
          buyer: String(cell(row, iBuyer) || "").trim(),
          product: String(cell(row, iProd) || "").trim(),
          customsQty: cell(row, iCus),
          unpackQty: cell(row, iUnp),
          unload: String(cell(row, iUnload) || "").trim(),
        });
      }
      if (!list.length) throw new Error("進庫格式沒有讀到資料");
      const by = new Map((state.importArrivals || []).map((a) => [a.uha, a]));
      for (const row of list) {
        const prev = by.get(row.uha);
        if (prev) {
          Object.assign(prev, { ...row, id: prev.id });
          stampRow(prev);
          updated += 1;
        } else {
          by.set(row.uha, row);
          state.importArrivals.push(row);
          stampRow(row);
          added += 1;
        }
      }
      syncPortPendingAfterArrival();
    } else {
      throw new Error("未知匯入類型");
    }
    if (typeof save === "function") save();
    const total = added + updated;
    return { added, updated, skipped, total, n: total };
  }

  /** 海關查驗：手動新增一筆（編號可後補） */
  function addManualPortRow(fields) {
    ensureState();
    let uha = normUha(fields && fields.uha);
    if (!uha) uha = makePendingUha();
    const row = {
      uha,
      containerNo: (fields && fields.containerNo) || "",
      arriveDay: (fields && fields.arriveDay) || (typeof today === "function" ? today() : ""),
      product: (fields && fields.product) || "",
      qty: (fields && fields.qty) || "",
      seller: (fields && fields.seller) || "",
      inspect: (fields && fields.inspect) || "none",
      inspectAt: (fields && fields.inspectAt) || "",
      fumigate: (fields && fields.fumigate) || "none",
      fumigateAt: (fields && fields.fumigateAt) || "",
      dock: (fields && fields.dock) || "",
      trailer: (fields && fields.trailer) || "",
      trailerPhone: (fields && fields.trailerPhone) || "",
      note: (fields && fields.note) || "",
      released: (fields && fields.released) || "否",
    };
    upsertCabinetFromTpl(row);
    applyTrackFromTpl(uha, row, false);
    if (typeof save === "function") save();
    if (typeof setStatus === "function") {
      setStatus(isPendingUha(uha) ? `已新增（編號待補）${row.containerNo ? " · " + row.containerNo : ""}` : `已新增 ${uha}。`);
    }
    return true;
  }

  function templateMeta() {
    return {
      port: { ...TPL.port, sample: undefined },
      released: { ...TPL.released, sample: undefined },
      arrival: { ...TPL.arrival, sample: undefined },
    };
  }

  function formatAtShort(v) {
    const s = String(v || "");
    if (!s) return "—";
    return s.replace("T", " ").slice(0, 16);
  }

  function portWaitingList() {
    ensureState();
    fixArriveDaysInState();
    const rel = releasedByUha();
    return portPendingList()
      .filter((c) => !rel.has(c.uha) || rel.get(c.uha).released === false)
      .map((c) => {
        const track = ensureTrackFromCabinet(c);
        ensureClearanceShape(track);
        return { ...c, track };
      });
  }

  function portStatusLabel(track) {
    if (track.inspect === "wait") return "需要藥檢";
    if (track.fumigate === "wait") return "需要薰蒸";
    if (track.inspect === "skip" && track.fumigate === "skip") return "無須檢驗";
    if (track.portConfirm === "pending" || track.released === false) return "待確認";
    return "待確認";
  }

  function portTabCounts() {
    const all = portWaitingList();
    return {
      open: all.length,
      inspect: all.filter((c) => c.track.inspect === "wait").length,
      fume: all.filter((c) => c.track.fumigate === "wait").length,
    };
  }

  let portListTab = "open"; // open | inspect | fume

  function renderPort(body) {
    const all = portWaitingList();
    const s = portTabCounts();
    let list = all;
    if (portListTab === "inspect") list = all.filter((c) => c.track.inspect === "wait");
    else if (portListTab === "fume") list = all.filter((c) => c.track.fumigate === "wait");
    else portListTab = "open";

    const rows = list.map((c) => {
      const t = c.track;
      return {
        cells: [
          c.arriveDay || "—",
          c.uha,
          c.containerNo || "（尚無櫃號）",
          c.product || "—",
          clearLab(t.inspect),
          formatAtShort(t.inspectAt),
          clearLab(t.fumigate),
          formatAtShort(t.fumigateAt),
          portStatusLabel(t),
        ],
        attrs: `data-imp-open="port" data-imp-key="${esc(c.uha)}" class="imp-row-click"`,
      };
    });

    const emptyHint = !all.length
      ? `<p class="hint">目前沒有到港待驗資料。</p>`
      : list.length
        ? ""
        : `<p class="hint">此篩選沒有項目（海關查驗共 ${all.length} 筆）。</p>`;

    body.innerHTML = `
      <div class="imp-filter-row" role="tablist" aria-label="海關查驗篩選">
        <button type="button" class="imp-filter${portListTab === "open" ? " is-on" : ""}" data-imp-port-tab="open">全部 ${s.open}</button>
        <button type="button" class="imp-filter${portListTab === "inspect" ? " is-on" : ""}" data-imp-port-tab="inspect">藥檢中 ${s.inspect}</button>
        <button type="button" class="imp-filter${portListTab === "fume" ? " is-on" : ""}" data-imp-port-tab="fume">薰蒸排程中 ${s.fume}</button>
      </div>
      <p class="imp-one-hint">未放行。抽到藥檢／需薰蒸在此登錄狀態與時間；時間出來後接近 FT 排領櫃，報告／排程完成再標示放行。</p>
      ${emptyHint || tableHtml(["到港日", "編號", "櫃號", "品名", "藥檢", "藥檢時間", "薰蒸", "薰蒸時間", "狀態"], rows)}`;
  }

  /** 資料放行：已放行(未拆櫃)；依 FT＋藥檢／煙燻結束時間安排拆櫃 */
  function releaseWorkList() {
    ensureState();
    const cab = new Map((state.importCabinets || []).map((c) => [c.uha, c]));
    const arr = arrivalByUha();
    return (state.importReleased || [])
      .filter((r) => r.uha && !arr.has(r.uha) && r.released !== false)
      .map((r) => {
        ensureClearanceShape(r);
        if (r.fromReleasedExcel || r.arrangeMonday) r.released = true;
        const c = cab.get(r.uha);
        const endAt = clearEndAt(r);
        const arrangeOk = isArrangeReady(r);
        const pickup = arrangeOk || !!r.pickupReady;
        const checking = r.inspect === "wait" || r.fumigate === "wait";
        return {
          ...r,
          product: r.product || (c && c.product) || "",
          seller: (c && c.seller) || "",
          broker: (c && c.broker) || "",
          arriveDay: fixCenturyDay((c && c.arriveDay) || r.arriveDay || ""),
          endAt,
          pickup,
          checking,
          /** 已放行／查驗完成，尚待依結束時間安排拆櫃 */
          arranging: !!r.released && !pickup,
          arrangeOk,
        };
      })
      .sort((a, b) => {
        // 依藥檢／煙燻結束時間排；無時間者在後
        const ta = a.endAt || "9999";
        const tb = b.endAt || "9999";
        if (ta !== tb) return ta < tb ? -1 : 1;
        return String(a.arriveDay || "").localeCompare(String(b.arriveDay || ""));
      });
  }

  function releaseStats(list) {
    const all = list || releaseWorkList();
    return {
      total: all.length,
      /** 待排＝尚未可排（含藥檢／煙燻進行中） */
      arrange: all.filter((x) => !x.pickup).length,
      check: all.filter((x) => x.checking).length,
      pickup: all.filter((x) => x.pickup).length,
    };
  }

  function clearSelectHtml(field, value) {
    const opts = clearOptsFor(field === "fumigate" ? "fumigate" : "inspect");
    return `<select class="imp-clear-sel" data-imp-clear-field="${esc(field)}">${opts
      .map((o) => `<option value="${o.id}"${o.id === value ? " selected" : ""}>${esc(o.lab)}</option>`)
      .join("")}</select>`;
  }

  function datetimeInputValue(v) {
    const s = String(v || "");
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T09:00`;
    return "";
  }

  function releaseStatusLabel(c) {
    if (c.pickup) return "可排拆櫃";
    if (c.checking) return "待排（藥檢／薰蒸中）";
    return "待排拆櫃";
  }

  function formatFtLabel(c) {
    const at = String((c && c.ftAt) || "").trim();
    if (at) {
      if (/^\d{4}-\d{2}-\d{2}/.test(at)) return at.slice(0, 10).replace(/^(\d{4})-(\d{2})-(\d{2})/, "$1/$2/$3");
      return at;
    }
    if (c && (c.ftConfirmed || c.ft)) return "已確認";
    return "—";
  }

  let releaseSortBy = "uha"; // uha | ft

  function sortReleaseList(list) {
    const arr = (list || []).slice();
    arr.sort((a, b) => {
      if (releaseSortBy === "ft") {
        const fa = formatFtLabel(a);
        const fb = formatFtLabel(b);
        const ka = !fa || fa === "—" ? "9999" : fa === "已確認" ? "0000" : fa;
        const kb = !fb || fb === "—" ? "9999" : fb === "已確認" ? "0000" : fb;
        if (ka !== kb) return ka < kb ? -1 : 1;
      }
      return String(a.uha || "").localeCompare(String(b.uha || ""), "en", { numeric: true });
    });
    return arr;
  }

  function renderRelease(body) {
    ensureState();
    fixArriveDaysInState();
    const all = releaseWorkList();
    const s = releaseStats(all);
    let list = all;
    if (releaseListTab === "pickup") list = all.filter((x) => x.pickup);
    else if (releaseListTab === "arrange" || releaseListTab === "check") {
      releaseListTab = "arrange";
      list = all.filter((x) => !x.pickup);
    } else releaseListTab = "open";
    list = sortReleaseList(list);

    const rows = list.map((c) => ({
      cells: [c.uha, c.containerNo || "—", formatFtLabel(c)],
      attrs: `data-imp-open="release" data-imp-key="${esc(c.uha)}" class="imp-row-click${c.pickup ? " is-ready" : ""}"`,
    }));

    const emptyHint = !all.length
      ? `<p class="hint">尚無已放行資料。請匯入「已放行」Excel，或從海關查驗標示放行。</p>`
      : list.length
        ? ""
        : `<p class="hint">此篩選沒有項目（已放行共 ${all.length} 筆）。</p>`;

    body.innerHTML = `
      <div class="imp-filter-row" role="tablist" aria-label="放行篩選">
        <button type="button" class="imp-filter${releaseListTab === "open" ? " is-on" : ""}" data-imp-rel-tab="open">全部 ${s.total}</button>
        <button type="button" class="imp-filter${releaseListTab === "arrange" ? " is-on" : ""}" data-imp-rel-tab="arrange">待排拆櫃 ${s.arrange}</button>
        <button type="button" class="imp-filter${releaseListTab === "pickup" ? " is-on" : ""}" data-imp-rel-tab="pickup">可排拆櫃 ${s.pickup}</button>
      </div>
      <div class="imp-filter-row" role="group" aria-label="排序">
        <span class="imp-one-hint" style="margin:0">排序</span>
        <button type="button" class="imp-filter${releaseSortBy === "uha" ? " is-on" : ""}" data-imp-rel-sort="uha">編號</button>
        <button type="button" class="imp-filter${releaseSortBy === "ft" ? " is-on" : ""}" data-imp-rel-sort="ft">FT</button>
      </div>
      <p class="imp-one-hint">已放行未拆櫃：編號、貨櫃號碼、FT（不顯示到港日）。</p>
      ${emptyHint || tableHtml(["編號", "貨櫃號碼", "FT"], rows)}`;
  }

  function findReleased(uha) {
    ensureState();
    return (state.importReleased || []).find((x) => x.uha === uha);
  }

  function patchReleased(uha, field, value) {
    const row = findReleased(uha);
    if (!row) return;
    ensureClearanceShape(row);
    if (field === "released") row.released = Boolean(value);
    else if (field === "ftConfirmed") {
      row.ftConfirmed = Boolean(value);
      if (row.ftConfirmed) row.ft = true;
    } else if (field === "pickupReady") row.pickupReady = Boolean(value);
    else if (field === "missingDocs") {
      row.missingDocs = Boolean(value);
      if (row.missingDocs) {
        row.missingTelex = true;
        row.missingData = true;
      }
    } else if (field === "missingTelex") row.missingTelex = Boolean(value);
    else if (field === "missingData") row.missingData = Boolean(value);
    else if (field === "notifyTrailer") row.notifyTrailer = Boolean(value);
    else if (field === "notifyCustomer") row.notifyCustomer = Boolean(value);
    else if (field === "notifyUnpacker") row.notifyUnpacker = Boolean(value);
    else if (field === "inspect" || field === "fumigate") {
      row[field] = value || "none";
      if (field === "inspect") row.inspectManual = true;
      else row.fumigateManual = true;
    } else if (field === "inspectAt" || field === "fumigateAt" || field === "ftAt" || field === "unpackAt") row[field] = value || "";
    else if (field === "pickupDay") {
      const d = String(value || "").trim();
      row.pickupDay = /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : "";
    } else if (
      field === "customsNo" ||
      field === "note" ||
      field === "trailer" ||
      field === "dock" ||
      field === "trailerPhone" ||
      field === "trailerNote" ||
      field === "product" ||
      field === "containerNo"
    )
      row[field] = String(value || "").trim();
    if (field === "ftAt" && row.ftAt) {
      row.ft = true;
      row.ftConfirmed = true;
    }
    stampRow(row);
    if (typeof save === "function") save();
  }

  function unpackDayFromAt(unpackAt) {
    const s = String(unpackAt || "");
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return "";
  }

  /** 已放行排程 → 貨櫃拆卸資料（可半櫃兩筆） */
  function dispatchToUnpackBoard(row) {
    ensureState();
    if (!row || !row.uha) return false;
    if (!Array.isArray(state.unpackJobs)) state.unpackJobs = [];
    ensureClearanceShape(row);
    if (!String(row.trailer || "").trim()) {
      if (typeof setStatus === "function") setStatus("請先確認放行拖車再派送。", true);
      return false;
    }
    if (!row.unpackAt) {
      try {
        row.unpackAt = new Date().toISOString().slice(0, 16);
      } catch (_) {
        row.unpackAt = typeof today === "function" ? `${today()}T08:00` : "";
      }
    }
    const day = unpackDayFromAt(row.unpackAt) || (typeof today === "function" ? today() : "");
    if (!day) {
      if (typeof setStatus === "function") setStatus("請先填拆卸日期時間再派送。", true);
      return false;
    }
    const base = {
      day,
      box: row.uha,
      name: row.product || "",
      codes: row.containerNo ? [row.containerNo] : [],
      trailer: row.trailer || "",
      trailerPhone: row.trailerPhone || "",
      /** 電話可到拆櫃時再核；此處僅記拖車窗口已確認 */
      trailerConfirmed: false,
      trailerNote: row.trailerNote || "",
      unpackAt: row.unpackAt || "",
      destType: row.destType || "coldstore",
      location: row.unpackSite || row.dock || "",
      unloadPoint: row.unpackSite || row.dock || "",
      sourceUha: row.uha,
      fromRelease: true,
      status: "pending",
    };

    function upsertPart(part, assignee, assignQty, location) {
      const idKey = `${row.uha}__${part}`;
      let j = state.unpackJobs.find((x) => x.dispatchKey === idKey || (x.sourceUha === row.uha && x.halfPart === part));
      if (!j) {
        j = {
          id: uid("up"),
          printKey: idKey,
          dispatchKey: idKey,
          halfPart: part,
          ...blankUnpackJob(),
          ...base,
        };
        state.unpackJobs.push(j);
      }
      Object.assign(j, base, {
        assignee: assignee || "",
        assignQty: assignQty === "" || assignQty == null ? null : Number(assignQty),
        location: location || "",
        unloadPoint: location || "",
        status: j.status === "reported" || j.status === "confirmed" ? j.status : "pending",
      });
      if (!Number.isFinite(j.assignQty)) j.assignQty = null;
      return j;
    }

    upsertPart("1", row.assignee, row.assignQty, row.unpackSite || row.dock || "");
    if (row.halfSplit) {
      upsertPart("2", row.assignee2, row.assignQty2, row.unpackSite2 || row.dock || "");
    } else {
      state.unpackJobs = state.unpackJobs.filter((x) => !(x.sourceUha === row.uha && x.halfPart === "2"));
    }
    row.dispatched = true;
    row.pickupReady = true;
    stampRow(row);
    if (typeof setStatus === "function") setStatus(`${row.uha} 已派送至貨櫃拆卸資料（電話可於拆櫃時再確認）。`);
    return true;
  }

  /** 已放行：確認領櫃（需先有拖車）→ 派送拆卸資料 */
  function confirmReleasePickup(uha) {
    ensureState();
    const row = findReleased(uha);
    if (!row) {
      if (typeof setStatus === "function") setStatus("找不到此櫃。", true);
      return false;
    }
    ensureClearanceShape(row);
    if (!String(row.trailer || "").trim()) {
      if (typeof setStatus === "function") setStatus("請先確認放行拖車再領櫃派送。", true);
      return false;
    }
    const ok = dispatchToUnpackBoard(row);
    if (ok && typeof save === "function") save();
    return ok;
  }

  function trailerNames() {
    ensureState();
    const set = new Set();
    for (const r of state.importReleased || []) {
      const t = String(r.trailer || "").trim();
      if (t) set.add(t);
    }
    for (const a of state.importArrivals || []) {
      // no trailer usually
    }
    ["彬", "旭", "瑋", "瑋菘", "偉菘", "尚鴻", "旭興", "斌"].forEach((n) => set.add(n));
    return [...set].sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }

  function blankUnpackJob() {
    return {
      qty: null,
      unpackQty: null,
      assignQty: null,
      reportBox: "",
      stockIn: true,
      location: "",
      customerName: "",
      customer: "",
      unloadPoint: "",
      photo: "",
      note: "",
      country: "",
      vendor: "",
      assignee: "",
    };
  }

  function markPortReleased(uha, opts) {
    ensureState();
    const quiet = !!(opts && opts.quiet);
    const cab = (state.importCabinets || []).find((c) => c.uha === uha);
    const track = cab ? ensureTrackFromCabinet(cab) : findReleased(uha);
    if (!track && !cab) {
      if (!quiet && typeof setStatus === "function") setStatus("找不到此櫃。", true);
      return false;
    }
    const row = track || ensureTrackFromCabinet({ uha, containerNo: "", product: "" });
    ensureClearanceShape(row);
    row.released = true;
    row.portConfirm = "done";
    row.askPickup = true;
    row.arrangeMonday = true;
    if (!row.releasedAt) {
      try {
        row.releasedAt = new Date().toISOString().slice(0, 16);
      } catch (_) {
        row.releasedAt = "";
      }
    }
    stampRow(row);
    if (typeof save === "function") save();
    if (quiet) return true;
    if (typeof setStatus === "function") setStatus(`${uha} 已標示放行（未拆櫃）。`);
    importPane = "release";
    if (typeof window.mountImportApp === "function" && document.querySelector("#import-root .imp-tw")) {
      return true;
    }
    openDrawer("release", uha);
    syncShellChrome(importPane);
    renderMainBody();
    return true;
  }

  /** 批次標示已放行（海關查驗同畫面勾選） */
  function markPortReleasedMany(uhas) {
    const list = Array.isArray(uhas) ? [...new Set(uhas.filter(Boolean))] : [];
    if (!list.length) return 0;
    let n = 0;
    for (const u of list) {
      if (markPortReleased(u, { quiet: true })) n += 1;
    }
    if (typeof setStatus === "function") setStatus(`已標示放行 ${n} 櫃。`);
    return n;
  }

  /**
   * 誤標放行修正：退回海關查驗。
   * 已派送拆卸者不改（需先處理拆卸資料）。
   */
  function unmarkPortReleased(uha, opts) {
    ensureState();
    const quiet = !!(opts && opts.quiet);
    const row = findReleased(uha);
    if (!row) {
      if (!quiet && typeof setStatus === "function") setStatus("找不到此櫃。", true);
      return false;
    }
    ensureClearanceShape(row);
    if (row.dispatched) {
      if (!quiet && typeof setStatus === "function") setStatus(`${uha} 已派送拆卸，無法直接退回。`, true);
      return false;
    }
    row.released = false;
    row.portConfirm = "pending";
    row.askPickup = false;
    row.arrangeMonday = false;
    row.fromReleasedExcel = false;
    row.pickupReady = false;
    row.releasedAt = "";
    stampRow(row);
    if (typeof save === "function") save();
    if (!quiet && typeof setStatus === "function") setStatus(`${uha} 已退回海關查驗。`);
    return true;
  }

  function unmarkPortReleasedMany(uhas) {
    const list = Array.isArray(uhas) ? [...new Set(uhas.filter(Boolean))] : [];
    if (!list.length) return 0;
    let n = 0;
    let blocked = 0;
    for (const u of list) {
      const row = findReleased(u);
      if (row && row.dispatched) {
        blocked += 1;
        continue;
      }
      if (unmarkPortReleased(u, { quiet: true })) n += 1;
    }
    if (typeof setStatus === "function") {
      const extra = blocked ? `（${blocked} 櫃已派送未改）` : "";
      setStatus(`已退回海關查驗 ${n} 櫃${extra}。`);
    }
    return n;
  }

  function patchReleaseField(uha, field, value) {
    ensureState();
    const row = findReleased(uha);
    if (!row) return false;
    patchReleased(uha, field, value);
    /** 填拆工且有拖車 → 順便派工到拆卸資料 */
    if (field === "assignee" && String(value || "").trim() && !row.dispatched) {
      if (String(row.trailer || "").trim()) {
        if (!row.unpackSite && row.dock) row.unpackSite = row.dock;
        const ok = dispatchToUnpackBoard(row);
        if (ok && typeof save === "function") save();
        return ok ? "dispatched" : true;
      }
      if (typeof setStatus === "function") setStatus("已記拆工；請再填拖車後派送。", true);
    }
    return true;
  }

  function renderStock(body) {
    const list = stockList();
    const rows = list.map((a) => ({
      cells: [a.day, a.uha, a.containerNo, a.product, a.customsQty, a.unpackQty, a.unload, a.seller],
      attrs: `data-imp-open="stock" data-imp-key="${esc(a.uha)}" class="imp-row-click"`,
    }));
    body.innerHTML = `
      <p class="imp-one-hint">日期＝拆櫃日（進櫃紀錄）。海關／放行請看「到港日」。</p>
      ${tableHtml(["拆櫃日", "編號", "櫃號", "產品", "報關數量", "拆櫃數量", "卸貨點", "賣方"], rows)}`;
  }

  function renderSum(body) {
    ensureState();
    const rows = state.importArrivals.map((a) => ({
      cells: [a.day, a.uha, a.containerNo, a.product, a.customsQty, a.unpackQty, a.unload, a.customsNo],
      attrs: `data-imp-open="sum" data-imp-key="${esc(a.uha)}" class="imp-row-click"`,
    }));
    body.innerHTML = `
      <p class="imp-one-hint">日期＝拆櫃日。進櫃紀錄＝已拆櫃入公司倉庫（${rows.length}）。</p>
      ${tableHtml(["拆櫃日", "編號", "櫃號", "產品", "報關數量", "拆櫃數量", "卸貨點", "報關單"], rows)}`;
  }

  function renderFiles(body) {
    body.innerHTML = `
      <p class="imp-one-hint">舊資料批次匯入（平常請用「判讀」）。</p>
      ${filesPanel()}`;
    const s = boardStats();
    const meta = document.getElementById("imp-file-meta");
    if (meta) meta.textContent = `櫃表 ${s.total}　到港待驗 ${s.port}　已入庫 ${s.arrived}　已放行(未拆櫃) ${s.released}`;
  }

  function drawerHeader(title) {
    return `<div class="imp-drawer-head">
      <button type="button" class="imp-drawer-handle" data-imp-sheet-handle aria-label="下拉關閉"></button>
      <div class="imp-drawer-head-row">
        <strong class="imp-drawer-title">${esc(title)}</strong>
        <div class="imp-drawer-head-actions">
          <button type="button" class="ghost imp-mini-btn" data-imp-drawer-full>${drawerFull ? "結束完整編輯" : "完整編輯"}</button>
          <button type="button" class="ghost imp-mini-btn" data-imp-drawer-close aria-label="關閉">✕</button>
        </div>
      </div>
    </div>`;
  }

  function remoteBannerHtml() {
    if (!drawerSession || !drawerSession.remoteNewer) return "";
    return `<div class="imp-remote-banner" role="status">
      <span>遠端有較新資料；你正在輸入的內容尚未被覆蓋。</span>
      <button type="button" class="ghost imp-mini-btn" data-imp-draft-keep-remote>繼續編輯</button>
      <button type="button" class="ghost imp-mini-btn" data-imp-draft-reload-remote>改載入最新</button>
    </div>`;
  }

  function draftActionsHtml(extraButtons) {
    const dirty = !!(drawerSession && drawerSession.dirty);
    return `<div class="imp-drawer-actions">
      ${extraButtons || ""}
      <button type="button" class="primary" data-imp-draft-save ${dirty ? "" : "disabled"}>儲存</button>
      <button type="button" class="ghost" data-imp-draft-cancel>取消</button>
    </div>`;
  }

  function drawerDraftBody(i) {
    const d = drawerSession && drawerSession.fields ? drawerSession.fields : null;
    if (!d) return `<p class="empty">草稿不存在。</p>`;
    return `
      ${remoteBannerHtml()}
      <div class="imp-drawer-form" data-imp-draft="${i}">
        <label>編號 UHA <input type="text" data-imp-draft-f="uha" value="${esc(d.uha || "")}" /></label>
        <label>櫃號 <input type="text" data-imp-draft-f="containerNo" value="${esc(d.containerNo || "")}" /></label>
        <label>報關單號 <input type="text" data-imp-draft-f="customsNo" value="${esc(d.customsNo || "")}" /></label>
        <label>到港日 <input type="date" data-imp-draft-f="arriveDay" value="${esc(d.arriveDay || "")}" /></label>
        <label>品名 <input type="text" data-imp-draft-f="product" value="${esc(d.product || "")}" /></label>
        <label>報關行 <input type="text" data-imp-draft-f="broker" value="${esc(d.broker || "")}" /></label>
        ${draftActionsHtml(`
          <button type="button" class="primary" data-imp-draft-ok="${i}">確認列入海關查驗</button>
          <button type="button" class="ghost" data-imp-draft-drop="${i}">丟棄</button>
        `)}
      </div>`;
  }

  function drawerPortBody(uha) {
    const f = drawerSession && drawerSession.fields ? drawerSession.fields : null;
    if (!f) return `<p class="empty">找不到櫃 ${esc(uha)}。</p>`;
    return `
      ${remoteBannerHtml()}
      <div class="imp-drawer-form" data-imp-rel-uha="${esc(uha)}">
        <p class="imp-one-hint">${esc(f.product || "—")} · ${esc(f.containerNo || "尚無櫃號")} · 到港日 ${esc(f.arriveDay || "—")}。時間出來後接近 FT 排領櫃。</p>
        <label>藥檢 ${clearSelectHtml("inspect", f.inspect)}
          <span class="imp-field-sub">藥檢時間（報告時間）</span>
          <input type="datetime-local" data-imp-clear-field="inspectAt" value="${esc(datetimeInputValue(f.inspectAt))}" />
        </label>
        <label>薰蒸 ${clearSelectHtml("fumigate", f.fumigate)}
          <span class="imp-field-sub">薰蒸排定時間</span>
          <input type="datetime-local" data-imp-clear-field="fumigateAt" value="${esc(datetimeInputValue(f.fumigateAt))}" />
        </label>
        <label>碼頭
          <input type="text" data-imp-clear-field="dock" value="${esc(f.dock || "")}" placeholder="檢驗／卸貨碼頭" />
        </label>
        <label class="imp-rel-check"><input type="checkbox" data-imp-clear-field="missingTelex"${f.missingTelex ? " checked" : ""}/> 缺電放</label>
        <label class="imp-rel-check"><input type="checkbox" data-imp-clear-field="missingData"${f.missingData ? " checked" : ""}/> 缺資料</label>
        <p class="imp-field-sub">有缺再勾＝需通知廠商</p>
        <label>備註
          <input type="text" data-imp-clear-field="note" value="${esc(f.note || "")}" />
        </label>
        ${draftActionsHtml(`<button type="button" class="primary" data-imp-mark-release="${esc(uha)}">標示放行</button>`)}
      </div>`;
  }

  function drawerReleaseBody(uha) {
    const c = drawerSession && drawerSession.fields ? drawerSession.fields : null;
    if (!c) return `<p class="empty">找不到已放行資料 ${esc(uha)}。</p>`;
    return `
      ${remoteBannerHtml()}
      <div class="imp-drawer-form" data-imp-rel-uha="${esc(uha)}">
        <p class="imp-one-hint">已放行(未拆櫃)。與拖車確認拆卸位置與日期時間後可派送貨櫃拆卸資料。</p>
        <div class="imp-rel-checks">
          <label class="imp-rel-check"><input type="checkbox" data-imp-clear-field="ftConfirmed"${c.ftConfirmed ? " checked" : ""}/> 確認 FT</label>
          <label class="imp-rel-check"><input type="checkbox" data-imp-clear-field="pickupReady"${c.pickupReady ? " checked" : ""}/> 已排拆櫃</label>
        </div>
        <label>拆卸日期時間
          <input type="datetime-local" data-imp-clear-field="unpackAt" value="${esc(datetimeInputValue(c.unpackAt))}" />
        </label>
        <label>拆卸位置
          <input type="text" data-imp-clear-field="unpackSite" value="${esc(c.unpackSite || "")}" placeholder="碼頭／冰庫／客戶點" />
        </label>
        <label>拖車
          <input type="text" data-imp-clear-field="trailer" value="${esc(c.trailer || "")}" placeholder="拖車窗口" />
        </label>
        <label>拖車電話
          <input type="tel" data-imp-clear-field="trailerPhone" value="${esc(c.trailerPhone || "")}" placeholder="與拖車確認用" />
        </label>
        <div class="imp-rel-checks">
          <label class="imp-rel-check"><input type="checkbox" data-imp-clear-field="trailerConfirmed"${c.trailerConfirmed ? " checked" : ""}/> 已確認拖車電話</label>
          <label class="imp-rel-check"><input type="checkbox" data-imp-clear-field="notifyTrailer"${c.notifyTrailer ? " checked" : ""}/> 通知拖車</label>
        </div>
        <label>拖車備註
          <input type="text" data-imp-clear-field="trailerNote" value="${esc(c.trailerNote || "")}" />
        </label>
        <label>拆工（可後填）
          <input type="text" data-imp-clear-field="assignee" value="${esc(c.assignee || "")}" placeholder="配合拆工" />
        </label>
        <label>指派數量（可後填）
          <input type="number" data-imp-clear-field="assignQty" value="${esc(c.assignQty == null ? "" : String(c.assignQty))}" />
        </label>
        <label>去向
          <select data-imp-clear-field="destType">
            <option value="coldstore"${c.destType !== "customer" ? " selected" : ""}>自有冰庫販售</option>
            <option value="customer"${c.destType === "customer" ? " selected" : ""}>交客戶</option>
          </select>
        </label>
        <div class="imp-rel-checks">
          <label class="imp-rel-check"><input type="checkbox" data-imp-clear-field="halfSplit"${c.halfSplit ? " checked" : ""}/> 半櫃另指派</label>
          <label class="imp-rel-check"><input type="checkbox" data-imp-clear-field="notifyUnpacker"${c.notifyUnpacker ? " checked" : ""}/> 通知拆工</label>
          <label class="imp-rel-check"><input type="checkbox" data-imp-clear-field="notifyCustomer"${c.notifyCustomer ? " checked" : ""}/> 通知客戶</label>
        </div>
        <label>半櫃②拆工
          <input type="text" data-imp-clear-field="assignee2" value="${esc(c.assignee2 || "")}" />
        </label>
        <label>半櫃②數量
          <input type="number" data-imp-clear-field="assignQty2" value="${esc(c.assignQty2 == null ? "" : String(c.assignQty2))}" />
        </label>
        <label>半櫃②位置
          <input type="text" data-imp-clear-field="unpackSite2" value="${esc(c.unpackSite2 || "")}" />
        </label>
        <label>碼頭
          <input type="text" data-imp-clear-field="dock" value="${esc(c.dock || "")}" placeholder="檢驗／卸貨碼頭" />
        </label>
        <label>藥檢（結束時間） ${clearSelectHtml("inspect", c.inspect)}
          <input type="datetime-local" data-imp-clear-field="inspectAt" value="${esc(datetimeInputValue(c.inspectAt))}" />
        </label>
        <label>薰蒸（結束時間） ${clearSelectHtml("fumigate", c.fumigate)}
          <input type="datetime-local" data-imp-clear-field="fumigateAt" value="${esc(datetimeInputValue(c.fumigateAt))}" />
        </label>
        <label>備註
          <input type="text" data-imp-clear-field="note" value="${esc(c.note || "")}" />
        </label>
        ${draftActionsHtml(`<button type="button" class="primary" data-imp-clear-field="dispatchNow" value="1" data-imp-dispatch="${esc(uha)}">儲存並派送拆卸</button>`)}
      </div>`;
  }

  function drawerStockBody(uha) {
    ensureState();
    const a = (state.importArrivals || []).find((x) => x.uha === uha);
    if (!a) return `<p class="empty">找不到入庫資料 ${esc(uha)}。</p>`;
    return `
      <div class="imp-drawer-readonly">
        <dl class="imp-kv">
          <div><dt>拆櫃日</dt><dd>${esc(a.day || "—")}</dd></div>
          <div><dt>編號</dt><dd>${esc(a.uha)}</dd></div>
          <div><dt>櫃號</dt><dd>${esc(a.containerNo || "—")}</dd></div>
          <div><dt>產品</dt><dd>${esc(a.product || "—")}</dd></div>
          <div><dt>報關數量</dt><dd>${esc(a.customsQty == null ? "—" : String(a.customsQty))}</dd></div>
          <div><dt>拆櫃數量</dt><dd>${esc(a.unpackQty == null ? "—" : String(a.unpackQty))}</dd></div>
          <div><dt>卸貨點</dt><dd>${esc(a.unload || "—")}</dd></div>
          <div><dt>賣方</dt><dd>${esc(a.seller || "—")}</dd></div>
          <div><dt>報關單</dt><dd>${esc(a.customsNo || "—")}</dd></div>
        </dl>
      </div>`;
  }

  function renderDrawer() {
    const host = document.getElementById("imp-drawer-host");
    if (!host) return;
    if (!drawer) {
      host.innerHTML = "";
      host.className = "";
      return;
    }
    const active = document.activeElement;
    let focusKey = "";
    let selStart = null;
    let selEnd = null;
    if (active && host.contains(active)) {
      focusKey = active.getAttribute("data-imp-draft-f") || active.getAttribute("data-imp-clear-field") || "";
      if (typeof active.selectionStart === "number") {
        selStart = active.selectionStart;
        selEnd = active.selectionEnd;
      }
    }
    let title = "";
    let body = "";
    if (drawer.kind === "draft") {
      title = "草稿核對";
      body = drawerDraftBody(Number(drawer.key));
    } else if (drawer.kind === "port") {
      title = `海關查驗 ${drawer.key}`;
      body = drawerPortBody(drawer.key);
    } else if (drawer.kind === "release") {
      title = `已放行 ${drawer.key}`;
      body = drawerReleaseBody(drawer.key);
    } else if (drawer.kind === "stock" || drawer.kind === "sum") {
      title = `入庫明細 ${drawer.key}`;
      body = drawerStockBody(drawer.key);
    } else {
      host.innerHTML = "";
      return;
    }
    const fullCls = drawerFull ? " is-full" : "";
    host.className = "imp-drawer-host is-open" + (drawerFull ? " is-full" : "");
    host.innerHTML = `
      <div class="imp-drawer-backdrop" data-imp-drawer-close></div>
      <aside class="imp-drawer${fullCls}" role="dialog" aria-modal="true" data-imp-drawer-panel>
        ${drawerHeader(title)}
        <div class="imp-drawer-body">${body}</div>
      </aside>`;
    bindSheetSwipe(host);
    if (focusKey) {
      const el =
        host.querySelector(`[data-imp-draft-f="${focusKey}"]`) ||
        host.querySelector(`[data-imp-clear-field="${focusKey}"]`);
      if (el && typeof el.focus === "function") {
        el.focus();
        if (selStart != null && typeof el.setSelectionRange === "function") {
          try {
            el.setSelectionRange(selStart, selEnd != null ? selEnd : selStart);
          } catch (_) {}
        }
      }
    }
  }

  function bindSheetSwipe(host) {
    const handle = host.querySelector("[data-imp-sheet-handle]");
    const panel = host.querySelector("[data-imp-drawer-panel]");
    if (!handle || !panel) return;
    let startY = 0;
    let dragging = false;
    const onStart = (e) => {
      if (drawerFull) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      startY = t.clientY;
      dragging = true;
      panel.classList.add("is-dragging");
    };
    const onMove = (e) => {
      if (!dragging) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const dy = Math.max(0, t.clientY - startY);
      panel.style.transform = `translateY(${dy}px)`;
    };
    const onEnd = (e) => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove("is-dragging");
      const t = e.changedTouches && e.changedTouches[0];
      const dy = t ? Math.max(0, t.clientY - startY) : 0;
      panel.style.transform = "";
      if (dy > 80) closeDrawer();
    };
    handle.addEventListener("touchstart", onStart, { passive: true });
    handle.addEventListener("touchmove", onMove, { passive: true });
    handle.addEventListener("touchend", onEnd, { passive: true });
  }

  function renderMainBody() {
    const body = document.getElementById("imp-main-body");
    if (!body) return;
    const pane = importPane;
    if (pane === "parse" || pane === "hub") renderParse(body);
    else if (pane === "buy") renderBuy(body);
    else if (pane === "broker" || pane === "vendor" || pane === "trailer" || pane === "labor")
      renderAcctStub(body, pane);
    else if (pane === "port") renderPort(body);
    else if (pane === "release") renderRelease(body);
    else if (pane === "stock") renderStock(body);
    else if (pane === "sum" || pane === "upBoard" || pane === "unpack") {
      body.innerHTML = `<p class="imp-one-hint">請使用進口新畫面操作「貨櫃拆卸資料」。</p>`;
    }
    else if (pane === "files") renderFiles(body);
    else if (pane === "status" || pane === "board") {
      importPane = normalizePane(pane);
      renderMainBody();
      return;
    } else renderParse(body);
  }

  function renderImportPage() {
    const box = document.getElementById("import-root");
    if (!box) return;
    ensureState();
    importPane = normalizePane(importPane);
    if (typeof window.mountImportApp === "function") {
      // 已掛載時不要強制重設分頁；只有 openImport / setImportPane 才 forcePane
      window.mountImportApp(box, { pane: importPane });
      return;
    }
    ensureShell(box);
    syncShellChrome(importPane);
    renderMainBody();
    renderDrawer();
  }

  function setImportPane(pane) {
    if (drawerSession && drawerSession.dirty) {
      if (!closeDrawer()) return;
    } else {
      closeDrawer({ force: true });
    }
    importPane = normalizePane(pane || "parse");
    const box = document.getElementById("import-root");
    if (typeof window.mountImportApp === "function" && box) {
      window.mountImportApp(box, { pane: importPane, forcePane: true });
      return;
    }
    renderImportPage();
  }

  function openImport(pane) {
    if (typeof can === "function" && !can("page-import")) {
      if (typeof setStatus === "function") setStatus("進口目前僅開放給雅芳。", true);
      return;
    }
    page = "import";
    importPane = normalizePane(pane || "parse");
    drawer = null;
    drawerFull = false;
    drawerSession = null;
    if (typeof render === "function") render();
    else renderImportPage();
    // render 後再強制同步一次分頁（首次掛載或已存在）
    const box = document.getElementById("import-root");
    if (typeof window.mountImportApp === "function" && box) {
      window.mountImportApp(box, { pane: importPane, forcePane: true });
    }
  }

  function boardHtmlForHub() {
    return "";
  }

  document.getElementById("import-root")?.addEventListener("click", (e) => {
    if (e.target.closest("[data-go-app-home]")) {
      if (typeof window.goHome === "function") window.goHome();
      else if (typeof render === "function") {
        page = "home";
        if (typeof hubDept !== "undefined") hubDept = "";
        if (typeof hubOpen !== "undefined") hubOpen = "";
        render();
      }
      return;
    }
    const deptJump = e.target.closest("[data-imp-dept]");
    if (deptJump) {
      const d = deptJump.dataset.impDept || "";
      page = "home";
      if (typeof hubDept !== "undefined") hubDept = d;
      if (typeof hubOpen !== "undefined") hubOpen = "";
      if (typeof render === "function") render();
      return;
    }
    if (e.target.closest("[data-go-home-import]")) {
      importPane = "parse";
      closeDrawer();
      renderImportPage();
      return;
    }
    if (e.target.closest("[data-imp-drawer-close]")) {
      closeDrawer();
      return;
    }
    if (e.target.closest("[data-imp-draft-save]")) {
      commitDrawerSession();
      return;
    }
    if (e.target.closest("[data-imp-draft-cancel]")) {
      closeDrawer({ force: true });
      return;
    }
    if (e.target.closest("[data-imp-draft-keep-remote]")) {
      discardRemoteAndKeepDraft();
      return;
    }
    if (e.target.closest("[data-imp-draft-reload-remote]")) {
      reloadDrawerFromRemote();
      return;
    }
    if (e.target.closest("[data-imp-drawer-full]")) {
      drawerFull = !drawerFull;
      renderDrawer();
      return;
    }
    const openRow = e.target.closest("[data-imp-open]");
    if (openRow && !e.target.closest("input,select,button,label,a")) {
      if (drawerSession && drawerSession.dirty && drawer && String(drawer.key) !== String(openRow.dataset.impKey)) {
        if (!closeDrawer()) return;
      }
      openDrawer(openRow.dataset.impOpen, openRow.dataset.impKey);
      return;
    }
    const loadSeed = e.target.closest("[data-imp-load-seed]");
    if (loadSeed) {
      (async () => {
        try {
          if (typeof setStatus === "function") setStatus("正在載入115比對種子…");
          const counts = await loadImportSeedJson();
          if (typeof setStatus === "function") {
            setStatus(
              `已載入：進櫃表 ${counts.cabinets || 0}、庫存 ${counts.arrivals || 0}、港口待確認 ${counts.portPending || 0}`,
            );
          }
          renderImportPage();
          try {
            window.dispatchEvent(new CustomEvent("import-remote-applied"));
          } catch (_) {}
        } catch (err) {
          if (typeof setStatus === "function") setStatus(String(err.message || err), true);
        }
      })();
      return;
    }
    const dlTpl = e.target.closest("[data-imp-dl-tpl]");
    if (dlTpl) {
      downloadImportTemplate(dlTpl.dataset.impDlTpl || "port");
      return;
    }
    const markRel = e.target.closest("[data-imp-mark-release]");
    if (markRel) {
      if (drawerSession && drawerSession.dirty) commitDrawerSession();
      markPortReleased(markRel.dataset.impMarkRelease || "");
      return;
    }
    const dispatchBtn = e.target.closest("[data-imp-dispatch]");
    if (dispatchBtn) {
      if (drawerSession && drawerSession.fields) {
        drawerSession.fields.pickupReady = true;
        drawerSession.fields.dispatchNow = true;
        drawerSession.dirty = true;
        commitDrawerSession();
      } else {
        const uha = dispatchBtn.dataset.impDispatch || "";
        const row = findReleased(uha);
        if (row) {
          row.pickupReady = true;
          dispatchToUnpackBoard(row);
          if (typeof save === "function") save();
        }
      }
      importPane = "upBoard";
      closeDrawer({ force: true });
      if (typeof window.mountImportApp === "function") {
        try {
          window.dispatchEvent(new CustomEvent("import-set-pane", { detail: "upBoard" }));
          window.dispatchEvent(new CustomEvent("import-remote-applied"));
        } catch (_) {}
      } else {
        syncShellChrome(importPane);
        renderMainBody();
      }
      return;
    }
    if (e.target.closest("[data-imp-parse-run]")) {
      const ta = document.getElementById("imp-parse-text");
      const raw = ta?.value || "";
      if (!String(raw).trim()) {
        if (typeof setStatus === "function") setStatus("請先貼上文件文字。", true);
        return;
      }
      ensureState();
      const draft = parseImportDocText(raw);
      state.importParseDrafts.unshift(draft);
      if (state.importParseDrafts.length > 40) state.importParseDrafts.length = 40;
      if (ta) ta.value = "";
      if (typeof save === "function") save();
      if (typeof setStatus === "function") setStatus("已解析，請核對後確認。");
      openDrawer("draft", "0");
      renderMainBody();
      return;
    }
    const draftOk = e.target.closest("[data-imp-draft-ok]");
    if (draftOk) {
      if (drawerSession && drawerSession.kind === "draft" && drawerSession.dirty) {
        commitDrawerSession();
      }
      confirmParseDraft(Number(draftOk.dataset.impDraftOk));
      return;
    }
    const draftDrop = e.target.closest("[data-imp-draft-drop]");
    if (draftDrop) {
      ensureState();
      state.importParseDrafts.splice(Number(draftDrop.dataset.impDraftDrop), 1);
      if (typeof save === "function") save();
      closeDrawer({ force: true });
      renderImportPage();
      return;
    }
    if (e.target.closest("[data-imp-go-unpack]")) {
      if (typeof can === "function" && !can("page-unpack")) {
        if (typeof setStatus === "function") setStatus("拆櫃回報建置中，暫僅主管可進入。", true);
        return;
      }
      page = "unpack";
      if (typeof hubDept !== "undefined") hubDept = "import";
      if (typeof render === "function") render();
      return;
    }
    const portTab = e.target.closest("[data-imp-port-tab]");
    if (portTab) {
      portListTab = portTab.dataset.impPortTab || "open";
      importPane = "port";
      refreshMainAndDrawer();
      syncShellChrome(importPane);
      return;
    }
    const relTab = e.target.closest("[data-imp-rel-tab]");
    if (relTab) {
      releaseListTab = relTab.dataset.impRelTab || "open";
      importPane = "release";
      refreshMainAndDrawer();
      syncShellChrome(importPane);
      return;
    }
    const relSort = e.target.closest("[data-imp-rel-sort]");
    if (relSort) {
      releaseSortBy = relSort.dataset.impRelSort || "uha";
      importPane = "release";
      refreshMainAndDrawer();
      syncShellChrome(importPane);
      return;
    }
    const pane = e.target.closest("[data-imp-pane]");
    if (pane) {
      setImportPane(pane.dataset.impPane);
      return;
    }
    if (e.target.closest("[data-imp-export]")) {
      exportSumExcel();
    }
  });

  document.getElementById("import-root")?.addEventListener("input", (e) => {
    const draftField = e.target.closest("[data-imp-draft-f]");
    if (draftField) {
      setDraftField(draftField.dataset.impDraftF, draftField.value);
      const saveBtn = document.querySelector("#imp-drawer-host [data-imp-draft-save]");
      if (saveBtn) saveBtn.disabled = false;
      return;
    }
    const clearField = e.target.closest("[data-imp-clear-field]");
    if (clearField && clearField.type !== "checkbox") {
      setDraftField(clearField.dataset.impClearField, clearField.value);
      const saveBtn = document.querySelector("#imp-drawer-host [data-imp-draft-save]");
      if (saveBtn) saveBtn.disabled = false;
    }
  });

  document.getElementById("import-root")?.addEventListener("change", async (e) => {
    const draftField = e.target.closest("[data-imp-draft-f]");
    if (draftField) {
      setDraftField(draftField.dataset.impDraftF, draftField.value);
      const saveBtn = document.querySelector("#imp-drawer-host [data-imp-draft-save]");
      if (saveBtn) saveBtn.disabled = false;
      return;
    }
    const imgIn = e.target.closest("[data-imp-parse-img]");
    if (imgIn && imgIn.files && imgIn.files[0]) {
      const file = imgIn.files[0];
      imgIn.value = "";
      ensureState();
      state.importParseDrafts.unshift({
        id: uid("draft"),
        uha: "",
        containerNo: "",
        customsNo: "",
        arriveDay: "",
        product: "",
        broker: "",
        raw: `（截圖／拍照：${file.name}，請手動核對欄位）`,
        photoName: file.name,
      });
      if (typeof save === "function") save();
      if (typeof setStatus === "function") setStatus("已附上圖片，請填寫欄位後確認。（圖片 OCR 下一步接）");
      openDrawer("draft", "0");
      renderMainBody();
      return;
    }
    const clearField = e.target.closest("[data-imp-clear-field]");
    if (clearField) {
      const field = clearField.dataset.impClearField;
      let val = clearField.value;
      if (
        field === "released" ||
        field === "ftConfirmed" ||
        field === "pickupReady" ||
        field === "missingDocs" ||
        field === "missingTelex" ||
        field === "missingData" ||
        field === "trailerConfirmed" ||
        field === "notifyTrailer" ||
        field === "notifyUnpacker" ||
        field === "notifyCustomer" ||
        field === "halfSplit"
      )
        val = clearField.checked;
      setDraftField(field, val);
      const saveBtn = document.querySelector("#imp-drawer-host [data-imp-draft-save]");
      if (saveBtn) saveBtn.disabled = false;
      return;
    }
    const input = e.target.closest("[data-imp-file]");
    if (!input || !input.files || !input.files[0]) return;
    const kind = input.dataset.impFile;
    const file = input.files[0];
    input.value = "";
    try {
      if (typeof setStatus === "function") setStatus("正在匯入…");
      let n = 0;
      if (kind === "cabinet") n = await importCabinetFile(file);
      else if (kind === "arrival") n = await importArrivalFile(file);
      else if (kind === "released") n = await importReleasedFile(file);
      else if (kind === "tpl-port" || kind === "tpl-released" || kind === "tpl-arrival") n = await importTemplateFile(file, kind);
      const count = typeof n === "object" && n ? n.total ?? n.n ?? 0 : n;
      if (typeof setStatus === "function") setStatus(`已匯入 ${count} 筆。`);
      renderImportPage();
      if (typeof renderHomeHub === "function" && page === "home") renderHomeHub();
    } catch (err) {
      if (typeof setStatus === "function") setStatus(String(err.message || err), true);
    }
  });

  window.renderImportPage = renderImportPage;
  window.openImport = openImport;
  window.setImportPane = setImportPane;
  window.importBoardHtml = boardHtmlForHub;
  window.importBoardStats = boardStats;
  window.onImportRemoteApplied = onImportRemoteApplied;

  function clearLab(v, kind) {
    const opts = clearOptsFor(kind);
    return (opts.find((o) => o.id === v) || {}).lab || v || "待確認";
  }

  window.__importApi = {
    loadDrawerFields,
    commitDrawerSession,
    parseImportDocText,
    parseImportDocTexts,
    confirmParseDraft,
    confirmParseDraftsAll,
    draftTrackFlow,
    findTrackByContainer,
    discardParseDraft,
    assignPortUha,
    markPortReleased,
    markPortReleasedMany,
    unmarkPortReleased,
    unmarkPortReleasedMany,
    patchReleaseField,
    confirmReleasePickup,
    trailerNames,
    exportSumExcel,
    loadImportSeedJson,
    downloadImportTemplate,
    importTemplateFile,
    addManualPortRow,
    templateMeta,
    setHostPane(pane) {
      importPane = normalizePane(pane || "parse");
    },
    listDrafts() {
      ensureState();
      return (state.importParseDrafts || []).map((d, i) => {
        if (!d.id) d.id = uid("draft");
        const cno = normContainer(d.containerNo);
        const hit = cno ? findTrackByContainer(cno) : null;
        const flow = draftTrackFlow(d);
        return {
          ...d,
          _index: i,
          matchUha: hit ? hit.uha : "",
          matchExisting: !!hit,
          trackFlow: flow,
        };
      });
    },
    listPort(tab) {
      ensureState();
      fixArriveDaysInState();
      const all = portWaitingList();
      let list = all;
      const t = tab || "open";
      if (t === "inspect") list = all.filter((c) => c.track.inspect === "wait");
      else if (t === "fume") list = all.filter((c) => c.track.fumigate === "wait");
      return list.map((c) => {
        const track = c.track;
        return {
          key: c.uha,
          uha: c.uha,
          arriveDay: c.arriveDay || "",
          containerNo: c.containerNo || "",
          product: c.product || "",
          seller: c.seller || "",
          shipCo: c.shipCo || "",
          inspect: track.inspect || "none",
          inspectAt: track.inspectAt || "",
          fumigate: track.fumigate || "none",
          fumigateAt: track.fumigateAt || "",
          dock: track.dock || "",
          missingTelex: !!track.missingTelex,
          missingData: !!track.missingData,
          trailer: track.trailer || "",
          trailerPhone: track.trailerPhone || "",
          note: track.note || "",
          status: portStatusLabel(track),
          cells: [
            c.arriveDay || "—",
            c.uha,
            c.containerNo || "（尚無櫃號）",
            c.product || "—",
            c.seller || "—",
            c.shipCo || "—",
            clearLab(track.inspect),
            formatAtShort(track.inspectAt),
            clearLab(track.fumigate),
            formatAtShort(track.fumigateAt),
            portStatusLabel(track),
          ],
        };
      });
    },
    /** 海關查驗：同畫面直接改狀態／時間／碼頭／賣方／船公司等 */
    patchPortField(uha, field, value) {
      ensureState();
      const cab = (state.importCabinets || []).find((c) => c.uha === uha);
      if (!cab) return false;
      ensureTrackFromCabinet(cab);
      if (field === "seller" || field === "shipCo" || field === "product" || field === "broker") {
        cab[field] = String(value || "").trim();
        stampRow(cab);
        if (typeof save === "function") save();
        return true;
      }
      if (field === "containerNo") {
        cab.containerNo = normContainer(value);
        stampRow(cab);
        const track = findReleased(uha);
        if (track) {
          track.containerNo = cab.containerNo;
          stampRow(track);
        }
        if (typeof save === "function") save();
        return true;
      }
      patchReleased(uha, field, value);
      return true;
    },
    portTabCounts() {
      ensureState();
      fixArriveDaysInState();
      return portTabCounts();
    },
    listRelease(tab) {
      ensureState();
      fixArriveDaysInState();
      const all = releaseWorkList();
      let list = all;
      const t = tab === "check" ? "arrange" : tab;
      if (t === "pickup") list = all.filter((x) => x.pickup);
      else if (t === "arrange") list = all.filter((x) => !x.pickup);
      return list.map((c) => ({
        key: c.uha,
        uha: c.uha,
        containerNo: c.containerNo || "",
        product: c.product || "",
        dock: c.dock || "",
        trailer: c.trailer || "",
        trailerPhone: c.trailerPhone || "",
        pickupDay: c.pickupDay || "",
        unpackSite: c.unpackSite || "",
        assignee: c.assignee || "",
        notifyTrailer: !!c.notifyTrailer,
        notifyCustomer: !!c.notifyCustomer,
        missingTelex: !!c.missingTelex,
        missingData: !!c.missingData,
        dispatched: !!c.dispatched,
        pickup: !!c.pickup,
        ftLabel: formatFtLabel(c),
        cells: [c.uha, c.containerNo || "—", c.product || "—", c.dock || "—", c.trailer || "—", c.unpackSite || "—", c.assignee || "—", c.pickupDay || "—"],
      }));
    },
    releaseTabCounts() {
      ensureState();
      fixArriveDaysInState();
      const all = releaseWorkList();
      const s = releaseStats(all);
      return {
        open: s.total,
        arrange: s.arrange,
        pickup: s.pickup,
        check: s.check,
      };
    },
    /** 查驗清單：海關查驗＋已放行狀態總覽（後台 Excel 式） */
    listClearanceSheet() {
      ensureState();
      fixArriveDaysInState();
      const cabBy = new Map((state.importCabinets || []).map((c) => [c.uha, c]));
      const rows = [];

      for (const c of portWaitingList()) {
        const t = c.track || {};
        ensureClearanceShape(t);
        rows.push({
          key: c.uha,
          stage: "待驗",
          stageId: "port",
          released: false,
          uha: c.uha || "",
          containerNo: c.containerNo || "",
          arriveDay: c.arriveDay || "",
          product: c.product || "",
          seller: c.seller || "",
          shipCo: c.shipCo || "",
          broker: c.broker || "",
          customsNo: t.customsNo || c.customsNo || "",
          checkKind: t.checkKind || "",
          inspect: t.inspect || "none",
          inspectAt: t.inspectAt || "",
          fumigate: t.fumigate || "none",
          fumigateAt: t.fumigateAt || "",
          dock: t.dock || "",
          missingTelex: !!t.missingTelex,
          missingData: !!t.missingData,
          note: t.note || "",
          trailer: t.trailer || "",
          trailerPhone: t.trailerPhone || "",
          pickupDay: "",
          unpackSite: "",
          assignee: "",
          ftLabel: "",
          status: portStatusLabel(t),
        });
      }

      for (const r of releaseWorkList()) {
        const cab = cabBy.get(r.uha) || {};
        ensureClearanceShape(r);
        rows.push({
          key: r.uha,
          stage: "已放行",
          stageId: "release",
          released: true,
          uha: r.uha || "",
          containerNo: r.containerNo || cab.containerNo || "",
          arriveDay: r.arriveDay || cab.arriveDay || "",
          product: r.product || cab.product || "",
          seller: r.seller || cab.seller || "",
          shipCo: r.shipCo || cab.shipCo || "",
          broker: r.broker || cab.broker || "",
          customsNo: r.customsNo || cab.customsNo || "",
          checkKind: r.checkKind || "",
          inspect: r.inspect || "none",
          inspectAt: r.inspectAt || "",
          fumigate: r.fumigate || "none",
          fumigateAt: r.fumigateAt || "",
          dock: r.dock || "",
          missingTelex: !!r.missingTelex,
          missingData: !!r.missingData,
          note: r.note || "",
          trailer: r.trailer || "",
          trailerPhone: r.trailerPhone || "",
          pickupDay: r.pickupDay || "",
          unpackSite: r.unpackSite || "",
          assignee: r.assignee || "",
          ftLabel: formatFtLabel(r),
          status: releaseStatusLabel(r),
        });
      }

      rows.sort((a, b) => {
        const da = String(a.arriveDay || "");
        const db = String(b.arriveDay || "");
        if (da !== db) return db.localeCompare(da);
        return String(a.uha || "").localeCompare(String(b.uha || ""), "en", { numeric: true });
      });
      return rows;
    },
    listStock() {
      ensureState();
      return (state.importArrivals || []).map((a) => ({
        key: a.uha,
        cells: [a.day || "—", a.uha, a.containerNo || "—", a.product || "—", a.customsQty ?? "—", a.unpackQty ?? "—"],
      }));
    },
    listSum(tab) {
      ensureState();
      if (!Array.isArray(state.unpackJobs)) state.unpackJobs = [];
      let rows = state.unpackJobs.filter((j) => j.fromRelease || j.sourceUha);
      if (tab === "needQty") {
        rows = rows.filter((j) => j.unpackQty == null || j.unpackQty === "");
      } else if (tab === "customer") {
        rows = rows.filter((j) => j.destType === "customer");
      } else if (tab === "coldstore") {
        rows = rows.filter((j) => j.destType !== "customer");
      }
      rows = rows.slice().sort((a, b) => String(b.day || "").localeCompare(String(a.day || "")));
      return rows.map((j) => ({
        key: j.id,
        cells: [
          j.day || "—",
          j.sourceUha || j.box || "—",
          (j.codes && j.codes[0]) || "—",
          j.name || "—",
          j.unpackQty != null ? String(j.unpackQty) : "—",
          j.location || j.unloadPoint || "—",
          j.destType === "customer" ? "交客戶" : "自有冰庫",
          j.assignee || "—",
          j.status === "reported" || j.status === "confirmed" ? "已回報" : "待補",
        ],
      }));
    },
    sumTabCounts() {
      ensureState();
      if (!Array.isArray(state.unpackJobs)) state.unpackJobs = [];
      const all = state.unpackJobs.filter((j) => j.fromRelease || j.sourceUha);
      return {
        open: all.length,
        needQty: all.filter((j) => j.unpackQty == null || j.unpackQty === "").length,
        customer: all.filter((j) => j.destType === "customer").length,
        coldstore: all.filter((j) => j.destType !== "customer").length,
      };
    },
    listUpBoard(day) {
      ensureState();
      if (!Array.isArray(state.unpackJobs)) state.unpackJobs = [];
      const d = day || (typeof today === "function" ? today() : "");
      const rows = state.unpackJobs
        .filter((j) => (j.fromRelease || j.sourceUha) && (!d || j.day === d))
        .slice()
        .sort((a, b) => String(a.unpackAt || "").localeCompare(String(b.unpackAt || "")) || String(a.box).localeCompare(String(b.box)));
      return rows.map((j) => {
        const missPhone = !String(j.trailerPhone || "").trim();
        const missTrailer = !String(j.trailer || "").trim();
        const missUha = !String(j.sourceUha || j.box || "").trim();
        const missAssignee = !String(j.assignee || "").trim();
        const dayOnly =
          (j.day || (j.unpackAt || "").slice(0, 10) || "").replace(/^(\d{4})-(\d{2})-(\d{2}).*/, (_, y, m, d) => `${Number(m)}/${Number(d)}`) ||
          "—";
        return {
          key: j.id,
          uha: j.sourceUha || j.box || "",
          sourceUha: j.sourceUha || j.box || "",
          box: j.box || "",
          containerNo: (j.codes && j.codes[0]) || "",
          product: j.name || "",
          name: j.name || "",
          trailer: j.trailer || "",
          trailerPhone: j.trailerPhone || "",
          assignee: j.assignee || "",
          location: j.location || j.unloadPoint || "",
          day: j.day || "",
          unpackAt: j.unpackAt || "",
          warn: missPhone || missTrailer || missUha,
          missPhone,
          missTrailer,
          missUha,
          missAssignee,
          cells: [dayOnly, j.sourceUha || j.box || "—", j.assignee || "—", j.trailer || "—"],
        };
      });
    },
    upBoardMeta(day) {
      ensureState();
      if (!Array.isArray(state.unpackJobs)) state.unpackJobs = [];
      const d = day || (typeof today === "function" ? today() : "");
      const rows = state.unpackJobs.filter((j) => (j.fromRelease || j.sourceUha) && (!d || j.day === d));
      return {
        day: d,
        total: rows.length,
        missingTrailer: rows.filter(
          (j) =>
            !String(j.trailer || "").trim() ||
            !String(j.trailerPhone || "").trim() ||
            !String(j.sourceUha || j.box || "").trim(),
        ).length,
      };
    },
    unpackerNames() {
      if (typeof window.__unpackApi?.unpackerNames === "function") return window.__unpackApi.unpackerNames();
      if (typeof UNPACK_STAFF !== "undefined" && Array.isArray(UNPACK_STAFF)) return UNPACK_STAFF.slice();
      return [];
    },
    dispatchUnpack(uha) {
      const row = findReleased(uha);
      if (!row) return false;
      const ok = dispatchToUnpackBoard(row);
      if (ok && typeof save === "function") save();
      return ok;
    },
  };
})();
