/**
 * Screen controller: every DOM overlay, and the flow between them.
 *
 * The game loop never touches the DOM directly - it calls `Game.ui.*`, which is
 * this object. That keeps the simulation headless-testable and puts all the
 * innerHTML in one file.
 *
 * @module ui/screens
 */

import { CFG } from '../core/config.js';
import { clamp } from '../core/math.js';
import { SFX } from '../core/audio.js';
import { Store, KEYS } from '../core/store.js';
import { Input } from '../core/input.js';
import { Game } from '../game/state.js';
import { Career } from '../game/career.js';
import { offerSummary, pressureLabel, suitFor } from '../game/contracts.js';
import { repLabel } from '../game/economy.js';
import { mapFor } from '../data/maps.js';
import { SHOP } from '../data/shop.js';
import { PSPEC, NUCNAME } from '../entities/species.js';
import { anySymbiote } from '../data/enemies.js';
import { drawBody } from '../render/minimap.js';
import { $, esc, on, stop, show, hideAll, cr } from './dom.js';
import { DLG } from './dialogue.js';
import { previewEnt, paintPreview } from './previews.js';

/** Live specimens on the briefing cards. */
const preview = { sig: null, tgt: null, sym: null };

function hover(text, tip) {
  return '<span class="hoverterm" title="' + esc(tip || '') + '">' + esc(text) + '</span>';
}

function paintSiteMap(canvas, organ, t) {
  if (!canvas || !organ || !canvas.getContext) return;
  const c = canvas.getContext('2d');
  const S = canvas.width;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, S, S);
  const map = organ.map && mapFor(organ.map);
  if (!map) {
    drawBody(c, 12, 10, S - 24, S - 20, organ, 0.5 + 0.5 * Math.sin(t * 2.2));
    return;
  }
  const rows = map.rows;
  const maxCols = rows.reduce((m, row) => Math.max(m, row.length), 0);
  const scale = Math.min((S - 18) / Math.max(1, maxCols), (S - 22) / Math.max(1, rows.length));
  const x = (S - maxCols * scale) / 2;
  const y = (S - rows.length * scale) / 2;
  const labelY = Math.max(10, y - Math.max(4, Math.floor(scale * 0.3)));
  c.font = Math.max(8, Math.floor(scale * 0.86)) + 'px ui-monospace,SFMono-Regular,Menlo,monospace';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = 'rgba(255,255,255,0.22)';
  c.fillText(map.id.toUpperCase(), S * 0.5, labelY);
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let col = 0; col < maxCols; col++) {
      const ch = row[col] || ' ';
      if (ch === ' ') continue;
      c.fillStyle = ch === 'O'
        ? 'rgba(110,232,255,0.95)'
        : ch === 'E'
          ? 'rgba(255,194,90,0.92)'
          : ch === '#'
            ? 'rgba(255,230,239,0.80)'
            : 'rgba(255,230,239,0.60)';
      c.fillText(ch, x + col * scale + scale * 0.5, y + r * scale + scale * 0.5);
    }
  }
}

export const UI = {
  devMode: false,

  /* ---------------------------------------------------------------- */
  /* start                                                             */
  /* ---------------------------------------------------------------- */

  setDevMode(on) {
    this.devMode = !!on;
    const el = $('dev-tools');
    if (el) el.hidden = !this.devMode;
    if (this.devMode) this.syncDevTools();
  },

  syncDevTools() {
    const rep = $('dev-rep');
    if (rep) {
      rep.max = String(CFG.rep.max);
      rep.value = String(Math.round(Career.rep));
    }
    const credits = $('dev-credits');
    if (credits) credits.value = String(Math.round(Career.credits));
    const scans = $('dev-scans');
    if (scans) scans.value = String(Math.max(0, Math.round(Career.scans)));
  },

  refreshDevView() {
    if (!this.devMode) return;
    this.syncDevTools();
    if (Game.state === 'board') {
      Career.refreshBoard();
      this.paintBoard();
    }
  },

  devSetRep(rep) {
    const n = Number(rep);
    if (!Number.isFinite(n)) return;
    Career.setDevPreset({ rep: n });
    this.refreshDevView();
  },

  devSetCredits(credits) {
    const n = Number(credits);
    if (!Number.isFinite(n)) return;
    Career.setDevPreset({ credits: n });
    this.refreshDevView();
  },

  devSetScans(scans) {
    const n = Number(scans);
    if (!Number.isFinite(n)) return;
    Career.setDevPreset({ scans: n });
    this.refreshDevView();
  },

  devNudgeRep(delta) {
    this.devSetRep(Number(Career.rep) + delta);
  },

  devNudgeCredits(delta) {
    this.devSetCredits(Number(Career.credits) + delta);
  },

  devNudgeScans(delta) {
    this.devSetScans(Number(Career.scans) + delta);
  },

  showStart() {
    Game.state = 'start';
    show('start');
    this.syncDevTools();
    const saved = Store.getJSON(KEYS.career, null);
    const cont = $('btn-continue');
    if (cont) cont.style.display = saved && !saved.struckOff && !saved.dead ? '' : 'none';
    this.paintScores('scores-start');
  },

  /** Begin a brand new career: the induction always plays, and names you. */
  newCareer() {
    Career.reset(Store.get(KEYS.name, 'AGENT'));
    Game.state = 'dialog';
    show('dialog');
    DLG.onFinish = () => UI.showBoard();
    DLG.start('s0');
  },

  continueCareer() {
    if (!Career.load()) { this.newCareer(); return; }
    if (Career.finished()) { this.showOver(false); return; }
    this.showBoard();
  },

  /* ---------------------------------------------------------------- */
  /* job board                                                         */
  /* ---------------------------------------------------------------- */

  showBoard() {
    Game.state = 'board';
    if (Career.finished()) { this.showOver(false); return; }
    if (!Career.offers.length) Career.refreshBoard();
    show('board');
    this.syncDevTools();
    this.paintBoard();
  },

  paintBoard() {
    $('lic-class').textContent = repLabel(Career.rep);
    $('lic-rep').textContent = Math.round(Career.rep);
    $('lic-bar').style.width = clamp(Career.rep, 0, 100) + '%';
    $('lic-bank').textContent = cr(Career.credits);
    $('lic-scans').textContent = Career.scans;
    $('board-kicker').textContent = 'Contract board \u00b7 ' + Career.agent;

    const box = $('board-offers');
    box.innerHTML = '';
    Career.offers.forEach((offer, i) => {
      const s = offerSummary(offer);
      const el = document.createElement('div');
      el.className = 'offer' + (s.lethal ? ' risky' : '');
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.dataset.i = String(i);
      el.innerHTML =
        '<div>' +
          '<div class="job"><span class="tierpill t' + offer.tier.i + '">TIER ' + s.tier + '</span>' + esc(s.job) + '</div>' +
          '<div class="sub">' + esc(s.site) + ' \u00b7 depth ' + s.depth + ' \u00b7 ' + s.waves + ' waves \u00b7 ' +
            s.band + ' pressure ' + s.pressure + ' \u00b7 suit ' + s.suit + ' \u00b7 ' + esc(s.difficulty) + '</div>' +
        '</div>' +
        '<div>' +
          '<div class="pay">' + (s.fee + s.comp) + ' cr</div>' +
          '<div class="paysub">+' + s.rep + ' rep \u00b7 \u2212' + s.risk + ' if lost</div>' +
        '</div>';
      const openIt = () => UI.showBrief(i);
      el.addEventListener('click', openIt);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openIt(); } });
      box.appendChild(el);
    });

    const worst = Career.offers.some((o) => o.tier.lethal);
    $('board-memo').innerHTML = worst
      ? '<b>Vax:</b> Note the insured names on today\u2019s board. If one of them dies down there, the claim outlives your licence.'
      : '<b>Vax:</b> Nothing on the board today would be missed. Ideal conditions for building a reputation.';
  },

  /* ---------------------------------------------------------------- */
  /* briefing                                                          */
  /* ---------------------------------------------------------------- */

  showBrief(i) {
    const offer = Career.offers[i];
    if (!offer) return;
    Career.pending = offer;
    Game.state = 'brief';
    show('brief');
    const s = offerSummary(offer);

    $('brief-num').textContent = 'Work order ' + offer.id + ' \u00b7 ' + Career.agent;
    $('brief-client').textContent = offer.client.job;
    $('brief-site').innerHTML = esc(s.job) + ' \u00b7 ' + hover(s.site, s.note);

    const chips = [
      ['TIER', s.tier + ' \u00b7 ' + s.tierLabel],
      ['SITE', s.organ],
      ['DEPTH', s.depth + ' rows'],
      ['WAVES', String(s.waves)],
      ['CONTRACT', s.difficulty],
      ['PRESSURE', s.band + ' ' + s.pressure],
      ['SUIT', 'rating ' + s.suit + (Career.suit >= s.suit ? ' \u2713' : ' \u2717 yours ' + Career.suit)],
      ['ADVANCE', s.fee + ' cr'],
      ['COMPLETION', s.comp + ' cr'],
      ['REPUTATION', '+' + s.rep + ' / \u2212' + s.risk]
    ];
    $('brief-chips').innerHTML = chips
      .map((c) => '<span class="chip"><b>' + c[0] + '</b> ' + esc(c[1]) + '</span>')
      .join('');

    /* specimens */
    preview.sig = previewEnt(offer.hostArch, offer.sig, 1);
    preview.tgt = previewEnt(offer.targetSpecies, offer.sig, offer.deviation);
    preview.sym = previewEnt(anySymbiote(), offer.sig, 1);
    const spec = PSPEC[offer.targetSpecies];
    $('brief-sigdesc').textContent = NUCNAME[offer.sig.nuc] + ' \u00b7 ' + Math.round(offer.sig.hue) + '\u00b0 hue';
    $('brief-tgtdesc').textContent = spec ? spec.desc : '';
    $('brief-tgtname').textContent = (spec ? spec.name : offer.targetSpecies) +
      (offer.deviation < 0.55 ? ' \u00b7 LOW DEVIATION, HARD TO CALL' : '');
    $('brief-kit').textContent = 'KIT: ' + (Career.scans + CFG.econ.issue) + ' SCAN CHARGES ON ENTRY' +
      (Career.waiver ? ' \u00b7 WAIVER \u00d7' + Career.waiver : '') +
      (Career.stab ? ' \u00b7 STABILISER READY' : '');
    $('brief-mapnote').innerHTML = '<b>Map note</b>' + esc(s.note);
    $('brief-mapdesc').textContent = (s.map ? s.map.toUpperCase() + ' MAP \u00b7 ' : '') +
      s.site + ' \u00b7 ' + s.depth + ' rows \u00b7 ' + s.pressure + ' P';
    paintSiteMap($('cv-site'), offer.organ, Game.t);

    const under = Career.suit < s.suit;
    $('brief-warn').className = 'warnline' + (under || s.lethal ? '' : ' okline');
    $('brief-warn').innerHTML = under
      ? '<b>SUIT UNDER-RATED.</b> Your shell is rating ' + Career.suit + ' against ' + s.band.toLowerCase() +
        ' pressure. You will be shoved downstream and the corridors will squeeze. You may dive anyway. Many do.'
      : s.lethal
        ? '<b>INSURED CLIENT.</b> If this one dies, Legal terminates your licence. The white cell kills everything on its path \u2014 mind your angles.'
        : '<b>UNINSURED CLIENT.</b> A casualty here is billable, not terminal. Good conditions to learn the vessel.';

  },

  dive() {
    const offer = Career.pending;
    if (!offer) return;
    Career.accept(offer);
    hideAll();
    Game.startContract(offer);
  },

  /* ---------------------------------------------------------------- */
  /* pause                                                             */
  /* ---------------------------------------------------------------- */

  showPause() {
    show('pause');
    const run = Game.run;
    const tiles = [
      [cr(run.bounty - run.damages), 'Net so far'],
      [Game.wave + '/' + Game.waveTotal, 'Wave'],
      [Math.max(0, Math.round(run.integrity)) + '%', 'Integrity'],
      [String(Career.scans), 'Charges left']
    ];
    $('pause-stats').innerHTML = tiles
      .map((t) => '<div class="stat"><b>' + esc(t[0]) + '</b><span>' + esc(t[1]) + '</span></div>')
      .join('');
  },

  hideOverlays() { hideAll(); },

  /* ---------------------------------------------------------------- */
  /* results                                                           */
  /* ---------------------------------------------------------------- */

  showResults(result) {
    show('results');
    const c = Game.contract || Career.pending;
    const good = result.success;
    const dead = Career.dead;
    const struck = Career.struckOff;
    const o2Left = Math.max(0, Math.round(result.o2Left || 0));
    Career.lastO2Left = o2Left;
    $('res-kicker').textContent = 'Extraction report \u00b7 ' + (c ? c.id : '');
    $('res-title').textContent = dead
      ? '\u2620 Diver lost'
      : struck
        ? '\u26a0 Licence revoked'
        : good
          ? '\u2713 Contract closed'
          : 'Client lost';
    $('res-sub').textContent = dead
      ? 'O\u2082 left ' + o2Left + 's \u00b7 body recovery billed to the estate'
      : struck
        ? (Career.reason === 'debt'
          ? 'O\u2082 left ' + o2Left + 's \u00b7 negative balance terminated the file'
          : 'O\u2082 left ' + o2Left + 's \u00b7 the licence was removed')
        : good
          ? 'O\u2082 left ' + o2Left + 's \u00b7 client viable at ' + Math.round(result.integrity) + '%'
          : 'O\u2082 left ' + o2Left + 's \u00b7 extraction under protest';

    const rows = result.lines
      .map((l) => '<div class="inv-row"><span>' + esc(l.label) +
        (l.note ? ' <i style="opacity:.6">' + esc(l.note) + '</i>' : '') +
        '</span><b class="' + (l.amount < 0 ? 'neg' : '') + '">' + cr(l.amount) + '</b></div>')
      .join('');
    const repRow = '<div class="inv-row"><span>Reputation</span><b class="' +
      (result.repDelta < 0 ? 'neg' : '') + '">' +
      (result.repDelta >= 0 ? '+' : '\u2212') + Math.abs(result.repDelta) + '</b></div>';
    $('res-inv').innerHTML = rows +
      '<div class="inv-row total"><span>Net</span><b class="' + (result.net < 0 ? 'neg' : '') + '">' +
      cr(result.net) + '</b></div>' + repRow +
      '<div class="inv-row"><span>Oxygen left</span><b class="' + (dead && o2Left <= 0 ? 'neg' : '') + '">' +
      o2Left + 's</b></div>' +
      '<div class="inv-row"><span>Balance</span><b>' + cr(Career.credits) + '</b></div>';

    let memo;
    if (dead) {
      memo = '<b>Vax:</b> You did not surface. The tank hit zero, the body was bagged, and Accounts has already opened the estate.';
    } else if (struck) {
      memo = Career.reason === 'debt'
        ? '<b>Vax:</b> Your balance is negative and your licence is collateral. The Division has exercised its option. Badge, please.'
        : '<b>Vax:</b> The claim has been filed. I did warn you about the insured ones. Your licence is suspended pending a hearing you will not be invited to.';
    } else if (Career.credits < 0) {
      memo = '<b>Vax:</b> You are ' + cr(-Career.credits) + ' in the red. The Division is content to let you work it off \u2014 ' +
        'that is what the licence is for. Fall past ' + cr(-CFG.econ.debtFloor) + ' owed and it stops being content.';
    } else if (!good) {
      memo = '<b>Vax:</b> Uninsured, thankfully. The file has been closed and the reputation adjusted. Try to lose fewer of them.';
    } else if (Game.run.innocent > 0) {
      memo = '<b>Vax:</b> Closed, but you shredded ' + Game.run.innocent + ' of the client\u2019s own cells. The invoice reflects it. So does your file.';
    } else {
      memo = '<b>Vax:</b> Clean work. The board will reflect your standing shortly.';
    }
    $('res-memo').innerHTML = memo;
    $('btn-res-next').textContent = Career.finished() ? 'Collect your badge' : 'Requisitions';
  },

  /* ---------------------------------------------------------------- */
  /* shop                                                              */
  /* ---------------------------------------------------------------- */

  showShop() {
    Game.state = 'shop';
    show('shop');
    $('shop-bank').textContent = 'Balance ' + cr(Career.credits) + ' \u00b7 licence ' + repLabel(Career.rep);
    const box = $('shop-list');
    box.innerHTML = '';
    SHOP.forEach((item) => {
      const cost = item.cost(Career);
      const afford = Career.credits >= cost;
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.innerHTML =
        '<div><b>' + esc(item.name) + '</b><span>' + esc(item.desc) + '</span>' +
        '<span class="owned">' + esc(item.owned(Career)) + '</span></div>' +
        '<button class="btn ghost" ' + (afford ? '' : 'disabled') + '>' + cost + ' cr</button>';
      el.querySelector('button').addEventListener('click', () => {
        if (Career.credits < cost) return;
        Career.credits -= cost;
        item.buy(Career);
        Career.save();
        SFX.ui();
        UI.showShop();
      });
      box.appendChild(el);
    });
  },

  /* ---------------------------------------------------------------- */
  /* career over                                                       */
  /* ---------------------------------------------------------------- */

  showOver(retired) {
    Game.state = 'over';
    show('over');
    this.syncDevTools();
    const struck = Career.struckOff;
    const dead = Career.dead;
    $('over-title').textContent = dead
      ? 'Deceased'
      : retired
        ? '\u25c7 Retired'
        : struck
          ? '\u26a0 Licence revoked'
          : 'Career closed';
    let sub = '';
    if (dead) sub = 'O\u2082 exhausted \u00b7 did not surface from the dive.';
    else if (retired) sub = 'You surfaced with the money and the badge.';
    else if (Career.reason === 'debt') sub = 'Negative balance \u00b7 licence surrendered.';
    else if (Career.reason === 'litigation') sub = 'Insured casualty \u00b7 licence revoked.';
    $('over-sub').textContent = sub;
    const tiles = [
      [String(Career.contracts), 'Contracts closed'],
      [String(Career.lost), 'Clients lost'],
      [Math.round(Career.rep) + '', 'Reputation'],
      [Career.bestTier, 'Highest tier'],
      [String(Career.pathogens), 'Pathogens'],
      [String(Career.wrongful), 'Wrongful kills'],
      [String(Career.charges), 'Charges fired'],
      [dead ? (Career.lastO2Left + 's') : '—', 'Oxygen left'],
      [cr(Career.credits), 'Final balance']
    ];
    $('over-stats').innerHTML = tiles
      .map((t) => '<div class="stat"><b>' + esc(t[0]) + '</b><span>' + esc(t[1]) + '</span></div>')
      .join('');
    const inp = $('inp-name');
    if (inp) inp.value = Career.agent;
    this.paintScores('scores-over');
  },

  saveScore() {
    const inp = $('inp-name');
    if (inp) {
      Career.agent = (inp.value || Career.agent).toUpperCase().slice(0, 12);
      try { inp.blur(); } catch (e) { /* headless */ }
    }
    Career.filePayroll();
    Store.set(KEYS.name, Career.agent);
    $('over-name').style.display = 'none';
    this.paintScores('scores-over');
    SFX.ui();
  },

  paintScores(id) {
    const el = $(id);
    if (!el) return;
    const list = Career.payroll();
    if (!list.length) {
      el.innerHTML = '<div class="empty">No payroll records on file.</div>';
      return;
    }
    el.innerHTML = '<table class="scores"><tbody>' + list.map((s, i) =>
      '<tr><td>' + (i + 1) + '</td><td>' + esc(s.name) + '</td><td>' +
      (s.tier || 'D') + '</td><td>' + (s.rep === undefined ? '' : s.rep + ' rep') + '</td><td>' +
      cr(s.cr) + '</td></tr>').join('') + '</tbody></table>';
  },

  /* ---------------------------------------------------------------- */
  /* flow + keys                                                       */
  /* ---------------------------------------------------------------- */

  afterResults() {
    if (Career.finished()) { this.showOver(false); return; }
    Career.refreshBoard();
    this.showShop();
  },

  /** Returns true when the key was consumed by a screen. */
  onKey(code, k) {
    const go = code === 'Space' || code === 'Enter';
    switch (Game.state) {
      case 'start':
        if (go) { this.newCareer(); return true; }
        return false;
      case 'dialog':
        return DLG.onKey(code, k);
      case 'board':
        if (k === '1' || k === '2' || k === '3') {
          const i = parseInt(k, 10) - 1;
          if (Career.offers[i]) { this.showBrief(i); return true; }
        }
        return false;
      case 'brief':
        if (go) { this.dive(); return true; }
        if (code === 'Escape') { this.showBoard(); return true; }
        return false;
      case 'results':
        if (go) { this.afterResults(); return true; }
        return false;
      case 'shop':
        if (go) { this.showBoard(); return true; }
        return false;
      case 'over': {
        const inInput = document.activeElement && document.activeElement.tagName === 'INPUT';
        if (inInput) { if (code === 'Enter') this.saveScore(); return true; }
        if (k === 'r' || go) { this.newCareer(); return true; }
        return false;
      }
      default:
        return false;
    }
  },

  /** Keep the briefing specimens spinning. */
  tickPreviews(t) {
    if (Game.state !== 'brief') return;
    for (const key of ['sig', 'tgt', 'sym']) {
      const e = preview[key];
      if (!e) continue;
      e.phase += 0.02;
      e.ang += 0.004;
    }
    paintPreview($('cv-sig'), preview.sig, t);
    paintPreview($('cv-tgt'), preview.tgt, t);
    paintPreview($('cv-sym'), preview.sym, t);
    paintSiteMap($('cv-site'), Career.pending ? Career.pending.organ : Game.contract && Game.contract.organ, t);
  }
};

/** Wire every button once, at boot. */
export function wireUI() {
  Game.ui = UI;

  on('btn-play', 'click', () => UI.newCareer());
  on('btn-continue', 'click', () => UI.continueCareer());

  on('scr-dialog', 'click', () => DLG.advance());
  on('btn-skip', 'click', stop(() => DLG.skip()));
  on('dlg-ok', 'click', stop(() => DLG.submitName()));
  on('dlg-input', 'click', stop(() => {}));
  on('dlg-input', 'keydown', (e) => { if (e.key === 'Enter') { e.stopPropagation(); DLG.submitName(); } });

  on('btn-shop', 'click', () => UI.showShop());
  on('btn-retire', 'click', () => { Career.filePayroll(); UI.showOver(true); });

  on('btn-dive', 'click', () => UI.dive());
  on('btn-decline', 'click', () => UI.showBoard());

  on('btn-resume', 'click', () => Game.resume());
  on('btn-pause-abort', 'click', () => Game.abandon());

  on('btn-res-next', 'click', () => UI.afterResults());
  on('btn-shop-done', 'click', () => UI.showBoard());

  on('btn-save', 'click', () => UI.saveScore());
  on('btn-again', 'click', () => UI.newCareer());

  on('dev-rep', 'change', (e) => UI.devSetRep(e.target.value));
  on('dev-credits', 'change', (e) => UI.devSetCredits(e.target.value));
  on('dev-scans', 'change', (e) => UI.devSetScans(e.target.value));
  on('dev-rep-down', 'click', () => UI.devNudgeRep(-10));
  on('dev-rep-up', 'click', () => UI.devNudgeRep(10));
  on('dev-credits-down', 'click', () => UI.devNudgeCredits(-250));
  on('dev-credits-up', 'click', () => UI.devNudgeCredits(250));
  on('dev-scans-down', 'click', () => UI.devNudgeScans(-1));
  on('dev-scans-up', 'click', () => UI.devNudgeScans(1));
  on('dev-refresh', 'click', () => {
    Career.refreshBoard();
    UI.refreshDevView();
  });
  on('dev-reset', 'click', () => {
    Career.resetDevPreset();
    UI.refreshDevView();
  });
}
