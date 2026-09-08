'use strict';
// Reproducibly inject the exact production math module into the offline page.
var fs = require('fs');
var path = require('path');
var root = __dirname;
var template = fs.readFileSync(path.join(root, 'src', 'template.html'), 'utf8');
var core = fs.readFileSync(path.join(root, 'src', 'wavelet.js'), 'utf8').replace(/\r\n/g, '\n');
var marker = '/* WAVELET_CORE */';
if (template.indexOf(marker) === -1) throw new Error('Template core marker is missing.');
var output = template.replace(marker, '/* WAVELET_CORE: BEGIN */\n' + core + '\n/* WAVELET_CORE: END */');
var outPath = path.join(root, 'index.html');
if (process.argv.indexOf('--check') >= 0) {
  if (!fs.existsSync(outPath) || fs.readFileSync(outPath, 'utf8').replace(/\r\n/g, '\n') !== output) {
    console.error('index.html is not current. Run: node build.js'); process.exit(1);
  }
  console.log('PASS  index.html is reproducibly built from src/template.html + src/wavelet.js');
} else { fs.writeFileSync(outPath, output); console.log('Built index.html from source.'); }
