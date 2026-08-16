import { CFG } from '../core/config.js';
import { TAU, rr, lerp, lerpAngle, distToSegment } from '../core/math.js';
import { Maze } from '../world/maze.js';
import { World } from '../ecs/world.js';
import { attach } from '../ecs/components.js';
import { spawnPart } from './particles.js';
import { player } from './player.js';
import { Rules } from './hooks.js';
import { SFX } from '../core/audio.js';
import type { Entity } from './cell.js';

// export const buddy = {
//   /* ECS actor bookkeeping */
//   on: false, kind: 'escort', comp: Object.create(null), dying: 0,

//   x: 0, y: 0, vx: 0, vy: 0,
//   r: CFG.buddy.r, state: 'follow', st: 0,
//   excite: 0, sad: 0, joy: 0, blink: 0, blinkT: 2, squash: 0, dirA: 0,
//   cool: 0, digest: 0, eatX: 0, eatY: 0, eatE: null, eatScale: 1,
//   lookX: 0, lookY: 0, trailT: 0, wobT: 0, born: 0, gulp: 0,
//   /** Pulses when a trigger pull was refused because the muzzle is in tissue. */
//   blocked: 0,
//   /** The shot currently in flight: origin, unit direction, and its far end. */
//   lungeX: 0, lungeY: 0, dirX: 1, dirY: 0, endX: 0, endY: 0, flight: 0,
//   /** How many cells the shot in flight has already destroyed. */
//   hits: 0,
//   /** Multiplier on the recharge rate, from heir traits. 1 = standard. */
//   rate: 1
// };

export interface Buddy extends Entity {
  state: 'follow' | 'wind' | 'lunge' | 'return';
  st: number;
  excite: number;
  sad: number;
  joy: number;
  blink: number;
  blinkT: number;
  squash: number;
  dirA: number;
  cool: number;
  digest: number;
  eatX: number;
  eatY: number;
  eatE: Entity | null;
  eatScale: number;
  lookX: number;
  lookY: number;
  trailT: number;
  wobT: number;
  born: number;
  gulp: number;
  blocked: number;
  lungeX: number;
  lungeY: number;
  dirX: number;
  dirY: number;
  endX: number;
  endY: number;
  flight: number;
  hits: number;
  rate: number;
}

export const buddy: Buddy = {
  on: false, kind: 'escort', comp: Object.create(null), dying: false,
  x: 0, y: 0, vx: 0, vy: 0,
  r: CFG.buddy.r, state: 'follow', st: 0,
  excite: 0, sad: 0, joy: 0, blink: 0, blinkT: 2, squash: 0, dirA: 0,
  cool: 0, digest: 0, eatX: 0, eatY: 0, eatE: null, eatScale: 1,
  lookX: 0, lookY: 0, trailT: 0, wobT: 0, born: 0, gulp: 0,
  blocked: 0,
  lungeX: 0, lungeY: 0, dirX: 1, dirY: 0, endX: 0, endY: 0, flight: 0,
  hits: 0,
  rate: 1
}

attach(buddy, 'escort', null);
World.addActor(buddy);

export function buddyReset() {
  buddy.x = player.x - 60; buddy.y = player.y;
  buddy.vx = buddy.vy = 0;
  buddy.state = 'follow'; buddy.st = 0; buddy.cool = 0;
  buddy.excite = buddy.sad = buddy.joy = buddy.digest = buddy.gulp = 0;
  buddy.r = CFG.buddy.r;
  buddy.eatE = null;
  buddy.blocked = 0;
  buddy.flight = 0;
  buddy.hits = 0;
}

/** Where it likes to sit when idle: over your left shoulder. */
function buddyFollowPoint(t) {
  const a = player.ang + 2.35;
  const off = 52 + Math.sin(t * 1.3) * 5;
  return {
    x: player.x + Math.cos(a) * off,
    y: player.y + Math.sin(a) * off + Math.sin(t * 1.7) * 5
  };
}

/** Ready to shoot? */
export function canFire() {
  return buddy.state === 'follow' && buddy.cool <= 0;
}

/** 0..1 recharge indicator for the HUD. */
export function fireCharge() {
  if (buddy.state !== 'follow') return 0;
  const c = CFG.buddy.cool;
  return c <= 0 ? 1 : Math.min(1, 1 - buddy.cool / c);
}

/**
 * How far a shot from (x,y) along (dx,dy) actually reaches before the vessel
 * wall stops it. Exported because the HUD draws exactly this line.
 */
export function shotReach(x, y, dx, dy, range) {
  return Maze.rayClip(x, y, dx, dy, range === undefined ? CFG.buddy.range : range,
    CFG.buddy.lineR, CFG.buddy.lineStep);
}

/**
 * Everything a shot along this segment would destroy.
 * @returns {object[]} live cells whose body intersects the swept path
 */
export function shotCasualties(x0, y0, x1, y1, out) {
  const list = out || [];
  list.length = 0;
  for (const e of World.pool) {
    if (!e.on || e.dying) continue;
    const d = distToSegment(e.x, e.y, x0, y0, x1, y1);
    if (d < CFG.buddy.killR + e.r * 0.72) list.push(e);
  }
  return list;
}

/** Compatibility helper used by the browser tests and older probes. */
export function hasFiringLine(x, y, target) {
  if (!target?.on || target.dying) return false;
  const dx = target.x - x;
  const dy = target.y - y;
  const m = Math.hypot(dx, dy) || 1;
  const ux = dx / m;
  const uy = dy / m;
  const reach = shotReach(x, y, ux, uy);
  const tx = x + ux * reach;
  const ty = y + uy * reach;
  return distToSegment(target.x, target.y, x, y, tx, ty) < CFG.buddy.killR + target.r * 0.72;
}

/** Compatibility helper used by the browser tests and older probes. */
export function lungeCasualties(bx, by, target, out) {
  const list = out || [];
  return shotCasualties(bx, by, target.x, target.y, list);
}

/** Cells actually struck by the segment the body swept this frame. */
function sweepHits(B, x0, y0, x1, y1) {
  for (const e of World.pool) {
    if (!e.on || e.dying) continue;
    const d = distToSegment(e.x, e.y, x0, y0, x1, y1);
    if (d < CFG.buddy.killR + e.r * 0.72) {
      B.hits++;
      Rules.onKill(e, B);
    }
  }
}

/**
 * Fire down a direction. This is the ONLY way the escort ever attacks.
 *
 * @param {number} dx @param {number} dy direction (need not be normalised)
 * @returns {boolean} true when a shot actually left
 */
export function fireBuddy(dx, dy) {
  const B = buddy;
  if (!canFire()) return false;
  const m = Math.hypot(dx, dy);
  if (m < 1e-4) return false;
  const ux = dx / m, uy = dy / m;

  /* refuse to fire with the muzzle buried in tissue: that is the one piece of
     judgement it has, and it stops the shot from teleporting through a septum */
  const reach = shotReach(B.x, B.y, ux, uy);
  if (reach < B.r * 0.9) {
    B.blocked = 1;
    SFX.bump();
    Rules.onBlocked();
    return false;
  }

  B.dirX = ux; B.dirY = uy;
  B.lungeX = B.x; B.lungeY = B.y;
  B.endX = B.x + ux * reach;
  B.endY = B.y + uy * reach;
  B.state = 'wind';
  B.st = 0;
  B.flight = 0;
  B.hits = 0;
  B.excite = 1;
  B.dirA = Math.atan2(uy, ux);
  SFX.lunge();
  Rules.onLunge();
  for (let k = 0; k < 5; k++) {
    const a = rr(0, TAU);
    spawnPart(B.x + Math.cos(a) * B.r * 0.9, B.y + Math.sin(a) * B.r * 0.9,
      Math.cos(a) * 60, Math.sin(a) * 60, rr(1.5, 3), rr(0.3, 0.6), 190, 70, 92, 0, 2.6);
  }
  return true;
}

export function updateBuddy(dt, live) {
  const B = buddy;
  const t = Rules.now();
  B.st += dt;
  B.excite = Math.max(0, B.excite - dt * 1.5);
  B.sad = Math.max(0, B.sad - dt * 0.7);
  B.joy = Math.max(0, B.joy - dt * 1.9);
  B.digest = Math.max(0, B.digest - dt * 1.5);
  B.gulp = Math.max(0, B.gulp - dt * 3.4);
  B.cool = Math.max(0, B.cool - dt * B.rate);
  B.blocked = Math.max(0, B.blocked - dt * 2);
  B.wobT += dt * (1.6 + B.excite * 5 + B.joy * 3);
  B.blinkT -= dt;
  if (B.blinkT <= 0) { B.blinkT = rr(2.2, 5.5); B.blink = 0.16; }
  B.blink = Math.max(0, B.blink - dt);

  let ax = 0, ay = 0, maxV = 460;

  // TODO: refactor this more.
  switch (B.state) {
    case 'follow': {
      ({ ax, ay, maxV } = getBuddyFollowVector(t, B));
      break;
    }
    case 'wind': {
      ({ ax, ay } = calculateWindBackAcceleration(B, dt));
      break;
    }
    case 'lunge': {
      ({ ax, ay, maxV } = calculateLungeAcceleration(ax, B, ay, maxV, dt));
      break;
    }
    case 'return': {
      ({ ax, ay, maxV } = calculateBuddyReturnAcceleration(t, ax, B, ay, maxV, dt));
      break;
    }
  }

  if (B.state !== 'wind' && B.state !== 'lunge') B.squash = lerp(B.squash, 0, dt * 7);

  B.vx += ax * dt; B.vy += ay * dt;
  const sp = Math.hypot(B.vx, B.vy);
  if (sp > maxV) { B.vx = (B.vx / sp) * maxV; B.vy = (B.vy / sp) * maxV; }

  const px = B.x, py = B.y;
  B.x += B.vx * dt;
  B.y += B.vy * dt;

  /* LETHAL PATH: whatever the body swept through this frame is destroyed */
  if (live && B.state === 'lunge') sweepHits(B, px, py, B.x, B.y);

  /* vessel walls - a lunge into the endothelium is aborted, hard */
  const pen = Maze.resolve(B, B.r * 0.8, 0.3);
  if (pen > 1 && B.state === 'lunge') {
    B.state = 'return'; B.st = 0; B.squash = -0.25;
    B.cool = CFG.buddy.cool;
    SFX.bump();
    for (let k = 0; k < 6; k++) {
      const a = rr(0, TAU);
      spawnPart(B.x + Math.cos(a) * B.r, B.y + Math.sin(a) * B.r, Math.cos(a) * 120, Math.sin(a) * 120,
        rr(2, 5), rr(0.2, 0.45), 348, 55, 72, 0, 3);
    }
  }

  if (sp > 40) B.dirA = lerpAngle(B.dirA, Math.atan2(B.vy, B.vx), Math.min(1, dt * 10));

  /* size breathing + digest bulge */
  const want = CFG.buddy.r * (1 + Math.sin(B.wobT * 1.4) * 0.03 + B.digest * 0.16 + B.gulp * 0.2 + B.excite * 0.07);
  B.r = lerp(B.r, want, Math.min(1, dt * 10));

  /* eyes track the shot, or you */
  const lx = B.state === 'lunge' || B.state === 'wind' ? B.dirX : (player.x - B.x);
  const ly = B.state === 'lunge' || B.state === 'wind' ? B.dirY : (player.y - B.y);
  const ld = Math.hypot(lx, ly) || 1;
  B.lookX = lerp(B.lookX, lx / ld, Math.min(1, dt * 9));
  B.lookY = lerp(B.lookY, ly / ld, Math.min(1, dt * 9));
}
function calculateBuddyReturnAcceleration(t, ax, B, ay, maxV, dt) {
  const p = buddyFollowPoint(t);
  ax = (p.x - B.x) * 46 - B.vx * 11;
  ay = (p.y - B.y) * 46 - B.vy * 11;
  maxV = 620;
  B.squash = lerp(B.squash, 0, dt * 8);
  if (B.st > 0.22 && Math.hypot(p.x - B.x, p.y - B.y) < 110) { B.state = 'follow'; B.st = 0; }
  return { ax, ay, maxV };
}

function calculateLungeAcceleration(ax, B, ay, maxV, dt) {
  ax = B.dirX * CFG.buddy.lungeAcc - B.vx * 1.6;
  ay = B.dirY * CFG.buddy.lungeAcc - B.vy * 1.6;
  maxV = CFG.buddy.lungeMax;
  B.dirA = Math.atan2(B.dirY, B.dirX);
  B.squash = lerp(B.squash, 0.34, dt * 16);
  B.flight += dt;
  B.trailT -= dt;
  if (B.trailT <= 0) {
    B.trailT = 0.018;
    spawnPart(B.x + rr(-6, 6), B.y + rr(-6, 6), -B.vx * 0.12, -B.vy * 0.12,
      rr(6, 13), rr(0.22, 0.4), 190, 40, 92, 0, 3);
  }
  /* past the far end, or out of patience */
  const travelled = (B.x - B.lungeX) * B.dirX + (B.y - B.lungeY) * B.dirY;
  const total = (B.endX - B.lungeX) * B.dirX + (B.endY - B.lungeY) * B.dirY;
  if (travelled >= total - 2 || B.flight > CFG.buddy.maxFlight) {
    B.state = 'return';
    B.st = 0;
    B.cool = CFG.buddy.cool;
    if (B.hits > 0) { B.digest = 1; B.gulp = 1; B.joy = 1; }
  }
  return { ax, ay, maxV };
}

function calculateWindBackAcceleration(B, dt) {
  /* rear back along the firing axis, so the launch reads */
  const ax = -B.dirX * 1500 - B.vx * 6;
  const ay = -B.dirY * 1500 - B.vy * 6;
  B.squash = lerp(B.squash, -0.3, dt * 14);
  if (B.st > CFG.buddy.windup) {
    B.state = 'lunge';
    B.st = 0;
    B.flight = 0;
    B.lungeX = B.x; B.lungeY = B.y;
    /* recompute the reach from where the wind-up actually left us */
    const reach = shotReach(B.x, B.y, B.dirX, B.dirY);
    B.endX = B.x + B.dirX * reach;
    B.endY = B.y + B.dirY * reach;
  }
  return { ax, ay };
}

function getBuddyFollowVector(t, B) {
  const p = buddyFollowPoint(t);
  const ax = (p.x - B.x) * CFG.buddy.k - B.vx * CFG.buddy.d;
  const ay = (p.y - B.y) * CFG.buddy.k - B.vy * CFG.buddy.d;
  const maxV = 700;
  return { ax, ay, maxV };
}

