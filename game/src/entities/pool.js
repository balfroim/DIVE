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
import { attach } from '../ecs/components.js';
import { archetype } from '../data/enemies.js';

export const ents = new Array(CFG.poolEnt);
let entUid = 1;

/** The full entity shape, in one place, so pooled objects never change hidden class. */
export function blankEnt() {
  return {
    /* identity */
    on: false, uid: 0, arch: '', kind: 'healthy', species: '',
    /* ECS components (see ecs/components.js) */
    comp: Object.create(null),
    /* transform + motion */
    x: 0, y: 0, vx: 0, vy: 0, r: 20, ang: 0, spin: 0, phase: 0, seed: 0,
    motion: 'drift', mt: 0, bob: 0, target: null,
    orbA: 0, orbR: 0, orbX: 0, orbY: 0,
    /* appearance */
    hue: 0, sat: 70, lit: 60, elong: 1, lobes: 4, lobeAmp: 0.1, deform: 0,
    sprite: '',
    spikes: 0, spikeLen: 0, spikeTip: false, flag: 0, nuc: 'dot', halo: 0,
    coil: false, segs: 0, wave: 0, tremor: 0, verts: 18, scale: 1,
    /* diagnostics */
    idUntil: -99, idPing: 0, idName: '', idSub: '', idCol: '#7fdcff',
    /* state */
    infect: 0, infCd: 0, infBy: null, age: 0, dying: 0, born: 0, hurt: 0,
    leaving: false, lifespan: 0, preview: false,
    /* blood group, for transfusion contracts */
    abo: '',
    /* how many cells this one is currently clotted to */
    clumpN: 0,
    /** Which maze row this cell belongs to - used by wave bookkeeping. */
    row: 0
  };
}
for (let i = 0; i < ents.length; i++) ents[i] = blankEnt();
World.usePool(ents);

export function freeEnt() {
  for (let i = 0; i < ents.length; i++) if (!ents[i].on) return ents[i];
  return null;
}

const _blank = blankEnt();

export function resetEnt(e, now) {
  for (const k in _blank) {
    if (k === 'comp') continue;
    e[k] = _blank[k];
  }
  e.comp = Object.create(null);
  e.on = true;
  e.uid = entUid++;
  e.seed = rr(0, 100);
  e.phase = rr(0, TAU);
  e.verts = 18;
  e.ang = rr(0, TAU);
  e.spin = rr(-0.5, 0.5);
  e.born = now || 0;
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
  const A = archetype(archId);
  e.arch = A.id;
  e.kind = A.kind;
  e.species = A.id;
  e.sprite = A.sprite || A.id;
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
  const e = freeEnt();
  if (!e) return null;
  const o = opts || {};
  resetEnt(e, o.now);
  const probe = sig.r * 1.2;
  const p = spawnPos(o.row === undefined ? 0 : o.row, probe, o.away, o.awayD, o.strictRow);
  e.x = p.x; e.y = p.y;
  e.row = p.row === undefined ? 0 : p.row;
  dressEnt(e, archId, sig, dev, o);
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
  e.comp = Object.create(null);
  e.spikes = 0; e.spikeLen = 0; e.spikeTip = false; e.flag = 0;
  e.coil = false; e.segs = 0; e.wave = 0; e.tremor = 0; e.deform = 0;
  e.elong = 1; e.halo = 0; e.leaving = false; e.infect = 0;
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
    ents[i].comp = Object.create(null);
  }
}
