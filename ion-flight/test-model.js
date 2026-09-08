const assert = require('node:assert/strict');
const M = require('./model.js');

const near = (actual, expected, rel = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * rel, `${actual} was not within ${rel} of ${expected}`);
};

// Independently calculated SI fixture: 100 Da, +1, 10,000 V, 1 m = 7.198704624... µs.
near(M.flightTimeSeconds({ massDa: 100, charge: 1, voltageV: 10000, lengthM: 1 }), 7.198704624e-6, 2e-10);
const base = M.flightTimeSeconds({ massDa: 200, charge: 1, voltageV: 20000, lengthM: 1 });
near(M.flightTimeSeconds({ massDa: 200, charge: 1, voltageV: 20000, lengthM: 2 }) / base, 2);
near(M.flightTimeSeconds({ massDa: 200, charge: 1, voltageV: 80000, lengthM: 1 }) / base, 0.5);
near(M.flightTimeSeconds({ massDa: 800, charge: 1, voltageV: 20000, lengthM: 1 }) / base, 2);
assert.equal(M.sameMassToCharge({ massDa: 200, charge: 1 }, { massDa: 400, charge: 2 }), true);
near(M.flightTimeSeconds({ massDa: 200, charge: 1, voltageV: 20000, lengthM: 1 }), M.flightTimeSeconds({ massDa: 400, charge: 2, voltageV: 20000, lengthM: 1 }));

const abs1 = M.sigmaSeconds(base, { mode: 'absolute', value: 0.2 });
const abs2 = M.sigmaSeconds(base * 2, { mode: 'absolute', value: 0.2 });
near(M.resolvingPower(base * 2, abs2) / M.resolvingPower(base, abs1), 2);
const frac1 = M.sigmaSeconds(base, { mode: 'fractional', value: 0.01 });
const frac2 = M.sigmaSeconds(base * 2, { mode: 'fractional', value: 0.01 });
near(M.resolvingPower(base * 2, frac2) / M.resolvingPower(base, frac1), 1);
near(M.resolvingPower(7.198704623986354e-6, 0.2e-6), 7.6425209637, 2e-10);

const p = M.peak({ timeS: base, sigmaS: 0.3e-6, counts: 173 });
near(M.integratedCounts(p), 173, 2e-7);
const broad = M.peak({ timeS: base, sigmaS: 0.9e-6, counts: 173 });
near(M.integratedCounts(broad), 173, 2e-7);
// Core lesson order and evidence are production data, not a detached answer key.
assert.deepEqual(M.CORE_LESSONS.map(lesson => lesson.id), ['mass', 'charge', 'ratio']);
assert.equal(M.detectorFinding('mass', 0).supported, true);
assert.equal(M.detectorFinding('mass', 1).supported, false);
assert.equal(M.detectorFinding('charge', 1).supported, true);
const ratioFinding = M.detectorFinding('ratio', 2);
assert.equal(ratioFinding.supported, true);
near(ratioFinding.arrivalGapUs, 0, 0);

// The state model gates results on a prediction and unlocks the sequence deterministically.
const initial = M.initialLessonState();
assert.throws(() => M.reduceLessonState(initial, { type: 'RUN_COMPLETE' }), /prediction is required/);
const predicted = M.reduceLessonState(initial, { type: 'SELECT_PREDICTION', choiceIndex: 0 });
assert.equal(predicted.predictions.mass, 0);
const completed = M.reduceLessonState(predicted, { type: 'RUN_COMPLETE' });
assert.equal(completed.completed.mass, true);
assert.equal(completed.unlockedThrough, 1);
const stepTwo = M.reduceLessonState(completed, { type: 'GO_TO_STEP', stepIndex: 1 });
assert.equal(stepTwo.stepIndex, 1);
assert.throws(() => M.reduceLessonState(stepTwo, { type: 'GO_TO_STEP', stepIndex: 2 }), /not unlocked/);
assert.deepEqual(M.reduceLessonState(stepTwo, { type: 'RESET' }), initial);

// One physical-time-to-screen-time scale applies to every run and reverses exactly.
const screenMs = M.screenMilliseconds(base);
near(M.physicalElapsedSeconds(screenMs), base);
near(M.screenMilliseconds(base * 2) / screenMs, 2);

// The optional comparison names its width assumptions and uses the same FWHM criterion.
const fixedWidth = M.resolutionComparison({ spread: { mode: 'absolute', value: 0.06 } });
assert.equal(fixedWidth[0].resolved, false);
assert.equal(fixedWidth[1].resolved, true);
near(fixedWidth[1].separationUs / fixedWidth[0].separationUs, 2);
near(fixedWidth[1].meanFwhmUs / fixedWidth[0].meanFwhmUs, 1);
const proportionalWidth = M.resolutionComparison({ spread: { mode: 'fractional', value: 0.015 } });
assert.equal(proportionalWidth[0].resolved, false);
assert.equal(proportionalWidth[1].resolved, false);
near(proportionalWidth[1].separationToWidth, proportionalWidth[0].separationToWidth);

console.log('Ion Flight model: physics, lesson state, evidence, timing, and resolution checks passed.');
