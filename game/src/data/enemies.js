/**
 * THE BESTIARY - every living thing in the bloodstream, as data.
 *
 * One entry here is one *archetype*. An archetype is:
 *
 *   id          the key everything else refers to
 *   name/short/desc   copy for the briefing, the scanner and the shop
 *   idName/idSub/idCol   what the scan pulse prints over it
 *   kind        'healthy' | 'pathogen' | 'symbiote' - the broad class the
 *               renderer tints by and the invoice groups by
 *   dress(e,sig,dev,o)   writes the *appearance* onto the flat entity struct.
 *               `sig` is the client's cell signature, `dev` is how far this
 *               strain strays from it (low deviation = a convincing mimic),
 *               `o` is contract context such as the blood group.
 *   components  the ECS components it carries. Data only - the behaviour lives
 *               in entities/systems.js, keyed by component name.
 *
 * TO ADD AN ENEMY: copy an entry, change the numbers, and list its id in a
 * contract type's `threats` array in data/contract-types.js. That is the whole
 * procedure - no other file needs to be touched.
 *
 * @module data/enemies
 */

import { rr, ri, pick, sgn, clamp, wrapHue } from '../core/math.js';

/** Antigen stud counts. This is the tell the player has to read. */
const ABO_STUDS = { O: 0, A: 4, B: 8, AB: 12 };
export const ABO_TYPES = ['O', 'A', 'B', 'AB'];
/** Which donor groups are a reaction for a given client group. */
export const ABO_INCOMPATIBLE = {
  O: ['A', 'B', 'AB'],
  A: ['B', 'AB'],
  B: ['A', 'AB'],
  AB: []
};

export const ENEMIES = {

  /* ------------------------------------------------------------------ */
  /* the client's own tissue                                             */
  /* ------------------------------------------------------------------ */

  host: {
    id: 'host', kind: 'healthy',
    name: 'Host cell', short: 'HOST', desc: 'The client. Do not invoice yourself.',
    idName: 'HOST CELL', idSub: 'PROTECT', idCol: '#7fdcff',
    dress(e, sig) {
      e.hue = wrapHue(sig.hue + rr(-3.5, 3.5));
      e.sat = clamp(sig.sat + rr(-4, 4), 30, 96);
      e.lit = clamp(sig.lit + rr(-3, 3), 34, 78);
      e.r = sig.r * rr(0.9, 1.1);
      e.lobes = sig.lobes;
      e.lobeAmp = sig.lobeAmp * rr(0.9, 1.12);
      e.nuc = sig.nuc;
    },
    components: {
      motion: { kind: 'drift', force: 26 },
      property: {},
      converts: { into: 'corrupted' }
    }
  },

  /* ------------------------------------------------------------------ */
  /* pathogens                                                           */
  /* ------------------------------------------------------------------ */

  influenza: {
    id: 'influenza', kind: 'pathogen',
    name: 'Influenza-type', short: 'INFLUENZA',
    desc: 'Spiked sphere. Hangs still, then darts in short bursts.',
    idName: 'PATHOGEN', idSub: 'INFLUENZA', idCol: '#ff5a72',
    dress(e, sig, dev) {
      e.spikes = ri(11, 16);
      e.spikeLen = 0.16 + 0.40 * dev;
      e.spikeTip = true;
      e.hue = wrapHue(sig.hue + sgn() * (16 + 52 * dev));
      e.sat = clamp(sig.sat + 12 * dev, 40, 96);
      e.lit = clamp(sig.lit - 4, 36, 74);
      e.r = sig.r * rr(0.82, 1.0);
      e.lobes = sig.lobes;
      e.lobeAmp = sig.lobeAmp * 0.6;
      e.nuc = 'ring';
    },
    components: {
      motion: { kind: 'dart', force: 235 },
      hostile: {},
      bounty: { kind: 'kill' },
      infects: {},
      chemotaxis: {}
    }
  },

  ecoli: {
    id: 'ecoli', kind: 'pathogen',
    name: 'E. coli-type', short: 'E. COLI',
    desc: 'Rod body with whipping flagella. Hunts healthy cells.',
    idName: 'PATHOGEN', idSub: 'E. COLI', idCol: '#ff5a72',
    dress(e, sig, dev) {
      e.elong = 1.30 + 0.95 * dev;
      e.flag = 3;
      e.spikes = 0;
      e.hue = wrapHue(sig.hue - sgn() * (14 + 46 * dev));
      e.sat = clamp(sig.sat - 6, 34, 92);
      e.lit = clamp(sig.lit + 2, 38, 76);
      e.r = sig.r * rr(0.74, 0.92);
      e.lobes = 0; e.lobeAmp = 0.02;
      e.nuc = 'none';
    },
    components: {
      motion: { kind: 'seek', force: 78 },
      hostile: {},
      bounty: { kind: 'kill' },
      infects: {},
      chemotaxis: {}
    }
  },

  spirochete: {
    id: 'spirochete', kind: 'pathogen',
    name: 'Spirochete-type', short: 'SPIROCHETE',
    desc: 'Long corkscrew filament. Swims fast in a rolling wave.',
    idName: 'PATHOGEN', idSub: 'SPIROCHETE', idCol: '#ff5a72',
    dress(e, sig, dev) {
      e.coil = true;
      e.elong = 1;
      e.spikes = 0;
      e.hue = wrapHue(sig.hue + sgn() * (18 + 44 * dev));
      e.sat = clamp(sig.sat + 6, 40, 96);
      e.lit = clamp(sig.lit + 6, 40, 80);
      e.r = sig.r * rr(0.42, 0.55);
      e.segs = 9;
      e.wave = 0.5 + 0.7 * dev;
      e.nuc = 'none';
    },
    components: {
      motion: { kind: 'wiggle', force: 96, speed: 190 },
      hostile: {},
      bounty: { kind: 'kill' },
      infects: {},
      chemotaxis: {}
    }
  },

  mimic: {
    id: 'mimic', kind: 'pathogen',
    name: 'Mimetic strain', short: 'MIMIC',
    desc: 'Wears the client signature. Only hue drift and a nervous tremor betray it.',
    idName: 'PATHOGEN', idSub: 'MIMIC', idCol: '#ff5a72',
    dress(e, sig, dev) {
      e.hue = wrapHue(sig.hue + sgn() * (9 + 16 * dev));
      e.sat = clamp(sig.sat + 6, 40, 96);
      e.lit = clamp(sig.lit - 3, 36, 74);
      e.r = sig.r * rr(0.9, 1.08);
      e.lobes = sig.lobes;
      e.lobeAmp = sig.lobeAmp * 1.25;
      e.deform = 0.05 + 0.05 * dev;
      e.spikes = 5; e.spikeLen = 0.05 + 0.06 * dev; e.spikeTip = false;
      e.nuc = sig.nuc;
      e.tremor = 1;
    },
    components: {
      motion: { kind: 'drift', force: 26 },
      hostile: {},
      bounty: { kind: 'kill' },
      infects: {},
      chemotaxis: {}
    }
  },

  corrupted: {
    id: 'corrupted', kind: 'pathogen',
    name: 'Corrupted host cell', short: 'CORRUPTED',
    desc: 'A client cell that lost. It bleeds integrity every second it lives.',
    idName: 'CORRUPTED', idSub: 'BLEEDING', idCol: '#5cff8a',
    dress(e, sig) {
      e.spikes = ri(8, 12);
      e.spikeLen = 0.24;
      e.spikeTip = true;
      e.hue = wrapHue(sig.hue + 150);
      e.sat = 72; e.lit = 52;
      e.deform = 0.12;
      e.nuc = 'crescent';
    },
    components: {
      motion: { kind: 'seek', force: 78 },
      hostile: {},
      bounty: { kind: 'quarantine' },
      bleeds: { rate: 0.34 },
      chemotaxis: { after: 6 }
    }
  },

  /* ------------------------------------------------------------------ */
  /* paying tenants                                                      */
  /* ------------------------------------------------------------------ */

  lacto: {
    id: 'lacto', kind: 'symbiote',
    name: 'Lactobacillus colony', short: 'LACTO',
    desc: 'Resident flora. Under contract. With counsel.',
    idName: 'SYMBIOTE', idSub: 'ALLY', idCol: '#57f2a7',
    dress(e, sig) {
      e.hue = wrapHue(sig.hue + 150 + rr(-16, 16));
      e.sat = 66; e.lit = 62;
      e.r = sig.r * rr(0.95, 1.15) * 0.85;
      e.halo = 1;
      e.elong = 1.65;
      e.nuc = 'none'; e.lobes = 0; e.lobeAmp = 0.03;
    },
    components: {
      motion: { kind: 'orbit' },
      litigious: {},
      guest: { lifespan: 42 }
    }
  },

  bacter: {
    id: 'bacter', kind: 'symbiote',
    name: 'Bacteroid symbiote', short: 'BACTEROID',
    desc: 'Resident flora. Under contract. With counsel.',
    idName: 'SYMBIOTE', idSub: 'ALLY', idCol: '#57f2a7',
    dress(e, sig) {
      e.hue = wrapHue(sig.hue + 150 + rr(-16, 16));
      e.sat = 66; e.lit = 62;
      e.r = sig.r * rr(0.95, 1.15) * 1.05;
      e.halo = 1;
      e.nuc = 'trio'; e.lobes = 6; e.lobeAmp = 0.06;
    },
    components: {
      motion: { kind: 'orbit' },
      litigious: {},
      guest: { lifespan: 42 }
    }
  },

  /* ------------------------------------------------------------------ */
  /* the transfusion ward                                                */
  /* ------------------------------------------------------------------ */

  host_rbc: {
    id: 'host_rbc', kind: 'healthy',
    name: 'Client red cell', short: 'CLIENT RBC',
    desc: 'The client\u2019s own red cells. Count the antigen studs before you fire.',
    idName: 'RED CELL', idSub: 'CLIENT', idCol: '#7fdcff',
    dress(e, sig, dev, o) {
      const abo = (o?.abo) || 'O';
      e.hue = wrapHue(sig.hue + rr(-3, 3));
      e.sat = clamp(sig.sat + rr(-3, 3), 34, 92);
      e.lit = clamp(sig.lit + rr(-2, 2), 36, 74);
      e.r = sig.r * rr(0.86, 0.98);
      e.lobes = 0;
      e.lobeAmp = 0.16;          // the biconcave dimple
      e.nuc = 'none';
      e.spikes = ABO_STUDS[abo] || 0;
      e.spikeLen = 0.11;
      e.spikeTip = true;
      e.idSub = 'TYPE ' + abo + ' \u00b7 CLIENT';
    },
    components: {
      motion: { kind: 'drift', force: 22 },
      property: {},
      bloodSignature: { foreign: false }
    }
  },

  donor_rbc: {
    id: 'donor_rbc', kind: 'pathogen',
    name: 'Mismatched donor cell', short: 'DONOR RBC',
    desc: 'Wrong-group red cells from the transfusion. They clot, and the clot kills.',
    idName: 'DONOR CELL', idSub: 'WRONG GROUP', idCol: '#ff8f4a',
    dress(e, sig, dev, o) {
      const abo = (o?.donorAbo) || 'A';
      e.hue = wrapHue(sig.hue + sgn() * (4 + 10 * dev));
      e.sat = clamp(sig.sat + 4, 34, 94);
      e.lit = clamp(sig.lit - 4, 32, 72);
      e.r = sig.r * rr(0.84, 0.96);
      e.lobes = 0;
      e.lobeAmp = 0.14;
      e.nuc = 'none';
      e.spikes = ABO_STUDS[abo] || 4;
      e.spikeLen = 0.12;
      e.spikeTip = true;
      e.idSub = 'TYPE ' + abo + ' \u00b7 DONOR';
    },
    components: {
      motion: { kind: 'clump', force: 24 },
      hostile: {},
      bounty: { kind: 'kill', mult: 0.75 },
      bloodSignature: { foreign: true },
      agglutinate: {}
    }
  }
};

/** Look up an archetype, with a safe fallback so bad data cannot brick a dive. */
export function archetype(id) {
  return ENEMIES[id] || ENEMIES.host;
}

/** A random symbiote archetype id. */
export function anySymbiote() {
  return pick(['lacto', 'bacter']);
}
