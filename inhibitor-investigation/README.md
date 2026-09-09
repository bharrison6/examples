# Inhibitor Investigation

An offline, self-contained initial-rate enzyme-inhibition investigation for the AI Fellows collection. Students run a limited number of exact synthetic assays, compare observed rates to three declared candidate curves, and practice the scientifically valid conclusion that evidence can be insufficient.

Open [index.html](index.html) in a modern browser. The **Guide** opens on first load; the `?` button reopens it. `⚙` Settings offers **Open Presenter Notes**, **Presentation mode**, and **Reset**. The presenter notes *are* the printable guide — the same document, injected at build time — so the overlay, the [HTML](teacher-guide.html), and the [PDF](teacher-guide.pdf) can never drift. Reset returns the page to its fresh-load state: a new mystery sample, an empty bench, the first-load conclusion and transfer copy, and both overlays closed. It deliberately leaves Presentation mode as the presenter set it, since that is a display preference rather than demo state. New mystery sample clears the bench and cycles the three synthetic cases without revealing the new label.

## What it teaches

- A calibrated baseline with Vmax = 100 rate units and Km = 2 concentration units.
- Idealized competitive, uncompetitive, and pure noncompetitive initial-rate patterns using `v = Vmax·S / (a·Km + b·S)`.
- Why one exact measurement can still leave candidates tied: in this deliberately matched-factor set, at S = Km, competitive and uncompetitive both predict 25.0.
- How a high-substrate measurement separates the remaining finite candidates, and why interpretation must stay within the model’s scope.

The activity uses exact synthetic rates: it contains no fake noise, fit tolerance, random samples, real-drug claims, or hidden-mechanism scoring. It deliberately does **not** model mixed, partial, allosteric, tight-binding, time-dependent, irreversible, or multiple-substrate behavior. It is a classroom initial-rate pattern exercise, not a method for identifying a real inhibitor’s binding site.

## Develop and verify

Two files are canonical: `model.js` (the production model) and `src/teacher-guide.html` (the guide, which is also the presenter notes). `build.js` injects both into `src/template.html` verbatim and copies the guide out to `teacher-guide.html`. **Never hand-edit `index.html` or `teacher-guide.html`** — `--check` fails when either drifts from its source.

```text
node test-model.js
node build.js
node build.js --check
node test-build.js
node tools/pdf.mjs
```

The tests use independent hand-calculated fixtures for zero substrate, the baseline at Km, saturation limits, rate ordering, the S=Km ambiguity, high-substrate discrimination, assay budget, duplicate measurements, transfer feedback, reproducible bundling, and inline-script parsing. `test-build.js` also asserts the shipped UX contract: the `?` button's accessible name, the Guide overlay heading and first-load state, the three Settings items, Reset restoring the first-load copy, the guide body and stylesheet appearing in the page verbatim, and the absence of any runtime network API.

The runtime is self-contained, with no external assets or AI calls. Chrome checks cover the investigation, sample reset, assay limits, transfer feedback, the Guide and presenter-notes overlays, Reset, and a 390px layout. Loaded from `file://` in headless Chrome the page attempts exactly one request — itself; a page that does reference external assets was run through the same probe as a positive control.

`tools/pdf.mjs` renders `teacher-guide.pdf` from `teacher-guide.html` by driving an installed Chrome/Edge headless, so the PDF comes from the same canonical source as the on-screen notes and needs no packages installed. Set `CHROME_PATH` if your browser is somewhere unusual.

`tools/render_guide.py` is a **legacy** ReportLab renderer that predates the guide restructure. It is kept for reference only, is not the renderer behind the shipped PDF, and has not been re-verified against the current guide markup.

## Sources

- NIH Assay Guidance Manual: [Mechanism of Action Assays for Enzymes](https://www.ncbi.nlm.nih.gov/books/NBK92001/), for idealized initial-rate inhibition context and assay-design caveats.
- J. Cox: [SciComm: Biochem](https://campus.murraystate.edu/faculty/jcox/scicomm_biochem.html), for reviewed course fit only; it is neither current scheduling information nor an endorsement.
