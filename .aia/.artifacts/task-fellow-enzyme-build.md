---
id: fellow-enzyme-build
artifact_kind: memory
memory_class: prospective
prospective_kind: task
schema_version: 2
title: Build the Inhibitor Investigation for AI Fellows
created: 2026-09-08T20:01:00Z
updated: 2026-09-08T20:01:00Z
author: codex
model: gpt-6-astra
model_basis: confirmed
status: executing
scope: examples
source_basis: conversation
sensitivity: normal
sanctioned_by: prose:01a08159-d0e4-7013-a510-bffe0b53d74f@2026-09-08T19:37:11Z
tags: [ai-fellows, demos, biochemistry]
---

# Inhibitor Investigation builder brief

User authorized the next best demo after at least one of the first two completes.
Wavelet Lab has completed standalone model, build, browser and PDF checks; shared
hub packaging is owned by Opus. This is the reviewed Ricky Cox candidate in Fellow
scope's reference-fellow-demo-reassessment, not a newly inferred feature proposal.
Expected outcome: a polished, self-contained offline classroom investigation in
`inhibitor-investigation/`, with source/build, independent tests, teacher-guide HTML
and PDF, README and manifest, matching CONTRACT.md and neighboring MSU demos.

## Ownership and return

Builder owns only `inhibitor-investigation/` and
`.aia/.data/fellow-builds/enzyme-progress.md`. Read AGENTS.md, scope entry and
CONTRACT.md before working. Inspect ion-flight or wavelet-lab for shell conventions.
Opus owns root index.html, README.md, tours, CONTRACT.md and existing demos. Other
workers own ion-flight and wavelet-lab. No root edits, branch changes, commits,
pushes, dependency installation or child agents. Parent commits logical milestones
to avoid shared-index races. Write incremental progress to the specified scratch file.
Send footprint to parent; coordinate through parent with the registered Opus peer.
Do not create demo.json until all required files including PDF exist: return draft
manifest as manifest.pending.json so concurrent root generation cannot discover an
incomplete demo. Parent renders PDF, promotes manifest, runs browser QA and commits.
Return exact changed paths, commands/results, scientific caveats, unresolved issues.
Return early if the design is wrong, impossible or cannot teach an honest lesson.

## Bounded investigation

Build a virtual assay bench: calibrated uninhibited baseline, three finite declared
synthetic hypotheses (competitive, uncompetitive, pure noncompetitive), selectable
substrate concentrations and limited assays. Compare directly plotted rates against
the hypotheses. Students choose a discriminating experiment and explain the evidence.
Use a fixed known baseline Vmax=100 rate units, Km=2 concentration units; make units
arbitrary teaching units. A simple shared inhibition factor 3 gives distinct curves
with a useful ambiguity at S=Km: competitive and uncompetitive both give25, versus
uninhibited50 and pure noncompetitive100/6. At high S their trends separate.
Use exact synthetic rates for the first version; no fake random noise or unexplained
tolerance. Include an explicitly unresolved/insufficient-evidence conclusion where
observations do not separate the finite candidates. A reveal is available only after
an explanation choice; do not score hidden mechanism guessing as sound reasoning.
Provide a new-case transfer task about choosing an informative substrate measurement,
with feedback derived from actual candidate predictions, not arbitrary correctness.
Do not expose the generating hypothesis before evidence: no naming leaks in labels,
tooltips or visible DOM attributes. It is okay that source code is inspectable.

Production model: v=Vmax*S/(a*Km+b*S). Competitive a=3,b=1; uncompetitive a=1,b=3;
pure noncompetitive a=b=3. Baseline a=b=1. Explain that these are ideal initial-rate
patterns at fixed conditions, not identification of a real drug or unique binding
mechanism. Exclude mixed-inhibition fitting, arbitrary parameter discovery, and
Lineweaver-Burk scoring. Keep caveats adjacent to conclusions. Sources: NIH Assay
Guidance Manual https://www.ncbi.nlm.nih.gov/books/NBK92001/?report=reader and Cox
https://campus.murraystate.edu/faculty/jcox/scicomm_biochem.html (course fit only,
not current schedule or endorsement). Verify relevant source before scientific prose.

## Acceptance

Use independent hand-calculated fixtures and test the production module: S=0,
baseline at Km, zero inhibition, high-S saturation limits, rate ordering/crossing,
and exact hypothesis ambiguity/discrimination. Test assay budget and duplicate
measurement behavior; direct evidence must control conclusion feedback. Bundle tested
module verbatim and prove reproducibility plus parse every inline script.
Include first-load/reopenable how-to, settings/presentation mode/presenter notes,
visible attribution, responsive canvas/SVG/controls, printable one-page guide with
specific sources and scope limits. No runtime requests, inference or external assets.
Mark browser-only compliance unverified until parent checks. Record tool provenance
honestly after runtime verification. Aim for one bounded implementation and repair pass.
