/**
 * The freelancer.
 *
 * Persistent identity across dives: name, licence (reputation), bank balance,
 * kit, and the job board currently on offer. Anything that survives a contract
 * lives here; anything that dies with the dive lives in game/state.js.
 *
 * A career ends in one of three ways:
 *   - the diver suffocates in the field   -> `dead`
 *   - the licence is struck off           -> `struckOff`
 *   - the diver retires                   -> payroll, and that is that
 *
 * @module game/career
 */

import { CFG } from '../core/config.js';
import { clamp } from '../core/math.js';
import { Store, KEYS } from '../core/store.js';
import { generateOffers } from './contracts.js';
import { repLabel, repStars } from './economy.js';

/** Everything that is written to (and read back from) local storage. */
const SAVED = [
  'agent', 'rep', 'credits', 'scans', 'suit', 'waiver', 'stab',
  'payBoost', 'boostN', 'tankLv', 'filterLv',
  'contracts', 'lost', 'pathogens', 'wrongful', 'charges', 'siphons', 'gross',
  'bestTier', 'deaths', 'struckOff', 'dead', 'reason'
];

const DEV_DEFAULTS = { rep: CFG.rep.start, credits: 0, scans: 0 };

export const Career = {
  /* identity */
  agent: 'AGENT',
  /* licence */
  rep: CFG.rep.start,
  /* bank */
  credits: 0,
  /* kit */
  scans: 0,
  suit: 1,
  waiver: 0,
  stab: 0,
  payBoost: 0,
  boostN: 0,
  /** Oxygen tank upgrades bought. */
  tankLv: 0,
  /** Siphon filter upgrades bought. */
  filterLv: 0,
  /* record */
  contracts: 0,
  lost: 0,
  pathogens: 0,
  wrongful: 0,
  charges: 0,
  siphons: 0,
  gross: 0,
  bestTier: 'D',
  deaths: 0,
  /* flow */
  offers: [],
  contract: null,
  pending: null,
  struckOff: false,
  dead: false,
  lastO2Left: 0,
  lastFiledAt: 0,
  reason: '',
  devMode: false,
  dev: { ...DEV_DEFAULTS },

  reset(name) {
    this.agent = (name || this.agent || 'AGENT').toUpperCase().slice(0, 12);
    const base = this.devMode ? this.dev : DEV_DEFAULTS;
    this.rep = base.rep;
    this.credits = base.credits;
    this.scans = base.scans;
    this.suit = 1;
    this.waiver = 0;
    this.stab = 0;
    this.payBoost = 0;
    this.boostN = 0;
    this.tankLv = 0;
    this.filterLv = 0;
    this.contracts = 0;
    this.lost = 0;
    this.pathogens = 0;
    this.wrongful = 0;
    this.charges = 0;
    this.siphons = 0;
    this.gross = 0;
    this.bestTier = 'D';
    this.deaths = 0;
    this.offers = [];
    this.contract = null;
    this.pending = null;
    this.struckOff = false;
    this.dead = false;
    this.lastO2Left = 0;
    this.lastFiledAt = 0;
    this.reason = '';
  },

  loadDev() {
    this.devMode = true;
    const s = Store.getJSON(KEYS.dev, null);
    if (!s) {
      this.dev = { ...DEV_DEFAULTS };
      return this.dev;
    }
    this.dev = {
      rep: clamp(Math.round(s.rep ?? CFG.rep.start), 0, CFG.rep.max),
      credits: Math.max(CFG.econ.debtFloor, Math.round(s.credits ?? DEV_DEFAULTS.credits)),
      scans: Math.max(0, Math.round(s.scans ?? 0))
    };
    return this.dev;
  },

  saveDev() {
    Store.setJSON(KEYS.dev, this.dev);
  },

  setDevPreset(partial) {
    if (partial.rep !== undefined) {
      this.dev.rep = clamp(Math.round(partial.rep), 0, CFG.rep.max);
      this.rep = this.dev.rep;
    }
    if (partial.credits !== undefined) {
      this.dev.credits = Math.max(CFG.econ.debtFloor, Math.round(partial.credits));
      this.credits = this.dev.credits;
    }
    if (partial.scans !== undefined) {
      this.dev.scans = Math.max(0, Math.round(partial.scans));
      this.scans = this.dev.scans;
    }
    this.saveDev();
    this.save();
    return this;
  },

  resetDevPreset() {
    this.dev = { ...DEV_DEFAULTS };
    this.rep = this.dev.rep;
    this.credits = this.dev.credits;
    this.scans = this.dev.scans;
    this.saveDev();
    this.save();
    return this.dev;
  },

  /* ---------------------------------------------------------------- */
  /* derived kit numbers                                               */
  /* ---------------------------------------------------------------- */

  /** Seconds of gas in the tank, upgrades included. */
  o2Max() {
    return Math.round(CFG.o2.tank + this.tankLv * CFG.o2.tankStep);
  },

  /** Multiplier on oxygen consumption. */
  o2Burn() {
    return 1;
  },

  /** Escort recharge multiplier. */
  fireRate() {
    return 1;
  },

  /** Client integrity destroyed by one siphon, filters included. */
  siphonCost() {
    return Math.max(2, +(CFG.o2.siphonIntegrity * (1 - this.filterLv * CFG.o2.siphonFilter)).toFixed(1));
  },

  /** Pay multiplier from permanent upgrades. */
  payMul() {
    const t = this.contract ? this.contract.tier.payMult : 1;
    return t * (1 + this.payBoost);
  },

  licence() { return repLabel(this.rep); },
  stars() { return repStars(this.rep); },

  /** What the badge says. */
  fullName() {
    return this.agent;
  },

  /* ---------------------------------------------------------------- */
  /* the board                                                         */
  /* ---------------------------------------------------------------- */

  /** Post a fresh board. Called after every settled contract. */
  refreshBoard() {
    this.offers = generateOffers(this.rep);
    return this.offers;
  },

  accept(offer) {
    this.contract = offer;
    offer.accepted = true;
    this.credits += offer.fee;
    this.scans = Math.min(CFG.econ.scanMax, this.scans + CFG.econ.issue);
    if (this.stab > 0) this.stab--;
    return offer;
  },

  /** Apply the outcome of a dive. */
  settle(result) {
    this.credits += result.net;
    this.gross += Math.max(0, result.gross);
    const nextRep = this.rep + result.repDelta;
    this.rep = clamp(nextRep, 0, CFG.rep.max);
    this.pathogens += result.pathKills;
    this.wrongful += result.innocent;
    this.charges += result.scansUsed;
    this.siphons += result.siphons || 0;
    if (result.success) {
      this.contracts++;
      const t = this.contract.tier.name;
      if ('DCBAS'.indexOf(t) > 'DCBAS'.indexOf(this.bestTier)) this.bestTier = t;
    } else {
      this.lost++;
    }
    this.contract = null;
    this.save();
    return this;
  },

  /** Struck off: litigation, or debt. */
  strikeOff(reason) {
    this.struckOff = true;
    this.reason = reason;
  },

  /** The diver did not come back up. */
  die(reason) {
    this.dead = true;
    this.deaths++;
    this.reason = reason || 'asphyxia';
  },

  /** Is this career over, one way or another? */
  finished() { return this.dead || this.struckOff; },

  /* ---------------------------------------------------------------- */
  /* persistence                                                       */
  /* ---------------------------------------------------------------- */

  save() {
    const out = {};
    for (const k of SAVED) out[k] = this[k];
    Store.setJSON(KEYS.career, out);
  },

  load() {
    const s = Store.getJSON(KEYS.career, null);
    if (!s) return false;
    /* a save written by an older build may carry fields we no longer use */
    for (const k of SAVED) if (s[k] !== undefined) this[k] = s[k];
    this.scans = Math.min(CFG.econ.scanMax, Math.max(0, Math.round(this.scans || 0)));
    return true;
  },

  /** Payroll (high score) table. */
  payroll() { return Store.getJSON(KEYS.scores, []); },

  filePayroll() {
    const list = this.payroll();
    const entry = {
      name: this.fullName(),
      cr: Math.round(this.credits),
      rep: Math.round(this.rep),
      contracts: this.contracts,
      tier: this.bestTier,
      reason: this.reason || 'retired',
      d: Date.now()
    };
    this.lastFiledAt = entry.d;
    list.push(entry);
    list.sort((a, b) => b.cr - a.cr);
    Store.setJSON(KEYS.scores, list.slice(0, 8));
    return entry;
  }
};
