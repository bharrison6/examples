// Build: inline the authored response bundle into a single self-contained index.html.
// Refuses to emit a file containing any external reference, or any browser-storage
// call, so the offline promise cannot rot. (Same policy as Glass Box.)
//
// The responses themselves are hand-authored at build time and live in src/content/.
// tools/validate.py merges those eight files into src/content.json and enforces the
// content gates (term tagging, no-templating, card shapes); run it before this if you
// have edited any response. This script is the assembly step only.
//
// Three things get injected into src/app.template.html:
//   src/content.json + src/learn.json  -> the __DATA__ placeholder (the 64 responses)
//   presenter-sheet.html               -> the in-app presenter notes: its scoped
//                                         stylesheet and its guide-scope body, verbatim
//
// presenter-sheet.html is canonical and stays canonical: it is the printable sheet, the
// source of The-Stranger-Presenter-Sheet.pdf (tools/pdf.mjs), and the source of the notes
// overlay. There is no second copy of the script to drift, and --check fails if index.html
// has fallen behind it.
//
// It also carries the target-deck parity gate that tools/companion.py used to own: the
// eight cut-out cards on page two are checked, field by field, against src/scenarios.json.
'use strict';
const fs = require('fs');
const path = require('path');

const S = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const J = (f) => JSON.parse(S(f));
const R = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

const content = J('content.json');
const learn = J('learn.json');

const data = Object.assign({}, content, {
  guide: learn.guide,
  quizzes: learn.quizzes,
  draftTitle: learn.draftTitle,
  draft: learn.draft,
  closing: learn.closing,
});

// Single-lever isolation notes travel with the build as a comment block, so the
// claim "flipping one lever changes exactly one dimension" is auditable from the
// shipped file alone.
const notes = [];
let responseCount = 0, wordCount = 0;
for (const sc of content.scenarios) {
  notes.push(`  ${sc.id}: ${sc.title}`);
  const c0 = sc.cards[0];
  for (const k of [`000|${c0}`, `100|${c0}`, '010', `001|${c0}`, '011', '111']) {
    const r = sc.responses[k];
    if (r) notes.push(`    ${k.padEnd(18)} ${r.note}`);
  }
  for (const k of Object.keys(sc.responses)) {
    responseCount++;
    wordCount += sc.responses[k].words || 0;
  }
}

const blob = JSON.stringify(data).replace(/<\//g, '<\\/');
if (/<\/script/i.test(blob)) { console.error('BUILD REFUSED — data blob can close the script tag'); process.exit(1); }

// ---------------------------------------------------------------- markers --
// Any marker you document in a comment is matched inside that comment first, so
// every search over the guide runs against a copy with all <!-- --> regions blanked
// to same-length spaces. Offsets stay valid; the prose cannot answer the question.
const maskComments = (s) => s.replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length));
const occurrences = (hay, needle) => hay.split(needle).length - 1;
const refuse = (msg) => { console.error('BUILD REFUSED — ' + msg); process.exit(1); };

const guideSrc = R('presenter-sheet.html');
const guideMasked = maskComments(guideSrc);

const CSS_OPEN = '<style id="guide-css">';
const BODY_OPEN = '<div class="guide-scope">';
const BODY_CLOSE = '</div><!-- /guide -->';

// The stylesheet is located by an explicit id, never by indexOf('<style>'): the sheet
// carries a second, print-only stylesheet and a head comment that talks about both.
if (occurrences(guideMasked, CSS_OPEN) !== 1) refuse(`presenter-sheet.html must contain exactly one ${CSS_OPEN}`);
if (occurrences(guideMasked, BODY_OPEN) !== 1) refuse(`presenter-sheet.html must contain exactly one ${BODY_OPEN}`);
// The close marker is itself a comment, so it is counted in the raw text.
if (occurrences(guideSrc, BODY_CLOSE) !== 1) refuse(`presenter-sheet.html must contain exactly one ${BODY_CLOSE}`);

const cssStart = guideMasked.indexOf(CSS_OPEN) + CSS_OPEN.length;
const cssEnd = guideMasked.indexOf('</style>', cssStart);
const bodyStart = guideMasked.indexOf(BODY_OPEN);
const bodyEnd = guideSrc.indexOf(BODY_CLOSE);
if (cssEnd < 0) refuse('the guide stylesheet is never closed');
const guideCss = guideSrc.slice(cssStart, cssEnd);
const guideHtml = guideSrc.slice(bodyStart, bodyEnd) + '</div>';

// That stylesheet is injected into the running app, where a page-level rule would
// repaint the demo. Refuse the build rather than ship it.
if (/^\s*(?:body|html|\*|:root)\s*[,{]/m.test(guideCss)) refuse('the guide stylesheet leaks a page-level rule into the app; scope every rule to .guide-scope');
if (/<\/style/i.test(guideCss)) refuse('the guide stylesheet must not contain a style close tag');
if (/<\/script/i.test(guideHtml)) refuse('the guide body must not contain a script close tag');
if (!/\.guide-scope/.test(guideCss)) refuse('the guide stylesheet is empty of .guide-scope rules');

// ------------------------------------------------- target-deck parity gate --
// tools/companion.py used to GENERATE page two of the sheet from src/scenarios.json,
// which made it a second source for a file people also hand-edit. The derivation is
// kept, the generation is not: the eight printed cards are verified against the deck
// the app actually deals, field by field, and the build fails if they diverge.
const spec = J('scenarios.json');
const where = {};
for (const sc of spec.scenarios) for (const c of sc.cards) (where[c] = where[c] || []).push(sc.tab.replace('The ', ''));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const expected = Object.entries(spec.cards).map(([id, c]) => ({
  id, icon: c.icon, label: esc(c.label), sub: esc(c.sub), where: (where[id] || []).join(' · ')
}));

const cardRe = /<div class="card">\s*<div class="ci">([\s\S]*?)<\/div>\s*<div class="cl">([\s\S]*?)<\/div>\s*<div class="cs">([\s\S]*?)<\/div>\s*<div class="cw">turns up in: ([\s\S]*?)<\/div>\s*<\/div>/g;
const printed = [...guideHtml.matchAll(cardRe)].map((m) => ({ icon: m[1].trim(), label: m[2].trim(), sub: m[3].trim(), where: m[4].trim() }));
if (printed.length !== expected.length) {
  refuse(`presenter-sheet.html prints ${printed.length} target cards; src/scenarios.json defines ${expected.length}`);
}
expected.forEach((e, i) => {
  const p = printed[i];
  for (const field of ['icon', 'label', 'sub', 'where']) {
    if (p[field] !== e[field]) {
      refuse(`target card ${i + 1} (${e.id}) ${field} on the presenter sheet is ${JSON.stringify(p[field])}, ` +
             `but src/scenarios.json says ${JSON.stringify(e[field])}`);
    }
  }
});

// -------------------------------------------------------------- assembly ----
const tpl = S('app.template.html');
const DATA_MARKER = '__DATA__';
const GUIDE_CSS_MARKER = '/*__GUIDE_CSS__*/';
const GUIDE_MARKER = '<!--__GUIDE__-->';
for (const marker of [DATA_MARKER, GUIDE_CSS_MARKER, GUIDE_MARKER]) {
  // String.replace substitutes only the FIRST occurrence, so a marker that also
  // appeared in a comment would silently swallow the payload.
  const n = occurrences(tpl, marker);
  if (n !== 1) refuse(`app.template.html must contain exactly one ${marker} placeholder; found ${n}`);
}

// Replacements are functions, not strings: `$&`, `` $` ``, `$'` and `$$` inside the
// data blob or the guide would otherwise be eaten by String.replace's substitution.
let html = tpl
  .replace(DATA_MARKER, () => blob)
  .replace(GUIDE_CSS_MARKER, () => '/* GUIDE_CSS: BEGIN */' + guideCss + '/* GUIDE_CSS: END */')
  .replace(GUIDE_MARKER, () => '<!-- GUIDE: BEGIN -->' + guideHtml + '<!-- GUIDE: END -->');

// ---- offline guard: no network, no storage ----
const offenders = (html.match(
  /(https?:\/\/|\/\/cdn|fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|import\s*\(|<link[^>]+href|<script[^>]+src|@import|localStorage|sessionStorage|indexedDB)/gi
) || []);
if (offenders.length) {
  console.error('BUILD REFUSED — network or storage references found:', [...new Set(offenders)]);
  process.exit(1);
}

const banner = `<!--
  PROMPTING STRATEGIES (THE STRANGER) — a fully deterministic classroom demo about why
  prompts work. Every response in this file was written by hand at build time. There is no
  model, no API key, and no request of any kind at runtime. Open it from a thumb
  drive on a machine with the wifi off; it behaves identically.
  ${content.scenarios.length} scenarios x 8 lever states, with three alternate
  target-deck responses for each of the four states where the success spec is off:
  ${responseCount} authored responses, ${wordCount.toLocaleString('en-US')} words.

  The presenter notes in Settings are presenter-sheet.html, injected here at build time:
  one document, one source, and \`node build.js --check\` fails if they drift.

  SINGLE-LEVER ISOLATION — what each lever, and only that lever, changed:
${notes.join('\n')}
-->
`;
html = html.replace('<!doctype html>\n', () => '<!doctype html>\n' + banner);

const indexOut = path.join(__dirname, 'index.html');
const checkOnly = process.argv.includes('--check');
const inSync = fs.existsSync(indexOut) && fs.readFileSync(indexOut, 'utf8') === html;
if (checkOnly) {
  if (inSync) {
    console.log('build parity OK — no files written');
    console.log('notes parity OK — the in-app presenter notes are presenter-sheet.html, verbatim');
    console.log(`deck parity OK — ${expected.length} printed target cards match src/scenarios.json`);
  } else { console.error('build parity MISMATCH — no files written'); process.exitCode = 1; }
} else {
  fs.writeFileSync(indexOut, html);
  console.log(`built index.html (${Math.round(html.length / 1024)} KB, ${responseCount} authored responses)`);
  console.log(`  presenter notes injected from presenter-sheet.html (${guideHtml.length} chars, ${expected.length} target cards verified against src/scenarios.json)`);
}
