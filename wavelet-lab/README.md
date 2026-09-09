# Wavelet Lab

An offline, self-contained Haar-wavelet reconstruction workspace for the AI Fellows demo collection. It pairs an editable eight-value signal with a 64 × 64 procedural grayscale image, so students can connect a visible coefficient decision to numerical reconstruction error.

Open [index.html](index.html) in a modern browser. The Guide overlay opens on load; the `?` button reopens it. `⚙` Settings offers **Open Presenter Notes**, **Presentation mode** and **Reset** (Reset returns the signal, the coefficient selection, the image preset and the budget to their opening values). The presenter notes shown in the page and the printable teacher guide — [HTML](teacher-guide.html) and [PDF](teacher-guide.pdf) — are one document from one source.

## What it teaches

- The normalized Haar coarse/detail pair: `(a+b)/sqrt(2)` and `(a-b)/sqrt(2)`.
- Multilevel approximation/detail layout for eight values.
- Coefficient retention, inverse reconstruction, energy, squared error, and RMSE.
- That dropping one coefficient raises squared error by exactly that coefficient squared — Part 1 asks for the number before it drops the card, then checks the prediction against the readout.
- Why largest-magnitude selection is best for squared error in an orthonormal basis, while perception can disagree.

The image slider counts retained coefficients precisely. It does not claim file compression: no quantization, bit encoding, file upload, or denoising happens here. Numerical error uses raw reconstructed values; only the display canvas clips to grayscale.

## Develop and verify

`index.html` is generated, not edited. `build.js` assembles it from three sources: `src/template.html` (the app shell), `src/wavelet.js` (the production math module, injected verbatim) and `teacher-guide.html` (the presenter notes, injected as the notes overlay).

```text
node build.js
node build.js --check
node src/wavelet.test.js
node src/build.test.js
node tools/pdf.mjs
```

`teacher-guide.html` is the single source for the presenter notes, the printable page and the PDF. Its first `<style>` block must be scoped to `.guide-scope` — that block and the `.guide-scope` div are what get injected — while page chrome (`@page`, `body`, the two-column print layout, the print type size) belongs in its second `<style>` block, which never reaches the app. `node build.js --check` fails if `index.html` has drifted from any of the three sources, so the in-app notes cannot silently diverge from the guide. `tools/pdf.mjs` re-renders the PDF from that same file with an installed Chrome or Edge; no dependencies.

`src/wavelet.test.js` compares the fast transform to a separately written 8 × 8 Haar matrix, checks orthogonality, 1-D/2-D round trips and energy preservation, verifies omitted energy equals squared error and that a single dropped coefficient raises squared error by exactly its square, and enumerates small best-k subsets. `src/build.test.js` checks the shipped page: that both injected sources arrive verbatim and parse, that the Guide and Settings controls carry the exact contract labels, that Reset restores all four pieces of state, and that nothing in the page reaches the network.

The three scenes are generated procedurally in the browser. There are no runtime network requests or external assets.
