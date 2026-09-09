# Types of AI

Demo 1 uses one tic-tac-toe board to compare three representations of a strategy:
written rules, a table of position values, and shared neural-network weights.
It separates the kind of model from the method used to learn it. Open `index.html` in a
modern browser. It is a single offline file:
no account, network request, AI service, or installation is needed.

## Teaching sequence

The top row contains three working models and **1d Other model types**. The
unlettered **Model in action / How they learn** row beneath it separates the
model view from learning methods. These are examples, not an exhaustive AI
taxonomy or difficulty levels. **Details** opens the
current stage's evidence and technical explanation in a right-side drawer, so
the main activity keeps the question, Try/Observe/Takeaway cues, board, and
stage controls together. The drawer follows the selected era, closes with its
button, backdrop, or Escape, and returns focus to the Details button.

- **1a · Symbolic AI (GOFAI)** follows a hand-written eight-rule ladder.
  GOFAI means Good Old-Fashioned Artificial Intelligence. This ordered decision
  list can be drawn as a chain of yes/no tests in a decision tree; its tests
  were authored, whereas other decision trees can be learned from examples.
  It learns nothing from play; the policy check examines every reachable game
  line before the app calls the full ladder unbeatable. Directly above the
  ordered list, **First 2 rules**, **First 4 rules**, and **All 8 rules** choose
  how much of that visible ladder the opponent can use.
- **1b · Value table** uses tabular reinforcement learning to store estimates
  for positions after visible
  training bursts. `Show move scores` exposes those estimates. Human play does
  not train the table; only the app’s training burst updates it. The opponent
  era selector sits directly above **Train the AI** so comparing Era 0 with a
  trained era is part of the same action.
- **1c · Neural Network** first uses a fresh 20,000-game seeded table learner
  to create frozen learning examples, then trains reusable adjustable weights to
  approximate them. People still designed the board inputs and learning
  procedure. Train and held-out error show agreement with that teacher; the
  separate playing score does not turn either error into a strength guarantee.
  The actual feedforward multilayer perceptron is visible through a read-only
  network inspector. It exposes connection weights, biases and changes from
  initialization, with layer sizes derived from the current model. Backpropagation
  supplies derivatives for normalized gradient updates; this is supervised fitting
  to frozen estimates, not evolutionary optimization.
- **1d · Other model types** introduces linear/logistic models, decision trees,
  ensembles, nearest neighbors, support-vector machines and probabilistic models.
  Search/planning is described separately as a problem-solving approach.

**How they learn** compares supervised, unsupervised, self-supervised, reinforcement
and semi-supervised learning using definitions and examples. It explains how
models and learning methods can be combined, why self-play is not self-supervision,
and why a supervised target can come from another model. It also distinguishes
gradient-based updates from evolutionary optimization.

Ultimate tic-tac-toe is an optional representation-limit extension from 1c. A
network cannot recover facts absent from its inputs merely by changing weights.

## Presenter and contract surfaces

Guide opens automatically and from the header’s **Guide** button. Settings
contains **Open Presenter Notes**, **Presentation mode**, and **Reset**.
Presenter Notes and the printable guide share the canonical source
`src/demo-guide.html`; `Open printable PDF` opens the rendered handout.

`#rules`, `#learning`, and `#neural` select the three stages while preserving
the public page URL. The guide supplies a compact 20-minute sequence with a
question, activity, expected observation, and teaching limit for each stage.

## Reproducibility and checks

`src/net.js` contains deterministic teacher preparation, the grouped held-out
split, bounded updates, policy, and measurements. `src/neural.test.js` checks
deterministic preparation and updates, distinct afterstates, the grouped split,
gradient agreement away from ReLU corners, no teacher consultation in play, and
fixed-seed measurements.

Run:

```text
node src/playtest.test.js
node src/neural.test.js
node --test src/neural-lifecycle.test.js
node build.js --check
python tools/render_guide.py --check
```

Edit `src/demo-guide.html` for any presenter-guide change. `node build.js`
embeds that canonical guide in the app; the parent packaging lane renders and
inspects the PDF after the source is stable.
