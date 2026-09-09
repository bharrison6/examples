---
id: wavelet-lab-part-3-rework
artifact_kind: memory
memory_class: episodic
episodic_kind: decision
lifecycle: complete
schema_version: 2
title: "Wavelet Lab Part 3: replace the fixed prediction question with a live one, remove it, or keep it?"
created: 2026-09-09T03:24:00Z
updated: 2026-09-09T03:40:00Z
author: msu.soeai
model: claude-fable-5-1
model_basis: confirmed
status: active
acted_on: "Folded into the wavelet-lab lane of [[contract-ux-pass]] as [[wavelet-lab-part-3-live]] (executing) on 2026-09-09"
applied_in: [wavelet-lab-part-3-live, contract-ux-pass, event:16a888bbe48a4407aaf594599ad81d9a]
question: "Part 3 of Wavelet Lab is a single multiple-choice question (two omitted coefficients of 5 and -2 contribute 29 to squared error) plus a paragraph telling the student to explore the Portrait scene. The rest of the lab is explorable. What should Part 3 become?"
position: "Replace with the live predict-your-next-toggle mechanic and a Portrait preset (recommended)"
alternatives:
  - "Replace with the live predict-your-next-toggle mechanic and a Portrait preset (recommended)"
  - "Remove Part 3 entirely; fold the Portrait prompt into Part 2 as a preset"
  - "Keep Part 3 as it is"
answer_shape: choice
stakes: low
deadline: none
default: "Replace with the live mechanic."
reasoning: "The fixed question does one valuable thing, forcing a prediction on the idea students get wrong (signs cancel), but it is spent after one viewing and is disconnected from the interactive state. A live version keeps the prediction step, is never the same twice, and stays attached to the signal the student built. The builder's brief demanded a 'new case' step, which is why Part 3 exists in this form; the intent survives in the live version."
scope: examples
load_profile: on_demand
entities: [examples-repo]
tags: [decision, wavelets, demos, teaching, ai-fellows]
aliases: [wavelet part 3, wavelet prediction question]
source_basis: authored
confidence: 80
human_edited: false
sensitivity: normal
decided_by: human
decided_via: console
answer_event: 16a888bbe48a4407aaf594599ad81d9a
load_bearing: false
---

# Wavelet Lab Part 3

The operator's doubt on 2026-09-09: "I am not sure if part 3 is really a good addition,
if only because its a single question that never changes where as the lab is somewhat
more explorable."

The independent review of the lab the same day ([[fellow-wavelet-build]] for the build;
the review is logged in the examples changelog) found the math and every teaching claim
correct, so this is a design choice, not a correctness fix. Whatever is chosen, the
error readout in Part 1 already shows that squared error equals omitted energy, which is
the exact check a live prediction would be graded against.

## Relations

- relates_to [[fellow-wavelet-build]]
- relates_to [[contract-ux-pass]]

<!-- producing-model: claude-fable-5-1 2026-09-09T03:24:00Z, Claude Code runtime record -->
