(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LineOrderParse = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const CN = { 半: 0.5, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const ORIGIN = [
    ["紐西蘭", "nz"],
    ["紐西", "nz"],
    ["紐洋", "nz"],
    ["紐", "nz"],
    ["澳洲", "au"],
    ["澳", "au"],
    ["韓洋", "kr"],
    ["韓國", "kr"],
    ["韓", "kr"],
    ["越南", "vn"],
    ["越", "vn"],
  ];

  function takeQty(s) {
    const t = String(s);
    const labeled = t.match(/(\d+(?:\.\d+)?)\s*(?:件|袋|箱|籃)/);
    if (labeled) return { qty: Number(labeled[1]), text: t.replace(labeled[0], " ") };
    const slash = t.match(/\/\s*(\d+(?:\.\d+)?)\s*K?/i);
    if (slash) return { qty: Number(slash[1]), text: t.replace(slash[0], " ") };
    const extraK = t.match(/(\d+(?:\.\d+)?)\s*K/i);
    if (extraK && !/^(12|18|20)$/.test(extraK[1])) {
      return { qty: Number(extraK[1]), text: t.replace(extraK[0], " ") };
    }
    const num = t.match(/(\d+(?:\.\d+)?)/);
    if (num) return { qty: Number(num[1]), text: t.replace(num[1], "") };
    for (const [k, v] of Object.entries(CN)) {
      if (t.includes(k)) return { qty: v, text: t.replace(k, "") };
    }
    return { qty: 1, text: t };
  }

  function onionSku(origin, spec12, purple) {
    return `${purple ? "onp" : "on"}-${origin}-${spec12 ? "12" : "20"}`;
  }

  function normOrderText(s) {
    return String(s || "")
      .replace(/[Ｋｋ]/g, "K")
      .replace(/／/g, "/")
      .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 48));
  }

  function takeOnionSpecQty(s) {
    const orig = normOrderText(s);
    let rest = orig;
    let spec12 = null;
    let size = "";
    if (/特大/.test(rest)) size = "特大";
    else if (/中球/.test(rest)) size = "中球";
    else if (/大球/.test(rest)) size = "大球";
    const labeled = rest.match(/(12|20)\s*K/i);
    if (labeled) {
      spec12 = labeled[1] === "12";
      rest = rest.replace(labeled[0], " ");
    } else if (/特大|大球/.test(orig) && !/20/.test(orig) && !/中球/.test(orig)) {
      spec12 = true;
    }
    rest = rest.replace(/\b18\s*K\b/gi, " ");
    rest = rest.replace(/特大|中球|大球/g, " ");
    const { qty, text } = takeQty(rest);
    return { spec12, qty, text, size };
  }

  function leafPack(s) {
    const t = String(s || "");
    if (/箱裝/.test(t) && !/籃裝/.test(t)) return "箱裝";
    if (/籃裝/.test(t)) return "籃裝";
    if (/箱/.test(t) && !/籃/.test(t)) return "箱裝";
    return "籃裝";
  }

  function isLeafZhi(t) {
    return /誌/.test(t) && /地瓜葉|地瓜/.test(t);
  }

  function isLeafFang(t) {
    if (/綠骨|紅骨|綠九層|紅九層|綠塔|紅塔|九層/.test(t)) return false;
    return /芳/.test(t) && /地瓜葉|地瓜/.test(t);
  }

  const KNOWN_CUSTOMERS = [
    "金芳拍賣-南",
    "金芳拍賣-北",
    "金芳拍賣南",
    "金芳拍賣北",
    "金芳-南",
    "金芳-北",
    "冠瑋",
    "小琳",
    "欣儒",
    "佳合",
    "張紀惠",
  ];
  const NAME_ONLY_BAN = /^(誌|芳|琳|早上|下午|晚上|中午|今日|今天|進貨|入貨|到貨|地瓜葉?|紅骨|綠骨|紐西蘭|韓國|澳洲|越南|紫洋蔥|洋蔥|密本|阿成|薄荷|紫蘇)$/;
  const ITEM_HEAD =
    /^(紅骨|綠骨|紅九層|綠九層|紅塔|綠塔|地瓜葉|地瓜|誌|芳|九層塔|紐洋|紐大|紐特|韓洋|韓大|紐西蘭|韓國|澳洲|越南|紫洋蔥|紫洋|洋蔥|密本|阿成|薄荷|紫蘇|葉誌|葉芳|進貨|入貨|到貨|早上)/;
  const STUCK_ITEM =
    /(紅骨|綠骨|紅九層|綠九層|紅塔|綠塔|地瓜葉|地瓜|九層塔|紐洋|紐大|紐特|韓洋|韓大|紐西蘭|韓國|澳洲|越南|紫洋蔥|紫洋|洋蔥|密本|阿成|薄荷|紫蘇)/;
  const NEXT_ITEM =
    /(?=紅骨|綠骨|紅九層|綠九層|紅塔|綠塔|九層塔|紐洋|紐大|紐特|韓洋|韓大|紫洋蔥|紫洋|密本|阿成|薄荷|紫蘇|洋蔥|(?<![誌芳])地瓜葉)/;
  const NAME_CHARS = "\\u4e00-\\u9fffA-Za-z0-9.·\\-－—";

  function foldHyphen(s) {
    return String(s || "").replace(/[－—–]/g, "-");
  }

  function looksLikeCustomerName(name) {
    const n = String(name || "").trim();
    if (n.length < 2 || n.length > 24) return false;
    if (ITEM_HEAD.test(n)) return false;
    if (NAME_ONLY_BAN.test(n)) return false;
    return true;
  }

  function uniqNames(extra) {
    const set = new Set(KNOWN_CUSTOMERS);
    for (const n of extra || []) {
      const s = foldHyphen(String(n || "")).trim();
      if (s.length >= 2) set.add(s);
    }
    return [...set].sort((a, b) => b.length - a.length);
  }

  function peelKnownName(line, names) {
    const t = foldHyphen(String(line || "")).trim();
    for (const n of names) {
      const name = foldHyphen(n);
      if (!t.startsWith(name)) continue;
      const rest = t.slice(name.length).replace(/^[\s　:：]+/, "");
      if (!rest || ITEM_HEAD.test(rest) || looksLikeItems(rest) || /^\d/.test(rest)) {
        return { customer: name, rest };
      }
    }
    return null;
  }

  function peelCustomer(line, names) {
    let raw = foldHyphen(String(line || "")).trim();
    const labeled = raw.match(/^(?:客人|客戶|出貨對象|收件)[:：\s]+(.+)$/);
    if (labeled) raw = foldHyphen(labeled[1]).trim();
    const known = peelKnownName(raw, names);
    if (known) return known;
    const spaced = raw.match(new RegExp(`^([${NAME_CHARS}]{2,24})\\s+(?=紐|韓|澳|越|紫洋|洋蔥|密本|阿成|地瓜|葉|誌|芳|箱|籃|綠|紅|九層|薄荷|紫蘇|\\d)`));
    if (spaced && looksLikeCustomerName(spaced[1])) {
      return { customer: spaced[1].trim(), rest: raw.slice(spaced[0].length).trim() };
    }
    const stuck = raw.match(new RegExp(`^([${NAME_CHARS}]{2,16})${STUCK_ITEM.source}`));
    if (stuck && looksLikeCustomerName(stuck[1])) {
      return { customer: stuck[1], rest: raw.slice(stuck[1].length).trim() };
    }
    return { customer: "", rest: raw };
  }

  function matchChunk(raw) {
    const pallet = /疊棧板|棧板/.test(raw);
    let s = raw.replace(/疊棧板|棧板/g, "");
    const onionBits = takeOnionSpecQty(s);
    const { qty, text } = onionBits;
    const t = text.replace(/\s+/g, "");
    if (isLeafZhi(t)) {
      return { skuId: "sl-zhi", qty, pack: leafPack(raw + t), pallet };
    }
    if (isLeafFang(t)) {
      return { skuId: "sl-fang", qty, pack: leafPack(raw + t), pallet };
    }
    const greenBasil = /綠骨|綠九層塔|綠九層|綠塔/;
    const redBasil = /紅骨|紅九層塔|紅九層|紅塔/;
    if ((greenBasil.test(t) || /綠芳|綠琳/.test(t)) && /琳/.test(t)) return { skuId: "gb-lin", qty, pallet };
    if (greenBasil.test(t) || /綠芳/.test(t)) return { skuId: "gb-fang", qty, pallet };
    if ((redBasil.test(t) || /紅芳|紅琳/.test(t)) && /琳/.test(t)) return { skuId: "rb-lin", qty, pallet };
    if (redBasil.test(t) || /紅芳/.test(t)) return { skuId: "rb-fang", qty, pallet };
    if (/洋蔥?\s*B|蔥B|洋B/.test(t)) return { skuId: "on-b-kg", qty, pallet };
    if (/南瓜?\s*B|瓜B/.test(t)) return { skuId: "pk-b-kg", qty, pallet };
    if (t.includes("阿成")) return { skuId: onionBits.spec12 === false || /20/.test(raw) ? "pk-ch-20" : "pk-ch-18", qty, pallet };
    if (t.includes("密本") || /東昇/.test(t) || /南瓜/.test(t)) {
      const use20 = onionBits.spec12 === false || /20/.test(raw);
      const use18 = onionBits.spec12 === true || /18/.test(raw);
      return { skuId: use20 && !use18 ? "pk-mi-20" : "pk-mi-18", qty, pallet };
    }
    if (/薄荷/.test(t)) return { skuId: "mint-kg", qty, pallet };
    if (/紫蘇/.test(t) && /斤/.test(t)) return { skuId: "shiso-jin", qty, pallet };
    if (/紫蘇/.test(t)) return { skuId: "shiso-kg", qty, pallet };
    if (/九層塔散|塔散|塔kg/.test(t)) return { skuId: "basil-kg", qty, pallet };
    if (/高麗菜/.test(t)) {
      if (/印尼/.test(t)) return { skuId: "veg-cab-id", qty, pallet };
      if (/越/.test(t)) return { skuId: "veg-cab-vn", qty, pallet };
      return { skuId: "veg-cab-kr", qty, pallet };
    }
    if (/大白菜/.test(t)) {
      if (/越/.test(t)) return { skuId: "veg-nap-vn", qty, pallet };
      return { skuId: "veg-nap-kr", qty, pallet };
    }
    if (/小辣/.test(t)) return { skuId: "veg-chili-sm", qty, pallet };
    if (/大辣|大辣椒|朝天椒/.test(t)) return { skuId: "veg-chili-lg", qty, pallet };
    if (/美生菜/.test(t)) return { skuId: /韓/.test(t) ? "veg-ice-kr" : "veg-ice-vn", qty, pallet };
    if (/西芹/.test(t)) return { skuId: /美/.test(t) ? "veg-cel-us" : "veg-cel-vn", qty, pallet };
    if (/青花/.test(t)) return { skuId: "veg-bro-vn", qty, pallet };
    if (/牛蒡|蘿蔔/.test(t)) return { skuId: /2L|2l/.test(t) ? "veg-bur-2l" : "veg-bur-l", qty, pallet };
    if (/白K|白ｋ/.test(t)) {
      if (/切頭/.test(t)) return { skuId: "veg-wk-cut", qty, pallet };
      if (/2L|2l/.test(t)) return { skuId: "veg-wk-2l", qty, pallet };
      if (/\bM\b|／M|M級/.test(t) || /白KM/.test(t)) return { skuId: "veg-wk-m", qty, pallet };
      return { skuId: "veg-wk-l", qty, pallet };
    }
    const purple = /紫洋蔥|紫洋|紫蔥/.test(t);
    let origin = "";
    for (const [word, code] of ORIGIN) {
      if (t.includes(word)) {
        origin = code;
        break;
      }
    }
    if (origin || purple) {
      const use12 = onionBits.spec12 === true || (onionBits.spec12 == null && /12/.test(t) && !/20/.test(t));
      const line = { skuId: onionSku(origin || "nz", use12, purple), qty, pallet };
      if (onionBits.size) line.size = onionBits.size;
      else if (purple || origin) line.size = "大球";
      return line;
    }
    return null;
  }

  function looksLikeItems(line) {
    return /袋|箱|籃|kg|公斤|件|密本|阿成|紐洋|紐大|紐特|韓洋|韓大|紐西蘭|澳洲|越南|地瓜葉|地瓜|紫洋|洋蔥|南瓜|九層|紅骨|綠骨|高麗菜|大白菜|西芹|青花|牛蒡|蘿蔔|甜椒|朝天椒|美生菜|白K|東昇|進貨|入貨|到貨|\d+\s*K/i.test(
      String(line || ""),
    );
  }

  function looksLikeInbound(raw) {
    return /進貨|入貨|到貨/.test(String(raw || ""));
  }

  function splitItemChunks(body) {
    const rough = body
      .join("、")
      .split(/[、，,;；。．\n]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    const chunks = [];
    for (const piece of rough) {
      const bits = piece.split(NEXT_ITEM).map((x) => x.trim()).filter(Boolean);
      if (bits.length) chunks.push(...bits);
      else chunks.push(piece);
    }
    return chunks;
  }

  function parseLineOrderText(raw, extraNames) {
    const names = uniqNames(extraNames);
    const text = foldHyphen(String(raw || "").replace(/\r/g, "")).trim();
    const unknown = [];
    const lines = [];
    const inbound = looksLikeInbound(text);
    if (!text) return { customer: "", lines, unknown, raw: "", inbound: false };
    const parts = text.split(/\n+/).map((x) => x.trim()).filter(Boolean);
    let customer = "";
    let body = parts;
    if (!inbound) {
      const sameLine = peelCustomer(parts[0] || "", names);
      if (sameLine.customer) {
        customer = sameLine.customer;
        body = [sameLine.rest, ...parts.slice(1)].filter(Boolean);
      } else if (parts.length && looksLikeCustomerName(parts[0]) && !looksLikeItems(parts[0]) && parts[0].length <= 24) {
        customer = parts[0].replace(/^[\d.\s]+/, "").trim();
        body = parts.slice(1);
        if (!body.length) body = parts;
      }
    }
    const chunks = splitItemChunks(body);
    for (const chunk of chunks) {
      if (/^(好|喔|哦|收到|謝謝|ok|OK|進貨|入貨|到貨)$/.test(chunk)) continue;
      const hit = matchChunk(chunk);
      if (hit && hit.qty > 0) {
        const line = { skuId: hit.skuId, qty: hit.qty };
        if (hit.pack) line.pack = hit.pack;
        if (hit.size) line.size = hit.size;
        if (hit.pallet) line.pallet = true;
        lines.push(line);
      } else unknown.push(chunk);
    }
    if (inbound && /^(進貨|入貨|到貨)/.test(customer)) customer = "";
    return { customer, lines, unknown, raw: text, inbound };
  }

  function isBlockSep(ch) {
    return !ch || /[\s、，,;；。．\n\/]/.test(ch);
  }

  function splitOrderBlocks(raw, extraNames) {
    const names = uniqNames(extraNames);
    const t = foldHyphen(String(raw || "")).replace(/\r/g, "");
    if (!t.trim()) return [];
    const starts = [];
    for (let i = 0; i < t.length; i++) {
      if (i > 0 && !isBlockSep(t[i - 1])) continue;
      let hit = peelKnownName(t.slice(i), names);
      if (!hit && (i === 0 || t[i - 1] === "\n")) hit = peelCustomer(t.slice(i), names);
      if (hit && hit.customer) starts.push(i);
    }
    const uniq = [...new Set(starts)].sort((a, b) => a - b);
    if (!uniq.length) return [t.trim()].filter(Boolean);
    if (uniq[0] !== 0) uniq.unshift(0);
    const blocks = [];
    for (let i = 0; i < uniq.length; i++) {
      const chunk = t.slice(uniq[i], uniq[i + 1]).trim();
      if (chunk) blocks.push(chunk);
    }
    return blocks;
  }

  function parseLineOrderBlocks(raw, extraNames) {
    const names = uniqNames(extraNames);
    const blocks = splitOrderBlocks(raw, names);
    if (!blocks.length) return [parseLineOrderText(raw, names)];
    return blocks.map((block) => parseLineOrderText(block, names));
  }

  function worthKeeping(parsed) {
    if (!parsed) return false;
    if (parsed.lines && parsed.lines.length) return true;
    return /袋|箱|籃|密本|紐|葉誌|綠骨|紅骨|綠九層|紅九層|綠芳|紅芳|綠塔|紅塔|九層塔|進貨|入貨|到貨/.test(parsed.raw || "");
  }

  return { parseLineOrderText, parseLineOrderBlocks, worthKeeping };
});
