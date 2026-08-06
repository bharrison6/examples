// Build: concatenate src/ into a single self-contained index.html.
// Refuses to emit a file containing any external src= or href= reference,
// so the single-file promise cannot rot. (Same policy as Zero to Unbeatable.)
'use strict';
const fs = require('fs');
const path = require('path');

const S = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');

const css = S('styles.css');
// worker.js is included in BOTH bundles: in the worker it wires itself to the
// message pipe; on the page its guard is inert and it just defines
// createWorkerRuntime, which app.js uses as the no-Worker fallback.
const core = [S('engine.js'), S('text.js'), S('arith.js'), S('agent.js'), S('worker.js')].join('\n;\n');
const workerSrc = [S('engine.js'), S('text.js'), S('arith.js'), S('worker.js')].join('\n;\n');
const app = S('app.js');

let html = S('template.html');
html = html.replace('/*__CSS__*/', () => css);
html = html.replace('/*__CORE__*/', () => core);
html = html.replace('/*__WORKER__*/', () => 'const WORKER_SRC = ' + JSON.stringify(workerSrc) + ';');
html = html.replace('/*__APP__*/', () => app);

// ---- single-file guard ----
const external = html.match(/(?:src|href)\s*=\s*["'](?!#|demo-guide\.html)[^"']*["']/g) || [];
const offenders = external.filter(m => /https?:|\/\//.test(m));
if (offenders.length) {
  console.error('BUILD REFUSED — external references found:', offenders);
  process.exit(1);
}

const indexOut = path.join(__dirname, 'index.html');
const guideSrc = path.join(__dirname, 'src', 'demo-guide.html');
const guideOut = path.join(__dirname, 'demo-guide.html');
const checkOnly = process.argv.includes('--check');
const inSync = fs.existsSync(indexOut) && fs.readFileSync(indexOut, 'utf8') === html &&
  fs.existsSync(guideOut) && fs.readFileSync(guideOut, 'utf8') === fs.readFileSync(guideSrc, 'utf8');
if (checkOnly) {
  if (inSync) console.log('build parity OK — no files written');
  else { console.error('build parity MISMATCH — no files written'); process.exitCode = 1; }
} else {
  fs.writeFileSync(indexOut, html);
  fs.copyFileSync(guideSrc, guideOut);
  console.log('built index.html (' + Math.round(html.length / 1024) + ' KB) and demo-guide.html');
}
