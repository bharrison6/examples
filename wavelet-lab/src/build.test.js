'use strict';
/* Checks the shipped page, not the math: that index.html is the canonical build, that
   the two injected sources arrive verbatim, that the contract's Guide/Settings controls
   are actually in the markup with the exact accessible names, and that nothing in the
   page reaches the network. */
var fs = require('fs'), cp = require('child_process'), path = require('path'), vm = require('vm');
var root = path.resolve(__dirname, '..');
var failures = 0, checks = 0;
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n'); }
function check(name, fn) { checks += 1; try { var why = fn(); if (why !== true) throw new Error(why || 'assertion failed'); console.log('PASS  ' + name); } catch (err) { failures += 1; console.log('FAIL  ' + name + ': ' + err.message); } }

var result = cp.spawnSync(process.execPath, ['build.js', '--check'], { cwd: root, encoding: 'utf8' });
if (result.status !== 0) { console.error(result.stdout + result.stderr); process.exit(result.status || 1); }
var html = read('index.html');
var guideSource = read('teacher-guide.html');

check('index contains the verbatim tested production module', function () {
  var match = html.match(/\/\* WAVELET_CORE: BEGIN \*\/\n([\s\S]*?)\n\/\* WAVELET_CORE: END \*\//);
  return (match && match[1] === read(path.join('src', 'wavelet.js'))) || 'bundled production module differs from src/wavelet.js';
});
check('every bundled inline script parses in Node vm.Script', function () {
  (html.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi) || []).forEach(function (tag, index) {
    var body = tag.replace(/^<script(?:\s[^>]*)?>/i, '').replace(/<\/script>$/i, '');
    new vm.Script(body, { filename: 'index.html inline script ' + (index + 1) });
  });
  return true;
});
/* Both guide checks extract from the source by a DIFFERENT route than build.js uses
   (regex over a comment-stripped copy, not indexOf offsets into the original), and then
   assert structure the extraction itself cannot fake. build.js once matched the <style>
   the guide's own header comment merely mentions and injected prose into the stylesheet;
   a test that re-derived the slice the same way agreed with the bug. */
var guideNoComments = guideSource.replace(/<!--[\s\S]*?-->/g, '');
check('the in-app presenter notes are teacher-guide.html, byte for byte', function () {
  var injected = html.match(/<!-- GUIDE: BEGIN[^>]*-->\n([\s\S]*?)\n<!-- GUIDE: END -->/);
  if (!injected) return 'no injected guide block in index.html';
  var body = guideNoComments.match(/<div class="guide-scope">[\s\S]*<\/div>/);
  if (!body) return 'no .guide-scope body in teacher-guide.html';
  if (injected[1] !== body[0]) return 'the notes overlay has drifted from teacher-guide.html';
  return /^<div class="guide-scope">/.test(injected[1]) || 'the injected notes do not start at the guide body';
});
check('the notes stylesheet is the guide stylesheet, is real CSS, and stays scoped to .guide-scope', function () {
  var injected = html.match(/\/\* GUIDE_CSS: BEGIN[^*]*\*\/([\s\S]*?)\/\* GUIDE_CSS: END \*\//);
  if (!injected) return 'no injected guide stylesheet in index.html';
  var css = guideNoComments.match(/<style>([\s\S]*?)<\/style>/);
  if (!css) return 'no <style> block in teacher-guide.html';
  if (injected[1] !== css[1]) return 'the notes stylesheet has drifted from teacher-guide.html';
  // Structural, not comparative: markup here means the slice ran off into prose or a tag,
  // and the CSS parser would drop whatever rule follows it.
  if (injected[1].indexOf('<') >= 0) return 'the injected stylesheet contains markup: ' + injected[1].trim().slice(0, 80);
  if (!/^\s*\.guide-scope\s*\{/.test(injected[1])) return 'the injected stylesheet does not begin with the base .guide-scope rule';
  if (!/\.guide-scope\{[^}]*font:/.test(injected[1].replace(/\s*\{\s*/g, '{'))) return 'the base .guide-scope rule no longer sets a font';
  var leaks = injected[1].split('\n').filter(function (line) {
    var text = line.trim();
    return text.indexOf('{') >= 0 && !/^@media\b/.test(text) && !/^\.guide-scope(?=[\s,{:.>#[])/.test(text);
  });
  return leaks.length === 0 || 'unscoped rule would restyle the app: ' + leaks[0].trim();
});
check('the ? button is named exactly "Guide" and the overlay heading reads Guide', function () {
  var button = html.match(/<button[^>]*id="guideButton"[^>]*>/);
  if (!button) return 'no guideButton in the header';
  if (!/aria-label="Guide"/.test(button[0])) return 'the ? button is not named exactly Guide: ' + button[0];
  var heading = html.match(/<h2 id="guideTitle">([\s\S]*?)<\/h2>/);
  return (heading && /^Guide\b/.test(heading[1].trim())) || 'the Guide overlay heading does not start with Guide';
});
check('Settings offers exactly Open Presenter Notes, Presentation mode and Reset', function () {
  var menu = html.match(/<div class="settingsMenu">([\s\S]*?)<\/div>/);
  if (!menu) return 'no settings menu in index.html';
  var labels = (menu[1].match(/<button[^>]*>([\s\S]*?)<\/button>/g) || []).map(function (b) {
    return b.replace(/<[^>]*>/g, '').trim();
  });
  return labels.join(' | ') === 'Open Presenter Notes | Presentation mode | Reset' ||
    'settings menu reads: ' + labels.join(' | ');
});
check('Reset restores the signal, coefficient toggles, preset and budget', function () {
  var fresh = html.match(/FRESH\s*=\s*\{([^}]*)\}/);
  if (!fresh) return 'no FRESH fresh-load state in the app script';
  var body = html.match(/function resetAll\(\)\{([\s\S]*?)\n/);
  if (!body) return 'no resetAll in the app script';
  return ['state.signal=FRESH.signal.slice()', 'state.signalKeep=new Array(8).fill(true)',
    "byId('budget').value=FRESH.budget", 'setPreset(FRESH.preset)'].every(function (fragment) {
    return body[1].indexOf(fragment) >= 0;
  }) || 'resetAll does not restore all four: ' + body[1].slice(0, 160);
});
check('the page makes no runtime network request', function () {
  var patterns = [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /@import/, /url\(\s*['"]?https?:/i];
  var hit = patterns.filter(function (p) { return p.test(html); });
  if (hit.length) return 'found a network primitive: ' + hit[0];
  var external = [];
  html.replace(/<(script|link|img|iframe|source|video|audio)\b[^>]*>/gi, function (tag) {
    if (/\b(src|href)\s*=\s*["']?https?:/i.test(tag)) external.push(tag.slice(0, 80));
    return tag;
  });
  return external.length === 0 || 'external asset reference: ' + external[0];
});
console.log('----\n' + (checks - failures) + ' passed, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
