#!/usr/bin/env node
/* ==========================================================================
   AI Tool Guide (folder: front-doors) — dataset, engine and document checks.

   Run: node src/playtest.test.js        (VERBOSE=1 to print passing rows)

   Three jobs, in ascending order of how much they matter.

   1. Ordinary unit testing of the derivations in engine.js.

   2. The honesty machinery. This module is ABOUT products, which makes it the
      demo in this collection most exposed to plausible-sounding invention. So
      the tests assert, in both directions, that every claim resolves to a
      declared first-party source; that nothing claims to be verified without
      citing something; and that the two rules the module holds itself to — no
      prices, no vendor ranking — have not leaked into any string the page can
      display.

   3. The prose cross-check. This repository's characteristic failure is prose
      drifting away from code, so every count quoted in README.md, the
      presenter guide and demo.json is checked against the dataset AS A PHRASE
      ("16 cells", not "16"), because a bare small integer matches almost any
      document and would be a test that passes by accident.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const D = require('./data.js');
const E = require('./engine.js');

const HERE = __dirname;
const ROOT = path.join(HERE, '..');

let pass = 0, fail = 0;
const results = [];
function ok(name, cond, detail) {
  if (cond) { pass++; results.push(['PASS', name, detail]); }
  else { fail++; results.push(['FAIL', name, detail]); }
}
function head(t) { results.push(['----', t, '']); }
const readRoot = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ==================== 1. shape of the dataset ============================ */
head('1. shape');

ok('There are exactly four doors', D.DOORS.length === 4, String(D.DOORS.length));
ok('There are exactly four axes', D.AXES.length === 4, String(D.AXES.length));
ok('Doors are numbered 1 to 4 in order',
   D.DOORS.map(d => d.n).join(',') === '1,2,3,4');
ok('Axes are numbered 1 to 4 in order',
   D.AXES.map(a => a.n).join(',') === '1,2,3,4');
ok('Door ids are unique', new Set(D.DOORS.map(d => d.id)).size === 4);
ok('Axis ids are unique', new Set(D.AXES.map(a => a.id)).size === 4);
ok('Every axis defines exactly four rungs',
   D.AXES.every(a => Array.isArray(a.bars) && a.bars.length === 4));
ok('Every rung is a sentence rather than a word',
   D.AXES.every(a => a.bars.every(b => b.length > 20)));

ok('The grid has sixteen cells', E.cells(D).length === 16, String(E.cells(D).length));
ok('Every one of the sixteen exists', E.cells(D).every(x => !!x.c),
   E.cells(D).filter(x => !x.c).map(x => x.key).join(', '));
ok('Every cell has a head short enough to read on a phone',
   E.cells(D).every(({ c }) => c.head.length > 0 && c.head.length <= 62),
   E.cells(D).filter(({ c }) => c.head.length > 62).map(x => x.key).join(', '));
ok('Every cell explains itself in more than a sentence fragment',
   E.cells(D).every(({ c }) => c.why.length > 80));
ok('Every bar is a level its own axis defines',
   E.cells(D).every(({ c, axis }) => E.barText(D, axis.id, c.bar) !== null));

/* ==================== 2. the thesis, as data ============================= */
head('2. the argument');

/* The module claims reach rises across the doors and that review burden does
   NOT simply follow. Both halves are properties of the shipped numbers, so
   both are pinned. If a future edit flattens either, this is where it shows. */
ok('The three reach rows rise strictly across the four doors',
   E.reachRowsAreStaircases(D),
   ['see', 'do', 'keep'].map(a => a + ': ' +
     D.DOORS.map(d => E.cell(D, d.id, a).bar).join('')).join(' | '));

ok('The review row is NOT a simple staircase — the module\'s actual claim',
   !E.checkIsStaircase(D),
   'check: ' + D.DOORS.map(d => E.checkOf(D, d.id)).join(''));

const exceptions = E.checkExceptions(D);
ok('At least one door has a review burden that departs from its reach',
   exceptions.length > 0,
   exceptions.map(r => 'door ' + r.n + ' reach ' + r.reach + ' check ' + r.check).join('; '));

/* The specific, non-obvious finding: door 3 is harder to check than door 4.
   This is the one claim on the page that no vendor makes, and it is the
   payload. If somebody re-orders the bars, the prose in CHECK_NOTE stops
   being true, so fail loudly rather than quietly. */
ok('The desktop coworker is the hardest door to check',
   E.checkOf(D, 'coworker') === Math.max.apply(null, D.DOORS.map(d => E.checkOf(D, d.id))),
   'coworker ' + E.checkOf(D, 'coworker') + ' vs coding ' + E.checkOf(D, 'coding'));
ok('The coding agent is easier to check than the coworker, because of the diff',
   E.checkOf(D, 'coding') < E.checkOf(D, 'coworker'));
ok('The agent inside your own documents is among the two cheapest to check',
   E.checkOf(D, 'inapp') <= 2, String(E.checkOf(D, 'inapp')));

/* And the ordering claims must be labelled as reasoning, not as fact. */
ok('Both exception cells are labelled reasoned rather than verified',
   exceptions.every(r => E.cell(D, r.id, 'check').conf === 'reasoned'),
   exceptions.map(r => r.id + ':' + E.cell(D, r.id, 'check').conf).join(', '));
ok('The check-row explanation is present and argues the point at length',
   D.CHECK_NOTE.body.length >= 3 && D.CHECK_NOTE.body.join(' ').length > 400);
ok('The check-row explanation admits it is not verified',
   /reasoned/i.test(D.CHECK_NOTE.body.join(' ')));
ok('The bar scale admits the staircase is an artefact of choosing the doors',
   /chosen|artefact/i.test(D.AXIS_NOTE));

/* ==================== 3. sources and confidence ========================== */
head('3. sources');

const dangling = E.danglingSources(D);
ok('Every claim resolves to a declared source', dangling.length === 0, dangling.join(', '));
const unused = E.unusedSources(D);
ok('No source is declared and never used', unused.length === 0, unused.join(', '));
const vague = E.vagueSourceUrls(D);
ok('Every source URL names a page, not just a host', vague.length === 0, vague.join(', '));
ok('Every source is marked first-party',
   Object.keys(D.SOURCES).every(id => D.SOURCES[id].kind === 'primary'));
ok('Every source has a title long enough to say what it is',
   Object.keys(D.SOURCES).every(id => D.SOURCES[id].t.length > 25),
   Object.keys(D.SOURCES).filter(id => D.SOURCES[id].t.length <= 25).join(', '));
ok('Every source URL is https',
   Object.keys(D.SOURCES).every(id => /^https:\/\//.test(D.SOURCES[id].u)),
   Object.keys(D.SOURCES).filter(id => !/^https:\/\//.test(D.SOURCES[id].u)).join(', '));

/* Every source must belong to the company whose product it describes. This is
   the claim SOURCE_NOTE makes, so it is checked rather than asserted. */
{
  const firstParty = [
    'claude.com', 'help.openai.com', 'learn.chatgpt.com', 'openai.com',
    'support.microsoft.com', 'support.google.com', 'knowledge.workspace.google.com',
    'antigravity.google'
  ];
  const bad = Object.keys(D.SOURCES).filter(id => {
    const host = (D.SOURCES[id].u.split('://')[1] || '').split('/')[0];
    return !firstParty.some(h => host === h || host.endsWith('.' + h));
  });
  ok('Every source host is a vendor host, not a news site or a blog',
     bad.length === 0, bad.join(', '));
}

const noSrc = E.verifiedWithoutSource(D);
ok('No cell claims "verified" without citing a source', noSrc.length === 0, noSrc.join(', '));
const badQuote = E.quotesWithoutSource(D);
ok('Every quotation names the source it came out of', badQuote.length === 0, badQuote.join(', '));

/* A verified cell should carry the vendor's own words where any exist, since
   that is what makes the label checkable by the reader. */
{
  const verified = E.cells(D).filter(({ c }) => c.conf === 'verified');
  const quoted = verified.filter(({ c }) => !!c.quote);
  ok('Every verified cell carries the vendor\'s own wording',
     quoted.length === verified.length,
     quoted.length + ' of ' + verified.length);
}

const conf = E.confTally(D);
ok('Every cell carries one of the three confidence labels',
   conf.verified + conf.reasoned + conf.unconfirmed === 16,
   JSON.stringify(conf));
ok('The majority of cells are verified against a first-party page',
   conf.verified > 16 / 2, String(conf.verified));
ok('At least one cell is honestly labelled as reasoning',
   conf.reasoned > 0, String(conf.reasoned));
ok('Every confidence label used has a definition the reader can see',
   E.cells(D).every(({ c }) => !!D.CONF_LABEL[c.conf]));

/* The negative claim about Google is a claim about the whole world and cannot
   be established by searching. It must not be dressed up as verified. */
ok('The uneven row is labelled unconfirmed, not verified',
   D.UNEVEN.conf === 'unconfirmed', D.UNEVEN.conf);
ok('The uneven row explains why a search cannot prove a non-existence',
   /cannot establish|whole world|did not find/i.test(D.UNEVEN.note));

ok('The source note discloses that OpenAI pages refuse automated retrieval',
   /403|refuse[sd]? automated/i.test(D.SOURCE_NOTE));

/* ==================== 4. the two self-imposed rules ====================== */
head('4. no prices, no ranking');

const money = E.priceLeaks(D);
ok('No price reaches any string the page can display', money.length === 0, money.join(' | '));
const rank = E.rankingLeaks(D);
ok('No vendor is recommended or ranked', rank.length === 0, rank.join(', '));

/* A null result proves nothing unless the probe is known to fire. Both
   detectors are shown working against a known positive, and shown NOT firing
   against a near-miss, so a pass above means the detector looked and found
   nothing rather than that it cannot see. */
ok('CONTROL: the price detector fires on a real price',
   E.MONEY.test('Pro is $20/month') && E.MONEY.test('costs £15 per month') &&
   E.MONEY.test('20 dollars') && E.MONEY.test('billed per seat'));
ok('CONTROL: the price detector does not fire on ordinary prose',
   !E.MONEY.test('four doors and sixteen cells, checked in September 2026') &&
   !E.MONEY.test('Gemini 3.8 Flash') && !E.MONEY.test('door 3 reaches at level 3'));
ok('CONTROL: the ranking detector fires on a recommendation',
   E.RANKING.test('we recommend Claude') &&
   E.RANKING.test('this is the best tool for the job') &&
   E.RANKING.test('it is better than Copilot'));
ok('CONTROL: the ranking detector does not fire on a neutral comparison',
   !E.RANKING.test('the smallest door that does the whole job') &&
   !E.RANKING.test('easier to check than the door above it'));

/* The probe must also be aimed at something. If screenStrings ever stops
   walking the dataset, both rules above would pass vacuously. */
{
  const strings = E.screenStrings(D);
  ok('The price and ranking probes actually walk the dataset',
     strings.length > 200, strings.length + ' strings');
  ok('The walk reaches the cells, the jobs and the cut list',
     strings.some(([p]) => p.startsWith('CELLS.')) &&
     strings.some(([p]) => p.startsWith('JOBS')) &&
     strings.some(([p]) => p.startsWith('CUT')));
  /* SELF-EXCLUSION: the detectors must not be matching their own definitions.
     screenStrings deliberately walks only the named prose keys, so a probe
     planted in the dataset is found and one living in engine.js is not. */
  ok('CONTROL: a planted price inside the dataset would be caught',
     E.priceLeaks({
       INTRO: { title: 'Pro costs $20 a month', body: [], note: '' },
       AXES: [], DOORS: [], CELLS: {}, CHECK_NOTE: { head: '', body: [] },
       JOBS: [], JOBS_NOTE: '', VERDICT_LABEL: {}, CHANGED: [], CHANGED_NOTE: '',
       STALE: { head: '', rot: [], keep: [] }, UNEVEN: {}, CUT: [],
       CONF_LABEL: {}, SOURCE_NOTE: ''
     }).length === 1);
}

/* ==================== 5. act II ========================================== */
head('5. pick a job');

ok('Every job has a verdict for every door',
   D.JOBS.every(j => D.DOORS.every(d => !!E.verdict(D, j, d.id))));
ok('Every verdict is one of the three the legend defines',
   D.JOBS.every(j => D.DOORS.every(d => !!D.VERDICT_LABEL[E.verdict(D, j, d.id).v])));
ok('Every verdict names one of the four axes as its reason',
   D.JOBS.every(j => D.DOORS.every(d =>
     D.AXES.some(a => a.id === E.verdict(D, j, d.id).axis))));
ok('Every verdict argues itself in a sentence rather than a word',
   D.JOBS.every(j => D.DOORS.every(d => E.verdict(D, j, d.id).why.length > 40)));
ok('Every verdict declares what you hand over, even when that is nothing',
   D.JOBS.every(j => D.DOORS.every(d => typeof E.verdict(D, j, d.id).hand === 'string')));
/* "You hand over nothing" is true of a door that does the job for free and,
   misleadingly, of one that cannot do it at all. The card renders those two
   cases differently, so the data must not blur them: a "wrong door" verdict
   declares no access, because no amount of access would change the answer. */
ok('A "wrong door" verdict asks for no access at all',
   D.JOBS.every(j => D.DOORS.every(d => {
     const v = E.verdict(D, j, d.id);
     return v.v !== 'no' || v.hand === '';
   })),
   D.JOBS.flatMap(j => D.DOORS.filter(d => {
     const v = E.verdict(D, j, d.id); return v.v === 'no' && v.hand !== '';
   }).map(d => j.id + '/' + d.id)).join(', '));
ok('Every "does the whole job" verdict at door 3 or 4 names a real cost',
   D.JOBS.every(j => ['coworker', 'coding'].every(id => {
     const v = E.verdict(D, j, id);
     return v.v !== 'yes' || v.hand.length > 10;
   })));
ok('Every job says enough about itself to be recognisable',
   D.JOBS.every(j => j.name.length > 20 && j.detail.length > 40));
ok('Job ids are unique', new Set(D.JOBS.map(j => j.id)).size === D.JOBS.length);

ok('Every job is doable at some door',
   D.JOBS.every(j => !!E.bestDoor(D, j)),
   D.JOBS.filter(j => !E.bestDoor(D, j)).map(j => j.id).join(', '));

/* The teaching claim of act II: the smallest sufficient door is often a small
   one. Asserted as a count, from the verdicts, so the prose cannot drift. */
const low = E.jobsSolvedLow(D);
ok('At least two jobs are finished completely by door 1 or door 2',
   low.length >= 2, low.map(j => j.id).join(', '));
ok('At least one job is finished by a chat window alone',
   D.JOBS.some(j => { const b = E.bestDoor(D, j); return b && b.n === 1; }));
ok('At least one job cannot be done at door 1 at all — the floor exists',
   D.JOBS.some(j => E.verdict(D, j, 'chat').v === 'no'),
   D.JOBS.filter(j => E.verdict(D, j, 'chat').v === 'no').map(j => j.id).join(', '));
ok('The jobs span the doors rather than all landing on one',
   Object.keys(E.bestDoorSpread(D)).filter(k => E.bestDoorSpread(D)[k] > 0).length >= 3,
   JSON.stringify(E.bestDoorSpread(D)));

/* bestDoor is computed and the page prints it. Pin the definition so a future
   change to "smallest" cannot silently become "first listed" or "largest". */
{
  const j = E.jobById(D, 'rename');
  ok('The file-renaming job is impossible at both of the first two doors',
     E.verdict(D, j, 'chat').v === 'no' && E.verdict(D, j, 'inapp').v === 'no');
  ok('And its smallest sufficient door is the coworker, not the coding agent',
     E.bestDoor(D, j).id === 'coworker', E.bestDoor(D, j).id);
  const q = E.jobById(D, 'questions');
  ok('The quiz-writing job is finished at door 1 and hands over nothing',
     E.bestDoor(D, q).n === 1 && E.verdict(D, q, 'chat').hand === '');
}

ok('A job that touches student work carries an institutional caution',
   !!E.jobById(D, 'reflections').caution);
ok('That caution points at the institution rather than answering for it',
   /your institution|registrar|IT/i.test(E.jobById(D, 'reflections').caution));
ok('The jobs note admits the list is not a sample of a real week',
   /chosen to span|not a sample/i.test(D.JOBS_NOTE));

/* ==================== 6. the receipts ==================================== */
head('6. receipts');

ok('At least two product names are shown as already changed',
   D.CHANGED.length >= 2, String(D.CHANGED.length));
ok('Every changed entry names the old name, the new one and what it is',
   D.CHANGED.every(c => c.was && c.now && c.what && c.body.length > 60));
ok('At least two of the changes are quoted from the vendor',
   D.CHANGED.filter(c => !!c.quote).length >= 2);
ok('Every change cites a source', D.CHANGED.every(c => c.src && c.src.length));
ok('The Word rename is on the page, since it is the clearest example',
   D.CHANGED.some(c => /Agent Mode/i.test(c.was)));
ok('The ChatGPT agent retirement is on the page',
   D.CHANGED.some(c => /ChatGPT agent/i.test(c.was)));

ok('The cut list is not empty and every entry says why',
   D.CUT.length > 0 && D.CUT.every(c => c.claim && c.why && c.why.length > 40));
ok('Prices are explicitly in the cut list',
   D.CUT.some(c => /price/i.test(c.claim)));
ok('The stale panel predicts what will rot and what will hold',
   D.STALE.rot.length >= 3 && D.STALE.keep.length >= 3);

ok('The page carries the date it was checked',
   /\d{4}/.test(D.CHECKED_ON) && /^\d{4}-\d{2}-\d{2}$/.test(D.CHECKED_ISO), D.CHECKED_ON);
ok('The prose date and the machine date agree',
   D.CHECKED_ON.indexOf(D.CHECKED_ISO.slice(0, 4)) > -1 &&
   D.CHECKED_ISO.slice(5, 7) === '09' && /September/.test(D.CHECKED_ON),
   D.CHECKED_ON + ' vs ' + D.CHECKED_ISO);
ok('The introduction warns that the page will go stale',
   /stale/i.test(D.INTRO.note));

/* ==================== 7. prose against code ==============================
   The characteristic failure of this repository, guarded as a phrase match so
   a bare "4" in an unrelated sentence cannot make it pass.
   ======================================================================= */
head('7. prose');

const readme = readRoot('README.md');
const guide  = fs.readFileSync(path.join(HERE, 'presenter-guide.html'), 'utf8');
const manifest = readRoot('demo.json');
const docs = [readme, guide, manifest].join('\n');

{
  const c = E.counts(D);
  const pins = [
    [c.gridCells + ' cells', 'the size of the grid'],
    [c.jobCells + ' judgements', 'act II verdict count'],
    [c.sources + ' sources', 'the source count'],
    [c.verifiedCells + ' verified', 'verified cell count'],
    [c.reasonedCells + ' reasoned', 'reasoned cell count'],
    [c.cut + ' things cut', 'the cut-list length'],
    [c.doors + ' doors', 'the door count'],
    [c.axes + ' axes', 'the axis count'],
    [c.jobs + ' jobs', 'the job count']
  ];
  const missing = pins.filter(([p]) => !docs.includes(p)).map(([p, w]) => `"${p}" (${w})`);
  ok('Every count quoted in the docs matches the dataset',
     missing.length === 0, 'not found in README, guide or manifest: ' + missing.join(', '));
  results.push(['    ', pins.length + ' figures cross-checked against three documents', '']);

  /* CONTROL: the cross-check must be capable of failing. A figure the code
     does not produce must be absent from all three documents. */
  ok('CONTROL: a wrong count would not be found in the docs',
     !docs.includes((c.gridCells + 1) + ' cells') &&
     !docs.includes((c.sources + 1) + ' sources'));
}

ok('The check date appears in README.md', readme.includes(D.CHECKED_ISO) || readme.includes(D.CHECKED_ON));
ok('The check date appears in the presenter guide', guide.includes(D.CHECKED_ON));
ok('The manifest records the check date as the added date',
   JSON.parse(manifest).added === D.CHECKED_ISO, JSON.parse(manifest).added);

/* Prices are allowed in README.md, but only inside a marked block that states
   when they were read — otherwise a figure creeps in undated. */
{
  const b = readme.indexOf('<!-- prices:begin -->');
  const e = readme.indexOf('<!-- prices:end -->');
  ok('README.md marks off the one block where figures are allowed', b > -1 && e > b);
  if (b > -1 && e > b) {
    const inside = readme.slice(b, e);
    const outside = readme.slice(0, b) + readme.slice(e);
    ok('That block states the date the figures were read',
       inside.includes(D.CHECKED_ISO) || inside.includes(D.CHECKED_ON));
    ok('No figure appears in README.md outside that block',
       !E.MONEY.test(outside),
       (outside.match(E.MONEY) || []).join(' | '));
    ok('CONTROL: the block does contain figures, so the rule has something to guard',
       E.MONEY.test(inside));
  }
  ok('No price appears anywhere in the presenter guide',
     !E.MONEY.test(guide), (guide.match(E.MONEY) || []).join(' | '));
}

/* ==================== 8. the built file ==================================
   The contract is "loads and runs offline". Assert it of the shipped artefact
   rather than of the sources, because the shipped artefact is what a reader
   opens.
   ======================================================================= */
head('8. the built file');

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  ok('index.html exists — run node build.js', false);
} else {
  const built = readRoot('index.html');

  ok('The built file is one file with everything inlined', built.length > 60000,
     (built.length / 1024).toFixed(0) + ' KB');

  const fetchers = [];
  built.replace(/<(script|link|img|iframe|source|video|audio|embed|object|track)\b[^>]*>/gi, tag => {
    if (/\b(src|href|data)\s*=\s*["']?(?!#)[^"'>\s]+/i.test(tag) && !/data:/i.test(tag)) {
      fetchers.push(tag.slice(0, 70));
    }
    return tag;
  });
  ok('Nothing in the built file fetches an external resource',
     fetchers.length === 0, fetchers.join(' | '));

  ok('The built file makes no runtime network calls',
     !/\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|importScripts|navigator\.sendBeacon|EventSource/.test(built));
  ok('The built file stores nothing on the device',
     !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(built));
  ok('The built file runs no AI at runtime',
     !/api\.openai|api\.anthropic|generativelanguage|\bapi[_-]?key\b/i.test(built));

  /* CONTROL: those three probes must be able to fire. */
  ok('CONTROL: the network probe fires on a page that does fetch',
     /\bfetch\s*\(|XMLHttpRequest/.test('const r = await fetch("/x")'));
  ok('CONTROL: the storage probe fires on a page that does store',
     /localStorage/.test('localStorage.setItem("a",1)'));

  /* Outbound links are permitted by the contract as amended 2026-09-08, but
     every one must be a source the dataset declares — no stray URLs. */
  {
    const declared = new Set(Object.keys(D.SOURCES).map(id => D.SOURCES[id].u));
    const urls = Array.from(new Set(built.match(/https?:\/\/[^\s"'<>)]+/g) || []))
      .map(u => u.replace(/[.,;]$/, ''));
    const stray = urls.filter(u => !declared.has(u));
    ok('Every URL in the built file is a declared source', stray.length === 0, stray.join(' | '));
    ok('And every declared source actually reaches the page',
       Object.keys(D.SOURCES).every(id => built.includes(D.SOURCES[id].u)),
       Object.keys(D.SOURCES).filter(id => !built.includes(D.SOURCES[id].u)).join(', '));
    ok('Every outbound link opens safely',
       (built.match(/target="_blank"/g) || []).length > 0 &&
       !/target="_blank"(?![^>]*rel=)/.test(built.replace(/rel="noopener noreferrer"/g, 'rel="ok"')) ||
       /rel = 'noopener noreferrer'|rel="noopener noreferrer"/.test(built));
  }

  ok('No price reaches the built page',
     !E.MONEY.test(built), (built.match(E.MONEY) || []).join(' | '));

  ok('The presenter guide is embedded, so the notes need no sibling file',
     built.includes('<div class="guide-scope">'));
  ok('The guide\'s page chrome did NOT leak into the app',
     built.indexOf('Standalone printable page only') === -1);

  ok('Attribution is visible in the built file',
     built.includes('Bryant Harrison') && built.includes('Murray State University'));
  ok('The guide overlay and the settings overlay both ship',
     built.includes('id="howto"') && built.includes('id="settings"'));
  ok('Presentation mode and the presenter notes both ship',
     built.includes('id="chk-presenter"') && built.includes('id="notes"'));
  ok('The date is stamped where the room can see it',
     built.includes('class="stamp"') && built.includes('js-date'));

  /* ---- CONTRACT.md "Required UX", asserted of the shipped page -----------
     Every label check below is scoped to the block that owns it. A
     document-wide search would pass on this page for the wrong reason: the
     presenter guide is injected into the same file and its own prose names
     "Open Presenter Notes", "Presentation mode" and "Reset" while telling the
     presenter what the buttons do. That would be the test matching its own
     answer key, so each region is cut out first and proved guide-free.
     -------------------------------------------------------------------- */
  {
    /* Regions are cut out of a COMMENT-MASKED copy, for the same reason
       build.js masks before it looks for the guide's markers: the comment that
       documents a thing is not the thing. Without this, the settings region
       swallowed the head comment of the notes overlay, whose text explains
       that the guide is "scoped to .guide-scope" -- and the exclusion below
       failed on a mention rather than on a leak. Masking preserves length and
       newlines, so every offset still lines up with the real file. */
    const code = built.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));

    const region = (openMark, closeMark, what) => {
      const b = code.indexOf(openMark);
      const e = b > -1 ? code.indexOf(closeMark, b) : -1;
      ok('The ' + what + ' block can be isolated from the rest of the page', b > -1 && e > b);
      return b > -1 && e > b ? code.slice(b, e) : '';
    };

    /* The header, from the brand bar to the end of the tool cluster. */
    const headerBlock = region('<div id="topbar-tools">', '</header>', 'header tools');
    /* Settings, from its overlay to the next overlay that follows it. */
    const settingsBlock = region('<div class="overlay" id="settings"', '<div class="overlay" id="notes"', 'settings');

    ok('Neither block contains any of the injected guide',
       !headerBlock.includes('guide-scope') && !settingsBlock.includes('guide-scope'));
    ok('CONTROL: the guide IS in the page, so that exclusion is not vacuous',
       built.includes('guide-scope'));

    /* Guide (?) */
    ok('The header carries a ? button whose accessible name is exactly "Guide"',
       /<button[^>]*id="btn-howto"[^>]*>\s*\?\s*<\/button>/.test(headerBlock) &&
       /id="btn-howto"[^>]*aria-label="Guide"/.test(headerBlock) &&
       /id="btn-howto"[^>]*title="Guide"/.test(headerBlock),
       (headerBlock.match(/<button[^>]*id="btn-howto"[^>]*>/) || [''])[0]);
    ok('The guide overlay is headed "Guide"',
       /<h2 id="howto-title">Guide<\/h2>/.test(built));
    ok('The guide overlay opens on first load',
       /open\('howto'\)/.test(built));

    /* Settings (gear), and the three labels the contract fixes. */
    ok('Settings sits beside it and is named Settings',
       /id="btn-settings"[^>]*aria-label="Settings"/.test(headerBlock));
    for (const label of ['Open Presenter Notes', 'Presentation mode', 'Reset']) {
      ok('The settings menu offers "' + label + '", spelled exactly that way',
         settingsBlock.includes(label));
    }
    ok('CONTROL: a label the menu does not carry is not found in that block',
       !settingsBlock.includes('Restart the round') &&
       !settingsBlock.includes('Presenter’s notes'));
    /* The scoping above is not decoration. The guide is injected into this
       same file and names all three labels in its own "Before you present"
       section, so a document-wide search for them would pass whether or not
       the buttons exist -- it would be matching the answer key. Prove that
       trap is real, so nobody later "simplifies" the scoping away. */
    {
      const notesBlock = built.slice(built.indexOf('<div class="guide-scope">'));
      ok('CONTROL: the injected guide names all three labels too, which is why the search is scoped',
         ['Open Presenter Notes', 'Presentation mode', 'Reset']
           .every(l => notesBlock.includes(l)));
    }

    /* The three are controls, not prose about controls. */
    ok('Open Presenter Notes is a button that opens the notes overlay',
       /<button[^>]*id="btn-notes"[^>]*>Open Presenter Notes<\/button>/.test(settingsBlock) &&
       /#btn-notes'\)\.addEventListener\('click'/.test(built));
    ok('Presentation mode is a checkbox that toggles the presenting class',
       /<input type="checkbox" id="chk-presenter">/.test(settingsBlock) &&
       /classList\.toggle\('presenting'/.test(built));
    ok('Reset is a button wired to a whole-demo reset',
       /<button[^>]*id="btn-reset"[^>]*>Reset<\/button>/.test(settingsBlock) &&
       /#btn-reset'\)\.addEventListener\('click', resetDemo\)/.test(built));

    /* Reset's fresh-load semantics, read off the function body rather than
       trusted to its name: it must clear the job, re-render, close every
       overlay and return to Act I -- and must NOT touch presentation mode. */
    {
      const b = built.indexOf('function resetDemo()');
      const body = b > -1 ? built.slice(b, built.indexOf('\n}', b)) : '';
      ok('Reset returns the demo to its fresh-load state', b > -1 &&
         /S\.job = null/.test(body) && /renderJob\(\)/.test(body) &&
         /selftest-out/.test(body) && /o\.hidden = true/.test(body) &&
         /setAct\(1\)/.test(body));
      ok('Reset leaves presentation mode alone',
         b > -1 && !/presenting|chk-presenter|S\.presenter/.test(body));
      ok('CONTROL: that probe reads a real function body, not an empty slice',
         body.length > 120, body.length + ' chars');
    }

    /* The retitle (Path A). "Front Doors" may survive as a subtitle; the
       DISPLAY TITLE may not. */
    ok('The page title is the new display title',
       /<title>AI Tool Guide [^<]*<\/title>/.test(built),
       (built.match(/<title>[^<]*<\/title>/) || [''])[0]);
    ok('The header brand carries the new display title',
       /<span class="b1">AI TOOL GUIDE/.test(built));
    ok('The guide heading carries the new display title',
       guide.includes('AI Tool Guide'));
    ok('The old display title is not left standing as a heading',
       !/<h1>Front Doors\b/.test(guide) && !/<span class="b1">FRONT DOORS/.test(built));
  }

  const guideOut = readRoot('presenter-guide.html');
  ok('The shipped guide is byte-identical to its source',
     guideOut === guide);
}

/* ==================== 9. phone-first, mechanically ======================= */
head('9. phone');

{
  const css = fs.readFileSync(path.join(HERE, 'styles.css'), 'utf8');

  /* Tap targets. The repository floor is 36px; nothing declares less. */
  const smalls = (css.match(/min-height:\s*(\d+)px/g) || [])
    .map(m => +m.match(/(\d+)/)[1]).filter(v => v < 36);
  ok('No interactive rule declares a tap target below the 36px floor',
     smalls.length === 0, smalls.join(', '));
  ok('CONTROL: that probe reads real values out of the stylesheet',
     (css.match(/min-height:\s*\d+px/g) || []).length >= 6,
     (css.match(/min-height:\s*\d+px/g) || []).length + ' declarations found');

  /* The four-by-four grid must not be a horizontal scroller. The mechanism is
     the two wrappers collapsing with display:contents above a breakpoint, so
     pin the mechanism rather than hoping. */
  ok('The grid stacks by default and only becomes a grid at a breakpoint',
     /#grid\s*\{[^}]*display:\s*flex/.test(css) &&
     /@media \(min-width: 940px\)/.test(css));
  ok('The wide layout collapses the wrappers rather than duplicating markup',
     /\.g-rail,\s*\.g-group\s*\{\s*display:\s*contents/.test(css));
  ok('The body never becomes a horizontal scroll container',
     /overflow-x:\s*clip/.test(css) && !/body[^{]*\{[^}]*overflow-x:\s*(auto|scroll)/.test(css));
  ok('Wide content that must scroll does so inside its own container',
     /\.scroll\s*\{\s*overflow-x:\s*auto/.test(css));

  /* Red-orange is reserved for genuine failure states. */
  const redUses = (css.match(/var\(--red\)/g) || []).length;
  ok('Red-orange is used sparingly, for failure states only',
     redUses > 0 && redUses <= 8, redUses + ' uses');
  ok('The Murray State palette is declared',
     /--navy:\s*#002144/.test(css) && /--gold:\s*#ECAC00/.test(css) &&
     /--sky:\s*#00A4E3/.test(css) && /--red:\s*#FF4500/.test(css));

  ok('Presentation mode scales the grid as well as the buttons',
     /body\.presenting \.g-cell/.test(css));
  ok('Reduced-motion is honoured', /prefers-reduced-motion/.test(css));
}

/* ==================== 10. the manifest =================================== */
head('10. manifest');

{
  const m = JSON.parse(readRoot('demo.json'));
  ok('The slug is the folder name', m.slug === 'front-doors', m.slug);
  ok('The entry point is the built file', m.entry === 'index.html');
  ok('The guide is declared, both html and pdf',
     m.guide && m.guide.html === 'presenter-guide.html' &&
     /\.pdf$/.test(m.guide.pdf), JSON.stringify(m.guide));
  ok('The declared guide files exist',
     fs.existsSync(path.join(ROOT, m.guide.html)) &&
     fs.existsSync(path.join(ROOT, m.guide.pdf)),
     'html ' + fs.existsSync(path.join(ROOT, m.guide.html)) +
     ', pdf ' + fs.existsSync(path.join(ROOT, m.guide.pdf)));
  ok('Provenance is recorded rather than left empty',
     Array.isArray(m.built_with) && m.built_with.length > 0, JSON.stringify(m.built_with));
  ok('Attribution names the author and the institution',
     m.attribution && m.attribution.author === 'Bryant Harrison' &&
     m.attribution.institution === 'Murray State University');
  ok('The theme is the Murray State one', m.theme === 'murray-state');
  /* The key set is CONTRACT.md's, as rewritten for the 2026-09-09 UX pass:
     howto_popup became guide_button, and settings_reset / notes_match_guide
     joined it. A key is never deleted, only answered honestly. */
  ok('The compliance block carries every key the contract names',
     ['readme', 'guide', 'guide_button', 'settings_menu', 'presentation_mode',
      'presenter_notes', 'settings_reset', 'notes_match_guide', 'msu_theme',
      'attribution_visible', 'mobile',
      'offline_no_inference'].every(k => k in m.compliance),
     Object.keys(m.compliance).join(','));
  ok('The manifest title is the new display title',
     m.title === 'AI Tool Guide', m.title);
  ok('Provenance names this build step',
     m.built_with.includes('claude-code'), JSON.stringify(m.built_with));
  ok('The folder name and the declared guide filenames did NOT change with it',
     m.slug === 'front-doors' && m.guide.html === 'presenter-guide.html' &&
     m.guide.pdf === 'Front-Doors-Presenter-Guide.pdf');
  ok('No compliance key is missing rather than false',
     Object.keys(m.compliance).every(k => [true, false, 'unverified'].includes(m.compliance[k])));
  ok('The manifest carries no price either',
     !E.MONEY.test(readRoot('demo.json')));
}

/* ============================== report ================================== */

const width = results.reduce((m, r) => Math.max(m, r[1].length), 0);
for (const [state, name, detail] of results) {
  if (state === 'FAIL' || state === '----' || process.env.VERBOSE) {
    if (state === '----') console.log('\n--- ' + name + ' ' + '-'.repeat(Math.max(0, 52 - name.length)));
    else console.log(state, name.padEnd(width), detail ? '| ' + detail : '');
  }
}
console.log('\n' + '='.repeat(64));
console.log(fail ? `${fail} of ${pass + fail} checks FAILED` : `all ${pass} checks passed`);
process.exit(fail ? 1 : 0);
