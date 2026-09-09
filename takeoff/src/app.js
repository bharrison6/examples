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
  // Each measurement keeps its own dated window; it is not a common scale.
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
  wireLearning();

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
  $$('#actnav button').forEach(b => Number(b.dataset.act) === n ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current'));
  if (n !== 2) stopPlay();
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
  const floor = window.innerWidth < 850 ? 300 : 340;
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
  $('#round-select').value = String(ix);
  $('#chart-unit').textContent = r.unit === 'min' ? 'Human task time · minutes' : r.unit === '$' ? 'USD / million tokens' : 'Test score · %';

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
  $('#round-example').open = true;

  $('#verdict').hidden = true;
  $('#twist-wrap').hidden = true;
  $('#scorecard').hidden = true;
  $('#round-body').hidden = false;
  $('#btn-reveal').hidden = false;
  $('#btn-reveal').disabled = true;
  $('#btn-redraw').hidden = false;
  $('#btn-next').hidden = true;
  $('#btn-next').textContent = 'Next test';
  $('#draw-hint').textContent = 'Drag across the shaded region, or use arrow keys on the chart.';

  app.chart.setRound(r);
  fitChart();
  app.chart.resize();
  app.chart.reset();
  $('#btn-reveal').disabled = true;
  $('#twist-q').textContent = r.twist ? r.twist.question : '';
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
  const directRatio = res.predicted > 0 ? res.truth / res.predicted : null;
  if (directRatio == null) ratioLine = 'Your estimate was zero, so a ratio is not defined.';
  else if (directRatio >= 1.08) ratioLine = `The published result was <strong>${E.round(directRatio, 1)}×</strong> your estimate.`;
  else if (directRatio <= 0.93) ratioLine = `Your estimate was <strong>${E.round(1 / directRatio, 1)}×</strong> the published result.`;
  else ratioLine = 'You got that one close.';

  v.innerHTML = `
    <div class="v-head ${missed ? 'low' : 'high'}">
      <span class="v-tag">${Math.abs(res.predicted - res.truth) < 0.05 ? 'Your estimate matched' : res.predicted < res.truth ? 'Your estimate was lower' : 'Your estimate was higher'}</span>
      <h3>${esc(r.reveal.headline)}</h3>
    </div>
    <div class="v-nums">
      <div class="v-num"><span class="k">You drew</span><span class="val">${E.fmtValue(res.predicted, r.unit)}</span></div>
      <div class="v-num truth"><span class="k">Published result</span><span class="val">${E.fmtValue(res.truth, r.unit)}</span></div>
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
  (() => {
    const f = tw.finale;
    $('#twist-body').innerHTML = `
      <div class="v-head low">
        <span class="v-tag">Separate comparison · ARC-AGI-3 RHAE</span>
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
        <summary>What this comparison does and does not establish</summary>
        <p>${esc(f.caveat)}</p>
      </details>
      <p class="v-close">${esc(f.close)}</p>
      <div class="v-src">${srcLinks([f.src,'arc-3-openai'])}</div>`;
    $('#btn-next').hidden = false;
    $('#btn-next').textContent = 'See how you did';
  })();
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
    <h2>What did your estimates reveal?</h2>
    <p>You explored ${app.results.filter(Boolean).length} measurements. Compare each estimate with its result; the tests measure different things, so there is no combined capability score.</p>
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
    <p class="sc-note">Which result surprised you, and which caveat changes your interpretation most? An estimate can be high or low. Neither direction is the lesson: the skill is stating what each measurement supports.</p>
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
  $('#model-list').innerHTML = app.timeline.visible().map(m=>`<article><b>${esc(m.name)}</b><p>${esc(m.d)} · ${esc(D.LABS[m.lab].name)} · ${m.open?'Downloadable weights':'Hosted only'}</p><p>${esc(m.lic || '')}</p>${m.src?srcLinks([m.src]):''}</article>`).join('') || '<p>No selected releases match this date and filter.</p>';

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
    $$('#domain-nav button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    $$('[data-domain]').forEach(x => x.hidden = x.dataset.domain !== b.dataset.d);
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
            <span class="verdict">${m.verdict === 'verified' ? 'Published result' : m.verdict === 'disputed' ? 'Contested claim' : 'Claim exceeds evidence'}</span>
            <h3>${esc(m.title)}</h3>
            <span class="mdate">${esc(m.dateLabel || E.fmtDate(E.t(m.date)))}</span>
          </header>
          <p class="what">${esc(m.what)}</p>
          <div class="split">
            <div class="s-machine"><span class="s-k">The machine</span><p>${esc(m.machine)}</p></div>
            <div class="s-human"><span class="s-k">The humans</span><p>${esc(m.human)}</p></div>
          </div>
          ${m.quote ? `<blockquote>“${esc(m.quote)}”<cite>${esc(m.quoteBy)}</cite></blockquote>` : ''}
          ${m.caveat ? `<p class="caveat">${esc(m.caveat)}</p>` : ''}
          <div class="v-src">${srcLinks([m.src].concat(m.extraSrc || []))}</div>
        </article>`).join('')}
    </section>`).join('');

  $('#cut-list').innerHTML = D.CUT.map(c => `
    <li><strong>${esc(c.claim)}</strong><span>${esc(c.why)}</span></li>`).join('');

  $('#domain-nav button')?.click();
}

/* Learning controls use the existing sheet and chart mechanisms. */
function wireLearning() {
  $('#round-select').innerHTML = D.ROUNDS.map((r,i) => `<option value="${i}">${i+1}. ${esc(r.name)}</option>`).join('');
  $('#round-select').addEventListener('change', ev => loadRound(Number(ev.target.value)));
  $('#btn-details').addEventListener('click', ev => {
    const r = D.ROUNDS[app.roundIx];
    const revealed = app.results[app.roundIx] != null && app.chart.state().phase === 'revealed';
    $('#details-title').textContent = r.metric;
    $('#details-metric').textContent = r.real;
    $('#measurement-details').hidden = false;
    $('#explanation-details').hidden = true;
    $('#measurement-caveat').textContent = r.reveal.caveat;
    if(r.limitations) $('#measurement-caveat').innerHTML += `<h3>${esc(r.limitations.title)}</h3><p>${esc(r.limitations.body)}</p>${srcLinks([r.limitations.src])}`;
    $('#measurement-status').textContent = revealed ? 'Shown and revealed measurements. Lines connect selected results; they are not continuous observations.' : 'Only the initially shown measurements appear here. Reveal the chart to inspect the hidden results.';
    const pts = revealed ? E.allPoints(r) : r.shown;
    $('#measurement-table').innerHTML = `<thead><tr><th scope="col">Date / model</th><th scope="col">Value</th><th scope="col">Source / conditions</th></tr></thead><tbody>${pts.map(p=>`<tr><td>${esc(p.date)}<small>${esc(p.label)}</small></td><td>${E.fmtValue(p.value,r.unit)}${p.lo != null ? `<small>Interval: ${p.lo}–${p.hi} ${esc(r.unit)}</small>`:''}</td><td>${srcLinks([p.src].concat(p.extraSrc||[]))}${p.note ? `<small>${esc(p.note)}</small>`:''}</td></tr>`).join('')}</tbody>`;
    openSheet('details',ev.currentTarget);
  });
  const explanations = {
    context: ['A score belongs to a system and a protocol.', 'Read the full setup: model version, prompt, tools, number of attempts, reasoning budget, test subset, and evaluator. Two results labeled with the same benchmark can still use different conditions.', 'The timeline is a selected catalog of release dates. Its company lanes have no ordering by quality. Filters change the visible catalog and counters together. Use the accessible list to inspect each release and source.'],
    transfer: ['A benchmark is evidence about its tasks.', 'Before transferring a result, compare the task, people, workflow, success criteria, and failure costs with your setting. A controlled study answers a narrower question than a claim about all workers.', 'Try a representative set of your own tasks. Compare quality, elapsed time, total cost, and corrections against a baseline. Record failures as well as successes.'],
    forecast: ['These are three assumptions, not three predictions.', 'Let t be years after the second point. The linear rule is 30 + 10t. The compound rule is 30 × 1.5^t. The saturation rule is 75 − 45 × (9/11)^t. All give 20 at t = −1 and 30 at t = 0.', 'The first assumes a fixed yearly gain. The second assumes a fixed proportional gain. The third assumes progress slows toward a chosen ceiling of 75. The two invented observations cannot tell us which assumption will persist.', 'For this toy score, 100 is the measurement ceiling. An extrapolation above 100 is shown numerically as invalid for that scale. A straight line on a logarithmic axis indicates proportional change; it does not prove that change will continue.']
  };
  $$('[data-explain]').forEach(b=>b.addEventListener('click',()=>{
    const [title,...paragraphs] = explanations[b.dataset.explain];
    $('#details-title').textContent=title; $('#measurement-details').hidden=true; $('#explanation-details').hidden=false;
    $('#explanation-details').innerHTML=paragraphs.map(p=>`<p>${esc(p)}</p>`).join(''); openSheet('details',b);
  }));
  $('#scenario-years').addEventListener('input',renderScenario); renderScenario();
}

function renderScenario() {
  const t=Number($('#scenario-years').value);
  $('#scenario-year').textContent=t;
  $('#scenario-results').innerHTML=E.scenarios(t).map(r=>`<article><span>${esc(r.name)}</span><b>${r.value.toFixed(1)}</b><p>${r.value>100?'Above the score ceiling. This rule no longer gives a possible score.':esc(r.note)}</p></article>`).join('');
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
  sheetStack.forEach(s => $('#' + s.id).inert = true);
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
  el.inert = false;
  if (sheetStack.length) $('#' + sheetStack[sheetStack.length - 1].id).inert = false;
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
    if (ev.key === 'Tab' && sheetStack.length) {
      const el = $('#' + sheetStack[sheetStack.length - 1].id);
      const focusable = Array.from(el.querySelectorAll('button,a[href],input,select,summary,[tabindex="0"]')).filter(x=>x.getClientRects().length && !x.disabled);
      const first=focusable[0],last=focusable[focusable.length-1];
      if (ev.shiftKey && (document.activeElement === first || document.activeElement === el.querySelector('.sheet-inner'))) { ev.preventDefault(); last?.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first?.focus(); }
    }
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
  $('#btn-reset').addEventListener('click', resetAll);
}

/* ---- reset ----------------------------------------------------------------
   The state a reload would clear, cleared without a reload — for the presenter
   who has just finished with one room and wants the next one to draw its own
   lines. Nothing is persisted anywhere, so this is the whole of it: the five
   results, the drawn line, the scorecard, the timeline's cursor and filters,
   and the self-test output.

   Two deliberate exceptions, both because a reload is the wrong model here.
   Presentation mode stays on: it describes the projector, not the talk, and
   dropping a presenter back to phone-sized type mid-session would be a bug
   wearing a feature's clothes. And the Guide does not reopen, though it does on
   load — the person pressing Reset is the one person in the room who has read
   it, and putting it back in their face is the opposite of helpful.
   -------------------------------------------------------------------------- */

function resetAll() {
  while (sheetStack.length) closeSheet(sheetStack[sheetStack.length - 1].id);
  stopPlay();

  /* Act I, back to the opening screen. */
  app.roundIx = 0;
  app.results = [];
  app.started = false;
  $('#intro').hidden = false;
  $('#round-body').hidden = true;
  $('#scorecard').hidden = true;
  $('#verdict').hidden = true;
  $('#twist-wrap').hidden = true;
  $('#btn-next').hidden = true;
  $('#round-example').open = false;
  app.chart.setRound(D.ROUNDS[0]);
  app.chart.reset();
  $('#btn-reveal').disabled = true;
  $('#draw-hint').textContent = 'Drag across the shaded region.';

  /* Act II, back to the full timeline with no filter. */
  const slider = $('#tl-slider');
  slider.value = 1000;
  app.timeline.setCursor(1);
  const first = group => {
    const all = $$('#' + group + ' button');
    all.forEach((x, i) => x.classList.toggle('on', i === 0));
    return all[0];
  };
  app.timeline.setFilter(first('tl-filter').dataset.filter);
  app.timeline.setRegion(first('tl-region').dataset.region);
  $('#tl-hover').hidden = true;
  syncTimeline();

  /* Proof panel, back to unrun. */
  $('#selftest-out').innerHTML = '';
  $('#scenario-years').value = '3'; renderScenario();
  $('#domain-nav button')?.click();

  goAct(1);
}

/* ---- self test ------------------------------------------------------------
   The same integrity checks the node suite runs, available from the UI so the
   claim "every number here has a source" can be demonstrated rather than
   asserted, in front of the person asking.
   -------------------------------------------------------------------------- */

function runSelfTest() {
  const out = $('#selftest-out');
  const checks = Validation.check(D,E);

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
