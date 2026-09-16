# ⛳ Orbital Mechanics Golf — Murray State Racers Flight Lab

A browser-based orbital mechanics game for physics class. (Shipped from the
`fuel-golf/` folder, and known as *Fuel Golf* before it was renamed.) Students complete missions
using the least Δv — and discover the **Oberth effect** because the physics makes it
true, not because the game says so.

Themed in Murray State University colors: MSU Blue `#002144`, MSU Gold `#ECAC00`,
Lite Blue `#00A4E3`, with the university's alert Red Orange `#FF4500` reserved — as the
brand guidelines specify — for genuine failure states (crashes, fall-back trajectories).

Demo 7 of 16 in the *Zero to Takeoff* tour, and the first of Part four. It is built on
the shared **lesson shell** (`../tools/lesson-shell/`), so it carries the same eleven
template parts as every other demo in the tour — see `ADOPTING.md` beside the kit.

## Play

Open `index.html` in any browser. Fully offline, no install, mouse + touch
(Chromebook-friendly, with a phone layout). Teachers: open `teacher-guide.html` for a
printable session plan (also included pre-rendered as `teacher-guide.pdf`).
It is the same document the in-app **Presenter Notes** show — see below.

## The lesson, in four stages

The stage tabs above the flight view are the lesson's **beats**, not the eight levels.
Each opens with one question, a two-sentence refresh, and a **Predict / Try / Takeaway**
strip; each closes with a check-yourself card whose wrong options are the misconceptions
the stage risks leaving.

| Stage | Levels | The question | The takeaway |
|---|---|---|---|
| 1 · Burn at apoapsis | 1–2 | Which part of an orbit does a burn actually move? | A prograde burn changes the orbit half a revolution away |
| 2 · Escape at periapsis | 3–5 | Which burn point escapes for less Δv? | Energy bought scales with the speed you already have — 661 m/s vs 1,835 |
| 3 · Finite thrust | 6–7 | If the burn takes hours, when do you light it? | Cheapest centred on periapsis; a weak engine wants repeated kicks |
| 4 · Sandbox | 8 | What happens if you try it your own way? | Every working strategy spends Δv where v is large |

**Two gates, and they are different mechanisms on purpose.** Stage 3's *tab* is disabled
until an escape has been flown, and that `disabled` lives in the template markup so the
shell's Reset snapshot re-locks it. Stage 2's gate is on the *evidence*, not the tab: its
tab stays live and hash-addressable, but the flight view does not move in until the
prediction is committed — "which burn point escapes for less Δv" is the one question the
demo exists to ask, and a learner who has already watched the answer cannot be asked it.
A `#stage-3` deep link clamps to the furthest unlocked stage rather than routing around
the gate.

### Controls

| | |
|---|---|
| <kbd>B</kbd> burn planner · <kbd>Enter</kbd> commit · <kbd>Esc</kbd> cancel | <kbd>Z</kbd> undo burn · <kbd>X</kbd> cut engine |
| <kbd>Space</kbd> pause · <kbd>,</kbd> <kbd>.</kbd> warp down/up | <kbd>P</kbd> / <kbd>A</kbd> warp to periapsis / apoapsis |
| <kbd>H</kbd> physics HUD · <kbd>M</kbd> mission briefing | <kbd>F</kbd> follow camera · <kbd>R</kbd> restart level |
| <kbd>?</kbd> Guide · <kbd>N</kbd> Presenter Notes | <kbd>Esc</kbd> or a tap outside closes any popup |

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

- **Guide, always one tap away** — the shell's Guide card opens on every load and
  covers the Δv budget, aiming, and committing a burn. Dismiss it by tapping outside or
  pressing <kbd>Esc</kbd>; bring it back any time with **❓ Guide** in the header (or
  <kbd>?</kbd>). The activity's own four dialogs — mission briefing, level list, debrief
  and crash screen — are native `<dialog>` elements; the two that ask for a *decision*
  (crash, debrief) deliberately ignore stray taps on the backdrop.
- **The sim pauses whenever any dialog is open**, the shell's four included, so reading
  the Guide or the Details drawer never costs fuel.
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

## Build

`index.html` is an **artefact**, not a source. Edit `src/`, then:

```
node build.js                     # writes index.html and teacher-guide.html
node tools/pdf.mjs                # re-renders teacher-guide.pdf from the same source
node build.js --check             # parity across all four surfaces; writes nothing
```

`src/` holds `template.html`, `styles.css` (the *activity's* styles — the lesson shell's
are shared), `game.js` (physics core + browser game), `app.js` (the lesson layer) and
`demo-guide.html` (canonical for the printable page, the PDF and the in-app notes).
`build.js` inlines the shared kit's CSS and behaviour, so the shipped page is **one
self-contained file with zero `<script src>` and zero `<link href>`** — the kit is a
build-time dependency only.

## Verifying it

```
node test-physics.js                          # 33 checks against the shipped physics
node test-bundle.js                           # 56 structural checks on the BUILT page
node build.js --check                         # build parity + PDF freshness
node ../tools/lesson-shell/check-shell.js fuel-golf
node ../tools/build-hub.js --check
node ui-smoke.js                              # headless UI checks — needs Playwright
```

`test-physics.js` imports the exact physics and level definitions the game ships
(`src/game.js` exports them), and checks integrator stability, the periapsis-vs-apoapsis
escape gap on level 3, that every level's par is achievable by the intended strategy
(including centered finite burns on level 6 and perigee kicks on level 7 — and that
the naive strategies miss par), and that level 5's par is only beatable with the
moon's help.

`test-bundle.js` asserts the built page's structure: that every id `game.js` looks up
exists exactly once, that each stage has its panel, question, refresh, strip, cue and
check, that only the six provenance words are used, that both gates are authored where
Reset can restore them, and that the retrofit's invariants hold. Every group carries a
**negative control** — the same assertion re-run against deliberately corrupted input,
which must fail there. It states plainly what it cannot see: rendering, layout, listeners
and the console all need a real browser.

The optional browser smoke test uses Playwright, deliberately a separate test-only setup:

```
npm install --save-dev playwright
npx playwright install chromium
node ui-smoke.js
```

`ui-smoke.js` exits with a clear error if that dependency is absent; it never silently
skips browser coverage.

> **A note for anyone driving this headlessly.** The whole activity is frame-driven, and
> `requestAnimationFrame` does not tick in a hidden or behind-window browser pane
> (measured: 0 frames in 1000 ms, with `document.visibilityState` reporting `"hidden"`).
> Nothing will advance and the demo will look broken when it is not. Either make the
> window visible, or drive the loop yourself with `window.fuelGolf.stepFrame(t)`, which
> runs exactly one frame and does not re-queue.

## Teaching features

Toggleable physics HUD (speed, altitude, specific orbital energy, and a live
"energy gained per unit Δv" readout — the Oberth multiplier), per-level local
leaderboards, and a settings menu (⚙) holding the instructor controls.

**⚙ Settings** carries the three presenter controls in order: **Open Presenter Notes**,
**Presentation mode** and **Reset**. Presentation mode scales the page for the back row
and adds a 🎤 Notes button to the header.

**Reset is in place — no page reload.** It restores a first load: Level 1 on the pad, an
empty Δv tally, the trajectory and undo stack cleared, time-warp back to 1×, the HUD
open, all three predictions forgotten, stage 3 locked again, and the mission badges and
saved name cleared. It leaves two things alone on purpose. **Presentation mode**, because
re-shrinking the projector between rooms would be hostile. And the saved **class
leaderboards** — those hold *other students'* entries, and a one-click unconfirmed wipe of
another period's scores is a worse failure than a Reset that leaves persisted class data
alone. *Clear scores* (which asks first) and *Clear badges* sit below the triad for that.

**The Presenter Notes are the printable guide.** What ⚙ Settings → **Open Presenter
Notes** (or <kbd>N</kbd> while presenting) puts on screen is lifted at build time from
`src/demo-guide.html`, the same file `teacher-guide.html` is copied from and
`teacher-guide.pdf` is rendered from — one document, not three copies that drift.
Nothing is fetched to show it, and `node build.js --check` fails the moment any of the
four surfaces disagrees.

## Honesty labels

Every panel and readout carries exactly one of the tour's six provenance words.

| Label | Where, here |
|---|---|
| **Live** | the flight view, the HUD, the burn preview, the debrief's arithmetic — integrated in your browser as you watch |
| **Sourced** | Earth's μ and radius, from [NASA's Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html) (read 2026-09-16): GM 0.39860 × 10⁶ km³/s², volumetric mean radius 6371.000 km. And the *practice* of escaping by repeated perigee burns, from [ESA's SMART-1 mission page](https://www.esa.int/Science_Exploration/Space_Science/SMART-1/Ion_engine_gets_SMART-1_to_the_Moon) (31 Aug 2006, read 2026-09-16): "thrust arcs around the perigee and coast arcs around the apogee" |
| **Measured** | the seven pars and the 661 / 1,835 / 775 / 919 / 731 / 1,498 m/s comparisons, found against this exact engine. The integrator has no random element, so there is no seed — re-running `test-physics.js` reproduces every figure |
| **Illustrative** | the moon, on both levels that have one. Invented orbit, mass and size so an assist fits a class period; it is labelled **on the map itself**, not only in a caption |
| **Reasoned** | *why* low-thrust stages use repeated perigee burns — inferred from the 731-vs-1,498 measurement on this page and from [MIT OCW 16.07 Lecture L17](https://ocw.mit.edu/courses/16-07-dynamics-fall-2009/e6393974ce4ed22b095f2e1d1a6a8e81_MIT16_07F09_Lec17.pdf) (read 2026-09-16), which derives that the energy bought per Δv is largest where speed is largest. SMART-1's page states the practice, not the motive, and Details says so |

Nothing here is **Scripted**: there are no hand-authored fixtures in this demo. The
Oberth advantage is not written into the game — it falls out of the integrator.

The post-level debrief includes a **"show the math" proof panel**: every burn's
recorded before-state, the predicted Δε = v⃗·Δv⃗ + ½Δv² evaluated with the
player's actual numbers and checked against what the integrator measured, the
resulting orbit derived purely from (ε, h) via e = √(1 + 2εh²/μ²), and an
energy ledger from ε_start through each burn to the final outcome — on moon
levels the gravity assist appears as its own zero-fuel line item.
