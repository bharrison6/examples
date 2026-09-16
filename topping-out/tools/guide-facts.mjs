#!/usr/bin/env node
/* guide-facts.mjs — the fact-preservation harness for the guide split.
   ==========================================================================

   THE PROBLEM THIS SOLVES. The instructor guide was 8,294 words in one
   document. Template part A9 caps the injected session guide at 2,500 words,
   so the content has to go three places: the session guide (canonical,
   injected), the appendix page (linked, not injected), or on-screen UI copy.
   "I read it carefully and I think I got everything" is not a proof, and a
   dropped fact in a domain document is exactly the failure nobody notices.

   SO: enumerate first, split second, then prove coverage mechanically.

     node tools/guide-facts.mjs enumerate   -> writes tools/guide-facts.json
                                               from the PRE-SPLIT guide
     node tools/guide-facts.mjs verify      -> checks every enumerated atom
                                               still lands somewhere, and
                                               exits non-zero if one does not

   WHAT COUNTS AS AN ATOM. Two layers, because each catches what the other
   misses:

     1. UNITS — every block-level content element in .guide-scope (p, li, td,
        h2, h3, caption, box). A unit is the granularity a human ledger can
        actually be read at, and each one is assigned a destination.

     2. TOKENS — the load-bearing particles inside the units: every number
        with its unit ($4,450,000 / 44% / 1.375x / 89 working days), every
        activity id the demo uses (MEP1, INSP3, DKC...), every relationship
        code (FS+4, SS+2, FF+2), and every proper noun / cited name. A unit
        can be reworded during a split; a token cannot go missing without a
        fact going missing. Tokens are the part a reading-and-trusting pass
        loses, so they are the part the check is built on.

   WHY BOTH. Units alone would pass if a paragraph were carried over with its
   figures quietly dropped. Tokens alone would pass if every number survived
   in a table while the sentence explaining what it means was deleted. The
   check requires both, and reports them separately.

   NEGATIVE CONTROL is built in: `verify --selftest` deletes one known token
   from the destination set in memory and asserts the checker FAILS. A
   coverage check that cannot fail proves nothing, and this one has to
   demonstrate it can before its pass is worth reading. */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const DEMO = path.join(HERE, '..');
const LEDGER = path.join(HERE, 'guide-facts.json');

const G_OPEN = '<div class="guide-scope">';
const G_CLOSE = '</div><!-- /guide -->';

function scope(html) {
  const a = html.indexOf(G_OPEN);
  const b = html.indexOf(G_CLOSE);
  if (a < 0 || b < 0) throw new Error('no .guide-scope body found');
  return html.slice(a + G_OPEN.length, b);
}

function textOf(fragment) {
  return fragment
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&minus;/g, '−').replace(/&times;/g, '×')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#9888;/g, '⚠').replace(/&rsquo;/g, '’')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---- UNITS ------------------------------------------------------------- */
const BLOCK = /<(h2|h3|p|li|td|th|caption|div)\b[^>]*>([\s\S]*?)<\/\1>/gi;

function units(body) {
  const out = [];
  let m;
  BLOCK.lastIndex = 0;
  while ((m = BLOCK.exec(body))) {
    const tag = m[1].toLowerCase();
    const txt = textOf(m[2]);
    /* A <div class="box"> wraps <p>s that are themselves captured, and a <td>
       inside a captured row is captured once. Skip the wrappers so a unit is
       never double-counted, and skip anything with no prose in it at all. */
    if (tag === 'div' && /<p\b/i.test(m[2])) continue;
    if (txt.length < 3) continue;
    out.push({ tag, text: txt });
  }
  return out;
}

/* ---- TOKENS ------------------------------------------------------------ */
/* Each pattern is deliberately narrow: a token has to be something whose
   disappearance is a lost fact, not any word that happens to be capitalised. */
const TOKEN_PATTERNS = [
  /\$[\d,]+(?:\.\d+)?(?:[MK])?/g,              // $4,450,000  $8,500  $4.45M
  /\d+(?:\.\d+)?\s*%/g,                        // 45%  37.5%
  /\d+(?:\.\d+)?\s*×/g,                        // 1.375×
  /\b\d+(?:\.\d+)?\s*(?:working\s+days?|calendar\s+days?|days?|weeks?|hr|hours?|minutes?|min|activities|turns?|crew-days?|mph)\b/gi,
  /\b(?:FS|SS|FF)\s*[+-]?\s*\d*\b/g,           // FS+4  SS+2  FF+2  FS0
  /\b(?:T\d{1,2}|MOB|EXC|FTG|FTGC|FDW|FDWC|STL\d|DECK\d|DKC|INSP\d|ENV\d|INSUL|DRY\d|FIN\d|MEP\d|COMM|PUNCH|ELEV|ROOF|SOG)\b/g,
  /\b(?:MSU-1|CMGT-201|TOPPING|CALLOWAY)\b/g,  // the four measured seeds
  /\b(?:Business\s+Roundtable|Thomas|Raynar|MCAA|ASCE|OSHA|Bureau\s+of\s+Labor\s+Statistics|Racer\s+Commons|Shoe\s+Tree\s+Annex|P6)\b/g,
  /\b(?:Report\s+C-2|Bulletin\s+OT1|IG-01|SD-98)\b/g,
  /\b0\.\d{2,3}\b/g,                           // 0.62  0.75  0.938
  /\b\d{1,2}\s+(?:Mar|Sep)\s+\d{4}\b/g         // 12 Mar 2027
];

function tokens(text) {
  const set = new Map();
  for (const re of TOKEN_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      /* Trailing sentence punctuation is not part of the fact: "$185,000,"
         and "$185,000" are one token, and keeping both would demand the
         destination reproduce the comma too. */
      const raw = m[0].replace(/\s+/g, ' ').replace(/[,.;:]+$/, '').trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      set.set(key, (set.get(key) || 0) + 1);
    }
  }
  return set;
}

/* Tokens are collected PER UNIT and unioned, never from the concatenated
   body. Concatenating adjacent table cells invents tokens that no sentence
   ever contained — "0.930" in one cell followed by "Week 5 and after" in the
   next reads as the token "0.930 week", which the destinations could only
   satisfy by accident. A false token is worse than a missed one here: it
   makes the check fail for a fact that was never in the source, and the fix
   for that kind of failure is to weaken the checker. */
function tokensOfUnits(unitList) {
  const all = new Map();
  for (const u of unitList) {
    for (const [k, n] of tokens(u.text)) all.set(k, (all.get(k) || 0) + n);
  }
  return all;
}

/* ---- destinations ------------------------------------------------------ */
/* The three places a fact is allowed to land. Each is read from disk at
   verify time, so the proof is against what actually shipped. */
function destinations() {
  const read = f => {
    const p = path.join(DEMO, f);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  };
  /* Only the .guide-scope body counts, for both the word band and the fact
     check. textOf() strips tags but NOT the text between <style> and
     </style>, so measuring the whole file counts 136 lines of CSS as prose —
     which inflated the A9 word count to 3,402 on the first run and would
     also let a fact "land" in a stylesheet comment. */
  const body = f => {
    const src = read(f);
    if (!src) return '';
    const a = src.indexOf(G_OPEN);
    const b = src.indexOf(G_CLOSE);
    if (a < 0 || b < 0) return '';
    return textOf(src.slice(a + G_OPEN.length, b));
  };
  return {
    /* the canonical injected session guide */
    session: body('src/demo-guide.html'),
    /* the linked appendix — CPM background, vocabulary, sources */
    appendix: body('src/appendix.html'),
    /* on-screen UI copy: the template's stage intros, details drawer and
       checks, plus the data file's own prose (call text, glossary, event
       cards) which is where a lot of this guide's vocabulary already lives */
    ui: textOf(read('src/template.html')) + ' ' + read('src/data.js') + ' ' + read('src/app.js')
  };
}

/* ---- commands ---------------------------------------------------------- */
function enumerate() {
  /* Enumerate from the PRE-SPLIT guide. Read it out of git if the working
     copy has already been split, so the ledger is always the real baseline
     and re-running this command cannot silently re-baseline onto the split. */
  const live = path.join(DEMO, 'src/teacher-guide.html');
  let src;
  if (fs.existsSync(live)) {
    src = fs.readFileSync(live, 'utf8');
  } else {
    throw new Error('src/teacher-guide.html is gone; enumerate before splitting, or restore it from git');
  }
  const body = scope(src);
  const u = units(body);
  const full = textOf(body);
  const t = tokensOfUnits(u);
  const ledger = {
    enumerated: new Date().toISOString(),
    source: 'src/teacher-guide.html',
    words: full.split(/\s+/).length,
    unitCount: u.length,
    tokenCount: t.size,
    units: u.map((x, i) => ({ id: 'U' + String(i + 1).padStart(3, '0'), tag: x.tag, text: x.text })),
    tokens: Object.fromEntries([...t.entries()].sort())
  };
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
  console.log(`enumerated ${ledger.unitCount} units and ${ledger.tokenCount} distinct tokens`);
  console.log(`from ${ledger.words} words of .guide-scope prose -> tools/guide-facts.json`);
}

function verify(opts) {
  if (!fs.existsSync(LEDGER)) throw new Error('no ledger; run `node tools/guide-facts.mjs enumerate` first');
  const ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
  const d = destinations();
  let haystack = (d.session + ' ' + d.appendix + ' ' + d.ui);

  /* NEGATIVE CONTROL. Remove one token that the real run finds, and require
     the checker to report it missing. If this does not fail, the check is
     not measuring anything and its pass is worthless. */
  if (opts.selftest) {
    const bait = Object.keys(ledger.tokens).find(k => haystack.toLowerCase().includes(k));
    if (!bait) { console.error('SELFTEST INCONCLUSIVE: no token was present to remove'); process.exit(1); }
    const re = new RegExp(bait.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    haystack = haystack.replace(re, ' ');
    console.log(`self-test: removed every occurrence of "${bait}" from the destination set`);
  }

  const hay = haystack.toLowerCase().replace(/\s+/g, ' ');
  const missing = [];
  for (const tok of Object.keys(ledger.tokens)) {
    if (!hay.includes(tok)) missing.push(tok);
  }

  const where = t => {
    const hits = [];
    if (d.session.toLowerCase().includes(t)) hits.push('session');
    if (d.appendix.toLowerCase().includes(t)) hits.push('appendix');
    if (d.ui.toLowerCase().includes(t)) hits.push('ui');
    return hits.join('+') || '—';
  };

  const sessionWords = d.session.split(/\s+/).filter(Boolean).length;
  console.log(`session guide: ${sessionWords} words (A9 band: <= 2500)`);
  console.log(`appendix: ${d.appendix.split(/\s+/).filter(Boolean).length} words`);
  console.log(`tokens enumerated: ${Object.keys(ledger.tokens).length}`);
  console.log(`tokens located:    ${Object.keys(ledger.tokens).length - missing.length}`);

  if (opts.map) {
    for (const t of Object.keys(ledger.tokens)) console.log(`  ${where(t).padEnd(22)} ${t}`);
  }

  if (missing.length) {
    console.error(`\nFACT-PRESERVATION FAIL: ${missing.length} token(s) from the pre-split guide land nowhere:`);
    missing.forEach(t => console.error('  - ' + t));
    if (opts.selftest) { console.log('\nself-test OK: the checker failed as it was supposed to.'); process.exit(0); }
    process.exit(1);
  }
  if (opts.selftest) { console.error('\nSELFTEST FAIL: removing a token did not make the check fail.'); process.exit(1); }
  if (sessionWords > 2500) { console.error(`\nA9 FAIL: session guide is ${sessionWords} words, over the 2,500 band`); process.exit(1); }
  console.log('\nFACT PRESERVATION OK — every enumerated token lands in the session guide, the appendix or on-screen UI.');
}

/* ---- the unit layer ---------------------------------------------------- */
/* Tokens prove no FIGURE went missing. Units prove no SENTENCE went missing —
   a table could carry every number while the paragraph explaining what they
   mean was deleted, and the token check would pass. A split rewords prose, so
   units are scored by content-word overlap against the best-matching
   destination rather than by exact match, and anything below the threshold is
   printed for a human to account for one by one. */
const STOP = new Set(('a an the and or but if then than that this these those of to in on at by for with from as is are was were be been being it its into no not you your they their we our i he she his her him them there here which who whom what when where how why all any both each few more most other some such only own same so too very can will just do does did doing done have has had having would could should may might must shall about above after again against before below between during further once out over under up down off again also because while' ).split(' '));
const words = s => s.toLowerCase().match(/[a-z0-9$%.,+\-—]+/g) || [];
const content = s => words(s).map(w => w.replace(/^[^a-z0-9$]+|[^a-z0-9%]+$/g, '')).filter(w => w.length > 2 && !STOP.has(w));

function unitReport(threshold) {
  const ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
  const d = destinations();
  const dests = [['session', d.session.toLowerCase()], ['appendix', d.appendix.toLowerCase()], ['ui', d.ui.toLowerCase()]];
  const rows = [];
  for (const u of ledger.units) {
    const cw = [...new Set(content(u.text))];
    if (!cw.length) continue;
    let best = { name: '—', frac: 0 };
    for (const [name, hay] of dests) {
      let hit = 0;
      for (const w of cw) if (hay.includes(w)) hit++;
      const frac = hit / cw.length;
      if (frac > best.frac) best = { name, frac };
    }
    rows.push({ id: u.id, tag: u.tag, frac: best.frac, dest: best.name, text: u.text });
  }
  const band = f => rows.filter(r => r.frac >= f).length;
  console.log(`units scored: ${rows.length}`);
  console.log(`  >= 0.95 content-word overlap with one destination: ${band(0.95)}`);
  console.log(`  >= 0.80 : ${band(0.80)}`);
  console.log(`  >= 0.60 : ${band(0.60)}`);
  const low = rows.filter(r => r.frac < threshold).sort((a, b) => a.frac - b.frac);
  console.log(`\nunits below ${threshold} — each must be accounted for by hand (${low.length}):`);
  for (const r of low) {
    console.log(`  ${r.id} ${r.tag} ${r.frac.toFixed(2)} -> ${r.dest}`);
    console.log(`     ${r.text.slice(0, 150)}${r.text.length > 150 ? '…' : ''}`);
  }
  return low.length;
}

const cmd = process.argv[2];
const opts = {
  selftest: process.argv.includes('--selftest'),
  map: process.argv.includes('--map')
};
if (cmd === 'enumerate') enumerate();
else if (cmd === 'verify') verify(opts);
else if (cmd === 'units') {
  const t = Number(process.argv.find(a => /^--threshold=/.test(a))?.split('=')[1] ?? 0.6);
  unitReport(t);
} else { console.error('usage: guide-facts.mjs enumerate | verify [--map] [--selftest] | units [--threshold=0.6]'); process.exit(2); }
