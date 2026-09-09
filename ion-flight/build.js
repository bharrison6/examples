/* Build ion-flight/index.html from its three checked-in sources:

     app.template.html   the app shell, styles and view code
     model.js            the physics/lesson model, also required by test-model.js
     teacher-guide.html  the canonical printable teacher guide

   The guide is the single source for the in-app presenter notes. Its style block
   tagged id="guide-css" (every rule scoped to .guide-scope) and its
   <div class="guide-scope"> ... </div><!-- /guide --> body are lifted verbatim
   into the app at /*__GUIDE_CSS__* / and <!--__GUIDE__-->, so Settings ->
   Open Presenter Notes shows exactly the printed document with nothing to
   fetch at runtime. Edit teacher-guide.html; never edit the copy in index.html.

     node build.js           writes index.html
     node build.js --check   fails (exit 1) if index.html has drifted from the
                             sources, writes nothing

   Because --check recomputes the bundle, editing the guide without rebuilding
   is a check failure: the notes cannot silently fork from the guide.
*/
const fs = require('node:fs');
const path = require('node:path');

const here = __dirname;
const paths = {
  template: path.join(here, 'app.template.html'),
  model: path.join(here, 'model.js'),
  guide: path.join(here, 'teacher-guide.html'),
  index: path.join(here, 'index.html')
};
const markers = {
  model: '/*__ION_FLIGHT_MODEL__*/',
  guideCss: '/*__GUIDE_CSS__*/',
  guideHtml: '<!--__GUIDE__-->'
};

const read = file => fs.readFileSync(file, 'utf8');

/* Pull the two injectable pieces out of the printable guide. The second
   <style> block is page chrome for the standalone file and must not leak into
   the app, so only the first one is taken. */
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
  return { css, html };
}

/* One file means one file: the built page may not reach the network for
   anything it needs to render. Outbound <a> reading links are the point of the
   sources section and are left alone. */
function assertOffline(html) {
  const offenders = [];
  html.replace(/<(script|link|img|iframe|source|video|audio|embed|object)\b[^>]*>/gi, tag => {
    if (/\b(src|href|data)\s*=\s*["']?(?!#)[^"'>\s]+/i.test(tag) && !/data:/i.test(tag)) offenders.push(tag.slice(0, 90));
    return tag;
  });
  if (offenders.length) {
    throw new Error('build refuses to ship an external reference:\n  ' + offenders.join('\n  '));
  }
}

function buildHtml() {
  const template = read(paths.template);
  for (const marker of Object.values(markers)) {
    if (!template.includes(marker)) throw new Error(`app.template.html is missing the marker ${marker}`);
  }
  const guide = extractGuide(read(paths.guide));
  const html = template
    .replace(markers.model, () => read(paths.model))
    .replace(markers.guideCss, () => guide.css)
    .replace(markers.guideHtml, () => guide.html);
  assertOffline(html);
  return html;
}

function main(argv) {
  const unknown = argv.filter(arg => arg !== '--check');
  if (unknown.length) throw new Error(`Unknown build option: ${unknown.join(', ')}`);
  const output = buildHtml();
  if (!argv.includes('--check')) {
    fs.writeFileSync(paths.index, output);
    console.log('Built ion-flight/index.html from app.template.html + model.js + teacher-guide.html');
    return 0;
  }
  const current = fs.existsSync(paths.index) ? read(paths.index) : null;
  if (current !== output) {
    console.error('ion-flight/index.html is out of date; run: node build.js');
    console.error('(the in-app presenter notes are generated from teacher-guide.html, so editing the guide requires a rebuild)');
    return 1;
  }
  console.log('ion-flight/index.html is current (read-only check); in-app presenter notes match teacher-guide.html.');
  return 0;
}

module.exports = { buildHtml, extractGuide, assertOffline, paths, markers };

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
