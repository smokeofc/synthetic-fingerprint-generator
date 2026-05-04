// Evenly-spaced ridge streamline tracer (Jobard & Lefer 1997 style).
//
// Given an OrientationField, an EllipseMask, a target ridge spacing and a
// seedable RNG, returns an array of polylines representing fingerprint ridges.
//
// We integrate streamlines bidirectionally with RK2. To keep ridges roughly
// parallel and evenly spaced (like real prints) we maintain an occupancy grid:
// when integrating, if a candidate point lies within `spacing * dTest` of an
// already-placed ridge point, the streamline terminates there. New seeds are
// rejected the same way.

export function traceRidges(field, mask, opts) {
  const {
    spacing,
    rng,
    width,
    height,
    dSep = 1.0,    // separation factor for new seeds (relative to spacing)
    dTest = 0.55,  // separation factor while integrating (allow tighter packing)
    maxStepsPerSide = 1200,
    breakChance = 0.0008, // per-step probability of an early ridge ending
  } = opts;

  // Occupancy grid: cell ~ spacing/2.
  const cell = Math.max(1, spacing * 0.5);
  const cols = Math.ceil(width / cell) + 1;
  const rows = Math.ceil(height / cell) + 1;
  /** @type {Array<Array<{x:number,y:number}>>} */
  const grid = new Array(cols * rows);
  for (let i = 0; i < grid.length; i++) grid[i] = [];

  const idx = (x, y) => {
    const c = Math.floor(x / cell);
    const r = Math.floor(y / cell);
    return { c, r, k: r * cols + c };
  };

  const tooClose = (x, y, minDist) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return true;
    const md2 = minDist * minDist;
    const c0 = Math.max(0, Math.floor((x - minDist) / cell));
    const c1 = Math.min(cols - 1, Math.floor((x + minDist) / cell));
    const r0 = Math.max(0, Math.floor((y - minDist) / cell));
    const r1 = Math.min(rows - 1, Math.floor((y + minDist) / cell));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const bucket = grid[r * cols + c];
        for (let i = 0; i < bucket.length; i++) {
          const p = bucket[i];
          const dx = p.x - x, dy = p.y - y;
          if (dx * dx + dy * dy < md2) return true;
        }
      }
    }
    return false;
  };

  const addPoint = (x, y) => {
    const { c, r, k } = idx(x, y);
    if (c < 0 || r < 0 || c >= cols || r >= rows) return;
    grid[k].push({ x, y });
  };

  const stepLen = spacing * 0.45;

  function integrate(seedX, seedY, dirSign) {
    const pts = [];
    let x = seedX, y = seedY;
    // Establish reference angle at seed for direction continuity.
    let prevA = field.angleAt(x, y);
    if (dirSign < 0) prevA += Math.PI;
    pts.push({ x, y });

    for (let step = 0; step < maxStepsPerSide; step++) {
      // RK2: midpoint method, with angle continuity correction.
      const a1 = orient(field.angleAt(x, y), prevA);
      const mx = x + Math.cos(a1) * stepLen * 0.5;
      const my = y + Math.sin(a1) * stepLen * 0.5;
      const a2 = orient(field.angleAt(mx, my), prevA);
      const nx = x + Math.cos(a2) * stepLen;
      const ny = y + Math.sin(a2) * stepLen;

      if (!mask.inside(nx, ny)) break;
      if (tooClose(nx, ny, spacing * dTest)) break;
      if (rng.next() < breakChance) break;

      x = nx; y = ny;
      prevA = a2;
      pts.push({ x, y });
    }
    return pts;
  }

  // Orient candidate angle so it agrees with the previous direction (avoid
  // flipping by pi due to atan2 ambiguity in the ridge-orientation field).
  function orient(a, prev) {
    let da = a - prev;
    while (da > Math.PI / 2) { a -= Math.PI; da -= Math.PI; }
    while (da < -Math.PI / 2) { a += Math.PI; da += Math.PI; }
    return a;
  }

  /** @type {{x:number,y:number}[][]} */
  const ridges = [];

  function tryGrow(seedX, seedY) {
    if (!mask.inside(seedX, seedY)) return null;
    if (tooClose(seedX, seedY, spacing * dSep)) return null;

    const fwd = integrate(seedX, seedY, +1);
    const back = integrate(seedX, seedY, -1);
    // Combine: back reversed (excluding seed) + fwd
    const polyline = back.slice(1).reverse().concat(fwd);
    if (polyline.length < 4) return null;
    // Register all points in grid.
    for (let i = 0; i < polyline.length; i++) addPoint(polyline[i].x, polyline[i].y);
    ridges.push(polyline);
    return polyline;
  }

  // ---- Seeding ----
  // 1) Initial seed near the center of the mask (wherever a singularity might
  //    be) so the first ridge anchors the rest.
  tryGrow(mask.cx, mask.cy + spacing * 0.5);

  // 2) From each placed ridge, attempt new seeds offset perpendicular to it
  //    on both sides, until no new ridges can be added.
  let head = 0;
  while (head < ridges.length) {
    const r = ridges[head++];
    const stride = Math.max(2, Math.floor(spacing / stepLen));
    for (let i = stride; i < r.length - 1; i += stride) {
      const a = r[i - 1], b = r[i + 1];
      const tx = b.x - a.x, ty = b.y - a.y;
      const tl = Math.hypot(tx, ty) || 1;
      const nx = -ty / tl, ny = tx / tl;
      const off = spacing * dSep;
      // Try slight offset in seed location for variety.
      const jitter = (rng.next() - 0.5) * spacing * 0.15;
      tryGrow(r[i].x + nx * (off + jitter), r[i].y + ny * (off + jitter));
      tryGrow(r[i].x - nx * (off + jitter), r[i].y - ny * (off + jitter));
    }
  }

  // 3) Fallback: scan a coarse grid to fill any leftover gaps (rare).
  const gridStep = spacing * 0.85;
  for (let y = mask.cy - mask.ry; y <= mask.cy + mask.ry; y += gridStep) {
    for (let x = mask.cx - mask.rx; x <= mask.cx + mask.rx; x += gridStep) {
      tryGrow(x + (rng.next() - 0.5) * gridStep * 0.5,
              y + (rng.next() - 0.5) * gridStep * 0.5);
    }
  }

  return ridges;
}
