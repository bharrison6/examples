---
id: contract-pass-fanout-width
artifact_kind: memory
memory_class: prospective
prospective_kind: decision
schema_version: 2
title: "Approve the width of the per-demo builder fan-out for the contract UX pass"
created: 2026-09-09T03:24:00Z
updated: 2026-09-09T03:24:00Z
author: msu.soeai
model: claude-fable-5-1
model_basis: confirmed
status: open
question: "The contract UX pass needs one builder agent per demo folder (15 lanes now, zero-to-unbeatable later). How wide may the fan-out run?"
position: "Batches of five parallel builders, opus tier, orchestrator verifies and commits each lane before the next batch starts."
alternatives:
  - "Batches of five parallel builders; verify and commit each batch before launching the next (recommended)"
  - "All fifteen builders at once, then verify everything in one sweep"
  - "One builder at a time, serially"
  - "Do not run the pass as agents; reframe"
answer_shape: choice
stakes: medium
deadline: none
default: "Batches of five (the operator's 2026-08-05 precedent: review a few at a time so the returns stay manageable)."
reasoning: "Fifteen concurrent builders each run node tests and a headless-Chrome PDF render; five at a time keeps machine load and orchestrator verification bounded, and a mis-framed brief surfaces after the first batch instead of after all fifteen. The dispatch checklist requires explicit approval for a fan-out of this width."
scope: examples
load_profile: on_demand
entities: [examples-repo]
tags: [decision, demo-contract, dispatch, ai-fellows]
aliases: [contract pass fan-out, how many builders at once]
source_basis: authored
confidence: 85
human_edited: false
sensitivity: normal
---

# Builder fan-out width for the contract UX pass

The task is [[contract-ux-pass]]: bring every demo up to the rewritten `CONTRACT.md`
Required UX (a `?` Guide button, a Settings menu with Open Presenter Notes, Presentation
mode and Reset, and presenter notes generated from the same source as the printable
guide). Each demo has its own build layout, so the work is one builder per demo folder,
fifteen lanes now and `zero-to-unbeatable` when the Codex lane releases it.

Width is the only open choice. Depth is one: builders spawn no children. Model tier is
opus for every lane; the two light lanes (two-winters and front-doors, which already
single-source their notes) could run on sonnet.

## Relations

- decides_for [[contract-ux-pass]]
- relates_to [[examples-repo-protocol]]

<!-- producing-model: claude-fable-5-1 2026-09-09T03:24:00Z, Claude Code runtime record -->
