/* Procesflow van de klantreis: gedeeld door klantdossier en studio-dashboard */
(function () {
  'use strict';
  const { STORE, addEvent, saveDossier, eur2, fmtDate, addDays, isoDay, phaseOf } = SS;

  const F = {
    sensorVerzonden(d, wie) {
      d.sensor.status = d.sensor.methode === 'post' ? 'onderweg' : 'klaar_ophalen';
      addEvent(d, d.sensor.methode === 'post' ? `${d.sensor.aantal > 1 ? 'Sensoren' : 'Sensor'} verzonden, track & trace gemaild` : `${d.sensor.aantal > 1 ? 'Sensoren liggen' : 'Sensor ligt'} klaar in de studio`, wie || 'studio');
      return saveDossier(d);
    },
    sensorOntvangen(d, wie) {
      d.sensor.status = 'bij_klant';
      addEvent(d, d.sensor.methode === 'post' ? 'Sensor ontvangen door klant' : 'Sensor opgehaald in de studio, uitleg gegeven', wie || 'klant');
      return saveDossier(d);
    },
    nachtAfronden(d, wie) {
      if (d.sensor.status !== 'bij_klant') d.sensor.status = 'bij_klant';
      d.meting.nachten = Math.min(STORE.nachten, (d.meting.nachten || 0) + 1);
      addEvent(d, `Nacht ${d.meting.nachten} van ${STORE.nachten} gemeten`, wie || 'systeem');
      if (d.meting.nachten < STORE.nachten) addEvent(d, `Herinnering verstuurd: sensor opladen en vanavond weer dragen`, 'systeem');
      else addEvent(d, d.sensor.methode === 'post' ? 'Alle nachten gemeten. Retourinstructie verstuurd' : 'Alle nachten gemeten. Lever de sensor in bij de studio', 'systeem');
      return saveDossier(d);
    },
    retour(d, wie) {
      d.meting.retour = true;
      d.meting.nachten = STORE.nachten;
      d.sensor.status = 'retour';
      addEvent(d, d.sensor.methode === 'post' ? 'Sensor retour gestuurd' : 'Sensor ingeleverd in de studio', wie || 'klant');
      return saveDossier(d);
    },
    uitlezen(d, wie) {
      d.resultaten = d.resultaten || {};
      d.sleepers.forEach(s => { d.resultaten[s.id] = SSM.simulate(d, s); });
      d.meting.uitgelezen = true;
      d.meting.retour = true;
      d.sensor.status = 'uitgelezen';
      addEvent(d, 'Sensordata uitgelezen in SlaapID; rapport en matrasinstelling opgehaald', wie || 'studio');
      return saveDossier(d);
    },
    vrijgeven(d, wie, notitie) {
      d.adviesVrijgegeven = true;
      if (notitie) d.adviesNotitie = notitie;
      addEvent(d, 'Advies gecontroleerd en vrijgegeven. Klant gemaild met link naar rapport', wie || 'studio');
      return saveDossier(d);
    },
    gesprekGepland(d, kanaal, datum) {
      d.gesprek = { kanaal, datum };
      addEvent(d, `Adviesgesprek gepland: ${kanaal}, ${fmtDate(datum)}`, 'studio');
      return saveDossier(d);
    },
    leveringPlannen(d, datum, wie) {
      d.levering = Object.assign(d.levering || {}, { datum });
      addEvent(d, `Levering en afstellen ingepland op ${fmtDate(datum)}`, wie || 'studio');
      return saveDossier(d);
    },
    afstellen(d, wie) {
      d.levering = Object.assign(d.levering || {}, { afgesteld: true, afgesteldOp: new Date().toISOString() });
      if (!d.levering.datum) d.levering.datum = isoDay(new Date());
      d.nazorg = d.nazorg || { start: new Date().toISOString() };
      addEvent(d, 'Bed geplaatst en blokken afgesteld volgens advies. Oude matras meegenomen', wie || 'studio');
      addEvent(d, 'Nazorg gestart: check na 4 weken en herhaalmeting ingepland', 'systeem');
      return saveDossier(d);
    },
    herhaalStart(d, wie) {
      d.nazorg = d.nazorg || {};
      d.nazorg.herhaal = { gestart: new Date().toISOString(), klaar: false };
      addEvent(d, 'Herhaalmeting gestart: sensor opnieuw verstuurd', wie || 'studio');
      return saveDossier(d);
    },
    herhaalKlaar(d, wie) {
      d.nazorg = d.nazorg || {};
      d.nazorg.herhaal = d.nazorg.herhaal || { gestart: new Date().toISOString() };
      d.nazorg.herhaal.klaar = true;
      d.nazorg.herhaal.resultaten = {};
      const tijk = d.configuratie ? d.configuratie.tijk : 'Wool';
      d.sleepers.forEach(s => { d.nazorg.herhaal.resultaten[s.id] = SSM.simulate(d, s, { herhaal: true, tijk }); });
      addEvent(d, 'Herhaalmeting uitgelezen: vergelijking met eerste meting beschikbaar', wie || 'studio');
      return saveDossier(d);
    },
    review(d, sterren, tekst) {
      d.nazorg = d.nazorg || {};
      d.nazorg.review = { sterren, tekst, t: new Date().toISOString() };
      addEvent(d, `Review gegeven: ${'★'.repeat(sterren)}${tekst ? ' – “' + tekst + '”' : ''}`, 'klant');
      return saveDossier(d);
    },
    /* volgende logische stap (voor demo-knoppen) */
    next(d, wie) {
      const p = phaseOf(d);
      if (p === 3) {
        const s = d.sensor.status;
        if (s === 'klaarzetten') return [F.sensorVerzonden(d, wie), 'Sensor verzonden'];
        if (s === 'onderweg' || s === 'klaar_ophalen') return [F.sensorOntvangen(d, wie), 'Sensor bij klant'];
        if (!d.meting.retour && (d.meting.nachten || 0) < STORE.nachten) return [F.nachtAfronden(d, wie), `Nacht ${d.meting.nachten} gemeten`];
        if (!d.meting.retour) return [F.retour(d, wie), 'Sensor retour'];
        return [F.uitlezen(d, wie), 'Meting uitgelezen'];
      }
      if (p === 4 && !d.adviesVrijgegeven) return [F.vrijgeven(d, wie), 'Advies vrijgegeven'];
      if (p === 6 && !(d.levering && d.levering.datum)) return [F.leveringPlannen(d, isoDay(addDays(new Date(), 21)), wie), 'Levering gepland'];
      if (p === 6) return [F.afstellen(d, wie), 'Bed afgesteld'];
      if (p === 7 && !(d.nazorg && d.nazorg.herhaal)) return [F.herhaalStart(d, wie), 'Herhaalmeting gestart'];
      if (p === 7 && !d.nazorg.herhaal.klaar) return [F.herhaalKlaar(d, wie), 'Herhaalmeting klaar'];
      return [d, null];
    },

    /* bestelling vanuit configurator */
    bestellen(d, config, prijs, leverdatum) {
      d.configuratie = Object.assign({}, config, { opgeslagen: true });
      d.bestelling = {
        nr: 'FP-' + new Date().getFullYear() + '-' + String(Math.floor(1000 + Math.random() * 9000)),
        datum: new Date().toISOString(), totaal: prijs.totaal, korting: prijs.korting,
        aanbetaling: Math.round(prijs.totaal * 0.25), regels: prijs.lines
      };
      d.levering = { datum: leverdatum, gewenst: leverdatum };
      addEvent(d, `Bestelling ${d.bestelling.nr} geplaatst: ${eur2(prijs.totaal)} (onderzoek ${eur2(prijs.korting)} verrekend)`, 'klant');
      addEvent(d, `Aanbetaling ${eur2(d.bestelling.aanbetaling)} ontvangen. Order doorgezet naar Sleep Trade / Beddelicious`, 'systeem');
      addEvent(d, `Gewenste leverdatum: ${fmtDate(leverdatum)}`, 'klant');
      return saveDossier(d);
    }
  };

  /* ---------------- voorbeelddossiers ---------------- */
  function seed() {
    const people = [
      { contact: { naam: 'Sanne de Vries', email: 'sanne@example.nl', tel: '06-12345678', straat: 'Oosterstraat 12', postcode: '3861 BK', plaats: 'Nijkerk' }, sleepers: [
        { id: 'A', naam: 'Sanne', leeftijd: '30 – 44', lengte: 168, gewicht: 62, bouw: 'heupen', houding: 'zij', bedtijd: '22:45', opstaan: '06:45', wakker: '1-2', uitgerust: 2, klimaat: 'koud', klachten: ['schouder', 'heup'], klachtMoment: 'wakker', ernst: 5, allergie: 'nee', sport: '1-2' },
        { id: 'B', naam: 'Mark', leeftijd: '30 – 44', lengte: 186, gewicht: 88, bouw: 'schouders', houding: 'rug', bedtijd: '23:15', opstaan: '06:45', wakker: '0', uitgerust: 4, klimaat: 'warm', klachten: ['lage rug'], klachtMoment: 'wakker', ernst: 3, allergie: 'nee', sport: '3+' }], stage: 'advies' },
      { contact: { naam: 'Henk Bakker', email: 'henk@example.nl', tel: '06-23456789', straat: 'Bruins Slotlaan 4', postcode: '3862 AB', plaats: 'Nijkerk' }, sleepers: [
        { id: 'A', naam: 'Henk', leeftijd: '60 – 74', lengte: 179, gewicht: 92, bouw: 'normaal', houding: 'wisselend', bedtijd: '23:30', opstaan: '07:30', wakker: '3+', uitgerust: 2, klimaat: 'zweten', klachten: ['lage rug', 'nek'], klachtMoment: 'nacht', ernst: 7, allergie: 'nee', sport: 'nee' }], stage: 'meting2' },
      { contact: { naam: 'Fatima el Amrani', email: 'fatima@example.nl', tel: '06-34567890', straat: 'Ds. van Dijkweg 7', postcode: '3871 AK', plaats: 'Hoevelaken' }, sleepers: [
        { id: 'A', naam: 'Fatima', leeftijd: '45 – 59', lengte: 164, gewicht: 70, bouw: 'heupen', houding: 'zij', bedtijd: '23:00', opstaan: '07:00', wakker: '1-2', uitgerust: 3, klimaat: 'warm', klachten: ['slapende armen'], klachtMoment: 'nacht', ernst: 4, allergie: 'ja', sport: '1-2' },
        { id: 'B', naam: 'Youssef', leeftijd: '45 – 59', lengte: 181, gewicht: 95, bouw: 'normaal', houding: 'buik', bedtijd: '00:00', opstaan: '07:00', wakker: '1-2', uitgerust: 3, klimaat: 'prima', klachten: ['nek'], klachtMoment: 'wakker', ernst: 3, allergie: 'nee', sport: 'nee' }], stage: 'levering' },
      { contact: { naam: 'Lotte Jansen', email: 'lotte@example.nl', tel: '06-45678901', straat: 'Paulus Potterstraat 22', postcode: '3818 GK', plaats: 'Amersfoort' }, sleepers: [
        { id: 'A', naam: 'Lotte', leeftijd: 'Jonger dan 30', lengte: 174, gewicht: 64, bouw: 'normaal', houding: 'rug', bedtijd: '23:30', opstaan: '07:15', wakker: '0', uitgerust: 3, klimaat: 'prima', klachten: ['geen'], allergie: 'nee', sport: 'top' }], stage: 'nieuw' },
      { contact: { naam: 'Gerrit van den Berg', email: 'gerrit@example.nl', tel: '06-56789012', straat: 'Watergoorweg 50', postcode: '3861 MA', plaats: 'Nijkerk' }, sleepers: [
        { id: 'A', naam: 'Gerrit', leeftijd: '75 of ouder', lengte: 176, gewicht: 81, bouw: 'normaal', houding: 'rug', bedtijd: '22:30', opstaan: '07:00', wakker: '3+', uitgerust: 2, klimaat: 'koud', klachten: ['lage rug', 'heup'], klachtMoment: 'dag', ernst: 6, allergie: 'nee', sport: 'nee' },
        { id: 'B', naam: 'Riek', leeftijd: '75 of ouder', lengte: 162, gewicht: 66, bouw: 'heupen', houding: 'zij', bedtijd: '22:30', opstaan: '07:30', wakker: '1-2', uitgerust: 3, klimaat: 'koud', klachten: ['schouder'], klachtMoment: 'wakker', ernst: 4, allergie: 'nee', sport: 'nee' }], stage: 'nazorg' },
      { contact: { naam: 'Daan Mulder', email: 'daan@example.nl', tel: '06-67890123', straat: 'Stoutenburgerlaan 3', postcode: '3835 PB', plaats: 'Stoutenburg' }, sleepers: [
        { id: 'A', naam: 'Daan', leeftijd: '30 – 44', lengte: 192, gewicht: 104, bouw: 'schouders', houding: 'zij', bedtijd: '23:45', opstaan: '06:30', wakker: '1-2', uitgerust: 2, klimaat: 'warm', klachten: ['schouder', 'nek'], klachtMoment: 'wakker', ernst: 5, allergie: 'nee', sport: '3+' }], stage: 'retour' },
      { contact: { naam: 'Ingrid Smit', email: 'ingrid@example.nl', tel: '06-78901234', straat: 'Frieswijkstraat 9', postcode: '3861 BJ', plaats: 'Nijkerk' }, sleepers: [
        { id: 'A', naam: 'Ingrid', leeftijd: '45 – 59', lengte: 170, gewicht: 77, bouw: 'heupen', houding: 'zij', bedtijd: '22:30', opstaan: '06:30', wakker: '1-2', uitgerust: 3, klimaat: 'zweten', klachten: ['heup'], klachtMoment: 'wakker', ernst: 4, allergie: 'nee', sport: '1-2' }], stage: 'config' }
    ];
    const methodes = ['ophalen', 'post'];
    people.forEach((p, idx) => {
      const id = SS.newCode();
      const created = addDays(new Date(), -[10, 5, 40, 1, 75, 8, 16][idx]).toISOString();
      const n = p.sleepers.length;
      p.sleepers.forEach(s => { s.matrasLeeftijd = [12, 9, 15, 4, 18, 7, 11][idx]; s.ervaring = ['kuil', 'te zacht', 'te hard', 'goed', 'kuil', 'te hard', 'te zacht'][idx]; });
      const d = {
        id, created, contact: p.contact,
        household: { personen: n, huidigeMaat: n === 2 ? '180 × 200' : '90 × 200', matrasType: 'pocketvering', bodem: 'boxspring', ervaring: p.sleepers[0].ervaring, matrasLeeftijd: p.sleepers[0].matrasLeeftijd, wensen: idx === 4 ? ['elektrisch', 'hooginstap'] : [], budget: '3000-5000' },
        sleepers: p.sleepers,
        sensor: { methode: methodes[idx % 2], datum: isoDay(addDays(created, 2)), start: isoDay(addDays(created, 3)), status: 'klaarzetten', aantal: n },
        betaling: { bedrag: n * STORE.onderzoekPrijs, betaald: true, methode: 'iDEAL · ING', datum: created },
        meting: { nachten: 0, retour: false, uitgelezen: false },
        resultaten: {}, adviesVrijgegeven: false, configuratie: null, bestelling: null, levering: null, nazorg: null,
        events: [], demo: true
      };
      addEvent(d, `Aanvraag ontvangen voor ${p.sleepers.map(s => s.naam).join(' en ')}`, 'klant', created);
      addEvent(d, `Betaling ${eur2(d.betaling.bedrag)} ontvangen via iDEAL`, 'systeem', created);
      const db = SS.load();
      db.dossiers.unshift(d);
      SS.save(db);
      const run = k => { for (let i = 0; i < k; i++) F.next(SS.getDossier(id), 'studio'); };
      const st = p.stage;
      if (st === 'meting2') run(4);            // verzonden, ontvangen, 2 nachten
      if (st === 'retour') run(6);             // ... 3 nachten + retour
      if (['advies', 'config', 'levering', 'nazorg'].includes(st)) run(8);  // uitgelezen + vrijgegeven
      if (['config', 'levering', 'nazorg'].includes(st)) {
        const dd = SS.getDossier(id);
        const cfg = defaultConfig(dd);
        if (st === 'config') { dd.configuratie = Object.assign(cfg, { opgeslagen: true }); addEvent(dd, 'Bed samengesteld in de configurator (nog niet besteld)', 'klant'); saveDossier(dd); }
        else {
          const pr = SSM.priceLines(cfg, n * STORE.onderzoekPrijs);
          F.bestellen(dd, cfg, pr, isoDay(addDays(new Date(), st === 'levering' ? 9 : -40)));
          if (st === 'nazorg') { F.afstellen(SS.getDossier(id), 'studio'); F.herhaalStart(SS.getDossier(id)); F.herhaalKlaar(SS.getDossier(id)); F.review(SS.getDossier(id), 5, 'Eindelijk weer uitgerust wakker. Super begeleiding!'); }
        }
      }
      // demo contactverzoek
      if (idx === 0) {
        const db2 = SS.load();
        db2.contacts.unshift({ id: 'C' + Date.now(), t: new Date().toISOString(), kanaal: 'Videogesprek', naam: 'Sanne de Vries', tel: '06-12345678', datum: isoDay(addDays(new Date(), 2)), tijd: 'Middag', vraag: 'Wij willen het advies graag samen doornemen voordat we kiezen.', pagina: 'Mijn dossier', fase: 'dossier', dossier: id, afgehandeld: false });
        SS.save(db2);
      }
    });
  }

  function defaultConfig(d) {
    const n = d.sleepers.length;
    const blocks = d.sleepers.map(s => (d.resultaten && d.resultaten[s.id]) ? d.resultaten[s.id].advies.blocks.slice() : SSM.PRESETS['Rugligger, gemiddeld'].slice());
    const tijkAdvice = d.sleepers.map(s => d.resultaten && d.resultaten[s.id] ? d.resultaten[s.id].advies.tijk : 'Wool');
    const maxLen = Math.max(...d.sleepers.map(s => d.resultaten && d.resultaten[s.id] ? d.resultaten[s.id].advies.lengte : 200));
    const wensen = (d.household && d.household.wensen) || [];
    return {
      personen: n, breedte: n === 2 ? 180 : 90, lengte: Math.min(240, Math.max(200, maxLen)),
      model: 'M400', tijk: tijkAdvice.includes('Clima') ? 'Clima' : tijkAdvice.includes('Wash') ? 'Wash' : 'Wool', tijken: tijkAdvice, namen: d.sleepers.map(s => s.naam),
      blocks, bodem: wensen.includes('hooginstap') ? 'hooglaag' : wensen.includes('elektrisch') ? 'elektrisch' : 'vast',
      hoogte: wensen.includes('hooginstap') ? 26 : 19, hoofdbord: 'banen', stof: 'zand', poten: 'eiken', extras: { kussen: true }
    };
  }

  window.SSF = Object.assign(F, { seed, defaultConfig });
})();
