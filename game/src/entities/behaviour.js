/**
 * Cell behaviour: steering, separation, infection.
 *
 * Everything here is pure simulation. Consequences (bounties, fines, lost
 * clients) are raised through `Rules` in entities/hooks.js.
 *
 * @module entities/behaviour
 */

import { CFG } from '../core/config.js';
import { TAU, PI, rr, lerp, clamp } from '../core/math.js';
import { Maze } from '../world/maze.js';
import { ents } from './pool.js';
import { PSPEC } from './species.js';
import { burst } from './particles.js';
import { Rules } from './hooks.js';
import { player } from './player.js';
import { buddy } from './buddy.js';

/** Ambient plasma current, sampled at a point. Gives the world its lazy drift. */
const _cur = { x: 0, y: 0 };
export function currentAt(x, y, t, flow) {
  const f = flow === undefined ? 1 : flow;
  _cur.x = (Math.sin(y * 0.0016 + t * 0.22) * 30 + Math.sin((x + y) * 0.0009 - t * 0.15) * 18) * f;
  _cur.y = (Math.cos(x * 0.0014 - t * 0.18) * 26 + Math.cos((x - y) * 0.0011 + t * 0.13) * 15) * f;
  return _cur;
}

export function nearestHealthy(e, maxD) {
  let best = null, bd = maxD * maxD;
  for (let i = 0; i < ents.length; i++) {
    const o = ents[i];
    if (!o.on || o.dying || o.kind !== 'healthy') continue;
    const dx = o.x - e.x, dy = o.y - e.y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

/**
 * Advance every live cell.
 * @param {number} dt
 * @param {boolean} live false while paused//between waves - motion continues, rules do not
 * @param {{flow:number, aggression:number}} env pressure-derived environment
 */
export function updateEnts(dt, live, env) {
  const t = Rules.now();
  const flow = env ? env.flow : 1;
  const aggr = env ? env.aggression : 1;

  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (!e.on) continue;
    e.age += dt;
    e.scale = Math.min(1, e.scale + dt * 2.6);
    e.hurt = Math.max(0, e.hurt - dt * 3);
    if (e.idPing > 0) e.idPing -= dt;
    if (e.infCd > 0) e.infCd -= dt;
    if (e.infect > 0) e.infect = Math.max(0, e.infect - dt * 0.24);
    if (e.marked) e.markT += dt;

    if (e.dying > 0) {
      e.dying -= dt * 3.6;
      if (e.dying <= 0) e.on = false;
      continue;
    }

    /* ---- steering ---- */
    let ax = 0, ay = 0;
    const c = currentAt(e.x, e.y, t, flow);
    ax += c.x * 0.9; ay += c.y * 0.9;

    switch (e.motion) {
      case 'drift': {
        e.mt -= dt;
        if (e.mt <= 0) { e.mt = rr(1.8, 4.2); e.ang = rr(0, TAU); }
        ax += Math.cos(e.ang) * 26; ay += Math.sin(e.ang) * 26;
        if (e.tremor) {
          ax += Math.sin(t * 21 + e.seed) * 46 * e.tremor;
          ay += Math.cos(t * 19.3 + e.seed * 2) * 46 * e.tremor;
        }
        break;
      }
      case 'dart': {
        e.mt -= dt;
        if (e.mt <= 0) {
          e.mt = rr(1.1, 2.3);
          const a = rr(0, TAU), p = rr(170, 300) * aggr;
          e.vx += Math.cos(a) * p; e.vy += Math.sin(a) * p;
          e.ang = a; e.bob = 1;
        }
        e.bob = Math.max(0, e.bob - dt * 2.2);
        break;
      }
      case 'seek': {
        let tg = e.target;
        if (!tg || !tg.on || tg.dying || tg.kind !== 'healthy') { tg = nearestHealthy(e, 620); e.target = tg; }
        if (tg) {
          const dx = tg.x - e.x, dy = tg.y - e.y, d = Math.hypot(dx, dy) || 1;
          ax += (dx / d) * 78 * aggr; ay += (dy / d) * 78 * aggr;
          e.ang = Math.atan2(dy, dx);
        } else {
          e.mt -= dt;
          if (e.mt <= 0) { e.mt = rr(2, 4); e.ang = rr(0, TAU); }
          ax += Math.cos(e.ang) * 34; ay += Math.sin(e.ang) * 34;
        }
        break;
      }
      case 'wiggle': {
        e.mt -= dt;
        if (e.mt <= 0) { e.mt = rr(1.4, 3.0); e.ang += rr(-1.1, 1.1); }
        const sp = 96 * aggr;
        ax += Math.cos(e.ang) * sp; ay += Math.sin(e.ang) * sp;
        ax += Math.cos(e.ang + PI / 2) * Math.sin(t * 9 + e.seed) * 70;
        ay += Math.sin(e.ang + PI / 2) * Math.sin(t * 9 + e.seed) * 70;
        break;
      }
      case 'orbit': {
        e.orbA += dt * 0.55;
        const tx = e.orbX + Math.cos(e.orbA) * e.orbR;
        const ty = e.orbY + Math.sin(e.orbA) * e.orbR * 0.7;
        ax += (tx - e.x) * 1.7; ay += (ty - e.y) * 1.7;
        break;
      }
    }

    /* symbiotes are guests, not residents - eventually they move on */
    if (e.kind === 'symbiote' && !e.marked) {
      if (!e.leaving && e.age > e.lifespan) { e.leaving = true; e.motion = 'drift'; }
      if (e.leaving && Math.hypot(e.x - player.x, e.y - player.y) > 1100) { e.on = false; continue; }
    }

    /* chemotaxis: older pathogens home in on the diver so waves resolve */
    if (e.kind === 'pathogen' && e.age > 8) {
      const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
      const k = clamp((e.age - 8) / 8, 0, 1) * 34 * aggr;
      ax += (dx / d) * k; ay += (dy / d) * k;
    }

    /* the diver's wake and the white cell's bulk shove cells around */
    for (let s = 0; s < 2; s++) {
      const sx = s ? buddy.x : player.x, sy = s ? buddy.y : player.y;
      const sr = s ? buddy.r + e.r + 14 : 62 + e.r;
      const dx = e.x - sx, dy = e.y - sy, dd = Math.hypot(dx, dy);
      if (dd < sr && dd > 0.5) {
        const f = (1 - dd / sr) * (s ? 620 : 300);
        ax += (dx / dd) * f; ay += (dy / dd) * f;
      }
    }

    e.vx += ax * dt; e.vy += ay * dt;
    const fr = Math.max(0, 1 - 1.35 * dt);
    e.vx *= fr; e.vy *= fr;
    const sp = Math.hypot(e.vx, e.vy), mx = (e.motion === 'wiggle' ? 190 : 165) * flow;
    if (sp > mx) { e.vx = (e.vx / sp) * mx; e.vy = (e.vy / sp) * mx; }
    e.x += e.vx * dt; e.y += e.vy * dt;

    /* vessel walls: cells are squishy, so they hug the endothelium rather than bounce */
    const pen = Maze.resolve(e, e.r * 0.72, 0.15);
    if (pen > 0 && e.motion === 'orbit') { e.orbX = e.x; e.orbY = e.y; }
    if (pen > 0) { e.mt = Math.min(e.mt, 0.25); }

    if (e.motion !== 'wiggle' && e.motion !== 'seek') e.phase += e.spin * dt;
    if (e.coil) e.phase += dt * 6;
  }

  /* separation + infection contact (cheap O(n^2) over the active few) */
  for (let i = 0; i < ents.length; i++) {
    const a = ents[i];
    if (!a.on || a.dying) continue;
    for (let j = i + 1; j < ents.length; j++) {
      const b = ents[j];
      if (!b.on || b.dying) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const rad = (a.r * a.elong + b.r * b.elong) * 1.05;
      const d2 = dx * dx + dy * dy;
      if (d2 > rad * rad || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const pushx = (dx / d) * (rad - d) * 0.5;
      const pushy = (dy / d) * (rad - d) * 0.5;
      a.x -= pushx * 0.5; a.y -= pushy * 0.5;
      b.x += pushx * 0.5; b.y += pushy * 0.5;
      if (live && a.kind === 'pathogen' && b.kind === 'healthy' && a.infCd <= 0) infectStep(a, b, dt);
      else if (live && b.kind === 'pathogen' && a.kind === 'healthy' && b.infCd <= 0) infectStep(b, a, dt);
    }
  }
}

/**
 * A pathogen in contact with a host cell corrupts it.
 * Corrupted cells are the slow bleed on client integrity, which is what stops
 * the player from simply parking in a corner and waiting the timer out.
 */
export function infectStep(p, h, dt) {
  h.infect += dt * (0.30 + 0.042 * Rules.difficulty());
  h.infBy = p;
  if (Math.random() < dt * 14) {
    burst(lerp(p.x, h.x, 0.5), lerp(p.y, h.y, 0.5), 1, p.hue, 90, 60, 40, 2.2, 0);
  }
  if (h.infect >= 1) {
    /* never let conversions snowball past a readable count */
    if (Rules.pathogenCap() <= 0) { h.infect = 0.92; p.infCd = 3; return; }
    h.infect = 0;
    h.kind = 'pathogen';
    h.species = 'corrupted';
    PSPEC.corrupted.build(h, Rules.signature(), 1);
    h.idUntil = -99;
    h.hurt = 1;
    p.infCd = 9;
    Rules.onInfection(h);
  }
}
