// Self-check for the pure logic in engine.js and newtab.js: node test.js
const assert = require('assert');
const fs = require('fs');
const A = require('./engine.js');

// ---------- settings ----------
// normalize: defaults, clamping, step snapping, and the odd shapes hosts send (WE values, query strings, storage junk)
const D = A.normalize();
assert.deepStrictEqual(D, A.DEFAULTS);
assert.strictEqual(D.animal, 'butterfly');
assert.deepStrictEqual(Object.keys(D).sort(), ['animal', 'name', ...A.TWEAKS.map((t) => t.key)].sort());
const expect = { density: 1.05, corner: false, direction: 49, speed: 1.05, sway: 0, spread: 0, size: 1.25, farthest: 0.18, farBias: 1.7, hold: 5, separation: 700,
  flutter: 0, glide: 2.75, flapRate: 1, hue: 0, shimmer: 0.3, sparkle: 0.12, fade: 0.75, trail: 1.55, trailFade: 0.15, grid: 1.05, detail: 1.3,
  blur: 3.5, refraction: 40, ripple: 0.007, tint: 0, edge: 0.55, radius: 24, width: 720 };
for (const k in expect) assert.strictEqual(D[k], expect[k], 'default ' + k); // the reference panel's defaults
assert.strictEqual(A.TWEAKS.length, Object.keys(expect).length);
for (const t of A.TWEAKS) {
  if (typeof t.def === 'boolean') continue;
  assert.strictEqual(A.normalize({ [t.key]: t.max + 1000 })[t.key], t.max, t.key + ' clamps high');
  assert.strictEqual(A.normalize({ [t.key]: t.min - 1000 })[t.key], t.min, t.key + ' clamps low');
  for (const junk of ['abc', NaN, null, undefined, '', true]) assert.strictEqual(A.normalize({ [t.key]: junk })[t.key], t.def, t.key + ' junk ' + junk);
  assert.strictEqual(A.normalize({ [t.key]: String(t.max) })[t.key], t.max, t.key + ' from a query string');
}
assert.strictEqual(A.normalize({ density: 1.07 }).density, 1.05); // snapped to the 0.05 step
assert.strictEqual(A.normalize({ ripple: 0.0124 }).ripple, 0.012);
assert.strictEqual(A.normalize({ direction: 90.4 }).direction, 90);
assert.strictEqual(A.normalize({ corner: 'true' }).corner, true);
assert.strictEqual(A.normalize({ corner: '0' }).corner, false);
assert.strictEqual(A.normalize({ corner: 'maybe' }).corner, false);
// settings saved by the previous version: count / character size / trail on-off
assert.strictEqual(A.normalize({ count: 50 }).density, 2.1);
assert.strictEqual(A.normalize({ count: 25 }).density, 1.05);
assert.strictEqual(A.normalize({ count: 50, density: 0.5 }).density, 0.5); // a new value wins
const oldSize = A.normalize({ size: 14 });
assert.strictEqual(oldSize.size, 1.25);
assert.strictEqual(oldSize.detail, 0.95); // 10 px cells were detail 1.3; 14 px cells are coarser
assert.strictEqual(A.normalize({ size: 2 }).size, 2); // a new-range value is a Size
assert.strictEqual(A.normalize({ trail: false }).trail, 0);
assert.strictEqual(A.normalize({ trail: 'false' }).trail, 0);
assert.strictEqual(A.normalize({ trail: 'true' }).trail, 1.55);
assert.strictEqual(A.normalize({ trail: '3' }).trail, 3);
assert.strictEqual(A.normalize({ animal: 'Koi' }).animal, 'koi');
assert.strictEqual(A.normalize({ animal: 'dragon' }).animal, 'butterfly');
assert.strictEqual(A.normalize({ animal: 'random' }).animal, 'butterfly'); // old saved value: animals are never random now
assert.strictEqual(A.normalize({ animal: 'RANDOM' }).animal, 'butterfly');
assert.strictEqual(A.normalize({ animal: 'bird' }).animal, 'crane'); // old saved value
assert.strictEqual(A.normalize({ animal: 'Crane' }).animal, 'crane');
assert.ok(!A.ANIMALS.includes('bird') && !A.ANIMALS.includes('random') && A.ANIMALS.length === 7);
assert.strictEqual(A.normalize({ animal: 'inkkoi' }).animal, 'butterfly'); // old saved value: that animal was removed
assert.strictEqual(A.normalize({ name: '  Ada  ' }).name, 'Ada');
assert.strictEqual(A.normalize({ name: 'x'.repeat(100) }).name.length, 40);

// Wallpaper Engine properties -> settings: partial objects map only the keys present; keys are lowercase; no glass
assert.deepStrictEqual(A.fromWallpaperProps({ speed: { value: 2 } }), { speed: 2 });
assert.deepStrictEqual(A.fromWallpaperProps({ farbias: { value: 2 }, animal: { value: 'frog' } }), { farBias: 2, animal: 'frog' });
assert.deepStrictEqual(A.fromWallpaperProps({ corner: { value: true }, trailfade: { value: 1 }, flaprate: { value: 2 } }), { corner: true, trailFade: 1, flapRate: 2 });
assert.deepStrictEqual(A.fromWallpaperProps({ blur: { value: 9 }, width: { value: 400 }, other: { value: 1 } }), {});
assert.deepStrictEqual(A.fromWallpaperProps({ density: {} }), {});
assert.deepStrictEqual(A.fromWallpaperProps({}), {});
assert.deepStrictEqual(A.fromWallpaperProps(undefined), {});
assert.strictEqual(A.normalize(A.fromWallpaperProps({ hue: { value: 500 } })).hue, 180);
// project.json carries the same properties, ranges and defaults (Movement, Flight, Look; no Chat glass, no random)
{
  const props = JSON.parse(fs.readFileSync(__dirname + '/project.json', 'utf8')).general.properties;
  assert.deepStrictEqual(props.animal.options.map((o) => o.value), A.ANIMALS);
  assert.strictEqual(props.animal.value, 'butterfly');
  const want = A.TWEAKS.filter((t) => t.group !== 'Chat glass');
  assert.deepStrictEqual(Object.keys(props).sort(), ['animal', ...want.map((t) => t.key.toLowerCase())].sort());
  for (const t of want) {
    const p = props[t.key.toLowerCase()];
    assert.strictEqual(p.value, t.def, t.key);
    if (typeof t.def === 'boolean') { assert.strictEqual(p.type, 'bool'); continue; }
    assert.deepStrictEqual([p.type, p.min, p.max, p.step], ['slider', t.min, t.max, t.step], t.key);
  }
}

// line glyphs follow the on-screen angle (y points down)
assert.strictEqual(A.lineGlyph(0), A.lineGlyph(Math.PI));
assert.deepStrictEqual([0, Math.PI / 4, Math.PI / 2, -Math.PI / 4].map((t) => ' .:-=+*%#8@0o|/\\{}()§~!•'[A.lineGlyph(t)]), ['-', '\\', '|', '/']);

// ---------- rasteriser ----------
// every species, every heading, every depth level gives a non-empty list of valid cells
let sseed = 7;
const srng = () => ((sseed = (sseed * 16807) % 2147483647) / 2147483647);
const few = (id, extra) => A.normalize(Object.assign({ animal: id, density: 0.3 }, extra));
for (const id of A.ANIMALS) {
  const sp = A.SPECIES[id];
  const w = A.createWorld(few(id), id, 800, 600, srng);
  const a = w.animals[0];
  for (let lvl = 0; lvl < w.levels.length; lvl++) for (let k = 0; k < 16; k++) for (const t of [0, 0.37, 1.9]) {
    Object.assign(a, { x: 400, y: 300, lvl, dir: (k / 16) * Math.PI * 2 - Math.PI, at: t, spine: null });
    const n = A.raster(w, a);
    assert.ok(n > (lvl === 0 ? 25 : 0), id + ' few cells at level ' + lvl + ' heading ' + k + ': ' + n);
    const cells = new Set();
    for (let i = 0; i < n; i++) {
      const c = A.raster.buf.c[i], kind = c >> 16, col = (c >> 8) & 255, g = c & 255;
      assert.ok(kind >= 1 && kind <= 4 && col < sp.P.cols.length && g < 25, id + ' bad cell code ' + c);
      const key = A.raster.buf.x[i] + ',' + A.raster.buf.y[i];
      assert.ok(!cells.has(key), id + ' duplicate cell');
      cells.add(key);
    }
  }
}
// the raster box never clips a species: growing it 1.5x adds no cells, over headings, depth and a whole gait cycle
for (const id of A.ANIMALS) {
  const sp = A.SPECIES[id];
  if (!sp.box) continue; // koi are bounded by their spine
  const w = A.createWorld(few(id), id, 800, 600, srng);
  const a = w.animals[0], box = sp.box;
  for (const lvl of [0, 4]) for (let k = 0; k < 16; k++) for (let t = 0; t < 2.5; t += 0.1) {
    Object.assign(a, { x: 400, y: 300, lvl, dir: (k / 16) * Math.PI * 2, at: t, mode: id === 'frog' ? 'leap' : id === 'crab' ? 'go' : a.mode, timer: 0.5 * ((t * 4) % 1) });
    sp.box = box; const n = A.raster(w, a);
    sp.box = box.map((v) => v * 1.5); const m = A.raster(w, a);
    sp.box = box;
    assert.strictEqual(n, m, id + ' clipped by its box at heading ' + k + ', level ' + lvl + ', t ' + t.toFixed(1));
  }
}
// koi: same no-clipping check for the spine's row bound (pad), straight and sharply bent; and no body tile strays
// from the spine farther than the body half-width plus one cell (true point-to-segment distance)
{
  const sp = A.SPECIES.koi, w = A.createWorld(few('koi'), 'koi', 800, 600, srng);
  const a = w.animals[0], u = w.u, pad = sp.pad, nseg = sp.seg;
  const segDist = (x, y, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - x1 - dx * t, y - y1 - dy * t);
  };
  for (const lvl of [0, 4]) for (let k = 0; k < 16; k++) for (const bend of [0, 1.2, 2.4]) for (const eating of [false, true]) {
    const sc = w.levels[lvl].s, seg = (sp.len * u * sc) / nseg, p = new Float64Array(2 * (nseg + 1));
    let ang = (k / 16) * Math.PI * 2 + Math.PI, x = 400, y = 300; // spine runs back from the head, turning by `bend` in total
    for (let j = 0; j <= nseg; j++) { p[2 * j] = x; p[2 * j + 1] = y; x += Math.cos(ang) * seg; y += Math.sin(ang) * seg; if (j === 2) ang += bend; } // one sharp joint, like a feeding turn
    Object.assign(a, { x: 400, y: 300, lvl, dir: (k / 16) * Math.PI * 2, at: k * 0.3, eating, spine: p, spineU: u });
    sp.pad = pad; const n = A.raster(w, a);
    const B = A.raster.buf, limit = (sp.width * u * sc) + Math.max(w.cw, w.ch);
    for (let i = 0; i < n; i++) {
      const c = B.c[i];
      if (c >> 16 !== 1 || ((c >> 8) & 255) >= sp.P.fin[0]) continue; // body tiles only (not fins, tail, eyes)
      const cx = (B.x[i] + 0.5) * w.cw, cy = (B.y[i] + 0.5) * w.ch;
      let d = 1e9;
      for (let j = 0; j < nseg; j++) d = Math.min(d, segDist(cx, cy, p[2 * j], p[2 * j + 1], p[2 * j + 2], p[2 * j + 3]));
      assert.ok(d <= limit, 'koi body tile ' + d.toFixed(1) + ' px from the spine (limit ' + limit.toFixed(1) + ') at bend ' + bend);
    }
    sp.pad = pad * 1.5; const m = A.raster(w, a);
    sp.pad = pad;
    assert.strictEqual(n, m, 'koi clipped by its row bound at heading ' + k + ', level ' + lvl + ', bend ' + bend);
  }
}
// eyes: exactly two eye cells (one each), whatever the heading and the sub-cell position (a local box test gave 0 to 4)
for (const id of ['dragonfly', 'koi', 'frog', 'crane', 'crab']) {
  const sp = A.SPECIES[id], w = A.createWorld(few(id), id, 800, 600, srng), a = w.animals[0];
  for (const lvl of [0, 4]) for (const leap of id === 'frog' ? [false, true] : [false]) for (let k = 0; k < 16; k++) for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    Object.assign(a, { x: 400 + (i / 5) * w.cw, y: 300 + (j / 5) * w.ch, lvl, dir: (k / 16) * Math.PI * 2, at: 0.3, spine: null, mode: leap ? 'leap' : 'rest', timer: 0.25 });
    const n = A.raster(w, a), B = A.raster.buf, seen = new Set();
    let eyes = 0;
    for (let q = 0; q < n; q++) {
      const key = B.x[q] + ',' + B.y[q];
      assert.ok(!seen.has(key), id + ' cell emitted twice');
      seen.add(key);
      if (B.c[q] === sp.eye) eyes++;
    }
    assert.strictEqual(eyes, 2, id + ' has ' + eyes + ' eye cells (heading ' + k + ', offset ' + i + ',' + j + ', level ' + lvl + (leap ? ', leap)' : ')'));
  }
}
// bigger individuals cover more cells (depth reads as size); Size scales bodies, ASCII detail shrinks the cells
{
  const cells = (extra, lvl) => {
    const w = A.createWorld(few('butterfly', extra), 'butterfly', 800, 600, srng);
    const a = Object.assign(w.animals[0], { x: 400, y: 300, at: 0, ph: 0, gl: 0, lvl, seed: 1, dir: -0.8 });
    return A.raster(w, a);
  };
  assert.ok(cells({}, 0) > 4 * cells({}, 4), 'depth scale');
  assert.ok(cells({ size: 2.5 }, 0) > 3 * cells({ size: 1.25 }, 0), 'Size');
  assert.ok(cells({ detail: 2 }, 0) > 2 * cells({ detail: 1.3 }, 0), 'ASCII detail');
  assert.ok(cells({ farthest: 1 }, 4) === cells({}, 0), 'Farthest depth 1: every level is full size');
}
// depth levels: Farthest depth is the far scale, Far bias favours far levels, Distance fade dims them
{
  const L = A.levelsFor(A.normalize(), 'butterfly');
  assert.strictEqual(L.length, 5);
  assert.ok(L[0].s === 1 && Math.abs(L[4].s - 0.18) < 1e-9 && L[0].dim === 0 && Math.abs(L[4].dim - 0.48) < 1e-9);
  assert.ok(L[4].w > L[0].w, 'far bias > 1 favours far levels');
  assert.ok(A.levelsFor(A.normalize({ farBias: 0.5 }), 'butterfly')[4].w < 1);
  assert.ok(A.levelsFor(A.normalize({ fade: 0 }), 'butterfly').every((l) => l.dim === 0));
  // per-species reference defaults: a crab's far level is 0.25 at default and still follows the slider
  assert.ok(Math.abs(A.levelsFor(A.normalize(), 'crab')[4].s - 0.25) < 1e-9);
  assert.ok(A.levelsFor(A.normalize({ farthest: 0.5 }), 'crab')[4].s > 0.6);
  // no tweak is dead for any species, including ones whose reference default is 0 (crane trail, jellyfish shimmer)
  for (const id of A.ANIMALS) for (const k of ['trail', 'shimmer', 'sparkle', 'fade', 'farthest', 'farBias', 'hold', 'trailFade', 'detail', 'sway', 'spread']) {
    const t = A.TWEAKS.find((x) => x.key === k);
    assert.notStrictEqual(A.eff(A.normalize({ [k]: t.min }), id, k), A.eff(A.normalize({ [k]: t.max }), id, k), id + ' ' + k + ' is inert');
  }
}
// ... and Hue shift, Shimmer and Sparkle really change what is drawn (cellColor / variantOf are what the renderer uses)
{
  const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  for (const id of A.ANIMALS) {
    const sp = A.SPECIES[id], tile = (ci) => (1 << 16) | (ci << 8) | 5; // a TILE of palette colour ci
    const base = (ci) => A.cellColor(sp, tile(ci), 0, 0, 0);
    const moved = sp.P.cols.filter((_, ci) => Math.max(...A.cellColor(sp, tile(ci), 0, 120, 0).map((v, i) => Math.abs(v - base(ci)[i]))) > 10);
    assert.ok(moved.length > 0, id + ' Hue shift changes no colour');
    assert.ok(lum(A.cellColor(sp, tile(0), 0, 0, 1)) > lum(base(0)) && lum(A.cellColor(sp, tile(0), 0, 0, 2)) > lum(A.cellColor(sp, tile(0), 0, 0, 1)), id + ' lit variants are not brighter');
  }
  const lit = (extra, t) => { // the variant of every tile on a 60 x 40 patch, at world time t
    const w = A.createWorld(A.normalize(Object.assign({ animal: 'butterfly' }, extra)), 'butterfly', 800, 600, srng), a = { seed: 7 }; // the same animal every time
    w.t = t;
    let out = '';
    for (let gy = 0; gy < 40; gy++) for (let gx = 0; gx < 60; gx++) out += A.variantOf(w, a, gx, gy, (1 << 16) | 5);
    return out;
  };
  const count = (v, k) => v.split(k).length - 1;
  const still = lit({ shimmer: 0, sparkle: 0 }, 0);
  assert.strictEqual(count(still, '0'), 2400, 'Shimmer and Sparkle at 0 light nothing');
  assert.strictEqual(lit({ shimmer: 0, sparkle: 0 }, 5), still);
  const sh0 = lit({ shimmer: 1, sparkle: 0 }, 0), sh1 = lit({ shimmer: 1, sparkle: 0 }, 2);
  assert.ok(count(sh0, '1') > 200 && count(sh0, '2') === 0, 'Shimmer lights a band of tiles: ' + count(sh0, '1'));
  assert.notStrictEqual(sh0, sh1, 'the Shimmer band does not drift');
  const sp0 = lit({ shimmer: 0, sparkle: 0.5 }, 0), sp1 = lit({ shimmer: 0, sparkle: 0.5 }, 1);
  assert.ok(count(sp0, '2') > 20 && count(sp0, '1') === 0, 'Sparkle flashes single tiles: ' + count(sp0, '2'));
  assert.notStrictEqual(sp0, sp1, 'Sparkle does not change over time');
  const wl = A.createWorld(A.normalize({ shimmer: 1, sparkle: 0.5 }), 'butterfly', 800, 600, srng);
  assert.strictEqual(A.variantOf(wl, { seed: 1 }, 3, 4, (2 << 16) | 5), 0, 'only tiles are lit');
}

// ---------- simulation ----------
// count: the reference counts (the same at every window size), scaled by Density and, above the default Size, by 1/Size^2
const counts = { butterfly: 16, koi: 23, jellyfish: 10, dragonfly: 9, frog: 13, crane: 9, crab: 21 };
for (const id in counts) assert.strictEqual(A.countFor(A.normalize(), id), counts[id], id);
assert.strictEqual(A.countFor(A.normalize({ density: 2.1 }), 'butterfly'), 32);
assert.strictEqual(A.countFor(A.normalize({ size: 2.5 }), 'koi'), 6); // 23 / 4
assert.strictEqual(A.countFor(A.normalize({ size: 0.3 }), 'koi'), 23); // smaller bodies do not add animals
assert.ok(A.countFor(A.normalize({ density: 0.1 }), 'crane') >= 1);
for (const id of A.ANIMALS) assert.ok(A.countFor(A.normalize({ density: 4, size: 0.3 }), id) <= 120, id + ' worst-case count is capped');
// the scene scales with the window width (measured on the reference): 160 columns of cells at ASCII detail 1.3, character-shaped,
// bodies the same size in cells, the same number of animals
for (const [w, h, pitch] of [[760, 460, [5, 7]], [1440, 870, [9, 13]], [1920, 1080, [12, 17]]]) for (const id of ['koi', 'butterfly']) {
  const world = A.createWorld(A.normalize({ animal: id }), id, w, h, srng);
  assert.deepStrictEqual([Math.round(world.cw), Math.round(world.ch)], pitch, id + ' cell pitch at ' + w);
  assert.ok(Math.abs(world.cw * 160 - w) < 1e-6 && Math.abs(world.u / world.cw - 1) < 1e-9, 'grid and bodies follow the width at ' + w);
  assert.strictEqual(world.animals.length, counts[id]);
}
{
  const small = A.createWorld(A.normalize({ detail: 2 }), 'koi', 760, 460, srng), big = A.createWorld(A.normalize({ detail: 2 }), 'koi', 1920, 1080, srng);
  assert.ok(Math.abs((small.cw * 160) / 760 - 1.3 / 2) < 1e-9 && Math.abs(small.u / small.cw - big.u / big.cw) < 1e-9, 'ASCII detail multiplies the column count');
  assert.ok(A.createWorld(A.normalize(), 'koi', 0, 0, srng).cw > 0, 'a 0-sized first layout still has a grid');
}

// every species stays finite and inside the wrap bounds, including huge/zero/NaN dt, at several headings
let seed = 1;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (const id of A.ANIMALS) for (const direction of [49, 0, 135, 270]) {
  const s = A.normalize({ animal: id, density: 2, direction, sway: 0.6, flutter: 3, spread: 0.8 });
  const world = A.createWorld(s, id, 800, 600, rng);
  assert.strictEqual(world.animals.length, A.countFor(s, id));
  A.poke(world, 400, 300);
  for (const dt of [0.016, 0.016, 10, 0, NaN, -1, ...Array(300).fill(0.016)]) A.step(world, dt);
  for (const a of world.animals) {
    const m = (A.SPECIES[id].reach * world.levels[a.lvl].s + 2) * world.u;
    for (const v of [a.x, a.y, a.dir, a.ang, a.sp, a.kx, a.ky, a.gl]) assert.ok(Number.isFinite(v), id + ' NaN/Infinity');
    assert.ok(a.x >= -m && a.x <= 800 + m && a.y >= -m && a.y <= 600 + m, id + ' out of bounds');
    if (a.spine) assert.ok(a.spine.every(Number.isFinite), id + ' spine NaN');
    assert.ok(A.raster(world, a) > 0, id + ' empty after stepping');
  }
}

// undisturbed, the whole swarm faces one common heading: Direction (degrees, counter-clockwise from +x, screen up)
// or, with Corner to corner, the bottom-left to top-right diagonal; animals keep streaming across the screen
for (const id of A.ANIMALS) for (const [direction, corner] of [[49, false], [0, false], [90, false], [200, false], [300, false], [49, true]]) {
  const world = A.createWorld(A.normalize({ animal: id, density: 2, direction, corner }), id, 1440, 870, rng);
  const want = corner ? Math.atan2(-870, 1440) : (-direction * Math.PI) / 180;
  assert.ok(Math.abs(Math.cos(world.heading - want) - 1) < 1e-9, 'heading ' + direction);
  for (let i = 0; i < 400; i++) A.step(world, 0.05);
  for (const a of world.animals) assert.ok(Math.cos(a.dir - want) > 0.97, id + ' strays from the common heading ' + direction + (corner ? ' corner' : ''));
  const visible = (a) => { // at least one cell on screen
    const n = A.raster(world, a), B = A.raster.buf;
    for (let i = 0; i < n; i++) if (B.x[i] >= 0 && B.y[i] >= 0 && B.x[i] * world.cw < 1440 && B.y[i] * world.ch < 870) return true;
    return false;
  };
  const onScreen = world.animals.filter(visible).length;
  assert.ok(onScreen >= 0.5 * world.animals.length, id + ' piles up off screen at ' + direction + ': ' + onScreen + ' of ' + world.animals.length);
}
assert.ok(Math.sin(A.createWorld(A.normalize({ direction: 90 }), 'koi', 800, 600, rng).heading) < -0.99, '90 degrees is straight up');

// spacing: a swarm squeezed into a small clump (twice the default density) spreads out under the separation force: five
// seconds later same-depth neighbours are much farther apart (nearest one, in units of their spacing radii) than with
// the force switched off, and the swarm still holds the common heading
const radius = (w, a) => A.SPECIES[w.animal].space * w.levels[a.lvl].s * w.u;
for (const id of A.ANIMALS) {
  const nearest = (off) => {
    let sd = 1;
    const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const world = A.createWorld(A.normalize({ animal: id, density: 2.1 }), id, 1440, 870, r);
    world.animals.forEach((a, i) => { a.x = 600 + (i % 6) * 10; a.y = 400 + Math.floor(i / 6) * 10; a.spine = null; });
    if (off) world.sep = 0;
    for (let i = 0; i < 100; i++) A.step(world, 0.05);
    let sum = 0, n = 0;
    for (const a of world.animals) {
      let best = Infinity;
      for (const b of world.animals) if (a !== b && a.lvl === b.lvl) best = Math.min(best, Math.hypot(a.x - b.x, a.y - b.y) / (radius(world, a) + radius(world, b)));
      if (best < Infinity) { sum += best; n++; }
    }
    for (const a of world.animals) assert.ok(Math.cos(a.dir - world.heading) > 0.97, id + ' spacing bent the heading');
    return sum / n;
  };
  const on = nearest(false), off = nearest(true);
  assert.ok(on > 1.5 * off, id + ' separation does not spread a clump: ' + on.toFixed(2) + ' vs ' + off.toFixed(2) + ' without it');
}

// ... and the cruising separation force pulls a crowded pair apart (sideways, keeping the heading)
for (const id of A.ANIMALS) {
  const world = A.createWorld(A.normalize({ animal: id, density: 0.1 }), id, 1440, 870, rng);
  const [a, b] = world.animals.length > 1 ? world.animals : [world.animals[0], A.createWorld(A.normalize({ animal: id }), id, 1440, 870, rng).animals[0]];
  world.animals = [a, b];
  Object.assign(a, { x: 700, y: 450, lvl: 1, dir: world.heading }); Object.assign(b, { x: 712, y: 452, lvl: 1, dir: world.heading, spine: null });
  a.spine = null;
  for (let i = 0; i < 800; i++) A.step(world, 0.05); // 40 s: the sideways push is capped (about 10 degrees), so a pair parts slowly
  const r = Math.hypot(a.x - b.x, a.y - b.y) / (radius(world, a) + radius(world, b));
  assert.ok(r >= 1, id + ' crowded pair stays together: ' + r.toFixed(2));
  for (const c of [a, b]) assert.ok(Math.cos(c.dir - world.heading) > 0.97, id + ' separation bent the heading');
}

// the sideways separation push never turns an animal's travel direction more than ~10 degrees off its own heading
// (Density 4, Separation 1000: the push used to be uncapped and sent animals 40-90 degrees sideways)
for (const id of A.ANIMALS) {
  const world = A.createWorld(A.normalize({ animal: id, density: 4, separation: 1000 }), id, 1440, 870, rng);
  for (let i = 0; i < 100; i++) A.step(world, 0.05);
  let worst = 0, moves = 0;
  for (let i = 0; i < 300; i++) {
    const p = world.animals.map((a) => [a.x, a.y]);
    A.step(world, 0.05);
    world.animals.forEach((a, j) => {
      const dx = a.x - p[j][0], dy = a.y - p[j][1], d = Math.hypot(dx, dy);
      if (d < 1e-6 || d > 2 * world.u) return; // resting, or re-entered at the far edge
      moves++;
      worst = Math.max(worst, Math.acos(Math.min(1, (dx * Math.cos(a.dir) + dy * Math.sin(a.dir)) / d)));
    });
  }
  assert.ok(moves > 100 && worst < (10.5 * Math.PI) / 180, id + ' sideways push bends the travel direction by ' + ((worst * 180) / Math.PI).toFixed(1) + ' degrees');
}

// occlusion: forced overlaps (same centre, different depth): no cell is drawn by two animals, and a farther animal
// draws nothing inside the nearer one's silhouette grown by one cell around its tiles (the moat)
for (const id of A.ANIMALS) {
  const world = A.createWorld(A.normalize({ animal: id, density: 2 }), id, 800, 600, srng), pair = world.animals.slice(0, 2);
  for (const [lf, ln, dx] of [[2, 0, 0], [4, 1, 30], [1, 0, -25]]) {
    const far = Object.assign(pair[0], { x: 400 + dx * (world.u / 9), y: 300, lvl: lf, dir: -0.8, spine: null });
    const near = Object.assign(pair[1], { x: 400, y: 300, lvl: ln, dir: -0.8, spine: null });
    world.animals.length = 2; world.animals[0] = far; world.animals[1] = near; // far-first, as configure sorts them
    const n = A.raster(world, near), moat = new Set(), TILE = 1, EYE = 4;
    for (let i = 0; i < n; i++) {
      const x = A.raster.buf.x[i], y = A.raster.buf.y[i], kind = A.raster.buf.c[i] >> 16;
      if (kind !== TILE && kind !== EYE) { moat.add(x + ',' + y); continue; }
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) moat.add(x + ox + ',' + (y + oy));
    }
    const seen = new Map();
    let farCells = 0, farHidden = 0;
    A.compose(world, (a, gx, gy) => {
      const key = gx + ',' + gy;
      assert.ok(!seen.has(key), id + ' cell ' + key + ' drawn twice');
      seen.set(key, a);
      if (a === far) { farCells++; assert.ok(!moat.has(key), id + ' far animal draws inside the near one\'s moat at ' + key); }
    });
    A.raster(world, far);
    for (let i = 0; i < A.raster.buf.n; i++) if (moat.has(A.raster.buf.x[i] + ',' + A.raster.buf.y[i])) farHidden++;
    assert.ok(farHidden > 0, id + ' test did not overlap'); // the case is really an overlap
    assert.ok([...seen.values()].includes(near));
  }
}

// click: others turn away from the point, then curve back to the common heading
const crab = A.createWorld(A.normalize({ animal: 'crab', density: 3 }), 'crab', 800, 600, rng);
Object.assign(crab.animals[0], { x: 410, y: 300 });
A.poke(crab, 400, 300);
assert.ok(crab.animals[0].kx > 0 && Math.abs(crab.animals[0].fleeDir) < 0.01);
for (let i = 0; i < 6; i++) A.step(crab, 0.05);
assert.ok(Math.cos(crab.animals[0].dir) > 0.9, 'turned away from the click');
for (let i = 0; i < 80; i++) A.step(crab, 0.05);
assert.ok(Math.cos(crab.animals[0].dir - crab.heading) > 0.97, 'rejoined the heading');

// koi (in a 1440 px wide world, where a body unit is 9 px): a click drops food (which fades away); a nearby koi turns to it, its body bends, and it eats
const koi = A.createWorld(few('koi'), 'koi', 1440, 870, rng);
koi.animals.length = 1;
const fish = Object.assign(koi.animals[0], { x: 300, y: 300, dir: -Math.PI / 4, lvl: 0, spine: null });
A.step(koi, 0.016);
A.poke(koi, 300, 420); // food straight below the fish, far off its heading
const n0 = koi.pellets.length;
assert.ok(n0 > 0 && koi.ripples.length === 1);
let bent = 0;
const seg = (A.SPECIES.koi.len * koi.u) / A.SPECIES.koi.seg;
for (let i = 0; i < 60; i++) {
  A.step(koi, 0.05);
  const p = fish.spine, head = Math.atan2(p[1] - p[3], p[0] - p[2]), tail = Math.atan2(p[p.length - 3] - p[p.length - 1], p[p.length - 4] - p[p.length - 2]);
  bent = Math.max(bent, Math.abs(Math.atan2(Math.sin(head - tail), Math.cos(head - tail))));
  for (let j = 2; j < p.length; j += 2) assert.ok(Math.hypot(p[j] - p[j - 2], p[j + 1] - p[j - 1]) < 2 * seg, 'spine stretched');
}
assert.ok(fish.eating && Math.sin(fish.dir) > 0, 'koi turns toward the food');
assert.ok(bent > 0.4, 'koi body bends while turning: ' + bent);
// it eats: pellets disappear long before their 7 s natural expiry (3 s have passed)
assert.ok(koi.pellets.length < n0, 'koi ate nothing: ' + koi.pellets.length + ' of ' + n0 + ' left');
for (let i = 0; i < 700; i++) A.step(koi, 0.05);
assert.ok(koi.pellets.length === 0 && koi.ripples.length === 0);
// a re-entering koi carries its whole spine across the edge: right after the jump the body still lies along the heading
Object.assign(fish, { x: 1300, y: 300, dir: koi.heading, bias: 0, spine: null });
A.step(koi, 0.016);
let wrapped = false;
for (let i = 0; i < 600 && !wrapped; i++) {
  const x0 = fish.x, y0 = fish.y;
  A.step(koi, 0.05);
  if (Math.hypot(fish.x - x0, fish.y - y0) < 100) continue;
  wrapped = true;
  const p = fish.spine, n = p.length, body = Math.atan2(p[1] - p[n - 1], p[0] - p[n - 2]);
  assert.ok(Math.abs(Math.atan2(Math.sin(body - fish.dir), Math.cos(body - fish.dir))) < 0.2, 'body twisted across a wrap: ' + body + ' vs ' + fish.dir);
}
assert.ok(wrapped, 'koi never wrapped');

// weighted varieties: kohaku koi are the most common
const kw = A.createWorld(A.normalize({ animal: 'koi', density: 4 }), 'koi', 2880, 1740, rng);
const vc = [0, 0, 0, 0];
for (const a of kw.animals) vc[a.pal]++;
assert.ok(vc[0] > vc[1] && vc[1] > vc[3] && vc.every((c) => c > 0), 'variety weights ' + vc);

// trails: with a trail, every species builds up a wake (in-bounds steps must not count as wraps)
for (const id of A.ANIMALS) {
  const world = A.createWorld(A.normalize({ animal: id, density: 2, trail: 4 }), id, 1440, 870, rng);
  for (let i = 0; i < 200; i++) A.step(world, 0.05);
  const long = world.animals.filter((a) => a.trail.length > 1).length;
  assert.ok(long >= 0.8 * world.animals.length, id + ' trails keep resetting: ' + long + ' of ' + world.animals.length);
}
// no points are recorded when trail is 0 (or an old "off")
for (const trail of [0, false]) {
  const nt = A.createWorld(A.normalize({ animal: 'koi', trail }), 'koi', 800, 600, rng);
  for (let i = 0; i < 50; i++) A.step(nt, 0.016);
  assert.ok(nt.animals.every((a) => a.trail.length === 0));
}

// Glide: with glide 0 nobody glides; at the default some do; Flap rate speeds up the animation clock
for (const glide of [0, 2.75]) {
  const w = A.createWorld(A.normalize({ glide, density: 3 }), 'butterfly', 1440, 870, rng);
  let gl = 0;
  for (let i = 0; i < 200; i++) { A.step(w, 0.05); gl = Math.max(gl, ...w.animals.map((a) => a.gl)); }
  assert.ok(glide ? gl > 0.9 : gl === 0, 'glide ' + glide + ': ' + gl);
}
{
  const w = A.createWorld(A.normalize({ flapRate: 3 }), 'butterfly', 800, 600, rng), a = w.animals[0], t0 = a.at;
  A.step(w, 0.05);
  assert.ok(Math.abs(a.at - t0 - 0.05 * 3 * w.speed) < 1e-9);
}

// Far bias applies to a running swarm, not only to new arrivals
{
  const w = A.createWorld(A.normalize({ density: 4, farBias: 0.3 }), 'butterfly', 1440, 870, rng);
  const mean = () => w.animals.reduce((n, a) => n + a.lvl, 0) / w.animals.length, m0 = mean();
  A.configure(w, A.normalize({ density: 4, farBias: 3 }), 'butterfly');
  assert.ok(mean() > m0 + 0.5, 'far bias did not move the running swarm: ' + m0.toFixed(2) + ' -> ' + mean().toFixed(2));
  for (let i = 1; i < w.animals.length; i++) assert.ok(w.animals[i - 1].lvl >= w.animals[i].lvl, 'still drawn far-first');
}

// lowering Density (or shrinking the window) keeps every depth level that existed, not just the far ones
for (const id of ['butterfly', 'koi']) {
  const world = A.createWorld(A.normalize({ animal: id, density: 4 }), id, 3840, 2160, rng);
  const before = new Set(world.animals.map((a) => a.lvl));
  A.configure(world, A.normalize({ density: 0.5 }), id);
  const n = world.animals.length, after = new Set(world.animals.map((a) => a.lvl));
  assert.ok(n >= 5 && n === A.countFor(A.normalize({ density: 0.5 }), id));
  for (const l of before) assert.ok(after.has(l), id + ' lost every animal at depth ' + l);
  for (let i = 1; i < n; i++) assert.ok(world.animals[i - 1].lvl >= world.animals[i].lvl, 'still drawn far-first');
}

// ---------- newtab.js pure helpers (the file exports them instead of touching the DOM when loaded by node) ----------
const N = require('./newtab.js');
const { asUrl, greeting } = N;
for (const text of ['node.js', 'index.html', 'readme.md', 'config.json', 'next.js', 'hello world', 'example.com/a b', 'javascript:alert(1)', 'merhaba']) assert.strictEqual(asUrl(text), null, text);
assert.strictEqual(asUrl('example.com'), 'https://example.com');
assert.strictEqual(asUrl('github.com/foo'), 'https://github.com/foo');
assert.strictEqual(asUrl('192.168.1.1'), 'http://192.168.1.1');
assert.strictEqual(asUrl('192.168.1.1:8080/x'), 'http://192.168.1.1:8080/x');
assert.strictEqual(asUrl('localhost:3000'), 'http://localhost:3000');
assert.strictEqual(asUrl('localhost'), 'http://localhost');
assert.strictEqual(asUrl('https://x.y'), 'https://x.y');
assert.strictEqual(asUrl('HTTP://Example.org'), 'HTTP://Example.org');
assert.strictEqual(asUrl('docs.example.co.uk/x'), 'https://docs.example.co.uk/x');
assert.strictEqual(greeting(5, ''), 'Good morning');
assert.strictEqual(greeting(11, 'Sam'), 'Good morning, Sam');
assert.strictEqual(greeting(12, ''), 'Good afternoon');
assert.strictEqual(greeting(18, 'Sam'), 'Good evening, Sam');
assert.strictEqual(greeting(23, ''), 'Still up?');
assert.strictEqual(greeting(2, 'Sam'), 'Still up, Sam?');

// recents: newest first, de-duplicated ignoring case, capped at 50, blank ignored
{
  let r = [];
  r = N.addRecent(r, 'cats'); r = N.addRecent(r, 'dogs'); r = N.addRecent(r, '  CATS ');
  assert.deepStrictEqual(r, ['CATS', 'dogs']);
  assert.deepStrictEqual(N.addRecent(r, '   '), r);
  for (let i = 0; i < 80; i++) r = N.addRecent(r, 'q' + i);
  assert.strictEqual(r.length, 50);
  assert.strictEqual(r[0], 'q79');
  assert.deepStrictEqual(N.removeRecent(['a', 'B', 'c'], 'b'), ['a', 'c']);
  assert.deepStrictEqual(N.addRecent(undefined, 'x'), ['x']);
}
// suggest response parsing: [query, [suggestions...], ...]; anything else is []
{
  const real = ['ascii art', ['ascii art generator', 'ascii art archive', 'ascii art valorant', 'ascii art maker', 'ascii art eu', 'ascii art steam', 'ascii art text', 'ascii art copy paste', 'ascii arts', 'ascıı art kopyala'], ['', ''], [], { 'google:suggesttype': ['QUERY'] }];
  assert.deepStrictEqual(N.parseSuggest(real), real[1].slice(0, 8));
  for (const bad of [null, {}, [], ['q'], ['q', 'x'], 'text', ['q', [1, null, ' ', 'ok']]]) assert.ok(Array.isArray(N.parseSuggest(bad)));
  assert.deepStrictEqual(N.parseSuggest(['q', [1, null, ' ', 'ok']]), ['ok']);
}
// image URLs go to Lens by URL; anything else opens the Lens upload page
assert.ok(N.isImageUrl('https://x.org/a/cat.PNG'));
assert.ok(N.isImageUrl('http://x.org/a.jpeg?w=200'));
assert.ok(N.isImageUrl('https://x.org/a.webp#f'));
for (const t of ['https://x.org/a.png.html', 'ftp://x.org/a.png', 'cat.png', 'https://x.org/gif', 'javascript:a.png']) assert.ok(!N.isImageUrl(t), t);
assert.strictEqual(N.lensUrl(''), 'https://www.google.com/?olud');
assert.strictEqual(N.lensUrl('cats'), 'https://www.google.com/?olud');
assert.strictEqual(N.lensUrl(' https://x.org/a b.png '), 'https://www.google.com/?olud'); // spaces: not a URL
assert.strictEqual(N.lensUrl(' https://x.org/a.gif '), 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent('https://x.org/a.gif'));
assert.strictEqual(N.lensUrl('https://x.org/a.png?s=1&t=2'), 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent('https://x.org/a.png?s=1&t=2'));
// dropdown items: matching recents first (max 8 in all), then suggestions not already listed; empty query = recents
{
  const items = N.mergeItems(['Cat food', 'dog', 'cats'], ['cats', 'cat videos', 'CAT FOOD', 'catalog'], 'cat');
  assert.deepStrictEqual(items, [{ text: 'Cat food', recent: true }, { text: 'cats', recent: true }, { text: 'cat videos', recent: false }, { text: 'catalog', recent: false }]);
  const many = Array.from({ length: 20 }, (_, i) => 'r' + i);
  assert.strictEqual(N.mergeItems(many, [], '').length, 8);
  assert.ok(N.mergeItems(many, [], '').every((i) => i.recent));
  assert.strictEqual(N.mergeItems(many, ['r-x', 'r-y'], 'r').length, 8);
}
// suggestions are only requested for something that looks like a search: not a URL, not a long paste; a changed query
// drops the old suggestions that no longer contain it
assert.ok(N.canSuggest('cats') && N.canSuggest('node.js') && N.canSuggest('how to cook rice') && N.canSuggest('x'.repeat(100)));
for (const q of ['', 'example.com', 'https://example.com/a?b=c', 'localhost:3000', '192.168.1.1', 'x'.repeat(101), 'how '.repeat(30)]) assert.ok(!N.canSuggest(q), 'no suggest request for ' + q.slice(0, 20));
assert.deepStrictEqual(N.narrow(['cat videos', 'cats', 'Catalog', 'dog'], 'cat v'), ['cat videos']);
assert.deepStrictEqual(N.narrow(['cat videos', 'cats', 'Catalog', 'dog'], ' CAT '), ['cat videos', 'cats', 'Catalog']);
assert.deepStrictEqual(N.narrow(['cat videos'], 'dogs'), []);
assert.deepStrictEqual(N.narrow(['cat videos'], '  '), []);
assert.deepStrictEqual(N.narrow(undefined, 'a'), []);

console.log('all tests passed');
