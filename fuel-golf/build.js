/* Build fuel-golf/index.html from src/ plus the shared lesson shell.

     src/template.html    the lesson-shell markup wrapping the flight view
     src/styles.css       the ACTIVITY styles (the lesson shell's are shared)
     src/game.js          the physics core + the browser game, also required
                          by test-physics.js, which exercises the shipped code
     src/app.js           the lesson layer: stages, predictions, gates, cues,
                          and the activity half of the in-place Reset
     src/demo-guide.html  the canonical printable teacher guide
     ../tools/lesson-shell/   tokens, shell CSS, shell behaviour, version stamp

   WHY THIS FILE EXISTS AT ALL. Before the retrofit fuel-golf had no build: an
   index.html with a 497-line <style> block and a sibling <script src="game.js">
   that the browser fetched at runtime, plus tools/guide-sync.js generating the
   presenter notes back INTO index.html in place. That last arrangement made
   index.html both a source and an artefact, which is the thing a build exists
   to stop. It is retired with this file (plan A10).

   THE SHARED KIT IS A BUILD-TIME DEPENDENCY ONLY. Its CSS and behaviour are
   inlined here, so the shipped index.html is one self-contained file with zero
   <script src> and zero <link href>. CONTRACT.md's self-containment requirement
   is about the built file; it says the build must be reproducible from the
   committed sources and does not require them to live in this folder
   (orchestrator ruling, 2026-09-15). The build stamps the output with a hash of
   the kit's CSS, so this demo goes red if the kit changes under it.

   SCRIPT ORDER IS LOAD-BEARING, and the template fixes it: shell, then game,
   then app.
     * the shell first, because it takes the first-load snapshot Reset restores
       from and it must be taken before anything else has touched the chrome;
     * the game second, because it defines window.fuelGolf;
     * the lesson layer last, because it reads window.fuelGolf and window
       .lessonShell, and because its A6 click listeners must be registered
       AFTER the shell's in order to override the kit's hardcoded feedback
       prefix.

   ONE SOURCE FOR THE NOTES. src/demo-guide.html is canonical for three
   surfaces: the printable page shipped as teacher-guide.html, the rendered
   teacher-guide.pdf, and the app's Settings -> Open Presenter Notes overlay.
   Its scoped stylesheet and its .guide-scope body are lifted verbatim and
   injected, so nothing is fetched at runtime and --check fails the moment any
   surface drifts. The shipped filename stays teacher-guide.html because it is a
   public URL (demo.json -> guide).

     node build.js           writes index.html and teacher-guide.html
     node build.js --check   verifies both against the canonical build, and
                             that the PDF is no older than the guide; writes
                             nothing, exits 1 on any drift
*/
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const shell = require('../tools/lesson-shell');
const gc = require('../tools/lesson-shell/guide-contract');

const here = __dirname;
const S = f => fs.readFileSync(path.join(here, 'src', f), 'utf8');
const die = msg => { console.error(msg); process.exit(1); };

/* The game is its own marker rather than being concatenated into __APP__,
   because src/game.js is ALSO a Node module (test-physics.js requires it) and
   keeping the two separate is what lets the same bytes serve both. */
const GAME_MARKER = '/*__GAME__*/';

const paths = {
  index: path.join(here, 'index.html'),
  srcGuide: path.join(here, 'src', 'demo-guide.html'),
  guideOut: path.join(here, 'teacher-guide.html'),
  pdfOut: path.join(here, 'teacher-guide.pdf')
};

function buildHtml() {
  const guideSrc = S('demo-guide.html');
  /* Line-anchored, unique markers and the scope-leak parse both live in the
     kit. The retired guide-sync.js found its markers with plain indexOf, which
     matches the FIRST occurrence — and this guide's head comment names the
     marker several lines above the real block. */
  const guide = gc.extractGuide(guideSrc);

  let html = S('template.html');
  const markers = [
    shell.MARKERS.stamp,
    shell.MARKERS.shellCss,
    shell.MARKERS.appCss,
    shell.MARKERS.guideCss,
    shell.MARKERS.shellJs,
    shell.MARKERS.app,
    shell.MARKERS.guide,
    GAME_MARKER
  ];
  gc.assertPlaceholders(html, markers);

  /* Each injection is exactly-once and uses a function replacement, because a
     dollar-sign substitution pattern in the injected text would otherwise be
     eaten by String.replace. injectOnce does both. */
  html = gc.injectOnce(html, shell.MARKERS.stamp, shell.stamp());
  html = gc.injectOnce(html, shell.MARKERS.shellCss, shell.css());
  html = gc.injectOnce(html, shell.MARKERS.appCss, S('styles.css'));
  html = gc.injectOnce(html, shell.MARKERS.guideCss, guide.css);
  html = gc.injectOnce(html, shell.MARKERS.shellJs, shell.behaviourScript());
  html = gc.injectOnce(html, GAME_MARKER, S('game.js'));
  html = gc.injectOnce(html, shell.MARKERS.app, S('app.js'));
  html = gc.injectOnce(html, shell.MARKERS.guide, guide.html);

  /* The one permitted reference is the hyperlink to the printable guide sitting
     beside index.html. CONTRACT.md 2026-09-08: an <a href> the reader may
     choose to follow is not a network call by the page. Note the allow-list is
     for a same-folder file referenced by one of the SCANNED tags — <a> is not
     scanned at all, so the Details drawer's Sources links need no entry here
     (ADOPTING.md section 5). */
  gc.assertNoExternalRefs(html, ['teacher-guide.html']);
  /* And nothing may be fetched at runtime. The scan strips comments, which is
     what makes it able to miss things, so it proves itself on synthetic bait
     before its silence is believed. */
  const control = gc.assertNoRuntimeLoads(html);

  return { html, guideSrc, guideHtml: guide.html, control };
}

function main(argv) {
  const unknown = argv.filter(a => a !== '--check');
  if (unknown.length) die('Unknown build option: ' + unknown.join(', '));
  const { html, guideSrc, guideHtml, control } = buildHtml();
  const checkOnly = argv.includes('--check');

  if (!checkOnly) {
    fs.writeFileSync(paths.index, html);
    fs.copyFileSync(paths.srcGuide, paths.guideOut);
    console.log('built index.html (' + Math.round(html.length / 1024) + ' KB) and teacher-guide.html');
    console.log('  lesson-shell ' + shell.stamp());
    console.log('  presenter notes injected from src/demo-guide.html: ' +
      guideHtml.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length + ' words');
    console.log('  runtime-load scan passed, proved on ' + control.controls + ' positive controls');
    console.log('NOTE: if the guide changed, re-render the PDF: node tools/pdf.mjs');
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
  /* Index parity already implies this, the notes being a substring of the build
     output. Assert it directly anyway: it is the property the contract names,
     and a template edit that dropped the placeholder would otherwise pass
     silently with the notes simply absent from the app. */
  if (!fs.readFileSync(paths.index, 'utf8').includes(guideHtml)) {
    console.error('build parity MISMATCH -- the in-app presenter notes are not the guide body. Run: node build.js');
    return 1;
  }
  /* The PDF is a render, not a copy, so it cannot be compared byte for byte.
     Freshness is the pin that is available: it must not predate the guide it is
     a picture of. Two seconds of slack absorbs a fresh checkout, which stamps
     every file at about the same instant. */
  if (!fs.existsSync(paths.pdfOut)) {
    console.error('build parity MISMATCH -- teacher-guide.pdf is missing. Run: node tools/pdf.mjs');
    return 1;
  }
  const lag = fs.statSync(paths.srcGuide).mtimeMs - fs.statSync(paths.pdfOut).mtimeMs;
  if (lag > 2000) {
    console.error('build parity MISMATCH -- teacher-guide.pdf is older than src/demo-guide.html by ' +
      (lag / 1000).toFixed(0) + 's. Run: node tools/pdf.mjs');
    return 1;
  }
  console.log('build parity OK -- index.html, teacher-guide.html and the in-app presenter notes all derive');
  console.log('build parity OK -- from src/demo-guide.html, and the PDF is no older than it; no files written');
  console.log('build parity OK -- lesson-shell ' + shell.stamp());
  return 0;
}

module.exports = { buildHtml, paths, GAME_MARKER };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
