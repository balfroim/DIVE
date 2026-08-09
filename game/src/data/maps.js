/**
 * Hand-drawn vessel maps, as plain text.
 *
 * This is the file to edit when you want to reshape a dive by hand: each map
 * is one string per depth row, and the characters are the vessel network.
 * An organ names its map with the `map` field in data/organs.js, and every
 * dive at that site is carved from the drawing instead of being grown.
 *
 * Alphabet (one character per grid cell; pad with spaces, `.` is decorative):
 *
 *   #    a junction chamber (adjacent junctions are directly connected)
 *   E    a junction, and the dive entry (exactly one, on the top row)
 *   O    a junction, and the target organ (exactly one, deepest drawn row)
 *   -    horizontal corridor: runs between junctions through any `-`/`+`
 *   |    vertical corridor: runs between junctions through any `|`/`+`
 *   +    crossing: a horizontal AND a vertical corridor, no chamber -
 *        corridors run THROUGH it; it never terminates a corridor itself
 *
 * Rules (the builder throws at boot when one is broken, with the row and
 * column of the offender):
 *
 *   1. Exactly one E and one O. E belongs on the top row and O on the
 *      deepest row you want in play - the dive finishes when the deepest
 *      row's wave is cleared.
 *   2. Every junction must touch at least one corridor.
 *   3. Every row's junctions must be joined to each other using only
 *      horizontal corridors. A wave is fought with the valves below shut, so
 *      a chamber reachable only via the row under it would deadlock the
 *      contract (same invariant the grown maze enforces in world/maze.js).
 *   4. Mind the `+` crossing: a junction diagonally across a `+` is NOT
 *      linked - the corridors pass over each other without a chamber.
 *
 * A contract may dive a PREFIX of a map (deeper offers take more rows), so
 * give a map more rows than its organ's baseline `depth` and make sure every
 * prefix down to two rows still satisfies rules 1-3 - the organ is re-seated
 * on the deepest surviving row, so make that row a cul-de-sac.
 *
 * There is no procedural fallback: a broken map fails the build's smoke test,
 * not the player's dive.
 *
 * @module data/maps
 */

export const MAPS = [
  {
    id: 'marrow',
    /* Femoral marrow: a low-pressure sponge. Wide, braided, forgiving. */
    rows: [
      '  E   ',
      '  |   ',
      '#-#-# ',
      '| | | ',
      '#-+-# ',
      '  | | ',
      ' #-## ',
      ' | | |',
      ' #-#O '
    ]
  },
  {
    id: 'lung',
    /* Pulmonary vein: two bronchi that merge, split, and merge again. */
    rows: [
      '   E   ',
      '   |   ',
      '  ###  ',
      '  | |  ',
      '#-+-+--#',
      '|   | |',
      '#   | #',
      '|   | |',
      '#-#  #-#',
      '  |  | ',
      '  #--# ',
      '  |    ',
      '  O    '
    ]
  },
  {
    id: 'heart',
    /* Aortic arch: over the top and down the far side. Hypertensive. */
    rows: [
      '  E   ',
      '  |   ',
      '#-#   ',
      '  |   ',
      '  #-# ',
      '  | | ',
      '#-+ | ',
      '| | | ',
      '#-# | ',
      '    | ',
      '    O '
    ]
  }
];

/** The map an organ names, or null when the organ grows its vessel. */
export function mapFor(id) {
  for (const m of MAPS) if (m.id === id) return m;
  return null;
}

/** Size of a map: depth rows by lateral junction columns. */
export function mapSize(m) {
  let cols = 0;
  for (const line of m.rows) cols = Math.max(cols, line.length);
  return { rows: m.rows.length, cols };
}
