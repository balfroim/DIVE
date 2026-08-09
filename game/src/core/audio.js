/**
 * Tiny procedural synth - no samples, no files, everything is oscillators.
 * Ported unchanged from the v1 prototype; it is self-contained and stable.
 * @module core/audio
 */

import { Store, KEYS } from './store.js';

export const SFX = {
  ctx: null, master: null, noiseBuf: null,
  muted: Store.get(KEYS.mute, '0') === '1',

  /** Lazily created on first user gesture - browsers require that. */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.0;
      const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = b;
    } catch (e) { this.ctx = null; }
  },

  tone(f1, f2, dur, type, vol, delay) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(Math.max(20, f1), t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol || 0.2), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.03);
  },

  noise(dur, vol, freq, q, delay) {
    if (!this.ctx || this.muted || !this.noiseBuf) return;
    const t = this.ctx.currentTime + (delay || 0);
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(freq || 600, t); f.Q.value = q || 1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol || 0.15), t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.03);
  },

  /* ---- the vocabulary -------------------------------------------------- */
  mark()   { this.tone(620, 940, 0.09, 'triangle', 0.16); },
  unmark() { this.tone(520, 300, 0.08, 'triangle', 0.10); },
  lunge()  { this.tone(190, 95, 0.22, 'sine', 0.16); this.noise(0.16, 0.09, 1100, 1.2); },
  engulf() { this.tone(140, 58, 0.28, 'sine', 0.30); this.noise(0.26, 0.16, 380, 0.7);
             this.tone(880, 1400, 0.10, 'triangle', 0.07, 0.05); },
  err()    { this.tone(150, 74, 0.55, 'sawtooth', 0.24); this.noise(0.45, 0.18, 210, 0.6);
             this.tone(300, 120, 0.4, 'square', 0.08, 0.02); },
  scan()   { this.tone(260, 880, 0.85, 'sine', 0.055); },
  ping()   { this.tone(1500, 1950, 0.055, 'sine', 0.05); },
  infect() { this.tone(90, 44, 0.4, 'sawtooth', 0.13); },
  wave()   { [0, 0.09, 0.18].forEach((d, i) => this.tone(520 + i * 190, 0, 0.16, 'triangle', 0.11, d)); },
  over()   { this.tone(420, 60, 1.25, 'sawtooth', 0.20); this.noise(1.0, 0.10, 160, 0.5); },
  ui()     { this.tone(760, 1140, 0.07, 'triangle', 0.12); },
  /** Wall scrape - feedback for the new corridor collisions. */
  bump()   { this.noise(0.09, 0.05, 260, 0.8); },
  /** A valve opening after a wave is cleared. */
  valve()  { this.tone(300, 720, 0.32, 'sine', 0.12); this.noise(0.3, 0.06, 520, 0.9); },
  /** The siphon: a long, wet, unpleasant draw. */
  siphon() { this.tone(120, 420, 0.55, 'sawtooth', 0.13); this.noise(0.5, 0.10, 340, 0.5); },
  /** Gas running out. */
  gasp()   { this.tone(880, 220, 0.30, 'triangle', 0.16); this.noise(0.22, 0.08, 700, 1.0); },

  toggle() {
    this.muted = !this.muted;
    Store.set(KEYS.mute, this.muted ? '1' : '0');
    if (!this.muted) this.ui();
  }
};
