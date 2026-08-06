# Ladder Lab — a browser PLC trainer built on the stoplight program

Open `index.html` in any modern browser. **No build step, no server, no network** — it runs
offline on school Chromebooks straight off a USB stick or a shared drive.

| File | What it is |
|---|---|
| `index.html` | The whole app — one self-contained file (~380 KB). |
| `teacher-guide.html` | One-page printable teacher guide (hit **Print** in the corner). |
| `Ladder-Lab-Teacher-Guide.pdf` | The same guide, pre-rendered to one Letter page. |

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

## Teacher features

**☰ Teacher** menu: projector mode (large UI), hide-ladder-pane (have the class predict the
logic from the intersection, then reveal it), reset everything, and an engine self-test that
runs 21 assertions about scan semantics in front of the class.

Keyboard: **Space** run/pause, **.** step one scan.

## Developing

Sources live in `src/` in the project repo and are concatenated by `build.js` into this single
file. Test suites (all pure node, no browser needed):

```
node src/engine.js --test      # 21 scan-cycle / instruction semantics tests
node src/programs.test.js      # 147 behavioural tests over the 7 programs + 11 faults
node src/challenges.test.js    #  83 grader tests incl. reference solutions and review regression ratchets
node src/sim.test.js           #  intersection determinism
node tools/integration.mjs     #  full browser playtest of the built app
```
