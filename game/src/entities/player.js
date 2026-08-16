/**
 * The diver.
 *
 * Movement is thrust + drag + the vessel's own current. Under pressure the
 * current pulses with the heartbeat, which is what makes a hypertensive
 * contract physically harder to fly: you are constantly being shoved
 * downstream and the corridors are narrower.
 *
 * @module entities/player
 */

import { CFG } from '../core/config.js';
import { TAU, PI, rr, lerp, clamp } from '../core/math.js';
import { Input } from '../core/input.js';
import { View, s2wx, s2wy } from '../core/view.js';
import { Maze } from '../world/maze.js';
import { spawnPart } from './particles.js';
import { currentAt } from '../world/flow.js';
import { Rules } from './hooks.js';
import { World } from '../ecs/world.js';
import { attach } from '../ecs/components.js';

export const player = {
  /* ECS actor bookkeeping */
  on: false, kind: 'diver', comp: Object.create(null), dying: 0,

  x: 0, y: 0, vx: 0, vy: 0,
  ang: 0, r: CFG.player.r,
  flap: 0, bub: 0, roll: 0, hurt: 0, speed: 0,
  /** 0..1 how hard the thrusters are running - the oxygen clock reads this. */
  thrust: 0,
  /** Wall contact, 0..1, drives the scrape flash and sound. */
  scrape: 0,
  /**
   * Suit rating, 1.0 = standard issue. Bought in the shop; it buys back thrust
   * and top speed that blood pressure takes away.
   */
  suit: 1
};

attach(player, 'playerControl', null);
World.addActor(player);

export function playerReset(x, y) {
  player.x = x; player.y = y;
  player.vx = player.vy = 0;
  player.hurt = 0; player.scrape = 0; player.speed = 0;
  player.thrust = 0;
}

const _ax = { x: 0, y: 0 };

/**
 * @param {number} dt
 * @param {boolean} live
 * @param {{current:number, flow:number}} env pressure-derived environment
 */
export function updatePlayer(dt, live, env) {
  const t = Rules.now();
  let ix = 0, iy = 0;
  if (live) {
    Input.axis(_ax);
    ix = _ax.x; iy = _ax.y;
  }
  const mag = Math.hypot(ix, iy);
  player.thrust = Math.min(1, mag);

  /* ambient drift + pulsatile pressure surge (the heartbeat) */
  const c = currentAt(player.x, player.y, t, env ? env.flow : 1);
  const beat = 0.55 + 0.45 * Math.sin(t * 5.9);
  const surge = (env ? env.current : 0) * beat;

  /* a better suit resists the surge and pushes harder */
  const acc = CFG.player.acc * (0.86 + 0.14 * player.suit);
  player.vx += (ix * acc + c.x * 1.4) * dt;
  player.vy += (iy * acc + c.y * 1.4 + surge / Math.max(0.6, player.suit)) * dt;

  const f = Math.max(0, 1 - CFG.player.drag * dt);
  player.vx *= f; player.vy *= f;
  const maxSp = CFG.player.max * (0.9 + 0.1 * player.suit);
  const sp = Math.hypot(player.vx, player.vy);
  if (sp > maxSp) { player.vx = (player.vx / sp) * maxSp; player.vy = (player.vy / sp) * maxSp; }
  player.speed = sp;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  /* vessel walls */
  const pen = Maze.resolve(player, CFG.player.r + 3, 0.35);
  if (pen > 0.6) {
    player.scrape = Math.min(1, player.scrape + pen * 0.05 + 0.12);
    if (sp > 210 && Math.random() < 0.2) {
      spawnPart(player.x + rr(-6, 6), player.y + rr(-6, 6), rr(-40, 40), rr(-40, 40),
        rr(1.5, 3.4), rr(0.25, 0.5), 348, 60, 70, 0, 2.4);
    }
  }
  player.scrape = Math.max(0, player.scrape - dt * 1.6);

  /* aim: mouse on desktop; swim direction (else last tap) on touch */
  let tAng = player.ang;
  if (Input.touch.enabled) {
    if (Input.touch.stick.on && mag > 0.15) tAng = Math.atan2(iy, ix);
    else if (Input.mouse.active) tAng = Math.atan2(s2wy(Input.mouse.y) - player.y, s2wx(Input.mouse.x) - player.x);
  } else if (Input.mouse.active) {
    tAng = Math.atan2(s2wy(Input.mouse.y) - player.y, s2wx(Input.mouse.x) - player.x);
  }
  const d = ((tAng - player.ang + PI) % TAU + TAU) % TAU - PI;
  player.ang += d * Math.min(1, dt * 16);

  player.flap += dt * (3.2 + sp * 0.03);
  player.roll = lerp(
    player.roll,
    clamp((ix * Math.sin(player.ang) - iy * Math.cos(player.ang)) * 0.28, -0.3, 0.3),
    dt * 6
  );
  player.hurt = Math.max(0, player.hurt - dt * 1.6);

  player.bub -= dt;
  if (player.bub <= 0) {
    player.bub = rr(0.14, 0.4);
    const bx = player.x - Math.cos(player.ang) * 12;
    const by = player.y - Math.sin(player.ang) * 12;
    spawnPart(bx + rr(-4, 4), by + rr(-4, 4), rr(-14, 14) - player.vx * 0.1, rr(-30, -12) - player.vy * 0.1,
      rr(1.3, 3.2), rr(0.7, 1.5), 190, 55, 88, 1, 0.9);
  }
}
