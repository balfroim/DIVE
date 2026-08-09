/* End-to-end flow checks for onboarding, contract selection, and dive start. */
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
    await sleep(1000);

    await page.click('#btn-play');
    await sleep(500);
    await page.evaluate(() => __D.DLG.skip());
    await sleep(500);

    const brief = await page.evaluate(() => {
      __D.UI.showBrief(0);
      return {
        visible: document.getElementById('scr-brief').classList.contains('on'),
        chips: document.getElementById('brief-chips').textContent.length > 0,
        contract: !!__D.Career.pending
      };
    });
    if (!brief.visible || !brief.chips || !brief.contract) throw new Error('briefing failed');
    pass++;

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
