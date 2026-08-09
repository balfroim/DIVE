/**
 * Target sites, and where they live on the body minimap.
 *
 * `mx`/`my` are normalised coordinates inside the silhouette box (0..1), so the
 * minimap renderer never needs to know anything about anatomy. `depth` is the
 * baseline number of vessel rows to reach the site - contracts scale it with
 * difficulty. `pressure` is the resting blood pressure rating of the district,
 * which is what actually squeezes the corridors and speeds up the flow.
 *
 * To add a site: append an entry. Nothing else needs to change.
 *
 * @module data/organs
 */

export const ORGANS = [
  { id: 'ear',      name: 'Cochlea',          short: 'EAR',     map: 'ear',   mx: 0.44, my: 0.115, depth: 1, pressure: 0.45, hue: 45,  vessel: 'labyrinthine artery',
  note: 'The inner ear\'s hearing organ. Easily accessible and pressure is low.' },
{ id: 'nose',     name: 'Nasal cavity',     short: 'NOSE',    map: 'nose',  mx: 0.50, my: 0.145, depth: 1, pressure: 0.35, hue: 90,  vessel: 'sphenopalatine artery',
  note: 'The body\'s air filter. A maze of mucus-lined passages that traps dust, pollen and microbes before they reach the lungs. Sticky conditions, but an easy first assignment.' },
{ id: 'throat',   name: 'Pharynx',          short: 'THROAT',  map: 'throat', mx: 0.50, my: 0.185, depth: 2, pressure: 0.60, hue: 120, vessel: 'ascending pharyngeal artery',
  note: 'The crossroads where air and food share one passage. Constant traffic from the outside world makes it a frequent infection site. Sore throats start here.' },
  { id: 'marrow',   name: 'Femoral marrow',  short: 'MARROW',  map: 'marrow', mx: 0.44, my: 0.70, depth: 3, pressure: 0.95, hue: 32,  vessel: 'femoral artery',
    note: 'This is where the body makes its blood cells. Currents are gentle, so you can take your time.' },
  { id: 'lung',     name: 'Pulmonary vein',  short: 'LUNG',    map: 'lung', mx: 0.585, my: 0.285, depth: 5, pressure: 1.55, hue: 200, vessel: 'pulmonary vein',
    note: 'Freshly oxygenated blood on its way back from the lungs. The flow rises and falls with every breath. Lungs are also the front door for anything breathed in, so expect company.' },
  { id: 'heart',    name: 'Aortic arch',     short: 'HEART',   map: 'heart', mx: 0.53, my: 0.315, depth: 6, pressure: 1.95, hue: 0,   vessel: 'aortic arch',
    note: 'The body\'s main highway out of the heart. Pressure is at its highest here and the flow is rough. Anything infectious passing through reaches the entire body within minutes.' },
    { id: 'rectum',   name: 'Anal canal',       short: 'EXIT',    map: 'rectum', mx: 0.50, my: 0.845, depth: 1, pressure: 0.30, hue: 25,  vessel: 'inferior rectal artery',
  note: 'You probably know. Somebody has to deal with it. Disclaimer: the odor filtration inside the suit can malfunction.' }
  ];

/** Sites appropriate to a reputation level: better licence, deeper work. */
export function organsForRep(rep) {
  const scaled = Math.max(0, Math.min(1, (rep || 0) / 100));
  const max = 1 + Math.floor(scaled * (ORGANS.length - 1));
  return ORGANS.slice(0, Math.max(1, Math.min(ORGANS.length, max)));
}
