import { SYSTEMS } from '../entities/systems.js';
import { World } from './world.js';



/** For tests and hot reloading. */
export function clearSystems() { SYSTEMS.clear(); }

/** Run one frame of the whole pipeline. */
export function runSystems(dt: number, ctx: any) {
  SYSTEMS.forEach(sys => {
    if (!sys) return;
    sys.pre?.(dt, ctx);
    const {each} = sys;
     if (each) {
      const require = sys.require ?? [];

      World.forEach(e => {
        if (!e?.on || !e.comp) return;

        const {comp} = e;
        for (const name of require) {
          if (!comp[name]) {
            console.warn(`System ${sys.name} requires component ${name}, but entity ${e.uid} does not have it.`);
            return;
          }
        }

        each(e, dt, ctx, comp);
      });
    }
    sys.run?.(dt, ctx);
    sys.post?.(dt, ctx);
  });
}
