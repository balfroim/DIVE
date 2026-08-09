/**
 * Succession: turning a dead diver into a live one.
 *
 * When a career ends the Division does not close the file - it *reassigns* it.
 * This module works out what survives probate and shortlists the people willing
 * to sign for it.
 *
 * Pure functions over a career snapshot: nothing here mutates anything, so the
 * ascension screen can show three futures side by side before you pick one.
 *
 * @module game/lineage
 */

import { CFG } from '../core/config.js';
import { clamp, pick, ri } from '../core/math.js';
import { FIRST_NAMES, RELATIONS, BOONS, FLAWS } from '../data/heirs.js';

/**
 * What an heir with these traits would actually receive.
 * @param {object} career the dead career
 * @param {object[]} traits the heir's traits
 */
export function computeEstate(career, traits) {
  const H = CFG.heir;
  let moneyKeep = H.moneyKeep;
  let keepSuit = false;
  for (const t of traits) {
    if (t.estate) moneyKeep *= t.estate;
    if (t.keepSuit) keepSuit = true;
  }

  const gross = Math.max(0, Math.round(career.credits));
  const probate = Math.round(gross * moneyKeep);
  const tax = Math.round(probate * H.estateTax);
  const credits = Math.max(0, probate - tax);

  return {
    /** For the screen: where the money went. */
    gross,
    probate,
    tax,
    debts: career.credits < 0 ? Math.round(-career.credits) : 0,

    credits: Math.max(H.floor, credits - (career.credits < 0 ? Math.round(-career.credits * 0.5) : 0)),
    rep: Math.round(clamp(career.rep * H.repKeep, 0, CFG.rep.max)),
    scans: Math.floor(career.scans * H.itemKeep),
    waiver: Math.floor(career.waiver * H.itemKeep),
    stab: Math.floor(career.stab * H.itemKeep),
    suit: keepSuit ? career.suit : Math.max(1, career.suit - H.suitDrop),
    payBoost: +(career.payBoost * H.boostKeep).toFixed(3),
    boostN: Math.floor(career.boostN * H.boostKeep),
    tankLv: career.tankLv,
    filterLv: career.filterLv
  };
}

/** One candidate: a name, a relation, one boon, one flaw, and their estate. */
export function makeHeir(career, used) {
  let name = pick(FIRST_NAMES);
  let guard = 0;
  while (used.names.indexOf(name) >= 0 && guard++ < 40) name = pick(FIRST_NAMES);
  used.names.push(name);

  let rel = pick(RELATIONS);
  guard = 0;
  while (used.rels.indexOf(rel.id) >= 0 && guard++ < 40) rel = pick(RELATIONS);
  used.rels.push(rel.id);

  let boon = pick(BOONS);
  guard = 0;
  while (used.traits.indexOf(boon.id) >= 0 && guard++ < 40) boon = pick(BOONS);
  used.traits.push(boon.id);

  let flaw = pick(FLAWS);
  guard = 0;
  while (used.traits.indexOf(flaw.id) >= 0 && guard++ < 40) flaw = pick(FLAWS);
  used.traits.push(flaw.id);

  const traits = [boon, flaw];
  return {
    name,
    /** The family name the licence is registered to. */
    house: career.house || career.agent,
    relation: rel.label,
    note: rel.note,
    age: ri(19, 44),
    traits,
    boon,
    flaw,
    estate: computeEstate(career, traits)
  };
}

/** The Division's shortlist. */
export function makeHeirs(career, n) {
  const used = { names: [], rels: [], traits: [] };
  const out = [];
  const count = n || CFG.heir.candidates;
  for (let i = 0; i < count; i++) out.push(makeHeir(career, used));
  return out;
}

/** How the career ended, phrased the way the Division would phrase it. */
export function causeOfDeath(career) {
  if (career.dead) {
    return career.reason === 'asphyxia'
      ? 'Asphyxiation in the field. Tank empty, extraction not attempted.'
      : 'Died in the field.';
  }
  if (career.struckOff) {
    return career.reason === 'debt'
      ? 'Licence called in against an unpayable balance.'
      : 'Licence terminated following litigation.';
  }
  return 'File closed.';
}
