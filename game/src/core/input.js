/**
 * Keyboard, mouse and touch, unified into one intent object.
 *
 * This module deliberately knows NOTHING about the game. It exposes state and
 * raises hooks; `game/state.js` registers itself with `attachInput()`. That
 * inversion keeps input testable in isolation and stops a dependency cycle
 * between input and the game loop.
 *
 * @module core/input
 */

import { clamp } from './math.js';
import { View, isCoarse } from './view.js';
import { SFX } from './audio.js';

const UP = ['KeyW', 'KeyZ', 'ArrowUp', 'w', 'z'];
const DOWN = ['KeyS', 'ArrowDown', 's'];
const LEFT = ['KeyA', 'KeyQ', 'ArrowLeft', 'a', 'q'];
const RIGHT = ['KeyD', 'ArrowRight', 'd'];
const SCANKEYS = ['KeyE', 'e'];
const SIPHONKEYS = ['KeyF', 'f'];

const keys = Object.create(null);
const anyKey = (list) => {
  for (let i = 0; i < list.length; i++) if (keys[list[i]]) return true;
  return false;
};
const isScanKey = (code, k) => SCANKEYS.indexOf(code) >= 0 || SCANKEYS.indexOf(k) >= 0;
const isSiphonKey = (code, k) => SIPHONKEYS.indexOf(code) >= 0 || SIPHONKEYS.indexOf(k) >= 0;

export const Input = {
  keys,
  mouse: { x: 400, y: 300, active: false },
  touch: {
    enabled: isCoarse,
    holdId: -1,
    scanId: -1,
    siphonId: -1,
    /** Hit circles, written by the HUD each frame in device pixels. */
    scanBtn: { x: 0, y: 0, r: 0 },
    siphonBtn: { x: 0, y: 0, r: 0 },
    stick: { id: -1, ox: 0, oy: 0, x: 0, y: 0, dx: 0, dy: 0, on: false }
  },

  /**
   * Touch aiming. `on` means there is a line to draw; `drag` means a finger is
   * currently moving it. Releasing the drag pulls the trigger.
   */
  aim: { id: -1, x: 0, y: 0, on: false, drag: false },

  /** Pointer/touch is holding the scan control. */
  scanHeld: false,
  /**
   * Latched press-edge. Scanning costs money, and the pulse is polled once per
   * frame - without this latch a tap that lands entirely between two frames is
   * silently swallowed and the player is charged nothing for nothing.
   */
  scanTap: false,
  /** One-shot: fire the escort down the current aim line. */
  wantFire: false,
  /** One-shot: take the client's oxygen. */
  wantSiphon: false,

  /** Movement axes in [-1,1], keyboard or virtual stick. */
  axis(out) {
    let ax = (anyKey(RIGHT) ? 1 : 0) - (anyKey(LEFT) ? 1 : 0);
    let ay = (anyKey(DOWN) ? 1 : 0) - (anyKey(UP) ? 1 : 0);
    const st = this.touch.stick;
    if (st.on && (st.dx || st.dy)) { ax = st.dx; ay = st.dy; }
    const m = Math.hypot(ax, ay);
    out.x = m > 1 ? ax / m : ax;
    out.y = m > 1 ? ay / m : ay;
    return out;
  },

  /** True while a scan control is held (edge detection lives in game/state.js). */
  scanInput() { return this.scanHeld || anyKey(SCANKEYS); },

  /** Drop all held state - called on blur so keys do not stick down. */
  releaseAll() {
    for (const k in keys) keys[k] = false;
    this.touch.stick.on = false;
    this.touch.stick.id = -1;
    this.touch.stick.dx = 0;
    this.touch.stick.dy = 0;
    this.scanHeld = false;
    this.scanTap = false;
    this.wantFire = false;
    this.wantSiphon = false;
    this.aim.drag = false;
    this.aim.id = -1;
  },

  /** Reap pointer ids that vanished without an up event. */
  pollStale(pointers) {
    const t = this.touch;
    if (t.holdId >= 0 && !pointers.has(t.holdId)) { t.holdId = -1; this.scanHeld = false; }
    if (t.scanId >= 0 && !pointers.has(t.scanId)) { t.scanId = -1; this.scanHeld = false; }
    if (t.siphonId >= 0 && !pointers.has(t.siphonId)) t.siphonId = -1;
    if (this.aim.id >= 0 && !pointers.has(this.aim.id)) { this.aim.id = -1; this.aim.drag = false; }
  }
};

const pointers = new Map();
export function pollHold() { Input.pollStale(pointers); }

/** Show the on-screen controls and let CSS know we are on a touch device. */
function setTouchMode() {
  Input.touch.enabled = true;
  if (View.cv) View.cv.classList.add('touchmode');
  const th = document.getElementById('touchhelp');
  if (th) th.style.display = 'grid';
}

/**
 * Wire every listener.
 * @param {HTMLCanvasElement} cv
 * @param {{onKey:(code:string,key:string)=>void, isPlaying:()=>boolean, onPause:()=>void}} hooks
 */
export function attachInput(cv, hooks) {
  if (Input.touch.enabled) setTouchMode();

  window.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase();
    const inField = !!(e.target && e.target.tagName === 'INPUT');
    if (inField) {
      /* let the agent actually type their name - no game keys, no preventDefault */
      if (e.repeat) return;
      SFX.init();
      hooks.onKey(e.code, k);
      return;
    }
    keys[e.code] = true;
    keys[k] = true;
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) >= 0) e.preventDefault();
    if (e.repeat) return;
    if (isScanKey(e.code, k) && hooks.isPlaying()) Input.scanTap = true;
    if (isSiphonKey(e.code, k) && hooks.isPlaying()) Input.wantSiphon = true;
    SFX.init();
    hooks.onKey(e.code, k);
  }, { passive: false });

  window.addEventListener('keyup', (e) => {
    const k = (e.key || '').toLowerCase();
    keys[e.code] = false;
    keys[k] = false;
  }, { passive: true });

  window.addEventListener('blur', () => {
    Input.releaseAll();
    if (hooks.isPlaying()) hooks.onPause();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && hooks.isPlaying()) hooks.onPause();
  });

  cv.addEventListener('pointerdown', (e) => {
    SFX.init();
    /* Pointer capture keeps a drag alive if the finger leaves the canvas, but
       it throws NotFoundError when the pointer is already gone (and on a few
       browser/synthetic-event edge cases). It is a nicety, never a
       requirement - never let it abort the rest of the handler. */
    try { if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId); } catch (_) { /* non-fatal */ }
    const p = {
      x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY,
      t: performance.now(), type: e.pointerType, moved: 0, role: ''
    };
    pointers.set(e.pointerId, p);

    if (e.pointerType === 'touch') {
      setTouchMode();
      const b = Input.touch.scanBtn;
      if (b.r > 0 && Math.hypot(e.clientX - b.x, e.clientY - b.y) < b.r * 1.25) {
        p.role = 'scan';
        Input.touch.scanId = e.pointerId;
        Input.scanHeld = true;
        if (hooks.isPlaying()) Input.scanTap = true;
        return;
      }
      const sb = Input.touch.siphonBtn;
      if (sb.r > 0 && Math.hypot(e.clientX - sb.x, e.clientY - sb.y) < sb.r * 1.25) {
        p.role = 'siphon';
        Input.touch.siphonId = e.pointerId;
        if (hooks.isPlaying()) Input.wantSiphon = true;
        return;
      }
      if (e.clientX < View.w * 0.44 && e.clientY > View.h * 0.34 && Input.touch.stick.id < 0) {
        const st = Input.touch.stick;
        p.role = 'stick';
        st.id = e.pointerId; st.on = true;
        st.ox = e.clientX; st.oy = e.clientY;
        st.x = e.clientX; st.y = e.clientY;
        st.dx = 0; st.dy = 0;
        return;
      }
      /* everything else is the aim line: drag to aim, release to fire */
      p.role = 'aim';
      const a = Input.aim;
      a.id = e.pointerId; a.on = true; a.drag = true;
      a.x = e.clientX; a.y = e.clientY;
      Input.mouse.x = e.clientX; Input.mouse.y = e.clientY; Input.mouse.active = true;
      return;
    }

    Input.mouse.x = e.clientX; Input.mouse.y = e.clientY; Input.mouse.active = true;
    if (e.button === 2) {
      Input.scanHeld = true;
      if (hooks.isPlaying()) Input.scanTap = true;
      p.role = 'scan';
      return;
    }
    if (e.button === 0) { Input.wantFire = true; p.role = 'fire'; }
  }, { passive: true });

  cv.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (p) {
      p.moved = Math.max(p.moved, Math.hypot(e.clientX - p.sx, e.clientY - p.sy));
      p.x = e.clientX; p.y = e.clientY;
    }
    if (e.pointerType === 'touch') {
      const st = Input.touch.stick;
      if (p && p.role === 'stick') {
        const dx = e.clientX - st.ox, dy = e.clientY - st.oy;
        const mag = Math.hypot(dx, dy), max = 62 * View.ui;
        const s = mag > max ? max / mag : 1;
        st.x = st.ox + dx * s; st.y = st.oy + dy * s;
        st.dx = clamp(dx / max, -1, 1); st.dy = clamp(dy / max, -1, 1);
      } else if (p && p.role === 'aim') {
        const a = Input.aim;
        a.x = e.clientX; a.y = e.clientY; a.on = true; a.drag = true;
        Input.mouse.x = e.clientX; Input.mouse.y = e.clientY;
      }
      return;
    }
    Input.mouse.x = e.clientX; Input.mouse.y = e.clientY; Input.mouse.active = true;
  }, { passive: true });

  function endPointer(e) {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (!p) return;
    if (p.role === 'stick') {
      const st = Input.touch.stick;
      st.on = false; st.id = -1; st.dx = 0; st.dy = 0;
    } else if (p.role === 'scan') {
      Input.scanHeld = false;
      Input.touch.scanId = -1;
    } else if (p.role === 'siphon') {
      Input.touch.siphonId = -1;
    } else if (p.role === 'aim') {
      /* releasing the aim finger pulls the trigger - tap or drag, both fire */
      const a = Input.aim;
      a.x = p.x; a.y = p.y; a.on = true; a.drag = false; a.id = -1;
      Input.wantFire = true;
    }
    if (e.pointerType !== 'touch' && e.button === 2) Input.scanHeld = false;
  }

  cv.addEventListener('pointerup', endPointer, { passive: true });
  cv.addEventListener('pointercancel', endPointer, { passive: true });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
}
