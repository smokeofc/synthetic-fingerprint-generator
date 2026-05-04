// SVG / PNG rendering and DOM injection.

/**
 * Build an SVG document string from polylines and styling options.
 *
 * The SVG has a transparent background (no <rect> fill). Each ridge is
 * rendered as a possibly-broken polyline with optional per-segment width
 * jitter and a soft alpha multiplier from the mask edge falloff.
 *
 * @param {Array<{x:number,y:number}[]>} ridges
 * @param {object} opts
 */
export function ridgesToSvg(ridges, opts) {
  const {
    width, height, color, thickness, jitter, gaps, mask, rng, pores,
  } = opts;

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
      `width="${width}" height="${height}">`
  );
  parts.push(`<g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">`);

  for (const ridge of ridges) {
    // Apply mask trim (already done) — split into broken segments by gaps.
    const segments = breakWithGaps(ridge, gaps, rng);

    for (const seg of segments) {
      if (seg.length < 2) continue;
      // Build path with quadratic-ish smoothing using midpoints.
      const d = smoothPath(seg);

      // Average alpha at midpoint of segment from mask falloff.
      const mid = seg[Math.floor(seg.length / 2)];
      const alpha = mask.edgeAlpha(mid.x, mid.y, 0.14);
      if (alpha <= 0.02) continue;

      // Per-ridge thickness jitter.
      const t = thickness * (1 + (rng.next() - 0.5) * 2 * jitter);
      const tw = Math.max(0.15, t);

      parts.push(
        `<path d="${d}" stroke-width="${tw.toFixed(2)}" opacity="${alpha.toFixed(3)}"/>`
      );
    }
  }

  if (pores) {
    // Sparse small dots along ridges to suggest pores.
    for (const ridge of ridges) {
      for (let i = 4; i < ridge.length; i += 14) {
        if (rng.next() > 0.35) continue;
        const p = ridge[i];
        const a = mask.edgeAlpha(p.x, p.y, 0.18);
        if (a < 0.4) continue;
        const r = thickness * 0.55;
        parts.push(
          `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${r.toFixed(2)}" ` +
            `fill="${color}" opacity="${(a * 0.85).toFixed(3)}"/>`
        );
      }
    }
  }

  parts.push(`</g></svg>`);
  return parts.join("");
}

function smoothPath(pts) {
  if (pts.length === 2) {
    return `M${fmt(pts[0])} L${fmt(pts[1])}`;
  }
  // Move to midpoint of first segment, then quadratic Bézier through each
  // interior point using the next midpoint as the end point. This produces
  // smooth curves without needing tangent computation.
  const out = [];
  out.push(`M${fmt(pts[0])}`);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) * 0.5;
    const my = (pts[i].y + pts[i + 1].y) * 0.5;
    out.push(`Q${pts[i].x.toFixed(2)},${pts[i].y.toFixed(2)} ${mx.toFixed(2)},${my.toFixed(2)}`);
  }
  out.push(`L${fmt(pts[pts.length - 1])}`);
  return out.join(" ");
}
function fmt(p) { return `${p.x.toFixed(2)},${p.y.toFixed(2)}`; }

function breakWithGaps(ridge, gaps, rng) {
  if (!gaps || gaps <= 0) return [ridge];
  // Probability per vertex of starting a small gap. Average gap = 2-4 verts.
  const segs = [];
  let cur = [ridge[0]];
  let i = 1;
  while (i < ridge.length) {
    cur.push(ridge[i]);
    if (rng.next() < gaps * 0.012) {
      // close current segment, skip a few verts
      if (cur.length >= 2) segs.push(cur);
      cur = [];
      const skip = 2 + Math.floor(rng.next() * 3);
      i += skip;
      if (i < ridge.length) cur.push(ridge[i]);
    }
    i++;
  }
  if (cur.length >= 2) segs.push(cur);
  return segs;
}

export function injectSvg(container, svgString) {
  container.innerHTML = svgString;
}

/**
 * Rasterize an SVG string to a PNG Blob with transparent background at the
 * requested pixel width (height scaled to preserve aspect ratio).
 * @param {string} svgString
 * @param {number} pxWidth
 * @returns {Promise<Blob>}
 */
export function svgToPngBlob(svgString, pxWidth) {
  return new Promise((resolve, reject) => {
    // Parse viewBox to get aspect.
    const m = svgString.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
    const vw = m ? parseFloat(m[1]) : pxWidth;
    const vh = m ? parseFloat(m[2]) : pxWidth;
    const pxHeight = Math.round(pxWidth * (vh / vw));

    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pxWidth;
      canvas.height = pxHeight;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, pxWidth, pxHeight); // ensure transparent
      ctx.drawImage(img, 0, 0, pxWidth, pxHeight);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => {
        if (b) resolve(b); else reject(new Error("toBlob failed"));
      }, "image/png");
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
