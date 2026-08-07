/* Bridge Works — headless UI playthrough.
   Drives the real game through the real controls: builds a truss by dragging on
   the canvas, runs load tests, checks the debrief, exercises the gallery, the
   teacher overload demo and the leaderboard. Screenshots land in /tmp.

     npm i playwright && node ui-smoke.js
*/
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

let failures = 0;
function check(name, cond, detail) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   [' + detail + ']' : ''));
  if (!cond) failures++;
}

(async () => {
  const executablePath = browserExecutable();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  /* the demo is offline by contract: nothing may leave the folder */
  const offSite = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('about:')) offSite.push(u);
  });

  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.waitForTimeout(600);

  console.log('[0] The how-to popup opens on load');
  const openHelp = async () => (await page.locator('#mHelp:not(.hidden)').count()) === 1;
  check('the how-to is showing on load', await openHelp());
  await page.screenshot({ path: '/tmp/bw-0-help.png' });
  await page.click('#hpClose');
  await page.waitForTimeout(200);
  check('  and the ✕ dismisses it', !(await openHelp()));

  /* world -> screen, so we can drag in metres */
  let box = await page.locator('#cv').boundingBox();
  let V = await page.evaluate(() => ({ s: BWGAME.view.s, ox: BWGAME.view.ox, oy: BWGAME.view.oy }));
  const SX = (x) => box.x + V.s * x + V.ox;
  const SY = (y) => box.y + V.oy - V.s * y;
  async function refreshView() {
    box = await page.locator('#cv').boundingBox();
    V = await page.evaluate(() => ({ s: BWGAME.view.s, ox: BWGAME.view.ox, oy: BWGAME.view.oy }));
  }
  async function drag(x1, y1, x2, y2) {
    await page.mouse.move(SX(x1), SY(y1));
    await page.mouse.down();
    await page.mouse.move(SX(x2), SY(y2), { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(50);
  }
  async function gotoLevel(i) {
    await page.click('#btnLevels');
    await page.waitForTimeout(200);
    await page.locator('#lvGrid .card').nth(i).click();
    await page.waitForTimeout(350);
    await refreshView();
  }
  async function waitForDebrief(maxWaitMs) {
    const until = Date.now() + (maxWaitMs || 25000);
    while (Date.now() < until) {
      if (await page.locator('#mDebrief:not(.hidden)').count()) return true;
      await page.waitForTimeout(200);
    }
    return false;
  }
  async function runTest(maxWaitMs) {
    await page.click('#btnTest');
    return waitForDebrief(maxWaitMs);
  }
  const txt = async (sel) => (await page.textContent(sel)).replace(/\s+/g, ' ').trim();

  console.log('\n[0a] Keyboard cards and canvas editing');
  await page.click('#btnLevels');
  await page.waitForTimeout(80);
  check('level cards are native named buttons', await page.evaluate(() => {
    const c = document.querySelector('#lvGrid .card');
    return c && c.tagName === 'BUTTON' && /Load level 1/.test(c.getAttribute('aria-label'));
  }));
  await page.locator('#lvGrid .card').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  check('Enter activates a level card', (await txt('#levelChip')).includes('First Crossing'));
  check('keyboard editing is off by default', await page.evaluate(() => !BWGAME.keyboard && document.getElementById('cv').tabIndex === -1));
  await page.click('#btnTeacher');
  await page.click('#tglKeyboard');
  await page.click('#tcClose');
  check('Teacher mode can enable the keyboard cursor', await page.evaluate(() => BWGAME.keyboard && document.getElementById('cv').tabIndex === 0));
  await page.locator('#cv').focus();
  await page.keyboard.press('b');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await page.keyboard.press('b');
  check('keyboard cursor builds a member on the canvas', await page.evaluate(() => BWGAME.members.length === 1 && /Cursor|Member/.test(document.getElementById('statusMsg').textContent)));
  await page.keyboard.press('e');
  check('keyboard cursor erases a member on the canvas', await page.evaluate(() => BWGAME.members.length === 0));

  /* ---------------------------------------------- 1. build and pass level 1 */
  console.log('\n[1] Level 1 — build a king-post truss with the mouse and test it');
  check('starts on level 1', (await txt('#levelChip')).includes('First Crossing'));
  check('test is refused with no roadway', await page.locator('#btnTest').isDisabled());

  await drag(5, 0, 8, 0);
  await drag(8, 0, 11, 0);
  check('deck complete re-enables the test', !(await page.locator('#btnTest').isDisabled()));
  await drag(8, 0, 8, 1);
  await drag(5, 0, 8, 1);
  await drag(8, 1, 11, 0);
  await page.waitForTimeout(200);
  check('5 members, 4 joints built by dragging',
        (await page.evaluate(() => BWGAME.members.length)) === 5 &&
        (await page.evaluate(() => BWGAME.nodes.length)) === 4);
  check('cost = steel by the metre + a charge per joint',
        (await txt('#costVal')) === '$962', await txt('#costVal'));
  check('  and the breakdown is shown', /steel \$602 · 2 joints \$360/.test(await txt('#costBreak')),
        await txt('#costBreak'));

  /* over-long members are refused */
  await drag(5, 0, 11, 0);
  check('a 6 m member is refused (4 m maximum)',
        (await page.evaluate(() => BWGAME.members.length)) === 5);

  await page.click('#tglNums');
  await page.waitForTimeout(150);
  await page.screenshot({ path: '/tmp/bw-1-built.png' });

  /* ------------------------------ 1b. the fold ghost must be length-exact */
  console.log('\n[1b] Fold ghost geometry — nothing may stretch');
  for (let k = 0; k < 3; k++) { await page.click('#btnUndo'); await page.waitForTimeout(120); }
  check('undoing back to the bare deck gives a mechanism',
        await page.evaluate(() => BWGAME.analysis && BWGAME.analysis.mechanism));
  let ghostOK = true, sawSlide = 0, samples = 0;
  for (let k = 0; k < 14; k++) {
    await page.waitForTimeout(220);
    const s = await page.evaluate(() => {
      const S = BWGAME;
      if (!S.ghost) return null;
      const err = Math.max.apply(null, S.members.map((m) => {
        const A = S.nodes[m.a], B = S.nodes[m.b];
        const rest = Math.hypot(B.x - A.x, B.y - A.y);
        const now = Math.hypot(S.ghost[m.b].x - S.ghost[m.a].x, S.ghost[m.b].y - S.ghost[m.a].y);
        return Math.abs(now - rest) / rest;
      }));
      let roller = 0;
      S.nodes.forEach((n, i) => {
        if (n.anchor && n.type === 'roller') roller = Math.abs(S.ghost[i].x - n.x);
      });
      return { err: err, roller: roller };
    });
    if (!s) continue;
    samples++;
    if (s.err > 1e-4) ghostOK = false;
    sawSlide = Math.max(sawSlide, s.roller);
  }
  check('every drawn member keeps its exact length through the whole fold',
        ghostOK && samples > 4, samples + ' frames sampled');
  check('the sliding bearing travels inboard to allow it',
        sawSlide > 0.2, 'roller slides ' + sawSlide.toFixed(2) + ' m');
  await page.screenshot({ path: '/tmp/bw-1b-fold.png' });
  await drag(8, 0, 8, 1); await drag(5, 0, 8, 1); await drag(8, 1, 11, 0);
  await page.waitForTimeout(250);
  check('rebuilding the truss clears the mechanism',
        await page.evaluate(() => !BWGAME.analysis.mechanism));

  /* ------------------------------------------------- 2. free-body inspector */
  console.log('\n[2] Free-body inspector');
  await page.click('[data-tool=inspect]');
  await page.mouse.click(SX(8), SY(1));
  await page.waitForTimeout(300);
  const fbd = await txt('#fbd');
  check('clicking the apex opens a free-body panel', fbd.includes('Joint'));
  check('forces at the joint sum to zero', /Σ = 0\.0, 0\.0 kN/.test(fbd), fbd.slice(-60));
  check('  both struts are named as compression', (fbd.match(/\(C\)/g) || []).length === 2);
  check('  the king post is named as tension', (fbd.match(/\(T\)/g) || []).length === 1);
  await page.screenshot({ path: '/tmp/bw-2-freebody.png' });
  await page.click('[data-tool=build]');

  /* ------------------------------------------------------ 3. the load test */
  console.log('\n[3] Load test and debrief');
  check('the crossing completes and a debrief appears', await runTest());
  check('the bridge held', (await txt('.verdict')).includes('It held'));
  check('under par', (await txt('#dbBody')).includes('−$88'), await txt('.stat .v.good'));
  check('  debrief splits steel from connections',
        (await txt('#dbBody')).includes('Connections') && (await txt('#dbBody')).includes('Steel'));
  const table = await txt('#dbBody table.data');
  check('the debrief lists every member with its worst force', (await page.locator('#dbBody table.data tr').count()) === 6);
  check('  and quotes a length-dependent buckling capacity', table.includes('72 kN') && table.includes('180 kN'));
  check('the plain-language note mentions the compression trade',
        (await txt('.plain')).toLowerCase().includes('compression'));
  await page.screenshot({ path: '/tmp/bw-3-debrief.png' });

  /* ------------------------------------------------------ 4. leaderboard */
  console.log('\n[4] Leaderboard');
  await page.locator('#dbName').fill('Room 12');
  await page.click('#dbSave');
  await page.waitForTimeout(300);
  const board = await txt('#bdBody');
  check('a surviving run is saved to the class board', board.includes('Room 12') && board.includes('$962'));
  await page.screenshot({ path: '/tmp/bw-4-board.png' });
  await page.click('#bdClose');

  /* --------------------------------- 5. teacher overload -> progressive collapse */
  console.log('\n[5] Teacher demo — overload the same bridge');
  await page.click('#btnTeacher');
  await page.waitForTimeout(200);
  await page.click('#tglOverload');
  await page.click('#tcClose');
  await page.waitForTimeout(200);
  check('the vehicle picker appears', await page.locator('#vehGroup').isVisible());
  await page.selectOption('#vehSel', 'tipper');  // the crane is longer than a 6 m span
  await page.waitForTimeout(200);
  await page.click('#btnTest');
  /* watch for the collapse while it is happening, before the debrief covers it */
  let fell = false, brokeCount = 0, debris = 0;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(100);
    const st = await page.evaluate(() => ({
      coll: !!BWGAME.coll, broke: BWGAME.test ? BWGAME.test.broke.length : 0,
      debris: BWGAME.debris.length
    }));
    fell = fell || st.coll;
    brokeCount = Math.max(brokeCount, st.broke);
    debris = Math.max(debris, st.debris);
    if (st.coll && i > 6) break;
  }
  await page.screenshot({ path: '/tmp/bw-5-collapsing.png' });
  check('a member snapped under the 12 t tipper', brokeCount >= 1, brokeCount + ' member(s)');
  check('and the remains collapsed', fell);
  check('debris is flying', debris > 0, debris + ' pieces');
  await waitForDebrief();
  check('the debrief reports failure', (await txt('.verdict')).includes('It failed'));
  check('  demo runs are kept off the leaderboard', await page.locator('#dbSave').isHidden());
  await page.screenshot({ path: '/tmp/bw-6-fail-debrief.png' });

  /* every way of dismissing the debrief must hand the canvas back */
  for (const [how, act] of [
    ['the ✕ button', async () => page.click('#dbClose')],
    ['a backdrop click', async () => page.mouse.click(20, 450)],
    ['the Escape key', async () => page.keyboard.press('Escape')],
    ['"Back to build"', async () => page.click('#dbRetry')]
  ]) {
    if (!(await page.locator('#mDebrief:not(.hidden)').count())) {
      await page.click('#btnTest');
      await waitForDebrief();
    }
    await act();
    await page.waitForTimeout(350);
    const before = await page.evaluate(() => BWGAME.members.length);
    await drag(8, 0, 8, 2);
    const after = await page.evaluate(() => BWGAME.members.length);
    check('dismissing with ' + how + ' returns to the build phase',
          (await page.evaluate(() => BWGAME.phase)) === 'build' && after > before);
    if (after > before) { await page.click('#btnUndo'); await page.waitForTimeout(150); }
  }
  await page.selectOption('#vehSel', 'car');
  await page.waitForTimeout(150);

  /* ------------------------------- 6. level 2: the rectangle that folds */
  console.log('\n[6] Level 2 — the un-triangulated frame folds, diagonals fix it');
  await gotoLevel(1);
  check('level 2 opens with the rectangular frame prebuilt',
        (await page.evaluate(() => BWGAME.members.length)) === 13);
  check('X-ray warns it is a mechanism before testing',
        await page.evaluate(() => !!(BWGAME.analysis && BWGAME.analysis.mechanism)));
  check('  and counts the independent folds (one per un-braced panel)',
        (await page.evaluate(() => BWGAME.analysis.nullity)) === 4,
        'nullity ' + (await page.evaluate(() => BWGAME.analysis.nullity)));
  check('  with a drawable ghost for each one',
        (await page.evaluate(() => (BWGAME.analysis.modes || []).length)) === 4);
  await page.screenshot({ path: '/tmp/bw-7-ladder.png' });
  await page.click('#btnTest');
  let collapseFrames = 0, collapseLengthExact = true, collapseRollerFixed = true,
      collapseRollerConstraint = true, collapseRollerSlide = 0;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(70);
    const sample = await page.evaluate(() => {
      const C = BWGAME.coll, S = BWGAME;
      if (!C || C.fall) return null;
      let err = 0, rollerY = 0, roller = null;
      C.links.forEach((link) => {
        const now = Math.hypot(C.p[link.b].x - C.p[link.a].x, C.p[link.b].y - C.p[link.a].y);
        err = Math.max(err, Math.abs(now - link.rest) / link.rest);
      });
      S.nodes.forEach((n, i) => {
        if (n.type !== 'roller') return;
        rollerY = Math.max(rollerY, Math.abs(C.p[i].y - n.y));
        roller = { fixX: C.p[i].fixX, fixY: C.p[i].fixY, slide: Math.abs(C.p[i].x - n.x) };
      });
      return { err, rollerY, roller };
    });
    if (sample) {
      collapseFrames++; collapseLengthExact = collapseLengthExact && sample.err < 1e-4;
      collapseRollerFixed = collapseRollerFixed && sample.rollerY < 1e-9;
      collapseRollerConstraint = collapseRollerConstraint && !!sample.roller && sample.roller.fixY === true && sample.roller.fixX === false;
      collapseRollerSlide = Math.max(collapseRollerSlide, sample.roller ? sample.roller.slide : 0);
    }
  }
  check('actual phase-one collapse frames use projected, length-exact geometry',
        collapseFrames > 2 && collapseLengthExact && collapseRollerFixed &&
        collapseRollerConstraint && collapseRollerSlide > 0.02,
        collapseFrames + ' frames; roller slide ' + collapseRollerSlide.toFixed(2) + ' m');
  await page.waitForTimeout(150);
  await page.screenshot({ path: '/tmp/bw-8-folding.png' });
  check('the frame is visibly folding along the solver\'s mechanism mode',
        await page.evaluate(() => !!BWGAME.coll));
  await waitForDebrief();
  check('it fails as a mechanism', (await txt('#dbBody')).includes('mechanism'));
  check('  no member ever carried force', (await txt('#dbBody')).includes('How it moved'));
  check('  and the debrief names the joints that ran away',
        (await page.locator('#dbBody table.data tr').count()) > 1);
  await page.screenshot({ path: '/tmp/bw-9-mech-debrief.png' });
  await page.click('#dbRetry');
  await refreshView();

  /* add a diagonal to each panel of the existing frame — each one should
     remove exactly one degree of freedom */
  const nullities = [];
  for (const x of [2, 5, 8, 11]) {
    await drag(x, 0, x + 3, 2.5);
    nullities.push(await page.evaluate(() =>
      BWGAME.analysis.mechanism ? BWGAME.analysis.nullity : 0));
  }
  check('each diagonal removes exactly one fold', nullities.join(',') === '3,2,1,0',
        '4 → ' + nullities.join(' → '));
  await page.waitForTimeout(200);
  check('adding one diagonal per panel makes it rigid',
        await page.evaluate(() => !!(BWGAME.analysis && !BWGAME.analysis.mechanism)));
  await page.screenshot({ path: '/tmp/bw-10-braced.png' });
  await runTest();
  check('the same frame now survives the crossing', (await txt('.verdict')).includes('It held'));
  await page.click('#dbRetry');

  /* ---------------------------------------------- 7. gallery: Warren pattern */
  console.log('\n[7] Gallery — the Warren alternating pattern on screen');
  await page.click('#btnGallery');
  await page.waitForTimeout(300);
  check('all four famous trusses are offered', (await page.locator('#glGrid .card').count()) === 4);
  await page.locator('#glN').fill('6');
  await page.locator('#glN').dispatchEvent('input');
  await page.locator('#glH').fill('4');
  await page.locator('#glH').dispatchEvent('input');
  await page.waitForTimeout(250);
  await page.screenshot({ path: '/tmp/bw-11-gallery.png' });
  await page.locator('#glGrid .card').nth(2).click();   // Warren
  await page.waitForTimeout(400);
  const pattern = await page.evaluate(() => {
    const S = BWGAME, a = S.analysis, out = [];
    S.members.forEach((m, i) => {
      const A = S.nodes[m.a], B = S.nodes[m.b];
      if (Math.abs(A.y - B.y) < 1e-9) return;
      out.push({ x: (A.x + B.x) / 2, s: a.force[i] > 0 ? 'T' : 'C' });
    });
    out.sort((p, q) => p.x - q.x);
    return out.map((o) => o.s).join('');
  });
  /* a Warren mirrors at mid-span, so exactly one adjacent pair repeats */
  let repeats = 0;
  for (let k = 1; k < pattern.length; k++) if (pattern[k] === pattern[k - 1]) repeats++;
  check('X-ray shows the diagonals alternating T/C along the span', repeats === 1, pattern);
  check('  with both halves mirrored about mid-span',
        pattern.slice(0, pattern.length / 2) ===
        pattern.slice(pattern.length / 2).split('').reverse().join(''), pattern);
  await page.screenshot({ path: '/tmp/bw-12-warren-xray.png' });

  /* --------------------------------------------------- 8. remaining levels */
  console.log('\n[8] Remaining levels load and render');
  for (const [i, name] of [[2, 'Heavy Haul'], [3, 'High Water'], [4, 'Island Pier'], [5, 'Sandbox']]) {
    await gotoLevel(i);
    check(name + ' loads', (await txt('#levelChip')).includes(name));
    await page.screenshot({ path: '/tmp/bw-13-level' + (i + 1) + '.png' });
  }
  check('the sandbox exposes the vehicle picker', await page.locator('#vehGroup').isVisible());

  /* ------------------------------------------------------ 9. projector mode */
  console.log('\n[9] Projector mode');
  await page.click('#btnTeacher');
  await page.waitForTimeout(200);
  await page.click('#tglBig');
  await page.click('#tcClose');
  await page.waitForTimeout(400);
  check('large-UI mode applies', await page.evaluate(() => document.body.classList.contains('big')));
  await page.screenshot({ path: '/tmp/bw-14-projector.png' });

  /* ------------------------------------------- 10. joints must really join */
  console.log('\n[10] A joint dropped on a member splits it');
  await page.click('#btnTeacher');            // back to normal UI scale first
  await page.waitForTimeout(200);
  await page.click('#tglBig');
  await page.click('#tcClose');
  await page.waitForTimeout(400);
  await gotoLevel(0);
  await page.click('#btnClear');
  await page.waitForTimeout(250);
  const memberList = async () => page.evaluate(() => BWGAME.members.map((m) =>
    '(' + BWGAME.nodes[m.a].x + ',' + BWGAME.nodes[m.a].y + ')-(' +
          BWGAME.nodes[m.b].x + ',' + BWGAME.nodes[m.b].y + ')'));
  await drag(5, 0, 8, 0);
  await drag(8, 0, 11, 0);
  await drag(6.5, 0, 6.5, 1.5);           // post rising from mid-member
  let ms = await memberList();
  check('a joint placed on a member splits it in two',
        ms.includes('(5,0)-(6.5,0)') && ms.includes('(6.5,0)-(8,0)') &&
        !ms.includes('(5,0)-(8,0)'), ms.length + ' members');
  check('  and splitting only adds the new connection, not extra steel',
        (await txt('#costBreak')).indexOf('steel $339') === 0, await txt('#costBreak'));
  check('  so the new joint is structurally connected, not just sitting on top',
        await page.evaluate(() => {
          const S = BWGAME;
          let n = -1;
          S.nodes.forEach((q, i) => { if (q.x === 6.5 && q.y === 0) n = i; });
          return S.members.filter((m) => m.a === n || m.b === n).length === 3;
        }));
  await page.click('#btnClear');
  await page.waitForTimeout(200);
  await drag(5, 0, 6.5, 0);
  await drag(6.5, 0, 6.5, 1.5);
  await drag(5, 0, 8, 0);                 // drawn straight through the existing joint
  ms = await memberList();
  check('a member drawn through an existing joint is split too',
        !ms.includes('(5,0)-(8,0)') && ms.includes('(6.5,0)-(8,0)'), ms.join(' '));
  await page.screenshot({ path: '/tmp/bw-15-weld.png' });

  /* -------------------- 11. erasing must not leave a structural scar */
  console.log('\n[11] Erase leaves no scar, and unbraced roadway joints are flagged');
  await gotoLevel(3);
  await page.click('#btnClear');
  await page.waitForTimeout(200);
  await page.click('#btnGallery');
  await page.waitForTimeout(300);
  await page.locator('#glN').fill('6'); await page.locator('#glN').dispatchEvent('input');
  await page.locator('#glH').fill('4'); await page.locator('#glH').dispatchEvent('input');
  await page.waitForTimeout(200);
  await page.locator('#glGrid .card').nth(2).click();
  await page.waitForTimeout(400);
  const canon = () => page.evaluate(() => ({
    n: BWGAME.nodes.map((n) => n.x + ',' + n.y).sort().join('|'),
    m: BWGAME.members.map((m) => {
      const A = BWGAME.nodes[m.a], B = BWGAME.nodes[m.b];
      return [A.x + ',' + A.y, B.x + ',' + B.y].sort().join('-');
    }).sort().join('|')
  }));
  const before = await canon();
  const costBefore = await txt('#costVal');
  check('a clean Warren has no unbraced roadway joints',
        (await page.evaluate(() => BWGAME.unbraced.length)) === 0);

  await drag(3, 0, 3, 1);                       // post from a panel MIDPOINT splits the deck
  check('  drawing to a panel midpoint splits the deck member',
        (await page.evaluate(() => BWGAME.unbraced.length)) === 0);
  await page.click('[data-tool=erase]');
  await page.waitForTimeout(120);
  await page.mouse.click(SX(3), SY(0.5));       // erase it again
  await page.waitForTimeout(300);
  await page.click('[data-tool=build]');
  await page.waitForTimeout(250);
  const after = await canon();
  check('erasing it restores the exact original topology',
        after.m === before.m && after.n === before.n);
  check('  and the exact original cost', (await txt('#costVal')) === costBefore,
        costBefore + ' -> ' + (await txt('#costVal')));
  check('  leaving no unbraced roadway joint behind',
        (await page.evaluate(() => BWGAME.unbraced.length)) === 0);

  /* a bare deck: every panel joint is unbraced and must be called out */
  await page.click('#btnClear');
  await page.waitForTimeout(200);
  for (const x of [2, 5, 8, 11]) await drag(x, 0, x + 3, 0);
  await page.waitForTimeout(300);
  check('a bare roadway flags every unbraced panel joint',
        (await page.evaluate(() => BWGAME.unbraced.length)) === 3,
        (await page.evaluate(() => BWGAME.unbraced.length)) + ' flagged');
  check('  with an explanation, before the test rather than during it',
        /nothing bracing/.test(await txt('#statusMsg')), await txt('#statusMsg'));
  await page.screenshot({ path: '/tmp/bw-16-unbraced.png' });

  /* ------------ 12. two joints must never occupy the same point ---------- */
  console.log('\n[12] Joints never stack, even when the grid clamps');
  await gotoLevel(3);                       // level 4 forbids building below the deck
  await page.click('#btnClear');
  await page.waitForTimeout(200);
  await drag(2, 0, 5, 0);
  await drag(5, 0, 8, 0);
  await drag(5, 0, 7, 2);
  const n0 = await page.evaluate(() => BWGAME.nodes.length);
  /* a pointer BELOW the deck clamps up onto the deck line and lands on the
     joint at (5,0) — further from the pointer than the snap radius */
  await drag(5, -0.5, 6.5, 1.5);
  const st12 = await page.evaluate(() => ({
    n: BWGAME.nodes.length,
    dup: BWGAME.nodes.some((a, i) => BWGAME.nodes.some((b, j) =>
      j > i && Math.hypot(a.x - b.x, a.y - b.y) < 1e-9)),
    atJoint: BWGAME.members.filter((m) => {
      const A = BWGAME.nodes[m.a], B = BWGAME.nodes[m.b];
      return (A.x === 5 && A.y === 0) || (B.x === 5 && B.y === 0);
    }).length
  }));
  check('dragging from a forbidden spot does not stack a second joint', !st12.dup);
  check('  it attaches to the joint already there', st12.n === n0 + 1,
        n0 + ' joints -> ' + st12.n);
  check('  so every member meeting there is on the same joint', st12.atJoint === 3,
        st12.atJoint + ' members at (5,0)');

  /* the confusing case from the field: several members meet, still unbraced */
  await page.click('#btnClear');
  await page.waitForTimeout(200);
  await drag(2, 0, 5, 0); await drag(5, 0, 8, 0); await drag(5, 0, 6.5, 0);
  await page.waitForTimeout(250);
  await page.click('[data-tool=inspect]');
  await page.waitForTimeout(120);
  await page.mouse.click(SX(5), SY(0));
  await page.waitForTimeout(350);
  const ub = (await txt('#fbd'));
  check('an unbraced joint explains itself instead of just being flagged',
        /all lie along the same straight line/.test(ub) && /nothing bracing it/.test(ub));
  await page.click('[data-tool=build]');
  await page.waitForTimeout(150);

  /* a short randomised edit session, checking the invariants after each step */
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const spots = [];
  for (let x = 1.4; x <= 14.6; x += 0.53)
    for (let y = -1.2; y <= 4.4; y += 0.47) spots.push([+x.toFixed(3), +y.toFixed(3)]);
  let broke = null, done = 0;
  for (let k = 0; k < 70 && !broke; k++) {
    if (rnd() < 0.72) {
      const a = spots[Math.floor(rnd() * spots.length)], c = spots[Math.floor(rnd() * spots.length)];
      if (Math.hypot(a[0] - c[0], a[1] - c[1]) > 4.2) continue;
      await page.mouse.move(SX(a[0]), SY(a[1]));
      await page.mouse.down();
      await page.mouse.move(SX(c[0]), SY(c[1]), { steps: 3 });
      await page.mouse.up();
    } else {
      await page.click('[data-tool=erase]');
      const a = spots[Math.floor(rnd() * spots.length)];
      await page.mouse.click(SX(a[0]), SY(a[1]));
      await page.click('[data-tool=build]');
    }
    done++;
    await page.waitForTimeout(16);
    broke = await page.evaluate(() => {
      const S = BWGAME, bad = [];
      for (let i = 0; i < S.nodes.length; i++)
        for (let j = i + 1; j < S.nodes.length; j++)
          if (Math.hypot(S.nodes[i].x - S.nodes[j].x, S.nodes[i].y - S.nodes[j].y) < 1e-9)
            bad.push('two joints at (' + S.nodes[i].x + ',' + S.nodes[i].y + ')');
      S.members.forEach((m, k2) => {
        const A = S.nodes[m.a], B = S.nodes[m.b];
        if (!A || !B) bad.push('member ' + k2 + ' dangling');
        else if (Math.hypot(B.x - A.x, B.y - A.y) < 1e-9) bad.push('zero-length member ' + k2);
      });
      S.unbraced.forEach((n) => {
        const d = [];
        S.members.forEach((m) => {
          if (m.a !== n && m.b !== n) return;
          const o = m.a === n ? m.b : m.a;
          const dx = S.nodes[o].x - S.nodes[n].x, dy = S.nodes[o].y - S.nodes[n].y;
          const L = Math.hypot(dx, dy);
          if (L > 1e-9) d.push([dx / L, dy / L]);
        });
        for (let i = 0; i < d.length; i++)
          for (let j = i + 1; j < d.length; j++)
            if (Math.abs(d[i][0] * d[j][1] - d[i][1] * d[j][0]) > 1e-6)
              bad.push('joint flagged unbraced but braced in 2 directions');
      });
      return bad.length ? bad[0] : null;
    });
  }
  check('a randomised edit session keeps every editor invariant',
        !broke, broke || done + ' random draw/erase operations');
  await page.screenshot({ path: '/tmp/bw-17-fuzz.png' });

  /* --------------------------- 13. contract UX: how-to, settings, presenter notes */
  console.log('\n[13] Contract UX — reopenable how-to, settings, presenter notes');
  await page.click('#btnHelp');
  await page.waitForTimeout(150);
  check('the ? control reopens the how-to', await openHelp());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check('  Escape dismisses it', !(await openHelp()));
  await page.click('#btnHelp');
  await page.waitForTimeout(150);
  await page.mouse.click(8, 450);                 // backdrop, well clear of the sheet
  await page.waitForTimeout(150);
  check('  a tap outside dismisses it', !(await openHelp()));
  await page.click('#btnHelp');
  await page.waitForTimeout(150);
  await page.click('#hpStart');
  await page.waitForTimeout(150);
  check('  "Start building" dismisses it', !(await openHelp()));

  const openNotes = async () => (await page.locator('#mNotes:not(.hidden)').count()) === 1;
  await page.click('#btnTeacher');
  await page.waitForTimeout(200);
  check('the ⚙ button opens a settings menu', (await txt('#mTeacher h2')) === 'Settings');
  check('  which offers presentation mode', (await txt('#mTeacher')).includes('Presentation mode'));
  await page.click('#btnNotesOpen');
  await page.waitForTimeout(200);
  check("  and opens the presenter's notes", await openNotes());
  const notes = await txt('#mNotes');
  check('    carrying the run of show', notes.includes('Run of show') && notes.includes('method of joints'));
  check('    and the numbers a presenter needs',
        notes.includes('300 kN') && notes.includes('$180 per joint') && notes.includes('720 kN'));
  await page.screenshot({ path: '/tmp/bw-18-notes.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check('    Escape closes the notes', !(await openNotes()));

  check('the notes shortcut is hidden until presentation mode is on', await page.locator('#btnNotes').isHidden());
  await page.click('#btnTeacher');
  await page.waitForTimeout(200);
  await page.click('#tglBig');
  await page.click('#tcClose');
  await page.waitForTimeout(300);
  check('presentation mode puts a notes button in the top bar', await page.locator('#btnNotes').isVisible());
  await page.click('#btnNotes');
  await page.waitForTimeout(200);
  check('  and it opens the notes', await openNotes());
  await page.keyboard.press('Escape');
  await page.click('#btnTeacher');
  await page.waitForTimeout(200);
  await page.click('#tglBig');                 // back to normal scale
  await page.click('#tcClose');
  await page.waitForTimeout(300);

  check('the attribution is visible', await page.locator('.bh-credit').isVisible());
  check('  naming author and institution',
        (await txt('.bh-credit')).includes('Bryant Harrison') &&
        (await txt('.bh-credit')).includes('Murray State University'));

  /* ------------------------------------------------- 14. the new UI on a phone */
  console.log('\n[14] Phone viewport');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.click('#btnHelp');
  await page.waitForTimeout(250);
  const hb = await page.locator('#mHelp .sheet').boundingBox();
  check('the how-to fits a phone screen', hb.width <= 390 && hb.height <= 844,
        Math.round(hb.width) + 'x' + Math.round(hb.height));
  await page.screenshot({ path: '/tmp/bw-19-phone-help.png' });
  await page.click('#hpStart');
  await page.waitForTimeout(200);
  await page.click('#btnTeacher');
  await page.waitForTimeout(200);
  await page.click('#btnNotesOpen');
  await page.waitForTimeout(250);
  const nb = await page.locator('#mNotes .sheet').boundingBox();
  check('  so do the presenter notes', nb.width <= 390, Math.round(nb.width) + ' wide');
  await page.screenshot({ path: '/tmp/bw-20-phone-notes.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('  the ? control stays reachable', await page.locator('#btnHelp').isVisible());
  check('  the ⚙ control stays reachable', await page.locator('#btnTeacher').isVisible());
  check('  the attribution stays visible', await page.locator('.bh-credit').isVisible());
  await gotoLevel(0);
  await page.click('#btnClear');
  await page.waitForTimeout(250);
  await refreshView();
  const beforePhone = await page.evaluate(() => BWGAME.members.length);
  await drag(5, 0, 8, 0);
  await page.waitForTimeout(200);
  check('  and drawing on the canvas still works at phone size',
        (await page.evaluate(() => BWGAME.members.length)) === beforePhone + 1);
  await page.screenshot({ path: '/tmp/bw-21-phone-game.png' });
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForTimeout(300);

  check('nothing off-device was requested', offSite.length === 0, offSite.join(', '));

  console.log('\nJS errors: ' + (errors.length ? errors.join(' | ') : 'none'));
  if (errors.length) failures += errors.length;
  console.log(failures ? '\n✖ ' + failures + ' UI check(s) failed' : '\n✔ all UI checks passed');
  await browser.close();
  process.exit(failures ? 1 : 0);
})();
