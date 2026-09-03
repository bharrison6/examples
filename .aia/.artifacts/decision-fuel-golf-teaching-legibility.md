---
id: fuel-golf-teaching-legibility
artifact_kind: decision
schema_version: 2
title: Fuel Golf legibility — goals must be visually self-explanatory and outcomes must be provable from recorded inputs
created: 2026-08-03T18:04:28Z
updated: 2026-08-03T18:04:28Z
author: msu.soeai
model: claude-fable-5
model_basis: confirmed
status: chosen
question: How should the game communicate goal criteria (especially escape vs tall-ellipse) and justify results so students trust and learn from them?
position: Encode goal semantics in the visuals (amber Ap-band ring matching the Ap marker vs green circularize rings, each labeled in-band; system-edge circle recolors by live ε with an ORBIT BOUND/ESCAPING chip and a one-shot fall-back toast), predict outcomes in the burn planner before commit, and close every level with a "show the math" debrief panel that re-derives the outcome from recorded inputs and checks it against the integrator.
scope: AIA
load_profile: on_demand
session: session_01MtHFEZCTJS2eNpUuqH7dgc
entities: [fuel-golf]
tags: [fuel-golf, ux, debrief, math-proof, escape-criterion, decision]
aliases: [fuel golf ux fixes, show the math panel, escape boundary confusion fix, level 2 ap band]
source_basis: transcript
human_edited: false
sensitivity: normal
decided_by: human
---

# Teaching-legibility decisions (user-feedback-driven, 2026-08-03)

## Position
Three playtest findings from the user, each fixed structurally rather than with more text:
- **L2 goal misread** ("seems to work by just hitting the higher Ap"): apoapsis-band goals
  now render AMBER to match the yellow Ap marker, labeled in-band "get your apoapsis in
  here; no need to circularize"; circularize/transfer goals stay green with their own
  label. The hint states completion is instant when Ap enters the band.
- **L3 escape criterion illegible** (a 4.0-unit burn crosses the red circle on a tall
  ellipse yet doesn't win): the edge circle recolors by live ε (red bound / green
  escaping) and is relabeled "SYSTEM EDGE — only counts with ε > 0"; a top-bar ORBIT chip
  shows BOUND/ESCAPING at all times on escape levels; crossing the edge while bound fires
  a one-shot toast explaining ε < 0 ⇒ falls back; the planner prints a pre-commit verdict
  (predicted Pe/Ap/ε, "still bound: it will fall back" vs "ESCAPE trajectory").
- **Outcomes must be provable** (user: "show the burns and all the math"): debrief gained
  a proof panel — per-burn cards evaluating Δε = v·Δv·cosθ + ½Δv² with the player's
  recorded numbers against the integrator's measured ε′ ("✓ matches"), new orbit derived
  purely from (ε, h) via e = √(1 + 2εh²/μ²), an energy ledger ε_start → burns → ε_final
  (moon assist appears as an explicit zero-fuel line item), and a numeric goal check.
  Finite burns show Δv-weighted v̄ and Δε ≈ v̄·Δv with the gravity-loss caveat.

## Consequences
- The proof panel doubles as the projector debrief artifact (teacher guide 15–19 min slot).
- Headless Playwright suite (ui-smoke.js) pins these behaviors: fall-back toast fires,
  tall ellipse does not complete L3, proof panel matches on elliptical and hyperbolic paths.

## Relations
- relates_to [[decision-fuel-golf-physics-core]] (the integrator the proofs check against)
