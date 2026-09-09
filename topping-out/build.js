#!/usr/bin/env node
/* Topping Out build: concatenate src/ into a single offline index.html in this
   folder, and copy the printable instructor guide alongside it.

   `node build.js`         writes index.html and teacher-guide.html
   `node build.js --check` verifies both match the canonical build, writes nothing

   The guide is canonical in src/teacher-guide.html. Its <style id="guide-css">
   block and its .guide-scope div are lifted into the app verbatim, so
   Settings -> Open Presenter Notes shows the instructor guide itself, with no
   sibling file to fetch and nothing to keep in step by hand. One source of
   truth: edit src/teacher-guide.html, never the copies. --check fails when the
   two have drifted. */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, 'src');
const OUT = __dirname;
const CHECK = process.argv.includes('--check');

const CSS_FILES = ['styles.css'];
const JS_FILES = ['data.js', 'engine.js', 'render4d.js', 'views.js', 'app.js'];

function read(f) { return fs.readFileSync(path.join(SRC, f), 'utf8'); }
function die(msg) { console.error(msg); process.exit(1); }

const css = CSS_FILES.map(f => `/* ==== ${f} ==== */\n` + read(f)).join('\n\n');
let js = JS_FILES.map(f => `/* ==== ${f} ==== */\n` + read(f)).join('\n\n');

/* The engine and data files carry a CommonJS tail so they can be required
   by node for the test suites. Strip nothing — `typeof module` is undefined
   in the browser and the guards handle it — but a literal </script> inside
   any string would close the inline script tag early. */
js = js.replace(/<\/script/gi, '<\\/script');

/* ---- the guide -----------------------------------------------------------
   Located by explicit id markers, never by indexOf('<style>'): the guide has
   two stylesheets — page chrome for the standalone printable file, and the
   scoped block that is safe to inject — and a bare search would also match a
   style tag written inside an HTML comment. */
const guideSrc = read('teacher-guide.html');
const CSS_OPEN = '<style id="guide-css">';
const G_OPEN = '<div class="guide-scope">';
const G_CLOSE = '</div><!-- /guide -->';

for (const [mark, what] of [[CSS_OPEN, 'stylesheet'], [G_OPEN, 'scope open'], [G_CLOSE, 'scope close']]) {
  const n = guideSrc.split(mark).length - 1;
  if (n !== 1) die(`src/teacher-guide.html: ${what} marker ${mark} appears ${n} times; it must appear exactly once`);
}

const cssStart = guideSrc.indexOf(CSS_OPEN) + CSS_OPEN.length;
const cssEnd = guideSrc.indexOf('</style>', cssStart);
if (cssEnd < 0) die('guide stylesheet is not closed');
const guideCss = guideSrc.slice(cssStart, cssEnd);
const guideHtml = guideSrc.slice(guideSrc.indexOf(G_OPEN), guideSrc.indexOf(G_CLOSE)) + '</div>';

/* A page-level rule in the injected block would restyle the whole app. The
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

/* ---- the template --------------------------------------------------------
   String.replace substitutes the FIRST match, so a placeholder that also
   appears in a head comment would swallow the payload. Each must be unique. */
const tpl = read('template.html');
for (const ph of ['/*__CSS__*/', '/*__JS__*/', '/*__GUIDE_CSS__*/', '<!--__GUIDE__-->']) {
  const n = tpl.split(ph).length - 1;
  if (n !== 1) die(`template placeholder ${ph} appears ${n} times; it must appear exactly once`);
}

/* Function replacements throughout: the guide and the sources contain `$`, and
   a string replacement would consume `$$`, `$&`, `` $` `` and `$'`. */
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
if (offenders.length) die('build refuses to ship an external reference:\n  ' + offenders.join('\n  '));

const indexOut = path.join(OUT, 'index.html');
const guideOut = path.join(OUT, 'teacher-guide.html');
const sameIndex = fs.existsSync(indexOut) && fs.readFileSync(indexOut, 'utf8') === html;
const sameGuide = fs.existsSync(guideOut) && fs.readFileSync(guideOut, 'utf8') === guideSrc;

if (CHECK) {
  const stale = [];
  if (!sameIndex) stale.push('index.html');
  if (!sameGuide) stale.push('teacher-guide.html');
  if (stale.length) {
    console.error('PARITY FAIL: stale generated file(s): ' + stale.join(', ') + '. Run: node build.js');
    process.exit(1);
  }
  console.log('build parity OK — index.html carries the guide from src/teacher-guide.html verbatim; no files written');
} else {
  fs.writeFileSync(indexOut, html);
  console.log('index.html written:', (html.length / 1024).toFixed(0) + ' KB');
  fs.copyFileSync(path.join(SRC, 'teacher-guide.html'), guideOut);
  console.log('teacher-guide.html copied');
}
