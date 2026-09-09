---
id: demo-titles-retitle
artifact_kind: memory
memory_class: episodic
lifecycle: complete
schema_version: 2
title: Completed — thirteen demos retitled to descriptive titles per the confirmed list (Path A)
created: 2026-09-09T03:24:00Z
updated: 2026-09-09T05:40:00Z
author: msu.soeai
model: claude-fable-5-1
model_basis: confirmed
status: active
decided_path: "Path A: display titles only; folder slugs and URLs unchanged (operator, console, 2026-09-09)"
folded_into: contract-ux-pass
priority: normal
scope: examples
source_basis: conversation
sensitivity: normal
tags: [naming, demos, ai-fellows]
aliases: [retitle demos task]
---

# Completion — 2026-09-09

Sanction, preserved as historical provenance: operator console answer event
`441fc3445f164c2886e7ec24fadccb57` on [[demo-titles-descriptive-retitle]] (Path A).

Done inside the [[contract-ux-pass]] lanes under Path A: every demo in the confirmed list
shows its new title in `demo.json`, the in-app header and tab, the guide (source, shipped,
PDF) and its README; folder slugs, URLs and guide filenames are unchanged; the hub was
regenerated (`6da61ec`). Three lanes found that a longer title overflowed phone widths and
fitted it with `clamp()` so desktop sizes are unchanged (should-have-known-that, two-winters,
glass-box). "Takeoff" survives as the subtitle of The Pace of AI Progress. Codex retitled
zero-to-unbeatable to Types of AI on its own lane.

## Original brief (preserved)

# Retitle thirteen demos

**Expected outcome.** Each demo in the confirmed list in
[[demo-titles-descriptive-retitle]] shows its new title in `demo.json`, the in-app
header and browser tab, the guide heading (source and shipped) and re-rendered PDF, and
its README heading; the hub table and cards regenerate from the manifests; the launcher's
hand-authored narrative names demos by their new titles; old titles that are worth keeping
survive as taglines. Under Path B only, folders are also renamed with a redirect stub at
each old slug and the never-rename rule in [[examples-repo-protocol]] is closed with
`superseded_by`.

Sequencing: run after [[contract-ux-pass]] so the same per-demo builders do not collide,
or fold it into that pass's lanes if the operator answers before the pass starts.

## Relations

- fires_on [[demo-titles-descriptive-retitle]]
- relates_to [[contract-ux-pass]]
