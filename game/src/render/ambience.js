/**
 * Parallax tissue, drifting red cells and plasma motes.
 *
 * The ambient population is scattered across the maze's bounding box and wraps
 * around it, so it costs the same whether the network is three rows or nine.
 *
 * @module render/ambience
 */

import { CFG } from '../core/config.js';
import { TAU, rr, ri } from '../core/math.js';
import { View, cam, Q } from '../core/view.js';
import { Maze } from '../world/maze.js';
import { currentAt } from '../entities/behaviour.js';
import { tissueSprite } from './sprites.js';

export const BG = { layers: [], rbc: [], motes: [], span: { w: 2000, h: 2000, x: 0, y: 0 } };

export function initBG() {
  const mk = (hue, sat, lit, a, n) => {
    const arr = [];
    for (let i = 0; i < n; i++) arr.push(tissueSprite(hue + ri(-12, 12), sat, lit, a, rr(0, 6)));
    return arr;
  };
  const layerDefs = [
    { p: 0.22, tile: 1150, count: 2, sMin: 480, sMax: 800, a: 0.72, sp: mk(345, 62, 25, 0.85, 3) },
    { p: 0.45, tile: 900, count: 4, sMin: 220, sMax: 430, a: 0.55, sp: mk(338, 66, 31, 0.7, 3) },
    { p: 0.80, tile: 700, count: 5, sMin: 90, sMax: 210, a: 0.36, sp: mk(352, 72, 37, 0.6, 3) }
  ];
  BG.layers = layerDefs.map((d) => {
    const items = [];
    for (let i = 0; i < d.count; i++) {
      items.push({
        x: rr(0, d.tile), y: rr(0, d.tile), s: rr(d.sMin, d.sMax),
        a: d.a * rr(0.6, 1.15), i: ri(0, d.sp.length - 1), r: rr(0, TAU)
      });
    }
    return { p: d.p, tile: d.tile, items, sp: d.sp };
  });
  scatter();
}

/** Re-scatter the drifting population over the current maze extents. */
export function scatter() {
  const b = Maze.bounds;
  const s = BG.span;
  s.x = b.minX; s.y = b.minY;
  s.w = Math.max(600, b.maxX - b.minX);
  s.h = Math.max(600, b.maxY - b.minY);

  BG.rbc.length = 0;
  for (let i = 0; i < CFG.ambientRBC; i++) {
    /* red cells belong in plasma, so keep re-rolling until one lands in a vessel */
    let x = 0, y = 0;
    for (let k = 0; k < 8; k++) {
      x = s.x + Math.random() * s.w;
      y = s.y + Math.random() * s.h;
      if (Maze.clearance(x, y) > 6) break;
    }
    BG.rbc.push({ x, y, r: rr(9, 17), a: rr(0, TAU), sp: rr(-0.7, 0.7), sq: rr(0.5, 0.95), al: rr(0.2, 0.5) });
  }
  BG.motes.length = 0;
  for (let i = 0; i < 90; i++) {
    BG.motes.push({ x: s.x + Math.random() * s.w, y: s.y + Math.random() * s.h, r: rr(0.8, 2.6), al: rr(0.15, 0.6), ph: rr(0, TAU) });
  }
}

export function updateBG(dt, t, flow) {
  const s = BG.span;
  for (let i = 0; i < BG.rbc.length; i++) {
    const b = BG.rbc[i];
    const c = currentAt(b.x, b.y, t, flow);
    b.x += c.x * dt * 1.5;
    b.y += c.y * dt * 1.5 + 26 * dt * (flow || 1); // red cells run downstream
    b.a += b.sp * dt;
    /* keep them in the plasma: if they drift into tissue, wrap them home */
    if (b.y > s.y + s.h + 40 || Maze.clearance(b.x, b.y) < -140) {
      const p = Maze.pointInRow((Math.random() * Maze.rows) | 0, null, 20);
      b.x = p.x; b.y = p.y;
    }
  }
  for (let i = 0; i < BG.motes.length; i++) {
    const m = BG.motes[i];
    const c = currentAt(m.x, m.y, t, flow);
    m.x += c.x * dt * 2.4;
    m.y += c.y * dt * 2.4 - 6 * dt;
    if (m.x < s.x) m.x += s.w;
    if (m.x > s.x + s.w) m.x -= s.w;
    if (m.y < s.y) m.y += s.h;
    if (m.y > s.y + s.h) m.y -= s.h;
  }
}

export function drawLayers(t) {
  const ctx = View.ctx;
  const halfW = View.w / 2 / View.zoom, halfH = View.h / 2 / View.zoom;
  for (let li = 0; li < Math.min(Q.layers, BG.layers.length); li++) {
    const L = BG.layers[li];
    const ox = cam.x * L.p, oy = cam.y * L.p;
    const x0 = Math.floor((ox - halfW) / L.tile), x1 = Math.ceil((ox + halfW) / L.tile);
    const y0 = Math.floor((oy - halfH) / L.tile), y1 = Math.ceil((oy + halfH) / L.tile);
    for (let tx = x0; tx <= x1; tx++) {
      for (let ty = y0; ty <= y1; ty++) {
        for (let k = 0; k < L.items.length; k++) {
          const it = L.items[k];
          const wx = tx * L.tile + it.x, wy = ty * L.tile + it.y;
          const sx = View.w / 2 + (wx - ox) * View.zoom + cam.sx;
          const sy = View.h / 2 + (wy - oy) * View.zoom + cam.sy;
          const sz = it.s * View.zoom;
          if (sx < -sz || sx > View.w + sz || sy < -sz || sy > View.h + sz) continue;
          const pul = 1 + Math.sin(t * 0.55 + it.r * 3) * 0.035;
          ctx.globalAlpha = it.a;
          ctx.drawImage(L.sp[it.i], sx - (sz / 2) * pul, sy - (sz / 2) * pul, sz * pul, sz * pul);
        }
      }
    }
  }
  ctx.globalAlpha = 1;
}

export function drawRBC() {
  const ctx = View.ctx;
  const halfW = View.w / 2 / View.zoom + 60, halfH = View.h / 2 / View.zoom + 60;
  ctx.save();
  const nr = Math.min(Q.rbc, BG.rbc.length);
  for (let i = 0; i < nr; i++) {
    const b = BG.rbc[i];
    if (Math.abs(b.x - cam.x) > halfW || Math.abs(b.y - cam.y) > halfH) continue;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.a);
    ctx.scale(1, b.sq);
    ctx.beginPath(); ctx.arc(0, 0, b.r, 0, TAU);
    ctx.fillStyle = 'rgba(150,20,44,' + b.al + ')';
    ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, b.r * 0.55, 0, TAU);
    ctx.fillStyle = 'rgba(96,8,28,' + b.al * 0.9 + ')';
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(255,120,150,' + b.al * 0.35 + ')';
    ctx.beginPath(); ctx.arc(0, 0, b.r, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export function drawMotes(t) {
  if (!Q.motes) return;
  const ctx = View.ctx;
  const halfW = View.w / 2 / View.zoom + 40, halfH = View.h / 2 / View.zoom + 40;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < BG.motes.length; i++) {
    const m = BG.motes[i];
    if (Math.abs(m.x - cam.x) > halfW || Math.abs(m.y - cam.y) > halfH) continue;
    const a = m.al * (0.6 + 0.4 * Math.sin(t * 2 + m.ph));
    ctx.fillStyle = 'rgba(255,205,225,' + a + ')';
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}
