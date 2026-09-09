'use strict';

/* Inhibitor Investigation build.
   `node build.js`         writes index.html and teacher-guide.html
   `node build.js --check` verifies both match the canonical build, writes nothing

   Two sources, injected verbatim so there is nothing to keep in sync by hand:
     - model.js               into the model marker (the tested model, verbatim,
                              so the page and test-model.js can never disagree)
     - src/teacher-guide.html into the guide markers, AND copied verbatim to
                              ./teacher-guide.html (the printable/PDF guide)

   The guide is canonical in src/teacher-guide.html. Its FIRST <style> block and
   its .guide-scope div are lifted into the app, so Settings -> Open Presenter
   Notes shows the printable guide with nothing to fetch at runtime. One source of
   truth: edit src/teacher-guide.html, never ./teacher-guide.html. */

const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const CHECK = process.argv.includes('--check');
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const MODEL_MARKER = '/*' + ' INHIBITOR_MODEL ' + '*/';
const GUIDE_CSS_MARKER = '/*__GUIDE_CSS__*/';
const GUIDE_MARKER = '<!--__GUIDE__-->';

const template = read(path.join(root, 'src', 'template.html'));
const model = read(path.join(root, 'model.js'));
const guideSrc = read(path.join(root, 'src', 'teacher-guide.html'));

/* Pull the guide apart. The FIRST <style> block is the one scoped to
   .guide-scope and safe to inject; the SECOND is standalone page/print chrome
   and must not leak into the app. */
const sOpen = guideSrc.indexOf('<style>');
const sClose = guideSrc.indexOf('</style>');
const gStart = guideSrc.indexOf('<div class="guide-scope">');
const gEnd = guideSrc.indexOf('</div><!-- /guide -->');
if (sOpen < 0 || sClose < 0 || gStart < 0 || gEnd < 0) throw new Error('Guide markers are missing in src/teacher-guide.html.');
const guideCss = guideSrc.slice(sOpen + '<style>'.length, sClose);
const guideHtml = guideSrc.slice(gStart, gEnd) + '</div>';
if (/^\s*(?:body|html|\*)\s*[,{]/m.test(guideCss)) throw new Error('The guide stylesheet leaks a page-level rule into the app; scope every rule to .guide-scope.');
if (/<\/script/i.test(guideHtml)) throw new Error('The guide body must not contain a script close tag.');

for (const marker of [MODEL_MARKER, GUIDE_CSS_MARKER, GUIDE_MARKER]) {
  if (!template.includes(marker)) throw new Error('Template marker is missing: ' + marker);
}
const output = template
  .replace(MODEL_MARKER, () => '/* INHIBITOR_MODEL: BEGIN */\n' + model + '\n/* INHIBITOR_MODEL: END */')
  .replace(GUIDE_CSS_MARKER, () => '/* GUIDE_CSS: BEGIN */' + guideCss + '/* GUIDE_CSS: END */')
  .replace(GUIDE_MARKER, () => '<!-- GUIDE: BEGIN -->' + guideHtml + '<!-- GUIDE: END -->');

/* A single offline file means a single file: nothing may be fetched at runtime.
   Reader-initiated <a href> source citations inside the guide are not runtime
   assets and are deliberately not matched here. */
const offenders = [];
output.replace(/<(?:script|link|img|iframe|source|video|audio|embed|object)\b[^>]*>/gi, tag => {
  if (/\b(?:src|href|data)\s*=\s*["']?(?!#)[^"'>\s]+/i.test(tag) && !/data:/i.test(tag)) offenders.push(tag.slice(0, 90));
  return tag;
});
if (offenders.length) throw new Error('Build refuses to ship an external runtime reference:\n  ' + offenders.join('\n  '));

const indexOut = path.join(root, 'index.html');
const guideOut = path.join(root, 'teacher-guide.html');
const sameIndex = fs.existsSync(indexOut) && read(indexOut) === output;
const sameGuide = fs.existsSync(guideOut) && read(guideOut) === guideSrc;

if (CHECK) {
  if (!sameIndex) throw new Error('index.html is stale. Run: node build.js');
  if (!sameGuide) throw new Error('teacher-guide.html differs from src/teacher-guide.html. Run: node build.js');
  console.log('PASS  index.html is reproducibly built from src/template.html + model.js + src/teacher-guide.html');
  console.log('PASS  in-app presenter notes and teacher-guide.html come from one source; no drift');
} else {
  fs.writeFileSync(indexOut, output);
  fs.writeFileSync(guideOut, guideSrc);
  console.log('Built inhibitor-investigation/index.html from source.');
  console.log('Copied src/teacher-guide.html to teacher-guide.html.');
}
