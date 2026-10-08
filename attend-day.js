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
const attendOpen = new Set();

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
    showHours: false,
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
  const crewLines = st.crews
    .filter((c) => !c.off && (attendWhole(c.people) > 0 || attendWhole(c.plan) > 0))
    .map((c) => {
      const n = attendWhole(c.people);
      const plan = attendWhole(c.plan);
      if (n > 0) {
        const hour = attendSlipClock(c.start);
        return `${esc(c.boss)}　${n}人${hour ? `　${esc(hour)}點` : ""}`;
      }
      return `${esc(c.boss)}　預計${plan}人`;
    });
  const [, mm, dd] = iso.split("-");
  const nameHtml = lines
    .map((row) => `<div class="attend-name-row"><b>${esc(row.label)}</b><span class="attend-names">${row.names.map((n) => `<span>${esc(n)}</span>`).join("")}</span></div>`)
    .join("");
  const crewHtml = crewLines.length ? `<div class="attend-name-row"><b>外調</b><span>${crewLines.join("<br>")}</span></div>` : "";
  return `<p class="attend-result-kicker">當天結果</p>
    <p class="attend-result-line"><span>${Number(mm)}/${Number(dd)}</span><span>出席 ${st.present.length}</span><span>外調 ${st.crewActual}</span><span>預計 ${st.crewPlan}</span></p>
    <div class="attend-name-list">${nameHtml}${crewHtml}</div>
    <p class="attend-bento-num">${st.bento}</p>
    <p class="attend-bento-lab">今天便當</p>
    <p class="attend-bento-math"><span>固定 ${st.present.length}</span><span>− 不加 ${st.noBento}</span><span>＋ 12點前到 ${st.crewBento}</span><span>＋ 額外 ${st.extraN}</span></p>
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
  const foldBtn = (key) => {
    const open = attendOpen.has(key);
    return `<button type="button" class="attend-fold-btn" data-attend-fold-btn="${esc(key)}">${open ? "收合" : "展開"}</button>`;
  };
  const workerRows = st.people
    .filter((p) => p.group === "雅芳工人")
    .map((p) => {
      const h = attendWorkerHours(p);
      const dis = p.on ? "" : " disabled";
      const key = `worker:${p.id}`;
      const sum = !p.on ? "未到" : p.start && p.end ? `${p.start}–${p.end}` : p.start || p.end || "";
      return `<div class="attend-fold${attendOpen.has(key) ? " is-open" : ""}" data-attend-fold="${esc(key)}">
        <div class="attend-fold-head">
          <label class="attend-worker-name"><input type="checkbox" data-attend-toggle="on" data-attend-id="${esc(p.id)}"${p.on ? " checked" : ""}> <b>${esc(p.name)}</b></label>
          <span class="attend-fold-sum">${esc(sum)}</span>
          ${foldBtn(key)}
        </div>
        <div class="attend-row attend-fold-body">
        <div class="attend-worker-name"><label><input type="checkbox" data-attend-toggle="on" data-attend-id="${esc(p.id)}"${p.on ? " checked" : ""}> <b>${esc(p.name)}</b></label></div>
        <div class="attend-start"><span class="attend-mini">上班</span><input class="attend-in" data-attend-field="start" data-attend-id="${esc(p.id)}" value="${esc(p.start)}" placeholder="開始"${dis}>${p.split ? `<input class="attend-in" data-attend-field="start2" data-attend-id="${esc(p.id)}" value="${esc(p.start2)}" placeholder="下午"${dis}>` : ""}</div>
        <div class="attend-end"><span class="attend-mini">下班</span><input class="attend-in" data-attend-field="end" data-attend-id="${esc(p.id)}" value="${esc(p.end)}" placeholder="結束"${dis}>${p.split ? `<input class="attend-in" data-attend-field="end2" data-attend-id="${esc(p.id)}" value="${esc(p.end2)}" placeholder="下午"${dis}>` : ""}</div>
        <div class="attend-rest"><span class="attend-mini">休息</span><input class="attend-in" data-attend-field="rest" data-attend-id="${esc(p.id)}" value="${p.split ? "" : esc(p.rest)}" placeholder="${p.split ? "—" : "分"}"${!p.on || p.split ? " disabled" : ""}></div>
        <div class="attend-hours"><span class="attend-mini">時數</span><b data-hours-for="${esc(p.id)}">${!p.on || h == null ? "—" : h}</b></div>
        <label class="attend-check"><input type="checkbox" data-attend-toggle="nobento" data-attend-id="${esc(p.id)}"${p.on && p.noBento ? " checked" : ""}${dis}> 不加</label>
        <label class="attend-check attend-split">${p.on ? `<input type="checkbox" data-attend-toggle="split" data-attend-id="${esc(p.id)}"${p.split ? " checked" : ""}> 分段` : "—"}</label>
        </div>
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
      const key = `crew:${c.id}`;
      const bits = [];
      if (c.off) bits.push("休");
      else {
        if (n) bits.push(`${n}人`);
        else if (attendWhole(c.plan)) bits.push(`預計${attendWhole(c.plan)}人`);
        if (c.start && c.end) bits.push(`${c.start}–${c.end}`);
        else if (c.start || c.end) bits.push(c.start || c.end);
      }
      return `<div class="attend-fold${attendOpen.has(key) ? " is-open" : ""}" data-attend-fold="${esc(key)}">
        <div class="attend-fold-head">
          <b>${esc(c.boss)}</b>
          <span class="attend-fold-sum">${esc(bits.join(" "))}</span>
          ${foldBtn(key)}
        </div>
        <div class="attend-crew attend-fold-body">
        <b class="attend-crew-name">${esc(c.boss)}</b>
        <label>預計<input class="attend-in" data-attend-field="plan" data-attend-crew="${esc(c.id)}" value="${esc(c.plan)}" inputmode="numeric"${dis}></label>
        <label class="attend-check"><input type="checkbox" data-attend-toggle="off" data-attend-crew="${esc(c.id)}"${c.off ? " checked" : ""}> 休</label>
        <label>人數<input class="attend-in" data-attend-field="people" data-attend-crew="${esc(c.id)}" value="${esc(c.people)}" inputmode="numeric"${dis}></label>
        <label>開始<input class="attend-in" data-attend-field="cstart" data-attend-crew="${esc(c.id)}" value="${esc(c.start)}" placeholder="13"${dis}></label>
        <label>結束<input class="attend-in" data-attend-field="cend" data-attend-crew="${esc(c.id)}" value="${esc(c.end)}" placeholder="18:30"${dis}></label>
        <label>休息<input class="attend-in" data-attend-field="crest" data-attend-crew="${esc(c.id)}" value="${cross ? esc(c.rest) : ""}" placeholder="${cross ? "60" : "—"}"${cross ? "" : " disabled"}></label>
        <span class="attend-crew-hours">時數 <b data-crew-hours="${esc(c.id)}">${c.off || hours == null ? "—" : hours}</b></span>
        <span class="attend-crew-bento">便當 <b data-crew-bento="${esc(c.id)}">${bento}</b></span>
        </div>
      </div>`;
    })
    .join("");
  return `<div class="attend-page" data-attend-root data-attend-day="${iso}">
    <div class="attend-layout">
      <div class="attend-datebox">
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
      <aside class="attend-result" id="attend-result">${attendResultInner(iso)}</aside>
      <div class="attend-form">
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
          <p class="attend-note"><button type="button" class="people-jump" data-people-pane="labor-bill">填工時費用單</button>給調工老闆的清單在這裡填單價。</p>
        </section>
      </div>
    </div>
  </div>`;
}
function attendFold(key) {
  const open = attendOpen.has(key);
  if (open) attendOpen.delete(key);
  else attendOpen.add(key);
  const box = document.querySelector(`[data-attend-fold="${CSS.escape(key)}"]`);
  if (!box) return;
  box.classList.toggle("is-open", !open);
  const btn = box.querySelector("[data-attend-fold-btn]");
  if (btn) btn.textContent = open ? "展開" : "收合";
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
let billMonth = "";
let billDay = "";
let billFrom = "";
let billTo = "";
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

function attendBillWhen(raw) {
  const mins = attendClock(raw);
  if (mins == null) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
function attendBillDateLabel(month, day, start, end) {
  const a = attendBillWhen(start);
  const b = attendBillWhen(end);
  const date = `${month}/${day}`;
  if (a && b) return `${date}\u00a0${a}-${b}`;
  return date;
}
function attendSlipClock(raw) {
  const mins = attendClock(raw);
  if (mins == null) return "";
  const h = Math.floor(mins / 60);
  const min = mins % 60;
  if (min === 0) return String(h);
  if (min === 30) return String(h + 0.5).replace(".0", "");
  return `${h}:${String(min).padStart(2, "0")}`;
}
function attendBillHoursText(crew) {
  if (!crew || crew.off) return "";
  const h = attendCrewHours(crew);
  return h == null ? "" : String(h);
}
function attendBillEstimate(crew) {
  if (!crew || crew.off) return "";
  const hours = attendCrewHours(crew);
  const wage = Number(crew.price);
  if (hours == null || String(crew.price || "").trim() === "" || !Number.isFinite(wage)) return "";
  return String(Math.round(hours * wage));
}
function attendBillAmount(crew) {
  if (!crew || crew.off) return "";
  const pay = Number(crew.pay);
  const n = attendWhole(crew.people);
  if (String(crew.pay || "").trim() === "" || !Number.isFinite(pay)) return "";
  return String(Math.round(n * pay));
}
function attendBillHoursNote(day) {
  if (!day || !day.showHours || day.off) return "";
  const n = attendWhole(day.people);
  const hours = day.hours === "" || day.hours == null ? null : Number(day.hours);
  if (!n || hours == null || !Number.isFinite(hours)) return "";
  const total = Math.round(n * hours * 10) / 10;
  return `${n}人*${hours}小時=${total}H`;
}
function attendBillSlipNote(day) {
  return [attendBillHoursNote(day), String(day.note || "").trim()].filter(Boolean).join(" ");
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
    days.push({ iso, d, off: off || n <= 0, n, start: saved.start || "", end: saved.end || "", price: saved.price || "", pay: saved.pay || "", note: saved.note || "" });
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
    const payNum = Number(day.pay);
    const amt = String(day.pay || "").trim() !== "" && Number.isFinite(payNum) ? day.n * payNum : "";
    rows.push({
      kind: "work",
      iso: day.iso,
      label: attendBillDateLabel(m, day.d, day.start, day.end),
      qty: `${day.n}人`,
      price: day.pay,
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
    <thead><tr><th>日期</th><th>數量</th><th>單價</th><th>金額</th><th>備註</th></tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr><td colspan="3">合計</td><td>${total ? attendBillMoney(total) : ""}</td><td></td></tr></tfoot>
  </table>`;
}
function attendBillMonthNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function attendBillDays(bossId, ym) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const days = [];
  for (let d = 1; d <= last; d += 1) {
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const saved = attendBag()[iso]?.crews?.[bossId];
    const crew = saved && typeof saved === "object" ? saved : {};
    const people = crew.people || "";
    const start = crew.start || "";
    const end = crew.end || "";
    const price = crew.price || "";
    const pay = crew.pay || "";
    const rest = crew.rest || "";
    const off = !!crew.off;
    const showHours = !!crew.showHours;
    const n = attendWhole(people);
    const shaped = { off, people, start, end, rest, price, pay };
    const amt = attendBillAmount(shaped);
    const touched = off || String(people).trim() || String(start).trim() || String(end).trim() || String(price).trim() || String(pay).trim();
    days.push({ iso, d, m, off, showHours, people, start, end, rest, price, pay, note: crew.note || "", n, amt, hours: attendBillHoursText(shaped), estimate: attendBillEstimate(shaped), touched });
  }
  return days;
}
function attendBillFocus(days) {
  if (days.some((day) => day.iso === billDay)) return billDay;
  const today = attendTodayIso();
  if (days.some((day) => day.iso === today)) return today;
  return (days.find((day) => day.touched) || days[0] || {}).iso || "";
}
function attendBillCal(days, ym, focus) {
  const marked = new Set(days.filter((day) => day.touched).map((day) => day.iso));
  const { y, m, cells } = attendMonthCells(`${ym}-01`);
  const week = ["一", "二", "三", "四", "五", "六", "日"].map((name) => `<span>${name}</span>`).join("");
  const buttons = cells
    .map((date) => {
      if (date == null) return "<span></span>";
      const iso = `${y}-${String(m).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
      const cls = ["bill-cal-day", marked.has(iso) ? "is-on" : "", iso === focus ? "is-sel" : ""].filter(Boolean).join(" ");
      return `<button type="button" class="${cls}" data-bill-pick="${esc(iso)}">${date}</button>`;
    })
    .join("");
  return `<div class="bill-cal"><div class="bill-cal-grid">${week}${buttons}</div><p class="attend-note">有填的日子反色。點一天填這一筆。</p></div>`;
}
function attendBillForm(days, crewId, opts) {
  const lines = days
    .map((day) => {
      const amt = day.amt === "" ? "" : attendBillMoney(day.amt);
      const cross = !day.off && attendCross(day.start, day.end);
      return `<div class="bill-line${day.off ? " is-off" : ""}" data-bill-row="${esc(day.iso)}">
        <b>${day.m}/${day.d}</b>
        <label class="bill-people"><span class="bill-mini">人數</span><input class="attend-in" data-bill-field="people" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(String(day.people))}" inputmode="numeric"></label>
        <label class="bill-start"><span class="bill-mini">開始</span><input class="attend-in" data-bill-field="start" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(String(day.start))}"></label>
        <label class="bill-end"><span class="bill-mini">結束</span><input class="attend-in" data-bill-field="end" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(String(day.end))}"></label>
        <label class="bill-rest"><span class="bill-mini">午休</span><input class="attend-in" data-bill-field="rest" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${cross ? esc(String(day.rest)) : ""}" placeholder="${cross ? "60" : "—"}" inputmode="numeric"${cross ? "" : " disabled"}></label>
        <span class="bill-hours"><span class="bill-mini">時數</span><b class="bill-hours-num" data-bill-hours="${esc(day.iso)}">${esc(day.hours)}</b></span>
        <label class="bill-price"><span class="bill-mini">時薪</span><input class="attend-in" data-bill-field="price" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(String(day.price))}" inputmode="numeric"></label>
        <span class="bill-estimate"><span class="bill-mini">預計</span><b class="bill-estimate-num" data-bill-estimate="${esc(day.iso)}">${esc(day.estimate)}</b></span>
        <label class="bill-pay"><span class="bill-mini">實發</span><input class="attend-in" data-bill-field="pay" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(String(day.pay))}" inputmode="numeric"></label>
        <span class="bill-amt" data-bill-amt="${esc(day.iso)}"><span class="bill-mini">金額</span><b class="bill-amt-num">${esc(amt)}</b></span>
        <label class="bill-off"><input type="checkbox" data-bill-off="1" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}"${day.off ? " checked" : ""}>休</label>
        <div class="bill-note">
          <span class="bill-mini">備註</span>
          <input class="attend-in" data-bill-field="note" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(String(day.note))}">
          <label class="bill-show-hours"><input type="checkbox" data-bill-show-hours="1" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}"${day.showHours ? " checked" : ""}>工時</label>
          <span class="bill-hours-note" data-bill-hours-note="${esc(day.iso)}">${esc(attendBillHoursNote(day))}</span>
        </div>
      </div>`;
    })
    .join("");
  const total = days.reduce((sum, day) => sum + (Number(day.amt) || 0), 0);
  const foot = opts && opts.foot === false ? "" : `<div class="bill-foot"><span>合計</span><b id="bill-total">${total ? attendBillMoney(total) : ""}</b></div>`;
  return `<div class="bill-form">
    <div class="bill-head"><span>日期</span><span>人數</span><span>開始</span><span>結束</span><span>午休</span><span>時數</span><span>時薪</span><span>預計</span><span>實發</span><span>金額</span><span>休</span><span>備註</span></div>
    ${lines}
    ${foot}
  </div>`;
}
function attendBillBossName() {
  return ATTEND_CREWS.find((c) => c.id === billBoss)?.boss || "";
}
function attendBillRangeDays(days) {
  if (!days.length) return [];
  const isos = days.map((day) => day.iso);
  if (!isos.includes(billFrom)) billFrom = isos[0];
  if (!isos.includes(billTo)) billTo = isos[isos.length - 1];
  const a = billFrom < billTo ? billFrom : billTo;
  const b = billFrom < billTo ? billTo : billFrom;
  return days.filter((day) => day.iso >= a && day.iso <= b);
}
function attendBillRangeLabel(span) {
  if (!span.length) return "";
  const a = span[0];
  const b = span[span.length - 1];
  const left = `${a.m}/${a.d}`;
  const right = `${b.m}/${b.d}`;
  return left === right ? left : `${left}–${right}`;
}
function attendBillShareTitle(span) {
  const [y, m] = String(billMonth || "").split("-").map(Number);
  const who = attendBillBossName();
  const label = attendBillRangeLabel(span);
  return `${y - 1911}年${m}月　${who}${label ? "　" + label : ""}`;
}
function attendBillCurrentPack() {
  const days = attendBillDays(billBoss, billMonth);
  const span = attendBillRangeDays(days);
  return { span, rows: attendBillLiveRows(span), title: attendBillShareTitle(span) };
}
function attendBillPreview(days) {
  const span = attendBillRangeDays(days);
  const rows = attendBillLiveRows(span);
  const opt = (selected) =>
    days.map((day) => `<option value="${esc(day.iso)}"${day.iso === selected ? " selected" : ""}>${day.m}/${day.d}</option>`).join("");
  const table = rows.length ? attendBillTable(rows, "", false) : `<p class="attend-note">這段沒有已填的日子。</p>`;
  return `<h3>給老闆的清單</h3>
    <div class="bill-share">
      <label>從<select data-bill-from>${opt(billFrom)}</select></label>
      <label>到<select data-bill-to>${opt(billTo)}</select></label>
      <button type="button" class="primary" data-bill-copy>複製圖片貼 LINE</button>
      <button type="button" class="ghost" data-bill-pdf>列印 PDF</button>
    </div>
    <p class="attend-note">選好起迄日。複製的是圖片，可直接貼到 LINE。列印時選另存 PDF。</p>
    ${table}`;
}
function attendFitText(ctx, text, max) {
  const raw = String(text || "");
  if (ctx.measureText(raw).width <= max) return raw;
  let out = raw;
  while (out && ctx.measureText(`${out}…`).width > max) out = out.slice(0, -1);
  return `${out}…`;
}
function attendBillPngBlob(title, rows) {
  const head = ["日期", "數量", "單價", "金額", "備註"];
  const body = rows.map((row) => [
    row.label || "",
    row.qty || "",
    row.price === "" || row.price == null ? "" : String(row.price),
    row.amt === "" || row.amt == null ? "" : attendBillMoney(row.amt),
    row.note || "",
  ]);
  const total = rows.reduce((sum, row) => sum + (Number(row.amt) || 0), 0);
  body.push(["合計", "", "", total ? attendBillMoney(total) : "", ""]);
  const font = '"Microsoft JhengHei","Noto Sans TC",sans-serif';
  const size = 16;
  const padX = 14;
  const rowH = 36;
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = `700 ${size}px ${font}`;
  const mins = [168, 72, 72, 88, 88];
  const maxs = [420, 140, 140, 160, 240];
  const cols = head.map((lab, i) => {
    let w = measure.measureText(lab).width + padX * 2;
    body.forEach((cells) => {
      const tw = measure.measureText(String(cells[i] || "")).width + padX * 2;
      if (tw > w) w = tw;
    });
    return Math.min(maxs[i], Math.max(mins[i], Math.ceil(w)));
  });
  const width = cols.reduce((sum, w) => sum + w, 0) + 2;
  const titleH = 52;
  const height = titleH + rowH * (1 + body.length) + 2;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#163024";
  ctx.font = `700 20px ${font}`;
  ctx.textBaseline = "middle";
  ctx.fillText(title, 14, titleH / 2);
  const paintRow = (cells, y, strong) => {
    if (strong) {
      ctx.fillStyle = "#f4f7f4";
      ctx.fillRect(1, y, width - 2, rowH);
    }
    ctx.font = `${strong ? 700 : 500} ${size}px ${font}`;
    ctx.fillStyle = "#163024";
    let x = 1;
    cells.forEach((text, i) => {
      ctx.fillText(attendFitText(ctx, text, cols[i] - padX * 2), x + padX, y + rowH / 2);
      x += cols[i];
    });
    ctx.strokeStyle = "#d5ddd6";
    ctx.strokeRect(0.5, y + 0.5, width - 1, rowH);
  };
  paintRow(head, titleH, true);
  body.forEach((cells, i) => paintRow(cells, titleH + rowH * (i + 1), i === body.length - 1));
  ctx.strokeStyle = "#d5ddd6";
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
async function attendBillCopyImage() {
  const pack = attendBillCurrentPack();
  if (!pack.rows.length) {
    setStatus("這段沒有已填的日子。", true);
    return;
  }
  setStatus("正在做成圖片…");
  const blob = await attendBillPngBlob(pack.title, pack.rows);
  if (!blob) {
    setStatus("做成圖片失敗。", true);
    return;
  }
  try {
    if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus("區間清單已複製成圖片，可直接貼到 LINE。");
      return;
    }
  } catch (_) {}
  const file = new File([blob], `${pack.title.replace(/[\\/:*?"<>|\s\u3000]+/g, "_")}.png`, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: pack.title });
      setStatus("已打開分享，請選 LINE 傳送圖片。");
      return;
    } catch (err) {
      if (err && err.name === "AbortError") {
        setStatus("");
        return;
      }
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  setStatus("這台不能直接貼圖，已存成圖片檔，請傳到 LINE。");
}
function attendBillPrintPdf() {
  const pack = attendBillCurrentPack();
  if (!pack.rows.length) {
    setStatus("這段沒有已填的日子。", true);
    return;
  }
  const body = pack.rows
    .map((row) => {
      const amt = row.amt === "" || row.amt == null ? "" : attendBillMoney(row.amt);
      return `<tr><td>${esc(row.label)}</td><td>${esc(row.qty || "")}</td><td>${esc(String(row.price || ""))}</td><td>${esc(amt)}</td><td>${esc(row.note || "")}</td></tr>`;
    })
    .join("");
  const total = pack.rows.reduce((sum, row) => sum + (Number(row.amt) || 0), 0);
  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>${esc(pack.title)}</title>
    <style>
      body{font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;color:#163024;margin:16px;font-size:13px}
      h1{font-size:18px;margin:0 0 10px}
      table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #bbb;padding:6px 8px;text-align:left}
      th{background:#f4f7f4}
      tfoot td{font-weight:700}
    </style></head><body>
    <h1>${esc(pack.title)}</h1>
    <table><thead><tr><th>日期</th><th>數量</th><th>單價</th><th>金額</th><th>備註</th></tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr><td colspan="3">合計</td><td>${total ? attendBillMoney(total) : ""}</td><td></td></tr></tfoot></table>
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) {
    setStatus("瀏覽器擋了新視窗。請允許彈出後再列印，列印時選「另存 PDF」。", true);
    return;
  }
  w.document.write(html);
  w.document.close();
  setStatus("請在列印視窗選「另存 PDF」。");
}
function attendBillRange(kind, iso) {
  if (kind === "from") billFrom = iso;
  if (kind === "to") billTo = iso;
  const preview = document.getElementById("bill-preview");
  if (!preview) return;
  preview.innerHTML = attendBillPreview(attendBillDays(billBoss, billMonth));
}
function attendBillLiveRows(days) {
  const rows = [];
  let rest = [];
  const flush = () => {
    if (!rest.length) return;
    rows.push({ kind: "off", label: `${rest.map((x) => `${x.m}/${x.d}`).join("、")}休`, qty: "", price: "", amt: "", note: "", iso: "" });
    rest = [];
  };
  for (const day of days) {
    if (!day.touched) continue;
    if (day.off || day.n <= 0) {
      rest.push(day);
      continue;
    }
    flush();
    rows.push({ kind: "work", iso: day.iso, label: attendBillDateLabel(day.m, day.d, day.start, day.end), qty: `${day.n}人`, price: day.pay, amt: day.amt, note: attendBillSlipNote(day) });
  }
  flush();
  return rows;
}
function attendBillHtml() {
  const boss = ATTEND_CREWS.some((c) => c.id === billBoss) ? billBoss : "wu";
  billBoss = boss;
  if (!/^\d{4}-\d{2}$/.test(billMonth)) billMonth = attendBillMonthNow();
  const [y, m] = billMonth.split("-").map(Number);
  const days = attendBillDays(boss, billMonth);
  const example = boss === "wu" && billMonth === "2026-09" && !days.some((day) => day.touched);
  const bossName = ATTEND_CREWS.find((c) => c.id === boss)?.boss || "";
  const bossOpts = ATTEND_CREWS.map((c) => `<option value="${esc(c.id)}"${c.id === boss ? " selected" : ""}>${esc(c.boss)}</option>`).join("");
  const year = new Date().getFullYear();
  const monthOpts = [7, 8, 9, 10, 11, 12]
    .map((mm) => {
      const value = `${year}-${String(mm).padStart(2, "0")}`;
      return `<option value="${value}"${value === billMonth ? " selected" : ""}>${year - 1911}年${mm}月</option>`;
    })
    .join("");
  const sample = example
    ? `<details class="bill-sample"><summary>115年9月手寫單對照，合計 17400</summary>${attendBillTable(attendBillExampleRows(), "", false)}</details>`
    : "";
  const focus = attendBillFocus(days);
  billDay = focus;
  const one = days.filter((day) => day.iso === focus);
  return `<section class="bill-page">
    <h2>工時費用單</h2>
    <p class="attend-note">人數和時間會記到每日到班。跨中午可填午休分鐘，空白扣 60 分，填 0 不扣。預計＝時數×時薪，是一人的估計。實發自己填，改時間不會蓋掉。金額＝實發×人數。</p>
    <div class="bill-filters">
      <label>老闆 <select data-bill-boss>${bossOpts}</select></label>
      <label>月份 <select data-bill-month>${monthOpts}</select></label>
    </div>
    <p class="bill-title">${y - 1911}年${m}月　${esc(bossName)}</p>
    ${attendBillCal(days, billMonth, focus)}
    <div class="bill-one">${attendBillForm(one, boss, { foot: false })}</div>
    <div class="bill-month">${attendBillForm(days, boss)}</div>
    <div id="bill-preview">${attendBillPreview(days)}</div>
    ${sample}
  </section>`;
}
function attendBillEdit(iso, crewId, field, value) {
  const rec = attendEnsure(iso);
  const crew = ATTEND_CREWS.find((c) => c.id === crewId) || { id: crewId };
  const base = attendCrew(iso, crew);
  if (field === "off") base.off = !!value;
  if (field === "showHours") base.showHours = !!value;
  if (field === "people" || field === "start" || field === "end" || field === "rest" || field === "price" || field === "pay" || field === "note") base[field] = value;
  rec.crews[crewId] = base;
  save();
  const amt = attendBillAmount(base);
  const cross = !base.off && attendCross(base.start, base.end);
  document.querySelectorAll(`[data-bill-row="${CSS.escape(iso)}"]`).forEach((row) => {
    row.classList.toggle("is-off", !!base.off);
    const cell = row.querySelector("[data-bill-amt] .bill-amt-num");
    if (cell) cell.textContent = amt === "" ? "" : attendBillMoney(amt);
    const hoursEl = row.querySelector("[data-bill-hours]");
    if (hoursEl) hoursEl.textContent = attendBillHoursText(base);
    const estimateEl = row.querySelector("[data-bill-estimate]");
    if (estimateEl) estimateEl.textContent = attendBillEstimate(base);
    const hoursNote = row.querySelector("[data-bill-hours-note]");
    if (hoursNote) hoursNote.textContent = attendBillHoursNote({ ...base, hours: attendBillHoursText(base) });
    const restIn = row.querySelector("[data-bill-field='rest']");
    if (restIn && document.activeElement !== restIn) {
      restIn.disabled = !cross;
      restIn.placeholder = cross ? "60" : "—";
      if (!cross) restIn.value = "";
    }
  });
  const touched = !!base.off || String(base.people || "").trim() || String(base.start || "").trim() || String(base.end || "").trim() || String(base.price || "").trim() || String(base.pay || "").trim();
  document.querySelectorAll(`[data-bill-pick="${CSS.escape(iso)}"]`).forEach((btn) => btn.classList.toggle("is-on", touched));
  const days = attendBillDays(crewId, String(iso).slice(0, 7));
  const total = days.reduce((sum, day) => sum + (Number(day.amt) || 0), 0);
  const totalEl = document.getElementById("bill-total");
  if (totalEl) totalEl.textContent = total ? attendBillMoney(total) : "";
  const preview = document.getElementById("bill-preview");
  if (preview) preview.innerHTML = attendBillPreview(days);
}
function attendBillPickDay(iso) {
  billDay = iso;
  renderHomeHub();
}
function attendBillPick(kind, value) {
  if (kind === "boss") billBoss = value;
  if (kind === "month") billMonth = value;
  renderHomeHub();
}
