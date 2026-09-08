#!/usr/bin/env node
/* Two Winters build: concatenate src/ into a single offline index.html in this
   folder, and copy the printable presenter guide alongside it.

   `node build.js`         writes index.html and presenter-guide.html
   `node build.js --check` verifies both match the canonical build, writes nothing

   The guide is canonical in src/presenter-guide.html. Its first <style> block
   and its .guide-scope div are lifted into the app verbatim, so Settings ->
   Presenter's notes works from the single file with no sibling to fetch. One
   source of truth: edit src/presenter-guide.html, never the copies. */
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
