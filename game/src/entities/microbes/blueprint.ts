import type { Signature } from '../../data/Signature';
import type { EntityKind, Entity, DressOpts } from '../cell';


export interface MicrobeBlueprint<E extends Entity = Entity> {
  kind: EntityKind;
  name: string;
  short: string;
  desc: string;
  idName: string;
  idSub: string;
  idCol: string;
  components: string[] | Record<string, Record<string, unknown>>;
  comps: string[] | Record<string, Record<string, unknown>>;
  onDress: (e: E, sig: Signature, dev: number, o: DressOpts) => void;
}
