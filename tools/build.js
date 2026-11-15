// node tools/build.js -> dist/extension/, dist/ascii-animals-extension.zip, dist/wallpaper/. No dependencies.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const fail = (msg) => { console.error('BUILD FAILED: ' + msg); process.exit(1); };

// Whitelists: only these files ship. Icons are every PNG in icons/.
const LICENCE = ['fonts/OFL.txt', 'THIRD_PARTY.md']; // the fonts' licence ships with them
const EXT = ['manifest.json', 'newtab.html', 'newtab.js', 'options.html', 'options.js', 'style.css', 'engine.js', 'fonts/Geist-Regular.ttf', 'fonts/Geist-Medium.ttf', 'fonts/GeistMono-SemiBold.ttf', ...LICENCE];
const WALL = ['wallpaper.html', 'engine.js', 'project.json', 'preview.gif', 'fonts/GeistMono-SemiBold.ttf', ...LICENCE]; // the wallpaper has no text, only the animals' font
const ICONS = ['icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png'];
const LEAK = /(^|\/)(test\.js|demo|tools|node_modules|store|dist)(\/|$)|readme|privacy/i;

// ---- clear dist (explicit path, sanity-checked) ----
if (path.basename(dist) !== 'dist' || path.dirname(dist) !== root || !dist.startsWith(root + path.sep) || !fs.existsSync(path.join(root, 'engine.js'))) {
  fail('refusing to clear unexpected path ' + dist);
}
fs.rmSync(dist, { recursive: true, force: true });

// ---- source checks (all problems reported together) ----
const problems = [];
const need = (rel) => { if (!fs.existsSync(path.join(root, rel))) { problems.push('missing: ' + rel); return false; } return true; };
for (const f of [...EXT, ...ICONS, ...WALL]) need(f);
const iconDir = path.join(root, 'icons');
const icons = fs.existsSync(iconDir) ? fs.readdirSync(iconDir).filter((f) => /\.png$/i.test(f)).map((f) => 'icons/' + f) : [];

const png = (rel) => { // IHDR width/height of a PNG
  const b = fs.readFileSync(path.join(root, rel));
  return b.length > 24 && b.toString('latin1', 1, 4) === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null;
};
for (const rel of ICONS) {
  if (!fs.existsSync(path.join(root, rel))) continue;
  const want = +/icon(\d+)\.png/.exec(rel)[1], got = png(rel);
  if (!got || got[0] !== want || got[1] !== want) problems.push(rel + ': not a ' + want + 'x' + want + ' PNG (got ' + (got ? got.join('x') : 'not a PNG') + ')');
}
if (fs.existsSync(path.join(root, 'preview.gif')) && fs.readFileSync(path.join(root, 'preview.gif')).toString('latin1', 0, 3) !== 'GIF') problems.push('preview.gif: not a GIF');

const shipped = { extension: [...EXT, ...icons], wallpaper: WALL };
let manifest = null;
if (need('manifest.json')) {
  try { manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')); } catch (e) { problems.push('manifest.json: ' + e.message); }
}
if (manifest) {
  const set = new Set(shipped.extension);
  const refs = [...Object.values(manifest.icons || {}), ...Object.values((manifest.action || {}).default_icon || {}), manifest.options_ui && manifest.options_ui.page, manifest.action && manifest.action.default_popup, ...Object.values(manifest.chrome_url_overrides || {})];
  if (!manifest.icons || !Object.keys(manifest.icons).length) problems.push('manifest.json: no "icons"');
  if (!manifest.action || !manifest.action.default_icon) problems.push('manifest.json: no "action.default_icon"');
  for (const r of new Set(refs.filter(Boolean))) if (!set.has(r)) problems.push('manifest.json references ' + r + ', which is not in the extension file set');
  if (manifest.description && manifest.description.length > 132) problems.push('manifest.json: description is ' + manifest.description.length + ' characters (max 132)');
  if (manifest.name !== 'ASCII Animals') problems.push('manifest.json: unexpected name ' + manifest.name);
}

// <script src> / <link href> in the shipped HTML must resolve inside the shipped set (and be local).
function checkHtml(files, label, allowInline) {
  const set = new Set(files);
  for (const f of files.filter((x) => x.endsWith('.html') && fs.existsSync(path.join(root, x)))) {
    const html = fs.readFileSync(path.join(root, f), 'utf8');
    for (const m of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
      const ref = m[1].split(/[?#]/)[0];
      if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(ref)) { problems.push(label + ' ' + f + ': remote reference ' + m[1]); continue; }
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), ref));
      if (!set.has(target)) problems.push(label + ' ' + f + ': ' + m[1] + ' does not resolve inside the shipped files');
    }
    if (!allowInline && /<script(?![^>]*\bsrc\s*=)[^>]*>\s*\S/i.test(html)) problems.push(label + ' ' + f + ': inline <script> (blocked by the extension CSP)');
  }
}
checkHtml(shipped.extension, 'extension', false);
checkHtml(shipped.wallpaper, 'wallpaper', true);

if (problems.length) fail('\n  ' + problems.join('\n  '));

// ---- copy ----
const out = {};
function copy(files, dir) {
  for (const f of files) {
    const to = path.join(dist, dir, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(root, f), to);
  }
}
copy(shipped.extension, 'extension');
copy(shipped.wallpaper, 'wallpaper');

// ---- leak check on what is actually in dist ----
const walk = (dir, base = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), base + e.name + '/') : [base + e.name]));
for (const d of ['extension', 'wallpaper']) {
  out[d] = walk(path.join(dist, d)).sort();
  const bad = out[d].filter((f) => LEAK.test(f));
  if (bad.length) fail(d + ' contains files that must not ship: ' + bad.join(', '));
}

// ---- zip (manifest.json first, forward-slash names, fixed timestamp so builds are reproducible) ----
function zip(names, dir) {
  const parts = [], central = [];
  let offset = 0;
  for (const name of [...names].sort((a, b) => (a === 'manifest.json' ? -1 : b === 'manifest.json' ? 1 : a < b ? -1 : 1))) {
    const data = fs.readFileSync(path.join(dir, name)), packed = zlib.deflateRawSync(data, { level: 9 });
    const n = Buffer.from(name, 'utf8'), crc = zlib.crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt16LE(0, 10); h.writeUInt16LE(0x21, 12); // 1980-01-01 00:00
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(packed.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt16LE(0, 12); c.writeUInt16LE(0x21, 14);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(packed.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    parts.push(h, n, packed); central.push(c, n);
    offset += 30 + n.length + packed.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}
const zipPath = path.join(dist, 'ascii-animals-extension.zip');
fs.writeFileSync(zipPath, zip(out.extension, path.join(dist, 'extension')));

// ---- summary ----
const size = (dir, files) => files.reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const rows = [
  ['dist/extension/', out.extension.length + ' files', kb(size(path.join(dist, 'extension'), out.extension))],
  ['dist/ascii-animals-extension.zip', out.extension.length + ' entries', kb(fs.statSync(zipPath).size)],
  ['dist/wallpaper/', out.wallpaper.length + ' files', kb(size(path.join(dist, 'wallpaper'), out.wallpaper))],
];
console.log('Built ASCII Animals ' + manifest.version);
for (const r of rows) console.log('  ' + r[0].padEnd(36) + r[1].padEnd(14) + r[2]);
console.log('  extension: ' + out.extension.join(', '));
console.log('  wallpaper: ' + out.wallpaper.join(', '));
