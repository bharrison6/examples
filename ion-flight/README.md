# Time-of-Flight Mass Spectrometer

Murray State University · Instrumental Analysis

**Time-of-Flight Mass Spectrometer** (folder `ion-flight/`) is a self-contained,
guided linear time-of-flight (TOF) mass-spectrometry investigation. It is **Demo 13 of
16** in the *AI: From Zero to Takeoff* tour (Part four, Example projects). Students
predict and run three linked two-ion experiments — change mass, change positive charge,
then match mass-to-charge ratio — and a fourth stage compares peak widths. The
instrument animation, detector arrival cues, and trace produce the evidence used to
explain each prediction.

The four stages appear as tabs under the header, each with the question it answers.
Stages 2 and 3 unlock as the previous stage produces evidence, because committing to a
prediction before observing is the point; stage 4 is open from the start. Each stage
carries a **Predict / Try / Takeaway** strip, an **observation cue** that names what to
notice as it happens, a **Details** drawer with the formula, the assumptions and the
sources, and a **Check yourself** card with written feedback on every option. A stage
can be deep-linked with `#stage-4`.

Open `index.html` in a browser. It is offline, needs no installation, and works with
mouse or touch. The Guide overlay opens on load and the `?` control reopens it. The
⚙ Settings menu offers **Open Presenter Notes**, **Presentation mode** and **Reset**
(back to the fresh-load state). Open `teacher-guide.html` to print the guide; `teacher-guide.pdf` is the copy declared
in the manifest. Both are generated from `src/demo-guide.html` — the canonical source —
by `build.js` and `tools/pdf.mjs`.

The presenter notes shown in the app are not a summary of the guide — they are the
guide. `build.js` injects the body and stylesheet of `src/demo-guide.html` into
`index.html` at build time, and `node build.js --check` fails if the two have
drifted, so the notes cannot quietly fall behind the printed document.

## Core investigation

The lesson opens with a concrete instrument path: voltage boost before the clock,
field-free flight through a vacuum, then detector arrival. Core conditions remain
fixed at 1.50 m and 20 kV so students can focus on one comparison at a time. Known
simulated inputs appear in the sample cards; exact arrivals and the completed trace
stay hidden until Run.

Every core run uses the same mapping of one physical microsecond to 160 screen
milliseconds and the same 0–18 µs trace axis. The detector curve is the summed
signal. Sample colors identify packet centers in the input, flight view, and trace.

The sequence establishes:

1. With +1 charge held constant, 100 Da arrives before 400 Da.
2. With 200 Da mass held constant, +2 arrives before +1.
3. 200 Da/+1 and 400 Da/+2 coincide because both have m/z = 200.
4. Whether a longer tube separates two close peaks depends on how the peak width
   behaves, not on the length alone.

The final transfer prompt asks why one detector peak cannot, by itself, establish
one kind of ion or identify a real molecule. Prediction feedback reports whether
the detector supports the selected prediction; it does not assign a mastery score.

## Model and optional extension

After acceleration through voltage `V`, the model uses a field-free drift region:

```
t = L √(m / (2qV))
```

Mass is converted from daltons to kilograms and positive charge number `z` is
converted to `q = z·e` coulombs. The displayed clock is drift time only; it excludes
acceleration time. This means that the ideal instrument separates **m/z**, not mass
alone: 200 Da at `z = 1` and 400 Da at `z = 2` coincide.

The optional advanced extension introduces timing width before sigma (σ) and compares
200 and 205 Da, both +1, in 1 m and 2 m tubes on one shared axis:

- **Fixed absolute σ** holds an absolute timing width constant. Increasing length
  makes the temporal separation larger, so the narrow-peak mass-resolution reference
  `m/Δm ≈ t/(2·FWHM)` rises.
- **Fixed fractional σ** makes σ a fixed percent of arrival time. Increasing length
  scales both separation and width, so the relative resolution does not improve.

The declared classroom criterion is center separation at least equal to mean FWHM.
Peak areas represent counts and are normalized by Gaussian area, so broadening a peak
does not create more ions. The width rules are assumptions, and the activity does not
promise that a longer tube universally improves resolution.

## Files and reproducible build

| File | Role |
| --- | --- |
| `src/model.js` | Tested SI physics, lesson state/evidence, timing scale, and resolution comparison. |
| `src/template.html` | Markup source, carrying the injection markers. |
| `src/styles.css` | The **activity** styles only — the instrument, the ion cards, the canvases. The lesson shell's styles are shared (see below). |
| `src/app.js` | The view layer: rendering, the flight animation, the detector trace, the stage-4 comparison. |
| `src/demo-guide.html` | Canonical printable instructor guide, and the single source of the in-app presenter notes and the PDF. |
| `build.js` | Bundles `src/` plus the shared lesson shell into the offline `index.html`, and copies the guide out to `teacher-guide.html`. |
| `test-model.js` | Independent numeric fixtures plus lesson-state, evidence, timing, and resolution invariants. |
| `test-build.js` | Verbatim bundle, inline-script syntax, the mechanism pins (animation clock origin, prediction lock, summed trace, width-rule assumption labels), the lesson-template parts, and the drift gate proved in four directions. |
| `teacher-guide.html`, `teacher-guide.pdf` | Generated. The shipped printable guide and its render; both derive from `src/demo-guide.html`. The filenames are public URLs and do not change. |
| `tools/pdf.mjs` | Renders the guide to `teacher-guide.pdf` with an installed headless Chrome or Edge. No dependencies. |

### The shared lesson shell

The header, stage tablist, stage intro, lesson strip, provenance kickers, observation
cue, Details drawer, check cards, dialogs, credit pill, breakpoints and presentation
scaling all come from **`../tools/lesson-shell/`**, which is one canonical copy shared
by every demo in the tour. `build.js` reads it at build time and inlines it, so the
shipped `index.html` is still a single self-contained file with zero `<script src>` and
zero `<link href>`. The build stamps the output with the kit's version and a hash of
its CSS, so if the kit changes and this demo is not rebuilt, `node build.js --check`
and `node ../tools/lesson-shell/check-shell.js ion-flight` both fail. Editing the
shell here is not possible by design: change it in the kit, and every demo gets it.

Run with the repository’s available Node runtime:

```powershell
node test-model.js
node test-build.js
node build.js --check
node tools/pdf.mjs --check
node ../tools/lesson-shell/check-shell.js ion-flight
# Run these after changing anything in src/ or in ../tools/lesson-shell/:
node build.js
node tools/pdf.mjs
```

`node build.js --check` is read-only and fails if `index.html` is not the exact bundle
of the checked-in sources, the production model, the teacher guide and the shared lesson shell — which is also what
proves the in-app presenter notes still match the printable guide. `node build.js`
writes that bundle. `test-build.js` runs the check both ways: clean sources pass, and
a copy of the demo whose guide was edited without a rebuild fails.
Scripts and styles are embedded; the page loads no external fonts, images, analytics,
or AI services. Verified in a browser over a local static server: loading and then
exercising the page — Guide, Settings, Open Presenter Notes, Presentation mode, Reset —
produced exactly one network request, the document itself. The built file contains no
`fetch`, `XMLHttpRequest`, `WebSocket`, `@import` or `url(http`, and its only absolute
links are the outbound `<a>` reading sources in the guide. Opening the file directly
from disk (`file://`) with the network switched off was not exercised in that pass.

After editing `src/demo-guide.html`, run `node build.js` to refresh the in-app notes and
`node tools/pdf.mjs` to re-render the PDF. The renderer drives an installed headless
Chrome or Edge (set `CHROME_PATH` to point at one elsewhere), needs no packages, and
resolves files relative to its own location. Inspect the rendered pages before sharing
the updated guide.

## Scope and sources

This is an idealized **linear** TOF lesson. It deliberately does not simulate an ion
source, extraction region, detector efficiency, reflectron energy focusing,
fragmentation, calibration, or molecular identification. Its physics presentation
follows Iowa State University Chemical Instrumentation Facility’s TOF overview:
an electric field gives ions `qV` kinetic energy, followed by a field-free drift
region and detector timing. The guide links the instructional source and a Shimadzu
MALDI overview for classroom context; neither source endorses this demo.

## Contract features

- Murray State navy, gold, and lite-blue theme, with visible Bryant Harrison and
  Murray State University attribution.
- Guide overlay on the `?` control, and a Settings menu offering Open Presenter Notes,
  Presentation mode, and Reset.
- Presenter notes generated from the printable guide at build time, with a `--check`
  that fails on drift.
- Responsive controls and canvas traces for phone-sized layouts.
- Printable [HTML teacher guide](teacher-guide.html) and [PDF](teacher-guide.pdf).
