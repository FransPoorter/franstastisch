/* Studio-dashboard voor de adviseur */
(function () {
  'use strict';
  const { STORE, PHASES, $, $$, esc, eur, eur2, fmtDate, fmtDateTime, mount, load, save, getDossier, saveDossier, phaseOf, statusText, qs, isoDay, addDays, toast, deleteAll } = SS;
  mount('studio', { noHuman: true });

  let sel = qs('code');

  $('#seed').addEventListener('click', () => { SSF.seed(); toast('7 voorbeelddossiers geladen'); render(); });
  $('#wipe').addEventListener('click', () => { if (confirm('Alle dossiers en contactverzoeken in deze browser wissen?')) { deleteAll(); sel = null; render(); } });

  function render() {
    const db = load();
    const ds = db.dossiers;
    // KPI's
    const actief = ds.filter(d => phaseOf(d) < 7).length;
    const meten = ds.filter(d => phaseOf(d) === 3).length;
    const uitgelezen = ds.filter(d => d.meting && d.meting.uitgelezen).length;
    const besteld = ds.filter(d => d.bestelling);
    const omzet = besteld.reduce((a, d) => a + d.bestelling.totaal, 0);
    const open = db.contacts.filter(c => !c.afgehandeld);
    $('#kpis').innerHTML = [
      [ds.length, 'dossiers totaal'], [actief, 'actief in de reis'], [meten, 'in thuismeting'],
      [uitgelezen ? Math.round(besteld.length / uitgelezen * 100) + '%' : '–', 'meting → aankoop'], [eur(omzet), `omzet uit ${besteld.length} bestelling${besteld.length === 1 ? '' : 'en'}`]
    ].map(k => `<div class="kpi"><b>${k[0]}</b><span>${k[1]}</span></div>`).join('');

    // contactverzoeken
    $('#contacts').innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Mens als keuze: contactverzoeken <span class="tag ${open.length ? 'warn' : ''}">${open.length} open</span></h3></div>` +
      (db.contacts.length ? `<table class="summary-table small" style="margin-top:10px"><tr><th>Wanneer</th><th>Kanaal</th><th>Klant</th><th>Vraag</th><th>Voorkeur</th><th></th></tr>${db.contacts.slice(0, 8).map(c => `<tr style="${c.afgehandeld ? 'opacity:.45' : ''}">
        <td>${fmtDateTime(c.t)}</td><td><span class="tag dark">${esc(c.kanaal)}</span></td>
        <td>${esc(c.naam)}<br><span class="muted">${esc(c.tel)}</span>${c.dossier ? `<br><a href="#" data-open="${c.dossier}">${c.dossier}</a>` : ''}</td>
        <td>${esc(c.vraag || '–')}<br><span class="muted">vanaf: ${esc(c.pagina)}</span></td><td>${c.datum ? fmtDate(c.datum, { day: 'numeric', month: 'short' }) : ''} ${esc(c.tijd || '')}</td>
        <td>${c.afgehandeld ? '✓' : `<button class="btn btn-sm btn-outline" data-done="${c.id}" type="button">Afgehandeld</button>`}</td></tr>`).join('')}</table>`
        : `<p class="muted small" style="margin:10px 0 0">Nog geen verzoeken. Klanten sturen ze via de knop “Liever persoonlijk contact?” op elke pagina.</p>`);

    // kanban
    const cols = PHASES.filter(p => p.n >= 2);
    $('#kanban').style.gridTemplateColumns = `repeat(${cols.length}, minmax(200px, 1fr))`;
    $('#kanban').innerHTML = cols.map(p => {
      const list = ds.filter(d => phaseOf(d) === p.n);
      return `<div class="kcol"><h4>${p.label}<span>${list.length}</span></h4>${list.map(d => {
        const reqs = open.filter(c => c.dossier === d.id).length;
        return `<div class="kcard ${d.id === sel ? 'sel' : ''}" data-id="${d.id}"><b>${esc(d.contact.naam)}</b><span class="muted">${d.id} · ${d.sleepers.length === 2 ? '👫 duo' : '1 slaper'}</span>
          <div style="margin-top:4px">${esc(statusText(d))}</div>
          <div class="tags">${d.sensor.methode === 'post' ? '<span class="tag">post</span>' : '<span class="tag">ophalen</span>'}${reqs ? `<span class="tag warn">☎ ${reqs}</span>` : ''}${actionNeeded(d) ? '<span class="tag lime">actie studio</span>' : ''}</div></div>`;
      }).join('') || '<p class="small muted" style="margin:6px">–</p>'}</div>`;
    }).join('');
    $$('.kcard').forEach(k => k.addEventListener('click', () => { sel = k.dataset.id; history.replaceState(null, '', '?code=' + sel); render(); $('#detail').scrollIntoView({ behavior: 'smooth' }); }));
    $$('[data-done]').forEach(b => b.addEventListener('click', () => { const db2 = load(); const c = db2.contacts.find(x => x.id === b.dataset.done); c.afgehandeld = true; if (c.dossier) { const d = db2.dossiers.find(x => x.id === c.dossier); if (d) SS.addEvent(d, `Contactverzoek (${c.kanaal}) afgehandeld door studio`, 'studio'); } save(db2); render(); }));
    $$('[data-open]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); sel = a.dataset.open; render(); $('#detail').scrollIntoView({ behavior: 'smooth' }); }));

    renderDetail();
    if (!ds.length) $('#kanban').insertAdjacentHTML('beforebegin', '');
  }

  function actionNeeded(d) {
    const p = phaseOf(d);
    if (p === 3) return d.sensor.status === 'klaarzetten' || d.meting.retour;
    if (p === 4) return !d.adviesVrijgegeven;
    if (p === 6) return true;
    if (p === 7) return !(d.nazorg && d.nazorg.herhaal && d.nazorg.herhaal.klaar);
    return false;
  }

  function renderDetail() {
    const box = $('#detail');
    const d = getDossier(sel);
    if (!d) { box.innerHTML = load().dossiers.length ? '<p class="muted center">Klik op een dossier voor de details.</p>' : '<div class="card center"><h3>Nog geen dossiers</h3><p class="muted">Laad voorbeelddossiers of doe zelf een aanvraag als klant.</p></div>'; return; }
    const p = phaseOf(d);
    const acts = [];
    if (p === 3) {
      if (d.sensor.status === 'klaarzetten') acts.push(['sensorVerzonden', d.sensor.methode === 'post' ? '📦 Sensor verzonden' : '🏠 Sensor klaargezet voor ophalen']);
      else if (d.sensor.status === 'onderweg' || d.sensor.status === 'klaar_ophalen') acts.push(['sensorOntvangen', 'Sensor is bij klant']);
      else if (!d.meting.retour) acts.push(['nachtAfronden', `Simuleer nacht ${(d.meting.nachten || 0) + 1}`], ['retour', 'Sensor retour ontvangen']);
      else acts.push(['uitlezen', '📡 Meting uitlezen in SlaapID']);
    }
    if (p === 4 && !d.adviesVrijgegeven) acts.push(['vrijgeven', '✓ Advies vrijgeven aan klant']);
    if (p === 6 && !(d.levering && d.levering.datum)) acts.push(['leveringPlannen', '📅 Levering inplannen']);
    if (p === 6) acts.push(['afstellen', '🔧 Bed geplaatst & afgesteld']);
    if (p === 7 && !(d.nazorg && d.nazorg.herhaal)) acts.push(['herhaalStart', 'Herhaalmeting starten']);
    if (p === 7 && d.nazorg && d.nazorg.herhaal && !d.nazorg.herhaal.klaar) acts.push(['herhaalKlaar', 'Herhaalmeting uitlezen']);

    const sleeperHtml = d.sleepers.map(s => {
      const r = d.resultaten && d.resultaten[s.id];
      return `<div class="card" style="padding:20px">
        <h3 style="margin-bottom:6px">${esc(s.naam)} <span class="muted small">${esc(s.leeftijd || '')} · ${s.lengte} cm · ${s.gewicht} kg · bouw: ${esc(s.bouw)}</span></h3>
        <table class="summary-table small">
          <tr><td>Inslaaphouding (zelf)</td><td>${esc(s.houding)}</td></tr>
          <tr><td>Ritme</td><td>${esc(s.bedtijd)} – ${esc(s.opstaan)}</td></tr>
          <tr><td>Wakker ’s nachts</td><td>${esc(s.wakker)} · uitgerust ${esc(s.uitgerust)}/5</td></tr>
          <tr><td>Bedklimaat</td><td>${esc(s.klimaat)}</td></tr>
          <tr><td>Klachten</td><td>${esc((s.klachten || []).join(', '))}${s.ernst && !(s.klachten || []).includes('geen') ? ' · ' + s.ernst + '/10' : ''}</td></tr>
          <tr><td>Allergie huisstofmijt</td><td>${esc(s.allergie || '–')}</td></tr>
        </table>
        ${r ? `<div class="grid-2" style="gap:14px;margin-top:14px;align-items:center">
          <div class="chart-wrap" style="max-width:150px;margin:0 auto">${SSM.mattressSVG([{ levels: r.advies.blocks, bouw: s.bouw }], 90, r.advies.lengte, { labels: false })}</div>
          <div class="small"><b>Gemeten:</b> ${r.avg.pos.zl + r.avg.pos.zr}% zij, ${r.avg.pos.rug}% rug, ${r.avg.pos.buik}% buik · ${r.avg.wissel} wisselingen · max ${String(r.avg.tempMax).replace('.', ',')} °C<br><br>
          <b>Advies:</b> ${r.advies.blocks.map(l => SSM.LEVELS[l].kort).join(' · ')}<br>tijk ${r.advies.tijk} · lengte ${r.advies.lengte} cm</div></div>` : ''}
      </div>`;
    }).join('');

    const c = d.configuratie;
    box.innerHTML = `<div class="card shadow">
      <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start">
        <div><span class="kicker">Dossier ${d.id} · fase ${p}: ${PHASES[p - 1].label}</span><h2 style="margin:0">${esc(d.contact.naam)}</h2>
          <p class="small muted" style="margin:4px 0 0">${esc(d.contact.straat)}, ${esc(d.contact.postcode)} ${esc(d.contact.plaats)} · ${esc(d.contact.tel)} · ${esc(d.contact.email)}</p></div>
        <div class="btn-row"><a class="btn btn-outline btn-sm" href="dossier.html?code=${d.id}" target="_blank">Bekijk als klant ↗</a>${c ? `<a class="btn btn-outline btn-sm" href="configurator.html?code=${d.id}" target="_blank">Configuratie ↗</a>` : ''}</div>
      </div>
      <div class="notice" style="margin:18px 0"><b>Status:</b> ${esc(statusText(d))}
        ${acts.length ? `<div class="btn-row" style="margin-top:10px">${acts.map(a => `<button class="btn btn-dark btn-sm" data-act="${a[0]}" type="button">${a[1]}</button>`).join('')}</div>` : ''}
        ${p === 4 && !d.adviesVrijgegeven ? `<div class="field" style="margin:12px 0 0"><label for="notitie">Persoonlijke notitie bij het advies (optioneel)</label><input id="notitie" type="text" placeholder="bijv. Let op je linkerschouder: we hebben zone 2 en 3 extra zacht gezet."></div>` : ''}
        ${p === 6 && !(d.levering && d.levering.datum) ? `<div class="field" style="margin:12px 0 0;max-width:240px"><label for="lv-date">Leverdatum</label><input id="lv-date" type="date" value="${isoDay(addDays(new Date(), 14))}"></div>` : ''}
      </div>
      <div class="grid-2" style="grid-template-columns:2fr 1fr;gap:20px;align-items:start">
        <div>
          <h3>Slapers</h3>
          <div class="grid-2" style="gap:14px">${sleeperHtml}</div>
          <h3 style="margin-top:20px">Huidig bed & wensen</h3>
          <p class="small">${esc(d.household.huidigeMaat || '')} · ${esc(d.household.matrasType || '')} op ${esc(d.household.bodem || '')} · ${esc(d.household.matrasLeeftijd)} jaar oud · ervaring: ${esc(d.household.ervaring || '')}<br>
          Wensen: ${esc((d.household.wensen || []).join(', ') || 'geen')} · budget: ${esc(d.household.budget || '–')}</p>
          ${c ? `<h3 style="margin-top:20px">Configuratie ${d.bestelling ? `· besteld (${esc(d.bestelling.nr)})` : '(nog niet besteld)'}</h3>
            <div class="grid-2" style="gap:14px;align-items:center"><div>${SSM.bedFrontSVG(c)}</div><div class="small">${c.breedte}×${c.lengte} · ${c.model} · ${esc((SSM.CATALOG.bodems.find(b => b.key === c.bodem) || {}).naam || '')}<br>
            ${d.bestelling ? `<b>${eur2(d.bestelling.totaal)}</b> · aanbetaald ${eur2(d.bestelling.aanbetaling)}<br>Levering: ${d.levering && d.levering.datum ? fmtDate(d.levering.datum) : 'nog plannen'}` : `<b>${eur2(SSM.priceLines(c, d.betaling.bedrag).totaal)}</b> (offerte)`}
            ${c.blocks.map((b, i) => `<br>${esc((c.namen || [])[i] || 'Matras ' + (i + 1))}: ${b.map(l => SSM.LEVELS[l].kort).join('·')}`).join('')}</div></div>` : ''}
        </div>
        <div><h3>Tijdlijn</h3><ul class="timeline">${(d.events || []).map(e => `<li><time>${fmtDateTime(e.t)} · ${e.wie}</time>${esc(e.tekst)}</li>`).join('')}</ul></div>
      </div>
    </div>`;
    $$('[data-act]', box).forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'vrijgeven') SSF.vrijgeven(d, 'studio', ($('#notitie') || {}).value);
      else if (a === 'leveringPlannen') SSF.leveringPlannen(d, $('#lv-date').value, 'studio');
      else SSF[a](d, 'studio');
      toast(b.textContent.replace(/^[^\wÀ-ÿ]+/, '') + ' ✓');
      render();
    }));
    SSM.bindTips(box);
  }

  render();
})();
