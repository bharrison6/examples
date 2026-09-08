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
  /* Step 1 'rules', step 2 'one' board, step 3 'ult' — ultimate
     tic-tac-toe. The app opens on the rules so the arc reads left to
     right: a thing a person wrote, then a thing that wrote itself, then
     a world where neither writing it nor checking it is on offer. */
  mode: 'rules',
  depth: RULES.DEFAULT_DEPTH,   // how many of the eight rules are switched on
  ruleRec: {},         // depth -> your record against that ladder
  ruleCounts: {},      // depth -> how many moves each rule decided
  lastRule: null,      // the decision behind the move it just made
  live: null,          // the one-board agent that keeps training
  liveU: null,         // step 3's brain: one number per board picture and turn
  eras: [],            // frozen snapshots, index === era number
  era: 0,              // which one you are playing
  game: null,          // one-board game in progress
  match: null,         // ultimate match in progress
  focus: 0,            // the board shown full size: the one you were sent
                       // to, or the one you picked when the send freed you
  burst: OG.HP.burst,
  burstU: ULT.HPU.burst,
  brain: false,
  seed: '',
  // These streams deliberately never share state.  A reader (the report) or
  // a player must not be able to alter the next training example.
  rng: Math.random,              // training only
  liveRng: { rules: Math.random, one: Math.random, ult: Math.random }, // independent playable-game streams
  measureSalt: '',               // immutable for one reset/session
  humanFirstNext: true,
  alwaysFirst: false,
  training: false,
  lastLearned: null
};
const isUlt   = () => S.mode === 'ult';
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

function makeEra(n, agent, prevAgent, mix, kind, ultStats) {
  const verified = OG.verifyUnbeatable(agent);
  const e = {
    n, agent, brain: ULT.cloneBrain(S.liveU),
    kind: kind || 'one',
    games: agent.games, seen: agent.seen,
    matches: S.liveU.matches, seenU: S.liveU.seen, seededU: S.liveU.seeded,
    eps: OG.epsilonAt(agent.games), epsU: ULT.epsilonAt(S.liveU.matches),
    verified, mix: mix || null, ult: ultStats || null,
    landmarks: snapshotLandmarks(agent),
    changed: prevAgent ? policyDiff(prevAgent, agent) : null,
    rec: { w: 0, l: 0, d: 0 },
    recU: { w: 0, l: 0, d: 0 }
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
  /* Keep one-board and ultimate play in distinct streams.  Switching
     modes must not make a prior one-board move alter a rehearsed ultimate
     reply (or vice versa).  A blank seed deliberately starts fresh streams. */
  const liveSeed = mode => S.seed
    ? 'live-play:' + S.seed + ':' + mode
    : 'live-play:' + Math.random().toString(36).slice(2) + ':' + mode;
  S.liveRng = {
    rules: OG.makeRng(liveSeed('rules')),
    one:   OG.makeRng(liveSeed('one')),
    ult:   OG.makeRng(liveSeed('ult'))
  };
  S.measureSalt = S.seed ? 'measure:' + S.seed : 'measure:' + Math.random().toString(36).slice(2);
  S.live = OG.newAgent();
  S.liveU = ULT.newBrain();
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

/* Hand step 2's table over to step 3's brain. Done on entering the
   mode, and repeated on every entry until step 3 has actually trained,
   so the handover always reflects whatever step 2 knows by then. */
function maybeSeed() {
  if (S.liveU.matches > 0) return 0;
  S.liveU = ULT.newBrain();
  const n = ULT.seedFromAgent(S.liveU, S.live);
  S.eras.forEach(e => {
    if (e.brain.matches === 0) {
      e.brain = ULT.cloneBrain(S.liveU);
      e.seenU = S.liveU.seen; e.seededU = S.liveU.seeded;
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
  return isUlt() ? currentEra().recU : currentEra().rec;
}

/* What to call the thing you are playing, wherever the copy needs it. */
function oppLabel() { return isRules() ? 'The rules' : 'Era ' + S.era; }

/* ------------------------------------------------------------------ *
 * The game
 * ------------------------------------------------------------------ */

function newGame() {
  if (isUlt()) return newMatch();
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
 * Ultimate tic-tac-toe
 *
 * The one thing the UI has to get right here is the SEND: which board
 * you are allowed to play in was decided by the cell your opponent just
 * played. S.focus is the board on screen at full size — normally the
 * board you were sent to, and only your own choice when the send landed
 * on a finished board and freed you.
 * ------------------------------------------------------------------ */

function newMatch() {
  const humanFirst = S.alwaysFirst ? true : S.humanFirstNext;
  S.humanFirstNext = !humanFirst;
  S.match = ULT.newMatch();
  S.match.humanMark = humanFirst ? 1 : 2;
  S.focus = 4;                       /* free choice on move one; start in the middle */
  renderUlt(); renderStatus();
  if (!humanFirst) ultAiTurn(500);
}

function ultResult() {
  const m = S.match;
  if (!m.over) return null;
  if (m.winner === 3) return 'draw';
  return m.winner === m.humanMark ? 'win' : 'loss';
}

/* Are you free to choose a board, or were you sent to one? */
const freeChoice = m => m.send === ULT.ANYWHERE;

/* Where the full-size pane should point after a move. When the send
   names a board there is nothing to decide; when it frees you, keep
   whatever you were looking at if it is still playable. */
function pickFocus(m, prefer) {
  if (!freeChoice(m)) return m.send;
  if (m.r[prefer] === 0) return prefer;
  for (let i = 0; i < 9; i++) if (m.r[(prefer + i) % 9] === 0) return (prefer + i) % 9;
  return prefer;
}

function applyUlt(move) {
  const m = S.match;
  ULT.applyMove(m, move);
  S.focus = pickFocus(m, S.focus);
  if (m.over) {
    const rec = currentEra().recU, r = ultResult();
    if (r === 'win') rec.w++; else if (r === 'loss') rec.l++; else rec.d++;
    renderScore();
  }
}

function onUltCell(cell) {
  const m = S.match;
  if (!m || m.over || m.thinking || S.training) return;
  if (m.turn !== m.humanMark) return;
  if (m.r[S.focus] !== 0) return;
  /* belt and braces: the module owns the send rule, so ask it rather
     than re-deriving the answer here */
  if (ULT.legalMoves(m).indexOf(S.focus * 9 + cell) < 0) return;
  applyUlt(S.focus * 9 + cell);
  renderUlt(); renderStatus();
  if (!m.over) ultAiTurn(360);
}

function ultAiTurn(delay) {
  const m = S.match;
  m.thinking = true;
  renderUlt(); renderStatus();
  setTimeout(() => {
    if (!S.match || S.match !== m || m.over) return;
    applyUlt(ULT.greedyMove(currentEra().brain, m, S.liveRng.ult));
    m.thinking = false;
    renderUlt(); renderStatus();
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

/* The meta-grid, plus the one board you are actually playing in.
 *
 * Eighty-one live cells on a phone would be 36px each and the forced
 * board would be a thin outline somewhere inside a wall of glyphs. Two
 * square panes instead: the meta-grid on the left, and the board you
 * were sent to at full size on the right, its squares as big as they
 * are in the one-board game. Ultimate rules make that split MORE
 * honest than it was for nine independent boards, because you do not
 * choose which board to play in — the pane is showing you the only
 * board you are allowed to touch. */
const ultMeta = $('#ult-meta'), ultFocus = $('#ult-focus');
for (let b = 0; b < 9; b++) {
  const mb = document.createElement('button');
  mb.className = 'mb'; mb.dataset.b = b; mb.type = 'button';
  for (let c = 0; c < 9; c++) { const i = document.createElement('i'); mb.appendChild(i); }
  mb.addEventListener('click', () => {
    /* only ever a real choice when the send freed you */
    if (!S.match || !freeChoice(S.match) || S.match.r[b] !== 0) return;
    S.focus = b; renderUlt(); renderStatus();
  });
  ultMeta.appendChild(mb);
}
/* Pressing or tab-focusing a square lights the board it would send the
   opponent to. That is the whole rule, shown rather than described, and
   it costs one class name. */
function previewSend(cell) {
  const m = S.match;
  if (!m || m.over) return;
  const dest = (cell === null || m.r[cell] !== 0) ? -1 : cell;
  $$('.mb', ultMeta).forEach((mb, b) => mb.classList.toggle('dest', b === dest));
  ultFocus.classList.toggle('free-dest', cell !== null && dest < 0);
}
for (let c = 0; c < 9; c++) {
  const el = document.createElement('button');
  el.className = 'cell'; el.dataset.c = c; el.setAttribute('role', 'gridcell');
  el.addEventListener('click', () => onUltCell(c));
  el.addEventListener('pointerenter', () => previewSend(c));
  el.addEventListener('pointerdown', () => previewSend(c));
  el.addEventListener('focus', () => previewSend(c));
  el.addEventListener('pointerleave', () => previewSend(null));
  el.addEventListener('blur', () => previewSend(null));
  ultFocus.appendChild(el);
}

/* Boards are named by where they sit, never by number: "the middle
   board" is findable on a projector at the back of a room and "board 5"
   is not. Every use reads "the <name> board", so no name carries its
   own article. */
const BOARDNAME = ['top left', 'top middle', 'top right',
                   'middle left', 'middle', 'middle right',
                   'bottom left', 'bottom middle', 'bottom right'];

function renderUlt() {
  const m = S.match;
  if (!m) return;
  const brain = currentEra().brain;
  const RES = ['', 'X', 'O', '—'];
  const free = freeChoice(m);
  const yours = !m.over && m.turn === m.humanMark;

  $$('.mb', ultMeta).forEach((mb, b) => {
    const cells = OG.cellsOf(m.b[b]);
    const live = m.r[b] === 0;
    /* `sent` is the board the rules point at; `open` is a board you may
       pick because the send freed you. Both are gold, and only one of
       them can be on screen at a time, so there is never a question
       about where the next mark goes. */
    const sent = !m.over && !free && b === m.send;
    const open = !m.over && free && live;
    mb.className = 'mb' + (m.r[b] ? ' done r' + m.r[b] : '') +
      (sent ? ' sent' : '') + (open ? ' open' : '') +
      (b === S.focus && live ? ' focus' : '') +
      (m.metaLine && m.metaLine.indexOf(b) >= 0 ? ' metawin' : '') +
      (m.last && m.last.board === b ? ' last' : '');
    mb.disabled = !open;
    $$('i', mb).forEach((i, c) => { i.className = cells[c] ? 'm' + cells[c] : ''; });
    mb.setAttribute('aria-label', 'The ' + BOARDNAME[b] + ' board' +
      (m.r[b] === 0 ? ', in play' : m.r[b] === 3 ? ', drawn' :
       ', won by ' + (m.r[b] === m.humanMark ? 'you' : 'it')) +
      (sent ? ' — you must play here' : open ? ' — you may play here' : ''));
    let tag = mb.querySelector('.tag');
    if (!tag) { tag = document.createElement('span'); tag.className = 'tag'; mb.appendChild(tag); }
    tag.textContent = m.r[b] ? RES[m.r[b]] : '';
  });

  /* The caption under the panes: the send rule, in words, on every
     single turn — it is the rule the whole act turns on, and a ring
     round a board does not say WHY the ring is there. The board count
     rides on its second line rather than in a row of its own, which is
     what keeps TRAIN above the fold on a 320x568 screen. */
  const t = ULT.tally(m);
  const you = m.humanMark === 1 ? t.x : t.o, its = m.humanMark === 1 ? t.o : t.x;
  const cap = $('#ult-where');
  cap.className = m.over ? 'over' : free ? 'free' : 'sent';
  cap.innerHTML =
    `<span class="uw-say">` + (m.over
      ? `<b>Match over.</b>`
      : !yours
        ? `<b>Its turn</b> — it must play ${free ? 'anywhere it likes' : 'in the <b>' + BOARDNAME[m.send] + '</b> board'}`
        : free
          ? `<b>Play anywhere.</b> It sent you to a finished board, so the whole grid is open — tap a board.`
          : `<b>You must play in the ${BOARDNAME[m.send]} board</b> — its last square sent you there.`) +
    `</span>` +
    `<span class="uw-score"><b class="you">${you}</b>–<b class="ai">${its}</b> boards` +
    (t.d ? ` · ${t.d} drawn` : '') + ` · three in a row wins</span>`;

  const code = m.b[S.focus], cells = OG.cellsOf(code);
  const playable = yours && m.r[S.focus] === 0 && (free || m.send === S.focus);
  const showHeat = S.brain && !m.over && m.r[S.focus] === 0;
  const mark = m.turn;
  const picks = showHeat ? ULT.policyMoves(brain, m).filter(mv => ((mv / 9) | 0) === S.focus)
                              .map(mv => mv % 9) : [];
  $$('.cell', ultFocus).forEach((el, c) => {
    const v = cells[c];
    /* Where this square would send the opponent. `.sends-free` is the
       loaded one: a square whose board is finished hands them the whole
       grid, and nothing about the picture inside this board says so. */
    const sendsFree = !v && m.r[c] !== 0;
    el.className = 'cell' + (v ? ' mk' + v : ' open') +
      (m.last && m.last.board === S.focus && m.last.cell === c && v ? ' last' : '') +
      (!v && sendsFree ? ' sends-free' : '') +
      (showHeat && !v ? ' heat' : '') + (picks.indexOf(c) >= 0 ? ' pick' : '');
    el.disabled = !!v || !playable || m.thinking;
    el.style.background = ''; el.style.color = '';
    if (v) { el.textContent = MARK[v]; el.setAttribute('aria-label', CELLNAME[c] + ', taken'); return; }
    const dest = sendsFree ? 'sends it anywhere' : 'sends it to the ' + BOARDNAME[c] + ' board';
    if (showHeat) {
      const val = ULT.moveValue(brain, code, c, mark);
      const after = code + mark * OG.POW3[c], opp = mark === 1 ? 2 : 1;
      const seen = brain.hits(after, opp);
      el.style.background = heat(val); el.style.color = heatInk(val);
      const note = seen ? 'seen ' + fmt(seen) + '×' : 'never seen';
      el.innerHTML = `<span class="v">${sgn(val)}</span>` +
        `<span class="n">${note}</span>` +
        `<span class="s" aria-hidden="true">${sendsFree ? '✦' : c + 1}</span>`;
      el.setAttribute('aria-label', CELLNAME[c] + ': ' + val.toFixed(2) + ', ' + note + ', ' + dest);
    } else {
      el.innerHTML = `<span class="s" aria-hidden="true">${sendsFree ? '✦' : c + 1}</span>`;
      el.setAttribute('aria-label', CELLNAME[c] + ', empty, ' + dest);
    }
  });

  renderBrainReadout();
}

function renderStatus() {
  if (isUlt()) return renderUltStatus();
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

function renderUltStatus() {
  const m = S.match, el = $('#status');
  el.className = '';
  if (!m) return;
  if (m.over) {
    const r = ultResult();
    const t = r === 'win' ? ['You win the match.', 'Three boards in a row — and it never saw them coming.']
            : r === 'loss' ? ['It wins the match.', 'Three boards in a row.']
            : ['Match drawn.', 'All 81 squares gone and nobody made a line of three boards.'];
    el.classList.add(r === 'win' ? 'you-win' : r === 'loss' ? 'you-lose' : 'drawn');
    el.innerHTML = `<div><span class="big">${t[0]}</span><br><span class="sub">${t[1]}</span></div>`;
    return;
  }
  if (m.thinking) {
    el.innerHTML = `<div><span class="sub">Era ${S.era} is choosing a square…</span></div>`;
    return;
  }
  /* #ult-where directly above already says whose turn it is and which
     board they are stuck in, so while a match is running this row
     carries only the thing that is nowhere else — which mark is yours.
     Saying it twice would cost a line, and a line is what stands
     between TRAIN and the bottom of a 320x568 screen. The result keeps
     its full two-line treatment; by then nobody is mid-match. */
  el.innerHTML = `<div><span class="sub">you are ${MARK[m.humanMark]} · ` +
    `it is ${MARK[m.humanMark === 1 ? 2 : 1]}</span></div>`;
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
  if (isUlt()) return renderUltReadout();
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

/* The inspector is where the shortcut is visible rather than argued.
   What it prints is exactly what the agent is looking at, so the two
   things it is NOT looking at are conspicuous by their absence. */
function renderUltReadout() {
  const el = $('#brain-readout'), e = currentEra(), m = S.match, brain = e.brain;
  const blind = m && !m.over ? ULT.blindFraction(brain, m) : 0;
  const slots = ULT.SPACE.slots;
  el.innerHTML =
    `<div>Scores for the ${BOARDNAME[S.focus]} board only — how much each square would improve ` +
    `<b>that one board</b>. That is the whole calculation, and it is the shortcut: it says ` +
    `nothing about where this board sits on the grid, and nothing about where the square ` +
    `you pick would send it next.</div>` +
    `<div style="margin-top:.5em">Era ${e.n}'s table: <b>${fmt(brain.seen)}</b> of the ` +
    `<b>${fmt(slots)}</b> entries this game can use have a number in them` +
    (brain.seeded ? `, <b>${fmt(brain.seeded)}</b> of them handed straight over from step 2`
                  : '') + '.</div>' +
    (m && !m.over && blind > 0
      ? `<div style="margin-top:.5em">Right now <b>${Math.round(blind * 100)}%</b> of the squares it ` +
        `is weighing up sit on a board picture it has never met. It reads 0.00 for every one of ` +
        `them, which looks exactly like "even".</div>`
      : m && !m.over
        ? `<div style="margin-top:.5em">It has met every board picture on offer here at least once. ` +
          `Early in a match that is normal; the strange ones turn up later.</div>` : '') +
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

function renderEraSelect() {
  const sel = $('#era-select');
  sel.innerHTML = S.eras.map(e =>
    `<option value="${e.n}">Era ${e.n} · ` +
    (isUlt()
      ? (e.matches ? fmtk(e.matches) + ' matches' : 'no ultimate practice')
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
  const key = isUlt() ? 'recU' : 'rec';
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
  const ult = isUlt();
  $('.t-main', $('#btn-train')).textContent = ult ? 'Train on ultimate' : 'Train the AI';
  $('#train-sub').textContent = ult ? fmt(S.burstU) + ' matches' : fmt(S.burst) + ' games';
  const sizes = ult ? ULT.HPU.bursts : OG.HP.bursts;
  const cur = ult ? S.burstU : S.burst;
  $('#burst-seg').innerHTML = sizes.map(b =>
    `<button data-b="${b}" class="${b === cur ? 'on' : ''}" aria-pressed="${b === cur}">${fmt(b)}</button>`).join('');
  $$('#burst-seg button').forEach(b => b.addEventListener('click', () => {
    if (isUlt()) S.burstU = +b.dataset.b; else S.burst = +b.dataset.b;
    renderTrain();
  }));
  $('#train-stats').innerHTML = ult
    ? `<div class="st"><span class="n">${fmt(e.matches)}</span><span class="k">matches trained</span></div>` +
      `<div class="st"><span class="n">${fmt(e.seenU)}</span><span class="k">pictures seen</span></div>` +
      `<div class="st"><span class="n">${fmt(ULT.SPACE.slots)}</span><span class="k">entries it can use</span></div>`
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

  /* ---- Step 3: the three-layer lesson, where the banner would be ---- */
  if (isUlt()) {
    const SP = ULT.SPACE, SV = ULT.SOLVED;
    const e38 = v => (v / 1e38).toFixed(1) + ' × 10³⁸';
    el.hidden = false;
    el.classList.add('quiet');
    el.innerHTML =
      `<h3>This game is solved. This app still cannot prove anything about it.</h3>` +
      `<p>Those are two different statements and holding both at once is the whole of step 3.</p>` +
      `<p><b>Ordinary tic-tac-toe: ${fmt(ULT.SMALLGAMES)} complete games.</b> Steps 1 and 2 end in a ` +
      `banner because the app can walk every one of them and come back. Proof by exhaustion — you ` +
      `check all the cases, and there is nothing clever about it.</p>` +
      `<p><b>Ultimate tic-tac-toe: about ${e38(SP.bound)} positions.</b> Not a slow search — an ` +
      `impossible one. Counting a billion a second, starting at the big bang, you would be about ` +
      `${Math.round(SP.timesCountable / 1e10) * 10} billion times short. And the two tricks that ` +
      `usually cut a number like that down are both unavailable here. You cannot treat the boards ` +
      `as interchangeable, because you win three <i>in a row</i> and where a board sits is the ` +
      `whole question. You cannot turn one board on its own either, because that would move its ` +
      `squares, and its squares are what name the next board. Exactly one symmetry survives — ` +
      `turn the whole 9×9 grid at once, ${SP.symmetry} ways — and after spending it you are still ` +
      `at ${SP.boundOverRaw.toFixed(2)} of the naive ${e38(SP.raw81)} you get by ignoring the ` +
      `rules altogether. The tidying buys nothing.</p>` +
      `<p><b>And it is solved anyway.</b> ${SV.authors} proved in ${SV.year} that the first player ` +
      `has a forced win — <b>in at most ${SV.atMost} moves</b>, with the second player able to hold ` +
      `out <b>at least ${SV.atLeast}</b>. Nobody visited ${e38(SP.bound)} positions to do it. They ` +
      `wrote down a strategy and proved it always works, which is what mathematics is for. <b>A ` +
      `proof does not require checking every case</b> — that is the most interesting thing on this ` +
      `page, and it is why "too big to search" and "unknowable" are not the same sentence.</p>` +
      `<p><b>None of which helps the thing you are playing.</b> It is not running that strategy, it ` +
      `has never been shown it, and this app cannot search its tree. So it is only ever <i>good</i>, ` +
      `measured — never proven. That is the ordinary situation for every serious AI system: chess ` +
      `engines, self-driving cars, language models. Somebody may have proved something about the ` +
      `problem. Nobody has proved anything about the program.</p>` +
      `<div class="proof">${SV.title} · ${SV.ref} · ` +
      `Worth reading before quoting: the paper proves this for the variant in which ` +
      `${SV.variant}. The squares above use the commoner convention, where a won board frees ` +
      `you too — and the published strategy leans on sending the second player back into a board ` +
      `the first has already won, which this page would not allow. Near neighbours, not the same ` +
      `game, so the result is quoted rather than claimed for the squares above.</div>` +
      `<div class="proof">` +
      (S.liveU.seeded
        ? `Handed over from step 2: ${fmt(S.liveU.seeded)} of the ${fmt(SP.slots)} entries this ` +
          `game can use`
        : `Step 2 has not trained yet, so there was nothing to hand over — this table started at ` +
          `zero, of ${fmt(SP.slots)} entries the game can use`) +
      ` · filled so far ${fmt(S.liveU.seen)} · matches trained ${fmt(S.liveU.matches)}</div>`;
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
  if (isUlt()) return trainUlt();
  S.training = true;
  const size = S.burst;
  const prev = OG.cloneAgent(S.live);
  const ov = $('#montage'); ov.hidden = false;
  $('#m-count').classList.add('blur');
  $('#m-count-sub').textContent = 'games played against itself and against chance';
  $('#m-wr-label').textContent = 'wins vs a random player';
  $('#m-boards').classList.remove('ult');
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

function miniUHTML(m) {
  let h = '<div class="miniu">';
  for (let b = 0; b < 9; b++) {
    const c = OG.cellsOf(m.b[b]);
    h += `<div class="mub${m.r[b] ? ' r' + m.r[b] : ''}">`;
    for (let i = 0; i < 9; i++) h += `<i class="${c[i] ? 'm' + c[i] : ''}"></i>`;
    h += '</div>';
  }
  return h + '</div>';
}

/* The live bar during an ultimate burst is deliberately measured
   against the BOARD-LOCAL hand-written player — the one that shares the
   agent's blind spot — because that is the opponent it can actually
   improve against, and watching a number move is the point of a
   montage. The card afterwards then shows the other opponent, where the
   same number does not move at all. */
async function trainUlt() {
  S.training = true;
  const size = S.burstU;
  const ov = $('#montage'); ov.hidden = false;
  $('#m-count').classList.add('blur');
  $('#m-count-sub').textContent = 'matches played against itself and against chance';
  $('#m-boards').classList.add('ult');
  $('#m-boards').innerHTML = miniUHTML(ULT.newMatch()).repeat(3);
  $('#m-wr-label').textContent = 'holds or beats the board-local player';

  const STEPS = 30, per = Math.ceil(size / STEPS);
  const t0 = performance.now();
  let done = 0, selfPlay = 0, vsRandom = 0, hold = null, pool = [];
  let ms = 0;

  for (let i = 0; i < STEPS; i++) {
    const n = Math.min(per, size - done);
    if (n > 0) {
      const c0 = performance.now();
      const r = ULT.trainMatches(S.liveU, n, S.rng, { sampleEvery: Math.max(1, Math.floor(n / 2)) });
      ms += performance.now() - c0;
      done += n; selfPlay += r.selfPlay; vsRandom += r.vsRandom;
      pool = pool.concat(r.samples).slice(-12);
    }
    if (i % 7 === 4) {
      const sc = ULT.vsHeuristic(S.liveU, 40, S.rng);
      hold = (sc.wins + sc.draws) / sc.matches;
    }
    $('#m-count').textContent = fmt(done);
    const eps = ULT.epsilonAt(S.liveU.matches);
    $('#m-eps').textContent = eps.toFixed(2);
    $('#m-eps-fill').style.width = (eps * 100).toFixed(1) + '%';
    if (hold !== null) {
      $('#m-wr').textContent = (hold * 100).toFixed(0) + '%';
      $('#m-wr-fill').style.width = (hold * 100).toFixed(1) + '%';
    }
    $('#m-prog').style.width = ((i + 1) / STEPS * 100).toFixed(1) + '%';
    if (pool.length) {
      $('#m-boards').innerHTML = Array.from({ length: 3 }, () =>
        miniUHTML(pool[(Math.random() * pool.length) | 0])).join('');
    }
    await pauseUntil(t0 + MONTAGE_MS * (i + 1) / STEPS);
  }
  $('#m-count').classList.remove('blur');
  await pauseUntil(t0 + MONTAGE_MS + 160);

  const era = makeEra(S.eras.length, OG.cloneAgent(S.live), null, null, 'ult',
    { selfPlay, vsRandom, matches: size, ms });
  S.eras.push(era);
  S.era = era.n;
  ov.hidden = true;
  $('#m-boards').classList.remove('ult');
  S.training = false;
  renderEraSelect(); renderTrain(); renderBanner();
  newGame(); renderScore();
  buildLearnedUlt(era, S.eras[era.n - 1]);
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

/* The ultimate card shows no landmark positions, because what matters
   here is not what it learned about any one picture — it is that the
   decomposition it inherited has stopped being able to represent the
   game. So the card reports the measurements that establish that, each
   one beside the control that keeps it honest. */
function buildLearnedUlt(era, before) {
  $('#learned-title').textContent = 'Era ' + era.n + ' — ultimate tic-tac-toe';
  $('#learned-sub').textContent =
    fmt(era.matches) + ' matches · exploration ' + era.epsU.toFixed(2);

  const SP = ULT.SPACE;
  /* Cache a report once. Every measurement has its own deterministic
     stream, so the card is a literal read-only view of a frozen era and
     reopening it cannot perturb the next burst. */
  const metrics = era.metricsU || (era.metricsU = {
    recU: ULT.measureRecurrence(era.brain, ULT.HPU.burst, measureRng(era, 'recU')),
    rec1: ULT.measureRecurrenceSingle(era.agent, OG.HP.burst, measureRng(era, 'rec1')),
    local: ULT.vsHeuristic(era.brain, 200, measureRng(era, 'local')),
    aware: ULT.vsSendAware(era.brain, 200, measureRng(era, 'aware')),
    rnd: ULT.vsRandom(era.brain, 100, measureRng(era, 'random')),
    /* 400 rather than a token sample, because the interesting split —
       a match-winning move with another board win tied against it — is
       rare, and a rate printed off a handful of chances would be noise
       dressed as a finding. It costs about 60 ms. */
    blind: ULT.measureBlindness(era.brain, 400, measureRng(era, 'blind'), ULT.heuristicMove)
  });
  const { recU, rec1, local, aware, rnd, blind } = metrics;
  const grew = before ? era.seenU - before.seenU : era.seenU;
  const pc = v => Math.round(100 * v) + '%';

  const head =
    `<div class="headline">${fmt(era.matches)} matches in ${Math.round(era.ult.ms)} ms — ` +
    `${fmt(era.ult.selfPlay)} against itself and ${fmt(era.ult.vsRandom)} against chance. ` +
    `Its table now holds <b>${fmt(era.seenU)}</b> of the ${fmt(SP.slots)} entries this game can ` +
    `use` + (grew > 0 && before ? `, ${fmt(grew)} of them new this burst` : '') +
    (era.seededU ? `. <b>${fmt(era.seededU)}</b> came straight over from what it learned on one ` +
      `board — ${Math.round(100 * era.seededU / SP.slots)}% of what it needs, free.` : '.') +
    `</div>`;

  const cards = [
    /* ---- BEAT 1, part one: the meta-grid is invisible ---- */
    `<div class="lc"><h3>It cannot see the game it is playing</h3>` +
    `<div class="ask">Measured over ${fmt(blind.matches)} matches. The first row is a ` +
    `<b>control</b>: a free win inside one board is exactly what a per-board table CAN see, so ` +
    `if that number were low nothing below it would mean anything.</div>` +
    `<table class="cmp"><tr><th></th><th>taken</th><th>of</th><th>rate</th></tr>` +
    `<tr><td>a free win in a board <i>(control)</i></td><td>${fmt(blind.boardWinTaken)}</td>` +
    `<td>${fmt(blind.boardWinChances)}</td><td>${pc(blind.boardWinRate)}</td></tr>` +
    `<tr class="hi"><td>a move that wins the <b>match</b></td><td>${fmt(blind.matchWinTaken)}</td>` +
    `<td>${fmt(blind.matchWinChances)}</td><td>${pc(blind.matchWinRate)}</td></tr>` +
    `<tr><td>&nbsp;&nbsp;…when it is the only board win</td><td>${fmt(blind.aloneTaken)}</td>` +
    `<td>${fmt(blind.aloneChances)}</td><td>${pc(blind.aloneRate)}</td></tr>` +
    /* Only print the rate for the rare split once there are enough
       chances behind it to mean anything. A percentage off four
       chances is noise wearing a finding's clothes. */
    `<tr><td>&nbsp;&nbsp;…when another board win ties</td><td>${fmt(blind.rivalTaken)}</td>` +
    `<td>${fmt(blind.rivalChances)}</td><td>${blind.rivalChances >= 10
      ? pc(blind.rivalRate) : '<i>too few</i>'}</td></tr></table>` +
    `<div class="delta"><span class="down">A move that wins the match scores the same as any ` +
    `other board win.</span> When it is the only board win going it takes it at the control rate — ` +
    `it is taking a board win, and this one happens to end the match. ` +
    (blind.rivalChances >= 10
      ? `When a different board win ties with it, it flips a coin. `
      : `The last row is the sharpest case and also the rarest; train again and it fills in. `) +
    `Winning three boards <i>in a row</i> is a fact about where boards sit on the grid, and a ` +
    `table indexed by the picture inside a board has nowhere to keep it.</div></div>`,

    /* ---- BEAT 1, part two: the send is invisible ---- */
    `<div class="lc"><h3>And it cannot see where it is sending you</h3>` +
    `<div class="ask">The square you play names the board your opponent plays in next. Counted ` +
    `over the ${fmt(blind.giftTurns)} turns where some moves handed the opponent a board they ` +
    `could win at once and some did not — a real choice, in other words.</div>` +
    `<div class="score3">` +
    `<span class="s3 l"><b>${pc(blind.giftRate)}</b>it gave it away</span>` +
    `<span class="s3 d"><b>${pc(blind.giftChanceRate)}</b>blind choosing would</span>` +
    `<span class="s3 w"><b>${fmt(blind.giftAvoidable)}</b>were free to avoid</span></div>` +
    `<div class="delta"><span class="down">It hands over an immediate win at about the rate you ` +
    `would get by not looking</span> — because it is not looking. The small margin under chance ` +
    `is not foresight: taking the square an opponent needs is a <i>block</i>, which is visible one ` +
    `board at a time, and a blocked board is no longer a gift. It gets that much for free and ` +
    `nothing else. Of the giveaways it did make, <b>${pc(blind.avoidableRate)}</b> had an ` +
    `equally top-scoring square sitting right beside them that would not have — the table rated ` +
    `the two identically, so a coin picked the bad one.</div></div>`,

    /* ---- the consequence: the wall, with a control ---- */
    `<div class="lc"><h3>Which is why it stops getting better</h3>` +
    `<div class="ask">Two hand-written opponents, 200 matches each, alternating who starts. They ` +
    `are the <b>same player</b> apart from three clauses: win the match if you can, do not send ` +
    `them somewhere they win, and weigh a board by how many lines of three it sits on. The ` +
    `learner has never been shown either of them.</div>` +
    `<table class="cmp"><tr><th></th><th>won</th><th>drawn</th><th>lost</th></tr>` +
    `<tr><td>board-local rules <i>(control)</i></td><td>${local.wins}</td><td>${local.draws}</td>` +
    `<td>${local.losses}</td></tr>` +
    `<tr class="hi"><td>the same, plus the three clauses</td><td>${aware.wins}</td>` +
    `<td>${aware.draws}</td><td>${aware.losses}</td></tr></table>` +
    `<div class="delta">${local.losses < aware.losses - 20
      ? `<span class="down">It improves against the opponent that shares its blind spot, and not ` +
        `against the one that does not.</span> Keep pressing Train and watch: the first row keeps ` +
        `falling, the second one stops. The three clauses are an afternoon's work for a person — ` +
        `and all three are things this memory has no slot for, so no amount of experience puts ` +
        `them in.`
      : `Early days: it is still losing to both. Train it again and watch which row moves.`}` +
    ` Against a player choosing at random it wins ${rnd.wins} of ${rnd.matches}.</div></div>`,

    /* ---- beat 2, live: nothing repeats ---- */
    `<div class="lc"><h3>Does anything ever come round twice?</h3>` +
    `<div class="ask">Learning from experience only works if the experience repeats. Counted by ` +
    `playing one burst's worth of each — ${fmt(OG.HP.burst)} single games, ` +
    `${fmt(ULT.HPU.burst)} matches of about ${Math.round(recU.plies)} moves — and tallying every ` +
    `position met. A position here includes <b>which board you were sent to</b>: the same 81 ` +
    `marks with the opponent pointed somewhere else is not the same position.</div>` +
    `<table class="cmp"><tr><th></th><th>one board</th><th>ultimate</th></tr>` +
    `<tr><td>positions met</td><td>${fmt(rec1.positions)}</td><td>${fmt(recU.positions)}</td></tr>` +
    `<tr><td>different ones</td><td>${fmt(rec1.distinct)}</td><td>${fmt(recU.distinct)}</td></tr>` +
    `<tr class="hi"><td>times each came round</td><td>${(rec1.positions / rec1.distinct).toFixed(1)}×</td>` +
    `<td>${(recU.positions / recU.distinct).toFixed(2)}×</td></tr></table>` +
    `<div class="delta"><span class="down">Essentially nothing repeats.</span> A table over whole ` +
    `positions could never learn anything here, because it would never see the same page twice. ` +
    `The only reason this one learns at all is that it looks at <b>one board at a time</b> — and ` +
    `a person chose that shortcut. The two cards above are the bill for it.</div></div>`,

    /* ---- what could not come across ---- */
    `<div class="lc"><h3>What it could not carry over</h3>` +
    `<div class="ask">On one board, the marks tell you whose turn it is. Here you can play twice ` +
    `in the same board while your opponent is busy elsewhere, so a board can hold three of yours ` +
    `and one of theirs — a picture ordinary tic-tac-toe cannot produce at all.</div>` +
    `<div class="delta">` +
    (era.seededU
      ? `Step 2 handed over <b>${fmt(era.seededU)}</b> entries. This game can use ` +
        `<b>${fmt(SP.slots)}</b>, so <b>${Math.round(100 - 100 * era.seededU / SP.slots)}%</b> of ` +
        `what it needed had to be learned from nothing.`
      : `Step 2 has not trained yet, so nothing came across at all and every one of the ` +
        `<b>${fmt(SP.slots)}</b> entries started at zero. Train step 2 first and come back: it ` +
        `hands over what it can, and it is a small fraction.`) +
    ` Turn the inspector on during a match and it will tell you how many of the squares it is ` +
    `weighing up right now sit on a picture it has never seen.</div></div>`
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

  /* Step 3 gets sampled benchmarks and structural checks, never a
     proof — the space cannot be searched, and printing "all checks
     passed" here would read as one. */
  if (isUlt()) {
    const r = measureRng(e, 'selftest-ult');
    const local = ULT.vsHeuristic(e.brain, 100, r), random = ULT.vsRandom(e.brain, 100, r);
    const aware = ULT.vsSendAware(e.brain, 100, r);
    const b = ULT.measureBlindness(e.brain, 60, r, ULT.heuristicMove);
    check(e.brain && e.matches >= 0, 'the ultimate brain is present and measurable');
    check(local.matches === 100 && random.matches === 100 && aware.matches === 100,
      'sampled benchmarks ran: 100 matches against each of three opponents');
    check(ULT.SPACE.pictures === 18753 && ULT.SPACE.classes === 2694,
      `the state-space count is recomputed live: ${fmt(ULT.SPACE.pictures)} reachable board ` +
      `pictures, ${fmt(ULT.SPACE.classes)} up to symmetry`);
    check(typeof ULT.verifyUnbeatable === 'undefined',
      'no unbeatability proof is on offer, and none can be — that is the honest result');
    out.push('');
    out.push(`        vs board-local rules  ${local.wins} won, ${local.draws} drawn, ${local.losses} lost of 100`);
    out.push(`        vs send-aware rules   ${aware.wins} won, ${aware.draws} drawn, ${aware.losses} lost of 100`);
    out.push(`        vs random play        ${random.wins} won, ${random.draws} drawn, ${random.losses} lost of 100`);
    out.push(`        free board win taken ${Math.round(100 * b.boardWinRate)}% (control), ` +
             `match-winning move taken ${Math.round(100 * b.matchWinRate)}%`);
    out.push(fails ? `<span class="no">${fails} sampled benchmark check(s) failed for Era ${e.n}</span>`
                   : `<span class="ok">sampled benchmarks passed for Era ${e.n} — measured, not proved</span>`);
    $('#selftest-out').innerHTML = out.join('\n');
    console.log('[Zero to Unbeatable] sampled benchmarks for Era ' + e.n + '\n' +
      out.join('\n').replace(/<[^>]+>/g, ''));
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
And this borrowing is exactly what fails in <b>ultimate</b>: asking &ldquo;what can my opponent
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
<p>Switch to <b>Ultimate</b>: nine small boards in a 3&times;3 grid, and one extra rule.
<b>The square you play in decides which board your opponent must play in next.</b> Play the middle
square of any board and they are sent to the middle board. If they are sent to a board that is
already finished &mdash; won or full &mdash; they may play anywhere. Win a small board by three in
a row inside it; win the <b>match</b> by winning three small boards in a row on the big grid. A
small board that fills up with nobody winning it is a draw and counts for neither side.</p>
<p>One sentence of extra rule, and the approach behind step 2 comes apart in two specific places,
both of them measured on the card after a burst rather than asserted here:</p>
<p>&bull; <b>A board is worth different amounts depending on where it is.</b> The middle board sits
on four lines of three; an edge board sits on two. The agent scores a board by the picture inside
it, and those pictures are identical. So a move that wins it the <i>match</i> scores exactly the
same to it as any other board win &mdash; measured, and it is why it will happily take a different
board and let the match go.</p>
<p>&bull; <b>Your move also decides where your opponent plays.</b> Two moves can leave a board
looking the same and send the opponent somewhere they win instantly, or somewhere they have
nothing. A table that only looks at the board that changed scores them the same, so it hands over
a free win at about the rate you would get by not looking &mdash; because it is not looking.</p>
<p>Both of those come from the same shortcut: <b>look at one board at a time and add up</b>. A
person chose that, back when the boards really were independent, and it is now simply the wrong
description of the game. Finding a better one without being told is what the next kind of learner is
for. Two more things worth watching: about half the board pictures you meet cannot occur in ordinary
tic-tac-toe at all (you can play twice in the same board while your opponent is busy elsewhere), so
most of what step 2 learned does not transfer; and a position comes round about ten times in a
training burst on one board, and about once here.</p>

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
  const ult = isUlt(), rules = isRules();
  $$('#mode-seg button').forEach(x => {
    const on = x.dataset.mode === S.mode;
    x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on));
  });
  document.body.classList.toggle('step-rules', rules);
  document.body.classList.toggle('step-ult', ult);
  $('#how-head span').textContent = rules ? 'Rules, learning, and which is better'
                                          : 'How is it learning?';
  $('#board-wrap').hidden = ult;
  $('#ult-wrap').hidden = !ult;
  $('#era-select').hidden = rules;
  $('#depth-seg').hidden = !rules;
  $('#btn-brain').hidden = rules;
  $('#btn-learned').hidden = rules || S.lastLearned === null;
  if (rules && S.brain) {          // the inspector reads a value table; there is not one here
    S.brain = false;
    $('#btn-brain').setAttribute('aria-pressed', 'false');
    $('#btn-brain').textContent = 'Show its brain';
    $('#brain-readout').hidden = true;
  }
  if (ult) maybeSeed();
  if (rules) renderDepthSeg();
  /* renderRuleFired belongs here and not only in newGame(): a match has
     no rule commentary to draw, so leaving step 1 for step 3 used to
     strand the panel on screen, and on a phone that pushed TRAIN below
     the fold. One place decides what a step shows; this is it. */
  renderEraSelect(); renderTrain(); renderRulesPanel(); renderRuleFired();
  renderBanner(); renderScore();
  newGame();
}

$$('#mode-seg button').forEach(btn => btn.addEventListener('click', () => {
  if (S.training || S.mode === btn.dataset.mode) return;
  S.mode = btn.dataset.mode;
  applyMode();
}));

$('#btn-train').addEventListener('click', train);
$('#btn-newgame').addEventListener('click', newGame);
function renderPlay() { if (isUlt()) renderUlt(); else renderBoard(); }

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
  if (era.kind === 'ult') buildLearnedUlt(era, prev); else buildLearned(era, prev);
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
