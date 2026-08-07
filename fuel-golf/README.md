# ⛳ Fuel Golf — Murray State Racers Flight Lab

A browser-based orbital mechanics game for physics class. Students complete missions
using the least Δv — and discover the **Oberth effect** because the physics makes it
true, not because the game says so.

Themed in Murray State University colors: MSU Blue `#002144`, MSU Gold `#ECAC00`,
Lite Blue `#00A4E3`, with the university's alert Red Orange `#FF4500` reserved — as the
brand guidelines specify — for genuine failure states (crashes, fall-back trajectories).

## Play

Open `index.html` in any browser. Fully offline, no install, mouse + touch
(Chromebook-friendly, with a phone layout). Teachers: open `teacher-guide.html` for a
printable one-page session plan (also included pre-rendered as `teacher-guide.pdf`).

### Controls

| | |
|---|---|
| <kbd>B</kbd> burn planner · <kbd>Enter</kbd> commit · <kbd>Esc</kbd> cancel | <kbd>Z</kbd> undo burn · <kbd>X</kbd> cut engine |
| <kbd>Space</kbd> pause · <kbd>,</kbd> <kbd>.</kbd> warp down/up | <kbd>P</kbd> / <kbd>A</kbd> warp to periapsis / apoapsis |
| <kbd>H</kbd> physics HUD · <kbd>M</kbd> mission briefing | <kbd>F</kbd> follow camera · <kbd>R</kbd> restart |
| <kbd>?</kbd> how to play · <kbd>N</kbd> presenter's notes | <kbd>Esc</kbd> or a tap outside closes any popup |

Drag the map to pan (or to aim a free-angle burn while the planner is open); scroll or
pinch to zoom.

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

## Play-experience features

- **How to play, always one tap away** — the how-to popup opens on every load and
  covers the Δv budget, aiming, and committing a burn. Dismiss it by tapping outside,
  pressing <kbd>Esc</kbd>, or hitting **Fly**; bring it back any time with **❓** in the
  top bar (or <kbd>?</kbd>). The dialogs that ask for a decision — the crash screen and
  the debrief — deliberately ignore stray taps.
- **↶ Undo burn** — every committed burn snapshots the flight state, so a misjudged or
  fatal burn rewinds instead of costing a level restart. Offered directly on the crash
  screen. Students iterate fast; that is the whole point in a 20-minute session.
- **Time-to-periapsis / apoapsis countdowns** in the HUD, plus a **lead-time warp**
  (→ Pe with a lead in minutes). Together with the planner's burn-duration readout these
  are the tools students need to *compute* a periapsis-centered burn on levels 6–7 —
  the game supplies the instruments, not the answer.
- **Live thrust vector** on the craft while planning (direction, magnitude, m/s label),
  **hollow Pe′/Ap′ markers** showing where the new apsides will land, and a solid orange
  powered arc for finite burns — all before committing fuel.
- **Drag-to-aim**: drag the map with the planner open to point a free-angle burn.
- **Camera**: pan by dragging, follow-cam toggle, and an off-screen CRAFT pointer so you
  can never lose the ship.
- **Progress tracking**: per-level ✓ / 🏆 badges, a completion bar, and a mission
  briefing panel (📋) recallable at any time.
- Sim **pauses whenever a dialog is open**, so reading never costs fuel.

## Verifying the physics

```
node test-physics.js   # 33 checks against the shipped physics + level definitions
node ui-smoke.js       # headless UI checks, including keyboard cards and modal focus
```

The game itself has no build step, package install, or network dependency. The optional
browser smoke test uses Playwright, which is deliberately a separate test-only setup:

```
npm install --save-dev playwright
npx playwright install chromium
node ui-smoke.js
```

`ui-smoke.js` exits with a clear error if that dependency is absent; it never silently
skips browser coverage. The smoke assertions are intentionally not given a fixed count,
so adding a regression check cannot leave this README stale.

`test-physics.js` imports the exact physics and level definitions the game ships
(`game.js` exports them), and checks integrator stability, the periapsis-vs-apoapsis
escape gap on level 3, that every level's par is achievable by the intended strategy
(including centered finite burns on level 6 and perigee kicks on level 7 — and that
the naive strategies miss par), and that level 5's par is only beatable with the
moon's help.

## Teaching features

Toggleable physics HUD (speed, altitude, specific orbital energy, and a live
"energy gained per unit Δv" readout — the Oberth multiplier), per-level local
leaderboards, and a settings menu (⚙) holding the instructor controls.

**Presentation mode** (⚙ Settings) scales the UI for the back row and adds a 🎤 Notes
button to the top bar. It opens the **presenter's notes** — the teacher guide distilled
to one podium-sized screen: the 20-minute run of show, the one idea (Δ KE = v·Δv + ½Δv²),
the three misconceptions to catch, the pars and the escape-cost gap, and questions to ask
the room. Reachable from ⚙ Settings or <kbd>N</kbd> at any time, and it links through to
the full printable guide. Leaderboard and mission-progress resets live in ⚙ Settings too.

The post-level debrief includes a **"show the math" proof panel**: every burn's
recorded before-state, the predicted Δε = v⃗·Δv⃗ + ½Δv² evaluated with the
player's actual numbers and checked against what the integrator measured, the
resulting orbit derived purely from (ε, h) via e = √(1 + 2εh²/μ²), and an
energy ledger from ε_start through each burn to the final outcome — on moon
levels the gravity assist appears as its own zero-fuel line item.
