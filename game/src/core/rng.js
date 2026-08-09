/**
 * Seeded pseudo-random generator (mulberry32).
 *
 * The vessel maze must be reproducible: the same contract seed always grows the
 * same corridors, so a briefing can promise "hepatic portal, depth 4" and the
 * dive delivers exactly that. Gameplay noise (particles, jitter) keeps using the
 * unseeded helpers in core/math.js.
 *
 * @module core/rng
 */

/** @returns {() => number} a function producing floats in [0,1). */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convenience wrapper with the same shape as core/math's helpers. */
export function rngHelpers(seed) {
  const r = makeRng(seed);
  return {
    f: r,
    range: (a, b) => a + r() * (b - a),
    int: (a, b) => Math.floor(a + r() * (b - a + 1)),
    pick: (arr) => arr[(r() * arr.length) | 0],
    chance: (p) => r() < p
  };
}

/** Turn any string into a 32-bit seed (FNV-1a). */
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
