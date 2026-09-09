#!/usr/bin/env node
/* Single-source the presenter notes.

   teacher-guide.html is canonical. This script lifts its <style id="guide-css">
   block and its `.guide-scope` div out verbatim and writes them into index.html
   between the __GUIDE_CSS__ and __GUIDE__ markers, so Settings -> Open Presenter
   Notes shows exactly the printable guide with nothing fetched at runtime.
   Editing the copy inside index.html is a fork; --check exists to catch it.

     node tools/guide-sync.js           rewrite the injected block in index.html
     node tools/guide-sync.js --check   fail if index.html has drifted, write nothing

   Mechanism borrowed from bridge-works/tools/guide-sync.js, which borrowed it from
   two-winters/build.js. This demo ships its single index.html rather than building
   it, so the injection is a marked region in the shipped file instead of a template
   placeholder — same single source, same drift check, no build step to run first.

   Markers are matched ANCHORED TO THE START OF A LINE, never with a bare indexOf:
   the guide's own header comment names every one of them, and an unanchored search
   finds the mention first and extracts from inside the comment (the trap recorded in
   the ion-flight/takeoff lane lessons). Guide markers therefore live at column 0 in
   teacher-guide.html, and this script refuses a marker it finds more than once.

   tools/pdf.mjs renders teacher-guide.pdf from the same teacher-guide.html. After
   editing the guide, run both:  node tools/guide-sync.js && node tools/pdf.mjs */
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

/* The <style id="guide-css"> block is the one scoped to .guide-scope and safe to
   inject. The unnamed block after it is page chrome for the printable file and must
   not leak into the app. */
const at = re => [...guideSrc.matchAll(re)].map(m => m.index);
/* exactly one match, at column 0, or refuse */
function only(re, what) {
  const a = at(re);
  if (a.length === 0) die('teacher-guide.html: no ' + what + ' on a line of its own');
  if (a.length > 1) die('teacher-guide.html: ' + what + ' appears ' + a.length + ' times on a line of its own');
  return a[0];
}
/* the printable file has a second <style> block, so its close is "the first one
   after the opening tag", not "the only one" */
function firstAfter(re, pos, what) {
  const a = at(re).filter(i => i > pos);
  if (!a.length) die('teacher-guide.html: no ' + what + ' after position ' + pos);
  return a[0];
}
const CSS_OPEN = '<style id="guide-css">';
const sOpen = only(/^<style id="guide-css">[ \t]*$/gm, CSS_OPEN);
const sClose = firstAfter(/^<\/style>[ \t]*$/gm, sOpen, '</style> closing ' + CSS_OPEN);
const gStart = only(/^<div class="guide-scope">[ \t]*$/gm, '<div class="guide-scope">');
const gEnd = only(/^<\/div><!-- \/guide -->[ \t]*$/gm, '</div><!-- /guide -->');
if (gEnd < gStart) die('teacher-guide.html: </div><!-- /guide --> precedes <div class="guide-scope">');

const guideCss = guideSrc.slice(sOpen + CSS_OPEN.length, sClose).replace(/^\n|\n$/g, '');
const guideHtml = guideSrc.slice(gStart, gEnd) + '</div>';

/* Every rule in the injected block must be scoped. A single unscoped selector would
   restyle the whole game the moment the notes stylesheet loads, and it would do it
   silently — so refuse rather than ship it. */
const bare = guideCss.replace(/\/\*[\s\S]*?\*\//g, '');
if (/@/.test(bare)) {
  die('the injected guide stylesheet may not contain an at-rule (@media, @page, ...);\n' +
      'put it in the printable-page <style> block of teacher-guide.html instead');
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
   endTag. Both markers stay in the file, so the next run finds them again. A
   duplicated marker would make the region ambiguous, so refuse. */
function splice(src, startTag, endTag, body) {
  const a = src.indexOf(startTag);
  if (a < 0) die('marker missing in index.html: ' + startTag + ' ...');
  if (src.indexOf(startTag, a + 1) >= 0) die('marker appears more than once in index.html: ' + startTag + ' ...');
  const aEnd = src.indexOf('\n', a);
  const b = src.indexOf(endTag, aEnd);
  if (b < 0) die('closing marker missing in index.html: ' + endTag);
  if (src.indexOf(endTag, b + 1) >= 0) die('closing marker appears more than once in index.html: ' + endTag);
  /* a function, not a string: the guide text may contain $& / $` and String.replace
     would eat them */
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
