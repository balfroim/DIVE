/**
 * CONTRACT TYPES - what kind of job the board is offering.
 *
 * A contract type owns the *population* of a dive: which archetype the client's
 * own tissue uses, which archetypes are hostile, how many of each spawn per
 * row, and the copy the briefing prints. Everything else (depth, pressure,
 * client tier, money) is generic and comes from game/contracts.js.
 *
 * TO ADD A CONTRACT TYPE: append an entry. Give it a `minRep` so it appears on
 * the board only once the licence allows it, a `weight` for how often it is
 * drawn, and a `diffBonus` if it should be harder than its depth suggests.
 *
 * @module data/contract-types
 */

import { ABO_TYPES, ABO_INCOMPATIBLE, anySymbiote } from './archetypes.js';

export const CONTRACT_TYPES = [
  {
    id: 'purge',
    name: 'Pathogen purge',
    short: 'PURGE',
    minRep: 0,
    weight: 4,
    diffBonus: 0,
    objective: 'Clear every pathogen from every row, then reach the target chamber.',
    brief: 'Routine clearance. Identify the strain, kill it, do not bill the client for their own cells.',
    scanHint: 'The scan pulse names anything it touches. It does not see through tissue.',

    hostArch: 'host',
    hostCount: (diff) => 5 + Math.round(diff * 1.5),
    threats: ['influenza', 'ecoli', 'spirochete'],
    threatCount: (diff, row) => 2 + Math.round(diff * 0.55) + Math.floor(row * 0.6),
    extras: [
      { arch: 'mimic', chance: 0.5, minDiff: 2.2, devBonus: 0.25, awayD: 300 },
      { arch: anySymbiote, chance: 0.55, minRow: 1, awayD: 200 }
    ],
    /** Nothing type-specific to set up. */
    setup() {}
  },

  {
    id: 'transfusion',
    name: 'Transfusion reaction',
    short: 'WRONG BLOOD',
    minRep: 26,
    weight: 2,
    diffBonus: 1.5,
    objective: 'Clear every mismatched donor cell before the clot takes the client.',
    brief: 'A ward gave this client the wrong group. Donor cells are agglutinating - clotting - and every clot ' +
           'is bleeding integrity. Client cells and donor cells are the same shape and nearly the same colour. ' +
           'The only tell is the antigen studs on the membrane.',
    scanHint: 'Scan prints the ABO group. Guessing by stud count is free, and free is what it is worth.',

    hostArch: 'host_rbc',
    hostCount: (diff) => 8 + Math.round(diff * 2.2),
    threats: ['donor_rbc'],
    threatCount: (diff, row) => 3 + Math.round(diff * 0.7) + Math.floor(row * 0.7),
    extras: [
      { arch: anySymbiote, chance: 0.3, minRow: 1, awayD: 200 }
    ],

    /**
     * Pick the client's group and a donor group that is a genuine reaction for
     * it. The stud counts differ, which is the only fair way to tell them apart
     * without spending a scan charge.
     */
    setup(contract, R) {
      const client = ABO_TYPES[Math.floor(R.f() * ABO_TYPES.length) % ABO_TYPES.length];
      const bad = ABO_INCOMPATIBLE[client].length ? ABO_INCOMPATIBLE[client] : ['A'];
      const donor = bad[Math.floor(R.f() * bad.length) % bad.length];
      contract.abo = client;
      contract.donorAbo = donor;
      contract.typeNote = 'CLIENT GROUP ' + client + ' \u00b7 DONOR GROUP ' + donor;
    }
  }
];

export function contractType(id) {
  return CONTRACT_TYPES.find((t) => t.id === id) || CONTRACT_TYPES[0];
}

/** Types the licence unlocks, weighted. */
export function typesForRep(rep) {
  const list = CONTRACT_TYPES.filter((t) => t.minRep <= rep);
  return list.length ? list : [CONTRACT_TYPES[0]];
}

/** Weighted draw from the allowed types. */
export function pickType(rep, R, slot) {
  const list = typesForRep(rep);
  /* the safe slot on the board is always the plain job, so the player can
     always take work they understand */
  if (slot === 0) return list[0];
  let total = 0;
  for (const t of list) total += t.weight;
  let r = R.f() * total;
  for (const t of list) { r -= t.weight; if (r <= 0) return t; }
  return list[list.length - 1];
}
