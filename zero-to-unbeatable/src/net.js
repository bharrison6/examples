/* =====================================================================
   Zero to Unbeatable — Step 3's other memory: a neural network

   This file exists to change ONE thing about step 3 and nothing else.

   Step 3 already learns. Its rule is Act I's rule with the turn carried
   explicitly: a board picture is worth the best thing the player to move
   can reach from it, discounted, and a finished board is worth its
   result. That rule lives in nine.js and this file does not touch it.

   What this file replaces is WHERE the answer is kept.

     the table    39,366 numbers, one per (board picture, whose turn).
                  Reading is an array index. It can only give back a
                  value for a picture somebody has already written to;
                  everything else reads 0.00, which is indistinguishable
                  from "even".

     the network  a few thousand weights. Reading is a forward pass, so
                  it has an answer for EVERY picture, including ones it
                  has never been shown. Whether that answer is any good
                  is the thing the demo measures rather than asserts.

   Both are plugged into nine.js through the same three calls — at(),
   hits(), nudge() — so the training loop, the exploration, the move
   choice, the discount and the alpha schedule are shared code. If the
   two behaved differently for any other reason, the comparison this
   step makes would be worthless.

   The architecture
   ----------------
   One hidden layer. 29 inputs -> HIDDEN rectified units -> 1 output
   squashed through tanh into [-1,1], because that is the range a value
   lives in.

   The input is the board picture and nothing else:

     27  nine cells x three states (empty / X / O), one-hot
      2  whose turn it is, one-hot

   Exactly ten of those twenty-nine are 1 and the rest are 0, always. So
   the first layer is not a matrix multiply at all -- it is ten rows of
   W1 added together, which is why this runs at demo speed in plain JS
   on a phone. No tic-tac-toe knowledge is encoded: the network is not
   told what a line is, which cells share one, or that the centre is
   special. It gets nine independent squares and a turn bit.

   The update
   ----------
   The table's update is
                    U += alpha * (target - U)
   -- move this one number a fixed fraction of the way to the target.

   The network's update is written to do exactly that to its ANSWER:

        theta += alpha * (target - y) * grad(y) / (|grad(y)|^2 + eps)

   which is normalised least-mean-squares. To first order the new output
   for this position is y + alpha*(target - y): the same fraction of the
   way to the same target, from the same alpha schedule. The difference
   is not the size of the step, it is that a table's step moves one
   entry and a network's step moves every position that shares structure
   with this one. That is the entire lesson of the step, so it is worth
   the twenty lines it takes to make the two steps genuinely comparable
   instead of approximately comparable.

   Determinism
   -----------
   Same seed, same numbers, on every device. IEEE +, -, *, / and sqrt
   are correctly rounded everywhere; Math.exp and Math.tanh are not. So
   the weights are initialised from the mulberry32 stream with uniform
   arithmetic only, the hidden units are rectifiers (a comparison and a
   multiply), and the one transcendental in the file -- the output
   tanh -- is built from the polynomial EXP that glass-box/src/engine.js
   uses for the same reason. Credit there; it is the house solution to
   this problem.
   ===================================================================== */

const NET = (function (OG) {
'use strict';

const { POW3, NCODE, CELLS, WINNER, NEMPTY } = OG;

/* ------------------------------------------------------------------ *
 * 1. Deterministic tanh
 *
 * Math.exp / Math.tanh are implementation-defined in their last bits,
 * so two browsers can disagree and a rehearsed run stops reproducing.
 * EXP is a range reduction plus a degree-12 Taylor over IEEE ops only,
 * lifted from glass-box/src/engine.js where the same problem was
 * solved for the same reason.
 * ------------------------------------------------------------------ */

const LN2 = 0.6931471805599453;
const INV_LN2 = 1.4426950408889634;
function EXP(x) {
  if (x !== x) return NaN;
  if (x > 709) return Infinity;
  if (x < -745) return 0;
  let k = x * INV_LN2;
  k = k >= 0 ? (k + 0.5) | 0 : -((-k + 0.5) | 0);
  const r = x - k * LN2;
  let p = 1 / 479001600;
  p = p * r + 1 / 39916800;
  p = p * r + 1 / 3628800;
  p = p * r + 1 / 362880;
  p = p * r + 1 / 40320;
  p = p * r + 1 / 5040;
  p = p * r + 1 / 720;
  p = p * r + 1 / 120;
  p = p * r + 1 / 24;
  p = p * r + 1 / 6;
  p = p * r + 0.5;
  p = p * r + 1;
  p = p * r + 1;
  let s = 1, b = 2, n = k < 0 ? -k : k;
  if (k < 0) b = 0.5;
  while (n > 0) { if (n & 1) s *= b; b *= b; n >>= 1; }
  return p * s;
}
function TANH(x) {
  if (x !== x) return NaN;
  if (x > 20) return 1;
  if (x < -20) return -1;
  const e = EXP(2 * x);
  return (e - 1) / (e + 1);
}

/* ------------------------------------------------------------------ *
 * 2. The input: ten ones among twenty-nine
 * ------------------------------------------------------------------ */

const NIN = 29;                 /* 27 cell one-hots + 2 turn one-hots */
const ACTIVE = 10;              /* nine cells plus the turn, always */

/* Every board picture's ten active input indices, precomputed once.
   19,683 x 9 bytes for the cells; the turn index is appended at use.
   Building this costs about a millisecond and removes the encode from
   the inner loop entirely. */
const FEAT = new Uint8Array(NCODE * 9);
(function buildFeatures() {
  for (let code = 0; code < NCODE; code++) {
    const off = code * 9;
    for (let i = 0; i < 9; i++) FEAT[off + i] = i * 3 + CELLS[off + i];
  }
})();

/* The same encoding, spelled out, for anything that wants to show a
   student what actually goes in. */
function encode(code, turn) {
  const x = new Float32Array(NIN);
  const off = code * 9;
  for (let i = 0; i < 9; i++) x[FEAT[off + i]] = 1;
  x[26 + turn] = 1;             /* 27 = X to move, 28 = O to move */
  return x;
}

/* ------------------------------------------------------------------ *
 * 3. Hyperparameters
 *
 * alphaFloor is smaller than the table's 0.60 and that is a real
 * difference, stated rather than hidden: a table entry is private, so
 * slamming it 60% of the way to a target costs nothing anybody else is
 * using. A network weight is shared by every position that touches it,
 * so a step that large makes the last position it saw the only one it
 * believes. The rule is identical; the size of the step it can afford
 * is not.
 * ------------------------------------------------------------------ */

const HPN = {
  hidden: 48,
  alphaFloor: 0.06,   /* fraction of the way to the target, per update */
  alphaWarm: 1,       /* alpha = max(floor, warm / (warm + visits)) */
  initScale: 0.35,    /* uniform init half-width for W1 */
  outScale: 0.02,     /* W2 starts near zero so a newborn is near-silent */
  eps: 1e-4,          /* NLMS denominator floor */
  seedPasses: 3,      /* passes over Act I's handover when it is fitted */
  burst: 400,         /* matches per burst; the forward passes cost more
                         than an array index, so the burst is smaller and
                         the wall clock is comparable */
  bursts: [100, 400, 1000]
};

/* ------------------------------------------------------------------ *
 * 4. The weights
 * ------------------------------------------------------------------ */

function newNet(opts) {
  opts = opts || {};
  const H = opts.hidden || HPN.hidden;
  const rnd = OG.makeRng(opts.seed == null ? 'net' : opts.seed);
  const W1 = new Float32Array(NIN * H);
  const b1 = new Float32Array(H);
  const W2 = new Float32Array(H);
  const s = HPN.initScale;
  /* Uniform, not Gaussian: a normal sampler needs a logarithm and this
     file is trying to stay inside the four arithmetic operations. */
  for (let i = 0; i < W1.length; i++) W1[i] = (2 * rnd() - 1) * s;
  for (let j = 0; j < H; j++) b1[j] = (2 * rnd() - 1) * s * 0.5;
  for (let j = 0; j < H; j++) W2[j] = (2 * rnd() - 1) * HPN.outScale;
  return { H, W1, b1, W2, b2: 0, hid: new Float32Array(H), act: new Float32Array(H) };
}

function cloneNet(n) {
  return { H: n.H, W1: new Float32Array(n.W1), b1: new Float32Array(n.b1),
           W2: new Float32Array(n.W2), b2: n.b2,
           hid: new Float32Array(n.H), act: new Float32Array(n.H) };
}

function paramCount(n) { return n.W1.length + n.b1.length + n.W2.length + 1; }

/* Forward pass. The hidden pre-activations are left in n.hid and the
   rectified ones in n.act, because the update needs both and re-running
   the forward pass to get them would double the cost of learning. */
function forward(net, code, turn) {
  const H = net.H, W1 = net.W1, b1 = net.b1, W2 = net.W2;
  const hid = net.hid, act = net.act;
  const off = code * 9;
  for (let j = 0; j < H; j++) hid[j] = b1[j];
  /* ten rows of W1, added. No multiply: every active input is 1. */
  for (let i = 0; i < 9; i++) {
    const wo = FEAT[off + i] * H;
    for (let j = 0; j < H; j++) hid[j] += W1[wo + j];
  }
  const wt = (26 + turn) * H;
  for (let j = 0; j < H; j++) hid[j] += W1[wt + j];
  let o = net.b2;
  for (let j = 0; j < H; j++) {
    const h = hid[j];
    if (h > 0) { act[j] = h; o += h * W2[j]; } else act[j] = 0;
  }
  return TANH(o);
}

/* Normalised LMS: move the OUTPUT for this position `alpha` of the way
   to `target`, by the smallest change to the weights that does it.
   Same alpha schedule, same target, same arithmetic shape as the
   table's `U += alpha * (target - U)`. The difference is what else
   moves with it. */
function update(net, code, turn, target, alpha) {
  const y = forward(net, code, turn);
  const err = target - y;
  if (err === 0) return y;
  const H = net.H, W1 = net.W1, b1 = net.b1, W2 = net.W2;
  const hid = net.hid, act = net.act;
  const s = 1 - y * y;                     /* d tanh */

  /* |grad y|^2. The ten active inputs all share one derivative per
     hidden unit, so the first-layer contribution is that derivative
     squared, eleven times over: ten weights plus the bias. */
  let sumA2 = 0, sumW2 = 0;
  for (let j = 0; j < H; j++) {
    const a = act[j];
    sumA2 += a * a;
    if (hid[j] > 0) sumW2 += W2[j] * W2[j];
  }
  const g = s * s * (1 + sumA2 + (ACTIVE + 1) * sumW2);
  const k = alpha * err / (g + HPN.eps);

  /* second layer first, so the first layer still sees the W2 that the
     gradient was computed with */
  const ks = k * s;
  net.b2 += ks;
  const d = net.act;                       /* reuse: act is finished with */
  for (let j = 0; j < H; j++) {
    const a = act[j];
    const dj = hid[j] > 0 ? ks * W2[j] : 0;
    W2[j] += ks * a;
    d[j] = dj;
    b1[j] += dj;
  }
  const off = code * 9;
  for (let i = 0; i < 9; i++) {
    const wo = FEAT[off + i] * H;
    for (let j = 0; j < H; j++) W1[wo + j] += d[j];
  }
  const wt = (26 + turn) * H;
  for (let j = 0; j < H; j++) W1[wt + j] += d[j];
  return y;
}

/* ------------------------------------------------------------------ *
 * 5. The store nine.js talks to
 *
 * nine.js reads and writes its memory through three calls and knows
 * nothing else about it. This is the network's implementation of them;
 * NINE.newBrain() is the table's. Everything else in step 3 -- the
 * discount, the exploration, the tie-break, the move arithmetic, the
 * match loop -- is one piece of code serving both.
 *
 * The visit counts stay a plain array in BOTH stores. They are not the
 * memory being compared: they are the experience log, and the
 * count-based exploration and the "never seen this" measure both read
 * them. Sharing them means the two runs explore identically, so the
 * only thing left that can differ is where the values are kept.
 * ------------------------------------------------------------------ */

const USIZE = NCODE * 2;
const ui = (code, t) => code * 2 + t - 1;

function newBrain(opts) {
  opts = opts || {};
  const net = newNet(opts);
  return {
    kind: 'net',
    net,
    N: new Uint32Array(USIZE),
    matches: 0,
    seen: 0,
    seeded: 0,
    blindLookups: 0,
    lookups: 0,
    updates: 0,
    hold: null,                 /* (code,turn) => true means never train on it */
    heldSkipped: 0,
    params: paramCount(net),
    /* Act I's handover cannot be assigned into a network, so it is shown
       the same triples and fitted to them with the same update it uses
       for everything else. It will not land on them exactly; in exchange
       it has an answer for the 33,890 entries it was never shown. */
    absorbPasses: HPN.seedPasses,
    absorb(code, t, value, n) {
      if (this.hold && this.hold(code, t)) { this.heldSkipped++; return; }
      const k = ui(code, t);
      if (this.N[k] === 0) this.seen++;
      this.N[k] = n;
      this.updates++;
      update(this.net, code, t, value, HPN.alphaFloor);
    },
    at(code, t) { return forward(this.net, code, t); },
    hits(code, t) { return this.N[ui(code, t)]; },
    nudge(code, t, target) {
      const k = ui(code, t);
      if (this.hold && this.hold(code, t)) { this.heldSkipped++; return; }
      if (this.N[k] === 0) this.seen++;
      const a = Math.max(HPN.alphaFloor, HPN.alphaWarm / (HPN.alphaWarm + this.N[k]));
      this.N[k]++;
      this.updates++;
      update(this.net, code, t, target, a);
    }
  };
}

function cloneBrain(b) {
  const c = newBrain();
  c.net = cloneNet(b.net);
  c.N = Uint32Array.from(b.N);
  c.matches = b.matches; c.seen = b.seen; c.seeded = b.seeded;
  c.blindLookups = b.blindLookups; c.lookups = b.lookups;
  c.updates = b.updates; c.hold = b.hold; c.heldSkipped = b.heldSkipped;
  c.params = b.params;
  return c;
}

/* ------------------------------------------------------------------ *
 * 6. Ground truth for one board picture, so generalisation can be
 *    measured instead of admired
 *
 * U[picture, turn] is defined by the backup in nine.js: a picture is
 * worth the best its mover can reach, and a finished board is worth its
 * result. The fixed point of that backup on an isolated board is
 * gamma^d times the minimax value of the picture with that turn to
 * move -- so the SIGN of the fixed point is exactly the minimax winner.
 *
 * That gives an answer key neither memory has ever seen, computed here
 * and used only for measurement. Nothing that plays or trains reads it.
 * It covers every picture, including the unbalanced ones that ordinary
 * tic-tac-toe cannot produce, because the turn is supplied rather than
 * inferred.
 * ------------------------------------------------------------------ */

const _truth = new Int8Array(NCODE * 2).fill(127);
function truth(code, t) {
  const k = ui(code, t);
  const cached = _truth[k];
  if (cached !== 127) return cached;
  let v;
  const w = WINNER[code];
  if (w === 1) v = 1;
  else if (w === 2) v = -1;
  else if (w === 3) v = 0;                 /* cannot occur; nothing to say */
  else if (NEMPTY[code] === 0) v = 0;
  else {
    const off = code * 9, opp = t === 1 ? 2 : 1;
    let best = t === 1 ? -2 : 2;
    for (let c = 0; c < 9; c++) {
      if (CELLS[off + c] !== 0) continue;
      const v2 = truth(code + t * POW3[c], opp);
      if (t === 1) { if (v2 > best) best = v2; } else { if (v2 < best) best = v2; }
    }
    v = best;
  }
  _truth[k] = v;
  return v;
}

/* Board pictures the demo actually cares about being right on: the
   mover has a line waiting, so a memory that reads 0.00 walks past a
   free win. */
function hasImmediateWin(code, t) {
  const off = code * 9;
  for (let c = 0; c < 9; c++) {
    if (CELLS[off + c] !== 0) continue;
    if (WINNER[code + t * POW3[c]] === t) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * 7. The held-out set
 *
 * A deterministic pseudo-random slice of (picture, turn) pairs that
 * BOTH memories are forbidden to train on. It is chosen before training
 * starts, from the seed alone, so nothing about how a run went can
 * influence what it is tested on. `nudge` and `seedFromAgent` both
 * consult it, so a held-out pair is never written by either store, and
 * its visit count stays at zero as the receipt.
 * ------------------------------------------------------------------ */

function makeHoldout(seed, fraction) {
  const h0 = OG.hashSeed('holdout:' + seed);
  const cut = Math.round((fraction == null ? 0.15 : fraction) * 4294967296);
  return function (code, t) {
    let h = (h0 ^ Math.imul(code, 0x9E3779B1)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x85EBCA6B) >>> 0;
    h = (h + Math.imul(t, 0xC2B2AE35)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0x27D4EB2F) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h < cut;
  };
}

/* The measurement the whole step is for. Over every held-out pair the
   training run actually walked into -- provably, because the visit
   count is still zero and the store refused the write -- how often does
   each memory get the sign of the answer right?
 *
 * The table's answer is 0.00 for all of them, so it scores exactly the
 * fraction of them that really are drawn and nothing more. That is not
 * a rigged comparison; it is what a lookup table does off the end of
 * what it has stored. */
function generalisation(netBrain, tableBrain, opts) {
  opts = opts || {};
  const hold = netBrain.hold;
  const winsOnly = !!opts.winsOnly;
  let n = 0, netRight = 0, tableRight = 0, netSum = 0, decisive = 0;
  const examples = [];
  for (let code = 0; code < NCODE; code++) {
    if (WINNER[code] === 3) continue;
    for (let t = 1; t <= 2; t++) {
      if (!hold(code, t)) continue;
      if (netBrain.N[ui(code, t)] !== 0) continue;      /* receipt: untouched */
      if (WINNER[code] !== 0 || NEMPTY[code] === 0) continue;  /* nothing to work out */
      if (winsOnly && !hasImmediateWin(code, t)) continue;
      const z = truth(code, t);
      const nv = netBrain.at(code, t);
      const tv = tableBrain ? tableBrain.at(code, t) : 0;
      const sg = v => (v > 0.15 ? 1 : v < -0.15 ? -1 : 0);
      n++;
      if (z !== 0) decisive++;
      if (sg(nv) === z) netRight++;
      if (sg(tv) === z) tableRight++;
      netSum += z === 0 ? -Math.abs(nv) : (z > 0 ? nv : -nv);
      if (examples.length < 12 && z !== 0 && hasImmediateWin(code, t)) {
        examples.push({ code, turn: t, truth: z, net: nv, table: tv });
      }
    }
  }
  return {
    n, decisive,
    netRight, tableRight,
    netRate: n ? netRight / n : 0,
    tableRate: n ? tableRight / n : 0,
    margin: n ? netSum / n : 0,
    examples
  };
}

/* ------------------------------------------------------------------ */

return {
  NIN, ACTIVE, HPN, USIZE, ui,
  EXP, TANH, encode, FEAT,
  newNet, cloneNet, forward, update, paramCount,
  newBrain, cloneBrain,
  truth, hasImmediateWin, makeHoldout, generalisation
};
})(typeof OG !== 'undefined' ? OG : require('./engine.js'));

if (typeof module !== 'undefined' && module.exports) module.exports = NET;
