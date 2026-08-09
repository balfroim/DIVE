/* A short simulated pass through a dive frame-loop. */
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

    const started = await page.evaluate(() => {
      __D.UI.showBoard();
      __D.UI.showBrief(0);
      __D.UI.dive();
      for (let i = 0; i < 30; i++) __D.Game.step(0.016);
      return {
        state: __D.Game.state,
        o2: Math.round(__D.Game.run.o2),
        row: __D.Game.row,
        finite: Number.isFinite(__D.Game.run.o2)
      };
    });

    if (started.state !== 'play' || !started.finite || !Number.isFinite(started.row)) throw new Error('sim loop broke');
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
