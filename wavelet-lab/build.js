'use strict';
/* Wavelet Lab build: assemble the single offline index.html from three sources.

     src/template.html    the app shell, with the three placeholders below
     src/wavelet.js       the tested production math module, injected verbatim
     teacher-guide.html   the ONE presenter document, injected as the notes overlay

   `node build.js`         writes index.html
   `node build.js --check` verifies index.html matches the canonical build, writes nothing

   teacher-guide.html is canonical for the presenter notes AND for the printable page
   AND for teacher-guide.pdf (tools/pdf.mjs renders that same file). The in-app copy is
   produced here at build time, so there is nothing to fetch at runtime and nothing to
   keep in sync by hand; --check fails the moment the shipped page drifts from it.

   Every read is normalised to LF and the output is written with LF, so the build is
   byte-reproducible regardless of how a checkout landed line endings. */
var fs = require('fs');
var path = require('path');
var root = __dirname;
var CHECK = process.argv.indexOf('--check') >= 0;

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n'); }
function fail(message) { console.error(message); process.exit(1); }

var template = read(path.join('src', 'template.html'));
var core = read(path.join('src', 'wavelet.js'));
var guideSource = read('teacher-guide.html');

/* --- lift the presenter guide -------------------------------------------------
   The FIRST <style> block in the guide is scoped to .guide-scope and is the only
   part safe to inject; the SECOND is standalone/PDF page chrome (@page, body, the
   two-column print layout) and must never reach the app.

   Markers are located in a comment-masked copy (same length, so offsets still slice the
   original): the guide's own header comment talks ABOUT <style> and .guide-scope, and a
   naive indexOf lands inside it and injects prose into the stylesheet. */
var masked = guideSource.replace(/<!--[\s\S]*?-->/g, function (comment) { return ' '.repeat(comment.length); });
var styleOpen = masked.indexOf('<style>');
var styleClose = masked.indexOf('</style>');
var guideOpen = masked.indexOf('<div class="guide-scope">');
var guideClose = guideSource.indexOf('</div><!-- /guide -->'); // deliberately a comment: search the original
if (styleOpen < 0 || styleClose < 0 || guideOpen < 0 || guideClose < 0) {
  fail('teacher-guide.html is missing a marker build.js injects from: it needs a first\n' +
       '<style> block scoped to .guide-scope and a <div class="guide-scope"> ... </div><!-- /guide --> body.');
}
var guideCss = guideSource.slice(styleOpen + '<style>'.length, styleClose);
var guideHtml = guideSource.slice(guideOpen, guideClose) + '</div>';

/* A stylesheet containing markup means the slice picked up prose or a tag: the CSS parser
   would swallow it and silently drop the rules that follow. Fail loudly instead. */
if (guideCss.indexOf('<') >= 0) {
  fail('the lifted stylesheet contains markup, so the <style> marker matched the wrong place:\n  ' +
       guideCss.trim().slice(0, 120).replace(/\n/g, ' ') + ' ...');
}
if (guideHtml.indexOf('<div class="guide-scope">') !== 0) fail('the lifted guide body does not start at <div class="guide-scope">.');

var unscoped = guideCss.split('\n').filter(function (line) {
  var text = line.trim();
  if (!text || text.indexOf('{') < 0) return false;
  if (/^@media\b/.test(text)) return false; // a media wrapper scopes nothing by itself
  return !/^\.guide-scope(?=[\s,{:.>#[])/.test(text);
});
if (unscoped.length) {
  fail('teacher-guide.html would restyle the app: every rule in its first <style> block must\n' +
       'be scoped to .guide-scope. Move page chrome to the second block. Offending rules:\n  ' +
       unscoped.map(function (l) { return l.trim(); }).join('\n  '));
}

/* --- fill the template --------------------------------------------------------
   Function replacements, so a `$&` or `$1` inside any source stays literal. */
var slots = [
  ['/* WAVELET_CORE */', '/* WAVELET_CORE: BEGIN */\n' + core + '\n/* WAVELET_CORE: END */'],
  ['/*__GUIDE_CSS__*/', '/* GUIDE_CSS: BEGIN — generated from teacher-guide.html, do not edit here */' + guideCss + '/* GUIDE_CSS: END */'],
  ['<!--__GUIDE__-->', '<!-- GUIDE: BEGIN — generated from teacher-guide.html, do not edit here -->\n' + guideHtml + '\n<!-- GUIDE: END -->']
];
var output = template;
slots.forEach(function (slot) {
  if (output.indexOf(slot[0]) === -1) fail('src/template.html is missing the placeholder ' + slot[0]);
  output = output.replace(slot[0], function () { return slot[1]; });
});

/* --- one file means one file: nothing may be fetched at runtime --------------- */
var offenders = [];
output.replace(/<(script|link|img|iframe|source|video|audio)\b[^>]*>/gi, function (tag) {
  if (/\b(src|href)\s*=\s*["']?(?!#)[^"'>\s]+/i.test(tag) && !/data:/i.test(tag)) offenders.push(tag.slice(0, 90));
  return tag;
});
if (offenders.length) fail('build refuses to ship an external reference:\n  ' + offenders.join('\n  '));

var outPath = path.join(root, 'index.html');
if (CHECK) {
  var current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8').replace(/\r\n/g, '\n') : null;
  if (current !== output) {
    fail('index.html is not current: it differs from src/template.html + src/wavelet.js +\n' +
         'teacher-guide.html. The in-app presenter notes have drifted from the guide, or the\n' +
         'app has. Run: node build.js');
  }
  console.log('PASS  index.html is reproducibly built from src/template.html + src/wavelet.js + teacher-guide.html');
  console.log('PASS  in-app presenter notes match teacher-guide.html (same bytes, injected at build time)');
} else {
  fs.writeFileSync(outPath, output);
  console.log('Built index.html from source:', (output.length / 1024).toFixed(0) + ' KB');
  console.log('  math module   src/wavelet.js       ' + core.length + ' bytes injected verbatim');
  console.log('  presenter notes teacher-guide.html  ' + guideHtml.length + ' bytes + ' + guideCss.length + ' bytes of scoped CSS');
}
