#!/usr/bin/env node
/* Zero to Unbeatable build: concatenate src into a single offline index.html in this
   folder, and copy the printable demo guide alongside it. */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, 'src');
const OUT = __dirname;

const CSS_FILES = ['styles.css'];
/* engine.js first: rules.js and ultimate.js both close over the OG
   global it defines, and app.js needs all three.

   net.js supplies the neural-network tab. Its legacy experiment remains
   isolated; the public adapter trains shared weights against a frozen
   afterstate table with the current value perspective. */
const JS_FILES  = ['engine.js', 'rules.js', 'ultimate.js', 'net.js', 'app.js'];

const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

const css = CSS_FILES.map(f => `/* ==== ${f} ==== */\n` + read(f)).join('\n\n');
let js    = JS_FILES.map(f => `/* ==== ${f} ==== */\n` + read(f)).join('\n\n');

/* engine.js carries a CommonJS tail so node can require it for the test
   suites; `typeof module` is undefined in the browser and the guard
   handles it. A literal </script> in any string would close the inline
   script early, so neutralise those. */
js = js.replace(/<\/script/gi, '<\\/script');

/* The printable guide is lifted into the app so Settings -> Presenter
   notes works from the single file, with no sibling to go looking for.
   One source of truth: the guide's own stylesheet and its own markup,
   both scoped to .guide, are injected verbatim. */
const guideSrc = read('demo-guide.html');
const guideCss = guideSrc.slice(guideSrc.indexOf('<style>') + 7, guideSrc.indexOf('</style>'));
const gStart = guideSrc.indexOf('<div class="guide">');
const gEnd = guideSrc.indexOf('</div><!-- /guide -->');
if (gStart < 0 || gEnd < 0) { console.error('guide markers missing'); process.exit(1); }
const guideHtml = guideSrc.slice(gStart, gEnd) + '</div>';

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
const guideOut = path.join(OUT, 'demo-guide.html');
const checkOnly = process.argv.includes('--check');
const sameIndex = fs.existsSync(indexOut) && fs.readFileSync(indexOut, 'utf8') === html;
const sameGuide = !fs.existsSync(path.join(SRC, 'demo-guide.html')) ||
  (fs.existsSync(guideOut) && fs.readFileSync(guideOut, 'utf8') === fs.readFileSync(path.join(SRC, 'demo-guide.html'), 'utf8'));
if (checkOnly) {
  if (sameIndex && sameGuide) console.log('build parity OK — no files written');
  else { console.error('build parity MISMATCH — no files written'); process.exitCode = 1; }
  return;
}
fs.writeFileSync(indexOut, html);
console.log('index.html written:', (html.length / 1024).toFixed(0) + ' KB');

const dg = path.join(SRC, 'demo-guide.html');
if (fs.existsSync(dg)) {
  fs.copyFileSync(dg, guideOut);
  console.log('demo-guide.html copied');
}
