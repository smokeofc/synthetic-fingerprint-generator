// Elliptical fingertip mask centred on (cx, cy) with semi-axes (rx, ry).
// Provides containment test, signed-distance-ish edge falloff, and a polyline
// trim that cuts segments at the boundary.

export class EllipseMask {
  constructor(cx, cy, rx, ry) {
    this.cx = cx; this.cy = cy; this.rx = rx; this.ry = ry;
  }

  // Normalised radius: <1 inside, =1 on boundary, >1 outside.
  norm(x, y) {
    const dx = (x - this.cx) / this.rx;
    const dy = (y - this.cy) / this.ry;
    return Math.sqrt(dx * dx + dy * dy);
  }

  inside(x, y) { return this.norm(x, y) <= 1; }

  // Soft 0..1 falloff in a band of width `band` (in normalised units) near the
  // edge. 1 deep inside, 0 at/outside the boundary.
  edgeAlpha(x, y, band = 0.12) {
    const n = this.norm(x, y);
    if (n >= 1) return 0;
    if (n <= 1 - band) return 1;
    const t = (1 - n) / band;
    return t * t * (3 - 2 * t); // smoothstep
  }

  /**
   * Trim a polyline to the inside of the ellipse, splitting it into multiple
   * polylines if it exits and re-enters.
   * @param {{x:number,y:number}[]} pts
   * @returns {{x:number,y:number}[][]}
   */
  trimPolyline(pts) {
    const out = [];
    let cur = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (this.inside(p.x, p.y)) {
        cur.push(p);
      } else if (cur.length) {
        out.push(cur);
        cur = [];
      }
    }
    if (cur.length) out.push(cur);
    return out.filter((s) => s.length >= 2);
  }
}
