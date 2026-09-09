# Zero to Unbeatable

Demo 1 uses one tic-tac-toe board to distinguish three real ways a program can
be intelligent. Open `index.html` in a modern browser. It is a single offline
file: no account, network request, AI service, or installation is needed.

## 1a — Rules-based intelligence

The first tab is an eight-rule if/else ladder. A person supplied every rule;
the opponent has played no games. It explains each move by naming the rule and
the squares that triggered it. The all-eight policy is checked by the same
exhaustive policy verifier used in 1b, so its unbeatable claim is a checked
property of the policy rather than a claim based on a few games.

## 1b — Machine learning

The second tab is tabular afterstate value learning. It begins as a zero-filled
array and updates one value at a time from wins, losses, draws, and opponent
replies. The app exposes its training bursts, frozen eras, values, and the
exhaustive check for any displayed table policy. This is machine learning, but
it is not a neural network: it can store a separate number for a separate
board position.

## 1c — Neural networks

The neural tab is a supervised representation experiment. Its first button
explicitly creates learning examples by training a fresh copy of the 1b
algorithm through 20,000 seeded games. That learned table is frozen. Its reachable
afterstate positions are then split into train and held-out groups, with every
rotation or reflection of a board kept in the same group. The model is a small
two-hidden-layer ReLU network with shared weights. Training updates those
weights against the frozen table labels in visible, cancellable batches.

Those labels are the fresh table’s current estimates, not perfect-game answers:
a position it did not visit can still carry its initial score of zero.

The tab reports train error and held-out error separately from a reproducible
sampled comparison: each check uses the same random seed and scoring
procedure, while game paths can change as the network changes. Mean squared
error is the average squared prediction-score error;
zero is an exact match to the frozen example. When it plays, it evaluates each legal
afterstate with its own forward pass; it does not look up the teacher table or
a solved-game answer. A held-out score is evidence about this split, not a
guarantee of generalisation. The app does not call this network unbeatable,
even when a temporary policy check looks strong.

The old Ultimate tic-tac-toe activity remains available as an optional advanced
extension from the neural tab. It is not the neural-network stage.

## Reproducibility and checks

`src/net.js` contains the model, deterministic teacher preparation,
symmetry-grouped split, bounded batch update, policy, and measurements.
`src/neural.test.js` checks deterministic preparation and updates, no duplicate
afterstate rows, split grouping, finite-difference agreement away from ReLU
kinks, no teacher consultation in play, and fixed-seed measurements.

Run:

```text
node src/playtest.test.js
node src/neural.test.js
node --test src/neural-lifecycle.test.js
node build.js --check
```

`#rules`, `#learning`, and `#neural` select the three stages while preserving
the public page URL. Settings includes presentation mode, presenter notes, and
the self-test for the selected method. Edit `src/demo-guide.html` to change the
canonical presenter guide; `node build.js` updates its standalone HTML and the
notes embedded in the demo. With Python and ReportLab installed, run
`python tools/render_guide.py --check` to check complete text extraction, then
`python tools/render_guide.py` to rebuild the PDF. Inspect both printed pages
after changes.
