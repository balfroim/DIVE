/**
 * The entity pool. 
 * This is a fixed-size array of entities that are reused to avoid garbage collector churn.
 */

import { CFG } from '../core/config.js';
import { World } from '../ecs/world.js';
import { blankEnt } from './cell.js';

export const ENTS_POOL = Array.from({ length: CFG.pool.length }, () => blankEnt());
console.log(`Entity pool initialized with ${ENTS_POOL.length} entities.`);
World.usePool(ENTS_POOL);

/**
 * @return {object|null} an available entity from the pool, or null if none are available.
 */
export function fetchAvailableEntity() {
  return ENTS_POOL.find((e) => e.on === false) ?? null;
}

/**
 * Turn off all entities in the pool and clear their components.
 */
export function clearPool() {
  for (const e of ENTS_POOL) {
    e.on = false;
    for (const name in e.comp) delete e.comp[name];
  }
}