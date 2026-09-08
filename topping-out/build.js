#!/usr/bin/env node
/* Topping Out build: concatenate src files into a single offline index.html
   in this folder, and copy the printable teacher guide alongside it. */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, 'src');
const OUT = __dirname;

const CSS_FILES = ['styles.css'];
const JS_FILES = ['data.js', 'engine.js', 'render4d.js', 'views.js', 'app.js'];

function read(f) { return fs.readFileSync(path.join(SRC, f), 'utf8'); }

const css = CSS_FILES.map(f => `/* ==== ${f} ==== */\n` + read(f)).join('\n\n');
let js = JS_FILES.map(f => `/* ==== ${f} ==== */\n` + read(f)).join('\n\n');

/* The engine and data files carry a CommonJS tail so they can be required
   by node for the test suites. Strip nothing — `typeof module` is undefined
   in the browser and the guards handle it — but a literal </script> inside
   any string would close the inline script tag early. */
js = js.replace(/<\/script/gi, '<\\/script');

const tpl = read('template.html');
if (!tpl.includes('/*__CSS__*/') || !tpl.includes('/*__JS__*/')) {
  console.error('template placeholders missing'); process.exit(1);
}
const html = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);

const CHECK = process.argv.includes('--check');
const outFile = path.join(OUT, 'index.html');
const tg = path.join(SRC, 'teacher-guide.html');

if (CHECK) {
  let stale = [];
  if (!fs.existsSync(outFile) || fs.readFileSync(outFile, 'utf8') !== html) stale.push('index.html');
  if (fs.existsSync(tg) && (!fs.existsSync(path.join(OUT, 'teacher-guide.html')) ||
      fs.readFileSync(path.join(OUT, 'teacher-guide.html'), 'utf8') !== fs.readFileSync(tg, 'utf8'))) {
    stale.push('teacher-guide.html');
  }
  if (stale.length) {
    console.error('PARITY FAIL: stale generated file(s): ' + stale.join(', '));
    process.exit(1);
  }
  console.log('build parity OK — no files written');
} else {
  fs.writeFileSync(outFile, html);
  console.log('index.html written:', (html.length / 1024).toFixed(0) + ' KB');
  if (fs.existsSync(tg)) {
    fs.copyFileSync(tg, path.join(OUT, 'teacher-guide.html'));
    console.log('teacher-guide.html copied');
  }
}
