/**
 * Particle and floating-text pools.
 *
 * Both are fixed-size ring buffers - the game never allocates during a dive, so
 * there is nothing for the garbage collector to stop the world over.
 *
 * @module entities/particles
 */

import { CFG } from '../core/config.js';
import { TAU, rr, clamp } from '../core/math.js';

export const parts = new Array(CFG.poolPart);
for (let i = 0; i < parts.length; i++) parts[i] = { on: false, x: 0, y: 0, vx: 0, vy: 0, r: 1, life: 0, max: 1, hue: 0, sat: 80, lit: 60, kind: 0, drag: 2, spin: 0, a: 0 };
let partHead = 0;

export function spawnPart(x, y, vx, vy, r, life, hue, sat, lit, kind, drag) {
  for (let n = 0; n < parts.length; n++) {
    const p = parts[(partHead + n) % parts.length];
    if (!p.on) {
      partHead = (partHead + n + 1) % parts.length;
      p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.r = r;
      p.life = p.max = life; p.hue = hue; p.sat = sat; p.lit = lit;
      p.kind = kind || 0; p.drag = drag === undefined ? 2.2 : drag;
      p.a = Math.random() * TAU; p.spin = rr(-6, 6);
      return p;
    }
  }
  return null;
}
export function burst(x, y, n, hue, sat, lit, spd, size, kind) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = spd * rr(0.25, 1);
    spawnPart(x + Math.cos(a) * 4, y + Math.sin(a) * 4, Math.cos(a) * s, Math.sin(a) * s,
      size * rr(0.5, 1.3), rr(0.35, 0.9), hue + rr(-14, 14), sat, lit + rr(-8, 12), kind || 0, rr(1.6, 3.2));
  }
}
export function ringPart(x, y, r, hue, sat, lit, life, thick) {
  const p = spawnPart(x, y, 0, 0, r, life, hue, sat, lit, 2, 0);
  if (p) p.vx = thick || 3;
  return p;
}

export const pops = new Array(CFG.poolPop);
for (let i = 0; i < pops.length; i++) pops[i] = { on: false, x: 0, y: 0, vy: 0, t: 0, life: 1, txt: '', col: '#fff', size: 16, sub: '' };
export function popup(x, y, txt, col, size, sub) {
  for (let i = 0; i < pops.length; i++) {
    const p = pops[i];
    if (!p.on) {
      p.on = true; p.x = x; p.y = y; p.vy = -42; p.t = 0; p.life = 1.15;
      p.txt = txt; p.col = col; p.size = size || 17; p.sub = sub || '';
      return p;
    }
  }
  return null;
}

export function updateParts(dt) {
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p.on) continue;
    p.life -= dt;
    if (p.life <= 0) { p.on = false; continue; }
    if (p.kind === 2) { p.r += p.vx * 260 * dt * (p.life / p.max + 0.25); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const f = Math.max(0, 1 - p.drag * dt);
    p.vx *= f; p.vy *= f;
    if (p.kind === 1) p.vy -= 24 * dt;      // bubbles rise
    p.a += p.spin * dt;
  }
  for (let i = 0; i < pops.length; i++) {
    const p = pops[i];
    if (!p.on) continue;
    p.t += dt;
    p.y += p.vy * dt; p.vy *= Math.max(0, 1 - 2.4 * dt);
    if (p.t >= p.life) p.on = false;
  }
}
