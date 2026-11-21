/* Slaappartner Slaapstudio – kern: opslag, layout, contact, hulpfuncties.
   POC: alle data staat in localStorage van deze browser. */
(function () {
  'use strict';

  const DB_KEY = 'slaapstudio.db.v1';

  const STORE = {
    naam: 'Beddenspecialist Frans Poorter',
    studio: 'Slaappartner Slaapstudio',
    straat: 'Verlaat 6',
    postcode: '3861 AA',
    plaats: 'Nijkerk',
    tel: '033-2451332',
    telHref: 'tel:+31332451332',
    whatsapp: 'https://wa.me/31332451332',
    email: 'franspoorter@beddenspecialist.nl',
    route: 'https://www.google.com/maps/dir//Frans+Poorter%2cVerlaat+6%2c3861AA%2c+Nijkerk',
    facebook: 'https://www.facebook.com/FransPoorterbeddenspecialist',
    instagram: 'https://www.instagram.com/beddenspecialistfranspoorter',
    winkelpagina: 'https://www.beddenspecialist.nl/frans-poorter/',
    uren: [
      ['Maandag', 'Gesloten'],
      ['Dinsdag', '10:00 – 17:30'],
      ['Woensdag', '10:00 – 17:30'],
      ['Donderdag', '10:00 – 17:30'],
      ['Vrijdag', '10:00 – 17:30'],
      ['Zaterdag', '10:00 – 17:00'],
      ['Zondag', 'Gesloten']
    ],
    onderzoekPrijs: 75,
    nachten: 3
  };

  const PHASES = [
    { n: 1, key: 'ontdekken', label: 'Ontdekken' },
    { n: 2, key: 'aanvragen', label: 'Aanvragen' },
    { n: 3, key: 'meting', label: 'Thuismeting' },
    { n: 4, key: 'advies', label: 'Resultaat & advies' },
    { n: 5, key: 'kopen', label: 'Configureren & kopen' },
    { n: 6, key: 'levering', label: 'Levering & afstellen' },
    { n: 7, key: 'nazorg', label: 'Nazorg' }
  ];

  /* ---------------- opslag ---------------- */
  function emptyDb() { return { version: 1, dossiers: [], contacts: [], scans: [] }; }

  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return emptyDb();
      const db = JSON.parse(raw);
      return Object.assign(emptyDb(), db);
    } catch (e) { return emptyDb(); }
  }
  function save(db) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { console.warn('Opslaan mislukt', e); }
  }
  function getDossier(id) {
    if (!id) return null;
    id = String(id).trim().toUpperCase();
    return load().dossiers.find(d => d.id === id) || null;
  }
  function saveDossier(dos) {
    const db = load();
    const i = db.dossiers.findIndex(d => d.id === dos.id);
    dos.updated = new Date().toISOString();
    if (i >= 0) db.dossiers[i] = dos; else db.dossiers.unshift(dos);
    save(db);
    return dos;
  }
  function deleteAll() { try { localStorage.removeItem(DB_KEY); } catch (e) {} }
  function newCode() {
    const db = load();
    let code;
    do { code = 'SS-' + String(Math.floor(1000 + Math.random() * 9000)); }
    while (db.dossiers.some(d => d.id === code));
    return code;
  }
  function addEvent(dos, tekst, wie, when) {
    dos.events = dos.events || [];
    dos.events.unshift({ t: when || new Date().toISOString(), tekst, wie: wie || 'systeem' });
  }
  function rememberDossier(id) { try { localStorage.setItem('slaapstudio.last', id); } catch (e) {} }
  function lastDossier() { try { return localStorage.getItem('slaapstudio.last'); } catch (e) { return null; } }

  /* Afgeleide fase van een dossier */
  function phaseOf(d) {
    if (!d) return 1;
    if (!d.betaling || !d.betaling.betaald) return 2;
    if (!d.meting || !d.meting.uitgelezen) return 3;
    if (!d.bestelling) return (d.configuratie && d.configuratie.opgeslagen) ? 5 : 4;
    if (!d.levering || !d.levering.afgesteld) return 6;
    return 7;
  }
  function statusText(d) {
    const p = phaseOf(d);
    const m = d.meting || {};
    const s = d.sensor || {};
    if (p === 2) return 'Wacht op betaling';
    if (p === 3) {
      if (m.retour) return 'Sensor retour – wacht op uitlezen';
      if (s.status === 'bij_klant') return (m.nachten || 0) === 0 ? 'Sensor bij klant – nog niet gestart' : `Meten: nacht ${m.nachten} van ${STORE.nachten}`;
      if (s.status === 'onderweg') return 'Sensor onderweg per post';
      if (s.status === 'klaar_ophalen') return 'Sensor klaar om op te halen';
      return s.methode === 'ophalen' ? 'Sensor klaarzetten voor ophalen' : 'Sensor verzenden';
    }
    if (p === 4) return d.adviesVrijgegeven ? 'Advies bij klant – nog niet geconfigureerd' : 'Meting uitgelezen – advies nog vrijgeven';
    if (p === 5) return 'Bed samengesteld – nog niet besteld';
    if (p === 6) return d.levering && d.levering.datum ? `Levering gepland ${fmtDate(d.levering.datum)}` : 'Besteld – levering inplannen';
    if (p === 7) {
      const n = d.nazorg || {};
      if (n.herhaal && n.herhaal.klaar) return 'Herhaalmeting afgerond';
      if (n.herhaal) return 'Herhaalmeting loopt';
      return 'Bed afgesteld – nazorg';
    }
    return '';
  }

  /* ---------------- hulpfuncties ---------------- */
  const eur = n => '€ ' + Math.round(n).toLocaleString('nl-NL');
  const eur2 = n => '€ ' + Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function fmtDate(iso, opts) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('nl-NL', opts || { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function fmtDateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }
  function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
  function isoDay(d) { const x = new Date(d); return x.toISOString().slice(0, 10); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function toast(msg) {
    let t = document.getElementById('ss-toast');
    if (!t) { t = document.createElement('div'); t.id = 'ss-toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------------- layout ---------------- */
  function header(active) {
    const nav = [
      ['index.html', 'Slaapstudio', 'home'],
      ['index.html#methode', 'Zo werkt het', 'methode'],
      ['aanvragen.html', 'SlaapID aanvragen', 'aanvragen'],
      ['configurator.html', 'Ontwerp jouw bed', 'configurator'],
      ['dossier.html', 'Mijn dossier', 'dossier'],
      ['index.html#winkel', 'Studio Nijkerk', 'winkel']
    ];
    return `
    <div class="topbar"><div class="wrap">
      <span class="rating"><b>9,7</b> klanten vertellen</span>
      <span><a href="${STORE.telHref}">☎ ${STORE.tel}</a> &nbsp;·&nbsp; ${STORE.straat}, ${STORE.plaats}</span>
      <span><a href="studio.html">Studio-login (adviseur)</a></span>
    </div></div>
    <header class="site-header"><div class="wrap">
      <a class="brand" href="index.html" aria-label="Naar de Slaapstudio">
        <img src="img/beddenspecialist.svg" alt="Beddenspecialist">
        <span class="brand-text"><strong>Frans Poorter</strong><span>Beddenspecialist Nijkerk</span><em>Slaappartner Slaapstudio</em></span>
      </a>
      <button class="nav-toggle" aria-label="Menu" onclick="document.querySelector('.main-nav').classList.toggle('open')">☰</button>
      <nav class="main-nav">
        ${nav.map(n => `<a href="${n[0]}" class="${n[2] === active ? 'active' : ''}">${n[1]}</a>`).join('')}
        <a class="btn btn-primary btn-sm" href="aanvragen.html">Start je SlaapID</a>
      </nav>
    </div></header>`;
  }

  function footer() {
    return `
    <footer class="site-footer"><div class="wrap">
      <div class="cols">
        <div>
          <img src="img/beddenspecialist.svg" alt="" style="width:56px;filter:invert(1) grayscale(1) brightness(1.6);margin-bottom:12px">
          <p><strong style="color:#fff">${STORE.studio}</strong><br>een proeftuin van ${STORE.naam}. Wij weten door te meten: één bed, afgesteld op jouw gemeten slaap.</p>
          <span class="poc-flag">PROOF OF CONCEPT</span>
        </div>
        <div><h4>Slaapstudio</h4><ul>
          <li><a href="aanvragen.html">SlaapID thuismeting aanvragen</a></li>
          <li><a href="configurator.html">Ontwerp jouw Blocks-bed</a></li>
          <li><a href="dossier.html">Mijn slaapdossier</a></li>
          <li><a href="index.html#scan">SlaapKwaliteitScore</a></li>
        </ul></div>
        <div><h4>Contact</h4><ul>
          <li>${STORE.straat}</li><li>${STORE.postcode} ${STORE.plaats}</li>
          <li><a href="${STORE.telHref}">${STORE.tel}</a></li>
          <li><a href="mailto:${STORE.email}">${STORE.email}</a></li>
        </ul></div>
        <div><h4>Volg ons</h4><ul>
          <li><a href="${STORE.facebook}" target="_blank" rel="noopener">Facebook</a></li>
          <li><a href="${STORE.instagram}" target="_blank" rel="noopener">Instagram</a></li>
          <li><a href="${STORE.winkelpagina}" target="_blank" rel="noopener">Winkel op beddenspecialist.nl</a></li>
        </ul></div>
      </div>
      <div class="legal"><span>© ${new Date().getFullYear()} ${STORE.naam} · Kies bewust voor je nachtrust</span>
      <span>Demo: gegevens blijven in deze browser · <a href="#" id="ss-reset">demo-data wissen</a></span></div>
    </div></footer>`;
  }

  function humanModal() {
    return `
    <button class="human-fab" id="human-fab" type="button"><span class="face">☺</span><span class="label">Liever persoonlijk contact?</span></button>
    <div class="modal-back" id="human-modal" role="dialog" aria-modal="true" aria-labelledby="hm-title">
      <div class="modal">
        <button class="close" type="button" data-close aria-label="Sluiten">×</button>
        <span class="kicker">Altijd een mens als je dat wilt</span>
        <h2 id="hm-title">Even persoonlijk overleggen?</h2>
        <p class="muted">Onze ligexperts en slaapfysio denken graag met je mee. Kies hoe je contact wilt.</p>
        <form id="human-form">
          <div class="choices wide" style="margin-bottom:16px">
            <label class="choice"><input type="radio" name="kanaal" value="Terugbellen" checked><span><span class="ico">☎</span>Bel mij terug<small>Binnen 1 werkdag</small></span></label>
            <label class="choice"><input type="radio" name="kanaal" value="WhatsApp"><span><span class="ico">💬</span>WhatsApp<small>Snel een vraag stellen</small></span></label>
            <label class="choice"><input type="radio" name="kanaal" value="Videogesprek"><span><span class="ico">🎥</span>Videogesprek<small>Advies vanaf de bank</small></span></label>
            <label class="choice"><input type="radio" name="kanaal" value="Studiobezoek"><span><span class="ico">🛏</span>Studiobezoek<small>Stalen voelen, proefliggen</small></span></label>
          </div>
          <div class="row-2">
            <div class="field"><label for="hm-naam">Naam</label><input id="hm-naam" name="naam" type="text" required></div>
            <div class="field"><label for="hm-tel">Telefoon</label><input id="hm-tel" name="tel" type="tel" required></div>
          </div>
          <div class="row-2" id="hm-when">
            <div class="field"><label for="hm-datum">Voorkeursdag</label><input id="hm-datum" name="datum" type="date"></div>
            <div class="field"><label for="hm-tijd">Tijd</label><select id="hm-tijd" name="tijd"><option>Ochtend</option><option>Middag</option><option>Eind van de middag</option></select></div>
          </div>
          <div class="field"><label for="hm-vraag">Waar kunnen we je mee helpen?</label><textarea id="hm-vraag" name="vraag" rows="3"></textarea></div>
          <div class="btn-row"><button class="btn btn-primary" type="submit">Verstuur verzoek</button>
          <a class="btn btn-ghost" href="${STORE.telHref}">of bel direct ${STORE.tel}</a></div>
        </form>
      </div>
    </div>`;
  }

  function bindHuman() {
    const modal = $('#human-modal');
    const open = () => {
      const d = getDossier(qs('code') || lastDossier());
      if (d && d.contact) { $('#hm-naam').value = d.contact.naam || ''; $('#hm-tel').value = d.contact.tel || ''; }
      $('#hm-datum').value = isoDay(addDays(new Date(), 1));
      modal.classList.add('open');
    };
    $('#human-fab').addEventListener('click', open);
    $$('[data-human]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); open(); }));
    modal.addEventListener('click', e => { if (e.target === modal || e.target.hasAttribute('data-close')) modal.classList.remove('open'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') modal.classList.remove('open'); });
    $('#human-form').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const db = load();
      const dosId = qs('code') || lastDossier();
      const req = {
        id: 'C' + Date.now(), t: new Date().toISOString(), kanaal: f.get('kanaal'), naam: f.get('naam'), tel: f.get('tel'),
        datum: f.get('datum'), tijd: f.get('tijd'), vraag: f.get('vraag'), pagina: document.title, fase: window.SS_PAGE || '',
        dossier: db.dossiers.some(d => d.id === dosId) ? dosId : null, afgehandeld: false
      };
      db.contacts.unshift(req);
      if (req.dossier) {
        const d = db.dossiers.find(x => x.id === req.dossier);
        addEvent(d, `Contactverzoek: ${req.kanaal}${req.vraag ? ' – “' + req.vraag + '”' : ''}`, 'klant');
      }
      save(db);
      modal.classList.remove('open');
      e.target.reset();
      toast(`Dank je! We nemen contact op via ${req.kanaal.toLowerCase()}.`);
    });
  }

  function mount(active, opts) {
    opts = opts || {};
    window.SS_PAGE = active;
    const h = document.getElementById('ss-header');
    if (h) h.outerHTML = header(active);
    const f = document.getElementById('ss-footer');
    if (f) f.outerHTML = footer();
    if (!opts.noHuman) {
      document.body.insertAdjacentHTML('beforeend', humanModal());
      bindHuman();
    }
    const r = document.getElementById('ss-reset');
    if (r) r.addEventListener('click', e => {
      e.preventDefault();
      if (confirm('Alle demo-dossiers in deze browser wissen?')) { deleteAll(); try { localStorage.removeItem('slaapstudio.last'); } catch (x) {} location.reload(); }
    });
  }

  window.SS = {
    STORE, PHASES, load, save, getDossier, saveDossier, deleteAll, newCode, addEvent, phaseOf, statusText,
    rememberDossier, lastDossier, eur, eur2, fmtDate, fmtDateTime, addDays, isoDay, esc, qs, $, $$, toast, mount
  };
})();
