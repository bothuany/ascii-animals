// Regenerates every store/preview image. Usage: node tools/assets/make-assets.js [icons] [shots] [promo] [gif]   (no argument = all)
// Needs puppeteer-core (npm install in tools/), Chrome or Edge, and ffmpeg on PATH. Output goes only to the paths in OUT below.
const fs = require('fs'), path = require('path'), http = require('http'), { execFileSync } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const TMP = path.join(__dirname, 'tmp'); // the only directory this script ever deletes
const OUT = { icons: path.join(ROOT, 'icons'), shots: path.join(ROOT, 'store', 'screenshots'), promo: path.join(ROOT, 'store', 'promo-small.png'), gif: path.join(ROOT, 'preview.gif') };
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });

// ---- icons: tile mosaics. Letters: A upper wing, a light upper, B lower wing, b light lower, W body. Left half only (mirrored), body is the last column.
const COLORS = { A: '#ff9f43', a: '#ffc27a', B: '#2fd0c0', b: '#86ece2', W: '#f1f1f6' };
const P16 = ['..W.W..', 'AAAWAAA', 'AAAWAAA', '.AAWAA.', '.BBWBB.', '..BWB..']; // full 7-wide rows
const HALF12 = ['...W..', '....W.', '.AAA.W', 'AAaAAW', 'AaaAAW', 'AAAA.W', '.BBBBW', '.BbBBW', '..BBBW', '...B.W'];
const P12 = [''.padEnd(12, '.'), ...HALF12.map((h) => h + [...h].reverse().join('')), ''.padEnd(12, '.')];
// size = canvas px, pad = transparent border, radius = tile corner, pitch = px per tile, gap = px between tiles, shade = alternate-tile highlight
const ICONS = [
  { size: 16, pad: 0, radius: 3, pitch: 2, gap: 0, shade: 0, border: 0, pattern: P16 },
  { size: 48, pad: 0, radius: 10, pitch: 3, gap: 0, shade: 0.1, border: 1, pattern: P12 },
  { size: 128, pad: 16, radius: 20, pitch: 6, gap: 1, shade: 0.1, border: 1, pattern: P12 }, // 96x96 artwork + 16 px padding per side (CWS icon guidance)
];
function drawIcon(cfg, colors) {
  const c = document.createElement('canvas'); c.width = c.height = cfg.size;
  const x = c.getContext('2d'), t = cfg.size - 2 * cfg.pad;
  x.imageSmoothingEnabled = false;
  x.fillStyle = '#0b0c11'; x.beginPath(); x.roundRect(cfg.pad, cfg.pad, t, t, cfg.radius); x.fill();
  const rows = cfg.pattern, w = rows[0].length, ox = cfg.pad + Math.floor((t - w * cfg.pitch) / 2), oy = cfg.pad + Math.floor((t - rows.length * cfg.pitch) / 2);
  rows.forEach((row, r) => [...row].forEach((ch, col) => {
    if (!colors[ch]) return;
    x.fillStyle = colors[ch]; x.fillRect(ox + col * cfg.pitch, oy + r * cfg.pitch, cfg.pitch - cfg.gap, cfg.pitch - cfg.gap);
    if (cfg.shade && (r + col) % 2) { x.fillStyle = `rgba(255,255,255,${cfg.shade})`; x.fillRect(ox + col * cfg.pitch, oy + r * cfg.pitch, cfg.pitch - cfg.gap, cfg.pitch - cfg.gap); }
  }));
  if (cfg.border) { x.strokeStyle = 'rgba(255,255,255,0.16)'; x.lineWidth = cfg.border; x.beginPath(); x.roundRect(cfg.pad + cfg.border / 2, cfg.pad + cfg.border / 2, t - cfg.border, t - cfg.border, cfg.radius - cfg.border / 2); x.stroke(); }
  return c.toDataURL('image/png').split(',')[1];
}
async function icons(browser) {
  fs.mkdirSync(OUT.icons, { recursive: true });
  const page = await browser.newPage();
  await page.setContent('<!doctype html><body></body>');
  for (const cfg of ICONS) {
    const b64 = await page.evaluate(`(${drawIcon})(${JSON.stringify(cfg)}, ${JSON.stringify(COLORS)})`);
    fs.writeFileSync(path.join(OUT.icons, `icon${cfg.size}.png`), Buffer.from(b64, 'base64'));
  }
  await page.close();
}

// ---- screenshots: Chrome Web Store wants 1280x800 (or 640x400), full bleed, no alpha -> PNG converted to rgb24
const toRgb = (src, dst) => ffmpeg('-i', src, '-pix_fmt', 'rgb24', '-frames:v', '1', dst);
async function load(browser, url, w, h, dsf = 1) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dsf });
  page.on('pageerror', (e) => console.warn('pageerror', url, e.message));
  await page.goto(url, { waitUntil: 'load' });
  await sleep(2500); // warm-up so the swarm is on screen
  return page;
}
async function shots(browser, base) {
  fs.mkdirSync(OUT.shots, { recursive: true });
  const list = [['01-koi', 'koi'], ['02-butterfly', 'butterfly'], ['03-jellyfish', 'jellyfish'], ['04-crane', 'crane']];
  for (const [name, animal] of list) {
    const page = await load(browser, `${base}/newtab.html?animal=${animal}`, 1280, 800);
    const raw = path.join(TMP, name + '.png'); await page.screenshot({ path: raw }); await page.close();
    toRgb(raw, path.join(OUT.shots, name + '.png'));
  }
  // Settings popup (340 px wide, 560 px tall at most) over a dimmed wallpaper, shown at 1.25x so the text stays crisp.
  fs.writeFileSync(path.join(TMP, 'compose.html'), `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;width:1280px;height:800px;overflow:hidden;background:#07080c}
    iframe{border:0;position:absolute}
    #bg{inset:0;width:1280px;height:800px}
    #dim{position:absolute;inset:0;background:rgba(5,6,10,.45)}
    #pop{left:50%;top:50%;width:340px;height:560px;margin:-280px 0 0 -170px;transform:scale(1.25);border-radius:12px;box-shadow:0 0 0 1px rgba(255,255,255,.12),0 24px 70px rgba(0,0,0,.7)}
  </style><iframe id="bg" src="/wallpaper.html?animal=koi"></iframe><div id="dim"></div><iframe id="pop" src="/options.html?animal=koi"></iframe>`);
  const page = await load(browser, `${base}/tools/assets/tmp/compose.html`, 1280, 800);
  const raw = path.join(TMP, '05-settings.png'); await page.screenshot({ path: raw }); await page.close();
  toRgb(raw, path.join(OUT.shots, '05-settings.png'));
}

// ---- small promo tile 440x280: animals only, captured at 2x then downscaled
async function promo(browser, base) {
  const page = await load(browser, `${base}/wallpaper.html?animal=koi&size=0.9&density=1.5`, 880, 560);
  const raw = path.join(TMP, 'promo.png'); await page.screenshot({ path: raw }); await page.close();
  ffmpeg('-i', raw, '-vf', 'scale=440:280:flags=lanczos', '-pix_fmt', 'rgb24', '-frames:v', '1', OUT.promo);
}

// ---- Wallpaper Engine preview: GIFs may be at most 256x256 and 1 MB (500 KB recommended) -> 256x144, 12 fps, 4 species x 2 s
const GIF = { w: 256, h: 144, fps: 12, shots: [{ animal: 'koi' }, { animal: 'butterfly' }, { animal: 'jellyfish' }, { animal: 'crane' }], dur: 2 };
async function gif(browser, base) {
  const lines = [];
  for (let i = 0; i < GIF.shots.length; i++) {
    const page = await load(browser, `${base}/wallpaper.html?animal=${GIF.shots[i].animal}&size=2`, 1280, 720);
    const cdp = await page.createCDPSession(), frames = [];
    cdp.on('Page.screencastFrame', (f) => {
      const file = path.join(TMP, `g${i}_${String(frames.length).padStart(5, '0')}.jpg`);
      fs.writeFileSync(file, Buffer.from(f.data, 'base64')); frames.push({ file, ts: f.metadata.timestamp });
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1 });
    await sleep(GIF.dur * 1000 + 150);
    await cdp.send('Page.stopScreencast'); await sleep(100); await page.close();
    const end = frames[0].ts + GIF.dur, kept = frames.filter((f) => f.ts < end);
    kept.forEach((f, k) => lines.push(`file '${f.file.split(path.sep).join('/')}'\nduration ${((k + 1 < kept.length ? kept[k + 1].ts : end) - f.ts).toFixed(5)}`));
  }
  const lf = path.join(TMP, 'list.txt'); fs.writeFileSync(lf, lines.join('\n') + '\n');
  const vf = `fps=${GIF.fps},scale=${GIF.w}:${GIF.h}:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
  ffmpeg('-f', 'concat', '-safe', '0', '-i', lf, '-vf', vf, '-loop', '0', OUT.gif);
  for (const f of fs.readdirSync(TMP)) if (/^g\d+_\d+\.jpg$/.test(f)) fs.unlinkSync(path.join(TMP, f)); // frames only; explicit names
}

(async () => {
  if (!CHROME) throw new Error('no Chrome/Edge found');
  const steps = { icons, shots, promo, gif }, want = process.argv.slice(2), run = want.length ? want : Object.keys(steps);
  for (const s of run) if (!steps[s]) throw new Error('unknown step ' + s);
  if (path.basename(TMP) !== 'tmp' || path.dirname(TMP) !== __dirname) throw new Error('refusing to clear ' + TMP);
  fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
  const server = http.createServer((req, res) => {
    const p = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])));
    if (!p.startsWith(ROOT + path.sep) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
  try { for (const s of run) { console.log('step', s); await steps[s](browser, base); } } finally { await browser.close(); server.close(); }
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
