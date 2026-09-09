---
id: wavelet-lab-part-3-live
artifact_kind: memory
memory_class: prospective
prospective_kind: task
schema_version: 2
title: Rework Wavelet Lab Part 3 into a live prediction mechanic
created: 2026-09-09T03:24:00Z
updated: 2026-09-09T03:24:00Z
author: msu.soeai
model: claude-fable-5-1
model_basis: confirmed
status: proposed
fires_on: "[[wavelet-lab-part-3-rework]] is answered"
blocked_by: "Replace, remove, or keep is the operator's choice"
snooze_until: 2026-09-16
priority: normal
scope: examples
source_basis: conversation
sensitivity: normal
tags: [wavelets, demos, teaching, ai-fellows]
aliases: [wavelet part 3 task]
---

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
