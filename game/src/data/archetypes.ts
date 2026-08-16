import type { Entity } from '../entities/cell';
import { rr, ri, pick, sgn, clamp, wrapHue } from '../core/math.js';
import { MicrobeRegistry } from './MicrobeRegistry.js';
import { MicrobeBuilder } from './MicrobeBuilder.js';

/** Antigen stud counts. This is the tell the player has to read. */
const ABO_STUDS: Record<string, number> = { O: 0, A: 4, B: 8, AB: 12 };
export const ABO_TYPES = ['O', 'A', 'B', 'AB'];
/** Which donor groups are a reaction for a given client group. */
export const ABO_INCOMPATIBLE = {
  O: ['A', 'B', 'AB'],
  A: ['B', 'AB'],
  B: ['A', 'AB'],
  AB: []
};
 
export const ARCHETYPES = new MicrobeRegistry<Entity>();

interface Colored {
  hue: number;
  sat: number;
  lit: number;
}
interface Spiky {
  spikes: number,
  spikeLen: number,
  spikeTip: boolean
}
interface Lobed {
  lobes: number;
  lobeAmp: number;
}
interface Elongated {
  elongation: number;
}
interface Deformated {
  deform: number;
  tremor: number;
}
interface Haloed {
  halo: number;
}

interface Cell extends Entity, Colored, Lobed {}
ARCHETYPES.register('host', new MicrobeBuilder<Cell>()
  .setKind('healthy')
  .setName('Host cell')
  .setShort('HOST')
  .setDesc('Client property: DO NOT KILL.')
  .setIdName('HOST CELL')
  .setIdSub('PROTECT')
  .setIdCol('#7fdcff')
  .setOnDress((e, sig) => {
    e.hue = wrapHue(sig.hue + rr(-3.5, 3.5));
    e.sat = clamp(sig.sat + rr(-4, 4), 30, 96);
    e.lit = clamp(sig.lit + rr(-3, 3), 34, 78);
    e.r = sig.r * rr(0.9, 1.1);
    e.lobes = sig.lobes;
    e.lobeAmp = sig.lobeAmp * rr(0.9, 1.12);
    e.nucleus = sig.nuc;
  })
  .setComponents({
    cell: {},
    motion: { kind: 'drift', force: 26 },
    property: {},
    converts: { into: 'corrupted' }
  })
  .build()
);

interface Influenza extends Entity, Spiky, Colored, Lobed, Deformated {}
ARCHETYPES.register('influenza', new MicrobeBuilder<Influenza>()
  .setKind('pathogen')
  .setName('Influenza-type')
  .setShort('INFLUENZA')
  .setDesc('Lurks then darts in short bursts. Usual suspect of runny nose: LICENSE TO KILL')
  .setIdName('PATHOGEN')
  .setIdSub('INFLUENZA')
  .setIdCol('#ff5a72')
  .setOnDress((e, sig, dev) => {
    e.spikes = ri(11, 16);
    e.spikeLen = 0.16 + 0.40 * dev;
    e.spikeTip = true;
    e.hue = wrapHue(sig.hue + sgn() * (16 + 52 * dev));
    e.sat = clamp(sig.sat + 12 * dev, 40, 96);
    e.lit = clamp(sig.lit - 4, 36, 74);
    e.r = sig.r * rr(0.82, 1.0);
    e.lobes = sig.lobes;
    e.lobeAmp = sig.lobeAmp * 0.6;
    e.nucleus = 'ring';
  })
  .setComponents({
    motion: { kind: 'dart', force: 235 },
    hostile: {},
    bounty: { kind: 'kill' },
    infects: {}
  })
  .build()
);

interface Ecoli extends Entity, Colored, Lobed, Elongated {
  flag: number;
}
ARCHETYPES.register('ecoli', new MicrobeBuilder<Ecoli>()
  .setKind('pathogen')
  .setName('E. coli-type')
  .setShort('E. COLI')
  .setDesc('Usually harmless, but some strains are deadly. A rod-shaped bacterium with a flagellum for swimming. LICENSE TO KILL.')
  .setIdName('PATHOGEN')
  .setIdSub('E. COLI')
  .setIdCol('#ff5a72')
  .setOnDress((e, sig, dev) => {
    e.elongation = 1.30 + 0.95 * dev;
    e.flag = 3;
    e.hue = wrapHue(sig.hue - sgn() * (14 + 46 * dev));
    e.sat = clamp(sig.sat - 6, 34, 92);
    e.lit = clamp(sig.lit + 2, 38, 76);
    e.r = sig.r * rr(0.74, 0.92);
    e.lobes = 0; e.lobeAmp = 0.02;
    e.nucleus = 'none';
  })
  .setComponents({
    motion: { kind: 'seek', force: 78 },
    hostile: {},
    bounty: { kind: 'kill' },
    infects: {}
  })
  .build()
);

interface Spirochete extends Entity, Colored, Elongated {
  coil: boolean;
  wave: number;
  segs: number;
}
ARCHETYPES.register('spirochete', new MicrobeBuilder<Spirochete>()
  .setKind('pathogen')
  .setName('Spirochete-type')
  .setShort('SPIROCHETE')
  .setDesc('Swims fast in a rolling wave. LICENSE TO KILL.')
  .setIdName('PATHOGEN')
  .setIdSub('SPIROCHETE')
  .setIdCol('#ff5a72')
  .setOnDress((e, sig, dev) => {
    e.coil = true;
    e.elongation = 1;
    e.hue = wrapHue(sig.hue + sgn() * (18 + 44 * dev));
    e.sat = clamp(sig.sat + 6, 40, 96);
    e.lit = clamp(sig.lit + 6, 40, 80);
    e.r = sig.r * rr(0.42, 0.55);
    e.segs = 9;
    e.wave = 0.5 + 0.7 * dev;
    e.nucleus = 'none';
  })
  .setComponents({
    motion: { kind: 'wiggle', force: 96, speed: 190 },
    hostile: {},
    bounty: { kind: 'kill' },
    infects: {},
  })
  .build()
);

interface Mimic extends Cell, Spiky, Deformated {}
ARCHETYPES.register('mimic', new MicrobeBuilder<Mimic>()
  .setKind('pathogen')
  .setName('Mimetic strain')
  .setShort('MIMIC')
  .setDesc('Camouflages itself to look like a client cell. LICENSE TO KILL.')
  .setIdName('PATHOGEN')
  .setIdSub('MIMIC')
  .setIdCol('#ff5a72')
  .setOnDress((e, sig, dev) => {
    e.hue = wrapHue(sig.hue + sgn() * (9 + 16 * dev));
    e.sat = clamp(sig.sat + 6, 40, 96);
    e.lit = clamp(sig.lit - 3, 36, 74);
    e.r = sig.r * rr(0.9, 1.08);
    e.lobes = sig.lobes;
    e.lobeAmp = sig.lobeAmp * 1.25;
    e.deform = 0.05 + 0.05 * dev;
    e.spikes = 5; 
    e.spikeLen = 0.05 + 0.06 * dev; 
    e.spikeTip = false;
    e.nucleus = sig.nuc;
    e.tremor = 1;
  })
  .setComponents({
    motion: { kind: 'drift', force: 26 },
    hostile: {},
    bounty: { kind: 'kill' },
    infects: {}
  })
  .build()
);

interface Corrupted extends Cell, Spiky, Deformated {}
ARCHETYPES.register('corrupted', new MicrobeBuilder<Corrupted>()
  .setKind('pathogen')
  .setName('Corrupted host cell')
  .setShort('CORRUPTED')
  .setDesc('A client cell that lost. It bleeds integrity every second it lives.')
  .setIdName('CORRUPTED')
  .setIdSub('BLEEDING')
  .setIdCol('#5cff8a')
  .setOnDress((e, sig) => {
    e.spikes = ri(8, 12);
    e.spikeLen = 0.24;
    e.spikeTip = true;
    e.hue = wrapHue(sig.hue + 150);
    e.sat = 72; e.lit = 52;
    e.deform = 0.12;
    e.nucleus = 'crescent';
  })
  .setComponents({
    motion: { kind: 'seek', force: 78 },
    hostile: {},
    bounty: { kind: 'quarantine' },
    bleeds: { rate: 0.34 }
  })
  .build()
);

interface Lacto extends Entity, Colored, Lobed, Elongated {}
ARCHETYPES.register('lacto', new MicrobeBuilder<Lacto>()
  .setKind('symbiote')
  .setName('Lactobacillus colony')
  .setShort('LACTO')
  .setDesc('Symbiote')
  .setIdName('Nice fellow. DO NOT KILL.')
  .setIdSub('ALLY')
  .setIdCol('#57f2a7')
  .setOnDress((e, sig) => {
    e.hue = wrapHue(sig.hue + 150 + rr(-16, 16));
    e.sat = 66; e.lit = 62;
    e.r = sig.r * rr(0.95, 1.15) * 0.85;
    e.elongation = 1.65;
    e.nucleus = 'none'; e.lobes = 0; e.lobeAmp = 0.03;
  })
  .setComponents({
    motion: { kind: 'orbit' },
    litigious: {},
    guest: { lifespan: 42 }
  })
  .build()
);
  
interface Bacteroid extends Entity, Colored, Lobed {}
ARCHETYPES.register('bacter', new MicrobeBuilder<Bacteroid>()
  .setKind('symbiote')
  .setName('Bacteroid symbiote')
  .setShort('BACTEROID')
  .setDesc('Resident flora. Under contract. With counsel.')
  .setIdName('SYMBIOTE')
  .setIdSub('ALLY')
  .setIdCol('#57f2a7')
  .setOnDress((e, sig) => {
    e.hue = wrapHue(sig.hue + 150 + rr(-16, 16));
    e.sat = 66; 
    e.lit = 62;
    e.r = sig.r * rr(0.95, 1.15) * 1.05;
    e.nucleus = 'trio'; 
    e.lobes = 6; 
    e.lobeAmp = 0.06;
  })
  .setComponents({
    motion: { kind: 'orbit' },
    litigious: {},
    guest: { lifespan: 42 }
  })
  .build()
);

interface Bloody {
  idSub: string;
}
interface HostRBC extends Entity, Colored, Lobed, Spiky, Bloody {}
ARCHETYPES.register('host_rbc', new MicrobeBuilder<HostRBC>()
  .setKind('healthy')
  .setName('Client red cell')
  .setShort('CLIENT RBC')
  .setDesc('The client\u2019s own red cells. Count the antigen studs before you fire. DO NOT KILL.')
  .setIdName('RED CELL')
  .setIdSub('CLIENT')
  .setIdCol('#7fdcff')
  .setOnDress((e, sig, dev, o) => {
    const abo = o?.abo || 'O';
    e.hue = wrapHue(sig.hue + rr(-3, 3));
    e.sat = clamp(sig.sat + rr(-3, 3), 34, 92);
    e.lit = clamp(sig.lit + rr(-2, 2), 36, 74);
    e.r = sig.r * rr(0.86, 0.98);
    e.lobes = 0;
    e.lobeAmp = 0.16;          
    e.nucleus = 'none';
    e.spikes = ABO_STUDS[abo] || 0;
    e.spikeLen = 0.11;
    e.spikeTip = true;
    e.idSub = 'TYPE ' + abo + ' \u00b7 CLIENT';
  })
  .setComponents({
    motion: { kind: 'drift', force: 22 },
    property: {},
    bloodSignature: { foreign: false }
  })
  .build()
);


interface DonorRBC extends Entity, Colored, Lobed, Spiky, Bloody {}
ARCHETYPES.register('donor_rbc', new MicrobeBuilder<DonorRBC>()
  .setKind('pathogen')
  .setName('Mismatched donor cell')
  .setShort('DONOR RBC')
  .setDesc('Wrong-group red cells from the transfusion. They clot, and the clot kills.')
  .setIdName('DONOR CELL')
  .setIdSub('WRONG GROUP')
  .setIdCol('#ff8f4a')
  .setOnDress((e, sig, dev, o) => {
    const abo = o?.donorAbo || 'A';
    e.hue = wrapHue(sig.hue + sgn() * (4 + 10 * dev));
    e.sat = clamp(sig.sat + 4, 34, 94);
    e.lit = clamp(sig.lit - 4, 32, 72);
    e.r = sig.r * rr(0.84, 0.96);
    e.lobes = 0;
    e.lobeAmp = 0.14;
    e.nucleus = 'none';
    e.spikes = ABO_STUDS[abo] || 4;
    e.spikeLen = 0.12;
    e.spikeTip = true;
    e.idSub = 'TYPE ' + abo + ' \u00b7 DONOR';
  })
  .setComponents({
    motion: { kind: 'clump', force: 24 },
    hostile: {},
    bounty: { kind: 'kill', mult: 0.75 },
    bloodSignature: { foreign: true },
    agglutinate: {}
  })
  .build()
);



/** A random symbiote archetype id. */
export function anySymbiote() {
  return pick(['lacto', 'bacter']);
}
