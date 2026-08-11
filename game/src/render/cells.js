/**
 * Drawing cells: bodies, nuclei, haloes and the diagnostic overlay.
 *
 * `drawEntityBody` is shared with the briefing preview cards, so what the
 * client's file shows you is rendered by exactly the same code as the thing you
 * meet in the vessel. That is a gameplay guarantee, not just tidiness.
 *
 * @module render/cells
 */

import { TAU, PI, rr, lerp, clamp, hsl, easeOut, easeOutBack, hueDelta, wrapHue } from '../core/math.js';
import { View, cam, inView } from '../core/view.js';
import { CFG } from '../core/config.js';
import { ENTS_POOL } from '../entities/pool.js';
import { spawnPart } from '../entities/particles.js';
import { glowSprite, drawGlow } from './sprites.js';
const _px = new Float32Array(64), _py = new Float32Array(64);

export function blobPath(c, e, t, rs) {
  const N = e.verts;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    let rad = e.r * rs;
    rad *= 1 + e.lobeAmp * Math.sin(a * (e.lobes || 1) + e.phase)
              + 0.03 * Math.sin(a * 3 + t * 1.5 + e.seed)
              + e.deform * Math.sin(a * 2.3 + e.seed * 2 + t * 0.6);
    _px[i] = Math.cos(a) * rad * e.elong;
    _py[i] = Math.sin(a) * rad;
  }
  c.beginPath();
  c.moveTo((_px[N - 1] + _px[0]) / 2, (_py[N - 1] + _py[0]) / 2);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    c.quadraticCurveTo(_px[i], _py[i], (_px[i] + _px[j]) / 2, (_py[i] + _py[j]) / 2);
  }
  c.closePath();
}

export function drawSpirochete(c, e, t) {
  const segs = e.segs || 9, len = e.r * 6.4;
  c.save();
  c.rotate(e.ang);
  const hue = e.hue, sat = e.sat, lit = e.lit;
  for (let i = segs - 1; i >= 0; i--) {
    const u = i / (segs - 1);
    const x = -len / 2 + len * u;
    const y = Math.sin(u * TAU * 1.5 - t * 7 + e.seed) * e.r * 1.5 * e.wave;
    const rad = e.r * (0.55 + 0.45 * Math.sin(u * PI));
    c.beginPath();
    c.arc(x, y, rad, 0, TAU);
    c.fillStyle = hsl(hue, sat, lit - u * 8, 0.92);
    c.fill();
    c.lineWidth = 1.6;
    c.strokeStyle = hsl(hue, sat, lit + 22, 0.55);
    c.stroke();
  }
  c.restore();
}

export function drawNucleus(c, e, t) {
  const h = wrapHue(e.hue + 8), col = hsl(h, Math.min(96, e.sat + 12), Math.max(20, e.lit - 26), 0.85);
  const hi = hsl(h, e.sat, e.lit + 18, 0.5);
  c.fillStyle = col;
  const wob = Math.sin(t * 1.7 + e.seed) * e.r * 0.05;
  switch (e.nuc) {
    case 'dot':
      c.beginPath(); c.ellipse(wob, wob * 0.6, e.r * 0.36 * e.elong, e.r * 0.32, 0, 0, TAU); c.fill();
      c.fillStyle = hi; c.beginPath(); c.ellipse(wob - e.r * 0.1, wob * 0.6 - e.r * 0.1, e.r * 0.13, e.r * 0.1, 0, 0, TAU); c.fill();
      break;
    case 'trio':
      for (let i = 0; i < 3; i++) {
        const a = e.phase + i * TAU / 3 + t * 0.3;
        c.beginPath(); c.ellipse(Math.cos(a) * e.r * 0.34 * e.elong, Math.sin(a) * e.r * 0.34, e.r * 0.17, e.r * 0.15, 0, 0, TAU); c.fill();
      }
      break;
    case 'ring':
      c.lineWidth = Math.max(1.4, e.r * 0.11);
      c.strokeStyle = col;
      c.beginPath(); c.ellipse(0, 0, e.r * 0.44 * e.elong, e.r * 0.42, 0, 0, TAU); c.stroke();
      break;
    case 'crescent':
      c.beginPath();
      c.arc(wob, 0, e.r * 0.42, PI * 0.25, PI * 1.35);
      c.lineWidth = Math.max(1.6, e.r * 0.19);
      c.lineCap = 'round';
      c.strokeStyle = col;
      c.stroke();
      c.lineCap = 'butt';
      break;
  }
}

export function drawEntityBody(c, e, t) {
  const flick = e.hurt > 0 ? 1 : 0;
  c.save();
  c.translate(0, 0);

  if (e.coil) {
    drawSpirochete(c, e, t);
    c.restore();
    return;
  }

  const rot = (e.elong > 1.12 || e.motion === 'seek' || e.motion === 'wiggle') ? e.ang : e.phase * 0.15;
  c.rotate(rot);

  /* flagella (behind) */
  if (e.flag) {
    c.lineWidth = Math.max(1, e.r * 0.09);
    c.lineCap = 'round';
    c.strokeStyle = hsl(e.hue, e.sat, e.lit + 16, 0.6);
    for (let f = 0; f < e.flag; f++) {
      const off = (f - (e.flag - 1) / 2) * e.r * 0.5;
      c.beginPath();
      c.moveTo(-e.r * e.elong * 0.9, off * 0.5);
      for (let s = 1; s <= 5; s++) {
        const u = s / 5;
        const x = -e.r * e.elong * (0.9 + u * 1.5);
        const y = off * 0.5 + Math.sin(u * 5 - t * 11 + f * 1.7 + e.seed) * e.r * 0.55 * u;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    c.lineCap = 'butt';
  }

  /* spikes (behind body) */
  if (e.spikes > 0 && e.spikeLen > 0) {
    const n = e.spikes;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + e.phase * 0.5 + Math.sin(t * 2 + i) * 0.02;
      const inner = e.r * 0.86, outer = e.r * (1 + e.spikeLen) * (1 + Math.sin(t * 4 + i * 1.3) * 0.03);
      const ca = Math.cos(a), sa = Math.sin(a);
      c.beginPath();
      c.moveTo(ca * inner - sa * e.r * 0.07, sa * inner + ca * e.r * 0.07);
      c.lineTo(ca * outer, sa * outer);
      c.lineTo(ca * inner + sa * e.r * 0.07, sa * inner - ca * e.r * 0.07);
      c.closePath();
      c.fillStyle = hsl(e.hue, Math.min(98, e.sat + 14), e.lit + 6, 0.9);
      c.fill();
      if (e.spikeTip) {
        c.beginPath();
        c.arc(ca * outer, sa * outer, Math.max(1.1, e.r * 0.085), 0, TAU);
        c.fillStyle = hsl(e.hue, 96, Math.min(88, e.lit + 26), 0.95);
        c.fill();
      }
    }
  }

  /* membrane */
  blobPath(c, e, t, 1);
  const gk = (e.hue | 0) + '|' + (e.sat | 0) + '|' + (e.lit | 0) + '|' + e.r.toFixed(1) + '|' + e.elong.toFixed(2);
  let g;
  if (e._g && e._gk === gk && e._gc === c) { g = e._g; }
  else {
    g = c.createRadialGradient(-e.r * 0.25, -e.r * 0.3, e.r * 0.1, 0, 0, e.r * 1.15 * e.elong);
    g.addColorStop(0, hsl(e.hue, e.sat, Math.min(92, e.lit + 22), 0.96));
    g.addColorStop(0.55, hsl(e.hue, e.sat, e.lit, 0.90));
    g.addColorStop(1, hsl(e.hue, Math.min(98, e.sat + 8), Math.max(18, e.lit - 22), 0.85));
    e._g = g; e._gk = gk; e._gc = c;
  }
  c.fillStyle = g;
  c.fill();

  if (e.infect > 0) {
    c.save(); c.clip();
    c.fillStyle = 'rgba(90,255,120,' + (0.10 + e.infect * 0.28) + ')';
    c.fillRect(-e.r * 2, -e.r * 2, e.r * 4, e.r * 4);
    c.restore();
  }
  if (flick) {
    c.save(); c.clip();
    c.fillStyle = 'rgba(255,255,255,' + (e.hurt * 0.6) + ')';
    c.fillRect(-e.r * 2, -e.r * 2, e.r * 4, e.r * 4);
    c.restore();
  }

  blobPath(c, e, t, 1);
  c.lineWidth = Math.max(1.2, e.r * 0.09);
  c.strokeStyle = hsl(e.hue, Math.min(98, e.sat + 10), Math.min(90, e.lit + 26), 0.85);
  c.stroke();

  /* specular */
  c.beginPath();
  c.ellipse(-e.r * 0.34 * e.elong, -e.r * 0.38, e.r * 0.26 * e.elong, e.r * 0.15, -0.6, 0, TAU);
  c.fillStyle = 'rgba(255,255,255,0.30)';
  c.fill();

  if (e.nuc !== 'none') drawNucleus(c, e, t);
  c.restore();
}

export function drawHalo(c, e, t) {
  const p = 0.5 + 0.5 * Math.sin(t * 2.1 + e.seed);
  c.save();
  c.lineWidth = 1.6;
  c.strokeStyle = hsl(150, 90, 70, 0.30 + p * 0.28);
  c.beginPath(); c.arc(0, 0, e.r * (1.34 + p * 0.06) * Math.max(1, e.elong * 0.9), 0, TAU); c.stroke();
  c.strokeStyle = hsl(150, 90, 76, 0.16 + (1 - p) * 0.22);
  c.beginPath(); c.arc(0, 0, e.r * (1.62 + (1 - p) * 0.08) * Math.max(1, e.elong * 0.9), 0, TAU); c.stroke();
  c.restore();
  if (!e.preview && Math.random() < 0.07) {
    const a = rr(0, TAU), d = e.r * 1.5;
    spawnPart(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, Math.cos(a) * 8, Math.sin(a) * 8, rr(1, 2.2), rr(0.4, 0.9), 150, 90, 78, 0, 1.4);
  }
}

export function drawEntities(t) {
  /* glow pass */
  View.ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < ENTS_POOL.length; i++) {
    const e = ENTS_POOL[i];
    if (!e.on) continue;
    if (!inView(e.x, e.y, e.r * 4 + 60)) continue;
    const sc = e.dying > 0 ? e.dying : e.scale;
    const g = glowSprite(e.hue, e.sat, e.lit);
    const pul = 1 + Math.sin(t * 2.2 + e.seed) * 0.06;
    drawGlow(g, e.x, e.y, e.r * (e.coil ? 3.6 : 2.5) * pul * sc * (e.elong > 1.2 ? 1.25 : 1), 0.32);
  }
  View.ctx.globalCompositeOperation = 'source-over';

  /* bodies */
  for (let i = 0; i < ENTS_POOL.length; i++) {
    const e = ENTS_POOL[i];
    if (!e.on) continue;
    if (!inView(e.x, e.y, e.r * 4 + 60)) continue;
    const sc = e.dying > 0 ? easeOut(e.dying) : easeOutBack(Math.min(1, e.scale));
    View.ctx.save();
    View.ctx.translate(e.x, e.y);
    View.ctx.scale(sc, sc);
    if (e.halo) drawHalo(View.ctx, e, t);
    drawEntityBody(View.ctx, e, t);
    View.ctx.restore();

    if (e.infect > 0.04 && e.infBy && e.infBy.on && !e.infBy.dying && e.infBy.kind === 'pathogen' &&
        Math.hypot(e.infBy.x - e.x, e.infBy.y - e.y) < 260) {
      View.ctx.strokeStyle = 'rgba(120,255,150,' + (0.2 + e.infect * 0.4) + ')';
      View.ctx.lineWidth = 1.4 + e.infect * 2;
      View.ctx.beginPath();
      View.ctx.moveTo(e.infBy.x, e.infBy.y);
      const mx = (e.x + e.infBy.x) / 2 + Math.sin(t * 6) * 6, my = (e.y + e.infBy.y) / 2 + Math.cos(t * 5) * 6;
      View.ctx.quadraticCurveTo(mx, my, e.x, e.y);
      View.ctx.stroke();
    }
  }
}

/* labels, marks, hover — drawn above everything in world space */
export function drawEntityUI(t, hover) {
  for (let i = 0; i < ENTS_POOL.length; i++) {
    const e = ENTS_POOL[i];
    if (!e.on || e.dying > 0) continue;
    if (!inView(e.x, e.y, e.r * 4 + 90)) continue;
    const idd = t < e.idUntil;
    const rad = e.r * Math.max(1, e.elong) + 8;

    if (e.infect > 0.06) {
      View.ctx.save();
      View.ctx.translate(e.x, e.y);
      View.ctx.lineWidth = 3;
      View.ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      View.ctx.beginPath(); View.ctx.arc(0, 0, rad + 5, 0, TAU); View.ctx.stroke();
      View.ctx.strokeStyle = '#5cff8a';
      View.ctx.beginPath(); View.ctx.arc(0, 0, rad + 5, -PI / 2, -PI / 2 + TAU * e.infect); View.ctx.stroke();
      View.ctx.restore();
    }

    /* corrupted host cells advertise themselves: they are actively bleeding the
       client, so the player can hunt them without spending a scan charge */
    if (e.species === 'corrupted') {
      const pl = 0.5 + 0.5 * Math.sin(t * 5 + e.seed);
      View.ctx.save();
      View.ctx.translate(e.x, e.y);
      View.ctx.rotate(t * 1.5);
      View.ctx.setLineDash([3, 6]);
      View.ctx.lineWidth = 2;
      View.ctx.strokeStyle = 'rgba(92,255,138,' + (0.35 + pl * 0.45) + ')';
      View.ctx.beginPath(); View.ctx.arc(0, 0, rad + 11 + pl * 2.5, 0, TAU); View.ctx.stroke();
      View.ctx.setLineDash([]);
      View.ctx.restore();
      View.ctx.save();
      View.ctx.translate(e.x, e.y);
      View.ctx.scale(1 / View.zoom, 1 / View.zoom);
      View.ctx.font = '800 8px ui-monospace,Menlo,monospace';
      View.ctx.textAlign = 'center';
      View.ctx.fillStyle = 'rgba(92,255,138,' + (0.5 + pl * 0.5) + ')';
      View.ctx.fillText('\u2620 BLEEDING', 0, -(rad + 15) * View.zoom);
      View.ctx.restore();
    }

    if (e === hover) {
      View.ctx.save();
      View.ctx.translate(e.x, e.y);
      View.ctx.rotate(t * 0.9);
      View.ctx.setLineDash([5, 7]);
      View.ctx.lineWidth = 1.6;
      View.ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      View.ctx.beginPath(); View.ctx.arc(0, 0, rad + 9, 0, TAU); View.ctx.stroke();
      View.ctx.setLineDash([]);
      View.ctx.restore();
    }

    if (idd || e.idPing > 0) {
      const fade = clamp((e.idUntil - t) / 1.2, 0, 1);
      /* the label is archetype data (see data/enemies.js), not a switch */
      const txt = e.idName || 'UNKNOWN';
      const col = e.idCol || '#7fdcff';
      const sub = e.idSub || '';
      View.ctx.save();
      View.ctx.translate(e.x, e.y);
      View.ctx.scale(1 / View.zoom, 1 / View.zoom);
      const y = (rad + 8) * View.zoom;
      View.ctx.globalAlpha = fade;
      View.ctx.font = '800 10.5px ui-monospace,Menlo,monospace';
      View.ctx.textAlign = 'center';
      const w = View.ctx.measureText(txt).width + 14;
      View.ctx.fillStyle = 'rgba(10,2,6,0.62)';
      roundRect(View.ctx, -w / 2, y, w, 14, 4); View.ctx.fill();
      View.ctx.fillStyle = col;
      View.ctx.fillText(txt, 0, y + 10.5);
      if (sub) {
        View.ctx.font = '700 8px ui-monospace,Menlo,monospace';
        View.ctx.fillStyle = 'rgba(255,255,255,0.5)';
        View.ctx.fillText(sub, 0, y + 23);
      }
      View.ctx.globalAlpha = 1;
      View.ctx.restore();
    }
  }
}

export function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
