/** 拆櫃回報 → 進貨確認. Loads after app.js / ware-stock.js */
(function () {
  const WH_FALLBACK = [
    { id: "A", label: "A倉" },
    { id: "B", label: "B倉" },
    { id: "Y", label: "油" },
    { id: "K", label: "烘庫" },
  ];

  let unpackPhase = "list"; // list | detail
  let unpackFocusId = "";
  let unpackPhotoDraft = "";
  let unpackEditMode = false;
  let unpackListTab = "pending"; // pending | reported | approve
  const REPORTED_DETAIL_DAYS = 3;
  /** 申報後修改／刪除 → 子羽核對；進倉後修改／刪除 → 雅芳核可 */
  const APPROVER_REPORT = "子羽";
  const APPROVER_STOCK = "雅芳";

  function warehouseOpts() {
    if (typeof STOCK_WAREHOUSES !== "undefined" && Array.isArray(STOCK_WAREHOUSES) && STOCK_WAREHOUSES.length) {
      return STOCK_WAREHOUSES.map((w) => ({ id: w.id, label: w.label }));
    }
    return WH_FALLBACK.slice();
  }

  function unpackerNames() {
    if (typeof UNPACK_STAFF !== "undefined" && Array.isArray(UNPACK_STAFF)) return UNPACK_STAFF;
    return ["阿宏", "靜宜"];
  }

  function iAmUnpacker() {
    return typeof isUnpackerRole === "function" ? isUnpackerRole() : currentRole() === "unpacker";
  }

  function canAssignUnpack() {
    if (typeof can === "function") return can("unpack-assign") || can("page-books");
    return !iAmUnpacker();
  }

  /** site / acct / boss — 可代送申請或直接處理 pending. */
  function isUnpackManager() {
    if (typeof currentRole === "function") {
      const r = currentRole();
      if (r === "boss" || r === "acct" || r === "site") return true;
    }
    return canAssignUnpack();
  }

  function staffName() {
    return typeof currentStaff === "function" ? currentStaff() || "" : "";
  }

  function iAmNamed(name) {
    const me = staffName();
    if (!me || !name) return false;
    if (me === name) return true;
    if (name === APPROVER_STOCK && typeof currentRole === "function" && currentRole() === "boss") return true;
    return false;
  }

  function isStockConfirmed(j) {
    if (!j) return false;
    if (j.status === "confirmed") return true;
    const row = findLedger(j.ledgerId);
    return !!(row && row.status === "confirmed");
  }

  /**
   * 核准閘門：
   * - pending：直接改
   * - reported（未進倉）：非核對人送子羽核對；子羽本人直接改
   * - 已確認進貨：直接修改／刪除（沖回庫存＋記入後台）
   */
  function approvalGate(j, _action) {
    if (!j || j.status === "pending") return null;
    if (isStockConfirmed(j)) return null;
    if (j.status === "reported") {
      return {
        approver: APPROVER_REPORT,
        tier: "report",
        label: `已申報，需${APPROVER_REPORT}核對`,
        verb: "核對",
      };
    }
    return null;
  }

  /** 拆工：自己的 pending／reported；現場／會計／主管：含已確認進貨可直接改刪. */
  function canEditJob(j) {
    if (!j) return false;
    if (isUnpackManager()) return true;
    if (!iAmUnpacker()) return false;
    const me = staffName();
    if (!me) return false;
    return j.assignee === me && (j.status === "pending" || j.status === "reported");
  }

  function canDeleteJob(j) {
    if (!j) return false;
    if (isUnpackManager()) return true;
    if (!iAmUnpacker()) return false;
    const me = staffName();
    if (!me) return false;
    return j.assignee === me && (j.status === "pending" || j.status === "reported");
  }

  function ensureState() {
    if (!Array.isArray(state.unpackJobs)) state.unpackJobs = [];
    if (!Array.isArray(state.inboundLedger)) state.inboundLedger = [];
    if (!Array.isArray(state.unpackApprovals)) state.unpackApprovals = [];
    if (!state.wareItems || typeof state.wareItems !== "object") state.wareItems = {};
    if (!state.stockCount || typeof state.stockCount !== "object") state.stockCount = {};
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function whName(id) {
    if (id === "customer") return "客戶";
    return warehouseOpts().find((w) => w.id === id)?.label || id || "—";
  }

  function blankJobFields() {
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
    };
  }

  /** Resolve 卸貨點 from known customer → ship-addr / freight / rack carrier maps. */
  function lookupUnloadPoint(customer) {
    const who = String(customer || "").trim();
    if (!who) return "";
    const firstSeg = (addr) => {
      const a = String(addr || "").trim();
      if (!a) return "";
      if (typeof destFromRemembered === "function") return String(destFromRemembered(a) || "").trim();
      return a.split(/[／/]/)[0].trim();
    };
    if (typeof lastShipAddr === "function") {
      const hit = firstSeg(lastShipAddr(who));
      if (hit) return hit;
    }
    if (typeof loadAddrMap === "function" && typeof namesMatch === "function") {
      const m = loadAddrMap() || {};
      for (const [k, v] of Object.entries(m)) {
        if (namesMatch(k, who)) {
          const hit = firstSeg(v);
          if (hit) return hit;
        }
      }
    }
    if (typeof freightCarrierDefault === "function") {
      const f = String(freightCarrierDefault(who) || "").trim();
      if (f) return f;
    }
    const rack = String(window.RackLib?.carrierOf?.(who) || "").trim();
    if (rack && rack !== who) return rack;
    return "";
  }

  function customerOptionsHtml() {
    const names =
      typeof suggestCustomerNames === "function"
        ? suggestCustomerNames()
        : typeof loadAllCustomers === "function"
          ? loadAllCustomers()
          : [];
    return names
      .slice(0, 120)
      .map((n) => `<option value="${esc(n)}"></option>`)
      .join("");
  }

  /** Auto-fill 卸貨點 when 交櫃客戶 changes; do not overwrite a manual edit. */
  function applyUnloadFromCustomer() {
    const custEl = document.getElementById("up-new-customer");
    const unloadEl = document.getElementById("up-new-unload");
    if (!custEl || !unloadEl) return;
    const who = String(custEl.value || "").trim();
    const prevAuto = String(unloadEl.dataset.autoUnload || "");
    const current = String(unloadEl.value || "").trim();
    if (!who) {
      if (!current || current === prevAuto) {
        unloadEl.value = "";
        unloadEl.dataset.autoUnload = "";
      }
      return;
    }
    const looked = lookupUnloadPoint(who);
    if (!looked) return;
    if (!current || current === prevAuto) {
      unloadEl.value = looked;
      unloadEl.dataset.autoUnload = looked;
    }
  }

  /** From container label prints → pending unpack jobs (one job per print batch / box+day+name). */
  function syncJobsFromLabels() {
    ensureState();
    const prints = typeof loadLabelPrints === "function" ? loadLabelPrints() : [];
    let added = 0;
    for (const p of prints) {
      if (!p || p.kind !== "container") continue;
      const printKey = String(p.id || `${p.day}|${p.box}|${p.at}|${(p.codes || []).join(",")}`);
      if (state.unpackJobs.some((j) => j.printKey === printKey)) continue;
      const codes = Array.isArray(p.codes) ? p.codes.filter(Boolean) : [];
      if (!codes.length && !p.box) continue;
      state.unpackJobs.push({
        id: uid("up"),
        printKey,
        day: String(p.day || today()),
        box: String(p.box || "").trim(),
        name: String(p.name || "").trim(),
        country: String(p.country || "").trim(),
        vendor: String(p.vendor || "").trim(),
        codes,
        assignee: "",
        status: "pending",
        ...blankJobFields(),
        reportedBy: "",
        reportedAt: 0,
        confirmedBy: "",
        confirmedAt: 0,
        ledgerId: "",
      });
      added += 1;
    }
    if (added) save();
    return added;
  }

  function dayFromMs(ms) {
    const n = Number(ms) || 0;
    if (!n) return "";
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date(n));
    } catch (_) {
      return new Date(n).toISOString().slice(0, 10);
    }
  }

  function fmtReportedAt(ms) {
    const n = Number(ms) || 0;
    if (!n) return "";
    try {
      return new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(n));
    } catch (_) {
      return dayFromMs(n);
    }
  }

  /** 回報明細清單：僅開放最近 REPORTED_DETAIL_DAYS 日（含今日）。 */
  function inReportedDetailWindow(j) {
    if (!j) return false;
    const t = Number(j.reportedAt) || 0;
    const d = t ? dayFromMs(t) : String(j.day || "");
    if (!d || typeof today !== "function" || typeof addDays !== "function") return false;
    const minDay = addDays(today(), -(REPORTED_DETAIL_DAYS - 1));
    const maxDay = today();
    return d >= minDay && d <= maxDay;
  }

  function visibleJobs() {
    ensureState();
    if (!iAmUnpacker()) syncJobsFromLabels();
    const me = typeof currentStaff === "function" ? currentStaff() : "";
    let list = state.unpackJobs.filter((j) => j.status === "pending" || j.status === "reported");
    if (iAmUnpacker()) {
      list = list.filter((j) => j.status === "pending" && j.assignee === me);
    }
    return list.sort(
      (a, b) => String(b.day).localeCompare(a.day) || String(a.box).localeCompare(b.box, "zh-Hant"),
    );
  }

  /** 回報明細清單：已回報／已確認，近 3 日；拆櫃工僅看自己負責的。 */
  function reportedDetailJobs() {
    ensureState();
    if (!iAmUnpacker()) syncJobsFromLabels();
    const me = typeof currentStaff === "function" ? currentStaff() : "";
    let list = state.unpackJobs.filter(
      (j) => (j.status === "reported" || j.status === "confirmed") && inReportedDetailWindow(j),
    );
    if (iAmUnpacker()) {
      list = list.filter((j) => j.assignee === me);
    }
    return list.sort(
      (a, b) =>
        (Number(b.reportedAt) || 0) - (Number(a.reportedAt) || 0) ||
        String(b.day).localeCompare(a.day) ||
        String(a.box).localeCompare(b.box, "zh-Hant"),
    );
  }

  function pendingJobs() {
    return visibleJobs();
  }

  window.unpackPendingCountForMe = function () {
    ensureState();
    const me = typeof currentStaff === "function" ? currentStaff() : "";
    if (!me) return 0;
    return state.unpackJobs.filter((j) => j.status === "pending" && j.assignee === me).length;
  };

  function jobById(id) {
    ensureState();
    return state.unpackJobs.find((j) => j.id === id);
  }

  function jobAllowed(j) {
    if (!j) return false;
    if (!iAmUnpacker()) return true;
    const me = typeof currentStaff === "function" ? currentStaff() : "";
    if (j.assignee !== me) return false;
    // 拆櫃工可開自己的待回報（填寫）與已回報／已確認（核對、唯讀）
    return j.status === "pending" || j.status === "reported" || j.status === "confirmed";
  }

  function statusLabel(j) {
    if (!j) return "";
    if (j.status === "confirmed") return "已確認進貨";
    if (j.status === "reported") {
      return j.stockIn === false ? "已回報" : "待會計確認";
    }
    return "待回報";
  }

  function locDisplay(j) {
    if (!j) return "—";
    if (j.location === "customer") {
      return j.customerName ? `客戶 · ${j.customerName}` : "客戶";
    }
    return whName(j.location);
  }

  function jobAuditSnap(j) {
    if (!j) return null;
    return {
      id: j.id,
      day: j.day,
      box: j.box,
      reportBox: j.reportBox,
      name: j.name,
      codes: Array.isArray(j.codes) ? j.codes.slice() : [],
      assignee: j.assignee,
      status: j.status,
      qty: j.qty,
      unpackQty: j.unpackQty,
      stockIn: j.stockIn,
      location: j.location,
      customer: j.customer,
      customerName: j.customerName,
      unloadPoint: j.unloadPoint,
      note: j.note,
      ledgerId: j.ledgerId,
      reportedBy: j.reportedBy,
      confirmedBy: j.confirmedBy,
    };
  }

  function jobSummaryLine(j) {
    if (!j) return "拆櫃";
    const codes = (j.codes || []).filter(Boolean).join("、");
    const bits = [
      j.day,
      j.box || j.reportBox || "",
      j.name || "",
      codes ? `號 ${codes}` : "",
      j.customer || j.customerName || "",
      j.unloadPoint || "",
      j.unpackQty != null ? `拆櫃數 ${j.unpackQty}` : "",
      j.qty != null ? `外箱 ${j.qty}` : "",
      j.assignee ? `負責 ${j.assignee}` : "",
      statusLabel(j),
    ].filter(Boolean);
    return bits.join(" · ");
  }

  function fieldDiffs(before, after) {
    const keys = [
      ["day", "拆櫃日"],
      ["box", "貨櫃編號"],
      ["reportBox", "拆櫃編號"],
      ["name", "品名"],
      ["codes", "貨櫃號碼"],
      ["assignee", "負責"],
      ["customer", "交櫃客戶"],
      ["unloadPoint", "卸貨點"],
      ["unpackQty", "拆櫃數量"],
      ["qty", "外箱"],
      ["stockIn", "入庫"],
      ["location", "拆櫃位置"],
      ["customerName", "客戶名稱"],
      ["note", "備註"],
    ];
    const changes = [];
    for (const [k, label] of keys) {
      let a = before?.[k];
      let b = after?.[k];
      if (k === "codes") {
        a = Array.isArray(a) ? a.join("、") : String(a || "");
        b = Array.isArray(b) ? b.join("、") : String(b || "");
      } else if (k === "stockIn") {
        a = a === false ? "否" : "是";
        b = b === false ? "否" : "是";
      } else if (k === "location") {
        a = a === "customer" ? `客戶${before?.customerName ? `·${before.customerName}` : ""}` : whName(a);
        b = b === "customer" ? `客戶${after?.customerName ? `·${after.customerName}` : ""}` : whName(b);
      } else {
        a = a == null || a === "" ? "—" : String(a);
        b = b == null || b === "" ? "—" : String(b);
      }
      if (a !== b) changes.push(`${label} ${a}→${b}`);
    }
    return changes;
  }

  function findLedger(id) {
    if (!id) return null;
    return state.inboundLedger.find((x) => x.id === id) || null;
  }

  function bumpInboundStock(row, sign) {
    if (!row) return;
    const wh = row.warehouse || "A";
    if (wh === "customer") return;
    const day = row.day || today();
    const qty = Number(row.qty) || 0;
    if (!(qty > 0)) return;
    if (!Array.isArray(state.wareItems[wh])) state.wareItems[wh] = [];
    let item = state.wareItems[wh].find(
      (it) => String(it.code || "").toLowerCase() === String(row.code || "").toLowerCase(),
    );
    if (!item) {
      if (sign < 0) return;
      item = { id: uid("wi"), code: row.code || row.name, name: row.name || row.code };
      state.wareItems[wh].push(item);
    } else if (row.name && sign > 0) {
      item.name = row.name;
    }
    if (!state.stockCount[day]) state.stockCount[day] = {};
    if (!state.stockCount[day][wh]) state.stockCount[day][wh] = { qty: {}, notes: {}, confirmed: false };
    const bucket = state.stockCount[day][wh];
    if (!bucket.qty) bucket.qty = {};
    const prev = Number(bucket.qty[item.id]) || 0;
    const next = typeof round === "function" ? round(prev + sign * qty) : prev + sign * qty;
    bucket.qty[item.id] = Math.max(0, next);
  }

  function buildLedgerPayload(j) {
    const locNote =
      j.location === "customer"
        ? `客戶 ${j.customerName}`
        : `位置 ${whName(j.location)}`;
    return {
      source: "unpack",
      unpackId: j.id,
      day: j.day,
      code: j.reportBox || (j.codes && j.codes[0]) || j.box,
      name: j.name,
      qty: j.qty,
      unpackQty: j.unpackQty,
      note: [
        j.note,
        j.country,
        j.vendor,
        `拆櫃 ${j.reportBox || j.box}`,
        j.unpackQty != null ? `拆櫃數量 ${j.unpackQty}` : "",
        j.qty != null ? `外箱 ${j.qty}` : "",
        locNote,
      ]
        .filter(Boolean)
        .join(" · "),
      warehouse: j.location === "customer" ? "customer" : j.location,
      customerName: j.customerName || "",
      photo: j.photo || "",
    };
  }

  /** Keep linked inbound row in sync after edit; reverse confirmed stock when needed. */
  function syncLinkedLedgerAfterEdit(j, before) {
    const wantLedger = j.stockIn !== false && (j.status === "reported" || j.status === "confirmed");
    let row = findLedger(j.ledgerId);
    if (!wantLedger) {
      if (row) {
        if (row.status === "confirmed") bumpInboundStock(row, -1);
        const ix = state.inboundLedger.findIndex((x) => x.id === row.id);
        if (ix >= 0) state.inboundLedger.splice(ix, 1);
      }
      j.ledgerId = "";
      return;
    }
    const payload = buildLedgerPayload(j);
    if (!row) {
      const ledgerId = uid("in");
      state.inboundLedger.push({
        id: ledgerId,
        ...payload,
        status: j.status === "confirmed" ? "confirmed" : "pending",
        by: j.confirmedBy || "",
        at: j.confirmedAt || 0,
        createdAt: Date.now(),
        createdBy: j.reportedBy || (typeof currentStaff === "function" ? currentStaff() || "" : ""),
      });
      j.ledgerId = ledgerId;
      row = findLedger(ledgerId);
      if (row && row.status === "confirmed") bumpInboundStock(row, 1);
      return;
    }
    const wasConfirmed = row.status === "confirmed";
    if (wasConfirmed) bumpInboundStock(row, -1);
    Object.assign(row, payload);
    if (wasConfirmed) {
      row.status = "confirmed";
      bumpInboundStock(row, 1);
    } else {
      row.status = "pending";
    }
    void before;
  }

  function removeLinkedLedger(j) {
    const row = findLedger(j.ledgerId);
    if (row) {
      if (row.status === "confirmed") bumpInboundStock(row, -1);
      const ix = state.inboundLedger.findIndex((x) => x.id === row.id);
      if (ix >= 0) state.inboundLedger.splice(ix, 1);
    }
    j.ledgerId = "";
  }

  function jobActionBar(j) {
    if (!j) return "";
    const bits = [];
    if (canEditJob(j)) {
      bits.push(
        `<button type="button" class="primary" data-up-edit="${esc(j.id)}">修改</button>`,
      );
    }
    if (canDeleteJob(j)) {
      bits.push(
        `<button type="button" class="ghost up-del" data-up-del="${esc(j.id)}">刪除</button>`,
      );
    }
    if (!bits.length) return "";
    return `<div class="up-card-acts" role="group" aria-label="拆櫃異動">${bits.join("")}</div>`;
  }

  function pendingApprovals() {
    ensureState();
    return (state.unpackApprovals || []).filter((a) => a && a.status === "pending");
  }

  function pendingApprovalsForMe() {
    return pendingApprovals().filter((a) => iAmNamed(a.approver));
  }

  function enqueueApproval(entry) {
    ensureState();
    const prev = state.unpackApprovals.findIndex(
      (a) => a.status === "pending" && a.jobId === entry.jobId && a.type === entry.type,
    );
    if (prev >= 0) state.unpackApprovals.splice(prev, 1);
    state.unpackApprovals.unshift(entry);
    if (state.unpackApprovals.length > 200) state.unpackApprovals.length = 200;
  }

  function applyJobPatch(j, after) {
    if (!j || !after) return;
    const keys = [
      "day",
      "box",
      "name",
      "codes",
      "assignee",
      "customer",
      "unloadPoint",
      "unpackQty",
      "qty",
      "stockIn",
      "location",
      "customerName",
      "note",
      "reportBox",
      "photo",
    ];
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(after, k)) j[k] = after[k];
    }
    if (j.customer && j.unloadPoint && typeof rememberShipAddr === "function") {
      rememberShipAddr(j.customer, j.unloadPoint);
    }
  }

  /** After a real delete: leave detail and land on 待回報 (not 回報明細清單). */
  function goUnpackPendingAfterDelete() {
    unpackEditMode = false;
    unpackPhase = "list";
    unpackFocusId = "";
    unpackPhotoDraft = "";
    unpackListTab = "pending";
  }

  function applyDeleteJob(j, auditExtra) {
    if (!j) return;
    const snap = jobAuditSnap(j);
    removeLinkedLedger(j);
    const ix = state.unpackJobs.findIndex((x) => x.id === j.id);
    if (ix >= 0) state.unpackJobs.splice(ix, 1);
    if (typeof pushAudit === "function") {
      pushAudit("unpack", "delete", `拆櫃刪除 ${jobSummaryLine(snap)}`, {
        ...snap,
        ...(auditExtra || {}),
      });
    }
    goUnpackPendingAfterDelete();
  }

  function applyApprovedEdit(j, after, changes, auditExtra) {
    const before = jobAuditSnap(j);
    applyJobPatch(j, after);
    syncLinkedLedgerAfterEdit(j, before);
    if (typeof pushAudit === "function") {
      const changeTxt = (changes || fieldDiffs(before, jobAuditSnap(j))).join("；") || "欄位更新";
      pushAudit("unpack", "edit", `拆櫃修改 ${j.box || j.reportBox || ""}｜${changeTxt}`, {
        before,
        after: jobAuditSnap(j),
        ...(auditExtra || {}),
      });
    }
  }

  function startEditJob(id) {
    const j = jobById(id);
    if (!j || !canEditJob(j)) {
      if (typeof setStatus === "function") setStatus("沒有修改權限。", true);
      return;
    }
    unpackPhase = "detail";
    unpackFocusId = j.id;
    unpackEditMode = true;
    unpackPhotoDraft = "";
    renderUnpackDetail(j.id);
    const gate = approvalGate(j, "edit");
    if (gate && !iAmNamed(gate.approver) && !isUnpackManager() && typeof setStatus === "function") {
      setStatus(`${gate.label}：改完請按「儲存修改」送出申請。`, false);
    }
  }

  function cancelEditJob() {
    unpackEditMode = false;
    unpackPhotoDraft = "";
    if (unpackFocusId) renderUnpackDetail(unpackFocusId);
    else renderUnpackList();
  }

  function collectEditAfter(j) {
    const roundFn = typeof round === "function" ? round : (x) => x;
    const dayEl = document.getElementById("up-day");
    const jobBoxEl = document.getElementById("up-job-box");
    const nameEl = document.getElementById("up-job-name");
    const codesEl = document.getElementById("up-job-codes");
    const custEl = document.getElementById("up-job-customer");
    const unloadEl = document.getElementById("up-job-unload");
    const whoEl = document.getElementById("up-job-assignee");
    const reportBoxEl = document.getElementById("up-box");
    const unpackQtyEl = document.getElementById("up-unpack-qty");
    const qtyEl = document.getElementById("up-qty");
    const noteEl = document.getElementById("up-note");
    const stockInEl = document.getElementById("up-stock-in");
    const custNameEl = document.getElementById("up-customer-name");

    const reportBox = String(reportBoxEl?.value || j.reportBox || "").trim();
    const unpackN = Number(unpackQtyEl?.value);
    const n = Number(qtyEl?.value);
    if (j.status !== "pending") {
      if (!Number.isFinite(unpackN) || unpackN < 0) {
        if (typeof setStatus === "function") setStatus("請填拆櫃數量。", true);
        return null;
      }
      if (!Number.isFinite(n) || n < 0) {
        if (typeof setStatus === "function") setStatus("請填外箱。", true);
        return null;
      }
      if (!reportBox) {
        if (typeof setStatus === "function") setStatus("請填拆櫃編號。", true);
        return null;
      }
    }

    let codes = Array.isArray(j.codes) ? j.codes.slice() : [];
    if (codesEl) {
      const raw = String(codesEl.value || "").trim();
      codes = raw
        ? raw
            .split(/[,，\s]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    }

    const location = j.location || "";
    const customerName =
      location === "customer"
        ? String(custNameEl?.value || j.customerName || "").trim()
        : "";
    if (location === "customer" && !customerName && j.status !== "pending") {
      if (typeof setStatus === "function") setStatus("請填客戶名稱。", true);
      return null;
    }

    const after = {
      ...jobAuditSnap(j),
      day: dayEl ? String(dayEl.value || j.day || "") : j.day,
      box: jobBoxEl ? String(jobBoxEl.value || "").trim() : j.box,
      name: nameEl ? String(nameEl.value || "").trim() : j.name,
      codes,
      customer: custEl ? String(custEl.value || "").trim() : j.customer,
      unloadPoint: unloadEl ? String(unloadEl.value || "").trim() : j.unloadPoint,
      assignee: whoEl ? String(whoEl.value || "").trim() : j.assignee,
      reportBox: reportBox || j.reportBox || "",
      unpackQty:
        unpackQtyEl && unpackQtyEl.value !== "" && Number.isFinite(unpackN) ? roundFn(unpackN) : j.unpackQty,
      qty: qtyEl && qtyEl.value !== "" && Number.isFinite(n) ? roundFn(n) : j.qty,
      stockIn: stockInEl ? !!stockInEl.checked : j.stockIn !== false,
      location: j.location || "",
      customerName: (j.location || "") === "customer" ? customerName : "",
      note: noteEl ? String(noteEl.value || "").trim() : j.note,
      photo: unpackPhotoDraft || j.photo || "",
    };
    return after;
  }

  function saveEditJob() {
    const j = jobById(unpackFocusId);
    if (!j || !canEditJob(j) || !unpackEditMode) {
      if (typeof setStatus === "function") setStatus("沒有修改權限。", true);
      return;
    }
    const before = jobAuditSnap(j);
    const after = collectEditAfter(j);
    if (!after) return;
    const changes = fieldDiffs(before, after);
    const photoChanged = (after.photo || "") !== (before.photo || "");
    if (!changes.length && !photoChanged) {
      if (typeof setStatus === "function") setStatus("沒有變更。", true);
      return;
    }
    if (photoChanged) changes.push("照片已更新");

    const gate = approvalGate(j, "edit");
    if (gate && !iAmNamed(gate.approver) && !isUnpackManager()) {
      if (
        !confirm(
          `${gate.label}。\n送出後請${gate.approver}${gate.verb}才會生效。\n變更：${changes.slice(0, 6).join("；")}${
            changes.length > 6 ? "…" : ""
          }\n確定送出？`,
        )
      ) {
        return;
      }
      enqueueApproval({
        id: uid("upa"),
        type: "edit",
        jobId: j.id,
        approver: gate.approver,
        tier: gate.tier,
        status: "pending",
        before,
        after,
        changes,
        summary: jobSummaryLine(j),
        requestedBy: staffName(),
        requestedAt: Date.now(),
        decidedBy: "",
        decidedAt: 0,
      });
      unpackEditMode = false;
      unpackPhotoDraft = "";
      save();
      if (typeof setStatus === "function") {
        setStatus(`已送出修改申請，請${gate.approver}${gate.verb}。`, false);
      }
      unpackListTab = "approve";
      unpackPhase = "list";
      unpackFocusId = "";
      renderUnpackList();
      return;
    }

    if (isStockConfirmed(j)) {
      if (
        !confirm(
          `此單已確認進貨。儲存會先沖回原庫存再依新資料入庫，並記入後台。\n變更：${changes.slice(0, 6).join("；")}${
            changes.length > 6 ? "…" : ""
          }\n確定儲存？`,
        )
      ) {
        return;
      }
    }
    applyApprovedEdit(j, after, changes);
    unpackEditMode = false;
    unpackPhotoDraft = "";
    save();
    if (typeof setStatus === "function") {
      setStatus(isStockConfirmed(j) ? "已儲存修改（已沖回並重算庫存）。" : "已儲存修改。", false);
    }
    renderUnpackDetail(j.id);
  }

  function requestOrDeleteJob(id) {
    const j = jobById(id);
    if (!j || !canDeleteJob(j)) {
      if (typeof setStatus === "function") setStatus("沒有刪除權限。", true);
      return;
    }
    const label = j.box || j.reportBox || j.name || "此筆";
    const gate = approvalGate(j, "delete");
    if (gate && !iAmNamed(gate.approver) && !isUnpackManager()) {
      if (
        !confirm(
          `確定申請刪除「${label}」？\n${gate.label}：送出後請${gate.approver}${gate.verb}才會刪除。`,
        )
      ) {
        return;
      }
      enqueueApproval({
        id: uid("upa"),
        type: "delete",
        jobId: j.id,
        approver: gate.approver,
        tier: gate.tier,
        status: "pending",
        before: jobAuditSnap(j),
        after: null,
        changes: ["刪除整筆"],
        summary: jobSummaryLine(j),
        requestedBy: staffName(),
        requestedAt: Date.now(),
        decidedBy: "",
        decidedAt: 0,
      });
      save();
      if (typeof setStatus === "function") {
        setStatus(`已送出刪除申請，請${gate.approver}${gate.verb}。`, false);
      }
      unpackEditMode = false;
      unpackListTab = "approve";
      unpackPhase = "list";
      unpackFocusId = "";
      unpackPhotoDraft = "";
      renderUnpackList();
      return;
    }
    if (!confirm(`確定刪除「${label}」？${isStockConfirmed(j) ? "\n已進倉資料會沖回庫存。" : ""}`)) return;
    applyDeleteJob(j);
    save();
    if (typeof setStatus === "function") setStatus("已刪除拆櫃單。", false);
    renderUnpackList();
  }

  function decideApproval(id, ok) {
    ensureState();
    const a = state.unpackApprovals.find((x) => x.id === id);
    if (!a || a.status !== "pending") return;
    const asBoss = typeof currentRole === "function" && currentRole() === "boss";
    if (!iAmNamed(a.approver) && !asBoss) {
      if (typeof setStatus === "function") setStatus(`僅${a.approver}可${a.tier === "stock" ? "核可" : "核對"}。`, true);
      return;
    }
    if (!ok) {
      a.status = "rejected";
      a.decidedBy = staffName();
      a.decidedAt = Date.now();
      save();
      if (typeof setStatus === "function") setStatus("已駁回申請。", false);
      renderUnpackList();
      return;
    }
    const j = jobById(a.jobId);
    if (a.type === "delete") {
      if (j) applyDeleteJob(j, { approvalId: a.id, approvedBy: staffName() });
    } else if (a.type === "edit") {
      if (!j) {
        if (typeof setStatus === "function") setStatus("原拆櫃單已不存在。", true);
        a.status = "rejected";
        a.decidedBy = staffName();
        a.decidedAt = Date.now();
        save();
        renderUnpackList();
        return;
      }
      applyApprovedEdit(j, a.after, a.changes, { approvalId: a.id, approvedBy: staffName() });
    }
    a.status = "approved";
    a.decidedBy = staffName();
    a.decidedAt = Date.now();
    save();
    if (typeof setStatus === "function") setStatus(ok ? "已核准並套用。" : "已駁回。", false);
    renderUnpackList();
  }

  window.unpackApprovalCountForMe = function () {
    try {
      return pendingApprovalsForMe().length;
    } catch (_) {
      return 0;
    }
  };

  function ensurePage() {
    let page = document.getElementById("page-unpack");
    if (page) return page;
    const app = document.querySelector(".app");
    if (!app) return null;
    page = document.createElement("section");
    page.id = "page-unpack";
    page.hidden = true;
    page.innerHTML = `
      <div id="up-list" class="up-list"></div>
      <div id="up-detail" class="up-detail" hidden></div>`;
    const status = document.getElementById("status");
    if (status) status.before(page);
    else app.appendChild(page);
    return page;
  }

  function ensureInExtras() {
    const formPane = document.querySelector('#in-swipe [data-in-pane-page="form"]');
    if (!formPane || formPane.dataset.upIn === "1") return;
    formPane.dataset.upIn = "1";
    const mount = document.createElement("div");
    mount.id = "in-extra-root";
    mount.className = "in-extra-root";
    const stockIn = document.getElementById("stock-in");
    if (stockIn) stockIn.before(mount);
    else formPane.prepend(mount);
  }

  function renderUnpackList() {
    const list = document.getElementById("up-list");
    const detail = document.getElementById("up-detail");
    if (!list || !detail) return;
    list.hidden = false;
    detail.hidden = true;
    const manage = canAssignUnpack();
    const staffOpts = unpackerNames()
      .map((n) => `<option value="${esc(n)}">${esc(n)}</option>`)
      .join("");
    const apprN = pendingApprovals().length;
    const apprMine = pendingApprovalsForMe().length;
    const showApproveTab = apprN > 0 || isUnpackManager() || iAmNamed(APPROVER_REPORT);
    const pathBack = `<nav class="imp-crumb-nav up-imp-path" aria-label="路徑">
      <button type="button" class="imp-path-link" data-up-go-home>首頁</button>
      <span class="imp-path-sep" aria-hidden="true">›</span>
      <button type="button" class="imp-path-link" data-up-go-import>進口</button>
      <span class="imp-path-sep" aria-hidden="true">›</span>
      <strong class="imp-path-here">拆櫃回報</strong>
    </nav>`;
    const tabs = `<nav class="up-tabs${showApproveTab ? " up-tabs-3" : ""}" aria-label="拆櫃清單切換">
        <button type="button" class="up-tab${unpackListTab === "pending" ? " on" : ""}" data-up-tab="pending">待回報</button>
        <button type="button" class="up-tab${unpackListTab === "reported" ? " on" : ""}" data-up-tab="reported">回報明細清單</button>
        ${
          showApproveTab
            ? `<button type="button" class="up-tab${unpackListTab === "approve" ? " on" : ""}" data-up-tab="approve">核對申請${
                apprMine ? ` ${apprMine}` : apprN ? ` ${apprN}` : ""
              }</button>`
            : ""
        }
      </nav>`;

    if (unpackListTab === "approve") {
      const rows = pendingApprovals();
      const card = (a) => {
        const canDecide = iAmNamed(a.approver) || (typeof currentRole === "function" && currentRole() === "boss");
        const when = fmtReportedAt(a.requestedAt);
        const ch = (a.changes || []).slice(0, 8).map((c) => esc(c)).join("、") || "—";
        return `<article class="up-card is-reported">
          <div class="up-card-main" style="cursor:default">
            <div class="up-card-top">
              <strong>${esc(a.type === "delete" ? "刪除申請" : "修改申請")}</strong>
              <em>${esc(a.approver)} ${esc(a.tier === "stock" ? "核可" : "核對")}</em>
            </div>
            <p class="up-card-name">${esc(a.summary || "")}</p>
            <p class="up-card-meta">${esc(a.requestedBy || "")}${when ? `　${esc(when)}` : ""}</p>
            <p class="muted">變更：${ch}</p>
          </div>
          ${
            canDecide
              ? `<div class="up-card-acts">
                  <button type="button" class="primary" data-up-approve="${esc(a.id)}">通過</button>
                  <button type="button" class="ghost up-del" data-up-reject="${esc(a.id)}">駁回</button>
                </div>`
              : `<p class="muted" style="padding:0 0.75rem 0.75rem">等待 ${esc(a.approver)} 處理。</p>`
          }
        </article>`;
      };
      list.innerHTML = `
        ${pathBack}
        <header class="up-head">
          <h2>拆櫃核對申請</h2>
          <p class="muted">申報後修改／刪除由${APPROVER_REPORT}核對；通過後才生效。</p>
        </header>
        ${tabs}
        <section class="up-sec">
          <h3>待處理 ${rows.length}</h3>
          <div class="up-cards">${
            rows.length ? rows.map(card).join("") : `<p class="up-empty">目前沒有待核對申請。</p>`
          }</div>
        </section>`;
      return;
    }

    if (unpackListTab === "reported") {
      const rows = reportedDetailJobs();
      const detailCard = (j) => {
        const codes = (j.codes || []).filter(Boolean);
        const tone = j.status === "confirmed" ? "is-confirmed" : "is-reported";
        const when = fmtReportedAt(j.reportedAt);
        const custBits = [j.customer, j.unloadPoint].filter(Boolean).join(" · ");
        return `<article class="up-card up-detail-card ${tone}">
          <button type="button" class="up-card-main" data-up-open="${esc(j.id)}">
            <div class="up-card-top">
              <strong>${esc(j.box || "—")}</strong>
              <em>${esc(statusLabel(j))}</em>
            </div>
            <p class="up-card-name">${esc(j.name || "—")}${j.country ? ` · ${esc(j.country)}` : ""}</p>
            <p class="up-card-meta">${esc(j.day)}${j.assignee ? `　負責 ${esc(j.assignee)}` : ""}${
              when ? `　回報 ${esc(when)}` : ""
            }${j.reportedBy ? `（${esc(j.reportedBy)}）` : ""}</p>
            <dl class="up-detail-dl">
              <div><dt>拆櫃編號</dt><dd>${esc(j.reportBox || j.box || "—")}</dd></div>
              <div><dt>貨櫃號碼</dt><dd>${codes.length ? codes.map((c) => esc(c)).join("、") : "—"}</dd></div>
              <div><dt>拆櫃數量</dt><dd>${j.unpackQty != null ? esc(String(j.unpackQty)) : "—"}</dd></div>
              <div><dt>外箱</dt><dd>${j.qty != null ? esc(String(j.qty)) : "—"}</dd></div>
              <div><dt>入庫</dt><dd>${j.stockIn === false ? "否" : "是"}</dd></div>
              <div><dt>拆櫃位置</dt><dd>${esc(locDisplay(j))}</dd></div>
              ${
                custBits
                  ? `<div class="span2"><dt>交櫃／卸貨</dt><dd>${esc(custBits)}</dd></div>`
                  : ""
              }
              ${j.note ? `<div class="span2"><dt>備註</dt><dd>${esc(j.note)}</dd></div>` : ""}
            </dl>
          </button>
          ${jobActionBar(j)}
        </article>`;
      };
      list.innerHTML = `
        ${pathBack}
        <header class="up-head">
          <h2>${iAmUnpacker() ? "我的拆櫃回報" : "拆櫃回報"}</h2>
          <p class="muted">回報明細清單僅顯示近 ${REPORTED_DETAIL_DAYS} 日已回報資料；有權限者可修改或刪除（異動會記入主管後台）。</p>
        </header>
        ${tabs}
        <section class="up-sec">
          <h3>回報明細清單 ${rows.length}</h3>
          <div class="up-cards">${
            rows.length
              ? rows.map(detailCard).join("")
              : `<p class="up-empty">近 ${REPORTED_DETAIL_DAYS} 日尚無已回報資料。</p>`
          }</div>
        </section>`;
      return;
    }

    const jobs = visibleJobs();
    const pending = jobs.filter((j) => j.status === "pending");
    const reported = iAmUnpacker() ? [] : jobs.filter((j) => j.status === "reported");
    const card = (j, tone) => {
      const codes = (j.codes || []).length;
      const who = j.assignee ? `負責 ${esc(j.assignee)}` : "未指派";
      const custBits = [j.customer, j.unloadPoint].filter(Boolean).join(" · ");
      const assign =
        manage && j.status === "pending"
          ? `<label class="up-assign" onclick="event.stopPropagation()">拆工
              <select data-up-assign="${esc(j.id)}">
                <option value="">未指派</option>
                ${unpackerNames()
                  .map(
                    (n) =>
                      `<option value="${esc(n)}"${j.assignee === n ? " selected" : ""}>${esc(n)}</option>`,
                  )
                  .join("")}
              </select>
            </label>`
          : "";
      return `<div class="up-card ${tone}">
        <button type="button" class="up-card-main" data-up-open="${esc(j.id)}">
          <div class="up-card-top">
            <strong>${esc(j.box || "—")}</strong>
            <em>${esc(statusLabel(j))}</em>
          </div>
          <p class="up-card-name">${esc(j.name || "—")}${j.country ? ` · ${esc(j.country)}` : ""}</p>
          <p class="up-card-meta">${esc(j.day)}　貨櫃號碼 ${codes} 組　${who}${
            custBits ? `　交櫃 ${esc(custBits)}` : ""
          }</p>
        </button>
        ${assign}
        ${jobActionBar(j)}
      </div>`;
    };
    const manual = manage
      ? `<section class="up-manual">
          <h3>手動指派・新增填寫</h3>
          <div class="up-manual-grid">
            <label>拆櫃日 <input id="up-new-day" type="date" value="${esc(today())}" /></label>
            <label>負責拆工
              <select id="up-new-who"><option value="">請選擇</option>${staffOpts}</select>
            </label>
            <label>貨櫃編號（標籤號） <input id="up-new-box" type="text" placeholder="例如 UHA223" autocomplete="off" /></label>
            <label>品名 <input id="up-new-name" type="text" placeholder="例如 高麗菜" autocomplete="off" /></label>
            <label>交櫃客戶
              <input id="up-new-customer" type="text" list="up-cust-list" placeholder="姓名，選填" autocomplete="off" spellcheck="false" lang="zh-Hant" />
            </label>
            <label>卸貨點
              <input id="up-new-unload" type="text" placeholder="填客戶後可自動代入" autocomplete="off" />
            </label>
            <label class="span2">貨櫃號碼（實際貨櫃號碼） <input id="up-new-codes" type="text" placeholder="實際貨櫃號碼" autocomplete="off" /></label>
            <label class="span2">備註 <input id="up-new-note" type="text" placeholder="選填" /></label>
          </div>
          <datalist id="up-cust-list">${customerOptionsHtml()}</datalist>
          <button type="button" class="primary" id="up-manual-add">加入並指派</button>
        </section>`
      : "";
    list.innerHTML = `
      ${pathBack}
      <header class="up-head">
        <h2>${iAmUnpacker() ? "我的拆櫃回報" : "拆櫃回報"}</h2>
        <p class="muted">${
          iAmUnpacker()
            ? "只顯示指派給你的貨櫃。點開回報拆櫃數量、外箱、入庫與拆櫃位置。回報後可到「回報明細清單」核對。"
            : "可從標籤彙整，或手動加入編號並指派拆工（阿宏／靜宜）。"
        }</p>
      </header>
      ${tabs}
      ${manual}
      <section class="up-sec">
        <h3>${iAmUnpacker() ? "待我回報" : "待回報"} ${pending.length}</h3>
        <div class="up-cards">${
          pending.length
            ? pending.map((j) => card(j, "is-pending")).join("")
            : `<p class="up-empty">${iAmUnpacker() ? "目前沒有指派給你的貨櫃。" : "目前沒有待回報。可手動加入或先列印貨櫃標籤。"}</p>`
        }</div>
      </section>
      ${
        iAmUnpacker()
          ? ""
          : `<section class="up-sec">
        <h3>已回報・待進貨確認 ${reported.length}</h3>
        <div class="up-cards">${reported.length ? reported.map((j) => card(j, "is-reported")).join("") : `<p class="up-empty">尚無已回報。</p>`}</div>
      </section>`
      }`;
  }

  function addManualJob() {
    if (!canAssignUnpack()) return setStatus("沒有指派權限。", true);
    ensureState();
    const day = String(document.getElementById("up-new-day")?.value || today());
    const who = String(document.getElementById("up-new-who")?.value || "").trim();
    const box = String(document.getElementById("up-new-box")?.value || "").trim();
    const name = String(document.getElementById("up-new-name")?.value || "").trim();
    const customer = String(document.getElementById("up-new-customer")?.value || "").trim();
    const unloadPoint = String(document.getElementById("up-new-unload")?.value || "").trim();
    const note = String(document.getElementById("up-new-note")?.value || "").trim();
    const codesRaw = String(document.getElementById("up-new-codes")?.value || "").trim();
    const codes = codesRaw
      ? codesRaw.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean)
      : box
        ? [box]
        : [];
    if (!who) return setStatus("請選負責拆工。", true);
    if (!box && !codes.length) return setStatus("請填貨櫃編號或貨櫃號碼。", true);
    if (!unpackerNames().includes(who)) return setStatus("拆工只能選阿宏或靜宜。", true);
    if (customer && unloadPoint && typeof rememberShipAddr === "function") {
      rememberShipAddr(customer, unloadPoint);
    }
    state.unpackJobs.unshift({
      id: uid("up"),
      printKey: `manual-${Date.now()}`,
      day,
      box: box || codes[0] || "",
      name: name || "（手動）",
      country: "",
      vendor: "",
      codes,
      assignee: who,
      status: "pending",
      ...blankJobFields(),
      customer,
      unloadPoint,
      note,
      reportedBy: "",
      reportedAt: 0,
      confirmedBy: "",
      confirmedAt: 0,
      ledgerId: "",
      manual: true,
    });
    save();
    setStatus(`已加入待回報，指派給 ${who}。`, false);
    renderUnpackList();
  }

  function assignJob(id, who, assignQty) {
    if (!canAssignUnpack()) return false;
    const j = jobById(id);
    if (!j || j.status !== "pending") return false;
    j.assignee = who || "";
    if (assignQty !== undefined && assignQty !== null && assignQty !== "") {
      const n = Number(assignQty);
      j.assignQty = Number.isFinite(n) && n >= 0 ? n : null;
    }
    save();
    if (typeof setStatus === "function") {
      setStatus(who ? `已指派給 ${who}` : "已取消指派", false);
    }
    if (document.getElementById("up-list") && !document.querySelector("#import-root .imp-tw")) {
      renderUnpackList();
    }
    return true;
  }

  function renderUnpackDetail(id) {
    const list = document.getElementById("up-list");
    const detail = document.getElementById("up-detail");
    const j = jobById(id);
    if (!list || !detail || !j || !jobAllowed(j)) {
      unpackPhase = "list";
      unpackEditMode = false;
      renderUnpackList();
      if (j && !jobAllowed(j) && typeof setStatus === "function") {
        setStatus("這櫃不是指派給你的。", true);
      }
      return;
    }
    list.hidden = true;
    detail.hidden = false;
    unpackFocusId = j.id;
    if (unpackEditMode && !canEditJob(j)) unpackEditMode = false;
    const editing = !!unpackEditMode;
    const reportFill = j.status === "pending" && !editing;
    const locked = !editing && j.status !== "pending";
    const fieldsOpen = editing || reportFill;
    const codesText = (j.codes || []).filter(Boolean).join("、");
    const codesList = (j.codes || []).map((c) => `<li><code>${esc(c)}</code></li>`).join("");
    const isCustomer = j.location === "customer";
    const locOpts = warehouseOpts()
      .map(
        (w) =>
          `<button type="button" class="pick${j.location === w.id ? " on" : ""}" data-up-loc="${esc(w.id)}" ${
            fieldsOpen ? "" : "disabled"
          }>${esc(w.label)}</button>`,
      )
      .join("");
    const custBtn = `<button type="button" class="pick${isCustomer ? " on" : ""}" data-up-loc="customer" ${
      fieldsOpen ? "" : "disabled"
    }>客戶</button>`;
    const staffOpts = unpackerNames()
      .map((n) => `<option value="${esc(n)}"${j.assignee === n ? " selected" : ""}>${esc(n)}</option>`)
      .join("");
    const manageActs = [];
    if (!editing && canEditJob(j)) {
      manageActs.push(
        `<button type="button" class="primary" data-up-edit="${esc(j.id)}">修改</button>`,
      );
    }
    if (canDeleteJob(j)) {
      manageActs.push(
        `<button type="button" class="ghost up-del" data-up-del="${esc(j.id)}">刪除</button>`,
      );
    }
    const identityBlock = editing
      ? `<section class="up-form up-edit-identity">
        <label>拆櫃日 <input id="up-day" type="date" value="${esc(j.day || "")}" /></label>
        <label>貨櫃編號（標籤號）
          <input id="up-job-box" type="text" value="${esc(j.box || "")}" placeholder="例如 UHA223" autocomplete="off" />
        </label>
        <label>品名 <input id="up-job-name" type="text" value="${esc(j.name || "")}" autocomplete="off" /></label>
        <label class="span2">貨櫃號碼（實際貨櫃號碼）
          <input id="up-job-codes" type="text" value="${esc(codesText)}" placeholder="多組用逗號或空白分隔" autocomplete="off" />
        </label>
        <label>交櫃客戶
          <input id="up-job-customer" type="text" list="up-edit-cust-list" value="${esc(j.customer || "")}" placeholder="姓名，選填" autocomplete="off" spellcheck="false" lang="zh-Hant" />
        </label>
        <label>卸貨點
          <input id="up-job-unload" type="text" value="${esc(j.unloadPoint || "")}" placeholder="選填" autocomplete="off" />
        </label>
        ${
          isUnpackManager()
            ? `<label>負責拆工
                <select id="up-job-assignee"><option value="">未指派</option>${staffOpts}</select>
              </label>`
            : ""
        }
        <datalist id="up-edit-cust-list">${customerOptionsHtml()}</datalist>
      </section>`
      : `<section class="up-box-card">
        <p class="up-lab">貨櫃編號（標籤號）</p>
        <p class="up-box-no">${esc(j.box || "—")}</p>
        <p class="muted">${esc([j.country, j.vendor].filter(Boolean).join(" · "))}</p>
      </section>
      <section class="up-codes">
        <h3>貨櫃號碼（實際貨櫃號碼）</h3>
        <ul>${codesList || "<li class='muted'>無號碼</li>"}</ul>
      </section>`;

    detail.innerHTML = `
      <header class="up-detail-bar">
        <button type="button" class="ghost" data-up-back>返回</button>
        <div>
          <strong>${esc(j.day)} 拆櫃${editing ? " · 修改中" : ""}</strong>
          <span class="muted">${esc(j.name || "")}${j.assignee ? ` · ${esc(j.assignee)}` : ""} · ${esc(statusLabel(j))}</span>
          ${
            !editing && (j.customer || j.unloadPoint)
              ? `<p class="muted up-detail-cust">交櫃 ${esc([j.customer, j.unloadPoint].filter(Boolean).join(" · "))}</p>`
              : ""
          }
        </div>
        ${manageActs.length ? `<div class="up-detail-acts">${manageActs.join("")}</div>` : ""}
      </header>
      ${identityBlock}
      <section class="up-form">
        <label>拆櫃編號
          <input id="up-box" type="text" value="${esc(j.reportBox || (j.codes && j.codes[0]) || j.box || "")}" placeholder="本筆回報編號" autocomplete="off" ${
            fieldsOpen ? "" : "readonly"
          } />
        </label>
        <label>拆櫃數量
          <input id="up-unpack-qty" type="number" min="0" step="1" inputmode="decimal" value="${
            j.unpackQty != null ? esc(String(j.unpackQty)) : ""
          }" placeholder="拆櫃數量" ${fieldsOpen ? "" : "readonly"} />
        </label>
        <label>外箱
          <input id="up-qty" type="number" min="0" step="1" inputmode="decimal" value="${
            j.qty != null ? esc(String(j.qty)) : ""
          }" placeholder="外箱數" ${fieldsOpen ? "" : "readonly"} />
        </label>
        <label class="up-check">
          <input id="up-stock-in" type="checkbox" ${j.stockIn !== false ? "checked" : ""} ${
            fieldsOpen ? "" : "disabled"
          } />
          <span>入庫</span>
        </label>
        <div class="up-loc-block">
          <p class="up-lab">拆櫃位置</p>
          <p class="up-loc-sub muted">所有倉庫</p>
          <div class="picks">${locOpts}${custBtn}</div>
          ${
            isCustomer
              ? `<label class="up-cust-name">客戶名稱
                  <input id="up-customer-name" type="text" value="${esc(j.customerName || "")}" placeholder="填客戶名稱" autocomplete="off" ${
                    fieldsOpen ? "" : "readonly"
                  } />
                </label>`
              : ""
          }
        </div>
        <label>備註
          <input id="up-note" type="text" value="${esc(j.note || "")}" placeholder="選填" ${
            fieldsOpen ? "" : "readonly"
          } />
        </label>
        <div class="up-photo">
          <p class="up-lab">拍照</p>
          ${
            !fieldsOpen
              ? j.photo
                ? `<img class="up-photo-img" src="${j.photo}" alt="拆櫃照片" />`
                : `<p class="muted">未拍照</p>`
              : `<input id="up-photo" type="file" accept="image/*" capture="environment" />
                 <div id="up-photo-preview">${
                   j.photo || unpackPhotoDraft
                     ? `<img class="up-photo-img" src="${j.photo || unpackPhotoDraft}" alt="預覽" />`
                     : ""
                 }</div>`
          }
        </div>
        ${
          editing
            ? `<div class="up-edit-actions">
                <button type="button" class="primary" data-up-save-edit>儲存修改</button>
                <button type="button" class="ghost" data-up-cancel-edit>取消</button>
                ${
                  isStockConfirmed(j)
                    ? `<p class="muted up-edit-warn">已確認進貨：儲存會先沖回原庫存再依新資料入庫，並記入後台。</p>`
                    : ""
                }
              </div>`
            : locked
              ? `<div class="up-locked-block">
                  ${
                    manageActs.length
                      ? `<div class="up-locked-actions">${manageActs.join("")}</div>`
                      : ""
                  }
                  <p class="up-done-note">${
                    iAmUnpacker()
                      ? j.status === "confirmed"
                        ? "已確認進貨。拆工不可直接改已進倉單，請現場／會計／主管修改或刪除。"
                        : j.stockIn === false
                          ? "已回報（未勾選入庫）。可點「修改」更正（送子羽核對）。"
                          : "已回報並勾選入庫，等待會計確認進貨。可點「修改」更正（送子羽核對）。"
                      : j.status === "confirmed"
                        ? `已確認進貨${j.confirmedBy ? `（${esc(j.confirmedBy)}）` : ""}。可修改或刪除（會沖回庫存並記入後台）。`
                        : j.stockIn === false
                          ? `已回報${j.reportedBy ? `（${esc(j.reportedBy)}）` : ""}（未勾選入庫）。`
                          : `已回報${j.reportedBy ? `（${esc(j.reportedBy)}）` : ""}。請到「進貨」由會計確認登入。`
                  }</p>
                  ${
                    !iAmUnpacker() && j.status === "reported" && j.stockIn !== false
                      ? `<button type="button" class="primary" data-up-to-in>前往進貨確認</button>`
                      : ""
                  }
                </div>`
              : `<button type="button" class="primary" data-up-submit>完成拆櫃回報</button>`
        }
      </section>`;
  }

  function readPhotoFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve("");
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read"));
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 1280;
          let w = img.width;
          let h = img.height;
          if (w > max || h > max) {
            const s = Math.min(max / w, max / h);
            w = Math.round(w * s);
            h = Math.round(h * s);
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.72));
        };
        img.onerror = () => resolve(String(reader.result || ""));
        img.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  async function submitReport() {
    const j = jobById(unpackFocusId);
    if (!j || j.status !== "pending" || !jobAllowed(j)) return;
    const unpackQtyEl = document.getElementById("up-unpack-qty");
    const qtyEl = document.getElementById("up-qty");
    const boxEl = document.getElementById("up-box");
    const noteEl = document.getElementById("up-note");
    const stockInEl = document.getElementById("up-stock-in");
    const custEl = document.getElementById("up-customer-name");
    const unpackN = Number(unpackQtyEl?.value);
    if (!Number.isFinite(unpackN) || unpackN < 0) {
      if (typeof setStatus === "function") setStatus("請填拆櫃數量。", true);
      return;
    }
    const n = Number(qtyEl?.value);
    if (!Number.isFinite(n) || n < 0) {
      if (typeof setStatus === "function") setStatus("請填外箱。", true);
      return;
    }
    const box = String(boxEl?.value || "").trim();
    if (!box) {
      if (typeof setStatus === "function") setStatus("請填拆櫃編號。", true);
      return;
    }
    if (!j.location) {
      if (typeof setStatus === "function") setStatus("請選拆櫃位置（倉庫或客戶）。", true);
      return;
    }
    const customerName =
      j.location === "customer" ? String(custEl?.value || j.customerName || "").trim() : "";
    if (j.location === "customer" && !customerName) {
      if (typeof setStatus === "function") setStatus("請填客戶名稱。", true);
      return;
    }
    const wantStockIn = !!(stockInEl && stockInEl.checked);
    const roundFn = typeof round === "function" ? round : (x) => x;
    j.unpackQty = roundFn(unpackN);
    j.qty = roundFn(n);
    j.reportBox = box;
    j.stockIn = wantStockIn;
    j.customerName = j.location === "customer" ? customerName : "";
    j.note = String(noteEl?.value || "").trim();
    if (unpackPhotoDraft) j.photo = unpackPhotoDraft;
    j.status = "reported";
    j.reportedBy = typeof currentStaff === "function" ? currentStaff() || "" : "";
    j.reportedAt = Date.now();
    // 勾選入庫 → 轉到進貨待確認（倉庫入庫；客戶位置僅記錄、不入倉）
    if (wantStockIn) {
      const ledgerId = uid("in");
      const locNote =
        j.location === "customer"
          ? `客戶 ${j.customerName}`
          : `位置 ${whName(j.location)}`;
      state.inboundLedger.push({
        id: ledgerId,
        source: "unpack",
        unpackId: j.id,
        day: j.day,
        code: j.reportBox || (j.codes && j.codes[0]) || j.box,
        name: j.name,
        qty: j.qty,
        unpackQty: j.unpackQty,
        note: [
          j.note,
          j.country,
          j.vendor,
          `拆櫃 ${j.reportBox || j.box}`,
          `拆櫃數量 ${j.unpackQty}`,
          `外箱 ${j.qty}`,
          locNote,
        ]
          .filter(Boolean)
          .join(" · "),
        warehouse: j.location === "customer" ? "customer" : j.location,
        customerName: j.customerName || "",
        photo: j.photo || "",
        status: "pending", // pending | confirmed
        by: "",
        at: 0,
        createdAt: Date.now(),
        createdBy: j.reportedBy,
      });
      j.ledgerId = ledgerId;
    } else {
      j.ledgerId = "";
    }
    unpackPhotoDraft = "";
    save();
    if (typeof setStatus === "function") {
      const msg = wantStockIn
        ? iAmUnpacker()
          ? "已回報並勾選入庫，謝謝。"
          : "已回報，已轉到進貨待確認。"
        : iAmUnpacker()
          ? "已回報（未勾選入庫）。"
          : "已回報（未勾選入庫，未轉進貨）。";
      setStatus(msg, false);
    }
    if (iAmUnpacker()) {
      unpackPhase = "list";
      unpackListTab = "reported";
      unpackFocusId = "";
      renderUnpackList();
    } else {
      unpackPhase = "detail";
      renderUnpackDetail(j.id);
    }
  }

  function confirmLedger(id) {
    ensureState();
    if (typeof can === "function" && !can("unpack-confirm") && !can("page-books")) {
      if (typeof setStatus === "function") setStatus("請由會計確認進貨。", true);
      return;
    }
    const row = state.inboundLedger.find((x) => x.id === id);
    if (!row || row.status === "confirmed") return;
    row.status = "confirmed";
    row.by = typeof currentStaff === "function" ? currentStaff() || "" : "";
    row.at = Date.now();
    const wh = row.warehouse || "A";
    const isCustomer = wh === "customer";
    // 客戶位置：確認回報但不寫入倉庫庫存
    if (!isCustomer) {
      if (!Array.isArray(state.wareItems[wh])) state.wareItems[wh] = [];
      let item = state.wareItems[wh].find(
        (it) => String(it.code || "").toLowerCase() === String(row.code || "").toLowerCase(),
      );
      if (!item) {
        item = { id: uid("wi"), code: row.code || row.name, name: row.name || row.code };
        state.wareItems[wh].push(item);
      } else if (row.name) {
        item.name = row.name;
      }
      if (!state.stockCount || typeof state.stockCount !== "object") state.stockCount = {};
      if (!state.stockCount[row.day]) state.stockCount[row.day] = {};
      if (!state.stockCount[row.day][wh]) state.stockCount[row.day][wh] = { qty: {}, notes: {}, confirmed: false };
      const bucket = state.stockCount[row.day][wh];
      if (!bucket.qty) bucket.qty = {};
      if (!bucket.notes) bucket.notes = {};
      const prev = Number(bucket.qty[item.id]) || 0;
      bucket.qty[item.id] = typeof round === "function" ? round(prev + Number(row.qty || 0)) : prev + Number(row.qty || 0);
      if (row.note) bucket.notes[item.id] = row.note;
    }
    const job = row.unpackId ? jobById(row.unpackId) : null;
    if (job) {
      job.status = "confirmed";
      job.confirmedBy = row.by;
      job.confirmedAt = row.at;
    }
    save();
    if (typeof setStatus === "function") {
      const dest = isCustomer
        ? `客戶${row.customerName ? `「${row.customerName}」` : ""}`
        : whName(wh);
      setStatus(`已確認進貨「${row.code || ""} ${row.name || ""}」${fmt(row.qty)} → ${dest}。`, false);
    }
    renderInboundExtras();
  }

  function addManualInbound() {
    ensureState();
    if (typeof can === "function" && !can("page-books")) {
      if (typeof setStatus === "function") setStatus("沒有進貨權限。", true);
      return;
    }
    const day = String(document.getElementById("in-new-day")?.value || today());
    const code = String(document.getElementById("in-new-code")?.value || "").trim();
    const name = String(document.getElementById("in-new-name")?.value || "").trim();
    const qtyRaw = document.getElementById("in-new-qty")?.value;
    const note = String(document.getElementById("in-new-note")?.value || "").trim();
    const warehouse = String(document.getElementById("in-new-wh")?.value || "").trim();
    const n = Number(qtyRaw);
    if (!day) return setStatus("請填進貨日。", true);
    if (!code) return setStatus("請填編號。", true);
    if (!name) return setStatus("請填品項。", true);
    if (!Number.isFinite(n) || n < 0) return setStatus("請填件數。", true);
    if (!warehouse) return setStatus("請選進貨倉庫別。", true);
    const id = uid("in");
    state.inboundLedger.push({
      id,
      source: "manual",
      day,
      code,
      name,
      qty: typeof round === "function" ? round(n) : n,
      note,
      warehouse,
      photo: "",
      status: "pending",
      by: "",
      at: 0,
      createdAt: Date.now(),
      createdBy: typeof currentStaff === "function" ? currentStaff() || "" : "",
    });
    save();
    setStatus("已新增進貨待確認。", false);
    ["in-new-code", "in-new-name", "in-new-qty", "in-new-note"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    renderInboundExtras();
  }

  function renderInboundExtras() {
    ensureInExtras();
    const root = document.getElementById("in-extra-root");
    if (!root) return;
    ensureState();
    syncJobsFromLabels();
    const pending = state.inboundLedger.filter((r) => r.status === "pending");
    const recent = state.inboundLedger.filter((r) => r.status === "confirmed").slice(-8).reverse();
    const whSel = warehouseOpts().map((w) => `<option value="${esc(w.id)}">${esc(w.label)}</option>`).join("");
    const pendingHtml = pending.length
      ? pending
          .map((r) => {
            const photo = r.photo ? `<img class="up-photo-img sm" src="${r.photo}" alt="" />` : "";
            const dest =
              r.warehouse === "customer"
                ? `客戶${r.customerName ? ` · ${esc(r.customerName)}` : ""}`
                : esc(whName(r.warehouse));
            const unpackQtyNote =
              r.unpackQty != null ? `　拆櫃數量 ${fmt(r.unpackQty)}` : "";
            return `<article class="in-pend-card">
              <div class="in-pend-top">
                <strong>${esc(r.day)}</strong>
                <em>${r.source === "unpack" ? "拆櫃" : "手動"}</em>
              </div>
              <p><span class="wh-code">${esc(r.code)}</span> ${esc(r.name)}</p>
              <p class="muted">外箱 ${fmt(r.qty)}${unpackQtyNote}　位置 ${dest}${r.note ? `　${esc(r.note)}` : ""}</p>
              ${photo}
              <button type="button" class="primary" data-in-confirm="${esc(r.id)}">確認進貨</button>
            </article>`;
          })
          .join("")
      : `<p class="up-empty">目前沒有待確認進貨。</p>`;
    root.innerHTML = `
      <section class="in-add-card">
        <h3>新增進貨品項</h3>
        <div class="in-add-grid">
          <label>進貨日 <input id="in-new-day" type="date" value="${esc(typeof inViewDay === "function" ? inViewDay() : today())}" /></label>
          <label>編號 <input id="in-new-code" type="text" placeholder="貨櫃號碼／自編" autocomplete="off" /></label>
          <label>品項 <input id="in-new-name" type="text" placeholder="品名" autocomplete="off" /></label>
          <label>件數 <input id="in-new-qty" type="number" min="0" step="1" inputmode="decimal" /></label>
          <label>進貨倉庫別
            <select id="in-new-wh"><option value="">請選擇</option>${whSel}</select>
          </label>
          <label class="span2">備註 <input id="in-new-note" type="text" placeholder="選填" /></label>
        </div>
        <button type="button" class="primary" id="in-add-btn">加入待確認</button>
      </section>
      <section class="in-pend-sec">
        <h3>待確認進貨 ${pending.length}</h3>
        <p class="muted">拆櫃回報後會出現在這裡，會計確認後入倉庫。</p>
        <div class="in-pend-list">${pendingHtml}</div>
      </section>
      ${
        recent.length
          ? `<section class="in-pend-sec"><h3>最近已確認</h3><ul class="in-done-list">${recent
              .map(
                (r) =>
                  `<li><strong>${esc(r.day)}</strong> ${esc(r.code)} ${esc(r.name)}　${fmt(r.qty)} → ${
                    r.warehouse === "customer"
                      ? `客戶${r.customerName ? ` · ${esc(r.customerName)}` : ""}`
                      : esc(whName(r.warehouse))
                  }</li>`,
              )
              .join("")}</ul></section>`
          : ""
      }`;
  }

  function renderUnpackPage() {
    ensurePage();
    const pageEl = document.getElementById("page-unpack");
    if (!pageEl) return;
    if (typeof can === "function" && !can("page-unpack") && !can("page-books")) {
      pageEl.innerHTML = `<p class="muted">沒有拆櫃回報權限。</p>`;
      return;
    }
    if (!document.getElementById("up-list")) {
      pageEl.innerHTML = `<div id="up-list" class="up-list"></div><div id="up-detail" class="up-detail" hidden></div>`;
    }
    if (unpackPhase === "detail" && unpackFocusId) renderUnpackDetail(unpackFocusId);
    else {
      unpackPhase = "list";
      renderUnpackList();
    }
    document.getElementById("co-name") &&
      (document.getElementById("co-name").textContent = "拆櫃回報");
  }

  function snapshotReportForm(j) {
    if (!j) return;
    if (j.status !== "pending" && !unpackEditMode) return;
    const unpackQtyEl = document.getElementById("up-unpack-qty");
    const qtyEl = document.getElementById("up-qty");
    const boxEl = document.getElementById("up-box");
    const noteEl = document.getElementById("up-note");
    const stockInEl = document.getElementById("up-stock-in");
    const custEl = document.getElementById("up-customer-name");
    if (unpackQtyEl && unpackQtyEl.value !== "") {
      const n = Number(unpackQtyEl.value);
      if (Number.isFinite(n)) j.unpackQty = n;
    }
    if (qtyEl && qtyEl.value !== "") {
      const n = Number(qtyEl.value);
      if (Number.isFinite(n)) j.qty = n;
    }
    if (boxEl) j.reportBox = String(boxEl.value || "").trim();
    if (noteEl) j.note = String(noteEl.value || "").trim();
    if (stockInEl) j.stockIn = !!stockInEl.checked;
    if (custEl) j.customerName = String(custEl.value || "").trim();
  }

  function bindOnce() {
    // v4: force rebind — earlier builds set upBound=1/3 without working edit/delete
    if (document.body.dataset.upBound === "4") return;
    document.body.dataset.upBound = "4";
    document.body.addEventListener("click", (e) => {
      if (e.target.closest("[data-up-go-home]")) {
        page = "home";
        if (typeof hubDept !== "undefined") hubDept = "";
        if (typeof hubOpen !== "undefined") hubOpen = "";
        if (typeof render === "function") render();
        return;
      }
      if (e.target.closest("[data-up-go-import]")) {
        if (typeof window.openImport === "function") window.openImport("hub");
        else {
          page = "import";
          if (typeof render === "function") render();
        }
        return;
      }
      // Edit / delete / save MUST be handled before data-up-open (card body).
      const editBtn = e.target.closest("[data-up-edit]");
      if (editBtn && !editBtn.disabled) {
        e.preventDefault();
        e.stopPropagation();
        startEditJob(editBtn.getAttribute("data-up-edit") || "");
        return;
      }
      const delBtn = e.target.closest("[data-up-del]");
      if (delBtn && !delBtn.disabled) {
        e.preventDefault();
        e.stopPropagation();
        requestOrDeleteJob(delBtn.getAttribute("data-up-del") || "");
        return;
      }
      if (e.target.closest("[data-up-save-edit]")) {
        e.preventDefault();
        e.stopPropagation();
        saveEditJob();
        return;
      }
      if (e.target.closest("[data-up-cancel-edit]")) {
        e.preventDefault();
        e.stopPropagation();
        cancelEditJob();
        return;
      }
      const appr = e.target.closest("[data-up-approve]");
      if (appr) {
        e.preventDefault();
        decideApproval(appr.getAttribute("data-up-approve") || "", true);
        return;
      }
      const rej = e.target.closest("[data-up-reject]");
      if (rej) {
        e.preventDefault();
        decideApproval(rej.getAttribute("data-up-reject") || "", false);
        return;
      }

      const tab = e.target.closest("[data-up-tab]");
      if (tab) {
        const t = tab.getAttribute("data-up-tab") || "pending";
        unpackListTab = t === "reported" ? "reported" : t === "approve" ? "approve" : "pending";
        unpackPhase = "list";
        unpackFocusId = "";
        unpackPhotoDraft = "";
        unpackEditMode = false;
        renderUnpackList();
        return;
      }
      const open = e.target.closest("[data-up-open]");
      if (open) {
        unpackPhase = "detail";
        unpackFocusId = open.getAttribute("data-up-open") || "";
        unpackPhotoDraft = "";
        unpackEditMode = false;
        renderUnpackDetail(unpackFocusId);
        return;
      }
      if (e.target.closest("[data-up-back]")) {
        unpackPhase = "list";
        unpackFocusId = "";
        unpackPhotoDraft = "";
        unpackEditMode = false;
        renderUnpackList();
        return;
      }
      const loc = e.target.closest("[data-up-loc]");
      if (loc) {
        const j = jobById(unpackFocusId);
        if (!j) return;
        if (j.status !== "pending" && !unpackEditMode) return;
        snapshotReportForm(j);
        const next = loc.getAttribute("data-up-loc") || "";
        j.location = next;
        if (next !== "customer") j.customerName = "";
        renderUnpackDetail(j.id);
        return;
      }
      if (e.target.closest("#up-manual-add")) {
        addManualJob();
        return;
      }
      if (e.target.closest("[data-up-submit]")) {
        submitReport();
        return;
      }
      if (e.target.closest("[data-up-to-in]")) {
        if (typeof can === "function" && can("page-books")) {
          page = "books";
          booksPart = "in";
          render();
        } else if (typeof setStatus === "function") {
          setStatus("進貨確認請用會計帳號進入「倉庫管理 → 進貨」。", false);
        }
        return;
      }
      if (e.target.closest("#in-add-btn")) {
        addManualInbound();
        return;
      }
      const conf = e.target.closest("[data-in-confirm]");
      if (conf) {
        confirmLedger(conf.getAttribute("data-in-confirm"));
      }
    });
    document.body.addEventListener("input", (e) => {
      if (e.target?.id === "up-new-customer") applyUnloadFromCustomer();
    });
    document.body.addEventListener("change", async (e) => {
      if (e.target?.id === "up-new-customer") {
        applyUnloadFromCustomer();
        return;
      }
      const assign = e.target.closest("[data-up-assign]");
      if (assign) {
        assignJob(assign.getAttribute("data-up-assign"), assign.value);
        return;
      }
      const file = e.target.closest("#up-photo");
      if (!file || !file.files?.[0]) return;
      try {
        unpackPhotoDraft = await readPhotoFile(file.files[0]);
        const prev = document.getElementById("up-photo-preview");
        if (prev) prev.innerHTML = `<img class="up-photo-img" src="${unpackPhotoDraft}" alt="預覽" />`;
      } catch (_) {
        if (typeof setStatus === "function") setStatus("照片讀取失敗。", true);
      }
    });
  }

  // Hub tile is registered in app.js; keep light sync only
  const _hub = typeof renderHomeHub === "function" ? renderHomeHub : null;
  if (_hub) {
    window.renderHomeHub = function () {
      _hub();
      try {
        syncJobsFromLabels();
      } catch (_) {}
    };
  }

  function afterRender() {
    bindOnce();
    ensureState();
    if (page === "books" && booksPart === "in") {
      renderInboundExtras();
    }
    if (page === "labels" || page === "label-prints" || page === "home" || page === "unpack") {
      syncJobsFromLabels();
    }
  }

  const _render = typeof render === "function" ? render : null;
  if (_render && !window.__upRenderPatched) {
    window.__upRenderPatched = true;
    window.render = function () {
      _render();
      try {
        afterRender();
      } catch (err) {
        console.error(err);
      }
    };
  }

  // Hook recordLabelPrint indirectly: sync when leaving labels is enough; also patch if available
  const _record = typeof recordLabelPrint === "function" ? recordLabelPrint : null;
  if (_record && !window.__upRecordPatched) {
    window.__upRecordPatched = true;
    window.recordLabelPrint = function (entry) {
      const r = _record(entry);
      try {
        if (entry && entry.kind === "container") syncJobsFromLabels();
      } catch (_) {}
      return r;
    };
  }

  function submitReportFields(id, fields) {
    const j = jobById(id);
    if (!j || j.status !== "pending" || !jobAllowed(j)) {
      if (typeof setStatus === "function") setStatus("無法回報此筆。", true);
      return false;
    }
    const unpackN = Number(fields && fields.unpackQty);
    if (!Number.isFinite(unpackN) || unpackN < 0) {
      if (typeof setStatus === "function") setStatus("請填拆櫃數量。", true);
      return false;
    }
    if (j.assignQty != null && Number(j.assignQty) >= 0 && unpackN > Number(j.assignQty)) {
      if (typeof setStatus === "function") setStatus(`拆櫃數量不可超過指派數量 ${j.assignQty}。`, true);
      return false;
    }
    const n = Number(fields && fields.qty);
    if (!Number.isFinite(n) || n < 0) {
      if (typeof setStatus === "function") setStatus("請填外箱。", true);
      return false;
    }
    const box = String((fields && fields.reportBox) || j.box || "").trim();
    if (!box) {
      if (typeof setStatus === "function") setStatus("請填拆櫃編號。", true);
      return false;
    }
    const location = String((fields && fields.location) || j.location || "").trim();
    if (!location) {
      if (typeof setStatus === "function") setStatus("請選拆櫃位置（倉庫或客戶）。", true);
      return false;
    }
    const customerName =
      location === "customer" ? String((fields && fields.customerName) || j.customerName || "").trim() : "";
    if (location === "customer" && !customerName) {
      if (typeof setStatus === "function") setStatus("請填客戶名稱。", true);
      return false;
    }
    const wantStockIn = fields && fields.stockIn === false ? false : true;
    const roundFn = typeof round === "function" ? round : (x) => x;
    j.unpackQty = roundFn(unpackN);
    j.qty = roundFn(n);
    j.reportBox = box;
    j.location = location;
    j.stockIn = wantStockIn;
    j.customerName = location === "customer" ? customerName : "";
    j.customer = String((fields && fields.customer) || j.customer || "").trim();
    j.unloadPoint = String((fields && fields.unloadPoint) || j.unloadPoint || "").trim();
    j.note = String((fields && fields.note) || "").trim();
    if (fields && fields.photo) j.photo = fields.photo;
    j.status = "reported";
    j.reportedBy = typeof currentStaff === "function" ? currentStaff() || "" : "";
    j.reportedAt = Date.now();
    if (wantStockIn) {
      const ledgerId = uid("in");
      const locNote =
        j.location === "customer" ? `客戶 ${j.customerName}` : `位置 ${whName(j.location)}`;
      state.inboundLedger.push({
        id: ledgerId,
        source: "unpack",
        unpackId: j.id,
        day: j.day,
        code: j.reportBox || (j.codes && j.codes[0]) || j.box,
        name: j.name,
        qty: j.qty,
        unpackQty: j.unpackQty,
        note: [j.note, j.country, j.vendor, `拆櫃 ${j.reportBox || j.box}`, `拆櫃數量 ${j.unpackQty}`, `外箱 ${j.qty}`, locNote]
          .filter(Boolean)
          .join(" · "),
        warehouse: j.location === "customer" ? "customer" : j.location,
        customerName: j.customerName || "",
        photo: j.photo || "",
        status: "pending",
        by: "",
        at: 0,
        createdAt: Date.now(),
        createdBy: j.reportedBy,
      });
      j.ledgerId = ledgerId;
    } else {
      j.ledgerId = "";
    }
    save();
    if (typeof setStatus === "function") {
      setStatus(wantStockIn ? (iAmUnpacker() ? "已回報並勾選入庫，謝謝。" : "已回報，已轉到進貨待確認。") : iAmUnpacker() ? "已回報（未勾選入庫）。" : "已回報（未勾選入庫，未轉進貨）。", false);
    }
    return true;
  }

  function jobRowCells(j) {
    const codes = (j.codes || []).filter(Boolean).join("、") || "—";
    return {
      key: j.id,
      cells: [
        j.day || "—",
        j.box || "—",
        j.name || "—",
        codes,
        j.assignee || "未指派",
        j.assignQty != null ? String(j.assignQty) : "—",
        j.unpackQty != null ? String(j.unpackQty) : "—",
        statusLabel(j),
      ],
    };
  }

  window.__unpackApi = {
    listJobs(tab) {
      ensureState();
      if (!iAmUnpacker()) syncJobsFromLabels();
      const t = tab || "pending";
      if (t === "reported") return reportedDetailJobs().map(jobRowCells);
      return pendingJobs().map(jobRowCells);
    },
    tabCounts() {
      ensureState();
      if (!iAmUnpacker()) syncJobsFromLabels();
      return {
        pending: pendingJobs().length,
        reported: reportedDetailJobs().length,
      };
    },
    loadJob(id) {
      ensureState();
      const j = jobById(id);
      if (!j || !jobAllowed(j)) return null;
      return {
        id: j.id,
        day: j.day || "",
        box: j.box || "",
        name: j.name || "",
        country: j.country || "",
        vendor: j.vendor || "",
        codes: (j.codes || []).slice(),
        assignee: j.assignee || "",
        assignQty: j.assignQty != null ? j.assignQty : "",
        status: j.status || "pending",
        statusLab: statusLabel(j),
        qty: j.qty != null ? j.qty : "",
        unpackQty: j.unpackQty != null ? j.unpackQty : "",
        reportBox: j.reportBox || j.box || "",
        stockIn: j.stockIn !== false,
        location: j.location || "",
        customerName: j.customerName || "",
        customer: j.customer || "",
        unloadPoint: j.unloadPoint || "",
        note: j.note || "",
        updatedAt: Number(j.reportedAt) || Number(j.updatedAt) || 0,
        canAssign: canAssignUnpack() && j.status === "pending",
        canReport: j.status === "pending" && jobAllowed(j),
        readOnly: j.status !== "pending",
      };
    },
    assign(id, who, assignQty) {
      return assignJob(id, who, assignQty);
    },
    submitReport(id, fields) {
      return submitReportFields(id, fields);
    },
    unpackerNames() {
      return unpackerNames();
    },
    warehouses() {
      return warehouseOpts().concat([{ id: "customer", label: "客戶" }]);
    },
    isUnpacker() {
      return iAmUnpacker();
    },
    canAssign() {
      return canAssignUnpack();
    },
  };

    window.renderUnpackPage = renderUnpackPage;
  window.renderInboundExtras = renderInboundExtras;
  window.syncUnpackJobsFromLabels = syncJobsFromLabels;

  try {
    bindOnce();
  } catch (_) {}

  if (typeof page !== "undefined" && page === "unpack") {
    try {
      renderUnpackPage();
    } catch (_) {}
  }
})();
