const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const here = __dirname;
const template = fs.readFileSync(path.join(here, 'app.template.html'), 'utf8');
const model = fs.readFileSync(path.join(here, 'model.js'), 'utf8');
const index = fs.readFileSync(path.join(here, 'index.html'), 'utf8');

assert.equal(index, template.replace('/*__ION_FLIGHT_MODEL__*/', model), 'index.html must exactly match the checked-in source bundle');
assert.ok(index.includes(model), 'the tested production model must be embedded verbatim');
const scripts = index.split('<script>').slice(1).map(chunk => chunk.split('</script>')[0]);
assert.equal(scripts.length, 2, 'the bundle should contain model and app scripts');
scripts.forEach((script, number) => new Function(script));
const check = spawnSync(process.execPath, ['build.js', '--check'], { cwd: here, encoding: 'utf8' });
assert.equal(check.status, 0, check.stderr || check.stdout);
assert.match(check.stdout, /read-only check/);
console.log('Ion Flight bundle: verbatim model, inline syntax, and read-only build check passed.');
