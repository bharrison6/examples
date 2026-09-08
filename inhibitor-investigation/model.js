'use strict';

// Exact, idealized initial-rate model used by the investigation and its tests.
(function (root) {
  const VMAX = 100;
  const KM = 2;
  const BUDGET = 4;
  const HYPOTHESES = Object.freeze([
    Object.freeze({ id: 'competitive', label: 'Competitive pattern', a: 3, b: 1, summary: 'Higher apparent Km; the idealized Vmax is unchanged.' }),
    Object.freeze({ id: 'uncompetitive', label: 'Uncompetitive pattern', a: 1, b: 3, summary: 'Both apparent Km and Vmax decrease in this idealized pattern.' }),
    Object.freeze({ id: 'pure-noncompetitive', label: 'Pure noncompetitive pattern', a: 3, b: 3, summary: 'The idealized Vmax decreases while Km is unchanged.' })
  ]);
  const CASE_ORDER = Object.freeze(['competitive', 'uncompetitive', 'pure-noncompetitive']);

  function rate(substrate, a, b) {
    if (!Number.isFinite(substrate) || substrate < 0 || !Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
      throw new Error('Substrate and model factors must be finite positive teaching values.');
    }
    return VMAX * substrate / (a * KM + b * substrate);
  }

  function baselineRate(substrate) { return rate(substrate, 1, 1); }
  function hypothesis(id) {
    const found = HYPOTHESES.find(item => item.id === id);
    if (!found) throw new Error('Unknown synthetic hypothesis.');
    return found;
  }
  function predictedRate(id, substrate) {
    const item = hypothesis(id);
    return rate(substrate, item.a, item.b);
  }
  function createCase(caseNumber) {
    const index = ((Number(caseNumber) || 0) % CASE_ORDER.length + CASE_ORDER.length) % CASE_ORDER.length;
    return { caseNumber: Number(caseNumber) || 0, hiddenId: CASE_ORDER[index], assays: [], budget: BUDGET };
  }
  function runAssay(state, substrate) {
    if (!state || !Array.isArray(state.assays)) throw new Error('A case state is required.');
    if (!Number.isFinite(substrate) || substrate < 0) throw new Error('Choose a nonnegative substrate concentration.');
    if (state.assays.some(item => item.substrate === substrate)) return { state, kind: 'duplicate', message: 'That concentration is already on your bench; inspect the existing point.' };
    if (state.assays.length >= state.budget) return { state, kind: 'budget', message: 'The four-assay bench is full. Interpret the evidence you have.' };
    const assay = Object.freeze({ substrate, rate: predictedRate(state.hiddenId, substrate) });
    return { state: Object.assign({}, state, { assays: state.assays.concat([assay]) }), kind: 'recorded', assay };
  }
  function compatibleHypotheses(assays) {
    return HYPOTHESES.filter(item => assays.every(assay => Math.abs(predictedRate(item.id, assay.substrate) - assay.rate) < 1e-9));
  }
  function evidenceStatus(assays) {
    const compatible = compatibleHypotheses(assays);
    if (!assays.length) return { kind: 'none', compatible, text: 'No evidence yet. Choose a substrate concentration and run an assay.' };
    if (compatible.length === 1) return { kind: 'discriminated', compatible, text: 'Your measurements isolate one synthetic rate pattern in this bounded model.' };
    return { kind: 'ambiguous', compatible, text: 'Insufficient evidence: more than one synthetic rate pattern still predicts every observed rate exactly.' };
  }
  function explanationIsSound(assays, choice) {
    const status = evidenceStatus(assays);
    return (status.kind === 'discriminated' && choice === 'isolates-pattern') ||
      (status.kind === 'ambiguous' && choice === 'insufficient-evidence');
  }
  function transferFeedback(substrate) {
    const starting = [hypothesis('competitive'), hypothesis('uncompetitive')];
    const values = starting.map(item => ({ label: item.label, rate: predictedRate(item.id, substrate) }));
    const distinct = Math.abs(values[0].rate - values[1].rate) > 1e-9;
    const eliminated = distinct ? 1 : 0;
    return {
      values,
      distinct,
      eliminated,
      text: distinct
        ? 'This measurement eliminates 1 of the 2 remaining candidates: ' + values.map(item => item.label + ' predicts ' + formatRate(item.rate)).join('; ') + '. It is informative; this noiseless model does not rank informative choices by the size of their separation.'
        : 'This measurement eliminates 0 of the 2 remaining candidates: both predict ' + formatRate(values[0].rate) + '.'
    };
  }
  function formatRate(value) { return Number(value).toFixed(1); }
  function curvePoints(id, maxSubstrate, steps) {
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
      const substrate = maxSubstrate * i / steps;
      points.push({ substrate, rate: predictedRate(id, substrate) });
    }
    return points;
  }

  const api = { VMAX, KM, BUDGET, HYPOTHESES, rate, baselineRate, hypothesis, predictedRate, createCase, runAssay, compatibleHypotheses, evidenceStatus, explanationIsSound, transferFeedback, formatRate, curvePoints };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.InhibitorModel = api;
}(typeof window !== 'undefined' ? window : globalThis));
