import { rr } from '../core/math.js';
import type { Entity } from '../entities/cell.js';

/** A component is a named bundle of data that can be attached to an entity. */
interface BaseComponent {}


interface Spec<T extends BaseComponent = BaseComponent, E extends Entity = Entity> {
  defaults(): T;
  apply?: ((e: E, c: T, ctx: unknown) => void) | null;
}

class ComponentRegistry {
  private readonly components: Record<string, Spec<BaseComponent, Entity>> = Object.create(null) as Record<string, Spec<BaseComponent, Entity>>;

  register<T extends BaseComponent, E extends Entity = Entity>(name: string, c: Spec<T, E>): void {
    this.components[name] = c as unknown as Spec<BaseComponent, Entity>;
  }

  get<T extends BaseComponent, E extends Entity = Entity>(name: string): Spec<T, E> | undefined {
    return this.components[name] as Spec<T, E> | undefined;
  }
}
export const COMPONENTS = new ComponentRegistry();

/** Attach a component instance to an entity, merging over its defaults. */
export function attach<T extends BaseComponent = BaseComponent, E extends Entity = Entity>(
  e: E,
  name: string,
  data?: Partial<T>,
  ctx?: unknown,
): T {
  const spec = COMPONENTS.get<T, E>(name);
  if (!spec) {
    throw new Error(`Component "${name}" not registered`);
  }
  const c = { ...spec?.defaults(), ...data } as T;
  e.comp[name] = c;
  spec?.apply?.(e, c, ctx ?? null);
  return c;
}

interface PlayerControlComponent extends BaseComponent {
  // TODO
}

COMPONENTS.register('playerControl', {
  defaults(): PlayerControlComponent {
    return {};
  }
});

interface EscortComponent extends BaseComponent {
  // TODO
}

COMPONENTS.register('escort', {
  defaults(): EscortComponent {
    return {};
  }
});

/**
 * FIXME: Every pooled cell carries this. It is what separates "a thing in the
 * bloodstream" from an actor (the diver, the escort), so a system can ask for
 * cells without accidentally integrating the player twice.
 */
interface CellComponent extends BaseComponent {
  // TODO
}
COMPONENTS.register('cell', {
  defaults(): CellComponent {
    return {};
  }
});


// COMPONENTS.register('microbe', { defaults: {}, apply: null });

/**
 * Steering. `kind` selects which branch of the motion system drives it.
 * drift  aimless wander        dart   still, then bursts
 * seek   hunts host cells      wiggle corkscrew swimmer
 * orbit  circles a home point  clump  crawls toward its own kind
 */
interface MotionComponent extends BaseComponent {
  kind: string;
  force: number;
  speed: number;
  turn: number;
  jitter: number;
}
interface MotionEntity extends Entity {
  motion: string;
  mt: number;
}
COMPONENTS.register('motion', {
  defaults(): MotionComponent {
    return { kind: 'drift', force: 26, speed: 165, turn: 1, jitter: 0 };
  },
  apply(e: MotionEntity, c: MotionComponent) {
    e.motion = c.kind;
    e.mt = rr(0.3, 2.2);
  }
});

interface HostileComponent extends BaseComponent {
  weight: number;
}
COMPONENTS.register('hostile', {
  defaults(): HostileComponent {
    return { weight: 1 };
  }
});


interface BountyComponent extends BaseComponent {
  kind: string;
  mult: number;
}
COMPONENTS.register('bounty', {
  defaults(): BountyComponent {
    return { kind: 'kill', mult: 1 };
  }
});


interface PropertyComponent extends BaseComponent {
  fine: string;
  integrity: string;
  label: string;
}
COMPONENTS.register('property', {
  defaults(): PropertyComponent {
    return { fine: 'deductHost', integrity: 'healthy', label: 'CLIENT PROPERTY' };
  }
});


interface LitigiousComponent extends BaseComponent {
  fine: string;
  integrity: string;
  label: string;
}
COMPONENTS.register('litigious', {
  defaults(): LitigiousComponent {
    return { fine: 'deductSym', integrity: 'symbiote', label: 'LITIGATION' };
  }
});

interface InfectsComponent extends BaseComponent {
  rate: number;
  scale: number;
  cd: number;
}
COMPONENTS.register('infects', {
  defaults(): InfectsComponent {
    return { rate: 0.30, scale: 0.042, cd: 9 };
  }
});

interface ConvertsComponent extends BaseComponent {
  into: string;
}
COMPONENTS.register('converts', {
  defaults(): ConvertsComponent {
    return { into: 'corrupted' };
  }
});

interface GuestComponent extends BaseComponent {
  lifespan: number;
  far: number;
}
// FIXME: seems like the apply method smell like requirements of other components
interface GuestEntity extends Entity {
  lifespan: number;
}
COMPONENTS.register('guest', {
  defaults(): GuestComponent {
    return { lifespan: 40, far: 1100 };
  },
  apply(e: GuestEntity, c: GuestComponent) { e.lifespan = c.lifespan * rr(0.85, 1.2); }
});

interface BleedsComponent extends BaseComponent {
  rate: number;
  needsClump: boolean;
}
COMPONENTS.register('bleeds', {
  defaults(): BleedsComponent {
    return { rate: 0.34, needsClump: false };
  }
});

interface AgglutinateComponent extends BaseComponent {
  r: number;
  pull: number;
  bleed: number;
  min: number;
  clumpN: number;
}
COMPONENTS.register('agglutinate', {
  defaults(): AgglutinateComponent {
    return { r: 92, pull: 130, bleed: 0.16, min: 2, clumpN: 0 };
  }
});

interface BloodSignatureComponent extends BaseComponent {
  abo: string;
  foreign: boolean;
}
COMPONENTS.register('bloodSignature', {
  defaults(): BloodSignatureComponent {
    return { abo: 'O', foreign: false };
  },
  apply: null
});
// FIXME duplicates ?
COMPONENTS.register('bloodtype', {
  defaults(): BloodSignatureComponent {
    return { abo: 'O', foreign: false };
  },
  apply: null
});


