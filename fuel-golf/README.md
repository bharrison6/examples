# ⛳ Fuel Golf

A browser-based orbital mechanics game for physics class. Students complete missions
using the least Δv — and discover the **Oberth effect** because the physics makes it
true, not because the game says so.

## Play

Open `index.html` in any browser. Fully offline, no install, mouse + touch
(Chromebook-friendly). Teachers: open `teacher-guide.html` for a printable one-page
session plan (also included pre-rendered as `teacher-guide.pdf`).

## What's real

- Newtonian gravity integrated with velocity Verlet at a fixed substep — an unburned
  orbit stays closed for 50+ periods (energy drift ~1e-13, verified).
- Burns are impulsive Δv in a chosen direction (prograde / retrograde / radial / free
  angle) with a live dotted preview of the resulting trajectory before you commit.
- Level 5 adds a moon (restricted three-body with the indirect term), so gravity
  assists work for real too.

## Levels

| # | Mission | Par | The lesson |
|---|---------|-----|-----------|
| 1 | Circularize your orbit | 4.5 | Controls; burns at apoapsis |
| 2 | Raise apoapsis to a ring | 7.0 | Burns move the *opposite* side of the orbit |
| 3 | **Escape Artist** | 5.0 | The aha: escape costs 4.18 Δv at periapsis, 11.60 at apoapsis |
| 4 | Transfer to an outer orbit | 11.5 | Hohmann discovery |
| 5 | Powered flyby of the moon | 9.0 | Gravity assist + Oberth burn |
| 6 | Sandbox | — | Free play, big tank |

## Verifying the physics

```
node test-physics.js   # runs 23 checks against the shipped game code
node ui-smoke.js       # headless Playwright playthrough of level 3 (optional)
```

`test-physics.js` imports the exact physics and level definitions the game ships
(`game.js` exports them), and checks integrator stability, the periapsis-vs-apoapsis
escape gap on level 3, that every level's par is achievable by the intended strategy,
and that level 5's par is only beatable with the moon's help.

## Teaching features

Toggleable physics HUD (speed, altitude, specific orbital energy, and a live
"energy gained per unit Δv" readout — the Oberth multiplier), per-level local
leaderboards, and a teacher mode (⚙) with a projector-friendly large-UI toggle
and leaderboard reset.
