/**
 * The dive: run state, the state machine, and the rules the simulation calls
 * back into.
 *
 * Screen flow
 *   start -> dialog -> board -> brief -> play -> results -> shop -> board ...
 *   ...and when the diver does not come back up: -> over (the career closes)
 *
 * Wave model
 *   Each maze row holds one wave. Entering a row's chamber for the first time
 *   spawns it; clearing every hostile in it opens the valves to the next row.
 *   So "depth" is not decoration - it is the win condition.
 *
 * Two clocks run against you: client integrity (they die) and your oxygen tank
 * (you die). The siphon converts one into the other, at a price.
 *
 * @module game/state
 */

import { CFG, pressureProfile } from '../core/config.js';
import { clamp, lerp, rr } from '../core/math.js';
import { SFX } from '../core/audio.js';
import { View, cam, s2wx, s2wy, updateQuality } from '../core/view.js';
import { Input, pollHold } from '../core/input.js';
import { Maze } from '../world/maze.js';
import { hashSeed } from '../core/rng.js';
import { runSystems } from '../ecs/systems.js';
import { ents, spawnEnt, morphEnt, clearEnts, countEnts } from '../entities/pool.js';
import '../entities/systems.js';   // registers the pipeline
import { player, playerReset } from '../entities/player.js';
import {
  buddy, buddyReset, fireBuddy, canFire, fireCharge, shotReach, shotCasualties
} from '../entities/buddy.js';
import { installRules } from '../entities/hooks.js';
import { burst, ringPart, popup, updateParts } from '../entities/particles.js';
import { contractType } from '../data/contract-types.js';
import { Career } from './career.js';
import { bounty, buildInvoice, repDelta, scanPrice, tierMul, siphonRepCost } from './economy.js';
import { scatter, updateBG } from '../render/ambience.js';

/** Fresh per-dive tallies. */
function blankRun() {
  return {
    bounty: 0, damages: 0, scansUsed: 0, pathKills: 0, innocent: 0, symKills: 0,
    corruptEvents: 0, shots: 0, integrity: 100, combo: 0, comboT: 0,
    runTime: 0,
    /** Oxygen, in seconds. */
    o2: CFG.o2.tank, o2max: CFG.o2.tank,
    /** How many times the client was drained. */
    siphons: 0, siphonO2: 0, siphonDamage: 0,
    /** Set when the diver suffocated. */
    died: false
  };
}

export const Game = {
  state: 'start',
  t: 0,
  contract: null,
  run: blankRun(),

  /* dive progress */
  wave: 0,
  waveTotal: 0,
  row: 0,
  deepest: 0,
  rows: [],
  corruptN: 0,
  clotN: 0,

  /* feedback */
  hitStop: 0,
  banner: null,
  bannerT: 0,
  comboFlash: 0,
  o2Warned: 0,
  marks: [],

  /* aiming - there is no target acquisition, only a direction */
  aimX: 0, aimY: 0, aimDX: 1, aimDY: 0, aimValid: false,

  /* scanning */
  scanning: false,
  scanR: 0,
  scanFade: 0,
  scanPrev: false,
  pingT: 0,

  /* the siphon */
  siphonCd: 0,
  siphonFx: 0,

  /** Set by ui/screens.js so the simulation can raise screen changes. */
  ui: null,
  /** Idempotency guard so an invoice is only ever settled once. */
  _settled: false,

  /* ---------------------------------------------------------------- */
  /* difficulty + pricing                                              */
  /* ---------------------------------------------------------------- */

  diff() { return this.contract ? this.contract.diff : 1; },
  tierMul() { return this.contract ? tierMul(this.contract.tier.i) : 1; },
  scanPrice() { return scanPrice(this.tierMul(), 0); },
  env() { return this.contract ? this.contract.env : pressureProfile(1); },
  type() { return contractType(this.contract ? this.contract.type : 'purge'); },

  /* ---------------------------------------------------------------- */
  /* contract lifecycle                                                */
  /* ---------------------------------------------------------------- */

  /** Build the vessel network and drop the diver in at the entry. */
  startContract(contract) {
    this.contract = contract;
    this.run = blankRun();
    this._settled = false;
    this.t = 0;
    this.wave = 0;
    this.row = 0;
    this.deepest = 0;
    this.corruptN = 0;
    this.clotN = 0;
    this.scanning = false;
    this.scanR = 0;
    this.scanFade = 0;
    this.hitStop = 0;
    this.siphonCd = 0;
    this.siphonFx = 0;
    this.o2Warned = 0;
    this.marks = [];

    Maze.build({
      seed: contract.seed ^ hashSeed(contract.id),
      rows: contract.rows,
      cols: contract.cols,
      bore: contract.env.bore,
      organName: contract.organ.short,
      hue: contract.organ.hue
    });
    Maze.sealAll();

    this.waveTotal = contract.waves;
    this.rows = [];
    for (let r = 0; r < Maze.rows; r++) this.rows.push({ spawned: false, cleared: false });

    clearEnts();
    playerReset(Maze.entry.x, Maze.entry.y);
    player.suit = Career.suit;
    buddyReset();
    buddy.rate = Career.fireRate();
    cam.x = player.x;
    cam.y = player.y;
    scatter();

    /* the client's own cells, scattered through the network to be protected */
    const T = this.type();
    const hosts = T.hostCount(contract.diff);
    for (let r = 0; r < Maze.rows; r++) {
      for (let i = 0; i < Math.ceil(hosts / Maze.rows) + 1; i++) {
        spawnEnt(contract.hostArch, contract.sig, 1, { ...this.spawnOpts(r), strictRow: true });
      }
    }

    this.run.o2max = Career.o2Max();
    this.run.o2 = this.run.o2max;
    this.run.integrity = clamp(100 + (Career.stab > 0 ? 20 : 0), 0, 120);
    this.state = 'play';
    this.enterRow(0);
    this.setBanner('DIVE ' + contract.id, contract.organ.name.toUpperCase() + ' \u00b7 DEPTH ' + contract.rows);
  },

  /** Common spawn options, including the contract's blood groups. */
  spawnOpts(row, away, awayD) {
    const c = this.contract;
    return {
      row, now: this.t, away: away || null, awayD: awayD || 0,
      abo: c ? c.abo : '', donorAbo: c ? c.donorAbo : ''
    };
  },

  /** First arrival in a row: spawn its wave from the contract type's spec. */
  enterRow(r) {
    if (r < 0 || r >= this.rows.length) return;
    const R = this.rows[r];
    if (R.spawned) return;
    R.spawned = true;
    this.wave = Math.max(this.wave, r + 1);
    const c = this.contract;
    const T = this.type();

    const n = T.threatCount(c.diff, r);
    for (let i = 0; i < n; i++) {
      spawnEnt(c.targetSpecies, c.sig, c.deviation, { ...this.spawnOpts(r, player, 240), strictRow: true });
    }

    for (const ex of T.extras) {
      if (ex.minRow !== undefined && r < ex.minRow) continue;
      if (ex.minDiff !== undefined && c.diff < ex.minDiff) continue;
      if (Math.random() >= ex.chance) continue;
      const id = typeof ex.arch === 'function' ? ex.arch(c) : ex.arch;
      const dev = clamp(c.deviation + (ex.devBonus || 0), 0, 1);
      spawnEnt(id, c.sig, dev, { ...this.spawnOpts(r, player, ex.awayD || 200), strictRow: true });
    }

    if (r > 0) {
      SFX.wave();
      this.setBanner('WAVE ' + (r + 1) + ' / ' + this.waveTotal,
        r === this.rows.length - 1 ? 'TARGET CHAMBER \u00b7 ' + Maze.organName : 'JUNCTION SEALED \u00b7 CLEAR IT');
    }
  },

  /** Hostiles still alive that belong to a row. */
  rowThreats(r) {
    return countEnts((e) => !!e.comp.hostile && e.row === r);
  },

  /** Any hostile anywhere - used for the corruption cap and the HUD. */
  countPathogens() { return countEnts((e) => !!e.comp.hostile); },
  countCorrupt() { return countEnts((e) => e.arch === 'corrupted'); },
  countClots() { return countEnts((e) => e.comp.agglutinate && e.clumpN >= e.comp.agglutinate.min); },

  /** Compatibility helper used by the HUD and older tests. */
  nextMark() {
    const cands = ents.filter((e) => e.on && !e.dying && e.comp && e.comp.hostile && !e.marked);
    return cands[0] || null;
  },

  /** Check whether the current row is clear and open the way down. */
  checkRow(r) {
    const R = this.rows[r];
    if (!R || !R.spawned || R.cleared) return;
    if (this.rowThreats(r) > 0) return;
    R.cleared = true;
    const opened = Maze.openRow(r);
    if (r >= this.rows.length - 1) {
      this.finish(true);
      return;
    }
    if (opened) {
      SFX.valve();
      this.setBanner('VALVE RELEASED', 'DESCEND TO ROW ' + (r + 2));
      popup(player.x, player.y - 54, 'WAY DOWN OPEN', '#7dffc4', 16);
    }
  },

  /** End the dive. */
  finish(success) {
    if (this.state === 'results' || this._settled) return;
    const c = this.contract;
    const run = this.run;
    const result = buildInvoice(run, c, Career, success);
    result.success = success;
    result.repDelta = repDelta(c, run, success, Career);
    result.pathKills = run.pathKills;
    result.innocent = run.innocent;
    result.scansUsed = run.scansUsed;
    result.integrity = run.integrity;
    result.siphons = run.siphons;
    result.siphonRep = siphonRepCost(run.siphons, c.tier.i, 0);
    result.died = run.died;
    result.o2Left = Math.max(0, Math.round(run.o2));
    this.result = result;
    this._settled = true;

    Career.settle(result);
    /* consequences */
    if (run.died) Career.die('asphyxia');
    if (!success && c.tier.lethal && !run.died) Career.strikeOff('litigation');
    if (run.symKills > 0 && c.tier.lethal) Career.strikeOff('litigation');
    if (Career.credits < CFG.econ.debtFloor) Career.strikeOff('debt');
    Career.save();

    this.state = 'results';
    SFX.over();
    if (this.ui) this.ui.showResults(result);
  },

  /** Give up and surface. */
  abandon() {
    if (this.state !== 'play' && this.state !== 'pause') return;
    this.finish(false);
  },

  /** The tank ran dry. This is not a failed contract; this is a dead diver. */
  diverDeath(cause) {
    if (this.state !== 'play' || this._settled) return;
    this.run.died = true;
    this.run.o2 = 0;
    SFX.gasp();
    cam.trauma = 1;
    burst(player.x, player.y, 26, 190, 60, 90, 220, 3.4, 0);
    popup(player.x, player.y - 40, 'TANK EMPTY', '#ff6b7d', 20, cause || 'ASPHYXIA');
    this.finish(false);
  },

  /* ---------------------------------------------------------------- */
  /* aiming and firing - no target acquisition, just a line            */
  /* ---------------------------------------------------------------- */

  /** Where the player is pointing, in world space. */
  updateAim() {
    let sx = Input.mouse.x, sy = Input.mouse.y;
    if (Input.touch.enabled && Input.aim.on) { sx = Input.aim.x; sy = Input.aim.y; }
    if (!Input.mouse.active && !(Input.touch.enabled && Input.aim.on)) {
      /* no pointer yet: aim where the diver is facing */
      this.aimX = player.x + Math.cos(player.ang) * 200;
      this.aimY = player.y + Math.sin(player.ang) * 200;
    } else {
      this.aimX = s2wx(sx);
      this.aimY = s2wy(sy);
    }
    const dx = this.aimX - buddy.x, dy = this.aimY - buddy.y;
    const d = Math.hypot(dx, dy);
    if (d > 8) { this.aimDX = dx / d; this.aimDY = dy / d; this.aimValid = true; }
  },

  /** Pull the trigger. */
  fire() {
    if (this.state !== 'play') return false;
    if (!canFire()) return false;
    const ok = fireBuddy(this.aimDX, this.aimDY);
    if (ok) this.run.shots++;
    return ok;
  },

  updateFire(dt, live) {
    if (!live) { Input.wantFire = false; return; }
    if (Input.wantFire) {
      Input.wantFire = false;
      this.fire();
    }
  },

  /* ---------------------------------------------------------------- */
  /* the oxygen tank                                                   */
  /* ---------------------------------------------------------------- */

  /** Seconds of gas burned per second right now. */
  o2Rate() {
    const c = this.contract;
    const press = c ? Math.max(0, c.pressure - 1) : 0;
    return Career.o2Burn() * (CFG.o2.idle + CFG.o2.thrust * player.thrust + CFG.o2.pressure * press);
  },

  updateO2(dt, live) {
    this.siphonCd = Math.max(0, this.siphonCd - dt);
    this.siphonFx = Math.max(0, this.siphonFx - dt);
    if (!live) return;
    if (Input.wantSiphon) { Input.wantSiphon = false; this.siphon(); }
    const run = this.run;
    run.o2 -= this.o2Rate() * dt;
    if (run.o2 <= CFG.o2.critical && this.o2Warned < 2) {
      this.o2Warned = 2;
      SFX.gasp();
      this.setBanner('OXYGEN CRITICAL', 'SIPHON THE CLIENT OR SURFACE');
    } else if (run.o2 <= CFG.o2.warn && this.o2Warned < 1) {
      this.o2Warned = 1;
      SFX.err();
      this.setBanner('OXYGEN LOW', Math.round(run.o2) + ' SECONDS OF GAS');
    }
    if (run.o2 <= 0) this.diverDeath('ASPHYXIA');
  },

  /**
   * Take the client's oxygen. Clause nine. It works, it always works, and it
   * costs them integrity and you standing - scaled to how much they are worth.
   */
  siphon() {
    if (this.state !== 'play' || this._settled) return false;
    if (this.siphonCd > 0) {
      popup(player.x, player.y - 46, 'SIPHON RECHARGING', '#ffb46b', 13);
      return false;
    }
    const run = this.run;
    if (run.o2 >= run.o2max - 1) {
      popup(player.x, player.y - 46, 'TANK FULL', '#8fd9ff', 13);
      return false;
    }
    const gain = Math.min(CFG.o2.siphonGain, run.o2max - run.o2);
    const cost = Career.siphonCost();
    run.o2 += gain;
    run.siphonO2 += gain;
    run.integrity -= cost;
    run.siphonDamage += cost;
    run.siphons++;
    this.siphonCd = CFG.o2.siphonCool;
    this.siphonFx = CFG.o2.siphonDraw;
    this.o2Warned = 0;
    SFX.siphon();
    cam.trauma = Math.min(1, cam.trauma + 0.25);
    ringPart(player.x, player.y, 46, 8, 90, 62, 0.5, 3);
    popup(player.x, player.y - 46, '+' + Math.round(gain) + 's O\u2082', '#8fd9ff', 17,
      '\u2212' + cost + '% CLIENT');
    this.checkIntegrity();
    return true;
  },

  /** Reputation this dive's siphoning will cost at extraction. */
  siphonRepPending() {
    if (!this.contract) return 0;
    return siphonRepCost(this.run.siphons, this.contract.tier.i, 0);
  },

  /* ---------------------------------------------------------------- */
  /* pointing at things (for the diagnostic overlay only)              */
  /* ---------------------------------------------------------------- */

  /** Entity under a world point, if any. */
  pickEnt(wx, wy, pad) {
    let best = null, bd = 1e9;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (!e.on || e.dying) continue;
      const rad = e.r * e.elong + (pad || 0);
      const d = Math.hypot(e.x - wx, e.y - wy);
      if (d < rad && d < bd) { bd = d; best = e; }
    }
    return best;
  },

  hovered() {
    if (!Input.mouse.active || Input.touch.enabled) return null;
    return this.pickEnt(s2wx(Input.mouse.x), s2wy(Input.mouse.y), 14);
  },

  /* ---------------------------------------------------------------- */
  /* scanning - a consumable, billed per activation                    */
  /* ---------------------------------------------------------------- */

  fireScan() {
    if (this.scanning) return;
    if (Career.scans <= 0) {
      SFX.unmark();
      popup(player.x, player.y - 46, 'NO CHARGES', '#ff8095', 15, 'REQUISITION AT EXTRACTION');
      return;
    }
    Career.scans--;
    this.run.scansUsed++;
    this.scanning = true;
    this.scanR = 26;
    SFX.scan();
    ringPart(player.x, player.y, 30, 190, 95, 80, 0.5, 3);
  },

  updateScan(dt, live) {
    this.pingT -= dt;
    const held = Input.scanInput();
    if (live && (Input.scanTap || (held && !this.scanPrev))) this.fireScan();
    Input.scanTap = false;
    this.scanPrev = held;

    if (this.scanning) {
      this.scanR += (CFG.scan.maxR / CFG.scan.time) * dt;
      let pinged = 0;
      for (let i = 0; i < ents.length; i++) {
        const e = ents[i];
        if (!e.on || e.dying) continue;
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        /* the pulse cannot see through tissue - another reason corridors matter */
        if (d < this.scanR && this.t >= e.idUntil && Maze.lineClear(player.x, player.y, e.x, e.y, 0)) {
          e.idUntil = this.t + CFG.scan.idTime;
          e.idPing = 0.45;
          ringPart(e.x, e.y, e.r + 4, 190, 95, 72, 0.35, 2);
          pinged++;
        }
      }
      if (pinged && this.pingT <= 0) { SFX.ping(); this.pingT = 0.06; }
      if (this.scanR > CFG.scan.maxR) { this.scanning = false; this.scanFade = 1; }
    } else if (this.scanFade > 0) {
      this.scanFade = Math.max(0, this.scanFade - dt * 2.2);
    }
  },

  /* ---------------------------------------------------------------- */
  /* consequences                                                      */
  /* ---------------------------------------------------------------- */

  addCombo() {
    this.run.combo++;
    this.run.comboT = 3.2;
    this.comboFlash = 1;
  },

  /**
   * Something died on the firing line. There is no "intended target" any more:
   * the escort kills what the line touches, and the invoice does not care what
   * you meant.
   */
  applyKill(e, B) {
    const payMul = Career.payMul();
    this.hitStop = Math.max(this.hitStop, 0.045);
    cam.trauma = Math.min(1, cam.trauma + 0.26);
    burst(e.x, e.y, 14, e.hue, 85, 62, 160, 3.2, 0);

    const C = e.comp;
    if (C.bounty) {
      const gain = bounty(C.bounty.kind, {
        diff: this.diff(), combo: this.run.combo, payMul, mult: C.bounty.mult
      });
      this.run.bounty += gain;
      this.run.pathKills++;
      this.addCombo();
      popup(e.x, e.y - e.r - 16, '+' + gain + ' cr',
        C.bounty.kind === 'quarantine' ? '#ffd27d' : '#8affc8', 16);
      if (B) { B.joy = 1; B.excite = 1; }
    } else if (C.litigious) {
      const fine = Math.round(CFG.econ[C.litigious.fine] * this.tierMul());
      this.run.damages += fine;
      this.run.symKills++;
      this.run.integrity -= CFG.dmg[C.litigious.integrity];
      this.run.combo = 0;
      SFX.err();
      popup(e.x, e.y - e.r - 16, '\u2212' + fine + ' cr', '#ff7092', 18, C.litigious.label);
      if (B) B.sad = 1;
    } else if (C.property) {
      const fine = Math.round(CFG.econ[C.property.fine] * this.tierMul());
      if (Career.waiver > 0) {
        Career.waiver--;
        popup(e.x, e.y - e.r - 16, 'WAIVED', '#8fd9ff', 16, 'MALPRACTICE COVER');
      } else {
        this.run.damages += fine;
        this.run.integrity -= CFG.dmg[C.property.integrity];
        popup(e.x, e.y - e.r - 16, '\u2212' + fine + ' cr', '#ff7092', 17, C.property.label);
      }
      this.run.innocent++;
      this.run.combo = 0;
      SFX.err();
      player.hurt = 1;
      if (B) B.sad = 1;
    }

    e.dying = 1;
    SFX.engulf();
    this.checkIntegrity();
    /* a kill may have emptied the row */
    for (let r = 0; r < this.rows.length; r++) this.checkRow(r);
  },

  /** A host cell finished converting. The rules own the transformation. */
  onInfection(e) {
    const c = this.contract;
    const conv = e.comp.converts;
    if (!c || !conv) return;
    morphEnt(e, conv.into, c.sig, 1, { abo: c.abo, donorAbo: c.donorAbo });
    e.hurt = 1;
    const fee = Math.round(CFG.econ.deductInfect * this.tierMul());
    this.run.damages += fee;
    this.run.corruptEvents++;
    this.run.integrity -= CFG.dmg.infect;
    SFX.infect();
    popup(e.x, e.y - e.r - 14, '\u2212' + fee + ' cr', '#ffb46b', 15, 'CORRUPTION EVENT');
    this.checkIntegrity();
  },

  checkIntegrity() {
    if (this.run.integrity <= 0 && this.state === 'play') {
      this.run.integrity = 0;
      this.finish(false);
    }
  },

  /* ---------------------------------------------------------------- */
  /* frame                                                             */
  /* ---------------------------------------------------------------- */

  setBanner(a, b) {
    this.banner = { a, b };
    this.bannerT = 2.4;
  },

  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause';
    Input.scanHeld = false;
    Input.scanTap = false;
    Input.wantFire = false;
    Input.wantSiphon = false;
    if (this.ui) this.ui.showPause();
  },

  resume() {
    if (this.state !== 'pause') return;
    this.state = 'play';
    if (this.ui) this.ui.hideOverlays();
  },

  updateCamera(dt) {
    let tx = player.x + player.vx * 0.26;
    let ty = player.y + player.vy * 0.26;
    const b = Maze.bounds;
    const hw = View.w / 2 / View.zoom, hh = View.h / 2 / View.zoom;
    const w = b.maxX - b.minX, h = b.maxY - b.minY;
    tx = hw * 2 > w ? (b.minX + b.maxX) / 2 : clamp(tx, b.minX + hw, b.maxX - hw);
    ty = hh * 2 > h ? (b.minY + b.maxY) / 2 : clamp(ty, b.minY + hh, b.maxY - hh);
    cam.x = lerp(cam.x, tx, Math.min(1, dt * 5.5));
    cam.y = lerp(cam.y, ty, Math.min(1, dt * 5.5));
    const amp = cam.trauma * cam.trauma * 24;
    cam.sx = rr(-amp, amp);
    cam.sy = rr(-amp, amp);
  },

  /** Reusable frame context handed to every ECS system. */
  _ctx: { t: 0, dt: 0, live: false, env: null, diff: 1 },

  step(real) {
    pollHold();
    if (this.state === 'pause') {
      this.comboFlash = Math.max(0, this.comboFlash - real * 2);
      return;
    }
    let dt = real;
    if (this.hitStop > 0) { this.hitStop -= real; dt = real * 0.06; }
    const live = this.state === 'play';
    this.t += dt;
    if (live) this.run.runTime += dt;

    const ctx = this._ctx;
    ctx.t = this.t; ctx.dt = dt; ctx.live = live;
    ctx.env = this.env(); ctx.diff = this.diff();

    this.updateAim();
    runSystems(dt, ctx);
    updateParts(dt);
    updateBG(dt, this.t, ctx.env ? ctx.env.flow : 1);
    this.updateScan(dt, live);
    this.updateFire(dt, live);
    this.updateO2(dt, live);

    if (live) {
      /* depth tracking: which chamber are we in? */
      const node = Maze.nodeAt(player.x, player.y);
      if (node) {
        node.seen = true;
        this.row = node.r;
        if (node.r > this.deepest) this.deepest = node.r;
        this.enterRow(node.r);
        this.checkRow(node.r);
      }

      this.corruptN = this.countCorrupt();
      this.clotN = this.countClots();

      if (this.run.comboT > 0) {
        this.run.comboT -= dt;
        if (this.run.comboT <= 0) this.run.combo = 0;
      }
    }

    this.comboFlash = Math.max(0, this.comboFlash - dt * 2);
    this.bannerT = Math.max(0, this.bannerT - real);
    cam.trauma = Math.max(0, cam.trauma - real * 1.9);
    this.updateCamera(dt);
    updateQuality(real);
  },

  /* ---------------------------------------------------------------- */
  /* keyboard                                                          */
  /* ---------------------------------------------------------------- */

  onKey(code, k) {
    if (k === 'm') { SFX.toggle(); return; }
    if (this.ui && this.ui.onKey(code, k)) return;
    if (this.state === 'play') {
      if (code === 'Escape') this.pause();
      else if (code === 'Space') Input.wantFire = true;
      else if (k === 'f') Input.wantSiphon = true;
    } else if (this.state === 'pause' && code === 'Escape') {
      this.resume();
    }
  }
};

/* The simulation calls back into the rules through this seam. */
installRules({
  now: () => Game.t,
  difficulty: () => Game.diff(),
  signature: () => (Game.contract ? Game.contract.sig : null),
  pathogenCap: () => 6 + Game.wave + Math.floor(Game.diff()) - Game.countPathogens(),
  onInfection: (e) => Game.onInfection(e),
  onKill: (e, B) => Game.applyKill(e, B),
  onBleed: (amount) => {
    if (Game.state !== 'play') return;
    Game.run.integrity -= amount;
    Game.checkIntegrity();
  },
  onLunge: () => { cam.trauma = Math.min(1, cam.trauma + 0.08); },
  onBlocked: () => { cam.trauma = Math.min(1, cam.trauma + 0.04); }
});

/**
 * What the escort would destroy if you pulled the trigger right now.
 * The HUD draws exactly this, so what you see is what the simulation will do.
 */
const _cas = [];
export function firingPreview() {
  if (Game.state !== 'play' || !Game.contract) return null;
  const inFlight = buddy.state === 'lunge' || buddy.state === 'wind';
  const dx = inFlight ? buddy.dirX : Game.aimDX;
  const dy = inFlight ? buddy.dirY : Game.aimDY;
  const reach = shotReach(buddy.x, buddy.y, dx, dy);
  const x1 = buddy.x + dx * reach;
  const y1 = buddy.y + dy * reach;
  const cas = shotCasualties(buddy.x, buddy.y, x1, y1, _cas);
  let collateral = 0;
  for (let i = 0; i < cas.length; i++) if (!cas[i].comp.hostile) collateral++;
  return {
    x0: buddy.x, y0: buddy.y, x1, y1,
    reach,
    ready: canFire(),
    charge: fireCharge(),
    blocked: reach < buddy.r * 0.9,
    casualties: cas,
    collateral
  };
}
