// Teste v2.0.0 pentru Borderless Melodies: cod scurt „BM1” (aceeași piesă oriunde) și export MIDI din partitura generativă.
// Rulare: node tests/seed-midi-v2.test.mjs   (Playwright din /opt/node-tools, rețea blocată). Testează logica, nu sunetul.
import {createRequire} from 'module';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
const require = createRequire(process.env.PW_ROOT || import.meta.url);
const {chromium} = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = 'file://' + path.resolve(here, '..', 'index.html');
let ok = 0, bad = 0;
function t(name, cond, extra) { if (cond) { ok++; console.log('  ok  ' + name); } else { bad++; console.log('  FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra) : '')); } }
const b = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox']});
async function open(hash = '') {
  const ctx = await b.newContext({viewport: {width: 1280, height: 900}, acceptDownloads: true, locale: 'en-US'});
  let net = 0; await ctx.route(/^https?:/, (r) => { net++; r.abort(); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (/Content Security|Refused/i.test(m.text())) errs.push('csp ' + m.text().slice(0, 120)); });
  await p.goto(FILE + hash); await p.waitForTimeout(2200);
  return {ctx, p, errs, net: () => net};
}
// mini-parser SMF: întoarce {format, ntrk, ppq, tempo, num, tracks:[{name, notes:[{n,on,off,ch}], prog}]}
function parseSmf(u8) {
  let i = 0; const rd32 = () => (u8[i++] * 16777216) + (u8[i++] << 16) + (u8[i++] << 8) + u8[i++]; const rd16 = () => (u8[i++] << 8) | u8[i++];
  const tag = (n) => String.fromCharCode(...u8.slice(i, i += n));
  if (tag(4) !== 'MThd') throw new Error('no MThd'); rd32(); const format = rd16(), ntrk = rd16(), ppq = rd16();
  const out = {format, ntrk, ppq, tempo: 0, num: 0, tracks: []};
  for (let k = 0; k < ntrk; k++) {
    if (tag(4) !== 'MTrk') throw new Error('no MTrk'); const len = rd32(), end = i + len; let tick = 0, run = 0; const tr = {name: '', notes: [], prog: -1, open: {}, ended: false};
    while (i < end) {
      let d = 0, c; do { c = u8[i++]; d = (d << 7) | (c & 127); } while (c & 128); tick += d;
      let s = u8[i]; if (s === 0xff) { i++; const ty = u8[i++]; let l = 0; do { c = u8[i++]; l = (l << 7) | (c & 127); } while (c & 128);
        const data = u8.slice(i, i += l);
        if (ty === 3) tr.name = Buffer.from(data).toString('utf8'); if (ty === 0x51) out.tempo = (data[0] << 16) | (data[1] << 8) | data[2]; if (ty === 0x58) out.num = data[0]; if (ty === 0x2f) tr.ended = true; continue; }
      if (s & 0x80) { run = s; i++; } const hi = run & 0xf0, ch = run & 15;
      if (hi === 0xc0) { tr.prog = u8[i++]; } else if (hi === 0x90 || hi === 0x80) { const n = u8[i++], v = u8[i++];
        if (hi === 0x90 && v > 0) { tr.open[n + ':' + ch] = tick; } else { const on = tr.open[n + ':' + ch]; if (on === undefined) throw new Error('off fără on'); tr.notes.push({n, on, off: tick, ch}); delete tr.open[n + ':' + ch]; } }
      else i += 2;
    }
    if (Object.keys(tr.open).length) throw new Error('note rămase deschise'); out.tracks.push(tr);
  }
  return out;
}

console.log('Cod scurt BM1');
{
  const {ctx, p, errs, net} = await open();
  const R = await p.evaluate(() => {
    const V = BM_V2;
    const o = {genreKey: 'jazz', seed: 424242, tempo: 83, duration: '600', variety: 55, voice: true, voiceDensity: 30};
    const c = V.encodeShortCode(o), back = V.decodeShortCode(c);
    const flipped = c.slice(0, 5) + (c[5] === '2' ? '3' : '2') + c.slice(6);
    const all = V.CODE_GENRES.every((g) => { const x = V.decodeShortCode(V.encodeShortCode({genreKey: g, seed: 999999, tempo: 130, duration: 'continuous', variety: 100, voice: false, voiceDensity: 100})); return x && x.genreKey === g && x.seed === 999999 && x.tempo === 130 && x.duration === 'continuous'; });
    const lo = V.decodeShortCode(V.encodeShortCode({genreKey: 'ambient', seed: 0, tempo: 40, duration: '120', variety: 0, voice: false, voiceDensity: 0}));
    return {c, back, flipped: V.decodeShortCode(flipped), lower: V.decodeShortCode(c.toLowerCase()), spaced: V.decodeShortCode('  ' + c.replace(/-/g, ' ') + ' '), all, lo,
      bad: [V.decodeShortCode(''), V.decodeShortCode('BM1-0000-0000-0000'), V.decodeShortCode('XX1-ABCD-EFGH-JKMN'), V.decodeShortCode('BM1-ABC'), V.decodeShortCode(null)],
      unk: V.encodeShortCode({genreKey: 'nu-exista', seed: 1, tempo: 70, duration: '300', variety: 50, voice: false, voiceDensity: 30}),
      coversAll: V.GENRE_ORDER.every((g, i) => V.CODE_GENRES[i] === g), n: V.GENRE_ORDER.length };
  });
  t('format BM1-XXXX-XXXX-XXXX', /^BM1-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(R.c), R.c);
  t('dus-întors: gen, sămânță, tempo, durată, varietate, voce', R.back && R.back.genreKey === 'jazz' && R.back.seed === 424242 && R.back.tempo === 83 && R.back.duration === '600' && R.back.variety === 55 && R.back.voice === true && R.back.voiceDensity === 30, R.back);
  t('toleranță: litere mici, spații în loc de cratime', R.lower && R.lower.seed === 424242 && R.spaced && R.spaced.seed === 424242);
  t('un caracter greșit → respins (sumă de control)', R.flipped === null);
  t('coduri invalide → null', R.bad.every((x) => x === null), R.bad);
  t('toate cele 77 de genuri se codifică și se decodifică (valori maxime)', R.all && R.n === 77);
  t('valori minime', R.lo && R.lo.seed === 0 && R.lo.tempo === 40 && R.lo.duration === '120' && R.lo.variety === 0);
  t('gen necunoscut/personalizat → fără cod', R.unk === null);
  t('lista înghețată acoperă genurile actuale în aceeași ordine', R.coversAll);
  t('0 erori / 0 rețea', errs.length === 0 && net() === 0, errs);
  await ctx.close();
}

console.log('Cod scurt în interfață');
{
  const {ctx, p, errs} = await open();
  await p.fill('#seedInput', '31337'); await p.dispatchEvent('#seedInput', 'input');
  await p.waitForTimeout(100);
  const code = await p.inputValue('#shortCode');
  t('câmpul se actualizează cu seed-ul', /^BM1-/.test(code) && (await p.evaluate(() => BM_V2.decodeShortCode(document.getElementById('shortCode').value).seed)) === 31337, code);
  await p.fill('#seedInput', '1'); await p.fill('#tempoSlider', '90').catch(() => {});
  await p.evaluate((c) => { document.getElementById('seedInput').value = '5'; document.getElementById('shortCode').value = c; }, code);
  await p.click('#shortCodeApply');
  t('„Aplică codul” restaurează seed-ul', (await p.inputValue('#seedInput')) === '31337' && /BM1-/.test(await p.textContent('#shortCodeMsg')));
  await p.fill('#shortCode', 'BM1-0000-0000-0000'); await p.click('#shortCodeApply');
  t('cod invalid: mesaj, seed neschimbat', (await p.inputValue('#seedInput')) === '31337' && (await p.textContent('#shortCodeMsg')).length > 5);
  t('0 erori', errs.length === 0, errs);
  await ctx.close();
}
{
  const {ctx, p, errs} = await open('#code=BM1-0000-0000-0000');
  t('link cu cod invalid nu strică pagina', errs.length === 0);
  await ctx.close();
}
{
  const first = await open();
  const code = await first.p.evaluate(() => BM_V2.encodeShortCode({genreKey: 'lofi', seed: 777, tempo: 80, duration: '300', variety: 40, voice: false, voiceDensity: 30}));
  await first.ctx.close();
  const {ctx, p, errs} = await open('#code=' + code);
  t('link #code= aplică piesa (seed 777, tempo 80), fără pornirea sunetului', (await p.inputValue('#seedInput')) === '777' && (await p.inputValue('#tempoSlider')) === '80' && errs.length === 0, [await p.inputValue('#seedInput'), await p.inputValue('#tempoSlider')]);
  await ctx.close();
}

console.log('MIDI: structură, determinism, conținut');
{
  const {ctx, p, errs} = await open();
  const R = await p.evaluate(() => {
    const V = BM_V2, s = V.settings(); s.seed = 2468; s.genreKey = 'lofi'; s.tempo = 80; s.varietyIntensity = 0.5; s.voiceEnabled = false;
    const a = V.midiForSettings(s, 90), b2 = V.midiForSettings(s, 90); s.seed = 2469; const c = V.midiForSettings(s, 90);
    const ch = V.gen(2468, 'lofi', 80, 0.5, 90, false, 0.3);
    const cnt = {pad: ch.events.pad.length, bass: ch.events.bass.length, lead: ch.events.lead.length, arp: ch.events.arp.length};
    return {a: Array.from(a.bytes), b: Array.from(b2.bytes), c: Array.from(c.bytes), notes: a.notes, tracks: a.tracks, cnt, meter: 4};
  });
  const A = parseSmf(Uint8Array.from(R.a));
  t('antet: format 1, 480 PPQ', A.format === 1 && A.ppq === 480 && A.ntrk === A.tracks.length && A.ntrk === R.tracks + 1, [A.format, A.ppq, A.ntrk, R.tracks]);
  t('tempo 80 BPM și măsura 4/4 în pista 0', A.tempo === Math.round(60000000 / 80) && A.num === 4, [A.tempo, A.num]);
  t('titlul conține genul și seed-ul', /lofi|Lo-?fi/i.test(A.tracks[0].name) && /2468/.test(A.tracks[0].name), A.tracks[0].name);
  const names = A.tracks.slice(1).map((x) => x.name);
  t('piste pentru straturile cu note (Pad, Bass, …), fără Voice când vocea e oprită', names.indexOf('Pad') >= 0 && names.indexOf('Bass') >= 0 && names.indexOf('Voice') < 0, names);
  const total = A.tracks.reduce((s, x) => s + x.notes.length, 0);
  t('numărul de note raportat = numărul din fișier', total === R.notes, [total, R.notes]);
  const srcTotal = R.cnt.pad + R.cnt.bass + R.cnt.lead + R.cnt.arp;
  t('numărul de note = evenimentele partiturii (aceeași sămânță)', total === srcTotal, [total, srcTotal]);
  t('toate notele valide: înălțime 0–127, durată > 0, off ≥ on', A.tracks.every((x) => x.notes.every((n) => n.n >= 0 && n.n <= 127 && n.off > n.on)));
  const bass = A.tracks.find((x) => x.name === 'Bass');
  t('basul e mai grav decât lead-ul (medie)', (() => { const lead = A.tracks.find((x) => x.name === 'Lead'); if (!lead || !bass) return true; const avg = (tr) => tr.notes.reduce((s, n) => s + n.n, 0) / tr.notes.length; return avg(bass) < avg(lead); })());
  t('determinism: aceeași sămânță → aceiași octeți', R.a.length === R.b.length && R.a.every((v, i) => v === R.b[i]));
  t('altă sămânță → fișier diferit', R.a.length !== R.c.length || R.a.some((v, i) => v !== R.c[i]));
  t('0 erori', errs.length === 0, errs);
  await ctx.close();
}

console.log('MIDI: pista de voce, suprapuneri, descărcare');
{
  const {ctx, p, errs} = await open();
  const R = await p.evaluate(() => {
    const V = BM_V2;
    const m = V.buildMidi({pad: [{time: 0, freq: 440, dur: 2}, {time: 1, freq: 440, dur: 2}, {time: 0, freq: 0, dur: 1}, {time: 0, freq: 220, dur: 0}], voice: [{time: 0.5, freq: 261.63, dur: 1}], bass: []}, {tempo: 120, meter: 3, title: 'Ț test', comment: 'x'});
    return Array.from(m.bytes);
  });
  const M = parseSmf(Uint8Array.from(R));
  const pad = M.tracks.find((x) => x.name === 'Pad'), voice = M.tracks.find((x) => x.name === 'Voice');
  t('note invalide (frecvență 0, durată 0) sunt omise', pad && pad.notes.length === 2, pad && pad.notes.length);
  t('aceeași înălțime suprapusă: prima notă se încheie la reluare', pad.notes.sort((a, b) => a.on - b.on)[0].off <= pad.notes.sort((a, b) => a.on - b.on)[1].on);
  t('120 BPM: 1 s = 960 tick; nota la 1 s începe la tick 960', pad.notes.some((n) => n.on === 960));
  t('piesa de voce: do central (60), program coral', voice && voice.notes.length === 1 && voice.notes[0].n === 60 && voice.prog === 52);
  t('măsura 3/4 și titlu cu diacritice', M.num === 3 && M.tracks[0].name === 'Ț test', [M.num, M.tracks[0].name]);
  await p.selectOption('#exportDurationSelect', '60');
  await p.selectOption('#durationSelect', '300');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exportMidiBtn')]);
  const tmp = '/tmp/bm-midi-' + Date.now() + '.mid'; await dl.saveAs(tmp);
  const file = parseSmf(new Uint8Array(fs.readFileSync(tmp))); fs.unlinkSync(tmp);
  t('descărcare .mid validă cu piste', /\.mid$/.test(dl.suggestedFilename()) && file.ntrk >= 3 && file.tracks.some((x) => x.notes.length > 0), dl.suggestedFilename());
  t('mesaj de stare cu numărul de note', /\d+/.test(await p.textContent('#exportProgress')));
  t('0 erori', errs.length === 0, errs);
  await ctx.close();
}
await b.close();
console.log(`\n${ok} reușite, ${bad} eșuate`); process.exit(bad ? 1 : 0);
