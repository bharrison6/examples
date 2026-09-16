/* Build should-have-known-that/index.html from src/ plus the shared lesson
   shell. Literal copy of ion-flight/build.js's shape (the kit's own worked
   example) with the file list changed — one MODEL-style marker (here
   __DATA__, for the question bank) instead of ion-flight's model.js.

     src/template.html    the app shell markup
     src/styles.css       the ACTIVITY styles (the lesson shell's are shared)
     src/data.js          the 40-question bank + sourcing metadata
     src/app.js           the view + game layer
     src/demo-guide.html  the canonical printable teacher guide
     ../tools/lesson-shell/   tokens, shell CSS, shell behaviour, version stamp

   THE SHARED KIT IS A BUILD-TIME DEPENDENCY ONLY — see ion-flight/build.js's
   head comment for the full rationale (orchestrator ruling, 2026-09-15).

   ONE SOURCE FOR THE NOTES. src/demo-guide.html is canonical for the printable
   teacher-guide.html, the rendered teacher-guide.pdf, and the in-app
   Settings -> Open Presenter Notes overlay. Nothing is fetched at runtime,
   and --check fails the moment any surface drifts.

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

const DATA_MARKER = '/*__DATA__*/';
const paths = {
  index: path.join(here, 'index.html'),
  srcGuide: path.join(here, 'src', 'demo-guide.html'),
  guideOut: path.join(here, 'teacher-guide.html'),
  pdfOut: path.join(here, 'teacher-guide.pdf'),
  readme: path.join(here, 'README.md'),
  demoJson: path.join(here, 'demo.json')
};

/* ONE COUNT, DERIVED. The number of items that carry a qualifier (and, since
   the 2026-09-16 correction pass, a scoring band) is read from src/data.js
   here, injected into the template, and then CHECKED against every prose
   surface that states it. The previous build hand-wrote that number five
   times and got it wrong five times (14 / 17 / 17 / 17 / 17 against an
   actual 23). The guide, README and demo.json cannot take an injection —
   teacher-guide.html must be byte-identical to src/demo-guide.html, and the
   other two are read by the hub as-is — so for those the build refuses to
   run until the stated number matches the derived one. */
function bankCounts() {
  const { QUESTIONS } = require(path.join(here, 'src', 'data.js'));
  const qual = QUESTIONS.filter(q => q.qualifier);
  const band = QUESTIONS.filter(q => Array.isArray(q.band));
  const linear = q => q.scale !== 'log';
  return {
    total: QUESTIONS.length,
    qualAll: qual.length,
    qualLinear: qual.filter(linear).length,
    qualLog: qual.filter(q => !linear(q)).length,
    bandAll: band.length,
    bandLinear: band.filter(linear).length,
    bandLog: band.filter(q => !linear(q)).length
  };
}
const COUNT_MARKERS = ['__QUAL_LINEAR__', '__QUAL_LOG__', '__BAND_LINEAR__'];

/* Each prose surface names its count in one fixed phrase; the regex is
   anchored on that phrase so a reworded sentence fails loudly (marker
   missing) rather than silently passing. */
const STATED = [
  { file: 'README.md', path: () => paths.readme, re: /on-screen\s+\*\*qualifier\*\*\s+to\s+(\d+)\s+of\s+the\s+40/, key: 'qualAll' },
  { file: 'README.md', path: () => paths.readme, re: /and\s+(\d+)\s+of\s+the\s+40\s+are\s+scored\s+against/, key: 'bandAll' },
  { file: 'demo.json', path: () => paths.demoJson, re: /(\d+)\s+of\s+the\s+40\s+carrying\s+an\s+on-screen\s+qualifier/, key: 'qualAll' },
  { file: 'demo.json', path: () => paths.demoJson, re: /(\d+)\s+scored\s+against\s+a\s+stated\s+range/, key: 'bandAll' },
  { file: 'src/demo-guide.html', path: () => paths.srcGuide, re: /but\s+(\d+)\s+of\s+them\s+ship\s+with\s+a\s+qualifier/, key: 'qualAll' },
  { file: 'src/demo-guide.html', path: () => paths.srcGuide, re: /(\d+)\s+of\s+the\s+40\s+are\s+scored\s+against\s+a\s+range/, key: 'bandAll' }
];
function assertStatedCounts(counts) {
  const bad = [];
  for (const s of STATED) {
    const text = fs.readFileSync(s.path(), 'utf8');
    const m = text.match(s.re);
    if (!m) { bad.push(`${s.file}: the phrase this build checks is missing (${s.re})`); continue; }
    if (Number(m[1]) !== counts[s.key]) {
      bad.push(`${s.file}: states ${m[1]} for ${s.key}, but src/data.js derives ${counts[s.key]}`);
    }
  }
  if (bad.length) die('count drift -- fix the prose to match src/data.js:\n  ' + bad.join('\n  '));
}

function buildHtml() {
  const guideSrc = S('demo-guide.html');
  const guide = gc.extractGuide(guideSrc);

  const counts = bankCounts();
  assertStatedCounts(counts);

  let html = S('template.html');
  const markers = [
    shell.MARKERS.stamp,
    shell.MARKERS.shellCss,
    shell.MARKERS.appCss,
    shell.MARKERS.guideCss,
    shell.MARKERS.shellJs,
    shell.MARKERS.app,
    shell.MARKERS.guide,
    DATA_MARKER,
    ...COUNT_MARKERS
  ];
  gc.assertPlaceholders(html, markers);

  html = gc.injectOnce(html, '__QUAL_LINEAR__', String(counts.qualLinear));
  html = gc.injectOnce(html, '__QUAL_LOG__', String(counts.qualLog));
  html = gc.injectOnce(html, '__BAND_LINEAR__', String(counts.bandLinear));

  html = gc.injectOnce(html, shell.MARKERS.stamp, shell.stamp());
  html = gc.injectOnce(html, shell.MARKERS.shellCss, shell.css());
  html = gc.injectOnce(html, shell.MARKERS.appCss, S('styles.css'));
  html = gc.injectOnce(html, shell.MARKERS.guideCss, guide.css);
  html = gc.injectOnce(html, shell.MARKERS.shellJs, shell.behaviourScript());
  html = gc.injectOnce(html, DATA_MARKER, S('data.js'));
  html = gc.injectOnce(html, shell.MARKERS.app, S('app.js'));
  html = gc.injectOnce(html, shell.MARKERS.guide, guide.html);

  /* The one permitted reference: the hyperlink to the printable guide sitting
     beside index.html (CONTRACT.md 2026-09-08 — an <a href> the reader may
     choose to follow is not a network call by the page), plus every Sources
     entry's <a href="https://..."> in the Details drawer, which
     assertNoExternalRefs never scans in the first place (ADOPTING.md §5:
     only script/link/img/iframe/source/video/audio/embed/object are scanned,
     never <a>). */
  gc.assertNoExternalRefs(html, ['teacher-guide.html']);
  const control = gc.assertNoRuntimeLoads(html);

  return { html, guideSrc, guideHtml: guide.html, control, counts };
}

function main(argv) {
  const unknown = argv.filter(a => a !== '--check');
  if (unknown.length) die('Unknown build option: ' + unknown.join(', '));
  const { html, guideSrc, guideHtml, control, counts } = buildHtml();
  const checkOnly = argv.includes('--check');
  const countLine = `qualifier count ${counts.qualAll}/${counts.total} (${counts.qualLinear} linear + ${counts.qualLog} log), ` +
    `band count ${counts.bandAll} (${counts.bandLinear} linear + ${counts.bandLog} log) -- derived from src/data.js and matched on README.md, demo.json, src/demo-guide.html`;

  if (!checkOnly) {
    fs.writeFileSync(paths.index, html);
    fs.copyFileSync(paths.srcGuide, paths.guideOut);
    console.log('built index.html (' + Math.round(html.length / 1024) + ' KB) and teacher-guide.html');
    console.log('  lesson-shell ' + shell.stamp());
    console.log('  presenter notes injected from src/demo-guide.html: ' +
      guideHtml.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length + ' words');
    console.log('  runtime-load scan passed, proved on ' + control.controls + ' positive controls');
    console.log('  ' + countLine);
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
  console.log('build parity OK -- ' + countLine);
  return 0;
}

module.exports = { buildHtml, bankCounts, paths, DATA_MARKER };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
