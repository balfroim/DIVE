/**
 * Cached sprites.
 *
 * Radial glows and organic tissue blobs are expensive to rasterise and never
 * change, so they are baked into offscreen canvases once and blitted after.
 *
 * @module render/sprites
 */

import { TAU, rr, hsl } from '../core/math.js';
import { View } from '../core/view.js';

const glowCache = new Map();
export function glowSprite(hue, sat, lit) {
  const key = ((hue / 8) | 0) + '_' + ((sat / 12) | 0) + '_' + ((lit / 12) | 0);
  let g = glowCache.get(key);
  if (g) return g;
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, hsl(hue, sat, lit, 0.95));
  grd.addColorStop(0.28, hsl(hue, sat, lit, 0.42));
  grd.addColorStop(0.62, hsl(hue, sat, lit * 0.7, 0.13));
  grd.addColorStop(1, hsl(hue, sat, lit * 0.6, 0));
  x.fillStyle = grd; x.fillRect(0, 0, S, S);
  glowCache.set(key, c);
  return c;
}
export function drawGlow(g, x, y, r, alpha) {
  View.ctx.globalAlpha = alpha;
  View.ctx.drawImage(g, x - r, y - r, r * 2, r * 2);
  View.ctx.globalAlpha = 1;
}

/* soft organic blob sprites for the parallax tissue */
export function tissueSprite(hue, sat, lit, alpha, seed) {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S / 2);
  grd.addColorStop(0, hsl(hue, sat, lit, alpha));
  grd.addColorStop(0.45, hsl(hue, sat, lit * 0.8, alpha * 0.55));
  grd.addColorStop(1, hsl(hue, sat, lit * 0.5, 0));
  x.save();
  x.translate(S / 2, S / 2);
  x.beginPath();
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU;
    const rad = S / 2 * (0.72 + 0.22 * Math.sin(a * 3 + seed) + 0.1 * Math.sin(a * 5 - seed * 2));
    const px = Math.cos(a) * rad, py = Math.sin(a) * rad * 0.82;
    if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
  }
  x.closePath();
  x.fillStyle = grd; x.fill();
  x.restore();
  return c;
}
