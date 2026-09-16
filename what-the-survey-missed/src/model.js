'use strict';

// A transparent, seeded occupancy-and-detection model for a fixed synthetic survey.
(function (root) {
  const SITE_COUNT = 24;
  const MAX_ROUNDS = 3;
  const HABITATS = Object.freeze([
    Object.freeze({ id: 'A', label: 'Habitat A', occupancy: 0.8, detection: 0.25, color: '#00a4e3' }),
    Object.freeze({ id: 'B', label: 'Habitat B', occupancy: 0.5, detection: 0.8, color: '#ecac00' })
  ]);

  function habitat(id) {
    const found = HABITATS.find(item => item.id === id);
    if (!found) throw new RangeError('Unknown habitat: ' + id);
    return found;
  }

  // Mulberry32: compact, deterministic, and sufficient for a disclosed synthetic scenario.
  function seededRandom(seed) {
    let state = Number(seed) >>> 0;
    return function random() {
      state |= 0;
      state = (state + 0x6D2B79F5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedNumber(value) {
    if (Number.isInteger(value)) return value >>> 0;
    const text = String(value == null ? 'occupancy' : value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createScenario(seed) {
    const normalizedSeed = seedNumber(seed);
    const random = seededRandom(normalizedSeed);
    const sites = [];
    HABITATS.forEach(group => {
      for (let index = 0; index < SITE_COUNT; index += 1) {
        const occupied = random() < group.occupancy;
        const detections = [];
        for (let round = 0; round < MAX_ROUNDS; round += 1) {
          detections.push(occupied && random() < group.detection ? 1 : 0);
        }
        sites.push(Object.freeze({ id: group.id + '-' + (index + 1), habitat: group.id, occupied, detections: Object.freeze(detections) }));
      }
    });
    return Object.freeze({ seed: normalizedSeed, sites: Object.freeze(sites) });
  }

  function validateRounds(rounds) {
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > MAX_ROUNDS) throw new RangeError('rounds must be 1 through ' + MAX_ROUNDS);
  }

  function sitesFor(scenario, habitatId) { return scenario.sites.filter(site => site.habitat === habitatId); }
  function detectionHistory(site, rounds) { validateRounds(rounds); return site.detections.slice(0, rounds); }
  function everDetected(site, rounds) { return detectionHistory(site, rounds).some(Boolean); }
  function observedSummary(scenario, rounds, habitatId) {
    validateRounds(rounds);
    const sites = sitesFor(scenario, habitatId);
    const detected = sites.filter(site => everDetected(site, rounds)).length;
    const occupied = sites.filter(site => site.occupied).length;
    return Object.freeze({ habitat: habitatId, rounds, sites: sites.length, detected, observedFraction: detected / sites.length, occupied, realizedOccupancy: occupied / sites.length, siteVisits: sites.length * rounds });
  }
  function expectedDetectedFraction(psi, p, rounds) {
    validateRounds(rounds);
    if (![psi, p].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) throw new RangeError('psi and p must be probabilities from 0 to 1');
    return psi * (1 - Math.pow(1 - p, rounds));
  }
  function expectedForHabitat(habitatId, rounds) {
    const group = habitat(habitatId);
    return expectedDetectedFraction(group.occupancy, group.detection, rounds);
  }
  function countHistories(scenario, habitatId, rounds) {
    validateRounds(rounds);
    const counts = {};
    sitesFor(scenario, habitatId).forEach(site => {
      const key = detectionHistory(site, rounds).join('');
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }

  // P(history | psi,p); this is a likelihood contribution, never a posterior probability.
  function historyProbability(history, psi, p) {
    if (!Array.isArray(history) || !history.length || history.some(value => value !== 0 && value !== 1)) throw new RangeError('history must be a nonempty binary array');
    if (![psi, p].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) throw new RangeError('psi and p must be probabilities from 0 to 1');
    const detections = history.reduce((sum, value) => sum + value, 0);
    if (detections === 0) return (1 - psi) + psi * Math.pow(1 - p, history.length);
    return psi * Math.pow(p, detections) * Math.pow(1 - p, history.length - detections);
  }
  function logLikelihood(historyCounts, psi, p) {
    if (!historyCounts || typeof historyCounts !== 'object') throw new TypeError('historyCounts must be an object');
    let total = 0;
    Object.entries(historyCounts).forEach(([key, count]) => {
      if (!Number.isInteger(count) || count < 0) throw new RangeError('history counts must be nonnegative integers');
      if (count === 0) return;
      const probability = historyProbability(key.split('').map(Number), psi, p);
      if (probability === 0 && count > 0) { total = -Infinity; return; }
      if (total !== -Infinity) total += count * Math.log(probability);
    });
    return total;
  }
  function likelihoodGrid(historyCounts, steps) {
    const divisions = Number.isInteger(steps) && steps >= 2 ? steps : 20;
    const grid = [];
    let maximum = -Infinity;
    for (let i = 0; i <= divisions; i += 1) {
      for (let j = 0; j <= divisions; j += 1) {
        const psi = i / divisions;
        const p = j / divisions;
        const logValue = logLikelihood(historyCounts, psi, p);
        if (logValue > maximum) maximum = logValue;
        grid.push({ psi, p, logLikelihood: logValue });
      }
    }
    return grid.map(cell => Object.freeze({ ...cell, relativeLikelihood: cell.logLikelihood === -Infinity ? 0 : Math.exp(cell.logLikelihood - maximum) }));
  }
  function relativeSupport(grid, cutoff) {
    const threshold = Number.isFinite(cutoff) ? cutoff : 0.15;
    return grid.filter(cell => cell.relativeLikelihood >= threshold);
  }
  function ranking(summaryA, summaryB) {
    if (summaryA.observedFraction === summaryB.observedFraction) return 'tie';
    return summaryA.observedFraction > summaryB.observedFraction ? 'A' : 'B';
  }

  const api = { SITE_COUNT, MAX_ROUNDS, HABITATS, habitat, seededRandom, seedNumber, createScenario, detectionHistory, everDetected, sitesFor, observedSummary, expectedDetectedFraction, expectedForHabitat, countHistories, historyProbability, logLikelihood, likelihoodGrid, relativeSupport, ranking };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OccupancyModel = api;
}(typeof window !== 'undefined' ? window : globalThis));
