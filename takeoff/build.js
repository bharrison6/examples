#!/usr/bin/env node
/* Undershoot build: concatenate src into a single offline index.html. The
   printable presenter guide is canonical at the repository root and is read
   directly by tools/pdf.mjs; it is not a generated copy. */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, 'src');
const OUT = __dirname;
const CHECK = process.argv.includes('--check');

const CSS_FILES = ['styles.css'];
const JS_FILES  = ['data.js', 'engine.js', 'chart.js', 'timeline.js', 'app.js'];

const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

const css = CSS_FILES.map(f => `/* ==== ${f} ==== */\n` + read(f)).join('\n\n');
let js    = JS_FILES.map(f => `/* ==== ${f} ==== */\n` + read(f)).join('\n\n');

/* data.js and engine.js carry CommonJS tails so node can require them for the
   test suites; `typeof module` is undefined in the browser and the guard
   handles it. A literal </script> in any string would close the inline script
   early, so neutralise those. */
js = js.replace(/<\/script/gi, '<\\/script');

const tpl = read('template.html');
if (!tpl.includes('/*__CSS__*/') || !tpl.includes('/*__JS__*/')) {
  console.error('template placeholders missing'); process.exit(1);
}
const html = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);

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

/* The guide is canonical in src/ and ships at the demo root, which is what
   tools/pdf.mjs renders. Copying it here is the whole reason the two ever
   agree: before this, src/ was corrected and the shipped copy was not. */
const guide = read('presenter-guide.html');
const guideOut = path.join(OUT, 'presenter-guide.html');

const indexOut = path.join(OUT, 'index.html');
const same = (file, want) => fs.existsSync(file) && fs.readFileSync(file, 'utf8') === want;
if (CHECK) {
  if (!same(indexOut, html)) {
    console.error('PARITY MISMATCH: index.html differs from the canonical build output. Run: node build.js');
    process.exit(2);
  }
  if (!same(guideOut, guide)) {
    console.error('PARITY MISMATCH: presenter-guide.html differs from src/presenter-guide.html. Run: node build.js');
    process.exit(2);
  }
  console.log('PARITY OK: index.html and presenter-guide.html match the canonical build; no files written.');
  process.exit(0);
}

fs.writeFileSync(indexOut, html);
console.log('WRITE OK: index.html written:', (html.length / 1024).toFixed(0) + ' KB');
fs.writeFileSync(guideOut, guide);
console.log('WRITE OK: presenter-guide.html copied');
