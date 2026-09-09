---
id: wavelet-lab-part-3-live
artifact_kind: memory
memory_class: episodic
lifecycle: complete
schema_version: 2
title: Completed — Wavelet Lab Part 3 reworked into a live prediction mechanic
created: 2026-09-09T03:24:00Z
updated: 2026-09-09T05:40:00Z
author: msu.soeai
model: claude-fable-5-1
model_basis: confirmed
status: active
decided_choice: "Replace with the live predict-your-next-toggle mechanic and a Portrait preset (operator, console, 2026-09-09)"
folded_into: contract-ux-pass
priority: normal
scope: examples
source_basis: conversation
sensitivity: normal
tags: [wavelets, demos, teaching, ai-fellows]
aliases: [wavelet part 3 task]
---

# Completion — 2026-09-09

Sanction, preserved as historical provenance: operator console answer event
`16a888bbe48a4407aaf594599ad81d9a` on [[wavelet-lab-part-3-rework]] (replace with the live mechanic).

Done in the wavelet-lab lane of [[contract-ux-pass]] (`0f26955`): clicking a retained
coefficient card names it, quotes the current squared error and asks for the predicted rise
before dropping it, then grades the prediction against the readout; Part 2 has a one-click
"Portrait at 64" preset; the fixed multiple-choice question and its reveal are gone and its
content moved to the guide's assessment prompts. `src/wavelet.js` is unchanged; three new
tests pin the live check and the test summary derives its count. Verified in a real browser
by the lane and by the orchestrator's re-run of all suites.

## Original brief (preserved)

# Wavelet Lab Part 3 rework

**Expected outcome** (if "replace" is chosen). In Part 1, before a coefficient card is
toggled off, the lab names the coefficient about to be dropped and asks for the resulting
rise in squared error; it then toggles and shows the check against the actual readout.
Part 2 gains a one-click "Portrait at 64" preset. The fixed multiple-choice question and
its reveal are removed. Tests cover the live check against `squaredError` and
`energy` from `src/wavelet.js`. Nothing else in the lab changes. If "remove" is chosen,
only the preset is added and Part 3 is deleted.

## Relations

- fires_on [[wavelet-lab-part-3-rework]]
- relates_to [[fellow-wavelet-build]]
