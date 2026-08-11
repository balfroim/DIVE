/**
 * Pooled entities are allocated once at module load and recycled forever.  
 */

import { CFG } from '../core/config.js';
import { TAU, rr } from '../core/math.js';
import { World } from '../ecs/world.js';
import { COMPONENTS } from '../ecs/components.js';
import { archetype } from '../data/enemies.js';

let nextUid = 1;

/**
 * Identity holds per-entity metadata for indentification.
 * 
 * @member {number} uid: unique integer for this entity
 * @member {string} arch: archetype string, e.g. "bacteria"
 * @member {string} kind: string, e.g. "healthy", "infected", "mutant"
 * @member {string} species: string, e.g. "bacteria", "virus", "parasite"
 *
 */
class Identity {
  uid = 0;
  arch = null;
  kind = 'healthy';
  species = '';

  reset() {
    this.uid = 0;
    this.arch = null;
    this.kind = 'healthy';
    this.species = '';
  }
}

/**
 * Transform holds per-entity position, velocity, and orientation data.
 * 
 * @member {number} x: x position
 * @member {number} y: y position
 * @member {number} vx: x velocity
 * @member {number} vy: y velocity
 * @member {number} r: radius
 * @member {number} ang: angle in radians
 * @member {number} spin: angular velocity in radians per frame
 * @member {number} phase: phase offset for oscillatory motion
 * @member {number} seed: random seed for procedural variation
 */
class Transform {
  x = 0; y = 0; vx = 0; vy = 0; r = 20; ang = 0; spin = 0; phase = 0; seed = 0;

  reset() {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.r = 20;
    this.ang = 0; this.spin = 0; this.phase = 0; this.seed = 0;
  }
}

/**
 * Motion holds per-entity motion state, including mode, target, and orbital parameters.
 *
 * @member {string} mode: motion mode, e.g. "drift", "orbit", "chase"
 * @member {number} mt: motion time accumulator
 * @member {number} bob: vertical bobbing offset
 * @member {object|null} target: target entity for chasing or orbiting
 * @member {number} orbA: orbital angle in radians
 * @member {number} orbR: orbital radius
 * @member {number} orbX: orbital center x position
 * @member {number} orbY: orbital center y position
 */
class Motion {
  mode = 'drift'; mt = 0; bob = 0; target = null; orbA = 0; orbR = 0; orbX = 0; orbY = 0;

  reset() {
    this.mode = 'drift'; this.mt = 0; this.bob = 0; this.target = null;
    this.orbA = 0; this.orbR = 0; this.orbX = 0; this.orbY = 0;
  }
}

/**
 * Appearance holds per-entity visual styling parameters.
 *
 * @member {number} hue: color hue (0-360)
 * @member {number} sat: color saturation (0-100)
 * @member {number} lit: color lightness (0-100)
 * @member {number} elong: elongation factor for shape
 * @member {number} lobes: number of lobes in shape
 * @member {number} lobeAmp: amplitude of lobes
 * @member {number} deform: deformation factor
 * @member {number} spikes: number of spikes
 * @member {number} spikeLen: length of spikes
 * @member {boolean} spikeTip: whether spikes have tips
 * @member {boolean} flag: whether to render a flag
 * @member {string} nuc: nucleus style, e.g. "dot", "ring"
 * @member {number} halo: halo size
 * @member {boolean} coil: whether to render a coil
 * @member {number} segs: number of segments in shape
 * @member {number} wave: wave amplitude
 * @member {number} tremor: tremor amplitude
 * @member {number} verts: number of vertices in shape
 * @member {number} scale: overall scale factor
 */
class Appearance {
  hue = 0; sat = 70; lit = 60; elong = 1; lobes = 4; lobeAmp = 0.1;
  // TODO(open question): If per-frame systems write deform, tremor, wave, or bob,
  // reproject() must not clear those animated values or morphs will hitch.
  deform = 0; spikes = 0; spikeLen = 0; spikeTip = false; flag = false;
  nuc = 'dot'; halo = 0; coil = false; segs = 0; wave = 0; tremor = 0;
  verts = 18; scale = 1;

  reset() {
    this.hue = 0; this.sat = 70; this.lit = 60; this.elong = 1; this.lobes = 4;
    this.lobeAmp = 0.1; this.deform = 0; this.spikes = 0; this.spikeLen = 0;
    this.spikeTip = false; this.flag = false; this.nuc = 'dot'; this.halo = 0;
    this.coil = false; this.segs = 0; this.wave = 0; this.tremor = 0;
    this.verts = 18; this.scale = 1;
  }
}

/**
 * Diagnostics holds per-entity debug information for development and testing.
 *
 * @member {number} idUntil: frame until which the ID is displayed
 * @member {number} idPing: ping counter for ID display
 * @member {string} idName: name to display for the entity
 * @member {string} idSub: subtitle to display for the entity
 * @member {string} idCol: color for ID display
 */
class Diagnostics {
  idUntil = -99; idPing = 0; idName = ''; idSub = ''; idCol = '#7fdcff';

  reset() {
    this.idUntil = -99; this.idPing = 0; this.idName = ''; this.idSub = '';
    this.idCol = '#7fdcff';
  }
}

/**
 * State holds per-entity gameplay state, including infection, age, and lifecycle flags.
 *
 * @member {number} infect: infection level (0-100)
 * @member {number} infCd: infection cooldown timer
 * @member {Entity|null} infBy: entity that infected this one
 * @member {number} age: age in frames
 * @member {boolean} dying: whether the entity is dying
 * @member {number} born: frame when the entity was spawned
 * @member {number} hurt: damage taken
 * @member {boolean} leaving: whether the entity is leaving the scene
 * @member {number} lifespan: total lifespan in frames
 * @member {boolean} preview: whether the entity is in preview mode
 */
class State {
  infect = 0; infCd = 0; infBy = null; age = 0; dying = false; born = 0;
  hurt = 0; leaving = false; lifespan = 0; preview = false;

  reset() {
    this.infect = 0; this.infCd = 0; this.infBy = null; this.age = 0;
    this.dying = false; this.born = 0; this.hurt = 0; this.leaving = false;
    this.lifespan = 0; this.preview = false;
  }
}

class Blood {
  abo = ''; clumpN = 0;

  reset() { this.abo = ''; this.clumpN = 0; }
}

function componentNamesFor(arch) {
  return arch?.components ?? arch?.comps ?? [];
}

function componentDefinition(name) {
  return COMPONENTS[name] ?? {};
}

export class Entity {
  // These are intentionally flat hot fields: every loop head checks them.
  on = false;
  row = 0;

  id;
  transform;
  motion;
  appearance;
  diag;
  state;
  blood;
  #comp = new Map();

  constructor() {
    this.id = new Identity();
    this.transform = new Transform();
    this.motion = new Motion();
    this.appearance = new Appearance();
    this.diag = new Diagnostics();
    this.state = new State();
    this.blood = new Blood();
  }

  get components() { return [...this.#comp.keys()]; }

  has(name) { return this.#comp.has(name); }
  get(name) { return this.#comp.get(name); }

  attach(name, data = {}) {
    const definition = componentDefinition(name);
    const defaults = definition.defaults ?? {};
    const value = { ...defaults, ...data };
    this.#comp.set(name, value);
    if (typeof definition.apply === 'function') definition.apply(this, value);
    return value;
  }

  detach(name) { return this.#comp.delete(name); }
  clearComponents() { this.#comp.clear(); }

  *[Symbol.iterator]() { yield* this.#comp; }

  reset(now) {
    this.id.reset();
    this.transform.reset();
    this.motion.reset();
    this.appearance.reset();
    this.diag.reset();
    this.state.reset();
    this.blood.reset();
    this.clearComponents();
    this.on = true;
    this.id.uid = nextUid++;
    this.transform.seed = rr(0, 100);
    this.transform.phase = rr(0, TAU);
    this.transform.ang = rr(0, TAU);
    this.transform.spin = rr(-0.5, 0.5);
    this.appearance.verts = 18;
    this.state.born = now || 0;
    return this;
  }

  release() {
    this.on = false;
    this.clearComponents();
  }

  reproject() {
    // This is why the sub-objects were worth it: "which fields are appearance"
    // is now the object itself, so it can never drift out of sync.
    this.appearance.reset();
    for (const [name, data] of this.#comp) {
      const apply = componentDefinition(name).apply;
      if (typeof apply === 'function') apply(this, data);
    }
    return this;
  }

  describe() {
    return `Entity#${this.id.uid} arch=${this.id.arch ?? '-'} kind=${this.id.kind} on=${this.on} components=[${this.components.join(',')}]`;
  }

  toString() { return this.describe(); }
}

export const ents = Array.from({ length: CFG.poolEnt }, () => new Entity());
World.usePool(ents);

export function freeEnt() {
  return ents.find((e) => e.on === false) ?? null;
}

export function resetEnt(e, now) { return e.reset(now); }

export function spawnEnt(archId, p = {}, now = 0) {
  const definition = archetype(archId);
  const entity = freeEnt();
  if (!definition || !entity) return null;

  entity.reset(now);
  entity.id.arch = archId;
  if (p.x !== undefined) entity.transform.x = p.x;
  if (p.y !== undefined) entity.transform.y = p.y;
  if (p.row !== undefined) entity.row = p.row;
  if (p.kind !== undefined) entity.id.kind = p.kind;
  if (p.species !== undefined) entity.id.species = p.species;

  // Assumption: reset runs first because archetype styling assigns, rather than
  // incrementally reads, existing appearance values.
  // TODO(open question): Does dress/archetype code read values (e.g. e.hue += 10)
  // or only assign them? If it reads them, this ordering needs revisiting.
  for (const name of componentNamesFor(definition)) entity.attach(name);

  const a = rr(0, TAU);
  const s = rr(10, 30);
  entity.transform.vx = Math.cos(a) * s;
  entity.transform.vy = Math.sin(a) * s;
  entity.motion.orbX = entity.transform.x;
  entity.motion.orbY = entity.transform.y;
  entity.appearance.scale = 0;
  return entity;
}

export function morphEnt(e, archId, now) {
  const definition = archetype(archId);
  if (!definition || !e) return null;
  for (const name of e.components) e.detach(name);
  e.appearance.reset();
  for (const name of componentNamesFor(definition)) e.attach(name);
  e.id.arch = archId;
  // Structurally correct: the new component set is the single source of truth.
  e.reproject();
  if (now !== undefined) e.state.born = now;
  return e;
}

export function countEntities(predicate) {
  return ents.reduce((count, e) => count + (e.on && !e.state.dying && predicate(e) ? 1 : 0), 0);
}

export function clearEnts() {
  for (const e of ents) e.release();
}