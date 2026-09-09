'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const UI_STATE = require('./ui-state.js');

function state(mode, era, lastLearned) {
  return {
    mode, era, lastLearned,
    eras: [{ n: 0, kind: 'one' }, { n: 1, kind: 'one' }, { n: 2, kind: 'ult' }]
  };
}

test('selected-era evidence follows the era currently being played', () => {
  const s = state('one', 0, 1);
  assert.equal(UI_STATE.selectedEra(s).n, 0);
  s.era = 1;
  assert.equal(UI_STATE.selectedEra(s).n, 1);
});

test('a learned report is offered only for the selected era and matching mode', () => {
  assert.equal(UI_STATE.canOpenLearnedReport(state('one', 0, 1)), false);
  assert.equal(UI_STATE.canOpenLearnedReport(state('one', 1, 1)), true);
  assert.equal(UI_STATE.canOpenLearnedReport(state('ult', 1, 1)), false);
  assert.equal(UI_STATE.canOpenLearnedReport(state('ult', 2, 2)), true);
  assert.equal(UI_STATE.canOpenLearnedReport(state('net', 1, 1)), false);
});

test('neural move scores stay empty until a network exists', () => {
  const s = { mode: 'net', brain: true, game: { over: false }, neural: null };
  assert.equal(UI_STATE.canShowMoveScores(s), false);
  s.neural = { model: { weights: [] } };
  assert.equal(UI_STATE.canShowMoveScores(s), true);
  s.mode = 'one'; s.neural = null;
  assert.equal(UI_STATE.canShowMoveScores(s), true);
});
