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

    const spawnRows = await page.evaluate(() => {
      const contract = __D.makeContract(12, 9, 0);
      __D.Game.startContract(contract);
      __D.Maze.nodes.forEach((n) => {
        if (n.r === 0) n.radius = 12;
        if (n.r === 1) n.radius = 260;
      });
      __D.Maze.rebuildShapes();
      const sig = { ...__D.Game.contract.sig, r: 90 };
      const loose = __D.spawnEnt(__D.Game.contract.hostArch, sig, 1, { row: 0, now: __D.Game.t });
      const strict = __D.spawnEnt(__D.Game.contract.hostArch, sig, 1, { row: 0, now: __D.Game.t, strictRow: true });
      return { looseRow: loose ? loose.row : -1, strictRow: strict ? strict.row : -1 };
    });
    if (spawnRows.strictRow !== 0) throw new Error('row-specific spawning still spills into later waves');
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
  } catch (error) {
    fail++;
    errors.push(String(error && error.message ? error.message : error));
  }

  await browser.close();
  console.log(errors.length ? `ERRORS:\n${errors.slice(0, 6).join('\\n')}` : 'NO RUNTIME ERRORS');
  console.log(`PASS ${pass} FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
