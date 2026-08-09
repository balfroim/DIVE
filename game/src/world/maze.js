/**
 * Procedural vessel maze.
 *
 * A contract is no longer a rectangle of open plasma - it is a narrow, branching
 * vascular network that you descend. The maze is a grid of junction CHAMBERS
 * joined by CORRIDORS. Walkable space is the union of those shapes; everything
 * else is endothelium and you bounce off it.
 *
 *   row 0            entry (where you are injected)
 *   row 1..n-2       transit junctions, one wave each
 *   row n-1          the target organ chamber - the objective
 *
 * The topology comes from one of two places, and both end up as the same
 * grid of nodes and edges:
 *
 *   - grown: a randomised depth-first spanning tree (guarantees the organ is
 *     reachable) plus a few extra "braid" links so the network loops instead
 *     of being a frustrating pure tree. A seeded RNG means the briefing can
 *     promise a specific depth and site and the dive delivers exactly that.
 *   - drawn: an ASCII map from data/maps.js, named by `o.map`, so a vessel
 *     can be edited by hand in a text file (and each organ can have its own).
 *
 * Corridors crossing a row boundary carry a VALVE. It stays shut until that
 * row's wave is cleared, which is what makes depth meaningful: you fight your
 * way down rather than sprinting past everything.
 *
 * @module world/maze
 */

import { CFG } from '../core/config.js';
import { clamp, closestOnSegment, TAU } from '../core/math.js';
import { rngHelpers } from '../core/rng.js';
import { mapFor } from '../data/maps.js';

const _cp = { x: 0, y: 0, t: 0 };

/** Shape kinds in the walkable union. */
const CHAMBER = 0;
const CORRIDOR = 1;

export const Maze = {
  cols: 0,
  rows: 0,
  nodes: [],
  edges: [],
  shapes: [],
  /** @type {Map<string, number[]>} spatial hash: "cx,cy" -> shape indices */
  hash: new Map(),
  entry: null,
  organ: null,
  bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  organName: 'tissue',
  hue: 340,

  /**
   * Grow a new network. When `o.map` names an ASCII vessel map (see
   * data/maps.js) the topology is carved from the text instead of grown.
   * @param {object} o
   * @param {number} o.seed      reproducible contract seed (jitter, bores)
   * @param {number} o.rows      depth of the dive (>=2); row n-1 holds the organ
   * @param {number} o.cols      lateral width of the network
   * @param {number} [o.crop]    take only the top rows of an authored map
   * @param {string} [o.map]     id of an authored ASCII map in data/maps.js
   * @param {number} o.bore      corridor half-width multiplier from blood pressure
   * @param {string} o.organName label for the final chamber
   * @param {number} o.hue       tissue hue for the organ chamber
   */
  build(o) {
    if (o.map) return this.buildFrom(mapFor(o.map), o);

    const R = rngHelpers(o.seed >>> 0);
    const L = this._layout(o, o.rows, o.cols);

    /* ---- randomised DFS spanning tree: every chamber is reachable -------- */
    const visited = new Uint8Array(L.cols * L.rows);
    const startC = R.int(0, L.cols - 1);
    const stack = [L.at(startC, 0)];
    visited[startC] = 1;
    while (stack.length) {
      const n = stack[stack.length - 1];
      const opts = [];
      const push = (m) => { if (m && !visited[m.i]) opts.push(m); };
      push(L.at(n.c - 1, n.r)); push(L.at(n.c + 1, n.r));
      push(L.at(n.c, n.r - 1)); push(L.at(n.c, n.r + 1));
      if (!opts.length) { stack.pop(); continue; }
      /* bias downward so the network reads as a descent, not a puddle */
      const down = opts.filter((m) => m.r > n.r);
      const nxt = down.length && R.chance(0.62) ? R.pick(down) : R.pick(opts);
      visited[nxt.i] = 1;
      L.link(n, nxt);
      stack.push(nxt);
    }

    /* ---- braid: a few extra links so it loops and breathes --------------- */
    const braid = Math.max(1, Math.round(L.cols * L.rows * 0.16));
    for (let k = 0; k < braid; k++) {
      const n = this.nodes[R.int(0, this.nodes.length - 1)];
      const cand = [L.at(n.c + 1, n.r), L.at(n.c, n.r + 1)].filter((m) => m && n.links.indexOf(m) < 0);
      if (cand.length) L.link(n, R.pick(cand));
    }

    this._connectRows(L, false);
    /* the organ sits on the deepest row, in a chamber the tree actually reached */
    const deepest = this.nodes.filter((n) => n.r === L.rows - 1 && n.links.length);
    return this._finalize(L.at(startC, 0), deepest.length ? R.pick(deepest) : L.at(0, L.rows - 1));
  },

  /**
   * Carve a network from an ASCII vessel map (the alphabet and its invariants
   * are documented in data/maps.js). `o.crop` takes only the top rows of the
   * map, so one drawing can serve several contract depths; the organ is then
   * re-seated on the deepest surviving row. A malformed map throws - better a
   * loud boot failure than a silent procedural fallback nobody notices.
   */
  buildFrom(map, o) {
    const rows = map.rows;
    const want = Math.max(2, Math.min(rows.length, o.crop || rows.length));
    let cols = 0;
    for (const line of rows) cols = Math.max(cols, line.length);
    const L = this._layout(o, want, cols);

    /* ---- parse the drawing ----------------------------------------------
     * Corridors run from a junction outward through runs of `-`/`|` and
     * straight through `+` crossings (which carry both axes but hold no
     * chamber) until the next junction, however far away it is. Adjacent
     * junctions link directly.
     */
    const chAt = (c, r) => (c < 0 || r < 0 || c >= cols || r >= want ? ' ' : rows[r][c] || ' ');
    const isJunction = (c, r) => '#EO'.indexOf(chAt(c, r)) >= 0;
    const carriesH = (c, r) => '-+'.indexOf(chAt(c, r)) >= 0;  // passes a corridor horizontally
    const carriesV = (c, r) => '|+'.indexOf(chAt(c, r)) >= 0;  // passes a corridor vertically

    let entry = null, organ = null;
    const junctions = [];
    for (let r = 0; r < want; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = chAt(c, r);
        if (!isJunction(c, r)) continue;
        const n = L.at(c, r);
        junctions.push(n);
        if (ch === 'E') entry = n;
        if (ch === 'O') organ = n;
        /* scan right / down for the far end of each corridor that starts
           here (left / up were found by the neighbour's own scan) */
        let k = c + 1;
        while (carriesH(k, r)) k++;
        if (isJunction(k, r)) L.link(n, L.at(k, r));
        k = r + 1;
        while (carriesV(c, k)) k++;
        if (isJunction(c, k)) L.link(n, L.at(c, k));
      }
    }

    const bad = (why) => { throw new Error('map "' + map.id + '": ' + why); };
    if (!entry) bad('no entry E');
    if (!organ) bad('no organ O');
    if (organ.r !== L.rows - 1) bad('O must sit on the deepest drawn row (found row ' + organ.r + ' of ' + L.rows + ')');

    /* a junction with no corridor at all strands a chamber mid-wall */
    for (const n of junctions) {
      if (!n.links.length) bad('junction at col ' + n.c + ' row ' + n.r + ' has no corridor');
    }

    this._connectRows(L, true);
    return this._finalize(entry, organ);
  },

  /**
   * Shared scaffolding for both generators: dimensions, the jittered node
   * grid, and the link() that adds a corridor (valves live on corridors that
   * cross a row boundary). Consumes the seeded RNG in grid order, so the
   * briefed dive is reproducible either way.
   */
  _layout(o, rows, cols) {
    const R = rngHelpers(o.seed >>> 0);
    rows = this.rows = Math.max(2, rows | 0);
    cols = this.cols = Math.max(2, cols | 0);
    const cellX = CFG.maze.cell;
    const cellY = CFG.maze.cell * CFG.maze.stretch;
    this.organName = o.organName || 'tissue';
    this.hue = o.hue === undefined ? 340 : o.hue;

    const nodes = (this.nodes = []);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        nodes.push({
          i: r * cols + c,
          c, r,
          x: (c + 0.5) * cellX + R.range(-cellX * 0.12, cellX * 0.12),
          y: (r + 0.5) * cellY + R.range(-cellY * 0.07, cellY * 0.07),
          radius: CFG.maze.chamber * R.range(0.86, 1.12),
          kind: 'node',
          seen: false,
          links: []
        });
      }
    }

    const edges = (this.edges = []);
    return {
      R, rows, cols, cellX, cellY,
      at: (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows ? null : nodes[r * cols + c]),
      link: (a, b) => {
        if (!a || !b) return;
        if (a.links.indexOf(b) >= 0) return;
        a.links.push(b);
        b.links.push(a);
        const lo = a.r <= b.r ? a : b;
        const hi = a.r <= b.r ? b : a;
        edges.push({
          a: lo, b: hi,
          /** Valves only exist where a corridor changes row. */
          gateRow: lo.r !== hi.r ? lo.r : -1,
          open: lo.r === hi.r,
          pulse: R.range(0, TAU),
          bore: (CFG.maze.bore + R.range(-CFG.maze.boreJitter, CFG.maze.boreJitter)) * (o.bore || 1)
        });
      }
    };
  },

  /**
   * Guarantee every row is laterally connected.
   *
   * A wave is fought one row at a time and the valves below stay shut until
   * that row is cleared. So if a chamber can only be reached by dropping
   * through the row beneath it, any pathogen standing there is unreachable
   * and the contract deadlocks - unwinnable, forever.
   *
   * The spanning tree alone does NOT prevent this (it happily routes
   * (0,0) -> (0,1) -> (1,1) -> (1,0)). Union-find each row over the
   * corridors that are open at wave time; the grown generator then adds the
   * minimum number of lateral corridors needed to join the pieces, while a
   * hand-drawn map is simply rejected - the fix is one `-` in the text file.
   */
  _connectRows(L, strict) {
    const bad = (r) => { throw new Error('map: row ' + r + ' is not laterally connected (join its junctions with - or +)'); };
    for (let r = 0; r < L.rows; r++) {
      const parent = new Map();
      const find = (n) => {
        while (parent.get(n) !== n) { parent.set(n, parent.get(parent.get(n))); n = parent.get(n); }
        return n;
      };
      const rowNodes = [];
      for (let c = 0; c < L.cols; c++) {
        const n = L.at(c, r);
        if (!strict || n.links.length) { parent.set(n, n); rowNodes.push(n); }
      }
      for (const n of rowNodes) {
        for (const m of n.links) {
          if (m.r !== r) continue;                 // only corridors open at wave time
          const a = find(n), b = find(m);
          if (a !== b) parent.set(a, b);
        }
      }
      for (let i = 0; i + 1 < rowNodes.length; i++) {
        const a = rowNodes[i], b = rowNodes[i + 1];
        if (find(a) === find(b)) continue;
        if (strict) bad(r);
        L.link(a, b);
        parent.set(find(a), find(b));
      }
    }
  },

  /** Seat the entry and organ chambers and bake the collision shapes. */
  _finalize(entry, organ) {
    this.entry = entry;
    this.entry.kind = 'entry';
    this.organ = organ;
    this.organ.kind = 'organ';
    this.organ.radius *= 1.34;
    this.rebuildShapes();
    return this;
  },

  /** Flatten nodes/edges into the collision shape list + spatial hash. */
  rebuildShapes() {
    const shapes = (this.shapes = []);
    for (const n of this.nodes) {
      if (!n.links.length) continue; // orphan chamber, never carved
      shapes.push({ k: CHAMBER, x: n.x, y: n.y, r: n.radius, node: n });
    }
    for (const e of this.edges) {
      shapes.push({ k: CORRIDOR, x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y, r: e.bore, edge: e });
    }

    const cell = CFG.maze.cell;
    const hash = (this.hash = new Map());
    const add = (cx, cy, idx) => {
      const key = cx + ',' + cy;
      const list = hash.get(key);
      if (list) list.push(idx); else hash.set(key, [idx]);
    };
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    shapes.forEach((s, idx) => {
      const x0 = s.k === CHAMBER ? s.x - s.r : Math.min(s.x1, s.x2) - s.r;
      const x1 = s.k === CHAMBER ? s.x + s.r : Math.max(s.x1, s.x2) + s.r;
      const y0 = s.k === CHAMBER ? s.y - s.r : Math.min(s.y1, s.y2) - s.r;
      const y1 = s.k === CHAMBER ? s.y + s.r : Math.max(s.y1, s.y2) + s.r;
      minX = Math.min(minX, x0); maxX = Math.max(maxX, x1);
      minY = Math.min(minY, y0); maxY = Math.max(maxY, y1);
      for (let cy = Math.floor(y0 / cell); cy <= Math.floor(y1 / cell); cy++) {
        for (let cx = Math.floor(x0 / cell); cx <= Math.floor(x1 / cell); cx++) add(cx, cy, idx);
      }
    });
    this.bounds = { minX, minY, maxX, maxY };
  },

  /** Shape indices worth testing for a point. */
  near(x, y) {
    const cell = CFG.maze.cell;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    let out = this.hash.get(cx + ',' + cy);
    if (out) return out;
    /* outside the hash entirely - fall back to a ring search so a body that has
       somehow escaped still gets pulled home instead of drifting forever */
    for (let d = 1; d <= 2; d++) {
      for (let j = -d; j <= d; j++) {
        out = this.hash.get(cx + j + ',' + (cy - d)) || this.hash.get(cx + j + ',' + (cy + d)) ||
              this.hash.get(cx - d + ',' + (cy + j)) || this.hash.get(cx + d + ',' + (cy + j));
        if (out) return out;
      }
    }
    return null;
  },

  /**
   * Signed clearance for a point: how far it is INSIDE the walkable union.
   * Positive = inside with that much room, negative = that far into the wall.
   */
  clearance(x, y) {
    const idx = this.near(x, y);
    if (!idx) return -1e6;
    let best = -1e6;
    const shapes = this.shapes;
    for (let i = 0; i < idx.length; i++) {
      const s = shapes[idx[i]];
      let d;
      if (s.k === CHAMBER) {
        d = s.r - Math.hypot(x - s.x, y - s.y);
      } else {
        if (!s.edge.open) continue; // a shut valve is a wall
        closestOnSegment(x, y, s.x1, s.y1, s.x2, s.y2, _cp);
        d = s.r - Math.hypot(x - _cp.x, y - _cp.y);
      }
      if (d > best) best = d;
    }
    return best;
  },

  /** True when a circle of radius r fits at (x,y). */
  fits(x, y, r) { return this.clearance(x, y) >= r; },

  /**
   * Push a body back inside the vessel and kill its outward velocity.
   *
   * Bodies are circles; walkable space is a union of circles and capsules. We
   * find the shape whose surface is nearest, snap to its inner boundary and
   * slide along it. Cheap, stable, and it feels like scraping a vessel wall.
   *
   * @param {{x:number,y:number,vx:number,vy:number}} b
   * @param {number} r body radius
   * @param {number} bounce 0 = slide, 1 = fully reflect
   * @returns {number} penetration depth resolved this call (0 = was already free)
   */
  resolve(b, r, bounce) {
    const idx = this.near(b.x, b.y);
    if (!idx) return 0;
    const shapes = this.shapes;
    let bestPen = -1e9, bx = 0, by = 0; // bx,by = outward normal of the best shape

    for (let i = 0; i < idx.length; i++) {
      const s = shapes[idx[i]];
      let cx, cy, sr;
      if (s.k === CHAMBER) {
        cx = s.x; cy = s.y; sr = s.r;
      } else {
        if (!s.edge.open) continue;
        closestOnSegment(b.x, b.y, s.x1, s.y1, s.x2, s.y2, _cp);
        cx = _cp.x; cy = _cp.y; sr = s.r;
      }
      const dx = b.x - cx, dy = b.y - cy;
      const d = Math.hypot(dx, dy) || 1e-6;
      const pen = sr - r - d; // >=0 means this shape already contains the body
      if (pen >= 0) return 0; // fits somewhere: nothing to do
      if (pen > bestPen) {
        bestPen = pen;
        bx = dx / d; by = dy / d;
        _cp.hx = cx; _cp.hy = cy; _cp.hr = sr;
      }
    }
    if (bestPen === -1e9) return 0;

    /* snap onto the inner boundary of the nearest shape */
    const room = Math.max(0, _cp.hr - r);
    b.x = _cp.hx + bx * room;
    b.y = _cp.hy + by * room;

    /* remove the component of velocity heading into the wall */
    const vn = b.vx * bx + b.vy * by;
    if (vn > 0) {
      const k = 1 + clamp(bounce === undefined ? 0.25 : bounce, 0, 1);
      b.vx -= bx * vn * k;
      b.vy -= by * vn * k;
    }
    return -bestPen;
  },

  /**
   * Is the straight line A->B clear of endothelium?
   * Used for the lunge preview and to stop the white cell charging through a wall.
   */
  lineClear(x1, y1, x2, y2, r) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    /* 18-unit stride: fine enough that a thin septum between two corridors
       cannot be stepped over, cheap enough to run every frame per mark. */
    const steps = Math.max(2, Math.ceil(d / 18));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (this.clearance(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t) < (r || 0)) return false;
    }
    return true;
  },

  /**
   * March a ray until the endothelium blocks it.
   *
   * This is what the direct-fire escort shoots down: the player aims, and the
   * shot stops where the vessel does. Returns the distance travelled before the
   * first blocked sample, clamped to `maxD`.
   *
   * @param {number} x0 @param {number} y0 origin
   * @param {number} dx @param {number} dy unit direction
   * @param {number} maxD maximum range
   * @param {number} r probe radius (CFG.buddy.lineR)
   * @param {number} [step] sample stride
   * @returns {number} clear distance from the origin
   */
  rayClip(x0, y0, dx, dy, maxD, r, step) {
    const st = step || 12;
    const n = Math.max(1, Math.ceil(maxD / st));
    let last = 0;
    for (let i = 1; i <= n; i++) {
      const d = Math.min(maxD, i * st);
      if (this.clearance(x0 + dx * d, y0 + dy * d) < (r || 0)) return last;
      last = d;
    }
    return last;
  },

  /** Nearest chamber node to a world point (used for depth + wave triggers). */
  nearestNode(x, y) {
    let best = null, bd = 1e18;
    for (const n of this.nodes) {
      if (!n.links.length) continue;
      const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  },

  /** The chamber a point is actually standing in, or null if it is in transit. */
  nodeAt(x, y) {
    const n = this.nearestNode(x, y);
    return n && Math.hypot(n.x - x, n.y - y) <= n.radius ? n : null;
  },

  /** Open every valve on a row boundary (called when its wave is cleared). */
  openRow(row) {
    let n = 0;
    for (const e of this.edges) if (e.gateRow === row && !e.open) { e.open = true; n++; }
    return n;
  },

  /** Shut all valves again (contract restart). */
  sealAll() {
    for (const e of this.edges) e.open = e.a.r === e.b.r;
  },

  /** A random walkable point inside a given row, for spawning. */
  pointInRow(row, rng, pad) {
    const cand = this.nodes.filter((n) => n.r === row && n.links.length);
    if (!cand.length) return { x: this.entry.x, y: this.entry.y };
    const n = cand[((rng ? rng() : Math.random()) * cand.length) | 0];
    const a = (rng ? rng() : Math.random()) * TAU;
    const rad = (n.radius - (pad || 40)) * Math.sqrt(rng ? rng() : Math.random());
    return { x: n.x + Math.cos(a) * rad, y: n.y + Math.sin(a) * rad, node: n };
  },

  /** Depth 0..1 through the network, for the body minimap gauge. */
  depthFrac(y) {
    const span = Math.max(1, this.organ.y - this.entry.y);
    return clamp((y - this.entry.y) / span, 0, 1);
  }
};
