/* Gaps in the Rock Record — view layer.
   Reads MissingTimeModel (src/model.js, unchanged); reacts to the shell's
   `stagechange` and `lessonreset` events; owns nothing the shell already
   owns (dialogs, stage tabs, presentation mode, the .check cards).

   ONE SHARED INSTRUMENT, THREE HOSTS. The three stages are three cases from
   MissingTimeModel.CASES and they share one investigation mechanism: sample a
   surviving layer, reveal supplied chronology, watch the linked rock/time
   views and the evidence ledger, choose a warranted conclusion, reveal the
   authored history. Rather than tripling that markup and its render code
   per stage (ADOPTING.md's boundary sentence cuts the other way here — this
   is the demo's OWN activity, and the three cases are the same mechanism
   with different data, exactly the shape ion-flight's shared #activity
   element handles by moving between stage hosts), #investigation is built
   ONCE and moved into whichever stage's empty host div is active. Progress
   (samples, revealed chronology, a chosen conclusion) is kept PER CASE in
   `byCase`, independent of which stage is currently showing, so switching
   tabs is ordinary navigation and does not discard evidence — only Settings
   -> Reset does that. What stays genuinely per-stage, and is therefore NOT
   moved: the stage-intro's Predict guess buttons/echo, and the Check
   Yourself card (both authored once per stage, never rebuilt).
*/
(() => {
  'use strict';
  const M = MissingTimeModel;
  const byId = id => document.getElementById(id);
  const CASE_IDS = M.CASES.map(c => c.id);

  const SECTION_LABEL = ['Section A', 'Section B', 'Sections C and D'];
  const SECTION_LEDE = [
    'Left: surviving rock height above base in metres for Section A. Right: model time in Myr since start. Sample a layer to reveal specimen marks at their real surviving position.',
    'Left: surviving rock height above base in metres for Section B. Right: model time in Myr since start. Sample a layer to reveal specimen marks at their real surviving position.',
    'Left: surviving rock height above base in metres. Right: model time in Myr since start. Both sections share the same axes so a gap at one and continued rock at the other are directly comparable.'
  ];
  const DEFAULT_EVIDENCE_HINT = 'A local gap says that rock from an interval is absent here. It does not by itself say why, and an unsampled layer is not an observed fossil absence.';
  const CUT_BANK_EVIDENCE_HINT = 'To compare this local gap, show supplied age evidence, then sample Red siltstone below the contact and Cross-bedded sand above it. A gap alone does not identify its cause.';
  const DEFAULT_FEEDBACK = 'Collect evidence first. The authored history remains hidden until you choose to reveal it.';

  /* Verbatim from the pre-kit build: the three conclusion choices per case,
     in the original order (index 0 is always the warranted one). Case texts
     are preserved unchanged per the work order. */
  const LABELS = {
    'continuous-record': [
      'A local last observation in continuous sampled rock cannot establish global extinction.',
      'A local absence proves global extinction.',
      'Equal rock thickness means equal elapsed time.'
    ],
    'cut-bank': [
      'The local gap does not identify its cause or establish an extinction boundary.',
      'Every hiatus must have erosion.',
      'A fossil can be moved to the erosion boundary after its layer is removed.'
    ],
    'paired-sections': [
      'The second local section preserves an interval missing at the first.',
      'The first section’s blank proves a global fossil absence.',
      'Two sections certify global extinction.'
    ]
  };

  const GUESS_TEXT = { yes: n => n, no: n => n }; // labels come from the button itself

  /* ---- per-case progress, independent of which stage is showing --------- */
  function freshCaseState() {
    return { actions: [], feedback: DEFAULT_FEEDBACK, concluded: false, revealed: false, cue: '' };
  }
  let byCase = {};
  CASE_IDS.forEach(id => { byCase[id] = freshCaseState(); });

  /* guesses[stageIndex] = { value: 'yes'|'no', label: button text } | null */
  let guesses = [null, null, null];

  let currentStageIndex = 0;

  /* ---- pure helpers over the model, no side effects ---------------------- */
  function current(caseId) { return M.compiledCase(caseId); }

  function act(caseId, value) {
    const list = byCase[caseId].actions;
    if (!list.includes(value)) list.push(value);
  }

  /* ======================= building #investigation ======================= */
  function buildInvestigation() {
    const el = document.createElement('div');
    el.className = 'mt-investigation';
    el.id = 'investigation';
    el.innerHTML =
      '<section class="workbench" aria-labelledby="act-heading">' +
        '<div class="panel-head"><div>' +
          '<span class="panel-kicker"><span class="k-live">Live</span> positions, gaps and evidence status, computed here from the ledger as you act</span>' +
          '<h3 id="act-heading">Inspect <span id="section-label"></span></h3>' +
        '</div></div>' +
        '<p class="panel-lede" id="section-lede"></p>' +
        '<div class="mt-columns" id="columns"></div>' +
        '<label class="control-label" for="showGapsButton">Show supplied age evidence' +
          '<span class="why">Reveals this case’s synthetic chronology anchors — the only source of an exact Myr value anywhere in this activity.</span></label>' +
        '<button class="btn ghost small" type="button" id="showGapsButton">Show supplied age evidence</button>' +
        '<div class="mt-timebox" id="timeEvidence" hidden aria-live="polite"></div>' +
        '<p class="note" id="evidenceHint"></p>' +
        '<p class="obs-cue" id="cue-core" role="status" aria-live="polite"></p>' +
      '</section>' +
      '<section class="card" aria-labelledby="ledger-heading">' +
        '<span class="panel-kicker"><span class="k-live">Live</span> stays visible as you act; nothing here changes the authored rock history</span>' +
        '<h3 id="ledger-heading">Evidence ledger</h3>' +
        '<p id="ledgerIntro">No samples or chronology evidence recorded yet.</p>' +
        '<ul class="mt-ledger-list" id="ledgerList"><li class="mt-ledger-empty">Evidence will stay visible here as you act.</li></ul>' +
      '</section>' +
      '<section class="card" aria-labelledby="conclude-heading">' +
        '<span class="panel-kicker"><span class="k-scripted">Scripted</span> hand-authored case history — fixed teaching fixture, no model runs here</span>' +
        '<h3 id="conclude-heading">Choose a warranted conclusion</h3>' +
        '<p>Choose the claim that follows from the evidence currently visible. This is feedback on the claim, not a mastery score.</p>' +
        '<div class="mt-conclusions" id="conclusions"></div>' +
        '<div class="mt-conclusion-feedback" id="conclusionFeedback" aria-live="polite">' + DEFAULT_FEEDBACK + '</div>' +
        '<button class="btn ghost small" type="button" id="revealButton" hidden>Reveal this authored history</button>' +
        '<div class="mt-timebox" id="revealBox" hidden></div>' +
      '</section>';
    el.addEventListener('click', onInvestigationClick);
    return el;
  }
  const investigationEl = buildInvestigation();

  function moveActivityTo(stageIndex) {
    const host = byId('investigation-host-' + (stageIndex + 1));
    if (host && investigationEl.parentElement !== host) host.appendChild(investigationEl);
  }

  /* ======================= rendering one case ============================= */
  function renderColumns(caseId) {
    const data = current(caseId);
    const H = 210, B = 220, T = 10;
    const fill = ['#b8dbe9', '#fff1bd', '#f5d4c8'];
    const actions = byCase[caseId].actions;
    const svg = (section, kind) => {
      const ready = actions.includes('chronology:' + section.id);
      if (kind === 'time' && !ready) {
        return '<svg viewBox="0 0 170 240" role="img" aria-label="' + section.label + ' model time awaiting supplied chronology">' +
          '<line x1="28" y1="' + T + '" x2="28" y2="' + B + '" stroke="#7897aa" stroke-dasharray="4 3"/>' +
          '<text x="40" y="104" font-size="10" fill="#50687b">Chronology not</text>' +
          '<text x="40" y="120" font-size="10" fill="#50687b">yet supplied</text>' +
          '<text x="40" y="143" font-size="8" fill="#50687b">Show supplied age</text>' +
          '<text x="40" y="155" font-size="8" fill="#50687b">evidence to scale time</text></svg>';
      }
      const total = kind === 'rock' ? section.thicknessM : section.elapsedMyr;
      const y = value => B - value / total * H;
      const interval = layer => kind === 'rock'
        ? { lo: layer.baseM, hi: layer.baseM + layer.survivingThicknessM }
        : { lo: layer.startMyr, hi: layer.startMyr + layer.survivingThicknessM / layer.rateMPerMyr };
      let marks = '<line x1="28" y1="' + T + '" x2="28" y2="' + B + '" stroke="#002144"/>' +
        '<text x="2" y="' + (B + 10) + '" font-size="8" fill="#38566e">0</text>' +
        '<text x="1" y="' + (T + 8) + '" font-size="8" fill="#38566e">' + total.toFixed(1) + '</text>';
      section.layers.forEach((layer, index) => {
        const r = interval(layer), top = y(r.hi), height = Math.max(2, y(r.lo) - top);
        marks += '<rect x="38" y="' + top.toFixed(2) + '" width="72" height="' + height.toFixed(2) + '" fill="' + fill[index % fill.length] + '" stroke="#456176"/>' +
          '<text x="114" y="' + (top + Math.min(12, height / 2)).toFixed(2) + '" font-size="8" fill="#243a4b">' +
          (layer.label === 'Cross-bedded sand' ? 'Cross-bed' : layer.label.split(' ')[0]) + '</text>';
        if (actions.includes('sample:' + section.id + ':' + layer.id)) {
          layer.fossils.forEach(f => {
            const value = kind === 'rock' ? layer.baseM + f.depthFromBaseM : f.timeMyr;
            marks += '<circle cx="74" cy="' + y(value).toFixed(2) + '" r="4" fill="#002144" stroke="#ecac00" stroke-width="2"/>';
          });
        }
      });
      if (kind === 'rock' && ready) {
        section.gaps.forEach(g => {
          marks += '<line x1="34" y1="' + y(g.depthM).toFixed(2) + '" x2="114" y2="' + y(g.depthM).toFixed(2) + '" stroke="#9a6700" stroke-width="3"/>' +
            '<text x="116" y="' + (y(g.depthM) + 3).toFixed(2) + '" font-size="10" fill="#805b00">contact</text>';
        });
      }
      if (kind === 'time') {
        section.gaps.forEach(g => {
          const top = y(g.toMyr), height = y(g.fromMyr) - top;
          marks += '<rect x="38" y="' + top.toFixed(2) + '" width="72" height="' + height.toFixed(2) + '" fill="#fff1bd" stroke="#9a6700" stroke-dasharray="4 3"/>' +
            '<text x="114" y="' + (top + height / 2).toFixed(2) + '" font-size="8" fill="#8c2c00">' + g.durationMyr.toFixed(1) + ' gap</text>';
        });
        section.chronology.forEach(a => {
          marks += '<line x1="32" y1="' + y(a.modelMyr).toFixed(2) + '" x2="114" y2="' + y(a.modelMyr).toFixed(2) + '" stroke="#ecac00" stroke-width="2"/>' +
            '<text x="116" y="' + (y(a.modelMyr) + 3).toFixed(2) + '" font-size="8" fill="#805b00">' + a.modelMyr.toFixed(1) + '</text>';
        });
      }
      return '<svg viewBox="0 0 170 240" role="img" aria-label="' + section.label + ' ' +
        (kind === 'rock' ? 'surviving rock height above base in metres' : 'model time in Myr since start') + '">' + marks + '</svg>';
    };
    byId('columns').innerHTML = data.sections.map(section =>
      '<article class="mt-column"><h4>' + section.label + '</h4>' +
      '<div class="mt-linked">' +
        '<figure><figcaption>surviving rock &middot; m</figcaption>' + svg(section, 'rock') + '</figure>' +
        '<figure><figcaption>model time &middot; Myr</figcaption>' + svg(section, 'time') + '</figure>' +
      '</div>' +
      '<div class="mt-sample-row">' + section.layers.map(layer =>
        '<button class="mt-sample" type="button" data-sample="' + section.id + ':' + layer.id + '" aria-pressed="' +
        (actions.includes('sample:' + section.id + ':' + layer.id) ? 'true' : 'false') + '" aria-label="Sample ' + section.label + ' ' + layer.label + '">sample ' + layer.label + '</button>'
      ).join('') + '</div></article>'
    ).join('');
  }

  function renderEvidenceHint(caseId) {
    byId('evidenceHint').textContent = caseId === 'cut-bank' ? CUT_BANK_EVIDENCE_HINT : DEFAULT_EVIDENCE_HINT;
  }

  /* Pure: builds the "supplied age evidence" HTML from whatever chronology has
     already been revealed for this case (does not itself reveal anything or
     mutate actions), so it can be called on every renderCase to keep
     #timeEvidence in sync with per-case progress when a stage is revisited. */
  function timeEvidenceHtml(caseId) {
    const data = current(caseId);
    const actions = byCase[caseId].actions;
    const items = data.sections
      .filter(section => actions.includes('chronology:' + section.id))
      .map(section => {
        const anchors = section.chronology.map(a => a.label + ' = ' + a.modelMyr.toFixed(2) + ' Myr').join('; ');
        const gaps = section.gaps.length
          ? section.gaps.map(gap => gap.durationMyr.toFixed(2) + ' Myr missing between ' + gap.fromMyr.toFixed(2) + ' and ' + gap.toMyr.toFixed(2) + ' Myr').join('; ')
          : 'no missing interval in this authored section';
        return '<strong>' + section.label + '</strong>: supplied anchors ' + anchors + '. Result: ' + gaps + '.';
      });
    return items.join('<hr>');
  }

  function renderLedger(caseId) {
    const actions = byCase[caseId].actions;
    const notes = actions.filter(v => v.startsWith('note:')).map(v => v.slice(5));
    const chronologies = actions.filter(v => v.startsWith('chronology:')).length;
    const entries = (chronologies ? ['Supplied age evidence displayed for ' + chronologies + ' section(s).'] : []).concat(notes.map(note => 'Sample — ' + note));
    byId('ledgerIntro').textContent = entries.length
      ? 'Visible evidence stays here while you compare the linked rock and time views.'
      : 'No samples or age evidence recorded yet.';
    byId('ledgerList').innerHTML = entries.length
      ? entries.map(note => '<li>' + note + '</li>').join('')
      : '<li class="mt-ledger-empty">Evidence will stay visible here as you act.</li>';
  }

  function renderConclusions(caseId) {
    byId('conclusions').innerHTML = LABELS[caseId].map((label, index) =>
      '<button class="mt-choice" type="button" data-conclusion="' + index + '">' + label + '</button>'
    ).join('');
  }

  function updateEcho(stageIndex, caseId) {
    const echo = byId('echo-' + (stageIndex + 1));
    if (!echo || !guesses[stageIndex]) return;
    echo.hidden = false;
    const status = M.evidenceStatus(caseId, byCase[caseId].actions);
    echo.innerHTML = 'You guessed: <b>' + guesses[stageIndex].label + '</b>. ' +
      (status.kind === 'ready' ? 'Visible evidence: ' + status.text : 'Still gathering — ' + status.text);
  }

  /* NOTE ON ORDERING: renderCase() deliberately does NOT call updateEcho().
     The shell's own selectStage(0) — part of its Reset sequence — fires
     `stagechange` BEFORE `lessonreset` (see index.js's resetLesson: step 7
     precedes step 9), and this app's `stagechange` listener calls
     renderCase() for whichever stage that lands on. At that moment `guesses`
     still holds its PRE-reset values (this handler's own lessonreset clears
     them, but that has not fired yet) — so if renderCase() called
     updateEcho() here, a Reset would re-populate the very .echo element the
     shell just correctly hid via its first-load snapshot. Calling
     updateEcho() only from the four interaction handlers below, never from
     renderCase()/stagechange, means nothing re-touches .echo except an
     actual user action, so it cannot resurrect stale content mid-reset.
     Found and fixed during the browser pass — see ADOPTING.md's warning that
     an in-place reset is correct only if the enumeration is complete. */
  function renderCase(stageIndex) {
    const caseId = CASE_IDS[stageIndex];
    const cs = byCase[caseId];
    byId('section-label').textContent = SECTION_LABEL[stageIndex];
    byId('section-lede').textContent = SECTION_LEDE[stageIndex];
    renderColumns(caseId);
    renderEvidenceHint(caseId);
    renderLedger(caseId);
    renderConclusions(caseId);
    const teHtml = timeEvidenceHtml(caseId);
    byId('timeEvidence').hidden = !teHtml;
    byId('timeEvidence').innerHTML = teHtml;
    byId('conclusionFeedback').textContent = cs.feedback;
    byId('revealButton').hidden = !cs.concluded;
    byId('revealBox').hidden = !cs.revealed;
    if (cs.revealed) byId('revealBox').textContent = M.getCase(caseId).reveal;
    const cue = byId('cue-core');
    cue.textContent = cs.cue;
    cue.className = 'obs-cue';
  }

  /* ======================= interaction handlers ============================ */
  function onSample(caseId, stageIndex, sectionId, layerId) {
    const result = M.sampleLayer(caseId, sectionId, layerId);
    act(caseId, 'sample:' + sectionId + ':' + layerId);
    const names = result.specimens.length
      ? result.specimens.map(s => s.species + ' at ' + s.depthM.toFixed(2) + ' m above base').join('; ')
      : 'No specimens observed in this sampled surviving layer.';
    act(caseId, 'note:' + sectionId + ':' + layerId + ':' + result.label + ' — ' + names);
    byCase[caseId].cue = result.label + ': ' + names;
    renderCase(stageIndex);
    updateEcho(stageIndex, caseId);
  }

  function onShowGaps(caseId, stageIndex) {
    const data = current(caseId);
    data.sections.forEach(section => {
      act(caseId, 'chronology:' + section.id);
      section.gaps.forEach(gap => act(caseId, 'gap:' + gap.id));
    });
    const totalGapMyr = data.sections.reduce((sum, s) => sum + s.gaps.reduce((a, g) => a + g.durationMyr, 0), 0);
    byCase[caseId].cue = totalGapMyr > 0
      ? 'Supplied age evidence revealed — ' + totalGapMyr.toFixed(2) + ' Myr missing in total. See the evidence panel above.'
      : 'Supplied age evidence revealed — no missing interval in this authored section.';
    renderCase(stageIndex);
    updateEcho(stageIndex, caseId);
  }

  function onChoose(caseId, stageIndex, conclusionIndex) {
    const status = M.evidenceStatus(caseId, byCase[caseId].actions);
    if (status.kind !== 'ready') {
      byCase[caseId].feedback = status.text;
      renderCase(stageIndex);
      updateEcho(stageIndex, caseId);
      return;
    }
    const good = conclusionIndex === 0;
    byCase[caseId].feedback = good
      ? 'Supported by the visible evidence: ' + status.text
      : 'That claim reaches beyond the visible evidence. ' + status.text;
    byCase[caseId].concluded = true;
    renderCase(stageIndex);
    updateEcho(stageIndex, caseId);
  }

  function onReveal(caseId, stageIndex) {
    byCase[caseId].revealed = true;
    renderCase(stageIndex);
  }

  function onInvestigationClick(e) {
    const caseId = CASE_IDS[currentStageIndex];
    const sampleBtn = e.target.closest('.mt-sample');
    if (sampleBtn) {
      const [sectionId, layerId] = sampleBtn.dataset.sample.split(':');
      onSample(caseId, currentStageIndex, sectionId, layerId);
      return;
    }
    if (e.target.closest('#showGapsButton')) { onShowGaps(caseId, currentStageIndex); return; }
    const choiceBtn = e.target.closest('.mt-choice');
    if (choiceBtn) { onChoose(caseId, currentStageIndex, Number(choiceBtn.dataset.conclusion)); return; }
    if (e.target.closest('#revealButton')) { onReveal(caseId, currentStageIndex); return; }
  }

  /* ---- the Predict guess buttons, one pair per stage, static (never moved) */
  document.querySelectorAll('.mt-guess').forEach(btn => {
    btn.addEventListener('click', () => {
      const stageIndex = Number(btn.dataset.stage);
      const group = btn.closest('.mt-predict-btns');
      group.querySelectorAll('.mt-guess').forEach(b => { b.setAttribute('aria-pressed', String(b === btn)); b.disabled = true; });
      guesses[stageIndex] = { value: btn.dataset.guess, label: btn.textContent.trim() };
      if (stageIndex === currentStageIndex) updateEcho(stageIndex, CASE_IDS[stageIndex]);
    });
  });

  /* ======================= stage wiring ===================================== */
  document.addEventListener('stagechange', e => {
    const i = e.detail.index;
    if (i < 0 || i >= CASE_IDS.length) return;
    currentStageIndex = i;
    moveActivityTo(i);
    renderCase(i);
  });

  function initialStageIndex() {
    const tabs = Array.from(document.querySelectorAll('.stage-tab'));
    const i = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
    return i > -1 ? i : 0;
  }

  /* ===========================================================================
     RESET. Kit v2: the shell restores its own chrome (stage 1, the cleared
     check cards, the closed dialogs, and the .echo / .obs-cue lines back to
     their empty first-load content) and then dispatches `lessonreset`.
     Everything below is the half the shell cannot know about.

     THE ENUMERATION:
       1. byCase[*] — every case's actions list, feedback text, concluded
          flag and revealed flag, all back to freshCaseState().
       2. guesses[0..2] — back to null, and the six .mt-guess buttons
          re-enabled with aria-pressed cleared (the shell has no idea these
          exist; they are not .echo or .obs-cue elements).
       3. currentStageIndex — back to 0, and #investigation moved back to
          stage 1's host and re-rendered from the now-fresh case 0 state.
     #cue-core and every #echo-N are .obs-cue / .echo, so the shell already
     restored their DOM text to empty; they are listed here only so the next
     reader does not go looking for a second reset of them. ========================================================================= */
  document.addEventListener('lessonreset', () => {
    CASE_IDS.forEach(id => { byCase[id] = freshCaseState(); });
    guesses = [null, null, null];
    document.querySelectorAll('.mt-guess').forEach(b => { b.disabled = false; b.setAttribute('aria-pressed', 'false'); });
    currentStageIndex = 0;
    moveActivityTo(0);
    renderCase(0);
  });

  /* The veto hook stays available and stays unused: this demo has nothing to
     refuse a reset for. Left as null deliberately — with the handler
     above, the contract is met. */
  window.lessonShell.onReset = null;

  /* ---- start-up ------------------------------------------------------------
     The shell has already run and may have selected a stage from a #stage-N
     hash, but only dispatches 'stagechange' when it does so — a plain
     fresh load never fires it. So the first paint reads whichever tab the
     shell settled on rather than assuming stage 1. */
  currentStageIndex = initialStageIndex();
  moveActivityTo(currentStageIndex);
  renderCase(currentStageIndex);
})();
