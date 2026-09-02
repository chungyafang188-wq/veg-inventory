const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5174;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "sync.json");
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

function readBody(req, max = 2e6) {
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
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function handleApi(req, res) {
  const urlPath = (req.url || "").split("?")[0];
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
        fs.writeFile(DATA_FILE, JSON.stringify(parsed), (err) => {
          if (err) return send(res, 500, '{"ok":false}', TYPES[".json"]);
          send(res, 200, '{"ok":true}', TYPES[".json"]);
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
