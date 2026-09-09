---
id: types-ai-controls
artifact_kind: memory
memory_class: episodic
lifecycle: complete
schema_version: 2
title: Separate AI stage navigation from rule controls
created: 2026-09-09T04:23:00Z
updated: 2026-09-09T04:34:00Z
author: codex
model: gpt-6-astra
model_basis: confirmed
status: active
scope: examples
source_basis: conversation
sensitivity: normal
tags: [design, tic-tac-toe, controls]
---

# Completed control layout

The AI stage tabs now occupy a page-level navigation bar below the branded header
and above the changing lesson. Rule-depth buttons sit above the rule list, under
'Rules the opponent can use', with text explaining that the remaining rules are
switched off. Labels explicitly say First 2 rules, First 4 rules and All 8 rules.
The single Era dropdown now sits immediately above Train the AI in 1b and remains
available in the optional Ultimate extension. README and generated index agree.

Implementation: 1a203c7; final tab spacing/source and bundle: 44d5a47/c12b103.
Parent verified the committed tree, build parity and nine existing lifecycle/UI
checks. Builder also observed all 102 gameplay checks and neural tests pass.
Chrome checks at 1280x900, 390x844 and 320x568 confirmed top-level tabs, readable
labels, no horizontally clipped controls, rule controls above the list, and the
Era dropdown above training. First 2/First 4 switched off six/four rule rows.
After a training burst the relocated dropdown still selected Era 0, and keyboard
ArrowRight selected the neural tab, hiding the Era control there.

The existing Guide, notes and PDF remain unchanged. A peer-reported attribution
clipping issue was checked on this actual demo: at390px the pill spans x8 to
x227.875 and shows the full byline, so no unrelated correction was needed.

Native builder reused its existing isolated branch; parent retained integration
and publication, preserving concurrent Opus lanes. This follow-up refines
[[types-ai-redesign]]. The original sanction was
prose:01a08159-d0e4-7013-a510-bffe0b53d74f@2026-09-09T04:21:00Z, expanded by the
operator's same-turn instruction moving the Era dropdown.

# Original expected outcome and build brief

The three AI stages are top-level tabs above the lesson, outside the tic-tac-toe
board panel. Rule-depth controls sit directly above the rules list and explain
their purpose before anyone clicks. Preserve mobile readability, keyboard tabs,
deep links, Guide/Settings/notes/PDF, reset behavior and the existing algorithms.
Additional operator steering: on stage 1b, place the Era dropdown directly above
Train the AI. Keep selecting older opponents functional and keep the optional
Ultimate selector available without duplicate IDs or controls.

# Builder lane

Continue on codex/types-ai-redesign in its existing isolated worktree. Own only
zero-to-unbeatable/src/template.html, src/styles.css, src/app.js, generated
index.html and README.md. No other demos, root hub, guide/PDF or memory edits.
Keep First 2 / First 4 / All 8 recognizable for the guide; visible button labels
may append 'rules'. Add a clear heading such as 'Rules the opponent can use' and
one sentence explaining that the setting enables the first two, first four, or
all eight rules in the list. Existing rule toggling should remain the mechanism.
Stage tabs should read as global navigation immediately below the branded header,
before the changing lesson title, not inside the board workspace. Retain single
controls and their accessible groups. Follow source/build conventions.

Return early if the request is unsound or cannot be completed as scoped. No descendants or browser work.
Commit explicit owned paths in NEW commits only; no amend on the shared branch.
Run build parity and applicable existing checks. Return commit, paths, checks and
limitations; parent independently checks desktop/phone placement and interaction,
updates this record/changelog, integrates and publishes. If interrupted, checkpoint
progress in .aia/.data/types-ai-redesign/control-progress.md.
