---
id: fellow-occupancy-build
artifact_kind: memory
memory_class: prospective
prospective_kind: task
schema_version: 2
title: Build What the Survey Missed for AI Fellows
created: 2026-09-08T21:10:00Z
updated: 2026-09-08T21:10:00Z
author: codex
model: gpt-6-astra
model_basis: confirmed
status: executing
scope: examples
source_basis: conversation
sensitivity: normal
sanctioned_by: prose:01a08159-d0e4-7013-a510-bffe0b53d74f@2026-09-08T21:08:00Z
tags: [ai-fellows, demos, ecology, occupancy]
---
# What the Survey Missed

User authorized the final two reviewed demos on 2026-09-08. Expected outcome:
a polished, scientifically bounded wildlife-survey investigation for Matt Carroll's
plausible ecology/wildlife teaching, in `what-the-survey-missed/`. Existing reviewed
specification: Fellow scope [[fellow-demo-reassessment]], Carroll and independent
Astra feasibility sections. Do not imply current course assignment or endorsement.

## Ownership and delivery

Own only `what-the-survey-missed/` and `.aia/.data/fellow-builds/occupancy-build-progress.md`.
No other demos, root index/README/tours/CONTRACT, ACC memory, branches, commits,
pushes, dependency installs, browser use or child agents. Parent owns peer
coordination, browser/PDF review, hub integration and commits on the shared tree.
Persist a runnable checkpoint and progress incrementally; update files in place.
Return early with the specific reason if the task cannot support an honest lesson.
Return exact files, commands observed, model boundaries and remaining concerns.

Read CONTRACT.md and reuse the Ion Flight or Inhibitor Investigation shell/build
patterns; do not carry their subject-specific science or detached quiz design.
Required deliverables: model.js, app.template.html, reproducible index.html,
build/test scripts, README, semantic teacher-guide.html, and demo.json provenance.
Parent renders PDF from canonical HTML; keep guide readable at about 10pt, two
pages if practical. Delay manifest until required files exist, or tell parent when
ready so the PDF can be created before hub generation. Required UX: initial help,
reopen button, settings/presentation/notes, MSU theme, attribution, responsive
phone layout, no runtime network or inference. Mark browser-only compliance
unverified until parent verifies. Use a compact connected prediction/action/
evidence/explanation workspace. Define units at first use; keep evidence visible
when acting. No score that claims mastery, no hidden-truth leak before reveal.

## Scientific and teaching contract

Teach occupancy (whether a site is used), not abundance (number of animals).
Two comparable synthetic habitat groups, initially 24 sites each; a fixed visit
round surveys every site in both groups. At most three rounds, visibly accounting
for 48 site-visits per round. Students predict which habitat is more occupied,
survey, inspect detection histories and repeat visits, then compare the evidence
with hidden truth. Site clicks inspect records; they do not create adaptive sampling.
Use reproducible seeded scenarios, with explicit reset/replay/new-seed semantics.
Occupancy at each site stays fixed across visits; detections are conditionally
independent given occupancy, with no false positives and constant detection
probability within each habitat. These are named assumptions, not claims about
real local species. Use generic/synthetic wildlife imagery, not invented field data.

Primary teaching parameters: habitat A occupancy probability psi=0.8, detection
p=0.25; B psi=0.5,p=0.8. Expected fractions detected at least once after K visits:
psi*(1-(1-p)^K). K=1 gives0.20/0.40; K=3 gives0.4625/0.496. Distinguish this expected
fraction, observed fraction ever detected, realized occupied-site fraction, and
underlying generating occupancy probability. More visits do not guarantee the
right ranking in one finite realization. No conservation recommendation.

Include an optional inference view computed from OBSERVED histories, never truth.
For a specific K-visit history with d detections, likelihood is
psi*p^d*(1-p)^(K-d) if d>0; (1-psi)+psi*(1-p)^K if d=0. A bounded likelihood grid
and explicit relative-likelihood support region are sufficient. A single visit
cannot identify psi and p separately: show that ambiguity, not a unique occupancy
estimate. Do not label relative likelihood as posterior probability or a calibrated
95% confidence interval. Handle all-zero/boundary histories honestly. Prefer a
simple transparent likelihood display over a complex estimator with weak checks.

Reveal map, realized occupancy and generating psi/p only after the evidence task.
Transfer prompt must establish that fewer detections do not by themselves prove
lower occupancy, with contextual feedback and an explicit counterexample.
Sources: USGS/MacKenzie occupancy model and USGS RPresence workshop linked in the
reviewed Fellow artifact; verify primary source content relevant to implementation.

Independent checks: enumerate all K=3 binary histories and sum probabilities;
hand-calculated expected detection rates; no detections at unoccupied sites;
closure across visits; seeded replay; p/psi endpoints; likelihood reference values
from an independent small grid, one-visit nonidentifiability, and sparse/boundary
cases. Test the production module and exact shipped bundle. Keep runnable first
checkpoint small, then refine the visual/evidence experience.
