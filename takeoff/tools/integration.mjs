#!/usr/bin/env node
/* ==========================================================================
   Undershoot — browser integration checks.

   Run: node tools/integration.mjs   (add -v for every line, --headed to watch)

   The node suite proves the data and the maths. This proves the thing a
   projector and a phone actually do with them: that the drag produces a
   guess, the reveal produces a verdict, all three acts render, nothing
   overflows sideways, the Reveal button is never below the fold, and tap
   targets stay thumb-sized at 320px.
   ========================================================================== */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = 'file://' + path.join(HERE, '..', 'index.html');
const VERBOSE = process.argv.includes('-v');
const HEADED = process.argv.includes('--headed');

let pass = 0, fail = 0;
const lines = [];
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  lines.push([cond ? 'PASS' : 'FAIL', name, detail || '']);
};

const VIEWPORTS = [
  { name: 'iPhone SE',        w: 320,  h: 568 },
  { name: 'iPhone 12',        w: 390,  h: 844 },
  { name: 'iPhone 15 Pro Max',w: 430,  h: 932 },
  { name: 'Pixel landscape',  w: 851,  h: 393 },
  { name: 'iPad portrait',    w: 768,  h: 1024 },
  { name: 'Laptop',           w: 1280, h: 800 },
  { name: 'Projector 720p',   w: 1280, h: 720 },
  { name: 'Projector 1080p',  w: 1920, h: 1080 }
];

if (!fs.existsSync(path.join(HERE, '..', 'index.html'))) {
  console.error('index.html missing — run `node build.js` first.');
  process.exit(1);
}

const candidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);
let browser;
try { browser = await chromium.launch({ headless: !HEADED }); }
catch (managedError) {
  const executablePath = candidates.find(fs.existsSync);
  if (!executablePath) throw new Error(`No Playwright Chromium or system Chrome/Edge found. ${managedError.message}`);
  console.log('FALLBACK: using system browser', executablePath);
  browser = await chromium.launch({ headless: !HEADED, executablePath });
}

/** A block that throws used to take the whole run with it, so one missing
 *  selector cost every check after it. Now the throw is recorded as a failure
 *  and the suite carries on — the gap stays visible, the signal survives. */
async function guard(label, fn) {
  try { await fn(); }
  catch (e) { ok(`${label}: ran to completion`, false, String(e.message || e).split('\n')[0]); }
}

/** Act I opens on an explanation screen, and the how-to overlay sits over that
 *  on every load. Everything that drives a round has to get past both. */
async function open_(page, wait) {
  await page.goto(FILE);
  await page.waitForTimeout(wait || 300);
  await page.locator('#howto .sheet-foot .btn').click();
  await page.waitForTimeout(120);
  await page.locator('#btn-begin').click();
  await page.waitForTimeout(180);
}

/** Drag a rising forecast across the guessable region. */
async function drawGuess(page, fromY, toY) {
  const box = await page.locator('#chart').boundingBox();
  const g = await page.evaluate(() => {
    const st = window.__undershoot.app.chart.state();
    const pw = st.w - st.pad.l - st.pad.r, ph = st.h - st.pad.t - st.pad.b;
    const x = t => st.pad.l + (t - st.t0) / (st.t1 - st.t0) * pw;
    return { a:x(st.tSplit), b:x(st.tGuess), top:st.pad.t, ph };
  });
  const yOf = y => box.y + g.top + (1 - y) * g.ph;
  await page.mouse.move(box.x + g.a + 1, yOf(fromY == null ? 0.6 : fromY));
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    const f = i / 10;
    await page.mouse.move(box.x + g.a + (g.b - g.a - 2) * f,
                          yOf((fromY == null ? 0.6 : fromY) + ((toY == null ? 0.4 : toY) - (fromY == null ? 0.6 : fromY)) * f));
    await page.waitForTimeout(10);
  }
  await page.mouse.up();
  await page.waitForTimeout(90);
}

/* ---- 1. offline: the page must not reach for anything ------------------- */
{
  const ctx = await browser.newContext();
  const requests = [];
  ctx.on('request', r => { if (!r.url().startsWith('file://') && !r.url().startsWith('data:')) requests.push(r.url()); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(FILE);
  await page.waitForTimeout(600);
  ok('No network requests at load', requests.length === 0, requests.slice(0, 3).join(', '));
  ok('No page errors at load', errors.length === 0, errors.slice(0, 2).join(' | '));
  ok('The opening screen explains the exercise before any chart appears',
     await page.locator('#intro').isVisible() && !(await page.locator('#round-body').isVisible()));
  ok('The opening screen says what is about to happen',
     ((await page.locator('#intro-body').innerText()).length > 300));
  await page.addInitScript(() => {
    let hits = 0;
    const original = window.localStorage;
    Object.defineProperty(window, '__storageProbe', { configurable:true, value:() => hits });
    Object.defineProperty(window, 'localStorage', { configurable:true, get() { hits++; return original; } });
  });
  await page.reload(); await page.waitForTimeout(200);
  const before = await page.evaluate(() => window.__storageProbe());
  const afterPositive = await page.evaluate(() => { void window.localStorage; return window.__storageProbe(); });
  ok('localStorage is never touched by the app', before === 0, before + ' reads');
  ok('The storage probe detects a deliberate access', afterPositive === before + 1, `${before} -> ${afterPositive}`);
  await ctx.close();
}

/* ---- 2. the self-test the app ships ------------------------------------- */
{
  const page = await (await browser.newContext()).newPage();
  await page.goto(FILE);
  await page.waitForTimeout(300);
  const checks = await page.evaluate(() => window.__undershoot.runSelfTest());
  const failed = checks.filter(c => !c.pass);
  ok('In-app self-test passes every check', failed.length === 0,
     failed.map(f => f.name + (f.detail ? ' (' + f.detail + ')' : '')).join('; '));
  ok('In-app self-test actually ran some checks', checks.length >= 8, checks.length + ' checks');
  await page.context().close();
}

/* ---- 2a. the how-to popup, the settings menu, the notes, the byline ----- */
await guard('How-to, settings and notes', async () => {
  const page = await (await browser.newContext()).newPage();
  await page.goto(FILE);
  await page.waitForTimeout(300);

  ok('The how-to popup is shown on load', await page.locator('#howto').isVisible());
  const ht = await page.locator('#howto .sheet-body').innerText();
  ok('The how-to explains the drawing exercise', /drag/i.test(ht) && /reveal/i.test(ht), ht.length + ' chars');
  ok('The how-to names the controls it is reopened from', /presenter/i.test(ht) && /self-test/i.test(ht));
  ok('The how-to is a labelled modal over an inert page',
     await page.locator('#howto .sheet-inner').evaluate(e =>
       e.getAttribute('role') === 'dialog' && e.getAttribute('aria-modal') === 'true' &&
       !!e.getAttribute('aria-labelledby') && e.contains(document.activeElement) &&
       document.querySelector('main').inert));

  await page.keyboard.press('Escape');
  await page.waitForTimeout(140);
  ok('Escape dismisses the how-to', !(await page.locator('#howto').isVisible()));
  ok('Dismissing the how-to releases the page',
     !(await page.evaluate(() => document.querySelector('main').inert)));

  await page.locator('#btn-howto').click();
  await page.waitForTimeout(140);
  ok('The always-visible ? control reopens the how-to', await page.locator('#howto').isVisible());

  /* Tapping the dimmed area outside the sheet is what a phone user tries. */
  await page.locator('#howto').click({ position: { x: 6, y: 6 } });
  await page.waitForTimeout(140);
  ok('Tapping outside the sheet dismisses the how-to', !(await page.locator('#howto').isVisible()));

  await page.reload();
  await page.waitForTimeout(320);
  ok('The how-to returns on the next load, every load', await page.locator('#howto').isVisible());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(140);

  /* Settings: presentation mode, and the presenter's notes inside it. */
  await page.locator('#btn-settings').click();
  await page.waitForTimeout(140);
  ok('The settings menu offers presentation mode',
     await page.locator('#chk-presenter').isVisible());
  ok('Presentation mode offers openable presenter notes',
     await page.locator('#btn-notes').isVisible());
  const menu = await page.locator('#settings .sheet-body').innerText();
  for (const label of ['Open Presenter Notes', 'Presentation mode', 'Reset']) {
    ok('Settings offers "' + label + '", labelled exactly', menu.includes(label), menu.slice(0, 120));
  }

  await page.locator('#btn-notes').click();
  await page.waitForTimeout(180);
  ok('The presenter notes open from the settings menu', await page.locator('#notes').isVisible());
  const notes = await page.locator('#notes .sheet-body').innerText();
  ok('The notes carry a beat for every round', /Test 1/.test(notes) && /Test 5/.test(notes));
  ok('The notes keep the guide figures rather than paraphrasing them',
     /19% slower/.test(notes) && /38\.3/.test(notes) && /13\.3/.test(notes) &&
     /69\.7/.test(notes) && /208/.test(notes), 'guide figures');
  ok('The notes carry the twelve-minute cut', /twelve minutes/i.test(notes));
  ok('The notes ARE the printable guide rather than a retelling of it',
     /The Pace of AI Progress/.test(notes) && /presenter guide/i.test(notes),
     "the guide's own heading is missing from the notes overlay");

  await page.keyboard.press('Escape');
  await page.waitForTimeout(140);
  ok('Escape closes the notes and leaves settings open underneath',
     !(await page.locator('#notes').isVisible()) && await page.locator('#settings').isVisible());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(140);
  ok('A second Escape closes settings and releases the page',
     !(await page.locator('#settings').isVisible()) &&
     !(await page.evaluate(() => document.querySelector('main').inert)));

  /* Attribution, on the demo surface rather than buried in an About box. */
  const credit = await page.locator('.bh-credit').innerText();
  ok('The byline names the author and the institution',
     /Bryant Harrison/.test(credit) && /Murray State University/.test(credit), credit);
  ok('The byline is visible without opening anything',
     await page.locator('.bh-credit').isVisible());
  ok('The byline stands aside while a sheet is open',
     await page.evaluate(async () => {
       document.querySelector('#btn-settings').click();
       await new Promise(r => setTimeout(r, 250));
       const o = getComputedStyle(document.querySelector('.bh-credit')).opacity;
       document.querySelector('#settings [data-close]').click();
       return Number(o) < 0.1;
     }));

  await page.context().close();
});

/* ---- 2a2. Settings -> Reset -------------------------------------------- */
/* CONTRACT.md -> Required UX: Reset returns the demo to its fresh-load state,
   with the Guide overlay staying closed. Presentation mode is the deliberate
   exception — it describes the projector, not the talk — so it is asserted to
   SURVIVE a reset rather than to be cleared by one. */
await guard('Settings reset', async () => {
  const page = await (await browser.newContext()).newPage();
  await open_(page);
  await drawGuess(page);
  await page.locator('#btn-reveal').click();
  await page.waitForTimeout(700);

  await page.locator('#btn-settings').click();
  await page.waitForTimeout(140);
  await page.locator('#chk-presenter').check();
  await page.waitForTimeout(140);
  await page.locator('#btn-reset').click();
  await page.waitForTimeout(300);

  ok('Reset closes the settings sheet it was pressed in',
     !(await page.locator('#settings').isVisible()));
  ok('Reset returns to the opening screen', await page.locator('#intro').isVisible());
  ok('Reset leaves the Guide overlay closed', !(await page.locator('#howto').isVisible()));
  ok('Reset hides the round and the scorecard',
     !(await page.locator('#round-body').isVisible()) &&
     !(await page.locator('#scorecard').isVisible()));

  const st = await page.evaluate(() => ({
    results: window.__undershoot.app.results.length,
    round: window.__undershoot.app.roundIx,
    started: window.__undershoot.app.started,
    act: window.__undershoot.app.act,
    slider: Number(document.querySelector('#tl-slider').value),
    filter: document.querySelector('#tl-filter button.on').dataset.filter,
    region: document.querySelector('#tl-region button.on').dataset.region,
    selftest: document.querySelector('#selftest-out').innerHTML.length
  }));
  ok('Reset clears the five results and rewinds to test 1',
     st.results === 0 && st.round === 0 && st.started === false, JSON.stringify(st));
  ok('Reset returns to Act I', st.act === 1, String(st.act));
  ok('Reset rewinds the timeline and drops its filters',
     st.slider === 1000 && st.filter === 'all' && st.region === 'all', JSON.stringify(st));
  ok('Reset clears the self-test output', st.selftest === 0, String(st.selftest));

  ok('Reset does NOT switch presentation mode off',
     await page.evaluate(() => document.body.classList.contains('presenter')));

  await page.context().close();
});

/* ---- 2b. modal and tab semantics --------------------------------------- */
await guard('Modal and tab semantics', async () => {
  const page = await (await browser.newContext()).newPage();
  await open_(page);
  await page.locator('#btn-settings').click();
  const modal = await page.locator('#settings .sheet-inner').evaluate(e => ({ role:e.getAttribute('role'), modal:e.getAttribute('aria-modal'), label:e.getAttribute('aria-labelledby'), focused:document.activeElement === e || e.contains(document.activeElement), inert:document.querySelector('main').inert }));
  ok('Settings is a labelled modal with inert background and focus entry', modal.role === 'dialog' && modal.modal === 'true' && !!modal.label && modal.focused && modal.inert, JSON.stringify(modal));
  await page.keyboard.press('Escape');
  ok('Escape closes settings and restores focus', !(await page.locator('#settings').isVisible()) && await page.locator('#btn-settings').evaluate(e => document.activeElement === e));
  await page.locator('#act-tab-1').focus(); await page.keyboard.press('ArrowRight');
  ok('Act tabs use roving focus and selected state', await page.locator('#act-tab-2').evaluate(e => document.activeElement === e && e.getAttribute('aria-selected') === 'true' && e.tabIndex === 0));
  await page.context().close();
});

/* ---- 3. the core loop: drag, reveal, verdict ---------------------------- */
{
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await open_(page);

  ok('Reveal starts disabled', await page.locator('#btn-reveal').isDisabled());

  const midpoint = await page.locator('#chart').boundingBox();
  await page.mouse.click(midpoint.x + midpoint.width * 0.75, midpoint.y + midpoint.height * 0.5);
  await page.waitForTimeout(80);
  ok('A midpoint-only chart tap cannot enable Reveal', await page.locator('#btn-reveal').isDisabled());
  await guard('Keyboard forecast control', async () => {
    await page.locator('#forecast-end').evaluate(e => { e.value = '80'; e.dispatchEvent(new Event('input', { bubbles:true })); });
    await page.waitForTimeout(80);
    ok('The keyboard forecast control creates a complete forecast', await page.locator('#btn-reveal').isEnabled());
  });
  await page.locator('#btn-redraw').click();

  /* The round must explain itself before it asks anything. */
  const introText = await page.locator('#round-intro').innerText();
  ok('The round explains what the test is in plain words', introText.length > 240);
  ok('The round shows a human comparison point', /for comparison/i.test(introText));
  ok('The round offers a concrete example of the task',
     await page.locator('#round-example').isVisible());

  await drawGuess(page, 0.55, 0.33);

  ok('Dragging registers a guess', await page.evaluate(() => window.__undershoot.app.chart.drawn()));
  ok('Reveal enables after a drag', await page.locator('#btn-reveal').isEnabled());

  await page.locator('#btn-reveal').click();
  await page.waitForTimeout(2000);
  ok('Verdict appears after reveal', await page.locator('#verdict').isVisible());
  const vtext = await page.locator('#verdict').innerText();
  ok('Verdict states both the guess and the truth', /you drew/i.test(vtext) && /actually was/i.test(vtext));
  ok('Verdict carries a caveat', /does not say/i.test(vtext));
  ok('Verdict carries at least one source link',
     (await page.locator('#verdict .v-src a').count()) > 0);

  const stored = await page.evaluate(() => window.__undershoot.app.results[0]);
  ok('The round records a numeric result', stored && isFinite(stored.truth) && isFinite(stored.predicted),
     JSON.stringify(stored && { p: Math.round(stored.predicted), t: stored.truth }));

  /* Clear must restore the pre-draw state. */
  await page.evaluate(() => window.__undershoot.loadRound(0));
  await page.waitForTimeout(80);
  ok('Loading a round resets Reveal to disabled', await page.locator('#btn-reveal').isDisabled());

  ok('No page errors through the core loop', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.context().close();
}

/* ---- 4. all five rounds reveal, and round five twists ------------------- */
{
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await open_(page);

  const nRounds = await page.evaluate(() => window.__undershoot.D.ROUNDS.length);
  for (let i = 0; i < nRounds; i++) {
    await page.evaluate(n => window.__undershoot.loadRound(n), i);
    await page.waitForTimeout(80);

    /* Both axis titles must be drawn, on every round. The first version of
       this app shipped with an unlabelled y axis. */
    const labels = await page.evaluate(n => {
      const r = window.__undershoot.D.ROUNDS[n];
      return { x: r.xLabel, y: r.yLabel };
    }, i);
    ok(`Round ${i + 1} labels both axes`, !!labels.x && !!labels.y, `${labels.y} / ${labels.x}`);

    /* And the time axis must carry enough marks to read a scale off. A
       year-only axis left the sixteen-month round with a single tick. */
    const ticks = await page.evaluate(() => {
      const st = window.__undershoot.app.chart.state();
      const E = window.__undershoot.E;
      return E.timeTicks(st.t0, st.t1).map(m => E.tickLabel(m.ms, m.step));
    });
    ok(`Round ${i + 1} time axis carries at least four marks`, ticks.length >= 4,
       ticks.join(' '));
    ok(`Round ${i + 1} time labels are all distinct`,
       new Set(ticks).size === ticks.length, ticks.join(' '));

    /* The value axis has to be readable too — the task-length round shipped
       gridlines reading "1.7 hr" and "33.3 hr". */
    const yl = await page.evaluate(() => {
      const st = window.__undershoot.app.chart.state();
      const E = window.__undershoot.E, s = st.scale;
      return st.round.unit === 'min'
        ? E.durationTicks(s.min, s.max, 7).map(E.fmtDurationTick)
        : E.ticks(s, 7).map(v => E.fmtValue(v, st.round.unit));
    });
    ok(`Round ${i + 1} value axis has 4-8 labels`, yl.length >= 4 && yl.length <= 8, yl.join(' '));
    ok(`Round ${i + 1} value labels are all distinct`, new Set(yl).size === yl.length, yl.join(' '));
    if (i === 2) ok('The task-length axis reads in whole units of time',
                    yl.every(l => /^\d+ (min|hr|days?)$/.test(l)), yl.join(' | '));

    /* And the example opens without breaking the layout. */
    await page.locator('#round-example summary').click();
    await page.waitForTimeout(120);
    const exLen = (await page.locator('#example-body').innerText()).length;
    ok(`Round ${i + 1} shows a worked example`, exLen > 40 ||
       (await page.locator('#example-body .arc-grid').count()) > 0, exLen + ' chars');
    await page.locator('#round-example summary').click();
    await page.waitForTimeout(100);

    await drawGuess(page, 0.6, 0.42);
    await page.locator('#btn-reveal').click();
    await page.waitForTimeout(1900);
    ok(`Round ${i + 1} reveals`, await page.locator('#verdict').isVisible());
  }

  /* Round five ships a playable puzzle so a novice can feel the task. */
  await page.evaluate(() => window.__undershoot.loadRound(4));
  await page.waitForTimeout(120);
  await page.locator('#round-example summary').click();
  await page.waitForTimeout(150);
  ok('The grid puzzle renders as coloured grids',
     (await page.locator('#example-body .arc-grid').count()) >= 4,
     (await page.locator('#example-body .arc-grid').count()) + ' grids');
  ok('The puzzle answer is hidden until asked for',
     await page.locator('#arc-reveal').isVisible() && !(await page.locator('#arc-answer').isVisible()));
  await page.locator('#arc-reveal').click();
  await page.waitForTimeout(150);
  ok('The puzzle answer reveals on click', await page.locator('#arc-answer').isVisible());
  await page.locator('#round-example summary').click();
  await page.waitForTimeout(120);

  await drawGuess(page, 0.85, 0.5);
  await page.locator('#btn-reveal').click();
  await page.waitForTimeout(1900);

  /* Round five is the one that turns. */
  ok('Round five offers the twist', await page.locator('#btn-twist').isVisible());
  await page.locator('#btn-twist').click();
  await page.waitForTimeout(1500);
  const twist = await page.locator('#twist-body').innerText();
  ok('The twist explains what ARC-AGI-3 is before quoting a score',
     /interactive games/i.test(twist) && /told nothing/i.test(twist));
  ok('The twist shows both harness conditions for the same model',
     /38\.3/.test(twist) && /13\.3/.test(twist), twist.slice(0, 0));
  ok('The twist shows the human tester figure, not a 100% baseline',
     /48/.test(twist) && !/\b100%/.test(twist));
  ok('The twist keeps the bare-model figure', /0\.51/.test(twist));
  ok('The twist warns the bars are not comparable',
     /not four measurements/i.test(twist));
  ok('The twist closes with the jagged-frontier point', /jagged/i.test(twist));

  await page.locator('#btn-next').click();
  await page.waitForTimeout(200);
  ok('Scorecard appears after the last round', await page.locator('#scorecard').isVisible());
  const sc = await page.locator('#scorecard').innerText();
  ok('Scorecard reports how many rounds were guessed low', /guessed low in \d/.test(sc), sc.split('\n')[0]);

  ok('No page errors across all rounds', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.context().close();
}

/* ---- 5. acts two and three render -------------------------------------- */
{
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await open_(page);

  await page.locator('#actnav button[data-act="2"]').click();
  await page.waitForTimeout(250);
  ok('Act II renders', await page.locator('#tl').isVisible());
  ok('Act II reports a large release count',
     Number(await page.locator('#tl-total').innerText()) >= 100,
     await page.locator('#tl-total').innerText());

  /* Scrubbing backwards must reduce the count. */
  await page.evaluate(() => { const s = document.querySelector('#tl-slider'); s.value = 300; s.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(150);
  const early = Number(await page.locator('#tl-total').innerText());
  await page.evaluate(() => { const s = document.querySelector('#tl-slider'); s.value = 1000; s.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(150);
  const late = Number(await page.locator('#tl-total').innerText());
  ok('Scrubbing back in time shows fewer releases', early < late, `${early} vs ${late}`);

  await page.locator('#tl-filter button[data-filter="open"]').click();
  await page.waitForTimeout(150);
  ok('The downloadable filter is selectable',
     await page.locator('#tl-filter button[data-filter="open"]').evaluate(e => e.classList.contains('on')));
  ok('Timeline filters expose pressed state',
     await page.locator('#tl-filter button[data-filter="open"]').getAttribute('aria-pressed') === 'true');
  const openCount = Number(await page.locator('#tl-total').innerText());
  ok('The counters follow the filter', openCount > 50 && openCount < late,
     openCount + ' downloadable of ' + late);

  /* Region filter — the gap this revision was meant to close. */
  for (const region of ['Europe', 'China', 'US']) {
    await page.locator(`#tl-region button[data-region="${region}"]`).click();
    await page.waitForTimeout(140);
    const n = Number(await page.locator('#tl-total').innerText());
    ok(`Downloadable models exist for ${region}`, n >= 3, n + ' models');
  }
  await page.locator('#tl-region button[data-region="all"]').click();
  await page.locator('#tl-filter button[data-filter="all"]').click();
  await page.waitForTimeout(140);

  await guard('Synchronized timeline list', async () => {
    await page.locator('#tl-list .tl-release').first().click();
    ok('A timeline release is keyboard-accessible in the synchronized list',
       await page.locator('#tl-list .tl-release[aria-selected="true"]').count() === 1);
  });
  const dot = await page.evaluate(() => {
    const tl = window.__undershoot.app.timeline;
    const model = tl.visible().at(-1), canvas = document.querySelector('#tl');
    const rect = canvas.getBoundingClientRect();
    const point = tl.pointFor(model);
    return { x:rect.left + point.x, y:rect.top + point.y, name:model.name };
  });
  await page.evaluate(({ x, y }) => document.querySelector('#tl').dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, clientX:x, clientY:y })), dot);
  await page.waitForTimeout(50);
  const tapDetail = await page.locator('#tl-hover').isVisible() ? await page.locator('#tl-hover').innerText() : '';
  ok('Tapping a timeline dot selects and reveals its detail', tapDetail.includes(dot.name), tapDetail || 'no timeline detail');
  await page.locator('#tl-slider').evaluate(e => { e.value = '0'; e.dispatchEvent(new Event('input', { bubbles:true })); });
  ok('Moving the cursor clears details for an excluded selected release',
     !(await page.locator('#tl-hover').isVisible()) && await page.locator('#tl-list .tl-release[aria-selected="true"]').count() === 0);
  await page.locator('#tl-slider').evaluate(e => { e.value = '1000'; e.dispatchEvent(new Event('input', { bubbles:true })); });

  ok('An unlock card is showing', await page.locator('#tl-unlock').isVisible());

  /* Act II shipped with an unlabelled height axis. */
  const tlAxis = await page.evaluate(() => window.__undershoot.tlLabels());
  ok('Act II labels its height axis', !!(tlAxis && tlAxis.y), tlAxis && tlAxis.y);
  ok('Act II labels its time axis', !!(tlAxis && tlAxis.x), tlAxis && tlAxis.x);
  ok('Act II says the height is not a score', /not a score/i.test(tlAxis.ySub), tlAxis.ySub);

  await page.locator('#actnav button[data-act="3"]').click();
  await page.waitForTimeout(250);
  const cards = await page.locator('#domains .mcard').count();
  ok('Act III renders results across domains', cards >= 15, cards + ' results');
  const domains = await page.locator('#domains .domain').count();
  ok('Act III is organised into domains, not one subject', domains >= 5, domains + ' domains');
  ok('Act III includes at least one overclaimed result',
     (await page.locator('#domains .mcard.overclaimed').count()) > 0);
  ok('Act III includes at least one still-disputed result',
     (await page.locator('#domains .mcard.disputed').count()) > 0);
  const a3 = await page.locator('section.act[data-act="3"]').innerText();
  ok('Act III covers biology, medicine, weather and materials — not just maths',
     /protein/i.test(a3) && /trial|patient/i.test(a3) && /forecast|weather/i.test(a3) && /material/i.test(a3));
  ok('Act III reports the study where AI made developers slower', /19%/.test(a3));
  ok('Act III quotes Tao on generation, verification and digestion', /digestion/.test(a3));
  ok('Every result splits the machine from the humans',
     (await page.locator('#domains .s-machine').count()) === cards &&
     (await page.locator('#domains .s-human').count()) === cards);
  ok('The domain jump-nav is built',
     (await page.locator('#domain-nav button').count()) >= 5);
  ok('Act III shows the cut list', (await page.locator('#cut-list li').count()) >= 3);
  ok('Act III lists every source', (await page.locator('#source-list li').count()) >= 25,
     await page.locator('#source-list li').count() + ' sources');
  ok('Every source link is absolute and https',
     (await page.locator('#source-list a').evaluateAll(as => as.every(a => /^https:\/\//.test(a.href)))));
  ok('The live-fitted doubling figure is computed, not blank',
     /^\d+$/.test(await page.locator('#closer-fit').innerText()),
     await page.locator('#closer-fit').innerText());

  ok('No page errors across acts II and III', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.context().close();
}

/* ---- 6. layout at every viewport --------------------------------------- */
for (const v of VIEWPORTS) {
  const page = await (await browser.newContext({ viewport: { width: v.w, height: v.h } })).newPage();

  /* The how-to is the first thing anyone sees, on every screen this ships to,
     so it is checked before it is dismissed. A bottom sheet that runs off the
     bottom of a 393px-tall landscape phone hides its own dismiss button. */
  await page.goto(FILE);
  await page.waitForTimeout(240);
  const htBox = await page.evaluate(() => {
    const s = document.querySelector('#howto .sheet-inner').getBoundingClientRect();
    const b = document.querySelector('#howto .sheet-foot .btn').getBoundingClientRect();
    return { right: s.right, bottom: b.bottom, vw: innerWidth, vh: innerHeight,
             oflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  ok(`${v.name}: the how-to sheet fits the viewport`,
     htBox.right <= htBox.vw + 1 && htBox.bottom <= htBox.vh + 1 && htBox.oflow <= 1,
     `sheet ${Math.round(htBox.right)}/${htBox.vw} wide, dismiss at ${Math.round(htBox.bottom)}/${htBox.vh}`);

  await open_(page, 280);

  const oflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`${v.name}: no horizontal overflow`, oflow <= 1, oflow + 'px');

  /* The fold rule: chart and Reveal both reachable without scrolling. */
  const fold = await page.evaluate(() => {
    const c = document.querySelector('#chart-wrap').getBoundingClientRect();
    const b = document.querySelector('#btn-reveal').getBoundingClientRect();
    return { chartTop: c.top, btnBottom: b.bottom, vh: window.innerHeight };
  });
  ok(`${v.name}: Reveal is above the fold`, fold.btnBottom <= fold.vh + 1,
     `button bottom ${Math.round(fold.btnBottom)} vs viewport ${fold.vh}`);

  const chart = await page.evaluate(() => {
    const r = document.querySelector('#chart').getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  ok(`${v.name}: chart has real area`, chart.w > 200 && chart.h > 140,
     `${Math.round(chart.w)}x${Math.round(chart.h)}`);

  /* The "drag here" hint is drawn inside the guessable region and must stay
     inside the plot — it ran off the right edge at 390px wide. */
  const hint = await page.evaluate(() => {
    const st = window.__undershoot.app.chart.state();
    const ctx = st.ctx;
    const plotW = st.w - st.pad.l - st.pad.r;
    const a = st.pad.l + (st.tSplit - st.t0) / (st.t1 - st.t0) * plotW;
    const b = st.pad.l + (st.tGuess - st.t0) / (st.t1 - st.t0) * plotW;
    const sizes = st.big ? [st.fs + 4, st.fs + 2, st.fs] : [st.fs + 2, st.fs, st.fs - 1];
    const texts = ['drag across to draw your guess', 'drag to draw your guess', 'draw your guess', 'drag here'];
    for (const t of texts) for (const sz of sizes) {
      ctx.font = `600 ${sz}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      const w = ctx.measureText(t).width;
      if (w <= (b - a) * 0.92) return { t, w, room: b - a, mid: (a + b) / 2, right: st.w - st.pad.r };
    }
    return null;
  });
  /* The rotated y title has to fit the plot height. A first attempt simply
     dropped it when short, which silently lost it at ordinary laptop sizes. */
  const yTitle = await page.evaluate(() => {
    const st = window.__undershoot.app.chart.state();
    const r = st.round, ctx = st.ctx;
    const room = (st.h - st.pad.t - st.pad.b) - 6;
    const ts = st.fs + (st.big ? 2 : 1.5);
    for (const cand of [r.yLabel, r.yLabelShort].filter(Boolean))
      for (const sz of [ts, ts - 1, ts - 2, ts - 3]) {
        ctx.font = `700 ${sz}px system-ui, -apple-system, sans-serif`;
        if (ctx.measureText(cand).width <= room) return { cand, sz, room };
      }
    return null;
  });
  ok(`${v.name}: the y-axis title fits and is drawn`, !!yTitle,
     yTitle ? `"${yTitle.cand}" @${yTitle.sz}px in ${Math.round(yTitle.room)}px` : 'no wording fit');

  ok(`${v.name}: the drag hint fits inside the plot`,
     hint && hint.mid + hint.w / 2 <= hint.right + 1,
     hint ? `"${hint.t}" ${Math.round(hint.w)}px in ${Math.round(hint.room)}px` : 'no wording fit');

  const small = await page.evaluate(() => {
    const sel = 'button:not([hidden]), input[type=range], .icon-btn';
    return Array.from(document.querySelectorAll(sel))
      .filter(e => e.offsetParent !== null)
      .map(e => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 18), w: Math.round(r.width), h: Math.round(r.height) }; })
      .filter(r => r.h < 40 || r.w < 24);
  });
  ok(`${v.name}: tap targets are at least 40px tall`, small.length === 0,
     small.map(s => `${s.t} ${s.w}x${s.h}`).join(', '));

  await page.context().close();
}

/* ---- 7. presenter mode on projectors ----------------------------------- */
for (const v of [{ name: '720p', w: 1280, h: 720 }, { name: '1080p', w: 1920, h: 1080 }]) {
  const page = await (await browser.newContext({ viewport: { width: v.w, height: v.h } })).newPage();
  await open_(page, 250);
  await page.locator('#btn-settings').click();
  await page.locator('#chk-presenter').check();
  await page.locator('#settings [data-close]').last().click();
  await page.waitForTimeout(300);

  const oflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`Presenter ${v.name}: no horizontal overflow`, oflow <= 1, oflow + 'px');

  const fold = await page.evaluate(() => {
    const b = document.querySelector('#btn-reveal').getBoundingClientRect();
    return { btnBottom: b.bottom, vh: window.innerHeight };
  });
  ok(`Presenter ${v.name}: Reveal is above the fold`, fold.btnBottom <= fold.vh + 1,
     `${Math.round(fold.btnBottom)} vs ${fold.vh}`);

  const qSize = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#round-q')).fontSize));
  ok(`Presenter ${v.name}: question type is projector-sized`, qSize >= 19, qSize + 'px');
  const pSize = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#round-plain')).fontSize));
  ok(`Presenter ${v.name}: the explanation is projector-sized`, pSize >= 17, pSize + 'px');
  await page.context().close();
}

/* ---- 8. touch drag on a phone ------------------------------------------ */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await open_(page);
  const box = await page.locator('#chart').boundingBox();
  await page.touchscreen.tap(box.x + box.width * 0.7, box.y + box.height * 0.5);
  await page.waitForTimeout(150);
  ok('A midpoint-only touch cannot complete a forecast',
     !(await page.evaluate(() => window.__undershoot.app.chart.drawn())));
  await guard('Phone forecast control', async () => {
    await page.locator('#forecast-end').evaluate(e => { e.value = '80'; e.dispatchEvent(new Event('input', { bubbles:true })); });
    ok('The phone-accessible forecast control completes a forecast',
       await page.evaluate(() => window.__undershoot.app.chart.drawn()));
  });
  await ctx.close();
}

await browser.close();

for (const [state, name, detail] of lines) {
  if (state === 'FAIL' || VERBOSE) console.log(`${state}  ${name}${detail ? '  — ' + detail : ''}`);
}
console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} checks.`);
process.exit(fail ? 1 : 0);
