'use strict';
const assert = require('node:assert/strict'); const fs = require('node:fs'); const vm = require('node:vm'); const { spawnSync } = require('node:child_process');
const root = __dirname, html = fs.readFileSync(root + '/index.html', 'utf8'), model = fs.readFileSync(root + '/model.js', 'utf8').replace(/\r\n/g,'\n');
assert.ok(html.includes('/* OCCUPANCY_MODEL: BEGIN */\n'+model+'\n/* OCCUPANCY_MODEL: END */'), 'built page embeds tested production model verbatim');
assert.ok(html.includes('48 site-visits') && html.includes('ψ=0.8, p=0.25'), 'fixed effort and guarded model explanation must remain visible');
assert.ok(html.includes('relative likelihood') && html.includes('not a posterior probability'), 'inference scope must be explicit');
assert.ok(html.includes('id="interpretPanel" hidden') && html.includes('id="afterInterpretation" hidden'), 'future reasoning panels must be stage-gated');
assert.ok(html.includes('Replay as practice') && html.includes('Explore mode: truth is revealed'), 'replay and post-reveal exploration must not imply a blind new trial');
assert.ok(html.includes('occupied-missed') && html.includes('truthLegend'), 'truth reveal must visibly distinguish missed occupancy on the same site arrays');
assert.ok(html.includes('ψ 1') && html.includes('p .5'), 'likelihood grid must have visible psi and p axes');
assert.ok(html.includes('id="psiSelect"') && html.includes('id="pSelect"') && html.includes('id="likelihoodSelection"'), 'likelihood inspection must be keyboard and touch accessible without 121 tab stops');
assert.ok(html.includes('id="revealBadge"') && html.includes('AFTER REVEAL') && html.includes('id="unknownLegend"'), 'reveal state must update the case copy and non-detection legend');
assert.ok(html.includes('id="notesOverlay" hidden') && html.includes('id="notesButton"'), 'presenter notes must be openable and hidden by default');
assert.ok(!html.includes('.presentation .case,.presentation .controls'), 'presentation mode must retain survey actions');
assert.ok(html.includes("likelihoodSelection').textContent='Choose ψ and p to inspect one grid cell.';return"), 'resetting before a round must clear stale likelihood-selection text');
assert.ok(!/<(?:script|link|img|iframe)\b[^>]+(?:https?:)?\/\//i.test(html), 'no external runtime assets');
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon|@import|url\(\s*['"]?https?:/i.test(html), 'the page performs no network access at runtime');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);assert.equal(scripts.length,2);scripts.forEach((source,index)=>new vm.Script(source,{filename:'inline '+index}));

/* --- CONTRACT.md Required UX surface ---------------------------------------- */
assert.ok(/<button[^>]*id="helpButton"[^>]*aria-label="Guide"/.test(html), 'the ? button must be named exactly "Guide"');
assert.ok(/<h2 id="howTitle">Guide<\/h2>/.test(html), 'the Guide overlay heading must read "Guide"');
assert.ok(/<button[^>]*id="settingsButton"/.test(html), 'the page must expose a Settings button');
assert.ok(html.includes('>Open Presenter Notes<'), 'the Settings menu must offer "Open Presenter Notes"');
assert.ok(html.includes('> Presentation mode</label>'), 'the Settings menu must offer "Presentation mode"');
assert.ok(/id="resetButton"[^>]*>Reset</.test(html), 'the Settings menu must offer "Reset", as a control and not just a word');
assert.ok(html.includes('id="settingsMenu" hidden'), 'the Settings menu starts closed');
assert.ok(!/id="howTo"[^>]*\shidden/.test(html), 'the Guide overlay opens on first load');

/* --- Reset returns the WHOLE demo to its fresh-load state -------------------- */
assert.ok(html.includes("el('resetButton').onclick=()=>reset('all')"), 'Settings Reset must run the whole-demo reset, not the responses-only path');
const resetAll=/if\(mode==='all'\)\{([^}]*)\}/.exec(html);
assert.ok(resetAll, 'the whole-demo reset branch must exist');
for (const restore of ['seed=INITIAL_SEED', "el('inferenceHabitat').value='A'", "el('psiSelect').value='0.5'", "el('pSelect').value='0.5'", "el('inferenceView').open=false", "el('notesOverlay').hidden=true", "el('howTo').hidden=true", 'closeMenu()']) {
  assert.ok(resetAll[1].includes(restore), 'Reset must restore fresh-load state: ' + restore);
}
assert.ok(!resetAll[1].includes('presentation'), 'Reset must leave Presentation mode as the presenter set it');

/* --- presenter notes ARE the printable guide -------------------------------- */
const guideSrc = fs.readFileSync(root + '/teacher-guide.html', 'utf8').replace(/\r\n/g,'\n');
const styleTag='<style id="guide-css">', styleOpen=guideSrc.indexOf(styleTag), styleClose=guideSrc.indexOf('</style>',styleOpen);
const bodyOpen=guideSrc.indexOf('<div class="guide-scope">'), bodyClose=guideSrc.indexOf('</div><!-- /guide -->');
assert.ok(styleOpen>-1 && styleClose>styleOpen && bodyOpen>-1 && bodyClose>bodyOpen, 'the canonical guide keeps its injection markers');
const guideCss=guideSrc.slice(styleOpen+styleTag.length,styleClose).trim(), guideBody=guideSrc.slice(bodyOpen,bodyClose)+'</div>';
assert.ok(html.includes('<!-- GUIDE: BEGIN -->'+guideBody+'<!-- GUIDE: END -->'), 'the in-app presenter notes must be the canonical guide body, verbatim');
assert.ok(html.includes('/* GUIDE_CSS: BEGIN */'+guideCss+'/* GUIDE_CSS: END */'), 'the in-app presenter notes must carry the canonical guide stylesheet, verbatim');
assert.ok(!guideCss.includes('@'), 'the injected guide stylesheet must not carry an at-rule');
for (const rule of guideCss.split('}')) { const selector=rule.split('{')[0].trim(); if(!rule.includes('{')||!selector) continue; for (const part of selector.split(',')) assert.ok(part.trim().startsWith('.guide-scope'), 'injected guide rule must be scoped to .guide-scope: '+part.trim()); }
const words=text=>text.replace(/<[^>]+>/g,' ').replace(/&[a-z]+;/gi,' ').split(/\s+/).filter(Boolean).length;
assert.ok(words(guideBody)>400, 'the presenter notes carry the whole guide, not a summary; got '+words(guideBody)+' words');

const check=spawnSync(process.execPath,['build.js','--check'],{cwd:root,encoding:'utf8'});assert.equal(check.status,0,check.stderr||check.stdout);
console.log('PASS  verbatim production model, inline syntax, fixed-effort/reveal guardrails, no external runtime assets, reproducible bundle');
console.log('PASS  contract UX surface (Guide button and heading, the three Settings items), whole-demo Reset, and in-app notes verbatim equal to teacher-guide.html');
