# ⛳ Fuel Golf

A browser-based orbital mechanics game for physics class. Students complete missions
using the least Δv — and discover the **Oberth effect** because the physics makes it
true, not because the game says so.

## Play

Open `index.html` in any browser. Fully offline, no install, mouse + touch
(Chromebook-friendly). Teachers: open `teacher-guide.html` for a printable one-page
session plan (also included pre-rendered as `teacher-guide.pdf`).

## What's real

- **The planet is Earth at true scale**: μ = 398,600 km³/s², radius 6,371 km. The
  sim is scale-free internally; the display maps 1 world unit = 159.275 km and
  1 sim-second = 1,006.8 s so that μ comes out exactly right. All UI numbers are
  physical: speeds in km/s, Δv budgets in m/s, altitudes in km, ε in km²/s²,
  mission clock in hours/days. (The moon is fictional — closer and heavier than
  Luna — so a gravity assist fits a class period.)
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
| 1 | Circularize your orbit | 712 m/s | Controls; burns at apoapsis |
| 2 | Raise apoapsis to a ring | 1,107 m/s | Burns move the *opposite* side of the orbit |
| 3 | **Escape Artist** | 791 m/s | The aha: escape costs 661 m/s at periapsis, 1,835 m/s at apoapsis |
| 4 | Transfer to an outer orbit | 1,819 m/s | Hohmann discovery |
| 5 | Powered flyby of the moon | 1,424 m/s | Gravity assist + Oberth burn |
| 6 | Ignition Window (0.055 m/s² thrust) | 838 m/s | Center the burn on periapsis: lit at Pe costs 919, centered 775 |
| 7 | Perigee Kicks (0.013 m/s² thrust) | 823 m/s | One long burn costs 1,498; six ~2.8 h kicks cost 731 |
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

The post-level debrief includes a **"show the math" proof panel**: every burn's
recorded before-state, the predicted Δε = v⃗·Δv⃗ + ½Δv² evaluated with the
player's actual numbers and checked against what the integrator measured, the
resulting orbit derived purely from (ε, h) via e = √(1 + 2εh²/μ²), and an
energy ledger from ε_start through each burn to the final outcome — on moon
levels the gravity assist appears as its own zero-fuel line item.
