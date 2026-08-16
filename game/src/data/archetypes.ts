import { rr, ri, pick, sgn, clamp, wrapHue } from '../core/math.js';
import type { MicrobeBlueprint } from '../entities/microbes/blueprint.js';
import type { DressOpts, Entity, EntityKind } from '../entities/cell.js';
import type { Signature } from './Signature.js';

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

export interface PartialArchetype {
  kind?: EntityKind;
  name?: string;
  short?: string;
  desc?: string;
  idName?: string;
  idSub?: string;
  idCol?: string;
  components?: string[] | Record<string, Record<string, unknown>>;
  comps?: string[] | Record<string, Record<string, unknown>>;
  onDress?: (e: Entity, sig: Signature, dev: number, o: DressOpts) => void;
}
 
export class ArchetypeRegistry {
  private archetypes: Record<string, MicrobeBlueprint> = {};

  public register(id: string, archetype: MicrobeBlueprint) {
    this.archetypes[id] = archetype;
  }

  public get(id: string): MicrobeBlueprint {
    const archetype: MicrobeBlueprint | undefined = this.archetypes[id];
    if (!archetype) {
      throw new Error(`Archetype with id "${id}" not found.`);
    }
    return archetype;
  }

  public getAll(): Record<string, MicrobeBlueprint> {
    return this.archetypes;
  }
}

class ArchetypeBuilder {

  archetype: PartialArchetype = {};

  public setKind(kind: string): this {
    this.archetype.kind = kind;
    return this;
  }

  public setName(name: string): this {
    this.archetype.name = name;
    return this;
  }

  public setShort(short: string): this {
    this.archetype.short = short;
    return this;
  }

  public setDesc(desc: string): this {
    this.archetype.desc = desc;
    return this;
  }

  public setIdName(idName: string): this {
    this.archetype.idName = idName;
    return this;
  }

  public setIdSub(idSub: string): this {
    this.archetype.idSub = idSub;
    return this;
  }

  public setIdCol(idCol: string): this {
    this.archetype.idCol = idCol;
    return this;
  }

  public setComponents(components: string[] | Record<string, Record<string, unknown>>): this {
    this.archetype.components = components;
    return this;  
  }

  public setOnDress(dress: (e: Entity, sig: Signature, dev: number, o: DressOpts) => void): this {
    this.archetype.onDress = dress;
    return this;
  }

  public build(): MicrobeBlueprint {
    return this.archetype as MicrobeBlueprint;
  }
}

export const ARCHETYPES = new ArchetypeRegistry();

ARCHETYPES.register('host', new ArchetypeBuilder()
  .setKind('healthy')
  .setName('Host cell')
  .setShort('HOST')
  .setDesc('The client. Do not invoice yourself.')
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
    e.nuc = sig.nuc;
  })
  .setComponents({
    cell: {}, // FIXME should maybe be setSystems?
    motion: { kind: 'drift', force: 26 },
    property: {},
    converts: { into: 'corrupted' }
  })
  .build()
);

ARCHETYPES.register('influenza', new ArchetypeBuilder()
  .setKind('pathogen')
  .setName('Influenza-type')
  .setShort('INFLUENZA')
  .setDesc('Spiked sphere. Hangs still, then darts in short bursts.')
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
    e.nuc = 'ring';
  })
  .setComponents({
    motion: { kind: 'dart', force: 235 },
    hostile: {},
    bounty: { kind: 'kill' },
    infects: {},
    chemotaxis: {}
  })
  .build()
);

ARCHETYPES.register('ecoli', new ArchetypeBuilder()
  .setKind('pathogen')
  .setName('E. coli-type')
  .setShort('E. COLI')
  .setDesc('Rod body with whipping flagella. Hunts healthy cells.')
  .setIdName('PATHOGEN')
  .setIdSub('E. COLI')
  .setIdCol('#ff5a72')
  .setOnDress((e, sig, dev) => {
    e.elong = 1.30 + 0.95 * dev;
    e.flag = 3;
    e.spikes = 0;
    e.hue = wrapHue(sig.hue - sgn() * (14 + 46 * dev));
    e.sat = clamp(sig.sat - 6, 34, 92);
    e.lit = clamp(sig.lit + 2, 38, 76);
    e.r = sig.r * rr(0.74, 0.92);
    e.lobes = 0; e.lobeAmp = 0.02;
    e.nuc = 'none';
  })
  .setComponents({
    motion: { kind: 'seek', force: 78 },
    hostile: {},
    bounty: { kind: 'kill' },
    infects: {},
    chemotaxis: {}
  })
  .build()
);

ARCHETYPES.register('spirochete', new ArchetypeBuilder()
  .setKind('pathogen')
  .setName('Spirochete-type')
  .setShort('SPIROCHETE')
  .setDesc('Long corkscrew filament. Swims fast in a rolling wave.')
  .setIdName('PATHOGEN')
  .setIdSub('SPIROCHETE')
  .setIdCol('#ff5a72')
  .setOnDress((e, sig, dev) => {
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
  })
  .setComponents({
    motion: { kind: 'wiggle', force: 96, speed: 190 },
    hostile: {},
    bounty: { kind: 'kill' },
    infects: {},
    chemotaxis: {}
  })
  .build()
);

ARCHETYPES.register('mimic', new ArchetypeBuilder()
  .setKind('pathogen')
  .setName('Mimetic strain')
  .setShort('MIMIC')
  .setDesc('Wears the client signature. Only hue drift and a nervous tremor betray it.')
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
    e.spikes = 5; e.spikeLen = 0.05 + 0.06 * dev; e.spikeTip = false;
    e.nuc = sig.nuc;
    e.tremor = 1;
  })
  .setComponents({
    motion: { kind: 'drift', force: 26 },
    hostile: {},
    bounty: { kind: 'kill' },
    infects: {},
    chemotaxis: {}
  })
  .build()
);

ARCHETYPES.register('corrupted', new ArchetypeBuilder()
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
    e.nuc = 'crescent';
  })
  .setComponents({
    motion: { kind: 'seek', force: 78 },
    hostile: {},
    bounty: { kind: 'quarantine' },
    bleeds: { rate: 0.34 },
    chemotaxis: { after: 6 }
  })
  .build()
);

ARCHETYPES.register('lacto', new ArchetypeBuilder()
  .setKind('symbiote')
  .setName('Lactobacillus colony')
  .setShort('LACTO')
  .setDesc('Symbiote')
  .setIdName('SYMBIOTE')
  .setIdSub('ALLY')
  .setIdCol('#57f2a7')
  .setOnDress((e, sig) => {
    e.hue = wrapHue(sig.hue + 150 + rr(-16, 16));
    e.sat = 66; e.lit = 62;
    e.r = sig.r * rr(0.95, 1.15) * 0.85;
    e.halo = 1;
    e.elong = 1.65;
    e.nuc = 'none'; e.lobes = 0; e.lobeAmp = 0.03;
  })
  .setComponents({
    motion: { kind: 'orbit' },
    litigious: {},
    guest: { lifespan: 42 }
  })
  .build()
);
  
ARCHETYPES.register('bacter', new ArchetypeBuilder()
  .setKind('symbiote')
  .setName('Bacteroid symbiote')
  .setShort('BACTEROID')
  .setDesc('Resident flora. Under contract. With counsel.')
  .setIdName('SYMBIOTE')
  .setIdSub('ALLY')
  .setIdCol('#57f2a7')
  .setOnDress((e, sig) => {
    e.hue = wrapHue(sig.hue + 150 + rr(-16, 16));
    e.sat = 66; e.lit = 62;
    e.r = sig.r * rr(0.95, 1.15) * 1.05;
    e.halo = 1;
    e.nuc = 'trio'; e.lobes = 6; e.lobeAmp = 0.06;
  })
  .setComponents({
    motion: { kind: 'orbit' },
    litigious: {},
    guest: { lifespan: 42 }
  })
  .build()
);

ARCHETYPES.register('host_rbc', new ArchetypeBuilder()
  .setKind('healthy')
  .setName('Client red cell')
  .setShort('CLIENT RBC')
  .setDesc('The client\u2019s own red cells. Count the antigen studs before you fire.')
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
    e.lobeAmp = 0.16;          // the biconcave dimple
    e.nuc = 'none';
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

ARCHETYPES.register('donor_rbc', new ArchetypeBuilder()
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
    e.nuc = 'none';
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
