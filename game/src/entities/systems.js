/**
 * THE SYSTEMS - all cell behaviour, as a pipeline.
 *
 * Each block below is one system: it declares the components it needs and gets
 * called once per frame for every entity that carries them. Nothing here knows
 * what a contract is; consequences (bounties, fines, lawsuits) are raised
 * through `Rules` in entities/hooks.js and settled in game/.
 *
 * Pipeline order (see ecs/systems.js ORDER):
 *   5  diver          the player's own thrust
 *   6  escort         the white cell
 *   10 timers         ageing, cooldowns, death animation
 *   20 steering       motion, chemotaxis, guests, agglutination
 *   35 wake           being shoved by the diver and the escort
 *   40 integrate      velocity -> position -> vessel walls
 *   50 contact        separation, infection, clot capture
 *   60 consequences   integrity bleed from corruption and clots
 *
 * TO ADD A BEHAVIOUR: define a component in ecs/components.js, add a system
 * here that requires it, then list the component under an archetype in
 * data/enemies.js.
 *
 * @module entities/systems
 */

import { TAU, PI, rr, lerp, clamp } from '../core/math.js';
import { Maze } from '../world/maze.js';
import { currentAt } from '../world/flow.js';
import { defineSystem, ORDER } from '../ecs/systems.js';
import { World } from '../ecs/world.js';
import { burst } from './particles.js';
import { Rules } from './hooks.js';
import { player, updatePlayer } from './player.js';
import { buddy, updateBuddy } from './buddy.js';

/** Nearest entity the client owns - what a `seek` pathogen hunts. */
function nearestProperty(e, maxD) {
  let best = null, bd = maxD * maxD;
  for (let i = 0; i < World.pool.length; i++) {
    const o = World.pool[i];
    if (!o.on || o.dying || !o.comp.property) continue;
    const dx = o.x - e.x, dy = o.y - e.y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* 5 + 6 - the actors                                                  */
/* ------------------------------------------------------------------ */

defineSystem({
  name: 'diver',
  order: 5,
  require: ['playerControl'],
  each(e, dt, ctx) { updatePlayer(dt, ctx.live, ctx.env); }
});

defineSystem({
  name: 'escort',
  order: 6,
  require: ['escort'],
  each(e, dt, ctx) { updateBuddy(dt, ctx.live); }
});

/* ------------------------------------------------------------------ */
/* 10 - timers                                                         */
/* ------------------------------------------------------------------ */

defineSystem({
  name: 'timers',
  order: ORDER.timers,
  require: ['cell'],
  each(e, dt) {
    e.age += dt;
    e.scale = Math.min(1, e.scale + dt * 2.6);
    e.hurt = Math.max(0, e.hurt - dt * 3);
    if (e.idPing > 0) e.idPing -= dt;
    if (e.infCd > 0) e.infCd -= dt;
    if (e.infect > 0) e.infect = Math.max(0, e.infect - dt * 0.24);
    if (e.dying > 0) {
      e.dying -= dt * 3.6;
      if (e.dying <= 0) e.on = false;
    }
  }
});

/* ------------------------------------------------------------------ */
/* 20 - steering                                                       */
/* ------------------------------------------------------------------ */

/** Scratch acceleration, written by the steering systems, read by integrate. */
function steer(e, ax, ay) { e._ax += ax; e._ay += ay; }

defineSystem({
  name: 'motion',
  order: ORDER.steer,
  require: ['cell', 'motion'],
  each(e, dt, ctx, m) {
    if (e.dying > 0) return;
    e._ax = 0; e._ay = 0;
    const t = ctx.t;
    const aggr = ctx.env ? ctx.env.aggression : 1;

    const c = currentAt(e.x, e.y, t, ctx.env ? ctx.env.flow : 1);
    steer(e, c.x * 0.9, c.y * 0.9);

    switch (m.kind) {
      case 'drift': {
        e.mt -= dt;
        if (e.mt <= 0) { e.mt = rr(1.8, 4.2); e.ang = rr(0, TAU); }
        steer(e, Math.cos(e.ang) * m.force, Math.sin(e.ang) * m.force);
        if (e.tremor) {
          steer(e,
            Math.sin(t * 21 + e.seed) * 46 * e.tremor,
            Math.cos(t * 19.3 + e.seed * 2) * 46 * e.tremor);
        }
        break;
      }
      case 'dart': {
        e.mt -= dt;
        if (e.mt <= 0) {
          e.mt = rr(1.1, 2.3);
          const a = rr(0, TAU), p = rr(0.72, 1.28) * m.force * aggr;
          e.vx += Math.cos(a) * p; e.vy += Math.sin(a) * p;
          e.ang = a; e.bob = 1;
        }
        e.bob = Math.max(0, e.bob - dt * 2.2);
        break;
      }
      case 'seek': {
        let tg = e.target;
        if (!tg || !tg.on || tg.dying || !tg.comp.property) { tg = nearestProperty(e, 620); e.target = tg; }
        if (tg) {
          const dx = tg.x - e.x, dy = tg.y - e.y, d = Math.hypot(dx, dy) || 1;
          steer(e, (dx / d) * m.force * aggr, (dy / d) * m.force * aggr);
          e.ang = Math.atan2(dy, dx);
        } else {
          e.mt -= dt;
          if (e.mt <= 0) { e.mt = rr(2, 4); e.ang = rr(0, TAU); }
          steer(e, Math.cos(e.ang) * 34, Math.sin(e.ang) * 34);
        }
        break;
      }
      case 'wiggle': {
        e.mt -= dt;
        if (e.mt <= 0) { e.mt = rr(1.4, 3.0); e.ang += rr(-1.1, 1.1); }
        const sp = m.force * aggr;
        steer(e, Math.cos(e.ang) * sp, Math.sin(e.ang) * sp);
        const s = Math.sin(t * 9 + e.seed) * 70;
        steer(e, Math.cos(e.ang + PI / 2) * s, Math.sin(e.ang + PI / 2) * s);
        break;
      }
      case 'orbit': {
        e.orbA += dt * 0.55;
        const tx = e.orbX + Math.cos(e.orbA) * e.orbR;
        const ty = e.orbY + Math.sin(e.orbA) * e.orbR * 0.7;
        steer(e, (tx - e.x) * 1.7, (ty - e.y) * 1.7);
        break;
      }
      case 'clump': {
        /* a slow, heavy tumble - the pulling is done by the agglutinate system */
        e.mt -= dt;
        if (e.mt <= 0) { e.mt = rr(2.4, 5.0); e.ang = rr(0, TAU); }
        steer(e, Math.cos(e.ang) * m.force, Math.sin(e.ang) * m.force);
        break;
      }
    }
  }
});

defineSystem({
  name: 'chemotaxis',
  order: ORDER.steer + 1,
  require: ['chemotaxis'],
  each(e, dt, ctx, c) {
    if (e.dying > 0 || e.age <= c.after) return;
    const aggr = ctx.env ? ctx.env.aggression : 1;
    const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
    const k = clamp((e.age - c.after) / c.ramp, 0, 1) * c.force * aggr;
    steer(e, (dx / d) * k, (dy / d) * k);
  }
});

defineSystem({
  name: 'guest',
  order: ORDER.steer + 2,
  require: ['guest'],
  each(e, dt, ctx, g) {
    if (e.dying > 0) return;
    if (!e.leaving && e.age > e.lifespan) { e.leaving = true; e.motion = 'drift'; if (e.comp.motion) e.comp.motion.kind = 'drift'; }
    if (e.leaving && Math.hypot(e.x - player.x, e.y - player.y) > g.far) e.on = false;
  }
});

/**
 * Agglutination: mismatched donor cells stick to whatever red cell they touch,
 * including the client's own. That is what makes a transfusion reaction lethal,
 * and what makes it hard to shoot: the clot is a mixed mass.
 */
defineSystem({
  name: 'agglutinate',
  order: ORDER.steer + 3,
  require: ['agglutinate'],
  each(e, dt, ctx, ag) {
    if (e.dying > 0) return;
    let n = 0;
    const r2 = ag.r * ag.r;
    for (let i = 0; i < World.pool.length; i++) {
      const o = World.pool[i];
      if (o === e || !o.on || o.dying || !o.comp.bloodSignature) continue;
      const dx = o.x - e.x, dy = o.y - e.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2 || d2 < 1) continue;
      n++;
      const d = Math.sqrt(d2);
      const pull = ag.pull * (1 - d / ag.r);
      steer(e, (dx / d) * pull, (dy / d) * pull);
      /* the clot drags its neighbours in too */
      o._ax = (o._ax || 0) - (dx / d) * pull * 0.55;
      o._ay = (o._ay || 0) - (dy / d) * pull * 0.55;
    }
    ag.clumpN = n;
  }
});

/* ------------------------------------------------------------------ */
/* 35 - the wake of the big moving things                              */
/* ------------------------------------------------------------------ */

defineSystem({
  name: 'wake',
  order: ORDER.integrate - 5,
  require: ['cell'],
  each(e) {
    if (e.dying > 0) return;
    for (let s = 0; s < 2; s++) {
      const sx = s ? buddy.x : player.x, sy = s ? buddy.y : player.y;
      const sr = s ? buddy.r + e.r + 14 : 62 + e.r;
      const dx = e.x - sx, dy = e.y - sy, dd = Math.hypot(dx, dy);
      if (dd < sr && dd > 0.5) {
        const f = (1 - dd / sr) * (s ? 620 : 300);
        steer(e, (dx / dd) * f, (dy / dd) * f);
      }
    }
  }
});

/* ------------------------------------------------------------------ */
/* 40 - integration                                                    */
/* ------------------------------------------------------------------ */

defineSystem({
  name: 'integrate',
  order: ORDER.integrate,
  require: ['cell'],
  each(e, dt, ctx) {
    if (e.dying > 0) return;
    const m = e.comp.motion;
    const flow = ctx.env ? ctx.env.flow : 1;
    e.vx += (e._ax || 0) * dt;
    e.vy += (e._ay || 0) * dt;
    e._ax = 0; e._ay = 0;
    const fr = Math.max(0, 1 - 1.35 * dt);
    e.vx *= fr; e.vy *= fr;
    const sp = Math.hypot(e.vx, e.vy);
    const mx = (m ? m.speed : 165) * flow;
    if (sp > mx) { e.vx = (e.vx / sp) * mx; e.vy = (e.vy / sp) * mx; }
    e.x += e.vx * dt; e.y += e.vy * dt;

    /* vessel walls: cells are squishy, so they hug the endothelium rather than bounce */
    const pen = Maze.resolve(e, e.r * 0.72, 0.15);
    if (pen > 0) {
      if (e.motion === 'orbit') { e.orbX = e.x; e.orbY = e.y; }
      e.mt = Math.min(e.mt, 0.25);
    }

    if (e.motion !== 'wiggle' && e.motion !== 'seek') e.phase += e.spin * dt;
    if (e.coil) e.phase += dt * 6;
  }
});

/* ------------------------------------------------------------------ */
/* 50 - contact: separation, infection, clotting                       */
/* ------------------------------------------------------------------ */

defineSystem({
  name: 'contact',
  order: ORDER.contact,
  run(dt, ctx) {
    for (let i = 0; i < World.pool.length; i++) {
      const a = World.pool[i];
      if (!a.on || a.dying) continue;
      for (let j = i + 1; j < World.pool.length; j++) {
        const b = World.pool[j];
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
        if (!ctx.live) continue;
        if (a.comp.infects && b.comp.converts && a.infCd <= 0) infectStep(a, b, dt, ctx);
        else if (b.comp.infects && a.comp.converts && b.infCd <= 0) infectStep(b, a, dt, ctx);
      }
    }
  }
});

/**
 * A pathogen in contact with a host cell corrupts it.
 * Corrupted cells are the slow bleed on client integrity, which is what stops
 * the player from simply parking in a corner and waiting the timer out.
 */
function infectStep(p, h, dt, ctx) {
  const inf = p.comp.infects;
  h.infect += dt * (inf.rate + inf.scale * (ctx ? ctx.diff : 1));
  h.infBy = p;
  if (Math.random() < dt * 14) {
    burst(lerp(p.x, h.x, 0.5), lerp(p.y, h.y, 0.5), 1, p.hue, 90, 60, 40, 2.2, 0);
  }
  if (h.infect >= 1) {
    /* never let conversions snowball past a readable count */
    if (Rules.pathogenCap() <= 0) { h.infect = 0.92; p.infCd = 3; return; }
    h.infect = 0;
    p.infCd = inf.cd;
    /* the rules own the transformation: they have the contract's signature */
    Rules.onInfection(h);
  }
}

/* ------------------------------------------------------------------ */
/* 60 - consequences                                                   */
/* ------------------------------------------------------------------ */

defineSystem({
  name: 'bleed',
  order: ORDER.consequences,
  require: ['bleeds'],
  each(e, dt, ctx, b) {
    if (!ctx.live || e.dying > 0) return;
    Rules.onBleed(b.rate * dt, e);
  }
});

defineSystem({
  name: 'clot-bleed',
  order: ORDER.consequences + 1,
  require: ['agglutinate'],
  each(e, dt, ctx, ag) {
    if (!ctx.live || e.dying > 0) return;
    if (e.clumpN >= ag.min) Rules.onBleed(ag.bleed * (e.clumpN - ag.min + 1) * dt, e);
  }
});
