/* =====================================================================
   Zero to Unbeatable — nine boards at once

   The second act. Same nine squares, nine times over: nine independent
   boards, one mark per turn on ANY unfinished board, finished boards
   lock, and the first player to win five boards takes the match.

   Why this is not just "more tic-tac-toe"
   ---------------------------------------
   Two things break, and both are the lesson.

   1. THE SPACE EXPLODES. One board has 5,478 legal positions and the
      whole table fits in memory with room to spare. A nine-board match
      position is nine boards at once, so the count is astronomical --
      the app measures the practical consequence rather than quoting the
      arithmetic: during a burst it counts how many match positions it
      sees and how many it sees TWICE. On one board almost everything
      recurs, hundreds of times. Here, essentially nothing does. Learning
      from experience needs the experience to repeat.

   2. THE OLD TABLE DOES NOT FIT. In one-board tic-tac-toe the marks on
      the board tell you whose turn it is: equal counts means X. Here you
      may move twice in the same board while your opponent plays
      elsewhere, so a board can hold three X's and one O. Those positions
      cannot occur in real tic-tac-toe, so Act I's table has never seen
      them and -- worse -- its whole "value to whoever just moved"
      convention is undefined for them.

   So the table grows by exactly one bit — whose turn it is:

     U[board, turn] = how this board ends up, from X's point of view,
                      given it is `turn`'s move.   +1 X takes it,
                      -1 O takes it, 0 drawn.

   Two numbers per board picture instead of one, 39,366 in all. The
   learning rule is ACT I'S RULE, unchanged: a position is worth the best
   thing the player to move can reach from it, and a finished board is
   worth its result. Carrying the turn explicitly instead of reading it
   off the mark counts is the only change, and it is what makes an
   unbalanced board representable at all.

   That one bit is not cosmetic. Without it the agent takes 100% of the
   free wins and blocks 0% of the threats — measured, not guessed —
   because a board with two O's and an empty third is only dangerous if
   O is the one about to move, and a table that cannot say which will
   average the two and shrug.

   Which board to play in falls out of arithmetic rather than a rule
   someone wrote. The match is worth the sum of its nine boards, and a
   move changes one board and hands the turn over, so

     value to me of playing cell c in board b
        = ±( U[board b after the move, THEM] - U[board b now, THEM] )

   — everything else in that sum is identical whichever move is chosen,
   so it cancels. Both terms are read with the opponent to move, which is
   precisely why blocking scores: leaving them on move in a board they
   are about to win is worth -1, and blocking it is worth 0.

   An untrained brain — every number zero — picks uniformly at random
   over all 81 squares, exactly as in Act I.

   What Act I knows is handed over rather than thrown away: every
   balanced position it learned converts exactly into this form, because
   for those positions the mover IS implied by the counts. The positions
   that only exist here start at zero, and the app shows you how often it
   is looking at one of them.

   heuristicMove at the bottom is a rule-based opponent, written by hand
   the way a person would: take any win, block any loss, otherwise
   prefer the middle. The learner never consults it. It is there as a
   benchmark, so the question "is learning actually better than the
   rules a person would write down?" has a number attached.
   ===================================================================== */

const NINE = (function (OG) {
'use strict';

const { POW3, NCODE, WINNER, NEMPTY, TOMOVE, CELLS, moverOf } = OG;

const BOARDS = 9;
const TO_WIN = 5;              /* first to five boards takes the match */

/* ------------------------------------------------------------------ *
 * Match state
 * ------------------------------------------------------------------ */

function newMatch() {
  return {
    b: new Int32Array(BOARDS),     /* board codes */
    r: new Uint8Array(BOARDS),     /* 0 live, 1 X took it, 2 O took it, 3 drawn */
    turn: 1,
    over: false,
    winner: 0,                     /* 0 none yet, 1 X, 2 O, 3 drawn match */
    plies: 0,
    last: null                     /* {board, cell, mark} */
  };
}

function cloneMatch(m) {
  return { b: Int32Array.from(m.b), r: Uint8Array.from(m.r), turn: m.turn,
           over: m.over, winner: m.winner, plies: m.plies, last: m.last };
}

function boardOutcome(code) {
  const w = WINNER[code];
  if (w === 1 || w === 2) return w;
  if (NEMPTY[code] === 0) return 3;
  return 0;
}

function tally(m) {
  let x = 0, o = 0, d = 0;
  for (let i = 0; i < BOARDS; i++) {
    if (m.r[i] === 1) x++; else if (m.r[i] === 2) o++; else if (m.r[i] === 3) d++;
  }
  return { x, o, d };
}

function movesOf(m, out) {
  out.length = 0;
  for (let i = 0; i < BOARDS; i++) {
    if (m.r[i] !== 0) continue;
    const off = m.b[i] * 9;
    for (let c = 0; c < 9; c++) if (CELLS[off + c] === 0) out.push(i * 9 + c);
  }
  return out;
}
function legalMoves(m) { return movesOf(m, []); }

/* returns true if the match ended on this move */
function applyMove(m, move) {
  const board = (move / 9) | 0, cell = move % 9, mark = m.turn;
  m.b[board] += mark * POW3[cell];
  m.last = { board, cell, mark };
  m.plies++;
  const out = boardOutcome(m.b[board]);
  if (out) m.r[board] = out;

  const t = tally(m);
  if (t.x >= TO_WIN || t.o >= TO_WIN) {
    m.over = true; m.winner = t.x > t.o ? 1 : 2;
  } else if (legalMoves(m).length === 0) {
    m.over = true; m.winner = t.x === t.o ? 3 : (t.x > t.o ? 1 : 2);
  } else {
    m.turn = mark === 1 ? 2 : 1;
  }
  return m.over;
}

/* the position of every board, as one key, for counting repeats */
function matchKey(m) {
  let s = '';
  for (let i = 0; i < BOARDS; i++) s += m.b[i] + ',';
  return s;
}

/* ------------------------------------------------------------------ *
 * The brain: one number per board picture, from X's point of view
 * ------------------------------------------------------------------ */

const HP9 = {
  /* Tuned the same way Act I was: on the shape of the arc. Measured over
     a run seeded from a finished Act I agent, against the hand-written
     rule-based opponent, 400 matches per era —
     losses 200 -> 385 -> 255 -> 110 -> 0, and zero from there on. */
  alphaFloor: 0.60,   /* the target is a Bellman backup, not a noisy sample,
                         so a high rate is correct here as in Act I */
  alphaWarm: 1,
  gamma:    0.90,     /* A board banked now is worth more than the same board
                         banked in three moves' time, because the match can
                         end at five boards and an undecided board scores
                         nothing. Without this the agent correctly works out
                         that a board it already has locked up is safe, and
                         then never bothers to actually finish it. */
  epsStart: 1.00,
  epsEnd:   0.20,
  epsTau:   2500,     /* matches, not games */
  mixSelfPlay: 0.60,
  exploringStarts: 0.35, /* fraction of training matches that open with a run
                            of random moves. With nine boards a great many
                            board pictures — including winning ones — are
                            only ever reached down an odd line, and a
                            position it has never been rewarded on reads 0,
                            so it walks straight past a free win. Measured:
                            without this it takes 6% of its free wins, with
                            it, 96%. */
  burst: 1000,        /* a match runs ~35 moves and updates every live board
                         every move, so 1,000 matches is comparable work to
                         a 5,000-game Act I burst */
  bursts: [250, 1000, 3000]
};

function epsilonAt(matches) {
  return HP9.epsEnd + (HP9.epsStart - HP9.epsEnd) * Math.exp(-matches / HP9.epsTau);
}

/* U is indexed by code * 2 + (turn - 1). */
const USIZE = NCODE * 2;
const ui = (code, t) => code * 2 + t - 1;

function newBrain() {
  return {
    U: new Float32Array(USIZE),   /* board value to X, given whose turn it is */
    N: new Uint32Array(USIZE),
    matches: 0,
    seen: 0,
    seeded: 0,                    /* entries handed over from Act I */
    blindLookups: 0,              /* squares weighed up on a picture never seen */
    lookups: 0
  };
}

function cloneBrain(b) {
  return { U: new Float32Array(b.U), N: new Uint32Array(b.N),
           matches: b.matches, seen: b.seen, seeded: b.seeded,
           blindLookups: b.blindLookups, lookups: b.lookups };
}

/* Hand over everything Act I learned that still means something here.
   Act I's V[code] is the value to whoever just moved into `code`, and for
   a balanced position the mark counts say who that was — so it converts
   exactly into "value to X with the OTHER player to move". The entries
   that only exist with nine boards open, and the second turn value of
   every position, start at zero: unknown, and visibly so. */
function seedFromAgent(brain, agent) {
  let n = 0;
  for (let code = 1; code < NCODE; code++) {
    const t = TOMOVE[code];
    if (t === 0 || WINNER[code] === 3) continue;      /* cannot occur */
    if (agent.N[code] === 0) continue;                /* never learned */
    const x = moverOf(code) === 1 ? agent.V[code] : -agent.V[code];
    const k = ui(code, t);
    brain.U[k] = x;
    brain.N[k] = agent.N[code];
    n++;
  }
  brain.seen = n;
  brain.seeded = n;
  return n;
}

/* Value of a candidate move to the player making it. Both terms are read
   with the OPPONENT to move — see the derivation at the top of the file. */
function moveValue(brain, code, cell, mark) {
  const opp = mark === 1 ? 2 : 1;
  const d = brain.U[ui(code + mark * POW3[cell], opp)] - brain.U[ui(code, opp)];
  return mark === 1 ? d : -d;
}

/* Every move that ties for best, minus any whose resulting board picture
   it has never seen when a seen one ties with it — the same confidence
   tie-break as Act I, and the same reason: an unseen picture and a
   picture known to be even both read 0.00. */
function policyMoves(brain, m) {
  const moves = legalMoves(m), mark = m.turn, opp = mark === 1 ? 2 : 1;
  let best = -Infinity;
  const vals = moves.map(mv => {
    const v = moveValue(brain, m.b[(mv / 9) | 0], mv % 9, mark);
    if (v > best) best = v;
    return v;
  });
  const tied = moves.filter((mv, i) => vals[i] >= best - 1e-9);
  const tried = tied.filter(mv =>
    brain.N[ui(m.b[(mv / 9) | 0] + mark * POW3[mv % 9], opp)] > 0);
  return tried.length ? tried : tied;
}

function greedyMove(brain, m, rnd) {
  const t = policyMoves(brain, m);
  return t[(rnd() * t.length) | 0];
}

/* Exploration for training only, and NOT a coin flip.
 *
 * With one board, rolling a die when you want to explore is fine: there
 * are 5,478 positions and random play trips over all of them. With nine
 * boards open there are far too many, and undirected exploration leaves
 * gaps that never close — measured, on a real run: 26% of the winning
 * board pictures were still unvisited after 10,000 matches, and because
 * an unvisited picture reads 0.00, the agent walked past a free win
 * again and again in exactly those positions.
 *
 * So when it explores it goes where it knows least: the move whose
 * resulting board picture it has seen the fewest times, ties broken by
 * coin flip. Count-based exploration, and it contains no knowledge of
 * tic-tac-toe — it cannot tell a winning square from any other, only a
 * familiar one from a strange one. It is off during play. */
function exploreMove(brain, m, rnd) {
  const moves = legalMoves(m), mark = m.turn, opp = mark === 1 ? 2 : 1;
  let fewest = Infinity;
  const counts = moves.map(mv => {
    const n = brain.N[ui(m.b[(mv / 9) | 0] + mark * POW3[mv % 9], opp)];
    if (n < fewest) fewest = n;
    return n;
  });
  const rarest = moves.filter((mv, i) => counts[i] === fewest);
  return rarest[(rnd() * rarest.length) | 0];
}

function epsGreedyMove(brain, m, eps, rnd) {
  if (rnd() < eps) return exploreMove(brain, m, rnd);
  return greedyMove(brain, m, rnd);
}

function randomMove(m, rnd) {
  const mv = legalMoves(m);
  return mv[(rnd() * mv.length) | 0];
}

/* How many of the squares it is weighing up right now sit on a board
   picture it has never seen. The honest measure of "out of its depth",
   and the number that makes the transfer from Act I visible: right after
   the handover it is high, and it falls as this act trains. */
function blindFraction(brain, m) {
  const moves = legalMoves(m);
  if (!moves.length) return 0;
  const mark = m.turn, opp = mark === 1 ? 2 : 1;
  let blind = 0;
  for (const mv of moves) {
    const after = m.b[(mv / 9) | 0] + mark * POW3[mv % 9];
    if (brain.N[ui(after, opp)] === 0) blind++;
  }
  return blind / moves.length;
}

/* board pictures that can only happen with nine boards open: one player
   has moved in this board more often than alternating turns would allow */
function isImpossibleAlone(code) { return TOMOVE[code] === 0; }

/* ------------------------------------------------------------------ *
 * Training
 *
 * Act I's rule, with the turn carried explicitly. Every live board is a
 * real situation being experienced on every ply, so every live board
 * gets a backup on every ply: what this board is worth to X, given whose
 * move it is, is the best the player on move can reach from it.
 *
 * Nothing here consults the rules of winning. A finished board's value
 * arrives as a reward when a game actually finishes on it, exactly as in
 * Act I; the backup below only ever reads numbers already in the table.
 * ------------------------------------------------------------------ */

function backup(brain, code, t) {
  const U = brain.U, N = brain.N;
  const off = code * 9;
  let best = t === 1 ? -Infinity : Infinity;
  const opp = t === 1 ? 2 : 1;
  for (let c = 0; c < 9; c++) {
    if (CELLS[off + c] !== 0) continue;
    const v = U[ui(code + t * POW3[c], opp)];
    if (t === 1) { if (v > best) best = v; } else { if (v < best) best = v; }
  }
  if (best === Infinity || best === -Infinity) return;      /* no legal move */
  const k = ui(code, t);
  if (N[k] === 0) brain.seen++;
  const a = Math.max(HP9.alphaFloor, HP9.alphaWarm / (HP9.alphaWarm + N[k]));
  N[k]++;
  U[k] += a * (HP9.gamma * best - U[k]);
}

/* a board just finished: its result is the reward, and it is worth that
   whoever is to move */
function reward(brain, code, z) {
  const U = brain.U, N = brain.N;
  for (const t of [1, 2]) {
    const k = ui(code, t);
    if (N[k] === 0) brain.seen++;
    const a = Math.max(HP9.alphaFloor, HP9.alphaWarm / (HP9.alphaWarm + N[k]));
    N[k]++;
    U[k] += a * (z - U[k]);
  }
}

function playMatch(brain, rnd, mode, eps, learn, wildPlies) {
  const m = newMatch();
  let wild = wildPlies | 0;
  for (;;) {
    const brainSeat = mode === 0 || (mode === 1 && m.turn === 1) || (mode === 2 && m.turn === 2);
    const mv = (wild-- > 0) ? randomMove(m, rnd)
             : brainSeat ? epsGreedyMove(brain, m, eps, rnd) : randomMove(m, rnd);
    const board = (mv / 9) | 0, turn = m.turn;
    applyMove(m, mv);

    if (learn) {
      /* the board that changed, if it just ended */
      const r = m.r[board];
      if (r !== 0) reward(brain, m.b[board], r === 1 ? 1 : r === 2 ? -1 : 0);
      /* every board still in play, with the turn that now applies */
      const nextTurn = m.over ? (turn === 1 ? 2 : 1) : m.turn;
      for (let b = 0; b < BOARDS; b++) {
        if (m.r[b] === 0) backup(brain, m.b[b], nextTurn);
      }
      /* and the board that changed, from the mover's own turn, so the
         position they left behind is valued too */
      if (m.r[board] === 0) backup(brain, m.b[board], turn);
    }
    if (m.over) return m;
  }
}

const KEY_CAP = 400000;        /* stop growing the repeat counter here */

function trainMatches(brain, count, rnd, opts) {
  opts = opts || {};
  const sampleEvery = opts.sampleEvery | 0;
  const samples = [];
  let selfPlay = 0, vsRandom = 0, plies = 0;
  const half = HP9.mixSelfPlay + (1 - HP9.mixSelfPlay) / 2;

  for (let g = 0; g < count; g++) {
    const eps = epsilonAt(brain.matches);
    const r = rnd();
    const mode = r < HP9.mixSelfPlay ? 0 : (r < half ? 1 : 2);
    if (mode === 0) selfPlay++; else vsRandom++;
    const wild = rnd() < HP9.exploringStarts ? 1 + ((rnd() * 26) | 0) : 0;
    const m = playMatch(brain, rnd, mode, eps, true, wild);
    brain.matches++;
    plies += m.plies;
    if (sampleEvery && (g % sampleEvery) === 0) samples.push(cloneMatch(m));
  }
  return { samples, selfPlay, vsRandom, plies, eps: epsilonAt(brain.matches) };
}

/* How often does a whole-match position ever come round again? This is
   the number that decides whether a table over match positions could
   ever work, so it is measured rather than asserted. */
function measureRecurrence(brain, matches, rnd) {
  const seen = new Map();
  let positions = 0, repeats = 0;
  for (let g = 0; g < matches; g++) {
    const m = newMatch();
    const eps = epsilonAt(brain.matches);
    for (;;) {
      const k = matchKey(m);
      positions++;
      const c = seen.get(k);
      if (c !== undefined) { seen.set(k, c + 1); repeats++; }
      else if (seen.size < KEY_CAP) seen.set(k, 1);
      applyMove(m, epsGreedyMove(brain, m, eps, rnd));
      if (m.over) break;
    }
  }
  return { positions, repeats, distinct: seen.size, rate: repeats / positions };
}

/* the same measurement on one board, so the two numbers can sit side by
   side on the card */
function measureRecurrenceSingle(agent, games, rnd) {
  const seen = new Map();
  let positions = 0, repeats = 0;
  for (let g = 0; g < games; g++) {
    let code = 0;
    for (;;) {
      positions++;
      const c = seen.get(code);
      if (c !== undefined) { seen.set(code, c + 1); repeats++; } else seen.set(code, 1);
      code += TOMOVE[code] * POW3[OG.epsGreedyMove(agent, code, OG.epsilonAt(agent.games), rnd)];
      if (WINNER[code] !== 0 || NEMPTY[code] === 0) break;
    }
  }
  return { positions, repeats, distinct: seen.size, rate: repeats / positions };
}

/* ------------------------------------------------------------------ *
 * Opponents, for measurement only
 * ------------------------------------------------------------------ */

const LINES = OG.LINES;

/* A rule-based opponent, written out by hand the way a person would:
   take a win anywhere, else block a loss anywhere, else score every
   square by where it sits and what is already on its lines. Hand-written
   knowledge, which is exactly why it is worth racing a learner against
   it. Nothing in the learner ever reads this function. */
function heuristicMove(m, mark, rnd) {
  const opp = mark === 1 ? 2 : 1;
  const live = [];
  for (let b = 0; b < BOARDS; b++) if (m.r[b] === 0) live.push(b);

  for (const who of [mark, opp]) {
    for (const b of live) {
      const off = m.b[b] * 9;
      for (const L of LINES) {
        let mine = 0, empty = -1, other = 0;
        for (const i of L) {
          const v = CELLS[off + i];
          if (v === who) mine++; else if (v === 0) empty = i; else other++;
        }
        if (mine === 2 && other === 0 && empty >= 0) return b * 9 + empty;
      }
    }
  }

  let best = -Infinity, bestMove = -1;
  for (const b of live) {
    const off = m.b[b] * 9;
    for (let c = 0; c < 9; c++) {
      if (CELLS[off + c] !== 0) continue;
      let score = c === 4 ? 14 : (c === 0 || c === 2 || c === 6 || c === 8) ? 8 : 4;
      for (const L of LINES) {
        if (!L.includes(c)) continue;
        let mine = 0, theirs = 0;
        for (const i of L) {
          const v = CELLS[off + i];
          if (v === mark) mine++; else if (v === opp) theirs++;
        }
        if (theirs === 0) score += 5 + mine * 10;
        if (mine === 0) score += theirs * 6;
      }
      if (score > best) { best = score; bestMove = b * 9 + c; }
    }
  }
  if (bestMove < 0) { const mv = legalMoves(m); return mv[(rnd() * mv.length) | 0]; }
  return bestMove;
}

/* result from the brain's point of view: 1 win, 0 draw, -1 loss */
function playAgainst(brain, oppMove, rnd, brainMark) {
  const m = newMatch();
  for (;;) {
    const mv = (m.turn === brainMark) ? greedyMove(brain, m, rnd)
                                      : oppMove(m, m.turn, rnd);
    applyMove(m, mv);
    if (m.over) {
      if (m.winner === 3) return 0;
      return m.winner === brainMark ? 1 : -1;
    }
  }
}

function scoreVs(brain, oppMove, matches, rnd, brainMark) {
  let w = 0, l = 0, d = 0;
  for (let i = 0; i < matches; i++) {
    const mark = brainMark || (1 + (i % 2));
    const r = playAgainst(brain, oppMove, rnd, mark);
    if (r > 0) w++; else if (r < 0) l++; else d++;
  }
  return { wins: w, losses: l, draws: d, matches, winRate: w / matches, lossRate: l / matches };
}

const randomOpponent = (m, mark, rnd) => randomMove(m, rnd);
const vsRandom    = (brain, n, rnd, mark) => scoreVs(brain, randomOpponent, n, rnd, mark);
const vsHeuristic = (brain, n, rnd, mark) => scoreVs(brain, heuristicMove, n, rnd, mark);

/* ------------------------------------------------------------------ */

return {
  BOARDS, TO_WIN, HP9,
  newMatch, cloneMatch, applyMove, legalMoves, tally, boardOutcome, matchKey,
  newBrain, cloneBrain, seedFromAgent, moveValue, policyMoves, greedyMove,
  epsGreedyMove, randomMove, blindFraction, isImpossibleAlone, epsilonAt, ui,
  trainMatches, playMatch, backup, reward, measureRecurrence, measureRecurrenceSingle,
  heuristicMove, playAgainst, scoreVs, vsRandom, vsHeuristic
};
})(typeof OG !== 'undefined' ? OG : require('./engine.js'));

if (typeof module !== 'undefined' && module.exports) module.exports = NINE;
