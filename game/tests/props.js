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
  } catch (error) {
    fail++;
    errors.push(String(error && error.message ? error.message : error));
  }

  await browser.close();
  console.log(errors.length ? `ERRORS:\n${errors.slice(0, 6).join('\\n')}` : 'NO RUNTIME ERRORS');
  console.log(`PASS ${pass} FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
