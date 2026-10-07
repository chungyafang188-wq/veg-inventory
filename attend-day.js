const ATTEND_ROSTER = [
  ...["湯", "子羽", "凱婷", "威誠", "雅芳", "老闆娘"].map((name) => ({ id: `辦公室-${name}`, name, group: "辦公室" })),
  ...["家鑫", "小胖", "善存"].map((name) => ({ id: `司機-${name}`, name, group: "司機" })),
  ...["武", "定", "山", "好", "青", "萍", "猜", "香"].map((name) => ({ id: `雅芳工人-${name}`, name, group: "雅芳工人" })),
];
const ATTEND_CREWS = [
  { id: "wu", boss: "吳幸蓉" },
  { id: "tian", boss: "阿田" },
  { id: "yao", boss: "耀輝" },
  { id: "zhen", boss: "小珍" },
];
let attendIso = "";

function attendTodayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function attendActiveIso() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(attendIso)) attendIso = attendTodayIso();
  return attendIso;
}
function attendBag() {
  if (!state.attendance || typeof state.attendance !== "object" || Array.isArray(state.attendance)) return {};
  return state.attendance;
}
function attendFixed(iso, person) {
  const saved = attendBag()[iso]?.fixed?.[person.id];
  return {
    on: true,
    start: "",
    end: "",
    start2: "",
    end2: "",
    rest: "",
    split: false,
    noBento: false,
    ...(saved && typeof saved === "object" ? saved : {}),
  };
}
function attendCrew(iso, crew) {
  const saved = attendBag()[iso]?.crews?.[crew.id];
  return {
    plan: "",
    people: "",
    start: "",
    end: "",
    rest: "",
    off: false,
    ...(saved && typeof saved === "object" ? saved : {}),
  };
}
function attendClock(raw) {
  const s = String(raw || "").trim().replace("：", ":");
  if (!s) return null;
  if (s.includes(":")) {
    const [hs, ms] = s.split(":");
    const hh = Number(hs);
    const mm = Number(ms);
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh > 23 || mm > 59) return null;
    return hh * 60 + mm;
  }
  if (/^\d{3,4}$/.test(s)) {
    const n = Number(s);
    const hh = Math.floor(n / 100);
    const mm = n % 100;
    if (hh > 23 || mm > 59) return null;
    return hh * 60 + mm;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const hh = Math.floor(n);
  const mm = Math.round((n - hh) * 60);
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}
function attendSpan(start, end) {
  const a = attendClock(start);
  const b = attendClock(end);
  if (a == null || b == null || b <= a) return null;
  return Math.round(((b - a) / 60) * 10) / 10;
}
function attendCross(start, end) {
  const a = attendClock(start);
  const b = attendClock(end);
  if (a == null || b == null || b <= a) return false;
  return a < 12 * 60 && b > 12 * 60;
}
function attendRestMin(cross, raw) {
  if (!cross) return 0;
  if (String(raw || "").trim() === "") return 60;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 60;
  return n;
}
function attendWhole(raw) {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function attendBentoStart(start) {
  const a = attendClock(start);
  return a != null && a < 12 * 60;
}
function attendWorkerHours(p) {
  if (!p.on) return null;
  const first = attendSpan(p.start, p.end);
  if (p.split) {
    const second = attendSpan(p.start2, p.end2);
    if (first == null || second == null) return null;
    return Math.round((first + second) * 10) / 10;
  }
  if (first == null) return null;
  const rest = Number(p.rest);
  if (!Number.isFinite(rest) || rest < 0) return null;
  const h = first - rest / 60;
  if (h < 0) return null;
  return Math.round(h * 10) / 10;
}
function attendCrewHours(c) {
  if (c.off) return null;
  const span = attendSpan(c.start, c.end);
  if (span == null) return null;
  const net = span - attendRestMin(attendCross(c.start, c.end), c.rest) / 60;
  if (net < 0) return 0;
  return Math.round(net * 10) / 10;
}
function attendEnsure(iso) {
  if (!state.attendance || typeof state.attendance !== "object" || Array.isArray(state.attendance)) state.attendance = {};
  if (!state.attendance[iso] || typeof state.attendance[iso] !== "object") {
    state.attendance[iso] = { fixed: {}, crews: {}, extra: "0" };
  }
  const rec = state.attendance[iso];
  if (!rec.fixed || typeof rec.fixed !== "object") rec.fixed = {};
  if (!rec.crews || typeof rec.crews !== "object") rec.crews = {};
  if (rec.extra == null) rec.extra = "0";
  return rec;
}
function attendStats(iso) {
  const people = ATTEND_ROSTER.map((p) => ({ ...p, ...attendFixed(iso, p) }));
  const present = people.filter((p) => p.on);
  const noBento = present.filter((p) => p.noBento).length;
  const extraRaw = attendBag()[iso]?.extra ?? "0";
  const extraN = attendWhole(extraRaw);
  const crews = ATTEND_CREWS.map((c) => ({ ...c, ...attendCrew(iso, c) }));
  const working = crews.filter((c) => !c.off && attendWhole(c.people) > 0);
  const crewActual = working.reduce((sum, c) => sum + attendWhole(c.people), 0);
  const crewPlan = crews.reduce((sum, c) => sum + attendWhole(c.plan), 0);
  const crewBento = working.reduce((sum, c) => sum + (attendBentoStart(c.start) ? attendWhole(c.people) : 0), 0);
  const bento = present.length - noBento + crewBento + extraN;
  return { people, present, noBento, extraRaw: String(extraRaw), extraN, crews, working, crewActual, crewPlan, crewBento, bento };
}
function attendMonthCells(iso) {
  const [y, m] = iso.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(y, m, 0).getDate();
  const cells = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= count; d += 1) cells.push(d);
  return { y, m, cells };
}
function attendShiftMonth(iso, dir) {
  const [y, m, d] = iso.split("-").map(Number);
  const next = new Date(y, m - 1 + dir, 1);
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  const day = Math.min(d, last);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function attendResultInner(iso) {
  const st = attendStats(iso);
  const onDuty = (name) => st.present.some((p) => p.name === name);
  const lead = ["威誠", "雅芳", "老闆娘"].filter(onDuty).map((name) => (name === "雅芳" ? "芳" : name));
  const drivers = ["家鑫", "小胖", "善存"].filter(onDuty);
  const accountants = ["湯", "子羽", "凱婷"].filter(onDuty);
  const workers = ["武", "定", "山", "好", "青", "萍", "猜", "香"].filter(onDuty);
  const lines = [
    { label: "辦公室", names: lead },
    { label: "司機", names: drivers },
    { label: "會計", names: accountants },
    { label: "雅芳工人", names: workers },
  ].filter((row) => row.names.length);
  const crewLines = st.working.map((c) => {
    const hour = String(c.start || "").trim().replace(/^0+(?=\d)/, "");
    return `${esc(c.boss)}　${attendWhole(c.people)}人　${esc(hour)}點`;
  });
  const [, mm, dd] = iso.split("-");
  const nameHtml = lines
    .map((row) => `<div class="attend-name-row"><b>${esc(row.label)}</b><span>${row.names.map((n) => esc(n)).join("　")}</span></div>`)
    .join("");
  const crewHtml = crewLines.length ? `<div class="attend-name-row"><b>外調</b><span>${crewLines.join("<br>")}</span></div>` : "";
  return `<p class="attend-result-kicker">當天結果</p>
    <p class="attend-result-line">${Number(mm)}/${Number(dd)}　出席 ${st.present.length}　外調 ${st.crewActual}　預計 ${st.crewPlan}</p>
    <div class="attend-name-list">${nameHtml}${crewHtml}</div>
    <p class="attend-bento-num">${st.bento}</p>
    <p class="attend-bento-lab">今天便當</p>
    <p class="attend-bento-math">固定 ${st.present.length} − 不加 ${st.noBento} ＋ 12點前到 ${st.crewBento} ＋ 額外 ${st.extraN}</p>
    <label class="attend-extra">額外 <input class="attend-in" data-attend-field="extra" value="${esc(st.extraRaw)}" inputmode="numeric"></label>`;
}
function attendRefresh(iso) {
  const root = document.querySelector("[data-attend-root]");
  if (!root || root.dataset.attendDay !== iso) return;
  const st = attendStats(iso);
  for (const p of st.people) {
    if (p.group !== "雅芳工人") continue;
    const el = root.querySelector(`[data-hours-for="${CSS.escape(p.id)}"]`);
    const h = attendWorkerHours(p);
    if (el) el.textContent = !p.on || h == null ? "—" : String(h);
  }
  for (const c of st.crews) {
    const hours = attendCrewHours(c);
    const hEl = root.querySelector(`[data-crew-hours="${CSS.escape(c.id)}"]`);
    const bEl = root.querySelector(`[data-crew-bento="${CSS.escape(c.id)}"]`);
    const n = attendWhole(c.people);
    if (hEl) hEl.textContent = c.off || hours == null ? "—" : String(hours);
    if (bEl) bEl.textContent = c.off ? "—" : attendBentoStart(c.start) ? "算" : n > 0 ? "不算" : "—";
  }
  const result = document.getElementById("attend-result");
  if (result) result.innerHTML = attendResultInner(iso);
}
function attendPageHtml() {
  const iso = attendActiveIso();
  const today = attendTodayIso();
  const savedDays = new Set(Object.keys(attendBag()));
  const { y, m, cells } = attendMonthCells(iso);
  const st = attendStats(iso);
  const week = ["一", "二", "三", "四", "五", "六", "日"].map((name) => `<span>${name}</span>`).join("");
  const days = cells
    .map((date) => {
      if (date == null) return "<span></span>";
      const cellIso = `${y}-${String(m).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
      const cls = ["attend-day", cellIso === today ? "is-today" : "", cellIso !== today && savedDays.has(cellIso) ? "is-marked" : "", cellIso === iso ? "is-sel" : ""]
        .filter(Boolean)
        .join(" ");
      return `<button type="button" class="${cls}" data-attend-day="${cellIso}">${date}</button>`;
    })
    .join("");
  const pills = (group) =>
    st.people
      .filter((p) => p.group === group)
      .map(
        (p) =>
          `<button type="button" class="attend-pill${p.on ? " is-on" : ""}" data-attend-toggle="on" data-attend-id="${esc(p.id)}">${esc(p.name)}</button>`,
      )
      .join("");
  const workerRows = st.people
    .filter((p) => p.group === "雅芳工人")
    .map((p) => {
      const h = attendWorkerHours(p);
      const dis = p.on ? "" : " disabled";
      return `<div class="attend-row">
        <div class="attend-worker-name"><label><input type="checkbox" data-attend-toggle="on" data-attend-id="${esc(p.id)}"${p.on ? " checked" : ""}> <b>${esc(p.name)}</b></label></div>
        <div class="attend-start"><span class="attend-mini">上班</span><input class="attend-in" data-attend-field="start" data-attend-id="${esc(p.id)}" value="${esc(p.start)}" placeholder="開始"${dis}>${p.split ? `<input class="attend-in" data-attend-field="start2" data-attend-id="${esc(p.id)}" value="${esc(p.start2)}" placeholder="下午"${dis}>` : ""}</div>
        <div class="attend-end"><span class="attend-mini">下班</span><input class="attend-in" data-attend-field="end" data-attend-id="${esc(p.id)}" value="${esc(p.end)}" placeholder="結束"${dis}>${p.split ? `<input class="attend-in" data-attend-field="end2" data-attend-id="${esc(p.id)}" value="${esc(p.end2)}" placeholder="下午"${dis}>` : ""}</div>
        <div class="attend-rest"><span class="attend-mini">休息</span><input class="attend-in" data-attend-field="rest" data-attend-id="${esc(p.id)}" value="${p.split ? "" : esc(p.rest)}" placeholder="${p.split ? "—" : "分"}"${!p.on || p.split ? " disabled" : ""}></div>
        <div class="attend-hours"><span class="attend-mini">時數</span><b data-hours-for="${esc(p.id)}">${!p.on || h == null ? "—" : h}</b></div>
        <label class="attend-check"><input type="checkbox" data-attend-toggle="nobento" data-attend-id="${esc(p.id)}"${p.on && p.noBento ? " checked" : ""}${dis}> 不加</label>
        <label class="attend-check attend-split">${p.on ? `<input type="checkbox" data-attend-toggle="split" data-attend-id="${esc(p.id)}"${p.split ? " checked" : ""}> 分段` : "—"}</label>
      </div>`;
    })
    .join("");
  const crewRows = st.crews
    .map((c) => {
      const cross = !c.off && attendCross(c.start, c.end);
      const hours = attendCrewHours(c);
      const n = attendWhole(c.people);
      const bento = c.off ? "—" : attendBentoStart(c.start) ? "算" : n > 0 ? "不算" : "—";
      const dis = c.off ? " disabled" : "";
      return `<div class="attend-crew">
        <b class="attend-crew-name">${esc(c.boss)}</b>
        <label>預計<input class="attend-in" data-attend-field="plan" data-attend-crew="${esc(c.id)}" value="${esc(c.plan)}" inputmode="numeric"${dis}></label>
        <label class="attend-check"><input type="checkbox" data-attend-toggle="off" data-attend-crew="${esc(c.id)}"${c.off ? " checked" : ""}> 休</label>
        <label>人數<input class="attend-in" data-attend-field="people" data-attend-crew="${esc(c.id)}" value="${esc(c.people)}" inputmode="numeric"${dis}></label>
        <label>開始<input class="attend-in" data-attend-field="cstart" data-attend-crew="${esc(c.id)}" value="${esc(c.start)}" placeholder="13"${dis}></label>
        <label>結束<input class="attend-in" data-attend-field="cend" data-attend-crew="${esc(c.id)}" value="${esc(c.end)}" placeholder="18:30"${dis}></label>
        <label>休息<input class="attend-in" data-attend-field="crest" data-attend-crew="${esc(c.id)}" value="${cross ? esc(c.rest) : ""}" placeholder="${cross ? "60" : "—"}"${cross ? "" : " disabled"}></label>
        <span class="attend-crew-hours">時數 <b data-crew-hours="${esc(c.id)}">${c.off || hours == null ? "—" : hours}</b></span>
        <span class="attend-crew-bento">便當 <b data-crew-bento="${esc(c.id)}">${bento}</b></span>
      </div>`;
    })
    .join("");
  return `<div class="attend-page" data-attend-root data-attend-day="${iso}">
    <div class="attend-layout">
      <div class="attend-form">
        <div class="attend-top">
          <div>
            <p class="attend-kicker">日期</p>
            <p class="attend-date">${esc(iso)}</p>
            <div class="attend-cal-nav">
              <button type="button" class="ghost" data-attend-month="-1">上一月</button>
              <span>${y}年${m}月</span>
              <button type="button" class="ghost" data-attend-month="1">下一月</button>
            </div>
            <div class="attend-cal">${week}${days}</div>
            <p class="attend-note">藍圈是今天。綠圈是已登記。</p>
          </div>
          <div class="attend-groups">
            <div><p class="attend-kicker">辦公室</p><div class="attend-pills">${pills("辦公室")}</div></div>
            <div><p class="attend-kicker">司機</p><div class="attend-pills">${pills("司機")}</div></div>
          </div>
        </div>
        <section class="attend-block">
          <h3>雅芳工人</h3>
          <p class="attend-note">平常填一組時間。偶爾要分段，勾最右邊的分段。</p>
          <div class="attend-head"><span>工人</span><span>上班</span><span>下班</span><span>休息</span><span>時數</span><span>便當</span><span>分段</span></div>
          ${workerRows}
        </section>
        <section class="attend-block">
          <h3>外調</h3>
          <p class="attend-note">人數、開始、結束。跨中午才填休息，時數自動算。</p>
          ${crewRows}
        </section>
      </div>
      <aside class="attend-result" id="attend-result">${attendResultInner(iso)}</aside>
    </div>
  </div>`;
}
function attendToggle(iso, kind, id, crewId, checked) {
  const rec = attendEnsure(iso);
  if (crewId) {
    const base = attendCrew(iso, ATTEND_CREWS.find((c) => c.id === crewId) || { id: crewId });
    if (kind === "off") base.off = checked;
    rec.crews[crewId] = base;
  } else if (id) {
    const person = ATTEND_ROSTER.find((p) => p.id === id);
    const base = attendFixed(iso, person || { id });
    if (kind === "on") base.on = checked;
    if (kind === "split") base.split = checked;
    if (kind === "nobento") base.noBento = checked;
    rec.fixed[id] = base;
  }
  save();
  renderHomeHub();
}
function attendField(iso, field, id, crewId, value) {
  const rec = attendEnsure(iso);
  if (field === "extra") rec.extra = value;
  else if (crewId) {
    const base = attendCrew(iso, ATTEND_CREWS.find((c) => c.id === crewId) || { id: crewId });
    if (field === "plan") base.plan = value;
    if (field === "people") base.people = value;
    if (field === "cstart") base.start = value;
    if (field === "cend") base.end = value;
    if (field === "crest") base.rest = value;
    rec.crews[crewId] = base;
  } else if (id) {
    const person = ATTEND_ROSTER.find((p) => p.id === id);
    const base = attendFixed(iso, person || { id });
    if (field === "start" || field === "end" || field === "start2" || field === "end2" || field === "rest") base[field] = value;
    rec.fixed[id] = base;
  }
  save();
  attendRefresh(iso);
}

let billBoss = "wu";
let billMonth = "2026-09";
const BILL_SEP_WU = [
  ["9/6 13.5-18", "2人", "800", "1600", ""],
  ["9/7 13-18", "2人", "900", "1800", ""],
  ["9/8、9/9休", "", "", "", ""],
  ["9/21 13-18", "2人", "900", "1800", ""],
  ["9/22 13-17.5", "2人", "800", "1600", ""],
  ["9/23 13-17.5", "2人", "800", "1600", ""],
  ["9/24 13-18", "2人", "900", "1800", ""],
  ["9/25休", "", "", "", ""],
  ["9/26 13-18", "2人", "900", "1800", ""],
  ["9/27休", "", "", "", ""],
  ["9/28 13-18", "2人", "900", "1800", ""],
  ["9/29 13-18", "2人", "900", "1800", ""],
  ["9/30 13-18", "2人", "900", "1800", ""],
];

function attendSlipClock(raw) {
  const mins = attendClock(raw);
  if (mins == null) return "";
  const h = Math.floor(mins / 60);
  const min = mins % 60;
  if (min === 0) return String(h);
  if (min === 30) return String(h + 0.5).replace(".0", "");
  return `${h}:${String(min).padStart(2, "0")}`;
}
function attendBillMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return "";
  return String(Math.round(v));
}
function attendBillLive(bossId, ym) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const days = [];
  for (let d = 1; d <= last; d += 1) {
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const saved = attendBag()[iso]?.crews?.[bossId];
    if (!saved || typeof saved !== "object") continue;
    const off = !!saved.off;
    const n = attendWhole(saved.people);
    const hasTime = String(saved.start || "").trim() || String(saved.end || "").trim();
    if (!off && n <= 0 && !hasTime) continue;
    days.push({ iso, d, off: off || n <= 0, n, start: saved.start || "", end: saved.end || "", price: saved.price || "", note: saved.note || "" });
  }
  const rows = [];
  let rest = [];
  const flush = () => {
    if (!rest.length) return;
    rows.push({ kind: "off", label: `${rest.map((x) => `${m}/${x.d}`).join("、")}休`, qty: "", price: "", amt: "", note: "", iso: "" });
    rest = [];
  };
  for (const day of days) {
    if (day.off) {
      rest.push(day);
      continue;
    }
    flush();
    const a = attendSlipClock(day.start);
    const b = attendSlipClock(day.end);
    const range = a && b ? ` ${a}-${b}` : "";
    const priceNum = Number(day.price);
    const amt = day.price !== "" && Number.isFinite(priceNum) ? day.n * priceNum : "";
    rows.push({
      kind: "work",
      iso: day.iso,
      label: `${m}/${day.d}${range}`,
      qty: `${day.n}人`,
      price: day.price,
      amt,
      note: day.note,
    });
  }
  flush();
  return rows;
}
function attendBillExampleRows() {
  return BILL_SEP_WU.map(([label, qty, price, amt]) => ({ kind: price ? "work" : "off", label, qty, price, amt, note: "", iso: "" }));
}
function attendBillTable(rows, crewId, editable) {
  const body = rows
    .map((row) => {
      const priceCell = editable && row.kind === "work"
        ? `<input class="attend-in bill-price" data-bill-price="1" data-bill-day="${esc(row.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(String(row.price || ""))}" inputmode="numeric">`
        : esc(String(row.price || ""));
      const amt = row.amt === "" || row.amt == null ? "" : attendBillMoney(row.amt);
      return `<tr>
        <td>${esc(row.label)}</td>
        <td>${esc(row.qty || "")}</td>
        <td>${priceCell}</td>
        <td data-bill-amt="${esc(row.iso || "")}">${esc(amt)}</td>
        <td>${esc(row.note || "")}</td>
      </tr>`;
    })
    .join("");
  const total = rows.reduce((sum, row) => sum + (Number(row.amt) || 0), 0);
  return `<table class="bill-sheet">
    <thead><tr><th>品名</th><th>數量</th><th>單價</th><th>金額</th><th>備註</th></tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr><td colspan="3">合計</td><td id="bill-total">${total ? attendBillMoney(total) : ""}</td><td></td></tr></tfoot>
  </table>`;
}
function attendBillHtml() {
  const boss = ATTEND_CREWS.some((c) => c.id === billBoss) ? billBoss : "wu";
  billBoss = boss;
  if (!/^\d{4}-\d{2}$/.test(billMonth)) billMonth = "2026-09";
  const [y, m] = billMonth.split("-").map(Number);
  const live = attendBillLive(boss, billMonth);
  const example = boss === "wu" && billMonth === "2026-09" && !live.length;
  const rows = example ? attendBillExampleRows() : live;
  const bossOpts = ATTEND_CREWS.map((c) => `<option value="${esc(c.id)}"${c.id === boss ? " selected" : ""}>${esc(c.boss)}</option>`).join("");
  const monthOpts = [7, 8, 9, 10, 11, 12]
    .map((mm) => {
      const value = `2026-${String(mm).padStart(2, "0")}`;
      return `<option value="${value}"${value === billMonth ? " selected" : ""}>${2026 - 1911}年${mm}月</option>`;
    })
    .join("");
  const note = example
    ? "這張是 115年9月 吳幸蓉的手寫單。每日到班有登記後，人數和時段改由到班帶出，單價在這頁填。"
    : live.length
      ? "人數和時段來自每日到班。單價在這頁填，金額＝人數×單價。連續休假併成一列。"
      : "這個月還沒有這位老闆的到班紀錄。請先到每日到班填人數、時間，或勾休。";
  return `<section class="bill-page">
    <h2>調工帳務</h2>
    <p class="attend-note">${esc(note)}</p>
    <div class="bill-filters">
      <label>老闆 <select data-bill-boss>${bossOpts}</select></label>
      <label>月份 <select data-bill-month>${monthOpts}</select></label>
    </div>
    <p class="bill-title">${y - 1911}年${m}月　${esc(ATTEND_CREWS.find((c) => c.id === boss)?.boss || "")}</p>
    ${rows.length ? attendBillTable(rows, boss, !example) : `<table class="bill-sheet"><thead><tr><th>品名</th><th>數量</th><th>單價</th><th>金額</th><th>備註</th></tr></thead><tbody></tbody></table>`}
  </section>`;
}
function attendBillSetPrice(iso, crewId, price) {
  const rec = attendEnsure(iso);
  const crew = ATTEND_CREWS.find((c) => c.id === crewId) || { id: crewId };
  const base = attendCrew(iso, crew);
  base.price = price;
  rec.crews[crewId] = base;
  save();
  const n = attendWhole(base.people);
  const priceNum = Number(price);
  const amt = price !== "" && Number.isFinite(priceNum) ? n * priceNum : "";
  const cell = document.querySelector(`[data-bill-amt="${CSS.escape(iso)}"]`);
  if (cell) cell.textContent = amt === "" ? "" : attendBillMoney(amt);
  const total = attendBillLive(crewId, String(iso).slice(0, 7)).reduce((sum, row) => sum + (Number(row.amt) || 0), 0);
  const totalEl = document.getElementById("bill-total");
  if (totalEl) totalEl.textContent = total ? attendBillMoney(total) : "";
}
function attendBillPick(kind, value) {
  if (kind === "boss") billBoss = value;
  if (kind === "month") billMonth = value;
  renderHomeHub();
}
