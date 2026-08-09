/**
 * The body chart and the network map.
 *
 * Two small diagrams, drawn in screen space:
 *
 *   1. a human silhouette showing WHERE in the client you are working, with the
 *      contracted site marked and a depth gauge beside it;
 *   2. the vessel network itself - chambers you have visited, sealed valves,
 *      the organ, and you.
 *
 * @module render/minimap
 */

import { TAU, clamp, hsl } from '../core/math.js';
import { View } from '../core/view.js';
import { Maze } from '../world/maze.js';

/** Stylised human body, drawn to fit the box (x,y,w,h). */
export function drawBody(ctx, x, y, w, h, organ, pulse) {
  const cx = x + w * 0.5;
  ctx.save();
  ctx.translate(0, 0);

  const body = 'rgba(150,190,215,0.16)';
  const edge = 'rgba(150,200,225,0.34)';
  ctx.fillStyle = body;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;

  /* head */
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.075, h * 0.062, 0, TAU);
  ctx.fill(); ctx.stroke();

  /* torso */
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.20, y + h * 0.16);
  ctx.quadraticCurveTo(cx, y + h * 0.135, cx + w * 0.20, y + h * 0.16);
  ctx.lineTo(cx + w * 0.155, y + h * 0.50);
  ctx.quadraticCurveTo(cx, y + h * 0.545, cx - w * 0.155, y + h * 0.50);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  /* arms */
  ctx.lineWidth = Math.max(2.5, w * 0.055);
  ctx.lineCap = 'round';
  ctx.strokeStyle = body;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.20, y + h * 0.18);
  ctx.quadraticCurveTo(cx - w * 0.34, y + h * 0.32, cx - w * 0.30, y + h * 0.50);
  ctx.moveTo(cx + w * 0.20, y + h * 0.18);
  ctx.quadraticCurveTo(cx + w * 0.34, y + h * 0.32, cx + w * 0.30, y + h * 0.50);
  ctx.stroke();

  /* legs */
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.09, y + h * 0.52);
  ctx.lineTo(cx - w * 0.12, y + h * 0.95);
  ctx.moveTo(cx + w * 0.09, y + h * 0.52);
  ctx.lineTo(cx + w * 0.12, y + h * 0.95);
  ctx.stroke();

  /* the contracted site */
  if (organ) {
    const ox = x + organ.mx * w, oy = y + organ.my * h;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = hsl(organ.hue, 85, 68, 0.9);
    ctx.fillStyle = hsl(organ.hue, 85, 62, 0.55 + 0.3 * pulse);
    ctx.beginPath();
    ctx.arc(ox, oy, 3.6, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ox, oy, 6 + pulse * 4, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Depth gauge: a vertical bar tracking how far down the network you are.
 * @param {number} frac 0 at the entry, 1 at the organ
 */
export function drawDepthGauge(ctx, x, y, w, h, frac, rowNow, rowMax) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(110,232,255,0.55)';
  ctx.fillRect(x, y, w, h * clamp(frac, 0, 1));

  /* row ticks */
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  for (let i = 0; i <= rowMax; i++) {
    const ty = y + (h * i) / Math.max(1, rowMax);
    ctx.fillRect(x - 2, ty, w + 4, 1);
  }
  /* you */
  const py = y + h * clamp(frac, 0, 1);
  ctx.fillStyle = '#eaf6ff';
  ctx.beginPath();
  ctx.moveTo(x + w + 2, py);
  ctx.lineTo(x + w + 8, py - 4);
  ctx.lineTo(x + w + 8, py + 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * The vessel network, scaled to fit a box. Only chambers you have entered are
 * drawn solid - the rest is dead reckoning from the client's angiogram.
 */
export function drawNetwork(ctx, x, y, w, h, px, py) {
  const b = Maze.bounds;
  const sw = Math.max(1, b.maxX - b.minX), sh = Math.max(1, b.maxY - b.minY);
  const s = Math.min(w / sw, h / sh);
  const ox = x + (w - sw * s) / 2 - b.minX * s;
  const oy = y + (h - sh * s) / 2 - b.minY * s;
  const X = (wx) => ox + wx * s;
  const Y = (wy) => oy + wy * s;

  ctx.save();
  ctx.lineWidth = 2;
  for (const e of Maze.edges) {
    const known = e.a.seen || e.b.seen;
    ctx.strokeStyle = !e.open
      ? 'rgba(255,120,150,0.55)'
      : known ? 'rgba(200,225,240,0.35)' : 'rgba(200,225,240,0.10)';
    ctx.setLineDash(e.open ? [] : [3, 3]);
    ctx.beginPath();
    ctx.moveTo(X(e.a.x), Y(e.a.y));
    ctx.lineTo(X(e.b.x), Y(e.b.y));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const n of Maze.nodes) {
    if (!n.links.length) continue;
    const r = n.kind === 'organ' ? 4.2 : 2.6;
    ctx.beginPath();
    ctx.arc(X(n.x), Y(n.y), r, 0, TAU);
    ctx.fillStyle = n.kind === 'organ'
      ? hsl(Maze.hue, 85, 62, 0.95)
      : n.seen ? 'rgba(210,235,250,0.6)' : 'rgba(210,235,250,0.16)';
    ctx.fill();
  }
  /* you */
  ctx.beginPath();
  ctx.arc(X(px), Y(py), 3.4, 0, TAU);
  ctx.fillStyle = '#6ee8ff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(110,232,255,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(X(px), Y(py), 6.5, 0, TAU);
  ctx.stroke();
  ctx.restore();
}
