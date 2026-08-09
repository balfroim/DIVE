/**
 * The ECS world.
 *
 * ENTITY   a flat struct (see `blankEnt`) that is allocated once and recycled
 *          forever. Flat, because the renderer and the physics touch these
 *          fields every frame and we refuse to allocate during a dive.
 * COMPONENT a small named record hung off `e.comp` that says what an entity
 *          *is* and what may be done to it. Components carry data only.
 * SYSTEM   a function that runs once per frame over every entity carrying a
 *          given set of components (see ecs/systems.js).
 *
 * Two kinds of entity live here:
 *   - pooled cells   (`World.pool`)   - spawned and despawned constantly
 *   - actors         (`World.actors`) - the diver and the escort, always live
 * Both go in `World.entities`, so a system written against a component set
 * automatically applies to whichever of them carries it.
 *
 * @module ecs/world
 */

/** Every entity a system may ever see: pooled cells first, then actors. */
export const World = {
  /** Recyclable cell structs. */
  pool: [],
  /** Permanent singletons (diver, escort). */
  actors: [],
  /** pool + actors. Systems iterate this. */
  entities: [],

  /** Install the recycled cell pool. Called once, from entities/pool.js. */
  usePool(list) {
    this.pool = list;
    this.rebuild();
  },

  /** Register a permanent actor (the diver, the escort). */
  addActor(e) {
    if (this.actors.indexOf(e) < 0) this.actors.push(e);
    this.rebuild();
    return e;
  },

  rebuild() {
    this.entities = this.pool.concat(this.actors);
  },

  /** Iterate every live entity carrying `name`. */
  each(name, fn) {
    const list = this.entities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.on) continue;
      const c = e.comp[name];
      if (c) fn(e, c);
    }
  },

  /** Count live entities matching a predicate. */
  count(fn) {
    let n = 0;
    const list = this.entities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.on && !e.dying && fn(e)) n++;
    }
    return n;
  },

  /** Count live entities carrying a component. */
  countWith(name, fn) {
    let n = 0;
    const list = this.entities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.on && !e.dying && e.comp[name] && (!fn || fn(e, e.comp[name]))) n++;
    }
    return n;
  }
};

/** Does this entity carry the component? */
export function has(e, name) {
  return !!(e && e.comp && e.comp[name]);
}
