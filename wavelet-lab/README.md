# Wavelet Lab

An offline, self-contained Haar-wavelet reconstruction workspace for the AI Fellows demo collection — Demo 12 of 16, Part four ("Example projects") of *AI: From Zero to Takeoff*. It pairs an editable eight-value signal with a 64 × 64 procedural grayscale image, so students can connect a visible coefficient decision to numerical reconstruction error.

Built on the shared lesson shell at [`../tools/lesson-shell`](../tools/lesson-shell) (a build-time-only dependency; the shipped `index.html` stays one self-contained file). Three stages, none locked: **Signal** (predict, then drop a coefficient), **Image** (retain a coefficient budget), **New case** (carry the rule to a portrait at a hard budget). Each stage opens with a stage question, a "Before you start" refresh, and a Predict/Try/Takeaway strip, and closes with a Check yourself card.

Open [index.html](index.html) in a modern browser. The Guide overlay opens on load; the `?` button reopens it. `⚙` Settings offers **Open Presenter Notes**, **Presentation mode** and **Reset** — in place, no page reload — which returns the signal, the coefficient selection, the image preset and the budget to their opening values and leaves Presentation mode as you set it. The presenter notes shown in the page and the printable teacher guide — [HTML](teacher-guide.html) and [PDF](teacher-guide.pdf) — are one document from one source (`src/demo-guide.html`). Each stage's **Details** drawer carries the exact math, its assumptions, its sources and its boundary — what the stage does not claim.

## What it teaches

- The normalized Haar coarse/detail pair: `(a+b)/sqrt(2)` and `(a-b)/sqrt(2)`.
- Multilevel approximation/detail layout for eight values.
- Coefficient retention, inverse reconstruction, energy, squared error, and RMSE.
- That dropping one coefficient raises squared error by exactly that coefficient squared — Part 1 asks for the number before it drops the card, then checks the prediction against the readout.
- Why largest-magnitude selection is best for squared error in an orthonormal basis, while perception can disagree.

The image slider counts retained coefficients precisely. It does not claim file compression: no quantization, bit encoding, file upload, or denoising happens here. Numerical error uses raw reconstructed values; only the display canvas clips to grayscale.

## Develop and verify

`index.html` is generated, not edited. `build.js` assembles it from `src/template.html` (the app shell), `src/styles.css` (activity-only CSS), `src/wavelet.js` (the production math module, injected verbatim), `src/app.js` (the view layer), `src/demo-guide.html` (the presenter notes, injected as the notes overlay and copied out as `teacher-guide.html`), and the shared kit at `../tools/lesson-shell`.

```text
node build.js
node build.js --check
node src/wavelet.test.js
node src/build.test.js
node ../tools/lesson-shell/check-shell.js wavelet-lab
node tools/pdf.mjs
```

`src/demo-guide.html` is the single source for the presenter notes, the printable page (shipped as `teacher-guide.html`, keeping its public URL) and the PDF. Its `<style id="guide-css">` block must be scoped to `.guide-scope` — that block and the `.guide-scope` div are what get injected — while page chrome (`@page`, `body`, the two-column print layout, the print type size) belongs in its second `<style>` block, which never reaches the app. `node build.js --check` fails if `index.html` has drifted from any source, including the shared kit — a kit CSS change reds this demo until it is rebuilt. `tools/pdf.mjs` re-renders the PDF from `teacher-guide.html` with an installed Chrome or Edge; no dependencies.

`src/wavelet.test.js` is unchanged by this retrofit: it compares the fast transform to a separately written 8 × 8 Haar matrix, checks orthogonality, 1-D/2-D round trips and energy preservation, verifies omitted energy equals squared error and that a single dropped coefficient raises squared error by exactly its square, and enumerates small best-k subsets. `src/build.test.js` checks the shipped page against both the pre-existing mechanism (the transform accounting, the predict-then-drop flow, the image budget) and the fleet template's parts A0–A6 and A9 (the shell stamp, the three stage tabs and their questions, the Predict/Try/Takeaway strip, the six-word provenance vocabulary, the Details drawer's five fixed sections, the Check-yourself cards, and the guide's Takeaways/misconceptions), and proves the build's drift gate in four directions including a change to the shared kit. `check-shell.js` verifies the built page actually carries the current kit and every template class the checker can see mechanically.

The three scenes are generated procedurally in the browser — original illustrative fixtures, not photographs or measured datasets (labelled **Illustrative** on screen). There are no runtime network requests or external assets. The image panel's two MathWorks "further reading" links were checked live 2026-09-15 (dead-citation sweep) and both still support what they are cited for.
