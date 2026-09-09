---
id: types-ai-terminology
artifact_kind: memory
memory_class: episodic
lifecycle: complete
schema_version: 2
title: Separate model representations from learning methods and reveal neural weights
created: 2026-09-09T05:11:00Z
updated: 2026-09-09T06:03:00Z
author: codex
model: gpt-6-astra
model_basis: confirmed
status: active
scope: examples
source_basis: conversation
sensitivity: normal
tags: [teaching, tic-tac-toe, terminology]
---

# Completed outcome

Delivered A–D representation tabs, a separate unlettered learning-method view,
the GOFAI/decision-tree distinction, and a read-only connected neural-network
inspector. Its selectors expose all 1,334 weights and 47 biases from the live
29–28–18–1 network, with initialization comparisons and current-board activations.
The simplified diagram explicitly discloses sampled nodes. Negative weights use
mauve; they do not imply a failure or a bad move. Core learning algorithms remain
unchanged. Canonical presenter guide, app notes, PDF, README, SPEC and manifest
were updated together; the two-page PDF was rendered and visually inspected.

Parent Chrome checks observed actual preparation and training, changed weights,
preserved trained state across reading tabs, correct layer sizes, reset to A,
and responsive 390px/320px layouts without document overflow. Builder verifies
meaningful weight-index/read-only checks plus existing UI/gameplay/neural suites.
Publication integrates the released Claude contract pass before pushing.

Authorization: prose:01a08159-d0e4-7013-a510-bffe0b53d74f@2026-09-09T05:23:30.523Z.
The next authorized work is [[demo2-redesign]]; this completion does not end that
overnight instruction. Relates to [[types-ai-redesign]].

# Authorized outcome and lanes — 2026-09-09 05:24Z (history)

Operator settled the direction and resumed work. This section replaces the paused
brief below; retain that text only as history. Own the implementation as a single
bounded UI lane, with parent independently handling guide/PDF/docs and QA.

Primary row: 1a Symbolic AI (GOFAI), 1b Value table (tabular model), 1c Neural
Network, 1d Other model types. These compare representations of a strategy, not
an exhaustive list of AI or a ladder of learning methods. Keep labels readable
at 320px. Beneath that row, separate unlettered tabs Model in action / How they
learn. How they learn is cross-cutting, not D or a pretend game mode. Preserve
model state on switching reading panels, and preserve existing training cancel
and reset guarantees. D lists other families without showing irrelevant game
controls. Either compatible hash/navigation approach is fine; existing deep
links must still work. Use proper keyboard tabs and state semantics.

A Details explains GOFAI = Good Old-Fashioned Artificial Intelligence. An ordered
rule list is equivalent to a chain of decision tests: yes selects an action, no
continues; the tests here were written by a person. Decision trees may also be
learned, so symbolic does not mean all trees lack learning. B explicitly states
the model is a table and this demo learns it through reinforcement. C explicitly
states feedforward multilayer perceptron, supervised fitting to frozen learned
table values, backpropagation/normalized gradient update, not evolutionary search.

How they learn covers supervised, unsupervised, self-supervised, reinforcement,
semi-supervised with plain definitions and concrete examples; models and methods
are different axes and systems combine approaches. Self-play is not synonymous
with self-supervision. Supervised targets can come from another model. Also briefly
distinguish gradient-based weight adjustment from evolutionary optimization.
D covers linear/logistic models, learned decision trees, ensembles (forests and
boosting), nearest neighbors, support-vector machines, probabilistic/Bayesian
models. Mention search/planning separately as an AI problem-solving approach,
not another statistical model family. Existing A-C examples remain the focus.

C must visibly show the actual network and inspectable current weights, not a
decorative diagram. Reuse net.js exposed arrays/forward data; do not change the
learning algorithm. Current supervised model is 29 inputs -> 28 -> 18 -> 1, with
1,334 connection weights and 47 biases (1,381 parameters). Derive counts from the
actual instance. Show actual layer sizes, signed weight legend, a selectable
connection/layer or neuron with exact numeric weights and bias, and enough labels
to understand input -> hidden -> output. Distinguish weights from activations and
from goodness of a move; a positive weight is not automatically a good move.
Allow inspecting all actual weights through a matrix/list selector if the overview
omits edges for readability; disclose any simplified overview. Show initialization
versus trained values or another explicit change indicator. Update at training
checkpoints, after reset, and while changing the inspected board without mutating
the model. Unprepared state must say no network yet; no synthetic placeholder
weights. Keep selection controls keyboard/mobile usable. Prefer a composable
read-only network-view module and independent value-mapping regression tests.

UI builder owns zero-to-unbeatable/src/{template.html,styles.css,app.js}, build.js,
new src/network-view.js and src/network-view.test.js if warranted, and generated
index.html. May update existing UI/lifecycle tests for genuinely changed behavior.
No engine.js/rules.js/net.js/ultimate.js algorithm edits, other demos, hub, ACC,
guide, PDF, README or SPEC writes. Parent owns src/demo-guide.html, standalone
demo-guide.html, README.md, SPEC.md, PDF and manifest/hub/ACC. Builder signals before
final rebuild; parent will signal canonical guide ready. No descendants/browser.
Checkpoint in .aia/.data/types-ai-redesign/model-view-progress.md; commit owned
paths in new explicit-path commits, no amend. Return early if requirements are
unsound or cannot be met in lane. Return candidate-ready then commit/tests/limits.
Existing scoped coordinator reservation remains with parent. Native retained
builder route uses its existing configured model; parent verifies runtime.

# Earlier draft outcome — retained history

Implementation was paused by the operator on 2026-09-09 at approximately 05:14Z
to discuss the learning categories and whether 1b/1c offer a clear progression.
Native builder interrupted before any source edits were observed. Parent's draft
manifest and generated hub changes remain isolated and unpublished. Resume only
after the operator settles the teaching direction. The brief below is retained
as the requested draft scope, not a settled pedagogical decision.

Types of AI uses 1a Symbolic AI (GOFAI), 1b Machine Learning with Tabular
Reinforcement Learning explicitly visible, and 1c Neural Network. Details explains
Good Old-Fashioned Artificial Intelligence as the historical symbolic tradition,
with this demo's hand-written rules as a simple example. Describe the table as
tabular reinforcement learning, learning position values from practice. Both the
table and neural approaches are machine learning; the tabs are not disjoint AI
categories or a claim of inevitable historical replacement.

Additional operator instruction in this turn: 1b Details must explain supervised,
unsupervised, self-supervised, reinforcement and semi-supervised machine learning.
Use concise plain-language definitions and concrete examples. Distinguish external
target labels (supervised), finding structure without target labels (unsupervised),
targets generated from data such as masked-word prediction (self-supervised),
reward-guided action learning (reinforcement), and a mix of labeled/unlabeled
examples (semi-supervised). Explain these are not a strict five-rung ladder and
systems may combine them. Identify this table as reinforcement learning and 1c as
supervised approximation of frozen table scores; supervised targets need not be
human-authored. Prefer a dedicated 1b explanation block rather than adding a long
taxonomy to every stage. Full taxonomy belongs in Details; guide can reference it
compactly so its two-page teaching sequence remains usable.

For 1c, explain the actual feedforward multilayer perceptron and gradient-based
training in plain language. Parent inspected the live call path: newSupervised
uses 29 inputs, hidden layers of 28 and 18 ReLU units, one linear output (readout
clamped to [-1,1]); trainBatch calls update, whose hand-written backpropagation
normalizes the squared-error gradient by its output-gradient norm. It learns
frozen table estimates, not evolutionary selection. Check the implementation
yourself; old header comments describe a different default network. Exact widths
are optional in teaching prose; avoid claiming ordinary fixed-rate SGD or Adam.

# Builder lane

Reuse the existing isolated codex/types-ai-redesign worktree. Own only
zero-to-unbeatable/src/{template.html,styles.css,app.js,demo-guide.html}, generated
index.html and standalone Demo-Guide.html if that is the build's actual output,
README.md and SPEC.md. Inspect build.js for exact guide name rather than creating
a new file. Keep top tabs readable at 320px using deliberate wrapping or a short
primary label plus visible subtitle. Full machine-learning method must remain
visible. Preserve the Details drawer, guide/Settings contract and all algorithms.
Do not edit root hub/manifest, other demos, ACC files, PDF, or engine/net code.
Parent owns PDF rendering, browser QA, records, integration and push.

Back-propagate terminology through entry Guide, stage titles, Details, canonical
presenter guide and maintained docs. Preserve meaningful explanatory use of
rule-based and neural-network terms rather than blanket replacement. Keep the
two-page guide compact. No new tests for wording; run existing UI/lifecycle and
build parity checks. Rebuild from canonical sources. No descendants or browser.
Checkpoint if needed in .aia/.data/types-ai-redesign/terminology-progress.md.
Return early if the requested wording is unsound or outside this lane. Commit new
explicit-path commits (no amend) and return hash, changed paths, actual checks and
limitations. Signal source-ready so parent can render the final PDF concurrently.
