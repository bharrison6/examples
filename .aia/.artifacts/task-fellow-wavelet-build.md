---
id: fellow-wavelet-build
artifact_kind: memory
memory_class: prospective
prospective_kind: task
schema_version: 2
title: Build Wavelet Lab for the AI Fellows
created: 2026-09-08T19:37:11Z
updated: 2026-09-08T19:37:11Z
author: codex
model: gpt-6-astra
model_basis: confirmed
status: executing
scope: examples
source_basis: conversation
sensitivity: normal
sanctioned_by: prose:01a08159-d0e4-7013-a510-bffe0b53d74f@2026-09-08T19:37:11Z
tags: [ai-fellows, demos, wavelets]
---

# Wavelet Lab builder brief

User selected the best two reviewed demos for immediate parallel build, with
another eligible after one completes. Expected outcome: a polished, scientifically
checked, self-contained `wavelet-lab/` demo matching neighboring examples and
`CONTRACT.md`, with README, demo.json, teacher-guide.html/PDF, reproducible source,
and meaningful model tests. Parent owns final PDF rendering, browser QA, hub edits,
and git commits; builder supplies the guide HTML and own model/build tests.

## Owned surfaces and handoff

- Builder may write only `wavelet-lab/` and `.aia/.data/fellow-builds/wavelet-progress.md`.
- Parent owns root files, tours, shared scripts, memory, changelog, and git/index.
  Do not change branches, commit, push, install dependencies, or edit other demos.
- Keep progress and decisions incrementally in the named progress file. Other
  builder owns `ion-flight/`; report intended files to parent. No child agents.
- Return runnable paths, exact tests run/results, remaining concerns, guide path,
  concise summary. Stop and explain early if assumptions are wrong or scope becomes
  infeasible; do not force a misleading implementation.

## Bounded product and science

Read AGENTS.md, CONTRACT.md, and a neighboring demo/manifest/guide before writing.
Design for the existing MSU collection, with a compelling image reconstruction
workspace, not a landing page. Own folder title Wavelet Lab. Offline single-file
runtime; source/build may have modules. No Sites deployment or remote assets.

Teach orthonormal representation and coefficient/error tradeoffs. Provide an
eight-value worked signal with selectable Haar coefficients, then an embedded
grayscale image (procedural recognizable test scene is acceptable) with retained
coefficient budget, reconstructed image and error view. Predict → try → explain →
new-case exercise. Three well-designed built-in images/presets suffice. No uploads,
denoising, or real file-compression promises. Make the visual changes substantial.

Haar normalization `(a+b)/sqrt(2)`, `(a-b)/sqrt(2)`. Define transform order, retain
coarse component appropriately, and count coefficient budgets honestly. Numerical
error uses unclipped values; screen pixels may clip with explicit distinction.
Largest coefficient selection minimizes squared error, not guaranteed perceptual
quality. Default image small enough for immediate mobile interaction.

Independent tests: fast transform versus separately built small Haar matrix;
orthogonality/round trip/energy; omitted energy equals squared error; enumerate
small best-k subsets. Fixtures include [3,1] → coarse-only [2,2], squared error 2.
Test actual production module then bundle it verbatim/reproducibly into HTML.
Sources in optional methods view/guide: MathWorks wavelet-data-compression and
two-dimensional-wavelet-packet-analysis documentation; Murray DrRoachBio.pdf for
faculty fit. Do not imply current course assignment or faculty endorsement.

Match how-to, settings, presentation mode/notes, attribution, mobile interaction,
and teacher guide conventions. Mark browser-only manifest compliance unverified
until parent tests. Use no fake disabled controls or nonfunctional buttons.
