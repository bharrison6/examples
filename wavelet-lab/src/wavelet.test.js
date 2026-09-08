'use strict';
var W = require('./wavelet.js');
var failures = 0;
function close(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-9); }
function vectorsClose(a, b) { return a.length === b.length && a.every(function (v, i) { return close(v, b[i]); }); }
function check(name, fn) { try { if (!fn()) throw new Error('assertion failed'); console.log('PASS  ' + name); } catch (err) { failures += 1; console.log('FAIL  ' + name + ': ' + err.message); } }
// Written directly from the scale functions and signed Haar wavelets; it does
// not call the production transform under test.
function haarMatrix8(row, col) {
  var s8 = 1 / Math.sqrt(8), s4 = 0.5, s2 = 1 / Math.sqrt(2);
  if (row === 0) return s8;
  if (row === 1) return col < 4 ? s8 : -s8;
  if (row === 2) return col < 2 ? s4 : (col < 4 ? -s4 : 0);
  if (row === 3) return col < 4 ? 0 : (col < 6 ? s4 : -s4);
  var pair = row - 4, pairStart = pair * 2;
  return col === pairStart ? s2 : (col === pairStart + 1 ? -s2 : 0);
}
function matVec(matrix, values) { return values.map(function (_, row) { var total = 0; for (var col = 0; col < values.length; col += 1) total += matrix(row, col) * values[col]; return total; }); }
function subsets(n, k, start, chosen, out) { if (chosen.length === k) { out.push(chosen.slice()); return; } for (var i = start; i < n; i += 1) { chosen.push(i); subsets(n, k, i + 1, chosen, out); chosen.pop(); } }

check('fixture [3,1] has Haar coefficients [2√2, √2]', function () { var c = W.haar1D([3, 1]); return close(c[0], 2 * Math.sqrt(2)) && close(c[1], Math.sqrt(2)); });
check('fixture [3,1] coarse-only reconstruction is [2,2], with squared error 2', function () { var c = W.haar1D([3, 1]); var r = W.inverseHaar1D([c[0], 0]); return vectorsClose(r, [2, 2]) && close(W.squaredError([3, 1], r), 2); });
check('fast 8-point transform matches independently formed Haar matrix', function () { var x = [3, -1, 4, 1, 5, -9, 2, 6]; return vectorsClose(W.haar1D(x), matVec(haarMatrix8, x)); });
check('Haar matrix is orthogonal', function () { for (var a = 0; a < 8; a += 1) for (var b = 0; b < 8; b += 1) { var dot = 0; for (var k = 0; k < 8; k += 1) dot += haarMatrix8(k, a) * haarMatrix8(k, b); if (!close(dot, a === b ? 1 : 0)) return false; } return true; });
check('1-D round trip and energy preservation', function () { var x = [2, 7, -3, 4, 1, -5, 8, 0], c = W.haar1D(x); return vectorsClose(W.inverseHaar1D(c), x) && close(W.energy(x), W.energy(c)); });
check('2-D round trip and energy preservation', function () { var x = Array.from({ length: 64 }, function (_, i) { return (i * 17) % 31 - 15; }), c = W.haar2D(x, 8); return vectorsClose(W.inverseHaar2D(c, 8), x) && close(W.energy(x), W.energy(c)); });
check('2-D 4×4 fixture matches independently calculated multilevel subbands', function () { var x=Array.from({length:16},function(_,i){return i+1}); var expected=[34,-4,-1,-1,-16,0,-1,-1,-4,-4,0,0,-4,-4,0,0]; return vectorsClose(W.haar2D(x,4),expected); });
check('a 4×4 constant image has only the DC coefficient and reconstructs uniformly', function () { var x=new Array(16).fill(1),c=W.haar2D(x,4); return close(c[0],4)&&c.slice(1).every(function(v){return close(v,0)})&&vectorsClose(W.inverseHaar2D(W.keepLargest(c,1),4),x); });
check('omitted coefficient energy equals reconstruction squared error', function () { var x = [2, 7, -3, 4, 1, -5, 8, 0], c = W.haar1D(x), kept = W.keepLargest(c, 3), r = W.inverseHaar1D(kept); return close(W.squaredError(x, r), W.energy(c) - W.energy(kept)); });
check('largest-magnitude coefficients are best k-term subsets for a small signal', function () { var x = [1, 4, -2, 3], c = W.haar1D(x), best = W.keepLargest(c, 2), target = W.squaredError(x, W.inverseHaar1D(best)), options = []; subsets(4, 2, 0, [], options); return options.every(function (set) { var trial = c.map(function (v, i) { return set.indexOf(i) >= 0 ? v : 0; }); return target <= W.squaredError(x, W.inverseHaar1D(trial)) + 1e-9; }); });
check('formatter renders the default coarse-only error and omitted energy consistently', function () { var signal=[3,1,4,1,5,9,2,6], c=W.haar1D(signal), kept=[c[0],0,0,0,0,0,0,0], reconstructed=W.inverseHaar1D(kept); return W.formatNumber(W.squaredError(signal,reconstructed),3)==='52.875' && W.formatNumber(W.energy(c)-W.energy(kept),3)==='52.875' && W.formatNumber(reconstructed[0],3)==='3.875'; });
check('coefficient labels explain the 8-value layout', function () { return W.coefficientLabels(8).join(',') === 'A3,D3,D2.1,D2.2,D1.1,D1.2,D1.3,D1.4'; });
console.log('----\n' + (12 - failures) + ' passed, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
