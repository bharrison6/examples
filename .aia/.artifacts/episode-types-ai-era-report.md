---
id: types-ai-era-report
artifact_kind: memory
memory_class: episodic
lifecycle: complete
schema_version: 2
title: Put model navigation above the activities and show selected-era learning changes inline
created: 2026-09-09T11:41:00Z
updated: 2026-09-09T12:02:00Z
author: codex
model: gpt-6-astra
model_basis: confirmed
status: active
scope: examples
source_basis: conversation
sensitivity: normal
tags: [design, teaching, ai-fellows]
---

## Completed result

Implemented in bea9534, with the following guide/packaging commit carrying the
canonical documentation and PDF. The two reading tabs now precede the four model
tabs, which hide in How they learn. The inline 1b report displays the selected
snapshot against its immediate predecessor, including before/now/delta values for
all 25 displayed legal moves. Era 0 states initialization; optional Ultimate eras
are handled without inventing tabular practice. Reading switches scroll to the
new view below the sticky header while preserving game and training state.

Parent Chrome observed two 5,000-game bursts without report popups, equality of
all Era 1 after values with Era 2 before values, exact restoration of the older
report, model-row hiding, board/report preservation, C inspector isolation,
canonical Presenter Notes and PDF links, Reset to A/All 8/Era 0, zero console
errors, and no horizontal overflow at 320px and 390px. Desktop and phone layouts
were inspected. Both updated PDF pages were rendered and visually inspected.
Parent reran 15 UI/lifecycle/network checks and build parity successfully on the
committed implementation. Builder additionally reports 102 playtest checks and
the neural suite passing. No learning-engine algorithms were changed.

## Original authorized outcome

Demo 1 (zero-to-unbeatable) places Model types / How they learn above 1a–1d.
Only Model types shows those four model choices. Reading-view switches preserve
the selected model and game/training state. Model types replaces Model in action
because these choices describe representations, not learning methods.

For 1b, replace the last-training popup with an inline panel below the training
controls, where 1a has rules and 1c has its network. Show actual recorded changes
for the selected era against its predecessor, including numeric before/after
values. Era 0 explains the untrained baseline without fabricated changes. Changing
era updates this panel; training a new era selects and displays it without a popup.
Preserve algorithms and the existing guide, settings, notes and printable contract.

## Builder lane

Worktree: isolated examples checkout on branch codex/types-ai-redesign (local
checkout location is supplied in the native dispatch message).
Owned writes: zero-to-unbeatable/src/template.html, src/styles.css, src/app.js,
src/ui-state.js when selector reuse benefits the report, appropriate UI regression
tests in src, and generated zero-to-unbeatable/index.html.
Parent owns canonical guide, README, SPEC, PDF, manifest, hub and ACC records.
Do not change other demos or learning engines. Reuse existing report rendering and
recorded snapshots. Preserve optional Ultimate behavior if it shares modal helpers.

Use native subagent dispatch, one builder, no descendants. Declare owned intent
surfaces through the configured ACC route and coordinate any active peers. Write
incremental progress to .aia/.data/types-ai-era-report/ui-progress.md. Tell parent
when the candidate is ready, run meaningful state/era and existing relevant tests,
and coordinate index ownership before a logical commit. Return commit, changed
files, observed tests and remaining issues. Return early if the framing is wrong,
impossible or senseless instead of forcing a solution.

## Integration lane

Parent updates prose and canonical guide/PDF, verifies desktop and phone behavior
in Chrome, checks committed tree and relevant suites, then publishes under the
operator's existing push authorization. No active external peer was listed at
11:40 UTC; recheck when coordinating mutations.
