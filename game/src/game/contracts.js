/**
 * Contract generation.
 *
 * You are freelance: the Division posts a board, you pick. What is on the board
 * is a function of your reputation - low reputation means shallow, low-pressure
 * work on clients nobody would miss; high reputation buys access to deep,
 * hypertensive districts inside people who matter, at ten times the money.
 *
 * A contract is fully determined by its seed, so the briefing you read is
 * exactly the dive you get.
 *
 * @module game/contracts
 */

import { CFG, pressureProfile } from '../core/config.js';
import { clamp } from '../core/math.js';
import { rngHelpers } from '../core/rng.js';
import { organForRep, closestOrganIndex } from '../data/organs.js';
import { TIERS, clientsForRep } from '../data/clients.js';
import { pickType, contractType } from '../data/contract-types.js';
import { makeSignature } from '../entities/species.js';

let seedCounter = 1;

/**
 * Difficulty is one number the whole game reads: pay, reputation, spawn counts
 * and corruption speed all scale off it.
 */
function difficultyOf(rows, pressure, tierIdx, typeBonus) {
  return 1 + (rows - 3) * 0.55 + (pressure - 0.95) * 1.5 + tierIdx * 0.35 + (typeBonus || 0);
}

function organForSlot(rep, slot) {
  const { list, best } = closestOrganIndex(rep);
  const variants = [
    list[Math.max(0, best - 1)],
    list[best],
    list[Math.min(list.length - 1, best + 1)]
  ];
  return variants[clamp(slot, 0, variants.length - 1)] || organForRep(rep);
}

function difficultyLabel(key) {
  if (key === 'EASY') return 'Routine';
  if (key === 'HARD') return 'Ambitious';
  return 'Manageable';
}

/**
 * Rough gas budget for a contract, in seconds. The briefing compares it against
 * the tank you actually own, because running out is fatal, not merely a fail.
 */
function o2Estimate(rows, diff, pressure) {
  const perRow = 26 + diff * 5;
  const rate = CFG.o2.idle + CFG.o2.pressure * Math.max(0, pressure - 1) + CFG.o2.thrust * 0.5;
  return Math.round(rows * perRow * rate);
}

/**
 * Build one offer.
 * @param {number} rep    current reputation 0..100
 * @param {number} seed   reproducible seed
 * @param {number} slot   0 = safest offer on the board, higher = riskier
 */
export function makeContract(rep, seed, slot) {
  const R = rngHelpers(seed);
  const clients = clientsForRep(rep);
  const variant = slot <= 0 ? 'easy' : slot >= 2 ? 'hard' : 'manageable';
  const variantMul = variant === 'easy' ? 0.82 : variant === 'hard' ? 1.18 : 1;
  const organ = organForSlot(rep, slot);
  const type = pickType(rep, R, clamp(slot, 0, 2));

  const ci = clamp(Math.floor(clients.length * (0.2 + slot * 0.3) + R.range(0, 1.4)), 0, clients.length - 1);
  const client = clients[ci];
  const tier = TIERS[client.tier];

  const rows = clamp(organ.depth + (variant === 'easy' ? -1 : variant === 'hard' ? 1 : 0) + (R.chance(0.3) ? 1 : 0), 2, 9);
  const pressure = +(organ.pressure * R.range(0.94, 1.1) * (variant === 'easy' ? 0.92 : variant === 'hard' ? 1.08 : 1)).toFixed(2);
  const diff = difficultyOf(rows, pressure, tier.i, type.diffBonus);
  const clientCode = 1000 + (seed % 8999);

  /* waves: one per row you must fight through, the organ chamber included */
  const waves = rows;

  const money = Math.round((70 + diff * 46) * tier.payMult);
  const fee = Math.round(money * 0.32);          // advance, paid on acceptance
  const comp = Math.round(money * (1.38 + (variant === 'hard' ? 0.12 : variant === 'easy' ? -0.08 : 0)));         // completion bonus

  const sig = makeSignature();
  const targetSpecies = type.threats[(R.f() * type.threats.length) | 0] || type.threats[0];
  const deviation = clamp(1.05 - diff * 0.1 - R.range(0, 0.12), 0.28, 1);
  const repScale = organ.meanRep / rep;
  const difficultyKey = variant.toUpperCase();
  const c = {
    id: 'C' + String(seed % 9973).padStart(4, '0'),
    seed,
    slot,
    type: type.id,
    typeName: type.name,
    typeShort: type.short,
    objective: type.objective,
    typeBrief: type.brief,
    scanHint: type.scanHint,
    hostArch: type.hostArch,
    client: { job: 'CLIENT #' + clientCode, memo: client.memo, tier: tier.i },
    tier,
    variant,
    difficultyKey,
    difficulty: difficultyLabel(difficultyKey),
    organ,
    map: organ.map || null,
    rows,
    /* width is capped against depth so the vessel network is always a
       descent, never a wide arena (see CFG.maze.stretch) */
    cols: clamp(3 + Math.round(diff * 0.25), 2, Math.min(CFG.maze.cols + 2, rows + 1)),
    pressure,
    waves,
    diff: +diff.toFixed(2),
    fee,
    comp,
    repGain: Math.round(CFG.rep.gainBase * (0.6 + tier.i * 0.22) * repScale),
    repLoss: Math.round(CFG.rep.lossFail * (0.6 + tier.i * 0.22) * repScale),
    sig,
    targetSpecies,
    deviation,
    env: pressureProfile(pressure),
    o2Est: o2Estimate(rows, diff, pressure),
    /** Set by transfusion-type contracts. */
    abo: '',
    donorAbo: '',
    typeNote: '',
    /** Filled in by the run. */
    accepted: false
  };

  type.setup(c, R);
  return c;
}

/** A fresh board of offers. Slot 0 is always the safe one. */
export function generateOffers(rep, count) {
  const n = count || CFG.rep.offers;
  const out = [];
  for (let i = 0; i < n; i++) out.push(makeContract(rep, (Date.now() + seedCounter++ * 7919) >>> 0, i));
  return out;
}

/** Human-readable pressure band, for the briefing. */
export function pressureLabel(p) {
  if (p < 1.0) return 'LOW';
  if (p < 1.3) return 'NORMAL';
  if (p < 1.6) return 'RAISED';
  if (p < 2.0) return 'HIGH';
  return 'CRISIS';
}

/** Suit rating the Division recommends for a pressure band. */
export function suitFor(p) {
  return Math.max(1, Math.ceil((p - 0.6) / 0.45));
}

/** Everything the board needs to render one offer, as plain strings. */
export function offerSummary(c) {
  return {
    id: c.id,
    job: c.client.job,
    tier: c.tier.name,
    tierLabel: c.tier.label,
    difficulty: c.difficulty,
    difficultyKey: c.difficultyKey,
    type: c.type,
    typeName: c.typeName,
    typeShort: c.typeShort,
    objective: c.objective,
    site: c.organ.name,
    organ: c.organ.short,
    depth: c.rows,
    pressure: c.pressure.toFixed(2),
    band: pressureLabel(c.pressure),
    suit: suitFor(c.pressure),
    waves: c.waves,
    fee: c.fee,
    comp: c.comp,
    rep: c.repGain,
    risk: c.repLoss,
    lethal: c.tier.lethal,
    memo: c.client.memo,
    note: c.organ.note,
    map: c.organ.map || null,
    o2: c.o2Est,
    typeNote: c.typeNote
  };
}

export { contractType };
