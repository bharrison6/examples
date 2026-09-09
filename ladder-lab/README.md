# PLC Ladder Logic Trainer — a browser PLC trainer built on the stoplight program

*Ladder Lab.* Open `index.html` in any modern browser. **Nothing to install, no server, no
network** — it runs offline on school Chromebooks straight off a USB stick or a shared drive.

| File | What it is |
|---|---|
| `index.html` | The whole app — one self-contained file (~410 KB), built from `src/`. |
| `teacher-guide.html` | One-page printable teacher guide (hit **Print** in the corner). |
| `Ladder-Lab-Teacher-Guide.pdf` | The same guide, pre-rendered to one Letter page. |

The teacher guide is also the app's presenter notes: `build.js` lifts it out of
`src/teacher-guide.html` and into `index.html`, so the printed sheet, the PDF and
**⚙ Settings → Open Presenter Notes** are one document from one source.

## What makes it a real PLC and not an animation

The engine runs a genuine scan cycle, forever:

1. **Input scan** — every physical input is latched into the *input image table*.
2. **Solve** — rungs are solved strictly top-to-bottom, elements left-to-right, branch
   paths top-to-bottom, reading the image tables.
3. **Output scan** — the output image is written to the real outputs, all at once.

So a bit written by rung 5 is visible to rung 6 in the **same** scan, but to rung 4 only on the
**next** one. Nothing is event-driven. Timers accumulate in simulated scan-time, never wall clock,
which makes every run bit-for-bit reproducible.

**Step mode** is the feature no physical trainer has: pause, then advance exactly one scan at a
time with both image tables on screen, and watch precisely when each bit changes.

## Instruction set

XIC · XIO · OTE · OTL · OTU · ONS · TON · TOF (EN/TT/DN + live accumulators) · CTU · CTD · RES,
with series = AND and parallel branches = OR — Allen-Bradley semantics throughout, including
output instructions passing power through and double-coil "last write wins".

## Modes

- **Trainer** — live ladder with power-flow animation on the left, animated intersection on the
  right, watch window and image tables below. Click any instruction for a plain-English
  explanation of what it does *right now*.
- **Editor** — constrained palette editor: add/delete/reorder rungs, place contacts and coils,
  build parallel branches, assign tags from the fixed I/O list, set timer presets. Validation
  speaks English ("Rung 4 has two OTE coils for NS_GRN — the lower one wins every scan").
  Save/load as JSON files.
- **Challenges** — four graded builds (seal-in → delayed start → stoplight from spec →
  crosswalk). Each runs your program against a scripted input sequence and checks output timing,
  telling you which step failed and when.
- **Troubleshoot** — inject one of eleven hand-authored faults, diagnose it from the
  intersection's misbehaviour and the ladder, then reveal the explanation. Solve times tracked.

## Built-in programs

1. Basic timed stoplight (8 s green / 3 s yellow, cross-interlocked so both directions can
   never be green)
2. Stoplight + pedestrian crosswalk (request latched, granted only at the start of the next
   safe phase)
3. Sensor-actuated (E/W stays red until the inductive loop sees a car, minimum green respected)
4. Night flash via the selector switch (N/S flashing yellow, E/W flashing red)
5. Motor start/stop seal-in — teach latches before tackling the stoplight
6. Scan Order Demo A/B — the same two rungs in opposite order, one scan apart

## Getting oriented

The **Guide** overlay opens on every load — the scan cycle, step mode, and challenges in one
screen. Dismiss it with the **×**, a tap outside, or **Esc**; the **?** button in the top bar
reopens it any time.

## Teacher features

**⚙ Settings**, beside the **?**, offers three things first:

- **Open Presenter Notes** — the teacher guide itself, inside the app.
- **Presentation mode** — large UI for the projector, plus a one-tap notes button in the top bar.
- **Reset** — back to the just-opened state, program and editor and faults and all. It reloads,
  so it is a fresh load by construction. Presentation mode is a display preference rather than
  demo state and stays on across it, the same way it survives a reload; the Guide does not
  reopen.

Below those sit this demo's own controls: hide-ladder-pane (have the class predict the logic
from the intersection, then reveal it), the printable teacher guide, and an engine self-test
that runs 21 assertions about scan semantics in front of the class.

**Presenter Notes are the teacher guide**, not a summary of it — the same 45-minute lesson
plan, misconceptions, discussion questions and cheat sheet you would print. `build.js` injects
it from `src/teacher-guide.html` at build time, so there is nothing to fetch at runtime and
nothing to keep in step by hand; `node build.js --check` fails if they ever drift.

The top bar's **⟲ Reset PLC** is a different, smaller thing: it restarts the scan and the
intersection and leaves the program alone.

Keyboard: **Space** run/pause, **.** step one scan.

## Developing

Sources live in `src/` and are concatenated by `build.js` into the single file. Never hand-edit
`index.html` or `teacher-guide.html` in this folder — edit `src/` and rebuild. One command
writes every generated copy; there is no copy-up step:

```
node build.js                  # writes index.html + teacher-guide.html to dist/ AND here
node build.js --check          # verifies all four match src/, writes nothing
```

`--check` is also what proves the in-app presenter notes still equal the guide: the notes are
sliced out of `src/teacher-guide.html` at build time, so any drift makes the committed
`index.html` stale and the check fails.

The printable PDF is rendered from the shipped guide by an installed Chrome or Edge (no
dependency to install):

```
node tools/pdf.mjs             # teacher-guide.html -> Ladder-Lab-Teacher-Guide.pdf (one page)
```

Test suites (the first five are pure node, no browser needed):

```
node src/engine.js --test      # 21 scan-cycle / instruction semantics tests
node src/programs.test.js      # 147 behavioural tests over the 7 programs + 11 faults
node src/challenges.test.js    #  83 grader tests incl. reference solutions and review regression ratchets
node src/sim.test.js           #  intersection determinism
node build.js --check          #  generated files match src/, notes still equal the guide
node tools/integration.mjs     #  full browser playtest of dist/ (needs playwright + Chrome);
                               #  desktop, 1366x768 Chromebook and 390x844 phone passes
```
