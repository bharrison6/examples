#!/usr/bin/env node
/* Single-source the presenter notes.

   teacher-guide.html is canonical. This script lifts its FIRST <style> block and
   its `.guide-scope` div out verbatim and writes them into index.html between the
   __GUIDE_CSS__ and __GUIDE__ markers, so Settings -> Open Presenter Notes shows
   exactly the printable guide with nothing fetched at runtime. Editing the copy
   inside index.html is a fork; --check exists to catch it.

     node tools/guide-sync.js           rewrite the injected block in index.html
     node tools/guide-sync.js --check   fail if index.html has drifted, write nothing

   Mechanism borrowed from two-winters/build.js, which does the same lift into a
   template. Bridge Works ships its sources rather than building them, so the
   injection is a marked region in the shipped index.html instead of a template
   placeholder — same single source, same drift check, no build step to run first.

   Run order when both are needed: guide-sync writes index.html, so
     node tools/guide-sync.js && node sync-standalone.js
   keeps the single-file edition exact too. tools/pdf.mjs renders the PDF from the
   same teacher-guide.html. */
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

/* The FIRST <style> block is the one scoped to .guide-scope and safe to inject.
   The second is page chrome for the printable file and must not leak into the app.
   Both tags are matched at the start of a line, because the file's own header
   comment talks about <style> blocks and a bare indexOf finds that first. */
const mOpen = /^<style>[ \t]*$/m.exec(guideSrc);
const mClose = /^<\/style>[ \t]*$/m.exec(guideSrc);
const gStart = guideSrc.indexOf('<div class="guide-scope">');
const gEnd = guideSrc.indexOf('</div><!-- /guide -->');
if (!mOpen || !mClose || gStart < 0 || gEnd < 0) {
  die('guide markers missing in teacher-guide.html: needs <style> and </style> each ' +
      'alone on a line, and <div class="guide-scope"> ... </div><!-- /guide -->');
}
const sOpen = mOpen.index, sClose = mClose.index;
if (sClose < sOpen) die('teacher-guide.html: </style> precedes <style>');
const guideCss = guideSrc.slice(sOpen + '<style>'.length, sClose).replace(/^\n|\n$/g, '');
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
      unscoped.join('\n  ') + '\nevery selector in the first <style> block must start with .guide-scope');
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
   endTag. Both markers stay in the file, so the next run finds them again. */
function splice(src, startTag, endTag, body) {
  const a = src.indexOf(startTag);
  if (a < 0) die('marker missing in index.html: ' + startTag + ' ...');
  const aEnd = src.indexOf('\n', a);
  const b = src.indexOf(endTag, aEnd);
  if (b < 0) die('closing marker missing in index.html: ' + endTag);
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
  console.log('Remember: node sync-standalone.js to refresh the single-file edition.');
}
