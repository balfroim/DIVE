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
  {
    id: 'rectum', name: 'Anal canal', short: 'ANUS', map: 'rectum', meanRep: 8, mx: 0.50, my: 0.845, depth: 1, pressure: 0.30, hue: 25, vessel: 'inferior rectal artery',
    note: 'You probably know. Somebody has to deal with it. Disclaimer: the odor filtration inside the suit can malfunction.'
  },
  {
    id: 'marrow', name: 'Femoral marrow', short: 'MARROW', map: 'marrow', meanRep: 0, mx: 0.44, my: 0.70, depth: 3, pressure: 0.95, hue: 32, vessel: 'femoral artery',
    note: 'This is where the body makes its blood cells. Currents are gentle, so you can take your time.'
  },
  {
    id: 'ear', name: 'Cochlea', short: 'EAR', map: 'ear', meanRep: 16, mx: 0.44, my: 0.115, depth: 1, pressure: 0.45, hue: 45, vessel: 'labyrinthine artery',
    note: 'The inner ear\'s hearing organ. Easily accessible and pressure is low.'
  },
  {
    id: 'nose', name: 'Nasal cavity', short: 'NOSE', map: 'nose', meanRep: 28, mx: 0.50, my: 0.145, depth: 1, pressure: 0.35, hue: 90, vessel: 'sphenopalatine artery',
    note: 'The body\'s air filter. A maze of mucus-lined passages that traps dust, pollen and microbes before they reach the lungs. Sticky conditions, but an easy first assignment.'
  },
  {
    id: 'throat', name: 'Pharynx', short: 'THROAT', map: 'throat', meanRep: 40, mx: 0.50, my: 0.185, depth: 2, pressure: 0.60, hue: 120, vessel: 'ascending pharyngeal artery',
    note: 'The crossroads where air and food share one passage. Constant traffic from the outside world makes it a frequent infection site. Sore throats start here.'
  },
  {
    id: 'lung', name: 'Pulmonary vein', short: 'LUNG', map: 'lung', meanRep: 55, mx: 0.585, my: 0.285, depth: 5, pressure: 1.55, hue: 200, vessel: 'pulmonary vein',
    note: 'Freshly oxygenated blood on its way back from the lungs. The flow rises and falls with every breath. Lungs are also the front door for anything breathed in, so expect company.'
  },
  {
    id: 'heart', name: 'Aortic arch', short: 'HEART', map: 'heart', meanRep: 70, mx: 0.53, my: 0.315, depth: 6, pressure: 1.95, hue: 0, vessel: 'aortic arch',
    note: 'The body\'s main highway out of the heart. Pressure is at its highest here and the flow is rough. Anything infectious passing through reaches the entire body within minutes.'
  },
  {
    id: 'brain', name: 'Cortex', short: 'BRAIN', map: null, meanRep: 88, mx: 0.50, my: 0.045, depth: 8, pressure: 2.35, hue: 245, vessel: 'cerebral artery',
    note: 'The most complicated type of contract.'
  }
];

function organsByMeanRep() {
  return [...ORGANS].sort((a, b) => a.meanRep - b.meanRep || a.id.localeCompare(b.id));
}

function closestOrganIndex(rep) {
  const currentRep = Math.max(0, Math.min(100, rep || 0));
  const list = organsByMeanRep();
  let best = 0;
  let bestGap = Infinity;
  for (let i = 0; i < list.length; i++) {
    const gap = Math.abs((list[i].meanRep ?? currentRep) - currentRep);
    if (gap < bestGap || (gap === bestGap && (list[i].meanRep ?? 0) > (list[best].meanRep ?? 0))) {
      best = i;
      bestGap = gap;
    }
  }
  return { list, best };
}

/** Site most appropriate to a reputation level: the nearest mean rep. */
export function organsForRep(rep) {
  const { list, best } = closestOrganIndex(rep);
  return [list[best] || ORGANS[0]];
}
