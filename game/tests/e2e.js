/* End-to-end flow checks for onboarding, contract selection, and dive start. */
const puppeteer = require('puppeteer');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pressureLabel = (p) => (p < 1.0 ? 'LOW' : p < 1.3 ? 'NORMAL' : p < 1.6 ? 'RAISED' : p < 2.0 ? 'HIGH' : 'CRISIS');

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
      site: document.getElementById('brief-site').textContent,
      grade: document.getElementById('brief-grade').textContent,
      readiness: document.getElementById('brief-suitbox').dataset.state,
      tgtName: document.getElementById('brief-tgtname').textContent,
      tgtDesc: document.getElementById('brief-tgtdesc').textContent,
      total: document.getElementById('brief-total').textContent,
      warn: document.getElementById('brief-insurance-note').textContent,
      contract: !!__D.Career.pending,
      mapPainted: painted,
      pressure: organ.pressure,
      mapDesc: document.getElementById('brief-mapdesc').textContent,
      mapLink: __D.Career.pending.organ.map ?? null
    };
  }, { organId, seed });
}

async function captureTransfusionBrief(page) {
  return page.evaluate(() => {
    let offer = null;
    for (let seed = 9000; seed < 10000; seed++) {
      const candidate = __D.makeContract(30, seed, 1);
      if (candidate.type === 'transfusion') { offer = candidate; break; }
    }
    if (!offer) throw new Error('no transfusion offer');
    __D.Career.offers = [offer];
    __D.UI.showBrief(0);
    return {
      tgtName: document.getElementById('brief-tgtname').textContent,
      tgtDesc: document.getElementById('brief-tgtdesc').textContent,
      note: offer.typeNote,
      abo: offer.abo,
      donorAbo: offer.donorAbo
    };
  });
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
    if (!brief.visible || !brief.site || !brief.site.includes('Pulmonary vein') || !brief.site.includes('LUNG') || !brief.grade ||
      brief.readiness !== 'blocked' || !brief.total || !brief.warn || !brief.contract || !brief.mapPainted ||
      brief.mapDesc !== pressureLabel(brief.pressure) || brief.mapLink !== 'lung') {
      throw new Error('briefing failed');
    }
    pass++;

    await page.evaluate(() => { __D.Career.suit = 99; });
    const fallback = await captureBrief(page, 'brain', 54321);
    if (!fallback.visible || !fallback.site || !fallback.site.includes('Cortex') || !fallback.site.includes('BRAIN') || !fallback.grade ||
      fallback.readiness !== 'ready' || !fallback.total || !fallback.warn || !fallback.contract || !fallback.mapPainted ||
      fallback.mapDesc !== pressureLabel(fallback.pressure) || fallback.mapLink !== null) {
      throw new Error('fallback briefing failed');
    }
    const transfusion = await captureTransfusionBrief(page);
    if (!transfusion.note || !transfusion.tgtName.includes(transfusion.donorAbo) ||
      !transfusion.tgtDesc.includes(transfusion.abo) ||
      !transfusion.tgtDesc.includes(transfusion.donorAbo)) {
      throw new Error('transfusion briefing did not show the contract blood types');
    }

    const ledger = await page.evaluate(() => {
      __D.Career.agent = 'RANKER';
      __D.Career.rep = 44;
      __D.Career.credits = 1337;
      __D.Career.contracts = 6;
      __D.Career.bestTier = 'B';
      __D.Career.filePayroll();
      __D.UI.paintScores('scores-start');
      return {
        table: document.querySelector('#scores-start table.sc') !== null,
        header: document.querySelector('#scores-start table.sc thead') !== null,
        highlighted: document.querySelector('#scores-start tr.me') !== null
      };
    });
    if (!ledger.table || !ledger.header || !ledger.highlighted) throw new Error('leaderboard was not rendered correctly');

    const scanBilling = await page.evaluate(() => {
      __D.Career.scans = 3;
      __D.SHOP.find((item) => item.id === 'scans').buy(__D.Career);
      const invoice = __D.buildInvoice({
        bounty: 0, integrity: 100, scansUsed: 2, siphons: 0, repBribe: 0, damages: 0, died: false
      }, { tier: { i: 0, payMult: 1 }, fee: 0, comp: 0 }, { payBoost: 0 }, true);
      return {
        scans: __D.Career.scans,
        hasDiagLine: invoice.lines.some((l) => /Diagnostic activations/.test(l.label))
      };
    });
    if (scanBilling.scans !== 4 || scanBilling.hasDiagLine) {
      throw new Error('scan charges were not capped/billed correctly');
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
