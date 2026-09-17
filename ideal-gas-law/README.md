# Ideal Gas Law Simulator

A two-dimensional kinetic-theory box, built offline for the classroom. Hard discs fly, bounce off
the walls and collide with each other. **Pressure is measured** by adding up the momentum the walls
receive, per second, per unit of wall; **temperature is computed** from the particles' kinetic energy.
The ideal gas law — `P·A = N·T` in this model's units — is never written into the simulation. It is a
prediction the gauges test, and the last stage grows the particles until it stops holding.

Live at `bharrison6.github.io/examples/ideal-gas-law/` once pushed. Part four of the
"AI: From Zero to Takeoff" tour.

## What it does

Four stages, one instrument. Each stage asks one question, captures a prediction, runs a fixed
routine (measure for four simulated seconds, change one thing, settle, measure again), and echoes the
prediction beside what the gauge showed.

| Stage | Change | What the gauge shows |
|---|---|---|
| 1 · Add particles | N 240 → 480 | P doubles; T unchanged; wall hits/s double |
| 2 · Heat it | T 300 → 600 | P doubles; hits/s rise by only √2; the histogram widens |
| 3 · Squeeze it | box width 100 → 50, thermostat on | P doubles; P·A constant. Thermostat off + piston by hand: T climbs |
| 4 · Test the law | radius 0.35 → 1.0 | Z = P·A/(N·T) rises from ≈1.03 to ≈1.3; sweeps plot measured vs predicted |

Free play is always available: sliders for N, T, box width and particle size; switches for the
thermostat, particle–particle collisions, pause and speed; a "start all at one speed" button that
shows the speed histogram relaxing into the 2D Maxwell curve.

## Physics, briefly

- 2D, reduced units: mass 1, k_B = 1, so `T = ½⟨v²⟩` (two degrees of freedom). Pressure is force per
  unit length; "volume" is area. One `DOF` constant in `src/model.js` drives every formula.
- Walls reflect position as well as velocity (a clamp would inject energy). The piston is a moving
  wall: `vx' = −vx + 2u`, which is the whole mechanism of adiabatic heating.
- Disc–disc collisions are exact elastic exchanges through a uniform grid; kinetic energy is conserved
  to floating-point precision with the thermostat off (`test-model.js` checks it).
- The thermostat rescales velocities toward the target (isokinetic); it changes only the distribution's width.
- Uncertainty shown as `P/√hits` — a Poisson rule of thumb, labelled Reasoned in Details.
- The stage-4 "expected drift" `Z ≈ 1/(1 − 2η)` is a first-order excluded-area estimate derived on
  the page, labelled Reasoned, not a citation.

## Files

```
src/template.html     the lesson-shell markup (four stages, Details, Guide, Settings)
src/styles.css        activity CSS only — the shell's is shared from ../tools/lesson-shell
src/model.js          physics + measurement, pure; CommonJS tail for node
src/app.js            frame loop, canvases, gauges, guided experiments, sweeps, shell events
src/demo-guide.html   CANONICAL presenter guide → presenter-guide.html, the PDF, and the in-app notes
build.js              assembles index.html; --check verifies parity
tools/pdf.mjs         renders the PDF with an installed Chrome/Edge (no dependencies)
test-model.js         headless physics checks
```

## Build and check

```bash
node build.js && node tools/pdf.mjs && node build.js --check
node test-model.js
node ../tools/lesson-shell/check-shell.js ideal-gas-law
node ../tools/build-hub.js --check
```

Then the browser pass (ADOPTING.md §6): serve locally, every stage renders (`checkVisibility()`),
console clean on a fresh tab, Reset restores, no overflow at 390 px.

## Modifying it

- Copy changes: `src/template.html` for stage text, checks and Details; `src/demo-guide.html` for the
  presenter notes (rebuild and re-render the PDF).
- Physics: `src/model.js`. Keep `DOF` the single source; run `node test-model.js`.
- The guided routines and sweep values: the `STAGES` and `SWEEPS` tables at the top of `src/app.js`.
- Defaults (N, T, box, radius, speeds): `DEFAULTS` and `LIMITS` in `src/model.js`; the slider ranges in
  `src/template.html` mirror `LIMITS` and must be kept in step by hand.

Bryant Harrison · Murray State University. Built with Claude Code (`built_with` in `demo.json`).
