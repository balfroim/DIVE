/* End-to-end flow checks for onboarding, contract selection, and dive start. */
const puppeteer = require('puppeteer');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


async function captureBrief(page, organId, seed) {
  return page.evaluate(({ organId: id, seed: s }) => {
    const organ = __D.ORGANS.find((o) => o.id === id);
    const offer = __D.makeContract(0, s, 0);
    offer.organ = organ;
    offer.rows = organ.depth;
    offer.pressure = organ.pressure;
    offer.waves = offer.rows;
    offer.diff = 1;
    offer.fee = 111;
    offer.comp = 222;
    offer.repGain = 3;
    offer.repLoss = 1;
    __D.Career.offers = [offer];
    __D.UI.showBrief(0);
    const canvas = document.getElementById('cv-site');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = false;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 0) { painted = true; break; }
    }
    const pressureLabel = (p) => {
      if (p < 1.0) return 'LOW';
      if (p < 1.3) return 'NORMAL';
      if (p < 1.6) return 'RAISED';
      if (p < 2.0) return 'HIGH';
      return 'CRISIS';
    }
    return {
      visible: document.getElementById('scr-brief').classList.contains('on'),
      site: document.getElementById('brief-site').textContent,
      expectedSite: organ.name + ' (' + organ.short + ')',
      grade: document.getElementById('brief-grade').textContent,
      readiness: document.getElementById('brief-suitbox').dataset.state,
      total: document.getElementById('brief-total').textContent,
      contract: !!__D.Career.pending,
      mapPainted: painted,
      pressure: pressureLabel(offer.pressure),
      mapPressure: parseFloat(document.getElementById('brief-mapdesc').textContent),
      mapLink: __D.Career.pending.organ.map ?? null,
      expectedMapLink: organ.map ?? null
    };
  }, { organId, seed });
}

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
    await sleep(1000);

    await page.click('#btn-play');
    await sleep(500);
    await page.evaluate(() => __D.DLG.skip());
    await sleep(500);
    await page.evaluate(() => { __D.Career.suit = 0; });

    const brief = await captureBrief(page, 'lung', 12345);
    if (!brief.visible) throw new Error('briefing screen not visible');
    if (!brief.site || brief.site !== brief.expectedSite) {
      throw new Error(`briefing site mismatch: got "${brief.site}", expected "${brief.expectedSite}"`);
    }
    if (!brief.grade) throw new Error('briefing grade missing');
    if (brief.readiness !== 'blocked') throw new Error(`expected readiness "blocked", got "${brief.readiness}"`);
    if (!brief.total) throw new Error('briefing total missing');
    if (!brief.contract) throw new Error('pending contract missing');
    if (!brief.mapPainted) throw new Error('map canvas not painted');
    if (Math.abs(brief.mapPressure - brief.pressure) > 0.001) {
      throw new Error('map pressure mismatch');
    }
    if (brief.mapLink !== brief.expectedMapLink) {
      throw new Error(`map link mismatch: got "${brief.mapLink}", expected "${brief.expectedMapLink}"`);
    }
    pass++;

    await page.evaluate(() => { __D.Career.suit = 99; });
    const fallback = await captureBrief(page, 'brain', 54321);
    if (!fallback.visible) throw new Error('fallback briefing screen not visible');
    if (!fallback.site || fallback.site !== fallback.expectedSite) {
      throw new Error(`fallback site mismatch: got "${fallback.site}", expected "${fallback.expectedSite}"`);
    }
    if (!fallback.grade) throw new Error('fallback grade missing');
    if (fallback.readiness !== 'ready') throw new Error(`expected readiness "ready", got "${fallback.readiness}"`);
    if (!fallback.total) throw new Error('fallback total missing');
    if (!fallback.contract) throw new Error('fallback pending contract missing');
    if (!fallback.mapPainted) throw new Error('fallback map canvas not painted');
    if (Math.abs(fallback.mapPressure - fallback.pressure) > 0.001) {
      throw new Error('fallback map pressure mismatch');
    }
    if (fallback.mapLink !== fallback.expectedMapLink) {
      throw new Error(`fallback map link mismatch: got "${fallback.mapLink}", expected "${fallback.expectedMapLink}"`);
    }

    await page.evaluate(() => __D.UI.dive());
    await sleep(600);
    const dive = await page.evaluate(() => ({
      state: __D.Game.state,
      o2: Math.round(__D.Game.run.o2),
      contract: !!__D.Game.contract,
      threats: __D.Game.countPathogens()
    }));
    if (dive.state !== 'play') throw new Error(`expected play state, got "${dive.state}"`);
    if (dive.o2 <= 0) throw new Error('o2 should be positive at dive start');
    if (!dive.contract) throw new Error('contract dive did not start');
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