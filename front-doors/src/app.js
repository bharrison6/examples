/* ==========================================================================
   AI Tool Guide (folder: front-doors) — the application.

   Three acts:
     I   The four doors — four surfaces against four axes, sixteen cells.
     II  Pick a job — seven realistic faculty tasks against the same four
         doors, with the smallest sufficient door computed rather than typed.
     III The receipts — what already changed, what will rot, the uneven row,
         the cut list and every source.

   No framework and no network. Every derived number comes from engine.js, so
   the screen, the shipped test suite and the self-test button cannot disagree
   about what the data says.
   ========================================================================== */

(() => {

const D = DATA, E = ENGINE;
const $  = s => document.querySelector(s);
const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));

const S = { act: 1, job: null, presenter: false };

/* ---------------------------------------------------------------- helpers */

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/** A source chip. Every claim on screen gets at least one; the self-test
 *  proves the id resolves, and a broken id is loud rather than silent. */
function srcChip(id, label) {
  const s = D.SOURCES[id];
  const a = el('a', 'src');
  if (!s) { a.textContent = 'source missing: ' + id; a.classList.add('bad'); return a; }
  a.href = s.u; a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.textContent = label || 'source';
  a.title = s.t;
  return a;
}

function confChip(conf) {
  const b = el('span', 'conf ' + conf, conf);
  b.title = D.CONF_LABEL[conf] || conf;
  return b;
}

/** A four-segment meter. Decorative — the words are in the cell and in the
 *  button's accessible name, so this is aria-hidden. */
function meter(bar) {
  const w = el('span', 'bar');
  w.setAttribute('aria-hidden', 'true');
  for (let i = 1; i <= 4; i++) w.appendChild(el('i', i <= bar ? 'on' : null));
  return w;
}

function sourceRow(ids, extraText) {
  const row = el('div', 'src-row');
  if (extraText) row.appendChild(el('span', 'src-title', extraText));
  (ids || []).forEach(id => {
    const s = D.SOURCES[id];
    row.appendChild(srcChip(id, s ? shortHost(s.u) : undefined));
  });
  return row;
}

/** The host, trimmed, so a chip says where it goes without a wall of URL. */
function shortHost(u) {
  const h = (String(u).split('://')[1] || '').split('/')[0];
  return h.replace(/^www\./, '');
}

function paras(parent, list) {
  (list || []).forEach(p => parent.appendChild(el('p', null, p)));
}

/* ================================ ACT I =================================
   One piece of markup, two layouts. app.js stamps --col and --row on every
   grid child; the stylesheet uses them only above 940px, where the two
   wrapper divs collapse with `display: contents` and the children become
   items of a real five-column grid. Below that the wrappers are cards and
   the custom properties are simply ignored.
   ---------------------------------------------------------------------- */

function place(node, col, row) {
  node.style.setProperty('--col', String(col));
  node.style.setProperty('--row', String(row));
  return node;
}

function renderGrid() {
  const g = $('#grid');
  g.innerHTML = '';

  /* the axis rail: a corner plus one label per axis */
  const rail = el('div', 'g-rail');
  rail.appendChild(place(el('div', 'g-corner', 'The four doors'), 1, 1));
  D.AXES.forEach((axis, i) => {
    const a = place(el('div', 'g-axis'), 1, i + 2);
    a.dataset.axis = axis.id;
    a.appendChild(el('span', 'a-n', 'Axis ' + axis.n));
    a.appendChild(el('span', 'a-q', axis.q));
    a.appendChild(el('span', 'a-lead', axis.lead));
    rail.appendChild(a);
  });
  g.appendChild(rail);

  /* one group per door: its header, then its four cells */
  D.DOORS.forEach((door, j) => {
    const group = el('div', 'g-group');
    group.dataset.door = door.id;

    const h = place(el('button', 'g-door'), j + 2, 1);
    h.type = 'button';
    h.dataset.door = door.id;
    h.appendChild(el('span', 'd-n', 'Door ' + door.n));
    h.appendChild(el('span', 'd-name', door.name));
    h.appendChild(el('span', 'd-prod', door.products));
    h.appendChild(el('span', 'd-more', 'What it is →'));
    h.setAttribute('aria-label',
      'Door ' + door.n + ', ' + door.name + '. ' + door.products + '. Open the details.');
    h.addEventListener('click', () => openDoor(door));
    group.appendChild(h);

    D.AXES.forEach((axis, i) => {
      const c = E.cell(D, door.id, axis.id);
      const b = place(el('button', 'g-cell'), j + 2, i + 2);
      b.type = 'button';
      b.dataset.door = door.id;
      b.dataset.axis = axis.id;
      b.appendChild(el('span', 'c-axis', axis.short));
      b.appendChild(el('span', 'c-head', c ? c.head : 'no cell'));
      const foot = el('div', 'c-foot');
      foot.appendChild(meter(c ? c.bar : 0));
      if (c && c.conf !== 'verified') foot.appendChild(confChip(c.conf));
      else foot.appendChild(el('span', 'c-tap', 'why'));
      b.appendChild(foot);
      b.setAttribute('aria-label',
        axis.q + ' Door ' + door.n + ', ' + door.name + ': ' + (c ? c.head : '') +
        '. Level ' + (c ? c.bar : 0) + ' of 4. Open the explanation.');
      b.addEventListener('click', () => openCell(door, axis));
      group.appendChild(b);
    });

    g.appendChild(group);
  });
}

/** The exception panel. Its content is COMPUTED from the bars, so it cannot
 *  describe an ordering the data no longer has. */
function renderCheckNote() {
  const box = $('#check-note');
  box.innerHTML = '';
  box.appendChild(el('h3', null, D.CHECK_NOTE.head));
  paras(box, D.CHECK_NOTE.body);

  const ex = E.checkExceptions(D);
  const line = el('p', 'help');
  if (!ex.length) {
    line.textContent = 'As the data currently stands there is no exception: every door’s review burden matches its reach. If you are reading this, the dataset changed and the paragraphs above are stale.';
  } else {
    line.textContent = 'Computed from the bars above, not typed here: ' +
      ex.map(r => {
        const door = D.DOORS.find(d => d.id === r.id);
        return 'door ' + r.n + ' (' + door.name.toLowerCase() + ') reaches at level ' +
               r.reach + ' but is checked at level ' + r.check;
      }).join('; ') + '.';
  }
  box.appendChild(line);
  box.appendChild(sourceRow(D.CHECK_NOTE.src, 'The verified facts this ordering rests on:'));
}

function renderAxisNote() {
  const box = $('#axis-note');
  box.innerHTML = '';
  box.appendChild(el('h3', null, 'How to read the bars'));
  box.appendChild(el('p', null, D.AXIS_NOTE));
  const ul = el('ul', 'ht-acts');
  D.AXES.forEach(axis => {
    const li = el('li');
    li.appendChild(el('b', null, axis.short + ' — '));
    li.appendChild(document.createTextNode(axis.bars.map((b, i) => (i + 1) + ': ' + b).join(' · ')));
    ul.appendChild(li);
  });
  box.appendChild(ul);
}

/* ---------------------------------------------------- the detail sheets */

function openSheetWith(title, sub, build) {
  $('#detail-title').textContent = title;
  $('#detail-sub').textContent = sub;
  const body = $('#detail-body');
  body.innerHTML = '';
  build(body);
  open('detail');
}

function openCell(door, axis) {
  const c = E.cell(D, door.id, axis.id);
  openSheetWith(door.name, 'Door ' + door.n + ' · ' + axis.q, body => {
    body.appendChild(el('div', 'd-axis', 'Axis ' + axis.n + ' — ' + axis.short));
    const h = el('h3', null, c ? c.head : 'No cell');
    body.appendChild(h);

    if (c) {
      const bar = el('div', 'd-bar');
      bar.appendChild(meter(c.bar));
      bar.appendChild(el('span', 'd-bar-text',
        'Level ' + c.bar + ' of 4 — ' + (E.barText(D, axis.id, c.bar) || '')));
      body.appendChild(bar);

      body.appendChild(el('p', null, c.why));

      if (c.quote) {
        const q = el('blockquote', 'quote', '“' + c.quote + '”');
        body.appendChild(q);
        const attrib = D.SOURCES[c.quoteSrc];
        if (attrib) body.appendChild(el('p', 'help', '— ' + attrib.t));
      }

      const cr = el('div', 'src-row');
      cr.appendChild(confChip(c.conf));
      cr.appendChild(el('span', 'src-title', D.CONF_LABEL[c.conf] || ''));
      body.appendChild(cr);
      body.appendChild(sourceRow(c.src, 'Checked against:'));
    }
  });
}

function openDoor(door) {
  openSheetWith(door.name, 'Door ' + door.n + ' · ' + door.tag, body => {
    body.appendChild(el('p', 'lead', door.blurb));

    body.appendChild(el('div', 'd-axis', 'Where it lives'));
    body.appendChild(el('p', null, door.where));
    if (door.whereSrc) body.appendChild(sourceRow(door.whereSrc));

    body.appendChild(el('div', 'd-axis', 'Products, on the check date'));
    body.appendChild(el('p', null, door.products));

    body.appendChild(el('div', 'd-axis', 'What it costs you to get in'));
    body.appendChild(el('p', null, door.costText));
    body.appendChild(el('p', 'help', 'No figures on this page on purpose — prices on all four doors moved more than once in the last year. Ask your own IT department what your institution already has; that answer beats any vendor page.'));
    if (door.costSrc) body.appendChild(sourceRow(door.costSrc));

    if (door.confusable) {
      body.appendChild(el('hr', 'hr'));
      body.appendChild(el('div', 'd-axis', 'Easy to mix up'));
      body.appendChild(el('p', null, door.confusable));
      if (door.confusableSrc) body.appendChild(sourceRow(door.confusableSrc));
    }

    body.appendChild(el('hr', 'hr'));
    body.appendChild(el('div', 'd-axis', 'This door on the four axes'));
    D.AXES.forEach(axis => {
      const c = E.cell(D, door.id, axis.id);
      if (!c) return;
      const item = el('div', 'source-item');
      const t = el('span', 'src-title');
      t.textContent = axis.short + ': ' + c.head;
      item.appendChild(meter(c.bar));
      item.appendChild(t);
      body.appendChild(item);
    });
  });
}

/* ================================ ACT II ================================ */

function renderJobPicker() {
  const box = $('#job-picker');
  box.innerHTML = '';
  D.JOBS.forEach((job, i) => {
    const b = el('button', 'job-btn');
    b.type = 'button';
    b.dataset.job = job.id;
    b.appendChild(el('span', 'j-n', 'Job ' + (i + 1)));
    b.appendChild(el('span', 'j-name', job.name));
    b.addEventListener('click', () => pickJob(job.id));
    box.appendChild(b);
  });
}

function pickJob(id) {
  S.job = id;
  $$('#job-picker .job-btn').forEach(b => b.classList.toggle('on', b.dataset.job === id));
  renderJob();
}

function renderJob() {
  const out = $('#job-out');
  out.innerHTML = '';
  const job = E.jobById(D, S.job);
  if (!job) { out.classList.add('empty'); return; }
  out.classList.remove('empty');

  const head = el('div', 'j-head');
  head.appendChild(el('h2', null, job.name));
  head.appendChild(el('p', 'j-detail', job.detail));
  out.appendChild(head);

  if (job.caution) {
    const c = el('div', 'j-caution');
    c.appendChild(el('b', null, 'Before you pick a door: '));
    c.appendChild(document.createTextNode(job.caution));
    out.appendChild(c);
  }

  const best = E.bestDoor(D, job);
  const t = E.tally(D, job);
  const bb = el('div', 'j-best');
  bb.appendChild(el('span', 'b-lbl', 'Smallest door that does the whole job'));
  if (best) {
    bb.appendChild(el('span', 'b-door', 'Door ' + best.n + ' — ' + best.name));
    const hand = job.doors[best.id].hand;
    bb.appendChild(el('span', 'b-note',
      (hand ? 'And what it costs you: ' + hand + '.' : 'And it costs you nothing beyond the text itself.') +
      ' ' + t.yes + ' of ' + D.DOORS.length + ' doors can do the whole job; ' +
      t.partly + ' can do part of it; ' + t.no + ' cannot.'));
  } else {
    bb.appendChild(el('span', 'b-door', 'None of the four'));
    bb.appendChild(el('span', 'b-note', 'No door on this page does the whole job on its own.'));
  }
  out.appendChild(bb);

  const doors = el('div');
  doors.id = 'job-doors';
  D.DOORS.forEach(door => {
    const v = E.verdict(D, job, door.id);
    if (!v) return;
    const card = el('div', 'jd v-' + v.v + (best && best.id === door.id ? ' is-best' : ''));
    const top = el('div', 'jd-top');
    top.appendChild(el('span', 'jd-n', 'Door ' + door.n));
    top.appendChild(el('span', 'jd-v', D.VERDICT_LABEL[v.v]));
    top.appendChild(el('span', 'jd-name', door.name));
    card.appendChild(top);
    card.appendChild(el('p', 'jd-why', v.why));
    const axis = D.AXES.find(a => a.id === v.axis);
    card.appendChild(el('span', 'jd-axis', 'Decided by axis ' + (axis ? axis.n + ' — ' + axis.short : v.axis)));
    /* "You hand over: nothing" is true of a door that does the job for free and
       also, misleadingly, of one that cannot do it at all. Only the first is
       worth saying, so a "wrong door" card states the cost differently. */
    const hand = el('p', 'jd-hand');
    if (v.v === 'no') {
      hand.appendChild(el('b', null, 'Nothing to hand over — '));
      hand.appendChild(document.createTextNode('there is no amount of access that makes this door do this job.'));
    } else {
      hand.appendChild(el('b', null, 'You hand over: '));
      hand.appendChild(document.createTextNode(v.hand || 'nothing beyond the text itself.'));
    }
    card.appendChild(hand);
    doors.appendChild(card);
  });
  out.appendChild(doors);

  const note = el('div', 'panel warn');
  note.appendChild(el('h3', null, 'These verdicts are reasoned, not quoted'));
  note.appendChild(el('p', null, 'No vendor page says anything about eighty student reflections. Every verdict above is an inference from the sourced capabilities in Act I — which is why each one names the axis that decided it, so you can check the reasoning rather than trust the answer.'));
  const cr = el('div', 'src-row');
  cr.appendChild(confChip('reasoned'));
  cr.appendChild(el('span', 'src-title', D.CONF_LABEL.reasoned));
  note.appendChild(cr);
  out.appendChild(note);
}

function renderJobsNote() {
  const box = $('#jobs-note');
  box.innerHTML = '';
  const spread = E.bestDoorSpread(D);
  const low = E.jobsSolvedLow(D);
  box.appendChild(el('h3', null, 'What this list is not'));
  box.appendChild(el('p', null, D.JOBS_NOTE));
  box.appendChild(el('p', 'help',
    'Counted from the verdicts, not asserted: of ' + D.JOBS.length + ' jobs, the smallest sufficient door is ' +
    D.DOORS.map(d => 'door ' + d.n + ' for ' + spread[d.n]).join(', ') + '. ' +
    low.length + ' of the ' + D.JOBS.length + ' are done completely by a chat window or by the agent already inside your word processor.'));
}

/* =============================== ACT III =============================== */

function renderChanged() {
  const box = $('#changed');
  box.innerHTML = '';
  D.CHANGED.forEach(ch => {
    const c = el('div', 'chg');
    const move = el('div', 'c-move');
    move.appendChild(el('span', 'c-was', ch.was));
    move.appendChild(el('span', 'c-arrow', '→'));
    move.appendChild(el('span', 'c-now', ch.now));
    c.appendChild(move);
    c.appendChild(el('div', 'c-what', ch.what));
    c.appendChild(el('p', 'c-body', ch.body));
    if (ch.quote) {
      c.appendChild(el('blockquote', 'quote', '“' + ch.quote + '”'));
    }
    const row = sourceRow(ch.src);
    row.insertBefore(confChip(ch.conf), row.firstChild);
    c.appendChild(row);
    box.appendChild(c);
  });
  box.appendChild(el('p', 'help', D.CHANGED_NOTE));
}

function renderStale() {
  const box = $('#stale');
  box.innerHTML = '';
  box.appendChild(el('h3', null, D.STALE.head));
  const cols = el('div', 'cols2');

  const rot = el('div');
  rot.appendChild(el('div', 'lbl', 'Expect these to be wrong'));
  const ul1 = el('ul', 'slist rot');
  D.STALE.rot.forEach(s => ul1.appendChild(el('li', null, s)));
  rot.appendChild(ul1);

  const keep = el('div');
  keep.appendChild(el('div', 'lbl', 'Expect these to hold'));
  const ul2 = el('ul', 'slist keep');
  D.STALE.keep.forEach(s => ul2.appendChild(el('li', null, s)));
  keep.appendChild(ul2);

  cols.appendChild(rot);
  cols.appendChild(keep);
  box.appendChild(cols);
}

function renderUneven() {
  const box = $('#uneven');
  box.innerHTML = '';
  box.appendChild(el('h3', null, D.UNEVEN.head));
  box.appendChild(el('p', null, D.UNEVEN.body));
  if (D.UNEVEN.quote) box.appendChild(el('blockquote', 'quote', '“' + D.UNEVEN.quote + '”'));
  box.appendChild(el('p', 'help', D.UNEVEN.note));
  const row = sourceRow(D.UNEVEN.src);
  row.insertBefore(confChip(D.UNEVEN.conf), row.firstChild);
  box.appendChild(row);
}

function renderCut() {
  const box = $('#cut');
  box.innerHTML = '';
  box.appendChild(el('h3', null, 'Researched, and deliberately not on the page (' + D.CUT.length + ')'));
  box.appendChild(el('p', 'help', 'What a page refuses to say is part of what it is claiming. Each of these was looked into during the build and left off, with the reason.'));
  D.CUT.forEach(c => {
    const item = el('div', 'cut-item');
    item.appendChild(el('b', null, c.claim));
    item.appendChild(el('span', null, c.why));
    box.appendChild(item);
  });
}

function renderSources() {
  const box = $('#sources');
  box.innerHTML = '';
  const ids = Object.keys(D.SOURCES);
  box.appendChild(el('h3', null, 'Every source (' + ids.length + ')'));
  box.appendChild(el('p', 'help', D.SOURCE_NOTE));
  ids.forEach(id => {
    const s = D.SOURCES[id];
    const item = el('div', 'source-item');
    item.appendChild(srcChip(id, shortHost(s.u)));
    item.appendChild(el('span', 'src-title', s.t));
    box.appendChild(item);
  });
}

function renderCounts() {
  const c = E.counts(D);
  const box = $('#counts');
  box.innerHTML = '';
  box.appendChild(el('h3', null, 'This page, in numbers'));
  box.appendChild(el('p', null,
    c.doors + ' doors against ' + c.axes + ' axes is ' + c.gridCells + ' cells, of which ' +
    c.verifiedCells + ' are verified against a first-party page and ' + c.reasonedCells +
    ' are labelled as reasoning. ' + c.jobs + ' jobs against the same ' + c.doors +
    ' doors is another ' + c.jobCells + ' judgements, all of them reasoned from those cells. ' +
    c.sources + ' sources, ' + c.changed + ' product names that already moved, and ' +
    c.cut + ' things researched and left off.'));
  box.appendChild(el('p', 'help', 'Every number in that paragraph is read out of the dataset at page load, and the shipped test suite fails the build if any of them disagrees with README.md, the presenter guide or the manifest.'));
}

/* =============================== acts ================================== */

function setAct(n) {
  S.act = n;
  $$('.act').forEach(a => { a.hidden = +a.dataset.act !== n; });
  $$('#actnav button').forEach(b => {
    const on = +b.dataset.act === n;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', String(on));
  });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

/* ============================== overlays =============================== */

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
  $('#chk-presenter').addEventListener('change', ev => {
    S.presenter = ev.target.checked;
    document.body.classList.toggle('presenting', S.presenter);
  });
  $('#btn-reset').addEventListener('click', resetDemo);
  $('#btn-selftest').addEventListener('click', runSelfTest);
}

/* ================================ reset =================================
   Whole-demo, fresh-load semantics: everything boot() leaves behind except
   the two things that are not demo state.

   Presentation mode survives on purpose. It is a property of the room — the
   projector is still a projector — and a presenter who reset between sessions
   and had to re-enable it every time would stop using the button. The Guide
   overlay stays CLOSED, because reset is not a reload: the presenter pressing
   it is mid-session and does not need the how-to panel in the way.

   Everything else here is genuinely all of this demo's mutable state. S holds
   three fields, one of which is `presenter`; the rest of what a session
   accumulates lives in the DOM, in the job output and the self-test results.
   ---------------------------------------------------------------------- */

function resetDemo() {
  S.job = null;
  $$('#job-picker .job-btn').forEach(b => b.classList.remove('on'));
  renderJob();                       /* clears #job-out and restores .empty */

  const st = $('#selftest-out');
  if (st) st.innerHTML = '';

  $$('.overlay').forEach(o => { o.hidden = true; });
  lockScroll();

  setAct(1);                         /* also scrolls to the top */
}

/* ============================== self-test ===============================
   The proof button. It re-derives, in front of whoever is asking, the
   properties the shipped test file asserts at build time — including the
   two rules this module holds itself to: no prices, no ranking.
   ---------------------------------------------------------------------- */

function runSelfTest() {
  const out = [];
  const ok = (name, cond, detail) => out.push([!!cond, name, detail || '']);

  /* ---- sources resolve, in both directions ---- */
  const dangling = E.danglingSources(D);
  ok('Every claim resolves to a declared source', dangling.length === 0, dangling.join(', '));
  const unused = E.unusedSources(D);
  ok('No source is declared and never used', unused.length === 0, unused.join(', '));
  const vague = E.vagueSourceUrls(D);
  ok('Every source URL names a page, not just a host', vague.length === 0, vague.join(', '));
  ok('Every source is first-party',
     Object.keys(D.SOURCES).every(id => D.SOURCES[id].kind === 'primary'));

  /* ---- the grid is complete and honestly labelled ---- */
  ok('All sixteen cells exist', E.cells(D).every(x => !!x.c),
     E.cells(D).filter(x => !x.c).map(x => x.key).join(', '));
  const noSrc = E.verifiedWithoutSource(D);
  ok('No cell claims "verified" without citing a source', noSrc.length === 0, noSrc.join(', '));
  const badQuote = E.quotesWithoutSource(D);
  ok('Every quotation names the source it came from', badQuote.length === 0, badQuote.join(', '));
  ok('Every bar is a level the axis actually defines',
     E.cells(D).every(({ c, axis }) => c && E.barText(D, axis.id, c.bar) !== null));

  /* ---- the module's two self-imposed rules ---- */
  const money = E.priceLeaks(D);
  ok('No price reaches the screen', money.length === 0, money.join(' | '));
  const rank = E.rankingLeaks(D);
  ok('No vendor is recommended or ranked', rank.length === 0, rank.join(', '));

  /* ---- the thesis, as a property of the data ---- */
  ok('The three reach rows rise across the four doors', E.reachRowsAreStaircases(D));
  ok('The review row does NOT simply rise — that is the point',
     !E.checkIsStaircase(D),
     'check bars: ' + D.DOORS.map(d => E.checkOf(D, d.id)).join(' '));
  const ex = E.checkExceptions(D);
  ok('The page names every door whose review burden departs from its reach',
     ex.length > 0, ex.map(r => 'door ' + r.n + ' reach ' + r.reach + ' check ' + r.check).join('; '));

  /* ---- act II ---- */
  ok('Every job has a verdict for every door',
     D.JOBS.every(j => D.DOORS.every(d => !!E.verdict(D, j, d.id))));
  ok('Every verdict names one of the four axes',
     D.JOBS.every(j => D.DOORS.every(d => D.AXES.some(a => a.id === E.verdict(D, j, d.id).axis))));
  ok('Every verdict explains itself in a sentence',
     D.JOBS.every(j => D.DOORS.every(d => E.verdict(D, j, d.id).why.length > 40)));
  ok('A door that does the whole job says what it costs you, unless it costs nothing',
     D.JOBS.every(j => D.DOORS.every(d => {
       const v = E.verdict(D, j, d.id);
       return v.v !== 'yes' || typeof v.hand === 'string';
     })));
  ok('At least one job is best served by door 1 or door 2',
     E.jobsSolvedLow(D).length > 0, E.jobsSolvedLow(D).map(j => j.id).join(', '));
  ok('No job is impossible at every door',
     D.JOBS.every(j => !!E.bestDoor(D, j)),
     D.JOBS.filter(j => !E.bestDoor(D, j)).map(j => j.id).join(', '));

  /* ---- receipts ---- */
  ok('The cut list is not empty and every entry says why',
     D.CUT.length > 0 && D.CUT.every(c => c.claim && c.why && c.why.length > 40));
  ok('At least two product names are shown as already changed',
     D.CHANGED.length >= 2, String(D.CHANGED.length));
  ok('The uneven row is labelled unconfirmed rather than asserted',
     D.UNEVEN.conf === 'unconfirmed', D.UNEVEN.conf);
  ok('The page carries the date it was checked',
     /\d{4}/.test(D.CHECKED_ON) && D.CHECKED_ISO.length === 10, D.CHECKED_ON);

  const box = $('#selftest-out');
  box.innerHTML = '';
  const fails = out.filter(r => !r[0]).length;
  const head = el('div', 'st-head ' + (fails ? 'bad' : 'good'));
  head.textContent = fails ? fails + ' of ' + out.length + ' checks FAILED'
                           : 'all ' + out.length + ' checks pass';
  box.appendChild(head);
  const ul = el('ul', 'st-list');
  out.forEach(([pass, name, detail]) => {
    const li = el('li', pass ? 'ok' : 'no');
    li.appendChild(el('b', null, pass ? 'PASS' : 'FAIL'));
    li.appendChild(el('span', null, name + (detail ? ' — ' + detail : '')));
    ul.appendChild(li);
  });
  box.appendChild(ul);
  /* eslint-disable no-console */
  console.log('AI Tool Guide self-test:', fails ? fails + ' FAILED' : 'all pass');
  out.forEach(r => console.log(r[0] ? 'PASS' : 'FAIL', r[1], r[2]));
}

/* ================================ boot ================================== */

function boot() {
  /* the date, in the three places that state it */
  $$('.js-date').forEach(n => { n.textContent = D.CHECKED_ON; });
  $('#intro-title').textContent = D.INTRO.title;
  paras($('#intro-body'), D.INTRO.body);
  $('#intro-note').textContent = D.INTRO.note;

  renderGrid();
  renderAxisNote();
  renderCheckNote();
  renderJobPicker();
  renderJobsNote();
  renderJob();
  renderChanged();
  renderStale();
  renderUneven();
  renderCounts();
  renderCut();
  renderSources();
  wireOverlays();

  $$('#actnav button').forEach(b => b.addEventListener('click', () => setAct(+b.dataset.act)));
  $('#btn-to-jobs').addEventListener('click', () => setAct(2));
  $('#btn-to-receipts').addEventListener('click', () => setAct(3));

  open('howto');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
