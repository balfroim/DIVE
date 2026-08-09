/**
 * The seam between the simulation and the rules.
 *
 * Entities, the diver and the white cell are pure simulation: they move, they
 * collide, they touch each other. What a collision *means* - a bounty, a fine,
 * a lawsuit, a lost client - is a rules question that lives in `game/`.
 *
 * Rather than have the simulation import the rules (a cycle, and untestable in
 * isolation), the rules register themselves here at boot. Every field has a
 * harmless default so the simulation can be driven headless by a test with no
 * game state at all.
 *
 * @module entities/hooks
 */

export const Rules = {
  /** Current simulation clock, seconds. */
  now: () => 0,
  /** Difficulty scalar, roughly 1..6. */
  difficulty: () => 1,
  /** Client cell signature, for corrupted-cell dressing. */
  signature: () => null,
  /** How many pathogens may exist before conversions are held back. */
  pathogenCap: () => 8,
  /** A host cell finished converting - the rules perform the transformation. */
  onInfection: (_e) => {},
  /** Something died on the escort's firing line. */
  onKill: (_e, _B) => {},
  /** Client integrity draining, in points, already multiplied by dt. */
  onBleed: (_amount, _e) => {},
  /** The white cell started a lunge (for camera/audio feedback). */
  onLunge: () => {},
  /** The escort refused to fire: the muzzle is inside tissue. */
  onBlocked: () => {}
};

/** Install real rules. Called once from game/state.js. */
export function installRules(impl) {
  Object.assign(Rules, impl);
}
