/* Ion Flight's dependency-free physics and lesson model. Bundled into index.html by build.js. */
const IonFlightModel = (() => {
  'use strict';

  const DALTON_KG = 1.66053906660e-27;
  const ELEMENTARY_CHARGE_C = 1.602176634e-19;
  const GAUSSIAN_FWHM = 2 * Math.sqrt(2 * Math.log(2));
  const SCREEN_MS_PER_MICROSECOND = 160;
  const CORE_TRACE_DOMAIN_US = Object.freeze([0, 18]);
  const CORE_INSTRUMENT = Object.freeze({
    lengthM: 1.5,
    voltageV: 20000,
    spread: Object.freeze({ mode: 'absolute', value: 0.18 })
  });

  function positive(value, name) {
    if (!(Number.isFinite(value) && value > 0)) throw new RangeError(`${name} must be positive`);
  }

  /** Field-free transit time after acceleration. Inputs are Da, charge number, V, and m. */
  function flightTimeSeconds({ massDa, charge, voltageV, lengthM }) {
    positive(massDa, 'massDa');
    positive(charge, 'charge');
    positive(voltageV, 'voltageV');
    positive(lengthM, 'lengthM');
    const massKg = massDa * DALTON_KG;
    const chargeC = charge * ELEMENTARY_CHARGE_C;
    return lengthM * Math.sqrt(massKg / (2 * chargeC * voltageV));
  }

  function speedMetersPerSecond({ massDa, charge, voltageV }) {
    positive(massDa, 'massDa');
    positive(charge, 'charge');
    positive(voltageV, 'voltageV');
    return Math.sqrt((2 * charge * ELEMENTARY_CHARGE_C * voltageV) / (massDa * DALTON_KG));
  }

  function sigmaSeconds(timeSeconds, spread) {
    positive(timeSeconds, 'timeSeconds');
    if (!spread || !Number.isFinite(spread.value) || spread.value <= 0) {
      throw new RangeError('spread.value must be positive');
    }
    if (spread.mode === 'fractional') return timeSeconds * spread.value;
    if (spread.mode === 'absolute') return spread.value * 1e-6;
    throw new RangeError('spread.mode must be absolute or fractional');
  }

  function resolvingPower(timeSeconds, sigmaS) {
    positive(timeSeconds, 'timeSeconds');
    positive(sigmaS, 'sigmaS');
    return timeSeconds / (2 * GAUSSIAN_FWHM * sigmaS);
  }

  function peak({ timeS, sigmaS, counts }) {
    positive(timeS, 'timeS');
    positive(sigmaS, 'sigmaS');
    positive(counts, 'counts');
    return {
      timeS,
      sigmaS,
      counts,
      fwhmS: GAUSSIAN_FWHM * sigmaS,
      resolution: resolvingPower(timeS, sigmaS)
    };
  }

  function gaussianDensity(timeS, peakData) {
    const z = (timeS - peakData.timeS) / peakData.sigmaS;
    return peakData.counts * Math.exp(-0.5 * z * z)
      / (peakData.sigmaS * Math.sqrt(2 * Math.PI));
  }

  function integratedCounts(peakData, steps = 12000) {
    const lo = peakData.timeS - 7 * peakData.sigmaS;
    const hi = peakData.timeS + 7 * peakData.sigmaS;
    const dx = (hi - lo) / steps;
    let area = 0;
    for (let i = 0; i <= steps; i += 1) {
      const weight = i === 0 || i === steps ? 0.5 : 1;
      area += weight * gaussianDensity(lo + i * dx, peakData);
    }
    return area * dx;
  }

  function packetPeak(packet, instrument) {
    const timeS = flightTimeSeconds({
      massDa: packet.massDa,
      charge: packet.charge,
      voltageV: instrument.voltageV,
      lengthM: instrument.lengthM
    });
    return {
      ...packet,
      ...peak({
        timeS,
        sigmaS: sigmaSeconds(timeS, instrument.spread),
        counts: packet.counts
      })
    };
  }

  function sameMassToCharge(a, b, epsilon = 1e-12) {
    return Math.abs(a.massDa / a.charge - b.massDa / b.charge) <= epsilon;
  }

  function canResolveByFwhm(a, b) {
    return Math.abs(a.timeS - b.timeS) >= (a.fwhmS + b.fwhmS) / 2;
  }

  const CORE_LESSONS = Object.freeze([
    Object.freeze({
      id: 'mass',
      number: 1,
      shortTitle: 'Change mass',
      title: 'Same charge, different masses',
      purpose: 'Hold charge constant. Test how mass changes arrival time.',
      question: 'Both ions carry +1 charge. Which packet reaches the detector first?',
      choices: Object.freeze(['Ion A — 100 Da, +1', 'Ion B — 400 Da, +1', 'They arrive together']),
      correctChoice: 0,
      mechanism: 'With the same charge and voltage boost, the lighter ion moves faster through the same tube.',
      packets: Object.freeze([
        Object.freeze({ name: 'Ion A', shortName: 'A', massDa: 100, charge: 1, counts: 150, color: '#00A4E3' }),
        Object.freeze({ name: 'Ion B', shortName: 'B', massDa: 400, charge: 1, counts: 150, color: '#ECAC00' })
      ])
    }),
    Object.freeze({
      id: 'charge',
      number: 2,
      shortTitle: 'Change charge',
      title: 'Same mass, different positive charges',
      purpose: 'Hold mass constant. Test how charge changes the energy gained from the same voltage.',
      question: 'Both ions have a mass of 200 Da. Which packet reaches the detector first?',
      choices: Object.freeze(['Ion A — 200 Da, +1', 'Ion B — 200 Da, +2', 'They arrive together']),
      correctChoice: 1,
      mechanism: 'Ion B has twice the positive charge, so the same voltage gives it more kinetic energy and it crosses the tube sooner.',
      packets: Object.freeze([
        Object.freeze({ name: 'Ion A', shortName: 'A', massDa: 200, charge: 1, counts: 150, color: '#00A4E3' }),
        Object.freeze({ name: 'Ion B', shortName: 'B', massDa: 200, charge: 2, counts: 150, color: '#ECAC00' })
      ])
    }),
    Object.freeze({
      id: 'ratio',
      number: 3,
      shortTitle: 'Match the ratio',
      title: 'Different values, equal mass-to-charge ratio',
      purpose: 'Change mass and charge together. Test what the detector can distinguish.',
      question: 'Ion A is 200 Da at +1; Ion B is 400 Da at +2. What will the detector record?',
      choices: Object.freeze(['Ion A arrives first', 'Ion B arrives first', 'One coincident arrival']),
      correctChoice: 2,
      mechanism: 'Both ions have m/z = 200 because 200 ÷ 1 and 400 ÷ 2 are equal. This ideal clock therefore records the same arrival time.',
      packets: Object.freeze([
        Object.freeze({ name: 'Ion A', shortName: 'A', massDa: 200, charge: 1, counts: 150, color: '#00A4E3' }),
        Object.freeze({ name: 'Ion B', shortName: 'B', massDa: 400, charge: 2, counts: 150, color: '#ECAC00' })
      ])
    })
  ]);

  function getLesson(lessonId) {
    const lesson = CORE_LESSONS.find(item => item.id === lessonId);
    if (!lesson) throw new RangeError(`Unknown lesson: ${lessonId}`);
    return lesson;
  }

  function experimentPeaks(lessonId, instrument = CORE_INSTRUMENT) {
    return getLesson(lessonId).packets.map(packet => packetPeak(packet, instrument));
  }

  function detectorFinding(lessonId, predictionIndex, instrument = CORE_INSTRUMENT) {
    const lesson = getLesson(lessonId);
    if (!Number.isInteger(predictionIndex) || predictionIndex < 0 || predictionIndex >= lesson.choices.length) {
      throw new RangeError('predictionIndex must identify a lesson choice');
    }
    const arrivals = experimentPeaks(lessonId, instrument);
    const arrivalGapUs = Math.abs(arrivals[0].timeS - arrivals[1].timeS) * 1e6;
    const supported = predictionIndex === lesson.correctChoice;
    return {
      supported,
      verdict: supported ? 'Your prediction is supported.' : 'The detector contradicts your prediction.',
      explanation: lesson.mechanism,
      arrivalGapUs,
      arrivals
    };
  }

  function screenMilliseconds(timeSeconds, millisecondsPerMicrosecond = SCREEN_MS_PER_MICROSECOND) {
    positive(timeSeconds, 'timeSeconds');
    positive(millisecondsPerMicrosecond, 'millisecondsPerMicrosecond');
    return timeSeconds * 1e6 * millisecondsPerMicrosecond;
  }

  function physicalElapsedSeconds(screenElapsedMs, millisecondsPerMicrosecond = SCREEN_MS_PER_MICROSECOND) {
    if (!(Number.isFinite(screenElapsedMs) && screenElapsedMs >= 0)) {
      throw new RangeError('screenElapsedMs must be nonnegative');
    }
    positive(millisecondsPerMicrosecond, 'millisecondsPerMicrosecond');
    return screenElapsedMs / millisecondsPerMicrosecond / 1e6;
  }

  function initialLessonState() {
    return {
      stepIndex: 0,
      unlockedThrough: 0,
      predictions: {},
      completed: {},
      runRevision: 0
    };
  }

  function reduceLessonState(state, action) {
    const current = state || initialLessonState();
    if (!action || typeof action.type !== 'string') throw new TypeError('action.type is required');
    if (action.type === 'RESET') return initialLessonState();
    if (action.type === 'GO_TO_STEP') {
      if (!Number.isInteger(action.stepIndex) || action.stepIndex < 0 || action.stepIndex > current.unlockedThrough) {
        throw new RangeError('step is not unlocked');
      }
      return { ...current, stepIndex: action.stepIndex };
    }
    const lesson = CORE_LESSONS[current.stepIndex];
    if (action.type === 'SELECT_PREDICTION') {
      if (current.completed[lesson.id]) return current;
      if (!Number.isInteger(action.choiceIndex) || action.choiceIndex < 0 || action.choiceIndex >= lesson.choices.length) {
        throw new RangeError('choice is not valid');
      }
      return {
        ...current,
        predictions: { ...current.predictions, [lesson.id]: action.choiceIndex }
      };
    }
    if (action.type === 'RUN_COMPLETE') {
      if (!Number.isInteger(current.predictions[lesson.id])) {
        throw new Error('a prediction is required before evidence can be completed');
      }
      const unlockedThrough = Math.min(
        CORE_LESSONS.length - 1,
        Math.max(current.unlockedThrough, current.stepIndex + 1)
      );
      return {
        ...current,
        unlockedThrough,
        completed: { ...current.completed, [lesson.id]: true },
        runRevision: current.runRevision + 1
      };
    }
    throw new RangeError(`Unknown lesson action: ${action.type}`);
  }

  function resolutionComparison({
    spread,
    shortLengthM = 1,
    longLengthM = 2,
    voltageV = 20000
  }) {
    const packets = [
      { name: 'Ion C', shortName: 'C', massDa: 200, charge: 1, counts: 150, color: '#00A4E3' },
      { name: 'Ion D', shortName: 'D', massDa: 205, charge: 1, counts: 150, color: '#ECAC00' }
    ];
    return [shortLengthM, longLengthM].map(lengthM => {
      const peaks = packets.map(packet => packetPeak(packet, { lengthM, voltageV, spread }));
      const separationUs = Math.abs(peaks[0].timeS - peaks[1].timeS) * 1e6;
      const meanFwhmUs = ((peaks[0].fwhmS + peaks[1].fwhmS) / 2) * 1e6;
      return {
        lengthM,
        peaks,
        separationUs,
        meanFwhmUs,
        separationToWidth: separationUs / meanFwhmUs,
        resolved: canResolveByFwhm(peaks[0], peaks[1])
      };
    });
  }

  return {
    DALTON_KG,
    ELEMENTARY_CHARGE_C,
    GAUSSIAN_FWHM,
    SCREEN_MS_PER_MICROSECOND,
    CORE_TRACE_DOMAIN_US,
    CORE_INSTRUMENT,
    CORE_LESSONS,
    flightTimeSeconds,
    speedMetersPerSecond,
    sigmaSeconds,
    resolvingPower,
    peak,
    gaussianDensity,
    integratedCounts,
    packetPeak,
    sameMassToCharge,
    canResolveByFwhm,
    getLesson,
    experimentPeaks,
    detectorFinding,
    screenMilliseconds,
    physicalElapsedSeconds,
    initialLessonState,
    reduceLessonState,
    resolutionComparison
  };
})();

if (typeof module !== 'undefined') module.exports = IonFlightModel;
