const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { parseLineOrderText, parseLineOrderBlocks, worthKeeping } = require("./line-parse.js");

const { pathToFileURL } = require("url");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5174;
function pickDataDir() {
  const candidates = [process.env.DATA_DIR, path.join(ROOT, "data"), path.join(os.tmpdir(), "veg-inventory-data")].filter(Boolean);
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch (_) {}
  }
  return path.join(ROOT, "data");
}
const DATA_DIR = pickDataDir();
const DATA_FILE = path.join(DATA_DIR, "sync.json");
const LINE_FILE = path.join(DATA_DIR, "line-drafts.json");
const SKIP = new Set([".git", "node_modules", "data"]);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

function safe(urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  const resolved = path.normalize(path.join(ROOT, decoded));
  if (!resolved.startsWith(ROOT)) return null;
  const rel = path.relative(ROOT, resolved).split(path.sep)[0];
  if (SKIP.has(rel)) return null;
  return resolved;
}

function send(res, code, body, type) {
  res.writeHead(code, { "Content-Type": type || "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
}

function readBodyBuf(req, max = 2e6) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > max) {
        req.destroy();
        reject(new Error("too large"));
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
function readBody(req, max = 2e6) {
  return readBodyBuf(req, max).then((buf) => buf.toString("utf8"));
}

const RACK_STORE = path.join(DATA_DIR, "racks-txns.json");
const RACK_SEED = path.join(ROOT, "racks-txns.json");
let rackParseLib = null;

function loadRackParse() {
  if (rackParseLib) return Promise.resolve(rackParseLib);
  return Promise.all([
    import(pathToFileURL(path.join(ROOT, "rack-parse.mjs")).href),
    import(pathToFileURL(path.join(ROOT, "rack-dedupe.mjs")).href),
  ]).then(([parse, dedupe]) => {
    rackParseLib = { ...parse, ...dedupe };
    return rackParseLib;
  });
}

function readRackFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const j = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const txns = Array.isArray(j?.txns) ? j.txns : Array.isArray(j) ? j : [];
    return txns;
  } catch (_) {
    return null;
  }
}

function loadRackTxns() {
  const stored = readRackFile(RACK_STORE);
  if (stored) return stored;
  const seed = readRackFile(RACK_SEED);
  if (seed) return seed;
  const legacy = [
    path.join(ROOT, "..", "frame-inout", "public", "data", "txns.json"),
    path.join(os.homedir(), "frame-inout", "public", "data", "txns.json"),
  ];
  for (const p of legacy) {
    const txns = readRackFile(p);
    if (txns && txns.length) return txns;
  }
  return [];
}

function saveRackTxns(txns) {
  const payload = JSON.stringify({ txns });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${RACK_STORE}.tmp`;
  fs.writeFileSync(tmp, payload);
  fs.renameSync(tmp, RACK_STORE);
  try {
    fs.writeFileSync(RACK_SEED, payload);
  } catch (_) {}
}

function importRackBuffer(lib, name, buf) {
  const analyzed = lib.analyzeWorkbook(buf, name);
  if (!analyzed.ready) {
    return { ok: false, error: "無法辨識 Excel 欄位", added: 0, dup: 0, skip: 0, total: loadRackTxns().length };
  }
  const mapped = lib.mapRecords(analyzed.records, analyzed.map, {
    directionMode: analyzed.directionMode,
    defaultCompany: analyzed.defaultCompany,
    fileName: name,
  });
  const existing = loadRackTxns();
  const filtered = lib.filterNewTxns(mapped.txns, existing);
  const next = existing.concat(filtered.txns);
  if (filtered.txns.length) saveRackTxns(next);
  return {
    ok: true,
    added: filtered.txns.length,
    dup: filtered.dup,
    skip: mapped.skip.length,
    total: next.length,
    company: analyzed.defaultCompany || "",
  };
}

function rackImportMessage(stats) {
  if (!stats.ok) return stats.error || "匯入失敗";
  if (stats.added === 0 && stats.dup > 0) return "上傳成功。比對資料重複無匯入";
  if (stats.added === 0) return "上傳成功。沒有可匯入的異動列";
  if (stats.dup > 0) return `上傳成功。新增 ${stats.added} 筆。比對資料重複無匯入 ${stats.dup} 筆`;
  return `上傳成功。新增 ${stats.added} 筆`;
}
function todayYmd() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
}
function lineSigOk(rawBuf, header) {
  const secret = process.env.LINE_CHANNEL_SECRET || "";
  if (!secret || !header) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBuf).digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(String(header));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
function loadSyncBundle() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (data && typeof data === "object") return data;
  } catch (_) {}
  return null;
}
function knownCustomersFromStore() {
  const names = [];
  const data = loadSyncBundle();
  if (!data) return names;
  for (const n of data.haCustomers || []) names.push(n);
  const nq = data.nqCustomers || {};
  for (const k of ["leaf", "basil", "herb"]) {
    for (const n of nq[k] || []) names.push(n);
  }
  for (const o of data.orders?.orders || []) {
    if (o?.customer) names.push(o.customer);
  }
  return names;
}
function loadLineDrafts() {
  try {
    const data = JSON.parse(fs.readFileSync(LINE_FILE, "utf8"));
    if (data && Array.isArray(data.drafts)) return data;
  } catch (_) {}
  return { drafts: [] };
}
function saveLineDrafts(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${LINE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, LINE_FILE);
}
const lineHookStats = {
  lastAt: 0,
  lastSigOk: null,
  lastTypes: [],
  lastSource: "",
  lastReply: "",
  lastTextPreview: "",
};

function stripLineMentions(text, mention) {
  let t = String(text || "");
  const mentionees = Array.isArray(mention?.mentionees) ? mention.mentionees.slice() : [];
  mentionees.sort((a, b) => (b.index || 0) - (a.index || 0));
  for (const m of mentionees) {
    const i = Number(m.index);
    const n = Number(m.length);
    if (Number.isFinite(i) && Number.isFinite(n) && i >= 0 && n > 0) {
      t = t.slice(0, i) + t.slice(i + n);
    }
  }
  return t.replace(/^[@＠][^\s]+[ \t]*/gm, "").trim();
}

function isGroupChat(ev) {
  const t = ev.source?.type;
  return t === "group" || t === "room";
}

function mentionedThisBot(ev) {
  const mentionees = ev.message?.mention?.mentionees;
  if (Array.isArray(mentionees)) {
    if (mentionees.some((m) => m && m.isSelf === true)) return true;
    const botId = process.env.LINE_BOT_USER_ID || "";
    if (botId && mentionees.some((m) => m && m.userId === botId)) return true;
  }
  const raw = String(ev.message?.text || "");
  return /[@＠]\s*(鴻安農業科技|鴻安)/.test(raw);
}

function lineReply(replyToken, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
  if (!token || !replyToken || !text) {
    lineHookStats.lastReply = !token ? "no-token" : "skip";
    return Promise.resolve();
  }
  const body = JSON.stringify({ replyToken, messages: [{ type: "text", text }] });
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.line.me",
        path: "/v2/bot/message/reply",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8").slice(0, 200);
          lineHookStats.lastReply = `${res.statusCode} ${raw}`;
          console.log("[line] reply", res.statusCode, raw);
          resolve();
        });
      },
    );
    req.on("error", (err) => {
      lineHookStats.lastReply = String(err.message || err);
      console.log("[line] reply error", err.message);
      resolve();
    });
    req.end(body);
  });
}
function handleLineWebhook(req, res) {
  if (req.method === "GET") {
    send(res, 200, '{"ok":true}', TYPES[".json"]);
    return true;
  }
  if (req.method !== "POST") {
    send(res, 405, "Method not allowed");
    return true;
  }
  readBodyBuf(req)
    .then((raw) => {
      const sig = req.headers["x-line-signature"];
      const sigOk = lineSigOk(raw, sig);
      lineHookStats.lastAt = Date.now();
      lineHookStats.lastSigOk = sigOk;
      if (!sigOk) {
        console.log("[line] webhook 401 bad signature");
        return send(res, 401, '{"ok":false}', TYPES[".json"]);
      }
      let payload;
      try {
        payload = JSON.parse(raw.toString("utf8"));
      } catch (_) {
        return send(res, 400, '{"ok":false}', TYPES[".json"]);
      }
      const events = Array.isArray(payload.events) ? payload.events : [];
      lineHookStats.lastTypes = events.map((ev) => ev.type || "");
      lineHookStats.lastSource = events[0]?.source?.type || "";
      console.log("[line] events", lineHookStats.lastTypes.join(",") || "(none)", "source", lineHookStats.lastSource);
      const store = loadLineDrafts();
      let added = 0;
      const replies = [];
      for (const ev of events) {
        if (ev.type === "join" || ev.type === "follow") {
          replies.push(
            lineReply(
              ev.replyToken,
              "下單請先 @鴻安農業科技，第一行寫客人，下面寫品項，例如：\n小琳\n紐20兩袋、密本一箱",
            ),
          );
          continue;
        }
        if (ev.type !== "message" || ev.message?.type !== "text") continue;
        if (isGroupChat(ev) && !mentionedThisBot(ev)) {
          lineHookStats.lastTextPreview = "(群組未@機器人，略過)";
          continue;
        }
        const rawText = String(ev.message.text || "").trim();
        const text = stripLineMentions(rawText, ev.message.mention);
        if (!text) continue;
        lineHookStats.lastTextPreview = text.slice(0, 80);
        const names = knownCustomersFromStore();
        const blocks = parseLineOrderBlocks(text, names);
        const kept = [];
        for (const parsed of blocks) {
          const keep = worthKeeping(parsed) || parsed.lines.length > 0 || parsed.unknown.length > 0;
          if (!keep) continue;
          store.drafts.unshift({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            at: Date.now(),
            date: todayYmd(),
            source: ev.source?.type || "",
            groupId: ev.source?.groupId || "",
            userId: ev.source?.userId || "",
            text: parsed.raw || text,
            customer: parsed.customer || "",
            lines: parsed.lines || [],
            unknown: parsed.unknown || [],
            inbound: !!parsed.inbound,
          });
          kept.push(parsed);
          added += 1;
        }
        if (!kept.length) continue;
        const n = kept.length;
        const reply =
          n > 1
            ? `已收到 ${n} 筆待確認（可稍後在網頁一筆一筆核對）。`
            : kept[0].inbound
              ? kept[0].lines.length
                ? "【進貨】已收到，待會計在網頁確認記入庫存（不是出貨訂單）。"
                : "【進貨】已收到，但沒對到品項。請寫例如：地瓜葉誌進貨57。"
              : kept[0].lines.length
                ? "【出貨訂單】已收到，待會計在網頁確認列入訂單（不是進貨）。"
                : "【出貨訂單】已收到，但沒對到品項。請第一行寫客人，下面寫例如：紐20兩袋、密本一箱。群組一定要先 @鴻安農業科技。";
        replies.push(lineReply(ev.replyToken, reply));
      }
      if (store.drafts.length > 80) store.drafts = store.drafts.slice(0, 80);
      if (added) saveLineDrafts(store);
      send(res, 200, '{"ok":true}', TYPES[".json"]);
      Promise.all(replies).catch(() => {});
    })
    .catch(() => send(res, 400, '{"ok":false}', TYPES[".json"]));
  return true;
}
function handleLineDrafts(req, res) {
  if (req.method === "GET") {
    send(res, 200, JSON.stringify(loadLineDrafts()), TYPES[".json"]);
    return true;
  }
  if (req.method === "POST") {
    readBody(req)
      .then((raw) => {
        const body = JSON.parse(raw || "{}");
        const store = loadLineDrafts();
        if (body.action === "drop" && body.id) {
          store.drafts = store.drafts.filter((d) => d.id !== body.id);
          saveLineDrafts(store);
        } else if (body.action === "update" && body.id) {
          const draft = store.drafts.find((d) => d.id === body.id);
          if (draft) {
            if ("customer" in body) draft.customer = String(body.customer || "").trim();
            if (Array.isArray(body.lines)) {
              draft.lines = body.lines.map((l) => {
                const line = {
                  skuId: String(l?.skuId || ""),
                  qty: Number(l?.qty) || 0,
                };
                if (l?.pack) line.pack = String(l.pack);
                if (l?.size) line.size = String(l.size);
                if (l?.pallet) line.pallet = true;
                if (l?.note) line.note = String(l.note);
                return line;
              });
            }
            saveLineDrafts(store);
          }
        }
        send(res, 200, '{"ok":true}', TYPES[".json"]);
      })
      .catch(() => send(res, 400, '{"ok":false}', TYPES[".json"]));
    return true;
  }
  send(res, 405, "Method not allowed");
  return true;
}

function handleApi(req, res) {
  const urlPath = (req.url || "").split("?")[0];
  if (urlPath.startsWith("/api/") && req.method === "OPTIONS") {
    res.writeHead(204, { "Cache-Control": "no-store" });
    res.end();
    return true;
  }
  if (urlPath === "/api/line/webhook") return handleLineWebhook(req, res);
  if (urlPath === "/api/line/drafts") return handleLineDrafts(req, res);
  if (urlPath === "/api/racks-txns") {
    if (req.method !== "GET") {
      send(res, 405, "Method not allowed");
      return true;
    }
    send(res, 200, JSON.stringify({ txns: loadRackTxns() }), TYPES[".json"]);
    return true;
  }
  if (urlPath === "/api/racks-import") {
    if (req.method !== "POST") {
      send(res, 405, "Method not allowed");
      return true;
    }
    readBody(req, 25e6)
      .then((raw) => {
        const body = JSON.parse(raw);
        const files = Array.isArray(body?.files) ? body.files : body?.name ? [body] : [];
        if (!files.length) throw new Error("no files");
        return loadRackParse().then((lib) => {
          let added = 0;
          let dup = 0;
          let skip = 0;
          const names = [];
          for (const f of files) {
            const name = String(f.name || "upload.xls");
            const b64 = String(f.data || "").replace(/^data:.*,/, "");
            const buf = Buffer.from(b64, "base64");
            const one = importRackBuffer(lib, name, buf);
            if (!one.ok) return one;
            added += one.added;
            dup += one.dup;
            skip += one.skip;
            names.push(name);
          }
          const stats = { ok: true, added, dup, skip, total: loadRackTxns().length, files: names };
          stats.message = rackImportMessage(stats);
          return stats;
        });
      })
      .then((stats) => {
        send(res, stats.ok ? 200 : 400, JSON.stringify(stats), TYPES[".json"]);
      })
      .catch((err) => {
        const msg = String(err?.message || err);
        const code = msg === "too large" ? 413 : 400;
        send(res, code, JSON.stringify({ ok: false, error: msg === "too large" ? "檔案太大" : "匯入失敗" }), TYPES[".json"]);
      });
    return true;
  }
  if (urlPath === "/api/line/status") {
    send(
      res,
      200,
      JSON.stringify({
        configured: !!(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN),
        lastWebhookAt: lineHookStats.lastAt || null,
        lastSigOk: lineHookStats.lastSigOk,
        lastTypes: lineHookStats.lastTypes,
        lastSource: lineHookStats.lastSource,
        lastReply: lineHookStats.lastReply,
        lastTextPreview: lineHookStats.lastTextPreview,
      }),
      TYPES[".json"],
    );
    return true;
  }
  if (urlPath !== "/api/data") return false;
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Cache-Control": "no-store" });
    res.end();
    return true;
  }
  if (req.method === "GET") {
    fs.readFile(DATA_FILE, "utf8", (err, data) => {
      send(res, 200, err ? '{"updatedAt":0}' : data, TYPES[".json"]);
    });
    return true;
  }
  if (req.method === "PUT" || req.method === "POST") {
    readBody(req)
      .then((raw) => {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad");
        fs.mkdirSync(DATA_DIR, { recursive: true });
        const tmp = `${DATA_FILE}.tmp`;
        fs.writeFile(tmp, JSON.stringify(parsed), (err) => {
          if (err) return send(res, 500, '{"ok":false}', TYPES[".json"]);
          fs.rename(tmp, DATA_FILE, (err2) => {
            if (err2) {
              fs.copyFile(tmp, DATA_FILE, (err3) => {
                if (err3) return send(res, 500, '{"ok":false}', TYPES[".json"]);
                send(res, 200, '{"ok":true}', TYPES[".json"]);
              });
              return;
            }
            send(res, 200, '{"ok":true}', TYPES[".json"]);
          });
        });
      })
      .catch(() => send(res, 400, '{"ok":false}', TYPES[".json"]));
    return true;
  }
  send(res, 405, "Method not allowed");
  return true;
}

const server = http.createServer((req, res) => {
  if (handleApi(req, res)) return;
  let file = safe(req.url === "/" ? "/index.html" : req.url);
  if (!file) return send(res, 403, "Forbidden");
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      const index = path.join(ROOT, "index.html");
      return fs.readFile(index, (e2, data) => {
        if (e2) return send(res, 404, "Not found");
        send(res, 200, data, TYPES[".html"]);
      });
    }
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    fs.readFile(file, (e2, data) => {
      if (e2) return send(res, 500, "Error");
      send(res, 200, data, type);
    });
  });
});

server.listen(PORT, () => {
  console.log(`veg-inventory listening on ${PORT}`);
});
