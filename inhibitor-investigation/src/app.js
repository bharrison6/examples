/* Inhibitor Investigation — the view layer (template part A3's activity).
   Loads after the shared lesson shell, so window.lessonShell already exists.
   The tested production model (model.js) is injected immediately before this
   script at the /* INHIBITOR_MODEL *\/ marker and exposes window.InhibitorModel;
   see model.js and test-model.js for the mechanism this file only renders.

   THE SHELL OWNS: the stage tablist, the four dialogs, presentation mode, and
   the three A6 check cards (aria-pressed + per-option feedback from
   data-feedback — nothing here wires those). This file owns everything inside
   the three .stage panels: the bench, the chart, the evidence ledger, the
   explain-before-reveal panel, and the transfer panel — plus the REQUIRED
   'lessonreset' handler, because the shell cannot know what this activity
   holds (ADOPTING.md section 4). */
(() => {
  'use strict';
  const M = window.InhibitorModel;
  const el = id => document.getElementById(id);
  const CONCENTRATIONS = [0, 1, 2, 4, 8, 20];
  const COLORS = { competitive: '#00a4e3', uncompetitive: '#7454b8', 'pure-noncompetitive': '#ecac00' };

  /* Captured from the markup before anything mutates it, so lessonreset
     restores the literal first-load copy without a second hard-coded string
     to drift from — the same pattern the pre-kit page used for Reset. These
     three are NOT .obs-cue/.echo, so the shell's own reset snapshot does not
     cover them; this handler is the only place they come back. */
  const FIRST_LOAD = Object.freeze({
    bench: el('bench-status').textContent,
    explanation: el('explanation-feedback').textContent,
    transfer: el('transfer-feedback').textContent
  });

  let selected = 2;
  let caseNumber = 0;
  let state = M.createCase(caseNumber);

  /* ---- Stage 1: Bench ----------------------------------------------------- */
  const choicesHost = el('concentration-choices');
  CONCENTRATIONS.forEach(value => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice';
    button.textContent = 'S = ' + value;
    button.addEventListener('click', () => { selected = value; renderChoices(); });
    choicesHost.append(button);
  });

  function renderChoices() {
    [...choicesHost.children].forEach((button, index) => {
      button.classList.toggle('selected', CONCENTRATIONS[index] === selected);
    });
  }

  function linePath(points, x, y) {
    return points.map((p, i) => (i ? 'L' : 'M') + x(p.substrate).toFixed(2) + ' ' + y(p.rate).toFixed(2)).join(' ');
  }

  function renderChart() {
    const svg = el('chart');
    const w = 700, h = 330, left = 56, right = 18, top = 16, bottom = 42;
    const x = s => left + s / 20 * (w - left - right);
    const y = r => h - bottom - r / 100 * (h - top - bottom);
    let markup = '<rect width="700" height="330" fill="#01182C"/><g stroke="#3a5068" stroke-width="1">';
    [0, 25, 50, 75, 100].forEach(v => {
      markup += '<line x1="' + left + '" x2="' + (w - right) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
        '<text x="' + (left - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" fill="#B8CBD8" font-size="12">' + v + '</text>';
    });
    [0, 2, 4, 8, 12, 16, 20].forEach(v => {
      markup += '<line x1="' + x(v) + '" x2="' + x(v) + '" y1="' + top + '" y2="' + (h - bottom) + '"/>' +
        '<text x="' + x(v) + '" y="' + (h - bottom + 19) + '" text-anchor="middle" fill="#B8CBD8" font-size="12">' + v + '</text>';
    });
    markup += '</g><g fill="#B8CBD8" font-size="12">' +
      '<text x="350" y="325" text-anchor="middle">Substrate (teaching units)</text>' +
      '<text transform="translate(15 170) rotate(-90)" text-anchor="middle">Initial rate (units)</text></g>';
    const baseline = CONCENTRATIONS.map(substrate => ({ substrate, rate: M.baselineRate(substrate) }));
    markup += '<path d="' + linePath(baseline, x, y) + '" fill="none" stroke="#8296a6" stroke-width="3" stroke-dasharray="8 6"/>';
    M.HYPOTHESES.forEach(item => {
      markup += '<path d="' + linePath(M.curvePoints(item.id, 20, 60), x, y) + '" fill="none" stroke="' + COLORS[item.id] + '" stroke-width="3"/>';
    });
    state.assays.forEach(item => {
      markup += '<circle cx="' + x(item.substrate) + '" cy="' + y(item.rate) + '" r="6" fill="#fff" stroke="#002144" stroke-width="2"/>';
    });
    svg.innerHTML = markup;
  }

  function renderEvidence() {
    const status = M.evidenceStatus(state.assays);
    el('evidence-text').textContent = status.text;
    const list = el('assay-list');
    list.innerHTML = state.assays.length
      ? state.assays.map(item => '<li>S = ' + item.substrate + ' &rarr; observed initial rate = <strong>' + M.formatRate(item.rate) + '</strong></li>').join('')
      : '<li class="empty">No assays recorded.</li>';
    el('budget-text').textContent = state.assays.length + ' / ' + state.budget;
    el('budget-meter').style.width = (state.assays.length / state.budget * 100) + '%';
    el('run-button').disabled = state.assays.length >= state.budget;
  }

  function renderBench() { renderChoices(); renderChart(); renderEvidence(); }

  el('run-button').addEventListener('click', () => {
    const result = M.runAssay(state, selected);
    state = result.state;
    if (result.kind === 'recorded') {
      el('explanation-feedback').textContent = 'Evidence changed. Submit a new explanation before reveal.';
      el('cue-1').textContent = 'Recorded exact rate: ' + M.formatRate(result.assay.rate) + ' at S = ' + result.assay.substrate + '. Compare it with all three curves.';
      el('bench-status').textContent = 'Recorded exact rate: ' + M.formatRate(result.assay.rate) + '. Compare it with all three curves.';
    } else {
      el('bench-status').textContent = result.message;
      /* A budget or duplicate response is still worth a cue: it names what
         just happened, which is the A4 contract, even when nothing new was
         recorded. */
      el('cue-1').textContent = result.message;
    }
    renderBench();
  });

  /* "New mystery sample" (preserved from the pre-kit page): starts a fresh
     hidden pattern without a full Reset, leaving the Explain/Transfer stages'
     copy at whatever the class left it, mirroring the original demo's
     behaviour. Settings -> Reset (lessonreset, below) goes further and also
     restores the first-load explanation/transfer copy. */
  function freshSample(benchText, explanationText) {
    caseNumber += 1;
    state = M.createCase(caseNumber);
    selected = 2;
    el('bench-status').textContent = benchText;
    el('explanation-feedback').textContent = explanationText;
    el('cue-1').textContent = '';
    renderBench();
  }
  el('new-sample-button').addEventListener('click', () => freshSample(
    'Fresh mystery sample ready. Choose a concentration and collect new evidence.',
    'Fresh case: submit an explanation after you collect evidence.'
  ));

  /* ---- Stage 2: Explain before reveal --------------------------------------
     The mystery pattern's name is withheld from explanationFeedback until one
     of these buttons is pressed — the within-stage content gate this stage
     exists to teach (see ADOPTING.md's stagechange note: there is no locked
     TAB here, only content that starts hidden). */
  document.querySelectorAll('#explanation-options [data-choice]').forEach(button => {
    button.addEventListener('click', () => {
      const status = M.evidenceStatus(state.assays);
      const sound = M.explanationIsSound(state.assays, button.dataset.choice);
      const truth = M.hypothesis(state.hiddenId);
      let message = sound
        ? 'Your explanation follows from the direct rate evidence. '
        : 'That explanation does not follow from the direct rate evidence. ';
      if (!state.assays.length) {
        message += 'Run an assay first; no candidate has been tested.';
      } else if (status.kind === 'ambiguous') {
        message += 'The unresolved candidates are ' + status.compatible.map(item => item.label).join(' and ') +
          '. The mystery pattern is revealed as ' + truth.label + '.';
      } else {
        message += 'The isolated synthetic pattern is ' + status.compatible[0].label +
          '. The mystery pattern is revealed as ' + truth.label + '.';
      }
      message += ' This is an ideal initial-rate pattern, not evidence for a unique real binding mechanism.';
      el('explanation-feedback').textContent = message;
      el('cue-2').textContent = 'Current evidence status: ' + status.kind + ' (' + status.compatible.length + ' candidate' + (status.compatible.length === 1 ? '' : 's') + ' still compatible).';
    });
  });

  /* ---- Stage 3: Transfer ---------------------------------------------------- */
  document.querySelectorAll('#transfer-options [data-transfer]').forEach(button => {
    button.addEventListener('click', () => {
      const result = M.transferFeedback(Number(button.dataset.transfer));
      el('transfer-feedback').textContent = result.text;
      el('cue-3').textContent = 'This measurement eliminates ' + result.eliminated + ' of 2 remaining candidates.';
    });
  });

  /* ---- Reset, in place ------------------------------------------------------
     Kit v2: the shell restores its own chrome (stage 1, the check cards, the
     closed dialogs, and the .obs-cue lines — cue-1/2/3 are all .obs-cue, so
     they come back to their empty first-load content from the shell's own
     snapshot without help here) and then dispatches 'lessonreset'. Everything
     below is the half the shell cannot know about.

     THE ENUMERATION, written out rather than summarised:
       1. selected / caseNumber / state — the model's own RESET path is
          re-entered via createCase(0), the same call the page makes on load,
          so there is exactly one definition of "fresh" rather than two.
       2. #bench-status, #explanation-feedback, #transfer-feedback — none of
          these are .obs-cue or .echo, so the shell's snapshot does not reach
          them; FIRST_LOAD (captured above, before any click) is the only
          source of truth for their first-load text.
       3. Everything renderBench() drives from state: the concentration grid's
          .selected class, the chart, the evidence ledger, the budget meter
          and text, and the Run button's disabled state.
     There is no shared DOM node moved between stages here (unlike ion-flight),
     because each of the three stages owns its own static markup — so there is
     no "which host is it parked in" case to restore. */
  document.addEventListener('lessonreset', () => {
    caseNumber = 0;
    state = M.createCase(caseNumber);
    selected = 2;
    el('bench-status').textContent = FIRST_LOAD.bench;
    el('explanation-feedback').textContent = FIRST_LOAD.explanation;
    el('transfer-feedback').textContent = FIRST_LOAD.transfer;
    renderBench();
  });

  /* The veto hook stays available and stays unused: this demo has nothing to
     refuse a reset for — every piece of state is a plain in-memory value with
     no teardown of its own. Left as null deliberately, not by omission — with
     the handler above, the contract is met. */
  window.lessonShell.onReset = null;

  renderBench();
})();
