/* UI smoke test: drives the real interface headlessly and asserts the
   behaviours students depend on. node ui-smoke.js  */
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
  check('help modal opens on boot', await page.locator('#helpModal.show').count() === 1);
  const clockBefore = await page.textContent('#clockChip');
  await page.waitForTimeout(1200);
  const clockAfter = await page.textContent('#clockChip');
  check('sim is paused while a modal is open', clockBefore === clockAfter, clockBefore + ' -> ' + clockAfter);
  const gold = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--msu-gold').trim());
  const blue = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--msu-blue').trim());
  check('MSU gold token present', gold.toUpperCase() === '#ECAC00', gold);
  check('MSU blue token present', blue.toUpperCase() === '#002144', blue);
  console.log('\n[1a] Dialog and keyboard accessibility');
  check('boot help is announced as a labelled modal dialog', await page.evaluate(() => {
    const modal = document.getElementById('helpModal');
    return modal.getAttribute('role') === 'dialog' && modal.getAttribute('aria-modal') === 'true' &&
      modal.getAttribute('aria-labelledby') === 'helpTitle' && modal.getAttribute('aria-describedby') === 'helpIntro';
  }));
  check('boot help moves focus into the dialog without a click opener',
        await page.evaluate(() => document.activeElement && document.activeElement.id === 'closeHelp'));
  check('modal makes background controls inert', await page.evaluate(() => {
    const mission = document.getElementById('btnMission');
    const inertAncestor = mission.closest('[inert]');
    return inertAncestor && inertAncestor.inert && inertAncestor.getAttribute('aria-hidden') === 'true' &&
      !mission.matches(':focus-within');
  }));
  await page.keyboard.press('Tab');
  check('Tab stays inside the boot help dialog',
        await page.evaluate(() => document.activeElement && document.activeElement.id === 'closeHelp'));
  check('boot help explains the Δv budget students are scored on',
        /par .{0,3}v budget/i.test(await page.textContent('#helpModal')));
  check('boot help opens at the top, not scrolled to its buttons',
        await page.evaluate(() => document.querySelector('#helpModal .box').scrollTop === 0));
  // tap/click outside the box dismisses the how-to popup (phone-friendly)
  await page.mouse.click(20, 400);
  await page.waitForTimeout(80);
  check('tapping outside dismisses the how-to popup',
        await page.locator('#helpModal.show').count() === 0);
  check('the how-to popup is reopenable from an always-visible control',
        await page.locator('#btnHelp').isVisible());
  await page.click('#btnHelp');
  await page.waitForTimeout(80);
  check('the ❓ control reopens the how-to popup', await page.locator('#helpModal.show').count() === 1);
  await page.keyboard.press('Escape');
  check('Escape closes boot help and restores a safe fallback focus', await page.evaluate(() => {
    return !document.getElementById('helpModal').classList.contains('show') && document.activeElement.id === 'btnHelp';
  }));
  await page.keyboard.press('?');
  await page.waitForTimeout(80);
  check('? reopens the how-to popup', await page.locator('#helpModal.show').count() === 1);
  await page.keyboard.press('Escape');
  check('the crash dialog is NOT light-dismissable (it asks for a decision)',
        await page.evaluate(() => !document.getElementById('crashModal').hasAttribute('data-lightdismiss')));
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
  const barH = await page.evaluate(() => document.getElementById('topbar').offsetHeight);
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

  console.log('\n[9] Settings menu, presentation mode, presenter\'s notes');
  check('a settings control is always visible', await page.locator('#btnTeacher').isVisible());
  check('the presenter notes shortcut stays out of the way until presenting',
        await page.locator('#btnNotes').isVisible() === false);
  await page.click('#btnTeacher');
  await page.waitForTimeout(80);
  check('settings menu opens', await page.locator('#teacherModal.show').count() === 1);
  check('settings menu offers presentation mode',
        /Presentation mode/.test(await page.textContent('#teacherModal')));
  await page.click('#tgProjector');
  await page.waitForTimeout(300);
  check('projector mode enlarges UI', await page.evaluate(() => document.body.classList.contains('projector')));
  check('presentation toggle reports its state assistively',
        await page.evaluate(() => document.getElementById('tgProjector').getAttribute('aria-pressed') === 'true'));
  await page.screenshot({ path: '/tmp/msu-7-projector.png' });
  await page.click('#tgNotes');
  await page.waitForTimeout(120);
  check('presenter notes open from the settings menu', await page.locator('#notesModal.show').count() === 1);
  check('settings closes behind the notes', await page.locator('#teacherModal.show').count() === 0);
  check('notes open at the run of show, not scrolled to the bottom',
        await page.evaluate(() => document.querySelector('#notesModal .box').scrollTop === 0));
  const notes = await page.textContent('#notesModal');
  check('notes carry a timed run of show', /0–3 min/.test(notes) && /19–20 min/.test(notes));
  check('notes carry the headline numbers from the teacher guide',
        /1,835/.test(notes) && /661/.test(notes) && /L3 791/.test(notes), 'pars + escape gap');
  check('notes carry the misconceptions to catch', /Catch these three/.test(notes));
  check('notes point at the full teacher guide',
        await page.locator('#notesModal .teacher-guide-open').count() === 1);
  await page.click('#notesModal .teacher-guide-open');
  await page.waitForTimeout(500);
  check('the printable teacher guide opens in-app',
        await page.evaluate(() => !document.getElementById('msu-guide').hidden));
  check('the guide is served from the demo folder, not the network',
        await page.evaluate(() => (document.getElementById('msu-guide-frame').getAttribute('src') || '').endsWith('teacher-guide.html')));
  await page.click('#msu-guide-close');
  await page.waitForTimeout(200);
  check('closing the guide returns to the notes',
        await page.evaluate(() => document.getElementById('msu-guide').hidden) &&
        await page.locator('#notesModal.show').count() === 1);
  check('notes are scrollable rather than clipped on small screens',
        await page.evaluate(() => getComputedStyle(document.querySelector('#notesModal .box')).overflowY === 'auto'));
  await page.click('#closeNotes');
  await page.waitForTimeout(80);
  check('notes close back to the game', await page.locator('#notesModal.show').count() === 0);
  check('presentation mode surfaces the 🎤 notes control in the top bar',
        await page.locator('#btnNotes').isVisible());
  await page.keyboard.press('n');
  await page.waitForTimeout(120);
  check('N opens the presenter notes mid-demo', await page.locator('#notesModal.show').count() === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  await page.click('#btnTeacher');
  await page.click('#tgProjector');
  await page.click('#closeTeacher');
  check('leaving presentation mode hides the notes shortcut again',
        await page.locator('#btnNotes').isVisible() === false);

  console.log('\n[10] Chromebook viewport (1366×768) and mobile (390×844)');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(400);
  const hudTop2 = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('hud')).top));
  const barH2 = await page.evaluate(() => document.getElementById('topbar').offsetHeight);
  check('HUD still clears the top bar at 1366×768', hudTop2 >= barH2);
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
  check('how-to and settings controls survive the phone layout',
        await page.locator('#btnHelp').isVisible() && await page.locator('#btnTeacher').isVisible());
  await page.click('#btnHelp');
  await page.waitForTimeout(120);
  check('how-to popup fits the phone viewport', await page.evaluate(() => {
    const b = document.querySelector('#helpModal .box').getBoundingClientRect();
    return b.left >= -1 && b.right <= window.innerWidth + 1 && b.height <= window.innerHeight + 1;
  }));
  await page.keyboard.press('Escape');
  await page.screenshot({ path: '/tmp/msu-9-mobile.png' });

  console.log('\n[11] Offline contract');
  check('request instrumentation actually observed loads (control)', requestsSeen > 0, requestsSeen + ' requests');
  check('nothing is fetched off-device at runtime', offDevice.length === 0, offDevice.slice(0, 3).join(' | ') || 'all local');

  console.log('\n' + (errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console/page errors'));
  if (errors.length) fails++;
  console.log(fails ? '\n' + fails + ' FAILURE(S)\n' : '\nALL UI CHECKS PASSED\n');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
