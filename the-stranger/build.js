// Build: inline the authored response bundle into a single self-contained index.html.
// Refuses to emit a file containing any external reference, or any browser-storage
// call, so the offline promise cannot rot. (Same policy as Glass Box.)
//
// The responses themselves are hand-authored at build time and live in src/content/.
// tools/validate.py merges those eight files into src/content.json and enforces the
// content gates (term tagging, no-templating, card shapes); run it before this if you
// have edited any response. This script is the assembly step only.
'use strict';
const fs = require('fs');
const path = require('path');

const S = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const J = (f) => JSON.parse(S(f));

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

const tpl = S('app.template.html');
if ((tpl.match(/__DATA__/g) || []).length !== 1) {
  console.error('BUILD REFUSED — template must contain exactly one __DATA__ placeholder');
  process.exit(1);
}
let html = tpl.replace('__DATA__', () => blob);

// ---- offline guard: no network, no storage ----
const offenders = (html.match(
  /(https?:\/\/|\/\/cdn|fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|import\s*\(|<link[^>]+href|<script[^>]+src|@import|localStorage|sessionStorage|indexedDB)/gi
) || []);
if (offenders.length) {
  console.error('BUILD REFUSED — network or storage references found:', [...new Set(offenders)]);
  process.exit(1);
}

const banner = `<!--
  THE STRANGER — a fully deterministic classroom demo about why prompts work.
  Every response in this file was written by hand at build time. There is no
  model, no API key, and no request of any kind at runtime. Open it from a thumb
  drive on a machine with the wifi off; it behaves identically.
  ${content.scenarios.length} scenarios x 8 lever states, with three alternate
  target-deck responses for each of the four states where the success spec is off:
  ${responseCount} authored responses, ${wordCount.toLocaleString('en-US')} words.

  SINGLE-LEVER ISOLATION — what each lever, and only that lever, changed:
${notes.join('\n')}
-->
`;
html = html.replace('<!doctype html>\n', '<!doctype html>\n' + banner);

const indexOut = path.join(__dirname, 'index.html');
const checkOnly = process.argv.includes('--check');
const inSync = fs.existsSync(indexOut) && fs.readFileSync(indexOut, 'utf8') === html;
if (checkOnly) {
  if (inSync) console.log('build parity OK — no files written');
  else { console.error('build parity MISMATCH — no files written'); process.exitCode = 1; }
} else {
  fs.writeFileSync(indexOut, html);
  console.log(`built index.html (${Math.round(html.length / 1024)} KB, ${responseCount} authored responses)`);
}
