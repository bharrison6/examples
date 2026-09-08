/* ==========================================================================
   Undershoot — application.

   Three acts. Act I explains what a benchmark is to people who have never
   seen one, then asks the viewer to draw five of them and reveals the truth
   over each guess. Act II shows the models those curves came out of. Act III
   shows what these systems have actually done across six domains and a short Elsewhere round-up, with the
   overclaims and the failures kept beside the results.
   ========================================================================== */

(() => {

const E = ENGINE;
const D = DATA;
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const app = {
  act: 1,
  roundIx: 0,
  results: [],
  started: false,
  chart: null,
  timeline: null,
  playing: null,
  big: false
};

/* ---- boot ---------------------------------------------------------------- */

function boot() {
  app.chart = Chart.create($('#chart'));
  app.chart.setAxisEnd(D.AXIS_END);
  app.timeline = Timeline.create($('#tl'), D);

  app.chart.state().onDraw = () => {
    $('#btn-reveal').disabled = false;
    $('#draw-hint').textContent = 'Happy with it? Reveal.';
  };

  buildIntro();
  wireNav();
  wireRound();
  wireTimeline();
  wireSheets();
  wireSettings();
  buildAct3();
  buildSources();

  window.addEventListener('resize', () => { fitChart(); app.chart.resize(); app.timeline.resize(); });
  window.addEventListener('orientationchange', () => setTimeout(fitChart, 120));

  /* The how-to is shown on every load, not once. Remembering that it has been
     seen would mean storing something, and this app stores nothing at all —
     there is an integration check asserting localStorage is never touched. */
  openSheet('howto', $('#btn-howto'));
}

/* ---- the opening screen -------------------------------------------------- */

function buildIntro() {
  const I = D.INTRO;
  $('#intro-title').textContent = I.title;
  $('#intro-body').innerHTML = I.body.map(p => `<p>${esc(p)}</p>`).join('');
  $('#intro-note').textContent = I.note;
  $('#btn-begin').textContent = I.cta;
  $('#btn-begin').addEventListener('click', () => {
    $('#intro').hidden = true;
    $('#round-body').hidden = false;
    app.started = true;
    loadRound(0);
  });
}

/* ---- navigation ---------------------------------------------------------- */

function wireNav() {
  $$('#actnav button').forEach(b => {
    b.addEventListener('click', () => goAct(Number(b.dataset.act)));
  });
}

function goAct(n) {
  app.act = n;
  $$('#actnav button').forEach(b => b.classList.toggle('on', Number(b.dataset.act) === n));
  $$('.act').forEach(s => s.hidden = Number(s.dataset.act) !== n);
  if (n === 1 && app.started) setTimeout(() => { fitChart(); app.chart.resize(); }, 20);
  if (n === 2) { setTimeout(() => app.timeline.resize(), 20); syncTimeline(); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* The one layout rule this app enforces: the chart and the Reveal button are
   both reachable without scrolling. Everything above the chart varies in
   height — each round's explanation is a different length and wraps
   differently at every width — so the chart's height is measured rather than
   declared. A CSS-only version put Reveal below the fold at five of eight
   viewports. */
function fitChart() {
  const wrap = $('#chart-wrap');
  const row  = $('#draw-row');
  const leg  = document.querySelector('.legend-mini');
  if (!wrap || !row || $('#round-body').hidden) return;

  wrap.style.height = '';
  const top = wrap.getBoundingClientRect().top;
  const note = $('#scale-note');
  const below = row.getBoundingClientRect().height
              + (leg ? leg.getBoundingClientRect().height : 0)
              + (note && !note.hidden ? note.getBoundingClientRect().height + 8 : 0)
              + 26;
  const avail = window.innerHeight - top - below;
  const max = app.big ? 620 : 500;
  /* The fold rule holds for the round as it first appears. Once someone opens
     the worked example they have asked for more content, and squeezing the
     chart to a 150px sliver to keep the button on screen serves nobody — so
     the floor rises and the page is allowed to scroll. */
  const open = $('#round-example').open;
  const floor = open ? 240 : 120;
  wrap.style.height = Math.round(E.clamp(avail, floor, max)) + 'px';
}

/* ---- Act I: the rounds --------------------------------------------------- */

function wireRound() {
  $('#btn-reveal').addEventListener('click', doReveal);
  $('#btn-next').addEventListener('click', () => {
    if (app.roundIx < D.ROUNDS.length - 1) loadRound(app.roundIx + 1);
    else showScorecard();
  });
  $('#btn-redraw').addEventListener('click', () => {
    app.chart.reset();
    $('#btn-reveal').disabled = true;
    $('#draw-hint').textContent = 'Drag across the shaded region.';
  });
  $('#btn-twist').addEventListener('click', doTwist);
  /* Opening the example changes the height above the chart, so the fold rule
     has to be re-applied when it does. */
  $('#round-example').addEventListener('toggle', () => { fitChart(); app.chart.resize(); });
}

function loadRound(ix) {
  app.roundIx = ix;
  const r = D.ROUNDS[ix];

  $('#round-num').textContent = `Test ${ix + 1} of ${D.ROUNDS.length}`;
  $('#round-name').textContent = r.name;
  $('#round-real').textContent = r.real || '';
  $('#round-real').hidden = !r.real;
  $('#round-plain').textContent = r.plain;
  $('#round-human').innerHTML = `<span class="rh-k">For comparison</span><p>${esc(r.human)}</p>`;
  $('#round-q').textContent = r.question;

  /* Log rounds carry a plain-language warning about the vertical scale. It
     lives here rather than on the canvas because rotated text in the axis
     gutter collided with the tick labels. */
  const note = $('#scale-note');
  note.hidden = !r.scaleNote;
  note.textContent = r.scaleNote || '';

  const ex = r.example;
  $('#example-label').textContent = ex.label;
  $('#example-body').innerHTML = renderExample(ex);
  $('#round-example').open = false;

  $('#verdict').hidden = true;
  $('#twist-wrap').hidden = true;
  $('#scorecard').hidden = true;
  $('#round-body').hidden = false;
  $('#btn-reveal').hidden = false;
  $('#btn-reveal').disabled = true;
  $('#btn-redraw').hidden = false;
  $('#btn-next').hidden = true;
  $('#btn-next').textContent = 'Next test';
  $('#draw-hint').textContent = 'Drag across the shaded region.';

  app.chart.setRound(r);
  fitChart();
  app.chart.resize();
  app.chart.reset();
  $('#btn-reveal').disabled = true;
}

/* A concrete sample of the actual task. For a room that has never seen any of
   this measured, "94% on GPQA" means nothing until they have seen one item. */
function renderExample(ex) {
  if (ex.kind === 'text') {
    return `<p class="ex-text">${esc(ex.body).replace(/\n\n/g, '</p><p class="ex-text">')}</p>` +
           (ex.note ? `<p class="ex-note">${esc(ex.note)}</p>` : '');
  }
  if (ex.kind === 'ladder') {
    return `<div class="ladder">${ex.items.map(i =>
      `<div class="lrow"><span class="lt">${esc(i.t)}</span><span class="ls">${esc(i.s)}</span></div>`).join('')}</div>`;
  }
  if (ex.kind === 'arc') {
    const pairs = ex.pairs.map((p, i) => `
      <div class="arc-pair">
        <span class="arc-cap">Example ${i + 1}</span>
        <div class="arc-row">${grid(p.in)}<span class="arc-arrow">&rarr;</span>${grid(p.out)}</div>
      </div>`).join('');
    return `<div class="arc-wrap">
        ${pairs}
        <div class="arc-pair test">
          <span class="arc-cap">Now you</span>
          <div class="arc-row">${grid(ex.test)}<span class="arc-arrow">&rarr;</span>
            <button class="arc-reveal" id="arc-reveal">?</button>
            <div class="arc-answer" id="arc-answer" hidden>${grid(ex.answer)}</div>
          </div>
        </div>
      </div>
      ${ex.note ? `<p class="ex-note">${esc(ex.note)}</p>` : ''}`;
  }
  return '';
}

/* ARC colours. Deliberately not the Murray State palette — these are the
   puzzle's own vocabulary and must not read as meaning anything else. */
const ARC_COLORS = ['#0B1B2E', '#3B82F6', '#EF4444', '#22C55E', '#EAB308', '#94A3B8', '#D946EF', '#F97316'];

function grid(g) {
  return `<div class="arc-grid" style="grid-template-columns:repeat(${g[0].length},1fr)">` +
    g.map(row => row.map(c => `<i style="background:${ARC_COLORS[c] || ARC_COLORS[0]}"></i>`).join('')).join('') +
    `</div>`;
}

/* Delegated: the answer button is rebuilt on every round load. */
document.addEventListener('click', ev => {
  if (ev.target && ev.target.id === 'arc-reveal') {
    ev.target.hidden = true;
    const a = document.querySelector('#arc-answer');
    if (a) a.hidden = false;
    fitChart(); app.chart.resize();
  }
});

function doReveal() {
  const r = D.ROUNDS[app.roundIx];
  const res = E.score(r, app.chart.guess());
  app.results[app.roundIx] = res;

  $('#btn-reveal').hidden = true;
  $('#btn-redraw').hidden = true;
  $('#draw-hint').textContent = '';

  app.chart.reveal(() => {
    renderVerdict(r, res);
    $('#verdict').hidden = false;
    if (r.twist) { $('#twist-wrap').hidden = false; $('#btn-twist').hidden = false; $('#twist-body').hidden = true; }
    else $('#btn-next').hidden = false;
    $('#verdict').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function renderVerdict(r, res) {
  const v = $('#verdict');
  const ratio = res.ratio;
  const missed = res.under;

  let ratioLine;
  if (!isFinite(ratio)) ratioLine = 'You drew a flat line. The real answer moved.';
  else if (ratio >= 1.08) ratioLine = `The real answer was <strong>${E.round(ratio, 1)}×</strong> what you drew.`;
  else if (ratio <= 0.93) ratioLine = `You drew it <strong>${E.round(1 / ratio, 1)}×</strong> too high. That is rarer than you would think.`;
  else ratioLine = 'You got that one close.';

  v.innerHTML = `
    <div class="v-head ${missed ? 'low' : 'high'}">
      <span class="v-tag">${missed ? (res.falling ? 'You did not expect it to fall that far' : 'You guessed low') : 'You guessed high'}</span>
      <h3>${esc(r.reveal.headline)}</h3>
    </div>
    <div class="v-nums">
      <div class="v-num"><span class="k">You drew</span><span class="val">${E.fmtValue(res.predicted, r.unit)}</span></div>
      <div class="v-num truth"><span class="k">It actually was</span><span class="val">${E.fmtValue(res.truth, r.unit)}</span></div>
      ${res.points != null && isFinite(res.points) ? `<div class="v-num"><span class="k">Gap</span><span class="val">${E.round(Math.abs(res.points), 1)} pts</span></div>` : ''}
    </div>
    <p class="v-ratio">${ratioLine}</p>
    <p class="v-body">${esc(r.reveal.body)}</p>
    <details class="v-caveat" open>
      <summary>What this number does not say</summary>
      <p>${esc(r.reveal.caveat)}</p>
    </details>
    <div class="v-src">${srcLinks(collectSrcs(r))}</div>`;
}

function doTwist() {
  const r = D.ROUNDS[app.roundIx];
  const tw = r.twist;
  $('#btn-twist').hidden = true;
  $('#twist-body').hidden = false;
  app.chart.twist(() => {
    const f = tw.finale;
    $('#twist-body').innerHTML = `
      <div class="v-head low">
        <span class="v-tag">And the test turned over</span>
        <h3>${esc(f.headline)}</h3>
      </div>
      <p class="v-body what-is">${esc(f.what)}</p>
      <p class="v-body">${esc(f.body)}</p>
      <div class="bars">
        ${f.bars.map(b => `
          <div class="bar-row">
            <span class="bl">${esc(b.label)}<em>${esc(b.note)}</em></span>
            <div class="bt"><div class="bf ${esc(b.kind)}" style="width:${Math.max(b.value, 0.7)}%"></div></div>
            <span class="bv">${b.value}%</span>
          </div>`).join('')}
      </div>
      <p class="v-punch">${esc(f.punch)}</p>
      <details class="v-caveat" open>
        <summary>Why these bars are not four measurements of one thing</summary>
        <p>${esc(f.caveat)}</p>
      </details>
      <p class="v-close">${esc(f.close)}</p>
      <div class="v-src">${srcLinks(['arc-3-openai', 'arc-3', 'arc-3-human', 'arc-agi2', 'arc-2025'])}</div>`;
    $('#btn-next').hidden = false;
    $('#btn-next').textContent = 'See how you did';
  });
}

function showScorecard() {
  const med = E.medianRatio(app.results);
  const lows = app.results.filter(r => r && r.under).length;
  $('#round-body').hidden = true;
  $('#verdict').hidden = true;
  $('#twist-wrap').hidden = true;
  $('#btn-next').hidden = true;
  const sc = $('#scorecard');
  sc.hidden = false;
  sc.innerHTML = `
    <h2>You guessed low in ${lows} of ${app.results.filter(Boolean).length} tests.</h2>
    ${med ? `<p class="big-stat">Median miss: <strong>${E.round(med, 1)}×</strong></p>` : ''}
    <div class="sc-rows">
      ${D.ROUNDS.map((r, i) => {
        const res = app.results[i];
        if (!res) return '';
        return `<div class="sc-row">
          <span class="n">${esc(r.name)}</span>
          <span class="g">${E.fmtValue(res.predicted, r.unit)}</span>
          <span class="arrow">→</span>
          <span class="t">${E.fmtValue(res.truth, r.unit)}</span>
          <span class="r ${res.under ? 'low' : 'high'}">${isFinite(res.ratio) ? E.round(res.ratio, 1) + '×' : '—'}</span>
        </div>`;
      }).join('')}
    </div>
    <p class="sc-note">
      If you drew most of these too low, you are in good company — that is the usual
      result, and it is the point. The surprise is rarely that the numbers went up; it
      is by how much, and that even people who follow this closely tend to undershoot.
      The one test that broke the pattern was the last: the same kind of model, in the
      same months, went from nearly solving a puzzle to barely scoring on a harder
      version of it. “How good is AI” was never a single rising line.
    </p>
    <div class="sc-actions">
      <button class="btn primary" id="btn-toact2b">See the models behind these tests</button>
      <button class="btn ghost" id="btn-again2">Play again</button>
    </div>`;
  $('#btn-toact2b').addEventListener('click', () => goAct(2));
  $('#btn-again2').addEventListener('click', () => { app.results = []; loadRound(0); });
}

function collectSrcs(r) {
  const s = new Set();
  E.allPoints(r).forEach(p => p.src && s.add(p.src));
  (r.markers || []).forEach(p => p.src && s.add(p.src));
  if (r.id === 'metr') s.add('mittr-metr');
  return Array.from(s);
}

/* ---- Act II: the cadence ------------------------------------------------- */

function wireTimeline() {
  const slider = $('#tl-slider');
  slider.addEventListener('input', () => {
    stopPlay();
    app.timeline.setCursor(Number(slider.value) / 1000);
    syncTimeline();
  });
  $('#btn-play').addEventListener('click', togglePlay);
  $$('#tl-filter button').forEach(b => b.addEventListener('click', () => {
    $$('#tl-filter button').forEach(x => x.classList.toggle('on', x === b));
    app.timeline.setFilter(b.dataset.filter);
    syncTimeline();
  }));
  $$('#tl-region button').forEach(b => b.addEventListener('click', () => {
    $$('#tl-region button').forEach(x => x.classList.toggle('on', x === b));
    app.timeline.setRegion(b.dataset.region);
    syncTimeline();
  }));
  app.timeline.onHover(m => {
    const el = $('#tl-hover');
    if (!m) { el.hidden = true; return; }
    el.hidden = false;
    const lab = D.LABS[m.lab];
    el.innerHTML = `<strong>${esc(m.name)}</strong>
      <span class="lab">${esc(lab.name)} · ${esc(lab.region)} · ${m.open ? 'downloadable' : 'rented only'}</span>
      ${m.lic ? `<span class="lic">${esc(m.lic)}</span>` : ''}
      <span class="date">${E.fmtDate(E.t(m.d))}${m.approx ? ' (approx.)' : ''}</span>
      ${m.note ? `<span class="note">${esc(m.note)}</span>` : ''}`;
  });
  $('#btn-toact3').addEventListener('click', () => goAct(3));
  buildLegend();
}

function togglePlay() {
  if (app.playing) return stopPlay();
  const slider = $('#tl-slider');
  if (Number(slider.value) >= 1000) slider.value = 0;
  $('#btn-play').textContent = 'Pause';
  app.playing = setInterval(() => {
    const v = Number(slider.value) + 3;
    if (v >= 1000) { slider.value = 1000; app.timeline.setCursor(1); syncTimeline(); return stopPlay(); }
    slider.value = v;
    app.timeline.setCursor(v / 1000);
    syncTimeline();
  }, 28);
}

function stopPlay() {
  clearInterval(app.playing);
  app.playing = null;
  $('#btn-play').textContent = 'Play';
}

function syncTimeline() {
  const s = app.timeline.stats();
  $('#tl-date').textContent = E.fmtDate(app.timeline.cursorDate());
  $('#tl-total').textContent = s.total;
  $('#tl-year').textContent = s.year;
  $('#tl-open').textContent = s.open;

  const u = app.timeline.latestUnlock();
  const box = $('#tl-unlock');
  if (!u) { box.hidden = true; return; }
  box.hidden = false;
  const bad = u.flag === 'walked back' || u.flag === 'counterweight';
  box.innerHTML = `
    <span class="u-date">${E.fmtDate(u.at)}</span>
    <h4>${esc(u.title)}${u.flag ? `<span class="flag ${bad ? 'bad' : ''}">${esc(u.flag)}</span>` : ''}</h4>
    <p>${esc(u.body)}</p>
    <div class="v-src">${srcLinks([u.src])}</div>`;
}

function buildLegend() {
  const seen = new Set(D.MODELS.map(m => m.lab));
  $('#tl-legend').innerHTML = Object.entries(D.LABS)
    .filter(([k]) => seen.has(k))
    .map(([, l]) => `<span class="lg"><i style="background:hsl(${l.hue},68%,58%)"></i>${esc(l.name)}</span>`)
    .join('');
}

/* ---- Act III: what it can do --------------------------------------------- */

function buildAct3() {
  $('#domain-nav').innerHTML = D.DOMAINS.map(d =>
    `<button data-d="${esc(d.id)}">${esc(d.name)}</button>`).join('');
  $$('#domain-nav button').forEach(b => b.addEventListener('click', () => {
    const el = document.querySelector(`[data-domain="${b.dataset.d}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  $('#domains').innerHTML = D.DOMAINS.map(d => `
    <section class="domain" data-domain="${esc(d.id)}">
      <header class="dhead">
        <h2>${esc(d.name)}</h2>
        <p>${esc(d.lede)}</p>
      </header>
      ${d.items.map(m => `
        <article class="mcard ${esc(m.verdict)}">
          <header>
            <span class="verdict">${m.verdict === 'verified' ? 'Verified' : m.verdict === 'disputed' ? 'Disputed' : 'Overclaimed'}</span>
            <h3>${esc(m.title)}</h3>
            <span class="mdate">${E.fmtDate(E.t(m.date))}</span>
          </header>
          <p class="what">${esc(m.what)}</p>
          <div class="split">
            <div class="s-machine"><span class="s-k">The machine</span><p>${esc(m.machine)}</p></div>
            <div class="s-human"><span class="s-k">The humans</span><p>${esc(m.human)}</p></div>
          </div>
          ${m.quote ? `<blockquote>“${esc(m.quote)}”<cite>${esc(m.quoteBy)}</cite></blockquote>` : ''}
          ${m.caveat ? `<p class="caveat">${esc(m.caveat)}</p>` : ''}
          <div class="v-src">${srcLinks([m.src].concat(m.src === 'erdos1196' ? ['erdos1196-tao'] : []))}</div>
        </article>`).join('')}
    </section>`).join('');

  $('#cut-list').innerHTML = D.CUT.map(c => `
    <li><strong>${esc(c.claim)}</strong><span>${esc(c.why)}</span></li>`).join('');

  $('#closer-gap').textContent = D.CLOSERS.gapMonths;
  $('#closer-gap-note').textContent = D.CLOSERS.gapNote;
  $('#closer-doubling').textContent = D.CLOSERS.doubling;
  $('#closer-doubling-note').textContent = D.CLOSERS.doublingNote;

  const metr = D.ROUNDS.find(r => r.id === 'metr');
  const fit = E.doublingDays(E.allPoints(metr));
  $('#closer-fit').textContent = fit ? Math.round(fit) : '—';
}

/* ---- sources ------------------------------------------------------------- */

function buildSources() {
  $('#source-list').innerHTML = Object.entries(D.SOURCES)
    .sort((a, b) => a[1].t.localeCompare(b[1].t))
    .map(([, s]) => `<li><a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a></li>`)
    .join('');
}

function srcLinks(keys) {
  return keys.filter(k => D.SOURCES[k])
    .map(k => `<a href="${esc(D.SOURCES[k].u)}" target="_blank" rel="noopener">${esc(D.SOURCES[k].t)}</a>`)
    .join('<span class="dot">·</span>');
}

/* ---- sheets: how-to, settings, presenter's notes --------------------------
   Three overlays, one discipline. The page behind goes inert so a stray tab
   cannot land on a control nobody can see, focus moves into the sheet, Escape
   closes the topmost one, tapping the dimmed area closes it — which is what a
   phone user tries first — and focus returns to whatever opened it. Sheets
   stack, because the presenter's notes open from inside settings.
   -------------------------------------------------------------------------- */

const sheetStack = [];

function openSheet(id, opener) {
  const el = $('#' + id);
  if (!el || !el.hidden) return;
  el.hidden = false;
  sheetStack.push({ id, from: opener || null });
  $('#brandbar').inert = true;
  document.querySelector('main').inert = true;
  document.body.classList.add('modal-open');
  el.querySelector('.sheet-inner').focus();
}

function closeSheet(id) {
  const el = $('#' + id);
  if (!el || el.hidden) return;
  el.hidden = true;
  const ix = sheetStack.findIndex(s => s.id === id);
  const rec = ix < 0 ? null : sheetStack.splice(ix, 1)[0];
  if (!sheetStack.length) {
    $('#brandbar').inert = false;
    document.querySelector('main').inert = false;
    document.body.classList.remove('modal-open');
  }
  /* Back where it came from — but only if that control is still on the page
     and is not itself sitting inside something that has just gone inert. */
  const from = rec && rec.from;
  if (from && document.contains(from) && !from.closest('[inert]')) from.focus();
}

function wireSheets() {
  const opens = id => ev => openSheet(id, ev.currentTarget);
  $('#btn-howto').addEventListener('click', opens('howto'));
  $('#btn-howto-2').addEventListener('click', opens('howto'));
  $('#btn-settings').addEventListener('click', opens('settings'));
  $('#btn-notes').addEventListener('click', opens('notes'));

  $$('[data-close]').forEach(b => b.addEventListener('click', () => closeSheet(b.dataset.close)));

  $$('.overlay').forEach(o => o.addEventListener('click', ev => {
    if (ev.target === o) closeSheet(o.id);
  }));

  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape' || !sheetStack.length) return;
    ev.preventDefault();
    closeSheet(sheetStack[sheetStack.length - 1].id);
  });
}

/* ---- settings ------------------------------------------------------------ */

function wireSettings() {
  $('#chk-presenter').addEventListener('change', ev => {
    app.big = ev.target.checked;
    document.body.classList.toggle('presenter', app.big);
    fitChart();
    app.chart.setBig(app.big);
    app.timeline.setBig(app.big);
  });
  $('#btn-selftest').addEventListener('click', runSelfTest);
}

/* ---- self test ------------------------------------------------------------
   The same integrity checks the node suite runs, available from the UI so the
   claim "every number here has a source" can be demonstrated rather than
   asserted, in front of the person asking.
   -------------------------------------------------------------------------- */

function runSelfTest() {
  const out = $('#selftest-out');
  const checks = [];
  const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail: detail || '' });

  const allItems = D.DOMAINS.reduce((a, d) => a.concat(d.items), []);

  /* 1. every datum resolves to a source */
  const orphans = [];
  const walk = (arr, where) => (arr || []).forEach(p => {
    if (!p.src) orphans.push(where + ': ' + (p.label || p.title || p.d || '?'));
    else if (!D.SOURCES[p.src]) orphans.push(where + ': dangling src "' + p.src + '"');
  });
  D.ROUNDS.forEach(r => { walk(r.shown, r.id); walk(r.hidden, r.id); walk(r.markers, r.id); if (r.twist) walk(r.twist.series, r.id + '/twist'); });
  walk(D.UNLOCKS, 'unlocks');
  walk(allItems, 'act3');
  ok('Every plotted point and result resolves to a source', orphans.length === 0, orphans.slice(0, 4).join('; '));

  /* 2. no source is declared and never used */
  const used = new Set();
  const mark = arr => (arr || []).forEach(p => p.src && used.add(p.src));
  D.ROUNDS.forEach(r => { mark(r.shown); mark(r.hidden); mark(r.markers); if (r.twist) mark(r.twist.series); });
  mark(D.UNLOCKS); mark(allItems);
  ['mittr-metr', 'erdos1196-tao', 'hle', 'nolima', 'kimi-k3', 'gemma', 'olmo', 'cursor', 'gpt-oss',
   'arc-3', 'arc-3-human',
   D.CLOSERS.gapSrc, D.CLOSERS.doublingSrc].forEach(k => used.add(k));
  const unused = Object.keys(D.SOURCES).filter(k => !used.has(k));
  ok('No source is declared and never used', unused.length === 0, unused.join(', '));

  /* 3. series run forward in time */
  const disorder = [];
  D.ROUNDS.forEach(r => {
    const pts = E.allPoints(r);
    for (let i = 1; i < pts.length; i++) if (E.t(pts[i].date) < E.t(pts[i - 1].date)) disorder.push(r.id);
  });
  ok('Every series runs forward in time', disorder.length === 0, disorder.join(', '));

  /* 4. the shown/hidden split is honest */
  const bad = [];
  D.ROUNDS.forEach(r => {
    if (E.t(r.hidden[0].date) < E.t(r.shown[r.shown.length - 1].date)) bad.push(r.id);
  });
  ok('Hidden data always follows the shown data', bad.length === 0, bad.join(', '));

  /* 5. every round is explained before it is asked */
  const unexplained = D.ROUNDS.filter(r => !r.plain || !r.example || !r.human || !r.xLabel || !r.yLabel).map(r => r.id);
  ok('Every test is explained, exemplified and has both axes labelled', unexplained.length === 0, unexplained.join(', '));

  /* 6. every Act III result splits machine from human */
  const nosplit = allItems.filter(m => !m.machine || !m.human).map(m => m.title);
  ok('Every result says what the machine did AND what the humans did', nosplit.length === 0, nosplit.join(', '));

  /* 7. Act III is not one domain wearing a hat */
  ok('Act III covers at least five domains', D.DOMAINS.length >= 5, D.DOMAINS.length + ' domains');
  ok('Act III includes results that did not work', allItems.some(m => m.verdict !== 'verified'));

  /* 8. scoring behaves */
  const r0 = D.ROUNDS[0];
  ok('Scoring is monotone in the guess',
     E.score(r0, E.emptyGuess(0.2)).ratio > E.score(r0, E.emptyGuess(0.6)).ratio);
  const scale = E.makeScale(r0.scale, r0.yMin, r0.yMax);
  const pr = E.score(r0, E.emptyGuess(scale.to(E.finalValue(r0)))).ratio;
  ok('A perfect guess scores 1.0×', Math.abs(pr - 1) < 0.02, pr.toFixed(3));

  /* 9. prose agrees with the plot */
  const metr = D.ROUNDS.find(r => r.id === 'metr');
  const fit = E.doublingDays(E.allPoints(metr));
  ok('The plotted points imply the doubling time Act III quotes',
     fit / D.CLOSERS.doubling > 0.5 && fit / D.CLOSERS.doubling < 2,
     Math.round(fit) + ' days fitted vs ' + D.CLOSERS.doubling + ' published');

  /* 10. nothing below 'reported' is on screen */
  const weak = [];
  const allow = new Set(['primary', 'reported', 'disputed']);
  const grade = arr => (arr || []).forEach(p => { if (p.status && !allow.has(p.status)) weak.push(p.label || p.title); });
  D.ROUNDS.forEach(r => { grade(r.shown); grade(r.hidden); grade(r.markers); });
  grade(D.UNLOCKS); grade(allItems);
  ok('Nothing rated below "reported" is displayed', weak.length === 0, weak.join(', '));

  /* 11. the timeline actually covers the open-weight world */
  const openCount = D.MODELS.filter(m => m.open).length;
  const regions = new Set(D.MODELS.map(m => D.LABS[m.lab].region));
  ok('The timeline is majority downloadable models', openCount > D.MODELS.length / 2,
     openCount + ' of ' + D.MODELS.length);
  ok('The timeline spans every region', regions.size >= 4, Array.from(regions).join(', '));

  const pass = checks.filter(c => c.pass).length;
  out.innerHTML = `<div class="st-head ${pass === checks.length ? 'good' : 'bad'}">${pass} / ${checks.length} checks passed</div>` +
    checks.map(c => `<div class="st-row ${c.pass ? 'good' : 'bad'}">
      <span>${c.pass ? '✓' : '✕'}</span><span>${esc(c.name)}</span>
      ${c.detail ? `<em>${esc(c.detail)}</em>` : ''}</div>`).join('');
  checks.forEach(c => console.log((c.pass ? 'PASS  ' : 'FAIL  ') + c.name + (c.detail ? '  — ' + c.detail : '')));
  return checks;
}

/* ---- util ---------------------------------------------------------------- */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.__undershoot = { app, runSelfTest, goAct, loadRound, openSheet, closeSheet,
                        begin: () => $('#btn-begin').click(),
                        tlLabels: () => Timeline.labels(), D, E };

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
