const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const GH = "C:\\Program Files\\GitHub CLI\\gh.exe";
const REPO = "chungyafang188-wq/veg-inventory-backup";
const KEEP_DAYS = 30;

function loadDotEnv() {
  try {
    const raw = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
    for (const line of raw.split(/\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      if (process.env[k]) continue;
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[k] = v;
    }
  } catch (_) {}
}

function run(cmd, args, opts) {
  const res = spawnSync(cmd, args, { encoding: "utf8", windowsHide: true, ...(opts || {}) });
  if (res.status !== 0) {
    const detail = (res.stderr || res.stdout || "").trim();
    throw new Error(detail || `${path.basename(cmd)} failed`);
  }
  return res.stdout || "";
}

function ymd(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function assertPrivate() {
  const out = run(GH, ["repo", "view", REPO, "--json", "visibility,isPrivate"]);
  const info = JSON.parse(out);
  if (info.visibility !== "PRIVATE" || info.isPrivate !== true) {
    throw new Error("備份倉庫不是私人的，已停止上傳。");
  }
}

async function readNeon() {
  const connectionString = String(process.env.DATABASE_URL || "").trim();
  if (!connectionString) return { ok: false, reason: "沒有資料庫連線" };
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
    max: 1,
  });
  try {
    const found = await pool.query("SELECT id, updated_at, doc FROM app_state ORDER BY id");
    return {
      ok: true,
      rows: found.rows.map((row) => ({
        id: row.id,
        updatedAt: Number(row.updated_at) || 0,
        doc: row.doc,
      })),
    };
  } finally {
    await pool.end();
  }
}

function copyDataFiles(dir) {
  const dataDir = path.join(ROOT, "data");
  const names = [];
  if (!fs.existsSync(dataDir)) return names;
  for (const name of fs.readdirSync(dataDir)) {
    if (!name.endsWith(".json")) continue;
    fs.copyFileSync(path.join(dataDir, name), path.join(dir, name));
    names.push(name);
  }
  const envPath = path.join(ROOT, ".env");
  if (fs.existsSync(envPath)) {
    fs.copyFileSync(envPath, path.join(dir, "env.backup"));
    names.push("env.backup");
  }
  return names;
}

function prune(today) {
  const out = run(GH, ["release", "list", "--repo", REPO, "--limit", "100", "--json", "tagName,createdAt"]);
  const rows = JSON.parse(out || "[]");
  const cutoff = Date.parse(`${today}T00:00:00+08:00`) - KEEP_DAYS * 86400000;
  for (const row of rows) {
    if (!String(row.tagName || "").startsWith("backup-")) continue;
    const at = Date.parse(row.createdAt || "");
    if (!Number.isFinite(at) || at >= cutoff) continue;
    run(GH, ["release", "delete", row.tagName, "--repo", REPO, "--yes", "--cleanup-tag"]);
    console.log(`removed ${row.tagName}`);
  }
}

async function main() {
  loadDotEnv();
  assertPrivate();
  const today = ymd(new Date());
  const tag = `backup-${today}`;
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "veg-backup-"));
  const zip = path.join(os.tmpdir(), `${tag}.zip`);
  try {
    const names = copyDataFiles(work);
    let neonIds = [];
    try {
      const neon = await readNeon();
      if (neon.ok) {
        neonIds = neon.rows.map((row) => row.id);
        fs.writeFileSync(path.join(work, "neon-app-state.json"), JSON.stringify({ exportedAt: new Date().toISOString(), rows: neon.rows }));
        names.push("neon-app-state.json");
      } else {
        fs.writeFileSync(path.join(work, "neon-error.txt"), neon.reason);
      }
    } catch (err) {
      fs.writeFileSync(path.join(work, "neon-error.txt"), "資料庫匯出失敗");
      console.error(err && err.message ? err.message : err);
    }
    if (fs.existsSync(zip)) fs.unlinkSync(zip);
    run("tar", ["-a", "-cf", zip, "-C", work, "."]);
    spawnSync(GH, ["release", "delete", tag, "--repo", REPO, "--yes", "--cleanup-tag"], { encoding: "utf8", windowsHide: true });
    const created = run(GH, [
      "release",
      "create",
      tag,
      zip,
      "--repo",
      REPO,
      "--title",
      tag,
      "--notes",
      `每日備份 ${today}。檔案：${names.join(", ")}`,
    ]);
    prune(today);
    console.log(`uploaded ${tag}`);
    console.log(`files ${names.join(", ")}`);
    if (neonIds.length) console.log(`database ${neonIds.join(", ")}`);
    const url = (created.match(/https:\/\/github\.com\/\S+/) || [])[0] || `https://github.com/${REPO}/releases/tag/${tag}`;
    console.log(url);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
    if (fs.existsSync(zip)) fs.unlinkSync(zip);
  }
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
