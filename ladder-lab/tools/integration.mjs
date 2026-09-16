/* Integration playtest: drives index.html in headless Chromium.
   Covers the 5 required playtest checks + UI smoke screenshots.

   UPDATED for the lesson-shell v2 retrofit (2026-09): dist/ is retired
   (recycled — it was a stale duplicate of this demo-root index.html sitting
   in the public URL space), so this now targets the demo root directly, and
   every selector touching the old topbar/mode-tabs/teacher-menu/how-to-sheet
   chrome is updated to the shared kit's markup (../tools/lesson-shell/). The
   engine-level assertions (scan counting, key-held-across-scan, program
   determinism) are untouched — none of them ever referenced page chrome.

   NOT RE-RUN in this environment: no Playwright install here, a pre-existing,
   fleet-wide condition tracked by [[task-run-playwright-suites-after-contract-pass]]
   (confirmed also true for two-winters' own tools/ui.test.cjs, which the P2
   lane found already stale against kit v2 and left that way — there is no
   "known-good" kit-v2 Playwright reference in this repo to diff against).
   This pass is therefore a correctness-by-reading update, not a verified one;
   the shots-integration/ output directory this script writes to is likewise
   no longer git-tracked (also recycled), so a future run's screenshots stay
   local unless someone re-adds them deliberately. */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL = 'file://' + path.join(HERE, '..', 'index.html');
const SHOTS = path.join(HERE, '..', 'shots-integration');
fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0;
function check(name, cond, detail) {
  const ok = !!cond;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  -- ' + detail));
  if (!ok) failures++;
}

const LOCAL = [process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium']
  .find(p => p && fs.existsSync(p));
const browser = await chromium.launch({ headless: true, ...(LOCAL ? { executablePath: LOCAL } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(String(e)));

await page.goto(URL);
await page.waitForTimeout(1200);

/* ---------- required UX: the Guide greets every load (shell-owned) ---------- */
check('Guide is shown on load', await page.evaluate(() => document.getElementById('guide').open));
const howtoText = await page.textContent('#guide');
check('Guide explains Trainer, Editor, Challenges and Troubleshoot',
  /trainer/i.test(howtoText) && /editor/i.test(howtoText) && /challenges/i.test(howtoText) && /troubleshoot/i.test(howtoText), howtoText.slice(0, 60));
await page.screenshot({ path: SHOTS + '/16-howto.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('Escape dismisses the Guide', await page.evaluate(() => !document.getElementById('guide').open));
await page.click('#guide-open');
await page.waitForTimeout(200);
check('the always-visible ? control reopens the Guide', await page.evaluate(() => document.getElementById('guide').open));
await page.mouse.click(6, 6);   /* backdrop tap */
await page.waitForTimeout(200);
check('tapping outside dismisses the Guide', await page.evaluate(() => !document.getElementById('guide').open));

await page.screenshot({ path: SHOTS + '/01-trainer.png' });
check('loads without console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

/* helper: run n scans synchronously inside the page (paused app), full tick order */
const tickN = (n) => page.evaluate((n) => {
  const A = window.LL.App;
  for (let i = 0; i < n; i++) { window.LL.Sim.prePlcTick(A.plc); A.plc.scan(); window.LL.Sim.postPlcTick(A.plc, A.plc.scanMs); }
  return { scan: A.plc.scanCount, out: A.plc.outputs(), bits: JSON.parse(JSON.stringify(A.plc.bits)) };
}, n);

/* ---------- (1) engine self-test in the real browser (includes TON 5 s check) ---------- */
const st = await page.evaluate(() => window.LL.Engine.runSelfTests());
check('(1) in-browser engine self-tests (TON 5s DN/reset among them): 0 failures',
  st.failed === 0, st.results.filter(r => !r.pass).map(r => r.name).join('; '));

/* explicit TON check at app level */
const ton = await page.evaluate(() => {
  const p = new window.LL.Engine.PLC({ id: 't', name: 't', rungs: [{ items: [{ t: 'XIC', tag: 'PB_START' }, { t: 'TON', tag: 'T1', pre: 5000 }] }] }, { scanMs: 20 });
  p.setPhysicalInput('PB_START', true);
  let dnAt = -1;
  for (let i = 1; i <= 260; i++) { p.scan(); if (dnAt < 0 && p.timers.T1.DN) dnAt = i; }
  const accAtDn = p.timers.T1.ACC;
  p.setPhysicalInput('PB_START', false);
  p.scan();
  return { dnAt, accAtDn, afterFalse: { ACC: p.timers.T1.ACC, DN: p.timers.T1.DN, TT: p.timers.T1.TT } };
});
check('(1) TON 5000ms @20ms: DN at scan 250 of rung-true', ton.dnAt === 250, JSON.stringify(ton));
check('(1) TON resets when rung goes false', ton.afterFalse.ACC === 0 && !ton.afterFalse.DN && !ton.afterFalse.TT, JSON.stringify(ton.afterFalse));

/* ---------- (2) seal-in via the ACTUAL sim panel buttons, in step mode ---------- */
await page.selectOption('#program-select', 'motor_sealin');
await page.click('#btn-run'); // pause
await page.waitForTimeout(100);
const startBtn = page.locator('.sim-ctl[data-ctl="PB_START"] button, .sim-ctl[data-ctl="PB_START"] .sim-btn').first();
const stopBtn = page.locator('.sim-ctl[data-ctl="PB_STOP"] button, .sim-ctl[data-ctl="PB_STOP"] .sim-btn').first();
await startBtn.dispatchEvent('pointerdown');
await startBtn.dispatchEvent('pointerup'); // momentary click released BEFORE the scan — pulse latch must still catch it
let r = await tickN(1);
check('(2) momentary START press latches MOTOR on next scan', r.out.MOTOR === 1, JSON.stringify(r.out));
r = await tickN(5);
check('(2) MOTOR stays sealed in after release', r.out.MOTOR === 1);
await stopBtn.dispatchEvent('pointerdown');
await stopBtn.dispatchEvent('pointerup');
r = await tickN(1);
check('(2) STOP press releases the seal-in', r.out.MOTOR === 0, JSON.stringify(r.out));
await page.screenshot({ path: SHOTS + '/02-sealin-step.png' });

/* ---------- (3) scan-order demo A vs B in step mode ---------- */
await page.selectOption('#program-select', 'scan_order_demo_a');
await page.waitForTimeout(100);
const demo = await page.evaluate(() => {
  const A = window.LL.App;
  function run(id) {
    A.loadById(id);
    const plc = A.plc;
    plc.setPhysicalInput('PB_START', true);
    const hist = [];
    for (let i = 0; i < 3; i++) { plc.scan(); hist.push({ SRC: plc.bits.B_SRC | 0, ECHO: plc.bits.B_ECHO | 0 }); }
    return hist;
  }
  return { A: run('scan_order_demo_a'), B: run('scan_order_demo_b') };
});
const a = demo.A, b = demo.B;
check('(3) order A: B_SRC on in scan1 but B_ECHO lags one scan', a[0].SRC === 1 && a[0].ECHO === 0 && a[1].ECHO === 1, JSON.stringify(a));
check('(3) order B: B_ECHO updates same scan', b[0].SRC === 1 && b[0].ECHO === 1, JSON.stringify(b));
check('(3) same two rungs, opposite order, visibly different', a[0].ECHO !== b[0].ECHO);
await page.screenshot({ path: SHOTS + '/03-scanorder.png' });

/* ---------- (4) program 1 never dual-green, even with a fault active in ANOTHER program ---------- */
const dual = await page.evaluate(() => {
  const A = window.LL.App, LL = window.LL;
  // inject a fault into the ped program (an OTHER program), as the fault panel would
  const patched = LL.Faults.applyById('ped_walk_latched');
  A.bus.emit('fault:injected', { programId: 'stoplight_ped', program: patched });
  // now select program 1 fresh (as a student would from the selector)
  A.loadById('stoplight_basic');
  const plc = A.plc;
  let conflict = 0, greens = 0;
  for (let i = 0; i < 15000; i++) {   // 300 s simulated
    plc.scan();
    const o = plc.outputs();
    if (o.NS_GRN && o.EW_GRN) conflict++;
    if (o.NS_GRN || o.EW_GRN) greens++;
  }
  return { conflict, greens, scans: plc.scanCount };
});
check('(4) program 1: zero dual-green over 15000 scans with fault active elsewhere', dual.conflict === 0 && dual.greens > 1000, JSON.stringify(dual));

/* also: fault in program 1 itself is contained — reloading pristine clears it */
const contain = await page.evaluate(() => {
  const A = window.LL.App, LL = window.LL;
  const patched = LL.Faults.applyById('basic_no_interlock_overlap');
  A.bus.emit('fault:injected', { programId: 'stoplight_basic', program: patched });
  let sawConflict = false;
  for (let i = 0; i < 6000; i++) { A.plc.scan(); const o = A.plc.outputs(); if (o.NS_GRN && o.EW_GRN) { sawConflict = true; break; } }
  A.loadById('stoplight_basic'); // pristine again
  let clean = true;
  for (let i = 0; i < 6000; i++) { A.plc.scan(); const o = A.plc.outputs(); if (o.NS_GRN && o.EW_GRN) { clean = false; break; } }
  return { sawConflict, clean };
});
check('(4b) interlock fault DOES conflict when injected, pristine reload is clean again', contain.sawConflict && contain.clean, JSON.stringify(contain));

/* ---------- (5) crosswalk honored at next safe phase, never mid-phase ---------- */
const ped = await page.evaluate(() => {
  const A = window.LL.App;
  A.loadById('stoplight_ped');
  const plc = A.plc;
  // run until we are INSIDE an EW-green phase
  let i = 0;
  while (!(plc.outputs().EW_GRN) && i++ < 5000) plc.scan();
  for (let k = 0; k < 20; k++) plc.scan(); // well inside the phase
  plc.pulseInput('PED_NS');               // press the button mid-phase
  let walkAt = -1, nsGrnAt = -1, walkDuringEwGrn = false, walkOffAt = -1;
  for (let s = 0; s < 4000; s++) {
    plc.scan();
    const o = plc.outputs();
    if (o.WALK_NS && o.EW_GRN) walkDuringEwGrn = true;
    if (nsGrnAt < 0 && o.NS_GRN) nsGrnAt = plc.scanCount;
    if (walkAt < 0 && o.WALK_NS) walkAt = plc.scanCount;
    if (walkAt > 0 && walkOffAt < 0 && !o.WALK_NS) walkOffAt = plc.scanCount;
  }
  return { walkAt, nsGrnAt, walkDuringEwGrn, walkOffAt, walkLenMs: (walkOffAt - walkAt) * plc.scanMs };
});
check('(5) WALK_NS begins exactly when the next NS green begins (±1 scan)', ped.walkAt > 0 && Math.abs(ped.walkAt - ped.nsGrnAt) <= 1, JSON.stringify(ped));
check('(5) WALK never on during EW green', !ped.walkDuringEwGrn);
check('(5) walk lasts 4 s', Math.abs(ped.walkLenMs - 4000) <= 60, String(ped.walkLenMs));

/* mid-phase press during NS green waits for the FOLLOWING green */
const ped2 = await page.evaluate(() => {
  const A = window.LL.App;
  A.loadById('stoplight_ped');
  const plc = A.plc;
  let i = 0;
  while (!(plc.outputs().NS_GRN) && i++ < 5000) plc.scan();
  for (let k = 0; k < 25; k++) plc.scan();     // inside NS green (0.5 s in)
  plc.pulseInput('PED_NS');                     // too late for THIS green
  let sawWalkThisGreen = false;
  while (plc.outputs().NS_GRN) { plc.scan(); if (plc.outputs().WALK_NS) sawWalkThisGreen = true; }
  // run to next NS green
  let walkAt = -1, greenAt = -1;
  for (let s = 0; s < 4000; s++) {
    plc.scan();
    const o = plc.outputs();
    if (greenAt < 0 && o.NS_GRN) greenAt = plc.scanCount;
    if (walkAt < 0 && o.WALK_NS) walkAt = plc.scanCount;
    if (greenAt > 0 && walkAt > 0) break;
  }
  return { sawWalkThisGreen, walkAt, greenAt };
});
check('(5b) mid-green press NOT honored mid-phase; honored at following green', !ped2.sawWalkThisGreen && ped2.walkAt > 0 && Math.abs(ped2.walkAt - ped2.greenAt) <= 1, JSON.stringify(ped2));

/* ---------- UI smoke: modes + teacher toggles ---------- */
/* fast-forward with the REAL tick order so traffic builds up, then look */
await page.evaluate(() => {
  const A = window.LL.App;
  A.loadById('stoplight_basic');
  for (let i = 0; i < 1500; i++) { window.LL.Sim.prePlcTick(A.plc); A.plc.scan(); window.LL.Sim.postPlcTick(A.plc, A.plc.scanMs); }
});
await page.waitForTimeout(400);
const world = await page.evaluate(() => ({
  carEls: document.querySelectorAll('.sim-car').length,
  hud: (document.querySelector('.sim-status, .sim-hud') || {}).textContent || ''
}));
check('cars spawn and are drawn after 30 s of simulated traffic', world.carEls > 0, JSON.stringify(world));
await page.screenshot({ path: SHOTS + '/04-running.png' });
await page.click('#btn-run'); // resume running
await page.waitForTimeout(900);

/* Stage tabs, in shell markup: #tab-1 Trainer, #tab-2 Editor, #tab-3 Challenges,
   #tab-4 Troubleshoot (none gated — all four reachable directly). */
await page.click('#tab-2');
await page.waitForTimeout(300);
check('Editor stage panel renders (display !== none, live offsetParent)', await page.evaluate(() => {
  const p = document.getElementById('stage-2');
  return getComputedStyle(p).display !== 'none' && !!p.offsetParent;
}));
await page.screenshot({ path: SHOTS + '/05-editor.png' });

await page.click('#tab-3');
await page.waitForTimeout(300);
check('Challenges stage panel renders', await page.evaluate(() => {
  const p = document.getElementById('stage-3');
  return getComputedStyle(p).display !== 'none' && !!p.offsetParent;
}));
await page.screenshot({ path: SHOTS + '/06-challenges.png' });

await page.click('#tab-4');
await page.waitForTimeout(300);
check('Troubleshoot stage panel renders', await page.evaluate(() => {
  const p = document.getElementById('stage-4');
  return getComputedStyle(p).display !== 'none' && !!p.offsetParent;
}));
await page.screenshot({ path: SHOTS + '/07-troubleshoot.png' });

/* inject a random fault via the real panel button */
const injBtn = page.locator('#fault-host button', { hasText: /inject random/i }).first();
if (await injBtn.count()) {
  await injBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: SHOTS + '/08-fault-injected.png' });
  const revBtn = page.locator('#fault-host button', { hasText: /reveal/i }).first();
  if (await revBtn.count()) { await revBtn.click(); await page.waitForTimeout(400); }
  await page.screenshot({ path: SHOTS + '/09-fault-revealed.png' });
  check('fault panel inject+reveal did not error', consoleErrors.length === 0, consoleErrors.slice(-3).join(' | '));
  /* restore chip appears after reveal; clicking it restores the pristine program */
  const restoreVisible = await page.evaluate(() => document.getElementById('btn-restore').classList.contains('show'));
  check('restore chip appears after reveal', restoreVisible);
  if (restoreVisible) {
    await page.click('#btn-restore');
    await page.waitForTimeout(300);
    const gone = await page.evaluate(() => !document.getElementById('btn-restore').classList.contains('show'));
    check('restore chip clears after restoring pristine program', gone);
  }
} else {
  check('fault panel inject button found', false);
}

/* Settings is now the shell's native <dialog id="settings">, opened by the
   header's #settings-open button — no <details> to open first. */
const openSettings = async () => {
  const isOpen = await page.evaluate(() => document.getElementById('settings').open);
  if (!isOpen) await page.click('#settings-open');
  await page.waitForTimeout(120);
};
await page.click('#tab-1');
await openSettings();
await page.click('#presentation-btn');
await page.waitForTimeout(400);
await page.screenshot({ path: SHOTS + '/10-bigui.png' });
const biguiOn = await page.evaluate(() => document.body.classList.contains('bigui') && document.body.classList.contains('presenter'));
check('presentation mode applies body.bigui (this demo) + body.presenter (the kit)', biguiOn);
check('presentation mode surfaces the header Notes button',
  await page.evaluate(() => document.querySelector('.icon-btn.notes-open').offsetParent !== null));
await page.keyboard.press('Escape');
await page.waitForTimeout(150);

/* The hide-ladder predict-then-reveal toggle now lives in the Troubleshoot
   stage's own Predict card (#chk-hideladder, same id, new location), and only
   takes visual effect on that stage. */
await page.click('#tab-4');
await page.waitForTimeout(200);
await page.check('#chk-hideladder');
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + '/11-hidden-ladder.png' });
const hidden = await page.evaluate(() => document.body.classList.contains('hide-ladder') && document.getElementById('left-pane').offsetWidth === 0);
check('hide-ladder collapses the ladder pane on Troubleshoot', hidden);
await page.uncheck('#chk-hideladder');
await page.waitForTimeout(200);
const restored = await page.evaluate(() => !document.body.classList.contains('hide-ladder') && document.getElementById('left-pane').offsetWidth > 0);
check('ladder pane returns when the toggle is cleared', restored);
await openSettings();
await page.click('#presentation-btn');   // turn presentation mode back off
await page.waitForTimeout(200);
check('header Notes button hides again when presentation mode is off',
  await page.evaluate(() => document.querySelector('.icon-btn.notes-open').offsetParent === null));
await page.keyboard.press('Escape');

/* ---------- required UX: settings menu + presenter notes ----------
   Label assertions are scoped to #settings-menu, never to the document: once
   the guide is injected, its own prose names the menu entries too, so a
   page-wide search would be matching its own answer key. */
await openSettings();
const menu = await page.evaluate(() => {
  const body = document.getElementById('settings-menu');
  return {
    leaked: !!body.querySelector('.guide-scope'),
    items: [...body.querySelectorAll('h3')].map(n => n.textContent.trim()),
  };
});
check('the settings body carries no injected guide prose', menu.leaked === false);
for (const want of ['Presenter notes', 'Presentation mode', 'Reset']) {
  check(`settings menu has a "${want}" heading`, menu.items.includes(want), JSON.stringify(menu.items));
}
await page.click('.notes-open');
await page.waitForTimeout(250);
check('presenter notes open from the settings menu', await page.evaluate(() => document.getElementById('presenter-notes').open));
check('settings dialog closes behind the notes dialog (swap-not-stack)', await page.evaluate(() => !document.getElementById('settings').open));
/* The notes ARE the teacher guide, injected from src/demo-guide.html by
   build.js. Assert the guide's own headings, not a distilled paraphrase. */
const notesText = await page.textContent('#presenter-notes .guide-scope');
check('presenter notes are the teacher guide itself',
  /scan cycle/i.test(notesText) && /rung order/i.test(notesText) &&
  /misconception/i.test(notesText) && /discussion questions/i.test(notesText) && /model and boundaries/i.test(notesText),
  notesText.slice(0, 60));
await page.screenshot({ path: SHOTS + '/17-presenter-notes.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('Escape closes the presenter notes', await page.evaluate(() => !document.getElementById('presenter-notes').open));

/* step mode UX: watch window changes visible on step */
await page.evaluate(() => { window.LL.App.setRunning(false); window.LL.App.loadById('stoplight_basic'); });
const beforeStep = await page.evaluate(() => window.LL.App.plc.scanCount);
await page.click('#btn-step');
await page.click('#btn-step');
await page.waitForTimeout(300);
const afterStep = await page.evaluate(() => window.LL.App.plc.scanCount);
check('Step Scan advances exactly one scan per click', afterStep - beforeStep === 2, beforeStep + ' -> ' + afterStep);
await page.screenshot({ path: SHOTS + '/12-stepmode.png' });

/* Keyboard must hold/release the actual field input, not trigger global run. */
await page.evaluate(() => { window.LL.App.loadById('motor_sealin'); window.LL.App.setRunning(false); });
const keyBtn = page.locator('.sim-ctl[data-ctl="PB_START"] button, .sim-ctl[data-ctl="PB_START"] .sim-btn').first();
await keyBtn.focus(); await page.keyboard.down('Space');
const keyHeld = await page.evaluate(() => { window.LL.Sim.prePlcTick(window.LL.App.plc); return ({ held: window.LL.App.plc.getPhysicalInput('PB_START'), running: document.getElementById('btn-run').classList.contains('toggled') }); });
await page.evaluate(() => { window.LL.App.plc.scan(); window.LL.Sim.postPlcTick(window.LL.App.plc, window.LL.App.plc.scanMs); });
await page.keyboard.up('Space');
const keyReleased = await page.evaluate(() => { window.LL.Sim.prePlcTick(window.LL.App.plc); return ({ held: window.LL.App.plc.getPhysicalInput('PB_START'), running: document.getElementById('btn-run').classList.contains('toggled') }); });
check('keyboard Space holds/releases START without toggling Run', keyHeld.held && !keyHeld.running && !keyReleased.held && !keyReleased.running, JSON.stringify({keyHeld,keyReleased}));
await page.keyboard.press('Enter');
check('keyboard Enter is handled by field control, not Run/Pause', await page.evaluate(() => !document.getElementById('btn-run').classList.contains('toggled')));
await page.selectOption('#program-select', 'stoplight_basic');
await page.evaluate(() => { document.getElementById('student-option').disabled = false; });
await page.selectOption('#program-select', '__student__');
check('Student selection cannot mismatch built-in runtime', await page.evaluate(() => document.getElementById('program-select').value === 'stoplight_basic' && window.LL.App.plc.program.id === 'stoplight_basic'));

/* self-test dialog via Settings (converted from a custom overlay to a native
   <dialog id="selftest-dialog"> as part of this retrofit — see
   B-ladder-lab-progress.md decision 9). */
await openSettings();
await page.click('#btn-selftest');
await page.waitForTimeout(600);
await page.screenshot({ path: SHOTS + '/13-selftest.png' });
check('self-test dialog opened', await page.evaluate(() => document.getElementById('selftest-dialog').open));
const stText = await page.textContent('#selftest-body');
check('self-test overlay reports 0 failed', /0 failed/.test(stText), stText.slice(0, 80));
await page.keyboard.press('Escape');

check('no console errors across whole session', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));

/* ---------- Chromebook-sized pass (1366x768): nothing may be cut off ---------- */
const cb = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const cbErrors = [];
cb.on('pageerror', e => cbErrors.push(String(e)));
await cb.goto(URL);
await cb.waitForTimeout(1200);
await cb.keyboard.press('Escape');   /* dismiss the load-time Guide */
await cb.waitForTimeout(200);
await cb.screenshot({ path: SHOTS + '/14-chromebook.png' });
const fit = await cb.evaluate(() => {
  const r = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect() : null; };
  const panel = r('.sim-panel'), stage = r('.sim-stage');
  return {
    bodyScroll: document.body.scrollHeight <= window.innerHeight + 2,
    panelBottom: panel ? Math.round(panel.bottom) : -1,
    winH: window.innerHeight,
    stageH: stage ? Math.round(stage.height) : -1,
    watchCollapsed: document.getElementById('bottom-pane').classList.contains('collapsed')
  };
});
check('1366x768: page does not overflow vertically', fit.bodyScroll, JSON.stringify(fit));
check('1366x768: field-device panel is fully on screen', fit.panelBottom > 0 && fit.panelBottom <= fit.winH + 2, JSON.stringify(fit));
check('1366x768: intersection keeps a usable stage (>=200px tall)', fit.stageH >= 200, JSON.stringify(fit));
check('1366x768: watch drawer starts collapsed on short screens', fit.watchCollapsed);
/* projector mode at Chromebook size still fits */
await cb.click('#settings-open');
await cb.waitForTimeout(150);
await cb.click('#presentation-btn');
await cb.waitForTimeout(400);
await cb.screenshot({ path: SHOTS + '/15-chromebook-bigui.png' });
check('1366x768 + projector mode: no page errors', cbErrors.length === 0, cbErrors.join(' | '));
await cb.close();

/* ---------- phone pass (390x844): the required-UX surfaces must be usable ---------- */
const ph = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const phErrors = [];
ph.on('pageerror', e => phErrors.push(String(e)));
await ph.goto(URL);
await ph.waitForTimeout(1200);
const sheetFit = await ph.evaluate(() => {
  const d = document.getElementById('guide'), b = d.querySelector('.lesson-dialog-body'), r = d.getBoundingClientRect();
  return { open: d.open, left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom),
    vw: window.innerWidth, vh: window.innerHeight, bodyScrolls: b.scrollHeight > b.clientHeight + 1 };
});
check('phone: Guide shows on load and fits the viewport',
  sheetFit.open && sheetFit.left >= 0 && sheetFit.right <= sheetFit.vw + 1 && sheetFit.bottom <= sheetFit.vh + 1, JSON.stringify(sheetFit));
await ph.screenshot({ path: SHOTS + '/18-phone-howto.png' });
await ph.keyboard.press('Escape');
await ph.waitForTimeout(250);
check('phone: Escape dismisses the Guide', await ph.evaluate(() => !document.getElementById('guide').open));
const tap = await ph.evaluate(() => {
  const r = document.getElementById('guide-open').getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right),
    bottom: Math.round(r.bottom), vw: window.innerWidth, vh: window.innerHeight };
});
check('phone: ? control is a 40px+ touch target, fully on screen',
  tap.w >= 40 && tap.h >= 40 && tap.left >= 0 && tap.right <= tap.vw + 1 && tap.bottom <= tap.vh + 1, JSON.stringify(tap));
await ph.click('#settings-open');
await ph.waitForTimeout(250);
const dropFit = await ph.evaluate(() => {
  const r = document.getElementById('settings').getBoundingClientRect();
  return { left: Math.round(r.left), right: Math.round(r.right), vw: window.innerWidth };
});
check('phone: settings dialog stays on screen', dropFit.left >= 0 && dropFit.right <= dropFit.vw + 1, JSON.stringify(dropFit));
await ph.click('.notes-open');
await ph.waitForTimeout(300);
const pnFit = await ph.evaluate(() => {
  const d = document.getElementById('presenter-notes'), r = d.getBoundingClientRect();
  return { open: d.open, left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom),
    vw: window.innerWidth, vh: window.innerHeight };
});
check('phone: presenter notes open and fit the viewport',
  pnFit.open && pnFit.left >= 0 && pnFit.right <= pnFit.vw + 1 && pnFit.bottom <= pnFit.vh + 1, JSON.stringify(pnFit));
await ph.screenshot({ path: SHOTS + '/19-phone-notes.png' });
await ph.keyboard.press('Escape');
await ph.waitForTimeout(250);
check('phone: no horizontal page overflow',
  await ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  await ph.evaluate(() => document.documentElement.scrollWidth + ' vs ' + window.innerWidth));
check('phone: attribution byline is visible',
  await ph.evaluate(() => {
    const c = document.querySelector('.bh-credit'); if (!c) return false;
    const r = c.getBoundingClientRect();
    return r.width > 0 && r.left >= 0 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1;
  }));
await ph.screenshot({ path: SHOTS + '/20-phone-trainer.png' });
check('phone pass: no page errors', phErrors.length === 0, phErrors.join(' | '));
await ph.close();

await browser.close();
console.log('\n' + (failures === 0 ? 'ALL INTEGRATION CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
process.exit(failures === 0 ? 0 : 1);
