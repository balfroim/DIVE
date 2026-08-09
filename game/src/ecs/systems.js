/**
 * The system runner.
 *
 * A system is `{ name, order, require, each, pre, post, run }`:
 *   require  array of component names; `each` is called for every live entity
 *            that carries all of them
 *   each     (entity, dt, ctx, primaryComponent) - the per-entity tick
 *   pre/post ({dt, ctx}) - run once before/after the entity sweep
 *   run      ({dt, ctx}) - a whole-world system with no per-entity sweep
 *            (pairwise collision, for example)
 *
 * `order` decides the pipeline. Steering runs before integration; integration
 * runs before contact resolution; consequences run last. Anything registered
 * with the same order keeps registration order.
 *
 * ctx is `{ t, dt, live, env, diff }` - `live` is false while the dive is
 * paused or already settled, and systems must not raise rules when it is.
 *
 * @module ecs/systems
 */

import { World } from './world.js';

/** Canonical pipeline slots, so a new system can be dropped in by name. */
export const ORDER = {
  timers: 10,
  steer: 20,
  integrate: 40,
  contact: 50,
  consequences: 60,
  actors: 70
};

export const SYSTEMS = [];

export function defineSystem(spec) {
  const sys = {
    name: spec.name || 'system' + SYSTEMS.length,
    order: spec.order === undefined ? ORDER.steer : spec.order,
    require: spec.require || null,
    each: spec.each || null,
    pre: spec.pre || null,
    post: spec.post || null,
    run: spec.run || null,
    seq: SYSTEMS.length
  };
  SYSTEMS.push(sys);
  SYSTEMS.sort((a, b) => (a.order - b.order) || (a.seq - b.seq));
  return sys;
}

/** For tests and hot reloading. */
export function clearSystems() { SYSTEMS.length = 0; }

/** Run one frame of the whole pipeline. */
export function runSystems(dt, ctx) {
  const list = World.entities;
  for (let s = 0; s < SYSTEMS.length; s++) {
    const sys = SYSTEMS[s];
    if (sys.pre) sys.pre(dt, ctx);
    if (sys.each && sys.require) {
      const first = sys.require[0];
      const extra = sys.require.length > 1;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.on) continue;
        const c = e.comp[first];
        if (!c) continue;
        if (extra) {
          let ok = true;
          for (let k = 1; k < sys.require.length; k++) {
            if (!e.comp[sys.require[k]]) { ok = false; break; }
          }
          if (!ok) continue;
        }
        sys.each(e, dt, ctx, c);
      }
    }
    if (sys.run) sys.run(dt, ctx);
    if (sys.post) sys.post(dt, ctx);
  }
}
