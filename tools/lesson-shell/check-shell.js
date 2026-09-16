#!/usr/bin/env node
/* ===========================================================================
   lesson-shell / check-shell.js — does this built index.html actually carry
   the kit, and the parts the template names?

     node tools/lesson-shell/check-shell.js <slug> [<slug> ...]
     node tools/lesson-shell/check-shell.js --all      every demo with a stamp

   Exit 0 = pass, 1 = fail. Every failure names the template part at fault.

   WHAT IT PROVES, AND WHY EACH ONE IS HERE

   1. The STAMP is present, and its version AND css hash match the kit on disk.
      This is the back-propagation guarantee. Change the kit, and every demo
      built against the old one goes red until it is rebuilt — you cannot leave
      fifteen demos on a stale shell silently.

   2. Every A0 required token NAME appears. A demo that renamed --lite to --sky
      still renders, and would still pass a screenshot review, and would then
      quietly fork the palette. This is the A0 pass criterion, mechanized.

   3. The class vocabulary for A1, A2, A4, A5 and A6 appears. Presence is not
      quality — a reviewer still reads the copy — but absence is decisive, and
      it is the cheapest thing to get wrong when adopting the kit from the
      artifacts alone.

   4. No ALL-CAPS placeholder from partials.html survived into the built file.
      Adopting by copy-paste is the intended route, so shipping "STAGE TITLE"
      to the public site is the likeliest single failure of this whole pass.

   5. Only the six provenance words are used as kickers, and "unconfirmed" is
      never one of them — it is a qualifier in .k-qual that attaches to one of
      the six. (Orchestrator ruling 2026-09-15, on front-doors audit evidence:
      folding an honest "could not confirm" onto Illustrative renders it as
      INVENTED, a worse claim than the truth.)

   5b. Two STRUCTURAL label checks, which are the reliable half of "no
      unlabeled claim surface":
        * every .details-stage carries at least one kicker — the drawer's first
          fixed section IS the provenance statement, so a stage with none has
          skipped it;
        * every block marked .claim opens with a kicker.

      WHAT THIS CANNOT DO, stated rather than papered over: there is no
      reliable way to detect a claim in unmarked prose. "A longer tube always
      improves resolution" and "the tube is 1.50 m" are the same shape to a
      regex. So a builder who simply does not wrap a claim in .claim escapes
      check 5b entirely. That gap is real and it is why L1 review is a human
      lens reading src/, not a grep. A check that pretended to close it would
      pass vacuously and be worse than its absence, because it would retire
      the reviewer's attention. What 5b buys is that the marked surface cannot
      rot, and that a details-stage cannot ship with no provenance at all.

   6. Zero <script src> and zero <link href> to anything but a same-folder
      hyperlink: the built file is self-contained (CONTRACT.md).

   7. The credit pill's text is EXACTLY the fleet spec, with no suffix.

   PROVING THE CHECKS ARE POTENT. --self-test runs every check against
   synthetic bait that should trip it, and fails if any check stays silent. A
   checker whose silence has not been tested is not evidence. Run it whenever
   you change this file:

     node tools/lesson-shell/check-shell.js --self-test
   =========================================================================== */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const shell = require('./index.js');

const REPO = path.resolve(__dirname, '..', '..');
const PILL_TEXT = 'Bryant Harrison &middot; Murray State University';

/* The ALL-CAPS slots partials.html asks the builder to fill in. A built file
   containing any of these shipped a template hole to a public URL. */
const PLACEHOLDERS = Object.freeze([
  'DEMO DISPLAY TITLE', 'STAGE TITLE', 'SHORT NAME', 'ONE LINE QUESTION?',
  'THE ONE QUESTION THIS STAGE ANSWERS?', 'TWO OR THREE SENTENCES',
  'A CONCRETE PREDICTION PROMPT', 'EXACT CONTROL NAME',
  'A PLAIN DECLARATIVE CLAIM', 'PANEL TITLE', 'CONTROL NAME',
  'WHAT IS LIVE HERE', 'ONE RETRIEVAL QUESTION', 'CORRECT OPTION',
  'THE FLAWED MODEL, STATED', 'WHAT THIS DEMO DOES NOT CLAIM',
  'THE FORMULA, IF THERE IS ONE', 'EACH ONE, PLAINLY', 'LESSON STAGES',
  'PART FOUR &middot; EXAMPLE PROJECTS'
]);

/* Every check is a function returning an array of failure strings. Keeping
   them in one table is what lets --self-test iterate them. */
const CHECKS = Object.freeze([
  ['A0 kit stamp', html => {
    const got = shell.readStamp(html);
    if (!got) return ['no lesson-shell stamp — build.js must inject shell.stamp() at <!--__SHELL_STAMP__-->'];
    const out = [];
    if (got.version !== shell.VERSION) {
      out.push(`built against lesson-shell v${got.version}, the kit on disk is v${shell.VERSION} — rebuild`);
    }
    if (got.cssHash !== shell.cssHash()) {
      out.push(`shell CSS has changed since this was built (stamp ${got.cssHash}, kit ${shell.cssHash()}) — rebuild`);
    }
    return out;
  }],
  ['A0 palette tokens', html => shell.REQUIRED_TOKENS
    .filter(t => !new RegExp('\\' + t + '\\s*:').test(html))
    .map(t => `required token ${t} is not defined`)],
  ['A1/A2/A4/A5/A6 parts', html => shell.REQUIRED_CLASSES
    .filter(c => !html.includes(c.needle))
    .map(c => `${c.part} missing (no "${c.needle}" in the built file)`)],
  ['template placeholders', html => PLACEHOLDERS
    .filter(p => html.includes(p))
    .map(p => `an unfilled partials.html placeholder shipped: "${p}"`)],
  ['A3 kicker vocabulary', html => {
    const used = (html.match(/class="k-[a-z-]+"/g) || []).map(s => s.slice(7, -1));
    const bad = [...new Set(used)]
      .filter(k => k !== shell.QUALIFIER_CLASS)
      .filter(k => !shell.KICKERS.includes(k));
    const out = bad.map(k => `${k} is not one of the six provenance words (${shell.KICKERS.join(', ')})`);
    /* "unconfirmed" as a LABEL is the specific mistake the ruling names. */
    if (/class="k-(?:unconfirmed|verified)"/.test(html)) {
      out.push('"unconfirmed"/"verified" are confidence qualifiers, not provenance labels — put them in a k-qual span beside one of the six');
    }
    return out;
  }],
  ['A5 detail labels', html => {
    const out = [];
    /* Every .details-stage must carry at least one kicker: the drawer's first
       fixed section IS the provenance statement. */
    const stages = html.match(/<section[^>]*class="[^"]*details-stage[^"]*"[\s\S]*?(?=<section[^>]*class="[^"]*details-stage|<\/div>\s*<form method="dialog" class="lesson-dialog-actions")/g) || [];
    stages.forEach((s, i) => {
      if (!shell.KICKERS.some(k => s.includes(`"${k}"`))) {
        out.push(`details-stage ${i} carries no provenance kicker — the drawer's first fixed section is the live/measured/sourced statement`);
      }
    });
    /* Every .claim block must open with one. Flat blocks only, so the scan is
       honest about what it read. */
    const claims = html.match(/<div class="claim">[\s\S]*?<\/div>/g) || [];
    claims.forEach((c, i) => {
      if (/<div\b/.test(c.slice(18))) {
        out.push(`claim block ${i} contains a nested <div>; keep .claim blocks flat so the label check can read them`);
      } else if (!shell.KICKERS.some(k => c.includes(`"${k}"`))) {
        out.push(`claim block ${i} has no provenance kicker: ${c.replace(/<[^>]*>/g, ' ').trim().slice(0, 60)}...`);
      }
    });
    return out;
  }],
  ['self-contained', html => {
    const out = [];
    const tags = html.match(/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["'][^"']+["'][^>]*>/gi) || [];
    tags.forEach(t => out.push(`a resource is loaded at runtime: ${t.slice(0, 90)}`));
    return out;
  }],
  ['A0 credit pill', html => {
    const m = html.match(/<div class="bh-credit"[^>]*>([\s\S]*?)<\/div>/);
    if (!m) return ['no .bh-credit element'];
    const text = m[1].trim();
    return text === PILL_TEXT ? [] : [`credit pill text is "${text}", the fleet spec is "${PILL_TEXT}"`];
  }]
]);

function checkHtml(html) {
  const failures = [];
  for (const [name, fn] of CHECKS) {
    for (const msg of fn(html)) failures.push(`${name}: ${msg}`);
  }
  return failures;
}

/* --- the self-test: every check must trip on bait -------------------------
   Built from a file that PASSES, then broken one way per check. A check that
   stays silent on its own bait cannot be trusted when it is silent on a real
   demo. */
function selfTest() {
  const good = [
    '<!doctype html><html><head><style>:root{',
    shell.REQUIRED_TOKENS.map(t => `${t}: 0;`).join(''),
    '}</style></head><body>', shell.stamp(),
    shell.REQUIRED_CLASSES.map(c => `<i ${c.needle.includes('=') ? c.needle : 'class="' + c.needle + '"'}></i>`).join(''),
    '<span class="k-live">Live</span><span class="k-qual">seed 41</span>',
    '<section class="details-stage on" data-details-stage="0">',
    '<span class="panel-kicker"><span class="k-measured">Measured</span> x</span>',
    '<div class="claim"><span class="panel-kicker"><span class="k-reasoned">Reasoned</span> y</span><p>z</p></div>',
    '</section></div>\n<form method="dialog" class="lesson-dialog-actions"><button>Back to activity</button></form>',
    `<div class="bh-credit">${PILL_TEXT}</div>`,
    '</body></html>'
  ].join('');
  const baseline = checkHtml(good);
  if (baseline.length) {
    console.error('SELF-TEST FAILED — the synthetic passing page does not pass:');
    baseline.forEach(f => console.error('  ' + f));
    return 1;
  }
  /* Each bait names the check AND a substring the failure must contain, so a
     check cannot appear to trip because a DIFFERENT failure in the same check
     fired. That distinction matters for 5b, whose two halves are separate
     properties reported under one check name. */
  const bait = [
    ['A0 kit stamp', 'is v', good.replace(shell.stamp(), '<!-- lesson-shell v0 css:000000000000 -->')],
    ['A0 palette tokens', '--lite', good.replace('--lite: 0;', '--sky: 0;')],
    ['A1/A2/A4/A5/A6 parts', 'observation cue', good.replace('class="obs-cue"', 'class="status"')],
    ['template placeholders', 'STAGE TITLE', good.replace('</body>', '<h2>STAGE TITLE</h2></body>')],
    ['A3 kicker vocabulary', 'six provenance words', good.replace('class="k-live"', 'class="k-realtime"')],
    /* "unconfirmed" promoted to a label is the specific mistake the ruling
       names, so it gets its own bait rather than riding on the generic one. */
    ['A3 kicker vocabulary', 'confidence qualifiers, not provenance labels', good.replace('class="k-live"', 'class="k-unconfirmed"')],
    /* 5b half one: a details-stage with NO kicker anywhere in it. */
    ['A5 detail labels', 'carries no provenance kicker',
      good.replace('<span class="k-measured">Measured</span>', 'Measured')
          .replace('<span class="k-reasoned">Reasoned</span>', 'Reasoned')],
    /* 5b half two: a .claim block whose label was taken off, with the stage's
       own kicker left in place so only the claim check can fire. */
    ['A5 detail labels', 'claim block 0 has no provenance kicker',
      good.replace('<span class="k-reasoned">Reasoned</span>', 'Reasoned')],
    /* 5b guard: a nested div makes the claim scan unable to read the block, so
       it must say so rather than pass. */
    ['A5 detail labels', 'nested <div>',
      good.replace('<div class="claim">', '<div class="claim"><div>')],
    ['self-contained', 'theme.css', good.replace('</head>', '<link href="theme.css" rel="stylesheet"></head>')],
    ['A0 credit pill', 'three amigos', good.replace(PILL_TEXT, PILL_TEXT + ' &middot; built with the three amigos')]
  ];
  let bad = 0;
  for (const [name, needle, html] of bait) {
    const hit = checkHtml(html).some(f => f.startsWith(name + ':') && f.includes(needle));
    console.log(`  ${hit ? 'trips ' : 'SILENT'}  ${name} — "${needle}"`);
    if (!hit) bad += 1;
  }
  if (bad) {
    console.error(`SELF-TEST FAILED — ${bad} check(s) stayed silent on their own bait.`);
    return 1;
  }
  console.log(`check-shell self-test: the synthetic page passes, and all ${bait.length} checks trip on their bait.`);
  return 0;
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest();
  let slugs = argv.filter(a => !a.startsWith('--'));
  if (argv.includes('--all') || !slugs.length) {
    slugs = fs.readdirSync(REPO, { withFileTypes: true })
      .filter(e => e.isDirectory() && fs.existsSync(path.join(REPO, e.name, 'index.html')))
      .map(e => e.name)
      .filter(slug => shell.readStamp(fs.readFileSync(path.join(REPO, slug, 'index.html'), 'utf8')));
    if (!slugs.length) {
      console.error('no demo carries a lesson-shell stamp yet; name a slug explicitly to check one anyway');
      return 1;
    }
  }
  let failed = 0;
  for (const slug of slugs) {
    const file = path.join(REPO, slug, 'index.html');
    if (!fs.existsSync(file)) { console.error(`${slug}: no index.html at ${file}`); failed += 1; continue; }
    const failures = checkHtml(fs.readFileSync(file, 'utf8'));
    if (failures.length) {
      failed += 1;
      console.error(`${slug}: FAIL (${failures.length})`);
      failures.forEach(f => console.error('  ' + f));
    } else {
      console.log(`${slug}: lesson-shell v${shell.VERSION} carried, all template parts present, self-contained`);
    }
  }
  return failed ? 1 : 0;
}

module.exports = { checkHtml, PLACEHOLDERS, PILL_TEXT };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
