# Gaps in the Rock Record

**Gaps in the Rock Record** (folder `missing-time`) is an offline, self-contained rock-record and preservation investigation for the AI Fellows collection. Students inspect surviving layers, sample fossils, and use labelled synthetic chronology anchors to make a local missing interval visible. They then distinguish an evidence-supported local inference from an extinction claim that the available observations cannot support.

Open [index.html](index.html) in a modern browser. The **Guide** overlay opens at launch; the `?` button reopens it. `⚙` **Settings** offers **Open Presenter Notes**, **Presentation mode** and **Reset** (back to Case 1 with the evidence ledger, supplied ages and reveal cleared; Presentation mode is left as the presenter set it). The printable guide is [HTML](teacher-guide.html) or [PDF](teacher-guide.pdf) — the same document the notes overlay shows.

## What the model teaches

The authored ledger separates elapsed model time (Myr since start; one Myr is one million years) from rock thickness (metres). It deposits at stated constant rates, pauses deposition, erodes from the top down, then resumes deposition. Fossil specimens remain at their authored position only if their rock survives; a removed fossil is not placed at the hiatus boundary.

Three compact investigations cover distinct limits:

- A continuous local record with a true synthetic species end in the authored history, while sampling remains inadequate for a global extinction inference.
- A partial/whole-layer erosion stack. The pre-reveal evidence supports only that a local gap has an unresolved cause; the erosion mechanism is revealed as authored truth afterward.
- A pause at one local section and preservation at a second. Sampling the matching interval in the second section changes the evidence without turning a local comparison into global certification.

Exact gap durations are not calculated from thickness. When students select **Show supplied age evidence**, the page exposes supplied synthetic base and top ages for every surviving layer, the assumed continuous constant-rate/linear mapping within each layer, and any displayed gap. Dating uncertainty and unresolved internal hiatuses are omitted. Fossil times are mapped from that supplied chronology rather than independently measured dates. For Case 3, the comparison requires chronology at both C and D: C anchors bracket the pause, while D anchors bound Green mudstone. A layer sample changes the visible observation ledger and never changes the underlying rock history.

## Develop and verify

`model.js` is the production model and `teacher-guide.html` is the canonical guide. `build.js` bundles the model verbatim into the self-contained `index.html`, and lifts the guide's `guide-css` stylesheet and its `.guide-scope` body into the presenter-notes overlay, so the on-screen notes, the printable guide and the PDF are one document from one source.

```text
node test-model.js
node build.js
node test-build.js
node build.js --check
```

The model tests hand-worked continuous deposition, pause, top-down erosion through a whole and partial layer, specimen survival, synthetic lifetimes, chronology anchors, and valid evidence-action gates. Build checks confirm exact bundling of both sources, the CONTRACT.md Required UX surface (Guide button, the three Settings items, first-load and Reset semantics), and parse both inline scripts. `node build.js --check` fails if `index.html` has drifted from `teacher-guide.html`.

No external scripts, styles, fonts, images, data, analytics, or AI services are loaded at runtime. This was verified by recording `Network.requestWillBeSent` in headless Chrome while exercising every control of the built page opened as a local `file://` document: one request, the file itself, and none external. The same probe saw three external requests on a control page that makes them.

Rebuild the printable PDF from the canonical HTML with an installed Chrome/Edge (no dependencies to install):

```text
node tools/pdf.mjs
```

`tools/render_guide.py` is the original ReportLab renderer, kept for reference. It predates the
`.guide-scope` restructure and is no longer the way the shipped PDF is produced.

## Scope and sources

This is a small authored teaching model, not a basin simulator or a method for establishing real extinction. It omits reworking, transport, dating uncertainty, sampling statistics, facies correlation, and global distribution. Its event/occurrence framing was developed with reference to the [StratPal event-data tutorial](https://mindthegap-erc.github.io/StratPal/articles/event_data.html); this demo preserves actual synthetic specimens rather than treating occurrence-event transformations as a specimen-preservation algorithm. No faculty endorsement is claimed.
