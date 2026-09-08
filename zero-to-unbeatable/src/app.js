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
  /* Step 1 'rules', step 2 'one' board, step 3 'nine' at once. The app
     opens on the rules so the arc reads left to right: a thing a person
     wrote, then a thing that wrote itself, then the world getting too
     big for either to be checked. */
  mode: 'rules',
  depth: RULES.DEFAULT_DEPTH,   // how many of the eight rules are switched on
  ruleRec: {},         // depth -> your record against that ladder
  ruleCounts: {},      // depth -> how many moves each rule decided
  lastRule: null,      // the decision behind the move it just made
  live: null,          // the one-board agent that keeps training
  live9: null,         // the nine-board brain: a TABLE of 39,366 numbers
  net9: null,          // the same brain with a NETWORK behind it instead
  /* Step 3 ships two memories and trains both on every burst, so the
     toggle is a real comparison and not a re-run. 'table' or 'net'. */
  mem: 'table',
  netStats: null,      // the held-out experiment, run once and cached
  eras: [],            // frozen snapshots, index === era number
  era: 0,              // which one you are playing
  game: null,          // one-board game in progress
  match: null,         // nine-board match in progress
  focus: 0,            // which of the nine boards you are pointing at
  burst: OG.HP.burst,
  burst9: NINE.HP9.burst,
  burstNet: NET.HPN.burst,
  brain: false,
  seed: '',
  // These streams deliberately never share state.  A reader (the report) or
  // a player must not be able to alter the next training example.
  rng: Math.random,              // training only, the table
  rngNet: Math.random,           // training only, the network — a separate
                                 // stream so switching memories cannot make
                                 // one alter the other's next example
  liveRng: { rules: Math.random, one: Math.random, nine: Math.random }, // independent playable-game streams
  measureSalt: '',               // immutable for one reset/session
  humanFirstNext: true,
  alwaysFirst: false,
  training: false,
  lastLearned: null
};
const isNine  = () => S.mode === 'nine';
const isNet   = () => S.mem === 'net';
/* Which of an era's two memories is on screen. Both implement at(),
   hits() and nudge(), so everything downstream — the heat map, the move
   choice, the blind measure — is one piece of code either way. */
const mem9 = (era) => (isNet() ? era.net : era.brain);
const memLabel = () => (isNet() ? 'network' : 'table');
const isRules = () => S.mode === 'rules';

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
    n, agent, brain: NINE.cloneBrain(S.live9), net: NET.cloneBrain(S.net9),
    kind: kind || 'one',
    games: agent.games, seen: agent.seen,
    matches: S.live9.matches, seen9: S.live9.seen, seeded9: S.live9.seeded,
    netMatches: S.net9.matches, netSeen: S.net9.seen,
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
  S.rngNet = OG.makeRng(S.seed ? 'net-train:' + S.seed : null);
  /* Keep one-board and nine-board play in distinct streams.  Switching
     modes must not make a prior one-board move alter a rehearsed nine-board
     reply (or vice versa).  A blank seed deliberately starts fresh streams. */
  const liveSeed = mode => S.seed
    ? 'live-play:' + S.seed + ':' + mode
    : 'live-play:' + Math.random().toString(36).slice(2) + ':' + mode;
  S.liveRng = {
    rules: OG.makeRng(liveSeed('rules')),
    one:   OG.makeRng(liveSeed('one')),
    nine:  OG.makeRng(liveSeed('nine'))
  };
  S.measureSalt = S.seed ? 'measure:' + S.seed : 'measure:' + Math.random().toString(36).slice(2);
  S.live = OG.newAgent();
  /* NOTE: the two live memories hold nothing back. The held-out set
     belongs to the side experiment in NET.experiment and to nothing
     else — a table with one picture in eight blanked loses 389 matches
     in 400, so making the demo's own opponent run that way would break
     step 3 to make a point about step 3. The experiment runs its own
     pair of memories, and the card says so. */
  S.live9 = NINE.newBrain();
  S.net9 = NET.newBrain({ seed: 'net:' + (S.seed || 'unseeded') });
  S.netStats = null;
  S.eras = [makeEra(0, OG.cloneAgent(S.live), null, null, 'one')];
  S.era = 0;
  S.humanFirstNext = true;
  S.lastLearned = null;
  S.lastRule = null;
  S.ruleRec = {};
  S.ruleCounts = {};
  RULES.DEPTHS.forEach(d => resetRuleTally(d.n));
  $('#btn-learned').hidden = true;
  /* applyMode paints every panel the current step needs and starts the
     game, so a reset and a step change go through the same door. */
  applyMode();
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
  S.net9 = NET.newBrain({ seed: 'net:' + (S.seed || 'unseeded') });
  /* One handover, two absorptions. NINE.seedFromAgent decides WHICH of
     Act I's entries convert and what they convert to; the table assigns
     them and the network is fitted towards them, because that is the
     only way to put a number into a network. */
  const n = NINE.seedFromAgent(S.live9, S.live);
  NINE.seedFromAgent(S.net9, S.live);
  S.netStats = null;
  S.eras.forEach(e => {
    if (e.brain.matches === 0) {
      e.brain = NINE.cloneBrain(S.live9);
      e.net = NET.cloneBrain(S.net9);
      e.seen9 = S.live9.seen; e.seeded9 = S.live9.seeded;
      e.netSeen = S.net9.seen;
    }
  });
  return n;
}

/* Step 1 keeps its own record and its own tally per ladder depth: a
   two-rule bot and an eight-rule bot are different opponents, and
   pooling their scores would hide exactly the thing the step is for. */
function resetRuleTally(depth) {
  S.ruleRec[depth] = { w: 0, l: 0, d: 0 };
  S.ruleCounts[depth] = new Array(9).fill(0);   // index 0 is "off the ladder"
}

function currentRec() {
  if (isRules()) return S.ruleRec[S.depth] || (resetRuleTally(S.depth), S.ruleRec[S.depth]);
  return isNine() ? currentEra().rec9 : currentEra().rec;
}

/* What to call the thing you are playing, wherever the copy needs it. */
function oppLabel() { return isRules() ? 'The rules' : 'Era ' + S.era; }

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
  S.lastRule = null;
  renderBoard();
  renderStatus();
  renderRuleFired();
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
    const rec = currentRec();
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
    applyNine(NINE.greedyMove(mem9(currentEra()), m, S.liveRng.nine));
    m.thinking = false;
    renderNine(); renderStatus();
  }, S.brain ? Math.max(delay, 1300) : delay);
}

function onCell(cell) {
  const g = S.game;
  if (!g || g.over || g.thinking || S.training) return;
  if (OG.TOMOVE[g.code] !== g.humanMark) return;
  if (OG.cellsOf(g.code)[cell] !== 0) return;
  /* The rule it last used stays on screen while you think about your
     reply -- that sentence is the thing a presenter points at, and
     blanking it the instant you tap is how you lose the room. */
  applyMove(cell);
  renderBoard(); renderStatus(); renderRuleFired();
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
    let cell;
    if (isRules()) {
      /* The ladder returns the square AND the rule that chose it, which
         is the only reason step 1 can narrate itself. */
      const d = RULES.move(g.code, S.depth, S.liveRng.rules);
      S.lastRule = d;
      S.ruleCounts[S.depth][d.ruleId]++;
      cell = d.move;
    } else {
      cell = OG.greedyMove(currentEra().agent, g.code, S.liveRng.one);
    }
    applyMove(cell);
    g.thinking = false;
    renderBoard(); renderStatus(); renderRuleFired();
    if (isRules()) renderRulesPanel();
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
  const showHeat = S.brain && !isRules() && !g.over;
  const vals = showHeat ? OG.moveValues(agent, g.code) : [];
  const picks = showHeat ? OG.argmaxMoves(agent, g.code) : [];
  const byCell = {}; vals.forEach(v => byCell[v.cell] = v);
  /* The squares that set the rule off — the two you already had in a row,
     the corner it answered. Marking them on the board is what turns
     "it played there" into "it played there because of this". They come
     off the board once you have replied, since they described the board
     as it was when the rule looked at it; the sentence underneath stays. */
  const freshRule = isRules() && S.lastRule && !g.over &&
                    g.lastCell >= 0 && cells[g.lastCell] === g.aiMark;
  const trig = freshRule ? S.lastRule.cells : [];

  $$('.cell', boardEl).forEach((el, i) => {
    const m = cells[i];
    el.className = 'cell' + (m ? ' mk' + m : ' open') +
      (g.lastCell === i && m ? ' last' : '') +
      (g.winLine && g.winLine.includes(i) ? ' win' : '') +
      (trig.includes(i) ? ' trig' : '') +
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
  const brain = mem9(currentEra());
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
      const after = code + mark * OG.POW3[c], opp = mark === 1 ? 2 : 1;
      const seen = brain.hits(after, opp);
      el.style.background = heat(val); el.style.color = heatInk(val);
      /* "never seen" is the interesting one, and it means different
         things either side of the toggle: for the table it is a
         guaranteed 0.00, for the network it is a computed guess. */
      const note = seen ? 'seen ' + fmt(seen) + '×' : 'never seen';
      el.innerHTML = `<span class="v">${sgn(val)}</span>` +
        `<span class="n">${note}</span>`;
      el.setAttribute('aria-label', CELLNAME[c] + ': ' + val.toFixed(2) + ', ' + note);
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
    const rules = isRules();
    const t = g.result === 'win'
        ? ['You win.', rules ? `${S.depth} rules were not enough.` : 'Era ' + S.era + ' let you through.']
      : g.result === 'loss'
        ? ['It beat you.', rules ? 'The ladder had a rule for every square.'
                                 : 'Era ' + S.era + ' found a line you missed.']
        : ['Drawn.', 'Neither of you got through.'];
    el.classList.add(g.result === 'win' ? 'you-win' : g.result === 'loss' ? 'you-lose' : 'drawn');
    el.innerHTML = `<div><span class="big">${t[0]}</span><br><span class="sub">${t[1]}</span></div>`;
    return;
  }
  if (g.thinking) { el.innerHTML = `<div><span class="sub">${isRules() ? 'Checking the rules in order' : 'Era ' + S.era + ' is choosing'}…</span></div>`; return; }
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

/* ------------------------------------------------------------------ *
 * Step 1 — the logic, visible
 * ------------------------------------------------------------------ */

/* The one-line commentary under the board. It names the rule by number
   so the eye can find it in the list beside, and says what on the board
   set it off. */
function renderRuleFired() {
  const el = $('#rule-fired');
  el.hidden = !isRules();
  if (!isRules()) return;
  const d = S.lastRule;
  if (!d) {
    el.className = 'waiting';
    el.innerHTML = `<div class="rf-line">Every move it makes is decided by the list beside the board, ` +
      `checked from the top. Play a square and it will tell you which rule answered you.</div>`;
    return;
  }
  el.className = d.ruleId === 0 ? 'nofire' : '';
  const head = d.ruleId === 0
    ? `<b>No rule</b> <span class="rf-off">rules ${S.depth + 1}–8 are switched off</span>`
    : `<b>Rule ${d.ruleId} · ${d.rule.name}</b>`;
  el.innerHTML = `<div class="rf-line"><span class="rf-head">${head}</span> ${d.why}</div>`;
}

/* The ladder itself. Built from RULES.LADDER rather than retyped, so the
   list on screen cannot drift from the code that runs. */
function renderRulesPanel() {
  const panel = $('#rules-panel');
  panel.hidden = !isRules();
  if (!isRules()) return;
  const counts = S.ruleCounts[S.depth] || [];
  const total = counts.reduce((a, b) => a + b, 0);
  const fired = S.lastRule ? S.lastRule.ruleId : -1;

  $('#rp-sub').textContent = S.depth === 8
    ? 'all eight in play'
    : `${S.depth} of 8 in play`;

  $('#rule-list').innerHTML = RULES.LADDER.map(r => {
    const off = r.id > S.depth;
    const n = counts[r.id] || 0;
    return `<li class="rule${off ? ' off' : ''}${r.id === fired ? ' fired' : ''}">` +
      `<span class="rn">${r.id}</span>` +
      `<span class="rt"><b>${r.name}</b><span class="rg">${r.gist}</span></span>` +
      `<span class="rc">${off ? 'off' : (n ? '×' + n : '')}</span></li>`;
  }).join('') +
    (S.depth < 8
      ? `<li class="rule fallback${fired === 0 ? ' fired' : ''}"><span class="rn">—</span>` +
        `<span class="rt"><b>Nothing left to check</b>` +
        `<span class="rg">the author stopped writing rules — it plays a free square</span></span>` +
        `<span class="rc">${counts[0] ? '×' + counts[0] : ''}</span></li>`
      : '');

  const r = RULES.report(S.depth);
  $('#rp-foot').innerHTML = total
    ? `${fmt(total)} move${total === 1 ? '' : 's'} decided so far. ` +
      (S.depth === 8
        ? `None of them came from experience: this opponent has played zero games.`
        : `Rules ${S.depth + 1}–8 are switched off, and the panel below shows the game that costs it.`)
    : (S.depth === 8
        ? `Eight rules, written out in advance by a person. It has played zero games and it cannot learn one. ` +
          `The panel below searches all ${fmt(r.lines)} games playable against it.`
        : `A shortened ladder. Rules ${S.depth + 1}–8 are switched off, which opens up ` +
          `${fmt(r.lines)} playable games instead of ${fmt(RULES.report(8).lines)}.`);
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
  const el = $('#brain-readout'), e = currentEra(), m = S.match, brain = mem9(e);
  const blind = m && !m.over ? NINE.blindFraction(brain, m) : 0;
  const total = OG.NCODE * 2;
  const where = isNet()
    ? `Era ${e.n}'s network: <b>${fmt(e.net.params)}</b> weights. There is no entry per ` +
      `picture — every number you see was computed just now, including for pictures it has ` +
      `never met. It has trained on <b>${fmt(e.netMatches)}</b> matches.`
    : `Era ${e.n}'s nine-board table: <b>${fmt(brain.seen)}</b> of <b>${fmt(total)}</b> board ` +
      `pictures have a number in them` +
      (brain.seeded ? `, <b>${fmt(brain.seeded)}</b> of them handed straight over from the ` +
        `one-board table` : '') + '.';
  el.innerHTML =
    `<div>Scores for board ${S.focus + 1} only — how much each square would improve ` +
    `<b>that</b> board. The other eight do not change, so this is the whole comparison.</div>` +
    `<div style="margin-top:.5em">${where}</div>` +
    (m && !m.over
      ? `<div style="margin-top:.5em">Right now <b>${Math.round(blind * 100)}%</b> of the squares it ` +
        `is weighing up sit on a board picture that has never been met. ` +
        (isNet() ? `The network answers for them anyway; whether it is right is what the card after ` +
                   `a burst measures.`
                 : `The table reads 0.00 for every one of them, which looks exactly like "even".`) +
        `</div>` : '') +
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

/* Step 1's stand-in for the era dropdown: how much of the ladder is
   switched on. Same segmented control as the burst sizes, same
   mechanism, no second widget invented. */
function renderDepthSeg() {
  const seg = $('#depth-seg');
  seg.innerHTML = RULES.DEPTHS.map(d =>
    `<button data-d="${d.n}" class="${d.n === S.depth ? 'on' : ''}" ` +
    `aria-pressed="${d.n === S.depth}" title="${d.title}">${d.label}</button>`).join('');
  $$('#depth-seg button').forEach(b => b.addEventListener('click', () => {
    const n = +b.dataset.d;
    if (n === S.depth) return;
    S.depth = n;
    if (!S.ruleRec[n]) resetRuleTally(n);
    renderDepthSeg(); renderScore(); renderRulesPanel(); renderBanner();
    newGame();
  }));
}

/* Step 3's own segmented control: which memory you are playing. Same
   widget as the depth dial and the burst sizes — no new mechanism — and
   it swaps nothing but the store, because both memories answer at(),
   hits() and nudge() and every other line of step 3 is shared. */
function renderMemSeg() {
  const seg = $('#mem-seg');
  const opts = [
    { k: 'table', label: 'Table',   title: '39,366 numbers, one per board picture and turn' },
    { k: 'net',   label: 'Network', title: '1,777 weights that compute a value for any picture' }
  ];
  seg.innerHTML = opts.map(o =>
    `<button data-m="${o.k}" class="${o.k === S.mem ? 'on' : ''}" ` +
    `aria-pressed="${o.k === S.mem}" title="${o.title}">${o.label}</button>`).join('');
  $$('#mem-seg button').forEach(b => b.addEventListener('click', () => {
    if (S.mem === b.dataset.m || S.training) return;
    S.mem = b.dataset.m;
    renderMemSeg(); renderTrain(); renderBanner(); renderScore();
    newGame();
  }));
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

/* "You vs Era 0: 3-0-0. You vs Era 4: 0-1-4." — the whole arc in one line.
   In step 1 the same strip carries your record against each length of
   ladder, which is the beat the step is built around: 2 rules 3-0-0,
   8 rules 0-2-1. */
function renderEraStrip() {
  const el = $('#era-strip');
  if (isRules()) {
    const played = RULES.DEPTHS.filter(d => {
      const r = S.ruleRec[d.n]; return r && r.w + r.l + r.d > 0;
    });
    el.hidden = played.length === 0;
    if (!played.length) return;
    el.innerHTML = '<span class="k">your record</span>' + played.map(d => {
      const r = S.ruleRec[d.n];
      return `<span class="chip${d.n === S.depth ? ' on' : ''}">${d.n} rules ` +
        `<b class="w">${r.w}</b>–<b class="d">${r.d}</b>–<b class="l">${r.l}</b></span>`;
    }).join('');
    return;
  }
  const key = isNine() ? 'rec9' : 'rec';
  const played = S.eras.filter(e => e[key].w + e[key].l + e[key].d > 0);
  el.hidden = played.length === 0;
  if (!played.length) return;
  el.innerHTML = '<span class="k">your record</span>' + played.map(e =>
    `<span class="chip${e.n === S.era ? ' on' : ''}">E${e.n} ` +
    `<b class="w">${e[key].w}</b>–<b class="d">${e[key].d}</b>–<b class="l">${e[key].l}</b></span>`).join('');
}

function renderTrain() {
  /* Step 1 has nothing to train: the skill is already in the file. */
  $('#train-panel').hidden = isRules();
  if (isRules()) return;
  const e = S.eras[S.eras.length - 1];
  const nine = isNine();
  $('.t-main', $('#btn-train')).textContent = nine ? 'Train on nine boards' : 'Train the AI';
  $('#train-sub').textContent = nine
    ? fmt(isNet() ? S.burstNet : S.burst9) + ' matches' : fmt(S.burst) + ' games';
  const sizes = nine ? (isNet() ? NET.HPN.bursts : NINE.HP9.bursts) : OG.HP.bursts;
  const cur = nine ? (isNet() ? S.burstNet : S.burst9) : S.burst;
  $('#burst-seg').innerHTML = sizes.map(b =>
    `<button data-b="${b}" class="${b === cur ? 'on' : ''}" aria-pressed="${b === cur}">${fmt(b)}</button>`).join('');
  $$('#burst-seg button').forEach(b => b.addEventListener('click', () => {
    if (isNine()) { if (isNet()) S.burstNet = +b.dataset.b; else S.burst9 = +b.dataset.b; }
    else S.burst = +b.dataset.b;
    renderTrain();
  }));
  $('#train-stats').innerHTML = nine
    ? (isNet()
      ? `<div class="st"><span class="n">${fmt(e.netMatches)}</span><span class="k">matches trained</span></div>` +
        `<div class="st"><span class="n">${fmt(e.net.params)}</span><span class="k">weights</span></div>` +
        `<div class="st"><span class="n">${fmt(OG.NCODE * 2)}</span><span class="k">it answers for</span></div>`
      : `<div class="st"><span class="n">${fmt(e.matches)}</span><span class="k">matches trained</span></div>` +
        `<div class="st"><span class="n">${fmt(e.seen9)}</span><span class="k">pictures seen</span></div>` +
        `<div class="st"><span class="n">${fmt(OG.NCODE * 2)}</span><span class="k">table slots</span></div>`)
    : `<div class="st"><span class="n">${S.eras.length - 1}</span><span class="k">eras</span></div>` +
      `<div class="st"><span class="n">${fmt(e.games)}</span><span class="k">games trained</span></div>` +
      `<div class="st"><span class="n">${fmt(e.seen)}</span><span class="k">positions seen</span></div>`;
}

/* A game the shortened ladder loses, drawn as boards rather than
   described. `losingGame` picks the representative one, so this is how
   it typically goes wrong rather than a freak sequence. */
function losingGameHTML(g) {
  let code = 0;
  const frames = [];
  g.plies.forEach(p => {
    code = OG.child(code, p.cell, p.mark);
    frames.push(
      `<div class="lg-step${p.forks ? ' fork' : ''}">${miniHTML(code)}` +
      `<span class="lg-who">${p.bot ? 'it' : 'you'}</span></div>`);
  });
  const forkAt = g.plies.findIndex(p => p.forks);
  return `<div class="lg">${frames.join('')}</div>` +
    (forkAt >= 0
      ? `<p class="lg-note">The marked move leaves <b>two</b> ways to win at once. Stopping that is ` +
        `<b>rule 4</b>, and rule 4 is switched off — so it blocks one and loses to the other.</p>`
      : '');
}

function renderBanner() {
  const el = $('#banner');
  const top = S.eras[S.eras.length - 1];

  /* ---- Step 1: the same search, run on the hand-written ladder ---- */
  if (isRules()) {
    const r = RULES.report(S.depth);
    el.hidden = false;
    el.classList.toggle('quiet', !r.safe);
    if (r.safe) {
      el.innerHTML =
        `<h3>You cannot beat this one either — and it has never played a game.</h3>` +
        `<p>Every game that can still be played against these eight rules was searched, with the ` +
        `rules moving first and moving second, and in none of them do they lose. That is the same ` +
        `exhaustive search that ends step 2, run on a completely different kind of opponent.</p>` +
        `<p>Where the skill came from is the whole difference. Every bit of this one came out of a ` +
        `person's head and none of it out of experience. It played zero games, it cannot improve, ` +
        `and on a 4×4 board it is worthless. For a game this small that is the <b>better</b> piece ` +
        `of engineering — shorter, faster, and checkable by reading it. Step 2 does the same job ` +
        `the other way round, and step 3 is where writing the rules stops being possible.</p>` +
        `<div class="proof">Proof: ${fmt(r.lines)} complete game lines searched · ` +
        `${fmt(r.positions)} positions examined · 0 losses · both roles · ` +
        `re-run any time from Settings &rarr; Run the full self-test.</div>`;
      return;
    }
    const game = r.gameSecond || r.gameFirst;
    const pct = v => (v * 100).toFixed(0) + '%';
    el.innerHTML =
      `<h3>${S.depth} rules is not enough, and here is the game that shows it.</h3>` +
      `<p>The same search that proves the full ladder safe finds losing lines in this one. Playing ` +
      `your best you beat it <b>${pct(r.beatsSecond)}</b> of the time when you move first and ` +
      `<b>${pct(r.beatsFirst)}</b> when it does — worked out exactly over every line, not sampled.</p>` +
      (game ? losingGameHTML(game) : '') +
      `<p>It still flips a coin whenever no rule applies, so this exact game comes up about ` +
      `${game ? '1 in ' + Math.round(1 / game.prob) : 'some'} times; something like it comes up ` +
      `most games. Switch to <b>All 8</b> and none of it works any more.</p>` +
      /* Deliberately NOT "n positions examined" here. The safety search
         stops at the first losing line it finds, so its position count
         is a few dozen and quoting it would read as a thorough search
         that came up clean, which is the opposite of what happened. */
      `<div class="proof">${fmt(r.lines)} complete game lines are playable against this ladder · ` +
      `the search finds losing ones in both roles and stops there · ` +
      `the percentages come from a separate pass over every line.</div>`;
    return;
  }

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
      (isNet()
        ? `<p>The memory on the toggle is the <b>network</b>: ${fmt(S.net9.params)} weights in ` +
          `place of ${fmt(OG.NCODE * 2)} table slots, learning by exactly the same rule. It has ` +
          `an answer for every board picture there is, and no proof is available for it either — ` +
          `less of one, if anything, because you cannot read a network the way you can read a ` +
          `table.</p>` +
          `<div class="proof">Network: ${fmt(S.net9.params)} weights · ` +
          `matches trained ${fmt(S.net9.matches)} · answers for all ${fmt(OG.NCODE * 2)} ` +
          `board pictures, right or wrong</div>`
        : `<div class="proof">Handed over from the one-board table: ` +
          `${fmt(S.live9.seeded)} of the ${fmt(OG.NCODE * 2)} entries this game needs · ` +
          `filled so far ${fmt(S.live9.seen)} · matches trained ${fmt(S.live9.matches)}</div>`);
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

/* Both memories train on every burst, so the toggle is a comparison and
   not a re-run. Each plays its own matches -- it must, because each
   one's choices are its own -- from streams seeded the same way, and
   each gets its own budget: a forward pass costs about a thousand times
   an array index, so equal wall clock does not buy equal matches. The
   card afterwards prints both budgets and both clocks rather than
   quietly averaging them. */
async function trainNine() {
  S.training = true;
  const size = S.burst9;
  const sizeNet = S.burstNet;
  const ov = $('#montage'); ov.hidden = false;
  $('#m-count').classList.add('blur');
  $('#m-count-sub').textContent = 'matches played against itself and against chance';
  $('#m-boards').classList.add('nine');
  $('#m-boards').innerHTML = mini9HTML(NINE.newMatch()).repeat(3);
  $('#m-wr-label').textContent = 'holds or beats the hand-written player';

  const STEPS = 30, per = Math.ceil(size / STEPS);
  const perNet = Math.ceil(sizeNet / STEPS);
  const t0 = performance.now();
  let done = 0, doneNet = 0, selfPlay = 0, vsRandom = 0, hold = null, pool = [];
  let msTable = 0, msNet = 0;

  for (let i = 0; i < STEPS; i++) {
    const n = Math.min(per, size - done);
    if (n > 0) {
      const c0 = performance.now();
      const r = NINE.trainMatches(S.live9, n, S.rng, { sampleEvery: Math.max(1, Math.floor(n / 2)) });
      msTable += performance.now() - c0;
      done += n; selfPlay += r.selfPlay; vsRandom += r.vsRandom;
      pool = pool.concat(r.samples).slice(-12);
    }
    const nn = Math.min(perNet, sizeNet - doneNet);
    if (nn > 0) {
      const c1 = performance.now();
      NINE.trainMatches(S.net9, nn, S.rngNet);
      msNet += performance.now() - c1;
      doneNet += nn;
    }
    if (i % 7 === 4) {
      const sc = NINE.vsHeuristic(mem9({ brain: S.live9, net: S.net9 }), 60, S.rng);
      hold = (sc.wins + sc.draws) / sc.matches;
    }
    $('#m-count').textContent = fmt(isNet() ? doneNet : done);
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
    { selfPlay, vsRandom, matches: size, matchesNet: sizeNet, msTable, msNet });
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
/* The held-out experiment, rendered. Run once and cached on the app,
   because it is a self-contained side experiment rather than a property
   of an era: two fresh memories, the same handover, the same budget, and
   one board picture in eight that NEITHER of them is allowed to write.
   Then both are asked about exactly those pictures. */
function generalisationCard(era) {
  const r = S.netStats || (S.netStats = NET.experiment(NINE, era.agent, {
    seed: S.seed || 'unseeded', matches: NET.HPN.burst
  }));
  const pct = v => (100 * v).toFixed(0) + '%';
  const ex = r.all.examples.slice(0, 3).map(e =>
    `<div class="ge">${miniHTML(e.code)}` +
    `<span class="gv net" style="background:${heat(e.net)};color:${heatInk(e.net)}">${sgn(e.net)}</span>` +
    `<span class="gv tab" style="background:${heat(e.table)};color:${heatInk(e.table)}">${sgn(e.table)}</span>` +
    `<span class="gk">${e.turn === 1 ? '✕' : '◯'} to move</span></div>`).join('');
  return `<div class="lc"><h3>The one thing a table cannot do</h3>` +
    `<div class="ask">A side experiment, run fresh: two memories, the same rule, the same ` +
    `${fmt(r.matches)} matches — and <b>one board picture in eight</b> picked from the seed ` +
    `<i>before</i> training and forbidden to both. They still meet those pictures and still ` +
    `count them; neither is allowed to store a value for one. Then both are asked what those ` +
    `pictures are worth, and marked against the answer worked out separately.</div>` +
    `<table class="cmp"><tr><th></th><th>table</th><th>network</th></tr>` +
    `<tr><td>values stored</td><td>${fmt(r.slots)} slots</td><td>${fmt(r.params)} weights</td></tr>` +
    `<tr><td>right on ${fmt(r.all.n)} held-out pictures</td>` +
    `<td>${pct(r.all.tableRate)}</td><td>${pct(r.all.netRate)}</td></tr>` +
    `<tr class="hi"><td>of the ${fmt(r.wins.n)} with a win waiting</td>` +
    `<td>${pct(r.wins.tableRate)}</td><td>${pct(r.wins.netRate)}</td></tr></table>` +
    (ex ? `<div class="gex">${ex}</div>` +
      `<div class="gexk"><span class="gv net">network</span><span class="gv tab">table</span> ` +
      `— three of the held-out pictures, each one a free win for the player to move.</div>` : '') +
    `<div class="delta"><span class="up">The network has an answer for a picture it was never ` +
    `allowed to learn.</span> The table has ${pct(r.all.tableRate)} — which is exactly the share ` +
    `of those pictures that really are drawn, because it returns 0.00 for every single one and ` +
    `0.00 means "even". On the pictures where somebody can win right now it scores nothing at ` +
    `all. That is not a rigged comparison; it is what a lookup table does past the edge of what ` +
    `it has stored, and it is the whole reason a network is worth the trouble.</div></div>`;
}

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
    rnd: NINE.vsRandom(era.brain, 100, measureRng(era, 'random')),
    /* the same two questions, asked of the network that trained beside it */
    cpuNet: NINE.vsHeuristic(era.net, 200, measureRng(era, 'heuristic')),
    rndNet: NINE.vsRandom(era.net, 100, measureRng(era, 'random'))
  });
  const { rec9, rec1, cpu, rnd, cpuNet, rndNet } = metrics;
  const grew = before ? era.seen9 - before.seen9 : era.seen9;

  const head =
    `<div class="headline">Two memories trained side by side on the same rule. The <b>table</b> ` +
    `played ${fmt(era.matches)} matches in ${Math.round(era.nine.msTable)} ms; the <b>network</b> ` +
    `played ${fmt(era.netMatches)} in ${Math.round(era.nine.msNet)} ms — a forward pass costs ` +
    `about a thousand times an array lookup, and that is the bill for being able to answer at ` +
    `all about a picture you have never seen. Its nine-board table now holds ` +
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

    generalisationCard(era),

    `<div class="lc"><h3>Which one actually plays better</h3>` +
    `<div class="ask">The same benchmark, asked of both memories: the hand-written opponent, ` +
    `200 matches, alternating who starts. Neither has ever been shown those rules.</div>` +
    `<table class="cmp"><tr><th></th><th>table</th><th>network</th></tr>` +
    `<tr><td>matches trained</td><td>${fmt(era.matches)}</td><td>${fmt(era.netMatches)}</td></tr>` +
    `<tr><td>lost of 200</td><td>${cpu.losses}</td><td>${cpuNet.losses}</td></tr>` +
    `<tr><td>drawn</td><td>${cpu.draws}</td><td>${cpuNet.draws}</td></tr>` +
    `<tr class="hi"><td>vs a random player</td><td>${rnd.wins} of ${rnd.matches}</td>` +
    `<td>${rndNet.wins} of ${rndNet.matches}</td></tr></table>` +
    `<div class="delta">${
      cpuNet.losses > cpu.losses + 20
      ? `<span class="down">The table is the better player, and by a distance.</span> That is ` +
        `the honest result and it is worth sitting with, because it is not the one a demo would ` +
        `choose. The network is not an improved table, it is a different trade: it answers about ` +
        `pictures nobody showed it — the card above — and it pays for that by never being ` +
        `exactly right about the ones it did see. A move here is picked by <b>subtracting</b> ` +
        `two of its values, and a small error in each does not cancel in the difference. Train ` +
        `it further and this does not close: measured out to 12,000 matches, the network gets ` +
        `to roughly level and then wanders, winning both seats after one burst and losing one ` +
        `after the next, where the table stops losing and stays stopped.`
      : cpu.losses > cpuNet.losses + 20
      ? `The network is ahead <b>at this point</b>, and that is mostly the table still being ` +
        `young: it needs about three bursts before it stops losing, and it has had ` +
        `${S.eras.length - 1}. Train them both again. The table catches up and passes it, and ` +
        `the honest summary of the whole race is that the table ends up the better player.`
      : `The two are level on this benchmark just now. Watch which way it goes: the table, once ` +
        `it stops losing, stays stopped, while the network's score wanders from burst to burst — ` +
        `every update it makes moves every position at once, so nothing it has learned is ever ` +
        `quite safe from what it learns next.`}` +
    `</div></div>`,

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

  /* Step 1 gets the same treatment as step 2, because the claim being
     checked is the same claim. */
  if (isRules()) {
    const r = RULES.report(S.depth);
    check(r.asFirst.safe === (S.depth >= 7),
      `${S.depth} rules moving first: ` +
      (r.asFirst.safe ? `no losing line among ${fmt(r.asFirst.lines)} searched`
                      : `a losing line exists among ${fmt(r.asFirst.lines)} searched (expected below 7 rules)`));
    check(r.asSecond.safe === (S.depth >= 7),
      `${S.depth} rules moving second: ` +
      (r.asSecond.safe ? `no losing line among ${fmt(r.asSecond.lines)} searched`
                       : `a losing line exists among ${fmt(r.asSecond.lines)} searched (expected below 7 rules)`));
    const two = RULES.report(2), eight = RULES.report(8);
    check(!two.safe && eight.safe,
      'the two-rule ladder is beatable and the eight-rule ladder is not — both by exhaustive search');
    check(RULES.moves(0, 8).length > 0 && RULES.LADDER.length === 8,
      'the ladder on screen is the ladder that runs: 8 rules, all reachable');
    out.push('');
    out.push(`        best play beats ${S.depth} rules ` +
      `${(r.beatsSecond * 100).toFixed(1)}% of the time when you move first, ` +
      `${(r.beatsFirst * 100).toFixed(1)}% when it does (exact, over every line)`);
    out.push(fails ? `<span class="no">${fails} check(s) failed for the ${S.depth}-rule ladder</span>`
                   : `<span class="ok">all checks passed for the ${S.depth}-rule ladder</span>`);
    $('#selftest-out').innerHTML = out.join('\n');
    console.log('[Zero to Unbeatable] self-test for the ' + S.depth + '-rule ladder\n' +
      out.join('\n').replace(/<[^>]+>/g, ''));
    return;
  }

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
<h4>Three different things, all called AI</h4>
<p><b>Step 1 is rules.</b> Eight if/else tests, checked in order, written out by a person before it
ever ran. It has played zero games. Ask it why it moved and it can tell you exactly, because the
reason is a line someone typed. Most people would call that AI, and for decades that is what the
word meant.</p>
<p><b>Step 2 is learning.</b> No rules at all — a list of numbers, one per board position, all of
them starting at zero. Nothing in it knows what a row is. It plays twenty thousand games, is told
only won, lost or drew, and ends up playing the same unbeatable game as the rule ladder. Ask it why
it moved and the honest answer is "that square scored +0.87", which is not a reason in the way rule
2 is a reason.</p>
<p><b>Both are proven, the same way.</b> The app searches every game that can still be played
against each of them and reports that no losing line exists. Same search, same words, two opposite
kinds of opponent.</p>

<h4>Be honest: here, the rules win</h4>
<p>It would be easy to run this demo as "learning beat the hand-written rules", and it would be
wrong. For a board with 5,478 positions the rules are the better piece of engineering by almost
every measure that matters: they are a couple of hundred lines instead of a table of 19,683 numbers,
they answer instantly with no training run, they can be read and checked by a person, and they were
finished before the learner had played its first game. Nothing about step 2 is an improvement on
step 1 <i>at tic-tac-toe</i>.</p>
<p>What the rules cannot do is exist for a problem nobody can write down. Change the board to 4×4
and the eight rules are worthless — somebody has to sit down and work out the new ones. Chess has
more positions than there are atoms on Earth and language has no fixed number at all; no one has
ever written the ladder for either, and it is not for want of trying. Learning is what you reach for
when the rules cannot be written, not when they can. Step 3 is what the edge of that looks like.</p>
<p>There is one measurable crack in the ladder, and it is fair to say so. It is unbeatable in a
<i>game</i>, but it is not right in every <i>position</i>: hand it one of the 4,520 legal boards it
would never have played itself into and there are 12 where a rule picks a losing square, because
nobody writes rules for boards that cannot happen. The learner practises from positions dealt at
random, so it is right in all 4,520. That difference costs neither of them a game — you cannot beat
either from the start — but it is the shape of the thing: written knowledge covers what the author
thought of, and experience covers what was met.</p>

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

<h4>How a move with no outcome gets a score</h4>
<p>Most moves neither win nor lose, so there is nothing to grade them on. The trick is that such a
move is not graded on its own merit at all &mdash; it <b>borrows</b> its score from wherever it
leads. Three cases, and that is the whole rule:<br>
&bull; the move just won &rarr; <b>+1</b><br>
&bull; the board is now full &rarr; <b>0</b><br>
&bull; anything else &rarr; look at every reply your opponent could make, take the one <i>they</i>
would like best, and <b>flip the sign</b>. What is good for them is bad for you.</p>

<p>So at the beginning nothing means anything. Every number is 0.00, so every move scores
&ldquo;zero, because the best my opponent can reach from here is also zero&rdquo;. What breaks the
deadlock is a game actually <i>ending</i>: that position gets a real <b>+1</b>, and the next time a
move leads there, it finally has something real to borrow. Scores seep backwards out of the ends of
games, one link per update &mdash; which is why each game is walked <i>back to front</i> rather than
front to back.</p>

<p>Two details that matter. It takes the best reply your opponent <i>could</i> make rather than the
one they actually made, so its own deliberate random exploring does not poison what it settles on.
And this borrowing is exactly what fails in <b>nine at once</b>: asking &ldquo;what can my opponent
reach from here?&rdquo; is useless when every one of those positions still reads 0.00 because it has
never seen them.</p>

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
<p>Donald Michie and Roger Chambers built <b>MENACE</b> — the Matchbox Educable Noughts And
Crosses Engine — from 304 matchboxes, one per board position it can face once rotations and
mirrors are folded together, each holding coloured beads, one colour per square. To
move, you shook the box for the current position and drew a bead. If MENACE won the game, you added
three beads of each colour it had played; if it drew, you added one; if it lost, you took one
away. That is a physical
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
  `Step 1 is a hand-written ${RULES.LADDER.length}-rule ladder with nothing learned in it; ` +
  `steps 2 and 3 learn and have no rules in them. Step 2's settings: ` +
  `Learning rate ${OG.HP.alphaFloor}, discount ${OG.HP.gamma}, &epsilon; ${OG.HP.epsStart.toFixed(2)}→` +
  `${OG.HP.epsEnd.toFixed(2)} over ${fmt(OG.HP.epsTau)} games, ` +
  `${Math.round(OG.HP.mixSelfPlay * 100)}% self-play, ` +
  `${Math.round(OG.HP.exploringStarts * 100)}% dealt starts.`;

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */

/* One place decides what each step shows. Everything it hides is
   [hidden], so a step never pays for the panels of another step -- which
   is what keeps the TRAIN button above the fold in step 2 with a
   full-height rule ladder living in the same column. */
function applyMode() {
  const nine = isNine(), rules = isRules();
  $$('#mode-seg button').forEach(x => {
    const on = x.dataset.mode === S.mode;
    x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on));
  });
  document.body.classList.toggle('step-rules', rules);
  document.body.classList.toggle('step-nine', nine);
  $('#how-head span').textContent = rules ? 'Rules, learning, and which is better'
                                          : 'How is it learning?';
  $('#board-wrap').hidden = nine;
  $('#nine-wrap').hidden = !nine;
  $('#era-select').hidden = rules;
  $('#depth-seg').hidden = !rules;
  $('#mem-seg').hidden = !nine;
  if (nine) renderMemSeg();
  $('#btn-brain').hidden = rules;
  $('#btn-learned').hidden = rules || S.lastLearned === null;
  if (rules && S.brain) {          // the inspector reads a value table; there is not one here
    S.brain = false;
    $('#btn-brain').setAttribute('aria-pressed', 'false');
    $('#btn-brain').textContent = 'Show its brain';
    $('#brain-readout').hidden = true;
  }
  if (nine) maybeSeed();
  if (rules) renderDepthSeg();
  renderEraSelect(); renderTrain(); renderRulesPanel(); renderBanner(); renderScore();
  newGame();
}

$$('#mode-seg button').forEach(btn => btn.addEventListener('click', () => {
  if (S.training || S.mode === btn.dataset.mode) return;
  S.mode = btn.dataset.mode;
  applyMode();
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
