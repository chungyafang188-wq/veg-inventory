import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { analyzeWorkbook, mapRecords } from "./rack-parse.mjs";
import { filterNewTxns } from "./rack-dedupe.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: node seed-racks.mjs <xls>...");
  process.exit(1);
}

const storePath = path.join(ROOT, "racks-txns.json");
let existing = [];
try {
  const j = JSON.parse(fs.readFileSync(storePath, "utf8"));
  existing = Array.isArray(j?.txns) ? j.txns : [];
} catch (_) {}

let added = 0;
let dup = 0;
for (const file of files) {
  const name = path.basename(file);
  const buf = fs.readFileSync(file);
  const analyzed = analyzeWorkbook(buf, name);
  if (!analyzed.ready) {
    console.error("cannot parse", name, analyzed.notes);
    process.exit(1);
  }
  const mapped = mapRecords(analyzed.records, analyzed.map, {
    directionMode: analyzed.directionMode,
    defaultCompany: analyzed.defaultCompany,
    fileName: name,
  });
  const filtered = filterNewTxns(mapped.txns, existing);
  existing = existing.concat(filtered.txns);
  added += filtered.txns.length;
  dup += filtered.dup;
  console.log(name, "company=", analyzed.defaultCompany, "rows=", mapped.txns.length, "new=", filtered.txns.length, "dup=", filtered.dup);
}

fs.writeFileSync(storePath, JSON.stringify({ txns: existing }));
fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "data", "racks-txns.json"), JSON.stringify({ txns: existing }));
console.log("saved", existing.length, "added", added, "dup", dup);
