// Pattern presets: produce an OrientationField configured for a fingerprint
// class. Coordinates are expressed in the same space as the canvas (e.g. for
// a 500x500 work area we place singularities relative to the centre).

import { OrientationField } from "./orientation.js";

/**
 * Build an OrientationField for the requested preset.
 * @param {string} name
 * @param {{cx:number, cy:number, radius:number, rng:any, tiltRad:number}} ctx
 */
export function buildPattern(name, ctx) {
  const { cx, cy, radius, rng, tiltRad } = ctx;
  const j = (amp) => rng.gauss(0, amp); // jitter

  switch (name) {
    case "arch": {
      // No singularities -> uniform horizontal flow + slight upward bow added
      // by placing two faraway balanced cores below.
      const far = radius * 6;
      return new OrientationField(
        [{ x: cx - far, y: cy + far * 0.8 }, { x: cx + far, y: cy + far * 0.8 }],
        [{ x: cx - far, y: cy - far * 0.8 }, { x: cx + far, y: cy - far * 0.8 }],
        tiltRad
      );
    }

    case "tented_arch": {
      const core = { x: cx + j(radius * 0.05), y: cy - radius * 0.10 + j(radius * 0.05) };
      const delta = { x: core.x + j(radius * 0.04), y: cy + radius * 0.55 + j(radius * 0.05) };
      return new OrientationField([core], [delta], tiltRad);
    }

    case "loop_left": {
      const core = { x: cx - radius * 0.05 + j(radius * 0.06), y: cy - radius * 0.10 + j(radius * 0.05) };
      const delta = { x: cx + radius * 0.45 + j(radius * 0.05), y: cy + radius * 0.40 + j(radius * 0.05) };
      return new OrientationField([core], [delta], tiltRad);
    }

    case "loop_right": {
      const core = { x: cx + radius * 0.05 + j(radius * 0.06), y: cy - radius * 0.10 + j(radius * 0.05) };
      const delta = { x: cx - radius * 0.45 + j(radius * 0.05), y: cy + radius * 0.40 + j(radius * 0.05) };
      return new OrientationField([core], [delta], tiltRad);
    }

    case "whorl": {
      const c1 = { x: cx + j(radius * 0.04), y: cy - radius * 0.05 + j(radius * 0.04) };
      const c2 = { x: cx + j(radius * 0.04), y: cy + radius * 0.10 + j(radius * 0.04) };
      const d1 = { x: cx - radius * 0.50 + j(radius * 0.05), y: cy + radius * 0.45 + j(radius * 0.05) };
      const d2 = { x: cx + radius * 0.50 + j(radius * 0.05), y: cy + radius * 0.45 + j(radius * 0.05) };
      return new OrientationField([c1, c2], [d1, d2], tiltRad);
    }

    case "double_loop": {
      const c1 = { x: cx - radius * 0.18 + j(radius * 0.04), y: cy - radius * 0.10 + j(radius * 0.04) };
      const c2 = { x: cx + radius * 0.18 + j(radius * 0.04), y: cy + radius * 0.05 + j(radius * 0.04) };
      const d1 = { x: cx - radius * 0.55 + j(radius * 0.05), y: cy + radius * 0.45 + j(radius * 0.05) };
      const d2 = { x: cx + radius * 0.55 + j(radius * 0.05), y: cy + radius * 0.45 + j(radius * 0.05) };
      return new OrientationField([c1, c2], [d1, d2], tiltRad);
    }

    default:
      return buildPattern("loop_right", ctx);
  }
}

export const PRESETS = [
  "loop_left", "loop_right", "whorl", "double_loop", "arch", "tented_arch",
];
