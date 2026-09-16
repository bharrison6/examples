/* Build bridge-works/index.html from src/ plus the shared lesson shell.

     src/template.html    the lesson-shell markup wrapping the one activity
     src/styles.css       the ACTIVITY styles (the lesson shell's are shared)
     src/game.js          the browser game: rendering, interaction, test flow
     src/app.js           the lesson layer: stages, the before-every-test call,
                          cues, the A6 override, the lesson half of Reset
     src/demo-guide.html  the canonical printable teacher guide
     physics.js           the solver — at the demo ROOT, unchanged, because
     levels.js            test-physics.js requires both from there and that
                          suite has to keep passing byte-for-byte unchanged
     ../tools/lesson-shell/   tokens, shell CSS, shell behaviour, version stamp

   WHY THIS FILE EXISTS. Before the retrofit bridge-works had no build:
   index.html loaded physics.js, levels.js and game.js as three sibling
   <script src> tags at runtime, tools/guide-sync.js wrote the presenter notes
   back INTO index.html in place, and sync-standalone.js produced a second
   copy of the whole game (bridge-works-standalone.html) by inlining the three
   scripts. That made index.html both a source and an artefact, and the
   standalone a fork of it. Both scripts retire with this file (plan A10): the
   kit's self-contained index.html IS the standalone now.

   THE SHARED KIT IS A BUILD-TIME DEPENDENCY ONLY. Its CSS and behaviour are
   inlined here, so the shipped index.html is one self-contained file with zero
   <script src> and zero <link href>. The build stamps the output with a hash of
   the kit's CSS, so this demo goes red if the kit changes under it.

   SCRIPT ORDER IS LOAD-BEARING, and the template fixes it: shell, physics,
   levels, game, app.
     * the shell first, because it takes the first-load snapshot Reset restores
       from and that must precede anything else touching the chrome;
     * the two engine files next (window.BW, window.BWLEVELS), then the game
       (window.bridgeWorks), then the lesson layer, whose A6 click listeners
       must register AFTER the shell's to override the kit's hardcoded prefix.

   FIVE SCRIPT BLOCKS GO IN, FIVE REAL CLOSERS MUST COME OUT. topping-out
   shipped a page that ran no JavaScript at all with an empty console: its
   build escaped "</script>" document-wide and ate the template's own closers,
   and every static check stayed green. So this build counts the closers in the
   assembled page and refuses on any number but five, and proves the count on
   bait first (a copy with one closer removed must be refused).

   ONE SOURCE FOR THE NOTES. src/demo-guide.html is canonical for three
   surfaces: the printable page shipped as teacher-guide.html, the rendered
   teacher-guide.pdf, and Settings -> Open Presenter Notes. The shipped filename
   stays teacher-guide.html because it is a public URL (demo.json -> guide).

     node build.js           writes index.html and teacher-guide.html
     node build.js --check   verifies both against the canonical build and
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
const R = f => fs.readFileSync(path.join(here, f), 'utf8');
const die = msg => { console.error(msg); process.exit(1); };

/* The engine and the game are their own markers rather than being concatenated
   into __APP__: physics.js and levels.js are ALSO Node modules (test-physics.js
   requires them), and keeping each file separate is what lets the same bytes
   serve both. Spelled as concatenations so this comment cannot end itself. */
const C0 = '/' + '*', C1 = '*' + '/';
const PHYSICS_MARKER = C0 + '__PHYSICS__' + C1;
const LEVELS_MARKER = C0 + '__LEVELS__' + C1;
const GAME_MARKER = C0 + '__GAME__' + C1;
const EXPECTED_SCRIPT_CLOSERS = 5;

const paths = {
  index: path.join(here, 'index.html'),
  srcGuide: path.join(here, 'src', 'demo-guide.html'),
  guideOut: path.join(here, 'teacher-guide.html'),
  pdfOut: path.join(here, 'teacher-guide.pdf')
};

const closerCount = html => (html.match(/<\/script>/g) || []).length;

function assertScriptClosers(html) {
  /* Bait first: a copy with one closer removed must be refused, or the check
     proves nothing when it is quiet. */
  const bait = html.replace('</script>', '');
  if (closerCount(bait) !== EXPECTED_SCRIPT_CLOSERS - 1) {
    die('script-closer check failed its own control: bait counted ' + closerCount(bait));
  }
  const n = closerCount(html);
  if (n !== EXPECTED_SCRIPT_CLOSERS) {
    die('build refuses to ship a document with ' + n + ' real </script> closers (expected ' +
        EXPECTED_SCRIPT_CLOSERS + '). A page with too few ends inside an unterminated script and runs\n' +
        '  NOTHING, with an empty console — topping-out shipped exactly that and every static check passed.');
  }
  /* And no injected source may itself contain a closer, which would end its
     block early and start the browser parsing JavaScript as HTML. */
  for (const [name, text] of [['physics.js', R('physics.js')], ['levels.js', R('levels.js')],
                              ['src/game.js', S('game.js')], ['src/app.js', S('app.js')]]) {
    if (/<\/script/i.test(text)) die(name + ' contains a literal </' + 'script — it would close its own block early');
  }
  return n;
}

function buildHtml() {
  const guideSrc = S('demo-guide.html');
  const guide = gc.extractGuide(guideSrc);

  let html = S('template.html');
  const markers = [
    shell.MARKERS.stamp, shell.MARKERS.shellCss, shell.MARKERS.appCss, shell.MARKERS.guideCss,
    shell.MARKERS.shellJs, shell.MARKERS.app, shell.MARKERS.guide,
    PHYSICS_MARKER, LEVELS_MARKER, GAME_MARKER
  ];
  gc.assertPlaceholders(html, markers);

  /* Each injection is exactly-once and uses a function replacement, because a
     dollar-sign substitution pattern in the injected text (money() builds
     '$' + value) would otherwise be eaten by String.replace. injectOnce does
     both. */
  html = gc.injectOnce(html, shell.MARKERS.stamp, shell.stamp());
  html = gc.injectOnce(html, shell.MARKERS.shellCss, shell.css());
  html = gc.injectOnce(html, shell.MARKERS.appCss, S('styles.css'));
  html = gc.injectOnce(html, shell.MARKERS.guideCss, guide.css);
  html = gc.injectOnce(html, shell.MARKERS.shellJs, shell.behaviourScript());
  html = gc.injectOnce(html, PHYSICS_MARKER, R('physics.js'));
  html = gc.injectOnce(html, LEVELS_MARKER, R('levels.js'));
  html = gc.injectOnce(html, GAME_MARKER, S('game.js'));
  html = gc.injectOnce(html, shell.MARKERS.app, S('app.js'));
  html = gc.injectOnce(html, shell.MARKERS.guide, guide.html);

  /* The one permitted reference is the hyperlink to the printable guide beside
     index.html. <a> is not scanned at all, so the Details drawer's Sources
     links need no entry here (ADOPTING.md section 5). */
  gc.assertNoExternalRefs(html, ['teacher-guide.html']);
  const control = gc.assertNoRuntimeLoads(html);
  const closers = assertScriptClosers(html);

  return { html, guideSrc, guideHtml: guide.html, control, closers };
}

function main(argv) {
  const unknown = argv.filter(a => a !== '--check');
  if (unknown.length) die('Unknown build option: ' + unknown.join(', '));
  const { html, guideSrc, guideHtml, control, closers } = buildHtml();
  const checkOnly = argv.includes('--check');
  const words = guideHtml.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;

  if (!checkOnly) {
    fs.writeFileSync(paths.index, html);
    fs.copyFileSync(paths.srcGuide, paths.guideOut);
    console.log('built index.html (' + Math.round(html.length / 1024) + ' KB) and teacher-guide.html');
    console.log('  lesson-shell ' + shell.stamp());
    console.log('  presenter notes injected from src/demo-guide.html: ' + words + ' words (A9 band <= 2,500)');
    console.log('  runtime-load scan passed, proved on ' + control.controls + ' positive controls');
    console.log('  ' + closers + ' real </' + 'script> closers, as expected, control tripped on bait');
    console.log('NOTE: if the guide changed, re-render the PDF: node tools/pdf.mjs');
    return 0;
  }

  const same = (file, want) => fs.existsSync(file) && fs.readFileSync(file, 'utf8') === want;
  if (!same(paths.index, html)) {
    console.error('build parity MISMATCH -- index.html differs from the canonical build. Run: node build.js');
    return 1;
  }
  if (!same(paths.guideOut, guideSrc)) {
    console.error('build parity MISMATCH -- teacher-guide.html differs from src/demo-guide.html. Run: node build.js');
    return 1;
  }
  if (!fs.readFileSync(paths.index, 'utf8').includes(guideHtml)) {
    console.error('build parity MISMATCH -- the in-app presenter notes are not the guide body. Run: node build.js');
    return 1;
  }
  if (words > 2500) {
    console.error('build parity MISMATCH -- the guide is ' + words + ' words; the A9 band is <= 2,500');
    return 1;
  }
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
  console.log('build parity OK -- lesson-shell ' + shell.stamp() + '; ' + closers + ' script closers; guide ' + words + ' words');
  return 0;
}

module.exports = { buildHtml, paths, EXPECTED_SCRIPT_CLOSERS };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
