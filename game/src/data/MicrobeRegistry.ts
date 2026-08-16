import type { MicrobeBlueprint } from '../entities/microbes/blueprint';
import type { Entity } from '../entities/cell';

export class MicrobeRegistry<E extends Entity = Entity> {
  private microbes: Record<string, MicrobeBlueprint<E>> = {};

  public register(id: string, archetype: MicrobeBlueprint<E>) {
    this.microbes[id] = archetype;
  }

  public get(id: string): MicrobeBlueprint<E> {
    const archetype: MicrobeBlueprint<E> | undefined = this.microbes[id];
    if (!archetype) {
      throw new Error(`Microbe with id "${id}" not found.`);
    }
    return archetype;
  }

  public getAll(): Record<string, MicrobeBlueprint<E>> {
    return this.microbes;
  }
}
