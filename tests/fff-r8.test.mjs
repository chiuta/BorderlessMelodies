// Teste R8 pentru Borderless Melodies 1.1.0: sesiuni salvate, QR, fade configurabil pentru oprirea automată.
import {createRequire} from 'module';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = 'file://' + path.resolve(here, '..', 'index.html');
const AXE = process.env.FFF_AXE || '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/sweep/node_modules/axe-core/axe.min.js';
let ok = 0, bad = 0;
function t(name, cond, extra) { if (cond) { ok++; console.log('  ok  ' + name); } else { bad++; console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')); } }
const b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']});
async function open(w, h, url) {
  const ctx = await b.newContext({viewport: {width: w, height: h}, acceptDownloads: true});
  let net = 0; await ctx.route(/^https?:/, (r) => { net++; r.abort(); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  p.on('console', (m) => { if (/Content Security|Refused/i.test(m.text())) errs.push('csp ' + m.text().slice(0, 120)); });
  await p.goto(url || FILE); await p.waitForTimeout(3600);
  return {ctx, p, errs, net: () => net};
}
async function axe(w, h, prep, label) {
  const ctx = await b.newContext({viewport: {width: w, height: h}, bypassCSP: true}); await ctx.route(/^https?:/, (r) => r.abort());
  const p = await ctx.newPage(); await p.goto(FILE); await p.waitForTimeout(3600);
  await p.addScriptTag({content: fs.readFileSync(AXE, 'utf8')});
  if (prep) await prep(p);
  const v = await p.evaluate(async () => (await axe.run(document)).violations.map((x) => x.id + ':' + x.nodes.length));
  t('axe 0 violări ' + label + ' ' + w + 'px', v.length === 0, v.join(','));
  await ctx.close();
}
const val = (p, id) => p.evaluate((id) => document.getElementById(id).value, id);
async function setv(p, id, v) { await p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', {bubbles: true})); e.dispatchEvent(new Event('change', {bubbles: true})); }, [id, v]); }

console.log('Pornire și versiune');
{
  const {ctx, p, errs, net} = await open(1280, 800);
  t('0 pageerror/CSP', errs.length === 0, errs.join('|'));
  t('0 cereri de rețea', net() === 0);
  t('versiune 1.2.3', await p.evaluate(() => document.querySelector('meta[name=application-version]').content === '1.2.3' && /v 1\.2\.3 · 2026-10-22/.test(document.getElementById('app-version').textContent)));
  t('kit prezent', await p.evaluate(() => !!(window.FFF && FFF.label && FFF.bundle && FFF.qr)));
  t('panou sesiuni vizibil', await p.locator('#sessionPanel').isVisible());
  t('fade implicit 15 s', (await val(p, 'sleepFadeSelect')) === '15');
  await ctx.close();
}

console.log('Sesiuni salvate');
{
  const {ctx, p, errs} = await open(1280, 800);
  await p.click('#sessSaveBtn');
  t('fără nume: mesaj', /Type a name/.test(await p.textContent('#sessMsg')));
  await setv(p, 'seedInput', '4242'); const tmax = await p.evaluate(() => document.getElementById('tempoSlider').max); await setv(p, 'tempoSlider', tmax); await setv(p, 'sleepSelect', '30'); await setv(p, 'sleepFadeSelect', '60'); await setv(p, 'carrierSlider', '300');
  await p.fill('#sessName', 'Seara'); await p.click('#sessSaveBtn');
  t('sesiune salvată în listă', (await p.locator('#sessList li .r8-sname').allTextContents()).join() === 'Seara');
  const raw = await p.evaluate(() => localStorage.getItem('bm_sessions'));
  t('persistată în localStorage', /seed|s=4242/.test(raw) && /bm1;/.test(raw), raw);
  await setv(p, 'seedInput', '1'); await setv(p, 'tempoSlider', '60'); await setv(p, 'sleepSelect', '0'); await setv(p, 'sleepFadeSelect', '15');
  await p.reload(); await p.waitForTimeout(3600);
  t('lista rămâne după reîncărcare', (await p.locator('#sessList li .r8-sname').allTextContents()).join() === 'Seara');
  await p.click('#sessList button:has-text("Load")');
  t('încărcare: seed/tempo/timer/fade restaurate', (await val(p, 'seedInput')) === '4242' && (await val(p, 'tempoSlider')) === tmax && (await val(p, 'sleepSelect')) === '30' && (await val(p, 'sleepFadeSelect')) === '60' && (await val(p, 'carrierSlider')) === '300');
  t('readout tempo actualizat', (await p.textContent('#tempoReadout')) === tmax + ' BPM');
  // suprascriere cu același nume (fără duplicat)
  await p.fill('#sessName', 'seara'); await p.click('#sessSaveBtn');
  t('același nume (fără diferență de litere) suprascrie', (await p.locator('#sessList li').count()) === 1);
  // limită 30
  await p.evaluate(() => { const a = []; for (let i = 0; i < 30; i++) a.push({name: 'S' + i, ts: '2026-10-14', p: 'bm1;g=ambient;s=1'}); localStorage.setItem('bm_sessions', JSON.stringify(a)); });
  await p.reload(); await p.waitForTimeout(3600);
  await p.fill('#sessName', 'în plus'); await p.click('#sessSaveBtn');
  t('limita de 30 respectată', /limit of 30/.test(await p.textContent('#sessMsg')) && (await p.locator('#sessList li').count()) === 30);
  // ștergere
  await p.click('#sessList li:first-child button:has-text("Delete")');
  t('ștergere', (await p.locator('#sessList li').count()) === 29);
  // date corupte
  await p.evaluate(() => localStorage.setItem('bm_sessions', '{nu e json'));
  await p.reload(); await p.waitForTimeout(3600);
  t('date corupte: listă goală, fără erori', (await p.locator('#sessList li').count()) === 1 && errs.length === 0, errs.join('|'));
  // limbă
  await p.click('[data-lang-btn=ro]');
  t('română: titlu panou tradus', (await p.textContent('#sessionPanel h2')) === 'Sesiuni salvate și partajare');
  t('română: listă goală tradusă', (await p.textContent('#sessList li')) === 'Nicio sesiune salvată.');
  await ctx.close();
}

console.log('Cod QR: generare, citire din imagine, text, link');
{
  const {ctx, p, errs} = await open(1280, 800);
  const tm = await p.evaluate(() => document.getElementById('tempoSlider').max); await setv(p, 'seedInput', '777'); await setv(p, 'tempoSlider', tm); await setv(p, 'varietyIntensitySlider', '20'); await setv(p, 'sleepSelect', '45'); await setv(p, 'sleepFadeSelect', '300');
  await p.click('#qrShareBtn');
  t('dialog cu SVG', (await p.locator('dialog.r8-dlg[open] svg').count()) === 1);
  const text = await p.inputValue('dialog.r8-dlg textarea');
  t('conține bm1 și seed', text.startsWith('bm1;g=ambient;s=777;t=' + tm + ';') && /;zf=300;/.test(text), text);
  const png = await p.evaluate(async () => {
    const svg = document.querySelector('dialog.r8-dlg .r8-qr svg').outerHTML;
    const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
    const img = new Image(); await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
    const c = document.createElement('canvas'); c.width = 520; c.height = 520; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 520, 520); g.drawImage(img, 0, 0, 520, 520);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png')); return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  t('Escape închide și readuce focusul pe buton', (await p.locator('dialog.r8-dlg').count()) === 0 && (await p.evaluate(() => document.activeElement.id)) === 'qrShareBtn');
  await setv(p, 'seedInput', '1'); await setv(p, 'tempoSlider', await p.evaluate(() => document.getElementById('tempoSlider').min)); await setv(p, 'varietyIntensitySlider', '55'); await setv(p, 'sleepSelect', '0'); await setv(p, 'sleepFadeSelect', '15');
  await p.setInputFiles('#qrFile', {name: 'qr.png', mimeType: 'image/png', buffer: Buffer.from(png)});
  await p.waitForTimeout(900);
  t('imagine QR → setări aplicate', (await val(p, 'seedInput')) === '777' && (await val(p, 'tempoSlider')) === tm && (await val(p, 'varietyIntensitySlider')) === '20' && (await val(p, 'sleepSelect')) === '45' && (await val(p, 'sleepFadeSelect')) === '300', await p.textContent('#sessMsg'));
  t('mesaj „Settings applied”', /Settings applied/.test(await p.textContent('#sessMsg')));
  // lipire text
  await setv(p, 'seedInput', '5');
  await p.fill('#qrPaste', 'ceva ' + text + ' altceva'); await p.click('#qrPasteBtn');
  t('text lipit → aplicat', (await val(p, 'seedInput')) === '777');
  await p.fill('#qrPaste', 'bm1;g=inexistent;s=3'); await p.click('#qrPasteBtn');
  t('gen necunoscut → respins', /not contain a valid/.test(await p.textContent('#sessMsg')));
  await p.fill('#qrPaste', 'bm1;g=ambient;s=999999999;t=9999;zf=7;m=hack;d=zzz'); await p.click('#qrPasteBtn');
  t('valori în afara limitelor sunt limitate/ignorate', (await val(p, 'seedInput')) === '999999' && (await val(p, 'tempoSlider')) === tm && (await val(p, 'sleepFadeSelect')) === '300' && (await p.evaluate(() => document.querySelector('#modeControl button.active').dataset.mode)) !== 'hack');
  // imagine fără QR
  const blank = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 200; c.height = 200; const blob = await new Promise((r) => c.toBlob(r, 'image/png')); return Array.from(new Uint8Array(await blob.arrayBuffer())); });
  await p.setInputFiles('#qrFile', {name: 'gol.png', mimeType: 'image/png', buffer: Buffer.from(blank)});
  await p.waitForTimeout(600);
  t('imagine fără QR → mesaj', /No readable QR/.test(await p.textContent('#sessMsg')));
  // gen personalizat
  await p.click('#openEditorBtn'); await p.fill('#editorName', 'Mio'); await p.click('#saveCustomGenreBtn'); await p.waitForTimeout(300);
  await p.locator('#genreGrid').getByText('Mio', {exact: false}).first().click({force: true}); await p.waitForTimeout(300);
  await p.click('#qrShareBtn');
  t('gen personalizat nu se partajează', /custom genre/.test(await p.textContent('#sessMsg')) && (await p.locator('dialog.r8-dlg').count()) === 0);
  t('0 erori', errs.length === 0, errs.join('|'));
  await ctx.close();
}
{
  // link cu hash
  const {ctx, p, errs} = await open(1280, 800, FILE + '#bm1;g=ambient;s=31337;t=77;z=15;zf=600');
  t('hash în link aplică setările', (await val(p, 'seedInput')) === '31337' && (await val(p, 'sleepSelect')) === '15' && (await val(p, 'sleepFadeSelect')) === '600');
  t('mesaj despre link, fără pornire automată', /from the link applied/.test(await p.textContent('#sessMsg')) && (await p.evaluate(() => typeof isPlaying !== 'undefined' && isPlaying)) === false);
  t('0 erori', errs.length === 0, errs.join('|'));
  await ctx.close();
}

console.log('Fade configurabil la oprirea automată (timp real; opțiuni de 1–2 min adăugate în DOM pentru test)');
{
  const spy = () => {
    window.__ramps = []; window.__ctxs = [];
    const AC = window.AudioContext;
    window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__ctxs.push(this); } };
    const o = AudioParam.prototype.linearRampToValueAtTime;
    AudioParam.prototype.linearRampToValueAtTime = function (v, tt) { const c = window.__ctxs[0]; window.__ramps.push({v, dt: tt - (c ? c.currentTime : 0), at: Date.now()}); return o.call(this, v, tt); };
  };
  async function run(minutes, fade) {
    const c = await b.newContext({viewport: {width: 1280, height: 800}}); await c.route(/^https?:/, (r) => r.abort());
    await c.addInitScript(spy);
    const q = await c.newPage(); await q.goto(FILE); await q.waitForTimeout(3600);
    await q.evaluate(([m]) => { const sel = document.getElementById('sleepSelect'); const op = document.createElement('option'); op.value = String(m); op.textContent = 't'; sel.appendChild(op); }, [minutes]);
    await setv(q, 'sleepSelect', String(minutes)); await setv(q, 'sleepFadeSelect', String(fade)); await setv(q, 'durationSelect', '600');
    const t0 = Date.now();
    await q.click('#playPauseBtn'); await q.waitForTimeout(800);
    const base = await q.evaluate(() => window.__ramps.filter((r) => r.v < 0.01).length);
    let got = null, early = false;
    for (let i = 0; i < 160 && !got; i++) {
      await q.waitForTimeout(500);
      const r = await q.evaluate(() => window.__ramps.filter((x) => x.v < 0.01));
      for (const x of r) { const tt = (x.at - t0) / 1000; if (Math.abs(x.dt - fade) < 0.5 && Math.abs(tt - (minutes * 60 - fade)) < 5) got = {r: x, t: tt}; }
    }
    await c.close(); return got && {...got, early};
  }
  const [a, d] = await Promise.all([run(1, 15), run(2, 60)]);
  t('fade 15 s: rampa pornește la ≈45 s și durează 15 s', a && Math.abs(a.t - 45) < 4 && Math.abs(a.r.dt - 15) < 1.5, JSON.stringify(a));
  t('fade 60 s: rampa pornește la ≈60 s și durează 60 s', d && Math.abs(d.t - 60) < 4 && Math.abs(d.r.dt - 60) < 1.5, JSON.stringify(d));
}

console.log('Kit: copie de siguranță');
{
  const {ctx, p, errs} = await open(1280, 800);
  await p.fill('#sessName', 'kit'); await p.click('#sessSaveBtn');
  const bundle = await p.evaluate(() => FFF.bundle.build());
  t('bundle include sesiunile', bundle.app === 'borderlessmelodies' && /kit/.test(bundle.data.bm_sessions || ''));
  await p.click('#app-version'); await p.waitForTimeout(300);
  t('dialog „Transparență”', (await p.locator('dialog[open]').count()) === 1);
  await p.keyboard.press('Escape');
  t('0 erori', errs.length === 0, errs.join('|'));
  await ctx.close();
}

console.log('Accesibilitate și dimensiuni');
for (const [w, h] of [[1280, 800], [360, 740]]) {
  await axe(w, h, null, 'pagină');
  await axe(w, h, async (p) => { await p.click('#qrShareBtn'); await p.waitForTimeout(200); }, 'dialog QR');
  await axe(w, h, async (p) => { await p.fill('#sessName', 'x'); await p.click('#sessSaveBtn'); await p.click('[data-lang-btn=ro]'); }, 'sesiuni (ro)');
  await axe(w, h, async (p) => { await p.click('#app-version'); await p.waitForTimeout(300); }, 'dialog Transparență');
  const {ctx, p} = await open(w, h);
  t('fără depășire orizontală ' + w, await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await ctx.close();
}
await b.close();
console.log(`\n${ok} reușite, ${bad} eșuate`); process.exit(bad ? 1 : 0);
