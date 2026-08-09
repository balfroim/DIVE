/**
 * The in-dive HUD.
 *
 * Drawn in UI space (screen pixels scaled by `View.ui`) rather than world
 * space, so text stays crisp at every zoom level.
 *
 * @module render/hud
 */

import { CFG } from '../core/config.js';
import { TAU, clamp, easeOutBack } from '../core/math.js';
import { View } from '../core/view.js';
import { SFX } from '../core/audio.js';
import { Input } from '../core/input.js';
import { Maze } from '../world/maze.js';
import { player } from '../entities/player.js';
import { buddy } from '../entities/buddy.js';
import { Game } from '../game/state.js';
import { Career } from '../game/career.js';
import { roundRect } from './cells.js';
import { drawBody, drawDepthGauge, drawNetwork } from './minimap.js';

function panelBox(ctx, x, y, w, h, a) {
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = 'rgba(14,3,8,' + (a === undefined ? 0.55 : a) + ')';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,120,160,0.22)';
  ctx.stroke();
}

function bar(ctx, x, y, w, h, v, col, bgcol) {
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bgcol || 'rgba(255,255,255,0.09)';
  ctx.fill();
  if (v > 0) {
    ctx.save();
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.clip();
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w * clamp(v, 0, 1), h);
    ctx.restore();
  }
}

function diamond(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
}

/** The scan pulse, drawn in world space. */
export function drawScanFX() {
  if (!Game.scanning && Game.scanFade <= 0) return;
  const ctx = View.ctx;
  const r = Game.scanR;
  const a = Game.scanning ? 1 : Game.scanFade;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(player.x, player.y);
  const grd = ctx.createRadialGradient(0, 0, r * 0.75, 0, 0, r);
  grd.addColorStop(0, 'rgba(90,220,255,0)');
  grd.addColorStop(0.85, 'rgba(120,235,255,' + 0.1 * a + ')');
  grd.addColorStop(1, 'rgba(190,250,255,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = 'rgba(160,245,255,' + 0.75 * a + ')';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}

export function drawHUD(t) {
  const ctx = View.ctx;
  const G = Game;
  if (!G.contract) return;
  ctx.setTransform(View.dpr * View.ui, 0, 0, View.dpr * View.ui, 0, 0);
  const W = View.w / View.ui;
  const H = View.h / View.ui;
  const compact = W < 620;
  const playing = G.state === 'play';
  const run = G.run;

  ctx.textBaseline = 'alphabetic';

  /* ---- integrity, top centre ------------------------------------------ */
  const bw = Math.min(340, W * 0.42);
  const bx = W / 2 - bw / 2;
  const by = 14;
  ctx.textAlign = 'center';
  bar(ctx, bx, by, bw, 13, run.integrity / 100,
    run.integrity > 55 ? '#4ce0a4' : run.integrity > 26 ? '#ffc86b' : '#ff6b7d');
  ctx.font = '800 10px ui-monospace,Menlo,monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText(Math.max(0, Math.ceil(run.integrity)) + '%', W / 2, by + 10);

  ctx.font = '700 9px ui-monospace,Menlo,monospace';
  ctx.fillStyle = 'rgba(255,220,232,0.72)';
  ctx.fillText(
    G.contract.id + '  \u00b7  WAVE ' + G.wave + '/' + G.waveTotal +
    '  \u00b7  DEPTH ' + (G.row + 1) + '/' + Maze.rows +
    '  \u00b7  THREATS ' + G.countPathogens(),
    W / 2, by + 28
  );

  if (G.corruptN > 0) {
    const p = 0.55 + 0.45 * Math.sin(t * 7);
    ctx.font = '800 10px ui-monospace,Menlo,monospace';
    ctx.fillStyle = 'rgba(120,255,150,' + (0.55 + p * 0.45) + ')';
    ctx.fillText('\u26a0 CORRUPTION \u00d7' + G.corruptN + '  \u2014  INTEGRITY BLEEDING', W / 2, by + 44);
  }

  /* ---- money, top right ------------------------------------------------ */
  ctx.textAlign = 'right';
  const net = run.bounty - run.damages;
  ctx.font = '800 ' + (compact ? 19 : 24) + 'px ui-monospace,Menlo,monospace';
  ctx.fillStyle = net < 0 ? '#ff6b7d' : '#ffd97a';
  ctx.fillText((net < 0 ? '\u2212' : '') + Math.abs(net) + ' cr', W - 12, 30);
  if (run.combo > 1) {
    ctx.font = '800 12px ui-monospace,Menlo,monospace';
    ctx.fillStyle = 'rgba(255,194,90,' + (0.75 + clamp(G.comboFlash, 0, 1) * 0.25) + ')';
    ctx.fillText('COMBO ' + run.combo, W - 12, 46);
  } else if (!compact) {
    ctx.font = '700 9px ui-monospace,Menlo,monospace';
    ctx.fillStyle = 'rgba(255,220,232,0.55)';
    ctx.fillText('BANK ' + Math.round(Career.credits) + ' cr', W - 12, 45);
  }

  /* ---- body chart + network map, right ---------------------------------- */
  if (!compact || H > 520) {
    const mw = compact ? 96 : 118;
    const mh = compact ? 92 : 112;
    const mx = W - mw - 12;
    const my = compact ? 58 : 62;
    panelBox(ctx, mx - 6, my - 6, mw + 12, mh + 26, 0.42);
    drawBody(ctx, mx, my, mw * 0.44, mh, G.contract.organ, 0.5 + 0.5 * Math.sin(t * 2.4));
    drawDepthGauge(ctx, mx + mw * 0.47, my + 4, 5, mh - 8,
      Maze.depthFrac(player.y), G.row, Maze.rows - 1);
    drawNetwork(ctx, mx + mw * 0.56, my, mw * 0.44, mh, player.x, player.y);
    ctx.textAlign = 'center';
    ctx.font = '700 8px ui-monospace,Menlo,monospace';
    ctx.fillStyle = 'rgba(255,220,232,0.6)';
    ctx.fillText(G.contract.organ.short + ' \u00b7 ' + G.contract.pressure.toFixed(2) + ' P',
      mx + mw / 2, my + mh + 12);
  }

  /* ---- the buddy's firing line status, left ---------------------------- */
  const fp = G.nextMark();
  if (fp) {
    ctx.textAlign = 'left';
    ctx.font = '800 9px ui-monospace,Menlo,monospace';
    const blocked = buddy.blocked > 0.2;
    ctx.fillStyle = blocked ? 'rgba(255,140,160,0.9)' : 'rgba(140,255,205,0.75)';
    ctx.fillText(blocked ? '\u2716 NO FIRING LINE \u2014 REPOSITION' : '\u25b6 LINE CLEAR', 12, 30);
  }

  /* ---- scan charges, bottom left --------------------------------------- */
  ctx.textAlign = 'left';
  const sx = 12;
  const sy = H - 26;
  const dry = Career.scans <= 0;
  ctx.font = '800 8.5px ui-monospace,Menlo,monospace';
  ctx.fillStyle = dry ? '#ff8095' : '#7fdcff';
  ctx.fillText(
    dry ? 'NO SCAN CHARGES \u2014 GUESS OR BUY'
        : 'SCAN CHARGES  [' + (Input.touch.enabled ? 'SCAN' : 'E') + ']  \u00b7  ' + G.scanPrice() + ' cr',
    sx, sy - 8
  );
  const shown = Math.min(Career.scans, 8);
  for (let i = 0; i < Math.max(shown, 3); i++) {
    const x = sx + 7 + i * 17;
    const y = sy + 4;
    diamond(ctx, x, y, 6);
    if (i < shown) {
      ctx.fillStyle = G.scanning && i === shown - 1 ? '#ffffff' : '#5ad2f5';
      ctx.fill();
    } else {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.stroke();
    }
  }
  if (Career.scans > 8) {
    ctx.font = '800 10px ui-monospace,Menlo,monospace';
    ctx.fillStyle = '#5ad2f5';
    ctx.fillText('\u00d7' + Career.scans, sx + 7 + 8 * 17, sy + 8);
  }

  /* ---- marks, bottom centre -------------------------------------------- */
  ctx.textAlign = 'center';
  const mn = G.marks.length;
  for (let i = 0; i < CFG.maxMarks; i++) {
    const x = W / 2 - (CFG.maxMarks - 1) * 11 + i * 22;
    const y = H - 20;
    diamond(ctx, x, y, 6);
    if (i < mn) { ctx.fillStyle = 'rgba(255,190,70,0.95)'; ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.2; ctx.stroke(); }
  }
  ctx.font = '700 8px ui-monospace,Menlo,monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('MARKS', W / 2, H - 4);

  if (SFX.muted) {
    ctx.textAlign = 'right';
    ctx.font = '700 8.5px ui-monospace,Menlo,monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('MUTED  [M]', W - 12, H - 8);
  }

  /* ---- touch controls --------------------------------------------------- */
  if (Input.touch.enabled && playing) {
    const bxx = W - 62;
    const byy = H - 62;
    const br = 38;
    const btn = Input.touch.scanBtn;
    btn.x = bxx * View.ui;
    btn.y = byy * View.ui;
    btn.r = br * View.ui;
    ctx.save();
    ctx.beginPath();
    ctx.arc(bxx, byy, br, 0, TAU);
    ctx.fillStyle = G.scanning ? 'rgba(110,232,255,0.30)' : dry ? 'rgba(60,10,20,0.55)' : 'rgba(20,6,12,0.5)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = dry ? 'rgba(255,90,110,0.7)' : 'rgba(120,232,255,0.8)';
    ctx.stroke();
    ctx.fillStyle = dry ? '#ff8f9f' : '#cdf6ff';
    ctx.font = '800 10px ui-monospace,Menlo,monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SCAN', bxx, byy - 1);
    ctx.font = '800 13px ui-monospace,Menlo,monospace';
    ctx.fillText(String(Career.scans), bxx, byy + 13);
    ctx.restore();

    const st = Input.touch.stick;
    const ox = st.on ? st.ox / View.ui : W * 0.14;
    const oy = st.on ? st.oy / View.ui : H - 74;
    ctx.save();
    ctx.globalAlpha = st.on ? 0.85 : 0.35;
    ctx.beginPath();
    ctx.arc(ox, oy, 52, 0, TAU);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,180,205,0.6)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(st.on ? st.x / View.ui : ox, st.on ? st.y / View.ui : oy, 21, 0, TAU);
    ctx.fillStyle = 'rgba(255,180,205,0.30)';
    ctx.fill();
    ctx.restore();
  }

  drawBanner(t);
}

function drawBanner() {
  const G = Game;
  if (!G.banner || G.bannerT <= 0) return;
  const ctx = View.ctx;
  const W = View.w / View.ui;
  const H = View.h / View.ui;
  const u = 1 - G.bannerT / 2.4;
  const a = u < 0.1 ? u / 0.1 : u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1;
  const sc = u < 0.18 ? easeOutBack(u / 0.18) : 1;
  ctx.save();
  ctx.translate(W / 2, H * 0.3);
  ctx.scale(sc, sc);
  ctx.globalAlpha = clamp(a, 0, 1);
  ctx.textAlign = 'center';
  ctx.font = '800 28px ui-monospace,Menlo,monospace';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(8,2,5,0.7)';
  ctx.strokeText(G.banner.a, 0, 0);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(G.banner.a, 0, 0);
  if (G.banner.b) {
    ctx.font = '700 11px ui-monospace,Menlo,monospace';
    ctx.strokeText(G.banner.b, 0, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(G.banner.b, 0, 20);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
