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
  { id: 'marrow',   name: 'Femoral marrow',  short: 'MARROW',  mx: 0.44, my: 0.70, depth: 3, pressure: 0.95, hue: 32,  vessel: 'femoral artery',
    note: 'Low-pressure sponge. Cheap to insure, cheap to lose.' },
  { id: 'gut',      name: 'Intestinal wall', short: 'GUT',     mx: 0.51, my: 0.505, depth: 3, pressure: 1.05, hue: 44, vessel: 'mesenteric arcade',
    note: 'Crowded, damp, litigious. Mind the resident flora.' },
  { id: 'spleen',   name: 'Splenic sinus',   short: 'SPLEEN',  mx: 0.60, my: 0.405, depth: 4, pressure: 1.15, hue: 300, vessel: 'splenic sinus',
    note: 'The client will not miss it. Try anyway.' },
  { id: 'liver',    name: 'Hepatic portal',  short: 'LIVER',   mx: 0.42, my: 0.395, depth: 4, pressure: 1.25, hue: 18,  vessel: 'hepatic portal',
    note: 'Slow, dense, forgiving of mistakes. Not of invoices.' },
  { id: 'kidney',   name: 'Renal capillary', short: 'KIDNEY',  mx: 0.58, my: 0.455, depth: 5, pressure: 1.45, hue: 350, vessel: 'renal capillary',
    note: 'Filtration bed. Everything narrows. Everything hurries.' },
  { id: 'lung',     name: 'Pulmonary vein',  short: 'LUNG',    mx: 0.585, my: 0.285, depth: 5, pressure: 1.55, hue: 200, vessel: 'pulmonary vein',
    note: 'Tidal surges on a six second cycle. Bring a bigger suit.' },
  { id: 'heart',    name: 'Aortic arch',     short: 'HEART',   mx: 0.53, my: 0.315, depth: 6, pressure: 1.95, hue: 0,   vessel: 'aortic arch',
    note: 'Hypertensive. The walls hit back. Premiums are excellent.' },
  { id: 'brain',    name: 'Carotid branch',  short: 'BRAIN',   mx: 0.50, my: 0.085, depth: 6, pressure: 2.25, hue: 275, vessel: 'carotid branch',
    note: 'Zero tolerance for collateral. The client needs this one.' }
];

/** Sites appropriate to a reputation level: better licence, deeper work. */
export function organsForRep(rep) {
  const max = 1 + Math.floor((rep / 100) * (ORGANS.length - 1) + 1.4);
  return ORGANS.slice(0, Math.max(2, Math.min(ORGANS.length, max)));
}
