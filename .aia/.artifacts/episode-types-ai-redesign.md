---
id: types-ai-redesign
artifact_kind: memory
memory_class: episodic
lifecycle: complete
schema_version: 2
title: Modernize Types of AI and make the three teaching stages clear
created: 2026-09-09T03:35:20Z
updated: 2026-09-09T05:01:00Z
author: codex
model: gpt-6-astra
model_basis: confirmed
status: active
scope: examples
source_basis: conversation
sensitivity: normal
tags: [design, teaching, tic-tac-toe, contract]
---

# Completion — 2026-09-09

Follow-up [[types-ai-terminology]] separates A–D model representations from the
unlettered learning-method view and adds inspection of real neural weights.

Follow-up [[types-ai-controls]] moves stage tabs to page-level navigation, explains
rule-count controls above the rules list, and groups Era selection with training.
Follow-up [[types-ai-details-drawer]] moves long evidence and explanations into a
responsive right-side Details drawer with keyboard scrolling and focus return.

Delivered Types of AI, the descriptive display title for the existing
zero-to-unbeatable URL. The first demo now uses the launcher's cream, navy and
gold design, a visible question and Try/Observe/Takeaway for each stage, readable
rules, compact board and responsive controls. Existing rule, table, neural and
Ultimate engines are unchanged. Core implementation: 920306f; desktop spacing:
95842f0; mobile header: d94aa9e; guide and two-page PDF: a5ab98f. Parent additionally
kept tablet/landscape lesson copy at a readable size.

Guide opens on entry and from the header question button. Settings has Open
Presenter Notes, Presentation mode and Reset. Notes are embedded from canonical
src/demo-guide.html; standalone HTML matches it and the existing PDF renderer
uses it. PDF filename and public folder remain stable. The 20-minute guide gives
each stage a question, activity, observation and teaching limit.

Independent Astra High review identified selected-era proof/report problems and
overstated teaching language. Builder and parent addressed them. Browser review
also caught old table scores on an unprepared neural board and misleading table
visit counts on network predictions; both were corrected and rechecked. Network
game messages now identify the network, and table estimates are described as
estimates. Initial independent review was followed by parent source and browser
verification; a second native reviewer dispatch hit the agent-thread limit.

## Observed verification

- Parent ran all 102 gameplay checks, neural determinism/split/gradient/policy
  tests, nine lifecycle/UI checks, generated app/guide parity and three hub checks.
- Chrome: Guide on entry/reopen/Escape with focus restored, direct #learning
  entry, keyboard stage arrows, Settings labels, presentation scaling, neural
  preparation and fitting, Stop training, full Reset and optional extension.
- Trained table reached verified Era 4 (20,000 games; 15,408 complete lines and
  4,959 positions examined). Selecting Era 0 removed the unbeatable banner and
  later-era report. Neural mode kept the table report hidden; before preparation
  its board had no old scores, and afterward its cells said network predicted
  score without table visits.
- In one browser run, stopped neural fitting at 37,888 updates changed train MSE
  0.703 to 0.469, held-out MSE 0.743 to 0.572 and sampled play 52/11/37 to 80/4/16
  won/drawn/lost. This is an observed run, not a performance guarantee.
- Layout inspected at desktop, 390px, 320px and 844x390 landscape; no horizontally
  clipped visible controls. Landscape retains the question and readable Try cue.
  Chrome error log was empty. Direct-file/disconnected operation was not rerun;
  build validation rejects external runtime asset references.
- PDF: extraction covered all six sections and 770 visible source words; two
  letter pages inspected visually. Metadata title Types of AI. Committed and raw
  PDF blob hashes matched (8d2f436efc6ff0cf7128c4cd04a9716ebaeb47e3).

## Coordination and delivery

Work was isolated in codex/types-ai-redesign. Claude coordinator 79d3584e reserved
this demo and its root card for Codex and held the hub generator during integration.
Other demo edits remained in their owners' lanes. Latest committed main changes
were merged, retaining both changelog entries and peer commits. Root card/README
were regenerated from manifests. Publication follows the user's existing explicit
push authorization; final delivery is recorded in the completion changelog.

The original authorized brief is retained below for provenance. Its prospective
sanction was prose:01a08159-d0e4-7013-a510-bffe0b53d74f@2026-09-09T03:33:00Z.

# Original expected outcome

Modernize the first demo using the launcher's restrained navy, cream and gold
editorial design. A newcomer should understand what the three methods learn (or
do not learn), what to try now, and what observation supports the lesson. Preserve
the actual rules, table learning and neural learning already independently tested.
Display title Types of AI follows the operator-confirmed retitle list; keep the
public zero-to-unbeatable folder and existing guide/PDF paths.

# Builder lane

Own zero-to-unbeatable/** EXCEPT its PDF, canonical src/demo-guide.html, README.md,
SPEC.md and tools/render_guide.py, plus incremental progress in
.aia/.data/types-ai-redesign/build-progress.md. Parent packages the PDF after the
source guide is stable, handles root generated card/README, memory/logs, independent
review, Chrome validation, integration and publishing. No other demo, contract,
root or ACC artifact edits. No descendants. Work in the isolated branch
codex/types-ai-redesign; commit bounded completed source changes with explicit
paths, leaving parent-owned records alone. If a requirement is unclear, unsound
or impossible, return early with the concrete conflict instead of forcing it.

Read CONTRACT.md, repo AGENTS and scope-entry protocol. The live contract requires
a header ? named Guide, entry Guide overlay, Settings beside it containing Open
Presenter Notes, Presentation mode and Reset. Add an obvious link to the existing
printable PDF, including from notes; preserve embedded notes generated from the
same canonical guide. Update Guide language/buttons, guide source, README/SPEC,
manifest title and compliance keys as needed. Build check must detect guide/bundle
drift. Keep all content self-contained at runtime; use no external fonts/assets.

Design a substantial coherent revision, not a theme override pasted onto old CSS.
Keep one primary board/action workspace, explicit stage introduction with a
learning question, concise try/observe/takeaway guidance, progressive disclosure
of technical explanations and evidence details. Do not bury the lesson below a
large board or pack every explanation into tiny cards. Mobile typography/touch
targets and projector mode must remain legible; modals need focus/scroll behavior.
Do not make a single bright hero so tall that the activity disappears. Use system
serif headings and readable system sans body, cream canvas/navy working area/gold
actions, consistent space and borders. Stage tabs stay 1a/1b/1c.

Preserve IDs used by app.js or update every consumer deliberately. Keep reset/run
generation cancellation, seed reproducibility, keyboard tabs, actual network
preparation/fitting and independent evaluation semantics. Do not alter engine.js,
rules.js, net.js or ultimate.js without a demonstrated UI-blocking reason agreed
with parent. Ultimate stays optional; fewer inputs cannot be fixed by network
weights alone. A neural network is a type of ML, not its replacement. Table labels
are learned estimates including unvisited zeroes; no guaranteed generalization or
unbeatable network claim. Keep measured error distinct from gameplay outcomes.

# Return and verification

## Guide packaging lane (split from the existing authorized work)

Own only zero-to-unbeatable/src/demo-guide.html, README.md and SPEC.md, plus
.aia/.data/types-ai-redesign/guide-progress.md. The UI builder explicitly released
these untouched paths on 2026-09-09. No other files, PDF authoring, git operations,
browser interactions or descendants. Keep the canonical guide's semantic HTML
markers and section/page-break structure compatible with the existing renderer.
Title Types of AI; align visible action names with the UI builder and latest
CONTRACT. Use a clear 20-minute presenter sequence: question, activity, expected
observation and teaching limit for each stage; explain that preparation creates a
fresh learned teacher, held-out error measures agreement not playing strength,
human play does not train the table, and network weights cannot repair absent
inputs in the optional extension. Avoid unexplained expert jargon and performance
guarantees. Keep the guide compact enough for two readable pages. Update README
and SPEC to describe final teaching/contract surfaces without duplicating a long
presenter script. Parent owns rendering/PDF, verification and committing this lane.
Coordinate canonical-guide stability before the UI builder regenerates the app.
Return early if any requirement is unclear or unsound. Return changed paths and
actual read-only extraction check result; persist progress while working.

Return commits/files, design rationale, tests actually run and remaining risks.
Run existing playtest, neural/lifecycle and build parity tests; add only meaningful
behavior/contract regression checks for changed interactions. Parent reviews the
committed tree and exercises desktop/390px/320px, all three stages, Guide on entry
and reopen, settings/reset/presentation/notes/PDF access. Parent inspects each final
PDF page. Independent review is read-only and owns no files. Keep progress durable
so an interruption does not discard design decisions.
