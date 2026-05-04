// Sherlock-Monro orientation field built from "core" (zero) and "delta" (pole)
// singularities in the complex plane.
//
//   theta(z) = 0.5 * ( sum arg(z - core_k) - sum arg(z - delta_k) ) + tilt
//
// Ridges flow tangent to this orientation field.

export class OrientationField {
  /**
   * @param {{x:number,y:number}[]} cores
   * @param {{x:number,y:number}[]} deltas
   * @param {number} tilt  global rotation in radians
   */
  constructor(cores, deltas, tilt = 0) {
    this.cores = cores;
    this.deltas = deltas;
    this.tilt = tilt;
  }

  angleAt(x, y) {
    let s = 0;
    for (const c of this.cores) s += Math.atan2(y - c.y, x - c.x);
    for (const d of this.deltas) s -= Math.atan2(y - d.y, x - d.x);
    // Add a very small DC offset along x so ridges have a default direction in
    // the absence of any singularity (pure arch case).
    return 0.5 * s + this.tilt;
  }

  // Unit tangent vector along which ridges flow.
  vectorAt(x, y) {
    const a = this.angleAt(x, y);
    return { x: Math.cos(a), y: Math.sin(a) };
  }
}
