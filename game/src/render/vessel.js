/**
 * Drawing the vessel network.
 *
 * The walkable space is a union of chambers (circles) and corridors (capsules).
 * Canvas cannot fill a union directly, so we use the classic two-pass trick:
 *
 *   pass 1  stroke every shape thickly in wall colour  -> outer endothelium
 *   pass 2  fill every shape in plasma colour on top   -> clean interior
 *
 * Overlaps disappear because pass 2 paints over the shared borders.
 *
 * @module render/vessel
 */

import { CFG } from '../core/config.js';
import { TAU, hsl, clamp } from '../core/math.js';
import { View, cam } from '../core/view.js';
import { Maze } from '../world/maze.js';

/** Only draw what is on screen - a nine-row network is a lot of geometry. */
function visible(s) {
  const hw = View.w / 2 / View.zoom + 260;
  const hh = View.h / 2 / View.zoom + 260;
  if (s.k === 0) return Math.abs(s.x - cam.x) < hw + s.r && Math.abs(s.y - cam.y) < hh + s.r;
  const minX = Math.min(s.x1, s.x2) - s.r, maxX = Math.max(s.x1, s.x2) + s.r;
  const minY = Math.min(s.y1, s.y2) - s.r, maxY = Math.max(s.y1, s.y2) + s.r;
  return maxX > cam.x - hw && minX < cam.x + hw && maxY > cam.y - hh && minY < cam.y + hh;
}

function pathShape(ctx, s, grow) {
  if (s.k === 0) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r + grow, 0, TAU);
  } else {
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineWidth = (s.r + grow) * 2;
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  }
}

export function drawVessel(t) {
  const ctx = View.ctx;
  const shapes = Maze.shapes;
  const pulse = Math.sin(t * 5.9) * 0.5 + 0.5; // heartbeat

  /* ---- pass 1: the wall ------------------------------------------------ */
  ctx.save();
  ctx.lineJoin = 'round';
  for (let i = 0; i < shapes.length; i++) {
    const s = shapes[i];
    if (s.k === 1 && !s.edge.open) continue;
    if (!visible(s)) continue;
    if (s.k === 0) {
      pathShape(ctx, s, 13);
      ctx.fillStyle = 'rgba(96,16,40,0.95)';
      ctx.fill();
    } else {
      pathShape(ctx, s, 13);
      ctx.strokeStyle = 'rgba(96,16,40,0.95)';
      ctx.stroke();
    }
  }

  /* ---- pass 2: plasma -------------------------------------------------- */
  for (let i = 0; i < shapes.length; i++) {
    const s = shapes[i];
    if (s.k === 1 && !s.edge.open) continue;
    if (!visible(s)) continue;
    const organ = s.k === 0 && s.node && s.node.kind === 'organ';
    ctx.fillStyle = organ ? hsl(Maze.hue, 52, 20) : 'rgba(58,8,24,1)';
    ctx.strokeStyle = organ ? hsl(Maze.hue, 52, 20) : 'rgba(58,8,24,1)';
    if (s.k === 0) { pathShape(ctx, s, 0); ctx.fill(); } else { pathShape(ctx, s, 0); ctx.stroke(); }
  }

  /* ---- inner glow so the wall reads as living tissue ------------------- */
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < shapes.length; i++) {
    const s = shapes[i];
    if (s.k === 1 && !s.edge.open) continue;
    if (!visible(s)) continue;
    ctx.strokeStyle = 'rgba(255,90,130,' + (0.05 + pulse * 0.035) + ')';
    ctx.lineWidth = 7;
    if (s.k === 0) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r - 3, 0, TAU);
      ctx.stroke();
    } else {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  drawValves(t);
  drawOrgan(t);
}

/** Sphincter valves: shut until their row's wave is cleared. */
function drawValves(t) {
  const ctx = View.ctx;
  for (const e of Maze.edges) {
    if (e.gateRow < 0) continue;
    const mx = (e.a.x + e.b.x) / 2, my = (e.a.y + e.b.y) / 2;
    const hw = View.w / 2 / View.zoom + 200, hh = View.h / 2 / View.zoom + 200;
    if (Math.abs(mx - cam.x) > hw || Math.abs(my - cam.y) > hh) continue;
    const ang = Math.atan2(e.b.y - e.a.y, e.b.x - e.a.x);
    const r = e.bore;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(ang);
    if (!e.open) {
      /* a closed iris: two clenched leaves that breathe */
      const squeeze = 0.86 + Math.sin(t * 3 + e.pulse) * 0.08;
      ctx.fillStyle = 'rgba(128,22,52,0.98)';
      ctx.strokeStyle = 'rgba(255,120,150,0.55)';
      ctx.lineWidth = 3;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-16, side * r);
        ctx.quadraticCurveTo(0, side * r * (1 - squeeze), 16, side * r);
        ctx.lineTo(16, side * r * 0.06);
        ctx.quadraticCurveTo(0, side * r * (0.06 + (1 - squeeze) * 0.3), -16, side * r * 0.06);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,190,205,0.75)';
      ctx.font = '600 13px ui-monospace,monospace';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.rotate(-ang);
      ctx.fillText('SEALED', 0, -r - 14);
      ctx.restore();
    } else {
      /* an open valve still shows its ring, relaxed */
      ctx.strokeStyle = 'rgba(120,255,190,0.28)';
      ctx.lineWidth = 3;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-13, side * r);
        ctx.quadraticCurveTo(0, side * r * 0.82, 13, side * r);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/** The objective: the target organ's chamber, glowing at the bottom of the dive. */
function drawOrgan(t) {
  const ctx = View.ctx;
  const n = Maze.organ;
  if (!n) return;
  const hw = View.w / 2 / View.zoom + 300, hh = View.h / 2 / View.zoom + 300;
  if (Math.abs(n.x - cam.x) > hw + n.radius || Math.abs(n.y - cam.y) > hh + n.radius) return;
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(n.x, n.y, n.radius * 0.1, n.x, n.y, n.radius);
  g.addColorStop(0, hsl(Maze.hue, 80, 38, 0.30 + pulse * 0.08));
  g.addColorStop(1, hsl(Maze.hue, 80, 30, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(n.x, n.y, n.radius, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = hsl(Maze.hue, 70, 62, 0.30 + pulse * 0.12);
  ctx.lineWidth = 2.5;
  ctx.setLineDash([14, 10]);
  ctx.lineDashOffset = -t * 26;
  ctx.beginPath();
  ctx.arc(n.x, n.y, n.radius * 0.82, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = hsl(Maze.hue, 60, 78, 0.55);
  ctx.font = '700 15px ui-monospace,monospace';
  ctx.textAlign = 'center';
  ctx.fillText(Maze.organName.toUpperCase(), n.x, n.y - n.radius * 0.82 - 12);
  ctx.restore();
}

/**
 * The firing line: what the white cell would destroy if it fired right now.
 * With a lethal lunge this is the single most important piece of feedback in
 * the game, so it is drawn in world space, under the cells.
 */
/**
 * The firing line.
 *
 * This is the whole aiming interface: a solid bar from the escort down the
 * direction you are pointing, stopping exactly where the vessel wall stops the
 * shot. Green when only hostiles are on it, red when something billable is.
 *
 * @param {object} fp the object returned by Game.firingPreview()
 */
export function drawFiringLine(fp) {
  if (!fp) return;
  const ctx = View.ctx;
  const danger = fp.collateral > 0;
  const cold = !fp.ready;
  ctx.save();
  ctx.lineCap = 'round';

  /* the swept body: exactly CFG.buddy.killR either side of the line */
  ctx.lineWidth = CFG.buddy.killR * 2;
  ctx.strokeStyle = fp.blocked
    ? 'rgba(150,150,170,0.10)'
    : danger ? 'rgba(255,70,110,0.17)'
      : cold ? 'rgba(140,170,200,0.07)' : 'rgba(110,240,190,0.11)';
  ctx.beginPath();
  ctx.moveTo(fp.x0, fp.y0);
  ctx.lineTo(fp.x1, fp.y1);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.setLineDash(cold ? [4, 10] : [12, 8]);
  ctx.strokeStyle = fp.blocked
    ? 'rgba(190,190,210,0.35)'
    : danger ? 'rgba(255,110,140,0.8)'
      : cold ? 'rgba(170,200,220,0.35)' : 'rgba(120,255,205,0.6)';
  ctx.beginPath();
  ctx.moveTo(fp.x0, fp.y0);
  ctx.lineTo(fp.x1, fp.y1);
  ctx.stroke();
  ctx.setLineDash([]);

  /* the impact cap, so the player can see where the shot dies */
  if (!fp.blocked) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = danger ? 'rgba(255,110,140,0.75)' : 'rgba(120,255,205,0.5)';
    ctx.beginPath();
    ctx.arc(fp.x1, fp.y1, CFG.buddy.killR * 0.55, 0, TAU);
    ctx.stroke();
  }

  /* ring the bystanders that are about to become an expense */
  const cas = fp.casualties;
  for (let i = 0; i < cas.length; i++) {
    const e = cas[i];
    ctx.strokeStyle = 'rgba(255,110,140,0.78)';
    ctx.lineWidth = e.comp.hostile ? 2 : 1.4;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * e.elongation + 9, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}
