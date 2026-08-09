# Adding content to D.I.V.E.

The game is data-driven: nearly everything you would want to add is an entry in
a file under `src/data/`, and the systems pick it up automatically. This guide
is the checklist version. Each recipe names the file, shows the shape of an
entry, and lists anything else that has to change (usually nothing).

Golden rule: **`src/data/` is pure content — no game logic lives there.** Logic
belongs to the systems that read the data (`src/entities/`, `src/game/`).

After any change:

```bash
npm run check   # static undefined-identifier gate
npm test        # build + all 5 headless suites
```

---

## Add an enemy (or any cell archetype)

**File: `src/data/enemies.js`.** Copy an existing entry in `ENEMIES` and change
the numbers. One entry is one archetype:

```js
toxoplasma: {
  id: 'toxoplasma', kind: 'pathogen',
  name: 'Toxoplasma-type', short: 'TOXO',
  desc: 'Crescent body. Drifts until the diver is close, then darts.',
  idName: 'PATHOGEN', idSub: 'TOXOPLASMA', idCol: '#ff5a72',
  dress(e, sig, dev) {
    e.hue = wrapHue(sig.hue + sgn() * (20 + 40 * dev));
    e.r = sig.r * rr(0.6, 0.8);
    e.nuc = 'crescent';
  },
  components: {
    motion: { kind: 'dart', force: 210 },
    hostile: {},
    bounty: { kind: 'kill' },
    chemotaxis: {}
  }
},
```

- `dress(e, sig, dev, o)` writes the *appearance* onto the flat entity struct.
  `sig` is the client's cell signature, `dev` is how far this strain strays from
  it (low `dev` = a convincing mimic). Available helpers come from
  `core/math.js` (`rr`, `ri`, `pick`, `sgn`, `clamp`, `wrapHue`). The full list
  of drawable fields (`spikes`, `elong`, `coil`, `flag`, `nuc`, `halo`,
  `lobes`, …) is the shape in `entities/pool.js` → `blankEnt()`.
- `components` is what the cell *does*. The available components and their
  defaults are documented in `ecs/components.js`; each one is driven by a
  system in `entities/systems.js`. Data only — never put behaviour here.

**Then make it spawn:** list its id in a contract type's `threats` array (or as
an `extras` entry) in `src/data/contract-types.js`. That is the whole
procedure — no other file needs to be touched. The renderer reads the flat
fields `dress` writes, so most archetypes need no drawing code; only a wholly
new body plan (like the spirochete's `coil`) adds a branch to
`render/cells.js` → `drawEntityBody`.

## Add a contract type

**File: `src/data/contract-types.js`.** Append an entry to `CONTRACT_TYPES`:

```js
{
  id: 'infestation',
  name: 'Deep infestation', short: 'NEST',
  minRep: 40,          // licence level before it can appear on the board
  weight: 2,           // how often it is drawn against other allowed types
  diffBonus: 1,        // added to the difficulty scalar
  objective: 'Burn the nest out of every row.',
  brief: 'Shown on the briefing card.',
  scanHint: 'Shown next to the scan button.',

  hostArch: 'host',                          // the client's own tissue
  hostCount: (diff) => 6 + Math.round(diff * 1.5),
  threats: ['influenza', 'toxoplasma'],      // archetype ids from enemies.js
  threatCount: (diff, row) => 3 + Math.floor(row * 0.8),
  extras: [                                  // optional occasional spawns
    { arch: anySymbiote, chance: 0.4, minRow: 1, awayD: 200 }
  ],
  setup(contract, R) {}                      // optional per-contract rolls
}
```

`setup` runs once at contract generation with the seeded RNG `R` — use it for
anything the briefing and the dive must agree on (see how `transfusion` picks
the blood groups). Slot 0 on the board is always the plain `purge` job, so new
types can never lock a new player out of work.

## Add a dive site (organ)

**File: `src/data/organs.js`.** Append to `ORGANS`:

```js
{ id: 'pancreas', name: 'Pancreatic duct', short: 'PANCREAS',
  mx: 0.47, my: 0.47,      // 0..1 position on the body minimap
  depth: 4,                // baseline vessel rows
  pressure: 1.2,           // squeezes corridors, speeds the current
  hue: 90, vessel: 'pancreatic duct',
  note: 'One line of flavour for the briefing.' },
```

Nothing else to change — `organsForRep()` folds it into the board by depth.

## Add a client archetype

**File: `src/data/clients.js`.** Append to `CLIENTS` with a `tier` index into
`TIERS` (0 = D … 4 = S) and a `minRep`:

```js
{ job: 'Offshore content moderator', tier: 1, minRep: 18,
  memo: 'The one-liner the client file shows.' },
```

## Add a shop item

**File: `src/data/shop.js`.** Append `{ id, name, desc, cost, buy, owned }`:

```js
{
  id: 'thrusters',
  name: 'Auxiliary thrusters',
  desc: 'Cuts the pressure penalty. The Division bills the fuel separately.',
  cost: (c) => Math.round(320 * scale(c)),
  buy:  (c) => { c.thrust = (c.thrust || 0) + 1; },
  owned:(c) => (c.thrust || 0) + ' fitted'
}
```

The shop screen builds itself from the array. If the item adds a *new* career
field (like `thrust` above), persist it: add the field name to the `SAVED`
list in `src/game/career.js` and give it a default in `Career.reset()`. Then
read it wherever it matters (e.g. `entities/player.js`).

## Add an heir boon or flaw

**File: `src/data/heirs.js`.** Append to `BOONS` or `FLAWS`:

```js
{
  id: 'stubborn', name: 'Refuses to die quietly',
  desc: 'Starts with +25 client integrity on every contract.',
  apply(c) { /* runs after the estate transfers; adjust the career */ }
}
```

A trait can also set `estate: <mult>` (share of the estate kept) or
`keepSuit: true`; `game/lineage.js` → `computeEstate()` reads those flags
before `apply` runs.

## Add a new behaviour (a component + a system)

This is the one recipe that touches code outside `src/data/`:

1. **Declare the component** in `src/ecs/components.js`:
   `defineComponent('magnet', { defaults: { pull: 60 } })`. An optional
   `apply(e, c)` writes derived values onto the entity at spawn time.
2. **Drive it with a system** in `src/entities/systems.js`:
   ```js
   defineSystem({
     name: 'magnet',
     order: ORDER.steer,              // see ORDER in ecs/systems.js
     require: ['magnet'],
     each(e, dt, ctx, m) { /* per-frame, per entity carrying it */ }
   });
   ```
   Consequences (bounties, fines, integrity) must go through `Rules` in
   `entities/hooks.js` — the simulation never imports the game.
3. **Give it to archetypes**: `components: { magnet: { pull: 80 } }` in
   `src/data/enemies.js`.

## Where to look when something is off

| Symptom | First stop |
|---|---|
| A typo'd name only fails at runtime | `npm run check` (the build runs it too) |
| The bundle grew a network request | build gate 2 fails; find the `http(s):` reference |
| Mazes deadlocking | `world/maze.js` — never remove the row-connectivity pass |
| A number feels wrong | `core/config.js` — every tunable is there |
