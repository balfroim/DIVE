/**
 * The diver and the tether that links you to your white cell.
 * @module render/diver
 */

import { TAU, PI, rr, lerp, clamp, hsl } from '../core/math.js';
import { View, cam } from '../core/view.js';
import { player } from '../entities/player.js';
import { buddy } from '../entities/buddy.js';
import { glowSprite, drawGlow } from './sprites.js';

export function drawDiver(t) {
  const p = player;
  View.ctx.save();
  View.ctx.translate(p.x, p.y);

  /* helmet lamp cone */
  View.ctx.save();
  View.ctx.rotate(p.ang);
  View.ctx.globalCompositeOperation = 'lighter';
  const L = 210 + Math.sin(t * 7) * 7;
  const cg = View.ctx.createLinearGradient(0, 0, L, 0);
  cg.addColorStop(0, 'rgba(190,240,255,0.28)');
  cg.addColorStop(0.5, 'rgba(150,220,255,0.10)');
  cg.addColorStop(1, 'rgba(120,200,255,0)');
  View.ctx.fillStyle = cg;
  View.ctx.beginPath();
  View.ctx.moveTo(6, 0);
  View.ctx.lineTo(L, -L * 0.30);
  View.ctx.quadraticCurveTo(L * 1.06, 0, L, L * 0.30);
  View.ctx.closePath();
  View.ctx.fill();
  View.ctx.globalCompositeOperation = 'source-over';
  View.ctx.restore();

  View.ctx.rotate(p.ang + p.roll);
  const sc = 1;
  /* fins */
  const flap = Math.sin(p.flap) * (0.35 + Math.min(0.5, p.speed * 0.0016));
  for (let s = -1; s <= 1; s += 2) {
    View.ctx.save();
    View.ctx.translate(-11 * sc, 5 * s * sc);
    View.ctx.rotate(flap * s + s * 0.35);
    View.ctx.beginPath();
    View.ctx.ellipse(-8, 0, 10, 4.4, 0, 0, TAU);
    View.ctx.fillStyle = '#1d3252';
    View.ctx.fill();
    View.ctx.lineWidth = 1;
    View.ctx.strokeStyle = 'rgba(130,225,255,0.5)';
    View.ctx.stroke();
    View.ctx.restore();
  }
  /* tank */
  View.ctx.beginPath();
  View.ctx.ellipse(-8, 0, 7.5, 6.6, 0, 0, TAU);
  View.ctx.fillStyle = '#122239';
  View.ctx.fill();
  /* body */
  View.ctx.beginPath();
  View.ctx.ellipse(0, 0, 11, 7.6, 0, 0, TAU);
  const bg = View.ctx.createLinearGradient(0, -8, 0, 8);
  bg.addColorStop(0, '#2b4569');
  bg.addColorStop(1, '#101d31');
  View.ctx.fillStyle = bg;
  View.ctx.fill();
  View.ctx.lineWidth = 1.5;
  View.ctx.strokeStyle = p.hurt > 0 ? 'rgba(255,90,110,' + (0.5 + p.hurt * 0.5) + ')' : 'rgba(120,220,255,0.72)';
  View.ctx.stroke();
  /* arm */
  View.ctx.lineWidth = 2.4;
  View.ctx.lineCap = 'round';
  View.ctx.strokeStyle = '#22385a';
  View.ctx.beginPath();
  View.ctx.moveTo(3, 5);
  View.ctx.quadraticCurveTo(9, 8 + Math.sin(t * 3) * 1.4, 13, 5);
  View.ctx.stroke();
  View.ctx.lineCap = 'butt';
  /* helmet */
  View.ctx.beginPath();
  View.ctx.arc(7.5, 0, 7.2, 0, TAU);
  const hg = View.ctx.createRadialGradient(5, -3, 1, 7.5, 0, 8);
  hg.addColorStop(0, 'rgba(190,245,255,0.55)');
  hg.addColorStop(0.6, 'rgba(70,150,200,0.30)');
  hg.addColorStop(1, 'rgba(20,50,80,0.55)');
  View.ctx.fillStyle = hg;
  View.ctx.fill();
  View.ctx.lineWidth = 1.6;
  View.ctx.strokeStyle = 'rgba(160,240,255,0.9)';
  View.ctx.stroke();
  View.ctx.beginPath();
  View.ctx.arc(5.6, -2.6, 2.1, 0, TAU);
  View.ctx.fillStyle = 'rgba(255,255,255,0.55)';
  View.ctx.fill();
  /* lamp */
  View.ctx.beginPath();
  View.ctx.arc(13, 0, 2.5, 0, TAU);
  View.ctx.fillStyle = '#eaffff';
  View.ctx.fill();
  View.ctx.restore();

  /* lamp bloom */
  View.ctx.globalCompositeOperation = 'lighter';
  drawGlow(glowSprite(195, 90, 78), p.x + Math.cos(p.ang) * 13, p.y + Math.sin(p.ang) * 13, 26, 0.55);
  View.ctx.globalCompositeOperation = 'source-over';
}

export function drawTether() {
  const B = buddy, p = player;
  const dx = B.x - p.x, dy = B.y - p.y, d = Math.hypot(dx, dy);
  const slack = clamp(1 - d / 320, 0, 1);
  const mx = (p.x + B.x) / 2 - dy * 0.10 * slack, my = (p.y + B.y) / 2 + dx * 0.10 * slack;
  View.ctx.save();
  View.ctx.lineCap = 'round';
  View.ctx.lineWidth = clamp(6 - d / 90, 1.2, 5);
  const g = View.ctx.createLinearGradient(p.x, p.y, B.x, B.y);
  g.addColorStop(0, 'rgba(150,235,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0.30)');
  View.ctx.strokeStyle = g;
  View.ctx.beginPath();
  View.ctx.moveTo(p.x, p.y);
  View.ctx.quadraticCurveTo(mx, my, B.x, B.y);
  View.ctx.stroke();
  View.ctx.restore();
}
