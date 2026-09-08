# Bridge Works

Murray State University · School of Engineering

A browser-based truss bridge builder for physics class. Students design a bridge, drive a
vehicle across it, and compete to build the **cheapest bridge that survives** — and they learn
statics because the solver is real, not because the game says so.

## Play

Open `index.html` in any browser. Fully offline, no install, no build step, mouse + touch
(Chromebook-friendly, phone-sized screens included). A **How to play** card opens on every
load — dismiss it with ✕, Escape, a tap outside or **Start building**, and reopen it any time
with the **?** button in the top bar.

Teachers: open `teacher-guide.html` for a printable one-page session plan (also included
pre-rendered as `teacher-guide.pdf`). `bridge-works-standalone.html` is the same game as a
single file, for handing out on a stick or a locked-down machine.

## What's real

This is a **direct stiffness** finite element solver, not spring physics.

- **2D pin-jointed truss.** Every member is a two-force axial element carrying only tension or
  compression. Element stiffness matrices `(EA/L)·[c² cs; cs s²]` are rotated into global
  coordinates and assembled into a global **K**; supports are applied as boundary conditions;
  **K·u = F** is solved for joint displacements, and member forces follow from the strains.
- **Statically indeterminate designs solve correctly.** Students pile on extra members, brace
  every panel twice, and use two pinned abutments. Method of joints cannot solve any of that; a
  stiffness solve can, because the load splits by stiffness rather than by equilibrium alone.
- **Mechanisms are detected, not crashed into.** The reduced stiffness matrix is factored by
  Gaussian elimination with **full pivoting**, which reports the rank honestly. A rank deficiency
  means the structure can move without straining anything — the null-space vector is extracted
  from the elimination and the game animates the bridge folding *along that exact direction*, so
  what the class watches collapse is the real mathematical failure mode.
- **Compression is the weak direction.** Tension capacity is `σ_y·A = 300 kN` at any length.
  Compression is Euler buckling, `P_cr = π²EI/L² ≈ 720 kN·m²/L²`, capped at 180 kN — so a 2 m
  strut holds 180 kN and a 4 m strut holds 45 kN. This is the single fact that makes cheap
  designs hang the deck instead of propping it.
- **Progressive collapse.** When a member exceeds its rating it is removed and the structure is
  **re-solved with what is left**, repeatedly. On a minimal truss the first break is fatal; on a
  redundant one you get a genuine cascade (buckle → re-solve → tear → re-solve → mechanism).
- **The moving load is quasi-static.** The vehicle is re-solved from scratch at every position as
  it crosses; each wheel load is distributed to the two ends of the deck member it stands on by
  lever arm, the standard tributary distribution to panel points.
- **Optional dead load** (member steel plus its share of the deck it carries, 900 N/m), lumped half to each end of every member.

Two details worth knowing, because students hit both: a joint dropped in the middle of a straight
strut would make **K** singular in a pure pin-jointed idealisation, so collinear chains are
condensed into one equivalent element (springs in series, `EA/L_total` — exact) and the buckling
length stays the *whole* chain, since an unbraced intermediate pin braces nothing. And a member
dangling off a half-built structure is pruned as a zero-force member and drawn grey, rather than
being reported as a collapse.

## Levels

| # | Level | Span / vehicle | Par | The lesson |
|---|-------|----------------|-----|------------|
| 1 | First Crossing | 6 m · car, 30 kN | $1,050 | A flat roadway is a mechanism |
| 2 | **The Long Gap** | 12 m · car, 30 kN | $2,800 | Opens with a rectangular frame. Test it, watch it fold, add diagonals |
| 3 | Heavy Haul | 10 m · truck, 125 kN | $2,800 | Capacity, and why long compression members buckle first |
| 4 | High Water | 12 m · van, 60 kN | $3,100 | Nothing below the deck — through truss or bowstring |
| 5 | Island Pier | 16 m · truck, 125 kN | $3,600 | A mid-span support beats more steel |
| 6 | Sandbox | 18 m · your choice | — | Free build, pick any vehicle |

Costing follows a fabricator's bill rather than a flat rate: **steel by weight** (9.4 kg/m at $4.80/kg,
about **$45/m**) plus **$180 per joint** for the gusset plate, bolts and labour. Connections come out at
roughly 45% of a typical design, which makes panel count a real trade-off — bracing a panel you already
have costs steel only, adding a panel costs a joint too. Abutment bearings are provided by the level.
Nothing may exceed 4 m. Par is golf-style: survive the crossing for less than par.

## Teaching features

- **X-ray** parks the test vehicle at mid-span and colours the structure live during the build
  phase — red tension, blue compression, brighter as it nears its limit — before committing.
- **Joint tool**: tap any joint to see the force vector of every member meeting there, with the
  sum printed. It is always `0.0, 0.0`. That panel *is* the method of joints.
- **Force numbers** overlay in kN.
- **Debrief** after every test: every member's worst tension and compression, its buckling
  capacity at its actual unbraced length, the weakest link highlighted, cost vs par, peak sag,
  and one plain-language sentence about *this* design. A pure mechanism reports which joints ran
  away and in which direction instead of a table of zeros.
- **Gallery** of Pratt, Howe, Warren and bowstring at adjustable depth and panel count — load
  them into the current level and compare where each sends the load.
- **Leaderboard** per level, stored in the browser, so each machine keeps its own class list.
- **Settings (⚙)** holds everything a presenter needs:
  - **Presentation mode** — large UI for the back of the room, and it parks a **🗒 Notes** button
    in the top bar so the stage notes stay one tap away mid-demo.
  - **Presenter's notes** — a 30-minute run of show distilled from the teacher guide: the beat for
    each block of the session, the numbers to have ready (300 kN pulled at any length; 180/180/80/45 kN
    pushed at 1/2/3/4 m; $45/m of steel plus $180 a joint), the determinacy count, the three
    misconceptions with the move that kills each, and the discussion questions. The full guide is one
    button away from there.
  - Leaderboard resets, projector display options, keyboard editing, and an option to pick the test
    vehicle on any level — for showing a class what happens when a bridge that comfortably carried a
    car meets a 20 tonne crane. Demo runs stay off the leaderboard.

## Verifying the physics

```
node test-physics.js   # shipped solver and level-definition regression suite
node ui-smoke.js       # headless Playwright playthrough (test-only setup below)
```

`test-physics.js` imports the exact files the browser loads (`physics.js`, `levels.js`) and
checks solved member forces against hand statics, the indeterminate two-pin case, that a bare
rectangle is rank-deficient while the same rectangle plus one diagonal is not, that a Warren
truss's diagonals alternate tension/compression with a fully-tensile bottom chord and
fully-compressive top chord, that Pratt and Howe diagonals carry opposite signs, that compression
capacity is below tension capacity at every length and falls as 1/L², that overloading produces a
multi-member progressive collapse, that reactions carry exactly the applied dead load, and
that **every level's par is beatable while no un-triangulated ladder survives any level at any
depth or panel count**.

`ui-smoke.js` drives the actual game: it builds a truss by dragging on the canvas, checks the
running cost, opens the free-body inspector and asserts ΣF = 0, runs a crossing, reads the
debrief, saves to the leaderboard, overloads the same bridge with a crane and confirms the
collapse, watches the level-2 frame fold, braces it and confirms it then survives, and loads a
Warren from the gallery and reads the alternating colour pattern off the live analysis.

It also holds the demo to the repo's UX contract: the how-to opens on load and is dismissible four
ways and reopenable from **?**; ⚙ opens a settings menu offering presentation mode; the presenter's
notes open from settings and from the top-bar shortcut presentation mode adds; the attribution names
author and institution; the how-to and the notes fit a 390 × 844 phone and the canvas still draws
there; and **not one request leaves the folder** — the offline claim is asserted, not assumed.

With dead load enabled, every live member contributes its lumped load before the solver's
zero-force-stub cleanup. A loose vertical hanger therefore retains its 900 N/m dead-load share; if its
geometry cannot route that load through axial members, the solver reports the resulting mechanism
instead of silently deleting the member.

The demo itself is build-free and offline. Browser smoke coverage is optional and needs the
test-only Playwright setup (`npm install --save-dev playwright`, then `npx playwright install
chromium`); the smoke script exits loudly when it is unavailable. Keep the offline standalone
edition exact with `node sync-standalone.js --check` (or regenerate it with `node sync-standalone.js`).
