// Seedable PRNG + helpers.

export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const r = mulberry32(seed);
  return {
    next: r,
    range: (lo, hi) => lo + (hi - lo) * r(),
    int: (lo, hi) => Math.floor(lo + (hi - lo + 1) * r()),
    chance: (p) => r() < p,
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    gauss: (mean = 0, sd = 1) => {
      // Box-Muller
      let u = 0, v = 0;
      while (u === 0) u = r();
      while (v === 0) v = r();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    sign: () => (r() < 0.5 ? -1 : 1),
  };
}
