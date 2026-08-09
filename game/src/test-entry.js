/**
 * Test entry point: the real game plus a debug handle.
 *
 * The puppeteer suites drive the game through `window.__D`. Keeping that export
 * in a separate entry means the shipped bundle has no test surface at all.
 *
 * @module test-entry
 */

import './main.js';
import { Game, firingPreview } from './game/state.js';
import { Career } from './game/career.js';
import { UI } from './ui/screens.js';
import { DLG } from './ui/dialogue.js';
import { SCRIPTS, SCRIPT, script as getScript } from './data/dialogue.js';
import { SHOP } from './data/shop.js';
import { TIERS } from './data/clients.js';
import { ORGANS } from './data/organs.js';
import { CFG } from './core/config.js';
import { View, cam } from './core/view.js';
import { Input } from './core/input.js';
import { Maze } from './world/maze.js';
import { ents, spawnEnt } from './entities/pool.js';
import { player } from './entities/player.js';
import { buddy, hasFiringLine, lungeCasualties } from './entities/buddy.js';
import { makeContract, generateOffers, offerSummary, suitFor, pressureLabel } from './game/contracts.js';
import { ENEMIES, archetype } from './data/enemies.js';

window.__D = {
  Game, Career, UI, DLG, SCRIPT, SCRIPTS, getScript, SHOP, TIERS, ORGANS, CFG, View, cam, Input, Maze,
  ents, spawnEnt, player, buddy, hasFiringLine, lungeCasualties, firingPreview,
  makeContract, generateOffers, offerSummary, suitFor, pressureLabel, ENEMIES, archetype,
  getZoom: () => View.zoom
};
