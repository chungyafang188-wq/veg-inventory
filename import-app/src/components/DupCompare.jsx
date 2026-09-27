import { createPortal } from "react-dom";

const ROWS = [
  ["uha", "編號"],
  ["containerNo", "櫃號"],
  ["arriveDay", "到港日"],
  ["product", "品名"],
  ["seller", "賣方"],
];

function show(v) {
  const s = String(v || "").trim();
  return s || "（沒填）";
}

function same(a, b) {
  return String(a || "").trim().toUpperCase() === String(b || "").trim().toUpperCase();
}

/** 編號或櫃號撞到已有資料時，比對兩邊再確認是不是重複填。 */
export function DupCompare({ notice, onClose, onJump }) {
  if (!notice?.existing) return null;
  const typed = notice.typed || {};
  const have = notice.existing;
  const via = notice.via || have.via || "";
  const node = (
    <div className="imp-tw imp-dup-mask" role="presentation" onClick={onClose}>
      <div
        className="imp-dup"
        role="dialog"
        aria-labelledby="imp-dup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="imp-dup-title">{via || "資料"}重複</h3>
        <p>
          清單上已經有這筆。請比對是不是重複填寫。這次沒有再新增。
          {have.where ? ` 原來那筆在「${have.where}」。` : ""}
          {have.where === "已刪除" ? " 要找回請到舊資料按放回。" : ""}
        </p>
        <table>
          <thead>
            <tr>
              <th />
              <th>你剛填的</th>
              <th>清單上已有</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([key, lab]) => {
              const left = typed[key];
              const right = have[key];
              const hit = (via === "編號" && key === "uha") || (via === "櫃號" && key === "containerNo");
              const diff = !hit && String(left || "").trim() && String(right || "").trim() && !same(left, right);
              return (
                <tr key={key} className={hit ? "is-hit" : diff ? "is-diff" : ""}>
                  <th>{lab}</th>
                  <td>{show(left)}</td>
                  <td>{show(right)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="imp-dup-actions">
          {have.uha && have.where !== "已刪除" && onJump ? (
            <button type="button" className="imp-btn-ghost" onClick={() => onJump(have.uha)}>
              看原來那筆
            </button>
          ) : null}
          <button type="button" className="imp-btn-primary" onClick={onClose}>
            知道了
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(node, document.body);
}
