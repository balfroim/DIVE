/**
 * Build: bundle the ES modules with esbuild and inline the result into a single
 * self-contained dive.html.
 *
 *   node build.mjs            -> ../dive.html
 *   node build.mjs --test     -> also writes /tmp/dive_test.html with a debug
 *                                export (window.__D) for the puppeteer suites
 */

import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execFileSync } from 'child_process';

const here = dirname(fileURLToPath(import.meta.url));
const wantTest = process.argv.includes('--test');

/* Gate 1: static scope analysis. esbuild treats an unresolved identifier as a
   global lookup and bundles it happily, so without this step a typo only
   surfaces as a ReferenceError at runtime. Fail the build instead. */
if (!process.argv.includes('--skip-check')) {
  try {
    execFileSync(process.execPath, [join(here, 'tools/check-imports.mjs')], { stdio: 'inherit' });
  } catch {
    console.error('build aborted: unresolved identifiers (run node tools/check-imports.mjs)');
    process.exit(1);
  }
}

const common = {
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  legalComments: 'none',
  write: false
};

async function bundle(entry) {
  const out = await build({ ...common, entryPoints: [join(here, entry)] });
  return out.outputFiles[0].text;
}

function inline(html, js) {
  const tag = '<script type="module" src="./src/main.js"></script>';
  if (!html.includes(tag)) throw new Error('script tag not found in index.html');
  return html.replace(tag, '<script>\n' + js + '\n</script>');
}

const html = readFileSync(join(here, 'index.html'), 'utf8');

const js = await bundle('src/main.js');
const outPath = join(here, '..', 'dive.html');
const page = inline(html, js);

/* Gate 2: the deliverable must be self-contained - no network at runtime. */
const ext = page.match(/(?:src|href)\s*=\s*["'](https?:|\/\/)[^"']*/gi);
if (ext) { console.error('build aborted: external references found:\n  ' + ext.join('\n  ')); process.exit(1); }

writeFileSync(outPath, page);
console.log('built', outPath, (page.length / 1024).toFixed(1) + ' KB');

if (wantTest) {
  const testJs = await bundle('src/test-entry.js');
  writeFileSync('/tmp/dive_test.html', inline(html, testJs));
  console.log('built /tmp/dive_test.html (with window.__D)');
}
