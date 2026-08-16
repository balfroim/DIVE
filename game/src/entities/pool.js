/**
 * The entity pool, and the bridge between "archetype in a data file" and
 * "live ECS entity in the vessel".
 *
 * `CFG.poolEnt` entity structs are allocated once at start-up and recycled
 * forever. Spawning is maze-aware: cells appear inside real vessel space, never
 * inside the endothelium, and threats prefer chambers the diver is not standing
 * in.
 *
 * @module entities/pool
 */

import { CFG } from '../core/config.js';
import { TAU, rr } from '../core/math.js';
import { Maze } from '../world/maze.js';
import { World } from '../ecs/world.js';
import {
  attach, detach, detachAll, has,
  Appearance, Motion, Identity, Lifecycle, Infection, Scratch, Blood, Preview
} from '../ecs/components.js';
import { ENEMIES } from '../data/enemies.js';

export const ents = new Array(CFG.poolEnt);
let entUid = 1;

const CORE_COMPONENTS = [Appearance, Motion, Identity, Lifecycle, Infection, Scratch, Blood];

function field(e, name, def, key, fallback, specialSet) {
  Object.defineProperty(e, name, {
    configurable: true,
    enumerable: true,
    get() {
      const c = e.comp[def.name];
      return c && key in c ? c[key] : fallback;
    },
    set(v) {
      if (specialSet) {
        specialSet(v);
        return;
      }
      let c = e.comp[def.name];
      if (!c) c = e.comp[def.name] = def.create(e, null) || {};
      c[key] = v;
    }
  });
}

function installAccessors(e) {
  field(e, 'motion', Motion, 'kind', 'drift');
  field(e, 'mt', Motion, 'mt', 0);
  field(e, 'bob', Motion, 'bob', 0);
  field(e, 'target', Motion, 'target', null);
  field(e, 'orbA', Motion, 'orbA', 0);
  field(e, 'orbR', Motion, 'orbR', 0);
  field(e, 'orbX', Motion, 'orbX', 0);
  field(e, 'orbY', Motion, 'orbY', 0);

  field(e, 'hue', Appearance, 'hue', 0);
  field(e, 'sat', Appearance, 'sat', 70);
  field(e, 'lit', Appearance, 'lit', 60);
  field(e, 'elong', Appearance, 'elong', 1);
  field(e, 'lobes', Appearance, 'lobes', 4);
  field(e, 'lobeAmp', Appearance, 'lobeAmp', 0.1);
  field(e, 'deform', Appearance, 'deform', 0);
  field(e, 'spikes', Appearance, 'spikes', 0);
  field(e, 'spikeLen', Appearance, 'spikeLen', 0);
  field(e, 'spikeTip', Appearance, 'spikeTip', false);
  field(e, 'flag', Appearance, 'flag', 0);
  field(e, 'nuc', Appearance, 'nuc', 'dot');
  field(e, 'halo', Appearance, 'halo', 0);
  field(e, 'coil', Appearance, 'coil', false);
  field(e, 'segs', Appearance, 'segs', 0);
  field(e, 'wave', Appearance, 'wave', 0);
  field(e, 'tremor', Appearance, 'tremor', 0);
  field(e, 'verts', Appearance, 'verts', 18);
  field(e, 'scale', Appearance, 'scale', 1);

  field(e, 'idUntil', Identity, 'idUntil', -99);
  field(e, 'idPing', Identity, 'idPing', 0);
  field(e, 'idName', Identity, 'idName', '');
  field(e, 'idSub', Identity, 'idSub', '');
  field(e, 'idCol', Identity, 'idCol', '#7fdcff');

  field(e, 'age', Lifecycle, 'age', 0);
  field(e, 'dying', Lifecycle, 'dying', 0);
  field(e, 'born', Lifecycle, 'born', 0);
  field(e, 'leaving', Lifecycle, 'leaving', false);
  field(e, 'lifespan', Lifecycle, 'lifespan', 0);

  field(e, 'infect', Infection, 'infect', 0);
  field(e, 'infCd', Infection, 'infCd', 0);
  field(e, 'infBy', Infection, 'infBy', null);

  field(e, 'hurt', Scratch, 'hurt', 0);

  field(e, 'abo', Blood, 'abo', '');
  field(e, 'clumpN', Blood, 'clumpN', 0);

  field(e, 'preview', Preview, 'present', false, (v) => {
    if (v) attach(e, Preview, null, { reset: true });
    else detach(e, Preview);
  });
}

function attachCore(e, reset) {
  for (const comp of CORE_COMPONENTS) attach(e, comp, null, reset ? { reset: true } : null);
}

/** The full entity shape, in one place, so pooled objects never change hidden class. */
export function blankEnt() {
  const e = {
    /* identity */
    on: false, uid: 0, arch: '', kind: 'healthy', species: '', row: 0,
    /* ECS components */
    comp: Object.create(null),
    /* transform + motion */
    x: 0, y: 0, vx: 0, vy: 0, r: 20, ang: 0, spin: 0, phase: 0, seed: 0,
    _ax: 0, _ay: 0
  };
  installAccessors(e);
  attachCore(e, true);
  return e;
}

for (let i = 0; i < ents.length; i++) ents[i] = blankEnt();
World.usePool(ents);

export function freeEnt() {
  for (let i = 0; i < ents.length; i++) if (!ents[i].on) return ents[i];
  return null;
}

export function resetEnt(e, now) {
  detachAll(e);
  attachCore(e, true);
  e.on = true;
  e.uid = entUid++;
  e.seed = rr(0, 100);
  e.phase = rr(0, TAU);
  e.verts = 18;
  e.ang = rr(0, TAU);
  e.spin = rr(-0.5, 0.5);
  e.born = now || 0;
  e.x = 0; e.y = 0; e.vx = 0; e.vy = 0; e.r = 20;
  e.arch = ''; e.kind = 'healthy'; e.species = ''; e.row = 0;
  e._ax = 0; e._ay = 0;
  return e;
}

/**
 * Apply an archetype to an entity: appearance, then components.
 *
 * Shared by the world and by the briefing preview cards, so what you are shown
 * in the briefing is built by exactly the same code as what you meet inside.
 *
 * @param {object} e
 * @param {string} archId  key into data/enemies.js
 * @param {object} sig     the client's cell signature
 * @param {number} dev     species deviation 0..1 (low = convincing mimic)
 * @param {object} [o]     contract context, e.g. { abo, donorAbo }
 */
export function dressEnt(e, archId, sig, dev, o) {
  const A = ENEMIES[archId];
  if (!A) return null;
  e.arch = A.id;
  e.kind = A.kind;
  e.species = A.id;
  e.idName = A.idName;
  e.idSub = A.idSub;
  e.idCol = A.idCol;
  /* baseline from the client's own signature, then the archetype's own dress */
  e.hue = sig.hue; e.sat = sig.sat; e.lit = sig.lit; e.r = sig.r;
  e.lobes = sig.lobes; e.lobeAmp = sig.lobeAmp; e.nuc = sig.nuc;
  if (A.dress) A.dress(e, sig, dev === undefined ? 1 : dev, o || null);
  attach(e, 'cell', null, o || null);
  for (const name in A.components) attach(e, name, A.components[name], o || null);
  return e;
}

/**
 * Find somewhere legal to put a new cell.
 *
 * @param {number} row      preferred maze row
 * @param {number} clearR   radius that must fit
 * @param {{x:number,y:number}} [away] point to keep away from (usually the diver)
 * @param {number} [awayD]  how far away
 */
export function spawnPos(row, clearR, away, awayD, strictRow) {
  const rowsToTry = strictRow ? [row] : [row, row + 1, row - 1, row + 2];
  for (const r of rowsToTry) {
    if (r < 0 || r >= Maze.rows) continue;
    for (let i = 0; i < 14; i++) {
      const p = Maze.pointInRow(r, null, clearR + 18);
      if (!Maze.fits(p.x, p.y, clearR)) continue;
      if (away && Math.hypot(p.x - away.x, p.y - away.y) < (awayD || 0)) continue;
      p.row = r;
      return p;
    }
  }
  /* last resort: the entry chamber always exists and always fits */
  return strictRow
    ? { ...Maze.pointInRow(row, null, clearR), row }
    : { x: Maze.entry.x, y: Maze.entry.y, row: 0 };
}

/**
 * Spawn one entity from an archetype id.
 * @param {string} archId
 * @param {object} sig    the client's cell signature
 * @param {number} dev    species deviation 0..1
 * @param {object} opts   { row, now, away, awayD, abo, donorAbo }
 */
export function spawnEnt(archId, sig, dev, opts) {
  const A = ENEMIES[archId];
  if (!A) return null;
  const e = freeEnt();
  if (!e) return null;
  const o = opts || {};
  resetEnt(e, o.now);
  const probe = sig.r * 1.2;
  const p = spawnPos(o.row === undefined ? 0 : o.row, probe, o.away, o.awayD, o.strictRow);
  e.x = p.x; e.y = p.y;
  e.row = p.row === undefined ? 0 : p.row;
  const dressed = dressEnt(e, archId, sig, dev, o);
  if (!dressed) {
    e.on = false;
    detachAll(e);
    return null;
  }
  const a = rr(0, TAU);
  const s = rr(10, 30);
  e.vx = Math.cos(a) * s;
  e.vy = Math.sin(a) * s;
  e.orbX = e.x; e.orbY = e.y;
  e.scale = 0;
  return e;
}

/**
 * Convert a live entity into a different archetype in place (a host cell
 * losing to a pathogen). Keeps position, velocity and row.
 */
export function morphEnt(e, archId, sig, dev, o) {
  const uid = e.uid;
  const x = e.x, y = e.y, vx = e.vx, vy = e.vy, row = e.row;
  const ang = e.ang, spin = e.spin, phase = e.phase, seed = e.seed;
  const age = e.age, dying = e.dying, born = e.born, leaving = e.leaving, lifespan = e.lifespan;
  const infect = e.infect, infCd = e.infCd, infBy = e.infBy;
  const preview = e.preview;
  resetEnt(e, born);
  e.uid = uid;
  e.x = x; e.y = y; e.vx = vx; e.vy = vy; e.row = row;
  e.ang = ang; e.spin = spin; e.phase = phase; e.seed = seed;
  e.age = age; e.dying = dying; e.born = born; e.leaving = leaving; e.lifespan = lifespan;
  e.infect = infect; e.infCd = infCd; e.infBy = infBy;
  if (preview) e.preview = true;
  dressEnt(e, archId, sig, dev, o);
  return e;
}

/** Count live entities matching a predicate - used all over the wave logic. */
export function countEnts(fn) {
  let n = 0;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.on && !e.dying && fn(e)) n++;
  }
  return n;
}

/** Despawn everything (contract teardown). */
export function clearEnts() {
  for (let i = 0; i < ents.length; i++) {
    ents[i].on = false;
    detachAll(ents[i]);
  }
}
