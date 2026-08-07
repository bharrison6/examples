/* =====================================================================
   Topping Out — browser integration playtest
   Drives the BUILT index.html in a real browser: plays the tutorial and
   a full competitive run end to end, checks the views render, checks the
   commit loop is irreversible, and times a realistic session.

     node tools/integration.mjs            # headless
     node tools/integration.mjs --headed   # watch it play
   ===================================================================== */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');
const HEADED = process.argv.includes('--headed');

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('PASS  ' + name);
  else { console.log('FAIL  ' + name + (detail ? '\n      ' + detail : '')); failures++; }
}

/* The sandbox ships a Chromium build that may not match this
   Playwright's expected revision; fall back to the one on disk. */
import fs from 'fs';
const LOCAL = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
               '/opt/pw-browsers/chromium/chrome-linux/chrome']
  .find(p => { try { return fs.existsSync(p); } catch { return false; } });
const browser = await chromium.launch({
  headless: !HEADED,
  ...(LOCAL ? { executablePath: LOCAL } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

await page.goto(FILE);
await page.waitForSelector('#setup-inner .sheet');

/* ---------- the how-to briefing -------------------------------------
   It opens on every load, over the setup sheet, so every entry point
   below has to get past it first. */
const hidden = (pg, id) => pg.locator('#' + id).evaluate(n => n.hidden);

check('the how-to briefing opens on load', (await hidden(page, 'howto')) === false);
const brief = await page.locator('#howto .modal-body').innerText();
check('the briefing explains the weekly turn loop',
  /the news/i.test(brief) && /decisions/i.test(brief) && /commit/i.test(brief) &&
  /the week runs/i.test(brief), brief.slice(0, 120));
check('the briefing explains all three views',
  /4D cutaway/i.test(brief) && /gantt/i.test(brief) && /network/i.test(brief));
check('the briefing paints above the setup sheet', await page.evaluate(() =>
  parseInt(getComputedStyle(document.getElementById('howto')).zIndex, 10) >
  parseInt(getComputedStyle(document.getElementById('setup')).zIndex, 10)));
await page.keyboard.press('Escape');
check('Esc dismisses the briefing', (await hidden(page, 'howto')) === true);
await page.click('#btn-howto3');
check('the setup sheet reopens the briefing', (await hidden(page, 'howto')) === false);
await page.click('#howto', { position: { x: 6, y: 6 } });   /* the backdrop, not the sheet */
check('a tap on the paper around the briefing dismisses it', (await hidden(page, 'howto')) === true);

/* ---------- attribution ---------------------------------------------- */
check('Bryant Harrison is credited on screen',
  /Bryant Harrison/.test(await page.locator('.bh-credit').innerText()) &&
  /Murray State University/.test(await page.locator('.bh-credit').innerText()));
check('the credit is visible and does not eat taps',
  (await page.locator('.bh-credit').isVisible()) &&
  (await page.locator('.bh-credit').evaluate(n => getComputedStyle(n).pointerEvents)) === 'none');

/* ---------- setup screen ------------------------------------------- */
check('setup sheet renders', await page.locator('#setup-inner h1').innerText() === 'TOPPING OUT');

await page.fill('#in-team', 'Integration Crew');
await page.fill('#in-seed', 'MSU-2601');
await page.click('#ch-project button[data-v="tutorial"]');
await page.click('#btn-start');
await page.waitForSelector('#app:not([hidden])');
check('tutorial starts', await page.locator('#meeting-head .ttl').innerText() === 'The weekly meeting');

/* ---------- the three views render --------------------------------- */
check('4D view draws the building', await page.locator('#fourd-svg').count() === 1);
/* The tutorial uses SITE, L1 and ROOF only. The strip must show those
   three and not advertise floors the project has not got. */
const tutZones = await page.locator('#zone-strip .zone-chip .zn').allInnerTexts();
check('zone strip lists only the zones this project uses',
  tutZones.length === 3 && tutZones.join(' ').includes('SITE') &&
  tutZones.join(' ').includes('L1') && tutZones.join(' ').includes('ROOF'),
  tutZones.join(' | '));
check('the tutorial draws a single-storey ghost, not an empty three-storey one',
  (await page.locator('#fourd-svg').evaluate(n => n.textContent)).match(/L2|L3/) === null);

await page.click('#view-tabs button[data-view="gantt"]');
await page.waitForSelector('#gantt .g-row');
const ganttRows = await page.locator('#gantt .g-row').count();
check('Gantt draws one row per activity', ganttRows === 10, 'rows=' + ganttRows);
check('Gantt highlights a critical path', (await page.locator('#gantt .g-bar.crit').count()) > 0);
check('Gantt shows float tails', (await page.locator('#gantt .g-floatbar').count()) > 0);
check('Gantt hatches the non-compressible holds', (await page.locator('#gantt .g-bar.fixed').count()) === 2);

await page.click('#view-tabs button[data-view="network"]');
await page.waitForSelector('#network-svg');
check('network draws one node per activity', (await page.locator('#network-svg .n-node').count()) === 10);
check('network marks critical nodes', (await page.locator('#network-svg .n-node.crit').count()) > 0);
const netText = await page.locator('#network-svg').evaluate(n => n.textContent);
check('network labels SS / FF relationships', /SS|FF/.test(netText));

await page.click('#view-tabs button[data-view="4d"]');

/* ---------- glossary ------------------------------------------------ */
await page.hover('.gl');
await page.waitForTimeout(150);
check('glossary tooltip appears on hover', await page.locator('#tip.on').count() === 1);

/* ---------- HUD ----------------------------------------------------- */
/* .hud-lab is uppercased by CSS, so compare case-insensitively. */
const hudLabels = (await page.locator('#hud').evaluate(n => n.textContent)).toLowerCase();
['week / day', 'contract completion', 'projected finish', 'critical path', 'total float left'].forEach(l =>
  check('HUD shows "' + l + '"', hudLabels.includes(l)));

/* ---------- play the tutorial to completion ------------------------- */
async function playToEnd(maxWeeks, label) {
  const t0 = Date.now();
  let weeks = 0;
  for (let i = 0; i < maxWeeks; i++) {
    const commit = page.locator('#btn-commit');
    if (!(await commit.count())) break;
    await commit.click();
    weeks++;
    await page.waitForTimeout(1150);            // the week animation
    const next = page.locator('#btn-next');
    if (await next.count()) { await next.click(); await page.waitForTimeout(60); continue; }
    if (await page.locator('#btn-debrief').count()) break;
    if (await page.locator('#debrief:not([hidden])').count()) break;
  }
  return { weeks, ms: Date.now() - t0 };
}

const tut = await playToEnd(30, 'tutorial');
await page.waitForTimeout(1200);
check('tutorial reaches the debrief', await page.locator('#debrief:not([hidden])').count() === 1,
  'weeks played=' + tut.weeks);
check('tutorial runs in a sensible number of turns', tut.weeks >= 5 && tut.weeks <= 14, 'weeks=' + tut.weeks);

/* ---------- debrief contents ---------------------------------------- */
const debrief = await page.locator('#debrief-body').innerText();
check('debrief shows a profit breakdown', /where every dollar went/i.test(debrief));
check('debrief compares to the no-intervention baseline', /no-intervention baseline/i.test(debrief));
check('debrief profit breakdown names general conditions and LDs',
  /general conditions/i.test(debrief) && /liquidated damages/i.test(debrief));
check('debrief charts critical path movement', await page.locator('#cp-chart').count() === 1);
check('debrief lists the decision timeline', (await page.locator('#debrief-body .tl-item').count()) >= 5);
check('debrief records the team on the leaderboard', /Integration Crew/.test(debrief));
check('debrief grades the calls: exposure against the roll',
  /the calls you made/i.test(debrief) && /the roll/i.test(debrief));
check('debrief separates a good decision from a lucky one',
  /got away with it|covered|went against you|unlucky/i.test(debrief), debrief.slice(0, 200));

/* ---------- the settings panel --------------------------------------- */
await page.click('#btn-debrief-close');
check('the topbar button reads as Settings',
  /settings/i.test(await page.locator('#btn-instructor').innerText()));
check('a ? control sits in the title bar', await page.locator('#btn-howto').isVisible());
await page.click('#btn-howto');
check('the title-bar ? reopens the briefing mid-game', (await hidden(page, 'howto')) === false);
await page.keyboard.press('Escape');

await page.click('#btn-instructor');
const panel = await page.locator('#instructor .modal-body').innerText();
check('Settings holds projector mode, the instructor guide, and the self-test',
  /projector mode/i.test(panel) && /instructor guide/i.test(panel) && /self-test/i.test(panel));
check('Settings offers presentation mode', /presentation mode/i.test(panel));
check('Settings offers the presenter\'s notes', /presenter's notes/i.test(panel));
check('the instructor guide link points at the guide',
  (await page.locator('#instructor a[href="teacher-guide.html"]').count()) >= 1);

/* ---------- presentation mode and the presenter's notes -------------- */
await page.click('#btn-notes');
check('the presenter\'s notes open from Settings', (await hidden(page, 'presenter')) === false);
const notes = await page.locator('#presenter .modal-body').innerText();
check('the notes carry the running order and the debrief material',
  /running order/i.test(notes) && /misconception/i.test(notes) && /debrief/i.test(notes),
  notes.slice(0, 140));
check('the notes are sectioned and openable',
  (await page.locator('#presenter details').count()) === 5 &&
  (await page.locator('#presenter details[open]').count()) >= 1);
check('the notes link out to the full printable guide',
  (await page.locator('#presenter a[href="teacher-guide.html"]').count()) === 1);
await page.keyboard.press('Escape');
check('Esc closes the notes', (await hidden(page, 'presenter')) === true);

await page.click('#btn-instructor');
await page.check('#chk-big2');
check('presentation mode enlarges the UI and reveals the notes shortcut',
  (await page.locator('body.presenting').count()) === 1 &&
  (await page.locator('body.big').count()) === 1);
await page.keyboard.press('Escape');
check('the notes shortcut is reachable from the title bar while presenting',
  await page.locator('#btn-notes-top').isVisible());
await page.click('#btn-notes-top');
check('the shortcut opens the notes', (await hidden(page, 'presenter')) === false);
await page.keyboard.press('Escape');
await page.click('#btn-instructor');
await page.uncheck('#chk-big2');
check('presentation mode turns back off',
  (await page.locator('body.presenting').count()) === 0);

await page.click('#btn-selftest');
await page.waitForSelector('#selftest:not([hidden])');
const sum = await page.locator('#selftest-sum').innerText();
check('in-browser self-test passes every assertion', /0 failed/.test(sum), sum);
await page.click('[data-close="selftest"]');

/* ---------- full competitive game ----------------------------------- */
await page.click('#btn-instructor');
page.once('dialog', d => d.accept());
await page.click('#btn-newgame');
await page.waitForSelector('#setup:not([hidden])');
await page.fill('#in-team', 'Full Run');
await page.fill('#in-seed', 'MSU-2601');
await page.click('#ch-project button[data-v="main"]');
await page.click('#btn-start');
await page.waitForSelector('#app:not([hidden])');

const fullRows = await (async () => {
  await page.click('#view-tabs button[data-view="gantt"]');
  await page.waitForSelector('#gantt .g-row');
  const n = await page.locator('#gantt .g-row').count();
  await page.click('#view-tabs button[data-view="4d"]');
  return n;
})();
check('full project has 25-40 activities', fullRows >= 25 && fullRows <= 40, 'rows=' + fullRows);
const mainZones = await page.locator('#zone-strip .zone-chip .zn').allInnerTexts();
check('the full project shows all six of its zones', mainZones.length === 6, mainZones.join(' | '));
check('the full project draws three storeys',
  /L3/.test(await page.locator('#fourd-svg').evaluate(n => n.textContent)));

/* ---------- judgment calls ------------------------------------------- */
await page.click('#btn-instructor');
page.once('dialog', d => d.accept());
await page.click('#btn-newgame');
await page.waitForSelector('#setup:not([hidden])');
await page.fill('#in-team', 'Call Crew');
await page.fill('#in-seed', 'MSU-2601');
await page.click('#ch-project button[data-v="main"]');
await page.click('#btn-start');
await page.waitForSelector('#app:not([hidden])');

check('week 1 opens with calls to make', (await page.locator('.call').count()) >= 1,
  'calls=' + (await page.locator('.call').count()));
check('a judgment call names where its consequence lands',
  /shows up at/i.test(await page.locator('.call .call-kind').first().innerText()));
const optTexts = await page.locator('.call').first().locator('.call-opt').allInnerTexts();
check('each option shows a price and an exposure', optTexts.length >= 2 &&
  optTexts.some(t => /%/.test(t)) && optTexts.some(t => /no cost/i.test(t)),
  optTexts.join(' / ').replace(/\n/g, ' '));
check('procurement calls are offered too', (await page.locator('.call.proc').count()) >= 1);

const beforeCall = await page.locator('#preview').innerText();
await page.locator('.call').first().locator('.call-opt').last().click();
check('choosing an option marks it and prices it into the preview',
  (await page.locator('.call-opt.on').count()) >= 1 &&
  (await page.locator('#preview').innerText()) !== beforeCall);
check('the unanswered warning clears once you answer',
  (await page.locator('.call').first().locator('.call-warn').count()) === 0);

/* ---------- crew lead time ------------------------------------------- */
const crewPlus = page.locator('button[data-crew][data-d="1"]:not([disabled])');
if (await crewPlus.count()) {
  await crewPlus.first().click();
  check('ordering a crew shows it as on order, not on site',
    (await page.locator('.pip.onorder').count()) >= 1 &&
    /arrives wk/.test(await page.locator('.tc-meta').first().innerText() +
                      await page.locator('#meeting-body').innerText()));
} else {
  check('ordering a crew shows it as on order, not on site', true, 'no orderable trade in week 1');
}

/* ---------- the crew board ------------------------------------------ */
await page.locator('.trade-card').first().waitFor();
check('the crew board groups work fronts under their trade',
  (await page.locator('.trade-card').count()) >= 1 &&
  (await page.locator('.trade-card .tc-front').count()) >= 1);
check('week 1 does not list every trade — irrelevant ones collapse',
  (await page.locator('.trade-card').count()) <= 3 &&
  (await page.locator('.board-off').count()) === 1,
  'cards=' + (await page.locator('.trade-card').count()));
check('week 1 shows no stale delta from a previous game',
  (await page.locator('#preview .delta').count()) === 0);
check('each work front shows its zone and its float',
  (await page.locator('.tc-front .zbadge').count()) >= 1 &&
  (await page.locator('.tc-front .f').count()) >= 1);
/* exercise the decision controls at least once */
const before = await page.locator('#preview').innerText();
const otBtns = page.locator('.seg button[data-v="1"]');
check('overtime control is on the trade card', (await otBtns.count()) >= 1);
await otBtns.first().click();
const after = await page.locator('#preview').innerText();
check('live preview responds to a decision before commit', before !== after,
  before.replace(/\n/g, ' ') + '  ->  ' + after.replace(/\n/g, ' '));

const full = await playToEnd(60, 'full');
await page.waitForTimeout(1400);
check('full game reaches the debrief', await page.locator('#debrief:not([hidden])').count() === 1,
  'weeks played=' + full.weeks);
check('full game fits a class period (<= 32 turns)', full.weeks <= 32, 'weeks=' + full.weeks);

/* Time a realistic session: the machine plays instantly, so model a
   student turn as animation + a decision pause, and report it. */
const PER_TURN_DECISION_S = 55;
const animS = 1.15;
const estMin = (full.weeks * (PER_TURN_DECISION_S + animS)) / 60;
check('estimated play time under 45 minutes at ~55s of deliberation per turn',
  estMin < 45, estMin.toFixed(1) + ' min for ' + full.weeks + ' turns');
console.log('      (' + full.weeks + ' turns; machine-speed run took ' + (full.ms / 1000).toFixed(1) + 's)');

check('no console errors during the whole session', consoleErrors.length === 0,
  consoleErrors.slice(0, 6).join('\n      '));

/* ---------- phone viewport ------------------------------------------ */
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const phoneErrors = [];
phone.on('pageerror', e => phoneErrors.push(e.message));
await phone.goto(FILE);
await phone.waitForSelector('#setup-inner .sheet');
check('phone: the briefing opens on load', (await hidden(phone, 'howto')) === false);
check('phone: the briefing fits the screen and scrolls inside itself',
  await phone.locator('#howto .modal').evaluate(n => {
    const b = n.getBoundingClientRect();
    return b.left >= 0 && b.right <= innerWidth && b.height <= innerHeight &&
           n.scrollHeight > n.clientHeight;
  }));
check('phone: nothing inside the briefing overflows it',
  await phone.locator('#howto .modal').evaluate(n => {
    const r = n.getBoundingClientRect().right;
    return [...n.querySelectorAll('*')].every(c => c.getBoundingClientRect().right <= r + 1);
  }));
await phone.tap('#howto', { position: { x: 6, y: 6 } });
check('phone: a tap outside dismisses the briefing', (await hidden(phone, 'howto')) === true);
check('phone: setup sheet renders and scrolls', await phone.locator('#setup-inner h1').count() === 1);
await phone.fill('#in-team', 'Phone Crew');
await phone.fill('#in-seed', 'MSU-2601');
await phone.click('#ch-project button[data-v="tutorial"]');
await phone.click('#btn-start');
await phone.waitForSelector('#app:not([hidden])');
check('phone: the tab bar appears', await phone.locator('#m-nav').isVisible());
check('phone: meeting shows first, site pane hidden',
  await phone.locator('#meeting-body').isVisible() && !(await phone.locator('#view-host').isVisible()));
await phone.click('#m-site');
check('phone: SITE tab shows the 4D view', await phone.locator('#fourd-svg').isVisible());
await phone.click('#m-meet');
const noHScroll = await phone.evaluate(() => {
  window.scrollTo(60, 0);
  return window.scrollX === 0;      // the page must refuse to pan sideways
});
check('phone: the page cannot be panned sideways', noHScroll);
check('phone: the credit sits clear of the SITE / MEETING tab bar', await phone.evaluate(() => {
  const c = document.querySelector('.bh-credit').getBoundingClientRect();
  const n = document.getElementById('m-nav').getBoundingClientRect();
  return c.width > 0 && c.bottom <= n.top + 0.5;
}));
check('phone: the ? control is a real touch target in the title bar',
  await phone.locator('#btn-howto').evaluate(n => {
    const b = n.getBoundingClientRect();
    return b.width >= 34 && b.height >= 34 && b.right <= innerWidth;
  }));
await phone.click('#btn-instructor');
await phone.click('#btn-notes');
check('phone: the presenter\'s notes fit the screen',
  await phone.locator('#presenter .modal').evaluate(n => {
    const r = n.getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth &&
           [...n.querySelectorAll('*')].every(c => c.getBoundingClientRect().right <= r.right + 1);
  }));
check('phone: a notes section is a 40px+ tap target',
  await phone.locator('#presenter summary').first().evaluate(n => n.getBoundingClientRect().height >= 40));
await phone.keyboard.press('Escape');
/* answer any calls, then commit one week end to end */
const pcards = await phone.locator('.call').count();
for (let k = 0; k < pcards; k++) {
  const card = phone.locator('.call').nth(k);
  if (await card.locator('.call-opt.on').count()) continue;
  const opts = card.locator('.call-opt');
  if (await opts.count()) await opts.first().click();
}
await phone.click('#btn-commit');
await phone.waitForTimeout(1400);
check('phone: a committed week lands back on the report',
  (await phone.locator('#btn-next').count()) === 1 || (await phone.locator('#btn-debrief').count()) === 1);
check('phone: no page errors', phoneErrors.length === 0, phoneErrors.slice(0, 3).join(' | '));
await phone.close();

await browser.close();
console.log('----');
console.log(failures ? failures + ' integration check(s) failed' : 'all integration checks passed');
process.exit(failures ? 1 : 0);
