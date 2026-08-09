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
    return {
      visible: document.getElementById('scr-brief').classList.contains('on'),
      chips: document.getElementById('brief-chips').textContent.length > 0,
      contract: !!__D.Career.pending,
      mapPainted: painted,
      mapText: document.getElementById('brief-mapdesc').textContent,
      mapLink: __D.Career.pending.organ.map ?? null
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

    const brief = await captureBrief(page, 'lung', 12345);
    if (!brief.visible || !brief.chips || !brief.contract || !brief.mapPainted ||
      !brief.mapText || !brief.mapText.includes('LUNG MAP') || brief.mapLink !== 'lung') {
      throw new Error('briefing failed');
    }
    pass++;

    const fallback = await captureBrief(page, 'gut', 54321);
    if (!fallback.visible || !fallback.chips || !fallback.contract || !fallback.mapPainted ||
      fallback.mapText.includes('MAP') || fallback.mapLink !== null) {
      throw new Error('fallback briefing failed');
    }
    await page.evaluate(() => __D.UI.dive());
    await sleep(600);
    const dive = await page.evaluate(() => ({
      state: __D.Game.state,
      o2: Math.round(__D.Game.run.o2),
      contract: !!__D.Game.contract,
      threats: __D.Game.countPathogens()
    }));
    if (dive.state !== 'play' || dive.o2 <= 0 || !dive.contract) throw new Error('contract dive did not start');
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
