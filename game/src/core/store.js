/**
 * Persistence with a graceful fallback.
 *
 * The game is shipped as a single file that people open from disk, embed in
 * sandboxed iframes, or run in private windows - localStorage throws in some of
 * those. Every read/write goes through here so a blocked storage engine costs
 * you persistence, never a crash.
 *
 * @module core/store
 */

const mem = Object.create(null);
let ok = true;
try {
  const k = '__dive_probe__';
  localStorage.setItem(k, '1');
  localStorage.removeItem(k);
} catch (e) {
  ok = false;
}

export const Store = {
  /** True when the real localStorage is usable. */
  get persistent() { return ok; },

  get(key, fallback) {
    try {
      const v = ok ? localStorage.getItem(key) : mem[key];
      return v === null || v === undefined ? fallback : v;
    } catch (e) {
      return mem[key] === undefined ? fallback : mem[key];
    }
  },

  set(key, val) {
    mem[key] = String(val);
    try { if (ok) localStorage.setItem(key, String(val)); } catch (e) { /* quota or blocked */ }
  },

  getJSON(key, fallback) {
    try { return JSON.parse(this.get(key, '')) ?? fallback; } catch (e) { return fallback; }
  },

  setJSON(key, val) { this.set(key, JSON.stringify(val)); }
};

/** Every persisted key in one place so saves are easy to find and migrate. */
export const KEYS = {
  career: 'dive_career_v3',
  scores: 'dive_payroll_v3',
  mute: 'dive_mute_v1',
  name: 'dive_name',
  seenIntro: 'dive_seen_intro_v3'
};
