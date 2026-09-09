# Wavelet Lab

An offline, self-contained Haar-wavelet reconstruction workspace for the AI Fellows demo collection. It pairs an editable eight-value signal with a 64 × 64 procedural grayscale image, so students can connect a visible coefficient decision to numerical reconstruction error.

Open [index.html](index.html) in a modern browser. The how-to opens on load; `?` reopens it. `⚙` contains Presentation mode and presenter notes. The printable teacher guide is available as [HTML](teacher-guide.html) and [PDF](teacher-guide.pdf).

## What it teaches

- The normalized Haar coarse/detail pair: `(a+b)/sqrt(2)` and `(a-b)/sqrt(2)`.
- Multilevel approximation/detail layout for eight values.
- Coefficient retention, inverse reconstruction, energy, squared error, and RMSE.
- Why largest-magnitude selection is best for squared error in an orthonormal basis, while perception can disagree.

The image slider counts retained coefficients precisely. It does not claim file compression: no quantization, bit encoding, file upload, or denoising happens here. Numerical error uses raw reconstructed values; only the display canvas clips to grayscale.

## Develop and verify

`src/wavelet.js` is the production math module. `build.js` inserts it verbatim into the standalone page:

```text
node build.js
node src/wavelet.test.js
node src/build.test.js
node tools/pdf.mjs
```

The tests compare the fast transform to a separately written 8 × 8 Haar matrix, check orthogonality, 1-D/2-D round trips and energy preservation, verify omitted energy equals squared error, and enumerate small best-k subsets.

`tools/pdf.mjs` re-renders the teacher guide PDF from `teacher-guide.html` with an installed Chrome or Edge; no dependencies.

The three scenes are generated procedurally in the browser. There are no runtime network requests or external assets.
