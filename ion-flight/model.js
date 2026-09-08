/* Ion Flight's small, dependency-free physics model. It is bundled into index.html by build.js. */
const IonFlightModel = (() => {
  'use strict';

  const DALTON_KG = 1.66053906660e-27;
  const ELEMENTARY_CHARGE_C = 1.602176634e-19;
  const GAUSSIAN_FWHM = 2 * Math.sqrt(2 * Math.log(2));

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
    if (!spread || !Number.isFinite(spread.value) || spread.value <= 0) throw new RangeError('spread.value must be positive');
    if (spread.mode === 'fractional') return timeSeconds * spread.value;
    if (spread.mode === 'absolute') return spread.value * 1e-6;
    throw new RangeError('spread.mode must be absolute or fractional');
  }

  function resolvingPower(timeSeconds, sigmaS) {
    positive(timeSeconds, 'timeSeconds');
    positive(sigmaS, 'sigmaS');
    // For narrow peaks m ∝ t², so m/Δm ≈ t/(2Δt); Δt here is FWHM.
    return timeSeconds / (2 * GAUSSIAN_FWHM * sigmaS);
  }

  function peak({ timeS, sigmaS, counts }) {
    positive(timeS, 'timeS');
    positive(sigmaS, 'sigmaS');
    positive(counts, 'counts');
    return { timeS, sigmaS, counts, fwhmS: GAUSSIAN_FWHM * sigmaS, resolution: resolvingPower(timeS, sigmaS) };
  }

  function gaussianDensity(timeS, peakData) {
    const z = (timeS - peakData.timeS) / peakData.sigmaS;
    return peakData.counts * Math.exp(-0.5 * z * z) / (peakData.sigmaS * Math.sqrt(2 * Math.PI));
  }

  // A finite numerical area is used only in tests and for trace normalization checks.
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
    const timeS = flightTimeSeconds({ massDa: packet.massDa, charge: packet.charge, voltageV: instrument.voltageV, lengthM: instrument.lengthM });
    return { ...packet, ...peak({ timeS, sigmaS: sigmaSeconds(timeS, instrument.spread), counts: packet.counts }) };
  }

  function sameMassToCharge(a, b, epsilon = 1e-12) {
    return Math.abs(a.massDa / a.charge - b.massDa / b.charge) <= epsilon;
  }

  function canResolveByFwhm(a, b) {
    return Math.abs(a.timeS - b.timeS) >= (a.fwhmS + b.fwhmS) / 2;
  }

  const challenges = [
    {
      id: 'charge',
      prompt: 'Two 100 Da packets get the same voltage. Which reaches the detector first?',
      choices: ['z = 1', 'z = 2', 'They coincide'],
      correct: 1,
      explanation: 'The z = 2 ion receives twice qV. Its speed is √2 times larger, so it arrives first.',
      setup: { profile: 'charge' }
    },
    {
      id: 'mz',
      prompt: 'A 200 Da, z = 1 ion and a 400 Da, z = 2 ion enter this ideal linear TOF. What does the clock distinguish?',
      choices: ['Two arrivals', 'One coincident arrival', 'Only their masses'],
      correct: 1,
      explanation: 'Both have m/z = 200 Da per charge. The ideal drift-time expression gives the same arrival time; a time trace alone cannot separate them.',
      setup: { profile: 'equal' }
    },
    {
      id: 'limit',
      prompt: 'With a 1.5% fractional σ timing spread, can increasing only the flight length resolve 200 and 205 Da, both z = 1?',
      choices: ['Yes, make L as long as possible', 'No, the relative width scales with time', 'Yes, because voltage no longer matters'],
      correct: 1,
      explanation: 'At fixed fractional σ, both the separation and peak width grow in proportion to flight time. Their FWHM overlap ratio stays the same, so length alone cannot win this constrained challenge.',
      setup: { profile: 'close', length: 1.5, voltage: 20, mode: 'fractional', spread: 1.5 }
    }
  ];

  return {
    DALTON_KG, ELEMENTARY_CHARGE_C, GAUSSIAN_FWHM,
    flightTimeSeconds, speedMetersPerSecond, sigmaSeconds, resolvingPower,
    peak, gaussianDensity, integratedCounts, packetPeak, sameMassToCharge,
    canResolveByFwhm, challenges
  };
})();

if (typeof module !== 'undefined') module.exports = IonFlightModel;
