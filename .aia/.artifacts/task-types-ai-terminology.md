---
id: types-ai-terminology
artifact_kind: memory
memory_class: prospective
prospective_kind: task
schema_version: 2
title: Name the three Types of AI mechanisms precisely
created: 2026-09-09T05:11:00Z
updated: 2026-09-09T05:11:00Z
author: codex
model: gpt-6-astra
model_basis: confirmed
status: executing
scope: examples
source_basis: conversation
sensitivity: normal
sanctioned_by: prose:01a08159-d0e4-7013-a510-bffe0b53d74f@2026-09-09T05:09:23.238Z
tags: [teaching, tic-tac-toe, terminology]
---

# Expected outcome

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
