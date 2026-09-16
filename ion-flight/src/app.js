/* Ion Flight — the view layer. All physics and lesson state live in model.js.
   Bundled into index.html by build.js; the lesson shell's own behaviour
   (dialogs, stage tablist keyboard, presentation mode, check cards) is
   injected separately from tools/lesson-shell.

   PRESERVED FROM THE 2026-09-08/09-10 BUILD, and load-bearing:
     * the run clock starts on the FIRST ANIMATION FRAME, not at click time
       (the 2026-09-10 rAF fix — see runCurrentExperiment);
     * the prediction list locks while a run is in flight and once evidence
       exists;
     * runToken + cancelAnimationFrame cancel a run that is superseded;
     * the detector trace is the SUM of the packet signals, not two curves;
     * Run reveals the instrument before timing begins.
*/
(() => {
  'use strict';

  const M = IonFlightModel;
  const byId = id => document.getElementById(id);
  const flightCanvas = byId('flight-canvas');
  const traceCanvas = byId('trace-canvas');
  const flightContext = flightCanvas.getContext('2d');
  const traceContext = traceCanvas.getContext('2d');
  const runtime = {
    phase: 'ready',
    startMs: 0,
    elapsedS: 0,
    frameId: 0,
    runToken: 0,
    advancedMode: 'absolute'
  };
  let lessonState = M.initialLessonState();

  /* The instrument is one element shared by stages 1–3; these are the three
     slots it moves between. See the template's note on why it is not copied. */
  /* #activity is a wrapper INSIDE host 0, never the host itself: appending a
     host into itself throws HierarchyRequestError. */
  const activity = document.getElementById('activity');
  const hosts = Array.from(document.querySelectorAll('.activity-host'));

  function microseconds(seconds, digits) {
    return (seconds * 1e6).toFixed(digits === undefined ? 2 : digits) + ' µs';
  }

  function setupCanvas(canvas, height) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.height = height + 'px';
    return { width: rect.width, height, ratio };
  }

  function currentLesson() {
    return M.CORE_LESSONS[lessonState.stepIndex];
  }

  function currentPeaks() {
    return M.experimentPeaks(currentLesson().id);
  }

  function cancelRun(nextPhase) {
    runtime.runToken += 1;
    if (runtime.frameId) cancelAnimationFrame(runtime.frameId);
    runtime.frameId = 0;
    runtime.startMs = 0;
    runtime.elapsedS = 0;
    runtime.phase = nextPhase || 'ready';
  }

  /* ---- A4: the observation cue ------------------------------------------
     One line naming the thing to notice, at the moment it becomes true. It is
     the "Observe" half of predict-observe-explain, moved out of the lesson
     strip and into the instrument where the observation actually happens. */
  function setCue(text, warm) {
    const cue = byId('cue-core');
    cue.textContent = text || '';
    cue.classList.toggle('cue-warm', Boolean(warm));
  }

  /* ---- A2: echo the committed prediction beside the observed result ------
     The prediction is only worth capturing if the learner is shown it again
     next to what happened. The echo lives in the active stage's Predict card. */
  function renderEcho(lesson) {
    const stage = document.getElementById('stage-' + (lessonState.stepIndex + 1));
    const echo = stage && stage.querySelector('.lesson-strip .echo');
    if (!echo) return;
    const choice = lessonState.predictions[lesson.id];
    if (!Number.isInteger(choice)) { echo.hidden = true; echo.textContent = ''; return; }
    echo.hidden = false;
    if (!lessonState.completed[lesson.id]) {
      echo.innerHTML = 'You predicted: <b>' + lesson.choices[choice] + '</b>';
      return;
    }
    const result = M.detectorFinding(lesson.id, choice);
    echo.innerHTML = 'You predicted: <b>' + lesson.choices[choice] + '</b><br>' +
      'The detector: <b>' + (result.supported ? 'agreed' : 'disagreed') + '</b>';
  }

  /* ---- A1: the stage tablist -------------------------------------------
     The shell owns tab selection, keyboard and the hash; this syncs the two
     things only the demo knows — which stages the learner has unlocked, and
     which are complete — and moves the instrument into the active stage. */
  function syncStageTabs() {
    document.querySelectorAll('.stage-tab').forEach((tab, index) => {
      if (index >= M.CORE_LESSONS.length) return;   // stage 4 is never gated
      const unlocked = index <= lessonState.unlockedThrough;
      const complete = Boolean(lessonState.completed[M.CORE_LESSONS[index].id]);
      tab.disabled = !unlocked;
      tab.classList.toggle('complete', complete);
      const mark = tab.querySelector('.stage-mark');
      if (mark) mark.textContent = complete ? '✓' : String(index + 1);
      tab.title = unlocked ? '' : 'Run the detector on the previous stage to unlock this one';
    });
  }

  function moveActivityTo(stepIndex) {
    const host = hosts[stepIndex];
    if (host && activity.parentNode !== host) host.appendChild(activity);
  }

  function renderSamples(lesson) {
    byId('sample-list').innerHTML = lesson.packets.map(packet => {
      return '<article class="sample" style="--sample:' + packet.color + '">' +
        '<span class="sample-letter">' + packet.shortName + '</span>' +
        '<div><b>' + packet.name + '</b><span>Mass ' + packet.massDa +
        ' Da · charge +' + packet.charge + 'e (z = ' + packet.charge + ')</span></div></article>';
    }).join('');
  }

  function renderPredictions(lesson) {
    const selected = lessonState.predictions[lesson.id];
    const completed = Boolean(lessonState.completed[lesson.id]);
    byId('prediction-list').innerHTML = lesson.choices.map((choice, index) => {
      return '<button class="prediction ' + (selected === index ? 'selected' : '') +
        '" type="button" data-choice="' + index + '" aria-pressed="' + (selected === index) + '" ' +
        (completed || runtime.phase === 'running' ? 'disabled' : '') + '>' + choice + '</button>';
    }).join('');
    byId('prediction-list').querySelectorAll('[data-choice]').forEach(button => {
      button.addEventListener('click', () => {
        lessonState = M.reduceLessonState(lessonState, {
          type: 'SELECT_PREDICTION',
          choiceIndex: Number(button.dataset.choice)
        });
        renderCurrentStep();
      });
    });
  }

  function renderFinding(lesson) {
    const completed = Boolean(lessonState.completed[lesson.id]);
    const finding = byId('finding');
    finding.hidden = !completed;
    if (!completed) return;
    const result = M.detectorFinding(lesson.id, lessonState.predictions[lesson.id]);
    finding.classList.toggle('contradicted', !result.supported);
    byId('finding-verdict').textContent = result.verdict;
    byId('arrival-list').innerHTML = result.arrivals.map(arrival => {
      return '<div class="arrival-row"><b style="color:' + arrival.color + '">' +
        arrival.name + ' arrival</b><b>' + microseconds(arrival.timeS, 2) + '</b></div>';
    }).join('');
    byId('finding-explanation').textContent = result.explanation;
    if (lesson.id === 'ratio') {
      byId('finding-conclusion').textContent =
        'Observation: both packet centers arrive together and their peaks overlap. One peak does not establish one kind of ion.';
    } else {
      byId('finding-conclusion').textContent =
        'Observed separation between packet centers: ' + result.arrivalGapUs.toFixed(2) + ' µs.';
    }
    const nextButton = byId('next-button');
    if (lessonState.stepIndex < M.CORE_LESSONS.length - 1) {
      nextButton.hidden = false;
      nextButton.textContent = 'Continue to Investigation ' + (lesson.number + 1);
    } else {
      nextButton.hidden = true;
    }
  }

  function renderCurrentStep() {
    const lesson = currentLesson();
    const completed = Boolean(lessonState.completed[lesson.id]);
    if (runtime.phase !== 'running') runtime.phase = completed ? 'complete' : 'ready';
    moveActivityTo(lessonState.stepIndex);
    syncStageTabs();
    byId('step-kicker').innerHTML =
      '<span class="k-live">Live</span> Investigation ' + lesson.number + ' of 3 · computed here';
    byId('lesson-title').textContent = lesson.title;
    byId('lesson-purpose').textContent = lesson.purpose;
    byId('prediction-question').textContent = 'Predict · ' + lesson.question;
    renderSamples(lesson);
    renderPredictions(lesson);
    renderFinding(lesson);
    renderEcho(lesson);
    const hasPrediction = Number.isInteger(lessonState.predictions[lesson.id]);
    byId('run-button').disabled = !hasPrediction || runtime.phase === 'running';
    byId('run-button').textContent = hasPrediction ? (completed ? 'Run detector again' : 'Run detector') : 'Choose a prediction first';
    byId('replay-button').hidden = !completed;
    byId('run-hint').textContent = completed
      ? 'The trace and exact arrivals above are detector evidence from this simulated run.'
      : 'Arrival values and the trace stay hidden until you run the detector.';
    if (!completed && runtime.phase !== 'running') setCue('');
    drawCore();
  }

  function drawFlight(peaks, physicalTimeS) {
    const cssHeight = window.innerWidth <= 620 ? 250 : window.innerWidth <= 960 ? 285 : 330;
    const surface = setupCanvas(flightCanvas, cssHeight);
    const ctx = flightContext;
    ctx.setTransform(surface.ratio, 0, 0, surface.ratio, 0, 0);
    ctx.clearRect(0, 0, surface.width, surface.height);

    const sourceX = 30;
    const tubeStart = Math.max(102, surface.width * 0.16);
    const detectorX = surface.width - 52;
    const top = 91;
    const bottom = surface.height - 74;
    const tubeHeight = bottom - top;

    ctx.fillStyle = '#d8eef7';
    ctx.fillRect(tubeStart, top, detectorX - tubeStart, tubeHeight);
    ctx.strokeStyle = '#067aa9';
    ctx.lineWidth = 3;
    ctx.strokeRect(tubeStart, top, detectorX - tubeStart, tubeHeight);
    ctx.fillStyle = '#ecac00';
    ctx.fillRect(detectorX, top - 3, 14, tubeHeight + 6);
    ctx.fillStyle = '#002144';
    ctx.fillRect(tubeStart - 12, top + 18, 12, Math.max(45, tubeHeight - 36));

    ctx.font = '800 12px system-ui';
    ctx.fillStyle = '#002144';
    ctx.fillText('VOLTAGE BOOST', 15, 35);
    ctx.fillText('CLOCK STARTS', tubeStart - 28, 58);
    ctx.fillText(surface.width <= 520 ? 'DRIFT TUBE' : 'FIELD-FREE DRIFT IN VACUUM', tubeStart + 18, 35);
    ctx.fillText('DETECTOR', surface.width <= 520 ? detectorX - 34 : Math.max(tubeStart + 150, detectorX - 38), 58);
    ctx.strokeStyle = '#7897aa';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(tubeStart, 64);
    ctx.lineTo(tubeStart, bottom + 10);
    ctx.stroke();
    ctx.setLineDash([]);

    for (let x = tubeStart + 44; x < detectorX; x += 44) {
      ctx.strokeStyle = 'rgba(255,255,255,.82)';
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }

    peaks.forEach((peakData, index) => {
      const beforeRun = runtime.phase === 'ready';
      const progress = beforeRun ? 0 : Math.min(1, physicalTimeS / peakData.timeS);
      const x = beforeRun ? sourceX + 26 : tubeStart + progress * (detectorX - tubeStart);
      const y = top + tubeHeight * (index + 1) / 3;
      const arrived = !beforeRun && physicalTimeS >= peakData.timeS;
      ctx.globalAlpha = arrived ? .45 : 1;
      ctx.fillStyle = peakData.color;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#002144';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#002144';
      ctx.font = '900 12px system-ui';
      ctx.fillText(peakData.shortName, x - 4, y + 4);
      if (surface.width > 520) {
        ctx.font = '700 12px system-ui';
        ctx.fillText(
          peakData.massDa + ' Da / +' + peakData.charge + 'e',
          Math.min(x + 17, detectorX - 104),
          y + 4
        );
      }
    });

    ctx.fillStyle = '#466176';
    ctx.font = '650 12px system-ui';
    ctx.fillText('1.50 m timed flight', tubeStart, surface.height - 42);
    if (surface.width > 520) {
      ctx.fillText('Physical flight time →', Math.max(tubeStart, detectorX - 135), surface.height - 42);
      ctx.fillStyle = '#6a7f90';
      ctx.font = '600 11px system-ui';
      ctx.fillText('Markers show packet centers; motion uses one fixed slow-motion scale.', tubeStart, surface.height - 20);
    }
  }

  function drawTrace(peaks, physicalTimeS) {
    const cssHeight = window.innerWidth <= 620 ? 220 : 235;
    const surface = setupCanvas(traceCanvas, cssHeight);
    const ctx = traceContext;
    ctx.setTransform(surface.ratio, 0, 0, surface.ratio, 0, 0);
    ctx.clearRect(0, 0, surface.width, surface.height);
    const pad = { left: surface.width < 520 ? 48 : 58, right: 15, top: 22, bottom: 40 };
    const plotWidth = surface.width - pad.left - pad.right;
    const plotHeight = surface.height - pad.top - pad.bottom;
    const domain = M.CORE_TRACE_DOMAIN_US;
    const yMax = 700;
    const mapX = timeUs => pad.left + (timeUs - domain[0]) / (domain[1] - domain[0]) * plotWidth;
    const mapY = value => pad.top + plotHeight - value / yMax * plotHeight;

    ctx.strokeStyle = '#cbdbe4';
    ctx.fillStyle = '#526b7f';
    ctx.font = '650 11px system-ui';
    [0, 350, 700].forEach(value => {
      const y = mapY(value);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(surface.width - pad.right, y);
      ctx.stroke();
      ctx.fillText(String(value), 8, y + 4);
    });
    for (let value = 0; value <= 18; value += 3) {
      const x = mapX(value);
      ctx.strokeStyle = '#e1ebf0';
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotHeight);
      ctx.stroke();
      ctx.fillStyle = '#526b7f';
      ctx.fillText(String(value), x - 4, surface.height - 21);
    }
    ctx.strokeStyle = '#002144';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, pad.top + plotHeight);
    ctx.lineTo(surface.width - pad.right, pad.top + plotHeight);
    ctx.stroke();
    ctx.fillStyle = '#38566e';
    ctx.font = '750 11px system-ui';
    ctx.fillText('counts / µs', 7, 13);
    ctx.fillText('flight time (µs)', pad.left + plotWidth / 2 - 38, surface.height - 4);

    const cutoffUs = runtime.phase === 'complete'
      ? domain[1]
      : runtime.phase === 'running'
        ? physicalTimeS * 1e6
        : 0;
    const firstSignalUs = Math.min.apply(null, peaks.map(peakData => peakData.timeS * 1e6 - 4 * peakData.sigmaS * 1e6));
    const hasSignal = cutoffUs >= firstSignalUs;
    if (hasSignal) {
      const samples = 420;
      ctx.beginPath();
      ctx.moveTo(mapX(domain[0]), mapY(0));
      for (let point = 0; point <= samples; point += 1) {
        const timeUs = domain[0] + (domain[1] - domain[0]) * point / samples;
        if (timeUs > cutoffUs) break;
        const density = peaks.reduce((total, peakData) => {
          return total + M.gaussianDensity(timeUs * 1e-6, peakData) * 1e-6;
        }, 0);
        ctx.lineTo(mapX(timeUs), mapY(density));
      }
      ctx.lineTo(mapX(Math.min(cutoffUs, domain[1])), mapY(0));
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 164, 227, .20)';
      ctx.fill();
      ctx.strokeStyle = '#002144';
      ctx.lineWidth = 2.7;
      ctx.stroke();

      peaks.forEach((peakData, index) => {
        if (peakData.timeS * 1e6 > cutoffUs) return;
        const centerX = mapX(peakData.timeS * 1e6);
        const offset = Math.abs(peaks[0].timeS - peaks[1].timeS) < 1e-12 ? (index === 0 ? -3 : 3) : 0;
        ctx.fillStyle = peakData.color;
        ctx.fillRect(centerX + offset - 2, mapY(0) - 12, 4, 12);
      });
    }

    if (!hasSignal) {
      ctx.fillStyle = '#526b7f';
      ctx.font = '750 14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(
        runtime.phase === 'running' ? 'Detector waiting for the first arrival…' : 'No detector evidence yet',
        pad.left + plotWidth / 2,
        pad.top + plotHeight / 2
      );
      ctx.textAlign = 'left';
    }
    traceCanvas.setAttribute(
      'aria-label',
      hasSignal
        ? 'Detector trace showing the summed signal recorded so far on a zero to eighteen microsecond axis'
        : 'Detector signal versus flight time; no evidence recorded yet'
    );
  }

  function updateLiveReadout(peaks, physicalTimeS) {
    if (runtime.phase === 'ready') {
      byId('clock-readout').textContent = 'Waiting for Run';
      byId('detector-event').textContent = 'No arrivals recorded';
      return;
    }
    const maximum = Math.max.apply(null, peaks.map(item => item.timeS));
    byId('clock-readout').textContent = microseconds(Math.min(physicalTimeS, maximum + 5 * Math.max.apply(null, peaks.map(item => item.sigmaS))), 2);
    const arrived = peaks.filter(item => physicalTimeS >= item.timeS);
    if (!arrived.length) {
      byId('detector-event').textContent = 'Packets are crossing the drift tube';
    } else if (arrived.length === peaks.length && runtime.phase === 'complete') {
      byId('detector-event').textContent = 'Run complete · total signal recorded';
    } else if (arrived.length === peaks.length) {
      const coincident = Math.abs(peaks[0].timeS - peaks[1].timeS) < 1e-12;
      byId('detector-event').textContent = coincident
        ? 'Ion A + Ion B · coincident arrival'
        : arrived.map(item => item.name).join(', ') + ' recorded';
    } else {
      byId('detector-event').textContent = arrived[arrived.length - 1].name + ' arrived';
    }

    /* The cue narrates the FIRST arrival as it happens, then states the
       observation the stage's Takeaway rests on. */
    const lesson = currentLesson();
    const coincident = Math.abs(peaks[0].timeS - peaks[1].timeS) < 1e-12;
    if (runtime.phase === 'complete') {
      if (coincident) {
        setCue('Both centres landed on ' + microseconds(peaks[0].timeS, 2) +
          ' — one peak, two different ions.', true);
      } else {
        const first = peaks[0].timeS <= peaks[1].timeS ? peaks[0] : peaks[1];
        const second = first === peaks[0] ? peaks[1] : peaks[0];
        const factor = (second.timeS / first.timeS);
        setCue(first.name + ' arrived at ' + microseconds(first.timeS, 2) + ', ' + second.name +
          ' at ' + microseconds(second.timeS, 2) + ' — a factor of ' + factor.toFixed(2) +
          (lesson.id === 'mass' ? ', the square root of the four-fold mass difference.' : '.'));
      }
    } else if (arrived.length === 1 && !coincident) {
      setCue(arrived[0].name + ' has reached the detector; the other is still in the tube.');
    } else if (!arrived.length) {
      setCue('Both packets are in the field-free tube — nothing accelerates them now.');
    }
  }

  function drawCore() {
    const peaks = currentPeaks();
    const maximum = Math.max.apply(null, peaks.map(item => item.timeS + 5 * item.sigmaS));
    const physicalTime = runtime.phase === 'complete' ? maximum : runtime.elapsedS;
    drawFlight(peaks, physicalTime);
    drawTrace(peaks, physicalTime);
    updateLiveReadout(peaks, physicalTime);
  }

  function runCurrentExperiment() {
    const lesson = currentLesson();
    if (!Number.isInteger(lessonState.predictions[lesson.id])) return;
    cancelRun('running');
    const token = runtime.runToken;
    byId('instrument-panel').scrollIntoView({ behavior: 'instant', block: 'start' });
    byId('instrument-panel').focus({ preventScroll: true });
    /* The run clock starts on the first animation frame, not here: a
       requestAnimationFrame timestamp can precede a performance.now() sampled in
       the click handler by up to one frame, and a negative elapsed made the
       model's nonnegative guard throw inside the frame loop, leaving the run
       stuck in 'running' on roughly half of all clicks. */
    runtime.startMs = 0;
    byId('run-button').disabled = true;
    byId('replay-button').hidden = true;
    byId('finding').hidden = true;
    byId('run-hint').textContent = 'Running at 160 milliseconds per physical microsecond (160,000× slow motion).';
    setCue('Clock started. Watch which packet reaches the gold detector plate first.');
    const peaks = currentPeaks();
    const maximum = Math.max.apply(null, peaks.map(item => item.timeS + 5 * item.sigmaS));
    renderPredictions(lesson);

    function frame(now) {
      if (token !== runtime.runToken || runtime.phase !== 'running') return;
      if (!runtime.startMs) runtime.startMs = now;
      runtime.elapsedS = Math.min(
        maximum,
        M.physicalElapsedSeconds(now - runtime.startMs)
      );
      drawCore();
      if (runtime.elapsedS >= maximum) {
        runtime.phase = 'complete';
        runtime.frameId = 0;
        lessonState = M.reduceLessonState(lessonState, { type: 'RUN_COMPLETE' });
        renderCurrentStep();
        return;
      }
      runtime.frameId = requestAnimationFrame(frame);
    }
    runtime.frameId = requestAnimationFrame(frame);
  }

  function goToNextStep() {
    const nextIndex = lessonState.stepIndex + 1;
    if (nextIndex >= M.CORE_LESSONS.length) return;
    cancelRun('ready');
    lessonState = M.reduceLessonState(lessonState, { type: 'GO_TO_STEP', stepIndex: nextIndex });
    syncStageTabs();
    window.lessonShell.selectStage(nextIndex);
    renderCurrentStep();
    byId('lesson-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---- stage 4: the peak-width comparison -------------------------------- */
  function advancedSpread() {
    return runtime.advancedMode === 'absolute'
      ? { mode: 'absolute', value: 0.06 }
      : { mode: 'fractional', value: 0.015 };
  }

  function drawAdvanced(results) {
    const canvas = byId('width-canvas');
    const ctx = canvas.getContext('2d');
    const surface = setupCanvas(canvas, 300);
    ctx.setTransform(surface.ratio, 0, 0, surface.ratio, 0, 0);
    ctx.clearRect(0, 0, surface.width, surface.height);
    const pad = { left: 70, right: 15, top: 24, bottom: 35 };
    const domainMax = 16;
    const rowHeight = (surface.height - pad.top - pad.bottom) / 2;
    const summedDensity = (result, timeUs) => result.peaks.reduce((total, peakData) => {
      return total + M.gaussianDensity(timeUs * 1e-6, peakData) * 1e-6;
    }, 0);
    let maxDensity = 0;
    results.forEach(result => {
      for (let point = 0; point <= 400; point += 1) {
        maxDensity = Math.max(maxDensity, summedDensity(result, domainMax * point / 400));
      }
    });
    maxDensity *= 1.12;
    const mapX = timeUs => pad.left + timeUs / domainMax * (surface.width - pad.left - pad.right);

    results.forEach((result, row) => {
      const rowTop = pad.top + row * rowHeight;
      const baseline = rowTop + rowHeight - 25;
      ctx.fillStyle = row === 0 ? '#f7fbfd' : '#eef6fa';
      ctx.fillRect(pad.left, rowTop, surface.width - pad.left - pad.right, rowHeight);
      ctx.strokeStyle = '#b9cedb';
      ctx.beginPath();
      ctx.moveTo(pad.left, baseline);
      ctx.lineTo(surface.width - pad.right, baseline);
      ctx.stroke();
      ctx.fillStyle = '#002144';
      ctx.font = '800 12px system-ui';
      ctx.fillText(result.lengthM.toFixed(2) + ' m tube', 7, rowTop + 23);

      result.peaks.forEach(peakData => {
        ctx.beginPath();
        for (let point = 0; point <= 400; point += 1) {
          const timeUs = domainMax * point / 400;
          const density = M.gaussianDensity(timeUs * 1e-6, peakData) * 1e-6;
          const x = mapX(timeUs);
          const y = baseline - density / maxDensity * (rowHeight - 42);
          if (point === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = peakData.color;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      ctx.beginPath();
      for (let point = 0; point <= 400; point += 1) {
        const timeUs = domainMax * point / 400;
        const x = mapX(timeUs);
        const y = baseline - summedDensity(result, timeUs) / maxDensity * (rowHeight - 42);
        if (point === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#002144';
      ctx.lineWidth = 2.7;
      ctx.stroke();
    });

    ctx.fillStyle = '#526b7f';
    ctx.font = '650 11px system-ui';
    for (let value = 0; value <= domainMax; value += 2) {
      const x = mapX(value);
      ctx.fillText(String(value), x - 4, surface.height - 17);
    }
    ctx.fillStyle = '#38566e';
    ctx.font = '750 11px system-ui';
    ctx.fillText('shared flight-time axis (µs)', pad.left + (surface.width - pad.left - pad.right) / 2 - 66, surface.height - 3);
  }

  function renderAdvancedComparison() {
    const results = M.resolutionComparison({
      spread: advancedSpread(),
      shortLengthM: 1,
      longLengthM: 2
    });
    byId('width-result').hidden = false;
    drawAdvanced(results);
    byId('comparison-body').innerHTML = results.map(result => {
      return '<tr><td>' + result.lengthM.toFixed(2) + ' m</td><td>' +
        result.separationUs.toFixed(3) + ' µs</td><td>' +
        result.meanFwhmUs.toFixed(3) + ' µs</td><td>' +
        (result.resolved ? 'Resolved: separation ≥ width' : 'Overlapping: separation < width') +
        '</td></tr>';
    }).join('');
    /* A4 for stage 4: the cue states the ratio, which is the quantity the
       stage turns on, rather than leaving the learner to divide the columns. */
    const ratios = results.map(r => r.separationToWidth.toFixed(3)).join(' → ');
    const cue = byId('cue-4');
    if (runtime.advancedMode === 'absolute') {
      byId('width-finding').textContent =
        'With fixed 0.06 µs sigma, doubling the tube doubles the center separation while FWHM stays fixed. This pair crosses the stated criterion only in the 2.00 m tube.';
      cue.textContent = 'Separation-to-width went ' + ratios +
        ' — the width held still while the separation doubled, so the pair separated.';
      cue.classList.remove('cue-warm');
    } else {
      byId('width-finding').textContent =
        'With sigma fixed at 1.5% of arrival time, doubling the tube doubles both separation and width. The separation-to-width ratio stays the same, so this pair remains overlapped.';
      cue.textContent = 'Separation-to-width went ' + ratios +
        ' — unchanged. Both the separation and the width doubled, so the longer tube bought nothing.';
      cue.classList.add('cue-warm');
    }
  }

  function setAdvancedMode(mode) {
    runtime.advancedMode = mode;
    const absolute = mode === 'absolute';
    byId('absolute-width-button').classList.toggle('active', absolute);
    byId('fractional-width-button').classList.toggle('active', !absolute);
    byId('absolute-width-button').setAttribute('aria-pressed', String(absolute));
    byId('fractional-width-button').setAttribute('aria-pressed', String(!absolute));
    byId('width-result').hidden = true;
    byId('cue-4').textContent = '';
  }

  /* ---- Reset means fresh load -------------------------------------------
     The shell reloads the page with a fragment that keeps the Guide shut and
     preserves presentation mode, which is the only reliable way to restore a
     surface this wide. This hook exists so a future demo-local reset can veto
     the reload; ion-flight does not need to, so it returns nothing. */
  window.lessonShell.onReset = null;

  byId('run-button').addEventListener('click', runCurrentExperiment);
  byId('replay-button').addEventListener('click', runCurrentExperiment);
  byId('next-button').addEventListener('click', goToNextStep);
  byId('absolute-width-button').addEventListener('click', () => setAdvancedMode('absolute'));
  byId('fractional-width-button').addEventListener('click', () => setAdvancedMode('fractional'));
  byId('compare-button').addEventListener('click', renderAdvancedComparison);

  /* A stage change cancels any run in flight and re-renders, which is also
     what makes relocating the shared instrument safe. */
  document.addEventListener('stagechange', event => {
    const index = event.detail.index;
    if (index >= M.CORE_LESSONS.length) { cancelRun(lessonState.completed[currentLesson().id] ? 'complete' : 'ready'); return; }
    if (index === lessonState.stepIndex) { moveActivityTo(index); drawCore(); return; }
    cancelRun(lessonState.completed[M.CORE_LESSONS[index].id] ? 'complete' : 'ready');
    lessonState = M.reduceLessonState(lessonState, { type: 'GO_TO_STEP', stepIndex: index });
    renderCurrentStep();
  });

  /* Presentation mode changes --u, which changes the layout, which changes the
     canvas measurements the next draw depends on. */
  document.addEventListener('presentationchange', () => {
    drawCore();
    if (!byId('width-result').hidden) renderAdvancedComparison();
  });

  window.addEventListener('resize', () => {
    drawCore();
    if (!byId('width-result').hidden) renderAdvancedComparison();
  });

  /* Start-up. The shell has already run: it may have selected a stage from a
     #stage-N fragment, and its clamp will have refused a locked one. So read
     the tab it settled on rather than assuming stage 1 — otherwise a deep link
     to stage 4 shows stage 4's panel with stage 1's instrument in it. */
  syncStageTabs();
  const tabs = Array.from(document.querySelectorAll('.stage-tab'));
  const selected = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
  if (selected > 0 && selected < M.CORE_LESSONS.length) {
    lessonState = M.reduceLessonState(lessonState, { type: 'GO_TO_STEP', stepIndex: selected });
  }
  renderCurrentStep();
  /* Stage 4 holds no instrument, so if the shell opened there the shared
     activity must not be left visible in a panel that is now hidden. */
  if (selected >= M.CORE_LESSONS.length) moveActivityTo(0);
})();
