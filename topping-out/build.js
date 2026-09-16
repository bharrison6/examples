#!/usr/bin/env node
/* Build topping-out/index.html from src/ plus the shared lesson shell.

     src/template.html    the lesson markup — header, four stages, dialogs
     src/styles.css       the ACTIVITY styles (the lesson shell's are shared)
     src/data.js          the network, trades, zones, event deck and calls
     src/engine.js        the CPM solver, productivity models and the game
     src/render4d.js      the 4D cutaway renderer
     src/views.js         the Gantt and network renderers
     src/app.js           setup, the weekly loop, the HUD, the debrief
     src/demo-guide.html  the canonical SESSION guide (injected as the notes)
     src/appendix.html    the CPM appendix (LINKED, deliberately not injected)
     ../tools/lesson-shell/   tokens, shell CSS, shell behaviour, version stamp

   THE SHARED KIT IS A BUILD-TIME DEPENDENCY ONLY. Its CSS and behaviour are
   inlined here, so the shipped index.html is still one self-contained file
   with zero <script src> and zero <link href>. The build stamps the output
   with a hash of the kit's CSS, so this demo goes red if the kit changes
   under it.

   ---------------------------------------------------------------------------
   TWO GUIDE DOCUMENTS, AND ONLY ONE OF THEM IS THE NOTES.

   The instructor guide was 8,294 words in a single document. Template part A9
   caps the injected session guide at 2,500, because the presenter notes are
   read on a phone-sized overlay mid-session and nine thousand words there is
   not a document, it is a wall. So:

     src/demo-guide.html  2,366 words. CANONICAL and INJECTED. One source for
                          three surfaces: the printable page shipped as
                          teacher-guide.html (a public URL named in
                          demo.json), the rendered PDF, and Settings ->
                          Open Presenter Notes.
     src/appendix.html    the CPM derivations, the full calls deck, every
                          debrief question, the measured seeds, the sources
                          and the vocabulary. Shipped as appendix.html and
                          reached by an <a href>. NOT injected: injecting it
                          would put the wall back.

   That is a deliberate reading of CONTRACT.md's "one document" — the notes
   and the printable guide are still one document from one source, which is
   what the clause protects. The appendix is a second document, and the plan
   sanctions the split (plan §A9, §H item 4). --check enforces parity on the
   injected one and existence on the linked one.

   Nothing was dropped in the split, and that is checked rather than claimed:
   `node tools/guide-facts.mjs verify` enumerates the pre-split guide into
   content units and load-bearing tokens and requires every one to land in the
   session guide, the appendix or on-screen UI. It carries its own negative
   control. It is not wired into this build because it reads the pre-split
   guide out of the tree, which will not always be there; run it when the
   guide changes.

     node build.js           writes index.html, teacher-guide.html, appendix.html
     node build.js --check   verifies all three against the canonical build,
                             and that the PDF is no older than the guide;
                             writes nothing, exits 1 on any drift
*/
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const shell = require('../tools/lesson-shell');
const gc = require('../tools/lesson-shell/guide-contract');

const here = __dirname;
const S = f => fs.readFileSync(path.join(here, 'src', f), 'utf8');
const die = msg => { console.error(msg); process.exit(1); };

/* The engine is four files and the app is one. They are injected at two
   separate markers rather than concatenated into one blob, so a stack trace
   in the built file still tells you which half you are in. */
const ENGINE_MARKER = '/*__TOPPING_OUT_ENGINE__*/';
const ENGINE_FILES = ['data.js', 'engine.js', 'render4d.js', 'views.js'];

const paths = {
  index: path.join(here, 'index.html'),
  srcGuide: path.join(here, 'src', 'demo-guide.html'),
  guideOut: path.join(here, 'teacher-guide.html'),
  srcAppendix: path.join(here, 'src', 'appendix.html'),
  appendixOut: path.join(here, 'appendix.html'),
  pdfOut: path.join(here, 'Topping-Out-Instructor-Guide.pdf')
};

function buildHtml() {
  const guideSrc = S('demo-guide.html');
  const appendixSrc = S('appendix.html');
  const guide = gc.extractGuide(guideSrc);
  /* The appendix is parsed too, even though nothing is injected from it: the
     parse is what proves its scoped stylesheet has not leaked a page-level
     rule and that its markers are intact. A linked document that nothing
     validates is a document that rots. */
  gc.extractGuide(appendixSrc);

  const engine = ENGINE_FILES
    .map(f => '/* ==== ' + f + ' ==== */\n' + S(f))
    .join('\n\n');

  let html = S('template.html');
  const markers = [
    shell.MARKERS.stamp,
    shell.MARKERS.shellCss,
    shell.MARKERS.appCss,
    shell.MARKERS.guideCss,
    shell.MARKERS.shellJs,
    shell.MARKERS.app,
    shell.MARKERS.guide,
    ENGINE_MARKER
  ];
  gc.assertPlaceholders(html, markers);

  html = gc.injectOnce(html, shell.MARKERS.stamp, shell.stamp());
  html = gc.injectOnce(html, shell.MARKERS.shellCss, shell.css());
  html = gc.injectOnce(html, shell.MARKERS.appCss, S('styles.css'));
  html = gc.injectOnce(html, shell.MARKERS.guideCss, guide.css);
  html = gc.injectOnce(html, shell.MARKERS.shellJs, shell.behaviourScript());
  html = gc.injectOnce(html, ENGINE_MARKER, engine);
  html = gc.injectOnce(html, shell.MARKERS.app, S('app.js'));
  html = gc.injectOnce(html, shell.MARKERS.guide, guide.html);

  /* The engine and data files carry a CommonJS tail so node can require them
     for the test suites. Nothing is stripped — `typeof module` is undefined
     in the browser and the guards handle it — but a literal </script> inside
     any string would close the inline script tag early. This has to run after
     injection and before the reference scan, or the scan sees the escaped
     form and the browser sees the unescaped one. */
  html = html.replace(/<\/script(?=[\s>])/gi, '<\\/script');

  /* THE ALLOW LIST IS EMPTY, AND THAT IS THE CORRECT ANSWER HERE.
     assertNoExternalRefs scans script/link/img/iframe/source/video/audio/
     embed/object. It does NOT scan <a> — ADOPTING.md §5. Both of this demo's
     outbound references are <a href> links the reader may choose to follow
     (teacher-guide.html and appendix.html), so neither needs an entry, and
     adding one would assert something untrue about how they are loaded. */
  gc.assertNoExternalRefs(html, []);
  /* Nothing may be fetched at runtime. The scan strips comments, which is
     what makes it able to miss things, so it proves itself on synthetic bait
     before its silence is believed. */
  const control = gc.assertNoRuntimeLoads(html);

  return { html, guideSrc, appendixSrc, guideHtml: guide.html, control };
}

function main(argv) {
  const unknown = argv.filter(a => a !== '--check');
  if (unknown.length) die('Unknown build option: ' + unknown.join(', '));
  const { html, guideSrc, appendixSrc, guideHtml, control } = buildHtml();
  const checkOnly = argv.includes('--check');

  if (!checkOnly) {
    fs.writeFileSync(paths.index, html);
    fs.copyFileSync(paths.srcGuide, paths.guideOut);
    fs.copyFileSync(paths.srcAppendix, paths.appendixOut);
    const words = s => s.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
    console.log('built index.html (' + Math.round(html.length / 1024) + ' KB), teacher-guide.html and appendix.html');
    console.log('  lesson-shell ' + shell.stamp());
    console.log('  presenter notes injected from src/demo-guide.html: ' + words(guideHtml) + ' words (A9 band: <= 2500)');
    console.log('  appendix linked, not injected: ' + words(appendixSrc) + ' words');
    console.log('  runtime-load scan passed, proved on ' + control.controls + ' positive controls');
    console.log('NOTE: if the session guide changed, re-render the PDF: node tools/pdf.mjs');
    return 0;
  }

  const same = (file, want) => fs.existsSync(file) && fs.readFileSync(file, 'utf8') === want;
  if (!same(paths.index, html)) {
    console.error('build parity MISMATCH -- index.html differs from the canonical build. Run: node build.js');
    console.error('(the in-app presenter notes are generated from src/demo-guide.html, and the shell CSS');
    console.error(' comes from ../tools/lesson-shell, so a change to either requires a rebuild)');
    return 1;
  }
  if (!same(paths.guideOut, guideSrc)) {
    console.error('build parity MISMATCH -- teacher-guide.html differs from src/demo-guide.html. Run: node build.js');
    return 1;
  }
  if (!same(paths.appendixOut, appendixSrc)) {
    console.error('build parity MISMATCH -- appendix.html differs from src/appendix.html. Run: node build.js');
    return 1;
  }
  /* Index parity already implies this, the notes being a substring of the
     build output. Assert it directly anyway: it is the property the contract
     names, and a template edit that dropped the placeholder would otherwise
     pass silently with the notes simply absent from the app. */
  if (!fs.readFileSync(paths.index, 'utf8').includes(guideHtml)) {
    console.error('build parity MISMATCH -- the in-app presenter notes are not the session guide body. Run: node build.js');
    return 1;
  }
  /* The appendix is NOT in index.html, and that is a property worth asserting
     in the same place as its opposite: if a later edit "helpfully" injected it
     at the notes marker, the A9 word band would be silently blown and nothing
     else here would notice. */
  const appendixBody = gc.extractGuide(appendixSrc).html;
  if (fs.readFileSync(paths.index, 'utf8').includes(appendixBody)) {
    console.error('build parity MISMATCH -- the appendix has been injected into index.html. It is linked, not injected:');
    console.error('  injecting it puts 8,700 words back into a phone-sized notes overlay and blows the A9 band.');
    return 1;
  }
  if (!fs.existsSync(paths.pdfOut)) {
    console.error('build parity MISMATCH -- Topping-Out-Instructor-Guide.pdf is missing. Run: node tools/pdf.mjs');
    return 1;
  }
  /* The PDF is a render, not a copy, so it cannot be compared byte for byte.
     Freshness is the pin that is available: it must not predate the guide it
     is a picture of. Two seconds of slack absorbs a fresh checkout, which
     stamps every file at about the same instant. */
  const lag = fs.statSync(paths.srcGuide).mtimeMs - fs.statSync(paths.pdfOut).mtimeMs;
  if (lag > 2000) {
    console.error('build parity MISMATCH -- the PDF is older than src/demo-guide.html by ' +
      (lag / 1000).toFixed(0) + 's. Run: node tools/pdf.mjs');
    return 1;
  }
  console.log('build parity OK -- index.html, teacher-guide.html and the in-app presenter notes all derive');
  console.log('build parity OK -- from src/demo-guide.html; appendix.html matches src and is NOT injected;');
  console.log('build parity OK -- the PDF is no older than the guide; no files written');
  console.log('build parity OK -- lesson-shell ' + shell.stamp());
  return 0;
}

module.exports = { buildHtml, paths, ENGINE_MARKER };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
