/* UI smoke test: drives the real interface headlessly and asserts the
   behaviours students depend on. node ui-smoke.js

   PORTED 2026-09-16 onto lesson-shell v2, AND NOT EXECUTED. Playwright is not
   installed on the machine this port was written on, so neither the old suite
   nor this one could be run. The first run after `npm install playwright` is a
   BRING-UP, not a regression signal: expect to fix selectors here before
   treating a failure as a defect in the demo. What WAS verified on this build,
   and is the substitute evidence for it:
     * node test-bundle.js  - 60 structural checks on the built page, each group
       with a negative control (this one runs, and runs everywhere);
     * node test-physics.js - 41/41 against the shipped engine;
     * a live browser pass - every stage asserted rendering, both gates driven
       open through their real controls, Level 3 flown to completion, the
       in-place Reset proved with a window sentinel and navigation-entry count,
       console clean with a positive control on a bait page.

   WHAT CHANGED IN THE PORT. The demo no longer owns a Guide dialog, a Settings
   dialog, a notes overlay, a projector toggle, a focus trap, an inerting
   routine or a top bar - the lesson shell owns all of them, and the demo's own
   four dialogs are native <dialog>. Assertions that tested the demo's
   hand-rolled implementations of those are replaced by assertions about the
   BEHAVIOUR, because the implementation is now the platform's.

   ONE ENVIRONMENT NOTE THAT WILL COST YOU AN HOUR OTHERWISE. This demo is
   entirely frame-driven, and requestAnimationFrame does not tick in a hidden or
   backgrounded page (measured 0 frames in 1000 ms in a hidden browser pane).
   If the sim appears frozen, drive it explicitly:
       await page.evaluate(n => { let t = performance.now();
         for (let i = 0; i < n; i++) { t += 16; window.fuelGolf.stepFrame(t); } }, 200);
   stepFrame runs one frame and does NOT re-queue, so it cannot double-run. */
'use strict';
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (err) {
  console.error('ui-smoke.js requires Playwright. Install the test-only dependency with: npm install --save-dev playwright && npx playwright install chromium');
  process.exit(2);
}
const path = require('path');
const fs = require('fs');
function browserExecutable() {
  const winRoots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean);
  const candidates = [
    ...winRoots.flatMap((root) => [
      path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    ]),
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
    '/usr/bin/chromium-browser', '/snap/bin/chromium'
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? '  PASS ' : '  FAIL ') + name + (detail !== undefined ? '  [' + detail + ']' : ''));
  if (!cond) fails++;
}
const num = (s) => parseFloat(String(s).replace(/[^0-9.-]/g, ''));

(async () => {
  const executablePath = browserExecutable();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  // Offline contract: nothing may leave the machine. `requestsSeen` is the
  // positive control — without it, "no offenders" could just mean the listener
  // never fired.
  let requestsSeen = 0;
  const offDevice = [];
  page.on('request', (r) => {
    requestsSeen++;
    if (!/^(file|data|blob|about):/i.test(r.url())) offDevice.push(r.method() + ' ' + r.url().slice(0, 80));
  });

  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.waitForTimeout(500);

  console.log('\n[1] Boot, theme, and modal pause');
  check('the shell Guide opens on boot', await page.locator('#guide[open]').count() === 1);
  check('the demo is built on the lesson shell', /lesson-shell v\d+ css:[0-9a-f]+/.test(await page.content()));
  const clockBefore = await page.textContent('#clockChip');
  await page.waitForTimeout(1200);
  const clockAfter = await page.textContent('#clockChip');
  check('sim is paused while a modal is open', clockBefore === clockAfter, clockBefore + ' -> ' + clockAfter);
  const tok = async n => (await page.evaluate(
    k => getComputedStyle(document.documentElement).getPropertyValue(k).trim(), n)).toUpperCase();
  check('kit gold token present', await tok('--gold') === '#ECAC00', await tok('--gold'));
  check('kit navy token present', await tok('--navy') === '#002144', await tok('--navy'));
  check('kit type unit present', (await tok('--u')).length > 0, await tok('--u'));
  console.log('\n[1a] Dialog and keyboard accessibility');
  // The Guide is a native <dialog> the shell owns, so role, aria-modal, the
  // focus trap, backdrop dismissal, Escape and focus return are the platform's
  // and the kit's. What stays this demo's business is that the Guide SAYS the
  // thing a student needs, and that the shell's controls actually reach it.
  check('the Guide is a labelled native dialog',
        await page.evaluate(() => {
          const d = document.getElementById('guide');
          return d.tagName === 'DIALOG' && d.getAttribute('aria-labelledby') === 'guide-title';
        }));
  check('the Guide moves focus into itself without a click opener',
        await page.evaluate(() => document.getElementById('guide').contains(document.activeElement)));
  check('background controls are not reachable while a modal dialog is open',
        await page.evaluate(() => {
          const b = document.getElementById('btnPlanBurn');
          b.focus();
          return document.activeElement !== b;      // a modal <dialog> inerts everything outside it
        }));
  check('the Guide explains the Δv budget students are scored on',
        /Δv|delta-v/i.test(await page.textContent('#guide')));
  check('the Guide is <= 250 words (template part A7)', await page.evaluate(() => {
    const t = document.querySelector('#guide .lesson-dialog-body').innerText || '';
    return t.trim().split(/\s+/).filter(Boolean).length <= 250;
  }));
  await page.mouse.click(20, 400);                 // backdrop click
  await page.waitForTimeout(80);
  check('tapping the backdrop dismisses the Guide', await page.locator('#guide[open]').count() === 0);
  check('the Guide is reopenable from an always-visible control',
        await page.locator('#guide-open').isVisible());
  await page.click('#guide-open');
  await page.waitForTimeout(80);
  check('the ❓ control reopens the Guide', await page.locator('#guide[open]').count() === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  check('Escape closes the Guide and returns focus to its opener', await page.evaluate(() =>
    !document.getElementById('guide').open && document.activeElement.id === 'guide-open'));
  await page.keyboard.press('?');
  await page.waitForTimeout(80);
  check('? reopens the Guide', await page.locator('#guide[open]').count() === 1);
  await page.keyboard.press('Escape');
  check('the crash dialog is NOT light-dismissable (it asks for a decision)',
        await page.evaluate(() => !document.getElementById('crashModal').hasAttribute('data-lightdismiss')));
  check('the debrief is NOT light-dismissable either',
        await page.evaluate(() => !document.getElementById('debriefModal').hasAttribute('data-lightdismiss')));
  await page.click('#btnMission');
  await page.waitForTimeout(50);
  check('mission dialog moves focus to its control',
        await page.evaluate(() => document.activeElement && document.activeElement.id === 'msClose'));
  await page.keyboard.press('Escape');
  check('Escape restores focus to the modal opener',
        await page.evaluate(() => document.activeElement && document.activeElement.id === 'btnMission'));
  await page.click('#btnLevels');
  await page.waitForTimeout(50);
  check('mission cards are native keyboard controls with useful names', await page.evaluate(() => {
    const card = document.querySelector('.levelcard');
    return card && card.tagName === 'BUTTON' && /Load level 1: Orbit School\. Circularize your orbit\./.test(card.getAttribute('aria-label'));
  }));
  await page.locator('.levelcard').nth(1).focus();
  check('mission-card focus is visibly styled', await page.evaluate(() => {
    const card = document.activeElement;
    return card.classList.contains('levelcard') && parseFloat(getComputedStyle(card).outlineWidth) >= 3;
  }));
  await page.keyboard.press('Space');
  await page.waitForTimeout(80);
  check('Space activates a mission card', /Level 2:/.test(await page.textContent('#levelChip')));
  await page.click('#btnLevels');
  await page.locator('.levelcard').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  check('Enter activates a mission card', /Level 1:/.test(await page.textContent('#levelChip')));

  console.log('\n[2] HUD countdowns and camera');
  await page.click('#btnHud');
  await page.waitForTimeout(700);
  const tPe = await page.textContent('#hudTPe');
  const tAp = await page.textContent('#hudTAp');
  check('time-to-periapsis countdown populated', /\d/.test(tPe), tPe);
  check('time-to-apoapsis countdown populated', /\d/.test(tAp), tAp);
  const hudTop = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('hud')).top));
  const barH = await page.evaluate(() => document.getElementById('brandbar').offsetHeight);
  check('HUD clears the top bar', hudTop >= barH, 'hud top=' + hudTop + ' bar=' + barH);
  check('camera starts framed on the system (follow off)',
        await page.evaluate(() => !document.getElementById('btnFollow').classList.contains('active')));
  await page.click('#btnFollow');
  check('follow toggles on', await page.evaluate(() => document.getElementById('btnFollow').classList.contains('active')));
  // drag on the map should pan and disable follow
  await page.mouse.move(400, 400); await page.mouse.down();
  await page.mouse.move(520, 460, { steps: 6 }); await page.mouse.up();
  check('dragging the map disables follow (pan)',
        await page.evaluate(() => !document.getElementById('btnFollow').classList.contains('active')));
  await page.click('#zoomFit');

  console.log('\n[3] Mission briefing');
  await page.click('#btnMission');
  await page.waitForTimeout(200);
  check('mission modal opens', await page.locator('#missionModal.show').count() === 1);
  check('briefing states par', /m\/s/.test(await page.textContent('#msPar')));
  check('briefing states the objective', (await page.textContent('#msGoal')).length > 30);
  await page.click('#msClose');

  console.log('\n[4] Burn planning: aim, preview, thrust vector');
  // level 1 circularizes only at apoapsis — warp there first
  await page.click('#btnToAp');
  await page.waitForTimeout(3000);
  await page.click('#btnPlanBurn');
  await page.locator('#dvSlider').fill('3.85');
  await page.locator('#dvSlider').dispatchEvent('input');
  await page.waitForTimeout(300);
  const pred = await page.textContent('#predinfo');
  check('planner predicts the resulting orbit', /Predicted orbit/.test(pred), pred.slice(0, 46));
  check('Δv reads out in m/s', num(await page.textContent('#dvOut')) > 500, await page.textContent('#dvOut'));
  // drag on canvas while planning should switch to free-angle aiming
  await page.mouse.move(300, 300); await page.mouse.down();
  await page.mouse.move(340, 330, { steps: 3 }); await page.mouse.up();
  const freeActive = await page.evaluate(() => document.querySelector('.modes [data-mode="free"]').classList.contains('active'));
  check('dragging the map aims a free-angle burn', freeActive);
  // back to prograde for the actual burn
  await page.click('.modes [data-mode="prograde"]');
  await page.locator('#dvSlider').fill('3.85');
  await page.locator('#dvSlider').dispatchEvent('input');
  await page.waitForTimeout(250);

  console.log('\n[5] Undo rewinds a committed burn');
  await page.click('#btnCommitBurn');
  await page.waitForTimeout(400);
  const dvAfterBurn = num(await page.textContent('#dvChip'));
  check('Δv spent recorded', dvAfterBurn > 500, dvAfterBurn + ' m/s');
  const undoEnabled = await page.evaluate(() => !document.getElementById('btnUndo').disabled);
  check('undo becomes available after a burn', undoEnabled);
  check('apoapsis burn completed the circularization', await page.locator('#debriefModal.show').count() === 1);
  await page.click('#dbClose');
  await page.click('#btnUndo');
  await page.waitForTimeout(300);
  const dvAfterUndo = num(await page.textContent('#dvChip'));
  check('undo restores the fuel ledger to zero', dvAfterUndo === 0, dvAfterUndo + ' m/s');
  check('undo disables itself when the stack empties',
        await page.evaluate(() => document.getElementById('btnUndo').disabled));

  console.log('\n[6] Completing a level records progress');
  await page.click('#btnPlanBurn');
  await page.locator('#dvSlider').fill('3.85');
  await page.locator('#dvSlider').dispatchEvent('input');
  await page.click('#btnCommitBurn');
  await page.waitForTimeout(500);
  check('debrief appears on success', await page.locator('#debriefModal.show').count() === 1);
  check('debrief counts burns', num(await page.textContent('#dbBurns')) === 1);
  const math = await page.textContent('#dbMath');
  check('math proof matches the integrator', /✓ matches/.test(math));
  await page.click('#mathToggle');
  check('math panel collapses', await page.evaluate(() => document.getElementById('dbMath').classList.contains('collapsed')));
  await page.click('#mathToggle');
  await page.fill('#dbName', 'RacerOne');
  await page.click('#dbSave');
  await page.waitForTimeout(200);
  check('score saved to leaderboard', /RacerOne/.test(await page.textContent('#dbLb')));
  await page.screenshot({ path: '/tmp/msu-4-debrief.png' });
  await page.click('#dbClose');
  await page.click('#btnLevels');
  await page.waitForTimeout(250);
  check('level card shows a completion badge', await page.locator('.levelcard .badge').count() >= 1);
  check('progress text updates', /1 of 8/.test(await page.textContent('#progText')), await page.textContent('#progText'));
  await page.screenshot({ path: '/tmp/msu-5-levels.png' });

  console.log('\n[7] Finite-thrust level: lead warp + engine burn + cut');
  await page.locator('.levelcard').nth(5).click(); // L6 Ignition Window
  await page.waitForTimeout(300);
  check('engine chip shows m/s²', /m\/s²/.test(await page.textContent('#engChip')), (await page.textContent('#engChip')).trim());
  check('lead-time control appears for finite engines',
        await page.evaluate(() => document.getElementById('leadWrap').classList.contains('show')));
  await page.fill('#leadInput', '30');
  await page.click('#btnToPe');
  await page.waitForTimeout(2500);
  const tPe6 = await page.textContent('#hudTPe');
  check('lead warp stops short of periapsis (~30 min out)', /min|h/.test(tPe6), 'T-' + tPe6);
  await page.click('#btnPlanBurn');
  await page.locator('#dvSlider').fill('3');
  await page.locator('#dvSlider').dispatchEvent('input');
  const cost = await page.textContent('#burncost');
  check('planner states burn duration', /Burn duration/.test(cost));
  await page.click('#btnCommitBurn');
  await page.waitForTimeout(400);
  const dvMid = num(await page.textContent('#dvChip'));
  check('finite burn spends Δv over time', dvMid > 5 && dvMid < 470, dvMid + ' m/s');
  check('cut-engine control is offered', await page.locator('#btnCut').isVisible());
  await page.click('#btnCut');
  await page.waitForTimeout(400);
  const dvCut = num(await page.textContent('#dvChip'));
  await page.waitForTimeout(700);
  const dvSettled = num(await page.textContent('#dvChip'));
  check('cutting the engine stops the spend', Math.abs(dvSettled - dvCut) < 1, dvSettled + ' m/s');
  await page.screenshot({ path: '/tmp/msu-6-finite.png' });

  console.log('\n[8] Escape criterion legibility (level 3)');
  await page.click('#btnLevels');
  await page.locator('.levelcard').nth(2).click();
  await page.waitForTimeout(300);
  check('ORBIT chip reports bound state', /BOUND/.test(await page.textContent('#orbitChip')));
  await page.click('#btnToPe');
  await page.waitForTimeout(2200);
  await page.click('#btnPlanBurn');
  await page.locator('#dvSlider').fill('4');
  await page.locator('#dvSlider').dispatchEvent('input');
  await page.waitForTimeout(300);
  check('under-escape burn is flagged as still bound', /still bound/.test(await page.textContent('#predinfo')));
  await page.locator('#dvSlider').fill('5');
  await page.locator('#dvSlider').dispatchEvent('input');
  await page.waitForTimeout(300);
  check('sufficient burn is flagged as escape', /ESCAPE/.test(await page.textContent('#predinfo')));
  await page.click('#btnCommitBurn');
  await page.click('[data-warp="200"]');
  let escaped = false;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(400);
    if (await page.locator('#debriefModal.show').count()) { escaped = true; break; }
  }
  check('escape completes the mission', escaped);
  const m3 = await page.textContent('#dbMath');
  check('proof shows hyperbolic escape with v∞', /hyperbolic escape/.test(m3) && /v∞/.test(m3));

  console.log('\n[8b] Regression: fall-back warning must not break the hint banner');
  // crossing the system edge while still BOUND fires the fall-back banner; a later
  // level load then re-renders the banner. Setting textContent on the #hint
  // container (rather than #hintText) used to destroy the span and throw
  // "Cannot set properties of null" on the next showHint().
  await page.click('#dbClose');
  await page.click('#btnLevels');
  await page.locator('.levelcard').nth(2).click(); // level 3 again
  await page.waitForTimeout(300);
  await page.click('#btnToPe');
  await page.waitForTimeout(2200);
  await page.click('#btnPlanBurn');
  await page.locator('#dvSlider').fill('4');       // deliberately short of escape
  await page.locator('#dvSlider').dispatchEvent('input');
  await page.click('#btnCommitBurn');
  await page.click('[data-warp="200"]');
  let warned = false;
  for (let i = 0; i < 50; i++) {
    await page.waitForTimeout(400);
    const t = await page.textContent('#hint');
    if (/fall back|still negative/i.test(t)) { warned = true; break; }
  }
  check('fall-back warning fires on a tall bound ellipse', warned);
  check('#hintText survives the warning',
        await page.evaluate(() => !!document.getElementById('hintText')));
  check('#hintClose survives the warning',
        await page.evaluate(() => !!document.getElementById('hintClose')));
  const errsBefore = errors.length;
  await page.click('#btnRestart');                  // this is what used to throw
  await page.waitForTimeout(500);
  check('restarting after the warning does not throw', errors.length === errsBefore,
        errors.slice(errsBefore).join(' | '));
  check('mission banner still renders after restart',
        (await page.textContent('#hintText')).length > 20);

  console.log('\n[8c] Regression: sandbox engine buttons must not hijack burn direction');
  await page.click('#btnLevels');
  await page.locator('.levelcard').nth(7).click(); // level 8 sandbox (engine choices)
  await page.waitForTimeout(300);
  await page.click('#btnPlanBurn');
  await page.waitForTimeout(150);
  await page.click('#engineRow [data-eng="0.35"]');
  await page.waitForTimeout(250);
  const modeAfterEngine = await page.evaluate(() => {
    const a = document.querySelector('.modes [data-mode].active');
    return a ? a.dataset.mode : null;
  });
  check('picking an engine leaves the burn direction intact', modeAfterEngine === 'prograde', String(modeAfterEngine));
  await page.locator('#dvSlider').fill('2');
  await page.locator('#dvSlider').dispatchEvent('input');
  await page.waitForTimeout(250);
  check('predicted path still computes after an engine swap',
        /Predicted/.test(await page.textContent('#predinfo')));
  await page.click('#btnCancelBurn');

  console.log('\n[9] Settings, presentation mode, presenter notes - all the shell\'s now');
  check('a Settings control is always visible', await page.locator('#settings-open').isVisible());
  check('the presenter notes shortcut stays out of the way until presenting',
        await page.locator('.icon-btn.notes-open').isVisible() === false);
  await page.click('#settings-open');
  await page.waitForTimeout(80);
  check('Settings opens', await page.locator('#settings[open]').count() === 1);
  check('Settings offers the contract triad, in order', await page.evaluate(() => {
    const t = document.getElementById('settings-menu').innerText;
    const a = t.indexOf('Open Presenter Notes'), b = t.indexOf('Presentation mode'), c = t.indexOf('Reset');
    return a > -1 && b > a && c > b;
  }));
  await page.click('#presentation-btn');
  await page.waitForTimeout(300);
  check('presentation mode scales the page', await page.evaluate(() => document.body.classList.contains('presenter')));
  check('presentation mode bumps the type unit', await page.evaluate(() =>
        getComputedStyle(document.body).getPropertyValue('--u').trim() === '1.2rem'));
  check('the presentation toggle reports its state assistively', await page.evaluate(() =>
        document.getElementById('presentation-btn').getAttribute('aria-pressed') === 'true'));
  await page.screenshot({ path: '/tmp/msu-7-presenting.png' });
  await page.click('.notes-open');
  await page.waitForTimeout(120);
  check('presenter notes open from Settings', await page.locator('#presenter-notes[open]').count() === 1);
  check('Settings closes behind the notes (swap, not stack)',
        await page.locator('#settings[open]').count() === 0);
  const notes = await page.textContent('#presenter-notes');
  check('notes carry a timed run of show', /0–3 min/.test(notes) && /19–20 min/.test(notes));
  check('notes carry the headline numbers from the teacher guide',
        /1,835/.test(notes) && /661/.test(notes) && /L3 791/.test(notes), 'pars + escape gap');
  check('notes carry the misconceptions to catch',
        /Misconception 1/.test(notes) && /Misconception 2/.test(notes) && /Misconception 3/.test(notes));
  // The notes ARE the printable guide, lifted at build time from
  // src/demo-guide.html. These assert the guide's own prose is on screen rather
  // than that a second copy of it loads in a frame.
  check('notes carry the whole guide, not a summary of it',
        /Running it/.test(notes) && /Discussion questions/.test(notes) &&
        /Presenter controls/.test(notes), 'guide section headings');
  check('the four stage Takeaways appear verbatim under Learning goals', await page.evaluate(() => {
    const notesText = document.getElementById('presenter-notes').innerText;
    return [...document.querySelectorAll('.lesson-strip article:last-child p')]
      .every(p => notesText.includes(p.textContent.trim()));
  }));
  check('no objective-shaped line anywhere in the notes',
        !/you will be able to/i.test(notes));
  const printLink = await page.evaluate(() => {
    const a = document.querySelector('#presenter-notes a[href$="teacher-guide.html"]');
    return a && { href: a.getAttribute('href'), target: a.target, rel: a.rel };
  });
  check('notes offer the printable copy from the demo folder, not the network',
        !!printLink && printLink.href === 'teacher-guide.html', printLink && printLink.href);
  check('the printable copy opens in its own tab, leaving the game running',
        !!printLink && printLink.target === '_blank' && /noopener/.test(printLink.rel));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  check('notes close back to the game', await page.locator('#presenter-notes[open]').count() === 0);

  console.log('\n[9a] A5 Details drawer, per stage');
  await page.click('#stage-1 .details-trigger');
  await page.waitForTimeout(100);
  check('Details opens for the current stage', await page.locator('#details[open]').count() === 1);
  const det = await page.textContent('#details .details-stage.on');
  check('Details states what is live', /What this page actually computes/.test(det));
  check('Details names the mechanism', /velocity Verlet/.test(det));
  check('Details lists assumptions', /Assumptions and simplifications/.test(det));
  check('Details resolves its Sourced kicker to a source', await page.evaluate(() => {
    const on = document.querySelector('#details .details-stage.on');
    return !on.querySelector('.k-sourced') || !!on.querySelector('a[href^="https://"]');
  }));
  check('Details carries a Boundary card', await page.evaluate(() =>
        !!document.querySelector('#details .details-stage.on .evidence-card')));
  check('Details names the impulsive-burn assumption',
        /impulsive/i.test(det), 'the assumption stage 3 removes');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);

  console.log('\n[9b] Contract UX: Guide button, the Settings triad, in-place Reset');
  check('the guide control is named Guide', await page.evaluate(() =>
        (document.getElementById('guide-open').getAttribute('aria-label') || '').trim() === 'Guide'));
  check('the Guide card is headed Guide',
        /^Guide\b/.test((await page.textContent('#guide-title')).trim()));
  const label = (sel) => page.evaluate((x) => {
    const b = document.querySelector(x);
    return (b.getAttribute('aria-label') || b.textContent || '')
      .replace(/[^\x20-\x7e]/g, '').replace(/[.…]+$/, '').trim();
  }, sel);
  check('Settings offers Open Presenter Notes, exactly labelled',
        await label('#settings-menu .notes-open') === 'Open Presenter Notes', await label('#settings-menu .notes-open'));
  check('Settings offers Presentation mode, exactly labelled',
        await label('#presentation-btn') === 'Presentation mode', await label('#presentation-btn'));
  check('Settings offers Reset, exactly labelled',
        await label('#reset-btn') === 'Reset', await label('#reset-btn'));

  // RESET IS IN PLACE as of kit v2: it must restore the activity WITHOUT a
  // reload, must not undo presentation mode, and must leave the saved class
  // leaderboards alone (they hold other students' entries; Clear scores is the
  // control for those, and it asks first).
  await page.evaluate(() => {
    localStorage.setItem('fuelgolf_progress', JSON.stringify({ 1: { done: true, best: 500 } }));
    localStorage.setItem('fuelgolf_lb_1', JSON.stringify([{ name: 'Someone', dv: 500 }]));
    localStorage.setItem('fuelgolf_name', JSON.stringify('Someone'));
    window.__NO_RELOAD_SENTINEL__ = 'set-before-reset';
  });
  await page.click('#btnHud');                 // dirty transient UI: HUD closed
  await page.evaluate(() => {                  // dirty a form control and a prediction
    document.getElementById('leadInput').value = '37';
    document.querySelector('#predict-1 .predict-option').click();
  });
  await page.click('#settings-open');
  await page.waitForTimeout(80);
  await page.click('#reset-btn');
  await page.waitForTimeout(400);
  const afterReset = await page.evaluate(() => ({
    sentinel: window.__NO_RELOAD_SENTINEL__,
    navEntries: performance.getEntriesByType('navigation').length,
    prog: localStorage.getItem('fuelgolf_progress'),
    lb: localStorage.getItem('fuelgolf_lb_1'),
    name: localStorage.getItem('fuelgolf_name'),
    level: document.getElementById('levelChip').textContent,
    dv: document.getElementById('dvChip').textContent,
    openDialogs: document.querySelectorAll('dialog[open]').length,
    hud: document.getElementById('hud').classList.contains('show'),
    presenter: document.body.classList.contains('presenter'),
    lead: document.getElementById('leadInput').value,
    stage: [...document.querySelectorAll('.stage-tab')].findIndex(t => t.getAttribute('aria-selected') === 'true'),
    tab3Disabled: document.getElementById('tab-3').disabled,
    predictPressed: [...document.querySelectorAll('#predict-1 .predict-option')].some(b => b.getAttribute('aria-pressed') === 'true'),
    gate2Visible: !document.getElementById('gate-2').hidden,
    activityHost: document.getElementById('activity').closest('.activity-host').dataset.activityHost,
    undoDisabled: document.getElementById('btnUndo').disabled
  }));
  check('Reset did NOT reload the page (window sentinel survived)',
        afterReset.sentinel === 'set-before-reset', String(afterReset.sentinel));
  check('Reset did NOT reload the page (one navigation entry)',
        afterReset.navEntries === 1, afterReset.navEntries);
  check('Reset clears the badges and the saved name',
        !afterReset.prog && !afterReset.name, JSON.stringify({ p: afterReset.prog, n: afterReset.name }));
  check('Reset LEAVES the class leaderboards alone (Clear scores is for those)',
        !!afterReset.lb, String(afterReset.lb));
  check('Reset returns to level 1 with an empty tally',
        /Level 1/.test(afterReset.level) && num(afterReset.dv) === 0,
        afterReset.level + ' / ' + afterReset.dv);
  check('Reset closes every dialog', afterReset.openDialogs === 0);
  check('Reset reopens the HUD (the Oberth bar is the A4 instrument)', afterReset.hud === true);
  check('Reset restores the lead control to 0', afterReset.lead === '0', afterReset.lead);
  check('Reset returns to stage 1', afterReset.stage === 0);
  check('Reset re-locks the stage 3 gate', afterReset.tab3Disabled === true);
  check('Reset forgets the predictions', afterReset.predictPressed === false);
  check('Reset restores the stage 2 evidence gate', afterReset.gate2Visible === true);
  check('Reset puts the flight view back in stage 1\'s host', afterReset.activityHost === '0');
  check('Reset empties the undo stack', afterReset.undoDisabled === true);
  check('Reset leaves presentation mode alone', afterReset.presenter === true);

  check('presentation mode surfaces the notes control in the header',
        await page.locator('.icon-btn.notes-open').isVisible());
  await page.keyboard.press('n');
  await page.waitForTimeout(120);
  check('N opens the presenter notes mid-demo', await page.locator('#presenter-notes[open]').count() === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  await page.click('#settings-open');
  await page.click('#presentation-btn');       // back off, for the checks below
  await page.waitForTimeout(150);
  check('leaving presentation mode hides the notes shortcut again',
        await page.locator('.icon-btn.notes-open').isVisible() === false);

  console.log('\n[9c] A1 stage navigation, and the two gates');
  check('four stage tabs in a tablist', await page.evaluate(() =>
        document.querySelectorAll('.stages[role="tablist"] .stage-tab').length === 4));
  check('every tab subtitle is a question', await page.evaluate(() =>
        [...document.querySelectorAll('.stage-tab small')].every(s => s.textContent.trim().endsWith('?'))));
  check('arrow keys move within the tablist', await page.evaluate(() => {
    document.getElementById('tab-1').focus();
    document.getElementById('tab-1').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    return document.getElementById('tab-2').getAttribute('aria-selected') === 'true';
  }));
  check('a hash beyond the furthest unlocked stage CLAMPS rather than routing around the gate',
        await page.evaluate(() => {
          window.lessonShell.selectStage(2);        // stage 3, still locked
          return [...document.querySelectorAll('.stage-tab')]
            .findIndex(t => t.getAttribute('aria-selected') === 'true') < 2;
        }));
  check('stage 2 withholds the flight view until its prediction is committed',
        await page.evaluate(() => {
          window.lessonShell.selectStage(1);
          return !document.getElementById('gate-2').hidden &&
                 document.getElementById('activity').closest('.activity-host').dataset.activityHost === '0';
        }));
  check('committing stage 2\'s prediction hands the flight view over and loads Escape Artist',
        await page.evaluate(() => {
          document.querySelector('#predict-2 .predict-option').click();
          return document.getElementById('gate-2').hidden &&
                 document.getElementById('activity').closest('.activity-host').dataset.activityHost === '1' &&
                 window.fuelGolf.LEVELS[window.fuelGolf.levelIndex()].name === 'Escape Artist';
        }));
  check('every stage panel that is reachable actually RENDERS, not merely its tab',
        await page.evaluate(() => {
          // ruling 1, amended 2026-09-16: tab state is not panel state.
          const reachable = [0, 1, 3];             // stage 3 needs a flown escape
          return reachable.every(i => {
            window.lessonShell.selectStage(i);
            const p = document.getElementById('stage-' + (i + 1));
            return getComputedStyle(p).display !== 'none' && p.offsetParent !== null;
          });
        }));

  console.log('\n[10] Chromebook viewport (1366×768) and mobile (390×844)');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(400);
  // The HUD is docked inside the workbench now rather than floating clear of a
  // fixed top bar, so the assertion that matters is that it is ON SCREEN beside
  // the map and that nothing overflows sideways.
  check('the HUD is on screen at 1366×768',
        await page.evaluate(() => document.getElementById('hud').offsetParent !== null));
  check('no horizontal overflow at 1366×768', await page.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth + 1),
        await page.evaluate(() => document.documentElement.scrollWidth + ' vs ' + window.innerWidth));
  check('the map and the HUD sit side by side on a wide screen', await page.evaluate(() =>
        getComputedStyle(document.querySelector('.flight-grid')).gridTemplateColumns.split(' ').length === 2));
  // the byline is required to be visible AND unobtrusive: it must not sit on
  // top of the flight controls at any supported width
  const bylineFits = () => page.evaluate(() => {
    const c = document.querySelector('.bh-credit');
    if (!c) return { ok: false, why: 'no byline' };
    const b = c.getBoundingClientRect();
    const vis = getComputedStyle(c).display !== 'none' && b.width > 0 && b.bottom <= window.innerHeight + 1;
    const hit = [...document.querySelectorAll('#controls .ctlgroup')].find((g) => {
      const r = g.getBoundingClientRect();
      return !(b.right <= r.left || r.right <= b.left || b.bottom <= r.top || r.bottom <= b.top);
    });
    return { ok: vis && !hit, why: hit ? 'overlaps a control group' : (vis ? 'clear' : 'not visible') };
  });
  let by = await bylineFits();
  check('byline is visible and clear of the controls at 1366×768', by.ok, by.why);
  await page.screenshot({ path: '/tmp/msu-8-chromebook.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const ctlOverflow = await page.evaluate(() => {
    const c = document.getElementById('controls');
    return c.getBoundingClientRect().right <= window.innerWidth + 1;
  });
  check('bottom controls fit the mobile viewport', ctlOverflow);
  by = await bylineFits();
  check('byline is visible and clear of the controls at 390×844', by.ok, by.why);
  check('byline names the author and the institution',
        /Bryant Harrison/.test(await page.textContent('.bh-credit')) &&
        /Murray State University/.test(await page.textContent('.bh-credit')));
  check('Guide and Settings controls survive the phone layout',
        await page.locator('#guide-open').isVisible() && await page.locator('#settings-open').isVisible());
  await page.click('#guide-open');
  await page.waitForTimeout(120);
  check('the Guide card fits the phone viewport', await page.evaluate(() => {
    const b = document.getElementById('guide').getBoundingClientRect();
    return b.left >= -1 && b.right <= window.innerWidth + 1 && b.height <= window.innerHeight + 1;
  }));
  await page.keyboard.press('Escape');
  check('the map and the HUD stack on a phone', await page.evaluate(() =>
        getComputedStyle(document.querySelector('.flight-grid')).gridTemplateColumns.split(' ').length === 1));
  await page.screenshot({ path: '/tmp/msu-9-mobile.png' });
  // 320px is the narrowest width the contract names, and the flight view's
  // aspect-ratio plus min-height overflowed it by 67px before max-width:100%
  // was added. Measured, not eyeballed.
  await page.setViewportSize({ width: 320, height: 720 });
  await page.waitForTimeout(300);
  check('no horizontal overflow at 320px', await page.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth + 1),
        await page.evaluate(() => document.documentElement.scrollWidth + ' vs ' + window.innerWidth));

  console.log('\n[11] Offline contract');
  check('request instrumentation actually observed loads (control)', requestsSeen > 0, requestsSeen + ' requests');
  check('nothing is fetched off-device at runtime', offDevice.length === 0, offDevice.slice(0, 3).join(' | ') || 'all local');

  console.log('\n' + (errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console/page errors'));
  if (errors.length) fails++;
  console.log(fails ? '\n' + fails + ' FAILURE(S)\n' : '\nALL UI CHECKS PASSED\n');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
