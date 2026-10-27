// Teste v2.1.0 pentru Borderless Melodies: tonalitate (tonică) aleasă manual — transpunere, link, sesiuni, setări JSON, cod scurt BM1.
// Rulare: node tests/key-v21.test.mjs   (Playwright din /opt/node-tools, rețea blocată). Testează logica, nu sunetul.
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
const require = createRequire(process.env.PW_ROOT || import.meta.url);
const {chromium} = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = 'file://' + path.resolve(here, '..', 'index.html');
let ok = 0, bad = 0;
function t(name, cond, extra) { if (cond) { ok++; console.log('  ok  ' + name); } else { bad++; console.log('  FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')); } }
const b = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox']});
async function open(hash = '', lang) {
  const ctx = await b.newContext({viewport: {width: 1280, height: 900}, locale: 'en-US'});
  let net = 0; await ctx.route(/^https?:/, (r) => { net++; r.abort(); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (/Content Security|Refused/i.test(m.text())) errs.push('csp ' + m.text().slice(0, 120)); });
  await p.goto(FILE + hash); await p.waitForTimeout(2200);
  if (lang) { await p.click('[data-lang-btn="' + lang + '"]'); await p.waitForTimeout(300); }
  return {ctx, p, errs, net: () => net};
}
// notele (pe piste) din setările curente cu o tonalitate dată
const notesFor = (p, rootPc) => p.evaluate((rootPc) => {
  const s = BM_V2.settings(); s.seed = 31337; s.genreKey = 'ambient'; s.tempo = 70; s.rootMidi = rootPc == null ? null : 60 + rootPc;
  const r = BM_V2.midiForSettings(s, 60); return Array.from(r.bytes);
}, rootPc);
function noteList(u8) { // listă (on, n) pentru toate notele On din toate pistele, în ordine
  const out = []; let i = 0; const tag = (n) => String.fromCharCode(...u8.slice(i, i += n));
  const rd32 = () => (u8[i++] * 16777216) + (u8[i++] << 16) + (u8[i++] << 8) + u8[i++]; const rd16 = () => (u8[i++] << 8) | u8[i++];
  tag(4); rd32(); rd16(); const ntrk = rd16(); rd16();
  for (let k = 0; k < ntrk; k++) { tag(4); const len = rd32(), end = i + len; let tick = 0, run = 0;
    while (i < end) { let d = 0, c; do { c = u8[i++]; d = (d << 7) | (c & 127); } while (c & 128); tick += d; const s = u8[i];
      if (s === 0xff) { i++; i++; let l = 0; do { c = u8[i++]; l = (l << 7) | (c & 127); } while (c & 128); i += l; continue; }
      if (s & 0x80) { run = s; i++; } const hi = run & 0xf0;
      if (hi === 0xc0) i++; else if (hi === 0x90 || hi === 0x80) { const n = u8[i++], v = u8[i++]; if (hi === 0x90 && v > 0) out.push([k, tick, n]); } else i += 2; } }
  return out;
}

console.log('Transpunere');
{
  const {ctx, p, errs, net} = await open();
  const a = noteList(await notesFor(p, 0)), c = noteList(await notesFor(p, 7)), d = noteList(await notesFor(p, 7));
  t('piesa are note', a.length > 20, a.length);
  t('același număr de note și același ritm pentru tonici diferite', a.length === c.length && a.every((x, i) => x[0] === c[i][0] && x[1] === c[i][1]), [a.length, c.length]);
  const diffs = new Set(a.map((x, i) => c[i][2] - x[2]));
  t('toate notele sunt transpuse cu aceeași valoare (+7 semitonuri)', diffs.size === 1 && diffs.has(7), [...diffs]);
  t('aceeași tonalitate = aceeași piesă (reproductibil)', JSON.stringify(c) === JSON.stringify(d));
  const auto1 = noteList(await notesFor(p, null)), auto2 = noteList(await notesFor(p, null));
  t('automat: reproductibil din seed', JSON.stringify(auto1) === JSON.stringify(auto2) && auto1.length === a.length);
  const dAuto = new Set(auto1.map((x, i) => x[2] - a[i][2]));
  t('automat = una dintre cele 12 tonalități (transpunere constantă față de Do)', dAuto.size === 1 && [...dAuto][0] >= 0 && [...dAuto][0] <= 11, [...dAuto]);
  t('fără erori și fără rețea', errs.length === 0 && net() === 0, {errs, net: net()});
  await ctx.close();
}
console.log('Interfață, link, sesiuni, setări');
{
  const {ctx, p, errs} = await open();
  t('selectorul există, implicit „auto” și setările dau rootMidi null', await p.evaluate(() => document.getElementById('rootSelect').value === 'auto' && BM_V2.settings().rootMidi === null));
  await p.selectOption('#rootSelect', '5');
  t('selectare Fa (5) → rootMidi 65', await p.evaluate(() => BM_V2.settings().rootMidi === 65));
  const code = await p.evaluate(() => document.getElementById('shortCode').value);
  t('cu tonalitate manuală, codul scurt BM1 rămâne gol și apare explicația', code === '' && (await p.evaluate(() => document.getElementById('shortCodeMsg').textContent)).length > 20, code);
  await p.fill('#sessName', 'k5'); await p.click('#sessSaveBtn'); await p.waitForTimeout(300);
  await p.selectOption('#rootSelect', 'auto'); await p.waitForTimeout(100);
  t('revenire pe automat → codul scurt BM1 revine', (await p.evaluate(() => document.getElementById('shortCode').value)).startsWith('BM1-'));
  await p.click('#sessList button'); await p.waitForTimeout(300);
  t('încărcarea sesiunii restabilește tonalitatea (5)', await p.evaluate(() => document.getElementById('rootSelect').value === '5'));
  const impVals = [];
  for (const j of [{genreKey: 'ambient', seed: 5, rootPc: 9}, {genreKey: 'ambient', seed: 5}, {seed: 5, rootPc: 99}]) {
    const f = path.join(os.tmpdir(), 'bm-key-' + Math.random().toString(36).slice(2) + '.json'); fs.writeFileSync(f, JSON.stringify(j));
    await p.setInputFiles('#importJsonFile', f); await p.waitForTimeout(400);
    impVals.push(await p.evaluate(() => document.getElementById('rootSelect').value)); fs.unlinkSync(f);
  }
  t('import JSON: rootPc 9 → 9; lipsă → auto; invalid → auto', JSON.stringify(impVals) === JSON.stringify(['9', 'auto', 'auto']), impVals);
  await p.close();
  const p2 = await ctx.newPage(); await p2.goto(FILE + '#bm1;g=ambient;s=77;k=7;t=70'); await p2.waitForTimeout(2200);
  t('link #bm1;…;k=7 → tonalitate 7 (Sol)', await p2.evaluate(() => document.getElementById('rootSelect').value === '7'));
  const p3 = await ctx.newPage(); await p3.goto(FILE + '#bm1;g=ambient;s=77;t=70'); await p3.waitForTimeout(2200);
  t('link fără k → automat', await p3.evaluate(() => document.getElementById('rootSelect').value === 'auto'));
  const p4 = await ctx.newPage(); await p4.goto(FILE + '#bm1;g=ambient;s=77;k=abc;t=70'); await p4.waitForTimeout(2200);
  t('link cu k invalid → automat (valoare respinsă)', await p4.evaluate(() => document.getElementById('rootSelect').value === 'auto'));
  t('fără erori', errs.length === 0, errs);
  await ctx.close();
}
console.log('Limbi');
for (const lg of ['ro', 'fr', 'it', 'es', 'pt', 'de', 'hu']) {
  const {ctx, p, errs} = await open('', lg);
  const r = await p.evaluate(() => ({l: document.querySelector('label[for="rootSelect"]').textContent, a: document.querySelector('#rootSelect option[value=auto]').textContent, h: document.getElementById('rootHint').textContent.length}));
  t(lg + ': etichetă/auto/explicație traduse', r.l !== 'Key (tonic)' && r.a !== 'Automatic (from the seed)' && r.h > 80, r);
  await ctx.close();
}
await b.close();
console.log(`\n${ok} reușite, ${bad} eșuate`);
process.exit(bad ? 1 : 0);
