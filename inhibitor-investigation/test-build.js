'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = file => fs.readFileSync(__dirname + '/' + file, 'utf8').replace(/\r\n/g, '\n');
const html = read('index.html');
const model = read('model.js');
const guideSrc = read('src/teacher-guide.html');

/* --- the tested model ships verbatim --------------------------------------- */
assert.ok(html.includes('/* INHIBITOR_MODEL: BEGIN */\n' + model + '\n/* INHIBITOR_MODEL: END */'), 'built page must embed the tested production model verbatim');
assert.ok(html.includes('M.baselineRate'), 'the chart must call the production calibrated-baseline function');
assert.ok(html.includes('newSampleButton'), 'the page must expose a fresh mystery sample control');

/* --- presenter notes ARE the printable guide -------------------------------- */
const gStart = guideSrc.indexOf('<div class="guide-scope">');
const gEnd = guideSrc.indexOf('</div><!-- /guide -->');
const sOpenMatch = /^<style>$/m.exec(guideSrc);  // line-anchored, as build.js does
const sOpen = sOpenMatch ? sOpenMatch.index : -1;
const sClose = guideSrc.indexOf('</style>', sOpen);
assert.ok(gStart > -1 && gEnd > gStart && sOpen > -1 && sClose > sOpen, 'the canonical guide keeps its injection markers');
const guideBody = guideSrc.slice(gStart, gEnd) + '</div>';
const guideCss = guideSrc.slice(sOpen + '<style>'.length, sClose);
assert.ok(html.includes('<!-- GUIDE: BEGIN -->' + guideBody + '<!-- GUIDE: END -->'), 'the in-app presenter notes must be the canonical guide body, verbatim');
assert.ok(html.includes('/* GUIDE_CSS: BEGIN */' + guideCss + '/* GUIDE_CSS: END */'), 'the in-app presenter notes must carry the canonical guide stylesheet, verbatim');
assert.equal(read('teacher-guide.html'), guideSrc, 'the shipped printable guide must equal src/teacher-guide.html');
assert.ok(!/^\s*(?:body|html|\*)\s*[,{]/m.test(guideCss), 'the injected guide stylesheet must not carry a page-level rule');
const words = text => text.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').split(/\s+/).filter(Boolean).length;
assert.ok(words(guideBody) > 400, 'the presenter notes carry the whole guide, not a summary; got ' + words(guideBody) + ' words');

/* --- CONTRACT.md Required UX surface ---------------------------------------- */
assert.ok(/<button[^>]*id="helpButton"[^>]*aria-label="Guide"/.test(html), 'the ? button must be named exactly "Guide"');
assert.ok(/<h2 id="howTitle">Guide\b/.test(html), 'the Guide overlay heading must read "Guide"');
assert.ok(/<button[^>]*id="settingsButton"/.test(html), 'the page must expose a Settings button');
// Scoped to the Settings menu block: the injected guide's prose also names these
// labels, so a document-wide search would match its own answer key.
const menuStart = html.indexOf('id="settingsMenu"');
assert.ok(menuStart > 0, 'the page must expose the Settings menu');
const menu = html.slice(menuStart, html.indexOf('</div>', menuStart));
assert.ok(!menu.includes('guide-scope'), 'the Settings menu block must not contain the injected guide');
for (const label of ['Open Presenter Notes', 'Presentation mode', 'Reset']) {
  assert.ok(menu.includes('>' + label + '<') || menu.includes('> ' + label + '</label>'), 'the Settings menu must offer "' + label + '"');
}
assert.ok(!/GUIDE_CSS: BEGIN \*\/[^{]*[<]/.test(html.slice(html.indexOf('/* GUIDE_CSS: BEGIN */'), html.indexOf('/* GUIDE_CSS: END */'))), 'the injected guide stylesheet must contain no markup');
assert.ok(/id="settingsMenu"[^>]*hidden/.test(html), 'the Settings menu starts closed');
assert.ok(/id="presenterNotes"[^>]*hidden/.test(html), 'the presenter-notes overlay starts closed');
assert.ok(!/id="howTo"[^>]*\shidden/.test(html), 'the Guide overlay opens on first load');
assert.ok(/id="resetButton"[^>]*>Reset</.test(html), 'Reset is a control, not just a word');
assert.ok(html.includes('freshSample(FIRST_LOAD.bench, FIRST_LOAD.explanation, FIRST_LOAD.transfer)'), 'Reset must restore the first-load bench, conclusion and transfer copy on a new sample');

/* --- offline at runtime ------------------------------------------------------ */
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]);
assert.equal(scripts.length, 2, 'the standalone page has its model and controller scripts');
scripts.forEach((source, index) => new vm.Script(source, { filename: 'index.html inline script ' + (index + 1) }));
assert.ok(!/<(?:script|link|img|iframe|source|video|audio|embed|object)\b[^>]+(?:https?:)?\/\//i.test(html), 'no external runtime assets are referenced');
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon|@import|url\(\s*['"]?https?:/i.test(html), 'the page performs no network access at runtime');

console.log('PASS  verbatim model bundle, verbatim guide bundle, contract UX surface, inline-script parsing, and no runtime network access');
