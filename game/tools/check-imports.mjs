/**
 * Static undefined-identifier checker.
 *
 * Parses every module under src/ with acorn, builds a real lexical scope tree,
 * and reports any identifier that is read but never declared, imported, or
 * present in the allow-list of browser/JS globals.
 *
 * This replaces the old regex-based checker, which produced false positives on
 * `$`, `on`, `cr`, `pick` and friends because it could not tell a local binding
 * from a free variable. esbuild will happily bundle a free variable as a global
 * lookup, so a bug like `wrapHue is not defined` only shows up at runtime --
 * this tool catches it at build time instead.
 *
 * Usage: node tools/check-imports.mjs        (exit 1 on any finding)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

/** Globals we intentionally reach for. Anything else must be imported. */
const GLOBALS = new Set([
  // language
  'undefined', 'NaN', 'Infinity', 'globalThis', 'Math', 'JSON', 'Object', 'Array', 'String',
  'Number', 'Boolean', 'Date', 'RegExp', 'Error', 'TypeError', 'RangeError', 'Map', 'Set',
  'WeakMap', 'WeakSet', 'Promise', 'Symbol', 'Proxy', 'Reflect', 'BigInt', 'Function',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'Float32Array', 'Float64Array', 'Int32Array', 'Uint8Array', 'Uint8ClampedArray',
  'Uint16Array', 'Uint32Array', 'Int8Array', 'Int16Array', 'ArrayBuffer', 'DataView',
  'structuredClone', 'queueMicrotask', 'console',
  // browser
  'window', 'document', 'navigator', 'location', 'history', 'screen', 'localStorage',
  'sessionStorage', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout',
  'clearTimeout', 'setInterval', 'clearInterval', 'devicePixelRatio', 'innerWidth',
  'innerHeight', 'matchMedia', 'getComputedStyle', 'Image', 'Audio', 'AudioContext',
  'webkitAudioContext', 'OffscreenCanvas', 'Path2D', 'DOMMatrix', 'CanvasRenderingContext2D',
  'HTMLCanvasElement', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent',
  'KeyboardEvent', 'PointerEvent', 'TouchEvent', 'MouseEvent', 'performance', 'fetch',
  'URL', 'Blob', 'FileReader', 'ResizeObserver', 'IntersectionObserver', 'alert',
]);

/* ------------------------------------------------------------------ scopes */

class Scope {
  constructor(parent, kind) {
    this.parent = parent; this.kind = kind; this.names = new Set();
  }
  declare(n) { this.names.add(n); }
  has(n) {
    for (let s = this; s; s = s.parent) if (s.names.has(n)) return true;
    return false;
  }
  /** Nearest enclosing function/module scope, for `var` + function decls. */
  fnScope() {
    let s = this;
    while (s.kind === 'block' && s.parent) s = s.parent;
    return s;
  }
}

/** Collect every name bound by a binding pattern (destructuring included). */
function patternNames(node, out) {
  if (!node) return out;
  switch (node.type) {
    case 'Identifier': out.push(node.name); break;
    case 'ObjectPattern':
      for (const p of node.properties) {
        if (p.type === 'RestElement') patternNames(p.argument, out);
        else patternNames(p.value, out);
      }
      break;
    case 'ArrayPattern':
      for (const el of node.elements) if (el) patternNames(el, out);
      break;
    case 'AssignmentPattern': patternNames(node.left, out); break;
    case 'RestElement': patternNames(node.argument, out); break;
  }
  return out;
}

const CHILD_SKIP = new Set(['loc', 'start', 'end', 'range', 'type']);
function children(node) {
  const out = [];
  for (const k in node) {
    if (CHILD_SKIP.has(k)) continue;
    const v = node[k];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') out.push(c); }
    else if (v && typeof v.type === 'string') out.push(v);
  }
  return out;
}

/** Hoist var/function declarations into the given function scope. */
function hoist(node, scope) {
  for (const c of children(node)) {
    if (c.type === 'FunctionDeclaration') { if (c.id) scope.declare(c.id.name); continue; }
    if (c.type === 'FunctionExpression' || c.type === 'ArrowFunctionExpression' ||
        c.type === 'ClassDeclaration' || c.type === 'ClassExpression') continue;
    if (c.type === 'VariableDeclaration' && c.kind === 'var') {
      for (const d of c.declarations) for (const n of patternNames(d.id, [])) scope.declare(n);
    }
    hoist(c, scope);
  }
}

/* ------------------------------------------------------------------- walk  */

function checkFile(file) {
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: 2023, sourceType: 'module', locations: true });
  } catch (e) {
    return [{ name: '(parse error)', line: e.loc ? e.loc.line : 0, msg: e.message }];
  }

  const findings = [];
  const seen = new Set();
  const moduleScope = new Scope(null, 'module');

  // imports + top-level declarations first (order-independent within a module)
  for (const n of ast.body) {
    if (n.type === 'ImportDeclaration') {
      for (const s of n.specifiers) moduleScope.declare(s.local.name);
    } else if (n.type === 'ExportNamedDeclaration' && n.declaration) {
      collectTopLevel(n.declaration, moduleScope);
    } else if (n.type === 'ExportDefaultDeclaration') {
      collectTopLevel(n.declaration, moduleScope);
    } else {
      collectTopLevel(n, moduleScope);
    }
  }
  hoist(ast, moduleScope);

  function collectTopLevel(n, scope) {
    if (!n) return;
    if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations) for (const nm of patternNames(d.id, [])) scope.declare(nm);
    } else if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) {
      scope.declare(n.id.name);
    }
  }

  function report(node, name) {
    const key = name + ':' + node.loc.start.line;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ name, line: node.loc.start.line });
  }

  function walk(node, scope) {
    if (!node || typeof node.type !== 'string') return;

    switch (node.type) {
      case 'Identifier':
        if (!scope.has(node.name) && !GLOBALS.has(node.name)) report(node, node.name);
        return;

      case 'MemberExpression':
        walk(node.object, scope);
        if (node.computed) walk(node.property, scope);
        return;

      case 'Property':
        if (node.computed) walk(node.key, scope);
        walk(node.value, scope);
        return;

      case 'PropertyDefinition':
      case 'MethodDefinition':
        if (node.computed) walk(node.key, scope);
        walk(node.value, scope);
        return;

      case 'ImportDeclaration':
      case 'ExportAllDeclaration':
        return;

      case 'ExportNamedDeclaration':
        if (node.declaration) walk(node.declaration, scope);
        return; // bare `export { a, b }` refers to locals already declared

      case 'LabeledStatement':
        walk(node.body, scope);
        return;

      case 'BreakStatement':
      case 'ContinueStatement':
        return;

      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression': {
        const fs2 = new Scope(scope, 'function');
        fs2.declare('arguments'); fs2.declare('this');
        if (node.id) fs2.declare(node.id.name);
        for (const p of node.params) {
          for (const nm of patternNames(p, [])) fs2.declare(nm);
          walkPatternDefaults(p, fs2);
        }
        hoist(node.body, fs2);
        if (node.body.type === 'BlockStatement') walkBlock(node.body, fs2, true);
        else walk(node.body, fs2);
        return;
      }

      case 'ClassDeclaration':
      case 'ClassExpression': {
        const cs = new Scope(scope, 'block');
        if (node.id) cs.declare(node.id.name);
        if (node.superClass) walk(node.superClass, cs);
        for (const el of node.body.body) walk(el, cs);
        return;
      }

      case 'BlockStatement':
        walkBlock(node, new Scope(scope, 'block'), false);
        return;

      case 'ForStatement': {
        const s = new Scope(scope, 'block');
        if (node.init) { declareInScope(node.init, s); walk(node.init, s); }
        if (node.test) walk(node.test, s);
        if (node.update) walk(node.update, s);
        walk(node.body, s);
        return;
      }

      case 'ForOfStatement':
      case 'ForInStatement': {
        const s = new Scope(scope, 'block');
        declareInScope(node.left, s);
        walk(node.left, s);
        walk(node.right, s);
        walk(node.body, s);
        return;
      }

      case 'CatchClause': {
        const s = new Scope(scope, 'block');
        if (node.param) for (const nm of patternNames(node.param, [])) s.declare(nm);
        walkBlock(node.body, s, true);
        return;
      }

      case 'VariableDeclaration':
        for (const d of node.declarations) {
          for (const nm of patternNames(d.id, [])) scope.declare(nm);
          walkPatternDefaults(d.id, scope);
          if (d.init) walk(d.init, scope);
        }
        return;

      case 'AssignmentExpression':
        // left may be a pattern; identifiers there are writes, still must resolve
        walk(node.left, scope);
        walk(node.right, scope);
        return;
    }

    for (const c of children(node)) walk(c, scope);
  }

  function declareInScope(n, scope) {
    if (n && n.type === 'VariableDeclaration') {
      for (const d of n.declarations) for (const nm of patternNames(d.id, [])) scope.declare(nm);
    }
  }

  function walkPatternDefaults(p, scope) {
    if (!p) return;
    if (p.type === 'AssignmentPattern') { walk(p.right, scope); walkPatternDefaults(p.left, scope); }
    else if (p.type === 'ObjectPattern') for (const q of p.properties) {
      if (q.type === 'RestElement') walkPatternDefaults(q.argument, scope);
      else { if (q.computed) walk(q.key, scope); walkPatternDefaults(q.value, scope); }
    }
    else if (p.type === 'ArrayPattern') for (const el of p.elements) walkPatternDefaults(el, scope);
    else if (p.type === 'RestElement') walkPatternDefaults(p.argument, scope);
  }

  function walkBlock(block, scope, alreadyScoped) {
    const s = alreadyScoped ? scope : scope;
    for (const n of block.body) {
      if (n.type === 'FunctionDeclaration' && n.id) s.declare(n.id.name);
      if (n.type === 'ClassDeclaration' && n.id) s.declare(n.id.name);
      if (n.type === 'VariableDeclaration' && n.kind !== 'var') {
        for (const d of n.declarations) for (const nm of patternNames(d.id, [])) s.declare(nm);
      }
    }
    for (const n of block.body) walk(n, s);
  }

  for (const n of ast.body) walk(n, moduleScope);
  return findings;
}

/* -------------------------------------------------------------------- run  */

function listFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out.sort();
}

let total = 0;
for (const f of listFiles(SRC)) {
  const found = checkFile(f);
  if (found.length) {
    total += found.length;
    console.log('\n' + path.relative(ROOT, f));
    for (const x of found) console.log(`  line ${x.line}: ${x.name}${x.msg ? ' -- ' + x.msg : ''}`);
  }
}

if (total) {
  console.log(`\nFAIL: ${total} unresolved identifier(s).`);
  process.exit(1);
}
console.log('check-imports: OK - every identifier resolves to an import, a local binding, or a known global.');
