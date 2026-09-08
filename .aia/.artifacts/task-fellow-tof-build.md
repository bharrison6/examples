---
id: fellow-tof-build
artifact_kind: memory
memory_class: prospective
prospective_kind: task
schema_version: 2
title: Build Ion Flight for the AI Fellows
created: 2026-09-08T19:37:11Z
updated: 2026-09-08T20:29:00Z
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

## Reopened teaching acceptance — user review, 2026-09-08

The user could not see meaningful units or understand what the activity teaches;
the detached questions felt incoherent and the overall experience felt cheap.
Prior scientific and mechanical test evidence stands, but it did not establish
instructional readiness. The earlier ready-to-present handoff is withdrawn for
Ion Flight. Opus was notified; shared root/tour ownership remains with Opus.

An independent fresh-context review found: complete trace and arrival answers
visible before Run; every animation normalized to 2.3 seconds; auto-scaled axes
concealing comparisons; unexplained units/symbols; an overloaded initial sample;
and a detached retry-to-mastery quiz. These are source-observed defects, separate
from subjective visual taste. The narrow TOF concept remains worthwhile.

## Authorized revision brief and acceptance

Expected outcome: one polished, coherent investigation teaching what a flight-time
detector measures, understandable without the guide. Reuse validated TOF physics.
Own only `ion-flight/` plus `.aia/.data/fellow-builds/ion-redesign-progress.md`.
No root index/README/tours, other demos, branches, commits, pushes, dependency
installation or children. Parent owns commits, browser review and PDF packaging.
Write incremental progress and return exact files/checks/limitations. Return early
if a requirement cannot support an honest lesson instead of forcing it.

### Teaching design

- Open with a concrete purpose: analyze charged particles by timing their flight.
  Define ion as an electrically charged atom or molecule. Explain the simplified
  path: voltage boost happens before timing; ions coast through a vacuum; detector
  records arrivals. Do not claim real balances cannot measure individual particles.
- Put one current experiment, its samples, prediction, run and observation in one
  workspace. Three short linked investigations: same charge/different masses;
  same mass/different positive charges; different masses/equal mass-to-charge ratio.
  Final reveal: 200 Da/+1 and 400 Da/+2 coincide, so one peak does not establish
  one kind of ion. Keep known simulated inputs distinct from detector evidence.
- Start with a simple two-ion comparison. Keep controlled conditions visible and
  stable. Use consistent sample colors/names in input cards, flight and trace.
  Explain a peak as a group of ions arriving over a range of times; decorative
  packet markers represent group centers, not exact individual trajectories.
- Spell out first-use units beside their values: dalton (Da), a mass unit for atoms
  and molecules; elementary charge e with +1/+2 charge; microsecond (µs), one
  millionth of a second; metre (m); kilovolt (kV). Use mass/charge labels rather
  than bare 200/1. Explain conventional m/z with explicit numerical example,
  distinguishing mass in Da and dimensionless charge number z. Formula goes in
  optional methods, with every symbol/unit defined.
- Run must produce observable evidence. Hide unrevealed exact arrival values and
  completed traces before the first run. Keep the current prediction and result
  together; show why the result supports or contradicts the prediction. No score
  claiming mastery from retries. A final transfer prompt should depend on the
  learned distinction and explain limits of identifying a real molecule.
- Use one fixed physical-time-to-screen-time scale for comparisons, explicit
  slow-motion factor/readout, readable labelled axes and detector arrival cues.
  Prevent normalized animation duration and implicit autozoom from hiding changes.
  Replay/change/reset must cancel prior animation; no ghost RAF loops.
- Resolution becomes an OPTIONAL advanced extension: teach spread before sigma;
  compare fixed absolute versus proportional timing widths using saved before/after
  evidence or a shared-axis paired comparison. Show numerical separation and peak
  width, define the comparison criterion and that timing widths are assumed.
  Exclude it from the core three-step lesson. No universal longer-tube promise.

### Visual and implementation quality

Design a deliberate scientific exhibit, with a dominant instrument/evidence canvas,
strong hierarchy and restrained MSU navy/gold/sky palette. Avoid a generic wall of
equal cards, giant formula card, decorative widgets, or controls disconnected from
the current investigation. On mobile keep the task/prediction with the experiment,
legible diagram/plot labels, units and keyboard-accessible controls. Follow
CONTRACT.md help/settings/presentation/notes/attribution conventions.

Keep production scientific functions and their independent fixtures intact. Lesson
data/state and animation logic should be separable and testable, with readable source
formatting. Remove obsolete quiz data if unused; its answer-key assertions are not
scientific tests. Add meaningful state/lesson tests for result gating, deterministic
setup reset, valid evidence feedback and cancellation/time-scale invariants.
Update build tests to verify actual bundled modules and scripts. README, manifest
and teacher-guide HTML must describe the new experience; parent handles updated PDF.
Retain model assumptions and specific sources. No browser automation outside the
parent's Chrome extension; no runtime assets/network/inference. Do not mark teaching
quality accepted merely because tests pass. Parent will walk the revised core cold.

## Standalone completion — 2026-09-08

Built and reviewed; production model checks, Chrome controls/mobile and guide PDF
inspection passed as recorded in [[fellow-build-verification]]. Remaining task
scope is shared hub integration by Opus; build-check packaging is complete. Offline
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
