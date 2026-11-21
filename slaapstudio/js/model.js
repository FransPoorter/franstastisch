/* Slaappartner Slaapstudio – model: gesimuleerde SlaapID-meting, blokadvies, catalogus, prijzen en SVG-tekeningen.
   Alle meetwaarden zijn SIMULATIE voor de proof of concept (afgeleid van de vragenlijst, vaste seed per dossier). */
(function () {
  'use strict';
  const { esc, eur } = window.SS;

  /* ---------------- Blocks-hardheden & zones ---------------- */
  const LEVELS = [
    { key: 'xsoft', kort: 'XS', label: '_xsoft', color: '#bcc5d8', text: '#231f20' },
    { key: 'soft', kort: 'S', label: '_soft', color: '#959fb0', text: '#ffffff' },
    { key: 'medium', kort: 'M', label: '_medium', color: '#6c7380', text: '#ffffff' },
    { key: 'firm', kort: 'F', label: '_firm', color: '#4e535c', text: '#ffffff' },
    { key: 'xfirm', kort: 'XF', label: '_xfirm', color: '#35383e', text: '#ffffff' }
  ];
  const ZONES = ['Hoofd', 'Nek & schouder', 'Schouder', 'Bovenrug', 'Taille', 'Lende', 'Bekken', 'Heup & dij', 'Bovenbeen', 'Onderbeen & voet'];

  /* Beddelicious-achtige voorbeeldprofielen (voor configureren zonder meting) */
  const PRESETS = {
    'Rugligger, gemiddeld': [2, 1, 1, 3, 2, 2, 3, 3, 0, 0],
    'Zijligger, smalle heupen': [1, 0, 0, 2, 1, 1, 2, 2, 2, 3],
    'Zijligger, brede heupen': [2, 1, 1, 3, 3, 3, 4, 4, 4, 2],
    'Buikligger': [2, 0, 0, 2, 2, 2, 3, 4, 1, 1],
    'Stevig gebouwd': [3, 2, 2, 3, 3, 3, 4, 4, 3, 3],
    'Licht gebouwd': [2, 1, 1, 2, 2, 2, 3, 2, 1, 1]
  };

  /* ---------------- seeded random ---------------- */
  function hashStr(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
  function rng(seed) { let a = hashStr(seed); return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round1 = v => Math.round(v * 10) / 10;

  function timeToMin(t) { const [h, m] = String(t || '23:00').split(':').map(Number); return h * 60 + (m || 0); }
  function minToTime(m) { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }

  /* ---------------- blokadvies ---------------- */
  function adviseBlocks(s, posAvg) {
    const w = Number(s.gewicht) || 75;
    const l = Number(s.lengte) || 175;
    const bmi = w / Math.pow(l / 100, 2);
    let base = w < 60 ? 1 : w < 72 ? 2 : w < 88 ? 2 : w < 105 ? 3 : 3;
    if (bmi > 29) base = Math.min(4, base + 1);
    const z = [base, base - 1, base - 1, base + 1, base, base, base + 1, base + 1, base - 1, base - 1];
    const zij = (posAvg.zl + posAvg.zr) / 100;
    const rug = posAvg.rug / 100;
    const buik = posAvg.buik / 100;
    if (zij > 0.55) { z[1] -= 1; z[2] -= 1; }
    if (zij > 0.72) { z[2] -= 1; z[6] -= 1; }
    if (rug > 0.45) { z[4] += 1; z[5] += 1; }
    if (buik > 0.25) { z[6] += 1; z[7] += 1; z[1] += 1; }
    if (s.bouw === 'schouders') { z[1] -= 1; z[2] -= 1; }
    if (s.bouw === 'heupen') { z[6] -= 1; z[4] += 1; }
    const k = s.klachten || [];
    if (k.includes('lage rug')) { z[4] += 1; z[5] += 1; }
    if (k.includes('schouder') || k.includes('slapende armen')) { z[1] -= 1; z[2] -= 1; }
    if (k.includes('nek')) { z[0] = clamp(z[0], 1, 3); z[1] = Math.min(z[1], 1); }
    if (k.includes('heup')) { z[6] -= 1; z[7] = Math.max(z[7] - 1, z[6]); }
    return z.map(v => clamp(Math.round(v), 0, 4));
  }

  function adviseTijk(s, tempMax) {
    if (s.allergie === 'ja') return { tijk: 'Wash', reden: 'Bij een huisstofmijtallergie adviseren we de Wash-tijk: wasbaar op 40 °C.' };
    if (s.klimaat === 'warm' || s.klimaat === 'zweten' || tempMax > 33.6) return { tijk: 'Clima', reden: `Je bedklimaat liep op tot ${String(round1(tempMax)).replace('.', ',')} °C. De Clima-tijk met Tencel en 3D-ventilatie voert warmte en vocht beter af.` };
    if (s.klimaat === 'koud') return { tijk: 'Wool', reden: 'Je hebt het eerder koud. De Wool-tijk met zuivere scheerwol isoleert en reguleert vocht.' };
    return { tijk: 'Wool', reden: 'Je bedklimaat zit in de comfortzone. De standaard Wool-tijk past goed.' };
  }

  function adviseKussen(s, posAvg) {
    const zij = posAvg.zl + posAvg.zr;
    if (zij > 55) return 'Een hoger, stevig kussen dat de ruimte tussen schouder en hoofd opvult (zijligger).';
    if (posAvg.buik > 25) return 'Een laag, zacht kussen zodat je nek niet in een knik ligt (buikligger).';
    return 'Een middelhoog kussen met nekondersteuning (rugligger).';
  }

  /* ---------------- simulatie van de meting ---------------- */
  function simulate(dossier, s, opts) {
    opts = opts || {};
    const r = rng(dossier.id + '|' + s.id + (opts.herhaal ? '|herhaal' : ''));
    const dom = s.houding || 'wisselend';
    const basePos = {
      rug: { rug: 52, zl: 19, zr: 19, buik: 10 },
      zij: { rug: 18, zl: 37, zr: 38, buik: 7 },
      buik: { rug: 18, zl: 21, zr: 19, buik: 42 },
      wisselend: { rug: 32, zl: 27, zr: 27, buik: 14 }
    }[dom] || { rug: 32, zl: 27, zr: 27, buik: 14 };
    const k = s.klachten || [];
    let wisselBase = 36;
    if (k.length && !k.includes('geen')) wisselBase += 4 + 2 * k.length;
    if (s.ervaring === 'te hard' || s.ervaring === 'te zacht') wisselBase += 5;
    if (s.wakker === '3+') wisselBase += 7;
    if (s.wakker === '1-2') wisselBase += 3;
    if (Number(s.matrasLeeftijd) >= 10) wisselBase += 4;
    if (opts.herhaal) wisselBase *= 0.78;
    let tempBase = 32.2;
    if (s.klimaat === 'warm') tempBase = 33.6;
    if (s.klimaat === 'zweten') tempBase = 34.1;
    if (s.klimaat === 'koud') tempBase = 30.6;
    if (opts.herhaal && opts.tijk === 'Clima') tempBase -= 0.9;

    const bed = timeToMin(s.bedtijd || '23:00');
    let op = timeToMin(s.opstaan || '07:00'); if (op <= bed) op += 1440;
    const nights = [];
    for (let n = 1; n <= 3; n++) {
      const pos = {};
      let tot = 0;
      ['rug', 'zl', 'zr', 'buik'].forEach(key => { pos[key] = Math.max(2, basePos[key] + (r() - 0.5) * 12); tot += pos[key]; });
      Object.keys(pos).forEach(key => pos[key] = Math.round(pos[key] / tot * 100));
      const diff = 100 - (pos.rug + pos.zl + pos.zr + pos.buik); pos.zr += diff;
      const inBed = op - bed + Math.round((r() - 0.4) * 50);
      nights.push({
        n, pos,
        wissel: Math.round(wisselBase + (r() - 0.5) * 12),
        tempMax: round1(tempBase + 0.6 + r() * 0.9),
        tempGem: round1(tempBase - 0.3 + r() * 0.4),
        vocht: Math.round(52 + (tempBase - 31) * 4 + r() * 8),
        inBed, rustig: Math.round(clamp(78 - (wisselBase - 36) * 1.1 + (r() - 0.5) * 10, 45, 95))
      });
    }
    const avg = {
      pos: ['rug', 'zl', 'zr', 'buik'].reduce((o, key) => (o[key] = Math.round(nights.reduce((a, x) => a + x.pos[key], 0) / 3), o), {}),
      wissel: Math.round(nights.reduce((a, x) => a + x.wissel, 0) / 3),
      tempMax: round1(Math.max(...nights.map(x => x.tempMax))),
      tempGem: round1(nights.reduce((a, x) => a + x.tempGem, 0) / 3),
      vocht: Math.round(nights.reduce((a, x) => a + x.vocht, 0) / 3),
      inBed: Math.round(nights.reduce((a, x) => a + x.inBed, 0) / 3),
      rustig: Math.round(nights.reduce((a, x) => a + x.rustig, 0) / 3)
    };
    avg.pos.zr = 100 - avg.pos.rug - avg.pos.zl - avg.pos.buik;

    // nachtverloop (nacht 2): temperatuur en beweging per half uur
    const steps = Math.max(12, Math.round((op - bed) / 30));
    const temp = [], beweging = [];
    for (let i = 0; i <= steps; i++) {
      const t = bed + i * 30;
      const frac = i / steps;
      const warm = tempBase - 2.2 + 2.8 * (1 - Math.exp(-frac * 5)) + Math.sin(frac * Math.PI) * 0.5 + (r() - 0.5) * 0.35;
      temp.push({ t: minToTime(t), v: round1(warm) });
      if (i < steps) {
        const cycle = Math.abs(Math.sin(frac * Math.PI * 4.6));
        const mv = Math.round(Math.max(0, (cycle * 3.4 + r() * 2.2) * (wisselBase / 38) + (frac < 0.06 ? 3 : 0)));
        beweging.push({ t: minToTime(t), v: mv });
      }
    }
    const blocks = adviseBlocks(s, avg.pos);
    const tijk = adviseTijk(s, avg.tempMax);
    const zij = avg.pos.zl + avg.pos.zr;
    const inz = [];
    const dominant = zij >= avg.pos.rug && zij >= avg.pos.buik ? `op je zij (${zij}%)` : avg.pos.rug >= avg.pos.buik ? `op je rug (${avg.pos.rug}%)` : `op je buik (${avg.pos.buik}%)`;
    inz.push(`Je ligt het grootste deel van de nacht ${dominant}. ${zij > 55 ? 'Je schouder en heup moeten dus diep genoeg kunnen wegzakken om je wervelkolom recht te houden.' : 'Je lende heeft daarom stevige ondersteuning nodig.'}`);
    if (Math.abs(avg.pos.zl - avg.pos.zr) > 9) inz.push(`Je ligt duidelijk vaker op je ${avg.pos.zl > avg.pos.zr ? 'linker' : 'rechter'}zij (${Math.max(avg.pos.zl, avg.pos.zr)}% tegen ${Math.min(avg.pos.zl, avg.pos.zr)}%). Dat kan klachten aan één kant verklaren.`);
    inz.push(`Je wisselt gemiddeld ${avg.wissel} keer per nacht van houding. ${avg.wissel > 44 ? 'Dat is onrustiger dan gemiddeld (ongeveer 38 keer): je zoekt waarschijnlijk naar een comfortabele ligging.' : 'Dat is een normaal, gezond aantal: bewegen hoort bij goed slapen.'}`);
    inz.push(`Je bedklimaat liep op tot ${String(avg.tempMax).replace('.', ',')} °C bij ${avg.vocht}% luchtvochtigheid. ${avg.tempMax > 33.6 ? 'Dat is warmer dan de comfortzone van ongeveer 32–33 °C.' : avg.tempMax < 31.5 ? 'Dat is aan de koele kant.' : 'Dat zit mooi in de comfortzone.'}`);
    const uren = Math.floor(avg.inBed / 60), min = avg.inBed % 60;
    inz.push(`Je ligt gemiddeld ${uren} uur en ${min} minuten in bed, waarvan ${avg.rustig}% rustig. ${s.bedtijd ? `Je vaste ritme (${s.bedtijd}–${s.opstaan}) helpt je biologische klok.` : ''}`);
    if (Number(s.matrasLeeftijd) >= 10) inz.push(`Je matras is ${s.matrasLeeftijd} jaar oud. Na 8 tot 10 jaar verliest een matras vaak zijn ondersteuning, zeker in de heupzone.`);
    if (k.length && !k.includes('geen')) inz.push(`Je gaf ${k.join(', ')}klachten aan. Het advies hieronder past de zones ${k.includes('lage rug') ? 'taille en lende' : ''}${k.includes('lage rug') && (k.includes('schouder') || k.includes('nek')) ? ' en ' : ''}${k.includes('schouder') || k.includes('nek') || k.includes('slapende armen') ? 'nek en schouder' : ''}${k.includes('heup') ? ' en bekken' : ''} daarop aan.`);

    return {
      gemeten: new Date().toISOString(), herhaal: !!opts.herhaal, nights, avg, temp, beweging,
      inzichten: inz.slice(0, 6),
      advies: {
        blocks, model: 'Blocks M400', tijk: tijk.tijk, tijkReden: tijk.reden, kussen: adviseKussen(s, avg.pos),
        lengte: Math.ceil(((Number(s.lengte) || 175) + 25) / 10) * 10
      },
      score: Math.round(clamp(avg.rustig - (avg.wissel - 38) * 0.6 - (avg.tempMax > 33.6 ? 6 : 0), 30, 96))
    };
  }

  /* ---------------- catalogus & prijzen (indicatief, POC) ---------------- */
  const CATALOG = {
    breedtes: {
      1: [80, 90, 100, 120, 140],
      2: [140, 160, 180, 200]
    },
    lengtes: [200, 210, 220, 230, 240],
    modellen: [
      { key: 'M400', naam: 'Blocks M400', sub: '7 cm comfortschuim met schouderprofilering', factor: 1 },
      { key: 'M500', naam: 'Blocks M500', sub: '7 cm natuurlatex in zones', factor: 1.118 }
    ],
    tijken: [
      { key: 'Wool', naam: 'Wool', sub: 'Tencel met zuivere scheerwol · standaard', prijs: 0 },
      { key: 'Wash', naam: 'Wash', sub: 'Gequilt met Dracon · wasbaar op 40 °C', prijs: 0 },
      { key: 'Clima', naam: 'Clima', sub: 'Extra dun Tencel en 3D · voor warme slapers', prijs: 99 }
    ],
    bodems: [
      { key: 'vast', naam: 'Blockspring B2000 vlak', sub: 'Instelbare pocketveringkern, ook in de bodem', prijs: 0 },
      { key: 'elektrisch', naam: 'B2000 elektrisch verstelbaar', sub: 'Rug- en voetdeel per persoon verstelbaar', prijs: 1195, perHelft: true },
      { key: 'hooglaag', naam: 'B2000 hoog-laag', sub: 'Hele bed elektrisch omhoog: makkelijk instappen', prijs: 1495 }
    ],
    hoogtes: [{ key: 19, naam: '19 cm', prijs: 0 }, { key: 26, naam: '26 cm (hogere instap)', prijs: 149 }],
    hoofdborden: [
      { key: 'geen', naam: 'Geen hoofdbord', prijs: 0 },
      { key: 'strak', naam: 'Strak', prijs: 349 },
      { key: 'banen', naam: 'Verticale banen', prijs: 499 },
      { key: 'capitonne', naam: 'Capitonné', prijs: 649 },
      { key: 'vleugel', naam: 'Vleugel (met oren)', prijs: 749 }
    ],
    stoffen: [
      { key: 'antraciet', naam: 'Antraciet', hex: '#3d3c3e', prijs: 0 },
      { key: 'lichtgrijs', naam: 'Lichtgrijs', hex: '#b9b8b5', prijs: 0 },
      { key: 'zand', naam: 'Zand', hex: '#cbbca6', prijs: 0 },
      { key: 'taupe', naam: 'Taupe', hex: '#8e8076', prijs: 0 },
      { key: 'oceaan', naam: 'Oceaanblauw', hex: '#2f4b63', prijs: 0 },
      { key: 'olijf', naam: 'Olijfgroen', hex: '#6b6f45', prijs: 0 },
      { key: 'terra', naam: 'Terracotta', hex: '#a65a3c', prijs: 0 },
      { key: 'boucle', naam: 'Bouclé ecru', hex: '#e7e1d6', prijs: 149, textuur: true }
    ],
    poten: [
      { key: 'zwart', naam: 'Zwart metaal, 12 cm', prijs: 0, kleur: '#1d1d1d', vorm: 'cyl' },
      { key: 'eiken', naam: 'Eiken rond, 12 cm', prijs: 79, kleur: '#b98a57', vorm: 'cone' },
      { key: 'messing', naam: 'Messing, 12 cm', prijs: 129, kleur: '#c2a14d', vorm: 'cyl' },
      { key: 'plint', naam: 'Plint rondom', prijs: 99, kleur: null, vorm: 'plint' },
      { key: 'zwevend', naam: 'Zwevend (verborgen poot)', prijs: 149, kleur: '#111', vorm: 'float' }
    ],
    extras: [
      { key: 'kussen', naam: 'SlaapID-kussen op advies', prijs: 89, perPersoon: true },
      { key: 'dekbed', naam: '4-seizoenen dekbed', prijs: 329, perBed: true },
      { key: 'molton', naam: 'Hoeslaken-molton', prijs: 49, perMatras: true }
    ]
  };

  function matrasPrijs(model, w, l) {
    const m = CATALOG.modellen.find(x => x.key === model) || CATALOG.modellen[0];
    const p = 1699 * Math.pow(w / 90, 0.92) * (1 + (l - 200) / 200 * 0.85) * m.factor;
    return Math.round(p / 10) * 10 - 1;
  }
  function bodemPrijs(w, l) { return Math.round(1399 * Math.pow(w / 90, 0.9) * (1 + (l - 200) / 200 * 0.7) / 10) * 10 - 1; }

  function priceLines(c, onderzoekKorting) {
    const lines = [];
    const n = c.personen === 2 ? 2 : 1;
    const mw = n === 2 ? c.breedte / 2 : c.breedte;
    const model = CATALOG.modellen.find(x => x.key === c.model) || CATALOG.modellen[0];
    const tijken = (c.tijken && c.tijken.length >= n ? c.tijken.slice(0, n) : Array(n).fill(c.tijk)).map(k => CATALOG.tijken.find(x => x.key === k) || CATALOG.tijken[0]);
    if (n === 2 && tijken[0].key === tijken[1].key) {
      lines.push({ label: `2× ${model.naam} ${mw}×${c.lengte} cm, tijk ${tijken[0].naam}`, bedrag: 2 * (matrasPrijs(model.key, mw, c.lengte) + tijken[0].prijs) });
    } else {
      tijken.forEach((t, i) => lines.push({ label: `${model.naam} ${mw}×${c.lengte} cm, tijk ${t.naam}${n === 2 ? (c.namen ? ' (' + c.namen[i] + ')' : (i ? ' (rechts)' : ' (links)')) : ''}`, bedrag: matrasPrijs(model.key, mw, c.lengte) + t.prijs }));
    }
    const bodem = CATALOG.bodems.find(x => x.key === c.bodem) || CATALOG.bodems[0];
    let bp = n * bodemPrijs(mw, c.lengte) + (bodem.perHelft ? n * bodem.prijs : bodem.prijs);
    const h = CATALOG.hoogtes.find(x => x.key === Number(c.hoogte)) || CATALOG.hoogtes[0];
    bp += h.prijs;
    lines.push({ label: `${bodem.naam}, ${c.breedte}×${c.lengte}, ${h.naam}`, bedrag: bp });
    const hb = CATALOG.hoofdborden.find(x => x.key === c.hoofdbord) || CATALOG.hoofdborden[0];
    if (hb.prijs) lines.push({ label: `Hoofdbord ${hb.naam}`, bedrag: Math.round(hb.prijs * (c.breedte > 160 ? 1.2 : 1)) });
    const st = CATALOG.stoffen.find(x => x.key === c.stof) || CATALOG.stoffen[0];
    if (st.prijs) lines.push({ label: `Meubelstof ${st.naam}`, bedrag: st.prijs });
    const pt = CATALOG.poten.find(x => x.key === c.poten) || CATALOG.poten[0];
    if (pt.prijs) lines.push({ label: `Poten: ${pt.naam}`, bedrag: pt.prijs });
    const ex = c.extras || {};
    CATALOG.extras.forEach(e => {
      if (!ex[e.key]) return;
      const q = e.perPersoon ? n : e.perMatras ? n : 1;
      lines.push({ label: `${q > 1 ? q + '× ' : ''}${e.naam}`, bedrag: q * e.prijs });
    });
    lines.push({ label: 'Bezorgen, monteren en blokken afstellen bij jou thuis', bedrag: 0 });
    const subtotaal = lines.reduce((a, x) => a + x.bedrag, 0);
    const korting = onderzoekKorting || 0;
    return { lines, subtotaal, korting, totaal: subtotaal - korting };
  }

  /* ---------------- SVG: matras bovenaanzicht ---------------- */
  function bodyPath(W, L, bouw) {
    const cx = W / 2, s = Math.min(W, 100) / 90;
    const sh = (bouw === 'schouders' ? 25 : bouw === 'heupen' ? 19 : 22) * s;
    const wa = 14 * s;
    const hp = (bouw === 'heupen' ? 23 : bouw === 'schouders' ? 17 : 19) * s;
    const y = f => f * L / 200;
    const pts = [[cx - 5 * s, y(22)], [cx - sh, y(29)], [cx - sh * 0.86, y(52)], [cx - wa, y(92)], [cx - hp, y(114)], [cx - 11 * s, y(160)], [cx - 4 * s, y(194)],
      [cx + 4 * s, y(194)], [cx + 11 * s, y(160)], [cx + hp, y(114)], [cx + wa, y(92)], [cx + sh * 0.86, y(52)], [cx + sh, y(29)], [cx + 5 * s, y(22)]];
    return `<ellipse cx="${cx}" cy="${y(12)}" rx="${8 * s}" ry="${y(10)}" /><polygon points="${pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" />`;
  }

  // Eén matras (in cm-eenheden), blokken van hoofd (boven) naar voeten
  function mattressGroup(levels, W, L, x0, opts) {
    opts = opts || {};
    const zh = L / 10, gap = 0.9;
    let g = `<g transform="translate(${x0},0)">`;
    g += `<rect x="0" y="0" width="${W}" height="${L}" rx="4" fill="#141414"/>`;
    levels.forEach((lv, i) => {
      const L0 = LEVELS[lv];
      const tip = `${opts.naam ? opts.naam + ' · ' : ''}Zone ${i + 1} ${ZONES[i]}: ${L0.label}`;
      g += `<rect class="blk" data-zone="${i}" data-side="${opts.side || ''}" data-tip="${esc(tip)}" x="${2.5}" y="${2.5 + i * (L - 5) / 10}" width="${W - 5}" height="${(L - 5) / 10 - gap}" rx="1.6" fill="${L0.color}"/>`;
      g += `<text x="${W - 6}" y="${2.5 + i * (L - 5) / 10 + zh / 2 + 2}" text-anchor="end" font-size="${Math.min(7, W / 11)}" font-weight="700" style="fill:${L0.text}" pointer-events="none">${L0.kort}</text>`;
    });
    if (opts.body !== false) g += `<g fill="#ffffff" opacity=".92" pointer-events="none">${bodyPath(W, L, opts.bouw)}</g>`;
    if (opts.naam) g += `<text x="${W / 2}" y="${L + 12}" text-anchor="middle" font-size="8" font-weight="600" fill="#231f20">${esc(opts.naam)}</text>`;
    g += `</g>`;
    return g;
  }

  /* sides: [{levels, naam, bouw}] ; breedte/lengte in cm */
  function mattressSVG(sides, breedte, lengte, opts) {
    opts = opts || {};
    const n = sides.length;
    const W = breedte / n;
    const pad = 4;
    const totalW = breedte + (n - 1) * 3 + pad * 2;
    let g = '';
    sides.forEach((s, i) => { g += mattressGroup(s.levels, W, lengte, pad + i * (W + 3), { naam: s.naam, bouw: s.bouw, side: i, body: opts.body }); });
    return `<svg class="chart mattress-svg" viewBox="0 -2 ${totalW} ${lengte + (opts.labels === false ? 4 : 18)}" role="img" aria-label="Bovenaanzicht van de blokinstelling">${g}</svg>`;
  }

  /* ---------------- SVG: bed vooraanzicht & zijaanzicht ---------------- */
  function headboardShape(type, x, y, w, h, fill) {
    const dark = shade(fill, -18);
    if (type === 'geen') return '';
    if (type === 'strak') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${fill}" stroke="${dark}" stroke-width=".6"/>`;
    if (type === 'banen') {
      const n = Math.round(w / 16); let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}"/>`;
      for (let i = 1; i < n; i++) s += `<line x1="${x + i * w / n}" y1="${y + 2}" x2="${x + i * w / n}" y2="${y + h - 2}" stroke="${dark}" stroke-width=".8"/>`;
      return s;
    }
    if (type === 'capitonne') {
      let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${fill}"/>`;
      for (let r = 0; r < 3; r++) for (let c = 0; c < Math.round(w / 18); c++) {
        const cx = x + 9 + c * 18 + (r % 2 ? 9 : 0); if (cx > x + w - 5) continue;
        s += `<circle cx="${cx}" cy="${y + 12 + r * (h - 24) / 2}" r="1.3" fill="${dark}"/>`;
      }
      return s;
    }
    if (type === 'vleugel') {
      return `<path d="M${x - 12},${y + h} L${x - 12},${y + 14} Q${x - 12},${y} ${x + 6},${y} L${x + w - 6},${y} Q${x + w + 12},${y} ${x + w + 12},${y + 14} L${x + w + 12},${y + h} Z" fill="${fill}" stroke="${dark}" stroke-width=".6"/>` +
        `<line x1="${x}" y1="${y + 6}" x2="${x}" y2="${y + h}" stroke="${dark}" stroke-width=".6"/><line x1="${x + w}" y1="${y + 6}" x2="${x + w}" y2="${y + h}" stroke="${dark}" stroke-width=".6"/>`;
    }
    return '';
  }
  function shade(hex, pct) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = v => clamp(Math.round(v + (pct / 100) * (pct < 0 ? v : 255 - v)), 0, 255);
    return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function legs(type, x, y, w) {
    const p = CATALOG.poten.find(q => q.key === type) || CATALOG.poten[0];
    if (p.vorm === 'plint') return { svg: '', lift: 0, plint: true };
    if (p.vorm === 'float') return { svg: `<rect x="${x + 18}" y="${y}" width="${w - 36}" height="10" fill="#111"/>`, lift: 10 };
    const lh = 12; let s = '';
    [x + 5, x + w - 9].forEach(px => {
      if (p.vorm === 'cone') s += `<path d="M${px - 1},${y} L${px + 5},${y} L${px + 3.5},${y + lh} L${px + 0.5},${y + lh} Z" fill="${p.kleur}"/>`;
      else s += `<rect x="${px}" y="${y}" width="4" height="${lh}" rx="1" fill="${p.kleur}"/>`;
    });
    return { svg: s, lift: lh };
  }

  function bedFrontSVG(c) {
    const st = CATALOG.stoffen.find(x => x.key === c.stof) || CATALOG.stoffen[0];
    const W = c.breedte, x = (260 - W) / 2;
    const ground = 150;
    const L = legs(c.poten, x, 0, W);
    const baseH = Number(c.hoogte) || 19;
    const baseY = ground - L.lift - baseH;
    const matY = baseY - 25;
    const hbTop = c.hoofdbord === 'vleugel' ? matY - 62 : matY - 55;
    let s = `<svg class="chart" viewBox="0 0 260 162" role="img" aria-label="Vooraanzicht van het bed">`;
    s += `<rect x="0" y="${ground}" width="260" height="12" fill="#d9d3ca"/>`;
    s += `<ellipse cx="130" cy="${ground}" rx="${W / 2 + 12}" ry="3" fill="rgba(0,0,0,.12)"/>`;
    s += headboardShape(c.hoofdbord, x - 2, hbTop, W + 4, ground - L.lift - hbTop - 4, st.hex);
    s += legs(c.poten, x, ground - L.lift, W).svg;
    s += `<rect x="${x}" y="${baseY}" width="${W}" height="${baseH + (L.plint ? L.lift : 0)}" rx="2" fill="${st.hex}"/>`;
    s += `<rect x="${x}" y="${baseY}" width="${W}" height="2" fill="${shade(st.hex, -15)}"/>`;
    if (c.personen === 2) s += `<line x1="130" y1="${baseY + 3}" x2="130" y2="${baseY + baseH}" stroke="${shade(st.hex, -22)}" stroke-width=".7"/>`;
    const n = c.personen === 2 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const mw = W / n;
      s += `<rect x="${x + i * mw + 0.6}" y="${matY}" width="${mw - 1.2}" height="25" rx="4" fill="#f7f7f5" stroke="#d9d9d4" stroke-width=".6"/>`;
      for (let q = 1; q < 6; q++) s += `<line x1="${x + i * mw + 3}" y1="${matY + q * 4.1}" x2="${x + (i + 1) * mw - 3}" y2="${matY + q * 4.1}" stroke="#e9e9e4" stroke-width=".5"/>`;
      s += `<rect x="${x + i * mw + 5}" y="${matY + 19}" width="8" height="3" fill="#c9302c"/>`;
    }
    s += `<text x="130" y="12" text-anchor="middle" font-size="6">${W} × ${c.lengte} cm · totale hoogte ca. ${Math.round(L.lift + baseH + 25)} cm instap</text>`;
    s += `</svg>`;
    return s;
  }

  function bedSideSVG(c) {
    const st = CATALOG.stoffen.find(x => x.key === c.stof) || CATALOG.stoffen[0];
    const Lg = c.lengte, x = (300 - Lg) / 2, ground = 110;
    const L = legs(c.poten, x, 0, Lg);
    const baseH = Number(c.hoogte) || 19;
    const lift = c.bodem === 'hooglaag' && c.hoog ? 22 : 0;
    const baseY = ground - L.lift - baseH - lift;
    const matY = baseY - 25;
    let s = `<svg class="chart" viewBox="0 0 300 120" role="img" aria-label="Zijaanzicht van het bed">`;
    s += `<rect x="0" y="${ground}" width="300" height="10" fill="#d9d3ca"/>`;
    if (c.hoofdbord !== 'geen') s += `<rect x="${x - 8}" y="${matY - 52}" width="8" height="${ground - L.lift - (matY - 52)}" rx="2" fill="${shade(st.hex, -10)}"/>`;
    s += legs(c.poten, x, ground - L.lift, Lg).svg;
    if (lift) s += `<rect x="${x + 30}" y="${ground - L.lift - lift}" width="${Lg - 60}" height="${lift}" fill="#888" opacity=".5"/>`;
    s += `<rect x="${x}" y="${baseY}" width="${Lg}" height="${baseH + (L.plint ? L.lift : 0)}" rx="2" fill="${st.hex}"/>`;
    if (c.bodem === 'elektrisch' && c.verstel) {
      const hx = x + 4, hl = Lg * 0.36, ang = -24;
      s += `<g transform="rotate(${ang} ${hx + hl} ${matY + 25})"><rect x="${hx}" y="${matY}" width="${hl}" height="25" rx="4" fill="#f7f7f5" stroke="#d9d9d4" stroke-width=".6"/></g>`;
      s += `<rect x="${hx + hl}" y="${matY}" width="${Lg - hl - 8}" height="25" rx="4" fill="#f7f7f5" stroke="#d9d9d4" stroke-width=".6"/>`;
    } else {
      s += `<rect x="${x + 1}" y="${matY}" width="${Lg - 2}" height="25" rx="4" fill="#f7f7f5" stroke="#d9d9d4" stroke-width=".6"/>`;
      // blokken zichtbaar in doorsnede
      for (let i = 0; i < 10; i++) {
        const lv = (c.blocks && c.blocks[0] ? c.blocks[0][i] : 2);
        s += `<rect x="${x + 4 + i * (Lg - 8) / 10}" y="${matY + 9}" width="${(Lg - 8) / 10 - 1}" height="12" rx="1" fill="${LEVELS[lv].color}" opacity=".9"/>`;
      }
    }
    s += `<text x="${x + Lg - 2}" y="${matY - 4}" text-anchor="end" font-size="7" fill="#6b7280">doorsnede: 7 cm comfortlaag · instelbare blokkenkern · onderlaag</text>`;
    s += `</svg>`;
    return s;
  }

  /* ---------------- grafieken ---------------- */
  const POS = [
    { key: 'rug', label: 'Rug', color: '#2a78d6' },
    { key: 'zl', label: 'Zij links', color: '#eb6834' },
    { key: 'zr', label: 'Zij rechts', color: '#1baf7a' },
    { key: 'buik', label: 'Buik', color: '#eda100' }
  ];

  function legendHTML(items) {
    return `<div class="legend">${items.map(i => `<span><i style="background:${i.color}"></i>${esc(i.label)}</span>`).join('')}</div>`;
  }

  function posChart(nights) {
    const W = 560, rowH = 30, top = 6, left = 64, right = 10;
    const iw = W - left - right;
    const H = top + nights.length * (rowH + 12) + 18;
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Verdeling van slaaphoudingen per nacht">`;
    [0, 25, 50, 75, 100].forEach(p => {
      const x = left + iw * p / 100;
      s += `<line class="grid" x1="${x}" y1="${top}" x2="${x}" y2="${H - 18}"/><text x="${x}" y="${H - 4}" text-anchor="middle">${p}%</text>`;
    });
    nights.forEach((nt, i) => {
      const y = top + i * (rowH + 12);
      s += `<text x="${left - 10}" y="${y + rowH / 2 + 4}" text-anchor="end" font-weight="600">Nacht ${nt.n}</text>`;
      let x = left;
      POS.forEach((p, j) => {
        const w = iw * nt.pos[p.key] / 100;
        const gw = Math.max(0, w - (j < POS.length - 1 ? 2 : 0));
        s += `<rect data-tip="Nacht ${nt.n} · ${p.label}: ${nt.pos[p.key]}%" x="${x}" y="${y}" width="${gw}" height="${rowH}" rx="${j === 0 || j === 3 ? 4 : 0}" fill="${p.color}"/>`;
        if (w > 34) s += `<text x="${x + gw / 2}" y="${y + rowH / 2 + 4}" text-anchor="middle" fill="${p.key === 'buik' ? '#0b0b0b' : '#fff'}" font-weight="600" pointer-events="none" style="fill:${p.key === 'buik' ? '#0b0b0b' : '#fff'}">${nt.pos[p.key]}%</text>`;
        x += w;
      });
    });
    s += `</svg>`;
    return legendHTML(POS) + s;
  }

  function barChart(data, opts) {
    // data: [{label, v}] ; opts: {ref, refLabel, unit, color, height}
    const W = 560, H = opts.height || 190, left = 34, right = 10, top = 14, bottom = 24;
    const iw = W - left - right, ih = H - top - bottom;
    const max = Math.max(opts.max || 0, ...data.map(d => d.v), opts.ref || 0) * 1.12;
    const step = niceStep(max);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || '')}">`;
    for (let v = 0; v <= max; v += step) {
      const y = top + ih - ih * v / max;
      s += `<line class="grid" x1="${left}" y1="${y}" x2="${W - right}" y2="${y}"/><text x="${left - 6}" y="${y + 4}" text-anchor="end">${v}</text>`;
    }
    const bw = iw / data.length;
    const thin = Math.min(bw * 0.62, opts.maxBar || 60);
    data.forEach((d, i) => {
      const h = ih * d.v / max, x = left + i * bw + (bw - thin) / 2, y = top + ih - h;
      s += `<rect x="${left + i * bw}" y="${top}" width="${bw}" height="${ih}" fill="transparent" data-tip="${esc(d.label)}: ${d.v}${opts.unit || ''}"/>`;
      s += `<path d="M${x},${top + ih} L${x},${y + Math.min(4, h)} Q${x},${y} ${x + Math.min(4, h)},${y} L${x + thin - Math.min(4, h)},${y} Q${x + thin},${y} ${x + thin},${y + Math.min(4, h)} L${x + thin},${top + ih} Z" fill="${opts.color || '#2a78d6'}" pointer-events="none"/>`;
      if (opts.valueLabels) s += `<text x="${x + thin / 2}" y="${y - 5}" text-anchor="middle" font-weight="600" pointer-events="none">${d.v}</text>`;
      if (!opts.sparseX || i % opts.sparseX === 0) s += `<text x="${left + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
    });
    s += `<line class="axis" x1="${left}" y1="${top + ih}" x2="${W - right}" y2="${top + ih}"/>`;
    if (opts.ref) {
      const y = top + ih - ih * opts.ref / max;
      s += `<line x1="${left}" y1="${y}" x2="${W - right}" y2="${y}" stroke="#231f20" stroke-dasharray="4 3" stroke-width="1"/>`;
      s += `<text x="${W - right}" y="${y - 5}" text-anchor="end" style="fill:#231f20" font-weight="600">${esc(opts.refLabel || '')}</text>`;
    }
    s += `</svg>`;
    return s;
  }

  function lineChart(data, opts) {
    const W = 560, H = opts.height || 200, left = 38, right = 12, top = 14, bottom = 24;
    const iw = W - left - right, ih = H - top - bottom;
    const lo = Math.floor(Math.min(...data.map(d => d.v), opts.bandLo || 99) - 0.5), hi = Math.ceil(Math.max(...data.map(d => d.v), opts.bandHi || 0) + 0.5);
    const X = i => left + iw * i / (data.length - 1), Y = v => top + ih - ih * (v - lo) / (hi - lo);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || '')}">`;
    for (let v = lo; v <= hi; v++) s += `<line class="grid" x1="${left}" y1="${Y(v)}" x2="${W - right}" y2="${Y(v)}"/><text x="${left - 6}" y="${Y(v) + 4}" text-anchor="end">${v}°</text>`;
    if (opts.bandLo) {
      s += `<rect x="${left}" y="${Y(opts.bandHi)}" width="${iw}" height="${Y(opts.bandLo) - Y(opts.bandHi)}" fill="#b4cc04" opacity=".16"/>`;
      s += `<text x="${left + 6}" y="${Y(opts.bandHi) + 12}" style="fill:#5a614d" font-weight="600">comfortzone ${opts.bandLo}–${opts.bandHi} °C</text>`;
    }
    s += `<path d="${data.map((d, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(d.v).toFixed(1)).join(' ')}" fill="none" stroke="${opts.color || '#eb6834'}" stroke-width="2" stroke-linejoin="round"/>`;
    const every = Math.ceil(data.length / 8);
    data.forEach((d, i) => {
      const hw = iw / (data.length - 1) / 2;
      s += `<rect x="${X(i) - hw}" y="${top}" width="${hw * 2}" height="${ih}" fill="transparent" data-tip="${d.t}: ${String(d.v).replace('.', ',')} °C" data-x="${X(i)}" data-y="${Y(d.v)}"/>`;
      if (i % every === 0) s += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${d.t}</text>`;
    });
    s += `<line class="axis" x1="${left}" y1="${top + ih}" x2="${W - right}" y2="${top + ih}"/>`;
    s += `<circle class="hover-dot" r="4.5" fill="${opts.color || '#eb6834'}" stroke="#fff" stroke-width="2" style="display:none"/>`;
    s += `</svg>`;
    return s;
  }

  function niceStep(max) { const raw = max / 4; const p = Math.pow(10, Math.floor(Math.log10(raw))); const n = raw / p; return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p; }

  /* hover-tooltip voor elementen met data-tip binnen .chart-wrap */
  function bindTips(root) {
    (root || document).querySelectorAll('.chart-wrap').forEach(wrap => {
      if (wrap._tips) return; wrap._tips = true;
      let tip = wrap.querySelector('.tooltip');
      if (!tip) { tip = document.createElement('div'); tip.className = 'tooltip'; wrap.appendChild(tip); }
      wrap.addEventListener('mousemove', e => {
        const t = e.target.closest('[data-tip]');
        const dot = wrap.querySelector('.hover-dot');
        if (!t) { tip.classList.remove('show'); if (dot) dot.style.display = 'none'; return; }
        const r = wrap.getBoundingClientRect();
        tip.textContent = t.getAttribute('data-tip');
        tip.style.left = (e.clientX - r.left) + 'px';
        tip.style.top = (e.clientY - r.top - 6) + 'px';
        tip.classList.add('show');
        if (dot && t.dataset.x) { dot.setAttribute('cx', t.dataset.x); dot.setAttribute('cy', t.dataset.y); dot.style.display = ''; }
      });
      wrap.addEventListener('mouseleave', () => { tip.classList.remove('show'); const dot = wrap.querySelector('.hover-dot'); if (dot) dot.style.display = 'none'; });
    });
  }

  function blocksLegend() {
    return `<div class="blocks-legend">${LEVELS.map(l => `<span><i style="background:${l.color}"></i>${l.label}</span>`).join('')}</div>`;
  }

  window.SSM = {
    LEVELS, ZONES, PRESETS, CATALOG, POS, simulate, adviseBlocks, matrasPrijs, bodemPrijs, priceLines,
    mattressSVG, bedFrontSVG, bedSideSVG, posChart, barChart, lineChart, bindTips, blocksLegend, legendHTML, rng
  };
})();
