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
const ATTEND_FIXED_FIELDS = ["on", "start", "end", "start2", "end2", "rest", "split", "noBento"];
const ATTEND_CREW_FIELDS = ["plan", "people", "start", "end", "rest", "place", "people2", "start2", "end2", "rest2", "place2", "people3", "start3", "end3", "rest3", "place3", "off", "showHours", "price", "pay", "pay2", "pay3", "note"];
function attendMark(rec, field) {
  if (!rec || !field) return rec;
  if (!rec.at || typeof rec.at !== "object" || Array.isArray(rec.at)) rec.at = {};
  rec.at[field] = Date.now();
  return rec;
}
let attendIso = "";
const attendOpen = new Set();
const attendExtra = new Set();

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
    people2: "",
    start2: "",
    end2: "",
    rest2: "",
    place: "",
    place2: "",
    people3: "",
    start3: "",
    end3: "",
    rest3: "",
    place3: "",
    off: false,
    showHours: false,
    price: "",
    pay: "",
    pay2: "",
    pay3: "",
    note: "",
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
function attendShiftHours(start, end, rest) {
  const span = attendSpan(start, end);
  if (span == null) return null;
  const net = span - attendRestMin(attendCross(start, end), rest) / 60;
  if (net < 0) return 0;
  return Math.round(net * 10) / 10;
}
function attendCrewHours(c) {
  if (!c || c.off) return null;
  return attendShiftHours(c.start, c.end, c.rest);
}
function attendCrewGroups(c) {
  if (!c || c.off) return [];
  const groups = [];
  for (const slot of ["", "2", "3"]) {
    const start = c[slot ? `start${slot}` : "start"] || "";
    const end = c[slot ? `end${slot}` : "end"] || "";
    const rest = c[slot ? `rest${slot}` : "rest"] || "";
    const place = String(c[slot ? `place${slot}` : "place"] || "").trim();
    const hours = attendShiftHours(start, end, rest);
    const n = attendWhole(c[slot ? `people${slot}` : "people"]);
    if (!(n > 0 || hours != null)) continue;
    groups.push({ n, hours, start, end, place, payKey: slot ? `pay${slot}` : "pay", slot: slot || "1" });
  }
  return groups;
}
function attendCrewHeadcount(c) {
  if (!c || c.off) return 0;
  return attendCrewGroups(c).reduce((sum, g) => sum + (g.n || 0), 0);
}
function attendCrewTotalHours(c) {
  if (!c || c.off) return null;
  let sum = 0;
  let any = false;
  for (const g of attendCrewGroups(c)) {
    if (!g.n || g.hours == null) continue;
    sum += g.n * g.hours;
    any = true;
  }
  if (!any) return null;
  return Math.round(sum * 10) / 10;
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
  const crewBento = working.reduce((sum, c) => {
    const first = attendBentoStart(c.start) ? attendWhole(c.people) : 0;
    const second = attendBentoStart(c.start2) ? attendWhole(c.people2) : 0;
    const third = attendBentoStart(c.start3) ? attendWhole(c.people3) : 0;
    return sum + first + second + third;
  }, 0);
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
        if (c.place) bits.push(c.place);
        if (attendWhole(c.people2)) bits.push(`第2組${attendWhole(c.people2)}人${c.place2 ? c.place2 : ""}${c.start2 && c.end2 ? ` ${c.start2}–${c.end2}` : ""}`);
        if (attendWhole(c.people3)) bits.push(`第3組${attendWhole(c.people3)}人${c.place3 ? c.place3 : ""}${c.start3 && c.end3 ? ` ${c.start3}–${c.end3}` : ""}`);
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
        <label class="attend-place">地點<input class="attend-in" data-attend-field="place" data-attend-crew="${esc(c.id)}" value="${esc(c.place || "")}" placeholder="田"${dis}></label>
        <div class="attend-more${attendCrewSlotOpen(c, 2) || attendCrewSlotOpen(c, 3) ? " is-open" : ""}">
          <button type="button" class="ghost attend-add" data-attend-add="${esc(c.id)}"${attendCrewSlotOpen(c, 2) && attendCrewSlotOpen(c, 3) ? " hidden" : ""}>＋加一組</button>
          ${attendCrewExtraHtml(c, 2, dis)}
          ${attendCrewExtraHtml(c, 3, dis)}
        </div>
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
          <p class="attend-note">人數、開始、結束。兩個人下班不一樣，按＋加一組再填另一人。跨中午才填休息，時數自動算。</p>
          ${crewRows}
          <p class="attend-note"><button type="button" class="people-jump" data-people-pane="labor-bill">填工時費用單</button>給調工老闆的清單在這裡填單價。</p>
        </section>
      </div>
    </div>
  </div>`;
}
function attendCrewExtraHtml(c, slot, dis) {
  const suf = String(slot);
  const open = attendCrewSlotOpen(c, slot);
  return `<div class="attend-extra-shift" data-attend-slot="${slot}"${open ? "" : " hidden"}>
    <span class="attend-extra-lab">第${slot}組</span>
    <label>人數<input class="attend-in" data-attend-field="people${suf}" data-attend-crew="${esc(c.id)}" value="${esc(c[`people${suf}`] || "")}" inputmode="numeric"${dis}></label>
    <label>地點<input class="attend-in" data-attend-field="place${suf}" data-attend-crew="${esc(c.id)}" value="${esc(c[`place${suf}`] || "")}" placeholder="工廠"${dis}></label>
    <label>開始<input class="attend-in" data-attend-field="cstart${suf}" data-attend-crew="${esc(c.id)}" value="${esc(c[`start${suf}`] || "")}"${dis}></label>
    <label>結束<input class="attend-in" data-attend-field="cend${suf}" data-attend-crew="${esc(c.id)}" value="${esc(c[`end${suf}`] || "")}"${dis}></label>
    <button type="button" class="ghost attend-drop" data-attend-drop="${esc(c.id)}" data-attend-slot="${slot}">拿掉</button>
  </div>`;
}
function attendCrewSlotOpen(c, slot) {
  const suf = String(slot);
  return attendExtra.has(`crew:${c.id}:${slot}`) || !!String(c[`people${suf}`] || "").trim() || !!String(c[`start${suf}`] || "").trim() || !!String(c[`end${suf}`] || "").trim() || !!String(c[`place${suf}`] || "").trim();
}
function attendOpenCrewExtra(crewId) {
  const iso = attendActiveIso();
  const base = attendCrew(iso, ATTEND_CREWS.find((c) => c.id === crewId) || { id: crewId });
  const slot = attendCrewSlotOpen(base, 2) ? 3 : 2;
  attendExtra.add(`crew:${crewId}:${slot}`);
  const more = document.querySelector(`[data-attend-add="${CSS.escape(crewId)}"]`)?.closest(".attend-more");
  if (!more) return;
  more.classList.add("is-open");
  const box = more.querySelector(`[data-attend-slot="${slot}"]`);
  if (box) box.hidden = false;
  const add = more.querySelector("[data-attend-add]");
  const open2 = more.querySelector('[data-attend-slot="2"]') && !more.querySelector('[data-attend-slot="2"]').hidden;
  const open3 = more.querySelector('[data-attend-slot="3"]') && !more.querySelector('[data-attend-slot="3"]').hidden;
  if (add) add.hidden = !!(open2 && open3);
  box?.querySelector("input")?.focus();
}
function attendDropCrewExtra(crewId, slot) {
  const suf = String(slot || "2");
  attendExtra.delete(`crew:${crewId}:${suf}`);
  const iso = attendActiveIso();
  const rec = attendEnsure(iso);
  const base = attendCrew(iso, ATTEND_CREWS.find((c) => c.id === crewId) || { id: crewId });
  for (const key of [`people${suf}`, `start${suf}`, `end${suf}`, `rest${suf}`, `place${suf}`]) {
    base[key] = "";
    attendMark(base, key);
  }
  rec.crews[crewId] = base;
  save();
  attendRefresh(iso);
  const more = document.querySelector(`[data-attend-add="${CSS.escape(crewId)}"]`)?.closest(".attend-more");
  if (!more) return;
  const box = more.querySelector(`[data-attend-slot="${suf}"]`);
  if (box) {
    box.hidden = true;
    box.querySelectorAll("input").forEach((el) => {
      el.value = "";
    });
  }
  const add = more.querySelector("[data-attend-add]");
  if (add) add.hidden = false;
  if (!attendCrewSlotOpen(base, 2) && !attendCrewSlotOpen(base, 3)) more.classList.remove("is-open");
}
function attendBillSlotOpen(day, slot) {
  const suf = String(slot);
  return attendExtra.has(`bill:${day.iso}:${slot}`) || !!String(day[`people${suf}`] || "").trim() || !!String(day[`start${suf}`] || "").trim() || !!String(day[`end${suf}`] || "").trim() || !!String(day[`place${suf}`] || "").trim();
}
function attendOpenBillExtra(iso, crewId) {
  const base = attendCrew(iso, { id: crewId || "" });
  const slot = attendBillSlotOpen({ ...base, iso }, 2) ? 3 : 2;
  attendExtra.add(`bill:${iso}:${slot}`);
  document.querySelectorAll(`[data-bill-row="${CSS.escape(iso)}"]`).forEach((row) => {
    const more = row.querySelector(".bill-more");
    if (more) more.classList.add("is-open");
    const split = row.querySelector(`[data-bill-slot="${slot}"]`);
    if (split) split.hidden = false;
    const other = slot === 2 ? 3 : 2;
    const otherOpen = row.querySelector(`[data-bill-slot="${other}"]`) && !row.querySelector(`[data-bill-slot="${other}"]`).hidden;
    const add = row.querySelector("[data-bill-add]");
    if (add) add.hidden = slot === 3 || !!otherOpen;
    split?.querySelector("input")?.focus();
  });
}
function attendDropBillExtra(iso, crewId, slot) {
  const suf = String(slot || "2");
  attendExtra.delete(`bill:${iso}:${suf}`);
  const rec = attendEnsure(iso);
  const base = attendCrew(iso, ATTEND_CREWS.find((c) => c.id === crewId) || { id: crewId });
  for (const key of [`people${suf}`, `start${suf}`, `end${suf}`, `rest${suf}`, `place${suf}`, `pay${suf}`]) {
    base[key] = "";
    attendMark(base, key);
  }
  rec.crews[crewId] = base;
  save();
  attendBillEdit(iso, crewId, `people${suf}`, "");
  document.querySelectorAll(`[data-bill-row="${CSS.escape(iso)}"]`).forEach((row) => {
    const split = row.querySelector(`[data-bill-slot="${suf}"]`);
    if (split) {
      split.hidden = true;
      split.querySelectorAll("input").forEach((el) => {
        el.value = "";
      });
    }
    const add = row.querySelector("[data-bill-add]");
    if (add) add.hidden = false;
    const still = row.querySelector(".bill-split:not([hidden])");
    const more = row.querySelector(".bill-more");
    if (more && !still) more.classList.remove("is-open");
  });
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
    if (kind === "off") {
      base.off = checked;
      attendMark(base, "off");
    }
    rec.crews[crewId] = base;
  } else if (id) {
    const person = ATTEND_ROSTER.find((p) => p.id === id);
    const base = attendFixed(iso, person || { id });
    if (kind === "on") {
      base.on = checked;
      attendMark(base, "on");
    }
    if (kind === "split") {
      base.split = checked;
      attendMark(base, "split");
    }
    if (kind === "nobento") {
      base.noBento = checked;
      attendMark(base, "noBento");
    }
    rec.fixed[id] = base;
  }
  save();
  renderHomeHub();
}
function attendField(iso, field, id, crewId, value) {
  const rec = attendEnsure(iso);
  if (field === "extra") {
    rec.extra = value;
    rec.extraAt = Date.now();
  } else if (crewId) {
    const base = attendCrew(iso, ATTEND_CREWS.find((c) => c.id === crewId) || { id: crewId });
    const crewMap = { cstart: "start", cend: "end", crest: "rest", cstart2: "start2", cend2: "end2", crest2: "rest2", cstart3: "start3", cend3: "end3", crest3: "rest3" };
    const crewField = crewMap[field] || field;
    if (["plan", "people", "place", "people2", "place2", "people3", "place3", "cstart", "cend", "crest", "cstart2", "cend2", "crest2", "cstart3", "cend3", "crest3"].includes(field)) {
      base[crewField] = value;
      attendMark(base, crewField);
    }
    rec.crews[crewId] = base;
  } else if (id) {
    const person = ATTEND_ROSTER.find((p) => p.id === id);
    const base = attendFixed(iso, person || { id });
    if (field === "start" || field === "end" || field === "start2" || field === "end2" || field === "rest") {
      base[field] = value;
      attendMark(base, field);
    }
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
function attendBillDateLabel(month, day, start, end, start2, end2) {
  const date = `${month}/${day}`;
  const pair = (a, b) => (a && b ? `${a}-${b}` : "");
  const times = [pair(attendBillWhen(start), attendBillWhen(end)), pair(attendBillWhen(start2), attendBillWhen(end2))].filter(Boolean).join("、");
  return times ? `${date}\u00a0${times}` : date;
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
  const pay = attendBillPersonPay(attendCrewHours(crew), crew.price, "");
  return pay == null ? "" : String(pay);
}
function attendBillPersonPay(hours, price, typed) {
  const typedText = String(typed || "").trim();
  if (typedText !== "") {
    const n = Number(typedText);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  const wageText = String(price || "").trim();
  const wage = Number(wageText);
  if (hours == null || wageText === "" || !Number.isFinite(wage)) return null;
  return Math.round(hours * wage);
}
function attendBillGroupPays(crew) {
  if (!crew || crew.off) return [];
  return attendCrewGroups(crew).map((g) => {
    const pay = attendBillPersonPay(g.hours, crew.price, crew[g.payKey]);
    const amt = g.n && pay != null ? Math.round(g.n * pay) : null;
    return { n: g.n, hours: g.hours, start: g.start, end: g.end, place: g.place, pay, amt };
  });
}
function attendBillAmount(crew) {
  if (!crew || crew.off) return "";
  const parts = attendBillGroupPays(crew).filter((g) => g.amt != null);
  if (!parts.length) return "";
  return String(parts.reduce((sum, g) => sum + g.amt, 0));
}
function attendBillHoursNote(day) {
  if (!day || !day.showHours || day.off) return "";
  const groups = attendCrewGroups(day).filter((g) => g.n && g.hours != null);
  if (!groups.length) return "";
  const total = Math.round(groups.reduce((sum, g) => sum + g.n * g.hours, 0) * 10) / 10;
  if (groups.length === 1) return `${groups[0].n}人*${groups[0].hours}小時=${total}H`;
  return `${groups.map((g) => `${g.n}人*${g.hours}小時`).join("+")}=${total}H`;
}
function attendBillTotalText(day) {
  if (!day || day.off) return "";
  const total = attendCrewTotalHours(day);
  return total == null ? "" : `${total}小時`;
}
function attendBillTotalHours(people, hours, off) {
  if (off) return "";
  const n = attendWhole(people);
  const h = hours === "" || hours == null ? null : Number(hours);
  if (!n || h == null || !Number.isFinite(h)) return "";
  return `${Math.round(n * h * 10) / 10}小時`;
}
function attendBillSlipNote(day) {
  const places = [...new Set(attendCrewGroups(day).map((g) => g.place).filter(Boolean))];
  return [attendBillHoursNote(day), places.join("、"), String(day.note || "").trim()].filter(Boolean).join(" ");
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
    const n = attendCrewHeadcount(saved);
    const hasTime = String(saved.start || "").trim() || String(saved.end || "").trim() || String(saved.start2 || "").trim() || String(saved.end2 || "").trim();
    if (!off && n <= 0 && !hasTime) continue;
    days.push({ iso, d, off: off || n <= 0, n, start: saved.start || "", end: saved.end || "", start2: saved.start2 || "", end2: saved.end2 || "", price: saved.price || "", pay: saved.pay || "", note: saved.note || "" });
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
      label: attendBillDateLabel(m, day.d, day.start, day.end, day.start2, day.end2),
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
    const people2 = crew.people2 || "";
    const start2 = crew.start2 || "";
    const end2 = crew.end2 || "";
    const rest2 = crew.rest2 || "";
    const place = crew.place || "";
    const place2 = crew.place2 || "";
    const people3 = crew.people3 || "";
    const start3 = crew.start3 || "";
    const end3 = crew.end3 || "";
    const rest3 = crew.rest3 || "";
    const place3 = crew.place3 || "";
    const price = crew.price || "";
    const pay = crew.pay || "";
    const pay2 = crew.pay2 || "";
    const pay3 = crew.pay3 || "";
    const rest = crew.rest || "";
    const off = !!crew.off;
    const showHours = !!crew.showHours;
    const shaped = { off, people, start, end, rest, place, people2, start2, end2, rest2, place2, people3, start3, end3, rest3, place3, price, pay, pay2, pay3, showHours };
    const n = attendCrewHeadcount(shaped);
    const amt = attendBillAmount(shaped);
    const touched = off || ["people", "start", "end", "place", "people2", "start2", "end2", "place2", "people3", "start3", "end3", "place3", "price", "pay", "pay2", "pay3"].some((key) => String(shaped[key] || "").trim());
    const hours2 = attendShiftHours(start2, end2, rest2);
    const hours3 = attendShiftHours(start3, end3, rest3);
    const payHint = attendBillPersonPay(attendShiftHours(start, end, rest), price, "");
    const pay2Hint = attendBillPersonPay(hours2, price, "");
    const pay3Hint = attendBillPersonPay(hours3, price, "");
    days.push({ iso, d, m, off, showHours, people, start, end, rest, place, people2, start2, end2, rest2, place2, people3, start3, end3, rest3, place3, price, pay, pay2, pay3, note: crew.note || "", n, amt, hours: attendBillHoursText(shaped), hours2: hours2 == null ? "" : String(hours2), hours3: hours3 == null ? "" : String(hours3), estimate: attendBillEstimate(shaped), estimate2: pay2Hint == null ? "" : String(pay2Hint), estimate3: pay3Hint == null ? "" : String(pay3Hint), payHint: payHint == null ? "" : String(payHint), touched });
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
function attendBillSplitHtml(day, crewId, slot) {
  const suf = String(slot);
  const start = day[`start${suf}`] || "";
  const end = day[`end${suf}`] || "";
  const cross = !day.off && attendCross(start, end);
  const open = attendBillSlotOpen(day, slot);
  return `<div class="bill-split" data-bill-slot="${slot}"${open ? "" : " hidden"}>
    <span class="bill-extra-lab">第${slot}組</span>
    <label class="bill-people"><span class="bill-mini">人數</span><input class="attend-in" data-bill-field="people${suf}" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(String(day[`people${suf}`] || ""))}" inputmode="numeric"></label>
    <label class="bill-start"><span class="bill-mini">開始</span><input class="attend-in" data-bill-field="start${suf}" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(start)}"></label>
    <label class="bill-end"><span class="bill-mini">結束</span><input class="attend-in" data-bill-field="end${suf}" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(end)}"></label>
    <label class="bill-rest"><span class="bill-mini">午休</span><input class="attend-in" data-bill-field="rest${suf}" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${cross ? esc(String(day[`rest${suf}`] || "")) : ""}" placeholder="${cross ? "60" : "—"}" inputmode="numeric"${cross ? "" : " disabled"}></label>
    <span class="bill-hours"><span class="bill-mini">時數</span><b data-bill-hours${suf}="${esc(day.iso)}">${esc(day[`hours${suf}`] || "")}</b></span>
    <span class="bill-split-gap"></span>
    <span class="bill-split-gap"></span>
    <span class="bill-estimate"><span class="bill-mini">預計</span><b data-bill-estimate${suf}="${esc(day.iso)}">${esc(day[`estimate${suf}`] || "")}</b></span>
    <label class="bill-pay"><span class="bill-mini">實發</span><input class="attend-in" data-bill-field="pay${suf}" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(String(day[`pay${suf}`] || ""))}" placeholder="${esc(day[`estimate${suf}`] || "")}" inputmode="numeric"></label>
    <label class="bill-place"><span class="bill-mini">地點</span><input class="attend-in" data-bill-field="place${suf}" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(String(day[`place${suf}`] || ""))}" placeholder="田／工廠"></label>
    <button type="button" class="ghost bill-drop" data-bill-drop="1" data-bill-slot="${slot}" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}">拿掉</button>
  </div>`;
}
function attendBillWeekKey(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
function attendBillWeeks(days) {
  const weeks = [];
  days.forEach((day) => {
    const key = attendBillWeekKey(day.iso);
    const last = weeks[weeks.length - 1];
    if (!last || last.key !== key) weeks.push({ key, days: [day] });
    else last.days.push(day);
  });
  return weeks;
}
function attendBillOpenWeek(days) {
  const today = attendTodayIso();
  const hit = days.find((day) => day.iso === today) || days.find((day) => day.touched) || days[0];
  return hit ? attendBillWeekKey(hit.iso) : "";
}
function attendBillWeekLabel(week) {
  const a = week.days[0];
  const b = week.days[week.days.length - 1];
  const range = a.iso === b.iso ? `${a.m}/${a.d}` : `${a.m}/${a.d}–${b.m}/${b.d}`;
  const filled = week.days.filter((day) => day.touched && !day.off).length;
  const off = week.days.filter((day) => day.off).length;
  const bits = [];
  if (filled) bits.push(`已填 ${filled} 天`);
  if (off) bits.push(`休 ${off} 天`);
  return `${range}${bits.length ? "　" + bits.join("　") : "　還沒填"}`;
}
function attendBillSetWeeks(mode) {
  document.querySelectorAll(".bill-month .bill-week").forEach((el) => {
    el.open = mode === "all" || el.dataset.billWeek === attendBillOpenWeek(attendBillDays(billBoss, billMonth));
  });
}
function attendBillForm(days, crewId, opts) {
  const lineOf = (day) => {
      const amt = day.amt === "" ? "" : attendBillMoney(day.amt);
      const cross = !day.off && attendCross(day.start, day.end);
      const extraOpen = attendBillSlotOpen(day, 2) || attendBillSlotOpen(day, 3);
      return `<div class="bill-line${day.off ? " is-off" : ""}" data-bill-row="${esc(day.iso)}">
        <b>${day.m}/${day.d}</b>
        <label class="bill-people"><span class="bill-mini">人數</span><input class="attend-in" data-bill-field="people" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(String(day.people))}" inputmode="numeric"></label>
        <label class="bill-start"><span class="bill-mini">開始</span><input class="attend-in" data-bill-field="start" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(String(day.start))}"></label>
        <label class="bill-end"><span class="bill-mini">結束</span><input class="attend-in" data-bill-field="end" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(String(day.end))}"></label>
        <label class="bill-rest"><span class="bill-mini">午休</span><input class="attend-in" data-bill-field="rest" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${cross ? esc(String(day.rest)) : ""}" placeholder="${cross ? "60" : "—"}" inputmode="numeric"${cross ? "" : " disabled"}></label>
        <span class="bill-hours"><span class="bill-mini">時數</span><b class="bill-hours-num" data-bill-hours="${esc(day.iso)}">${esc(day.hours)}</b></span>
        <span class="bill-total-hours"><span class="bill-mini">總工時</span><b data-bill-total-hours="${esc(day.iso)}">${esc(attendBillTotalText(day))}</b></span>
        <label class="bill-price"><span class="bill-mini">時薪</span><input class="attend-in" data-bill-field="price" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(String(day.price))}" inputmode="numeric"></label>
        <span class="bill-estimate"><span class="bill-mini">預計</span><b class="bill-estimate-num" data-bill-estimate="${esc(day.iso)}">${esc(day.estimate)}</b></span>
        <label class="bill-pay"><span class="bill-mini">實發</span><input class="attend-in" data-bill-field="pay" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(String(day.pay))}" placeholder="${esc(day.payHint || "")}" inputmode="numeric"></label>
        <span class="bill-amt" data-bill-amt="${esc(day.iso)}"><span class="bill-mini">金額</span><b class="bill-amt-num">${esc(amt)}</b></span>
        <label class="bill-off"><input type="checkbox" data-bill-off="1" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}"${day.off ? " checked" : ""}>休</label>
        <div class="bill-note">
          <label class="bill-place"><span class="bill-mini">地點</span><input class="attend-in" data-bill-field="place" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(String(day.place || ""))}" placeholder="田／工廠"></label>
          <span class="bill-mini">備註</span>
          <input class="attend-in" data-bill-field="note" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}" value="${esc(String(day.note))}">
          <label class="bill-show-hours"><input type="checkbox" data-bill-show-hours="1" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}"${day.showHours ? " checked" : ""}>工時</label>
          <span class="bill-hours-note" data-bill-hours-note="${esc(day.iso)}">${esc(attendBillHoursNote(day))}</span>
        </div>
        <div class="bill-more${extraOpen ? " is-open" : ""}">
          <button type="button" class="ghost bill-add" data-bill-add="1" data-bill-day="${esc(day.iso)}" data-bill-crew="${esc(crewId)}"${attendBillSlotOpen(day, 2) && attendBillSlotOpen(day, 3) ? " hidden" : ""}>＋加一組</button>
          ${attendBillSplitHtml(day, crewId, 2)}
          ${attendBillSplitHtml(day, crewId, 3)}
        </div>
      </div>`;
  };
  const lines = days.map(lineOf).join("");
  const total = days.reduce((sum, day) => sum + (Number(day.amt) || 0), 0);
  const foot = opts && opts.foot === false ? "" : `<div class="bill-foot"><span>合計</span><b id="bill-total">${total ? attendBillMoney(total) : ""}</b></div>`;
  const head = `<div class="bill-head"><span>日期</span><span>人數</span><span>開始</span><span>結束</span><span>午休</span><span>時數</span><span>總工時</span><span>時薪</span><span>預計</span><span>實發</span><span>金額</span><span>休</span><span>備註</span></div>`;
  const body = opts && opts.weeks
    ? `<div class="bill-week-tools"><button type="button" class="ghost" data-bill-weeks="one">只留這一週</button><button type="button" class="ghost" data-bill-weeks="all">展開整月</button></div>${attendBillWeeks(days).map((week) => {
        const open = week.key === attendBillOpenWeek(days) ? " open" : "";
        return `<details class="bill-week" data-bill-week="${esc(week.key)}"${open}><summary>${esc(attendBillWeekLabel(week))}</summary>${week.days.map(lineOf).join("")}</details>`;
      }).join("")}`
    : lines;
  return `<div class="bill-form">
    ${head}
    ${body}
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
      <button type="button" class="ghost" data-bill-xlsx>另存 Excel</button>
    </div>
    <p class="attend-note">選好起迄日。複製的是圖片，可直接貼到 LINE。PDF 與 Excel 都會直接下載。</p>
    ${table}`;
}
function attendFitText(ctx, text, max) {
  const raw = String(text || "");
  if (ctx.measureText(raw).width <= max) return raw;
  let out = raw;
  while (out && ctx.measureText(`${out}…`).width > max) out = out.slice(0, -1);
  return `${out}…`;
}
function attendBillSheetCanvas(title, rows) {
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
  return canvas;
}
function attendBillPngBlob(title, rows) {
  const canvas = attendBillSheetCanvas(title, rows);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
function attendPdfBytes(jpeg, pxW, pxH) {
  const enc = new TextEncoder();
  const chunks = [];
  let offset = 0;
  const offsets = [0];
  const add = (part) => {
    const bytes = typeof part === "string" ? enc.encode(part) : part;
    chunks.push(bytes);
    offset += bytes.length;
  };
  const pageW = 595.28;
  const margin = 28;
  const drawW = pageW - margin * 2;
  const drawH = drawW * (pxH / pxW);
  const pageH = drawH + margin * 2;
  add("%PDF-1.3\n");
  const obj = (n, body) => {
    offsets[n] = offset;
    add(`${n} 0 obj\n${body}\nendobj\n`);
  };
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>`);
  const content = `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${margin.toFixed(2)} ${margin.toFixed(2)} cm /Im0 Do Q\n`;
  const contentBytes = enc.encode(content);
  offsets[4] = offset;
  add(`4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
  add(contentBytes);
  add("endstream\nendobj\n");
  offsets[5] = offset;
  add(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  add(jpeg);
  add("\nendstream\nendobj\n");
  const xref = offset;
  let xrefBody = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i += 1) xrefBody += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  add(xrefBody);
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks, { type: "application/pdf" });
}
function attendBillPdfBlob(title, rows) {
  const canvas = attendBillSheetCanvas(title, rows);
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      resolve(attendPdfBytes(new Uint8Array(await blob.arrayBuffer()), canvas.width, canvas.height));
    }, "image/jpeg", 0.92);
  });
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
async function attendBillPrintPdf() {
  const pack = attendBillCurrentPack();
  if (!pack.rows.length) {
    setStatus("這段沒有已填的日子。", true);
    return;
  }
  setStatus("正在做成 PDF…");
  const blob = await attendBillPdfBlob(pack.title, pack.rows);
  if (!blob) {
    setStatus("做成 PDF 失敗。", true);
    return;
  }
  const name = `${String(pack.title || "工時單").replace(/[\\/:*?"<>|\s\u3000]+/g, "_")}.pdf`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  setStatus("已下載 PDF，不會再跳出列印畫面。");
}
function attendXml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function attendCrc32(bytes) {
  let c = ~0;
  for (let i = 0; i < bytes.length; i += 1) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k += 1) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}
function attendZip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const name = enc.encode(file.name);
    const data = typeof file.data === "string" ? enc.encode(file.data) : file.data;
    const crc = attendCrc32(data);
    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, data);
    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cen.set(name, 46);
    central.push(cen);
    offset += local.length + data.length;
  }
  const cd = offset;
  let cdSize = 0;
  central.forEach((part) => {
    parts.push(part);
    cdSize += part.length;
  });
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cd, true);
  parts.push(end);
  return new Blob(parts, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
function attendCell(ref, value, kind) {
  if (kind === "n") return `<c r="${ref}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t>${attendXml(value)}</t></is></c>`;
}
function attendBillXlsxBlob(title, rows) {
  const head = ["日期", "數量", "單價", "金額", "備註"];
  const lines = [[title, "", "", "", ""], head];
  rows.forEach((row) => {
    lines.push([
      row.label || "",
      row.qty || "",
      row.price === "" || row.price == null ? "" : String(row.price),
      row.amt === "" || row.amt == null ? "" : attendBillMoney(row.amt),
      row.note || "",
    ]);
  });
  const total = rows.reduce((sum, row) => sum + (Number(row.amt) || 0), 0);
  lines.push(["合計", "", "", total ? attendBillMoney(total) : "", ""]);
  const cols = "ABCDE";
  const sheetRows = lines
    .map((line, r) => {
      const cells = line
        .map((value, c) => {
          const num = c === 2 || c === 3 ? Number(value) : NaN;
          return attendCell(`${cols[c]}${r + 1}`, Number.isFinite(num) && value !== "" ? num : value, Number.isFinite(num) && value !== "" ? "n" : "s");
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
  return attendZip([
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="工時單" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    },
    { name: "xl/worksheets/sheet1.xml", data: sheet },
  ]);
}
function attendBillSaveExcel() {
  const pack = attendBillCurrentPack();
  if (!pack.rows.length) {
    setStatus("這段沒有已填的日子。", true);
    return;
  }
  const blob = attendBillXlsxBlob(pack.title, pack.rows);
  const name = `${String(pack.title || "工時單").replace(/[\\/:*?"<>|\s\u3000]+/g, "_")}.xlsx`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  setStatus("已下載 Excel。");
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
    const parts = attendBillGroupPays(day).filter((g) => g.n > 0 && g.pay != null);
    const samePay = parts.length > 0 && parts.every((g) => g.pay === parts[0].pay);
    const samePlace = parts.length > 0 && parts.every((g) => (g.place || "") === (parts[0].place || ""));
    if (!parts.length || (samePay && samePlace)) {
      const n = parts.length ? parts.reduce((sum, g) => sum + g.n, 0) : day.n;
      const price = parts.length ? parts[0].pay : day.pay;
      const amt = parts.length ? n * parts[0].pay : day.amt;
      const groups = attendCrewGroups(day);
      const times = groups.map((g) => {
        const a = attendBillWhen(g.start);
        const b = attendBillWhen(g.end);
        return a && b ? `${a}-${b}` : "";
      }).filter(Boolean);
      const label = times.length ? `${day.m}/${day.d}\u00a0${times.join("、")}` : `${day.m}/${day.d}`;
      rows.push({ kind: "work", iso: day.iso, label, qty: `${n}人`, price, amt, note: attendBillSlipNote(day) });
    } else {
      parts.forEach((g, i) => {
        const hoursNote = day.showHours && g.hours != null ? `${g.n}人*${g.hours}小時` : "";
        const note = [g.place || "", hoursNote, i === 0 ? String(day.note || "").trim() : ""].filter(Boolean).join(" ");
        rows.push({ kind: "work", iso: day.iso, label: attendBillDateLabel(day.m, day.d, g.start, g.end, "", ""), qty: `${g.n}人`, price: g.pay, amt: g.amt, note });
      });
    }
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
    <p class="attend-note">人數和時間會記到每日到班。地點填在每一組，例如田、工廠，會出現在給老闆的備註。最多三組。跨中午可填午休分鐘，空白扣 60 分，填 0 不扣。總工時是各組人數乘上各組時數再加總。時薪各組共用。實發沒填時，用該組時數乘時薪。有填實發就用填的，改時間不會蓋掉。金額是各組實發乘各組人數再加總。</p>
    <div class="bill-filters">
      <label>老闆 <select data-bill-boss>${bossOpts}</select></label>
      <label>月份 <select data-bill-month>${monthOpts}</select></label>
    </div>
    <p class="bill-title">${y - 1911}年${m}月　${esc(bossName)}</p>
    ${attendBillCal(days, billMonth, focus)}
    <div class="bill-one">${attendBillForm(one, boss, { foot: false })}</div>
    <div class="bill-month">${attendBillForm(days, boss, { weeks: true })}</div>
    <div id="bill-preview">${attendBillPreview(days)}</div>
    ${sample}
  </section>`;
}
function attendBillEdit(iso, crewId, field, value) {
  const rec = attendEnsure(iso);
  const crew = ATTEND_CREWS.find((c) => c.id === crewId) || { id: crewId };
  const base = attendCrew(iso, crew);
  if (field === "off") {
    base.off = !!value;
    attendMark(base, "off");
  }
  if (field === "showHours") {
    base.showHours = !!value;
    attendMark(base, "showHours");
  }
  if (["people", "start", "end", "rest", "place", "people2", "start2", "end2", "rest2", "place2", "people3", "start3", "end3", "rest3", "place3", "price", "pay", "pay2", "pay3", "note"].includes(field)) {
    base[field] = value;
    attendMark(base, field);
  }
  rec.crews[crewId] = base;
  save();
  const amt = attendBillAmount(base);
  const cross = !base.off && attendCross(base.start, base.end);
  document.querySelectorAll(`[data-bill-row="${CSS.escape(iso)}"]`).forEach((row) => {
    row.classList.toggle("is-off", !!base.off);
    const cell = row.querySelector("[data-bill-amt] .bill-amt-num");
    if (cell) cell.textContent = amt === "" ? "" : attendBillMoney(amt);
    const hoursText = attendBillHoursText(base);
    const hoursEl = row.querySelector("[data-bill-hours]");
    if (hoursEl) hoursEl.textContent = hoursText;
    const totalHoursEl = row.querySelector("[data-bill-total-hours]");
    if (totalHoursEl) totalHoursEl.textContent = attendBillTotalText({ ...base, hours: hoursText });
    const estimateEl = row.querySelector("[data-bill-estimate]");
    if (estimateEl) estimateEl.textContent = attendBillEstimate(base);
    const payIn = row.querySelector("[data-bill-field='pay']");
    if (payIn && document.activeElement !== payIn) payIn.placeholder = attendBillEstimate(base);
    for (const suf of ["2", "3"]) {
      const hoursN = attendShiftHours(base[`start${suf}`], base[`end${suf}`], base[`rest${suf}`]);
      const hoursElN = row.querySelector(`[data-bill-hours${suf}]`);
      if (hoursElN) hoursElN.textContent = hoursN == null ? "" : String(hoursN);
      const estimateN = attendBillPersonPay(hoursN, base.price, "");
      const estimateElN = row.querySelector(`[data-bill-estimate${suf}]`);
      if (estimateElN) estimateElN.textContent = estimateN == null ? "" : String(estimateN);
      const payElN = row.querySelector(`[data-bill-field='pay${suf}']`);
      if (payElN && document.activeElement !== payElN) payElN.placeholder = estimateN == null ? "" : String(estimateN);
      const crossN = !base.off && attendCross(base[`start${suf}`], base[`end${suf}`]);
      const restElN = row.querySelector(`[data-bill-field='rest${suf}']`);
      if (restElN && document.activeElement !== restElN) {
        restElN.disabled = !crossN;
        restElN.placeholder = crossN ? "60" : "—";
        if (!crossN) restElN.value = "";
      }
    }
    const hoursNote = row.querySelector("[data-bill-hours-note]");
    if (hoursNote) hoursNote.textContent = attendBillHoursNote({ ...base, hours: attendBillHoursText(base) });
    const restIn = row.querySelector("[data-bill-field='rest']");
    if (restIn && document.activeElement !== restIn) {
      restIn.disabled = !cross;
      restIn.placeholder = cross ? "60" : "—";
      if (!cross) restIn.value = "";
    }
  });
  const touched = !!base.off || ["people", "start", "end", "place", "people2", "start2", "end2", "place2", "people3", "start3", "end3", "place3", "price", "pay", "pay2", "pay3"].some((key) => String(base[key] || "").trim());
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
