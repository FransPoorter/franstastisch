/* Configurator Beddelicious Blocks-bed */
(function () {
  'use strict';
  const { STORE, $, $$, esc, eur, eur2, fmtDate, mount, getDossier, saveDossier, addEvent, qs, isoDay, addDays, toast, phaseOf, rememberDossier } = SS;
  const { CATALOG, LEVELS, ZONES, PRESETS } = SSM;
  mount('configurator');

  const DRAFT = 'slaapstudio.cfg';
  let d = getDossier(qs('code') || SS.lastDossier());
  const hasAdvice = !!(d && d.meting && d.meting.uitgelezen && d.adviesVrijgegeven);
  if (d && !hasAdvice) d = null; // nog geen vrijgegeven advies: los configureren met voorbeeldprofiel
  if (d) rememberDossier(d.id);
  const ordered = !!(d && d.bestelling);

  let c;
  if (d && d.configuratie) c = JSON.parse(JSON.stringify(d.configuratie));
  else if (d && hasAdvice) c = SSF.defaultConfig(d);
  else {
    try { c = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (e) { c = null; }
    c = c || { personen: 2, breedte: 180, lengte: 210, model: 'M400', tijk: 'Wool', tijken: ['Wool', 'Wool'], namen: ['Links', 'Rechts'], blocks: [PRESETS['Zijligger, smalle heupen'].slice(), PRESETS['Rugligger, gemiddeld'].slice()], bodem: 'vast', hoogte: 19, hoofdbord: 'banen', stof: 'zand', poten: 'eiken', extras: { kussen: true } };
  }
  const advice = d && hasAdvice ? d.sleepers.map(s => d.resultaten[s.id].advies) : null;
  const bouw = d ? d.sleepers.map(s => s.bouw) : ['normaal', 'normaal'];
  let tab = location.hash === '#bestellen' ? 'overzicht' : 'maat';
  let view = 'top';

  const TABS = [['maat', '1. Maat'], ['matras', '2. Matras & blokken'], ['bodem', '3. Bodem'], ['stijl', '4. Uitstraling'], ['extra', '5. Extra'], ['overzicht', '6. Overzicht']];

  function ensureShape() {
    const n = c.personen === 2 ? 2 : 1;
    c.blocks = c.blocks || [];
    while (c.blocks.length < n) c.blocks.push((advice && advice[c.blocks.length] ? advice[c.blocks.length].blocks : PRESETS['Rugligger, gemiddeld']).slice());
    c.tijken = c.tijken || [c.tijk, c.tijk];
    while (c.tijken.length < 2) c.tijken.push(c.tijken[0] || 'Wool');
    c.namen = d ? d.sleepers.map(s => s.naam).concat(['Rechts']).slice(0, 2) : (c.namen || ['Links', 'Rechts']);
    if (!CATALOG.breedtes[n].includes(c.breedte)) c.breedte = n === 2 ? 180 : 90;
    c.tijk = c.tijken[0];
  }

  function changed() {
    ensureShape();
    if (d && !ordered) {
      const first = !d.configuratie;
      d.configuratie = Object.assign(JSON.parse(JSON.stringify(c)), { opgeslagen: true });
      if (first) addEvent(d, 'Bed samengesteld in de configurator', 'klant');
      saveDossier(d);
    } else if (!d) { try { localStorage.setItem(DRAFT, JSON.stringify(c)); } catch (e) {} }
    renderStage(); renderPrice();
  }

  /* ---------------- intro ---------------- */
  function renderIntro() {
    let h;
    if (ordered) h = `<div class="notice dark">Je bed is besteld (${esc(d.bestelling.nr)}). Je bekijkt je bestelde configuratie. Wijzigingen? <a href="#" data-human style="color:#cbe031">Neem contact op met de studio</a>.</div>`;
    else if (d && hasAdvice) h = `<span class="kicker">Ontwerp jouw bed · dossier ${d.id}</span><h1 style="font-size:2rem">${esc(d.sleepers.map(s => s.naam).join(' & '))}, je bed staat al ingesteld</h1>
      <p class="muted" style="max-width:760px">De blokken, de tijk en de lengte komen uit je SlaapID-advies. Kies nu de maat en de uitstraling. Wijk je af van het advies? Dan kijkt een adviseur mee voordat we bestellen.</p>`;
    else h = `<span class="kicker">Ontwerp jouw bed</span><h1 style="font-size:2rem">Stel je Beddelicious Blocks-bed samen</h1>
      <div class="notice sand">Je configureert nu <b>zonder meting</b>, met een voorbeeldprofiel. Voor een bed dat écht op jou is afgesteld begin je met een <a href="aanvragen.html">SlaapID-meting</a>. Die € 75 verrekenen we bij aankoop.</div>`;
    $('#cfg-intro').innerHTML = h;
    $$('[data-human]', $('#cfg-intro')).forEach(b => b.addEventListener('click', e => { e.preventDefault(); $('#human-fab').click(); }));
  }

  /* ---------------- stage ---------------- */
  function renderStage() {
    const n = c.personen === 2 ? 2 : 1;
    const v = $('#stage-view');
    if (view === 'top') {
      const sides = c.blocks.slice(0, n).map((b, i) => ({ levels: b, naam: c.namen[i], bouw: bouw[i] }));
      v.innerHTML = SSM.mattressSVG(sides, c.breedte, c.lengte);
      v.style.maxWidth = n === 2 ? '420px' : '240px';
      $('#stage-extra').innerHTML = `<div style="display:flex;justify-content:center">${SSM.blocksLegend()}</div><p class="small muted center" style="margin:8px 0 0">Klik op een blok om de hardheid te wijzigen. De witte vorm laat zien waar je lichaam ligt.</p>`;
      if (!ordered) $$('.blk', v).forEach(r => { r.style.cursor = 'pointer'; r.addEventListener('click', () => { const s = Number(r.dataset.side), z = Number(r.dataset.zone); c.blocks[s][z] = (c.blocks[s][z] + 1) % 5; changed(); if (tab === 'matras') renderPanel(); }); });
    } else if (view === 'front') {
      v.style.maxWidth = '520px';
      v.innerHTML = SSM.bedFrontSVG(c);
      $('#stage-extra').innerHTML = `<p class="small muted center">${esc(nm('stoffen', c.stof))} · ${esc(nm('hoofdborden', c.hoofdbord))} · ${esc(nm('poten', c.poten))}</p>`;
    } else {
      v.style.maxWidth = '560px';
      v.innerHTML = SSM.bedSideSVG(c);
      const ctl = c.bodem === 'elektrisch' ? `<label class="choice" style="display:inline-block"><input type="checkbox" id="tg-verstel" ${c.verstel ? 'checked' : ''}><span>Toon rugsteun omhoog</span></label>` :
        c.bodem === 'hooglaag' ? `<label class="choice" style="display:inline-block"><input type="checkbox" id="tg-hoog" ${c.hoog ? 'checked' : ''}><span>Toon in hoge stand</span></label>` : '';
      $('#stage-extra').innerHTML = `<div class="center">${ctl}</div>`;
      const a = $('#tg-verstel'), b = $('#tg-hoog');
      if (a) a.addEventListener('change', () => { c.verstel = a.checked; renderStage(); });
      if (b) b.addEventListener('change', () => { c.hoog = b.checked; renderStage(); });
    }
    SSM.bindTips($('.config-stage'));
  }
  const nm = (list, key) => (CATALOG[list].find(x => x.key === key || x.key === Number(key)) || {}).naam || '';

  /* ---------------- panelen ---------------- */
  const opt = (name, list, val, sub, priceFn) => `<div class="choices wide">${list.map(o => `<label class="choice"><input type="radio" name="${name}" value="${o.key}" ${String(val) === String(o.key) ? 'checked' : ''} ${ordered ? 'disabled' : ''}><span>${o.naam}${o.sub ? `<small>${o.sub}</small>` : ''}${priceFn ? `<small><b>${priceFn(o)}</b></small>` : ''}</span></label>`).join('')}</div>`;

  const P = {
    maat() {
      const n = c.personen === 2 ? 2 : 1;
      const advLen = advice ? Math.max(...advice.map(a => a.lengte)) : null;
      return `<h2>Maat</h2>
        <div class="field"><label>Voor hoeveel personen?</label>${opt('personen', [{ key: 1, naam: 'Eenpersoons', sub: 'één matras' }, { key: 2, naam: 'Tweepersoons', sub: 'twee matrassen, ieder eigen instelling' }], n)}</div>
        <div class="field"><label>Breedte ${n === 2 ? '<span class="hint">totaal, verdeeld over twee matrassen</span>' : ''}</label>${opt('breedte', CATALOG.breedtes[n].map(b => ({ key: b, naam: b + ' cm', sub: n === 2 ? `2 × ${b / 2} cm` : '' })), c.breedte)}</div>
        <div class="field"><label>Lengte ${advLen ? `<span class="hint">advies: minimaal ${advLen} cm (je lengte + 25 cm)</span>` : ''}</label>${opt('lengte', CATALOG.lengtes.map(l => ({ key: l, naam: l + ' cm', sub: advLen && l < advLen ? 'korter dan advies' : advLen === l ? '✓ advies' : '' })), c.lengte)}</div>
        ${d && d.household && d.household.huidigeMaat ? `<p class="small muted">Je huidige bed: ${esc(d.household.huidigeMaat)} cm.</p>` : ''}`;
    },
    matras() {
      const n = c.personen === 2 ? 2 : 1;
      let h = `<h2>Matras & blokken</h2>
        <div class="field"><label>Model</label>${opt('model', CATALOG.modellen, c.model, null, o => 'vanaf ' + eur(SSM.matrasPrijs(o.key, 90, 200)))}</div>
        <img src="img/blocks-hardheden.png" alt="De vijf Blocks-hardheden: _xfirm, _firm, _medium, _soft en _xsoft" style="max-width:300px;margin:0 auto 10px" loading="lazy" onerror="this.style.display='none'">`;
      for (let i = 0; i < n; i++) {
        const adv = advice && advice[i];
        const afwijk = adv && adv.blocks.some((v, z) => v !== c.blocks[i][z]);
        h += `<div class="q-group"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="margin:0">${n === 2 ? esc(c.namen[i]) + (d ? '' : (i ? ' (rechterhelft)' : ' (linkerhelft)')) : 'Jouw matras'}</h3>
          ${adv ? (afwijk ? `<span class="tag warn">aangepast t.o.v. advies</span>` : `<span class="tag lime">✓ volgens SlaapID-advies</span>`) : ''}</div>
          <div class="field" style="margin-top:12px"><label>Tijk ${adv ? `<span class="hint">advies: ${adv.tijk}</span>` : ''}</label>
          <div class="choices">${CATALOG.tijken.map(t => `<label class="choice"><input type="radio" name="tijk${i}" value="${t.key}" ${c.tijken[i] === t.key ? 'checked' : ''} ${ordered ? 'disabled' : ''}><span>${t.naam}${adv && adv.tijk === t.key ? ' ✓' : ''}<small>${t.sub}${t.prijs ? ' · +' + eur(t.prijs) : ''}</small></span></label>`).join('')}</div></div>
          <label>Hardheid per zone</label>
          <div class="zone-editor">${ZONES.map((zn, z) => `<div class="zone-row"><span>${z + 1}. ${zn}${adv && adv.blocks[z] !== c.blocks[i][z] ? ' <b style="color:var(--warn)">•</b>' : ''}</span><div class="lv">${LEVELS.map((L, lv) => `<button type="button" class="${c.blocks[i][z] === lv ? 'on' : ''}" style="background:${L.color};color:${L.text}" data-s="${i}" data-z="${z}" data-l="${lv}" title="${L.label}${adv && adv.blocks[z] === lv ? ' (advies)' : ''}" ${ordered ? 'disabled' : ''}>${L.kort}${adv && adv.blocks[z] === lv ? '✓' : ''}</button>`).join('')}</div></div>`).join('')}</div>
          ${!ordered ? `<div class="btn-row" style="margin-top:10px">${adv ? `<button class="btn btn-outline btn-sm" type="button" data-reset="${i}">Terug naar SlaapID-advies</button>` : ''}
            <select data-preset="${i}" style="max-width:260px"><option value="">${adv ? 'Of kies een voorbeeldprofiel…' : 'Kies een voorbeeldprofiel…'}</option>${Object.keys(PRESETS).map(p => `<option>${p}</option>`).join('')}</select></div>` : ''}
          ${afwijk ? `<div class="notice sand small">Je wijkt af van het advies. Prima, want het is jouw bed. Een adviseur belt je even voordat we bestellen.</div>` : ''}
        </div>`;
      }
      return h;
    },
    bodem() {
      const n = c.personen === 2 ? 2 : 1;
      const w = d && d.household ? d.household.wensen || [] : [];
      return `<h2>Bodem</h2><p class="muted">De Blockspring B2000 heeft dezelfde instelbare pocketveringkern als je matras. Zo werken matras en bodem samen.</p>
        <div class="field"><label>Type ${w.length ? `<span class="hint">je wens: ${w.map(x => ({ elektrisch: 'elektrisch verstelbaar', hooginstap: 'hoge instap', langer: 'langer', breder: 'breder' }[x])).join(', ')}</span>` : ''}</label>${opt('bodem', CATALOG.bodems, c.bodem, null, o => o.prijs ? '+ ' + eur(o.perHelft ? o.prijs * n : o.prijs) : 'inbegrepen')}</div>
        <div class="field"><label>Hoogte bodem</label>${opt('hoogte', CATALOG.hoogtes, c.hoogte, null, o => o.prijs ? '+ ' + eur(o.prijs) : 'inbegrepen')}</div>
        <p class="small muted">Tip: bekijk het zijaanzicht links om de verstelling te zien.</p>`;
    },
    stijl() {
      const st = CATALOG.stoffen.find(x => x.key === c.stof);
      return `<h2>Uitstraling</h2>
        <div class="field"><label>Hoofdbord</label>${opt('hoofdbord', CATALOG.hoofdborden, c.hoofdbord, null, o => o.prijs ? '+ ' + eur(o.prijs * (c.breedte > 160 ? 1.2 : 1)) : '')}</div>
        <div class="field"><label>Meubelstof</label><div class="swatches">${CATALOG.stoffen.map(s => `<label class="swatch" title="${s.naam}"><input type="radio" name="stof" value="${s.key}" ${c.stof === s.key ? 'checked' : ''} ${ordered ? 'disabled' : ''}><span style="background:${s.hex}${s.textuur ? ';background-image:radial-gradient(#d6cfc2 1px, transparent 1.5px);background-size:6px 6px' : ''}"></span></label>`).join('')}</div>
          <div class="swatch-label">${st.naam}${st.prijs ? ' · + ' + eur(st.prijs) : ''}</div></div>
        <div class="field"><label>Poten</label>${opt('poten', CATALOG.poten, c.poten, null, o => o.prijs ? '+ ' + eur(o.prijs) : 'inbegrepen')}</div>
        <div class="notice small">Wil je de stoffen voelen? In de studio in Nijkerk liggen alle stalen. <a href="#" data-human>Plan een studiobezoek</a></div>`;
    },
    extra() {
      const n = c.personen === 2 ? 2 : 1;
      const ex = c.extras || {};
      return `<h2>Extra</h2><div class="choices wide">${CATALOG.extras.map(e => {
        const q = e.perPersoon || e.perMatras ? n : 1;
        return `<label class="choice"><input type="checkbox" name="extra" value="${e.key}" ${ex[e.key] ? 'checked' : ''} ${ordered ? 'disabled' : ''}><span>${e.naam}<small>${q > 1 ? q + ' × ' : ''}${eur(e.prijs)}${e.key === 'kussen' && advice ? ' · ' + esc(advice[0].kussen) : ''}</small></span></label>`;
      }).join('')}</div>`;
    },
    overzicht() {
      const pr = price();
      return `<h2>Overzicht</h2>
        <table class="summary-table">${pr.lines.map(l => `<tr><td>${esc(l.label)}</td><td>${l.bedrag ? eur2(l.bedrag) : 'inbegrepen'}</td></tr>`).join('')}
        <tr><td><b>Subtotaal</b></td><td><b>${eur2(pr.subtotaal)}</b></td></tr>
        ${pr.korting ? `<tr class="discount"><td>SlaapID-onderzoek verrekend</td><td>− ${eur2(pr.korting)}</td></tr>` : ''}
        <tr class="total"><td>Totaal</td><td>${eur2(pr.totaal)}</td></tr></table>
        <p class="small muted">Indicatieve prijzen voor deze demo. Inclusief btw, bezorgen, montage en afstellen.</p>
        ${ordered ? '' : d ? `<div class="btn-row" style="margin-top:16px"><button class="btn btn-primary" type="button" id="ov-order">Bestellen</button><button class="btn btn-outline" data-human type="button">Liever eerst overleggen</button></div>`
          : `<div class="notice sand">Om te bestellen heb je een SlaapID-meting nodig. Daarmee stellen we de blokken op jóu af. <a href="aanvragen.html">Start je meting</a></div>`}`;
    }
  };

  function renderTabs() {
    $('#cfg-tabs').innerHTML = TABS.map(t => `<button type="button" class="${t[0] === tab ? 'active' : ''}" data-tab="${t[0]}">${t[1]}</button>`).join('');
    $$('#cfg-tabs button').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; renderTabs(); renderPanel(); }));
  }

  function renderPanel() {
    const idx = TABS.findIndex(t => t[0] === tab);
    $('#cfg-panel').innerHTML = P[tab]() + `<div class="wizard-nav">${idx > 0 ? `<button class="btn btn-ghost" type="button" data-go="${TABS[idx - 1][0]}">← ${TABS[idx - 1][1].replace(/^\d\. /, '')}</button>` : '<span></span>'}${idx < TABS.length - 1 ? `<button class="btn btn-dark" type="button" data-go="${TABS[idx + 1][0]}">${TABS[idx + 1][1].replace(/^\d\. /, '')} →</button>` : ''}</div>`;
    const panel = $('#cfg-panel');
    $$('input[type=radio]', panel).forEach(r => r.addEventListener('change', () => {
      const k = r.name, v = r.value;
      if (k === 'personen') { c.personen = Number(v); ensureShape(); }
      else if (['breedte', 'lengte', 'hoogte'].includes(k)) c[k] = Number(v);
      else if (/^tijk\d$/.test(k)) c.tijken[Number(k.slice(4))] = v;
      else if (k === 'bodem') { c.bodem = v; view = 'side'; syncViewTabs(); }
      else if (k === 'stof' || k === 'hoofdbord' || k === 'poten') { c[k] = v; if (view === 'top') { view = 'front'; syncViewTabs(); } }
      else c[k] = v;
      changed(); renderPanel();
    }));
    $$('input[name=extra]', panel).forEach(cb => cb.addEventListener('change', () => { c.extras = c.extras || {}; c.extras[cb.value] = cb.checked; changed(); }));
    $$('.zone-row button', panel).forEach(b => b.addEventListener('click', () => { c.blocks[b.dataset.s][b.dataset.z] = Number(b.dataset.l); if (view !== 'top') { view = 'top'; syncViewTabs(); } changed(); renderPanel(); }));
    $$('[data-reset]', panel).forEach(b => b.addEventListener('click', () => { const i = Number(b.dataset.reset); c.blocks[i] = advice[i].blocks.slice(); c.tijken[i] = advice[i].tijk; changed(); renderPanel(); toast('Teruggezet naar je SlaapID-advies'); }));
    $$('[data-preset]', panel).forEach(s => s.addEventListener('change', () => { if (!s.value) return; c.blocks[Number(s.dataset.preset)] = PRESETS[s.value].slice(); changed(); renderPanel(); }));
    $$('[data-go]', panel).forEach(b => b.addEventListener('click', () => { tab = b.dataset.go; renderTabs(); renderPanel(); window.scrollTo({ top: $('#cfg-tabs').getBoundingClientRect().top + scrollY - 100, behavior: 'smooth' }); }));
    $$('[data-human]', panel).forEach(b => b.addEventListener('click', e => { e.preventDefault(); $('#human-fab').click(); }));
    const oo = $('#ov-order'); if (oo) oo.addEventListener('click', openOrder);
  }
  function syncViewTabs() { $$('#view-tabs button').forEach(x => x.classList.toggle('active', x.dataset.view === view)); }
  $$('#view-tabs button').forEach(b => b.addEventListener('click', () => { view = b.dataset.view; syncViewTabs(); renderStage(); }));

  function price() { return SSM.priceLines(c, d && d.betaling ? d.betaling.bedrag : 0); }
  function renderPrice() {
    const pr = price();
    $('#pb-total').textContent = eur(pr.totaal);
    $('#pb-sub').textContent = pr.korting ? `incl. ${eur(pr.korting)} verrekend onderzoek` : 'incl. bezorgen en afstellen';
    $('#pb-save').style.display = d && !ordered ? '' : 'none';
    $('#pb-order').textContent = ordered ? 'Bekijk bestelling' : d ? 'Bestellen' : 'Start SlaapID-meting';
  }
  $('#pb-save').addEventListener('click', () => { changed(); toast('Bewaard in dossier ' + d.id); });
  $('#pb-order').addEventListener('click', () => {
    if (ordered) { location.href = 'dossier.html?code=' + d.id; return; }
    if (!d) { location.href = 'aanvragen.html'; return; }
    openOrder();
  });

  /* ---------------- bestellen ---------------- */
  function openOrder() {
    const pr = price();
    const min = isoDay(addDays(new Date(), 28));
    const afwijk = advice && c.blocks.some((b, i) => advice[i] && advice[i].blocks.some((v, z) => v !== b[z]));
    const m = $('#order-modal');
    $('#order-body').innerHTML = `<span class="kicker">Bestellen</span><h2>Bijna klaar!</h2>
      <div class="grid-2" style="gap:16px;align-items:center"><div>${SSM.bedFrontSVG(c)}</div><div><p style="font-size:1.6rem;font-weight:700;margin:0">${eur2(pr.totaal)}</p><p class="small muted">${pr.korting ? 'na ' + eur(pr.korting) + ' verrekening onderzoek' : ''}</p></div></div>
      ${afwijk ? '<div class="notice sand small">Je blokinstelling wijkt af van het SlaapID-advies. Een adviseur belt je even voordat de order de deur uitgaat.</div>' : ''}
      <div class="field"><label>Gewenste leverdatum <span class="hint">levertijd ongeveer 4 weken; we maken het bed op order</span></label><input type="date" id="o-date" min="${min}" value="${min}"></div>
      <div class="field"><label>Aanbetaling (25%) via iDEAL</label><p style="margin:0"><b>${eur2(Math.round(pr.totaal * 0.25))}</b> nu, de rest bij levering.</p></div>
      <label class="choice" style="display:block;margin-bottom:18px"><input type="checkbox" id="o-av"><span>Ik ga akkoord met de algemene voorwaarden en de instelgarantie</span></label>
      <div class="btn-row"><button class="btn btn-primary" id="o-go" type="button">Bestel en betaal aanbetaling</button><button class="btn btn-ghost" data-close type="button">Annuleren</button></div>`;
    m.classList.add('open');
    $('#o-go').addEventListener('click', () => {
      if (!$('#o-av').checked) { toast('Vink de voorwaarden aan'); return; }
      const btn = $('#o-go'); btn.disabled = true; btn.textContent = 'Doorsturen naar iDEAL…';
      setTimeout(() => {
        SSF.bestellen(d, c, pr, $('#o-date').value);
        if (afwijk) addEvent(d = getDossier(d.id), 'Let op: blokinstelling wijkt af van advies – adviseur belt klant', 'systeem'), saveDossier(d);
        try { localStorage.removeItem(DRAFT); } catch (e) {}
        location.href = 'dossier.html?code=' + d.id;
      }, 1500);
    });
  }
  $('#order-modal').addEventListener('click', e => { if (e.target.id === 'order-modal' || e.target.hasAttribute('data-close')) $('#order-modal').classList.remove('open'); });

  ensureShape();
  renderIntro(); renderTabs(); renderPanel(); renderStage(); renderPrice();
  if (location.hash === '#bestellen' && d && !ordered) setTimeout(openOrder, 300);
})();
