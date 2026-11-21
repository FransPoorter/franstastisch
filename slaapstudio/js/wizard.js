/* Aanvraagwizard SlaapID – vragenlijst per slaper, huidig bed, thuismeting, betaling */
(function () {
  'use strict';
  const { STORE, $, $$, esc, eur, mount, newCode, saveDossier, addEvent, rememberDossier, isoDay, addDays, fmtDate, qs } = SS;
  mount('aanvragen');

  const DRAFT = 'slaapstudio.draft';
  let st;
  try { st = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (e) { st = null; }
  if (!st || qs('nieuw') !== null) st = null;
  st = st || { step: 0, personen: Number(qs('personen')) === 2 ? 2 : null, sleepers: [{ id: 'A' }, { id: 'B' }], bed: {}, meting: {}, contact: {} };
  const persist = () => { try { localStorage.setItem(DRAFT, JSON.stringify(st)); } catch (e) {} };

  /* ---------- veldhelpers ---------- */
  const radio = (name, opts, val, cls) => `<div class="choices ${cls || ''}">${opts.map(o => {
    const [v, l, sub, ico] = Array.isArray(o) ? o : [o, o];
    return `<label class="choice"><input type="radio" name="${name}" value="${esc(v)}" ${String(val) === String(v) ? 'checked' : ''}><span>${ico ? `<span class="ico">${ico}</span>` : ''}${l}${sub ? `<small>${sub}</small>` : ''}</span></label>`;
  }).join('')}</div>`;
  const checks = (name, opts, vals) => `<div class="choices">${opts.map(o => {
    const [v, l, sub] = Array.isArray(o) ? o : [o, o];
    return `<label class="choice"><input type="checkbox" name="${name}" value="${esc(v)}" ${(vals || []).includes(v) ? 'checked' : ''}><span>${l}${sub ? `<small>${sub}</small>` : ''}</span></label>`;
  }).join('')}</div>`;
  const input = (name, type, val, attrs) => `<input type="${type}" name="${name}" id="f-${name}" value="${esc(val == null ? '' : val)}" ${attrs || ''}>`;
  const field = (label, html, hint, req) => `<div class="field"><label>${label}${req ? ' *' : ''}${hint ? ` <span class="hint">${hint}</span>` : ''}</label>${html}</div>`;
  const scale = (name, val, lo, hi) => `<div class="scale">${[1, 2, 3, 4, 5].map(n => `<label class="choice"><input type="radio" name="${name}" value="${n}" ${Number(val) === n ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div><div style="display:flex;justify-content:space-between" class="small muted"><span>${lo}</span><span>${hi}</span></div>`;

  const HOUDING = [['rug', 'Op mijn rug', '', '🛌'], ['zij', 'Op mijn zij', '', '🧍'], ['buik', 'Op mijn buik', '', '⬇'], ['wisselend', 'Wisselend', 'geen vaste houding', '🔄']];

  /* ---------- stappen ---------- */
  function steps() {
    const s = [{ key: 'start', label: 'Wie slaapt er?' }];
    const n = st.personen || 1;
    for (let i = 0; i < n; i++) {
      const nm = st.sleepers[i].naam || (i ? 'Slaper 2' : 'Slaper 1');
      s.push({ key: 'over', i, label: `${nm}: over jou` });
      s.push({ key: 'slaap', i, label: `${nm}: zo slaap je` });
      s.push({ key: 'klachten', i, label: `${nm}: klachten` });
    }
    s.push({ key: 'bed', label: n === 2 ? 'Jullie huidige bed' : 'Je huidige bed' });
    s.push({ key: 'meting', label: 'Thuismeting & gegevens' });
    s.push({ key: 'betalen', label: 'Afrekenen' });
    s.push({ key: 'klaar', label: 'Bevestiging' });
    return s;
  }

  function sleeperHeader(i) {
    if ((st.personen || 1) < 2) return '';
    return `<div class="sleeper-tabs">${[0, 1].map(j => `<span class="sleeper-tab ${i === j ? 'active' : ''}">${esc(st.sleepers[j].naam || 'Slaper ' + (j + 1))}</span>`).join('')}</div>`;
  }

  const R = {
    start() {
      const a = st.sleepers[0], b = st.sleepers[1];
      return `<span class="kicker">Stap 1</span><h2>Wie gaan we meten?</h2>
        <p class="muted">Slaap je samen? Dan meten we jullie allebei, ieder met een eigen sensor. Zo krijgt ieder een eigen matrashelft die op de eigen slaap is afgesteld.</p>
        ${field('Voor hoeveel personen is het bed?', radio('personen', [['1', 'Alleen voor mij', '1 sensor · € 75', '🛏'], ['2', 'Voor ons tweeën', '2 sensoren · € 150', '👫']], st.personen), '', true)}
        <div class="row-2">
          ${field('Jouw voornaam', input('naamA', 'text', a.naam, 'required autocomplete="given-name"'), '', true)}
          <div id="naamB-wrap" class="${st.personen === 2 ? '' : 'hidden'}">${field('Voornaam partner', input('naamB', 'text', b.naam, 'autocomplete="off"'), '', true)}</div>
        </div>
        <div class="notice">Het onderzoek kost <b>€ 75 per slaper</b>. Koop je daarna een bed, dan verrekenen we het volledige bedrag.</div>`;
    },
    over(i) {
      const s = st.sleepers[i];
      return `${sleeperHeader(i)}<span class="kicker">Over ${esc(s.naam || 'jou')}</span><h2>Even kennismaken</h2>
        <p class="muted">Lengte, gewicht en lichaamsbouw bepalen hoe diep je schouders en heupen in het matras zakken.</p>
        <div class="row-3">
          ${field('Leeftijd', `<select name="leeftijd">${['', 'Jonger dan 30', '30 – 44', '45 – 59', '60 – 74', '75 of ouder'].map(o => `<option ${s.leeftijd === o ? 'selected' : ''} value="${o}">${o || 'Kies…'}</option>`).join('')}</select>`, '', true)}
          ${field('Lengte', input('lengte', 'number', s.lengte, 'min="130" max="220" placeholder="cm" required'), 'cm', true)}
          ${field('Gewicht', input('gewicht', 'number', s.gewicht, 'min="35" max="200" placeholder="kg" required'), 'kg', true)}
        </div>
        ${field('Hoe zou je je lichaamsbouw omschrijven?', radio('bouw', [['schouders', 'Schouders breder dan heupen', 'V-vorm'], ['normaal', 'Ongeveer even breed', 'recht'], ['heupen', 'Heupen breder dan schouders', 'A-vorm']], s.bouw, 'wide'), '', true)}
        ${field('Hoe vaak sport of beweeg je intensief?', radio('sport', [['nee', 'Zelden'], ['1-2', '1–2× per week'], ['3+', '3× of vaker'], ['top', 'Topsport / wedstrijden']], s.sport))}`;
    },
    slaap(i) {
      const s = st.sleepers[i];
      return `${sleeperHeader(i)}<span class="kicker">Zo slaapt ${esc(s.naam || 'je')}</span><h2>Hoe slaap je?</h2>
        <p class="muted">Vul in wat je denkt. De sensor laat straks zien hoe het echt zit. Dat verschil is vaak verrassend.</p>
        <div class="q-group">${field('In welke houding val je in slaap?', radio('houding', HOUDING, s.houding), '', true)}</div>
        <div class="q-group">${field('In welke houding word je meestal wakker?', radio('wakkerHouding', [...HOUDING.slice(0, 3), ['weet niet', 'Weet ik niet', '', '❓']], s.wakkerHouding))}</div>
        <div class="q-group row-2">
          ${field('Hoe laat ga je doordeweeks naar bed?', input('bedtijd', 'time', s.bedtijd || '23:00', 'required'), '', true)}
          ${field('Hoe laat sta je op?', input('opstaan', 'time', s.opstaan || '07:00', 'required'), '', true)}
        </div>
        <div class="q-group">${field('Hoe lang duurt het voor je in slaap valt?', radio('inslapen', [['<15', 'Binnen 15 min'], ['15-30', '15 – 30 min'], ['>30', 'Langer dan 30 min']], s.inslapen))}</div>
        <div class="q-group">${field('Hoe vaak word je ’s nachts wakker?', radio('wakker', [['0', 'Bijna nooit'], ['1-2', '1 – 2 keer'], ['3+', '3 keer of vaker']], s.wakker), '', true)}</div>
        <div class="q-group">${field('Hoe uitgerust word je wakker?', scale('uitgerust', s.uitgerust, 'Gebroken', 'Topfit'), '', true)}</div>
        <div class="q-group">${field('Hoe is je bedklimaat?', radio('klimaat', [['prima', 'Prima', '', '👌'], ['warm', 'Vaak te warm', '', '🔥'], ['zweten', 'Ik zweet ’s nachts', '', '💧'], ['koud', 'Vaak koud', '', '❄']], s.klimaat), '', true)}</div>`;
    },
    klachten(i) {
      const s = st.sleepers[i];
      return `${sleeperHeader(i)}<span class="kicker">Klachten</span><h2>Heb je last van je lichaam rond het slapen?</h2>
        <p class="muted">Een matras dat te hard, te zacht of niet passend is, kan klachten geven aan je lage rug, schouders, heupen en nek.</p>
        <div class="q-group">${field('Waar heb je last van?', checks('klachten', [['lage rug', 'Lage rug'], ['nek', 'Nek'], ['schouder', 'Schouder(s)'], ['heup', 'Heup(en)'], ['slapende armen', 'Slapende armen of handen'], ['hoofdpijn', 'Hoofdpijn bij wakker worden'], ['geen', 'Geen klachten']], s.klachten), 'meerdere mogelijk', true)}</div>
        <div id="klacht-detail" class="${(s.klachten || []).filter(k => k !== 'geen').length ? '' : 'hidden'}">
          <div class="q-group">${field('Wanneer heb je er last van?', radio('klachtMoment', [['wakker', 'Bij wakker worden', 'trekt weg na opstaan'], ['nacht', 'Ik word er ’s nachts wakker van'], ['dag', 'De hele dag']], s.klachtMoment, 'wide'))}</div>
          <div class="q-group">${field('Hoe erg is het?', `<input type="range" name="ernst" min="0" max="10" value="${s.ernst || 4}" oninput="this.nextElementSibling.textContent=this.value+' / 10'"><b>${s.ernst || 4} / 10</b>`)}</div>
          <div class="q-group">${field('Ben je hiervoor onder behandeling bij een (slaap)fysiotherapeut?', radio('fysio', [['ja', 'Ja'], ['nee', 'Nee']], s.fysio))}</div>
        </div>
        <div class="q-group">${field('Ben je allergisch voor huisstofmijt?', radio('allergie', [['ja', 'Ja'], ['nee', 'Nee'], ['weet niet', 'Weet ik niet']], s.allergie))}</div>`;
    },
    bed() {
      const b = st.bed;
      const duo = (st.personen || 1) === 2;
      return `<span class="kicker">Huidige situatie</span><h2>${duo ? 'Jullie' : 'Je'} huidige bed</h2>
        <p class="muted">Zo kunnen we de meting vergelijken met waar je nu op ligt.</p>
        <div class="q-group row-2">
          ${field('Hoe oud is het matras?', input('matrasLeeftijd', 'number', b.matrasLeeftijd, 'min="0" max="40" placeholder="jaar" required'), 'jaar', true)}
          ${field('Huidige maat', `<select name="huidigeMaat">${['', '80 × 200', '90 × 200', '90 × 210', '140 × 200', '160 × 200', '180 × 200', '180 × 210', '200 × 200', '200 × 220', 'Anders / weet niet'].map(o => `<option ${b.huidigeMaat === o ? 'selected' : ''} value="${o}">${o || 'Kies…'}</option>`).join('')}</select>`, '', true)}
        </div>
        <div class="q-group">${field('Wat voor matras is het?', radio('matrasType', [['pocketvering', 'Pocketvering'], ['koudschuim', 'Koudschuim'], ['traagschuim', 'Traagschuim'], ['latex', 'Latex'], ['waterbed', 'Waterbed'], ['weet niet', 'Weet ik niet']], b.matrasType))}</div>
        <div class="q-group">${field('Waar ligt het matras op?', radio('bodem', [['boxspring', 'Boxspring'], ['lattenbodem', 'Lattenbodem'], ['vlak', 'Vlakke bodem'], ['elektrisch', 'Elektrisch verstelbaar']], b.bodem))}</div>
        <div class="q-group">${field('Hoe ervaar je het matras?', radio('ervaring', [['te zacht', 'Te zacht'], ['goed', 'Prima'], ['te hard', 'Te hard'], ['kuil', 'Er zit een kuil in']], b.ervaring), '', true)}</div>
        <div class="q-group">${field('Wensen voor je nieuwe bed', checks('wensen', [['elektrisch', 'Elektrisch verstelbaar', 'lezen of tv kijken in bed'], ['hooginstap', 'Hoge instap', 'makkelijk in en uit bed'], ['langer', 'Langer bed'], ['breder', 'Breder bed']], b.wensen), 'optioneel')}</div>
        <div class="q-group">${field('Welk budget heb je in gedachten?', radio('budget', [['<3000', 'Tot € 3.000'], ['3000-5000', '€ 3.000 – 5.000'], ['5000-7500', '€ 5.000 – 7.500'], ['>7500', 'Meer dan € 7.500'], ['?', 'Weet ik nog niet']], b.budget))}</div>`;
    },
    meting() {
      const m = st.meting, c = st.contact;
      const n = st.personen || 1;
      const min = isoDay(addDays(new Date(), 2));
      return `<span class="kicker">Thuismeting</span><h2>Hoe wil je de sensor${n > 1 ? 'en' : ''} ontvangen?</h2>
        <p class="muted">Je slaapt <b>${STORE.nachten} nachten</b> met de SlaapID-sensor op je borst, gewoon in je eigen bed. Daarna stuur je hem terug of lever je hem in.</p>
        ${field('Bezorging', radio('methode', [['post', 'Thuisbezorgd per post', 'Retourlabel zit in de doos', '📦'], ['ophalen', 'Ophalen in de studio', `${STORE.straat}, ${STORE.plaats} · met korte uitleg`, '🏠']], m.methode, 'wide'), '', true)}
        <div class="row-2">
          ${field('Ophaal- of bezorgdag', input('datum', 'date', m.datum || min, `min="${min}" required`), '', true)}
          ${field('Wanneer wil je starten met meten?', input('start', 'date', m.start || isoDay(addDays(new Date(), 3)), `min="${min}"`))}
        </div>
        <div class="notice">Tip: kies drie gewone nachten. Dus niet op vakantie, niet ziek en zonder nachtdienst.</div>
        <h3 style="margin-top:30px">Je gegevens</h3>
        <div class="row-2">
          ${field('Volledige naam', input('naam', 'text', c.naam || st.sleepers[0].naam, 'autocomplete="name" required'), '', true)}
          ${field('E-mailadres', input('email', 'email', c.email, 'autocomplete="email" required'), 'hier sturen we je dossiercode heen', true)}
        </div>
        <div class="row-2">
          ${field('Telefoon', input('tel', 'tel', c.tel, 'autocomplete="tel" required'), '', true)}
          ${field('Straat en huisnummer', input('straat', 'text', c.straat, 'autocomplete="street-address" required'), '', true)}
        </div>
        <div class="row-2">
          ${field('Postcode', input('postcode', 'text', c.postcode, 'autocomplete="postal-code" required'), '', true)}
          ${field('Plaats', input('plaats', 'text', c.plaats, 'autocomplete="address-level2" required'), '', true)}
        </div>
        <div class="q-group">
          <label class="choice" style="display:block"><input type="checkbox" name="toestemming" value="ja" ${c.toestemming ? 'checked' : ''}><span>Ik geef uitdrukkelijk toestemming voor het verwerken van mijn slaapmeting${n > 1 ? ' (en die van mijn partner, met diens instemming)' : ''}. <small>Je slaapdata blijft in de beveiligde database van SlaapID. ${STORE.naam} bewaart alleen de status, je matrasinstelling en een link naar je rapport.</small></span></label>
          <label class="choice" style="display:block;margin-top:10px"><input type="checkbox" name="nieuwsbrief" value="ja" ${c.nieuwsbrief ? 'checked' : ''}><span>Stuur mij slaaptips en de nieuwsbrief <small>optioneel</small></span></label>
        </div>`;
    },
    betalen() {
      const n = st.personen || 1;
      const totaal = n * STORE.onderzoekPrijs;
      return `<span class="kicker">Afrekenen</span><h2>Overzicht van je aanvraag</h2>
        <table class="summary-table">
          ${st.sleepers.slice(0, n).map(s => `<tr><td>SlaapID-thuismeting voor <b>${esc(s.naam)}</b><br><span class="small muted">${STORE.nachten} nachten · rapport · persoonlijk matrasadvies</span></td><td>${SS.eur2(STORE.onderzoekPrijs)}</td></tr>`).join('')}
          <tr><td>${st.meting.methode === 'post' ? 'Verzending met retourlabel' : 'Ophalen in de studio Nijkerk'}</td><td>${SS.eur2(0)}</td></tr>
          <tr class="total"><td>Totaal</td><td>${SS.eur2(totaal)}</td></tr>
        </table>
        <div class="notice">Koop je binnen 6 maanden een Blocks-bed, dan verrekenen we deze <b>${eur(totaal)}</b> volledig.</div>
        <h3 style="margin-top:26px">Betaal met iDEAL</h3>
        <div class="pay-box">${['ING', 'Rabobank', 'ABN AMRO', 'ASN Bank', 'bunq', 'Triodos', 'SNS', 'Knab'].map((b, i) => `<label class="choice"><input type="radio" name="bank" value="${b}" ${(st.bank || 'ING') === b ? 'checked' : ''}><span style="align-items:center;text-align:center">${b}</span></label>`).join('')}</div>
        <p class="small muted" style="margin-top:14px">Dit is een demo: er wordt niets afgeschreven.</p>`;
    },
    klaar() {
      const d = SS.getDossier(st.dossierId);
      if (!d) return '<p>Er ging iets mis.</p>';
      const n = d.sleepers.length;
      return `<div class="center">
        <div style="font-size:3rem">🌙</div>
        <span class="kicker">Gelukt!</span>
        <h2>Bedankt ${esc(d.sleepers[0].naam)}, je SlaapID-meting is aangevraagd</h2>
        <p class="muted">Je betaling van ${SS.eur2(d.betaling.bedrag)} is ontvangen. Bewaar je dossiercode:</p>
        <div class="code-badge" style="margin:8px 0 22px">${d.id}</div>
        </div>
        <div class="notice dark">📧 We hebben een bevestiging gestuurd naar <b>${esc(d.contact.email)}</b>, met een link naar je dossier. <span class="small" style="opacity:.7">(gesimuleerd)</span></div>
        <h3>Zo gaat het verder</h3>
        <ol class="advice-list">
          <li>${d.sensor.methode === 'post' ? `We versturen ${n > 1 ? 'de sensoren' : 'de sensor'} zodat ${n > 1 ? 'ze' : 'hij'} op <b>${fmtDate(d.sensor.datum)}</b> bij je ${n > 1 ? 'zijn' : 'is'}.` : `${n > 1 ? 'De sensoren liggen' : 'De sensor ligt'} op <b>${fmtDate(d.sensor.datum)}</b> voor je klaar in de studio, ${STORE.straat} in ${STORE.plaats}.`}</li>
          <li>Je slaapt ${STORE.nachten} nachten met de sensor. Elke avond krijg je een korte herinnering.</li>
          <li>Je stuurt de sensor terug of levert hem in. Wij lezen de meting uit.</li>
          <li>Je ontvangt je rapport met advies. Bespreek het online, telefonisch of in de studio.</li>
        </ol>
        <div class="btn-row" style="margin-top:24px"><a class="btn btn-primary" href="dossier.html?code=${d.id}">Open mijn slaapdossier</a><a class="btn btn-ghost" href="index.html">Terug naar de Slaapstudio</a></div>`;
    }
  };

  /* ---------- opslaan van formulier naar state ---------- */
  function collect(stepDef) {
    const f = new FormData($('#wz-form'));
    const get = k => f.get(k);
    const all = k => f.getAll(k);
    const err = [];
    const need = (v, label) => { if (v == null || v === '') err.push(label); return v; };
    switch (stepDef.key) {
      case 'start':
        st.personen = Number(need(get('personen'), 'aantal personen')) || null;
        st.sleepers[0].naam = need((get('naamA') || '').trim(), 'je voornaam');
        if (st.personen === 2) st.sleepers[1].naam = need((get('naamB') || '').trim(), 'voornaam partner');
        break;
      case 'over': {
        const s = st.sleepers[stepDef.i];
        s.leeftijd = need(get('leeftijd'), 'leeftijd');
        s.lengte = need(get('lengte'), 'lengte');
        s.gewicht = need(get('gewicht'), 'gewicht');
        s.bouw = need(get('bouw'), 'lichaamsbouw');
        s.sport = get('sport');
        break;
      }
      case 'slaap': {
        const s = st.sleepers[stepDef.i];
        s.houding = need(get('houding'), 'inslaaphouding');
        s.wakkerHouding = get('wakkerHouding');
        s.bedtijd = need(get('bedtijd'), 'bedtijd');
        s.opstaan = need(get('opstaan'), 'opstaan');
        s.inslapen = get('inslapen');
        s.wakker = need(get('wakker'), 'hoe vaak je wakker wordt');
        s.uitgerust = need(get('uitgerust'), 'hoe uitgerust je bent');
        s.klimaat = need(get('klimaat'), 'bedklimaat');
        break;
      }
      case 'klachten': {
        const s = st.sleepers[stepDef.i];
        s.klachten = all('klachten');
        if (!s.klachten.length) err.push('klachten (of “geen klachten”)');
        s.klachtMoment = get('klachtMoment');
        s.ernst = get('ernst');
        s.fysio = get('fysio');
        s.allergie = get('allergie');
        break;
      }
      case 'bed':
        st.bed.matrasLeeftijd = need(get('matrasLeeftijd'), 'leeftijd matras');
        st.bed.huidigeMaat = need(get('huidigeMaat'), 'huidige maat');
        st.bed.matrasType = get('matrasType');
        st.bed.bodem = get('bodem');
        st.bed.ervaring = need(get('ervaring'), 'hoe je het matras ervaart');
        st.bed.wensen = all('wensen');
        st.bed.budget = get('budget');
        break;
      case 'meting':
        st.meting.methode = need(get('methode'), 'bezorging');
        st.meting.datum = need(get('datum'), 'datum');
        st.meting.start = get('start');
        ['naam', 'email', 'tel', 'straat', 'postcode', 'plaats'].forEach(k => st.contact[k] = need((get(k) || '').trim(), { naam: 'naam', email: 'e-mailadres', tel: 'telefoon', straat: 'adres', postcode: 'postcode', plaats: 'plaats' }[k]));
        if (st.contact.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(st.contact.email)) err.push('een geldig e-mailadres');
        st.contact.toestemming = get('toestemming') === 'ja';
        st.contact.nieuwsbrief = get('nieuwsbrief') === 'ja';
        if (!st.contact.toestemming) err.push('toestemming voor de slaapmeting');
        break;
      case 'betalen':
        st.bank = get('bank') || 'ING';
        break;
    }
    persist();
    return err;
  }

  function createDossier() {
    const n = st.personen || 1;
    const id = newCode();
    const now = new Date().toISOString();
    const sleepers = st.sleepers.slice(0, n).map(s => Object.assign({}, s, {
      matrasLeeftijd: st.bed.matrasLeeftijd, ervaring: st.bed.ervaring
    }));
    const d = {
      id, created: now,
      contact: Object.assign({}, st.contact),
      household: { personen: n, huidigeMaat: st.bed.huidigeMaat, matrasType: st.bed.matrasType, bodem: st.bed.bodem, ervaring: st.bed.ervaring, matrasLeeftijd: st.bed.matrasLeeftijd, wensen: st.bed.wensen || [], budget: st.bed.budget },
      sleepers,
      sensor: { methode: st.meting.methode, datum: st.meting.datum, start: st.meting.start, status: 'klaarzetten', aantal: n },
      betaling: { bedrag: n * STORE.onderzoekPrijs, betaald: true, methode: 'iDEAL · ' + st.bank, datum: now },
      meting: { nachten: 0, retour: false, uitgelezen: false },
      resultaten: {}, adviesVrijgegeven: false, configuratie: null, bestelling: null, levering: null, nazorg: null,
      events: []
    };
    addEvent(d, `Aanvraag ontvangen voor ${sleepers.map(s => s.naam).join(' en ')}`, 'klant', now);
    addEvent(d, `Betaling ${SS.eur2(d.betaling.bedrag)} ontvangen via iDEAL (${st.bank})`, 'systeem');
    addEvent(d, `Bevestigingsmail met dossiercode verstuurd naar ${d.contact.email}`, 'systeem');
    saveDossier(d);
    rememberDossier(id);
    st.dossierId = id;
    persist();
  }

  /* ---------- render ---------- */
  function render() {
    const S = steps();
    if (st.step >= S.length) st.step = S.length - 1;
    const cur = S[st.step];
    $('#wz-steps').innerHTML = S.map((s, i) => `<li class="${i < st.step ? 'done' : i === st.step ? 'current' : ''}"><span class="dot">${i < st.step ? '✓' : i + 1}</span><span class="label">${esc(s.label)}</span></li>`).join('');
    $('#wz-progress').style.width = Math.round(st.step / (S.length - 1) * 100) + '%';
    $('#wz-form').innerHTML = R[cur.key](cur.i) + '<div id="wz-err" class="notice sand hidden"></div>';
    $('#wz-back').style.visibility = st.step === 0 || cur.key === 'klaar' ? 'hidden' : 'visible';
    $('#wz-nav').style.display = cur.key === 'klaar' ? 'none' : '';
    $('#wz-next').textContent = cur.key === 'betalen' ? `Betaal ${SS.eur2((st.personen || 1) * STORE.onderzoekPrijs)} met iDEAL` : cur.key === 'meting' ? 'Naar afrekenen →' : 'Volgende →';
    // dynamiek
    $$('input[name=personen]').forEach(r => r.addEventListener('change', () => $('#naamB-wrap').classList.toggle('hidden', r.value !== '2')));
    $$('input[name=klachten]').forEach(cb => cb.addEventListener('change', () => {
      if (cb.value === 'geen' && cb.checked) $$('input[name=klachten]').forEach(x => { if (x.value !== 'geen') x.checked = false; });
      if (cb.value !== 'geen' && cb.checked) { const g = $('input[name=klachten][value=geen]'); if (g) g.checked = false; }
      const any = $$('input[name=klachten]:checked').some(x => x.value !== 'geen');
      $('#klacht-detail').classList.toggle('hidden', !any);
    }));
    if (cur.key === 'klaar') { try { localStorage.removeItem(DRAFT); } catch (e) {} }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('#wz-next').addEventListener('click', () => {
    const S = steps();
    const cur = S[st.step];
    const err = collect(cur);
    if (err.length) {
      const box = $('#wz-err');
      box.innerHTML = 'Vul nog in: <b>' + err.map(esc).join(', ') + '</b>';
      box.classList.remove('hidden');
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (cur.key === 'betalen') {
      const btn = $('#wz-next');
      btn.disabled = true; btn.textContent = 'Je wordt doorgestuurd naar iDEAL…';
      setTimeout(() => { btn.textContent = 'Betaling bevestigen…'; }, 900);
      setTimeout(() => { createDossier(); btn.disabled = false; st.step++; persist(); render(); }, 1800);
      return;
    }
    st.step++;
    persist();
    render();
  });
  $('#wz-back').addEventListener('click', () => { collect(steps()[st.step]); st.step = Math.max(0, st.step - 1); persist(); render(); });

  render();
})();
