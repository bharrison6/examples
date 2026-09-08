# Ion Flight

Murray State University · Instrumental Analysis

**Ion Flight** is a self-contained, guided linear time-of-flight (TOF)
mass-spectrometry investigation. Students predict and run three linked two-ion
experiments: change mass, change positive charge, then match mass-to-charge ratio.
The instrument animation, detector arrival cues, and trace produce the evidence used
to explain each prediction.

Open `index.html` in a browser. It is offline, needs no installation, and works with
mouse or touch. The how-to overlay opens on load and the `?` control reopens it. The
⚙ menu provides presentation mode and concise on-screen presenter’s notes. Open
`teacher-guide.html` to print the guide; `teacher-guide.pdf` is the two-page
copy declared in the manifest and rendered from that canonical HTML.

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
| `build.js` | Bundles `model.js` into the offline `index.html`. |
| `test-model.js` | Independent numeric fixtures plus lesson-state, evidence, timing, and resolution invariants. |
| `test-build.js` | Verbatim bundle, actual inline-script syntax, lesson markers, cancellation, and read-only build checks. |
| `teacher-guide.html` | Printable instructor guide. |
| `tools/render_guide.py` | Renders the canonical HTML guide to PDF with ReportLab. |

Run with the repository’s available Node runtime:

```powershell
node test-model.js
node test-build.js
node build.js --check
# Run this only after changing app.template.html or model.js:
node build.js
```

`node build.js --check` is read-only and fails if `index.html` is not the exact bundle
of the checked-in template and production model. `node build.js` writes that bundle.
Scripts and styles are embedded; the page loads no external fonts, images, analytics,
or AI services. Direct-file/disconnected-network behavior remains unverified; the
corresponding manifest field records that limit.

After editing the guide, regenerate its PDF with a Python environment containing
ReportLab: `python tools/render_guide.py`. Inspect both rendered pages before sharing
the updated guide. The renderer resolves files relative to its own location.

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
- Reopenable how-to, settings, presentation mode, and presenter’s notes.
- Responsive controls and canvas traces for phone-sized layouts.
- Printable [HTML teacher guide](teacher-guide.html) and [PDF](teacher-guide.pdf).
