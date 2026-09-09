/* Side-effect-free UI selectors for evidence and report routing. */
(function (root) {
'use strict';

function selectedEra(state) {
  return state.eras[state.era];
}

function canOpenLearnedReport(state) {
  if (state.mode === 'rules' || state.mode === 'net') return false;
  if (state.lastLearned === null || state.lastLearned !== state.era) return false;
  const era = selectedEra(state);
  if (!era) return false;
  return state.mode === 'ult' ? era.kind === 'ult' : era.kind !== 'ult';
}

function canShowMoveScores(state) {
  if (!state.brain || state.mode === 'rules' || (state.game && state.game.over)) return false;
  return state.mode !== 'net' || !!(state.neural && state.neural.model);
}

const api = { selectedEra, canOpenLearnedReport, canShowMoveScores };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.UI_STATE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
