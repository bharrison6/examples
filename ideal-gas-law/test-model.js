#!/usr/bin/env node
/* Headless checks on src/model.js — the physics must hold before any UI is
   built on it. Every check here is a claim the demo makes on screen:

     1. the measured pressure agrees with P·A = N·T at the default settings
        (small discs), to within the finite-sample noise;
     2. with the thermostat off and the piston still, kinetic energy is
        conserved through wall and disc–disc collisions;
     3. the 2D Maxwell speed density integrates to 1, and its rms speed is
        sqrt(2T) — the DOF = 2 bookkeeping is consistent;
     4. the measured wall-hit rate matches the kinetic-theory expectation;
     5. large discs push the measured pressure ABOVE the ideal prediction
        (the excluded-area drift stage 4 is about), and the first-order
        estimate has the same direction;
     6. pushing the piston in with the thermostat off RAISES the temperature
        (adiabatic heating), and doubling N / doubling T / halving W at fixed
        T each roughly double the measured pressure — the three guided
        experiments.

   Seeded, so a failure reproduces. Tolerances are loose on purpose: these are
   sanity bounds on a stochastic system, not regression pins.

     node test-model.js */
'use strict';
const M = require('./src/model.js');

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  (' + detail + ')' : ''));
  if (!ok) failures++;
}

/* Run the gas for `seconds` of simulated time in 1/60·timeScale frames,
   returning the closed measurement window. */
function measure(gas, seconds, frame) {
  frame = frame || (2 / 60);
  M.beginWindow(gas);
  for (let t = 0; t < seconds; t += frame) M.advance(gas, frame);
  return M.endWindow(gas);
}
function settle(gas, seconds, frame) {
  frame = frame || (2 / 60);
  for (let t = 0; t < seconds; t += frame) M.advance(gas, frame);
}

/* 1. P·A = N·T at the defaults ------------------------------------------- */
{
  const gas = M.createGas({ rng: M.seeded(11) });
  settle(gas, 3);
  const m = measure(gas, 12);
  const band = 3 * m.uncertainty / m.P + 0.04; /* noise band plus the small-disc excluded area */
  check('P/P_ideal ~ 1 at defaults', Math.abs(m.ratio - 1) < band,
    'ratio ' + m.ratio.toFixed(3) + ', hits ' + m.hits + ', band ±' + band.toFixed(3));
  check('excluded-area estimate is small at the default radius',
    M.excludedAreaZ(gas.N, gas.r, M.area(gas)) < 1.06,
    'Z_est ' + M.excludedAreaZ(gas.N, gas.r, M.area(gas)).toFixed(3));
}

/* 2. Energy conservation, thermostat off --------------------------------- */
{
  const gas = M.createGas({ rng: M.seeded(7), thermostat: false });
  const before = M.kineticEnergy(gas);
  settle(gas, 10);
  const after = M.kineticEnergy(gas);
  check('kinetic energy conserved with thermostat off', Math.abs(after / before - 1) < 1e-6,
    'ratio ' + (after / before).toFixed(9));
}

/* 3. The 2D Maxwell density ---------------------------------------------- */
{
  const T = 300;
  let integral = 0, second = 0;
  const dv = 0.01, vMax = 8 * Math.sqrt(T);
  for (let v = 0; v < vMax; v += dv) {
    const f = M.maxwellSpeedPdf(v + dv / 2, T);
    integral += f * dv;
    second += (v + dv / 2) * (v + dv / 2) * f * dv;
  }
  check('2D Maxwell pdf integrates to 1', Math.abs(integral - 1) < 1e-3, integral.toFixed(5));
  check('2D Maxwell <v^2> = DOF·T', Math.abs(second / (M.DOF * T) - 1) < 1e-3, (second / T).toFixed(4) + ' vs ' + M.DOF);
  check('rmsSpeed(T) is sqrt(DOF·T)', Math.abs(M.rmsSpeed(T) - Math.sqrt(M.DOF * T)) < 1e-12);
  const gas = M.createGas({ rng: M.seeded(3), count: 600, thermostat: false });
  const tMeasured = M.temperature(gas);
  check('sampled velocities give T near the target', Math.abs(tMeasured / 300 - 1) < 0.08, tMeasured.toFixed(1));
}

/* 4. Wall-hit rate ---------------------------------------------------------- */
{
  const gas = M.createGas({ rng: M.seeded(5) });
  settle(gas, 2);
  const m = measure(gas, 10);
  const expected = M.expectedHitRate(gas.N, m.T, gas.W, gas.H);
  const got = m.hits / m.seconds;
  check('wall-hit rate matches kinetic theory', Math.abs(got / expected - 1) < 0.12,
    got.toFixed(1) + '/s measured vs ' + expected.toFixed(1) + '/s expected');
}

/* 5. Large discs: pressure above ideal --------------------------------------- */
{
  const gas = M.createGas({ rng: M.seeded(13), radius: 0.35 });
  settle(gas, 2);
  const small = measure(gas, 8);
  M.setRadius(gas, 1.0);
  settle(gas, 2);
  const big = measure(gas, 8);
  check('big discs raise P/P_ideal well above the small-disc value', big.ratio > small.ratio + 0.15,
    'small ' + small.ratio.toFixed(3) + ', big ' + big.ratio.toFixed(3));
  const est = M.excludedAreaZ(gas.N, 1.0, M.area(gas));
  check('first-order estimate is above 1 and within ~25% of the measurement',
    est > 1.1 && Math.abs(est / big.ratio - 1) < 0.25, 'estimate ' + est.toFixed(3));
}

/* 6. The three guided experiments, and adiabatic heating -------------------- */
{
  /* double N */
  const gas = M.createGas({ rng: M.seeded(21) });
  settle(gas, 2);
  const a = measure(gas, 6);
  M.setCount(gas, gas.N * 2);
  settle(gas, 1.5);
  const b = measure(gas, 6);
  check('doubling N about doubles P', Math.abs(b.P / a.P - 2) < 0.3, (b.P / a.P).toFixed(2) + 'x');
}
{
  /* double T */
  const gas = M.createGas({ rng: M.seeded(22) });
  settle(gas, 2);
  const a = measure(gas, 6);
  M.setTemperature(gas, 600, true);
  settle(gas, 1.5);
  const b = measure(gas, 6);
  check('doubling T about doubles P', Math.abs(b.P / a.P - 2) < 0.3, (b.P / a.P).toFixed(2) + 'x');
}
{
  /* halve W, thermostat on */
  const gas = M.createGas({ rng: M.seeded(23) });
  settle(gas, 2);
  const a = measure(gas, 6);
  M.setBoxWidth(gas, 50);
  settle(gas, 6);
  check('piston reached its target', Math.abs(gas.W - 50) < 1e-6, 'W ' + gas.W.toFixed(2));
  const b = measure(gas, 6);
  check('halving the box at fixed T about doubles P', Math.abs(b.P / a.P - 2) < 0.35, (b.P / a.P).toFixed(2) + 'x');
  check('thermostat held T through the compression', Math.abs(b.T / 300 - 1) < 0.05, 'T ' + b.T.toFixed(1));
}
{
  /* halve W, thermostat OFF: the moving wall does work on the gas */
  const gas = M.createGas({ rng: M.seeded(24), thermostat: false });
  settle(gas, 2);
  const t0 = M.temperature(gas);
  M.setBoxWidth(gas, 50);
  settle(gas, 6);
  const t1 = M.temperature(gas);
  check('compression with thermostat off heats the gas', t1 > t0 * 1.4, t0.toFixed(0) + ' -> ' + t1.toFixed(0));
  check('nobody is outside the box after the piston move', (() => {
    for (let i = 0; i < gas.N; i++) if (gas.x[i] > gas.W - gas.r + 1e-9 || gas.x[i] < gas.r - 1e-9) return false;
    return true;
  })());
}

console.log(failures ? failures + ' check(s) FAILED' : 'all model checks passed');
process.exitCode = failures ? 1 : 0;
