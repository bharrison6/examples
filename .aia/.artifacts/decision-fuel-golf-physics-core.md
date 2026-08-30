---
id: fuel-golf-physics-core
artifact_kind: decision
schema_version: 2
title: Fuel Golf physics — symplectic Verlet coasts, RK4 powered arcs, lessons must emerge from the integrator
created: 2026-08-03T18:04:28Z
updated: 2026-08-03T18:04:28Z
author: msu.soeai
model: claude-fable-5
model_basis: confirmed
status: chosen
question: How is Fuel Golf's orbital mechanics simulated so that the Oberth effect is discovered rather than scripted, and how is that claim verified?
position: Velocity Verlet at fixed substep (DT = 1/60 sim-s) for all coasting (symplectic, energy drift ~1e-13 over 50 periods); RK4 for finite-thrust arcs (thrust makes acceleration velocity-dependent, breaking Verlet's assumptions); burns otherwise impulsive Δv; moon levels are restricted three-body with the indirect term; every level's par is verified by a Node harness (test-physics.js) that imports the SHIPPED game code.
scope: workspace
load_profile: on_demand
session: session_01MtHFEZCTJS2eNpUuqH7dgc
entities: [fuel-golf]
tags: [fuel-golf, physics, integrator, verlet, rk4, oberth, test-harness, decision]
aliases: [fuel golf integrator choice, why verlet and rk4, how pars are verified, oberth emerges not scripted]
source_basis: transcript
human_edited: false
sensitivity: normal
---

# Fuel Golf physics core (2026-08-03)

## Position
- **Coasts**: velocity Verlet, fixed substep DT = 1/60 sim-s. Symplectic ⇒ bounded energy
  error; measured drift 8.8e-14 relative over 50 periods of the L1 ellipse, apsides held
  to <0.5%. Time-warp scales substep COUNT, never substep size.
- **Powered arcs (finite-thrust levels)**: RK4, because thrust along
  prograde/retrograde/radial tracks the instantaneous velocity/radius frame — a(v)
  dependence that velocity Verlet does not handle. Steering losses deliberately ignored
  (user call): thrust direction is always exactly the commanded frame direction.
- **Burns**: impulsive Δv applied instantly on levels 1–5; finite engines (levels 6–7 and
  sandbox-selectable) deliver committed Δv at a fixed acceleration over time.
- **Moon levels**: planet-centred restricted three-body — moon on an analytic circular
  orbit, its gravity on the craft plus the indirect term (moon's pull on the planet frame).
- **Nothing scripted**: goal detection, the Oberth advantage, gravity assists, and gravity
  losses are all consequences of the integrated dynamics. `game.js` exports the physics +
  level definitions; `test-physics.js` (33 checks) runs against those exact exports.

## Key verified numbers (sim units; ×158.2 → m/s)
- L3 escape: 4.18 Δv at periapsis vs 11.60 at apoapsis (2.77×); par 5.0 sits between.
- L5: direct escape 11.49 > par 9.0; moon-assist route found at 6.60 by grid search.
- L6 (a=0.35): centered-on-Pe burn 4.90 vs lit-at-Pe 5.81; par 5.3 splits them.
- L7 (a=0.08): six 10 sim-s perigee kicks 4.62 vs single centered burn 9.47; par 5.2.

## Consequences
- Any physics or level edit must keep `node test-physics.js` green; pars are load-bearing
  pedagogy (each is achievable only by the intended strategy).
- Prediction paths (dotted preview) reuse the same integrators, so previews are honest.

## Relations
- relates_to [[decision-fuel-golf-earth-units]] (display mapping over this scale-free core)
- relates_to [[decision-fuel-golf-finite-thrust-levels]] (levels built on the RK4 arc)
