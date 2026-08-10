/**
 * Every balance number in the game, in one file.
 *
 * Nothing here is computed at runtime - if a value needs to change with
 * difficulty or reputation it is multiplied at the call site, so this file
 * stays readable as "the design document in numbers".
 *
 * @module core/config
 */

export const CFG = {
  /* ---- the diver ------------------------------------------------------ */
  player: {
    acc: 2250,      // thrust, world units/s^2
    drag: 3.05,     // plasma resistance (higher = stops sooner)
    max: 355,       // top speed before suit bonuses
    r: 15           // body radius, also the collision radius against vessel walls
  },

  /* ---- the white blood cell (direct fire) ----------------------------- */
  buddy: {
    r: 27,
    k: 58,          // spring constant toward its follow point
    d: 12.5,        // spring damping
    lungeAcc: 6400,
    lungeMax: 1420,
    /**
     * Seconds between shots. This is the whole skill budget: you cannot spray,
     * so every trigger pull has to be a line you chose.
     */
    cool: 0.62,
    /** Wind-back time before the lunge leaves. */
    windup: 0.11,
    /** Hard ceiling on how long one lunge may last before it recalls. */
    maxFlight: 1.5,
    /**
     * How far the lunge travels. THERE IS NO TARGET ACQUISITION: the cell is
     * fired down a direction and everything within killR of that line dies.
     */
    range: 700,
    /**
     * The lunge is LETHAL ALONG ITS WHOLE PATH. This is the swept radius: any
     * cell whose body comes within (killR + its radius) of the travelled line
     * is torn apart. Aim is the entire game.
     */
    killR: 30,
    /**
     * Probe radius for the firing-line raycast. The escort deforms to squeeze
     * through a vessel, so a shot only needs the corridor to be genuinely
     * open - not full-body clearance. Raise it to make aiming stricter.
     */
    lineR: 9,
    /** Raycast step for the preview. Smaller = more exact, more work. */
    lineStep: 12,
    windR: 34       // how far it rears back before firing
  },

  /* ---- scanning (a consumable) ---------------------------------------- */
  scan: { maxR: 540, time: 1.0, idTime: 7.5 },

  /* ---- the oxygen tank: the dive clock -------------------------------- */
  o2: {
    /** Seconds of gas in a standard-issue tank at rating 1. */
    tank: 60,
    /** Per-upgrade capacity bonus, seconds. */
    tankStep: 30,
    /** Baseline consumption, seconds of gas per second of dive. */
    idle: 1,
    /** Extra consumption at full thrust. */
    thrust: 0.55,
    /** Extra consumption per unit of blood pressure above 1.0. */
    pressure: 0.42,
    /** Below this many seconds the HUD screams. */
    warn: 40,
    critical: 15,

    /* ---- the siphon: steal the client's oxygen -------------------------
     * Standard issue on every rig. It works. That is the problem.           */
    /** Seconds of gas recovered per siphon. */
    siphonGain: 40,
    /** Client integrity destroyed per siphon (before filter upgrades). */
    siphonIntegrity: 9,
    /** Filter upgrades each cut the integrity cost by this fraction. */
    siphonFilter: 0.22,
    /** Seconds between siphons. */
    siphonCool: 3.2,
    /** How long the draw animation/vulnerability lasts. */
    siphonDraw: 0.85
  },

  /* ---- damage model --------------------------------------------------- */
  dmg: {
    healthy: 14,    // integrity lost per host cell destroyed
    symbiote: 20,   // integrity lost per symbiote destroyed (plus litigation)
    infect: 6,      // integrity lost when a pathogen converts a host cell
    corrupt: 0.34,  // integrity lost per corrupted cell per second (the bleed)
    graze: 5        // integrity lost per host cell shredded by a stray lunge
  },

  /* ---- the Division's ledger. Every verb has a price. ----------------- */
  econ: {
    scanCost: 0,      // scan charges
    scanBuy: 60,      // requisition price for a pack of charges
    scanBuyN: 3,
    scanMax: 4,
    issue: 0,         // scan charges are requisitioned, not issued free
    killBase: 18,     // base elimination bounty (scales with difficulty/tier/combo)
    quarantine: 35,   // culling a corrupting host cell before it flips
    deductHost: 90,   // damages for destroying client property
    deductSym: 260,   // symbiote litigation settlement
    deductInfect: 30, // "corruption event" administration fee
    retainer: 140,    // integrity retainer, paid pro-rata on surviving integrity
    /** Billed per siphon: the client is charged for their own oxygen. */
    siphonFee: 55,
    /** Recovering a dead diver is not free, and the estate pays. */
    recovery: 240,
    /**
     * How far into the red the Division will let you run before it calls in
     * the licence. Debt is leverage, not an exit - they would rather you kept
     * working it off. Go past this and you are finished.
     */
    debtFloor: -500
  },

  /* ---- freelance reputation ------------------------------------------- */
  rep: {
    start: 12,        // a fresh licence is worth almost nothing
    max: 100,
    /** Reputation earned = gainBase * contract difficulty. */
    gainBase: 5.5,
    /** Reputation burned when a client dies or you abandon the dive. */
    lossFail: 14,
    /** Credits per reputation point when you bribe your way out of a deficit. */
    bribeCost: 25,
    /** Bonus for a spotless dive (no wrongful kills, no siphoning). */
    cleanBonus: 3,
    /**
     * Reputation burned per siphon, multiplied by (1 + tier * siphonTier).
     * Robbing a Tier D nobody is a rounding error. Robbing a shareholder is a
     * career.
     */
    siphonLoss: 1.8,
    siphonTier: 0.75,
    /** Board refreshes with this many offers. */
    offers: 3
  },

  /* ---- the vessel maze ------------------------------------------------- */
  maze: {
    cell: 460,        // horizontal grid pitch in world units
    /**
     * Vertical pitch multiplier. Rows sit further apart than columns so the
     * network always reads as a *descent* down long vessels rather than an
     * open arena, even on a shallow 3-row contract.
     */
    stretch: 1.45,
    bore: 132,        // corridor half-width at pressure 1.0 (the "narrow" feel)
    boreJitter: 26,   // per-corridor variation
    chamber: 196,     // junction chamber radius
    cols: 4,          // grid width; depth (rows) comes from the contract
    wallPad: 6,       // visual thickness of the endothelium
    /** Pressure squeezes the vessel: bore * (1 - squeeze * (pressure-1)). */
    squeeze: 0.13
  },

  /* ---- pools ----------------------------------------------------------- */
  poolEnt: 140,
  poolPart: 900,
  poolPop: 44,
  ambientRBC: 110
};

/**
 * Difficulty knobs derived from a contract's blood pressure rating.
 * Pressure 1.0 is a resting adult; 2.4 is a hypertensive crisis.
 */
export function pressureProfile(pressure) {
  return {
    /** Constant drift the diver has to fight, world units/s^2. */
    current: 120 * (pressure - 0.75),
    /** Vessel bore multiplier - high pressure means tighter, faster channels. */
    bore: 1 - CFG.maze.squeeze * (pressure - 1),
    /** Everything in the blood moves faster. */
    flow: 0.85 + 0.42 * pressure,
    /** Pathogens are bolder. */
    aggression: 0.8 + 0.35 * pressure
  };
}
