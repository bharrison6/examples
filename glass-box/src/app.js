// Glass Box UI. Everything heavy runs in the worker; this file renders.
'use strict';
(() => {

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString('en-US');
  const pct = (x) => Math.round(x * 100) + '%';

  // ---------- training backend ----------
  // Preferred: a real Web Worker built from WORKER_SRC, so training never
  // touches the UI thread. Some hosts (sandboxed previews, strict CSP) refuse
  // blob workers — synchronously, with a late error event, or by silently
  // never starting — so every path falls back to running the identical
  // runtime (createWorkerRuntime, already loaded on this page) in chunked
  // slices on the main thread. Same code, same numbers, slightly less smooth.
  const handlers = {};
  function on(type, fn) { handlers[type] = fn; }
  function deliver(msg) { const h = handlers[msg.type]; if (h) h(msg); }

  let sendImpl = null;
  const outbox = [];
  function send(msg) { if (sendImpl) sendImpl(msg); else outbox.push(msg); }
  function flushOutbox() { while (outbox.length) sendImpl(outbox.shift()); }

  function activateFallback(why) {
    if (sendImpl) return;
    console.warn('Glass Box: this host blocks background workers (' + why + ') — running single-threaded. Same computation, less smooth.');
    const note = $('modenote');
    if (note) note.textContent = ' · single-thread mode (this host blocks background workers; training may stutter but is identical)';
    const rt = createWorkerRuntime((msg) => setTimeout(() => deliver(msg), 0));
    sendImpl = (msg) => setTimeout(() => rt.dispatch(msg), 0);
    flushOutbox();
  }

  (function initBackend() {
    let w = null, booted = false;
    try {
      w = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })));
    } catch (e) {
      activateFallback(e && e.message ? e.message : 'Worker construction failed');
      return;
    }
    const bootTimer = setTimeout(() => {
      if (!booted) { try { w.terminate(); } catch (_) {} activateFallback('worker never started'); }
    }, 4000);
    w.onerror = () => {
      if (!booted) { clearTimeout(bootTimer); try { w.terminate(); } catch (_) {} activateFallback('worker startup error'); }
    };
    w.onmessage = (e) => {
      if (!booted && e.data && e.data.type === 'boot') {
        booted = true;
        clearTimeout(bootTimer);
        sendImpl = (msg) => w.postMessage(msg);
        flushOutbox();
      }
      deliver(e.data);
    };
  })();

  // ---------- act navigation ----------
  const navs = [$('nav1'), $('nav2'), $('nav3')];
  const acts = [$('act1'), $('act2'), $('act3')];
  navs.forEach((btn, i) => btn.addEventListener('click', () => {
    navs.forEach((b, j) => b.classList.toggle('on', i === j));
    acts.forEach((a, j) => a.classList.toggle('on', i === j));
    window.scrollTo({ top: 0 });
  }));
  // ---------- presentation mode ----------
  // One CSS variable scales the whole page; the body class also reveals the
  // header's quick route to the presenter's notes. Reachable from Settings and
  // from the footer, so a presenter never has to hunt for it mid-session.
  // CONTRACT.md names this control exactly "Presentation mode", so its state
  // rides in a badge and in aria-pressed rather than inside the label.
  const presBtn = $('presbtn'), presState = presBtn.querySelector('.state'), presFoot = $('presfoot');
  function syncPresenterUI() {
    const on = document.body.classList.contains('presenter');
    presState.textContent = on ? 'on' : 'off';
    presBtn.setAttribute('aria-pressed', String(on));
    presFoot.textContent = on ? 'leave presentation mode' : 'presentation mode';
  }
  function togglePresenter(e) {
    if (e) e.preventDefault();
    document.body.classList.toggle('presenter');
    syncPresenterUI();
    // canvases are sized in device pixels from their laid-out width
    window.dispatchEvent(new Event('resize'));
  }
  presBtn.addEventListener('click', togglePresenter);
  presFoot.addEventListener('click', togglePresenter);
  syncPresenterUI();

  // ════════════════════════ ACT 1 ════════════════════════

  const CFG = TEXT.CFG;
  let a1Busy = false;
  // Era store: { step, name, blurb, loss, weights(Float32Array), samples[] }
  const eras = [];
  let mirror = null;          // main-thread copy of the latest model
  let pgEra = -1;             // era selected in playground/attention (-1 = latest)

  function eraModel() {
    const e = eras[pgEra === -1 ? eras.length - 1 : pgEra];
    if (!e) return null;
    if (!e._model) e._model = GB.deserialize({ ...CFG }, e.weights);
    return e._model;
  }
  function latestEra() { return eras[eras.length - 1]; }

  function sampleMain(model, n, temp, seed) {
    const srng = GB.makeRng(seed);
    return TEXT.decode(GB.generate(model, [TEXT.stoi[' ']], n, temp, srng));
  }

  // ---- 1.1 tokenizer ----
  function renderTokens() {
    const out = $('tokout');
    out.innerHTML = '';
    const s = $('tokinput').value.slice(0, 60);
    for (const ch of s) {
      const id = TEXT.stoi[ch];
      const d = document.createElement('div');
      d.className = 'tok' + (ch === ' ' ? ' space' : '');
      d.innerHTML = (ch === ' ' ? '␣' : ch.replace('<', '&lt;')) +
        `<small>${id === undefined ? '?' : id}</small>`;
      if (id === undefined) d.title = 'not in this model\'s vocabulary';
      out.appendChild(d);
    }
  }
  $('tokinput').addEventListener('input', renderTokens);
  $('a1vocab').textContent = String(CFG.vocab);

  // ---- the textbook itself (§1.3 fold) ----
  (() => {
    const words = new Set(TEXT.CORPUS.toLowerCase().split(/[^a-z]+/).filter(Boolean));
    $('corpusstats').innerHTML = `An original story written for this demo — not a published book, nothing ` +
      `copyrighted. <b>${fmt(TEXT.CORPUS.length)} characters</b>, <b>${words.size} distinct words</b>, ` +
      `${CFG.vocab} distinct characters. The tiny, repetitive vocabulary is deliberate: the same words come ` +
      `round hundreds of times, which is why the arc fits in minutes on a phone. This story is the model's ` +
      `entire universe — everything it will ever write is a recombination of what you can read right here. ` +
      `(Frontier models differ in exactly this: their textbook is a large slice of everything humans have written.)`;
    $('corpusbox').textContent = TEXT.CORPUS;
  })();

  // ---- 1.2 parameter map ----
  function componentList(model) {
    const p = model.p, d = CFG.dim;
    const rows = [];
    rows.push({ name: 'token embedding', kind: 'emb', count: p.tokEmb.length, mat: p.tokEmb, rows: CFG.vocab, cols: d, cap: `one learned ${d}-number vector per character (${CFG.vocab} × ${d})` });
    rows.push({ name: 'position embedding', kind: 'emb', count: p.posEmb.length, mat: p.posEmb, rows: CFG.ctx, cols: d, cap: `one learned vector per position, 1st through ${CFG.ctx}th` });
    p.blocks.forEach((b, i) => {
      rows.push({ name: `block ${i + 1} · attention`, kind: 'attn', count: b.wqkv.length + b.bqkv.length + b.wproj.length + b.bproj.length, mat: b.wqkv, rows: d, cols: 3 * d, cap: `the query/key/value tables of layer ${i + 1} (${d} × ${3 * d}, plus the output projection)` });
      rows.push({ name: `block ${i + 1} · feed-forward`, kind: 'mlp', count: b.w1.length + b.b1.length + b.w2.length + b.b2.length, mat: b.w1, rows: d, cols: model.cfg.mlp, cap: `layer ${i + 1}'s two-step transform (${d} → ${model.cfg.mlp} → ${d})` });
    });
    const lnCount = 2 * CFG.dim * (2 * CFG.layers + 1);
    rows.push({ name: 'normalization', kind: 'ln', count: lnCount, mat: null, cap: '' });
    rows.push({ name: 'output head', kind: 'head', count: p.head.length + p.headB.length, mat: p.head, rows: d, cols: CFG.vocab, cap: `turns the final ${d}-number state into a score for each of the ${CFG.vocab} characters` });
    return rows;
  }
  let pmapSel = -1;
  function renderPmap() {
    const model = mirror;
    if (!model) return;
    const rows = componentList(model);
    const max = Math.max(...rows.map(r => r.count));
    const wrap = $('pmap');
    wrap.innerHTML = '';
    rows.forEach((r, i) => {
      const div = document.createElement(r.mat ? 'button' : 'div');
      div.className = 'prow' + (i === pmapSel ? ' on' : '');
      div.dataset.kind = r.kind;
      if (r.mat) { div.type = 'button'; div.setAttribute('aria-pressed', String(i === pmapSel)); }
      div.innerHTML = `<span class="pname">${r.name}</span>` +
        `<span class="pbar"><i style="width:${Math.max(2, 100 * r.count / max)}%"></i></span>` +
        `<span class="pnum">${fmt(r.count)}</span>`;
      if (r.mat) div.addEventListener('click', () => {
          pmapSel = (pmapSel === i ? -1 : i);
          renderPmap();
          renderWeightPeek(rows[i]);
        });
      else div.title = 'Normalization has learned scale and offset values in every layer; it has no single weight matrix to inspect.';
      wrap.appendChild(div);
    });
  }
  function renderWeightPeek(r) {
    const box = $('wpeek');
    if (pmapSel === -1 || !r || !r.mat) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    $('wpeekcap').innerHTML = `<b>${r.name}</b> — ${r.cap}. Every pixel is one live parameter: gold above zero, blue below. Press train and come back — they all move.`;
    const cv = $('wpeekcanvas');
    const R = Math.min(r.rows, 64), C = Math.min(r.cols, 160);
    cv.width = C; cv.height = R;
    cv.style.height = Math.min(200, R * 3) + 'px';
    const ctx2 = cv.getContext('2d');
    const img = ctx2.createImageData(C, R);
    let maxAbs = 1e-6;
    for (let i = 0; i < R * C; i++) maxAbs = Math.max(maxAbs, Math.abs(r.mat[i]));
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
      const v = r.mat[y * r.cols + x] / maxAbs; // -1..1
      const o = (y * C + x) * 4;
      if (v >= 0) { img.data[o] = 20 + 216 * v; img.data[o + 1] = 25 + 140 * v; img.data[o + 2] = 40; }
      else { img.data[o] = 10; img.data[o + 1] = 40 + 90 * -v; img.data[o + 2] = 70 + 150 * -v; }
      img.data[o + 3] = 255;
    }
    ctx2.putImageData(img, 0, 0);
  }

  function renderScale(params) {
    const models = [
      { name: 'this page', p: params, you: true, note: fmt(params) + ' parameters' },
      { name: 'GPT-2 (2019)', p: 124e6, note: '124 million' },
      { name: 'GPT-3 (2020)', p: 175e9, note: '175 billion' },
      { name: 'frontier (est.)', p: 1.8e12, note: 'on the order of a trillion' },
    ];
    const wrap = $('scalebars');
    wrap.innerHTML = '';
    const maxLog = Math.log10(2e12);
    for (const m of models) {
      const div = document.createElement('div');
      div.className = 'srow' + (m.you ? ' you' : '');
      div.innerHTML = `<span class="sname">${m.name}</span>` +
        `<span class="sbar"><i style="width:${Math.max(1.5, 100 * Math.log10(m.p) / maxLog)}%"></i></span>` +
        `<span class="snum">${m.note}</span>`;
      wrap.appendChild(div);
    }
  }

  // ---- 1.3 training ----
  const lossHist = [];
  function drawLoss() {
    const cv = $('losschart');
    const W = cv.clientWidth || 300, H = 110;
    cv.width = W * 2; cv.height = H * 2;
    const c = cv.getContext('2d');
    c.scale(2, 2);
    c.clearRect(0, 0, W, H);
    const yMax = 3.4, yMin = 0;
    const xMax = Math.max(400, latestEra() ? latestEra().step + 100 : 400, lossHist.length ? lossHist[lossHist.length - 1].step : 0);
    const X = (s) => 30 + (W - 38) * s / xMax;
    const Y = (l) => 6 + (H - 24) * (1 - (l - yMin) / (yMax - yMin));
    // axis
    c.strokeStyle = '#1a3354'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(30, 6); c.lineTo(30, H - 18); c.lineTo(W - 6, H - 18); c.stroke();
    c.fillStyle = '#6d8099'; c.font = '10px system-ui';
    c.fillText('loss', 2, 12);
    [1, 2, 3].forEach(v => { c.fillText(String(v), 16, Y(v) + 3); });
    c.fillText(String(xMax) + ' steps', W - 60, H - 5);
    // era ticks
    c.strokeStyle = '#123'; c.setLineDash([3, 3]);
    for (const e of TEXT.ERAS) {
      if (e.step === 0 || e.step > xMax) continue;
      c.beginPath(); c.moveTo(X(e.step), 6); c.lineTo(X(e.step), H - 18); c.stroke();
    }
    c.setLineDash([]);
    if (lossHist.length > 1) {
      c.strokeStyle = '#ECAC00'; c.lineWidth = 2; c.lineJoin = 'round';
      c.beginPath();
      lossHist.forEach((pt, i) => {
        const x = X(pt.step), y = Y(Math.min(yMax, pt.loss));
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      });
      c.stroke();
    }
    const newest = lossHist[lossHist.length - 1];
    $('losschart-desc').textContent = newest
      ? `Training loss chart through step ${fmt(newest.step)}. Latest average loss ${newest.loss.toFixed(2)}; lower is better.`
      : 'Training loss chart. No loss samples yet.';
  }

  function nextTarget() {
    const step = latestEra() ? latestEra().step : 0;
    for (const e of TEXT.ERAS) if (e.step > step) return e;
    return { step: step + 400, name: 'more', blurb: 'Further refinement — the curve flattens but keeps inching down.' };
  }
  function trainLabel() {
    const t = nextTarget();
    const cur = latestEra() ? latestEra().step : 0;
    return `Train ▸ ${t.name === 'more' ? '+400 steps' : 'era: ' + t.name} (${fmt(t.step - cur)} steps)`;
  }

  $('trainbtn').addEventListener('click', () => {
    if (a1Busy) return;
    a1Busy = true;
    const t = nextTarget();
    $('trainbtn').innerHTML = '<span class="spin"></span> training…';
    $('trainbtn').disabled = true;
    $('statphase').textContent = 'training';
    send({ cmd: 'a1.train', steps: t.step - (latestEra() ? latestEra().step : 0) });
    $('trainbtn')._target = t;
  });

  on('a1.ready', (m) => {
    $('a1params').textContent = fmt(m.params);
    $('a1params2').textContent = fmt(m.params);
    const w = new Float32Array(m.weights);
    mirror = GB.deserialize({ ...CFG }, w);
    const e0 = { ...TEXT.ERAS[0], loss: m.loss0, weights: w, samples: [] };
    e0.samples = [
      { temp: 0.8, text: sampleMain(mirror, 140, 0.8, 1) },
      { temp: 0.8, text: sampleMain(mirror, 140, 0.8, 2) },
    ];
    eras.push(e0);
    $('livesample').innerHTML = `<span class="dim">era 0 · untrained, pure static:</span>\n` + e0.samples[0].text;
    renderPmap();
    renderScale(m.params);
    renderEraChips();
    renderCompare();
    renderPlayground();
    renderAttention();
    drawLoss();
  });

  on('a1.progress', (m) => {
    $('statstep').textContent = fmt(m.step);
    $('statloss').textContent = m.loss.toFixed(2);
    $('statsps').textContent = String(Math.round(m.sps));
    lossHist.push({ step: m.step, loss: m.loss });
    drawLoss();
  });

  on('a1.midsample', (m) => {
    $('livesample').innerHTML = `<span class="dim">step ${fmt(m.step)} · it currently writes:</span>\n` + m.text;
  });

  on('a1.done', (m) => {
    a1Busy = false;
    const t = $('trainbtn')._target || nextTarget();
    const w = new Float32Array(m.weights);
    mirror = GB.deserialize({ ...CFG }, w);
    const era = { step: m.step, name: t.name, blurb: t.blurb, loss: m.loss, weights: w, samples: m.samples };
    eras.push(era);
    pgEra = -1;
    $('statstep').textContent = fmt(m.step);
    $('statloss').textContent = m.loss.toFixed(2);
    $('statphase').textContent = 'era: ' + era.name;
    $('livesample').innerHTML = `<span class="dim">after ${fmt(m.step)} steps (loss ${m.loss.toFixed(2)}) it writes:</span>\n` + m.samples[0].text;
    $('trainbtn').disabled = false;
    $('trainbtn').textContent = trainLabel();
    renderEraChips();
    renderCompare();
    renderPmap();
    if (pmapSel >= 0) renderWeightPeek(componentList(mirror)[pmapSel]);
    renderPlayground();
    renderAttention();
    drawLoss();
  });

  function renderEraChips() {
    const wrap = $('erachips');
    wrap.innerHTML = '';
    eras.forEach((e, i) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = `${e.name} · ${fmt(e.step)}`;
      b.title = e.blurb;
      b.addEventListener('click', () => {
        $('livesample').innerHTML = `<span class="dim">era: ${e.name} (${fmt(e.step)} steps, loss ${e.loss.toFixed(2)}) wrote:</span>\n` + (e.samples[0] ? e.samples[0].text : '—');
      });
      wrap.appendChild(b);
    });
  }

  function renderCompare() {
    const wrap = $('eracompare');
    wrap.innerHTML = '';
    if (eras.length < 2) return;
    for (const e of eras) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.innerHTML = `<h4>${e.name} — ${fmt(e.step)} steps, loss ${e.loss.toFixed(2)}</h4>` +
        `<div class="livebox">${(e.samples[0] ? e.samples[0].text : '').replace(/</g, '&lt;')}</div>`;
    wrap.appendChild(cell);
    }
  }

  // ---- 1.4 playground ----
  function renderPgEraChips() {
    const wrap = $('pgeras');
    wrap.innerHTML = '';
    eras.forEach((e, i) => {
      const b = document.createElement('button');
      b.className = 'chip' + ((pgEra === -1 ? eras.length - 1 : pgEra) === i ? ' on' : '');
      b.textContent = e.name;
      b.addEventListener('click', () => { pgEra = i; renderPlayground(); renderAttention(); });
      wrap.appendChild(b);
    });
  }
  function renderPlayground() {
    renderPgEraChips();
    const model = eraModel();
    if (!model) return;
    const txt = $('pginput').value || ' ';
    const ids = Array.from(TEXT.encode(txt));
    const { logits } = GB.forwardLast(model, ids, false);
    const temp = parseFloat($('temp').value);
    const probs = GB.softmaxTemp(logits, temp === 0 ? 0.0001 : temp);
    const order = Array.from(probs.keys()).sort((a, b) => probs[b] - probs[a]).slice(0, 8);
    const wrap = $('probbars');
    wrap.innerHTML = '';
    for (const id of order) {
      const ch = TEXT.chars[id];
      const d = document.createElement('div');
      d.className = 'pb';
      d.innerHTML = `<span class="pch">${ch === ' ' ? '␣' : ch}</span>` +
        `<span class="pbar"><i style="width:${(probs[id] * 100).toFixed(1)}%"></i></span>` +
        `<span class="pv">${(probs[id] * 100).toFixed(1)}%</span>`;
      wrap.appendChild(d);
    }
  }
  let pgAutoTimer = null;
  function pgWriteOne() {
    const model = eraModel();
    if (!model) return;
    const txt = $('pginput').value || ' ';
    const ids = Array.from(TEXT.encode(txt));
    const { logits } = GB.forwardLast(model, ids, false);
    const temp = parseFloat($('temp').value);
    let id;
    if (temp === 0) id = GB.argmax(logits);
    else id = GB.sampleFrom(GB.softmaxTemp(logits, temp), Math.random);
    $('pginput').value = txt + TEXT.chars[id];
    renderPlayground();
  }
  $('pgstep').addEventListener('click', pgWriteOne);
  $('pgauto').addEventListener('click', () => {
    if (pgAutoTimer) { clearInterval(pgAutoTimer); pgAutoTimer = null; $('pgauto').textContent = 'write 60'; return; }
    let n = 0;
    $('pgauto').textContent = 'stop';
    pgAutoTimer = setInterval(() => {
      pgWriteOne();
      if (++n >= 60) { clearInterval(pgAutoTimer); pgAutoTimer = null; $('pgauto').textContent = 'write 60'; }
    }, 55);
  });
  $('pginput').addEventListener('input', renderPlayground);
  $('temp').addEventListener('input', () => {
    $('tempval').textContent = parseFloat($('temp').value).toFixed(1);
    renderPlayground();
  });

  // ---- 1.5 attention ----
  let attHead = 0; // 0..(layers*heads-1), or -1 for average
  let attQ = -1;   // selected query position
  function attSpec() {
    const L = Math.floor(attHead / CFG.heads), H = attHead % CFG.heads;
    return { L, H };
  }
  function renderAttHeads() {
    const wrap = $('attheads');
    wrap.innerHTML = '';
    for (let l = 0; l < CFG.layers; l++) for (let h = 0; h < CFG.heads; h++) {
      const i = l * CFG.heads + h;
      const b = document.createElement('button');
      b.className = 'chip' + (attHead === i ? ' on' : '');
      b.textContent = `layer ${l + 1} · head ${h + 1}`;
      b.addEventListener('click', () => { attHead = i; renderAttention(); });
      wrap.appendChild(b);
    }
  }
  function renderAttention() {
    renderAttHeads();
    const model = eraModel();
    if (!model) return;
    const raw = $('attinput').value.slice(0, CFG.ctx) || ' ';
    const ids = Array.from(TEXT.encode(raw));
    const { attMaps, T } = GB.forwardLast(model, ids, true);
    const { L, H } = attSpec();
    const A = attMaps[L][H]; // T*T
    if (attQ < 0 || attQ >= T) attQ = T - 1;
    // text spans
    const wrap = $('atttext');
    wrap.innerHTML = '';
    const row = [];
    for (let s = 0; s < T; s++) row.push(A[attQ * T + s]);
    const maxW = Math.max(...row.slice(0, attQ + 1), 1e-6);
    for (let t = 0; t < T; t++) {
      const sp = document.createElement('button');
      sp.type = 'button'; sp.className = 'attchar';
      sp.textContent = raw[t] === ' ' ? ' ' : raw[t];
      if (t === attQ) sp.classList.add('q');
      else if (t < attQ) {
        const w = row[t] / maxW;
        sp.style.background = `rgba(236,172,0,${(w * 0.85).toFixed(3)})`;
        if (w > 0.55) sp.style.color = '#002144';
      } else {
        sp.style.color = '#39506b';
      }
      sp.title = t <= attQ ? `attention ${(row[t] * 100).toFixed(1)}%` : 'the future — masked';
      sp.setAttribute('aria-label', `Character ${t + 1}: ${raw[t] === ' ' ? 'space' : raw[t]}. ${sp.title}`);
      sp.addEventListener('click', () => { attQ = t; renderAttention(); });
      wrap.appendChild(sp);
    }
    // matrix
    const cv = $('attmatrix');
    const Wpx = cv.clientWidth || 300;
    const cell = Math.max(3, Math.floor(Wpx / T));
    cv.width = cell * T; cv.height = cell * T;
    cv.style.height = 'auto';
    const c = cv.getContext('2d');
    c.fillStyle = '#050f1c';
    c.fillRect(0, 0, cv.width, cv.height);
    for (let t = 0; t < T; t++) {
      let rowMax = 1e-6;
      for (let s = 0; s <= t; s++) rowMax = Math.max(rowMax, A[t * T + s]);
      for (let s = 0; s <= t; s++) {
        const w = A[t * T + s] / rowMax;
        c.fillStyle = `rgba(236,172,0,${(w * 0.95).toFixed(3)})`;
        c.fillRect(s * cell, t * cell, cell - 1, cell - 1);
      }
      if (t === attQ) {
        c.strokeStyle = '#00A4E3'; c.lineWidth = 1;
        c.strokeRect(0.5, t * cell + 0.5, cell * (t + 1) - 1, cell - 1);
      }
    }
  }
  $('attinput').addEventListener('input', () => { attQ = -1; renderAttention(); });

  // ════════════════════════ ACT 2 ════════════════════════

  let a2Busy = false, a2Done = false;
  const cpD = [], cpS = [];

  function resetA2DerivedUI() {
    // A rerun is a new experiment, not a continuation.  Reset both model
    // state (worker a2Init) and every reader/cache that reflected its output.
    Object.keys(voteRows).forEach(k => delete voteRows[k]);
    $('votebars').innerHTML = ''; $('chainpeek').innerHTML = '';
    $('votebtn').disabled = true; $('votebtn').textContent = 'Try 1, 2, 4 and 8 attempts ▸';
    $('votestatus').textContent = 'Train the models in §2.1 first.';
    starBase = null; starRounds.length = 0; $('starbars').innerHTML = '';
    $('starbtn').disabled = true; $('starbtn').textContent = 'Self-improvement round 1 ▸';
    $('starstatus').textContent = 'Train the models in §2.1 first. Each round: ~120 self-posed problems, sampled three times, then fine-tuned on verifier-certified correct chains.';
    $('midacc').textContent = '—';
    ['pbarD', 'pbarS'].forEach(id => { $(id).style.width = '0%'; });
    ['stepD', 'stepS', 'lossD', 'lossS'].forEach(id => { $(id).textContent = '—'; });
    ['liveD', 'liveS'].forEach(id => { $(id).textContent = ''; });
  }

  $('a2trainbtn').addEventListener('click', () => {
    if (a2Busy) return;
    a2Busy = true;
    a2Done = false;
    cpD.length = 0; cpS.length = 0;
    resetA2DerivedUI();
    $('a2trainbtn').innerHTML = '<span class="spin"></span> training Model D…';
    $('a2trainbtn').disabled = true;
    $('accD').textContent = '?'; $('accD').classList.add('dim');
    $('accS').textContent = '?'; $('accS').classList.add('dim');
    $('exD').innerHTML = ''; $('exS').innerHTML = '';
    send({ cmd: 'a2.train' });
  });

  on('a2.phase', (m) => {
    if (m.phase === 'mid') {
      $('a2trainbtn').innerHTML = '<span class="spin"></span> preparing §2.3\'s half-trained model…';
      $('a2status').textContent = 'One more small model: a deliberately half-trained reasoner for the sections below (about 20 seconds)…';
      return;
    }
    $('a2trainbtn').innerHTML = `<span class="spin"></span> training Model ${m.phase === 'direct' ? 'D — direct answers' : 'S — shows its work'}…`;
    $('a2status').textContent = m.phase === 'direct'
      ? 'Model D is drilling problem → answer, thousands of times…'
      : 'Now Model S drills the same problems with the written-out steps…';
  });

  on('a2.progress', (m) => {
    if (m.model === 'mid') return;
    const isD = m.model === 'direct';
    $(isD ? 'pbarD' : 'pbarS').style.width = (100 * m.step / m.total).toFixed(1) + '%';
    $(isD ? 'stepD' : 'stepS').textContent = fmt(m.step) + '/' + fmt(m.total);
    $(isD ? 'lossD' : 'lossS').textContent = m.loss.toFixed(3);
  });

  on('a2.attempt', (m) => {
    const box = $(m.model === 'direct' ? 'liveD' : 'liveS');
    const mark = m.right ? '<span class="ok">✓</span>' : `<span style="color:var(--bad)">✗ (true: ${m.sum})</span>`;
    box.innerHTML = `<span class="dim">live attempt:</span> ${m.a}+${m.b}=${m.text.replace(/</g, '&lt;')} ${mark}`;
  });

  on('a2.checkpoint', (m) => {
    const arr = m.model === 'direct' ? cpD : cpS;
    arr.push(m);
    const box = $(m.model === 'direct' ? 'liveD' : 'liveS');
    box.innerHTML = `<span class="dim">spot-check at step ${fmt(m.step)}:</span> ${pct(m.acc)} correct (20 unseen problems)`;
  });

  on('a2.trained', (m) => {
    const isD = m.model === 'direct';
    const big = $(isD ? 'accD' : 'accS');
    big.textContent = pct(m.acc) + ' correct';
    big.classList.remove('dim');
    const list = $(isD ? 'exD' : 'exS');
    list.innerHTML = '';
    for (const ex of m.examples) {
      const d = document.createElement('div');
      d.className = 'exrow' + (ex.right ? '' : ' wrong');
      const shown = ex.text.replace(/</g, '&lt;');
      d.innerHTML = `${ex.a}+${ex.b}=` +
        (ex.right ? `<span class="ok">${shown}</span>` : `<span class="ans">${shown}</span> <span style="color:var(--ink3)">true: ${ex.sum}</span>`);
      list.appendChild(d);
    }
    if (isD) $('a2status').textContent = `Model D done: ${pct(m.acc)} on the exam after ${fmt(m.step)} steps. Model S now gets the same wall-clock…`;
  });

  on('a2.done', (m) => {
    a2Busy = false;
    a2Done = true;
    $('a2trainbtn').disabled = false;
    $('a2trainbtn').textContent = 'Re-run the experiment';
    $('a2status').textContent = 'Done. Same brain, same time budget — the only difference was what the training text looked like. Scroll on: their exams are below, and §2.3–2.4 now unlock.';
    $('midacc').textContent = pct(m.midAcc) + ' correct alone';
    $('votebtn').disabled = false;
    $('votestatus').textContent = `Using a sibling of Model S trained only ${fmt(m.midStep)} steps — deliberately mediocre (${pct(m.midAcc)}), so there is room to climb.`;
    $('starbtn').disabled = false;
    $('starstatus').textContent = `Same ${pct(m.midAcc)} under-trained model. Each round it poses ~120 fresh problems to itself, keeps verifier-certified correct attempts, and trains on them.`;
    starBase = m.midAcc;
    renderStarBars();
  });

  // ---- 2.3 verified voting ----
  const voteRows = {};
  function ensureVoteRows() {
    const wrap = $('votebars');
    if (wrap.childElementCount) return;
    for (const N of [1, 2, 4, 8]) {
      const d = document.createElement('div');
      d.className = 'vb';
      d.innerHTML = `<span class="vlab">${N} attempt${N > 1 ? 's' : ''}</span>` +
        `<span class="vbar"><i style="width:0%"></i></span><span class="vnum">—</span>`;
      wrap.appendChild(d);
      voteRows[N] = d;
    }
  }
  $('votebtn').addEventListener('click', () => {
    if (a2Busy || !a2Done) return;
    a2Busy = true;
    ensureVoteRows();
    $('votebtn').innerHTML = '<span class="spin"></span> sampling…';
    $('votebtn').disabled = true;
    send({ cmd: 'a2.vote', Ns: [1, 2, 4, 8], nProblems: 50 });
  });
  on('a2.vote.progress', (m) => {
    $('votestatus').textContent = `N=${m.N}: problem ${m.i}/${m.n}…`;
  });
  on('a2.vote.result', (m) => {
    const row = voteRows[m.N];
    row.querySelector('i').style.width = (m.acc * 100).toFixed(0) + '%';
    row.querySelector('.vnum').textContent = pct(m.acc);
    if (m.example && !$('chainpeek').childElementCount) renderChainPeek(m.example);
  });
  on('a2.vote.done', () => {
    a2Busy = false;
    $('votebtn').disabled = false;
    $('votebtn').textContent = 'Run again';
    $('votestatus').textContent = 'Same frozen model every row — the climb is bought purely with more attempts plus the verifier. This is why "thinking longer" works.';
  });
  function renderChainPeek(ex) {
    const wrap = $('chainpeek');
    wrap.innerHTML = `<p class="note"><b>One problem, ${ex.chains.length} attempts</b> — ${ex.a}+${ex.b} (true answer ${ex.sum}). The verifier reads only the written steps:</p>`;
    ex.chains.slice(0, 4).forEach(ch => {
      const d = document.createElement('div');
      d.className = 'ch';
      d.innerHTML = `<div class="livebox" style="min-height:0">${ch.text.replace(/</g, '&lt;')}</div>` +
        `<div class="verdict ${ch.ok ? 'ok' : 'no'}">${ch.ok ? '✓ verifier: steps check out — vote for ' + ch.answer : '✗ verifier: ' + ch.why}</div>`;
      wrap.appendChild(d);
    });
  }

  // ---- 2.4 self-improvement ----
  let starBase = null;
  const starRounds = [];
  function renderStarBars() {
    const wrap = $('starbars');
    wrap.innerHTML = '';
    const mk = (label, acc, hi) => {
      const d = document.createElement('div');
      d.className = 'vb';
      d.innerHTML = `<span class="vlab">${label}</span>` +
        `<span class="vbar"><i style="width:${(acc * 100).toFixed(0)}%${hi ? '' : ';background:#5a6f8a'}"></i></span>` +
        `<span class="vnum">${pct(acc)}</span>`;
      wrap.appendChild(d);
    };
    if (starBase != null) mk('before', starBase, false);
    starRounds.forEach((r, i) => mk(`round ${i + 1}`, r.acc, true));
  }
  $('starbtn').addEventListener('click', () => {
    if (a2Busy || !a2Done) return;
    a2Busy = true;
    $('starbtn').innerHTML = '<span class="spin"></span> round running…';
    $('starbtn').disabled = true;
    send({ cmd: 'a2.star' });
  });
  on('a2.star.progress', (m) => {
    $('starstatus').textContent = m.phase === 'sample'
      ? `Round ${m.round}: attempting problem ${m.i}/${m.n} — kept ${m.kept} certified-correct chains so far…`
      : `Round ${m.round}: fine-tuning on its own ${m.kept} kept chains (${m.i}/${m.n})…`;
  });
  on('a2.star.done', (m) => {
    a2Busy = false;
    starRounds.push(m);
    renderStarBars();
    $('starbtn').disabled = false;
    $('starbtn').textContent = `Self-improvement round ${starRounds.length + 1} ▸`;
    $('starstatus').textContent =
      `Round ${m.round}: kept ${m.kept}/${m.nProblems} of its own attempts and trained on them → ${pct(m.acc)} on the fixed exam. ` +
      (starRounds.length >= 2 ? 'Note it also keeps far more of its own work than when it started — better at the task, so better at generating its own curriculum.' : 'No new human-written data was involved.');
  });

  // ════════════════════════ ACT 3 ════════════════════════

  $('goaltext').textContent = AGENT.GOAL;
  $('schemapre').textContent = JSON.stringify(AGENT.SCHEMAS, null, 2);

  let ep = AGENT.newEpisode();
  let agMode = null; // 'you' | 'auto'
  let agTimer = null;

  function windowChars() { return parseInt($('agwindow').value, 10) || 0; }

  function renderTranscript() {
    const wrap = $('transcript');
    wrap.innerHTML = '';
    for (const e of ep.entries) {
      const d = document.createElement('div');
      const err = e.role === 'observation' && /error/i.test(e.text.slice(0, 40));
      d.className = 'turn ' + e.role + (err ? ' err' : '');
      const who = { system: 'system prompt', goal: 'the user', thought: 'model — thought', action: 'model — action', observation: err ? 'tool — error' : 'tool — observation', final: 'final answer', stopped: 'stopped' }[e.role] || e.role;
      d.innerHTML = `<span class="who">${who}</span>` + e.text.replace(/</g, '&lt;');
      wrap.appendChild(d);
    }
    // context meter
    const toks = AGENT.tokenEstimate(ep);
    $('ctxtok').textContent = fmt(toks);
    $('ctxfill').style.width = Math.min(100, toks / 7.2) + '%';
    // raw context
    const w = windowChars();
    const full = AGENT.serializeContext(ep);
    const vis = AGENT.visibleContext(ep, w);
    $('rawctx').innerHTML = (w && vis.length < full.length
      ? `<span class="cut">[${fmt(full.length - vis.length)} characters have fallen out of the window — gone]</span>\n`
      : '') + vis.replace(/</g, '&lt;');
    wrap.lastElementChild && wrap.lastElementChild.scrollIntoView({ block: 'nearest' });
  }

  function pulseLoop(k) {
    document.querySelectorAll('.loopdia .lstep').forEach(el => el.classList.toggle('on', el.dataset.k === k));
  }

  function agentStopTimer() {
    if (agTimer) { clearInterval(agTimer); agTimer = null; }
  }

  function renderCandidates() {
    const wrap = $('candidates');
    wrap.innerHTML = '';
    if (agMode !== 'you' || ep.done) return;
    const res = AGENT.candidates(AGENT.visibleContext(ep, windowChars()));
    if (res.stop) {
      const d = document.createElement('div');
      d.className = 'turn stopped';
      d.innerHTML = `<span class="who">the model, seeing only its window</span>${res.stop}`;
      wrap.appendChild(d);
      return;
    }
    const cap = document.createElement('p');
    cap.className = 'note'; cap.style.margin = '0';
    cap.textContent = 'You are the model. The context above is all you know. Choose the next move:';
    wrap.appendChild(cap);
    for (const cand of res.list) {
      const b = document.createElement('button');
      b.className = 'cand';
      const act = cand.action ? AGENT.fmtAction(cand.action) : '';
      b.innerHTML = `<span class="cth">"${cand.thought}"</span><span class="cac">→ ${act}</span>`;
      b.addEventListener('click', () => {
        AGENT.applyTurn(ep, cand);
        renderTranscript();
        renderCandidates();
      });
      wrap.appendChild(b);
    }
  }

  function autoStep() {
    if (ep.done) { agentStopTimer(); pulseLoop(''); return; }
    const choice = AGENT.policy(AGENT.visibleContext(ep, windowChars()));
    if (choice.stop) {
      ep.entries.push({ role: 'stopped', text: choice.stop });
      ep.done = true;
      renderTranscript();
      agentStopTimer();
      pulseLoop('');
      return;
    }
    pulseLoop('model');
    setTimeout(() => pulseLoop('tool'), 450);
    setTimeout(() => pulseLoop('obs'), 800);
    setTimeout(() => pulseLoop('ctx'), 1150);
    AGENT.applyTurn(ep, choice);
    renderTranscript();
  }

  $('agmode-you').addEventListener('click', () => {
    agentStopTimer();
    agMode = 'you';
    if (ep.done || ep.turns > 0) ep = AGENT.newEpisode();
    renderTranscript();
    renderCandidates();
  });
  $('agmode-auto').addEventListener('click', () => {
    agentStopTimer();
    agMode = 'auto';
    if (ep.done || ep.turns > 0) ep = AGENT.newEpisode();
    renderTranscript();
    renderCandidates();
    autoStep();
    agTimer = setInterval(autoStep, 1500);
  });
  $('agreset').addEventListener('click', () => {
    agentStopTimer();
    agMode = null;
    ep = AGENT.newEpisode();
    pulseLoop('');
    renderTranscript();
    renderCandidates();
  });
  $('agwindow').addEventListener('change', () => {
    renderTranscript();
    renderCandidates();
  });

  // ---------- boot ----------
  on('boot', () => {
    send({ cmd: 'a1.init' });
  });
  renderTokens();
  renderTranscript();
  $('trainbtn').textContent = trainLabel();
  window.addEventListener('resize', () => { drawLoss(); if (eras.length) renderAttention(); });

})();
