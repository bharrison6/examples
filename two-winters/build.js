#!/usr/bin/env node
/* Two Winters build: concatenate src/ into a single offline index.html in this
   folder, and copy the printable presenter guide alongside it.

   `node build.js`         writes index.html and presenter-guide.html
   `node build.js --check` verifies both match the canonical build, writes nothing

   The guide is canonical in src/presenter-guide.html. Its scoped stylesheet and
   its .guide-scope div are lifted into the app verbatim, so Settings ->
   Open Presenter Notes works from the single file with no sibling to fetch. One
   source of truth: edit src/presenter-guide.html, never the copies.

   Marker rule (do not soften it). Every marker below is found by a regex
   anchored to the start of a line, searched over a copy of the guide in which
   every <!-- ... --> region has been blanked to same-length spaces, and refused
   unless it matches EXACTLY ONCE. Both halves are load-bearing: this file used
   to say indexOf('<style>'), and the guide's own head comment contains that
   literal while describing the mechanism, so extraction silently began inside
   the comment and the browser dropped the first scoped rule. Naming the block
   by id is not enough on its own -- a comment that documents the id matches it
   too. */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, 'src');
const OUT = __dirname;
const CHECK = process.argv.includes('--check');

const CSS_FILES = ['styles.css'];
const JS_FILES  = ['data.js', 'engine.js', 'timeline.js', 'app.js'];

const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

const css = CSS_FILES.map(f => `/* ==== ${f} ==== */\n` + read(f)).join('\n\n');
let js    = JS_FILES.map(f => `/* ==== ${f} ==== */\n` + read(f)).join('\n\n');

/* data.js, engine.js and timeline.js carry CommonJS tails so node can require
   them for the test suite; `typeof module` is undefined in the browser and the
   guard handles it. A literal </script> in any string would close the inline
   script early, so neutralise those. */
js = js.replace(/<\/script/gi, '<\\/script');

const die = msg => { console.error(msg); process.exit(1); };

/** Blank every HTML comment to same-length spaces (newlines kept, so line
 *  anchors and offsets both survive). Searching this copy means no marker can
 *  ever be matched inside prose that merely talks about the marker. */
function maskComments(s) {
  return s.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
}

/** Index of the one line that starts with `marker`. Exactly once, or die. */
function onceAtLineStart(masked, marker, what) {
  const re = new RegExp('^' + marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gm');
  const hits = [];
  for (let m; (m = re.exec(masked)) !== null; ) hits.push(m.index);
  if (hits.length !== 1) {
    die(`guide marker ${what} must appear exactly once at the start of a line in `
      + `src/presenter-guide.html; found ${hits.length}`);
  }
  return hits[0];
}

/* Pull the guide apart. <style id="guide-css"> is the block scoped to
   .guide-scope and safe to inject; the unnamed block after it is page chrome
   for the standalone printable file and must not leak into the app. */
const guideSrc = read('presenter-guide.html');
const guideMasked = maskComments(guideSrc);

const CSS_OPEN = '<style id="guide-css">';
const G_OPEN = '<div class="guide-scope">';
const G_CLOSE = '</div><!-- /guide -->';

const sOpen = onceAtLineStart(guideMasked, CSS_OPEN, CSS_OPEN);
const sClose = guideMasked.indexOf('</style>', sOpen);
if (sClose < 0) die('guide marker </style> missing after ' + CSS_OPEN);
const gStart = onceAtLineStart(guideMasked, G_OPEN, G_OPEN);
/* The end marker carries its own comment terminator, so it cannot itself sit
   inside a comment; it is matched on the raw text, still exactly once. */
const gEnd = onceAtLineStart(guideSrc, G_CLOSE, G_CLOSE);
if (!(sOpen < sClose && sClose < gStart && gStart < gEnd)) {
  die('guide markers are out of order in src/presenter-guide.html');
}

const guideCss = guideSrc.slice(sOpen + CSS_OPEN.length, sClose);
const guideHtml = guideSrc.slice(gStart, gEnd) + '</div>';
if (/^\s*body\s*[,{]/m.test(guideCss)) {
  die('guide stylesheet leaks a page-level rule into the app');
}
/* Canaries for the failure this build used to ship: if extraction ever begins
   or ends in the wrong place, comment syntax or a nested tag comes with it. */
for (const [needle, where] of [['<!--', 'CSS'], ['-->', 'CSS'], ['<style', 'CSS']]) {
  if (guideCss.includes(needle)) die(`extracted guide ${where} contains "${needle}" — marker search went wrong`);
}
if (!/^\s*\.guide-scope\b/m.test(guideCss)) {
  die('extracted guide CSS does not start with a .guide-scope rule — marker search went wrong');
}
if (!guideHtml.startsWith(G_OPEN) || !guideHtml.endsWith('</div>')) {
  die('extracted guide body is not the .guide-scope div');
}

const tpl = read('template.html');
const tplMasked = maskComments(tpl);
for (const ph of ['/*__CSS__*/', '/*__JS__*/', '/*__GUIDE_CSS__*/']) {
  /* String.replace substitutes the FIRST occurrence, so a second copy of a
     placeholder — in a head comment, say — would silently take the payload. */
  const n = tpl.split(ph).length - 1;
  if (n !== 1) die(`template placeholder ${ph} must appear exactly once; found ${n}`);
}
/* <!--__GUIDE__--> is itself a comment, so count it before masking and require
   that masking removes every copy (i.e. no stray literal outside a comment). */
{
  const n = tpl.split('<!--__GUIDE__-->').length - 1;
  if (n !== 1) die(`template placeholder <!--__GUIDE__--> must appear exactly once; found ${n}`);
  if (tplMasked.includes('__GUIDE__')) die('template has a stray __GUIDE__ outside a comment');
}
const html = tpl
  .replace('/*__CSS__*/', () => css)
  .replace('/*__GUIDE_CSS__*/', () => guideCss)
  .replace('<!--__GUIDE__-->', () => guideHtml)
  .replace('/*__JS__*/', () => js);

/* A single file means a single file: nothing may be fetched at runtime. */
const offenders = [];
html.replace(/<(script|link|img|iframe|source|video|audio)\b[^>]*>/gi, (tag) => {
  if (/\b(src|href)\s*=\s*["']?(?!#)[^"'>\s]+/i.test(tag) && !/data:/i.test(tag)) offenders.push(tag.slice(0, 80));
  return tag;
});
if (offenders.length) {
  console.error('build refuses to ship an external reference:\n  ' + offenders.join('\n  '));
  process.exit(1);
}

const indexOut = path.join(OUT, 'index.html');
const guideOut = path.join(OUT, 'presenter-guide.html');
const sameIndex = fs.existsSync(indexOut) && fs.readFileSync(indexOut, 'utf8') === html;
const sameGuide = fs.existsSync(guideOut) && fs.readFileSync(guideOut, 'utf8') === guideSrc;

if (CHECK) {
  if (!sameIndex) {
    console.error('PARITY MISMATCH: index.html differs from the canonical build output. Run: node build.js');
    process.exit(2);
  }
  if (!sameGuide) {
    console.error('PARITY MISMATCH: presenter-guide.html differs from src/presenter-guide.html. Run: node build.js');
    process.exit(2);
  }
  console.log('PARITY OK: index.html and presenter-guide.html match the canonical build; no files written.');
  process.exit(0);
}

fs.writeFileSync(indexOut, html);
console.log('WRITE OK: index.html written:', (html.length / 1024).toFixed(0) + ' KB');
fs.writeFileSync(guideOut, guideSrc);
console.log('WRITE OK: presenter-guide.html copied');
