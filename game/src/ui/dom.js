/**
 * Thin DOM helpers and the overlay switcher.
 * Every screen is a `.overlay` div; exactly one carries `.on` at a time.
 * @module ui/dom
 */

export const $ = (id) => document.getElementById(id);

export function esc(s) {
  return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

export function on(id, ev, fn) {
  const el = $(id);
  if (el) el.addEventListener(ev, fn);
}

/** Stop a click bubbling to the panel's own "advance" handler. */
export const stop = (fn) => (e) => { e.stopPropagation(); fn(e); };

const SCREENS = ['start', 'dialog', 'board', 'brief', 'pause', 'results', 'shop', 'over'];

export function show(name) {
  for (const s of SCREENS) {
    const el = $('scr-' + s);
    if (el) el.classList.toggle('on', s === name);
  }
}

export function hideAll() {
  for (const s of SCREENS) {
    const el = $('scr-' + s);
    if (el) el.classList.remove('on');
  }
}

/** Format credits the way the Division does. */
export function cr(n) {
  return (n < 0 ? '\u2212' : '') + Math.abs(Math.round(n)) + ' cr';
}
