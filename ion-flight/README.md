# Time-of-Flight Mass Spectrometer

Murray State University · Instrumental Analysis

**Time-of-Flight Mass Spectrometer** (folder `ion-flight/`) is a self-contained,
guided linear time-of-flight (TOF) mass-spectrometry investigation. Students predict and run three linked two-ion
experiments: change mass, change positive charge, then match mass-to-charge ratio.
The instrument animation, detector arrival cues, and trace produce the evidence used
to explain each prediction.

Open `index.html` in a browser. It is offline, needs no installation, and works with
mouse or touch. The Guide overlay opens on load and the `?` control reopens it. The
⚙ Settings menu offers **Open Presenter Notes**, **Presentation mode** and **Reset**
(back to the fresh-load state). Open `teacher-guide.html` to print the guide;
`teacher-guide.pdf` is the copy declared in the manifest, rendered from that same
canonical HTML by `tools/pdf.mjs`.

The presenter notes shown in the app are not a summary of the guide — they are the
guide. `build.js` injects the body and stylesheet of `teacher-guide.html` into
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
| `model.js` | Tested SI physics, lesson state/evidence, timing scale, and resolution comparison. |
| `app.template.html` | UI source containing the bundle marker. |
| `build.js` | Bundles `model.js` and the teacher guide into the offline `index.html`. |
| `test-model.js` | Independent numeric fixtures plus lesson-state, evidence, timing, and resolution invariants. |
| `test-build.js` | Verbatim bundle, actual inline-script syntax, lesson markers, cancellation, and read-only build checks. |
| `teacher-guide.html` | Canonical printable instructor guide, and the single source of the in-app presenter notes. |
| `tools/pdf.mjs` | Renders that guide to `teacher-guide.pdf` with an installed headless Chrome or Edge. No dependencies. |
| `tools/render_guide.py` | Superseded. The earlier ReportLab renderer; it predates the guide restructure, no longer matches the document shape, and needs a Python environment with ReportLab. Use `tools/pdf.mjs`. |

Run with the repository’s available Node runtime:

```powershell
node test-model.js
node test-build.js
node build.js --check
node tools/pdf.mjs --check
# Run these after changing app.template.html, model.js or teacher-guide.html:
node build.js
node tools/pdf.mjs
```

`node build.js --check` is read-only and fails if `index.html` is not the exact bundle
of the checked-in template, production model and teacher guide — which is also what
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

After editing `teacher-guide.html`, run `node build.js` to refresh the in-app notes and
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
