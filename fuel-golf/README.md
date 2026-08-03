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
- Levels 6–7 switch to **finite thrust**: committed Δv is delivered over time by an
  engine with limited acceleration (RK4-integrated during the powered arc, since
  thrust makes acceleration velocity-dependent; steering losses are ignored). This
  makes burn *timing* matter: single burns must be centered on periapsis, and a weak
  engine forces multiple perigee kicks.
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
| 6 | Ignition Window (finite thrust) | 5.3 | Center the burn on periapsis: lit at Pe costs 5.81, centered 4.90 |
| 7 | Perigee Kicks (weak engine) | 5.2 | One long burn costs 9.47; six 10-s kicks cost 4.62 |
| 8 | Sandbox | — | Free play, big tank, swappable engines |

## Verifying the physics

```
node test-physics.js   # runs 33 checks against the shipped game code
node ui-smoke.js       # headless Playwright playthrough (levels 3 and 6, optional)
```

`test-physics.js` imports the exact physics and level definitions the game ships
(`game.js` exports them), and checks integrator stability, the periapsis-vs-apoapsis
escape gap on level 3, that every level's par is achievable by the intended strategy
(including centered finite burns on level 6 and perigee kicks on level 7 — and that
the naive strategies miss par), and that level 5's par is only beatable with the
moon's help.

## Teaching features

Toggleable physics HUD (speed, altitude, specific orbital energy, and a live
"energy gained per unit Δv" readout — the Oberth multiplier), per-level local
leaderboards, and a teacher mode (⚙) with a projector-friendly large-UI toggle
and leaderboard reset.
