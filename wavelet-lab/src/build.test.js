'use strict';
var fs = require('fs'), cp = require('child_process'), path = require('path'), vm = require('vm');
var root = path.resolve(__dirname, '..');
var result = cp.spawnSync(process.execPath, ['build.js', '--check'], { cwd: root, encoding: 'utf8' });
if (result.status !== 0) { console.error(result.stdout + result.stderr); process.exit(result.status || 1); }
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
var source = fs.readFileSync(path.join(root, 'src', 'wavelet.js'), 'utf8').replace(/\r\n/g, '\n');
var match = html.match(/\/\* WAVELET_CORE: BEGIN \*\/\n([\s\S]*?)\n\/\* WAVELET_CORE: END \*\//);
if (!match || match[1] !== source) { console.error('FAIL  bundled production module differs from src/wavelet.js'); process.exit(1); }
console.log('PASS  index contains the verbatim tested production module');
var scripts = html.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi) || [];
scripts.forEach(function (tag, index) {
  var body = tag.replace(/^<script(?:\s[^>]*)?>/i, '').replace(/<\/script>$/i, '');
  new vm.Script(body, { filename: 'index.html inline script ' + (index + 1) });
});
console.log('PASS  every bundled inline script parses in Node vm.Script');
