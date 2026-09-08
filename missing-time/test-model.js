const assert = require('node:assert/strict');
const M = require('./model.js');
const near = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} !== ${expected}`);

// Hand-worked continuous record: 20 m + 14 m + 16 m over six Myr, without a gap.
const continuous = M.compiledCase('continuous-record').sections[0];
near(continuous.elapsedMyr, 6); near(continuous.thicknessM, 50); assert.equal(continuous.gaps.length, 0);
assert.deepEqual(continuous.chronology.map(anchor => anchor.modelMyr), [0, 6]);

// Top-down erosion crosses a whole cap then partially removes the next lower layer.
const bank = M.compiledCase('cut-bank').sections[0];
assert.deepEqual(bank.layers.map(layer => [layer.id, layer.survivingThicknessM]), [['b-base', 20], ['b-middle', 8], ['b-top', 18]]);
near(bank.thicknessM, 46); assert.equal(bank.gaps.length, 1); near(bank.gaps[0].fromMyr, 2 + 8 / 12); near(bank.gaps[0].toMyr, 5.4);
assert.ok(bank.gaps[0].causes.some(cause => cause.type === 'erode'));
near(bank.chronology[0].derivedMyr, bank.gaps[0].fromMyr); near(bank.chronology[1].derivedMyr, bank.gaps[0].toMyr);
assert.ok(bank.ledger.find(item => item.id === 'b-erosion').removed.some(item => item.layerId === 'b-cap' && item.thicknessM === 15));
assert.ok(bank.ledger.find(item => item.id === 'b-erosion').removed.some(item => item.layerId === 'b-middle' && item.thicknessM === 10));

// Actual specimen locations remain in surviving rock and every authored specimen satisfies its synthetic lifetime.
const middle = M.sampleLayer('cut-bank', 'b', 'b-middle');
assert.equal(middle.specimens.length, 1); assert.equal(middle.specimens[0].species, 'Asteria'); near(middle.specimens[0].depthM, 24.8);
assert.throws(() => M.sampleLayer('cut-bank', 'b', 'b-cap'), /unknown surviving layer/);
M.CASES.forEach(caseDef => caseDef.sections.map(M.compileSection).forEach(section => section.layers.forEach(layer => layer.fossils.forEach(fossil => {
  const life = M.SPECIES[fossil.species].lifetime; assert.ok(fossil.timeMyr >= life[0] && fossil.timeMyr <= life[1]);
  assert.ok(fossil.depthFromBaseM <= layer.survivingThicknessM);
}))));

// Sampling changes observations, never the authored rock record or truth.
const before = JSON.stringify(M.compiledCase('continuous-record'));
M.sampleLayer('continuous-record', 'a', 'a-base');
assert.equal(JSON.stringify(M.compiledCase('continuous-record')), before);
assert.equal(M.evidenceStatus('continuous-record', []).kind, 'incomplete');
assert.equal(M.evidenceStatus('continuous-record', ['sample:a:a-middle', 'sample:a:a-top']).kind, 'incomplete');
assert.equal(M.evidenceStatus('continuous-record', ['sample:a:a-middle', 'sample:a:a-top', 'chronology:a']).kind, 'ready');
assert.equal(M.evidenceStatus('cut-bank', ['gap:b-middle-to-b-top', 'chronology:b', 'sample:b:b-middle', 'sample:b:b-top']).kind, 'ready');
assert.equal(M.evidenceStatus('cut-bank', ['gap:bogus', 'sample:bogus']).kind, 'incomplete');
assert.equal(M.evidenceStatus('paired-sections', ['gap:c-base-to-c-top', 'sample:c:c-base']).kind, 'incomplete');
assert.equal(M.evidenceStatus('paired-sections', ['gap:c-base-to-c-top', 'sample:c:c-base', 'sample:d:d-top']).kind, 'incomplete');
assert.equal(M.evidenceStatus('paired-sections', ['gap:c-base-to-c-top', 'chronology:c', 'sample:c:c-base', 'sample:d:d-middle']).kind, 'incomplete');
assert.equal(M.evidenceStatus('paired-sections', ['gap:c-base-to-c-top', 'chronology:c', 'chronology:d', 'sample:c:c-base', 'sample:d:d-middle']).kind, 'ready');

console.log('Missing Time model: ledger, pause, erosion, fossils, and evidence checks passed.');
