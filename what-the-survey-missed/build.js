'use strict';

/* Build what-the-survey-missed/index.html from its three checked-in sources:

     app.template.html   the app shell, styles and view code
     model.js            the occupancy model, also required by test-model.js
     teacher-guide.html  the canonical printable teacher guide

   The guide is the single source for the in-app presenter notes. Its style
   block tagged id="guide-css" (every rule scoped to .guide-scope) and its
   <div class="guide-scope"> ... </div><!-- /guide --> body are lifted verbatim
   into the app, so Settings -> Open Presenter Notes shows exactly the printed
   document with nothing to fetch at runtime. Edit teacher-guide.html; never
   edit the copy that lands in index.html.

     node build.js           writes index.html
     node build.js --check   fails (exit 1) if index.html has drifted from the
                             sources, writes nothing

   Because --check recomputes the whole bundle, editing the guide without
   rebuilding is a check failure: the notes cannot silently fork from the guide.
*/

const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const paths = {
  template: path.join(root, 'app.template.html'),
  model: path.join(root, 'model.js'),
  guide: path.join(root, 'teacher-guide.html'),
  index: path.join(root, 'index.html')
};
const markers = {
  model: '/* OCCUPANCY_MODEL */',
  guideCss: '/*__GUIDE_CSS__*/',
  guideHtml: '<!--__GUIDE__-->'
};

const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const countOf = (haystack, needle) => haystack.split(needle).length - 1;

/* Pull the two injectable pieces out of the printable guide. The second <style>
   block is page chrome for the standalone file and must not leak into the app,
   so the block is located by its id rather than by the first "<style>" in the
   file -- a literal <style> inside the head comment would otherwise start the
   slice inside that comment. */
function extractGuide(source) {
  const styleTag = '<style id="guide-css">';
  const styleOpen = source.indexOf(styleTag);
  const styleClose = source.indexOf('</style>', styleOpen);
  const bodyOpen = source.indexOf('<div class="guide-scope">');
  const bodyClose = source.indexOf('</div><!-- /guide -->');
  if (styleOpen < 0 || styleClose < 0 || bodyOpen < 0 || bodyClose < 0) {
    throw new Error('teacher-guide.html is missing the id="guide-css" style block or the .guide-scope markers build.js injects from.');
  }
  const css = source.slice(styleOpen + styleTag.length, styleClose).trim();
  const html = source.slice(bodyOpen, bodyClose) + '</div>';

  /* The injected stylesheet lands inside an app that has its own. Anything not
     scoped to .guide-scope would restyle the demo, so refuse it here rather
     than discover it on a projector. */
  if (css.includes('@')) {
    throw new Error('the injectable guide stylesheet may not contain at-rules; keep @page and @media in the second <style> block.');
  }
  for (const rule of css.split('}')) {
    const selector = rule.split('{')[0].trim();
    if (!rule.includes('{') || !selector) continue;
    for (const part of selector.split(',')) {
      if (!part.trim().startsWith('.guide-scope')) {
        throw new Error(`guide stylesheet rule is not scoped to .guide-scope: ${part.trim()}`);
      }
    }
  }
  if (/<\/script/i.test(html)) throw new Error('the guide body must not contain a script close tag.');
  return { css, html };
}

/* One file means one file: the built page may not reach the network for
   anything it needs to render. Reader-initiated <a href> source citations
   inside the guide are not runtime assets and are deliberately not matched. */
function assertOffline(html) {
  const offenders = [];
  html.replace(/<(script|link|img|iframe|source|video|audio|embed|object)\b[^>]*>/gi, tag => {
    if (/\b(src|href|data)\s*=\s*["']?(?!#)[^"'>\s]+/i.test(tag) && !/data:/i.test(tag)) offenders.push(tag.slice(0, 90));
    return tag;
  });
  if (offenders.length) throw new Error('build refuses to ship an external runtime reference:\n  ' + offenders.join('\n  '));
}

function buildHtml() {
  const template = read(paths.template);
  /* String.replace substitutes the FIRST occurrence only, so a marker that also
     appears in a comment would swallow the payload silently. Require exactly
     one of each. */
  for (const [name, marker] of Object.entries(markers)) {
    const seen = countOf(template, marker);
    if (seen !== 1) throw new Error(`app.template.html must contain the ${name} marker ${marker} exactly once; found ${seen}.`);
  }
  const guide = extractGuide(read(paths.guide));
  /* Function replacements: the injected text contains "$" (and could contain
     "$&"), which a string replacement would consume. */
  const html = template
    .replace(markers.model, () => '/* OCCUPANCY_MODEL: BEGIN */\n' + read(paths.model) + '\n/* OCCUPANCY_MODEL: END */')
    .replace(markers.guideCss, () => '/* GUIDE_CSS: BEGIN */' + guide.css + '/* GUIDE_CSS: END */')
    .replace(markers.guideHtml, () => '<!-- GUIDE: BEGIN -->' + guide.html + '<!-- GUIDE: END -->');
  assertOffline(html);
  return html;
}

function main(argv) {
  const unknown = argv.filter(arg => arg !== '--check');
  if (unknown.length) throw new Error(`Unknown build option: ${unknown.join(', ')}`);
  const output = buildHtml();
  if (!argv.includes('--check')) {
    fs.writeFileSync(paths.index, output);
    console.log('Built what-the-survey-missed/index.html from app.template.html + model.js + teacher-guide.html');
    return 0;
  }
  const current = fs.existsSync(paths.index) ? read(paths.index) : null;
  if (current !== output) {
    console.error('what-the-survey-missed/index.html is out of date; run: node build.js');
    console.error('(the in-app presenter notes are generated from teacher-guide.html, so editing the guide requires a rebuild)');
    return 1;
  }
  console.log('PASS  index.html is reproducibly built from app.template.html + model.js + teacher-guide.html');
  console.log('PASS  in-app presenter notes and teacher-guide.html come from one source; no drift');
  return 0;
}

module.exports = { buildHtml, extractGuide, assertOffline, paths, markers };

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
