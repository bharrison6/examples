#!/usr/bin/env node
/* PLC Ladder Logic Trainer (Ladder Lab) build: concatenate src/ into a single
   offline index.html.

   `node build.js`         writes index.html + teacher-guide.html to dist/ and
                           to the demo root
   `node build.js --check` verifies all four match the canonical build and
                           writes nothing

   The teacher guide is canonical in src/teacher-guide.html. Its scoped
   stylesheet and its .guide-scope body are lifted into the app verbatim, so
   Settings -> Open Presenter Notes shows the teacher guide itself — no sibling
   file to fetch at runtime, no second copy to keep in step by hand. One source
   of truth: edit src/teacher-guide.html, never the copies. --check fails the
   moment they drift. */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'dist');
const CHECK = process.argv.includes('--check');

const CSS_FILES = ['styles.css', 'ladder-watch.css', 'sim.css', 'editor.css', 'challenges.css', 'faults.css', 'integration.css'];
const JS_FILES = ['engine.js', 'programs.js', 'faults.js', 'ladder.js', 'watch.js', 'sim.js', 'editor.js', 'challenges.js', 'app.js'];

function read(f) { return fs.readFileSync(path.join(SRC, f), 'utf8'); }
function die(msg) { console.error(msg); process.exit(1); }

const css = CSS_FILES.map(f => `/* ==== ${f} ==== */\n` + read(f)).join('\n\n');
let js = JS_FILES.map(f => `/* ==== ${f} ==== */\n` + read(f)).join('\n\n');

// Safety: </script> inside JS strings would break the inline script tag.
js = js.replace(/<\/script/gi, '<\\/script');

/* ---- marker location ------------------------------------------------------
   Two traps, both of which have bitten this repo:

   1. A marker documented in a comment is found inside that comment first, so a
      bare indexOf can start the slice in the prose. Comments are masked to
      same-length spaces before searching, which keeps every index aligned with
      the raw text while making comment interiors unmatchable.
   2. A marker that occurs twice silently takes the wrong one. Every marker must
      occur exactly once, and must begin a line — a marker found mid-line is a
      marker found somewhere it was not meant to be. */
function maskComments(s) {
  return s.replace(/<!--[\s\S]*?-->/g, m => ' '.repeat(m.length));
}
function locate(hay, mark, what, where) {
  const hits = [];
  for (let i = hay.indexOf(mark); i >= 0; i = hay.indexOf(mark, i + 1)) hits.push(i);
  if (hits.length !== 1) {
    die(`${where}: ${what} marker ${JSON.stringify(mark)} appears ${hits.length} times; it must appear exactly once`);
  }
  if (hits[0] !== 0 && hay[hits[0] - 1] !== '\n') {
    die(`${where}: ${what} marker ${JSON.stringify(mark)} does not start a line`);
  }
  return hits[0];
}

/* ---- the guide ------------------------------------------------------------ */
const guideSrc = read('teacher-guide.html');
const guideMasked = maskComments(guideSrc);
const CSS_OPEN = '<style id="guide-css">';
const G_OPEN = '<div class="guide-scope">';
/* The closing marker is itself a comment, deliberately: it makes the end of the
   injected region visible in the guide. So it is located in the raw text — the
   masked copy has blanked it out — and still has to be unique and line-anchored. */
const G_CLOSE = '</div><!-- /guide -->';

const cssAt = locate(guideMasked, CSS_OPEN, 'stylesheet', 'src/teacher-guide.html');
const openAt = locate(guideMasked, G_OPEN, 'scope open', 'src/teacher-guide.html');
const closeAt = locate(guideSrc, G_CLOSE, 'scope close', 'src/teacher-guide.html');
if (closeAt < openAt) die('src/teacher-guide.html: the guide-scope close marker precedes the open marker');

const cssStart = cssAt + CSS_OPEN.length;
const cssEnd = guideMasked.indexOf('</style>', cssStart);
if (cssEnd < 0) die('src/teacher-guide.html: the guide stylesheet is not closed');
const guideCss = guideSrc.slice(cssStart, cssEnd);
const guideBody = guideSrc.slice(openAt, closeAt) + '</div>';

/* A page-level rule inside the injected block would restyle the whole app. The
   guide keeps those in <style id="guide-page">, which is never injected. */
if (/^\s*(body|html|:root)\s*[,{>]/m.test(guideCss)) die('guide stylesheet leaks a page-level rule into the app');
if (/@page/.test(guideCss)) die('guide stylesheet leaks @page into the app');
/* Every selector in the injected block has to start inside .guide-scope, or it
   escapes into the app. Checked rule by rule rather than trusted. */
guideCss.replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/@media[^{]*\{/g, '')
  .split('}')
  .forEach(chunk => {
    if (chunk.indexOf('{') < 0) return;
    chunk.split('{')[0].split(',').forEach(one => {
      const sel = one.trim();
      if (sel && !/^\.guide-scope\b/.test(sel)) {
        die('guide stylesheet has a selector outside .guide-scope: ' + sel);
      }
    });
  });

/* ---- the template --------------------------------------------------------- */
const tpl = read('template.html');
/* <!--__GUIDE__--> is itself a comment, so the template is checked raw; the head
   comment that explains the placeholders deliberately spells them without their
   delimiters, and this check is what keeps that honest. */
for (const ph of ['/*__CSS__*/', '/*__JS__*/', '/*__GUIDE_CSS__*/', '<!--__GUIDE__-->']) {
  locate(tpl, ph, 'placeholder', 'src/template.html');
}

/* Function replacements throughout: the guide and the sources contain `$`, and a
   string replacement would consume `$$`, `$&`, `` $` `` and `$'`. */
const html = tpl
  .replace('/*__CSS__*/', () => css)
  .replace('/*__GUIDE_CSS__*/', () => guideCss)
  .replace('<!--__GUIDE__-->', () => guideBody)
  .replace('/*__JS__*/', () => js);

/* A single file means a single file: nothing may be fetched at runtime. The
   <a href="teacher-guide.html"> links are navigations the presenter chooses,
   not subresources, so they are not in this list. */
const offenders = [];
html.replace(/<(script|link|img|iframe|source|video|audio)\b[^>]*>/gi, (tag) => {
  if (/\b(src|href)\s*=\s*["']?(?!#)[^"'>\s]+/i.test(tag) && !/data:/i.test(tag)) offenders.push(tag.slice(0, 80));
  return tag;
});
if (offenders.length) die('build refuses to ship an external reference:\n  ' + offenders.join('\n  '));

/* dist/ is the build output; the demo root is what the launcher links and what
   ships. Write both, so the shipped file cannot drift from src/ the way it
   silently could when the copy up was a manual step. */
const targets = [OUT, __dirname];

function sameAs(file, text) {
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text;
}

if (CHECK) {
  const stale = [];
  for (const dir of targets) {
    const rel = dir === OUT ? 'dist/' : '';
    if (!sameAs(path.join(dir, 'index.html'), html)) stale.push(rel + 'index.html');
    if (!sameAs(path.join(dir, 'teacher-guide.html'), guideSrc)) stale.push(rel + 'teacher-guide.html');
  }
  if (stale.length) {
    console.error('PARITY FAIL: stale generated file(s): ' + stale.join(', ') + '. Run: node build.js');
    process.exit(1);
  }
  console.log('build parity OK — index.html carries the guide from src/teacher-guide.html verbatim; no files written');
} else {
  fs.mkdirSync(OUT, { recursive: true });
  for (const dir of targets) {
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    fs.writeFileSync(path.join(dir, 'teacher-guide.html'), guideSrc);
  }
  console.log('index.html written to dist/ and demo root:', (html.length / 1024).toFixed(0) + ' KB');
  console.log('teacher-guide.html written to dist/ and demo root');
}
