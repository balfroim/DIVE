/**
 * The plasma current.
 *
 * A cheap, deterministic, divergence-ish vector field sampled at a point. It is
 * what makes the vessel feel like a fluid rather than a room: everything that
 * is not actively swimming gets carried.
 *
 * @module world/flow
 */

const _cur = { x: 0, y: 0 };

/**
 * @param {number} x world x
 * @param {number} y world y
 * @param {number} t seconds
 * @param {number} [flow] pressure-derived multiplier (see pressureProfile)
 * @returns {{x:number,y:number}} a shared scratch vector - copy it if you keep it
 */
export function currentAt(x, y, t, flow) {
  const f = flow === undefined ? 1 : flow;
  _cur.x = (Math.sin(y * 0.0016 + t * 0.22) * 30 + Math.sin((x + y) * 0.0009 - t * 0.15) * 18) * f;
  _cur.y = (Math.cos(x * 0.0014 - t * 0.18) * 26 + Math.cos((x - y) * 0.0011 + t * 0.13) * 15) * f;
  return _cur;
}
