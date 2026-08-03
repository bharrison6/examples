/* UI smoke test: load the game headless, click through a level-3 periapsis
   escape using only the real UI controls, screenshot along the way. */
'use strict';
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/fg-1-help.png' });

  // close help, go to level 3 via Levels modal
  await page.click('#closeHelp');
  await page.click('#btnLevels');
  await page.waitForTimeout(200);
  await page.locator('.levelcard').nth(2).click();
  await page.waitForTimeout(300);

  // enable HUD, warp to periapsis
  await page.click('#btnHud');
  await page.click('#btnToPe');
  await page.waitForTimeout(2500); // let the fast-forward run
  const hudV = await page.textContent('#hudV');
  console.log('speed at (near) periapsis:', hudV);

  // plan a prograde burn of ~4.5 and commit
  await page.click('#btnPlanBurn');
  await page.waitForTimeout(200);
  await page.locator('#dvSlider').fill('4.5');
  await page.locator('#dvSlider').dispatchEvent('input');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/fg-2-planning.png' });
  await page.click('#btnCommitBurn');

  // warp hard and wait for escape debrief
  await page.click('[data-warp="200"]');
  let done = false;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(500);
    if (await page.locator('#debriefModal.show').count()) { done = true; break; }
  }
  console.log('escape debrief appeared:', done);
  await page.screenshot({ path: '/tmp/fg-3-debrief.png' });

  // leaderboard save
  if (done) {
    await page.fill('#dbName', 'TestBot');
    await page.click('#dbSave');
    await page.waitForTimeout(200);
    const lbRow = await page.locator('#dbLb td.dv').first().textContent();
    console.log('leaderboard best dv:', lbRow);
  }

  // teacher mode / projector toggle
  await page.click('#dbClose');
  await page.click('#btnTeacher');
  await page.click('#tgProjector');
  await page.waitForTimeout(200);
  const projector = await page.evaluate(() => document.body.classList.contains('projector'));
  console.log('projector mode toggled:', projector);
  await page.screenshot({ path: '/tmp/fg-4-teacher.png' });

  // finite-thrust level: commit a burn, watch it execute over time, cut it
  await page.click('#closeTeacher');
  await page.click('#btnLevels');
  await page.waitForTimeout(200);
  await page.locator('.levelcard').nth(5).click(); // Level 6: Ignition Window
  await page.waitForTimeout(300);
  const eng = await page.textContent('#engChip');
  console.log('L6 engine chip:', eng.trim());
  await page.click('#btnPlanBurn');
  await page.locator('#dvSlider').fill('3');
  await page.locator('#dvSlider').dispatchEvent('input');
  const cost = await page.textContent('#burncost');
  console.log('planner shows duration:', /Burn duration/.test(cost));
  await page.click('#btnCommitBurn');
  await page.waitForTimeout(400);
  const dvMid = parseFloat(await page.textContent('#dvChip'));
  const cutVisible = await page.locator('#btnCut').isVisible();
  console.log('burn executing over time (0 < dv < 3, cut visible):', dvMid > 0.05 && dvMid < 3 && cutVisible, `(dv=${dvMid})`);
  await page.click('#btnCut'); // cut mid-burn
  await page.waitForTimeout(400);
  const dvAfterCut = parseFloat(await page.textContent('#dvChip'));
  await page.waitForTimeout(800);
  const dvFinal = parseFloat(await page.textContent('#dvChip'));
  const finiteOk = dvMid > 0.05 && dvMid < 3 && cutVisible && dvAfterCut < 3 && Math.abs(dvFinal - dvAfterCut) < 0.001;
  console.log('cut engine stops spending:', Math.abs(dvFinal - dvAfterCut) < 0.001, `(settled at ${dvFinal})`);
  await page.screenshot({ path: '/tmp/fg-5-finite.png' });

  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console/page errors');
  await browser.close();
  process.exit(errors.length || !done || !finiteOk ? 1 : 0);
})();
