import type { Entity } from "../entities/cell";

/** Every entity a system may ever see: pooled cells first, then actors. */
export class EntityManagement {
  /** Recyclable cell structs. */
  private pool: Entity[]
  /** Permanent singletons (diver, escort). */
  private readonly actors: Entity[]
  /** pool + actors. Systems iterate this. */
  private entities: Entity[]

  constructor() {
    this.pool = [];
    this.actors = [];
    this.entities = [];
  }

  /** Install the recycled cell pool. Called once, from entities/pool.js. */
  usePool(pool: Entity[]) {
    this.pool = pool;
    this.rebuild();
  }

  /** Register a permanent actor (the diver, the escort). */
  addActor(e: Entity): Entity {
    if (!this.actors.includes(e)) this.actors.push(e);
    this.rebuild();
    return e;
  }

  rebuild() {
    this.entities = this.pool.concat(this.actors);
  }

  /** Apply to every entity that has a list of components. */
  applyToEntitiesWith(components: string[], fn: (e: Entity, c: any) => void) {
    for (const e of this.entities) {
      if (!e?.on || !e.comp) continue;
      let hasAll = true;
      for (const name of components) {
        if (!e.comp[name]) {
          hasAll = false;
          break;
        }
      }
      if (hasAll) fn(e, e.comp);
    }
  }

  /** Count live entities matching a predicate. */
  count(fn: (e: Entity) => boolean) {
    let n = 0;
    const {entities} = this;
    for (const e of entities) {
      if (e.on && !e.dying && fn(e)) n++;
    }
    return n;
  }

  /** Count live entities carrying a component. */
  countWith(name: string, fn?: (e: Entity, c: any) => boolean) {
    let n = 0;
    const {entities} = this;
    for (const e of entities) {
      if (e.on && !e.dying && e.comp[name] && (!fn || fn(e, e.comp[name]))) n++;
    }
    return n;
  }

  applyToActiveEntities(fn: (e: Entity) => void): void {
    for (const e of this.entities) {
      if (e.on) fn(e);
    }
  }
}

/** Does this entity carry the component? */
export function has(e: Entity, name: string) {
  return !!(e?.comp?.[name]);
}

export const World = new EntityManagement();