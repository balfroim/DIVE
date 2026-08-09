/**
 * The component registry.
 *
 * A component is a plain data record with a name. Declaring one here gives it
 * default values and, optionally, an `apply` that writes derived values onto
 * the flat entity struct at spawn time (radius, colours, timers - things the
 * renderer reads directly).
 *
 * Components never contain behaviour. Behaviour is a system (ecs/systems.js)
 * that asks for a component by name.
 *
 * To add a capability to the game:
 *   1. `defineComponent('myThing', { defaults: {...} })` here,
 *   2. `defineSystem({ require: ['myThing'], each(e, dt, ctx, c) {...} })`,
 *   3. list `myThing: {...}` under an archetype in data/enemies.js.
 * Nothing else has to change.
 *
 * @module ecs/components
 */

import { rr } from '../core/math.js';

/** name -> { defaults, apply } */
export const COMPONENTS = Object.create(null);

export function defineComponent(name, spec) {
  COMPONENTS[name] = {
    name,
    defaults: (spec && spec.defaults) || {},
    apply: (spec && spec.apply) || null
  };
  return COMPONENTS[name];
}

/** Attach a component instance to an entity, merging over its defaults. */
export function attach(e, name, data, ctx) {
  const def = COMPONENTS[name];
  const inst = {};
  if (def) for (const k in def.defaults) inst[k] = def.defaults[k];
  if (data) for (const k in data) inst[k] = data[k];
  e.comp[name] = inst;
  if (def && def.apply) def.apply(e, inst, ctx || null);
  return inst;
}

/* ------------------------------------------------------------------ */
/* the standard library of components                                  */
/* ------------------------------------------------------------------ */

/**
 * Every pooled cell carries this. It is what separates "a thing in the
 * bloodstream" from an actor (the diver, the escort), so a system can ask for
 * cells without accidentally integrating the player twice.
 */
defineComponent('cell', { defaults: {} });

/**
 * Steering. `kind` selects which branch of the motion system drives it.
 * drift  aimless wander        dart   still, then bursts
 * seek   hunts host cells      wiggle corkscrew swimmer
 * orbit  circles a home point  clump  crawls toward its own kind
 */
defineComponent('motion', {
  defaults: { kind: 'drift', force: 26, speed: 165, turn: 1, jitter: 0 },
  apply(e, c) {
    e.motion = c.kind;
    e.mt = rr(0.3, 2.2);
  }
});

/** Anything that must be killed before the row's valve opens. */
defineComponent('hostile', { defaults: { weight: 1 } });

/** Killing it pays. `kind` picks the rate card in game/economy.js. */
defineComponent('bounty', { defaults: { kind: 'kill', mult: 1 } });

/** The client owns it. Killing it is billed and costs integrity. */
defineComponent('property', {
  defaults: { fine: 'deductHost', integrity: 'healthy', label: 'CLIENT PROPERTY' }
});

/** A paying tenant with a lawyer. Killing it ends careers on insured clients. */
defineComponent('litigious', {
  defaults: { fine: 'deductSym', integrity: 'symbiote', label: 'LITIGATION' }
});

/** Corrupts host cells on contact. */
defineComponent('infects', { defaults: { rate: 0.30, scale: 0.042, cd: 9 } });

/** Can be corrupted into another archetype. */
defineComponent('converts', { defaults: { into: 'corrupted' } });

/** Homes in on the diver once it is old enough, so waves always resolve. */
defineComponent('chemotaxis', { defaults: { after: 8, ramp: 8, force: 34 } });

/** A guest, not a resident: it leaves after `lifespan` seconds. */
defineComponent('guest', {
  defaults: { lifespan: 40, far: 1100 },
  apply(e, c) { e.lifespan = c.lifespan * rr(0.85, 1.2); }
});

/** Drains client integrity every second it is alive. */
defineComponent('bleeds', { defaults: { rate: 0.34, needsClump: false } });

/** Sticks to nearby blood cells and drags them into a clot. */
defineComponent('agglutinate', { defaults: { r: 92, pull: 130, bleed: 0.16, min: 2 } });

/** A red cell with an ABO antigen pattern. `abo` is 'O' | 'A' | 'B' | 'AB'. */
defineComponent('bloodtype', { defaults: { abo: 'O', foreign: false } });

/** The diver. One of these exists. */
defineComponent('playerControl', { defaults: {} });

/** The white blood cell. One of these exists. */
defineComponent('escort', { defaults: {} });
