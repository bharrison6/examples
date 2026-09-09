#!/usr/bin/env node
/* Takeoff build: concatenate src/ into a single offline index.html in this
   folder, and ship the printable presenter guide alongside it.

   `node build.js`         writes index.html and presenter-guide.html
   `node build.js --check` verifies both match the canonical build, writes nothing

   ONE SOURCE FOR THE NOTES. src/presenter-guide.html is canonical. Its first
   <style> block and its .guide-scope div are lifted out verbatim and injected
   into the app at /*__GUIDE_CSS__*_/ and <!--__GUIDE__-->, so Settings -> Open
   Presenter Notes shows exactly the printable guide with no sibling file to
   fetch. The same file is copied byte-for-byte to the demo root, which is what
   tools/pdf.mjs renders. Three surfaces — in-app notes, shipped guide, PDF —
   all derive from that one file, and --check fails when any of them drifts.

   Before this, the in-app notes were a separately authored near-copy (1961
   words against the guide's 2072). Nothing kept them honest, and they had
   already diverged on the Act I framing and on the ARC-AGI figures. */
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

/* ---- pull the guide apart ------------------------------------------------
   The FIRST <style> block is the one scoped to .guide-scope and safe to
   inject; the SECOND is page chrome for the standalone printable file (serif
   body, @page, the light ground) and must not leak into the dark app. */
const guideSrc = read('presenter-guide.html');
const sOpen  = guideSrc.indexOf('<style>');
const sClose = guideSrc.indexOf('</style>');
const gStart = guideSrc.indexOf('<div class="guide-scope">');
const gEnd   = guideSrc.indexOf('</div><!-- /guide -->');
if (sOpen < 0 || sClose < 0 || gStart < 0 || gEnd < 0) {
  console.error('guide markers missing in src/presenter-guide.html'); process.exit(1);
}
const guideCss  = guideSrc.slice(sOpen + '<style>'.length, sClose);
const guideHtml = guideSrc.slice(gStart, gEnd) + '</div>';

/* Every selector in the injected block must be scoped. One unscoped rule —
   `body`, `*`, a bare `table` — would restyle the whole app from inside a
   hidden overlay, which is a miserable thing to track down. Checked selector
   by selector rather than by spotting a `body` rule alone. */
const leaks = [];
guideCss.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').forEach(line => {
  const t = line.trim();
  if (!t.endsWith('{')) return;
  t.slice(0, -1).split(',').map(s => s.trim()).filter(Boolean).forEach(sel => {
    if (!sel.startsWith('.guide-scope')) leaks.push(sel);
  });
});
if (leaks.length) {
  console.error('guide stylesheet leaks unscoped rules into the app:\n  ' + leaks.join('\n  '));
  process.exit(1);
}

const tpl = read('template.html');
/* Exactly once, each. `String.replace` with a string argument substitutes the
   FIRST occurrence, so a placeholder named a second time anywhere in the file —
   in a comment explaining the mechanism, say — silently swallows the injection
   and leaves the overlay empty. That is not hypothetical: it happened while
   this build was being written, and the guide landed inside the head comment. */
for (const ph of ['/*__CSS__*/', '/*__JS__*/', '/*__GUIDE_CSS__*/', '<!--__GUIDE__-->']) {
  const n = tpl.split(ph).length - 1;
  if (n === 0) { console.error('template placeholder missing: ' + ph); process.exit(1); }
  if (n > 1)   { console.error(`template names ${ph} ${n} times; it must appear exactly once`); process.exit(1); }
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
const pdfOut   = path.join(OUT, 'Takeoff-Presenter-Guide.pdf');
const srcGuide = path.join(SRC, 'presenter-guide.html');

if (CHECK) {
  const same = (file, want) => fs.existsSync(file) && fs.readFileSync(file, 'utf8') === want;
  if (!same(indexOut, html)) {
    console.error('PARITY MISMATCH: index.html differs from the canonical build output. Run: node build.js');
    process.exit(2);
  }
  if (!same(guideOut, guideSrc)) {
    console.error('PARITY MISMATCH: presenter-guide.html differs from src/presenter-guide.html. Run: node build.js');
    process.exit(2);
  }
  /* Index parity already implies this, since the notes are a substring of the
     build output. Assert it directly anyway: it is the property the contract
     names, and a template edit that dropped the placeholder would otherwise
     pass silently with the notes simply absent from the app. */
  if (!fs.readFileSync(indexOut, 'utf8').includes(guideHtml)) {
    console.error('PARITY MISMATCH: the in-app presenter notes are not the guide body. Run: node build.js');
    process.exit(2);
  }
  /* The PDF is a render, not a copy, so it cannot be compared byte for byte,
     and Chrome's output embeds no recoverable title to match against. Freshness
     is the pin that is actually available: the PDF must not predate the guide
     it is a picture of. Two seconds of slack absorbs a fresh checkout, which
     stamps every file at about the same instant. */
  if (!fs.existsSync(pdfOut)) {
    console.error('PARITY MISMATCH: Takeoff-Presenter-Guide.pdf is missing. Run: node tools/pdf.mjs');
    process.exit(2);
  }
  const lag = fs.statSync(srcGuide).mtimeMs - fs.statSync(pdfOut).mtimeMs;
  if (lag > 2000) {
    console.error('PARITY MISMATCH: Takeoff-Presenter-Guide.pdf is older than src/presenter-guide.html ' +
                  `by ${(lag / 1000).toFixed(0)}s. Run: node tools/pdf.mjs`);
    process.exit(2);
  }
  console.log('PARITY OK: index.html, presenter-guide.html and the in-app presenter notes all derive');
  console.log('PARITY OK: from src/presenter-guide.html, and the PDF is no older than it; nothing written.');
  process.exit(0);
}

fs.writeFileSync(indexOut, html);
console.log('WRITE OK: index.html written:', (html.length / 1024).toFixed(0) + ' KB');
fs.writeFileSync(guideOut, guideSrc);
console.log('WRITE OK: presenter-guide.html copied');
console.log('NOTE: if the guide changed, re-render the PDF: node tools/pdf.mjs');
