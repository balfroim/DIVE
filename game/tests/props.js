/* Contract and maze property checks. */
const puppeteer = require('puppeteer');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  let pass = 0;
  let fail = 0;
  const errors = [];
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', (event) => errors.push('PAGEERROR ' + event.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push('CONSOLE ' + message.text()); });
  await page.setViewport({ width: 1280, height: 800 });

  try {
    await page.goto('file:///tmp/dive_test.html', { waitUntil: 'load' });
    await sleep(800);

    const organs = await page.evaluate(() => ({
      rep0: __D.organsForRep(0).map((o) => o.id),
      rep12: __D.organsForRep(12).map((o) => o.id),
      rep100: __D.organsForRep(100).map((o) => o.id)
    }));
    if (organs.rep0.length !== 1 || organs.rep0[0] !== 'marrow') throw new Error('low reputation unlocks too many organs');
    if (organs.rep100[organs.rep100.length - 1] !== 'brain') throw new Error('high reputation does not reach the deepest organ');
    pass++;

    const variants = await page.evaluate(() => {
      const offers = [
        __D.makeContract(28, 21, 0),
        __D.makeContract(28, 21, 1),
        __D.makeContract(28, 21, 2)
      ];
      return offers.map((offer) => ({
        organ: offer.organ.id,
        mean: offer.organ.meanRep,
        difficulty: offer.difficulty,
        repGain: offer.repGain,
        repLoss: offer.repLoss
      }));
    });
    if (!(variants[0].mean <= variants[1].mean && variants[1].mean <= variants[2].mean)) {
      throw new Error('contract organs were not ordered by rep expectation');
    }
    if (!(variants[0].repLoss <= variants[1].repLoss && variants[1].repLoss <= variants[2].repLoss)) {
      throw new Error('contract variants did not scale in difficulty');
    }
    pass++;

    const previews = await page.evaluate(() => {
      const offer = __D.makeContract(28, 21, 0);
      __D.Career.offers = [offer];
      __D.UI.showBrief(0);
      __D.UI.tickPreviews(__D.Game.t);
      return {
        sig: document.getElementById('cv-sig').toDataURL(),
        tgt: document.getElementById('cv-tgt').toDataURL(),
        sym: document.getElementById('cv-sym').toDataURL()
      };
    });
    if (previews.sig === previews.tgt || previews.sig === previews.sym) {
      throw new Error('brief preview images were not entity-specific');
    }
    pass++;

    const ecs = await page.evaluate(() => {
      const e = __D.blankEnt();
      const app1 = __D.attach(e, __D.Appearance, { hue: 12, sat: 34 });
      const app2 = __D.attach(e, __D.Appearance, { hue: 48 });
      const attachedHue = e.hue;
      const beforePreview = __D.has(e, __D.Preview);
      e.preview = true;
      const previewOn = __D.has(e, __D.Preview) && e.preview;
      __D.detach(e, __D.Preview);
      const previewOff = __D.has(e, __D.Preview);
      const sig = { hue: 20, sat: 50, lit: 60, r: 18, lobes: 4, lobeAmp: 0.1, nuc: 'dot' };
      e.uid = 77;
      e.x = 11; e.y = 22; e.vx = 3; e.vy = 4; e.row = 5;
      e.age = 7; e.dying = 0.4; e.born = 2; e.leaving = true; e.lifespan = 9;
      e.infect = 0.6; e.infCd = 1.2; e.infBy = e;
      e.preview = true;
      __D.attach(e, __D.Cell);
      __D.attach(e, __D.Blood, { abo: 'A', clumpN: 3 });
      __D.morphEnt(e, 'corrupted', sig, 1, { abo: 'A', donorAbo: 'B' });
      return {
        same: app1 === app2,
        hue: attachedHue,
        beforePreview,
        previewOn,
        previewOff,
        uid: e.uid,
        pos: [e.x, e.y, e.vx, e.vy, e.row],
        life: [e.age, e.dying, e.born, e.leaving, e.lifespan],
        infection: [e.infect, e.infCd, !!e.infBy],
        preview: e.preview,
        arch: e.arch
      };
    });
    if (!ecs.same || ecs.hue !== 48) throw new Error('component reattach did not reset in place');
    if (ecs.beforePreview || !ecs.previewOn || ecs.previewOff) throw new Error('preview component did not behave like a flag');
    if (ecs.uid !== 77 || ecs.arch !== 'corrupted') throw new Error('morphEnt did not keep identity or apply the new archetype');
    if (ecs.pos[0] !== 11 || ecs.pos[1] !== 22 || ecs.pos[2] !== 3 || ecs.pos[3] !== 4 || ecs.pos[4] !== 5) {
      throw new Error('morphEnt did not preserve position and row');
    }
    if (ecs.life[0] !== 7 || ecs.life[1] !== 0.4 || ecs.life[2] !== 2 || ecs.life[3] !== true || ecs.life[4] !== 9) {
      throw new Error('morphEnt did not preserve lifecycle');
    }
    if (ecs.infection[0] !== 0.6 || ecs.infection[1] !== 1.2 || !ecs.infection[2]) {
      throw new Error('morphEnt did not preserve infection state');
    }
    if (!ecs.preview) throw new Error('morphEnt lost preview state');
    pass++;

    const spawnRows = await page.evaluate(() => {
      const contract = __D.makeContract(12, 9, 0);
      const enterRow = __D.Game.enterRow;
      __D.Game.enterRow = () => {};
      __D.Game.startContract(contract);
      const before = {
        host: __D.ents.filter((e) => e.on && e.arch === contract.hostArch).length,
        hostile: __D.ents.filter((e) => e.on && e.comp && e.comp.hostile).length
      };
      __D.Game.enterRow = enterRow;
      __D.Game.enterRow(0);
      const after = {
        host: __D.ents.filter((e) => e.on && e.arch === contract.hostArch).length,
        hostile: __D.ents.filter((e) => e.on && e.comp && e.comp.hostile).length
      };
      return { before, after };
    });
    if (spawnRows.before.host !== 0 || spawnRows.before.hostile !== 0) {
      throw new Error('host cells still spawn before the first wave');
    }
    if (spawnRows.after.host === 0 || spawnRows.after.hostile === 0) {
      throw new Error('wave spawning did not add hosts and hostiles together');
    }
    pass++;

    const generated = await page.evaluate(() => {
      const offers = [];
      for (let i = 0; i < 10; i++) {
        const offer = __D.makeContract(30 + i, i + 1, i % 3);
        offers.push({
          id: offer.id,
          rows: offer.rows,
          depth: offer.rows,
          waves: offer.waves,
          target: offer.targetSpecies
        });
      }
      return offers;
    });
    if (generated.length !== 10) throw new Error('offers were not generated');
    const allValid = generated.every((offer) => offer.rows > 0 && offer.waves > 0 && offer.target);
    if (!allValid) throw new Error('generated contract shape was invalid');
    pass++;

    const debt = await page.evaluate(() => {
      const contract = __D.makeContract(0, 7, 0);
      contract.tier = { i: 0, name: 'D', payMult: 1, lethal: false };
      contract.repLoss = 12;
      __D.Game.contract = contract;
      __D.Career.contract = contract;
      __D.Career.rep = 1;
      __D.Career.credits = -509;
      __D.Career.struckOff = false;
      __D.Career.dead = false;
      __D.Game.run = {
        bounty: 0, damages: 0, scansUsed: 0, pathKills: 0, innocent: 0, symKills: 0,
        corruptEvents: 0, shots: 0, integrity: 100, combo: 0, comboT: 0, runTime: 0,
        o2: 100, o2max: 100, siphons: 0, siphonO2: 0, siphonDamage: 0, repBribe: 0, died: false
      };
      __D.Game.state = 'play';
      __D.Game._settled = false;
      __D.Game.finish(false);
      __D.UI.afterResults();
      return {
        state: __D.Game.state,
        over: document.getElementById('scr-over').classList.contains('on'),
        finished: __D.Career.finished(),
        reason: __D.Career.reason,
        credits: Math.round(__D.Career.credits),
        rep: Math.round(__D.Career.rep)
      };
    });
    if (debt.state !== 'over' || !debt.over || !debt.finished || debt.reason !== 'debt' ||
      debt.rep !== 0 || debt.credits > 0) {
      throw new Error('reputation bribe did not trigger a debt game over');
    }
    const over = await page.evaluate(() => {
      const stats = [...document.querySelectorAll('#over-stats .stat')].map((el) => ({
        value: el.querySelector('.stat__value')?.textContent || '',
        label: el.querySelector('.stat__label')?.textContent || '',
        title: el.querySelector('.stat__value')?.getAttribute('title') || ''
      }));
      const table = document.querySelector('#scores-over table');
      const selfRow = document.querySelector('#scores-over tr[data-self="true"]');
      const selfReason = selfRow && selfRow.querySelector('td:nth-child(5)');
      const selfCredits = selfRow && selfRow.querySelector('td:last-child');
      return {
        section: document.querySelector('#scr-over .section-label')?.textContent || '',
        hasSave: !!document.getElementById('btn-save'),
        hasNameEntry: !!document.getElementById('over-name'),
        stats,
        caption: table && table.querySelector('caption') ? table.querySelector('caption').textContent : '',
        headers: table ? [...table.querySelectorAll('th')].map((th) => th.textContent) : [],
        scopes: table ? [...table.querySelectorAll('th')].every((th) => th.getAttribute('scope') === 'col') : false,
        selfRow: !!selfRow,
        selfMarker: selfRow ? selfRow.querySelector('td:nth-child(2)').textContent : '',
        selfReasonText: selfReason ? selfReason.textContent : '',
        selfCreditsText: selfCredits ? selfCredits.textContent : '',
        selfCreditsNegative: !!(selfCredits && selfCredits.hasAttribute('data-negative'))
      };
    });
    if (over.section !== 'File') throw new Error('file heading missing');
    if (over.hasSave || over.hasNameEntry) throw new Error('file button block was not removed');
    if (over.stats.length !== 9) throw new Error('wrong number of over stats');
    if (over.stats[0].value === '' || over.stats[0].label === '') throw new Error('stat value/label were not split');
    if (over.stats[7].value !== '—' || over.stats[7].title !== 'Not applicable') {
      throw new Error('oxygen left fallback did not keep its accessibility title');
    }
    if (over.caption !== 'Agent standings, current run highlighted' || !over.scopes) {
      throw new Error('leaderboard caption or scope attributes missing');
    }
    if (!over.headers.includes('End reason')) {
      throw new Error('leaderboard end reason column missing');
    }
    if (!over.selfRow || !over.selfMarker.includes('this run')) {
      throw new Error('current run row was not marked');
    }
    if (!over.selfReasonText) {
      throw new Error('current run end reason was not rendered');
    }
    if (!over.selfCreditsText || !over.selfCreditsNegative) {
      throw new Error('negative credits were not marked');
    }
    pass++;
  } catch (error) {
    fail++;
    errors.push(String(error && error.message ? error.message : error));
  }

  await browser.close();
  console.log(errors.length ? `ERRORS:\n${errors.slice(0, 6).join('\\n')}` : 'NO RUNTIME ERRORS');
  console.log(`PASS ${pass} FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
