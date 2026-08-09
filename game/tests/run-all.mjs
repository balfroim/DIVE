/**
 * Runs every suite in order and prints one summary.
 *   node tests/run-all.mjs
 * Needs the Chrome shared libs on the path (see README).
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SUITES = ['smoke', 'e2e', 'props', 'platform', 'playthrough'];

let failed = 0;
const summary = [];

for (const name of SUITES) {
  process.stdout.write(`\n${'='.repeat(60)}\n  ${name}\n${'='.repeat(60)}\n`);
  const r = spawnSync(process.execPath, [join(here, `${name}.js`)], {
    encoding: 'utf8', env: process.env
  });
  const out = (r.stdout || '') + (r.stderr || '');
  process.stdout.write(out);
  const m = out.match(/PASS (\d+)\s+FAIL (\d+)/);
  if (m) summary.push({ name, pass: +m[1], fail: +m[2] });
  else summary.push({ name, pass: /NO RUNTIME ERRORS/.test(out) ? 1 : 0, fail: r.status ? 1 : 0 });
  if (r.status) failed++;
}

console.log('\n' + '='.repeat(60));
let tp = 0, tf = 0;
for (const s of summary) {
  tp += s.pass; tf += s.fail;
  console.log(`  ${s.fail ? 'FAIL' : 'ok  '}  ${s.name.padEnd(12)} ${s.pass} passed${s.fail ? ', ' + s.fail + ' FAILED' : ''}`);
}
console.log('='.repeat(60));
console.log(`  TOTAL ${tp} passed, ${tf} failed across ${SUITES.length} suites`);
process.exit(failed ? 1 : 0);
