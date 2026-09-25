/** 應收 × 富邦匯入比對：週結日～六、半月 1～15／16～月底、月結付上個月 */
(function () {
  const SKIP_BANK = /企網換匯|企網交易|放款繳款|^轉支$/;
  const BANK_STRIP =
    /中華郵政|國泰世華|中國信託|玉山銀行|合庫商銀|富邦|彰化銀行|第一銀行|台灣企銀|臺灣企銀|元大銀行|華南銀行|新光商銀|農金資中心|雲林縣等農會|花蓮農會|林口農會|南資中心|桃信|分行作業管理部|港都分行|中港分行|蘆洲分行|安和分行|京城商銀|農會|銀行|商銀|企銀|郵局/g;
  const SEMI_RE = /春田|宏文/;

  let asOf = "";
  let filter = "in";
  let openCode = "";
  let customers = [];
  let credits = [];
  let rows = [];
  let unmatched = [];
  let bound = false;
  let arNames = [];
  let bankName = "";
  let custName = "";
  let masterByCode = new Map();

  function ymd(y, m, d) {
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  function parseYmd(s) {
    const m = String(s || "").match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return { y: +m[1], m: +m[2], d: +m[3] };
  }
  function lastDay(y, m) {
    return new Date(y, m, 0).getDate();
  }
  function addDaysYmd(iso, n) {
    const p = parseYmd(iso);
    if (!p) return "";
    const dt = new Date(p.y, p.m - 1, p.d + n);
    return ymd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  }
  function weekday(iso) {
    const p = parseYmd(iso);
    return p ? new Date(p.y, p.m - 1, p.d).getDay() : 0;
  }
  function rocToYmd(s) {
    const m = String(s || "").match(/(\d{2,3})\/(\d{1,2})\/(\d{1,2})/);
    if (!m) return "";
    return ymd(+m[1] + 1911, +m[2], +m[3]);
  }
  function westToYmd(s) {
    const m = String(s || "").match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (!m) return rocToYmd(s);
    return ymd(+m[1], +m[2], +m[3]);
  }
  function num(s) {
    const n = Number(String(s ?? "").replace(/,/g, "").replace(/[^0-9.+-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  function money(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }
  function moneyText(n) {
    return money(n).toLocaleString("zh-Hant-TW", { maximumFractionDigits: 0 });
  }
  function shortDate(iso) {
    const p = parseYmd(iso);
    if (!p) return iso || "";
    return `${p.m}/${p.d}`;
  }
  function checkedHtml(ins) {
    const ok = ins.filter((x) => x.done);
    if (!ok.length) return `<span class="ar-no">未核</span>`;
    const lines = ok
      .map((x) => `<div class="ar-ok-line"><span class="ar-ok">已核帳</span><strong>${esc(shortDate(x.date))}</strong><em>${esc(moneyText(x.amt))}</em></div>`)
      .join("");
    return `<div class="ar-ok-box">${lines}</div>`;
  }
  function weeklyPeriodEnd(iso) {
    const back = (weekday(iso) + 1) % 7;
    return addDaysYmd(iso, -back);
  }
  function semiPeriodEnd(iso) {
    const p = parseYmd(iso);
    if (!p) return iso;
    if (p.d < 15) {
      const py = p.m === 1 ? p.y - 1 : p.y;
      const pm = p.m === 1 ? 12 : p.m - 1;
      return ymd(py, pm, lastDay(py, pm));
    }
    if (p.d === 15) return ymd(p.y, p.m, 15);
    const eom = lastDay(p.y, p.m);
    if (p.d >= eom) return ymd(p.y, p.m, eom);
    return ymd(p.y, p.m, 15);
  }
  function monthlyPeriodEnd(iso) {
    const p = parseYmd(iso);
    if (!p) return iso;
    const py = p.m === 1 ? p.y - 1 : p.y;
    const pm = p.m === 1 ? 12 : p.m - 1;
    return ymd(py, pm, lastDay(py, pm));
  }
  function kindFromCells(code, label) {
    const a = String(code || "").trim();
    const b = String(label || "").replace(/\s+/g, "");
    if (a === "02" || b.includes("半月")) return "semi";
    if (a === "03" || b.includes("月結")) return "month";
    if (a === "01" || /周|週/.test(a) || /周|週/.test(b)) return "week";
    return "week";
  }
  function settleKind(c) {
    const m = masterByCode.get(c.code);
    if (m) return m.kind;
    const n = `${c.code || ""} ${c.name || ""}`;
    if (SEMI_RE.test(n)) return "semi";
    return "week";
  }
  function settleLabel(kind) {
    if (kind === "semi") return "半月結";
    if (kind === "month") return "月結";
    return "週結";
  }
  function periodEndFor(kind, iso) {
    if (kind === "semi") return semiPeriodEnd(iso);
    if (kind === "month") return monthlyPeriodEnd(iso);
    return weeklyPeriodEnd(iso);
  }

  function parseArRows(rows) {
    const list = [];
    let cur = null;
    let voucherDate = "";
    let voucherNo = "";
    let asOfFound = "";
    for (const raw of rows || []) {
      const r = (raw || []).map((c) => String(c ?? "").replace(/\s+/g, " ").trim());
      const line = r.join(" ");
      const range = line.match(/帳款區間[：:]\s*\S+\s*[～~－-]\s*(\d{2,3}\/\d{1,2}\/\d{1,2})/);
      if (range) asOfFound = rocToYmd(range[1]);
      const who = line.match(/請款對象[：:]\s*(\S+)\s+(.+)/);
      if (who) {
        if (cur) list.push(cur);
        cur = {
          code: who[1],
          name: who[2].replace(/製表日期.*/, "").trim(),
          unpaid: 0,
          received: 0,
          docs: [],
        };
        voucherDate = "";
        voucherNo = "";
        continue;
      }
      const unpaid = line.match(/未收帳款總額[：:]\s*([-0-9,]+)/);
      const recv = line.match(/本期已收總額[：:]\s*([-0-9,]+)/);
      if (unpaid && cur) cur.unpaid = num(unpaid[1]);
      if (recv && cur) cur.received = num(recv[1]);
      if (r[0] === "單據日期") continue;
      if (r[0] && /\d/.test(r[0]) && r[1] && r[2]) {
        voucherDate = rocToYmd(r[0]) || westToYmd(r[0]);
        voucherNo = r[1];
      }
      const tot = num(r[15]);
      if (cur && tot && voucherDate) {
        cur.docs.push({ date: voucherDate, voucher: voucherNo, amt: tot });
      }
    }
    if (cur) list.push(cur);
    return { list, asOfFound };
  }

  function parseBankRows(rows) {
    let hi = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
      const j = (rows[i] || []).map((c) => String(c ?? "")).join("");
      if (j.includes("存入金額") && (j.includes("帳務日期") || j.includes("附註"))) {
        hi = i;
        break;
      }
    }
    const start = hi >= 0 ? hi + 1 : 0;
    const head = hi >= 0 ? (rows[hi] || []).map((c) => String(c ?? "")) : [];
    const paidSheet = head.join("").includes("附註") && !String(head[0] || "").includes("存款");
    const out = [];
    for (const raw of rows.slice(start)) {
      const r = (raw || []).map((c) => String(c ?? "").trim());
      if (!r.some((x) => x) || (r[0] === "富邦" && !r[1] && !r[4])) continue;
      if (String(r[0] || "").includes("查詢")) continue;
      let date = westToYmd(r[1]) || westToYmd(r[0]);
      if (!date) {
        const md = String(r[0] || r[1] || "").match(/(\d{1,2})\s*月\s*(\d{1,2})/);
        if (md) {
          const y = parseYmd(asOf)?.y || 2026;
          date = ymd(y, +md[1], +md[2]);
        }
      }
      let amt = num(r[4]);
      let type = r[3] || r[2] || "";
      let note = r[5] || "";
      if (!amt) {
        for (let i = 0; i < r.length; i += 1) {
          const n = num(r[i]);
          if (n >= 1) {
            amt = n;
            if (!note) note = r[i + 1] || r[i - 1] || "";
            break;
          }
        }
      }
      if (amt <= 0) continue;
      if (!paidSheet && SKIP_BANK.test(type)) continue;
      const g = paidSheet ? r[6] || "" : "";
      const h = paidSheet ? r[7] || "" : "";
      const mark = parsePaidMark(g, h);
      out.push({
        date,
        type: type || (r[0] === "富邦" ? "匯入" : r[0] || "匯入"),
        amt: money(amt),
        note,
        who: mark.who,
        done: paidSheet ? mark.done : true,
        pending: mark.pending,
        mark: [g, h].filter(Boolean).join(" "),
        paidSheet,
      });
    }
    return out;
  }
  function parsePaidMark(g, h) {
    const gw = String(g || "").trim();
    const hw = String(h || "").trim();
    const statusWord = /^(沖帳|沖|完成|已入|未處理|入預收|累入預收)$/;
    const who = statusWord.test(gw) ? "" : gw;
    if (/未處理/.test(`${gw} ${hw}`)) return { who, pending: true, done: false };
    const done =
      /完成|已入|入預收|沖帳/.test(hw) ||
      /^(沖帳|沖|完成|已入)$/.test(gw) ||
      /^沖$/.test(hw);
    return { who, pending: false, done: Boolean(done) };
  }

  function parseCustRows(rows) {
    let hi = -1;
    for (let i = 0; i < Math.min(rows.length, 12); i += 1) {
      const j = (rows[i] || []).map((c) => String(c ?? "").replace(/\s+/g, "")).join("|");
      if (j.includes("客戶編號") && (j.includes("結帳類別") || j.includes("客戶名稱"))) {
        hi = i;
        break;
      }
    }
    if (hi < 0) return [];
    const head = (rows[hi] || []).map((c) => String(c ?? "").replace(/\s+/g, ""));
    const iCode = head.findIndex((h) => h === "客戶編號");
    const iName = head.findIndex((h) => h === "客戶名稱");
    const iShort = head.findIndex((h) => h === "客戶簡稱");
    const kindIdx = [];
    head.forEach((h, i) => {
      if (h === "結帳類別") kindIdx.push(i);
    });
    const out = [];
    for (const raw of rows.slice(hi + 1)) {
      const code = String(raw[iCode] ?? "").trim();
      if (!code || code === "H" || code === "客戶編號") continue;
      const kindCode = kindIdx[0] != null ? raw[kindIdx[0]] : "";
      const kindLab = kindIdx[1] != null ? raw[kindIdx[1]] : kindCode;
      out.push({
        code,
        name: String(raw[iName] ?? "").trim(),
        short: String(raw[iShort] ?? "").trim(),
        kind: kindFromCells(kindCode, kindLab),
      });
    }
    return out;
  }

  function namesOf(c) {
    const m = masterByCode.get(c.code);
    return [c.name, m?.name, m?.short].filter(Boolean);
  }

  function noteKey(note) {
    return String(note || "")
      .replace(/[＊*0-9]/g, "")
      .replace(BANK_STRIP, "")
      .replace(/[ˉ\-_.／/\s]/g, "")
      .trim();
  }
  function matchCredit(cr, list) {
    if ((/託收/.test(cr.type) || /^託收/.test(cr.note)) && !cr.who) return [];
    const keys = [noteKey(cr.note), noteKey(cr.who || "")].filter((k) => k.length >= 2);
    const codeM = String(`${cr.who || ""} ${cr.note || ""}`).match(/\b(B\d{2,4}|\d{3}(?:-\d)?)\b/i);
    const scored = [];
    for (const c of list) {
      const names = namesOf(c).map((x) => String(x).replace(/[()（）\s]/g, ""));
      let s = 0;
      if (codeM && String(c.code).toUpperCase() === String(codeM[1]).toUpperCase()) s = 99;
      for (const key of keys) {
        for (const name of names) {
          if (!name) continue;
          if (name.includes(key) || key.includes(name)) s = Math.max(s, 95);
          else if (key.length >= 2 && name.includes(key.slice(0, Math.min(3, key.length)))) s = Math.max(s, 70);
          if (SEMI_RE.test(key) && SEMI_RE.test(name)) s = Math.max(s, 96);
        }
      }
      if (s) scored.push({ c, s });
    }
    scored.sort((a, b) => b.s - a.s);
    if (!scored.length) return [];
    const top = scored[0].s;
    return scored.filter((x) => x.s >= 70 && x.s >= top - 5).map((x) => x.c);
  }

  function build() {
    const day = asOf || (typeof today === "function" ? today() : "");
    rows = customers.map((c) => {
      const kind = settleKind(c);
      const end = periodEndFor(kind, day);
      let due = 0;
      let open = 0;
      for (const d of c.docs || []) {
        if (!d.date) continue;
        if (d.date <= end) due += d.amt;
        else if (d.date <= day) open += d.amt;
      }
      if (!c.docs.length) due = c.unpaid;
      return {
        code: c.code,
        name: c.name,
        kind,
        kindLab: settleLabel(kind),
        unpaid: c.unpaid,
        due: money(due),
        open: money(open),
        end,
        ins: [],
        inAmt: 0,
      };
    });
    const byCode = new Map(rows.map((r) => [r.code, r]));
    unmatched = [];
    for (const cr of credits) {
      const hits = matchCredit(cr, customers);
      if (hits.length === 1) {
        cr.custName = `${hits[0].code} ${hits[0].name}`;
        const row = byCode.get(hits[0].code);
        if (row) {
          row.ins.push(cr);
          if (cr.done) row.inAmt = money(row.inAmt + cr.amt);
        }
      } else if (!cr.done) {
        unmatched.push({ ...cr, maybe: hits.map((h) => h.code + h.name).join("、") });
      }
    }
    for (const r of rows) r.diff = money(r.due - r.inAmt);
  }

  function shownRows() {
    return rows.filter((r) => {
      if (filter === "in") return r.inAmt > 0;
      if (filter === "gap") return r.inAmt > 0 && Math.abs(r.diff) >= 1;
      if (filter === "none") return r.due > 0 && r.inAmt <= 0;
      return true;
    });
  }

  function kpis() {
    const hit = rows.filter((r) => r.inAmt > 0);
    return [
      { v: masterByCode.size, l: "清單客人" },
      { v: customers.length, l: "應收客人" },
      { v: credits.length, l: "匯入筆數" },
      { v: credits.filter((c) => c.done).length, l: "已核帳筆數" },
      { v: moneyText(credits.filter((c) => c.done).reduce((s, c) => s + c.amt, 0)), l: "已核帳金額" },
      { v: unmatched.length, l: "未對到戶名" },
    ];
  }

  function renderPaidLines() {
    const list = credits.filter((c) => c.done);
    if (!list.length) return "";
    const body = list
      .map((c) => {
        const who = c.custName || c.who || "";
        return `<tr class="is-hit">
          <td>${checkedHtml([c])}</td>
          <td>${esc(who)}</td>
          <td>${esc(c.note)}</td>
          <td>${esc(c.mark || "")}</td>
        </tr>`;
      })
      .join("");
    return `<h3 class="ar-unmatched" style="margin-top:0">已核帳（匯入日＋金額）</h3>
      <div class="ar-sheet-wrap" style="margin-bottom:0.85rem"><table class="ar-sheet">
      <thead><tr><th>已核帳</th><th>客人</th><th>銀行附註</th><th>沖帳備註</th></tr></thead>
      <tbody>${body}</tbody></table></div>`;
  }
    const list = shownRows();
    if (!list.length) return `<p class="muted">沒有符合的列。</p>`;
    const head = ["編號", "客戶", "結帳", "本期應結", "已核帳（匯入日＋金額）", "差額"];
    const body = list
      .map((r) => {
        const on = r.code === openCode ? " is-on" : "";
        const cls = r.inAmt > 0 && Math.abs(r.diff) < 1 ? "is-hit" : r.inAmt > 0 ? "is-gap" : "is-open";
        return `<tr class="${cls}${on}" data-ar-row="${esc(r.code)}">
          <td>${esc(r.code)}</td>
          <td>${esc(r.name)}</td>
          <td>${esc(r.kindLab)}</td>
          <td class="num">${moneyText(r.due)}</td>
          <td>${checkedHtml(r.ins)}</td>
          <td class="num">${r.inAmt ? moneyText(r.diff) : ""}</td>
        </tr>`;
      })
      .join("");
    return `<div class="ar-sheet-wrap"><table class="ar-sheet"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function renderDetail() {
    const r = rows.find((x) => x.code === openCode);
    if (!r) return "";
    const ins = r.ins.length
      ? `<ul>${r.ins.map((x) => `<li>${esc(x.date)} ${esc(x.type)} ${esc(moneyText(x.amt))}　${esc(x.note)}</li>`).join("")}</ul>`
      : "<p class=\"muted\">這位客人這份銀行檔沒對到匯入（託收／遮帳號會在下面未對到）。</p>";
    return `<div class="ar-detail">
      <h3>${esc(r.code)} ${esc(r.name)}　${esc(r.kindLab)}結至 ${esc(r.end)}</h3>
      <p>帳載未收 ${esc(moneyText(r.unpaid))} · 本期應結 ${esc(moneyText(r.due))} · 未滿 ${esc(moneyText(r.open))} · 匯入 ${esc(moneyText(r.inAmt))} · 差額 ${esc(moneyText(r.diff))}</p>
      ${ins}
    </div>`;
  }

  function renderUnmatched() {
    if (!unmatched.length) return "";
    const lis = unmatched
      .map((x) => `<li>${esc(x.date)} ${esc(x.type)} ${esc(moneyText(x.amt))}　${esc(x.note)}${x.maybe ? `（可能：${esc(x.maybe)}）` : ""}</li>`)
      .join("");
    return `<div class="ar-unmatched"><h3>未對到客人的匯入（託收／遮帳號／戶名對不上）</h3><ul>${lis}</ul></div>`;
  }

  function renderArRemit() {
    bindOnce();
    const root = document.getElementById("ar-root");
    if (!root) return;
    const kpi = rows.length
      ? `<div class="ar-kpis">${kpis()
          .map((k) => `<div class="ar-kpi"><strong>${esc(String(k.v))}</strong><span>${esc(k.l)}</span></div>`)
          .join("")}</div>`
      : "";
    if (!root.querySelector("#ar-run")) {
      root.innerHTML = `
      <header class="ar-head">
        <h2>匯款沖帳比對</h2>
        <p>第三個檔可上傳「沖帳核對清單-已沖帳」。有標完成／沖帳／已入的，頁面直接列出<strong>已核帳</strong>＋匯入日＋金額。不必下載 Excel。</p>
      </header>
      <div class="ar-files">
        <label class="ar-file">客戶清單（結帳類別）
          <input type="file" id="ar-cust-file" accept=".xlsx,.xls" />
          <span class="muted" id="ar-cust-lab">尚未選檔</span>
        </label>
        <label class="ar-file">應收明細（可多選 001-905 與 B001-B200）
          <input type="file" id="ar-ar-files" accept=".xlsx,.xls" multiple />
          <span class="muted" id="ar-ar-lab">尚未選檔</span>
        </label>
        <label class="ar-file">富邦明細或沖帳核對清單（已沖帳）
          <input type="file" id="ar-bank-file" accept=".xlsx,.xls" />
          <span class="muted" id="ar-bank-lab">尚未選檔</span>
        </label>
      </div>
      <div class="ar-tools">
        <label>帳款日<input id="ar-asof" type="date" value="${esc(asOf)}" /></label>
        <button type="button" class="primary" id="ar-run">開始比對</button>
      </div>
      <p class="ar-msg" id="ar-msg"></p>
      <div id="ar-body"></div>`;
    }
    const custLab = document.getElementById("ar-cust-lab");
    const arLab = document.getElementById("ar-ar-lab");
    const bankLab = document.getElementById("ar-bank-lab");
    if (custLab) custLab.textContent = custName || "尚未選檔";
    if (arLab) arLab.textContent = arNames.length ? arNames.join("、") : "尚未選檔";
    if (bankLab) bankLab.textContent = bankName || "尚未選檔";
    const asofEl = document.getElementById("ar-asof");
    if (asofEl && asOf && !asofEl.value) asofEl.value = asOf;
    const body = document.getElementById("ar-body");
    if (!body) return;
    body.innerHTML = `
      ${kpi}
      ${renderPaidLines()}
      ${
        rows.length
          ? `<div class="ar-filters">
              <button type="button" class="pick${filter === "in" ? " on" : ""}" data-ar-filter="in">已核帳客人</button>
              <button type="button" class="pick${filter === "gap" ? " on" : ""}" data-ar-filter="gap">已核帳但有差額</button>
              <button type="button" class="pick${filter === "none" ? " on" : ""}" data-ar-filter="none">本期應結、沒核帳</button>
              <button type="button" class="pick${filter === "all" ? " on" : ""}" data-ar-filter="all">全部客人</button>
            </div>`
          : ""
      }
      ${rows.length ? renderTable() : ""}
      ${renderDetail()}
      ${renderUnmatched()}
    `;
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

  async function runCompare() {
    const custInput = document.getElementById("ar-cust-file");
    const arInput = document.getElementById("ar-ar-files");
    const bankInput = document.getElementById("ar-bank-file");
    const msg = document.getElementById("ar-msg");
    const custFile = custInput?.files?.[0];
    const arFiles = [...(arInput?.files || [])];
    const bankFile = bankInput?.files?.[0];
    if (!custFile || !arFiles.length || !bankFile) {
      if (msg) msg.textContent = "請選客戶清單、應收檔（可多份）和富邦明細。";
      return typeof setStatus === "function" ? setStatus("請選客戶清單、應收檔和富邦明細。", true) : null;
    }
    if (msg) msg.textContent = "正在比對…";
    try {
      customers = [];
      masterByCode = new Map();
      custName = custFile.name;
      arNames = arFiles.map((f) => f.name);
      bankName = bankFile.name;
      const cj = await uploadParse(custFile);
      for (const m of parseCustRows((cj.sheets || [])[0]?.rows || [])) masterByCode.set(m.code, m);
      if (!masterByCode.size) throw new Error("客戶清單沒讀到結帳類別。");
      let foundAsOf = "";
      for (const f of arFiles) {
        const j = await uploadParse(f);
        const sh = (j.sheets || [])[0];
        const parsed = parseArRows(sh?.rows || []);
        customers = customers.concat(parsed.list);
        if (parsed.asOfFound) foundAsOf = parsed.asOfFound;
      }
      const bj = await uploadParse(bankFile);
      credits = parseBankRows((bj.sheets || [])[0]?.rows || []);
      const asofEl = document.getElementById("ar-asof");
      asOf = (asofEl && asofEl.value) || foundAsOf || (typeof today === "function" ? today() : "");
      if (!asofEl?.value && asOf && asofEl) asofEl.value = asOf;
      build();
      filter = "in";
      openCode = "";
      renderArRemit();
      const m2 = document.getElementById("ar-msg");
      if (m2) {
        const nWeek = [...masterByCode.values()].filter((x) => x.kind === "week").length;
        const nSemi = [...masterByCode.values()].filter((x) => x.kind === "semi").length;
        const nMonth = [...masterByCode.values()].filter((x) => x.kind === "month").length;
        m2.textContent = `清單 ${masterByCode.size}（周結 ${nWeek}／半月 ${nSemi}／月結 ${nMonth}）。應收 ${customers.length} 家，匯入 ${credits.length} 筆（已略過公司自轉）。`;
      }
    } catch (err) {
      if (msg) msg.textContent = String(err.message || err);
      if (typeof setStatus === "function") setStatus(String(err.message || err), true);
    }
  }

  function bindOnce() {
    if (bound) return;
    bound = true;
    const root = document.getElementById("ar-root");
    if (!root) return;
    root.addEventListener("click", (e) => {
      if (e.target.closest("#ar-run")) {
        runCompare();
        return;
      }
      const f = e.target.closest("[data-ar-filter]");
      if (f) {
        filter = f.dataset.arFilter || "in";
        renderArRemit();
        return;
      }
      const tr = e.target.closest("[data-ar-row]");
      if (tr) {
        const code = tr.dataset.arRow || "";
        openCode = openCode === code ? "" : code;
        renderArRemit();
      }
    });
    root.addEventListener("change", (e) => {
      if (e.target.id === "ar-asof") asOf = e.target.value || asOf;
    });
  }

  window.renderArRemit = renderArRemit;
})();
