/**
 * The white blood cell: squash, stretch, cilia, eyes and the swallow bulge.
 * Most of the game's charm lives in this file.
 * @module render/buddy
 */

import { TAU, PI, rr, lerp, clamp, hsl, easeOut } from '../core/math.js';
import { View, cam } from '../core/view.js';
import { CFG } from '../core/config.js';
import { buddy } from '../entities/buddy.js';
import { player } from '../entities/player.js';
import { glowSprite, drawGlow } from './sprites.js';
import { drawEntityBody } from './cells.js';

/** Scratch vertex buffers for the body blob - reused every frame, never allocated. */
const _px = new Float32Array(32), _py = new Float32Array(32);

export function drawBuddy(t) {
  const B = buddy;
  const ang = B.dirA;
  const stretch = 1 + B.squash, squash = 1 / (1 + B.squash * 0.85);

  /* glow */
  View.ctx.globalCompositeOperation = 'lighter';
  drawGlow(glowSprite(B.sad > 0.2 ? 355 : 190, B.sad > 0.2 ? 70 : 40, 88), B.x, B.y, B.r * (3.0 + B.joy * 0.7), 0.30 + B.joy * 0.18 + B.excite * 0.1);
  View.ctx.globalCompositeOperation = 'source-over';

  View.ctx.save();
  View.ctx.translate(B.x, B.y);
  View.ctx.save();
  View.ctx.rotate(ang);
  View.ctx.scale(stretch, squash);
  View.ctx.rotate(-ang);

  /* body blob */
  const N = 20;
  const wobA = 0.045 + B.excite * 0.075 + B.joy * 0.05;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    let rad = B.r * (1 + wobA * Math.sin(a * 3 + B.wobT * 3.1) + wobA * 0.7 * Math.sin(a * 5 - B.wobT * 2.3));
    if (B.state === 'lunge') rad *= 1 + 0.14 * Math.cos(a - ang);
    if (B.gulp > 0) rad *= 1 + 0.12 * B.gulp * Math.cos(a - ang + PI);
    _px[i] = Math.cos(a) * rad;
    _py[i] = Math.sin(a) * rad;
  }
  View.ctx.beginPath();
  View.ctx.moveTo((_px[N - 1] + _px[0]) / 2, (_py[N - 1] + _py[0]) / 2);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    View.ctx.quadraticCurveTo(_px[i], _py[i], (_px[i] + _px[j]) / 2, (_py[i] + _py[j]) / 2);
  }
  View.ctx.closePath();

  const tint = B.sad > 0.15 ? 1 : 0;
  const g = View.ctx.createRadialGradient(-B.r * 0.3, -B.r * 0.35, B.r * 0.1, 0, 0, B.r * 1.25);
  if (tint) {
    g.addColorStop(0, 'rgba(255,238,240,0.97)');
    g.addColorStop(0.6, 'rgba(255,190,200,0.85)');
    g.addColorStop(1, 'rgba(240,120,140,0.7)');
  } else {
    g.addColorStop(0, 'rgba(255,255,255,0.97)');
    g.addColorStop(0.55, 'rgba(226,244,255,0.88)');
    g.addColorStop(1, 'rgba(158,206,238,0.72)');
  }
  View.ctx.fillStyle = g;
  View.ctx.fill();
  View.ctx.lineWidth = 2.2;
  View.ctx.strokeStyle = tint ? 'rgba(255,150,170,0.9)' : 'rgba(255,255,255,0.9)';
  View.ctx.stroke();

  /* cytoplasm granules */
  View.ctx.save();
  View.ctx.clip();
  for (let i = 0; i < 7; i++) {
    const a = B.wobT * (0.3 + i * 0.07) + i * 1.7;
    const rd = B.r * (0.2 + (i % 3) * 0.22);
    View.ctx.beginPath();
    View.ctx.arc(Math.cos(a) * rd, Math.sin(a * 1.2) * rd, B.r * (0.06 + (i % 2) * 0.05), 0, TAU);
    View.ctx.fillStyle = 'rgba(170,215,245,0.5)';
    View.ctx.fill();
  }
  /* nucleus (multi-lobed) */
  View.ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = B.wobT * 0.4 + i * TAU / 3;
    View.ctx.moveTo(Math.cos(a) * B.r * 0.3 + B.r * 0.22, Math.sin(a) * B.r * 0.3);
    View.ctx.arc(Math.cos(a) * B.r * 0.3, Math.sin(a) * B.r * 0.3, B.r * 0.24, 0, TAU);
  }
  View.ctx.fillStyle = tint ? 'rgba(240,170,190,0.55)' : 'rgba(178,214,244,0.6)';
  View.ctx.fill();

  /* swallowed prey */
  if (B.eatE && B.eatScale > 0) {
    const e = B.eatE;
    View.ctx.save();
    View.ctx.scale(B.eatScale, B.eatScale);
    View.ctx.globalAlpha = 0.8;
    drawEntityBody(View.ctx, e, t);
    View.ctx.restore();
    View.ctx.globalAlpha = 1;
  }
  View.ctx.restore();
  View.ctx.restore();

  /* eyes */
  const lx = B.lookX, ly = B.lookY;
  const px = -ly, py = lx;
  const eo = B.r * 0.40, fwd = B.r * 0.40;
  const eyeR = B.r * 0.155 * (B.blink > 0 ? 0.18 : 1) * (1 + B.joy * 0.2);
  for (let s = -1; s <= 1; s += 2) {
    const ex = px * eo * s + lx * fwd, ey = py * eo * s + ly * fwd;
    View.ctx.beginPath();
    View.ctx.ellipse(ex, ey, B.r * 0.155 * (1 + B.excite * 0.25), eyeR, 0, 0, TAU);
    View.ctx.fillStyle = 'rgba(26,42,64,0.92)';
    View.ctx.fill();
    if (B.blink <= 0) {
      View.ctx.beginPath();
      View.ctx.arc(ex - lx * B.r * 0.02 + B.r * 0.04, ey - B.r * 0.045, B.r * 0.05, 0, TAU);
      View.ctx.fillStyle = 'rgba(255,255,255,0.85)';
      View.ctx.fill();
    }
    if (B.sad > 0.15) {
      View.ctx.beginPath();
      View.ctx.moveTo(ex - B.r * 0.2, ey - B.r * 0.22);
      View.ctx.lineTo(ex + B.r * 0.2, ey - B.r * 0.10);
      View.ctx.lineWidth = 2;
      View.ctx.strokeStyle = 'rgba(190,60,90,0.9)';
      View.ctx.stroke();
    }
  }
  View.ctx.restore();

  /* targeting thread */
  if ((B.state === 'wind' || B.state === 'lunge') && B.target && B.target.on && !B.target.dying) {
    View.ctx.save();
    View.ctx.setLineDash([4, 6]);
    View.ctx.lineDashOffset = -t * 40;
    View.ctx.lineWidth = 1.4;
    View.ctx.strokeStyle = 'rgba(255,190,70,0.55)';
    View.ctx.beginPath();
    View.ctx.moveTo(B.x, B.y);
    View.ctx.lineTo(B.target.x, B.target.y);
    View.ctx.stroke();
    View.ctx.setLineDash([]);
    View.ctx.restore();
  }

  /* cooldown ring */
  if (B.cool > 0) {
    View.ctx.save();
    View.ctx.translate(B.x, B.y);
    View.ctx.lineWidth = 2.4;
    View.ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    View.ctx.beginPath();
    View.ctx.arc(0, 0, B.r + 8, -PI / 2, -PI / 2 + TAU * (1 - B.cool / CFG.buddy.cool));
    View.ctx.stroke();
    View.ctx.restore();
  }
}

