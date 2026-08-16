import { SYSTEMS, type System } from '../systems/systems.js';
import { World } from '../ecs/world.js';

/** For tests and hot reloading. */
export function clearSystems() { SYSTEMS.clear(); }

/** 
 * Run all the systems for the current frame.
 * @param deltaTime - The time elapsed since the last frame, in seconds.
 * @param ctx - The context object passed to each system.
 */
export function runSystems(deltaTime: number, ctx: any) {
  SYSTEMS.forEach(sys => {
    if (!sys) return;
    sys.pre?.(deltaTime, ctx);
    runEach(sys, deltaTime, ctx);
    sys.run?.(deltaTime, ctx);
    sys.post?.(deltaTime, ctx);
  });
}
function runEach(sys: System, deltaTime: number, ctx: any) {
  const { each } = sys;
  if (!each) return;
  const requirements = sys.require ?? [];
  World.applyToEntitiesWith(requirements, (e, c) => {
    each(e, deltaTime, ctx, c);
  });
}

