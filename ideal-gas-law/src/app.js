/* Ideal Gas Law Simulator — the view layer. All physics and measurement live
   in model.js; this file owns the frame loop, the canvases, the gauges, the
   four guided experiments, stage 4's sweeps, and the lesson shell's three
   events. Bundled into index.html by build.js; the shell's own behaviour
   (dialogs, stage tablist keyboard, presentation mode, check cards, Reset) is
   injected separately from tools/lesson-shell.

   ONE INSTRUMENT. #activity is a single element moved between the four
   stages' .activity-host slots on every stage change. The gas keeps running
   through a stage change; what changes is which guided experiment the task
   panel offers.

   THE GUIDED EXPERIMENT is a fixed routine driven from the frame loop:
   prepare (put this stage's own variable back at its baseline), measure
   BEFORE for a window, apply the one change, settle, measure AFTER for a
   window, report. The learner's prediction is echoed beside what the gauge
   showed. Free play with the sliders is always available outside a run. */
(() => {
  'use strict';

  const M = IdealGasModel;
  const byId = id => document.getElementById(id);

  /* ---- the four stages -------------------------------------------------- */

  const WINDOW_S = 4;      /* sim-seconds measured before and after */
  const SETTLE_S = 1.5;    /* sim-seconds between the change and the AFTER window */
  const SWEEP_SETTLE_S = 1.2;
  const SWEEP_WINDOW_S = 3;

  const STAGES = [
    {
      id: 'count',
      title: 'Double the particles',
      purpose: 'Measure the pressure, double N with everything else held, and measure again. The thermostat is on, so the temperature cannot drift.',
      question: 'Twice the particles, same box, same temperature. What does the pressure do?',
      choices: [
        { label: 'It doubles', value: 2 },
        { label: 'It stays the same — the walls are the same size', value: 1 },
        { label: 'It rises, but by less than double — the particles get in each other’s way', value: 1.5 }
      ],
      runLabel: 'Run: double the particles',
      baseline: gas => M.setCount(gas, M.DEFAULTS.count),
      apply: gas => M.setCount(gas, gas.N * 2),
      describe: (a, b) => 'N ' + Math.round(a.N) + ' → ' + Math.round(b.N) + ', T held at ' + Math.round(a.T) + ', box ' + Math.round(a.A),
      metric: 'pressure',
      explain: (a, b, ratio) => 'The wall-hit rate went from about ' + Math.round(a.hits / a.seconds) + ' to ' + Math.round(b.hits / b.seconds) +
        ' hits per second while the temperature gauge stayed at ' + Math.round(b.T) + '. Each hit handed over the same momentum on average; there were ' +
        ratio.toFixed(2) + '× as many of them.',
      conclusion: 'Pressure counts wall hits. Twice the particles, twice the hits per second, twice the pressure — to within the gauge’s noise.'
    },
    {
      id: 'temp',
      title: 'Double the temperature',
      purpose: 'Measure the pressure, rescale every speed so the temperature jumps from 300 to 600 at once, and measure again with the same particles in the same box.',
      question: 'Temperature 300 to 600, same N, same box. Does the pressure go 2×, 4×, or 1.4×?',
      choices: [
        { label: 'It doubles (2×)', value: 2 },
        { label: 'It quadruples (4×) — faster particles hit harder and more often', value: 4 },
        { label: 'It rises by about 1.4× — speed only grows as the square root', value: 1.414 }
      ],
      runLabel: 'Run: double the temperature',
      baseline: gas => M.setTemperature(gas, M.DEFAULTS.temperature, true),
      apply: gas => M.setTemperature(gas, gas.targetT * 2, true),
      describe: (a, b) => 'T ' + Math.round(a.T) + ' → ' + Math.round(b.T) + ', N held at ' + Math.round(a.N) + ', box ' + Math.round(a.A),
      metric: 'pressure',
      explain: (a, b, ratio) => 'Typical speeds rose by √2 ≈ 1.41, not 2. Wall hits went from about ' + Math.round(a.hits / a.seconds) + ' to ' +
        Math.round(b.hits / b.seconds) + ' per second (×' + ((b.hits / b.seconds) / (a.hits / a.seconds)).toFixed(2) +
        '), and each hit carried about √2 times the momentum. The two factors multiply to ' + ratio.toFixed(2) + '.',
      conclusion: 'Pressure tracks temperature, because temperature is speed squared: hotter particles hit √2 harder and √2 more often.'
    },
    {
      id: 'area',
      title: 'Halve the box',
      purpose: 'Measure the pressure, slide the piston from width 100 to 50 with the thermostat holding T, wait for it to arrive, and measure again.',
      question: 'Box width 100 to 50, same N, thermostat on. Does the pressure double, stay the same, or rise by 1.4×?',
      choices: [
        { label: 'It doubles', value: 2 },
        { label: 'It stays the same — same particles, same speeds', value: 1 },
        { label: 'It rises by about 1.4×', value: 1.414 }
      ],
      runLabel: 'Run: halve the box',
      baseline: gas => M.setBoxWidth(gas, M.DEFAULTS.boxWidth),
      apply: gas => M.setBoxWidth(gas, Math.max(M.LIMITS.boxWidth[0], gas.pistonTarget / 2)),
      describe: (a, b) => 'A ' + Math.round(a.A) + ' → ' + Math.round(b.A) + ', N held at ' + Math.round(a.N) + ', T held at ' + Math.round(a.T),
      metric: 'pressure',
      explain: (a, b, ratio) => 'The temperature gauge read ' + Math.round(b.T) + ' throughout, so each hit was as hard as before. Wall hits went from about ' +
        Math.round(a.hits / a.seconds) + ' to ' + Math.round(b.hits / b.seconds) + ' per second on ' + Math.round(a.A / b.A * 100) / 100 +
        '× less wall: every wall was hit more often, and pressure × area went ' + (a.P * a.A).toFixed(0) + ' → ' + (b.P * b.A).toFixed(0) + '.',
      conclusion: 'At fixed temperature, pressure × area holds steady. Now switch the Thermostat off, drag the Piston in yourself, and watch T.'
    },
    {
      id: 'size',
      title: 'Grow the particles',
      purpose: 'Measure the ratio Z = P·A / (N·T) with small particles, grow every particle from radius 0.35 to 1.0 at the same N, T and box, and measure Z again.',
      question: 'Same N, T and box, but the particles are about three times their radius. Where does the measured pressure sit against the law’s prediction?',
      choices: [
        { label: 'Above it — the walls feel more pressure than N·T / A', value: 0.3 },
        { label: 'On it — size does not enter the law', value: 0 },
        { label: 'Below it — bigger particles are slower', value: -0.3 }
      ],
      runLabel: 'Run: grow the particles',
      baseline: gas => M.setRadius(gas, M.DEFAULTS.radius),
      apply: gas => M.setRadius(gas, M.LIMITS.radius[1]),
      describe: (a, b, gas) => 'r 0.35 → ' + gas.r.toFixed(2) + ' (particles cover ' + Math.round(M.packingFraction(gas.N, gas.r, gas.A || M.area(gas)) * 100) +
        '% of the box), N ' + Math.round(a.N) + ', T ' + Math.round(a.T) + ', A ' + Math.round(a.A),
      metric: 'ratio',
      explain: (a, b, delta, gas) => 'With small particles the ratio was ' + a.ratio.toFixed(2) + '; with big ones it is ' + b.ratio.toFixed(2) +
        '. The temperature gauge read ' + Math.round(b.T) + ' both times, so nothing hit harder. The first-order excluded-area estimate for this packing is Z ≈ ' +
        M.excludedAreaZ(gas.N, gas.r, M.area(gas)).toFixed(2) + ' (Details explains it).',
      conclusion: 'The law assumes particles take up no room. Give them room and the space they actually fly through shrinks, so the walls are hit more often than N·T / A expects.'
    }
  ];

  /* ---- state ----------------------------------------------------------- */

  let gas = M.createGas();
  let timeScale = M.DEFAULTS.timeScale;
  let paused = false;
  let stageIndex = 0;
  const predictions = [null, null, null, null];
  const findings = [null, null, null, null];
  let experiment = null;   /* the guided routine in flight, or null */
  let sweep = null;        /* a stage-4 sweep in flight, or null */
  let sweepPoints = [];
  let sweepRuns = 0;
  let lastStats = null;
  let lastFrameMs = 0;
  let lastGaugeMs = 0;
  let lastHistMs = 0;
  let pbarScale = 20;
  const flash = { left: 0, right: 0, top: 0, bottom: 0 };
  const freeCue = { compressStartT: null, compressing: false };

  const activity = byId('activity');
  const hosts = Array.from(document.querySelectorAll('.activity-host'));

  const boxCanvas = byId('box-canvas');
  const histCanvas = byId('hist-canvas');
  const sweepCanvas = byId('sweep-canvas');
  const boxCtx = boxCanvas.getContext('2d');
  const histCtx = histCanvas.getContext('2d');
  const sweepCtx = sweepCanvas.getContext('2d');

  const controls = {
    n: byId('ctl-n'), t: byId('ctl-t'), w: byId('ctl-w'), r: byId('ctl-r'),
    thermo: byId('ctl-thermo'), coll: byId('ctl-coll'), pause: byId('ctl-pause'),
    speed: byId('ctl-speed'), same: byId('ctl-samespeed')
  };
  const outs = { n: byId('out-n'), t: byId('out-t'), w: byId('out-w'), r: byId('out-r') };
  const SPEEDS = [0.5, 1, 2, 4];

  /* ---- helpers ----------------------------------------------------------- */

  const fmtP = p => (Math.round(p * 10) / 10).toFixed(1);
  const fmtZ = z => Number.isFinite(z) ? z.toFixed(2) : '–';

  function setCue(text, warm) {
    const cue = byId('cue-core');
    cue.textContent = text || '';
    cue.classList.toggle('cue-warm', Boolean(warm));
  }

  function setCue4(text, warm) {
    const cue = byId('cue-4');
    cue.textContent = text || '';
    cue.classList.toggle('cue-warm', Boolean(warm));
  }

  function busy() { return experiment !== null || sweep !== null; }

  function lockControls(locked) {
    ['n', 't', 'w', 'r'].forEach(k => { controls[k].disabled = locked; });
    ['thermo', 'coll', 'same'].forEach(k => { controls[k].disabled = locked; });
    ['sweep-area', 'sweep-temp', 'sweep-count'].forEach(id => { byId(id).disabled = locked; });
  }

  /* Mirror the gas into the sliders (after an experiment or a reset moved
     something the learner did not). */
  function syncControls() {
    controls.n.value = String(gas.N); outs.n.value = String(gas.N);
    controls.t.value = String(Math.round(gas.targetT)); outs.t.value = String(Math.round(gas.targetT));
    controls.w.value = String(Math.round(gas.pistonTarget)); outs.w.value = String(Math.round(gas.pistonTarget));
    controls.r.value = gas.r.toFixed(2); outs.r.value = gas.r.toFixed(2);
    controls.thermo.setAttribute('aria-pressed', String(gas.thermostat));
    controls.thermo.innerHTML = 'Thermostat <b>' + (gas.thermostat ? 'on' : 'off') + '</b>';
    controls.coll.setAttribute('aria-pressed', String(gas.collisions));
    controls.coll.innerHTML = 'Collisions <b>' + (gas.collisions ? 'on' : 'off') + '</b>';
    controls.pause.setAttribute('aria-pressed', String(paused));
    controls.pause.textContent = paused ? 'Paused' : 'Running';
    controls.speed.innerHTML = 'Speed <b>' + timeScale + '×</b>';
    byId('speed-badge').innerHTML = timeScale + '× time';
  }

  /* ---- canvases --------------------------------------------------------- */

  function sizeCanvas(canvas, aspect, maxHeight) {
    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width === 0) return false;
    const ratio = window.devicePixelRatio || 1;
    let h = rect.width * aspect;
    if (maxHeight && h > maxHeight) h = maxHeight;
    canvas.style.height = h + 'px';
    const w = Math.round(rect.width * ratio), hh = Math.round(h * ratio);
    if (canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
    return true;
  }

  /* Speed → colour: cool blue for slow, white in the middle, gold for fast,
     relative to the target temperature's rms speed. Sixteen buckets so the
     particles draw in sixteen fills rather than six hundred. */
  const PALETTE = (() => {
    const stops = [[0, 164, 227], [255, 255, 255], [255, 215, 106]];
    const out = [];
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const seg = t < 0.5 ? 0 : 1, u = (t - seg * 0.5) * 2;
      const a = stops[seg], b = stops[seg + 1];
      const c = a.map((v, k) => Math.round(v + (b[k] - v) * u));
      out.push('rgb(' + c.join(',') + ')');
    }
    return out;
  })();

  function drawBox() {
    if (!sizeCanvas(boxCanvas, M.DEFAULTS.boxHeight / M.DEFAULTS.boxWidth, 420)) return;
    const W = boxCanvas.width, H = boxCanvas.height;
    const s = W / M.DEFAULTS.boxWidth;
    const ctx = boxCtx;
    ctx.clearRect(0, 0, W, H);
    /* the region behind the piston */
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(gas.W * s, 0, W - gas.W * s, H);
    /* the gas region */
    ctx.fillStyle = '#04213C';
    ctx.fillRect(0, 0, gas.W * s, H);

    /* particles, bucketed by speed */
    const vref = Math.max(M.rmsSpeed(gas.targetT), 1e-6);
    const buckets = PALETTE.map(() => []);
    for (let i = 0; i < gas.N; i++) {
      const v = Math.hypot(gas.vx[i], gas.vy[i]);
      const b = M.clamp(Math.floor((v / (2.2 * vref)) * 15), 0, 15);
      buckets[b].push(i);
    }
    const rp = Math.max(gas.r * s, 2.2 * (window.devicePixelRatio || 1));
    for (let b = 0; b < 16; b++) {
      const list = buckets[b];
      if (!list.length) continue;
      ctx.fillStyle = PALETTE[b];
      ctx.beginPath();
      for (const i of list) {
        const px = gas.x[i] * s, py = H - gas.y[i] * s;
        ctx.moveTo(px + rp, py);
        ctx.arc(px, py, rp, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    /* wall flashes: momentum delivered in the last frame, decayed so a hit
       lingers for a few frames. Normalised to the ideal per-wall rate so the
       glow means "more than usual". */
    const wf = gas.wallFlash;
    const decay = 0.82;
    flash.left = Math.max(flash.left * decay, wf.left);
    flash.right = Math.max(flash.right * decay, wf.right);
    flash.top = Math.max(flash.top * decay, wf.top);
    flash.bottom = Math.max(flash.bottom * decay, wf.bottom);
    const pIdeal = lastStats ? lastStats.pIdeal : M.idealPressure(gas.N, gas.targetT, M.area(gas));
    const frameS = (1 / 60) * timeScale;
    const norm = side => {
      const len = (side === 'left' || side === 'right') ? gas.H : gas.W;
      const expected = Math.max(pIdeal * len * frameS, 1e-6);
      return M.clamp(flash[side] / expected * 0.35, 0, 1);
    };
    const lw = Math.max(3, 0.02 * W);
    ctx.lineCap = 'butt';
    const wall = (x1, y1, x2, y2, a, colour) => {
      ctx.strokeStyle = colour || ('rgba(255,215,106,' + (0.15 + 0.85 * a).toFixed(3) + ')');
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    };
    wall(lw / 2, 0, lw / 2, H, norm('left'));
    wall(0, lw / 2, gas.W * s, lw / 2, norm('top'));
    wall(0, H - lw / 2, gas.W * s, H - lw / 2, norm('bottom'));
    /* the piston: a thick gold bar that glows with its own hits */
    const px = gas.W * s;
    ctx.fillStyle = 'rgba(236,172,0,' + (0.75 + 0.25 * norm('right')).toFixed(3) + ')';
    ctx.fillRect(px - lw * 1.6, 0, lw * 3.2, H);
    ctx.fillStyle = 'rgba(0,33,68,.55)';
    for (let k = 1; k <= 3; k++) ctx.fillRect(px - lw * 0.25, (H * k) / 4 - lw * 1.2, lw * 0.5, lw * 2.4);
  }

  function drawHistogram() {
    if (!sizeCanvas(histCanvas, 0.42, 220)) return;
    const W = histCanvas.width, H = histCanvas.height;
    const ctx = histCtx;
    const ratio = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, W, H);
    const T = lastStats ? lastStats.T : gas.targetT;
    if (!(T > 0) || gas.N === 0) return;
    const bins = 28;
    const vMax = 4 * Math.sqrt(Math.max(T, gas.targetT * 0.5));
    const { counts, binWidth } = M.speedHistogram(gas, bins, vMax);
    const padL = 8 * ratio, padB = 22 * ratio, padT = 8 * ratio, padR = 8 * ratio;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    /* expected count per bin from the 2D Maxwell density at the measured T */
    const expected = [];
    let peak = 1;
    for (let b = 0; b < bins; b++) {
      const v = (b + 0.5) * binWidth;
      const e = gas.N * M.maxwellSpeedPdf(v, T) * binWidth;
      expected.push(e);
      peak = Math.max(peak, e, counts[b]);
    }
    peak *= 1.08;
    const bw = plotW / bins;
    ctx.fillStyle = 'rgba(0,164,227,.55)';
    for (let b = 0; b < bins; b++) {
      const h = (counts[b] / peak) * plotH;
      ctx.fillRect(padL + b * bw + 1, padT + plotH - h, Math.max(1, bw - 2), h);
    }
    ctx.strokeStyle = '#FFD76A';
    ctx.lineWidth = 2 * ratio;
    ctx.beginPath();
    for (let b = 0; b < bins; b++) {
      const x = padL + (b + 0.5) * bw, y = padT + plotH - (expected[b] / peak) * plotH;
      if (b === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    /* axis: speed, with the rms speed marked */
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.font = (11 * ratio) + 'px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('speed →', padL, H - 6 * ratio);
    const vrms = M.rmsSpeed(T);
    const xr = padL + (vrms / vMax) * plotW;
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 1 * ratio;
    ctx.setLineDash([4 * ratio, 4 * ratio]);
    ctx.beginPath(); ctx.moveTo(xr, padT); ctx.lineTo(xr, padT + plotH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = 'center';
    ctx.fillText('rms ' + vrms.toFixed(1), xr, H - 6 * ratio);
    ctx.textAlign = 'right';
    ctx.fillText('T = ' + Math.round(T), W - padR, padT + 12 * ratio);
  }

  const SWEEP_COLOURS = { area: '#00A4E3', temp: '#C63F1D', count: '#1C704D' };
  const SWEEP_NAMES = { area: 'box (A)', temp: 'temperature (T)', count: 'particle count (N)' };

  function drawSweep() {
    if (!sizeCanvas(sweepCanvas, 0.62, 360)) return;
    const W = sweepCanvas.width, H = sweepCanvas.height;
    const ctx = sweepCtx;
    const ratio = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, W, H);
    const padL = 46 * ratio, padB = 34 * ratio, padT = 12 * ratio, padR = 14 * ratio;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    let max = 1;
    for (const p of sweepPoints) max = Math.max(max, p.pIdeal, p.P);
    max *= 1.12;
    const X = v => padL + (v / max) * plotW;
    const Y = v => padT + plotH - (v / max) * plotH;
    /* axes */
    ctx.strokeStyle = '#C6D1D8'; ctx.lineWidth = 1 * ratio;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT + plotH); ctx.stroke();
    /* the diagonal: the prediction */
    ctx.strokeStyle = '#002144'; ctx.lineWidth = 1.5 * ratio; ctx.setLineDash([6 * ratio, 5 * ratio]);
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(max), Y(max)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#40556A';
    ctx.font = (11 * ratio) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('predicted pressure  N·T / A', padL + plotW / 2, H - 8 * ratio);
    ctx.save();
    ctx.translate(12 * ratio, padT + plotH / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('measured pressure', 0, 0);
    ctx.restore();
    ctx.textAlign = 'right';
    ctx.fillText(max.toFixed(0), padL - 4 * ratio, padT + 10 * ratio);
    ctx.fillText('0', padL - 4 * ratio, padT + plotH);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#002144';
    ctx.fillText('diagonal = the law holds', X(max * 0.55) + 6 * ratio, Y(max * 0.55) - 8 * ratio);
    /* points */
    for (const p of sweepPoints) {
      ctx.fillStyle = SWEEP_COLOURS[p.kind];
      ctx.beginPath();
      ctx.arc(X(p.pIdeal), Y(p.P), (p.big ? 6 : 4.5) * ratio, 0, Math.PI * 2);
      ctx.fill();
      if (p.big) { ctx.strokeStyle = '#ECAC00'; ctx.lineWidth = 2 * ratio; ctx.stroke(); }
    }
    /* legend */
    let lx = padL + 8 * ratio, ly = padT + 14 * ratio;
    for (const k of Object.keys(SWEEP_NAMES)) {
      ctx.fillStyle = SWEEP_COLOURS[k];
      ctx.beginPath(); ctx.arc(lx, ly - 4 * ratio, 4 * ratio, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#40556A';
      ctx.fillText(SWEEP_NAMES[k], lx + 8 * ratio, ly);
      ly += 15 * ratio;
    }
    ctx.fillStyle = '#9F6700';
    ctx.fillText('gold ring = big particles (r ≥ 0.7)', lx, ly);
  }

  /* ---- gauges ----------------------------------------------------------- */

  function renderGauges(st) {
    byId('g-n').textContent = String(st.N);
    byId('g-t').textContent = String(Math.round(st.T));
    byId('g-a').textContent = String(Math.round(st.A));
    byId('g-p').textContent = fmtP(st.pEma);
    const hitsS = Math.max(st.hitsPerSecond, 1);
    const band = st.pEma / Math.sqrt(hitsS * gas.emaTau);
    byId('g-p-note').textContent = '±' + fmtP(band) + ' · from wall hits';
    byId('g-pi').textContent = fmtP(st.pIdeal);
    const z = st.pIdeal > 0 ? st.pEma / st.pIdeal : NaN;
    byId('g-z').textContent = 'ratio Z = ' + fmtZ(z);
    byId('g-hits').textContent = String(Math.round(st.hitsPerSecond));
    const want = Math.max(st.pIdeal, st.pEma, 1) * 1.3;
    pbarScale += (want - pbarScale) * 0.1;
    byId('pbar-ideal').style.width = M.clamp(st.pIdeal / pbarScale * 100, 0, 100) + '%';
    byId('pbar-meas').style.width = M.clamp(st.pEma / pbarScale * 100, 0, 100) + '%';
  }

  /* ---- the guided experiment -------------------------------------------- */

  function startExperiment(i) {
    if (busy()) return;
    const stage = STAGES[i];
    experiment = { stage: i, phase: 'prepare', elapsed: 0, before: null, after: null, startT: null };
    gas.thermostat = true;
    gas.collisions = true;
    paused = false;
    stage.baseline(gas);
    lockControls(true);
    syncControls();
    renderPredictions(i);
    byId('run-button').disabled = true;
    byId('run-button').textContent = 'Running…';
    byId('again-button').hidden = true;
    byId('finding').hidden = true;
    byId('run-progress').hidden = false;
    setProgress(0, 'Preparing: putting this stage’s variable at its baseline');
    setCue('');
  }

  function setProgress(fraction, label) {
    byId('progress-fill').style.width = Math.round(M.clamp(fraction, 0, 1) * 100) + '%';
    byId('progress-label').textContent = label;
  }

  function pistonSettled() { return gas.pistonU === 0 && Math.abs(gas.W - gas.pistonTarget) < 1e-9; }

  function tickExperiment(simDt) {
    const e = experiment;
    const stage = STAGES[e.stage];
    e.elapsed += simDt;
    const total = SETTLE_S + WINDOW_S + SETTLE_S + WINDOW_S;
    switch (e.phase) {
      case 'prepare':
        if (e.elapsed >= SETTLE_S && pistonSettled()) {
          e.phase = 'before'; e.elapsed = 0; M.beginWindow(gas);
        }
        setProgress(0.02, 'Preparing: putting this stage’s variable at its baseline');
        break;
      case 'before':
        setProgress((SETTLE_S + e.elapsed) / total, 'Measuring BEFORE — ' + e.elapsed.toFixed(1) + ' of ' + WINDOW_S + ' s');
        if (e.elapsed >= WINDOW_S) {
          e.before = M.endWindow(gas);
          stage.apply(gas);
          syncControls();
          e.phase = 'settle'; e.elapsed = 0;
        }
        break;
      case 'settle':
        setProgress((SETTLE_S + WINDOW_S + Math.min(e.elapsed, SETTLE_S)) / total,
          stage.id === 'area' && !pistonSettled() ? 'The piston is sliding in…' : 'Settling after the change…');
        if (e.elapsed >= SETTLE_S && pistonSettled()) {
          e.phase = 'after'; e.elapsed = 0; M.beginWindow(gas);
        }
        break;
      case 'after':
        setProgress((SETTLE_S + WINDOW_S + SETTLE_S + e.elapsed) / total, 'Measuring AFTER — ' + e.elapsed.toFixed(1) + ' of ' + WINDOW_S + ' s');
        if (e.elapsed >= WINDOW_S) {
          e.after = M.endWindow(gas);
          finishExperiment();
        }
        break;
      default:
        break;
    }
  }

  function finishExperiment() {
    const e = experiment;
    const stage = STAGES[e.stage];
    const a = e.before, b = e.after;
    const observed = stage.metric === 'ratio' ? (b.ratio - a.ratio) : (b.P / a.P);
    /* which choice the gauge supported: the one whose value is nearest */
    let nearest = 0, best = Infinity;
    stage.choices.forEach((c, k) => {
      const d = Math.abs(c.value - observed);
      if (d < best) { best = d; nearest = k; }
    });
    const chosen = predictions[e.stage];
    findings[e.stage] = { before: a, after: b, observed, nearest, chosen, supported: chosen === nearest };
    experiment = null;
    lockControls(false);
    byId('run-progress').hidden = true;
    renderStage(e.stage);
    /* A4: the observation cue, at the moment it becomes true */
    if (stage.metric === 'ratio') {
      setCue('Ratio Z went ' + fmtZ(a.ratio) + ' → ' + fmtZ(b.ratio) + ' with T at ' + Math.round(b.T) +
        ' both times: the walls are being hit more often than N·T / A expects.', false);
    } else {
      setCue('Pressure went ' + fmtP(a.P) + ' → ' + fmtP(b.P) + ' (' + observed.toFixed(2) + '×) — ' + stage.describe(a, b, gas) + '.', false);
    }
  }

  function cancelExperiment() {
    if (!experiment) return;
    experiment = null;
    if (gas.window) M.endWindow(gas);
    lockControls(false);
    byId('run-progress').hidden = true;
  }

  /* ---- stage 4 sweeps ------------------------------------------------------ */

  const SWEEPS = {
    area: { values: [100, 85, 70, 55, 40], set: v => M.setBoxWidth(gas, v), save: () => gas.pistonTarget },
    temp: { values: [150, 300, 450, 600, 900], set: v => M.setTemperature(gas, v, true), save: () => gas.targetT },
    count: { values: [60, 120, 240, 360, 480], set: v => M.setCount(gas, v), save: () => gas.N }
  };

  function startSweep(kind) {
    if (busy()) return;
    const def = SWEEPS[kind];
    sweep = { kind, step: 0, phase: 'set', elapsed: 0, restore: def.save(), points: [] };
    gas.thermostat = true;
    gas.collisions = true;
    paused = false;
    lockControls(true);
    byId('run-button').disabled = true;
    byId('sweep-progress').hidden = false;
    byId('sweep-clear').disabled = true;
    setCue4('');
  }

  function tickSweep(simDt) {
    const s = sweep;
    const def = SWEEPS[s.kind];
    s.elapsed += simDt;
    if (s.phase === 'set') {
      if (s.step >= def.values.length) {
        def.set(s.restore);
        s.phase = 'restore'; s.elapsed = 0;
        return;
      }
      def.set(def.values[s.step]);
      syncControls();
      s.phase = 'settle'; s.elapsed = 0;
      byId('sweep-progress-label').textContent = 'Step ' + (s.step + 1) + ' of ' + def.values.length + ': setting ' + SWEEP_NAMES[s.kind] + ' to ' + def.values[s.step] + '…';
    } else if (s.phase === 'settle') {
      if (s.elapsed >= SWEEP_SETTLE_S && pistonSettled()) { s.phase = 'measure'; s.elapsed = 0; M.beginWindow(gas); }
    } else if (s.phase === 'measure') {
      byId('sweep-progress-label').textContent = 'Step ' + (s.step + 1) + ' of ' + def.values.length + ': measuring — ' + s.elapsed.toFixed(1) + ' of ' + SWEEP_WINDOW_S + ' s';
      if (s.elapsed >= SWEEP_WINDOW_S) {
        const m = M.endWindow(gas);
        const point = { kind: s.kind, run: sweepRuns + 1, N: m.N, T: m.T, A: m.A, r: gas.r, P: m.P, pIdeal: m.pIdeal, ratio: m.ratio, big: gas.r >= 0.7 };
        s.points.push(point);
        sweepPoints.push(point);
        appendSweepRow(point);
        drawSweep();
        s.step++;
        s.phase = 'set'; s.elapsed = 0;
      }
    } else if (s.phase === 'restore') {
      if (s.elapsed >= 0.5 && pistonSettled()) finishSweep();
    }
  }

  function finishSweep() {
    const s = sweep;
    sweep = null;
    sweepRuns++;
    lockControls(false);
    syncControls();
    byId('sweep-progress').hidden = true;
    byId('sweep-clear').disabled = false;
    renderRunButton(stageIndex);
    const zs = s.points.map(p => p.ratio);
    const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
    const spread = Math.sqrt(zs.reduce((a, z) => a + (z - mean) * (z - mean), 0) / zs.length);
    const r = s.points[0].r;
    const est = M.excludedAreaZ(Math.round(s.points[0].N), r, s.points[0].A);
    byId('sweep-summary').innerHTML = 'Sweep of ' + SWEEP_NAMES[s.kind] + ' at particle size ' + r.toFixed(2) + ': mean ratio <b>Z = ' + mean.toFixed(2) +
      '</b>, point-to-point spread ±' + spread.toFixed(2) + '. ' +
      (r >= 0.7
        ? 'The points sit above the diagonal by a consistent margin; the first-order excluded-area estimate for the first point’s packing is Z ≈ ' + est.toFixed(2) + '.'
        : 'Points within a few percent of the diagonal: the law held across the sweep, to within the noise of a few hundred particles.');
    setCue4(r >= 0.7
      ? 'Every point landed above the diagonal: at this particle size the walls are hit more often than the law predicts, in the same direction every time.'
      : 'The points track the diagonal: the measured pressure followed N·T / A across five values of ' + SWEEP_NAMES[s.kind] + '.', false);
  }

  function cancelSweep() {
    if (!sweep) return;
    const s = sweep;
    sweep = null;
    if (gas.window) M.endWindow(gas);
    SWEEPS[s.kind].set(s.restore);
    lockControls(false);
    syncControls();
    byId('sweep-progress').hidden = true;
    byId('sweep-clear').disabled = false;
  }

  function appendSweepRow(p) {
    const tr = document.createElement('tr');
    const cells = [
      SWEEP_NAMES[p.kind] + ' #' + p.run, Math.round(p.N), Math.round(p.T), Math.round(p.A), p.r.toFixed(2), fmtP(p.pIdeal), fmtP(p.P), fmtZ(p.ratio)
    ];
    cells.forEach((c, k) => {
      const td = document.createElement('td');
      td.textContent = String(c);
      if (k === 7) td.className = 'z';
      tr.appendChild(td);
    });
    byId('sweep-body').appendChild(tr);
  }

  function clearSweeps() {
    sweepPoints = [];
    sweepRuns = 0;
    byId('sweep-body').innerHTML = '';
    byId('sweep-summary').textContent = 'No sweeps yet.';
    setCue4('');
    drawSweep();
  }

  /* ---- the task panel per stage --------------------------------------------- */

  function renderPredictions(i) {
    const stage = STAGES[i];
    const list = byId('prediction-list');
    list.innerHTML = '';
    const locked = busy() || findings[i] !== null;
    stage.choices.forEach((c, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'prediction' + (predictions[i] === k ? ' selected' : '');
      b.textContent = c.label;
      b.setAttribute('aria-pressed', String(predictions[i] === k));
      b.disabled = locked;
      b.addEventListener('click', () => {
        if (busy()) return;
        predictions[i] = k;
        findings[i] = null;
        renderStage(i);
      });
      list.appendChild(b);
    });
  }

  function renderRunButton(i) {
    const stage = STAGES[i];
    const run = byId('run-button');
    const again = byId('again-button');
    if (busy()) { run.disabled = true; run.textContent = sweep ? 'A sweep is running…' : 'Running…'; again.hidden = true; return; }
    if (findings[i]) { run.disabled = true; run.textContent = 'Done — read the finding'; again.hidden = false; return; }
    if (predictions[i] === null) { run.disabled = true; run.textContent = 'Choose a prediction first'; again.hidden = true; return; }
    run.disabled = false; run.textContent = stage.runLabel; again.hidden = true;
  }

  function renderEcho(i) {
    const stageEl = byId('stage-' + (i + 1));
    const echo = stageEl && stageEl.querySelector('.lesson-strip .echo');
    if (!echo) return;
    const choice = predictions[i];
    if (choice === null) { echo.hidden = true; echo.textContent = ''; return; }
    echo.hidden = false;
    const f = findings[i];
    echo.innerHTML = 'You predicted: <b>' + STAGES[i].choices[choice].label + '</b>' +
      (f ? '<br>The gauge: <b>' + (f.supported ? 'agreed' : 'disagreed') + '</b>' : '');
  }

  function renderFinding(i) {
    const f = findings[i];
    const el = byId('finding');
    if (!f) { el.hidden = true; return; }
    const stage = STAGES[i];
    const a = f.before, b = f.after;
    el.hidden = false;
    el.classList.toggle('contradicted', !f.supported);
    byId('finding-verdict').textContent = (f.supported ? 'Supported: ' : 'Not what the gauge showed: ') + stage.choices[f.nearest].label;
    const rows = [];
    const row = (label, value) => rows.push('<div class="measure-row"><span>' + label + '</span><b>' + value + '</b></div>');
    row('Before', 'P = ' + fmtP(a.P) + ' ± ' + fmtP(a.uncertainty) + ' · Z = ' + fmtZ(a.ratio) + ' · ' + a.hits + ' hits');
    row('After', 'P = ' + fmtP(b.P) + ' ± ' + fmtP(b.uncertainty) + ' · Z = ' + fmtZ(b.ratio) + ' · ' + b.hits + ' hits');
    row('Change', stage.describe(a, b, gas));
    if (stage.metric === 'ratio') row('Ratio Z, before → after', '<span class="ratio">' + fmtZ(a.ratio) + ' → ' + fmtZ(b.ratio) + '</span>');
    else row('Pressure after ÷ before', '<span class="ratio">' + f.observed.toFixed(2) + '×</span>');
    byId('measure-list').innerHTML = rows.join('');
    byId('finding-explanation').textContent = stage.explain(a, b, f.observed, gas);
    byId('finding-conclusion').textContent = stage.conclusion;
  }

  function renderStage(i) {
    const stage = STAGES[i];
    byId('task-title').textContent = stage.title;
    byId('task-purpose').textContent = stage.purpose;
    byId('prediction-question').textContent = stage.question;
    renderPredictions(i);
    renderRunButton(i);
    renderEcho(i);
    renderFinding(i);
  }

  function moveActivityTo(i) {
    const host = hosts[i] || hosts[0];
    if (activity.parentElement !== host) host.appendChild(activity);
  }

  /* ---- the frame loop ------------------------------------------------------- */

  function frame(nowMs) {
    const realDt = lastFrameMs ? Math.min(0.05, (nowMs - lastFrameMs) / 1000) : 1 / 60;
    lastFrameMs = nowMs;
    const simDt = paused ? 0 : realDt * timeScale;
    if (simDt > 0) {
      lastStats = M.advance(gas, simDt);
      if (experiment) tickExperiment(simDt);
      else if (sweep) tickSweep(simDt);
      else freePlayCues(simDt);
    }
    drawBox();
    if (nowMs - lastGaugeMs > 120 && lastStats) { renderGauges(lastStats); lastGaugeMs = nowMs; }
    if (nowMs - lastHistMs > 70) { drawHistogram(); lastHistMs = nowMs; }
    requestAnimationFrame(frame);
  }

  /* A4 cues during free play: the one worth naming is the piston heating the
     gas when nothing is holding the temperature. */
  function freePlayCues() {
    const moving = gas.pistonU < 0;
    if (!gas.thermostat && moving && !freeCue.compressing) {
      freeCue.compressing = true;
      freeCue.compressStartT = lastStats.T;
    }
    if (freeCue.compressing) {
      if (!moving) {
        freeCue.compressing = false;
        const t0 = freeCue.compressStartT, t1 = lastStats.T;
        if (!gas.thermostat && t1 > t0 * 1.08) {
          setCue('T rose ' + Math.round(t0) + ' → ' + Math.round(t1) + ' while the piston moved in with the thermostat off: the moving wall did work on every particle that bounced off it.', true);
        }
      }
    }
  }

  /* ---- controls ----------------------------------------------------------------- */

  controls.n.addEventListener('input', () => {
    if (busy()) return;
    M.setCount(gas, Number(controls.n.value));
    outs.n.value = String(gas.N);
  });
  controls.t.addEventListener('input', () => {
    if (busy()) return;
    M.setTemperature(gas, Number(controls.t.value), !gas.thermostat);
    outs.t.value = String(Math.round(gas.targetT));
  });
  controls.w.addEventListener('input', () => {
    if (busy()) return;
    M.setBoxWidth(gas, Number(controls.w.value));
    outs.w.value = String(Math.round(gas.pistonTarget));
  });
  controls.r.addEventListener('input', () => {
    if (busy()) return;
    M.setRadius(gas, Number(controls.r.value));
    outs.r.value = gas.r.toFixed(2);
    if (gas.r >= 0.7) setCue('Watch the ratio: at this size the particles cover ' + Math.round(M.packingFraction(gas.N, gas.r, M.area(gas)) * 100) + '% of the box, and the walls are hit more often than N·T / A expects.', false);
  });
  controls.thermo.addEventListener('click', () => {
    if (busy()) return;
    gas.thermostat = !gas.thermostat;
    syncControls();
    if (!gas.thermostat) setCue('Thermostat off: the gas keeps whatever energy it has. Slide the piston in and watch T.', false);
  });
  controls.coll.addEventListener('click', () => {
    if (busy()) return;
    gas.collisions = !gas.collisions;
    syncControls();
    if (!gas.collisions) setCue('Collisions off: particles pass through each other. The pressure reading does not change — a collision between two particles never touches a wall.', false);
    else M.setRadius(gas, gas.r);
  });
  controls.pause.addEventListener('click', () => {
    paused = !paused;
    syncControls();
  });
  controls.speed.addEventListener('click', () => {
    const k = (SPEEDS.indexOf(timeScale) + 1) % SPEEDS.length;
    timeScale = SPEEDS[k];
    syncControls();
  });
  controls.same.addEventListener('click', () => {
    if (busy()) return;
    const v = M.rmsSpeed(gas.targetT);
    for (let i = 0; i < gas.N; i++) {
      const th = gas.rng() * Math.PI * 2;
      gas.vx[i] = v * Math.cos(th); gas.vy[i] = v * Math.sin(th);
    }
    setCue('Every particle now has the same speed. ' + (gas.collisions
      ? 'Watch the histogram relax into the curve as they collide.'
      : 'With collisions off it will stay that way: nothing exchanges energy between particles.'), false);
  });

  byId('run-button').addEventListener('click', () => startExperiment(stageIndex));
  byId('again-button').addEventListener('click', () => { findings[stageIndex] = null; renderStage(stageIndex); startExperiment(stageIndex); });
  byId('sweep-area').addEventListener('click', () => startSweep('area'));
  byId('sweep-temp').addEventListener('click', () => startSweep('temp'));
  byId('sweep-count').addEventListener('click', () => startSweep('count'));
  byId('sweep-clear').addEventListener('click', clearSweeps);

  /* ---- the shell's three events ------------------------------------------------- */

  document.addEventListener('stagechange', event => {
    const index = event.detail.index;
    if (window.lessonShell && window.lessonShell.resetting) { moveActivityTo(index); return; }
    if (index !== stageIndex) { cancelExperiment(); cancelSweep(); }
    stageIndex = index;
    moveActivityTo(index);
    renderStage(index);
    drawSweep();
  });

  /* Reset, in place. The enumeration, written out:
       1. gas — a fresh createGas() at the defaults (N, T, W, r, thermostat,
          collisions, the EMA, the wall accumulators, the window);
       2. timeScale, paused;
       3. experiment, sweep — cancelled, their windows closed, controls
          unlocked, progress hidden;
       4. predictions[], findings[] — cleared, so every echo hides and the
          finding panel hides;
       5. sweepPoints, sweepRuns, the sweep table, the sweep chart, the
          sweep summary;
       6. the slider values and outputs, the four switches, the speed badge;
       7. #activity back in host 0; stageIndex 0;
       8. pbarScale and the wall flash state; the free-play cue tracker.
     #cue-core and #cue-4 are .obs-cue, so the shell restores them; listed
     here so the next reader does not go looking. */
  document.addEventListener('lessonreset', () => {
    cancelExperiment();
    cancelSweep();
    gas = M.createGas();
    timeScale = M.DEFAULTS.timeScale;
    paused = false;
    for (let i = 0; i < 4; i++) { predictions[i] = null; findings[i] = null; }
    clearSweeps();
    lastStats = null;
    pbarScale = 20;
    flash.left = flash.right = flash.top = flash.bottom = 0;
    freeCue.compressing = false; freeCue.compressStartT = null;
    syncControls();
    lockControls(false);
    stageIndex = 0;
    moveActivityTo(0);
    renderStage(0);
    for (let i = 0; i < 4; i++) renderEchoFor(i);
  });

  function renderEchoFor(i) {
    const stageEl = byId('stage-' + (i + 1));
    const echo = stageEl && stageEl.querySelector('.lesson-strip .echo');
    if (echo) { echo.hidden = true; echo.textContent = ''; }
  }

  /* Nothing here refuses a reset. Left as null on purpose, not by omission. */
  if (window.lessonShell) window.lessonShell.onReset = null;

  document.addEventListener('presentationchange', () => { drawBox(); drawHistogram(); drawSweep(); });

  /* The canvases size themselves from their boxes, and the box changes when
     the window does not (a stage switch, presentation mode, the intro
     disclosure), so one ResizeObserver per canvas host is the only resizer. */
  const ro = new ResizeObserver(() => { drawBox(); drawHistogram(); drawSweep(); });
  ro.observe(boxCanvas.parentElement);
  ro.observe(histCanvas.parentElement);
  ro.observe(sweepCanvas.parentElement);

  /* ---- start-up ---------------------------------------------------------------- */

  const tabs = Array.from(document.querySelectorAll('.stage-tab'));
  const selected = Math.max(0, tabs.findIndex(t => t.getAttribute('aria-selected') === 'true'));
  stageIndex = selected;
  moveActivityTo(selected);
  syncControls();
  renderStage(selected);
  drawSweep();
  requestAnimationFrame(frame);
})();
