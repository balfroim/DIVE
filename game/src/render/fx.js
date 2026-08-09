/**
 * Particles and floating damage/bounty text.
 * @module render/fx
 */

import { TAU, clamp, hsl, easeOutBack } from '../core/math.js';
import { View, cam, inView } from '../core/view.js';
import { parts, pops } from '../entities/particles.js';
export function drawParts() {
  View.ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p.on) continue;
    const u = p.life / p.max;
    if (!inView(p.x, p.y, p.r + 40)) continue;
    if (p.kind === 2) {
      View.ctx.lineWidth = p.vx * u;
      View.ctx.strokeStyle = hsl(p.hue, p.sat, p.lit, u * 0.75);
      View.ctx.beginPath(); View.ctx.arc(p.x, p.y, p.r, 0, TAU); View.ctx.stroke();
    } else if (p.kind === 1) {
      View.ctx.fillStyle = 'rgba(200,240,255,' + (u * 0.5) + ')';
      View.ctx.beginPath(); View.ctx.arc(p.x, p.y, p.r * u, 0, TAU); View.ctx.fill();
      View.ctx.lineWidth = 0.8;
      View.ctx.strokeStyle = 'rgba(255,255,255,' + (u * 0.5) + ')';
      View.ctx.stroke();
    } else {
      View.ctx.fillStyle = hsl(p.hue, p.sat, p.lit, u * 0.9);
      View.ctx.beginPath(); View.ctx.arc(p.x, p.y, p.r * (0.35 + u * 0.75), 0, TAU); View.ctx.fill();
    }
  }
  View.ctx.globalCompositeOperation = 'source-over';
}

export function drawPops() {
  for (let i = 0; i < pops.length; i++) {
    const p = pops[i];
    if (!p.on) continue;
    const u = p.t / p.life;
    const a = u < 0.12 ? u / 0.12 : 1 - Math.max(0, (u - 0.6) / 0.4);
    const sc = (u < 0.16 ? easeOutBack(u / 0.16) : 1);
    View.ctx.save();
    View.ctx.translate(p.x, p.y);
    View.ctx.scale(sc / View.zoom, sc / View.zoom);
    View.ctx.globalAlpha = clamp(a, 0, 1);
    View.ctx.textAlign = 'center';
    View.ctx.font = '800 ' + p.size + 'px ui-monospace,Menlo,monospace';
    View.ctx.lineWidth = 3.5;
    View.ctx.strokeStyle = 'rgba(8,2,5,0.75)';
    View.ctx.strokeText(p.txt, 0, 0);
    View.ctx.fillStyle = p.col;
    View.ctx.fillText(p.txt, 0, 0);
    if (p.sub) {
      View.ctx.font = '700 ' + (p.size * 0.52) + 'px ui-monospace,Menlo,monospace';
      View.ctx.strokeText(p.sub, 0, p.size * 0.82);
      View.ctx.fillStyle = 'rgba(255,255,255,0.85)';
      View.ctx.fillText(p.sub, 0, p.size * 0.82);
    }
    View.ctx.globalAlpha = 1;
    View.ctx.restore();
  }
}
