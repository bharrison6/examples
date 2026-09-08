const fs = require('node:fs');
const path = require('node:path');
const here = __dirname;
const template = fs.readFileSync(path.join(here, 'app.template.html'), 'utf8');
const model = fs.readFileSync(path.join(here, 'model.js'), 'utf8');
const output = template.replace('/*__MISSING_TIME_MODEL__*/', model);
if (!template.includes('/*__MISSING_TIME_MODEL__*/')) throw new Error('bundle marker missing');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(path.join(here, 'index.html'), 'utf8') !== output) throw new Error('index.html is not the reproducible bundle');
  console.log('Missing Time bundle is current.');
} else {
  fs.writeFileSync(path.join(here, 'index.html'), output);
  console.log('Built index.html from model.js and app.template.html.');
}
