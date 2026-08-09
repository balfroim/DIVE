/**
 * Canvas, viewport metrics, camera and adaptive quality.
 *
 * All mutable viewport state lives on the exported `View` object rather than as
 * bare `let` exports, because ES modules forbid writing to an imported binding -
 * bundling would silently break if another module tried.
 *
 * @module core/view
 */

import { CFG } from './config.js';
import { clamp } from './math.js';

export const isCoarse =
  (window.matchMedia && matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window;

/** Adaptive quality tier: 2 = full, 1 = reduced, 0 = survival. */
export const Q = {
  tier: 2, layers: 3, motes: true, rbc: CFG.ambientRBC,
  dprCap: isCoarse ? 1.56 : 2, acc: 0, n: 0, warm: 90, strikes: 0
};

export const View = {
  cv: null,
  ctx: null,
  w: 800, h: 600,   // CSS pixels
  dpr: 1,
  ui: 1,            // UI scale factor for HUD text
  zoom: 1           // world -> screen scale
};

export const cam = { x: 0, y: 0, sx: 0, sy: 0, trauma: 0 };

/** Screen -> world. */
export const s2wx = (sx) => (sx - View.w / 2) / View.zoom + cam.x;
export const s2wy = (sy) => (sy - View.h / 2) / View.zoom + cam.y;

export function attachCanvas(canvas) {
  View.cv = canvas;
  View.ctx = canvas.getContext('2d', { alpha: false });
  resize();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(resize, 120), { passive: true });
  return View.ctx;
}

function resize() {
  const cv = View.cv;
  if (!cv) return;
  View.dpr = Math.min(window.devicePixelRatio || 1, Q.dprCap);
  View.w = Math.max(320, window.innerWidth);
  View.h = Math.max(280, window.innerHeight);
  cv.width = Math.round(View.w * View.dpr);
  cv.height = Math.round(View.h * View.dpr);
  cv.style.width = View.w + 'px';
  cv.style.height = View.h + 'px';
  const mn = Math.min(View.w, View.h);
  View.ui = clamp(mn / 760, 0.62, 1.18);
  let z = clamp(Math.max(View.w, View.h) / 1500, 0.62, 1.0) * clamp(mn / 700, 0.82, 1.25);
  /* corridors are narrow - pull the camera in a touch so they stay legible */
  View.zoom = clamp(z * 1.06, isCoarse ? 0.72 : 0.58, 1.2);
}

function applyTier(t) {
  Q.tier = t;
  Q.layers = t >= 2 ? 3 : t === 1 ? 2 : 1;
  Q.motes = t >= 2;
  Q.rbc = t >= 2 ? CFG.ambientRBC : t === 1 ? 70 : 38;
  Q.dprCap = isCoarse ? (t >= 2 ? 1.56 : t === 1 ? 1.3 : 1.1) : t >= 2 ? 2 : t === 1 ? 1.5 : 1.25;
  if (View.cv) View.cv.dataset.q = t;
  resize();
}

/**
 * Judge performance by real frame delta - canvas rasterisation is async, so
 * measuring JS time alone lies about how fast we really are.
 */
export function updateQuality(realSec) {
  if (Q.warm > 0) { Q.warm--; return; }
  Q.acc += realSec * 1000; Q.n++;
  if (Q.n >= 70) {
    const avg = Q.acc / Q.n;
    Q.acc = 0; Q.n = 0;
    if (avg > 21.5 && Q.tier > 0) { applyTier(Q.tier - 1); Q.strikes++; }
    else if (avg < 15.5 && Q.tier < 2 && Q.strikes < 2) applyTier(Q.tier + 1);
  }
}

/** Is a world point inside the visible frame (plus padding)? */
export function inView(x, y, pad) {
  const hw = View.w / 2 / View.zoom + (pad || 0);
  const hh = View.h / 2 / View.zoom + (pad || 0);
  return x > cam.x - hw && x < cam.x + hw && y > cam.y - hh && y < cam.y + hh;
}
