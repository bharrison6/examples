---
id: fellow-tof-build
artifact_kind: memory
memory_class: prospective
prospective_kind: task
schema_version: 2
title: Build Ion Flight for the AI Fellows
created: 2026-09-08T19:37:11Z
updated: 2026-09-08T20:04:00Z
author: codex
model: gpt-6-astra
model_basis: confirmed
status: executing
scope: examples
source_basis: conversation
sensitivity: normal
sanctioned_by: prose:01a08159-d0e4-7013-a510-bffe0b53d74f@2026-09-08T19:37:11Z
tags: [ai-fellows, demos, mass-spectrometry]
---

# Ion Flight builder brief

## Standalone completion — 2026-09-08

Built and reviewed; production model checks, Chrome controls/mobile and guide PDF
inspection passed as recorded in [[fellow-build-verification]]. Remaining task
scope is final build-check packaging and shared hub integration by Opus. Offline
browser compliance remains explicitly unverified; static runtime audit is clean.

## Original intended build

User selected the best two reviewed demos for immediate parallel build, with
another eligible after one completes. Expected outcome: a polished, scientifically
checked, self-contained `ion-flight/` demo matching neighboring examples and
CONTRACT.md, with README, demo.json, teacher-guide.html/PDF, reproducible source,
and meaningful model tests. Parent owns PDF rendering, browser QA, and demo commits;
builder supplies guide HTML and model/build tests. Opus owns shared hub integration
after receiving the parent's contract-complete handoff (2026-09-08 coordination).

## Owned surfaces and handoff

- Builder may write only `ion-flight/` and `.aia/.data/fellow-builds/tof-progress.md`.
- Opus session `53af9ff3-b420-4ade-9e04-50c2bc8fae47` owns root index/README/tours
  and existing demos. Parent owns new-demo memory, changelog entries, and scoped commits.
  Do not change branches, commit, push, install dependencies, or edit other demos.
- Keep progress and decisions incrementally in the named progress file. Other
  builder owns `wavelet-lab/`; report intended files to parent. No child agents.
- Return runnable paths, exact tests run/results, remaining concerns, guide path,
  concise summary. Return early if the model is wrong or task becomes infeasible.

## Bounded product and science

Read AGENTS.md, CONTRACT.md, and neighboring demo/manifest/guide before writing.
Title Ion Flight. Instrument cutaway/packet animation and detector trace should
dominate; match existing MSU style, no generic landing page. Offline self-contained
runtime with no remote assets or Sites deployment. Source/build may be modular.

Teach mass-to-charge separation by drift time and conditional resolution limits.
Two/three ion packets, length/voltage/timing-spread controls, run/reset, readable
detector trace, three guided challenges with prediction and explanatory feedback.
Equal m with different z and different m with equal m/z are required cases. Include
fixed absolute versus fixed fractional timing-spread modes to show that longer
flight does not always improve resolving power. Build a constrained challenge
that cannot be won by universally dragging length to maximum. No full ion optics,
reflectrons, source simulation, fragmentation, or molecular identification.

Use ideal field-free drift after acceleration: `t=L*sqrt(m/(2*q*V))`, positive
charge magnitude, explicit SI conversion from Da and charge number. Clock excludes
acceleration time. Show speed-scaled animation with real microsecond readouts.
Use named Gaussian timing-width convention (e.g. sigma); state it beside control.
Peak areas conserve counts as width changes. Keep time trace if nonlinear density
conversion to m/z would cost clarity; if offering m/z, correctly transform bins or
density rather than relabeling uniform time bins. Units legible.

Independent tests: numeric SI fixture computed separately; length doubling doubles
time; quadruple V halves time; quadruple mass doubles time; equal m/q coincides;
fixed versus fractional width resolving-power ratios; peak area/normalization;
challenge scoring including indistinguishability. Test actual production module
and reproducibly bundle it into index.html.
Sources: https://www.cif.iastate.edu/mass-spec/ms-tutorial and Shimadzu MALDI basics.
Morris project https://digitalcommons.murraystate.edu/orcagrants/227/ supports fit,
but this is NOT his instrument or an endorsed tool. Plausible instrumental analysis
course fit, not asserted current assignment.

Match how-to, settings, presentation mode/notes, attribution, mobile interaction,
and teacher guide conventions. Mark browser-only manifest compliance unverified
until parent tests. No fake disabled controls or nonfunctional buttons.
