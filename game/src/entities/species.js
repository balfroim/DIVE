/**
 * The client's cell signature.
 *
 * Every client's tissue has a look of its own - hue, saturation, lobe count,
 * nucleus shape. Pathogen archetypes in data/enemies.js dress themselves
 * *relative* to this signature, which is why a low-deviation strain is
 * genuinely hard to call: it is wearing the client's own colours.
 *
 * The bestiary itself lives in data/enemies.js. This module only makes the
 * palette it is drawn against.
 *
 * @module entities/species
 */

import { rr, ri, pick } from '../core/math.js';
import { ENEMIES } from '../data/enemies.js';

export const NUCLEI = ['dot', 'trio', 'ring', 'crescent'];
export const NUCNAME = { dot: 'MONO-NUCLEUS', trio: 'TRI-NUCLEUS', ring: 'RING-NUCLEUS', crescent: 'CRESCENT', none: 'ANUCLEATE' };
export const SITES = ['femoral artery', 'pulmonary vein', 'hepatic portal', 'carotid branch', 'renal capillary', 'aortic arch', 'splenic sinus'];

export const PSPEC = Object.fromEntries(Object.entries(ENEMIES).map(([id, archetype]) => [id, {
  ...archetype,
  build(e, sig, dev) {
    if (archetype.dress) archetype.dress(e, sig, dev);
  }
}]));

export function makeSignature() {
  const lobes = pick([0, 3, 4, 5, 6]);
  const sig = {
    hue: ri(150, 350),
    sat: ri(62, 86),
    lit: ri(56, 68),
    r: rr(21, 27),
    lobes: lobes,
    lobeAmp: lobes === 0 ? 0.022 : rr(0.075, 0.135),
    nuc: pick(NUCLEI),
    patient: 'CLIENT #' + pick('ABCDEFHJKLMNPRSTVX') + '-' + ri(1000, 9999),
    site: pick(SITES)
  };
  sig.desc = 'HUE ' + sig.hue + '° · ' + (lobes ? lobes + '-LOBE' : 'SMOOTH') + ' · ' + NUCNAME[sig.nuc];
  sig.short = 'H' + sig.hue + ' · ' + (lobes ? lobes + 'L' : 'SM') + ' · ' + NUCNAME[sig.nuc].split('-')[0].slice(0, 4);
  return sig;
}
