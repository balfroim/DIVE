/**
 * SUCCESSION - who takes the badge when you do not come back up.
 *
 * A licence is an asset. Assets are inherited. The Division keeps a shortlist
 * of next-of-kin, creditors and "interested parties", and when a diver dies it
 * offers the estate to whichever of them will sign fastest.
 *
 * Three data tables, all safe to edit:
 *   RELATIONS  who the candidate is to you, and the flavour of the offer
 *   BOONS      one advantage each candidate brings
 *   FLAWS      one disadvantage each candidate brings
 *
 * A trait's `apply(career)` runs AFTER the estate has been transferred, so it
 * can adjust anything: money, reputation, kit, or the multipliers in
 * `career.mods`.
 *
 * @module data/heirs
 */

export const FIRST_NAMES = [
  'ANSA', 'BREK', 'CALLO', 'DEVA', 'ELIN', 'FYNN', 'GRETA', 'HOLT', 'IVO', 'JUNO',
  'KRESS', 'LOVIS', 'MERT', 'NIVA', 'ORLA', 'PIRU', 'QUIN', 'ROSK', 'SVEN', 'TULLA',
  'UMA', 'VESPA', 'WREN', 'XAN', 'YRSA', 'ZOLA'
];

export const RELATIONS = [
  { id: 'child', label: 'your child', note: 'Was told you worked in logistics.' },
  { id: 'sibling', label: 'your sibling', note: 'Has wanted the badge since the funeral was announced.' },
  { id: 'nephew', label: 'your sister\u2019s boy', note: 'Cheap, keen, and legally an adult since Tuesday.' },
  { id: 'ward', label: 'your ward', note: 'The Division has been paying their school fees. It would like them back.' },
  { id: 'creditor', label: 'your creditor\u2019s daughter', note: 'Taking the licence in lieu of the outstanding balance.' },
  { id: 'partner', label: 'your surviving partner', note: 'Signed the paperwork before the recovery team surfaced.' },
  { id: 'apprentice', label: 'your apprentice', note: 'Watched every dive. Learned mostly the wrong lessons.' },
  { id: 'cousin', label: 'a cousin you never met', note: 'Produced a birth certificate and an unnerving amount of enthusiasm.' }
];

export const BOONS = [
  {
    id: 'lungs', name: 'Freediver lungs',
    desc: '+35% oxygen tank capacity.',
    apply(c) { c.mods.tank += 0.35; }
  },
  {
    id: 'thrift', name: 'Probate lawyer on retainer',
    desc: 'Inherits 60% more of the estate.',
    estate: 1.6,
    apply() { }
  },
  {
    id: 'nameonthedoor', name: 'The family name',
    desc: 'Starts with +12 reputation.',
    apply(c) { c.rep += 12; }
  },
  {
    id: 'kit', name: 'Kept your kit',
    desc: 'Inherits the full suit rating and 4 scan charges.',
    keepSuit: true,
    apply(c) { c.scans += 4; }
  },
  {
    id: 'nerve', name: 'Steady hands',
    desc: 'The escort recharges 20% faster.',
    apply(c) { c.mods.fireRate += 0.20; }
  },
  {
    id: 'gills', name: 'Efficient metabolism',
    desc: 'Burns 18% less oxygen.',
    apply(c) { c.mods.burn -= 0.18; }
  },
  {
    id: 'haggler', name: 'Haggler',
    desc: 'Permanent +10% on every bounty.',
    apply(c) { c.payBoost += 0.10; }
  },
  {
    id: 'clean', name: 'Clean record',
    desc: 'Starts with a malpractice waiver and a stabiliser.',
    apply(c) { c.waiver += 1; c.stab += 1; }
  }
];

export const FLAWS = [
  {
    id: 'debtor', name: 'Inherits your debts',
    desc: '\u2212180 credits, payable immediately.',
    apply(c) { c.credits -= 180; }
  },
  {
    id: 'unknown', name: 'Nobody has heard of them',
    desc: '\u22126 reputation. The board will be thin for a while.',
    apply(c) { c.rep = Math.max(0, c.rep - 6); }
  },
  {
    id: 'panic', name: 'Shallow breather',
    desc: 'Burns 15% more oxygen.',
    apply(c) { c.mods.burn += 0.15; }
  },
  {
    id: 'clumsy', name: 'Heavy trigger finger',
    desc: 'The escort recharges 15% slower.',
    apply(c) { c.mods.fireRate -= 0.15; }
  },
  {
    id: 'cheapsuit', name: 'Pawned the suit',
    desc: 'Suit rating drops to 1.',
    apply(c) { c.suit = 1; }
  },
  {
    id: 'greedy', name: 'Signed a bad agency deal',
    desc: '\u221210% on every bounty.',
    apply(c) { c.payBoost -= 0.10; }
  },
  {
    id: 'squeamish', name: 'Squeamish',
    desc: 'Siphoning the client costs 50% more reputation.',
    apply(c) { c.mods.siphonRep += 0.5; }
  },
  {
    id: 'watched', name: 'On a list',
    desc: 'Scan charges cost 30% more.',
    apply(c) { c.mods.scanCost += 0.30; }
  }
];
