---
id: shared-credit-pill-design
artifact_kind: memory
memory_class: prospective
prospective_kind: task
schema_version: 2
title: Decide the shared credit pill's phone and tablet behaviour once, instead of nine local fixes
created: 2026-09-09T05:45:00Z
updated: 2026-09-09T05:45:00Z
author: msu.soeai
model: claude-fable-5-1
model_basis: confirmed
status: proposed
snooze_until: 2026-09-23
priority: low
scope: examples
source_basis: conversation
sensitivity: normal
tags: [attribution, mobile, demos, ai-fellows]
aliases: [bh-credit pill, attribution pill overlap, pill z-index]
---

# The shared credit pill

**Expected outcome.** One documented rule for the "Bryant Harrison · Murray State University"
pill that every demo carrying it follows: its height reserve at phone widths, whether it stands
down while an overlay or bottom control bar is open, and its stacking relative to plain `div`
overlays (modal `<dialog>` overlays already paint above it). Then the nine copies are aligned
to that rule.

Where this comes from: the pill was clipped off-screen on phones in nine demos, which
[[contract-ux-pass]] fixed per demo (`max-width:calc(100vw - 16px); white-space:normal`). After
that fix the lanes measured the wrapped pill landing on the flight controls (fuel-golf), the
notes overlay's foot (topping-out, the-stranger), and six sim buttons at 768px (ladder-lab), and
each lane chose its own mitigation. The markup is copied into each demo rather than shared, so
a single decision is the only way the nine stay consistent.

## Relations

- follows [[contract-ux-pass]]
