/* Klantdossier: voortgang, thuismeting, rapport, advies, bestelling, levering, nazorg */
(function () {
  'use strict';
  const { STORE, PHASES, $, $$, esc, eur, eur2, fmtDate, fmtDateTime, mount, getDossier, load, qs, phaseOf, statusText, rememberDossier, isoDay, addDays, toast } = SS;
  mount('dossier');

  const root = $('#dossier-root');
  let code = (qs('code') || '').toUpperCase() || SS.lastDossier();
  let d = getDossier(code);
  let activeSleeper = qs('slaper') || null;

  if (!d) { renderPicker(); return; }
  rememberDossier(d.id);
  if (qs('code') !== d.id) history.replaceState(null, '', '?code=' + d.id);
  render();

  /* ---------------- geen dossier ---------------- */
  function renderPicker() {
    const all = load().dossiers;
    root.innerHTML = `<section class="block"><div class="wrap" style="max-width:720px">
      <div class="card shadow">
        <span class="kicker">Mijn slaapdossier</span><h2>Open je dossier</h2>
        <p class="muted">Vul de dossiercode in uit je bevestigingsmail.</p>
        <form id="pick" class="btn-row"><input type="text" id="pick-code" placeholder="SS-1234" style="max-width:220px;text-transform:uppercase" value="${esc(qs('code') || '')}"><button class="btn btn-primary">Openen</button></form>
        ${qs('code') ? `<p class="small" style="color:var(--bad);margin-top:10px">Dossier ${esc(qs('code'))} staat niet in deze browser.</p>` : ''}
        ${all.length ? `<h3 style="margin-top:28px">Dossiers in deze browser (demo)</h3><ul class="advice-list">${all.map(x => `<li><a href="dossier.html?code=${x.id}"><b>${x.id}</b></a> – ${esc(x.contact.naam)} · <span class="muted">${esc(statusText(x))}</span></li>`).join('')}</ul>`
          : `<div class="notice">Nog geen dossiers. <a href="aanvragen.html">Vraag een SlaapID-meting aan</a> of laad voorbeelddossiers in het <a href="studio.html">studio-dashboard</a>.</div>`}
      </div></div></section>`;
    $('#pick').addEventListener('submit', e => { e.preventDefault(); location.href = 'dossier.html?code=' + encodeURIComponent($('#pick-code').value.trim().toUpperCase()); });
  }

  /* ---------------- hoofdweergave ---------------- */
  function render() {
    d = getDossier(d.id);
    const p = phaseOf(d);
    const names = d.sleepers.map(s => s.naam).join(' & ');
    root.innerHTML = `
      <div class="dossier-head"><div class="wrap">
        <div><span class="kicker" style="color:var(--lime-light)">Slaapdossier ${d.id}</span><h1>Hoi ${esc(names)}</h1><p style="margin:6px 0 0;opacity:.8">${esc(statusText(d))}</p></div>
        <div class="btn-row"><button class="btn btn-primary btn-sm" data-human>Vraag het een slaapadviseur</button></div>
      </div></div>
      <div class="wrap">
        <div class="phase-track">${PHASES.map(ph => `<div class="phase ${ph.n < p ? 'done' : ph.n === p ? 'current' : ''}"><div class="bar"></div>${ph.label}</div>`).join('')}</div>
        <div class="demo-bar"><b>Demo</b> Wil je zien hoe het verder gaat? Simuleer de volgende stap van klant of studio.
          <button class="btn btn-dark btn-sm" id="demo-next" type="button">Volgende stap ▶</button>
          <a class="btn btn-ghost btn-sm" href="studio.html?code=${d.id}">Bekijk dit dossier in het studio-dashboard</a></div>
        <div class="dossier-grid">
          <div id="main-col">${mainContent(p)}</div>
          <aside>${sideContent()}</aside>
        </div>
      </div>`;
    bind();
    SSM.bindTips(root);
    $$('[data-human]', root).forEach(b => b.addEventListener('click', () => document.getElementById('human-fab').click()));
  }

  function mainContent(p) {
    let h = '';
    if (p === 3) h += measurementCard();
    if (p === 4 && !d.adviesVrijgegeven) h += `<div class="card shadow"><span class="kicker">Resultaat & advies</span><h2>Je adviseur bekijkt je meting</h2>
        <p>Je sensordata is uitgelezen. Een ligexpert van ${STORE.naam} controleert het rapport en de matrasinstelling voordat je ze krijgt. Dat duurt meestal minder dan één werkdag.</p>
        <p class="muted small">Je krijgt een mail zodra je advies klaarstaat. Wil je het liever samen bespreken? Plan alvast een gesprek.</p>
        <div class="btn-row"><button class="btn btn-dark" data-human type="button">Plan een adviesgesprek</button></div></div>`;
    if (p >= 4 && d.adviesVrijgegeven) {
      if (p === 4) h += `<div class="card shadow" style="margin-bottom:24px;border-left:6px solid var(--lime)"><span class="kicker">Je advies staat klaar</span>
          <h2>Dit is jullie ideale bed</h2>
          <p>Hieronder staat je meetrapport met het advies per zone. In de configurator staat je bed al ingesteld volgens dit advies. Jij kiest alleen nog maat en uitstraling.</p>
          ${d.adviesNotitie ? `<div class="notice sand"><b>Notitie van je adviseur:</b> ${esc(d.adviesNotitie)}</div>` : ''}
          <div class="btn-row"><a class="btn btn-primary" href="configurator.html?code=${d.id}">Stel je bed samen</a><button class="btn btn-outline" data-human type="button">Eerst persoonlijk bespreken</button></div></div>`;
      if (p === 5) h += configCard();
      if (p >= 6) h += orderCard(p);
      if (p === 7) h += nazorgCard();
      h += reportSection();
    }
    return h;
  }

  /* ---------------- thuismeting ---------------- */
  function measurementCard() {
    const s = d.sensor, m = d.meting, n = d.sleepers.length;
    const een = n > 1 ? 'de sensoren' : 'de sensor';
    let body = '';
    if (s.status === 'klaarzetten') {
      body = `<h2>We maken ${een} voor je klaar</h2>
        <p>${s.methode === 'post' ? `We versturen ${een} zodat ${n > 1 ? 'ze' : 'hij'} op <b>${fmtDate(s.datum)}</b> bij je ${n > 1 ? 'zijn' : 'is'}.` : `Je kunt ${een} ophalen op <b>${fmtDate(s.datum)}</b> in de studio, ${STORE.straat} in ${STORE.plaats}.`}</p>
        ${wearInstructions()}`;
    } else if (s.status === 'onderweg' || s.status === 'klaar_ophalen') {
      body = `<h2>${s.status === 'onderweg' ? `${n > 1 ? 'Je sensoren zijn' : 'Je sensor is'} onderweg` : `${n > 1 ? 'Je sensoren liggen' : 'Je sensor ligt'} klaar`}</h2>
        <p>${s.status === 'onderweg' ? 'Je hebt een track & trace-mail ontvangen.' : `Haal ${een} op in de studio. We leggen je in vijf minuten uit hoe het werkt.`}</p>
        ${wearInstructions()}
        <div class="btn-row"><button class="btn btn-primary" id="act-ontvangen" type="button">${s.methode === 'post' ? 'Ik heb de sensor ontvangen' : 'Ik heb de sensor opgehaald'}</button></div>`;
    } else if (!m.retour && (m.nachten || 0) < STORE.nachten) {
      body = `<h2>Meten: nacht ${(m.nachten || 0) + 1} van ${STORE.nachten}</h2>
        <p>Draag de sensor vanavond weer${n > 1 ? ' (allebei)' : ''}. Je krijgt elke avond om 21:30 een herinnering.</p>
        ${nightsGrid()}
        <div class="btn-row"><button class="btn btn-primary" id="act-nacht" type="button">Nacht ${(m.nachten || 0) + 1} afronden</button><span class="small muted">In het echt gaat dit automatisch via de sensor.</span></div>
        <div class="notice sand" style="margin-top:18px">Slaap zoals je altijd slaapt: zelfde kussen, zelfde dekbed, zelfde tijden.</div>`;
    } else if (!m.retour) {
      body = `<h2>Alle ${STORE.nachten} nachten zijn gemeten!</h2>${nightsGrid()}
        <p>${s.methode === 'post' ? `Doe ${een} in de doos, plak het retourlabel erop en lever hem in bij een PostNL-punt.` : `Lever ${een} in bij de studio. Dan lezen we hem direct samen uit.`}</p>
        <div class="btn-row"><button class="btn btn-primary" id="act-retour" type="button">${s.methode === 'post' ? 'Ik heb de sensor verstuurd' : 'Ik heb de sensor ingeleverd'}</button></div>`;
    } else {
      body = `<h2>We lezen je meting uit</h2>${nightsGrid()}<p>Zodra ${een} binnen ${n > 1 ? 'zijn' : 'is'}, lezen we de data uit in SlaapID. Je krijgt bericht zodra je rapport klaarstaat.</p>`;
    }
    return `<div class="card shadow"><span class="kicker">Thuismeting</span>${body}</div>`;
  }
  function wearInstructions() {
    return `<div class="grid-3" style="margin:18px 0">
      <div class="metric"><b>1</b><span>Laad de sensor overdag op met de meegeleverde kabel.</span></div>
      <div class="metric"><b>2</b><span>Plak hem voor het slapen op je borstbeen met een pleister uit de doos.</span></div>
      <div class="metric"><b>3</b><span>Slaap zoals altijd. Haal hem ’s ochtends eraf en laad hem weer op.</span></div>
    </div>`;
  }
  function nightsGrid() {
    const m = d.meting;
    return `<div class="nights">${[1, 2, 3].map(n => `<div class="night ${n <= (m.nachten || 0) ? 'done' : ''}"><div class="moon">${n <= (m.nachten || 0) ? '🌙' : '☾'}</div><b>Nacht ${n}</b><div class="small muted">${n <= (m.nachten || 0) ? 'Gemeten ✓' : 'Nog te gaan'}</div></div>`).join('')}</div>`;
  }

  /* ---------------- rapport ---------------- */
  function reportSection() {
    const ss = d.sleepers;
    if (!activeSleeper || !ss.some(s => s.id === activeSleeper)) activeSleeper = ss[0].id;
    const s = ss.find(x => x.id === activeSleeper);
    const r = d.resultaten[s.id];
    if (!r) return '';
    const a = r.advies;
    const zij = r.avg.pos.zl + r.avg.pos.zr;
    const u = Math.floor(r.avg.inBed / 60), mi = r.avg.inBed % 60;
    return `<div class="card shadow" id="rapport" style="margin-top:24px">
      <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center">
        <div><span class="kicker">SlaapID-rapport</span><h2 style="margin:0">Zo slaapt ${esc(s.naam)}</h2></div>
        ${ss.length > 1 ? `<div class="sleeper-tabs" style="margin:0">${ss.map(x => `<a href="#rapport" class="sleeper-tab ${x.id === s.id ? 'active' : ''}" data-sleeper="${x.id}" style="text-decoration:none">${esc(x.naam)}</a>`).join('')}</div>` : ''}
      </div>
      <p class="small muted">Gemeten over ${STORE.nachten} nachten · SlaapID-sensor · gesimuleerde data voor deze demo</p>
      <div class="metric-row">
        <div class="metric"><b>${zij}%</b><span>op je zij</span></div>
        <div class="metric"><b>${r.avg.wissel}×</b><span>houdingswisselingen per nacht</span></div>
        <div class="metric"><b>${String(r.avg.tempMax).replace('.', ',')}°</b><span>max. bedtemperatuur</span></div>
        <div class="metric"><b>${u}u${String(mi).padStart(2, '0')}</b><span>gemiddeld in bed, ${r.avg.rustig}% rustig</span></div>
      </div>
      <h3>Slaaphoudingen per nacht</h3>
      <div class="chart-wrap">${SSM.posChart(r.nights)}</div>
      <div class="grid-2" style="margin-top:26px;gap:24px">
        <div><h3>Houdingswisselingen</h3><div class="chart-wrap">${SSM.barChart(r.nights.map(x => ({ label: 'Nacht ' + x.n, v: x.wissel })), { ref: 38, refLabel: 'gemiddeld ±38', aria: 'Houdingswisselingen per nacht', color: '#2a78d6', valueLabels: true, maxBar: 70 })}</div></div>
        <div><h3>Bedklimaat (nacht 2)</h3><div class="chart-wrap">${SSM.lineChart(r.temp, { bandLo: 32, bandHi: 33, aria: 'Temperatuur in bed tijdens nacht 2', color: '#eb6834' })}</div></div>
      </div>
      <h3 style="margin-top:22px">Slaapritme: beweging per half uur (nacht 2)</h3>
      <div class="chart-wrap">${SSM.barChart(r.beweging.map(x => ({ label: x.t, v: x.v })), { aria: 'Bewegingen per half uur', unit: ' bewegingen', color: '#1baf7a', sparseX: 2, height: 160 })}</div>
      <p class="small muted">Rustige periodes wisselen af met momenten van beweging. Dat zijn je slaapcycli van ongeveer 90 minuten.</p>

      <h3 style="margin-top:26px">Inzichten</h3>
      <ol class="advice-list">${r.inzichten.map(x => `<li>${esc(x)}</li>`).join('')}</ol>

      <div class="grid-2" style="margin-top:28px;gap:28px;align-items:start">
        <div>
          <span class="kicker">Advies voor ${esc(s.naam)}</span>
          <h3>Matrasinstelling Blocks</h3>
          <table class="summary-table small">${a.blocks.map((lv, i) => `<tr><td>Zone ${i + 1} · ${SSM.ZONES[i]}</td><td><span class="tag" style="background:${SSM.LEVELS[lv].color};color:${SSM.LEVELS[lv].text}">${SSM.LEVELS[lv].label}</span></td></tr>`).join('')}</table>
          <h3 style="margin-top:20px">Verder</h3>
          <ul class="advice-list">
            <li><b>Tijk ${a.tijk}.</b> ${esc(a.tijkReden)}</li>
            <li><b>Lengte ${a.lengte} cm.</b> Je lengte plus ongeveer 25 cm.</li>
            <li><b>Kussen:</b> ${esc(a.kussen)}</li>
          </ul>
        </div>
        <div class="center">
          <div class="chart-wrap" style="max-width:220px;margin:0 auto">${SSM.mattressSVG([{ levels: a.blocks, bouw: s.bouw }], 90, a.lengte, { labels: false })}</div>
          <div style="display:flex;justify-content:center;margin-top:10px">${SSM.blocksLegend()}</div>
        </div>
      </div>
    </div>`;
  }

  /* ---------------- configuratie / bestelling ---------------- */
  function configCard() {
    const c = d.configuratie;
    const pr = SSM.priceLines(c, d.betaling.bedrag);
    return `<div class="card shadow" style="margin-bottom:24px;border-left:6px solid var(--lime)">
      <span class="kicker">Configureren & kopen</span><h2>Je bed is samengesteld</h2>
      <div class="grid-2" style="gap:20px;align-items:center"><div>${SSM.bedFrontSVG(c)}</div>
      <div><p><b>${c.breedte} × ${c.lengte} cm</b> · ${c.model === 'M500' ? 'Blocks M500' : 'Blocks M400'}<br>${esc((SSM.CATALOG.stoffen.find(x => x.key === c.stof) || {}).naam || '')} · hoofdbord ${esc((SSM.CATALOG.hoofdborden.find(x => x.key === c.hoofdbord) || {}).naam || '')}</p>
      <p style="font-size:1.5rem;font-weight:700;margin:0">${eur(pr.totaal)}</p><p class="small muted">na verrekening van ${eur(pr.korting)} onderzoek</p></div></div>
      <div class="btn-row" style="margin-top:16px"><a class="btn btn-primary" href="configurator.html?code=${d.id}">Bekijk en bestel</a><button class="btn btn-outline" data-human type="button">Liever in de studio afronden</button></div></div>`;
  }
  function orderCard(p) {
    const b = d.bestelling, l = d.levering || {};
    const c = d.configuratie;
    let h = `<div class="card shadow" style="margin-bottom:24px">
      <span class="kicker">${p === 6 ? 'Levering & afstellen' : 'Je bestelling'}</span>
      <h2>${p === 6 ? (l.datum ? `We komen op ${fmtDate(l.datum, { weekday: 'long', day: 'numeric', month: 'long' })}` : 'We plannen je levering in') : 'Je bed staat bij je thuis'}</h2>
      <div class="grid-2" style="gap:20px;align-items:center"><div>${SSM.bedFrontSVG(c)}</div><div>
        <p class="small muted" style="margin:0">Bestelnummer</p><p><b>${b.nr}</b> · ${fmtDate(b.datum)}</p>
        <p class="small muted" style="margin:0">Totaal</p><p><b>${eur2(b.totaal)}</b> · aanbetaald ${eur2(b.aanbetaling)}</p>
      </div></div>`;
    if (p === 6) h += `<h3>Wat gebeurt er bij de levering?</h3><ol class="advice-list">
        <li>Twee monteurs van ${STORE.naam} brengen je bed en bouwen het op.</li>
        <li>De monteur zet de blokken per zone volgens jouw SlaapID-advies.</li>
        <li>Je ligt samen proef, en we stellen direct bij als dat nodig is.</li>
        <li>Je oude matras nemen we gratis mee.</li></ol>
        <div class="notice">Na ongeveer 4 weken volgt een <b>herhaalmeting</b>. Die laat zien wat je nieuwe bed oplevert.</div>`;
    return h + `</div>`;
  }
  function nazorgCard() {
    const nz = d.nazorg || {};
    let h = `<div class="card shadow" style="margin-bottom:24px;border-left:6px solid var(--lime)"><span class="kicker">Nazorg · Bewijzen</span>`;
    if (!nz.herhaal) {
      h += `<h2>Hoe slaap je nu?</h2><p>Je bed is ${d.levering && d.levering.afgesteldOp ? 'afgesteld op ' + fmtDate(d.levering.afgesteldOp) : 'afgesteld'}. Na ongeveer 4 weken meten we opnieuw: dan is je lichaam gewend aan je nieuwe bed.</p>
        <div class="btn-row"><button class="btn btn-primary" id="act-herhaal" type="button">Vraag de herhaalmeting nu aan</button></div>`;
    } else if (!nz.herhaal.klaar) {
      h += `<h2>Herhaalmeting loopt</h2><p>De sensor is onderweg. Je meet weer ${STORE.nachten} nachten, nu op je nieuwe bed.</p>`;
    } else {
      h += `<h2>Het resultaat: voor en na</h2><table class="summary-table"><tr><th></th><th>Eerste meting</th><th>Op je nieuwe bed</th></tr>`;
      d.sleepers.forEach(s => {
        const a = d.resultaten[s.id], b = nz.herhaal.resultaten[s.id];
        const dw = Math.round((b.avg.wissel - a.avg.wissel) / a.avg.wissel * 100);
        h += `<tr><td colspan="3" style="text-align:left"><b>${esc(s.naam)}</b></td></tr>
          <tr><td>Houdingswisselingen per nacht</td><td>${a.avg.wissel}</td><td><b>${b.avg.wissel}</b> <span class="tag lime">${dw}%</span></td></tr>
          <tr><td>Rustige slaap</td><td>${a.avg.rustig}%</td><td><b>${b.avg.rustig}%</b></td></tr>
          <tr><td>Max. bedtemperatuur</td><td>${String(a.avg.tempMax).replace('.', ',')} °C</td><td><b>${String(b.avg.tempMax).replace('.', ',')} °C</b></td></tr>`;
      });
      h += `</table><p class="small muted" style="margin-top:10px">Is één zone nog niet perfect? Dan wisselen we kosteloos blokken. Dat is onze instelgarantie.</p>`;
      if (!nz.review) h += `<h3 style="margin-top:18px">Hoe tevreden ben je?</h3><form id="review" class="btn-row">
        <div class="scale" style="max-width:280px">${[1, 2, 3, 4, 5].map(n => `<label class="choice"><input type="radio" name="sterren" value="${n}" ${n === 5 ? 'checked' : ''}><span>${n}★</span></label>`).join('')}</div>
        <input type="text" name="tekst" placeholder="Wat wil je andere slapers meegeven?" style="flex:1;min-width:200px"><button class="btn btn-dark">Plaats review</button></form>`;
      else h += `<div class="notice">Dank voor je review: ${'★'.repeat(nz.review.sterren)} ${nz.review.tekst ? '“' + esc(nz.review.tekst) + '”' : ''}</div>`;
    }
    return h + `</div>`;
  }

  /* ---------------- zijkolom ---------------- */
  function sideContent() {
    return `<div class="card" style="margin-bottom:18px">
        <span class="kicker">Jouw studio</span>
        <h3 style="margin-bottom:4px">${STORE.naam}</h3>
        <p class="small">${STORE.straat}, ${STORE.postcode} ${STORE.plaats}<br><a href="${STORE.telHref}">${STORE.tel}</a> · <a href="mailto:${STORE.email}">e-mail</a></p>
        <button class="btn btn-primary btn-sm" data-human type="button" style="width:100%">Persoonlijk contact</button>
      </div>
      <div class="card" style="margin-bottom:18px">
        <span class="kicker">Dossier</span>
        <table class="summary-table small">
          <tr><td>Slapers</td><td>${d.sleepers.map(s => esc(s.naam)).join(', ')}</td></tr>
          <tr><td>Sensor</td><td>${d.sensor.methode === 'post' ? 'Per post' : 'Ophalen studio'}</td></tr>
          <tr><td>Onderzoek</td><td>${eur2(d.betaling.bedrag)} ✓</td></tr>
          <tr><td>Aangevraagd</td><td>${fmtDate(d.created)}</td></tr>
        </table>
        <p class="small muted" style="margin:10px 0 0">🔒 Je slaapdata staat in de beveiligde omgeving van SlaapID. Wij bewaren alleen status, instelling en een link naar je rapport.</p>
      </div>
      <div class="card"><span class="kicker">Tijdlijn</span>
        <ul class="timeline">${(d.events || []).slice(0, 14).map(e => `<li><time>${fmtDateTime(e.t)} · ${e.wie}</time>${esc(e.tekst)}</li>`).join('')}</ul>
      </div>`;
  }

  /* ---------------- acties ---------------- */
  function bind() {
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', () => { fn(); render(); }); };
    on('act-ontvangen', () => { SSF.sensorOntvangen(d, 'klant'); toast('Fijn! Vanavond start je eerste meetnacht.'); });
    on('act-nacht', () => { SSF.nachtAfronden(d, 'klant'); toast(`Nacht ${d.meting.nachten} opgeslagen`); });
    on('act-retour', () => { SSF.retour(d, 'klant'); toast('Dank je! We lezen je meting uit zodra hij binnen is.'); });
    on('act-herhaal', () => { SSF.herhaalStart(d, 'klant'); toast('Herhaalmeting aangevraagd'); });
    on('demo-next', () => {
      const p = phaseOf(d);
      if (p === 4 && d.adviesVrijgegeven) { location.href = 'configurator.html?code=' + d.id; return; }
      if (p === 5) { location.href = 'configurator.html?code=' + d.id + '#bestellen'; return; }
      const [, label] = SSF.next(d, 'studio');
      toast(label ? 'Demo: ' + label : 'Geen volgende stap meer: de reis is compleet');
    });
    $$('[data-sleeper]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); activeSleeper = a.dataset.sleeper; render(); setTimeout(() => $('#rapport').scrollIntoView(), 0); }));
    const rv = $('#review');
    if (rv) rv.addEventListener('submit', e => { e.preventDefault(); const f = new FormData(rv); SSF.review(d, Number(f.get('sterren')), f.get('tekst')); toast('Dank je wel voor je review!'); render(); });
  }
})();
