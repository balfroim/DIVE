import type { Entity, DressOpts } from '../entities/cell';
import type { MicrobeBlueprint } from '../entities/microbes/blueprint';
import type { Signature } from './Signature';

export class MicrobeBuilder<E extends Entity = Entity> {

  microbe: Partial<MicrobeBlueprint<E>> = {};

  public setKind(kind: string): this {
    this.microbe.kind = kind;
    return this;
  }

  public setName(name: string): this {
    this.microbe.name = name;
    return this;
  }

  public setShort(short: string): this {
    this.microbe.short = short;
    return this;
  }

  public setDesc(desc: string): this {
    this.microbe.desc = desc;
    return this;
  }

  public setIdName(idName: string): this {
    this.microbe.idName = idName;
    return this;
  }

  public setIdSub(idSub: string): this {
    this.microbe.idSub = idSub;
    return this;
  }

  public setIdCol(idCol: string): this {
    this.microbe.idCol = idCol;
    return this;
  }

  public setComponents(components: string[] | Record<string, Record<string, unknown>>): this {
    this.microbe.components = components;
    return this;
  }


  public setOnDress(dress: (e: E, sig: Signature, dev: number, o: DressOpts) => void): this {
    this.microbe.onDress = dress;
    return this;
  }

  public build(): MicrobeBlueprint<E> {
    return this.microbe as MicrobeBlueprint<E>;
  }
}
