/**
 * Entry point: build the world, wire the input, start the loop.
 *
 * Boot order matters:
 *   1. canvas + view          (everything measures against it)
 *   2. sprites/background     (cached once)
 *   3. UI wiring              (Game.ui must exist before any state change)
 *   4. input                  (hooks call into Game, which now exists)
 *   5. loop
 *
 * @module main
 */

import { attachCanvas, View } from './core/view.js';
import { attachInput } from './core/input.js';
import { Store, KEYS } from './core/store.js';
import { Maze } from './world/maze.js';
import { spawnEnt, clearEnts } from './entities/pool.js';
import { playerReset, player } from './entities/player.js';
import { buddyReset } from './entities/buddy.js';
import { makeSignature } from './entities/species.js';
import { initBG } from './render/ambience.js';
import { render } from './render/scene.js';
import { Game } from './game/state.js';
import { Career } from './game/career.js';
import { UI, wireUI } from './ui/screens.js';
import { DLG } from './ui/dialogue.js';
import { cam } from './core/view.js';

/** A small living vessel to sit behind the menus. */
function bootBackdrop() {
  Maze.build({ seed: 20260808, rows: 3, cols: 3, bore: 1, organName: 'ATRIUM', hue: 340 });
  for (const e of Maze.edges) e.open = true;
  clearEnts();
  const sig = makeSignature();
  playerReset(Maze.entry.x, Maze.entry.y);
  buddyReset();
  cam.x = player.x;
  cam.y = player.y;
  for (let i = 0; i < 9; i++) spawnEnt('host', sig, 1, { row: i % 3 });
  for (let i = 0; i < 2; i++) spawnEnt('influenza', sig, 0.9, { row: 1 + (i % 2) });
}

function boot() {
  attachCanvas(document.getElementById('game'));
  bootBackdrop();
  initBG();
  wireUI();

  Career.agent = Store.get(KEYS.name, 'AGENT');

  attachInput(View.cv, {
    onKey: (code, k) => Game.onKey(code, k),
    isPlaying: () => Game.state === 'play',
    onPause: () => Game.pause()
  });

  UI.showStart();

  let last = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    const now = ts * 0.001;
    let dt = now - last;
    last = now;
    if (dt > 0.06) dt = 0.06;   // never simulate a huge step after a stall
    if (dt <= 0) return;

    Game.step(dt);
    render();
    DLG.tick(dt);
    UI.tickPreviews(Game.t);
  }
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
