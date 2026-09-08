const fs = require('node:fs');
const path = require('node:path');

const here = __dirname;
const checkOnly = process.argv.slice(2).includes('--check');
const unknownArgs = process.argv.slice(2).filter(arg => arg !== '--check');
if (unknownArgs.length) throw new Error(`Unknown build option: ${unknownArgs.join(', ')}`);
const template = fs.readFileSync(path.join(here, 'app.template.html'), 'utf8');
const model = fs.readFileSync(path.join(here, 'model.js'), 'utf8');
const output = template.replace('/*__ION_FLIGHT_MODEL__*/', model);
if (output === template) throw new Error('Model injection marker was not found.');
const target = path.join(here, 'index.html');
if (checkOnly) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  if (current !== output) {
    console.error('ion-flight/index.html is out of date; run: node build.js');
    process.exitCode = 1;
  } else {
    console.log('ion-flight/index.html is current (read-only check).');
  }
} else {
  fs.writeFileSync(target, output);
  console.log('Built ion-flight/index.html from app.template.html + model.js');
}
