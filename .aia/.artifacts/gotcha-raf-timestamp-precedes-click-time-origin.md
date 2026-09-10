---
id: gotcha-raf-timestamp-precedes-click-time-origin
artifact_kind: memory
memory_class: semantic
semantic_kind: state
schema_version: 2
title: requestAnimationFrame's first timestamp can precede a performance.now() sampled in the click handler — a throwing nonnegative guard then kills the frame loop and strands the UI in "running"
created: 2026-09-10T22:40:31Z
updated: 2026-09-10T22:40:31Z
author: claude
model: claude-fable-5-1
model_basis: confirmed
status: active
lifecycle: active
load_profile: on_demand
scope: examples
prevention_site: any frame loop that subtracts a start time from the requestAnimationFrame timestamp — take the origin from the first frame's own timestamp, never from performance.now() sampled in the triggering event handler
tags: [gotcha, browser, requestanimationframe, performance-now, animation, intermittent, ion-flight, demos, frame-loop]
aliases: [run detector does nothing, ion-flight stuck running, negative elapsed on first frame, screenElapsedMs must be nonnegative, rAF timestamp earlier than performance.now, intermittent animation never starts, one run works and the next does not]
entities: [examples-repo]
session: f194fb24-76fa-4670-83f2-89c3eb51caf7
source_basis: transcript
confidence: 95
human_edited: false
sensitivity: normal
---

# The first animation frame can be "earlier" than the click that started it

## Symptom (ion-flight, 2026-09-10)

Operator report: choose a prediction, press **Run detector**, nothing happens. Intermittent on
desktop Chrome and on a phone — "one run doesn't work and other does". In the stuck state the
Run button and the prediction buttons are greyed out, the detector clock reads
"Waiting for Run", and nothing recovers except Settings → Reset or a reload. The console shows
nothing; the error only surfaces through `window.onerror`.

## Mechanism

`runCurrentExperiment` recorded the run origin as `performance.now()` inside the click handler,
then scheduled `requestAnimationFrame(frame)`. The `now` a frame callback receives is the
**frame's start time**, not the time the callback runs. When the click lands partway through
a frame interval, the next callback's timestamp can be up to one frame (~16 ms at 60 Hz)
**earlier** than the `performance.now()` the handler sampled. `now - startMs` goes negative.

`model.js` guards `physicalElapsedSeconds` with a `RangeError` on negative input — a correct
invariant for the model. Thrown inside the frame callback it has a different effect: the
callback never reaches `requestAnimationFrame` for the next frame, so the loop dies, and
`runtime.phase` stays `'running'` forever. Every re-render then keeps the Run and prediction
buttons disabled because the phase says a run is in progress. Whether a given click fails
depends only on where in the frame interval it landed, which is why it is intermittent and
device-independent.

Observed: 4 of 4 scripted runs stuck on the unfixed bundle (`Uncaught RangeError:
screenElapsedMs must be nonnegative` on each), 10 of 10 clean after the fix with the same
probe.

## Why the suites did not catch it

`test-model.js` tests the guard with valid inputs; the defect is an interaction between two
browser clocks inside the UI loop, which no static or model-level test exercises.
`test-build.js` inspects the bundle textually. The earlier browser walkthroughs happened to
click at a lucky phase.

## Fix (commit in this scope, 2026-09-10)

Use one clock: the frame loop takes its origin from the first frame's own timestamp
(`if (!runtime.startMs) runtime.startMs = now;`), so the first elapsed is exactly zero and
every later one is nonnegative because rAF timestamps are monotonic within a document.
`test-build.js` now fails if the bundle seeds `runtime.startMs` from `performance.now()`
again. The model guard was left intact; it was right to be strict.

## Same offset elsewhere in this repo — no defect

`fuel-golf/game.js`, `the-stranger/src/app.template.html`, `takeoff/src/chart.js` and
`should-have-known-that/index.html` all subtract a `performance.now()` origin from a frame
timestamp, so their first frame can also see a slightly negative delta. Each clamps
(`Math.min`/`Math.max`) or tolerates it for one frame instead of throwing, so nothing
user-visible happens. Left untouched; if any of them ever adds a throwing guard, this
gotcha applies.

## How to recognize it next time

- An animation that "sometimes never starts" with an empty console: hook `window.onerror`
  or `addEventListener('error')` before reproducing; an exception inside an rAF callback does
  not print through the harness console reader.
- Any pattern `start = performance.now()` in an event handler followed by `frame(now)` using
  `now - start`: first-frame delta may be negative.
