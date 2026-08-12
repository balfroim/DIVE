/* Viewport and HUD sanity checks. */
import puppeteer from 'puppeteer';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  let pass = 0;
  let fail = 0;
  const errors = [];
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', (event) => errors.push('PAGEERROR ' + event.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push('CONSOLE ' + message.text()); });

  try {
    await page.goto('file:///tmp/dive_test.html', { waitUntil: 'load' });
    await sleep(800);

    const viewports = [
      { width: 360, height: 740 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
      { width: 1920, height: 1080 }
    ];
    for (const viewport of viewports) {
      await page.setViewport(viewport);
      await sleep(120);
      const size = await page.evaluate(() => ({
        w: __D.View.w,
        h: __D.View.h,
        canvas: document.getElementById('game').clientWidth > 0
      }));
      if (!size.canvas || !(size.w > 0) || !(size.h > 0)) throw new Error('viewport sizing failed');
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
