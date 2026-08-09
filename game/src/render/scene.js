/**
 * Frame composition: what gets drawn, in what order.
 *
 * World space is entered once (translate + scale by the camera) and everything
 * physical is drawn inside it; the HUD then resets the transform and draws in
 * UI space.
 *
 * @module render/scene
 */

import { View, cam } from '../core/view.js';
import { Game, firingPreview } from '../game/state.js';
import { drawLayers, drawRBC, drawMotes } from './ambience.js';
import { drawVessel, drawFiringLine } from './vessel.js';
import { drawEntities, drawEntityUI } from './cells.js';
import { drawDiver, drawTether } from './diver.js';
import { drawBuddy } from './buddy.js';
import { drawParts, drawPops } from './fx.js';
import { drawHUD, drawScanFX } from './hud.js';

export function render() {
  const ctx = View.ctx;
  const t = Game.t;

  ctx.setTransform(View.dpr, 0, 0, View.dpr, 0, 0);
  ctx.fillStyle = '#12020a';
  ctx.fillRect(0, 0, View.w, View.h);

  /* parallax tissue sits behind everything, in screen space */
  drawLayers(t);

  /* ---- world space ---- */
  ctx.save();
  ctx.setTransform(View.dpr, 0, 0, View.dpr, 0, 0);
  ctx.translate(View.w / 2 + cam.sx, View.h / 2 + cam.sy);
  ctx.scale(View.zoom, View.zoom);
  ctx.translate(-cam.x, -cam.y);

  drawVessel(t);
  drawRBC();
  drawMotes(t);

  drawFiringLine(firingPreview());

  drawScanFX();
  drawEntities(t);
  drawTether();
  drawParts();
  drawBuddy(t);
  drawDiver(t);
  drawEntityUI(t, Game.hovered());
  drawPops();
  ctx.restore();

  /* ---- UI space ---- */
  drawHUD(t);
  ctx.setTransform(View.dpr, 0, 0, View.dpr, 0, 0);
}
