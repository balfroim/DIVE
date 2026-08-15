/**
 * Little rotating specimen canvases used on the briefing cards.
 * They render with the same entity code as the world, so the briefing cannot
 * lie to you about what a species looks like.
 * @module ui/previews
 */

import { rr, TAU } from '../core/math.js';
import { blankEnt, dressEntity } from '../entities/cell.js';
import { glowSprite } from '../render/sprites.js';
import { drawEntityBody, drawHalo } from '../render/cells.js';

/** A detached entity for preview use - never enters the pool. */
export function previewEnt(kind, sig, dev, species) {
  const e = blankEnt();
  e.on = true;
  e.preview = true;
  e.scale = 1;
  e.uid = -1;
  e.seed = rr(0, 100);
  e.phase = rr(0, TAU);
  e.verts = 18;
  e.ang = 0;
  e.spin = 0.25;
  dressEntity(e, kind, sig, dev, species);
  return e;
}

export function paintPreview(canvas, ent, t) {
  if (!canvas || !ent || !canvas.getContext) return;
  const c = canvas.getContext('2d');
  const S = canvas.width;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, S, S);
  c.save();
  c.translate(S / 2, S / 2);
  const k = (S * 0.3) / (ent.r * Math.max(1, ent.elong) * (ent.coil ? 3.2 : 1 + (ent.spikeLen || 0)));
  c.scale(k, k);
  c.globalCompositeOperation = 'lighter';
  const g = glowSprite(ent.hue, ent.sat, ent.lit);
  c.globalAlpha = 0.4;
  c.drawImage(g, -ent.r * 2.4, -ent.r * 2.4, ent.r * 4.8, ent.r * 4.8);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  if (ent.halo) drawHalo(c, ent, t);
  drawEntityBody(c, ent, t);
  c.restore();
}
