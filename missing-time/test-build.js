'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const here = __dirname;
const read = file => fs.readFileSync(path.join(here, file), 'utf8');
const index = read('index.html');
const model = read('model.js');
const guideSrc = read('teacher-guide.html');

/* --- the tested model ships verbatim ---------------------------------------- */
assert.ok(index.includes('/* MISSING_TIME_MODEL: BEGIN */\n' + model + '\n/* MISSING_TIME_MODEL: END */'), 'the built page must embed the tested production model verbatim');
assert.ok(index.includes(model));

/* --- presenter notes ARE the printable guide -------------------------------- */
const CSS_OPEN = '<style id="guide-css">';
const cssStart = guideSrc.indexOf(CSS_OPEN);
const cssEnd = guideSrc.indexOf('</style>', cssStart);
const bodyStart = guideSrc.indexOf('<div class="guide-scope">');
const bodyEnd = guideSrc.indexOf('</div><!-- /guide -->');
assert.ok(cssStart > -1 && cssEnd > cssStart && bodyStart > -1 && bodyEnd > bodyStart, 'the canonical guide keeps its injection markers');
const guideCss = guideSrc.slice(cssStart + CSS_OPEN.length, cssEnd);
const guideBody = guideSrc.slice(bodyStart, bodyEnd) + '</div>';
assert.ok(index.includes('<!-- GUIDE: BEGIN -->' + guideBody + '<!-- GUIDE: END -->'), 'the in-app presenter notes must be the canonical guide body, verbatim');
assert.ok(index.includes('/* GUIDE_CSS: BEGIN */' + guideCss + '/* GUIDE_CSS: END */'), 'the in-app presenter notes must carry the canonical guide stylesheet, verbatim');
assert.ok(!/^\s*(?:body|html|\*|:root)\s*[,{]/m.test(guideCss), 'the injected guide stylesheet must not carry a page-level rule');
const words = text => text.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').split(/\s+/).filter(Boolean).length;
assert.ok(words(guideBody) > 600, 'the presenter notes carry the whole guide, not a summary; got ' + words(guideBody) + ' words');

/* --- CONTRACT.md Required UX surface ---------------------------------------- */
assert.ok(/<button[^>]*id="helpButton"[^>]*aria-label="Guide"/.test(index), 'the ? button must be named exactly "Guide"');
assert.ok(/<h2 id="howTitle">Guide\b/.test(index), 'the Guide overlay heading must read "Guide"');
assert.ok(/<button[^>]*id="settingsButton"[^>]*aria-label="Settings"/.test(index), 'the page must expose a Settings button');
/* Scope the label check to the menu markup. The injected guide names the same three items
   in its own prose, so a whole-document search would match itself and pass on a relabelled
   menu. (It did, until this was scoped.) */
const menuMarkup = (index.match(/<div class="menu" id="settingsMenu"[\s\S]*?<\/div>/) || [''])[0];
assert.ok(menuMarkup, 'the Settings menu markup must be findable');
assert.ok(!menuMarkup.includes('guide-scope'), 'the menu check must not be reading the injected guide');
assert.deepEqual(
  [...menuMarkup.matchAll(/(?:<\/input>|>)\s*([^<>]+?)\s*<\/(?:button|label)>/g)].map(m => m[1]),
  ['Open Presenter Notes', 'Presentation mode', 'Reset'],
  'the Settings menu must offer exactly Open Presenter Notes, Presentation mode and Reset, in that order');
assert.ok(/id="settingsMenu"[^>]*\shidden/.test(index), 'the Settings menu starts closed');
assert.ok(/id="notesOverlay"[^>]*\shidden/.test(index), 'the presenter-notes overlay starts closed');
assert.ok(!/id="howOverlay"[^>]*\shidden/.test(index), 'the Guide overlay opens on first load');
assert.ok(/id="resetButton"[^>]*>Reset</.test(index), 'Reset is a control, not just a word');
assert.ok(index.includes('freshCase(FIRST_LOAD.caseId)'), 'Reset must return the demo to the first-load case, not merely clear the current one');
assert.ok(index.includes("el('howOverlay').hidden=true;el('notesOverlay').hidden=true;freshCase"), 'Reset must close both overlays');
assert.ok(!/resetButton'\)\.onclick[^;]*presentationToggle/.test(index), 'Reset must leave Presentation mode as the presenter set it');

/* --- the demo itself, unchanged ---------------------------------------------- */
assert.match(index, /Gaps in the Rock Record/);
assert.match(index, /Myr since start/); assert.match(index, /Show supplied age evidence/); assert.match(index, /Offline classroom activity/);
assert.match(index, /surviving rock height above base in metres/);
assert.match(index, /model time in Myr since start/);
assert.match(index, /kind==='rock'\?\{lo:layer\.baseM,hi:layer\.baseM\+layer\.survivingThicknessM\}/);
assert.match(index, /chronology:\$\{section\.id\}/);
assert.match(index, /Chronology not/); assert.match(index, /yet supplied/);
assert.match(index, /Show supplied age/); assert.match(index, /evidence to scale time/);
assert.match(index, /aria-label="Sample '\+section\.label\+'/);
assert.doesNotMatch(index, /#ff4500/);
assert.doesNotMatch(index, /\.presentation \.mission,\.presentation \.reasoning,\.presentation \.ledger/);
assert.match(index, /@media\(max-width:760px\)\{\.linked\{grid-template-columns:1fr/);

/* --- offline at runtime ------------------------------------------------------ */
const scripts = [...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]);
assert.equal(scripts.length, 2, 'the standalone page has its model and controller scripts');
scripts.forEach((source, i) => new vm.Script(source, { filename: 'index.html inline script ' + (i + 1) }));
assert.ok(!/<(?:script|link|img|iframe|source|video|audio|embed|object)\b[^>]+(?:https?:)?\/\//i.test(index), 'no external runtime assets are referenced');
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon|@import|url\(\s*['"]?https?:/i.test(index), 'the page performs no network access at runtime');

console.log('PASS  verbatim model bundle, verbatim guide bundle, contract UX surface, inline-script parsing, and no runtime network access');
