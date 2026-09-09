#!/usr/bin/env node
/* Front Doors build: concatenate src/ into a single offline index.html in this
   folder, and copy the printable presenter guide alongside it.

   `node build.js`         writes index.html and presenter-guide.html
   `node build.js --check` verifies both match the canonical build, writes nothing

   The guide is canonical in src/presenter-guide.html. Its first <style> block
   and its .guide-scope div are lifted into the app verbatim, so Settings ->
   Presenter's notes works from the single file with no sibling to fetch. One
   source of truth: edit src/presenter-guide.html, never the copies.

   This demo is about products, and the two rules it holds itself to are worth
   enforcing at the gate rather than trusting to a reviewer's memory: no price
   reaches the screen, and no vendor is ranked. The build refuses to write if
   either leaks, using the same detectors the shipped test suite and the
   in-app self-test use. */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, 'src');
const OUT = __dirname;
const CHECK = process.argv.includes('--check');

const CSS_FILES = ['styles.css'];
const JS_FILES  = ['data.js', 'engine.js', 'app.js'];

const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

const css = CSS_FILES.map(f => `/* ==== ${f} ==== */\n` + read(f)).join('\n\n');
let js    = JS_FILES.map(f => `/* ==== ${f} ==== */\n` + read(f)).join('\n\n');

/* data.js and engine.js carry CommonJS tails so node can require them for the
   test suite; `typeof module` is undefined in the browser and the guard
   handles it. A literal </script> in any string would close the inline script
   early, so neutralise those. */
js = js.replace(/<\/script/gi, '<\\/script');

/* ---- the module's own two rules, enforced before anything is written ----
   Loaded through the same engine the app and the tests use, so there is one
   implementation of "is this a price" rather than three. */
{
  const D = require('./src/data.js');
  const E = require('./src/engine.js');
  const money = E.priceLeaks(D);
  if (money.length) {
    console.error('build refuses to ship a price on the page:\n  ' + money.join('\n  '));
    process.exit(1);
  }
  const rank = E.rankingLeaks(D);
  if (rank.length) {
    console.error('build refuses to ship a vendor ranking:\n  ' + rank.join('\n  '));
    process.exit(1);
  }
  const dangling = E.danglingSources(D);
  if (dangling.length) {
    console.error('build refuses to ship a claim citing a source that does not exist:\n  ' +
                  dangling.join(', '));
    process.exit(1);
  }
}

/* Pull the guide apart. The FIRST <style> block is the one scoped to
   .guide-scope and safe to inject; the second is page chrome for the
   standalone printable file and must not leak into the app. */
const guideSrc = read('presenter-guide.html');
const sOpen = guideSrc.indexOf('<style>');
const sClose = guideSrc.indexOf('</style>');
const gStart = guideSrc.indexOf('<div class="guide-scope">');
const gEnd = guideSrc.indexOf('</div><!-- /guide -->');
if (sOpen < 0 || sClose < 0 || gStart < 0 || gEnd < 0) {
  console.error('guide markers missing in src/presenter-guide.html'); process.exit(1);
}
const guideCss = guideSrc.slice(sOpen + '<style>'.length, sClose);
const guideHtml = guideSrc.slice(gStart, gEnd) + '</div>';
if (/^\s*body\s*[,{]/m.test(guideCss)) {
  console.error('guide stylesheet leaks a page-level rule into the app'); process.exit(1);
}

const tpl = read('template.html');
for (const ph of ['/*__CSS__*/', '/*__JS__*/', '/*__GUIDE_CSS__*/', '<!--__GUIDE__-->']) {
  if (!tpl.includes(ph)) { console.error('template placeholder missing: ' + ph); process.exit(1); }
}
const html = tpl
  .replace('/*__CSS__*/', () => css)
  .replace('/*__GUIDE_CSS__*/', () => guideCss)
  .replace('<!--__GUIDE__-->', () => guideHtml)
  .replace('/*__JS__*/', () => js);

/* A single file means a single file: nothing may be FETCHED at runtime.

   Outbound <a href> links are allowed by CONTRACT.md as amended 2026-09-08 —
   a link the reader may choose to follow is not a network call by the page —
   and this demo relies on them for its sources. So `a` is deliberately absent
   from the tag list below, while every tag that would cause the browser to
   go and get something is present. */
const offenders = [];
html.replace(/<(script|link|img|iframe|source|video|audio|embed|object|track)\b[^>]*>/gi, (tag) => {
  if (/\b(src|href|data)\s*=\s*["']?(?!#)[^"'>\s]+/i.test(tag) && !/data:/i.test(tag)) {
    offenders.push(tag.slice(0, 80));
  }
  return tag;
});
if (offenders.length) {
  console.error('build refuses to ship an external reference:\n  ' + offenders.join('\n  '));
  process.exit(1);
}

/* Every remaining URL in the file must be an outbound anchor, and every one of
   those must be a source the dataset declares. A stray link nobody signed off
   on is exactly the sort of thing this collection's contract exists to catch. */
{
  const D = require('./src/data.js');
  const declared = new Set(Object.keys(D.SOURCES).map(id => D.SOURCES[id].u));
  const linked = new Set();
  html.replace(/<a\b[^>]*\bhref\s*=\s*"([^"]+)"/gi, (m, href) => { linked.add(href); return m; });
  const stray = Array.from(linked).filter(u => !declared.has(u));
  if (stray.length) {
    console.error('build refuses to ship a link that is not a declared source:\n  ' + stray.join('\n  '));
    process.exit(1);
  }
  const httpish = (html.match(/https?:\/\/[^\s"'<>)]+/g) || [])
    .filter(u => !declared.has(u.replace(/[.,;]$/, '')));
  if (httpish.length) {
    console.error('build refuses to ship a URL that is not a declared source:\n  ' +
                  Array.from(new Set(httpish)).join('\n  '));
    process.exit(1);
  }
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
