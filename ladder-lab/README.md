# PLC Ladder Logic Trainer — a browser PLC trainer built on the stoplight program

*Ladder Lab.* Open `index.html` in any modern browser. **Nothing to install, no server, no
network** — it runs offline on school Chromebooks straight off a USB stick or a shared drive.

| File | What it is |
|---|---|
| `index.html` | The whole app — one self-contained file (~430 KB), built from `src/` plus the shared `../tools/lesson-shell/` kit. |
| `teacher-guide.html` | One-page printable teacher guide (hit **Print** in the corner). |
| `Ladder-Lab-Teacher-Guide.pdf` | The same guide, pre-rendered to one Letter page. |

The teacher guide is also the app's presenter notes: `build.js` lifts it out of
`src/demo-guide.html` and into `index.html`, so the printed sheet, the PDF and
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
with series = AND and parallel branches = OR. This engine's own duplicate-OTE "last write wins"
behavior is **Live** — verified by reading `src/engine.js` and by its self-test. That the
mapping and the last-write-wins behavior match real Allen-Bradley/Logix controllers is labeled
**Reasoned**, with a stated boundary, in the app's Details drawer (Stages 2 and 4): the primary
Rockwell documentation could not be read directly in this pass's research, and a genuine public
dispute exists for other hardware/configurations (retentive instructions, distributed I/O) —
see the Details drawer and `.aia/.data/demo-fleet-format-alignment/B-ladder-lab-progress.md` for
what was fetched and what was not.

## The four stages

- **Trainer** *(How does one scan run?)* — live ladder with power-flow animation on the left,
  animated intersection on the right, watch window and image tables below. Click any instruction
  for a plain-English explanation of what it does *right now*.
- **Editor** *(Why does rung order matter?)* — constrained palette editor: add/delete/reorder
  rungs, place contacts and coils, build parallel branches, assign tags from the fixed I/O list,
  set timer presets. Validation speaks English ("Rung 4 has two OTE coils for NS_GRN — the lower
  one wins every scan"). Save/load as JSON files.
- **Challenges** *(Can you build it?)* — four graded builds (seal-in → delayed start → stoplight
  from spec → crosswalk). Each runs your program against a scripted input sequence and checks
  output timing, telling you which step failed and when.
- **Troubleshoot** *(Can you find the fault?)* — inject one of eleven hand-authored faults,
  diagnose it from the intersection's misbehaviour and the ladder, then reveal the explanation.
  The predict-then-reveal "hide ladder pane" option lives in this stage's own Predict card.
  Solve times tracked (in this browser tab only, not saved).

These were four mode tabs before the lesson-shell v2 format retrofit (2026-09); they are the
same four activities, now presented as the tour's stage-navigation format with a stated question,
a Predict/Try/Takeaway strip, a Details drawer and a Check-yourself card per stage. The engine,
the seven programs, the ladder editor, the four challenges and the eleven faults are all
byte-for-byte unchanged by that pass — see `SPEC.md` and the node test suites below.

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
screen. Dismiss it with the **×**, a tap outside, or **Esc**; the **?** button in the header
reopens it any time.

## Teacher features

**⚙ Settings**, beside the **?**, offers three things first (drawn by the shared lesson-shell
kit, `../tools/lesson-shell/` — identical menu shape to every other demo in the tour):

- **Open Presenter Notes** — the teacher guide itself, inside the app.
- **Presentation mode** — large UI for the projector (including the ladder/sim/editor/challenge
  panels, at this demo's own larger scale), plus a one-tap Notes button in the header.
- **Reset** — back to the just-opened state: the PLC and intersection restart on Program 1, the
  editor's undo history and any unsaved student program are cleared, the active challenge and
  its hints reset, any injected fault is abandoned, and Timing returns to 1×/20 ms. **This is
  in-place, not a page reload** (kit v2) — Presentation mode stays as you set it; the Guide does
  not reopen.

This demo's own control follows below the triad: an **engine self-test** that runs 21 assertions
about scan semantics live, in a dialog, in front of the class. The predict-then-reveal
hide-ladder toggle used to live here too; it is now in the Troubleshoot stage's own Predict card,
where it is actually used.

**Presenter Notes are the teacher guide**, not a summary of it — the same lesson plan,
misconceptions, discussion questions and Model-and-boundaries section you would print.
`build.js` injects it from `src/demo-guide.html` at build time, so there is nothing to fetch at
runtime and nothing to keep in step by hand; `node build.js --check` fails if they ever drift.
The shipped filename stays `teacher-guide.html` (it predates the kit and `demo.json` keeps it so
no existing link breaks), even though the canonical source is now `src/demo-guide.html`.

The engine strip's **⟲ Reset PLC** is a different, smaller thing: it restarts the scan and the
intersection and leaves the program alone. It is visible on the Trainer and Troubleshoot stages,
where operating the PLC's timing is the point; Speed and Scan time live one click away, behind
a "Timing & speed" disclosure, to keep the first-screen control count low.

Keyboard: **Space** run/pause, **.** step one scan.

## Developing

Sources live in `src/` and are concatenated by `build.js`, together with the shared lesson-shell
kit at `../tools/lesson-shell/` (a build-time dependency only — the shipped `index.html` is still
one self-contained file with zero `<script src>`/`<link href>`). Never hand-edit `index.html` or
`teacher-guide.html` in this folder — edit `src/` and rebuild:

```
node build.js                  # writes index.html + teacher-guide.html here (demo root)
node build.js --check          # verifies both match src/, writes nothing
```

`--check` is also what proves the in-app presenter notes still equal the guide: the notes are
sliced out of `src/demo-guide.html` at build time, so any drift makes the committed `index.html`
stale and the check fails. It also checks the kit's version/CSS-hash stamp — a kit change reds
this demo until it is rebuilt (the fleet's back-propagation guarantee).

The printable PDF is rendered from the shipped guide by an installed Chrome or Edge (no
dependency to install):

```
node tools/pdf.mjs             # teacher-guide.html -> Ladder-Lab-Teacher-Guide.pdf (one page)
```

Test suites (the first four are pure node, no browser needed — none of them touch the shell or
the retrofit; they test the engine/programs/challenges/sim exactly as before it):

```
node src/engine.js --test                          # 21 scan-cycle / instruction semantics tests
node src/programs.test.js                           # 147 behavioural tests over the 7 programs + 11 faults
node src/challenges.test.js                          #  83 grader tests incl. reference solutions and review regression ratchets
node src/sim.test.js                                 #  intersection determinism
node build.js --check                                #  generated files match src/, notes still equal the guide
node ../tools/lesson-shell/check-shell.js ladder-lab  #  every template part present, reset contract implemented, no duplicate ids
node ../tools/build-hub.js --check                   #  fleet-wide compliance/README/launcher parity
node tools/integration.mjs     #  browser playtest of index.html (needs playwright + Chrome);
                               #  desktop, 1366x768 Chromebook and 390x844 phone passes — pre-existing
                               #  environment limitation, no Playwright install here (see
                               #  [[task-run-playwright-suites-after-contract-pass]]); its selectors
                               #  were updated for the kit's markup but it has not been re-run
```

`dist/` is retired (recycled) — it was a stale duplicate of this demo-root `index.html` sitting
inside the public URL space. `shots-integration/`'s 20 tracked PNGs (~4 MB) were also recycled
for the same reason; regenerate a fresh set with `node tools/integration.mjs` once Playwright is
available.
