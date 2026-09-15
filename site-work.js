/** 現場工作：調倉單（各倉互調）＋工作單；司機可接單. Loads after app.js */
(function () {
  const ALL_WH = [
    { id: "A", label: "A倉" },
    { id: "B", label: "B倉" },
    { id: "Y", label: "油" },
    { id: "K", label: "烘庫" },
  ];

  let swTab = "move"; // move | work

  function ensure() {
    if (!Array.isArray(state.siteMoves)) state.siteMoves = [];
    if (!Array.isArray(state.siteWorks)) state.siteWorks = [];
  }

  function uid(p) {
    return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function whLabel(id) {
    return ALL_WH.find((w) => w.id === id)?.label || id || "—";
  }

  function whOptionsHtml(selected) {
    return ALL_WH.map(
      (w) =>
        `<option value="${esc(w.id)}"${selected === w.id ? " selected" : ""}>${esc(w.label)}</option>`,
    ).join("");
  }

  function driverList() {
    if (typeof driverNames === "function") return driverNames();
    return ["小胖", "善存"];
  }

  function iAmDriver() {
    return typeof currentRole === "function" && currentRole() === "driver";
  }

  function canCreate() {
    if (typeof can !== "function") return true;
    return can("sitework-create") || can("page-books") || (can("page-sitework") && !iAmDriver());
  }

  function canTake() {
    if (typeof can !== "function") return true;
    return can("sitework-take") || can("page-books") || can("page-sitework");
  }

  function canCompleteMove(m) {
    if (!m || m.done) return false;
    if (typeof can === "function" && (can("sitework-create") || can("page-books"))) return true;
    if (iAmDriver()) {
      const me = typeof currentStaff === "function" ? currentStaff() : "";
      return m.driver === me;
    }
    return can("page-sitework");
  }

  function ensurePage() {
    let el = document.getElementById("page-sitework");
    if (el) return el;
    const app = document.querySelector(".app");
    if (!app) return null;
    el = document.createElement("section");
    el.id = "page-sitework";
    el.hidden = true;
    el.innerHTML = `<div id="sw-root" class="sw-root"></div>`;
    const status = document.getElementById("status");
    if (status) status.before(el);
    else app.appendChild(el);
    return el;
  }

  function applyMoveStock(row, reverse) {
    ensure();
    if (!state.wareItems || typeof state.wareItems !== "object") state.wareItems = {};
    if (!state.stockCount || typeof state.stockCount !== "object") state.stockCount = {};
    const day = row.day || today();
    const from = row.fromWh;
    const to = row.toWh;
    const qty = Number(row.qty) || 0;
    if (!(qty > 0) || !from || !to || from === to) return;

    const ensureItem = (wh) => {
      if (!Array.isArray(state.wareItems[wh])) state.wareItems[wh] = [];
      let it = state.wareItems[wh].find(
        (x) => String(x.code || "").toLowerCase() === String(row.code || "").toLowerCase(),
      );
      if (!it) {
        it = { id: uid("wi"), code: row.code || row.name, name: row.name || row.code };
        state.wareItems[wh].push(it);
      } else if (row.name) it.name = row.name;
      return it;
    };

    const bump = (wh, itemId, delta) => {
      if (!state.stockCount[day]) state.stockCount[day] = {};
      if (!state.stockCount[day][wh]) state.stockCount[day][wh] = { qty: {}, notes: {}, confirmed: false };
      const b = state.stockCount[day][wh];
      if (!b.qty) b.qty = {};
      const prev = Number(b.qty[itemId]) || 0;
      const next = typeof round === "function" ? round(prev + delta) : prev + delta;
      b.qty[itemId] = Math.max(0, next);
    };

    const fromItem = ensureItem(from);
    const toItem = ensureItem(to);
    const sign = reverse ? -1 : 1;
    bump(from, fromItem.id, -qty * sign);
    bump(to, toItem.id, qty * sign);
    if (!reverse) {
      const note = `調自 ${whLabel(from)}`;
      const b = state.stockCount[day][to];
      if (b) {
        if (!b.notes) b.notes = {};
        b.notes[toItem.id] = [b.notes[toItem.id], note, row.note].filter(Boolean).join(" · ");
      }
    }
  }

  function visibleMoves() {
    ensure();
    const me = typeof currentStaff === "function" ? currentStaff() : "";
    if (iAmDriver()) {
      return state.siteMoves.filter((m) => !m.done && (!m.driver || m.driver === me));
    }
    return state.siteMoves;
  }

  function renderPage() {
    ensurePage();
    const root = document.getElementById("sw-root");
    if (!root) return;
    ensure();
    if (iAmDriver()) swTab = "move";

    const moves = visibleMoves();
    const openMoves = moves.filter((m) => !m.done);
    const waitTake = openMoves.filter((m) => !m.driver);
    const mine = openMoves.filter((m) => m.driver);
    const doneMoves = iAmDriver()
      ? state.siteMoves.filter((m) => m.done && m.driver === (typeof currentStaff === "function" ? currentStaff() : "")).slice(-8).reverse()
      : state.siteMoves.filter((m) => m.done).slice(-12).reverse();
    const openWorks = state.siteWorks.filter((w) => !w.done);
    const doneWorks = state.siteWorks.filter((w) => w.done).slice(-12).reverse();
    const create = canCreate();
    const drivers = driverList();

    const moveCard = (m) => {
      const me = typeof currentStaff === "function" ? currentStaff() : "";
      const driverLine = m.driver
        ? `司機 ${esc(m.driver)}`
        : "待司機接單";
      let actions = "";
      if (m.done) {
        actions = `<p class="sw-ok">已完成${m.doneBy ? ` · ${esc(m.doneBy)}` : ""}</p>`;
        if (create) {
          actions += `<button type="button" class="ghost sw-del" data-sw-move-del="${esc(m.id)}">刪除</button>`;
        }
      } else if (!m.driver && (iAmDriver() || canTake())) {
        if (iAmDriver()) {
          actions = `<button type="button" class="primary" data-sw-take="${esc(m.id)}">我要接單</button>`;
        } else {
          actions = `<div class="sw-take-row"><span class="muted">指派司機</span>${drivers
            .map((d) => `<button type="button" class="tiny-btn" data-sw-assign="${esc(m.id)}" data-sw-driver="${esc(d)}">${esc(d)}</button>`)
            .join("")}</div>`;
        }
        if (create) {
          actions += `<button type="button" class="ghost sw-del" data-sw-move-del="${esc(m.id)}">刪除</button>`;
        }
      } else if (canCompleteMove(m)) {
        actions = `<button type="button" class="primary" data-sw-move-done="${esc(m.id)}">完成打勾</button>`;
        if (!iAmDriver() && m.driver) {
          actions += `<button type="button" class="ghost" data-sw-release="${esc(m.id)}">取消接單</button>`;
        }
        if (create) {
          actions += `<button type="button" class="ghost sw-del" data-sw-move-del="${esc(m.id)}">刪除</button>`;
        }
      } else if (m.driver && m.driver !== me) {
        actions = `<p class="muted">已由 ${esc(m.driver)} 接單</p>`;
        if (create) {
          actions += `<button type="button" class="ghost sw-del" data-sw-move-del="${esc(m.id)}">刪除</button>`;
        }
      } else if (create) {
        actions = `<button type="button" class="ghost sw-del" data-sw-move-del="${esc(m.id)}">刪除</button>`;
      }
      return `<article class="sw-card${m.done ? " is-done" : ""}${!m.driver && !m.done ? " is-open-take" : ""}">
        <div class="sw-card-top">
          <strong>${esc(m.day)}</strong>
          <em>${esc(whLabel(m.fromWh))} → ${esc(whLabel(m.toWh))}</em>
        </div>
        <p><span class="wh-code">${esc(m.code)}</span> ${esc(m.name)}　<strong>${fmt(m.qty)}</strong></p>
        <p class="muted">${driverLine}${m.backDay ? `　預計回倉 ${esc(m.backDay)}` : ""}${m.note ? `　${esc(m.note)}` : ""}</p>
        ${actions}
      </article>`;
    };

    const workCard = (w) => `
      <article class="sw-card${w.done ? " is-done" : ""}">
        <div class="sw-card-top">
          <strong>${esc(w.day)}</strong>
          <em>${esc(whLabel(w.wh))}</em>
        </div>
        <p><strong>${esc(w.title)}</strong></p>
        <p class="muted">${w.who ? `負責人 ${esc(w.who)}　` : ""}${w.note ? esc(w.note) : ""}</p>
        <div class="sw-card-acts">
        ${
          w.done
            ? `<p class="sw-ok">已完成${w.doneBy ? ` · ${esc(w.doneBy)}` : ""}</p>`
            : create
              ? `<button type="button" class="primary" data-sw-work-done="${esc(w.id)}">完成打勾</button>`
              : ""
        }
        ${create ? `<button type="button" class="ghost sw-del" data-sw-work-del="${esc(w.id)}">刪除</button>` : ""}
        </div>
      </article>`;

    const formMove = create
      ? `<section class="sw-form">
          <h3>新增調倉（各倉互調）</h3>
          <div class="sw-grid">
            <label>調倉日 <input id="sw-m-day" type="date" value="${esc(today())}" /></label>
            <label>預計回倉 <input id="sw-m-back" type="date" /></label>
            <label>從 <select id="sw-m-from">${whOptionsHtml("A")}</select></label>
            <label>到 <select id="sw-m-to">${whOptionsHtml("K")}</select></label>
            <label>編號 <input id="sw-m-code" type="text" placeholder="品項編號" autocomplete="off" /></label>
            <label>品項 <input id="sw-m-name" type="text" placeholder="例如 洋蔥" autocomplete="off" /></label>
            <label>件數 <input id="sw-m-qty" type="number" min="0" step="1" inputmode="decimal" /></label>
            <label>指定司機
              <select id="sw-m-driver">
                <option value="">開放接單</option>
                ${drivers.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join("")}
              </select>
            </label>
            <label class="span2">備註 <input id="sw-m-note" type="text" placeholder="選填" /></label>
          </div>
          <button type="button" class="primary" id="sw-m-add">建立調倉單</button>
        </section>`
      : `<p class="muted sw-driver-hint">點「我要接單」接下調倉；完成後按完成打勾。</p>`;

    root.innerHTML = `
      <header class="sw-head">
        <h2>${iAmDriver() ? "調倉接單" : "現場工作"}</h2>
        <p class="muted">${iAmDriver() ? "接單後才會算在你名下；完成打勾後庫存跟移。" : "倉庫別含 A倉／B倉／油／烘庫。可指定司機或開放接單。"}</p>
      </header>
      ${
        iAmDriver()
          ? ""
          : `<nav class="tabs sw-tabs" aria-label="現場工作">
        <button type="button" class="tab${swTab === "move" ? " on" : ""}" data-sw-tab="move">調倉單</button>
        <button type="button" class="tab${swTab === "work" ? " on" : ""}" data-sw-tab="work">工作單</button>
      </nav>`
      }
      <div class="sw-pane" ${swTab === "move" || iAmDriver() ? "" : "hidden"}>
        ${formMove}
        ${
          iAmDriver()
            ? `<section class="sw-list">
                <h3>待接單 ${waitTake.length}</h3>
                <div class="sw-cards">${waitTake.length ? waitTake.map(moveCard).join("") : `<p class="sw-empty">目前沒有開放接單</p>`}</div>
              </section>
              <section class="sw-list">
                <h3>我的調倉 ${mine.filter((m) => m.driver === (typeof currentStaff === "function" ? currentStaff() : "")).length}</h3>
                <div class="sw-cards">${
                  mine.filter((m) => m.driver === (typeof currentStaff === "function" ? currentStaff() : "")).length
                    ? mine
                        .filter((m) => m.driver === (typeof currentStaff === "function" ? currentStaff() : ""))
                        .map(moveCard)
                        .join("")
                    : `<p class="sw-empty">尚未接單</p>`
                }</div>
              </section>`
            : `<section class="sw-list">
                <h3>進行中 ${openMoves.length}</h3>
                <div class="sw-cards">${openMoves.length ? openMoves.map(moveCard).join("") : `<p class="sw-empty">尚無進行中調倉</p>`}</div>
              </section>`
        }
        ${
          doneMoves.length
            ? `<section class="sw-list"><h3>最近完成</h3><div class="sw-cards">${doneMoves.map(moveCard).join("")}</div></section>`
            : ""
        }
      </div>
      ${
        iAmDriver()
          ? ""
          : `<div class="sw-pane" ${swTab === "work" ? "" : "hidden"}>
        ${
          create
            ? `<section class="sw-form">
          <h3>新增工作單（整理／備註）</h3>
          <div class="sw-grid">
            <label>日期 <input id="sw-w-day" type="date" value="${esc(today())}" /></label>
            <label>倉庫
              <select id="sw-w-wh">
                <option value="">不指定</option>
                ${whOptionsHtml("")}
              </select>
            </label>
            <label class="span2">工作內容 <input id="sw-w-title" type="text" placeholder="例如 預先整理貨品" autocomplete="off" /></label>
            <label>負責人 <input id="sw-w-who" type="text" placeholder="選填" autocomplete="off" /></label>
            <label>備註 <input id="sw-w-note" type="text" placeholder="選填" /></label>
          </div>
          <button type="button" class="primary" id="sw-w-add">建立工作單</button>
        </section>`
            : ""
        }
        <section class="sw-list">
          <h3>待完成 ${openWorks.length}</h3>
          <div class="sw-cards">${openWorks.length ? openWorks.map(workCard).join("") : `<p class="sw-empty">尚無待完成工作</p>`}</div>
        </section>
        ${
          doneWorks.length
            ? `<section class="sw-list"><h3>最近完成</h3><div class="sw-cards">${doneWorks.map(workCard).join("")}</div></section>`
            : ""
        }
      </div>`
      }`;

    document.getElementById("co-name") &&
      (document.getElementById("co-name").textContent = iAmDriver() ? "調倉接單" : "現場工作");
  }

  function addMove() {
    if (!canCreate()) return setStatus("沒有建立調倉權限。", true);
    ensure();
    const day = String(document.getElementById("sw-m-day")?.value || today());
    const backDay = String(document.getElementById("sw-m-back")?.value || "").trim();
    const fromWh = String(document.getElementById("sw-m-from")?.value || "");
    const toWh = String(document.getElementById("sw-m-to")?.value || "");
    const code = String(document.getElementById("sw-m-code")?.value || "").trim();
    const name = String(document.getElementById("sw-m-name")?.value || "").trim();
    const qty = Number(document.getElementById("sw-m-qty")?.value);
    const note = String(document.getElementById("sw-m-note")?.value || "").trim();
    const driver = String(document.getElementById("sw-m-driver")?.value || "").trim();
    if (!code) return setStatus("請填編號。", true);
    if (!name) return setStatus("請填品項。", true);
    if (!Number.isFinite(qty) || qty <= 0) return setStatus("請填件數。", true);
    if (!fromWh || !toWh || fromWh === toWh) return setStatus("請選不同的從／到倉庫。", true);
    const row = {
      id: uid("mv"),
      day,
      backDay,
      fromWh,
      toWh,
      code,
      name,
      qty: typeof round === "function" ? round(qty) : qty,
      note,
      driver,
      takenAt: driver ? Date.now() : 0,
      done: false,
      by: typeof currentStaff === "function" ? currentStaff() || "" : "",
      at: Date.now(),
      doneBy: "",
      doneAt: 0,
      stockApplied: false,
    };
    state.siteMoves.unshift(row);
    save();
    setStatus(
      driver
        ? `已建立調倉並指定 ${driver}：${whLabel(fromWh)} → ${whLabel(toWh)}。`
        : `已建立調倉（開放接單）：${whLabel(fromWh)} → ${whLabel(toWh)}。`,
      false,
    );
    renderPage();
  }

  function takeMove(id) {
    if (!canTake()) return setStatus("沒有接單權限。", true);
    ensure();
    const row = state.siteMoves.find((m) => m.id === id);
    if (!row || row.done) return;
    const me = typeof currentStaff === "function" ? currentStaff() || "" : "";
    if (!me) return setStatus("請先登入。", true);
    if (row.driver && row.driver !== me) {
      return setStatus(`此單已由 ${row.driver} 接單。`, true);
    }
    row.driver = me;
    row.takenAt = Date.now();
    save();
    setStatus(`已接單：${whLabel(row.fromWh)} → ${whLabel(row.toWh)}。`, false);
    renderPage();
  }

  function assignMove(id, driver) {
    if (!canCreate()) return setStatus("沒有指派權限。", true);
    ensure();
    const row = state.siteMoves.find((m) => m.id === id);
    if (!row || row.done) return;
    row.driver = driver;
    row.takenAt = Date.now();
    save();
    setStatus(`已指派給 ${driver}。`, false);
    renderPage();
  }

  function releaseMove(id) {
    if (!canCreate()) return;
    ensure();
    const row = state.siteMoves.find((m) => m.id === id);
    if (!row || row.done) return;
    row.driver = "";
    row.takenAt = 0;
    save();
    setStatus("已改回開放接單。", false);
    renderPage();
  }

  function completeMove(id) {
    ensure();
    const row = state.siteMoves.find((m) => m.id === id);
    if (!row || row.done) return;
    if (!canCompleteMove(row)) return setStatus("請先接單後再完成。", true);
    if (!row.stockApplied) {
      applyMoveStock(row, false);
      row.stockApplied = true;
    }
    row.done = true;
    row.doneBy = typeof currentStaff === "function" ? currentStaff() || "" : "";
    row.doneAt = Date.now();
    save();
    setStatus(`已完成調倉：${whLabel(row.fromWh)} → ${whLabel(row.toWh)}。`, false);
    renderPage();
  }

  function addWork() {
    if (!canCreate()) return setStatus("沒有建立工作單權限。", true);
    ensure();
    const day = String(document.getElementById("sw-w-day")?.value || today());
    const wh = String(document.getElementById("sw-w-wh")?.value || "");
    const title = String(document.getElementById("sw-w-title")?.value || "").trim();
    const who = String(document.getElementById("sw-w-who")?.value || "").trim();
    const note = String(document.getElementById("sw-w-note")?.value || "").trim();
    if (!title) return setStatus("請填工作內容。", true);
    state.siteWorks.unshift({
      id: uid("wk"),
      day,
      wh,
      title,
      who,
      note,
      done: false,
      by: typeof currentStaff === "function" ? currentStaff() || "" : "",
      at: Date.now(),
      doneBy: "",
      doneAt: 0,
    });
    save();
    setStatus("已建立工作單。", false);
    renderPage();
  }

  function deleteMove(id) {
    if (!canCreate()) return setStatus("沒有刪除權限。", true);
    ensure();
    const ix = state.siteMoves.findIndex((m) => m.id === id);
    if (ix < 0) return;
    const row = state.siteMoves[ix];
    if (!confirm(`確定刪除調倉單「${whLabel(row.fromWh)} → ${whLabel(row.toWh)} ${row.name}」？`)) return;
    if (row.stockApplied && row.done) {
      applyMoveStock(row, true);
    }
    if (typeof pushAudit === "function") {
      pushAudit("move", "delete", `調倉 ${whLabel(row.fromWh)}→${whLabel(row.toWh)} ${row.code} ${row.name}×${row.qty}`, {
        ...row,
      });
    }
    state.siteMoves.splice(ix, 1);
    save();
    setStatus("已刪除調倉單。", false);
    renderPage();
  }

  function deleteWork(id) {
    if (!canCreate()) return setStatus("沒有刪除權限。", true);
    ensure();
    const ix = state.siteWorks.findIndex((w) => w.id === id);
    if (ix < 0) return;
    const row = state.siteWorks[ix];
    if (!confirm(`確定刪除工作單「${row.title}」？`)) return;
    if (typeof pushAudit === "function") {
      pushAudit("work", "delete", `工作單 ${row.day} ${row.title}`, { ...row });
    }
    state.siteWorks.splice(ix, 1);
    save();
    setStatus("已刪除工作單。", false);
    renderPage();
  }

  function completeWork(id) {
    if (!canCreate()) return setStatus("沒有權限。", true);
    ensure();
    const row = state.siteWorks.find((w) => w.id === id);
    if (!row || row.done) return;
    row.done = true;
    row.doneBy = typeof currentStaff === "function" ? currentStaff() || "" : "";
    row.doneAt = Date.now();
    save();
    setStatus("工作單已完成打勾。", false);
    renderPage();
  }

  function bindOnce() {
    if (document.body.dataset.swBound === "1") return;
    document.body.dataset.swBound = "1";
    document.body.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-sw-tab]");
      if (tab) {
        swTab = tab.getAttribute("data-sw-tab") === "work" ? "work" : "move";
        renderPage();
        return;
      }
      if (e.target.closest("#sw-m-add")) {
        addMove();
        return;
      }
      if (e.target.closest("#sw-w-add")) {
        addWork();
        return;
      }
      const take = e.target.closest("[data-sw-take]");
      if (take) {
        takeMove(take.getAttribute("data-sw-take"));
        return;
      }
      const asg = e.target.closest("[data-sw-assign]");
      if (asg) {
        assignMove(asg.getAttribute("data-sw-assign"), asg.getAttribute("data-sw-driver") || "");
        return;
      }
      const rel = e.target.closest("[data-sw-release]");
      if (rel) {
        releaseMove(rel.getAttribute("data-sw-release"));
        return;
      }
      const md = e.target.closest("[data-sw-move-done]");
      if (md) {
        completeMove(md.getAttribute("data-sw-move-done"));
        return;
      }
      const mdel = e.target.closest("[data-sw-move-del]");
      if (mdel) {
        deleteMove(mdel.getAttribute("data-sw-move-del"));
        return;
      }
      const wd = e.target.closest("[data-sw-work-done]");
      if (wd) {
        completeWork(wd.getAttribute("data-sw-work-done"));
        return;
      }
      const wdel = e.target.closest("[data-sw-work-del]");
      if (wdel) deleteWork(wdel.getAttribute("data-sw-work-del"));
    });
  }

  window.renderSiteWork = function () {
    bindOnce();
    ensure();
    renderPage();
  };

  window.__siteWorkReady = true;
})();
