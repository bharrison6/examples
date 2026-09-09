---
id: examples-launcher-redesign
artifact_kind: memory
memory_class: prospective
prospective_kind: task
schema_version: 2
title: Redesign the examples launcher and consolidate the tic-tac-toe teaching sequence
created: 2026-09-09T02:07:00Z
updated: 2026-09-09T02:07:00Z
author: codex
model: gpt-6-astra
model_basis: confirmed
status: executing
scope: examples
source_basis: conversation
sensitivity: normal
sanctioned_by: prose:01a08159-d0e4-7013-a510-bffe0b53d74f@2026-09-09T02:02:00Z
tags: [launcher, design, teaching, tic-tac-toe, neural-networks]
---
# Expected outcome

A polished, mobile-friendly launcher with less visual and verbal clutter, clear
audience-facing explanations, and one tic-tac-toe Demo 1 with three real tabs:
1a Rules-based intelligence, 1b Machine learning, 1c Neural networks. Glass Box is
Demo 2, with its language-model, reasoning and agent stages. The user explicitly
requested these changes and clearer prose, including replacing ambiguous stage
labels. Keep established public demo URLs and existing learning functionality.

# Work boundary and coordination

Work on isolated branch `codex/launcher-tictactoe-redesign` from `ca1e27b`.
The primary shared checkout has concurrent Opus work and two pre-existing dirty
PDFs; this checkout avoids touching them. Parent coordinates integration, commits,
Chrome review, PDF review, ACC records and peers. No worker pushes, installs,
edits another lane, changes git state, or spawns children. Each worker records
incremental decisions/checkpoints in its owned `.aia/.data/launcher-redesign/` file.
If the task appears impossible, wrong or pedagogically unsound, return early with
the specific reason instead of forcing the implementation.

## Launcher lane

Own root `index.html`, `tools/build-hub.js`, a focused hub test beside that tool,
`tours/zero-to-takeoff.json`, root README generated region, and manifest
`card_blurb`/short display metadata fields of existing demos EXCEPT
`zero-to-unbeatable/demo.json` (tic-tac-toe lane owns it).
Own progress `.aia/.data/launcher-redesign/hub-progress.md`.
Preserve the incomplete-manifest guard and generated-card/table ownership. No
other demo code, guides, PDFs, CONTRACT or ACC memory edits.

Design direction: a restrained editorial layout with clear hierarchy, substantial
whitespace, navy/gold MSU identity, readable typography and strong mobile touch
targets. Reduce repeated heading/paragraph/takeaway/card stacks to concise cards.
Introduce the collection once, give the two starting demos prominence, group
progress/history together and make discipline examples easy to browse. Preserve
The Stranger then Front Doors at the start of practical applications. Include
the two completed Fellow demos missing from the launcher/tour. Keep optional
concept explanation available without dominating the first screen. Rewrite prose
as complete, concrete explanations; headings may be concise labels. No claims
that learning has no human rules, that all spam filters are non-neural, or that
neural networks exist only to overcome tables. Explain that neural networks are
a kind of machine learning. Do not preserve misleading nesting of every agent or
all generative AI within neural networks as a universal taxonomy.

## Tic-tac-toe lane

Own only `zero-to-unbeatable/` excluding its PDF (parent packages final PDF), and
`.aia/.data/launcher-redesign/tictactoe-progress.md`. No root/hub/other-demo edits.
Reconcile README, SPEC, canonical guide and manifest with the final behavior.
Use current rules/learning machinery and board, preserving optional Ultimate as
an advanced representation-limit extension rather than the neural-network tab.

`src/net.js` is unbundled legacy machinery. Its low-level MLP depends on OG and is
reusable; its old higher-level trainer targets retired nine.js and incompatible
value semantics. Current OG stores afterstate values from the last mover's view.
Do not silently mix that with legacy fixed-X values or unreachable board states.

Implement the third tab as genuine supervised approximation of a frozen learned
value table: the table learned from games; shared network weights now approximate
examples from it. Provide an explicitly labelled reproducible teacher preparation
step if needed. Freeze the example source, split reachable positions into train
and held-out groups with symmetry-equivalent boards together, report both errors
and actual playing results separately. During play evaluate legal afterstates
with the network, with no hidden teacher/oracle lookup. Reuse independent policy
verification for any unbeatable claim; successful teaching does not require
claiming an unbeatable network. Use visible live training, clear before/after
comparison, understandable weight/representation explanation and responsive
cancel/reset/tab navigation. No pretend training or predetermined progress bars.

Validate gradient by independent finite differences away from activation kinks,
value perspective/terminal outcomes/legal moves, deterministic replay/frozen
snapshots, no held-out leakage, no teacher consultation in play, several fixed
seed behavior/error measurements, and bundle parity. Keep bounded realistic
training duration on ordinary hardware. Labels are Demo 1a/1b/1c as above, with
accessible tabs modelled on Glass Box's three-stage navigation. Any stage URL
fragments must select the corresponding real mode. Avoid claims that networks
guarantee generalisation or that normalized updates are exact output steps.

# Delivery

Parent verifies committed files, Chrome desktop and phone interactions and final
guide pages. Existing shared work must be preserved during integration. No push
without explicit operator authorization. Completing this task also finishes the
previous final-two Fellow launcher integration if its cards and tour are verified.
