/* =====================================================================
   Zero to Unbeatable — playtest suite

       node src/playtest.test.js

   Proves the four claims the demo rests on:

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

const OG = require('./engine.js');
const NINE = require('./nine.js');

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

/* ===================================================================== */
console.log('\n' + '='.repeat(64));
console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
