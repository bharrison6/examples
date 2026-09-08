# Missing Time

**Missing Time** is an offline, self-contained rock-record and preservation investigation for the AI Fellows collection. Students inspect surviving layers, sample fossils, and use labelled synthetic chronology anchors to make a local missing interval visible. They then distinguish an evidence-supported local inference from an extinction claim that the available observations cannot support.

Open [index.html](index.html) in a modern browser. The how-to opens at launch; `?` reopens it. `⚙` offers presentation mode, presenter notes, and reset. The printable guide is [HTML](teacher-guide.html) or [PDF](teacher-guide.pdf).

## What the model teaches

The authored ledger separates elapsed model time (Myr since start; one Myr is one million years) from rock thickness (metres). It deposits at stated constant rates, pauses deposition, erodes from the top down, then resumes deposition. Fossil specimens remain at their authored position only if their rock survives; a removed fossil is not placed at the hiatus boundary.

Three compact investigations cover distinct limits:

- A continuous local record with a true synthetic species end in the authored history, while sampling remains inadequate for a global extinction inference.
- A partial/whole-layer erosion stack. The pre-reveal evidence supports only that a local gap has an unresolved cause; the erosion mechanism is revealed as authored truth afterward.
- A pause at one local section and preservation at a second. Sampling the matching interval in the second section changes the evidence without turning a local comparison into global certification.

Exact gap durations are not calculated from thickness. When students select **Show supplied age evidence**, the page exposes supplied synthetic base and top ages for every surviving layer, the assumed continuous constant-rate/linear mapping within each layer, and any displayed gap. Dating uncertainty and unresolved internal hiatuses are omitted. Fossil times are mapped from that supplied chronology rather than independently measured dates. For Case 3, the comparison requires chronology at both C and D: C anchors bracket the pause, while D anchors bound Green mudstone. A layer sample changes the visible observation ledger and never changes the underlying rock history.

## Develop and verify

`model.js` is the production model. `build.js` bundles it verbatim into the self-contained `index.html`.

```text
node test-model.js
node build.js
node test-build.js
node build.js --check
```

The model tests hand-worked continuous deposition, pause, top-down erosion through a whole and partial layer, specimen survival, synthetic lifetimes, chronology anchors, and valid evidence-action gates. Build checks confirm exact bundling and parse both inline scripts.

No external scripts, styles, fonts, images, data, analytics, or AI services are loaded at runtime. Direct-file and disconnected-network browser behavior remain unverified in the manifest until parent browser review.

Rebuild the printable PDF from canonical HTML with the local renderer:

```text
python tools/render_guide.py
```

## Scope and sources

This is a small authored teaching model, not a basin simulator or a method for establishing real extinction. It omits reworking, transport, dating uncertainty, sampling statistics, facies correlation, and global distribution. Its event/occurrence framing was developed with reference to the [StratPal event-data tutorial](https://mindthegap-erc.github.io/StratPal/articles/event_data.html); this demo preserves actual synthetic specimens rather than treating occurrence-event transformations as a specimen-preservation algorithm. No faculty endorsement is claimed.
