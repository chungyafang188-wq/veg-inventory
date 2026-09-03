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
    const num = String(s).match(/(\d+(?:\.\d+)?)/);
    if (num) return { qty: Number(num[1]), text: s.replace(num[1], "") };
    for (const [k, v] of Object.entries(CN)) {
      if (s.includes(k)) return { qty: v, text: s.replace(k, "") };
    }
    return { qty: 1, text: s };
  }

  function onionSku(origin, spec12) {
    return `on-${origin}-${spec12 ? "12" : "20"}`;
  }

  function takeOnionSpecQty(s) {
    const slash = String(s).match(/(12|20)\s*[Kk]?\s*[/／]\s*(\d+(?:\.\d+)?)/);
    if (slash) {
      return {
        spec12: slash[1] === "12",
        qty: Number(slash[2]),
        text: s.replace(slash[0], ""),
      };
    }
    const glued = String(s).match(/(12|20)\s*[Kk]\s*(\d+(?:\.\d+)?)/);
    if (glued) {
      return {
        spec12: glued[1] === "12",
        qty: Number(glued[2]),
        text: s.replace(glued[0], ""),
      };
    }
    let rest = s;
    let spec12 = null;
    const labeled = rest.match(/(12|20)\s*[Kk]/);
    if (labeled) {
      spec12 = labeled[1] === "12";
      rest = rest.replace(labeled[0], "");
    } else if (/特大/.test(rest) && !/20/.test(rest)) {
      spec12 = true;
      rest = rest.replace(/特大/g, "");
    }
    const { qty, text } = takeQty(rest);
    return { spec12, qty, text };
  }

  function peelCustomer(line) {
    const m = String(line || "").match(
      /^([\u4e00-\u9fffA-Za-z0-9.·\-]{1,12})\s+(?=紐|韓|澳|越|洋蔥|密本|阿成|葉|綠骨|紅骨|綠九|紅九|九層)/,
    );
    if (!m) return { customer: "", rest: String(line || "").trim() };
    return { customer: m[1].trim(), rest: String(line).slice(m[0].length).trim() };
  }

  function matchChunk(raw) {
    const pallet = /疊棧板|棧板/.test(raw);
    let s = raw.replace(/疊棧板|棧板/g, "");
    const onionBits = takeOnionSpecQty(s);
    const { qty, text } = onionBits;
    const t = text.replace(/\s+/g, "");
    if (/葉誌|誌葉|地瓜葉.?誌/.test(t) || (t.includes("誌") && /葉|地瓜/.test(t))) {
      return { skuId: "sl-zhi", qty, pack: "籃裝", pallet };
    }
    if (/葉芳|芳葉|地瓜葉.?芳/.test(t) || (t.includes("芳") && /葉|地瓜/.test(t) && !/綠骨|紅骨|綠九層|紅九層|九層/.test(t))) {
      return { skuId: "sl-fang", qty, pack: "籃裝", pallet };
    }
    const greenBasil = /綠骨|綠九層塔|綠九層|綠塔|綠芳|綠琳/;
    const redBasil = /紅骨|紅九層塔|紅九層|紅塔|紅芳|紅琳/;
    if (greenBasil.test(t) && /琳/.test(t)) return { skuId: "gb-lin", qty, pallet };
    if (greenBasil.test(t)) return { skuId: "gb-fang", qty, pallet };
    if (redBasil.test(t) && /琳/.test(t)) return { skuId: "rb-lin", qty, pallet };
    if (redBasil.test(t)) return { skuId: "rb-fang", qty, pallet };
    if (/洋蔥?\s*B|蔥B|洋B/.test(t)) return { skuId: "on-b-kg", qty, pallet };
    if (/南瓜?\s*B|瓜B/.test(t)) return { skuId: "pk-b-kg", qty, pallet };
    if (t.includes("密本")) return { skuId: /20/.test(t) ? "pk-mi-20" : "pk-mi-18", qty, pallet };
    if (t.includes("阿成")) return { skuId: /20/.test(t) ? "pk-ch-20" : "pk-ch-18", qty, pallet };
    if (/薄荷/.test(t)) return { skuId: "mint-kg", qty, pallet };
    if (/紫蘇/.test(t) && /斤/.test(t)) return { skuId: "shiso-jin", qty, pallet };
    if (/紫蘇/.test(t)) return { skuId: "shiso-kg", qty, pallet };
    if (/九層塔散|塔散|塔kg/.test(t)) return { skuId: "basil-kg", qty, pallet };
    let origin = "";
    for (const [word, code] of ORIGIN) {
      if (t.includes(word)) {
        origin = code;
        break;
      }
    }
    if (origin) {
      const use12 = onionBits.spec12 === true || (onionBits.spec12 == null && /12/.test(t) && !/20/.test(t));
      return { skuId: onionSku(origin, use12), qty, pallet };
    }
    return null;
  }

  function looksLikeItems(line) {
    return /袋|箱|籃|kg|公斤|密本|阿成|紐|韓|澳|越|葉|塔|骨|洋蔥|南瓜|九層/.test(line);
  }

  function parseLineOrderText(raw) {
    const text = String(raw || "").replace(/\r/g, "").trim();
    const unknown = [];
    const lines = [];
    if (!text) return { customer: "", lines, unknown, raw: "" };
    const parts = text.split(/\n+/).map((x) => x.trim()).filter(Boolean);
    let customer = "";
    let body = parts;
    const sameLine = peelCustomer(parts[0] || "");
    if (sameLine.customer) {
      customer = sameLine.customer;
      body = [sameLine.rest, ...parts.slice(1)].filter(Boolean);
    } else if (parts.length && !looksLikeItems(parts[0]) && parts[0].length <= 20) {
      customer = parts[0].replace(/^[\d.\s]+/, "").trim();
      body = parts.slice(1);
      if (!body.length) body = parts;
    }
    const chunks = body
      .join("、")
      .split(/[、，,;；\n]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    for (const chunk of chunks) {
      if (/^(好|喔|哦|收到|謝謝|ok|OK)$/.test(chunk)) continue;
      const hit = matchChunk(chunk);
      if (hit && hit.qty > 0) {
        const line = { skuId: hit.skuId, qty: hit.qty };
        if (hit.pack) line.pack = hit.pack;
        if (hit.pallet) line.pallet = true;
        lines.push(line);
      } else unknown.push(chunk);
    }
    return { customer, lines, unknown, raw: text };
  }

  function worthKeeping(parsed) {
    if (!parsed) return false;
    if (parsed.lines && parsed.lines.length) return true;
    return /袋|箱|籃|密本|紐|葉誌|綠骨|紅骨|綠九層|紅九層|綠芳|紅芳|綠塔|紅塔|九層塔/.test(parsed.raw || "");
  }

  return { parseLineOrderText, worthKeeping };
});
