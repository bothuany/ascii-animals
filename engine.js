// Shared ASCII-animals renderer. No host code: hosts call AsciiAnimals.start(canvas, settings).
// Pure logic (normalize, fromWallpaperProps, countFor, createWorld, step, poke, raster) is importable in node.
(function () {
  'use strict';

  const ANIMALS = ['butterfly', 'jellyfish', 'dragonfly', 'koi', 'frog', 'crane', 'crab'];
  const ALIASES = { bird: 'crane' }; // old saved settings keep working
  // The tweak set of the reference app's Tweaks panel: [key, label, group, min, max, step, default].
  // Values are relative to each species' own look: at the defaults every species looks like the reference at its
  // defaults (see LIVE below). `glass` applies to the new-tab search panel only.
  const TWEAKS = [
    ['density', 'Density', 'Movement', 0.1, 4, 0.05, 1.05],
    ['corner', 'Corner to corner', 'Movement', 0, 1, 1, false],
    ['direction', 'Direction (°)', 'Movement', 0, 360, 1, 49],
    ['speed', 'Speed', 'Movement', 0.1, 3, 0.05, 1.05],
    ['sway', 'Sway', 'Movement', 0, 0.6, 0.01, 0],
    ['spread', 'Spread', 'Movement', 0, 0.8, 0.01, 0],
    ['size', 'Size', 'Movement', 0.3, 2.5, 0.05, 1.25],
    ['farthest', 'Farthest depth', 'Movement', 0.1, 1, 0.01, 0.18],
    ['farBias', 'Far bias', 'Movement', 0.3, 3, 0.05, 1.7],
    ['hold', 'Hold course', 'Movement', 0.2, 5, 0.05, 5],
    ['separation', 'Separation', 'Movement', 0, 1000, 10, 700],
    ['flutter', 'Flutter', 'Flight', 0, 3, 0.05, 0],
    ['glide', 'Glide', 'Flight', 0, 4, 0.05, 2.75],
    ['flapRate', 'Flap rate', 'Flight', 0.2, 3, 0.05, 1],
    ['hue', 'Hue shift (°)', 'Look', -180, 180, 1, 0],
    ['shimmer', 'Shimmer', 'Look', 0, 1, 0.01, 0.3],
    ['sparkle', 'Sparkle', 'Look', 0, 0.5, 0.01, 0.12],
    ['fade', 'Distance fade', 'Look', 0, 1, 0.01, 0.75],
    ['trail', 'Trail', 'Look', 0, 4, 0.05, 1.55],
    ['trailFade', 'Trail fade', 'Look', 0.05, 6, 0.05, 0.15],
    ['grid', 'Grid', 'Look', 0, 4, 0.05, 1.05],
    ['detail', 'ASCII detail', 'Look', 0.5, 2, 0.05, 1.3],
    ['blur', 'Blur (px)', 'Chat glass', 0, 30, 0.5, 3.5],
    ['refraction', 'Refraction', 'Chat glass', 0, 150, 1, 40],
    ['ripple', 'Ripple', 'Chat glass', 0.001, 0.04, 0.001, 0.007],
    ['tint', 'Tint', 'Chat glass', 0, 3, 0.05, 0],
    ['edge', 'Edge', 'Chat glass', 0, 2, 0.05, 0.55],
    ['radius', 'Corner radius', 'Chat glass', 0, 48, 1, 24],
    ['width', 'Width', 'Chat glass', 320, 960, 10, 720],
  ].map(([key, label, group, min, max, step, def]) => ({ key, label, group, min, max, step, def }));
  const DEFAULTS = { animal: 'butterfly', name: '' };
  const LIMITS = {};
  for (const t of TWEAKS) { DEFAULTS[t.key] = t.def; LIMITS[t.key] = [t.min, t.max]; }
  const BG = '#08090d';
  // Measured on the reference at 760, 1440 and 1920 px wide (ASCII detail 1.3): the whole scene scales with the window width.
  // The grid is always 160 columns wide (cells 5 x 7, 9 x 13 and 12 x 17 px), cells are character-shaped (height 1.425 x width),
  // and the animals keep the same size in cells and the same count. Shapes are designed in an isotropic unit (9 px at 1440, i.e.
  // one cell, at Size 1.25) and rasterised onto that rectangular grid.
  const COLS = 160, CELL_ASPECT = 12.4 / 8.7, UNIT = 9, REF_W = 1440, MIN_W = 320;
  const MAX_ANIMALS = 120, MAX_LATERAL = Math.tan((10 * Math.PI) / 180); // spacing push / forward speed
  const TAU = Math.PI * 2;
  // The reference app's per-species defaults for the shared tweaks (its panel differs per species; size, speed and
  // spacing differences are already in each species' own constants). A setting scales the species' value:
  // eff = setting * live / default, or setting + (live - default) where either is 0 so no slider goes dead.
  // n = individuals on screen with default settings, counted on the reference (about the same at every window size).
  const LIVE = {
    butterfly: { n: 16 },
    koi: { n: 23, farthest: 0.33, farBias: 1.3, hold: 2.65, shimmer: 0.35, sparkle: 0.08, fade: 0.64, trail: 4, trailFade: 0.4 },
    jellyfish: { n: 10, farthest: 0.3, farBias: 1.4, hold: 1.4, sway: 0.04, spread: 0.08, shimmer: 0, sparkle: 0.1, trail: 0.8, trailFade: 0.6 },
    dragonfly: { n: 9, farthest: 0.32, farBias: 3, shimmer: 0, sparkle: 0.18, fade: 0.26, trail: 0.6, trailFade: 1.2 },
    frog: { n: 13, farthest: 0.35, farBias: 1.4, shimmer: 0.15, sparkle: 0.05, fade: 0, trail: 3.45, trailFade: 0.4 },
    crane: { n: 9, farthest: 0.35, farBias: 1.3, hold: 3, shimmer: 0.1, sparkle: 0.04, trail: 0, trailFade: 1.3, detail: 1.7 },
    crab: { n: 21, farthest: 0.25, farBias: 0.7, hold: 3, shimmer: 0.1, sparkle: 0.03, fade: 0.12, trail: 1.2, trailFade: 0.35, detail: 1.7 },
  };
  // The effective value of tweak k for this species (clamped to the tweak's range).
  function eff(s, animal, k) {
    const live = LIVE[animal][k], d = DEFAULTS[k];
    if (live === undefined) return s[k];
    return clamp(d && live ? (s[k] * live) / d : s[k] + live - d, LIMITS[k][0], LIMITS[k][1]);
  }
  // Depth: five levels from near (s = 1) to Farthest depth; Far bias makes far ones more common; Distance fade dims
  // them (colour mixed toward the background). k = speed factor.
  function levelsFor(s, animal) {
    const far = eff(s, animal, 'farthest'), bias = eff(s, animal, 'farBias'), fade = eff(s, animal, 'fade');
    return [0, 1, 2, 3, 4].map((i) => {
      const sc = 1 - ((1 - far) * i) / 4;
      return { s: sc, k: 0.4 + 0.6 * sc, dim: fade * 0.64 * (i / 4), w: Math.max(0.05, 1 + ((bias - 1) * i) / 4) };
    });
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const wrapPi = (a) => { a %= TAU; return a > Math.PI ? a - TAU : a < -Math.PI ? a + TAU : a; };
  const mod = (v, n) => ((v % n) + n) % n;
  // Deterministic per-cell noise in [0,1).
  function H(x, y, s) {
    let h = (Math.imul(x + 101, 374761393) ^ Math.imul(y + 211, 668265263) ^ Math.imul((s || 0) + 7, 2246822519)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // Smooth value noise in [0,1) for organic patches.
  function vn(x, y, s) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = H(ix, iy, s), b = H(ix + 1, iy, s), c = H(ix, iy + 1, s), d = H(ix + 1, iy + 1, s);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  const hr = (x, y, s) => H(Math.round(x), Math.round(y), s); // hash of the body-local cell, so texture rides on the body
  function segDist(x, y, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, t = clamp(((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(x - x1 - dx * t, y - y1 - dy * t);
  }

  // ---------- settings ----------
  function bool(v, d) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      if (/^(false|0|no|off)$/i.test(v)) return false;
      if (/^(true|1|yes|on)$/i.test(v)) return true;
    }
    return d;
  }
  const num = (v) => (v == null || typeof v === 'boolean' || (typeof v === 'string' && !v.trim()) ? NaN : Number(v));
  // Accepts any input shape (WE values, query strings, storage) and returns a complete valid settings object.
  function normalize(raw) {
    const r = Object.assign({}, raw);
    // settings saved by older versions: count 5-80 (25 = default swarm), character size 6-20 px, trail on/off
    if (r.density === undefined && Number.isFinite(num(r.count))) r.density = (num(r.count) / 25) * DEFAULTS.density;
    if (r.detail === undefined && num(r.size) >= 6 && num(r.size) <= 20) { r.detail = (DEFAULTS.detail * 10) / num(r.size); r.size = undefined; }
    if (typeof r.trail === 'boolean' || /^(true|false|yes|no|on|off)$/i.test(r.trail)) r.trail = bool(r.trail, true) ? DEFAULTS.trail : 0;
    let animal = String(r.animal == null ? DEFAULTS.animal : r.animal).toLowerCase();
    animal = ALIASES[animal] || animal;
    const out = {
      animal: ANIMALS.includes(animal) ? animal : DEFAULTS.animal, // old 'random' and unknown values -> default
      name: String(r.name == null ? '' : r.name).trim().slice(0, 40),
    };
    for (const t of TWEAKS) {
      if (typeof t.def === 'boolean') { out[t.key] = bool(r[t.key], t.def); continue; }
      const n = num(r[t.key]), v = clamp(Number.isFinite(n) ? n : t.def, t.min, t.max);
      out[t.key] = +(Math.round(v / t.step) * t.step).toFixed(4); // snapped to the slider step
    }
    return out;
  }
  // Wallpaper Engine sends only changed properties as {key: {value}}; property keys are the tweak keys lowercased.
  function fromWallpaperProps(props) {
    const out = {};
    for (const k of ['animal', ...TWEAKS.filter((t) => t.group !== 'Chat glass').map((t) => t.key)]) {
      const p = props && props[k.toLowerCase()];
      if (p && p.value !== undefined) out[k] = p.value;
    }
    return out;
  }

  // ---------- cells ----------
  // A cell is one int: kind<<16 | colour<<8 | glyph. TILE = rounded tile with a glyph in a shade of its colour,
  // HALO = very dim tile around a silhouette, BARE = glyph only (thin parts), EYE = white tile with a black pupil.
  const TILE = 1, HALO = 2, BARE = 3, EYE = 4;
  const enc = (k, c, g) => (k << 16) | (c << 8) | g;
  const GL = ' .:-=+*%#8@0o|/\\{}()§~!•'; // index 0 = no glyph; '•' is drawn as a filled dot
  const gs = (s) => Array.from(s, (c) => GL.indexOf(c));
  const [DOT, OH, PERIOD] = gs('•o.');
  const LINE = gs('-\\|/'); // screen angle 0, 45, 90, 135 degrees (y points down)
  const pick = (set, h) => set[Math.floor(h * set.length) % set.length];
  // The glyph that draws a line at screen angle th, so thin parts stay right while a body rotates.
  const lineGlyph = (th) => LINE[Math.round(mod(th, Math.PI) / (Math.PI / 4)) % 4];
  const ramp = (r, v) => r[0] + clamp(Math.round(v * (r[1] - 1)), 0, r[1] - 1);
  function palette(groups) { // {name: [hex...]} -> {cols, name: [start, n]}
    const out = { cols: [] };
    for (const k in groups) { out[k] = [out.cols.length, groups[k].length]; out.cols.push(...groups[k]); }
    return out;
  }

  // Each species: palette P (P.cols indexed by cells), box = local bounds in cells at full size (x forward along
  // the heading, y to the right of it), cell(a, at) -> code where at = {x, y, tw, th} (tw = half a screen cell in local units,
  // th = screen angle of the body), gait(a, dt, world) -> cells/s, prep(a) = per-frame animation values. Animation runs on
  // a.at (advanced at Flap rate) and a.gl in [0, 1] (Glide: wings held, strokes relaxed).
  const SPECIES = {};

  // Butterfly: four rounded lobes in an X around the body (at 45 degrees they sit on the screen axes like a clover),
  // lighter toward the lobe centres, dim indigo halo, two dashed antennae ending in 'o'.
  {
    const P = palette({
      blue: ['#10284d', '#173c6c', '#22548c', '#3270aa', '#4489c8', '#58a0de', '#7db8ea', '#a9d0f1'],
      halo: ['#4b567f'], body: ['#2a3350'], pale: ['#c4cad6'], ant: ['#aab1c0'], trail: ['#3a4a6a'],
    });
    // [angle from heading, centre distance, radial and tangential half-size, brightness lift]: forewings sweep
    // forward-out, hindwings back-out (measured on t40: about +-68 and +-142 degrees)
    const LOBES = [[1.19, 6, 5.1, 3.5, 0.06], [-1.19, 6, 5.1, 3.5, 0.06], [2.48, 5, 4.3, 3.1, 0], [-2.48, 5, 4.3, 3.1, 0]]
      .map(([t, r, A, B, lift]) => ({ c: Math.cos(t), s: Math.sin(t), cx: r * Math.cos(t), cy: r * Math.sin(t), A, B, lift }));
    const G = gs(':=+-:=.:+=*'), BODY = gs('8@#%'), HG = gs('#%@8:='), TIP = gs('0o');
    SPECIES.butterfly = {
      P, box: [-10, 12, -12.5, 12.5], space: 10, trailCol: P.trail[0],
      gait: () => 7.5,
      prep(a) { const f = 0.16 + 0.84 * Math.sqrt(0.5 + 0.5 * Math.cos(a.at * 9 + a.ph)); a.p0 = f + (0.92 - f) * a.gl; }, // gliding: wings held open
      cell(a, at) {
        let x = at.x, y = at.y, tw = at.tw; const th = at.th;
        const h = hr(x, y, a.seed);
        if (Math.abs(y) < 0.62 && x > -3.8 && x < 2.4) return enc(TILE, P.body[0], pick(BODY, h));
        const yy = y / a.p0;
        let best = 1e9, lift = 0, inner = 0;
        for (const L of LOBES) { // superellipse (exponent 3), compared cubed
          const qx = x - L.cx, qy = yy - L.cy, ra = (qx * L.c + qy * L.s) / L.A, rt = Math.abs(-qx * L.s + qy * L.c) / L.B, ar = Math.abs(ra);
          const r3 = ar * ar * ar + rt * rt * rt;
          if (r3 < best) { best = r3; lift = L.lift; inner = Math.max(0, -ra); }
        }
        const r = best < 2.5 ? Math.cbrt(best) + (vn(x * 0.7, yy * 0.7, a.seed) - 0.5) * 0.1 : 9;
        if (r <= 1) {
          if (r > 0.72 && inner === 0 && h < 0.06) return enc(TILE, P.pale[0], pick(TIP, h * 16));
          const v = 1.08 - r * 0.55 - inner * 0.3 + lift + (H(Math.round(x), Math.round(yy), a.seed + 1) - 0.5) * 0.16;
          return enc(TILE, ramp(P.blue, v), pick(G, H(Math.round(x), Math.round(y), a.seed + 2)));
        }
        for (const sg of [-1, 1]) { // antennae: from the head, +-45 degrees, dashed, ending in 'o'
          const ex = 2.6 + 6.4 * 0.71, ey = sg * 6.4 * 0.7;
          if (Math.hypot(x - ex, y - ey) < tw * 0.8) return enc(BARE, P.ant[0], OH);
          if (x > 2.8 && segDist(x, y, 2.6, 0, ex, ey) < tw && hr(x, y, a.seed + 3) > 0.12) return enc(BARE, P.ant[0], lineGlyph(th + sg * 0.78));
        }
        if (r < 1.25 && h < 0.8) return enc(HALO, P.halo[0], pick(HG, h));
        return 0;
      },
    };
  }

  // Jellyfish: magenta dome leading, pale rim of 'o' tiles, dotted halo, long fading tentacles of brace glyphs.
  {
    const P = palette({
      mag: ['#2c0a28', '#3f1238', '#561d4c', '#6d2462', '#862c78', '#9e3a8d', '#b4579f'],
      pale: ['#bb9ab4', '#d7c0d4'], dots: ['#6f6070'], tent: ['#cfc6d0', '#9a8f9c', '#62596a'], streak: ['#2e2a36'], trail: ['#4a3a4a'],
    });
    const G = gs(':.:=:.!'), TG = gs('{}()§-~|{}()§'), PG = gs('|:!');
    SPECIES.jellyfish = {
      P, box: [-34, 13.5, -12.5, 12.5], space: 9, trailCol: P.trail[0],
      gait: (a) => 1.2 + 6 * (1 - a.gl) * Math.max(0, Math.sin(a.at * 2.6 + a.ph)) ** 2, // gliding: coasting between pulses
      prep(a) { const c = (1 - a.gl) * Math.max(0, Math.sin(a.at * 2.6 + a.ph)); a.p0 = 1.08 + 0.14 * c; a.p1 = 1 - 0.14 * c; },
      cell(a, at) {
        let x = at.x, y = at.y, tw = at.tw; const th = at.th;
        x *= 0.78; y *= 0.78; tw *= 0.78; // the design below is in 0.78-scaled units: the largest reference bells are ~16 units wide
        const ay = Math.abs(y), Rx = 5.4 * a.p0, Ry = 6.2 * a.p1, h = hr(x, y, a.seed);
        if (x > -0.9) {
          const r = Math.pow(Math.pow(Math.max(0, x) / Rx, 2.4) + Math.pow(ay / Ry, 2.4), 1 / 2.4) + (vn(x * 0.8, y * 0.8, a.seed) - 0.5) * 0.12;
          if (r <= 1) {
            if (x < 0.6) return h < 0.55 ? enc(TILE, P.pale[0], OH) : enc(TILE, ramp(P.mag, 0.5 + h * 0.3), pick(G, h));
            if (h < 0.13) return enc(TILE, P.pale[h < 0.04 ? 1 : 0], pick(PG, h * 8));
            const v = 0.3 + 0.35 * (x / Rx) + (r > 0.82 ? 0.3 : 0) + (H(Math.round(x), Math.round(y), a.seed + 1) - 0.5) * 0.35;
            return enc(TILE, ramp(P.mag, v), pick(G, H(Math.round(x), Math.round(y), a.seed + 2)));
          }
          if (r < 1.45 && h < 0.8) return enc(BARE, P.dots[0], PERIOD);
          if (x >= 0) return 0;
        }
        if (x > -24) {
          const k = -x / 24, taper = 1 - k * 0.35;
          for (let i = 0; i < 6; i++) {
            const ty = (i - 2.5) * 1.5 * taper + Math.sin(x * 0.42 + a.at * 2.2 + i * 1.3) * 0.8;
            if (Math.abs(y - ty) < tw * 1.15) {
              const hh = H(Math.round(x * 2), i, a.seed + Math.floor(a.at * 1.5));
              if (hh < k * 0.55 + 0.05) return 0;
              return enc(BARE, P.tent[k < 0.4 ? 0 : k < 0.7 ? 1 : 2], pick(TG, hh));
            }
          }
          if (ay > 4.4 * taper && ay < 6.6 && x < -1.5 && x > -15 && h < 0.3) return enc(BARE, P.streak[0], lineGlyph(th));
        }
        return 0;
      },
    };
  }

  // Dragonfly: green tile thorax with two eye tiles, wings of bare glyphs spread sideways, a long abdomen of
  // single spaced tiles trailing behind and fading, small red wing spots.
  {
    const P = palette({
      green: ['#123322', '#1d4430', '#2a5c42', '#3a7a58', '#4ea57f', '#6fcf9b', '#9aeec2'],
      grey: ['#56625c'], wing: ['#dde2e4', '#9aa2a6'], red: ['#c9445a'], trail: ['#2c4436'],
    });
    const TG = gs('8#=%:8'), WG = gs('.:+.:'), AG = gs('=:-');
    const WINGS = [[2.2, 12, 2.1], [-1.4, 11, 1.9]];
    SPECIES.dragonfly = {
      P, box: [-24, 8.5, -14, 14], space: 11, trailCol: P.trail[0],
      gait: (a) => 9 + Math.sin(a.at * 0.9 + a.ph) * 1.5,
      prep(a) { a.p0 = Math.floor(a.at * 14); a.p1 = Math.sin(a.at * 40 + a.ph) * 0.35 * (1 - a.gl); },
      eye: enc(EYE, 0, 0), eyes(a, E) { E[0] = 5.2; E[1] = 1; E[2] = 5.2; E[3] = -1; },
      cell(a, at) {
        let x = at.x, y = at.y, tw = at.tw; const th = at.th;
        const ay = Math.abs(y), h = hr(x, y, a.seed);
        if (x > -2.6 && x < 4.8 && ay < 1.9 - Math.max(0, x - 3) * 0.5) {
          return enc(TILE, ramp(P.green, 0.6 + (x > 1 ? 0.2 : 0) - ay * 0.15 + (h - 0.5) * 0.5), pick(TG, h * 3 % 1));
        }
        if (x <= -2.6 && x > -22 && ay < tw) {
          const k = (-2.6 - x) / 19.4;
          if (h < 0.1 + k * 0.25) return 0;
          return enc(TILE, h > 0.86 ? P.grey[0] : ramp(P.green, 0.72 - k * 0.6 + (h - 0.5) * 0.35), pick(AG, h * 7 % 1));
        }
        for (const [bx, span, hc] of WINGS) {
          const xc = bx - ay * 0.1 + a.p1 * (ay / span);
          if (ay > 1.8 && ay < span && Math.abs(x - xc) < hc * (1 - (ay / span) ** 4)) {
            if (bx > 0 && Math.abs(ay - span + 1.2) < tw && Math.abs(x - xc) < tw && (a.seed & 1)) return enc(TILE, P.red[0], 0);
            const q = H(Math.round(x), Math.round(y), a.seed + (H(Math.round(x), Math.round(y), 9) < 0.3 ? a.p0 : 0));
            if (q < 0.14) return 0;
            if (q < 0.62) return enc(BARE, P.wing[0], lineGlyph(th + Math.PI / 2));
            return enc(BARE, P.wing[q < 0.85 ? 0 : 1], pick(WG, q));
          }
        }
        return 0;
      },
    };
  }

  // Koi: an articulated spine (see spine code below) supplies x = distance from the snout, y = lateral offset.
  // Seen from above, as on the reference: blunt rounded head, torpedo body widest in the first third and full for most of
  // its length, a short slim stalk, a V-shaped tail fan of grey / \ tiles, pectoral fins sticking out sideways and two
  // white eye dots on the head. Varieties: kohaku (mostly white with red blotches), orange, gold, red.
  {
    const P = palette({
      white: ['#706f69', '#a09f98', '#c4c3b9', '#dedfd2', '#e8e8dc'],
      red: ['#5c130e', '#7e1f15', '#9e2c20', '#b93f31', '#d04c3c'],
      orange: ['#42200c', '#68361a', '#96511f', '#c06830', '#d87c34', '#f0903c'],
      gold: ['#3a2e12', '#5a4518', '#7e6020', '#a07c28', '#b89034', '#c9a042'],
      fin: ['#4a4a4c', '#5e5e60', '#767678'], eye: ['#f2f2f2'], dot: ['#77716c'], food: ['#cdb47a'], trail: ['#3a3634'],
    });
    // The shape is drawn at the size of the reference's nearest koi in a 760x1000 window (~30 long with the fan, ~7 wide) and scaled by K.
    // Measured on the reference: its nearest koi are ~21 long in 760x460 and 1440x870 and ~30 in 760x1000, so its animals do not scale with
    // the width alone; K matches the wide windows (ours scales with the width only, so in a tall window ours stay ~21).
    const K = 0.72, LB = 25, WM = 3.7, SW = 1.25; // body length to the tail root, body and stalk half-width
    const width = (s) => {
      const x = s * LB;
      if (x < 4.6) return WM * Math.sqrt(Math.max(0, 1 - (1 - (x + 0.2) / 4.8) ** 2)); // rounded head
      if (s < 0.66) return WM;
      return s > 0.8 ? SW : SW + (WM - SW) * 0.5 * (1 + Math.cos((Math.PI * (s - 0.66)) / 0.14));
    };
    const FG = gs('=-='), TG = gs('/\\/\\|'), DENSE = gs('%#*+=-:.'); // body glyphs follow tile brightness: denser on darker tiles, as on the reference
    const LUM = P.cols.map((c) => (0.3 * parseInt(c.slice(1, 3), 16) + 0.59 * parseInt(c.slice(3, 5), 16) + 0.11 * parseInt(c.slice(5), 16)) / 255);
    SPECIES.koi = {
      P, spine: true, len: LB * K, tail: 8.7 * K, pad: 7 * K, width: WM * K, reach: 28, space: 8, trailCol: P.trail[0], seg: 7,
      glyph: (c) => { // grey tiles get light glyphs, coloured and white ones darker shades (each channel pulled down, so reds stay saturated)
        const mx = Math.max(c[0], c[1], c[2]);
        return mx - Math.min(c[0], c[1], c[2]) < 30 && mx < 140 ? c.map((v) => Math.min(255, v + 100)) : c.map((v) => Math.max(0, v - 60));
      },
      pals: [3, 1.3, 0.5, 0.6], // kohaku, orange, gold, red: relative frequency (gold is rare on the reference)
      gait: (a) => (a.eating ? 6.5 : 3.6),
      eye: enc(BARE, P.eye[0], DOT), eyes(a, E) { E[0] = 2 * K; E[1] = 1.2 * K; E[2] = 2 * K; E[3] = -1.2 * K; },
      prep(a) { a.p0 = a.at * (a.eating ? 9 : 5.5) + a.ph; a.p1 = (a.eating ? 0.7 : 0.45) * (1 - 0.6 * a.gl); },
      cell(a, at) {
        let x = at.x / K, y = at.y / K; const tw = at.tw / K;
        const s = x / LB;
        y -= a.p1 * Math.max(0, s) ** 2 * Math.sin(a.p0 - x * 0.45); // tail sway
        const ay = Math.abs(y), w = width(s), h = hr(x, y, a.seed);
        if (s >= 0 && s <= 1 && ay <= w) {
          const lat = y / Math.max(w, 0.6);
          let v = 0.86 - (a.pal ? 0.5 : 0.3) * Math.max(0, lat) + 0.12 * Math.max(0, -lat) - 0.25 * Math.max(0, (s - 0.55) / 0.45) + (h - 0.5) * 0.16;
          if (ay > w - 0.7) v -= 0.08;
          const n = vn(x * 0.34 + a.seed * 0.37, y * 0.55 + a.seed * 0.11, a.seed);
          let r;
          if (a.pal === 0) r = n > 0.64 || (a.cap && x < 3.5) ? P.red : P.white;
          else if (a.pal === 1) { r = P.orange; if (n > 0.66) v -= 0.3; }
          else if (a.pal === 2) { r = P.gold; if (n > 0.68) v -= 0.25; }
          else r = n > 0.72 ? P.white : P.red;
          const c = ramp(r, v), f = 7.3 * LUM[c] * (1 - 0.1 * a.lvl) + 0.17 + (H(Math.round(x), Math.round(y), a.seed + 2) - 0.5) * 1.8; // a.lvl: farther tiles are drawn dimmer
          return enc(TILE, c, DENSE[Math.round(clamp(f, 0, 7))]);
        }
        const q = ay - w, t = x - 0.27 * LB;
        if (q > 0 && q < 2 && t > q * 0.8 - 0.4 && t < 1.8 + q * 0.8) return enc(TILE, ramp(P.fin, 0.3 + h * 0.6), pick(FG, h)); // pectoral fins
        const e = x - LB;
        if (e > 0 && e < 6 && Math.abs(ay - e) < 1.25 && e + ay < 7.9) return enc(TILE, ramp(P.fin, 0.3 + h * 0.6), pick(TG, h * 7 % 1)); // tail fan: two thick arms at 45 degrees from the root
        if (e >= 6 && e < 8.7 && ay < 2 && h > 0.8) return enc(BARE, P.dot[0], PERIOD);
        return 0;
      },
    };
  }

  // Frog: a squat green blob seen from above with eye tiles at the front corners, folded hind legs, glyph toes.
  // It hops: body stretches and the hind legs kick out behind during a leap.
  {
    const P = palette({
      green: ['#0f300a', '#1c4518', '#285a22', '#346b29', '#417d31', '#4e923b', '#5fa548'],
      olive: ['#5e7346', '#77905a', '#94ad74', '#b5d39b'], toe: ['#9aa59a'], trail: ['#26381f'],
    });
    const G = gs('*%#:.@=+:*'), TOE = gs('/|-.');
    SPECIES.frog = {
      P, box: [-15, 9, -8, 8], space: 7, trailCol: P.trail[0], mode0: 'rest',
      gait(a, dt, world) {
        a.timer -= dt;
        if (a.mode === 'rest') {
          if (a.timer <= 0 || a.flee > 0) { a.mode = 'leap'; a.timer = 0.5; }
          return 0;
        }
        if (a.timer <= 0) { a.mode = 'rest'; a.timer = (0.6 + a.rnd() * 1.8) * world.pause; return 0; }
        return 24 * (a.timer / 0.5) ** 1.5;
      },
      eye: enc(EYE, 0, 0), eyes(a, E) { const L = a.p0; E[0] = E[2] = 3.5 + L * 1.6; E[1] = 2.5 - L * 0.5; E[3] = -E[1]; },
      prep(a) { a.p0 = a.mode === 'leap' ? Math.sin(Math.PI * clamp(1 - a.timer / 0.5, 0, 1)) : 0; },
      cell(a, at) {
        let x = at.x, y = at.y, tw = at.tw;
        const L = a.p0, ay = Math.abs(y), h = hr(x, y, a.seed);
        const bx = x / (1 + 0.3 * L), by = y / (1 - 0.15 * L);
        const r = Math.hypot(bx / 4.9, by / (4.3 - Math.max(0, bx) * 0.28)) + (vn(x * 0.6 + 3, y * 0.6, a.seed) - 0.5) * 0.3;
        const tile = (v) => {
          const n = vn(x * 0.45, y * 0.45, a.seed + 5);
          return n > 0.6 ? enc(TILE, ramp(P.olive, v + (h - 0.5) * 0.4), pick(G, h)) : enc(TILE, ramp(P.green, v + (h - 0.5) * 0.45), pick(G, h));
        };
        if (r <= 1) return tile(0.6 + (ay < 2 && x < 1.5 ? 0.15 : 0) - (r > 0.8 ? 0.2 : 0));
        // hind legs: folded at the back sides while resting, kicked out behind in a leap
        const hx1 = -2.6 - L * 1.5, hy1 = 3.3 - L * 1.2, hx2 = -3.8 - L * 8, hy2 = 4.6 - L * 1.6;
        if (segDist(x, ay, hx1, hy1, hx2, hy2) < 1.05 - L * 0.35) return tile(0.35);
        const fx = L ? hx2 - 1 : -1.6, fy = L ? hy2 + 0.6 : 5.6;
        if (segDist(x, ay, hx2, hy2, fx, fy) < tw * 1.2) return tile(0.3);
        if (segDist(x, ay, 2.4 + L * 1.5, 3.2 - L, 3.1 + L * 2.5, 4.4 - L) < 0.7) return tile(0.3); // front legs
        if (h < 0.55 && (Math.hypot(x - (3.9 + L * 2.5), ay - (5.1 - L)) < 1.1 || Math.hypot(x - fx + 0.4, ay - fy - 0.6) < 1.1)) {
          return enc(BARE, P.toe[0], pick(TOE, h * 1.8));
        }
        return 0;
      },
    };
  }

  // Crane: white mosaic seen from above in flight - long swept wings across the body (an X at 45 degrees),
  // darker trailing edges and tips, thin neck of small grey cells to a red crown with white eye dots, glyph beak and legs.
  {
    const P = palette({
      white: ['#323238', '#4a4a51', '#616168', '#8a8991', '#b0b0b7', '#cdcdd4', '#e1e1e8', '#f3f3f7'],
      crown: ['#d8285a'], eye: ['#f4f4f4'], beak: ['#9a9aa3'], leg: ['#5c5c64'], trail: ['#34343a'],
    });
    const G = gs(':-:=.:+:');
    SPECIES.crane = {
      P, box: [-17, 15, -16.5, 16.5], space: 13, trailCol: P.trail[0],
      gait: () => 10,
      eye: enc(BARE, P.eye[0], DOT), eyes(a, E) { E[0] = 10.6; E[1] = 1; E[2] = 10.6; E[3] = -1; },
      prep(a) { const b = (1 - a.gl) * Math.sin(a.at * 3.2 + a.ph); a.p0 = 0.86 + 0.14 * b + 0.12 * a.gl; a.p1 = 0.5 * b; },
      cell(a, at) {
        let x = at.x, y = at.y, tw = at.tw; const th = at.th;
        const ay = Math.abs(y), h = hr(x, y, a.seed);
        if (Math.abs(x - 11.2) < tw && ay < tw) return enc(TILE, P.crown[0], 0);
        if (x > 11.7 && x < 14.6 && ay < tw && h > 0.25) return enc(BARE, P.beak[0], lineGlyph(th));
        if (x > 5 && x < 10.8 && ay < tw) return enc(TILE, ramp(P.white, 0.3 + h * 0.3), pick(G, h));
        const span = 15 * a.p0, xc = 0.4 - ay * 0.2 + (a.p1 * ay) / 12, hc = 2.6 - (ay / span) * 1.3;
        if (ay < span && Math.abs(x - xc) < hc * (ay > span - 1.5 ? 0.8 : 1)) {
          let v = 0.9 + (h - 0.5) * 0.2;
          if (x - xc < -hc + 1.1) v = 0.4 + h * 0.15; // darker trailing edge
          if (ay > span - 3) v -= 0.4;
          return enc(TILE, ramp(P.white, v), pick(G, H(Math.round(x), Math.round(y), a.seed + 1)));
        }
        const hw = x > 0 ? 1.8 - x * 0.24 : 2.1 - (-x / 9.5) * 0.7;
        if (x > -9.5 && x < 5 && ay < hw) return enc(TILE, ramp(P.white, 0.82 - (x < -5.5 || ay > hw - 0.8 ? 0.3 : 0) + (h - 0.5) * 0.25), pick(G, h));
        if (x < -9.5 && x > -16 && Math.abs(ay - 0.6) < tw && h < 0.85 + (x + 9.5) * 0.08) return enc(BARE, P.leg[0], lineGlyph(th));
        return 0;
      },
    };
  }

  // Crab: rounded red shell lighter in the middle, front (with white eyes and hooked claws) facing the left of its
  // travel so it scuttles sideways up-right; dim glyph legs.
  {
    const P = palette({
      red: ['#4a0f0a', '#671d14', '#813128', '#9c4138', '#b04f46', '#c8604f', '#d8806a', '#e8a084'],
      eye: ['#f4f4f4'], leg: ['#7a4440'], trail: ['#3a2422'],
    });
    const G = gs('%#=:+.%=');
    SPECIES.crab = {
      P, box: [-9, 9, -8.5, 6.5], space: 6.5, trailCol: P.trail[0], mode0: 'go',
      gait(a, dt, world) {
        a.timer -= dt;
        if (a.timer <= 0) { a.mode = a.mode === 'go' ? 'stop' : 'go'; a.timer = a.mode === 'go' ? 0.5 + a.rnd() * 0.9 : (0.25 + a.rnd() * 0.6) * world.pause; }
        a.v0 = (a.v0 || 0) + (((a.mode === 'go' || a.flee > 0) ? 7.5 : 0) - (a.v0 || 0)) * Math.min(1, dt * 10);
        return a.v0;
      },
      prep(a) { a.p0 = a.mode === 'go' ? Math.sin(a.at * 22) : 0; },
      eye: enc(BARE, P.eye[0], DOT), eyes(a, E) { E[0] = 1.1; E[1] = -3.7; E[2] = -1.1; E[3] = -3.7; },
      cell(a, at) {
        let x = at.x, y = at.y, tw = at.tw; const th = at.th;
        const ax = Math.abs(x), h = hr(x, y, a.seed), sg = x < 0 ? -1 : 1;
        const r = Math.pow(Math.pow(ax / 4, 2.3) + Math.pow(Math.abs(y - 0.4) / 3.4, 2.3), 1 / 2.3) + (vn(x * 0.7, y * 0.7, a.seed) - 0.5) * 0.18;
        if (r <= 1) return enc(TILE, ramp(P.red, 1.02 - r * 0.62 + (h - 0.5) * 0.3), pick(G, h));
        if (segDist(ax, y, 2.4, -2.4, 3.3, -4.4) < 0.62) return enc(TILE, ramp(P.red, 0.45 + h * 0.2), pick(G, h));
        const cx = ax - 3.7, cy = y + 5.6, cr = Math.hypot(cx, cy), ang = Math.atan2(cy, -cx);
        if (Math.abs(cr - 1.2) < 0.62 && !(ang > -0.2 && ang < 1.3)) return enc(TILE, ramp(P.red, 0.55 + h * 0.25), pick(G, h));
        for (let i = 0; i < 4; i++) { // legs reach out sideways (along the travel), so they read as '/' on screen
          const y1 = -1 + i * 1.2, w = a.p0 * (i & 1 ? 0.4 : -0.4);
          if (segDist(ax, y, 3.8, y1, 6.6, y1 + 0.5 + w) < tw && h < 0.85) return enc(BARE, P.leg[0], lineGlyph(th + sg * Math.atan2(0.5 + w, 2.8)));
        }
        return 0;
      },
    };
  }

  for (const id of ANIMALS) {
    const sp = SPECIES[id];
    if (!sp.spine) { const [x0, x1, y0, y1] = sp.box; sp.reach = Math.max(Math.hypot(x0, y0), Math.hypot(x0, y1), Math.hypot(x1, y0), Math.hypot(x1, y1)); }
  }

  // ---------- rasteriser ----------
  // Writes the screen-grid cells (gx, gy, code) of one animal into BUF and returns how many. Pure: node can call it.
  const BUF = { n: 0, x: new Int32Array(2048), y: new Int32Array(2048), c: new Int32Array(2048) };
  function push(gx, gy, code) {
    if (BUF.n === BUF.x.length) {
      for (const k of ['x', 'y', 'c']) { const b = new Int32Array(BUF.n * 2); b.set(BUF[k]); BUF[k] = b; }
    }
    BUF.x[BUF.n] = gx; BUF.y[BUF.n] = gy; BUF.c[BUF.n++] = code;
  }

  // Koi spine: a follow-the-leader chain from the snout (point 0) back; each frame the points are pulled behind
  // the head at a fixed segment length, so turning bends the body like a real fish.
  function initSpine(a, sp, u, world) {
    const n = sp.seg + 1, seg = (sp.len * u * world.levels[a.lvl].s) / sp.seg;
    a.spine = new Float64Array(n * 2); a.spineU = u;
    let x = a.x, y = a.y;
    for (let j = 0; j < n; j++) { a.spine[2 * j] = x; a.spine[2 * j + 1] = y; x -= Math.cos(a.dir) * seg; y -= Math.sin(a.dir) * seg; }
  }
  function followSpine(a, sp, u, world) {
    if (!a.spine || a.spineU !== u) { initSpine(a, sp, u, world); return; }
    const p = a.spine, n = p.length / 2, seg = (sp.len * u * world.levels[a.lvl].s) / sp.seg;
    p[0] = a.x; p[1] = a.y;
    for (let j = 1; j < n; j++) {
      const dx = p[2 * j] - p[2 * j - 2], dy = p[2 * j + 1] - p[2 * j - 1], d = Math.hypot(dx, dy) || 1;
      p[2 * j] = p[2 * j - 2] + (dx / d) * seg; p[2 * j + 1] = p[2 * j - 1] + (dy / d) * seg;
    }
  }

  // Eyes are placed after the body, one screen cell each (a local box test flickers between 0, 1 and 2 cells as the animal moves).
  // (c, s) = rotation of local axes on screen, m = screen px per local unit, o = screen position of the local origin.
  const EYES = new Float64Array(4);
  function putEyes(sp, a, ox, oy, c, s, m, cw, ch) {
    if (!sp.eyes) return;
    sp.eyes(a, EYES);
    let x0 = 0, y0 = 0, g0x = 0, g0y = 0;
    for (let i = 0; i < 2; i++) {
      const lx = EYES[2 * i], ly = EYES[2 * i + 1], sx = (lx * c - ly * s) * m, sy = (lx * s + ly * c) * m;
      let gx = Math.floor((ox + sx) / cw), gy = Math.floor((oy + sy) / ch);
      if (i && gx === g0x && gy === g0y) { // second eye on the first one's cell: step one cell away from it
        if (Math.abs(sx - x0) >= Math.abs(sy - y0)) gx += sx < x0 ? -1 : 1; else gy += sy < y0 ? -1 : 1;
      }
      x0 = sx; y0 = sy; g0x = gx; g0y = gy;
      let j = BUF.n - 1;
      while (j >= 0 && (BUF.x[j] !== gx || BUF.y[j] !== gy)) j--;
      if (j >= 0) BUF.c[j] = sp.eye; else push(gx, gy, sp.eye);
    }
  }

  function raster(world, a) {
    BUF.n = 0;
    const sp = SPECIES[world.animal], u = world.u, cw = world.cw, ch = world.ch, sc = world.levels[a.lvl].s;
    const tw = (0.5 * Math.sqrt(cw * ch)) / (u * sc); // half a screen cell, in local units
    Q.tw = tw; Q.th = a.dir;
    if (sp.prep) sp.prep(a);
    if (sp.spine) {
      if (!a.spine || a.spineU !== u) initSpine(a, sp, u, world);
      const p = a.spine, n = p.length / 2, seg = (sp.len * u * sc) / sp.seg, k = 1 / (u * sc), R = sp.pad * u * sc; // widest reach from the spine: fins
      const U = SEGS.u, TH = SEGS.th;
      for (let j = 0; j < n - 1; j++) {
        U[2 * j] = (p[2 * j + 2] - p[2 * j]) / seg; U[2 * j + 1] = (p[2 * j + 3] - p[2 * j + 1]) / seg;
        TH[j] = Math.atan2(-U[2 * j + 1], -U[2 * j]);
      }
      // the tail fan and its dots run past the last spine point
      const ex = p[2 * n - 2] + U[2 * n - 4] * sp.tail * u * sc, ey = p[2 * n - 1] + U[2 * n - 3] * sp.tail * u * sc;
      let y0 = Math.min(ey, p[1]), y1 = Math.max(ey, p[1]);
      for (let j = 0; j < n; j++) { y0 = Math.min(y0, p[2 * j + 1]); y1 = Math.max(y1, p[2 * j + 1]); }
      for (let gy = Math.floor((y0 - R) / ch); gy <= Math.floor((y1 + R) / ch); gy++) {
        const py = (gy + 0.5) * ch;
        let lo = 1e9, hi = -1e9; // this row's x-span: union of the segments' boxes grown by R
        for (let j = 0; j < n; j++) {
          const ax = p[2 * j], ay = p[2 * j + 1], bx = j < n - 1 ? p[2 * j + 2] : ex, by = j < n - 1 ? p[2 * j + 3] : ey;
          if (py < Math.min(ay, by) - R || py > Math.max(ay, by) + R) continue;
          lo = Math.min(lo, ax - R, bx - R); hi = Math.max(hi, ax + R, bx + R);
        }
        for (let gx = Math.floor(lo / cw); gx <= Math.floor(hi / cw); gx++) {
          const px = (gx + 0.5) * cw;
          let best = 1e18, along = 0, lat = 0, bj = 0;
          for (let j = 0; j < n - 1; j++) {
            const ux = U[2 * j], uy = U[2 * j + 1], dx = px - p[2 * j], dy = py - p[2 * j + 1];
            const t = clamp(dx * ux + dy * uy, j === 0 ? -seg : 0, j === n - 2 ? 1e9 : seg);
            const qx = dx - ux * t, qy = dy - uy * t, d2 = qx * qx + qy * qy;
            if (d2 < best) { best = d2; along = j * seg + t; lat = ux * dy - uy * dx; bj = j; }
          }
          lat = (lat < 0 ? -1 : 1) * Math.sqrt(best); // true distance to the segment, not its infinite line (bends)
          Q.x = along * k; Q.y = lat * k; Q.th = TH[bj];
          const code = sp.cell(a, Q);
          if (code) push(gx, gy, code);
        }
      }
      putEyes(sp, a, p[0], p[1], U[0], U[1], u * sc, cw, ch);
      return BUF.n;
    }
    // offsets in local units: px, py = (screen offset in CSS px) / (u * sc)
    const co = Math.cos(a.dir), si = Math.sin(a.dir), box = sp.box, bx0 = box[0], bx1 = box[1], by0 = box[2], by1 = box[3], k = 1 / (u * sc);
    const pyMin = Math.min(bx0 * si, bx1 * si) + Math.min(by0 * co, by1 * co), pyMax = Math.max(bx0 * si, bx1 * si) + Math.max(by0 * co, by1 * co);
    for (let gy = Math.floor((a.y + pyMin / k) / ch - 0.5); gy <= Math.ceil((a.y + pyMax / k) / ch); gy++) {
      const py = ((gy + 0.5) * ch - a.y) * k;
      SPAN[0] = -1e9; SPAN[1] = 1e9;
      span(co, py * si, bx0, bx1); // local x = px*co + py*si
      span(-si, py * co, by0, by1); // local y = -px*si + py*co
      const lo = SPAN[0], hi = SPAN[1];
      if (lo > hi) continue;
      for (let gx = Math.ceil((a.x + lo / k) / cw - 0.5); gx <= Math.floor((a.x + hi / k) / cw - 0.5); gx++) {
        const px = ((gx + 0.5) * cw - a.x) * k;
        Q.x = px * co + py * si; Q.y = -px * si + py * co;
        const code = sp.cell(a, Q);
        if (code) push(gx, gy, code);
      }
    }
    putEyes(sp, a, a.x, a.y, co, si, u * sc, cw, ch);
    return BUF.n;
  }
  raster.buf = BUF; // the cells of the last raster() call

  // Occlusion, as on a character grid: nearer animals claim their cells, and their tiles also claim a one-cell
  // moat around them; farther animals draw nothing on claimed cells, so an overlap stays a clean front silhouette
  // with a thin band of background around it. Calls emit(animal, gx, gy, code) for every visible on-screen cell.
  const OCC = { a: new Uint32Array(0), cols: 0, rows: 0, stamp: 0 };
  function compose(world, emit) {
    const cols = Math.ceil(world.w / world.cw) + 1, rows = Math.ceil(world.h / world.ch) + 1, all = world.animals;
    if (cols !== OCC.cols || rows !== OCC.rows || OCC.stamp > 1e9) {
      if (OCC.a.length < cols * rows) OCC.a = new Uint32Array(cols * rows);
      OCC.a.fill(0); OCC.cols = cols; OCC.rows = rows; OCC.stamp = 0;
    }
    const occ = OCC.a, st = ++OCC.stamp;
    for (let i = all.length - 1; i >= 0; i--) { // the list is far-first, so walk it near-first
      const a = all[i], n = raster(world, a);
      let m = 0;
      for (let c = 0; c < n; c++) {
        const gx = BUF.x[c], gy = BUF.y[c], code = BUF.c[c];
        if (gx < 0 || gy < 0 || gx >= cols || gy >= rows || occ[gy * cols + gx] === st) continue;
        BUF.x[m] = gx; BUF.y[m] = gy; BUF.c[m++] = code; // keep the visible cells to claim them below
        emit(a, gx, gy, code);
      }
      for (let c = 0; c < m; c++) {
        const gx = BUF.x[c], gy = BUF.y[c], kind = BUF.c[c] >> 16;
        if (kind !== TILE && kind !== EYE) { occ[gy * cols + gx] = st; continue; }
        for (let y = Math.max(0, gy - 1); y <= Math.min(rows - 1, gy + 1); y++) {
          for (let x = Math.max(0, gx - 1); x <= Math.min(cols - 1, gx + 1); x++) occ[y * cols + x] = st;
        }
      }
    }
  }
  // Scratch reused on every call: doubles passed to a non-inlined cell() would be boxed, ~10 MB/frame at 4K.
  const Q = { x: 0.5, y: 0.5, tw: 0.5, th: 0.5 }, SPAN = new Float64Array(2);
  // solve px*q + b in [l, h] for px, narrowing SPAN = [lo, hi]: the raster box's span on one row
  function span(q, b, l, h) {
    if (Math.abs(q) < 1e-9) { if (b < l || b > h) { SPAN[0] = 1; SPAN[1] = 0; } return; }
    const p1 = (l - b) / q, p2 = (h - b) / q;
    SPAN[0] = Math.max(SPAN[0], Math.min(p1, p2)); SPAN[1] = Math.min(SPAN[1], Math.max(p1, p2));
  }
  const SEGS = { u: new Float64Array(64), th: new Float64Array(32) }; // per-call spine scratch (no per-frame allocation)

  // ---------- simulation ----------
  // Animals on screen: the reference count, scaled by Density, and by 1/Size² above the default Size (bigger bodies cover
  // more cells, so fewer of them; it also keeps the paint cost bounded). The window size does not matter: the scene scales.
  function countFor(s, animal) {
    const big = Math.min(1, (DEFAULTS.size / s.size) ** 2);
    return clamp(Math.round(LIVE[animal].n * (s.density / DEFAULTS.density) * big), 1, MAX_ANIMALS);
  }
  function weighted(ws, q) {
    let t = q * ws.reduce((n, w) => n + w, 0), i = 0;
    while (i < ws.length - 1 && t >= ws[i]) t -= ws[i++];
    return i;
  }

  function spawn(world) {
    const sp = SPECIES[world.animal], r = world.rng;
    const a = {
      x: r() * world.w, y: r() * world.h, dir: world.heading + (r() - 0.5) * 0.2, ang: 0, sp: 0, kx: 0, ky: 0, boost: 1,
      bias: r() - 0.5, t: r() * 10, at: r() * 10, gl: 0, gt: r() * 2, gliding: false, ph: r() * TAU, timer: r() * 1.5,
      mode: sp.mode0 || '', flee: 0, fleeDir: 0, seed: Math.floor(r() * 1e6), lvl: weighted(world.levels.map((l) => l.w), r()),
      pal: sp.pals ? weighted(sp.pals, r()) : 0, cap: r() < 0.3, eating: false, rnd: r, trail: [], spine: null, spineU: 0, sx: 0, sv: 0,
    };
    a.ang = a.dir;
    return a;
  }

  // ---------- spacing ----------
  // The reference swarms are spread evenly with empty space between individuals; overlaps are rare and brief.
  const radius = (world, a) => SPECIES[world.animal].space * world.levels[a.lvl].s * world.u;
  // Free room around point (x, y) for animal a: the smallest gap to any other animal's spacing circle.
  function room(world, a, x, y) {
    let best = 1e9;
    const ra = radius(world, a);
    for (const b of world.animals) {
      if (b === a) continue;
      best = Math.min(best, Math.hypot(b.x - x, b.y - y) - ra - radius(world, b));
    }
    return best;
  }
  // Best of k candidates (Mitchell's blue noise): the roomiest spot; pts(i) proposes the i-th candidate.
  function roomiest(world, a, k, pts) {
    let bx = a.x, by = a.y, br = -1e9;
    for (let i = 0; i < k; i++) {
      const p = pts(i), r = room(world, a, p[0], p[1]);
      if (r > br) { br = r; bx = p[0]; by = p[1]; }
    }
    a.x = bx; a.y = by;
  }
  // Neighbours drift apart sideways (across the common heading) and same-depth ones adjust their speed a little,
  // so nobody leaves the parallel heading. Writes a.sx (sideways push, units/s) and a.sv (speed factor offset).
  // Separation scales both the reach and the strength (1 = the default 700).
  function separate(world, FX, FY) {
    const all = world.animals, n = all.length, f = world.sep, reach = 1.25 * Math.sqrt(f);
    for (const a of all) { a.sx = 0; a.sv = 0; }
    if (f <= 0) return;
    for (let i = 0; i < n; i++) {
      const a = all[i], ra = radius(world, a);
      for (let j = i + 1; j < n; j++) {
        const b = all[j], dx = b.x - a.x, dy = b.y - a.y, R = (ra + radius(world, b)) * reach;
        if (dx > R || dx < -R || dy > R || dy < -R) continue;
        const d = Math.hypot(dx, dy);
        if (d >= R) continue;
        const o = 1 - d / R, same = a.lvl === b.lvl, lat = dy * FX - dx * FY, sg = lat > 0 || (lat === 0 && i & 1) ? 1 : -1;
        const push = o * (same ? 3 : 1.5) * Math.min(f, 2);
        a.sx -= sg * push; b.sx += sg * push;
        if (same) { const ahead = dx * FX + dy * FY > 0 ? 1 : -1; a.sv -= ahead * o * 0.25; b.sv += ahead * o * 0.25; }
      }
    }
  }
  // A point just inside the trailing edges of the play area (the edges the heading points away from), picked with
  // probability proportional to how much of the swarm enters through each.
  function entry(world, m, FX, FY) {
    const r = world.rng, W = world.w + 2 * m, Hh = world.h + 2 * m, wx = Math.abs(FX) * Hh, wy = Math.abs(FY) * W, t = r() * (wx + wy);
    if (t < wx) return [FX > 0 ? 1 - m : world.w + m - 1, r() * Hh - m];
    return [r() * W - m, FY > 0 ? 1 - m : world.h + m - 1];
  }

  // Applies settings (and the screen size) to a world: derived tweak values live on the world.
  function configure(world, s, animal) {
    if (animal !== world.animal) {
      world.animal = animal; world.animals.length = 0; world.pellets.length = 0;
    }
    const e = (k) => eff(s, animal, k), detail = e('detail');
    world.s = s;
    world.speed = s.speed / DEFAULTS.speed;
    // the scene scales with the window width (the floor covers a 0-sized first layout)
    const fit = Math.max(world.w, MIN_W) / REF_W;
    world.u = (UNIT * fit * s.size) / DEFAULTS.size; // body unit, CSS px
    world.cw = (Math.max(world.w, MIN_W) / COLS) * (DEFAULTS.detail / detail); world.ch = world.cw * CELL_ASPECT; // cell, CSS px (start() snaps to device px)
    world.heading = s.corner ? Math.atan2(-world.h, world.w) : (-s.direction * Math.PI) / 180; // screen angle, y down
    world.levels = levelsFor(s, animal);
    const ws = world.levels.map((l) => l.w), wsig = ws.join();
    if (wsig !== world.wsig) { world.wsig = wsig; for (const a of world.animals) a.lvl = weighted(ws, world.rng()); } // Far bias applies live
    world.sway = e('sway'); world.spread = e('spread'); world.flutter = s.flutter; world.hold = e('hold'); world.sep = e('separation') / DEFAULTS.separation;
    world.glide = e('glide'); world.pause = s.glide / DEFAULTS.glide; world.flap = s.flapRate;
    world.trail = Math.round(e('trail') * 4); world.trailFade = e('trailFade'); world.shimmer = e('shimmer'); world.sparkle = e('sparkle');
    for (const a of world.animals) a.spine = null; // body length follows size and depth
    const n = countFor(s, animal);
    while (world.animals.length < n) {
      const a = spawn(world), r = world.rng;
      roomiest(world, a, world.sep > 0 ? 14 : 1, () => [r() * world.w, r() * world.h]); // even spread from the first frame
      world.animals.push(a);
    }
    world.animals.sort((p, q) => q.lvl - p.lvl); // far (small) first, so near animals are drawn over them
    const all = world.animals, len = all.length; // fewer animals: thin evenly across the sorted list so every depth keeps some
    if (len > n) world.animals = Array.from({ length: n }, (_, i) => all[Math.floor(((i + 0.5) * len) / n)]);
  }

  function createWorld(s, animal, w, h, rng) {
    const world = { animal: null, w, h, t: 0, dt: 0, rng: rng || Math.random, animals: [], pellets: [], ripples: [] };
    configure(world, s, animal);
    return world;
  }

  const marginOf = (world, a) => (SPECIES[world.animal].reach * world.levels[a.lvl].s + 2) * world.u;

  function step(world, dtSec) {
    const dt = (dtSec > 0 ? Math.min(dtSec, 0.05) : 0) * world.speed; // clamp: a long hidden tab must not teleport animals
    world.dt = dt; world.t += dt;
    const sp = SPECIES[world.animal], u = world.u, k = Math.exp(-2.5 * dt), hd = world.heading, FX = Math.cos(hd), FY = Math.sin(hd);
    if (dt > 0) separate(world, FX, FY);
    for (const a of world.animals) {
      a.t += dt; a.at += dt * world.flap;
      if (world.glide > 0 || a.gliding) { // Glide: spells of held wings / relaxed strokes between bouts of flapping
        a.gt -= dt;
        if (a.gt <= 0) { a.gliding = !a.gliding && world.glide > 0; a.gt = a.gliding ? (0.3 + a.rnd() * 0.5) * world.glide : (0.8 + a.rnd() * 1.2) / world.flap; }
      }
      a.gl += ((a.gliding ? 1 : 0) - a.gl) * Math.min(1, dt * 5);
      // one shared heading (Spread fans individuals out, Sway weaves, Flutter jitters); Hold course is how fast they
      // return to it; a click turns animals away for a moment, koi turn to food
      let target = hd + a.bias * 2 * world.spread + Math.sin(a.t * 0.6 + a.ph) * 0.05 + Math.sin(a.t * 1.3 + 2 * a.ph) * world.sway;
      if (world.flutter) target += (vn(a.t * 2.5, a.seed % 997, 5) - 0.5) * world.flutter * 1.6;
      let rate = 0.3 * world.hold;
      if (a.flee > 0) { a.flee -= dt; target = a.fleeDir; rate = 7; }
      a.eating = false;
      if (sp.spine && world.pellets.length) {
        const sc = world.levels[a.lvl].s;
        let best = null, bd = (u * 28) ** 2;
        for (const p of world.pellets) { const d2 = (p.x - a.x) ** 2 + (p.y - a.y) ** 2; if (d2 < bd) { bd = d2; best = p; } }
        if (best) {
          a.eating = true; target = Math.atan2(best.y - a.y, best.x - a.x); rate = 2.6;
          if (bd < (u * Math.max(1.2, 1.6 * sc)) ** 2) best.life = 0;
        }
      }
      a.dir += wrapPi(target - a.dir) * Math.min(1, dt * rate);
      a.dir = wrapPi(a.dir);
      a.ang = a.dir;
      a.sp = sp.gait(a, dt * world.flap, world);
      a.boost = 1 + (a.boost - 1) * Math.exp(-1.5 * dt);
      const calm = a.flee <= 0 && !a.eating; // spacing: off while scattering or feeding
      const v = a.sp * a.boost * world.levels[a.lvl].k * u * (calm ? 1 + clamp(a.sv, -0.3, 0.3) : 1);
      const sx = calm ? clamp(a.sx * u, -MAX_LATERAL * v, MAX_LATERAL * v) : 0; // the sideways push turns the travel direction by at most ~10 degrees
      a.x += (Math.cos(a.dir) * v + a.kx - FY * sx) * dt; a.y += (Math.sin(a.dir) * v + a.ky + FX * sx) * dt;
      a.kx *= k; a.ky *= k;
      const m = marginOf(world, a);
      if (a.x < -m || a.x > world.w + m || a.y < -m || a.y > world.h + m) {
        const ox = a.x, oy = a.y;
        if ((a.x - world.w / 2) * FX + (a.y - world.h / 2) * FY > 0) roomiest(world, a, 8, () => entry(world, m, FX, FY)); // left ahead: re-enter behind, where it is roomy
        else { a.x = mod(a.x + m, world.w + 2 * m) - m; a.y = mod(a.y + m, world.h + 2 * m) - m; } // pushed out backwards (a scatter): plain wrap
        a.trail.length = 0;
        if (a.spine) for (let j = 0; j < a.spine.length; j += 2) { a.spine[j] += a.x - ox; a.spine[j + 1] += a.y - oy; }
      }
      if (sp.spine) followSpine(a, sp, u, world);
      const tr = a.trail, l = tr[tr.length - 1];
      if (!world.trail) tr.length = 0;
      else if (!l || Math.hypot(a.x - l.x, a.y - l.y) >= u * 1.5) { tr.push({ x: a.x, y: a.y, t: world.t }); while (tr.length > world.trail) tr.shift(); }
    }
    for (const p of world.pellets) { p.life -= dt; p.y += u * 0.2 * dt; }
    world.pellets = world.pellets.filter((p) => p.life > 0);
    for (const r of world.ripples) r.age += dt;
    world.ripples = world.ripples.filter((r) => r.age < 1.4);
  }

  // Click: a dotted ripple; koi get a cluster of food, everything else turns and flees, then rejoins the heading.
  function poke(world, x, y) {
    const u = world.u, r = world.rng;
    world.ripples.push({ x, y, age: 0 });
    if (SPECIES[world.animal].spine) { // koi: food
      for (let i = 0; i < 14 && world.pellets.length < 120; i++) {
        const ang = r() * TAU, d = Math.sqrt(r()) * 4.5 * u;
        world.pellets.push({ x: x + Math.cos(ang) * d, y: y + Math.sin(ang) * d, life: 7 + r() * 3 });
      }
      return;
    }
    const R = u * 20;
    for (const a of world.animals) {
      const dx = a.x - x, dy = a.y - y, d = Math.hypot(dx, dy);
      if (d >= R) continue;
      const f = 1 - d / R;
      a.fleeDir = Math.atan2(dy, dx); a.flee = 0.35 + 0.5 * f; a.boost = 1 + 2.2 * f;
      a.kx += (dx / (d || 1)) * f * u * 12; a.ky += (dy / (d || 1)) * f * u * 12;
    }
  }

  // ---------- rendering (browser only) ----------
  function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const BGC = hex(BG);
  const mix = (c, d, t) => c.map((v, i) => Math.round(v + (d[i] - v) * t));
  const css = (c) => 'rgb(' + c.join(',') + ')';

  // Hue shift: the CSS hue-rotate() matrix.
  function hueRotate(c, deg) {
    if (!deg) return c;
    const r = (deg * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r);
    const m = [0.213 + co * 0.787 - si * 0.213, 0.715 - co * 0.715 - si * 0.715, 0.072 - co * 0.072 + si * 0.928,
      0.213 - co * 0.213 + si * 0.143, 0.715 + co * 0.285 + si * 0.14, 0.072 - co * 0.072 - si * 0.283,
      0.213 - co * 0.213 - si * 0.787, 0.715 - co * 0.715 + si * 0.715, 0.072 + co * 0.928 + si * 0.072];
    return [0, 1, 2].map((i) => clamp(Math.round(m[3 * i] * c[0] + m[3 * i + 1] * c[1] + m[3 * i + 2] * c[2]), 0, 255));
  }
  // The tile colour of a cell: Hue shift, depth fade (halo and eye tiles differ), then the lit variants: 0 plain,
  // 1 shimmer-lit, 2 sparkle.
  function cellColor(sp, code, dim, hue, variant) {
    const kind = code >> 16;
    const col = mix(kind === EYE ? [238, 238, 238] : hueRotate(hex(sp.P.cols[(code >> 8) & 255]), hue), BGC, kind === HALO ? 0.55 + dim * 0.4 : dim);
    return variant ? mix(col, [255, 255, 255], variant === 1 ? 0.3 : 0.8) : col;
  }
  // Shimmer: a slow band of lighter tiles drifting across the swarm; Sparkle: single tiles flashing near-white.
  // The look of a cell right now: 0 plain, 1 shimmer-lit, 2 sparkle (tiles only).
  function variantOf(world, a, gx, gy, code) {
    if (code >> 16 !== TILE) return 0;
    if (world.sparkle && H(gx, gy, Math.floor(world.t * 6) + a.seed) < world.sparkle * 0.06) return 2;
    return world.shimmer && vn(gx * 0.3 - world.t * 1.5, gy * 0.3, 11) > 1 - world.shimmer * 0.4 ? 1 : 0;
  }
  // Pre-rendered cells (tile + glyph per colour, depth, glyph and variant: 0 plain, 1 shimmer-lit, 2 sparkle) in
  // fixed-size pages, filled on first use. Bounded: when every slot is used it starts over. Rebuilt when the species,
  // cell size, DPR, hue or depth fade changes.
  function makeAtlas(sp, gw, gh, levels, hue) {
    const PER = 32, MAX = PER * PER * 4, pages = [], map = new Map(); // pages are created on demand, at most 4
    let n = 0;
    const font = (k) => k * gw + 'px Menlo, Consolas, "DejaVu Sans Mono", "Courier New", monospace';
    function paint(i, code, lvl, variant) {
      const pi = Math.floor(i / (PER * PER)), slot = i % (PER * PER);
      if (!pages[pi]) { const c = document.createElement('canvas'); c.width = PER * gw; c.height = PER * gh; pages[pi] = c; }
      const x = pages[pi].getContext('2d'), sx = (slot % PER) * gw, sy = Math.floor(slot / PER) * gh;
      const kind = code >> 16, g = code & 255, dim = levels[lvl].dim;
      x.clearRect(sx, sy, gw, gh);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      const col = cellColor(sp, code, dim, hue, variant);
      const gap = Math.max(1, Math.round(gw * 0.13)), tw = gw - gap, th = gh - gap, mx = sx + gw / 2, my = sy + gh / 2;
      const glyph = (color, k) => {
        x.fillStyle = css(color);
        if (GL[g] === '•') { x.beginPath(); x.arc(mx, my, gw * (k > 1 ? 0.3 : 0.16), 0, TAU); x.fill(); return; }
        x.font = font(k); x.fillText(GL[g], mx, my + gh * 0.03);
      };
      if (kind === BARE) { glyph(col, 1.05); return; }
      x.fillStyle = css(col);
      x.beginPath();
      if (x.roundRect) x.roundRect(sx + gap / 2, sy + gap / 2, tw, th, tw * 0.18); else x.rect(sx + gap / 2, sy + gap / 2, tw, th);
      x.fill();
      if (kind === EYE) { x.fillStyle = css(mix([12, 12, 14], BGC, dim)); x.beginPath(); x.ellipse(mx, my, tw * 0.3, th * 0.26, 0, 0, TAU); x.fill(); return; }
      if (!g) return;
      const lum = (0.3 * col[0] + 0.59 * col[1] + 0.11 * col[2]) / 255;
      glyph(sp.glyph ? sp.glyph(col) : lum > 0.4 ? mix(col, [0, 0, 0], 0.6) : mix(col, [255, 255, 255], 0.42), 0.85);
    }
    return {
      pages,
      get(code, lvl, variant) { // returns the slot index
        const key = (code * 8 + lvl) * 3 + variant;
        let i = map.get(key);
        if (i === undefined) {
          if (n >= MAX) { map.clear(); n = 0; }
          i = n++; paint(i, code, lvl, variant); map.set(key, i);
        }
        return i;
      },
      draw(ctx, i, gx, gy) { // at grid cell (gx, gy), in device pixels
        const slot = i % (PER * PER);
        ctx.drawImage(pages[Math.floor(i / (PER * PER))], (slot % PER) * gw, Math.floor(slot / PER) * gh, gw, gh, gx * gw, gy * gh, gw, gh);
      },
    };
  }

  function start(canvas, settings) {
    const ctx = canvas.getContext('2d');
    const raw = {};
    const merge = (p) => { for (const k in p) if (p[k] !== undefined) raw[k] = p[k]; };
    let dpr = 0, gw = 0, gh = 0, last = 0, raf = 0, grid = null, atlas = null, fps = 0, sig = '';
    // Reduced motion: slowest speed and no click scatter (koi food is still fine). matchMedia is absent in node.
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    let reduce = !!(mq && mq.matches);

    merge(settings);
    let s = normalize(raw);
    let animal = s.animal;
    const world = createWorld(s, animal, window.innerWidth, window.innerHeight, Math.random);
    const settle = () => {
      configure(world, s, animal);
      if (reduce) world.speed = LIMITS.speed[0] / DEFAULTS.speed;
      const d = dpr || 1;
      const w = Math.max(4, Math.round(world.cw * d)), h = Math.max(5, Math.round(world.ch * d));
      // whole device pixels per cell keep tiles crisp; the atlas and grid follow species, cell size, DPR and look
      const k = [world.animal, w, h, s.hue, s.grid, world.levels.map((l) => l.dim).join()].join('|');
      if (k !== sig) { sig = k; gw = w; gh = h; atlas = null; grid = null; }
      world.u *= gw / d / world.cw; // bodies keep their size in cells when the cell is snapped (or floored) to whole device pixels
      world.cw = gw / d; world.ch = gh / d;
    };

    function resize() {
      const d = window.devicePixelRatio || 1;
      const ow = world.w, oh = world.h;
      world.w = window.innerWidth; world.h = window.innerHeight;
      for (const a of world.animals) { // keep the spread across the new size; a 0-sized first layout means re-scatter
        a.x = ow > 0 ? (a.x * world.w) / ow : Math.random() * world.w;
        a.y = oh > 0 ? (a.y * world.h) / oh : Math.random() * world.h;
        a.trail.length = 0; a.spine = null;
      }
      canvas.width = Math.round(world.w * d); canvas.height = Math.round(world.h * d);
      if (d !== dpr) { dpr = d; atlas = null; grid = null; }
      settle(); // cell size and bodies follow the window width
    }

    function gridPattern() { // extremely faint grid, one tile repeated
      if (!grid) {
        const t = document.createElement('canvas');
        t.width = gw; t.height = gh;
        const x = t.getContext('2d');
        x.fillStyle = BG; x.fillRect(0, 0, gw, gh); // opaque tile: one fill paints background and grid
        x.fillStyle = 'rgba(140,150,185,' + 0.03 * (s.grid / DEFAULTS.grid) + ')'; // default: ~4 levels over the background, like the reference
        if (s.grid > 0) { x.fillRect(0, 0, gw, 1); x.fillRect(0, 0, 1, gh); }
        grid = ctx.createPattern(t, 'repeat');
      }
      return grid;
    }

    const drawCell = (a, gx, gy, code) => atlas.draw(ctx, atlas.get(code, a.lvl, variantOf(world, a, gx, gy, code)), gx, gy);
    function draw() {
      const sp = SPECIES[world.animal], cw = world.cw, ch = world.ch;
      if (!atlas) atlas = makeAtlas(sp, gw, gh, world.levels, s.hue);
      ctx.setTransform(1, 0, 0, 1, 0, 0); // device pixels: every cell lands on whole pixels
      ctx.globalAlpha = 1; ctx.fillStyle = gridPattern(); ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (world.trail) { // faint dotted wake: Trail sets its length, Trail fade how fast old dots fade
        for (const a of world.animals) {
          const i = atlas.get(enc(BARE, sp.trailCol, PERIOD), Math.min(4, a.lvl + 1), 0), n = a.trail.length;
          for (let j = 0; j < n - 1; j++) {
            const p = a.trail[j];
            if (H(j, Math.floor(p.x), a.seed) >= 0.5) continue;
            ctx.globalAlpha = (Math.exp(-(world.t - p.t) * world.trailFade) * (j + 1)) / n;
            atlas.draw(ctx, i, Math.floor(p.x / cw), Math.floor(p.y / ch));
          }
        }
        ctx.globalAlpha = 1;
      }
      compose(world, drawCell);
      if (world.pellets.length) {
        const i = atlas.get(enc(BARE, sp.P.food[0], OH), 0, 0);
        for (const p of world.pellets) atlas.draw(ctx, i, Math.floor(p.x / cw), Math.floor(p.y / ch));
      }
      ctx.fillStyle = '#c8ccd8';
      const ds = Math.max(1, Math.round(dpr * 1.3));
      for (const r of world.ripples) { // a disc of tiny grid-aligned dots that grows and fades where you clicked
        const rad = Math.min(1, r.age / 0.35) * 6, cgx = Math.floor(r.x / cw), cgy = Math.floor(r.y / ch), R = Math.ceil(rad), RX = Math.ceil((rad * ch) / cw);
        for (let dy = -R; dy <= R; dy++) for (let dx = -RX; dx <= RX; dx++) {
          const d = Math.hypot(dx * cw, dy * ch) / ch;
          if (d > rad) continue;
          ctx.globalAlpha = (1 - r.age / 1.4) * (1 - (d / 6) * 0.7) * 0.55;
          ctx.fillRect(Math.round((cgx + dx + 0.5) * gw - ds / 2), Math.round((cgy + dy + 0.5) * gh - ds / 2), ds, ds);
        }
      }
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (fps && last && now - last < 1000 / fps - 2) return; // host FPS limit (2 ms slack for timestamp jitter)
      // step() clamps each call to 50 ms, so a slow rate is stepped in pieces (and a long gap is capped at 200 ms)
      for (let d = last ? Math.min((now - last) / 1000, 0.2) : 0; d > 0; d -= 0.05) step(world, Math.min(d, 0.05));
      last = now;
      draw();
    }

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', (e) => { if (!reduce || SPECIES[world.animal].spine) poke(world, e.clientX, e.clientY); });
    if (mq && mq.addEventListener) mq.addEventListener('change', (e) => { reduce = e.matches; settle(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
    });
    if (!document.hidden) raf = requestAnimationFrame(frame);

    return {
      update(partial) {
        merge(partial);
        s = normalize(raw);
        animal = s.animal;
        settle(); // drops the atlas and grid when the species or cell size changed
      },
      setFps(n) { fps = n > 0 ? n : 0; }, // 0 / undefined = unthrottled
    };
  }

  const api = { ANIMALS, TWEAKS, DEFAULTS, LIMITS, LIVE, SPECIES, eff, levelsFor, normalize, fromWallpaperProps, countFor, createWorld, configure, step, poke, raster, compose, lineGlyph, hueRotate, cellColor, variantOf, start };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.AsciiAnimals = api;
})();
