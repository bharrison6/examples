---
id: launcher-tictactoe-verification
artifact_kind: reference
schema_version: 2
title: Launcher redesign and three-stage tic-tac-toe verification
created: 2026-09-09T02:55:00Z
updated: 2026-09-09T02:55:00Z
author: codex
model: gpt-6-astra
model_basis: confirmed
status: active
scope: examples
source_basis: authored
source: Production files, test output, Chrome observations, PDF render and independent native agent review
sensitivity: normal
tags: [design, teaching, neural-networks, verification]
---

# Delivered behavior

The launcher gives two starting demos prominence, pairs progress/history, and
uses a compact discipline grid. All 16 tour cards appear once; The Stranger and
Front Doors lead practical applications. Missing Time and What the Survey Missed
close the tour. Existing folder URLs, section anchors and embedded QR survive.
Concise manifest `hub_blurb` feeds cards; README retains detailed descriptions.

Demo 1 has actual 1a Rules-based intelligence, 1b Machine learning, and 1c Neural
networks tabs on the same board. Ultimate remains an optional extension. Source
guide, standalone guide, embedded notes and PDF describe this same sequence.

# Independent scientific review

Runtime-confirmed native builders: Sol High (launcher), Terra High (model/UI and
guide renderer); independent reviewer: Astra High. Parent is Astra High. Review
session `01a083fc-d207-7b02-8ef6-efdee7fb0448` independently checked all 179
parameters of a smaller fully active network: finite-difference disagreement
below 2.9e-8. Independent traversal found exactly 5,477 nonempty reachable boards;
rotation/reflection families did not cross the train/held-out split. Throwing
teacher/dataset accessors did not break play. Last-mover value perspective matched
the current engine. Unvisited winning board 18802 remains a zero estimate rather
than receiving a solver label; the guide explicitly explains this limitation.

Across three independent 50,000-update fixtures held-out MSE fell from
0.730/0.691/0.694 to 0.511/0.398/0.470. Random-opponent losses in 200 seeded games
fell from 87/116/95 to 15/14/31. These are fixture observations, not guarantees.
The default demo still has a losing line and does not claim an unbeatable network.

# Observed checks

- Production playtest: 102 passed. Neural tests passed seeded preparation/update
  replay, equivalent batched preparation, unique rows, symmetry isolation,
  gradient agreement, teacher-free play and reproducible evaluation.
- Six lifecycle regression tests passed: reset during preparation/fitting retires
  pending work; uninterrupted runs publish normally. Parent fixed the two stale
  asynchronous continuation crashes discovered by the reviewer.
- Three hub tests passed; generated hub, README, standalone guide and demo bundle
  parity checks passed. Git whitespace check passed.
- Chrome extension: desktop and 390px walkthroughs, 320px overflow check, tab
  keyboard navigation, preparation, fitting, Stop, displayed-network self-test,
  reset, optional extension and notes. Final default 50,000-update browser run:
  practiced MSE 0.703 to 0.395; held-out 0.743 to 0.518; 100-game W/D/L
  52/11/37 to 70/15/15. A stopped later run published at 152,048 updates and
  self-test confirmed that exact checkpoint. No console errors observed.
- Parent inspected both final PDF pages: 739 visible source words, two letter
  pages. ReportLab renderer checks full source text coverage. PDF is marked binary
  in Git. Phone statistics wrap into a separate explanatory row.

Direct-file/disconnected-network operation was not browser-verified in this pass;
earlier browser-policy denials were respected. Mathematical tests do not establish
faculty endorsement or measured student learning gains. No push is authorized by
this task. Integration and preservation details belong in the completion episode.
