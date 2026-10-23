const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const LOGIN_URL = "https://amis.afa.gov.tw/m_coop/CoopVegLogin1.aspx?shem=aimgspe,";
const LOGIN2_URL = "https://amis.afa.gov.tw/m_coop/CoopVegLogin2.aspx";
const QUERY_URL = "https://amis.afa.gov.tw/m_coop/CoopVegSupplierTransInfoQuery.aspx";
const CAPTCHA_URL = "https://amis.afa.gov.tw/CreateValidationCodeImage.aspx";

const HOUSES = {
  xinfeng: { mode: "supply", subs: ["493", "930", "168", "830"], envUser: "AMIS_XINFENG_USER", envPass: "AMIS_XINFENG_PASS", loginUrl: LOGIN_URL },
  yongfang: { mode: "sub", subs: ["050", "066", "168", "070"], supplyNo: "N99833", loginUrl: LOGIN2_URL },
};

const jars = new Map();
const pending = new Map();

function loadAccount(house, dataDir) {
  const spec = HOUSES[house];
  if (!spec) return null;
  if (spec.mode === "sub") {
    let user = spec.supplyNo || "";
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dataDir, "amis-login.json"), "utf8"));
      const row = j[house] || {};
      user = String(row.user || user).trim();
    } catch (_) {}
    return { mode: "sub", user, subs: spec.subs.slice(), loginUrl: spec.loginUrl };
  }
  let user = process.env[spec.envUser] || "";
  let pass = process.env[spec.envPass] || "";
  if (!user || !pass) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dataDir, "amis-login.json"), "utf8"));
      const row = j[house] || {};
      user = user || String(row.user || "");
      pass = pass || String(row.pass || "");
    } catch (_) {}
  }
  return { mode: "supply", user: user.trim(), pass, subs: spec.subs, loginUrl: spec.loginUrl };
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(jar, setCookie) {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const raw of list) {
    const pair = String(raw).split(";")[0];
    const i = pair.indexOf("=");
    if (i < 1) continue;
    jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}

function request(method, urlStr, jar, { headers, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      {
        method,
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          "User-Agent": "Mozilla/5.0",
          Cookie: cookieHeader(jar),
          ...(headers || {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          storeCookies(jar, res.headers["set-cookie"]);
          resolve({
            status: res.statusCode,
            location: res.headers.location || "",
            type: String(res.headers["content-type"] || ""),
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.setTimeout(25000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function requestFollow(method, urlStr, jar, opts, hops = 0) {
  const res = await request(method, urlStr, jar, opts);
  if (hops < 5 && res.status >= 300 && res.status < 400 && res.location) {
    const next = new URL(res.location, urlStr).toString();
    return requestFollow("GET", next, jar, {}, hops + 1);
  }
  return res;
}

function formFields(html) {
  const fields = {};
  const read = (raw) => String(raw || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  for (const m of html.matchAll(/<input\b([^>]*)>/gi)) {
    const tag = m[1];
    const name = (tag.match(/\bname="([^"]*)"/i) || [])[1];
    if (!name) continue;
    const type = ((tag.match(/\btype="([^"]*)"/i) || [])[1] || "text").toLowerCase();
    if ((type === "checkbox" || type === "radio") && !/\bchecked\b/i.test(tag)) continue;
    if (type === "submit" || type === "button" || type === "image") continue;
    const value = (tag.match(/\bvalue="([^"]*)"/i) || [])[1] || "";
    fields[name] = read(value);
  }
  for (const m of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const name = (m[1].match(/\bname="([^"]*)"/i) || [])[1];
    if (!name) continue;
    const selected = m[2].match(/<option\b[^>]*\bselected\b[^>]*value="([^"]*)"/i)
      || m[2].match(/<option\b[^>]*value="([^"]*)"/i);
    fields[name] = read(selected ? selected[1] : "");
  }
  return fields;
}

function pageSizeOnForm(html) {
  const name = "ctl00$contentPlaceHolder$txtPerPageRows";
  const block = html.match(new RegExp(`<select\\b[^>]*name="${name.replace(/\$/g, "\\$")}"[\\s\\S]*?</select>`, "i"));
  if (block) {
    const values = [...block[0].matchAll(/value="(\d+)"/gi)].map((m) => m[1]);
    const selected = block[0].match(/<option\b[^>]*\bselected\b[^>]*value="(\d+)"/i);
    if (values.includes("200")) return "200";
    if (selected) return selected[1];
    if (values.includes("60")) return "60";
    return values.length ? values[values.length - 1] : "";
  }
  return "";
}

function isServerError(html) {
  return /處理您的要求時發生錯誤|Server Error|Runtime Error/i.test(String(html || ""));
}

function encodeForm(fields) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    const list = Array.isArray(value) ? value : [value];
    for (const item of list) params.append(key, item == null ? "" : String(item));
  }
  return params.toString();
}

function alertText(html) {
  const m = html.match(/alert\(\s*['"]([^'"]*)['"]/);
  if (m) return m[1];
  return html.includes("查無") ? "查無資料" : "";
}

function decodeText(buf) {
  const utf = buf.toString("utf8");
  if (utf.includes("品名代號") || utf.includes("查無") || utf.includes("txtSupply")) return utf;
  try {
    const big = new TextDecoder("big5").decode(buf);
    if (big.includes("品名") || big.includes("查無")) return big;
  } catch (_) {}
  return utf;
}

function isLoginPage(html) {
  return html.includes("txtValCode") || html.includes("txtPassword");
}

async function beginLogin(key, account) {
  const jar = new Map();
  const page = await requestFollow("GET", account.loginUrl, jar);
  const html = decodeText(page.body);
  const fields = formFields(html);
  const img = await request("GET", CAPTCHA_URL, jar);
  pending.set(key, { jar, fields, account, at: Date.now() });
  const out = {
    ok: false,
    needCaptcha: true,
    captcha: img.body.toString("base64"),
    captchaType: img.type || "image/png",
  };
  if (account.sub) out.sub = account.sub;
  return out;
}

async function finishLogin(key, code, account) {
  const hold = pending.get(key);
  if (!hold) return beginLogin(key, account);
  hold.account = account;
  const fields = { ...hold.fields };
  fields["ctl00$contentPlaceHolder$txtSupplyNo"] = hold.account.user;
  if (hold.account.sub) fields["ctl00$contentPlaceHolder$txtSupplySub"] = hold.account.sub;
  fields["ctl00$contentPlaceHolder$txtPassword"] = hold.account.pass;
  fields["ctl00$contentPlaceHolder$txtValCode"] = String(code || "").trim();
  fields.__EVENTTARGET = "ctl00$contentPlaceHolder$btnLogin";
  fields.__EVENTARGUMENT = "";
  fields["ctl00$contentPlaceHolder$btnLogin"] = "登入";
  const body = encodeForm(fields);
  const res = await requestFollow("POST", hold.account.loginUrl, hold.jar, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body),
      Referer: hold.account.loginUrl,
    },
    body,
  });
  const html = decodeText(res.body);
  if (isLoginPage(html)) {
    pending.delete(key);
    const again = await beginLogin(key, hold.account);
    again.error = alertText(html) || (hold.account.sub ? `小代號 ${hold.account.sub} 登入沒有成功，請重填驗證碼。` : "登入沒有成功，請重填驗證碼。");
    return again;
  }
  jars.set(key, hold.jar);
  pending.delete(key);
  return null;
}

function rocDate(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${y - 1911}/${m}/${d}`;
}

function addIsoDay(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function normMarket(raw) {
  const s = String(raw || "");
  const rules = [
    [/二市|台北二|臺北二/, "二市"],
    [/一市|台北一|臺北一/, "一市"],
    [/板橋/, "板橋"],
    [/三重/, "三重"],
    [/桃/, "桃園"],
    [/豐原/, "豐原"],
    [/台中|臺中/, "台中"],
    [/高雄/, "高雄"],
    [/鳳山/, "鳳山"],
    [/屏東/, "屏東"],
    [/花蓮/, "花蓮"],
  ];
  for (const [re, name] of rules) if (re.test(s)) return name;
  return s.replace(/\s+/g, "").replace(/^\d+/, "").replace(/市場$/, "") || s.trim();
}

function normSub(raw) {
  const s = String(raw || "").trim();
  if (/^\d+$/.test(s) && s.length < 3) return s.padStart(3, "0");
  return s;
}

function parseAuctionRows(html) {
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const rows = [];
  let on = false;
  let heads = [];
  for (const m of clean.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
    const cells = [...m[0].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/\s+/g, " ")
        .trim(),
    );
    if (cells.some((c) => c.includes("品名代號"))) {
      on = true;
      heads = cells;
      continue;
    }
    if (!on || cells.length < 8) continue;
    const at = (re, fallback) => {
      const i = heads.findIndex((h) => re.test(String(h || "").replace(/\s+/g, "")));
      return i >= 0 ? i : fallback;
    };
    const dateIndex = at(/日期/, 0);
    if (!/^\d{2,3}\/\d{1,2}\/\d{1,2}$/.test(cells[dateIndex] || "")) continue;
    const num = (i) => (i >= 0 ? Number(String(cells[i] || "").replace(/,/g, "")) || 0 : 0);
    const qty = num(at(/件數/, 7));
    if (!qty) continue;
    const price = num(at(/單價/, -1));
    const wt = num(at(/淨重|重量/, -1));
    const amtIndex = heads.findIndex((h) => /總價|金額/.test(h) && !/手續|運費|實拿/.test(h));
    let amt = num(amtIndex);
    if (!amt && price && wt) amt = Math.round(price * wt * 100) / 100;
    const nameIndex = heads.findIndex((h) => /品名/.test(h) && !/代號/.test(h));
    const subIndex = at(/小代號/, 2);
    const mkIndex = at(/市場/, 1);
    rows.push({
      mk: normMarket(cells[mkIndex] || ""),
      sub: normSub(cells[subIndex] || ""),
      sku: cells[at(/品名代號/, 4)] || "",
      name: cells[nameIndex >= 0 ? nameIndex : 5] || "",
      qty,
      price,
      wt,
      amt,
    });
  }
  return rows;
}

async function postBill(jar, html, { billDate, sub, supplyNo }) {
  const fields = formFields(html);
  const roc = rocDate(billDate);
  const setIf = (name, value) => {
    if (Object.prototype.hasOwnProperty.call(fields, name)) fields[name] = value;
  };
  setIf("ctl00$contentPlaceHolder$txtStartDate", roc);
  setIf("ctl00$contentPlaceHolder$txtEndDate", roc);
  if (supplyNo) setIf("ctl00$contentPlaceHolder$txtSupplyNo", supplyNo);
  const subName = "ctl00$contentPlaceHolder$txtSupplySub";
  if (Object.prototype.hasOwnProperty.call(fields, subName)) fields[subName] = sub ? normSub(sub) : "";
  const pageName = "ctl00$contentPlaceHolder$txtPerPageRows";
  const pageSize = pageSizeOnForm(html);
  if (pageSize) setIf(pageName, pageSize);
  else if (Object.prototype.hasOwnProperty.call(fields, pageName)) fields[pageName] = "999";
  const marketRadio = "ctl00$contentPlaceHolder$ucCoopVegFruitMarket$radAllMarket";
  const marketHidden = "ctl00_contentPlaceHolder_ucCoopVegFruitMarket";
  if (html.includes(`name="${marketRadio}"`)) {
    fields[marketRadio] = "radAllMarket";
    setIf(marketHidden, "ALL");
  }
  fields.__EVENTTARGET = "ctl00$contentPlaceHolder$btnQuery";
  fields.__EVENTARGUMENT = "";
  fields["ctl00$contentPlaceHolder$btnQuery"] = "查詢";
  const body = encodeForm(fields);
  const res = await requestFollow("POST", QUERY_URL, jar, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body),
      Referer: QUERY_URL,
    },
    body,
  });
  return { html: decodeText(res.body), pageSize: fields["ctl00$contentPlaceHolder$txtPerPageRows"] };
}

async function queryBill(key, billDate, sub, supplyNo) {
  const jar = jars.get(key);
  if (!jar) return { auth: false };
  const page = await requestFollow("GET", QUERY_URL, jar);
  const html = decodeText(page.body);
  if (isLoginPage(html)) return { auth: false };
  let posted = await postBill(jar, html, { billDate, sub, supplyNo });
  if (isServerError(posted.html)) {
    const again = await requestFollow("GET", QUERY_URL, jar);
    const html2 = decodeText(again.body);
    if (!isLoginPage(html2)) posted = await postBill(jar, html2, { billDate, sub, supplyNo });
  }
  const out = posted.html;
  if (isLoginPage(out)) return { auth: false };
  if (isServerError(out)) return { auth: true, rows: [], note: "", sawTable: false };
  const note = alertText(out);
  const sawTable = out.includes("件數") && out.includes("品名代號");
  const rows = note && note.includes("查無") ? [] : parseAuctionRows(out);
  if (!rows.length) {
    try {
      const text = out.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 500);
      fs.writeFileSync(path.join(__dirname, "data", "tmp-amis-last.txt"), [
        new Date().toISOString(),
        `sub=${sub || ""}`,
        `page=${posted.pageSize}`,
        `sawTable=${sawTable}`,
        `note=${note || ""}`,
        text,
      ].join("\n"), "utf8");
    } catch (_) {}
  }
  return { auth: true, rows, note, sawTable };
}

async function querySupply(house, account, billDate, captcha) {
  if (captcha) {
    const held = pending.get(house);
    if (held) held.account = account;
    const failed = await finishLogin(house, captcha, account);
    if (failed) return failed;
  }
  let queried = jars.has(house) ? await queryBill(house, billDate, "") : { auth: false };
  if (!queried.auth) {
    jars.delete(house);
    return beginLogin(house, account);
  }
  const allow = new Set(account.subs.map(normSub));
  const rows = queried.rows.filter((r) => allow.has(normSub(r.sub)));
  return { ok: true, billDate, subs: account.subs, rows, note: queried.note || "", sawTable: !!queried.sawTable };
}

async function querySubs(house, account, billDate, captcha) {
  const rows = [];
  const notes = [];
  let sawTable = false;
  for (const sub of account.subs) {
    const key = `${house}:${sub}`;
    const subAccount = { ...account, sub, pass: sub };
    let queried = jars.has(key) ? await queryBill(key, billDate, sub, account.user) : { auth: false };
    if (!queried.auth) {
      jars.delete(key);
      if (captcha && pending.has(key)) {
        const failed = await finishLogin(key, captcha, subAccount);
        if (failed) return failed;
        queried = await queryBill(key, billDate, sub, account.user);
      } else {
        return beginLogin(key, subAccount);
      }
    }
    if (!queried.auth) {
      jars.delete(key);
      return beginLogin(key, subAccount);
    }
    if (queried.sawTable) sawTable = true;
    if (queried.note) notes.push(queried.note);
    const code = normSub(sub);
    rows.push(
      ...(queried.rows || [])
        .filter((r) => {
          const got = normSub(r.sub);
          return !got || got === code;
        })
        .map((r) => ({ ...r, sub: code })),
    );
  }
  return { ok: true, billDate, subs: account.subs, rows, note: notes.filter(Boolean).join(" "), sawTable };
}

async function auctionQuery({ house, shipDate, captcha, dataDir }) {
  const account = loadAccount(house, dataDir);
  if (!account) return { ok: false, error: "這家還沒有開放自動回對。" };
  if (account.mode !== "sub" && (!account.user || !account.pass)) return { ok: false, error: "這家的拍賣帳號還沒設定。" };
  if (account.mode === "sub" && !account.user) return { ok: false, error: "這家的供應代號還沒設定。" };
  const billDate = addIsoDay(shipDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(billDate)) return { ok: false, error: "寄送日不正確。" };
  if (account.mode === "sub") return querySubs(house, account, billDate, captcha);
  return querySupply(house, account, billDate, captcha);
}

module.exports = { auctionQuery };
