# Ion Flight

Murray State University · Instrumental Analysis

**Ion Flight** is a self-contained linear time-of-flight (TOF) mass-spectrometry
teaching model. It lets students pulse two or three ideal ion packets into a field-free
drift tube, watch a speed-scaled cutaway animation, and read their real microsecond
arrival times on a detector trace.

Open `index.html` in a browser. It is offline, needs no installation, and works with
mouse or touch. The how-to overlay opens on load and the `?` control reopens it. The
⚙ menu provides presentation mode and concise on-screen presenter’s notes. Open
`teacher-guide.html` to print the guide; `teacher-guide.pdf` is the parent-rendered
copy declared in the manifest.

## What it teaches

After acceleration through voltage `V`, the model uses a field-free drift region:

```
t = L √(m / (2qV))
```

Mass is converted from daltons to kilograms and positive charge number `z` is
converted to `q = z·e` coulombs. The displayed clock is drift time only; it excludes
acceleration time. This means that the ideal instrument separates **m/z**, not mass
alone: 200 Da at `z = 1` and 400 Da at `z = 2` coincide.

The trace uses Gaussian timing distributions. The selected width is explicitly σ:

- **Fixed absolute σ** holds an absolute timing width constant. Increasing length
  makes the temporal separation larger, so the narrow-peak mass-resolution reference
  `m/Δm ≈ t/(2·FWHM)` rises.
- **Fixed fractional σ** makes σ a fixed percent of arrival time. Increasing length
  scales both separation and width, so the relative resolution does not improve.

Peak areas represent counts and are normalized by Gaussian area, so broadening a peak
does not create more ions. The third prediction challenge is intentionally constrained
to reject “always make the tube longer” as a universal answer.

## Files and reproducible build

| File | Role |
| --- | --- |
| `model.js` | Tested SI physics, Gaussian signal, and challenge rules. |
| `app.template.html` | UI source containing the bundle marker. |
| `build.js` | Bundles `model.js` into the offline `index.html`. |
| `test-model.js` | Numeric invariants and resolution/challenge tests. |
| `test-build.js` | Verbatim-bundle, inline-script syntax, and read-only build checks. |
| `teacher-guide.html` | Printable instructor guide. |

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
There are no runtime scripts, stylesheets, fonts, image requests, analytics, or AI
calls. Browser-only contract checks remain marked unverified until the parent’s browser
pass.

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
- Printable HTML teacher guide plus a manifest slot for the rendered PDF.
