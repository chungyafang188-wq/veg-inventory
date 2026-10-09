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
  function freshLine() {
    return { crop: "", spec: "", sku: "", sub: "", slots: blankSlots(SLOT_N) };
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
      saved: false,
    };
  }
  let slips = [freshSlip()];
  let cur = 0;
  let listDay = "";
  let listMonth = "";
  let listQ = "";
  let lines = slips[0].lines;
  let billText = "";
  let note = "";
  let inner = "";
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
  function itemLabel(line) {
    const spec = specText(line);
    const sub = String(line.sub || "").trim();
    const sku = String(line.sku || "").trim();
    const name = sku
      ? [sku, line.kind, line.crop].filter(Boolean).join(" ")
      : String(line.crop || "").trim();
    return [name, sub, spec].filter(Boolean).join(" ") || "寄送";
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
      msg = "";
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
    s.house = house;
    s.shipDate = shipDate || localYmd();
    s.lines = lines;
    s.billText = billText;
    s.note = note;
    s.inner = inner;
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
    lines = s.lines && s.lines.length ? s.lines : [freshLine()];
    s.lines = lines;
    billText = s.billText || "";
    note = s.note || "";
    inner = s.inner || "";
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
        lines: Array.isArray(s.lines) && s.lines.length ? s.lines : [freshLine()],
        billText: s.billText || "",
        note: s.note || "",
        inner: s.inner || "",
        rows: Array.isArray(s.rows) ? s.rows : [],
        title: s.title || "",
        saved: !!s.saved,
        seq: s.seq || "",
        at: Number(s.at) || 0,
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
      blocks.push({ label: itemLabel(line), markets, sub });
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
          });
          first = false;
        }
      }
    }
    return rows;
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
          if (withAct) {
            act = `<td class="dq-act" rowspan="${span[r.id]}"><button type="button" class="ghost" data-dq-copy-text="${esc(r.id)}">複製文字</button><button type="button" class="ghost" data-dq-copy-ship="${esc(r.id)}">出單</button><button type="button" class="ghost" data-dq-copy-freight="${esc(r.id)}">通知貨運</button><button type="button" class="ghost" data-dq-open="${r.slipIndex}">修改</button><button type="button" class="primary" data-dq-match="${esc(r.id)}">回對</button></td>`;
          }
        }
        return `<tr>${showDate ? `<td>${esc(r.date)}</td>` : ""}${seqCell}<td>${esc(r.house)}</td><td>${esc(r.item)}</td><td>${esc(r.mk)}</td><td class="num">${r.qty}</td>${act}</tr>`;
      })
      .join("");
    const total = rows.reduce((n, r) => n + Number(r.qty || 0), 0);
    const lead = showDate ? 5 : 4;
    return `<div class="dq-sheet-wrap"><table class="dq-sheet dq-grid"><thead><tr>${head}</tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="${lead}">合計</td><td class="num">${total}</td>${withAct ? "<td></td>" : ""}</tr></tfoot></table></div>`;
  }
  function dqCalHtml() {
    const iso = listDay || localYmd();
    const month = listMonth || iso.slice(0, 7);
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const lead = (first.getDay() + 6) % 7;
    const count = new Date(y, m, 0).getDate();
    const today = localYmd();
    const marked = new Set(slips.filter((s) => s.saved && s.shipDate).map((s) => s.shipDate));
    const week = ["一", "二", "三", "四", "五", "六", "日"].map((name) => `<span>${name}</span>`).join("");
    let days = "";
    for (let i = 0; i < lead; i += 1) days += "<span></span>";
    for (let d = 1; d <= count; d += 1) {
      const cell = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const cls = ["dq-day", marked.has(cell) ? "is-data" : "", cell === today ? "is-today" : "", cell === iso ? "is-sel" : ""]
        .filter(Boolean)
        .join(" ");
      days += `<button type="button" class="${cls}" data-dq-day="${cell}">${d}</button>`;
    }
    return `<div class="dq-calbox">
      <div class="dq-cal-nav">
        <button type="button" class="ghost" data-dq-shift="-1">上一月</button>
        <b>${y}年${m}月</b>
        <button type="button" class="ghost" data-dq-shift="1">下一月</button>
      </div>
      <div class="dq-cal">${week}${days}</div>
      <p class="dq-cal-note">綠底是有拍賣資料。點日期看當天。</p>
    </div>`;
  }
  function slipBlockHtml(blocks) {
    if (!blocks.length) return "<li>沒有件數</li>";
    return blocks
      .map((b) => {
        const markets = b.markets.map((m) => `<span>${esc(m.mk)} ${m.qty}件</span>`).join("");
        return `<li><b>${esc(b.label)}</b><span class="dq-mkts">${markets}</span><em>合計 ${b.sub}件</em></li>`;
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
      drawn.push({ t: b.label, strong: true });
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
        ctx.font = `${line.strong ? 700 : 600} ${bodySize}px ${font}`;
        ctx.fillStyle = "#14633a";
        ctx.fillText(line.t, padX, y);
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
      rows: s.rows || [],
      seq: slipNo(s),
      seqSet: !!(opts && opts.seqSet),
      saved: !!s.saved,
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
    const s = matchSlip();
    if (!s) {
      msg = "請先選定要回對的單。";
      renderDailyQty();
      return;
    }
    const raw = String(text || "").trim();
    if (!raw) {
      msg = "沒有貼到明細。";
      renderDailyQty();
      return;
    }
    const rows = readRowsFor(s, raw);
    if (!stageReadRows(s, rows)) {
      s.billText = raw;
      s.rows = [];
      rememberSlip(s);
      msg = "沒有讀出件數。請確認有日期、市場、品名、件數，文字框還可以改。";
    }
    renderDailyQty();
  }
  async function ingestBillImage(file) {
    if (!file) return;
    const slip = matchSlip();
    if (!slip) {
      msg = "請先選定要回對的單。";
      renderDailyQty();
      return;
    }
    ocrStatus = setBillMsg;
    setBillMsg("正在讀圖片上的品名和件數。辨識在這台電腦進行，不會把照片送出去。");
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
      if (!noted) {
        if (text) slip.billText = text;
        slip.rows = [];
        rememberSlip(slip);
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
      if (page && page.hidden) return;
      if (document.activeElement && root.contains(document.activeElement)) return;
      pullHistory();
    }, 12000);
    const root = document.getElementById("dq-root");
    if (!root) return;
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
      if (e.target.closest("[data-dq-shift]")) {
        const dir = Number(e.target.closest("[data-dq-shift]").dataset.dqShift) || 0;
        listMonth = shiftMonth(listMonth || (listDay || localYmd()).slice(0, 7), dir);
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-pane]")) {
        syncCurrent();
        pane = e.target.closest("[data-dq-pane]").dataset.dqPane || "key";
        if (pane === "match" && !matchId) {
          const saved = slips.find((s) => s.saved);
          matchId = saved ? saved.id : "";
        }
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
        msg = houseName() ? `正在修改${houseName()}。改完再按確認儲存。` : "";
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
      if (e.target.closest("[data-dq-open]")) {
        syncCurrent();
        applySlip(Number(e.target.closest("[data-dq-open]").dataset.dqOpen));
        pane = "key";
        msg = houseName() ? `正在修改${houseName()}。改完再按確認儲存。` : "";
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-match]")) {
        syncCurrent();
        matchId = e.target.closest("[data-dq-match]").dataset.dqMatch || "";
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
        lines.push(freshLine());
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-add-slot]")) {
        const lineEl = e.target.closest("[data-dq-line]");
        const line = lines[Number(lineEl?.dataset.dqLine)];
        if (line && line.slots.length < MK_KEYS.length) line.slots.push({ mk: "", qty: "" });
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-del-slot]")) {
        const lineEl = e.target.closest("[data-dq-line]");
        const row = e.target.closest("[data-dq-slot]");
        const line = lines[Number(lineEl?.dataset.dqLine)];
        const si = Number(row?.dataset.dqSlot);
        if (line && line.slots.length > SLOT_N && si >= 0) line.slots.splice(si, 1);
        renderDailyQty();
        return;
      }
      if (e.target.closest("[data-dq-del]")) {
        const i = Number(e.target.closest("[data-dq-del]").dataset.dqDel);
        lines.splice(i, 1);
        if (!lines.length) lines.push(freshLine());
        renderDailyQty();
        return;
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
      if (e.target.closest("#dq-bill-pick")) {
        document.getElementById("dq-bill-file")?.click();
        return;
      }
      if (e.target.closest("#dq-run")) {
        const s = slips.find((x) => x.id === matchId) || slips.find((x) => x.saved);
        if (!s) {
          msg = "還沒有已儲存的單，請先在鍵單確認儲存。";
          renderDailyQty();
          return;
        }
        s.billText = document.getElementById("dq-bill")?.value || s.billText || "";
        if (!String(s.billText).trim()) {
          msg = "請貼上拍賣回來的件數金額單。";
          renderDailyQty();
          return;
        }
        if (!slipBits(s).total) {
          msg = "這張單還沒有件數。";
          renderDailyQty();
          return;
        }
        s.rows = compareSlip(s);
        const miss = s.rows.filter((r) => !r.ok).length;
        msg = miss ? `回對完成，有 ${miss} 筆不一致。` : "回對完成，件數一致。";
        saveSlip(s);
        renderDailyQty();
        return;
      }
    });
    function readField(e) {
      const t = e.target;
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
      if (t.id === "dq-bill") {
        const s = pane === "match" ? slips.find((x) => x.id === matchId) : null;
        if (s) {
          s.billText = t.value;
          if (!syncingRead) {
            const host = document.getElementById("dq-read-host");
            if (host) host.innerHTML = readTableHtml(readRowsFor(s, t.value));
          }
        } else billText = t.value;
        if (s) queueSlipSync(s);
        else persistLocal(true);
        return;
      }
      if (t.id === "dq-bill-file") {
        const file = t.files && t.files[0];
        t.value = "";
        if (file) ingestBillImage(file);
        return;
      }
      if (t.id === "dq-match-pick") {
        matchId = t.value;
        renderDailyQty();
        return;
      }
      if (t.id === "dq-note") {
        note = t.value;
        paintSlip();
        persistLocal(true);
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
        shipDate = t.value || localYmd();
        if (/^\d{4}-\d{2}-\d{2}$/.test(shipDate)) renderDailyQty();
        else {
          paintSlip();
          persistLocal(true);
        }
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

  function paintSlip() {
    const box = document.getElementById("dq-slip");
    if (!box) return;
    const empty = !shipList().length;
    box.textContent = empty ? "左邊填市場件數後，這裡會顯示要貼到 LINE 的單據。" : noticeText();
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
    }
    if (!shipDate) shipDate = localYmd();
    syncCurrent();
    const houseDay = shipDate || localYmd();
    const houseBtns = HOUSES.map((h) => {
      const n = houseSlips(h.id, houseDay).length;
      const badge = n ? `<em class="dq-house-n">${n}</em>` : "";
      return `<button type="button" class="pick${house === h.id ? " on" : ""}" data-dq-house="${esc(h.id)}">${esc(h.lab)}${badge}</button>`;
    }).join("");
    const lineHtml = lines
      .map((line, i) => {
        const used = new Set((line.slots || []).map((s) => s.mk).filter(Boolean));
        const slotHtml = (line.slots || []).map((slot, si) => {
          const opts = [`<option value="">選市場</option>`]
            .concat(
              MK_KEYS.map((mk) => {
                const dis = mk !== slot.mk && used.has(mk) ? " disabled" : "";
                const on = mk === slot.mk ? " selected" : "";
                return `<option value="${esc(mk)}"${on}${dis}>${esc(mk)}</option>`;
              }),
            )
            .join("");
          const extra = (line.slots || []).length > SLOT_N
            ? `<button type="button" class="ghost" data-dq-del-slot="${si}">刪</button>`
            : "";
          return `<div class="dq-slot${slot.mk && qtyOf(slot.qty) ? " is-on" : ""}" data-dq-slot="${si}">
            <select data-dq-slot-mk>${opts}</select>
            <input data-dq-slot-qty inputmode="numeric" placeholder="件數" value="${esc(slot.qty)}" />
            <span class="dq-slot-unit">件</span>
            ${extra}
          </div>`;
        }).join("");
        const addSlot = (line.slots || []).length < MK_KEYS.length
          ? `<button type="button" class="ghost dq-add-slot" data-dq-add-slot="${i}">＋加一個市場</button>`
          : "";
        return `<div class="dq-line" data-dq-line="${i}">
          <div class="dq-line-top">
            <label class="dq-crop">品項
              <input class="dq-find" data-dq-find="${i}" type="search" autocomplete="off" placeholder="搜尋品名或代號" value="${esc(findLine === i ? findQ : line.sku ? `${line.sku} ${[line.kind, line.crop].filter(Boolean).join(" ")}` : line.crop || "")}" />
            </label>
            <label class="dq-sub">小代號
              <input data-dq-f="sub" value="${esc(line.sub || "")}" placeholder="050" />
            </label>
            <label class="dq-spec">規格
              <span class="dq-spec-box">
                <input data-dq-f="spec" inputmode="decimal" placeholder="20" value="${esc(String(line.spec || "").replace(/公斤/g, ""))}" />
                <em>公斤</em>
              </span>
            </label>
            <button type="button" class="ghost" data-dq-del="${i}">刪</button>
          </div>
          <div class="dq-slots">${slotHtml}</div>
          ${addSlot}
        </div>`;
      })
      .join("");
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
      const shown = q ? all.filter((r) => rowHit(r, q)) : all.filter((r) => r.date === listDay);
      const [, mm, dd] = listDay.split("-");
      const title = q ? "搜尋結果" : `${Number(mm)}/${Number(dd)} 入單資料`;
      const table = shown.length
        ? gridTable(shown, { actions: true, showDate: true })
        : `<p class="dq-empty">${q ? "找不到符合的單。" : `${Number(mm)}/${Number(dd)} 沒有拍賣資料。`}</p>`;
      body = `<div class="dq-board">
        ${dqCalHtml()}
        <section class="dq-block">
          <div class="dq-list-bar">
            <h3>${title}</h3>
            <label class="dq-q">快速搜尋
              <input id="dq-q" type="search" placeholder="單號、日期、社場、品項、市場" value="${esc(listQ)}" />
            </label>
          </div>
          ${table}
          <p class="dq-card-msg" id="dq-list-msg"></p>
        </section>
      </div>`;
    } else if (pane === "match") {
      const picked = savedSlips.find((s) => s.id === matchId) || savedSlips[0];
      if (picked && picked.id !== matchId) matchId = picked.id;
      const opts = savedSlips
        .map((s) => `<option value="${esc(s.id)}"${s.id === matchId ? " selected" : ""}>${esc(houseLab(s.house))} ${esc(s.shipDate)}</option>`)
        .join("");
      const sum = picked ? slipBits(picked) : { parts: [], total: 0 };
      const showRows = picked && picked.rows && picked.rows.length ? picked.rows : [];
      const matchTable = showRows.length
        ? `<div class="dq-sheet-wrap"><table class="dq-sheet">
          <thead><tr><th>狀態</th><th>市場</th><th>品項</th><th>寄送件</th><th>帳單件</th><th>差</th></tr></thead>
          <tbody>${showRows
            .map((r) => {
              const cls = r.ok ? "is-ok" : r.h && !r.p ? "is-miss" : "is-bad";
              const st = r.ok ? "一致" : !r.p ? "帳單沒回來" : !r.h ? "帳單多出" : "件數不同";
              return `<tr class="${cls}"><td>${esc(st)}</td><td>${esc(r.mk)}</td><td>${esc(r.crop)}</td>
                <td class="num">${r.h}</td><td class="num">${r.p}</td><td class="num">${r.d > 0 ? "+" : ""}${r.d}</td></tr>`;
            })
            .join("")}</tbody></table></div>`
        : "";
      body = picked
        ? `<div class="dq-match">
            <label class="dq-match-pick">要回對的單
              <select id="dq-match-pick">${opts}</select>
            </label>
            <p class="dq-sum">${esc(houseLab(picked.house))}</p>
            <ul class="dq-sum-list">${slipBlockHtml(sum.blocks)}</ul>
            <label class="dq-paste">貼上明細：文字或照片都可以（日期、市場、品名、件數）
              <textarea id="dq-bill" placeholder="直接貼文字，或在這裡貼上拍賣單照片">${esc(picked.billText || "")}</textarea>
            </label>
            <div class="dq-tools">
              <button type="button" class="ghost" id="dq-bill-pick">選擇照片</button>
              <input id="dq-bill-file" type="file" accept="image/*" hidden />
            </div>
            <div id="dq-read-host">${picked ? readTableHtml(readRowsFor(picked, picked.billText || "")) : ""}</div>
            <div class="dq-tools">
              <button type="button" class="primary" id="dq-run">開始回對</button>
            </div>
            <p class="dq-msg" id="dq-msg">${esc(msg)}</p>
            ${matchTable}
          </div>`
        : `<p class="dq-empty">還沒有已儲存的單可以回對。請先在鍵單確認儲存。</p><p class="dq-msg" id="dq-msg">${esc(msg)}</p>`;
    } else {
      body = `<div class="dq-split">
        <div class="dq-form">
          <div class="dq-top">
            <p class="dq-top-lab">${house ? esc(houseName()) + " · 點下面的單，或新增一張" : "請先選社場"}</p>
            <div class="dq-houses">${houseBtns}</div>
            <div class="dq-slips">${slipTabs}${house ? `<button type="button" class="ghost dq-another" data-dq-another>＋新增</button>` : ""}${dropCurrent}</div>
            <div class="dq-key-meta">
              <label class="dq-date">寄送日 <input id="dq-date" type="date" value="${esc(shipDate)}" /></label>
              <label class="dq-date">單號
                <input id="dq-seq" placeholder="沒填就自動 5 碼" value="${esc(slipNo(slips[cur]))}" ${house ? "" : "disabled"} />
              </label>
            </div>
          </div>
          ${lineHtml}
          <button type="button" class="dq-add-line" id="dq-add">＋新增品項</button>
          <label class="dq-note">社場／貨運看（是否收貨）
            <input id="dq-note" placeholder="例如：請貨運來穠全收貨" value="${esc(note)}" />
          </label>
          <label class="dq-note">內部出貨（品項批次）
            <input id="dq-inner" placeholder="例如：#UHA770 新鮮L" value="${esc(inner)}" />
          </label>
        </div>
        <aside class="dq-side">
          <p class="dq-side-lab">出單預覽</p>
          <pre class="dq-slip" id="dq-slip"></pre>
          <button type="button" class="primary" id="dq-img-ship">出單圖片</button>
          <button type="button" class="primary" id="dq-img-freight">通知貨運</button>
          <button type="button" class="ghost" id="dq-copy">複製文字</button>
          <button type="button" class="primary dq-confirm" id="dq-confirm">確認儲存，下一張</button>
          <p class="dq-msg" id="dq-msg">${esc(msg)}</p>
        </aside>
      </div>`;
    }
    root.innerHTML = `
      <header class="dq-head">
        <button type="button" class="ghost dq-home" data-dq-home>← 總覽</button>
        <h2>拍賣寄貨</h2>
      </header>
      ${rack}
      ${body}
    `;
    if (pane === "key") paintSlip();
    persistLocal();
    pullHistory();
  }
  function sessionToSlip(rec) {
    return {
      id: String(rec.id),
      house: rec.house || "",
      shipDate: rec.shipDate || "",
      lines: Array.isArray(rec.lines) && rec.lines.length ? rec.lines : [freshLine()],
      billText: rec.billText || "",
      note: rec.note || "",
      inner: rec.inner || "",
      rows: Array.isArray(rec.rows) ? rec.rows : [],
      title: rec.title || "",
      seq: rec.seq || "",
      saved: rec.saved !== false,
      at: Number(rec.at) || 0,
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
