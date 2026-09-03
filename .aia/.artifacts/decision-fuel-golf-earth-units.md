---
id: fuel-golf-earth-units
artifact_kind: decision
schema_version: 2
title: Fuel Golf units — the planet IS Earth; display-only mapping onto the scale-free sim; moon stays fictional
created: 2026-08-03T18:04:28Z
updated: 2026-08-03T18:04:28Z
author: msu.soeai
model: claude-fable-5
model_basis: confirmed
status: chosen
question: Should Fuel Golf show real units, and can its numbers be made realistic for Earth without changing the simulation?
position: Yes to both — the sim is scale-free, so declaring the planet to be Earth (μ = 398,600 km³/s², R = 6,371 km) pins a pure display mapping (1 world unit = 159.275 km, 1 sim-second = 1,006.8 s) with zero physics changes; all UI shows km/s, m/s, km, km²/s², m/s², real durations and a mission clock. The moon remains fictional (closer/heavier than Luna) for class-period pacing, disclosed in help/README/guide.
scope: AIA
load_profile: on_demand
session: session_01MtHFEZCTJS2eNpUuqH7dgc
entities: [fuel-golf]
tags: [fuel-golf, units, earth-scale, realism, display-mapping, decision]
aliases: [fuel golf real units, earth scale mapping, why the moon is fake, unit conversion constants]
source_basis: transcript
human_edited: false
sensitivity: normal
decided_by: human
---

# Fuel Golf Earth-unit mapping (user-prompted, 2026-08-03)

## Position
- Planet drawn at 40 world units = Earth's 6,371 km ⇒ **KM_PER_U = 159.275**.
- Matching μ_sim = 1e5 to μ_Earth = 398,600 km³/s² ⇒ **SEC_PER_TU = 1,006.8 s**.
- Derived: 1 speed unit = 0.1582 km/s (158.2 m/s); 1 energy unit = 0.02503 km²/s²;
  1 accel unit = 0.1571 m/s². Constants live at the top of `game.js`; sim internals,
  level definitions, leaderboard storage, and the test harness stay in sim units.
- Display conventions: speeds km/s, Δv budgets m/s (aerospace convention), altitudes km,
  ε km²/s², engine accel m/s², durations + mission clock in min/h/d.
- Resulting realism (spot-checks): L3 orbit ≈ 17,500 × 76,500 km alt, v_pe = 6.08 km/s,
  periapsis escape 661 m/s vs apoapsis 1,835 m/s (par 791); periods 22–28 h; engines
  0.055 / 0.013 m/s² (apogee-motor / electric-propulsion class); perigee kicks ≈ 3 h.
- **Moon is licensed fiction**: ~83,000 km orbit, heavier than Luna, so a gravity assist
  fits one class period. Disclosed in the help modal, README, and teacher guide.

## Consequences
- Docs (README, teacher guide) restated in m/s; teacher guide kept to one printed page.
- Old leaderboard entries (stored in sim units) remain valid — conversion is render-time.

## Relations
- relates_to [[decision-fuel-golf-physics-core]] (the scale-free core this maps onto)
