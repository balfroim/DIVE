/**
 * The typewriter dialogue engine.
 *
 * Handles: markup compilation, per-character reveal, choice buttons, the name
 * input, and - importantly - focus. When the name field is open, keystrokes
 * must reach the INPUT and nothing else; when it closes, focus must leave it
 * again or Space/Enter would keep going to a hidden text box.
 *
 * @module ui/dialogue
 */

import { SFX } from '../core/audio.js';
import { Store, KEYS } from '../core/store.js';
import { $, esc } from './dom.js';
import { SCRIPT } from '../data/dialogue.js';   // the induction (data/dialogue.js)
import { Career } from '../game/career.js';

export const DLG = {
  active: false,
  node: null,
  chars: [],
  cls: [],
  shown: 0,
  typing: false,
  cps: 76,
  named: false,
  /** Called when the induction ends (set by ui/screens.js). */
  onFinish: null,

  /** Turn `*emphasis*` / `~jargon~` markup into per-character class runs. */
  compile(raw) {
    const chars = [], cls = [];
    let cur = '';
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (c === '*') { cur = cur === 'em' ? '' : 'em'; continue; }
      if (c === '~') { cur = cur === 'cy' ? '' : 'cy'; continue; }
      chars.push(c);
      cls.push(cur);
    }
    return { chars, cls };
  },

  partial(n) {
    let html = '', run = '', runCls = null;
    for (let i = 0; i < n; i++) {
      if (this.cls[i] !== runCls) {
        if (run) html += runCls ? '<span class="' + runCls + '">' + esc(run) + '</span>' : esc(run);
        run = '';
        runCls = this.cls[i];
      }
      run += this.chars[i];
    }
    if (run) html += runCls ? '<span class="' + runCls + '">' + esc(run) + '</span>' : esc(run);
    return html;
  },

  start(fromId) {
    this.active = true;
    this.named = false;
    this.go(fromId || 's0');
  },

  go(id) {
    if (!id) { this.finish(); return; }
    this.setNode(SCRIPT[id]);
  },

  setNode(node) {
    this.node = node;
    const raw = String(node.text).replace(/%N%/g, Career.agent);
    const c = this.compile(raw);
    this.chars = c.chars;
    this.cls = c.cls;
    this.shown = 0;
    this.typing = true;

    const you = node.who === 'you';
    const use = $('dlg-use');
    if (use && use.setAttribute) {
      use.setAttribute('href', you ? '#por-agent' : '#por-vax');
      use.setAttribute('xlink:href', you ? '#por-agent' : '#por-vax');
    }
    const nm = $('dlg-name');
    if (nm) {
      nm.textContent = you ? (this.named ? Career.agent : 'Recruit') : 'David Vax';
      nm.className = 'dlg-name' + (you ? ' you' : '');
    }
    $('dlg-choices').innerHTML = '';
    $('dlg-in').style.display = 'none';
    $('dlg-hint').style.opacity = '0';
    /* leaving an input node: get focus out of the text box */
    if (!node.input) { try { $('dlg-input').blur(); } catch (e) { /* jsdom */ } }
    this.paint();
  },

  paint() {
    $('dlg-text').innerHTML = this.partial(this.shown | 0) + (this.typing ? '<i class="caret"></i>' : '');
  },

  tick(dt) {
    if (!this.typing) return;
    const before = this.shown | 0;
    this.shown = Math.min(this.chars.length, this.shown + this.cps * dt);
    const now = this.shown | 0;
    if (now !== before) {
      this.paint();
      if (now % 4 === 0 && this.chars[now - 1] !== ' ') {
        SFX.tone(1350 + (now % 5) * 40, 0, 0.018, 'square', 0.012);
      }
    }
    if (this.shown >= this.chars.length) {
      this.typing = false;
      this.paint();
      this.onDone();
    }
  },

  onDone() {
    const n = this.node;
    if (!n) return;
    if (n.input) {
      $('dlg-in').style.display = 'flex';
      const inp = $('dlg-input');
      inp.value = '';
      try { inp.focus(); } catch (e) { /* headless */ }
      return;
    }
    if (n.choices) {
      const box = $('dlg-choices');
      box.innerHTML = '';
      for (let i = 0; i < n.choices.length; i++) {
        const b = document.createElement('button');
        b.className = 'choice';
        b.type = 'button';
        b.innerHTML = '<b>' + (i + 1) + '.</b> ' + esc(n.choices[i].t.replace(/[*~]/g, ''));
        b.addEventListener('click', ((k) => (ev) => { ev.stopPropagation(); DLG.choose(k); })(i));
        box.appendChild(b);
      }
      return;
    }
    $('dlg-hint').style.opacity = '1';
  },

  advance() {
    if (!this.active) return;
    if (this.typing) {
      this.shown = this.chars.length;
      this.typing = false;
      this.paint();
      this.onDone();
      return;
    }
    const n = this.node;
    if (!n || n.input || n.choices) return;
    SFX.ui();
    this.go(n.next);
  },

  choose(i) {
    const n = this.node;
    if (!n || !n.choices || this.typing) return;
    const c = n.choices[i];
    if (!c) return;
    SFX.ui();
    /* the recruit's own line gets a portrait too */
    this.setNode({ who: 'you', text: c.t, next: c.go });
  },

  submitName() {
    const raw = ($('dlg-input').value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9 .'-]/g, '')
      .trim()
      .slice(0, 12);
    Career.agent = raw || 'DIVER';
    this.named = true;
    Store.set(KEYS.name, Career.agent);
    SFX.ui();
    $('dlg-in').style.display = 'none';
    try { $('dlg-input').blur(); } catch (e) { /* headless */ }
    this.go('named');
  },

  finish() {
    if (!this.active) return;
    this.active = false;
    Store.set(KEYS.seenIntro, '1');
    Store.set(KEYS.name, Career.agent);
    SFX.ui();
    if (this.onFinish) this.onFinish();
  },

  skip() {
    if (!this.active) return;
    this.active = false;
    $('dlg-in').style.display = 'none';
    try { $('dlg-input').blur(); } catch (e) { /* headless */ }
    Store.set(KEYS.seenIntro, '1');
    SFX.ui();
    if (this.onFinish) this.onFinish();
  },

  /** Number keys pick choices; Enter submits the name; Space advances. */
  onKey(code, k) {
    if (!this.active) return false;
    const inInput = document.activeElement && document.activeElement.tagName === 'INPUT';
    if (inInput) {
      if (code === 'Enter') this.submitName();
      return true;
    }
    const n = this.node;
    if (n && n.choices && !this.typing) {
      const idx = '123456789'.indexOf(k);
      if (idx >= 0 && idx < n.choices.length) { this.choose(idx); return true; }
    }
    if (code === 'Space' || code === 'Enter') { this.advance(); return true; }
    return true;
  }
};
