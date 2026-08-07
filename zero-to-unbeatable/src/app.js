/* =====================================================================
   Zero to Unbeatable — user interface

   Owns: the game you play, the training montage, the era ledger, the
   brain inspector and the explainers. All of the learning lives in
   engine.js; nothing in this file touches the value table except to
   read it for display.
   ===================================================================== */

(function () {
'use strict';

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const MARK = ['', '✕', '◯'];              // ✕ and ◯
const CELLNAME = ['top left', 'top middle', 'top right',
                  'middle left', 'the centre', 'middle right',
                  'bottom left', 'bottom middle', 'bottom right'];

const S = {
  mode: 'one',         // 'one' board, or 'nine' at once
  live: null,          // the one-board agent that keeps training
  live9: null,         // the nine-board brain
  eras: [],            // frozen snapshots, index === era number
  era: 0,              // which one you are playing
  game: null,          // one-board game in progress
  match: null,         // nine-board match in progress
  focus: 0,            // which of the nine boards you are pointing at
  burst: OG.HP.burst,
  burst9: NINE.HP9.burst,
  brain: false,
  seed: '',
  // These streams deliberately never share state.  A reader (the report) or
  // a player must not be able to alter the next training example.
  rng: Math.random,              // training only
  liveRng: { one: Math.random, nine: Math.random }, // independent playable-game streams
  measureSalt: '',               // immutable for one reset/session
  humanFirstNext: true,
  alwaysFirst: false,
  training: false,
  lastLearned: null
};
const isNine = () => S.mode === 'nine';

const fmt = n => n.toLocaleString('en-US');
/* compact so an era label still fits a projector-sized dropdown */
const fmtk = n => n >= 1000 ? (n / 1000).toFixed(n % 1000 && n < 10000 ? 1 : 0).replace(/\.0$/, '') + 'k' : String(n);
const sgn = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);

/* A value in [-1,1] as a colour, staying inside the Murray State palette:
   red-orange for losing, brand navy for even, gold for winning. Warm
   hues at both ends are hard to tell apart with some kinds of colour
   blindness, so every heat square also prints its signed number and the
   ink flips to navy on the light end to keep that number legible. */
const HEAT_LOSE = [255, 69, 0];     /* #FF4500 */
const HEAT_EVEN = [10, 49, 97];     /* #0A3161 */
const HEAT_WIN  = [236, 172, 0];    /* #ECAC00 */

function heatRGB(v) {
  const t = Math.max(-1, Math.min(1, v));
  const mix = (a, b, k) => a.map((x, i) => Math.round(x + (b[i] - x) * k));
  return t < 0 ? mix(HEAT_EVEN, HEAT_LOSE, -t) : mix(HEAT_EVEN, HEAT_WIN, t);
}
function heat(v) { const c = heatRGB(v); return `rgb(${c[0]},${c[1]},${c[2]})`; }
function heatInk(v) {
  const c = heatRGB(v);
  const lin = x => { x /= 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  return L > 0.34 ? '#00142B' : '#F3F7FF';
}

/* ------------------------------------------------------------------ *
 * Eras
 * ------------------------------------------------------------------ */

function snapshotLandmarks(agent) {
  return OG.LANDMARKS.map(L => ({
    id: L.id,
    values: OG.moveValues(agent, L.code)
  }));
}

/* How many positions would this agent now play differently from the
   last one? A number that keeps moving after the landmark cards have
   gone quiet -- which is itself the point being made. */
function policyDiff(a, b) {
  let n = 0;
  for (let i = 0; i < OG.OPEN_POSITIONS.length; i++) {
    const c = OG.OPEN_POSITIONS[i];
    const x = OG.argmaxMoves(a, c).join(','), y = OG.argmaxMoves(b, c).join(',');
    if (x !== y) n++;
  }
  return n;
}

function makeEra(n, agent, prevAgent, mix, kind, nineStats) {
  const verified = OG.verifyUnbeatable(agent);
  const e = {
    n, agent, brain: NINE.cloneBrain(S.live9),
    kind: kind || 'one',
    games: agent.games, seen: agent.seen,
    matches: S.live9.matches, seen9: S.live9.seen, seeded9: S.live9.seeded,
    eps: OG.epsilonAt(agent.games), eps9: NINE.epsilonAt(S.live9.matches),
    verified, mix: mix || null, nine: nineStats || null,
    landmarks: snapshotLandmarks(agent),
    changed: prevAgent ? policyDiff(prevAgent, agent) : null,
    rec: { w: 0, l: 0, d: 0 },
    rec9: { w: 0, l: 0, d: 0 }
  };
  console.log(
    `[Zero to Unbeatable] Era ${n} — ${fmt(e.games)} training games, ${fmt(e.seen)} positions seen.\n` +
    `           Exhaustive check, agent moving first:  ${verified.asFirst.safe ? 'no losing line exists' : 'A LOSING LINE EXISTS'}` +
    ` (${fmt(verified.asFirst.lines)} lines, ${fmt(verified.asFirst.positions)} positions)\n` +
    `           Exhaustive check, agent moving second: ${verified.asSecond.safe ? 'no losing line exists' : 'A LOSING LINE EXISTS'}` +
    ` (${fmt(verified.asSecond.lines)} lines, ${fmt(verified.asSecond.positions)} positions)\n` +
    `           VERDICT: ${verified.safe ? 'UNBEATABLE — zero losses across every reachable line, both roles.'
                                          : 'still beatable.'}`);
  return e;
}

function currentEra() { return S.eras[S.era]; }

function resetAll() {
  S.rng = OG.makeRng(S.seed || null);
  /* Keep one-board and nine-board play in distinct streams.  Switching
     modes must not make a prior one-board move alter a rehearsed nine-board
     reply (or vice versa).  A blank seed deliberately starts fresh streams. */
  const liveSeed = mode => S.seed
    ? 'live-play:' + S.seed + ':' + mode
    : 'live-play:' + Math.random().toString(36).slice(2) + ':' + mode;
  S.liveRng = { one: OG.makeRng(liveSeed('one')), nine: OG.makeRng(liveSeed('nine')) };
  S.measureSalt = S.seed ? 'measure:' + S.seed : 'measure:' + Math.random().toString(36).slice(2);
  S.live = OG.newAgent();
  S.live9 = NINE.newBrain();
  S.eras = [makeEra(0, OG.cloneAgent(S.live), null, null, 'one')];
  S.era = 0;
  S.humanFirstNext = true;
  S.lastLearned = null;
  $('#btn-learned').hidden = true;
  renderEraSelect();
  newGame();
  renderTrain();
  renderBanner();
}

/* Measurement is a pure reader.  Its seed is derived from a frozen era, not
   from S.rng, so reopening a card cannot perturb a later burst. */
function measureRng(era, label) {
  return OG.makeRng(S.measureSalt + ':' + era.n + ':' + era.games + ':' + era.matches + ':' + label);
}

/* Hand Act I's table over to the nine-board brain. Done on entering the
   mode, and repeated on every entry until Act II has actually trained,
   so the handover always reflects whatever Act I knows by then. */
function maybeSeed() {
  if (S.live9.matches > 0) return 0;
  S.live9 = NINE.newBrain();
  const n = NINE.seedFromAgent(S.live9, S.live);
  S.eras.forEach(e => {
    if (e.brain.matches === 0) {
      e.brain = NINE.cloneBrain(S.live9);
      e.seen9 = S.live9.seen; e.seeded9 = S.live9.seeded;
    }
  });
  return n;
}

function currentRec() { return isNine() ? currentEra().rec9 : currentEra().rec; }

/* ------------------------------------------------------------------ *
 * The game
 * ------------------------------------------------------------------ */

function newGame() {
  if (isNine()) return newMatch();
  const humanFirst = S.alwaysFirst ? true : S.humanFirstNext;
  S.humanFirstNext = !humanFirst;
  S.game = {
    code: 0,
    humanMark: humanFirst ? 1 : 2,
    aiMark: humanFirst ? 2 : 1,
    over: false, result: null, lastCell: -1, winLine: null,
    thinking: false
  };
  renderBoard();
  renderStatus();
  if (!humanFirst) aiTurn(420);
}

function winningLine(code) {
  const w = OG.WINNER[code];
  if (!w) return null;
  const cells = OG.cellsOf(code);
  for (const L of OG.LINES) if (cells[L[0]] === w && cells[L[1]] === w && cells[L[2]] === w) return L;
  return null;
}

function applyMove(cell) {
  const g = S.game;
  const mover = OG.TOMOVE[g.code];
  g.code = OG.child(g.code, cell, mover);
  g.lastCell = cell;
  const w = OG.WINNER[g.code];
  if (w !== 0) {
    g.over = true;
    g.winLine = winningLine(g.code);
    g.result = (w === g.humanMark) ? 'win' : 'loss';
  } else if (OG.NEMPTY[g.code] === 0) {
    g.over = true;
    g.result = 'draw';
  }
  if (g.over) {
    const rec = currentEra().rec;
    if (g.result === 'win') rec.w++; else if (g.result === 'loss') rec.l++; else rec.d++;
    renderScore();
  }
}

/* ------------------------------------------------------------------ *
 * Nine at once
 * ------------------------------------------------------------------ */

function newMatch() {
  const humanFirst = S.alwaysFirst ? true : S.humanFirstNext;
  S.humanFirstNext = !humanFirst;
  S.match = NINE.newMatch();
  S.match.humanMark = humanFirst ? 1 : 2;
  S.focus = 4;                       /* the middle board, arbitrarily */
  renderNine(); renderStatus();
  if (!humanFirst) nineAiTurn(500);
}

function nineResult() {
  const m = S.match;
  if (!m.over) return null;
  if (m.winner === 3) return 'draw';
  return m.winner === m.humanMark ? 'win' : 'loss';
}

/* Point at the board just played in — unless that move finished it, in
   which case there is nothing to tap there and we move on to a live one. */
function pickFocus(m, prefer) {
  if (m.r[prefer] === 0) return prefer;
  for (let i = 0; i < 9; i++) if (m.r[(prefer + i) % 9] === 0) return (prefer + i) % 9;
  return prefer;
}

function applyNine(move) {
  const m = S.match;
  NINE.applyMove(m, move);
  S.focus = pickFocus(m, m.last.board);
  if (m.over) {
    const rec = currentEra().rec9, r = nineResult();
    if (r === 'win') rec.w++; else if (r === 'loss') rec.l++; else rec.d++;
    renderScore();
  }
}

function onNineCell(cell) {
  const m = S.match;
  if (!m || m.over || m.thinking || S.training) return;
  if (m.turn !== m.humanMark) return;
  if (m.r[S.focus] !== 0) return;
  if (OG.cellsOf(m.b[S.focus])[cell] !== 0) return;
  applyNine(S.focus * 9 + cell);
  renderNine(); renderStatus();
  if (!m.over) nineAiTurn(360);
}

function nineAiTurn(delay) {
  const m = S.match;
  m.thinking = true;
  renderNine(); renderStatus();
  setTimeout(() => {
    if (!S.match || S.match !== m || m.over) return;
    applyNine(NINE.greedyMove(currentEra().brain, m, S.liveRng.nine));
    m.thinking = false;
    renderNine(); renderStatus();
  }, S.brain ? Math.max(delay, 1300) : delay);
}

function onCell(cell) {
  const g = S.game;
  if (!g || g.over || g.thinking || S.training) return;
  if (OG.TOMOVE[g.code] !== g.humanMark) return;
  if (OG.cellsOf(g.code)[cell] !== 0) return;
  applyMove(cell);
  renderBoard(); renderStatus();
  if (!g.over) aiTurn(340);
}

function aiTurn(delay) {
  const g = S.game;
  g.thinking = true;
  /* Paint before it moves: with the inspector on, this is the moment the
     heatmap shows ITS options rather than yours, so hold it long enough
     to be read. */
  renderBoard(); renderStatus();
  setTimeout(() => {
    if (!S.game || S.game !== g || g.over) return;
    const cell = OG.greedyMove(currentEra().agent, g.code, S.liveRng.one);
    applyMove(cell);
    g.thinking = false;
    renderBoard(); renderStatus();
  }, S.brain ? Math.max(delay, 1250) : delay);
}

/* ------------------------------------------------------------------ *
 * Rendering — board
 * ------------------------------------------------------------------ */

const boardEl = $('#board');
for (let i = 0; i < 9; i++) {
  const b = document.createElement('button');
  b.className = 'cell'; b.dataset.i = i; b.setAttribute('role', 'gridcell');
  b.addEventListener('click', () => onCell(i));
  boardEl.appendChild(b);
}

function renderBoard() {
  const g = S.game, cells = OG.cellsOf(g.code);
  const agent = currentEra().agent;
  const showHeat = S.brain && !g.over;
  const vals = showHeat ? OG.moveValues(agent, g.code) : [];
  const picks = showHeat ? OG.argmaxMoves(agent, g.code) : [];
  const byCell = {}; vals.forEach(v => byCell[v.cell] = v);

  $$('.cell', boardEl).forEach((el, i) => {
    const m = cells[i];
    el.className = 'cell' + (m ? ' mk' + m : ' open') +
      (g.lastCell === i && m ? ' last' : '') +
      (g.winLine && g.winLine.includes(i) ? ' win' : '') +
      (showHeat && !m ? ' heat' : '') +
      (showHeat && picks.includes(i) ? ' pick' : '');
    el.disabled = !!m || g.over || g.thinking || OG.TOMOVE[g.code] !== g.humanMark;
    el.style.background = '';
    el.style.color = '';
    if (m) {
      el.textContent = MARK[m];
      el.setAttribute('aria-label', CELLNAME[i] + ', ' + (m === g.humanMark ? 'yours' : 'its'));
      return;
    }
    if (showHeat && byCell[i]) {
      const v = byCell[i];
      el.style.background = heat(v.value);
      el.style.color = heatInk(v.value);
      el.innerHTML = `<span class="v">${sgn(v.value)}</span>` +
                     `<span class="n">seen ${fmt(v.visits)}×</span>`;
      el.setAttribute('aria-label',
        `${CELLNAME[i]}: value ${v.value.toFixed(2)}, seen ${v.visits} times`);
    } else {
      el.textContent = '';
      el.setAttribute('aria-label', CELLNAME[i] + ', empty');
    }
  });
  renderBrainReadout();
}

/* the overview grid, plus the one board you are actually playing in */
const nineGrid = $('#nine-grid'), nineFocus = $('#nine-focus');
for (let b = 0; b < 9; b++) {
  const nb = document.createElement('button');
  nb.className = 'nb'; nb.dataset.b = b; nb.type = 'button';
  for (let c = 0; c < 9; c++) { const i = document.createElement('i'); nb.appendChild(i); }
  nb.addEventListener('click', () => {
    if (!S.match || S.match.r[b] !== 0) return;
    S.focus = b; renderNine(); renderStatus();
  });
  nineGrid.appendChild(nb);
}
for (let c = 0; c < 9; c++) {
  const el = document.createElement('button');
  el.className = 'cell'; el.dataset.c = c; el.setAttribute('role', 'gridcell');
  el.addEventListener('click', () => onNineCell(c));
  nineFocus.appendChild(el);
}

function renderNine() {
  const m = S.match;
  if (!m) return;
  const brain = currentEra().brain;
  const RES = ['', 'X', 'O', '—'];

  $$('.nb', nineGrid).forEach((nb, b) => {
    const cells = OG.cellsOf(m.b[b]);
    nb.className = 'nb' + (m.r[b] ? ' done r' + m.r[b] : '') +
      (b === S.focus ? ' focus' : '') +
      (m.last && m.last.board === b ? ' last' : '');
    nb.disabled = m.r[b] !== 0;
    $$('i', nb).forEach((i, c) => { i.className = cells[c] ? 'm' + cells[c] : ''; });
    nb.setAttribute('aria-label', 'Board ' + (b + 1) +
      (m.r[b] === 0 ? ', in play' : m.r[b] === 3 ? ', drawn' :
       ', won by ' + (m.r[b] === m.humanMark ? 'you' : 'it')));
    let tag = nb.querySelector('.tag');
    if (!tag) { tag = document.createElement('span'); tag.className = 'tag'; nb.appendChild(tag); }
    tag.textContent = m.r[b] ? RES[m.r[b]] : '';
  });

  const code = m.b[S.focus], cells = OG.cellsOf(code);
  const yours = !m.over && m.turn === m.humanMark;
  const showHeat = S.brain && !m.over && m.r[S.focus] === 0;
  const mark = m.turn;
  const picks = showHeat ? NINE.policyMoves(brain, m).filter(mv => ((mv / 9) | 0) === S.focus)
                              .map(mv => mv % 9) : [];
  $$('.cell', nineFocus).forEach((el, c) => {
    const v = cells[c];
    el.className = 'cell' + (v ? ' mk' + v : ' open') +
      (m.last && m.last.board === S.focus && m.last.cell === c && v ? ' last' : '') +
      (showHeat && !v ? ' heat' : '') + (picks.includes(c) ? ' pick' : '');
    el.disabled = !!v || m.over || m.thinking || !yours || m.r[S.focus] !== 0;
    el.style.background = ''; el.style.color = '';
    if (v) { el.textContent = MARK[v]; el.setAttribute('aria-label', CELLNAME[c] + ', taken'); return; }
    if (showHeat) {
      const val = NINE.moveValue(brain, code, c, mark);
      const seen = brain.N[NINE.ui(code + mark * OG.POW3[c], mark === 1 ? 2 : 1)];
      el.style.background = heat(val); el.style.color = heatInk(val);
      el.innerHTML = `<span class="v">${sgn(val)}</span>` +
        `<span class="n">${seen ? 'seen ' + fmt(seen) + '×' : 'never seen'}</span>`;
      el.setAttribute('aria-label', CELLNAME[c] + ': ' + val.toFixed(2) +
        (seen ? ', seen ' + seen + ' times' : ', never seen'));
    } else {
      el.textContent = '';
      el.setAttribute('aria-label', CELLNAME[c] + ', empty');
    }
  });

  const t = NINE.tally(m);
  const you = m.humanMark === 1 ? t.x : t.o, it = m.humanMark === 1 ? t.o : t.x;
  $('#nine-tally').innerHTML =
    `<span class="nt you"><b>${you}</b> yours</span>` +
    `<span class="nt mid">first to ${NINE.TO_WIN}</span>` +
    `<span class="nt ai"><b>${it}</b> its</span>` +
    (t.d ? `<span class="nt dr"><b>${t.d}</b> drawn</span>` : '');
  renderBrainReadout();
}

function renderStatus() {
  if (isNine()) return renderNineStatus();
  const g = S.game, el = $('#status');
  el.className = '';
  if (g.over) {
    const t = g.result === 'win' ? ['You win.', 'Era ' + S.era + ' let you through.']
            : g.result === 'loss' ? ['It beat you.', 'Era ' + S.era + ' found a line you missed.']
            : ['Drawn.', 'Neither of you got through.'];
    el.classList.add(g.result === 'win' ? 'you-win' : g.result === 'loss' ? 'you-lose' : 'drawn');
    el.innerHTML = `<div><span class="big">${t[0]}</span><br><span class="sub">${t[1]}</span></div>`;
    return;
  }
  if (g.thinking) { el.innerHTML = `<div><span class="sub">Era ${S.era} is choosing…</span></div>`; return; }
  const yours = OG.TOMOVE[g.code] === g.humanMark;
  el.innerHTML = `<div><span class="big">${yours ? 'Your move' : 'Its move'}</span><br>` +
    `<span class="sub">you are ${MARK[g.humanMark]} ${g.humanMark === 1 ? '(you go first)' : '(it goes first)'}</span></div>`;
}

function renderNineStatus() {
  const m = S.match, el = $('#status');
  el.className = '';
  if (!m) return;
  if (m.over) {
    const r = nineResult();
    const t = r === 'win' ? ['You win the match.', 'It could not take five boards.']
            : r === 'loss' ? ['It wins the match.', 'Nine boards is a different problem.']
            : ['Match drawn.', 'Neither of you got to five.'];
    el.classList.add(r === 'win' ? 'you-win' : r === 'loss' ? 'you-lose' : 'drawn');
    el.innerHTML = `<div><span class="big">${t[0]}</span><br><span class="sub">${t[1]}</span></div>`;
    return;
  }
  if (m.thinking) { el.innerHTML = `<div><span class="sub">Era ${S.era} is choosing a board…</span></div>`; return; }
  const yours = m.turn === m.humanMark;
  el.innerHTML = `<div><span class="big">${yours ? 'Your move' : 'Its move'}</span><br>` +
    `<span class="sub">you are ${MARK[m.humanMark]} · playing board ${S.focus + 1}` +
    ` · tap another board to switch</span></div>`;
}

function renderBrainReadout() {
  const el = $('#brain-readout');
  el.hidden = !S.brain;
  if (!S.brain) return;
  if (isNine()) return renderNineReadout();
  const e = currentEra(), g = S.game;
  const yours = !g.over && OG.TOMOVE[g.code] === g.humanMark;
  const whose = g.over ? 'The game is over, so there is nothing left to score.'
    : yours ? 'These are its scores for <b>your</b> options — higher is better for you. The same table reads both sides of the board.'
            : 'These are its scores for <b>its own</b> options. It will play one of the outlined squares.';
  el.innerHTML =
    `<div>${whose}</div>` +
    `<div style="margin-top:.5em">Era ${e.n}’s entire mind: <b>${fmt(e.seen)}</b> positions with a number attached, ` +
    `out of <b>${fmt(OG.OPEN_POSITIONS.length + 958)}</b> that can occur. That is the whole thing. There is nothing else in there.</div>` +
    `<div class="legend"><span>losing</span><span class="ramp"></span><span>winning</span></div>`;
}

function renderNineReadout() {
  const el = $('#brain-readout'), e = currentEra(), m = S.match, brain = e.brain;
  const blind = m && !m.over ? NINE.blindFraction(brain, m) : 0;
  const total = OG.NCODE * 2;
  el.innerHTML =
    `<div>Scores for board ${S.focus + 1} only — how much each square would improve ` +
    `<b>that</b> board. The other eight do not change, so this is the whole comparison.</div>` +
    `<div style="margin-top:.5em">Era ${e.n}'s nine-board table: <b>${fmt(brain.seen)}</b> of ` +
    `<b>${fmt(total)}</b> board pictures have a number in them` +
    (brain.seeded ? `, <b>${fmt(brain.seeded)}</b> of them handed straight over from the one-board table` : '') +
    `.</div>` +
    (m && !m.over
      ? `<div style="margin-top:.5em">Right now <b>${Math.round(blind * 100)}%</b> of the squares it is ` +
        `weighing up sit on a board picture it has <b>never seen</b>.</div>` : '') +
    `<div class="legend"><span>losing</span><span class="ramp"></span><span>winning</span></div>`;
}

function renderScore() {
  const r = currentRec();
  $('#score-row').innerHTML =
    `<div class="sc win"><span class="n">${r.w}</span><span class="k">you won</span></div>` +
    `<div class="sc draw"><span class="n">${r.d}</span><span class="k">drawn</span></div>` +
    `<div class="sc loss"><span class="n">${r.l}</span><span class="k">you lost</span></div>`;
  renderEraStrip();
}

function renderEraSelect() {
  const sel = $('#era-select');
  sel.innerHTML = S.eras.map(e =>
    `<option value="${e.n}">Era ${e.n} · ` +
    (isNine()
      ? (e.matches ? fmtk(e.matches) + ' matches' : 'no nine-board practice')
      : (e.n === 0 ? 'newborn' : fmtk(e.games) + ' games') + (e.verified.safe ? ' · unbeatable' : '')) +
    `</option>`).join('');
  sel.value = String(S.era);
  renderEraStrip();
}

/* "You vs Era 0: 3-0-0. You vs Era 4: 0-1-4." — the whole arc in one line. */
function renderEraStrip() {
  const key = isNine() ? 'rec9' : 'rec';
  const played = S.eras.filter(e => e[key].w + e[key].l + e[key].d > 0);
  const el = $('#era-strip');
  el.hidden = played.length === 0;
  if (!played.length) return;
  el.innerHTML = '<span class="k">your record</span>' + played.map(e =>
    `<span class="chip${e.n === S.era ? ' on' : ''}">E${e.n} ` +
    `<b class="w">${e[key].w}</b>–<b class="d">${e[key].d}</b>–<b class="l">${e[key].l}</b></span>`).join('');
}

function renderTrain() {
  const e = S.eras[S.eras.length - 1];
  const nine = isNine();
  $('.t-main', $('#btn-train')).textContent = nine ? 'Train on nine boards' : 'Train the AI';
  $('#train-sub').textContent = nine ? fmt(S.burst9) + ' matches' : fmt(S.burst) + ' games';
  const sizes = nine ? NINE.HP9.bursts : OG.HP.bursts;
  const cur = nine ? S.burst9 : S.burst;
  $('#burst-seg').innerHTML = sizes.map(b =>
    `<button data-b="${b}" class="${b === cur ? 'on' : ''}" aria-pressed="${b === cur}">${fmt(b)}</button>`).join('');
  $$('#burst-seg button').forEach(b => b.addEventListener('click', () => {
    if (isNine()) S.burst9 = +b.dataset.b; else S.burst = +b.dataset.b;
    renderTrain();
  }));
  $('#train-stats').innerHTML = nine
    ? `<div class="st"><span class="n">${fmt(e.matches)}</span><span class="k">matches trained</span></div>` +
      `<div class="st"><span class="n">${fmt(e.seen9)}</span><span class="k">pictures seen</span></div>` +
      `<div class="st"><span class="n">${fmt(OG.NCODE * 2)}</span><span class="k">table slots</span></div>`
    : `<div class="st"><span class="n">${S.eras.length - 1}</span><span class="k">eras</span></div>` +
      `<div class="st"><span class="n">${fmt(e.games)}</span><span class="k">games trained</span></div>` +
      `<div class="st"><span class="n">${fmt(e.seen)}</span><span class="k">positions seen</span></div>`;
}

function renderBanner() {
  const el = $('#banner');
  const top = S.eras[S.eras.length - 1];
  if (isNine()) {
    el.hidden = false;
    el.classList.add('quiet');
    el.innerHTML =
      `<h3>There is no banner for this one, and that is the point.</h3>` +
      `<p>On one board the app can search every game that could still be played — about fifteen ` +
      `thousand of them — and tell you for certain that it cannot lose. Here it cannot. Nine boards ` +
      `at once has so many positions that checking them all is not a slow job, it is an impossible ` +
      `one.</p>` +
      `<p>So this agent is only ever <b>good</b>. Not proven. That is the ordinary situation for every ` +
      `serious AI system: chess engines, self-driving cars, language models. Nobody can check all the ` +
      `cases, so nobody can promise. They measure instead — which is what the card after each burst ` +
      `does.</p>` +
      `<div class="proof">Handed over from the one-board table: ` +
      `${fmt(S.live9.seeded)} of the ${fmt(OG.NCODE * 2)} entries this game needs · ` +
      `filled so far ${fmt(S.live9.seen)} · matches trained ${fmt(S.live9.matches)}</div>`;
    return;
  }
  el.classList.remove('quiet');
  if (!top.verified.safe) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML =
    `<h3>You can no longer beat this. Neither can anyone. The best a human can do is tie.</h3>` +
    `<p>That is not a claim from playing it a lot of times. Every game that can still be played ` +
    `against Era ${top.n} was searched, with Era ${top.n} moving first and moving second, and in ` +
    `none of them does it lose.</p>` +
    `<p>Tic-tac-toe ends here because it is small: about five and a half thousand positions, so a ` +
    `table can hold all of them. Chess has more positions than there are atoms on Earth, and language ` +
    `has no fixed number at all — no table can hold either. So the big systems throw the table away ` +
    `and use a neural network, which stores a compressed guess instead of an exact entry. Different ` +
    `brain, same idea: play, get feedback, adjust, repeat.</p>` +
    `<div class="proof">Proof: ${fmt(top.verified.lines)} complete game lines searched · ` +
    `${fmt(top.verified.positions)} positions examined · 0 losses · both roles · ` +
    `re-run any time from Settings &rarr; Run the full self-test.</div>`;
}

/* ------------------------------------------------------------------ *
 * Training montage
 * ------------------------------------------------------------------ */

const MONTAGE_MS = 2400;         /* the maths takes ~30ms; see the note in
                                    the explainer panel. This is a paced
                                    visualisation, honestly labelled. */

function raf() { return new Promise(r => requestAnimationFrame(r)); }
async function pauseUntil(t) { while (performance.now() < t) await raf(); }

function miniHTML(code) {
  const c = OG.cellsOf(code);
  return '<div class="mini">' + Array.from(c).map(v =>
    `<i class="${v ? 'm' + v : ''}">${MARK[v] || ''}</i>`).join('') + '</div>';
}

async function train() {
  if (S.training) return;
  if (isNine()) return trainNine();
  S.training = true;
  const size = S.burst;
  const prev = OG.cloneAgent(S.live);
  const ov = $('#montage'); ov.hidden = false;
  $('#m-count').classList.add('blur');
  $('#m-count-sub').textContent = 'games played against itself and against chance';
  $('#m-wr-label').textContent = 'wins vs a random player';
  $('#m-boards').classList.remove('nine');
  $('#m-boards').innerHTML = Array.from({ length: 6 }, () => miniHTML(0)).join('');

  const STEPS = 36, per = Math.ceil(size / STEPS);
  const t0 = performance.now();
  let done = 0, selfPlay = 0, vsRandom = 0, wr = null, pool = [];

  for (let i = 0; i < STEPS; i++) {
    const n = Math.min(per, size - done);
    if (n > 0) {
      const r = OG.trainGames(S.live, n, S.rng, { sampleEvery: Math.max(1, Math.floor(n / 3)) });
      done += n; selfPlay += r.selfPlay; vsRandom += r.vsRandom;
      pool = pool.concat(r.samples).slice(-24);
    }
    if (i % 6 === 3) {
      const s = OG.vsRandom(S.live, 200, S.rng);
      wr = s.winRate;
    }
    /* paint */
    $('#m-count').textContent = fmt(done);
    const eps = OG.epsilonAt(S.live.games);
    $('#m-eps').textContent = eps.toFixed(2);
    $('#m-eps-fill').style.width = (eps * 100).toFixed(1) + '%';
    if (wr !== null) {
      $('#m-wr').textContent = (wr * 100).toFixed(0) + '%';
      $('#m-wr-fill').style.width = (wr * 100).toFixed(1) + '%';
    }
    $('#m-prog').style.width = ((i + 1) / STEPS * 100).toFixed(1) + '%';
    if (pool.length) {
      $('#m-boards').innerHTML = Array.from({ length: 6 }, () => {
        const t = pool[(Math.random() * pool.length) | 0];
        return miniHTML(t[(Math.random() * t.length) | 0]);
      }).join('');
    }
    await pauseUntil(t0 + MONTAGE_MS * (i + 1) / STEPS);
  }

  $('#m-count').classList.remove('blur');
  await pauseUntil(t0 + MONTAGE_MS + 160);

  const era = makeEra(S.eras.length, OG.cloneAgent(S.live), prev, { selfPlay, vsRandom });
  S.eras.push(era);
  S.era = era.n;
  ov.hidden = true;
  S.training = false;
  renderEraSelect(); renderTrain(); renderBanner();
  newGame(); renderScore();
  buildLearned(era, S.eras[era.n - 1]);
  $('#btn-learned').hidden = false;
  openSheet('learned');
}

function mini9HTML(m) {
  let h = '<div class="mini9">';
  for (let b = 0; b < 9; b++) {
    const c = OG.cellsOf(m.b[b]);
    h += `<div class="m9b${m.r[b] ? ' r' + m.r[b] : ''}">`;
    for (let i = 0; i < 9; i++) h += `<i class="${c[i] ? 'm' + c[i] : ''}"></i>`;
    h += '</div>';
  }
  return h + '</div>';
}

async function trainNine() {
  S.training = true;
  const size = S.burst9;
  const ov = $('#montage'); ov.hidden = false;
  $('#m-count').classList.add('blur');
  $('#m-count-sub').textContent = 'matches played against itself and against chance';
  $('#m-boards').classList.add('nine');
  $('#m-boards').innerHTML = mini9HTML(NINE.newMatch()).repeat(3);
  $('#m-wr-label').textContent = 'holds or beats the hand-written player';

  const STEPS = 30, per = Math.ceil(size / STEPS);
  const t0 = performance.now();
  let done = 0, selfPlay = 0, vsRandom = 0, hold = null, pool = [];

  for (let i = 0; i < STEPS; i++) {
    const n = Math.min(per, size - done);
    if (n > 0) {
      const r = NINE.trainMatches(S.live9, n, S.rng, { sampleEvery: Math.max(1, Math.floor(n / 2)) });
      done += n; selfPlay += r.selfPlay; vsRandom += r.vsRandom;
      pool = pool.concat(r.samples).slice(-12);
    }
    if (i % 7 === 4) {
      const sc = NINE.vsHeuristic(S.live9, 60, S.rng);
      hold = (sc.wins + sc.draws) / sc.matches;
    }
    $('#m-count').textContent = fmt(done);
    const eps = NINE.epsilonAt(S.live9.matches);
    $('#m-eps').textContent = eps.toFixed(2);
    $('#m-eps-fill').style.width = (eps * 100).toFixed(1) + '%';
    if (hold !== null) {
      $('#m-wr').textContent = (hold * 100).toFixed(0) + '%';
      $('#m-wr-fill').style.width = (hold * 100).toFixed(1) + '%';
    }
    $('#m-prog').style.width = ((i + 1) / STEPS * 100).toFixed(1) + '%';
    if (pool.length) {
      $('#m-boards').innerHTML = Array.from({ length: 3 }, () =>
        mini9HTML(pool[(Math.random() * pool.length) | 0])).join('');
    }
    await pauseUntil(t0 + MONTAGE_MS * (i + 1) / STEPS);
  }
  $('#m-count').classList.remove('blur');
  await pauseUntil(t0 + MONTAGE_MS + 160);

  const era = makeEra(S.eras.length, OG.cloneAgent(S.live), null, null, 'nine',
    { selfPlay, vsRandom, matches: size });
  S.eras.push(era);
  S.era = era.n;
  ov.hidden = true;
  $('#m-boards').classList.remove('nine');
  S.training = false;
  renderEraSelect(); renderTrain(); renderBanner();
  newGame(); renderScore();
  buildLearnedNine(era, S.eras[era.n - 1]);
  $('#btn-learned').hidden = false;
  openSheet('learned');
}

/* ------------------------------------------------------------------ *
 * "What it learned"
 * ------------------------------------------------------------------ */

function landmarkCard(L, now, before) {
  const cells = OG.cellsOf(L.code);
  const nowBy = {}, beforeBy = {};
  now.values.forEach(v => nowBy[v.cell] = v);
  if (before) before.values.forEach(v => beforeBy[v.cell] = v);

  const picks = new Set(now.values
    .filter(v => v.value >= Math.max.apply(null, now.values.map(x => x.value)) - 1e-9)
    .map(v => v.cell));

  let grid = '';
  for (let i = 0; i < 9; i++) {
    if (cells[i]) {
      grid += `<div class="lc-cell mk${cells[i]}">${MARK[cells[i]]}</div>`;
      continue;
    }
    const v = nowBy[i], b = beforeBy[i];
    const d = b ? v.value - b.value : 0;
    const cls = Math.abs(d) < 0.02 ? '' : (d > 0 ? ' up' : ' down');
    grid += `<div class="lc-cell${cls}" style="background:${heat(v.value)};color:${heatInk(v.value)}">` +
      `<span class="lv">${sgn(v.value)}</span>` +
      (Math.abs(d) >= 0.02 ? `<span class="dl">${sgn(d)}</span>` : '') +
      `</div>`;
  }

  /* the sentence */
  let line;
  if (L.key === null) {
    const spread = Math.max.apply(null, now.values.map(v => v.value)) -
                   Math.min.apply(null, now.values.map(v => v.value));
    line = spread < 0.05
      ? `<span class="flat">Every opening square scores the same.</span> That is not a gap in its ` +
        `knowledge — it is the knowledge. Played properly, tic-tac-toe is a draw from any first move.`
      : `It still rates some openings above others. Give it more training and this row will flatten out, ` +
        `because against a good opponent no first move is better than any other.`;
  } else {
    const keys = [L.key].concat(L.keyAlso || []);
    /* "it knows this" means EVERY square it might now pick is a right one.
       Getting it right sometimes is not getting it right: the agent breaks
       ties by coin flip, so one wrong square in the tie set is a loss
       waiting to happen. */
    const allRight = set => set.size > 0 && Array.from(set).every(m => keys.includes(m));
    const rightNow = allRight(picks);
    const rightBefore = before ? (function () {
      const best = Math.max.apply(null, before.values.map(x => x.value));
      return allRight(new Set(before.values.filter(v => v.value >= best - 1e-9).map(v => v.cell)));
    })() : false;
    const kv = nowBy[L.key], kb = before ? beforeBy[L.key] : null;
    const worst = now.values.reduce((a, b) => a.value < b.value ? a : b);
    /* Only talk about the squares that lose once they actually read as
       losses. Early on nothing is negative yet, and "the squares that
       lose have fallen to +0.00" is nonsense on a projector. */
    const punished = worst.value < -0.05;
    if (rightNow && !rightBefore) {
      line = `<span class="up">It learned this one.</span> ${cap(L.learned)}: ` +
             `was ${kb ? sgn(kb.value) : '+0.00'}, now ${sgn(kv.value)}.` +
             (punished ? ` The squares that lose have fallen to ${sgn(worst.value)}.`
                       : ` It has not yet worked out that the other squares are bad.`);
    } else if (rightNow) {
      line = `<span class="flat">It already knew this.</span> ${cap(L.learned)} is still its choice ` +
             `at ${sgn(kv.value)}` +
             (punished ? `, against ${sgn(worst.value)} for the squares that lose.` : '.');
    } else {
      line = `<span class="down">Not yet.</span> It still rates a losing square as highly as ` +
             `${L.learned}. Train it again.`;
    }
  }

  return `<div class="lc"><h3>${L.title}</h3><div class="ask">${L.ask}</div>` +
         `<div class="lc-grid">${grid}</div><div class="delta">${line}</div></div>`;
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function buildLearned(era, before) {
  $('#learned-title').textContent = 'Era ' + era.n + ' — what changed';
  $('#learned-sub').textContent =
    fmt(era.games) + ' training games · exploration ' + era.eps.toFixed(2);

  const mix = era.mix
    ? `${fmt(era.mix.selfPlay)} against itself and ${fmt(era.mix.vsRandom)} against a random mover`
    : '';
  const head =
    `<div class="headline">` +
    `It played <b>${mix}</b>. Its table now holds <b>${fmt(era.seen)}</b> positions ` +
    (era.changed !== null
      ? `and it would now play <b>${fmt(era.changed)}</b> of them differently than it did before this burst.`
      : `.`) +
    (era.verified.safe
      ? ` <b>Every reachable line has been searched and it does not lose in any of them.</b>`
      : ` A full search still finds lines where it loses.`) +
    `</div>`;

  const cards = OG.LANDMARKS.map(L => landmarkCard(
    L,
    era.landmarks.find(x => x.id === L.id),
    before ? before.landmarks.find(x => x.id === L.id) : null)).join('');

  const tail = era.changed !== null && era.changed < 40 && !era.verified.safe
    ? `<div class="lc"><div class="delta"><span class="flat">Notice how little moved this time.</span> ` +
      `Learning curves flatten. The first burst changes almost everything; later ones argue about a ` +
      `handful of rare positions. Those rare positions are the difference between very good and perfect.</div></div>`
    : '';

  $('#learned-body').innerHTML = head + cards + tail;
  S.lastLearned = era.n;
}

/* The nine-board card does not show landmark positions, because the
   interesting thing here is not what it learned about any one picture —
   it is whether a table can work at all. So it reports the measurements
   that answer that. */
function buildLearnedNine(era, before) {
  $('#learned-title').textContent = 'Era ' + era.n + ' — nine at once';
  $('#learned-sub').textContent =
    fmt(era.matches) + ' matches · exploration ' + era.eps9.toFixed(2);

  const total = OG.NCODE * 2;
  /* the same budget each act actually trains on, so the comparison is fair */
  // Cache a report once.  Every measurement has its own deterministic stream,
  // and the card becomes a literal read-only view of this frozen era.
  const metrics = era.metrics9 || (era.metrics9 = {
    rec9: NINE.measureRecurrence(era.brain, NINE.HP9.burst, measureRng(era, 'rec9')),
    rec1: NINE.measureRecurrenceSingle(era.agent, OG.HP.burst, measureRng(era, 'rec1')),
    cpu: NINE.vsHeuristic(era.brain, 200, measureRng(era, 'heuristic')),
    rnd: NINE.vsRandom(era.brain, 100, measureRng(era, 'random'))
  });
  const { rec9, rec1, cpu, rnd } = metrics;
  const grew = before ? era.seen9 - before.seen9 : era.seen9;

  const head =
    `<div class="headline">It played <b>${fmt(era.nine.selfPlay)} matches against itself and ` +
    `${fmt(era.nine.vsRandom)} against a random mover</b>. Its nine-board table now holds ` +
    `<b>${fmt(era.seen9)}</b> of ${fmt(total)} board pictures` +
    (grew > 0 ? `, ${fmt(grew)} of them new this burst` : '') +
    (era.seeded9 ? `. <b>${fmt(era.seeded9)}</b> were handed straight over from what it learned on one board — ` +
      `${Math.round(100 * era.seeded9 / total)}% of the table, free.` : '.') +
    `</div>`;

  const cards = [
    `<div class="lc"><h3>Does anything ever come round twice?</h3>` +
    `<div class="ask">Learning from experience only works if the experience repeats. Counted by playing ` +
    `one burst's worth of each — ${fmt(OG.HP.burst)} single games, ${fmt(NINE.HP9.burst)} matches — and ` +
    `keeping a tally of every position met.</div>` +
    `<table class="cmp"><tr><th></th><th>one board</th><th>nine at once</th></tr>` +
    `<tr><td>positions met</td><td>${fmt(rec1.positions)}</td><td>${fmt(rec9.positions)}</td></tr>` +
    `<tr><td>different ones</td><td>${fmt(rec1.distinct)}</td><td>${fmt(rec9.distinct)}</td></tr>` +
    `<tr class="hi"><td>times each came round</td><td>${(rec1.positions / rec1.distinct).toFixed(1)}×</td>` +
    `<td>${(rec9.positions / rec9.distinct).toFixed(2)}×</td></tr></table>` +
    `<div class="delta"><span class="down">Essentially nothing repeats.</span> A table of whole ` +
    `nine-board positions could never learn anything, because it would never see the same page twice. ` +
    `The only reason this works at all is that it looks at <b>one board at a time</b> — and a person ` +
    `chose that. A neural network is the machine that finds such a shortcut for itself.</div></div>`,

    `<div class="lc"><h3>Against rules a person wrote by hand</h3>` +
    `<div class="ask">A fixed opponent, written out the way somebody would explain the game to you: ` +
    `take any win, block any loss, otherwise prefer the middle. This agent has never been shown those ` +
    `rules and has no way to read them.</div>` +
    `<div class="score3">` +
    `<span class="s3 w"><b>${cpu.wins}</b>won</span>` +
    `<span class="s3 d"><b>${cpu.draws}</b>drawn</span>` +
    `<span class="s3 l"><b>${cpu.losses}</b>lost</span></div>` +
    `<div class="delta">${cpu.losses === 0
        ? `<span class="up">It is no longer losing to the hand-written rules.</span> It worked that out ` +
          `from results alone.`
        : `Still losing ${cpu.losses} of ${cpu.matches}. Train it again.`}` +
    ` Against a player choosing at random it wins ${rnd.wins} of ${rnd.matches}.</div></div>`,

    `<div class="lc"><h3>What it could not carry over</h3>` +
    `<div class="ask">On one board, the marks tell you whose turn it is. Here you can play twice in the ` +
    `same board while your opponent works elsewhere, so a board can hold three of yours and one of ` +
    `theirs — a picture that cannot occur in ordinary tic-tac-toe at all.</div>` +
    `<div class="delta">Act I handed over <b>${fmt(era.seeded9)}</b> entries. The table here has ` +
    `<b>${fmt(total)}</b> slots, so <b>${Math.round(100 - 100 * era.seeded9 / total)}%</b> of what it ` +
    `needed had to be learned from scratch. Turn the inspector on during a match and it will tell you ` +
    `how many of the squares it is weighing up right now are ones it has never seen.</div></div>`
  ].join('');

  $('#learned-body').innerHTML = head + cards;
  S.lastLearned = era.n;
}

/* ------------------------------------------------------------------ *
 * Sheets
 * ------------------------------------------------------------------ */

let sheetOpener = null;
function focusables(root) { return $$('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])', root).filter(x => !x.disabled); }
function openSheet(id, opener) {
  const sheet = $('#' + id);
  sheetOpener = opener || document.activeElement;
  $('#app').inert = true; $('#app').setAttribute('aria-hidden', 'true');
  sheet.hidden = false;
  /* the print rules key off this, so printing while the notes are open
     prints the notes and nothing else */
  if (id === 'notes') { document.body.classList.add('notes-open'); $('#notes-body').scrollTop = 0; }
  const target = focusables(sheet)[0]; if (target) target.focus();
}
function closeSheet(id) {
  const sheet = $('#' + id); sheet.hidden = true;
  if (id === 'notes') document.body.classList.remove('notes-open');
  if (!$$('.overlay.sheet').some(x => !x.hidden)) { $('#app').inert = false; $('#app').removeAttribute('aria-hidden'); }
  if (sheetOpener && document.contains(sheetOpener) && !sheetOpener.disabled) sheetOpener.focus();
  sheetOpener = null;
}
$$('[data-close]').forEach(b => b.addEventListener('click', () => closeSheet(b.dataset.close)));
$$('.overlay.sheet').forEach(o => o.addEventListener('click', e => { if (e.target === o) closeSheet(o.id); }));
document.addEventListener('keydown', e => {
  const sheet = $$('.overlay.sheet').find(x => !x.hidden); if (!sheet) return;
  if (e.key === 'Escape') { e.preventDefault(); closeSheet(sheet.id); return; }
  if (e.key !== 'Tab') return;
  const items = focusables(sheet); if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

/* ------------------------------------------------------------------ *
 * Self-test — the proof, on demand, in the console and on screen
 * ------------------------------------------------------------------ */

function selfTest() {
  const out = [];
  const line = (ok, txt) => out.push(`<span class="${ok ? 'ok' : 'no'}">${ok ? 'PASS' : 'FAIL'}</span>  ${txt}`);
  let fails = 0;
  const check = (ok, txt) => { if (!ok) fails++; line(ok, txt); };

  const e = currentEra();
  if (isNine()) {
    const r = measureRng(e, 'selftest-nine');
    const cpu = NINE.vsHeuristic(e.brain, 200, r), random = NINE.vsRandom(e.brain, 200, r);
    check(e.brain && e.matches >= 0, 'nine-board brain is present and measurable');
    check(cpu.matches === 200 && random.matches === 200, 'sampled benchmarks ran: 200 hand-written and 200 random matches');
    out.push('');
    out.push(fails ? `<span class="no">${fails} sampled benchmark check(s) failed for Era ${e.n}</span>`
                   : `<span class="ok">sampled benchmarks passed for Era ${e.n} — not a proof</span>`);
    $('#selftest-out').innerHTML = out.join('\n');
    return;
  }
  /* 1. a newborn is a coin flip */
  const fresh = OG.newAgent(), r = OG.makeRng('selftest');
  const s1 = OG.sampleMoveCounts(fresh, 0, 9000, r);
  const c1 = OG.chiSquareUniform(s1.counts);
  check(c1.chi2 < 26.12,
    `newborn plays uniformly at random — chi-squared ${c1.chi2.toFixed(2)} on ${fmt(c1.n)} moves, ` +
    `df ${c1.df} (fails above 26.12, p=0.001)`);

  /* 2. exhaustive unbeatability of the era on the board */
  const v = OG.verifyUnbeatable(e.agent);
  check(v.asFirst.safe, `Era ${e.n} moving first: no losing line among ${fmt(v.asFirst.lines)} searched`);
  check(v.asSecond.safe, `Era ${e.n} moving second: no losing line among ${fmt(v.asSecond.lines)} searched`);

  /* 3. blind-spot check against uniform random play */
  const rr = OG.makeRng('blindspot');
  const b1 = OG.vsRandom(e.agent, 5000, rr, 1), b2 = OG.vsRandom(e.agent, 5000, rr, 2);
  check(b1.losses === 0, `5,000 games vs a random opponent, moving first: ${b1.losses} losses`);
  check(b2.losses === 0, `5,000 games vs a random opponent, moving second: ${b2.losses} losses`);

  out.push('');
  out.push(fails ? `<span class="no">${fails} check(s) failed for Era ${e.n}</span>`
                 : `<span class="ok">all checks passed for Era ${e.n}</span>`);
  if (!v.safe) out.push('(Era ' + e.n + ' is still beatable — that is expected until it has trained enough.)');

  $('#selftest-out').innerHTML = out.join('\n');
  console.log('[Zero to Unbeatable] self-test for Era ' + e.n + '\n' +
    out.join('\n').replace(/<[^>]+>/g, ''));
}

/* ------------------------------------------------------------------ *
 * Explainer copy
 * ------------------------------------------------------------------ */

$('#how-body').innerHTML = `
<h4>What it actually is</h4>
<p>The opponent you are playing is a list. On one side of the list is a board position; on the
other is a single number saying how good that position turned out to be for whoever just moved.
Nothing else. No rules of thumb, no strategy, no notion of a "row". You can read the numbers
yourself with <b>Show its brain</b>.</p>

<h4>Where the numbers come from</h4>
<p>It plays a game. At the end it gets one piece of feedback: <b>+1</b> if it won, <b>0</b> for a
draw, <b>−1</b> if it lost. That number is written against the last position, and then walked
back down the game — a position is worth whatever the best thing your opponent can do from it
is worth to them, with the sign flipped. Repeat a few thousand times and the numbers stop moving.</p>

<h4>Why it plays stupid moves early</h4>
<p>A player that always picks its current best move only ever finds out about the moves it already
likes. So a fraction of the time — shown in training as <b>&epsilon;</b> — it deliberately
plays a random square just to see what happens. &epsilon; starts at 1.00, meaning a newborn is pure
coin-flipping, and decays as it gains experience. This is the explore-versus-exploit trade: try new
things, or cash in on what you know. When it plays <i>you</i>, &epsilon; is zero — it always
plays its best.</p>

<h4>Why it also plays a random opponent</h4>
<p>An agent trained only against itself gets very good at the lines it likes to play and can stay
blind to a line no sensible player would choose — which is exactly the sort of thing a student
tries in a demo. So about 40% of its training games are against an opponent playing at random,
first and second, and one game in five starts from a position dealt at random rather than an empty
board, so odd corners of the board get practised too.</p>

<h4>What happens when the game gets bigger</h4>
<p>Switch to <b>Nine at once</b>: nine boards side by side, a turn is one mark on any unfinished
board, finished boards lock, and the first to win five boards takes the match. The rules are barely
harder. Everything else changes. A table over whole nine-board positions could never learn
anything, because it would essentially never meet the same position twice: on one board a position
comes round about ten times in a training burst, here about once. The card after a nine-board burst
measures both, live.</p>
<p>It works at all only because it looks at <b>one board at a time</b> and adds up what it finds —
and a person chose that shortcut. Finding such shortcuts by itself is exactly what a neural network
is for. Two other things break in ways worth watching: about half the board pictures you meet cannot
occur in ordinary tic-tac-toe at all (you can play twice in the same board while your opponent is
busy elsewhere), so most of what Act I learned does not transfer; and there is no proof at the end,
because no one can check every game.</p>

<h4>Be honest: this is a lookup table, not a brain</h4>
<p>This agent is a <b>tabular</b> learner. Its knowledge is one number per position and it can hold
every position tic-tac-toe has. That is why it can become perfect and why you can read its whole
mind on the screen. Real systems — a chess engine, a language model — face a space far too
large to list, so they replace the table with a neural network that <i>approximates</i> the same
numbers and generalises to positions it has never seen. The learning idea in this demo is the real
one. The storage is a toy.</p>

<h4>This was a box of matchboxes in 1961</h4>
<p>Donald Michie built <b>MENACE</b> — the Matchbox Educable Noughts And Crosses Engine —
from 304 matchboxes, one per board position, each holding coloured beads, one colour per square. To
move, you shook the box for the current position and drew a bead. If MENACE won the game, you added
beads of the colours it had played; if it lost, you took them away. That is a physical
implementation of exactly what is running on this page: a table of positions, a number per move,
adjusted by whether the game was won or lost. It took Michie a couple of hundred games to make it
unbeatable, by hand, with no computer at all.</p>

<h4>Where the presenter notes are</h4>
<p>Settings &rarr; <b>Presenter notes</b> opens the whole session plan — the timed script, the
questions to ask, the misconceptions worth drawing out, and the second act — with a print button.
It is built into this file rather than linked to another one, so it still works with no network and
nothing else downloaded.</p>

<h4>About the training animation</h4>
<p>The arithmetic for ${fmt(OG.HP.burst)} games finishes in a few hundredths of a second. The
montage is deliberately stretched to about two and a half seconds so there is something to watch.
The counter, the &epsilon; reading and the win rate are all real numbers from the run in progress
— only the pacing is for your benefit.</p>
`;

$('#about-text').innerHTML =
  `Zero to Unbeatable was built by Bryant Harrison, Murray State University. ` +
  `It runs entirely on this device: no network request is made, no account exists, ` +
  `nothing is stored, and no AI service is involved. Reloading the page returns it to Era 0. ` +
  `Learning rate ${OG.HP.alphaFloor}, discount ${OG.HP.gamma}, &epsilon; ${OG.HP.epsStart.toFixed(2)}→` +
  `${OG.HP.epsEnd.toFixed(2)} over ${fmt(OG.HP.epsTau)} games, ` +
  `${Math.round(OG.HP.mixSelfPlay * 100)}% self-play, ` +
  `${Math.round(OG.HP.exploringStarts * 100)}% dealt starts.`;

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */

$$('#mode-seg button').forEach(btn => btn.addEventListener('click', () => {
  if (S.training || S.mode === btn.dataset.mode) return;
  S.mode = btn.dataset.mode;
  $$('#mode-seg button').forEach(x => { x.classList.toggle('on', x === btn); x.setAttribute('aria-pressed', String(x === btn)); });
  const nine = isNine();
  $('#board-wrap').hidden = nine;
  $('#nine-wrap').hidden = !nine;
  if (nine) maybeSeed();
  renderEraSelect(); renderTrain(); renderBanner(); renderScore();
  newGame();
}));

$('#btn-train').addEventListener('click', train);
$('#btn-newgame').addEventListener('click', newGame);
function renderPlay() { if (isNine()) renderNine(); else renderBoard(); }

$('#btn-brain').addEventListener('click', () => {
  S.brain = !S.brain;
  $('#btn-brain').setAttribute('aria-pressed', String(S.brain));
  $('#btn-brain').textContent = S.brain ? 'Hide its brain' : 'Show its brain';
  renderPlay();
});
$('#era-select').addEventListener('change', e => {
  S.era = +e.target.value;
  renderScore(); newGame();
});
$('#btn-learned').addEventListener('click', e => {
  if (S.lastLearned === null) return;
  const era = S.eras[S.lastLearned], prev = S.eras[S.lastLearned - 1];
  if (era.kind === 'nine') buildLearnedNine(era, prev); else buildLearned(era, prev);
  openSheet('learned', e.currentTarget);
});
$('#btn-settings').addEventListener('click', e => openSheet('settings', e.currentTarget));
/* The instructions have one home and two doors: the ? in the brand bar,
   which is on screen at every size, and the entry in Settings. Both land
   on the same sheet, so there is nothing to keep in step. */
const openHowto = () => openSheet('howto', $('#btn-howto'));
$('#btn-howto').addEventListener('click', openHowto);
$('#btn-howto-2').addEventListener('click', () => { closeSheet('settings'); openHowto(); });
$('#btn-notes').addEventListener('click', e => { closeSheet('settings'); openSheet('notes', e.currentTarget); });
$('#btn-print-notes').addEventListener('click', () => window.print());
$('#btn-selftest').addEventListener('click', () => {
  $('#selftest-out').textContent = 'working…';
  setTimeout(selfTest, 30);
});
$('#chk-presenter').addEventListener('change', e =>
  document.body.classList.toggle('presenter', e.target.checked));
$('#chk-first').addEventListener('change', e => { S.alwaysFirst = e.target.checked; });
$('#in-seed').addEventListener('change', e => { S.seed = e.target.value.trim(); });
$('#btn-reset').addEventListener('click', () => {
  S.seed = $('#in-seed').value.trim();
  resetAll();
  closeSheet('settings');
});

const howHead = $('#how-head');
howHead.addEventListener('click', () => {
  const open = howHead.getAttribute('aria-expanded') === 'true';
  howHead.setAttribute('aria-expanded', String(!open));
  $('#how-body').hidden = open;
});

/* ------------------------------------------------------------------ */

resetAll();
renderScore();
/* Shown on every load, not once per browser: this thing is handed to a
   new person constantly, and nothing about the app is remembered between
   loads anyway. Escape, a tap on the backdrop or either button closes
   it, and the ? in the brand bar brings it back. */
openHowto();
console.log('[Zero to Unbeatable] ready. Era 0 knows nothing: every value in its table is zero, ' +
            'so every legal move ties and it picks uniformly at random.');

})();
