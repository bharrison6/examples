'use strict';

/* Gaps in the Rock Record (missing-time) build.
   `node build.js`         writes index.html
   `node build.js --check` verifies index.html matches the canonical build, writes nothing

   Two sources, injected verbatim so there is nothing to keep in sync by hand:
     - model.js           into the model marker (the tested model, verbatim, so the page
                          and test-model.js can never disagree)
     - teacher-guide.html into the guide markers: its `guide-css` stylesheet and its
                          .guide-scope body become the in-app presenter notes

   teacher-guide.html is canonical and stays canonical: it is the printable guide, the
   source of teacher-guide.pdf (tools/pdf.mjs), and the source of the notes overlay. There
   is no second copy to drift, and --check fails if index.html has fallen behind it. */

const fs = require('node:fs');
const path = require('node:path');
const here = __dirname;
const CHECK = process.argv.includes('--check');
const read = file => fs.readFileSync(path.join(here, file), 'utf8');

const MODEL_MARKER = '/*__MISSING_TIME_MODEL__*/';
const GUIDE_CSS_MARKER = '/*__GUIDE_CSS__*/';
const GUIDE_MARKER = '<!--__GUIDE__-->';

const template = read('app.template.html');
const model = read('model.js');
const guideSrc = read('teacher-guide.html');

/* Locate the guide stylesheet by an explicit id, never by indexOf('<style>'): the guide's
   head comment talks about its own stylesheets, and a bare search would start inside that
   comment and ship a broken first rule. */
const CSS_OPEN = '<style id="guide-css">';
const cssStart = guideSrc.indexOf(CSS_OPEN);
const cssEnd = cssStart < 0 ? -1 : guideSrc.indexOf('</style>', cssStart);
const bodyStart = guideSrc.indexOf('<div class="guide-scope">');
const bodyEnd = guideSrc.indexOf('</div><!-- /guide -->');
if (cssStart < 0 || cssEnd < 0 || bodyStart < 0 || bodyEnd < 0) throw new Error('Guide markers are missing in teacher-guide.html (need <style id="guide-css"> ... </style> and <div class="guide-scope"> ... </div><!-- /guide -->).');
const guideCss = guideSrc.slice(cssStart + CSS_OPEN.length, cssEnd);
const guideHtml = guideSrc.slice(bodyStart, bodyEnd) + '</div>';

/* The stylesheet is injected into the running app, so a page-level rule there would
   repaint the demo. Refuse the build rather than ship it. */
if (/^\s*(?:body|html|\*|:root)\s*[,{]/m.test(guideCss)) throw new Error('The guide stylesheet leaks a page-level rule into the app; scope every rule to .guide-scope.');
if (/<\/style/i.test(guideCss)) throw new Error('The guide stylesheet must not contain a style close tag.');
if (/<\/script/i.test(guideHtml)) throw new Error('The guide body must not contain a script close tag.');

/* String.replace substitutes only the FIRST occurrence, so a marker that also appeared in
   a comment would silently swallow the payload. Require exactly one of each. */
const occurrences = (haystack, needle) => haystack.split(needle).length - 1;
for (const marker of [MODEL_MARKER, GUIDE_CSS_MARKER, GUIDE_MARKER]) {
  const n = occurrences(template, marker);
  if (n !== 1) throw new Error('app.template.html must contain exactly one ' + marker + '; found ' + n + '.');
}

/* Replacements are functions, not strings: `$&`, `` $` ``, `$'` and `$$` inside the model
   or the guide would otherwise be eaten by String.replace's substitution patterns. */
const output = template
  .replace(MODEL_MARKER, () => '/* MISSING_TIME_MODEL: BEGIN */\n' + model + '\n/* MISSING_TIME_MODEL: END */')
  .replace(GUIDE_CSS_MARKER, () => '/* GUIDE_CSS: BEGIN */' + guideCss + '/* GUIDE_CSS: END */')
  .replace(GUIDE_MARKER, () => '<!-- GUIDE: BEGIN -->' + guideHtml + '<!-- GUIDE: END -->');

/* A single offline file means a single file: nothing may be fetched at runtime.
   Reader-initiated <a href> source citations inside the guide are not runtime assets and
   are deliberately not matched here. */
const offenders = [];
output.replace(/<(?:script|link|img|iframe|source|video|audio|embed|object)\b[^>]*>/gi, tag => {
  if (/\b(?:src|href|data)\s*=\s*["']?(?!#)[^"'>\s]+/i.test(tag) && !/data:/i.test(tag)) offenders.push(tag.slice(0, 90));
  return tag;
});
if (offenders.length) throw new Error('Build refuses to ship an external runtime reference:\n  ' + offenders.join('\n  '));

const indexPath = path.join(here, 'index.html');

if (CHECK) {
  if (!fs.existsSync(indexPath) || fs.readFileSync(indexPath, 'utf8') !== output) throw new Error('index.html is not the reproducible bundle. Run: node build.js');
  console.log('PASS  index.html is reproducibly built from app.template.html + model.js + teacher-guide.html');
  console.log('PASS  in-app presenter notes and teacher-guide.html come from one source; no drift');
} else {
  fs.writeFileSync(indexPath, output);
  console.log('Built index.html from model.js, teacher-guide.html and app.template.html.');
}
