/**
 * The entity pool.
 * This is a fixed-size array of entities that are reused to avoid garbage collector churn.
 */

import { CFG } from '../core/config.js';
import { World } from '../ecs/world.js';
import { blankEnt, type Entity } from './cell.js';


/**
 * A high-performance object pool by @ocyrusjs/pool.
 * Reduces Garbage Collection (GC) pressure by recycling long-lived objects.
 */
export class Pool<T> {
  private readonly pool: T[] = [];
  private readonly factory: () => T;
  private readonly reset?: (obj: T) => void;

  /**
   * @param factory - Function to create a new instance of the pooled object
   * @param reset - Optional function to reset an object before it returns to the pool
   */
  constructor(factory: () => T, reset?: (obj: T) => void) {
    this.factory = factory;
    this.reset = reset ?? (() => {});
  }

  /**
   * Acquire an object from the pool.
   * Creates a new one using the factory if the pool is empty.
   */
  acquire(): T {
    const obj = this.pool.pop();
    return obj ?? this.factory();
  }

  /**
   * Release an object back into the pool for future reuse.
   * Runs the 'reset' function if provided.
   * 
   * @param obj - The object to release
   */
  release(obj: T): void {
    if (this.reset) {
      this.reset(obj);
    }
    this.pool.push(obj);
  }

  /**
   * Current number of objects available for acquisition in the pool.
   */
  get size(): number {
    return this.pool.length;
  }

  /**
   * Removes all objects from the pool to free up memory.
   */
  drain(): void {
    this.pool.length = 0;
  }
}

function resetEntity(e: Entity): void {
  e.on = false;
  for (const name in e.comp) delete e.comp[name];
}

const entityPool = new Pool<Entity>(blankEnt, resetEntity);


const acquired: Entity[] = initPool(entityPool);

console.log(`Entity pool initialized with ${acquired.length} entities.`);
World.usePool(acquired);
/**
 * Pre-warm the pool to CFG.pool.length entities and track them
 * so World.usePool() has direct access to the underlying array.
 * @returns an array of acquired entities from the pool
 */
function initPool(entityPool: Pool<Entity>): Entity[] {
  const acquired: Entity[] = [];
  while (acquired.length < CFG.pool.length) {
    acquired.push(entityPool.acquire());
  }
  // Release them all back immediately so they're available via acquire() later.
  for (const e of acquired) {
    entityPool.release(e);
  }
  return acquired;
}

/**
 * @returns an available entity from the pool, or null if none are available.
 */
export function fetchAvailableEntity(): Entity | null {
  return entityPool.acquire() ?? null;
}

/**
 * Release an entity back to the pool (turns it off and clears components).
 */
export function releaseEntity(e: Entity): void {
  entityPool.release(e);
}

/**
 * Turn off all entities in the pool and clear their components.
 */
export function clearPool(): void {
  for (const e of acquired) {
    resetEntity(e);
  }
}