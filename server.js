const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5174;
const SKIP = new Set([".git", "node_modules"]);
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
  res.writeHead(code, { "Content-Type": type || "text/plain; charset=utf-8", "Cache-Control": "no-cache" });
  res.end(body);
}

const server = http.createServer((req, res) => {
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
