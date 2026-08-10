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
    category: 'consumable',
    name: 'Scan charges \u00d7' + CFG.econ.scanBuyN,
    desc: 'Diagnostic pulses. Billed again on activation, naturally.',
    cost: (c) => Math.round(CFG.econ.scanBuy * scale(c)),
    buy: (c) => { c.scans += CFG.econ.scanBuyN; },
    held: (c) => String(c.scans),
    heldLabel: 'Held'
  },
  {
    id: 'suit',
    category: 'upgrade',
    name: 'Suit pressure rating +1',
    desc: 'A bigger shell. Resists the surge in high-pressure districts and buys back some thrust.',
    cost: (c) => Math.round((210 + (c.suit - 1) * 180) * scale(c)),
    buy: (c) => { c.suit += 1; },
    held: (c) => String(c.suit),
    heldLabel: 'Rating'
  },
  {
    id: 'tank',
    category: 'upgrade',
    name: 'O\u2082 tank upgrade +' + CFG.o2.tankStep + 's',
    desc: 'Extended-capacity oxygen tank. Adds ' + CFG.o2.tankStep + ' seconds to your dive clock. Permanent.',
    cost: (c) => Math.round((180 + c.tankLv * 130) * scale(c)),
    buy: (c) => { c.tankLv += 1; },
    held: (c) => Math.round(CFG.o2.tank + c.tankLv * CFG.o2.tankStep) + 's',
    heldLabel: 'Capacity'
  },
  {
    id: 'stab',
    category: 'consumable',
    name: 'Plasma stabiliser',
    desc: '+20 client integrity on your next contract. Consumed on acceptance.',
    cost: (c) => Math.round(95 * scale(c)),
    buy: (c) => { c.stab += 1; },
    held: (c) => String(c.stab),
    heldLabel: 'In kit'
  },
  {
    id: 'waiver',
    category: 'protection',
    name: 'Malpractice waiver',
    desc: 'Absorbs one wrongful elimination. Legal calls this "pre-paid remorse".',
    cost: (c) => Math.round(165 * scale(c)),
    buy: (c) => { c.waiver += 1; },
    held: (c) => String(c.waiver),
    heldLabel: 'Held'
  },
  {
    id: 'boost',
    category: 'economy',
    name: 'Bounty escalator',
    desc: 'Permanent +15% on every elimination bounty. Compounds. Ask no questions.',
    cost: (c) => Math.round((260 + c.boostN * 200) * scale(c)),
    buy: (c) => { c.payBoost += 0.15; c.boostN += 1; },
    held: (c) => '+' + Math.round(c.payBoost * 100) + '%',
    heldLabel: 'Active'
  }
];
