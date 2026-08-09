/**
 * Money. All of it, in one place.
 *
 * Nothing here touches game state - these are pure functions over a run's
 * tallies, which makes the invoice trivially testable and stops "where did that
 * number come from?" bugs.
 *
 * @module game/economy
 */

import { CFG } from '../core/config.js';
import { clamp } from '../core/math.js';

/** What one elimination is worth. */
export function bounty(kind, opts) {
  const e = CFG.econ;
  const base = kind === 'quarantine' ? e.quarantine : e.killBase;
  const diff = 1 + (opts.diff - 1) * 0.22;
  const combo = Math.min(2.2, 1 + 0.12 * (opts.combo || 0));
  return Math.round(base * diff * combo * (opts.payMul || 1) * (opts.mult || 1));
}

/** Scan price scales with the client's tier: premium bodies, premium optics. */
export function scanPrice(tierMul, mod) {
  return Math.round(CFG.econ.scanCost * (tierMul || 1) * (1 + (mod || 0)));
}

/** Tier multiplier used for both billing and damages. */
export function tierMul(tierIdx) {
  return 1 + tierIdx * 0.35;
}

/** Reputation burned by stealing the client's oxygen, scaled to who they are. */
export function siphonRepCost(n, tierIdx, mod) {
  if (!n) return 0;
  return +(n * CFG.rep.siphonLoss * (1 + tierIdx * CFG.rep.siphonTier) * (1 + (mod || 0))).toFixed(1);
}

/**
 * Settle a dive.
 * @param {object} run      run tallies, including `siphons` and `died`
 * @param {object} contract
 * @param {object} career   { payBoost, mods }
 * @param {boolean} success
 * @returns {{lines: Array, net: number, gross: number}}
 */
export function buildInvoice(run, contract, career, success) {
  const e = CFG.econ;
  const tm = tierMul(contract.tier.i);
  const mods = (career && career.mods) || {};
  const lines = [];
  const add = (label, amount, note) => lines.push({ label, amount: Math.round(amount), note: note || '' });

  add('Advance on acceptance', contract.fee);
  add('Elimination bounties', run.bounty);

  if (success) {
    add('Contract completion', contract.comp);
    const retainer = Math.round(CFG.econ.retainer * (run.integrity / 100) * contract.tier.payMult);
    add('Integrity retainer', retainer, Math.round(run.integrity) + '% viable');
  } else {
    add('Completion bonus', 0, 'not earned');
    add('Abandonment fee', -Math.round(120 * tm));
  }

  const scanBill = run.scansUsed * scanPrice(tm, mods.scanCost);
  if (scanBill) add('Diagnostic activations', -scanBill, run.scansUsed + ' x ' + scanPrice(tm, mods.scanCost) + ' cr');

  if (run.siphons) {
    add('Clause nine oxygen levy', -Math.round(run.siphons * e.siphonFee * tm),
      run.siphons + ' unauthorised draw' + (run.siphons > 1 ? 's' : ''));
  }

  if (run.damages) add('Damages and settlements', -run.damages);

  if (run.died) add('Body recovery and cleaning', -Math.round(e.recovery * tm), 'billed to the estate');

  const gross = lines.reduce((a, l) => a + Math.max(0, l.amount), 0);
  const net = lines.reduce((a, l) => a + l.amount, 0);
  return { lines, net: Math.round(net), gross: Math.round(gross) };
}

/** Reputation swing for a finished contract. */
export function repDelta(contract, run, success, career) {
  const mods = (career && career.mods) || {};
  const siphon = siphonRepCost(run.siphons, contract.tier.i, mods.siphonRep);
  if (!success) return -(contract.repLoss + siphon);
  let d = contract.repGain;
  if (run.innocent === 0 && run.symKills === 0 && !run.siphons) d += CFG.rep.cleanBonus;
  return +(d - siphon).toFixed(1);
}

/** Star rating shown on the board, 0..5. */
export function repStars(rep) {
  return clamp(Math.round((rep / CFG.rep.max) * 5 * 2) / 2, 0, 5);
}

/** Licence class name for a reputation. */
export function repLabel(rep) {
  if (rep < 10) return 'PROVISIONAL';
  if (rep < 25) return 'THIRD CLASS';
  if (rep < 45) return 'SECOND CLASS';
  if (rep < 65) return 'FIRST CLASS';
  if (rep < 85) return 'SENIOR';
  return 'PRINCIPAL';
}
