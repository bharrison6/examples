#!/usr/bin/env node
/* Ladder Lab build: concatenate src files into a single offline index.html */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'dist');

const CSS_FILES = ['styles.css', 'ladder-watch.css', 'sim.css', 'editor.css', 'challenges.css', 'faults.css', 'integration.css'];
const JS_FILES = ['engine.js', 'programs.js', 'faults.js', 'ladder.js', 'watch.js', 'sim.js', 'editor.js', 'challenges.js', 'app.js'];

function read(f) { return fs.readFileSync(path.join(SRC, f), 'utf8'); }

const css = CSS_FILES.map(f => `/* ==== ${f} ==== */\n` + read(f)).join('\n\n');
let js = JS_FILES.map(f => `/* ==== ${f} ==== */\n` + read(f)).join('\n\n');

// Safety: </script> inside JS strings would break the inline script tag.
js = js.replace(/<\/script/gi, '<\\/script');

const tpl = read('template.html');
if (!tpl.includes('/*__CSS__*/') || !tpl.includes('/*__JS__*/')) {
  console.error('template placeholders missing'); process.exit(1);
}
const html = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log('dist/index.html written:', (html.length / 1024).toFixed(0) + ' KB');

// copy teacher guide if present
const tg = path.join(SRC, 'teacher-guide.html');
if (fs.existsSync(tg)) {
  fs.copyFileSync(tg, path.join(OUT, 'teacher-guide.html'));
  console.log('dist/teacher-guide.html copied');
}
