/* =====================================================================
   Zero to Unbeatable — playtest suite

       node src/playtest.test.js

   Proves the claims the demo rests on:

     0. Step 1's hand-written eight-rule ladder is UNBEATABLE by the same
        exhaustive search that judges the learner, every square it picks
        satisfies the rule that picked it, and the shortened two-rule
        ladder genuinely loses -- with the line. Section 7, run last
        because the interesting checks compare it against the learner.
     1. A newborn agent is statistically indistinguishable from a coin
        flip — there is no strategy baked in anywhere.
     2. A trained agent is UNBEATABLE, established by exhaustive search
        over every reachable game line as both first and second player,
        not by playing a lot of games and not losing.
     3. It has no blind spots: 10,000 games against a uniform random
        opponent, both roles, zero losses.
     4. The pacing arc holds: era 1 is still beatable by a naive player,
        and verified unbeatability lands between bursts 3 and 5 with the
        default settings, across many seeds.

   Plus the structural checks that keep the above honest.
   ===================================================================== */

const fs = require('fs');
const path = require('path');
const OG = require('./engine.js');
const RULES = require('./rules.js');
const NINE = require('./nine.js');
const NET = require('./net.js');

let failures = 0, checks = 0;
function check(name, cond, detail) {
  checks++;
  if (cond) console.log('PASS  ' + name);
  else { console.log('FAIL  ' + name + (detail ? '\n        ' + detail : '')); failures++; }
}
function head(t) { console.log('\n' + t + '\n' + '-'.repeat(t.length)); }
const fmt = n => n.toLocaleString('en-US');

/* An independent minimax, used ONLY by this test file, to grade the
   agent against ground truth. The agent has no access to it. */
const _mm = new Map();
function minimax(code) {                       // value to the side to move
  if (_mm.has(code)) return _mm.get(code);
  let v;
  if (OG.WINNER[code] !== 0) v = -1;           // whoever just moved won
  else if (OG.NEMPTY[code] === 0) v = 0;
  else {
    const mv = OG.TOMOVE[code]; v = -Infinity;
    for (const m of OG.legalList(code)) v = Math.max(v, -minimax(OG.child(code, m, mv)));
  }
  _mm.set(code, v); return v;
}

/* the casual human: takes a win, blocks a loss, otherwise anywhere */
function blockerMove(code, rnd) {
  const mv = OG.TOMOVE[code], opp = mv === 1 ? 2 : 1, legal = OG.legalList(code);
  for (const m of legal) if (OG.WINNER[OG.child(code, m, mv)] === mv) return m;
  for (const m of legal) if (OG.WINNER[OG.child(code, m, opp)] === opp) return m;
  return legal[(rnd() * legal.length) | 0];
}

function trainTo(seed, bursts, size) {
  const rnd = OG.makeRng(seed), a = OG.newAgent();
  for (let i = 0; i < bursts; i++) OG.trainGames(a, size || OG.HP.burst, rnd);
  return a;
}

/* =====================================================================
   1. A NEWBORN IS A COIN FLIP
   ===================================================================== */
head('1. Era 0 has no strategy in it');

{
  const fresh = OG.newAgent();
  const rnd = OG.makeRng('chi-squared');

  /* chi-squared over an empty board: 9 squares, 9,000 moves */
  const s = OG.sampleMoveCounts(fresh, 0, 9000, rnd);
  const c = OG.chiSquareUniform(s.counts);
  check('empty board: 9,000 first moves are uniform (chi2 < 15.51, df 8, p=0.05)',
    c.chi2 < 15.507,
    `chi2=${c.chi2.toFixed(3)} counts=${s.counts.join(',')}`);
  console.log(`        chi2 = ${c.chi2.toFixed(3)} on ${fmt(c.n)} moves, df ${c.df}` +
              ` (critical 15.507 at p=0.05); counts ${s.counts.join(' ')}`);

  /* and from a mid-game position, where a strategy would show up loudest */
  const mid = OG.encode([1, 0, 0, 0, 2, 0, 0, 0, 1]);        // X 0,8  O 4 — O to move
  const s2 = OG.sampleMoveCounts(fresh, mid, 6000, rnd);
  const c2 = OG.chiSquareUniform(s2.counts);
  check('mid-game position: 6,000 replies are uniform (chi2 < 11.07, df 5, p=0.05)',
    c2.chi2 < 11.070, `chi2=${c2.chi2.toFixed(3)} counts=${s2.counts.join(',')}`);

  /* Behavioural proof, which is the one that really matters: a newborn
     must take a free win no more often than chance, and must block a
     threat no more often than chance. Any hidden heuristic shows here. */
  const rnd2 = OG.makeRng('behaviour');
  let winChances = 0, winsTaken = 0, blockChances = 0, blocksMade = 0;
  for (const code of OG.OPEN_POSITIONS) {
    const mv = OG.TOMOVE[code], opp = mv === 1 ? 2 : 1;
    const legal = OG.legalList(code);
    const wins = legal.filter(m => OG.WINNER[OG.child(code, m, mv)] === mv);
    const blocks = legal.filter(m => OG.WINNER[OG.child(code, m, opp)] === opp);
    if (wins.length) {
      winChances++;
      if (wins.includes(OG.greedyMove(fresh, code, rnd2))) winsTaken++;
    }
    if (!wins.length && blocks.length) {
      blockChances++;
      if (blocks.includes(OG.greedyMove(fresh, code, rnd2))) blocksMade++;
    }
  }
  /* expected rates if it is choosing uniformly */
  let expWin = 0, expBlock = 0, nW = 0, nB = 0;
  for (const code of OG.OPEN_POSITIONS) {
    const mv = OG.TOMOVE[code], opp = mv === 1 ? 2 : 1;
    const legal = OG.legalList(code);
    const wins = legal.filter(m => OG.WINNER[OG.child(code, m, mv)] === mv);
    const blocks = legal.filter(m => OG.WINNER[OG.child(code, m, opp)] === opp);
    if (wins.length) { expWin += wins.length / legal.length; nW++; }
    if (!wins.length && blocks.length) { expBlock += blocks.length / legal.length; nB++; }
  }
  const wRate = winsTaken / winChances, wExp = expWin / nW;
  const bRate = blocksMade / blockChances, bExp = expBlock / nB;
  check('newborn takes a free win only at the chance rate',
    Math.abs(wRate - wExp) < 0.03,
    `took ${(wRate * 100).toFixed(1)}% of ${fmt(winChances)} free wins, chance is ${(wExp * 100).toFixed(1)}%`);
  check('newborn blocks a threat only at the chance rate',
    Math.abs(bRate - bExp) < 0.03,
    `blocked ${(bRate * 100).toFixed(1)}% of ${fmt(blockChances)} threats, chance is ${(bExp * 100).toFixed(1)}%`);
  console.log(`        free wins taken ${(wRate * 100).toFixed(1)}% vs ${(wExp * 100).toFixed(1)}% by chance; ` +
              `threats blocked ${(bRate * 100).toFixed(1)}% vs ${(bExp * 100).toFixed(1)}% by chance`);

  check('every value in a newborn table is exactly zero',
    fresh.V.every(v => v === 0) && fresh.seen === 0);
}

/* =====================================================================
   2. UNBEATABILITY IS PROVEN, NOT SAMPLED
   ===================================================================== */
head('2. A trained agent cannot be beaten — exhaustive search');

const TRAINED = trainTo('playtest', 6);
{
  const v = OG.verifyUnbeatable(TRAINED);
  console.log(`        agent moving first : ${fmt(v.asFirst.lines)} complete game lines, ` +
              `${fmt(v.asFirst.positions)} positions examined -> ` +
              (v.asFirst.safe ? 'NO LOSING LINE EXISTS' : 'LOSING LINE FOUND'));
  console.log(`        agent moving second: ${fmt(v.asSecond.lines)} complete game lines, ` +
              `${fmt(v.asSecond.positions)} positions examined -> ` +
              (v.asSecond.safe ? 'NO LOSING LINE EXISTS' : 'LOSING LINE FOUND'));
  check('moving first: zero losses over every reachable line', v.asFirst.safe,
    v.asFirst.worstLine ? 'losing line: ' + v.asFirst.worstLine.join(' ') : '');
  check('moving second: zero losses over every reachable line', v.asSecond.safe,
    v.asSecond.worstLine ? 'losing line: ' + v.asSecond.worstLine.join(' ') : '');

  /* The search branches over the agent's whole tie set, so the proof
     covers every coin flip it could make, not one arbitrary ordering. */
  let tieSets = 0;
  for (const code of OG.OPEN_POSITIONS) if (OG.argmaxMoves(TRAINED, code).length > 1) tieSets++;
  check('the proof covers tie-breaking, not one lucky ordering', tieSets > 0,
    'positions where it picks at random between equally-valued squares: ' + tieSets);
  console.log(`        it coin-flips between equal squares in ${fmt(tieSets)} positions; ` +
              `the search follows all of them`);

  /* Ground truth: it never picks a move that turns a non-loss into a loss. */
  let blunders = 0;
  for (const code of OG.OPEN_POSITIONS) {
    const mv = OG.TOMOVE[code];
    const best = Math.max.apply(null, OG.legalList(code).map(m => -minimax(OG.child(code, m, mv))));
    if (best < 0) continue;                     // already lost, not its fault
    for (const m of OG.argmaxMoves(TRAINED, code)) {
      if (-minimax(OG.child(code, m, mv)) < 0) { blunders++; break; }
    }
  }
  check('graded against minimax: zero losing choices in any position it can face',
    blunders === 0, blunders + ' positions where it might pick a losing square');

  /* It should still WIN when a win is available — perfect defence alone
     would be a much duller opponent. */
  const rnd = OG.makeRng('wins');
  const vr = OG.vsRandom(TRAINED, 2000, rnd);
  check('it punishes bad play rather than just surviving it', vr.winRate > 0.75,
    `wins ${(vr.winRate * 100).toFixed(1)}% against a random opponent`);
}

/* =====================================================================
   3. BLIND-SPOT CHECK
   ===================================================================== */
head('3. No blind spots — 10,000 games against uniform random play');

{
  const rnd = OG.makeRng('blindspot');
  const first  = OG.vsRandom(TRAINED, 5000, rnd, 1);
  const second = OG.vsRandom(TRAINED, 5000, rnd, 2);
  check('5,000 games moving first: zero losses', first.losses === 0, JSON.stringify(first));
  check('5,000 games moving second: zero losses', second.losses === 0, JSON.stringify(second));
  console.log(`        first : ${fmt(first.wins)} wins, ${fmt(first.draws)} draws, ${first.losses} losses`);
  console.log(`        second: ${fmt(second.wins)} wins, ${fmt(second.draws)} draws, ${second.losses} losses`);

  const rnd2 = OG.makeRng('casual');
  const cas = OG.scoreVs(TRAINED, blockerMove, 10000, rnd2);
  check('10,000 games against a casual human policy: zero losses', cas.losses === 0, JSON.stringify(cas));
  console.log(`        casual human: ${fmt(cas.wins)} losses for them, ${fmt(cas.draws)} draws, ` +
              `${cas.losses} wins for them`);
}

/* =====================================================================
   4. PACING
   ===================================================================== */
head('4. Pacing — the middle of the arc exists');

{
  const SEEDS = Array.from({ length: 12 }, (_, i) => 'pace-' + i);
  const firsts = [], naiveWins = [], casualWins = [], era2Casual = [];
  for (const seed of SEEDS) {
    const rnd = OG.makeRng(seed), a = OG.newAgent();
    let first = null;
    for (let b = 1; b <= 6; b++) {
      OG.trainGames(a, OG.HP.burst, rnd);
      if (b === 1) {
        const er = OG.makeRng('e' + seed);
        naiveWins.push(OG.vsNaive(a, 600, er).losses);
        casualWins.push(OG.scoreVs(a, blockerMove, 600, er).losses);
      }
      if (b === 2) era2Casual.push(OG.scoreVs(a, blockerMove, 600, OG.makeRng('e2' + seed)).losses);
      if (first === null && OG.verifyUnbeatable(a).safe) { first = b; break; }
    }
    firsts.push(first === null ? 99 : first);
  }
  const min = Math.min(...firsts), max = Math.max(...firsts);
  check('era 1 is still beatable by a naive player (win, else random) on every seed',
    naiveWins.every(n => n > 0),
    'naive wins per 600: ' + naiveWins.join(','));
  check('era 1 is comfortably beatable by a casual player on every seed',
    casualWins.every(n => n >= 30),
    'casual wins per 600: ' + casualWins.join(','));
  check('unbeatable never arrives before burst 3', min >= 3, 'earliest burst ' + min);
  check('unbeatable always arrives by burst 5', max <= 5, 'latest burst ' + max);
  console.log(`        burst at which it becomes unbeatable, over ${SEEDS.length} seeds: ` +
              firsts.join(', ') + `  (mean ${(firsts.reduce((a, b) => a + b) / firsts.length).toFixed(2)})`);
  console.log(`        casual player beats era 1 in ` +
              `${Math.min(...casualWins)}-${Math.max(...casualWins)} games per 600, ` +
              `era 2 in ${Math.min(...era2Casual)}-${Math.max(...era2Casual)}`);

  /* Once unbeatable, it stays unbeatable — no wobbling back. */
  const rnd = OG.makeRng('stability'), a = OG.newAgent();
  let hit = null, stayed = true;
  for (let b = 1; b <= 9; b++) {
    OG.trainGames(a, OG.HP.burst, rnd);
    const safe = OG.verifyUnbeatable(a).safe;
    if (safe && hit === null) hit = b;
    if (hit !== null && !safe) stayed = false;
  }
  check('once it is unbeatable it stays unbeatable through four more bursts',
    hit !== null && stayed, 'first safe at burst ' + hit);
}

/* =====================================================================
   Structural checks
   ===================================================================== */
head('5. Structure');

{
  /* determinism under a seed */
  const a = trainTo('repeat-me', 3), b = trainTo('repeat-me', 3);
  let same = a.games === b.games && a.seen === b.seen;
  for (let i = 0; i < OG.NCODE && same; i++) if (a.V[i] !== b.V[i]) same = false;
  check('a seeded run reproduces bit for bit', same);

  const c = trainTo('a-different-seed', 3);
  let differs = false;
  for (let i = 0; i < OG.NCODE; i++) if (a.V[i] !== c.V[i]) { differs = true; break; }
  check('a different seed produces a different agent', differs);

  /* the landmark lessons, in the order the demo claims they arrive */
  const one = trainTo('landmarks', 1), full = TRAINED;
  const L = id => OG.LANDMARKS.find(x => x.id === id);
  check('after one burst it already knows to take a free win',
    OG.argmaxMoves(one, L('win').code).includes(L('win').key));
  check('after one burst it already knows to block a row',
    OG.argmaxMoves(one, L('block').code).includes(L('block').key));
  const forkKeys = [L('fork').key].concat(L('fork').keyAlso);
  check('the fork defence is the lesson that arrives late',
    OG.argmaxMoves(full, L('fork').code).every(m => forkKeys.includes(m)),
    'trained agent picks ' + OG.argmaxMoves(full, L('fork').code).join(','));
  const openSpread = (() => {
    const v = OG.moveValues(full, 0).map(x => x.value);
    return Math.max(...v) - Math.min(...v);
  })();
  check('a trained agent rates every opening square the same (they all draw)',
    openSpread < 0.05, 'spread ' + openSpread.toFixed(4));

  /* the table really is the whole agent */
  const clone = OG.cloneAgent(full);
  const r1 = OG.makeRng('x'), r2 = OG.makeRng('x');
  let identical = true;
  for (let i = 0; i < 400; i++) {
    if (OG.playAgainst(full, OG.randomMove, r1, 1 + (i % 2)) !==
        OG.playAgainst(clone, OG.randomMove, r2, 1 + (i % 2))) { identical = false; break; }
  }
  check('copying the value table copies the entire agent', identical);

  check('the table is small enough to hold every position tic-tac-toe has',
    OG.OPEN_POSITIONS.length === 4520,
    'open positions found: ' + OG.OPEN_POSITIONS.length);

  /* speed: the phone budget is checked under CPU throttling in
     tools/integration.mjs; this is the unthrottled floor */
  const t0 = Date.now();
  const timed = OG.newAgent(), tr = OG.makeRng('speed');
  OG.trainGames(timed, 5000, tr);
  const ms = Date.now() - t0;
  check('a 5,000-game burst takes under 400ms unthrottled', ms < 400, ms + 'ms');
  console.log(`        5,000 games in ${ms}ms on this machine ` +
              `(the montage is paced to ~2.4s so there is something to watch)`);
}

/* =====================================================================
   6. NINE BOARDS AT ONCE
   ===================================================================== */
head('6. Nine at once — the same method, a bigger world');

{
  /* the rules: a mark per turn on any unfinished board, finished boards
     lock, first to five boards takes the match */
  {
    const m = NINE.newMatch();
    check('a match opens with all 81 squares available', NINE.legalMoves(m).length === 81);
    /* hand X five boards */
    const rnd = OG.makeRng('rules');
    let guard = 0, decided = 0;
    while (!m.over && guard++ < 200) NINE.applyMove(m, NINE.randomMove(m, rnd));
    const t = NINE.tally(m);
    decided = t.x + t.o + t.d;
    check('a match ends at five boards or when nothing is left',
      t.x >= NINE.TO_WIN || t.o >= NINE.TO_WIN || NINE.legalMoves(m).length === 0,
      JSON.stringify(t));
    check('finished boards lock and stop accepting moves',
      NINE.legalMoves(m).every(mv => m.r[(mv / 9) | 0] === 0));
    check('boards get decided', decided >= 1, 'decided ' + decided);
  }

  /* a newborn is a coin flip over all 81 squares */
  {
    const fresh = NINE.newBrain(), rnd = OG.makeRng('nine-chi');
    const counts = new Array(81).fill(0);
    for (let i = 0; i < 8100; i++) counts[NINE.greedyMove(fresh, NINE.newMatch(), rnd)]++;
    const c = OG.chiSquareUniform(counts);
    check('a newborn nine-board brain is uniform over all 81 squares (chi2 < 101.9, df 80)',
      c.chi2 < 101.879, 'chi2=' + c.chi2.toFixed(2));
    console.log(`        chi2 = ${c.chi2.toFixed(2)} on ${fmt(c.n)} opening moves, df ${c.df}`);
  }

  /* the thing that breaks Act I's table really does happen */
  {
    const rnd = OG.makeRng('unbalanced');
    let boards = 0, impossible = 0;
    for (let g = 0; g < 200; g++) {
      const m = NINE.newMatch();
      while (!m.over) {
        NINE.applyMove(m, NINE.randomMove(m, rnd));
        for (let b = 0; b < 9; b++) { boards++; if (NINE.isImpossibleAlone(m.b[b])) impossible++; }
      }
    }
    const pct = 100 * impossible / boards;
    check('boards routinely reach shapes that cannot occur in one-board tic-tac-toe',
      pct > 20, pct.toFixed(1) + '%');
    console.log(`        ${pct.toFixed(0)}% of the board pictures met in a match are ones ` +
                `ordinary tic-tac-toe can never produce`);
  }

  /* the handover from Act I is exact where it applies, silent where it does not */
  {
    const agent = trainTo('handover', 4);
    const brain = NINE.newBrain();
    const handed = NINE.seedFromAgent(brain, agent);
    let exact = true;
    for (let code = 1; code < OG.NCODE && exact; code++) {
      if (OG.TOMOVE[code] === 0 || OG.WINNER[code] === 3 || agent.N[code] === 0) continue;
      const want = OG.moverOf(code) === 1 ? agent.V[code] : -agent.V[code];
      if (Math.abs(brain.U[NINE.ui(code, OG.TOMOVE[code])] - want) > 1e-6) exact = false;
    }
    check('every entry Act I hands over converts exactly', exact);
    check('the handover covers only a small slice of what this game needs',
      handed / (OG.NCODE * 2) < 0.2,
      `${fmt(handed)} of ${fmt(OG.NCODE * 2)} = ${(100 * handed / (OG.NCODE * 2)).toFixed(0)}%`);
    console.log(`        handed over ${fmt(handed)} of ${fmt(OG.NCODE * 2)} entries ` +
                `(${(100 * handed / (OG.NCODE * 2)).toFixed(0)}%)`);
  }

  /* train it, then hold it to the same standards Act I met */
  const A1 = trainTo('nine-actone', 4);
  const B9 = NINE.newBrain();
  NINE.seedFromAgent(B9, A1);
  const t0 = Date.now();
  const nrnd = OG.makeRng('nine-train');
  for (let i = 0; i < 5; i++) NINE.trainMatches(B9, NINE.HP9.burst, nrnd);
  const trainMs = Date.now() - t0;
  check('five bursts of nine-board training run in under three seconds', trainMs < 3000, trainMs + 'ms');
  console.log(`        ${fmt(5 * NINE.HP9.burst)} matches in ${trainMs}ms`);

  {
    /* behaviour, judged against a sane opponent rather than a random one:
       against random play, boards fill with several threats at once and
       "did it block" stops being a fair question */
    const rnd = OG.makeRng('behaviour9');
    let winChance = 0, winTaken = 0, blockChance = 0, blockMade = 0;
    const lines = (m, who) => {
      const out = new Set();
      for (let b = 0; b < 9; b++) {
        if (m.r[b] !== 0) continue;
        const off = m.b[b] * 9;
        for (const L of OG.LINES) {
          let mine = 0, other = 0, empty = -1;
          for (const i of L) {
            const v = OG.CELLS[off + i];
            if (v === who) mine++; else if (v === 0) empty = i; else other++;
          }
          if (mine === 2 && other === 0 && empty >= 0) out.add(b * 9 + empty);
        }
      }
      return Array.from(out);
    };
    for (let g = 0; g < 300; g++) {
      const m = NINE.newMatch(), seat = 1 + (g % 2);
      while (!m.over) {
        if (m.turn === seat) {
          const w = lines(m, seat), bl = lines(m, seat === 1 ? 2 : 1);
          const mv = NINE.greedyMove(B9, m, rnd);
          if (w.length && !bl.length) { winChance++; if (w.includes(mv)) winTaken++; }
          if (!w.length && bl.length === 1) { blockChance++; if (bl.includes(mv)) blockMade++; }
          NINE.applyMove(m, mv);
        } else NINE.applyMove(m, NINE.heuristicMove(m, m.turn, rnd));
      }
    }
    check('it takes a free win when nothing is more urgent',
      winChance === 0 || winTaken / winChance > 0.9,
      `${winTaken} of ${winChance}`);
    check('it blocks a single threat every time',
      blockMade / blockChance > 0.98, `${blockMade} of ${blockChance}`);
    console.log(`        free wins taken ${winTaken}/${winChance}, ` +
                `single threats blocked ${blockMade}/${blockChance}`);
  }

  {
    const rnd = OG.makeRng('nine-eval');
    const cpu = NINE.vsHeuristic(B9, 400, rnd);
    const rand = NINE.vsRandom(B9, 200, rnd);
    check('it stops losing to the hand-written rule-based opponent',
      cpu.losses === 0, JSON.stringify(cpu));
    check('it beats a random player almost every time', rand.winRate > 0.9, JSON.stringify(rand));
    console.log(`        vs hand-written rules: ${cpu.wins} won, ${cpu.draws} drawn, ${cpu.losses} lost of 400`);
    console.log(`        vs random play:          ${rand.wins} won, ${rand.draws} drawn, ${rand.losses} lost of 200`);
  }

  {
    /* the headline: a table only works if the same page comes round again */
    const r9 = NINE.measureRecurrence(B9, NINE.HP9.burst, OG.makeRng('rec9'));
    const r1 = NINE.measureRecurrenceSingle(A1, OG.HP.burst, OG.makeRng('rec1'));
    const per9 = r9.positions / r9.distinct, per1 = r1.positions / r1.distinct;
    check('on one board, positions come round again and again', per1 > 5, per1.toFixed(2) + '×');
    check('on nine boards, essentially nothing comes round twice', per9 < 1.3, per9.toFixed(2) + '×');
    check('the gap between the two is the whole lesson', per1 / per9 > 4,
      `${per1.toFixed(1)}x vs ${per9.toFixed(2)}x`);
    console.log(`        one board : ${fmt(r1.positions)} positions met, ${fmt(r1.distinct)} different, ` +
                `each seen ${per1.toFixed(1)}× on average`);
    console.log(`        nine boards: ${fmt(r9.positions)} positions met, ${fmt(r9.distinct)} different, ` +
                `each seen ${per9.toFixed(2)}× on average`);
  }

  {
    const a = NINE.newBrain(), b = NINE.newBrain();
    NINE.trainMatches(a, 300, OG.makeRng('same'));
    NINE.trainMatches(b, 300, OG.makeRng('same'));
    let same = a.seen === b.seen;
    for (let i = 0; i < a.U.length && same; i++) if (a.U[i] !== b.U[i]) same = false;
    check('a seeded nine-board run reproduces bit for bit', same);
  }

  check('there is no unbeatability proof on offer for nine boards',
    typeof NINE.verifyUnbeatable === 'undefined',
    'a proof would be a lie here — the space cannot be searched');
}

/* =====================================================================
   6b. THE SAME RULE, A DIFFERENT MEMORY

   Step 3 ships two memories: a table of 39,366 numbers and a neural
   network of 1,777 weights. The demo's whole claim is that they differ
   in exactly one respect -- where the value is kept -- and that the
   network can answer about board pictures nobody ever showed it.

   Both halves of that are checked here, and so is the uncomfortable
   half: at the budget the demo actually runs, the network is the WORSE
   PLAYER. If that ever stops being true this check fails and the prose
   has to be rewritten, which is exactly why it is pinned.
   ===================================================================== */
head('6b. The same rule, a different memory');

{
  /* ---- the seam is real, not a caption ---- */
  /* Comments are stripped before any of these are read: the claim is
     about the CODE, and a file that only discussed the seam in its
     header would pass a check made against its own prose. */
  const decomment = f => fs.readFileSync(path.join(__dirname, f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  {
    const src = decomment('nine.js');
    check('nine.js never names the network -- it is handed a memory, not a kind',
      !/\bNET\b|net\.js/.test(src));
    const body = src.slice(src.indexOf('function moveValue'));
    check('nothing below the store reaches past at() / hits() / nudge() into a raw array',
      !/brain\.(U|N)\[/.test(body), 'a direct array access would be a second difference');
    const table = NINE.newBrain(), net = NET.newBrain();
    const api = ['at', 'hits', 'nudge', 'absorb'];
    check('both memories implement the same four calls',
      api.every(k => typeof table[k] === 'function' && typeof net[k] === 'function'));
  }

  /* ---- the update really is the table's update, in output space ---- */
  {
    const net = NET.newNet({ seed: 'gradcheck' });
    let worst = 0;
    const rnd = OG.makeRng('gradcheck');
    for (let i = 0; i < 500; i++) {
      const code = (rnd() * OG.NCODE) | 0, t = 1 + (i % 2);
      const target = (i % 3) - 1, alpha = 0.1;
      const before = NET.forward(net, code, t);
      NET.update(net, code, t, target, alpha);
      const after = NET.forward(net, code, t);
      worst = Math.max(worst, Math.abs(after - (before + alpha * (target - before))));
    }
    check('one update moves the network answer alpha of the way to the target, exactly as ' +
      'the table update does', worst < 0.05, 'worst deviation ' + worst.toExponential(2));
    console.log(`        worst deviation from  y += alpha*(target-y):  ${worst.toExponential(2)}`);
  }

  /* ---- a newborn network ---- */
  {
    const net = NET.newBrain();
    let worst = 0;
    for (let c = 0; c < OG.NCODE; c += 7) worst = Math.max(worst, Math.abs(net.at(c, 1)));
    check('a newborn network answers about 0.00 everywhere, as a newborn table does',
      worst < 0.05, 'largest newborn value ' + worst.toFixed(3));
    check('but not IDENTICALLY zero -- a network is born with preferences it did not earn',
      net.at(0, 1) !== net.at(1, 1),
      'if these matched, the honest note in the guide would be wrong');
  }

  /* ---- determinism ---- */
  {
    const a = NET.newBrain({ seed: 'same' }), b = NET.newBrain({ seed: 'same' });
    NINE.trainMatches(a, 60, OG.makeRng('rep'));
    NINE.trainMatches(b, 60, OG.makeRng('rep'));
    let same = true;
    for (let i = 0; i < a.net.W1.length && same; i++) if (a.net.W1[i] !== b.net.W1[i]) same = false;
    for (let i = 0; i < a.net.W3.length && same; i++) if (a.net.W3[i] !== b.net.W3[i]) same = false;
    check('a seeded network run reproduces bit for bit', same);
    check('the network uses none of the maths browsers round differently',
      !/Math\.(exp|log|tanh|pow|sin|cos|atan|asin|acos|cbrt|hypot)\b/.test(decomment('net.js')),
      'Math.exp/log/tanh are implementation-defined in their last bits; ' +
      'the four operations and sqrt are not');
  }

  /* ---- the answer key is independent of both memories ---- */
  {
    let agree = 0, tested = 0, bad = 0;
    for (let code = 0; code < OG.NCODE; code += 3) {
      const t = OG.TOMOVE[code];
      if (t === 0 || OG.WINNER[code] !== 0 || OG.NEMPTY[code] === 0) continue;
      /* where both are defined -- a balanced board -- the answer key must
         agree with this file's own minimax, which knows nothing of net.js */
      const want = t === 1 ? minimax(code) : -minimax(code);   // to X
      tested++;
      if (NET.truth(code, t) === want) agree++; else bad++;
    }
    check('the held-out answer key agrees with an independent minimax wherever both are defined',
      bad === 0, `${agree} of ${tested}`);
    console.log(`        answer key checked against this file's own minimax on ${fmt(tested)} positions`);
  }

  /* ---- the held-out set is genuinely never written ---- */
  const A1 = trainTo('net-actone', 4);
  const exp = NET.experiment(NINE, A1, { seed: 'demo', matches: NET.HPN.burst });
  {
    const hold = NET.makeHoldout('demo');
    let leaked = 0, held = 0;
    for (let code = 0; code < OG.NCODE; code++) {
      for (let t = 1; t <= 2; t++) {
        if (!hold(code, t)) continue;
        held++;
        if (exp.table.U[NET.ui(code, t)] !== 0) leaked++;
      }
    }
    check('every held-out picture is still exactly as the table was born -- nothing leaked in',
      leaked === 0, leaked + ' of ' + held + ' had been written');
    check('and both memories refused the same writes, in quantity',
      exp.refusals.table > 1000 && exp.refusals.net > 1000, JSON.stringify(exp.refusals));
    console.log(`        ${fmt(held)} held-out entries; ${fmt(exp.refusals.table)} table writes ` +
                `and ${fmt(exp.refusals.net)} network writes refused`);
  }

  /* ---- THE RESULT ---- */
  {
    const g = exp.all, w = exp.wins;
    check('the network is right about held-out pictures far more often than the table',
      g.netRate > 0.6 && g.netRate > g.tableRate + 0.4,
      `network ${(100 * g.netRate).toFixed(1)}%, table ${(100 * g.tableRate).toFixed(1)}%`);
    /* the table's score is not a number it earned: it answers 0.00 to
       every held-out picture, so it is right exactly on the drawn ones */
    const drawn = (g.n - g.decisive) / g.n;
    check('the table score is exactly the share of held-out pictures that are drawn -- it ' +
      'answered 0.00 to all of them', Math.abs(g.tableRate - drawn) < 1e-9,
      `${g.tableRate.toFixed(6)} vs ${drawn.toFixed(6)}`);
    check('on held-out pictures with a win waiting, the table scores nothing at all',
      w.tableRate === 0 && w.netRate > 0.6,
      `network ${(100 * w.netRate).toFixed(1)}%, table ${(100 * w.tableRate).toFixed(1)}%`);
    console.log(`        ${fmt(g.n)} held-out pictures (${(100 * g.decisive / g.n).toFixed(0)}% decisive): ` +
                `network ${(100 * g.netRate).toFixed(1)}% right, table ${(100 * g.tableRate).toFixed(1)}%`);
    console.log(`        ${fmt(w.n)} of them have a win waiting: ` +
                `network ${(100 * w.netRate).toFixed(1)}%, table ${(100 * w.tableRate).toFixed(1)}%`);
  }

  /* ---- and the part the demo must not dress up ---- */
  {
    const T = NINE.newBrain(); NINE.seedFromAgent(T, A1);
    const N9 = NET.newBrain({ seed: 'strength' }); NINE.seedFromAgent(N9, A1);
    NINE.trainMatches(T, NINE.HP9.burst * 3, OG.makeRng('str'));
    const t0 = Date.now();
    NINE.trainMatches(N9, NET.HPN.burst, OG.makeRng('str'));
    const netMs = Date.now() - t0;
    const ct = NINE.vsHeuristic(T, 200, OG.makeRng('sc'));
    const cn = NINE.vsHeuristic(N9, 200, OG.makeRng('sc'));
    check('the network is the WORSE PLAYER at the budget the demo runs, and the page says so',
      cn.losses > ct.losses,
      `table lost ${ct.losses}, network lost ${cn.losses} -- if this flips, rewrite the prose`);
    check('a network burst still fits the demo idiom of a few seconds',
      netMs < 6000, netMs + 'ms for ' + NET.HPN.burst + ' matches');
    check('the network still beats a random player',
      NINE.vsRandom(N9, 100, OG.makeRng('sr')).winRate > 0.85);
    console.log(`        vs the hand-written rules, of 200: table lost ${ct.losses}, ` +
                `network lost ${cn.losses}`);
    console.log(`        ${fmt(NET.HPN.burst)} network matches in ${netMs}ms ` +
                `(${fmt(N9.params)} weights against ${fmt(OG.NCODE * 2)} table slots)`);
  }

  /* ---- WHERE the network falls down, pinned so the explanation cannot
         quietly become wrong.

     The demo's account of why the network plays worse is specific: it is
     not that the network is too small to hold the answer, and not that
     the update is the wrong one. It is that self-play cannot DRIVE this
     memory to the precision the move rule needs, because a move is
     chosen by subtracting two values and the errors do not cancel.

     That account only stands if the same network, shown the answers
     outright, does markedly better than the same network left to work
     them out. So: fit it to the answer key with the SAME update, and
     measure the gap. ---- */
  {
    const items = [];
    for (let code = 0; code < OG.NCODE; code++) {
      if (OG.WINNER[code] === 3) continue;
      for (let t = 1; t <= 2; t++) items.push([code, t, NET.truth(code, t)]);
    }
    const rms = (b) => {
      let e = 0;
      for (const [c, t, z] of items) { const d = b.at(c, t) - z; e += d * d; }
      return Math.sqrt(e / items.length);
    };

    /* self-play, the way the demo trains it */
    const played = NET.newBrain({ seed: 'gap' });
    NINE.seedFromAgent(played, A1);
    NINE.trainMatches(played, NET.HPN.burst * 4, OG.makeRng('gap'));

    /* the same network, same update, same alpha — just shown the answers */
    const shown = NET.newBrain({ seed: 'gap' });
    for (let i = 0; i < shown.N.length; i++) shown.N[i] = 1;
    const rnd = OG.makeRng('gap-fit');
    const idx = items.map((_, i) => i);
    for (let e = 0; e < 25; e++) {
      for (let i = idx.length - 1; i > 0; i--) {
        const j = (rnd() * (i + 1)) | 0; const q = idx[i]; idx[i] = idx[j]; idx[j] = q;
      }
      for (const i of idx) {
        const [c, t, z] = items[i];
        NET.update(shown.net, c, t, z, NET.HPN.alphaFloor);
      }
    }

    const rPlayed = rms(played), rShown = rms(shown);
    check('the network is not too small to hold the answer — shown it outright, the same ' +
      'weights fit it far better than self-play ever gets them to',
      rShown < rPlayed * 0.75,
      `self-play ${rPlayed.toFixed(3)}, shown the answers ${rShown.toFixed(3)}`);
    check('so the gap the demo explains is a LEARNING gap, not a capacity one',
      rShown < 0.25 && rPlayed > 0.3,
      `shown ${rShown.toFixed(3)}, self-play ${rPlayed.toFixed(3)}`);
    console.log(`        error against the answer key — self-play ${rPlayed.toFixed(3)}, ` +
                `same network shown the answers ${rShown.toFixed(3)}`);
  }

  check('there is no unbeatability proof on offer for the network either',
    typeof NET.verifyUnbeatable === 'undefined' && typeof NET.verify === 'undefined',
    'nine boards cannot be searched, whichever memory is behind the values');
}

/* =====================================================================
   7. STEP 1 — THE HAND-WRITTEN RULE LADDER

   The demo's first step, tested last because the interesting claims are
   comparisons against the learned agent above.

   The claim being made on screen is symmetric and it has to be earned
   on both sides: a ladder a person wrote and a table that taught itself
   arrive at the same unbeatable play, and the SAME exhaustive search
   says so about both. So the first thing checked here is that
   generalising the search did not change what it says about the learned
   agent, and the rest is the ladder held to that same standard.
   ===================================================================== */
head('7. Step 1 — the hand-written rules');

{
  /* ---- the search was generalised; the learned side must not move ---- */
  const viaAgent  = OG.verifyUnbeatable(TRAINED);
  const viaPolicy = OG.verifyPolicy(code => OG.argmaxMoves(TRAINED, code));
  check('generalising the verifier left the learned agent\'s proof identical',
    viaAgent.safe === viaPolicy.safe && viaAgent.lines === viaPolicy.lines &&
    viaAgent.positions === viaPolicy.positions,
    JSON.stringify({ agent: viaAgent.lines, policy: viaPolicy.lines }));

  /* ---- every rule fires somewhere, and only where it should ---- */
  const seen = new Array(9).fill(0);
  const wrong = [];
  for (const code of OG.OPEN_POSITIONS) {
    const d = RULES.decide(code, 8);
    const mine = OG.TOMOVE[code], theirs = mine === 1 ? 2 : 1;
    const cells = OG.cellsOf(code);
    seen[d.ruleId]++;
    for (const o of d.options) {
      const c = o.cell;
      let ok;
      switch (d.ruleId) {
        /* the rule's own definition, restated independently of the
           implementation that chose the square */
        case 1: ok = OG.WINNER[OG.child(code, c, mine)] === mine; break;
        case 2: ok = OG.WINNER[OG.child(code, c, theirs)] === theirs; break;
        case 3: ok = RULES.threatSquares(OG.child(code, c, mine), mine).length >= 2; break;
        case 4: ok = RULES.forkCells(code, theirs).some(f => f.cell === c) ||
                     RULES.threatSquares(OG.child(code, c, mine), mine).length === 1; break;
        case 5: ok = c === 4 && cells[4] === 0; break;
        case 6: ok = RULES.CORNERS.includes(c) && cells[c] === 0 &&
                     cells[RULES.OPPOSITE[c]] === theirs; break;
        case 7: ok = RULES.CORNERS.includes(c) && cells[c] === 0; break;
        case 8: ok = RULES.SIDES.includes(c) && cells[c] === 0; break;
        default: ok = false;                       // rule 0 must never fire at full depth
      }
      /* and the ladder is a ladder: nothing below fires while
         something above still applies */
      if (d.ruleId > 1 && RULES.winningCells(code, mine).length) ok = false;
      if (d.ruleId > 2 && RULES.winningCells(code, theirs).length) ok = false;
      if (!ok) wrong.push(`rule ${d.ruleId} chose ${c} in ${code}`);
    }
  }
  check('every square the ladder picks satisfies the rule that picked it',
    wrong.length === 0, wrong.slice(0, 5).join('; '));
  check('all eight rules actually fire somewhere on a reachable board',
    seen.slice(1).every(n => n > 0), 'firings per rule: ' + seen.slice(1).join(','));
  check('at full depth the ladder never runs out of rules',
    seen[0] === 0, seen[0] + ' positions fell off the end');
  console.log('        positions decided by each rule 1-8: ' + seen.slice(1).join(', '));

  /* The hardest rule, checked against a fact this repo already knew.
     LANDMARKS says the double-corner opening is only survivable on an
     edge; the ladder gets there by a completely different route, so the
     two agreeing is a real cross-check rather than a restatement. */
  const fork = OG.LANDMARKS.find(x => x.id === 'fork');
  const edges = [fork.key].concat(fork.keyAlso).sort((a, b) => a - b);
  check('rule 4 answers the double-corner opening on exactly the four edges',
    RULES.moves(fork.code, 8).slice().sort((a, b) => a - b).join(',') === edges.join(','),
    'ladder picks ' + RULES.moves(fork.code, 8).join(',') + ', landmark says ' + edges.join(','));

  /* ---- the eight-rule ladder is unbeatable, by the same search ---- */
  const r8 = RULES.report(8);
  console.log(`        eight rules moving first : ${fmt(r8.asFirst.lines)} complete game lines -> ` +
              (r8.asFirst.safe ? 'NO LOSING LINE EXISTS' : 'LOSING LINE FOUND'));
  console.log(`        eight rules moving second: ${fmt(r8.asSecond.lines)} complete game lines -> ` +
              (r8.asSecond.safe ? 'NO LOSING LINE EXISTS' : 'LOSING LINE FOUND'));
  check('eight rules moving first: zero losses over every reachable line', r8.asFirst.safe);
  check('eight rules moving second: zero losses over every reachable line', r8.asSecond.safe);
  check('nobody can win against the full ladder, worked out exactly',
    r8.beatsFirst === 0 && r8.beatsSecond === 0,
    `${r8.beatsFirst} / ${r8.beatsSecond}`);

  /* Graded against minimax, exactly as the learned agent is above -- and
     this is where the two genuinely differ, so it is worth being exact
     about what each one earns.

     Every position the ladder can actually arrive at in a game: it is
     right in all of them, which is the same thing verifyPolicy said,
     arrived at from ground truth instead. */
  const reachable = new Set();
  for (const botMark of [1, 2]) {
    const stack = [0], seen = new Set();
    while (stack.length) {
      const c = stack.pop();
      if (seen.has(c)) continue;
      seen.add(c);
      if (OG.isTerminal(c)) continue;
      const mv = OG.TOMOVE[c];
      if (mv === botMark) reachable.add(c);
      for (const m of (mv === botMark ? RULES.moves(c, 8) : OG.legalList(c))) {
        stack.push(OG.child(c, m, mv));
      }
    }
  }
  const gradeBlunders = movesFor => {
    const out = [];
    for (const code of OG.OPEN_POSITIONS) {
      const mv = OG.TOMOVE[code];
      const best = Math.max.apply(null, OG.legalList(code).map(m => -minimax(OG.child(code, m, mv))));
      if (best < 0) continue;                    // already lost, not its fault
      for (const m of movesFor(code)) {
        if (-minimax(OG.child(code, m, mv)) < 0) { out.push(code); break; }
      }
    }
    return out;
  };
  const ladderBad = gradeBlunders(c => RULES.moves(c, 8));
  check('graded against minimax: the ladder never picks a losing square in a game it is playing',
    ladderBad.every(c => !reachable.has(c)),
    ladderBad.filter(c => reachable.has(c)).length + ' reachable positions where a rule loses');

  /* And the honest asymmetry, which the README states and which this
     pins down so it cannot rot: hand the ladder a position it would
     never have played itself into and it CAN blunder, because nobody
     wrote a rule for a board that cannot happen. The learned agent
     practises from positions dealt at random, so it is right in all
     4,520. Neither fact changes who wins a game from the start. */
  const learnedBad = gradeBlunders(c => OG.argmaxMoves(TRAINED, c));
  check('the ladder is unbeatable in a game but not correct in every position',
    ladderBad.length === 12 && ladderBad.every(c => !reachable.has(c)),
    ladderBad.length + ' positions, none of them reachable');
  check('the learned agent is correct in every position, reachable or not',
    learnedBad.length === 0, learnedBad.length + ' positions');
  console.log(`        minimax grading over all ${fmt(OG.OPEN_POSITIONS.length)} legal positions: ` +
              `ladder wrong in ${ladderBad.length} (none reachable in play), ` +
              `learned agent wrong in ${learnedBad.length}`);

  /* ---- and the two-rule ladder genuinely loses ---- */
  const r2 = RULES.report(2);
  check('two rules is beatable — the same search finds losing lines in both roles',
    !r2.asFirst.safe && !r2.asSecond.safe);
  check('two rules loses often enough for a room to notice',
    r2.beatsSecond > 0.9 && r2.beatsFirst > 0.4,
    `beaten ${(r2.beatsSecond * 100).toFixed(1)}% moving second, ` +
    `${(r2.beatsFirst * 100).toFixed(1)}% moving first`);

  /* Replay the line the app puts on screen and confirm it does what the
     screen says: the bot loses, and the move that kills it is a fork,
     which is rule 3/4 territory and switched off. */
  const g = r2.gameSecond;
  let code = 0, forks = 0;
  for (const p of g.plies) {
    if (p.bot) {
      const opts = RULES.moves(code, 2);
      if (!opts.includes(p.cell)) { code = -1; break; }
    }
    code = OG.child(code, p.cell, p.mark);
    if (p.forks) forks++;
  }
  check('the losing line the app shows is one the two-rule ladder can really play',
    code >= 0 && OG.WINNER[code] === 1, 'winner ' + (code >= 0 ? OG.WINNER[code] : 'illegal line'));
  check('and the move that beats it is a fork — the rule that is switched off',
    forks === 1, forks + ' forking moves in the line');
  console.log('        the line: ' + g.plies.map(p => (p.bot ? 'it' : 'you') + ' ' + p.cell).join(', ') +
              ` (this exact game about 1 in ${Math.round(1 / g.prob)})`);

  /* ---- seeded, like everything else in this demo ---- */
  const play = seed => {
    const rnd = OG.makeRng(seed), out = [];
    let c = 0;
    while (!OG.isTerminal(c)) {
      const mv = OG.TOMOVE[c];
      const cell = RULES.ruleMove(c, rnd, 7);   // depth 7 leaves real tie sets
      out.push(cell);
      c = OG.child(c, cell, mv);
    }
    return out.join(',');
  };
  check('a seeded rule game reproduces exactly', play('same') === play('same'));
  check('a different seed breaks a different tie', play('same') !== play('other'),
    'both seeds played ' + play('same'));

  /* ---- the shape of the ladder the UI renders ---- */
  check('the ladder is eight rules and the app renders that list, not a copy',
    RULES.LADDER.length === 8 && RULES.LADDER.every((r, i) => r.id === i + 1));
  check('every depth preset offered in the app is one the search has an answer for',
    RULES.DEPTHS.every(d => typeof RULES.report(d.n).safe === 'boolean'));

  /* The README says rule 8 is the list being tidy: by the time "empty
     side" could fire, a side is the only thing left to play, so seven
     rules and eight rules are the same opponent. Pin it. */
  let sameAt7 = true;
  for (const code of OG.OPEN_POSITIONS) {
    if (RULES.moves(code, 7).join(',') !== RULES.moves(code, 8).join(',')) { sameAt7 = false; break; }
  }
  check('seven rules and eight rules are the same opponent — rule 8 is the list being tidy',
    sameAt7 && RULES.report(7).safe);

  /* ---- the numbers quoted in the prose are the numbers in the code ---- */
  const docs = ['README.md', 'src/demo-guide.html']
    .map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
  const quoted = [
    [fmt(r8.lines), 'complete game lines against the full ladder'],
    [fmt(r2.lines), 'complete game lines against the two-rule ladder'],
    [(r2.beatsSecond * 100).toFixed(0) + '%', 'how often best play beats two rules']
  ];
  const missing = quoted.filter(([n]) => !docs.includes(n)).map(([n, what]) => `${n} (${what})`);
  check('the counts written in README.md and the guide match the code',
    missing.length === 0, 'not found in the prose: ' + missing.join(', '));
}

/* ===================================================================== */
console.log('\n' + '='.repeat(64));
console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
