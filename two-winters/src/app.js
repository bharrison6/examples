/* ==========================================================================
   AI Winters: Boom and Bust — the application.

   Four acts:
     I   Guess the year — ten sourced claims, date and speaker hidden.
     II  The two winters — a scrubbable comparison timeline.
     III Anatomy — historical conditions and current evidence side by side.
     IV  Rhymes and differences, the cut list, and every source.

   No framework, no build-time templating beyond concatenation, no network.
   ========================================================================== */

(() => {

const D = DATA, E = ENGINE;
const $  = s => document.querySelector(s);
const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));

/* Session state. Nothing is persisted anywhere — reloading resets the app,
   and the app stores nothing on the device. */
const S = {
  act: 1,
  i: 0,                       /* index into D.CARDS */
  answers: {},                /* id -> { year, verdict } */
  pending: { year: 1985, verdict: null },
  revealed: false,
  presenter: false,
  tl: null
};

/* ---------------------------------------------------------------- helpers */

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/** A source chip. Every claim on screen gets one; the self-test proves the
 *  id resolves. Links carry rel=noopener because they leave the app. */
function srcChip(id) {
  const s = D.SOURCES[id];
  const a = el('a', 'src');
  if (!s) { a.textContent = 'source missing: ' + id; a.classList.add('bad'); return a; }
  a.href = s.u; a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.textContent = 'source';
  a.title = s.t;
  return a;
}

function statusChip(status) {
  const b = el('span', 'status ' + status);
  b.textContent = status;
  b.title = status === 'primary'
    ? 'Checked against the document itself during the build.'
    : 'A specific retrievable secondary source that names its own underlying scholarship.';
  return b;
}

function paras(parent, list) {
  for (const p of list) parent.appendChild(el('p', null, p));
}

/* ================================ ACT I ================================= */

function renderIntro() {
  $('#intro-title').textContent = D.INTRO.title;
  const b = $('#intro-body'); b.innerHTML = '';
  paras(b, D.INTRO.body);
  $('#intro-note').textContent = D.INTRO.note;
  $('#btn-begin').textContent = D.INTRO.cta;
}

const VERDICTS = [
  { id: 'yes',  label: 'It came true' },
  { id: 'no',   label: 'It didn’t' },
  { id: 'open', label: 'Still open' }
];
const ASSESSMENT_CHOICES = [
  { id: 'context', label: 'A dated assessment' },
  { id: 'no', label: 'A forecast about the future' },
  { id: 'open', label: 'I need more context' }
];

function renderCard() {
  const c = D.CARDS[S.i];
  S.revealed = false;
  const prior = S.answers[c.id];
  S.pending = prior ? { year: prior.year, verdict: prior.verdict } : { year: 1985, verdict: null };

  $('#card-count').textContent = `${S.i + 1} / ${D.CARDS.length}`;
  $('#card-quote').textContent = c.quote;
  $('#card-note').textContent = c.note || '';
  $('#card-note').hidden = !c.note;

  $('#guess-wrap').hidden = false;
  $('#reveal-wrap').hidden = true;
  $('#btn-lock').hidden = false;
  /* Locked until a verdict is chosen: the year slider always has a value, so
     without this the button would happily accept a half-answer. */
  $('#btn-lock').disabled = !S.pending.verdict;
  $('#btn-next-card').hidden = true;

  const sl = $('#year-slider');
  sl.value = String(S.pending.year);
  $('#year-read').textContent = String(S.pending.year);

  const assessment = c.verdict === 'context';
  $('#verdict-prompt').textContent = assessment
    ? 'What kind of claim is this?'
    : 'And did it come true within the time it named?';
  const vb = $('#verdict-btns'); vb.innerHTML = '';
  for (const v of assessment ? ASSESSMENT_CHOICES : VERDICTS) {
    const b = el('button', 'vbtn', v.label);
    b.type = 'button';
    b.dataset.v = v.id;
    b.setAttribute('aria-pressed', String(S.pending.verdict === v.id));
    if (S.pending.verdict === v.id) b.classList.add('on');
    b.addEventListener('click', () => {
      S.pending.verdict = v.id;
      $$('#verdict-btns .vbtn').forEach(x => {
        const on = x.dataset.v === v.id;
        x.classList.toggle('on', on);
        x.setAttribute('aria-pressed', String(on));
      });
      $('#btn-lock').disabled = false;
    });
    vb.appendChild(b);
  }

  $('#card-progress').style.width = ((S.i) / D.CARDS.length * 100) + '%';
  $('#scorecard').hidden = true;
  $('#card-body').hidden = false;
}

function lockIn() {
  const c = D.CARDS[S.i];
  if (!S.pending.verdict) return;
  S.answers[c.id] = { year: +S.pending.year, verdict: S.pending.verdict };
  S.revealed = true;
  renderReveal();
}

const VERDICT_CLASS = { yes: 'good', no: 'bad', late: 'mixed', open: 'openv', context: 'mixed' };
const VERDICT_WORD  = { yes: 'It came true', no: 'It did not', late: 'True, but far too late', open: 'Still open', context: 'A dated assessment' };
const KIND_WORD = {
  promise: 'a confident promise',
  assessment: 'a contemporary assessment',
  warning: 'a warning'
};

function renderReveal() {
  const c = D.CARDS[S.i], a = S.answers[c.id];
  const miss = E.yearMiss(a.year, c.year);
  const band = E.missBand(miss);
  const assessment = c.verdict === 'context';
  const right = assessment ? a.verdict === 'context' : E.verdictCorrect(a.verdict, c.verdict);

  $('#guess-wrap').hidden = true;
  $('#btn-lock').hidden = true;
  $('#btn-next-card').hidden = false;
  $('#btn-next-card').textContent = S.i === D.CARDS.length - 1 ? 'See how you did' : 'Next prediction';

  const w = $('#reveal-wrap'); w.innerHTML = ''; w.hidden = false;

  const head = el('div', 'rv-head');
  head.appendChild(el('div', 'rv-year', String(c.year)));
  const who = el('div', 'rv-who');
  who.appendChild(el('b', null, c.who));
  who.appendChild(el('span', null, c.role));
  who.appendChild(el('em', null, c.where));
  head.appendChild(who);
  w.appendChild(head);

  const marks = el('div', 'rv-marks');

  const m1 = el('div', 'mark ' + (band === 'close' ? 'good' : band === 'near' ? 'mixed' : 'dist'));
  m1.appendChild(el('b', null, miss === 0 ? 'Exact' : miss + (miss === 1 ? ' year out' : ' years out')));
  m1.appendChild(el('span', null, E.BAND_TEXT[band]));
  marks.appendChild(m1);

  const m2 = el('div', 'mark ' + (right === null ? 'openv' : right ? 'good' : 'bad'));
  m2.appendChild(el('b', null, assessment ? (right ? 'Classified correctly' : 'Read the distinction') : right === null ? 'Not scored' : right ? 'Verdict right' : 'Verdict wrong'));
  m2.appendChild(el('span', null, assessment
    ? (right ? 'It diagnoses conditions at a date; it is not a future forecast.' : 'Read the reveal: this evaluates conditions at a date rather than predicting what must happen next.')
    : right === null
    ? 'This one has not resolved. Nobody is marked on it.'
    : 'You said ' + VERDICT_WORD[a.verdict].toLowerCase() + '.'));
  marks.appendChild(m2);
  w.appendChild(marks);

  const verdict = el('div', 'rv-verdict ' + VERDICT_CLASS[c.verdict]);
  verdict.appendChild(el('b', null, c.verdictLine));
  verdict.appendChild(el('span', 'rv-kind', 'This was ' + KIND_WORD[c.kind] + '.'));
  w.appendChild(verdict);

  w.appendChild(el('p', 'rv-what', c.what));

  const foot = el('div', 'rv-foot');
  foot.appendChild(statusChip(c.status));
  foot.appendChild(srcChip(c.src));
  const st = D.SOURCES[c.src];
  if (st) foot.appendChild(el('span', 'src-title', st.t));
  w.appendChild(foot);

  $('#card-progress').style.width = ((S.i + 1) / D.CARDS.length * 100) + '%';
}

function nextCard() {
  if (S.i < D.CARDS.length - 1) { S.i++; renderCard(); scrollActTop(); }
  else renderScorecard();
}

function renderScorecard() {
  const acc = E.tally(D.CARDS, S.answers);
  const box = $('#scorecard'); box.innerHTML = ''; box.hidden = false;
  $('#card-body').hidden = true;

  box.appendChild(el('h2', null, 'How you did'));
  box.appendChild(el('p', 'lead', E.verdictSentence(acc)));

  const grid = el('div', 'sc-grid');
  const stat = (n, unit, cap) => {
    const d = el('div', 'sc');
    const v = el('div', 'sc-n'); v.appendChild(el('span', 'num', n));
    if (unit) v.appendChild(el('span', 'unit', unit));
    d.appendChild(v); d.appendChild(el('span', 'cap', cap));
    return d;
  };
  grid.appendChild(stat(String(acc.verdictRight) + '/' + String(acc.scored), '', 'verdicts called right'));
  grid.appendChild(stat(acc.medianMiss == null ? '—' : acc.medianMiss.toFixed(1), 'years', 'average miss on the date'));
  grid.appendChild(stat(String(acc.open), '', 'unscored: unresolved forecasts or assessments'));
  box.appendChild(grid);

  /* The split that carries the argument. */
  const split = el('div', 'sc-split');
  const row = (kind, title, blurb) => {
    const k = acc.byKind[kind];
    const r = el('div', 'sc-row');
    r.appendChild(el('b', null, title));
    r.appendChild(el('span', 'sc-score', k ? `${k.right} of ${k.n}` : 'none answered'));
    const bar = el('div', 'sc-bar');
    const fill = el('i');
    fill.style.width = k && k.n ? (k.right / k.n * 100) + '%' : '0%';
    fill.className = kind === 'promise' ? 'p' : kind === 'dismiss' ? 'd' : 'wn';
    bar.appendChild(fill);
    r.appendChild(bar);
    r.appendChild(el('span', 'sc-blurb', blurb));
    return r;
  };
  split.appendChild(row('promise', 'Time-bounded promises', 'Five claims named a near-term outcome. Three have resolved, and none arrived inside the window it named.'));
  split.appendChild(row('warning', 'A warning about the field itself', 'One time-bounded warning. It was right, three years early.'));
  const assessment = el('div', 'sc-row');
  assessment.appendChild(el('b', null, 'Dated assessments'));
  assessment.appendChild(el('span', 'sc-score', '4 to inspect, not score'));
  assessment.appendChild(el('span', 'sc-blurb', 'The 1958 press claim, ALPAC, Perceptrons, and Lighthill lack a scoreable future window or describe evidence at a time. Later developments do not turn them into failed forecasts.'));
  split.appendChild(assessment);
  box.appendChild(split);

  box.appendChild(el('p', 'sc-tail',
    'The useful habit is to ask which claim can actually be scored. A dated forecast needs an outcome and a time window; a contemporary assessment needs evidence about its own conditions. Mixing them makes history look more certain than it is.'));

  const acts = el('div', 'row');
  const again = el('button', 'btn ghost', 'Play again');
  again.addEventListener('click', () => { S.i = 0; S.answers = {}; renderCard(); scrollActTop(); });
  const on = el('button', 'btn primary', 'Now show me the two winters');
  on.addEventListener('click', () => setAct(2));
  acts.appendChild(again); acts.appendChild(on);
  box.appendChild(acts);
}

/* ================================ ACT II ================================ */

function buildTimeline() {
  if (S.tl) return;
  S.tl = Timeline.create($('#tl'), D);
  S.tl.onHover(showEvent);
  S.tl.setBig(S.presenter);

  const slider = $('#tl-slider');
  slider.addEventListener('input', () => {
    S.tl.setCursor(+slider.value / 1000);
    syncTimelineChrome();
  });
  $('#tl-back').addEventListener('click', () => {
    const ev = S.tl.step(-1);
    slider.value = String(Math.round(sliderFromCursor() * 1000));
    if (ev) S.tl.select(ev);
    syncTimelineChrome();
  });
  $('#tl-fwd').addEventListener('click', () => {
    const ev = S.tl.step(1);
    slider.value = String(Math.round(sliderFromCursor() * 1000));
    if (ev) S.tl.select(ev);
    syncTimelineChrome();
  });

  const legend = $('#tl-legend'); legend.innerHTML = '';
  const lanes = [{ id: 'result', label: 'What actually worked', blurb: 'Historical results placed beside claims and assessments.' }].concat(D.STAGES);
  for (const s of lanes) {
    const d = el('div', 'lg');
    const sw = el('i'); sw.style.background = Timeline.LANE_COLOR[s.id];
    d.appendChild(sw);
    d.appendChild(el('b', null, s.label));
    d.appendChild(el('span', null, s.blurb));
    legend.appendChild(d);
  }

  const wn = $('#tl-winters'); wn.innerHTML = '';
  for (const w of D.WINTERS) {
    const d = el('div', 'wnote');
    d.appendChild(el('b', null, w.label + ' — ' + w.range));
    d.appendChild(el('span', null, w.note));
    wn.appendChild(d);
  }

  const mv = $('#money-list'); mv.innerHTML = '';
  for (const ev of D.EVENTS.filter(e => e.money)) {
    const d = el('div', 'money');
    d.appendChild(el('b', null, E.fmtDate(E.t(ev.d), 'year')));
    d.appendChild(el('span', 'm-amt', ev.money.note));
    d.appendChild(el('span', 'm-lab', ev.label));
    d.appendChild(srcChip(ev.src));
    mv.appendChild(d);
  }

  window.addEventListener('resize', () => { if (S.act === 2) S.tl.resize(); });
  requestAnimationFrame(() => { S.tl.resize(); syncTimelineChrome(); });
}

function sliderFromCursor() {
  const y0 = Date.UTC(Timeline.Y0, 0, 1), y1 = Date.UTC(Timeline.Y1, 0, 1);
  return (S.tl.cursorAt() - y0) / (y1 - y0);
}

function syncTimelineChrome() {
  const st = S.tl.stats();
  $('#tl-year').textContent = String(S.tl.cursorYear());
  $('#tl-total').textContent = String(st.total);
  $('#tl-with').textContent = String(st.withdrawals);
  const w = S.tl.winterNow();
  const badge = $('#tl-winter');
  badge.hidden = !w;
  if (w) badge.textContent = w.label + ' — ' + w.range;
}

function showEvent(ev) {
  const box = $('#tl-detail');
  box.innerHTML = '';
  if (!ev) {
    box.classList.add('empty');
    box.appendChild(el('p', 'hint', 'Tap a dot — or use ‹ and › to walk through the events one at a time.'));
    return;
  }
  box.classList.remove('empty');
  const head = el('div', 'ev-head');
  const chip = el('span', 'lane-chip');
  chip.style.background = Timeline.hexA(Timeline.LANE_COLOR[ev.stage], 0.22);
  chip.style.color = Timeline.LANE_COLOR[ev.stage];
  chip.textContent = ev.stage === 'result' ? 'result' : ev.stage;
  head.appendChild(chip);
  head.appendChild(el('b', null, E.fmtEventDate(ev.at, ev.p)));
  head.appendChild(el('span', 'ev-label', ev.label));
  box.appendChild(head);
  box.appendChild(el('p', 'ev-text', ev.text));
  const foot = el('div', 'ev-foot');
  foot.appendChild(statusChip(ev.status));
  foot.appendChild(srcChip(ev.src));
  const s = D.SOURCES[ev.src];
  if (s) foot.appendChild(el('span', 'src-title', s.t));
  box.appendChild(foot);
}

/* =============================== ACT III ================================ */

function renderAnatomy() {
  const box = $('#anatomy');
  if (box.dataset.built) return;
  box.dataset.built = '1';
  const stageBlurb = D.STAGES.reduce((o, s) => (o[s.id] = s, o), {});

  for (const row of D.ANATOMY) {
    const st = stageBlurb[row.stage];
    const r = el('div', 'an-row');

    const head = el('div', 'an-stage');
    head.appendChild(el('b', null, st.label));
    head.appendChild(el('span', null, st.blurb));
    r.appendChild(head);

    const cols = el('div', 'an-cols');
    const col = (key, title, cls) => {
      const cell = row[key];
      const c = el('div', 'an-cell ' + cls);
      c.appendChild(el('span', 'an-era', title));
      c.appendChild(el('b', null, cell.head));
      c.appendChild(el('p', null, cell.body));
      if (cell.pending) {
        c.classList.add('pending');
        c.appendChild(el('span', 'an-pending', 'open — ' + cell.pending));
      }
      if (cell.src.length) {
        const f = el('div', 'an-src');
        cell.src.forEach(id => f.appendChild(srcChip(id)));
        c.appendChild(f);
      } else {
        c.classList.add('nosrc');
        c.appendChild(el('span', 'an-nosrc', 'no figure shown — nothing sourceable'));
      }
      return c;
    };
    cols.appendChild(col('w1', 'First winter', 'w1'));
    cols.appendChild(col('w2', 'Second winter', 'w2'));
    cols.appendChild(col('now', 'Now', 'now'));
    r.appendChild(cols);
    box.appendChild(r);
  }
}

/* =============================== ACT IV ================================= */

function renderClose() {
  const box = $('#close');
  if (box.dataset.built) return;
  box.dataset.built = '1';

  const two = el('div', 'cols2');

  const a = el('div', 'col rhymes');
  a.appendChild(el('h3', null, 'What rhymes'));
  for (const it of D.RHYMES) {
    const d = el('div', 'item');
    d.appendChild(el('b', null, it.head));
    d.appendChild(el('p', null, it.body));
    d.appendChild(srcChip(it.src));
    a.appendChild(d);
  }
  two.appendChild(a);

  const b = el('div', 'col different');
  b.appendChild(el('h3', null, 'What is genuinely different'));
  for (const it of D.DIFFERENT) {
    const d = el('div', 'item');
    d.appendChild(el('b', null, it.head));
    d.appendChild(el('p', null, it.body));
    d.appendChild(srcChip(it.src));
    b.appendChild(d);
  }
  two.appendChild(b);
  box.appendChild(two);

  const cl = el('div', 'panel closer');
  cl.appendChild(el('h3', null, D.CLOSER.head));
  paras(cl, D.CLOSER.body);
  box.appendChild(cl);

  const cut = el('div', 'panel cut');
  cut.appendChild(el('h3', null, 'What was cut, and why'));
  cut.appendChild(el('p', 'help', 'Researched for this demo and left out because it could not be sourced well enough. A demo that only shows what it kept is an advertisement.'));
  const ul = el('ul');
  for (const c of D.CUT) {
    const li = el('li');
    li.appendChild(el('b', null, c.claim));
    li.appendChild(el('span', null, c.why));
    ul.appendChild(li);
  }
  cut.appendChild(ul);
  box.appendChild(cut);

  const src = el('div', 'panel sources');
  src.appendChild(el('h3', null, 'Every source'));
  src.appendChild(el('p', 'help', D.SOURCE_NOTE));
  const sl = el('ul', 'src-list');
  Object.keys(D.SOURCES).sort().forEach(id => {
    const s = D.SOURCES[id];
    const li = el('li');
    const a2 = el('a', null, s.t);
    a2.href = s.u; a2.target = '_blank'; a2.rel = 'noopener noreferrer';
    li.appendChild(a2);
    li.appendChild(el('span', 'src-id', id));
    sl.appendChild(li);
  });
  src.appendChild(sl);
  box.appendChild(src);
}

/* ============================== navigation ============================== */

function setAct(n) {
  S.act = n;
  $$('.act').forEach(a => { a.hidden = +a.dataset.act !== n; });
  $$('#actnav button').forEach(b => {
    const on = +b.dataset.act === n;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', String(on));
  });
  if (n === 2) { buildTimeline(); requestAnimationFrame(() => { S.tl.resize(); syncTimelineChrome(); }); }
  if (n === 3) renderAnatomy();
  if (n === 4) renderClose();
  scrollActTop();
}

function scrollActTop() {
  window.scrollTo({ top: 0, behavior: 'auto' });
}

/* =============================== overlays =============================== */

/** The page behind a sheet must not scroll with it — on a phone, dragging the
 *  sheet body otherwise drags the whole article underneath. */
function lockScroll() {
  document.body.style.overflowY = $$('.overlay').some(o => !o.hidden) ? 'hidden' : '';
}
function open(id) {
  const o = document.getElementById(id);
  o.hidden = false;
  lockScroll();
  const inner = o.querySelector('.sheet-inner');
  if (inner) inner.focus();
}
function close(id) { document.getElementById(id).hidden = true; lockScroll(); }

function wireOverlays() {
  $$('[data-close]').forEach(b => b.addEventListener('click', () => close(b.dataset.close)));
  $$('.overlay').forEach(o => o.addEventListener('click', ev => {
    if (ev.target === o) { o.hidden = true; lockScroll(); }
  }));
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { $$('.overlay').forEach(o => { o.hidden = true; }); lockScroll(); }
  });
  $('#btn-howto').addEventListener('click', () => open('howto'));
  $('#btn-settings').addEventListener('click', () => open('settings'));
  $('#btn-notes').addEventListener('click', () => { close('settings'); open('notes'); });
  $('#btn-reset').addEventListener('click', resetDemo);
  $('#chk-presenter').addEventListener('change', ev => {
    S.presenter = ev.target.checked;
    document.body.classList.toggle('presenting', S.presenter);
    if (S.tl) { S.tl.setBig(S.presenter); }
  });
  $('#btn-selftest').addEventListener('click', runSelfTest);
}

/* ================================ reset =================================
   Settings -> Reset. Whole-demo, not per-act: every piece of session state
   goes back to the value it has on a fresh load, without a reload. Nothing
   here is persisted (no storage of any kind), so restoring S and the few
   pieces of DOM that render from it IS a fresh load.

   Two deliberate exceptions, both from the contract:
     - Presentation mode stays as the presenter set it. It is a projector
       preference, not demo state; a presenter who reset mid-talk would not
       want the type to shrink on the projector.
     - The Guide overlay stays closed. It opens on first load as onboarding;
       Reset is not re-onboarding, and reopening it would hide the demo the
       presenter just reset in front of a room.
   ---------------------------------------------------------------------- */

function resetDemo() {
  S.i = 0;
  S.answers = {};
  S.pending = { year: 1985, verdict: null };
  S.revealed = false;

  /* Act I, back before the first card. renderCard() re-initialises every
     control inside #card-body when Begin is pressed again, so hiding the
     block is enough to undo a half-answered card. */
  renderIntro();
  $('#intro').hidden = false;
  $('#card-body').hidden = true;
  $('#scorecard').hidden = true;

  /* Act II is built lazily and owns a canvas plus a window resize listener,
     so rewind it in place; rebuilding would attach a second listener. Its
     fresh-load cursor is 1 — the whole 1950-2026 span shown. */
  if (S.tl) {
    S.tl.select(null);
    S.tl.setCursor(1);
    $('#tl-slider').value = '1000';
    syncTimelineChrome();
  }
  showEvent(null);

  /* The self-test panel is output, not state: a fresh load has none. */
  $('#selftest-out').innerHTML = '';

  /* Close the Settings sheet the button was pressed in, and anything else
     left open, then release the scroll lock those sheets took. */
  $$('.overlay').forEach(o => { o.hidden = true; });
  lockScroll();

  setAct(1);
}

/* ============================== self-test ===============================
   The proof button. It re-derives, in front of whoever is asking, the
   properties the shipped test file asserts at build time.
   ---------------------------------------------------------------------- */

function runSelfTest() {
  const out = [];
  const ok = (name, cond, detail) => out.push([!!cond, name, detail || '']);

  const ids = Object.keys(D.SOURCES);
  const used = new Set();
  const collect = id => { used.add(id); return !!D.SOURCES[id]; };

  let allResolve = true;
  D.CARDS.forEach(c => { if (!collect(c.src)) allResolve = false; });
  D.EVENTS.forEach(e => { if (!collect(e.src)) allResolve = false; });
  D.RHYMES.concat(D.DIFFERENT).forEach(r => { if (!collect(r.src)) allResolve = false; });
  D.ANATOMY.forEach(r => ['w1','w2','now'].forEach(k =>
    r[k].src.forEach(id => { if (!collect(id)) allResolve = false; })));

  ok('Every claim resolves to a declared source', allResolve);
  const unused = ids.filter(i => !used.has(i));
  ok('No source is declared and never used', unused.length === 0, unused.join(', '));
  ok('Every source URL is a specific page, not a bare host',
     ids.every(i => (D.SOURCES[i].u.split('://')[1] || '').indexOf('/') > 0));

  const evs = D.EVENTS.map(e => E.t(e.d));
  ok('Every event date parses', evs.every(v => !isNaN(v)));
  ok('The timeline is in chronological order once sorted',
     evs.slice().sort((a, b) => a - b).every((v, i, arr) => i === 0 || arr[i - 1] <= v));
  ok('Every event sits in a declared lane',
     D.EVENTS.every(e => e.stage === 'result' || D.STAGES.some(s => s.id === e.stage)));
  ok('Every event shows only as much of its date as was verified',
     D.EVENTS.every(e => ['y','m','d'].indexOf(e.p) > -1) &&
     D.EVENTS.filter(e => e.p === 'd').every(e => !/-01-01$/.test(e.d)));

  ok('Card counts match the prose on the scorecard',
     D.CARDS.filter(c => c.kind === 'promise').length === 5 &&
     D.CARDS.filter(c => c.kind === 'assessment').length === 4 &&
     D.CARDS.filter(c => c.kind === 'warning').length === 1,
     'promise/assessment/warning = ' + ['promise','assessment','warning']
       .map(k => D.CARDS.filter(c => c.kind === k).length).join('/'));
  ok('No promise in the deck arrived inside the window it named',
     D.CARDS.filter(c => c.kind === 'promise').every(c => c.verdict !== 'yes'));
  ok('The present column of the anatomy leaves exactly two stages pending',
     D.ANATOMY.filter(r => r.now.pending).length === 2);

  ok('Every card year falls inside the timeline window',
     D.CARDS.every(c => c.year >= Timeline.Y0 && c.year <= Timeline.Y1));
  ok('Exactly one card is left unresolved',
     D.CARDS.filter(c => c.verdict === 'open').length === 1);

  ok('Both winters start after their own first promise',
     D.WINTERS.every(w => D.EVENTS.some(e => e.stage === 'promise' && E.t(e.d) < E.t(w.from))));
  ok('Each winter contains at least one withdrawal',
     D.WINTERS.every(w => D.EVENTS.some(e =>
       e.stage === 'withdrawal' && E.t(e.d) >= E.t(w.from) && E.t(e.d) <= E.t(w.to))));

  ok('A perfect year guess scores zero miss', E.yearMiss(1973, 1973) === 0);
  ok('Scoring never marks an unresolved claim', E.verdictCorrect('yes', 'open') === null);
  ok('A "came true late" card is only right if you said it did not come true in its window',
     E.verdictCorrect('no', 'late') === true && E.verdictCorrect('yes', 'late') === false);

  const box = $('#selftest-out');
  box.innerHTML = '';
  const fails = out.filter(r => !r[0]).length;
  const head = el('div', 'st-head ' + (fails ? 'bad' : 'good'));
  head.textContent = fails ? `${fails} of ${out.length} checks FAILED` : `all ${out.length} checks pass`;
  box.appendChild(head);
  const ul = el('ul', 'st-list');
  for (const [pass, name, detail] of out) {
    const li = el('li', pass ? 'ok' : 'no');
    li.appendChild(el('b', null, pass ? 'PASS' : 'FAIL'));
    li.appendChild(el('span', null, name + (detail ? ' — ' + detail : '')));
    ul.appendChild(li);
  }
  box.appendChild(ul);
  /* eslint-disable no-console */
  console.log('AI Winters: Boom and Bust self-test:', fails ? fails + ' FAILED' : 'all pass');
  out.forEach(r => console.log(r[0] ? 'PASS' : 'FAIL', r[1], r[2]));
}

/* ================================ boot ================================== */

function boot() {
  renderIntro();
  wireOverlays();

  $('#btn-begin').addEventListener('click', () => {
    $('#intro').hidden = true;
    renderCard();
    scrollActTop();
  });

  const sl = $('#year-slider');
  sl.min = String(Timeline.Y0); sl.max = '2026';
  sl.addEventListener('input', () => {
    S.pending.year = +sl.value;
    $('#year-read').textContent = sl.value;
  });

  $('#btn-lock').addEventListener('click', lockIn);
  $('#btn-next-card').addEventListener('click', nextCard);

  $$('#actnav button').forEach(b => b.addEventListener('click', () => setAct(+b.dataset.act)));
  $('#btn-to-anatomy').addEventListener('click', () => setAct(3));
  $('#btn-to-now').addEventListener('click', () => setAct(4));

  showEvent(null);
  open('howto');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
