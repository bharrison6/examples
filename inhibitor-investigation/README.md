# Inhibitor Investigation

An offline, self-contained initial-rate enzyme-inhibition investigation. Demo 14 of 16, Part four (Example projects) of *AI: From Zero to Takeoff*. Students run a limited number of exact synthetic assays, compare observed rates to three declared candidate curves, explain what the evidence shows before a reveal, and practice the scientifically valid conclusion that evidence can be insufficient.

Built against the shared [lesson-shell](../tools/lesson-shell) kit (v2). Three stages: **Bench** (choose an assay and read the rate evidence), **Explain** (explain before reveal), and **Transfer** (pick the next measurement that would actually separate two tied candidates) — all reachable at any time; "explain before reveal" is a within-stage content gate (the mystery pattern's name stays out of the feedback until a choice is made), not a locked tab.

Open [index.html](index.html) in a modern browser. The **Guide** opens on first load; the `?` button reopens it. `⚙` Settings offers **Open Presenter Notes**, **Presentation mode**, and **Reset**. The presenter notes *are* the printable guide — the same document, injected at build time — so the overlay, the [HTML](teacher-guide.html), and the [PDF](teacher-guide.pdf) can never drift.

**Reset is in place** (no page reload, kit v2 contract): it returns the demo to a fresh mystery sample, an empty bench, stage 1, and every explanation and transfer choice cleared, while leaving Presentation mode as the presenter set it. **New mystery sample** (a control inside the Bench stage, carried over from the pre-kit version) starts a fresh case without a full Reset, for running the bench again without restarting the whole demo.

## What it teaches

- A calibrated baseline with Vmax = 100 rate units and Km = 2 concentration units.
- Idealized competitive, uncompetitive, and pure noncompetitive initial-rate patterns using `v = Vmax·S / (a·Km + b·S)`.
- Why one exact measurement can still leave candidates tied: in this **deliberately matched-factor set**, at S = Km, competitive and uncompetitive both predict 25.0 — a property of this teaching set, not a general diagnostic rule.
- How a follow-up measurement separates the remaining finite candidates, and why the model does not rank an informative choice by the size of its predicted gap.

The activity uses exact synthetic rates: it contains no fake noise, fit tolerance, random samples, real-drug claims, or hidden-mechanism scoring. Every candidate curve and every recorded assay rate is labelled **Scripted** on screen (a hand-built idealized formula, not a real assay reading); the live comparisons run on those numbers (whether an explanation is sound, how many candidates a measurement eliminates) are labelled **Live**. It deliberately does **not** model mixed, partial, allosteric, tight-binding, time-dependent, irreversible, or multiple-substrate behavior. It is a classroom initial-rate pattern exercise, not a method for identifying a real inhibitor's binding site.

## Develop and verify

Canonical sources: `model.js` (the tested production model, unchanged by the kit retrofit), `src/template.html` (the app shell markup), `src/styles.css` (the activity's own styles — the shared kit supplies the rest), `src/app.js` (the view layer, including the required `lessonreset` handler), and `src/demo-guide.html` (the guide, which is also the presenter notes). `build.js` injects all of these plus the shared [lesson-shell](../tools/lesson-shell) kit into `index.html`, and copies the guide out to `teacher-guide.html`. **Never hand-edit `index.html` or `teacher-guide.html`** — `--check` fails when either drifts from its source, and it also fails if the shared kit's CSS changes underneath this build.

```text
node test-model.js
node build.js
node build.js --check
node test-build.js
node tools/pdf.mjs
node ../tools/lesson-shell/check-shell.js inhibitor-investigation
node ../tools/build-hub.js --check
```

`test-model.js` uses independent hand-calculated fixtures for zero substrate, the baseline at Km, saturation limits, rate ordering, the S=Km ambiguity, high-substrate discrimination, assay budget, duplicate measurements, and transfer feedback — unchanged by the retrofit, because `model.js` is byte-identical to the pre-kit version. `test-build.js` asserts two things: the MECHANISM pins (the tested model ships verbatim, the offline/self-contained contract), and the TEMPLATE pins (the shell stamp and CSS hash, three ungated stage tabs with question subtitles, each stage's eyebrow/question/refresh/Predict-Try-Takeaway strip, the six-word provenance vocabulary with `Scripted`/`Live` and nothing else used, a five-section Details drawer per stage carrying the formula and the excluded-mechanisms list, a two-option check card per stage with feedback on both options, the in-place reset contract, and the stage Takeaways appearing verbatim as the guide's Learning goals).

`check-shell.js` additionally proves the built file embeds the exact kit CSS on disk, uses only the six provenance words, ships no unfilled template placeholder, defines no id twice, and implements a real `lessonreset` listener (not merely the shell's own dispatch of the event).

The runtime is self-contained, with no external assets or AI calls; `build.js`'s own runtime-load scan is proved on positive controls before its silence is trusted, and the browser pass (see the batch progress file) additionally proves the built page makes no network request during a real load in a headless browser, with the same probe run against a bait page as a positive control.

`tools/pdf.mjs` renders `teacher-guide.pdf` from `teacher-guide.html` by driving an installed Chrome/Edge headless, so the PDF comes from the same canonical source as the on-screen notes and needs no packages installed. Set `CHROME_PATH` if your browser is somewhere unusual.

`tools/render_guide.py` is a **legacy** ReportLab renderer that predates the guide restructure and predates the kit retrofit. It is kept for reference only, is not the renderer behind the shipped PDF, and has not been re-verified against the current guide markup or the lesson-shell retrofit; retiring it is contingent on the operator's delete sanction ([[task-retire-legacy-reportlab-renderers]]) and is left in place here.

## Sources

- NIH Assay Guidance Manual: [Mechanism of Action Assays for Enzymes](https://www.ncbi.nlm.nih.gov/books/NBK92001/), for idealized initial-rate inhibition context and assay-design caveats. Confirmed live and supporting on 2026-09-15 (fleet dead-citation sweep).
- A Murray State biochemistry course, used for reviewed course fit only; it is not named here, and it is neither current scheduling information nor an endorsement.
