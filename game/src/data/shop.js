/**
 * Requisitions.
 *
 * Each item is `{ id, name, desc, cost(career), buy(career), owned(career) }`.
 * Prices rise with reputation, because the Division prices to what it thinks
 * you can pay.
 *
 * @module data/shop
 */

import { CFG } from '../core/config.js';

const scale = (career) => 1 + career.rep / 90;

export const SHOP = [
  {
    id: 'scans',
    name: 'Scan charges \u00d7' + CFG.econ.scanBuyN,
    desc: 'Diagnostic pulses. Buy a pack when you need them.',
    cost: (c) => Math.round(CFG.econ.scanBuy * scale(c)),
    buy: (c) => { c.scans = Math.min(CFG.econ.scanMax, c.scans + CFG.econ.scanBuyN); },
    owned: (c) => c.scans + ' held'
  },
  {
    id: 'suit',
    name: 'Suit pressure rating +1',
    desc: 'A bigger shell. Resists the surge in high-pressure districts and buys back some thrust.',
    cost: (c) => Math.round((210 + (c.suit - 1) * 180) * scale(c)),
    buy: (c) => { c.suit += 1; },
    owned: (c) => 'rating ' + c.suit
  },
  {
    id: 'stab',
    name: 'Plasma stabiliser',
    desc: '+20 client integrity on your next contract. Consumed on acceptance.',
    cost: (c) => Math.round(95 * scale(c)),
    buy: (c) => { c.stab += 1; },
    owned: (c) => c.stab + ' in kit'
  },
  {
    id: 'waiver',
    name: 'Malpractice waiver',
    desc: 'Absorbs one wrongful elimination. Legal calls this "pre-paid remorse".',
    cost: (c) => Math.round(165 * scale(c)),
    buy: (c) => { c.waiver += 1; },
    owned: (c) => c.waiver + ' held'
  },
  {
    id: 'boost',
    name: 'Bounty escalator',
    desc: 'Permanent +15% on every elimination bounty. Compounds. Ask no questions.',
    cost: (c) => Math.round((260 + c.boostN * 200) * scale(c)),
    buy: (c) => { c.payBoost += 0.15; c.boostN += 1; },
    owned: (c) => '+' + Math.round(c.payBoost * 100) + '%'
  }
];
