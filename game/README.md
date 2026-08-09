# D.I.V.E. — Division of Immunity and Virus Elimination

A single-file browser game about being a **freelance diver** in a world where
the patient is a client, the client is a cost centre, and your white blood cell
kills everything it touches on the way to the target.

The current release adds the oxygen clock and siphon loop, the heir/ascension
succession path, and a data-driven ECS-friendly structure for enemies and
conversation while keeping the build fully self-contained in one `dive.html`.

The source is organised as ES modules under `src/`; `npm run build` bundles
it into one self-contained `dive.html` with no external requests.

**New here?** Read the module map below, then
[`docs/ADDING-CONTENT.md`](docs/ADDING-CONTENT.md) for step-by-step recipes
(new enemy, new contract type, new organ, new shop item, …).

---

## Quick start

```bash
cd game
npm install          # esbuild, acorn, puppeteer

npm run build        # -> ../dive.html   (the deliverable)
npm run check        # static undefined-identifier check
npm test             # build + all 5 headless suites

npm run dev          # dev server on :5173, open index.html - live ES modules, no bundling
```

Two ways to run it while developing:

| | what you get |
|---|---|
| `npm run dev` → `index.html` | raw ES modules, real stack traces, edit-and-refresh |
| `npm run build` → `../dive.html` | the shipped artefact, one file, double-clickable |

---

## The three headline systems

### 1. You are a freelancer, not an employee

Reputation gates what work the Division will let near you. Harder contracts pay
more reputation; failing one costs it.

```
data/clients.js     11 clients, 5 actuarial tiers (D..S), each with a minRep
data/organs.js      8 dive sites, each with a depth and a blood pressure
game/contracts.js   makeContract(rep, seed, slot) - deterministic from the seed
game/career.js      the persistent freelancer: name, rep, credits, kit, offers
game/economy.js     bounties, the invoice, reputation deltas
```

Difficulty is one number derived from three: `1 + (rows-3)*0.55 + (pressure-0.95)*1.5 + tier*0.35`.
It drives maze depth, corridor squeeze, pathogen count, pay and reputation swing.

**Blood pressure is the difficulty dial the player feels.** High-pressure districts
squeeze the vessel bore (`CFG.maze.squeeze`), add a current surge, and demand a
higher suit rating — which you buy in the shop.

### 2. The vessel is a procedural maze, not an arena

```
world/maze.js       chambers + corridors, DFS spanning tree + braid links
```

- Grid of **chamber** nodes joined by **corridor** capsules. Walkable space is the
  union of those shapes; everything else is endothelium.
- **Rows are waves.** Row *n* spawns its pathogens when you arrive; the valves down
  to row *n+1* stay shut until you clear it. The deepest row holds the target organ.
- Vertical spacing is `CFG.maze.stretch` (1.45×) wider than horizontal, and contract
  width is capped against depth, so the network always reads as a **descent**.
- Collision is `Maze.resolve(body, r, bounce)` — snap to the nearest shape's inner
  boundary and kill the inward velocity. Cheap, stable, feels like scraping a wall.

> **Invariant worth knowing before you touch this file:** every row must be
> laterally connected *using only intra-row corridors*. A wave is fought with the
> valves below sealed, so a chamber reachable only by dropping through the row
> beneath it strands its pathogens and deadlocks the contract. `build()` runs a
> union-find pass at the end to guarantee this, and `tests/props.js` fails the
> build if it ever regresses. (This was a real bug: it affected **100%** of mazes.)

### 3. The escort kills along its whole path

```
entities/buddy.js   hasFiringLine(), lungeCasualties(), sweepHits()
render/vessel.js    drawFiringLine() - the red/green line you aim with
```

The white cell lunges in a straight line and destroys **every cell the line
touches**, not just the marked one. So:

- `lungeCasualties(fromX, fromY, target, out)` — everything within
  `killR + e.r*0.72` of the segment. The HUD colours the firing line red when this
  is non-empty.
- Collateral is billed. Host cells → damages + reputation. Symbiotes → litigation.
- `hasFiringLine()` refuses shots through tissue. It deliberately **stops short of
  the target** by `target.r + killR/2`, because the target is standing in that spot —
  without the trim, a cell hugging the vessel wall could never be shot from anywhere.
- `CFG.buddy.lineR` (default 9) is the aiming strictness dial. Raise it and shots
  need more open corridor.

---

## Module map

```
src/
├── main.js                boot: canvas -> input -> UI -> frame loop
│
├── core/                  no game knowledge, safe to use anywhere
│   ├── math.js            clamp, lerp, easing, distToSegment, hsl, wrapHue
│   ├── rng.js             seeded RNG (contracts must be reproducible)
│   ├── view.js            canvas, DPR, camera, zoom, adaptive quality
│   ├── input.js           keyboard + mouse + touch -> one intent object
│   ├── audio.js           WebAudio SFX, no files
│   ├── store.js           localStorage with JSON + failure tolerance
│   └── config.js  ⭐      EVERY tunable number in the game
│
├── world/
│   ├── maze.js            procedural vessels: build, resolve, lineClear, valves
│   └── flow.js            the plasma current field everything drifts on
│
├── ecs/                   tiny entity-component-system kernel
│   ├── world.js           the entity lists + component queries
│   ├── components.js      the component registry (data + defaults)
│   └── systems.js         the system runner and pipeline ORDER
│
├── entities/
│   ├── pool.js            fixed object pool - nothing is allocated mid-dive
│   ├── species.js         the client cell signature the bestiary dresses against
│   ├── systems.js         per-frame AI as systems: motion, infection, clotting
│   ├── player.js          the diver: thrust, suit rating, pressure surge
│   ├── buddy.js  ⭐       the white cell + the lethal lunge
│   ├── particles.js       particle + floating-text pools
│   └── hooks.js           Rules seam: sim -> game, breaks the import cycle
│
├── game/
│   ├── state.js  ⭐       Game: the dive state machine and all scoring
│   ├── career.js          Career: the persistent freelancer + save/load
│   ├── contracts.js       contract generation from reputation
│   ├── economy.js         bounties, invoice, reputation maths
│   └── lineage.js         succession: heirs, estates, cause of death
│
├── data/          ⭐      pure content - edit freely, no logic here
│   ├── enemies.js         the bestiary: every cell archetype, as data
│   ├── contract-types.js  job types: populations, objectives, setup rolls
│   ├── organs.js          dive sites
│   ├── clients.js         clients + tiers
│   ├── heirs.js           succession candidates: relations, boons, flaws
│   ├── dialogue.js        every script (induction, ascension), as data
│   └── shop.js            requisitions
│
├── render/                draw only; never mutates simulation state
│   ├── scene.js           composes the frame
│   ├── vessel.js          walls, valves, organ, firing line
│   ├── cells.js           cell bodies, nuclei, diagnostic overlay
│   ├── buddy.js  diver.js  sprites.js  fx.js  ambience.js
│   ├── minimap.js         body chart + depth gauge + network map
│   └── hud.js             integrity, money, scans, marks, touch controls
│
└── ui/
    ├── screens.js ⭐      every overlay screen + all DOM wiring
    ├── dialogue.js        the typewriter engine (content lives in data/dialogue.js)
    ├── previews.js        the live cell previews on the briefing card
    └── dom.js             $, esc, on, show, hideAll helpers
```

⭐ = the files you will actually want to open first.

### Dependency direction

```
core  ->  world  ->  ecs  ->  entities  ->  game  ->  ui
                             \          /
                              \        v
                               +--> render
```

Nothing lower imports anything higher. The one place that would have created a
cycle — the simulation needing to tell the game "this got eaten" — goes through
`entities/hooks.js`, a tiny seam that `game/state.js` fills in at boot with
`installRules({...})`.

---

## Recipes: "how do I change…"

| I want to… | Go here |
|---|---|
| Make the game easier / harder overall | `core/config.js` → `CFG.dmg`, `CFG.econ` |
| Change how strict aiming is | `core/config.js` → `CFG.buddy.lineR` (up = stricter) |
| Change the lethal blast width | `core/config.js` → `CFG.buddy.killR` |
| Make corridors wider / tighter | `CFG.maze.bore`, `CFG.maze.boreJitter` |
| Make the descent longer / shorter | `CFG.maze.stretch`, and `rows` in `contracts.js` |
| Change how much pressure squeezes the vessel | `CFG.maze.squeeze` |
| Add a dive site (organ) | append to `data/organs.js` (`mx`,`my` place it on the body chart) |
| Add a client archetype | append to `data/clients.js` with a `tier` and a `minRep` |
| Add a shop item | append to `data/shop.js` — `{id,name,desc,cost,buy,owned}` |
| Retune the pay curve | `game/economy.js` → `bounty()`, `buildInvoice()` |
| Retune reputation | `CFG.rep` + `game/economy.js` → `repDelta()` |
| Change how far into debt you can go | `CFG.econ.debtFloor` (default −500) |
| Rewrite the onboarding dialogue | `data/dialogue.js` — plain node lists, one per script |
| Change a screen's layout | `index.html` for markup, `ui/screens.js` for fill logic |
| Add a HUD element | `render/hud.js` (UI-space coords, `View.ui` scaled) |
| Change maze topology | `world/maze.js` → `build()` (keep the row-connectivity pass!) |
| Add an enemy species | append to `data/enemies.js` + list it in `data/contract-types.js` |
| Add a contract type | append to `data/contract-types.js` (`minRep`, `weight`, `threats`) |
| Add a heir boon / flaw | append to `data/heirs.js` (`apply(career)` adjusts the estate) |

The full step-by-step versions of these recipes live in
[`docs/ADDING-CONTENT.md`](docs/ADDING-CONTENT.md).

### Adding a shop item, end to end

```js
// src/data/shop.js
{
  id: 'thrusters',
  name: 'Auxiliary thrusters',
  desc: 'Cuts the pressure penalty. The Division bills the fuel separately.',
  cost: (c) => Math.round(320 * scale(c)),
  buy:  (c) => { c.thrust = (c.thrust || 0) + 1; },
  owned:(c) => (c.thrust || 0) + ' fitted'
}
```

Then persist it: add `thrust` to the `SAVED` list and to the defaults in
`Career.reset()` in `game/career.js`. Read it wherever it matters
(`entities/player.js`). That's the whole contract — the shop screen builds itself
from the array.

---

## Testing

Everything is verified by instrumentation in headless Chrome — nothing is
eyeballed. The current suite runs five browser-backed checks and is expected to
pass cleanly after any refactor that changes the gameplay API:

| suite | what it proves |
|---|---|
| `smoke.js` | boots, signs on, names the agent, takes a job, dives, no errors |
| `e2e.js` (92) | onboarding, rep gating, maze/waves/valves, lethal path, scan billing, corruption, invoice, shop, licence termination, save/reload |
| `props.js` (23) | **600 generated contracts**: connectivity, no deadlocks, descent shape, narrow bore, spawn room, winnability sweep, 7,200 physics frames |
| `platform.js` (91) | 7 viewports (360×740 → 2560×1080), HUD lands on screen at every aspect, real touch events, 9,000-frame leak/NaN/perf run, self-containment |
| `playthrough.js` (29) | a bot navigates the real maze graph and **completes 20 random contracts start to finish** |

Three real, game-breaking bugs were found and fixed by these suites rather than by
playing: the row-connectivity deadlock above, a firing-line test that made
wall-hugging cells unshootable from *anywhere*, and an escort that would retry an
impossible lunge forever and stall the last pathogen of a wave
(`CFG.buddy.giveUp` now caps the retries and drops the mark).

```bash
export LD_LIBRARY_PATH=/tmp/root/usr/lib/x86_64-linux-gnu:/tmp/root/lib/x86_64-linux-gnu
npm test
```

### The build has two gates

`npm run build` refuses to produce `dive.html` if either fails:

1. **`tools/check-imports.mjs`** — parses every module with acorn, builds a real
   lexical scope tree, and reports any identifier that is read but never declared,
   imported, or a known global. esbuild bundles a free variable as a *global lookup*
   without complaint, so without this a typo like `wrapHue` only shows up as a
   runtime `ReferenceError`. This gate caught four such bugs.
2. **External-reference scan** — fails if any `src`/`href` points at `http(s)://`
   or `//`. The deliverable must work offline from a file:// URL.

---

## Controls

|  | desktop | touch |
|---|---|---|
| swim | `WASD`, arrows, or `ZQSD` (AZERTY) | left-hand joystick |
| mark a target | left click, or `Space` | tap the cell |
| scan | `E` or right-click | the **SCAN** button |
| pause / resume | `Esc` | — |
| mute | `M` | — |

On the menus: `Space`/`Enter` confirms, `1`–`3` picks a contract straight off the
board, `Esc` backs out of a briefing, `R` re-enlists after a termination.

The induction plays at the start of **every new career** (that is where Vax takes
your name — the "My name is…" branch opens a text field and he re-etches the
badge with what you type). **Continue** on the title screen resumes a saved career
and goes straight to the job board. A re-enlistment remembers the last name you
used, so you only have to type it once.

Scanning is a **metered consumable**: you buy charges in the shop and the Division
bills you again per activation at extraction. Guessing is free — and pays a
premium if you're right.

---

## Known constraints

- The bundle is one file with no assets: every sprite, sound and font is generated
  at runtime (canvas + WebAudio + system monospace).
- Object pools are sized in `CFG` and never grow; the 9,000-frame test asserts this.
