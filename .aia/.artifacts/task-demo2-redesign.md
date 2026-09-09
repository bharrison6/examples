---
id: demo2-redesign
artifact_kind: memory
memory_class: prospective
prospective_kind: task
schema_version: 2
title: Give Demo 2 the complete visual and teaching redesign used for Demo 1
created: 2026-09-09T05:35:00Z
updated: 2026-09-09T12:05:41Z
author: codex
model: gpt-6-astra
model_basis: confirmed
status: executing
scope: examples
source_basis: conversation
sensitivity: normal
sanctioned_by: prose:01a08159-d0e4-7013-a510-bffe0b53d74f@2026-09-09T05:33:13.647Z
tags: [design, teaching, language-models, ai-fellows]
---

# Operator authorization and sequence

Follow-up authorized 2026-09-09: after the Demo 1 navigation and era-report items,
fix the invisible but clickable LLM training-text disclosure. Verify the control
and expanded story visually in Chrome at desktop and phone widths. The user
confirmed the text still opens in its documented location; visibility is broken.

Follow-up completed 2026-09-09: Chrome reproduced exact navy text on the navy
workbench (both rgb(0,33,68)). Scoped disclosure styling restores a visible label,
gold marker/open/hover states, keyboard focus outline and container boundary.
Parent verified closed/open states and the unchanged 4,701-character story at
desktop, 390px and 320px, Tab focus and Enter activation, no horizontal overflow,
and zero console errors. Only CSS and generated app changed; build parity passed.
This completes the bounded visibility repair; the broader outstanding verification
listed elsewhere in this record is not implicitly marked complete.

The bounded follow-up builder owns glass-box/src/styles.css, src/template.html
only if semantic markup needs correction, and regenerated glass-box/index.html.
Do not change training data or model algorithms. Reuse the existing disclosure;
diagnose why it is invisible, repair its closed/open/focus states, and return
changed paths, checks and a logical commit. Parent owns browser verification and
ACC updates. Use no descendants; record incremental progress in
.aia/.data/types-ai-era-report/demo2-disclosure-progress.md and return early if
the apparent bug has a different cause or cannot be safely reproduced. Coordinate
owned surfaces and exclusive index before committing. Start after Demo 1 items.

Operator on 2026-09-09 instructed: finish Demo 1 final changes, then give Demo 2
the same complete overhaul and UI pattern. Keep working until Demo 2 is complete.
Make reasonable temporary decisions and report them at the end for later override.
This authorizes the full implementation, verification and existing push workflow;
do not stop for optional design questions. Start its build after Demo 1 is done.

Verified from tours/zero-to-takeoff.json: Demo 2 is glass-box, now displayed as
How a Language Model Works. Public folder and entry URL stay unchanged. Use the
latest committed Claude contract pass as baseline; preserve its canonical guide
injection, reset implementation and three genuine engine mechanisms.

# Expected outcome

Demo 2 gets the same readable cream/navy/gold design language and coherent lesson
structure as Demo 1: primary LLM / reasoning / agent navigation above the activity,
plain stage question, Try/Observe/Takeaway, purposeful control labels, clear live
versus example measurements, responsive phone/desktop/presenter layout, and deep
details in a side drawer instead of a long disconnected bottom section. Preserve
Guide on entry/reopen via question button, Settings with Open Presenter Notes,
Presentation mode and Reset, and canonical notes/printable HTML/PDF consistency.
Fix the known dialog centering defect as part of this authorized layout pass.

Preserve the working transformer training, causal attention/weights/probabilities,
era comparison, reasoning experiments and tool/agent interactions. Labels must
distinguish model training from inference, measured runs from guarantees, genuine
model behavior from scripted teaching fixtures and true tool computation. Inspect
the existing engine before stating what is real; do not introduce a cosmetic
simulation in place of a mechanism. The reasoning and agent demos are bounded
teaching examples, not claims that a tiny model has general reasoning abilities.
Audit STaR-style accepted-example fine-tuning wording rather than assuming it is
equivalent to policy-gradient reinforcement learning. No runtime external AI calls.

# Planned ownership

## Active lanes — baseline 640eebb, after Demo 1 publication

Native UI builder owns only `glass-box/src/{template.html,app.js}`,
`glass-box/index.html`, necessary UI regression tests under `glass-box/src/`, and
selector updates in the existing `glass-box/tools/integration.mjs` when required.
Reuse the completed `zero-to-unbeatable` UI as the visual reference, not copied
game mechanics. Preserve engine.js, text.js, arith.js, agent.js and worker.js
unless a demonstrated correctness defect is reported to parent. Build.js changes
only if essential and coordinated. Do not stage another lane's guide or docs.
Checkpoint `.aia/.data/demo2-redesign/ui-progress.md` incrementally, commit logical
units on this isolated branch, and coordinate the shared index before a commit.
No descendants or browser work; parent handles Chrome. Return candidate-ready
before final tests, then exact owned commits, tests, decisions and limitations.
Return early if an impossible or unsound requirement needs reframing.

Styling handoff: after the UI builder confirms its untouched CSS release, the
native styling worker owns only `glass-box/src/styles.css` and
`.aia/.data/demo2-redesign/style-progress.md`. Read the current template and
`zero-to-unbeatable/src/styles.css` as design reference. Match Demo 1's cream,
navy and gold language, readable typography, compact header/top tabs, clear
lesson scaffold and responsive workbenches. Preserve genuine chart semantics,
contrast, phone usability at 390/320px, presenter scaling, centered Guide and
Settings, and right-side Details drawer. Coordinate class names with UI builder;
do not edit template/app/guide/build or run browser/tests/builds/commits. Parent
commits CSS; UI builder builds once both lanes are ready. Incremental checkpoint
and early return on unsound requirements apply. No descendants.

Guide lane owns only `glass-box/src/demo-guide.html`, `glass-box/README.md`, and
`.aia/.data/demo2-redesign/guide-progress.md`. No commits, generated files or PDF;
parent commits this lane. Coordinate exact control labels with UI builder. Preserve
the line-anchored guide-css and guide-scope markers. Inside guide-scope use a
semantic `<div class="guide">` with header, sections and footer, like Demo 1, so
the existing canonical-source ReportLab renderer can be reused without a second
copy. Target a readable 2–3 page guide: question/activity/observation/limit, clear
LLM/Reasoning/Agents boundaries and optional slow experiments. No independent
presenter prose inside app. Parent owns PDF rendering/visual inspection, manifest,
hub, ACC records and integration. No descendants; early return if misframed.

Verified review findings to carry into both lanes: Act 2 models share core width,
depth and heads but differ in context length, seed and training steps. Accepted-
example self-training generates problems externally, checks worked chains AND
the known generated answer, then performs supervised next-token updates; this
is not policy-gradient reinforcement learning. The sampling/voting experiment
uses frozen weights. Act 3 action selection is a scripted policy, including the
deliberate calculator syntax mistake and retry; tools, context and truncation are
real. State this next to the automatic control. Avoid attention-as-mind-reading,
frontier parameter estimates, and claims that every frontier model is this recipe.

Design decision for this pass: preserve three stages and all genuine activities;
within LLM group training/sampling as the primary workbench and expose tokenizer,
weights and attention through purposeful inspection controls or panels. Keep the
page compact and progressive rather than merely recoloring its existing long
sequence. Each stage must have a concrete first action and learning takeaway.

Use a dedicated codex/glass-box-redesign worktree from the integrated latest
examples main, after Demo 1 completion. Native UI builder owns glass-box UI source,
generated index and necessary UI regressions, with core algorithm edits only for
a demonstrated correctness issue. Parent or separate guide lane owns canonical
guide, maintained docs, PDF, manifest/generated hub, ACC records and browser/PDF
verification. Exact lanes are assigned before dispatch; no other demo writes.
Read-only educational review may run independently of the implementation. Reuse
existing modules and build; retain .guide-scope marker contract. Coordinate with
Claude session 79d3584e before touching its prior demo lane. No blanket staging of
the shared checkout and no history rewrites. Commit explicit owned files, then
integrate and push verified work under existing authorization.

# Verification and return

Parent evidence so far: `node src/selftest.test.js` passed 29/29. Full
`node src/arc.test.js` reproduced direct/worked exam 54/96; frozen sampling
60/62/68/78 for 1/2/4/8 attempts; accepted counts 82/93/101/98 and subsequent
exam 77/83/84/85. These are bounded seeded results, not promises for other tasks.
Canonical guide currently 820 visible words; shared semantic renderer generated
two Letter pages, both visually inspected. Parent corrected header/footer
semantics and removed forced page breaks to avoid an almost-empty third page.
PDF helper now verifies boundary markers instead of an arbitrary 8KB size floor;
full PDF validity/layout is separately checked through Poppler and visual review.
UI/browser checks remain pending until candidate-ready.

Read-only baseline Chrome inspection (before this build): the first screen is a
long sequence of five activities with no compact lesson scaffold. Guide opens
with the overbroad claim that nothing is faked, then later acknowledges scripted
pieces. Act 1 calls attention "reading the model's mind" and claims frontier
models are the same recipe with only scale added; these need bounded, accurate
wording. Parameter comparisons include speculative frontier counts. Move the
deep architecture/scale explanations to Details, keep meaningful live activities
accessible, and separate illustrative or previously measured figures from live
results. These are observed copy issues, not permission requests.

Verify actual node suites appropriate to changed behavior and generated parity.
Chrome extension checks: desktop, 390px and 320px; stage navigation, training/Stop,
era accuracy, representative attention/weight inspection, reasoning experiment,
agent tool loop, Guide and Settings/reset/presenter/notes, PDF access, focus and
scroll behavior. Inspect every final PDF page. Do not add tests that only mirror
copy. Record checks actually observed, limits and temporary design decisions.
An interrupted worker checkpoints .aia/.data/demo2-redesign/ and commits logical
units. Parent completes an episodic record and reports user-overridable decisions.
