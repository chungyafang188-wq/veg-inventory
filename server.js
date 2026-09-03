const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { parseLineOrderText, parseLineOrderBlocks, worthKeeping } = require("./line-parse.js");

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
