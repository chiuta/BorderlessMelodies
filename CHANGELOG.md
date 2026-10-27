# Jurnal de modificări — BorderlessMelodies

Format: [SemVer](https://semver.org/lang/ro/) MAJOR.MINOR.PATCH.

## 2.1.0 — 2026-10-27 (anterior: v2.0.0)

Stare: stabil · Offline: complet

Aplicat după mini-recenzia din 2026-10-27.

### Adăugat / modificat
- **Selector de tonalitate (tonică)** în panoul „Compoziție”: „Automată (din seed)” (implicit; piesa rămâne exact cea de până acum) sau 12 tonici. Aceeași piesă se transpune; ritmul și melodia rămân identice (verificat prin parsarea MIDI în test). Tonalitatea intră în link `#bm1;…;k=…` (doar dacă e manuală, deci linkurile vechi rămân identice), QR, sesiuni salvate, setări JSON (`rootPc`) și în exportul audio/MIDI. Textele în 8 limbi.
- **Codul scurt BM1 nu transportă tonalitatea** (formatul BM1 e înghețat): când tonalitatea e manuală, câmpul rămâne gol și apare o explicație; „Aplică codul” revine pe „Automată”.
- Notă „vezi și” în README (8 limbi): BorderlessMelodies vs ASMR / CalmWaves / Aurora; NU s-au fuzionat.
- README (8 limbi): „Stare: stabil”, „Offline: complet”; secțiune nouă; istoric.
- Test nou `tests/key-v21.test.mjs` (24 verificări); `createCompositionState` consumă acum mereu extragerea aleatoare pentru tonică, deci piesele cu tonalitate automată sunt neschimbate (verificat cu testele BM1/MIDI existente).

### Neimplementat
- Fuziunea cu ASMR/CalmWaves/Aurora (recenzia o sugera): omisă intenționat; doar notă „vezi și”.
- „Export audio” și „seed reproductibil pentru partajare” exista deja în 2.0.0 (WAV/FLAC/MIDI; seed + cod scurt BM1 + link/QR): nemodificate, doar documentate.
- Includerea tonalității în codul scurt BM1: nu (format înghețat); se folosește linkul/QR/JSON.

## 2.0.0
- Versiunea anterioară (vezi istoricul din README).
