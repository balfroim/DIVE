/* Lightweight boot and onboarding smoke test. */
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
    await sleep(1200);

    const boot = await page.evaluate(() => ({
      state: __D.Game.state,
      overlay: document.getElementById('scr-start').classList.contains('on'),
      offers: __D.Career.offers.length
    }));
    if (boot.state !== 'start' || !boot.overlay) throw new Error('start screen failed to show');
    pass++;

    await page.click('#btn-play');
    await sleep(500);
    await page.evaluate(() => __D.DLG.skip());
    await sleep(400);

    const board = await page.evaluate(() => ({
      state: __D.Game.state,
      offers: __D.Career.offers.length,
      boardVisible: document.getElementById('scr-board').classList.contains('on')
    }));
    if (board.state !== 'board' || board.offers < 1 || !board.boardVisible) throw new Error('board did not open');
    pass++;

    const contract = await page.evaluate(() => {
      __D.UI.showBrief(0);
      __D.UI.dive();
      return {
        state: __D.Game.state,
        o2: Math.round(__D.Game.run.o2),
        contract: !!__D.Game.contract
      };
    });
    if (contract.state !== 'play' || contract.o2 <= 0 || !contract.contract) throw new Error('dive did not start');
    pass++;
  } catch (error) {
    fail++;
    errors.push(String(error && error.message ? error.message : error));
  }

  await browser.close();
  const summary = errors.length ? `ERRORS:\n${errors.slice(0, 6).join('\n')}` : 'NO RUNTIME ERRORS';
  console.log(summary);
  console.log(`PASS ${pass} FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
