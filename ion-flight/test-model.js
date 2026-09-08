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
assert.equal(M.challenges.length, 3);
assert.equal(M.challenges.find(c => c.id === 'mz').correct, 1);
assert.equal(M.challenges.find(c => c.id === 'limit').correct, 1);
const constrained = { voltageV: 20000, lengthM: 1, spread: { mode: 'fractional', value: 0.015 } };
const a = M.packetPeak({ massDa: 200, charge: 1, counts: 100 }, constrained);
const b = M.packetPeak({ massDa: 205, charge: 1, counts: 100 }, constrained);
assert.equal(M.canResolveByFwhm(a, b), false);
console.log('Ion Flight model: 15 assertions passed.');
