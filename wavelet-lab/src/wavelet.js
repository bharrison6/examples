/* Wavelet Lab's production math: an orthonormal, multilevel Haar transform. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WaveletLab = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var SQRT2 = Math.sqrt(2);

  function assertPowerOfTwo(n) {
    if (!Number.isInteger(n) || n < 2 || (n & (n - 1)) !== 0) {
      throw new Error('Expected a power-of-two length of at least 2.');
    }
  }
  function clone(a) { return Array.prototype.slice.call(a); }
  function forwardStep(values) {
    var n = values.length, next = new Array(n), i;
    for (i = 0; i < n; i += 2) {
      next[i / 2] = (values[i] + values[i + 1]) / SQRT2;
      next[n / 2 + i / 2] = (values[i] - values[i + 1]) / SQRT2;
    }
    return next;
  }
  function inverseStep(values) {
    var n = values.length, next = new Array(n), i;
    for (i = 0; i < n / 2; i += 1) {
      next[2 * i] = (values[i] + values[n / 2 + i]) / SQRT2;
      next[2 * i + 1] = (values[i] - values[n / 2 + i]) / SQRT2;
    }
    return next;
  }

  // Layout for 8 values: [A3, D3, D2, D2, D1, D1, D1, D1].
  function haar1D(values) {
    assertPowerOfTwo(values.length);
    var out = clone(values), n = out.length, next, i;
    while (n > 1) {
      next = forwardStep(out.slice(0, n));
      for (i = 0; i < n; i += 1) out[i] = next[i];
      n /= 2;
    }
    return out;
  }

  function inverseHaar1D(coefficients) {
    assertPowerOfTwo(coefficients.length);
    var out = clone(coefficients), n = 2, next, i;
    while (n <= out.length) {
      next = clone(out);
      var stepped = inverseStep(out.slice(0, n));
      for (i = 0; i < n; i += 1) next[i] = stepped[i];
      for (i = 0; i < n; i += 1) out[i] = next[i];
      n *= 2;
    }
    return out;
  }

  function assertSquarePowerOfTwo(values, size) {
    assertPowerOfTwo(size);
    if (!values || values.length !== size * size) throw new Error('Expected a square image matching size.');
  }
  function haar2D(values, size) {
    assertSquarePowerOfTwo(values, size);
    var out = clone(values), s, row, col, x, y, line, transformed;
    for (s = size; s > 1; s /= 2) {
      for (y = 0; y < s; y += 1) {
        row = out.slice(y * size, y * size + s);
        transformed = forwardStep(row);
        for (x = 0; x < s; x += 1) out[y * size + x] = transformed[x];
      }
      for (x = 0; x < s; x += 1) {
        line = [];
        for (y = 0; y < s; y += 1) line.push(out[y * size + x]);
        transformed = forwardStep(line);
        for (y = 0; y < s; y += 1) out[y * size + x] = transformed[y];
      }
    }
    return out;
  }
  function inverseHaar2D(coefficients, size) {
    assertSquarePowerOfTwo(coefficients, size);
    var out = clone(coefficients), s, row, col, x, y, line, transformed;
    for (s = 2; s <= size; s *= 2) {
      for (x = 0; x < s; x += 1) {
        line = [];
        for (y = 0; y < s; y += 1) line.push(out[y * size + x]);
        transformed = inverseStep(line);
        for (y = 0; y < s; y += 1) out[y * size + x] = transformed[y];
      }
      for (y = 0; y < s; y += 1) {
        row = out.slice(y * size, y * size + s);
        transformed = inverseStep(row);
        for (x = 0; x < s; x += 1) out[y * size + x] = transformed[x];
      }
    }
    return out;
  }

  function keepLargest(coefficients, count) {
    var keep = Math.max(0, Math.min(coefficients.length, Math.floor(count)));
    var selected = new Array(coefficients.length).fill(false);
    var ranked = coefficients.map(function (value, index) { return { value: value, index: index }; });
    ranked.sort(function (a, b) { return Math.abs(b.value) - Math.abs(a.value) || a.index - b.index; });
    ranked.slice(0, keep).forEach(function (item) { selected[item.index] = true; });
    return coefficients.map(function (value, index) { return selected[index] ? value : 0; });
  }
  function energy(values) { return values.reduce(function (sum, value) { return sum + value * value; }, 0); }
  function squaredError(a, b) {
    if (a.length !== b.length) throw new Error('Vectors must have the same length.');
    return a.reduce(function (sum, value, index) { var d = value - b[index]; return sum + d * d; }, 0);
  }
  // UI formatting only: remove sub-nanounit floating-point residue before
  // decimal rounding, so algebraically equal quantities do not display as
  // different values at a half-cent boundary. The math above stays untouched.
  function formatNumber(value, decimals) {
    var places = Number.isInteger(decimals) && decimals >= 0 ? decimals : 3;
    if (!Number.isFinite(value)) return String(value);
    var stable = Math.round(value * 1e9) / 1e9;
    if (Math.abs(stable) < 0.5 * Math.pow(10, -places)) stable = 0;
    return stable.toFixed(places);
  }
  function coefficientLabels(length) {
    assertPowerOfTwo(length);
    var levels = Math.log2(length), labels = ['A' + levels], level, count, i;
    for (level = levels; level >= 1; level -= 1) {
      count = Math.pow(2, levels - level);
      for (i = 0; i < count; i += 1) labels.push('D' + level + (count > 1 ? '.' + (i + 1) : ''));
    }
    return labels;
  }
  return { SQRT2: SQRT2, haar1D: haar1D, inverseHaar1D: inverseHaar1D, haar2D: haar2D, inverseHaar2D: inverseHaar2D, keepLargest: keepLargest, energy: energy, squaredError: squaredError, formatNumber: formatNumber, coefficientLabels: coefficientLabels };
});
