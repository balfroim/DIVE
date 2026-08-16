import { rr, TAU } from '../core/math.js';
import { attach } from '../ecs/components.js';
import { ARCHETYPES } from '../data/archetypes.js';
import { type Signature } from '../data/Signature.js';
import { Maze } from '../world/maze.js';
import { fetchAvailableEntity } from './pool.js';
import type { MicrobeBlueprint } from './microbes/blueprint.js';

const DEFAULT_ID_COL = '#7fdcff';

let nextUid = 1;

export type EntityKind = 'healthy' | string;
export type MotionType = 'drift' | string;
export type NucleusType = 'dot' | string;

export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  on: boolean;
  kind: EntityKind;
  dying: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  nucleus: NucleusType;
  comp: Record<string, unknown>;
}

export interface Transform {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ang: number;
  spin: number;
  phase: number;
  seed: number;
}

export interface Motion {
  motion: MotionType;
  mt: number;
  bob: number;
  target: unknown;
  orbA: number;
  orbR: number;
  orbX: number;
  orbY: number;
}

export interface Appearance {
  hue: number;
  sat: number;
  lit: number;
  elongation: number;
  lobes: number;
  lobeAmp: number;
  deform: number;
  spikes: number;
  spikeLen: number;
  spikeTip: boolean;
  flag: number;
  nuc: NucleusType;
  halo: number;
  coil: boolean;
  segs: number;
  wave: number;
  tremor: number;
  verts: number;
  scale: number;
}

export interface Diagnostics {
  idUntil: number;
  idPing: number;
  marked: boolean;
}

export interface State {
  infect: number;
  infCd: number;
  infBy: unknown;
  age: number;
  dying: boolean;
  born: number;
  hurt: number;
  leaving: boolean;
  lifespan: number;
  preview: boolean;
  marked: boolean;
}

export interface Scratch {
  _ax: number;
  _ay: number;
  _g: unknown;
  _gk: string;
  _gc: unknown;
}

export interface Microbe extends Entity, Transform, Motion, Appearance, Diagnostics, State, Scratch {
  arch: string | null;
  species: string;
  idName: string;
  idSub: string;
  idCol: string;
  comp: Record<string, unknown>;
  uid: number;
}



export interface DressOpts {
  species?: string;
  abo?: string;
  donorAbo?: string;
  kind?: EntityKind;
  now?: number;
  row?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  away?: Point | null;
  awayD?: number;
  strictRow?: boolean;
  [key: string]: unknown;
}

function clearComponentMap(e: Entity): void {
  if (!e.comp) e.comp = Object.create(null);
  for (const name in e.comp) delete e.comp[name];
}

function resetIdentity(e: Microbe): void {
  e.uid = 0;
  e.arch = null;
  e.kind = 'healthy';
  e.species = '';
  e.idName = '';
  e.idSub = '';
  e.idCol = DEFAULT_ID_COL;
}

function resetTransform(e: Transform): void {
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

function resetMotion(e: Motion): void {
  e.motion = 'drift';
  e.mt = 0;
  e.bob = 0;
  e.target = null;
  e.orbA = 0;
  e.orbR = 0;
  e.orbX = 0;
  e.orbY = 0;
}

function resetAppearance(e: Appearance): void {
  e.hue = 0;
  e.sat = 70;
  e.lit = 60;
  e.elongation = 1;
  e.lobes = 4;
  e.lobeAmp = 0.1;
  e.deform = 0;
  e.spikes = 0;
  e.spikeLen = 0;
  e.spikeTip = false;
  e.flag = 0;
  e.nuc = 'dot';
  e.halo = 0;
  e.coil = false;
  e.segs = 0;
  e.wave = 0;
  e.tremor = 0;
  e.verts = 18;
  e.scale = 1;
}

function resetDiagnostics(e: Diagnostics): void {
  e.idUntil = -99;
  e.idPing = 0;
  e.marked = false;
}

function resetState(e: State): void {
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
  e.marked = false;
}

function resetScratch(e: Scratch): void {
  e._ax = 0;
  e._ay = 0;
  e._g = null;
  e._gk = '';
  e._gc = null;
}

function componentNamesFor(definition: MicrobeBlueprint | null | undefined): string[] {
  const comps = definition?.components ?? definition?.comps ?? null;
  if (!comps) return [];
  return Array.isArray(comps) ? comps : Object.keys(comps);
}

function componentDataFor(
  definition: MicrobeBlueprint | null | undefined,
  archId: string,
  name: string,
  opts: DressOpts = {}
): Record<string, unknown> {
  const comps = definition?.components ?? definition?.comps ?? null;
  if (!comps || Array.isArray(comps)) return {};
  if (name === 'bloodSignature' || name === 'bloodtype') {
    const base = comps[name] || {};
    const abo = archId === 'donor_rbc' ? (opts.donorAbo || 'A') : (opts.abo || 'O');
    return { ...base, abo };
  }
  return comps[name] || {};
}

function clearMorphSurface(e: Microbe): void {
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

// TODO: refactor and split this too much information
export function blankEnt(): Microbe {
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
    elongation: 1,
    lobes: 4,
    lobeAmp: 0.1,
    deform: 0,
    spikes: 0,
    spikeLen: 0,
    spikeTip: false,
    flag: 0,
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

export function resetEnt(e: Microbe, now = 0): Microbe {
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

/**
 * Configures a pooled entity to the specified archetype.
 * @param entity The pooled entity to configure.
 * @param archId The archetype ID.
 * @param sig The signature for the entity.
 * @param dev The deviation for the entity.
 * @param o The dress options.
 * @returns The dressed entity or null if the archetype is not found.
 */
export function dressEntity(
  entity: Microbe,
  archId: string,
  sig: Signature,
  dev = 0,
  o: DressOpts = {}
): Microbe | null {
  const archetype: MicrobeBlueprint = ARCHETYPES.get(archId) as MicrobeBlueprint;

  entity.arch = archId;
  entity.kind = archetype.kind;
  entity.species = o?.species ?? archId; // FIXME: wtf
  entity.idName = archetype.idName;
  entity.idSub = archetype.idSub;
  entity.idCol = archetype.idCol || DEFAULT_ID_COL;
  
  archetype.onDress(entity, sig, dev, o);
  for (const name of componentNamesFor(archetype)) {
    attach(entity, name, componentDataFor(archetype, archId, name, o));
  }
  return entity;
}

export function spawnPos(
  row?: number | null,
  away: Point | null = null,
  awayD = 0,
  strictRow = false
): Point {
  const entry = Maze.entry as { r?: number } | null;
  const targetRow = row ?? (entry?.r ?? 0);
  const attempts = strictRow ? 12 : 8;
  const pad = 40;
  const pointInRow = (): Point => Maze.pointInRow(targetRow, Math.random, pad);

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

export function spawnEnt(
  archId: string,
  sig: Signature,
  dev = 0,
  opts: DressOpts = {}
): Microbe | null {
  const entity = fetchAvailableEntity();
  const definition = ARCHETYPES.get(archId);
  if (!definition || !entity) return null;
  resetEnt(entity, opts.now || 0);
  entity.row = opts.row ?? 0;
  clearComponentMap(entity);
  // attach(entity, 'cell', {});
  dressEntity(entity, archId, sig, dev, opts);

  if (opts.kind !== undefined) entity.kind = opts.kind;
  if (opts.species !== undefined) entity.species = opts.species;

  const pos =
    opts.x !== undefined && opts.y !== undefined
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

  entity.scale = 1;
  return entity;
}

export function morphEnt(
  e: Microbe,
  archId: string,
  sig: Signature,
  dev = 0,
  opts: DressOpts = {}
): Microbe | null {
  const definition = ARCHETYPES.get(archId);
  if (!definition || !e) return null;

  clearMorphSurface(e);
  e.orbX = e.x;
  e.orbY = e.y;

  dressEntity(e, archId, sig, dev, opts);
  if (opts.kind !== undefined) e.kind = opts.kind;
  if (opts.species !== undefined) e.species = opts.species;
  if (opts.now !== undefined) e.born = opts.now;
  return e;
}