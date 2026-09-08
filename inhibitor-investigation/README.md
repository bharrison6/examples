# Inhibitor Investigation

An offline, self-contained initial-rate enzyme-inhibition investigation for the AI Fellows collection. Students run a limited number of exact synthetic assays, compare observed rates to three declared candidate curves, and practice the scientifically valid conclusion that evidence can be insufficient.

Open [index.html](index.html) in a modern browser. The how-to opens on first load; `?` reopens it. `⚙` contains presentation mode and presenter notes. The printable guide is available as [HTML](teacher-guide.html) and [PDF](teacher-guide.pdf). New mystery sample clears the bench and cycles the three synthetic cases without revealing the new label.

## What it teaches

- A calibrated baseline with Vmax = 100 rate units and Km = 2 concentration units.
- Idealized competitive, uncompetitive, and pure noncompetitive initial-rate patterns using `v = Vmax·S / (a·Km + b·S)`.
- Why one exact measurement can still leave candidates tied: in this deliberately matched-factor set, at S = Km, competitive and uncompetitive both predict 25.0.
- How a high-substrate measurement separates the remaining finite candidates, and why interpretation must stay within the model’s scope.

The activity uses exact synthetic rates: it contains no fake noise, fit tolerance, random samples, real-drug claims, or hidden-mechanism scoring. It deliberately does **not** model mixed, partial, allosteric, tight-binding, time-dependent, irreversible, or multiple-substrate behavior. It is a classroom initial-rate pattern exercise, not a method for identifying a real inhibitor’s binding site.

## Develop and verify

`model.js` is the production model. `build.js` inserts it verbatim into the standalone page.

```text
node test-model.js
node build.js
node build.js --check
node test-build.js
```

The tests use independent hand-calculated fixtures for zero substrate, the baseline at Km, saturation limits, rate ordering, the S=Km ambiguity, high-substrate discrimination, assay budget, duplicate measurements, transfer feedback, reproducible bundling, and inline-script parsing.

The runtime is self-contained, with no external assets or AI calls. Chrome checks cover the investigation, sample reset, assay limits, transfer feedback, settings/help, and a 390px layout. Direct-file/disconnected-network behavior remains unverified in the manifest.

To rebuild the PDF from canonical guide HTML, use Python with ReportLab:

```text
python tools/render_guide.py
```

The renderer uses standard-library HTML parsing and preserves the guide's content and source links. It does not require browser automation.

## Sources

- NIH Assay Guidance Manual: [Mechanism of Action Assays for Enzymes](https://www.ncbi.nlm.nih.gov/books/NBK92001/), for idealized initial-rate inhibition context and assay-design caveats.
- J. Cox: [SciComm: Biochem](https://campus.murraystate.edu/faculty/jcox/scicomm_biochem.html), for reviewed course fit only; it is neither current scheduling information nor an endorsement.
