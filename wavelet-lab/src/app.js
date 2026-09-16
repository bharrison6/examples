/* Wavelet Lab &mdash; the activity itself.

   The lesson shell (header, stage tablist, stage intro, lesson strip,
   provenance kickers, observation cue restore-to-snapshot, Details drawer,
   check cards, dialogs, credit pill, breakpoints, presentation scaling, and
   Reset's own chrome) lives in ../tools/lesson-shell and is injected before
   this file. Everything here is the transform workspace itself: the eight
   signal sliders, the coefficient cards, the predict-then-drop flow, the
   image budget slider and its three canvases, and the Portrait-at-64
   transfer exercise.

   The math is untouched: src/wavelet.js (injected verbatim at the
   WAVELET_CORE marker, immediately before this script) is the exact tested
   production module from before the retrofit, and this file calls it exactly
   the way the pre-retrofit inline script did. src/wavelet.test.js pins it
   independently and is not part of this bundle. */
(() => {
  'use strict';
  const W = window.WaveletLab;
  const SIZE = 64;
  const FRESH = { signal: [3, 1, 4, 1, 5, 9, 2, 6], preset: 'mountain', budget: 256 };
  const state = {
    signal: FRESH.signal.slice(),
    signalKeep: new Array(8).fill(true),
    preset: FRESH.preset,
    image: null,
    coeffs: null,
    pending: null
  };

  const byId = id => document.getElementById(id);
  const clamp = v => Math.max(0, Math.min(255, v));
  const fmt = v => W.formatNumber(v, 3);

  /* Procedural scene generator, byte-identical to the pre-retrofit inline
     script: three original illustrative fixtures, not photographs. Kicker on
     the image panel says so (k-illustrative). */
  function scene(name) {
    const a = new Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        let v = 0;
        if (name === 'mountain') {
          v = y < 33 ? 220 - y * 1.2 : 140;
          const left = 12 + Math.abs(x - 31) * .63;
          if (y > left && y < 37) v = 68 + (y - left) * 2;
          if (y > 37) v = 132 + (x % 7 < 2 ? 8 : 0);
          if ((x - 47) * (x - 47) + (y - 12) * (y - 12) < 35) v = 248;
          if (y > 37 && y < 53 && Math.abs(x - 31) < (53 - y) * .62) v = 90 + (y - 37) * 3;
        } else if (name === 'portrait') {
          v = 188;
          const dx = (x - 32) / 19, dy = (y - 31) / 25;
          if (dx * dx + dy * dy < 1) v = 202 - 18 * Math.abs(dx);
          if (dx * dx + dy * dy > 1 && y > 16) v = 55;
          if ((x - 25) * (x - 25) + (y - 28) * (y - 28) < 5 || (x - 39) * (x - 39) + (y - 28) * (y - 28) < 5) v = 28;
          if (y > 41 && Math.abs(x - 32) < 9) v = 70;
          if (y < 17 && Math.abs(x - 32) < 18) v = 42;
        } else {
          v = 35 + y * 1.2;
          if (y > 39) v = 92;
          const building = (x < 14 ? 24 : (x < 28 ? 37 : (x < 42 ? 19 : 31)));
          if (y > 58 - building) v = 55 + (x % 5) * 9;
          if ((x - 14) * (x - 14) + (y - 14) * (y - 14) < 16) v = 230;
          if ((x + y) % 19 === 0 && y < 34) v = 185;
        }
        a[y * SIZE + x] = v;
      }
    }
    return a;
  }

  function draw(canvas, values, error) {
    const ctx = canvas.getContext('2d');
    const data = ctx.createImageData(SIZE, SIZE);
    for (let i = 0; i < values.length; i += 1) {
      const v = error ? clamp(values[i] * 3) : clamp(values[i]);
      data.data[i * 4] = data.data[i * 4 + 1] = data.data[i * 4 + 2] = Math.round(v);
      data.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
  }

  /* The one squared-error readout Stage 1 quotes, computed the one way:
     transform the current signal, zero the omitted coefficients, invert,
     compare with the signal. */
  function keptCoefficients() {
    const coeffs = W.haar1D(state.signal);
    return coeffs.map((v, i) => (state.signalKeep[i] ? v : 0));
  }
  function signalSquaredError() {
    return W.squaredError(state.signal, W.inverseHaar1D(keptCoefficients()));
  }

  function renderSignal() {
    const coeffs = W.haar1D(state.signal);
    const labels = W.coefficientLabels(8);
    const cards = byId('coefficientCards');
    const kept = keptCoefficients();
    const recon = W.inverseHaar1D(kept);
    cards.innerHTML = '';
    coeffs.forEach((value, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'coef ' + (state.signalKeep[i] ? '' : 'off') + (state.pending === i ? ' pending' : '');
      b.innerHTML = '<span>' + labels[i] + '</span><strong>' + fmt(value) + '</strong>';
      b.title = state.signalKeep[i] ? 'Drop ' + labels[i] + ' — predict the cost first' : 'Restore ' + labels[i];
      b.onclick = () => {
        if (state.signalKeep[i]) { askDrop(i); } else { state.signalKeep[i] = true; clearAsk(); renderSignal(); }
      };
      cards.appendChild(b);
    });
    const chart = byId('signalChart');
    chart.innerHTML = '';
    recon.forEach((v, i) => {
      const bar = document.createElement('div');
      bar.className = 'bar ' + (v < 0 ? 'neg' : '');
      bar.style.height = Math.max(3, Math.abs(v) * 9) + 'px';
      bar.title = 'x' + (i + 1) + ': ' + fmt(v);
      bar.innerHTML = '<span>' + fmt(v) + '</span>';
      chart.appendChild(bar);
    });
    /* A4: the observation cue narrates what to notice, the moment it is true. */
    byId('cue-1').textContent = state.signalKeep.filter(Boolean).length + ' of 8 coefficients retained · squared error ' +
      fmt(W.squaredError(state.signal, recon)) + ' · omitted energy ' + fmt(W.energy(coeffs) - W.energy(kept));
  }

  function clearAsk() {
    state.pending = null;
    byId('predictPanel').hidden = true;
    byId('predictInput').value = '';
    byId('predictResult').classList.remove('show');
  }

  /* Ask before dropping: name the coefficient, quote the current readout, take a number. */
  function askDrop(index) {
    const coeffs = W.haar1D(state.signal);
    const labels = W.coefficientLabels(8);
    state.pending = index;
    byId('predictResult').classList.remove('show');
    byId('predictInput').value = '';
    byId('predictPrompt').innerHTML = 'About to drop <b>' + labels[index] + '</b>, coefficient ' + fmt(coeffs[index]) +
      '. Squared error reads ' + fmt(signalSquaredError()) + ' now. <b>How much will it rise?</b>';
    byId('predictPanel').hidden = false;
    renderSignal();
    byId('predictInput').focus();
  }

  /* A2: the echo beside the Predict card, mirroring the observed result next
     to what was committed. This is the demo's one capturable prediction. */
  function echoPredict(index, predicted, rise) {
    const echo = document.querySelector('#stage-1 .lesson-strip .echo');
    if (!echo) return;
    const labels = W.coefficientLabels(8);
    echo.hidden = false;
    if (predicted !== null && isFinite(predicted)) {
      const off = Math.abs(predicted - rise);
      const verdict = off <= Math.max(0.05, 0.01 * rise) ? 'a match' : 'off by ' + fmt(off);
      echo.innerHTML = 'You predicted: <b>' + fmt(predicted) + '</b> for ' + labels[index] + ' — actual rise <b>' + fmt(rise) + '</b> (' + verdict + ')';
    } else {
      echo.innerHTML = 'You dropped ' + labels[index] + ' without predicting — actual rise <b>' + fmt(rise) + '</b>';
    }
  }

  function confirmDrop() {
    const index = state.pending;
    if (index === null) return;
    const coeffs = W.haar1D(state.signal);
    const labels = W.coefficientLabels(8);
    const before = signalSquaredError();
    const raw = byId('predictInput').value.trim();
    const predicted = raw === '' ? null : Number(raw);
    const value = coeffs[index];
    const squared = value * value;
    state.signalKeep[index] = false;
    state.pending = null;
    byId('predictPanel').hidden = true;
    const after = signalSquaredError();
    const rise = after - before;
    const shown = value < 0 ? '(' + fmt(value) + ')' : fmt(value);
    let text = '<b>' + labels[index] + ' dropped.</b> Squared error ' + fmt(before) + ' → ' + fmt(after) +
      ', a rise of <b>' + fmt(rise) + '</b>. The coefficient was ' + fmt(value) + ', and ' + shown + '² = ' + fmt(squared) +
      '. In an orthonormal basis the rise is always the dropped coefficient squared.';
    if (predicted !== null && isFinite(predicted)) {
      const off = Math.abs(predicted - rise);
      text += ' You predicted ' + fmt(predicted) + ' — ' + (off <= Math.max(0.05, 0.01 * rise) ? 'a match' : 'off by ' + fmt(off)) + '.';
    }
    byId('predictResult').innerHTML = text;
    byId('predictResult').classList.add('show');
    echoPredict(index, predicted, rise);
    renderSignal();
  }

  function renderInputs() {
    const target = byId('signalInputs');
    target.innerHTML = '';
    state.signal.forEach((v, i) => {
      const d = document.createElement('div');
      d.className = 'valuebox';
      d.innerHTML = '<label>x' + (i + 1) + '</label><input aria-label="signal value ' + (i + 1) + '" type="range" min="-10" max="10" value="' + v + '"><output>' + v + '</output>';
      const input = d.querySelector('input');
      const out = d.querySelector('output');
      input.oninput = () => { state.signal[i] = Number(input.value); out.textContent = input.value; clearAsk(); renderSignal(); };
      target.appendChild(d);
    });
    renderSignal();
  }

  function renderImage() {
    const keptCount = Number(byId('budget').value);
    const kept = W.keepLargest(state.coeffs, keptCount);
    const recon = W.inverseHaar2D(kept, SIZE);
    const err = state.image.map((v, i) => Math.abs(v - recon[i]));
    draw(byId('original'), state.image);
    draw(byId('reconstruction'), recon);
    draw(byId('error'), err, true);
    byId('budgetOutput').textContent = keptCount.toLocaleString() + ' / 4,096';
    const energyPct = W.formatNumber(100 * W.energy(kept) / W.energy(state.coeffs), 1);
    const rmse = W.formatNumber(Math.sqrt(W.squaredError(state.image, recon) / (SIZE * SIZE)), 2);
    byId('energyMetric').textContent = energyPct + '%';
    byId('rmseMetric').textContent = rmse;
    byId('countMetric').textContent = keptCount.toLocaleString() + ' kept';
    /* A4: the observation cue for the image workbench. */
    byId('cue-2').textContent = 'Retained energy ' + energyPct + '% · RMSE ' + rmse + ' · ' + keptCount.toLocaleString() + ' of 4,096 kept';
    refreshCue3IfVisible();
  }

  function setPreset(name) {
    state.preset = name;
    state.image = scene(name);
    state.coeffs = W.haar2D(state.image, SIZE);
    document.querySelectorAll('[data-preset]').forEach(b => b.classList.toggle('active', b.dataset.preset === name));
    renderImage();
  }

  /* Stage 3 has no canvases of its own: it reads the still-live (if
     currently hidden) Stage 2 metrics nodes, since this is one single-page
     app and every stage's DOM persists whether or not its section is the one
     showing. Only refreshed while Stage 3 is the visible stage, or right
     after Stage 2 recomputes, so the cue never shows a stale reading. */
  function refreshCue3IfVisible() {
    const stage3 = byId('stage-3');
    if (!stage3 || !stage3.classList.contains('on')) return;
    const preset = state.preset;
    const label = preset === 'mountain' ? 'Mountain lake' : preset === 'portrait' ? 'Portrait' : 'City at dusk';
    byId('cue-3').textContent = label + ' at ' + byId('countMetric').textContent + ' · retained energy ' +
      byId('energyMetric').textContent + ' · RMSE ' + byId('rmseMetric').textContent;
  }

  /* ============================== navigation ==============================
     The stage tablist, its keyboard handling and hash routing all live in the
     shared shell. This file only reacts to 'stagechange' to scroll to the top
     of the new stage and, entering Stage 3, refresh its read-only cue. */
  document.addEventListener('stagechange', e => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (e.detail.index === 2) refreshCue3IfVisible();
  });

  byId('coarse').onclick = () => {
    state.signalKeep = [true, false, false, false, false, false, false, false];
    clearAsk(); renderSignal();
  };
  byId('largest3').onclick = () => {
    const c = W.haar1D(state.signal);
    const ordered = c.map((_, i) => i).sort((a, b) => Math.abs(c[b]) - Math.abs(c[a]) || a - b);
    state.signalKeep = c.map((_, i) => ordered.slice(0, 3).indexOf(i) >= 0);
    clearAsk(); renderSignal();
  };
  byId('allSignal').onclick = () => { state.signalKeep = new Array(8).fill(true); clearAsk(); renderSignal(); };
  byId('predictGo').onclick = confirmDrop;
  byId('predictCancel').onclick = () => { clearAsk(); renderSignal(); };
  byId('predictInput').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); confirmDrop(); } };
  byId('budget').oninput = renderImage;
  document.querySelectorAll('[data-preset]').forEach(b => { b.onclick = () => setPreset(b.dataset.preset); });
  byId('portrait64').onclick = () => { byId('budget').value = 64; setPreset('portrait'); };
  /* Stage 3's own control: set up the same case, then jump to the Image
     stage so the learner watches the canvases update. selectStage() is the
     shell's own API, the same one two-winters uses to move between stages
     from inside the activity ("Put the two winters side by side"). */
  byId('setupPortrait64').onclick = () => {
    byId('budget').value = 64;
    setPreset('portrait');
    window.lessonShell.selectStage(1);
  };

  /* ---- Reset, in place -----------------------------------------------------
     Kit v2: the shell restores its own chrome first (stage 1, the stage tabs,
     the cleared check cards, the closed dialogs, and every .obs-cue / .echo
     node back to its FIRST-LOAD snapshot, taken before this script ran) and
     then dispatches `lessonreset`. Everything below is the half only this
     file can know about.

     THE ENUMERATION, written out rather than summarised:
       1. state.signal, state.signalKeep, state.pending, state.preset,
          state.image, state.coeffs — all of it, back to FRESH.
       2. #predictPanel (hidden again), #predictInput (cleared),
          #predictResult (cleared and un-.show'd) — none of these three
          are shell-owned nodes, so nothing restores them but this handler.
       3. #signalInputs, #coefficientCards and #signalChart are rebuilt by
          renderInputs()/renderSignal(), which also repopulates #cue-1 —
          the shell already blanked it via the snapshot, but blank is not
          fresh-load content, it is no content, and only this handler knows
          what fresh-load content is.
       4. #budget's value attribute and setPreset(FRESH.preset) rebuild the
          three canvases, the metrics row and #cue-2 the same way.
       5. #cue-3 is cleared explicitly: it is populated only when Stage 3
          becomes visible or Stage 2 recomputes, so a Reset performed while
          Stage 3 is showing must not leave yesterday's reading on screen. */
  document.addEventListener('lessonreset', () => {
    state.signal = FRESH.signal.slice();
    state.signalKeep = new Array(8).fill(true);
    clearAsk();
    byId('predictResult').innerHTML = '';
    byId('predictResult').classList.remove('show');
    renderInputs();
    byId('budget').value = FRESH.budget;
    setPreset(FRESH.preset);
    byId('cue-3').textContent = '';
  });

  /* Nothing here needs to refuse a reset. Left explicit, not by omission. */
  window.lessonShell.onReset = null;

  /* First render. The shell opens the Guide itself; this file only needs the
     activity on screen underneath it. */
  renderInputs();
  setPreset(FRESH.preset);
})();
