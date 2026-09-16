'use strict';

/* What the Survey Missed — view layer over ../src/model.js (OccupancyModel).
   The lesson shell (../tools/lesson-shell) owns the header, stage tablist,
   dialogs, presentation mode, A6 check cards and Reset; this file owns the
   activity: the seeded scenario, the fixed survey rounds, the interpretation
   choice, the revisit rounds, the reveal, and the optional likelihood view.

   NO SHARED-INSTRUMENT MOVE. Unlike ion-flight/two-winters, the "evidence
   ledger" (status line, two habitat summaries, two 24-site maps) is cheap
   markup, not a canvas or a bound widget, so it is simply re-rendered into
   three independent slots (#ledger-1, #ledger-3, #ledger-4 — Survey, Revisit,
   Compare) every time state changes, rather than moved as one DOM node
   between hosts. Whichever stage is on screen shows the current evidence;
   the other two slots hold the same markup, hidden by the shell's own
   [hidden] rule on the inactive .stage panel. */
(() => {
  const M = window.OccupancyModel;
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  const INITIAL_SEED = 20260908;
  const fmt = value => (value * 100).toFixed(1) + '%';
  const higherOf = (a, b, key) => (a[key] === b[key] ? 'tie' : (a[key] > b[key] ? 'A' : 'B'));

  let seed = INITIAL_SEED;
  let scenario = M.createScenario(seed);
  let rounds = 0;
  let selection = null;
  let interpreted = false;
  let revealed = false;
  let round1Higher = null;
  const predictions = { 1: null, 2: null, 3: null, 4: null };

  function summaryFor(group) {
    return rounds ? M.observedSummary(scenario, rounds, group) : null;
  }

  function history(site) {
    return site.detections.slice(0, rounds).map(v => (v ? 'detected' : 'not detected')).join(' · ') || 'no completed visits';
  }

  /* ============================ the evidence ledger ====================== */

  function statusText() {
    if (!rounds) return 'Run the first fixed round. It will visit all 48 sites.';
    if (revealed) return 'Explore mode: truth is revealed. Round ' + rounds + ' covers ' + (rounds * 48) + ' fixed site-visits.';
    if (interpreted) return 'Round ' + rounds + ' complete: ' + (rounds * 48) + ' fixed site-visits. You may add the next fixed round or reveal the model.';
    return 'Round ' + rounds + ' complete: ' + (rounds * 48) + ' fixed site-visits. Interpret this detection difference before continuing.';
  }

  function siteState(site) {
    if (revealed) return site.occupied ? (M.everDetected(site, Math.max(rounds, 1)) ? 'detected' : 'occupied-missed') : 'unoccupied';
    return rounds && M.everDetected(site, rounds) ? 'detected' : '';
  }

  function siteButtonsHtml(group) {
    return M.sitesFor(scenario, group).map(site => {
      const state = siteState(site);
      const activeClass = selection === site.id ? ' active' : '';
      const label = site.id + '; ' + history(site) + (revealed ? '; ' + (site.occupied ? 'occupied' : 'unoccupied') : '');
      return '<button type="button" class="site ' + state + activeClass + '" data-site="' + site.id +
        '" aria-label="' + label.replace(/"/g, '&quot;') + '">' + site.id.split('-')[1] + '</button>';
    }).join('');
  }

  function siteDetailText() {
    const site = selection && scenario.sites.find(candidate => candidate.id === selection);
    if (!site) return 'Select a site after the first round to inspect its visible detection history.';
    return site.id + ': visible history — ' + history(site) + '. A site click only inspects a fixed record.';
  }

  function metricCard(label, summary) {
    return '<div class="metric-card"><h4>' + label + '</h4><div class="metric-value">' +
      (summary ? fmt(summary.observedFraction) : '—') + '</div><div class="metric-note">' +
      (summary
        ? (summary.detected + ' of 24 sites ever detected across ' + rounds + ' round' + (rounds > 1 ? 's' : '') + '; ' + summary.siteVisits + ' site-visits.')
        : 'No completed visits yet.') +
      '</div></div>';
  }

  function ledgerHtml() {
    const a = summaryFor('A');
    const b = summaryFor('B');
    const legend = revealed
      ? '<span><i class="dot" style="background:var(--lite)"></i> detection recorded</span>' +
        '<span><i class="dot" style="background:var(--gold)"></i> occupied but missed</span>' +
        '<span><i class="dot" style="background:rgba(255,255,255,.15)"></i> unoccupied</span>'
      : '<span><i class="dot" style="background:var(--lite)"></i> detection recorded</span>' +
        '<span><i class="dot" style="background:var(--navy-2)"></i> no detection / not yet surveyed</span>';
    return '' +
      '<p class="status-line" role="status">' + statusText() + '</p>' +
      '<div class="metric-row">' + metricCard('Habitat A', a) + metricCard('Habitat B', b) + '</div>' +
      '<div class="legend">' + legend + '</div>' +
      '<div class="maps">' +
        '<div><h4>Habitat A &middot; 24 sites</h4><div class="map">' + siteButtonsHtml('A') + '</div></div>' +
        '<div><h4>Habitat B &middot; 24 sites</h4><div class="map">' + siteButtonsHtml('B') + '</div></div>' +
      '</div>' +
      '<p class="site-detail">' + siteDetailText() + '</p>';
  }

  function renderLedgers() {
    ['ledger-1', 'ledger-3', 'ledger-4'].forEach(id => {
      const host = $('#' + id);
      if (host) host.innerHTML = ledgerHtml();
    });
  }

  /* ============================ Interpret recap =========================== */

  function renderInterpretRecap() {
    const node = $('#interpretRecap');
    if (!node) return;
    if (!rounds) { node.textContent = 'Run round 1 in the Survey stage first.'; return; }
    const a = summaryFor('A');
    const b = summaryFor('B');
    node.innerHTML = 'After round' + (rounds > 1 ? 's 1–' + rounds : ' 1') + ': Habitat A detected <b>' +
      a.detected + '/24</b> sites (' + fmt(a.observedFraction) + '); Habitat B detected <b>' + b.detected +
      '/24</b> (' + fmt(b.observedFraction) + ').';
  }

  /* ============================ prediction echoes ========================= */

  function updateEcho(stageKey) {
    const echo = $('#echo-' + stageKey);
    if (!echo) return;
    const prediction = predictions[stageKey];
    if (prediction == null) { echo.hidden = true; return; }
    echo.hidden = false;
    if (stageKey === '1') {
      const label = prediction === 'A' ? 'Habitat A' : prediction === 'B' ? 'Habitat B' : 'about the same';
      let text = 'You predicted: <b>' + label + '</b>.';
      if (rounds >= 1) {
        const a = summaryFor('A');
        const b = summaryFor('B');
        const higher = higherOf(a, b, 'observedFraction');
        text += ' Observed after round 1: A ' + fmt(a.observedFraction) + ', B ' + fmt(b.observedFraction) +
          ' — ' + (higher === 'tie' ? 'about the same' : 'Habitat ' + higher) + ' showed more detections.';
      }
      echo.innerHTML = text;
    } else if (stageKey === '2') {
      const label = prediction === 'yes' ? 'Yes, it proves it' : 'No, it does not by itself';
      let text = 'You said: <b>' + label + '</b>.';
      if (interpreted) text += ' The justified claim: a detection difference alone does not prove an occupancy difference.';
      echo.innerHTML = text;
    } else if (stageKey === '3') {
      const label = prediction === 'yes' ? 'Yes, it can flip' : 'No, the same habitat stays higher';
      let text = 'You predicted: <b>' + label + '</b>.';
      if (rounds >= 2 && round1Higher) {
        const a = summaryFor('A');
        const b = summaryFor('B');
        const now = higherOf(a, b, 'observedFraction');
        text += ' After round ' + rounds + ': the higher-detection habitat has ' +
          (now === round1Higher ? 'stayed the same as round 1.' : 'changed since round 1.');
      }
      echo.innerHTML = text;
    } else if (stageKey === '4') {
      const label = prediction === 'A' ? 'Habitat A' : 'Habitat B';
      let text = 'You predicted: <b>' + label + '</b> has higher realized occupancy.';
      if (revealed) {
        const a = summaryFor('A');
        const b = summaryFor('B');
        const trueHigher = higherOf(a, b, 'realizedOccupancy');
        text += ' Realized: ' + (trueHigher === 'tie' ? 'about the same' : 'Habitat ' + trueHigher) +
          ' has higher occupancy (' + fmt(a.realizedOccupancy) + ' vs ' + fmt(b.realizedOccupancy) + ').';
      }
      echo.innerHTML = text;
    }
  }

  /* ============================ optional likelihood view =================== */

  function renderInference() {
    const node = $('#likelihoodGrid');
    if (!node) return;
    node.innerHTML = '';
    if (!rounds) {
      $('#likelihoodText').textContent = 'Survey at least one round to view histories.';
      $('#likelihoodSelection').textContent = 'Choose ψ and p to inspect one grid cell.';
      return;
    }
    const group = $('#inferenceHabitat').value;
    const chosenPsi = Number($('#psiSelect').value);
    const chosenP = Number($('#pSelect').value);
    const counts = M.countHistories(scenario, group, rounds);
    const grid = M.likelihoodGrid(counts, 10);
    for (let row = 10; row >= 0; row -= 1) {
      const label = document.createElement('span');
      label.className = 'axis';
      label.textContent = row === 10 ? 'ψ 1' : row === 5 ? '.5' : row === 0 ? '0' : '';
      node.append(label);
      grid.filter(cell => Math.round(cell.psi * 10) === row).sort((a, b) => a.p - b.p).forEach(cell => {
        const swatch = document.createElement('i');
        swatch.className = 'cell' + (cell.psi === chosenPsi && cell.p === chosenP ? ' selected' : '');
        swatch.style.background = 'rgba(0,111,159,' + (0.12 + 0.88 * cell.relativeLikelihood).toFixed(3) + ')';
        swatch.title = 'ψ=' + cell.psi.toFixed(1) + ', p=' + cell.p.toFixed(1) + ', relative likelihood=' + cell.relativeLikelihood.toFixed(2);
        node.append(swatch);
      });
    }
    const support = M.relativeSupport(grid, 0.15);
    const chosen = grid.find(cell => cell.psi === chosenPsi && cell.p === chosenP);
    $('#likelihoodSelection').textContent = chosen
      ? ('Selected ψ=' + chosen.psi.toFixed(1) + ', p=' + chosen.p.toFixed(1) + ': relative likelihood ' + chosen.relativeLikelihood.toFixed(2) + '.')
      : 'Choose ψ and p to inspect one grid cell.';
    $('#likelihoodText').textContent = 'Observed ' + group + ' histories: ' +
      Object.entries(counts).map(([h, n]) => h + ' × ' + n).join(', ') + '. ' + support.length +
      ' of 121 cells have relative likelihood ≥ 0.15; ' +
      (rounds === 1 ? 'one visit leaves a broad ψ/p ambiguity.' : 'finite histories can still leave a broad region.');
  }

  /* ============================ gate + full render ========================= */

  function renderAll() {
    const tab2 = $('#tab-2');
    const tab3 = $('#tab-3');
    const tab4 = $('#tab-4');
    tab2.disabled = rounds < 1;
    tab2.title = tab2.disabled ? 'Run round 1 to unlock this stage' : '';
    tab3.disabled = !interpreted;
    tab3.title = tab3.disabled ? 'Interpret round 1 to unlock this stage' : '';
    tab4.disabled = !interpreted;
    tab4.title = tab4.disabled ? 'Interpret round 1 to unlock this stage' : '';
    $('#round-2-btn').disabled = rounds !== 1;
    $('#round-3-btn').disabled = rounds !== 2;
    renderLedgers();
    renderInterpretRecap();
    renderInference();
    ['1', '2', '3', '4'].forEach(updateEcho);
  }

  /* ============================ actions ==================================== */

  $('#round-1-btn').addEventListener('click', () => {
    if (rounds >= 1) return;
    rounds = 1;
    const a = summaryFor('A');
    const b = summaryFor('B');
    round1Higher = higherOf(a, b, 'observedFraction');
    $('#cue-1').textContent = 'Round 1 complete: Habitat A detected ' + a.detected + '/24 (' + fmt(a.observedFraction) +
      '); Habitat B detected ' + b.detected + '/24 (' + fmt(b.observedFraction) + '). Open Interpret to decide what this can mean.';
    renderAll();
  });

  $$('.round-btn').forEach(button => button.addEventListener('click', () => {
    const n = Number(button.dataset.round);
    if (n !== rounds + 1) return;
    rounds = n;
    const a = summaryFor('A');
    const b = summaryFor('B');
    const now = higherOf(a, b, 'observedFraction');
    $('#cue-3').textContent = 'Round ' + rounds + ' complete: observed fraction now A ' + fmt(a.observedFraction) +
      ', B ' + fmt(b.observedFraction) + '. The higher-detection habitat has ' +
      (now === round1Higher ? 'stayed the same as round 1.' : 'changed since round 1.');
    renderAll();
  }));

  document.addEventListener('click', event => {
    const button = event.target.closest && event.target.closest('[data-explain]');
    if (!button) return;
    if (button.dataset.explain === 'cautious') {
      interpreted = true;
      $('#cue-2').textContent = 'Correct: a detection difference can reflect occupancy, detection probability, or both. Revisit and Compare are now unlocked.';
    } else {
      $('#cue-2').textContent = 'That claim goes beyond the detection evidence. A detection difference can reflect occupancy, detectability, or both. Try again.';
    }
    renderAll();
  });

  document.addEventListener('click', event => {
    const button = event.target.closest && event.target.closest('[data-transfer]');
    if (!button) return;
    $('#transferFeedback').textContent = button.dataset.transfer === 'correct'
      ? 'Yes. Treat a detection difference as evidence to investigate detection as well as occupancy; it is not a direct animal count.'
      : 'No. Detection totals are not abundance, and more fixed visits improve evidence without guaranteeing a finite-sample ranking.';
  });

  $('#reveal-btn').addEventListener('click', () => {
    revealed = true;
    const a = summaryFor('A');
    const b = summaryFor('B');
    $('#cue-4').textContent = 'Realized truth: Habitat A ' + a.occupied + '/24 occupied (' + fmt(a.realizedOccupancy) +
      '); Habitat B ' + b.occupied + '/24 (' + fmt(b.realizedOccupancy) + '). Compare that with the detected fractions above.';
    const truth = $('#truthPanel');
    truth.hidden = false;
    truth.innerHTML = '<b>Synthetic truth:</b> A realized occupancy ' + a.occupied + '/24 (' + fmt(a.realizedOccupancy) +
      '); B ' + b.occupied + '/24 (' + fmt(b.realizedOccupancy) + '). Generating values: A ψ=0.8, p=0.25; B ψ=0.5, p=0.8. ' +
      'Expected fraction detected after ' + rounds + ' visit' + (rounds > 1 ? 's' : '') + ': A ' +
      fmt(M.expectedForHabitat('A', rounds)) + ', B ' + fmt(M.expectedForHabitat('B', rounds)) + '. Observed: A ' +
      fmt(a.observedFraction) + ', B ' + fmt(b.observedFraction) + '.';
    renderAll();
  });

  /* Prediction-capture toggle groups: A2's "where the activity can capture the
     prediction it must". One delegated handler serves all four stages. */
  document.addEventListener('click', event => {
    const button = event.target.closest && event.target.closest('.predict-capture [data-predict]');
    if (!button) return;
    const group = button.closest('.predict-capture');
    const key = group.id.replace('predict-', '');
    predictions[key] = button.dataset.predict;
    $$('[data-predict]', group).forEach(candidate => candidate.setAttribute('aria-pressed', String(candidate === button)));
    updateEcho(key);
  });

  /* Site inspection: a per-item popover mechanism (A3), distinct from the
     shell's per-stage #details drawer (A5) — see ADOPTING.md sec.5. Kept as a
     lightweight selection-and-recap in the ledger's own .site-detail line,
     matching the pre-retrofit demo's behaviour, rather than opening the
     #item-details dialog for a one-line fact; the dialog remains available
     (and is cleared by Reset) for parity with the fleet pattern but is not
     required for this small a fact. */
  document.addEventListener('click', event => {
    const button = event.target.closest && event.target.closest('.site');
    if (!button) return;
    selection = button.dataset.site;
    renderLedgers();
  });

  ['inferenceHabitat', 'psiSelect', 'pSelect'].forEach(id => $('#' + id).addEventListener('change', renderInference));

  document.addEventListener('stagechange', () => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  });

  /* ---- demo-owned scenario controls, in Settings AFTER the contract triad.
     These are NOT the shell's Reset: they replay or reseed the scenario
     without pretending to run the shell's own chrome restoration (dialogs,
     A6 check cards). Only the shell's #reset-btn does that full contract. */
  function scenarioReset(newSeed) {
    if (newSeed) { seed = (seed + 7919) >>> 0; scenario = M.createScenario(seed); }
    rounds = 0; selection = null; interpreted = false; revealed = false; round1Higher = null;
    predictions[1] = predictions[2] = predictions[3] = predictions[4] = null;
    const truth = $('#truthPanel');
    truth.hidden = true; truth.innerHTML = '';
    $('#transferFeedback').textContent = 'Choose a response after you have inspected the evidence.';
    ['cue-1', 'cue-2', 'cue-3', 'cue-4'].forEach(id => { const cue = $('#' + id); if (cue) cue.textContent = ''; });
    $$('.predict-capture [data-predict]').forEach(button => button.setAttribute('aria-pressed', 'false'));
    $('#inferenceHabitat').value = 'A'; $('#psiSelect').value = '0.5'; $('#pSelect').value = '0.5';
    $('#inferenceView').open = false;
    window.lessonShell.selectStage(0);
    renderAll();
  }
  $('#replay-btn').addEventListener('click', () => scenarioReset(false));
  $('#new-seed-btn').addEventListener('click', () => scenarioReset(true));

  /* ============================ reset, in place ============================
     Kit v2. The shell has already restored everything it owns before this
     fires: stage 1 selected (and the gate re-locked FROM THE TEMPLATE'S
     `disabled` attributes, not from any state here), every dialog closed
     (including #item-details), the four .obs-cue lines and .echo spans back
     to their first-load (empty/hidden) content, the check cards cleared, the
     Details drawer back to stage 1, and the page scrolled to the top.

     THE ENUMERATION — everything this handler alone is responsible for:
       seed, scenario           back to INITIAL_SEED / its scenario
       rounds, selection, interpreted, revealed, round1Higher   plain values
       predictions{1..4}        cleared (the .echo restore above only clears
                                 the DOM; this clears the state that would
                                 otherwise re-populate it on the next render)
       #truthPanel              hidden and emptied (shell does not know this
                                 element exists)
       #transferFeedback        NOT a .obs-cue or inside a .check card, so the
                                 shell's restore does not reach it — reset here
       #inferenceHabitat/#psiSelect/#pSelect/#inferenceView   back to their
                                 template values and closed
       #item-details-title/body  cleared, so nothing stale is one click away
       the three ledger slots and the Interpret recap   rebuilt by renderAll()
         from the now-reset state, which also re-derives tab-2/3/4 disabled
         (redundant with the shell's own snapshot restore, and deliberately
         so: two independent paths land on the same locked state). */
  document.addEventListener('lessonreset', () => {
    seed = INITIAL_SEED;
    scenario = M.createScenario(seed);
    rounds = 0; selection = null; interpreted = false; revealed = false; round1Higher = null;
    predictions[1] = predictions[2] = predictions[3] = predictions[4] = null;
    const truth = $('#truthPanel');
    truth.hidden = true; truth.innerHTML = '';
    $('#transferFeedback').textContent = 'Choose a response after you have inspected the evidence.';
    $$('.predict-capture [data-predict]').forEach(button => button.setAttribute('aria-pressed', 'false'));
    $('#inferenceHabitat').value = 'A'; $('#psiSelect').value = '0.5'; $('#pSelect').value = '0.5';
    $('#inferenceView').open = false;
    $('#item-details-title').textContent = 'Site detail';
    $('#item-details-body').innerHTML = '';
    renderAll();
  });
  /* Nothing to veto: every piece of activity state can be rewound in place. */
  window.lessonShell.onReset = null;

  renderAll();
})();
