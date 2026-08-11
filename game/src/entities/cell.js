/**
 * The entity schema of a cell shape.
 *
 * @module entities/cell
 */

import { rr, TAU } from '../core/math.js';
import { attach } from '../ecs/components.js';
import { archetype } from '../data/enemies.js';
import { Maze } from '../world/maze.js';
import { fetchAvailableEntity } from './pool.js';

const DEFAULT_ID_COL = '#7fdcff';

let nextUid = 1;

function clearComponentMap(e) {
  if (!e.comp) e.comp = Object.create(null);
  for (const name in e.comp) delete e.comp[name];
}

function resetIdentity(e) {
  e.uid = 0;
  e.arch = null;
  e.kind = 'healthy';
  e.species = '';
  e.idName = '';
  e.idSub = '';
  e.idCol = DEFAULT_ID_COL;
}

function resetTransform(e) {
  e.x = 0;
  e.y = 0;
  e.vx = 0;
  e.vy = 0;
  e.r = 20;
  e.ang = 0;
  e.spin = 0;
  e.phase = 0;
  e.seed = 0;
}

function resetMotion(e) {
  e.motion = 'drift';
  e.mt = 0;
  e.bob = 0;
  e.target = null;
  e.orbA = 0;
  e.orbR = 0;
  e.orbX = 0;
  e.orbY = 0;
}

function resetAppearance(e) {
  e.hue = 0;
  e.sat = 70;
  e.lit = 60;
  e.elong = 1;
  e.lobes = 4;
  e.lobeAmp = 0.1;
  e.deform = 0;
  e.spikes = 0;
  e.spikeLen = 0;
  e.spikeTip = false;
  e.flag = false;
  e.nuc = 'dot';
  e.halo = 0;
  e.coil = false;
  e.segs = 0;
  e.wave = 0;
  e.tremor = 0;
  e.verts = 18;
  e.scale = 1;
}

function resetDiagnostics(e) {
  e.idUntil = -99;
  e.idPing = 0;
  e.marked = false;
}

function resetState(e) {
  e.infect = 0;
  e.infCd = 0;
  e.infBy = null;
  e.age = 0;
  e.dying = false;
  e.born = 0;
  e.hurt = 0;
  e.leaving = false;
  e.lifespan = 0;
  e.preview = false;
}

function resetScratch(e) {
  e._ax = 0;
  e._ay = 0;
  e._g = null;
  e._gk = '';
  e._gc = null;
}

function componentNamesFor(definition) {
  const comps = definition?.components ?? definition?.comps ?? null;
  if (!comps) return [];
  return Array.isArray(comps) ? comps : Object.keys(comps);
}

function componentDataFor(definition, archId, name, opts) {
  const comps = definition?.components ?? definition?.comps ?? null;
  if (!comps || Array.isArray(comps)) return {};
  if (name === 'bloodSignature' || name === 'bloodtype') {
    const base = comps[name] || {};
    const abo = archId === 'donor_rbc' ? (opts.donorAbo || 'A') : (opts.abo || 'O');
    return { ...base, abo };
  }
  return comps[name] || {};
}

function clearMorphSurface(e) {
  e.on = true;
  e.arch = null;
  e.kind = 'healthy';
  e.species = '';
  e.idName = '';
  e.idSub = '';
  e.idCol = DEFAULT_ID_COL;
  resetMotion(e);
  resetAppearance(e);
  resetDiagnostics(e);
  resetScratch(e);
  clearComponentMap(e);
  e.preview = false;
}

export function blankEnt() {
  return {
    on: false,
    row: 0,
    uid: 0,
    arch: null,
    kind: 'healthy',
    species: '',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 20,
    ang: 0,
    spin: 0,
    phase: 0,
    seed: 0,
    motion: 'drift',
    mt: 0,
    bob: 0,
    target: null,
    orbA: 0,
    orbR: 0,
    orbX: 0,
    orbY: 0,
    hue: 0,
    sat: 70,
    lit: 60,
    elong: 1,
    lobes: 4,
    lobeAmp: 0.1,
    deform: 0,
    spikes: 0,
    spikeLen: 0,
    spikeTip: false,
    flag: false,
    nuc: 'dot',
    halo: 0,
    coil: false,
    segs: 0,
    wave: 0,
    tremor: 0,
    verts: 18,
    scale: 1,
    idUntil: -99,
    idPing: 0,
    idName: '',
    idSub: '',
    idCol: DEFAULT_ID_COL,
    infect: 0,
    infCd: 0,
    infBy: null,
    age: 0,
    dying: false,
    born: 0,
    hurt: 0,
    leaving: false,
    lifespan: 0,
    preview: false,
    marked: false,
    comp: Object.create(null),
    _ax: 0,
    _ay: 0,
    _g: null,
    _gk: '',
    _gc: null
  };
}

export function resetEnt(e, now = 0) {
  if (!e.comp) e.comp = Object.create(null);
  for (const name in e.comp) delete e.comp[name];
  resetIdentity(e);
  resetTransform(e);
  resetMotion(e);
  resetAppearance(e);
  resetDiagnostics(e);
  resetState(e);
  resetScratch(e);
  e.on = true;
  e.uid = nextUid++;
  e.seed = rr(0, 100);
  e.phase = rr(0, TAU);
  e.ang = rr(0, TAU);
  e.spin = rr(-0.5, 0.5);
  e.born = now || 0;
  return e;
}

export function dressEnt(e, archId, sig, dev = 0, o = {}) {
  const definition = archetype(archId);
  if (!definition || !e) return null;

  clearComponentMap(e);
  e.arch = archId;
  e.kind = definition.kind || 'healthy';
  e.species = o.species !== undefined ? o.species : archId;
  e.idName = definition.idName || '';
  e.idSub = definition.idSub || '';
  e.idCol = definition.idCol || DEFAULT_ID_COL;

  if (typeof definition.dress === 'function') definition.dress(e, sig, dev, o);
  for (const name of componentNamesFor(definition)) {
    attach(e, name, componentDataFor(definition, archId, name, o));
  }
  return e;
}

export function spawnPos(row, away = null, awayD = 0, strictRow = false) {
  let targetRow = row;
  if (targetRow === undefined || targetRow === null) targetRow = Maze.entry ? Maze.entry.r : 0;
  const attempts = strictRow ? 12 : 8;
  const pad = 40;
  const pointInRow = () => Maze.pointInRow(targetRow, Math.random, pad);

  if (!away || awayD <= 0) return pointInRow();

  let point = pointInRow();
  for (let i = 0; i < attempts; i++) {
    point = pointInRow();
    if (Math.hypot(point.x - away.x, point.y - away.y) >= awayD) return point;
  }

  const dx = point.x - away.x;
  const dy = point.y - away.y;
  const dist = Math.hypot(dx, dy) || 1;
  point.x = away.x + (dx / dist) * awayD;
  point.y = away.y + (dy / dist) * awayD;
  return point;
}

export function spawnEnt(archId, sig, dev = 0, opts = {}) {
  const entity = fetchAvailableEntity();
  const definition = archetype(archId);
  if (!definition || !entity) return null;

  resetEnt(entity, opts.now || 0);
  entity.row = opts.row !== undefined ? opts.row : 0;
  dressEnt(entity, archId, sig, dev, opts);

  if (opts.kind !== undefined) entity.kind = opts.kind;
  if (opts.species !== undefined) entity.species = opts.species;

  const pos = opts.x !== undefined && opts.y !== undefined
    ? { x: opts.x, y: opts.y }
    : spawnPos(entity.row, opts.away || null, opts.awayD || 0, !!opts.strictRow);

  entity.x = pos.x;
  entity.y = pos.y;
  entity.orbX = entity.x;
  entity.orbY = entity.y;

  if (opts.vx !== undefined) entity.vx = opts.vx;
  if (opts.vy !== undefined) entity.vy = opts.vy;
  else {
    const a = rr(0, TAU);
    const s = rr(10, 30);
    entity.vx = Math.cos(a) * s;
    entity.vy = Math.sin(a) * s;
  }

  entity.scale = 0;
  return entity;
}

export function morphEnt(e, archId, sig, dev = 0, opts = {}) {
  const definition = archetype(archId);
  if (!definition || !e) return null;

  clearMorphSurface(e);
  e.orbX = e.x;
  e.orbY = e.y;

  dressEnt(e, archId, sig, dev, opts);
  if (opts.kind !== undefined) e.kind = opts.kind;
  if (opts.species !== undefined) e.species = opts.species;
  if (opts.now !== undefined) e.born = opts.now;
  return e;
}
