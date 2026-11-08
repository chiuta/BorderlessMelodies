// Licența pieselor exportate (CC0 1.0) apare în interfață, în toate cele 8 limbi.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const s = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(s, /data-i18n="exportLicense"/);
const n = (s.match(/^\s*exportLicense:'[^']*CC0 1\.0[^']*',$/gm) || []).length;
assert.equal(n, 8, 'exportLicense în 8 limbi');
console.log('  ok  exportLicense în 8 limbi\n\n1 reușite, 0 eșuate');
