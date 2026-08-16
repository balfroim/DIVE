/**
 * The component registry.
 *
 * A component is a plain data record with a name. Declaring one here gives it
 * default values and, optionally, an `apply` that writes derived values onto an
 * entity at attach time.
 *
 * Components never contain behaviour. Behaviour is a system (ecs/systems.js)
 * that asks for a component by name.
 *
 * @module ecs/components
 */

import { rr } from '../core/math.js';

/** name -> definition */
export const COMPONENTS = Object.create(null);

function componentName(ref) {
  return typeof ref === 'string' ? ref : ref && ref.name;
}

function cloneData(data) {
  const out = {};
  if (data) for (const k in data) out[k] = data[k];
  return out;
}

export function defineComponent(nameOrSpec, spec) {
  const cfg = typeof nameOrSpec === 'string'
    ? { ...(spec || {}), name: nameOrSpec }
    : (nameOrSpec || {});
  const def = {
    name: cfg.name,
    create: cfg.create || (() => cloneData(cfg.defaults)),
    reset: cfg.reset || ((c) => {
      if (!cfg.defaults) return;
      for (const k in cfg.defaults) c[k] = cfg.defaults[k];
    }),
    apply: cfg.apply || null
  };
  COMPONENTS[def.name] = def;
  return def;
}

function resolve(ref) {
  const name = componentName(ref);
  return name ? COMPONENTS[name] : null;
}

export function attach(e, ref, data, ctx) {
  const def = resolve(ref);
  if (!def) throw new Error('Unknown component: ' + String(componentName(ref)));
  let inst = e.comp[def.name];
  if (!inst) inst = e.comp[def.name] = def.create(e, ctx || null) || {};
  def.reset(inst, e, ctx || null);
  if (data) for (const k in data) inst[k] = data[k];
  if (def.apply) def.apply(e, inst, ctx || null);
  return inst;
}

export function detach(e, ref) {
  const def = resolve(ref);
  if (!def || !e || !e.comp) return undefined;
  const inst = e.comp[def.name];
  if (inst !== undefined) delete e.comp[def.name];
  return inst;
}

export function get(e, ref) {
  const def = resolve(ref);
  return def && e && e.comp ? e.comp[def.name] : undefined;
}

export function need(e, ref) {
  const inst = get(e, ref);
  if (inst === undefined) throw new Error('Missing component: ' + String(componentName(ref)));
  return inst;
}

export function has(e, ref) {
  return get(e, ref) !== undefined;
}

export function detachAll(e) {
  if (!e || !e.comp) return;
  for (const k in e.comp) delete e.comp[k];
}

/* ------------------------------------------------------------------ */
/* the standard library of components                                 */
/* ------------------------------------------------------------------ */

export const Cell = defineComponent({
  name: 'cell',
  create: () => ({}),
  reset: () => {}
});

export const Appearance = defineComponent({
  name: 'appearance',
  create: () => ({
    hue: 0, sat: 70, lit: 60, elong: 1, lobes: 4, lobeAmp: 0.1, deform: 0,
    spikes: 0, spikeLen: 0, spikeTip: false, flag: 0, nuc: 'dot', halo: 0,
    coil: false, segs: 0, wave: 0, tremor: 0, verts: 18, scale: 1
  }),
  reset(c) {
    c.hue = 0; c.sat = 70; c.lit = 60; c.elong = 1; c.lobes = 4; c.lobeAmp = 0.1;
    c.deform = 0; c.spikes = 0; c.spikeLen = 0; c.spikeTip = false; c.flag = 0;
    c.nuc = 'dot'; c.halo = 0; c.coil = false; c.segs = 0; c.wave = 0;
    c.tremor = 0; c.verts = 18; c.scale = 1;
  }
});

export const Motion = defineComponent({
  name: 'motion',
  create: () => ({
    kind: 'drift', force: 26, speed: 165, turn: 1, jitter: 0,
    mt: 0, bob: 0, target: null, orbA: 0, orbR: 0, orbX: 0, orbY: 0
  }),
  reset(c) {
    c.kind = 'drift'; c.force = 26; c.speed = 165; c.turn = 1; c.jitter = 0;
    c.mt = 0; c.bob = 0; c.target = null; c.orbA = 0; c.orbR = 0; c.orbX = 0; c.orbY = 0;
  },
  apply(e, c, ctx) {
    e.motion = c.kind;
    e.mt = ctx && ctx.reset ? 0 : rr(0.3, 2.2);
  }
});

export const Identity = defineComponent({
  name: 'identity',
  create: () => ({ idUntil: -99, idPing: 0, idName: '', idSub: '', idCol: '#7fdcff' }),
  reset(c) {
    c.idUntil = -99; c.idPing = 0; c.idName = ''; c.idSub = ''; c.idCol = '#7fdcff';
  }
});

export const Lifecycle = defineComponent({
  name: 'lifecycle',
  create: () => ({ age: 0, dying: 0, born: 0, leaving: false, lifespan: 0 }),
  reset(c) {
    c.age = 0; c.dying = 0; c.born = 0; c.leaving = false; c.lifespan = 0;
  }
});

export const Infection = defineComponent({
  name: 'infection',
  create: () => ({ infect: 0, infCd: 0, infBy: null }),
  reset(c) {
    c.infect = 0; c.infCd = 0; c.infBy = null;
  }
});

export const Scratch = defineComponent({
  name: 'scratch',
  create: () => ({ hurt: 0 }),
  reset(c) {
    c.hurt = 0;
  }
});

export const Blood = defineComponent({
  name: 'blood',
  create: () => ({ abo: '', clumpN: 0 }),
  reset(c) {
    c.abo = ''; c.clumpN = 0;
  }
});

export const Preview = defineComponent({
  name: 'preview',
  create: () => ({ present: true }),
  reset(c) { c.present = true; }
});

defineComponent('hostile', { defaults: { weight: 1 } });
defineComponent('bounty', { defaults: { kind: 'kill', mult: 1 } });
defineComponent('property', {
  defaults: { fine: 'deductHost', integrity: 'healthy', label: 'CLIENT PROPERTY' }
});
defineComponent('litigious', {
  defaults: { fine: 'deductSym', integrity: 'symbiote', label: 'LITIGATION' }
});
defineComponent('infects', { defaults: { rate: 0.30, scale: 0.042, cd: 9 } });
defineComponent('converts', { defaults: { into: 'corrupted' } });
defineComponent('chemotaxis', { defaults: { after: 8, ramp: 8, force: 34 } });
defineComponent('guest', {
  defaults: { lifespan: 40, far: 1100 },
  apply(e, c) { e.lifespan = c.lifespan * rr(0.85, 1.2); }
});
defineComponent('bleeds', { defaults: { rate: 0.34, needsClump: false } });
defineComponent('agglutinate', { defaults: { r: 92, pull: 130, bleed: 0.16, min: 2 } });
defineComponent('bloodtype', { defaults: { abo: 'O', foreign: false } });
defineComponent('playerControl', { defaults: {} });
defineComponent('escort', { defaults: {} });
