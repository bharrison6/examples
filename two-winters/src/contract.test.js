#!/usr/bin/env node
/* ==========================================================================
   AI Winters: Boom and Bust — the built page against CONTRACT.md's Required UX.

   Run: node src/contract.test.js   (after `node build.js`)

   playtest.test.js checks the data and the engine. This file checks the one
   thing that file cannot see: the shipped index.html.

   The trap this file is written around. Once the presenter guide is injected
   into the page, the guide's own prose names "Open Presenter Notes",
   "Presentation mode" and "Reset" — so a document-wide search for those labels
   matches the answer key rather than the menu. Every label assertion below is
   therefore made against the Settings overlay ALONE, sliced out by balanced
   <div> depth, and that slice is first asserted to contain no .guide-scope
   markup. A positive control (the labels are found where they should be) and a
   negative control (they are also present elsewhere, so the scoping is doing
   real work) are both reported.
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const INDEX = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(INDEX, 'utf8');

let pass = 0, fail = 0;
const results = [];
function ok(name, cond, detail) {
  if (cond) { pass++; results.push(['PASS', name, detail]); }
  else { fail++; results.push(['FAIL', name, detail]); }
}
function note(text) { results.push(['NOTE', text, '']); }

const TITLE = 'AI Winters: Boom and Bust';

/* ------------------------------------------------------------- slicing --- */

/** The whole element starting at `openIdx`, found by balanced <div> depth.
 *  The markup here is hand-written and has no <div in an attribute value, so
 *  counting tags is enough; a mismatch shows up as a depth that never closes. */
function divBlockAt(src, openIdx) {
  const re = /<div\b|<\/div>/gi;
  re.lastIndex = openIdx;
  let depth = 0;
  for (let m; (m = re.exec(src)) !== null; ) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) return src.slice(openIdx, re.lastIndex);
  }
  return null;
}

function overlayBlock(id) {
  const open = html.indexOf(`<div class="overlay" id="${id}"`);
  if (open < 0) return null;
  return divBlockAt(html, open);
}

/** The text of the first <button> in `block` whose content trims to `label`. */
function hasButtonLabelled(block, label) {
  const re = /<button\b[^>]*>([\s\S]*?)<\/button>/gi;
  for (let m; (m = re.exec(block)) !== null; ) {
    if (decode(m[1]).replace(/<[^>]*>/g, '').trim() === label) return true;
  }
  return false;
}

const ENT = { '&mdash;': '—', '&ndash;': '–', '&rsquo;': '’', '&lsquo;': '‘',
  '&ldquo;': '“', '&rdquo;': '”', '&middot;': '·', '&amp;': '&',
  '&nbsp;': ' ', '&times;': '×', '&#9881;': '⚙', '&rarr;': '→' };
const decode = s => s.replace(/&[a-z#0-9]+;/gi, e => ENT[e] != null ? ENT[e] : e);

/* ==================== 1. the retitle, everywhere in-app ================== */

{
  const t = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
  ok('<title> carries the display title', decode(t).indexOf(TITLE) === 0, t.trim());

  const brand = (html.match(/<span class="b1">([\s\S]*?)<\/span>/i) || [])[1] || '';
  ok('The header brand carries the display title',
     brand.toUpperCase().indexOf(TITLE.toUpperCase()) === 0, brand.trim().slice(0, 60));

  ok('The injected guide heading carries the display title',
     new RegExp('<h1>' + TITLE.replace(':', ':') + ' &mdash; presenter guide</h1>').test(html));

  ok('No stale "TWO WINTERS" wordmark is left in the chrome',
     !/<span class="b1">TWO WINTERS/.test(html));
}

/* ========================= 2. the Guide button =========================== */

{
  const btn = (html.match(/<button[^>]*id="btn-howto"[^>]*>/i) || [])[0] || '';
  ok('The ? button exists in the header', btn.length > 0);
  ok('Its accessible name is exactly Guide', /aria-label="Guide"/.test(btn), btn);
  ok('Its tooltip is exactly Guide', /title="Guide"/.test(btn), btn);
  ok('It is still the ? glyph', /<button[^>]*id="btn-howto"[^>]*>\s*\?\s*<\/button>/i.test(html));

  const g = overlayBlock('howto');
  ok('The Guide overlay exists', !!g);
  const h2 = g && (g.match(/<h2 id="howto-title">([\s\S]*?)<\/h2>/i) || [])[1];
  ok('The Guide overlay heading reads exactly "Guide"', (h2 || '').trim() === 'Guide', String(h2));
  ok('The Guide overlay ships hidden and is opened by script on load',
     /<div class="overlay" id="howto" hidden>/.test(html) && /open\('howto'\)/.test(html));
  ok('The Guide overlay is dismissible and reopenable',
     !!g && /data-close="howto"/.test(g) && /#btn-howto'\)\.addEventListener/.test(html));
}

/* ===================== 3. the Settings menu, scoped ====================== */

const settings = overlayBlock('settings');
ok('The Settings overlay exists', !!settings);

if (settings) {
  /* The guard that makes every assertion below mean something. */
  ok('The Settings block contains no injected guide markup (no answer key inside it)',
     !/guide-scope/.test(settings));
  ok('The Settings block is a plausible size, not the whole document',
     settings.length > 400 && settings.length < html.length / 4,
     settings.length + ' chars of ' + html.length);

  ok('Settings offers a button labelled exactly "Open Presenter Notes"',
     hasButtonLabelled(settings, 'Open Presenter Notes'));
  ok('Settings offers a toggle labelled exactly "Presentation mode"',
     /<span>Presentation mode<\/span>/.test(settings));
  ok('Settings offers a button labelled exactly "Reset"',
     hasButtonLabelled(settings, 'Reset'));

  ok('No stale "Presenter mode" or "Presenter’s notes" label survives in the menu',
     !/Presenter mode/.test(settings) && !/Presenter&rsquo;s notes/.test(settings));
  ok('The retired "How this works" button is gone from the menu and from the script',
     !/btn-howto-2/.test(html));

  /* Negative control for the scoping: the same labels DO appear elsewhere in
     the document (the injected guide names them), so a document-wide search
     would have passed even with an empty menu. */
  const outside = html.split(settings).join('');
  note('scoping control — "Open Presenter Notes" outside the Settings block: '
     + (outside.split('Open Presenter Notes').length - 1) + ' occurrence(s); '
     + '"Presentation mode": ' + (outside.split('Presentation mode').length - 1) + '; '
     + '"Reset": ' + (outside.split('Reset').length - 1)
     + '  (a document-wide assertion would match these instead of the menu)');
}

/* ================= 4. Reset means whole-demo fresh load ================== */

{
  ok('A #btn-reset control exists and is wired', /id="btn-reset"/.test(html)
     && /\$\('#btn-reset'\)\.addEventListener\('click', resetDemo\)/.test(html));

  const fnAt = html.indexOf('function resetDemo()');
  ok('resetDemo() is defined', fnAt > 0);
  const body = fnAt > 0 ? html.slice(fnAt, html.indexOf('\n}', fnAt)) : '';

  ok('Reset clears every answer', /S\.answers = \{\};/.test(body));
  ok('Reset returns to the first card and the opening screen',
     /S\.i = 0;/.test(body) && /\$\('#intro'\)\.hidden = false;/.test(body)
     && /\$\('#card-body'\)\.hidden = true;/.test(body) && /\$\('#scorecard'\)\.hidden = true;/.test(body));
  ok('Reset drops a half-answered card', /S\.pending = \{ year: 1985, verdict: null \};/.test(body)
     && /S\.revealed = false;/.test(body));
  ok('Reset rewinds the Act II timeline to the full span',
     /S\.tl\.setCursor\(1\);/.test(body) && /#tl-slider'\)\.value = '1000'/.test(body)
     && /S\.tl\.select\(null\);/.test(body));
  ok('Reset clears the self-test output', /#selftest-out'\)\.innerHTML = '';/.test(body));
  ok('Reset returns to Act I', /setAct\(1\);/.test(body));
  ok('Reset closes every overlay, so the Guide does NOT reopen',
     /\$\$\('\.overlay'\)\.forEach\(o => \{ o\.hidden = true; \}\);/.test(body)
     && !/open\('howto'\)/.test(body));
  ok('Reset leaves Presentation mode alone (contract: a projector preference, not demo state)',
     !/presenter/i.test(body) && !/chk-presenter/.test(body));
}

/* ============= 5. the notes are the guide, injected cleanly ============== */

{
  const marker = '/* ==== presenter guide (scoped to .guide-scope) ==== */';
  const at = html.indexOf(marker);
  ok('The injected guide stylesheet is present', at > 0);
  const gcss = at > 0 ? html.slice(at + marker.length, html.indexOf('</style>', at)) : '';

  ok('The injected guide CSS begins with a .guide-scope rule (not comment prose)',
     /^\s*\.guide-scope\b/.test(gcss), JSON.stringify(gcss.trim().slice(0, 48)));
  ok('The injected guide CSS carries no comment syntax or nested <style> — the '
     + "indexOf('<style>') bug, pinned",
     !gcss.includes('<!--') && !gcss.includes('-->') && !gcss.includes('<style'));
  ok('Every injected guide rule is scoped to .guide-scope',
     gcss.split('}').map(s => s.split('{')[1] === undefined ? '' : s.split('{')[0])
         .filter(s => s.trim()).every(sel => sel.split(',').every(p => /\.guide-scope\b/.test(p))));

  ok('The guide body is injected exactly once',
     html.split('<div class="guide-scope">').length - 1 === 1);
  const notes = overlayBlock('notes');
  ok('The guide body is injected inside the notes overlay',
     !!notes && notes.includes('<div class="guide-scope">'));
  ok('The notes overlay opens from the Settings button, closing Settings first',
     /#btn-notes'\)\.addEventListener\('click', \(\) => \{ close\('settings'\); open\('notes'\); \}\)/.test(html));

  /* The guide is one document, not a summary of one: the shipped printable
     copy's body must be byte-identical to what the app shows. */
  const guideFile = fs.readFileSync(path.join(__dirname, '..', 'presenter-guide.html'), 'utf8');
  const cut = s => {
    const a = s.indexOf('<div class="guide-scope">');
    const b = s.indexOf('</div><!-- /guide -->');
    return a < 0 || b < 0 ? null : s.slice(a, b);
  };
  const inApp = (() => {
    const a = html.indexOf('<div class="guide-scope">');
    const b = html.indexOf('</div>\n    </div>', a);
    return a < 0 ? null : html.slice(a, b < 0 ? undefined : b);
  })();
  ok('The in-app notes body is byte-identical to the printable guide body',
     !!inApp && !!cut(guideFile) && inApp.trim() === cut(guideFile).trim(),
     inApp && cut(guideFile) ? `app ${inApp.trim().length} ch / guide ${cut(guideFile).trim().length} ch` : 'slice failed');
}

/* ======================== 6. offline at runtime ========================== */

{
  const banned = [['fetch(', /\bfetch\s*\(/], ['XMLHttpRequest', /XMLHttpRequest/],
    ['WebSocket', /WebSocket/], ['@import', /@import/], ['url(http', /url\(\s*['"]?https?:/i],
    ['navigator.sendBeacon', /sendBeacon/], ['EventSource', /EventSource/],
    ['import(', /\bimport\s*\(/]];
  for (const [name, re] of banned) ok(`No ${name} anywhere in the shipped page`, !re.test(html), name);

  /* Loading tags may not reach the network at all. Anchors may: the guide link
     and the outbound source links are the point of the demo. */
  const offenders = [];
  html.replace(/<(script|link|img|iframe|source|video|audio|embed|object)\b[^>]*>/gi, tag => {
    if (/\b(src|href|data)\s*=\s*["']?https?:/i.test(tag)) offenders.push(tag.slice(0, 80));
    return tag;
  });
  ok('No resource-loading tag points at http(s)', offenders.length === 0, offenders.join(' | '));

  /* Positive control: the detector must actually fire on a page that offends. */
  const control = '<img src="https://example.com/x.png"><script src="https://cdn.example.com/y.js"></script>';
  const found = [];
  control.replace(/<(script|link|img|iframe|source|video|audio|embed|object)\b[^>]*>/gi, tag => {
    if (/\b(src|href|data)\s*=\s*["']?https?:/i.test(tag)) found.push(tag);
    return tag;
  });
  ok('POSITIVE CONTROL: the same detector finds 2 offenders in a deliberately bad page',
     found.length === 2, found.length + ' found');

  const anchors = (html.match(/<a\b[^>]*href="https?:[^"]*"/gi) || []);
  note(`outbound <a href="http(s)…"> links: ${anchors.length} (sources and the guide link; these are `
     + 'user-initiated navigations, not runtime fetches)');
}

/* ================================ report ================================= */

for (const [tag, name, detail] of results) {
  console.log(tag.padEnd(4), name + (detail ? ' — ' + detail : ''));
}
console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total`);
process.exit(fail ? 1 : 0);
