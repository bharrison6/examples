---
id: fuel-golf-finite-thrust-levels
artifact_kind: decision
schema_version: 2
title: Fuel Golf levels 6–7 — finite thrust as the difficulty ramp; centered burns then perigee kicks
created: 2026-08-03T18:04:28Z
updated: 2026-08-03T18:04:28Z
author: msu.soeai
model: claude-fable-5
model_basis: confirmed
status: chosen
question: How to make the game harder and richer once students realize impulsive burns make "prograde at periapsis" trivially optimal?
position: Keep levels 1–5 impulsive as the intro ramp; add level 6 (engine 0.35 ≈ 0.055 m/s²) where par is only achievable by CENTERING a single burn on periapsis, and level 7 (engine 0.08 ≈ 0.013 m/s²) where par requires splitting into repeated perigee kicks; sandbox gets a swappable engine. Steering losses ignored; a mid-burn cut control refunds unspent Δv.
scope: AIA
load_profile: on_demand
session: session_01MtHFEZCTJS2eNpUuqH7dgc
entities: [fuel-golf]
tags: [fuel-golf, finite-thrust, perigee-kicks, gravity-loss, level-design, decision]
aliases: [fuel golf finite thrust design, why levels 6 and 7, perigee kick level, burn centering lesson]
source_basis: transcript
human_edited: false
sensitivity: normal
---

# Finite-thrust levels (user-directed, 2026-08-03)

## Position
- User insight driving this: with instantaneous Δv the timing lesson collapses; finite
  thrust restores it. Ramp: L6 teaches burn CENTERING (start half the burn duration before
  periapsis), L7 teaches PERIGEE KICKS (one long weak burn smears around the orbit).
- Tuning method: grid-search strategies through the shipped integrator, then set par in
  the gap between intended and naive strategy. L6 (a=0.35 on the L3 orbit): centered 4.90
  vs lit-at-Pe 5.81 ⇒ par 5.3. L7 (a=0.08): six 10 sim-s kicks 4.62 vs single centered
  9.47 ⇒ par 5.2. Real units: 775/919 m/s and 731/1,498 m/s, kicks ≈ 3 h each.
- Tanks sized so the naive strategy still completes (students feel the cost difference,
  then chase par). Harness asserts both sides: intended ≤ par − margin, naive > par.
- UX: planner shows burn duration as % of orbit (warns > 30% — "split into kicks"),
  preview draws the powered arc solid orange before the dotted coast, ✂ Cut engine
  (or X) stops a burn keeping unspent fuel, warp caps at 10× while thrusting.

## Rejected / deferred
- Modeling steering losses — rejected by user; thrust tracks the commanded frame exactly.
- "Interstellar Express" bonus level (escape with required v∞ where a retrograde
  dive-then-periapsis-burn genuinely wins — the true Oberth maneuver): DEFERRED, design
  agreed in-session after proving dive-first loses on level 2 (5.89 direct vs 8.62 dived).

## Relations
- relates_to [[decision-fuel-golf-physics-core]] (RK4 powered arcs; harness rubric)
- relates_to [[decision-fuel-golf-earth-units]] (real-unit statements of these numbers)
