export function txnFingerprint(t) {
  return [
    String(t.date || "").trim(),
    String(t.company || "").trim(),
    String(t.customer || "").trim(),
    String(t.frame || "").trim(),
    String(t.direction || "").trim(),
    String(Number(t.qty) || 0),
    String(t.doc || "").trim(),
  ].join("|");
}

function countByFp(rows) {
  const m = new Map();
  for (const t of rows || []) {
    const fp = txnFingerprint(t);
    m.set(fp, (m.get(fp) || 0) + 1);
  }
  return m;
}

export function filterNewTxns(incoming, existing) {
  const have = countByFp(existing);
  const used = new Map();
  const txns = [];
  let dup = 0;
  for (const t of incoming || []) {
    const fp = txnFingerprint(t);
    const next = (used.get(fp) || 0) + 1;
    used.set(fp, next);
    if (next <= (have.get(fp) || 0)) {
      dup += 1;
      continue;
    }
    txns.push({ ...t, id: `${fp}#${next}` });
  }
  return { txns, dup };
}
