/** 現金日報：現場登錄一筆只記一家，記入後分帳並合計。Loads after app.js */
(function () {
  const CASH_KINDS = [
    { id: "sale", lab: "客戶現金" },
    { id: "fee", lab: "費用" },
    { id: "move", lab: "內部調撥" },
  ];
  const TICKET_KINDS = [
    { id: "ticket", lab: "收票據" },
    { id: "note", lab: "票兌現" },
  ];
  const KINDS = CASH_KINDS.concat(TICKET_KINDS);
  const KIND_LAB = Object.fromEntries(KINDS.map((k) => [k.id, k.lab]));
  function isSlipKind(kind) {
    return kind === "sale" || kind === "fee" || kind === "move";
  }
  function isCashKind(kind) {
    return isSlipKind(kind) || kind === "note";
  }
  function isTicketKind(kind) {
    return kind === "ticket" || kind === "note";
  }

  let cdDate = "";
  let coPick = "nq";
  let dirPick = "in";
  let kindPick = "sale";
  let slipQ = "";
  let slipSort = "at";
  let afterAdd = false;
  let bound = false;

  function ensureStore() {
    if (!state.cashDays || typeof state.cashDays !== "object" || Array.isArray(state.cashDays)) state.cashDays = {};
  }
  function bookOf(date) {
    ensureStore();
    if (!state.cashDays[date]) state.cashDays[date] = { lines: [], removed: [] };
    const b = state.cashDays[date];
    if (!Array.isArray(b.lines)) b.lines = [];
    if (!Array.isArray(b.removed)) b.removed = [];
    return b;
  }
  function money(n) {
    const v = Math.round((Number(n) || 0) * 100) / 100;
    return v.toLocaleString("zh-Hant-TW", { maximumFractionDigits: 2 });
  }
  function readAmt(raw) {
    const t = String(raw ?? "").replace(/,/g, "").trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100) / 100;
  }
  function roc(iso) {
    const [y, m, d] = String(iso || "").split("-");
    if (!y || !m || !d) return iso || "";
    return `${Number(y) - 1911}/${m}/${d}`;
  }
  function dayLocked(date) {
    const b = state.cashDays?.[date || cdDate];
    return (Number(b?.lockedAt) || 0) > (Number(b?.unlockedAt) || 0);
  }
  function canUnlockDay() {
    return typeof can === "function" && can("cash-day-unlock");
  }
  function whoNow() {
    return typeof currentStaff === "function" ? String(currentStaff() || "").trim() : "";
  }
  function whenTxt(at) {
    const n = Number(at) || 0;
    if (!n) return "";
    const d = new Date(n);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return `${roc(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  function sideBox() {
    return { nq: { in: 0, out: 0 }, ha: { in: 0, out: 0 } };
  }
  function addSide(box, co, dir, amt) {
    if (!box[co]) return;
    box[co][dir] += amt;
  }
  function netOf(box, co) {
    return (box[co]?.in || 0) - (box[co]?.out || 0);
  }
  function tally(lines) {
    const all = sideBox();
    const ext = sideBox();
    const slip = sideBox();
    const byKind = {};
    for (const k of KINDS) byKind[k.id] = sideBox();
    for (const line of lines || []) {
      const amt = Number(line.amt) || 0;
      const co = line.co === "ha" ? "ha" : "nq";
      const dir = line.dir === "out" ? "out" : "in";
      const kind = KIND_LAB[line.kind] ? line.kind : "sale";
      addSide(byKind[kind] || (byKind[kind] = sideBox()), co, dir, amt);
      if (isCashKind(kind)) addSide(all, co, dir, amt);
      if (isSlipKind(kind)) addSide(slip, co, dir, amt);
      if (isSlipKind(kind) && kind !== "move") addSide(ext, co, dir, amt);
    }
    return { all, ext, slip, byKind };
  }
  function explicitOpen(book, side) {
    const at = Number(book?.[side === "ha" ? "openHaAt" : "openNqAt"]) || 0;
    if (!at) return null;
    const raw = book[side === "ha" ? "openHa" : "openNq"];
    if (raw == null || raw === "") return null;
    return Number(raw) || 0;
  }
  /** 當日昨日現金：有改過用當天數字，否則沿用前一天結餘 */
  function opening(date) {
    ensureStore();
    const keys = Object.keys(state.cashDays)
      .filter((k) => k <= date)
      .sort();
    let nq = 0;
    let ha = 0;
    let from = "";
    let setNq = false;
    let setHa = false;
    for (const k of keys) {
      const b = state.cashDays[k] || {};
      const nqSet = explicitOpen(b, "nq");
      const haSet = explicitOpen(b, "ha");
      if (nqSet != null) {
        nq = nqSet;
        setNq = k === date;
      }
      if (haSet != null) {
        ha = haSet;
        setHa = k === date;
      }
      if (k === date) break;
      const lines = b.lines || [];
      if (!lines.length && nqSet == null && haSet == null) continue;
      const t = tally(lines);
      nq += netOf(t.all, "nq");
      ha += netOf(t.all, "ha");
      from = k;
    }
    return { nq, ha, from, setNq, setHa };
  }
  function figures(date) {
    const book = state.cashDays?.[date] || { lines: [] };
    const t = tally(book.lines);
    const open = opening(date);
    const row = (box, co) => ({
      in: box[co].in,
      out: box[co].out,
      net: netOf(box, co),
    });
    const sum = (box) => ({
      in: box.nq.in + box.ha.in,
      out: box.nq.out + box.ha.out,
      net: netOf(box, "nq") + netOf(box, "ha"),
    });
    const close = {
      nq: open.nq + netOf(t.all, "nq"),
      ha: open.ha + netOf(t.all, "ha"),
    };
    close.all = close.nq + close.ha;
    const move = t.byKind.move;
    const moveGap = netOf(move, "nq") + netOf(move, "ha");
    return { t, open, close, sumAll: sum(t.slip), sumExt: sum(t.ext), sumCash: sum(t.all), moveGap, lines: book.lines || [] };
  }

  function pickStamp(v1, t1, v2, t2) {
    const T1 = Number(t1) || 0;
    const T2 = Number(t2) || 0;
    const num = (v, t) => ({ val: v == null || v === "" ? null : Number(v) || 0, at: t });
    if (!T1 && !T2) return num(v2 != null && v2 !== "" ? v2 : v1, 0);
    if (T2 >= T1) return num(v2, T2);
    return num(v1, T1);
  }
  function mergeCashDays(a, b) {
    const A = a && typeof a === "object" && !Array.isArray(a) ? a : {};
    const B = b && typeof b === "object" && !Array.isArray(b) ? b : {};
    const out = {};
    for (const day of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const x = A[day] || {};
      const y = B[day] || {};
      const removed = new Set([...(x.removed || []), ...(y.removed || [])]);
      const map = new Map();
      for (const line of [...(x.lines || []), ...(y.lines || [])]) {
        if (!line?.id || removed.has(line.id)) continue;
        const prev = map.get(line.id);
        if (!prev || (Number(line.at) || 0) >= (Number(prev.at) || 0)) map.set(line.id, line);
      }
      const lockAt = Math.max(Number(x.lockedAt) || 0, Number(y.lockedAt) || 0);
      const unlockAt = Math.max(Number(x.unlockedAt) || 0, Number(y.unlockedAt) || 0);
      const locked = lockAt > unlockAt;
      const lockSrc = (Number(y.lockedAt) || 0) >= (Number(x.lockedAt) || 0) ? y : x;
      const unlockSrc = (Number(y.unlockedAt) || 0) >= (Number(x.unlockedAt) || 0) ? y : x;
      let lines = [...map.values()].sort((p, q) => (Number(p.at) || 0) - (Number(q.at) || 0));
      if (locked) lines = lines.filter((l) => (Number(l.at) || 0) <= lockAt);
      const openNq = locked
        ? { val: lockSrc.openNq == null || lockSrc.openNq === "" ? null : Number(lockSrc.openNq) || 0, at: Number(lockSrc.openNqAt) || 0 }
        : pickStamp(x.openNq, x.openNqAt, y.openNq, y.openNqAt);
      const openHa = locked
        ? { val: lockSrc.openHa == null || lockSrc.openHa === "" ? null : Number(lockSrc.openHa) || 0, at: Number(lockSrc.openHaAt) || 0 }
        : pickStamp(x.openHa, x.openHaAt, y.openHa, y.openHaAt);
      out[day] = {
        openNq: openNq.val,
        openHa: openHa.val,
        openNqAt: openNq.at,
        openHaAt: openHa.at,
        locked,
        lockedAt: lockAt,
        lockedBy: lockSrc.lockedBy || "",
        unlockedAt: unlockAt,
        unlockedBy: unlockSrc.unlockedBy || "",
        removed: [...removed].slice(-400),
        lines,
      };
    }
    return out;
  }
  window.mergeCashDays = mergeCashDays;

  function cell(n) {
    const cls = n < 0 ? " cd-neg" : "";
    return `<td class="${cls.trim()}">${money(n)}</td>`;
  }
  function kindNet(box) {
    return netOf(box, "nq") + netOf(box, "ha");
  }
  const HINT_KEY = "nongquan-cd-hints-v1";
  const EXTRA_ZY = {
    群: "ㄑㄩㄣ", 智: "ㄓ", 紀: "ㄐㄧ", 惠: "ㄏㄨㄟ", 宗: "ㄗㄨㄥ", 文: "ㄨㄣ",
    便: "ㄅㄧㄢ", 當: "ㄉㄤ", 影: "ㄧㄥ", 印: "ㄧㄣ", 機: "ㄐㄧ", 維: "ㄨㄟ",
    修: "ㄒㄧㄡ", 宜: "ㄧ", 穠: "ㄋㄨㄥ", 全: "ㄑㄩㄢ", 鴻: "ㄏㄨㄥ", 安: "ㄢ",
    客: "ㄎㄜ", 戶: "ㄏㄨ", 現: "ㄒㄧㄢ", 金: "ㄐㄧㄣ", 費: "ㄈㄟ", 用: "ㄩㄥ",
    調: "ㄉㄧㄠ", 撥: "ㄅㄛ", 油: "ㄧㄡ", 資: "ㄗ", 春: "ㄔㄨㄣ", 田: "ㄊㄧㄢ",
    富: "ㄈㄨ", 邦: "ㄅㄤ", 彰: "ㄓㄤ", 銀: "ㄧㄣ", 西: "ㄒㄧ", 螺: "ㄌㄨㄛ",
    尾: "ㄨㄟ", 折: "ㄓㄜ", 收: "ㄕㄡ", 支: "ㄓ", 出: "ㄔㄨ", 入: "ㄖㄨ",
    內: "ㄋㄟ", 部: "ㄅㄨ", 票: "ㄆㄧㄠ", 據: "ㄐㄩ", 兌: "ㄉㄨㄟ", 現: "ㄒㄧㄢ",
    芳: "ㄈㄤ", 雅: "ㄧㄚ", 凱: "ㄎㄞ", 婷: "ㄊㄧㄥ", 子: "ㄗ", 羽: "ㄩ",
    湯: "ㄊㄤ", 家: "ㄐㄧㄚ", 鑫: "ㄒㄧㄣ", 胖: "ㄆㄤ", 善: "ㄕㄢ", 存: "ㄘㄨㄣ",
    宏: "ㄏㄨㄥ", 靜: "ㄐㄧㄥ", 宜: "ㄧ", 威: "ㄨㄟ", 誠: "ㄔㄥ",
    高: "ㄍㄠ", 麗: "ㄌㄧ", 菜: "ㄘㄞ", 洋: "ㄧㄤ", 蔥: "ㄘㄨㄥ", 九: "ㄐㄧㄡ",
    層: "ㄘㄥ", 塔: "ㄊㄚ", 香: "ㄒㄧㄤ", 菜: "ㄘㄞ", 戶: "ㄏㄨ",
  };
  function charZy(ch) {
    const key = typeof SIMP_TO_TRAD !== "undefined" && SIMP_TO_TRAD[ch] ? SIMP_TO_TRAD[ch] : ch;
    if (EXTRA_ZY[key] || EXTRA_ZY[ch]) return EXTRA_ZY[key] || EXTRA_ZY[ch];
    if (typeof CUST_ZY !== "undefined") return CUST_ZY[key] || CUST_ZY[ch] || "";
    return "";
  }
  function textZyKeys(s) {
    const strip = typeof stripZhuyin === "function" ? stripZhuyin : (t) => String(t || "");
    return [...String(s || "")]
      .map((ch) => strip(charZy(ch)).charAt(0))
      .filter(Boolean)
      .join("");
  }
  function fieldMatches(text, q) {
    const t = String(text || "");
    if (!t || !q) return !q;
    if (t.toLowerCase().includes(String(q).toLowerCase())) return true;
    const zy = typeof stripZhuyin === "function" ? stripZhuyin(q) : String(q).replace(/\s+/g, "");
    if (typeof isZhuyinQuery === "function" && isZhuyinQuery(zy)) {
      const keys = textZyKeys(t);
      return keys.startsWith(zy) || keys.includes(zy);
    }
    return false;
  }
  function loadHints() {
    let stored = [];
    try {
      stored = JSON.parse(localStorage.getItem(HINT_KEY) || "[]");
    } catch (_) {
      stored = [];
    }
    if (!Array.isArray(stored)) stored = [];
    const seen = new Set();
    const out = [];
    const add = (s) => {
      const n = String(s || "").trim();
      if (!n || n.length > 40 || seen.has(n)) return;
      seen.add(n);
      out.push(n);
    };
    for (const s of stored) add(s);
    for (const day of Object.values(state.cashDays || {})) {
      for (const line of day?.lines || []) add(line.memo);
    }
    return out;
  }
  function rememberHint(raw) {
    const n = String(raw || "").trim();
    if (!n || n.length > 40) return;
    const zy = typeof stripZhuyin === "function" ? stripZhuyin(n) : n;
    if (typeof isZhuyinQuery === "function" && isZhuyinQuery(zy) && zy.length < 2) return;
    const rest = loadHints().filter((x) => x !== n);
    try {
      localStorage.setItem(HINT_KEY, JSON.stringify([n, ...rest].slice(0, 40)));
    } catch (_) {}
  }
  function hintHits(q) {
    const names = loadHints();
    if (!q) return names.slice(0, 8);
    const scored = [];
    for (const name of names) {
      if (name === q) continue;
      let score = 0;
      if (name.startsWith(q)) score = 1;
      else if (name.includes(q)) score = 3;
      else if (fieldMatches(name, q)) score = 2;
      if (score) scored.push({ name, score });
    }
    scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, "zh-Hant"));
    return scored.slice(0, 8).map((x) => x.name);
  }
  function paintHints() {
    const box = document.getElementById("cd-slip-hints");
    const inp = document.getElementById("cd-slip-q");
    if (!box || !inp) return;
    if (document.activeElement !== inp) {
      box.hidden = true;
      return;
    }
    const hits = hintHits(String(inp.value || "").trim());
    if (!hits.length) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    box.innerHTML = hits
      .map((n) => `<button type="button" class="cd-hint" data-cd-hint="${esc(n)}">${esc(n)}</button>`)
      .join("");
  }
  function slipHit(line, q) {
    if (!q) return true;
    const bits = [
      line.co === "ha" ? "鴻安" : "穠全",
      line.dir === "out" ? "支出" : "收入",
      KIND_LAB[line.kind] || "",
      line.memo || "",
      String(line.amt ?? ""),
      money(line.amt),
    ];
    return bits.some((t) => fieldMatches(t, q));
  }
  function sortSlips(lines, mode) {
    const arr = [...(lines || [])];
    const amt = (l) => Number(l.amt) || 0;
    if (mode === "in") {
      arr.sort((a, b) => {
        const ao = a.dir === "out" ? 1 : 0;
        const bo = b.dir === "out" ? 1 : 0;
        if (ao !== bo) return ao - bo;
        return amt(b) - amt(a);
      });
    } else if (mode === "out") {
      arr.sort((a, b) => {
        const ao = a.dir === "out" ? 0 : 1;
        const bo = b.dir === "out" ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return amt(b) - amt(a);
      });
    } else {
      arr.sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0));
    }
    return arr;
  }
  function chip(group, id, lab, on, extra) {
    return `<button type="button" class="cd-chip${extra ? " " + extra : ""}${on ? " is-on" : ""}" data-cd-${group}="${esc(id)}">${esc(lab)}</button>`;
  }
  function lineHtml(line) {
    const ha = line.co === "ha";
    const out = line.dir === "out";
    const sign = out ? "−" : "+";
    const ticket = isTicketKind(line.kind);
    return `<article class="cd-line${ticket ? " is-ticket" : ""}">
      <div class="cd-line-top">
        <em class="cd-tag${ha ? " is-ha" : ""}">${ha ? "鴻安" : "穠全"}</em>
        ${ticket ? "" : `<em class="cd-tag${out ? " is-out" : ""}">${out ? "支出" : "收入"}</em>`}
        <em class="cd-tag${ticket ? " is-ticket" : ""}">${esc(KIND_LAB[line.kind] || "客戶現金")}</em>
      </div>
      <p class="cd-memo-txt">${esc(line.memo || "（無備註）")}</p>
      <strong class="${out ? "cd-neg" : ""}">${sign}${money(line.amt)}</strong>
      ${dayLocked(cdDate) ? "" : `<button type="button" class="cd-del" data-cd-del="${esc(line.id)}">刪除</button>`}
    </article>`;
  }
  function statHtml(date) {
    const f = figures(date);
    const a = f.t.slip;
    const row = (lab, inn, out, net, cls) =>
      `<tr class="${cls || ""}"><th>${lab}</th>${cell(inn)}${cell(out)}${cell(net)}</tr>`;
    const kindRows = CASH_KINDS.map((k) => {
      const box = f.t.byKind[k.id] || sideBox();
      return `<tr><th>${esc(k.lab)}</th>${cell(netOf(box, "nq"))}${cell(netOf(box, "ha"))}${cell(kindNet(box))}</tr>`;
    }).join("");
    const tkIn = f.t.byKind.ticket || sideBox();
    const tkCash = f.t.byKind.note || sideBox();
    const ticketRows = `${row("當天收票", tkIn.nq.in + tkIn.ha.in, 0, kindNet(tkIn))}
      ${row("票兌現（進現金、不進收付單）", tkCash.nq.in + tkCash.ha.in, 0, kindNet(tkCash))}`;
    const carry = [];
    if (!f.open.setNq && f.open.from) carry.push("穠全");
    if (!f.open.setHa && f.open.from) carry.push("鴻安");
    const inherit = !f.open.from
      ? `<p class="cd-note" id="cd-inherit">第一天請先填各家昨日現金，之後會沿用。合計＝穠全＋鴻安，改了就以今天為準。</p>`
      : carry.length
        ? `<p class="cd-note" id="cd-inherit">${esc(carry.join("、"))}昨日現金沿用 ${esc(roc(f.open.from))} 結餘。改數字就以今天為準。</p>`
        : `<p class="cd-note" id="cd-inherit">昨日現金合計＝穠全＋鴻安。改數字就以今天為準。</p>`;
    const moveNote =
      Math.abs(f.moveGap) >= 0.01
        ? `<p class="cd-note cd-warn" id="cd-move">內部調撥兩邊還沒平，差 ${money(f.moveGap)}。</p>`
        : `<p class="cd-note" id="cd-move">${f.t.byKind.move.nq.in + f.t.byKind.move.nq.out + f.t.byKind.move.ha.in + f.t.byKind.move.ha.out ? "內部調撥兩邊已平。" : ""}</p>`;
    return `<section class="cd-stat-card">
      <h3>統計</h3>
      <table class="cd-table">
        <thead><tr><th></th><th>收入</th><th>支出</th><th>淨額</th></tr></thead>
        <tbody>
          ${row("穠全", a.nq.in, a.nq.out, netOf(a, "nq"))}
          ${row("鴻安", a.ha.in, a.ha.out, netOf(a, "ha"))}
          ${row("合計", f.sumAll.in, f.sumAll.out, f.sumAll.net, "is-total")}
          ${row("對外", f.sumExt.in, f.sumExt.out, f.sumExt.net, "is-out")}
        </tbody>
      </table>
      <p class="cd-note">合計／對外＝現金收付單（客戶現金、費用、調撥）。票兌現不進收付單，只加進下面本日現金。</p>
      <table class="cd-table">
        <thead><tr><th>收付單性質</th><th>穠全</th><th>鴻安</th><th>合計</th></tr></thead>
        <tbody>${kindRows}</tbody>
      </table>
      <table class="cd-table">
        <thead><tr><th>當天票據</th><th>收入</th><th>支出</th><th>淨額</th></tr></thead>
        <tbody>${ticketRows}</tbody>
      </table>
      <p class="cd-note">收票還沒變現金。兌現當天現金增加，但不列入收付單。</p>
      <div class="cd-open">
        <label>昨日現金・穠全<input id="cd-open-nq" inputmode="decimal" value="${esc(String(Number(f.open.nq) || 0))}" placeholder="0" ${dayLocked(date) ? "disabled" : ""} /></label>
        <label>昨日現金・鴻安<input id="cd-open-ha" inputmode="decimal" value="${esc(String(Number(f.open.ha) || 0))}" placeholder="0" ${dayLocked(date) ? "disabled" : ""} /></label>
        <div class="cd-open-sum"><span>昨日現金・合計</span><strong id="cd-open-all">${money((Number(f.open.nq) || 0) + (Number(f.open.ha) || 0))}</strong></div>
      </div>
      ${inherit}
      <div class="cd-close">
        <div><span>本日現金・穠全</span><strong id="cd-close-nq">${money(f.close.nq)}</strong></div>
        <div><span>本日現金・鴻安</span><strong id="cd-close-ha">${money(f.close.ha)}</strong></div>
        <div><span>本日現金・合計</span><strong id="cd-close-all">${money(f.close.all)}</strong></div>
      </div>
      ${moveNote}
      ${lockBarHtml(date)}
    </section>`;
  }
  function safeFile(name) {
    return String(name || "export").replace(/[\\/:*?"<>|]+/g, "_");
  }
  function downloadFile(blob, name) {
    if (typeof helpClickDownload === "function") return helpClickDownload(blob, name);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function exportRows() {
    const all = [...(state.cashDays?.[cdDate]?.lines || [])];
    const slips = sortSlips(
      all.filter((l) => isSlipKind(l.kind) || (!isTicketKind(l.kind) && l.kind !== "note")),
      slipSort,
    );
    const tickets = all.filter((l) => isTicketKind(l.kind)).sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0));
    return { slips, tickets, f: figures(cdDate) };
  }
  function lineCells(line) {
    const ticket = isTicketKind(line.kind);
    return {
      co: line.co === "ha" ? "鴻安" : "穠全",
      dir: ticket ? "" : line.dir === "out" ? "支出" : "收入",
      kind: KIND_LAB[line.kind] || "客戶現金",
      memo: line.memo || "",
      amt: Number(line.amt) || 0,
      sign: !ticket && line.dir === "out" ? -1 : 1,
    };
  }
  function reportTitle() {
    return `現金日報 ${roc(cdDate)}`;
  }
  function reportTablesHtml() {
    const { slips, tickets, f } = exportRows();
    const row = (cells) => `<tr>${cells.map((c, i) => `<td${i === 4 ? ' style="text-align:right"' : ""}>${esc(c)}</td>`).join("")}</tr>`;
    const slipBody = slips.length
      ? slips
          .map((l) => {
            const c = lineCells(l);
            return row([c.co, c.dir, c.kind, c.memo, money(c.sign * c.amt)]);
          })
          .join("")
      : row(["", "", "", "（無）", ""]);
    const ticketBody = tickets.length
      ? tickets
          .map((l) => {
            const c = lineCells(l);
            return row([c.co, "", c.kind, c.memo, money(c.amt)]);
          })
          .join("")
      : row(["", "", "", "（無）", ""]);
    const head = `<tr><th>公司</th><th>收／支</th><th>性質</th><th>摘要／備註</th><th>金額</th></tr>`;
    return `<p>昨日現金　穠全 ${money(f.open.nq)}　鴻安 ${money(f.open.ha)}　合計 ${money((Number(f.open.nq) || 0) + (Number(f.open.ha) || 0))}</p>
      <p>本日現金　穠全 ${money(f.close.nq)}　鴻安 ${money(f.close.ha)}　合計 ${money(f.close.all)}</p>
      <p>收付單合計　收入 ${money(f.sumAll.in)}　支出 ${money(f.sumAll.out)}　淨額 ${money(f.sumAll.net)}　（不含收票／票兌現）</p>
      <h2>現金收付單　${slips.length} 筆</h2>
      <table><thead>${head}</thead><tbody>${slipBody}</tbody></table>
      <h2>當天票據　${tickets.length} 筆</h2>
      <table><thead>${head}</thead><tbody>${ticketBody}</tbody></table>`;
  }
  function exportExcel() {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
      <x:Name>現金日報</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
      </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
      <body><h1>${esc(reportTitle())}</h1>${reportTablesHtml()}</body></html>`;
    downloadFile(new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel" }), `${safeFile(`現金日報_${roc(cdDate).replace(/\//g, "-")}`)}.xls`);
    setStatus("已匯出 Excel，用 Excel 開啟即可。");
  }
  function exportPdf() {
    const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>${esc(reportTitle())}</title>
      <style>
        body{font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;color:#163024;margin:16px;font-size:12px}
        h1{font-size:18px;margin:0 0 8px}
        h2{font-size:14px;margin:14px 0 6px}
        p{margin:0 0 4px;color:#445}
        table{border-collapse:collapse;width:100%;margin-bottom:8px}
        th,td{border:1px solid #bbb;padding:5px 6px;text-align:left;vertical-align:top}
        th{background:#f4f7f5}
        @media print { body{margin:8px} }
      </style></head><body>
      <h1>${esc(reportTitle())}</h1>
      ${reportTablesHtml()}
      <script>window.onload=function(){window.print()}<\/script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      setStatus("瀏覽器擋了新視窗。請允許彈出後再匯出，列印時選「另存 PDF」。", true);
      return;
    }
    w.document.write(html);
    w.document.close();
    setStatus("請在列印視窗選「另存 PDF」。");
  }
  function lockBarHtml(date) {
    const b = state.cashDays?.[date] || {};
    const locked = dayLocked(date);
    if (locked) {
      const who = b.lockedBy ? `${esc(b.lockedBy)}　` : "";
      const when = whenTxt(b.lockedAt);
      const unlock = canUnlockDay()
        ? `<button type="button" class="cd-unlock" data-cd-unlock>開啟修正</button>`
        : `<p class="cd-note">已鎖定。要改請主管按開啟修正。</p>`;
      return `<div class="cd-lockbar is-on"><p>本日已確認　${who}${esc(when)}</p>${unlock}</div>`;
    }
    return `<div class="cd-lockbar"><button type="button" class="primary cd-confirm" data-cd-lock>確認本日日報</button><p class="cd-note">核對無誤再確認。確認後不能改，主管才能開啟修正。</p></div>`;
  }

  function slipView() {
    const allLines = [...(state.cashDays?.[cdDate]?.lines || [])];
    const q = String(slipQ || "").trim().toLowerCase();
    const slipAll = allLines.filter((l) => isSlipKind(l.kind) || (!isTicketKind(l.kind) && l.kind !== "note"));
    const slipLines = sortSlips(slipAll.filter((l) => slipHit(l, q)), slipSort);
    const slipList = slipAll.length
      ? slipLines.length
        ? slipLines.map(lineHtml).join("")
        : `<p class="cd-empty">沒有符合「${esc(slipQ.trim())}」的收付單。</p>`
      : `<p class="cd-empty">今天還沒有現金收付。</p>`;
    const slipHead = q && slipAll.length ? `${slipLines.length}／${slipAll.length} 筆` : `${slipAll.length} 筆`;
    return { slipList, slipHead, ticketLines: [...allLines.filter((l) => isTicketKind(l.kind))].reverse() };
  }
  function paintSlipBoard() {
    const v = slipView();
    const h = document.getElementById("cd-slip-head");
    const b = document.getElementById("cd-slip-body");
    if (h) h.textContent = `現金收付單　${v.slipHead}`;
    if (b) b.innerHTML = v.slipList;
    document.querySelectorAll("#page-cashday [data-cd-sort]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.cdSort === slipSort);
    });
  }
  function renderCashDay() {
    const root = document.getElementById("cd-root");
    if (!root) return;
    ensureStore();
    if (!cdDate) cdDate = typeof today === "function" ? today() : "";
    const keepForm = document.getElementById("cd-form");
    const draft = keepForm && !afterAdd
      ? {
          amt: document.getElementById("cd-amt")?.value || "",
          memo: document.getElementById("cd-memo")?.value || "",
          openNq: document.getElementById("cd-open-nq")?.value || "",
          openHa: document.getElementById("cd-open-ha")?.value || "",
          slipQ: document.getElementById("cd-slip-q")?.value || "",
          active: document.activeElement?.id || "",
        }
      : null;
    const added = afterAdd;
    afterAdd = false;
    const v = slipView();
    const ticketList = v.ticketLines.length
      ? v.ticketLines.map(lineHtml).join("")
      : `<p class="cd-empty">今天還沒收支票。收票請填備註（票號、到期、客人）。</p>`;
    const ticketOn = isTicketKind(kindPick);
    const locked = dayLocked(cdDate);
    const memoPh = kindPick === "ticket"
      ? "必填：票號、到期日、客人、哪家銀行"
      : kindPick === "note"
        ? "必填：兌現哪一張／哪位客人"
        : "客人、油資、調去哪一家";
    const submitLab = kindPick === "ticket" ? "記入收票" : kindPick === "note" ? "記入兌現" : "記入";
    root.classList.toggle("is-locked", locked);
    root.innerHTML = `<div class="cd-head">
        <div>
          <h2>現金日報</h2>
          <p>${esc(roc(cdDate))}　現金收付單一筆只記一家。當天收支票另外記，兌現不進收付單。${locked ? "　已確認鎖定。" : ""}</p>
        </div>
        <label class="cd-date">日期<input id="cd-date" type="date" value="${esc(cdDate)}" /></label>
      </div>
      <div class="cd-export">
        <button type="button" class="ghost" data-cd-xlsx>匯出 Excel</button>
        <button type="button" class="ghost" data-cd-pdf>匯出 PDF</button>
      </div>
      <div class="cd-work">
      <form id="cd-form" class="cd-form${locked ? " is-locked" : ""}">
        <fieldset ${locked ? "disabled" : ""}>
        <label>金額<input id="cd-amt" class="cd-amt" inputmode="decimal" placeholder="0" autocomplete="off" /></label>
        <div class="cd-pick-row">
          <div class="cd-chips">
            ${chip("co", "nq", "穠全", coPick === "nq", "")}
            ${chip("co", "ha", "鴻安", coPick === "ha", "is-ha")}
          </div>
          <div class="cd-chips${ticketOn ? " is-disabled" : ""}" ${ticketOn ? "hidden" : ""}>
            ${chip("dir", "in", "收入", dirPick === "in", "")}
            ${chip("dir", "out", "支出", dirPick === "out", "is-out")}
          </div>
        </div>
        <p class="cd-kicker">現金收付單</p>
        <div class="cd-chips cd-chips-kind">
          ${CASH_KINDS.map((k) => chip("kind", k.id, k.lab, kindPick === k.id, "")).join("")}
        </div>
        <p class="cd-kicker">當天票據（不進收付單）</p>
        <div class="cd-chips cd-chips-kind">
          ${TICKET_KINDS.map((k) => chip("kind", k.id, k.lab, kindPick === k.id, "is-ticket")).join("")}
        </div>
        <label>${kindPick === "ticket" ? "備註" : "摘要"}<input id="cd-memo" class="cd-memo" type="text" placeholder="${esc(memoPh)}" autocomplete="off" /></label>
        <button type="submit" class="primary">${esc(submitLab)}</button>
        </fieldset>
      </form>
      ${statHtml(cdDate)}
      </div>
      <div class="cd-boards">
      <section class="cd-list">
        <h3 id="cd-slip-head">現金收付單　${v.slipHead}</h3>
        <div class="cd-list-tools">
          <div class="cd-search-wrap">
            <input id="cd-slip-q" type="search" placeholder="搜尋或注音首碼，例：ㄑㄓ" value="${esc(slipQ)}" autocomplete="off" />
            <div id="cd-slip-hints" class="cd-hints" hidden></div>
          </div>
          <div class="cd-chips cd-sort">
            ${chip("sort", "at", "輸入順序", slipSort === "at", "")}
            ${chip("sort", "in", "按收入", slipSort === "in", "")}
            ${chip("sort", "out", "按支出", slipSort === "out", "is-out")}
          </div>
        </div>
        <div id="cd-slip-body">${v.slipList}</div>
      </section>
      <section class="cd-list cd-list-ticket">
        <h3>當天票據　${v.ticketLines.length} 筆</h3>
        ${ticketList}
      </section>
      </div>`;
    if (draft) {
      const amt = document.getElementById("cd-amt");
      const memo = document.getElementById("cd-memo");
      const openNq = document.getElementById("cd-open-nq");
      const openHa = document.getElementById("cd-open-ha");
      if (amt) amt.value = draft.amt;
      if (memo) memo.value = draft.memo;
      if (openNq && draft.openNq !== "") openNq.value = draft.openNq;
      if (openHa && draft.openHa !== "") openHa.value = draft.openHa;
      if (draft.slipQ != null) {
        slipQ = draft.slipQ;
        const sq = document.getElementById("cd-slip-q");
        if (sq) sq.value = draft.slipQ;
      }
      if (draft.active) document.getElementById(draft.active)?.focus();
      if (draft.active === "cd-slip-q") paintHints();
    } else if (added) {
      document.getElementById("cd-amt")?.focus();
    }
  }
  window.renderCashDay = renderCashDay;

  function paintClose() {
    const f = figures(cdDate);
    const nqTyped = readAmt(document.getElementById("cd-open-nq")?.value);
    const haTyped = readAmt(document.getElementById("cd-open-ha")?.value);
    const openNq = nqTyped != null ? nqTyped : Number(f.open.nq) || 0;
    const openHa = haTyped != null ? haTyped : Number(f.open.ha) || 0;
    const closeNq = openNq + netOf(f.t.all, "nq");
    const closeHa = openHa + netOf(f.t.all, "ha");
    const nq = document.getElementById("cd-close-nq");
    const ha = document.getElementById("cd-close-ha");
    const all = document.getElementById("cd-close-all");
    if (nq) nq.textContent = money(closeNq);
    if (ha) ha.textContent = money(closeHa);
    if (all) all.textContent = money(closeNq + closeHa);
    const openAll = document.getElementById("cd-open-all");
    if (openAll) openAll.textContent = money(openNq + openHa);
    const note = document.getElementById("cd-inherit");
    if (note) {
      if (!f.open.from) {
        note.textContent = "第一天請先填各家昨日現金，之後會沿用。合計＝穠全＋鴻安，改了就以今天為準。";
      } else {
        const carry = [];
        if (!f.open.setNq && f.open.from) carry.push("穠全");
        if (!f.open.setHa && f.open.from) carry.push("鴻安");
        note.textContent = carry.length
          ? `${carry.join("、")}昨日現金沿用 ${roc(f.open.from)} 結餘。改數字就以今天為準。`
          : "昨日現金合計＝穠全＋鴻安。改數字就以今天為準。";
      }
    }
  }
  function lockDay() {
    if (dayLocked(cdDate)) return;
    if (typeof can === "function" && !can("page-finance")) {
      setStatus("沒有確認日報的權限。", true);
      return;
    }
    if (!window.confirm("確定本日輸入無誤？確認後會鎖定，只有主管能再開來改。")) return;
    const book = bookOf(cdDate);
    book.locked = true;
    book.lockedAt = Date.now();
    book.lockedBy = whoNow();
    save();
    setStatus("本日日報已確認鎖定。");
    renderCashDay();
  }
  function unlockDay() {
    if (!canUnlockDay()) {
      setStatus("沒有開啟修正的權限。", true);
      return;
    }
    if (!dayLocked(cdDate)) return;
    if (!window.confirm("開啟修正後可以改，改完請再按確認。")) return;
    const book = bookOf(cdDate);
    book.locked = false;
    book.unlockedAt = Date.now();
    book.unlockedBy = whoNow();
    save();
    setStatus("已開啟修正，改完請再確認。");
    renderCashDay();
  }
  function refuseLocked() {
    if (!dayLocked(cdDate)) return false;
    setStatus("本日已確認，請主管開啟修正。", true);
    return true;
  }
  function setOpen(side, raw) {
    if (refuseLocked()) return;
    const book = bookOf(cdDate);
    const n = readAmt(raw);
    if (n == null) {
      if (side === "ha") {
        book.openHa = null;
        book.openHaAt = 0;
      } else {
        book.openNq = null;
        book.openNqAt = 0;
      }
      save();
      const f = figures(cdDate);
      const el = document.getElementById(side === "ha" ? "cd-open-ha" : "cd-open-nq");
      if (el) el.value = String(Number(side === "ha" ? f.open.ha : f.open.nq) || 0);
      paintClose();
      return;
    }
    if (side === "ha") {
      book.openHa = n;
      book.openHaAt = Date.now();
    } else {
      book.openNq = n;
      book.openNqAt = Date.now();
    }
    save();
    paintClose();
  }
  function bind() {
    if (bound) return;
    bound = true;
    document.body.addEventListener("click", (e) => {
      const pdfBtn = e.target.closest("[data-cd-pdf]");
      if (pdfBtn) {
        exportPdf();
        return;
      }
      const xlsBtn = e.target.closest("[data-cd-xlsx]");
      if (xlsBtn) {
        exportExcel();
        return;
      }
      const lockBtn = e.target.closest("[data-cd-lock]");
      if (lockBtn) {
        lockDay();
        return;
      }
      const unlockBtn = e.target.closest("[data-cd-unlock]");
      if (unlockBtn) {
        unlockDay();
        return;
      }
      const sortBtn = e.target.closest("[data-cd-sort]");
      if (sortBtn) {
        const id = sortBtn.dataset.cdSort;
        slipSort = id === "in" || id === "out" ? id : "at";
        paintSlipBoard();
        return;
      }
      const hintBtn = e.target.closest("[data-cd-hint]");
      if (hintBtn) {
        slipQ = hintBtn.dataset.cdHint || "";
        rememberHint(slipQ);
        const inp = document.getElementById("cd-slip-q");
        if (inp) inp.value = slipQ;
        paintSlipBoard();
        paintHints();
        return;
      }
      const coBtn = e.target.closest("[data-cd-co]");
      const dirBtn = e.target.closest("[data-cd-dir]");
      const kindBtn = e.target.closest("[data-cd-kind]");
      const del = e.target.closest("[data-cd-del]");
      if ((coBtn || dirBtn || (kindBtn && kindBtn.closest("#cd-form")) || del) && refuseLocked()) return;
      if (coBtn) {
        coPick = coBtn.dataset.cdCo === "ha" ? "ha" : "nq";
        coBtn.parentElement?.querySelectorAll("[data-cd-co]").forEach((b) => b.classList.toggle("is-on", b === coBtn));
        return;
      }
      if (dirBtn) {
        dirPick = dirBtn.dataset.cdDir === "out" ? "out" : "in";
        dirBtn.parentElement?.querySelectorAll("[data-cd-dir]").forEach((b) => b.classList.toggle("is-on", b === dirBtn));
        return;
      }
      if (kindBtn && kindBtn.closest("#cd-form")) {
        kindPick = KIND_LAB[kindBtn.dataset.cdKind] ? kindBtn.dataset.cdKind : "sale";
        if (isTicketKind(kindPick)) dirPick = "in";
        renderCashDay();
        return;
      }
      if (!del) return;
      const book = bookOf(cdDate);
      const id = del.dataset.cdDel;
      if (!book.lines.some((l) => l.id === id)) return;
      book.lines = book.lines.filter((l) => l.id !== id);
      book.removed.push(id);
      save();
      renderCashDay();
    });
    document.body.addEventListener("submit", (e) => {
      if (e.target?.id !== "cd-form") return;
      e.preventDefault();
      if (refuseLocked()) return;
      const amt = readAmt(document.getElementById("cd-amt")?.value);
      const memo = String(document.getElementById("cd-memo")?.value || "").trim();
      if (amt == null || amt <= 0) {
        setStatus("金額要大於 0。", true);
        document.getElementById("cd-amt")?.focus();
        return;
      }
      if (!memo) {
        setStatus(isTicketKind(kindPick) ? "收票／兌現請填備註（票號、到期、客人）。" : "寫一下摘要，之後才對得出這一筆。", true);
        document.getElementById("cd-memo")?.focus();
        return;
      }
      const book = bookOf(cdDate);
      const dir = isTicketKind(kindPick) ? "in" : dirPick;
      book.lines.push({
        id: typeof uid === "function" ? uid() : `cd-${Date.now().toString(36)}`,
        memo,
        co: coPick,
        dir,
        kind: kindPick,
        amt,
        at: Date.now(),
      });
      save();
      afterAdd = true;
      rememberHint(memo);
      setStatus(kindPick === "ticket" ? "已記入收票（還沒進現金、不進收付單）。" : kindPick === "note" ? "已記入兌現，本日現金已加上，不進收付單。" : "已記入，統計已更新。");
      renderCashDay();
    });
    document.body.addEventListener("mousedown", (e) => {
      if (e.target.closest("[data-cd-hint]")) e.preventDefault();
    });
    document.body.addEventListener("focusin", (e) => {
      if (e.target?.id === "cd-slip-q") paintHints();
    });
    document.body.addEventListener("focusout", (e) => {
      if (e.target?.id === "cd-slip-q") {
        const q = String(e.target.value || "").trim();
        if (q.length >= 2) rememberHint(q);
        setTimeout(paintHints, 0);
      }
    });
    document.body.addEventListener("input", (e) => {
      if (e.target?.id === "cd-slip-q") {
        slipQ = e.target.value || "";
        paintSlipBoard();
        paintHints();
        return;
      }
      if (e.target?.id === "cd-open-nq" || e.target?.id === "cd-open-ha") paintClose();
    });
    document.body.addEventListener("change", (e) => {
      if (e.target?.id === "cd-date") {
        cdDate = e.target.value || (typeof today === "function" ? today() : "");
        renderCashDay();
        return;
      }
      if (e.target?.id === "cd-open-nq") setOpen("nq", e.target.value);
      if (e.target?.id === "cd-open-ha") setOpen("ha", e.target.value);
    });
  }
  bind();
})();
