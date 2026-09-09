#!/usr/bin/env node
/* Single-source the presenter notes.

   teacher-guide.html is canonical. This script lifts its <style id="guide-css">
   block and its `.guide-scope` div out verbatim and writes them into index.html
   between the __GUIDE_CSS__ and __GUIDE__ markers, so Settings -> Open Presenter
   Notes shows exactly the printable guide with nothing fetched at runtime.
   Editing the copy inside index.html is a fork; --check exists to catch it.

     node tools/guide-sync.js           rewrite the injected block in index.html
     node tools/guide-sync.js --check   fail if index.html has drifted, write nothing

   Mechanism borrowed from two-winters/build.js by way of bridge-works/tools/
   guide-sync.js, which do the same lift. Orbital Mechanics Golf ships its sources
   rather than building them, so the injection is a marked region in the shipped
   index.html instead of a template placeholder — same single source, same drift
   check, no build step to run first.

   The stylesheet is located by its `id="guide-css"` attribute rather than by
   indexOf('<style>'): the guide's own header comment mentions <style>, and a bare
   search finds that comment first and starts the extraction inside it.

   tools/pdf.mjs renders teacher-guide.pdf from the same teacher-guide.html. Run
   both after editing the guide:
     node tools/guide-sync.js && node tools/pdf.mjs                              */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GUIDE = path.join(ROOT, 'teacher-guide.html');
const INDEX = path.join(ROOT, 'index.html');
const CHECK = process.argv.includes('--check');

const CSS_START = '/* __GUIDE_CSS__ start';
const CSS_END = '/* __GUIDE_CSS__ end */';
const HTML_START = '<!-- __GUIDE__ start';
const HTML_END = '<!-- __GUIDE__ end -->';

function die(msg) { console.error(msg); process.exit(1); }

/* ------------------------------------------------------------- the source */
const guideSrc = fs.readFileSync(GUIDE, 'utf8');

/* The guide's own header comment names these markers, and a raw search finds the
   prose before the real tag — the same class of bug as locating the stylesheet
   with indexOf('<style>'). So search a copy with every comment blanked to spaces
   (length preserved, so offsets still index the original) and slice the original. */
const masked = guideSrc.replace(/<!--[\s\S]*?-->/g, m => ' '.repeat(m.length));
function only(hay, re, what) {
  const hits = [...hay.matchAll(re)];
  if (!hits.length) die('teacher-guide.html: no ' + what);
  if (hits.length > 1) die('teacher-guide.html: ' + hits.length + ' occurrences of ' + what +
                           '; exactly one is expected');
  return hits[0];
}

/* The tagged <style id="guide-css"> block is the one scoped to .guide-scope and
   safe to inject. The untagged block after it is page chrome for the printable
   file (@page, body type, the two-column print layout) and must not leak in. */
const mOpen = only(masked, /<style\s+id=["']guide-css["']\s*>/gi, '<style id="guide-css"> block to inject');
const sBody = mOpen.index + mOpen[0].length;
const sClose = masked.indexOf('</style>', sBody);
if (sClose < 0) die('teacher-guide.html: <style id="guide-css"> is never closed');

const gStart = only(masked, /<div class="guide-scope">/g, '<div class="guide-scope"> opener').index;
/* the closer carries a comment, so it is matched in the raw text; its uniqueness
   is checked the same way rather than assumed */
const gEnd = only(guideSrc, /<\/div><!-- \/guide -->/g, '</div><!-- /guide --> closer').index;
if (gEnd < gStart) die('teacher-guide.html: </div><!-- /guide --> precedes <div class="guide-scope">');

const guideCss = guideSrc.slice(sBody, sClose).replace(/^\n|\n$/g, '');
const guideHtml = guideSrc.slice(gStart, gEnd) + '</div>';

/* Every rule in the injected block must be scoped. A single unscoped selector
   would restyle the whole game the moment the notes stylesheet loads, and it
   would do it silently — so refuse rather than ship it. */
const bare = guideCss.replace(/\/\*[\s\S]*?\*\//g, '');
if (/@/.test(bare)) {
  die('the injected guide stylesheet may not contain an at-rule (@media, @page, ...);\n' +
      'put it in the second <style> block of teacher-guide.html instead');
}
const unscoped = [];
bare.split('}').forEach(chunk => {
  const head = chunk.split('{')[0].trim();
  if (!head) return;
  head.split(',').forEach(sel => {
    sel = sel.trim();
    if (sel && !sel.startsWith('.guide-scope')) unscoped.push(sel);
  });
});
if (unscoped.length) {
  die('the injected guide stylesheet leaks unscoped selectors into the app:\n  ' +
      unscoped.join('\n  ') + '\nevery selector in <style id="guide-css"> must start with .guide-scope');
}

/* Nothing in the injected markup may reach the network. */
const external = [];
guideHtml.replace(/<(script|link|img|iframe|source|video|audio|object|embed)\b[^>]*>/gi, tag => {
  external.push(tag.slice(0, 90)); return tag;
});
if (external.length) {
  die('the guide body may not embed a fetchable element:\n  ' + external.join('\n  '));
}

/* -------------------------------------------------------------- the target */
const index = fs.readFileSync(INDEX, 'utf8');

/* Replace everything between the line carrying startTag and the line carrying
   endTag. Both markers stay in the file, so the next run finds them again.
   A marker that appears twice would silently splice the wrong region — the
   first occurrence wins in indexOf — so refuse that outright. */
function splice(src, startTag, endTag, body) {
  const a = src.indexOf(startTag);
  if (a < 0) die('marker missing in index.html: ' + startTag + ' ...');
  if (src.indexOf(startTag, a + 1) >= 0) {
    die('marker appears more than once in index.html: ' + startTag + ' ...');
  }
  const aEnd = src.indexOf('\n', a);
  const b = src.indexOf(endTag, aEnd);
  if (b < 0) die('closing marker missing in index.html: ' + endTag);
  if (src.indexOf(endTag, b + 1) >= 0) {
    die('closing marker appears more than once in index.html: ' + endTag);
  }
  /* the replacement is passed as a string slice, not through String.replace, so
     a `$&` or `$'` inside the guide text cannot be eaten as a substitution */
  return src.slice(0, aEnd + 1) + body + '\n' + src.slice(b);
}

let out = splice(index, CSS_START, CSS_END, guideCss);
out = splice(out, HTML_START, HTML_END, guideHtml);

if (CHECK) {
  if (out !== index) {
    console.error('PARITY MISMATCH: the presenter notes in index.html differ from ' +
                  'teacher-guide.html. Run: node tools/guide-sync.js');
    process.exit(2);
  }
  console.log('PARITY OK: the presenter notes in index.html match teacher-guide.html; no files written.');
  process.exit(0);
}

if (out === index) {
  console.log('NO CHANGE: index.html already carries the current guide.');
} else {
  fs.writeFileSync(INDEX, out);
  console.log('WRITE OK: presenter notes injected into index.html (' +
              (guideHtml.length / 1024).toFixed(1) + ' KB of guide, ' +
              (guideCss.length / 1024).toFixed(1) + ' KB of scoped CSS).');
  console.log('Remember: node tools/pdf.mjs to re-render teacher-guide.pdf.');
}
