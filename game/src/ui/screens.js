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
import { Game } from '../game/state.js';
import { Career } from '../game/career.js';
import { offerSummary} from '../game/contracts.js';
import { repLabel } from '../game/economy.js';
import { mapFor } from '../data/maps.js';
import { SHOP } from '../data/shop.js';
import { PSPEC } from '../entities/species.js';
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

function blockedSuitCopy(s, currentSuit) {
  return 'Suit rating ' + s.suit + ' is required for ' + s.band.toLowerCase() +
    ' pressure; yours is ' + currentSuit + '.';
}

function endReasonLabel(reason) {
  switch (reason) {
    case 'debt': return 'Debt';
    case 'litigation': return 'Litigation';
    case 'asphyxia': return 'Asphyxia';
    case 'retired': return 'Retired';
    default: return reason ? reason.replace(/^\w/, (c) => c.toUpperCase()) : 'Retired';
  }
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
  c.font = Math.max(8, Math.floor(scale * 0.86)) + 'px ui-monospace,SFMono-Regular,Menlo,monospace';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
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

const SIGILS = {
  scans: '<svg class="item__sigil" aria-hidden="true" viewBox="0 0 48 48">' +
    '<circle cx="24" cy="24" r="3"/>' +
    '<path d="M16 24a8 8 0 0 1 8-8"/>' +
    '<path d="M12 24a12 12 0 0 1 12-12"/>' +
    '<path d="M8 24a16 16 0 0 1 16-16"/>' +
    '</svg>',
  suit: '<svg class="item__sigil" aria-hidden="true" viewBox="0 0 48 48">' +
    '<polygon points="24,6 39,15 39,33 24,42 9,33 9,15" stroke-width="2.5"/>' +
    '<polygon points="24,13 33,18.5 33,29.5 24,35 15,29.5 15,18.5" stroke-width="1.5"/>' +
    '</svg>',
  stab: '<svg class="item__sigil" aria-hidden="true" viewBox="0 0 48 48">' +
    '<path d="M18 10h12v6a6 6 0 0 1 0 12v10H18V28a6 6 0 0 1 0-12z"/>' +
    '<line x1="21" y1="28" x2="27" y2="38"/>' +
    '<line x1="24" y1="28" x2="30" y2="38"/>' +
    '</svg>',
  waiver: '<svg class="item__sigil" aria-hidden="true" viewBox="0 0 48 48">' +
    '<path d="M24 6l16 8v12c0 9-7 16-16 18C15 42 8 35 8 26V14z"/>' +
    '<line x1="16" y1="32" x2="32" y2="16"/>' +
    '</svg>',
  boost: '<svg class="item__sigil" aria-hidden="true" viewBox="0 0 48 48">' +
    '<polyline points="12,34 24,22 36,34"/>' +
    '<polyline points="12,26 24,14 36,26"/>' +
    '</svg>',
  tank: '<svg class="item__sigil" aria-hidden="true" viewBox="0 0 48 48">' +
    '<rect x="16" y="8" width="16" height="28" rx="8"/>' +
    '<line x1="24" y1="36" x2="24" y2="42"/>' +
    '<line x1="20" y1="42" x2="28" y2="42"/>' +
    '<line x1="20" y1="16" x2="28" y2="16"/>' +
    '<line x1="20" y1="22" x2="28" y2="22"/>' +
    '</svg>'
};

function shopSigil(id) {
  return SIGILS[id] || '';
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
    Career.pendingSummary = null;
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
      const suitState = Career.suit >= s.suit ? 'ready' : Career.suit === s.suit - 1 ? 'marginal' : 'blocked';
      const suitIcon = suitState === 'ready' ? '\u2713' : suitState === 'marginal' ? '\u26a0' : '\u2716';
      const pressureClass = 'pressurepill--' + s.band.toLowerCase();
      const difficultyClass = 'diffpill--' + s.difficultyKey.toLowerCase();
      const el = document.createElement('div');
      el.className = 'offer' + (s.lethal ? ' risky' : '');
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.dataset.i = String(i);
      el.innerHTML =
        '<div>' +
          '<div class="job"><span class="tierpill t' + offer.tier.i + '">TIER ' + s.tier + '</span>' + esc(s.job) + '</div>' +
          '<div class="sub">' + esc(s.site) + ' \u00b7 depth ' + s.depth + ' \u00b7 ' + s.waves + ' waves \u00b7 ' +
            '<span class="pressurepill ' + pressureClass + '">pressure ' + esc(s.band.toLowerCase()) + '</span>' +
            ' \u00b7 ' +
            '<span class="suitpill suitpill--' + suitState + '">' + suitIcon + ' suit\u00a0' + s.suit + '</span>' +
            ' \u00b7 ' +
            '<span class="diffpill ' + difficultyClass + '">' + esc(s.difficulty.toLowerCase()) + '</span></div>' +
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

    const kitPanel = $('board-kit');
    if (kitPanel) {
      const o2Capacity = Career.o2Max();
      const boostPct = Career.payBoost > 0 ? '+' + Math.round(Career.payBoost * 100) + '%' : '\u2014';
      kitPanel.innerHTML =
        '<div class="kit-heading">Your kit</div>' +
        '<dl class="kit-list">' +
          '<div class="kit-row"><dt>Suit</dt><dd class="kit-val">' + Career.suit + '</dd></div>' +
          '<div class="kit-row"><dt>O\u2082 tank</dt><dd class="kit-val">' + o2Capacity + 's</dd></div>' +
          '<div class="kit-row"><dt>Scans</dt><dd class="kit-val">' + Career.scans + '</dd></div>' +
          '<div class="kit-row"><dt>Stabilisers</dt><dd class="kit-val">' + Career.stab + '</dd></div>' +
          '<div class="kit-row"><dt>Waivers</dt><dd class="kit-val">' + Career.waiver + '</dd></div>' +
          '<div class="kit-row"><dt>Pay boost</dt><dd class="kit-val">' + boostPct + '</dd></div>' +
        '</dl>';
    }
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
    Career.pendingSummary = s;

    $('brief-num').textContent = 'Work order ' + offer.id;
    $('brief-client').textContent = offer.client.job;
    // $('brief-title').innerHTML = esc(s.typeShort) + ' \u00b7 ' + esc(s.typeName) + ' \u00b7 ' + esc(s.objective);

    /* specimens */
    const ctx = offer.type === 'transfusion'
      ? { abo: offer.abo, donorAbo: offer.donorAbo }
      : null;
    preview.sig = previewEnt('host', offer.sig, offer.deviation, ctx);
    preview.tgt = previewEnt(offer.targetSpecies, offer.sig, offer.deviation, ctx);
    preview.sym = previewEnt(anySymbiote(), offer.sig, offer.deviation);
    const spec = PSPEC[offer.targetSpecies];
    $('brief-depth').textContent = s.depth;
    $('brief-waves').textContent = String(s.waves);
    $('brief-mapnote').textContent = s.note;
    $('brief-site').textContent = offer.organ.name + ' (' + offer.organ.short + ')';
    $('brief-mapdesc').textContent = s.band;
    $('brief-tgtname').textContent = offer.type === 'transfusion' && offer.donorAbo
      ? `TYPE ${offer.donorAbo} · DONOR CELL`
      : `${spec.name}`;
    $('brief-tgtdesc').textContent = offer.type === 'transfusion' && offer.typeNote
      ? `${spec.desc} CLIENT GROUP ${offer.abo} · DONOR GROUP ${offer.donorAbo}`
      : `${spec.desc}`;
    $('brief-goal-label').textContent = esc(s.typeShort);
    $('brief-goal').textContent = s.objective;
    $('brief-tier').dataset.severity = s.difficultyKey === 'HARD' ? 'high' : s.difficultyKey === 'EASY' ? 'low' : 'mid';
    $('brief-grade').textContent = s.difficulty;
    const suitState = Career.suit >= s.suit ? 'ready' : Career.suit === s.suit - 1 ? 'marginal' : 'blocked';
    const suitBox = $('brief-suitbox');
    suitBox.dataset.state = suitState;
    $('brief-suit').innerHTML = suitState === 'ready'
      ? '<span>\u2713</span><span>' + s.suit + '</span>'
      : suitState === 'marginal'
        ? '<span>\u26a0</span><span>' + s.suit + '</span>'
        : '<span>\u2716</span><span>' + s.suit + '</span>';
    $('brief-total').textContent = cr(s.fee + s.comp);
    $('brief-total-tier').textContent = s.tier + ' \u00b7 ' + s.tierLabel;
    $('brief-total-note').textContent = s.tierNote;
    $('brief-rep-gain').textContent = '+' + s.rep;
    $('brief-rep-loss').textContent = '\u2212' + s.risk;
    paintSiteMap($('cv-site'), offer.organ, Game.t);

    const under = Career.suit < s.suit;
    const diveBtn = $('btn-dive');
    if (diveBtn) diveBtn.disabled = under;

  },

  dive() {
    const offer = Career.pending;
    if (!offer) return;
    const s = Career.pendingSummary || offerSummary(offer);
    if (Career.suit < s.suit) {
      return;
    }
    Career.accept(offer);
    Career.pendingSummary = null;
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
    $('btn-res-next').textContent = Career.finished() ? 'Collect your badge' : 'Back to shop';
  },

  /* ---------------------------------------------------------------- */
  /* shop                                                              */
  /* ---------------------------------------------------------------- */

  /* shop                                                              */
  /* ---------------------------------------------------------------- */

  showShop() {
    Game.state = 'shop';
    show('shop');
    $('shop-balance').textContent = cr(Career.credits);
    $('shop-licence').textContent = repLabel(Career.rep);
    const box = $('shop-list');
    box.innerHTML = '';
    SHOP.forEach((item) => {
      const cost = item.cost(Career);
      const afford = Career.credits >= cost;
      const shortfall = cost - Career.credits;
      const held = item.held || item.owned || (() => '—');
      const heldLabel = item.heldLabel || item.ownedLabel || 'Held';
      const li = document.createElement('li');
      const article = document.createElement('article');
      article.className = 'item';
      article.dataset.category = item.category;
      article.dataset.state = afford ? 'available' : 'unaffordable';
      const catLabel = item.category.charAt(0).toUpperCase() + item.category.slice(1);
      article.innerHTML =
        '<div class="item__tile">' +
          shopSigil(item.id) +
          '<span class="item__tag">' + esc(catLabel) + '</span>' +
        '</div>' +
        '<h3 class="item__name">' + esc(item.name) + '</h3>' +
        '<p class="item__desc prose">' + esc(item.desc) + '</p>' +
        '<dl class="item__held">' +
          '<dt class="label">' + esc(heldLabel) + '</dt>' +
          '<dd class="value">' + esc(held(Career)) + '</dd>' +
        '</dl>' +
        (!afford ? '<p class="item__short label">Need ' + esc(cr(shortfall)) + ' more</p>' : '') +
        '<footer class="item__foot">' +
          '<span class="item__price value">' + esc(cr(cost)) + '</span>' +
          '<button class="btn btn--primary btn--sm" type="button"' +
            (afford ? '' : ' disabled') + '>Buy</button>' +
        '</footer>';
      article.querySelector('button').addEventListener('click', () => {
        if (Career.credits < cost) return;
        Career.credits -= cost;
        item.buy(Career);
        Career.save();
        SFX.ui();
        UI.showShop();
      });
      li.appendChild(article);
      box.appendChild(li);
    });
  },

  /* ---------------------------------------------------------------- */
  /* career over                                                       */
  /* ---------------------------------------------------------------- */

  showOver(retired) {
    Game.state = 'over';
    show('over');
    this.syncDevTools();
    if (retired && !Career.reason) Career.reason = 'retired';
    Career.filePayroll();
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
      [dead ? (Career.lastO2Left + 's') : '—', 'Oxygen left', dead ? '' : 'Not applicable'],
      [cr(Career.credits), 'Final balance']
    ];
    $('over-stats').innerHTML = tiles
      .map((t) => '<li class="stat"><span class="stat__value value"' + (t[2] ? ' title="' + esc(t[2]) + '"' : '') + '>' + esc(t[0]) + '</span><span class="stat__label label">' + esc(t[1]) + '</span></li>')
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
    el.innerHTML = '<table class="board"><caption class="sr-only">Agent standings, current run highlighted</caption><thead><tr><th scope="col">#</th><th scope="col">Agent</th><th scope="col">Tier</th><th scope="col">Rep</th><th scope="col">End reason</th><th scope="col">Credits</th></tr></thead><tbody>' +
      list.map((s, i) => {
        const self = s.d === Career.lastFiledAt;
        return '<tr' + (self ? ' data-self="true"' : '') + '>' +
          '<td class="n">' + (i + 1) + '</td>' +
          '<td>' + (self ? '<span aria-hidden="true">&#9656; </span>' + esc(s.name) + '<span class="sr-only"> (this run)</span>' : esc(s.name)) + '</td>' +
          '<td>' + esc(s.tier || 'D') + '</td>' +
          '<td class="w">' + (s.rep === undefined ? '' : s.rep) + '</td>' +
          '<td>' + esc(endReasonLabel(s.reason)) + '</td>' +
          '<td class="s"' + (s.cr < 0 ? ' data-negative="true"' : '') + '>' + cr(s.cr) + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table>';
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
  on('btn-retire', 'click', () => { UI.showOver(true); });

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
