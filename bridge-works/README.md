# Truss Bridge Builder

Murray State University · Part four, Example projects · Demo 8 of 17 · folder `bridge-works`

A browser-based truss bridge builder for physics and engineering class, on the tour's shared
lesson shell. Students design a bridge, **call which member goes first**, drive a vehicle across,
and compete to build the **cheapest bridge that survives** — and they learn statics because the
solver is real, not because the game says so.

## Play

Open `index.html` in any browser. One self-contained file, fully offline, no install, mouse + touch
(Chromebook-friendly, phone-sized screens included). The **Guide** opens on every load; dismiss it
with **Start with Mechanisms** and reopen it any time with **? Guide** in the header.

Four stages wrap one game:

| Stage | Levels | The question |
|---|---|---|
| 1 Mechanisms | 1–2 | Why does a flat roadway fold before anything breaks? |
| 2 Compression buckles | 3 | Why does one member hold 300 kN pulled but 45 kN pushed? |
| 3 Load paths | 4–5 | Where does the load go when the shape or the supports change? |
| 4 Sandbox | 6 | Which of your ideas survive a vehicle you pick? (outside the path) |

Each stage carries a stage question, a *Before you start* refresher, a **Predict · Try · Takeaway**
strip, the activity, a *Notice* line that names what just happened, a **Details** drawer (what is
live / how it works / assumptions / sources / boundary) and a **Check yourself** card. Stage tabs
are hash-addressable (`#stage-2`), and picking a level from inside the game moves the tabs with it.

**The call before the test.** The first load test in every stage waits until you commit a call
under the canvas — *it folds as a mechanism / a compression member buckles / a member tears in
tension / it holds*. After the crossing the call is echoed against the engine's own record of the
first failure, in the stage's Predict card and in the debrief. Once a stage has had one called
test it is **free play**: the button is open, the call is optional, and you can retry a level for
a lower cost as often as you like. That is the game.

Teachers: `teacher-guide.html` is the printable session plan (also pre-rendered as
`teacher-guide.pdf`), and it is the *same document* the app shows under **⚙ Settings → Open
Presenter Notes** — see [One source for the notes](#one-source-for-the-notes).

## What's real

This is a **direct stiffness** finite element solver, not spring physics. Every panel on screen
carries one of the six provenance words; here is the map.

- **Live** — the canvas, the colours, the joint tool, the fold, the debrief. Every member is a
  two-force axial element; element stiffnesses `(EA/L)·[c² cs; cs s²]` are rotated into global
  coordinates and assembled into **K**; supports are boundary conditions; **K·u = F** is solved for
  joint displacements and member forces follow from the strains. Statically indeterminate designs
  solve correctly, with load split by stiffness. The reduced matrix is factored by Gaussian
  elimination with **full pivoting**; a rank deficiency means a mechanism, and the null-space vector
  is projected onto exact member lengths and drawn — the fold the class watches is the real failure
  mode. The **moving load is quasi-static**: re-solved from scratch at every vehicle position, each
  wheel shared to its deck member's two joints by lever arm; an overloaded member is removed and the
  structure **re-solved with what is left**, so failures cascade.
- **Measured** — the pars. Found offline against this same solver by `test-physics.js`
  (deterministic — no seed; 86 checks): every par is beatable by a triangulated design and by no
  un-triangulated ladder at any depth or panel count.
- **Sourced** — Euler buckling `P_cr = π²EI/L²` (Purdue ME 323 notes), ASTM A36's specified minimum
  yield of 36 ksi (≈ 250 MPa; a *specified minimum, not typical*), E = 200 GPa (a reference-table
  value), and the four gallery dates from the patents themselves (Howe 1840, Whipple's bowstring
  1841, Pratt 1844) plus the Warren patent of 1848 via a STRUCTURE-magazine history. Every source
  is linked in the Details drawer with the date it was read (2026-09-16).
- **Reasoned** — the section (12 cm², I = 3.647 × 10⁻⁷ m⁴) and the 7,850 kg/m³ density are the
  authors' choices, and the drawer says the density is not sourced on the page. Also Reasoned, and
  stated where the learner meets a failure: **joints never fail here.** This is a steel truss with
  idealised pins — member buckling and yield are modelled, connection failure is not, and in real
  structures (especially glued or nailed ones) the connection is often what goes first. That is
  precisely why the pin-jointed idealisation is the honest choice for a statics lesson.
- **Illustrative** — the bill (9.42 kg/m at $4.80/kg ≈ $45/m, plus $180 per joint) and the five
  vehicles. The *shape* of the bill — connections roughly 45% of a typical design, so panel count is
  a real trade-off — is the teaching point.

Compression capacity is `min(0.6·σ_y·A, π²EI/L²)` = 180 kN capped, 80 kN at 3 m, 45 kN at 4 m,
over the *whole* unbraced straight run; tension capacity is `σ_y·A` = 300 kN at any length.
Collinear chains at unloaded joints are condensed into one element (springs in series, exact);
dangling members are pruned as zero-force and drawn grey.

## Levels

| # | Level | Span / vehicle | Par | Stage |
|---|-------|----------------|-----|-------|
| 1 | First Crossing | 6 m · car, 30 kN | $1,050 | 1 Mechanisms |
| 2 | The Long Gap | 12 m · car, 30 kN | $2,800 | 1 Mechanisms — opens with a rectangular frame |
| 3 | Heavy Haul | 10 m · truck, 125 kN | $2,800 | 2 Compression buckles |
| 4 | High Water | 12 m · van, 60 kN | $3,100 | 3 Load paths — nothing below the deck |
| 5 | Island Pier | 16 m · truck, 125 kN | $3,600 | 3 Load paths — a mid-span pier |
| 6 | Sandbox | 18 m · your choice | — | 4 Sandbox |

Nothing may exceed 4 m. Par is golf-style: survive the crossing for less than par.

## Teaching features

- **X-ray** parks the level's vehicle at mid-span and colours the structure live during the build —
  red tension, blue compression, brighter nearer its limit, grey carrying nothing.
- **Check a joint**: every force meeting at a joint drawn as an arrow, with the sum printed. It is
  always zero. That panel *is* the method of joints.
- **Weakest link**, docked under the canvas and always shown: the first failure (member, mode, the
  force it failed at against its rating, where the vehicle was) — or the busiest member if it held —
  **read from the test record**, never sampled from live state after the fact.
- **Debrief** after every test: verdict, your call against the record, cost vs par, every member's
  worst tension and compression and its buckling capacity at its actual unbraced length, peak sag,
  one plain-language sentence about *this* design, and **↶ Back to build — try for less** /
  **Next level →**.
- **Gallery** of Pratt, Howe, Warren and bowstring at adjustable depth and panel count.
- **Leaderboard** per level, stored in this browser only.
- **⚙ Settings**: **Open Presenter Notes**, **Presentation mode**, **Reset**, then Show par
  budgets, Keyboard editing, pick-the-vehicle demos (demo runs stay off the leaderboard), and the
  two-step **Class data** clears.

**Reset** is the shell's in-place reset — no reload. It puts back Level 1 with an empty gap, the
Draw tool, X-ray on, saved designs and personal bests cleared, every call and check answer
forgotten, stage 1 — and it **leaves the class leaderboard alone**, because that holds other
people's results and Reset is one click. *Reset this level's board* / *Reset every board* in
Settings ask twice and are the only way to clear it. Presentation mode stays as you set it.

## One source for the notes

`src/demo-guide.html` is canonical for three surfaces: the printable `teacher-guide.html` (a
copy), `teacher-guide.pdf` (a render), and the in-app presenter notes (injected). Its first
`<style id="guide-css">` block is scoped entirely to `.guide-scope`; the build refuses an unscoped
rule. **Edit the guide in `src/`, never the shipped copies.**

## Build

```
node build.js            # writes index.html and teacher-guide.html from src/ + ../tools/lesson-shell
node tools/pdf.mjs       # re-renders teacher-guide.pdf (needs Chrome or Edge)
node build.js --check    # parity: index.html, teacher-guide.html, the notes, PDF freshness, 5 script closers
```

`index.html` is **build output**, one self-contained file with zero `<script src>` and zero
`<link href>`; the shared lesson shell (`../tools/lesson-shell`) is a build-time dependency only.
The build counts the `</script>` closers in the assembled page and refuses on any number but five,
with a bait control — a page with too few runs nothing, silently. `physics.js` and `levels.js` stay
at the demo root, byte-for-byte the pre-shell files, because `test-physics.js` requires them from
there; `src/game.js` is the browser half and `src/app.js` the lesson layer.

The pre-shell `bridge-works-standalone.html`, `sync-standalone.js` and `tools/guide-sync.js` are
retired: the built `index.html` *is* the standalone.

## Verifying

```
node test-physics.js                                  # 86 checks against the shipped solver and levels
node build.js --check
node ../tools/lesson-shell/check-shell.js bridge-works
node ui-smoke.js                                      # headless Playwright playthrough (test-only setup)
```

`test-physics.js` checks solved member forces against hand statics, the indeterminate two-pin case,
that a bare rectangle is rank-deficient while the same rectangle plus one diagonal is not, that a
Warren's diagonals alternate with a fully tensile bottom chord, that Pratt and Howe diagonals carry
opposite signs, that compression capacity falls as 1/L², that overloading produces a progressive
collapse, that reactions carry exactly the applied dead load, that the fold drawn on screen keeps
every member at its exact length, and that every par is beatable only by a triangulated design.

`ui-smoke.js` drives the real page — drags on the canvas, commits a call, runs crossings, reads the
debrief, saves to the leaderboard, overloads a bridge with a crane, loads a Warren from the gallery
and asserts the Guide, Settings triad, presentation mode, in-place Reset and phone fit. It was
ported to the lesson shell on 2026-09-16 but **has not yet been executed** here: Playwright is not
installed in this checkout (`npm install --save-dev playwright && npx playwright install chromium`).
Treat its first run as a bring-up.
