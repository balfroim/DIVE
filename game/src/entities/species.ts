import { rr, ri, pick } from '../core/math.js';
import type { Signature } from '../data/Signature.js';
export const NUCLEI = ['dot', 'trio', 'ring', 'crescent'];
export const NUCNAME: Record<string, string> = { 'dot': 'MONO-NUCLEUS', 'trio': 'TRI-NUCLEUS', 'ring': 'RING-NUCLEUS', 'crescent': 'CRESCENT', 'none': 'ANUCLEATE' };
export const SITES = ['femoral artery', 'pulmonary vein', 'hepatic portal', 'carotid branch', 'renal capillary', 'aortic arch', 'splenic sinus'];


// FIXME: wtf is this method
export function makeSignature(): Signature {
  const lobes: string = pick(["0", "3", "4", "5", "6"]) as string;
  let sig = {
    hue: ri(150, 350),
    sat: ri(62, 86),
    lit: ri(56, 68),
    r: rr(21, 27),
    lobes: Number.parseInt(lobes, 10),
    lobeAmp: lobes === "0" ? 0.022 : rr(0.075, 0.135),
    nuc: pick(NUCLEI),
    patient: 'CLIENT #' + pick('ABCDEFHJKLMNPRSTVX') + '-' + ri(1000, 9999),
    site: pick(SITES),
    desc: '',
    short: ''
  };
  const nuc: string = sig.nuc as string;
  const nucname: string = NUCNAME[nuc] ?? 'MONO-NUCLEUS'; // FIXME: wtf
  const lobename: string = sig.lobes ? sig.lobes + '-LOBE' : 'SMOOTH';
  sig.desc = `HUE ${sig.hue.toString()}° · ${lobename} · ${nucname}`;
  sig.short = `H${sig.hue} · ${lobes ? lobes + 'L' : 'SM'} · ${nucname.split('-')[0].slice(0, 4)}`;
  return sig;
}
