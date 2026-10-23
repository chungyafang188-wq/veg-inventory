/** 拍賣寄貨：填件數 → 複製通知新豐／金芳 → 隔天貼帳單自動核對 */
(function () {
  const MARKETS = [
    ["一市", /一市|第一/],
    ["二市", /二市|第二/],
    ["三重", /三重|三市/],
    ["板橋", /板橋/],
    ["桃園", /桃園|桃農/],
    ["台中", /台中|臺中/],
    ["高雄", /高雄/],
    ["鳳山", /鳳山/],
    ["屏東", /屏東/],
  ];
  const MK_KEYS = MARKETS.map((x) => x[0]);
  const HOUSES = [
    { id: "xinfeng", lab: "新豐" },
    { id: "yongfang", lab: "金芳" },
    { id: "dazhuang", lab: "大庄" },
    { id: "erlun", lab: "二崙果菜" },
  ];

  let bound = false;
  let house = "";
  let shipDate = "";
  let title = "";
  let sessionId = "";
  let pane = "key";
  let matchId = "";
  let msg = "";
  const SLOT_N = 4;
  const STORE_KEY = "dq-slips-v1";
  function blankSlots(n) {
    return Array.from({ length: n }, () => ({ mk: "", qty: "" }));
  }
  const COUNTRIES = ["中國", "紐西蘭", "越南", "韓國", "日本", "澳洲", "美國", "本產"];
  function freshLine() {
    return { crop: "", spec: "", sku: "", sub: "", country: "", slots: [{ mk: "", qty: "" }] };
  }
  function freshSlip() {
    return {
      id: `dq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      house: "",
      shipDate: localYmd(),
      lines: [freshLine()],
      billText: "",
      rows: [],
      title: "",
      note: "",
      inner: "",
      code: "",
      saved: false,
    };
  }
  let slips = [freshSlip()];
  let cur = 0;
  let listDay = "";
  let listMonth = "";
  let keyMonth = "";
  let matchMonth = "";
  let listQ = "";
  let lines = slips[0].lines;
  let billText = "";
  let note = "";
  let inner = "";
  let slipCode = "";
  let rows = [];

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function localYmd(d) {
    const x = d || new Date();
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  }
  function dayLocked(day) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(day || "")) && day < localYmd();
  }
  function addDay(iso, n) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  }
  function billDateOf(iso) {
    if (!iso) return "";
    return house === "xinfeng" ? addDay(iso, 1) : iso;
  }
  function houseLab(id) {
    return HOUSES.find((h) => h.id === id)?.lab || "";
  }
  function houseName() {
    return houseLab(house);
  }
  function ymdUtc(d) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  function parseDate(v) {
    if (v instanceof Date && !isNaN(v)) return ymdUtc(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())));
    if (typeof v === "number" && v > 20000 && v < 80000) {
      return ymdUtc(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000));
    }
    const s = String(v || "").trim();
    const m = s.match(/(\d{2,4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
    if (!m) return "";
    let y = Number(m[1]);
    if (y < 200) y += 1911;
    return ymdUtc(new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[3]))));
  }
  function marketOf(s) {
    const t = String(s || "");
    for (const [name, re] of MARKETS) if (re.test(t)) return name;
    return "";
  }
  function cropOf(s) {
    const t = String(s || "");
    if (/鐵架/.test(t)) return "";
    if (/高麗|甘藍/.test(t)) return "高麗/甘藍";
    if (/大白菜|包心白|白K/.test(t)) return "大白菜";
    if (/蘿蔔|SA9/i.test(t)) return "蘿蔔";
    if (/青花/.test(t)) return "青花";
    if (/紅小/.test(t)) return "辣椒紅小";
    if (/朝天/.test(t)) return "朝天椒";
    if (/辣椒/.test(t)) return /小/.test(t) && !/大/.test(t) ? "朝天椒" : "辣椒紅小";
    if (/南瓜/.test(t)) return "南瓜";
    if (/牛蒡/.test(t)) return "牛蒡";
    if (/洋蔥|澳洋/.test(t)) return /本產/.test(t) ? "洋蔥本產" : "洋蔥進口";
    return String(t || "").replace(/\s+/g, " ").trim();
  }
  function sharedCode(list) {
    const subs = [...new Set((list || []).map((l) => String(l.sub || "").trim()).filter(Boolean))];
    return subs.length === 1 ? subs[0] : "";
  }
  function tidySlots(line) {
    const slots = Array.isArray(line.slots) ? line.slots : [];
    const kept = slots
      .filter((s) => String(s.mk || "").trim() || String(s.qty ?? "").trim())
      .map((s) => ({ mk: String(s.mk || ""), qty: String(s.qty ?? "") }));
    line.country = line.country || "";
    line.slots = kept.length ? kept : [{ mk: "", qty: "" }];
    return line;
  }
  function lineIdentity(line) {
    return [line.sku, line.crop, line.kind, line.spec, line.sub, line.country]
      .map((x) => String(x || "").trim())
      .join("|");
  }
  function normalizeLines(list) {
    const out = [];
    const at = new Map();
    for (const raw of list || []) {
      const line = tidySlots(raw);
      const named = String(line.sku || line.crop || "").trim();
      const markets = line.slots.map((s) => s.mk).filter(Boolean);
      const prev = named && at.has(lineIdentity(line)) ? out[at.get(lineIdentity(line))] : null;
      const prevMk = new Set((prev ? prev.slots : []).map((s) => s.mk).filter(Boolean));
      const clash = markets.some((mk) => prevMk.has(mk));
      if (prev && markets.length && !clash) {
        prev.slots = prev.slots.filter((s) => s.mk).concat(line.slots.filter((s) => s.mk));
        continue;
      }
      if (named) at.set(lineIdentity(line), out.length);
      out.push(line);
    }
    return out.length ? out : [freshLine()];
  }
  function addItem() {
    const prev = lines[lines.length - 1];
    const line = freshLine();
    line.sub = (prev && prev.sub) || "";
    const mks = ((prev && prev.slots) || []).map((s) => s.mk).filter(Boolean);
    line.slots = mks.length ? mks.map((mk) => ({ mk, qty: "" })) : [{ mk: "", qty: "" }];
    lines.push(line);
  }
  function qtyOf(v) {
    const s = String(v ?? "").replace(/,/g, "").replace(/件/g, "");
    const m = s.match(/-?\d+(?:\.\d+)?/);
    if (!m) return 0;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : 0;
  }
  function whoNow() {
    try {
      return typeof currentStaff === "function" ? String(currentStaff() || "").trim() : "";
    } catch (_) {
      return "";
    }
  }
  function shipList() {
    const dt = billDateOf(shipDate);
    const out = [];
    for (const line of lines) {
      const sku = String(line.sku || "").trim();
      const crop = sku
        ? [line.kind, line.crop].filter(Boolean).join(" ")
        : cropOf(line.crop) || String(line.crop || "").trim() || String(line.spec || "").trim() || "未填品項";
      for (const slot of line.slots || []) {
        const mk = String(slot.mk || "").trim();
        const q = qtyOf(slot.qty);
        if (!mk || !q) continue;
        out.push({ dt, mk, crop, sku, spec: line.spec || "", qty: q });
      }
    }
    return out;
  }
  function specText(line) {
    const raw = String(line.spec || "").trim();
    if (!raw) return "";
    if (/公斤/.test(raw)) return raw;
    const n = raw.replace(/kg/gi, "").replace(/[^\d.]/g, "");
    return n ? `${n}公斤` : raw;
  }
  function itemName(line) {
    const sku = String(line.sku || "").trim();
    return sku
      ? [sku, line.kind, line.crop].filter(Boolean).join(" ")
      : String(line.crop || "").trim();
  }
  function itemLabel(line) {
    const spec = specText(line);
    const sub = String(line.sub || "").trim();
    const country = String(line.country || "").trim();
    const name = itemName(line);
    const codeLine = sub ? `小代號：${sub}` : "";
    const body = [name, country ? `(${country})` : "", spec].filter(Boolean).join("　") || "寄送";
    return [codeLine, body].filter(Boolean).join("\n");
  }
  function noticeBlocks() {
    const blocks = [];
    for (const line of lines) {
      const bits = [];
      let sub = 0;
      for (const slot of line.slots || []) {
        const mk = String(slot.mk || "").trim();
        const q = qtyOf(slot.qty);
        if (!mk || !q) continue;
        bits.push(`${mk} ${q}件`);
        sub += q;
      }
      if (!bits.length) continue;
      blocks.push(`${itemLabel(line)}\n${bits.join("\n")}\n合計 ${sub}件`);
    }
    return blocks;
  }
  const HOUSE_NO = { xinfeng: "1", yongfang: "2", dazhuang: "3", erlun: "4" };
  function cleanSeq(raw) {
    const s = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!s) return "";
    return /^[A-Z0-9]{1,12}$/.test(s) ? s : null;
  }
  function slipNo(s) {
    const cleaned = cleanSeq(s?.seq);
    return cleaned || "";
  }
  function allocSeq(s) {
    const had = slipNo(s);
    if (had) return had;
    const h = HOUSE_NO[s.house] || "9";
    const dd = String(s.shipDate || "").slice(-2).padStart(2, "0");
    const used = new Set();
    for (const o of slips) {
      if (o === s || o.house !== s.house || o.shipDate !== s.shipDate) continue;
      const seq = String(o.seq || "");
      if (!/^\d{5}$/.test(seq)) continue;
      const n = Number(seq.slice(-2));
      if (n) used.add(n);
    }
    let n = 1;
    while (used.has(n) && n < 99) n += 1;
    s.seq = `${h}${dd}${String(n).padStart(2, "0")}`;
    return s.seq;
  }
  function slipTitleName(s) {
    const line = (s?.lines || []).find((l) => String(l?.crop || l?.kind || l?.sku || "").trim());
    if (!line) return "";
    const name = [line.kind, line.crop].filter(Boolean).join("") || String(line.sku || "").trim();
    return name.replace(/\s+/g, "");
  }
  function slipTabText(s) {
    const name = slipTitleName(s);
    const no = slipNo(s);
    const tail = [name, no].filter(Boolean).join("-");
    return `第${slipOrd(s)}張${tail ? " " + tail : ""}`;
  }
  function slipOrd(s) {
    const mates = slips.filter((x) => x.house && x.house === s.house && x.shipDate === s.shipDate);
    const i = mates.indexOf(s);
    return i >= 0 ? i + 1 : 1;
  }
  function houseSlips(id, day) {
    const d = day || shipDate || localYmd();
    return slips
      .map((s, i) => ({ s, i }))
      .filter((x) => x.s.house === id && x.s.shipDate === d);
  }
  function openHouse(id) {
    syncCurrent();
    const day = shipDate || localYmd();
    if (!id) return;
    const mates = houseSlips(id, day);
    const stay = mates.find((x) => x.i === cur);
    if (stay) {
      house = id;
      shipDate = day;
      msg = "";
      pane = "key";
      renderDailyQty();
      return;
    }
    if (mates.length) {
      applySlip(mates[0].i);
      house = id;
      shipDate = day;
      msg = dayLocked(day) ? "這天已過，鍵單只能看。要改請到入單總資料。" : "";
      pane = "key";
      renderDailyQty();
      return;
    }
    if (dayLocked(day)) {
      house = id;
      shipDate = day;
      msg = "這天已過，不能在鍵單補打。請到入單總資料修正。";
      pane = "key";
      renderDailyQty();
      return;
    }
    if (slips[cur] && !slips[cur].saved && !slipHasBody(slips[cur])) {
      house = id;
      shipDate = day;
      slips[cur].house = id;
      slips[cur].shipDate = day;
      msg = "";
      pane = "key";
      renderDailyQty();
      return;
    }
    openAnother(id);
  }
  function canDropSlip(s) {
    if (!s || s.saved) return false;
    if (s.house || slipHasBody(s)) return true;
    return slips.filter((x) => !x.saved && !x.house).length > 1;
  }
  function dropDraft(index) {
    const s = slips[index];
    if (!canDropSlip(s)) return;
    const id = s.id;
    const houseId = s.house || house;
    const day = s.shipDate || shipDate || localYmd();
    slips.splice(index, 1);
    if (!slips.length) slips.push(freshSlip());
    const mates = slips
      .map((x, i) => ({ s: x, i }))
      .filter((x) => houseId && x.s.house === houseId && x.s.shipDate === day);
    if (mates.length) applySlip(mates[0].i);
    else {
      let blank = slips.findIndex((x) => !x.saved && !x.house);
      if (blank < 0) {
        slips.push(freshSlip());
        blank = slips.length - 1;
      }
      applySlip(blank);
      house = "";
    }
    msg = "已刪除這張還沒送出的單。";
    pane = "key";
    droppedIds.add(id);
    fetch("./api/daily-qty/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, drop: true }),
    }).catch(() => {});
    renderDailyQty();
  }
  function openAnother(houseId) {
    syncCurrent();
    const id = houseId || house;
    if (!id) return;
    const day = shipDate || localYmd();
    if (dayLocked(day)) {
      msg = "這天已過，不能在鍵單新增。請到入單總資料修正。";
      renderDailyQty();
      return;
    }
    let draft = slips.findIndex((s) => !s.saved && s.house === id && s.shipDate === day && !slipBits(s).total);
    if (draft < 0) {
      const blank = freshSlip();
      blank.house = id;
      blank.shipDate = day;
      slips.push(blank);
      draft = slips.length - 1;
    }
    applySlip(draft);
    house = id;
    shipDate = day;
    slips[cur].house = id;
    slips[cur].shipDate = day;
    const savedN = slips.filter((s) => s.saved && s.house === id && s.shipDate === day).length;
    msg = savedN ? `${houseLab(id)}今天已存 ${savedN} 張，這張是第 ${savedN + 1} 張。` : "";
    pane = "key";
    renderDailyQty();
  }
  function slipNoticeText(s, kind) {
    const sum = slipBits(s);
    const no = slipNo(s);
    const head = `【${houseLab(s.house) || "未選社場"}】寄送 ${s.shipDate || ""}`;
    const headLine = no ? `${head}  ${no}` : head;
    const freight = String(s.note || "").trim();
    const batch = String(s.inner || "").trim();
    const tails = [];
    if (freight) tails.push(`收貨：${freight}`);
    if (kind !== "freight" && batch) tails.push(`批次：${batch}`);
    if (kind !== "freight") {
      (s.log || []).filter((e) => e.kind === "移拍" && e.text).forEach((e) => tails.push(`移拍：${e.text}`));
    }
    if (!sum.blocks.length) return [headLine, "沒有件數", ...tails].filter(Boolean).join("\n");
    const body = sum.blocks.map((b) =>
      [b.label, ...b.markets.map((m) => `${m.mk} ${m.qty}件`), `合計 ${b.sub}件`].join("\n"),
    );
    return [headLine, "", body.join("\n\n"), tails.length ? `\n${tails.join("\n")}` : ""].join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  function noticeText() {
    syncCurrent();
    const s = slips[cur];
    if (!s || !houseName()) return "尚未選社場";
    return slipNoticeText(s);
  }
  function syncCurrent() {
    const s = slips[cur];
    if (!s) return;
    if (dayLocked(s.shipDate)) return;
    if (dayLocked(shipDate) && s.shipDate !== shipDate) return;
    s.house = house;
    s.shipDate = shipDate || localYmd();
    s.lines = lines;
    s.billText = billText;
    s.note = note;
    s.inner = inner;
    s.code = slipCode;
    s.rows = rows;
    s.title = title;
    s.id = sessionId || s.id;
    sessionId = s.id;
  }
  function applySlip(i) {
    cur = i;
    const s = slips[i];
    house = s.house || "";
    shipDate = s.shipDate || localYmd();
    lines = normalizeLines(s.lines && s.lines.length ? s.lines : [freshLine()]);
    s.lines = lines;
    billText = s.billText || "";
    note = s.note || "";
    inner = s.inner || "";
    slipCode = s.code || sharedCode(lines);
    rows = Array.isArray(s.rows) ? s.rows : [];
    title = s.title || "";
    sessionId = s.id;
  }
  const pushTimers = new Map();
  function slipHasBody(s) {
    if (!s) return false;
    if (slipBits(s).total) return true;
    if (String(s.note || "").trim() || String(s.inner || "").trim()) return true;
    return false;
  }
  function showDay(day) {
    syncCurrent();
    const id = house;
    if (id) {
      const mates = slips
        .map((s, i) => ({ s, i }))
        .filter((x) => x.s.house === id && x.s.shipDate === day);
      if (mates.length) {
        applySlip(mates[0].i);
        house = id;
        shipDate = day;
        msg = dayLocked(day) ? "這天已過，鍵單只能看。要改請到入單總資料。" : "";
        pane = "key";
        renderDailyQty();
        return;
      }
    }
    if (dayLocked(day)) {
      if (id) house = id;
      shipDate = day;
      msg = "這天已過，不能在鍵單補打。請到入單總資料修正。";
      pane = "key";
      renderDailyQty();
      return;
    }
    let draft = slips.findIndex(
      (s) => !s.saved && !slipHasBody(s) && (s.house || "") === (id || "") && s.shipDate === day,
    );
    if (draft < 0) {
      const blank = freshSlip();
      blank.house = id || "";
      blank.shipDate = day;
      slips.push(blank);
      draft = slips.length - 1;
    }
    applySlip(draft);
    house = id || "";
    shipDate = day;
    msg = "";
    pane = "key";
    renderDailyQty();
  }
  function queueSlipSync(slip) {
    if (!slip || !slip.house || !slipHasBody(slip)) return;
    const prev = pushTimers.get(slip.id);
    if (prev) clearTimeout(prev);
    pushTimers.set(
      slip.id,
      setTimeout(() => {
        pushTimers.delete(slip.id);
        saveSlip(slip);
      }, 800),
    );
  }
  function persistLocal(sync) {
    syncCurrent();
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ slips, cur }));
    } catch (_) {}
    if (sync && slips[cur]) {
      slips[cur].at = Date.now();
      queueSlipSync(slips[cur]);
    }
  }
  function restoreLocal() {
    try {
      const j = JSON.parse(sessionStorage.getItem(STORE_KEY) || "");
      if (!j || !Array.isArray(j.slips) || !j.slips.length) return;
      slips = j.slips.map((s) => ({
        id: s.id || freshSlip().id,
        house: s.house || "",
        shipDate: s.shipDate || localYmd(),
        lines: normalizeLines(Array.isArray(s.lines) && s.lines.length ? s.lines : [freshLine()]),
        billText: s.billText || "",
        note: s.note || "",
        inner: s.inner || "",
        code: s.code || "",
        rows: Array.isArray(s.rows) ? s.rows : [],
        title: s.title || "",
        saved: !!s.saved,
        seq: s.seq || "",
        at: Number(s.at) || 0,
        voided: !!s.voided,
        log: Array.isArray(s.log) ? s.log : [],
      }));
      if (!slips.some((s) => !s.saved)) slips.push(freshSlip());
      applySlip(Math.min(Number(j.cur) || 0, slips.length - 1));
    } catch (_) {}
  }
  function slipBits(s) {
    const blocks = [];
    let total = 0;
    for (const line of s.lines || []) {
      const markets = [];
      let sub = 0;
      for (const slot of line.slots || []) {
        const q = qtyOf(slot.qty);
        if (!slot.mk || !q) continue;
        markets.push({ mk: String(slot.mk).trim(), qty: q });
        sub += q;
        total += q;
      }
      if (!markets.length) continue;
      blocks.push({ label: itemLabel(line), name: itemName(line), markets, sub });
    }
    return { blocks, total };
  }
  function slipPlainText(s) {
    return slipNoticeText(s);
  }
  function shiftMonth(ym, dir) {
    const [y, m] = String(ym || "").split("-").map(Number);
    const dt = new Date(y || 2026, (m || 1) - 1 + dir, 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  }
  function logClock(at) {
    const d = new Date(Number(at) || Date.now());
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  function pushSlipLog(s, kind, text) {
    if (!s) return;
    if (!Array.isArray(s.log)) s.log = [];
    s.log.push({ at: Date.now(), kind, text: String(text || "").slice(0, 180) });
    if (s.log.length > 20) s.log.splice(0, s.log.length - 20);
  }
  function slipBrief(s) {
    const bits = slipBits(s);
    if (!bits.blocks.length) return "沒有件數";
    return bits.blocks
      .map((b) => `${String(b.label || "").replace(/\n/g, " ")} ${b.markets.map((m) => `${m.mk}${m.qty}`).join("、")}`)
      .join("；");
  }
  function catalogRows() {
    const rows = [];
    for (const s of slips) {
      if (!s.saved) continue;
      const slipIndex = slips.indexOf(s);
      const bits = slipBits(s);
      let first = true;
      for (const b of bits.blocks) {
        for (const m of b.markets) {
          rows.push({
            id: s.id,
            slipIndex,
            date: s.shipDate || "",
            house: houseLab(s.house) || "未選社場",
            seq: slipNo(s),
            item: b.label,
            mk: m.mk,
            qty: m.qty,
            lead: first,
            voided: !!s.voided,
            log: Array.isArray(s.log) ? s.log : [],
          });
          first = false;
        }
      }
    }
    return rows;
  }
  function orderSlipRows(rows) {
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.id)) map.set(r.id, []);
      map.get(r.id).push(r);
    }
    return [...map.values()]
      .sort((a, b) => Number(!!a[0].voided) - Number(!!b[0].voided))
      .flat();
  }
  function rowHit(r, q) {
    const words = String(q || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const hay = `${r.date} ${r.seq} ${r.house} ${r.item} ${r.mk} ${r.qty}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  }
  function gridTable(rows, opts) {
    const showDate = !!opts.showDate;
    const withAct = !!opts.actions;
    const cols = (showDate ? 6 : 5) + (withAct ? 1 : 0);
    const head = `${showDate ? "<th>日期</th>" : ""}<th>單號</th><th>社場</th><th>品項</th><th>市場</th><th>件數</th>${withAct ? "<th>操作</th>" : ""}`;
    if (!rows.length) {
      return `<div class="dq-sheet-wrap"><table class="dq-sheet dq-grid"><thead><tr>${head}</tr></thead><tbody><tr><td class="dq-none" colspan="${cols}">沒有資料</td></tr></tbody></table></div>`;
    }
    const span = {};
    rows.forEach((r) => {
      span[r.id] = (span[r.id] || 0) + 1;
    });
    const seen = new Set();
    const body = rows
      .map((r) => {
        let seqCell = "";
        let act = "";
        if (!seen.has(r.id)) {
          seen.add(r.id);
          seqCell = `<td class="num dq-seq" rowspan="${span[r.id]}"><button type="button" class="dq-seq-btn" data-dq-seq="${esc(r.id)}" title="點一下修正單號">${esc(r.seq)}</button></td>`;
          if (withAct && !r.voided) {
            act = `<td class="dq-act" rowspan="${span[r.id]}"><button type="button" class="ghost" data-dq-copy-text="${esc(r.id)}">複製文字</button><button type="button" class="ghost" data-dq-copy-ship="${esc(r.id)}">出單</button><button type="button" class="ghost" data-dq-copy-freight="${esc(r.id)}">通知貨運</button><button type="button" class="ghost" data-dq-fix="${esc(r.id)}">修正</button><button type="button" class="ghost" data-dq-void="${esc(r.id)}">刪除</button></td>`;
          } else if (withAct) {
            act = `<td class="dq-act" rowspan="${span[r.id]}">已刪除</td>`;
          }
        }
        return `<tr class="${r.voided ? "is-void" : ""}">${showDate ? `<td>${esc(r.date)}</td>` : ""}${seqCell}<td>${esc(r.house)}</td><td>${esc(r.item).replace(/\n/g, "<br>")}</td><td>${esc(r.mk)}</td><td class="num">${r.qty}</td>${act}</tr>`;
      })
      .join("");
    const logs = [];
    const logged = new Set();
    rows.forEach((r) => {
      if (logged.has(r.id) || !Array.isArray(r.log) || !r.log.length) return;
      logged.add(r.id);
      const text = r.log.map((e) => `${esc(e.kind)} ${esc(logClock(e.at))}${e.text ? "　" + esc(e.text) : ""}`).join("<br>");
      logs.push({ id: r.id, html: `<tr class="dq-log"><td colspan="${cols}">${text}</td></tr>` });
    });
    const withLogs = [];
    const placed = new Set();
    const parts = body.split("</tr>");
    rows.forEach((r, i) => {
      withLogs.push(`${parts[i]}</tr>`);
      const next = rows[i + 1];
      if ((!next || next.id !== r.id) && !placed.has(r.id)) {
        const hit = logs.find((x) => x.id === r.id);
        if (hit) {
          withLogs.push(hit.html);
          placed.add(r.id);
        }
      }
    });
    const total = rows.reduce((n, r) => n + (r.voided ? 0 : Number(r.qty || 0)), 0);
    const lead = showDate ? 5 : 4;
    return `<div class="dq-sheet-wrap"><table class="dq-sheet dq-grid"><thead><tr>${head}</tr></thead><tbody>${withLogs.join("")}</tbody><tfoot><tr><td colspan="${lead}">合計</td><td class="num">${total}</td>${withAct ? "<td></td>" : ""}</tr></tfoot></table></div>`;
  }
  let listEditId = "";
  let listEdit = null;
  function lineItemText(line) {
    if (line && line._itemText != null) return line._itemText;
    if (line && line.sku) return `${line.sku} ${[line.kind, line.crop].filter(Boolean).join(" ")}`.trim();
    return String((line && line.crop) || "");
  }
  function beginListEdit(id) {
    const s = slips.find((x) => x.id === id);
    if (!s || !s.saved || s.voided) return;
    listEditId = s.id;
    listEdit = {
      lines: JSON.parse(JSON.stringify(s.lines && s.lines.length ? s.lines : [freshLine()])),
      note: s.note || "",
      inner: s.inner || "",
    };
    pane = "list";
    if (s.shipDate) {
      listDay = s.shipDate;
      listMonth = String(s.shipDate).slice(0, 7);
    }
    listQ = "";
    msg = "";
  }
  function readListEditForm() {
    const box = document.querySelector("[data-dq-fix-box]");
    if (!box || !listEdit) return;
    box.querySelectorAll("[data-dq-fix-line]").forEach((el) => {
      const line = listEdit.lines[Number(el.dataset.dqFixLine)];
      if (!line) return;
      const sub = el.querySelector("[data-fix='sub']");
      const item = el.querySelector("[data-fix='item']");
      const spec = el.querySelector("[data-fix='spec']");
      const country = el.querySelector("[data-fix='country']");
      if (sub) line.sub = sub.value.trim();
      if (item) line._itemText = item.value.trim();
      if (spec) line.spec = String(spec.value || "").replace(/公斤/g, "").trim();
      if (country) line.country = country.value.trim();
      if (!line.slots) line.slots = [];
      el.querySelectorAll("[data-dq-fix-slot]").forEach((slotEl) => {
        const slot = line.slots[Number(slotEl.dataset.dqFixSlot)];
        if (!slot) return;
        const mk = slotEl.querySelector("[data-fix='mk']");
        const qty = slotEl.querySelector("[data-fix='qty']");
        if (mk) slot.mk = mk.value;
        if (qty) slot.qty = qty.value;
      });
    });
    const noteEl = box.querySelector("[data-fix='note']");
    const innerEl = box.querySelector("[data-fix='inner']");
    if (noteEl) listEdit.note = noteEl.value;
    if (innerEl) listEdit.inner = innerEl.value;
  }
  function applyItemText(line, text) {
    const raw = String(text || "").trim();
    const shown = lineItemText({ ...line, _itemText: null });
    if (!raw || raw === shown) return;
    const code = raw.split(/\s+/)[0];
    const item = (catalog || []).find((x) => x.code === code);
    if (item && (raw === item.code || raw.startsWith(`${item.code} `))) {
      line.sku = item.code;
      line.crop = item.name;
      line.kind = item.kind;
      line.alias = item.alias || item.kindAlias || "";
      return;
    }
    line.sku = "";
    line.kind = "";
    line.alias = "";
    line.crop = raw;
  }
  async function saveListEdit() {
    readListEditForm();
    const s = slips.find((x) => x.id === listEditId);
    if (!s || !listEdit) return;
    const before = slipBrief(s);
    const beforeNote = String(s.note || "");
    const beforeInner = String(s.inner || "");
    listEdit.lines.forEach((line) => {
      applyItemText(line, line._itemText);
      delete line._itemText;
    });
    s.lines = normalizeLines(listEdit.lines);
    s.note = String(listEdit.note || "");
    s.inner = String(listEdit.inner || "");
    const after = slipBrief(s);
    const bits = [];
    if (before !== after) bits.push(`原本 ${before}`);
    if (beforeNote !== s.note) bits.push(`收貨 ${beforeNote || "空白"} → ${s.note || "空白"}`);
    if (beforeInner !== s.inner) bits.push(`內部 ${beforeInner || "空白"} → ${s.inner || "空白"}`);
    if (bits.length) pushSlipLog(s, "修正", bits.join("；"));
    s.at = Date.now();
    await saveSlip(s);
    listEditId = "";
    listEdit = null;
    msg = "已修正這張單，仍留在入單總資料。";
    pane = "list";
    renderDailyQty();
  }
  function listFixHtml(slip) {
    if (!listEdit) return "";
    const linesHtml = listEdit.lines.map((line, i) => {
      const used = new Set((line.slots || []).map((s) => s.mk).filter(Boolean));
      const countryNow = String(line.country || "");
      const countryList = countryNow && !COUNTRIES.includes(countryNow) ? COUNTRIES.concat(countryNow) : COUNTRIES;
      const countryOpts = [`<option value="">選國家</option>`]
        .concat(countryList.map((c) => `<option value="${esc(c)}"${c === countryNow ? " selected" : ""}>${esc(c)}</option>`))
        .join("");
      const slots = (line.slots || [{ mk: "", qty: "" }]).map((slot, si) => {
        const known = MK_KEYS.includes(slot.mk) || !slot.mk ? MK_KEYS : MK_KEYS.concat(slot.mk);
        const opts = [`<option value="">選市場</option>`]
          .concat(known.map((mk) => {
            const off = mk !== slot.mk && used.has(mk) ? " disabled" : "";
            return `<option value="${esc(mk)}"${mk === slot.mk ? " selected" : ""}${off}>${esc(mk)}</option>`;
          }))
          .join("");
        const remove = (line.slots || []).length > 1
          ? `<button type="button" class="ghost" data-dq-fix-del-slot data-dq-fix-del-slot-line="${i}" data-dq-fix-del-slot-i="${si}">×</button>`
          : "";
        return `<div class="dq-fix-slot" data-dq-fix-slot="${si}"><select data-fix="mk">${opts}</select><input data-fix="qty" inputmode="numeric" value="${esc(slot.qty)}" /><span>件</span>${remove}</div>`;
      }).join("");
      return `<div class="dq-fix-line" data-dq-fix-line="${i}">
        <label>小代號 <input data-fix="sub" value="${esc(line.sub || "")}" /></label>
        <label>品項 <input data-fix="item" value="${esc(lineItemText(line))}" /></label>
        <label>規格 <input data-fix="spec" inputmode="decimal" value="${esc(String(line.spec || "").replace(/公斤/g, ""))}" /> 公斤</label>
        <label>國別 <select data-fix="country">${countryOpts}</select></label>
        <div class="dq-fix-slots">${slots}<button type="button" class="ghost" data-dq-fix-add-slot="${i}">＋市場</button></div>
        <button type="button" class="ghost" data-dq-fix-del-line="${i}">刪這個品項</button>
      </div>`;
    }).join("");
    return `<section class="dq-fix" data-dq-fix-box>
      <h3>修正 ${esc(slip.shipDate || "")} ${esc(houseLab(slip.house) || "")} ${esc(slipNo(slip))}</h3>
      <p>改完按儲存，會留在入單總資料。</p>
      ${linesHtml}
      <button type="button" class="ghost" data-dq-fix-add-line>＋新增品項</button>
      <label>社場／貨運看 <input data-fix="note" value="${esc(listEdit.note || "")}" /></label>
      <label>內部出貨 <input data-fix="inner" value="${esc(listEdit.inner || "")}" /></label>
      <div class="dq-fix-actions">
        <button type="button" class="primary" data-dq-fix-save>儲存修正</button>
        <button type="button" class="ghost" data-dq-fix-cancel>取消</button>
      </div>
    </section>`;
  }
  function datesWithSlips(houseId) {
    const id = String(houseId || "");
    return new Set(
      slips
        .filter((s) => s.shipDate && (s.saved || slipHasBody(s)) && (!id || s.house === id))
        .map((s) => s.shipDate),
    );
  }
  function dqCalHtml(opts) {
    const o = opts || {};
    const iso = o.selected || listDay || localYmd();
    const month = o.month || listMonth || iso.slice(0, 7);
    const dayAttr = o.dayAttr || "data-dq-day";
    const shiftAttr = o.shiftAttr || "data-dq-shift";
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const lead = (first.getDay() + 6) % 7;
    const count = new Date(y, m, 0).getDate();
    const today = localYmd();
    const marked = datesWithSlips(o.houseId || "");
    const week = ["一", "二", "三", "四", "五", "六", "日"].map((name) => `<span>${name}</span>`).join("");
    let days = "";
    for (let i = 0; i < lead; i += 1) days += "<span></span>";
    for (let d = 1; d <= count; d += 1) {
      const cell = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const cls = ["dq-day", marked.has(cell) ? "is-data" : "", cell === today ? "is-today" : "", cell === iso ? "is-sel" : ""]
        .filter(Boolean)
        .join(" ");
      days += `<button type="button" class="${cls}" ${dayAttr}="${cell}">${d}</button>`;
    }
    return `<div class="dq-calbox">
      <div class="dq-cal-nav">
        <button type="button" class="ghost" ${shiftAttr}="-1">上一月</button>
        <b>${y}年${m}月</b>
        <button type="button" class="ghost" ${shiftAttr}="1">下一月</button>
      </div>
      <div class="dq-cal">${week}${days}</div>
      <p class="dq-cal-note">綠框是有資料的日期。</p>
    </div>`;
  }
  function slipBlockHtml(blocks) {
    if (!blocks.length) return "<li>沒有件數</li>";
    return blocks
      .map((b) => {
        const markets = b.markets.map((m) => `<span>${esc(m.mk)} ${m.qty}件</span>`).join("");
        return `<li><b>${esc(b.label).replace(/\n/g, "<br>")}</b><span class="dq-mkts">${markets}</span><em>合計 ${b.sub}件</em></li>`;
      })
      .join("");
  }
  function slipFileName(s) {
    const base = `${houseLab(s.house) || "單據"}_${s.shipDate || "寄貨"}`;
    return `${base.replace(/[\\/:*?"<>|\s\u3000]+/g, "_")}.png`;
  }
  function setCardMsg(id, text) {
    const box = document.getElementById("dq-list-msg");
    if (box) box.textContent = text;
    document.querySelectorAll("[data-dq-card-msg]").forEach((el) => {
      if (el.dataset.dqCardMsg === id) el.textContent = text;
    });
  }
  function slipPngBlob(s, kind) {
    const font = '"Microsoft JhengHei","Noto Sans TC",sans-serif';
    const sum = slipBits(s);
    const no = slipNo(s);
    const head = `【${houseLab(s.house) || "未選社場"}】寄送 ${s.shipDate || ""}`;
    const drawn = [];
    if (!sum.blocks.length) drawn.push({ t: "沒有件數", strong: true });
    sum.blocks.forEach((b, i) => {
      if (i) drawn.push(null);
      String(b.label || "").split("\n").forEach((t) => {
        if (b.name && t.startsWith(b.name)) drawn.push({ t, boldLead: b.name });
        else drawn.push({ t, strong: false });
      });
      b.markets.forEach((m) => drawn.push({ t: `${m.mk} ${m.qty}件`, strong: false }));
      drawn.push({ t: `合計 ${b.sub}件`, strong: true });
    });
    const freight = String(s.note || "").trim();
    const batch = String(s.inner || "").trim();
    const tails = [];
    if (freight) tails.push(`收貨：${freight}`);
    if (kind !== "freight" && batch) tails.push(`批次：${batch}`);
    if (tails.length) {
      drawn.push(null);
      tails.forEach((t) => drawn.push({ t, strong: false }));
    }
    if (kind !== "freight") {
      const moves = (s.log || []).filter((e) => e.kind === "移拍" && e.text);
      if (moves.length) {
        drawn.push(null);
        moves.forEach((e) => drawn.push({ t: `移拍：${e.text}`, strong: true, alert: true }));
      }
    }
    const width = 760;
    const padX = 36;
    const padY = 28;
    const headSize = 28;
    const bodySize = 26;
    const lineH = 40;
    const headBlock = 58;
    const height = padY + headBlock + drawn.length * lineH + padY;
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#e7f6ee";
    ctx.fillRect(0, 0, width, height);
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#14633a";
    ctx.font = `700 ${headSize}px ${font}`;
    ctx.fillText(head, padX, padY + 22);
    if (no) {
      ctx.textAlign = "right";
      ctx.fillText(no, width - padX, padY + 22);
      ctx.textAlign = "left";
    }
    let y = padY + headBlock + lineH / 2;
    drawn.forEach((line) => {
      if (line && line.t) {
        ctx.fillStyle = line.alert ? "#9a1c1c" : "#14633a";
        if (line.boldLead) {
          ctx.font = `800 ${bodySize}px ${font}`;
          ctx.fillText(line.boldLead, padX, y);
          const rest = line.t.slice(line.boldLead.length);
          if (rest) {
            const w = ctx.measureText(line.boldLead).width;
            ctx.font = `560 ${bodySize}px ${font}`;
            ctx.fillText(rest, padX + w, y);
          }
        } else {
          ctx.font = `${line.strong ? 700 : 560} ${bodySize}px ${font}`;
          ctx.fillText(line.t, padX, y);
        }
      }
        y += lineH;
    });
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  }
  function splitLine(line) {
    if (line.includes("\t")) return line.split("\t").map((x) => x.trim());
    return line.trim().split(/\s{2,}|\s+/).map((x) => x.trim());
  }
  function gridFromText(text) {
    const raw = String(text || "").trim();
    if (!raw) return [];
    if (/<table/i.test(raw)) {
      const tableRows = [];
      const trs = raw.match(/<tr[\s\S]*?<\/tr>/gi) || [];
      for (const tr of trs) {
        const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
          m[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim(),
        );
        if (cells.length) tableRows.push(cells);
      }
      return tableRows;
    }
    return raw.split(/\r?\n/).map(splitLine).filter((r) => r.some(Boolean));
  }
  function parseBill(text, opts) {
    opts = opts || {};
    const grid = gridFromText(text);
    if (grid.length < 2) return parseLooseBill(text);
    let header = -1;
    for (let i = 0; i < Math.min(8, grid.length); i++) {
      const line = grid[i].join(" ");
      if (/市場/.test(line) && /品名/.test(line) && /件數/.test(line)) {
        header = i;
        break;
      }
    }
    if (header < 0) header = 0;
    const heads = grid[header].map((h) => String(h || "").replace(/\s+/g, ""));
    const iDate = heads.findIndex((h) => h.includes("日期"));
    const iMk = heads.findIndex((h) => h.includes("市場"));
    let iName = heads.findIndex((h) => /品名名稱/.test(h));
    if (iName < 0) iName = heads.findIndex((h) => /品名/.test(h) && !/代號/.test(h));
    const iSku = heads.findIndex((h) => /小代號|品名代號/.test(h));
    const iQty = heads.findIndex((h) => /件數/.test(h));
    if (iMk < 0 || iQty < 0) return parseLooseBill(text);
    const out = [];
    const wantDt = billDateOf(shipDate);
    for (let i = header + 1; i < grid.length; i++) {
      const r = grid[i];
      if (/合計|小計/.test(r.join(""))) continue;
      const dt = (iDate >= 0 ? parseDate(r[iDate]) : "") || wantDt;
      if (!opts.keepAllDates && wantDt && dt && dt !== wantDt) continue;
      const mk = marketOf(r[iMk]);
      const name = iName >= 0 ? r[iName] : "";
      const crop = cropOf(name) || String(name || "").trim();
      const sku = iSku >= 0 ? String(r[iSku] || "").trim() : "";
      const q = qtyOf(r[iQty]);
      if (!mk || !q || (!crop && !sku)) continue;
      out.push({ dt: dt || wantDt, mk, crop: crop || sku, sku, qty: q });
    }
    return out.length ? out : parseLooseBill(text);
  }
  function parseLooseBill(text) {
    const wantDt = billDateOf(shipDate);
    const out = [];
    for (const rawLine of String(text || "").split(/\r?\n/)) {
      const line = rawLine.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim();
      if (!line || /合計|小計|日期/.test(line)) continue;
      const mk = marketOf(line);
      if (!mk) continue;
      const noDate = line.replace(/\d{2,4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}/g, " ").replace(/\d+(?:\.\d+)?\s*(?:公斤|kg)/gi, " ");
      const qtyHit = noDate.match(/(\d+(?:\.\d+)?)\s*件/);
      let q = qtyHit ? qtyOf(qtyHit[1]) : 0;
      if (!q) {
        const nums = [...noDate.matchAll(/\d+(?:\.\d+)?/g)]
          .map((m) => Number(m[0]))
          .filter((n) => n > 0 && n < 100000);
        if (nums.length >= 3) {
          const a = nums[0];
          const b = nums[1];
          const c = nums[nums.length - 1];
          if (b && Math.abs(a * b - c) <= Math.max(2, c * 0.08)) q = a;
        }
        if (!q) {
          const pieces = nums.filter((n) => n > 0 && n < 10000);
          q = pieces.length ? pieces[0] : 0;
        }
      }
      if (!q) continue;
      const code = (line.match(/\b([A-Z*]{1,3}\d{1,3})\b/) || [])[1] || "";
      let name = noDate
        .replace(mk, " ")
        .replace(code, " ")
        .replace(String(q), " ")
        .replace(/件|公斤|kg/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      const crop = cropOf(name) || name || code;
      if (!crop && !code) continue;
      out.push({ dt: wantDt, mk, crop: crop || code, sku: code, qty: q });
    }
    return out;
  }
  function agg(list) {
    const m = new Map();
    for (const x of list) {
      const k = `${x.dt}|${x.mk}|${x.sku || x.crop}`;
      const cur = m.get(k) || { ...x, qty: 0 };
      cur.qty += x.qty;
      cur.crop = x.crop || cur.crop;
      m.set(k, cur);
    }
    return m;
  }
  function compareNow() {
    const H = agg(shipList());
    const P = agg(parseBill(billText));
    const keys = new Set([...H.keys(), ...P.keys()]);
    const out = [];
    for (const k of keys) {
      const h = H.get(k);
      const p = P.get(k);
      const hQty = h?.qty || 0;
      const pQty = p?.qty || 0;
      out.push({
        dt: (h || p).dt,
        mk: (h || p).mk,
        crop: (h || p).crop,
        sku: (h || p).sku || "",
        h: hQty,
        p: pQty,
        d: pQty - hQty,
        ok: hQty === pQty && hQty > 0,
      });
    }
    out.sort((a, b) => a.mk.localeCompare(b.mk) || String(a.crop).localeCompare(String(b.crop)));
    return out;
  }
  async function saveSlip(slip, opts) {
    const s = slip || slips[cur];
    if (!s) return;
    const payload = {
      id: s.id,
      at: Date.now(),
      title: s.title || `${houseLab(s.house)}-${s.shipDate}`,
      house: s.house,
      shipDate: s.shipDate,
      by: whoNow(),
      lines: s.lines || [],
      billText: s.billText || "",
      note: s.note || "",
      inner: s.inner || "",
      code: s.code || "",
      rows: s.rows || [],
      seq: slipNo(s),
      seqSet: !!(opts && opts.seqSet),
      saved: !!s.saved,
      voided: !!s.voided,
      log: Array.isArray(s.log) ? s.log.slice(-20) : [],
      yfId: s.yfId || "",
      yfNo: s.yfNo || "",
    };
    s.at = payload.at;
    try {
      const r = await fetch("./api/daily-qty/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (j.id) s.id = j.id;
      if (j && Object.prototype.hasOwnProperty.call(j, "seq")) s.seq = String(j.seq || "");
    } catch (_) {}
    persistLocal();
  }
  let matchHouse = "";
  let matchDay = "";
  let matchBill = "";
  let matchRows = [];
  let matchPriceRows = [];
  let matchCaptcha = "";
  let matchCaptchaSub = "";
  let matchBillDate = "";
  let matchSource = "";
  let matchPhotoUrl = "";
  let matchPhotoName = "";
  const MATCH_STORE = "dq-house-match-v1";
  const CONFIRM_KEY = "dq-qty-confirm-v1";
  let matchCalOpen = false;
  let matchHelp = false;
  let matchFold = "";
  let matchConfirms = [];
  let savedMatches = [];
  let matchPulling = false;
  let noticeSig = "";
  let noticePick = new Set();
  let gapPreviewUrl = "";
  let gapNote = "";
  let pricePreviewUrl = "";
  let priceNote = "";
  let pricePreviewSig = "";
  let pricePreviewToken = 0;
  let priceSub = "";
  let priceItem = "";
  function priceViewSig() {
    return `${matchHouse}|${matchDay}|${priceSub}|${priceItem}|${(matchPriceRows || []).length}`;
  }
  function clearPricePreview() {
    if (pricePreviewUrl) URL.revokeObjectURL(pricePreviewUrl);
    pricePreviewUrl = "";
    priceNote = "";
    pricePreviewSig = "";
    pricePreviewToken += 1;
  }
  function resetPriceFilter() {
    priceSub = "";
    priceItem = "";
    clearPricePreview();
  }
  function loadConfirms() {
    try {
      const j = JSON.parse(localStorage.getItem(CONFIRM_KEY) || "[]");
      matchConfirms = Array.isArray(j) ? j : [];
    } catch (_) {
      matchConfirms = [];
    }
  }
  function saveConfirms() {
    try {
      localStorage.setItem(CONFIRM_KEY, JSON.stringify(matchConfirms.slice(0, 200)));
    } catch (_) {}
  }
  function qtyTotals(rows) {
    return {
      h: (rows || []).reduce((n, r) => n + (Number(r.h) || 0), 0),
      p: (rows || []).reduce((n, r) => n + (Number(r.p) || 0), 0),
    };
  }
  function confirmHit(totals) {
    const hit = matchConfirms.find((c) => c.house === matchHouse && c.day === matchDay);
    return !!(hit && hit.h === totals.h && hit.p === totals.p && (totals.h > 0 || totals.p > 0));
  }
  const PAIR_KEY = "dq-pair-v1";
  let pairLinks = [];
  const pairPick = new Set();
  function loadPairs() {
    try {
      const j = JSON.parse(localStorage.getItem(PAIR_KEY) || "[]");
      pairLinks = Array.isArray(j) ? j : [];
    } catch (_) {
      pairLinks = [];
    }
  }
  function savePairs() {
    try {
      localStorage.setItem(PAIR_KEY, JSON.stringify(pairLinks.slice(0, 200)));
    } catch (_) {}
  }
  function pairPayload() {
    return pairLinks
      .filter((c) => c.house === matchHouse && c.day === matchDay)
      .map((c) => ({ region: c.region || "", sku: c.sku || "", altSku: c.altSku || "", qty: Number(c.qty) || 0 }));
  }
  function bitsMap(text) {
    const map = {};
    String(text || "").split("、").forEach((part) => {
      const bits = part.trim().split(/\s+/);
      const n = Number(bits[1]);
      if (bits[0] && n) map[bits[0]] = n;
    });
    return map;
  }
  function bitsText(map) {
    return Object.entries(map || {}).filter(([, n]) => n > 0).map(([mk, n]) => `${mk} ${n}`).join("、");
  }
  function applyManualPairs(rows, id, day) {
    const made = [];
    for (const link of pairLinks.filter((c) => c.house === id && c.day === day && c.qty)) {
      const a = rows.find((r) => !r.swap && r.region === link.region && r.sku === link.sku && Number(r.h) - Number(r.p) >= link.qty);
      const b = rows.find((r) => !r.swap && r.region === link.region && r.sku === link.altSku && Number(r.p) - Number(r.h) >= link.qty);
      if (!a || !b) continue;
      const hMap = bitsMap(a.hMarkets);
      const pMap = bitsMap(b.pMarkets);
      const moved = {};
      let left = link.qty;
      for (const mk of Object.keys(pMap)) {
        if (left <= 0) break;
        const take = Math.min(left, pMap[mk]);
        if (hMap[mk]) hMap[mk] = Math.max(0, hMap[mk] - take);
        pMap[mk] -= take;
        moved[mk] = take;
        left -= take;
      }
      a.h -= link.qty;
      a.d = a.p - a.h;
      a.ok = a.h === a.p && a.h > 0;
      a.hMarkets = bitsText(hMap);
      b.p -= link.qty;
      b.d = b.p - b.h;
      b.ok = b.h === b.p && b.h > 0;
      b.pMarkets = bitsText(pMap);
      made.push({
        region: link.region,
        mk: link.region,
        crop: a.crop,
        sku: a.sku,
        h: link.qty,
        p: link.qty,
        d: 0,
        ok: true,
        swap: true,
        manual: true,
        altSku: b.sku,
        altCrop: b.crop,
        hMarkets: bitsText(moved),
        pMarkets: bitsText(moved),
        subs: [...new Set([...(a.subs || []), ...(b.subs || [])])],
        alts: [],
      });
    }
    return [...made, ...rows.filter((r) => Number(r.h) || Number(r.p))];
  }
  function confirmManualPair() {
    const rows = [...pairPick].map((key) => matchRows.find((r) => gapKey(r) === key)).filter(Boolean);
    if (rows.length !== 2) {
      msg = "請勾兩筆要當成同一批的。";
      renderDailyQty();
      return;
    }
    if ((rows[0].region || "") !== (rows[1].region || "")) {
      msg = "要同一個區域才能對成同一批。";
      renderDailyQty();
      return;
    }
    const short = rows.find((r) => Number(r.h) > Number(r.p));
    const extra = rows.find((r) => Number(r.p) > Number(r.h));
    if (!short || !extra) {
      msg = "要一筆我們比較多、一筆拍賣比較多。";
      renderDailyQty();
      return;
    }
    const q1 = Number(short.h) - Number(short.p);
    const q2 = Number(extra.p) - Number(extra.h);
    if (q1 !== q2) {
      msg = `兩邊相差要一樣。現在是 ${q1} 件和 ${q2} 件。`;
      renderDailyQty();
      return;
    }
    pairLinks = pairLinks.filter((c) => !(c.house === matchHouse && c.day === matchDay && c.region === short.region && c.sku === short.sku && c.altSku === extra.sku));
    pairLinks.push({ house: matchHouse, day: matchDay, region: short.region || "", sku: short.sku || "", altSku: extra.sku || "", qty: q1 });
    savePairs();
    pairPick.clear();
    matchRows = compareRegions(matchHouse, matchDay, matchPriceRows);
    saveMatchStore();
    pushMatch();
    msg = `已確認 ${short.sku} 和 ${extra.sku} 是同一批，這 ${q1} 件不算異常。`;
    renderDailyQty();
  }
  let carries = [];
  const carryDraft = new Map();
  function loadCarries() {
    try {
      const j = JSON.parse(localStorage.getItem(CARRY_KEY) || "[]");
      carries = Array.isArray(j) ? j : [];
    } catch (_) {
      carries = [];
    }
  }
  function saveCarries() {
    try {
      localStorage.setItem(CARRY_KEY, JSON.stringify(carries.slice(0, 200)));
    } catch (_) {}
  }
  function mergeCarry(list) {
    let changed = false;
    for (const m of list || []) {
      if (!m || !Array.isArray(m.carry)) continue;
      for (const c of m.carry) {
        if (!c || !c.key || !c.kind) continue;
        if (carries.some((x) => x.house === m.house && x.day === m.day && x.key === c.key)) continue;
        carries.push({
          house: m.house,
          day: m.day,
          key: c.key,
          kind: c.kind,
          qty: Number(c.qty) || 0,
          mk: c.mk || "",
          next: c.next || "",
          slipId: c.slipId || "",
        });
        changed = true;
      }
    }
    if (changed) saveCarries();
  }
  function carryPayload() {
    return carries
      .filter((c) => c.house === matchHouse && c.day === matchDay)
      .map((c) => ({ key: c.key, kind: c.kind, qty: c.qty, mk: c.mk || "", next: c.next || "", slipId: c.slipId || "" }));
  }
  function unsoldOf(row) {
    const h = Number(row && row.h) || 0;
    const p = Number(row && row.p) || 0;
    return h > p ? h - p : 0;
  }
  function ourMarkets(row) {
    return String((row && row.hMarkets) || "")
      .split("、")
      .map((s) => s.trim().split(/\s+/)[0])
      .filter((mk) => MK_KEYS.includes(mk));
  }
  function carryOf(key) {
    return carries.find((c) => c.house === matchHouse && c.day === matchDay && c.key === key) || null;
  }
  function carryHtml(row) {
    const n = unsoldOf(row);
    if (!n) return "";
    const key = gapKey(row);
    const saved = carryOf(key);
    if (saved) {
      const text = saved.kind === "back"
        ? `已退回 ${saved.qty} 件`
        : `已轉到 ${saved.next}　${saved.kind === "move" ? "轉市" : "原市續賣"}　${saved.mk}　${saved.qty} 件`;
      return `<div class="dq-carry is-done"><b>${esc(text)}</b></div>`;
    }
    const draft = carryDraft.get(key) || { kind: "", mk: "" };
    const picks = [
      ["back", "退回"],
      ["stay", "原市續賣"],
      ["move", "轉市"],
    ].map(([kind, lab]) => `<button type="button" class="pick${draft.kind === kind ? " on" : ""}" data-dq-carry="${esc(key)}" data-dq-carry-kind="${kind}">${lab}</button>`).join("");
    const mkPick = draft.kind === "stay" || draft.kind === "move"
      ? `<label>市場<select data-dq-carry-mk="${esc(key)}"><option value="">選市場</option>${MK_KEYS.map((mk) => `<option value="${esc(mk)}"${draft.mk === mk ? " selected" : ""}>${esc(mk)}</option>`).join("")}</select></label>`
      : "";
    return `<div class="dq-carry"><p>沒賣完 ${n} 件，今天移拍</p><div class="dq-carry-picks">${picks}</div>${mkPick}<button type="button" class="primary" data-dq-carry-save="${esc(key)}">記入</button></div>`;
  }
  function parseCarryTag(tag) {
    const m = String(tag || "").match(/^(\S+)\s+(\S+)\s+(\d+)件\s+(轉市|原市)\s+(\S+)$/);
    if (!m) return null;
    return { region: m[1], sku: m[2], qty: Number(m[3]), how: m[4], mk: m[5] };
  }
  function chineseName(houseId, day, sku) {
    for (const s of slips) {
      if (!s || s.voided || s.house !== houseId) continue;
      if (day && s.shipDate !== day) continue;
      for (const line of s.lines || []) {
        if (String(line.sku || "").trim() !== sku) continue;
        const crop = [line.kind, line.crop].filter(Boolean).join(" ").trim();
        if (!crop || crop === sku) continue;
        return crop.startsWith(sku) ? crop.slice(sku.length).trim() : crop;
      }
    }
    return "";
  }
  function carryMoveText(tag, next, name) {
    const p = parseCarryTag(tag);
    const day = String(next || "").slice(5).replace("-", "/");
    if (!p) return `${tag}，轉到 ${day || next}`;
    const where = p.how === "轉市" ? `轉到 ${day} ${p.mk}` : `原市續賣 ${day} ${p.mk}`;
    const item = name ? `${p.sku} ${name}` : p.sku;
    return `${where}　${p.region} ${item} ${p.qty}件`;
  }
  function carryTagLabel(tag, name) {
    const p = parseCarryTag(tag);
    if (!p) return tag;
    const item = name ? `${p.sku} ${name}` : p.sku;
    return `${p.region} ${item} ${p.qty}件 ${p.how} ${p.mk}`;
  }
  function putMoveLog(slip, text, parsed) {
    if (!slip || !text) return false;
    if (!Array.isArray(slip.log)) slip.log = [];
    const hit = slip.log.find((e) => e.kind === "移拍" && e.text.includes(parsed.sku) && e.text.includes(`${parsed.qty}件`) && e.text.includes(parsed.mk));
    if (hit) {
      if (hit.text === text) return false;
      hit.text = text;
      return true;
    }
    pushSlipLog(slip, "移拍", text);
    return true;
  }
  function slipHasRegionSku(slip, region, sku) {
    for (const line of slip.lines || []) {
      if (String(line.sku || "").trim() !== sku) continue;
      for (const slot of line.slots || []) {
        if (regionOfMk(slot.mk) === region && qtyOf(slot.qty)) return true;
      }
    }
    return false;
  }
  async function markSourceSlips(houseId, srcDay, tag, next) {
    const parsed = parseCarryTag(tag);
    if (!parsed) return [];
    const name = chineseName(houseId, srcDay, parsed.sku);
    const text = carryMoveText(tag, next, name);
    const sources = slips.filter((s) => s.saved && !s.voided && s.house === houseId && s.shipDate === srcDay && slipHasRegionSku(s, parsed.region, parsed.sku));
    const changed = [];
    for (const src of sources) {
      if (putMoveLog(src, text, parsed)) changed.push(src);
    }
    for (const src of changed) await saveSlip(src);
    return changed;
  }
  function backfillCarryMarks() {
    if (backfillCarryMarks.busy) return;
    const jobs = [];
    const touch = (slip) => {
      if (slip && !jobs.includes(slip)) jobs.push(slip);
    };
    for (const slip of slips) {
      if (!slip.saved || slip.voided) continue;
      const from = String(slip.note || "").match(/^移拍自 (\d{4}-\d{2}-\d{2})$/);
      if (!from) continue;
      const bits = String(slip.inner || "").split("；").map((s) => s.trim()).filter(Boolean);
      for (const tag of bits) {
        const parsed = parseCarryTag(tag);
        if (!parsed) continue;
        const name = chineseName(slip.house, from[1], parsed.sku);
        if (putMoveLog(slip, carryTagLabel(tag, name), parsed)) touch(slip);
        const text = carryMoveText(tag, slip.shipDate, name);
        slips.filter((s) => s.saved && !s.voided && s.house === slip.house && s.shipDate === from[1] && slipHasRegionSku(s, parsed.region, parsed.sku)).forEach((src) => {
          if (putMoveLog(src, text, parsed)) touch(src);
        });
      }
    }
    if (!jobs.length) return;
    backfillCarryMarks.busy = true;
    (async () => {
      for (const src of jobs) await saveSlip(src);
      backfillCarryMarks.busy = false;
      renderDailyQty();
    })();
  }
  async function writeCarrySlip(row, qty, mk, next, kind) {
    const tag = `${row.region || ""} ${row.sku || ""} ${qty}件 ${kind === "move" ? "轉市" : "原市"} ${mk}`;
    const crop = String(row.crop || "").trim();
    const name = crop && crop !== row.sku ? (crop.startsWith(row.sku) ? crop.slice(String(row.sku || "").length).trim() : crop) : "";
    const label = carryTagLabel(tag, name);
    let slip = slips.find((s) => s.saved && !s.voided && s.house === matchHouse && s.shipDate === next && String(s.note || "") === `移拍自 ${matchDay}`);
    const line = {
      crop: row.crop || "",
      spec: "",
      sku: row.sku || "",
      sub: (row.subs && row.subs[0]) || "",
      country: "",
      slots: [{ mk, qty: String(qty) }],
    };
    if (!slip) {
      slip = freshSlip();
      slip.house = matchHouse;
      slip.shipDate = next;
      slip.saved = true;
      slip.note = `移拍自 ${matchDay}`;
      slip.inner = tag;
      slip.lines = [line];
      slip.title = `${houseLab(matchHouse) || "拍賣"}-移拍`;
      pushSlipLog(slip, "移拍", label);
      slips.push(slip);
    } else if (!String(slip.inner || "").includes(tag)) {
      slip.lines = (slip.lines || []).concat([line]);
      slip.inner = [slip.inner, tag].filter(Boolean).join("；");
      pushSlipLog(slip, "移拍", label);
    }
    await saveSlip(slip);
    await markSourceSlips(matchHouse, matchDay, tag, next);
    return slip.id;
  }
  async function saveCarry(key) {
    const row = matchRows.find((r) => gapKey(r) === key);
    const n = unsoldOf(row);
    const draft = carryDraft.get(key) || {};
    if (!row || !n || !draft.kind) {
      msg = "請先選退回、原市續賣或轉市。";
      renderDailyQty();
      return;
    }
    if (draft.kind !== "back" && !draft.mk) {
      msg = "請選續賣的市場。";
      renderDailyQty();
      return;
    }
    const next = addDay(matchDay, 1);
    let slipId = "";
    if (draft.kind !== "back") slipId = await writeCarrySlip(row, n, draft.mk, next, draft.kind);
    carries = carries.filter((c) => !(c.house === matchHouse && c.day === matchDay && c.key === key));
    carries.push({
      house: matchHouse,
      day: matchDay,
      key,
      kind: draft.kind,
      qty: n,
      mk: draft.kind === "back" ? "" : draft.mk,
      next: draft.kind === "back" ? "" : next,
      slipId,
    });
    saveCarries();
    pushMatch();
    msg = draft.kind === "back" ? `已記入退回 ${n} 件。` : `已轉到 ${next}，${draft.mk} ${n} 件。`;
    renderDailyQty();
  }
  function saveQtyConfirm() {
    const totals = qtyTotals(matchRows);
    if (!(totals.h > 0 || totals.p > 0)) {
      msg = "還沒有件數可以確認。";
      renderDailyQty();
      return;
    }
    matchConfirms = matchConfirms.filter((c) => !(c.house === matchHouse && c.day === matchDay));
    matchConfirms.push({ house: matchHouse, day: matchDay, h: totals.h, p: totals.p, at: Date.now() });
    saveConfirms();
    pushMatch();
    msg = "";
    renderDailyQty();
  }
  function clearQtyConfirm() {
    matchConfirms = matchConfirms.filter((c) => !(c.house === matchHouse && c.day === matchDay));
    saveConfirms();
    pushMatch();
    matchFold = matchSource ? "run" : "";
    msg = "";
    renderDailyQty();
  }
  function loadMatchStore() {
    try {
      const j = JSON.parse(sessionStorage.getItem(MATCH_STORE) || "");
      if (!j || typeof j !== "object") return;
      matchHouse = j.house || "";
      matchDay = j.day || "";
      matchBill = j.bill || "";
      matchRows = Array.isArray(j.rows) ? j.rows : [];
      matchPriceRows = Array.isArray(j.prices) ? j.prices : [];
      matchSource = j.source || "";
      matchBillDate = j.billDate || "";
      matchFold = matchSource ? "run" : "";
      if (matchSource === "auction" && matchPriceRows.length && matchHouse && matchDay) {
        matchRows = compareRegions(matchHouse, matchDay, matchPriceRows);
      }
    } catch (_) {}
  }
  function savedMatchFor(houseId, day) {
    return savedMatches.find((m) => m && m.house === houseId && m.day === day && Array.isArray(m.prices) && m.prices.length);
  }
  function tryApplySaved() {
    if (matchCaptcha || matchSource === "paste") return false;
    if (matchSource === "auction" && matchPriceRows.length) return false;
    const hit = savedMatchFor(matchHouse, matchDay);
    if (!hit) return false;
    matchPriceRows = hit.prices;
    matchBillDate = hit.billDate || "";
    matchSource = "auction";
    matchRows = compareRegions(matchHouse, matchDay, matchPriceRows);
    matchFold = "run";
    const totals = qtyTotals(matchRows);
    const confirm = hit.confirm;
    if (confirm && Number(confirm.h) === totals.h && Number(confirm.p) === totals.p) {
      matchConfirms = matchConfirms.filter((c) => !(c.house === matchHouse && c.day === matchDay));
      matchConfirms.push({ house: matchHouse, day: matchDay, h: totals.h, p: totals.p, at: Number(hit.at) || Date.now() });
      saveConfirms();
    }
    saveMatchStore();
    return true;
  }
  function pushMatch() {
    if (/onrender\.com$/i.test(location.hostname)) return;
    if (matchSource !== "auction" || !matchHouse || !matchDay || !matchPriceRows.length) return;
    const totals = qtyTotals(matchRows);
    const confirmed = confirmHit(totals);
    fetch("./api/daily-qty/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        house: matchHouse,
        day: matchDay,
        billDate: matchBillDate,
        prices: matchPriceRows,
        confirm: confirmed ? { h: totals.h, p: totals.p } : null,
        carry: carryPayload(),
        pairs: pairPayload(),
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.matches)) savedMatches = j.matches;
      })
      .catch(() => {});
  }
  function pullMatches() {
    if (matchPulling) return;
    matchPulling = true;
    fetch("./api/daily-qty/match", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        savedMatches = Array.isArray(j?.matches) ? j.matches : [];
        mergeCarry(savedMatches);
        matchPulling = false;
        if (pane === "match" && tryApplySaved()) renderDailyQty();
      })
      .catch(() => {
        matchPulling = false;
      });
  }
  function saveMatchStore() {
    try {
      sessionStorage.setItem(MATCH_STORE, JSON.stringify({
        house: matchHouse,
        day: matchDay,
        bill: matchBill,
        rows: matchRows,
        prices: matchPriceRows,
        source: matchSource,
        billDate: matchBillDate,
      }));
    } catch (_) {}
  }
  function slipsForMatch(id, day) {
    return slips.filter((s) => s.saved && !s.voided && s.house === id && s.shipDate === day);
  }
  function houseShipList(id, day) {
    const prevHouse = house;
    house = id || "";
    const dt = billDateOf(day || "");
    house = prevHouse;
    const out = [];
    for (const s of slipsForMatch(id, day)) {
      for (const line of s.lines || []) {
        const sku = String(line.sku || "").trim();
        const crop = sku
          ? [line.kind, line.crop].filter(Boolean).join(" ")
          : cropOf(line.crop) || String(line.crop || "").trim() || "未填品項";
        for (const slot of line.slots || []) {
          const mk = String(slot.mk || "").trim();
          const q = qtyOf(slot.qty);
          if (!mk || !q) continue;
          out.push({ dt, mk, crop, sku, qty: q });
        }
      }
    }
    return out;
  }
  function compareHouseDay() {
    const prev = { house, shipDate, billText };
    house = matchHouse;
    shipDate = matchDay;
    billText = matchBill;
    let out = [];
    try {
      const H = agg(houseShipList(matchHouse, matchDay));
      const P = agg(parseBill(matchBill));
      const keys = new Set([...H.keys(), ...P.keys()]);
      for (const k of keys) {
        const h = H.get(k);
        const p = P.get(k);
        const hQty = h?.qty || 0;
        const pQty = p?.qty || 0;
        out.push({
          dt: (h || p).dt,
          mk: (h || p).mk,
          crop: (h || p).crop,
          sku: (h || p).sku || "",
          h: hQty,
          p: pQty,
          d: pQty - hQty,
          ok: hQty === pQty && hQty > 0,
        });
      }
      out.sort((a, b) => a.mk.localeCompare(b.mk) || String(a.crop).localeCompare(String(b.crop)));
    } finally {
      house = prev.house;
      shipDate = prev.shipDate;
      billText = prev.billText;
    }
    return out;
  }
  const REGION_OF = new Map([
    ["一市", "北部"],
    ["二市", "北部"],
    ["三重", "北部"],
    ["板橋", "北部"],
    ["桃園", "中區"],
    ["台中", "中區"],
    ["豐原", "中區"],
    ["高雄", "南部"],
    ["鳳山", "南部"],
    ["屏東", "南部"],
  ]);
  const REGION_ORDER = ["北部", "中區", "南部", "其他"];
  function regionOfMk(mk) {
    return REGION_OF.get(String(mk || "").trim()) || "其他";
  }
  function marketBits(map) {
    return Object.entries(map || {})
      .filter(([, n]) => n)
      .map(([mk, n]) => `${mk} ${n}`)
      .join("、");
  }
  function regionAgg(list) {
    const m = new Map();
    for (const x of list) {
      const region = regionOfMk(x.mk);
      const sku = String(x.sku || x.crop || "").trim();
      if (!sku || !x.qty) continue;
      const k = `${region}|${sku}`;
      const cur = m.get(k) || { region, sku, crop: x.crop || "", qty: 0, markets: {}, subs: [] };
      cur.qty += Number(x.qty) || 0;
      cur.crop = x.crop || cur.crop;
      const sub = String(x.sub || "").trim();
      if (sub && !cur.subs.includes(sub)) cur.subs.push(sub);
      const mk = String(x.mk || "").trim() || region;
      cur.markets[mk] = (cur.markets[mk] || 0) + (Number(x.qty) || 0);
      m.set(k, cur);
    }
    return m;
  }
  function shippedLines(id, day) {
    const out = [];
    for (const s of slipsForMatch(id, day)) {
      for (const line of s.lines || []) {
        const sku = String(line.sku || "").trim();
        const crop = sku
          ? [line.kind, line.crop].filter(Boolean).join(" ")
          : String(line.crop || "").trim();
        for (const slot of line.slots || []) {
          const mk = String(slot.mk || "").trim();
          const q = qtyOf(slot.qty);
          if (!mk || !q) continue;
          out.push({ mk, sku: sku || crop, crop: crop || sku, sub: normSubCode(line.sub), qty: q });
        }
      }
    }
    return out;
  }
  function normSubCode(raw) {
    const s = String(raw || "").trim();
    if (/^\d+$/.test(s) && s.length < 3) return s.padStart(3, "0");
    return s;
  }
  function goodsWords(text) {
    return String(text || "")
      .replace(/[A-Za-z*]{1,4}\d{0,3}/g, " ")
      .split(/[\s、,，/／]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2 && !["進口", "本產", "蔬菜", "水果"].includes(w));
  }
  function sameGoods(a, b) {
    const A = goodsWords(a);
    const B = goodsWords(b);
    if (!A.length || !B.length) return false;
    return A.some((w) => B.some((v) => v === w || v.includes(w) || w.includes(v)));
  }
  function otherSkuLines(our, auctionRows) {
    const subs = our?.subs || [];
    const sku = String(our?.sku || "").trim();
    const seen = new Map();
    for (const row of auctionRows || []) {
      const code = normSubCode(row.sub);
      if (subs.length && code && !subs.includes(code)) continue;
      const asku = String(row.sku || "").trim();
      if (!asku || asku === sku) continue;
      if (!sameGoods(our.crop, row.name || row.crop || "")) continue;
      const price = Number(row.price) || 0;
      const key = `${code}|${asku}|${row.mk || ""}|${row.name || ""}|${price}`;
      const cur = seen.get(key) || {
        sub: code,
        sku: asku,
        name: row.name || "",
        mk: row.mk || "",
        qty: 0,
        price,
      };
      cur.qty += Number(row.qty) || 0;
      seen.set(key, cur);
    }
    return [...seen.values()].sort((a, b) => a.sku.localeCompare(b.sku) || a.mk.localeCompare(b.mk));
  }
  function pairCodeSwaps(rows) {
    const byRegion = new Map();
    rows.forEach((row, index) => {
      const list = byRegion.get(row.region) || [];
      list.push(index);
      byRegion.set(row.region, list);
    });
    const used = new Set();
    const swaps = [];
    for (const indexes of byRegion.values()) {
      const ours = indexes.filter((i) => rows[i].h > 0 && !rows[i].p);
      const auctions = indexes.filter((i) => rows[i].p > 0 && !rows[i].h);
      const candidates = [];
      for (const hi of ours) {
        for (const pi of auctions) {
          const h = rows[hi];
          const p = rows[pi];
          const hSubs = h.subs || [];
          const pSubs = p.subs || [];
          const shareSub = hSubs.some((s) => pSubs.includes(s));
          if (!shareSub && hSubs.length && pSubs.length) continue;
          if (!sameGoods(h.crop, p.crop)) continue;
          candidates.push({ hi, pi, score: Math.abs(h.h - p.p) });
        }
      }
      candidates.sort((a, b) => a.score - b.score || a.hi - b.hi);
      const usedH = new Set();
      const usedP = new Set();
      for (const pair of candidates) {
        if (usedH.has(pair.hi) || usedP.has(pair.pi)) continue;
        usedH.add(pair.hi);
        usedP.add(pair.pi);
        used.add(pair.hi);
        used.add(pair.pi);
        const h = rows[pair.hi];
        const p = rows[pair.pi];
        swaps.push({
          ...h,
          swap: true,
          p: p.p,
          d: p.p - h.h,
          ok: h.h === p.p,
          pMarkets: p.pMarkets,
          altSku: p.sku,
          altCrop: p.crop,
          subs: [...new Set([...(h.subs || []), ...(p.subs || [])])],
          alts: [],
        });
      }
    }
    return [...swaps, ...rows.filter((_, i) => !used.has(i)).map((row) => ({ ...row, alts: [] }))];
  }
  function compareRegions(id, day, auctionRows) {
    const H = regionAgg(shippedLines(id, day));
    const P = regionAgg(
      (auctionRows || []).map((r) => ({
        mk: r.mk,
        sku: r.sku,
        crop: r.name || r.sku,
        sub: normSubCode(r.sub),
        qty: Number(r.qty) || 0,
      })),
    );
    const keys = new Set([...H.keys(), ...P.keys()]);
    const out = [];
    const altShown = new Set();
    for (const k of keys) {
      const h = H.get(k);
      const p = P.get(k);
      const hQty = h?.qty || 0;
      const pQty = p?.qty || 0;
      const side = h || p;
      const skuKey = `${(side.subs || []).join(",")}|${side.sku}`;
      const alts = hQty > pQty && !altShown.has(skuKey) ? otherSkuLines(side, auctionRows) : [];
      if (alts.length) altShown.add(skuKey);
      out.push({
        region: side.region,
        mk: side.region,
        crop: side.crop,
        sku: side.sku || "",
        h: hQty,
        p: pQty,
        d: pQty - hQty,
        ok: hQty === pQty && hQty > 0,
        hMarkets: marketBits(h?.markets),
        pMarkets: marketBits(p?.markets),
        subs: side.subs || [],
        alts,
      });
    }
    const paired = applyManualPairs(pairCodeSwaps(out), id, day);
    paired.sort((a, b) => {
      const ar = REGION_ORDER.indexOf(a.region);
      const br = REGION_ORDER.indexOf(b.region);
      return (ar < 0 ? 9 : ar) - (br < 0 ? 9 : br) || Number(a.ok) - Number(b.ok) || String(a.sku).localeCompare(String(b.sku));
    });
    return paired;
  }
  async function runAuctionMatch(captcha) {
    if (!matchHouse) {
      msg = "請先選社場。";
      renderDailyQty();
      return;
    }
    if (matchHouse !== "xinfeng" && matchHouse !== "yongfang") {
      msg = "大庄、二崙果菜還沒有拍賣帳號，先不自動回對。";
      renderDailyQty();
      return;
    }
    if (/onrender\.com$/i.test(location.hostname)) {
      msg = matchSource === "auction"
        ? "線上顯示的是已經存好的行情。要更新請用辦公室這台電腦再回對一次。"
        : "線上伺服器連不到台灣拍賣網站。請用辦公室這台電腦做回對，完成後這裡會看得到。";
      renderDailyQty();
      return;
    }
    const msgEl = document.getElementById("dq-msg");
    if (msgEl) msgEl.textContent = "正在讀隔天拍賣行情…";
    let j = {};
    try {
      const r = await fetch("./api/daily-qty/auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ house: matchHouse, shipDate: matchDay, captcha: captcha || "" }),
      });
      j = await r.json();
    } catch (_) {
      msg = "讀取拍賣行情失敗。";
      renderDailyQty();
      return;
    }
    if (j.needCaptcha) {
      matchCaptcha = j.captcha ? `data:${j.captchaType || "image/png"};base64,${j.captcha}` : "";
      matchCaptchaSub = j.sub || "";
      const err = String(j.error || "");
      msg = err && !/密碼|已登入|請填小代號/.test(err) ? err : "";
      renderDailyQty();
      return;
    }
    matchCaptcha = "";
    matchCaptchaSub = "";
    if (!j.ok) {
      msg = j.error || "讀取拍賣行情失敗。";
      renderDailyQty();
      return;
    }
    matchBillDate = j.billDate || "";
    matchSource = "auction";
    matchPriceRows = Array.isArray(j.rows) ? j.rows : [];
    resetPriceFilter();
    matchRows = compareRegions(matchHouse, matchDay, matchPriceRows);
    matchFold = "run";
    saveMatchStore();
    pushMatch();
    const miss = matchRows.filter((r) => !r.ok).length;
    const when = matchBillDate ? `（行情日 ${matchBillDate}）` : "";
    const noSlip = !slipsForMatch(matchHouse, matchDay).length;
    msg = !j.rows?.length
      ? (j.sawTable
        ? `行情表有打開${when}，但這幾組小代號沒有列在裡面。`
        : `這次沒有讀到行情表${when}。請再按一次開始回對。`)
      : noSlip
        ? `這天沒有已送出的單，已讀到拍賣行情${when}。金額在下方。`
        : miss
          ? `回對完成${when}，有 ${miss} 區的品項件數不一致。`
          : `回對完成${when}，北中南的品項件數一致。`;
    renderDailyQty();
  }
  function numText(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "";
    const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
    const [whole, frac] = s.split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return frac ? `${grouped}.${frac}` : grouped;
  }
  function priceItemKey(row) {
    return [row.sku, row.name || row.crop].filter(Boolean).join(" ") || "未填品項";
  }
  function priceSubOf(row) {
    return normSubCode(row.sub);
  }
  function priceSubList() {
    const subs = [];
    for (const row of matchPriceRows || []) {
      const sub = priceSubOf(row);
      if (sub && !subs.includes(sub)) subs.push(sub);
    }
    return subs.sort();
  }
  function priceFilteredRows(sub, item) {
    return (matchPriceRows || []).filter((row) => {
      if (sub && priceSubOf(row) !== sub) return false;
      if (item && priceItemKey(row) !== item) return false;
      return true;
    });
  }
  function priceItemList(sub) {
    const items = [];
    for (const row of priceFilteredRows(sub, "")) {
      const item = priceItemKey(row);
      if (item && !items.includes(item)) items.push(item);
    }
    return items.sort((a, b) => a.localeCompare(b, "zh-Hant"));
  }
  function priceCopyTitle(sub, item) {
    const house = houseLab(matchHouse) || "拍賣";
    return [house, sub ? `小代號 ${sub}` : "", item || "", "拍賣單價"].filter(Boolean).join("　");
  }
  function priceGroups(rows, withMarket) {
    const map = new Map();
    for (const row of rows || []) {
      const item = [row.sku, row.name || row.crop].filter(Boolean).join(" ") || "未填品項";
      const mk = String(row.mk || "").trim() || "未填市場";
      const key = withMarket ? `${item}|${mk}` : item;
      const cur = map.get(key) || { item, mk, qty: 0, amt: 0, hasAmt: false };
      cur.qty += Number(row.qty) || 0;
      const amt = Number(row.amt);
      if (Number.isFinite(amt) && amt) {
        cur.amt += amt;
        cur.hasAmt = true;
      }
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => a.item.localeCompare(b.item) || a.mk.localeCompare(b.mk));
  }
  function priceTable(title, rows, withMarket) {
    const body = rows
      .map((r) => {
        const avg = r.qty && r.hasAmt ? numText(r.amt / r.qty) : "";
        return `<tr>${withMarket ? "" : ""}<td>${esc(r.item)}</td>${withMarket ? `<td>${esc(r.mk)}</td>` : ""}<td class="num">${numText(r.qty)}</td><td class="num">${r.hasAmt ? numText(r.amt) : ""}</td><td class="num">${avg}</td></tr>`;
      })
      .join("");
    const qty = rows.reduce((n, r) => n + r.qty, 0);
    const hasAmt = rows.some((r) => r.hasAmt);
    const amt = rows.reduce((n, r) => n + (r.hasAmt ? r.amt : 0), 0);
    const avg = qty && hasAmt ? numText(amt / qty) : "";
    const cols = withMarket ? 2 : 1;
    return `<section>
      <h4>${title}</h4>
      <div class="dq-sheet-wrap"><table class="dq-sheet"><thead><tr><th>品項</th>${withMarket ? "<th>市場</th>" : ""}<th>件數</th><th>金額</th><th>均價</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="${cols}">合計 ${rows.length} 項</td><td class="num">${numText(qty)}</td><td class="num">${hasAmt ? numText(amt) : ""}</td><td class="num">${avg}</td></tr></tfoot></table></div>
    </section>`;
  }
  function priceSummaryHtml() {
    const rows = matchPriceRows || [];
    const when = matchBillDate ? `行情日 ${matchBillDate}。` : "";
    if (!rows.length) {
      const note = matchSource === "paste"
        ? "貼上的明細只有件數。要看單價和金額，請按開始回對讀行情。"
        : "開始回對並讀到行情後，這裡彙整品項和市場的件數、金額、均價。";
      return `<section class="dq-price"><h3>價格彙整</h3><p class="dq-empty">${note}</p></section>`;
    }
    const subs = priceSubList();
    if (priceSub && !subs.includes(priceSub)) priceSub = "";
    const items = priceItemList(priceSub);
    if (priceItem && !items.includes(priceItem)) priceItem = "";
    const shown = priceFilteredRows(priceSub, priceItem);
    const byItem = priceGroups(shown, false);
    const byMarket = priceGroups(shown, true);
    const missing = shown.every((r) => !Number(r.amt));
    const subPicks = [`<span class="dq-price-lab">小代號</span>`, `<button type="button" class="pick${priceSub ? "" : " on"}" data-dq-price-sub="">全部</button>`]
      .concat(subs.map((sub) => `<button type="button" class="pick${priceSub === sub ? " on" : ""}" data-dq-price-sub="${esc(sub)}">${esc(sub)}</button>`))
      .join("");
    const itemPicks = [`<span class="dq-price-lab">品項</span>`, `<button type="button" class="pick${priceItem ? "" : " on"}" data-dq-price-item="">全部</button>`]
      .concat(items.map((item) => `<button type="button" class="pick${priceItem === item ? " on" : ""}" data-dq-price-item="${esc(item)}">${esc(item)}</button>`))
      .join("");
    return `<section class="dq-price">
      <h3>${esc(houseLab(matchHouse) || "拍賣")} 價格彙整</h3>
      ${when ? `<p class="dq-match-note">${esc(when.replace(/。$/, ""))}</p>` : ""}
      ${missing ? `<p class="dq-match-note">這次行情沒有讀到金額，先列出件數。</p>` : ""}
      <div class="dq-price-filters">
        <div class="dq-price-picks">${subPicks}</div>
        <div class="dq-price-picks">${itemPicks}</div>
      </div>
      <div class="dq-price-copyline"><button type="button" id="dq-price-copy">複製貼上</button></div>
      <div class="dq-price-grid">
        ${priceTable("品項", byItem, false)}
        ${priceTable("品項 × 市場", byMarket, true)}
      </div>
      <div class="dq-gap-preview" id="dq-price-preview"${pricePreviewSig === priceViewSig() && pricePreviewUrl ? "" : " hidden"}>${pricePreviewSig === priceViewSig() && pricePreviewUrl ? `<img src="${esc(pricePreviewUrl)}" alt="拍賣單價圖片" /><p>${esc(priceNote)}</p>` : ""}</div>
    </section>`;
  }
  function pricePngBlob(byItem, byMarket, title) {
    const font = '"Microsoft JhengHei","Noto Sans TC",sans-serif';
    const width = 880;
    const pad = 24;
    const scale = 2;
    const rowH = 38;
    const house = houseLab(matchHouse) || "拍賣";
    const cellsOf = (r, withMarket) => {
      const avg = r.qty && r.hasAmt ? numText(r.amt / r.qty) : "";
      const base = [r.item, numText(r.qty), r.hasAmt ? numText(r.amt) : "", avg];
      return withMarket ? [r.item, r.mk, numText(r.qty), r.hasAmt ? numText(r.amt) : "", avg] : base;
    };
    const footOf = (rows, withMarket) => {
      const qty = rows.reduce((n, r) => n + r.qty, 0);
      const hasAmt = rows.some((r) => r.hasAmt);
      const amt = rows.reduce((n, r) => n + (r.hasAmt ? r.amt : 0), 0);
      const avg = qty && hasAmt ? numText(amt / qty) : "";
      const lead = `合計 ${rows.length} 項`;
      return withMarket ? [lead, "", numText(qty), hasAmt ? numText(amt) : "", avg] : [lead, numText(qty), hasAmt ? numText(amt) : "", avg];
    };
    const sections = [
      { title: "品項", heads: ["品項", "件數", "金額", "均價"], fixed: [0, 100, 150, 120], rows: byItem.map((r) => cellsOf(r, false)), foot: footOf(byItem, false) },
      { title: "品項 × 市場", heads: ["品項", "市場", "件數", "金額", "均價"], fixed: [0, 110, 90, 140, 110], rows: byMarket.map((r) => cellsOf(r, true)), foot: footOf(byMarket, true) },
    ];
    const height = pad + 86 + sections.reduce((n, sec) => n + 34 + rowH * (1 + sec.rows.length + 1) + 18, 0) + pad;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#f4faf6";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#14633a";
    ctx.fillRect(0, 0, width, 8);
    ctx.textBaseline = "top";
    const houseTitle = title || `${house}　拍賣單價`;
    let titleSize = 32;
    ctx.font = `800 ${titleSize}px ${font}`;
    while (titleSize > 18 && ctx.measureText(houseTitle).width > width - pad * 2) {
      titleSize -= 2;
      ctx.font = `800 ${titleSize}px ${font}`;
    }
    ctx.fillText(houseTitle, pad, pad + 8);
    ctx.fillStyle = "#3d5348";
    ctx.font = `600 18px ${font}`;
    ctx.fillText(`寄送日 ${matchDay || ""}${matchBillDate ? `　行情日 ${matchBillDate}` : ""}`, pad, pad + 48);
    const drawTable = (sec, top) => {
      const inner = width - pad * 2;
      const fixed = sec.fixed.reduce((n, w) => n + w, 0);
      const cols = sec.heads.map((head, i) => ({ head, w: sec.fixed[i] || inner - fixed }));
      ctx.fillStyle = "#14633a";
      ctx.font = `800 20px ${font}`;
      ctx.fillText(sec.title, pad, top);
      let y = top + 30;
      const paintRow = (values, kind) => {
        ctx.fillStyle = kind === "head" ? "#e7f6ee" : kind === "foot" ? "#f4f7f5" : "#fff";
        ctx.fillRect(pad, y, inner, rowH);
        ctx.strokeStyle = "#d5e4da";
        ctx.strokeRect(pad, y, inner, rowH);
        let x = pad;
        values.forEach((value, i) => {
          const col = cols[i];
          const num = i > 0 && !(sec.heads[i] === "市場");
          ctx.fillStyle = "#1c2b24";
          ctx.font = `${kind === "body" ? 600 : 800} 18px ${font}`;
          const text = String(value || "");
          const tw = ctx.measureText(text).width;
          const tx = num ? x + col.w - 12 - tw : x + 12;
          ctx.fillText(text, tx, y + 9);
          x += col.w;
        });
        y += rowH;
      };
      paintRow(sec.heads, "head");
      sec.rows.forEach((row) => paintRow(row, "body"));
      paintRow(sec.foot, "foot");
      return y + 18;
    };
    let y = pad + 86;
    sections.forEach((sec) => {
      y = drawTable(sec, y);
    });
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  }
  function showPricePreview(scroll) {
    const host = document.getElementById("dq-price-preview");
    if (!host || !pricePreviewUrl) return false;
    host.hidden = false;
    host.innerHTML = `<img src="${esc(pricePreviewUrl)}" alt="拍賣單價圖片" /><p>${esc(priceNote)}</p>`;
    if (scroll) host.scrollIntoView({ block: "nearest" });
    return true;
  }
  async function syncPricePreview() {
    const sig = priceViewSig();
    if (!matchPriceRows.length || pane !== "match") return;
    if (pricePreviewSig === sig && pricePreviewUrl) return;
    const token = ++pricePreviewToken;
    const sub = priceSub;
    const item = priceItem;
    const rows = priceFilteredRows(sub, item);
    if (!rows.length) return;
    const title = priceCopyTitle(sub, item);
    let blob = null;
    try {
      blob = await pricePngBlob(priceGroups(rows, false), priceGroups(rows, true), title);
    } catch (_) {
      blob = null;
    }
    if (token !== pricePreviewToken || sig !== priceViewSig()) return;
    if (!blob) return;
    if (pricePreviewUrl) URL.revokeObjectURL(pricePreviewUrl);
    pricePreviewUrl = URL.createObjectURL(blob);
    pricePreviewSig = sig;
    priceNote = title;
    showPricePreview(false);
  }
  async function copyPriceImage(pick) {
    const sub = pick && Object.prototype.hasOwnProperty.call(pick, "sub") ? pick.sub : priceSub;
    const item = pick && Object.prototype.hasOwnProperty.call(pick, "item") ? pick.item : priceItem;
    const rows = priceFilteredRows(sub, item);
    if (!rows.length) {
      msg = "這個範圍沒有拍賣單價可以複製。";
      const el = document.getElementById("dq-msg");
      if (el) el.textContent = msg;
      return;
    }
    const title = priceCopyTitle(sub, item);
    let blob;
    try {
      blob = await pricePngBlob(priceGroups(rows, false), priceGroups(rows, true), title);
    } catch (_) {
      blob = null;
    }
    if (!blob) {
      msg = "做成圖片失敗。";
      const el = document.getElementById("dq-msg");
      if (el) el.textContent = msg;
      return;
    }
    const name = `${title}.png`.replace(/[\\/:*?"<>|\s]+/g, "_");
    let copied = false;
    let shared = false;
    try {
      if (navigator.clipboard && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        copied = true;
      }
    } catch (_) {}
    if (!copied && navigator.canShare) {
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title });
          shared = true;
        } catch (err) {
          if (err && err.name === "AbortError") return;
        }
      }
    }
    if (!copied && !shared) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    priceNote = copied
      ? "已複製單價圖片。到 LINE 貼上。若貼不上，長按這張圖再複製。"
      : shared
        ? "請在分享裡選 LINE。"
        : "已存成圖片檔。也可以長按這張圖複製，再貼到 LINE。";
    msg = priceNote;
    const sameView = (sub || "") === (priceSub || "") && (item || "") === (priceItem || "");
    if (sameView) {
      if (pricePreviewUrl) URL.revokeObjectURL(pricePreviewUrl);
      pricePreviewUrl = URL.createObjectURL(blob);
      pricePreviewSig = priceViewSig();
      const alert = document.getElementById("dq-msg");
      if (alert) alert.textContent = priceNote;
      if (!showPricePreview(true)) renderDailyQty();
    } else {
      const alert = document.getElementById("dq-msg");
      if (alert) alert.textContent = priceNote;
    }
  }
  function housesOnDay(day) {
    const ids = [];
    for (const s of slips) {
      if (!s.saved || s.voided || s.shipDate !== day || !s.house) continue;
      if (!ids.includes(s.house)) ids.push(s.house);
    }
    return ids;
  }
  function openDayMatch() {
    matchDay = listDay || localYmd();
    matchMonth = String(matchDay).slice(0, 7);
    const ids = housesOnDay(matchDay);
    if (ids.length === 1) matchHouse = ids[0];
    else if (ids.length && !ids.includes(matchHouse)) matchHouse = ids[0];
    matchRows = [];
    matchPriceRows = [];
    matchSource = "";
    matchBillDate = "";
    matchCaptcha = "";
    matchCaptchaSub = "";
    matchFold = "";
    resetPriceFilter();
    saveMatchStore();
    pane = "match";
    msg = ids.length > 1 ? "已帶到這一天。這天有多家社場，請再點要回對的那一家。" : "";
    renderDailyQty();
  }
  function compareSlip(slip) {
    const prev = { house, shipDate, lines, billText };
    house = slip.house || "";
    shipDate = slip.shipDate || localYmd();
    lines = slip.lines || [];
    billText = slip.billText || "";
    let out = [];
    try {
      out = compareNow();
    } finally {
      house = prev.house;
      shipDate = prev.shipDate;
      lines = prev.lines;
      billText = prev.billText;
    }
    return out;
  }
  async function confirmSlip() {
    if (dayLocked(shipDate) || (slips[cur] && dayLocked(slips[cur].shipDate))) {
      msg = "這天已過，不能在鍵單儲存。請到入單總資料修正。";
      renderDailyQty();
      return;
    }
    syncCurrent();
    if (!house) {
      msg = "請先選這一張的社場。";
      renderDailyQty();
      return;
    }
    if (!shipList().length) {
      msg = "請先填市場件數。";
      renderDailyQty();
      return;
    }
    const savedName = houseName();
    allocSeq(slips[cur]);
    slips[cur].saved = true;
    slips[cur].title = slips[cur].title || `${savedName}-${shipDate}`;
    title = slips[cur].title;
    await saveSlip(slips[cur]);
    if (!slips.some((s) => !s.saved && !s.house)) slips.push(freshSlip());
    applySlip(slips.findIndex((s) => !s.saved && !s.house));
    pane = "key";
    msg = `已儲存${savedName}。可以選下一個社場，繼續下一張。`;
    renderDailyQty();
  }
  async function copyNotice() {
    const text = noticeText();
    if (!shipList().length) {
      msg = "請先填寄送件數。";
      renderDailyQty();
      return;
    }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      msg = "已複製單據，可以直接貼上 LINE。";
    } catch (_) {
      msg = "複製失敗，請在右邊單據上全選後複製。";
    }
    const msgEl = document.getElementById("dq-msg");
    if (msgEl) msgEl.textContent = msg;
    const btn = document.getElementById("dq-copy");
    if (btn && msg.startsWith("已複製")) btn.textContent = "已複製，可貼上 LINE";
  }
  const YF_MARKET = {
    一市: "一市場",
    二市: "二市場",
    三重: "三市場",
    板橋: "板橋",
    桃園: "桃園",
    台中: "台中",
    高雄: "高雄",
    鳳山: "鳳山",
    屏東: "屏東",
  };
  const YF_ORDER = ["一市場", "二市場", "三市場", "板橋", "桃園", "台中", "高雄", "鳳山", "屏東"];
  const YF_SUPPLY = "N99833";
  let yfBusy = false;
  function paintMsg() {
    const msgEl = document.getElementById("dq-msg");
    if (msgEl) msgEl.textContent = msg;
  }
  function yfPackSpec(spec) {
    const t = String(spec || "").trim().replace(/公斤/g, "");
    if (!t) return "";
    if (/^\d+\.$/.test(t)) return t;
    const m = t.match(/^(\d+(?:\.\d+)?)(?:\s*kg)?$/i);
    return m ? `${m[1]}kg` : t;
  }
  function yfPackLabel(spec) {
    const t = yfPackSpec(spec);
    if (!t) return "";
    if (/(公斤|kg)$/i.test(t)) return t.replace(/kg$/i, "公斤");
    return `${t}公斤`;
  }
  function yfOfficial(sku) {
    const code = String(sku || "").trim().toUpperCase();
    const item = (catalog || []).find((x) => String(x.code || "").toUpperCase() === code);
    if (!item) return { code, name: "" };
    const kind = String(item.kind || "").trim();
    const name = String(item.name || "").trim();
    const zh = kind && name && kind !== name ? `${kind} ${name}` : name || kind;
    return { code, name: zh };
  }
  function yfSheetModel(slip) {
    const cols = [];
    const items = [];
    const unmatched = [];
    for (const line of slip?.lines || []) {
      const qty = {};
      for (const slot of line.slots || []) {
        const mk = YF_MARKET[slot.mk] || "";
        const n = Number(String(slot.qty ?? "").replace(/[^\d.]/g, ""));
        if (!mk || !n) continue;
        qty[mk] = (qty[mk] || 0) + n;
        if (!cols.includes(mk)) cols.push(mk);
      }
      if (!Object.keys(qty).length) continue;
      const hit = yfOfficial(line.sku);
      if (!hit.name) {
        unmatched.push(hit.code || "未填代號");
        continue;
      }
      items.push({
        supplyNo: YF_SUPPLY,
        subCode: String(line.sub || "").trim(),
        productName: hit.name,
        sku: hit.code,
        packSpec: yfPackSpec(line.spec),
        qty,
      });
    }
    cols.sort((a, b) => {
      const ia = YF_ORDER.indexOf(a);
      const ib = YF_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return { cols, items, unmatched };
  }
  async function yfPrepare(slip) {
    await ensureCatalog();
    const model = yfSheetModel(slip);
    if (!model.items.length && !model.unmatched.length) return { model, error: "請先填市場件數。" };
    if (model.unmatched.length) return { model, error: `${model.unmatched.join("、")} 在北農品名表對不到中文，沒有送出。` };
    return { model, error: "" };
  }
  function yfPairText(model) {
    return model.items.map((it) => `${it.sku} ${it.productName}`).join("、");
  }
  function yfTableRows(model, slip) {
    const { cols, items } = model;
    const head = ["代號", "小代號", "品名", "規格", ...cols];
    const blanks = (n) => Array.from({ length: n }, () => "");
    const date = String(slip.shipDate || "").replace(/-/g, "/");
    const rows = [["永芳", date, ...blanks(Math.max(0, head.length - 2))], head];
    items.forEach((it, i) => {
      rows.push([
        it.supplyNo,
        it.subCode,
        it.productName,
        yfPackLabel(it.packSpec),
        ...cols.map((c) => (it.qty[c] ? `${it.qty[c]}件` : "")),
      ]);
      rows.push(["", "", it.sku, "", ...cols.map(() => "")]);
      if (i < items.length - 1) rows.push(blanks(head.length));
    });
    const note = String(slip.note || "").trim();
    if (note) rows.push(["備註", note]);
    return rows;
  }
  function yfTableBlob(rows) {
    const n = Math.max(2, ...rows.map((r) => r.length));
    const widths = Array.from({ length: n }, (_, col) => (col === 1 ? 102 : col === 2 ? 112 : col < 4 ? 86 : 78));
    const width = widths.reduce((sum, w) => sum + w, 0);
    const height = 30 * rows.length;
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    ctx.scale(2, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#cfd4d8";
    ctx.lineWidth = 1;
    ctx.font = '15px "Microsoft JhengHei", "Noto Sans TC", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#263238";
    ctx.beginPath();
    let x = 0;
    ctx.moveTo(0.5, 0);
    ctx.lineTo(0.5, height);
    widths.forEach((w) => {
      x += w;
      ctx.moveTo(x - 0.5, 0);
      ctx.lineTo(x - 0.5, height);
    });
    for (let r = 0; r <= rows.length; r += 1) {
      const y = 30 * r - 0.5 * (r !== 0);
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    rows.forEach((row, ri) => {
      let left = 0;
      for (let c = 0; c < n; c += 1) {
        ctx.fillText(row[c] || "", left + widths[c] / 2, 30 * ri + 15, widths[c] - 8);
        left += widths[c];
      }
    });
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  }
  async function copyYongfangNotice() {
    syncCurrent();
    const s = slips[cur];
    if (!s || s.house !== "yongfang") return;
    const ready = await yfPrepare(s);
    if (ready.error) {
      msg = ready.error;
      paintMsg();
      return;
    }
    const rows = yfTableRows(ready.model, s);
    let blob = null;
    try {
      blob = await yfTableBlob(rows);
    } catch (_) {
      blob = null;
    }
    if (!blob) {
      msg = "金芳通知圖沒做成。";
      paintMsg();
      return;
    }
    const text = rows.map((r) => r.join("\t")).join("\n");
    const html = `<table style="border-collapse:collapse;background:#fff;font-family:Microsoft JhengHei,sans-serif">${rows
      .map(
        (r) =>
          `<tr>${r
            .map(
              (cell) =>
                `<td style="min-width:70px;border:1px solid #cfd4d8;padding:4px 8px;text-align:center">${esc(cell)}</td>`,
            )
            .join("")}</tr>`,
      )
      .join("")}</table>`;
    try {
      if (navigator.clipboard && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
            "image/png": blob,
          }),
        ]);
        msg = `已複製金芳通知。品名對上 ${yfPairText(ready.model)}。`;
        paintMsg();
        const btn = document.getElementById("dq-yf-copy");
        if (btn) btn.textContent = "已複製，可貼上 LINE";
        return;
      }
    } catch (_) {}
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `金芳通知-${s.shipDate || localYmd()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    msg = "這台瀏覽器沒複製到剪貼簿，已存成圖片檔。";
    paintMsg();
  }
  async function sendYongfang() {
    syncCurrent();
    const s = slips[cur];
    if (!s || s.house !== "yongfang") return;
    const ready = await yfPrepare(s);
    if (ready.error) {
      msg = ready.error;
      paintMsg();
      return;
    }
    const model = ready.model;
    if (dayLocked(s.shipDate)) {
      msg = "這天已過，金芳底稿鎖住了，不能再寫進去。通知圖還是可以複製。";
      paintMsg();
      return;
    }
    if (yfBusy) {
      msg = "正在寫進金芳。";
      paintMsg();
      return;
    }
    yfBusy = true;
    const btn = document.getElementById("dq-yf-send");
    if (btn) btn.textContent = "寫入中…";
    msg = "正在寫進金芳，存檔和下一張都不用等。";
    paintMsg();
    try {
      const r = await fetch("./api/daily-qty/yongfang-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: s.yfId || "",
          draftDate: s.shipDate,
          title: slipNo(s),
          note: s.note || "",
          items: model.items.map((it) => ({
            supplyNo: it.supplyNo,
            subCode: it.subCode,
            productName: it.productName,
            packSpec: it.packSpec,
            markets: model.cols.map((market) => ({ market, qty: it.qty[market] || 0 })),
          })),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) throw new Error(j.error || "沒寫進金芳");
      s.yfId = j.id || s.yfId || "";
      s.yfNo = j.sheetNo ? String(j.sheetNo) : s.yfNo || "";
      msg = `已寫進金芳第 ${s.yfNo} 張。品名對上 ${yfPairText(model)}。`;
      if (btn) btn.textContent = s.yfNo ? `更新金芳第${s.yfNo}張` : "送到金芳";
      saveSlip(s);
    } catch (err) {
      msg = err && err.message ? err.message : "沒寫進金芳，再按一次。";
      if (btn) btn.textContent = s.yfNo ? `更新金芳第${s.yfNo}張` : "送到金芳";
    } finally {
      yfBusy = false;
      paintMsg();
    }
  }
  async function writePlain(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("copy");
  }
  async function copySlipText(id) {
    const s = slips.find((x) => x.id === id && x.saved);
    if (!s) return;
    if (!slipNo(s)) {
      allocSeq(s);
      try {
        await saveSlip(s);
      } catch (_) {}
    }
    try {
      await writePlain(slipPlainText(s));
      setCardMsg(id, "已複製這張單據的文字。");
    } catch (_) {
      setCardMsg(id, "複製文字失敗，請再試一次。");
    }
  }
  async function copySlipImage(id, kind) {
    const s = slips.find((x) => x.id === id && x.saved);
    if (!s) return;
    if (!slipNo(s)) {
      allocSeq(s);
      try {
        await saveSlip(s);
      } catch (_) {}
    }
    const lab = kind === "freight" ? "通知貨運" : "出單";
    setCardMsg(id, `正在做成${lab}圖片…`);
    let blob;
    try {
      blob = await slipPngBlob(s, kind === "freight" ? "freight" : "ship");
    } catch (_) {
      blob = null;
    }
    if (!blob) {
      setCardMsg(id, "做成圖片失敗。");
      return;
    }
    const okMsg = kind === "freight"
      ? "已複製通知貨運圖片，沒有內部批次。可直接貼到 LINE。"
      : "已複製出單圖片，可列印或貼到 LINE。";
    try {
      if (navigator.clipboard && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCardMsg(id, okMsg);
        return;
      }
    } catch (_) {}
    const file = new File([blob], slipFileName(s), { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${houseLab(s.house) || "單據"} ${s.shipDate || ""}`.trim() });
        setCardMsg(id, `已打開分享，請選 LINE 傳送${lab}圖片。`);
        return;
      } catch (err) {
        if (err && err.name === "AbortError") {
          setCardMsg(id, "");
          return;
        }
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setCardMsg(id, "這台不能直接貼圖，已把圖片存成檔案。");
  }
  async function copyDraftImage(kind) {
    syncCurrent();
    const s = slips[cur];
    const lab = kind === "freight" ? "通知貨運" : "出單";
    if (!s || !slipBits(s).total) {
      msg = "請先填寄送件數。";
      const msgEl = document.getElementById("dq-msg");
      if (msgEl) msgEl.textContent = msg;
      return;
    }
    let blob;
    try {
      blob = await slipPngBlob(s, kind === "freight" ? "freight" : "ship");
    } catch (_) {
      blob = null;
    }
    const msgEl = document.getElementById("dq-msg");
    if (!blob) {
      msg = "做成圖片失敗。";
      if (msgEl) msgEl.textContent = msg;
      return;
    }
    const ok = kind === "freight"
      ? "已複製通知貨運圖片，沒有內部批次，可直接貼上 LINE。"
      : "已複製出單圖片，可列印或貼上 LINE。";
    try {
      if (navigator.clipboard && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        msg = ok;
        if (msgEl) msgEl.textContent = msg;
        return;
      }
    } catch (_) {}
    const file = new File([blob], slipFileName(s), { type: "image/png" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    msg = `這台不能直接貼圖，已把${lab}存成圖片檔。`;
    if (msgEl) msgEl.textContent = msg;
  }
  function gapKey(r) {
    return [r.region || "", r.sku || "", r.altSku || "", r.crop || "", r.altCrop || "", r.h, r.p, r.swap ? 1 : 0].join("|");
  }
  function syncNoticePick(rows) {
    const problems = (rows || []).filter((r) => !r.ok);
    const sig = `${matchHouse}|${matchDay}|${problems.map(gapKey).join(";")}`;
    if (sig === noticeSig) return;
    noticeSig = sig;
    noticePick = new Set(problems.map(gapKey));
    if (gapPreviewUrl) URL.revokeObjectURL(gapPreviewUrl);
    gapPreviewUrl = "";
    gapNote = "";
  }
  function gapChosen() {
    return matchRows.filter((r) => !r.ok && noticePick.has(gapKey(r)));
  }
  function paintGapButton() {
    const btn = document.getElementById("dq-gap-img");
    const n = gapChosen().length;
    if (btn) btn.textContent = n ? `通知拍賣（${n}）` : "請先勾選有問題的";
  }
  function roundBox(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function gapPngBlob(rows) {
    const font = '"Microsoft JhengHei","Noto Sans TC",sans-serif';
    const width = 780;
    const pad = 28;
    const scale = 2;
    const measure = document.createElement("canvas").getContext("2d");
    const maxW = width - pad * 2 - 32;
    const wrap = (text, size, weight) => {
      measure.font = `${weight} ${size}px ${font}`;
      const lines = [];
      let cur = "";
      for (const ch of [...String(text || "")]) {
        const next = cur + ch;
        if (measure.measureText(next).width > maxW && cur) {
          lines.push(cur);
          cur = ch;
        } else cur = next;
      }
      if (cur) lines.push(cur);
      return lines.length ? lines : [""];
    };
    const blocks = rows.map((r) => {
      const status = r.swap
        ? (r.ok ? "代號對調，件數相同" : "代號對調，件數不同")
        : !r.p ? "我們有、拍賣沒有" : !r.h ? "拍賣有、我們沒有" : "件數不同";
      const name = r.swap
        ? `${[r.sku, r.crop].filter(Boolean).join(" ")} → ${[r.altSku, r.altCrop].filter(Boolean).join(" ")}`
        : [r.sku, r.crop].filter(Boolean).join(" ");
      const diff = `${r.d > 0 ? "+" : ""}${r.d}`;
      const lines = [
        { t: `${r.region || r.mk || ""}　${status}`, size: 22, weight: 800, color: "#7a1212" },
        ...wrap(name, 26, 800).map((t) => ({ t, size: 26, weight: 800, color: "#1c2b24" })),
        { t: `我們 ${r.h}　　拍賣 ${r.p}　　差 ${diff}`, size: 24, weight: 700, color: "#1c2b24" },
      ];
      const mk = [];
      if (r.hMarkets) mk.push(`我們 ${r.hMarkets}`);
      if (r.pMarkets) mk.push(`拍賣 ${r.pMarkets}`);
      mk.forEach((t) => wrap(t, 20, 600).forEach((line) => lines.push({ t: line, size: 20, weight: 600, color: "#5c4a12" })));
      return lines;
    });
    const blockH = (lines) => 18 + lines.reduce((n, ln) => n + ln.size + 10, 0) + 8;
    const height = pad + 96 + blocks.reduce((n, lines) => n + blockH(lines) + 12, 8) + pad;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#fff8f3";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#7a1212";
    ctx.fillRect(0, 0, width, 8);
    ctx.textBaseline = "top";
    ctx.font = `800 30px ${font}`;
    ctx.fillText(`${houseLab(matchHouse) || "拍賣"}　件數不符`, pad, pad + 10);
    ctx.font = `600 20px ${font}`;
    ctx.fillStyle = "#5c4a12";
    ctx.fillText(`寄送日 ${matchDay || ""}${matchBillDate ? `　行情日 ${matchBillDate}` : ""}　請拍賣協助確認`, pad, pad + 50);
    let y = pad + 96;
    for (const lines of blocks) {
      const h = blockH(lines);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#e7b4b4";
      ctx.lineWidth = 2;
      roundBox(ctx, pad, y, width - pad * 2, h, 12);
      ctx.fill();
      ctx.stroke();
      let ty = y + 14;
      for (const ln of lines) {
        ctx.fillStyle = ln.color;
        ctx.font = `${ln.weight} ${ln.size}px ${font}`;
        ctx.fillText(ln.t, pad + 16, ty);
        ty += ln.size + 10;
      }
      y += h + 12;
    }
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  }
  function showGapPreview() {
    const host = document.getElementById("dq-gap-preview");
    const alert = document.getElementById("dq-msg");
    if (alert) alert.textContent = gapNote;
    if (!host) return false;
    host.hidden = false;
    host.innerHTML = `<img src="${esc(gapPreviewUrl)}" alt="件數不符圖片" /><p>${esc(gapNote)}</p>`;
    host.scrollIntoView({ block: "nearest" });
    return true;
  }
  async function copyGapImage() {
    const rows = gapChosen();
    if (!rows.length) {
      msg = "請先勾選要通知拍賣的件數。";
      const el = document.getElementById("dq-msg");
      if (el) el.textContent = msg;
      return;
    }
    let blob;
    try {
      blob = await gapPngBlob(rows);
    } catch (_) {
      blob = null;
    }
    if (!blob) {
      msg = "做成圖片失敗。";
      const el = document.getElementById("dq-msg");
      if (el) el.textContent = msg;
      return;
    }
    const name = `${houseLab(matchHouse) || "拍賣"}_${matchDay || "寄貨"}_件數不符.png`.replace(/[\\/:*?"<>|\s]+/g, "_");
    let copied = false;
    let shared = false;
    try {
      if (navigator.clipboard && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        copied = true;
      }
    } catch (_) {}
    if (!copied && navigator.canShare) {
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${houseLab(matchHouse) || "拍賣"} 件數不符` });
          shared = true;
        } catch (err) {
          if (err && err.name === "AbortError") return;
        }
      }
    }
    if (!copied && !shared) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    if (gapPreviewUrl) URL.revokeObjectURL(gapPreviewUrl);
    gapPreviewUrl = URL.createObjectURL(blob);
    gapNote = copied
      ? "已複製圖片。到 LINE 貼上。若貼不上，長按這張圖再複製。"
      : shared
        ? "請在分享裡選 LINE。"
        : "已存成圖片檔。也可以長按這張圖複製，再貼到 LINE。";
    msg = gapNote;
    if (!showGapPreview()) renderDailyQty();
  }

  const NAME_CATS = ["全部", "根莖", "葉菜", "花果", "菇蕈", "醃漬", "水果"];
  let catalog = null;
  let catalogPromise = null;
  let findLine = -1;
  let findQ = "";
  function ensureCatalog() {
    if (catalog) return Promise.resolve(catalog);
    if (!catalogPromise) {
      catalogPromise = fetch("./auction-names.json")
        .then((r) => r.json())
        .then((j) => {
          catalog = Array.isArray(j) ? j : [];
          return catalog;
        })
        .catch(() => {
          catalog = [];
          return catalog;
        });
    }
    return catalogPromise;
  }
  function matchNames(q) {
    const s = String(q || "").trim().toLowerCase();
    if (!s || !catalog) return [];
    return catalog
      .filter((row) => `${row.code} ${row.kind} ${row.kindAlias} ${row.name} ${row.alias}`.toLowerCase().includes(s))
      .slice(0, 12);
  }
  function paintFind(input) {
    const host = input.closest(".dq-crop");
    if (!host) return;
    let box = host.querySelector(".dq-hits");
    if (!box) {
      box = document.createElement("div");
      box.className = "dq-hits";
      host.appendChild(box);
    }
    const q = findQ.trim();
    if (!q) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    const draw = () => {
      if (findQ.trim() !== q) return;
      const rows = matchNames(q);
      box.hidden = false;
      box.innerHTML = rows.length
        ? rows
            .map(
              (row) => `<button type="button" class="dq-hit" data-dq-hit="${esc(row.code)}">
                <code>${esc(row.code)}</code>
                <b>${esc(row.kind)} ${esc(row.name)}</b>
                <span>${esc(row.alias || row.kindAlias || "")}</span>
              </button>`,
            )
            .join("")
        : `<p class="dq-empty">找不到這個品名或代號</p>`;
    };
    if (!catalog) {
      box.hidden = false;
      box.innerHTML = `<p class="dq-empty">讀取品名表…</p>`;
      ensureCatalog().then(draw);
      return;
    }
    draw();
  }
  let pickFor = -1;
  let pickCat = "全部";
  let pickQ = "";
  function nameHits() {
    const q = pickQ.trim().toLowerCase();
    const rows = (catalog || []).filter((row) => {
      if (pickCat !== "全部" && row.cat !== pickCat) return false;
      if (!q) return true;
      return `${row.code} ${row.kind} ${row.kindAlias} ${row.name} ${row.alias}`.toLowerCase().includes(q);
    });
    return rows;
  }
  function paintPick() {
    const list = document.getElementById("dq-pick-list");
    const cats = document.getElementById("dq-pick-cats");
    if (!list || !cats) return;
    cats.innerHTML = NAME_CATS.map(
      (cat) => `<button type="button" class="pick${pickCat === cat ? " on" : ""}" data-dq-cat="${esc(cat)}">${esc(cat)}</button>`,
    ).join("");
    if (!catalog) {
      list.innerHTML = `<p class="dq-empty">讀取北農品名表…</p>`;
      return;
    }
    const rows = nameHits();
    const shown = rows.slice(0, 80);
    list.innerHTML = shown.length
      ? `<p class="dq-pick-count">${rows.length > shown.length ? `顯示前 ${shown.length} 筆，共 ${rows.length} 筆，請再縮小搜尋` : `${rows.length} 筆`}</p>
        <div class="dq-pick-head"><span>種類</span><span>品名</span><span>代號</span><span>俗名</span></div>
        ${shown
          .map(
            (row) => `<button type="button" class="dq-pick-row" data-dq-code="${esc(row.code)}">
              <span>${esc(row.kind)}</span>
              <b>${esc(row.name)}</b>
              <code>${esc(row.code)}</code>
              <span>${esc(row.alias || row.kindAlias || "—")}</span>
            </button>`,
          )
          .join("")}`
      : `<p class="dq-empty">找不到這個品名或代號。</p>`;
  }
  function ensurePick() {
    if (document.getElementById("dq-pick")) return;
    const el = document.createElement("div");
    el.id = "dq-pick";
    el.className = "dq-pick";
    el.hidden = true;
    el.innerHTML = `<div class="dq-pick-card" role="dialog" aria-label="選品名">
      <header>
        <div><b>選品名</b><p>北農果菜品名代碼表。選了之後代號和正式品名會一起帶入。</p></div>
        <button type="button" class="ghost" id="dq-pick-close">關閉</button>
      </header>
      <input id="dq-pick-q" type="search" placeholder="搜尋，例如 高麗菜、青梗、LA1" autocomplete="off" />
      <div class="dq-pick-cats" id="dq-pick-cats"></div>
      <div class="dq-pick-list" id="dq-pick-list"></div>
    </div>`;
    document.body.appendChild(el);
    el.addEventListener("click", (e) => {
      if (e.target.id === "dq-pick" || e.target.id === "dq-pick-close") {
        el.hidden = true;
        return;
      }
      const cat = e.target.closest("[data-dq-cat]");
      if (cat) {
        pickCat = cat.dataset.dqCat || "全部";
        paintPick();
        return;
      }
      const row = e.target.closest("[data-dq-code]");
      if (!row || !catalog) return;
      const item = catalog.find((x) => x.code === row.dataset.dqCode);
      const line = lines[pickFor];
      if (item && line) {
        line.sku = item.code;
        line.crop = item.name;
        line.kind = item.kind;
        line.alias = item.alias || item.kindAlias || "";
        el.hidden = true;
        renderDailyQty();
      }
    });
    el.querySelector("#dq-pick-q").addEventListener("input", (e) => {
      pickQ = e.target.value || "";
      paintPick();
    });
  }
  async function openPick(i) {
    pickFor = i;
    ensurePick();
    const el = document.getElementById("dq-pick");
    el.hidden = false;
    const q = document.getElementById("dq-pick-q");
    if (q) {
      q.value = pickQ;
      q.focus();
    }
    paintPick();
    if (catalog) return;
    try {
      const r = await fetch("./auction-names.json");
      catalog = await r.json();
    } catch (_) {
      catalog = [];
    }
    paintPick();
  }

  const PHOTO_FAIL = "這張照片讀不到。請換一張清楚的照片，或直接把明細貼在文字框。";
  let tessPromise = null;
  let workerPromise = null;
  let ocrStatus = () => {};
  let syncingRead = false;
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tessPromise) return tessPromise;
    tessPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
      s.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error("fail")));
      s.onerror = () => reject(new Error("fail"));
      document.head.appendChild(s);
    });
    return tessPromise;
  }
  async function ocrWorker() {
    if (!workerPromise) {
      workerPromise = (async () => {
        const Tesseract = await loadTesseract();
        const worker = await Tesseract.createWorker("chi_tra+eng", 1, {
          workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
          corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js",
          langPath: "https://tessdata.projectnaptha.com/4.0.0",
          logger(m) {
            if (!m || !m.status) return;
            if (m.status === "recognizing text") ocrStatus(`正在讀圖片 ${Math.round((m.progress || 0) * 100)}%`);
            else ocrStatus("正在準備讀圖，辨識在這台電腦進行…");
          },
        });
        await worker.setParameters({
          tessedit_pageseg_mode: "6",
          preserve_interword_spaces: "1",
        });
        return worker;
      })().catch((err) => {
        workerPromise = null;
        throw err;
      });
    }
    return workerPromise;
  }
  function imageFromClipboard(data) {
    const files = data?.files;
    if (files && files[0] && /^image\//.test(files[0].type || "")) return files[0];
    const items = data?.items || [];
    for (const item of items) {
      if (item.kind === "file" && /^image\//.test(item.type || "")) return item.getAsFile();
    }
    return null;
  }
  function setBillMsg(text) {
    msg = text;
    const el = document.getElementById("dq-msg");
    if (el) el.textContent = text;
  }
  function matchSlip() {
    return slips.find((x) => x.id === matchId) || slips.find((x) => x.saved) || null;
  }
  function rememberSlip(slip) {
    if (!slip || !slips[cur] || slips[cur].id !== slip.id) return;
    billText = slip.billText || "";
    rows = Array.isArray(slip.rows) ? slip.rows : [];
  }
  function slipWantDate(slip) {
    const prevHouse = house;
    const prevDate = shipDate;
    house = slip.house || "";
    shipDate = slip.shipDate || localYmd();
    const want = billDateOf(shipDate);
    house = prevHouse;
    shipDate = prevDate;
    return want;
  }
  function readRowsFor(slip, text) {
    const prevHouse = house;
    const prevDate = shipDate;
    house = slip.house || "";
    shipDate = slip.shipDate || localYmd();
    let rows = [];
    try {
      const want = billDateOf(shipDate);
      rows = parseBill(text, { keepAllDates: true }).map((r) => ({
        dt: r.dt || want,
        mk: r.mk || "",
        name: r.crop || r.sku || "",
        sku: r.sku || "",
        qty: r.qty,
      }));
    } finally {
      house = prevHouse;
      shipDate = prevDate;
    }
    return rows;
  }
  function billTextFromRows(rows) {
    const withSku = rows.some((r) => String(r.sku || "").trim());
    const head = withSku ? "日期\t市場\t品名\t小代號\t件數" : "日期\t市場\t品名\t件數";
    const body = rows.map((r) => {
      const cells = [r.dt || "", r.mk || "", r.name || ""];
      if (withSku) cells.push(r.sku || "");
      cells.push(r.qty ?? "");
      return cells.join("\t");
    });
    return [head, ...body].join("\n");
  }
  function readTableHtml(rows) {
    if (!rows || !rows.length) return "";
    const showSku = rows.some((r) => String(r.sku || "").trim());
    const body = rows
      .map((r) => {
        const opts = [`<option value="">市場</option>`]
          .concat(MK_KEYS.map((mk) => `<option value="${esc(mk)}"${mk === r.mk ? " selected" : ""}>${esc(mk)}</option>`))
          .join("");
        const skuCell = showSku ? `<td><input data-dq-read="sku" value="${esc(r.sku || "")}" /></td>` : "";
        return `<tr data-dq-sku="${esc(r.sku || "")}">
          <td><input data-dq-read="dt" value="${esc(r.dt || "")}" /></td>
          <td><select data-dq-read="mk">${opts}</select></td>
          <td><input data-dq-read="name" value="${esc(r.name || "")}" /></td>
          ${skuCell}
          <td><input data-dq-read="qty" inputmode="decimal" value="${esc(r.qty ?? "")}" /></td>
        </tr>`;
      })
      .join("");
    const skuHead = showSku ? "<th>代號</th>" : "";
    return `<div class="dq-read" id="dq-read">
      <p class="dq-read-lab">讀到的明細。件數不對請先改，再按開始回對。</p>
      <div class="dq-sheet-wrap"><table class="dq-sheet dq-read-sheet">
        <thead><tr><th>日期</th><th>市場</th><th>品名</th>${skuHead}<th>件數</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>
    </div>`;
  }
  function rowsFromEditor() {
    const rows = [];
    document.querySelectorAll("#dq-read tbody tr").forEach((tr) => {
      const get = (k) => tr.querySelector(`[data-dq-read="${k}"]`)?.value ?? "";
      const skuInput = tr.querySelector(`[data-dq-read="sku"]`);
      rows.push({
        dt: get("dt").trim(),
        mk: get("mk").trim(),
        name: get("name").trim(),
        sku: skuInput ? skuInput.value.trim() : tr.dataset.dqSku || "",
        qty: get("qty").trim(),
      });
    });
    return rows;
  }
  function ocrLineList(data) {
    const lines = [];
    for (const block of data?.blocks || []) {
      for (const para of block.paragraphs || []) {
        for (const line of para.lines || []) lines.push(line);
      }
    }
    return lines;
  }
  function rowsFromOcrData(data) {
    const lines = ocrLineList(data);
    if (!lines.length) return [];
    const packed = (s) => String(s || "").replace(/\s+/g, "");
    let header = null;
    for (const line of lines.slice(0, 10)) {
      const words = (line.words || []).filter((w) => packed(w.text));
      const joined = words.map((w) => packed(w.text)).join("");
      if (/市場/.test(joined) && /品名/.test(joined) && /件/.test(joined)) {
        header = words;
        break;
      }
    }
    if (!header) return [];
    const center = (w) => ((w.bbox?.x0 || 0) + (w.bbox?.x1 || 0)) / 2;
    const colX = (re) => {
      const hit = header.find((w) => re.test(packed(w.text)));
      return hit ? center(hit) : null;
    };
    const cols = [
      ["dt", colX(/日期/)],
      ["mk", colX(/市場/)],
      ["name", colX(/品名/)],
      ["sku", colX(/代號/)],
      ["qty", colX(/件數/) ?? colX(/件/)],
    ].filter((pair) => pair[1] != null);
    if (!cols.some((c) => c[0] === "mk") || !cols.some((c) => c[0] === "qty")) return [];
    const headerBottom = Math.max(...header.map((w) => w.bbox?.y1 || 0));
    const out = [];
    for (const line of lines) {
      const words = (line.words || []).filter((w) => packed(w.text));
      if (!words.length) continue;
      const top = Math.min(...words.map((w) => w.bbox?.y0 || 0));
      if (top < headerBottom - 2) continue;
      const joined = words.map((w) => w.text).join("");
      if (/合計|小計/.test(joined)) continue;
      if (/市場/.test(packed(joined)) && /件/.test(packed(joined))) continue;
      const cells = { dt: [], mk: [], name: [], sku: [], qty: [] };
      for (const w of words) {
        const x = center(w);
        let best = cols[0][0];
        let bestD = Infinity;
        for (const [key, cx] of cols) {
          const d = Math.abs(x - cx);
          if (d < bestD) {
            bestD = d;
            best = key;
          }
        }
        cells[best].push(w.text);
      }
      const name = cells.name.join("").replace(/\s+/g, "").trim();
      const mk = marketOf(cells.mk.join(""));
      const sku = (cells.sku.join(" ").match(/[A-Za-z*]{1,3}\d{1,3}/) || [])[0] || "";
      const q = qtyOf(cells.qty.join(" "));
      const dt = parseDate(cells.dt.join(" ")) || "";
      if (!mk || !q || !name) continue;
      out.push({ dt, mk, name, sku, qty: q });
    }
    return out;
  }
  async function prepSlipImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("img"));
        el.src = url;
      });
      const long = Math.max(img.width, img.height, 1);
      const scale = Math.max(1, Math.min(2.4, 1800 / long));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const image = ctx.getImageData(0, 0, w, h);
      const d = image.data;
      for (let i = 0; i < d.length; i += 4) {
        let y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        y = (y - 128) * 1.45 + 128;
        if (y < 0) y = 0;
        if (y > 255) y = 255;
        d[i] = d[i + 1] = d[i + 2] = y;
      }
      ctx.putImageData(image, 0, 0);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  function stageReadRows(slip, rows, note) {
    const want = slipWantDate(slip);
    const ready = rows
      .map((r) => ({
        dt: r.dt || want,
        mk: r.mk || "",
        name: r.name || r.crop || "",
        sku: r.sku || "",
        qty: r.qty ?? "",
      }))
      .filter((r) => r.mk && qtyOf(r.qty) && r.name);
    if (!ready.length) return false;
    slip.billText = billTextFromRows(ready);
    slip.rows = [];
    rememberSlip(slip);
    msg = note || `已讀出 ${ready.length} 筆。請核對品名和件數，再按開始回對。`;
    return true;
  }
  function stageBillText(text) {
    if (!matchHouse) {
      msg = "請先選要回對的社場。";
      renderDailyQty();
      return;
    }
    const raw = String(text || "").trim();
    if (!raw) {
      msg = "沒有貼到明細。";
      renderDailyQty();
      return;
    }
    const virtual = { house: matchHouse, shipDate: matchDay, billText: "", rows: [] };
    const rows = readRowsFor(virtual, raw);
    if (!stageReadRows(virtual, rows)) {
      virtual.billText = raw;
      msg = "沒有讀出件數。請確認有日期、市場、品名、件數，文字框還可以改。";
    }
    matchBill = virtual.billText || raw;
    matchRows = [];
    matchPriceRows = [];
    saveMatchStore();
    renderDailyQty();
  }
  function clearMatchPhoto() {
    if (matchPhotoUrl) URL.revokeObjectURL(matchPhotoUrl);
    matchPhotoUrl = "";
    matchPhotoName = "";
  }
  async function ingestBillImage(file) {
    if (!file) return;
    clearMatchPhoto();
    matchPhotoUrl = URL.createObjectURL(file);
    matchPhotoName = file.name || "照片";
    if (!matchHouse) {
      msg = `已選取「${matchPhotoName}」。請再選社場。`;
      renderDailyQty();
      return;
    }
    msg = `已選取「${matchPhotoName}」，正在讀件數。`;
    renderDailyQty();
    const slip = { house: matchHouse, shipDate: matchDay, billText: "", rows: [] };
    ocrStatus = setBillMsg;
    setBillMsg(`已選取「${matchPhotoName}」，正在讀件數。辨識在這台電腦進行，不會把照片送出去。`);
    try {
      const canvas = await prepSlipImage(file);
      const worker = await ocrWorker();
      const result = await worker.recognize(canvas, {}, { text: true, blocks: true });
      const data = result?.data || {};
      const text = String(data.text || "").trim();
      const conf = Number(data.confidence || 0);
      let rows = rowsFromOcrData(data);
      if (!rows.length && text) rows = readRowsFor(slip, text);
      const unsure = conf > 0 && conf < 70;
      const noted = stageReadRows(slip, rows);
      if (noted && unsure) {
        const n = String(slip.billText || "").split(/\n/).length - 1;
        msg = `讀出 ${Math.max(n, 1)} 筆，但不太確定。請先改不對的件數，再按開始回對。`;
      }
      matchBill = slip.billText || text || "";
      matchRows = [];
      matchPriceRows = [];
      saveMatchStore();
      if (!noted) {
        msg = text ? "這張照片讀不到件數。文字框裡是讀到的原文，可以改，或改貼明細。" : PHOTO_FAIL;
      }
      renderDailyQty();
    } catch (_) {
      workerPromise = null;
      msg = PHOTO_FAIL;
      renderDailyQty();
    }
  }
  function onBillPaste(e) {
    const box = e.target.closest?.("#dq-bill, .dq-paste");
    if (!box) return;
    const data = e.clipboardData;
    const image = imageFromClipboard(data);
    if (image) {
      e.preventDefault();
      ingestBillImage(image);
      return;
    }
    const html = data?.getData("text/html") || "";
    const plain = data?.getData("text/plain") || "";
    if (/<table/i.test(html) && /市場|品名|件數/.test(html)) {
      e.preventDefault();
      stageBillText(html);
      return;
    }
    if (e.target.id !== "dq-bill" && plain.trim()) {
      e.preventDefault();
      const ta = document.getElementById("dq-bill");
      if (!ta) return;
      const next = ta.value.trim() ? `${ta.value.trim()}\n${plain}` : plain;
      ta.value = next;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function bindOnce() {
    if (bound) return;
    bound = true;
    setInterval(() => {
    const root = document.getElementById("dq-root");
      const page = document.getElementById("page-daily-qty");
    if (!root) return;
      if (document.hidden) return;
      if (page && page.hidden) return;
      if (document.activeElement && root.contains(document.activeElement)) return;
      pullHistory();
    }, 12000);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      const root = document.getElementById("dq-root");
      const page = document.getElementById("page-daily-qty");
      if (!root || (page && page.hidden)) return;
      pullHistory();
    });
    const root = document.getElementById("dq-root");
    if (!root) return;
    root.addEventListener("change", (e) => {
      const mkSel = e.target.closest("[data-dq-carry-mk]");
      if (mkSel) {
        const key = mkSel.dataset.dqCarryMk || "";
        const prev = carryDraft.get(key) || { kind: "", mk: "" };
        carryDraft.set(key, { kind: prev.kind, mk: mkSel.value });
        return;
      }
      const pairInput = e.target.closest("[data-dq-pair]");
      if (pairInput) {
        const key = pairInput.dataset.dqPair || "";
        if (pairInput.checked) pairPick.add(key);
        else pairPick.delete(key);
        renderDailyQty();
        return;
      }
      const input = e.target.closest("[data-dq-gap]");
      if (!input) return;
      const key = input.dataset.dqGap || "";
      if (input.checked) noticePick.add(key);
      else noticePick.delete(key);
      root.querySelectorAll("[data-dq-gap]").forEach((el) => {
        if (el !== input && el.dataset.dqGap === key) el.checked = input.checked;
      });
      paintGapButton();
    });
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-dq-home]")) {
        window.scrollTo(0, 0);
        if (typeof goHome === "function") goHome();
        return;
      }
      if (e.target.closest("[data-dq-seq]")) {
        const btn = e.target.closest("[data-dq-seq]");
        const id = btn.dataset.dqSeq || "";
        const s = slips.find((x) => x.id === id);
        const td = btn.parentElement;
        if (!s || !td || td.querySelector(".dq-seq-edit")) return;
        const input = document.createElement("input");
        input.className = "dq-seq-edit";
        input.value = slipNo(s);
        input.maxLength = 12;
        input.setAttribute("aria-label", "單號");
        td.replaceChildren(input);
        input.focus();
        input.select();
        let done = false;
        const cancel = () => {
          if (done) return;
          done = true;
          renderDailyQty();
        };
        const commit = () => {
          if (done) return;
          done = true;
          const next = cleanSeq(input.value);
          if (next == null) {
            msg = "單號請用英數，12碼以內。";
            renderDailyQty();
            return;
          }
          if (next === slipNo(s)) {
            renderDailyQty();
            return;
          }
          pushSlipLog(s, "修正", `單號 ${slipNo(s) || "空白"} → ${next || "空白"}`);
          s.seq = next;
          s.at = Date.now();
          saveSlip(s, { seqSet: true });
          msg = next ? `單號已改成 ${next}。` : "單號已清掉。";
          renderDailyQty();
        };
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            commit();
          } else if (ev.key === "Escape") {
            ev.preventDefault();
            cancel();
          }
        });
        input.addEventListener("blur", () => commit());
        return;
      }
      if (e.target.closest("[data-dq-day]")) {
        listDay = e.target.closest("[data-dq-day]").dataset.dqDay || listDay;
        listMonth = String(listDay || "").slice(0, 7);
        pane = "list";
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-key-day]")) {
        const day = e.target.closest("[data-dq-key-day]").dataset.dqKeyDay || "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
        keyMonth = day.slice(0, 7);
        showDay(day);
        return;
      }
      if (e.target.closest("[data-dq-key-shift]")) {
        const dir = Number(e.target.closest("[data-dq-key-shift]").dataset.dqKeyShift) || 0;
        keyMonth = shiftMonth(keyMonth || (shipDate || localYmd()).slice(0, 7), dir);
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-match-cal]")) {
        matchDay = e.target.closest("[data-dq-match-cal]").dataset.dqMatchCal || matchDay;
        matchMonth = String(matchDay || "").slice(0, 7);
        matchRows = [];
        matchPriceRows = [];
        matchSource = "";
        matchCalOpen = false;
        matchFold = "";
        resetPriceFilter();
        saveMatchStore();
        pane = "match";
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-match-shift]")) {
        const dir = Number(e.target.closest("[data-dq-match-shift]").dataset.dqMatchShift) || 0;
        matchMonth = shiftMonth(matchMonth || (matchDay || localYmd()).slice(0, 7), dir);
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-shift]")) {
        const dir = Number(e.target.closest("[data-dq-shift]").dataset.dqShift) || 0;
        listMonth = shiftMonth(listMonth || (listDay || localYmd()).slice(0, 7), dir);
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-day-match]")) {
        openDayMatch();
        return;
      }
      if (e.target.closest("[data-dq-pane]")) {
        syncCurrent();
        pane = e.target.closest("[data-dq-pane]").dataset.dqPane || "key";
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-drop]")) {
        const index = Number(e.target.closest("[data-dq-drop]").dataset.dqDrop);
        const s = slips[index];
        if (!canDropSlip(s)) return;
        if (slipHasBody(s) && !window.confirm("刪除這張還沒送出的單？已送出的單不會被刪。")) return;
        dropDraft(index);
        return;
      }
      if (e.target.closest("[data-dq-slip]")) {
        syncCurrent();
        applySlip(Number(e.target.closest("[data-dq-slip]").dataset.dqSlip));
        pane = "key";
        msg = dayLocked(shipDate)
          ? "這天已過，鍵單只能看。要改請到入單總資料。"
          : houseName()
            ? `正在修改${houseName()}。改完再按確認儲存。`
            : "";
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-copy-text]")) {
        copySlipText(e.target.closest("[data-dq-copy-text]").dataset.dqCopyText || "");
        return;
      }
      if (e.target.closest("[data-dq-copy-ship]")) {
        copySlipImage(e.target.closest("[data-dq-copy-ship]").dataset.dqCopyShip || "", "ship");
        return;
      }
      if (e.target.closest("[data-dq-copy-freight]")) {
        copySlipImage(e.target.closest("[data-dq-copy-freight]").dataset.dqCopyFreight || "", "freight");
        return;
      }
      if (e.target.closest("[data-dq-fix-cancel]")) {
        listEditId = "";
        listEdit = null;
        msg = "";
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-fix-save]")) {
        saveListEdit();
        return;
      }
      if (e.target.closest("[data-dq-fix-add-line]")) {
        readListEditForm();
        if (!listEdit) return;
        const prev = listEdit.lines[listEdit.lines.length - 1];
        const line = freshLine();
        line.sub = (prev && prev.sub) || "";
        const mks = ((prev && prev.slots) || []).map((s) => s.mk).filter(Boolean);
        line.slots = mks.length ? mks.map((mk) => ({ mk, qty: "" })) : [{ mk: "", qty: "" }];
        listEdit.lines.push(line);
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-fix-del-line]")) {
        readListEditForm();
        if (!listEdit) return;
        const i = Number(e.target.closest("[data-dq-fix-del-line]").dataset.dqFixDelLine);
        if (i >= 0) listEdit.lines.splice(i, 1);
        if (!listEdit.lines.length) listEdit.lines.push(freshLine());
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-fix-add-slot]")) {
        readListEditForm();
        if (!listEdit) return;
        const i = Number(e.target.closest("[data-dq-fix-add-slot]").dataset.dqFixAddSlot);
        const line = listEdit.lines[i];
        if (line && (line.slots || []).length < MK_KEYS.length) {
          if (!line.slots) line.slots = [];
          line.slots.push({ mk: "", qty: "" });
        }
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-fix-del-slot]")) {
        readListEditForm();
        if (!listEdit) return;
        const btn = e.target.closest("[data-dq-fix-del-slot]");
        const line = listEdit.lines[Number(btn.dataset.dqFixDelSlotLine)];
        const si = Number(btn.dataset.dqFixDelSlotI);
        if (line && line.slots && line.slots.length > 1 && si >= 0) line.slots.splice(si, 1);
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-fix]")) {
        beginListEdit(e.target.closest("[data-dq-fix]").dataset.dqFix || "");
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-void]")) {
        const id = e.target.closest("[data-dq-void]").dataset.dqVoid || "";
        const s = slips.find((x) => x.id === id && x.saved && !x.voided);
        if (!s) return;
        if (!window.confirm("刪除後這張單會用紅線畫掉，移到最下面，不會從資料消失。")) return;
        s.voided = true;
        pushSlipLog(s, "刪除", slipBrief(s));
        s.at = Date.now();
        saveSlip(s);
        msg = "已刪除，紅線留在最下面。";
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-match]")) {
        syncCurrent();
        const picked = slips.find((x) => x.id === (e.target.closest("[data-dq-match]").dataset.dqMatch || ""));
        if (picked) {
          matchHouse = picked.house || matchHouse;
          matchDay = picked.shipDate || matchDay;
          matchRows = [];
          matchPriceRows = [];
          matchSource = "";
          matchFold = "";
          resetPriceFilter();
          saveMatchStore();
        }
        pane = "match";
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-another]")) {
        openAnother(house);
        return;
      }
      if (e.target.closest("[data-dq-house]")) {
        openHouse(e.target.closest("[data-dq-house]").dataset.dqHouse || "");
        return;
      }
      if (e.target.closest("[data-dq-hit]")) {
        const code = e.target.closest("[data-dq-hit]").dataset.dqHit || "";
        const lineEl = e.target.closest("[data-dq-line]");
        const line = lines[Number(lineEl?.dataset.dqLine)];
        const item = (catalog || []).find((x) => x.code === code);
        if (line && item) {
          line.sku = item.code;
          line.crop = item.name;
          line.kind = item.kind;
          line.alias = item.alias || item.kindAlias || "";
          findLine = -1;
          findQ = "";
          renderDailyQty();
        }
        return;
      }
      if (e.target.closest("#dq-confirm")) {
        confirmSlip();
        return;
      }
      if (e.target.closest("#dq-add")) {
        if (dayLocked(shipDate)) return;
        addItem();
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-add-slot]")) {
        if (dayLocked(shipDate)) return;
        const lineEl = e.target.closest("[data-dq-line]");
        const line = lines[Number(lineEl?.dataset.dqLine)];
        if (line && line.slots.length < MK_KEYS.length) line.slots.push({ mk: "", qty: "" });
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-del-slot]")) {
        if (dayLocked(shipDate)) return;
        const lineEl = e.target.closest("[data-dq-line]");
        const row = e.target.closest("[data-dq-slot]");
        const line = lines[Number(lineEl?.dataset.dqLine)];
        const si = Number(row?.dataset.dqSlot);
        if (line && line.slots.length > 1 && si >= 0) line.slots.splice(si, 1);
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-del]")) {
        if (dayLocked(shipDate)) return;
        const i = Number(e.target.closest("[data-dq-del]").dataset.dqDel);
        lines.splice(i, 1);
        if (!lines.length) lines.push(freshLine());
        renderDailyQty();
        return;
      }
      if (e.target.closest("#dq-copy") || e.target.closest("#dq-img-ship") || e.target.closest("#dq-img-freight") || e.target.closest("#dq-yf-send") || e.target.closest("#dq-yf-copy")) {
        if (!viewMatchesSlip()) {
          msg = "這天沒有單。";
          const msgEl = document.getElementById("dq-msg");
          if (msgEl) msgEl.textContent = msg;
          return;
        }
      }
      if (e.target.closest("#dq-copy")) {
        copyNotice();
        return;
      }
      if (e.target.closest("#dq-img-ship")) {
        copyDraftImage("ship");
        return;
      }
      if (e.target.closest("#dq-img-freight")) {
        copyDraftImage("freight");
        return;
      }
      if (e.target.closest("#dq-yf-send")) {
        sendYongfang();
        return;
      }
      if (e.target.closest("#dq-yf-copy")) {
        copyYongfangNotice();
        return;
      }
      if (e.target.closest("#dq-bill-pick")) {
        document.getElementById("dq-bill-file")?.click();
        return;
      }
      if (e.target.closest("#dq-photo-clear")) {
        clearMatchPhoto();
        msg = "已清除這張照片。";
          renderDailyQty();
          return;
        }
      if (e.target.closest("[data-dq-help-open]")) {
        matchHelp = true;
          renderDailyQty();
          return;
        }
      if (e.target.matches("[data-dq-help-close]") || e.target.closest("button[data-dq-help-close]")) {
        matchHelp = false;
          renderDailyQty();
          return;
        }
      if (e.target.closest("[data-dq-cal-toggle]")) {
        matchCalOpen = !matchCalOpen;
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-ship-toggle]")) {
        matchFold = matchFold === "open" ? "run" : "open";
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-qty-ok]")) {
        saveQtyConfirm();
        return;
      }
      if (e.target.closest("#dq-gap-img")) {
        copyGapImage();
        return;
      }
      if (e.target.closest("#dq-price-copy")) {
        copyPriceImage();
        return;
      }
      const carryKind = e.target.closest("[data-dq-carry-kind]");
      if (carryKind) {
        const key = carryKind.dataset.dqCarry || "";
        const kind = carryKind.dataset.dqCarryKind || "";
        const row = matchRows.find((r) => gapKey(r) === key);
        const mks = ourMarkets(row || {});
        const prev = carryDraft.get(key) || { kind: "", mk: "" };
        const mk = kind === "stay" && mks.length === 1 ? mks[0] : kind === "move" ? "" : prev.mk;
        carryDraft.set(key, { kind, mk });
        renderDailyQty();
        return;
      }
      const carrySave = e.target.closest("[data-dq-carry-save]");
      if (carrySave) {
        saveCarry(carrySave.dataset.dqCarrySave || "");
        return;
      }
      if (e.target.closest("[data-dq-pair-ok]")) {
        confirmManualPair();
        return;
      }
      if (e.target.closest("[data-dq-price-sub]")) {
        priceSub = e.target.closest("[data-dq-price-sub]").dataset.dqPriceSub || "";
        if (priceItem && !priceItemList(priceSub).includes(priceItem)) priceItem = "";
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-price-item]")) {
        priceItem = e.target.closest("[data-dq-price-item]").dataset.dqPriceItem || "";
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-qty-clear]")) {
        clearQtyConfirm();
        return;
      }
      if (e.target.closest("[data-dq-match-house]")) {
        matchHouse = e.target.closest("[data-dq-match-house]").dataset.dqMatchHouse || "";
        matchRows = [];
        matchPriceRows = [];
        matchCaptcha = "";
        matchCaptchaSub = "";
        matchSource = "";
        matchFold = "";
        resetPriceFilter();
        saveMatchStore();
        pane = "match";
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-run]")) {
        runAuctionMatch(document.getElementById("dq-captcha")?.value || "");
        return;
      }
      if (e.target.closest("#dq-run-paste")) {
        matchBill = document.getElementById("dq-bill")?.value || matchBill || "";
        const mates = slipsForMatch(matchHouse, matchDay);
        if (!matchHouse) {
          msg = "請先選社場。";
          renderDailyQty();
          return;
        }
        if (!mates.length) {
          msg = "這天這個社場還沒有已送出的單。";
          renderDailyQty();
          return;
        }
        if (!String(matchBill).trim()) {
          msg = "請貼上社場送來的整份明細。";
          renderDailyQty();
          return;
        }
        matchSource = "paste";
        matchPriceRows = [];
        matchRows = compareHouseDay();
        matchFold = "run";
        saveMatchStore();
        const miss = matchRows.filter((r) => !r.ok).length;
        msg = miss ? `回對完成，有 ${miss} 筆和貼上的明細不一致。` : "回對完成，和貼上的明細一致。";
        renderDailyQty();
        return;
      }
    });
    function readField(e) {
      const t = e.target;
      if (dayLocked(shipDate) && t.closest(".dq-form") && t.id !== "dq-date") return;
      if (t.id === "dq-q") {
        listQ = t.value;
        const pos = t.selectionStart;
        renderDailyQty();
        const again = document.getElementById("dq-q");
        if (again) {
          again.focus();
          const n = Math.min(pos == null ? again.value.length : pos, again.value.length);
          again.setSelectionRange(n, n);
        }
        return;
      }
      if (t.hasAttribute?.("data-dq-read")) {
        const s = matchSlip();
        if (!s) return;
        syncingRead = true;
        s.billText = billTextFromRows(rowsFromEditor());
        rememberSlip(s);
        const ta = document.getElementById("dq-bill");
        if (ta) ta.value = s.billText;
        syncingRead = false;
        persistLocal();
        queueSlipSync(s);
        return;
      }
      if (t.id === "dq-match-day") {
        matchDay = t.value || localYmd();
        matchRows = [];
        matchPriceRows = [];
        matchSource = "";
        matchFold = "";
        resetPriceFilter();
        saveMatchStore();
        renderDailyQty();
        return;
      }
      if (t.id === "dq-bill") {
        if (pane === "match") {
          matchBill = t.value;
          saveMatchStore();
          if (!syncingRead) {
            const host = document.getElementById("dq-read-host");
            if (host) host.innerHTML = readTableHtml(readRowsFor({ house: matchHouse, shipDate: matchDay }, t.value));
          }
          return;
        }
        billText = t.value;
        persistLocal(true);
        return;
      }
      if (t.id === "dq-bill-file") {
        const file = t.files && t.files[0];
        t.value = "";
        if (file) ingestBillImage(file);
        return;
      }
      if (t.id === "dq-note") {
        note = t.value;
        paintSlip();
        persistLocal(true);
        return;
      }
      if (t.id === "dq-code") {
        slipCode = t.value.trim();
        lines.forEach((line) => { line.sub = slipCode; });
        paintSlip();
        persistLocal(true);
        return;
      }
      if (t.hasAttribute("data-dq-mkt")) {
        if (e.type !== "change") return;
        const from = t.getAttribute("data-dq-mkt") || "";
        const to = t.value;
        if (from === to) return;
        lines.forEach((line) => {
          if (!line.slots || !line.slots[0]) line.slots = [{ mk: "", qty: "" }];
          if ((line.slots[0].mk || "") === from) line.slots[0].mk = to;
        });
        renderDailyQty();
        return;
      }
      if (t.id === "dq-inner") {
        inner = t.value;
        paintSlip();
        persistLocal(true);
        return;
      }
      if (t.id === "dq-title") {
        title = t.value.trim();
        return;
      }
      if (t.id === "dq-seq") {
        const next = cleanSeq(t.value);
        if (String(t.value || "").trim() && next == null) {
          msg = "單號請用英數，12碼以內。";
          const msgEl = document.getElementById("dq-msg");
          if (msgEl) msgEl.textContent = msg;
          return;
        }
        if (slips[cur]) slips[cur].seq = next || "";
        paintSlip();
        persistLocal(!!(next && slipHasBody(slips[cur])));
        return;
      }
      if (t.id === "dq-date") {
        const next = t.value || "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
        if (next === (shipDate || localYmd())) return;
        showDay(next);
        return;
      }
      const lineEl = t.closest("[data-dq-line]");
      if (!lineEl) return;
      const line = lines[Number(lineEl.dataset.dqLine)];
      if (!line) return;
      if (t.hasAttribute("data-dq-find")) {
        findLine = Number(lineEl.dataset.dqLine);
        findQ = t.value;
        if (line.sku) {
          line.sku = "";
          line.kind = "";
          line.alias = "";
        }
        if (!line.sku) line.crop = t.value.trim();
        paintFind(t);
        paintSlip();
        persistLocal(true);
        return;
      }
      if (t.dataset.dqF === "sub") line.sub = t.value.trim();
      if (t.dataset.dqF === "country") line.country = t.value.trim();
      if (t.dataset.dqF === "spec") line.spec = String(t.value || "").replace(/公斤/g, "").trim();
      if (t.dataset.dqF === "sku") line.sku = t.value;
      const row = t.closest("[data-dq-slot]");
      if (row && line.slots) {
        const slot = line.slots[Number(row.dataset.dqSlot)];
        if (slot) {
          if (t.hasAttribute("data-dq-slot-mk")) slot.mk = t.value;
          if (t.hasAttribute("data-dq-slot-qty")) slot.qty = t.value;
          row.classList.toggle("is-on", !!(slot.mk && qtyOf(slot.qty)));
          markUsedMarkets(lineEl, line);
        }
      }
      paintSlip();
      persistLocal(true);
    }
    root.addEventListener("change", readField);
    root.addEventListener("input", readField);
    root.addEventListener("paste", onBillPaste);
    root.addEventListener("dragover", (e) => {
      if (e.target.closest?.(".dq-paste")) e.preventDefault();
    });
    root.addEventListener("drop", (e) => {
      if (!e.target.closest?.(".dq-paste")) return;
      const file = [...(e.dataTransfer?.files || [])].find((f) => /^image\//.test(f.type || ""));
      if (!file) return;
      e.preventDefault();
      ingestBillImage(file);
    });
    root.addEventListener("focusin", (e) => {
      if (e.target.hasAttribute("data-dq-find")) ensureCatalog();
    });
  }

  function markUsedMarkets(lineEl, line) {
    const used = new Set((line.slots || []).map((s) => s.mk).filter(Boolean));
    lineEl.querySelectorAll("[data-dq-slot-mk]").forEach((sel) => {
      const cur = sel.value;
      [...sel.options].forEach((op) => {
        if (!op.value) return;
        op.disabled = op.value !== cur && used.has(op.value);
      });
    });
  }

  function slipPreviewHtml(s) {
    const sum = slipBits(s);
    const no = slipNo(s);
    const head = `【${houseLab(s.house) || "未選社場"}】寄送 ${s.shipDate || ""}`;
    const chunks = [esc(no ? `${head}  ${no}` : head)];
    sum.blocks.forEach((b) => {
      const lines = String(b.label || "").split("\n").map((t) => {
        if (b.name && t.startsWith(b.name)) return `<b>${esc(b.name)}</b>${esc(t.slice(b.name.length))}`;
        return esc(t);
      });
      const markets = b.markets.map((m) => esc(`${m.mk} ${m.qty}件`));
      chunks.push([...lines, ...markets, esc(`合計 ${b.sub}件`)].join("\n"));
    });
    const freight = String(s.note || "").trim();
    const batch = String(s.inner || "").trim();
    if (freight) chunks.push(esc(`收貨：${freight}`));
    if (batch) chunks.push(esc(`批次：${batch}`));
    (s.log || []).filter((e) => e.kind === "移拍" && e.text).forEach((e) => chunks.push(`<b>移拍：${esc(e.text)}</b>`));
    return chunks.join("\n\n");
  }
  function viewMatchesSlip() {
    const s = slips[cur];
    if (!s) return false;
    if (!dayLocked(shipDate)) return true;
    if (s.shipDate !== shipDate) return false;
    if (house && s.house && s.house !== house) return false;
    return true;
  }
  function paintSlip() {
    const box = document.getElementById("dq-slip");
    if (!box) return;
    syncCurrent();
    if (!viewMatchesSlip()) {
      box.textContent = "這天沒有單。";
      box.classList.add("is-empty");
      return;
    }
    const empty = !shipList().length;
    if (empty) box.textContent = "左邊填市場件數後，這裡會顯示要貼到 LINE 的單據。";
    else box.innerHTML = slipPreviewHtml(slips[cur]);
    box.classList.toggle("is-empty", empty);
    const tab = document.querySelector("#dq-root .dq-tab.on");
    if (tab && slips[cur]) tab.textContent = slipTabText(slips[cur]);
  }

  let booted = false;
  function renderDailyQty() {
    bindOnce();
    const root = document.getElementById("dq-root");
    if (!root) return;
    if (!booted) {
      booted = true;
      restoreLocal();
      const hash = (location.hash || "").replace("#", "");
      if (hash === "list" || hash === "match" || hash === "key") pane = hash;
      slips.forEach((s) => {
        if (!s.saved && slipHasBody(s)) queueSlipSync(s);
      });
      loadPairs();
      loadMatchStore();
      loadConfirms();
      loadCarries();
      pushMatch();
    }
    if (!shipDate) shipDate = localYmd();
    syncCurrent();
    const houseDay = shipDate || localYmd();
    const houseBtns = HOUSES.map((h) => {
      const n = houseSlips(h.id, houseDay).length;
      const badge = n ? `<em class="dq-house-n">${n}</em>` : "";
      return `<button type="button" class="pick${house === h.id ? " on" : ""}" data-dq-house="${esc(h.id)}">${esc(h.lab)}${badge}</button>`;
    }).join("");
    const keyLocked = dayLocked(shipDate);
    const keyLive = !keyLocked || (slips[cur] && slips[cur].shipDate === shipDate && (!house || slips[cur].house === house));
    const dis = keyLocked ? " disabled" : "";
    const lineHtml = !keyLive ? "" : lines.map((line, i) => {
        const used = new Set((line.slots || []).map((s) => s.mk).filter(Boolean));
      const countryNow = String(line.country || "");
      const countryList = countryNow && !COUNTRIES.includes(countryNow) ? COUNTRIES.concat(countryNow) : COUNTRIES;
      const countryOpts = [`<option value="">選國家</option>`]
        .concat(countryList.map((c) => `<option value="${esc(c)}"${c === countryNow ? " selected" : ""}>${esc(c)}</option>`))
        .join("");
      const shown = findLine === i
        ? findQ
        : line.sku
          ? `${line.sku} ${[line.kind, line.crop].filter(Boolean).join(" ")}`
          : line.crop || "";
        const slotHtml = (line.slots || []).map((slot, si) => {
          const opts = [`<option value="">選市場</option>`]
          .concat(MK_KEYS.map((mk) => {
                const dis = mk !== slot.mk && used.has(mk) ? " disabled" : "";
                const on = mk === slot.mk ? " selected" : "";
                return `<option value="${esc(mk)}"${on}${dis}>${esc(mk)}</option>`;
          }))
            .join("");
        const extra = !keyLocked && (line.slots || []).length > 1
          ? `<button type="button" class="ghost" data-dq-del-slot="${si}" aria-label="移掉這個市場">×</button>`
            : "";
          return `<div class="dq-slot${slot.mk && qtyOf(slot.qty) ? " is-on" : ""}" data-dq-slot="${si}">
          <select data-dq-slot-mk${dis}>${opts}</select>
          <input data-dq-slot-qty inputmode="numeric" placeholder="件數" value="${esc(slot.qty)}"${dis} />
            <span class="dq-slot-unit">件</span>
            ${extra}
          </div>`;
        }).join("");
      const addSlot = !keyLocked && (line.slots || []).length < MK_KEYS.length
        ? `<button type="button" class="ghost dq-add-slot" data-dq-add-slot="${i}">＋市場</button>`
          : "";
        return `<div class="dq-line" data-dq-line="${i}">
        <div class="dq-line-head">
            <label class="dq-sub">小代號
            <input data-dq-f="sub" value="${esc(line.sub || "")}" placeholder="493"${dis} />
            </label>
          <label class="dq-crop">品項
            <input class="dq-find" data-dq-find="${i}" type="search" autocomplete="off" placeholder="搜尋品名或代號" value="${esc(shown)}"${dis} />
          </label>
          ${keyLocked ? "" : `<button type="button" class="ghost dq-del" data-dq-del="${i}">刪</button>`}
        </div>
        <div class="dq-line-meta">
            <label class="dq-spec">規格
              <span class="dq-spec-box">
              <input data-dq-f="spec" inputmode="decimal" placeholder="12" value="${esc(String(line.spec || "").replace(/公斤/g, ""))}"${dis} />
                <em>公斤</em>
              </span>
            </label>
          <label class="dq-country">國別
            <select data-dq-f="country"${dis}>${countryOpts}</select>
          </label>
          </div>
        <div class="dq-markets">
          <span class="dq-markets-lab">市場</span>
          <div class="dq-slots">${slotHtml}${addSlot}</div>
        </div>
        </div>`;
    }).join("");
    const rack = `<nav class="dq-rack" aria-label="拍賣寄貨三層">
      <button type="button" data-dq-pane="key"${pane === "key" ? ' class="on"' : ""}><b>1</b><span>鍵單</span></button>
      <button type="button" data-dq-pane="list"${pane === "list" ? ' class="on"' : ""}><b>2</b><span>入單總資料</span></button>
      <button type="button" data-dq-pane="match"${pane === "match" ? ' class="on"' : ""}><b>3</b><span>拍賣回對</span></button>
    </nav>`;
    const slipRows = []
      .concat(house ? houseSlips(house, houseDay) : [])
      .concat(
        slips
          .map((s, i) => ({ s, i }))
          .filter((x) => !x.s.house && canDropSlip(x.s)),
      );
    const slipTabs = slipRows
      .map(({ s, i }) => {
        const lab = s.house ? slipTabText(s) : "未選社場";
        const drop = canDropSlip(s) ? `<button type="button" class="dq-tab-x" data-dq-drop="${i}">刪除</button>` : "";
        return `<span class="dq-slip-tab"><button type="button" class="dq-tab${i === cur ? " on" : ""}" data-dq-slip="${i}">${esc(lab)}</button>${drop}</span>`;
      })
      .join("");
    const dropCurrent = canDropSlip(slips[cur])
      ? `<button type="button" class="ghost dq-drop" data-dq-drop="${cur}">刪除這張未送出</button>`
      : "";
    const savedSlips = slips.filter((s) => s.saved);
    let body = "";
    if (pane === "list") {
      if (!listDay) listDay = localYmd();
      if (!listMonth) listMonth = listDay.slice(0, 7);
      const all = catalogRows();
      const q = String(listQ || "").trim();
      const shown = orderSlipRows(q ? all.filter((r) => rowHit(r, q)) : all.filter((r) => r.date === listDay));
      const [, mm, dd] = listDay.split("-");
      const title = q ? "搜尋結果" : `${Number(mm)}/${Number(dd)} 入單資料`;
      const dayHouses = q ? [] : housesOnDay(listDay);
      const dayMatchBtn = dayHouses.length
        ? `<button type="button" class="primary dq-day-match" data-dq-day-match>用這天回對</button>`
        : "";
      const table = shown.length
        ? gridTable(shown, { actions: true, showDate: true })
        : `<p class="dq-empty">${q ? "找不到符合的單。" : `${Number(mm)}/${Number(dd)} 沒有拍賣資料。`}</p>`;
      body = `<div class="dq-board">
        ${dqCalHtml()}
        <section class="dq-block">
          <div class="dq-list-bar">
            <div class="dq-list-title">
              <h3>${title}</h3>
              ${dayMatchBtn}
                </div>
            <label class="dq-q">快速搜尋
              <input id="dq-q" type="search" placeholder="單號、日期、社場、品項、市場" value="${esc(listQ)}" />
            </label>
          </div>
          ${(() => {
            const editSlip = listEditId ? slips.find((s) => s.id === listEditId) : null;
            if (listEditId && !editSlip) {
              listEditId = "";
              listEdit = null;
            }
            return editSlip && listEdit ? listFixHtml(editSlip) : "";
          })()}
          ${table}
          <p class="dq-card-msg" id="dq-list-msg">${esc(msg)}</p>
        </section>
      </div>`;
    } else if (pane === "match") {
      if (!matchDay) matchDay = shipDate || localYmd();
      if (!matchHouse) {
        const any = savedSlips.find((s) => s.shipDate === matchDay) || savedSlips[0];
        if (any) matchHouse = any.house || "";
      }
      tryApplySaved();
      const mates = slipsForMatch(matchHouse, matchDay);
      const ours = agg(houseShipList(matchHouse, matchDay));
      const ourRows = [...ours.values()].sort((a, b) => a.mk.localeCompare(b.mk) || String(a.crop).localeCompare(String(b.crop)));
      const ourTotal = ourRows.reduce((n, r) => n + Number(r.qty || 0), 0);
      const houseBtnsMatch = HOUSES.map((h) => {
        const n = slipsForMatch(h.id, matchDay).length;
        return `<button type="button" class="pick${matchHouse === h.id ? " on" : ""}" data-dq-match-house="${esc(h.id)}">${esc(h.lab)}${n ? `<em class="dq-house-n">${n}</em>` : ""}</button>`;
      }).join("");
      const slipNames = mates.map((s) => slipTabText(s)).join("、");
      const pending = slips.filter((s) => !s.saved && s.house === matchHouse && s.shipDate === matchDay && slipHasBody(s));
      const pendingNote = pending.length
        ? `<p class="dq-match-note">還有 ${pending.length} 張還沒送出，這次回對不計入：${esc(pending.map((s) => slipTabText(s)).join("、"))}。請先到鍵單按確認儲存。</p>`
        : "";
      const billHint = matchHouse === "xinfeng"
        ? "新豐自動讀隔天行情，小代號 493、930、168、830 加在一起。"
        : matchHouse === "yongfang"
          ? "金芳用小代號各自登入查隔天行情，050、066、168、070 加在一起。"
          : "大庄、二崙果菜還沒有拍賣帳號，先不自動回對。";
      const ourTable = ourRows.length
        ? `<div class="dq-sheet-wrap"><table class="dq-sheet dq-grid"><thead><tr><th>市場</th><th>品項</th><th>寄出合計</th></tr></thead><tbody>${ourRows
            .map((r) => `<tr><td>${esc(r.mk)}</td><td>${esc([r.sku, r.crop].filter(Boolean).join(" "))}</td><td class="num">${r.qty}</td></tr>`)
            .join("")}</tbody><tfoot><tr><td colspan="2">合計</td><td class="num">${ourTotal}</td></tr></tfoot></table></div>`
        : `<p class="dq-empty">這天還沒有已送出的單。仍可按開始回對，看拍賣有沒有金額。</p>`;
      const shownMatch = [...matchRows].sort((a, b) => {
        if (matchSource === "auction") {
          const ar = REGION_ORDER.indexOf(a.region);
          const br = REGION_ORDER.indexOf(b.region);
          return (ar < 0 ? 9 : ar) - (br < 0 ? 9 : br) || Number(a.ok) - Number(b.ok) || String(a.sku).localeCompare(String(b.sku));
        }
        return Number(a.ok) - Number(b.ok) || a.mk.localeCompare(b.mk) || String(a.crop).localeCompare(String(b.crop));
      });
      const swapOk = matchRows.filter((r) => r.swap && r.ok).length;
      const sameN = matchRows.filter((r) => r.ok).length;
      const diffN = matchRows.filter((r) => r.h && r.p && !r.ok).length;
      const missN = matchRows.filter((r) => r.h && !r.p).length;
      const extraN = matchRows.filter((r) => !r.h && r.p).length;
      const matchBits = [
        swapOk ? `${swapOk} 筆代號對調，件數相同` : "",
        sameN > swapOk ? `${sameN - swapOk} 筆一樣` : "",
        diffN ? `${diffN} 筆件數不同` : "",
        missN ? `${missN} 筆我們有、拍賣沒有` : "",
        extraN ? `${extraN} 筆帳單有、我們沒寄` : "",
      ].filter(Boolean);
      const totals = qtyTotals(matchRows);
      const confirmed = matchSource === "auction" && confirmHit(totals);
      const canConfirm = matchSource === "auction" && (totals.h > 0 || totals.p > 0) && !confirmed;
      const confirmText = totals.h === totals.p
        ? `兩邊總件數都是 ${totals.h}。`
        : `我們 ${totals.h}、拍賣 ${totals.p}，還差 ${Math.abs(totals.p - totals.h)}。`;
      syncNoticePick(shownMatch);
      const gapN = shownMatch.filter((r) => !r.ok && noticePick.has(gapKey(r))).length;
      const visibleMatch = confirmed ? shownMatch.filter((r) => !r.ok) : shownMatch;
      const tucked = shownMatch.length - visibleMatch.length;
      const confirmBtn = confirmed
        ? `<button type="button" class="ghost" data-dq-qty-clear>取消確認</button>`
        : canConfirm
          ? `<button type="button" class="primary" data-dq-qty-ok>總數確認</button>`
          : "";
      const gapBtn = shownMatch.some((r) => !r.ok)
        ? `<button type="button" id="dq-gap-img">${gapN ? `通知拍賣（${gapN}）` : "請先勾選"}</button>`
        : "";
      const pairBtn = pairPick.size === 2 ? `<button type="button" class="dq-pair-ok" data-dq-pair-ok>確認無誤</button>` : "";
      const actRow = confirmBtn || gapBtn || pairBtn ? `<div class="dq-act-row">${confirmBtn}${gapBtn}${pairBtn}</div>` : "";
      const gapPreview = shownMatch.some((r) => !r.ok)
        ? `<div class="dq-gap-preview" id="dq-gap-preview"${gapPreviewUrl ? "" : " hidden"}>${gapPreviewUrl ? `<img src="${esc(gapPreviewUrl)}" alt="件數不符圖片" /><p>${esc(gapNote)}</p>` : ""}</div>`
        : "";
      const matchItems = visibleMatch.map((r) => {
              const cls = r.ok ? "is-ok" : r.h && !r.p ? "is-miss" : "is-bad";
        const st = r.swap
          ? (r.ok ? "代號對調，件數相同" : "代號對調，件數不同")
          : r.ok ? "一樣" : !r.p ? "我們有、拍賣沒有" : !r.h ? "拍賣有、我們沒有" : "件數不同";
        const diff = `${r.d > 0 ? "+" : ""}${r.d}`;
        const detail = r.hMarkets || r.pMarkets
          ? `<div class="dq-submk">我們 ${esc(r.hMarkets || "—")}／拍賣 ${esc(r.pMarkets || "—")}</div>`
          : "";
        const altText = r.swap ? "" : (r.alts || [])
          .map((a) => `${a.sku} ${a.name} ${a.mk} ${a.qty}件${a.price ? `、每公斤 ${a.price}` : ""}`)
          .join("；");
        const altHtml = altText
          ? `<div class="dq-alt">同小代號${(r.subs || []).length ? " " + esc(r.subs.join("、")) : ""}，拍賣用其他品項代號：${esc(altText)}</div>`
          : "";
        const name = r.swap
          ? esc(`${[r.sku, r.crop].filter(Boolean).join(" ")} → ${[r.altSku, r.altCrop].filter(Boolean).join(" ")}`)
          : esc([r.sku, r.crop].filter(Boolean).join(" "));
        const place = esc(r.region || r.mk || "");
        const key = gapKey(r);
        const problem = !r.ok;
        const pick = problem
          ? `<label class="dq-gap-pick"><input type="checkbox" data-dq-gap="${esc(key)}" ${noticePick.has(key) ? "checked" : ""} />通知</label>`
          : "";
        const pairBox = problem
          ? `<label class="dq-pair-pick"><input type="checkbox" data-dq-pair="${esc(key)}" ${pairPick.has(key) ? "checked" : ""} />同一批</label>`
          : "";
        const carry = carryHtml(r);
        return { cls, st: esc(st), diff: esc(diff), detail, altHtml, name, place, h: r.h, p: r.p, pick, pairBox, carry };
      });
      const helpText = matchSource === "auction"
        ? "每一列是同一個區域。同一小代號、品名相同但代號不同，合成一列代號對調。件數相同就是同一批。北部、中區、南部各自看，不會把別區的市場寫進來。"
        : "每一列是同一個市場、同一個品項。差＝社場帳單減我們寄出。正數是社場比較多，負數是社場比較少。";
      const helpPop = matchHelp
        ? `<div class="dq-help-pop" data-dq-help-close><div class="dq-help-card"><p>${esc(helpText)}</p><button type="button" class="primary" data-dq-help-close>關閉</button></div></div>`
        : "";
      const confirmedLine = totals.h === totals.p
        ? `已確認，總件數 ${totals.h} 相同。`
        : `已確認。我們 ${totals.h}、拍賣 ${totals.p}。`;
      const statusLine = confirmed ? confirmedLine : confirmText;
      const matchTable = shownMatch.length
        ? `<section class="dq-match-result">
            <h3>件數回對 <button type="button" class="ghost dq-help" data-dq-help-open>說明</button></h3>
            <p class="dq-bits">${matchBits.map((t) => `<span>${esc(t)}</span>`).join("")}</p>
            <p class="dq-confirmed">${esc(statusLine)}</p>
            ${matchRows.some((r) => unsoldOf(r) > 0) ? `<p class="dq-match-note">沒賣完的每一列填今天移拍：退回，或隔天續賣。續賣會自動開到隔天的寄貨單。</p>` : ""}
            ${actRow}
            ${gapPreview}
            ${tucked ? `<p class="dq-tucked">${tucked} 筆件數相同，已收合。</p>` : ""}
            <div class="dq-match-cards">${matchItems.map((r) => `<article class="${r.cls}${r.pick ? " is-pick" : ""}">
              <div class="dq-card-top"><b>${r.st}</b>${r.pick || ""}${r.pairBox || ""}<span>${r.place}</span></div>
              <div class="dq-card-name">${r.name}</div>
              <div class="dq-card-nums"><div><span>我們</span><b>${r.h}</b></div><div><span>拍賣</span><b>${r.p}</b></div><div><span>差</span><b>${r.diff}</b></div></div>
              ${r.detail}${r.altHtml}${r.carry || ""}
            </article>`).join("")}</div>
            <div class="dq-sheet-wrap"><table class="dq-sheet"><thead><tr><th>結果</th><th>${matchSource === "auction" ? "區域" : "市場"}</th><th>品項</th><th>我們寄出</th><th>拍賣場</th><th>差</th><th>通知</th></tr></thead><tbody>${matchItems
            .map((r) => `<tr class="${r.cls}"><td>${r.st}</td><td>${r.place}</td><td>${r.name}${r.detail}${r.altHtml}${r.carry || ""}</td>
                <td class="num">${r.h}</td><td class="num">${r.p}</td><td class="num">${r.diff}</td><td>${r.pick || ""}${r.pairBox || ""}</td></tr>`)
            .join("")}</tbody></table></div>${helpPop}</section>`
        : "";
      const photoBox = matchPhotoUrl
        ? `<div class="dq-photo-picked">
            <b>已選取照片${matchPhotoName ? "：" + esc(matchPhotoName) : ""}</b>
            <img src="${esc(matchPhotoUrl)}" alt="選取的拍賣明細" />
            <button type="button" class="ghost" id="dq-photo-clear">清除這張照片</button>
          </div>`
        : "";
      const captchaWho = matchCaptchaSub
        ? `<span class="dq-captcha-who">小代號 <b>${esc(matchCaptchaSub)}</b></span>`
        : "";
      const captchaGo = matchCaptcha
        ? `<div class="dq-go">
            <div class="dq-go-row">
              ${captchaWho}
              <div class="dq-captcha"><span>驗證碼</span><img src="${esc(matchCaptcha)}" alt="${esc(matchCaptchaSub ? `小代號 ${matchCaptchaSub} 的驗證碼` : "驗證碼")}" /><input id="dq-captcha" inputmode="numeric" maxlength="6" placeholder="填這裡" /></div>
              <button type="button" class="primary" data-dq-run>開始回對</button>
            </div>
            ${msg ? `<p class="dq-msg">${esc(msg)}</p>` : ""}
          </div>`
        : "";
      body = savedSlips.length
        ? `<div class="dq-match${matchCalOpen ? " is-cal-open" : ""}${matchCaptcha ? " has-captcha" : ""}${matchSource ? " has-result" : ""}">
            <p class="dq-match-note dq-match-lead">選社場和寄送日後按開始回對。系統用這家的帳號讀隔天行情，同一區、同一品項的件數加總再比。安排 493 但以 930 成交，仍算同一家。</p>
            <div class="dq-houses">${houseBtnsMatch}</div>
            <div class="dq-date-pick">
              <div class="dq-date-line">
                <span class="dq-date-now">寄送日 ${esc(matchDay)}</span>
                <button type="button" class="ghost dq-cal-toggle" data-dq-cal-toggle>${matchCalOpen ? "收合月曆" : "改日期"}</button>
                ${matchCaptcha ? "" : `<button type="button" class="primary dq-run-top" data-dq-run>${matchSource ? "重新回對" : "開始回對"}</button>`}
              </div>
              <p class="dq-msg dq-alert" id="dq-msg">${esc(matchCaptcha ? "" : msg)}</p>
              <div class="dq-cal-fold">
                ${dqCalHtml({ selected: matchDay, month: matchMonth || String(matchDay || localYmd()).slice(0, 7), dayAttr: "data-dq-match-cal", shiftAttr: "data-dq-match-shift", houseId: matchHouse })}
              </div>
            </div>
            ${captchaGo}
            ${matchSource && matchFold !== "" ? `<button type="button" class="ghost dq-ship-toggle" data-dq-ship-toggle>${matchFold === "open" ? "收合寄出明細" : "寄出明細"}</button>` : ""}
            ${(!matchSource || matchFold === "" || matchFold === "open") ? `<div class="dq-ship-block">
            <p class="dq-sum">${esc(houseLab(matchHouse) || "請選社場")} · ${mates.length} 張已送出${slipNames ? " · " + esc(slipNames) : ""}</p>
            ${pendingNote}
            ${matchSource ? "" : `<p class="dq-match-note">${billHint}</p>`}
            ${ourTable}
            </div>` : ""}
            ${(!matchSource || matchFold === "" || matchFold === "open") ? `<div class="dq-paste-block">
            ${photoBox}
            <label class="dq-paste">貼上社場整份明細：文字或照片（日期、市場、品名、件數）
              <textarea id="dq-bill" placeholder="貼上這個社場送來的全部數量">${esc(matchBill)}</textarea>
            </label>
            <div class="dq-tools">
              <button type="button" class="ghost" id="dq-bill-pick">選擇照片</button>
              <input id="dq-bill-file" type="file" accept="image/*" hidden />
            </div>
            <div id="dq-read-host">${readTableHtml(readRowsFor({ house: matchHouse, shipDate: matchDay }, matchBill))}</div>
            <div class="dq-tools">
              <button type="button" class="primary" id="dq-run" data-dq-run>開始回對</button>
              <button type="button" class="ghost" id="dq-run-paste">改用貼上的明細</button>
            </div>
            </div>` : ""}
            ${matchTable || priceSummaryHtml() ? `<div class="dq-result-grid">${matchTable}${priceSummaryHtml()}</div>` : ""}
          </div>`
        : `<p class="dq-empty">還沒有已送出的單可以回對。請先在鍵單確認儲存。</p><p class="dq-msg" id="dq-msg">${esc(msg)}</p>`;
    } else {
      const keyHint = keyLocked
        ? "這天已過，鍵單只能看出單。要改品項、件數、小代號或單號，請到入單總資料修正。"
        : "小代號跟品項同一列。同一張單可以有兩個小代號；新增品項會沿用上一列，不同再改。新的一張單要重填。";
      const keyEmpty = keyLive
        ? ""
        : `<p class="dq-empty">這天沒有可以看的單，也不能在鍵單補打。</p>`;
      body = `<div class="dq-split">
        <div class="dq-form${keyLocked ? " is-locked" : ""}">
          <div class="dq-top">
            <p class="dq-top-lab">${house ? esc(houseName()) + (keyLocked ? " · 只能看" : " · 點下面的單，或新增一張") : "請先選社場"}</p>
            <div class="dq-houses">${houseBtns}</div>
            <div class="dq-slips">${slipTabs}${house && !keyLocked ? `<button type="button" class="ghost dq-another" data-dq-another>＋新的一張</button>` : ""}${keyLocked ? "" : dropCurrent}</div>
          </div>
          <div class="dq-key-meta">
            <div class="dq-key-row">
              <span class="dq-date-now">寄送日 ${esc(shipDate)}</span>
              <label class="dq-date">單號
                <input id="dq-seq" placeholder="沒填就自動 5 碼" value="${esc(keyLive ? slipNo(slips[cur]) : "")}" ${house && !keyLocked ? "" : "disabled"} />
              </label>
            </div>
            ${dqCalHtml({ selected: shipDate, month: keyMonth || String(shipDate || localYmd()).slice(0, 7), dayAttr: "data-dq-key-day", shiftAttr: "data-dq-key-shift", houseId: house })}
          </div>
          <div class="dq-fields">
            <p class="dq-mk-lab">${keyHint}</p>
            ${keyEmpty}
          ${lineHtml}
            ${keyLocked || !keyLive ? "" : `<button type="button" class="dq-add-line" id="dq-add">＋新增品項</button>`}
            <label class="dq-note">社場／貨運看（是否收貨）
              <input id="dq-note" placeholder="例如：請貨運來穠全收貨" value="${esc(keyLive ? note : "")}"${dis} />
            </label>
            <label class="dq-note">內部出貨（品項批次）
              <input id="dq-inner" placeholder="例如：#UHA770 新鮮L" value="${esc(keyLive ? inner : "")}"${dis} />
          </label>
          </div>
        </div>
        <aside class="dq-side">
          <p class="dq-side-lab">出單預覽</p>
          <pre class="dq-slip" id="dq-slip"></pre>
          <div class="dq-side-actions">
            <button type="button" class="primary" id="dq-img-ship">出單圖片</button>
            <button type="button" class="primary" id="dq-img-freight">通知貨運</button>
            <button type="button" class="ghost" id="dq-copy">複製文字</button>
            ${keyLocked ? "" : `<button type="button" class="primary dq-confirm" id="dq-confirm">確認儲存，下一張</button>`}
          </div>
          ${house === "yongfang" && keyLive ? `<div class="dq-yf"><p class="dq-yf-lab">金芳草稿</p><button type="button" class="dq-yf-send" id="dq-yf-send">${slips[cur] && slips[cur].yfNo ? `更新金芳第${esc(slips[cur].yfNo)}張` : "送到金芳"}</button><button type="button" class="dq-yf-copy" id="dq-yf-copy">複製金芳通知</button></div>` : ""}
          <p class="dq-msg" id="dq-msg">${esc(msg)}</p>
        </aside>
      </div>`;
    }
    root.innerHTML = `
      <header class="dq-head">
        <button type="button" class="ghost dq-home" data-dq-home>← 總覽</button>
      ${rack}
      </header>
      ${body}
    `;
    if (pane === "key") paintSlip();
    if (pane === "match") syncPricePreview();
    const cap = document.getElementById("dq-captcha");
    if (pane === "match" && cap) cap.focus();
    persistLocal();
    pullHistory();
    pullMatches();
    backfillCarryMarks();
  }
  function sessionToSlip(rec) {
    return {
      id: String(rec.id),
      house: rec.house || "",
      shipDate: rec.shipDate || "",
      lines: normalizeLines(Array.isArray(rec.lines) && rec.lines.length ? rec.lines : [freshLine()]),
      billText: rec.billText || "",
      note: rec.note || "",
      inner: rec.inner || "",
      code: rec.code || "",
      rows: Array.isArray(rec.rows) ? rec.rows : [],
      title: rec.title || "",
      seq: rec.seq || "",
      saved: rec.saved !== false,
      at: Number(rec.at) || 0,
      voided: !!rec.voided,
      log: Array.isArray(rec.log) ? rec.log : [],
      yfId: rec.yfId || "",
      yfNo: rec.yfNo || "",
    };
  }
  let pulling = false;
  const droppedIds = new Set();
  function mergeRemote(sessions) {
    let changed = false;
    const root = document.getElementById("dq-root");
    const typing = document.activeElement && root && root.contains(document.activeElement);
    for (const rec of sessions) {
      if (!rec || !rec.id || droppedIds.has(rec.id)) continue;
      const remote = sessionToSlip(rec);
      if (!remote.saved && !slipHasBody(remote)) continue;
      const i = slips.findIndex((s) => s.id === remote.id);
      if (i < 0) {
        slips.push(remote);
        changed = true;
        continue;
      }
      const local = slips[i];
      if (typing && slips[cur] === local) continue;
      if ((Number(rec.at) || 0) <= (Number(local.at) || 0)) continue;
      const wasCur = slips[cur] === local;
      slips[i] = remote;
      if (wasCur) applySlip(i);
      changed = true;
    }
    if (!slips.some((s) => !s.saved)) {
      slips.push(freshSlip());
      changed = true;
    }
    return changed;
  }
  function pullHistory() {
    if (pulling) return;
    pulling = true;
    fetch("./api/daily-qty/history", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const sessions = Array.isArray(j?.sessions) ? j.sessions : [];
        const ids = new Set(sessions.map((s) => s && s.id).filter(Boolean));
        droppedIds.forEach((id) => {
          if (!ids.has(id)) droppedIds.delete(id);
        });
        if (mergeRemote(sessions)) renderDailyQty();
      })
      .catch(() => {})
      .finally(() => {
        pulling = false;
      });
  }

  window.renderDailyQty = renderDailyQty;
})();
