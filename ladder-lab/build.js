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

const CHECK = process.argv.includes('--check');
const tg = path.join(SRC, 'teacher-guide.html');
const guideHtml = fs.existsSync(tg) ? fs.readFileSync(tg, 'utf8') : null;

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
    if (guideHtml !== null && !sameAs(path.join(dir, 'teacher-guide.html'), guideHtml)) {
      stale.push(rel + 'teacher-guide.html');
    }
  }
  if (stale.length) {
    console.error('PARITY FAIL: stale generated file(s): ' + stale.join(', '));
    process.exit(1);
  }
  console.log('build parity OK — no files written');
} else {
  fs.mkdirSync(OUT, { recursive: true });
  for (const dir of targets) {
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    if (guideHtml !== null) fs.writeFileSync(path.join(dir, 'teacher-guide.html'), guideHtml);
  }
  console.log('index.html written to dist/ and demo root:', (html.length / 1024).toFixed(0) + ' KB');
}
