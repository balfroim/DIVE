/**
 * Pure maths helpers. No imports, no state - safe to use from anywhere.
 * @module core/math
 */

export const TAU = Math.PI * 2;
export const PI = Math.PI;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Random float in [a,b). */
export const rr = (a, b) => a + Math.random() * (b - a);
/** Random integer in [a,b] inclusive. */
export const ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
/** Random element of an array. */
export const pick = (a) => a[(Math.random() * a.length) | 0];
/** Random sign, -1 or 1. */
export const sgn = () => (Math.random() < 0.5 ? -1 : 1);

export const hsl = (h, s, l, a) =>
  a === undefined ? 'hsl(' + h + ',' + s + '%,' + l + '%)' : 'hsla(' + h + ',' + s + '%,' + l + '%,' + a + ')';

export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

export const wrapHue = (h) => ((h % 360) + 360) % 360;

/** Shortest distance between two hues, 0..180. */
export function hueDelta(a, b) {
  const d = Math.abs(wrapHue(a) - wrapHue(b));
  return d > 180 ? 360 - d : d;
}

/** Move `cur` toward `tgt` at `rate` units/second without overshooting. */
export function approach(cur, tgt, rate, dt) {
  const d = tgt - cur;
  const m = rate * dt;
  return Math.abs(d) <= m ? tgt : cur + Math.sign(d) * m;
}

/** Interpolate angles the short way round. */
export function lerpAngle(a, b, t) {
  const d = ((b - a + PI) % TAU + TAU) % TAU - PI;
  return a + d * t;
}

/** Squared distance - avoids a sqrt in hot loops. */
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};

/**
 * Shortest distance from point P to segment AB.
 * Used for the white cell's lethal lunge sweep and for corridor collision.
 * @returns {number} distance in world units
 */
export function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 <= 1e-9 ? 0 : clamp((wx * vx + wy * vy) / len2, 0, 1);
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

/** Closest point on segment AB to P, written into `out`. */
export function closestOnSegment(px, py, ax, ay, bx, by, out) {
  const vx = bx - ax, vy = by - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 <= 1e-9 ? 0 : clamp(((px - ax) * vx + (py - ay) * vy) / len2, 0, 1);
  out.x = ax + vx * t;
  out.y = ay + vy * t;
  out.t = t;
  return out;
}
