(function (w) {
  function fillRight(ctx, text, x, y) {
    const t = String(text ?? "");
    ctx.fillText(t, x - ctx.measureText(t).width, y);
  }
  function ellipsis(ctx, text, maxW) {
    const t = String(text || "");
    if (ctx.measureText(t).width <= maxW) return t;
    let s = t;
    while (s.length && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
    return `${s}…`;
  }
  function blobOf(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png"))), "image/png");
    });
  }
  function drawPage(spec, chunk, page, pages) {
    const dpr = 2;
    const W = spec.width || 980;
    const pad = 36;
    const rowH = 38;
    const headH = 42;
    const top = spec.top || 148;
    const note = spec.note || "";
    const H = top + headH + (Math.max(chunk.length, 1) + (spec.totalRow ? 1 : 0)) * rowH + pad + (note ? 28 : 12);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1a6843";
    ctx.font = '800 26px "Microsoft JhengHei","Noto Sans TC",sans-serif';
    ctx.fillText(spec.title || "鐵架統計", pad, 48);
    ctx.fillStyle = "#16241c";
    ctx.font = '800 20px "Microsoft JhengHei","Noto Sans TC",sans-serif';
    ctx.fillText(spec.heading || "", pad, 82);
    ctx.fillStyle = "#5a6a61";
    ctx.font = '700 15px "Microsoft JhengHei","Noto Sans TC",sans-serif';
    ctx.fillText(spec.sub || "", pad, 112);
    if (pages > 1) {
      const mark = `第 ${page} / ${pages} 頁`;
      fillRight(ctx, mark, W - pad, 48);
    }
    const cols = spec.cols.map((c) => ({ ...c }));
    const named = cols.reduce((a, c) => a + (c.w || 0), 0);
    const flex = cols.find((c) => !c.w);
    if (flex) flex.w = W - pad * 2 - named;
    const x0 = pad;
    const y0 = top;
    ctx.fillStyle = "#eef4ef";
    ctx.fillRect(x0, y0, W - pad * 2, headH);
    ctx.strokeStyle = "#d3ddd6";
    ctx.beginPath();
    ctx.moveTo(x0, y0 + headH);
    ctx.lineTo(W - pad, y0 + headH);
    ctx.stroke();
    ctx.fillStyle = "#5a6a61";
    ctx.font = '800 15px "Microsoft JhengHei","Noto Sans TC",sans-serif';
    let x = x0;
    for (const c of cols) {
      const ty = y0 + 27;
      if (c.owed) {
        ctx.fillStyle = "#8d5a3a";
        fillRight(ctx, c.title, x + c.w - 6, ty);
        ctx.fillStyle = "#5a6a61";
      } else if (c.center) {
        ctx.fillText(c.title, x + (c.w - ctx.measureText(c.title).width) / 2, ty);
      } else if (c.right) fillRight(ctx, c.title, x + c.w - 6, ty);
      else ctx.fillText(c.title, x + 8, ty);
      x += c.w;
    }
    const data = spec.totalRow && page === pages ? chunk.concat([spec.totalRow]) : chunk;
    data.forEach((r, i) => {
      const y = y0 + headH + i * rowH;
      if (i % 2) {
        ctx.fillStyle = "#f7faf7";
        ctx.fillRect(x0, y, W - pad * 2, rowH);
      }
      ctx.strokeStyle = "#e6ece7";
      ctx.beginPath();
      ctx.moveTo(x0, y + rowH);
      ctx.lineTo(W - pad, y + rowH);
      ctx.stroke();
      ctx.font = r.total
        ? '800 16px "Microsoft JhengHei","Noto Sans TC",sans-serif'
        : '700 16px "Microsoft JhengHei","Noto Sans TC",sans-serif';
      let cx = x0;
      for (const c of cols) {
        const ty = y + 26;
        const val = r[c.key];
        if (c.owed) {
          ctx.fillStyle = "#8d5a3a";
          ctx.font = r.total
            ? '800 18px "Microsoft JhengHei","Noto Sans TC",sans-serif'
            : '800 17px "Microsoft JhengHei","Noto Sans TC",sans-serif';
          fillRight(ctx, val, cx + c.w - 6, ty);
          ctx.font = r.total
            ? '800 16px "Microsoft JhengHei","Noto Sans TC",sans-serif'
            : '700 16px "Microsoft JhengHei","Noto Sans TC",sans-serif';
        } else if (c.center) {
          ctx.fillStyle = "#1a6843";
          const t = String(val ?? "");
          ctx.fillText(t, cx + (c.w - ctx.measureText(t).width) / 2, ty);
        } else if (c.right) {
          ctx.fillStyle = c.tint || "#16241c";
          fillRight(ctx, val, cx + c.w - 6, ty);
        } else {
          ctx.fillStyle = "#16241c";
          ctx.fillText(ellipsis(ctx, String(val ?? ""), c.w - 16), cx + 8, ty);
        }
        cx += c.w;
      }
    });
    if (note) {
      ctx.fillStyle = "#5a6a61";
      ctx.font = '600 14px "Microsoft JhengHei","Noto Sans TC",sans-serif';
      ctx.fillText(pages > 1 ? `${note}　（${page}/${pages}）` : note, pad, H - 18);
    }
    return blobOf(canvas);
  }
  w.RackPng = {
    pageSize: 16,
    async pages(spec) {
      const rows = spec.rows || [];
      const size = spec.pageSize || w.RackPng.pageSize;
      const chunks = [];
      for (let i = 0; i < Math.max(rows.length, 1); i += size) chunks.push(rows.slice(i, i + size));
      const out = [];
      for (let i = 0; i < chunks.length; i += 1) {
        out.push(await drawPage(spec, chunks[i], i + 1, chunks.length));
      }
      return out;
    },
  };
})(window);
